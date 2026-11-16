// SOLSTICE probe: loads each ?shot= scene, collects console/page errors,
// waits for window.__shotReady, screenshots 1280x720 into screenshots/.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright-core');
const ROOT = '/home/hatch/workspace/makefun/entries/fps01/game';
const OUT = '/home/hatch/workspace/makefun/entries/fps01/screenshots';
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
});
const SHOTS = [['1-start', 'start'], ['2-play', 'play'], ['3-plant', 'plant'], ['4-end', 'end']];
(async () => {
  await new Promise((r) => server.listen(8938, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  for (const [name, shot] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
    page.on('requestfailed', (r) => errors.push(`${name} reqfail: ${r.url()}`));
    await page.goto(`http://127.0.0.1:8938/?shot=${shot}&seed=7`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    } catch { errors.push(`${name}: __shotReady timeout`); }
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const info = await page.evaluate(() => ({ phase: window.__solstice?.state?.phase, feed: window.__solstice?.state?.feed?.length, actors: window.__solstice?.state?.actors?.length }));
    console.log(name, JSON.stringify(info));
    await page.close();
  }
  await browser.close(); server.close();
  console.log('ERRORS:', JSON.stringify(errors, null, 1));
  for (const [name] of SHOTS) { const s = fs.statSync(`${OUT}/${name}.png`); console.log(name, s.size, 'bytes'); }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
