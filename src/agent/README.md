# Agent Roles & Spawn Control

Defines agent roles and manages spawning/controlling agent instances across the jj-model codebase.

## Agent Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| `coder` | Writes, edits, refactors code | code_write, code_edit, code_refactor, build, typecheck |
| `researcher` | Searches codebase/docs/web | code_search, web_search, doc_read, summarize |
| `memory-keeper` | Manages recall memory | memory_store, memory_recall, memory_list, organize, prune |
| `mac-controller` | Controls macOS | mac_notify, mac_say, mac_open_app, applescript, clipboard |
| `cross-device` | iOS device connections | idevice_list, shortcut, notify, cross_broadcast, sync |
| `peripheral` | Screen/camera/LiDAR/traces | peripheral_screen, camera, lidar, trace |
| `shell` | CLI/zshell/bash commands | shell_execute, zsh, bash, pipe, history |
| `orchestrator` | Coordinates other agents | agent_spawn, agent_stop, task_assign, workflow |

## Spawn Control

Managent agent lifecycle: spawn, stop, list, assign tasks, auto-spawn-and-assign.

## Usage

```ts
const registry = createAgentRoleRegistry("daemond");
const spawn = createSpawnControl(registry, {
  max_agents: 10,
  max_per_role: { coder: 2, researcher: 3 },
  weight_class: "daemond",
  auto_spawn: true,
  spawn_cooldown_ms: 500,
});

// Spawn a coder
const coder = await spawn.spawn("coder", "Lead Coder", 8);

// Auto-spawn and assign a task
const { agent, task } = await spawn.autoSpawnAndAssign("coder", "Refactor memory module", { file: "src/memory/vector-memory.ts" });

// List agents
for (const a of spawn.list()) {
  console.log(`${a.name} (${a.status}) - ${a.task_count} tasks`);
}

// Stats
console.log(spawn.getStats());
```

## MCP Tools (via BroadSpectrum)

- `agent_roles_list` — list all roles
- `agent_spawn` — spawn an agent
- `agent_stop` — stop an agent
- `agent_list` — list all instances
- `agent_assign_task` — assign a task
- `agent_auto_spawn_assign` — auto-spawn + assign
- `agent_stats` — spawn control stats

Weight class: `daemond` (high priority, keep-alive)
