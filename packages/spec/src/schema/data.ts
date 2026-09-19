/**
 * `data` section — INTERIM shape. PAP-119 / PAP-311 own the final schema, the
 * typed hook generator and the `DATA_*` rules; they extend this file in place.
 */
import { z } from 'zod';
import { FilterTreeSchema } from './filter.js';
import { CamelId, EntityId, FieldPath } from './refs.js';

export const SCALAR_TYPES = [
  'string',
  'text',
  'number',
  'boolean',
  'date',
  'dateTime',
  'money',
  'uuid',
  'json',
] as const;

export const ScalarType = z.enum(SCALAR_TYPES).meta({
  id: 'ScalarType',
  description: 'Mutation input scalar (interim; PAP-742 adds constraints).',
});

export const QuerySchema = z
  .strictObject({
    entity: EntityId.describe('Entity the query reads.'),
    filter: FilterTreeSchema.optional().describe('Filter merged with the `access.rows` predicate.'),
    sort: z
      .array(z.strictObject({ field: FieldPath, dir: z.enum(['asc', 'desc']).default('asc') }))
      .default([])
      .describe('Sort order.'),
    fields: z.array(FieldPath).optional().describe('Fields selected; all when omitted.'),
    sync: z
      .enum(['server', 'live', 'local'])
      .default('server')
      .describe(
        '`server` TanStack Query; `live` / `local` Electric shape with the offline outbox (PAP-36).',
      ),
    page: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50)
      .describe('Page size, at most 100 (Contracts §4).'),
  })
  .meta({ id: 'Query', description: 'One read the page performs.' });

export const MutationSchema = z
  .strictObject({
    entity: EntityId.describe('Entity the mutation writes.'),
    action: z.enum(['create', 'update', 'delete', 'custom']).describe('Kind of write.'),
    input: z
      .record(CamelId, ScalarType)
      .default({})
      .describe('Input fields and their scalar type (interim; PAP-742 adds constraints).'),
    optimistic: z
      .boolean()
      .default(true)
      .describe('Apply optimistically with rollback on failure.'),
    audit: z
      .boolean()
      .default(true)
      .describe('Record in the audit log with the `X-PaperOS-Reason` header.'),
  })
  .meta({ id: 'Mutation', description: 'One write the page performs.' });

export const DataSectionSchema = z
  .strictObject({
    entities: z
      .array(EntityId)
      .default([])
      .describe('Entities this page touches (cross-checked by PAP-115).'),
    queries: z
      .record(CamelId, QuerySchema)
      .default({})
      .describe('Named reads; each becomes a `use<Name>()` hook.'),
    mutations: z
      .record(CamelId, MutationSchema)
      .default({})
      .describe('Named writes; each becomes a `use<Name>()` mutation hook.'),
  })
  .meta({
    id: 'DataSection',
    description: 'Reads and writes the page performs (interim; final shape PAP-119 / PAP-311).',
  });

export type DataSection = z.output<typeof DataSectionSchema>;
export type DataSectionInput = z.input<typeof DataSectionSchema>;
export type Query = z.output<typeof QuerySchema>;
export type Mutation = z.output<typeof MutationSchema>;
