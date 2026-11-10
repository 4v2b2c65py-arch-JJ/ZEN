# Tool Registry — Autonomous Tool Automation

Registers and executes tools with weighted priority. Built-in tools include macOS AppleScript, shell execution, and all BroadSpectrum tools.

## Register a Tool

```ts
registry.register({
  name: "my_tool",
  description: "Does something",
  parameters: { type: "object", properties: {}, required: [] },
  handler: async (args) => { return { ok: true }; },
  weight_class: "daemond",
});

const result = await registry.execute("my_tool", {});
```

## Built-in Tools (via BroadSpectrum)

- `metabrain_scan`, `metabrain_pac`
- `idevice_run_shortcut`, `idevice_list_shortcuts`, `idevice_notify`, `idevice_screenshot`, `idevice_battery`
- `broadcast_cross`, `memory_store`, `memory_recall`

## Execution History

Every tool execution is recorded with duration, success/failure, and timestamp.
