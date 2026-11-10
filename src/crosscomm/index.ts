import { WebSocketServer, WebSocket } from "ws";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { config } from "../config/config.js";

const execFileAsync = promisify(execFile);

export interface CrossPeer {
  id: string;
  ws: WebSocket;
  type: "mac" | "ios" | "jj-model";
  connectedAt: number;
  lastSeen: number;
  capabilities: string[];
  weightClass: string;
}

export interface CrossMessage {
  type: "ping" | "pong" | "memory_sync" | "data_transfer" | "command" | "status";
  from: string;
  to?: string;
  payload: any;
  timestamp: number;
  weightClass: string;
}

export class CrossComm {
  private wss: WebSocketServer;
  private peers = new Map<string, CrossPeer>();
  private memory: VectorMemory;
  private port: number;
  private weightClass: string;

  constructor(memory: VectorMemory, port: number = 4445, weightClass: string = "daemond") {
    this.memory = memory;
    this.port = port;
    this.weightClass = weightClass;
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    logger.info(`Cross-comm server listening on ws://0.0.0.0:${port} (weight: ${weightClass})`);
  }

  private handleConnection(ws: WebSocket): void {
    const peerId = crypto.randomUUID();
    const peer: CrossPeer = {
      id: peerId,
      ws,
      type: "jj-model",
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      capabilities: ["memory_sync", "data_transfer", "command"],
      weightClass: this.weightClass,
    };
    this.peers.set(peerId, peer);
    logger.info(`Cross peer connected: ${peerId} (total: ${this.peers.size})`);

    ws.on("message", (raw: Buffer | string) => {
      try {
        const msg: CrossMessage = JSON.parse(raw.toString());
        peer.lastSeen = Date.now();
        this.handleMessage(peer, msg);
      } catch (err) {
        logger.error(`Cross-comm message parse error: ${err}`);
      }
    });

    ws.on("close", () => {
      this.peers.delete(peerId);
      logger.info(`Cross peer disconnected: ${peerId} (total: ${this.peers.size})`);
    });

    ws.on("error", (err) => {
      logger.error(`Cross peer error ${peerId}: ${err}`);
    });

    this.send(peerId, { type: "pong", from: "server", to: peerId, payload: { connected: true }, timestamp: Date.now(), weightClass: this.weightClass });
  }

  private handleMessage(peer: CrossPeer, msg: CrossMessage): void {
    switch (msg.type) {
      case "ping":
        this.send(peer.id, { type: "pong", from: "server", to: peer.id, payload: {}, timestamp: Date.now(), weightClass: this.weightClass });
        break;
      case "memory_sync": {
        this.syncMemoryToPeer(peer, msg.payload);
        break;
      }
      case "data_transfer": {
        this.transferDataToPeer(peer, msg.payload);
        break;
      }
      case "command": {
        this.executeCrossCommand(peer, msg.payload);
        break;
      }
      case "status": {
        this.send(peer.id, { type: "status", from: "server", to: peer.id, payload: { peers: this.peers.size, memory: this.memory.count() }, timestamp: Date.now(), weightClass: this.weightClass });
        break;
      }
    }
  }

  private async syncMemoryToPeer(peer: CrossPeer, payload: any): Promise<void> {
    const query = payload.query || "";
    const topK = payload.top_k || 5;
    const results = await this.memory.search(query, topK);
    this.send(peer.id, { type: "memory_sync", from: "server", to: peer.id, payload: { results, count: results.length }, timestamp: Date.now(), weightClass: this.weightClass });
  }

  private async transferDataToPeer(peer: CrossPeer, payload: any): Promise<void> {
    const { action, id, content, metadata } = payload;
    if (action === "push" && content) {
      const memoryId = await this.memory.add({ content, metadata: metadata ?? {}, source: "user" });
      this.send(peer.id, { type: "data_transfer", from: "server", to: peer.id, payload: { action, id: memoryId, ok: true }, timestamp: Date.now(), weightClass: this.weightClass });
    } else if (action === "pull" && id) {
      const entry = await this.memory.get(id);
      this.send(peer.id, { type: "data_transfer", from: "server", to: peer.id, payload: { action, id, entry, ok: !!entry }, timestamp: Date.now(), weightClass: this.weightClass });
    }
  }

  private executeCrossCommand(peer: CrossPeer, payload: any): void {
    logger.info(`Cross command from ${peer.id}: ${JSON.stringify(payload)}`);
    this.send(peer.id, { type: "command", from: "server", to: peer.id, payload: { ok: true, echoed: payload }, timestamp: Date.now(), weightClass: this.weightClass });
  }

  send(peerId: string, msg: CrossMessage): void {
    const peer = this.peers.get(peerId);
    if (peer && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(JSON.stringify(msg));
    }
  }

  broadcast(msg: CrossMessage): void {
    for (const [id, peer] of this.peers) {
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({ ...msg, to: id }));
      }
    }
  }

  getPeers(): CrossPeer[] {
    return Array.from(this.peers.values());
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  close(): void {
    this.wss.close();
  }
}

export function createCrossComm(memory: VectorMemory, port: number = 4445, weightClass: string = "daemond"): CrossComm {
  return new CrossComm(memory, port, weightClass);
}
