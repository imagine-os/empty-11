import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Automerge from '@automerge/automerge';
import type { CrdtAdapter, ShapeProps } from '../types.js';

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../node_modules/@automerge/automerge/package.json', import.meta.url)),
    'utf8',
  ),
) as { version: string };

interface AmDoc extends Record<string, unknown> {
  text: string;
  shapes: Record<string, ShapeProps>;
}

/**
 * Automerge indexes text by UTF-16 code unit, same as Yjs and JS strings in
 * general (see the "Automerge UTF-16 vs grapheme offsets" edge case) — the
 * workloads in this harness only ever emit BMP characters, so no
 * normalisation is needed here; documented, not exercised, since the
 * workload text generator is ASCII.
 */
export function makeAutomergeAdapter(): CrdtAdapter {
  let doc: Automerge.Doc<AmDoc> = Automerge.from<AmDoc>({ text: '', shapes: {} });

  return {
    libName: 'automerge',
    libVersion: pkg.version,
    create() {
      doc = Automerge.from<AmDoc>({ text: '', shapes: {} });
    },
    applyText(pos, str) {
      doc = Automerge.change(doc, (d) => {
        Automerge.splice(d, ['text'], pos, 0, str);
      });
    },
    deleteText(pos, len) {
      doc = Automerge.change(doc, (d) => {
        Automerge.splice(d, ['text'], pos, len);
      });
    },
    setShape(id, props) {
      doc = Automerge.change(doc, (d) => {
        const existing = d.shapes[id] ?? { x: 0, y: 0, w: 0, h: 0, rotation: 0, fill: '#000000' };
        d.shapes[id] = { ...existing, ...props };
      });
    },
    getText() {
      return doc.text;
    },
    getShapeCount() {
      return Object.keys(doc.shapes).length;
    },
    encode() {
      return Automerge.save(doc);
    },
    load(bytes) {
      doc = Automerge.load<AmDoc>(bytes);
    },
    merge(other) {
      const otherBytes = other.encode();
      const otherDoc = Automerge.load<AmDoc>(otherBytes);
      doc = Automerge.merge(doc, otherDoc);
    },
    dispose() {
      // Automerge documents are plain JS/WASM-backed objects with no
      // explicit free() in the JS API; nothing to release here.
    },
  };
}
