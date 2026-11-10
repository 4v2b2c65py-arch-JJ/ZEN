import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

export interface IDevice {
  udid: string;
  name: string;
  product_type: string;
  product_version: string;
  serial: string;
  connected: boolean;
  weight_class: string;
}

export interface IDeviceBridgeConfig {
  enabled: boolean;
  bridge_port: number;
  usb_muxd: boolean;
  auto_connect: boolean;
  pairing_required: boolean;
  weight_class: string;
}

export class IDeviceBridge {
  private config: IDeviceBridgeConfig;
  private devices = new Map<string, IDevice>();
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(config: IDeviceBridgeConfig) {
    this.config = config;
    logger.info(`iDevice bridge initialized (weight: ${config.weight_class}, port: ${config.bridge_port})`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync("idevice_id", ["-l"], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async listDevices(): Promise<IDevice[]> {
    if (!this.config.enabled) return [];

    try {
      const { stdout } = await execFileAsync("idevice_id", ["-l"], { timeout: 10000 });
      const udids = stdout.trim().split("\n").filter(Boolean);
      const devices: IDevice[] = [];

      for (const udid of udids) {
        const device = await this.getDeviceInfo(udid);
        if (device) {
          devices.push(device);
          this.devices.set(udid, device);
        }
      }

      return devices;
    } catch (err) {
      logger.error(`iDevice list failed: ${err}`);
      return [];
    }
  }

  private async getDeviceInfo(udid: string): Promise<IDevice | null> {
    try {
      const [name, product, version, serial] = await Promise.all([
        this.runIdevice("idevice_name", [udid]),
        this.runIdevice("ideviceinfo", ["-u", udid, "-k", "ProductType"]),
        this.runIdevice("ideviceinfo", ["-u", udid, "-k", "ProductVersion"]),
        this.runIdevice("ideviceinfo", ["-u", udid, "-k", "SerialNumber"]),
      ]);

      return {
        udid,
        name: name.trim(),
        product_type: product.trim(),
        product_version: version.trim(),
        serial: serial.trim(),
        connected: true,
        weight_class: this.config.weight_class,
      };
    } catch {
      return null;
    }
  }

  private async runIdevice(cmd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 10000 });
    return stdout;
  }

  async startWatch(): Promise<void> {
    if (this.watchInterval) return;
    this.watchInterval = setInterval(async () => {
      await this.listDevices();
    }, 5000);
    logger.info("iDevice watch started (5s interval)");
  }

  async stopWatch(): Promise<void> {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  getWeightClass(): string {
    return this.config.weight_class;
  }

  getConnectedDevices(): IDevice[] {
    return Array.from(this.devices.values()).filter((d) => d.connected);
  }
}

export function createIDeviceBridge(config: IDeviceBridgeConfig): IDeviceBridge {
  return new IDeviceBridge(config);
}
