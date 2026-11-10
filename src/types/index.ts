export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: "none" | "auto" | "required";
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  source: "user" | "assistant" | "system" | "mac";
}

export interface MacCapability {
  name: string;
  description: string;
  enabled: boolean;
  permissions: string[];
}

export interface AppConfig {
  llmProvider: string;
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  memoryDbPath: string;
  memoryEmbeddingModel: string;
  memoryTopK: number;
  macAutomationEnabled: boolean;
  port: number;
  transcriptionProvider: string;
  whisperModel?: string;
  whisperApiKey?: string;
  whisperBaseUrl: string;
  whisperBinary?: string;
  whisperLanguage?: string;
}
