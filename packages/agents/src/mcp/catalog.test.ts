import { describe, expect, it } from 'vitest';
import { CATALOG_PATH, loadCatalogJson, loadFragments } from './load.js';
import { computeRubric } from './rubric.js';
import {
  brokerPlaceholderPattern,
  CatalogSchema,
  DESTRUCTIVE_HOLDER,
  LEAD_CHARACTERS,
  type McpCatalog,
  qualifiedToolName,
  qualifiedToolNamePattern,
} from './schema.js';
import { effectiveToolsFor, errorsOnly, exitCodeFor, validateCatalog } from './validate.js';

const raw = loadCatalogJson();
const catalog: McpCatalog = CatalogSchema.parse(raw);
const fragments = loadFragments(catalog.characters);

describe(CATALOG_PATH, () => {
  it('parses against the schema', () => {
    expect(catalog.servers.length).toBe(11);
  });

  it('has no findings at error level, catalogue and fragments together', () => {
    const findings = validateCatalog(raw, fragments);
    expect(errorsOnly(findings)).toEqual([]);
    expect(exitCodeFor(findings)).toBe(0);
  });

  it('covers every server PAP-210 names', () => {
    const ids = catalog.servers.map((server) => server.id).sort();
    expect(ids).toEqual(
      [
        'forgejo',
        'gamma',
        'github',
        'google-drive',
        'linear',
        'miro',
        'notion',
        'playwright',
        'postgres',
        'stripe',
        'webflow',
      ].sort(),
    );
  });

  it('lists the nine leads and nothing else', () => {
    expect(catalog.characters).toEqual([...LEAD_CHARACTERS]);
  });

  it('records the archived reference Postgres server as denied rather than forgetting it', () => {
    const denied = catalog.denied.find(
      (entry) => entry.package === '@modelcontextprotocol/server-postgres',
    );
    expect(denied?.supersededBy).toBe('postgres');
  });

  it('declares every credential as a broker placeholder and never a value', () => {
    for (const server of catalog.servers) {
      for (const placeholder of server.auth.brokerPlaceholders) {
        expect(placeholder).toMatch(brokerPlaceholderPattern);
      }
    }
  });

  it('gives every tool a scope class', () => {
    for (const server of catalog.servers) {
      for (const tool of server.tools) {
        expect(['read', 'write', 'destructive']).toContain(tool.scope);
      }
    }
  });

  it('reproduces every stored rubric total from its scores', () => {
    for (const server of catalog.servers) {
      const computed = computeRubric(server.rubric, catalog.rubric);
      expect({ id: server.id, total: computed.total, verdict: computed.verdict }).toEqual({
        id: server.id,
        total: server.rubric.total,
        verdict: server.rubric.verdict,
      });
    }
  });
});

describe('destructive tools are Atlas-only', () => {
  it('grants no destructive tool to any other character', () => {
    for (const server of catalog.servers) {
      for (const character of server.allowedCharacters) {
        if (character === DESTRUCTIVE_HOLDER) continue;
        const granted = effectiveToolsFor(server, character);
        for (const name of server.destructiveTools) expect(granted).not.toContain(name);
      }
    }
  });

  it('keeps stripe_api_write away from Ledger, who owns Stripe', () => {
    const stripe = catalog.servers.find((server) => server.id === 'stripe');
    expect(stripe).toBeDefined();
    if (stripe === undefined) return;
    expect(effectiveToolsFor(stripe, 'ledger')).not.toContain('stripe_api_write');
    expect(effectiveToolsFor(stripe, 'atlas')).toContain('stripe_api_write');
  });

  it('keeps execute_sql away from Forge, who owns Postgres', () => {
    const postgres = catalog.servers.find((server) => server.id === 'postgres');
    expect(postgres).toBeDefined();
    if (postgres === undefined) return;
    expect(effectiveToolsFor(postgres, 'forge')).not.toContain('execute_sql');
    expect(effectiveToolsFor(postgres, 'atlas')).toContain('execute_sql');
  });

  it('gives a non-writing character read tools only', () => {
    const linear = catalog.servers.find((server) => server.id === 'linear');
    expect(linear).toBeDefined();
    if (linear === undefined) return;
    const granted = effectiveToolsFor(linear, 'scout');
    expect(granted).toContain('list_issues');
    expect(granted).not.toContain('create_issue');
  });
});

describe('character fragments', () => {
  it('exists for each of the nine leads', () => {
    expect(fragments.map((fragment) => fragment.character)).toEqual([...LEAD_CHARACTERS]);
  });

  it('wires only servers the catalogue adopted', () => {
    const adopted = new Set(
      catalog.servers.filter((server) => server.status === 'adopted').map((server) => server.id),
    );
    for (const fragment of fragments) {
      const data = fragment.data as { mcpServers: Record<string, unknown> };
      for (const id of Object.keys(data.mcpServers)) expect(adopted).toContain(id);
    }
  });

  it('gives a non-writing character the read-only endpoint', () => {
    const scout = fragments.find((fragment) => fragment.character === 'scout');
    const data = scout?.data as { mcpServers: Record<string, { url?: string }> };
    expect(data.mcpServers.linear?.url).toBe('https://mcp.linear.app/mcp/readonly');
  });
});

describe('tool name grammar', () => {
  it('builds mcp__<server>__<tool>', () => {
    expect(qualifiedToolName('linear', 'list_issues')).toBe('mcp__linear__list_issues');
  });

  it('accepts every catalogue tool and rejects a bare name', () => {
    for (const server of catalog.servers) {
      for (const tool of server.tools) {
        expect(qualifiedToolName(server.id, tool.name)).toMatch(qualifiedToolNamePattern);
      }
    }
    expect('list_issues').not.toMatch(qualifiedToolNamePattern);
  });
});
