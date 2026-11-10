export interface ModelParameters {
  model: string;
  provider: string;
  base_url: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  tools_enabled: boolean;
  weight_class: string;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ExpansionPackage {
  id: string;
  name: string;
  description: string;
  version: string;
  parameters: ModelParameters;
  created_at: number;
  updated_at: number;
  device_id: string;
  weight_class: string;
  checksum: string;
}

export interface ICloudSyncStatus {
  available: boolean;
  path: string;
  last_sync: number;
  packages_synced: number;
  weight_class: string;
}

export class ICloudExpansion {
  private iCloudPath: string;
  private packagesDir: string;
  private memory: any;
  private weightClass: string;
  private syncInterval: NodeJS.Timeout | null = null;
  private deviceId: string;

  constructor(memory: any, weightClass: string = "daemond") {
    const home = process.env.HOME ?? "/";
    this.iCloudPath = `${home}/Library/Mobile Documents/com~apple~CloudDocs`;
    this.packagesDir = `${this.iCloudPath}/jj-model/expansion-packages`;
    this.memory = memory;
    this.weightClass = weightClass;
    this.deviceId = crypto.randomUUID();
    logger.info(`iCloud expansion initialized (path: ${this.packagesDir}, weight: ${weightClass})`);
  }

  async isAvailable(): Promise<ICloudSyncStatus> {
    const fs = await import("fs");
    let available = false;
    try {
      fs.accessSync(this.iCloudPath);
      available = true;
    } catch {
      available = false;
    }
    return {
      available,
      path: this.iCloudPath,
      last_sync: 0,
      packages_synced: 0,
      weight_class: this.weightClass,
    };
  }

  async ensureDirs(): Promise<void> {
    const fs = await import("fs");
    if (!fs.existsSync(this.iCloudPath)) {
      throw new Error("iCloud Drive not available at " + this.iCloudPath);
    }
    if (!fs.existsSync(this.packagesDir)) {
      fs.mkdirSync(this.packagesDir, { recursive: true });
    }
  }

  async saveExpansionPackage(pkg: ExpansionPackage): Promise<string> {
    const fs = await import("fs");
    const path = await import("path");
    await this.ensureDirs();

    const checksum = this.computeChecksum(pkg);
    pkg.checksum = checksum;
    pkg.updated_at = Date.now();
    pkg.device_id = this.deviceId;

    const filePath = path.join(this.packagesDir, `${pkg.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2));

    // Also store reference in local memory
    await this.memory.add({
      content: `Expansion package saved: ${pkg.name} (${pkg.version})`,
      metadata: { package_id: pkg.id, name: pkg.name, version: pkg.version, file_path: filePath },
      source: "system",
    });

    logger.info(`Expansion package saved: ${pkg.name} -> ${filePath}`);
    return filePath;
  }

  async loadExpansionPackage(id: string): Promise<ExpansionPackage | null> {
    const fs = await import("fs");
    const path = await import("path");
    await this.ensureDirs();

    const filePath = path.join(this.packagesDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as ExpansionPackage;
  }

  async listExpansionPackages(): Promise<ExpansionPackage[]> {
    const fs = await import("fs");
    const path = await import("path");
    await this.ensureDirs();

    const files = fs.readdirSync(this.packagesDir).filter((f) => f.endsWith(".json"));
    const packages: ExpansionPackage[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.packagesDir, file), "utf8");
        packages.push(JSON.parse(raw) as ExpansionPackage);
      } catch (err) {
        logger.error(`Failed to load expansion package ${file}: ${err}`);
      }
    }
    return packages.sort((a, b) => b.updated_at - a.updated_at);
  }

  async deleteExpansionPackage(id: string): Promise<boolean> {
    const fs = await import("fs");
    const path = await import("path");
    await this.ensureDirs();

    const filePath = path.join(this.packagesDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    logger.info(`Expansion package deleted: ${id}`);
    return true;
  }

  async generateExpansionPackageFromModel(
    name: string,
    description: string,
    model: string,
    parameters: Partial<ModelParameters>,
  ): Promise<ExpansionPackage> {
    const id = crypto.randomUUID();
    const pkg: ExpansionPackage = {
      id,
      name,
      description,
      version: "1.0.0",
      parameters: {
        model,
        provider: parameters.provider ?? "ollama",
        base_url: parameters.base_url ?? "http://localhost:11434",
        temperature: parameters.temperature ?? 0.7,
        max_tokens: parameters.max_tokens ?? 500,
        system_prompt: parameters.system_prompt,
        tools_enabled: parameters.tools_enabled ?? true,
        weight_class: parameters.weight_class ?? this.weightClass,
        top_p: parameters.top_p,
        frequency_penalty: parameters.frequency_penalty,
        presence_penalty: parameters.presence_penalty,
      },
      created_at: Date.now(),
      updated_at: Date.now(),
      device_id: this.deviceId,
      weight_class: this.weightClass,
      checksum: "",
    };
    await this.saveExpansionPackage(pkg);
    return pkg;
  }

  async applyExpansionPackage(id: string): Promise<ModelParameters> {
    const pkg = await this.loadExpansionPackage(id);
    if (!pkg) throw new Error(`Expansion package not found: ${id}`);
    await this.memory.add({
      content: `Expansion package applied: ${pkg.name} (model: ${pkg.parameters.model})`,
      metadata: { package_id: pkg.id, model: pkg.parameters.model },
      source: "system",
    });
    logger.info(`Expansion package applied: ${pkg.name}`);
    return pkg.parameters;
  }

  async startSync(intervalMs: number = 60000): Promise<void> {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(async () => {
      await this.syncToICloud();
    }, intervalMs);
    logger.info(`iCloud sync started (${intervalMs}ms)`);
  }

  async stopSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async syncToICloud(): Promise<void> {
    try {
      const packages = await this.listExpansionPackages();
      logger.info(`iCloud sync: ${packages.length} packages synchronized`);
    } catch (err) {
      logger.error(`iCloud sync error: ${err}`);
    }
  }

  private computeChecksum(pkg: ExpansionPackage): string {
    const str = JSON.stringify({ ...pkg, checksum: "" });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  getDeviceId(): string {
    return this.deviceId;
  }
}

export function createICloudExpansion(memory: any, weightClass?: string): ICloudExpansion {
  return new ICloudExpansion(memory, weightClass);
}

import { logger } from "../utils/logger.js";
