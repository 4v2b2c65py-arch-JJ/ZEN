# iDevice Automation — Device Mechanism & Shortcuts

Connects to Apple iOS devices via libimobiledevice and automates actions from device mechanism and shortcuts.

## Supported Actions

| Action | Description |
|--------|-------------|
| `run_shortcut` | Execute a shortcut on the device |
| `list_shortcuts` | List available shortcuts |
| `notify` | Send a notification |
| `screenshot` | Capture device screen |
| `battery` | Get battery level |
| `location` | Get device location |

## Requirements

```bash
brew install libimobiledevice ideviceinstaller
```

## Usage

```ts
const auto = createIDeviceAutomation(idevice, "daemond");
const shortcuts = await auto.listShortcuts(udid);
const result = await auto.runShortcut(udid, "My Shortcut", "input text");
const action = await auto.executeDeviceAction({ udid, action: "battery", params: {} });
```

## Weight Class

Runs under weight class `daemond` for high-priority keep-alive automation.
