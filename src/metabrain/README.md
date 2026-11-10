# MetaBrain — Brain Data Scans & Metas PAC

Scans vector memory entries for metadata, patterns, and associations. Packages findings into Metas PACs (packages) for brain-like data processing.

## Scan Types

| Type | Description |
|------|-------------|
| `metadata` | Extract word count, char count, keywords, source per memory |
| `pattern` | Semantic pattern clustering via recall search |
| `association` | Cross-reference shared keywords between memories |

## Metas PAC

A PAC bundles multiple scan results into merged insights with a name and description.

## Usage

```ts
const brain = createMetaBrain(memory, "daemond");
const scan = await brain.scanMetadata(["mem-1", "mem-2"]);
const pac = await brain.createPac("Project Review", "Q3 planning insights", [scan.id]);
```

## Tools (registered in BroadSpectrum)

- `metabrain_scan` — run a brain scan
- `metabrain_pac` — create a metas PAC
