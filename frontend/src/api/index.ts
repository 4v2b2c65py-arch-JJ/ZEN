import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "ws://localhost:3333";
const PROXY_BASE = import.meta.env.VITE_PROXY_BASE || "ws://localhost:3334";

export const api = axios.create({
  baseURL: API_BASE.replace("ws://", "http://").replace("wss://", "https://"),
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jcloud_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private handlers = new Map<string, Array<(data: any) => void>>();
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): void {
    const authUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(authUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit("open", {});
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
        this.emit("message", data);
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    this.ws.onclose = () => {
      this.emit("close", {});
      if (this.reconnectAttempts < this.maxReconnects) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (err) => {
      this.emit("error", err);
    };
  }

  send(type: string, payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload, timestamp: Date.now() }));
    } else {
      console.warn("WebSocket not open");
    }
  }

  on(type: string, handler: (data: any) => void): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: (data: any) => void): void {
    const list = this.handlers.get(type);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  private emit(type: string, data: any): void {
    const list = this.handlers.get(type);
    if (list) list.forEach((h) => h(data));
  }

  close(): void {
    this.ws?.close();
  }
}

export const proxyApi = axios.create({
  baseURL: PROXY_BASE.replace("ws://", "http://").replace("wss://", "https://"),
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

proxyApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("jcloud_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
