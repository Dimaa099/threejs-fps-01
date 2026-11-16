// SOLSTICE orchestrator (thin): boot, the fixed 120 Hz simulation loop with
// rendering decoupled, input wiring, actor meshes, and the ?shot= staging
// used for the four screenshots. All game rules live in the single-job modules.
import * as THREE from 'three';
import { CFG, TEAMS } from './config.js';
import { makeState, makeActor } from './state.js';
import { buildMap } from './map.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createInput, tickPlayer, buyItem, buyMenuItems } from './player.js';
import { tickBot, spawnBots } from './bots.js';
import { startMatch, tickRounds, onActorDeath } from './rounds.js';
import { processHearing, forgetHeard } from './hearing.js';
import { tickGrenades } from './grenade.js';
import { moveBody } from './collide.js';
import { tickReload, startReload } from './weapons.js';
import { initAudio, playSound } from './audio.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number.parseInt(params.get('seed') ?? '7', 10) || 7;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.SKY);
scene.fog = new THREE.Fog(CFG.SKY, CFG.FOG_NEAR, CFG.FOG_FAR);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
camera.rotation.order = 'YXZ';

// Midday sun: bright directional light with shadows, pale-blue ambient fill.
const sun = new THREE.DirectionalLight(CFG.SUN_COLOR, CFG.SUN_INTENSITY);
sun.position.set(28, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 120;
scene.add(sun);
scene.add(new THREE.HemisphereLight(CFG.SKY, CFG.SAND, 1.2));
// Cool fill from the opposite side so shadow faces stay readable, never murky.
const fill = new THREE.DirectionalLight(0xdfeaf2, 0.55);
fill.position.set(-30, 20, -12);
scene.add(fill);

const state = makeState(SEED);
state.shotMode = SHOT;
const map = buildMap(scene);
const effects = createEffects(scene);
state.effects = effects;
const hud = createHud(map);
const input = createInput();

// Actors: you (Embers) + 4 ally bots vs 5 Sentinel bots.
const player = makeActor('you', 'You', 'atk', true, state.rng);
player.spawnIdx = 0; player.siteIdx = 0;
state.actors.push(player);
const BOT_DEFS = [
  ['Sirocco', 'atk', 1, 0], ['Ember', 'atk', 2, 0], ['Cinder', 'atk', 3, 1], ['Flare', 'atk', 4, 1],
  ['Harbor', 'def', 0, 0], ['Bastion', 'def', 1, 0], ['Keel', 'def', 2, 1], ['Lantern', 'def', 3, 1], ['Dune', 'def', 4, 1],
];
for (const [name, team, spawnIdx, siteIdx] of BOT_DEFS) {
  const b = makeActor(name.toLowerCase(), name, team, false, state.rng);
  b.spawnIdx = spawnIdx; b.siteIdx = siteIdx;
  state.actors.push(b);
}
spawnBots(state, map.graph);
state.grenades = [];

// Actor meshes: a capsule body + head + gun, tinted by team. One mesh per bot.
const meshes = new Map();
function actorMesh(a) {
  const g = new THREE.Group();
  const col = a.team === 'atk' ? TEAMS.atk.color : TEAMS.def.color;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 }));
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
  helm.position.y = 1.66; g.add(helm);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.85), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.4 }));
  gun.position.set(0.3, 1.25, -0.4); g.add(gun);
  g.visible = false;
  scene.add(g);
  return g;
}
for (const a of state.actors) if (!a.isPlayer) meshes.set(a.id, actorMesh(a));
// Player viewmodel: a dark rifle low-right in the camera.
const viewGun = new THREE.Group();
const vgBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.62), new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.45, metalness: 0.4, emissive: 0x2a241c }));
viewGun.add(vgBody);
const vgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.6, roughness: 0.4, emissive: 0x1a1a1a }));
vgBarrel.rotation.x = Math.PI / 2; vgBarrel.position.set(0, 0.02, -0.42); viewGun.add(vgBarrel);
viewGun.position.set(0.28, -0.26, -0.55);
viewGun.scale.setScalar(0.85);
camera.add(viewGun);
scene.add(camera);
// The charge: a small dark case with a blinking light, shown when dropped/planted.
const bombMesh = new THREE.Group();
const bombBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.5 }));
bombMesh.add(bombBox);
const bombLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
bombLight.position.y = 0.14; bombMesh.add(bombLight);
bombMesh.visible = false;
scene.add(bombMesh);
// Grenade meshes, pooled.
const grenadeMeshes = [];
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.6 }));
  m.visible = false; scene.add(m); grenadeMeshes.push(m);
}

// --- Input ---
const canvas = renderer.domElement;
document.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { state.showBoard = true; e.preventDefault(); }
  if (e.code === 'KeyG' && !e.repeat) input.cookFrag = true;
  if (e.code === 'KeyF' && !e.repeat) input.throwFlash = true;
  if (e.code === 'KeyR' && !e.repeat) startReload(player, state);
  if (e.code === 'Enter' && state.phase === 'matchEnd') startMatch(state, map.spawns);
  // Keyboard buy (works under pointer lock, where the cursor is captured):
  // 1-7 buy the menu items in order during the freeze phase.
  if (state.phase === 'freeze' && /^Digit[1-7]$/.test(e.code)) {
    const items = buyMenuItems();
    const it = items[Number(e.code.slice(5)) - 1];
    if (it) { buyItem(state, player, it.id); hud.update(state, player, 0); }
  }
  input.keys.add(e.code);
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Tab') state.showBoard = false;
  if (e.code === 'KeyG') { input.cookFrag = false; input.throwFrag = true; }
  input.keys.delete(e.code);
});
document.addEventListener('mousemove', (e) => {
  if (!input.locked) return;
  // Clamp single-event deltas: a real flick is many small events; a huge jump
  // in one event is a cursor warp (e.g. a pointer-lock engage/exit), not aim.
  const clamp = (v) => Math.max(-150, Math.min(150, v));
  input.mouseDX += clamp(e.movementX); input.mouseDY += clamp(e.movementY);
});
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('button')) return; // let shop buttons work
  if (!input.locked) {
    // No lock (e.g. after the buy phase released it): a click on the game
    // re-locks the mouse — but only once play is live, never in the shop.
    if (state.phase === 'live') canvas.requestPointerLock();
    return;
  }
  if (e.button === 0) input.firing = true;
  if (e.button === 2) input.ads = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.firing = false;
  if (e.button === 2) input.ads = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
document.getElementById('play').addEventListener('click', () => {
  initAudio();
  document.getElementById('overlay').hidden = true;
  canvas.requestPointerLock();
  if (state.phase === 'menu') startMatch(state, map.spawns);
});
document.getElementById('buy-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-buy]');
  if (!btn) return;
  buyItem(state, player, btn.dataset.buy);
  hud.update(state, player, 0);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
// Buy menu buttons.
document.getElementById('buy-list').innerHTML = buyMenuItems().map((i) => `<button data-buy="${i.id}" type="button">${i.label} — $${i.price}</button>`).join('');

// --- Simulation: fixed 120 Hz, rendering decoupled ---
function simStep(dt) {
  state.time += dt; state.tick++;
  tickRounds(state, map.spawns, dt);
  if (state.phase === 'live' || state.phase === 'freeze') {
    tickPlayer(state, player, input, { boxes: map.boxes, sites: map.sites }, dt);
    for (const a of state.actors) {
      if (a.isPlayer) continue;
      tickBot(state, a, { boxes: map.boxes, graph: map.graph, sites: map.sites }, dt);
      tickReload(a, dt);
      // Integrate bot movement through the shared collision body.
      moveBody(map.boxes, a.pos, a.vel.x, a.vel.z, dt, CFG.BODY_RADIUS, a.pos.y + 0.9);
      a.pos.y = 0;
    }
    processHearing(state, map.boxes);
    forgetHeard(state);
    tickGrenades(state, map.boxes, dt);
    // Deaths: drop the charge, once per death.
    for (const a of state.actors) {
      if (!a.alive && !a.deathHandled) { a.deathHandled = true; onActorDeath(state, a); }
    }
    // Kill-feed + callout expiry.
    const cutoff = state.time - 6;
    while (state.feed.length && state.feed[0].t < cutoff) state.feed.shift();
    while (state.callouts.length && state.callouts[0].t < cutoff - 4) state.callouts.shift();
  }
  effects.update(dt);
}

function render() {
  // Camera follows the player.
  const eyeY = player.pos.y + (player.crouch ? CFG.EYE_CROUCH : CFG.EYE_STAND);
  camera.position.set(player.pos.x, eyeY, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  const targetFov = player.ads ? 74 / 2.2 : 74;
  if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov += (targetFov - camera.fov) * 0.35; camera.updateProjectionMatrix(); }
  viewGun.position.set(player.ads ? 0 : 0.28, player.ads ? -0.16 : -0.26, -0.55);
  viewGun.visible = player.alive;
  // Bot meshes track their actors; dead bots lie flat.
  for (const a of state.actors) {
    if (a.isPlayer) continue;
    const m = meshes.get(a.id);
    m.visible = true;
    m.position.set(a.pos.x, a.pos.y, a.pos.z);
    m.rotation.y = a.yaw;
    m.rotation.x = a.alive ? 0 : Math.PI / 2;
    m.position.y = a.alive ? 0 : 0.2;
  }
  // Bomb mesh.
  const b = state.bomb;
  if (b.state === 'planted' || b.state === 'dropped') {
    bombMesh.visible = true;
    bombMesh.position.set(b.pos.x, 0.12, b.pos.z);
    bombLight.material.color.setHex(Math.floor(state.time * 3) % 2 === 0 ? 0xff4444 : 0x330000);
  } else if (b.state === 'carried' && b.carrier && !b.carrier.isPlayer) {
    bombMesh.visible = true;
    bombMesh.position.set(b.carrier.pos.x, 1.1, b.carrier.pos.z);
  } else bombMesh.visible = false;
  // Grenade meshes.
  state.grenades.forEach((g, i) => {
    if (i < grenadeMeshes.length) { grenadeMeshes[i].visible = true; grenadeMeshes[i].position.copy(g.pos); }
  });
  for (let i = state.grenades.length; i < grenadeMeshes.length; i++) grenadeMeshes[i].visible = false;
  renderer.render(scene, camera);
}

let last = performance.now(), acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  // Buy phase releases the pointer so the shop is clickable with the mouse.
  if (state.phase === 'freeze' && document.pointerLockElement) document.exitPointerLock();
  acc += frameDt;
  if (acc > 0.25) acc = 0.25; // drop excess time under extreme lag (no death spiral)
  let n = 0;
  while (acc >= CFG.STEP && n < 12) { simStep(CFG.STEP); acc -= CFG.STEP; n++; }
  hud.update(state, player, frameDt);
  render();
}

// --- Screenshot staging (?shot=start|play|plant|end&seed=N) ---
function stageShot() {
  const S = state;
  if (SHOT === 'start') {
    startMatch(S, map.spawns);
    S.phase = 'freeze'; S.phaseT = 2;
    player.money = 4200;
    // West lane looking north: sand lane, whitewash walls, Depot's A marker ahead.
    player.pos.x = -19; player.pos.z = 12; player.yaw = -0.22; player.pitch = 0.06;
  } else if (SHOT === 'play') {
    startMatch(S, map.spawns);
    S.phase = 'live'; S.phaseT = 34;
    player.pos.x = 0; player.pos.z = 10; player.yaw = 0.02; player.pitch = 0.01;
    player.hp = 82; player.mag = 24; player.reserve = 90; player.weapon = 'ar';
    // Enemy fully visible in the open mid street, 13 m ahead.
    const foe = S.actors.find((a) => a.name === 'Keel');
    foe.pos.x = 0.5; foe.pos.z = -3; foe.yaw = Math.PI; foe.alive = true;
    const ally = S.actors.find((a) => a.name === 'Ember');
    ally.pos.x = -5; ally.pos.z = 5; ally.yaw = 0; ally.alive = true;
    S.feed.push({ text: 'Ember ✕ Harbor (headshot)', color: '#e0533a', t: S.time });
    S.feed.push({ text: 'You ✕ Bastion', color: '#e0533a', t: S.time });
    const eye = { x: player.pos.x, y: 1.62, z: player.pos.z };
    effects.fireTracer(eye, { x: foe.pos.x, y: 1.3, z: foe.pos.z });
    effects.muzzle(eye);
    // Hitmarker stays on for the staged frame (the timed one would fade).
    document.getElementById('hitmarker').classList.add('on');
  } else if (SHOT === 'plant') {
    startMatch(S, map.spawns);
    S.phase = 'live'; S.phaseT = 52;
    // At Depot yard looking north-west: the A marker, pole and fuel crates in frame.
    player.pos.x = -18.5; player.pos.z = -12; player.yaw = 0.54; player.pitch = -0.03;
    player.hasBomb = true; S.bomb.carrier = player; S.bomb.state = 'carried';
    S.bomb.actor = player; S.bomb.progress = 0.55;
    const ally = S.actors.find((a) => a.name === 'Sirocco');
    ally.pos.x = -25; ally.pos.z = -15; ally.yaw = 2.4; ally.alive = true;
    S.feed.push({ text: 'You picked up the charge', color: '#e8b13c', t: S.time });
  } else if (SHOT === 'end') {
    startMatch(S, map.spawns);
    S.phase = 'matchEnd'; S.phaseT = 1;
    S.score = { atk: 7, def: 5 }; S.round = 12;
    player.pos.x = 0; player.pos.z = 10; player.yaw = 0; player.pitch = 0.05;
    player.kills = 12; player.deaths = 4; player.damage = 1840; player.money = 5200;
    const stats = { Sirocco: [9, 6, 1420], Ember: [7, 5, 1180], Cinder: [5, 7, 860], Flare: [6, 6, 940], Harbor: [8, 7, 1290], Bastion: [6, 8, 1010], Keel: [4, 9, 720], Lantern: [5, 8, 810], Dune: [3, 10, 540] };
    for (const a of S.actors) if (stats[a.name]) { [a.kills, a.deaths, a.damage] = stats[a.name]; a.alive = true; }
  }
  // Freeze the staged frame: one HUD pass, two renders, then signal ready.
  hud.update(S, player, 0);
  render();
  render();
  window.__shotReady = true;
}

// Test/debug handle (no network, local only). step(n) runs n fixed 120 Hz ticks
// directly, so automated play-tests can advance the simulation precisely even
// when software rendering makes requestAnimationFrame slow.
window.__solstice = {
  state, input, player, map,
  startMatch: () => startMatch(state, map.spawns),
  step: (n) => { for (let i = 0; i < n; i++) simStep(CFG.STEP); hud.update(state, player, 0); render(); },
};

if (SHOT) {
  document.getElementById('overlay').hidden = true;
  stageShot();
} else {
  requestAnimationFrame(loop);
}
