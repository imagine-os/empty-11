import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Y from 'yjs';
import type { CrdtAdapter, ShapeProps } from '../types.js';

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../node_modules/yjs/package.json', import.meta.url)),
    'utf8',
  ),
) as { version: string };

/**
 * `gc` toggles Yjs's tombstone garbage collection. The benchmark measures
 * both (see the "Yjs gc:true" edge case in the spec) by constructing two
 * adapters with different flags.
 */
export function makeYjsAdapter(opts: { gc: boolean } = { gc: true }): CrdtAdapter {
  let doc = new Y.Doc({ gc: opts.gc });
  let text = doc.getText('text');
  let shapes = doc.getMap<Record<string, unknown>>('shapes');

  return {
    libName: 'yjs',
    libVersion: pkg.version,
    create() {
      doc = new Y.Doc({ gc: opts.gc });
      text = doc.getText('text');
      shapes = doc.getMap('shapes');
    },
    applyText(pos, str) {
      text.insert(pos, str);
    },
    deleteText(pos, len) {
      text.delete(pos, len);
    },
    setShape(id, props) {
      const existing = (shapes.get(id) as ShapeProps | undefined) ?? {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        rotation: 0,
        fill: '#000000',
      };
      shapes.set(id, { ...existing, ...props });
    },
    getText() {
      return text.toString();
    },
    getShapeCount() {
      return shapes.size;
    },
    encode() {
      return Y.encodeStateAsUpdateV2(doc);
    },
    load(bytes) {
      doc = new Y.Doc({ gc: opts.gc });
      text = doc.getText('text');
      shapes = doc.getMap('shapes');
      Y.applyUpdateV2(doc, bytes);
    },
    merge(other) {
      const bytes = other.encode();
      Y.applyUpdateV2(doc, bytes);
    },
    dispose() {
      doc.destroy();
    },
  };
}
