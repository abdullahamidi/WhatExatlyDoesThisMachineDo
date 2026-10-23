# WP15R assignments: WP15 close-out (energy-continuity audio, GPU perf re-measure, formal close)

Mode A decomposition. Repo `C:/Users/sanan/wedtmd-shell`, branch `claude/steam-shell`, baseline 3ddc969 (typecheck clean, 95 files / 2820 tests, build OK, bundle PASS).
Haiku workers get the common preamble plus their own prompt only. Director spawns them exactly as below.

## Waves and ownership (exclusive per wave)

| wave | task | files owned | depends |
|---|---|---|---|
| 1 | T1 audio data refit + cue table + pure `ambientMix` | `src/data/audio.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts` | - |
| 1 | T2 music themes by simulation era | `src/data/music.ts`, `src/data/music.test.ts`, `src/audio/musicMath.ts`, `src/audio/musicMath.test.ts` | - |
| 1 | T4A perf.mjs part 1 (debug URL, GPU/headed, era stages, renderer, frame+audio fields, gate) | `scripts/smoke/perf.mjs` | - |
| 1 | T5 budgets, bundle gzip report-only, `perf-median.mjs` | `scripts/smoke/perf-budget.json`, `scripts/perf/bundle-budget.mjs`, `scripts/perf/perf-median.mjs` (new) | - |
| 2 | T3 gameAudio wiring + `gameAudio.test.ts` + hook type | `src/audio/gameAudio.ts`, `src/audio/gameAudio.test.ts` (new), `src/game/debugHook.ts` (<= 3 lines) | T1, T2 |
| 2 | T4B perf.mjs part 2 (post windows, CPU profile, audioWiring) | `scripts/smoke/perf.mjs` | T4A |
| 2 | T5B README perf section | `scripts/smoke/README.md` | T5 (key names fixed here) |
| 2 | T6A `perf-tables.mjs` (median.json -> markdown tables) | `scripts/perf/perf-tables.mjs` (new) | T5 |
| - | Reviewer (Opus) over combined W1+W2 diff; Director runs `npm run typecheck`, `npm test` | | W2 |
| 3 | T6B GPU re-measure, median of 3, profiles, smokes, Director notes | outputs under `$OUT` only (builds `dist/`) | W2 + review |
| 4 | T6C WP15.md close-out section | `docs/plan/WP15.md` | T6B |
| - | EM Mode B | | W4 |

Split vs the plan: T4 -> T4A + T4B (perf.mjs rewrite is > 300 lines of logic; same file, sequential waves). T5 README -> T5B (W2, keeps W1 at 4). T6 -> T6A tables script (reusable, lives in `scripts/perf/**` which is allowed) + T6B measure + T6C doc.

## Transient tsc errors allowed
- After W1: only `src/audio/gameAudio.ts` (still imports removed `currentEra`). While T1/T2 are mid-flight: `src/audio/audioMath.ts` (reads `MUSIC.keystones`) and `src/audio/musicMath.ts`.
- After W2: none. `npm run typecheck` must be clean.

## Judgment calls made vs the plan text (Director: veto if wrong)
1. `ambientMix.owned(id)` = finite and >= 1 (NaN / Infinity not owned), same as the simulation era rule (plan wrote `>= 1`; D3 says NaN/Infinity count as not owned, so the beds must agree with the era).
2. `buyFn` clock starts at `Math.max(Date.now(), session.state.lastSimTime)` (identical on the first call; makes a second `buyFn` call, e.g. the `@blueprint` prep or finale `primaryFunction`, actually move time forward).
3. `postWindow` uses the same clock rule for its affordability jumps.
4. `perf-median` extras (additive): `frameP50Ms`, `machineMaxMsRaw`, `uiMaxMsRaw`, `post.*.okAll`, an `audioWiring` array of the inputs, 2-decimal rounding, non-gate `fail` entries carried from inputs (`audioEra`, `audioTheme`, `audioWiring`, `gpu`, `errors`).
5. PERF_PROFILE also profiles idle window #3 (`<stage>-idle.cpuprofile`, `rec.idleTop`), `top` excludes `(idle)`. Post tops live at `post.repeat.top` / `post.keystone.top` (+ `profileFile`).
6. The production build is minified, so profile `fn` names are mangled; T6B resolves hot spots by printing the source around `url:line:col` of `dist/assets/*.js`.
7. Frame p95 near 16.7 ms is vsync quantisation. A breach below 1 ms goes to the Director as evidence; budgets are not changed by workers.

## Task summaries (full prompts are in the waves payload)

### T1 (W1)
C1 numbers exact (hum.max 40000, mains.min .025 / max 3000000, arc.min .7 / max 3000000 + techId sparkGap, boiler.max 3500000 + techId boiler, pad.max 1200000, drone.max 800000), `PurchaseCue` + `purchaseCueByEra`. audioMath: remove `Era`, `currentEra`, `MUSIC` import; add `purchaseCue`, `AmbientInput`, `AmbientMix`, `ambientMix`. Tests: cue table (14 techs differ), refit invariants (>= 3x PF, level at PF <= .95, >= .85 x old at unlock), ambientMix per era, ownership gates, muted contract, bad rates. Net >= +10 tests. Validation: `npx vitest run src/audio/audioMath.test.ts`.

### T2 (W1)
`MUSIC.eraThemes` replaces `MUSIC.keystones`; `musicTheme` = `MUSIC.eraThemes[currentEra(levels)]` (sequence -> null, choice/postgame -> restored). Tests: eraThemes shape, 16-subset parity, Infinity/NaN not owned. Validation: `npx vitest run src/data/music.test.ts src/audio/musicMath.test.ts`.

### T4A (W1)
Header, `target` URL with `debug=1`, `PERF_GPU` args, `PERF_HEADED`, S7..S16 verbatim from stages.mjs, marker branch in `buyFn`, 7 stages, renderer probe, idle `frameP50/P95/MaxMs`, `audio.era/theme/musicBus`, gate keys `postMachineMaxMs` / `postFrameP95Ms`, GPU-only keys, `audioEra` / `audioTheme` / `gpu` / `audioWiring` fail entries. Run: `ONLY=s0_crank,s7_era1_full`, URL without query.

### T5 (W1)
Budget JSON keys, bundle gzip row `report`, `perf-median.mjs` (spec in prompt). Fixture checks in `$OUT/t5-fixtures`.

### T3 (W2)
`GameAudioStats` (+ `levels`, `ambient`), tick pushes `ambientMix`, purchase cue by `purchaseCue(res)`, hook type (3 lines), `gameAudio.test.ts` (>= 6 cases: cue per paying era, muted, music bus, era III trims, music off, before unlock).

### T4B (W2)
`POST` windows (3 repeats + keystone), CDP profile, `audioWiring` probe in s0. Runs on `ONLY=s0_crank,s7_era1_full` then `ONLY=s11_era3_full,s15_era5_full` plus a PERF_PROFILE run.

### T5B (W2)
README section rewrite (Windows, 4174, env vars, GPU, median-of-3 procedure, absolute outdirs, no `/tmp`).

### T6A (W2)
`scripts/perf/perf-tables.mjs <median.json>` prints the markdown tables the close-out needs.

### T6B (W3)
Build, 3 x (half A, half B) GPU runs (each its own command), median merge, profile reruns for breaches, wp2-crank + wp12-menus smokes with `?debug=1`, tables, Director notes. Outputs only under `$OUT`.

### T6C (W4)
Appends `## Close-out (WP15R, 2026-10-23)` to `docs/plan/WP15.md`: status table, D1 cue + refit tables, measured tables (pasted programmatically from `$OUT/tables.md`), s15 uiStats vs a0, bundle table, deviations, budget sign-off line, Director notes.

## Package validation (Director / EM Mode B)
```
cd C:/Users/sanan/wedtmd-shell
npm run typecheck
npm test                                   # >= 2830 tests, 0 failed
npx vitest run src/audio src/data/music.test.ts src/simulation/progression/era.test.ts
npm run build
node scripts/perf/bundle-budget.mjs        # PASS, gzip row 'report'
grep -rn "keystones" src/audio src/data/music.ts                          # empty
grep -nE "export (function currentEra|type Era\b)" src/audio/audioMath.ts # empty
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/audio   # empty
git diff --name-only 3ddc969 -- . ':!src/audio' ':!src/data/audio.ts' ':!src/data/music.ts' ':!src/data/music.test.ts' ':!src/game/debugHook.ts' ':!scripts/smoke/perf.mjs' ':!scripts/smoke/perf-budget.json' ':!scripts/perf' ':!scripts/smoke/README.md' ':!docs/plan/WP15.md' ':!docs/plan/WP15R*' ':!docs/PROJECT_STATUS.md'   # empty
```
Per-criterion PASS/FAIL then comes from `$OUT/median.json`, `$OUT/tables.md`, `$OUT/check.json` (T6B) and the WP15.md close-out (T6C).

## Out of scope
Rendering / entity / scene perf fixes (Director notes -> WP20), new sounds, `synth.ts`, theme retunes, bed trim retunes beyond C1, stages.mjs / finale.mjs / wp12 edits, HUD, title, desktop, persistence, technologies, art, PROJECT_STATUS.md.
