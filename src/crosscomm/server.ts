import { VectorMemory } from "../memory/vector-memory.js";
import { CrossComm, createCrossComm } from "./index.js";
import { config } from "../config/config.js";

async function main() {
  const memory = new VectorMemory(config.memoryDbPath);
  const cross = createCrossComm(memory, 4445);

  process.on("SIGINT", async () => {
    cross.close();
    await memory.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    cross.close();
    await memory.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
