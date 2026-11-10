import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { MacIntegration } from "../mac/integration.js";
import { CrossComm } from "../crosscomm/index.js";
import { DataTransfer } from "../sync/transfer.js";
import { NetworkKernel } from "../network/kernel/index.js";
import { IDeviceBridge } from "../idevice/bridge.js";
import { MetaBrain, createMetaBrain } from "../metabrain/scanner.js";
import { BroadSpectrumOrchestrator } from "../broadspectrum/orchestrator.js";
import { IDeviceAutomation } from "../idevice/automation/index.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/config.js";

export class MCPServer {
  private server: Server;
  private memory: VectorMemory;
  private mac: MacIntegration;
  private cross: CrossComm;
  private transfer: DataTransfer;
  private network: NetworkKernel;
  private idevice: IDeviceBridge;
  private metabrain: MetaBrain;
  private broadspectrum: BroadSpectrumOrchestrator;
  private ideviceAuto: IDeviceAutomation;

  constructor() {
    this.memory = new VectorMemory(config.memoryDbPath);
    this.mac = new MacIntegration(config.macAutomationEnabled);
    this.cross = new CrossComm(this.memory, 4445, "daemond");
    this.transfer = new DataTransfer(this.memory);
    this.network = new NetworkKernel(true);
    this.idevice = new IDeviceBridge({
      enabled: true,
      bridge_port: 4444,
      usb_muxd: true,
      auto_connect: true,
      pairing_required: false,
      weight_class: "daemond",
    });
    this.metabrain = createMetaBrain(this.memory, "daemond");
    this.broadspectrum = new BroadSpectrumOrchestrator(this.memory, this.cross, this.idevice, this.mac, "daemond");
    this.ideviceAuto = this.broadspectrum.getIDeviceAutomation();

    this.server = new Server(
      {
        name: "jj-model",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "jj_memory_store",
          description: "Store a memory entry in the vector recall store",
          inputSchema: {
            type: "object",
            properties: {
              content: { type: "string" },
              source: { type: "string", enum: ["user", "assistant", "system", "mac"] },
              metadata: { type: "object" },
            },
            required: ["content"],
          },
        },
        {
          name: "jj_memory_recall",
          description: "Search recall memory semantically",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              top_k: { type: "number" },
            },
            required: ["query"],
          },
        },
        {
          name: "jj_memory_list",
          description: "List recent memory entries",
          inputSchema: {
            type: "object",
            properties: { limit: { type: "number" } },
          },
        },
        {
          name: "jj_mac_notify",
          description: "Show a macOS notification",
          inputSchema: {
            type: "object",
            properties: { title: { type: "string" }, body: { type: "string" } },
            required: ["title", "body"],
          },
        },
        {
          name: "jj_mac_say",
          description: "Speak text aloud on macOS",
          inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        },
        {
          name: "jj_mac_open_app",
          description: "Open a macOS application",
          inputSchema: { type: "object", properties: { app_name: { type: "string" } }, required: ["app_name"] },
        },
        {
          name: "jj_mac_applescript",
          description: "Run arbitrary AppleScript",
          inputSchema: { type: "object", properties: { script: { type: "string" } }, required: ["script"] },
        },
        {
          name: "jj_cross_send",
          description: "Send data to a cross-device peer",
          inputSchema: {
            type: "object",
            properties: { to: { type: "string" }, type: { type: "string" }, payload: { type: "object" } },
            required: ["type", "payload"],
          },
        },
        {
          name: "jj_cross_peers",
          description: "List connected cross-device peers",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "jj_idevice_list",
          description: "List connected Apple iOS devices",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "jj_idevice_run_shortcut",
          description: "Run a shortcut on a connected iOS device",
          inputSchema: {
            type: "object",
            properties: { udid: { type: "string" }, shortcut: { type: "string" }, input: { type: "string" } },
            required: ["udid", "shortcut"],
          },
        },
        {
          name: "jj_idevice_notify",
          description: "Send notification to iOS device",
          inputSchema: {
            type: "object",
            properties: { udid: { type: "string" }, title: { type: "string" }, body: { type: "string" } },
            required: ["udid", "title", "body"],
          },
        },
        {
          name: "jj_idevice_screenshot",
          description: "Take screenshot on iOS device",
          inputSchema: { type: "object", properties: { udid: { type: "string" } }, required: ["udid"] },
        },
        {
          name: "jj_idevice_battery",
          description: "Get battery level of iOS device",
          inputSchema: { type: "object", properties: { udid: { type: "string" } }, required: ["udid"] },
        },
        {
          name: "jj_network_routes",
          description: "List kernel network routes",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "jj_autonomous_dir",
          description: "Read or write files autonomously in a directory",
          inputSchema: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["read", "write", "list", "watch"] },
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["action", "path"],
          },
        },
        {
          name: "jj_metabrain_scan",
          description: "Run a brain data scan on memory entries",
          inputSchema: {
            type: "object",
            properties: {
              scan_type: { type: "string", enum: ["metadata", "pattern", "association"] },
              memory_ids: { type: "array" },
              query: { type: "string" },
            },
            required: ["scan_type"],
          },
        },
        {
          name: "jj_metabrain_pac",
          description: "Create a metas PAC from scan results",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string" }, description: { type: "string" }, scan_ids: { type: "array" } },
            required: ["name"],
          },
        },
        {
          name: "jj_broad_capabilities",
          description: "Get broad spectrum capabilities",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "jj_broad_execute_tool",
          description: "Execute a broad spectrum tool",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string" }, args: { type: "object" } },
            required: ["name"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          case "jj_memory_store": {
            const rawContent = args?.content;
            const content = rawContent == null ? "" : String(rawContent);
            const rawMeta = args?.metadata ?? {};
            const metadata = typeof rawMeta === "object" && rawMeta !== null ? (rawMeta as Record<string, unknown>) : {};
            const rawSource = args?.source ?? "user";
            const source = (typeof rawSource === "string" ? rawSource : "user") as "user" | "assistant" | "system" | "mac";
            const id = await this.memory.add({ content, metadata, source });
            return { content: [{ type: "text", text: JSON.stringify({ id, ok: true }) }] };
          }
          case "jj_memory_recall": {
            const rawQuery = args?.query;
            const query = rawQuery == null ? "" : String(rawQuery);
            const results = await this.memory.search(query, Number(args?.top_k ?? 5));
            return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
          }
          case "jj_memory_list": {
            const results = await this.memory.list(Number(args?.limit ?? 20));
            return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
          }
          case "jj_mac_notify": {
            const r = await this.mac.notify(String(args?.title), String(args?.body));
            return { content: [{ type: "text", text: JSON.stringify(r) }] };
          }
          case "jj_mac_say": {
            const r = await this.mac.say(String(args?.text));
            return { content: [{ type: "text", text: JSON.stringify(r) }] };
          }
          case "jj_mac_open_app": {
            const r = await this.mac.openApp(String(args?.app_name));
            return { content: [{ type: "text", text: JSON.stringify(r) }] };
          }
          case "jj_mac_applescript": {
            const r = await this.mac.applescript(String(args?.script));
            return { content: [{ type: "text", text: JSON.stringify(r) }] };
          }
          case "jj_cross_send": {
            const rawTo = args?.to;
            const to = typeof rawTo === "string" ? rawTo : undefined;
            const rawPayload = args?.payload;
            const payload = typeof rawPayload === "object" && rawPayload !== null ? rawPayload : {};
            this.cross.broadcast({
              type: "command",
              from: "mcp",
              to,
              payload,
              timestamp: Date.now(),
              weightClass: "daemond",
            });
            return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
          }
          case "jj_cross_peers": {
            return { content: [{ type: "text", text: JSON.stringify({ peers: this.cross.getPeers(), count: this.cross.getPeerCount() }) }] };
          }
          case "jj_idevice_list": {
            const devices = await this.idevice.listDevices();
            return { content: [{ type: "text", text: JSON.stringify(devices, null, 2) }] };
          }
          case "jj_idevice_run_shortcut": {
            const result = await this.ideviceAuto.runShortcut(String(args?.udid), String(args?.shortcut), args?.input as string | undefined);
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
          }
          case "jj_idevice_notify": {
            const result = await this.ideviceAuto.notifyDevice(String(args?.udid), String(args?.title), String(args?.body));
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
          }
          case "jj_idevice_screenshot": {
            const result = await this.ideviceAuto.screenshotDevice(String(args?.udid));
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
          }
          case "jj_idevice_battery": {
            const result = await this.ideviceAuto.getBattery(String(args?.udid));
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
          }
          case "jj_network_routes": {
            const routes = await this.network.listRoutes();
            return { content: [{ type: "text", text: JSON.stringify(routes, null, 2) }] };
          }
          case "jj_autonomous_dir": {
            const result = await this.handleAutonomousDir(args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          case "jj_metabrain_scan": {
            const scanType = String(args?.scan_type ?? "metadata");
            const memoryIds = Array.isArray(args?.memory_ids) ? (args.memory_ids as string[]) : undefined;
            const query = typeof args?.query === "string" ? args.query : undefined;
            if (scanType === "pattern") {
              const result = await this.metabrain.scanPatterns(query ?? "", 10);
              return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            if (scanType === "association") {
              const result = await this.metabrain.scanAssociations(memoryIds ?? []);
              return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            }
            const result = await this.metabrain.scanMetadata(memoryIds ?? []);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          case "jj_metabrain_pac": {
            const result = await this.metabrain.createPac(
              String(args?.name ?? "pac"),
              String(args?.description ?? ""),
              Array.isArray(args?.scan_ids) ? (args.scan_ids as string[]) : [],
            );
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          case "jj_broad_capabilities": {
            const caps = await this.broadspectrum.getCapabilities();
            return { content: [{ type: "text", text: JSON.stringify(caps, null, 2) }] };
          }
          case "jj_broad_execute_tool": {
            const rawArgs = args?.args ?? {};
            const toolArgs = typeof rawArgs === "object" && rawArgs !== null ? (rawArgs as Record<string, unknown>) : {};
            const result = await this.broadspectrum.executeTool(String(args?.name), toolArgs);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        logger.error(`MCP tool error ${name}: ${err}`);
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: String(err) }) }], isError: true };
      }
    });
  }

  private async handleAutonomousDir(args: any): Promise<any> {
    const { action, path: dirPath, content } = args;
    const fs = await import("fs");
    const path = await import("path");

    switch (action) {
      case "list": {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return {
          path: dirPath,
          entries: entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() })),
        };
      }
      case "read": {
        const stat = fs.statSync(dirPath);
        if (stat.isDirectory()) {
          return { path: dirPath, isDirectory: true, entries: fs.readdirSync(dirPath) };
        }
        return { path: dirPath, isDirectory: false, content: fs.readFileSync(dirPath, "utf8") };
      }
      case "write": {
        const dir = path.dirname(dirPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dirPath, content ?? "");
        return { path: dirPath, ok: true, written: content ? content.length : 0 };
      }
      case "watch": {
        return { path: dirPath, watching: true, note: "Use fs.watch for real-time" };
      }
      default:
        throw new Error(`Unknown autonomous dir action: ${action}`);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info("MCP server started on stdio (weight: daemond)");
  }

  async stop(): Promise<void> {
    await this.memory.close();
    this.cross.close();
    this.idevice.stopWatch();
  }
}

export function createMCPServer(): MCPServer {
  return new MCPServer();
}
