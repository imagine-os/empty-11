/**
 * Load, validate and apply the licence policy (PAP-211, ADR 0027).
 *
 * `ops/licenses/policy.yaml` is the source of truth; `ops/licenses/waivers.yaml`
 * carries the time-boxed per-package waivers. Both are merged into one list of
 * exceptions with the same schema, so a consumer never has to know which file an
 * exception came from — only that it has an owner, a reason, an ADR and an expiry.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, normalizeExpression, parseExpression } from './spdx.mjs';
import { parseYaml } from './yaml-lite.mjs';

export const CONTEXTS = ['bundled', 'server', 'dev', 'service'];
const REQUIRED_EXCEPTION_FIELDS = [
  'package',
  'versionRange',
  'license',
  'context',
  'reason',
  'adr',
  'approvedBy',
  'expires',
];
const APPROVERS = ['Atlas', 'Justin'];

const list = (value) => (Array.isArray(value) ? value : []);

/** Read both policy files. Returns `{ policy, exceptions, errors }`. */
export function loadPolicy(root, { policyPath = 'ops/licenses/policy.yaml' } = {}) {
  const policy = parseYaml(readFileSync(join(root, policyPath), 'utf8'));
  const errors = validatePolicy(policy);
  const exceptions = list(policy.exceptions).map((entry) => ({ ...entry, from: policyPath }));
  const waiverPath = policy.waiverFile;
  if (waiverPath) {
    let waiverDoc = null;
    try {
      waiverDoc = parseYaml(readFileSync(join(root, waiverPath), 'utf8'));
    } catch (error) {
      errors.push(`${waiverPath}: ${error.message}`);
    }
    if (waiverDoc) {
      for (const entry of list(waiverDoc.waivers)) exceptions.push({ ...entry, from: waiverPath });
    }
  }
  exceptions.forEach((entry, index) => {
    for (const message of validateException(entry, index)) errors.push(message);
  });
  return { policy, exceptions, errors };
}

export function validatePolicy(policy) {
  const errors = [];
  if (policy?.version !== 1) errors.push('policy.yaml: `version` must be 1');
  if (!policy?.tiers) return [...errors, 'policy.yaml: `tiers` is missing'];
  for (const tier of ['allow', 'review', 'deny']) {
    if (list(policy.tiers[tier]).length === 0) errors.push(`policy.yaml: tiers.${tier} is empty`);
  }
  const seen = new Map();
  for (const tier of ['allow', 'review', 'deny']) {
    for (const id of list(policy.tiers[tier])) {
      if (seen.has(id)) errors.push(`policy.yaml: "${id}" is in both ${seen.get(id)} and ${tier}`);
      seen.set(id, tier);
    }
  }
  for (const context of CONTEXTS) {
    if (!policy.contexts?.[context]) errors.push(`policy.yaml: contexts.${context} is missing`);
    if (!policy.contextRules?.[context])
      errors.push(`policy.yaml: contextRules.${context} is missing`);
  }
  for (const context of Object.keys(policy.contextRules ?? {})) {
    if (!CONTEXTS.includes(context)) errors.push(`policy.yaml: unknown context "${context}"`);
  }
  if (!['allow', 'review', 'deny'].includes(policy.unknownTier)) {
    errors.push('policy.yaml: `unknownTier` must be allow, review or deny');
  }
  if (!['allow', 'review', 'deny'].includes(policy.missingTier)) {
    errors.push('policy.yaml: `missingTier` must be allow, review or deny');
  }
  return errors;
}

export function validateException(entry, index) {
  const errors = [];
  const where = `${entry?.from ?? 'exception'}[${index}]`;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry))
    return [`${where}: not a mapping`];
  for (const field of REQUIRED_EXCEPTION_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      errors.push(`${where}: \`${field}\` is required`);
    }
  }
  if (entry.context && !CONTEXTS.includes(entry.context)) {
    errors.push(`${where}: context "${entry.context}" is not one of ${CONTEXTS.join(', ')}`);
  }
  if (entry.approvedBy && !APPROVERS.includes(entry.approvedBy)) {
    errors.push(`${where}: approvedBy must be ${APPROVERS.join(' or ')}`);
  }
  if (entry.expires && !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.expires))) {
    errors.push(`${where}: expires must be an ISO date (YYYY-MM-DD), got "${entry.expires}"`);
  }
  return errors;
}

/** Candidate SPDX ids for one leaf, strictest reading first. */
function candidateIds(node) {
  const ids = [];
  if (node.exception) ids.push(`${node.id} WITH ${node.exception}`);
  if (node.plus) ids.push(`${node.id}-or-later`);
  ids.push(node.id);
  if (/^(AGPL|LGPL|GPL)-\d+(\.\d+)?$/.test(node.id)) {
    ids.push(`${node.id}-or-later`, `${node.id}-only`);
  }
  return [...new Set(ids)];
}

function inList(values, ids) {
  return list(values).some((value) => ids.includes(value));
}

/**
 * Tier of a single licence leaf in one context. Order is fixed and explicit:
 * a deny exception, then the context's `deny`, `denyFamilies`, `review` and
 * `allow`, then the global tiers, then `missingTier` / `unknownTier`.
 * Nothing is inferred: an id nobody tiered is `unknownTier`, never a pass.
 */
export function leafTier(policy, node, context) {
  const ids = candidateIds(node);
  if (node.exception && list(policy.denyExceptions).includes(node.exception)) return 'deny';
  const rules = policy.contextRules?.[context] ?? {};
  if (inList(rules.deny, ids)) return 'deny';
  if (list(rules.denyFamilies).some((prefix) => ids.some((id) => id.startsWith(prefix))))
    return 'deny';
  if (inList(rules.review, ids)) return 'review';
  if (inList(rules.allow, ids)) return 'allow';
  if (inList(policy.tiers?.deny, ids)) return 'deny';
  if (inList(policy.tiers?.review, ids)) return 'review';
  if (inList(policy.tiers?.allow, ids)) return 'allow';
  if (node.id === 'NONE') return policy.missingTier ?? 'deny';
  return policy.unknownTier ?? 'deny';
}

/**
 * Tier of a whole SPDX expression in one context. A malformed expression is
 * `unknownTier` with the parse error as the reason — it never falls through to
 * a pass.
 */
export function tierOfExpression(policy, expression, context) {
  const normalized = normalizeExpression(expression);
  let ast;
  try {
    ast = parseExpression(normalized);
  } catch (error) {
    return { tier: policy.unknownTier ?? 'deny', expression: normalized, reason: error.message };
  }
  const tier = evaluate(ast, (node) => leafTier(policy, node, context));
  return { tier, expression: normalized, ast, reason: null };
}

/** The strictest context a package appears in wins. */
export function strictestContext(policy, contexts) {
  const order = list(policy.contextPrecedence).length ? policy.contextPrecedence : CONTEXTS;
  for (const context of order) if (contexts.includes(context)) return context;
  return contexts[0] ?? 'dev';
}

/** npm-flavoured range matching, limited to the four forms the schema allows. */
export function versionMatches(range, version) {
  const wanted = String(range ?? '*').trim();
  const actual = String(version ?? '').trim();
  if (wanted === '*' || wanted === '') return true;
  if (wanted === actual) return true;
  const parts = (text) => text.split('.').map((part) => Number.parseInt(part, 10));
  if (wanted.includes('*')) {
    const pattern = wanted.split('.');
    const actualParts = actual.split('.');
    return pattern.every((part, index) => part === '*' || part === actualParts[index]);
  }
  if (wanted.startsWith('^') || wanted.startsWith('~')) {
    const [major, minor, patch] = parts(wanted.slice(1));
    const [aMajor, aMinor, aPatch] = parts(actual);
    if ([major, minor, patch, aMajor, aMinor, aPatch].some(Number.isNaN)) return false;
    if (aMajor !== major) return false;
    const caretFloorMinor = wanted.startsWith('^') && major === 0 ? minor : null;
    if (wanted.startsWith('~') || caretFloorMinor !== null) {
      if (aMinor !== minor) return false;
      return aPatch >= patch;
    }
    return aMinor > minor || (aMinor === minor && aPatch >= patch);
  }
  return false;
}

/**
 * The exception that covers a finding, if any. An exception whose `expires` is
 * in the past is returned with `expired: true` — an expired waiver fails the
 * build, it does not quietly stop applying.
 */
export function findException(exceptions, finding, today) {
  const now = today instanceof Date ? today : new Date(`${today}T00:00:00Z`);
  for (const entry of exceptions) {
    if (entry.package !== finding.package) continue;
    if (entry.context !== finding.context) continue;
    if (!versionMatches(entry.versionRange, finding.version)) continue;
    const licenseMatches =
      entry.license === '*' ||
      normalizeExpression(entry.license) === normalizeExpression(finding.license);
    if (!licenseMatches) continue;
    const expires = new Date(`${entry.expires}T23:59:59Z`);
    return { exception: entry, expired: Number.isNaN(expires.getTime()) || expires < now };
  }
  return null;
}
