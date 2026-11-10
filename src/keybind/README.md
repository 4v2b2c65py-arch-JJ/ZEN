# Key Bind Thought Binding — Keyboard-Triggered Thoughts & Actions

Bind macOS global hotkeys to trigger thoughts, memory operations, macOS actions, and cross-device commands.

## How It Works

1. Register a key binding (modifiers + key → action)
2. Optionally bind a "thought" string to that key binding
3. When the hotkey fires, the action executes and the event is stored in memory + broadcast to cross-device peers

## Actions

| Action | Description |
|--------|-------------|
| `thought` | Store a thought string in memory + broadcast |
| `memory_store` | Store content to vector memory |
| `memory_recall` | Search recall memory |
| `mac_action` | Run AppleScript (notify, say, etc.) |
| `cross_send` | Broadcast command to cross-device peers |
| `command` | Execute a named command |

## Default Bindings

| Hotkey | Action | Description |
|--------|--------|-------------|
| Cmd+Alt+T | thought | Store a quick thought |
| Cmd+Alt+R | memory_recall | Recall recent memories |
| Cmd+Alt+N | mac_action | Show notification |

## Usage

```ts
const keybind = createKeyBindManager(cross, memory, mac, "daemond");

const id = keybind.addBinding({
  key: "t",
  modifiers: ["cmd", "alt"],
  action: "thought",
  payload: { thought: "My captured thought" },
  description: "Capture thought",
  weight_class: "daemond",
  enabled: true,
});

keybind.addThoughtBinding("Captured thought", id, "global");

// Trigger programmatically
await keybind.trigger(id);
```

## Global Hotkey Listener

For system-wide hotkey listening (requires Accessibility permissions):

```ts
const listener = createGlobalHotkeyListener({
  key: "t",
  modifiers: ["cmd", "alt"],
  target_url: "ws://localhost:3334",
  weight_class: "daemond",
});
await listener.start();
```

## MCP Tools (via BroadSpectrum)

- `keybind_add` — register a key binding
- `keybind_trigger` — trigger a binding
- `keybind_list` — list all bindings
- `keybind_stats` — get binding statistics

Weight class: `daemond` (high priority, keep-alive)
