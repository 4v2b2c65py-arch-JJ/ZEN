#!/usr/bin/env node
import { createMCPClient } from "./client.js";

async function main() {
  const client = createMCPClient("daemond");

  // Configure example servers
  client.addServer({
    name: "filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/jjmarte/Desktop/JJ-model"],
    enabled: true,
    weight_class: "daemond",
  });

  const health = client.getHealth();
  console.log("MCP client health:", JSON.stringify(health, null, 2));

  try {
    await client.connect("filesystem");
    const tools = await client.listTools("filesystem");
    console.log("Tools:", tools.length);
    for (const t of tools) {
      console.log(`  - ${t.name}: ${t.description}`);
    }
  } catch (err) {
    console.log("Connect note:", err instanceof Error ? err.message : String(err));
  }

  const all = await client.listAllTools();
  console.log("All tools:", all.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
