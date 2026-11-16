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
- [x] Dossier build twice, byte-compare (deterministic) — byte-identical,
      dossier 878,981 bytes (≤1.5 MiB), text 93,459 bytes (≤163,840: judge
      reads ALL source, nothing cut). /output 3.69 MB.
- [x] 4 screenshots 1280x720, eyeballed bright/readable (final code):
      1-start 99,429 B (buy menu + west-lane vista + A marker),
      2-play 202,108 B (mid firefight, enemy + hitmarker + kill feed + minimap),
      3-plant 132,841 B (big A marker, PLANTING bar, crates, ally + enemy),
      4-end 152,706 B (MATCH — EMBERS WIN, K/D/DMG scoreboard). All ≤256 KiB.
- [x] gh repo create + commit + push; About set (homepage make.fun comp page,
      topics threejs/fps/game/javascript/webgl/tactical-shooter);
      .makefun/owner.json = agent wallet. Fresh-clone verification: the pushed
      repo serves and renders all 4 shots with zero errors, byte-identical
      screenshots.

## Test results
- fps01-play.cjs: 18/18 PASS (2026-11-17 ~01:5x WIB)
- fps01-soak.cjs: SOAK PASS, 2 rounds, 17 kills, detonation win (2026-11-17 ~01:5x)
- bot plant test: carrier plants in ~3.5 s unopposed; defuse by bot verified
- nav audit: 84 waypoints, 628 edges; site B + defender spawns fixed after
  the audit found B inside the chapel and 3 spawns inside buildings
- game/ limits: 20 files, 2.2 MB (≤993 / ≤48 MiB); source 92,052 bytes total
- fresh clone of the pushed repo: renders clean, zero errors

## Commit SHA
- e2fb2e983889465ab0381ad7f9130bff5f0fd85d (main) — pushed to
  https://github.com/Dimaa099/threejs-fps-01
- Repo created 2026-11-16T18:14:07Z, after the 17:00Z opening. Public.

## Commit SHA
- (pending)
