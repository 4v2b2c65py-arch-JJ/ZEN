export interface AgentRole {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  weight_class: string;
  system_prompt: string;
  max_concurrent: number;
  priority: number;
}

export interface AgentInstance {
  id: string;
  role_id: string;
  name: string;
  status: "idle" | "busy" | "spawning" | "stopping" | "stopped" | "error";
  spawned_at: number;
  last_active: number;
  task_count: number;
  weight_class: string;
  pid?: number;
}

export interface AgentSpawnRequest {
  role_id: string;
  name?: string;
  weight_class?: string;
  priority?: number;
}

export class AgentRoleRegistry {
  private roles = new Map<string, AgentRole>();
  private weightClass: string;

  constructor(weightClass: string = "daemond") {
    this.weightClass = weightClass;
    this.registerDefaultRoles();
    logger.info(`Agent role registry initialized (weight: ${weightClass})`);
  }

  private registerDefaultRoles(): void {
    this.register({
      id: "coder",
      name: "Coder",
      description: "Writes, edits, and refactors code across the codebase",
      capabilities: ["code_write", "code_edit", "code_refactor", "code_review", "build", "typecheck"],
      weight_class: this.weightClass,
      system_prompt: "You are a skilled software engineer. Write clean, typed, well-documented code. Follow project conventions.",
      max_concurrent: 2,
      priority: 8,
    });
    this.register({
      id: "researcher",
      name: "Researcher",
      description: "Searches codebase, docs, and web for information",
      capabilities: ["code_search", "web_search", "doc_read", "summarize"],
      weight_class: this.weightClass,
      system_prompt: "You are a research assistant. Find and summarize information accurately with citations.",
      max_concurrent: 3,
      priority: 6,
    });
    this.register({
      id: "memory-keeper",
      name: "Memory Keeper",
      description: "Manages recall memory: store, search, organize, prune",
      capabilities: ["memory_store", "memory_recall", "memory_list", "memory_organize", "memory_prune"],
      weight_class: this.weightClass,
      system_prompt: "You manage the agent's long-term recall memory. Store important facts and retrieve relevant context.",
      max_concurrent: 2,
      priority: 7,
    });
    this.register({
      id: "mac-controller",
      name: "mac-controller",
      description: "Controls macOS: notifications, apps, AppleScript, clipboard",
      capabilities: ["mac_notify", "mac_say", "mac_open_app", "mac_applescript", "mac_clipboard"],
      weight_class: this.weightClass,
      system_prompt: "You control the macOS environment via AppleScript and system tools.",
      max_concurrent: 2,
      priority: 7,
    });
    this.register({
      id: "cross-device",
      name: "Cross-Device",
      description: "Manages iOS device connections, shortcuts, sync",
      capabilities: ["idevice_list", "idevice_shortcut", "idevice_notify", "cross_broadcast", "cross_sync"],
      weight_class: this.weightClass,
      system_prompt: "You coordinate across Apple devices (iPhone, iPad, Mac) via libimobiledevice and cross-comm.",
      max_concurrent: 2,
      priority: 6,
    });
    this.register({
      id: "peripheral",
      name: "Peripheral",
      description: "Captures screen, camera, LiDAR, traces",
      capabilities: ["peripheral_screen", "peripheral_camera", "peripheral_lidar", "peripheral_trace"],
      weight_class: this.weightClass,
      system_prompt: "You capture peripheral data from screen, camera, LiDAR, and execution traces.",
      max_concurrent: 1,
      priority: 5,
    });
    this.register({
      id: "shell",
      name: "Shell",
      description: "Runs CLI/zshell/bash commands vectorially",
      capabilities: ["shell_execute", "shell_zsh", "shell_bash", "shell_pipe", "shell_history"],
      weight_class: this.weightClass,
      system_prompt: "You execute shell commands safely and report results with timing and exit codes.",
      max_concurrent: 3,
      priority: 6,
    });
    this.register({
      id: "orchestrator",
      name: "Orchestrator",
      description: "Coordinates other agents, spawns, assigns tasks",
      capabilities: ["agent_spawn", "agent_stop", "agent_list", "task_assign", "workflow_orchestrate"],
      weight_class: this.weightClass,
      system_prompt: "You are the orchestrator agent. You spawn and manage other agents to complete complex tasks.",
      max_concurrent: 1,
      priority: 10,
    });
  }

  register(role: Omit<AgentRole, "id"> & { id?: string }): string {
    const id = role.id ?? crypto.randomUUID();
    const full: AgentRole = { ...role, id, weight_class: this.weightClass };
    this.roles.set(id, full);
    return id;
  }

  get(id: string): AgentRole | undefined {
    return this.roles.get(id);
  }

  list(): AgentRole[] {
    return Array.from(this.roles.values());
  }

  getByName(name: string): AgentRole | undefined {
    return Array.from(this.roles.values()).find((r) => r.name.toLowerCase() === name.toLowerCase());
  }
}

export function createAgentRoleRegistry(weightClass?: string): AgentRoleRegistry {
  return new AgentRoleRegistry(weightClass);
}

import { logger } from "../utils/logger.js";
