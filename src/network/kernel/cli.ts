import { NetworkKernel, IDeviceNetworkRoute, createNetworkKernel } from "./index.js";

async function main() {
  const kernel = createNetworkKernel(true);

  const available = await kernel.isRoot();
  if (!available) {
    console.log("Running as non-root. Direct kernel network manipulation requires sudo.");
    console.log("Run: sudo npx tsx src/network/kernel/cli.ts");
    process.exit(0);
  }

  await kernel.enableDirectMode();

  const interfaces = await kernel.listInterfaces();
  console.log("Network interfaces:");
  console.log(JSON.stringify(interfaces, null, 2));

  const routes = await kernel.listRoutes();
  console.log("Kernel routes:");
  console.log(JSON.stringify(routes, null, 2));

  const route: IDeviceNetworkRoute = {
    udid: process.argv[2] || "auto",
    ip: process.argv[3] || "172.16.0.1",
    interface: process.argv[4] || "en0",
    gateway: process.argv[5] || "172.16.0.254",
    direct: true,
    weight_class: "daemond",
  };

  await kernel.routeIDevice(route);
  console.log(`Routed iDevice ${route.udid} via ${route.ip} dev ${route.interface}`);

  const active = kernel.getRoutes();
  console.log("Active iDevice routes:");
  console.log(JSON.stringify(active, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
