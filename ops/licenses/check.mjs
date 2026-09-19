#!/usr/bin/env node
/**
 * PaperOS licence gate (PAP-211, ADR 0027).
 *
 *   node ops/licenses/check.mjs                      # scan, write reports/licenses.json, exit 1 on a violation
 *   node ops/licenses/check.mjs --markdown -         # also print the summary table to stdout
 *   node ops/licenses/check.mjs --sarif reports/licenses.sarif
 *   node ops/licenses/check.mjs --input <dir>        # classify captured pnpm JSON instead of running pnpm
 *   node ops/licenses/check.mjs --policy-only        # validate policy.yaml and waivers.yaml, scan nothing
 *
 * Exit codes: 0 pass (warnings allowed), 1 at least one violation, 2 the check
 * itself could not run (bad policy file, missing install, pnpm failed).
 *
 * Policy: ops/licenses/policy.yaml. Prose: docs/platform/license-policy.md.
 * The Rust half of the same policy is ops/licenses/deny.toml (cargo-deny).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { classify, toMarkdown, toSarif } from './lib/classify.mjs';
import { buildInventory } from './lib/inventory.mjs';
import { loadPolicy } from './lib/policy.mjs';

const HERE = import.meta.dirname;
const DEFAULT_ROOT = resolve(HERE, '..', '..');

export function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    report: null,
    sarif: null,
    markdown: null,
    input: null,
    policyOnly: false,
    reviewWarn: false,
    quiet: false,
    today: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return next;
    };
    if (arg === '--root') options.root = resolve(value());
    else if (arg === '--report' || arg === '--json') options.report = value();
    else if (arg === '--sarif') options.sarif = value();
    else if (arg === '--markdown') options.markdown = value();
    else if (arg === '--input') options.input = resolve(value());
    else if (arg === '--today') options.today = value();
    else if (arg === '--policy-only') options.policyOnly = true;
    else if (arg === '--review-warn') options.reviewWarn = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown option ${arg}`);
  }
  return options;
}

const USAGE = `Usage: node ops/licenses/check.mjs [options]

  --report <path>    where the JSON report goes (default: policy.reportPath)
  --sarif <path>     also write SARIF 2.1.0
  --markdown <path>  also write the summary table ("-" for stdout)
  --input <dir>      read captured pnpm JSON from <dir> instead of running pnpm
  --policy-only      validate policy.yaml and waivers.yaml, scan nothing
  --review-warn      downgrade an unwaived review tier to a warning
  --today <date>     evaluate waiver expiry as of this ISO date
  --quiet            only print on failure
`;

function pnpmJson(root, args) {
  const raw = execFileSync('pnpm', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1' },
  });
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error(`pnpm ${args.join(' ')} produced no JSON`);
  return JSON.parse(raw.slice(start));
}

/** Fast fail rather than scanning stale data (policy edge case: stale lockfile). */
export function lockfileFreshness(root, { stat = statSync, exists = existsSync } = {}) {
  const lock = join(root, 'pnpm-lock.yaml');
  const marker = join(root, 'node_modules', '.modules.yaml');
  if (!exists(lock)) return { ok: false, reason: 'pnpm-lock.yaml is missing' };
  if (!exists(marker))
    return {
      ok: false,
      reason: 'node_modules is missing — run `pnpm install --frozen-lockfile` first',
    };
  if (stat(lock).mtimeMs > stat(marker).mtimeMs + 1000) {
    return {
      ok: false,
      reason:
        'pnpm-lock.yaml changed after the last install — run `pnpm install --frozen-lockfile`',
    };
  }
  return { ok: true, reason: null };
}

function readInput(dir, name) {
  return JSON.parse(readFileSync(join(dir, name), 'utf8'));
}

function write(root, relativePath, body) {
  const target = resolve(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body.endsWith('\n') ? body : `${body}\n`);
  return target;
}

export function run(argv, { log = console.log, error = console.error } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (problem) {
    error(problem.message);
    error(USAGE);
    return 2;
  }
  if (options.help) {
    log(USAGE);
    return 0;
  }

  let policy;
  let exceptions;
  try {
    const loaded = loadPolicy(options.root);
    policy = loaded.policy;
    exceptions = loaded.exceptions;
    if (loaded.errors.length > 0) {
      error('licence policy is invalid:');
      for (const message of loaded.errors) error(`  - ${message}`);
      return 2;
    }
  } catch (problem) {
    error(`could not read the licence policy: ${problem.message}`);
    return 2;
  }
  if (options.reviewWarn) policy = { ...policy, reviewWithoutWaiver: 'warn' };
  if (options.policyOnly) {
    log(
      `licence policy ok: ${policy.tiers.allow.length} allow, ${policy.tiers.review.length} review, ${policy.tiers.deny.length} deny, ${exceptions.length} exceptions`,
    );
    return 0;
  }

  let licensesAll;
  let licensesProd;
  let lsProd;
  if (options.input) {
    try {
      licensesAll = readInput(options.input, 'licenses-all.json');
      licensesProd = readInput(options.input, 'licenses-prod.json');
      lsProd = readInput(options.input, 'ls-prod.json');
    } catch (problem) {
      error(`could not read captured pnpm JSON from ${options.input}: ${problem.message}`);
      return 2;
    }
  } else {
    const freshness = lockfileFreshness(options.root);
    if (!freshness.ok) {
      error(`licence check cannot run: ${freshness.reason}`);
      return 2;
    }
    try {
      licensesAll = pnpmJson(options.root, ['licenses', 'list', '--json']);
      licensesProd = pnpmJson(options.root, ['licenses', 'list', '--json', '--prod']);
      lsProd = pnpmJson(options.root, ['ls', '-r', '--depth', 'Infinity', '--json', '--prod']);
    } catch (problem) {
      error(`pnpm failed: ${problem.message}`);
      return 2;
    }
  }

  const inventory = buildInventory({
    policy,
    root: options.root,
    licensesAll,
    licensesProd,
    lsProd,
    readText: options.input ? () => null : undefined,
  });
  const today = options.today ? new Date(`${options.today}T00:00:00Z`) : new Date();
  const report = classify({ inventory, policy, exceptions, today });
  report.generatedAt = options.today ? `${options.today}T00:00:00.000Z` : new Date().toISOString();

  const reportPath = options.report ?? policy.reportPath ?? 'reports/licenses.json';
  const written = [write(options.root, reportPath, JSON.stringify(report, null, 2))];
  if (options.sarif)
    written.push(write(options.root, options.sarif, JSON.stringify(toSarif(report), null, 2)));
  const markdown = toMarkdown(report);
  if (options.markdown === '-') log(markdown);
  else if (options.markdown) written.push(write(options.root, options.markdown, markdown));

  if (report.status === 'fail') {
    error(
      `licence check FAILED: ${report.counts.violations} violation(s) across ${report.scanned} packages`,
    );
    for (const finding of report.violations) {
      error(
        `  ${finding.package}@${finding.version} [${finding.context}] ${finding.license} → ${finding.tier}: ${finding.reason}`,
      );
    }
    error(`report: ${written[0]}`);
    return 1;
  }
  if (!options.quiet) {
    log(
      `licence check pass: ${report.scanned} packages, ${report.counts.warnings} warning(s), ${report.counts.notices} notice(s) → ${written[0]}`,
    );
    for (const finding of report.warnings) {
      log(
        `  warn ${finding.package}@${finding.version} [${finding.context}] ${finding.license}: ${finding.reason}`,
      );
    }
  }
  return 0;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(HERE, 'check.mjs');
if (invokedDirectly) process.exit(run(process.argv.slice(2)));
