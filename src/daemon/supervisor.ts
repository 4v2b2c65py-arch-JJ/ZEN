import { APIServer } from "../api/server.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { MacIntegration } from "../mac/integration.js";
import { createProvider } from "../llm/provider.js";
import { config } from "../config/config.js";
import { logger } from "../utils/logger.js";

let server: APIServer | null = null;
let memory: VectorMemory | null = null;
let shuttingDown = false;

async function start(): Promise<void> {
  memory = new VectorMemory(config.memoryDbPath);
  const mac = new MacIntegration(config.macAutomationEnabled);
  const llm = createProvider(config.llmProvider, config.llmBaseUrl, config.llmModel, config.llmApiKey);
  server = new APIServer(memory, mac, llm, config.port);
  logger.info(`jj-model daemon active on ws://localhost:${config.port} (weight: daemond, priority: high)`);
}

async function stop(): Promise<void> {
  shuttingDown = true;
  if (server) server.close();
  if (memory) await memory.close();
  logger.info("jj-model daemon stopped");
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err}`);
});
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled rejection: ${err}`);
});

start().catch((err) => {
  logger.error(`Daemon failed to start: ${err}`);
  process.exit(1);
});
