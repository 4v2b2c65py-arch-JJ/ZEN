export interface ControlTag {
  id: string;
  tag: string;
  type: "if" | "control" | "memory" | "loop" | "condition" | "update";
  statement: string;
  file: string;
  line: number;
  count: number;
  first_seen: number;
  last_seen: number;
  weight_class: string;
}

export interface ControlFlowScan {
  id: string;
  file: string;
  tags: ControlTag[];
  total_statements: number;
  repeating_count: number;
  scanned_at: number;
  weight_class: string;
}

export class ControlTagger {
  private tags = new Map<string, ControlTag>();
  private scans = new Map<string, ControlFlowScan>();
  private weightClass: string;

  constructor(weightClass: string = "daemond") {
    this.weightClass = weightClass;
    logger.info(`Control tagger initialized (weight: ${weightClass})`);
  }

  async scanFile(filePath: string, content: string): Promise<ControlFlowScan> {
    const fs = await import("fs");
    const path = await import("path");

    const scanId = crypto.randomUUID();
    const tags: ControlTag[] = [];
    const lines = content.split("\n");

    // Patterns for control flow and memory-related statements
    const patterns = [
      { type: "if" as const, regex: /^\s*if\s*\(/gm },
      { type: "control" as const, regex: /^\s*(for|while|do)\s*\(/gm },
      { type: "loop" as const, regex: /^\s*(for|while|forEach|map|filter)\s*\(/gm },
      { type: "condition" as const, regex: /^\s*(else if|switch|case)\b/gm },
      { type: "memory" as const, regex: /\b(memory|recall|store|embed|vector)\b/gi },
      { type: "update" as const, regex: /\b(update|set|replace|modify|patch)\b/gi },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { type, regex } of patterns) {
        const matches = [...line.matchAll(regex)];
        for (const match of matches) {
          const tagId = `${type}:${filePath}:${i + 1}:${match[0]}`;
          const existing = this.tags.get(tagId);
          const now = Date.now();

          if (existing) {
            existing.count++;
            existing.last_seen = now;
            this.tags.set(tagId, existing);
          } else {
            const tag: ControlTag = {
              id: tagId,
              tag: match[0].trim(),
              type,
              statement: line.trim(),
              file: filePath,
              line: i + 1,
              count: 1,
              first_seen: now,
              last_seen: now,
              weight_class: this.weightClass,
            };
            this.tags.set(tagId, tag);
          }
          tags.push(existing ?? this.tags.get(tagId)!);
        }
      }
    }

    const repeatingCount = tags.filter((t) => t.count > 1).length;
    const scan: ControlFlowScan = {
      id: scanId,
      file: filePath,
      tags,
      total_statements: tags.length,
      repeating_count: repeatingCount,
      scanned_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.scans.set(scanId, scan);

    logger.info(`Control scan: ${filePath} - ${tags.length} statements, ${repeatingCount} repeating`);
    return scan;
  }

  async scanDirectory(dirPath: string): Promise<ControlFlowScan[]> {
    const fs = await import("fs");
    const path = await import("path");

    const scans: ControlFlowScan[] = [];
    if (!fs.existsSync(dirPath)) return scans;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const sub = await this.scanDirectory(fullPath);
        scans.push(...sub);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const scan = await this.scanFile(fullPath, content);
          scans.push(scan);
        } catch (err) {
          logger.error(`Failed to scan ${fullPath}: ${err}`);
        }
      }
    }
    return scans;
  }

  getTags(type?: string): ControlTag[] {
    const all = Array.from(this.tags.values());
    return type ? all.filter((t) => t.type === type) : all;
  }

  getRepeatingTags(): ControlTag[] {
    return Array.from(this.tags.values()).filter((t) => t.count > 1);
  }

  getMemoryTags(): ControlTag[] {
    return this.getTags("memory");
  }

  getScan(id: string): ControlFlowScan | undefined {
    return this.scans.get(id);
  }

  listScans(): ControlFlowScan[] {
    return Array.from(this.scans.values());
  }

  getStats(): { total_tags: number; repeating: number; memory_tags: number; scans: number } {
    const all = Array.from(this.tags.values());
    return {
      total_tags: all.length,
      repeating: all.filter((t) => t.count > 1).length,
      memory_tags: all.filter((t) => t.type === "memory").length,
      scans: this.scans.size,
    };
  }
}

export function createControlTagger(weightClass?: string): ControlTagger {
  return new ControlTagger(weightClass);
}

import { logger } from "../utils/logger.js";
