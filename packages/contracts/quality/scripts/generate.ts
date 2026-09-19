// Pure generators shared by the build scripts and the drift tests.
import { z } from 'zod';
import { ArtifactRefSchema } from '../src/artifacts.js';
import { CalibrationCaseSchema, ReviewerOutputSchema } from '../src/calibrate.js';
import { FindingSchema, RubricCoverageSchema } from '../src/finding.js';
import {
  artifactFileName,
  GATE_KIND_INFO,
  GATE_KINDS,
  GATE_REPORT_SCHEMAS,
} from '../src/gates/index.js';
import { GATE_REPORT_VERSION } from '../src/gates/report.js';
import { RUBRICS, type Rubric, RubricSchema, SeverityTaxonomySchema } from '../src/rubrics.js';
import { GATE_STATUS_INFO, GATE_STATUSES, GateStatusNameSchema } from '../src/status.js';

const GENERATED = (source: string) =>
  `<!-- GENERATED from ${source} by packages/contracts/quality/scripts/build-docs.ts. Edit the JSON, then run \`pnpm --filter @paperos/contract-quality build:docs\`. -->`;

export function generateSchemas(): Record<string, unknown> {
  const opts = { target: 'draft-2020-12' as const, io: 'input' as const };
  const gates: Record<string, unknown> = {};
  for (const kind of GATE_KINDS) {
    gates[`${kind}.schema.json`] = {
      $id: `https://paperos.dev/schemas/quality/${kind}.schema.json`,
      title: `GateReport<${kind}>`,
      description: `reports/${artifactFileName(kind)} (${GATE_KIND_INFO[kind].owner}): ${GATE_KIND_INFO[kind].summary}. Envelope version ${GATE_REPORT_VERSION}.`,
      ...z.toJSONSchema(GATE_REPORT_SCHEMAS[kind], opts),
    };
  }
  return {
    ...gates,
    'artifact-ref.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/artifact-ref.schema.json',
      title: 'ArtifactRef',
      ...z.toJSONSchema(ArtifactRefSchema, opts),
    },
    'gate-status.schema.json': {
      $id: 'https://paperos.dev/schemas/quality/gate-status.schema.json',
      title: 'GateStatusName',
      ...z.toJSONSchema(GateStatusNameSchema, opts),
    },
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

export const GATES_BLOCK_START =
  '<!-- GENERATED:artifacts-and-statuses:start (packages/contracts/quality/scripts/generate.ts; edit src/gates/index.ts and src/status.ts, then run `pnpm --filter @paperos/contract-quality build:docs`) -->';
export const GATES_BLOCK_END = '<!-- GENERATED:artifacts-and-statuses:end -->';

/** The two registry tables of docs/quality/gates.md, "Artifacts and statuses". */
export function generateGatesTables(): string {
  const out: string[] = [];
  out.push(GATES_BLOCK_START);
  out.push('');
  out.push(
    `Envelope version ${GATE_REPORT_VERSION}. Every artifact is \`reports/<kind>.json\`; its JSON Schema is \`packages/contracts/quality/schemas/<kind>.schema.json\`.`,
  );
  out.push('');
  out.push('| Kind | File | Producer | Statuses | Consumers | What `data` holds |');
  out.push('|---|---|---|---|---|---|');
  for (const kind of GATE_KINDS) {
    const info = GATE_KIND_INFO[kind];
    const statuses = info.statuses.length
      ? info.statuses.map((s) => `\`${s}\``).join(', ')
      : 'none (informational)';
    out.push(
      `| \`${kind}\` | \`reports/${artifactFileName(kind)}\` | ${info.owner} | ${statuses} | ${info.consumers.join(', ')} | ${cell(info.summary)} |`,
    );
  }
  out.push('');
  out.push('| Status | Gate | Owner | What it means |');
  out.push('|---|---|---|---|');
  for (const status of GATE_STATUSES) {
    const info = GATE_STATUS_INFO[status];
    const gate = info.gate === 'rc' ? 'release candidate' : `Gate ${info.gate}`;
    out.push(`| \`${status}\` | ${gate} | ${info.owner} | ${cell(info.summary)} |`);
  }
  out.push('');
  out.push(GATES_BLOCK_END);
  return out.join('\n');
}

/** Replace the generated block inside the hand-written gates page; the page must exist and carry both markers. */
export function spliceGatesDoc(existing: string): string {
  const start = existing.indexOf(GATES_BLOCK_START);
  const end = existing.indexOf(GATES_BLOCK_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(
      'docs/quality/gates.md must contain the artifacts-and-statuses start and end markers',
    );
  }
  return `${existing.slice(0, start)}${generateGatesTables()}${existing.slice(end + GATES_BLOCK_END.length)}`;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
