import { VectorMemory } from "../memory/vector-memory.js";
import { Transcriber, TranscriptionResult } from "../types/transcription.js";
import { logger } from "../utils/logger.js";

export class TranscriptionPipeline {
  private memory: VectorMemory;
  private transcriber: Transcriber;

  constructor(memory: VectorMemory, transcriber: Transcriber) {
    this.memory = memory;
    this.transcriber = transcriber;
  }

  async transcribeFile(audioPath: string, source: "user" | "system" = "user"): Promise<TranscriptionResult & { memoryId: string }> {
    const available = await this.transcriber.isAvailable();
    if (!available) {
      throw new Error("Transcriber not available. Check provider config and dependencies.");
    }

    logger.info(`Transcribing ${audioPath}`);
    const result = await this.transcriber.transcribe(audioPath);

    const memoryId = await this.memory.add({
      content: result.text,
      metadata: {
        source: "transcription",
        audio_path: audioPath,
        language: result.language,
        duration: result.duration,
        transcribed_at: Date.now(),
      },
      source,
    });

    logger.info(`Transcription stored as memory ${memoryId}`);
    return { ...result, memoryId };
  }

  async transcribeAndRemember(audioPath: string): Promise<string> {
    const result = await this.transcribeFile(audioPath);
    return result.text;
  }
}
