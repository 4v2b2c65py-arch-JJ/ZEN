import { logger } from "../utils/logger.js";
import { execFile } from "child_process";
import { promisify } from "util";
import type { Transcriber, TranscriberConfig, TranscriptionResult } from "../types/transcription.js";

const execFileAsync = promisify(execFile);

export class WhisperAPITranscriber implements Transcriber {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private language?: string;

  constructor(config: TranscriberConfig) {
    this.apiKey = config.apiKey ?? "";
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    this.model = config.model ?? "whisper-1";
    this.language = config.language;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    const FormData = (await import("form-data")).default;
    const fs = await import("fs");
    const form = new FormData();
    form.append("file", fs.createReadStream(audioPath));
    form.append("model", this.model);
    if (this.language) form.append("language", this.language);

    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...form.getHeaders(),
      },
      body: form as unknown as BodyInit,
    });

    if (!res.ok) {
      throw new Error(`Whisper API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return { text: data.text, language: data.language };
  }
}

export class WhisperLocalTranscriber implements Transcriber {
  private binary: string;
  private model?: string;
  private language?: string;

  constructor(config: TranscriberConfig) {
    this.binary = config.whisperBinary ?? "whisper";
    this.model = config.model;
    this.language = config.language;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.binary, ["--help"], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    const args: string[] = [audioPath, "--output_format", "json"];
    if (this.model) args.push("--model", this.model);
    if (this.language) args.push("--language", this.language);

    const { stdout } = await execFileAsync(this.binary, args, { timeout: 300000 });
    const lines = stdout.trim().split("\n").filter(Boolean);
    const jsonLines = lines.filter((l) => l.startsWith("{"));
    let text = "";
    let language: string | undefined;

    for (const line of jsonLines) {
      try {
        const obj = JSON.parse(line);
        if (obj.text) text += (text ? " " : "") + obj.text;
        if (obj.language && !language) language = obj.language;
      } catch {
        // ignore non-json lines
      }
    }

    return { text, language };
  }
}

export class MacDictationTranscriber implements Transcriber {
  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync("say", ["--version"], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    throw new Error("mac-dictation provider requires real-time audio input, not file transcription. Use whisper-api or whisper-local for files.");
  }
}

export function createTranscriber(config: TranscriberConfig): Transcriber {
  logger.info(`Initializing transcriber: ${config.provider}`);
  switch (config.provider) {
    case "whisper-api":
      return new WhisperAPITranscriber(config);
    case "whisper-local":
      return new WhisperLocalTranscriber(config);
    case "mac-dictation":
      return new MacDictationTranscriber();
    default:
      throw new Error(`Unknown transcriber provider: ${config.provider}`);
  }
}
