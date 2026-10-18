# Project Status

## Current milestone
WP2 — World + interactive crank (planning). WP1 complete.

## Roadmap
| WP | Scope | State |
|---|---|---|
| WP1 | Tooling + pure simulation core | ✅ done |
| WP2 | Wasteland scene, asset registry, camera, crank, HUD | planning |
| WP3 | Tech tree overlay + modular machine components | — |
| WP4 | Save/load wiring, offline summary, notifications, audio | — |
| WP5 | Balance, ASSET_GUIDE, README, smoke test, §16 checklist | — |

Plans/assignments: `docs/plan/WP*.md`.

## Completed work
- Agent hierarchy (`.claude/agents/`), `CLAUDE.md`, `docs/GAME_SPEC.md`.
- **WP1**: Vite 6 + TS 5.9 strict + Phaser 3.90.0 + Vitest 5 scaffold. Pure modules:
  `src/data` (technologies, balance), `src/simulation` (cost, rates, tick/offline, progression,
  milestones, `GameSession` facade with typed events), `src/persistence` (versioned codec,
  validation/recovery, `SaveManager`), `src/utils/format`. 198+ unit tests.
  Validated by EM (typecheck/test/build/purity greps) and approved by Opus reviewer.
- WP1 review follow-ups (in progress): unlimited-maxLevel save clamp fix, `GameSession.revision`, settings
  ownership (`settings`, `setMuted`), offline-never-silent `update()`, readonly snapshots, `formatCost`.

## Remaining tasks
- WP2–WP5 (see roadmap).

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

## Next recommended task
- WP2 decomposition by the Engineering Manager once `docs/plan/WP2.md` lands.
