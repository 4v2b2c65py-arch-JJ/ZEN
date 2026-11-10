# Command: store

Persist a memory entry to the vector store. Embeds the content and writes it to `data/recall.db`.

Usage: `/store <content> [source] [metadata_json]`

Behavior:
- Generates a UUID and current timestamp.
- Computes an embedding for `<content>`.
- Inserts into the `memories` table.
- Persists the SQLite database to disk immediately.

Arguments:
- `<content>` — text to store (required)
- `[source]` — one of `user`, `assistant`, `system`, `mac` (default: `user`)
- `[metadata_json]` — optional JSON object string for metadata

Example:
```
/store "I prefer dark mode" user '{"theme":"dark"}'
/store "Meeting at 3pm with design team"
```
