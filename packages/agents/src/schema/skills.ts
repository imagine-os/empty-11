/**
 * Skill ids the roster may reference (PAP-105 owns `skills.json`; until it lands this list is the
 * union of every skill the nine character sheets name). An unknown skill is a warning
 * (`UNKNOWN_SKILL`), never an error, because skills are added by YAML and a skill file.
 */
export const KNOWN_SKILLS = [
  // PAP-105 shared library
  'page-from-spec',
  'review-pr',
  'screenshot-audit',
  'write-adr',
  'linear-update',
  // Named in the character sheets, owned by later issues
  'decompose-brief',
  'handoff-lint',
  'db-migration',
  'deploy-staging',
  'runbook',
  'component-from-primitive',
  'theme-check',
  'spec-author',
  'digest',
  'memory-curate',
  'edge-case-plan',
  'threat-model',
  'flake-triage',
  'view-kind',
  'bench-report',
  'crdt-room',
  'posting-rule',
  'stripe-webhook',
  'money-math',
  'campaign-draft',
  'sequence-compliance',
  'webflow-publish',
  'lib-eval',
  'scout-scan',
  'importer',
  'template-pack',
] as const;
export type KnownSkill = (typeof KNOWN_SKILLS)[number];
