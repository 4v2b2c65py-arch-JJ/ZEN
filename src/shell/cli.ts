#!/usr/bin/env node
import { ShellVectorial } from "./vectorial.js";

async function main() {
  const shell = new ShellVectorial("daemond", 500);

  // Example: list directory
  const res = await shell.execute("ls", ["-la", "."]);
  console.log("STDOUT:\n", res.stdout);
  console.log("Exit code:", res.exit_code);
  console.log("Duration:", res.duration_ms, "ms");

  // Example: zsh
  const zsh = await shell.executeZsh("echo 'Hello from zsh'");
  console.log("ZSH:\n", zsh.stdout);

  // Example: pipe
  const pipe = await shell.pipeCommands([
    { command: "echo", args: ["peripheral vectorial shell test"] },
    { command: "wc", args: ["-w"] },
  ]);
  console.log("Pipe result:\n", pipe.map((p) => p.stdout).join(""));

  const stats = shell.getStats();
  console.log("Stats:", JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
