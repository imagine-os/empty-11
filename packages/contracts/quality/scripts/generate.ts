// Pure generators shared by the build scripts and the drift tests.
import { z } from 'zod';
import { CalibrationCaseSchema, ReviewerOutputSchema } from '../src/calibrate.js';
import { FindingSchema, RubricCoverageSchema } from '../src/finding.js';
import { RUBRICS, type Rubric, RubricSchema, SeverityTaxonomySchema } from '../src/rubrics.js';

const GENERATED = (source: string) =>
  `<!-- GENERATED from ${source} by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run \`pnpm --filter @paperos/contract-quality build:docs\`. -->`;

export function generateSchemas(): Record<string, unknown> {
  const opts = { target: 'draft-2020-12' as const, io: 'input' as const };
  return {
    'finding.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/finding.schema.json',
      title: 'Finding',
      ...z.toJSONSchema(FindingSchema, opts),
    },
    'rubric.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/rubric.schema.json',
      title: 'Rubric',
      ...z.toJSONSchema(RubricSchema, opts),
    },
    'severity-taxonomy.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/severity-taxonomy.schema.json',
      title: 'SeverityTaxonomy',
      ...z.toJSONSchema(SeverityTaxonomySchema, opts),
    },
    'rubric-coverage.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/rubric-coverage.schema.json',
      title: 'RubricCoverage',
      ...z.toJSONSchema(RubricCoverageSchema, opts),
    },
    'calibration-case.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/calibration-case.schema.json',
      title: 'CalibrationCase',
      ...z.toJSONSchema(CalibrationCaseSchema, opts),
    },
    'reviewer-output.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/reviewer-output.schema.json',
      title: 'ReviewerOutput',
      ...z.toJSONSchema(ReviewerOutputSchema, opts),
    },
  };
}

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderRubricDoc(r: Rubric): string {
  const out: string[] = [];
  out.push(GENERATED(`packages/contracts/quality/src/rubrics/${r.domain}.json`));
  out.push('');
  out.push(`# ${r.title} rubric (\`RUB-${r.code}-*\`, v${r.version})`);
  out.push('');
  out.push(
    `Applied by: ${r.reviewers.map((x) => `\`${x}\``).join(', ')}. Severity names and the gate rule: [severity.md](./severity.md). Finding shape: [finding.schema.json](./finding.schema.json).`,
  );
  out.push('');
  out.push('## Purpose');
  out.push('');
  out.push(r.purpose);
  out.push('');
  out.push('## Scope');
  out.push('');
  out.push(r.scope);
  if (r.controlsNote) {
    out.push('');
    out.push('## Controls');
    out.push('');
    out.push(r.controlsNote);
  }
  out.push('');
  out.push('## Examples by severity');
  out.push('');
  for (const sev of ['S0', 'S1', 'S2', 'S3'] as const) {
    const list = r.examples[sev];
    if (!list || list.length === 0) continue;
    out.push(`- **${sev}**`);
    for (const e of list) out.push(`  - ${e}`);
  }
  out.push('');
  out.push('## Checklist');
  out.push('');
  out.push(
    'Each item is a question the reviewer answers with `checked`, `n/a` or `skipped` in `rubricCoverage`, so silence differs from a skipped check. Typical severity is the starting point; the [severity taxonomy](./severity.md) and its caps decide.',
  );
  out.push('');
  const hasControls = r.items.some((i) => i.controls && i.controls.length > 0);
  out.push(
    `| ID | Item | Test | Typical | ${hasControls ? 'Controls | ' : ''}How to verify | False positives |`,
  );
  out.push(`|---|---|---|---|${hasControls ? '---|' : ''}---|---|`);
  for (const i of r.items) {
    const controls = hasControls
      ? `${(i.controls ?? []).map((c) => `\`${c}\``).join(', ') || '—'} | `
      : '';
    out.push(
      `| \`${i.id}\` | ${cell(i.title)} | ${cell(i.test)} | ${i.typicalSeverity} | ${controls}${cell(i.verify)} | ${cell(i.falsePositives)} |`,
    );
  }
  out.push('');
  out.push('## What this rubric does not cover');
  out.push('');
  for (const n of r.notCovered) out.push(`- ${n}`);
  out.push('');
  return out.join('\n');
}

export function generateDocs(): Record<string, string> {
  const docs: Record<string, string> = {};
  for (const r of Object.values(RUBRICS)) docs[`${r.domain}.md`] = renderRubricDoc(r);
  return docs;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
