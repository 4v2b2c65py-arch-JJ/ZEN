import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { createRequire } from "module";
import { logger } from "../utils/logger.js";
import type { MemoryEntry } from "../types/index.js";
import { createProvider } from "../llm/provider.js";
import { config } from "../config/config.js";

const require = createRequire(import.meta.url);
const initSqlJs: (opts?: { locateFile?: (file: string) => string }) => Promise<{
  Database: {
    new (buffer?: Uint8Array): {
      run: (sql: string, params?: unknown[]) => { lastInsertRowId: number; changes: number };
      prepare: (sql: string) => { run: (params?: unknown[]) => void; get: (params?: unknown[]) => Record<string, unknown> | undefined; all: (params?: unknown[]) => Record<string, unknown>[]; free: () => void };
      get: (sql: string, params?: unknown[]) => Record<string, unknown> | undefined;
      all: (sql: string, params?: unknown[]) => Record<string, unknown>[];
      exec: (sql: string) => void;
      export: () => Uint8Array;
      close: () => void;
    };
  };
}> = require("sql.js");
const SQL = await initSqlJs({
  locateFile: (file: string) => path.join(path.dirname(require.resolve("sql.js")), file),
});

const COSINE_SIM = (a: number[], b: number[]): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
};

export class VectorMemory {
  private db: InstanceType<typeof SQL["Database"]>;
  private dbPath: string;
  private provider: ReturnType<typeof createProvider>;
  private embeddingCache = new Map<string, number[]>();

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let buffer: Uint8Array | undefined;
    if (existsSync(dbPath)) {
      buffer = readFileSync(dbPath);
    }

    this.db = new SQL.Database(buffer);
    this.initSchema();
    this.provider = createProvider(
      config.llmProvider,
      config.llmBaseUrl,
      config.memoryEmbeddingModel,
      config.llmApiKey,
    );
    this.persist();
    logger.info(`Vector memory initialized at ${dbPath}`);
  }

  private initSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB,
        metadata TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'user'
      );
      CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
    `);
  }

  private persist(): void {
    const data = this.db.export();
    writeFileSync(this.dbPath, Buffer.from(data));
  }

  private async embed(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) return cached;
    const vec = await this.provider.embed(text);
    this.embeddingCache.set(text, vec);
    return vec;
  }

  async add(entry: Omit<MemoryEntry, "id" | "created_at" | "updated_at">): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const embedding = await this.embed(entry.content);
    const stmt = this.db.prepare(
      "INSERT INTO memories (id, content, embedding, metadata, created_at, updated_at, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    stmt.run([
      id,
      entry.content,
      Array.from(new Float32Array(embedding)),
      JSON.stringify(entry.metadata),
      now,
      now,
      entry.source,
    ]);
    stmt.free();
    this.persist();
    return id;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const row = this.db
      .prepare("SELECT * FROM memories WHERE id = ?")
      .get([id]) as
      | { id: string; content: string; embedding: string; metadata: string; created_at: number; updated_at: number; source: string }
      | undefined;
    if (!row) return null;
    return this.rowToEntry(row);
  }

  async search(query: string, topK: number = config.memoryTopK): Promise<MemoryEntry[]> {
    const queryVec = await this.embed(query);
    const rows = this.db
      .prepare("SELECT * FROM memories WHERE embedding IS NOT NULL")
      .all() as { id: string; content: string; embedding: number[]; metadata: string; created_at: number; updated_at: number; source: string }[];

    const scored = rows
      .map((row) => ({
        entry: this.rowToEntry(row),
        score: COSINE_SIM(queryVec, row.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((x) => x.entry);

    return scored;
  }

  async list(limit: number = 50): Promise<MemoryEntry[]> {
    const rows = this.db
      .prepare("SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?")
      .all([limit]) as { id: string; content: string; embedding: number[]; metadata: string; created_at: number; updated_at: number; source: string }[];
    return rows.map((row) => this.rowToEntry(row));
  }

  async update(id: string, patch: Partial<Pick<MemoryEntry, "content" | "metadata" | "source">>): Promise<void> {
    const now = Date.now();
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.content !== undefined) {
      fields.push("content = ?");
      values.push(patch.content);
      fields.push("embedding = ?");
      values.push(Array.from(new Float32Array(await this.embed(patch.content))));
    }
    if (patch.metadata !== undefined) {
      fields.push("metadata = ?");
      values.push(JSON.stringify(patch.metadata));
    }
    if (patch.source !== undefined) {
      fields.push("source = ?");
      values.push(patch.source);
    }
    fields.push("updated_at = ?");
    values.push(now);
    values.push(id);
    this.db.prepare(`UPDATE memories SET ${fields.join(", ")} WHERE id = ?`).run(values as any[]);
  }

  async remove(id: string): Promise<void> {
    this.db.prepare("DELETE FROM memories WHERE id = ?").run([id]);
    this.persist();
  }

  async count(): Promise<number> {
    return (this.db.prepare("SELECT COUNT(*) as c FROM memories").get() as { c: number }).c;
  }

  async close(): Promise<void> {
    this.persist();
    this.db.close();
  }

  private rowToEntry(row: { id: string; content: string; metadata: string; created_at: number; updated_at: number; source: string }): MemoryEntry {
    return {
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata ?? "{}"),
      created_at: row.created_at,
      updated_at: row.updated_at,
      source: row.source as MemoryEntry["source"],
    };
  }
}
