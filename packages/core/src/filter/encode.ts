/**
 * Compact URL encoding for view links (PAP-172) and the version migration hook.
 *
 * Wire form: `1.` + base64url(JSON) where the JSON is the compact array form
 *   group     → ["&" | "|" | "!", ...children]
 *   condition → [field, code] | [field, code, value]
 * Codes are the operator table's `code` (`=`, `!=`, `in`, `!in`, `<`, `<=`, `>`, `>=`,
 * `~`, `^`, `0`, `!0`, `..`, `has`, `@`). Decoding validates structure (and fields when a
 * `FieldSchema` is given) and never trusts the input.
 */
import { FilterError, FilterValidationError } from './errors.js';
import type { OperatorDefinition } from './operators.js';
import {
  type ConditionValue,
  FILTER_VERSION,
  type FieldSchema,
  type FilterNode,
  type FilterTree,
  type GroupOp,
  isGroup,
} from './schema.js';
import { type GrammarInternals, parseWith } from './validate.js';

const GROUP_CODES: Readonly<Record<GroupOp, string>> = { and: '&', or: '|', not: '!' };
const GROUP_OPS_BY_CODE: Readonly<Record<string, GroupOp>> = { '&': 'and', '|': 'or', '!': 'not' };

type Compact = unknown[];

export function operatorCodes(operators: Iterable<OperatorDefinition>): {
  toCode: ReadonlyMap<string, string>;
  fromCode: ReadonlyMap<string, string>;
} {
  const toCode = new Map<string, string>();
  const fromCode = new Map<string, string>();
  for (const op of operators) {
    const code = op.code ?? op.name;
    if (fromCode.has(code)) {
      throw new FilterError('FILTER_ENCODING', `operator code "${code}" is used twice`);
    }
    toCode.set(op.name, code);
    fromCode.set(code, op.name);
  }
  return { toCode, fromCode };
}

function compact<Op extends string>(
  node: FilterNode<Op>,
  toCode: ReadonlyMap<string, string>,
): Compact {
  if (isGroup(node)) return [GROUP_CODES[node.op], ...node.children.map((c) => compact(c, toCode))];
  const code = toCode.get(node.operator) ?? node.operator;
  return node.value === undefined ? [node.field, code] : [node.field, code, node.value];
}

function expand(input: unknown, fromCode: ReadonlyMap<string, string>): unknown {
  if (!Array.isArray(input) || input.length === 0) {
    throw new FilterError('FILTER_ENCODING', 'encoded filter node must be a non-empty array');
  }
  const head = input[0];
  const isGroupNode = input.length === 1 || Array.isArray(input[1]);
  if (isGroupNode) {
    const op = typeof head === 'string' ? GROUP_OPS_BY_CODE[head] : undefined;
    if (op === undefined)
      throw new FilterError('FILTER_ENCODING', `unknown group code "${String(head)}"`);
    return { op, children: input.slice(1).map((c) => expand(c, fromCode)) };
  }
  if (input.length > 3 || typeof head !== 'string' || typeof input[1] !== 'string') {
    throw new FilterError('FILTER_ENCODING', 'encoded condition must be [field, operator, value?]');
  }
  const operator = fromCode.get(input[1]) ?? input[1];
  return input.length === 2
    ? { field: head, operator }
    : { field: head, operator, value: input[2] as ConditionValue };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const padded = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  let binary: string;
  try {
    binary = atob(padded);
  } catch (cause) {
    throw new FilterError('FILTER_ENCODING', 'encoded filter is not valid base64url', { cause });
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeWith<Op extends string>(
  toCode: ReadonlyMap<string, string>,
  tree: FilterTree<Op>,
): string {
  const { v: _v, ...node } = tree;
  return `${FILTER_VERSION}.${toBase64Url(JSON.stringify(compact(node as FilterNode<Op>, toCode)))}`;
}

export function decodeWith<Op extends string>(
  internals: GrammarInternals<Op>,
  fromCode: ReadonlyMap<string, string>,
  encoded: string,
  fields?: FieldSchema,
): FilterTree<Op> {
  const match = /^(\d+)\.([A-Za-z0-9_-]*)$/.exec(encoded);
  if (match === null) {
    throw new FilterError(
      'FILTER_ENCODING',
      'encoded filter must look like "<version>.<base64url>"',
    );
  }
  const version = Number(match[1]);
  if (version > FILTER_VERSION) {
    throw new FilterError(
      'FILTER_VERSION',
      `filter version ${version} is newer than this grammar (${FILTER_VERSION}); upgrade @paperos/core`,
    );
  }
  let compactTree: unknown;
  try {
    compactTree = JSON.parse(fromBase64Url(match[2] as string));
  } catch (cause) {
    if (cause instanceof FilterError) throw cause;
    throw new FilterError('FILTER_ENCODING', 'encoded filter is not valid JSON', { cause });
  }
  const tree = { ...(expand(compactTree, fromCode) as object), v: version };
  const migrated = migrateWith(internals, tree);
  return fields === undefined ? migrated : parseWith(internals, migrated, fields);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/** `MIGRATIONS[n]` rewrites a version-`n` tree into version `n + 1`. Empty while `v: 1` is current. */
export const MIGRATIONS: Readonly<Record<number, (tree: unknown) => unknown>> = {};

/** Brings a tree of any known version to the current one and validates its structure. */
export function migrateWith<Op extends string>(
  internals: GrammarInternals<Op>,
  input: unknown,
): FilterTree<Op> {
  if (input === null || typeof input !== 'object') {
    throw new FilterError('FILTER_INVALID', 'a filter tree is an object');
  }
  let tree: unknown = input;
  let version = (input as { v?: unknown }).v ?? FILTER_VERSION;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new FilterError(
      'FILTER_VERSION',
      `filter version must be a positive integer, got ${String(version)}`,
    );
  }
  if (version > FILTER_VERSION) {
    throw new FilterError(
      'FILTER_VERSION',
      `filter version ${version} is newer than this grammar (${FILTER_VERSION}); upgrade @paperos/core`,
    );
  }
  while (version < FILTER_VERSION) {
    const step = MIGRATIONS[version];
    if (step === undefined) {
      throw new FilterError('FILTER_VERSION', `no migration from filter version ${version}`);
    }
    tree = step(tree);
    version += 1;
  }
  const parsed = internals.schemas.tree.safeParse({ ...(tree as object), v: FILTER_VERSION });
  if (!parsed.success) {
    throw new FilterValidationError(
      parsed.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
    );
  }
  return parsed.data;
}
