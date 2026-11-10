import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";

const execFileAsync = promisify(execFile);

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<any>;
  weight_class: string;
}

export interface ToolExecutionResult {
  tool: string;
  args: Record<string, unknown>;
  result: any;
  success: boolean;
  duration_ms: number;
  timestamp: number;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private history = new Map<string, ToolExecutionResult[]>();
  private weightClass: string;

  constructor(weightClass: string = "daemond") {
    this.weightClass = weightClass;
    logger.info(`Tool registry initialized (weight: ${weightClass})`);
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    if (!this.history.has(tool.name)) this.history.set(tool.name, []);
    logger.info(`Tool registered: ${tool.name} (weight: ${tool.weight_class})`);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    const start = Date.now();
    try {
      const result = await tool.handler(args);
      const duration = Date.now() - start;
      const exec: ToolExecutionResult = {
        tool: name,
        args,
        result,
        success: true,
        duration_ms: duration,
        timestamp: start,
      };
      this.history.get(name)!.push(exec);
      logger.info(`Tool executed: ${name} (${duration}ms)`);
      return exec;
    } catch (err) {
      const duration = Date.now() - start;
      const exec: ToolExecutionResult = {
        tool: name,
        args,
        result: null,
        success: false,
        duration_ms: duration,
        timestamp: start,
      };
      this.history.get(name)!.push(exec);
      logger.error(`Tool failed: ${name}: ${err}`);
      throw err;
    }
  }

  getHistory(name?: string): ToolExecutionResult[] {
    if (name) return this.history.get(name) ?? [];
    return Array.from(this.history.values()).flat();
  }

  async executeMacApplescript(script: string): Promise<any> {
    const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 10000 });
    return { success: true, output: stdout.trim() };
  }

  async executeShell(cmd: string, args: string[] = []): Promise<any> {
    const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: 30000 });
    return { success: true, stdout, stderr };
  }
}

export function createToolRegistry(weightClass?: string): ToolRegistry {
  return new ToolRegistry(weightClass);
}
