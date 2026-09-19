/**
 * The dataset registry: how a Drizzle entity becomes something a view can render.
 *
 * `registerDataset()` is the port other modules call (module-system §2.3, contracts §2 row
 * Record). A module hands over its table, the `FieldDef[]` that describe the columns a view may
 * project, a default sort and whether RLS guards the table. The compiler (PAP-163) resolves
 * `DatasetRef`s through `getDataset()`; comments, notifications, search and audit use the dataset
 * key as `EntityRef.type`. Custom datasets (rows in `record`) register through
 * `registerCustomDataset()` from the `dataset` table on load.
 *
 * The registry is a port with an in-memory implementation. `createDatasetRegistry()` makes an
 * isolated instance (tests, one per kernel); the module-level `datasetRegistry` is the default the
 * kernel binds until PAP-489 wires the token. The `table` is opaque here (`unknown`): this package
 * never imports Drizzle, so it stays importable by contracts and the browser.
 */
import { z } from 'zod';
import {
  type CustomDatasetRef,
  type DatasetRef,
  datasetRefSchema,
  formatDatasetRef,
  parseDatasetRef,
  slugSchema,
} from '../model/dataset-ref.js';
import { type FieldDef, type FieldDefInput, fieldDefsSchema } from '../model/field.js';
import { type EntityRef, type Uuid, uuidV7Schema } from '../model/shims.js';
import { type Sort, sortSchema } from '../model/view.js';

/** A resolved dataset: what the compiler and the renderers read. */
export interface DatasetDefinition<TTable = unknown> {
  ref: DatasetRef;
  /** `formatDatasetRef(ref)`: `entity:<key>` or `custom:<id>`. */
  key: string;
  name: string;
  source: 'entity' | 'custom';
  fields: readonly FieldDef[];
  defaultSort: readonly Sort[];
  /** Row-level security guards the table: view permissions only narrow, never widen. */
  rls: boolean;
  /** The Drizzle table for entity datasets; `undefined` for custom datasets. */
  table: TTable | undefined;
}

const registerDatasetInputSchema = z
  .object({
    key: slugSchema,
    name: z.string().min(1).max(120).optional(),
    fields: fieldDefsSchema,
    defaultSort: z.array(sortSchema).max(5).default([]),
    rls: z.boolean(),
  })
  .strict();

export interface RegisterDatasetInput<TTable = unknown> {
  /** Dataset key; also `EntityRef.type` for its rows. */
  key: string;
  /** Display name; defaults to the key. */
  name?: string;
  /** The Drizzle table (opaque to this package). */
  table: TTable;
  fields: FieldDefInput[];
  defaultSort?: Sort[];
  /** Whether Postgres RLS (PAP-34) guards the table. Entity datasets normally say `true`. */
  rls: boolean;
}

const registerCustomDatasetInputSchema = z
  .object({
    datasetId: uuidV7Schema,
    name: z.string().min(1).max(120),
    fields: fieldDefsSchema,
    defaultSort: z.array(sortSchema).max(5).default([]),
  })
  .strict();

export interface RegisterCustomDatasetInput {
  /** `dataset.id` (UUIDv7). */
  datasetId: Uuid;
  name: string;
  fields: FieldDefInput[];
  defaultSort?: Sort[];
}

export class DatasetRegistryError extends Error {
  constructor(
    message: string,
    readonly code: 'DUPLICATE' | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'DatasetRegistryError';
  }
}

/** The port. Implementations must be safe to call at module load time (no I/O). */
export interface DatasetRegistryPort {
  /** Registers a code (entity) dataset. Throws `DUPLICATE` when the key is taken. */
  register<TTable>(input: RegisterDatasetInput<TTable>): DatasetDefinition<TTable>;
  /** Registers a custom dataset from its `dataset` row. Throws `DUPLICATE` when the id is taken. */
  registerCustom(input: RegisterCustomDatasetInput): DatasetDefinition<undefined>;
  /** Looks a dataset up by ref or by its string key; `undefined` when unknown. */
  get(ref: DatasetRef | string): DatasetDefinition | undefined;
  /** Like `get` but throws `NOT_FOUND`. */
  resolve(ref: DatasetRef | string): DatasetDefinition;
  has(ref: DatasetRef | string): boolean;
  /** Every registered dataset, entity datasets first, each group in registration order. */
  list(): DatasetDefinition[];
  /** Removes one dataset (custom dataset deleted, module unloaded). Returns whether it existed. */
  unregister(ref: DatasetRef | string): boolean;
  /** Empties the registry. Tests only. */
  clear(): void;
}

function toKey(ref: DatasetRef | string): string {
  return typeof ref === 'string' ? formatDatasetRef(parseDatasetRef(ref)) : formatDatasetRef(ref);
}

export function createDatasetRegistry(): DatasetRegistryPort {
  const byKey = new Map<string, DatasetDefinition>();

  const registry: DatasetRegistryPort = {
    register<TTable>(input: RegisterDatasetInput<TTable>): DatasetDefinition<TTable> {
      const { table, ...rest } = input;
      const parsed = registerDatasetInputSchema.parse(rest);
      const ref: DatasetRef = { kind: 'entity', key: parsed.key };
      const key = formatDatasetRef(ref);
      if (byKey.has(key)) {
        throw new DatasetRegistryError(`dataset '${key}' is already registered`, 'DUPLICATE');
      }
      const definition: DatasetDefinition<TTable> = {
        ref,
        key,
        name: parsed.name ?? parsed.key,
        source: 'entity',
        fields: parsed.fields,
        defaultSort: parsed.defaultSort,
        rls: parsed.rls,
        table,
      };
      byKey.set(key, definition);
      return definition;
    },
    registerCustom(input) {
      const parsed = registerCustomDatasetInputSchema.parse(input);
      const ref: CustomDatasetRef = { kind: 'custom', datasetId: parsed.datasetId };
      const key = formatDatasetRef(ref);
      if (byKey.has(key)) {
        throw new DatasetRegistryError(`dataset '${key}' is already registered`, 'DUPLICATE');
      }
      const definition: DatasetDefinition<undefined> = {
        ref,
        key,
        name: parsed.name,
        source: 'custom',
        fields: parsed.fields,
        defaultSort: parsed.defaultSort,
        // Custom datasets live in `record`, which PAP-34 guards by tenant.
        rls: true,
        table: undefined,
      };
      byKey.set(key, definition);
      return definition;
    },
    get(ref) {
      return byKey.get(toKey(ref));
    },
    resolve(ref) {
      const found = byKey.get(toKey(ref));
      if (!found) {
        throw new DatasetRegistryError(`dataset '${toKey(ref)}' is not registered`, 'NOT_FOUND');
      }
      return found;
    },
    has(ref) {
      return byKey.has(toKey(ref));
    },
    list() {
      const all = [...byKey.values()];
      return [
        ...all.filter((d) => d.source === 'entity'),
        ...all.filter((d) => d.source === 'custom'),
      ];
    },
    unregister(ref) {
      return byKey.delete(toKey(ref));
    },
    clear() {
      byKey.clear();
    },
  };
  return registry;
}

/** The default registry the kernel binds until PAP-489 wires the DI token. */
export const datasetRegistry: DatasetRegistryPort = createDatasetRegistry();

/** `registerDataset({ key, table, fields, defaultSort, rls })` against the default registry. */
export function registerDataset<TTable>(
  input: RegisterDatasetInput<TTable>,
): DatasetDefinition<TTable> {
  return datasetRegistry.register(input);
}

export function registerCustomDataset(
  input: RegisterCustomDatasetInput,
): DatasetDefinition<undefined> {
  return datasetRegistry.registerCustom(input);
}

/** `getDataset(ref)` against the default registry; `undefined` when unknown. */
export function getDataset(ref: DatasetRef | string): DatasetDefinition | undefined {
  return datasetRegistry.get(ref);
}

/**
 * The `EntityRef` for one row of a dataset: `type` is the dataset key for entity datasets and
 * the string ref (`custom:<id>`) is not a valid `EntityRef.type`, so custom rows use the dataset
 * id as type. Comments, notifications, search and audit store this as `entity_type, entity_id`.
 */
export function toEntityRef(ref: DatasetRef, recordId: Uuid): EntityRef {
  const parsed = datasetRefSchema.parse(ref);
  return parsed.kind === 'entity'
    ? { type: parsed.key, id: recordId }
    : { type: `custom_${parsed.datasetId.replaceAll('-', '')}`, id: recordId };
}
