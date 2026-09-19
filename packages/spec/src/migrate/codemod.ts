import type { Document } from 'yaml';

/** One edit a codemod made, for `--dry-run` output and PR descriptions (PAP-751). */
export interface Change {
  kind: 'rename' | 'move' | 'set' | 'remove';
  /** Dot path of the node the change applies to. */
  path: string;
  from?: string;
  to?: string;
  line?: number;
  col?: number;
}

/**
 * A codemod rewrites a YAML document from one spec version to the next, keeping
 * comments and `x-*` keys. No implementation ships in v1; the interface exists so
 * PAP-751's `renameKey | moveKey | mapEnum | wrapValue` helpers have a fixed shape.
 */
export interface Codemod {
  id: string;
  description: string;
  apply(doc: Document): Change[];
}
