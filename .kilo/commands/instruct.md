# Command: instruct

Issue a directive to the LLM to perform a multi-step task, optionally using macOS automation tools.

Usage: `/instruct <directive>`

Behavior:
- Sends `<directive>` to the LLM with the full macOS tool schema (notify, say, open_app, list_apps, frontmost_app, applescript).
- If the LLM calls macOS tools, they execute via AppleScript/osascript.
- Results are fed back and a final answer is produced.
- Both the directive and result are stored in memory.

Arguments:
- `<directive>` — natural-language instruction (required)

Example:
```
/instruct "Open Slack and notify me that the build finished"
/instruct "Read the frontmost app's title and store it in memory"
```
