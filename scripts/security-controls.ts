/**
 * PaperOS security control checker (PAP-219).
 *
 * Validates the three control data files and prints the control list:
 *
 *   node scripts/security-controls.ts --check              # validate all three files, exit 1 on error
 *   node scripts/security-controls.ts --verify lint        # list controls checked by a lint rule
 *   node scripts/security-controls.ts --boundary B5        # list controls on one trust boundary
 *   node scripts/security-controls.ts --summary            # counts by verify mode and boundary
 *
 * Files: ops/security/controls.yaml, ops/security/agent-deny.yaml, ops/security/headers.json.
 * Contract: docs/security/threat-model.md sections 1 and 14, docs/security/hardening-baseline.md.
 *
 * Dependency-free on purpose: this must run before any install, in a hook and in Gate 1, so it
 * reads the deliberately small YAML subset documented at the top of controls.yaml rather than
 * pulling in a parser. When PAP-80 adds the Zod schema it mirrors the same field set.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const VERIFY_MODES = ['lint', 'test', 'scan', 'manual'];
const CHARACTERS = [
  'Atlas',
  'Forge',
  'Iris',
  'Quill',
  'Sentinel',
  'Nova',
  'Ledger',
  'Beacon',
  'Scout',
];
const MIN_CONTROLS = 40;
const MIN_AUTOMATED = 25;

interface Control {
  id: string;
  statement: string;
  boundary: string;
  verify: string;
  cadence: string | null;
  owner: string;
  issues: string[];
  standard: string;
  status: string;
  line: number;
}

const errors: string[] = [];
const fail = (where: string, message: string) => errors.push(`${where}: ${message}`);

function readLines(relative: string): string[] {
  return readFileSync(join(ROOT, relative), 'utf8').split('\n');
}

/** `key: value` on a line, with quotes and a trailing comment stripped. */
function scalar(raw: string): string {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length > 1) return value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'") && value.length > 1) return value.slice(1, -1);
  return value;
}

function flowList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
  return inner
    .split(',')
    .map((part) => scalar(part))
    .filter((part) => part.length > 0);
}

function parseControls(): { boundaries: Set<string>; controls: Control[] } {
  const lines = readLines('ops/security/controls.yaml');
  const boundaries = new Set<string>();
  const controls: Control[] = [];
  let section = '';
  let current: Partial<Control> | null = null;

  const push = () => {
    if (current?.id) controls.push(current as Control);
    current = null;
  };

  lines.forEach((line, index) => {
    if (/^boundaries:\s*$/.test(line)) {
      section = 'boundaries';
      return;
    }
    if (/^controls:\s*$/.test(line)) {
      push();
      section = 'controls';
      return;
    }
    if (section === 'boundaries') {
      const match = /^ {2}(B\d+):/.exec(line);
      if (match) boundaries.add(match[1]);
      return;
    }
    if (section !== 'controls') return;

    const item = /^ {2}- id:\s*(\S+)\s*$/.exec(line);
    if (item) {
      push();
      current = { id: item[1], issues: [], line: index + 1 };
      return;
    }
    if (!current) return;
    const field = /^ {4}([a-z]+):\s*(.*)$/.exec(line);
    if (!field) return;
    const [, key, rest] = field;
    if (key === 'issues') current.issues = flowList(rest);
    else if (key === 'cadence') current.cadence = scalar(rest) === 'null' ? null : scalar(rest);
    else if (key in { statement: 1, boundary: 1, verify: 1, owner: 1, standard: 1, status: 1 })
      (current as Record<string, unknown>)[key] = scalar(rest);
  });
  push();
  return { boundaries, controls };
}

function checkControls(boundaries: Set<string>, controls: Control[]): void {
  const where = 'ops/security/controls.yaml';
  const seen = new Map<string, number>();
  if (controls.length < MIN_CONTROLS)
    fail(where, `${controls.length} controls, at least ${MIN_CONTROLS} required`);
  const automated = controls.filter((c) => c.verify !== 'manual').length;
  if (automated < MIN_AUTOMATED)
    fail(where, `${automated} machine-verifiable controls, at least ${MIN_AUTOMATED} required`);

  for (const control of controls) {
    const at = `${where}:${control.line} ${control.id}`;
    if (!/^SEC-[A-Z]+-\d{2}$/.test(control.id)) fail(at, 'id must be SEC-<AREA>-<nn>');
    if (seen.has(control.id)) fail(at, `duplicate id, first seen on line ${seen.get(control.id)}`);
    seen.set(control.id, control.line);
    if (!control.statement || control.statement.length < 40)
      fail(at, 'statement is missing or too short to be testable');
    else if (!control.statement.endsWith('.'))
      fail(at, 'statement must be a sentence ending in a full stop');
    if (!boundaries.has(control.boundary))
      fail(at, `boundary ${control.boundary} is not in boundaries`);
    if (!VERIFY_MODES.includes(control.verify))
      fail(at, `verify must be one of ${VERIFY_MODES.join('|')}`);
    if (control.verify === 'manual' && !control.cadence)
      fail(at, 'verify: manual requires a cadence');
    if (control.verify !== 'manual' && control.cadence)
      fail(at, `verify: ${control.verify} must not carry a cadence`);
    if (!CHARACTERS.includes(control.owner))
      fail(at, `owner ${control.owner} is not a roster character`);
    if (!control.issues?.length) fail(at, 'issues must name at least the owning issue');
    for (const issue of control.issues ?? [])
      if (!/^PAP-\d+$/.test(issue)) fail(at, `issue key ${issue} is malformed`);
    if (!control.standard) fail(at, 'standard must cite an anchor with a version or date');
    if (!['enforced', 'partial', 'planned'].includes(control.status))
      fail(at, `status ${control.status} is invalid`);
  }
}

/** The deny list: ids unique, S0 rules carry a backstop, exceptions are fully recorded. */
function checkDenyList(): void {
  const where = 'ops/security/agent-deny.yaml';
  const lines = readLines(where);
  const ids = new Set<string>();
  let id = '';
  let severity = '';
  let hasBackstop = false;
  let exceptionMode = '';
  const exceptionKeys = new Set<string>();

  const closeException = () => {
    if (!exceptionMode) return;
    for (const key of ['allow', 'until', 'recordedIn'])
      if (!exceptionKeys.has(key))
        fail(`${where} ${id}`, `exception (mode ${exceptionMode}) is missing ${key}`);
    exceptionMode = '';
    exceptionKeys.clear();
  };
  const closeRule = () => {
    closeException();
    if (id && severity === 'S0' && !hasBackstop)
      fail(`${where} ${id}`, 'S0 rule has no backstop outside the agent');
    id = '';
    severity = '';
    hasBackstop = false;
  };

  for (const line of lines) {
    const rule = /^ {2}- id:\s*(\S+)/.exec(line);
    if (rule) {
      closeRule();
      id = rule[1];
      if (!/^DENY-[A-Z]+-\d{2}$/.test(id)) fail(where, `rule id ${id} must be DENY-<AREA>-<nn>`);
      if (ids.has(id)) fail(where, `duplicate rule id ${id}`);
      ids.add(id);
      continue;
    }
    const sev = /^ {4}severity:\s*(\S+)/.exec(line);
    if (sev) severity = sev[1];
    if (/^ {4}backstop:/.test(line)) hasBackstop = true;
    const mode = /^ {6}- mode:\s*(\S+)/.exec(line);
    if (mode) {
      closeException();
      exceptionMode = mode[1];
      if (!['any', 'build-loop', 'target'].includes(exceptionMode))
        fail(`${where} ${id}`, `exception mode ${exceptionMode} is unknown`);
      continue;
    }
    if (exceptionMode) {
      const key = /^ {8}([a-zA-Z]+):/.exec(line);
      if (key) exceptionKeys.add(key[1]);
    }
  }
  closeRule();
  if (ids.size === 0) fail(where, 'no rules found');
}

/** The header baseline: required headers present, app CSP not relaxed. */
function checkHeaders(): void {
  const where = 'ops/security/headers.json';
  const data = JSON.parse(readFileSync(join(ROOT, where), 'utf8')) as {
    profiles: Record<
      string,
      {
        headers?: Record<string, string | null>;
        csp?: Record<string, string[]>;
        enforced?: boolean;
        inheritsFrom?: string;
      }
    >;
    cors: { allowOrigins: string[]; allowCredentials: boolean };
  };
  const required = ['X-Content-Type-Options', 'Referrer-Policy'];
  /** A profile with `inheritsFrom` only lists its differences; resolve before checking. */
  const headersOf = (profile: {
    headers?: Record<string, string | null>;
    inheritsFrom?: string;
  }) => ({
    ...(profile.inheritsFrom ? data.profiles[profile.inheritsFrom]?.headers : {}),
    ...profile.headers,
  });
  for (const [name, profile] of Object.entries(data.profiles)) {
    const headers = headersOf(profile);
    for (const header of required)
      if (!(header in headers)) fail(`${where} ${name}`, `missing ${header}`);
    if (name === 'app' || name === 'api' || name === 'files') {
      if (profile.headers?.['Strict-Transport-Security'] === undefined)
        fail(`${where} ${name}`, 'missing Strict-Transport-Security');
      const hsts = String(profile.headers?.['Strict-Transport-Security'] ?? '');
      const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
      if (maxAge < 31536000)
        fail(`${where} ${name}`, `HSTS max-age ${maxAge} is below the preload minimum 31536000`);
      if (!hsts.includes('includeSubDomains') || !hsts.includes('preload'))
        fail(`${where} ${name}`, 'HSTS must carry includeSubDomains and preload');
    }
  }
  const app = data.profiles.app;
  const flat = JSON.stringify(app?.csp ?? {});
  for (const banned of ["'unsafe-inline'", "'unsafe-eval'", '"*"', 'https:'])
    if (flat.includes(banned))
      fail(`${where} app`, `app CSP must not contain ${banned} (SEC-CSP-02)`);
  if (!flat.includes("'nonce-{{cspNonce}}'"))
    fail(`${where} app`, 'app CSP script-src must carry the per-response nonce (SEC-CSP-01)');
  if (data.cors.allowCredentials && data.cors.allowOrigins.includes('*'))
    fail(`${where} cors`, 'credentialed CORS must not allow * (SEC-CORS-01)');
}

const args = process.argv.slice(2);
const { boundaries, controls } = parseControls();

if (args.includes('--check') || args.length === 0) {
  checkControls(boundaries, controls);
  checkDenyList();
  checkHeaders();
  if (errors.length > 0) {
    console.error(`security controls: ${errors.length} problem(s)`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  const byMode = VERIFY_MODES.map(
    (mode) => `${mode} ${controls.filter((c) => c.verify === mode).length}`,
  ).join(', ');
  console.log(
    `security controls: ok — ${controls.length} controls (${byMode}) across ${boundaries.size} boundaries`,
  );
}

const verifyIndex = args.indexOf('--verify');
if (verifyIndex >= 0) {
  const mode = args[verifyIndex + 1];
  for (const control of controls.filter((c) => c.verify === mode))
    console.log(
      `${control.id}  ${control.boundary}  ${control.status.padEnd(8)}  ${control.statement}`,
    );
}

const boundaryIndex = args.indexOf('--boundary');
if (boundaryIndex >= 0) {
  const id = args[boundaryIndex + 1];
  for (const control of controls.filter((c) => c.boundary === id))
    console.log(`${control.id}  ${control.verify.padEnd(6)}  ${control.statement}`);
}

if (args.includes('--summary')) {
  for (const boundary of [...boundaries].sort())
    console.log(`${boundary}  ${controls.filter((c) => c.boundary === boundary).length} controls`);
}
