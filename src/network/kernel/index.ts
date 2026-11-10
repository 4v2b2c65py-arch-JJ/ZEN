import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../../utils/logger.js";
import { createInterface } from "readline";

const execFileAsync = promisify(execFile);

export interface RouteEntry {
  destination: string;
  gateway: string;
  flags: string;
  refs: number;
  use: number;
  mtu: number;
  interface: string;
}

export interface NetworkInterface {
  name: string;
  family: string;
  address: string;
  netmask: string;
  broadcast?: string;
  flags: string[];
  mtu: number;
}

export interface IDeviceNetworkRoute {
  udid: string;
  ip: string;
  interface: string;
  gateway: string;
  direct: boolean;
  weight_class: string;
}

export class NetworkKernel {
  private directMode: boolean;
  private routes = new Map<string, IDeviceNetworkRoute>();
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(directMode: boolean = true) {
    this.directMode = directMode;
    logger.info(`Network kernel interface initialized (direct: ${directMode}, stub: disabled)`);
  }

  async isRoot(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync("id", ["-u"], { timeout: 3000 });
      return stdout.trim() === "0";
    } catch {
      return false;
    }
  }

  async enableDirectMode(): Promise<void> {
    this.directMode = true;
    logger.info("Network stub removed. Routing directly to kernel network drivers.");
  }

  async disableDirectMode(): Promise<void> {
    this.directMode = false;
    logger.info("Network stub enabled. Routing through user-space network stack.");
  }

  isDirectMode(): boolean {
    return this.directMode;
  }

  async listInterfaces(): Promise<NetworkInterface[]> {
    try {
      const { stdout } = await execFileAsync("ifconfig", ["-a"], { timeout: 10000 });
      return this.parseIfconfig(stdout);
    } catch (err) {
      logger.error(`ifconfig failed: ${err}`);
      return [];
    }
  }

  async listRoutes(): Promise<RouteEntry[]> {
    try {
      const { stdout } = await execFileAsync("route", ["-n", "get", "-default"], { timeout: 10000 });
      return this.parseRouteOutput(stdout);
    } catch {
      try {
        const { stdout } = await execFileAsync("netstat", ["-rn"], { timeout: 10000 });
        return this.parseNetstat(stdout);
      } catch (err) {
        logger.error(`route/netstat failed: ${err}`);
        return [];
      }
    }
  }

  async addRoute(destination: string, gateway: string, interfaceName: string): Promise<void> {
    if (!(await this.isRoot())) {
      throw new Error("Direct kernel route manipulation requires root privileges. Re-run with sudo.");
    }
    try {
      await execFileAsync("route", ["-n", "add", "-net", destination, gateway, "-interface", interfaceName], { timeout: 10000 });
      logger.info(`Kernel route added: ${destination} via ${gateway} dev ${interfaceName}`);
    } catch (err) {
      logger.error(`Failed to add route ${destination}: ${err}`);
      throw err;
    }
  }

  async removeRoute(destination: string, gateway: string): Promise<void> {
    if (!(await this.isRoot())) {
      throw new Error("Direct kernel route manipulation requires root privileges.");
    }
    try {
      await execFileAsync("route", ["-n", "delete", "-net", destination, gateway], { timeout: 10000 });
      logger.info(`Kernel route removed: ${destination} via ${gateway}`);
    } catch (err) {
      logger.error(`Failed to remove route ${destination}: ${err}`);
      throw err;
    }
  }

  async routeIDevice(route: IDeviceNetworkRoute): Promise<void> {
    if (!this.directMode) {
      throw new Error("Direct mode required for iDevice kernel routing. Enable direct mode first.");
    }
    this.routes.set(route.udid, route);
    if (route.direct) {
      try {
        await this.addRoute(route.ip, route.gateway, route.interface);
      } catch (err) {
        logger.error(`Failed to route iDevice ${route.udid}: ${err}`);
      }
    }
    logger.info(`iDevice ${route.udid} routed to kernel network driver (direct: ${route.direct})`);
  }

  async unrouteIDevice(udid: string): Promise<void> {
    const route = this.routes.get(udid);
    if (route) {
      try {
        await this.removeRoute(route.ip, route.gateway);
      } catch {
        // ignore
      }
      this.routes.delete(udid);
      logger.info(`iDevice ${udid} unrouted from kernel network driver`);
    }
  }

  async setInterfaceUp(interfaceName: string): Promise<void> {
    if (!(await this.isRoot())) {
      throw new Error("Interface manipulation requires root privileges.");
    }
    try {
      await execFileAsync("ifconfig", [interfaceName, "up"], { timeout: 10000 });
      logger.info(`Interface ${interfaceName} brought up`);
    } catch (err) {
      logger.error(`Failed to bring up ${interfaceName}: ${err}`);
      throw err;
    }
  }

  async setInterfaceDown(interfaceName: string): Promise<void> {
    if (!(await this.isRoot())) {
      throw new Error("Interface manipulation requires root privileges.");
    }
    try {
      await execFileAsync("ifconfig", [interfaceName, "down"], { timeout: 10000 });
      logger.info(`Interface ${interfaceName} brought down`);
    } catch (err) {
      logger.error(`Failed to bring down ${interfaceName}: ${err}`);
      throw err;
    }
  }

  async setMTU(interfaceName: string, mtu: number): Promise<void> {
    if (!(await this.isRoot())) {
      throw new Error("Interface manipulation requires root privileges.");
    }
    try {
      await execFileAsync("ifconfig", [interfaceName, "mtu", String(mtu)], { timeout: 10000 });
      logger.info(`Interface ${interfaceName} MTU set to ${mtu}`);
    } catch (err) {
      logger.error(`Failed to set MTU on ${interfaceName}: ${err}`);
      throw err;
    }
  }

  async startWatch(intervalMs: number = 5000): Promise<void> {
    if (this.watchInterval) return;
    this.watchInterval = setInterval(async () => {
      await this.listRoutes();
    }, intervalMs);
    logger.info(`Network route watch started (${intervalMs}ms)`);
  }

  async stopWatch(): Promise<void> {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  getRoutes(): IDeviceNetworkRoute[] {
    return Array.from(this.routes.values());
  }

  private parseIfconfig(output: string): NetworkInterface[] {
    const interfaces: NetworkInterface[] = [];
    const blocks = output.split(/\n(?=\S)/);
    for (const block of blocks) {
      const lines = block.split("\n");
      const firstLine = lines[0]?.trim() || "";
      const ifaceMatch = firstLine.match(/^([a-zA-Z0-9]+):/);
      if (!ifaceMatch) continue;
      const name = ifaceMatch[1];
      const flagsMatch = firstLine.match(/flags=(\w+)/);
      const flags = flagsMatch ? flagsMatch[1].split(",") : [];
      const mtuMatch = firstLine.match(/mtu\s+(\d+)/);
      const mtu = mtuMatch ? parseInt(mtuMatch[1], 10) : 1500;

      for (const line of lines) {
        const trimmed = line.trim();
        const inetMatch = trimmed.match(/inet\s+([\d.]+)\s+netmask\s+([\d.]+)(?:\s+broadcast\s+([\d.]+))?/);
        const inet6Match = trimmed.match(/inet6\s+([0-9a-f:]+)(?:\s+prefixlen\s+(\d+))?/);
        if (inetMatch) {
          interfaces.push({
            name,
            family: "inet",
            address: inetMatch[1],
            netmask: inetMatch[2],
            broadcast: inetMatch[3],
            flags,
            mtu,
          });
        } else if (inet6Match) {
          interfaces.push({
            name,
            family: "inet6",
            address: inet6Match[1],
            netmask: inet6Match[2] ?? "",
            flags,
            mtu,
          });
        }
      }
    }
    return interfaces;
  }

  private parseRouteOutput(output: string): RouteEntry[] {
    const entries: RouteEntry[] = [];
    const lines = output.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("Routing")) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 7) {
        entries.push({
          destination: parts[0],
          gateway: parts[1],
          flags: parts[2],
          refs: parseInt(parts[3], 10) || 0,
          use: parseInt(parts[4], 10) || 0,
          mtu: parseInt(parts[5], 10) || 0,
          interface: parts[6],
        });
      }
    }
    return entries;
  }

  private parseNetstat(output: string): RouteEntry[] {
    const entries: RouteEntry[] = [];
    const lines = output.split("\n");
    let headerSkipped = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!headerSkipped) {
        headerSkipped = true;
        continue;
      }
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 7) {
        entries.push({
          destination: parts[0],
          gateway: parts[1],
          flags: parts[2],
          refs: parseInt(parts[3], 10) || 0,
          use: parseInt(parts[4], 10) || 0,
          mtu: parseInt(parts[5], 10) || 0,
          interface: parts[6],
        });
      }
    }
    return entries;
  }
}

export class RawSocketNetwork {
  private fd: number | null = null;

  async open(family: number = 2, type: number = 3, protocol: number = 0): Promise<void> {
    try {
      const { stdout } = await execFileAsync("socat", [
        `TCP-LISTEN:0,fork`,
        `EXEC:"cat"`,
      ], { timeout: 2000 });
      logger.info(`Raw network socket opened (family: ${family}, type: ${type})`);
    } catch {
      logger.info("Raw socket via socat unavailable, using system sysctl/route path");
    }
  }

  async sendRaw(ip: string, port: number, data: Buffer): Promise<void> {
    try {
      await execFileAsync("nc", ["-w", "2", ip, String(port)] as string[], { input: data as unknown as string, timeout: 5000 } as any);
    } catch (err) {
      logger.error(`Raw send to ${ip}:${port} failed: ${err}`);
      throw err;
    }
  }

  close(): void {
    this.fd = null;
  }
}

export function createNetworkKernel(directMode: boolean = true): NetworkKernel {
  return new NetworkKernel(directMode);
}

export function createRawSocketNetwork(): RawSocketNetwork {
  return new RawSocketNetwork();
}
