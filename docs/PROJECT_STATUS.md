# Project Status

## Current milestone
WP4 — Persistence, feedback, audio (planning). WP1–WP3 complete.

## Roadmap
| WP | Scope | State |
|---|---|---|
| WP1 | Tooling + pure simulation core | ✅ done |
| WP2 | Wasteland scene, asset registry, camera, crank, HUD | ✅ done |
| WP3 | Tech tree overlay + modular machine components | ✅ done |
| WP4 | Save/load wiring, offline summary, settings, audio | planning |
| WP5 | Balance, ASSET_GUIDE, README, smoke test, §16 checklist | — |

Plans/assignments: `docs/plan/WP*.md`.

## Completed work
- Agent hierarchy (`.claude/agents/`), `CLAUDE.md`, `docs/GAME_SPEC.md`.
- **WP1**: Vite 6 + TS 5.9 strict + Phaser 3.90.0 + Vitest 5 scaffold. Pure modules:
  `src/data` (technologies, balance), `src/simulation` (cost, rates, tick/offline, progression,
  milestones, `GameSession` facade with typed events), `src/persistence` (versioned codec,
  validation/recovery, `SaveManager`), `src/utils/format`. 198+ unit tests.
  Validated by EM (typecheck/test/build/purity greps) and approved by Opus reviewer.
- WP1 review follow-ups (done, 215 tests): unlimited-maxLevel save clamp fix, `GameSession.revision`, settings
  ownership (`settings`, `setMuted`), offline-never-silent `update()`, readonly snapshots, `formatCost`.

- **WP2**: wasteland parallax (sky, mountains, skyline, pylons, terrain, dust), asset registry
  (manifest + procedural fallbacks), camera pan/zoom/refocus, machine frame + clickable crank with
  floating +ME/shake, terminal HUD. Browser smoke-tested (Playwright).
- **WP3**: tech tree overlay (nodes, prerequisite lines, states, detail, purchase feedback), toasts,
  procedural machine animation (rotate/vibrate/reciprocate driven by clicks/ME/s, clamped), unlock
  assembly animation, belts/shafts, milestone. 8-step browser smoke passes, 0 console errors.
- **Art**: all machine sprites PixelLab Pro, one style anchor + locked palette (docs/plan/ART_BRIEF.md),
  curated by Opus reviewer. Background layers: round 2 in progress (round 1 rejected).

## Remaining tasks
- WP4 (save/offline UI/settings/audio/logs), WP5 (balance, ASSET_GUIDE, README, final checklist).
- Background art round 2.

## Known issues
- None open.

## Important technical decisions
- Phaser pinned to 3.90.0 (npm `latest` is Phaser 4; spec requires Phaser 3). Phaser 3.90 typings
  don't declare `create`/`update`/`preload` on Scene → do not use `override` on lifecycle methods.
- Vitest upgraded ^3 → ^5 (critical advisories in the 3.x toolchain; dev-only).
- Production: `perClick = Σ clickAdd·lvl × Π clickMult^lvl`; `perSecond = Σ autoAdd·lvl × (1 + Σ autoPct·lvl/100)`.
- Cost: `ceil(base × growth^level − 1e-9)`; displayed with `formatCost` (rounds up).
- `GameSession` is the only gateway for UI/rendering; snapshots are immutable. Host order:
  load → `new GameSession({state, settings})` → `applyOffline()` → loop `update()`. Gaps
  > `OFFLINE_REPORT_THRESHOLD_SECONDS` in `update()` go through the offline path (reported).
- Renderers build initial visuals from `state.techLevels` (no unlock events on load) and rebuild on `reset`.
- Native project agents load only at session start; in the creating session roles ran as
  `general-purpose` with model overrides. Effective models verified from transcripts:
  planner/reviewer `claude-opus-5-5`, EM `claude-sonnet-5-5`, workers `claude-haiku-5-5`.

- Coordinates: machine-local art px (origin frame base centre), PIXEL_SCALE 2; texture key = asset id.
- Phaser handles window-level mouse events → WorldScene disables scene input while tech tree is open.
- `session.revision` bumps every frame; UI uses events / reference checks, not revision, for heavy rebuilds.

## Next recommended task
- WP4 per docs/plan/WP4.md. Carry-overs from WP3 review: shared Esc/modal stack; audio taps for
  purchase-denied and part-landed.
