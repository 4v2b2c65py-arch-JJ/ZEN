# Control Tagger — If/Control/Memory Statement Tracking

Scans source files for repeating control flow statements and memory-related operations, tagging them with update tags for analysis.

## Tag Types

| Type | Pattern | Description |
|------|---------|-------------|
| `if` | `if (` | Conditional statements |
| `control` | `for`, `while`, `do` | Loop/control statements |
| `loop` | `forEach`, `map`, `filter` | Iterator loops |
| `condition` | `else if`, `switch`, `case` | Conditional branches |
| `memory` | `memory`, `recall`, `store`, `embed`, `vector` | Memory operations |
| `update` | `update`, `set`, `replace`, `modify`, `patch` | Update operations |

## Usage

```ts
const tagger = createControlTagger("daemond");

const scan = await tagger.scanFile("./src/index.ts", content);
console.log(`${scan.total_statements} statements, ${scan.repeating_count} repeating`);

const repeating = tagger.getRepeatingTags();
const memory = tagger.getMemoryTags();
```

## Stats

- `total_tags` — all tagged statements
- `repeating` — statements seen more than once
- `memory_tags` — memory-related statements
- `scans` — files scanned

Weight class: `daemond`
