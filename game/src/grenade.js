// Grenades: a cookable frag and a flash. Thrown with the shared collision body,
// bounced off walls, fused on a timer. Frag damage needs line of sight to the
// victim; flash needs line of sight AND the victim facing the burst.
import { CFG } from './config.js';
import { moveBody, hasLOS } from './collide.js';
import { playSound } from './audio.js';

export function makeGrenades() { return []; }

export function throwGrenade(state, actor, kind, dir) {
  const g = {
    kind, owner: actor,
    pos: { x: actor.pos.x, y: actor.pos.y + 1.4, z: actor.pos.z },
    vel: { x: dir.x * 14, y: dir.y * 14 + 4.5, z: dir.z * 14 },
    fuse: kind === 'frag' ? FRAG_FUSE - (actor.cookTime ?? 0) : 1.1,
    bounced: 0,
  };
  state.grenades.push(g);
  actor.cookTime = 0;
  return g;
}

// A thrown grenade flies for up to its fuse (frag: 2.4 s from pin pull, minus
// cook time in hand). Cook too long and it bursts in the thrower's hand.
export const FRAG_FUSE = 2.4;

export function tickGrenades(state, boxes, dt) {
  for (const g of state.grenades) {
    if (g.done) continue;
    g.fuse -= dt;
    g.vel.y -= 12 * dt;
    const prev = { ...g.pos };
    moveBody(boxes, g.pos, g.vel.x, g.vel.z, dt, 0.14, g.pos.y);
    g.pos.y += g.vel.y * dt;
    if (g.pos.y < 0.05) { g.pos.y = 0.05; g.vel.y = Math.abs(g.vel.y) * 0.45; g.vel.x *= 0.7; g.vel.z *= 0.7; g.bounced++; }
    // crude wall bounce: if the body did not move horizontally, reverse that axis
    if (Math.abs(g.pos.x - prev.x) < 1e-6 && Math.abs(g.vel.x) > 0.5) g.vel.x *= -0.5;
    if (Math.abs(g.pos.z - prev.z) < 1e-6 && Math.abs(g.vel.z) > 0.5) g.vel.z *= -0.5;
    if (g.fuse <= 0) detonate(state, boxes, g);
  }
  state.grenades = state.grenades.filter((g) => !g.done);
}

function detonate(state, boxes, g) {
  g.done = true;
  const p = g.pos;
  if (g.kind === 'frag') {
    playSound('explode');
    state.effects?.impact(p, 24);
    for (const a of state.actors) {
      if (!a.alive) continue;
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
      if (d > CFG.FRAG_RADIUS) continue;
      // Line-of-sight blast check: a wall between burst and victim blocks it.
      if (!hasLOS(boxes, p.x, p.y, p.z, a.pos.x, a.pos.y + 1.0, a.pos.z)) continue;
      const dmg = CFG.FRAG_DAMAGE * (1 - d / (CFG.FRAG_RADIUS * 1.35));
      a.hp -= dmg;
      if (g.owner) g.owner.damage += dmg;
      if (a.hp <= 0) {
        a.alive = false; a.deaths++;
        if (g.owner) { g.owner.kills++; g.owner.money += CFG.KILL_REWARD; }
        state.feed.push({ text: `${g.owner ? g.owner.name : 'Frag'} ✕ ${a.name} (frag)`, color: '#e8b13c', t: state.time });
      }
    }
  } else {
    playSound('flash');
    for (const a of state.actors) {
      if (!a.alive) continue;
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
      if (d > CFG.FLASH_RADIUS) continue;
      if (!hasLOS(boxes, p.x, p.y, p.z, a.pos.x, a.pos.y + 1.5, a.pos.z)) continue;
      // Facing check: the flash only blinds a victim looking toward the burst.
      const toBurst = Math.atan2(-(p.x - a.pos.x), -(p.z - a.pos.z));
      let diff = Math.abs(toBurst - a.yaw);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < Math.PI / 2 || d < 2.5) {
        a.flashUntil = state.time + CFG.FLASH_TIME * (1 - d / (CFG.FLASH_RADIUS * 1.4));
        if (a.isPlayer) state.playerFlashed = a.flashUntil;
      }
    }
  }
}
