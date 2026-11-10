# iDevice Bridge — iOS Device Connectivity

Connects jj-model to iPhone/iPad devices via libimobiledevice (usbmuxd).

## Setup

```bash
brew install libimobiledevice
```

## Commands

```bash
# List connected iOS devices
npx tsx src/idevice/cli.ts

# Daemon bridge runs on port 4444 (see config/daemon/daemon.json)
```

## Weight class

The iDevice bridge runs under weight class `daemond` with high priority to keep the server active for iOS device connections.

## Files

- `src/idevice/bridge.ts` — IDeviceBridge class (list, watch, device info)
- `src/idevice/cli.ts` — CLI entry point
- `config/daemon/daemon.json` — daemon + idevice configuration
