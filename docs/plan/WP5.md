# WP5 — Polish & verification

Goal: first 30 min paced to targets, asset guide + README delivered (§13, §17), clean build, §16 verified.

## Planner findings (verified in a scratch copy, repo untouched)
- Greedy player (4 clicks/s, buy cheapest each second) on current spec numbers: Worn Motor 0:11,
  Reinforced Crank 0:19, Piston Array 0:45, Generator Blueprint 0:45. **Far off** targets → retune required.
- Candidate table below (scratch sim): Worn Motor 0:12, Reinforced Crank 3.3 min, Piston Array 12.0 min,
  Generator Blueprint 22.1 min. Applying it breaks 27 tests in 7 files that hard-code old costs (list in T3a/T3b).
- `index.html` already has `<title>` and bg `#0d0b09` → only check them. Phaser 3.90 minified is ~1.1–1.2 MB, so
  a Phaser chunk can never be < 500 KB: split it, keep the app chunk small, set the warning limit just above the
  Phaser chunk.
- BootScene already warns on size mismatch (`warnOnSizeMismatch`) and on load failure → the guide documents it, no code.
- Debug hook is read-only → Director smokes give ME by editing `localStorage['wedtmd.save']` (`state.me`,
  `state.lifetimeMe`) and reloading.

## Retuned table (T2 applies, T3a/T3b assert)
| Tech | baseCost | growth | maxLevel |
|---|---:|---:|---:|
| gearRatio | 15 | 1.3 | 15 |
| reinforcedCrank | 2000 | – | – |
| flywheel | 4000 | 1.35 | 10 |
| wornMotor | 40 | – | – |
| motorTuning | 60 | 1.3 | 25 |
| pistonArray | 12000 | – | – |
| improvedPistons | 6000 | 1.3 | 25 |
| generatorBlueprint | lifetimeMe requirement **200000** (was 1000) | | |
Effects, prerequisites, kinds and tech ids stay unchanged. The spec text is not edited: the change is a
documented deviation (README + PROJECT_STATUS).

## Work Package 5: Polish & verification

### Wave 1 (4 parallel, exclusive files)
- T1 Greedy balance simulation test — files: `src/simulation/balance.sim.test.ts` (new) — depends on: none
  (imports only `src/simulation` + `src/data`, so it runs against whatever table is in the data).
  Policy, per simulated second t = 1..3600: call `applyClick` 4 times, `advance(state, 1)`, `evaluateMilestones`;
  then from `getAllTechViews` take techs with status `available`, `nextCost !== null`, kind ≠ milestone; pick the
  lowest `nextCost` (ties: TECH_IDS order); if affordable, `purchase` it once. Record the first t at which each tech
  reaches level 1, and when `generatorBlueprint` is reached.
  Acceptance:
  - Prints one `console.table` (tech, mm:ss) per run.
  - Asserts: wornMotor < 60 s; reinforcedCrank 180–300 s; pistonArray 600–900 s; generatorBlueprint 1200–1800 s.
  - Deterministic (no Date.now/random); runs < 2 s; no Phaser/DOM imports.
- T2 Data retune — files: `src/data/technologies.ts`, `src/data/systemLogs.ts` — depends on: none.
  Acceptance:
  - The table above, applied exactly. No other field changes.
  - systemLogs `lifetimeMe` triggers rescaled to the new economy: 25→500, 120→5000, 600→30000, 2500→100000.
    (playSeconds triggers unchanged.)
  - The `generatorBlueprint` description/flavor stay as they are. No number in any tech `description` contradicts
    the new data.
- T3a Update data/sim tests — files: `src/data/technologies.test.ts`, `src/simulation/economy/cost.test.ts`,
  `src/simulation/progression/progression.test.ts` — depends on: T2 numbers (fixed above, so it can run in parallel).
  Acceptance:
  - Spec-table test expects the retuned table and lifetime 200000. Requirement label test expects `'200K lifetime ME'`.
  - Literal costs replaced by values from `costAt(TECHNOLOGIES.x, lvl)` where practical, otherwise by the new
    literals (gearRatio lvl 0..3 = 15, 20, 26, 33; motorTuning 60, 78; flywheel 4000, 5400; improvedPistons
    6000, 7800). Max-level tests use the new maxLevel.
  - No test deleted or weakened (same intent, new numbers). The file passes on its own.
- T3b Update session/UI/persistence tests — files: `src/simulation/GameSession.test.ts`,
  `src/persistence/persistence.test.ts`, `src/persistence/saveController.test.ts`, `src/ui/techTreeView.test.ts`
  — depends on: T2 numbers (fixed above).
  Acceptance: same rules as T3a (derive from `TECHNOLOGIES`/`costAt` where practical; the clamp test uses gearRatio
  max 15; insufficient shortfall = 15). All 4 files pass. No test deleted.

Wave 1 gate (EM): `npm test` all green. If T1 windows fail, the fix loop may change only one knob per target:
reinforcedCrank baseCost (RC time), pistonArray baseCost (piston time), lifetime threshold (blueprint time),
wornMotor baseCost (motor time). Re-run T1 after each change, update T3a/T3b literals, record the final numbers.

### Wave 2 (3 parallel, exclusive files) — depends on Wave 1 green (final numbers known)
- T4 Asset guide — files: `docs/ASSET_GUIDE.md` (new) — depends on: none in code; reads `src/assets/manifest.ts`,
  `assetIds.ts`, `fallbackTextures.ts`, `src/data/machineComponents.ts` (layer/socket), `src/data/world.ts`
  (parallax depth), `src/game/scenes/BootScene.ts`, `docs/plan/ART_BRIEF.md`.
  Acceptance:
  - One table row per asset id in `ASSET_IDS` (all 14): file path, width×height, origin/pivot, tileable,
    frames (none / frame w×h×count), layer + depth, description.
  - Sections: naming (`<category>.<name>` id ↔ `public/assets/<category>/<kebab-name>.png`); palette + style
    (summarize, link ART_BRIEF); rendering (PIXEL_SCALE 2, nearest-neighbour, side view, light upper-left);
    replacement steps (drop PNG at the path → set manifest `file` → keep width/height/origin → `npm run dev`, check
    console); spritesheet steps (`frame` field); fallback (null `file` or load error → procedural painter, `[assets]
    failed to load` warning, game keeps running); size-mismatch warning text and what to do; adding a new asset id.
  - Every number matches the manifest. Check: `for id in $(grep -o "'[a-z]*\.[a-zA-Z]*'" src/assets/assetIds.ts); do grep -q "${id//\'/}" docs/ASSET_GUIDE.md || echo MISSING $id; done` prints nothing.
- T5 README — files: `README.md` (new) — reads: package.json, `src/` tree, CameraController/HandCrank/hud for controls,
  PROJECT_STATUS.
  Acceptance:
  - Sections: about (1 paragraph + core-experience line); requirements (Node ≥ 18); setup/run/typecheck/test/build/
    preview commands; controls (click crank, mouse wheel zoom, drag pan, refocus, tech tree button, SYSTEM menu, Esc),
    each checked against the code; architecture overview + text data-flow diagram
    (`input → GameSession (pure sim) → events/snapshots → Phaser renderers + DOM UI`; `SaveController ↔ localStorage`;
    data tables → sim); folder map; implemented features (WP1–WP5); balance (greedy targets, retuned table, deviation
    from spec numbers, how to re-run `npx vitest run src/simulation/balance.sim.test.ts`); assets (link ASSET_GUIDE);
    suggested next milestones (electricity era after Generator Blueprint, big-number support, save export, real audio
    assets, a11y/keyboard, more machine parts).
  - Every command in the README runs as written.
- T6 Build polish — files: `vite.config.ts` (and `index.html` only if needed) — depends on: none.
  Acceptance:
  - `build.rollupOptions.output.manualChunks` puts `phaser` in its own chunk. App chunk < 300 KB.
  - `chunkSizeWarningLimit` set to just above the measured Phaser chunk (comment says why). `npm run build` prints no
    "larger than" warning.
  - The `test` block and `base: './'` unchanged. `index.html` title is "What Exactly Does This Machine Do?" and the
    page bg is the dark terminal colour (already true → no edit expected). `npm run preview` loads the game.

### Wave 3 — Director only (no workers)
- T7 §16 walkthrough + status — files: `docs/PROJECT_STATUS.md` — depends on: T1–T6.
  Acceptance:
  - Re-run all Playwright smokes (WP2 scene/camera, WP3 8-step tree/machine, WP4 save/offline/corrupt/mute/reset)
    on `npm run build && npm run preview`, using save edits for ME. 0 console errors.
  - Each §16 bullet mapped to evidence (smoke step or test file) in PROJECT_STATUS. §17 deliverables 1–8 checked.
  - PROJECT_STATUS: WP5 done, final balance table + sim times, chunk sizes, known issues, next milestones.

### Package acceptance / validation commands
- `npm run typecheck` is clean. `npm test` all green (≥ 473 + T1). `npm run build`: no chunk warning.
- `npx vitest run src/simulation/balance.sim.test.ts` shows the timing table inside the target windows.
- Purity: `grep -rln "phaser" src/simulation src/data src/persistence src/utils` → none.
- The asset-id grep in T4 → no output. `git diff --stat` only touches the files listed above.

### Out of scope for this package
- New mechanics, techs, components, art, or audio. Changes to the formula or effects. Save schema changes
  (`SAVE_VERSION` stays 1; existing saves load, and levels above a new maxLevel are clamped by the existing logic).
- Big-number library, electricity resource, CI setup, adding Playwright to the repo. Editing GAME_SPEC.md.
