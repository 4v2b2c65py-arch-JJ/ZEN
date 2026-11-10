#!/usr/bin/env node
import { createAgentRoleRegistry } from "./roles.js";
import { createSpawnControl } from "./spawn-control.js";

async function main() {
  const registry = createAgentRoleRegistry("daemond");
  const spawn = createSpawnControl(registry, {
    max_agents: 10,
    max_per_role: { coder: 2, researcher: 3, "memory-keeper": 2 },
    weight_class: "daemond",
    auto_spawn: true,
    spawn_cooldown_ms: 500,
  });

  console.log("=== Agent Roles ===");
  for (const role of registry.list()) {
    console.log(`  ${role.name} (${role.id}): ${role.description}`);
    console.log(`    capabilities: ${role.capabilities.join(", ")}`);
    console.log(`    max_concurrent: ${role.max_concurrent}, priority: ${role.priority}`);
  }

  console.log("\n=== Spawning Agents ===");
  const coder = await spawn.spawn("coder", "Lead Coder", 8);
  console.log(`Spawned: ${coder.name} (${coder.status})`);

  const researcher = await spawn.spawn("researcher", "Web Researcher", 6);
  console.log(`Spawned: ${researcher.name} (${researcher.status})`);

  // Wait for spawns to complete
  await new Promise((r) => setTimeout(r, 800));

  console.log("\n=== Auto-Spawn + Assign ===");
  const { agent, task } = await spawn.autoSpawnAndAssign(
    "coder",
    "Add keybind thought binding to MCP tools",
    { file: "src/keybind/manager.ts", action: "add_tool" },
  );
  console.log(`Agent: ${agent.name}, Task: ${task.description} (${task.status})`);

  await new Promise((r) => setTimeout(r, 1200));

  console.log("\n=== Agent List ===");
  for (const a of spawn.list()) {
    console.log(`  ${a.name} [${a.role_id}]: ${a.status} (${a.task_count} tasks)`);
  }

  console.log("\n=== Stats ===");
  console.log(JSON.stringify(spawn.getStats(), null, 2));

  spawn.stopAll();
  console.log("\nAll agents stopped.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
