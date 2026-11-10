#!/usr/bin/env node
import { KeyBindManager } from "./manager.js";
import { GlobalHotkeyListener } from "./hotkey-listener.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { MacIntegration } from "../mac/integration.js";
import { CrossComm } from "../crosscomm/index.js";
import { config } from "../config/config.js";
import { logger } from "../utils/logger.js";

async function main() {
  const memory = new VectorMemory(config.memoryDbPath);
  const mac = new MacIntegration(config.macAutomationEnabled);
  const cross = new CrossComm(memory, 4445, "daemond");

  const keybind = new KeyBindManager(cross, memory, mac, "daemond");

  // Bind Cmd+Alt+T to store a thought
  const bindId = keybind.addBinding({
    key: "t",
    modifiers: ["cmd", "alt"],
    action: "thought",
    payload: { thought: "Captured via hotkey Cmd+Alt+T" },
    description: "Store a quick thought to memory",
    weight_class: "daemond",
    enabled: true,
  });

  keybind.addThoughtBinding("Quick note from hotkey", bindId, "global");

  // Bind Cmd+Alt+R to recall memory
  keybind.addBinding({
    key: "r",
    modifiers: ["cmd", "alt"],
    action: "memory_recall",
    payload: { query: "recent" },
    description: "Recall recent memories",
    weight_class: "daemond",
    enabled: true,
  });

  // Bind Cmd+Alt+N to macOS notification
  keybind.addBinding({
    key: "n",
    modifiers: ["cmd", "alt"],
    action: "mac_action",
    payload: { script: 'display notification "jj-model hotkey" with title "Keybind"' },
    description: "Show macOS notification",
    weight_class: "daemond",
    enabled: true,
  });

  console.log("Key bindings:");
  for (const b of keybind.listBindings()) {
    console.log(`  ${b.modifiers.join("+")}+${b.key} -> ${b.action} (${b.description})`);
  }

  // Simulate a trigger for demo
  // await keybind.trigger(bindId);

  const stats = keybind.getStats();
  console.log("Stats:", JSON.stringify(stats, null, 2));

  process.on("SIGINT", async () => {
    await keybind.stopGlobalHotkeyListener();
    await memory.close();
    cross.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
