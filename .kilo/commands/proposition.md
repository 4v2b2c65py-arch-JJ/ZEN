# Command: proposition

Evaluate a proposal or idea by cross-referencing it against stored memories. Useful for consistency checks and prior-art lookup.

Usage: `/proposition <statement> [top_k]`

Behavior:
- Treats `<statement>` as a claim or proposal.
- Searches memory for supporting or contradicting entries.
- Returns a structured assessment: relevant memories, similarity scores, and a summary of alignment/conflict.

Arguments:
- `<statement>` — the proposition to evaluate (required)
- `[top_k]` — memories to retrieve (default: 5)

Example:
```
/proposition "We should use PostgreSQL instead of SQLite for recall storage"
```
