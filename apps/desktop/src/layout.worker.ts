import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force';
import type { Point } from '../../../packages/core/types';
self.onmessage = (event: MessageEvent<{ nodes: { id: string; x: number; y: number }[]; edges: { source: string; target: string }[] }>) => {
  const { nodes, edges } = event.data;
  const sim = forceSimulation(nodes).force('charge', forceManyBody().strength(-550)).force('link', forceLink(edges).id((d: any) => d.id).distance(150).strength(.12)).force('center', forceCenter(0, 0)).force('collision', forceCollide(46)).stop();
  for (let i = 0; i < 220; i++) sim.tick();
  const positions: Record<string, Point> = {}; nodes.forEach(n => { positions[n.id] = { x: n.x, y: n.y }; });
  self.postMessage(positions);
};
