#!/usr/bin/env node
import { createGGUFManager } from "./manager.js";

async function main() {
  const gguf = createGGUFManager("./models/gguf", "daemond", "http://localhost:3334");

  const status = await gguf.isAvailable();
  console.log("GGUF dir available:", status);

  const datasets = await gguf.listDatasets();
  console.log("Datasets:", JSON.stringify(datasets, null, 2));

  const models = gguf.listModels();
  console.log("Installed models:", models.length);
  for (const m of models) {
    console.log(`  - ${m.name} (${m.quant_type}) ${m.path}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
