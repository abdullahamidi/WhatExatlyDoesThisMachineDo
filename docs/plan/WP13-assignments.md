# WP13 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP13.md` (contracts C1-C5, decisions D1-D10, tasks T1-T11) + real code read at HEAD `d9e429c` (WP12 W1-W3 landed; WP12 T11 + camera `fullView` fix still uncommitted in the tree).
Template: `WP12-assignments.md`. Numbering: WP13 = finale, WP14 = prestige. Save stays **v2** (additive optional `state.ending`). No balance change, **no new art, workers never touch `public/**`**.
Baseline: working tree today = **57 files / 1800 tests** green. Director re-records `npx vitest run 2>&1 | grep -E "Test Files|Tests "` right before W1; every later run must stay >=.

## How the Director uses this file
For every worker: spawn `implementation-worker`, paste **(1) Common preamble** (fenced block) then **(2) exactly one assignment block**. Same-wave workers run in parallel (max 4). After each wave: that wave's tests + `npx tsc --noEmit`, compare with the transient table, then next wave.

| Wave | Ids | Gate before start |
|---|---|---|
| 1 | **T1** ending state+session+save, **T2** finale data+palette+assets+layer rows, **T3** pure finale maths+newCycle+context, **T4** smoke scripts | WP12 T11 + camera `fullView` worker finished AND committed (T2 edits `src/data/world.ts` + `world.test.ts`, both currently modified by the camera fix). Re-read before editing anyway. |
| 2 | **T5** finale overlay UI, **T6a** reveal labels (HUD/tree/toasts), **T6b** system menu NEW CYCLE row + bootstrap, **T8** world layers | W1 merged, tsc clean. T8 touches `Eclipse.ts` (WP12 T11 edited it): committed by then. |
| 3 | **T7** finale audio, **T9** finale FX, **T10** machine animator + camera, **T11** director + wiring | W2 merged, tsc clean. WP12 T11 + camera fix MUST be committed (T10 owns MachineAnimator/MachineView/CameraController). T11 codes against C5 signatures: its tsc errors on `applyFinale` / `setOverride` / `setFinale` / `fireBurst` vanish when T9/T10 land. Director: may start all four at once; T11 is validated last. |
| 4 | EM Mode B, `implementation-reviewer`, Art Director keyframe audit, Director smoke | W1-W3 |

### Transient tsc errors (inside a wave only; wave end must be clean)
| After | Allowed to fail inside the wave |
|---|---|
| W1 | `data/world.ts` import of `FinaleTrackId` until T2 `finale.ts` lands (T2 writes the types FIRST); `game/math/finale.ts` / `game/newCycle.ts` / `game/context.ts` imports of T1/T2 types (`EndingPhase`, `FINALE_*`, `FinaleBeat`) until they land; any test file that builds a full `GameState` literal fails `tsc` until T1 adds `ending` (T1 fixes them all) |
| W2 | none expected (all W1 types merged) |
| W3 | T11 only: `applyFinale`, `setOverride`, `setFinale`, `fireBurst`, `getComponentState().frame`, `FinaleFx` until T9/T10 land. T7: none |

## EM decisions / deviations from WP13.md (these WIN over WP13.md)
1. **Reduced motion = WP12 settings.** WP12 added `settings.reducedMotion` + `motionPolicy` (`src/simulation/settings.ts`); `bootstrap.ts` already seeds `reducedMotion` from `prefers-reduced-motion` for a NEW save. So **drop** `src/game/reducedMotion.ts` and `createReducedMotionQuery` (C2) and D8's media-query read. The director computes `reduced = !motionPolicy(session.settings).flashes` once at sequence start (frozen for the run). `FINALE_*.reduced` data stays. Smoke sets it with `__wedtmd.session.updateSettings({ reducedMotion: true })` (no `emulateMedia`).
2. **Input lock during the finale (new).** WP12 hotkeys: `t` toggles the tech tree even while a modal is open, `Esc` opens the menu only when NO modal is open. So: (a) new pure `isFinaleLocked(e: EndingState): boolean` in `ending.ts` (T1) = phase `'sequence' | 'choice'`; (b) T11 bootstrap `toggleTechTree` + `openMenu` hotkey callbacks return early when `isFinaleLocked(session.state.ending)`; (c) T5 overlay sets `inert` on the HUD container while shown, so Tab/Enter cannot reach HUD buttons.
3. **Event order of `purchase()`** (WP12 added `checkAchievements`): `purchase` -> `unlock` -> milestone -> `achievement` -> **`ending` LAST** (WP13.md C1 said "after milestone check"; the `restoration` toast must be emitted before the HUD fades). T1 places `startEnding` AFTER `checkAchievements()`.
4. **xf label reveal via module flag** (like `setDefaultNotation`), not parameter threading: new pure `src/ui/revealRules.ts` (T6a): `setRevealed(b: boolean)`, `isRevealedLabel(): boolean`, `resourceShort(id: ResourceId): string` (= `REVEALED.xf.short` for `xf` when flag set, else `RESOURCES[id].short`). Every UI `RESOURCES[..].short` in `hudView.ts`, `hud.ts`, `notificationRules.ts` (welcome text), `techTreeView.ts` goes through `resourceShort`. T11 bootstrap calls `setRevealed(isRevealed(session.state.ending))` at boot and on `ending` / `reset` events. Signatures of `buildHudView`, `welcomeBackMessage`, `buildEraTabs`, `buildTechTreeView`, `clickGainText` do NOT change. Tech descriptions, requirement labels (`status.ts`, `requirements.ts`) and the stats panel keep `???` (out of scope, lore text).
5. **Plaque via data row** (not a flag): T2 appends `{ milestone: 'primaryFunction', text: REVEALED.plaque }` to `PLAQUE_LINES` (`story.ts`). T2 also fixes the one `hudView.test.ts` plaque assertion if it breaks (that file is T6a's in W2; sequential, no conflict).
6. **WP12 tabbed system menu**: the NEW CYCLE row lives in the SYSTEM tabpanel (`#sys-panel-system`), label `FINALE_CHOICE.cycle.label`, shown only in phase `postgame`, evaluated in `open()` (menu is never open during the finale). `SystemMenuDeps += ending?: { phase(): EndingPhase; newCycle: NewCycleHook }` (optional so older callers compile).
7. **Focus**: overlay uses `trapFocus` from `src/ui/hotkeys.ts` at `choice` (buttons shown); during `sequence` focus stays on SKIP.
8. **Audio buses (WP12 T4)**: `chord` + flock chirps are one-shots -> `sfx` bus; wind off = ambient bus via existing setters.
9. **Reduced + boost**: `finaleFrame.boost` is NOT reduced-aware (C4 unchanged). T10 animator applies the WP12 `maxDegPerSec` cap AFTER `boostedValue`, so reduced motion never exceeds 180 deg/s and spark-gap flashes stay off.
10. **Waves**: audio moved from W2 to W3 (T7), `T6` split into T6a/T6b, so W2 stays at 4 workers.
11. Re-read each file RIGHT BEFORE editing; small unique-anchor Edits; never revert foreign hunks.

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP13: ending sequence (finale storyboard S0-S5), PRIMARY FUNCTION reveal, KEEP IT RUNNING postgame, restored-world layers.
Authoritative spec you MUST read first: docs/plan/WP13.md — sections "Contracts" C1-C5 and "D Decisions" are exact and binding.
Art contract: docs/plan/ART_ERA5.md §7 (finale), §8 (button/panel/icons), §10 (nameplate). All PNGs already exist; NEVER touch public/**.
THIS ASSIGNMENT FILE (docs/plan/WP13-assignments.md, section "EM decisions") WINS over WP13.md where they differ. Key deltas:
 - NO src/game/reducedMotion.ts. Reduced motion = WP12 settings: reduced = !motionPolicy(session.settings).flashes (src/simulation/settings.ts).
 - purchase() event order: purchase -> unlock -> milestone -> achievement -> ending (ending LAST).
 - pure isFinaleLocked(e: EndingState): boolean  (phase 'sequence' | 'choice') lives in src/simulation/progression/ending.ts.
 - xf label: src/ui/revealRules.ts  setRevealed(b), isRevealedLabel(), resourceShort(id)  (module flag, like setDefaultNotation).
No balance change; eras I-V behave EXACTLY as before (numbers, rates, events, pixels, strings). Save stays version 2.
Baseline: typecheck clean, all tests green (count recorded by the Director before W1; never lower it).

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, anything under public/. CSS only if a *.css is in your files_owned.
- CONCURRENCY: other workers edit other files at the same time, and uncommitted foreign work may exist. Re-read every file RIGHT BEFORE you edit it
  (and again before final validation). Keep edits SURGICAL (Edit tool, small unique anchors; never rewrite an existing file from memory). Never revert a foreign change.
- PURE (no 'phaser', no window/document/AudioContext/localStorage): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**,
  src/game/newCycle.ts, src/ui/*View.ts, src/ui/*Rules.ts, src/ui/*Model.ts, src/ui/menu/*View.ts, src/audio/audioMath.ts.
  Only src/game/{entities,rendering,scenes}, src/assets/fallbackTextures.ts may import Phaser. DOM files (src/ui/*.ts without View/Rules/Model suffix, hotkeys.ts) may use document/window, never Phaser.
- All balancing / tuning numbers, texts and ids live in src/data/. No 0x...... colour literals under src/game, src/ui, src/audio (use PALETTE / PALETTE_CSS).
  No tech-id string literals in src/audio or src/game logic (use data: hasEndingEffect, FINALE_BOOST.holdFrames keys, APERTURE data).
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`.
  No `!` non-null on possibly-undefined values in src (a `!` in tests after an asserted lookup is fine).
- DOM text ALWAYS via textContent (never innerHTML). Controls are real <button>; icon-only controls have accessible names; min font 12 px in CSS you write;
  every interactive element gets `:focus-visible { outline: 2px solid <palette css var>; outline-offset: 2px }`.
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM, no Phaser at runtime), `*.test.ts` next to the code, `toBeCloseTo(x, 9)` for floats,
  avoid -0. Never delete coverage: when a count/list changes update the assertion to the new value, keep the intent. Tests touching module state reset it in afterEach.
- `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list them in NOTES. Run only your own tests (plus the named regression runs).
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...
```

---

# WAVE 1 (parallel: T1, T2, T3, T4 — disjoint files)

## T1 — Ending state + session + save

**wave**: 1. **files_owned**: `src/data/types.ts` (add `EndingPhase`, `EndingState`, `GameState.ending` only), new `src/simulation/progression/ending.ts`, new `src/simulation/progression/ending.test.ts`, `src/simulation/{state,GameSession,events,index}.ts`, `src/simulation/GameSession.test.ts`, new `src/simulation/GameSession.ending.test.ts`, `src/persistence/{schema,persistence.test,saveController,saveController.test}.ts`, new `src/persistence/fixtures/v2-wp11-primary.json`, plus any other `*.test.ts` that fails `tsc` ONLY because `GameState` gained required `ending` (list them in NOTES).

**objective**: land C1 exactly + EM deltas 2 (`isFinaleLocked`) and 3 (event order). Save additive, no version bump.

**context**: WP13.md C1. `ending.ts` pure: `DEFAULT_ENDING`, `hasEndingEffect(def)`, `startEnding(state)`, `advanceEnding(state, to)`, `normalizeEnding(e, levels)`, `isRevealed(e)`, **`isFinaleLocked(e)`**. Illegal input returns the SAME object. `createInitialState` gets `ending: { ...DEFAULT_ENDING }`. `GameSession.purchase` (read it, WP12 version): after `this.checkAchievements()` add `const next = startEnding(this.current); if (next !== this.current) { this.setState(next); emit('ending', { phase: 'sequence' }) }`. New methods `finishEndingSequence(): boolean`, `keepRunning(): boolean` (setState -> revision bump -> emit `ending`; return false + no event when illegal). `reset()` -> `createInitialState` already gives DEFAULT (existing `reset` event only). `SessionEvents += ending: { phase: EndingPhase }`. `index.ts` exports the `ending.ts` API. `schema.ts` `readState`: `ending` optional; missing -> DEFAULT; present but not `{ phase: one of 4, engagedAt: finite number | null }` -> error (same "wrong type = error" rule as the other fields -> recovery path); then `normalizeEnding(ending, techLevels)`. `saveController`: also `saveNow` on `session.on('ending')` (see how `achievement` is wired). Do NOT touch `purchase.ts`, `sim/`, `rates.ts` (the `ending` effect marker stays rate-neutral).
Fixture `v2-wp11-primary.json`: a valid v2 envelope as the WP11 build would write it (no `state.ending`, `techLevels.primaryFunction: 1`; copy the shape from `serialize` output / an existing test envelope, include `stats` + `achievements`).
Tests: ending.test (phase machine table incl. same-object on illegal; normalize rules: sequence->choice, tech owned + none -> choice, tech not owned + phase != none -> DEFAULT; isRevealed / isFinaleLocked tables). `GameSession.ending.test.ts` (deterministic clock): buying the ending tech emits `purchase` -> `unlock` -> `achievement` -> `ending('sequence')` in that order, once; state.ending = `{ sequence, engagedAt: lastSimTime }`; `finishEndingSequence` / `keepRunning` legal-only (false and NO event otherwise), revision bumps; `reset` -> none, no `ending` event; rates identical before/after an `ending` change; purchase not repeatable. persistence tests: WP11-shape save without `ending` -> `loaded`, phase none; fixture with primaryFunction 1 -> `choice`; saved `sequence` -> `choice`; `postgame` round-trip lossless; bad `ending` (string, phase 'x', engagedAt NaN/string) -> recovered; v1 fixture still migrates; `SAVE_VERSION === 2`; saveController writes on `ending`.

**constraints**: pure; no `any`; eras I-V event order and numbers untouched; balance sim untouched.

**acceptance**: C1 exact; every row above tested; whole existing suite green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation src/persistence src/data
npx tsc --noEmit 2>&1 | grep -E "^src/(simulation|persistence|data/types)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b" src/simulation/progression/ending.ts && echo FAIL || echo OK
git diff --stat HEAD -- src/simulation/progression/purchase.ts src/simulation/sim public     # must be empty
grep -rn "SAVE_VERSION" src/data/balance.ts src/persistence/*.ts | head
```

## T2 — Finale data + palette + assets + layer rows

**wave**: 1. **files_owned**: new `src/data/finale.ts`, new `src/data/finale.test.ts`, `src/data/{palette,palette.test,world,world.test,story}.ts`, `src/assets/{assetIds,manifest,manifest.test}.ts`, `src/ui/hudView.test.ts` (ONLY the plaque assertion, if it breaks).

**objective**: C3 exact (data, types, `REVEALED`), palette +8, `ParallaxLayerDef.finale` + 3 new rows + 4 existing rows tagged, 15 asset ids. Write the `FinaleTrackId` + `FinaleBeat` types FIRST (T3 imports them).

**context**: WP13.md C3 verbatim (all numbers). `finale.ts` imports `PALETTE`, `DEPTH`, `MACHINE_ANCHOR`, `PIXEL_SCALE` as needed; `FINALE_TRACKS` as `{ startS, durS }` objects (the `[startS, durS]` shorthand in the doc is notation only); `RESTORED_GROUND.regrowth` = three `{ assetId }` rows `bg.regrowth1..3`. `world.ts` (**re-read first; the camera `fullView` fix edits are there, keep them**): `ParallaxLayerDef += finale?: { track: FinaleTrackId; dir: 'in' | 'out' }` (`import type` from `./finale`; if a runtime import cycle between `finale.ts` and `world.ts` appears, keep `finale.ts` importing only `palette`/literals and report; do NOT duplicate numbers). Tag `mountains` out/mountains, `skyline` out/skyline, `skyViolet` out/sky, `horizonGlow` out/glow; append `skyRestored`, `mountainsRestored`, `skylineRestored` per C3 (twin `bottomY`/`scrollFactor`; underfill green0 / grayDark). `palette.ts` +8 keys (`skyClear0..3`, `green0..3`) in PALETTE and PALETTE_CSS. `assetIds.ts` / `manifest.ts`: +15 per C3 (`bg.skyRestored, bg.mountainsRestored, bg.skylineRestored, bg.regrowth1..3, terrain.groundGreen, fx.beamWhite, fx.seed, fx.bird, ui.nameplate, ui.panel, ui.button, ui.icons16`), file paths per ART_ERA5 §11 (check real files with `ls public/assets/{finale,terrain,fx,ui}`), frame sizes/counts and origins as C3. `story.ts`: append plaque row `{ milestone: 'primaryFunction', text: REVEALED.plaque }`. If a test/loader needs a fallback painter per id (`src/assets/fallbackTextures.ts`, BootScene), report in NOTES; do not edit them.
Tests: finale.test: beats sorted by `atS` with `choice` last; `FINALE_TRACKS` windows inside [`FINALE_SHOTS.s3`, `FINALE_SHOTS.s4`]; reveal lines exact (4 + lastLine); holdFrames ids are real components (`MACHINE_COMPONENTS`) with a `frames` animation and frame < frames; asset ids typed; `FINALE_CAMERA` ordered, non-overlapping; shots ascending. palette.test: 8 new keys, unique values, counts updated. world.test: restored rows twin ruined rows (same `scrollFactor`, `bottomY`, art size from manifest); `finale` field on exactly the 4 old + 3 new rows; depth order `skyViolet < eclipse < horizonGlow < skyRestored < mountains < mountainsRestored`; no `finale` combined with `visibleWhen`. manifest.test: 15 ids, dims = files, frame x cells = sheet.

**constraints**: pure data; all text/numbers only here; no `0x` in new data except the palette file; existing rows' numbers unchanged.

**acceptance**: C3 exact; new asserts above; old suites green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/assets src/ui/hudView.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(data|assets)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser" src/data/finale.ts && echo FAIL || echo OK
git diff --stat HEAD -- public     # must be empty
```

## T3 — Pure finale maths + new-cycle hook + context

**wave**: 1. **files_owned**: new `src/game/math/finale.ts`, new `src/game/math/finale.test.ts`, new `src/game/newCycle.ts`, new `src/game/newCycle.test.ts`, `src/game/context.ts`, `src/game/bootstrap.ts` (the `ctx` literal ONLY).

**objective**: C4 (all functions) + C2 minus reducedMotion: `NewCycleHook`, `createNewCycleStub()`; `GameContext += newCycle: NewCycleHook`; `GameFeedback += finaleBeat: Signal<FinaleBeat>`.

**context**: WP13.md C4 line by line (signatures, semantics, numbers in comments) and C2. Types: `import type { EndingPhase } from '../../data/types'` (T1), `FINALE_*`, `FinaleTrackId`, `FinaleBeat` from `../../data/finale` (T2) — same wave, code against the contract. `finaleFrame({ phase, t, reduced, start })` per C4 (neutral for `none`; `choice` = values at `max(t, choiceStartS())` with camera `viewPose('full')`; `postgame` per C4). `bootstrap.ts` ctx literal: `feedback: { ..., finaleBeat: createSignal<FinaleBeat>() }` and `newCycle: createNewCycleStub()` (add imports). Stub `blockedReason()` returns `FINALE_CHOICE.cycleStubReason`; `begin()` no-op. **Do not create reducedMotion.ts.**
Tests (WP13.md T3 acceptance list): choiceStartS ~62.6 / finaleEndS ~64.47 (`toBeCloseTo(., 2)`), shotAt boundaries, cameraPoseAt (= start at 0, full at 2, crown at 13, full at 19, monotone zoom inside tweens, reduced jump at key.atS + fadeMs/2 with cutFade peak 1), whiteAlpha (0 before 15, .85 at 16.2, 0 after 19.3, reduced <= .5), trackValue windows, boost01 0/.5/1/1/0 at 2/5/8/49.3/53.3, boostedValue, beamHeadPx 0/450/504 at 13/13.5/>=13.56, eclipseAt (stage, 4, 4, 3, 2, 1, 0, hidden; reduced: no diamond), wipe reaches both world edges (+lag), wipeEdgeOffsetPx deterministic/in range/step 2, wipeRects count = ceil(h/bandPx) and clamped, wipeComplete, typewriter (30 cps, pauses, buttons after last line, reduced whole lines), beatsBetween no dup / no miss over steps 1..250 ms across the whole film + `'choice'` = `choiceStartS()`, flockSchedule ranges + determinism, birdPose leaves the left edge, finaleFrame for none/sequence/choice/postgame/reduced, newCycle stub text + no-op begin.

**constraints**: pure (no Phaser/DOM); deterministic hashes (no `Math.random`); every number from `src/data/finale.ts` / `world.ts`.

**acceptance**: C2 (minus reducedMotion) + C4 exact; tests above.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/finale.test.ts src/game/newCycle.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/game/(math/finale|newCycle|context|bootstrap)" && echo CHECK || echo OK     # T1/T2 type imports may fail until they land
grep -nE "from ['\"]phaser|\b(window|document)\b|Math\.random" src/game/math/finale.ts src/game/newCycle.ts && echo FAIL || echo OK
git diff -U0 HEAD -- src/game/bootstrap.ts | grep -E "^[-+][^-+]"      # ctx literal + imports only
test ! -e src/game/reducedMotion.ts && echo OK
```

## T4 — Smoke scripts

**wave**: 1. **files_owned**: new `scripts/smoke/finale.mjs`, `scripts/smoke/stages.mjs`, `scripts/smoke/README.md`.

**objective**: finale smoke + stage s16 keeps working (buying `primaryFunction` now starts the cinematic and locks input).

**context**: skeleton = `scripts/smoke/wp4-persistence.mjs` / `wp12-menus.mjs` (`PW_PATH`, url, outdir, `res`/`errors`, `ok()`; checks never assert, only `ok(...)`). Debug hook fields (T11; may not exist yet: optional-chain everything): `__wedtmd.finaleState()` -> `{ phase, t, shot, reduced, restored, meanMs, frame }` or null, `skipFinale()`, `finaleSeek(t)`, `displayObjects()`, `machineStats()`, `componentState(id).frame`. Keys printed `finale_*`. Steps = WP13.md Validation §Smoke (1)-(7), adapted: fast-forward to the stage before `primaryFunction` like `stages.mjs` (reuse its buy helper pattern), buy via `__wedtmd.session.purchase('primaryFunction')`; HUD hidden = `#ui-root.finale-active`; crank click leaves `totalClicks` unchanged; `modalCount() >= 1`; keyframe shots via `finaleSeek` at 1, 6, 12, 15.6, 24, 30.5, 34, 40, 56, end (log `frame` and `componentState('namePlate').frame`); natural playback 5 s from t 20 then reload -> phase `choice`, `text=KEEP IT RUNNING` visible, plate frame 5; Esc does nothing at choice; click KEEP -> `postgame`, HUD visible, overlay gone, crank works, localStorage `state.ending.phase` postgame; reload -> postgame, no overlay; system menu shows BEGIN A NEW CYCLE disabled + reason `Cycle 0043 is still calibrating.`; `t` key and Esc (menu) do nothing during `sequence`/`choice`; skip run (buy, wait 2 s, Esc -> `choice`); reduced run: `session.updateSettings({ reducedMotion: true })` BEFORE the buy, then `reduced` true, at 15.6 overlay alpha <= .5, at 24 wipe mode `fade`; reset from the menu in postgame -> wasteland (plate frame 4). `PERF=1`: sample `finaleState().meanMs`, `machineStats().meanMs`, `displayObjects()` at t 8-10, 22-36 and postgame (thresholds in WP13.md; report only). `stages.mjs`: `s16_primary` -> `s16_postgame`: buy everything, `skipFinale()` (optional chain), click KEEP IT RUNNING, wait 2.5 s, shot; keep `PARTS5` reporting; every other stage untouched. README: document `finale.mjs`, keys, env vars.

**constraints**: `.mjs` only; no `src/` edits; no throwing assertions.

**acceptance**: `node --check` clean for the two scripts; keys printed `finale_*`; s16 renamed with the postgame flow.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
for f in finale stages; do node --check scripts/smoke/$f.mjs || echo "SYNTAX FAIL $f"; done
grep -n "s16_" scripts/smoke/stages.mjs
git diff --stat HEAD -- src public     # must be empty
```

---

# WAVE 2 (parallel: T5, T6a, T6b, T8 — disjoint files; W1 merged + tsc clean)

## T5 — Finale overlay UI

**wave**: 2. **files_owned**: new `src/ui/finaleView.ts`, new `src/ui/finaleView.test.ts`, new `src/ui/finale.ts`, new `src/ui/finale.css` (imported by `finale.ts`).

**objective**: pure model + DOM overlay (nameplate, terminal panel, typed lines, SKIP, KEEP IT RUNNING / BEGIN A NEW CYCLE).

**context**: WP13.md T5 + C5 `createFinaleOverlay(root, deps: { modals; newCycle: NewCycleHook; closeDialogs(): void; onSkip(): void; onKeep(): void; onNewCycle(): void }) -> { render(model: FinaleOverlayModel | null): void; destroy(): void }`. Pure `buildFinaleOverlay(phase: EndingPhase, t: number, reduced: boolean, blockedReason: string | null): FinaleOverlayModel | null` in `finaleView.ts` (null for `none`/`postgame`): `{ skipVisible: boolean; nameplateAlpha: number; lines: { text; shown }[]; buttons: boolean; cycleEnabled: boolean; cycleReason: string | null }` built from `typewriter()` (`src/game/math/finale.ts`, T3) with `tSinceReveal = t - FINALE_REVEAL.startS`; phase `choice` -> everything fully shown, buttons true, skip false. DOM: nameplate `ui.nameplate` x3 top-left (`image-rendering: pixelated`), terminal panel <= `panelMaxWidthPx` with `ui.panel` 9-slice (`border-image ... 8 fill`, fallback `.hud-panel` colours via `PALETTE_CSS`), buttons `ui.button` frames + `ui.icons16` icon frames (`FINALE_CHOICE`), asset URLs via the existing `resolveAssetUrl`-style helper (find it; used by other ui/asset code). Min text 12 px. When a model is non-null: push `'finale'` on `deps.modals` with close fn = (sequence: `onSkip()`; choice: no-op, entry stays/re-pushed), call `closeDialogs()` once on first show, add `#ui-root.finale-active` (HUD + toasts fade over `FINALE_HUD.fadeMs` via CSS opacity transition, `pointer-events: none`), set `inert` on the HUD container element (find it in `hud.ts`: the element holding `#hud-panel` / `#hud-buttons`; select by id, tolerate null) — all undone on `render(null)` and `destroy()`. When `buttons` true: `trapFocus(overlay)` from `./hotkeys`, focus KEEP IT RUNNING, visible focus ring; the cycle button is `aria-disabled="true"` with `aria-description` + a visible reason line under it when blocked, click -> `onNewCycle()` only when enabled; completed lines mirrored to an `aria-live="polite"` node; SKIP is a real `<button>` (sequence only). Write text/alpha only when changed (cache last written). All listeners removed in `destroy()`.
Tests (pure only): `buildFinaleOverlay` null for none/postgame, skip only in sequence, nameplate alpha ramp, typed lines at sample times (30 cps), buttons only after the last line (always at choice), cycle disabled + reason from blockedReason, reduced = whole lines.

**constraints**: no Phaser; no innerHTML; no 0x; data from `src/data/finale.ts`.

**acceptance**: as above; model tested; `finale.ts` has only DOM wiring.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/finaleView.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/ui/finale" && echo CHECK || echo OK
grep -nE "innerHTML|from ['\"]phaser" src/ui/finale.ts src/ui/finaleView.ts && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/ui/finale.ts src/ui/finaleView.ts && echo FAIL || echo OK
grep -nE "font-size:\s*([0-9]|1[01])px" src/ui/finale.css && echo SMALL_FONT || echo OK
```

## T6a — Reveal labels (HUD / tree / toasts)

**wave**: 2. **files_owned**: new `src/ui/revealRules.ts`, new `src/ui/revealRules.test.ts`, `src/ui/{hudView,hudView.test,hud,techTreeView,techTreeView.test,techTree,notificationRules,notificationRules.test}.ts`.

**objective**: EM decision 4 exactly. Label `RF` replaces `???` for xf once `setRevealed(true)`; nothing changes while false.

**context**: `revealRules.ts`: `setRevealed(b: boolean): void`, `isRevealedLabel(): boolean`, `resourceShort(id: ResourceId): string` (`xf` + flag -> `REVEALED.xf.short` from `src/data/finale.ts`, else `RESOURCES[id].short`); module state initial false. Replace every `RESOURCES[..].short` in `hudView.ts` (`buildHudView` row label, `clickGainText`), `hud.ts` (row label made by `createRow(...)`: keep a ref to each resource row's label element and update its `textContent` on render only when the written label changes — extend the row `written` cache), `notificationRules.ts` (`welcomeBackMessage`), `techTreeView.ts` (all `.short` sites: tab label/resourceText, buy/insufficient texts, cost texts, aria label, header text). `techTree.ts`: when the flag flips the tree must re-render labels (the view builders re-run each update; the dedupe/signature cache around line 88 must include the label strings). Do NOT touch `status.ts` / `requirements.ts` / stats panel (stay `???`). Plaque is a data row (T2): just keep `hudView.test.ts` green.
Tests: revealRules (default, set/unset, non-xf ids unchanged); hudView row label `???` -> `RF` and `clickGainText` with an xf gain; welcome text; techTreeView tab/header/cost strings with flag set, reset in afterEach; existing assertions untouched.

**constraints**: no signature changes of existing exports; pure files stay pure; `hud.ts` / `techTree.ts` DOM only.

**acceptance**: flag false = identical strings (existing tests untouched and green); flag true = `RF` in all listed places.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/ui" && echo CHECK || echo OK
grep -nE "RESOURCES\[[^]]*\]\.short" src/ui/hudView.ts src/ui/hud.ts src/ui/notificationRules.ts src/ui/techTreeView.ts && echo LEFTOVER || echo OK
grep -n "innerHTML" src/ui/hud.ts src/ui/techTree.ts && echo FAIL || echo OK
```

## T6b — System menu NEW CYCLE row + bootstrap menu call

**wave**: 2. **files_owned**: `src/ui/{systemMenu,systemMenuModel,systemMenuModel.test}.ts`, `src/ui/systemMenu.css`, `src/data/systemMenu.ts`, `src/game/bootstrap.ts` (the `createSystemMenu(...)` call ONLY).

**objective**: EM decision 6.

**context**: pure model (tested) `newCycleRow(phase: EndingPhase, reason: string | null): { visible: boolean; enabled: boolean; label: string; reason: string }` — visible only for `postgame`; enabled when `reason === null`; label `FINALE_CHOICE.cycle.label` (`src/data/finale.ts`); reason passed through (`''` when null). `SystemMenuDeps += ending?: { phase(): EndingPhase; newCycle: NewCycleHook }` (optional). In `createSystemMenu`: one extra `<button id="sys-new-cycle" class="sys-btn">` in `#sys-panel-system` below RESET (hidden by default) + reason line `#sys-new-cycle-reason`, `aria-disabled` + `aria-description` when blocked; refreshed in `open()` only; click: enabled -> `deps.ending.newCycle.begin()` then `close()`; disabled -> nothing. Remove listener in `destroy()`. CSS: disabled look + reason (min 12 px, focus-visible). `bootstrap.ts` call: `ending: { phase: () => session.state.ending.phase, newCycle: ctx.newCycle }`. Nothing else in the menu changes (ids, two-step reset, tabs).
Tests: `newCycleRow` table (none/sequence/choice invisible; postgame + reason -> visible, disabled, reason; postgame + null -> enabled).

**constraints**: no new key listener; no Phaser; menu behaviour unchanged when `ending` omitted.

**acceptance**: row visible only in postgame; disabled with the stub reason; wp12-menus ids intact.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/systemMenuModel.test.ts src/ui/modalStack.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(ui/systemMenu|data/systemMenu|game/bootstrap)" && echo CHECK || echo OK
grep -n "sys-mute\|sys-save\|sys-reset\|sys-reset-cancel\|sys-feedback\|sys-close\|sys-title\|sys-new-cycle" src/ui/systemMenu.ts | head -20
git diff -U0 HEAD -- src/game/bootstrap.ts | grep -E "^[-+][^-+]"      # only the createSystemMenu deps line(s)
```

## T8 — World layers (restored sky/mountains/skyline/ground, eclipse, beam)

**wave**: 2. **files_owned**: `src/game/rendering/{ParallaxBackground,Eclipse,ApertureBeam}.ts`, new `src/game/rendering/RestoredGround.ts`.

**objective**: C5 render signatures for background, eclipse, beam, restored ground.

**context**: WP13.md T8 + C5: `ParallaxBackground.applyFinale(tracks)`, `RestoredGround(scene)` + `applyFinale(frame: FinaleFrame)` + `destroy()`, `Eclipse.applyFinale(e)`, `ApertureBeam.applyFinale(b)`. `ParallaxBackground`: the 3 restored rows are built like their twins (same pattern phase via `layerPhase`); alpha multiplier from `def.finale` (`in`: `v`, `out`: `1 - v`) combined with the `visibleWhen`/`alphaStages` fade; `v === 0` hides `in` layers; with no `applyFinale` call output is identical to today. `RestoredGround`: `terrain.groundGreen` twin of `Terrain` geometry (read `Terrain.ts`: same `layerPhase(1, 256, PIXEL_SCALE)` shift, same rect), depth `RESTORED_GROUND.groundDepth`; regrowth strips `bg.regrowth1..3` bottom at `GROUND_Y + RESTORED_GROUND.regrowthBottomOffsetPx`, depth `regrowthDepth`; Phaser `Graphics` geometry masks (one per layer) from `wipeRects(halfWidth, centerX, topY, heightPx, worldWidth, seed)` redrawn ONLY when `halfWidthPx[i]` changes; mode `hidden` = invisible, `wipe` = masked, `fade` = alpha only (reduced), `full` = unmasked + masks/graphics destroyed. `Eclipse.applyFinale`: `stage` = WP11 behaviour (WP12 reduced-motion gating kept), `frame` = fixed frame visible, `hidden` = invisible. `ApertureBeam.applyFinale`: white tile `fx.beamWhite` (alpha `FINALE_BEAM.alpha`, NORMAL blend) from the aperture mouth, height `min(504, whiteHeadPx)`, frame animation only when `animate`; violet beam hidden when `!violet`; no call = today. All objects destroyed in `destroy()`. No 0x literals, no tech ids.

**constraints**: re-read files (WP12 T11 edited Eclipse); default rendering unchanged; Phaser only in these files.

**acceptance**: signatures exact; masks only in `wipe`; everything destroyed.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/rendering/(ParallaxBackground|Eclipse|ApertureBeam|RestoredGround)" && echo CHECK || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/RestoredGround.ts && echo FAIL || echo OK
grep -n "applyFinale" src/game/rendering/*.ts
```

---

# WAVE 3 (parallel: T7, T9, T10, T11 — disjoint files; W2 merged, WP12 T11 + camera fix committed)

## T7 — Finale audio

**wave**: 3. **files_owned**: `src/data/audio.ts`, `src/audio/{gameAudio,synth,audioMath,audioMath.test}.ts`.

**objective**: D9 (+ EM decision 8).

**context**: data `AUDIO.resolveChord` (major triad + octave, slow attack, long decay), `AUDIO.chirp` (2-3 short FM-ish sine sweeps). `synth.ts`: `playResolveChord()` and `playChirps()` routed to the `sfx` bus. `audioMath.ts` pure helpers: chord frequency list from a root, chirp sweep list, `windAllowed(phase: EndingPhase): boolean` (false for `choice` / `postgame`; `sequence` is handled by the `windStop` beat via a local flag in `gameAudio`, cleared when phase returns to `none`). `gameAudio.ts`: subscribe `feedback.finaleBeat`: `swell` -> existing `playSwell`, `chord` -> `playResolveChord`, `flock` -> `playChirps`, `windStop` -> wind off; tick reads `session.state.ending.phase` for the wind rule (reload in choice/postgame has no wind); mute + WP12 volume buses respected; unsubscribe on dispose. No tech-id literals.
Tests (pure): chord ratios/frequencies, chirp list shape, `windAllowed` table.

**constraints**: no AudioContext before a gesture (existing lazy logic); errors never escape (existing `run` guard).

**acceptance**: as above; existing audio tests unchanged.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio
npx tsc --noEmit 2>&1 | grep -E "^src/(audio|data/audio)" && echo CHECK || echo OK
grep -nE "0x[0-9a-fA-F]{6}|from ['\"]phaser" src/audio/*.ts && echo FAIL || echo OK
grep -nE "'(nullChamber|finalAlignment|primaryFunction|skyAperture)'" src/audio/*.ts | grep -v test && echo FAIL_LITERAL || echo OK
```

## T9 — Finale FX

**wave**: 3. **files_owned**: `src/game/rendering/{DustField,SteamFx}.ts`, new `src/game/rendering/FinaleFx.ts`.

**objective**: C5: `DustField.applyFinale(mode)`, `SteamFx.fireBurst(emitterId, count)`, `FinaleFx`.

**context**: WP13.md T9 (acceptance text verbatim). `DustField` (read it: `setRising`, two emitters): `'normal'` restores today's behaviour instantly (rising logic untouched), `'reverse'` = both emitters stopped + a reverse emitter with `FINALE_DUST.speedY` runs `reverseS` then stops, `'stopped'` = nothing emits (act only on a mode CHANGE; per-frame compare is cheap). `SteamFx.fireBurst`: public wrapper over the existing milestone burst path (obeys the WP12 `flashes` policy exactly like milestone bursts). `FinaleFx(scene, onBeat)`: one screen-fixed rect (scrollFactor 0, depth above all world objects, below DOM) alpha/colour from `frame.overlay`; seed emitter (`fx.seed`, random frame 0..3, finale `frequencyMs`, postgame `frequencyMs * postgameRateDiv`, off when `seeds === 'off'`, spawn band `MACHINE_ANCHOR.x ± DUST.spawnHalfWidth`); bird flocks: `'finale'` = one flock at `FINALE_BIRDS.firstAtS` (`flockSchedule(0, seed)`), `'postgame'` = `flockSchedule` loop, sprites pooled (<= 6), pose from `birdPose`, `onBeat('flock')` per spawn, `'off'` hides + stops; `plateDust(world, count)` = dust-mote burst at a world point; `destroy()` frees all. No new fallback painters; textures from manifest ids; no 0x.

**constraints**: Phaser only in these files; default dust/steam behaviour unchanged when `applyFinale` is never called.

**acceptance**: signatures exact; pooled sprites; destroyed cleanly.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/rendering/(DustField|SteamFx|FinaleFx)" && echo CHECK || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/FinaleFx.ts && echo FAIL || echo OK
grep -n "applyFinale\|fireBurst\|plateDust" src/game/rendering/*.ts
```

## T10 — Machine animator + camera override

**wave**: 3. **files_owned**: `src/game/entities/{MachineAnimator,MachineView}.ts`, `src/game/rendering/CameraController.ts`.

**objective**: C5: `MachineView.applyFinale({ boost, restored })` -> `MachineAnimator.setFinale(...)`, `getComponentState(id).frame`, `CameraController.setOverride(pose | null)`.

**context**: re-read the three files (WP12 T11 + camera fix edited them; keep their hunks). WP13.md T10 acceptance: every speed/Hz = `boostedValue(actual, curve max, boost)` (spin, driven master, frames maxHz, orbit — find each driver's curve max in `data/machineComponents.ts` / `math/animation.ts`); parts keyed in `FINALE_BOOST.holdFrames` (use the data keys) show the given frame while `boost > 0`; stage parts use `stageFrameOf(met, frames, restored, endingFrame)` with the `restored` flag (animator passes `false` today, ~line 323); `boost 0` + `restored false` = today's behaviour exactly; WP12 `maxDegPerSec` cap applied AFTER `boostedValue` (EM decision 9). `MachineView.getComponentState` gains `frame: number` (current texture frame). `CameraController.setOverride(pose: CameraPose | null)` (`CameraPose` from `../math/finale`): non-null writes `centerX/centerY/zoom` (clamped to world, same clamp path as today), ignores drag/wheel/autoframe/refocus; `null` resumes from the current pose without a jump. No tech-id or 0x literals.

**constraints**: no change at default (boost 0, no override); no `WorldScene` edit.

**acceptance**: signatures exact; behaviour unchanged when unused.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/(entities|rendering/CameraController)" && echo CHECK || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/entities/MachineAnimator.ts src/game/entities/MachineView.ts src/game/rendering/CameraController.ts && echo FAIL || echo OK
grep -n "setFinale\|applyFinale\|setOverride\|frame:" src/game/entities/*.ts src/game/rendering/CameraController.ts | head
```

## T11 — Director + wiring

**wave**: 3. **files_owned**: new `src/game/rendering/FinaleDirector.ts`, `src/game/scenes/WorldScene.ts`, `src/game/debugHook.ts`, `src/game/bootstrap.ts` (overlay creation + deps + reveal flag + hotkey guards).

**objective**: C5 `FinaleDirector` + all wiring per WP13.md T11 and D1-D4, with EM decisions 1-4.

**context**: `FinaleDirector(scene, deps)`; `update(deltaMs)`, `skip()`, `seek(t)`, `getState()`, `destroy()`. Per frame compute `finaleFrame({ phase, t, reduced, start })` once; push to `background.applyFinale(frame.tracks)`, `restoredGround.applyFinale(frame)`, `eclipse.applyFinale(frame.eclipse)`, `beam.applyFinale(frame.beam)`, `dust.applyFinale(frame.dust)`, `fx.applyFinale(frame, deltaMs)`, `machine.applyFinale({ boost: frame.boost, restored: frame.restored })`, `camera.setOverride(frame.camera)`, overlay `render(buildFinaleOverlay(...))`. Clock: delta clamped to 250 ms; `seek` fires crossed beats (`beatsBetween`); `skip()` jumps to `finaleEndS()`, fires only `plate` + `chord`, calls `session.finishEndingSequence()`. Start on session `ending('sequence')` (t 0, camera start = current pose from the camera); boot per D1 (`choice` -> end state with overlay, `postgame` -> restored world, no overlay); at `choiceStartS()` call `finishEndingSequence()`; overlay `onKeep` -> `session.keepRunning()` (overlay null, `camera.setOverride(null)`); `onNewCycle` -> `ctx.newCycle.begin()` only when `blockedReason() === null`; `reset` event -> t 0 + neutral frame instantly (+ `setRevealed(false)`). `reduced` = `!motionPolicy(session.settings).flashes` read at sequence start. Beats: `calliope` -> `steamFx.fireBurst(FINALE_BOOST.calliope.emitter, count)`, `plate` -> `fx.plateDust(plateWorldPos, FINALE_PLATE.puffs)` (plate world position via `machine.getComponentWorldPosition(<name-plate component id>)`; take the id from data, report if none exists), every beat -> `ctx.feedback.finaleBeat.emit(beat)`. `getState().meanMs` = rolling mean of `update()` cost over 120 frames. `WorldScene`: create `RestoredGround` + `FinaleFx` + director AFTER machine + FX, update the director AFTER the other renderers each frame, dispose it FIRST; the existing `input.enabled` modal gate covers the crank. `bootstrap.ts`: `createFinaleOverlay(root, { modals, newCycle: ctx.newCycle, closeDialogs: () => { techTree.close(); systemMenu.close(); }, onSkip/onKeep/onNewCycle -> director via late-bound ref })`; overlay handle passed to `WorldScene` through its `ui` param; `setRevealed(isRevealed(session.state.ending))` at boot and on `ending` / `reset`; hotkey guards: `toggleTechTree` and `openMenu` callbacks return when `isFinaleLocked(session.state.ending)`. `debugHook.ts` (+ `Window.__wedtmd` typing): `finaleState()`, `skipFinale()`, `finaleSeek(t)`, `displayObjects()` (scene `children.list.length`), read-only/safe to ship.

**constraints**: director owns no economy state (reads session; mutates only via `finishEndingSequence` / `keepRunning`); no tech-id literals; no 0x; 0 console errors.

**acceptance**: WP13.md T11 acceptance list; game plays as WP12 until `primaryFunction` is bought; `npm run build` green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game" && echo CHECK || echo OK     # applyFinale/setOverride/setFinale/fireBurst errors OK until T9/T10 land; re-run at the end
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/FinaleDirector.ts src/game/scenes/WorldScene.ts src/game/bootstrap.ts src/game/debugHook.ts && echo FAIL || echo OK
grep -n "finaleState\|skipFinale\|finaleSeek\|displayObjects" src/game/debugHook.ts
grep -n "isFinaleLocked\|setRevealed" src/game/bootstrap.ts
```

---

# WAVE 4 — EM Mode B checklist
`npm run typecheck` · `npm test` (>= baseline + new) · `npm run build` (app chunk <= 200 KB; assets <= 8 MB) · `grep -rn "from 'phaser'" src/{simulation,data,persistence,utils,game/math} src/game/newCycle.ts src/ui/*View.ts` empty · `grep -rnE "0x[0-9a-fA-F]{6}" src/game src/ui src/audio --include=*.ts | grep -v test` empty · `npx vitest run src/simulation/balance.sim.test.ts` unchanged · `git diff --stat HEAD -- src/simulation/progression/purchase.ts src/simulation/sim public` empty · `grep -rn innerHTML src/ui` empty · no file outside owner lists changed · `src/game/reducedMotion.ts` absent.
Director smokes (after build + `vite preview`): wp2-crank, wp3-techtree, wp4-persistence, wp12-menus, full-machine, stages s0-s15 + `s16_postgame`, then `finale.mjs` (PERF=1) -> 0 errors; thresholds in WP13.md Validation. Art Director keyframe audit vs `finale_k1..k6`. Docs (Director): PROJECT_STATUS, ASSET_GUIDE (15 ids).
