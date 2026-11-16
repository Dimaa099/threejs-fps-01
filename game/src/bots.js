// Bot brains: wallets, buy heuristics, A* routes, pre-aimed holds, hearing
// reactions, rotations and retakes, planting and defusing. Every bot carries
// its own wallet and buys by a money/role heuristic — never by round number.
import { CFG, WEAPONS } from './config.js';
import { findPath } from './nav.js';
import { hasLOS } from './collide.js';
import { buyWeapon, buyArmor, fireWeapon, startReload } from './weapons.js';
import { tryPlant, tryDefuse, pickupBomb } from './bomb.js';
import { playSound } from './audio.js';

const BOT_NAMES = {
  atk: ['Sirocco', 'Ember', 'Cinder', 'Flare'],
  def: ['Harbor', 'Bastion', 'Keel', 'Lantern'],
};
const ROLES = ['sniper', 'rifler', 'breacher', 'rifler'];

export function spawnBots(state, graph) {
  const rng = state.rng;
  const defs = [
    { team: 'atk', names: BOT_NAMES.atk }, { team: 'def', names: BOT_NAMES.def },
  ];
  for (const d of defs) {
    d.names.forEach((name, i) => {
      const a = state.actors.find((x) => x.name === name);
      if (!a) return;
      a.role = ROLES[i % ROLES.length];
      a.money = CFG.START_MONEY + Math.floor(rng() * 400);
    });
  }
  void graph;
}

// Buy heuristic: best weapon the wallet affords for the role, then armor,
// then a grenade if money remains.
export function botBuy(state, a) {
  if (a.buyDone) return;
  a.buyDone = true;
  const m = a.money;
  if (a.role === 'sniper' && m >= 4200) buyWeapon(a, 'dmr');
  else if (m >= 2700) buyWeapon(a, 'ar');
  else if (a.role === 'breacher' && m >= 1900) buyWeapon(a, 'shotgun');
  else if (m >= 1500) buyWeapon(a, 'smg');
  if (a.money >= CFG.ARMOR_PRICE + 300) buyArmor(a);
  if (a.money >= 300 && a.role !== 'sniper') { a.money -= 300; a.frags = 1; }
  else if (a.money >= 200) { a.money -= 200; a.flashes = 1; }
  playSound('buy');
}

// Nearest visible enemy: within 42 m, inside a 100-degree view cone, clear LOS.
export function visibleEnemy(state, boxes, a) {
  let best = null, bd = Infinity;
  for (const e of state.actors) {
    if (!e.alive || e.team === a.team || e === a) continue;
    const dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 42 || d >= bd) continue;
    const ang = Math.atan2(-dx, -dz);
    let diff = Math.abs(ang - a.yaw);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 1.75 && d > 4) continue; // outside the view cone (unless point blank)
    if (!hasLOS(boxes, a.pos.x, a.pos.y + 1.5, a.pos.z, e.pos.x, e.pos.y + 1.2, e.pos.z)) continue;
    best = e; bd = d;
  }
  return best;
}

function setPath(state, a, graph, x, z) {
  a.path = findPath(graph, a.pos.x, a.pos.z, x, z);
  a.pathI = 0;
}
function followPath(state, a, dt) {
  if (!a.path || a.pathI >= a.path.length) return true;
  const wp = a.path[a.pathI];
  const dx = wp.x - a.pos.x, dz = wp.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.7) { a.pathI++; return a.pathI >= a.path.length; }
  a.yaw = Math.atan2(-dx, -dz);
  const sp = CFG.WALK_SPEED * 0.85;
  a.vel.x = (dx / d) * sp; a.vel.z = (dz / d) * sp;
  return false;
}

// Where this bot wants to be right now, by role and round state.
function objective(state, a, sites) {
  const b = state.bomb;
  if (a.team === 'atk') {
    if (b.state === 'dropped') return { x: b.pos.x, z: b.pos.z, job: 'pickup' };
    if (a.hasBomb) return { x: sites[a.siteIdx ?? 0].x, z: sites[a.siteIdx ?? 0].z, job: 'plant' };
    const carrier = state.actors.find((x) => x.hasBomb);
    if (carrier && carrier !== a) return { x: carrier.pos.x + 2, z: carrier.pos.z + 2, job: 'escort' };
    return { x: sites[a.siteIdx ?? 0].x, z: sites[a.siteIdx ?? 0].z, job: 'push' };
  }
  // defenders
  if (b.state === 'planted') return { x: sites.find((s) => s.id === b.site).x, z: sites.find((s) => s.id === b.site).z, job: 'retake' };
  if (b.state === 'dropped' && b.pos) return { x: b.pos.x, z: b.pos.z, job: 'guard' };
  const s = sites[a.siteIdx ?? 0];
  return { x: s.x, z: s.z, job: 'hold' };
}

export function tickBot(state, a, ctx, dt) {
  if (!a.alive) return;
  const { boxes, graph, sites } = ctx;
  if (state.phase === 'freeze') { botBuy(state, a); a.state = 'buy'; return; }
  if (state.phase !== 'live') return;
  // Think throttle: expensive decisions (visibility, pathing) every 0.2 s.
  a.thinkAt = a.thinkAt ?? 0;
  if (state.time >= a.thinkAt) {
    a.thinkAt = state.time + 0.2;
    const foe = visibleEnemy(state, boxes, a);
    if (foe) {
      if (!a.lastSeen || a.lastSeen.id !== foe.id) {
        a.reactAt = state.time + CFG.BOT_REACTION_MIN + state.rng() * (CFG.BOT_REACTION_MAX - CFG.BOT_REACTION_MIN);
        a.aimErr = 0.05 + state.rng() * 0.08;
        if (state.rng() < 0.3) state.callouts.push({ text: `${a.name}: contact ${foe.team === 'atk' ? 'Embers' : 'Sentinels'} mid`, t: state.time });
      }
      a.lastSeen = foe; a.state = 'engage';
    } else {
      // No foe in sight: drop the last-seen target (it may be dead by now),
      // so planting/defusing is not blocked by a stale sighting.
      a.lastSeen = null;
      if (a.state === 'engage') a.state = 'move';
    }
    // Hearing: investigate a strong recent sound when idle.
    if (a.heard && a.state !== 'engage' && a.state !== 'plant' && a.state !== 'defuse') {
      if (state.time - a.heard.t < 2) { a.state = 'investigate'; a.lastSeen = { x: a.heard.x, z: a.heard.z }; }
    }
    // (Re)path when the objective changed.
    const obj = objective(state, a, sites);
    if (a.state !== 'engage' && a.state !== 'hold' && (a.job !== obj.job || !a.path || a.pathI >= a.path.length)) {
      a.job = obj.job;
      setPath(state, a, graph, obj.x, obj.z);
    }
    if (a.state === 'investigate' && a.lastSeen) setPath(state, a, graph, a.lastSeen.x, a.lastSeen.z);
  }
  const b = state.bomb;
  // Plant / defuse / pickup take priority over moving. A heard position
  // (lastSeen without .pos) is not a visible enemy and never blocks planting.
  const enemySeen = (a) => a.lastSeen && a.lastSeen.pos;
  if (a.hasBomb && b.state === 'carried') {
    const site = sites.find((s) => Math.abs(a.pos.x - s.x) < s.r && Math.abs(a.pos.z - s.z) < s.r);
    if (site && !enemySeen(a)) { a.state = 'plant'; a.vel.x = 0; a.vel.z = 0; tryPlant(state, a, sites, dt); return; }
  }
  if (b.state === 'planted' && a.team === 'def' && b.pos && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < 1.6 && !enemySeen(a)) {
    a.state = 'defuse'; a.vel.x = 0; a.vel.z = 0; tryDefuse(state, a, dt); return;
  }
  if (b.state === 'dropped' && a.team === 'atk') pickupBomb(state, a);
  // Combat: after the reaction delay, fire bursts at the last seen enemy.
  // Far targets are advanced on, not plinked at through a slit: stand and
  // fight inside 22 m, close the distance beyond it.
  if (a.state === 'engage' && a.lastSeen && state.time >= a.reactAt) {
    const t = a.lastSeen;
    const tx = t.pos ? t.pos.x : t.x, tz = t.pos ? t.pos.z : t.z;
    const dx = tx - a.pos.x, dz = tz - a.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 22) {
      if (!a.advPath || a.advI >= a.advPath.length) { a.advPath = findPath(graph, a.pos.x, a.pos.z, tx, tz); a.advI = 0; }
      a.path = a.advPath; a.pathI = a.advI;
      const arrived = followPath(state, a, dt);
      if (arrived) { a.advPath = null; }
      else { a.advI = a.pathI; }
    }
    a.yaw = Math.atan2(-dx, -dz) + (state.rng() - 0.5) * a.aimErr * 2;
    a.pitch = Math.atan2(1.2 - (t.pos ? t.pos.y + 1.2 : 1.2), d) * 0.5 + (state.rng() - 0.5) * a.aimErr;
    if (a.burstLeft <= 0) { a.burstLeft = 3 + Math.floor(state.rng() * 3); a.nextShotAt = state.time; }
    if (state.time >= a.nextShotAt && a.mag > 0) {
      const w = WEAPONS[a.weapon];
      fireWeapon(a, { boxes, actors: state.actors, state, effects: state.effects, origin: { x: a.pos.x, y: a.pos.y + 1.5, z: a.pos.z }, yaw: a.yaw, pitch: a.pitch, ads: false, speed: Math.hypot(a.vel.x, a.vel.z), airborne: false });
      a.burstLeft--;
      a.nextShotAt = state.time + w.rate;
      if (a.burstLeft <= 0) a.nextShotAt = state.time + 0.5 + state.rng() * 0.7;
    } else if (a.mag <= 0) {
      startReload(a, state);
    }
    return; // stand and fight; no movement while engaging
  }
  // Hold: pre-aimed angle at the site, small strafe steps.
  if (a.job === 'hold' && a.pathI >= (a.path?.length ?? 0) && a.path?.length) {
    a.state = 'hold';
    a.holdYaw = a.holdYaw ?? a.yaw + (state.rng() - 0.5) * 1.2;
    a.yaw = a.holdYaw;
    if (state.time > (a.strafeAt ?? 0)) { a.strafeAt = state.time + 1.5 + state.rng() * 2; a.strafeDir *= -1; }
    const sx = Math.cos(a.yaw) * a.strafeDir * 0.8, sz = -Math.sin(a.yaw) * a.strafeDir * 0.8;
    a.vel.x = sx; a.vel.z = sz;
    return;
  }
  // Move along the path.
  if (a.path && a.pathI < a.path.length) {
    a.state = 'move';
    followPath(state, a, dt);
  } else {
    a.vel.x = 0; a.vel.z = 0;
  }
}
