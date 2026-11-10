# Model Proxy — LLM Request Routing & Caching Layer

Sits between clients and LLM providers (Ollama, OpenAI-compatible) to route, cache, log, and transform model requests.

## Port

- Model Proxy WS: `ws://localhost:3334`
- Weight class: `daemond`

## Message Types

| Type | Description |
|------|-------------|
| `route` | Route an LLM request through the proxy |
| `metrics` | Get proxy metrics |
| `health` | Get proxy health |
| `add_rule` | Add a routing rule |
| `clear_cache` | Clear response cache |

## Routing Rules

Rules map model name patterns to providers. First exact match wins, then prefix match.

```json
{
  "type": "add_rule",
  "rule": {
    "match": "llama3",
    "provider": "ollama",
    "base_url": "http://localhost:11434",
    "weight_class": "daemond",
    "enabled": true
  }
}
```

```json
{
  "type": "add_rule",
  "rule": {
    "match": "gpt",
    "provider": "openai-compatible",
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-...",
    "model_override": "gpt-3.5-turbo",
    "weight_class": "daemond",
    "enabled": true
  }
}
```

## Route Request

```json
{
  "type": "route",
  "model": "llama3.1",
  "messages": [{ "role": "user", "content": "Hello" }],
  "temperature": 0.7,
  "max_tokens": 500
}
```

## Usage

```bash
# Start proxy server
npx tsx src/proxy/cli.ts

# Connect: ws.connect("ws://localhost:3334")
```
