# JJ-Model — Install Paths & Build Specification

## Supported Platforms

| Platform | Installer | Arch | Default Install Path | Notes |
|----------|-----------|------|---------------------|-------|
| macOS | `.pkg` | Intel (x86_64) | `/Applications/jj-model.app` | `installer -pkg jj-model.pkg -target /` |
| macOS | `.pkg` | Apple Silicon (arm64/M) | `/Applications/jj-model.app` | `installer -pkg jj-model.pkg -target /` |
| macOS | `.app` (drag) | Universal | `~/Applications/jj-model.app` or `/Applications/jj-model.app` | No admin required for `~/Applications` |
| macOS | Homebrew cask | Intel + M | `/opt/homebrew` (M), `/usr/local` (Intel) | `brew install --cask jj-model` |
| iOS | `.ipa` | arm64 | `/var/containers/Bundle/Application/<UUID>/jj-model.app` | Sandbox; Xcode/sideload only |
| Android | `.apk` | arm64-v8a | `/data/app/<package>-<suffix>/base.apk` | `adb install jj-model.apk` |
| Windows | `.msi` | x64 | `C:\Program Files\jj-model\` | Per-machine (ALLUSERS=1) |
| Windows | `.msi` | x86 | `C:\Program Files (x86)\jj-model\` | Per-machine |
| Windows | `.msi` | any | `%LOCALAPPDATA%\Programs\jj-model\` | Per-user (ALLUSERS="") |

---

## macOS — `.pkg` (Intel & Apple Silicon/M)

### Install locations
- **Machine-wide (admin):** `/Applications/jj-model.app` — requires `sudo`, writable by all users.
- **Per-user (no admin):** `~/Applications/jj-model.app` — `installer -pkg jj-model.pkg -target CurrentUserHomeDirectory`.
- **CLI helper:** `/usr/local/bin/jj-model` (Intel) or `/opt/homebrew/bin/jj-model` (Apple Silicon) if shipped via Homebrew.

### Install command
```bash
# Machine-wide (admin)
sudo installer -pkg /path/to/jj-model.pkg -target /

# Per-user (no admin, Apple Silicon or Intel)
installer -pkg /path/to/jj-model.pkg -target CurrentUserHomeDirectory
```

### Build requirements (macOS)
- Xcode Command Line Tools: `xcode-select --install`
- `productbuild` / `pkgbuild` from Xcode
- Notarization: `xcrun notarytool submit jj-model.pkg --apple-id <email> --team-id <team>`
- Gatekeeper: staple the ticket — `xcrun stapler staple jj-model.pkg`
- Universal binary (Intel + M): build both `x86_64` and `arm64` slices, `lipo -create`
- `tsc` build output: `dist/` — bundle with `pkg` or `nexe` into a single executable before `pkgbuild`

### Data & logs (macOS)
- Logs: `~/Library/Logs/jj-model/jj-model.log`
- Application Support: `~/Library/Application Support/jj-model/`
- Preferences: `~/Library/Preferences/com.jjmodel.plist`
- Cache: `~/Library/Caches/jj-model/`
- iCloud expansion: `~/Library/Mobile Documents/com~apple~CloudDocs/jj-model/expansion-packages`

---

## iOS — `.ipa` (native install)

### Install path (sandboxed)
- **Bundle (read-only, code-signed):** `/var/containers/Bundle/Application/<UUID>/jj-model.app`
- **Data (writable):** `/var/mobile/Containers/Data/Application/<UUID>/`
  - `Documents/` — user documents
  - `Library/` — preferences, caches
  - `tmp/` — temporary files
- **App Group shared:** `/var/mobile/Containers/Shared/<UUID>/`

### Install method
- Xcode device provisioning (Ad Hoc / Development / App Store)
- `ideviceinstaller -i jj-model.ipa` (libimobiledevice, requires paired device)
- Sideload via AltStore / Sideloadly (non-jailbroken)
- LiDAR features require physical iPhone with LiDAR (iPhone 12 Pro / 13 Pro / 14 Pro / 15 Pro / 16 Pro or iPad Pro LiDAR models) via USB

### Build requirements (iOS)
- Xcode 15+, macOS host
- Apple Developer Program membership
- `Info.plist` with `NSBluetoothAlwaysUsageDescription`, `NSBluetoothPeripheralUsageDescription` for cross-device
- `arm64` architecture only
- Code sign with valid provisioning profile

---

## Android — `.apk` (native install)

### Install path
- **APK file:** `/data/app/<package>-<random-suffix>/base.apk`
- **App data:** `/data/data/com.jjmodel/` (or `/data/user/0/com.jjmodel/`)
- **Native libs:** `/data/app/<package>-<suffix>/lib/arm64-v8a/`

### Install command
```bash
adb install -r jj-model.apk
# Get exact path
adb shell pm path com.jjmodel
```

### Build requirements (Android)
- Android Studio / Gradle
- `arm64-v8a` ABI (Node.js mobile via Termux or React Native bridge)
- Note: JJ-model core is Node.js; Android port requires a Node-on-Android wrapper (Termux:api / chaquark / RN)

---

## Windows — `.msi` / `.exe`

### Install locations
- **64-bit (x64):** `C:\Program Files\jj-model\jj-model.exe`
- **32-bit (x86):** `C:\Program Files (x86)\jj-model\jj-model.exe`
- **Per-user:** `%LOCALAPPDATA%\Programs\jj-model\jj-model.exe`
- **User data:** `%APPDATA%\jj-model\`
- **Logs:** `%LOCALAPPDATA%\jj-model\logs\jj-model.log`

### Build requirements (Windows)
- Node.js v26+ Windows x64 installer
- `pkg` or `nexe` to bundle `dist/` into `jj-model.exe`
- WiX Toolset or Advanced Installer for `.msi`
- `candle.exe` with `-arch x64` for 64-bit MSI
- Code signing certificate (EV recommended) for SmartScreen
- NSIS alternative for `.exe` installer

### Install command
```cmd
msiexec /i jj-model.msi /qn ALLUSERS=1
# Per-user
msiexec /i jj-model.msi /qn ALLUSERS=""
```

---

## Build Pipeline (all platforms)

### Common build step
```bash
# Backend
npm run build        # tsc -> dist/
npm run typecheck    # tsc --noEmit

# Frontend (Vue/Vite)
cd frontend
npm install
npm run build        # -> dist/
```

### Packaging targets
```
macOS:    dist/ -> pkg/nexe bundle -> productbuild -> jj-model-1.0.0-macos.pkg (universal)
iOS:      dist/ -> Xcode native wrapper -> jj-model-1.0.0.ipa
Android:  dist/ -> mobile wrapper -> jj-model-1.0.0.apk
Windows:  dist/ -> nexe exe -> WiX -> jj-model-1.0.0-win64.msi
```

### Log format
Structured NDJSON (one JSON object per line), UTF-8, UTC ISO-8601 timestamps, schema at `src/utils/logger.ts`. Logs written to `logs/jj-model.log` (dev) or platform-specific log dir (production).
