// Rounds and match flow: freeze/buy, live play, round end by elimination,
// detonation or defuse, economy awards, match end at 7 round wins. One place
// owns the phase machine so rounds and restarts behave the same every time.
import { CFG } from './config.js';
import { resetBomb, tickBomb, dropBomb } from './bomb.js';
import { playSound } from './audio.js';

export function startMatch(state, spawns) {
  state.score = { atk: 0, def: 0 };
  state.round = 1;
  for (const a of state.actors) {
    a.kills = 0; a.deaths = 0; a.damage = 0;
    a.money = CFG.START_MONEY; a.weapon = 'p9'; a.mag = 12; a.reserve = 48;
    a.armor = 0; a.frags = 0; a.flashes = 0;
  }
  startRound(state, spawns);
}

export function startRound(state, spawns) {
  for (const a of state.actors) {
    a.hp = 100; a.alive = true; a.hasBomb = false;
    a.buyDone = false; a.state = 'buy'; a.path = []; a.pathI = 0;
    a.lastSeen = null; a.heard = null; a.bloom = 0; a.reloading = 0;
    a.flashUntil = 0; a.cookTime = 0;
    const s = spawns[a.team][a.spawnIdx ?? 0];
    a.pos = { x: s.x, y: 0, z: s.z };
    a.yaw = s.yaw; a.pitch = 0; a.vel = { x: 0, y: 0, z: 0 };
  }
  state.grenades = [];
  state.feed.length = 0;
  resetBomb(state);
  state.phase = 'freeze'; state.phaseT = 0;
  state.roundWinner = null; state.roundReason = '';
}

function awardEconomy(state, winner) {
  for (const a of state.actors) {
    if (a.team === winner) a.money += CFG.WIN_REWARD;
    else {
      a.money += CFG.LOSS_REWARD;
      const streak = state.score[winner] - state.score[a.team];
      if (streak >= 2) a.money += CFG.LOSS_STREAK_BONUS;
    }
    if (a.team === 'atk' && a.hasBomb) a.money += CFG.PLANT_REWARD;
  }
}

export function endRound(state, winner, reason, spawns) {
  if (state.phase !== 'live' && state.phase !== 'freeze') return;
  state.phase = 'roundEnd'; state.phaseT = 0;
  state.roundWinner = winner; state.roundReason = reason;
  state.score[winner]++;
  awardEconomy(state, winner);
  const you = state.actors.find((a) => a.isPlayer);
  if (you && you.team === winner) playSound('round-win'); else playSound('round-lose');
  state.log.push(`round ${state.round} -> ${winner} (${reason}) ${state.score.atk}-${state.score.def}`);
}

export function tickRounds(state, spawns, dt) {
  state.phaseT += dt;
  if (state.phase === 'freeze' && state.phaseT >= CFG.FREEZE_TIME) {
    state.phase = 'live'; state.phaseT = 0;
    return;
  }
  if (state.phase === 'roundEnd' && state.phaseT >= 4) {
    if (state.score.atk >= CFG.WIN_ROUNDS || state.score.def >= CFG.WIN_ROUNDS || state.round >= CFG.MAX_ROUNDS) {
      state.phase = 'matchEnd'; state.phaseT = 0;
      return;
    }
    state.round++;
    startRound(state, spawns);
    return;
  }
  if (state.phase !== 'live') return;
  // Bomb detonation ends the round for the attackers.
  const det = tickBomb(state, dt);
  if (det === 'detonated') { endRound(state, 'atk', 'charge detonated', spawns); return; }
  if (state.bomb.state === 'defused') { endRound(state, 'def', 'charge defused', spawns); return; }
  // Elimination ends the round — except when the charge is planted and the
  // attackers are all dead: the round then runs to defuse or detonation.
  const atkAlive = state.actors.some((a) => a.team === 'atk' && a.alive);
  const defAlive = state.actors.some((a) => a.team === 'def' && a.alive);
  if (!defAlive) endRound(state, 'atk', 'team eliminated', spawns);
  else if (!atkAlive && state.bomb.state !== 'planted') endRound(state, 'def', 'team eliminated', spawns);
  else if (state.phaseT >= CFG.ROUND_TIME) endRound(state, 'def', 'time expired — charge not planted', spawns);
}

// A death can drop the charge; call it wherever an actor dies.
export function onActorDeath(state, actor) {
  if (actor.hasBomb) dropBomb(state, actor);
}
