# Peripheral Data — Screen, LiDAR, Camera, Advanced Tracing

Captures peripheral datasets (on-screen, surroundings LiDAR/depth, camera) and advanced execution traces, storing them in recall memory and broadcasting to cross-device peers.

## Capture Sources

| Source | Description | Tool |
|--------|-------------|------|
| `screen` | On-screen display capture | `screencapture` |
| `lidar` | Surroundings depth/point cloud | iPhone LiDAR via `ideviceinfo` |
| `camera` | Camera frame | `imagesnap` / `ffmpeg` avfoundation |
| `trace` | Advanced execution tracing | span-based timing |

## Usage

```ts
const peripheral = createPeripheralManager(memory, cross, "daemond");

// Single captures
const screen = await peripheral.captureScreen("1");
const lidar = await peripheral.captureLidar();
const camera = await peripheral.captureCamera();

// Trace a block of code
const span = await peripheral.startTrace("llm_inference", { model: "llama3.1" });
// ... do work ...
await peripheral.endTrace(span.id);

// Capture everything at once
const capture = await peripheral.captureAll();

// Periodic capture
await peripheral.startPeriodicCapture(5000); // every 5s
```

## MCP Tools (via BroadSpectrum)

- `peripheral_capture_screen` — capture screen
- `peripheral_capture_lidar` — capture LiDAR surroundings
- `peripheral_capture_camera` — capture camera
- `peripheral_capture_all` — capture all sources
- `peripheral_start_trace` / `peripheral_end_trace` — trace spans
- `peripheral_stats` — capture statistics

## CLI

```bash
# Not yet exposed as standalone; use MCP or BroadSpectrum tools
```

Weight class: `daemond` (high priority, keep-alive)

## Requirements

- `screencapture` (built-in macOS)
- `imagesnap` or `ffmpeg` (`brew install imagesnap ffmpeg`)
- iPhone with LiDAR connected via USB for `lidar` source
