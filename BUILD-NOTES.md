# SOLSTICE — build notes (threejs-fps-01)

Entry: sunlit Mediterranean hill-town tactical FPS, 5v5, CS-style.
Repo: Dimaa099/threejs-fps-01 (to be created). Plan: ~/workspace/makefun/fps01-plan.md §c/§d.

## Progress
- [x] 2026-11-17 00:0x WIB: repo dir scaffolded from kit starter; three.js 0.187.0
      vendored byte-for-byte (md5 verified), LICENSE (SPDX MIT line present),
      vendor/makefun-threejs.ts byte-for-byte, serve.ts from kit.
- [x] game/src modules authored (config, state, collide, nav, hearing, audio,
      effects, weapons, grenade, bomb, bots, player, rounds, hud, map, game)
- [x] index.html + main.ts (authored in-session, ≥2 revisions each — game.js
      revised repeatedly; main.ts revised below)
- [x] Playwright end-to-end play-test: 18/18 checks PASS (tools/fps01-play.cjs)
      — buy by mouse + keys 1-7, pointer lock, WASD, fire/reload, player kill,
      bot kill, frag detonation, player plant at A, bot defuse, round/match flow,
      zero console/page errors. Soak: 2 bot-only rounds, 13-17 kills, rounds end
      by elimination AND by charge detonation (tools/fps01-soak.cjs).
- [x] Bugs found + fixed in-session: buy menu unclickable under pointer lock
      (lock released in freeze + keys 1-7 buy + mousedown no-relock on buttons);
      site B was inside the chapel (moved to (22,-12)); defender spawns inside
      buildings (moved to open ground); bots stalled in 'buy' on empty A* paths
      (fallback straight leg); bots plinked at 40 m through slits (advance when
      >22 m); stale lastSeen blocked bot planting (heard positions no longer
      block plant/defuse); per-event mouse-delta clamp (±150 px) against
      pointer-lock warp events.
- [ ] Dossier build twice, byte-compare (deterministic)
- [ ] 4 screenshots 1280x720, eyeballed bright/readable (retake vs final code)
- [ ] gh repo create + commit + push; About set; .makefun/owner.json

## Test results
- fps01-play.cjs: 18/18 PASS (2026-11-17 ~01:5x WIB)
- fps01-soak.cjs: SOAK PASS, 2 rounds, 17 kills, detonation win (2026-11-17 ~01:5x)
- bot plant test: carrier plants in ~3.5 s unopposed; defuse by bot verified

## Commit SHA
- (pending)
