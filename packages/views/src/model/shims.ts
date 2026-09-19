/**
 * Contract-zero aliases the view model consumes but does not own.
 *
 * Each one is a soft dependency on an in-flight data-layer or identity issue. The alias is
 * deliberately minimal: it validates the wire form that the owning spec fixes, so every fixture
 * here keeps parsing when the real export lands and the alias is swapped for an import. Swapping
 * the alias is the only follow-up each owner leaves behind; nothing in `packages/views` forks the
 * grammar.
 */
import { z } from 'zod';

// TODO(PAP-279): replace with `FilterTree` / `filterTreeSchema` from `@paperos/core/filter`.
// PAP-161's spec fixes the fallback as `unknown` so the strict-mode test for the filter shape is a
// `test.todo` (see view.test.ts) until the grammar merges. View-specific operators are contributed
// through that package's extension hook, never forked here.
export const filterTreeSchema = z.unknown().meta({ id: 'FilterTree' });
export type FilterTree = unknown;

// TODO(PAP-55): replace with `AudienceId` / `audienceIdSchema` from `@paperos/core/audience`.
// PAP-55 names audiences with slugs (`owner`, `admin`, `staff`, `member`, `viewer`, `customer`,
// plus tenant-defined ones); a slug is all the model needs to store.
export const audienceIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,63}$/, 'audience id: lowercase slug, 1-64 chars')
  .meta({ id: 'AudienceId' });
export type AudienceId = z.infer<typeof audienceIdSchema>;

// TODO(PAP-302): replace the four aliases below with the exports of `@paperos/core/types`
// (`Uuid`, `IsoDateTime`, `Money`, `EntityRef`). The wire forms match Interface & Data Contracts
// §1: ids are lowercase UUID strings (new ids are UUIDv7), timestamps ISO-8601 UTC, `Money` is a
// decimal string of minor units on the wire (never `number`, never `bigint` in JSON).
export const uuidSchema = z.uuid().meta({ id: 'Uuid' });
export type Uuid = z.infer<typeof uuidSchema>;

export const uuidV7Schema = z.uuidv7().meta({ id: 'UuidV7' });

export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

export const moneyWireSchema = z
  .object({
    amountMinor: z.string().regex(/^-?\d+$/, 'amountMinor: decimal string of minor units'),
    currency: z.string().regex(/^[A-Z]{3}$/, 'currency: ISO 4217 code'),
  })
  .strict();
export type MoneyWire = z.infer<typeof moneyWireSchema>;

export const entityRefSchema = z
  .object({
    /** The dataset key from the dataset registry (`registerDataset`), e.g. `invoice`, `pm_issue`. */
    type: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    id: uuidSchema,
  })
  .strict();
export type EntityRef = z.infer<typeof entityRefSchema>;
