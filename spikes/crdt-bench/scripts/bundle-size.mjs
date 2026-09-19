#!/usr/bin/env node
// Reproduces the "Bundle size" table in docs/research/crdt-benchmark.md.
// Bundles each bundle-fixtures/*-entry.ts (the minimal real usage of each
// library) with esbuild, minifies, and reports the gzipped size. Output
// bundles are not committed (automerge's is ~4.7MB with WASM inlined as
// base64) — this script regenerates them on demand.
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtures = [
  { name: "yjs", entry: "bundle-fixtures/yjs-entry.ts", wasmLoader: false },
  { name: "loro-crdt", entry: "bundle-fixtures/loro-entry.ts", wasmLoader: false },
  {
    name: "automerge",
    entry: "bundle-fixtures/automerge-entry.ts",
    wasmLoader: true, // plain esbuild otherwise errors on its static `.wasm` import; see the doc's caveat.
  },
];

const dir = mkdtempSync(join(tmpdir(), "crdt-bundle-"));

for (const f of fixtures) {
  const out = join(dir, `${f.name}.js`);
  const args = [
    "esbuild",
    f.entry,
    "--bundle",
    "--minify",
    "--format=esm",
    "--platform=browser",
    `--outfile=${out}`,
  ];
  if (f.wasmLoader) args.push("--loader:.wasm=binary");
  execFileSync("npx", args, { stdio: "inherit" });
  const bytes = readFileSync(out);
  console.log(`${f.name}: ${bytes.length} bytes raw, ${gzipSync(bytes).length} bytes gzip`);
}
