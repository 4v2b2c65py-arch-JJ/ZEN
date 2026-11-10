import { logger } from "../utils/logger.js";

export interface ProxyRequest {
  id: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
  metadata?: Record<string, unknown>;
  timestamp: number;
  weight_class: string;
}

export interface ProxyResponse {
  id: string;
  model: string;
  content: string;
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  latency_ms: number;
  cached: boolean;
  timestamp: number;
}

export interface ProxyRule {
  match: string;
  provider: "ollama" | "openai" | "openai-compatible";
  base_url: string;
  model_override?: string;
  api_key?: string;
  weight_class: string;
  enabled: boolean;
}

export interface ProxyMetrics {
  total_requests: number;
  cache_hits: number;
  cache_misses: number;
  avg_latency_ms: number;
  errors: number;
  by_provider: Record<string, { requests: number; errors: number }>;
}

export class ModelProxy {
  private rules = new Map<string, ProxyRule>();
  private cache = new Map<string, { response: ProxyResponse; expiry: number }>();
  private metrics: ProxyMetrics;
  private weightClass: string;
  private cacheTTL: number;

  constructor(weightClass: string = "daemond", cacheTTL: number = 300000) {
    this.weightClass = weightClass;
    this.cacheTTL = cacheTTL;
    this.metrics = {
      total_requests: 0,
      cache_hits: 0,
      cache_misses: 0,
      avg_latency_ms: 0,
      errors: 0,
      by_provider: {},
    };
    logger.info(`Model proxy initialized (weight: ${weightClass}, cache TTL: ${cacheTTL}ms)`);
  }

  addRule(rule: ProxyRule): void {
    this.rules.set(rule.match, rule);
    if (!this.metrics.by_provider[rule.provider]) {
      this.metrics.by_provider[rule.provider] = { requests: 0, errors: 0 };
    }
    logger.info(`Proxy rule added: ${rule.match} -> ${rule.provider} (${rule.base_url})`);
  }

  removeRule(match: string): void {
    this.rules.delete(match);
  }

  listRules(): ProxyRule[] {
    return Array.from(this.rules.values());
  }

  private resolveRule(model: string): ProxyRule | undefined {
    if (this.rules.has(model)) return this.rules.get(model);
    for (const [match, rule] of this.rules) {
      if (model.startsWith(match)) return rule;
    }
    return undefined;
  }

  private cacheKey(req: ProxyRequest): string {
    return `${req.model}:${JSON.stringify(req.messages)}:${req.temperature}:${req.max_tokens}`;
  }

  async route(request: ProxyRequest): Promise<ProxyResponse> {
    this.metrics.total_requests++;
    const start = Date.now();

    const rule = this.resolveRule(request.model);
    if (!rule || !rule.enabled) {
      this.metrics.errors++;
      throw new Error(`No proxy rule for model: ${request.model}`);
    }

    const key = this.cacheKey(request);
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      this.metrics.cache_hits++;
      return { ...cached.response, cached: true, latency_ms: Date.now() - start };
    }
    this.metrics.cache_misses++;

    if (!this.metrics.by_provider[rule.provider]) {
      this.metrics.by_provider[rule.provider] = { requests: 0, errors: 0 };
    }
    this.metrics.by_provider[rule.provider].requests++;

    try {
      const targetModel = rule.model_override ?? request.model;
      const response = await this.forwardToProvider(rule, targetModel, request);
      const latency = Date.now() - start;
      const finalResponse: ProxyResponse = {
        ...response,
        id: request.id,
        model: targetModel,
        latency_ms: latency,
        cached: false,
        timestamp: Date.now(),
      };

      if (finalResponse.content) {
        this.cache.set(key, { response: finalResponse, expiry: Date.now() + this.cacheTTL });
      }

      this.metrics.avg_latency_ms =
        (this.metrics.avg_latency_ms * (this.metrics.total_requests - 1) + latency) /
        this.metrics.total_requests;

      return finalResponse;
    } catch (err) {
      this.metrics.errors++;
      this.metrics.by_provider[rule.provider].errors++;
      logger.error(`Proxy route error for ${request.model}: ${err}`);
      throw err;
    }
  }

  private async forwardToProvider(
    rule: ProxyRule,
    model: string,
    request: ProxyRequest,
  ): Promise<Omit<ProxyResponse, "cached">> {
    const base = rule.base_url.replace(/\/$/, "");

    if (rule.provider === "ollama") {
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          tools: request.tools,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const msg = data.message ?? {};
      return {
        id: request.id,
        model,
        content: msg.content ?? "",
        tool_calls: msg.tool_calls?.map((tc: any) => ({
          id: tc.id ?? crypto.randomUUID(),
          name: tc.function?.name ?? "",
          arguments: typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function?.arguments ?? {},
        })) ?? [],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency_ms: 0,
        timestamp: Date.now(),
      };
    }

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(rule.api_key ? { Authorization: `Bearer ${rule.api_key}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        tools: request.tools,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI-compatible error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0] ?? {};
    const msg = choice.message ?? {};
    return {
      id: request.id,
      model,
      content: msg.content ?? "",
      tool_calls: msg.tool_calls?.map((tc: any) => ({
        id: tc.id ?? crypto.randomUUID(),
        name: tc.function?.name ?? "",
        arguments: typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function?.arguments ?? {},
      })) ?? [],
      usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latency_ms: 0,
      timestamp: Date.now(),
    };
  }

  clearCache(): void {
    this.cache.clear();
    logger.info("Proxy cache cleared");
  }

  getMetrics(): ProxyMetrics {
    return { ...this.metrics };
  }

  getHealth(): { status: string; rules: number; cache_size: number; weight_class: string } {
    return {
      status: "healthy",
      rules: this.rules.size,
      cache_size: this.cache.size,
      weight_class: this.weightClass,
    };
  }
}

export function createModelProxy(weightClass?: string, cacheTTL?: number): ModelProxy {
  return new ModelProxy(weightClass, cacheTTL);
}
