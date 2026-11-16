// One store for all mutable match state. Nothing else owns game state; modules
// read and write this object, so a round can be reset by rebuilding it.
import { CFG } from './config.js';

export function mulberry32(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An actor is the player or one bot. Shared collision body: one circle in XZ
// plus a height, used by movement, hitscan and grenades alike.
export function makeActor(id, name, team, isPlayer, rng) {
  return {
    id, name, team, isPlayer,
    pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0, onGround: true, crouch: false,
    hp: 100, armor: 0, alive: true,
    money: CFG.START_MONEY, weapon: 'p9', mag: 12, reserve: 48,
    frags: 0, flashes: 0, hasBomb: false,
    kills: 0, deaths: 0, damage: 0, // match scoreboard stats
    // bot-only
    role: 'rifler', target: null, path: [], pathI: 0, holdUntil: 0,
    state: 'buy', reactAt: 0, lastSeen: null, heard: null, aimErr: 0,
    burstLeft: 0, nextShotAt: 0, strafeDir: 1, strafeAt: 0,
    buyDone: false, seed: rng(),
  };
}

export function makeState(seed) {
  const rng = mulberry32(seed);
  return {
    seed, rng, time: 0, tick: 0,
    phase: 'menu',           // menu | freeze | live | roundEnd | matchEnd
    phaseT: 0,               // seconds in current phase
    round: 1, score: { atk: 0, def: 0 },
    roundWinner: null, roundReason: '',
    bomb: { state: 'carried', carrier: null, site: null, pos: null, timer: 0, progress: 0, actor: null },
    actors: [], playerId: 'you',
    feed: [],                // kill feed entries {text, color, t}
    callouts: [],            // team callout lines {text, t}
    events: [],              // hearing-bus events pending this tick
    tracers: [], flashes: [], // transient effect requests for the renderer
    log: [],                 // short debug/event log for tests
    shotMode: null,          // 'start' | 'play' | 'plant' | 'end' when staging a screenshot
  };
}
