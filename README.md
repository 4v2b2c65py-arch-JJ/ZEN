# JJ-Model

Personal LLM over recall/node memory with full macOS environment integration, cross-device sync, WebSocket API, and autonomous agent capabilities.

## Live Demo

Frontend: https://jj-model.vercel.app (Vercel)

Backend (WebSocket API): runs locally on `ws://localhost:3333` — deploy separately (VPS / Render / Railway) for remote access.

## Quick Start

```bash
# Clone
git clone https://github.com/4v2b2c65py-arch-JJ/ZEN.git jj-model
cd jj-model

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your LLM provider settings

# Typecheck & build
npm run typecheck
npm run build

# Run
npm start          # production (dist/)
npm run dev        # watch mode (tsx)

# Full autonomous stack
./scripts/start-fullstack.sh
```

## Ports

| Service | Port |
|---------|------|
| Main API / WebSocket | 3333 |
| Cross-Comm P2P | 4445 |
| Model Proxy | 3334 |

## Architecture

- `src/index.ts` — Full-stack supervisor (all services)
- `src/api/server.ts` — WebSocket API on :3333
- `src/memory/vector-memory.ts` — SQLite vector recall memory
- `src/llm/provider.ts` — LLM abstraction (Ollama / OpenAI-compatible)
- `src/mac/integration.ts` — macOS automation (notify, say, clipboard, apps)
- `src/broadspectrum/orchestrator.ts` — Unified tool orchestrator (MCP-exposed)
- `src/dataset/pool.ts` — Dataset pool + pass handoffs + device specifics
- `src/proxy/` — Model proxy on :3334

## Security

See [`SECURITY.md`](SECURITY.md) for vulnerability reporting and authority roles.

- No secrets in git — `.env` is gitignored; use `.env.example`
- All log output is structured NDJSON (`logs/jj-model.log`)
- `CODEOWNERS` enforces maintainer/reviewer approval on `main`

## Installers

See [`docs/install-paths.md`](docs/install-paths.md) for macOS `.pkg`, iOS `.ipa`, Android `.apk`, and Windows `.msi` install paths and build requirements.

## License

[MIT](LICENSE)
