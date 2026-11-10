# Command: mcp

Manage Model Context Protocol (MCP) routing for the jj-model project. Lists, enables, or disables MCP server connections that expose capabilities (filesystem, memory, macOS, transcription) to the LLM.

Usage: `/mcp [list|enable <name>|disable <name>|status]`

Behavior:
- `list` — show configured MCP servers and their status.
- `enable <name>` — start routing to an MCP server.
- `disable <name>` — stop routing to an MCP server.
- `status` — show current MCP routing table.

Configuration lives in `.kilo/mcp.json`.

Arguments:
- `[action]` — one of `list`, `enable`, `disable`, `status` (default: `list`)
- `<name>` — MCP server name (required for enable/disable)

Example:
```
/mcp list
/mcp enable filesystem
/mcp status
```
