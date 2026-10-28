# WP27 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP27.md` (authoritative, Revision 1 + "Director answers") + Director dispatch (2026-10-27) + code at `25b7c8b` (v0.10.1 + the plan).
Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/playtest-wp27`. The main tree is read-only reference. Nobody commits; nobody stages `package-lock.json`; workers never bump versions or edit `PROJECT_STATUS`, `STEAM_RELEASE`, `CHANGELOG`.
Baseline: vitest 5496 pass; app JS 493.9 KB (demo 494.5) of 500; lazy world 205.3 of 210; css 41.0 / 43.8 of 45; `check_gates.py` 91 files 0 failures.
`<S>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad`, `<O>` = `<S>/WP27`, `PW` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`. EOL helper: `<O>/tools/eol.mjs` (modes `check|crlf|lf`).
Ports: :4174 (dist) and :4177 (dist-demo) only, started and killed by the gate / AD2, never by workers (the two AD tasks of waves 1-2 may start :4174 on the EXISTING v0.10.1 `dist/` to photograph backdrops and must kill it). Never touch :4173 :4175 :4176 :4178. The user is on the PC: workers `vitest --maxWorkers=1` on their own files; the gate `--maxWorkers=2` (1 if the Director says the PC is busy); one Playwright browser at a time.

## Director decisions that win over the plan
Q1-Q7 yes as the plan defaults (rested click reading, relative step, prestige values, Overdrive 6 s, toast = unlock line). Q5 pre-authorised: app chunk 500-510 KB -> the EM sets `scripts/smoke/perf-budget.json` `bundle.appRawKb` 510 plus its `_notes.appRawKb` sentence and goes on; above 510 KB is a fail. Version 0.11.0, CHANGELOG, PROJECT_STATUS and the STEAM_RELEASE re-check are the Director's at close. T16 docs = GAME_SPEC, STORY_BIBLE, README "Balance". In-game text English; caveman reports.

## EM decisions / deviations (these WIN for workers)
1. **Waves <= 3 units** (an AD task is one unit): 8 pre-gate waves, the gate, AD2, then the close wave. Splits against the plan: T1 -> **T1a** (source) + **T1b** (tests, wave 7); T8 -> **T8a** (data, runner maths, tests) + **T8b** (renderers); T9 -> **T9a** (pure maths) + **T9b** (renderer, WorldScene, debug hook); T11 -> **T11a** (new `clickCurve.sim`), **T11b** (balance, signoff, prestige sims), **T11c** (passiveFirst, demoCap); T14 -> **T14a** (`faults.mjs`) + **T14b** (economy, world, store-shots, README); T16 -> **T16a** (GAME_SPEC) + **T16b** (STORY_BIBLE, README); AD1 -> **ADa** (crow art, s8w geometry, Sensor 7 audit; wave 1) + **ADb** (fault sheet, anchors; wave 2, because both touch `manifest.ts` / `assetIds.ts` / `ART_AUDIT.md`).
2. **T13 is last** (wave 8) and depends on every code task. T13 is the only worker that runs the whole suite (`--maxWorkers=1`, once, then per file).
3. **describeEffect number format.** The existing `fmt` rounds to 2 decimals, which prints `+0.04s/s refill` for 0.0375 and `+0s/s` for the Flywheel's 0.0015. T1a adds a local `fmtFine` (4 decimals, trailing zeros trimmed) for the `windup` effect ONLY. Descriptions and effects stay equal (A4 guard).
4. **Crank gain block gets a 6th line.** `FLOATING_TEXT.maxLines` 5 -> 6 (T10, `src/data/world.ts` + `world.test.ts`: the pool pin becomes `blockPoolSize * maxLines <= 36`; `blockPoolSize` stays 6). Reason: RELEASE line + five energies; A10 wants the ME line kept.
5. **Fault clear popup never becomes the crank merge target.** `FloatingText.showBlock` gets an optional 5th parameter `track = true`; FaultMarker passes `false` (T9b owns `FloatingText.ts`).
6. **Extra pure helpers in `faultMarker.ts`** (T9a): `faultTagFrame`, `faultFxFrame` (number returns, no per-frame allocation), `barWidthPx`, `fadeAlpha`. `faultFrames` stays for tests.
7. **Extra debug fields.** FaultMarker `stats()` adds `eligible`. `faultStats()` adds `client` (marker centre in client px) and `anchorClient` (anchor part centre in client px), both `null` when no marker. Smokes click `client`.
8. **Audio stats.** `GameAudioStats` gains `faultSpawnCues` and `faultClearCues` (cues started since unlock; muted = no count).
9. **Test ownership beyond the plan.** T3 also owns `src/simulation/production/tick.test.ts`. T6 also owns the five existing `src/simulation/GameSession*.test.ts` (value re-pins only, each listed old -> new). T9b takes `src/data/faults.ts` and its test from T4 (wave 5) to apply ADb's anchor hand-off. T10 owns `src/data/world.ts` (maxLines only) and `src/data/world.test.ts` (that pin only).
10. **Hand-off blocks** (machine-readable, appended to `docs/plan/ART_AUDIT.md` under `## WP27`): `WP27-HANDOFF-BEGIN/END` (ADa -> T5, T8a, T8b) and `WP27-FAULT-HANDOFF-BEGIN/END` (ADb -> T9b). Formats below.
11. **T4 uses the plan's anchors**; ADb confirms or edits them; T9b applies any change (data + test).
12. **machineTiers.sim and achievements.sim are not edited and run without the `faults` option** (the plan's tier / bigNumber numbers were measured with faults on A / B). If either fails at the gate the EM reports it to the Director (plan conflict) and does not edit them.
13. **P11 / budgets** are handled by the EM at the gate (not by workers).
14. **New files are CRLF** (EOL helper). `scripts/smoke/README.md` is LF.
15. **Browser runners one at a time**; no worker starts a browser, except the two AD tasks of waves 1-2 for stills of the existing dist.

## Waves
| wave | units | depends |
|---|---|---|
| W1 | **T1a** data source, **T2** key `F` + command, **ADa** (Opus) crow frames + s8w geometry | - |
| W2 | **T3** crank echo + wind-up module, **T4** faults pure module + data, **ADb** (Opus) fault sheet + anchors | T3, T4: T1a |
| W3 | **T5** Sensor 7 + era II cast, **T6** session + events, **T7** greedy harness | T5: ADa. T6, T7: T3, T4 |
| W4 | **T9a** fault marker maths, **T10** HUD row + click popups, **T12** fault audio + hum | T9a: T4. T10, T12: T6 |
| W5 | **T8a** crow data + runner + tests, **T9b** FaultMarker + WorldScene + debug hook, **T11a** `clickCurve.sim` | T8a: ADa, T5. T9b: T2, T4, T6, T9a, T10, ADb. T11a: T1a, T3, T6, T7 |
| W6 | **T8b** crow + Sensor renderers, **T11b** sims A, **T11c** sims B | T8b: T8a. T11b/c: T1a, T3, T6, T7 |
| W7 | **T1b** data tests, **T14a** `faults.mjs`, **T14b** other smokes + README | T1b: T1a. T14a/b: T5, T9b, T10 (T14a also T12) |
| W8 | **T13** unit re-pins (whole suite once) | T1a-T12 |
| Gate G | EM Mode B + Opus implementation-reviewer (below) | W8 |
| W9 | **AD2** (Opus) in-game audit | Gate G builds |
| W10 | **T15** AD-listed fixes (template, conditional), **T16a** GAME_SPEC, **T16b** STORY_BIBLE + README | AD2 |
| Close | Director: 0.11.0 bump, CHANGELOG, PROJECT_STATUS, ROADMAP rows, STEAM_RELEASE section 15, commit | |

Allowed transient tsc errors: none expected in any wave (each task compiles against tasks of EARLIER waves). A worker that sees a sibling's half-written file re-runs typecheck at the end.

## File ownership (exclusive per wave; paths relative to `C:/Users/sanan/wedtmd-shell/`)
| Task | Files |
|---|---|
| T1a | `src/data/types.ts`, `src/data/technologies.ts`, `src/data/notifications.ts`, `src/data/prestige.ts`, `src/simulation/progression/status.ts` |
| T2 | `src/data/settings.ts`, `src/ui/hotkeyRules.ts`, `src/ui/hotkeyRules.test.ts`, `src/ui/hotkeys.ts`, `src/game/context.ts`, `src/game/bootstrap.ts` (signal + hotkey wiring), `src/ui/menu/settingsView.ts`, `src/ui/menu/settingsView.test.ts` |
| ADa | `public/assets/world/crow.png`, `scripts/art/world/masters/crow/crow.txt`, `scripts/art/world/sheets.py`, `src/assets/manifest.ts` (row `world.crow`), `src/assets/manifest.test.ts` + `worldSheets.test.ts` + `assetGuide.test.ts` (crow pins only), `src/data/livingWorld.ts` (`WORLD_FRAMES.crow` only), `docs/ASSET_GUIDE.md` (generated block), `docs/plan/DENIZEN_ART.md`, `docs/plan/ART_AUDIT.md` (`## WP27`, ADa part), `<O>/ada/**` |
| T3 | `src/simulation/production/rates.ts`, `rates.test.ts`, `tick.test.ts`, `windup.ts` (new), `windup.test.ts` (new) |
| T4 | `src/simulation/faults.ts`, `faults.test.ts` (new), `src/data/faults.ts`, `src/data/faults.test.ts` (new) |
| ADb | `public/assets/fx/fault.png` (new), `src/assets/assetIds.ts`, `src/assets/manifest.ts` (row `fx.fault`), `manifest.test.ts` + `assetGuide.test.ts` (pins for the new id), `docs/ASSET_GUIDE.md` (generated block), `docs/plan/ART_AUDIT.md` (ADb part), `<O>/adb/**` |
| T5 | `src/data/livingWorld.ts` (placements, poses, girl), `src/data/worldBehaviour.ts` (`WORLD_SPOTS` only), `src/data/livingWorld.test.ts`, `src/game/math/worldPlacement.test.ts`, `scripts/smoke/stages.mjs`, `perf.mjs`, `world.mjs` |
| T6 | `src/simulation/GameSession.ts`, `events.ts`, `index.ts`, `GameSession.faults.test.ts` (new), the five existing `GameSession*.test.ts` (re-pins only) |
| T7 | `src/simulation/sim/greedy.ts`, `greedy.test.ts` |
| T9a | `src/game/math/faultMarker.ts`, `faultMarker.test.ts` (new) |
| T10 | `src/data/hud.ts`, `src/ui/hudView.ts`, `hudView.test.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/game/entities/HandCrank.ts`, `src/data/world.ts` (maxLines), `src/data/world.test.ts` (that pin) |
| T12 | `src/data/audio.ts`, `src/audio/synth.ts`, `gameAudio.ts`, `audioMath.ts` (only if needed), `audioMath.test.ts`, `gameAudio.test.ts`, `src/data/music.test.ts` (only if the cue data breaks it) |
| T8a | `src/data/worldBehaviour.ts` (crow tables, `glitch`), `src/game/math/worldBehaviour.ts`, `worldBehaviour.test.ts`, `worldBehaviourMetrics.test.ts`, `src/data/worldBehaviour.test.ts`, `src/data/worldEras.ts`, `worldEras.test.ts` (only if it pins the key list) |
| T9b | `src/game/rendering/FaultMarker.ts` (new), `FloatingText.ts`, `src/game/scenes/WorldScene.ts`, `src/game/debugHook.ts`, `src/data/faults.ts`, `src/data/faults.test.ts` |
| T11a | `src/simulation/clickCurve.sim.test.ts` (new) |
| T8b | `src/game/rendering/LivingWorld.ts`, `CastExtras.ts`, `LivingWorldDirector.ts` (crow branch only) |
| T11b | `src/simulation/balance.sim.test.ts`, `signoff.sim.test.ts`, `prestige.sim.test.ts` |
| T11c | `src/simulation/passiveFirst.sim.test.ts`, `demoCap.sim.test.ts` |
| T1b | `src/data/technologies.test.ts`, `src/data/prestige.test.ts`, `src/simulation/progression/progression.test.ts` (describeEffect cases only) |
| T14a | `scripts/smoke/faults.mjs` (new) |
| T14b | `scripts/smoke/economy.mjs`, `world.mjs` (crowTalk cases only), `store-shots.mjs`, `README.md` |
| T13 | any test file that fails after W7 and no other task owns (see its prompt), plus comment-only lines in `src/ui/cycleConfirmView.ts`, `src/ui/menu/memoryView.ts`, `src/ui/notificationRules.ts` |
| AD2 | `docs/plan/ART_AUDIT.md` (`## WP27`, AD2 part), `<O>/ad2/**` |
| T15 | only the files in the AD2 fix list |
| T16a | `docs/GAME_SPEC.md` |
| T16b | `docs/plan/STORY_BIBLE.md`, `README.md` ("Balance") |

## Cross-task contracts (additions to the plan's C1-C13; the plan's text stays canonical)
```ts
// describeEffect strings (T1a; numbers through fmt, windup through fmtFine = String(Number(x.toFixed(4))))
// crankEcho: 'Clicks echo {s}s of all output'           windup: '+{s}s wind-up, +{r}s/s refill'
// faultUnlock: 'Faults appear; clearing one pays {s}s of all output'   faultSeconds: 'Cleared faults pay +{s}s'
// faultRate: 'Fault interval ×{f}'   faultWindow: 'Faults last +{s}s'   overdrive: 'Cleared faults: ×{f} output for {s}s'
// src/game/math/faultMarker.ts (T9a), on top of C9
export function faultTagFrame(nowMs: number, reducedMotion: boolean): number;
export function faultFxFrame(nowMs: number, era: EraNumber, reducedMotion: boolean): number;
export function barWidthPx(age: number, window: number, fullPx: number): number;   // round(fullPx * (1 - age / window)), clamped 0..fullPx; window <= 0 gives 0
export function fadeAlpha(sinceMs: number, fadeMs: number): number;                 // 1 - sinceMs / fadeMs clamped 0..1; fadeMs <= 0 gives 0
// FloatingText (T9b): showBlock(worldPos, lines, fontPx, merged, track = true)   // track false: the block never becomes the merge target
// FaultMarker.stats() (T9b): { visible, interactive, eligible, anchor, code, x, y, age, window, shown, cleared, missed, meanMs }
// debugHook faultStats() (T9b): C11 fields + client: { x: number; y: number } | null, anchorClient: { x: number; y: number } | null
// GameAudioStats (T12): + faultSpawnCues: number; faultClearCues: number
// buildHudView(state, rates, prestige?, techs?, crank?: { stored: number; cap: number; overdriveLeft: number; overdriveFactor: number })   (T10; optional, backwards compatible)
// HudView.windup: { text: string; title: string } | null      releaseLine(seconds: number): GainLine | null  (res 'me', null below 0.05 s)
```
`WP27-HANDOFF` block (ADa writes it; T5, T8a, T8b read it; integers are world px):
```
WP27-HANDOFF-BEGIN
S8W_SENSOR7 = <int>
S8W_INSPECTOR = <int>
S8W_GIRL_GROUND = <int | none>        none = the documented fallback (b): no s8w girl
S8W_MINI_OVERLAP_PX = <0..2>          measured overlap of the mini and the Inspector body at cx 2112 (0 = clean)
S10_SENSOR7 = <int | exempt>   S10_INSPECTOR = <int>
S11_SENSOR7 = <int | exempt>   S11_INSPECTOR = <int>   S11_ROUTE = <lo,hi | none>
CROW_FRAMES = perchTurn:12 perchHead:13 perchTalk:14
WP27-HANDOFF-END
```
`WP27-FAULT-HANDOFF` block (ADb writes it; T9b reads it):
```
WP27-FAULT-HANDOFF-BEGIN
ANCHORS_1 = <id> <id>   ...   ANCHORS_5 = <id> <id>
FALLBACK_ANCHOR = <id>
ART_TAG = 0 1       ART_FX_1 = 2 3 ... ART_FX_5 = 8 9     ART_CLEAR = 10     FRAME_MS = 340
OFFSET_ART_PX = <x> <y>
WP27-FAULT-HANDOFF-END
```

## Task summaries (the verbatim self-contained prompts are in the workflow output)
- **T1a (W1).** C1 types; the F2hi data diff; 5 new techs (`faultLamp` (5,2), `dischargeLever` (5,0), `leakWhistle` (4,2) after Bellows Drive, `dampingFork` (5,0), `overrunClutch` (5,0)); texts; install lines; P7 prestige values; `describeEffect`. Source only.
- **T2 (W1).** `F` key: `HOTKEYS.fault`, `resolveHotkey` action `fault`, `bindHotkeys` dep `clearFault`, `commands.clearFault`, SETTINGS labels, keys help order crank / tech index / fault / menu / fullscreen.
- **ADa (W1, Opus).** Crow columns 12-14 (`perchTurn`, `perchHead`, `perchTalk`) in six rows, `crow.png` 360 x 108; s8w geometry and the era I-II Sensor 7 audit; the hand-off block.
- **T3 (W2).** C2 crank echo in `computeRates`; C3 `windup.ts`; D2 property over 200 seeded cases.
- **T4 (W2).** C4 `faults.ts` (h27 parity), `FAULTS` / `FAULT_TEXT` data and tests.
- **ADb (W2, Opus).** `fx.fault` sheet (12 frames), manifest / assetIds / guide registration, anchors per era, the fault hand-off block.
- **T5 (W3).** F6: s8 / s8w / s10 / s11 Sensor 7 placements, `s8w` pose, girl moves, `WORLD_SPOTS`, tests, smoke commit step.
- **T6 (W3).** C5 / C6 session: wind-up, faults, Overdrive, events, `stepFaults` clamp, `faultSeed`, debug force.
- **T7 (W3).** C7 greedy: `faults`, wind-up release, samples, income split, parity with `h27`.
- **T9a (W4).** C9 pure maths + the EM additions.
- **T10 (W4).** C8 HUD row, `releaseLine`, RELEASE line in the crank block, `maxLines` 6.
- **T12 (W4).** Fault cues, hum refit (`maxPerSecond` 1000000), audio stats counters.
- **T8a (W5).** D5 data (CROW_I / CROW_II, `glitch`), F5.1b runner rules, `crowPerchPoseToEra`, tests incl. the crank-burst / first-pick cases, metrics re-pin.
- **T9b (W5).** FaultMarker renderer (app chunk), `FloatingText` track flag, 4 WorldScene hunks, C11 debug hook, ADb anchors.
- **T11a (W5).** `clickCurve.sim.test.ts` K1-K13.
- **T8b (W6).** Crow lift / bob / glitch pose / perch bubble poses, drip from era III, demoHold crow branch removed.
- **T11b / T11c (W6).** Fault options on the A / B / C / N / R15 / D literals; re-targets of the plan's table; EXACT era I re-pin.
- **T1b (W7).** Tests of the T1a files.
- **T14a (W7).** `faults.mjs` (C13 cases A-O). **T14b (W7).** `F_hud_fit` WIND-UP row, `crowTalk` cases, store-shots `_no_fault`, README section.
- **T13 (W8).** Whole-suite re-pins.
- **AD2 (W9, Opus).** A11, A12, A13, A17 in game; fix list `F<n>`.
- **T15 (W10, conditional).** AD2 fixes. **T16a / T16b (W10).** GAME_SPEC 18.6; STORY_BIBLE 3.3 / 5 + README Balance.

## Gates (commands are exact; `cd "C:/Users/sanan/wedtmd-shell"` first; outputs under `<O>/val/`)
- **After every wave:** `npm run typecheck` clean; the wave's own test files (`--maxWorkers=1`); `git status --porcelain` lists only owned files.
- **Gate A (after W3).** Vitest of the T3, T4, T6, T7 files. Parity probe: the EM bundles a small driver under `<O>/gateA/` (esbuild, like `<O>/eco/h27.ts`) that runs the repo `runGreedy` profile A with `faults { catchProb 1, reactionSeconds 2 }` on the new data and prints `firstAt` for the era gates, `faults.spawned / caught / firstSpawnAt` and the `faultLamp` buy time; compare with `<O>/plan/r1/out/F2hiB.md` (blueprint 22:14, substation 60:50, vessel 110:29, convergence 167:36, PF 249:45; Fault Lamp buy at 421 s, first spawn 549 s, 119 / 119). A gate off by more than 1 % or a clock mismatch goes back to T3 / T4 / T6 / T7 BEFORE W4.
- **Gate B (after W6).** `npx vitest run src/simulation/clickCurve.sim.test.ts src/simulation/balance.sim.test.ts src/simulation/passiveFirst.sim.test.ts src/simulation/demoCap.sim.test.ts src/simulation/signoff.sim.test.ts src/simulation/prestige.sim.test.ts src/simulation/machineTiers.sim.test.ts src/simulation/achievements.sim.test.ts src/simulation/worldLogs.sim.test.ts --maxWorkers=2`. Printed tables vs `<O>/plan/out/F2hi.md` within 1 % on gates. A failure the plan does not explain, or the C PF margin (350:00 of 360), goes to the Director (Risk 1 levers are Director calls).
- **Gate G (after W8; quiet PC).** The plan's Validation list, steps 1-14, in order: typecheck; `npx vitest run --maxWorkers=2` (0 failed; report files / tests vs 5496); the sim list above; phaser-import grep (`src/simulation src/data src/persistence src/utils src/game/math/faultMarker.ts` empty); `git diff --stat 25b7c8b -- src/persistence src/simulation/machineTiers.sim.test.ts src/simulation/achievements.sim.test.ts` shows only `src/persistence/*.test.ts`; `npm run build && node scripts/perf/bundle-budget.mjs`, `npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo` (app 500-510 KB: the EM raises `bundle.appRawKb` to 510 + `_notes` sentence and goes on; above 510 fail; lazy <= 210; css growth <= 0.2 KB); `python -I scripts/art/tiers/check_gates.py`, `python -I scripts/art/world/check_sheet.py crow`; previews :4174 (dist) and :4177 (dist-demo), restarted after every rebuild; `faults.mjs` full and demo; `economy.mjs`, `world.mjs` (alone, quiet PC: `G_cost` <= 0.3 ms, `G_display` <= 100), `stages.mjs` ONLY s0,s7,s9,s11,s15, `tiers.mjs`, `resolutions.mjs`, `a11y.mjs`, `ux.mjs`, `demo.mjs`, `prestige.mjs`, `e2e-full.mjs`, `finale.mjs`, `showcase.mjs`, `perf.mjs`; `store-shots.mjs` with `SIZES=1080`; the diag re-run `<O>/diag/diag2.mjs`; kill previews (netstat empty). The Opus implementation-reviewer reads `git diff 25b7c8b` (focus: C2 formula, F2hi data line by line, h27 parity of the clock, no per-frame allocation in FaultMarker, no save change, ownership).
- Failures go back to the owner as fix assignments; an unowned failure goes to a fresh T13-style fix worker.

## Risks (EM)
1. Thin margins (plan Risk 1): C PF 350:00 of 360, min ME share 76.5 % of 75, era III active share 38 % of 35. Levers are Director calls (Residual Charge 5 %, Fault Lamp payout 17 s).
2. Haiku on session and greedy (T6, T7): contracts are exact and the h27 order is pinned; Gate A is the check.
3. T13 blast radius: 64 test files touch TECHNOLOGIES. Mitigated by owner re-pins (T1b, T3, T6, T10, T11) and the STOP rule for unexplained failures.
4. Crow renderer (T8b) has no unit tests (Phaser files): checked by typecheck, the lazy-chunk budget, `world.mjs` and AD2.
5. machineTiers.sim / achievements.sim run without faults (decision 12): a miss is a plan conflict for the Director.
6. FaultMarker clutter with the crank block, output popups, bubbles, HUD: AD2 tunes data (`FAULTS.layout`, anchors).
7. App budget: +10 KB estimate; the P11 note is set by the EM at the gate when needed.
