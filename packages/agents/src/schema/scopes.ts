/**
 * Access-scope registry (PAP-103).
 *
 * Every `access[]` string on a character is `resource:verb[:qualifier]`. The registry is the
 * normalised union of every access string in plan.json `agents[]` and the nine character sheets;
 * a scope that does not resolve here fails validation with `UNKNOWN_SCOPE`.
 *
 * Normalisation from the plan's prose forms, recorded so the conversion is reviewable:
 *   `forgejo:org-admin`            -> `forgejo:admin:org`
 *   `github:imagine-os admin`      -> `github:admin:imagine-os`
 *   `budget:read-write`            -> `budget:write`
 *   `prod:read-only`               -> `prod:read`
 *   `repo:write (all)`             -> `repo:write:all`
 *   `repo:write packages/ui`       -> `repo:write:packages/ui` (one scope per path)
 *   `postgres:migrate (staging)`   -> `postgres:migrate:staging`
 *   `secrets:infra`                -> `secrets:read:infra`
 *   `stripe:test-mode write`       -> `stripe:write:test`
 *   `stripe:live read-only`        -> `stripe:read:live`
 *   `email:send (sandbox until approved)` -> `email:send:sandbox`
 *   `repo:review + request-changes` -> `repo:review`
 *   `no merge rights`, `no prod write` -> dropped: a negation is the absence of a scope
 *
 * Scope classes follow the PAP-210 catalog vocabulary (`read`, `write`, `destructive`) plus
 * `admin`. `destructive` scopes are held only by a lead that reports to `justin`
 * (Security and Threat Model §4); none of the golden characters holds one today.
 */

export const SCOPE_CLASSES = ['read', 'write', 'admin', 'destructive'] as const;
export type ScopeClass = (typeof SCOPE_CLASSES)[number];

/** How the optional third segment of a scope is checked. */
export type QualifierRule =
  | { kind: 'none' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'path' };

export interface ScopeDefinition {
  /** `resource:verb`, without qualifier. */
  readonly id: string;
  readonly class: ScopeClass;
  readonly qualifier: QualifierRule;
  readonly description: string;
}

const none: QualifierRule = { kind: 'none' };
const path: QualifierRule = { kind: 'path' };
const oneOf = (...values: string[]): QualifierRule => ({ kind: 'enum', values });

export const SCOPES: readonly ScopeDefinition[] = [
  // Linear
  {
    id: 'linear:admin',
    class: 'admin',
    qualifier: none,
    description: 'Full Linear workspace API (Atlas only).',
  },
  {
    id: 'linear:comment',
    class: 'write',
    qualifier: none,
    description: 'Comment on issues and move own issue In Progress -> In Review.',
  },
  {
    id: 'linear:issue-create',
    class: 'write',
    qualifier: oneOf('backlog', 'triage'),
    description: 'Create issues in the named state only.',
  },
  // Forges
  {
    id: 'forgejo:admin',
    class: 'admin',
    qualifier: oneOf('org'),
    description: 'Forgejo organisation administration.',
  },
  {
    id: 'github:admin',
    class: 'admin',
    qualifier: oneOf('imagine-os'),
    description: 'GitHub organisation administration.',
  },
  {
    id: 'repo:write',
    class: 'write',
    qualifier: path,
    description:
      'Push to non-protected branches under the qualified path (`all` for the whole repo).',
  },
  {
    id: 'repo:review',
    class: 'write',
    qualifier: none,
    description: 'Review, approve and request changes on pull requests; never merge.',
  },
  {
    id: 'repo:merge',
    class: 'write',
    qualifier: none,
    description: 'Merge green pull requests (Atlas Merger only).',
  },
  // Budget, metering, production
  {
    id: 'budget:write',
    class: 'write',
    qualifier: none,
    description: 'Read and reweight character budgets (PAP-111).',
  },
  {
    id: 'budget:read',
    class: 'read',
    qualifier: none,
    description: 'Read spend and remaining budget.',
  },
  {
    id: 'prod:read',
    class: 'read',
    qualifier: none,
    description: 'Read-only access to production data.',
  },
  // Infrastructure
  {
    id: 'vps:deploy',
    class: 'write',
    qualifier: oneOf('staging'),
    description: 'Deploy through Coolify to the named environment.',
  },
  {
    id: 'postgres:migrate',
    class: 'write',
    qualifier: oneOf('staging', 'dev'),
    description: 'Run migrations against the named environment.',
  },
  {
    id: 'secrets:read',
    class: 'admin',
    qualifier: oneOf('infra'),
    description: 'Decrypt the named sops secret set inside its sandbox.',
  },
  {
    id: 'ci:admin',
    class: 'admin',
    qualifier: none,
    description: 'Configure CI gates and required checks.',
  },
  {
    id: 'artifacts:write',
    class: 'write',
    qualifier: none,
    description: 'Write gate artefacts, screenshots and videos.',
  },
  {
    id: 'storybook:deploy',
    class: 'write',
    qualifier: none,
    description: 'Publish Storybook to GitHub Pages.',
  },
  {
    id: 'design-tokens:write',
    class: 'write',
    qualifier: none,
    description: 'Edit DTCG token sources.',
  },
  {
    id: 'yjs-server:deploy',
    class: 'write',
    qualifier: oneOf('staging'),
    description: 'Deploy the Hocuspocus server.',
  },
  {
    id: 'electric:shapes',
    class: 'write',
    qualifier: oneOf('staging'),
    description: 'Define ElectricSQL shapes.',
  },
  {
    id: 'spikes:docker',
    class: 'write',
    qualifier: oneOf('isolated'),
    description: 'Run OSS product spikes on an isolated Docker network.',
  },
  // Connectors
  {
    id: 'notion:write',
    class: 'write',
    qualifier: none,
    description: 'Read and write the Notion workspace.',
  },
  { id: 'notion:read', class: 'read', qualifier: none, description: 'Read Notion.' },
  { id: 'drive:read', class: 'read', qualifier: none, description: 'Read Google Drive.' },
  {
    id: 'external-apis:read',
    class: 'read',
    qualifier: none,
    description: 'Read public and fixture external APIs (Airtable, ClickUp, QuickBooks sandboxes).',
  },
  {
    id: 'webflow:write',
    class: 'write',
    qualifier: none,
    description: 'Write the PaperOS marketing site and CMS.',
  },
  // Money
  {
    id: 'stripe:write',
    class: 'write',
    qualifier: oneOf('test'),
    description: 'Stripe write in test mode only.',
  },
  {
    id: 'stripe:read',
    class: 'read',
    qualifier: oneOf('live', 'test'),
    description: 'Stripe read in the named mode.',
  },
  {
    id: 'ledger:post',
    class: 'write',
    qualifier: oneOf('staging'),
    description: 'Post journal entries through posting rules.',
  },
  {
    id: 'payroll:write',
    class: 'write',
    qualifier: oneOf('sandbox'),
    description: 'Payroll provider sandbox writes.',
  },
  // Growth
  {
    id: 'crm:write',
    class: 'write',
    qualifier: oneOf('staging'),
    description: 'Write CRM records.',
  },
  {
    id: 'email:send',
    class: 'write',
    qualifier: oneOf('sandbox', 'allowlist'),
    description: 'Send email in the named mode; live needs Justin per channel.',
  },
  {
    id: 'sms:send',
    class: 'write',
    qualifier: oneOf('sandbox', 'allowlist'),
    description: 'Send SMS in the named mode.',
  },
  {
    id: 'social:publish',
    class: 'write',
    qualifier: oneOf('dry-run'),
    description: 'Queue social posts; publishing is flipped per platform by Justin.',
  },
  // Destructive (registered so the class rule is testable; nobody holds them in the golden roster)
  {
    id: 'linear:delete',
    class: 'destructive',
    qualifier: none,
    description: 'Archive or delete Linear entities. Deny-listed everywhere (§4).',
  },
  {
    id: 'repo:force-push',
    class: 'destructive',
    qualifier: none,
    description: 'Force-push or delete refs. Deny-listed everywhere (§4).',
  },
];

export const SCOPE_IDS: readonly string[] = SCOPES.map((s) => s.id);

/** `resource:verb[:qualifier]`; qualifier may hold a path such as `packages/ui`. */
export const SCOPE_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(?::[a-z0-9.][a-z0-9._/-]*)?$/;

export interface ResolvedScope {
  readonly scope: string;
  readonly definition: ScopeDefinition;
  readonly qualifier: string | undefined;
}

/** Resolve an access string against the registry; `undefined` when it is unknown or malformed. */
export function resolveScope(scope: string): ResolvedScope | undefined {
  if (!SCOPE_PATTERN.test(scope)) return undefined;
  const [resource, verb, qualifier] = scope.split(':') as [string, string, string | undefined];
  const definition = SCOPES.find((s) => s.id === `${resource}:${verb}`);
  if (!definition) return undefined;
  const rule = definition.qualifier;
  if (rule.kind === 'none')
    return qualifier === undefined ? { scope, definition, qualifier } : undefined;
  if (qualifier === undefined) return undefined;
  if (rule.kind === 'enum')
    return rule.values.includes(qualifier) ? { scope, definition, qualifier } : undefined;
  return { scope, definition, qualifier };
}

export function isKnownScope(scope: string): boolean {
  return resolveScope(scope) !== undefined;
}

/**
 * Does `held` cover `wanted`? Same definition, and either the same qualifier, or a path
 * qualifier `all` (or a parent directory) on the held side.
 */
export function scopeCovers(held: string, wanted: string): boolean {
  const h = resolveScope(held);
  const w = resolveScope(wanted);
  if (!h || !w || h.definition.id !== w.definition.id) return false;
  if (h.qualifier === w.qualifier) return true;
  if (
    h.definition.qualifier.kind !== 'path' ||
    h.qualifier === undefined ||
    w.qualifier === undefined
  )
    return false;
  if (h.qualifier === 'all') return true;
  return w.qualifier.startsWith(`${h.qualifier.replace(/\/$/, '')}/`);
}
