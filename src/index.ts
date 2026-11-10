import { APIServer } from "./api/server.js";
import { VectorMemory } from "./memory/vector-memory.js";
import { MacIntegration } from "./mac/integration.js";
import { CrossComm, createCrossComm } from "./crosscomm/index.js";
import { createProvider } from "./llm/provider.js";
import { DataTransfer } from "./sync/transfer.js";
import { NetworkKernel } from "./network/kernel/index.js";
import { IDeviceBridge } from "./idevice/bridge.js";
import { AutonomousDirectory, createAutonomousDirectory } from "./autonomous/directory.js";
import { CrossDeviceManager, createCrossDeviceManager } from "./crossdevice/manager.js";
import { MediaManager, createMediaManager } from "./media/manager.js";
import { MetaBrain, createMetaBrain } from "./metabrain/scanner.js";
import { ToolRegistry, createToolRegistry } from "./tools/registry.js";
import { IDeviceAutomation, createIDeviceAutomation } from "./idevice/automation/index.js";
import { BroadSpectrumOrchestrator, createBroadSpectrumOrchestrator } from "./broadspectrum/orchestrator.js";
import { ICloudExpansion, createICloudExpansion } from "./icloud/expansion.js";
import { ModelProxy, createModelProxy } from "./proxy/index.js";
import { ProxyServer, createProxyServer } from "./proxy/server.js";
import { GGUFManager, createGGUFManager } from "./gguf/manager.js";
import { ControlTagger, createControlTagger } from "./control/tagger.js";
import { MCPClient, createMCPClient } from "./mcp-client/client.js";
import { KeyBindManager, createKeyBindManager } from "./keybind/manager.js";
import { PeripheralManager, createPeripheralManager } from "./peripheral/manager.js";
import { ShellVectorial, createShellVectorial } from "./shell/vectorial.js";
import { DatasetPool, createDatasetPool } from "./dataset/pool.js";
import { config } from "./config/config.js";
import { logger } from "./utils/logger.js";

let memory: VectorMemory | null = null;
let mac: MacIntegration | null = null;
let cross: CrossComm | null = null;
let transfer: DataTransfer | null = null;
let network: NetworkKernel | null = null;
let idevice: IDeviceBridge | null = null;
let autonomous: AutonomousDirectory | null = null;
let crossdevice: CrossDeviceManager | null = null;
let media: MediaManager | null = null;
let metabrain: MetaBrain | null = null;
let tools: ToolRegistry | null = null;
let ideviceAuto: IDeviceAutomation | null = null;
let broadspectrum: BroadSpectrumOrchestrator | null = null;
let api: APIServer | null = null;
let modelProxy: ModelProxy | null = null;
let proxyServer: ProxyServer | null = null;
let icloud: ICloudExpansion | null = null;
let gguf: GGUFManager | null = null;
let control: ControlTagger | null = null;
let mcpClient: MCPClient | null = null;
let keybind: KeyBindManager | null = null;
let peripheral: PeripheralManager | null = null;
let shell: ShellVectorial | null = null;
let dataset: DatasetPool | null = null;

async function start(): Promise<void> {
  memory = new VectorMemory(config.memoryDbPath);
  mac = new MacIntegration(config.macAutomationEnabled);
  cross = createCrossComm(memory, 4445, "daemond");
  transfer = new DataTransfer(memory);
  const api = new APIServer(memory, mac, createProvider(config.llmProvider, config.llmBaseUrl, config.llmModel, config.llmApiKey), config.port);
  network = new NetworkKernel(true);
  idevice = new IDeviceBridge({
    enabled: true,
    bridge_port: 4444,
    usb_muxd: true,
    auto_connect: true,
    pairing_required: false,
    weight_class: "daemond",
  });
  autonomous = createAutonomousDirectory(memory, {
    watchPaths: ["./data", "./src"],
    autoOrganize: true,
    weightClass: "daemond",
    pollIntervalMs: 2000,
  });
  crossdevice = createCrossDeviceManager(memory, cross, idevice, "daemond");
  media = createMediaManager(memory, cross, "daemond");
  metabrain = createMetaBrain(memory, "daemond");
  tools = createToolRegistry("daemond");
  ideviceAuto = createIDeviceAutomation(idevice, "daemond");
  broadspectrum = createBroadSpectrumOrchestrator(memory, cross, idevice, mac, "daemond");
  modelProxy = createModelProxy("daemond", 300000);
  modelProxy.addRule({
    match: "llama",
    provider: "ollama",
    base_url: config.llmBaseUrl,
    weight_class: "daemond",
    enabled: true,
  });
  modelProxy.addRule({
    match: "gpt",
    provider: "openai-compatible",
    base_url: config.llmBaseUrl,
    api_key: config.llmApiKey,
    weight_class: "daemond",
    enabled: true,
  });
  proxyServer = createProxyServer(modelProxy, 3334);
  icloud = createICloudExpansion(memory, "daemond");
  gguf = createGGUFManager("./models/gguf", "daemond", "http://localhost:3334");
  control = createControlTagger("daemond");
  mcpClient = createMCPClient("daemond");
  keybind = createKeyBindManager(cross, memory, mac, "daemond");
  peripheral = createPeripheralManager(memory, cross, "daemond");
  shell = createShellVectorial("daemond", 500);
  dataset = createDatasetPool(memory, "daemond");

  // Default key bindings
  keybind.addBinding({
    key: "t",
    modifiers: ["cmd", "alt"],
    action: "thought",
    payload: { thought: "Quick thought captured via Cmd+Alt+T hotkey" },
    description: "Capture a thought to memory",
    weight_class: "daemond",
    enabled: true,
  });
  keybind.addBinding({
    key: "r",
    modifiers: ["cmd", "alt"],
    action: "memory_recall",
    payload: { query: "recent", top_k: 5 },
    description: "Recall recent memories",
    weight_class: "daemond",
    enabled: true,
  });
  keybind.addBinding({
    key: "n",
    modifiers: ["cmd", "alt"],
    action: "mac_action",
    payload: { script: 'display notification "jj-model hotkey triggered" with title "KeyBind"' },
    description: "Show macOS notification",
    weight_class: "daemond",
    enabled: true,
  });

  await autonomous.start();
  await crossdevice.startSync(30000);
  await network.enableDirectMode();

  logger.info("jj-model full-stack autonomous services started (weight: daemond)");
  logger.info("  - Main API: ws://localhost:3333");
  logger.info("  - Cross-comm: ws://localhost:4445");
  logger.info("  - Autonomous dir: watching ./data ./src");
  logger.info("  - Cross-device: syncing Apple devices every 30s");
  logger.info("  - Media: screen share + camera ready");
  logger.info("  - MetaBrain: brain data scans + metas PAC");
  logger.info("  - Tool registry: autonomous tool execution");
  logger.info("  - iDevice automation: shortcuts + device actions");
  logger.info("  - BroadSpectrum: broad spectrum capabilities orchestrator");
  logger.info("  - Model proxy: ws://localhost:3334");
  logger.info("  - iCloud expansion: syncing model parameters to iCloud Drive");
  logger.info("  - GGUF manager: quantized model install from datasets");
  logger.info("  - Control tagger: if/control/memory statement tracking");
  logger.info("  - MCP client: external MCP server connections");
  logger.info("  - Key bind: thought binding + global hotkeys (Cmd+Alt+T/R/N)");
  logger.info("  - Peripheral: screen + LiDAR + camera + advanced tracing");
  logger.info("  - Shell vectorial: CLI/zshell/shell command vectorials");
  logger.info("  - Dataset pool: pass handoffs + device specifics data pool");
}

async function stop(): Promise<void> {
  if (autonomous) await autonomous.stop();
  if (crossdevice) await crossdevice.stopSync();
  if (cross) cross.close();
  if (icloud) await icloud.stopSync();
  if (mcpClient) {
    for (const conn of mcpClient.getConnections()) {
      await mcpClient.disconnect(conn.server);
    }
  }
  if (keybind) await keybind.stopGlobalHotkeyListener();
  if (peripheral) await peripheral.stopPeriodicCapture();
  if (proxyServer) proxyServer.close();
  if (api) api.close();
  if (memory) await memory.close();
  if (idevice) idevice.stopWatch();
  logger.info("jj-model full-stack services stopped");
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err}`);
});

start().catch((err) => {
  logger.error(`Failed to start full stack: ${err}`);
  process.exit(1);
});

export { memory, mac, cross, transfer, network, idevice, autonomous, crossdevice, media, metabrain, tools, ideviceAuto, broadspectrum, api, modelProxy, proxyServer, icloud, gguf, control, mcpClient, keybind, peripheral, shell, dataset };
