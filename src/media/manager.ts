import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { CrossComm } from "../crosscomm/index.js";

const execFileAsync = promisify(execFile);

export interface ScreenShareSession {
  id: string;
  display_id: string;
  active: boolean;
  started_at: number;
  output_path?: string;
  weight_class: string;
}

export interface CameraSession {
  id: string;
  device: string;
  active: boolean;
  started_at: number;
  output_path?: string;
  weight_class: string;
}

export class MediaManager {
  private screenSessions = new Map<string, ScreenShareSession>();
  private cameraSessions = new Map<string, CameraSession>();
  private memory: VectorMemory;
  private cross: CrossComm;
  private weightClass: string;

  constructor(memory: VectorMemory, cross: CrossComm, weightClass: string = "daemond") {
    this.memory = memory;
    this.cross = cross;
    this.weightClass = weightClass;
    logger.info(`Media manager initialized (weight: ${weightClass})`);
  }

  async isFFmpegAvailable(): Promise<boolean> {
    try {
      await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async isScreenCaptureAvailable(): Promise<boolean> {
    try {
      await execFileAsync("screencapture", ["-V"], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async startScreenShare(displayId: string = "1", outputPath?: string): Promise<ScreenShareSession> {
    const id = crypto.randomUUID();
    const path = outputPath ?? `/tmp/jj-model-screenshare-${id}.mp4`;
    const session: ScreenShareSession = {
      id,
      display_id: displayId,
      active: true,
      started_at: Date.now(),
      output_path: path,
      weight_class: this.weightClass,
    };
    this.screenSessions.set(id, session);

    const ffmpeg = await this.isFFmpegAvailable();
    if (ffmpeg) {
      // Capture screen via avfoundation (macOS)
      const proc = execFile("ffmpeg", [
        "-f", "avfoundation", "-i", `${displayId}:none`,
        "-r", "30", "-preset", "ultrafast",
        path,
      ]);
      (session as any)._proc = proc;
    } else {
      // Fallback: single screencapture frame loop
      this.startScreenCaptureFallback(session);
    }

    logger.info(`Screen share started: ${id} (display ${displayId}) -> ${path}`);
    return session;
  }

  private startScreenCaptureFallback(session: ScreenShareSession): void {
    setInterval(async () => {
      if (!session.active) return;
      try {
        const framePath = `/tmp/jj-model-frame-${session.id}-${Date.now()}.png`;
        await execFileAsync("screencapture", ["-x", framePath], { timeout: 5000 });
        await this.memory.add({
          content: `Screen capture frame: ${framePath}`,
          metadata: { session_id: session.id, path: framePath },
          source: "system",
        });
      } catch (err) {
        logger.error(`Screen capture fallback error: ${err}`);
      }
    }, 2000);
  }

  async stopScreenShare(sessionId: string): Promise<void> {
    const session = this.screenSessions.get(sessionId);
    if (!session) return;
    session.active = false;
    const proc = (session as any)._proc;
    if (proc) proc.kill();
    this.screenSessions.delete(sessionId);
    logger.info(`Screen share stopped: ${sessionId}`);
  }

  async startCamera(device: string = "default", outputPath?: string): Promise<CameraSession> {
    const id = crypto.randomUUID();
    const path = outputPath ?? `/tmp/jj-model-camera-${id}.mp4`;
    const session: CameraSession = {
      id,
      device,
      active: true,
      started_at: Date.now(),
      output_path: path,
      weight_class: this.weightClass,
    };
    this.cameraSessions.set(id, session);

    const ffmpeg = await this.isFFmpegAvailable();
    if (ffmpeg) {
      const proc = execFile("ffmpeg", [
        "-f", "avfoundation", "-i", `none:${device}`,
        "-r", "30", "-preset", "ultrafast",
        path,
      ]);
      (session as any)._proc = proc;
    } else {
      // Fallback: imagesnap single frame
      try {
        await execFileAsync("imagesnap", [path], { timeout: 10000 });
        logger.info(`Camera snapshot captured: ${path}`);
      } catch {
        logger.info("imagesnap not available; camera capture requires ffmpeg or imagesnap");
      }
    }

    logger.info(`Camera started: ${id} (device ${device}) -> ${path}`);
    return session;
  }

  async stopCamera(sessionId: string): Promise<void> {
    const session = this.cameraSessions.get(sessionId);
    if (!session) return;
    session.active = false;
    const proc = (session as any)._proc;
    if (proc) proc.kill();
    this.cameraSessions.delete(sessionId);
    logger.info(`Camera stopped: ${sessionId}`);
  }

  async listSessions(): Promise<{ screen: ScreenShareSession[]; camera: CameraSession[] }> {
    return {
      screen: Array.from(this.screenSessions.values()),
      camera: Array.from(this.cameraSessions.values()),
    };
  }

  async broadcastScreenFrame(framePath: string): Promise<void> {
    this.cross.broadcast({
      type: "data_transfer",
      from: "media",
      payload: { action: "screen_frame", path: framePath, session_type: "screenshare" },
      timestamp: Date.now(),
      weightClass: this.weightClass,
    });
    await this.memory.add({
      content: `Screen frame broadcast: ${framePath}`,
      metadata: { path: framePath },
      source: "system",
    });
  }

  async broadcastCameraFrame(framePath: string): Promise<void> {
    this.cross.broadcast({
      type: "data_transfer",
      from: "media",
      payload: { action: "camera_frame", path: framePath, session_type: "camera" },
      timestamp: Date.now(),
      weightClass: this.weightClass,
    });
    await this.memory.add({
      content: `Camera frame broadcast: ${framePath}`,
      metadata: { path: framePath },
      source: "system",
    });
  }
}

export function createMediaManager(memory: VectorMemory, cross: CrossComm, weightClass?: string): MediaManager {
  return new MediaManager(memory, cross, weightClass);
}
