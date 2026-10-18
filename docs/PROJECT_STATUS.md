# Project Status

## Current milestone
**First playable vertical slice — complete.** WP1–WP5 done; GAME_SPEC §16 and §17 all PASS (EM final validation).

## Roadmap
| WP | Scope | State |
|---|---|---|
| WP1 | Tooling + pure simulation core | ✅ done |
| WP2 | Wasteland scene, asset registry, camera, crank, HUD | ✅ done |
| WP3 | Tech tree overlay + modular machine components | ✅ done |
| WP4 | Save/load, offline welcome-back, system menu, audio, system logs | ✅ done |
| WP5 | Balance, ASSET_GUIDE, README, build split, §16 checklist | ✅ done |

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
- **Art**: every sprite and background layer is PixelLab Pro in one locked palette from one style
  anchor, curated by an Opus reviewer; seams fixed; ground/pylons hazed for depth.

## Verification
- `npm run typecheck` clean · `npm test` 477 pass (30 files) · `npm run build` clean
  (app 82 KB, phaser chunk 1.48 MB, warning limit 1500 KB).
- Playwright smokes (scripts/smoke): crank, tech tree, persistence/offline/corrupt/mute/reset,
  full machine → Generator Blueprint. 0 console errors.
- Balance (greedy 4 clicks/s): Worn Motor 0:13, Reinforced Crank 3:16, Piston Array 12:02,
  Generator Blueprint 22:06.

## Known issues
- Pylon cables peak slightly at tile seams (art; minor).
- Audio verified by code review only (no audible check in CI).
- `fx.steam` sprite exists but no renderer uses it yet.
- Phaser chunk >500 KB by nature; warning limit raised rather than removed.

## Important technical decisions
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
