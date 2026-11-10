# Command: ask

Pose a question to the LLM with recall context. Pulls relevant memories first, then generates an answer.

Usage: `/ask <question> [top_k]`

Behavior:
- Searches vector memory for context relevant to `<question>`.
- Prepends `[RECALL]` context entries to the conversation.
- Streams/returns the LLM's answer.
- Stores both the question and answer back into memory.

Arguments:
- `<question>` — the user's question (required)
- `[top_k]` — number of recall memories to inject (default: 5)

Example:
```
/ask "What did I decide about the database schema?"
/ask "How do I configure macOS notifications?" 8
```
