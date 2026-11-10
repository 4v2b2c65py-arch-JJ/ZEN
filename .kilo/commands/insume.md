# Command: insume

Ingest and summarize external content into memory. Reads a file or text block, summarizes it, and stores the summary plus original in the vector store.

Usage: `/insume <file_path_or_text> [source]`

Behavior:
- If `<file_path_or_text>` is an existing file, reads its contents.
- Otherwise treats it as raw text.
- Summarizes via the LLM.
- Stores both the summary and full text as memory entries tagged with `[source]`.

Arguments:
- `<file_path_or_text>` — file path or raw text (required)
- `[source]` — memory source tag (default: `user`)

Example:
```
/insume ./README.md documentation
/insume "Meeting notes: discussed Q3 roadmap and hiring plan"
```
