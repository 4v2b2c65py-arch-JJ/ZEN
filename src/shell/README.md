# Shell Vectorial — CLI/Zshell/Shell Command Vectorials

Executes shell commands (zsh, bash, arbitrary) as vectorial operations with full history, timing, and piping. Designed for MCP/CLI/zshell use.

## Usage

```ts
const shell = createShellVectorial("daemond", 1000);

// Single command
const res = await shell.execute("ls", ["-la", "/Users/jjmarte/Desktop/JJ-model"]);
console.log(res.stdout);

// Zsh command
const zshRes = await shell.executeZsh("echo hello from zsh");

// Bash command
const bashRes = await shell.executeBash("pwd");

// Pipe multiple commands (vectorial pipeline)
const pipe = await shell.pipeCommands([
  { command: "echo", args: ["hello world"] },
  { command: "wc", args: ["-w"] },
]);
```

## History

Every command result is stored with exit code, stdout, stderr, duration, and timestamp. Query via `getResult(id)` or `listHistory(limit)`.

## MCP Tools (via BroadSpectrum)

- `shell_execute` — run a command
- `shell_execute_zsh` — run a zsh command
- `shell_execute_bash` — run a bash command
- `shell_pipe` — pipe commands vectorially
- `shell_history` — list command history
- `shell_stats` — shell statistics

## CLI

```bash
npx tsx src/shell/cli.ts
```

Weight class: `daemond` (high priority, keep-alive)
