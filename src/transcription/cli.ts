import { TranscriptionPipeline } from "./pipeline.js";
import { createTranscriber } from "./transcriber.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { config } from "../config/config.js";
import { logger } from "../utils/logger.js";

async function main() {
  const memory = new VectorMemory(config.memoryDbPath);

  const transcriberConfig = {
    provider: (process.env.TRANSCRIPTION_PROVIDER as any) ?? "whisper-local",
    model: process.env.WHISPER_MODEL,
    apiKey: process.env.WHISPER_API_KEY,
    baseUrl: process.env.WHISPER_BASE_URL,
    whisperBinary: process.env.WHISPER_BINARY,
    language: process.env.WHISPER_LANGUAGE,
  };

  const transcriber = createTranscriber(transcriberConfig);
  const pipeline = new TranscriptionPipeline(memory, transcriber);

  const audioPath = process.argv[2];
  if (!audioPath) {
    console.log("Usage: npx tsx src/transcription/cli.ts <audio-file-path>");
    process.exit(1);
  }

  try {
    const result = await pipeline.transcribeFile(audioPath);
    console.log(`\n--- Transcription (memory id: ${result.memoryId}) ---`);
    console.log(result.text);
    if (result.language) console.log(`\nLanguage: ${result.language}`);
  } catch (err) {
    logger.error(`Transcription failed: ${err}`);
    process.exit(1);
  } finally {
    await memory.close();
  }
}

main();
