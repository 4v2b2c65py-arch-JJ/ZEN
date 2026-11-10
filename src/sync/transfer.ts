import { Readable, Writable } from "stream";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";

const execFileAsync = promisify(execFile);

export interface TransferJob {
  id: string;
  source: string;
  destination: string;
  type: "memory" | "file" | "stream";
  data: any;
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: number;
  completedAt?: number;
  error?: string;
  weightClass: string;
}

export class DataTransfer {
  private jobs = new Map<string, TransferJob>();
  private memory: VectorMemory;
  private concurrency: number;
  private active = 0;

  constructor(memory: VectorMemory, concurrency: number = 5) {
    this.memory = memory;
    this.concurrency = concurrency;
    logger.info(`Data transfer engine initialized (concurrency: ${concurrency})`);
  }

  async enqueue(job: Omit<TransferJob, "id" | "status" | "createdAt" | "weightClass">): Promise<string> {
    const id = crypto.randomUUID();
    const fullJob: TransferJob = {
      ...job,
      id,
      status: "pending",
      createdAt: Date.now(),
      weightClass: "daemond",
    };
    this.jobs.set(id, fullJob);
    this.process();
    return id;
  }

  async getJob(id: string): Promise<TransferJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async listJobs(): Promise<TransferJob[]> {
    return Array.from(this.jobs.values());
  }

  private async process(): Promise<void> {
    if (this.active >= this.concurrency) return;

    const pending = Array.from(this.jobs.values()).find((j) => j.status === "pending");
    if (!pending) return;

    this.active++;
    pending.status = "in_progress";
    try {
      await this.execute(pending);
      pending.status = "completed";
      pending.completedAt = Date.now();
    } catch (err) {
      pending.status = "failed";
      pending.error = String(err);
      logger.error(`Data transfer failed ${pending.id}: ${err}`);
    } finally {
      this.active--;
      this.process();
    }
  }

  private async execute(job: TransferJob): Promise<void> {
    logger.info(`Data transfer ${job.id}: ${job.source} -> ${job.destination} (${job.type})`);

    if (job.type === "memory") {
      if (job.data.content) {
        await this.memory.add({
          content: job.data.content,
          metadata: { ...job.data.metadata, transfer_id: job.id, source_device: job.source },
          source: "user",
        });
      }
    } else if (job.type === "file") {
      // Placeholder for file transfer
      logger.info(`File transfer queued: ${job.data.path}`);
    } else if (job.type === "stream") {
      // Placeholder for stream transfer
      logger.info(`Stream transfer queued: ${job.data.streamId}`);
    }
  }

  getStats(): { total: number; pending: number; completed: number; failed: number; active: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === "pending").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      active: this.active,
    };
  }
}

export function createDataTransfer(memory: VectorMemory, concurrency?: number): DataTransfer {
  return new DataTransfer(memory, concurrency);
}
