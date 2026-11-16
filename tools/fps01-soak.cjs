// SOLSTICE soak: let the bots play two full rounds on their own (no player
// input) and confirm rounds progress, kills happen, and no errors surface.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright-core');
const ROOT = '/home/hatch/workspace/makefun/entries/fps01/game';
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
(async () => {
  await new Promise((r) => server.listen(8950, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8950/', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const S = (fn, arg) => page.evaluate(fn, arg);
  const step = (n) => S((t) => window.__solstice.step(t), n);
  await page.click('#play');
  await page.waitForTimeout(300);
  // The bot carrier pushes the objective; the player sits this one out dead
  // so the round is decided by bot-vs-bot play alone. Reassign the charge
  // whenever a round restart hands it back to the dead player.
  const handBombToBot = () => S(() => {
    const g = window.__solstice;
    if (g.state.bomb.carrier === g.player) {
      g.player.hasBomb = false;
      const c = g.state.actors.find((a) => a.name === 'Sirocco');
      c.hasBomb = true; g.state.bomb.state = 'carried'; g.state.bomb.carrier = c;
    }
  });
  await S(() => { const g = window.__solstice; g.player.alive = false; g.player.hp = 0; });
  await handBombToBot();
  const seen = [];
  for (let r = 0; r < 2; r++) {
    // Up to 130 s of sim per round (freeze 12 + live 100 + end 4, plus slack).
    for (let s = 0; s < 26; s++) {
      await step(120 * 5);
      await handBombToBot();
      const st = await S(() => ({ phase: window.__solstice.state.phase, round: window.__solstice.state.round, score: window.__solstice.state.score, alive: window.__solstice.state.actors.filter((a) => a.alive).length, kills: window.__solstice.state.actors.reduce((n, a) => n + a.kills, 0), bomb: window.__solstice.state.bomb.state, feed: window.__solstice.state.feed.length }));
      if (st.round > r + 1) break;
      if (s === 12) console.log(`round ${r + 1} mid:`, JSON.stringify(await S(() => {
        const g = window.__solstice;
        return g.state.actors.map((a) => `${a.name}@${a.pos.x.toFixed(0)},${a.pos.z.toFixed(0)}:${a.state}`).join(' ');
      })));
      if (s === 25) seen.push(`round ${r + 1} did not finish: ${JSON.stringify(st)}`);
    }
    const st = await S(() => ({ round: window.__solstice.state.round, score: window.__solstice.state.score, kills: window.__solstice.state.actors.reduce((n, a) => n + a.kills, 0), bomb: window.__solstice.state.bomb.state }));
    console.log(`after round ${r + 1}:`, JSON.stringify(st));
    seen.push(`round ${r + 1} end: ${JSON.stringify(st)}`);
  }
  const final = await S(() => ({ kills: window.__solstice.state.actors.reduce((n, a) => n + a.kills, 0), score: window.__solstice.state.score, log: window.__solstice.state.log }));
  console.log('total bot kills across 2 rounds:', final.kills, 'log:', JSON.stringify(final.log));
  console.log('ERRORS:', JSON.stringify(errors));
  console.log(seen.join('\n'));
  await browser.close(); server.close();
  const ok = errors.length === 0 && final.kills > 0 && final.score.atk + final.score.def >= 2;
  console.log(ok ? 'SOAK PASS' : 'SOAK FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
