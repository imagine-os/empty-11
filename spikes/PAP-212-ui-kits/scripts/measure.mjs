// PAP-212: gzipped bundle cost of Select, Dialog, Menu and Combobox per candidate.
// React, react-dom and the JSX runtime are external: every candidate shares them,
// so the number below is the library's own cost, not React's.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = ['base-ui', 'radix', 'react-aria', 'ark', 'shadcn'];
const COMPONENTS = ['select', 'dialog', 'menu', 'combobox'];
const EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'react-dom/server'];

const kb = (b) => Math.round((b / 1024) * 10) / 10;

async function measure(entries, outfile) {
  const result = await build({
    entryPoints: entries,
    bundle: true,
    format: 'esm',
    minify: true,
    write: false,
    metafile: true,
    external: EXTERNAL,
    jsx: 'automatic',
    target: 'es2022',
    platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
    ...(outfile ? { outfile } : { outdir: join(root, "results", "tmp") }),
  });
  const js = result.outputFiles.find((f) => f.path.endsWith('.js'));
  return { raw: js.contents.byteLength, gzip: gzipSync(js.contents).byteLength, metafile: result.metafile };
}

const out = { issue: 'PAP-212', date: new Date().toISOString().slice(0, 10), note: 'gzipped ESM, minified, react/react-dom external; esbuild', candidates: {} };
mkdirSync(join(root, 'results'), { recursive: true });

for (const c of CANDIDATES) {
  const per = {};
  for (const comp of COMPONENTS) {
    const { raw, gzip } = await measure([join(root, 'src', c, `${comp}.tsx`)], join(root, 'results', `${c}-${comp}.js`));
    per[comp] = { rawBytes: raw, gzipBytes: gzip, gzipKb: kb(gzip) };
  }
  const all = await measure([join(root, 'src', c, 'all.tsx')], join(root, 'results', `${c}-all.js`));
  writeFileSync(join(root, 'results', `${c}-metafile.json`), JSON.stringify(all.metafile, null, 2));
  out.candidates[c] = {
    perComponent: per,
    allFour: { rawBytes: all.raw, gzipBytes: all.gzip, gzipKb: kb(all.gzip) },
    sumOfSeparate: { gzipBytes: Object.values(per).reduce((a, b) => a + b.gzipBytes, 0) },
  };
  console.log(
    `${c.padEnd(11)} all four ${String(kb(all.gzip)).padStart(6)} KB gz  |  ` +
      COMPONENTS.map((comp) => `${comp} ${per[comp].gzipKb}`).join('  '),
  );
}
writeFileSync(join(root, 'results', 'summary.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log('\nwrote results/summary.json');

// A compact, committable digest of the metafiles: the ten heaviest input modules
// per candidate for the all-four bundle. The metafiles themselves are gitignored.
{
  const { readFileSync, existsSync } = await import('node:fs');
  const digest = {};
  for (const c of CANDIDATES) {
    const f = join(root, 'results', `${c}-metafile.json`);
    if (!existsSync(f)) continue;
    const m = JSON.parse(readFileSync(f, 'utf8'));
    const out = Object.values(m.outputs).find((o) => o.entryPoint?.includes('all.tsx'));
    const inputs = Object.entries(out?.inputs ?? {})
      .map(([path, v]) => ({ path: path.replace(/^.*node_modules\//, ''), bytes: v.bytesInOutput }))
      .sort((a, b) => b.bytes - a.bytes);
    digest[c] = {
      moduleCount: inputs.length,
      totalInputBytes: inputs.reduce((a, b) => a + b.bytes, 0),
      topModules: inputs.slice(0, 10),
    };
  }
  writeFileSync(join(root, 'results', 'top-modules.json'), `${JSON.stringify(digest, null, 2)}\n`);
  console.log('wrote results/top-modules.json');
}
