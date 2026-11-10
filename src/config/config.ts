import dotenv from "dotenv";
import type { AppConfig } from "../types/index.js";

dotenv.config();

export const config: AppConfig = {
  llmProvider: process.env.LLM_PROVIDER ?? "ollama",
  llmBaseUrl: process.env.LLM_BASE_URL ?? "http://localhost:11434",
  llmModel: process.env.LLM_MODEL ?? "llama3.1",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  memoryDbPath: process.env.MEMORY_DB_PATH ?? "./data/recall.db",
  memoryEmbeddingModel: process.env.MEMORY_EMBEDDING_MODEL ?? "nomic-embed-text",
  memoryTopK: Number(process.env.MEMORY_TOP_K ?? "5"),
  macAutomationEnabled: process.env.MAC_AUTOMATION_ENABLED !== "false",
  port: Number(process.env.PORT ?? "3333"),
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER ?? "whisper-local",
  whisperModel: process.env.WHISPER_MODEL ?? undefined,
  whisperApiKey: process.env.WHISPER_API_KEY ?? undefined,
  whisperBaseUrl: process.env.WHISPER_BASE_URL ?? "https://api.openai.com/v1",
  whisperBinary: process.env.WHISPER_BINARY ?? "whisper",
  whisperLanguage: process.env.WHISPER_LANGUAGE ?? undefined,
};

export function loadConfig(): AppConfig {
  return config;
}
