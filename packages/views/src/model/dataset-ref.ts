/**
 * `DatasetRef`: what a view renders from.
 *
 * Two sources exist. A code (entity) dataset is a Drizzle entity another module registered with
 * `registerDataset({ key, ... })`; a custom dataset is tenant data whose `FieldDef[]` live in the
 * `field` table and whose rows live in `record.data jsonb`. The object form is what `ViewSpec`
 * carries and what the `view.dataset_ref jsonb` column stores; the string form `entity:<key>` /
 * `custom:<id>` is the canonical key used in indexes, URLs, `EntityRef.type` and anchors.
 */
import { z } from 'zod';
import { uuidV7Schema } from './shims.js';

/** Custom datasets: hard caps from the PAP-161 spec. */
export const DATASET_LIMITS = {
  /** Maximum `FieldDef[]` length for one dataset. */
  maxFields: 500,
  /** Maximum serialised size of one `record.data` row, in bytes. */
  maxRecordBytes: 100_000,
} as const;

/** A dataset key or field key: lowercase snake slug, 1-64 chars, starts with a letter. */
export const slugSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/, 'slug: lowercase letters, digits and _, 1-64 chars')
  .meta({ id: 'Slug' });
export type Slug = z.infer<typeof slugSchema>;

export const entityDatasetRefSchema = z
  .object({
    kind: z.literal('entity'),
    /** The key passed to `registerDataset()`; also `EntityRef.type` for rows of this dataset. */
    key: slugSchema,
  })
  .strict();

export const customDatasetRefSchema = z
  .object({
    kind: z.literal('custom'),
    /** `dataset.id` (UUIDv7). */
    datasetId: uuidV7Schema,
  })
  .strict();

export const datasetRefSchema = z
  .discriminatedUnion('kind', [entityDatasetRefSchema, customDatasetRefSchema])
  .meta({ id: 'DatasetRef' });
export type DatasetRef = z.infer<typeof datasetRefSchema>;
export type EntityDatasetRef = z.infer<typeof entityDatasetRefSchema>;
export type CustomDatasetRef = z.infer<typeof customDatasetRefSchema>;

const DATASET_REF_KEY = /^(entity|custom):(.+)$/;

/** Canonical string form: `entity:<key>` or `custom:<uuid>`. */
export function formatDatasetRef(ref: DatasetRef): string {
  return ref.kind === 'entity' ? `entity:${ref.key}` : `custom:${ref.datasetId}`;
}

/**
 * Parses the string form. Throws a `ZodError` on anything that is not exactly `entity:<slug>` or
 * `custom:<uuidv7>`; use `datasetRefKeySchema` when a `safeParse` is wanted.
 */
export function parseDatasetRef(key: string): DatasetRef {
  return datasetRefKeySchema.parse(key);
}

/** The string grammar as a schema: parses `entity:key` | `custom:id` into a `DatasetRef`. */
export const datasetRefKeySchema = z
  .string()
  .regex(DATASET_REF_KEY, 'dataset ref: `entity:<key>` or `custom:<id>`')
  .transform((key, ctx): DatasetRef => {
    const match = DATASET_REF_KEY.exec(key);
    const kind = match?.[1];
    const rest = match?.[2] ?? '';
    const parsed =
      kind === 'entity'
        ? entityDatasetRefSchema.safeParse({ kind, key: rest })
        : customDatasetRefSchema.safeParse({ kind, datasetId: rest });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
      }
      return z.NEVER;
    }
    return parsed.data;
  });

/** True when both refs point at the same dataset. */
export function sameDatasetRef(a: DatasetRef, b: DatasetRef): boolean {
  return formatDatasetRef(a) === formatDatasetRef(b);
}
