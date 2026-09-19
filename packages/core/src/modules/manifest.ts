/**
 * PaperOS module manifest: schema, `defineModule()` and the pure validator.
 *
 * The manifest is the one data shape the Module System hangs on. It extends the
 * PAP-264 base manifest (identity, routes, navItems, entities, permissions,
 * jobs, settingsSchema, integrations, dependsOn, optional) with the fields the
 * swap tooling needs: `provides`, `requires`, `capabilities`, `slots`,
 * `events`, `owner`, `kind` and `swapRisk`.
 *
 * Prose: `docs/platform/manifest.md` and section 1.2 of the Module System
 * document. Decision: ADR 0014. The generated JSON Schema lives beside this
 * file in `manifest.schema.json` and is written by `pnpm gen:schemas`; never
 * hand-edit it.
 *
 * Everything here is pure and synchronous — no file system, no network, no
 * `process.env` — so it runs unchanged in a Vite config, in the server, in the
 * CLI and in the browser. Anything that needs to read the workspace (contract
 * package versions, declared topics) is passed in through
 * {@link ValidateManifestOptions}.
 */

import semver from 'semver';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Enumerations                                                                */
/* -------------------------------------------------------------------------- */

/** The nine roster characters (PAP-103, `docs/agent-roster.md`). */
export const OWNER_AGENTS = [
  'Atlas',
  'Forge',
  'Iris',
  'Quill',
  'Sentinel',
  'Nova',
  'Ledger',
  'Beacon',
  'Scout',
] as const;

/**
 * Project keys from `plan/plan.json` `projects[]`, plus the `module-system`
 * kernel, which is a module but not a product project.
 */
export const OWNER_PROJECTS = [
  'app-shell',
  'data-layer',
  'forge',
  'identity',
  'design-system',
  'quality',
  'pm-linear',
  'agents',
  'spec-builder',
  'collab',
  'realtime',
  'input',
  'tables',
  'business-core',
  'growth',
  'migration',
  'libraries',
  'module-system',
] as const;

/** How a module ships: see section 1 of the Module System document. */
export const MODULE_KINDS = ['runtime', 'service', 'tooling', 'process', 'kernel'] as const;

/** Declared, never computed: it picks the swap playbook a change must follow. */
export const SWAP_RISKS = ['low', 'medium', 'high', 'critical'] as const;

export type OwnerAgent = (typeof OWNER_AGENTS)[number];
export type OwnerProject = (typeof OWNER_PROJECTS)[number];
export type ModuleKind = (typeof MODULE_KINDS)[number];
export type SwapRisk = (typeof SWAP_RISKS)[number];

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** `tables`, `app-shell`, `business-core` — lower-kebab, at least two chars. */
export const MODULE_ID_PATTERN = '^[a-z][a-z0-9-]+$';
/** `@paperos/contract-tables`. */
export const CONTRACT_NAME_PATTERN = '^@paperos/contract-[a-z][a-z0-9-]*$';
/** `tables.view.created` — dotted lower-kebab segments (`core/events` topics). */
export const TOPIC_PATTERN = '^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)+$';
/** `shell.nav`, `record.panel.tabs`. */
export const SLOT_ID_PATTERN = '^[a-z][a-zA-Z0-9-]*(\\.[a-z][a-zA-Z0-9-]*)+$';
/** A Linear identifier on team PAP. */
export const ISSUE_PATTERN = '^PAP-[0-9]+$';

const moduleId = z
  .string()
  .regex(new RegExp(MODULE_ID_PATTERN))
  .describe('Module id, unique in a workspace.');
const contractName = z
  .string()
  .regex(new RegExp(CONTRACT_NAME_PATTERN))
  .describe('Contract package name, `@paperos/contract-<module>`.');
const topicName = z.string().regex(new RegExp(TOPIC_PATTERN)).describe('Event topic name.');
const slotId = z
  .string()
  .regex(new RegExp(SLOT_ID_PATTERN))
  .describe('UI slot id, e.g. `shell.nav`.');
const semverVersion = z
  .string()
  .refine((value) => semver.valid(value) !== null, { error: 'not a valid semver version' })
  .describe('Exact semver version.');
const semverRange = z
  .string()
  .refine((value) => semver.validRange(value) !== null, { error: 'not a valid semver range' })
  .describe('semver range; pre-1.0 uses `^0.x` (minor is breaking).');

/**
 * A JSON Schema document carried inline (`settingsSchema`, slot props). Kept
 * open on purpose: the manifest is data, and JSON Schema validates itself.
 */
const jsonSchemaObject = z.record(z.string(), z.unknown()).describe('Inline JSON Schema document.');

/* -------------------------------------------------------------------------- */
/* Manifest field schemas                                                      */
/* -------------------------------------------------------------------------- */

export const ModuleOwnerSchema = z
  .strictObject({
    agent: z.enum(OWNER_AGENTS).describe('Roster character that owns the contract.'),
    project: z.string().describe('Linear project key from plan.json.'),
  })
  .describe('Who may bump this module’s contract version.');

export const ProvidedContractSchema = z
  .strictObject({
    contract: contractName,
    version: semverVersion.describe('Contract version this module implements.'),
    impl: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .default('default')
      .describe('Implementation name; two implementations of one contract differ here.'),
  })
  .describe('A contract this module implements.');

export const RequiredContractSchema = z
  .strictObject({
    contract: contractName,
    range: semverRange,
    optional: z
      .boolean()
      .default(false)
      .describe('The module boots without it and `resolve` returns undefined.'),
    ports: z
      .array(z.string().min(1))
      .default([])
      .describe('Ports actually used, so the compatibility matrix can say what breaks whom.'),
  })
  .describe('A contract this module consumes.');

export const SlotExposureSchema = z
  .strictObject({
    id: slotId,
    props: jsonSchemaObject.optional().describe('JSON Schema for the slot props.'),
    description: z.string().optional(),
  })
  .describe('A named extension point this module renders.');

export const SlotFillSchema = z
  .strictObject({
    slot: slotId,
    component: z
      .string()
      .min(1)
      .describe('Registered `ui.<component>` id or a lazy import specifier.'),
    order: z.int().optional().describe('Ascending render order inside the slot.'),
    when: z
      .string()
      .optional()
      .describe('Guard expression, e.g. `can("tables.read")` or `flag("x")`.'),
  })
  .describe('A contribution into another module’s slot.');

export const ModuleSlotsSchema = z
  .strictObject({
    exposes: z.array(SlotExposureSchema).default([]),
    fills: z.array(SlotFillSchema).default([]),
  })
  .describe('UI extension points exposed and filled.');

export const ModuleEventsSchema = z
  .strictObject({
    publishes: z.array(topicName).default([]),
    subscribes: z.array(topicName).default([]),
  })
  .describe('Event topics, declared in the publishing module’s contract package.');

export const ModuleRouteSchema = z
  .strictObject({
    path: z.string().regex(/^\//).describe('Route path contributed to the shell router.'),
    id: z.string().min(1).optional(),
    layout: z.string().min(1).optional(),
    permission: z.string().min(1).optional(),
  })
  .describe('PAP-264 route contribution.');

export const ModuleNavItemSchema = z
  .strictObject({
    id: z.string().min(1),
    /** Message-catalog key: no hard-coded user-visible strings (EN + ES). */
    labelKey: z.string().min(1).describe('Message catalog key; never a literal label.'),
    to: z.string().regex(/^\//),
    icon: z.string().min(1).optional(),
    order: z.int().optional(),
    permission: z.string().min(1).optional(),
  })
  .describe('PAP-264 navigation entry.');

export const ModuleEntitySchema = z
  .strictObject({
    name: z.string().min(1),
    table: z.string().min(1).optional(),
    contract: contractName.optional().describe('Contract that owns the entity’s type.'),
  })
  .describe('PAP-264 entity contributed by this module.');

export const ModuleJobSchema = z
  .strictObject({
    name: z.string().min(1),
    schedule: z.string().min(1).optional().describe('Cron expression, or absent for on-demand.'),
    queue: z.string().min(1).optional(),
  })
  .describe('PAP-264 background job.');

export const ModuleIntegrationSchema = z
  .strictObject({
    name: z.string().min(1),
    kind: z.enum(['api', 'webhook', 'oauth', 'smtp', 'storage', 'other']).default('other'),
    optional: z.boolean().default(true),
  })
  .describe('PAP-264 third-party integration.');

/* Round-4 reserved extensions ---------------------------------------------- */

export const ModuleLifecycleSchema = z
  .strictObject({
    startupBudgetMs: z.int().positive(),
    healthIntervalMs: z.int().positive(),
    drainTimeoutMs: z.int().positive(),
  })
  .describe('PAP-546 lifecycle and health budgets.');

export const PortResilienceSchema = z
  .strictObject({
    timeoutMs: z.int().positive().optional(),
    retries: z.int().nonnegative().optional(),
    backoff: z.enum(['none', 'fixed', 'exponential']).optional(),
    circuitBreaker: z
      .strictObject({
        failureThreshold: z.int().positive(),
        resetMs: z.int().positive(),
      })
      .optional(),
    fallback: z.enum(['none', 'cache', 'degrade', 'queue']).optional(),
  })
  .describe('PAP-548 resilience policy for one port.');

/* -------------------------------------------------------------------------- */
/* The manifest                                                                */
/* -------------------------------------------------------------------------- */

const manifestShape = {
  /* Identity (PAP-264 base) */
  id: moduleId,
  title: z.string().min(1).optional().describe('Human name; the UI reads the catalog, not this.'),
  kind: z.enum(MODULE_KINDS),
  version: semverVersion.describe('semver of the implementation.'),
  owner: ModuleOwnerSchema,

  /* Swap surface (this issue) */
  provides: z.array(ProvidedContractSchema),
  requires: z.array(RequiredContractSchema),
  capabilities: z.array(z.string().min(1)).default([]),
  slots: ModuleSlotsSchema.optional(),
  events: ModuleEventsSchema.optional(),
  swapRisk: z.enum(SWAP_RISKS),

  /* PAP-264 base surface */
  routes: z.array(ModuleRouteSchema).default([]),
  navItems: z.array(ModuleNavItemSchema).default([]),
  entities: z.array(ModuleEntitySchema).default([]),
  permissions: z.array(z.string().min(1)).default([]),
  jobs: z.array(ModuleJobSchema).default([]),
  settingsSchema: jsonSchemaObject.optional().describe('JSON Schema of the module’s config.'),
  integrations: z.array(ModuleIntegrationSchema).default([]),
  optional: z.boolean().default(true).describe('False for a core module that cannot be disabled.'),
  dependsOn: z
    .array(moduleId)
    .optional()
    .describe('Deprecated (PAP-264): derived from `requires`; must agree when both are present.'),

  /* Round-4 reserved fields — validated when present */
  secrets: z
    .array(z.string().min(1))
    .default([])
    .describe('PAP-444: secret names only, never values.'),
  lifecycle: ModuleLifecycleSchema.optional(),
  resilience: z.record(z.string().min(1), PortResilienceSchema).optional(),
  issues: z.array(z.string().regex(new RegExp(ISSUE_PATTERN))).default([]),
};

/**
 * The module manifest. `additionalProperties: false`: an unknown field is a
 * typo or a field someone forgot to specify, and both should fail loudly.
 */
export const ModuleManifestSchema = z
  .strictObject(manifestShape)
  .describe('PaperOS module manifest (Module System section 1.2).')
  .meta({ title: 'PaperOS module manifest' });

/** A parsed manifest: every defaulted field is present. */
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;
/** A manifest as authored: defaulted fields may be omitted. */
export type ModuleManifestInput = z.input<typeof ModuleManifestSchema>;

export type ProvidedContract = z.infer<typeof ProvidedContractSchema>;
export type RequiredContract = z.infer<typeof RequiredContractSchema>;
export type ModuleOwner = z.infer<typeof ModuleOwnerSchema>;
export type SlotFill = z.infer<typeof SlotFillSchema>;
export type SlotExposure = z.infer<typeof SlotExposureSchema>;

/** The `$id` of the generated JSON Schema. Bumping it is a breaking change. */
export const MODULE_MANIFEST_SCHEMA_ID = 'https://paperos.dev/schema/module-manifest/1';

/* -------------------------------------------------------------------------- */
/* defineModule                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Anything that implements the Standard Schema interface — Zod 4 does. Used so
 * `defineModule` can infer a settings type without importing the whole of Zod
 * into a consumer's type graph.
 */
export interface StandardSchemaLike<Output = unknown> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: { readonly output: Output } | undefined;
  };
}

/** What `defineModule` accepts: the manifest, with a richer `settingsSchema`. */
export type DefineModuleInput = Omit<ModuleManifestInput, 'settingsSchema'> & {
  readonly settingsSchema?: Record<string, unknown> | StandardSchemaLike | undefined;
};

/** The config type a module's `settingsSchema` describes, when it is a schema object. */
export type ModuleSettings<M> = M extends { readonly settingsSchema: infer Schema }
  ? Schema extends StandardSchemaLike<infer Output>
    ? Output
    : unknown
  : unknown;

/** The contract names a module provides, as a union of string literals. */
export type ProvidedContractNames<
  M extends { readonly provides: readonly { readonly contract: string }[] },
> = M['provides'][number]['contract'];

/**
 * Declare a module. The `const` type parameter keeps every literal (`id`,
 * `kind`, the `provides[].contract` names) so the kernel's typed tokens and
 * `ModuleSettings<typeof mod>` resolve without a cast.
 *
 * It validates the shape eagerly and throws on a malformed manifest, because a
 * manifest is loaded at boot and a late failure is worse than an early one.
 * Cross-module checks (`requires` resolution, cycles, slots) need the other
 * manifests and live in {@link validateManifest}.
 */
export function defineModule<const M extends DefineModuleInput>(manifest: M): M {
  const result = ModuleManifestSchema.safeParse(toManifestJson(manifest));
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  ${formatPath(issue.path)}: ${issue.message}`,
    );
    throw new TypeError(`Invalid module manifest "${String(manifest.id)}":\n${lines.join('\n')}`);
  }
  return Object.freeze(manifest);
}

/** True for a Standard Schema object (any Zod 4 schema). */
export function isStandardSchema(value: unknown): value is StandardSchemaLike {
  return typeof value === 'object' && value !== null && '~standard' in value;
}

/**
 * The JSON form of a manifest, ready to write to `module.manifest.json`: a Zod
 * `settingsSchema` becomes its JSON Schema.
 */
export function toManifestJson(manifest: DefineModuleInput): ModuleManifestInput {
  const { settingsSchema, ...rest } = manifest;
  if (settingsSchema === undefined) return rest as ModuleManifestInput;
  const asJson = isStandardSchema(settingsSchema)
    ? (z.toJSONSchema(settingsSchema as never, { io: 'input' }) as Record<string, unknown>)
    : settingsSchema;
  return { ...rest, settingsSchema: asJson } as ModuleManifestInput;
}

/* -------------------------------------------------------------------------- */
/* Diagnostics                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Stable diagnostic codes. They are part of the contract: CI output, the
 * compatibility matrix and the swap CLI all match on them, so a code is never
 * renamed, only added.
 */
export const DIAGNOSTIC_CODES = [
  'SCHEMA_INVALID',
  'REQUIRES_UNRESOLVED',
  'REQUIRES_RANGE_MISMATCH',
  'DEPENDS_ON_DISAGREES',
  'SLOT_UNKNOWN',
  'TOPIC_UNDECLARED',
  'OWNER_UNKNOWN',
  'CYCLE',
  'DUPLICATE_PROVIDER',
  'PROVIDES_VERSION_MISMATCH',
] as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];
export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  /** Stable code; match on this, never on the message. */
  readonly code: DiagnosticCode;
  /** `error` fails the build; `warning` is reported and passes. */
  readonly severity: DiagnosticSeverity;
  /** Module the diagnostic is reported against. */
  readonly module: string;
  /** One sentence naming every party, for a human reading CI output. */
  readonly message: string;
  /** Path inside the manifest, e.g. `requires[2].range`. */
  readonly path?: string | undefined;
  /** Other modules or contracts involved (the cycle path, the other provider). */
  readonly related?: readonly string[] | undefined;
}

/**
 * Named `Manifest…` rather than `ValidationResult` because `@paperos/core`'s
 * barrel re-exports both this and the filter grammar's `ValidationResult`
 * (PAP-279), and one barrel cannot carry two.
 */
export interface ManifestValidationResult {
  /** True when there is no `error`-severity diagnostic. */
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

/** What the workspace knows about one contract package, passed in by the caller. */
export interface ContractPackageInfo {
  /** `version` from the contract package's `package.json`. */
  readonly version?: string | undefined;
  /** Topics the contract declares with `defineTopic()`. */
  readonly topics?: readonly string[] | undefined;
  /** Slot ids the contract declares. */
  readonly slots?: readonly string[] | undefined;
}

export interface ValidateManifestOptions {
  /** Every other manifest in the workspace. */
  readonly others?: readonly unknown[] | undefined;
  /**
   * Contract packages the caller could resolve, keyed by package name. Topic
   * and provided-version checks run for the entries present here and warn for
   * the ones missing. Omit it entirely to skip both checks.
   */
  readonly contracts?: Readonly<Record<string, ContractPackageInfo>> | undefined;
}

/* -------------------------------------------------------------------------- */
/* Validator                                                                   */
/* -------------------------------------------------------------------------- */

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc === '' ? String(segment) : `${acc}.${String(segment)}`;
  }, '');
}

function schemaDiagnostics(id: string, error: z.ZodError): Diagnostic[] {
  return error.issues.map((issue) => ({
    code: 'SCHEMA_INVALID' as const,
    severity: 'error' as const,
    module: id,
    message: `${formatPath(issue.path) || '<root>'}: ${issue.message}`,
    path: formatPath(issue.path) || undefined,
  }));
}

function manifestId(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return '<unknown>';
}

/**
 * The module ids a manifest's `requires` implies: the provider's id when the
 * contract is provided in this workspace, otherwise the contract's own module
 * name (`@paperos/contract-tables` → `tables`). This is the `dependsOn` PAP-264
 * asks for; it is derived, never authored.
 */
export function deriveDependsOn(
  manifest: Pick<ModuleManifest, 'requires'>,
  others: readonly ModuleManifest[] = [],
): string[] {
  const providerOf = new Map<string, string>();
  for (const other of others) {
    for (const provided of other.provides) {
      if (!providerOf.has(provided.contract)) providerOf.set(provided.contract, other.id);
    }
  }
  const ids = new Set<string>();
  for (const required of manifest.requires) {
    ids.add(
      providerOf.get(required.contract) ?? required.contract.replace('@paperos/contract-', ''),
    );
  }
  return [...ids].sort();
}

/**
 * Every dependency cycle through `from`, as paths that start and end at `from`.
 * Optional requires are not edges: the kernel boots the consumer without the
 * provider, so an optional edge cannot deadlock a boot order.
 */
function cyclesThrough(
  from: string,
  byId: ReadonlyMap<string, ModuleManifest>,
  providerOf: ReadonlyMap<string, string>,
): string[][] {
  const found: string[][] = [];
  const seen = new Set<string>();
  const walk = (current: string, path: string[]): void => {
    /* `current` always comes from `providerOf`, which is built from `byId`. */
    const manifest = byId.get(current) as ModuleManifest;
    for (const required of manifest.requires) {
      if (required.optional) continue;
      const next = providerOf.get(required.contract);
      if (next === undefined) continue;
      if (next === from) {
        const cycle = [...path, from];
        const key = cycle.join('>');
        if (!seen.has(key)) {
          seen.add(key);
          found.push(cycle);
        }
        continue;
      }
      if (path.includes(next)) continue;
      walk(next, [...path, next]);
    }
  };
  walk(from, [from]);
  return found;
}

/**
 * Validate one manifest against the rest of the workspace. Pure, synchronous,
 * allocation-only: safe in a Vite config, in the server and in the browser.
 *
 * Returns every diagnostic it finds rather than throwing on the first, because
 * a developer fixing a manifest wants the whole list.
 */
export function validateManifest(
  manifest: unknown,
  options: ValidateManifestOptions = {},
): ManifestValidationResult {
  const parsed = ModuleManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return { ok: false, diagnostics: schemaDiagnostics(manifestId(manifest), parsed.error) };
  }
  const self = parsed.data;
  const diagnostics: Diagnostic[] = [];

  /* Other manifests that do not parse are not this manifest's problem: they are
     reported when they are validated in their own right, and are skipped here
     so one bad manifest does not hide every other module's diagnostics. */
  const others: ModuleManifest[] = [];
  for (const candidate of options.others ?? []) {
    const result = ModuleManifestSchema.safeParse(candidate);
    if (result.success && result.data.id !== self.id) others.push(result.data);
  }

  /* OWNER_UNKNOWN — the agent is an enum in the schema; the project key is not,
     because plan.json is the source of truth and it moves. */
  if (!(OWNER_PROJECTS as readonly string[]).includes(self.owner.project)) {
    diagnostics.push({
      code: 'OWNER_UNKNOWN',
      severity: 'error',
      module: self.id,
      message: `owner.project "${self.owner.project}" is not a project key in plan.json (${OWNER_PROJECTS.join(', ')}).`,
      path: 'owner.project',
    });
  }

  /* Provider index over the whole workspace, this manifest included. */
  const all = [self, ...others];
  const providerOf = new Map<string, string>();
  const byId = new Map<string, ModuleManifest>();
  for (const module of all) {
    byId.set(module.id, module);
    for (const provided of module.provides) {
      if (!providerOf.has(provided.contract)) providerOf.set(provided.contract, module.id);
    }
  }

  /* DUPLICATE_PROVIDER — same contract and same `impl` twice. Two
     implementations of one contract are allowed; they differ in `impl`. */
  const seenImpl = new Map<string, string>();
  for (const module of all) {
    for (const provided of module.provides) {
      const key = `${provided.contract}#${provided.impl}`;
      const owner = seenImpl.get(key);
      if (owner === undefined) {
        seenImpl.set(key, module.id);
        continue;
      }
      if (module.id !== self.id && owner !== self.id) continue;
      diagnostics.push({
        code: 'DUPLICATE_PROVIDER',
        severity: 'error',
        module: self.id,
        message: `${provided.contract} impl "${provided.impl}" is provided twice: by ${owner} and by ${module.id}.`,
        path: 'provides',
        related: [owner, module.id],
      });
    }
  }

  /* PROVIDES_VERSION_MISMATCH — only when the contract package is resolvable. */
  const contracts = options.contracts;
  if (contracts !== undefined) {
    self.provides.forEach((provided, index) => {
      const packageVersion = contracts[provided.contract]?.version;
      if (packageVersion === undefined) return;
      if (!semver.valid(packageVersion) || !semver.eq(packageVersion, provided.version)) {
        diagnostics.push({
          code: 'PROVIDES_VERSION_MISMATCH',
          severity: 'error',
          module: self.id,
          message: `provides[${index}] declares ${provided.contract}@${provided.version} but the package is at ${packageVersion}.`,
          path: `provides[${index}].version`,
          related: [provided.contract],
        });
      }
    });
  }

  /* REQUIRES_UNRESOLVED / REQUIRES_RANGE_MISMATCH */
  self.requires.forEach((required, index) => {
    const providerId = providerOf.get(required.contract);
    if (providerId === undefined) {
      diagnostics.push({
        code: 'REQUIRES_UNRESOLVED',
        severity: required.optional ? 'warning' : 'error',
        module: self.id,
        message: required.optional
          ? `optional requirement ${required.contract} ${required.range} has no provider; resolve() returns undefined.`
          : `${required.contract} ${required.range} is required but no module provides it.`,
        path: `requires[${index}].contract`,
        related: [required.contract],
      });
      return;
    }
    const provider = byId.get(providerId) as ModuleManifest;
    for (const provided of provider.provides.filter(
      (entry) => entry.contract === required.contract,
    )) {
      if (semver.satisfies(provided.version, required.range, { includePrerelease: true })) return;
    }
    const offered = provider.provides
      .filter((entry) => entry.contract === required.contract)
      .map((entry) => entry.version)
      .join(', ');
    diagnostics.push({
      code: 'REQUIRES_RANGE_MISMATCH',
      severity: 'error',
      module: self.id,
      message: `${self.id} requires ${required.contract} ${required.range} but ${provider.id} provides ${offered}.`,
      path: `requires[${index}].range`,
      related: [provider.id, required.contract],
    });
  });

  /* DEPENDS_ON_DISAGREES — `dependsOn` is derived; authoring it is allowed for
     PAP-264 compatibility only while it says the same thing. */
  if (self.dependsOn !== undefined) {
    const derived = deriveDependsOn(self, others);
    const authored = [...new Set(self.dependsOn)].sort();
    if (derived.join(',') !== authored.join(',')) {
      diagnostics.push({
        code: 'DEPENDS_ON_DISAGREES',
        severity: 'error',
        module: self.id,
        message: `dependsOn [${authored.join(', ')}] disagrees with the modules derived from requires [${derived.join(', ')}].`,
        path: 'dependsOn',
        related: derived,
      });
    }
  }

  /* SLOT_UNKNOWN — a fill must land in a slot some module exposes. */
  const exposed = new Set<string>();
  for (const module of all) {
    for (const exposure of module.slots?.exposes ?? []) exposed.add(exposure.id);
  }
  for (const contract of Object.values(contracts ?? {})) {
    for (const slot of contract.slots ?? []) exposed.add(slot);
  }
  (self.slots?.fills ?? []).forEach((fill, index) => {
    if (exposed.has(fill.slot)) return;
    diagnostics.push({
      code: 'SLOT_UNKNOWN',
      severity: 'error',
      module: self.id,
      message: `slots.fills[${index}] targets "${fill.slot}", which no module exposes.`,
      path: `slots.fills[${index}].slot`,
      related: [fill.slot],
    });
  });

  /* TOPIC_UNDECLARED — a published topic must be declared in this module's own
     contract package. Only contracts the caller passed information about are
     checked: a package it never looked at says nothing about its topics, so
     the rule stays silent rather than crying wolf on every module. A package
     the caller found but could not read the topics of is a warning. */
  const publishes = self.events?.publishes ?? [];
  const ownContracts =
    contracts === undefined
      ? []
      : self.provides.map((provided) => provided.contract).filter((name) => name in contracts);
  if (contracts !== undefined && publishes.length > 0 && ownContracts.length > 0) {
    const declared = new Set<string>();
    const unresolved: string[] = [];
    for (const name of ownContracts) {
      const topics = contracts[name]?.topics;
      if (topics === undefined) {
        unresolved.push(name);
        continue;
      }
      for (const topic of topics) declared.add(topic);
    }
    const resolvedAny = ownContracts.length > unresolved.length;
    publishes.forEach((topic, index) => {
      if (declared.has(topic)) return;
      diagnostics.push({
        code: 'TOPIC_UNDECLARED',
        severity: resolvedAny ? 'error' : 'warning',
        module: self.id,
        message: resolvedAny
          ? `events.publishes[${index}] "${topic}" is not declared by ${ownContracts.join(', ')}.`
          : `events.publishes[${index}] "${topic}" is unverified: the topics of ${unresolved.join(', ')} could not be read.`,
        path: `events.publishes[${index}]`,
        related: resolvedAny ? ownContracts : unresolved,
      });
    });
  }

  /* CYCLE — reported from this manifest's point of view, once per cycle. */
  for (const cycle of cyclesThrough(self.id, byId, providerOf)) {
    diagnostics.push({
      code: 'CYCLE',
      severity: 'error',
      module: self.id,
      message: `dependency cycle: ${cycle.join(' -> ')}.`,
      path: 'requires',
      related: cycle,
    });
  }

  return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), diagnostics };
}

/**
 * Validate a whole workspace: every manifest against every other. The CLI, the
 * kernel's boot check and the compatibility matrix all use this.
 */
export function validateManifests(
  manifests: readonly unknown[],
  options: Omit<ValidateManifestOptions, 'others'> = {},
): ManifestValidationResult {
  const diagnostics: Diagnostic[] = [];
  for (const manifest of manifests) {
    const others = manifests.filter((candidate) => candidate !== manifest);
    diagnostics.push(...validateManifest(manifest, { ...options, others }).diagnostics);
  }
  return { ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'), diagnostics };
}
