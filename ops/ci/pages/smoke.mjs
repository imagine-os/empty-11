#!/usr/bin/env node
// Pages deploy smoke check (PAP-15): serves a built apps/web `dist/` under a
// given base path and confirms index.html and every asset it references
// resolve — the failure mode a wrong `base` in vite.config.ts causes on the
// real Pages URL (assets 404 because they are requested from the site root
// instead of the sub-path).
//
// Usage: node ops/ci/pages/smoke.mjs <dist-dir> <base-path>
//   e.g. node ops/ci/pages/smoke.mjs apps/web/dist /empty-11/

import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const [, , distDirArg, basePathArg] = process.argv;

if (!distDirArg || !basePathArg) {
  console.error('usage: node ops/ci/pages/smoke.mjs <dist-dir> <base-path>');
  process.exit(2);
}

const distDir = path.resolve(distDirArg);
const basePath = basePathArg.endsWith('/') ? basePathArg : `${basePathArg}/`;

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(basePath)) {
    res.writeHead(404).end('not under base path');
    return;
  }
  const relative = url.pathname.slice(basePath.length) || 'index.html';
  const filePath = path.join(distDir, relative);
  if (!(await fileExists(filePath))) {
    res.writeHead(404).end('not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream' });
  res.end(await readFile(filePath));
});

async function main() {
  const indexPath = path.join(distDir, 'index.html');
  if (!(await fileExists(indexPath))) {
    console.error(`no index.html in ${distDir} — did the build run?`);
    process.exit(1);
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  try {
    const indexRes = await fetch(`${origin}${basePath}`);
    if (!indexRes.ok) {
      throw new Error(`GET ${basePath} -> ${indexRes.status}`);
    }
    const html = await indexRes.text();

    // Every same-origin src="" / href="" the built index.html references.
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((ref) => ref.startsWith(basePath));

    if (refs.length === 0) {
      throw new Error(
        `index.html referenced no asset under ${basePath} — base path is likely wrong ` +
          '(assets would 404 on the real Pages URL)',
      );
    }

    for (const ref of refs) {
      const assetRes = await fetch(`${origin}${ref}`);
      if (!assetRes.ok) {
        throw new Error(`GET ${ref} -> ${assetRes.status} (base path: ${basePath})`);
      }
    }

    console.log(
      `ok: ${basePath} served index.html and all ${refs.length} referenced asset(s) under it`,
    );
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error(`smoke failed: ${err.message}`);
  process.exit(1);
});
