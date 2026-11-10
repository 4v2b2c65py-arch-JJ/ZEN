# JCloud — Onboarding & Easy Learn Curve

## 5-Minute Quick Start

### 1. Start the backend
```bash
cd /Users/jjmarte/Desktop/JJ-model
npm run build
./scripts/start-fullstack.sh
```

Services start on:
- Main API: `ws://localhost:3333`
- Model Proxy: `ws://localhost:3334`
- Cross-Comm P2P: `ws://localhost:4445`

### 2. Open the frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 3. Sign in
Any username/password works (demo mode). You're in.

### 4. Chat
Type a message. JCloud remembers everything via recall memory. Try:
- "Remember I like dark mode"
- "What are my recent memories?"
- "Search the web for AI news"

### 5. Add your device
Via MCP or BroadSpectrum tools:
```ts
await pool.dropInDeviceSpecifics("my-iphone", {
  model: "iPhone 15 Pro",
  capabilities: ["lidar", "camera", "shortcuts"],
});
```

## Core Concepts (Easy Path)

| Concept | What it does | First command |
|---------|--------------|---------------|
| **Recall Memory** | Stores everything you say | Just chat |
| **Dataset Pool** | Holds device specs + notes | `dataset_drop_device` |
| **Handoffs** | Pass data between components | `dataset_handoff` |
| **KeyBind** | Cmd+Alt+T/R/N hotkeys | Just press them |
| **Mac Control** | Notify, say, open apps | "Open Slack" |
| **iDevice** | iPhone/iPad control | "Run shortcut" |

## Weight Class

All services run at weight class `daemond` (high priority, keep-alive). The server stays alive for your IDEvice and cross-device connections.

## Stop
```bash
./scripts/stop-fullstack.sh
```
