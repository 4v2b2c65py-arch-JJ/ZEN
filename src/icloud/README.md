# iCloud Expansion Package — Personalize iCloud with Model Parameters

Syncs LLM model parameters as expansion packages to iCloud Drive, making them available across all your Apple devices.

## iCloud Path

`~/Library/Mobile Documents/com~apple~CloudDocs/jj-model/expansion-packages`

## Expansion Package

A package captures the full model configuration:
- model name, provider, base URL
- temperature, max_tokens, top_p, penalties
- system prompt, tools enabled, weight class
- checksum, device ID, version

## Commands

```bash
# Check iCloud availability
npx tsx src/icloud/cli.ts

# Generate package from model params (via BroadSpectrum / MCP)
```

## MCP Integration

Add to BroadSpectrum orchestrator tools:
- `icloud_save_package` — save model params as expansion package
- `icloud_list_packages` — list synced packages
- `icloud_apply_package` — apply a package (load parameters)
- `icloud_delete_package` — delete a package

## Usage

```ts
const icloud = createICloudExpansion(memory, "daemond");
const status = await icloud.isAvailable();
if (status.available) {
  const pkg = await icloud.generateExpansionPackageFromModel(
    "Coding Assistant",
    "Optimized for code generation",
    "codellama",
    { temperature: 0.2, max_tokens: 1000, tools_enabled: true },
  );
  const params = await icloud.applyExpansionPackage(pkg.id);
  console.log(params);
}
```

## Requirements

- macOS with iCloud Drive signed in
- `~/Library/Mobile Documents/com~apple~CloudDocs/` accessible
