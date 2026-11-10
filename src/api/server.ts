import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { MacIntegration } from "../mac/integration.js";
import { LLMProvider, ChatCompletionRequest, Message, ToolCall } from "../llm/provider.js";
import { TranscriptionPipeline } from "../transcription/pipeline.js";
import { createTranscriber } from "../transcription/transcriber.js";
import { config } from "../config/config.js";

export class APIServer {
  private wss: WebSocketServer;
  private memory: VectorMemory;
  private mac: MacIntegration;
  private llm: LLMProvider;
  private transcription: TranscriptionPipeline;
  private sessions = new Map<string, Message[]>();

  constructor(memory: VectorMemory, mac: MacIntegration, llm: LLMProvider, port: number) {
    this.memory = memory;
    this.mac = mac;
    this.llm = llm;
    const transcriber = createTranscriber({
      provider: config.transcriptionProvider as any,
      model: config.whisperModel,
      apiKey: config.whisperApiKey,
      baseUrl: config.whisperBaseUrl,
      whisperBinary: config.whisperBinary,
      language: config.whisperLanguage,
    });
    this.transcription = new TranscriptionPipeline(memory, transcriber);
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws) => this.handleConnection(ws));
    logger.info(`API server listening on ws://localhost:${port}`);
  }

  private handleConnection(ws: WebSocket): void {
    let sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, []);

    ws.on("message", async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        const response = await this.handleMessage(sessionId, msg);
        ws.send(JSON.stringify(response));
      } catch (err) {
        logger.error(`Message handling error: ${err}`);
        ws.send(JSON.stringify({ type: "error", error: String(err) }));
      }
    });

    ws.on("close", () => {
      this.sessions.delete(sessionId);
    });
  }

  private async handleMessage(sessionId: string, msg: any): Promise<any> {
    const { type } = msg;
    const history = this.sessions.get(sessionId) ?? [];

    switch (type) {
      case "chat": {
        const userMsg: Message = { role: "user", content: msg.content };
        history.push(userMsg);
        await this.memory.add({ content: msg.content, metadata: { sessionId }, source: "user" });

        const recall = await this.memory.search(msg.content);
        const contextMsgs: Message[] = recall.map((m) => ({
          role: "user",
          content: `[RECALL] ${m.content}`,
        }));

        const completion = await this.llm.complete({
          messages: [
            { role: "system", content: "You are a personal assistant with recall memory. Use [RECALL] context when relevant." },
            ...contextMsgs,
            ...history.slice(-10),
          ],
          tools: this.mac.isEnabled() ? [
            { type: "function", function: { name: "mac_notify", description: "Show a macOS notification", parameters: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"] } } },
            { type: "function", function: { name: "mac_say", description: "Speak text aloud on macOS", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
            { type: "function", function: { name: "mac_open_app", description: "Open a macOS application", parameters: { type: "object", properties: { app_name: { type: "string" } }, required: ["app_name"] } } },
            { type: "function", function: { name: "mac_list_apps", description: "List running macOS apps", parameters: { type: "object", properties: {} } } },
            { type: "function", function: { name: "mac_frontmost_app", description: "Get the frontmost macOS app", parameters: { type: "object", properties: {} } } },
          ] : [],
        });

        let finalContent = completion.content;

        if (completion.tool_calls?.length) {
          for (const tc of completion.tool_calls) {
            const result = await this.executeMacTool(tc.name, tc.arguments);
            finalContent += `\n[mac tool ${tc.name}]: ${result.output}`;
            history.push({ role: "tool", tool_call_id: tc.id, content: result.output });
          }
          const followup = await this.llm.complete({
            messages: [
              { role: "system", content: "You are a personal assistant with recall memory." },
              ...history.slice(-10),
            ],
          });
          finalContent = followup.content;
        }

        const assistantMsg: Message = { role: "assistant", content: finalContent };
        history.push(assistantMsg);
        await this.memory.add({ content: finalContent, metadata: { sessionId }, source: "assistant" });
        this.sessions.set(sessionId, history);

        return { type: "chat", content: finalContent, recall_count: recall.length };
      }

      case "memory_search": {
        const results = await this.memory.search(msg.query, msg.top_k);
        return { type: "memory_search", results };
      }

      case "memory_list": {
        const results = await this.memory.list(msg.limit);
        return { type: "memory_list", results };
      }

      case "memory_add": {
        const id = await this.memory.add({ content: msg.content, metadata: msg.metadata ?? {}, source: msg.source ?? "user" });
        return { type: "memory_add", id };
      }

      case "mac_capabilities": {
        return { type: "mac_capabilities", capabilities: await this.mac.capabilities() };
      }

      case "mac_action": {
        const result = await this.executeMacTool(msg.action, msg.args);
        return { type: "mac_action", action: msg.action, ...result };
      }

      case "history": {
        return { type: "history", history };
      }

      case "clear_history": {
        this.sessions.set(sessionId, []);
        return { type: "clear_history", ok: true };
      }

      case "transcribe": {
        const result = await this.transcription.transcribeFile(msg.audio_path, msg.source ?? "user");
        return { type: "transcribe", ...result };
      }

      case "transcribers_available": {
        return { type: "transcribers_available", available: await this.transcription["transcriber"].isAvailable() };
      }

      default:
        return { type: "error", error: `Unknown message type: ${type}` };
    }
  }

  private async executeMacTool(action: string, args: Record<string, unknown>): Promise<{ success: boolean; output: string; error?: string }> {
    switch (action) {
      case "mac_notify":
        return this.mac.notify(String(args.title), String(args.body));
      case "mac_say":
        return this.mac.say(String(args.text));
      case "mac_open_app":
        return this.mac.openApp(String(args.app_name));
      case "mac_list_apps":
        return this.mac.listApps();
      case "mac_frontmost_app":
        return this.mac.getFrontmostApp();
      default:
        return { success: false, output: "", error: `Unknown mac action: ${action}` };
    }
  }

  close(): void {
    this.wss.close();
  }
}
