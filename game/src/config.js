// SOLSTICE tuning: every number the game balances on lives here, in one place.
// Palette: midday Mediterranean hill town — whitewash, terracotta, sandstone, teal.
export const CFG = {
  // simulation
  STEP: 1 / 120,            // fixed 120 Hz simulation, rendering decoupled
  ROUND_TIME: 100,          // seconds per round
  FREEZE_TIME: 12,          // buy phase at round start
  PLANT_TIME: 3.5,          // seconds to plant the charge
  DEFUSE_TIME: 5,           // seconds to defuse
  BOMB_TIMER: 40,           // seconds from plant to detonation
  MAX_ROUNDS: 13,           // first to 7 wins the match
  WIN_ROUNDS: 7,
  // movement (m/s, acceleration-based)
  WALK_SPEED: 5.4, WALK_ACCEL: 42, FRICTION: 30,
  CROUCH_SPEED: 2.6, AIR_CONTROL: 0.35, JUMP_VEL: 6.4, GRAVITY: 18,
  EYE_STAND: 1.62, EYE_CROUCH: 1.12, BODY_RADIUS: 0.38, BODY_HEIGHT: 1.8,
  // economy
  START_MONEY: 800, KILL_REWARD: 300, WIN_REWARD: 3250, LOSS_REWARD: 1900,
  LOSS_STREAK_BONUS: 500, PLANT_REWARD: 300, ARMOR_PRICE: 650,
  // combat
  HEAD_MULT: 2.0, ARMOR_ABSORB: 0.5, // armor absorbs half the damage
  BOT_REACTION_MIN: 0.28, BOT_REACTION_MAX: 0.62,
  // hearing bus (metres)
  HEAR_GUNSHOT: 46, HEAR_FOOTSTEP: 13, HEAR_RELOAD: 18, HEAR_PLANT: 24,
  HEAR_MEMORY: 6,          // seconds a heard position stays in bot memory
  // grenades
  FRAG_DAMAGE: 115, FRAG_RADIUS: 7, FLASH_RADIUS: 16, FLASH_TIME: 2.2,
  // palette
  SKY: 0x9fd4ee, FOG_NEAR: 55, FOG_FAR: 130,
  SUN_COLOR: 0xfff2d8, SUN_INTENSITY: 2.6, AMBIENT: 0xbfd9e8, AMBIENT_INT: 0.85,
  SAND: 0xd9b98a, SAND_DARK: 0xc2a173, WHITEWASH: 0xf2ead8, TERRA: 0xc96f3f,
  TERRA_DARK: 0xa8542c, STONE: 0xbfae8e, TEAL: 0x1f8a8a, TEAL_DARK: 0x146666,
  RUST: 0xc23b22, RUST_DARK: 0x8f2a18, AWNING: 0xe8b13c, LEAF: 0x5d8a4a,
};

// Weapon table. recoil: per-shot pitch/yaw kick pattern (degrees), bloom: spread
// growth per shot, ads: zoom factor for the marksman rifle.
export const WEAPONS = {
  p9:      { name: 'P9',        kind: 'pistol', price: 0,    damage: 26, head: 2.0, mag: 12, reserve: 48,  rate: 0.16, reload: 1.1, spread: 0.011, moveSpread: 0.030, bloom: 0.004, recoil: [0.55, 0.35], auto: false, pellets: 1, range: 40, zoom: 1 },
  smg:     { name: 'Market SMG',kind: 'smg',    price: 1500, damage: 22, head: 2.0, mag: 32, reserve: 96,  rate: 0.085, reload: 1.6, spread: 0.016, moveSpread: 0.042, bloom: 0.005, recoil: [0.42, 0.5],  auto: true,  pellets: 1, range: 34, zoom: 1 },
  ar:      { name: 'Ember AR',  kind: 'rifle',  price: 2700, damage: 33, head: 2.0, mag: 30, reserve: 90,  rate: 0.10,  reload: 2.0, spread: 0.008, moveSpread: 0.038, bloom: 0.006, recoil: [0.6, 0.45],  auto: true,  pellets: 1, range: 60, zoom: 1 },
  dmr:     { name: 'Solstice DMR', kind: 'dmr', price: 4200, damage: 88, head: 2.0, mag: 10, reserve: 30, rate: 0.55,  reload: 2.4, spread: 0.002, moveSpread: 0.05,  bloom: 0.012, recoil: [1.9, 0.4],  auto: false, pellets: 1, range: 90, zoom: 2.2 },
  shotgun: { name: 'Terrace 12',kind: 'shotgun',price: 1900, damage: 9,  head: 2.0, mag: 6,  reserve: 24,  rate: 0.85,  reload: 2.6, spread: 0.05,  moveSpread: 0.07,  bloom: 0.01,  recoil: [2.4, 1.1],  auto: false, pellets: 8, range: 18, zoom: 1 },
};
export const GRENADES = {
  frag:  { name: 'Frag',  price: 300 },
  flash: { name: 'Flash', price: 200 },
};
export const TEAMS = {
  atk: { name: 'Embers',    color: 0xc23b22, css: '#e0533a', spawn: 'south' },
  def: { name: 'Sentinels', color: 0x1f8a8a, css: '#2fb3a8', spawn: 'north' },
};
