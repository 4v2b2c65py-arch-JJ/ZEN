# BroadSpectrum Orchestrator — Broad Spectrum Capabilities

Orchestrates the full spectrum of jj-model capabilities: memory, macOS automation, cross-device communication, metabrain scans, tool execution, iDevice automation, and media.

## Capabilities

| Capability | Enabled |
|------------|---------|
| Memory (store/recall) | yes |
| macOS automation | configurable |
| Cross-device P2P | yes |
| Media (screen/camera) | optional |
| MetaBrain scans | yes |
| Tool registry | yes |
| iDevice automation | yes |
| Autonomous directory | yes |

## Registered Tools

- `metabrain_scan` — brain data scan
- `metabrain_pac` — create metas PAC
- `idevice_run_shortcut` — run iOS shortcut
- `idevice_list_shortcuts` — list iOS shortcuts
- `idevice_notify` — notify iOS device
- `idevice_screenshot` — screenshot iOS device
- `idevice_battery` — get battery
- `broadcast_cross` — cross-device broadcast
- `memory_store` / `memory_recall` — memory operations

## Usage

```ts
const spectrum = createBroadSpectrumOrchestrator(memory, cross, idevice, "daemond");
const caps = await spectrum.getCapabilities();
const result = await spectrum.executeTool("idevice_battery", { udid: "..." });
const pac = await spectrum.createMetasPac("Brain Scan", "insights", [scanId]);
```
