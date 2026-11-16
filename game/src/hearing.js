// Hearing bus: gunfire, footsteps, reloads and plants become sound events with
// distance falloff, wall muffling and a short memory. Bots hear what reaches
// them and remember where it came from.
import { CFG } from './config.js';
import { wallsBetween } from './collide.js';

const BASE_RADIUS = { gunshot: CFG.HEAR_GUNSHOT, footstep: CFG.HEAR_FOOTSTEP, reload: CFG.HEAR_RELOAD, plant: CFG.HEAR_PLANT };

// Emit a sound event into the state's pending list (consumed once per tick).
export function emitSound(state, type, x, z, loud = 1) {
  state.events.push({ kind: 'sound', type, x, z, loud, t: state.time });
}

// Which bots hear an event, and how clearly. Returns [{actor, strength, x, z}].
// Walls between source and listener muffle: each wall halves the strength.
export function hearers(state, boxes, ev) {
  const out = [];
  const base = (BASE_RADIUS[ev.type] ?? 15) * ev.loud;
  for (const a of state.actors) {
    if (!a.alive || a.isPlayer) continue;
    const d = Math.hypot(a.pos.x - ev.x, a.pos.z - ev.z);
    if (d > base) continue;
    const walls = wallsBetween(boxes, a.pos.x, 1.4, a.pos.z, ev.x, 1.4, ev.z);
    const strength = Math.max(0, (1 - d / base) * Math.pow(0.5, walls));
    if (strength <= 0.05) continue;
    out.push({ actor: a, strength, x: ev.x, z: ev.z });
  }
  return out;
}

// Feed one tick's sound events to the bots: strong sounds are investigated,
// faint ones only update the heard memory with noise.
export function processHearing(state, boxes) {
  for (const ev of state.events) {
    if (ev.kind !== 'sound') continue;
    for (const h of hearers(state, boxes, ev)) {
      const a = h.actor;
      a.heard = { x: h.x, z: h.z, t: state.time, type: ev.type, strength: h.strength };
      if (h.strength > 0.45 && a.state !== 'engage') {
        a.state = 'investigate';
        a.lastSeen = { x: h.x, z: h.z };
      }
    }
  }
  state.events.length = 0;
}

// Drop stale heard memories.
export function forgetHeard(state) {
  for (const a of state.actors) {
    if (a.heard && state.time - a.heard.t > CFG.HEAR_MEMORY) a.heard = null;
  }
}
