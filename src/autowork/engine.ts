import { createInterface } from "readline";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { CrossComm } from "../crosscomm/index.js";
import { config } from "../config/config.js";

const execFileAsync = promisify(execFile);

export interface WorkCondition {
  id: string;
  name: string;
  type: "interval" | "event" | "data_threshold" | "peer_connected" | "idle";
  enabled: boolean;
  intervalMs?: number;
  threshold?: number;
  check: () => Promise<boolean>;
  action: () => Promise<void>;
  lastRun?: number;
  runCount: number;
}

export interface AutoWorkConfig {
  enabled: boolean;
  weightClass: string;
  checkIntervalMs: number;
  maxConcurrent: number;
  conditions: WorkCondition[];
}

export class AutoWorkEngine {
  private conditions = new Map<string, WorkCondition>();
  private config: AutoWorkConfig;
  private memory: VectorMemory;
  private cross: CrossComm;
  private timer: NodeJS.Timeout | null = null;
  private running = new Set<string>();
  private started = false;

  constructor(memory: VectorMemory, cross: CrossComm, config: AutoWorkConfig) {
    this.memory = memory;
    this.cross = cross;
    this.config = config;
    logger.info(`Auto-work engine initialized (weight: ${config.weightClass}, conditions: ${config.conditions.length})`);
  }

  addCondition(condition: WorkCondition): void {
    this.conditions.set(condition.id, condition);
    logger.info(`Auto-work condition added: ${condition.name} (${condition.type})`);
  }

  removeCondition(id: string): void {
    this.conditions.delete(id);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.timer = setInterval(async () => {
      await this.evaluate();
    }, this.config.checkIntervalMs);
    logger.info(`Auto-work engine started (check every ${this.config.checkIntervalMs}ms)`);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.started = false;
    logger.info("Auto-work engine stopped");
  }

  private async evaluate(): Promise<void> {
    if (!this.config.enabled) return;
    if (this.running.size >= this.config.maxConcurrent) return;

    const now = Date.now();
    for (const [id, condition] of this.conditions) {
      if (!condition.enabled) continue;
      if (this.running.has(id)) continue;

      const due = condition.lastRun ? now - condition.lastRun >= (condition.intervalMs ?? 60000) : true;
      if (!due) continue;

      try {
        const shouldRun = await condition.check();
        if (shouldRun) {
          this.running.add(id);
          condition.lastRun = now;
          condition.runCount++;
          await condition.action();
          this.running.delete(id);
          logger.info(`Auto-work condition executed: ${condition.name}`);
        }
      } catch (err) {
        this.running.delete(id);
        logger.error(`Auto-work condition failed ${condition.name}: ${err}`);
      }
    }
  }

  async runOnce(conditionId: string): Promise<void> {
    const condition = this.conditions.get(conditionId);
    if (!condition) throw new Error(`Condition not found: ${conditionId}`);
    await condition.action();
  }

  getStatus(): { enabled: boolean; running: string[]; conditions: { id: string; name: string; runCount: number; lastRun?: number }[] } {
    return {
      enabled: this.config.enabled,
      running: Array.from(this.running),
      conditions: Array.from(this.conditions.values()).map((c) => ({
        id: c.id,
        name: c.name,
        runCount: c.runCount,
        lastRun: c.lastRun,
      })),
    };
  }
}

export function createAutoWorkEngine(
  memory: VectorMemory,
  cross: CrossComm,
  config: AutoWorkConfig,
): AutoWorkEngine {
  return new AutoWorkEngine(memory, cross, config);
}

// Built-in conditions

export function memoryGrowthCondition(threshold: number = 10): WorkCondition {
  return {
    id: "memory_growth",
    name: "Memory growth sync",
    type: "data_threshold",
    enabled: true,
    threshold,
    check: async () => {
      const count = await (globalThis as any).__jj_memory_count__?.();
      return count >= threshold;
    },
    action: async () => {
      logger.info("Auto-work: memory growth threshold reached, broadcasting sync");
    },
    lastRun: undefined,
    runCount: 0,
  };
}

export function peerConnectedCondition(): WorkCondition {
  return {
    id: "peer_connected",
    name: "Peer connected sync",
    type: "peer_connected",
    enabled: true,
    check: async () => true,
    action: async () => {
      logger.info("Auto-work: peer connected, initiating sync");
    },
    lastRun: undefined,
    runCount: 0,
  };
}

export function intervalCondition(intervalMs: number, action: () => Promise<void>): WorkCondition {
  return {
    id: `interval_${intervalMs}`,
    name: `Interval work (${intervalMs}ms)`,
    type: "interval",
    enabled: true,
    intervalMs,
    check: async () => true,
    action,
    lastRun: undefined,
    runCount: 0,
  };
}
