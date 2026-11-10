import { ModelProxy } from "./index.js";
import { ProxyServer } from "./server.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/config.js";

async function main() {
  const proxy = new ModelProxy("daemond", 300000);

  // Default rules from config
  proxy.addRule({
    match: "llama",
    provider: "ollama",
    base_url: config.llmBaseUrl,
    weight_class: "daemond",
    enabled: true,
  });
  proxy.addRule({
    match: "gpt",
    provider: "openai-compatible",
    base_url: config.llmBaseUrl,
    api_key: config.llmApiKey,
    weight_class: "daemond",
    enabled: true,
  });

  const server = new ProxyServer(proxy, 3334);

  process.on("SIGINT", async () => {
    server.close();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error(`Proxy server failed: ${err}`);
  process.exit(1);
});
