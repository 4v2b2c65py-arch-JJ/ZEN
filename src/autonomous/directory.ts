import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export interface DirEvent {
  type: "add" | "change" | "unlink";
  path: string;
  timestamp: number;
}

export interface AutonomousDirConfig {
  watchPaths: string[];
  autoOrganize: boolean;
  weightClass: string;
  pollIntervalMs: number;
}

export class AutonomousDirectory {
  private config: AutonomousDirConfig;
  private memory: VectorMemory;
  private watchers = new Map<string, ReturnType<typeof fs.watch>>();
  private eventQueue: DirEvent[] = [];
  private processing = false;

  constructor(memory: VectorMemory, config: AutonomousDirConfig) {
    this.memory = memory;
    this.config = config;
    logger.info(`Autonomous directory worker initialized (weight: ${config.weightClass}, paths: ${config.watchPaths.length})`);
  }

  async start(): Promise<void> {
    for (const watchPath of this.config.watchPaths) {
      if (!fs.existsSync(watchPath)) {
        fs.mkdirSync(watchPath, { recursive: true });
      }
      this.watchPath(watchPath);
    }
    setInterval(() => this.processQueue(), this.config.pollIntervalMs);
    logger.info(`Autonomous directory worker started`);
  }

  private watchPath(dirPath: string): void {
    const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const fullPath = path.join(dirPath, filename);
      this.eventQueue.push({
        type: eventType as DirEvent["type"],
        path: fullPath,
        timestamp: Date.now(),
      });
      logger.info(`Dir event: ${eventType} ${fullPath}`);
    });
    this.watchers.set(dirPath, watcher);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) return;
    this.processing = true;
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      try {
        await this.handleEvent(event);
      } catch (err) {
        logger.error(`Autonomous dir event error: ${err}`);
      }
    }
    this.processing = false;
  }

  private async handleEvent(event: DirEvent): Promise<void> {
    if (event.type === "add" || event.type === "change") {
      try {
        const stat = fs.statSync(event.path);
        if (stat.isFile()) {
          const content = fs.readFileSync(event.path, "utf8");
          await this.memory.add({
            content: `File ${event.type}: ${event.path}\n${content.slice(0, 2000)}`,
            metadata: { path: event.path, event: event.type, size: stat.size },
            source: "system",
          });
        }
      } catch {
        // file may have been removed between event and read
      }
    }
    if (this.config.autoOrganize && event.type === "add") {
      await this.organizeFile(event.path);
    }
  }

  private async organizeFile(filePath: string): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const dir = path.dirname(filePath);
    const targetDir = path.join(dir, ext.slice(1) || "misc");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, path.basename(filePath));
    if (filePath !== target) {
      fs.renameSync(filePath, target);
      logger.info(`Auto-organized: ${filePath} -> ${target}`);
    }
  }

  async readDir(dirPath: string): Promise<any> {
    if (!fs.existsSync(dirPath)) return { error: "not found" };
    const stat = fs.statSync(dirPath);
    if (stat.isDirectory()) {
      return { path: dirPath, isDirectory: true, entries: fs.readdirSync(dirPath, { withFileTypes: true }).map((e) => ({ name: e.name, isDirectory: e.isDirectory() })) };
    }
    return { path: dirPath, isDirectory: false, content: fs.readFileSync(dirPath, "utf8") };
  }

  async writeFile(filePath: string, content: string): Promise<any> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
    return { path: filePath, ok: true, written: content.length };
  }

  async stop(): Promise<void> {
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

export function createAutonomousDirectory(memory: VectorMemory, config: AutonomousDirConfig): AutonomousDirectory {
  return new AutonomousDirectory(memory, config);
}
