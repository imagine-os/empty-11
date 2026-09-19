/**
 * A small, purpose-built DTCG (Design Tokens Community Group) JSON reader,
 * alias resolver and CSS-variable transformer.
 *
 * This is *not* Style Dictionary: our transforms (`oklch` passthrough,
 * `px -> rem`, the `fluid-size -> clamp()` expansion, and a Tailwind v4
 * `@theme` emitter) are specific enough to this token set that a hand-rolled
 * ~250-line resolver is easier to read and to change than wiring Style
 * Dictionary's plugin API for the same four transforms. See
 * docs/adr/0018-design-tokens.md "Alternatives rejected".
 */
import { readFileSync } from 'node:fs';

export type TokenType =
  | 'color'
  | 'dimension'
  | 'duration'
  | 'cubic-bezier'
  | 'font-family'
  | 'font-weight'
  | 'number'
  | 'shadow'
  | 'fluid-size';

export interface TokenLeaf {
  $type: TokenType;
  $value: unknown;
  $description?: string;
}

/** A group's `$description` (if any) is skipped everywhere it's iterated; it never needs a type here. */
export interface TokenGroup {
  [key: string]: TokenNode;
}
export type TokenNode = TokenLeaf | TokenGroup;

export interface FlatToken {
  /** Path segments, e.g. ["color", "bg", "surface"]. */
  path: string[];
  type: TokenType;
  /** Fully alias-resolved value (still in source shape: string, number, array, object). */
  value: unknown;
  description?: string;
}

export function isLeaf(node: unknown): node is TokenLeaf {
  return (
    typeof node === 'object' &&
    node !== null &&
    '$type' in node &&
    '$value' in node &&
    typeof (node as { $type: unknown }).$type === 'string'
  );
}

export function loadTokenFile(path: string): TokenGroup {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as TokenGroup;
}

/** Deep-merges token trees left to right; later sources win on leaf collisions. */
export function mergeTrees(...trees: TokenGroup[]): TokenGroup {
  const out: TokenGroup = {};
  for (const tree of trees) {
    deepMergeInto(out, tree);
  }
  return out;
}

function deepMergeInto(target: TokenGroup, source: TokenGroup): void {
  for (const [key, value] of Object.entries(source)) {
    if (key === '$description') {
      continue;
    }
    const existing = target[key];
    if (isLeaf(value) || existing === undefined || isLeaf(existing)) {
      target[key] = value;
    } else {
      deepMergeInto(existing as TokenGroup, value as TokenGroup);
    }
  }
}

const ALIAS_RE = /^\{([^}]+)\}$/;

export class TokenCycleError extends Error {
  constructor(public readonly cyclePath: string[]) {
    super(`token alias cycle: ${cyclePath.join(' -> ')}`);
    this.name = 'TokenCycleError';
  }
}

export class TokenAliasError extends Error {
  constructor(
    public readonly aliasPath: string,
    public readonly fromPath: string,
  ) {
    super(`unresolvable alias "{${aliasPath}}" referenced from "${fromPath}"`);
    this.name = 'TokenAliasError';
  }
}

function getByPath(tree: TokenGroup, path: string[]): TokenNode | undefined {
  let node: TokenNode | undefined = tree;
  for (const segment of path) {
    if (node === undefined || isLeaf(node)) {
      return undefined;
    }
    node = (node as TokenGroup)[segment];
  }
  return node;
}

/**
 * Resolves every alias (`"{a.b.c}"`) in `tree` to the final, non-alias value
 * it points to, returning a new tree. Tracks every path referenced by the
 * caller (`usedPaths`, when supplied) so `tokens:lint` can report unused
 * core tokens.
 */
export function resolveAliases(tree: TokenGroup, usedPaths?: Set<string>): TokenGroup {
  const cache = new Map<string, unknown>();

  function resolveValue(value: unknown, stack: string[]): unknown {
    if (typeof value === 'string') {
      const match = ALIAS_RE.exec(value);
      if (match) {
        const aliasPath = match[1] as string;
        if (stack.includes(aliasPath)) {
          throw new TokenCycleError([...stack, aliasPath]);
        }
        if (cache.has(aliasPath)) {
          usedPaths?.add(aliasPath);
          return cache.get(aliasPath);
        }
        const target = getByPath(tree, aliasPath.split('.'));
        if (target === undefined || !isLeaf(target)) {
          throw new TokenAliasError(aliasPath, stack[stack.length - 1] ?? '(root)');
        }
        usedPaths?.add(aliasPath);
        const resolved = resolveValue(target.$value, [...stack, aliasPath]);
        cache.set(aliasPath, resolved);
        return resolved;
      }
      return value;
    }
    return value;
  }

  function walk(node: TokenGroup, path: string[]): TokenGroup {
    const out: TokenGroup = {};
    for (const [key, child] of Object.entries(node)) {
      if (key === '$description') {
        continue;
      }
      const childPath = [...path, key];
      if (isLeaf(child)) {
        out[key] = {
          $type: child.$type,
          $value: resolveValue(child.$value, [childPath.join('.')]),
          ...(child.$description ? { $description: child.$description } : {}),
        };
      } else {
        out[key] = walk(child as TokenGroup, childPath);
      }
    }
    return out;
  }

  return walk(tree, []);
}

/** Flattens a (already alias-resolved) tree into a list of leaf tokens. */
export function flatten(tree: TokenGroup, path: string[] = []): FlatToken[] {
  const out: FlatToken[] = [];
  for (const [key, node] of Object.entries(tree)) {
    if (key === '$description') {
      continue;
    }
    const childPath = [...path, key];
    if (isLeaf(node)) {
      out.push({
        path: childPath,
        type: node.$type,
        value: node.$value,
        ...(node.$description ? { description: node.$description } : {}),
      });
    } else {
      out.push(...flatten(node as TokenGroup, childPath));
    }
  }
  return out;
}

/** `fontSize` -> `font-size`; leaves already-kebab and bare-number segments untouched. */
export function toKebab(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function cssVarName(path: string[], prefix = 'pos'): string {
  return `--${prefix}-${path.map(toKebab).join('-')}`;
}
