// Weapons: firing, recoil patterns, bloom, spread states, reload and damage.
// Hitscan with head multiplier; armor absorbs half the damage. Spread depends
// on stance and motion, so stopping to aim pays.
import { CFG, WEAPONS } from './config.js';
import { rayBoxes, rayActor } from './collide.js';
import { emitSound } from './hearing.js';
import { playSound } from './audio.js';

export function buyWeapon(actor, id) {
  const w = WEAPONS[id];
  if (!w || actor.money < w.price) return false;
  actor.money -= w.price;
  actor.weapon = id; actor.mag = w.mag; actor.reserve = w.reserve;
  return true;
}
export function buyArmor(actor) {
  if (actor.money < CFG.ARMOR_PRICE || actor.armor >= 100) return false;
  actor.money -= CFG.ARMOR_PRICE; actor.armor = 100; return true;
}

// Current spread for an actor: base + bloom, worse while moving or airborne,
// better while crouched or aiming down sights.
export function spreadFor(actor, w, speed, airborne, ads) {
  let s = w.spread + (actor.bloom ?? 0);
  const move = Math.min(1, speed / CFG.WALK_SPEED);
  s += move * w.moveSpread;
  if (airborne) s += 0.03;
  if (actor.crouch) s *= 0.7;
  if (ads) s *= 0.45;
  return s;
}

function dirFromYawPitch(yaw, pitch) {
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
}

// Fire one trigger pull for `shooter`. Returns a hit record or null.
// `fire` is {boxes, actors, state, effects, origin, yaw, pitch, ads, speed, airborne}
export function fireWeapon(shooter, fire) {
  const w = WEAPONS[shooter.weapon];
  const now = fire.state.time;
  if (shooter.mag <= 0) { playSound('dry'); return { empty: true }; }
  shooter.mag--;
  shooter.bloom = Math.min(0.05, (shooter.bloom ?? 0) + w.bloom);
  shooter.lastShotAt = now;
  const spread = spreadFor(shooter, w, fire.speed, fire.airborne, fire.ads);
  // Recoil pattern: deterministic per-shot kick from the weapon's table.
  const shotN = (shooter.shotsFired = (shooter.shotsFired ?? 0) + 1);
  const pat = w.recoil;
  const kickP = pat[0] * (1 + Math.min(shotN, 8) * 0.06);
  const kickY = pat[1] * (shotN % 2 === 0 ? 1 : -1) * (0.5 + Math.random() * 0.5);
  shooter.pitch += (kickP * Math.PI) / 180 * 0.55;
  shooter.yaw += (kickY * Math.PI) / 180 * 0.4;
  const o = fire.origin;
  let hit = null;
  for (let p = 0; p < w.pellets; p++) {
    const d = dirFromYawPitch(fire.yaw + (Math.random() - 0.5) * spread * 2, fire.pitch + (Math.random() - 0.5) * spread * 2);
    const wall = rayBoxes(fire.boxes, o.x, o.y, o.z, d.x, d.y, d.z, w.range);
    let bestT = wall ? wall.t : w.range;
    let victim = null, part = null;
    for (const a of fire.actors) {
      if (a === shooter || !a.alive || a.team === shooter.team) continue;
      const r = rayActor(o.x, o.y, o.z, d.x, d.y, d.z, a, bestT);
      if (r && r.t < bestT) { bestT = r.t; victim = a; part = r.part; }
    }
    const end = { x: o.x + d.x * bestT, y: o.y + d.y * bestT, z: o.z + d.z * bestT };
    fire.effects.fireTracer(o, end);
    if (victim) {
      const isHead = part === 'head';
      let dmg = w.damage * (isHead ? w.head : 1);
      const falloff = Math.max(0.55, 1 - bestT / (w.range * 2.2));
      dmg *= falloff;
      if (victim.armor > 0) { const absorbed = Math.min(victim.armor, dmg * CFG.ARMOR_ABSORB); victim.armor -= absorbed; dmg -= absorbed; }
      victim.hp -= dmg;
      shooter.damage += dmg;
      hit = { victim, part, dmg, fatal: victim.hp <= 0 };
      if (victim.hp <= 0) {
        victim.alive = false; victim.deaths++;
        shooter.kills++;
        shooter.money += CFG.KILL_REWARD;
        fire.state.feed.push({ text: `${shooter.name} ✕ ${victim.name}${isHead ? ' (headshot)' : ''}`, color: shooter.team === 'atk' ? '#e0533a' : '#2fb3a8', t: now });
        if (shooter.isPlayer) playSound('kill');
      } else if (shooter.isPlayer) playSound('hit');
    } else if (wall) {
      fire.effects.impact(end, 5);
    }
  }
  fire.effects.muzzle(o);
  emitSound(fire.state, 'gunshot', shooter.pos.x, shooter.pos.z, w.kind === 'shotgun' ? 1.25 : 1);
  playSound(w.kind === 'shotgun' ? 'shotgun' : 'shot', { dist: shooter.isPlayer ? 0 : 12 });
  return hit ?? { miss: true };
}

// Reload: moves reserve ammo into the magazine over the weapon's reload time.
export function startReload(actor, state) {
  const w = WEAPONS[actor.weapon];
  if (actor.reloading || actor.mag >= w.mag || actor.reserve <= 0) return false;
  actor.reloading = w.reload;
  emitSound(state, 'reload', actor.pos.x, actor.pos.z);
  playSound('reload');
  return true;
}
export function tickReload(actor, dt) {
  if (!actor.reloading) return;
  actor.reloading -= dt;
  if (actor.reloading <= 0) {
    const w = WEAPONS[actor.weapon];
    const need = w.mag - actor.mag;
    const take = Math.min(need, actor.reserve);
    actor.mag += take; actor.reserve -= take;
    actor.reloading = 0;
  }
}
