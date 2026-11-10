# Command: read

Read a single memory entry by its UUID.

Usage: `/read <id>`

Behavior:
- Looks up the memory row by `id`.
- Returns the full entry including `content`, `metadata`, `source`, `created_at`, `updated_at`.
- Emits an error if no entry matches.

Arguments:
- `<id>` — memory UUID (required)

Example:
```
/read 550e8400-e29b-41d4-a716-446655440000
```
