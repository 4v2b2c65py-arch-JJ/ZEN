import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

export interface ShellCommand {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout: number;
  weight_class: string;
}

export interface ShellResult {
  id: string;
  command: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timestamp: number;
  weight_class: string;
}

export interface ShellHistory {
  id: string;
  command: string;
  result_id: string;
  timestamp: number;
}

export class ShellVectorial {
  private history = new Map<string, ShellResult>();
  private weightClass: string;
  private maxHistory: number;

  constructor(weightClass: string = "daemond", maxHistory: number = 1000) {
    this.weightClass = weightClass;
    this.maxHistory = maxHistory;
    logger.info(`Shell vectorial initialized (weight: ${weightClass}, max history: ${maxHistory})`);
  }

  async execute(command: string, args: string[] = [], cwd?: string, timeout: number = 30000): Promise<ShellResult> {
    const id = crypto.randomUUID();
    const start = Date.now();

    try {
      const { stdout, stderr } = await execFileAsync(command, args, { cwd, timeout });
      const duration = Date.now() - start;
      const result: ShellResult = {
        id,
        command: `${command} ${args.join(" ")}`,
        exit_code: 0,
        stdout,
        stderr,
        duration_ms: duration,
        timestamp: start,
        weight_class: this.weightClass,
      };
      this.store(result);
      logger.info(`Shell executed: ${result.command} (${duration}ms)`);
      return result;
    } catch (err: any) {
      const duration = Date.now() - start;
      const result: ShellResult = {
        id,
        command: `${command} ${args.join(" ")}`,
        exit_code: err.exit_code ?? -1,
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? String(err),
        duration_ms: duration,
        timestamp: start,
        weight_class: this.weightClass,
      };
      this.store(result);
      logger.error(`Shell failed: ${result.command}: ${err.stderr ?? err.message}`);
      return result;
    }
  }

  async executeZsh(command: string, cwd?: string): Promise<ShellResult> {
    return this.execute("zsh", ["-c", command], cwd);
  }

  async executeBash(command: string, cwd?: string): Promise<ShellResult> {
    return this.execute("bash", ["-c", command], cwd);
  }

  private store(result: ShellResult): void {
    this.history.set(result.id, result);
    if (this.history.size > this.maxHistory) {
      const firstKey = this.history.keys().next().value;
      if (firstKey !== undefined) this.history.delete(firstKey);
    }
  }

  getResult(id: string): ShellResult | undefined {
    return this.history.get(id);
  }

  listHistory(limit: number = 50): ShellResult[] {
    return Array.from(this.history.values()).slice(-limit);
  }

  getStats(): { total: number; weight_class: string } {
    return { total: this.history.size, weight_class: this.weightClass };
  }

  async pipeCommands(commands: Array<{ command: string; args: string[] }>): Promise<ShellResult[]> {
    const results: ShellResult[] = [];
    let prevOutput = "";

    for (const cmd of commands) {
      const args = [...cmd.args];
      // If there's previous output, feed it as stdin via echo
      if (prevOutput) {
        const echoRes = await this.execute("echo", [prevOutput]);
        prevOutput = echoRes.stdout;
      }
      const result = await this.execute(cmd.command, args);
      results.push(result);
      prevOutput = result.stdout;
    }

    return results;
  }
}

export function createShellVectorial(weightClass?: string, maxHistory?: number): ShellVectorial {
  return new ShellVectorial(weightClass, maxHistory);
}
