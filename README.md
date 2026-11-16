# SOLSTICE — a sunlit hill-town tactical FPS

A round-based tactical first-person shooter in a sunlit Mediterranean hill town,
built with three.js 0.187.0 for the make.fun `threejs-fps-01` competition.
Counter-Strike-style, never a copy: its own map, art, sounds and names.

**Embers** (attackers, rust red) vs **Sentinels** (defenders, teal), 5v5 with bots.
Plant the charge at Depot (A) or Terrace (B), or eliminate the other team.
First to 7 rounds takes the match.

## Play

Serve `game/` statically and open it in desktop Chrome — no build step, no
network requests:

```sh
node serve.ts   # http://localhost:8080
```

Click **Click to play**, then:

| Input | Action |
|---|---|
| W A S D / mouse | Move / look |
| Click | Fire (hold for automatics) |
| R | Reload |
| E | Plant / defuse the charge (hold) |
| G | Cook a frag grenade (release to throw) |
| F | Throw a flash grenade |
| Ctrl / Space | Crouch / jump |
| Right mouse | Aim down sights (marksman rifle) |
| 1–7 or click | Buy during the buy phase |
| Tab | Scoreboard |

## Systems

- **Gunplay** — hitscan with head multiplier, per-weapon recoil patterns and
  bloom, spread states for still / crouch / move / air (stopping to aim pays),
  ADS zoom on the marksman rifle, a multi-pellet shotgun, armor absorption,
  acceleration movement, crouch and jump, one shared collision body.
- **Tactics** — the charge can be planted/defused by any actor with a progress
  bar, drops when its carrier dies, and can be picked up by a teammate. Every
  bot carries its own wallet and buys by a money/role heuristic. A hearing bus
  turns gunfire, footsteps, reloads and plants into sound events with distance
  falloff, wall muffling and short memory; bots investigate, hold pre-aimed
  angles, rotate and retake. A\* navigation over a waypoint graph whose edges
  are validated against the colliders. Cookable frag grenades with
  line-of-sight blast checks, plus flash grenades (LOS + facing).
- **HUD 2.0** — health, ammo, round timer, score, team-alive pips, hitmarkers,
  plant/defuse progress bars, kill feed, end-of-round scoreboard with K/D/DMG,
  and a canvas minimap drawn from the real collider list.
- **Code** — single-job modules (`config`, `state`, `collide`, `nav`, `hearing`,
  `audio`, `effects`, `weapons`, `grenade`, `bomb`, `bots`, `player`, `rounds`,
  `hud`, `map`, `game`), one state store, a fixed 120 Hz simulation decoupled
  from rendering, pooled effects, seeded RNG for deterministic matches.
- **The map** — a compact three-lane hill town: Depot (A) fuel-crate yard west,
  Terrace (B) chapel terrace east, market street at mid, a bell-tower landmark.
  Bright midday sun, whitewash / terracotta / sandstone palette with teal
  accents. The scene reads at a glance.

## Layout

```
main.ts            entry program (Node 22): copies game/ + screenshots/ to
                   /output and writes /output/dossier.json
serve.ts           static server for local play
game/              the playable game (static ES modules, no build step)
  index.html       HUD 2.0 DOM + import map
  src/             the game, one job per module (see Systems)
  vendor/three/    three.js 0.187.0, vendored byte for byte
screenshots/      1-start (cover) · 2-play · 3-plant · 4-end, 1280×720
vendor/           makefun-threejs.ts (kit copy, unchanged)
```

Screenshots are staged renders of the game's own code via `?shot=start|play|
plant|end&seed=7` (see `shots.json`).

## Verify

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # deterministic dossier
```

## License

MIT — see [LICENSE](LICENSE).
