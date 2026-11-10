# Dataset Pool — Pass Handoffs & Device Specifics

Easy onboarding dataset system. Drop in device specifics and pass datasets between components to build up your data pool.

## Concepts

- **DatasetEntry** — A piece of data (text, JSON, CSV, device spec, handoff) with source, tags, and metadata
- **DatasetHandoff** — Pass a dataset from one component to another (ingest, merge, replace, query)
- **DeviceSpec** — Device-specific configuration (iPhone, iPad, Mac, etc.) dropped into the pool

## Usage

```ts
const pool = createDatasetPool(memory, "daemond");

// Ingest a text dataset
const id = await pool.ingest({
  source: "user_notes",
  type: "text",
  content: "I prefer dark mode and use Ollama with llama3.1",
  metadata: { category: "preference" },
  tags: ["preference", "ui"],
});

// Drop in device specifics (easy learn curve - just pass device info)
await pool.dropInDeviceSpecifics("iPhone-1234", {
  model: "iPhone 15 Pro",
  os_version: "iOS 17.4",
  capabilities: ["lidar", "camera", "shortcuts", "apple_pencil"],
  screen_size: "6.1 inch",
});

// Create a handoff between components
await pool.createHandoff("mac-controller", "memory-keeper", id, "ingest");

// Query the pool
const results = await pool.query("dark mode preference", 5);
```

## MCP Tools (via BroadSpectrum)

- `dataset_ingest` — ingest a dataset entry
- `dataset_drop_device` — drop in device specifics
- `dataset_handoff` — pass dataset between components
- `dataset_query` — search the data pool
- `dataset_stats` — pool statistics

## Easy Learn Curve

1. Start with `dataset_drop_in_device_specifics()` to add your device
2. Use `dataset_ingest()` to add notes/preferences
3. Use `dataset_query()` to recall anything
4. Everything auto-stores in recall memory

Weight class: `daemond`
