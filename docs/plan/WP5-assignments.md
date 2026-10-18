# WP5 — Worker assignments

Source plan: `docs/plan/WP5.md` (authoritative for rationale). Spec: `docs/GAME_SPEC.md`.

## Preamble
- Deviation (Director-approved): spec numbers for tech costs and the Generator Blueprint threshold are retuned
  because a greedy player hits all milestones in < 1 min against spec numbers. Spec text is NOT edited. Deviation is
  documented in README (T5) and PROJECT_STATUS (T7).
- Rules for all workers: strict TS, no Phaser import in `src/simulation|data|persistence|utils`, balance constants
  only in `src/data/`, touch ONLY `files_owned`, no test deleted or weakened (same intent, new numbers), no `any`.
- Waves: W1 = T1, T2, T3a, T3b (parallel, 4). W2 = T4, T5, T6 (parallel, 3; needs W1 green). W3 = Director (T7).
- Gate W1 (EM, Mode B): `npm run typecheck && npm test` green. If T1 windows fail: tune ONE knob per target
  (reinforcedCrank baseCost -> RC time; pistonArray baseCost -> piston time; generatorBlueprint lifetime threshold ->
  blueprint time; wornMotor baseCost -> motor time), re-run T1, sync T3a/T3b literals, record final numbers.
- Shared retuned table (T2 applies, T3a/T3b assert, T1 observes):

| Tech | baseCost | growth | maxLevel |
|---|---:|---:|---:|
| gearRatio | 15 | 1.3 | 15 |
| reinforcedCrank | 2000 | - | - |
| flywheel | 4000 | 1.35 | 10 |
| wornMotor | 40 | - | - |
| motorTuning | 60 | 1.3 | 25 |
| pistonArray | 12000 | - | - |
| improvedPistons | 6000 | 1.3 | 25 |
| generatorBlueprint | lifetimeMe requirement **200000** (was 1000) | | |

  Effects, prerequisites, kinds, tech ids unchanged. Cost formula unchanged: `ceil(base * growth^level - 1e-9)`.

---
## WAVE 1

### T1 — Greedy balance simulation test
- Files owned: `src/simulation/balance.sim.test.ts` (new).
- Objective: deterministic greedy-player sim proving pacing targets. Imports only `src/simulation` + `src/data`
  (check existing exports: state factory / `GameSession`, `applyClick`, `advance`, `evaluateMilestones`, `purchase`,
  `getAllTechViews`, `TECH_IDS`; read how existing tests build a fresh state and copy that).
- Policy, per simulated second t = 1..3600: `applyClick` x4, `advance(state, 1)`, `evaluateMilestones`; then from
  `getAllTechViews` keep techs with status `available`, `nextCost !== null`, kind != milestone; pick lowest
  `nextCost` (ties: TECH_IDS order); if affordable, `purchase` it once. Record first t at which each tech reaches
  level 1 (incl. `generatorBlueprint` when reached).
- Acceptance:
  - Prints one `console.table` (tech, mm:ss) per run.
  - Asserts: wornMotor < 60 s; reinforcedCrank 180-300 s; pistonArray 600-900 s; generatorBlueprint 1200-1800 s.
  - No Date.now/Math.random; runs < 2 s; no Phaser/DOM imports.
- Validation: `npx vitest run src/simulation/balance.sim.test.ts` (may fail until T2 lands; report printed table).
  Expected after T2 (scratch sim): motor ~0:12, RC ~3.3 min, piston ~12 min, blueprint ~22 min.

### T2 — Data retune
- Files owned: `src/data/technologies.ts`, `src/data/systemLogs.ts`.
- Objective: apply the shared table exactly; no other field changes.
- systemLogs `lifetimeMe` triggers: 25 -> 500, 120 -> 5000, 600 -> 30000, 2500 -> 100000. `playSeconds` triggers unchanged.
- `generatorBlueprint` description/flavor unchanged. Fix any number in a tech `description` that now contradicts data.
- Acceptance: table matches; typecheck clean (other tests fail until T3a/T3b land, expected).
- Validation: `npm run typecheck`.

### T3a — Update data/sim tests
- Files owned: `src/data/technologies.test.ts`, `src/simulation/economy/cost.test.ts`,
  `src/simulation/progression/progression.test.ts`.
- Objective: tests expect the shared table. Spec-table test uses retuned values + lifetime 200000; requirement label
  test expects `'200K lifetime ME'`.
- Prefer `costAt(TECHNOLOGIES.x, lvl)`; else literals: gearRatio lvl0..3 = 15, 20, 26, 33; motorTuning 60, 78;
  flywheel 4000, 5400; improvedPistons 6000, 7800. Max-level tests use new maxLevel (gearRatio 15, flywheel 10,
  motorTuning 25, improvedPistons 25).
- Acceptance: no test deleted/weakened; each file passes alone (after T2).
- Validation: `npx vitest run src/data/technologies.test.ts src/simulation/economy/cost.test.ts src/simulation/progression/progression.test.ts`.

### T3b — Update session/UI/persistence tests
- Files owned: `src/simulation/GameSession.test.ts`, `src/persistence/persistence.test.ts`,
  `src/persistence/saveController.test.ts`, `src/ui/techTreeView.test.ts`.
- Objective: same rules as T3a. Clamp test uses gearRatio max 15; insufficient-funds shortfall = 15 (gearRatio
  first cost). Derive from `TECHNOLOGIES`/`costAt` where practical.
- Acceptance: all 4 files pass (after T2); no test deleted.
- Validation: `npx vitest run src/simulation/GameSession.test.ts src/persistence src/ui/techTreeView.test.ts`.
- Plan says 27 tests in 7 files break in total. If any file outside T3a/T3b fails after T2, report to EM (do not edit).

---
## WAVE 2 (start only after W1 gate green; final numbers known)

### T4 — Asset guide
- Files owned: `docs/ASSET_GUIDE.md` (new).
- Read: `src/assets/manifest.ts`, `assetIds.ts`, `fallbackTextures.ts`, `src/data/machineComponents.ts` (layer/socket),
  `src/data/world.ts` (parallax depth), `src/game/scenes/BootScene.ts`, `docs/plan/ART_BRIEF.md`.
- Acceptance:
  - One table row per id in `ASSET_IDS` (all 14): file path, width x height, origin/pivot, tileable, frames
    (none / frame w x h x count), layer + depth, description. Every number matches the manifest.
  - Sections: naming (`<category>.<name>` id <-> `public/assets/<category>/<kebab-name>.png`); palette + style
    (summary + link ART_BRIEF); rendering (PIXEL_SCALE 2, nearest-neighbour, side view, light from upper-left);
    replacement steps (drop PNG at path -> set manifest `file` -> keep width/height/origin -> `npm run dev`, check
    console); spritesheet steps (`frame` field); fallback (null `file` or load error -> procedural painter,
    `[assets] failed to load` warning, game keeps running); size-mismatch warning (quote exact BootScene text) and
    what to do; adding a new asset id.
- Validation (prints nothing):
  `for id in $(grep -o "'[a-z]*\.[a-zA-Z]*'" src/assets/assetIds.ts); do grep -q "${id//\'/}" docs/ASSET_GUIDE.md || echo MISSING $id; done`

### T5 — README
- Files owned: `README.md` (new).
- Read: `package.json`, `src/` tree, `CameraController.ts`, `HandCrank.ts`, `src/ui/hud*.ts`, PROJECT_STATUS.
- Acceptance:
  - Sections: about (1 paragraph + core-experience line); requirements (Node >= 18); setup/run/typecheck/test/build/
    preview commands; controls (click crank, wheel zoom, drag pan, refocus, tech tree button, SYSTEM menu, Esc) each
    checked against code; architecture overview + text data-flow diagram
    (`input -> GameSession (pure sim) -> events/snapshots -> Phaser renderers + DOM UI`;
    `SaveController <-> localStorage`; data tables -> sim); folder map; implemented features (WP1-WP5); balance
    (greedy targets, retuned table, explicit deviation from spec numbers, re-run via
    `npx vitest run src/simulation/balance.sim.test.ts`; use FINAL numbers from W1 gate); assets (link
    `docs/ASSET_GUIDE.md`); next milestones (electricity era after Generator Blueprint, big-number support, save
    export, real audio assets, a11y/keyboard, more machine parts).
  - Every command in README runs as written.
- Validation: run each README command (for `dev`, confirm script exists / server starts).

### T6 — Build polish
- Files owned: `vite.config.ts` (`index.html` only if needed; no edit expected).
- Acceptance:
  - `build.rollupOptions.output.manualChunks` puts `phaser` in its own chunk; app chunk < 300 KB.
  - `chunkSizeWarningLimit` just above the measured Phaser chunk (comment says why; Phaser 3.90 min ~1.1-1.2 MB).
    `npm run build` prints no "larger than" warning.
  - `test` block and `base: './'` unchanged. `index.html` title "What Exactly Does This Machine Do?", bg `#0d0b09`.
- Validation: `npm run typecheck && npm run build` (report chunk sizes); `npm run preview` serves the game.

---
## WAVE 3 — Director only
- T7: re-run Playwright smokes (WP2, WP3, WP4) on `npm run build && npm run preview`; edit
  `localStorage['wedtmd.save']` (`state.me`, `state.lifetimeMe`) for ME; 0 console errors. Map each GAME_SPEC §16
  bullet to evidence; check §17 deliverables 1-8. Update `docs/PROJECT_STATUS.md` (WP5 done, final table + sim
  times, chunk sizes, deviation, known issues, next milestones).

## Package validation (EM Mode B)
- `npm run typecheck` clean; `npm test` green (>= 473 + T1); `npm run build` no chunk warning.
- `npx vitest run src/simulation/balance.sim.test.ts` table inside windows.
- Purity: `grep -rli "phaser" src/simulation src/data src/persistence src/utils` -> none (inspect hits; comments-only
  mentions are acceptable if noted).
- `git diff --stat` touches only files listed above (plus PROJECT_STATUS in T7). `SAVE_VERSION` stays 1.
- Out of scope: new mechanics/techs/components/art/audio, formula/effects changes, save schema changes, big-number
  lib, CI, Playwright in repo, editing GAME_SPEC.md.
