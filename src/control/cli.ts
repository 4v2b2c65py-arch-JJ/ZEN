#!/usr/bin/env node
import { createControlTagger } from "./tagger.js";
import * as fs from "fs";

async function main() {
  const tagger = createControlTagger("daemond");

  const scans = await tagger.scanDirectory("./src");
  console.log(`Scanned ${scans.length} files`);

  const stats = tagger.getStats();
  console.log("Stats:", JSON.stringify(stats, null, 2));

  const repeating = tagger.getRepeatingTags();
  console.log(`\nRepeating tags (${repeating.length}):`);
  for (const t of repeating) {
    console.log(`  [${t.type}] ${t.tag} x${t.count} in ${t.file}:${t.line}`);
  }

  const memory = tagger.getMemoryTags();
  console.log(`\nMemory tags (${memory.length}):`);
  for (const t of memory) {
    console.log(`  [${t.type}] ${t.tag} in ${t.file}:${t.line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
