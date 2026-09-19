// pnpm --filter @paperos/contract-quality validate <artifact.json> [--kind <kind>] [--json]
// Exit 0 valid; 1 invalid (every issue printed with its path); 2 usage, unreadable file or
// unknown kind. The kind defaults to the file name (`reports/visual.json` -> `visual`), then
// to the document's own `kind`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GATE_KINDS, isGateKind, kindFromFileName } from '../src/gates/index.js';
import { formatIssues, validateArtifact } from '../src/validate.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const kindFlag = args.find((a) => a.startsWith('--kind='))?.slice('--kind='.length);
const kindIdx = args.indexOf('--kind');
const kindArg = kindFlag ?? (kindIdx >= 0 ? args[kindIdx + 1] : undefined);
const file = args.find((a, i) => !a.startsWith('--') && (kindIdx < 0 || i !== kindIdx + 1));

if (!file) {
  console.error('usage: validate <artifact.json> [--kind <kind>] [--json]');
  console.error(`kinds: ${GATE_KINDS.join(', ')}`);
  process.exit(2);
}
if (kindArg !== undefined && !isGateKind(kindArg)) {
  console.error(`unknown kind ${JSON.stringify(kindArg)}; kinds: ${GATE_KINDS.join(', ')}`);
  process.exit(2);
}

let doc: unknown;
try {
  doc = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
} catch (err) {
  console.error(`cannot read ${file}: ${(err as Error).message}`);
  process.exit(2);
}

const kind = kindArg ?? kindFromFileName(file) ?? 'auto';
const result = validateArtifact(kind, doc);
if (json) {
  console.log(JSON.stringify(result.ok ? { ok: true, kind: result.kind } : result, null, 2));
} else if (result.ok) {
  console.log(
    `${file}: valid ${result.kind} artifact (status ${result.report.status}, ${result.report.findings.length} findings)`,
  );
} else {
  console.error(`${file}: invalid ${result.kind ?? 'artifact'}`);
  for (const line of formatIssues(result.issues)) console.error(line);
}
process.exit(result.ok ? 0 : 1);
