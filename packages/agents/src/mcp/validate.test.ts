/**
 * The validator's own tests: each rule is given a catalogue that breaks exactly that rule.
 * Fixtures are built by mutating a deep clone of a minimal valid catalogue, so a rule can only
 * pass here by catching the thing it names.
 */
import { describe, expect, it } from 'vitest';
import { computeRubric } from './rubric.js';
import type { McpCatalog } from './schema.js';
import { type CharacterFragment, errorsOnly, validateCatalog } from './validate.js';

function baseCatalog(): McpCatalog {
  return structuredClone({
    catalogVersion: 1,
    issue: 'PAP-210',
    adr: 'docs/adr/0021-mcp-catalog.md',
    updatedAt: '2026-09-19',
    note: 'fixture',
    characters: ['atlas', 'ledger'],
    rubric: {
      source: 'fixture',
      baseWeights: { license: 20, maintenance: 20, bundle: 15, a11y: 15, ts: 15, agent: 15 },
      domainExtras: { scopeSafety: { weight: 10, what: 'x', anchors: { '4': 'a' } } },
      gatesNotApplicable: [],
      gatesNotApplicableReason: 'fixture',
      thresholds: { adopt: 75, trial: 60 },
    },
    denied: [],
    servers: [
      {
        id: 'demo',
        name: 'Demo',
        kind: 'remote',
        transport: 'http',
        url: 'https://mcp.example.com/mcp',
        readOnlyUrl: 'https://mcp.example.com/mcp/readonly',
        package: null,
        version: null,
        auth: {
          mode: 'bearer',
          brokerPlaceholders: ['broker:demo/api-key'],
          headless: true,
          notes: 'fixture',
        },
        scopeClass: 'destructive',
        toolsComplete: true,
        tools: [
          { name: 'list_things', scope: 'read', source: 'docs' },
          { name: 'update_thing', scope: 'write', source: 'docs' },
          { name: 'delete_thing', scope: 'destructive', source: 'docs' },
        ],
        destructiveTools: ['delete_thing'],
        destructiveNote: 'fixture',
        owners: ['ledger'],
        writeCharacters: ['ledger', 'atlas'],
        allowedCharacters: ['atlas', 'ledger'],
        sandbox: { available: true, how: 'fixture' },
        vendorRateLimit: 'fixture',
        budgetPerSession: 10,
        docsUrl: 'https://example.com/docs',
        healthCheck: 'fixture',
        aliases: [],
        prefer: null,
        status: 'adopted',
        verifiedOn: '2026-09-19',
        rubric: {
          scores: {
            license: { score: 4, evidence: 'https://example.com/license' },
            maintenance: { score: 4, evidence: 'https://example.com/releases' },
            bundle: { score: 'na', evidence: 'hosted' },
            a11y: { score: 'na', evidence: 'no ui' },
            ts: { score: 'na', evidence: 'no js' },
            agent: { score: 4, evidence: 'https://example.com/docs' },
          },
          extras: [{ id: 'scopeSafety', score: 4, evidence: 'https://example.com/readonly' }],
          total: 100,
          verdict: 'adopt',
        },
      },
    ],
  } satisfies McpCatalog);
}

function fragment(servers: Record<string, unknown>, character = 'ledger'): CharacterFragment {
  return { character, path: `.claude/agents/${character}/mcp.json`, data: { mcpServers: servers } };
}

function rules(catalog: McpCatalog, fragments: CharacterFragment[] = []): string[] {
  return errorsOnly(validateCatalog(catalog, fragments)).map((finding) => finding.rule);
}

describe('validateCatalog', () => {
  it('passes a well-formed fixture', () => {
    expect(rules(baseCatalog())).toEqual([]);
  });

  it('rejects a tool with no scope class', () => {
    const catalog = baseCatalog();
    const tools = catalog.servers[0]?.tools as unknown as Array<Record<string, unknown>>;
    delete tools[0]?.scope;
    expect(rules(catalog)).toContain('schema');
  });

  it('rejects a mutating verb classed read', () => {
    const catalog = baseCatalog();
    const tool = catalog.servers[0]?.tools[1];
    if (tool !== undefined) tool.scope = 'read';
    expect(rules(catalog)).toContain('verb-scope');
  });

  it('rejects an unknown character in an allowlist', () => {
    const catalog = baseCatalog();
    catalog.servers[0]?.allowedCharacters.push('atals');
    expect(rules(catalog)).toContain('character-exists');
  });

  it('rejects a destructive tool reaching a character other than Atlas', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) {
      const tool = server.tools[2];
      if (tool !== undefined) tool.scope = 'write';
      server.destructiveTools = [];
    }
    // The tool is now write-scoped, so Ledger gets it; the deny list still names it.
    const withDeny = structuredClone(catalog);
    const denyServer = withDeny.servers[0];
    if (denyServer !== undefined) denyServer.destructiveTools = ['delete_thing'];
    expect(rules(withDeny)).toContain('destructive-atlas-only');
  });

  it('rejects a raw Stripe key anywhere in the catalogue', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) server.auth.notes = 'use rk_test_51Habcdefghijklmnop for the sandbox';
    expect(rules(catalog)).toContain('no-raw-secrets');
  });

  it('allows prose that names a key prefix without a value, because the deny list has to', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) server.auth.notes = 'any sk_live_ use is denied outright';
    expect(rules(catalog)).toEqual([]);
  });

  it('rejects a credential-taking server with no broker placeholder', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) server.auth.brokerPlaceholders = [];
    expect(rules(catalog)).toContain('auth-placeholders');
  });

  it('rejects a stored rubric total that does not follow from its scores', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) server.rubric.total = 99;
    expect(rules(catalog)).toContain('rubric-total');
  });

  it('rejects a high score with no evidence URL', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) server.rubric.scores.license.evidence = 'the docs say it is fine';
    expect(rules(catalog)).toContain('evidence');
  });

  it('rejects a duplicate server id', () => {
    const catalog = baseCatalog();
    const first = catalog.servers[0];
    if (first !== undefined) catalog.servers.push(structuredClone(first));
    expect(rules(catalog)).toContain('unique-id');
  });
});

describe('validateCatalog, character fragments', () => {
  it('accepts a fragment that matches the catalogue', () => {
    const entry = {
      type: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { Authorization: 'Bearer broker:demo/api-key' },
    };
    expect(rules(baseCatalog(), [fragment({ demo: entry })])).toEqual([]);
  });

  it('rejects a server the catalogue does not know', () => {
    expect(
      rules(baseCatalog(), [fragment({ ghost: { type: 'http', url: 'https://x.example.com' } })]),
    ).toContain('fragment-server-known');
  });

  it('rejects a character not on the allowlist', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) {
      server.allowedCharacters = ['atlas'];
      server.owners = ['atlas'];
      server.writeCharacters = ['atlas'];
    }
    const entry = { type: 'http', url: 'https://mcp.example.com/mcp' };
    expect(rules(catalog, [fragment({ demo: entry })])).toContain('fragment-allowed');
  });

  it('rejects a read-only character pointed at the read-write endpoint', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) server.writeCharacters = ['atlas'];
    const entry = { type: 'http', url: 'https://mcp.example.com/mcp' };
    expect(rules(catalog, [fragment({ demo: entry })])).toContain('fragment-readonly-url');
  });

  it('rejects a malformed broker placeholder', () => {
    const entry = {
      type: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { Authorization: 'Bearer broker:DEMO_KEY' },
    };
    expect(rules(baseCatalog(), [fragment({ demo: entry })])).toContain('broker-grammar');
  });

  it('rejects a literal bearer token in a fragment', () => {
    const entry = {
      type: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { Authorization: 'Bearer abcdef0123456789abcdef' },
    };
    expect(rules(baseCatalog(), [fragment({ demo: entry })])).toContain('no-raw-secrets');
  });

  it('rejects wiring a server the catalogue has not adopted', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server !== undefined) server.status = 'candidate';
    const entry = {
      type: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { Authorization: 'Bearer broker:demo/api-key' },
    };
    expect(rules(catalog, [fragment({ demo: entry })])).toContain('fragment-adopted-only');
  });
});

describe('computeRubric', () => {
  it('rescales n/a criteria across the remaining base weights', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    expect(server).toBeDefined();
    if (server === undefined) return;
    const computed = computeRubric(server.rubric, catalog.rubric);
    // license, maintenance and agent survive (20 + 20 + 15 = 55 of the base 100), rescaled to
    // the 90 the single extra leaves; all four scores are 4, so the total is the full 100.
    expect(computed.total).toBe(100);
    expect(computed.rescaledWeights.license).toBeCloseTo((20 / 55) * 90, 6);
    expect(computed.rescaledWeights.scopeSafety).toBe(10);
  });

  it('halves the total when every surviving score halves', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server === undefined) return;
    server.rubric.scores.license.score = 2;
    server.rubric.scores.maintenance.score = 2;
    server.rubric.scores.agent.score = 2;
    const extra = server.rubric.extras[0];
    if (extra !== undefined) extra.score = 2;
    expect(computeRubric(server.rubric, catalog.rubric).total).toBe(50);
  });

  it('refuses an extra scored na rather than handing it its weight', () => {
    const catalog = baseCatalog();
    const server = catalog.servers[0];
    if (server === undefined) return;
    const extra = server.rubric.extras[0];
    if (extra !== undefined) extra.score = 'na';
    expect(() => computeRubric(server.rubric, catalog.rubric)).toThrow(/scored na/);
  });
});
