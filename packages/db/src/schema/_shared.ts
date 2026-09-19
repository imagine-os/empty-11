/**
 * Column helpers shared by every table in the schema.
 *
 * `@paperos/core/types` (PAP-302, ADR 0011) fixes what a `Money`, an `ActorRef`
 * and an `EntityRef` *are*; this file fixes how each one is spelled in
 * Postgres, so that one value type never becomes three column layouts. Spread a
 * helper into a table definition and the columns, their SQL types and their
 * nullability come out the same every time:
 *
 * ```ts
 * export const invoice = pgTable('invoice', {
 *   id: uuid('id').primaryKey(),
 *   ...money('amount'),        // amount_minor bigint, currency char(3)
 *   ...actorRef('actor'),      // actor_id uuid, actor_kind text, actor_character text
 *   ...entityRef('subject'),   // subject_type text, subject_id uuid
 * }, (table) => [actorRefCheck('actor', table)]);
 * ```
 *
 * PAP-32 owns this package and grows it (tenancy columns, RLS, migrations);
 * PAP-302 only lands these three helpers and their tests.
 */

import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  type CheckBuilder,
  char,
  check,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

/** camelCase -> snake_case, so the TypeScript key and the SQL name stay in step. */
export function snakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

const amountColumn = (sqlName: string) => bigint(sqlName, { mode: 'bigint' }).notNull();
const currencyColumn = (sqlName: string) => char(sqlName, { length: 3 }).notNull();
const kindColumn = (sqlName: string) => text(sqlName).notNull();
const nullableTextColumn = (sqlName: string) => text(sqlName);
const nullableUuidColumn = (sqlName: string) => uuid(sqlName);
const requiredUuidColumn = (sqlName: string) => uuid(sqlName).notNull();
const requiredTextColumn = (sqlName: string) => text(sqlName).notNull();

export type MoneyColumns<TAmount extends string, TCurrency extends string> = Record<
  `${TAmount}Minor`,
  ReturnType<typeof amountColumn>
> &
  Record<TCurrency, ReturnType<typeof currencyColumn>>;

export interface MoneyColumnOptions<TCurrency extends string> {
  /**
   * Name of the currency column. Defaults to `currency`, shared by every money
   * column in the table — amounts in one row are in one currency, which is
   * what Interface & Data Contracts section 2 spells `amount_minor bigint +
   * currency char(3)`. Pass a name when a table really does hold two
   * currencies (a conversion row, for instance).
   */
  currency?: TCurrency;
}

/**
 * `money('amount')` emits `amount_minor bigint NOT NULL` and
 * `currency char(3) NOT NULL`.
 *
 * `bigint` with `mode: 'bigint'` is deliberate: Drizzle's default `number` mode
 * silently rounds past 2^53, which is the bug this whole type exists to stop.
 */
export function money<TAmount extends string = 'amount', TCurrency extends string = 'currency'>(
  name: TAmount = 'amount' as TAmount,
  options: MoneyColumnOptions<TCurrency> = {},
): MoneyColumns<TAmount, TCurrency> {
  const currencyKey = (options.currency ?? 'currency') as TCurrency;
  return {
    [`${name}Minor`]: amountColumn(`${snakeCase(name)}_minor`),
    [currencyKey]: currencyColumn(snakeCase(currencyKey)),
  } as MoneyColumns<TAmount, TCurrency>;
}

export type ActorRefColumns<TName extends string> = Record<
  `${TName}Id`,
  ReturnType<typeof nullableUuidColumn>
> &
  Record<`${TName}Kind`, ReturnType<typeof kindColumn>> &
  Record<`${TName}Character`, ReturnType<typeof nullableTextColumn>>;

/**
 * `actorRef('actor')` emits `actor_id uuid`, `actor_kind text NOT NULL` and
 * `actor_character text`.
 *
 * `actor_id` is nullable for exactly one reason: an anonymous actor has no
 * principal row. {@link actorRefCheck} is the constraint that says so, and
 * every table that spreads this helper must add it.
 */
export function actorRef<TName extends string = 'actor'>(
  name: TName = 'actor' as TName,
): ActorRefColumns<TName> {
  const column = snakeCase(name);
  return {
    [`${name}Id`]: nullableUuidColumn(`${column}_id`),
    [`${name}Kind`]: kindColumn(`${column}_kind`),
    [`${name}Character`]: nullableTextColumn(`${column}_character`),
  } as ActorRefColumns<TName>;
}

/**
 * The CHECK that pairs with {@link actorRef}: the id may be null only when the
 * kind is `anonymous`, and an anonymous actor never carries one.
 */
export function actorRefCheck(name: string, columns: Record<string, AnyPgColumn>): CheckBuilder {
  const id = columns[`${name}Id`] as AnyPgColumn;
  const kind = columns[`${name}Kind`] as AnyPgColumn;
  const column = snakeCase(name);
  return check(
    `${column}_id_null_only_when_anonymous`,
    sql`(${kind} = 'anonymous') = (${id} is null)`,
  );
}

export type EntityRefColumns<TName extends string> = Record<
  `${TName}Type`,
  ReturnType<typeof requiredTextColumn>
> &
  Record<`${TName}Id`, ReturnType<typeof requiredUuidColumn>>;

/** `entityRef('subject')` emits `subject_type text NOT NULL` and `subject_id uuid NOT NULL`. */
export function entityRef<TName extends string = 'subject'>(
  name: TName = 'subject' as TName,
): EntityRefColumns<TName> {
  const column = snakeCase(name);
  return {
    [`${name}Type`]: requiredTextColumn(`${column}_type`),
    [`${name}Id`]: requiredUuidColumn(`${column}_id`),
  } as EntityRefColumns<TName>;
}
