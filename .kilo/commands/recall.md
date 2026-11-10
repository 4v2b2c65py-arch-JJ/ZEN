# Command: recall

Semantic recall over the vector memory store. Searches `data/recall.db` using cosine similarity against the configured embedding model.

Usage: `/recall <query> [top_k]`

Behavior:
- Embeds `<query>` via the active LLM provider (Ollama by default, model `nomic-embed-text`).
- Returns the top-k most similar memory entries, ordered by similarity.
- Each result includes `id`, `content`, `metadata`, `source`, `created_at`, `updated_at`.

Arguments:
- `<query>` — free-text search string (required)
- `[top_k]` — number of results to return (default: 5)

Example:
```
/recall "coffee preference"
/recall "project meeting notes" 10
```
