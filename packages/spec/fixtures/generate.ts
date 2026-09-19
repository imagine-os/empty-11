/**
 * Synthetic spec corpus generator for benchmarks and stress tests.
 * Produces deterministic page specs with a fixed seed.
 *
 * Usage:
 *   generateCorpus({ size: 'medium', seed: 42 })
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Simple deterministic random number generator
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // Linear congruential generator
    this.state = Math.abs(seed) || 1;
  }

  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  choose<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

interface GenerateOptions {
  size: 'small' | 'medium' | 'large';
  seed: number;
  outputDir?: string;
}

interface CorpusSize {
  pages: number;
  entitiesPerPage: number;
  audiences: string[];
}

const SIZES: Record<'small' | 'medium' | 'large', CorpusSize> = {
  small: { pages: 10, entitiesPerPage: 5, audiences: ['customer.basic'] },
  medium: {
    pages: 60,
    entitiesPerPage: 20,
    audiences: ['customer.basic', 'staff.admin', 'agent.builder'],
  },
  large: {
    pages: 300,
    entitiesPerPage: 60,
    audiences: ['customer.basic', 'staff.admin', 'agent.builder'],
  },
};

const PAGE_KINDS = ['list', 'detail', 'form', 'dashboard', 'settings'];
const SURFACES = ['customer', 'staff', 'agent'];
const ACTIONS = ['create', 'edit', 'delete', 'approve', 'export', 'refresh', 'filter', 'search'];
const ENTITIES = [
  'invoice',
  'order',
  'user',
  'product',
  'report',
  'document',
  'setting',
  'member',
  'project',
  'task',
  'template',
  'config',
  'status',
  'event',
  'log',
  'audit',
];

function generatePageId(rng: SeededRandom, index: number): string {
  const entity = ENTITIES[index % ENTITIES.length];
  return `fx-${entity}-${String(index).padStart(4, '0')}`;
}

function generatePageTitle(rng: SeededRandom, kind: string, entity: string): string {
  const titles: Record<string, string[]> = {
    list: ['All', 'Recent', 'Active'],
    detail: ['View', 'Manage', 'Edit'],
    form: ['Create', 'Add', 'New'],
    dashboard: ['Dashboard', 'Overview', 'Analytics'],
    settings: ['Settings', 'Configuration', 'Preferences'],
  };

  const prefix = rng.choose(titles[kind] || ['Page']);
  return `${prefix} ${entity}`;
}

function generateRoute(rng: SeededRandom, entity: string): string {
  return `/${entity}s`;
}

function generatePageSpec(
  rng: SeededRandom,
  options: CorpusSize,
  index: number,
): Record<string, unknown> {
  const kind =
    PAGE_KINDS[Math.floor((index / (options.pages / PAGE_KINDS.length)) % PAGE_KINDS.length)];
  const entity = ENTITIES[index % ENTITIES.length];
  const id = generatePageId(rng, index);
  const title = generatePageTitle(rng, kind, entity);
  const route = generateRoute(rng, entity);
  const surface = SURFACES[index % SURFACES.length];
  const audience = rng.choose(options.audiences);

  const spec: Record<string, unknown> = {
    meta: {
      id,
      title: { id: `${id}.title`, default: title },
      route,
      surface,
      owner: 'spec-builder',
      status: 'ready',
      specVersion: 1,
      tags: ['generated', kind, entity],
    },
    purpose: {
      summary: `This is a generated ${kind} page for ${entity} showing synthetic data for stress testing.`,
      successMetric: 'Users can efficiently perform operations on this page.',
    },
    logic: {
      actions: generateActions(rng, entity, options.entitiesPerPage),
    },
    access: {
      view: [audience.split('.')[0]],
      actions: {},
    },
    data: {
      entities: [entity],
      queries: {
        items: {
          entity,
          filter: { op: 'and', children: [] },
          sort: [{ field: 'updatedAt', dir: 'desc' }],
          fields: generateFields(rng, options.entitiesPerPage),
          sync: 'live',
          page: 25,
        },
      },
    },
    layout: {
      template: 'app',
      slots: { main: {}, inspector: { collapsible: true, defaultCollapsed: true } },
    },
    components: generateComponents(rng, kind),
    states: generateStates(rng),
    edgeCases: generateEdgeCases(rng),
  };

  return spec;
}

function generateActions(
  rng: SeededRandom,
  entity: string,
  count: number,
): Record<string, unknown> {
  const actions: Record<string, unknown> = {};

  // Always create at least one action
  actions[`${ACTIONS[0]}${entity}`] = {
    intent: { id: `action.${ACTIONS[0]}`, default: ACTIONS[0] },
    permission: `${entity}.${ACTIONS[0]}`,
    steps: [`Perform the ${ACTIONS[0]} operation on ${entity}.`],
    input: { id: 'uuid' },
  };

  // Add a retry action for error states
  actions.retry = {
    intent: { id: 'action.retry', default: 'retry' },
    permission: 'page.view',
    steps: ['Re-run the query.'],
  };

  return actions;
}

function generateFields(rng: SeededRandom, count: number): string[] {
  const allFields = [
    'id',
    'name',
    'status',
    'createdAt',
    'updatedAt',
    'owner',
    'description',
    'priority',
    'type',
  ];
  return allFields.slice(0, Math.min(count / 5, allFields.length));
}

function generateComponents(rng: SeededRandom, kind: string): Array<Record<string, unknown>> {
  const baseComponents = [
    { id: 'ui.heading', key: 'title', props: { level: 1, text: 'page.title' } },
  ];

  if (kind === 'list' || kind === 'dashboard') {
    baseComponents.push({ id: 'ui.dataTable', key: 'table', props: { variant: 'default' } });
  } else if (kind === 'form') {
    baseComponents.push(
      { id: 'ui.textInput', key: 'nameField', props: { label: 'Name' } },
      { id: 'ui.button', key: 'submitBtn', props: { text: 'Submit', variant: 'primary' } },
    );
  } else if (kind === 'detail') {
    baseComponents.push(
      { id: 'ui.card', key: 'detailCard', props: { variant: 'default' } },
      { id: 'ui.button', key: 'editBtn', props: { text: 'Edit', variant: 'secondary' } },
    );
  }

  return baseComponents;
}

function generateStates(rng: SeededRandom): Record<string, unknown> {
  return {
    loading: { copy: 'states.loading', component: 'ui.loadingState' },
    error: { copy: 'states.error', component: 'ui.errorState', action: 'retry' },
    empty: { copy: 'states.empty' },
    offline: { copy: 'states.offline', component: 'ui.offlineBanner', action: 'retry' },
    denied: { copy: 'states.denied', component: 'ui.deniedState' },
  };
}

function generateEdgeCases(rng: SeededRandom): Array<Record<string, unknown>> {
  return [
    {
      id: 'edge-case-1',
      scenario: 'User performs action with invalid input',
      expected: 'Page shows validation error',
      test: 'unit',
    },
    {
      id: 'edge-case-2',
      scenario: 'Network request fails',
      expected: 'Page enters error state',
      test: 'e2e',
    },
    {
      id: 'edge-case-3',
      scenario: 'User has insufficient permissions',
      expected: 'Page shows access denied message',
      test: 'manual',
    },
  ];
}

function specToYaml(spec: Record<string, unknown>): string {
  return yamlStringify(spec, 0);
}

function yamlStringify(obj: unknown, indent = 0): string {
  const spaces = ' '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj.length === 0) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const lines: string[] = [];
    for (const item of obj) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Nested object in array
        const itemStr = yamlStringify(item, indent + 2);
        lines.push(`${spaces}- ${itemStr.substring(indent + 2)}`);
      } else if (Array.isArray(item)) {
        // Nested array in array (rare)
        const itemStr = yamlStringify(item, indent + 2);
        lines.push(`${spaces}-${itemStr}`);
      } else {
        // Primitive value
        const itemStr = yamlStringify(item, 0);
        lines.push(`${spaces}- ${itemStr}`);
      }
    }
    return '\n' + lines.join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);

    // Empty object
    if (entries.length === 0) {
      return '{}';
    }

    const lines: string[] = [];
    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${spaces}${key}: []`);
        } else {
          lines.push(`${spaces}${key}:`);
          const arrStr = yamlStringify(value, indent + 2);
          lines.push(arrStr);
        }
      } else if (typeof value === 'object' && value !== null) {
        const objStr = yamlStringify(value, indent + 2);
        if (objStr === '{}') {
          lines.push(`${spaces}${key}: {}`);
        } else {
          lines.push(`${spaces}${key}:`);
          lines.push(objStr);
        }
      } else {
        const valueStr = yamlStringify(value, 0);
        lines.push(`${spaces}${key}: ${valueStr}`);
      }
    }
    return lines.join('\n');
  }

  return String(obj);
}

async function generateCorpus(options: GenerateOptions): Promise<void> {
  const rng = new SeededRandom(options.seed);
  const sizeConfig = SIZES[options.size];
  const outputBase =
    options.outputDir || resolve(import.meta.dirname, `../fixtures/corpus/${options.size}`);

  // Create directory
  mkdirSync(outputBase, { recursive: true });

  const specs: Array<{ id: string; hash: string }> = [];

  // Generate page specs
  for (let i = 0; i < sizeConfig.pages; i++) {
    const spec = generatePageSpec(rng, sizeConfig, i);
    const yaml = specToYaml(spec);
    const id =
      spec.meta && typeof spec.meta === 'object' && 'id' in spec.meta
        ? (spec.meta.id as string)
        : `page-${i}`;

    const outputPath = resolve(outputBase, `${id}.spec.yaml`);
    mkdirSync(dirname(outputPath), { recursive: true });
    const schemaHeader = '# yaml-language-server: $schema=../../schema/page.spec.schema.json';
    writeFileSync(outputPath, `${schemaHeader}\n# Generated spec for stress testing\n${yaml}\n`);

    // Calculate simple hash
    const hash = calculateHash(yaml);
    specs.push({ id, hash });
  }

  // Generate app spec
  const appSpec = {
    meta: { id: 'app', title: 'Generated App', specVersion: 1 },
    pages: specs.map((s) => ({ route: `/${s.id}`, spec: `${s.id}.spec.yaml` })),
  };

  const appYaml = specToYaml(appSpec);
  writeFileSync(resolve(outputBase, 'app.spec.yaml'), `# Generated app spec\n${appYaml}\n`);

  // Write manifest
  const manifest = {
    corpusVersion: 1,
    seed: options.seed,
    size: options.size,
    pageCount: sizeConfig.pages,
    generatedAt: new Date().toISOString(),
    specs,
  };

  writeFileSync(resolve(outputBase, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Generated ${sizeConfig.pages} specs in ${outputBase}`);
}

function calculateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const sizeArg = process.argv[2] as 'small' | 'medium' | 'large' | undefined;
  const seedArg = process.argv[3] ? parseInt(process.argv[3], 10) : 42;
  const size = sizeArg || 'medium';

  generateCorpus({ size, seed: seedArg })
    .then(() => {
      console.log('Corpus generation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Corpus generation failed:', error);
      process.exit(1);
    });
}

export { generateCorpus, SeededRandom };
