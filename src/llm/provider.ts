import { logger } from "../utils/logger.js";
import type { Message, ToolDefinition, ChatCompletionRequest } from "../types/index.js";

export type { Message, ChatCompletionRequest, ToolDefinition };

export interface LLMProvider {
  complete(request: ChatCompletionRequest): Promise<{ content: string; tool_calls?: ToolCall[] }>;
  embed(text: string): Promise<number[]>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async complete(request: ChatCompletionRequest): Promise<{ content: string; tool_calls?: ToolCall[] }> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
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
      content: msg.content ?? "",
      tool_calls: msg.tool_calls?.map((tc: unknown) => ({
        id: (tc as { id?: string }).id ?? crypto.randomUUID(),
        name: (tc as { function?: { name?: string } }).function?.name ?? "",
        arguments: (tc as { function?: { arguments?: Record<string, unknown> } }).function?.arguments ?? {},
      })) ?? [],
    };
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!res.ok) {
      throw new Error(`Ollama embed error: ${res.status}`);
    }

    const data = await res.json();
    return data.embedding ?? [];
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(baseUrl: string, model: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.apiKey = apiKey;
  }

  async complete(request: ChatCompletionRequest): Promise<{ content: string; tool_calls?: ToolCall[] }> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        tools: request.tools,
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0] ?? {};
    const msg = choice.message ?? {};
    const rawToolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    return {
      content: msg.content ?? "",
      tool_calls: rawToolCalls.map((tc: { id?: string; function?: { name?: string; arguments?: unknown } }) => ({
        id: tc.id ?? crypto.randomUUID(),
        name: tc.function?.name ?? "",
        arguments:
          typeof tc.function?.arguments === "string"
            ? JSON.parse(tc.function.arguments as string)
            : (tc.function?.arguments ?? {}),
      })) as ToolCall[],
    };
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });

    if (!res.ok) {
      throw new Error(`Embed error: ${res.status}`);
    }

    const data = await res.json();
    return data.data?.[0]?.embedding ?? [];
  }
}

export function createProvider(
  provider: string,
  baseUrl: string,
  model: string,
  apiKey: string,
): LLMProvider {
  logger.info(`Initializing LLM provider: ${provider} (${model})`);
  switch (provider) {
    case "ollama":
      return new OllamaProvider(baseUrl, model);
    case "openai":
    case "openai-compatible":
      return new OpenAICompatibleProvider(baseUrl, model, apiKey);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
