import { createInterface } from "readline";
import { VectorMemory } from "../memory/vector-memory.js";
import { MacIntegration } from "../mac/integration.js";
import { createProvider, LLMProvider, Message } from "../llm/provider.js";
import { TranscriptionPipeline } from "../transcription/pipeline.js";
import { createTranscriber } from "../transcription/transcriber.js";
import { config } from "../config/config.js";
import { logger } from "../utils/logger.js";

async function main() {
  const memory = new VectorMemory(config.memoryDbPath);
  const mac = new MacIntegration(config.macAutomationEnabled);
  const llm = createProvider(config.llmProvider, config.llmBaseUrl, config.llmModel, config.llmApiKey);

  const transcriber = createTranscriber({
    provider: config.transcriptionProvider as any,
    model: config.whisperModel,
    apiKey: config.whisperApiKey,
    baseUrl: config.whisperBaseUrl,
    whisperBinary: config.whisperBinary,
    language: config.whisperLanguage,
  });
  const transcription = new TranscriptionPipeline(memory, transcriber);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "jj> ",
  });

  logger.info("jj-model started. Type your message (or :help).");
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    if (input === ":help") {
      console.log("Commands: :help, :memory <query>, :list, :mac <action> <args>, :transcribe <audio-path>, :quit");
      rl.prompt();
      return;
    }
    if (input === ":quit" || input === ":exit") {
      await memory.close();
      rl.close();
      process.exit(0);
    }
    if (input.startsWith(":memory ")) {
      const results = await memory.search(input.slice(":memory ".length));
      console.log(JSON.stringify(results, null, 2));
      rl.prompt();
      return;
    }
    if (input === ":list") {
      const results = await memory.list();
      console.log(JSON.stringify(results, null, 2));
      rl.prompt();
      return;
    }
    if (input.startsWith(":mac ")) {
      const [, action, ...rest] = input.split(" ");
      const result = await mac.applescript(rest.join(" "));
      console.log(JSON.stringify(result, null, 2));
      rl.prompt();
      return;
    }
    if (input.startsWith(":transcribe ")) {
      const audioPath = input.slice(":transcribe ".length).trim();
      try {
        const available = await transcriber.isAvailable();
        if (!available) {
          console.log("Transcriber not available. Check TRANSCRIPTION_PROVIDER and dependencies.");
          rl.prompt();
          return;
        }
        const result = await transcription.transcribeFile(audioPath);
        console.log(`\n--- Transcription (memory id: ${result.memoryId}) ---`);
        console.log(result.text);
        if (result.language) console.log(`\nLanguage: ${result.language}`);
      } catch (err) {
        logger.error(`Transcription failed: ${err}`);
      }
      rl.prompt();
      return;
    }

    const recall = await memory.search(input, config.memoryTopK);
    const completion = await llm.complete({
      messages: [
        { role: "system", content: "You are a personal assistant with recall memory on macOS." },
        ...recall.map((m): Message => ({ role: "user", content: `[RECALL] ${m.content}` })),
        { role: "user", content: input },
      ],
    });
    console.log(completion.content);
    await memory.add({ content: input, metadata: {}, source: "user" });
    await memory.add({ content: completion.content, metadata: {}, source: "assistant" });
    rl.prompt();
  });

  rl.on("close", async () => {
    await memory.close();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error(`Fatal: ${err}`);
  process.exit(1);
});
