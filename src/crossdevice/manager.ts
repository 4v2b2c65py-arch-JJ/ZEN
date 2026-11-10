import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { VectorMemory } from "../memory/vector-memory.js";
import { CrossComm } from "../crosscomm/index.js";
import { IDeviceBridge } from "../idevice/bridge.js";

const execFileAsync = promisify(execFile);

export interface AppleDevice {
  udid: string;
  name: string;
  model: string;
  product_type: string;
  product_version: string;
  serial: string;
  connected: boolean;
  connection_type: "usb" | "wifi" | "unknown";
  last_seen: number;
  data: Record<string, any>;
}

export interface CrossDeviceAwareness {
  devices: Map<string, AppleDevice>;
  primaryDevice?: AppleDevice;
  sync_enabled: boolean;
  weight_class: string;
}

export class CrossDeviceManager {
  private devices = new Map<string, AppleDevice>();
  private primaryDevice?: AppleDevice;
  private memory: VectorMemory;
  private cross: CrossComm;
  private idevice: IDeviceBridge;
  private syncInterval: NodeJS.Timeout | null = null;
  private weightClass: string;

  constructor(memory: VectorMemory, cross: CrossComm, idevice: IDeviceBridge, weightClass: string = "daemond") {
    this.memory = memory;
    this.cross = cross;
    this.idevice = idevice;
    this.weightClass = weightClass;
    logger.info(`Cross-device manager initialized (weight: ${weightClass})`);
  }

  async discover(): Promise<AppleDevice[]> {
    const udids = await this.ideviceIsAvailable() ? await this.listUDIDs() : [];
    const devices: AppleDevice[] = [];

    for (const udid of udids) {
      const info = await this.getDeviceInfo(udid);
      if (info) {
        devices.push(info);
        this.devices.set(udid, info);
        await this.storeDeviceAwareness(info);
      }
    }

    if (devices.length > 0 && !this.devices.has(devices[0].udid)) {
      this.primaryDevice = devices[0];
    }

    logger.info(`Cross-device discovery: ${devices.length} Apple device(s) found`);
    return devices;
  }

  async getDeviceInfo(udid: string): Promise<AppleDevice | null> {
    try {
      const [name, model, product, version, serial] = await Promise.all([
        this.runIdevice("idevice_name", [udid]),
        this.runIdevice("ideviceinfo", ["-u", udid, "-k", "DeviceClass"]),
        this.runIdevice("ideviceinfo", ["-u", udid, "-k", "ProductType"]),
        this.runIdevice("ideviceinfo", ["-u", udid, "-k", "ProductVersion"]),
        this.runIdevice("ideviceinfo", ["-u", udid, "-k", "SerialNumber"]),
      ]);

      const device: AppleDevice = {
        udid,
        name: name.trim(),
        model: model.trim(),
        product_type: product.trim(),
        product_version: version.trim(),
        serial: serial.trim(),
        connected: true,
        connection_type: "usb",
        last_seen: Date.now(),
        data: {},
      };

      this.devices.set(udid, device);
      return device;
    } catch (err) {
      logger.error(`Failed to get device info for ${udid}: ${err}`);
      return null;
    }
  }

  async getContacts(udid: string): Promise<any[]> {
    try {
      const { stdout } = await execFileAsync("ideviceinfo", ["-u", udid, "-s"], { timeout: 10000 });
      return [{ source: "ideviceinfo", raw: stdout }];
    } catch (err) {
      logger.error(`Failed to get contacts for ${udid}: ${err}`);
      return [];
    }
  }

  async syncDeviceData(udid: string): Promise<void> {
    const device = this.devices.get(udid);
    if (!device) return;

    const awareness = {
      device: device.udid,
      name: device.name,
      model: device.model,
      product_version: device.product_version,
      connected: device.connected,
      synced_at: Date.now(),
    };

    await this.memory.add({
      content: `Cross-device sync: ${device.name} (${device.model}) ${device.product_version}`,
      metadata: awareness,
      source: "system",
    });

    this.cross.broadcast({
      type: "data_transfer",
      from: "crossdevice",
      payload: { action: "device_sync", device: awareness },
      timestamp: Date.now(),
      weightClass: this.weightClass,
    });

    logger.info(`Cross-device data synced for ${device.name}`);
  }

  async startSync(intervalMs: number = 30000): Promise<void> {
    if (this.syncInterval) return;
    await this.discover();
    this.syncInterval = setInterval(async () => {
      await this.discover();
      for (const [udid] of this.devices) {
        await this.syncDeviceData(udid);
      }
    }, intervalMs);
    logger.info(`Cross-device sync started (${intervalMs}ms)`);
  }

  async stopSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  getDevices(): AppleDevice[] {
    return Array.from(this.devices.values());
  }

  getPrimaryDevice(): AppleDevice | undefined {
    return this.primaryDevice;
  }

  private async ideviceIsAvailable(): Promise<boolean> {
    try {
      await execFileAsync("idevice_id", ["-l"], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private async listUDIDs(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync("idevice_id", ["-l"], { timeout: 10000 });
      return stdout.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  private async runIdevice(cmd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 10000 });
    return stdout;
  }

  private async storeDeviceAwareness(device: AppleDevice): Promise<void> {
    await this.memory.add({
      content: `Apple device discovered: ${device.name} (${device.product_type}) ${device.product_version}`,
      metadata: { udid: device.udid, model: device.model, connection: device.connection_type },
      source: "system",
    });
  }
}

export function createCrossDeviceManager(
  memory: VectorMemory,
  cross: CrossComm,
  idevice: IDeviceBridge,
  weightClass?: string,
): CrossDeviceManager {
  return new CrossDeviceManager(memory, cross, idevice, weightClass);
}
