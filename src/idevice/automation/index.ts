import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../../utils/logger.js";
import { IDeviceBridge } from "../bridge.js";

const execFileAsync = promisify(execFile);

export interface Shortcut {
  name: string;
  display_name: string;
  category: string;
  available: boolean;
}

export interface DeviceAction {
  udid: string;
  action: "notify" | "open_app" | "run_shortcut" | "get_clipboard" | "set_clipboard" | "screenshot" | "battery" | "location";
  params: Record<string, unknown>;
}

export interface AutomationResult {
  device: string;
  action: string;
  success: boolean;
  output: string;
  error?: string;
  timestamp: number;
}

export class IDeviceAutomation {
  private idevice: IDeviceBridge;
  private shortcuts = new Map<string, Shortcut[]>();
  private weightClass: string;

  constructor(idevice: IDeviceBridge, weightClass: string = "daemond") {
    this.idevice = idevice;
    this.weightClass = weightClass;
    logger.info(`iDevice automation initialized (weight: ${weightClass})`);
  }

  async listShortcuts(udid: string): Promise<Shortcut[]> {
    try {
      const { stdout } = await execFileAsync("ideviceinstaller", ["-u", udid, "-l"], { timeout: 10000 });
      const shortcuts: Shortcut[] = [];
      for (const line of stdout.trim().split("\n").filter(Boolean)) {
        shortcuts.push({
          name: line.trim(),
          display_name: line.trim(),
          category: "system",
          available: true,
        });
      }
      this.shortcuts.set(udid, shortcuts);
      return shortcuts;
    } catch (err) {
      logger.error(`Failed to list shortcuts for ${udid}: ${err}`);
      return [];
    }
  }

  async runShortcut(udid: string, shortcutName: string, input?: string): Promise<AutomationResult> {
    const start = Date.now();
    try {
      const args = ["-u", udid, "-s", shortcutName];
      if (input) args.push("-i", input);
      const { stdout } = await execFileAsync("shortcuts", args, { timeout: 30000 });
      const result: AutomationResult = {
        device: udid,
        action: "run_shortcut",
        success: true,
        output: stdout.trim(),
        timestamp: start,
      };
      logger.info(`Shortcut executed on ${udid}: ${shortcutName}`);
      return result;
    } catch (err) {
      const result: AutomationResult = {
        device: udid,
        action: "run_shortcut",
        success: false,
        output: "",
        error: String(err),
        timestamp: start,
      };
      logger.error(`Shortcut failed on ${udid}: ${err}`);
      return result;
    }
  }

  async notifyDevice(udid: string, title: string, body: string): Promise<AutomationResult> {
    const start = Date.now();
    try {
      await execFileAsync("osascript", [
        "-e", `tell application "System Events" to display notification "${body}" with title "${title}"`,
      ], { timeout: 10000 });
      return { device: udid, action: "notify", success: true, output: "notification sent", timestamp: start };
    } catch (err) {
      return { device: udid, action: "notify", success: false, output: "", error: String(err), timestamp: start };
    }
  }

  async screenshotDevice(udid: string): Promise<AutomationResult> {
    const start = Date.now();
    try {
      const out = `/tmp/jj-model-screenshot-${udid}-${Date.now()}.png`;
      await execFileAsync("idevicescreenshot", ["-u", udid, out], { timeout: 15000 });
      return { device: udid, action: "screenshot", success: true, output: out, timestamp: start };
    } catch (err) {
      return { device: udid, action: "screenshot", success: false, output: "", error: String(err), timestamp: start };
    }
  }

  async getBattery(udid: string): Promise<AutomationResult> {
    const start = Date.now();
    try {
      const { stdout } = await execFileAsync("ideviceinfo", ["-u", udid, "-k", "BatteryLevel"], { timeout: 10000 });
      return { device: udid, action: "battery", success: true, output: stdout.trim(), timestamp: start };
    } catch (err) {
      return { device: udid, action: "battery", success: false, output: "", error: String(err), timestamp: start };
    }
  }

  async getLocation(udid: string): Promise<AutomationResult> {
    const start = Date.now();
    try {
      const { stdout } = await execFileAsync("ideviceinfo", ["-u", udid, "-k", "Location"], { timeout: 10000 });
      return { device: udid, action: "location", success: true, output: stdout.trim(), timestamp: start };
    } catch (err) {
      return { device: udid, action: "location", success: false, output: "", error: String(err), timestamp: start };
    }
  }

  async executeDeviceAction(action: DeviceAction): Promise<AutomationResult> {
    switch (action.action) {
      case "notify":
        return this.notifyDevice(action.udid, String(action.params.title ?? "jj-model"), String(action.params.body ?? ""));
      case "run_shortcut":
        return this.runShortcut(action.udid, String(action.params.shortcut), action.params.input as string | undefined);
      case "screenshot":
        return this.screenshotDevice(action.udid);
      case "battery":
        return this.getBattery(action.udid);
      case "location":
        return this.getLocation(action.udid);
      case "open_app":
        return { device: action.udid, action: "open_app", success: false, output: "", error: "use mac_open_app on host", timestamp: start() };
      case "get_clipboard":
      case "set_clipboard":
        return { device: action.udid, action: action.action, success: false, output: "", error: "clipboard sync not yet implemented", timestamp: start() };
      default:
        return { device: action.udid, action: action.action, success: false, output: "", error: `unknown action: ${action.action}`, timestamp: start() };
    }
  }

  getShortcuts(udid: string): Shortcut[] {
    return this.shortcuts.get(udid) ?? [];
  }
}

function start(): number {
  return Date.now();
}

export function createIDeviceAutomation(idevice: IDeviceBridge, weightClass?: string): IDeviceAutomation {
  return new IDeviceAutomation(idevice, weightClass);
}
