import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createShapeId, Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { makeGraph } from '../fixtures/flowgraph.mjs';

function App() {
  const graph = useMemo(() => makeGraph(300, 600), []);
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Tldraw
        onMount={(editor) => {
          // Seed the canvas with the same 300-node fixture as geo shapes,
          // to exercise the same order of magnitude of records as React Flow.
          editor.createShapes(
            graph.nodes.map((n) => ({
              id: createShapeId(n.id),
              type: 'geo',
              x: n.x,
              y: n.y,
              props: { w: 140, h: 80, text: n.label },
              isLocked: n.locked,
            })),
          );
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
