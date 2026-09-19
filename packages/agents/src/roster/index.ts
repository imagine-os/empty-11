/**
 * `@paperos/agents` roster tooling (PAP-284): plan.json conversion, merge, org tree and the live
 * roster loader. The schema itself is `../schema`.
 */
export {
  type ConvertedRoster,
  type ConvertOptions,
  characterDrift,
  convertPlan,
  FIELD_ORDER,
  mergeCharacter,
  orderFields,
  PLAN_OWNED_FIELDS,
  REGISTRY_SCOPE_IDS,
} from './convert.ts';
export {
  AGENTS_PACKAGE_ROOT,
  LIVE_CHARACTERS_DIR,
  LIVE_ROSTER_FILE,
  readLiveRosterFiles,
  validateLiveRoster,
} from './live.ts';
export {
  kebab,
  normaliseAccess,
  type PlanAgent,
  PlanAgentSchema,
  PlanAgentsSchema,
  type PlanStructure,
  type PlanSubAgent,
  PlanSubAgentSchema,
  parsePlanAgents,
  planStructure,
  readPlanAgents,
} from './plan.ts';
export {
  DAILY_ALLOWANCE_USD,
  LEAD_PARALLELISM,
  LEAD_SESSION,
  LEAD_SHARES,
  memoryPath,
  perDayUsd,
  READ_MOSTLY_SUBS,
  REVIEWER_DENY,
  REVIEWER_LEAD,
  ROSTER_DEFAULTS,
  SECTION_4_DENY,
  SUB_SESSION,
  sharedLeadEscalation,
  sharedSubEscalation,
} from './policy.ts';
export { countKinds, diffAgainstPlan, renderTree, type TreeOptions } from './tree.ts';
