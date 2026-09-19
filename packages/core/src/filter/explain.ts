/**
 * `explain`: one line of English (or Spanish) for a tree. Field labels come from the
 * `FieldSchema` (`label`) or an explicit `labels` map; the wording per operator lives
 * in the operator table so extensions carry their own.
 */
import type { Locale, OperatorDefinition } from './operators.js';
import { type FieldSchema, type FilterNode, type FilterTree, isGroup, isVarRef } from './schema.js';

export interface ExplainOptions {
  readonly locale?: Locale | undefined;
  /** Used for field labels when given. */
  readonly fields?: FieldSchema | undefined;
  /** Overrides labels per field name. */
  readonly labels?: Readonly<Record<string, string>> | undefined;
}

const GROUP_WORDS: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  en: {
    and: ' and ',
    or: ' or ',
    not: 'not ',
    emptyAnd: 'everything',
    emptyOr: 'nothing',
    true: 'true',
    false: 'false',
    null: 'null',
  },
  es: {
    and: ' y ',
    or: ' o ',
    not: 'no ',
    emptyAnd: 'todo',
    emptyOr: 'nada',
    true: 'verdadero',
    false: 'falso',
    null: 'nulo',
  },
};

export function explainWith<Op extends string>(
  operators: ReadonlyMap<string, OperatorDefinition>,
  tree: FilterTree<Op>,
  options: ExplainOptions = {},
): string {
  const locale: Locale = options.locale ?? 'en';
  const words = GROUP_WORDS[locale];

  const format = (value: unknown): string => {
    if (isVarRef(value)) return `$${value.$var}`;
    if (Array.isArray(value)) return value.map(format).join(', ');
    if (value === null || value === undefined) return words.null as string;
    if (typeof value === 'boolean') return words[String(value)] as string;
    if (typeof value === 'string') return JSON.stringify(value);
    return String(value);
  };

  const label = (field: string): string =>
    options.labels?.[field] ?? options.fields?.[field]?.label ?? field;

  const render = (node: FilterNode<Op>, nested: boolean): string => {
    if (!isGroup(node)) {
      const op = operators.get(node.operator);
      if (op === undefined) return `${label(node.field)} ${node.operator} ${format(node.value)}`;
      return op.explain({ locale, field: label(node.field), value: node.value, format });
    }
    if (node.op === 'not') {
      const inner = node.children.map((c) => render(c, true));
      if (inner.length === 0) return `${words.not}(${words.emptyAnd})`;
      const body = inner.length === 1 ? (inner[0] as string) : `(${inner.join(words.and)})`;
      return `${words.not}${body}`;
    }
    if (node.children.length === 0)
      return (node.op === 'and' ? words.emptyAnd : words.emptyOr) as string;
    const parts = node.children.map((c) => render(c, true));
    if (parts.length === 1) return parts[0] as string;
    const joined = parts.join(words[node.op] as string);
    return nested ? `(${joined})` : joined;
  };

  return render(tree, false);
}
