import { ICloudExpansion } from "./expansion.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { config } from "../config/config.js";
import { logger } from "../utils/logger.js";

async function main() {
  const memory = new VectorMemory(config.memoryDbPath);
  const icloud = new ICloudExpansion(memory, "daemond");

  const status = await icloud.isAvailable();
  console.log("iCloud available:", status.available);
  console.log("iCloud path:", status.path);

  if (!status.available) {
    console.log("iCloud Drive not found. Sign in to iCloud on this Mac.");
    process.exit(0);
  }

  // Generate an expansion package from current model parameters
  const pkg = await icloud.generateExpansionPackageFromModel(
    "My Personal Model",
    "Personalized LLM configuration",
    config.llmModel,
    {
      provider: config.llmProvider,
      base_url: config.llmBaseUrl,
      temperature: 0.7,
      max_tokens: 500,
      system_prompt: "You are a personal assistant with recall memory.",
      tools_enabled: true,
      weight_class: "daemond",
    },
  );
  console.log("Generated expansion package:", JSON.stringify(pkg, null, 2));

  // List all packages
  const packages = await icloud.listExpansionPackages();
  console.log("Installed packages:", packages.length);
  for (const p of packages) {
    console.log(`  - ${p.name} v${p.version} (${p.parameters.model})`);
  }

  await icloud.startSync(60000);
  process.on("SIGINT", async () => {
    await icloud.stopSync();
    await memory.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
