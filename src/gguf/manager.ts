export interface GGUFModel {
  id: string;
  name: string;
  filename: string;
  path: string;
  size: number;
  quant_type: string;
  source_url: string;
  source_dataset: string;
  installed_at: number;
  updated_at: number;
  weight_class: string;
  tags: string[];
}

export interface GGUFDatasetSource {
  id: string;
  name: string;
  url: string;
  type: "huggingface" | "direct" | "proxy";
  enabled: boolean;
  weight_class: string;
}

export interface GGUFInstallProgress {
  id: string;
  model_id: string;
  status: "queued" | "downloading" | "verifying" | "installed" | "failed";
  bytes_downloaded: number;
  total_bytes: number;
  percentage: number;
  error?: string;
  updated_at: number;
}

export class GGUFManager {
  private modelsDir: string;
  private models = new Map<string, GGUFModel>();
  private installs = new Map<string, GGUFInstallProgress>();
  private weightClass: string;
  private proxyBaseUrl: string;

  constructor(modelsDir: string = "./models/gguf", weightClass: string = "daemond", proxyBaseUrl?: string) {
    this.modelsDir = modelsDir;
    this.weightClass = weightClass;
    this.proxyBaseUrl = proxyBaseUrl ?? "http://localhost:3334";
    logger.info(`GGUF manager initialized (dir: ${modelsDir}, weight: ${weightClass})`);
  }

  async isAvailable(): Promise<boolean> {
    const fs = await import("fs");
    try {
      fs.accessSync(this.modelsDir);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDirs(): Promise<void> {
    const fs = await import("fs");
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  async listDatasets(): Promise<GGUFDatasetSource[]> {
    return [
      { id: "huggingface-gguf", name: "HuggingFace GGUF", url: "https://huggingface.co", type: "huggingface", enabled: true, weight_class: this.weightClass },
      { id: "proxy-datasets", name: "Proxy Datasets", url: this.proxyBaseUrl, type: "proxy", enabled: true, weight_class: this.weightClass },
    ];
  }

  async searchGGUF(query: string, source: string = "huggingface-gguf"): Promise<Array<{ id: string; name: string; url: string; size?: number; quant_type?: string }>> {
    // Search via proxy to HuggingFace API
    try {
      const res = await fetch(`${this.proxyBaseUrl}/api/search?q=${encodeURIComponent(query)}&source=gguf`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const data = await res.json();
        return data.results ?? [];
      }
    } catch {
      // proxy not available, return empty
    }
    return [];
  }

  async installGGUFFromDataset(
    modelId: string,
    modelName: string,
    sourceUrl: string,
    filename: string,
    quantType: string = "Q4_K_M",
    source: string = "huggingface-gguf",
  ): Promise<GGUFModel> {
    const id = crypto.randomUUID();
    const fs = await import("fs");
    const path = await import("path");

    await this.ensureDirs();
    const destPath = path.join(this.modelsDir, filename);

    const installId = crypto.randomUUID();
    this.installs.set(installId, {
      id: installId,
      model_id: id,
      status: "downloading",
      bytes_downloaded: 0,
      total_bytes: 0,
      percentage: 0,
      updated_at: Date.now(),
    });

    try {
      // Download via proxy or directly
      const downloadUrl = sourceUrl.includes("huggingface.co") ? sourceUrl : `${this.proxyBaseUrl}/proxy/download?url=${encodeURIComponent(sourceUrl)}`;
      const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(600000) });

      if (!res.ok) {
        throw new Error(`Download failed: ${res.status}`);
      }

      const total = Number(res.headers.get("content-length") ?? "0");
      const install = this.installs.get(installId)!;
      install.total_bytes = total;

      const chunks: Uint8Array[] = [];
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        install.bytes_downloaded += value.length;
        install.percentage = total > 0 ? Math.round((install.bytes_downloaded / total) * 100) : 0;
        install.updated_at = Date.now();
        this.installs.set(installId, install);
      }

      const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      fs.writeFileSync(destPath, buffer);

      const model: GGUFModel = {
        id,
        name: modelName,
        filename,
        path: destPath,
        size: buffer.length,
        quant_type: quantType,
        source_url: sourceUrl,
        source_dataset: source,
        installed_at: Date.now(),
        updated_at: Date.now(),
        weight_class: this.weightClass,
        tags: ["gguf", "installed", quantType],
      };

      this.models.set(id, model);
      install.status = "installed";
      install.percentage = 100;
      install.updated_at = Date.now();
      this.installs.set(installId, install);

      logger.info(`GGUF model installed: ${modelName} (${quantType}) -> ${destPath}`);
      return model;
    } catch (err) {
      const install = this.installs.get(installId)!;
      install.status = "failed";
      install.error = String(err);
      install.updated_at = Date.now();
      this.installs.set(installId, install);
      logger.error(`GGUF install failed: ${modelName}: ${err}`);
      throw err;
    }
  }

  listModels(): GGUFModel[] {
    return Array.from(this.models.values());
  }

  getModel(id: string): GGUFModel | undefined {
    return this.models.get(id);
  }

  getInstallProgress(installId: string): GGUFInstallProgress | undefined {
    return this.installs.get(installId);
  }

  listInstalls(): GGUFInstallProgress[] {
    return Array.from(this.installs.values());
  }

  async removeModel(id: string): Promise<boolean> {
    const model = this.models.get(id);
    if (!model) return false;
    const fs = await import("fs");
    try {
      if (fs.existsSync(model.path)) fs.unlinkSync(model.path);
    } catch {
      // ignore
    }
    this.models.delete(id);
    logger.info(`GGUF model removed: ${model.name}`);
    return true;
  }

  getModelsDir(): string {
    return this.modelsDir;
  }
}

export function createGGUFManager(modelsDir?: string, weightClass?: string, proxyBaseUrl?: string): GGUFManager {
  return new GGUFManager(modelsDir, weightClass, proxyBaseUrl);
}

import { logger } from "../utils/logger.js";
