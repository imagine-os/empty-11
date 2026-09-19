/**
 * Positions in a parsed YAML document: path → line/col, anchors and merge keys
 * resolved, plus the duplicate-key walk. Used by `parseSpec` only; validating a
 * plain object has no positions.
 */
import {
  type Document,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  type LineCounter,
  type Node,
  type Pair,
  type YAMLMap,
} from 'yaml';
import type { SpecPosition } from '../issues.js';

export interface Located {
  line: number;
  col: number;
}

export interface Locator {
  /** Position of the node at `path`, or of the nearest ancestor that exists. */
  locate(path: ReadonlyArray<PropertyKey>): Located | undefined;
  /** Position of the key of the mapping entry at `path` (falls back to `locate`). */
  locateKey(path: ReadonlyArray<PropertyKey>): Located | undefined;
}

export function createLocator(doc: Document, lines: LineCounter): Locator {
  const pos = (node: Node | undefined): Located | undefined => {
    const offset = node?.range?.[0];
    if (offset === undefined) return undefined;
    const { line, col } = lines.linePos(offset);
    return { line, col };
  };

  const resolve = (node: unknown): Node | undefined => {
    let current = node as Node | undefined;
    for (let i = 0; i < 16 && current && isAlias(current); i++) {
      current = current.resolve(doc) as Node | undefined;
    }
    return current;
  };

  /** Find the pair for `key` in a map, following `<<` merges (explicit keys win). */
  const findPair = (map: YAMLMap, key: string, depth = 0): Pair | undefined => {
    for (const pair of map.items) {
      if (
        isScalar(pair.key) &&
        typeof pair.key.value !== 'symbol' &&
        String(pair.key.value) === key
      ) {
        return pair;
      }
    }
    if (depth > 8) return undefined;
    for (const pair of map.items) {
      if (!isMergePair(pair)) continue;
      const sources = isSeq(pair.value) ? pair.value.items : [pair.value];
      for (const source of sources) {
        const resolved = resolve(source);
        if (isMap(resolved)) {
          const found = findPair(resolved, key, depth + 1);
          if (found) return found;
        }
      }
    }
    return undefined;
  };

  const walk = (
    path: ReadonlyArray<PropertyKey>,
  ): { node?: Node; keyNode?: Node; depth: number } => {
    let node = resolve(doc.contents);
    let keyNode: Node | undefined;
    let depth = 0;
    for (const segment of path) {
      if (!node) break;
      if (isMap(node)) {
        const pair = findPair(node, String(segment));
        if (!pair) break;
        keyNode = pair.key as Node;
        node = resolve(pair.value);
      } else if (isSeq(node) && typeof segment === 'number') {
        const item = node.items[segment];
        if (item === undefined) break;
        keyNode = undefined;
        node = resolve(item);
      } else {
        break;
      }
      depth++;
    }
    return { ...(node ? { node } : {}), ...(keyNode ? { keyNode } : {}), depth };
  };

  return {
    locate(path) {
      const { node, keyNode, depth } = walk(path);
      if (depth === path.length && node) return pos(node) ?? pos(keyNode);
      // Nearest ancestor: prefer the key that introduced it.
      return pos(keyNode) ?? pos(node);
    },
    locateKey(path) {
      const { node, keyNode, depth } = walk(path);
      if (depth === path.length && keyNode) return pos(keyNode);
      return pos(keyNode) ?? pos(node);
    },
  };
}

export function isMergePair(pair: Pair): boolean {
  const key = pair.key;
  if (!isScalar(key)) return false;
  return typeof key.value === 'symbol' || key.value === '<<';
}

export interface DuplicateKey {
  path: string;
  key: string;
  occurrences: SpecPosition[];
}

/** Every mapping key declared more than once, with the position of each occurrence. */
export function findDuplicateKeys(doc: Document, lines: LineCounter): DuplicateKey[] {
  const duplicates: DuplicateKey[] = [];
  const seen = new Set<Node>();

  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node as Node)) return;
    seen.add(node as Node);
    if (isMap(node)) {
      const byKey = new Map<string, SpecPosition[]>();
      for (const pair of node.items) {
        if (isMergePair(pair) || !isScalar(pair.key)) continue;
        const key = String(pair.key.value);
        const offset = (pair.key as Node).range?.[0];
        if (offset === undefined) continue;
        const { line, col } = lines.linePos(offset);
        const list = byKey.get(key) ?? [];
        list.push({ line, col, path: join(path, key) });
        byKey.set(key, list);
      }
      for (const [key, occurrences] of byKey) {
        if (occurrences.length > 1) duplicates.push({ path: join(path, key), key, occurrences });
      }
      for (const pair of node.items) {
        const key =
          isScalar(pair.key) && typeof pair.key.value !== 'symbol' ? String(pair.key.value) : '<<';
        visit(pair.value, join(path, key));
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, index) => {
        visit(item, `${path}[${index}]`);
      });
    }
  };

  visit(doc.contents, '');
  return duplicates;
}

function join(path: string, key: string): string {
  const safe = /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key) ? key : `[${JSON.stringify(key)}]`;
  if (!path) return safe;
  return safe.startsWith('[') ? `${path}${safe}` : `${path}.${safe}`;
}
