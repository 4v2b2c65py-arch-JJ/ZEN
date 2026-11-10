# jj-model Full Autonomous Stack — MCP + Directory Autonomy + Cross-Device + Media

## Services

| Service | Port | Weight Class | Description |
|---------|------|--------------|-------------|
| Main API (WebSocket) | 3333 | daemond | LLM chat + recall memory + macOS tools |
| Cross-comm (P2P) | 4445 | daemond | Cross-to-device memory sync & data transfer |
| Auto-work engine | — | daemond | 5s auto-work conditions, broadcasts status |
| MCP (stdio) | — | daemond | Model Context Protocol tool server |

## MCP Tools

| Tool | Description |
|------|-------------|
| `jj_memory_store` | Store memory entry in vector recall |
| `jj_memory_recall` | Semantic memory search |
| `jj_memory_list` | List recent memories |
| `jj_mac_notify` | macOS notification |
| `jj_mac_say` | Speak text (say) |
| `jj_mac_open_app` | Open macOS app |
| `jj_mac_applescript` | Run arbitrary AppleScript |
| `jj_cross_send` | Send data to cross-device peer |
| `jj_cross_peers` | List connected peers |
| `jj_idevice_list` | List connected Apple iOS devices |
| `jj_network_routes` | List kernel network routes |
| `jj_autonomous_dir` | Read/write/list/watch directory autonomously |

## Autonomous Directory

Watches `./data` and `./src` for file add/change events, stores them in memory, and auto-organizes by file extension.

## Cross-Device Awareness

Discovers Apple iOS devices via `libimobiledevice` (usbmuxd), syncs device data to memory every 30s, broadcasts to cross-device peers.

## Media (Screen Share + Camera)

- **Screen share**: `ffmpeg` avfoundation capture (`screencapture` fallback)
- **Camera**: `ffmpeg` avfoundation camera capture (`imagesnap` fallback)
- Frames broadcast to cross-device peers via `data_transfer`

## Requirements

```bash
brew install ffmpeg libimobiledevice imagesnap
```

## Run

```bash
./scripts/start-fullstack.sh
# or MCP stdio server:
npx tsx src/mcp/server.ts
```

To stop: `./scripts/stop-fullstack.sh`
