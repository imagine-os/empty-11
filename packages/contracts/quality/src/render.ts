// Markdown rendering of a review (PAP-79 "Rendering template").
// Header with counts by severity, findings grouped by severity with file link,
// rubric id and suggestion diff block. Used by PAP-243 postReview and PAP-89.
import {
  countBySeverity,
  effectiveSeverity,
  type Finding,
  gateDecision,
  type RubricCoverage,
  SEVERITIES,
  type Severity,
} from './finding.js';

export interface RenderOptions {
  /** Reviewer or gate name shown in the header. */
  reviewer: string;
  /** Commit reviewed. */
  sha?: string;
  /** Base URL for file links, e.g. `https://github.com/org/repo/blob/<sha>`; omit for plain paths. */
  fileLinkBase?: string;
  coverage?: RubricCoverage;
  /** What the reviewer did not check (Sentinel's report rule). */
  notChecked?: string[];
  now?: Date;
}

const LABEL: Record<Severity, string> = {
  S0: 'S0 blocker',
  S1: 'S1 major',
  S2: 'S2 minor',
  S3: 'S3 nit',
  question: 'Questions',
  praise: 'Praise',
};

function fileRef(f: Finding, base: string | undefined): string {
  if (!f.file) return 'repo-wide';
  const range = f.line
    ? `:${f.line}${f.endLine && f.endLine !== f.line ? `-${f.endLine}` : ''}`
    : '';
  const text = `\`${f.file}${range}\``;
  if (!base) return text;
  const anchor = f.line
    ? `#L${f.line}${f.endLine && f.endLine !== f.line ? `-L${f.endLine}` : ''}`
    : '';
  return `[${text}](${base}/${f.file}${anchor})`;
}

function suggestionBlock(f: Finding): string {
  if (!f.suggestion) return '';
  const lang =
    f.suggestion.startsWith('---') ||
    f.suggestion.startsWith('@@') ||
    f.suggestion.startsWith('diff')
      ? 'diff'
      : 'suggestion';
  return `\n\n\`\`\`${lang}\n${f.suggestion.replace(/\n$/, '')}\n\`\`\``;
}

function renderFinding(f: Finding, opts: RenderOptions): string {
  const lines: string[] = [];
  const waived = f.waiver
    ? ` (waived by ${f.waiver.approvedBy} until ${f.waiver.expires}: ${f.waiver.reason})`
    : '';
  lines.push(`<!-- finding:${f.id} -->`);
  lines.push(
    `- **${f.title}** — ${fileRef(f, opts.fileLinkBase)} · \`${f.rubricId}\` · confidence ${f.confidence.toFixed(2)}${f.autofixable ? ' · autofixable' : ''}${waived}`,
  );
  lines.push(`  ${f.body.trim().split('\n').join('\n  ')}`);
  if (f.evidence.length > 0) {
    lines.push(`  Evidence: ${f.evidence.map((e) => `${e.kind} \`${e.ref}\``).join(', ')}`);
  }
  const suggestion = suggestionBlock(f);
  if (suggestion)
    lines.push(
      suggestion
        .split('\n')
        .map((l) => (l ? `  ${l}` : l))
        .join('\n'),
    );
  return lines.join('\n');
}

/** Render a review as Markdown. Deterministic: same findings, same text. */
export function renderReview(findings: readonly Finding[], opts: RenderOptions): string {
  const now = opts.now;
  const counts = countBySeverity(findings, now);
  const decision = gateDecision(findings, now);
  const out: string[] = [];
  out.push(`## Review: ${opts.reviewer}${opts.sha ? ` @ \`${opts.sha.slice(0, 12)}\`` : ''}`);
  out.push('');
  out.push(
    `**Gate:** ${decision.status === 'pass' ? 'pass' : `fail (${decision.reasons.join('; ')})`}`,
  );
  out.push('');
  out.push('| S0 | S1 | S2 | S3 | question | praise |');
  out.push('|---:|---:|---:|---:|---:|---:|');
  out.push(
    `| ${counts.S0} | ${counts.S1} | ${counts.S2} | ${counts.S3} | ${counts.question} | ${counts.praise} |`,
  );
  if (findings.length === 0) {
    out.push('');
    out.push('No findings.');
  }
  const sorted = [...findings].sort((a, b) => {
    const ra = SEVERITIES.indexOf(effectiveSeverity(a, now));
    const rb = SEVERITIES.indexOf(effectiveSeverity(b, now));
    if (ra !== rb) return ra - rb;
    const fa = `${a.file ?? ''}:${a.line ?? 0}`;
    const fb = `${b.file ?? ''}:${b.line ?? 0}`;
    return fa < fb ? -1 : fa > fb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  for (const sev of SEVERITIES) {
    const group = sorted.filter((f) => effectiveSeverity(f, now) === sev);
    if (group.length === 0) continue;
    out.push('');
    out.push(`### ${LABEL[sev]} (${group.length})`);
    out.push('');
    out.push(group.map((f) => renderFinding(f, opts)).join('\n\n'));
  }
  if (opts.coverage) {
    const entries = Object.entries(opts.coverage).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const checked = entries.filter(([, v]) => v === 'checked').map(([k]) => k);
    const na = entries.filter(([, v]) => v === 'n/a').map(([k]) => k);
    const skipped = entries.filter(([, v]) => v === 'skipped').map(([k]) => k);
    out.push('');
    out.push('<details><summary>Rubric coverage</summary>');
    out.push('');
    out.push(`- checked (${checked.length}): ${checked.join(', ') || 'none'}`);
    out.push(`- n/a (${na.length}): ${na.join(', ') || 'none'}`);
    out.push(`- skipped (${skipped.length}): ${skipped.join(', ') || 'none'}`);
    out.push('');
    out.push('</details>');
  }
  if (opts.notChecked && opts.notChecked.length > 0) {
    out.push('');
    out.push(`**Not checked:** ${opts.notChecked.join('; ')}`);
  }
  out.push('');
  return out.join('\n');
}
