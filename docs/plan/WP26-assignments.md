# WP26 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP26.md` (authoritative) + Director decisions Q1-Q6 (2026-10-27, final) + code at `e860578` (v0.10.0 release-ready).
Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/followups-wp26`. Main tree idle on `e860578`: never edited. Nobody commits; nobody stages `package-lock.json`.
Baseline: typecheck clean; vitest 159 files / 5432 pass / 17 skip; build 240 modules, build:demo 243; app 490.5 KB (demo 491.1) / 500; lazy world 204.9 / 210; css 41.0 / 45 (demo 43.8); world.mjs G_cost 0.2748 ms (limit 0.3, thin); perf GPU frame p95 16.8 ms.
`<S>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad`, `<O>` = `<S>/WP26`, `PW` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`.
Ports: :4174 serves `dist` (already running; restart it after EVERY `npm run build`: it caches its file list). :4177 = `dist-demo` preview, started by the gate only (`npx vite preview --outDir dist-demo --port 4177 --strictPort`, background; `netstat -ano | grep ':4177 .*LISTENING'` before and after; kill with `taskkill //PID <pid> //F` at the end). Never touch :4173 :4175 :4176 :4178. One Playwright browser at a time. The user is away: 3 units per wave are fine.

## Director decisions that win over the plan
Q1 wind floor 0.3 of the bed in still air. Q2 rain follows the visible virga (PR >= 1M) at -30 dB; the hiss drops in pitch and fades as the virga slows; silent once frozen (IV), off in V. Q3 era V sky `fadeInMs` 24000, rising stages only, WorldScene only (ShowcaseScene and teaser keep 1.5 s); the fade-out stays 1.5 s. Q4 move the girl (cycle 3+ only). Q5 servo N1 = recolour only (rim `#7d8286` on the edge pixels of every existing frame; never re-run RotSprite). Q6 tree: slot moves first, a routed detour only where no slot works, tab V gets its own layout pass, pure geometric guard test. The Director owns STEAM_RELEASE, PROJECT_STATUS, the version bump and the ROADMAP_FULL rows.

## EM decisions / deviations (these WIN for workers)
1. **Waves <= 3 units.** The plan's W1 had 5 units. AD1 is split: **AD1a** (data picks: girl x, tree slots; W1, no assets) and **AD1b** (servo arm recolour; W3). The picks reach T7 and T9 through a machine-readable block in `docs/plan/ART_AUDIT.md` (markers `WP26-HANDOFF-BEGIN` / `WP26-HANDOFF-END`), so no prompt needs a number that is not known yet.
2. **Test ownership beyond the plan.** **T2 also owns `src/data/music.test.ts`**: it lists the beds and asserts trims in (0, 1]; the rain trim `[1,1,1,0,0]` needs a documented exception. T6 drops `WORLD_ERA_LOOP_SHEET` and edits only the tests that read it; `src/game/math/worldPlayback.test.ts` reads `WORLD_LOOPS` generically (valid with the receiver only): no edit.
3. **Two data keys the plan did not name** (T2): `AUDIO.weatherStep = { gain: 0.0005, hz: 50 }` (quantum of a push to the synth) and `AUDIO.rain.smoothS = 1.2` (time constant of the rain gain and pitch). Why: `bedTrim.rain` is a STEP (1 to 0) at the era IV keystone, while the virga freezes over 10 s (Q2 says the hiss fades). A 1.2 s time constant turns the step into a fade of about 4 s. Director may veto: set `smoothS` to 0.1.
4. **Readout is post-gate.** `audioStats().ambient` (the `lastMix`) carries the weather fields AFTER the gate (mute, choice, postgame, windStop): `windGain` and `rainGain` read 0 there. T4 relies on it.
5. **worldSettle forces gusts off** (`worldClocks.ts`: `live.gusts = wx.gusts && !direct`). T4 lands each stage with `worldSettle(true)`, then calls `worldSettle(false)` before any wind-variation window.
6. **Sky fade tuning band is 20000-40000 ms, not 16000.** The smallest rising stage step is 0.2 (horizonGlow 0.35 -> 0.55 -> 0.75); at 16 s it lasts 3.2 s, below the 4 s acceptance. T5 pins the band and the 4 s minimum in tests, so a tune by AD2 is a one-number change.
7. **Gates** (below) are run by the EM / Director between waves. Workers never build, never start servers, never run Playwright, except T4 (smoke only, against the gate's previews).
8. **Allowed transient errors:** none expected. End of every wave: `npm run typecheck` clean. A worker that sees a sibling's half-written file re-runs typecheck at the end of its task.
9. **No weather re-push gap.** `applyLevels` (unlock, settings change) re-pushes the weather at once (T3), so there is no 200 ms burst of full-level wind after unmute or unlock.

## Waves
| wave | units | depends |
|---|---|---|
| W1 | **T1** weather readout, **T2** weather data + maths, **AD1a** girl x + tree slot picks (Opus, no assets) | - |
| W2 | **T3** synth + controller, **T6** prune loops, **T9** tree edges | T3: T1, T2. T9: AD1a |
| W3 | **T7** girl stop, **T5** slow era V sky, **AD1b** servo arm recolour (Opus) | T7: T6, AD1a |
| Gate A | EM / Director: typecheck, full vitest, `check_gates.py`, build + build:demo, bundle budget, restart :4174, start :4177; spawn the Opus implementation-reviewer on `git diff e860578` | after W3 |
| W4 | **T4** weather-audio smoke | T3, Gate A |
| Gate B | EM Mode B: serialized functional smokes | after W4 |
| Gate C | EM: timing smokes alone (world.mjs G_cost, perf.mjs); soak 30 min runs during W6 | after Gate B |
| W5 | **AD2** WP26 audit (Opus) | Gates A-C |
| W6 | **T8** docs (soak runs beside it: the docs worker is idle on CPU) | W5 |
| Close | Director: version bump, CHANGELOG date, PROJECT_STATUS, ROADMAP rows, STEAM_RELEASE section 15 rows | |

## File ownership (exclusive per wave)
| Task | Files |
|---|---|
| T1 | `src/game/context.ts`, `src/game/bootstrap.ts`, `src/game/rendering/LivingWorldDirector.ts`, `src/audio/gameAudio.test.ts` (fixture only), any `*.test.ts` that tsc says builds a full `GameFeedback` (expected none) |
| T2 | `src/data/audio.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`, `src/data/music.test.ts` |
| AD1a | `docs/plan/ART_AUDIT.md` (append `## WP26`, AD1a part), `<O>/ad1a/**` |
| T3 | `src/audio/synth.ts`, `src/audio/gameAudio.ts`, `src/audio/gameAudio.test.ts` |
| T6 | `src/data/livingWorld.ts`, `src/data/worldEras.ts`, `src/data/livingWorld.test.ts`, `src/data/worldEras.test.ts`, `scripts/art/world/README.md` |
| T9 | `src/data/technologies.ts` (tree slots), `src/data/technologies.test.ts`, `src/ui/techTreeView.ts` (only with DETOUR lines), `src/ui/techTreeView.test.ts` |
| T7 | `src/data/livingWorld.ts`, `src/data/livingWorld.test.ts`, `src/game/math/worldPlacement.test.ts` |
| T5 | `src/data/world.ts`, `src/data/world.test.ts`, `src/game/math/parallax.ts`, `src/game/math/parallax.test.ts`, `src/game/rendering/ParallaxBackground.ts`, `src/game/scenes/WorldScene.ts` (one line), `scripts/smoke/finale.mjs` and `scripts/smoke/showcase.mjs` (comments only) |
| AD1b | the five servo arm PNG pairs under `public/assets/machine/`, `scripts/art/tiers/servo_rim.py` (new), `docs/plan/PART_TIERS.md` (servo row note), `docs/plan/ART_AUDIT.md` (append AD1b), `<O>/ad1b/**` |
| T4 | `scripts/smoke/weather-audio.mjs` (new), `scripts/smoke/README.md` (append a section) |
| AD2 | `docs/plan/ART_AUDIT.md` (append AD2), `<O>/ad2/**`; may change ONE number, `ERA5_SKY_FADE_IN_MS` in `src/data/world.ts` (20000-40000) |
| T8 | `CHANGELOG.md`, `docs/GAME_SPEC.md`, `docs/plan/STORY_BIBLE.md`, `docs/plan/WP24.md` |

## Cross-task contracts (canonical)
```ts
// C1  src/game/context.ts (T1 writes it in the Director; T3 reads it in gameAudio)
export interface WorldWeather { live: boolean; wind: number; virgaAlpha: number; virgaSpeed: number }
// GameFeedback.worldWeather: WorldWeather   default { live:false, wind:0, virgaAlpha:0, virgaSpeed:0 }
// wind = raw out.ambient.wind (0..1.5); virgaAlpha = tween.virga.alpha * ambient.virgaAlpha; virgaSpeed = tween.virga.speed * ambient.virgaSpeed

// C2  src/data/audio.ts (T2)
// BedId += 'rain'.  wind: { gain: 0.05, lowpassHz: 420, gustPeriodS: 9, gustDepth: 0.6, refWind: 1, floor: 0.3 }
// rain: { gain: 0.03, hzMin: 1800, hzMax: 3200, q: 0.7, alphaRef: 0.7, speedRef: 1, smoothS: 1.2 }   // 0.03 = -30.5 dB
// weatherStep: { gain: 0.0005, hz: 50 }
// bedTrim.boiler = [1, 1, 0.8, 0.6, 0.5]  (era III re-trim; ambientPeakSum(3) = 0.446 <= 0.45)    bedTrim.rain = [1, 1, 1, 0, 0]

// C3  src/audio/audioMath.ts (T2)
export interface WeatherInput { readonly live: boolean; readonly wind: number; readonly virgaAlpha: number; readonly virgaSpeed: number }
export interface WeatherMix { readonly windGain: number; readonly windLfo: boolean; readonly rainGain: number; readonly rainHz: number; readonly live: boolean }
export function weatherMix(input: WeatherInput | null, era: number, muted: boolean): WeatherMix
// AmbientInput += readonly weather?: WeatherInput | null;   AmbientMix += windGain, windLfo, rainGain, rainHz, live

// C4  src/audio/synth.ts (T3)
// setWindLevel(gain: number, lfo: boolean): void     setWind(on) stays = setWindLevel(on ? AUDIO.wind.gain : 0, on)
// setRain(gain: number, hz: number): void            nodes built on the first gain > 0, stopped in close()

// C5  src/data/world.ts (T5)
// export const ERA5_SKY_FADE_IN_MS = 24000;   ParallaxLayerDef.fadeInMs?: number  (skyViolet, horizonGlow)
// src/game/math/parallax.ts: layerFadeMs(def: { fadeMs?: number; fadeInMs?: number }, current: number, target: number, slow: boolean): number
// ParallaxBackground constructor(scene, techLevels, options: { slowFadeIn?: boolean } = {});  WorldScene passes { slowFadeIn: true }
```
Hand-off block (AD1a writes it at the end of `docs/plan/ART_AUDIT.md`; T7 and T9 read it):
```
WP26-HANDOFF-BEGIN
GIRL_X = <even integer 1556..1570>
GIRL_HALF = <half body width, world px>
SLOT <techId> <col> <row>        (one per tech whose tree slot changes; absolute col and row as in technologies.ts)
DETOUR <fromId>-><toId>          (only for an edge that needs a routed detour; usually none)
WP26-HANDOFF-END
```

## Assignments (summaries; the verbatim self-contained prompts are in the workflow output)
- **T1 (W1, worker).** C1 readout. `context.ts` type and field; `bootstrap.ts` default; Director heavy path, right after `this.clocksOut = out;`, writes 4 fields; `onSleep` and `destroy` set `live=false`; `onWake` sets it from `clocksOut` / `applied`. One fixture line in `gameAudio.test.ts`. Acceptance: no allocation, light frames untouched, typecheck, gameAudio tests.
- **T2 (W1, worker).** C2 + C3 data and maths; `ambientMix` fills the weather fields; tests including the peak sums (eras I, II, IV, V unchanged: 0.33, 0.378, 0.441, 0.435; era III 0.446) and the `music.test.ts` bed list.
- **AD1a (W1, Opus).** Girl x (GIRL_X, GIRL_HALF) and the tree slot picks for the 7 N2 edges (tab I wornMotor->flywheel; tab IV echoCrank->harmonicConvergence; tab V nullChamber->graviticAnchor, nullChamber->mainsBackfeed, nullChamber->steamLance, graviticAnchor->skyAperture, inversionCrank->finalAlignment), proved on a scratch copy of `technologies.ts` with `edges.py` and `depth.py`; mock crops for tab I and tab V; the hand-off block.
- **T3 (W2, worker).** C4 synth and controller: `weatherMix` through `ambientMix`, `pushWeather` with quantized dedupe, gate = `appliedLevels.wind`, `applyLevels` zeroes the rain on gate-off and re-pushes the weather on gate-on, post-gate readout, lazy rain nodes, tests (follow, rain follows virga, freeze 0, fallback, mute, windStop, readout, dispose).
- **T6 (W2, worker).** Prune `WORLD_LOOPS` (receiver only), `WORLD_ERA_LOOPS` (crowHigh only), drop `WORLD_ERA_LOOP_SHEET`, narrow the id types, fix the tests, doc note in `scripts/art/world/README.md`.
- **T9 (W2, worker).** Apply the SLOT lines; the geometric guard test is written first (fails on the 7 edges, passes after); optional cross-row detour with a `DETOURED` update.
- **T7 (W3, worker).** `WORLD_GIRL_PLACEMENTS` e1 / s8 / s9 ground x = GIRL_X; pin tests.
- **T5 (W3, worker).** C5 slow rising fade for the era V sky, WorldScene only; tests; smoke comments.
- **AD1b (W3, Opus).** Servo arm recolour of all existing frames of the five arm PNG pairs; gates; in-game proof by copying PNGs into `dist/assets` (no build while workers edit src).
- **T4 (W4, worker).** `weather-audio.mjs` and a README section; run it full and demo against the gate's previews.
- **AD2 (W5, Opus).** Audit: servo II / IV, no figure on a scrap at cycle 3, era V sky screencast (no snap, no linger), teaser and showcase skies unchanged, finale A7 frames vs val6 (9b7f3f1), tree tabs I-V, store shots 03 / 05 / 06 at 1080 and 2160.
- **T8 (W6, worker).** CHANGELOG 0.10.1 text, GAME_SPEC 18.6, STORY_BIBLE 4.1 (era III audio cell, wind rules, era V sky), WP24.md pointers.

## Gates (commands are exact)
`cd "C:/Users/sanan/wedtmd-shell"` first. Outputs under `<O>/gates/`. `PW_PATH=<PW>` for every smoke.

**Gate A (after W3).**
1. `npm run typecheck`; `npx vitest run --maxWorkers=2` (all green: 5432 plus the new tests); `python -I scripts/art/tiers/check_gates.py` (exit 0).
2. `npm run build`; `node scripts/perf/bundle-budget.mjs` (app <= 493.0 KB, lazy <= 210, css unchanged); `npm run build:demo`; `node scripts/perf/bundle-budget.mjs dist-demo` (app <= 493.6). Report the chunk delta of T6 (expected -0.5 to -1.5 KB) and of T1-T3 (<= +2.0 KB).
3. Restart :4174 (`netstat -ano | grep ':4174 .*LISTENING'`, `taskkill //PID <pid> //F`, then `npx vite preview --port 4174 --strictPort` in the background; wait for HTTP 200). Start :4177 for `dist-demo`.
4. Director spawns the Opus implementation-reviewer on `git diff e860578` (read only; may run beside W4).

**Gate B (after W4; one browser at a time; every run `fail []`, `errors []`).** full = `"http://localhost:4174/?debug=1"`, demo = `"http://localhost:4177/?debug=1"`, base = the same URL without the query.
`finale.mjs <full> <O>/gB/finale` (keep the A7 frames for AD2), `showcase.mjs <full> <O>/gB/showcase`, `demo.mjs "http://localhost:4177" <O>/gB/demo`, `tiers.mjs` full and demo, `resolutions.mjs` full and demo (tree PNGs: tab I; demo tabs I-II re-checked), `ux.mjs <full>`, `a11y.mjs "http://localhost:4174"`, `stages.mjs <full>`, `e2e-full.mjs "http://localhost:4174"`, `prestige.mjs <full>`, `store-shots.mjs "http://localhost:4174"` with `SIZES=1080`.

**Gate C (timing; nothing else running; quiet PC).** `world.mjs <full> <O>/gC/world` (`G_cost` <= 0.3; on a fail rerun it alone up to 3 times before calling it a regression; compare with a v0.10.0 run if it stays red), `world.mjs <demo>`, `PERF_STRICT=1 node scripts/smoke/perf.mjs <full> <O>/gC/perf` (audioEra s7-s15, audioTheme s16, audioWiring, peakDbfs <= -1), then `SOAK_MIN=30 node scripts/smoke/soak.mjs "http://localhost:4174" <O>/gC/soak` (run during W6).

Kill :4177 after Gate C and AD2. Leave :4174 running.

## Risks (EM)
1. G_cost is thin (0.27 of 0.30): only T1 adds frame work (4 field writes per heavy frame).
2. The era III mix (rain + boiler 0.8) is not heard in CI. Data only; a short listen by the Director is recommended.
3. The rain trim is a step at the era IV keystone; `smoothS` 1.2 s makes it a fade of about 4 s, shorter than the 10 s virga freeze (EM decision 3).
4. Slot moves change tree screenshots. Tab III must not move (F4 is in). Demo tabs I-II are re-checked in Gate B.
5. AD1b works on a dist copy of the PNGs only; the Gate A build is authoritative.
6. `worldSettle(true)` snaps the sky and zeroes gusts: smokes that need real fades or gusts must turn it off.
