import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { WebSocket } from "ws";

const execFileAsync = promisify(execFile);

export interface HotkeyConfig {
  key: string;
  modifiers: string[];
  target_url: string; // WebSocket URL to send keybind events
  weight_class: string;
}

export class GlobalHotkeyListener {
  private config: HotkeyConfig;
  private ws: WebSocket | null = null;
  private running = false;
  private scriptPath: string;

  constructor(config: HotkeyConfig) {
    this.config = config;
    const home = process.env.HOME ?? "/";
    this.scriptPath = `${home}/Library/Application Support/jj-model/hotkey.scpt`;
    logger.info(`Global hotkey listener configured: ${config.modifiers.join("+")}+${config.key}`);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const fs = await import("fs");
    const path = await import("path");
    const dir = path.dirname(this.scriptPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // AppleScript that watches for the hotkey combo and posts to WebSocket via curl
    const script = this.generateHotkeyScript();
    fs.writeFileSync(this.scriptPath, script);

    try {
      await execFileAsync("osascript", [this.scriptPath], { timeout: 5000 });
    } catch {
      // osascript may keep running; that's expected for a listener
    }

    // Connect WebSocket to receive keybind events
    this.ws = new WebSocket(this.config.target_url);
    this.ws.on("open", () => {
      logger.info(`Global hotkey WebSocket connected: ${this.config.target_url}`);
    });
    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "keybind") {
          logger.info(`Hotkey event received: ${msg.key}`);
        }
      } catch {}
    });
    this.ws.on("close", () => {
      this.ws = null;
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    try {
      await execFileAsync("osascript", ["-e", "tell application \"System Events\" to keystroke \"q\" using {command down, control down}"], { timeout: 3000 });
    } catch {}
  }

  private generateHotkeyScript(): string {
    const mods = this.config.modifiers.map((m) => {
      const map: Record<string, string> = { cmd: "command down", alt: "option down", shift: "shift down", ctrl: "control down" };
      return map[m] || m;
    }).join(", ");
    return `
global hotkeyPressed
set hotkeyPressed to false

using terms from application "System Events"
    on key down theKey with modifiers {${mods}}
        set hotkeyPressed to true
        do shell script "curl -s -X POST -H 'Content-Type: application/json' -d '{ \\"type\\": \\"keybind\\", \\"key\\": \\"${this.config.key}\\", \\"modifiers\\": [${this.config.modifiers.map((m) => `"${m}"`).join(", ")}], \\"action\\": \\"thought\\", \\"payload\\": { \\"thought\\": \\"hotkey trigger ${this.config.key}\\" } }' ${this.config.target_url}"
    end key down
end using terms from
`;
  }
}

export function createGlobalHotkeyListener(config: HotkeyConfig): GlobalHotkeyListener {
  return new GlobalHotkeyListener(config);
}
