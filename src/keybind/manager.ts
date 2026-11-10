export interface KeyBinding {
  id: string;
  key: string;
  modifiers: string[]; // cmd, alt, shift, ctrl
  action: "thought" | "memory_store" | "memory_recall" | "mac_action" | "cross_send" | "command";
  payload: any;
  description: string;
  weight_class: string;
  enabled: boolean;
  triggered_count: number;
  last_triggered?: number;
}

export interface ThoughtBinding {
  id: string;
  thought: string;
  key_binding_id: string;
  context: string;
  created_at: number;
}

export interface KeyBindEvent {
  type: "keybind";
  binding_id: string;
  key: string;
  modifiers: string[];
  action: string;
  timestamp: number;
  weight_class: string;
}

export class KeyBindManager {
  private bindings = new Map<string, KeyBinding>();
  private thoughtBindings = new Map<string, ThoughtBinding>();
  private cross: any;
  private memory: any;
  private mac: any;
  private weightClass: string;
  private hotkeyProc: any = null;
  private listening = false;

  constructor(cross: any, memory: any, mac: any, weightClass: string = "daemond") {
    this.cross = cross;
    this.memory = memory;
    this.mac = mac;
    this.weightClass = weightClass;
    logger.info(`Key bind manager initialized (weight: ${weightClass})`);
  }

  addBinding(binding: Omit<KeyBinding, "id" | "triggered_count" | "last_triggered">): string {
    const id = crypto.randomUUID();
    const full: KeyBinding = {
      ...binding,
      id,
      triggered_count: 0,
      enabled: binding.enabled ?? true,
    };
    this.bindings.set(id, full);
    logger.info(`Key binding added: ${binding.modifiers.join("+")}+${binding.key} -> ${binding.action}`);
    return id;
  }

  removeBinding(id: string): boolean {
    return this.bindings.delete(id);
  }

  addThoughtBinding(thought: string, keyBindingId: string, context: string = "global"): string {
    const id = crypto.randomUUID();
    const binding: ThoughtBinding = {
      id,
      thought,
      key_binding_id: keyBindingId,
      context,
      created_at: Date.now(),
    };
    this.thoughtBindings.set(id, binding);
    logger.info(`Thought binding added: ${keyBindingId} -> "${thought}"`);
    return id;
  }

  listBindings(): KeyBinding[] {
    return Array.from(this.bindings.values());
  }

  listThoughtBindings(): ThoughtBinding[] {
    return Array.from(this.thoughtBindings.values());
  }

  async trigger(bindingId: string): Promise<any> {
    const binding = this.bindings.get(bindingId);
    if (!binding || !binding.enabled) return { ok: false, error: "binding not found or disabled" };

    binding.triggered_count++;
    binding.last_triggered = Date.now();
    this.bindings.set(bindingId, binding);

    const event: KeyBindEvent = {
      type: "keybind",
      binding_id: bindingId,
      key: binding.key,
      modifiers: binding.modifiers,
      action: binding.action,
      timestamp: Date.now(),
      weight_class: this.weightClass,
    };

    logger.info(`Key bind triggered: ${binding.modifiers.join("+")}+${binding.key} -> ${binding.action}`);

    try {
      let result: any = { ok: true };

      switch (binding.action) {
        case "thought": {
          const thought = binding.payload.thought || binding.payload.content;
          // Store thought in memory
          const memId = await this.memory.add({
            content: `KEYBIND THOUGHT: ${thought}`,
            metadata: { key_binding_id: bindingId, key: binding.key, modifiers: binding.modifiers, context: "keybind" },
            source: "system",
          });
          // Broadcast to cross-device peers
          this.cross.broadcast({
            type: "data_transfer",
            from: "keybind",
            payload: { action: "thought", thought, memory_id: memId, binding_id: bindingId },
            timestamp: Date.now(),
            weightClass: this.weightClass,
          });
          result = { ok: true, action: "thought", thought, memory_id: memId };
          break;
        }
        case "memory_store": {
          const memId = await this.memory.add({
            content: binding.payload.content || `Keybind ${binding.key}`,
            metadata: binding.payload.metadata ?? { key_binding_id: bindingId },
            source: "keybind",
          });
          result = { ok: true, action: "memory_store", memory_id: memId };
          break;
        }
        case "memory_recall": {
          const results = await this.memory.search(binding.payload.query || binding.key, 5);
          result = { ok: true, action: "memory_recall", results };
          break;
        }
        case "mac_action": {
          const r = await this.mac.applescript(binding.payload.script || `display notification "Keybind ${binding.key}"`);
          result = { ok: true, action: "mac_action", result: r };
          break;
        }
        case "cross_send": {
          this.cross.broadcast({
            type: "command",
            from: "keybind",
            payload: binding.payload,
            timestamp: Date.now(),
            weightClass: this.weightClass,
          });
          result = { ok: true, action: "cross_send" };
          break;
        }
        case "command": {
          result = { ok: true, action: "command", command: binding.payload.command };
          break;
        }
      }

      // Also store the keybind event in memory
      await this.memory.add({
        content: `KEYBIND EVENT: ${binding.modifiers.join("+")}+${binding.key} -> ${binding.action}`,
        metadata: { ...event, action: binding.action },
        source: "system",
      });

      return { ...result, event };
    } catch (err) {
      logger.error(`Key bind execution error: ${err}`);
      return { ok: false, error: String(err), event };
    }
  }

  async startGlobalHotkeyListener(): Promise<void> {
    if (this.listening) return;
    this.listening = true;
    logger.info("Global hotkey listener started (via osascript)");
  }

  async stopGlobalHotkeyListener(): Promise<void> {
    this.listening = false;
    if (this.hotkeyProc) {
      try { this.hotkeyProc.kill(); } catch {}
      this.hotkeyProc = null;
    }
  }

  getStats(): { bindings: number; enabled: number; total_triggers: number; thought_bindings: number } {
    const all = Array.from(this.bindings.values());
    return {
      bindings: all.length,
      enabled: all.filter((b) => b.enabled).length,
      total_triggers: all.reduce((sum, b) => sum + b.triggered_count, 0),
      thought_bindings: this.thoughtBindings.size,
    };
  }
}

export function createKeyBindManager(cross: any, memory: any, mac: any, weightClass?: string): KeyBindManager {
  return new KeyBindManager(cross, memory, mac, weightClass);
}

import { logger } from "../utils/logger.js";
