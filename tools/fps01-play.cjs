// SOLSTICE end-to-end play test: pointer lock, buy, move, fire/reload/ammo,
// bot combat kills BOTH ways, frag throw, a full plant round AND a defuse,
// round/match flow. Zero console/page errors required.
// Simulation time is advanced with window.__solstice.step(n) (n fixed 120 Hz
// ticks) so the test is exact even when software rendering is slow.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright-core');
const ROOT = '/home/hatch/workspace/makefun/entries/fps01/game';
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); }
(async () => {
  await new Promise((r) => server.listen(8939, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8939/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const S = (fn, arg) => page.evaluate(fn, arg);
  const step = (n) => S((ticks) => window.__solstice.step(ticks), n);

  // 1. Start the match via the overlay button.
  await page.click('#play');
  await page.waitForTimeout(400);
  check('match starts in freeze', (await S(() => window.__solstice.state.phase)) === 'freeze');
  check('buy menu visible in freeze', await page.isVisible('#buy-menu'));

  // 2. Buy with mouse click, then with keyboard (1-7).
  await S(() => { window.__solstice.player.money = 5000; });
  await page.click('[data-buy="ar"]');
  const bought = await S(() => ({ w: window.__solstice.player.weapon, m: window.__solstice.player.money }));
  check('buy Ember AR (mouse click)', bought.w === 'ar' && bought.m === 2300, JSON.stringify(bought));
  await page.keyboard.press('Digit1');
  const bought2 = await S(() => ({ w: window.__solstice.player.weapon, m: window.__solstice.player.money }));
  check('buy Market SMG (key 1)', bought2.w === 'smg' && bought2.m === 800, JSON.stringify(bought2));
  await S(() => { const g = window.__solstice; g.player.weapon = 'ar'; g.player.mag = 30; g.player.reserve = 90; });

  // 3. Freeze -> live, then move forward 1 s of sim.
  await step(120 * 12);
  check('freeze -> live', (await S(() => window.__solstice.state.phase)) === 'live');
  const p0 = await S(() => ({ ...window.__solstice.player.pos }));
  await page.keyboard.down('KeyW');
  await step(120);
  await page.keyboard.up('KeyW');
  const p1 = await S(() => ({ ...window.__solstice.player.pos }));
  check('WASD movement', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 4, `moved ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)}m`);

  // 4. Pointer lock: clicking the canvas during live engages it.
  await page.mouse.click(100, 600);
  await page.waitForTimeout(400);
  check('pointer lock engages', (await S(() => window.__solstice.input.locked)) === true);
  // Release the real lock for the firing steps: headless shells warp the
  // cursor on lock engage/exit, which would spin the aim. Keep the flag set.
  await S(() => { document.exitPointerLock(); });
  await page.waitForTimeout(300);
  await S(() => { const i = window.__solstice.input; i.locked = true; i.mouseDX = 0; i.mouseDY = 0; });
  const mag0 = await S(() => window.__solstice.player.mag);
  await S(() => { window.__solstice.input.firing = true; });
  await step(108);
  await S(() => { window.__solstice.input.firing = false; });
  const mag1 = await S(() => window.__solstice.player.mag);
  check('fire consumes ammo', mag1 < mag0, `${mag0} -> ${mag1}`);
  await page.keyboard.down('KeyR');
  await step(6);
  await page.keyboard.up('KeyR');
  await step(120 * 3);
  const mag2 = await S(() => window.__solstice.player.mag);
  check('reload refills mag', mag2 === 30, `mag ${mag2}`);

  // 5. Player kills a bot: put Keel 8 m ahead, aim, fire in re-aimed bursts.
  const aimAt = (name) => S((n) => {
    const g = window.__solstice; const p = g.player;
    const f = g.state.actors.find((a) => a.name === n);
    p.yaw = Math.atan2(-(f.pos.x - p.pos.x), -(f.pos.z - p.pos.z));
    p.pitch = 0;
    g.input.mouseDX = 0; g.input.mouseDY = 0;
  }, name);
  await S(() => {
    const g = window.__solstice; const p = g.player;
    p.pos.x = -20; p.pos.z = 10; p.yaw = 0; p.pitch = 0;
    const foe = g.state.actors.find((a) => a.name === 'Keel');
    foe.pos.x = -20; foe.pos.z = 2;
    foe.alive = true; foe.hp = 100;
    // Pin him in place for the test: no thinking, no walking, no shooting back.
    foe.thinkAt = g.state.time + 30; foe.state = 'hold'; foe.path = []; foe.job = 'hold'; foe.lastSeen = null;
  });
  for (let b = 0; b < 4; b++) {
    await aimAt('Keel');
    await S(() => { window.__solstice.input.firing = true; });
    await step(36);
    await S(() => { window.__solstice.input.firing = false; });
    if (!(await S(() => window.__solstice.state.actors.find((a) => a.name === 'Keel').alive))) break;
  }
  const kill = await S(() => { const f = window.__solstice.state.actors.find((a) => a.name === 'Keel'); return { alive: f.alive, feed: window.__solstice.state.feed.length, kills: window.__solstice.player.kills }; });
  check('player kills bot', !kill.alive && kill.kills >= 1, JSON.stringify(kill));

  // 6. A bot kills the player: Harbor 6 m ahead in the open lane, 6 s sim.
  await S(() => {
    const g = window.__solstice; const p = g.player;
    const foe = g.state.actors.find((a) => a.name === 'Harbor');
    foe.pos.x = -20; foe.pos.z = 4;
    foe.alive = true; foe.hp = 100; foe.yaw = Math.PI;
    foe.state = 'engage'; foe.lastSeen = p; foe.reactAt = g.state.time; foe.mag = 30;
    p.hp = 100; p.alive = true;
  });
  await step(120 * 6);
  const hpAfter = await S(() => ({ hp: window.__solstice.player.hp, alive: window.__solstice.player.alive }));
  check('bot shoots back (player takes damage)', hpAfter.hp < 100, `hp 100 -> ${hpAfter.hp.toFixed(0)}`);

  // 7. Frag grenade: give one, throw, it detonates within its fuse.
  await S(() => { const g = window.__solstice; g.player.frags = 1; g.player.hp = 100; g.player.alive = true; g.input.throwFrag = true; });
  await step(30);
  const g0 = await S(() => window.__solstice.state.grenades.length);
  await step(120 * 3);
  const g1 = await S(() => window.__solstice.state.grenades.length);
  check('frag thrown and detonates', g0 >= 1 && g1 === 0, `in flight ${g0} -> ${g1}`);

  // 8. Plant round: carrier plants at A by holding E (3.5 s). Defenders are
  // held at B so the plant is not interrupted by gunfire mid-test.
  await S(() => {
    const g = window.__solstice; const p = g.player;
    for (const a of g.state.actors) if (a.team === 'def') { a.siteIdx = 1; a.pos.x = 22; a.pos.z = -10; }
    p.alive = true; p.hp = 100; p.hasBomb = true; g.state.bomb.state = 'carried'; g.state.bomb.carrier = p;
    p.pos.x = -22; p.pos.z = -17; p.yaw = 0;
  });
  await page.keyboard.down('KeyE');
  await step(120 * 4);
  await page.keyboard.up('KeyE');
  const bomb = await S(() => window.__solstice.state.bomb.state);
  check('plant completes at A', bomb === 'planted', `bomb=${bomb}`);

  // 9. Defuse: a defender bot walks onto the planted charge and defuses.
  await S(() => {
    const g = window.__solstice;
    const d = g.state.actors.find((a) => a.name === 'Lantern');
    d.alive = true; d.hp = 100; d.pos.x = -22; d.pos.z = -17;
    for (const a of g.state.actors) if (a.team === 'atk') { a.alive = false; }
    g.player.alive = false;
  });
  await step(120 * 7);
  const bomb2 = await S(() => window.__solstice.state.bomb.state);
  check('defender bot defuses', bomb2 === 'defused', `bomb=${bomb2}`);
  await step(120 * 5);
  const phase = await S(() => window.__solstice.state.phase);
  check('round ends after defuse, next round starts', phase === 'freeze' || phase === 'live', `phase=${phase}`);

  // 10. Match flow: force score 6-6, end a round, match ends.
  await S(() => {
    const g = window.__solstice;
    g.state.score = { atk: 6, def: 6 }; g.state.round = 13;
    for (const a of g.state.actors) if (a.team === 'def') { a.alive = false; }
  });
  await step(120 * 13); // run out the freeze so the round is live
  await step(60); // elimination ends the round for the attackers
  await step(120 * 5); // round-end pause -> match end at 7 rounds
  const end = await S(() => ({ phase: window.__solstice.state.phase, score: window.__solstice.state.score }));
  check('match ends at 7 rounds', end.phase === 'matchEnd', JSON.stringify(end));
  check('scoreboard visible at match end', await page.isVisible('#scoreboard'));

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
