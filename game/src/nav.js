// A* navigation over a waypoint graph. Edges exist only when the straight walk
// between two waypoints clears every collider (validated at build time), so a
// bot's path never cuts through a wall.
import { hasLOS } from './collide.js';

export function buildGraph(nodes, boxes) {
  const edges = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > 26) continue; // only nearby waypoints link
      // walkable straight line at knee height: no collider between the points
      if (!hasLOS(boxes, a.x, 0.6, a.z, b.x, 0.6, b.z)) continue;
      edges[i].push({ to: j, cost: d });
      edges[j].push({ to: i, cost: d });
    }
  }
  return { nodes, edges };
}

export function nearestNode(graph, x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = (graph.nodes[i].x - x) ** 2 + (graph.nodes[i].z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// A* from the waypoint nearest (sx,sz) to the one nearest (tx,tz).
// Returns an array of {x,z} waypoints; falls back to a straight leg at the
// target when no graph route exists, so a bot never stands still for no path.
export function findPath(graph, sx, sz, tx, tz) {
  const start = nearestNode(graph, sx, sz);
  const goal = nearestNode(graph, tx, tz);
  if (start === goal) return [{ x: tx, z: tz }];
  const open = [{ i: start, f: 0 }];
  const came = new Map(), g = new Map([[start, 0]]);
  const h = (i) => Math.hypot(graph.nodes[i].x - tx, graph.nodes[i].z - tz);
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const cur = open.splice(bi, 1)[0];
    if (closed.has(cur.i)) continue;
    closed.add(cur.i);
    if (cur.i === goal) {
      const path = [];
      let n = goal;
      while (n !== undefined) { path.unshift(graph.nodes[n]); n = came.get(n); }
      path.push({ x: tx, z: tz });
      return path;
    }
    for (const e of graph.edges[cur.i]) {
      const ng = g.get(cur.i) + e.cost;
      if (ng < (g.get(e.to) ?? Infinity)) {
        g.set(e.to, ng);
        came.set(e.to, cur.i);
        open.push({ i: e.to, f: ng + h(e.to) });
      }
    }
  }
  return [{ x: tx, z: tz }]; // no graph route: walk straight at it (collision slides along walls)
}
