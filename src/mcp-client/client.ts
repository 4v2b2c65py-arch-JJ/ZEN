export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  weight_class: string;
}

export interface MCPTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  server: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mime_type?: string;
  server: string;
}

export interface MCPClientConnection {
  server: string;
  connected: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
  connected_at: number;
  weight_class: string;
}

export class MCPClient {
  private servers = new Map<string, MCPServerConfig>();
  private connections = new Map<string, MCPClientConnection>();
  private processes = new Map<string, { stdin: NodeJS.WritableStream; stdout: NodeJS.ReadableStream }>();
  private weightClass: string;
  private messageId = 0;

  constructor(weightClass: string = "daemond") {
    this.weightClass = weightClass;
    logger.info(`MCP client initialized (weight: ${weightClass})`);
  }

  addServer(config: MCPServerConfig): void {
    this.servers.set(config.name, config);
    logger.info(`MCP server configured: ${config.name} (weight: ${config.weight_class})`);
  }

  removeServer(name: string): void {
    this.servers.delete(name);
    this.connections.delete(name);
    const proc = this.processes.get(name);
    if (proc) {
      try { proc.stdin.end(); } catch {}
      this.processes.delete(name);
    }
  }

  listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  async connect(name: string): Promise<MCPClientConnection> {
    const config = this.servers.get(name);
    if (!config) throw new Error(`MCP server not configured: ${name}`);
    if (!config.enabled) throw new Error(`MCP server disabled: ${name}`);

    const { spawn } = await import("child_process");
    const proc = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let buffer = "";
    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line);
            this.handleServerMessage(name, msg);
          } catch {
            // ignore parse errors
          }
        }
      }
    });

    this.processes.set(name, { stdin: proc.stdin, stdout: proc.stdout });

    // Send initialize
    const initMsg = this.createRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "jj-model", version: "1.0.0" },
    });
    this.sendMessage(name, initMsg);

    const connection: MCPClientConnection = {
      server: name,
      connected: true,
      tools: [],
      resources: [],
      connected_at: Date.now(),
      weight_class: config.weight_class,
    };
    this.connections.set(name, connection);
    logger.info(`MCP client connected: ${name} (weight: ${config.weight_class})`);
    return connection;
  }

  private sendMessage(server: string, message: any): void {
    const proc = this.processes.get(server);
    if (proc) {
      proc.stdin.write(JSON.stringify(message) + "\n");
    }
  }

  private createRequest(method: string, params: any): any {
    this.messageId++;
    return { jsonrpc: "2.0", id: this.messageId, method, params };
  }

  private handleServerMessage(server: string, msg: any): void {
    const connection = this.connections.get(server);
    if (!connection) return;

    if (msg.method === "tools/list") {
      connection.tools = (msg.result?.tools ?? []).map((t: any) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema ?? {},
        server,
      }));
      this.connections.set(server, connection);
    }
    if (msg.method === "resources/list") {
      connection.resources = (msg.result?.resources ?? []).map((r: any) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mime_type: r.mimeType,
        server,
      }));
      this.connections.set(server, connection);
    }
  }

  async listTools(server: string): Promise<MCPTool[]> {
    const connection = this.connections.get(server);
    if (!connection) throw new Error(`Not connected to MCP server: ${server}`);
    return connection.tools;
  }

  async listAllTools(): Promise<MCPTool[]> {
    const all: MCPTool[] = [];
    for (const [name] of this.connections) {
      const tools = await this.listTools(name);
      all.push(...tools);
    }
    return all;
  }

  async callTool(server: string, tool: string, args: Record<string, unknown>): Promise<any> {
    const connection = this.connections.get(server);
    if (!connection) throw new Error(`Not connected to MCP server: ${server}`);
    const toolDef = connection.tools.find((t) => t.name === tool);
    if (!toolDef) throw new Error(`Tool not found: ${tool} on ${server}`);

    const msg = this.createRequest("tools/call", { name: tool, arguments: args });
    return new Promise((resolve, reject) => {
      const id = msg.id;
      const timeout = setTimeout(() => reject(new Error(`MCP call timeout: ${tool}`)), 30000);
      // We'd need a request/response matcher; for now send and resolve placeholder
      this.sendMessage(server, msg);
      resolve({ tool, server, args, sent: true, timestamp: Date.now() });
      clearTimeout(timeout);
    });
  }

  async disconnect(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (conn) conn.connected = false;
    const proc = this.processes.get(name);
    if (proc) {
      try { proc.stdin.end(); } catch {}
      this.processes.delete(name);
    }
    this.connections.delete(name);
    logger.info(`MCP client disconnected: ${name}`);
  }

  getConnections(): MCPClientConnection[] {
    return Array.from(this.connections.values());
  }

  getHealth(): { servers: number; connected: number; weight_class: string } {
    return {
      servers: this.servers.size,
      connected: this.connections.size,
      weight_class: this.weightClass,
    };
  }
}

export function createMCPClient(weightClass?: string): MCPClient {
  return new MCPClient(weightClass);
}

import { logger } from "../utils/logger.js";
