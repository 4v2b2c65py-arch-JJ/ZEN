# MCP Client — Connect to External MCP Servers

Connects jj-model to external Model Context Protocol servers (stdio-based) to use their tools and resources.

## Configure a Server

```ts
const client = createMCPClient("daemond");
client.addServer({
  name: "filesystem",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/jjmarte/Desktop/JJ-model"],
  enabled: true,
  weight_class: "daemond",
});
await client.connect("filesystem");
```

## List & Call Tools

```ts
const tools = await client.listTools("filesystem");
const result = await client.callTool("filesystem", "read_file", { path: "./README.md" });
```

## Weight Class

`daemond` — high priority, keep-alive connections.

## CLI

```bash
npx tsx src/mcp-client/cli.ts
```
