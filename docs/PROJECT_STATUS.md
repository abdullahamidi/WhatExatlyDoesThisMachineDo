# Project Status

## Current milestone
**Vertical slice — release-quality.** WP1–WP6 done. GAME_SPEC §16/§17 PASS; Art Director verdict RELEASE-READY (docs/plan/ART_AUDIT.md phases 1–5).

## Roadmap
| WP | Scope | State |
|---|---|---|
| WP1 | Tooling + pure simulation core | ✅ done |
| WP2 | Wasteland scene, asset registry, camera, crank, HUD | ✅ done |
| WP3 | Tech tree overlay + modular machine components | ✅ done |
| WP4 | Save/load, offline welcome-back, system menu, audio, system logs | ✅ done |
| WP5 | Balance, ASSET_GUIDE, README, build split, §16 checklist | ✅ done |
| WP6 | Mechanical correctness + art polish (Art Director audit → drive train, assets, RotSprite) | ✅ done |
| WP7 | Multi-resource core (ME/EE/PR/RS/XF), save v2 migration, number suffixes to Dc, greedy sim harness | ✅ done |
| WP8 | Multi-era infra + Era II Electrical (generator, coils, capacitor rack, spark gap, transformer, mast, lit pylons, era tabs, camera auto-frame, plaque) | ✅ done |
| WP9 | Era III Thermal/Pressure (boiler, chimney, steam hammer, turbine, pipes, steam/smoke FX, relief valves offline buffer) | ✅ done |
| WP10 | Era IV Resonance (spire, coils, crystal, dishes, calliope, fork, crank servo autoClick) | ✅ done |
| WP11 | Era V Exotic (crown, rings, siphons, lens, aperture/beam, anchors, world 3840×2160, violet sky, eclipse) | ✅ done |
| WP12 | Settings, accessibility, stats, achievements, save export/import, reduced motion (roadmap WP10) | implemented, validating |
| WP13 | Ending sequence, reveal, postgame, restored world (roadmap WP14) | in progress |
| WP14 | New-cycle prestige: Echoes, Memory perks (roadmap WP15) | planning |
| WP15 | Music bed, audio mix, perf pass (roadmap WP16) | — |
| WP16 | Release: full balance, end-to-end smoke, docs, final art audit (roadmap WP17) | — |

Plans/assignments: `docs/plan/WP*.md`. Art direction: `docs/plan/ART_BRIEF.md`.

## Completed work
- **WP1** pure simulation: data-driven techs, cost/production formulas, progression, milestones,
  tick/offline (8h cap), `GameSession` facade with events, versioned saves with recovery/migration.
- **WP2** wasteland parallax + dust, manifest asset registry with procedural fallbacks, camera
  pan/zoom/refocus, frame + clickable crank (rotation, floating +ME, shake), terminal HUD.
- **WP3** tech tree overlay (nodes, prerequisite lines, locked/available/purchased, details,
  purchase feedback), toasts, procedural machine animation driven by clicks/ME/s (clamped),
  unlock assembly, belts/shafts, Generator Blueprint milestone.
- **WP4** save/load + corrupt recovery, autosave + unload saves, offline welcome-back once,
  system menu (save, mute, two-step reset), modal/Esc stack, WebAudio synth SFX/hum/gear ticks/wind,
  rare system logs.
- **WP5** balance retune + greedy sim test, `docs/ASSET_GUIDE.md`, `README.md`, Phaser chunk split,
  browser smoke scripts in `scripts/smoke/`.
- **WP6** (Art Director loop): web-researched audit of the machine; mechanically coherent drive train
  (one master angle, gear ratios, meshing module-4 gears, belts tangent+wrapped over real pulleys with
  moving dashes, crank-pin connecting rod → piston yoke, flywheel on pedestal, motor on plinth, bearings,
  crank brace); coherent at every unlock stage; art-resolution RenderTexture; RotSprite pre-rendered
  rotation frames (clean 1-px outlines, exact gear mesh per frame); banded sky with sun, ground haze,
  contact shadows, readable +ME text, first-click crank pulse, snapped zoom, toasts top-right.
- **Art**: every sprite and background layer is PixelLab Pro in one locked palette from one style
  anchor, curated by an Opus reviewer; seams fixed; ground/pylons hazed for depth.

## Verification
- `npm run typecheck` clean · `npm test` 1804 pass (57 files) · `npm run build` clean
  (app 82 KB, phaser chunk 1.48 MB, warning limit 1500 KB).
- Playwright smokes (scripts/smoke): crank, tech tree, persistence/offline/corrupt/mute/reset,
  full machine → Generator Blueprint, unlock stages (scripts/smoke/stages.mjs). 0 console errors.
- Balance (greedy 4 clicks/s): Worn Motor 0:13, Reinforced Crank 3:16, Piston Array 12:02,
  Generator Blueprint 22:06.

## Balance (greedy harness, fast profile)
Era I: blueprint 22:06 · Era II: generator 29:18, substation 60:23 · Era III (A/B/C): boiler 67:17/80:00/164:30, vessel 112:14/126:01/260:31 · Era IV (A/B/C): convergence 174:13/189:07/351:33 · Era V (A/B/C): primaryFunction 254:37/270:00/447:30.

## Known issues
- Pylon cables peak slightly at tile seams (art; minor).
- Audio verified by code review only (no audible check in CI).
- Thin cloud streaks behind the sun (cosmetic, accepted).
- Some WP6 parts (gears, pulleys, yoke) are hand-pixelled to exact geometry rather than PixelLab output.
- Phaser chunk >500 KB by nature; warning limit raised rather than removed.

## Important technical decisions
- Art Director agent (`.claude/agents/art-director.md`, Opus) owns visual/mechanical correctness;
  audit + fix log in docs/plan/ART_AUDIT.md; tools in scripts/art and scripts/smoke.
- Rotating parts use RotSprite sheets (`<id>#rot`, frame = rotationFrame(deg, N)); gear sheets 140/80
  frames keep the 1.75 ratio exact. Regenerate with scripts/art/make_rot.py.
- Phaser pinned to 3.90.0 (npm `latest` is Phaser 4). No `override` on create/preload/init; `update` requires it.
- Vitest ^5 (advisories in 3.x). Node ≥22.12 required by Vitest 5.
- Production: `perClick = Σ clickAdd·lvl × Π clickMult^lvl`; `perSecond = Σ autoAdd·lvl × (1 + Σ autoPct·lvl/100)`.
- Cost `ceil(base × growth^level − 1e-9)`, shown with `formatCost` (rounds up).
- **Balance deviation:** spec §6 costs were initial targets; retuned in `src/data/technologies.ts`
  (e.g. Generator Blueprint needs 200K lifetime ME) for a 15–30 min first session. Documented in README.
- `GameSession` is the only gateway for UI; immutable snapshots. Boot: load → session → applyOffline →
  save → loop. `update()` gaps >60 s route through the reported offline path.
- Machine coordinates: machine-local art px, PIXEL_SCALE 2; texture key = asset id.
- Phaser also listens to window mouse events → WorldScene disables input while any modal is open.
- `session.revision` bumps every frame → UI uses events/reference checks for heavy rebuilds.
- Agents: native project agents load at session start; in the creating session roles ran as
  `general-purpose` with model overrides. Verified models: planner/reviewer `claude-opus-5-5`,
  EM `claude-sonnet-5-5`, workers `claude-haiku-5-5`.

## Next recommended task
Suggested milestones (also in README):
1. Electricity era: Generator component, second resource, power lines from the machine.
2. Steam/dust/glow production effects (use `fx.steam`), belt texture motion.
3. More machine tiers and visible silhouette growth; camera auto-zoom-out as the machine grows.
4. Audio polish + volume slider; music bed.
5. Prestige/meta loop only after the electricity era lands.
