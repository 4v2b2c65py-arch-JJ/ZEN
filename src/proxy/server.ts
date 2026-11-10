import { WebSocketServer, WebSocket } from "ws";
import { ModelProxy, ProxyRequest } from "./index.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/config.js";

export class ProxyServer {
  private wss: WebSocketServer;
  private proxy: ModelProxy;
  private port: number;

  constructor(proxy: ModelProxy, port: number) {
    this.proxy = proxy;
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    logger.info(`Model proxy server listening on ws://0.0.0.0:${port}`);
  }

  private handleConnection(ws: WebSocket): void {
    ws.on("message", async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        const { type } = msg;

        if (type === "route") {
          const request: ProxyRequest = {
            id: msg.id ?? crypto.randomUUID(),
            model: msg.model,
            messages: msg.messages,
            temperature: msg.temperature,
            max_tokens: msg.max_tokens,
            stream: msg.stream,
            tools: msg.tools,
            metadata: msg.metadata,
            timestamp: Date.now(),
            weight_class: "daemond",
          };
          const response = await this.proxy.route(request);
          ws.send(JSON.stringify({ type: "route", request_id: request.id, ...response }));
        } else if (type === "metrics") {
          ws.send(JSON.stringify({ type: "metrics", ...this.proxy.getMetrics() }));
        } else if (type === "health") {
          ws.send(JSON.stringify({ type: "health", ...this.proxy.getHealth() }));
        } else if (type === "add_rule") {
          this.proxy.addRule(msg.rule);
          ws.send(JSON.stringify({ type: "add_rule", ok: true }));
        } else if (type === "clear_cache") {
          this.proxy.clearCache();
          ws.send(JSON.stringify({ type: "clear_cache", ok: true }));
        } else {
          ws.send(JSON.stringify({ type: "error", error: `Unknown message type: ${type}` }));
        }
      } catch (err) {
        logger.error(`Proxy server message error: ${err}`);
        ws.send(JSON.stringify({ type: "error", error: String(err) }));
      }
    });

    ws.on("close", () => {
      // connection closed
    });
  }

  getHealth() {
    return this.proxy.getHealth();
  }

  close(): void {
    this.wss.close();
  }
}

export function createProxyServer(proxy: ModelProxy, port: number): ProxyServer {
  return new ProxyServer(proxy, port);
}
