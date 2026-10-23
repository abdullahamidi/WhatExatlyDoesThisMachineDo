# WP18 - Worker Assignments (Engineering Manager, Mode A)

Source: planner WP18 (D1-D11, C1-C15, T1-T11) + `docs/plan/STEAM_DEMO_PROGRAM.md` D3 (wins) + repo read at HEAD `d07778f` (working tree clean).
Save as `docs/plan/WP18-assignments.md`. Baseline: typecheck clean, 84 files / 2605 tests, build OK, bundle budget PASS (app raw 343.5 KB of 400, gzip 101.5 of 110, css 27.7 of 30 KB, phaser 1481.8 of 1500).
Parallel tracks: WP19 (`C:/Users/sanan/wedtmd-shell`) and A17 (`C:/Users/sanan/wedtmd-art`). WP18 workers never touch those folders or the forbidden files (list in the common preamble).

## Verification done by the EM before decomposing
- D2 re-computed by a throwaway probe (deleted): 45 gated techs, TECH_IDS has 50, 104 components; values copperWinding 20, firebox 20, harmonicCoil 25, containmentRing 25, resonantSiphon 20, graviticAnchor 10, rest 1; absent motorTuning, improvedPistons, horizonField, finalAlignment, primaryFunction. Eras: bellowsDrive 3, gridExciter 4, mainsBackfeed 5, steamLance 5, harmonicConvergence 4, blueprints 1/2/3. The `aperture` component is visible by `lensArray`; its latch is `skyAperture` 1, 6 frames, 5 fps (so 1.2 s).
- `CameraController.target()` options, `viewPose`, `cameraPoseAt`, `finaleFrame` branches, `MachineView`/`MachineAnimator` session use, `GameSession.on` generic signature, `TypedEmitter`, `ModalStack` semantics (`closeTop` = Esc), `.hud-btn` CSS values, `#ui-root` pointer-events none, `.hud-buttons` pointer-events auto, hotkey rules (Space/Enter crank is ignored on an interactive target and when a modal is open; `T` still toggles the tree) were read and match the plan.
- Zoom grid step = 0.5 / PIXEL_SCALE = 0.25; effective min zoom 0.5; portrait (1920,1080,.5), baseL (1320,1380,1), baseR (2520,1380,1) are valid unclamped centres.

## EM deviations from the planner text (these WIN)
1. **Task split / waves.** T2 (too big for one Haiku pass) = **T2** (data + level maths + poses + MachineSource) and **T2b** (`src/game/math/teaser.ts`: teaserLevels / teaserRates / teaserFrame, NOT in `math/showcase.ts`). T9 = **T9** (FinaleDirector) + **T9b** (WorldScene). T10 = **T10** (debug hook + finale.mjs + README) + **T10b** (showcase.mjs). 13 tasks, 4 waves, never more than 4 parallel. T11 (visual tuning) is conditional and issued in Mode B (below).
2. **Teaser import path:** consumers import `teaserFrame`, `teaserRates`, `TeaserEra`, `TeaserFrame` from `src/game/math/teaser.ts` (ShowcaseScene, tests). Everything else of C4 stays in `src/game/math/showcase.ts`.
3. **`SHOWCASE_PORTRAIT`** is `satisfies { view: keyof typeof FINALE_VIEWS }` (no dependency on T1's `FinaleViewId` type, so T1 and T2 are independent).
4. **sceneMaxForEra world gates:** `horizonField 20` comes from the `horizonGlow` layer `alphaStages` (1/10/20); `DUST_RISING` is `resonatorSpire 1`, not horizonField. Gates also include `ECLIPSE.diamond.techId` (skyAperture 1) and `PYLON_FEEDS` gates.
5. **`teaserLevels(era, open=true)`** also raises the aperture gate tech to its `minLevel` (open means open at any era).
6. **C8 `PhotoModeDeps.overlay`** is `Pick<PhotoOverlay, 'show' | 'hide' | 'hintVisible'>` so `state().hint` is the real overlay hint (smoke D asserts hint false after 3.2 s).
7. **Photo chip CSS:** no `:focus-visible` opacity rule and programmatic focus does not arm the hint. Otherwise a keyboard entry (smoke D) keeps the chip at opacity 1 forever and the `d_photo_postgame` shot would contain DOM. Added `pointer-events:auto` (root is `pointer-events:none`), `z-index:120`, hover state.
8. **`ShowcaseState` gains `camera`** (`CameraPose` of the Showcase main camera): `cameraState()` reads the World camera, so smoke E needs it.
9. **showcase.mjs run B is a fresh context** (GREEDY levels are below S15; in the A context nothing could be hidden). C and D continue in B's context; C2 reloads it.
10. Smoke D drag start (640,360) is safe: the crank zone is disabled in photo mode.
11. **Test count:** 6 new test files (data/showcase, math/showcase, math/teaser, sources, photoModeController, photoModeRules) so the package gate is >= 90 files.
12. Worker prompts use `cd '<R>'` single-quoted paths and avoid backslashes so the Director can paste them safely.

## Waves
| Wave | Tasks | Gate |
|---|---|---|
| 1 | **T1** finale timeline, **T2** showcase core, **T3** HUD button, **T4** photo DOM overlay | baseline green |
| 2 | **T2b** teaser maths, **T5** renderers read MachineSource, **T6** sources, **T7** camera + crank + photo controller | W1 merged |
| 3 | **T8** ShowcaseScene, **T9** FinaleDirector, **T9b** WorldScene | W2 merged |
| 4 | **T10** hook + finale.mjs + README, **T10b** showcase.mjs | W3 merged, tsc clean |
| 5 | EM Mode B (validation, smokes, visual review); T11 only if the visual review fails | W4 merged |

### Transient tsc / test state (inside a wave only)
| After | Allowed |
|---|---|
| W1 | tsc clean expected (T1 changes FINALE_CAMERA type and adds a required `FinaleFrame.completeEra`; its consumers are in the same task; T3 adds `Hud.onViewMachine` + `HudView.viewMachine`, no consumer yet). |
| W2 (in flight) | none expected: every W2 task imports only W1 exports. After W2: tsc clean (`GameContext` / `GameSession` satisfy `MachineViewContext` / `MachineSource`, so WorldScene compiles unchanged). |
| W3 (in flight) | T9b passes `display` to `FinaleDirector` deps before T9 adds it: one transient error "display does not exist in type FinaleDirectorDeps". After W3: tsc clean. |
| W4 | none expected. |

## Tasks (full worker prompts are in the structured output `waves[].tasks[].prompt`; paste verbatim after the common preamble)
| Id | Wave | Files owned | Depends |
|---|---|---|---|
| T1 | 1 | `src/data/finale.ts`, `finale.test.ts`, `src/game/math/finale.ts`, `finale.test.ts` | - |
| T2 | 1 | `src/data/showcase.ts`, `showcase.test.ts`, `src/game/math/showcase.ts`, `showcase.test.ts`, `src/game/entities/machineSource.ts` | - |
| T3 | 1 | `src/data/hud.ts`, `hud.test.ts`, `src/ui/hudView.ts`, `hudView.test.ts`, `src/ui/hud.ts` | - |
| T4 | 1 | `src/data/photoMode.ts`, `src/ui/photoModeRules.ts`, `photoModeRules.test.ts`, `src/ui/photoMode.ts`, `src/ui/photoMode.css` | - |
| T2b | 2 | `src/game/math/teaser.ts`, `teaser.test.ts` | T2 |
| T5 | 2 | `MachineView.ts`, `MachineAnimator.ts`, `ApertureBeam.ts`, `SteamFx.ts`, `Eclipse.ts` | T2 |
| T6 | 2 | `src/game/sources.ts`, `sources.test.ts` | T2 |
| T7 | 2 | `CameraController.ts`, `HandCrank.ts`, `src/game/photoModeController.ts`, `photoModeController.test.ts` | T2, T4 |
| T8 | 3 | `src/game/scenes/ShowcaseScene.ts` | T2, T2b, T5, T6 |
| T9 | 3 | `FinaleDirector.ts` | T1, T2, T5, T6 |
| T9b | 3 | `WorldScene.ts` | T3, T4, T5, T6, T7, (T9 contract) |
| T10 | 4 | `src/game/debugHook.ts`, `scripts/smoke/finale.mjs`, `scripts/smoke/README.md` | T8, T9b |
| T10b | 4 | `scripts/smoke/showcase.mjs` | contract (T10 hook) |

## Mode B checklist (W5, EM runs)
```
R='C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo'; cd "$R"
PW=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright
OUT=C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP18
npm run typecheck ; npm test                     # >= 90 files, >= 2605 + new tests, all pass
npm run build ; node scripts/perf/bundle-budget.mjs   # PASS (app raw <= 400 KB); build refreshes the preview on :4173 (never start another server)
npx vitest run src/data/finale.test.ts src/game/math/finale.test.ts src/data/showcase.test.ts src/game/math/showcase.test.ts src/game/math/teaser.test.ts src/game/sources.test.ts src/game/photoModeController.test.ts src/ui/photoModeRules.test.ts src/ui/hudView.test.ts src/data/hud.test.ts src/game/math/machineVisibility.test.ts
npx vitest run src/simulation/fullRun.e2e.test.ts src/simulation/signoff.sim.test.ts src/simulation/GameSession.ending.test.ts src/simulation/prestige.sim.test.ts src/game/newCycle.test.ts
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/game/sources.ts src/game/photoModeController.ts src/game/entities/machineSource.ts src/ui/photoModeRules.ts   # empty
git diff --name-only d07778f -- src/game/bootstrap.ts src/main.ts index.html package.json src/game/scenes/BootScene.ts src/ui/systemMenu.ts src/data/systemMenu.ts src/ui/menu/settingsView.ts src/data/settings.ts src/persistence src/audio src/data/audio.ts src/data/music.ts public/assets src/assets src/data/machineComponents.ts src/data/world.ts src/game/rendering/FloatingText.ts src/ui/hud.css   # empty
mkdir -p "$OUT/finale" "$OUT/stages" "$OUT/showcase"
PW_PATH=$PW node scripts/smoke/finale.mjs http://localhost:4173/ "$OUT/finale"         # errors [], finale_0_fastforward_failed [], k3_9/5_4/6_9 completeEra 3/4/5, k41_5 (1320,1380,1), k45_8 (2520,1380,1), 5_reload_postgame camera (1920,1080,.5), r_42 zoom .5
PW_PATH=$PW ONLY=s15_era5_full,s16_postgame node scripts/smoke/stages.mjs http://localhost:4173/ "$OUT/stages"   # errors [], parts5/parts17 all true, s16 title RESTORATION ENGINE
PW_PATH=$PW node scripts/smoke/showcase.mjs http://localhost:4173/ "$OUT/showcase"     # errors [], 13 PNGs at 3840x2160
```
Visual review: Read every `$OUT/showcase/*.png` and give a per-shot verdict.
- Whole machine framed (both anchors, aperture, ground line), no clipped parts.
- a_* and d_* contain no HUD or DOM.
- b_k3_9 / b_k5_4 / b_k6_9 show parts appearing step by step.
- b_k41_5 / b_k45_8: anchor whole with >= 32 screen px margin, boiler/chimney (L) and mast (R), ground line visible.
- c shows RESTORATION ENGINE and the VIEW MACHINE button.
- e_teaser_end shows a violet world with an open aperture and no restored sky.
Director sends the PNGs to the user (SendUserFile).

### W5 conditional task T11 - visual tuning (single tuning owner, issued only if the review fails)
Files: `src/data/finale.ts` (ONLY `FINALE_VIEWS.baseL/baseR` and the 3 survey keys), `src/data/showcase.ts` (ONLY `SHOWCASE_TEASER`). Procedure: edit, `npm run build`, rerun `showcase.mjs`, Read `b_k41_5`, `b_k45_8`, `e_*`. Keep: last survey key ends at 49.3, keys non-overlapping, zoom on the 0.25 grid, centres valid after clamp, all T1/T2/T2b tests green. The EM writes the concrete numbers into the assignment from the findings (it cannot be pre-written).

## Director notes (cannot be done inside WP18)
- **WP19 merge:** WP18 edits `src/ui/hud.ts` (new button), `src/game/debugHook.ts` (appended fields), `src/game/scenes/WorldScene.ts`. `photoMode.css` hides every `#ui-root` child except `.photo-chip`; if WP19 puts a crash overlay / title inside `#ui-root`, exempt it: `:not(.photo-chip):not(#crash-overlay)`.
- **A17 / Art Director:** restored accent v1 is "lamps lit" (`RESTORED_ACCENT.holdFrames`, hook point = `MachineAnimator` restored branch). The violet to warm-white core needs an art variant (A17 call). Watch item: at zoom 1 (survey) the wipe step edge doubles to 32 screen px; check `b_k41_5` / `b_k45_8`.
- **WP21:** call `ShowcaseScene.play(game, { settings, onDone })` / `ShowcaseScene.stop(game)`; WP21 owns name redaction, end card, trigger and DOM hiding. Scene is registered lazily; the World is slept while it plays.
- **Docs:** Director updates `docs/PROJECT_STATUS.md` and the `ART_ERA5.md` section 7 S3 row (survey).
- **Known side effect:** completion beat parts fire the normal `partLanded` cue (existing clank); no new audio.

## Out of scope
Demo end card / trigger / redaction (WP21), Steam shell and UI anchoring (WP19), new art or restored-core recolor (A17), audio, balance / simulation / save changes, render-resolution increase, a keyboard shortcut for VIEW MACHINE (needs bootstrap), ShowcaseScene DOM overlays.
