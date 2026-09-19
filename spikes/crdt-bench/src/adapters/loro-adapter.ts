import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LoroDoc } from 'loro-crdt';
import type { CrdtAdapter, ShapeProps } from '../types.js';

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../node_modules/loro-crdt/package.json', import.meta.url)),
    'utf8',
  ),
) as { version: string };

export function makeLoroAdapter(): CrdtAdapter {
  let doc = new LoroDoc();

  return {
    libName: 'loro-crdt',
    libVersion: pkg.version,
    create() {
      doc = new LoroDoc();
    },
    applyText(pos, str) {
      doc.getText('text').insert(pos, str);
    },
    deleteText(pos, len) {
      doc.getText('text').delete(pos, len);
    },
    setShape(id, props) {
      const map = doc.getMap('shapes');
      const existing = (map.get(id) as ShapeProps | undefined) ?? {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        rotation: 0,
        fill: '#000000',
      };
      map.set(id, { ...existing, ...props });
    },
    getText() {
      return doc.getText('text').toString();
    },
    getShapeCount() {
      return doc.getMap('shapes').size;
    },
    encode() {
      return doc.export({ mode: 'snapshot' });
    },
    load(bytes) {
      doc = new LoroDoc();
      doc.import(bytes);
    },
    merge(other) {
      const bytes = other.encode();
      doc.import(bytes);
    },
    dispose() {
      doc.free();
    },
  };
}
