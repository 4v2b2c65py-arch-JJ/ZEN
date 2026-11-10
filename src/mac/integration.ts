import { logger } from "../utils/logger.js";
import type { MacCapability } from "../types/index.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface MacActionResult {
  success: boolean;
  output: string;
  error?: string;
}

export class MacIntegration {
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async applescript(script: string): Promise<MacActionResult> {
    if (!this.enabled) {
      return { success: false, output: "", error: "Mac automation disabled" };
    }
    try {
      const { execFile } = await import("child_process");
      const { stdout, stderr } = await this.run("osascript", ["-e", script]);
      if (stderr && !stdout) {
        return { success: false, output: "", error: stderr.trim() };
      }
      return { success: true, output: stdout.trim() };
    } catch (err) {
      logger.error(`AppleScript failed: ${err}`);
      return { success: false, output: "", error: String(err) };
    }
  }

  async notify(title: string, body: string): Promise<MacActionResult> {
    return this.applescript(
      `display notification "${body}" with title "${title}"`,
    );
  }

  async say(text: string): Promise<MacActionResult> {
    return this.applescript(`say "${text}"`);
  }

  async getClipboard(): Promise<MacActionResult> {
    return this.applescript("the clipboard of (get info for (file (path to clipboard)))");
  }

  async setClipboard(text: string): Promise<MacActionResult> {
    return this.applescript(`set the clipboard to "${text.replace(/"/g, '\\"')}"`);
  }

  async listApps(): Promise<MacActionResult> {
    return this.applescript("tell application \"System Events\" to name of every process whose background only is false");
  }

  async openApp(appName: string): Promise<MacActionResult> {
    return this.applescript(`tell application "${appName}" to activate`);
  }

  async getFrontmostApp(): Promise<MacActionResult> {
    return this.applescript("tell application \"System Events\" to name of first application process whose frontmost is true");
  }

  async capabilities(): Promise<MacCapability[]> {
    const checks = [
      { name: "AppleScript / osascript", description: "Run AppleScript via osascript", permissions: ["Accessibility", "Automation"] },
      { name: "Notifications", description: "Show macOS notifications", permissions: ["Notifications"] },
      { name: "Clipboard", description: "Read/write clipboard", permissions: ["Accessibility"] },
      { name: "App control", description: "Launch and list apps", permissions: ["Automation", "Accessibility"] },
    ];
    return checks.map((c) => ({ ...c, enabled: this.enabled }));
  }

  private run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync(cmd, args, { timeout: 10000 });
  }
}
