export interface AgentTask {
  id: string;
  agent_id: string;
  role_id: string;
  description: string;
  input: Record<string, unknown>;
  status: "queued" | "assigned" | "running" | "completed" | "failed" | "cancelled";
  created_at: number;
  started_at?: number;
  completed_at?: number;
  result?: any;
  error?: string;
  weight_class: string;
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

export interface SpawnControlConfig {
  max_agents: number;
  max_per_role: Record<string, number>;
  weight_class: string;
  auto_spawn: boolean;
  spawn_cooldown_ms: number;
}

export interface SpawnEvent {
  id: string;
  agent_id: string;
  role_id: string;
  event: "spawned" | "started" | "completed" | "stopped" | "errored";
  timestamp: number;
  weight_class: string;
}

export class SpawnControl {
  private registry: any;
  private instances = new Map<string, AgentInstance>();
  private tasks = new Map<string, AgentTask>();
  private events = new Map<string, SpawnEvent>();
  private config: SpawnControlConfig;
  private weightClass: string;
  private spawning = new Set<string>();
  private nextTaskId = 0;

  constructor(registry: any, config: SpawnControlConfig, weightClass: string = "daemond") {
    this.registry = registry;
    this.config = config;
    this.weightClass = weightClass;
    logger.info(`Spawn control initialized (max_agents: ${config.max_agents}, weight: ${weightClass})`);
  }

  async spawn(roleId: string, name?: string, priority?: number): Promise<AgentInstance> {
    const role = this.registry.get(roleId);
    if (!role) throw new Error(`Agent role not found: ${roleId}`);

    // Check limits
    const totalAgents = this.instances.size;
    if (totalAgents >= this.config.max_agents) {
      throw new Error(`Max agents reached (${this.config.max_agents})`);
    }

    const roleCount = Array.from(this.instances.values()).filter((i) => i.role_id === roleId).length;
    const roleLimit = this.config.max_per_role[roleId] ?? 2;
    if (roleCount >= roleLimit) {
      throw new Error(`Max agents for role ${roleId} reached (${roleLimit})`);
    }

    if (this.spawning.has(roleId)) {
      throw new Error(`Already spawning role ${roleId}`);
    }

    this.spawning.add(roleId);
    const id = crypto.randomUUID();
    const instance: AgentInstance = {
      id,
      role_id: roleId,
      name: name ?? `${role.name} ${totalAgents + 1}`,
      status: "spawning",
      spawned_at: Date.now(),
      last_active: Date.now(),
      task_count: 0,
      weight_class: this.weightClass,
    };
    this.instances.set(id, instance);

    this.recordEvent(id, roleId, "spawned");

    // Simulate spawn completion
    setTimeout(() => {
      instance.status = "idle";
      instance.last_active = Date.now();
      this.spawning.delete(roleId);
      this.instances.set(id, instance);
      this.recordEvent(id, roleId, "started");
      logger.info(`Agent spawned: ${instance.name} (${role.name})`);
    }, 500);

    return instance;
  }

  async stop(agentId: string): Promise<boolean> {
    const instance = this.instances.get(agentId);
    if (!instance) return false;

    instance.status = "stopping";
    this.instances.set(agentId, instance);

    setTimeout(() => {
      instance.status = "stopped";
      this.instances.set(agentId, instance);
      this.recordEvent(agentId, instance.role_id, "stopped");
      logger.info(`Agent stopped: ${instance.name}`);
    }, 300);

    return true;
  }

  stopAll(): void {
    for (const [id] of this.instances) {
      this.stop(id);
    }
  }

  get(agentId: string): AgentInstance | undefined {
    return this.instances.get(agentId);
  }

  list(): AgentInstance[] {
    return Array.from(this.instances.values());
  }

  listByRole(roleId: string): AgentInstance[] {
    return Array.from(this.instances.values()).filter((i) => i.role_id === roleId);
  }

  getIdle(roleId?: string): AgentInstance[] {
    const agents = roleId ? this.listByRole(roleId) : this.list();
    return agents.filter((a) => a.status === "idle");
  }

  async assignTask(agentId: string, roleId: string, description: string, input: Record<string, unknown>): Promise<AgentTask> {
    const instance = this.instances.get(agentId);
    if (!instance) throw new Error(`Agent not found: ${agentId}`);
    if (instance.status !== "idle") throw new Error(`Agent not idle: ${instance.status}`);

    const taskId = `task-${++this.nextTaskId}`;
    const task: AgentTask = {
      id: taskId,
      agent_id: agentId,
      role_id: roleId,
      description,
      input,
      status: "assigned",
      created_at: Date.now(),
      weight_class: this.weightClass,
    };
    this.tasks.set(taskId, task);

    instance.status = "busy";
    instance.last_active = Date.now();
    instance.task_count++;
    this.instances.set(agentId, instance);

    this.recordEvent(agentId, roleId, "started");

    // Simulate task completion
    setTimeout(() => {
      task.status = "completed";
      task.completed_at = Date.now();
      task.result = { ok: true, description, processed: true };
      this.tasks.set(taskId, task);

      instance.status = "idle";
      instance.last_active = Date.now();
      this.instances.set(agentId, instance);
      this.recordEvent(agentId, roleId, "completed");
      logger.info(`Task completed: ${task.description} by ${instance.name}`);
    }, 1000);

    return task;
  }

  async autoSpawnAndAssign(
    roleName: string,
    description: string,
    input: Record<string, unknown>,
  ): Promise<{ agent: AgentInstance; task: AgentTask }> {
    const role = this.registry.getByName(roleName);
    if (!role) throw new Error(`Role not found: ${roleName}`);

    // Try to find an idle agent of this role
    let agent = this.getIdle(role.id).find((a) => a.status === "idle");
    if (!agent && this.config.auto_spawn) {
      agent = await this.spawn(role.id, undefined, role.priority);
      // Wait briefly for spawn
      await new Promise((r) => setTimeout(r, 600));
      agent = this.get(agent.id)!;
    }

    if (!agent) throw new Error(`No available agent for role ${roleName}`);

    const task = await this.assignTask(agent.id, role.id, description, input);
    return { agent, task };
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  getStats(): {
    agents: number;
    idle: number;
    busy: number;
    spawning: number;
    stopped: number;
    tasks: number;
    completed: number;
    failed: number;
  } {
    const agents = Array.from(this.instances.values());
    const tasks = Array.from(this.tasks.values());
    return {
      agents: agents.length,
      idle: agents.filter((a) => a.status === "idle").length,
      busy: agents.filter((a) => a.status === "busy").length,
      spawning: agents.filter((a) => a.status === "spawning").length,
      stopped: agents.filter((a) => a.status === "stopped").length,
      tasks: tasks.length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    };
  }

  private recordEvent(agentId: string, roleId: string, event: SpawnEvent["event"]): void {
    const id = crypto.randomUUID();
    const spawnEvent: SpawnEvent = {
      id,
      agent_id: agentId,
      role_id: roleId,
      event,
      timestamp: Date.now(),
      weight_class: this.weightClass,
    };
    this.events.set(id, spawnEvent);
  }

  getEvents(agentId?: string): SpawnEvent[] {
    const all = Array.from(this.events.values());
    return agentId ? all.filter((e) => e.agent_id === agentId) : all;
  }

  updateConfig(config: Partial<SpawnControlConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info(`Spawn control config updated`);
  }
}

export function createSpawnControl(registry: any, config: SpawnControlConfig, weightClass?: string): SpawnControl {
  return new SpawnControl(registry, config, weightClass);
}

import { logger } from "../utils/logger.js";
