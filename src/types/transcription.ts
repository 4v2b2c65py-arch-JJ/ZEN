export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriberConfig {
  provider: "whisper-api" | "whisper-local" | "mac-dictation";
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  whisperBinary?: string;
  language?: string;
}

export interface Transcriber {
  transcribe(audioPath: string): Promise<TranscriptionResult>;
  isAvailable(): Promise<boolean>;
}
