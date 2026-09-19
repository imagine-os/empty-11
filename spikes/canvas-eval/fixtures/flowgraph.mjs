// Synthetic stand-in for the PAP-123 FlowGraph fixture (300 nodes / 600 edges),
// used by both canvas entries so the two libraries render the same graph shape.
export function makeGraph(nodeCount = 300, edgeCount = 600) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    x: (i % 20) * 180,
    y: Math.floor(i / 20) * 120,
    label: `Node ${i}`,
    locked: i % 37 === 0,
  }));
  const edges = Array.from({ length: edgeCount }, (_, i) => ({
    id: `e${i}`,
    source: `n${i % nodeCount}`,
    target: `n${(i * 7 + 3) % nodeCount}`,
  }));
  return { nodes, edges };
}
