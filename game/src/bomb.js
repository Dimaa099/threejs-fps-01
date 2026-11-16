// The charge: plantable and defusable by ANY actor, with a progress bar. The
// carrier drops it on death and any teammate can pick it up. Planted, it ticks
// down to a detonation that wins the round for the attackers.
import { CFG } from './config.js';
import { emitSound } from './hearing.js';
import { playSound } from './audio.js';

export function resetBomb(state) {
  state.bomb = { state: 'carried', carrier: null, site: null, pos: null, timer: 0, progress: 0, actor: null };
  const carrier = state.actors.find((a) => a.team === 'atk' && a.isPlayer) ?? state.actors.find((a) => a.team === 'atk' && a.alive);
  if (carrier) { carrier.hasBomb = true; state.bomb.carrier = carrier; }
}

// An actor inside a site zone starts (or continues) a plant. Returns true while planting.
export function tryPlant(state, actor, sites, dt) {
  const b = state.bomb;
  if (b.state !== 'carried' || b.carrier !== actor) return false;
  const site = sites.find((s) => Math.abs(actor.pos.x - s.x) < s.r && Math.abs(actor.pos.z - s.z) < s.r);
  if (!site) { b.progress = 0; b.actor = null; return false; }
  if (b.actor !== actor) { b.progress = 0; b.actor = actor; }
  b.progress += dt / CFG.PLANT_TIME;
  emitSound(state, 'plant', actor.pos.x, actor.pos.z, 0.7);
  if (b.progress >= 1) {
    b.state = 'planted'; b.site = site.id; b.pos = { x: actor.pos.x, z: actor.pos.z };
    b.timer = CFG.BOMB_TIMER; b.progress = 0; b.actor = null;
    actor.hasBomb = false;
    state.feed.push({ text: `${actor.name} planted the charge at ${site.id}`, color: '#e8b13c', t: state.time });
    state.callouts.push({ text: `${actor.name}: charge down at ${site.id}`, t: state.time });
    playSound('plant');
    return true;
  }
  return true;
}

// Any defender standing on the planted charge defuses it over DEFUSE_TIME.
export function tryDefuse(state, actor, dt) {
  const b = state.bomb;
  if (b.state !== 'planted' || actor.team !== 'def') return false;
  if (!b.pos || Math.hypot(actor.pos.x - b.pos.x, actor.pos.z - b.pos.z) > 1.6) { if (b.actor === actor) { b.progress = 0; b.actor = null; } return false; }
  if (b.actor !== actor) { b.progress = 0; b.actor = actor; }
  b.progress += dt / CFG.DEFUSE_TIME;
  if (b.progress >= 1) {
    b.state = 'defused'; b.progress = 0; b.actor = null;
    state.feed.push({ text: `${actor.name} defused the charge`, color: '#2fb3a8', t: state.time });
    playSound('beep');
    return true;
  }
  return true;
}

// The carrier died: the charge drops where they fell, free for any attacker
// teammate to walk over and pick up.
export function dropBomb(state, actor) {
  const b = state.bomb;
  if (!actor.hasBomb) return;
  actor.hasBomb = false;
  b.state = 'dropped'; b.carrier = null;
  b.pos = { x: actor.pos.x, z: actor.pos.z };
  state.feed.push({ text: `${actor.name} dropped the charge`, color: '#e8b13c', t: state.time });
}
export function pickupBomb(state, actor) {
  const b = state.bomb;
  if (b.state !== 'dropped' || actor.team !== 'atk' || !b.pos) return false;
  if (Math.hypot(actor.pos.x - b.pos.x, actor.pos.z - b.pos.z) > 1.2) return false;
  b.state = 'carried'; b.carrier = actor; b.pos = null;
  actor.hasBomb = true;
  state.feed.push({ text: `${actor.name} picked up the charge`, color: '#e8b13c', t: state.time });
  return true;
}

export function tickBomb(state, dt) {
  const b = state.bomb;
  if (b.state === 'planted') {
    b.timer -= dt;
    if (Math.floor(b.timer) !== Math.floor(b.timer + dt)) playSound('beep');
    if (b.timer <= 0) { b.state = 'detonated'; playSound('explode'); return 'detonated'; }
  }
  return null;
}
