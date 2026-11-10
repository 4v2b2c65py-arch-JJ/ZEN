export interface BrainScanResult {
  id: string;
  scan_type: "metadata" | "pattern" | "association" | "recall_cluster";
  source_memory_ids: string[];
  findings: Record<string, unknown>;
  confidence: number;
  created_at: number;
  weight_class: string;
}

export interface MetasPac {
  id: string;
  name: string;
  description: string;
  scan_results: BrainScanResult[];
  merged_insights: Record<string, unknown>;
  created_at: number;
  weight_class: string;
}

export class MetaBrain {
  private memory: any;
  private scans = new Map<string, BrainScanResult>();
  private pacs = new Map<string, MetasPac>();
  private weightClass: string;

  constructor(memory: any, weightClass: string = "daemond") {
    this.memory = memory;
    this.weightClass = weightClass;
  }

  async scanMetadata(memoryIds: string[]): Promise<BrainScanResult> {
    const id = crypto.randomUUID();
    const findings: Record<string, unknown> = {};
    let totalConfidence = 0;
    let count = 0;

    for (const memId of memoryIds) {
      const entry = await this.memory.get(memId);
      if (!entry) continue;
      const words = entry.content.split(/\s+/).filter(Boolean);
      findings[memId] = {
        word_count: words.length,
        char_count: entry.content.length,
        source: entry.source,
        created_at: entry.created_at,
        keywords: this.extractKeywords(entry.content),
      };
      totalConfidence += 0.8;
      count++;
    }

    const confidence = count > 0 ? totalConfidence / count : 0;
    const result: BrainScanResult = {
      id,
      scan_type: "metadata",
      source_memory_ids: memoryIds,
      findings,
      confidence,
      created_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.scans.set(id, result);
    return result;
  }

  async scanPatterns(query: string, topK: number = 10): Promise<BrainScanResult> {
    const id = crypto.randomUUID();
    const results = await this.memory.search(query, topK);
    const clusters: Record<string, string[]> = {};
    let confidence = 0;

    for (const r of results) {
      const source = (r as { source?: string }).source ?? "unknown";
      if (!clusters[source]) clusters[source] = [];
      clusters[source].push(r.content.slice(0, 80));
      confidence += 0.7;
    }

    const result: BrainScanResult = {
      id,
      scan_type: "pattern",
      source_memory_ids: results.map((r: { id: string }) => r.id),
      findings: { clusters, total_results: results.length },
      confidence: results.length > 0 ? confidence / results.length : 0,
      created_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.scans.set(id, result);
    return result;
  }

  async scanAssociations(memoryIds: string[]): Promise<BrainScanResult> {
    const id = crypto.randomUUID();
    const associations: Record<string, string[]> = {};

    for (const id1 of memoryIds) {
      const e1 = await this.memory.get(id1);
      if (!e1) continue;
      associations[id1] = [];
      for (const id2 of memoryIds) {
        if (id1 === id2) continue;
        const e2 = await this.memory.get(id2);
        if (!e2) continue;
        const shared = this.sharedKeywords(e1.content, e2.content);
        if (shared.length > 0) {
          associations[id1].push(`${id2}:${shared.join(",")}`);
        }
      }
    }

    const result: BrainScanResult = {
      id,
      scan_type: "association",
      source_memory_ids: memoryIds,
      findings: { associations, pair_count: memoryIds.length },
      confidence: 0.85,
      created_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.scans.set(id, result);
    return result;
  }

  async createPac(name: string, description: string, scanIds: string[]): Promise<MetasPac> {
    const id = crypto.randomUUID();
    const scanResults: BrainScanResult[] = [];
    const merged: Record<string, unknown> = {};

    for (const sid of scanIds) {
      const scan = this.scans.get(sid);
      if (scan) {
        scanResults.push(scan);
        merged[scan.scan_type] = scan.findings;
      }
    }

    const pac: MetasPac = {
      id,
      name,
      description,
      scan_results: scanResults,
      merged_insights: merged,
      created_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.pacs.set(id, pac);
    return pac;
  }

  getScan(id: string): BrainScanResult | undefined {
    return this.scans.get(id);
  }

  getPac(id: string): MetasPac | undefined {
    return this.pacs.get(id);
  }

  listPacs(): MetasPac[] {
    return Array.from(this.pacs.values());
  }

  listScans(): BrainScanResult[] {
    return Array.from(this.scans.values());
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    const freq: Record<string, number> = {};
    for (const w of words) {
      if (w.length > 3) freq[w] = (freq[w] || 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);
  }

  private sharedKeywords(a: string, b: string): string[] {
    const aw = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const bw = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    return Array.from(aw).filter((w) => bw.has(w));
  }
}

export function createMetaBrain(memory: any, weightClass?: string): MetaBrain {
  return new MetaBrain(memory, weightClass);
}
