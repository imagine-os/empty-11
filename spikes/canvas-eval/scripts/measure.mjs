// Builds each of the four bench entries with Vite (production mode) and
// reports the gzip size of the JS it ships, in the shape PAP-127's
// interface contract asks for: { canvas: {...}, editor: {...} }.
//
// Usage: node scripts/measure.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;

function build(name) {
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'build', '--config', `vite.${name}.config.js`],
    { cwd: root, stdio: 'inherit' },
  );
}

function gzipKbOfJs(distDir) {
  const dir = join(root, distDir, 'assets');
  let totalRaw = 0;
  let totalGzip = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const buf = readFileSync(join(dir, f));
    totalRaw += statSync(join(dir, f)).size;
    totalGzip += gzipSync(buf, { level: 9 }).length;
  }
  return {
    rawKb: Math.round((totalRaw / 1024) * 10) / 10,
    gzipKb: Math.round((totalGzip / 1024) * 10) / 10,
  };
}

const entries = ['canvas-xyflow', 'canvas-tldraw', 'editor-tiptap', 'editor-blocknote'];
const sizes = {};
for (const name of entries) {
  console.log(`\n=== building ${name} ===`);
  build(name);
  sizes[name] = gzipKbOfJs(`dist/${name}`);
  console.log(name, sizes[name]);
}

const results = {
  measuredAt: new Date().toISOString(),
  method:
    'vite build (production, esbuild minify) of a minimal single-entry app per library; ' +
    'gzip -9 of every emitted .js asset under dist/<entry>/assets. React/react-dom are ' +
    'included in every number, so the four totals are directly comparable to each other. ' +
    'No headless browser was available in this session (network-restricted Playwright ' +
    'Chromium download did not complete), so fps300 and ttfcrMs are not measured here ' +
    'and are left null with a note; see docs/research/canvas-and-editor-libraries.md.',
  canvas: {
    xyflow: {
      lib: '@xyflow/react',
      version: '12.11.6',
      fps300: null,
      gzipKb: sizes['canvas-xyflow'].gzipKb,
    },
    tldraw: {
      lib: 'tldraw',
      version: '5.4.2',
      fps300: null,
      gzipKb: sizes['canvas-tldraw'].gzipKb,
    },
  },
  editor: {
    tiptap: {
      lib: '@tiptap/core + y-prosemirror',
      version: '3.31.3 / 1.3.7',
      ttfcrMs: null,
      gzipKb: sizes['editor-tiptap'].gzipKb,
    },
    blocknote: {
      lib: '@blocknote/react',
      version: '0.54.2',
      ttfcrMs: null,
      gzipKb: sizes['editor-blocknote'].gzipKb,
    },
  },
};

writeFileSync(join(root, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log('\nWrote results.json');
console.log(JSON.stringify(results, null, 2));
