/**
 * `FieldDef` and the closed `FieldType` set.
 *
 * The type names are fixed here so that every issue that adds behaviour for a type (PAP-338,
 * PAP-339, PAP-340, PAP-616, PAP-622, PAP-627, PAP-174) registers under a name the view model,
 * the compiler and the spec builder already know. Adding a name later is a breaking change for
 * consumers that switch on the enum (module-system §2.1), which is why the round-4 additions are
 * reserved now. Per-type `options` shapes are owned by the type's `defineFieldType()` (PAP-164);
 * the view model stores them as an open record and never validates them.
 */
import { z } from 'zod';
import { DATASET_LIMITS, slugSchema } from './dataset-ref.js';

/** Every field type name, grouped by the issue that ships its behaviour. */
export const FIELD_TYPES = [
  // PAP-338: framework and primitive types
  'text',
  'longText',
  'number',
  'currency',
  'percent',
  'date',
  'checkbox',
  'rating',
  'url',
  'email',
  'phone',
  // PAP-339: choice, people and attachment types
  'select',
  'multiSelect',
  'user',
  'attachment',
  // PAP-340: relational and computed types
  'relation',
  'lookup',
  'rollup',
  'formula',
  // PAP-622 (map view) and PAP-174 / PAP-388 (automations)
  'geo',
  'button',
  // PAP-616: read-only system fields
  'autonumber',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
  // PAP-627: additional value types
  'richText',
  'duration',
  'time',
  'progress',
  'json',
] as const;

export const fieldTypeSchema = z.enum(FIELD_TYPES).meta({ id: 'FieldType' });
export type FieldType = z.infer<typeof fieldTypeSchema>;

/** Which issue owns each type's `defineFieldType()`; the docs table renders from this. */
export const FIELD_TYPE_OWNERS: Readonly<Record<FieldType, `PAP-${number}`>> = {
  text: 'PAP-338',
  longText: 'PAP-338',
  number: 'PAP-338',
  currency: 'PAP-338',
  percent: 'PAP-338',
  date: 'PAP-338',
  checkbox: 'PAP-338',
  rating: 'PAP-338',
  url: 'PAP-338',
  email: 'PAP-338',
  phone: 'PAP-338',
  select: 'PAP-339',
  multiSelect: 'PAP-339',
  user: 'PAP-339',
  attachment: 'PAP-339',
  relation: 'PAP-340',
  lookup: 'PAP-340',
  rollup: 'PAP-340',
  formula: 'PAP-340',
  geo: 'PAP-622',
  button: 'PAP-388',
  autonumber: 'PAP-616',
  createdTime: 'PAP-616',
  lastModifiedTime: 'PAP-616',
  createdBy: 'PAP-616',
  lastModifiedBy: 'PAP-616',
  richText: 'PAP-627',
  duration: 'PAP-627',
  time: 'PAP-627',
  progress: 'PAP-627',
  json: 'PAP-627',
};

/** Types whose value is derived, never written by a user: `FieldDef.computed` must be `true`. */
export const COMPUTED_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'lookup',
  'rollup',
  'formula',
  'autonumber',
  'createdTime',
  'lastModifiedTime',
  'createdBy',
  'lastModifiedBy',
]);

export function isComputedFieldType(type: FieldType): boolean {
  return COMPUTED_FIELD_TYPES.has(type);
}

/** Types that hold several values per record; grouping on them follows `Group.expandMulti`. */
export const MULTI_VALUE_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'multiSelect',
  'user',
  'attachment',
  'relation',
  'lookup',
]);

/**
 * A field id. Custom datasets use the `field.id` UUIDv7; code datasets registered with
 * `registerDataset()` use a stable string (by convention the field key). Both are opaque to the
 * view model: `ViewSpec` references fields by this id only, never by key or name.
 */
export const fieldIdSchema = z.string().min(1).max(64).meta({ id: 'FieldId' });
export type FieldId = z.infer<typeof fieldIdSchema>;

export const fieldDefSchema = z
  .object({
    id: fieldIdSchema,
    /** Slug used in `record.data[key]`, formulas and the API. Unique within a dataset. */
    key: slugSchema,
    name: z.string().min(1).max(120),
    type: fieldTypeSchema,
    /** Per-type options; validated by the type's `optionsSchema` (PAP-164), stored open here. */
    options: z.record(z.string(), z.unknown()).default({}),
    required: z.boolean().default(false),
    unique: z.boolean().default(false),
    hidden: z.boolean().default(false),
    /** Derived value (lookup, rollup, formula, system fields). Never editable. */
    computed: z.boolean().default(false),
    /** Round 4: header tooltip and form help text. */
    description: z.string().max(500).optional(),
    /** Round 4: the `FieldGroup` the record page and forms render (PAP-333, PAP-667). */
    group: z.string().min(1).max(64).optional(),
    /** Round 4: reserved; shape owned by PAP-628 (static value or dynamic token). */
    defaultValue: z.unknown().optional(),
    /** Round 4: reserved; shape owned by PAP-638 (per-audience read and write rules). */
    permissions: z.unknown().optional(),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (isComputedFieldType(field.type) && !field.computed) {
      ctx.addIssue({
        code: 'custom',
        path: ['computed'],
        message: `field type '${field.type}' is derived: computed must be true`,
      });
    }
  });

export type FieldDef = z.infer<typeof fieldDefSchema>;
export type FieldDefInput = z.input<typeof fieldDefSchema>;

/**
 * A dataset's field list: at most `DATASET_LIMITS.maxFields`, ids and keys unique. This is the
 * shape `registerDataset()` takes and the `field` table stores per custom dataset.
 */
export const fieldDefsSchema = z
  .array(fieldDefSchema)
  .max(DATASET_LIMITS.maxFields, `a dataset has at most ${DATASET_LIMITS.maxFields} fields`)
  .superRefine((fields, ctx) => {
    const ids = new Set<string>();
    const keys = new Set<string>();
    fields.forEach((field, index) => {
      if (ids.has(field.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: `duplicate field id '${field.id}'`,
        });
      }
      if (keys.has(field.key)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'key'],
          message: `duplicate field key '${field.key}'`,
        });
      }
      ids.add(field.id);
      keys.add(field.key);
    });
  });
export type FieldDefs = z.infer<typeof fieldDefsSchema>;
