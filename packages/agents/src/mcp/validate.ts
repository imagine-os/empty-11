/**
 * The checks that make the MCP catalogue a control rather than a document (PAP-210, ADR 0021).
 *
 * `validateCatalog` is pure: it takes parsed JSON and returns findings. Reading files is the
 * caller's job, which keeps the rules testable against fixtures that never touch the repo.
 *
 * The three rules worth naming, because they are the reason this file exists:
 *
 *   - **No raw secret, anywhere.** Every string in the catalogue and in every character
 *     fragment is scanned for credential-shaped text. Auth is declared as broker placeholders
 *     only (Threat Model section 5).
 *   - **Destructive tools reach Atlas and nobody else.** Threat Model section 4 names this as
 *     the second of three enforcement points, next to the PreToolUse hook (PAP-711) and a
 *     server-side backstop. This is that enforcement point.
 *   - **Every character named exists.** A typo in an allowlist is a silent grant or a silent
 *     denial; neither shows up until something breaks.
 */
import { computeRubric, type RubricConfig } from './rubric.js';
import {
  brokerPlaceholderPattern,
  CatalogSchema,
  DESTRUCTIVE_HOLDER,
  type McpCatalog,
  type McpServer,
} from './schema.js';

export interface Finding {
  /** `error` fails the gate. `warn` is recorded and read, but does not fail. */
  level: 'error' | 'warn';
  rule: string;
  where: string;
  message: string;
}

export interface CharacterFragment {
  character: string;
  path: string;
  /** Parsed `.claude/agents/<character>/mcp.json`. */
  data: unknown;
}

/**
 * Credential shapes. Each pattern requires a body after its prefix, so the catalogue may
 * discuss `sk_live_` in prose (it has to: the deny list names it) without tripping the scan.
 */
const SECRET_PATTERNS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: 'stripe-key', pattern: /\b[rs]k_(live|test)_[A-Za-z0-9]{8,}/ },
  { id: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{16,}/ },
  { id: 'github-pat', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { id: 'linear-key', pattern: /\blin_(api|oauth)_[A-Za-z0-9]{16,}/ },
  { id: 'notion-token', pattern: /\b(ntn_|secret_)[A-Za-z0-9]{24,}/ },
  { id: 'slack-token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
  { id: 'google-key', pattern: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { id: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'dsn-password', pattern: /\b(postgres|postgresql|mysql|redis):\/\/[^\s:/]+:[^\s@]+@/ },
  { id: 'bearer-literal', pattern: /Bearer\s+(?!broker:)[A-Za-z0-9._-]{16,}/ },
];

/** Verbs that can never be a `read` tool, whatever the vendor calls them. */
const MUTATING_VERBS = [
  'delete',
  'remove',
  'drop',
  'truncate',
  'archive',
  'publish',
  'merge',
  'revoke',
  'purge',
  'destroy',
  'disable',
  'create',
  'update',
  'write',
  'install',
];

function walkStrings(
  value: unknown,
  path: string,
  visit: (text: string, at: string) => void,
): void {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkStrings(item, `${path}[${index}]`, visit);
    });
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walkStrings(child, `${path}.${key}`, visit);
  }
}

function scanForSecrets(value: unknown, where: string, findings: Finding[]): void {
  walkStrings(value, where, (text, at) => {
    for (const { id, pattern } of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        findings.push({
          level: 'error',
          rule: 'no-raw-secrets',
          where: at,
          message: `value looks like a ${id}; credentials are broker placeholders only (broker:<service>/<credential>)`,
        });
      }
    }
  });
}

/**
 * The tools a character may actually be granted on a server. Non-Atlas characters lose every
 * `destructive` tool and every tool named in `destructiveTools`; characters outside
 * `writeCharacters` lose `write` tools too.
 */
export function effectiveToolsFor(server: McpServer, character: string): string[] {
  const denied = new Set(server.destructiveTools);
  const mayWrite = server.writeCharacters.includes(character);
  return server.tools
    .filter((tool) => {
      if (tool.scope === 'destructive' || denied.has(tool.name))
        return character === DESTRUCTIVE_HOLDER;
      if (tool.scope === 'write') return mayWrite;
      return true;
    })
    .map((tool) => tool.name);
}

export function validateCatalog(raw: unknown, fragments: CharacterFragment[] = []): Finding[] {
  const findings: Finding[] = [];

  const parsed = CatalogSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push({
        level: 'error',
        rule: 'schema',
        where: issue.path.join('.') || '(root)',
        message: issue.message,
      });
    }
    return findings;
  }

  const catalog: McpCatalog = parsed.data;
  const known = new Set(catalog.characters);
  const rubricConfig: RubricConfig = {
    baseWeights: catalog.rubric.baseWeights,
    domainExtras: catalog.rubric.domainExtras,
    thresholds: catalog.rubric.thresholds,
  };

  scanForSecrets(catalog, 'catalog', findings);

  const seen = new Set<string>();
  for (const server of catalog.servers) {
    const at = `servers.${server.id}`;
    if (seen.has(server.id)) {
      findings.push({
        level: 'error',
        rule: 'unique-id',
        where: at,
        message: `duplicate server id ${server.id}`,
      });
    }
    seen.add(server.id);

    // Every character named anywhere on the entry must exist.
    for (const [field, list] of [
      ['owners', server.owners],
      ['writeCharacters', server.writeCharacters],
      ['allowedCharacters', server.allowedCharacters],
    ] as const) {
      for (const character of list) {
        if (!known.has(character)) {
          findings.push({
            level: 'error',
            rule: 'character-exists',
            where: `${at}.${field}`,
            message: `unknown character ${character}`,
          });
        }
      }
    }

    if (server.allowedCharacters.length === 0) {
      if (server.status === 'adopted') {
        findings.push({
          level: 'error',
          rule: 'wired-or-candidate',
          where: at,
          message:
            'an adopted server with no allowed characters is wired to nobody; mark it candidate',
        });
      }
    } else {
      for (const owner of server.owners) {
        if (!server.allowedCharacters.includes(owner)) {
          findings.push({
            level: 'error',
            rule: 'owner-allowed',
            where: `${at}.owners`,
            message: `owner ${owner} is not in allowedCharacters`,
          });
        }
      }
      for (const writer of server.writeCharacters) {
        if (!server.allowedCharacters.includes(writer)) {
          findings.push({
            level: 'error',
            rule: 'writer-allowed',
            where: `${at}.writeCharacters`,
            message: `${writer} may write but is not in allowedCharacters`,
          });
        }
      }
    }

    // Destructive tools: Atlas and nobody else.
    //
    // Reachability is recomputed here from the scope classes alone, deliberately ignoring
    // `destructiveTools`. `effectiveToolsFor` filters on both, so asking it would only tell us
    // that it does what it says. Reading the two sources independently is what catches the
    // real mistake: a tool named on the deny list but left classed `write`, which every
    // writing character would then be handed.
    for (const character of server.allowedCharacters) {
      if (character === DESTRUCTIVE_HOLDER) continue;
      const mayWrite = server.writeCharacters.includes(character);
      for (const tool of server.tools) {
        const reachable = tool.scope === 'read' || (tool.scope === 'write' && mayWrite);
        const isDestructive =
          tool.scope === 'destructive' || server.destructiveTools.includes(tool.name);
        if (reachable && isDestructive) {
          findings.push({
            level: 'error',
            rule: 'destructive-atlas-only',
            where: `${at}.allowedCharacters.${character}`,
            message: `${character} would be granted destructive tool ${tool.name}`,
          });
        }
      }
    }

    // Auth: placeholders only, and a credential-taking server must declare at least one.
    if (server.auth.mode === 'none') {
      if (server.auth.brokerPlaceholders.length > 0) {
        findings.push({
          level: 'error',
          rule: 'auth-placeholders',
          where: `${at}.auth`,
          message: 'auth mode none must declare no broker placeholders',
        });
      }
    } else if (server.auth.brokerPlaceholders.length === 0) {
      findings.push({
        level: 'error',
        rule: 'auth-placeholders',
        where: `${at}.auth`,
        message: `auth mode ${server.auth.mode} declares no broker placeholder`,
      });
    }

    // Scope classes: a mutating verb is never read, and destructiveTools must be classed.
    for (const tool of server.tools) {
      if (tool.scope === 'read' && MUTATING_VERBS.some((verb) => tool.name.includes(verb))) {
        findings.push({
          level: 'error',
          rule: 'verb-scope',
          where: `${at}.tools.${tool.name}`,
          message: `${tool.name} names a mutating verb but is classed read`,
        });
      }
      if (server.destructiveTools.includes(tool.name) && tool.scope !== 'destructive') {
        findings.push({
          level: 'error',
          rule: 'destructive-classed',
          where: `${at}.tools.${tool.name}`,
          message: `${tool.name} is on destructiveTools but classed ${tool.scope}`,
        });
      }
    }

    if (server.scopeClass === 'read' && server.destructiveTools.length > 0) {
      findings.push({
        level: 'error',
        rule: 'scope-class',
        where: at,
        message: 'server is classed read but lists destructive tools',
      });
    }

    // The rubric's evidence rule (PAP-209 section 5): 3 or 4 needs a URL or a repo path.
    const criteria = [
      ...Object.entries(server.rubric.scores).map(([id, value]) => [id, value] as const),
      ...server.rubric.extras.map((extra) => [extra.id, extra] as const),
    ];
    for (const [id, value] of criteria) {
      if (
        value.score !== 'na' &&
        value.score >= 3 &&
        !/https?:\/\/|\.[a-z]{2,4}\//.test(value.evidence)
      ) {
        findings.push({
          level: 'error',
          rule: 'evidence',
          where: `${at}.rubric.${id}`,
          message: `score ${value.score} needs a URL or a repo path in evidence`,
        });
      }
    }

    // Stored total must equal the recomputed one, and the verdict must follow the thresholds.
    try {
      const computed = computeRubric(server.rubric, rubricConfig);
      if (computed.total !== server.rubric.total) {
        findings.push({
          level: 'error',
          rule: 'rubric-total',
          where: `${at}.rubric.total`,
          message: `stored ${server.rubric.total}, recomputed ${computed.total}`,
        });
      }
      if (computed.verdict !== server.rubric.verdict) {
        findings.push({
          level: 'error',
          rule: 'rubric-verdict',
          where: `${at}.rubric.verdict`,
          message: `stored ${server.rubric.verdict}, thresholds give ${computed.verdict}`,
        });
      }
    } catch (error) {
      findings.push({
        level: 'error',
        rule: 'rubric-total',
        where: `${at}.rubric`,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    // An inferred tool name is not a fact. It is allowed, but it is on the record as a warning
    // until a live tools/list reconciles it.
    if (server.tools.some((tool) => tool.source === 'inferred') && server.status === 'adopted') {
      findings.push({
        level: 'warn',
        rule: 'tools-inferred',
        where: `${at}.tools`,
        message:
          'adopted server still carries inferred tool names; reconcile against a live tools/list',
      });
    }
  }

  findings.push(...validateFragments(catalog, fragments));
  return findings;
}

function validateFragments(catalog: McpCatalog, fragments: CharacterFragment[]): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(catalog.servers.map((server) => [server.id, server]));

  for (const fragment of fragments) {
    const at = fragment.path;
    scanForSecrets(fragment.data, at, findings);

    if (!catalog.characters.includes(fragment.character)) {
      findings.push({
        level: 'error',
        rule: 'character-exists',
        where: at,
        message: `unknown character ${fragment.character}`,
      });
      continue;
    }

    const data = fragment.data as { mcpServers?: Record<string, Record<string, unknown>> };
    const entries = data.mcpServers;
    if (entries === undefined || typeof entries !== 'object') {
      findings.push({
        level: 'error',
        rule: 'fragment-shape',
        where: at,
        message: 'missing mcpServers object',
      });
      continue;
    }

    for (const [id, entry] of Object.entries(entries)) {
      const server = byId.get(id);
      if (server === undefined) {
        findings.push({
          level: 'error',
          rule: 'fragment-server-known',
          where: `${at}.${id}`,
          message: `${id} is not in the catalogue`,
        });
        continue;
      }
      if (!server.allowedCharacters.includes(fragment.character)) {
        findings.push({
          level: 'error',
          rule: 'fragment-allowed',
          where: `${at}.${id}`,
          message: `${fragment.character} is not in ${id}.allowedCharacters`,
        });
      }
      // A character that may not write gets the read-only endpoint when the vendor ships one.
      const mayWrite = server.writeCharacters.includes(fragment.character);
      const url = typeof entry.url === 'string' ? entry.url : null;
      if (!mayWrite && server.readOnlyUrl !== null && url !== server.readOnlyUrl) {
        findings.push({
          level: 'error',
          rule: 'fragment-readonly-url',
          where: `${at}.${id}.url`,
          message: `${fragment.character} may not write ${id}; use ${server.readOnlyUrl}`,
        });
      }
      if (
        mayWrite &&
        url !== null &&
        server.url !== null &&
        url !== server.url &&
        url !== server.readOnlyUrl
      ) {
        findings.push({
          level: 'error',
          rule: 'fragment-url',
          where: `${at}.${id}.url`,
          message: `${url} is neither the catalogue url nor its read-only variant`,
        });
      }
      // A fragment only ever wires a server the catalogue has actually adopted. A candidate or
      // a server waiting on an account would start a session that cannot authenticate, and a
      // session that fails at boot is indistinguishable from one that was never meant to run.
      if (server.status !== 'adopted') {
        findings.push({
          level: 'error',
          rule: 'fragment-adopted-only',
          where: `${at}.${id}`,
          message: `${id} is ${server.status}; only adopted servers are wired into a bundle`,
        });
      }
      // Every broker token, wherever it sits in the entry, must parse.
      walkStrings(entry, `${at}.${id}`, (text, where) => {
        for (const token of text.match(/broker:[^\s"']+/g) ?? []) {
          if (!brokerPlaceholderPattern.test(token)) {
            findings.push({
              level: 'error',
              rule: 'broker-grammar',
              where,
              message: `${token} is not broker:<service>/<credential>`,
            });
          }
        }
      });
      // And a credential-taking server must be reached with one.
      if (server.auth.mode !== 'none') {
        const declared = JSON.stringify(entry);
        if (!server.auth.brokerPlaceholders.some((placeholder) => declared.includes(placeholder))) {
          findings.push({
            level: 'warn',
            rule: 'fragment-broker-declared',
            where: `${at}.${id}`,
            message: `${id} takes a credential but the fragment names no broker placeholder from the catalogue`,
          });
        }
      }
    }
  }

  return findings;
}

export function errorsOnly(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.level === 'error');
}

/** Exit codes named by PAP-210's interface contract: 0 ok or skipped, 1 drift, 2 missing env. */
export function exitCodeFor(findings: Finding[]): 0 | 1 {
  return errorsOnly(findings).length > 0 ? 1 : 0;
}
