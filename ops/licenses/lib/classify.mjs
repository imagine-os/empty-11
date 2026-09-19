/**
 * Apply the licence policy to the inventory and produce the report (PAP-211).
 *
 * Pure: it takes data in and returns data out, so every rule in
 * docs/platform/license-policy.md has a fixture in ops/licenses/__tests__ and
 * nothing has to be proved by running CI.
 *
 * Report shape (the contract PAP-216 and PAP-217 read):
 *   { status, scanned, generatedAt, policy, violations[], warnings[], notices[] }
 * with each finding `{ package, version, license, context, tier, waiver?, reason }`.
 */

import { findException, strictestContext, tierOfExpression } from './policy.mjs';
import { normalizeExpression, rank } from './spdx.mjs';

const CHECK_VERSION = 1;

function effectiveLicense(policy, row) {
  const declared = normalizeExpression(row.declared);
  const detected = row.detected ? normalizeExpression(row.detected) : null;
  if (!detected || detected === declared || policy.textOverField !== true) {
    return { license: declared, mismatch: false, declared, detected };
  }
  return { license: detected, mismatch: true, declared, detected };
}

/**
 * Classify one inventory row. The tier is taken from the stricter of the
 * declared and the detected licence, so a package cannot launder a licence
 * through its manifest (policy section 5).
 */
export function classifyRow(policy, row) {
  const context = strictestContext(policy, row.contexts);
  const { license, mismatch, declared, detected } = effectiveLicense(policy, row);
  const declaredTier = tierOfExpression(policy, declared, context);
  const fileTier = detected ? tierOfExpression(policy, detected, context) : null;
  const fileIsStricter = fileTier !== null && rank(fileTier.tier) > rank(declaredTier.tier);
  const chosen = fileIsStricter ? fileTier : declaredTier;
  // A textual difference only matters when it changes the TIER. A package whose
  // 0BSD text is declared `ISC` is a typo; one whose AGPL text is declared `MIT`
  // is the reason this rule exists.
  const tierMismatch = mismatch && fileTier !== null && fileTier.tier !== declaredTier.tier;
  return {
    package: row.package,
    version: row.version,
    license: fileIsStricter ? detected : license,
    declared,
    declaredTier: declaredTier.tier,
    detected,
    detectedTier: fileTier ? fileTier.tier : null,
    mismatch: tierMismatch,
    textDiffers: mismatch,
    context,
    contexts: [...row.contexts].sort(),
    tier: chosen.tier,
    reason: chosen.reason,
    production: row.production === true,
    homepage: row.homepage ?? null,
    paths: row.paths ?? [],
  };
}

function waiverSummary(entry) {
  return {
    package: entry.package,
    versionRange: entry.versionRange,
    context: entry.context,
    reason: entry.reason,
    adr: entry.adr,
    approvedBy: entry.approvedBy,
    expires: entry.expires,
    from: entry.from ?? null,
  };
}

/**
 * Walk the inventory and split it into violations (build red), warnings (build
 * green, someone reads them) and notices (attribution we owe).
 */
export function classify({ inventory, policy, exceptions = [], today = new Date() }) {
  const violations = [];
  const warnings = [];
  const notices = [];
  const reviewFails = (policy.reviewWithoutWaiver ?? 'fail') === 'fail';

  for (const row of inventory) {
    const finding = classifyRow(policy, row);

    if (finding.mismatch) {
      const message = `LICENSE file says ${finding.detected}, package.json says ${finding.declared} (${finding.declaredTier} tier) — the file wins, so this is judged as ${finding.tier}`;
      const entry = { ...finding, reason: message, kind: 'mismatch' };
      if (policy.mismatchSeverity === 'fail') violations.push(entry);
      else warnings.push(entry);
    }

    if (finding.tier === 'allow') {
      if (finding.production) notices.push(finding);
      continue;
    }

    const match = findException(exceptions, finding, today);
    if (match && !match.expired) {
      const needsJustin = finding.tier === 'deny';
      if (needsJustin && match.exception.approvedBy !== 'Justin') {
        violations.push({
          ...finding,
          kind: 'waiver-approver',
          waiver: waiverSummary(match.exception),
          reason: `${finding.tier} tier in ${finding.context} needs Justin's approval; this exception is approved by ${match.exception.approvedBy}`,
        });
        continue;
      }
      warnings.push({
        ...finding,
        kind: 'waived',
        waiver: waiverSummary(match.exception),
        reason: `${finding.tier} tier waived until ${match.exception.expires}: ${match.exception.reason}`,
      });
      if (finding.production) notices.push(finding);
      continue;
    }

    if (match?.expired) {
      violations.push({
        ...finding,
        kind: 'waiver-expired',
        waiver: waiverSummary(match.exception),
        reason: `waiver expired on ${match.exception.expires}`,
      });
      continue;
    }

    if (finding.tier === 'deny') {
      violations.push({
        ...finding,
        kind: 'denied',
        reason:
          finding.reason ?? `${finding.license} is deny tier in the ${finding.context} context`,
      });
      continue;
    }

    const reviewEntry = {
      ...finding,
      kind: 'review-unwaived',
      reason:
        finding.reason ??
        `${finding.license} is review tier in the ${finding.context} context and no unexpired waiver covers it`,
    };
    if (reviewFails) violations.push(reviewEntry);
    else warnings.push(reviewEntry);
    if (finding.production) notices.push(finding);
  }

  const status = violations.length === 0 ? 'pass' : 'fail';
  return {
    checkVersion: CHECK_VERSION,
    status,
    scanned: inventory.length,
    policy: {
      version: policy.version ?? null,
      issue: policy.issue ?? null,
      adr: policy.adr ?? null,
      doc: policy.doc ?? null,
      reviewWithoutWaiver: policy.reviewWithoutWaiver ?? 'fail',
    },
    counts: {
      violations: violations.length,
      warnings: warnings.length,
      notices: notices.length,
    },
    violations,
    warnings,
    notices: notices
      .map((entry) => ({
        package: entry.package,
        version: entry.version,
        license: entry.license,
        context: entry.context,
        homepage: entry.homepage,
      }))
      .sort((a, b) => a.package.localeCompare(b.package)),
  };
}

/** Minimal SARIF 2.1.0 so the findings land as inline annotations (PAP-80 merges it). */
export function toSarif(report) {
  const results = [...report.violations, ...report.warnings].map((finding) => ({
    ruleId: `license/${finding.kind}`,
    level: report.violations.includes(finding) ? 'error' : 'warning',
    message: {
      text: `${finding.package}@${finding.version} (${finding.license}) in context ${finding.context}: ${finding.reason}`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: 'pnpm-lock.yaml' },
          region: { startLine: 1 },
        },
      },
    ],
  }));
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'paperos-license-check',
            informationUri: 'https://linear.app/paperos/issue/PAP-211',
            version: String(CHECK_VERSION),
            rules: [
              {
                id: 'license/denied',
                shortDescription: { text: 'Dependency licence is deny tier for its usage context' },
              },
              {
                id: 'license/review-unwaived',
                shortDescription: { text: 'Review-tier licence with no unexpired waiver' },
              },
              { id: 'license/waiver-expired', shortDescription: { text: 'Waiver has expired' } },
              {
                id: 'license/waiver-approver',
                shortDescription: { text: 'Deny-tier waiver not approved by Justin' },
              },
              {
                id: 'license/mismatch',
                shortDescription: { text: 'LICENSE file text disagrees with the license field' },
              },
            ],
          },
        },
        results,
      },
    ],
  };
}

/** One-screen summary for the CI job log and the step summary. */
export function toMarkdown(report) {
  const lines = [];
  lines.push(`### Licence check — ${report.status === 'pass' ? 'pass' : 'FAIL'}`);
  lines.push('');
  lines.push(
    `${report.scanned} packages scanned · ${report.counts.violations} violations · ${report.counts.warnings} warnings · ${report.counts.notices} notices`,
  );
  lines.push('');
  const table = (title, rows) => {
    if (rows.length === 0) return;
    lines.push(`#### ${title}`);
    lines.push('');
    lines.push('| Package | Version | Licence | Context | Tier | Why |');
    lines.push('| -- | -- | -- | -- | -- | -- |');
    for (const row of rows) {
      lines.push(
        `| \`${row.package}\` | ${row.version} | ${row.license} | ${row.context} | ${row.tier} | ${row.reason} |`,
      );
    }
    lines.push('');
  };
  table('Violations', report.violations);
  table('Warnings', report.warnings);
  if (report.violations.length === 0 && report.warnings.length === 0) {
    lines.push('Every dependency is allow tier for the context it is used in.');
    lines.push('');
  }
  return lines.join('\n');
}
