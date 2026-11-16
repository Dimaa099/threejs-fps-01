// Synthesised sound, no audio assets: a tiny WebAudio synth for shots, reloads,
// footsteps, plants, beeps and round stingers. Silent until the first user
// gesture (browser autoplay policy); safe to call before init.
let ctx = null, master = null, muted = false;
function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function initAudio() { ac(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.22; }
function noiseBuf(c, dur) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function burst(freq, dur, vol, type = 'square', slideTo = 0) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur);
}
function noise(dur, vol, filterFreq = 1800) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const s = c.createBufferSource(); s.buffer = noiseBuf(c, dur);
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(c.currentTime + dur);
}
// Volume falls with distance; pan follows the source's bearing to the listener.
export function playSound(name, opts = {}) {
  const dist = opts.dist ?? 0, pan = opts.pan ?? 0;
  const vol = Math.max(0.05, 1 - dist / 60);
  void pan;
  switch (name) {
    case 'shot': noise(0.14, 0.9 * vol, 2400); burst(160, 0.08, 0.5 * vol, 'square', 60); break;
    case 'shot-far': noise(0.1, 0.35 * vol, 900); break;
    case 'shotgun': noise(0.22, 1.0 * vol, 1600); burst(110, 0.12, 0.6 * vol, 'square', 50); break;
    case 'dry': burst(1400, 0.03, 0.25); break;
    case 'reload': burst(500, 0.05, 0.3); setTimeout(() => burst(700, 0.05, 0.3), 180); break;
    case 'step': noise(0.05, 0.12 * vol, 500); break;
    case 'plant': burst(660, 0.07, 0.35); setTimeout(() => burst(880, 0.07, 0.35), 120); break;
    case 'beep': burst(980, 0.09, 0.4); break;
    case 'hit': burst(2200, 0.04, 0.3, 'sine'); break;
    case 'kill': burst(520, 0.1, 0.4, 'sine', 780); break;
    case 'round-win': [523, 659, 784].forEach((f, i) => setTimeout(() => burst(f, 0.16, 0.35, 'sine'), i * 130)); break;
    case 'round-lose': [392, 330, 262].forEach((f, i) => setTimeout(() => burst(f, 0.16, 0.3, 'sine'), i * 130)); break;
    case 'buy': burst(880, 0.08, 0.35, 'sine', 1320); break;
    case 'explode': noise(0.7, 1.0, 700); burst(70, 0.5, 0.8, 'sine', 30); break;
    case 'flash': noise(0.3, 0.7, 4000); break;
  }
}
