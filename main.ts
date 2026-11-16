// SOLSTICE — threejs-fps-01 entry program (Node 22, standard library only).
// The game is this directory's game/ folder: static ES modules with three.js
// 0.187.0 from an import map, no build step, no network requests. This program
// hands it in: it copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with
// the vendored make.fun library (vendor/makefun-threejs.ts, kit copy, unchanged).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly on a missing game instead of handing in a partial dossier:
// the gate refuses an entry with no game/index.html, and a silent partial
// build would waste a submission on the account's entry quota.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('SOLSTICE: game/index.html is missing — nothing to hand in');
}
if (!existsSync(join(here, 'screenshots')) || !existsSync(join(here, 'game', 'src', 'game.js'))) {
  throw new Error('SOLSTICE: screenshots/ or game/src/game.js is missing — nothing to hand in');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json). SOLSTICE keeps its source near 100 KB so the
// judge reads every line of it.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 }),
);
