// Colliders: axis-aligned boxes. One shared body for player, bots and grenades:
// a circle in XZ (radius r) plus a vertical span. Also ray tests for hitscan,
// line-of-sight and grenade blast checks.
export function box(x0, z0, x1, z1, h, y0 = 0) {
  return { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y0, y1: y0 + h };
}
export function pointInBox(b, x, z, y = 0.9) {
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && y >= b.y0 && y <= b.y1;
}
// Circle (x,z,r) vs boxes: returns true if the circle overlaps any solid box
// whose vertical span contains height y.
export function circleHits(boxes, x, z, r, y) {
  for (const b of boxes) {
    if (y < b.y0 || y > b.y1) continue;
    const cx = Math.max(b.x0, Math.min(x, b.x1));
    const cz = Math.max(b.z0, Math.min(z, b.z1));
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return b;
  }
  return null;
}
// Move a circle body with axis separation so it slides along walls.
export function moveBody(boxes, p, vx, vz, dt, r, y) {
  let nx = p.x + vx * dt;
  if (!circleHits(boxes, nx, p.z, r, y)) p.x = nx;
  let nz = p.z + vz * dt;
  if (!circleHits(boxes, p.x, nz, r, y)) p.z = nz;
}
// Ray vs boxes (slab test), returns {t, box} of the nearest hit within maxT, or null.
export function rayBoxes(boxes, ox, oy, oz, dx, dy, dz, maxT) {
  let best = null, bestT = maxT;
  for (const b of boxes) {
    let t0 = 0, t1 = bestT, ok = true;
    const o = [ox, oy, oz], d = [dx, dy, dz], mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.y1, b.z1];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) { ok = false; break; } continue; }
      let ta = (mn[i] - o[i]) / d[i], tb = (mx[i] - o[i]) / d[i];
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 >= 0 && t0 < bestT) { bestT = t0; best = { t: t0, box: b }; }
  }
  return best;
}
// Ray vs a vertical capsule approximated as two spheres (head + body).
export function rayActor(ox, oy, oz, dx, dy, dz, a, maxT) {
  const parts = [
    { y: a.pos.y + 1.55, r: 0.24, part: 'head' },
    { y: a.pos.y + 0.95, r: 0.46, part: 'body' },
  ];
  let best = null;
  for (const p of parts) {
    const cx = a.pos.x - ox, cy = p.y - oy, cz = a.pos.z - oz;
    const tca = cx * dx + cy * dy + cz * dz;
    if (tca < 0 || tca > maxT) continue;
    const d2 = cx * cx + cy * cy + cz * cz - tca * tca;
    if (d2 > p.r * p.r) continue;
    const t = tca - Math.sqrt(p.r * p.r - d2);
    if (t >= 0 && (!best || t < best.t)) best = { t, part: p.part };
  }
  return best;
}
// Line of sight between two points at eye height, blocked by any collider.
export function hasLOS(boxes, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  return !rayBoxes(boxes, ax, ay, az, dx / len, dy / len, dz / len, len);
}
// Count walls between two points (for hearing muffling).
export function wallsBetween(boxes, ax, ay, az, bx, by, bz) {
  let n = 0, t = 0;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return 0;
  const ux = dx / len, uy = dy / len, uz = dz / len;
  for (let guard = 0; guard < 8; guard++) {
    const hit = rayBoxes(boxes, ax + ux * t, ay + uy * t, az + uz * t, ux, uy, uz, len - t);
    if (!hit) break;
    n++;
    t = hit.t + 0.05;
    if (t >= len) break;
  }
  return n;
}
