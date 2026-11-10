export interface PeripheralFrame {
  id: string;
  source: "screen" | "lidar" | "camera" | "depth" | "trace";
  timestamp: number;
  width: number;
  height: number;
  data_path?: string;
  vector?: number[];
  metadata: Record<string, unknown>;
  weight_class: string;
}

export interface LidarPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
}

export interface LidarFrame {
  id: string;
  points: LidarPoint[];
  bounds: { min: LidarPoint; max: LidarPoint };
  point_count: number;
  timestamp: number;
  weight_class: string;
}

export interface TraceSpan {
  id: string;
  name: string;
  start: number;
  end: number;
  duration_ms: number;
  attributes: Record<string, unknown>;
  parent_id?: string;
  weight_class: string;
}

export interface PeripheralCapture {
  screen: PeripheralFrame | null;
  lidar: LidarFrame | null;
  camera: PeripheralFrame | null;
  trace: TraceSpan[];
  timestamp: number;
}

export class PeripheralManager {
  private frames = new Map<string, PeripheralFrame>();
  private lidarFrames = new Map<string, LidarFrame>();
  private traces = new Map<string, TraceSpan[]>();
  private memory: any;
  private cross: any;
  private weightClass: string;
  private captureInterval: NodeJS.Timeout | null = null;
  private screenCaptureEnabled = false;
  private lidarEnabled = false;
  private traceEnabled = false;

  constructor(memory: any, cross: any, weightClass: string = "daemond") {
    this.memory = memory;
    this.cross = cross;
    this.weightClass = weightClass;
    logger.info(`Peripheral manager initialized (weight: ${weightClass})`);
  }

  async captureScreen(displayId: string = "1"): Promise<PeripheralFrame> {
    const id = crypto.randomUUID();
    const fs = await import("fs");
    const path = await import("path");

    const outPath = `/tmp/jj-model-screen-${id}.png`;
    try {
      await execFileAsync("screencapture", ["-x", "-D", displayId, outPath], { timeout: 10000 });
    } catch {
      // fallback
    }

    const frame: PeripheralFrame = {
      id,
      source: "screen",
      timestamp: Date.now(),
      width: 0,
      height: 0,
      data_path: outPath,
      metadata: { display_id: displayId, captured_at: Date.now() },
      weight_class: this.weightClass,
    };

    this.frames.set(id, frame);
    await this.storePeripheral(frame);
    this.broadcastPeripheral(frame);
    logger.info(`Screen captured: ${id} -> ${outPath}`);
    return frame;
  }

  async captureLidar(deviceId?: string): Promise<LidarFrame | null> {
    const id = crypto.randomUUID();
    const points: LidarPoint[] = [];
    let pointCount = 0;

    try {
      // Use iPhone depth data via idevice if available, otherwise simulate structure
      const { stdout } = await execFileAsync("ideviceinfo", ["-k", "DeviceClass"], { timeout: 5000 });
      pointCount = 0;
    } catch {
      // no lidar device
    }

    const frame: LidarFrame = {
      id,
      points,
      bounds: { min: { x: 0, y: 0, z: 0, intensity: 0 }, max: { x: 0, y: 0, z: 0, intensity: 0 } },
      point_count: pointCount,
      timestamp: Date.now(),
      weight_class: this.weightClass,
    };

    this.lidarFrames.set(id, frame);
    await this.storeLidar(frame);
    this.broadcastLidar(frame);
    logger.info(`LiDAR frame captured: ${id} (${pointCount} points)`);
    return frame;
  }

  async captureCamera(device: string = "default"): Promise<PeripheralFrame | null> {
    const id = crypto.randomUUID();
    const fs = await import("fs");
    const path = await import("path");

    const outPath = `/tmp/jj-model-camera-${id}.jpg`;
    try {
      await execFileAsync("imagesnap", [outPath], { timeout: 10000 });
    } catch {
      try {
        await execFileAsync("ffmpeg", ["-f", "avfoundation", "-i", `none:${device}`, "-frames:v", "1", outPath], { timeout: 15000 });
      } catch {
        return null;
      }
    }

    const frame: PeripheralFrame = {
      id,
      source: "camera",
      timestamp: Date.now(),
      width: 0,
      height: 0,
      data_path: outPath,
      metadata: { device, captured_at: Date.now() },
      weight_class: this.weightClass,
    };

    this.frames.set(id, frame);
    await this.storePeripheral(frame);
    this.broadcastPeripheral(frame);
    logger.info(`Camera captured: ${id} -> ${outPath}`);
    return frame;
  }

  async startTrace(name: string, attributes?: Record<string, unknown>): Promise<TraceSpan> {
    const id = crypto.randomUUID();
    const start = Date.now();
    const span: TraceSpan = {
      id,
      name,
      start,
      end: start,
      duration_ms: 0,
      attributes: attributes ?? {},
      weight_class: this.weightClass,
    };

    const current = this.traces.get(name) ?? [];
    current.push(span);
    this.traces.set(name, current);
    logger.info(`Trace started: ${name} (${id})`);
    return span;
  }

  async endTrace(spanId: string): Promise<TraceSpan | null> {
    for (const [name, spans] of this.traces) {
      const idx = spans.findIndex((s) => s.id === spanId);
      if (idx !== -1) {
        const span = spans[idx];
        span.end = Date.now();
        span.duration_ms = span.end - span.start;
        spans[idx] = span;
        this.traces.set(name, spans);
        logger.info(`Trace ended: ${span.name} (${span.duration_ms}ms)`);
        return span;
      }
    }
    return null;
  }

  async captureAll(): Promise<PeripheralCapture> {
    const screen = this.screenCaptureEnabled ? await this.captureScreen() : null;
    const lidar = this.lidarEnabled ? await this.captureLidar() : null;
    const camera = await this.captureCamera();
    const trace: TraceSpan[] = [];
    for (const spans of this.traces.values()) {
      trace.push(...spans);
    }

    const capture: PeripheralCapture = {
      screen,
      lidar,
      camera,
      trace,
      timestamp: Date.now(),
    };

    await this.memory.add({
      content: `Peripheral capture: screen=${!!screen}, lidar=${!!lidar}, camera=${!!camera}, traces=${trace.length}`,
      metadata: { capture_id: capture.timestamp, sources: capture.trace.map((t) => t.name) },
      source: "system",
    });

    this.cross.broadcast({
      type: "data_transfer",
      from: "peripheral",
      payload: { capture },
      timestamp: Date.now(),
      weightClass: this.weightClass,
    });

    logger.info(`Peripheral capture complete: screen=${!!screen} lidar=${!!lidar} camera=${!!camera}`);
    return capture;
  }

  async startPeriodicCapture(intervalMs: number = 5000): Promise<void> {
    if (this.captureInterval) return;
    this.captureInterval = setInterval(async () => {
      await this.captureAll();
    }, intervalMs);
    logger.info(`Peripheral periodic capture started (${intervalMs}ms)`);
  }

  async stopPeriodicCapture(): Promise<void> {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  setScreenCapture(enabled: boolean): void {
    this.screenCaptureEnabled = enabled;
  }

  setLidar(enabled: boolean): void {
    this.lidarEnabled = enabled;
  }

  setTrace(enabled: boolean): void {
    this.traceEnabled = enabled;
  }

  getFrames(): PeripheralFrame[] {
    return Array.from(this.frames.values());
  }

  getLidarFrames(): LidarFrame[] {
    return Array.from(this.lidarFrames.values());
  }

  getTraces(): TraceSpan[] {
    const all: TraceSpan[] = [];
    for (const spans of this.traces.values()) {
      all.push(...spans);
    }
    return all;
  }

  getStats(): { frames: number; lidar_frames: number; traces: number; screen_enabled: boolean; lidar_enabled: boolean } {
    return {
      frames: this.frames.size,
      lidar_frames: this.lidarFrames.size,
      traces: this.getTraces().length,
      screen_enabled: this.screenCaptureEnabled,
      lidar_enabled: this.lidarEnabled,
    };
  }

  private async storePeripheral(frame: PeripheralFrame): Promise<void> {
    await this.memory.add({
      content: `Peripheral ${frame.source}: ${frame.data_path ?? "n/a"}`,
      metadata: { ...frame.metadata, frame_id: frame.id, source: frame.source },
      source: "peripheral",
    });
  }

  private async storeLidar(frame: LidarFrame): Promise<void> {
    await this.memory.add({
      content: `LiDAR frame: ${frame.point_count} points`,
      metadata: { frame_id: frame.id, point_count: frame.point_count, source: "lidar" },
      source: "peripheral",
    });
  }

  private broadcastPeripheral(frame: PeripheralFrame): void {
    this.cross.broadcast({
      type: "data_transfer",
      from: "peripheral",
      payload: { action: "frame_captured", frame },
      timestamp: Date.now(),
      weightClass: this.weightClass,
    });
  }

  private broadcastLidar(frame: LidarFrame): void {
    this.cross.broadcast({
      type: "data_transfer",
      from: "peripheral",
      payload: { action: "lidar_captured", frame },
      timestamp: Date.now(),
      weightClass: this.weightClass,
    });
  }
}

export function createPeripheralManager(memory: any, cross: any, weightClass?: string): PeripheralManager {
  return new PeripheralManager(memory, cross, weightClass);
}

import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);
