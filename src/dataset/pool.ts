export interface DatasetEntry {
  id: string;
  source: string;
  type: "text" | "json" | "csv" | "device_spec" | "handoff";
  content: string;
  metadata: Record<string, unknown>;
  device_id?: string;
  tags: string[];
  created_at: number;
  weight_class: string;
}

export interface DatasetHandoff {
  id: string;
  from: string;
  to: string;
  dataset_id: string;
  action: "ingest" | "merge" | "replace" | "query";
  status: "pending" | "completed" | "failed";
  created_at: number;
  weight_class: string;
}

export interface DeviceSpec {
  device_id: string;
  name: string;
  type: "iphone" | "ipad" | "mac" | "apple_watch" | "other";
  model: string;
  os_version: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
  weight_class: string;
}

export class DatasetPool {
  private entries = new Map<string, DatasetEntry>();
  private handoffs = new Map<string, DatasetHandoff>();
  private deviceSpecs = new Map<string, DeviceSpec>();
  private memory: any;
  private weightClass: string;

  constructor(memory: any, weightClass: string = "daemond") {
    this.memory = memory;
    this.weightClass = weightClass;
    logger.info(`Dataset pool initialized (weight: ${weightClass})`);
  }

  async ingest(entry: Omit<DatasetEntry, "id" | "created_at" | "weight_class">): Promise<string> {
    const id = crypto.randomUUID();
    const full: DatasetEntry = {
      ...entry,
      id,
      created_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.entries.set(id, full);

    // Store in recall memory
    await this.memory.add({
      content: `DATASET: ${full.source} - ${full.content.slice(0, 2000)}`,
      metadata: {
        dataset_id: id,
        source: full.source,
        type: full.type,
        device_id: full.device_id,
        tags: full.tags,
      },
      source: "dataset",
    });

    logger.info(`Dataset ingested: ${id} from ${full.source}`);
    return id;
  }

  async ingestDeviceSpec(spec: Omit<DeviceSpec, "weight_class">): Promise<string> {
    const id = crypto.randomUUID();
    const full: DeviceSpec = {
      ...spec,
      weight_class: this.weightClass,
    };
    this.deviceSpecs.set(id, full);

    await this.ingest({
      source: `device:${full.device_id}`,
      type: "device_spec",
      content: JSON.stringify(full, null, 2),
      metadata: { device_id: full.device_id, device_type: full.type, model: full.model },
      device_id: full.device_id,
      tags: ["device", "device_spec", full.type, ...full.capabilities],
    });

    logger.info(`Device spec registered: ${full.name} (${full.device_id})`);
    return id;
  }

  async createHandoff(from: string, to: string, datasetId: string, action: DatasetHandoff["action"] = "ingest"): Promise<string> {
    const id = crypto.randomUUID();
    const handoff: DatasetHandoff = {
      id,
      from,
      to,
      dataset_id: datasetId,
      action,
      status: "pending",
      created_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.handoffs.set(id, handoff);

    // Execute handoff
    const entry = this.entries.get(datasetId);
    if (entry) {
      handoff.status = "completed";
      this.handoffs.set(id, handoff);
      logger.info(`Handoff completed: ${from} -> ${to} (${datasetId})`);
    } else {
      handoff.status = "failed";
      this.handoffs.set(id, handoff);
      logger.error(`Handoff failed: dataset ${datasetId} not found`);
    }

    return id;
  }

  async dropInDeviceSpecifics(deviceId: string, specifics: Record<string, unknown>): Promise<string> {
    return this.ingestDeviceSpec({
      device_id: deviceId,
      name: `Device ${deviceId}`,
      type: "other",
      model: String(specifics.model ?? "unknown"),
      os_version: String(specifics.os_version ?? "unknown"),
      capabilities: Array.isArray(specifics.capabilities) ? specifics.capabilities : [],
      metadata: specifics,
    });
  }

  async query(query: string, limit: number = 10): Promise<DatasetEntry[]> {
    const results = await this.memory.search(query, limit);
    return results.map((r: any) => ({
      id: r.metadata?.dataset_id ?? r.id,
      source: r.metadata?.source ?? "memory",
      type: r.metadata?.type ?? "text",
      content: r.content,
      metadata: r.metadata,
      device_id: r.metadata?.device_id,
      tags: r.metadata?.tags ?? [],
      created_at: r.created_at,
      weight_class: this.weightClass,
    }));
  }

  listEntries(): DatasetEntry[] {
    return Array.from(this.entries.values());
  }

  listDeviceSpecs(): DeviceSpec[] {
    return Array.from(this.deviceSpecs.values());
  }

  listHandoffs(): DatasetHandoff[] {
    return Array.from(this.handoffs.values());
  }

  getStats(): { entries: number; device_specs: number; handoffs: number } {
    return {
      entries: this.entries.size,
      device_specs: this.deviceSpecs.size,
      handoffs: this.handoffs.size,
    };
  }
}

export function createDatasetPool(memory: any, weightClass?: string): DatasetPool {
  return new DatasetPool(memory, weightClass);
}

import { logger } from "../utils/logger.js";
