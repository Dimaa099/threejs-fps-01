// Player: keyboard + mouse look, acceleration movement, crouch, jump, fire,
// reload, buy menu, grenade cooking, plant/defuse input. Firing goes through
// the shared weapons module; movement through the shared collision body.
import { CFG, WEAPONS } from './config.js';
import { moveBody } from './collide.js';
import { fireWeapon, startReload, tickReload, buyWeapon, buyArmor } from './weapons.js';
import { throwGrenade, FRAG_FUSE } from './grenade.js';
import { tryPlant, tryDefuse } from './bomb.js';
import { emitSound } from './hearing.js';
import { playSound } from './audio.js';

export function createInput() {
  return {
    keys: new Set(), mouseDX: 0, mouseDY: 0, firing: false, ads: false,
    locked: false, stepAcc: 0, lastStep: 0,
  };
}

const BUY_ITEMS = [
  { id: 'smg', label: 'Market SMG', price: 1500 },
  { id: 'ar', label: 'Ember AR', price: 2700 },
  { id: 'shotgun', label: 'Terrace 12', price: 1900 },
  { id: 'dmr', label: 'Solstice DMR', price: 4200 },
  { id: 'armor', label: 'Kevlar Armor', price: 650 },
  { id: 'frag', label: 'Frag Grenade', price: 300 },
  { id: 'flash', label: 'Flash Grenade', price: 200 },
];
export function buyMenuItems() { return BUY_ITEMS; }

export function buyItem(state, actor, id) {
  if (id === 'armor') return buyArmor(actor);
  if (id === 'frag') { if (actor.money < 300 || actor.frags >= 2) return false; actor.money -= 300; actor.frags++; playSound('buy'); return true; }
  if (id === 'flash') { if (actor.money < 200 || actor.flashes >= 2) return false; actor.money -= 200; actor.flashes++; playSound('buy'); return true; }
  const ok = buyWeapon(actor, id);
  if (ok) playSound('buy');
  return ok;
}

export function tickPlayer(state, player, input, ctx, dt) {
  const { boxes, sites } = ctx;
  tickReload(player, dt);
  // Bloom decays when not firing.
  if (state.time - (player.lastShotAt ?? -9) > 0.25) player.bloom = Math.max(0, (player.bloom ?? 0) - dt * 0.09);
  // Look
  const sens = player.ads ? 0.0011 : 0.0021;
  player.yaw -= input.mouseDX * sens;
  player.pitch -= input.mouseDY * sens;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
  input.mouseDX = 0; input.mouseDY = 0;
  player.ads = input.ads && WEAPONS[player.weapon].kind === 'dmr';
  // Move: acceleration toward the wish direction, friction when idle.
  const k = input.keys;
  const crouch = k.has('ControlLeft') || k.has('KeyC');
  player.crouch = crouch;
  const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
  const str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
  const speed = crouch ? CFG.CROUCH_SPEED : CFG.WALK_SPEED;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let wx = -sin * fwd + cos * str, wz = -cos * fwd - sin * str;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }
  const accel = player.onGround ? CFG.WALK_ACCEL : CFG.WALK_ACCEL * CFG.AIR_CONTROL;
  player.vel.x += wx * accel * dt;
  player.vel.z += wz * accel * dt;
  if (wl === 0 && player.onGround) {
    const fr = Math.max(0, 1 - CFG.FRICTION * dt / Math.max(0.01, Math.hypot(player.vel.x, player.vel.z)));
    player.vel.x *= fr; player.vel.z *= fr;
  }
  const hv = Math.hypot(player.vel.x, player.vel.z);
  if (hv > speed) { player.vel.x *= speed / hv; player.vel.z *= speed / hv; }
  if (k.has('Space') && player.onGround) { player.vel.y = CFG.JUMP_VEL; player.onGround = false; }
  player.vel.y -= CFG.GRAVITY * dt;
  moveBody(boxes, player.pos, player.vel.x, player.vel.z, dt, CFG.BODY_RADIUS, player.pos.y + 0.9);
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 0) { player.pos.y = 0; player.vel.y = 0; player.onGround = true; }
  // Footstep sounds while moving on the ground.
  const moving = hv > 1.5 && player.onGround;
  if (moving) {
    input.stepAcc += hv * dt;
    if (input.stepAcc > 2.2) { input.stepAcc = 0; emitSound(state, 'footstep', player.pos.x, player.pos.z, 0.8); playSound('step', { dist: 0 }); }
  }
  // Fire
  const w = WEAPONS[player.weapon];
  player.fireCd = Math.max(0, (player.fireCd ?? 0) - dt);
  const eyeY = player.pos.y + (crouch ? CFG.EYE_CROUCH : CFG.EYE_STAND);
  if (input.firing && player.fireCd <= 0 && !player.reloading && state.phase === 'live') {
    if (player.mag > 0) {
      fireWeapon(player, {
        boxes, actors: state.actors, state, effects: state.effects,
        origin: { x: player.pos.x, y: eyeY, z: player.pos.z },
        yaw: player.yaw, pitch: player.pitch, ads: player.ads, speed: hv, airborne: !player.onGround,
      });
      player.fireCd = w.rate;
      if (!w.auto) input.firing = false;
    } else {
      startReload(player, state);
      input.firing = false;
    }
  }
  if (k.has('KeyR')) startReload(player, state);
  // Grenade: hold G to cook the frag, release to throw; F throws a flash.
  if (input.cookFrag && player.frags > 0) {
    player.cookTime = (player.cookTime ?? 0) + dt;
    if (player.cookTime >= FRAG_FUSE) { // cooked too long: it bursts in hand
      player.frags--;
      player.hp -= 60; player.cookTime = 0;
      if (player.hp <= 0) { player.alive = false; player.deaths++; }
      playSound('explode');
    }
  }
  if (input.throwFrag && player.frags > 0) {
    player.frags--;
    const d = { x: -Math.sin(player.yaw) * Math.cos(player.pitch), y: Math.sin(player.pitch), z: -Math.cos(player.yaw) * Math.cos(player.pitch) };
    throwGrenade(state, player, 'frag', d);
    input.throwFrag = false; player.cookTime = 0;
  }
  if (input.throwFlash && player.flashes > 0) {
    player.flashes--;
    const d = { x: -Math.sin(player.yaw) * Math.cos(player.pitch), y: Math.sin(player.pitch), z: -Math.cos(player.yaw) * Math.cos(player.pitch) };
    throwGrenade(state, player, 'flash', d);
    input.throwFlash = false;
  }
  // Objective: hold E to plant / defuse.
  if (k.has('KeyE')) {
    if (player.hasBomb) tryPlant(state, player, sites, dt);
    else tryDefuse(state, player, dt);
  } else if (state.bomb.actor === player) { state.bomb.progress = 0; state.bomb.actor = null; }
}
