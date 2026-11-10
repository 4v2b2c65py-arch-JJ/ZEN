# Cross-Comm — Cross-to-Cross Communications

WebSocket-based peer-to-peer communication server for jj-model instances across devices (macOS, iOS, other jj-model nodes).

## Port

- Cross-comm WS: `ws://0.0.0.0:4445`
- Weight class: `daemond` (high priority, auto-restart)

## Message Types

| Type | Description |
|------|-------------|
| `ping` / `pong` | Keepalive heartbeat |
| `memory_sync` | Sync recall memory between peers |
| `data_transfer` | Push/pull memory entries across devices |
| `command` | Remote command execution |
| `status` | Peer and memory status |

## Usage

```bash
# Start cross-comm server
npx tsx src/crosscomm/server.ts

# Connect from another jj-model instance
ws.connect("ws://<host>:4445")
```

## Data Transfer

Push a memory to a peer:
```json
{ "type": "data_transfer", "action": "push", "content": "hello", "metadata": {} }
```

Pull a memory from a peer:
```json
{ "type": "data_transfer", "action": "pull", "id": "<uuid>" }
```
