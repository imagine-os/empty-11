import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import { makeGraph } from '../fixtures/flowgraph.mjs';

function App() {
  const graph = useMemo(() => makeGraph(300, 600), []);
  const nodes = graph.nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.label },
    draggable: !n.locked,
  }));
  const edges = graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
