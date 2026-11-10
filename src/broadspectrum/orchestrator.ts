import { MetaBrain, createMetaBrain } from "../metabrain/scanner.js";
import { ToolRegistry, createToolRegistry } from "../tools/registry.js";
import { IDeviceAutomation, createIDeviceAutomation } from "../idevice/automation/index.js";
import { ICloudExpansion, createICloudExpansion } from "../icloud/expansion.js";
import { GGUFManager, createGGUFManager } from "../gguf/manager.js";
import { ControlTagger, createControlTagger } from "../control/tagger.js";
import { MCPClient, createMCPClient } from "../mcp-client/client.js";
import { DatasetPool, createDatasetPool } from "../dataset/pool.js";
import { KeyBindManager, createKeyBindManager } from "../keybind/manager.js";
import { PeripheralManager, createPeripheralManager } from "../peripheral/manager.js";
import { ShellVectorial, createShellVectorial } from "../shell/vectorial.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { CrossComm } from "../crosscomm/index.js";
import { IDeviceBridge } from "../idevice/bridge.js";
import { MacIntegration } from "../mac/integration.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/config.js";

export interface BroadSpectrumCapabilities {
  memory: boolean;
  mac: boolean;
  cross_device: boolean;
  media: boolean;
  metabrain: boolean;
  tools: boolean;
  idevice_automation: boolean;
  autonomous_dir: boolean;
  icloud_expansion: boolean;
  gguf_models: boolean;
  control_tags: boolean;
  mcp_client: boolean;
  keybind: boolean;
  peripheral: boolean;
  shell_vectorial: boolean;
  dataset_pool: boolean;
  weight_class: string;
}

export class BroadSpectrumOrchestrator {
  private memory: VectorMemory;
  private cross: CrossComm;
  private metabrain: MetaBrain;
  private tools: ToolRegistry;
  private ideviceAuto: IDeviceAutomation;
  private idevice: IDeviceBridge;
  private icloud: ICloudExpansion;
  private gguf: GGUFManager;
  private control: ControlTagger;
  private mcpClient: MCPClient;
  private keybind: KeyBindManager;
  private peripheral: PeripheralManager;
  private shell: ShellVectorial;
  private dataset: DatasetPool;
  private mac: MacIntegration;
  private capabilities: BroadSpectrumCapabilities;
  private weightClass: string;

  constructor(
    memory: VectorMemory,
    cross: CrossComm,
    idevice: IDeviceBridge,
    mac: MacIntegration,
    weightClass: string = "daemond",
  ) {
    this.memory = memory;
    this.cross = cross;
    this.idevice = idevice;
    this.mac = mac;
    this.weightClass = weightClass;
    this.metabrain = createMetaBrain(memory, weightClass);
    this.tools = createToolRegistry(weightClass);
    this.ideviceAuto = createIDeviceAutomation(idevice, weightClass);
    this.icloud = createICloudExpansion(memory, weightClass);
    this.gguf = createGGUFManager("./models/gguf", weightClass, "http://localhost:3334");
    this.control = createControlTagger(weightClass);
    this.mcpClient = createMCPClient(weightClass);
    this.keybind = createKeyBindManager(memory, cross, mac, weightClass);
    this.peripheral = createPeripheralManager(memory, cross, weightClass);
    this.shell = createShellVectorial(weightClass, 500);
    this.dataset = createDatasetPool(memory, weightClass);
    this.capabilities = {
      memory: true,
      mac: config.macAutomationEnabled,
      cross_device: true,
      media: false,
      metabrain: true,
      tools: true,
      idevice_automation: true,
      autonomous_dir: true,
      icloud_expansion: true,
      gguf_models: true,
      control_tags: true,
      mcp_client: true,
      keybind: true,
      peripheral: true,
      shell_vectorial: true,
      dataset_pool: true,
      weight_class: weightClass,
    };
    this.registerDefaultTools();
    logger.info(`BroadSpectrum orchestrator initialized (weight: ${weightClass})`);
  }

  private registerDefaultTools(): void {
    this.tools.register({
      name: "metabrain_scan",
      description: "Run a metadata brain scan on memory entries",
      parameters: { type: "object", properties: { memory_ids: { type: "array" }, scan_type: { type: "string" } }, required: ["memory_ids"] },
      handler: async (args) => {
        const ids = (args.memory_ids as string[]) ?? [];
        const type = (args.scan_type as string) ?? "metadata";
        if (type === "pattern") return this.metabrain.scanPatterns((args.query as string) ?? "", 10);
        if (type === "association") return this.metabrain.scanAssociations(ids);
        return this.metabrain.scanMetadata(ids);
      },
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "metabrain_pac",
      description: "Create a metas PAC (package) from scan results",
      parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, scan_ids: { type: "array" } }, required: ["name"] },
      handler: async (args) => this.metabrain.createPac(String(args.name), String(args.description ?? ""), (args.scan_ids as string[]) ?? []),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "idevice_run_shortcut",
      description: "Run a shortcut on a connected iOS device",
      parameters: { type: "object", properties: { udid: { type: "string" }, shortcut: { type: "string" }, input: { type: "string" } }, required: ["udid", "shortcut"] },
      handler: async (args) => this.ideviceAuto.runShortcut(String(args.udid), String(args.shortcut), args.input as string | undefined),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "idevice_list_shortcuts",
      description: "List shortcuts on a connected iOS device",
      parameters: { type: "object", properties: { udid: { type: "string" } }, required: ["udid"] },
      handler: async (args) => this.ideviceAuto.listShortcuts(String(args.udid)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "idevice_notify",
      description: "Send notification to iOS device",
      parameters: { type: "object", properties: { udid: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["udid", "title", "body"] },
      handler: async (args) => this.ideviceAuto.notifyDevice(String(args.udid), String(args.title), String(args.body)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "idevice_screenshot",
      description: "Take screenshot on iOS device",
      parameters: { type: "object", properties: { udid: { type: "string" } }, required: ["udid"] },
      handler: async (args) => this.ideviceAuto.screenshotDevice(String(args.udid)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "idevice_battery",
      description: "Get battery level of iOS device",
      parameters: { type: "object", properties: { udid: { type: "string" } }, required: ["udid"] },
      handler: async (args) => this.ideviceAuto.getBattery(String(args.udid)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "broadcast_cross",
      description: "Broadcast a message to all cross-device peers",
      parameters: { type: "object", properties: { type: { type: "string" }, payload: { type: "object" } }, required: ["type", "payload"] },
      handler: async (args) => {
        const rawPayload = args.payload;
        const payload = typeof rawPayload === "object" && rawPayload !== null ? (rawPayload as Record<string, unknown>) : {};
        this.cross.broadcast({ type: args.type as any, from: "broadspectrum", to: "*", payload, timestamp: Date.now(), weightClass: this.weightClass });
        return { ok: true };
      },
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "memory_store",
      description: "Store a memory entry",
      parameters: { type: "object", properties: { content: { type: "string" }, source: { type: "string" }, metadata: { type: "object" } }, required: ["content"] },
      handler: async (args) => {
        const rawMeta = args.metadata ?? {};
        const metadata = typeof rawMeta === "object" && rawMeta !== null ? (rawMeta as Record<string, unknown>) : {};
        return this.memory.add({ content: String(args.content), metadata, source: (args.source ?? "user") as any });
      },
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "memory_recall",
      description: "Search recall memory",
      parameters: { type: "object", properties: { query: { type: "string" }, top_k: { type: "number" } }, required: ["query"] },
      handler: async (args) => this.memory.search(String(args.query), Number(args.top_k ?? 5)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "icloud_save_package",
      description: "Save model parameters as an iCloud expansion package",
      parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, model: { type: "string" }, provider: { type: "string" }, base_url: { type: "string" }, temperature: { type: "number" }, max_tokens: { type: "number" }, system_prompt: { type: "string" }, tools_enabled: { type: "boolean" }, weight_class: { type: "string" } }, required: ["name", "model"] },
      handler: async (args) => this.icloud.generateExpansionPackageFromModel(
        String(args.name),
        String(args.description ?? ""),
        String(args.model),
        {
          provider: args.provider as string | undefined,
          base_url: args.base_url as string | undefined,
          temperature: args.temperature as number | undefined,
          max_tokens: args.max_tokens as number | undefined,
          system_prompt: args.system_prompt as string | undefined,
          tools_enabled: args.tools_enabled as boolean | undefined,
          weight_class: args.weight_class as string | undefined,
        },
      ),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "icloud_list_packages",
      description: "List iCloud expansion packages",
      parameters: { type: "object", properties: {} },
      handler: async () => this.icloud.listExpansionPackages(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "icloud_apply_package",
      description: "Apply an iCloud expansion package (load its parameters)",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      handler: async (args) => this.icloud.applyExpansionPackage(String(args.id)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "icloud_delete_package",
      description: "Delete an iCloud expansion package",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      handler: async (args) => this.icloud.deleteExpansionPackage(String(args.id)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "icloud_status",
      description: "Check iCloud expansion availability",
      parameters: { type: "object", properties: {} },
      handler: async () => this.icloud.isAvailable(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "gguf_list_datasets",
      description: "List GGUF dataset sources",
      parameters: { type: "object", properties: {} },
      handler: async () => this.gguf.listDatasets(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "gguf_search",
      description: "Search GGUF models in datasets",
      parameters: { type: "object", properties: { query: { type: "string" }, source: { type: "string" } }, required: ["query"] },
      handler: async (args) => this.gguf.searchGGUF(String(args.query), String(args.source ?? "huggingface-gguf")),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "gguf_install",
      description: "Install a GGUF model from a dataset",
      parameters: { type: "object", properties: { model_id: { type: "string" }, model_name: { type: "string" }, source_url: { type: "string" }, filename: { type: "string" }, quant_type: { type: "string" } }, required: ["model_id", "model_name", "source_url", "filename"] },
      handler: async (args) => this.gguf.installGGUFFromDataset(
        String(args.model_id),
        String(args.model_name),
        String(args.source_url),
        String(args.filename),
        String(args.quant_type ?? "Q4_K_M"),
      ),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "gguf_list_models",
      description: "List installed GGUF models",
      parameters: { type: "object", properties: {} },
      handler: async () => this.gguf.listModels(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "control_scan_file",
      description: "Scan a file for if/control/memory statement tags",
      parameters: { type: "object", properties: { file_path: { type: "string" }, content: { type: "string" } }, required: ["file_path", "content"] },
      handler: async (args) => this.control.scanFile(String(args.file_path), String(args.content)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "control_scan_directory",
      description: "Scan a directory for control/memory tags",
      parameters: { type: "object", properties: { dir_path: { type: "string" } }, required: ["dir_path"] },
      handler: async (args) => this.control.scanDirectory(String(args.dir_path)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "control_stats",
      description: "Get control tag statistics",
      parameters: { type: "object", properties: {} },
      handler: async () => this.control.getStats(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "mcp_client_connect",
      description: "Connect to an MCP server",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      handler: async (args) => this.mcpClient.connect(String(args.name)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "mcp_client_list_tools",
      description: "List tools from an MCP server",
      parameters: { type: "object", properties: { server: { type: "string" } }, required: ["server"] },
      handler: async (args) => this.mcpClient.listTools(String(args.server)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "mcp_client_call_tool",
      description: "Call a tool on an MCP server",
      parameters: { type: "object", properties: { server: { type: "string" }, tool: { type: "string" }, args: { type: "object" } }, required: ["server", "tool"] },
      handler: async (args) => this.mcpClient.callTool(String(args.server), String(args.tool), typeof args.args === "object" && args.args !== null ? (args.args as Record<string, unknown>) : {}),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "mcp_client_health",
      description: "Get MCP client health",
      parameters: { type: "object", properties: {} },
      handler: async () => this.mcpClient.getHealth(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "keybind_add",
      description: "Register a key binding for thoughts/actions",
      parameters: { type: "object", properties: { key: { type: "string" }, modifiers: { type: "array" }, action: { type: "string" }, payload: { type: "object" }, description: { type: "string" }, enabled: { type: "boolean" } }, required: ["key", "modifiers", "action"] },
      handler: async (args) => this.keybind.addBinding({
        key: String(args.key),
        modifiers: Array.isArray(args.modifiers) ? (args.modifiers as string[]) : [],
        action: String(args.action) as any,
        payload: (typeof args.payload === "object" && args.payload !== null) ? (args.payload as Record<string, unknown>) : {},
        description: String(args.description ?? ""),
        enabled: (args.enabled as boolean | undefined) ?? true,
        weight_class: this.weightClass,
      }),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "keybind_trigger",
      description: "Trigger a key binding by id",
      parameters: { type: "object", properties: { binding_id: { type: "string" } }, required: ["binding_id"] },
      handler: async (args) => this.keybind.trigger(String(args.binding_id)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "keybind_list",
      description: "List all key bindings",
      parameters: { type: "object", properties: {} },
      handler: async () => this.keybind.listBindings(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "keybind_stats",
      description: "Get key binding statistics",
      parameters: { type: "object", properties: {} },
      handler: async () => this.keybind.getStats(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "peripheral_capture_screen",
      description: "Capture screen frame",
      parameters: { type: "object", properties: { display_id: { type: "string" } } },
      handler: async (args) => this.peripheral.captureScreen(String(args.display_id ?? "1")),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "peripheral_capture_lidar",
      description: "Capture LiDAR frame",
      parameters: { type: "object", properties: { device_id: { type: "string" } } },
      handler: async (args) => this.peripheral.captureLidar(String(args.device_id ?? "")),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "peripheral_capture_camera",
      description: "Capture camera frame",
      parameters: { type: "object", properties: { device: { type: "string" } } },
      handler: async (args) => this.peripheral.captureCamera(String(args.device ?? "default")),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "peripheral_capture_all",
      description: "Capture all peripheral sources",
      parameters: { type: "object", properties: {} },
      handler: async () => this.peripheral.captureAll(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "peripheral_start_trace",
      description: "Start an advanced trace span",
      parameters: { type: "object", properties: { name: { type: "string" }, attributes: { type: "object" } }, required: ["name"] },
      handler: async (args) => this.peripheral.startTrace(String(args.name), (typeof args.attributes === "object" && args.attributes !== null) ? (args.attributes as Record<string, unknown>) : {}),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "peripheral_end_trace",
      description: "End a trace span by id",
      parameters: { type: "object", properties: { span_id: { type: "string" } }, required: ["span_id"] },
      handler: async (args) => this.peripheral.endTrace(String(args.span_id)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "peripheral_stats",
      description: "Get peripheral capture statistics",
      parameters: { type: "object", properties: {} },
      handler: async () => this.peripheral.getStats(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "shell_execute",
      description: "Execute a shell command",
      parameters: { type: "object", properties: { command: { type: "string" }, args: { type: "array" }, cwd: { type: "string" }, timeout: { type: "number" } }, required: ["command"] },
      handler: async (args) => this.shell.execute(String(args.command), Array.isArray(args.args) ? args.args as string[] : [], String(args.cwd ?? ""), Number(args.timeout ?? 30000)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "shell_execute_zsh",
      description: "Execute a zsh command",
      parameters: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] },
      handler: async (args) => this.shell.executeZsh(String(args.command), String(args.cwd ?? "")),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "shell_execute_bash",
      description: "Execute a bash command",
      parameters: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] },
      handler: async (args) => this.shell.executeBash(String(args.command), String(args.cwd ?? "")),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "shell_pipe",
      description: "Pipe commands vectorially",
      parameters: { type: "object", properties: { commands: { type: "array" } }, required: ["commands"] },
      handler: async (args) => this.shell.pipeCommands(Array.isArray(args.commands) ? args.commands as any[] : []),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "shell_history",
      description: "List shell command history",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
      handler: async (args) => this.shell.listHistory(Number(args.limit ?? 50)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "shell_stats",
      description: "Get shell statistics",
      parameters: { type: "object", properties: {} },
      handler: async () => this.shell.getStats(),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "dataset_ingest",
      description: "Ingest a dataset entry into the pool",
      parameters: { type: "object", properties: { source: { type: "string" }, type: { type: "string" }, content: { type: "string" }, metadata: { type: "object" }, device_id: { type: "string" }, tags: { type: "array" } }, required: ["source", "type", "content"] },
      handler: async (args) => this.dataset.ingest({ source: String(args.source), type: String(args.type) as any, content: String(args.content), metadata: (typeof args.metadata === "object" && args.metadata !== null) ? (args.metadata as Record<string, unknown>) : {}, device_id: typeof args.device_id === "string" ? args.device_id : undefined, tags: Array.isArray(args.tags) ? args.tags as string[] : [] }),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "dataset_drop_device",
      description: "Drop in device specifics into the pool",
      parameters: { type: "object", properties: { device_id: { type: "string" }, model: { type: "string" }, os_version: { type: "string" }, capabilities: { type: "array" }, metadata: { type: "object" } }, required: ["device_id"] },
      handler: async (args) => this.dataset.dropInDeviceSpecifics(String(args.device_id), typeof args.metadata === "object" && args.metadata !== null ? (args.metadata as Record<string, unknown>) : {}),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "dataset_handoff",
      description: "Pass a dataset between components",
      parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, dataset_id: { type: "string" }, action: { type: "string" } }, required: ["from", "to", "dataset_id"] },
      handler: async (args) => this.dataset.createHandoff(String(args.from), String(args.to), String(args.dataset_id), String(args.action ?? "ingest") as any),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "dataset_query",
      description: "Query the dataset pool",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
      handler: async (args) => this.dataset.query(String(args.query), Number(args.limit ?? 10)),
      weight_class: this.weightClass,
    });
    this.tools.register({
      name: "dataset_stats",
      description: "Get dataset pool statistics",
      parameters: { type: "object", properties: {} },
      handler: async () => this.dataset.getStats(),
      weight_class: this.weightClass,
    });
  }

  async getCapabilities(): Promise<BroadSpectrumCapabilities> {
    return { ...this.capabilities };
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<any> {
    return this.tools.execute(name, args);
  }

  listTools(): any[] {
    return this.tools.list().map((t) => ({ name: t.name, description: t.description, parameters: t.parameters, weight_class: t.weight_class }));
  }

  async discoverIDevices(): Promise<any[]> {
    return this.ideviceAuto.listShortcuts("") .then(() => []) .catch(() => []);
  }

  async runBrainScan(scanType: string, memoryIds?: string[]): Promise<any> {
    if (scanType === "metadata") return this.metabrain.scanMetadata(memoryIds ?? []);
    if (scanType === "pattern") return this.metabrain.scanPatterns("", 10);
    if (scanType === "association") return this.metabrain.scanAssociations(memoryIds ?? []);
    throw new Error(`Unknown scan type: ${scanType}`);
  }

  async createMetasPac(name: string, description: string, scanIds: string[]): Promise<any> {
    return this.metabrain.createPac(name, description, scanIds);
  }

  getMetaBrain(): MetaBrain {
    return this.metabrain;
  }

  getToolRegistry(): ToolRegistry {
    return this.tools;
  }

  getIDeviceAutomation(): IDeviceAutomation {
    return this.ideviceAuto;
  }

  getGGUFManager(): GGUFManager {
    return this.gguf;
  }

  getControlTagger(): ControlTagger {
    return this.control;
  }

  getMCPClient(): MCPClient {
    return this.mcpClient;
  }

  getShell(): ShellVectorial {
    return this.shell;
  }

  getDatasetPool(): DatasetPool {
    return this.dataset;
  }
}

export function createBroadSpectrumOrchestrator(
  memory: VectorMemory,
  cross: CrossComm,
  idevice: IDeviceBridge,
  mac: MacIntegration,
  weightClass?: string,
): BroadSpectrumOrchestrator {
  return new BroadSpectrumOrchestrator(memory, cross, idevice, mac, weightClass);
}
