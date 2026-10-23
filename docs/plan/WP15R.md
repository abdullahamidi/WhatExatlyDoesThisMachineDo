## Work Package 15R: WP15 close-out (energy-continuity audio, GPU perf re-measure, formal close)
Goal: close WP15 under STEAM_DEMO_PROGRAM D1 (audio items) + D7. Purchase cue follows the energy that pays. Rate-driven beds re-fit to at least 3x the PF rates. Music and bed trims use simulation `currentEra`. Wiring is proven end to end. The perf smoke runs on the real GPU with idle and post-purchase windows. WP15.md gets a close-out section.

Repo: `C:/Users/sanan/wedtmd-shell`, branch `claude/steam-shell`. Baseline 3ddc969: typecheck clean, 95 files / 2820 tests, build OK, bundle PASS (measured now: app 363.6 KB raw / 108.4 KB gzip, phaser 1481.8, css 33.8, public 1149.7).
Allowed files ONLY: `src/audio/**`, `src/data/audio.ts`, `src/data/music.ts`, `src/data/music.test.ts`, `src/game/debugHook.ts` (audio/perf probe types only, diff ≤ 3 lines; WP18 edits the same file in the main repo), `scripts/smoke/perf.mjs`, `scripts/smoke/perf-budget.json`, `scripts/perf/**`, `scripts/smoke/README.md`, `docs/plan/WP15.md`. Everything else is read-only. A perf fix that needs a forbidden file becomes a Director note for WP20.

### Status audit: WP15 T1–T9 (from git + code at 3ddc969; a0.json is stale)
| T | state | evidence | WP15R action |
|---|---|---|---|
| T1 music data + musicVolume | done | 6ebbbaa/2b9acbb: `src/data/music.ts`, `audio.ts` bedTrim + limiter, `settings.ts:10` musicVolume 70, `simulation/settings.ts:44`; tests music.test.ts, settings.test.ts | `MUSIC.keystones` → `MUSIC.eraThemes` (T2) |
| T2 pure music/mix maths | done, has duplicate era logic | 3b83b68, 2ae0f0d: musicMath.ts + 365-line test; audioMath `currentEra` copy (audioMath.ts:205) | remove the copy, use simulation `currentEra` (T1, T2) |
| T3 synth music bus/limiter/stats | done | 3b83b68 + aa451a1: synth.ts openGraph (music bus under master, compressor), slots, stats | none |
| T4 controller wiring | done; D1 items missing | ded5c66, aa451a1: gameAudio.ts theme/crossfade/duck, bedTrim per era (:310-320), musicBus → `setBusGain('music')` (:159,:167) | cue by paying era, rate refit, era source, proof tests (T1–T3) |
| T5 MUSIC slider | done | 31563ac: settingsView.ts VOLUME_IDS has 4 ids, `volumePatch('musicVolume')`; wp12 smoke records `4_volume_sliders` | browser slider→bus probe (T4) |
| T6 perf probes + HUD throttle | done, not formally accepted | 6ebbbaa: WorldScene uiStats ring, `HUD_REFRESH_MS` 100 (data/world.ts:88), perfMarks; boot mark moved to `public/boot.js` by WP19 (index.html:8, CSP-safe, before modules) | record s15 uiStats (GPU) vs a0 reference (mean ~0.08, max ≤ 0.4 ms); pre-throttle number cannot be recovered → deviation (T6) |
| T7 idle spike fix | cut + partial | a0 F3: the 35 ms spike only shows on SwiftShader; on GPU, machine max is 2.6 (s13) / 1.5 (s15) ms. 832a6a5 landed the cable raster LRU in MachineLinks. a5 C8: post-purchase never measured | re-measure idle + 0–3 s post-purchase on GPU (T4, T6); forbidden-file causes → Director notes |
| T8 menu refresh + boot toast | done | 6ebbbaa/2b9acbb: systemMenu `MENU_REFRESH_MS`, startup.ts:38 `bootAchievements`, bootstrap toast | none |
| T9 perf smoke + budgets | done, outdated | 3b83b68/413f0b4/bd21a2c: perf.mjs, perf-budget.json, bundle-budget.mjs, perfBudget.test.ts | GPU launch, debug=1, WP17 buy lists + `@id:n` markers, era I/III stages, post windows, renderer string, profile, median-of-3, gzip report-only (T4, T5) |

### D Decisions
- D1 **Purchase cue = era of the PAYING resource.** `cue = AUDIO.purchaseCueByEra[RESOURCES[res].era − 1]`. `res` is the `purchase` event field, which is `costRes` (GameSession.ts:193). Same rule for every tech, keystones included: you hear what you pay with. The new era is announced by the music crossfade, the new bed and the part clunk. 14 techs change cue (C1 table).
- D2 **Rate refit.** Each rate-driven param gets `maxPerSecond ≥ 3 × PF rate` (PF: me 1.2e4, ee 9.6e5, pr 1.1e6, rs 3.8e5, xf 2.5e5). The level at the PF rate must be ≤ 0.95 (no saturation at PF). The value at the unlock rate must be ≥ 0.85 × the pre-refit value. `minGain`/`minRate` compensate where needed. `maxGain` is unchanged, so the mix invariants (bed sum ≤ 0.45, total ≤ 1.0) stay as they are. T1 owns all tuning in `src/data/audio.ts`.
- D3 **One era source.** `currentEra` from `src/simulation/progression/era.ts` (direct path, same as hudView.ts). Delete `audioMath.currentEra` and `audioMath.Era` and use `EraNumber` from `src/data/eras.ts`. Replace `MUSIC.keystones` with `MUSIC.eraThemes`. NaN/Infinity levels count as not owned (simulation semantics).
- D4 **Pure ambient mix.** `audioMath.ambientMix(input)` computes every bed value. `gameAudio.tick` only pushes the result. Behaviour stays identical apart from D1–D3. `GameAudio.stats()` returns `GameAudioStats` (+ `levels`, `ambient`) so smokes can see trims and buses.
- D5 **Wiring proof.** bedTrim and musicVolume are wired (code read). Proof comes from `gameAudio.test.ts` (controller: settings → `setBusGain('music')`, era → trims, cue) and the perf.mjs `audioWiring` probe (browser: slider `#sys-set-musicVolume` → `levels.musicBus`).
- D6 **Perf on the real GPU.** perf.mjs adds `debug=1` when the URL has no `debug` param. `PERF_GPU=1` launches with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`. Every run records the WebGL renderer string. A software renderer under `PERF_GPU=1` is a `fail`. New stages: `s7_era1_full`, `s11_era3_full`. Post-purchase 0–3 s windows on s7/s11/s15. The machine is CPU-loaded by parallel workflows, so every reported number is a median of 3 runs (`perf-median.mjs`).
- D7 **Bundle budget asserts raw sizes only** (program D7): app ≤ 400 KB raw; gzip is printed with status `report` and never breaches.
- D8 T7 is closed as "cut" (premise was SwiftShader). Anything the GPU re-measure finds in rendering/entities/scenes becomes a Director note (WP20). No `synth.ts`, no new sounds.

### C Contracts

#### C1 `src/data/audio.ts` (owner T1)
```ts
export type PurchaseCue = 'purchase' | 'relay' | 'hiss' | 'forkPing' | 'swell';
// inside AUDIO (as const), after `purchase`:
purchaseCueByEra: ['purchase', 'relay', 'hiss', 'forkPing', 'swell'] satisfies readonly [PurchaseCue, PurchaseCue, PurchaseCue, PurchaseCue, PurchaseCue],
```
Refit (only these leaves change; update the comments):
| key | old | new | sat / PF | unlock rate (profile A, a2 §2) | value old → new (ratio) | level at PF |
|---|---|---|---|---|---|---|
| hum.maxPerSecond (also gear curve) | 5000 | 40000 | 3.33 | ME 1/s | hum gain .0498→.0478 (.961); gear 2.517→2.318 t/s (.921) | .886 |
| mains.minGain | 0.02 | 0.025 | – | – | – | – |
| mains.maxPerSecond | 5000 | 3000000 | 3.13 | EE 4.17/s (generator) | .0335→.0322 (.960) | .924 |
| arc.minRate | 0.5 | 0.7 | – | – | – | – |
| arc.maxPerSecond | 5000 | 3000000 | 3.13 | EE 4.17/s | .982→.953 arcs/s (.971) | .924 |
| boiler.maxPerSecond | 100000 | 3500000 | 3.18 | PR 9.85/s (boiler) | .0528→.0474 (.898) | .923 |
| pad.maxPerSecond | 100000 | 1200000 | 3.16 | RS 8.14/s (spire) | .0315→.0295 (.935) | .918 |
| drone.maxPerSecond | 100000000 | 800000 | 3.20 | XF 4.65/s (nullChamber) | .0266→.0289 (1.088) | .914 |
New string leaves: `arc.techId: 'sparkGap'`, `boiler.techId: 'boiler'`.

Cue changes (all other 36 techs keep their cue):
| tech | tech era | costRes | old cue | new cue |
|---|---|---|---|---|
| generator, motorRetrofit | 2 | me | relay | purchase |
| boiler, inductionHeater | 3 | ee | hiss | relay |
| bellowsDrive | 3 | me | hiss | purchase |
| resonatorSpire, pressureResonator | 4 | pr | forkPing | hiss |
| crankServo | 4 | me | forkPing | purchase |
| gridExciter | 4 | ee | forkPing | relay |
| nullChamber, resonantSiphon | 5 | rs | swell | forkPing |
| graviticAnchor | 5 | me | swell | purchase |
| mainsBackfeed | 5 | ee | swell | relay |
| steamLance | 5 | pr | swell | hiss |

#### C2 `src/data/music.ts` + `src/audio/musicMath.ts` (owner T2)
```ts
import type { EraNumber } from './eras';
const ERA_THEMES: Readonly<Record<EraNumber, MusicThemeId>> = { 1: 'mech', 2: 'elec', 3: 'therm', 4: 'reson', 5: 'exotic' };
export const MUSIC = { themes: THEMES, eraThemes: ERA_THEMES, /* keystones REMOVED */ busGain: 0.36, ... } as const;
// musicMath.ts
import { currentEra } from '../simulation/progression/era';
export function musicTheme(techLevels: Readonly<Record<TechId, number>>, phase: EndingPhase): MusicThemeId | null {
  if (phase === 'sequence') return null;
  if (phase === 'choice' || phase === 'postgame') return 'restored';
  return MUSIC.eraThemes[currentEra(techLevels)];
}
```
Remove the unused `TechId` import from music.ts. Update every comment that names `MUSIC.keystones`.

#### C3 `src/audio/audioMath.ts` (owner T1)
```ts
import type { EraNumber } from '../data/eras';
import type { PurchaseCue } from '../data/audio';
import { RESOURCES } from '../data/resources';
import { TECHNOLOGIES } from '../data/technologies';
import { currentEra } from '../simulation/progression/era';
import type { EndingPhase, ResourceId, TechId } from '../data/types';
// REMOVED: export type Era, export function currentEra, import { MUSIC }. eraOf(n) now returns EraNumber; BED_ARRIVAL_ERA: Record<BedId, EraNumber>.

/** Purchase cue by the era of the paying resource; unknown -> 'purchase'. */
export function purchaseCue(res: ResourceId): PurchaseCue;   // AUDIO.purchaseCueByEra[eraOf(RESOURCES[res]?.era ?? 1) - 1] ?? 'purchase'

export interface AmbientInput {
  readonly perSecond: Readonly<Record<ResourceId, number>>;
  readonly techLevels: Readonly<Record<TechId, number>>;
  readonly muted: boolean;
}
export interface AmbientMix {
  readonly era: EraNumber;
  readonly humHz: number; readonly humGain: number;
  readonly gearRate: number; readonly gearGain: number;   // gearGain = scale passed to scheduleGearTicks
  readonly mainsGain: number; readonly arcRate: number;
  readonly boilerGain: number; readonly padGain: number; readonly droneGain: number;
  readonly servoGain: number; readonly servoHz: number;
}
export function ambientMix(input: AmbientInput): AmbientMix;
```
`ambientMix` rules. `era = currentEra(techLevels)`. `owned(id) = techLevels[id] >= 1`. `L = techLevels[AUDIO.servo.techId]`, `max = TECHNOLOGIES[AUDIO.servo.techId].maxLevel ?? 1`. Rates come from `perSecond.me/ee/pr/rs/xf`.
- Not muted:
  - `humHz = humFrequency(me)`, `humGain = humGain(me) × bedTrim('hum', era)`
  - `gearRate = gearTickRate(me)`, `gearGain = bedTrim('gear', era)`
  - `mainsGain = mainsGain(ee) × bedTrim('mains', era)`
  - `arcRate = arcRate(ee, owned(AUDIO.arc.techId))` (no trim)
  - `boilerGain = boilerGain(pr, owned(AUDIO.boiler.techId)) × bedTrim('boiler', era)`
  - `padGain = padGain(rs, owned(AUDIO.pad.techId)) × bedTrim('pad', era)`
  - `droneGain = droneGain(xf, owned(AUDIO.drone.techId)) × bedTrim('drone', era)`
  - `servoGain = servoGain(L, max) × bedTrim('servo', era)`, `servoHz = servoHz(L, max)`
- Muted: same `era`, `humHz = humFrequency(me)`, every other gain and rate 0, `gearGain = 1`, `servoHz = AUDIO.servo.minHz`.
- Every output is finite for NaN, negative or Infinity rates.

#### C4 `src/audio/gameAudio.ts` + `src/game/debugHook.ts` (owner T3)
```ts
export interface GameAudioStats extends AudioStats {
  readonly levels: LevelSnapshot | null;   // last set pushed by applyLevels; null before unlock
  readonly ambient: AmbientMix | null;     // last mix pushed by tick; null before the first tick
}
export interface GameAudio { readonly unlocked: boolean; stats(): GameAudioStats; dispose(): void; }
```
- `tick` builds `ambientMix({ perSecond: session.rates.perSecond, techLevels: session.state.techLevels, muted: session.settings.muted })`, stores it as `lastMix`, then pushes in this order: `setHum(humHz, humGain)`, `scheduleGearTicks(gearRate, gearGain)`, `setMains`, `scheduleArcs`, `setBoiler`, `setPad`, `setDrone`, `setServo(servoGain, servoHz)`. The muted branch disappears (it is inside the mix).
- `purchase` handler: `({ res }) => switch (purchaseCue(res)) { purchase→playPurchase, relay→playRelay, hiss→playHiss, forkPing→playForkPing, swell→playSwell }`. Still muted-gated and wrapped in try/warnOnce.
- Remove the `TECHNOLOGIES` and `currentEra` imports from gameAudio.
- `idleStats` adds `levels: null, ambient: null`. `dispose` sets `lastMix = null`.
- debugHook: `audioStats(): GameAudioStats | null`, import type from `'../audio/gameAudio'`; drop the `AudioStats` import if it becomes unused.

#### C5 `scripts/smoke/perf.mjs` (owner T4)
| env / input | effect |
|---|---|
| `<url>` | when it has no `debug` param, `new URL(url).searchParams.set('debug','1')` is applied before every `goto` |
| `PERF_GPU=1` | launch args `['--js-flags=--expose-gc','--autoplay-policy=no-user-gesture-required','--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']`; gates `frameP95Ms` and `postFrameP95Ms`; `fail += 'gpu requested but renderer is software: <renderer>'` when `renderer.software !== false` |
| `PERF_HEADED=1` | `chromium.launch({ headless: false, ... })` |
| `PERF_PROFILE=1` | CDP CPU profile (`newCDPSession`, `Profiler.enable`, `setSamplingInterval {interval:200}`, start before the purchase, stop after the window) for post repeat #1 and the keystone window; record `top`: 10 entries `{ fn: "<functionName or (anonymous)> <file>:<line+1>:<col+1>", selfMs }`, where selfMs = hitCount × (endTime−startTime)/1000/samples.length; when an outdir is given, writes `<outdir>/<stage>-repeat.cpuprofile` and `-keystone.cpuprofile` |
| `ONLY` | `s0_crank,s7_era1_full,s9_era2_full,s11_era3_full,s13_era4_full,s15_era5_full,s16_postgame,finale` |
| `PERF_STRICT`, `PERF_<METRIC>` | unchanged |
- Buy lists S7…S16 are copied verbatim from `scripts/smoke/stages.mjs` lines 6-16 (WP17: bellowsDrive ×3, gridExciter ×5, `@resonantSiphon:20`, `@graviticAnchor:10`, mainsBackfeed ×5, steamLance ×5). `buyFn` gets the `@<techId>:<n>` marker branch verbatim from stages.mjs (128 rounds).
- STAGES order: s0_crank `[]`, s7_era1_full S7, s9_era2_full S9, s11_era3_full S11, s13_era4_full S13, s15_era5_full S15, s16_postgame S16 (postgame).
- `POST = { s7_era1_full: { repeat: 'gearRatio', prep: ['@blueprint'], keystone: 'generator' }, s11_era3_full: { repeat: 'bellowsDrive', prep: [], keystone: 'resonatorSpire' }, s15_era5_full: { repeat: 'steamLance', prep: [], keystone: null } }`. Constants: `POST_REPEATS 3`, `POST_SETTLE_MS 1000`, `POST_WINDOW_MS 3000`.
- `postWindow(page, id)` runs outside the window first: up to 6× `if (!s.getTechView(id).affordable) { t += 8 h; s.update(t) }` (t starts at Date.now()), then wait `POST_SETTLE_MS`. Inside the window: clear `__wedtmdFrames`, `ok = session.purchase(id).ok`, wait 2000 → probes A, wait 1000 → probes B, read+clear frames. It returns `{ id, ok, frames: n, frameP95Ms, frameMaxMs, machineMeanMs: max(A,B), machineMaxMs: max(A,B), uiMaxMs: max(A,B), displayObjects: B }`.
- Stage order: idle (10 s warm-up + 3×2 s, as now) → s15 techTree + heap → `post.repeat` (3 windows; record `{ id, ok: [..], frameP95Ms: med, frameMaxMs: max, machineMeanMs: med, machineMaxMs: med, machineMaxMsRaw: max, uiMaxMs: med, displayObjects: max }`) → `buyFn(prep)` then `post.keystone` (1 window or null) → s16 cycle probe.
- New per-stage idle fields: `frameP50Ms`, `frameP95Ms`, `frameMaxMs` (from that stage's 3 idle windows); `audio.era = last sample audio?.ambient?.era ?? null`, `audio.theme`, `audio.musicBus = audio?.levels?.musicBus ?? null`.
- Expected eras `{ s7_era1_full: 1, s9_era2_full: 2, s11_era3_full: 3, s13_era4_full: 4, s15_era5_full: 5 }`. Add `fail` `audioEra <stage> <got> != <want>` when got is a number and differs. s16: `fail` `audioTheme s16_postgame <got> != restored` when got is a string and differs.
- `audioWiring` (s0 only, after the idle windows): click the crank 3× and wait 1000 ms. Read `musicBusBefore`. Esc opens the menu, click `#sys-tab-settings`, `$eval('#sys-set-musicVolume', el => { el.value='0'; el.dispatchEvent(new Event('change',{bubbles:true})) })`, wait 600 → `musicBusAt0`, wait 2000 → `musicVoicesAt0`. Set '70', wait 600 → `musicBusAt70`. Esc. `ok = null` when any `levels` is missing. Otherwise `ok = unlocked && musicBusAt0 === 0 && musicVoicesAt0 === 0 && |musicBusAt70 − musicBusBefore| < 1e-9`. `fail += 'audioWiring'` when `ok === false`.
- `renderer` (first page of the run): WebGL2/WebGL canvas, `WEBGL_debug_renderer_info` → `{ renderer, vendor, software: /swiftshader|llvmpipe|software|basic render/i.test(renderer) }`, stored in `metrics.renderer`.
- Gate adds `postMachineMaxMs` = max over stages of the repeat and keystone `machineMaxMs`, and `postFrameP95Ms` = max of the repeat and keystone `frameP95Ms`. GPU-only keys: `['frameP95Ms','postFrameP95Ms']`.
- Update the header comment (usage, env, stages).

#### C6 budgets + tools (owner T5)
- `perf-budget.json`: add `"postMachineMaxMs": 40`, `"postFrameP95Ms": 17`. Remove `bundle.appGzipKb`. Add `_notes`: `postMachineMaxMs` "0–3 s after a purchase, contention-tolerant like machineMaxMs"; `postFrameP95Ms` "GPU only"; `appGzipKb` "report-only since WP15R (program D7: raw sizes only; desktop build)".
- `bundle-budget.mjs`: the gzip row prints the value with limit `-` and status `report`, and is never counted as a breach. Other rows are unchanged. Update the header comment.
- `scripts/perf/perf-median.mjs` (new). Usage: `node scripts/perf/perf-median.mjs <perf.json> [<perf.json> ...]`. Inputs may be halves (ONLY subsets). For each stage name, take the median over the inputs that contain it of: `machineMeanMs, machineMaxMs, uiMeanMs, uiMaxMs, displayObjects, frameP95Ms, frameMaxMs`, `post.repeat.*` and `post.keystone.*` (`frameP95Ms, frameMaxMs, machineMeanMs, machineMaxMs, uiMaxMs, displayObjects`), `audio.liveVoices/musicVoices/peakDb`, `heap.usedMb/growthMb`, `techTree.medianMs`, `cycle.pct`; also `n`. Finale: median per `t8/t22/t34/t36` field. Boot: median `bootMs`. Gate keys are recomputed with the perf.mjs formulas from the median records; `frameP95Ms` = max of stage frameP95Ms (documented as conservative). Budgets come from perf-budget.json numeric keys. GPU = every input has `budgets.frameP95MsGated === true`. Output is one JSON on stdout: `{ runs, renderers: [..], gpu, gate, stages, finale, boot, budgets, fail }`. Exit 1 only with `PERF_STRICT=1` and a non-empty fail.
- README "WP15 perf smoke + bundle budget" section, rewritten for Windows: preview `http://localhost:4174/?debug=1` (debug auto-added); all C5 env vars; GPU flags; `PERF_HEADED=1` fallback when the renderer string is SwiftShader; median-of-3 procedure with the two halves; absolute outdirs under the session scratchpad (no `/tmp`); gzip report-only; the new budget keys.

### Tasks
- T1 Audio data refit + cue + ambient mix (pure). Files: `src/data/audio.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`. Depends on: none (W1).
  Acceptance:
  - C1 numbers and new leaves exactly. C3 signatures exactly. `currentEra`/`Era`/`MUSIC` are gone from audioMath.ts.
  - `audioMath.test.ts`: the `currentEra` describe is removed (simulation era.test.ts covers it). New tests:
    - (a) `purchaseCue` me→purchase, ee→relay, pr→hiss, rs→forkPing, xf→swell. Legacy: bellowsDrive→purchase, gridExciter→relay, mainsBackfeed→relay, steamLance→hiss (via `TECHNOLOGIES[id].costRes`). Every TECH_LIST tech gets `purchaseCueByEra[RESOURCES[costRes].era−1]`. Exactly the 14 C1 techs differ from `purchaseCueByEra[tech.era−1]`.
    - (b) refit: `maxPerSecond ≥ 3×PF` for hum(me), mains/arc(ee), boiler(pr), pad(rs), drone(xf). `activityLevel(PF, ref, max) ≤ 0.95`. Value at the unlock rate ≥ 0.85 × the old value. The old value is computed in the test as `min + (max−min) × activityLevel(u, 1, oldMax)` with the C1 old numbers (no cfg override; literal types).
    - (c) `ambientMix`: era from keystones (boiler → 3; `nullChamber: Infinity` → not owned). For each era 1..5 (keystones up to e + wornMotor, sparkGap, crankServo 5, nonzero rates): each gain = base fn × `AUDIO.bedTrim[bed][e−1]` (toBeCloseTo 12), `gearGain = bedTrim('gear', e)`. Ownership gates for arc/boiler/pad/drone. Muted contract. NaN/negative/Infinity rates give finite outputs and gain 0.
  - Existing mix invariants still pass.
  - `npx vitest run src/audio/audioMath.test.ts` green, ≥ +10 net tests.
  - `npx tsc --noEmit` errors only in `src/audio/gameAudio.ts` (fixed by T3).
- T2 Music themes by simulation era. Files: `src/data/music.ts`, `src/data/music.test.ts`, `src/audio/musicMath.ts`, `src/audio/musicMath.test.ts`. Depends on: none (W1).
  Acceptance:
  - C2 exactly; `grep -rn "keystones" src/audio src/data/music.ts` is empty once T1 lands.
  - music.test.ts replaces the 'MUSIC keystones' describe:
    - `eraThemes` toEqual `{1:'mech',2:'elec',3:'therm',4:'reson',5:'exotic'}`
    - values ⊂ themes, distinct, no 'restored'
    - every `ERA_KEYSTONES` era maps to a theme ≠ `eraThemes[1]`
    - `'keystones' in MUSIC` is false
  - musicMath.test.ts adds:
    - parity over all 16 keystone subsets: `musicTheme(levels,'none') === MUSIC.eraThemes[currentEra(levels)]`
    - `{nullChamber: Infinity}` → 'mech', `{boiler: NaN}` → 'mech', `{generator:1, resonatorSpire: Infinity}` → 'elec'
  - Existing musicTheme tests unchanged and green.
  - `npx vitest run src/data/music.test.ts src/audio/musicMath.test.ts` green.
  - tsc errors only in T1/T3-owned audio files.
- T3 Controller wiring + proof test + hook type. Files: `src/audio/gameAudio.ts`, `src/audio/gameAudio.test.ts` (new), `src/game/debugHook.ts`. Depends on: T1, T2 (W2).
  Acceptance:
  - C4 exactly; debugHook diff ≤ 3 lines.
  - gameAudio.test.ts (node env) uses:
    - `const h = vi.hoisted(() => ({ synth: null as unknown as Synth }))`; `vi.mock('./synth', () => ({ createSynth: () => h.synth }))`
    - a fake synth with every `Synth` method as `vi.fn()`, `isRunning → true`, `stats → {liveVoices:0, musicVoices:0, dropped:0, peakDb:null}`
    - a fake Window: `AudioContext` class `{currentTime 0, state 'running', addEventListener/removeEventListener vi.fn}`, a listener map, `setInterval` capturing the tick, `performance.now`, `document {visibilityState:'visible', add/removeEventListener}`
    - `new GameSession({ state: {...createInitialState(0), res: all 1e15, techLevels: ...}, now: () => 0 })`
    - feedback built from 3 `createSignal()`
    - unlock by calling the stored `pointerdown` listener
  - Cases (≥ 6):
    - (1) bellowsDrive/gridExciter/mainsBackfeed/steamLance purchases call playPurchase/playRelay/playRelay/playHiss once each; playSwell and the old-era cues are not called.
    - (2) muted: purchase calls no cue; tick → setHum gain 0, `stats().ambient.humGain` 0.
    - (3) `updateSettings({musicVolume:0})` → last `setBusGain('music',…)` gain 0 and `stats().levels.musicBus` 0; 50 → `0.5 × MUSIC.busGain`.
    - (4) era III state (wornMotor, generator, boiler) tick → setHum gain ≈ `humGain(me) × AUDIO.bedTrim.hum[2]`, setBoiler ≈ `boilerGain(pr,true) × bedTrim.boiler[2]`, `stats().ambient` deep-equals `ambientMix(...)`, `stats().theme === 'therm'`.
    - (5) musicVolume 0 then tick → `stopMusic` called and no further `playMusicNote`.
    - (6) before unlock, `stats().levels` and `ambient` are null.
  - `console.warn` spy never called.
  - `npm run typecheck` clean. `npx vitest run src/audio` green.
- T4 Perf smoke: GPU, debug, era stages, post windows, renderer, profile, audio probes. Files: `scripts/smoke/perf.mjs`. Depends on: none (W1; reads the new audio fields null-safe).
  Acceptance:
  - C5 exactly. `node --check scripts/smoke/perf.mjs` OK.
  - Against the current preview: `PW_PATH=$PW PERF_GPU=1 ONLY=s0_crank,s7_era1_full node scripts/smoke/perf.mjs "http://localhost:4174/" "$OUT/t4-check"`. The URL has no query on purpose, to prove debug is auto-added. Required output:
    - `errors: []`
    - `metrics.renderer.software === false` (expect an NVIDIA D3D11 string; else retry with PERF_HEADED=1 and report)
    - `stages.s7_era1_full.post.repeat.ok` = [true,true,true] and `post.keystone.ok` true
    - numeric `frameP95Ms` on both stages
    - `metrics.audioWiring` present (`ok` null allowed on the pre-T3 build)
    - gate has `postMachineMaxMs`
  - `PERF_PROFILE=1 ONLY=s7_era1_full` writes 2 `.cpuprofile` files and `top` arrays of ≤ 10 entries.
  - The S-lists diff against stages.mjs lines 6-16 is empty, apart from formatting.
- T5 Budgets, median tool, bundle report, README. Files: `scripts/smoke/perf-budget.json`, `scripts/perf/bundle-budget.mjs`, `scripts/perf/perf-median.mjs` (new), `scripts/smoke/README.md`. Depends on: none (W1; key names fixed by C5/C6).
  Acceptance:
  - perf-budget.json parses and has `postMachineMaxMs` 40, `postFrameP95Ms` 17, no `bundle.appGzipKb`.
  - `node scripts/perf/bundle-budget.mjs` prints the gzip row with status `report`, then `bundle budget: PASS`, exit 0.
  - perf-median on 3 hand-made fixtures in `$OUT/t5-fixtures` (s7_era1_full machineMeanMs 1/2/3, post.repeat.machineMaxMs 5/50/6): stage median 2, post median 6, `n` 3, exit 0. With `PERF_STRICT=1` and a fixture breaching machineMeanMs (all > 4): exit 1. Half files (different stages per file) merge per stage.
  - README contains `debug=1`, `4174`, `PERF_GPU`, `PERF_HEADED`, `PERF_PROFILE`, `perf-median`, the new stage names and an absolute Windows outdir, and no `/tmp`.
- T6 GPU re-measure (median of 3) + WP15 close-out doc. Files: `docs/plan/WP15.md`; outputs only under `$OUT`. Depends on: T1–T5 merged + reviewer pass + `npm run build` (W3).
  Procedure:
  - 3 runs × 2 halves, each as its own command with timeout 600000: half A `ONLY=s0_crank,s7_era1_full,s9_era2_full,s11_era3_full`, half B `ONLY=s13_era4_full,s15_era5_full,s16_postgame,finale`, with `PERF_GPU=1`, outdirs `$OUT/gpu-<i>-a|b`.
  - Merge with `perf-median.mjs` → `$OUT/median.json`.
  - If the renderer is software, rerun with `PERF_HEADED=1`. If it is still software, raise a blocker.
  - For every breached gate (or post window with frameMaxMs > 50), rerun that stage alone with `PERF_PROFILE=1` into `$OUT/profile-<stage>` and take the top self-time.
  - Classify: a cause in `src/audio/**` goes to the EM as a fix for the T1/T3 owner. Any other cause becomes a Director note: `N<k> [WP20] file · cause (fn from profile) · evidence (stage/window, median-of-3 vs budget, renderer) · proposed fix`.
  Acceptance:
  - WP15.md gains `## Close-out (WP15R, 2026-10-23)` with:
    - the status table above, with final states
    - the D1 audio items (cue table, refit table)
    - measured table (median of 3, GPU, renderer string, CPU-contention note): per stage s0/s7/s9/s11/s13/s15/s16 idle machine mean/max, ui mean/max, displayObjects, frame p50/p95; post repeat/keystone for s7/s11/s15: frame p95/max, machine mean/max, displayObjects; finale t8–t36 finaleMeanMs; boot; heap; audio voices/peak; techTree; cycle
    - s15 uiStats vs the a0 reference
    - bundle table
    - deviations (keystone cues change, gzip report-only, T6 pre-throttle number unrecoverable, T7 cut, machineMaxMs 40)
    - Director notes
  - Every value in the doc matches `$OUT/median.json`.
  - wp2-crank and wp12-menus with `?debug=1`: `errors []`.
  - `audioWiring.ok === true`; audio eras match the expected table; s16 theme is `restored`.

### Waves (≤ 4 parallel, exclusive files)
W1 = T1, T2, T4, T5. W2 = T3. Then reviewer (Opus) over the combined diff. W3 = T6. Then EM Mode B.
Transient tsc inside W1: only `src/audio/gameAudio.ts` (it imports the removed `currentEra`), plus `src/audio/audioMath.ts` if T2 lands before T1. Both must be clean after W2.
Tuning owners: audio numbers → T1 (`src/data/audio.ts`) only. Budgets → T5 (`perf-budget.json`), changed only with a Director sign-off line in the WP15.md close-out.

### Package acceptance / validation commands (Git Bash)
```
cd "C:/Users/sanan/wedtmd-shell"
PW=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright
OUT="C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP15R"
mkdir -p "$OUT"
npm run typecheck
npm test                                   # >= 2830 tests (baseline 2820 / 95 files; +gameAudio.test.ts), 0 failed
npx vitest run src/audio src/data/music.test.ts src/simulation/progression/era.test.ts
npm run build                              # refreshes the 4174 preview; never start a server on 4174
node scripts/perf/bundle-budget.mjs        # PASS, gzip row 'report', app raw <= 400 KB
grep -rn "keystones" src/audio src/data/music.ts                                  # empty
grep -nE "export (function currentEra|type Era\b)" src/audio/audioMath.ts         # empty
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/audio   # empty
git diff --name-only 3ddc969 -- . ':!src/audio' ':!src/data/audio.ts' ':!src/data/music.ts' ':!src/data/music.test.ts' ':!src/game/debugHook.ts' ':!scripts/smoke/perf.mjs' ':!scripts/smoke/perf-budget.json' ':!scripts/perf' ':!scripts/smoke/README.md' ':!docs/plan/WP15.md' ':!docs/plan/WP15R*' ':!docs/PROJECT_STATUS.md'   # empty
for i in 1 2 3; do
  PW_PATH=$PW PERF_GPU=1 ONLY=s0_crank,s7_era1_full,s9_era2_full,s11_era3_full node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" "$OUT/gpu-$i-a" > "$OUT/gpu-$i-a.log"
  PW_PATH=$PW PERF_GPU=1 ONLY=s13_era4_full,s15_era5_full,s16_postgame,finale node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" "$OUT/gpu-$i-b" > "$OUT/gpu-$i-b.log"
done                                       # each invocation as its own command (<= 10 min)
node scripts/perf/perf-median.mjs "$OUT"/gpu-*-a/perf.json "$OUT"/gpu-*-b/perf.json > "$OUT/median.json"   # renderer not software; fail [] or each entry is a Director note
mkdir -p "$OUT/wp2" "$OUT/wp12"
PW_PATH=$PW node scripts/smoke/wp2-crank.mjs  "http://localhost:4174/?debug=1" "$OUT/wp2"    # errors [], failed []
PW_PATH=$PW node scripts/smoke/wp12-menus.mjs "http://localhost:4174/?debug=1" "$OUT/wp12"   # errors []
```
Manual (Director, optional): listen to an era III save buying bellowsDrive (thunk, not hiss), and era V buying steamLance (hiss) and mainsBackfeed (relay). Drag the MUSIC slider to 0 and the music stops within 2 s.

### Out of scope for this package
- Rendering/entity/scene perf fixes (MachineView, MachineLinks, SteamFx, CameraController, WorldScene): Director notes → WP20.
- New sounds or voices, `synth.ts` changes, music theme retunes, bed trim retunes beyond C1.
- stages.mjs / finale.mjs / wp12 smoke edits; HUD, title, desktop, persistence, technologies/balance, art.
- WP18 debugHook additions, PROJECT_STATUS.md (Director), demo edition (WP21), release verification (WP16).
