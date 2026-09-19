#!/usr/bin/env node
/**
 * `pnpm --filter @paperos/agents tree [--check] [--plain] [--plan <file>] [<roster dir>]` (PAP-284).
 *
 * Prints the org tree of the live roster (`roster.yaml` + `characters/*.yaml`; nine leads with their
 * subs indented, model / effort / mode and budget per node) and diffs its structure against
 * plan.json `agents[]`. `--check` exits 1 when the tree and the plan disagree or the roster has
 * errors; `--plain` prints names only. Exit 2 on a usage or read failure.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AGENTS_PACKAGE_ROOT, validateLiveRoster } from '../src/roster/live.ts';
import { planStructure, readPlanAgents } from '../src/roster/plan.ts';
import { countKinds, diffAgainstPlan, renderTree } from '../src/roster/tree.ts';

const args = process.argv.slice(2);
const check = args.includes('--check');
const plain = args.includes('--plain');
const planIdx = args.indexOf('--plan');
const planPath = resolve(
  planIdx >= 0
    ? (args[planIdx + 1] as string)
    : resolve(AGENTS_PACKAGE_ROOT, 'fixtures/source/plan-agents.json'),
);
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--plan');
const root = resolve(positional[0] ?? AGENTS_PACKAGE_ROOT);

if (!existsSync(root) || !existsSync(planPath)) {
  console.error(`agents tree: ${existsSync(root) ? planPath : root} does not exist`);
  process.exit(2);
}

const plan = readPlanAgents(planPath);
const result = validateLiveRoster(root);
if (!result.roster) {
  for (const f of result.errors)
    console.error(`error ${f.code} [${f.character ?? ''}]: ${f.message}`);
  console.error('agents tree: the roster does not parse');
  process.exit(check ? 1 : 2);
}
console.log(
  renderTree(result.roster, {
    details: !plain,
    order: planStructure(plan).leads.map((l) => l.name),
  }),
);
const { leads, subs } = countKinds(result.roster);
const diff = diffAgainstPlan(result.roster, plan);
console.log('');
if (diff.length === 0) console.log(`tree matches plan.json: ${leads} leads, ${subs} subs`);
else {
  console.log(`tree differs from plan.json (${diff.length}):`);
  for (const d of diff) console.log(`  - ${d}`);
}
if (result.errors.length > 0)
  console.log(`roster has ${result.errors.length} validation errors (run validate)`);
process.exit(check && (diff.length > 0 || result.errors.length > 0) ? 1 : 0);
