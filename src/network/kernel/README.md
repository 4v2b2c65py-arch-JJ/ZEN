# Network Kernel Driver Interface

Direct kernel network driver management for iDevice connections. Removes network stubs and routes traffic directly to kernel network drivers.

## Overview

- Bypasses user-space network stubs
- Routes directly to kernel network drivers via `route` / `ifconfig` / `sysctl`
- Manages iDevice network interfaces over Wi-Fi/ethernet
- Supports raw socket communication for direct IP

## Prerequisites

Direct kernel route/interface manipulation requires **root** (`sudo`):

```bash
sudo npx tsx src/network/kernel/cli.ts [udid] [ip] [interface] [gateway]
```

## Commands

```bash
# Enable direct kernel mode (remove network stub)
npx tsx src/network/kernel/cli.ts

# List network interfaces
npx tsx src/network/kernel/cli.ts --list-interfaces

# List kernel routes
npx tsx src/network/kernel/cli.ts --list-routes
```

## Weight class

The network kernel interface runs under weight class `daemond` to keep the server active for iDevice network connections.

## Files

- `src/network/kernel/index.ts` — NetworkKernel + RawSocketNetwork classes
- `src/network/kernel/cli.ts` — CLI entry point for direct kernel routing
