import { AutoWorkEngine, createAutoWorkEngine, intervalCondition } from "./engine.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { CrossComm } from "../crosscomm/index.js";
import { config } from "../config/config.js";
import { logger } from "../utils/logger.js";

async function main() {
  const memory = new VectorMemory(config.memoryDbPath);
  const cross = new CrossComm(memory, 4445, "daemond");

  const engine = createAutoWorkEngine(memory, cross, {
    enabled: true,
    weightClass: "daemond",
    checkIntervalMs: 5000,
    maxConcurrent: 5,
    conditions: [
      intervalCondition(30000, async () => {
        const count = await memory.count();
        logger.info(`Auto-work tick: memory count = ${count}, peers = ${cross.getPeerCount()}`);
        cross.broadcast({ type: "status", from: "server", to: "*", payload: { memoryCount: count, peerCount: cross.getPeerCount() }, timestamp: Date.now(), weightClass: "daemond" });
      }),
    ],
  });

  await engine.start();

  process.on("SIGINT", async () => {
    await engine.stop();
    cross.close();
    await memory.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await engine.stop();
    cross.close();
    await memory.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
