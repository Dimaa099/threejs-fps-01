// HUD 2.0: health, ammo, timer, score, team-alive pips, hitmarkers, plant/defuse
// progress bars, kill feed, end-of-round scoreboard with K/D/DMG — and a canvas
// minimap drawn from the REAL collider list, so the map on screen is the map
// in the code. Writes are changed-only: the DOM is touched when a value moves.
import { CFG } from './config.js';

export function createHud(map) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hp: $('hp'), hpBar: $('hp-bar'), armor: $('armor'), ammoMag: $('ammo-mag'), ammoRes: $('ammo-reserve'),
    timer: $('timer'), score: $('score-value'), money: $('money'), weapon: $('weapon-name'),
    pipsAtk: $('pips-atk'), pipsDef: $('pips-def'), feed: $('feed'), callouts: $('callouts'),
    progress: $('progress'), progressBar: $('progress-bar'), progressLabel: $('progress-label'),
    buy: $('buy-menu'), buyList: $('buy-list'), buyMoney: $('buy-money'), buyRound: $('buy-round'),
    board: $('scoreboard'), boardRows: $('board-rows'), boardTitle: $('board-title'),
    banner: $('banner'), crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    minimap: $('minimap'), flash: $('flash-overlay'), hint: $('hint'),
  };
  const cache = new Map();
  function set(id, v) {
    if (cache.get(id) !== v) { cache.set(id, v); const n = el[id]; if (n) n.textContent = v; }
  }
  function show(id, on) {
    const key = `show:${id}`;
    if (cache.get(key) !== on) { cache.set(key, on); const n = el[id]; if (n) n.hidden = !on; }
  }
  const ctx = el.minimap.getContext('2d');
  const MAP = { x0: -34, z0: -26, x1: 34, z1: 26 };
  function drawMinimap(state) {
    const W = el.minimap.width, H = el.minimap.height;
    const sx = (x) => ((x - MAP.x0) / (MAP.x1 - MAP.x0)) * W;
    const sz = (z) => ((z - MAP.z0) / (MAP.z1 - MAP.z0)) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20, 26, 24, 0.72)';
    ctx.fillRect(0, 0, W, H);
    // Colliders, exactly as the simulation sees them.
    ctx.fillStyle = '#e8ddc2';
    for (const b of map.boxes) ctx.fillRect(sx(b.x0), sz(b.z0), sx(b.x1) - sx(b.x0), sz(b.z1) - sz(b.z0));
    // Sites
    for (const s of map.sites) {
      ctx.fillStyle = s.id === 'A' ? '#e0533a' : '#2fb3a8';
      ctx.beginPath(); ctx.arc(sx(s.x), sz(s.z), 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.id, sx(s.x), sz(s.z));
    }
    // Bomb
    const b = state.bomb;
    if (b.pos) { ctx.fillStyle = '#e8b13c'; ctx.fillRect(sx(b.pos.x) - 3, sz(b.pos.z) - 3, 6, 6); }
    // Actors
    for (const a of state.actors) {
      if (!a.alive) continue;
      ctx.fillStyle = a.isPlayer ? '#ffffff' : a.team === 'atk' ? '#e0533a' : '#2fb3a8';
      ctx.beginPath(); ctx.arc(sx(a.pos.x), sz(a.pos.z), a.isPlayer ? 4 : 3, 0, Math.PI * 2); ctx.fill();
      if (a.isPlayer) {
        ctx.strokeStyle = '#fff'; ctx.beginPath();
        ctx.moveTo(sx(a.pos.x), sz(a.pos.z));
        ctx.lineTo(sx(a.pos.x) - Math.sin(a.yaw) * 10, sz(a.pos.z) - Math.cos(a.yaw) * 10); ctx.stroke();
      }
    }
  }
  let feedLen = 0, callLen = 0;
  function update(state, player, dt) {
    void dt;
    const you = player;
    set('hp', `${Math.max(0, Math.ceil(you.hp))}`);
    el.hpBar.style.width = `${Math.max(0, you.hp)}%`;
    set('armor', you.armor > 0 ? `ARMOR ${Math.ceil(you.armor)}` : '');
    const w = you.weapon;
    set('ammoMag', `${you.mag}`);
    set('ammoRes', `/ ${you.reserve}`);
    set('weapon', w.toUpperCase());
    const tLeft = state.phase === 'live' ? Math.max(0, CFG.ROUND_TIME - state.phaseT) : state.phase === 'freeze' ? Math.max(0, CFG.FREEZE_TIME - state.phaseT) : 0;
    set('timer', `${Math.floor(tLeft / 60)}:${String(Math.floor(tLeft % 60)).padStart(2, '0')}`);
    set('score', `EMB ${state.score.atk} — ${state.score.def} SEN`);
    set('money', `$${you.money}`);
    // Team-alive pips
    const pips = (team) => state.actors.filter((a) => a.team === team).map((a) => (a.alive ? '●' : '○')).join(' ');
    set('pipsAtk', `EMB ${pips('atk')}`);
    set('pipsDef', `SEN ${pips('def')}`);
    // Kill feed (changed-only by length)
    if (state.feed.length !== feedLen) {
      feedLen = state.feed.length;
      el.feed.innerHTML = state.feed.slice(-5).map((f) => `<div style="color:${f.color}">${f.text}</div>`).join('');
    }
    if (state.callouts.length !== callLen) {
      callLen = state.callouts.length;
      el.callouts.innerHTML = state.callouts.slice(-3).map((c) => `<div>${c.text}</div>`).join('');
    }
    // Plant / defuse progress
    const b = state.bomb;
    const active = b.actor && b.progress > 0;
    show('progress', !!active);
    if (active) {
      el.progressBar.style.width = `${Math.round(b.progress * 100)}%`;
      set('progressLabel', b.state === 'planted' ? `DEFUSING — ${b.actor.name}` : `PLANTING — ${b.actor.name}`);
    }
    // Banner on round end
    const showBanner = state.phase === 'roundEnd';
    show('banner', showBanner);
    if (showBanner) {
      const won = state.roundWinner === you.team;
      set('banner', `${won ? 'ROUND WON' : 'ROUND LOST'} — ${state.roundReason}  ·  EMB ${state.score.atk} — ${state.score.def} SEN`);
      el.banner.style.color = won ? '#7ee2a8' : '#ff9a8a';
    }
    // Scoreboard
    const showBoard = state.phase === 'roundEnd' || state.phase === 'matchEnd' || state.showBoard;
    show('board', showBoard);
    if (showBoard) {
      const rows = [...state.actors].sort((a, b2) => b2.kills - a.kills || b2.damage - a.damage);
      set('boardTitle', state.phase === 'matchEnd'
        ? `MATCH — ${state.score.atk > state.score.def ? 'EMBERS WIN' : state.score.def > state.score.atk ? 'SENTINELS WIN' : 'DRAW'}`
        : `ROUND ${state.round} — ${state.roundWinner === 'atk' ? 'EMBERS' : 'SENTINELS'} TAKE IT`);
      el.boardRows.innerHTML = rows.map((a) => `<tr class="${a.isPlayer ? 'me' : ''}"><td>${a.name}</td><td>${a.team === 'atk' ? 'EMB' : 'SEN'}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${Math.round(a.damage)}</td><td>$${a.money}</td></tr>`).join('');
    }
    // Buy menu
    const showBuy = state.phase === 'freeze' || state.phase === 'menu';
    show('buy', showBuy);
    set('buyMoney', `Funds: $${you.money}`);
    set('buyRound', `${state.round}`);
    // Flash overlay
    const flashed = you.flashUntil && state.time < you.flashUntil;
    el.flash.style.opacity = flashed ? '0.92' : '0';
    // Hint line
    set('hint', state.phase === 'freeze' ? 'Buy phase — click the shop or press 1–7 to buy · E plants/defuses · G cooks frag · F flash'
      : state.phase === 'live' ? (you.hasBomb ? 'You carry the charge — take it to A or B, hold E to plant' : 'Hold E at a site to plant/defuse · B shop (freeze only)')
      : '');
    drawMinimap(state);
  }
  function hitmark(kill) {
    el.hitmarker.classList.add('on');
    el.hitmarker.style.color = kill ? '#ff5a3c' : '#f0a830';
    setTimeout(() => el.hitmarker.classList.remove('on'), 120);
  }
  return { el, update, hitmark, set, show };
}
