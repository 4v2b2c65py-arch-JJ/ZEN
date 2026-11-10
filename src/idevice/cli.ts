import { IDeviceBridge } from "./bridge.js";

async function main() {
  const bridge = new IDeviceBridge({
    enabled: true,
    bridge_port: 4444,
    usb_muxd: true,
    auto_connect: true,
    pairing_required: false,
    weight_class: "daemond",
  });

  const available = await bridge.isAvailable();
  if (!available) {
    console.log("libimobiledevice not found. Install: brew install libimobiledevice");
    process.exit(0);
  }

  const devices = await bridge.listDevices();
  console.log(JSON.stringify(devices, null, 2));

  await bridge.startWatch();
  process.on("SIGINT", async () => {
    await bridge.stopWatch();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
