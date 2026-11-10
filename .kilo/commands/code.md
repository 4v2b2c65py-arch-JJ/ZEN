# Command: code

Run or generate code within the jj-model project. Supports invoking the LLM to produce TypeScript/JavaScript snippets and writing them to disk.

Usage: `/code <description> [file_path]`

Behavior:
- Sends `<description>` to the LLM with a system prompt asking for runnable code.
- If `[file_path]` is provided, writes the generated code to that path.
- Otherwise prints the code to stdout.

Arguments:
- `<description>` — what the code should do (required)
- `[file_path]` — destination path relative to project root (optional)

Example:
```
/code "add a macOS notification tool handler" src/mac/integration.ts
/code "a function to compute cosine similarity"
```
