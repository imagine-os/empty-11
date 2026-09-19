// Machine-readable rubrics (PAP-79). The JSON files under ./rubrics are the source of
// truth; docs/quality/rubrics/<domain>.md is generated from them by scripts/build-docs.ts.
import { z } from 'zod';
import {
  DEFECT_SEVERITIES,
  type DefectSeverity,
  RubricIdSchema,
  SeveritySchema,
} from './finding.js';
import accessibility from './rubrics/accessibility.json' with { type: 'json' };
import agentBehaviour from './rubrics/agent-behaviour.json' with { type: 'json' };
import correctness from './rubrics/correctness.json' with { type: 'json' };
import docsAndChangelog from './rubrics/docs-and-changelog.json' with { type: 'json' };
import performance from './rubrics/performance.json' with { type: 'json' };
import security from './rubrics/security.json' with { type: 'json' };
import severity from './rubrics/severity.json' with { type: 'json' };
import specConformance from './rubrics/spec-conformance.json' with { type: 'json' };
import visual from './rubrics/visual.json' with { type: 'json' };

export const RUBRIC_DOMAINS = [
  'correctness',
  'security',
  'spec-conformance',
  'visual',
  'accessibility',
  'performance',
  'docs-and-changelog',
  'agent-behaviour',
] as const;
export type RubricDomain = (typeof RUBRIC_DOMAINS)[number];

export const RUBRIC_CODES = ['COR', 'SEC', 'SPEC', 'VIS', 'A11Y', 'PERF', 'DOC', 'AGENT'] as const;
export type RubricCode = (typeof RUBRIC_CODES)[number];

export const DOMAIN_CODE: Record<RubricDomain, RubricCode> = {
  correctness: 'COR',
  security: 'SEC',
  'spec-conformance': 'SPEC',
  visual: 'VIS',
  accessibility: 'A11Y',
  performance: 'PERF',
  'docs-and-changelog': 'DOC',
  'agent-behaviour': 'AGENT',
};

export const RubricItemSchema = z
  .object({
    id: RubricIdSchema,
    title: z.string().min(1),
    /** One-line test, phrased "Can I construct an input that...". */
    test: z.string().min(1),
    typicalSeverity: z.enum(DEFECT_SEVERITIES),
    /** How the reviewer verifies it (what to run, read or measure). */
    verify: z.string().min(1),
    /** When this looks like a hit but is not. */
    falsePositives: z.string().min(1),
    /** PAP-219 `SEC-*` control ids this item enforces (security rubric). */
    controls: z.array(z.string().regex(/^SEC-[A-Z]+-\d{2}$/)).optional(),
  })
  .strict();
export type RubricItem = z.infer<typeof RubricItemSchema>;

export const RubricSchema = z
  .object({
    domain: z.enum(RUBRIC_DOMAINS),
    code: z.enum(RUBRIC_CODES),
    version: z.number().int().positive(),
    title: z.string().min(1),
    /** Reviewer names (Finding.reviewer values) that apply this rubric. */
    reviewers: z.array(z.string().min(1)).min(1),
    purpose: z.string().min(1),
    scope: z.string().min(1),
    notCovered: z.array(z.string().min(1)).min(1),
    examples: z
      .object({
        S0: z.array(z.string()).min(1),
        S1: z.array(z.string()).min(1),
        S2: z.array(z.string()).min(1),
        S3: z.array(z.string()).optional(),
      })
      .strict(),
    controlsNote: z.string().optional(),
    items: z.array(RubricItemSchema).min(1),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (DOMAIN_CODE[r.domain] !== r.code) {
      ctx.addIssue({
        code: 'custom',
        message: `code ${r.code} does not match domain ${r.domain}`,
        path: ['code'],
      });
    }
    r.items.forEach((item, i) => {
      const expected = `RUB-${r.code}-${String(i + 1).padStart(2, '0')}`;
      if (item.id !== expected) {
        ctx.addIssue({
          code: 'custom',
          message: `item ${i} is ${item.id}, expected ${expected}`,
          path: ['items', i, 'id'],
        });
      }
    });
  });
export type Rubric = z.infer<typeof RubricSchema>;

export const SeverityDefinitionSchema = z
  .object({
    id: SeveritySchema,
    name: z.string().min(1),
    blocks: z.enum(['always', 'more than 3', 'never']),
    definition: z.string().min(1),
    requiredAction: z.string().min(1),
    examples: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const SeverityTaxonomySchema = z
  .object({
    version: z.number().int().positive(),
    severities: z.array(SeverityDefinitionSchema).length(6),
    gateRule: z
      .object({
        s0Blocks: z.literal(true),
        maxS1: z.number().int().nonnegative(),
        questionBelowConfidence: z.number().min(0).max(1),
        statement: z.string().min(1),
      })
      .strict(),
    caps: z.array(
      z.object({ when: z.string(), cap: z.enum(DEFECT_SEVERITIES), note: z.string() }).strict(),
    ),
    waiver: z
      .object({
        shape: z
          .object({ reason: z.string(), approvedBy: z.string(), expires: z.string() })
          .strict(),
        approvals: z.record(z.string(), z.string()),
        rule: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type SeverityTaxonomy = z.infer<typeof SeverityTaxonomySchema>;

/** All rubrics, parsed once at import so a malformed JSON fails typecheck-time tests, not a review. */
export const RUBRICS: Readonly<Record<RubricDomain, Rubric>> = {
  correctness: RubricSchema.parse(correctness),
  security: RubricSchema.parse(security),
  'spec-conformance': RubricSchema.parse(specConformance),
  visual: RubricSchema.parse(visual),
  accessibility: RubricSchema.parse(accessibility),
  performance: RubricSchema.parse(performance),
  'docs-and-changelog': RubricSchema.parse(docsAndChangelog),
  'agent-behaviour': RubricSchema.parse(agentBehaviour),
};

export const SEVERITY_TAXONOMY: SeverityTaxonomy = SeverityTaxonomySchema.parse(severity);

const ITEM_INDEX: ReadonlyMap<string, { rubric: Rubric; item: RubricItem }> = new Map(
  Object.values(RUBRICS).flatMap((rubric) =>
    rubric.items.map((item) => [item.id, { rubric, item }] as const),
  ),
);

export function allRubricItems(): RubricItem[] {
  return [...ITEM_INDEX.values()].map((v) => v.item);
}

export function findRubricItem(id: string): { rubric: Rubric; item: RubricItem } | undefined {
  return ITEM_INDEX.get(id);
}

export function rubricExists(id: string): boolean {
  return ITEM_INDEX.has(id);
}

export function typicalSeverity(id: string): DefectSeverity | undefined {
  return ITEM_INDEX.get(id)?.item.typicalSeverity;
}

/** The rubric domain a reviewer name is responsible for (for coverage completeness checks). */
export function rubricsForReviewer(reviewer: string): Rubric[] {
  return Object.values(RUBRICS).filter((r) => r.reviewers.includes(reviewer));
}
