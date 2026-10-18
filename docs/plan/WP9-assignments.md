# WP9 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP9.md` (contracts C1–C4, tasks T1–T9) + `docs/plan/ART_ERA3.md` (art contract; planner A1/A2; Director CR-A, CR-B) + real code read at HEAD `25a7303`. Workers are `implementation-worker` agents (Haiku).
Goal: Era III (Thermal / Pressure, resource PR) playable `substationBlueprint` -> `pressureVesselBlueprint`: 9 techs, `offlineHours` effect, 16 machine parts on the delivered PNGs, `pipe` links with via points, `thermal` driver, reciprocate / spin / gauge animations, world-space steam FX, turbine -> pylon cable (CR-A), milestone whistle burst (CR-B), boiler / hiss / whistle audio, logs, plaque.
Baseline measured by the EM: `npx tsc --noEmit` clean, `npx vitest run` = **908 tests / 41 files green** (the working tree contains uncommitted Art Director Era II edits in `src/data/*`, `src/ui/*.css`).
Art: all 19 PNGs exist and were re-verified with `file` (sizes in T3). **Workers never touch `public/**`.** No new fallback painters.

## How the Director uses this file

For every worker: spawn `implementation-worker`, paste **(1) the "Common preamble"** (the fenced block) then **(2) exactly one assignment block**. Same-wave workers run in parallel (max 4). Between waves run the wave's tests (`npx vitest run <files>`) and `npx tsc --noEmit`, compare errors against the transient table, then start the next wave.

| Wave | Ids | Workers |
|---|---|---|
| 1 | **T1** Era III data + logs + plaque, **T2** offline-cap effect, **T9** smoke scripts | 3 |
| 2 | **T3** machine + asset + palette + world + steamFx data, **T4** Era III balance sim + save/startup tests, **T5a** animation + pipe maths, **T5b** FX + pylon maths | 4 |
| 3 | **T6** Era III audio, **T7** machine rendering (animator, view, pipes), **T8** steam FX + pylon feeds wiring | 3 |
| 4 | EM Mode B (validate, one-line glue), Director smoke tests | — |

Dependencies: T2 none (injected tables). T9 none. T3 needs T1 (tech ids). T4 needs T1 (and T2 for the startup test). T5a needs T3 types (same wave, contract-first). T5b needs T3 `data/steamFx.ts` types (same wave, `import type` only). T6 needs T1. T7 needs T3, T5a. T8 needs T3, T5b and codes against T7's `getHammerStrikes()` (same wave).

### Expected transient tsc errors (not a worker fault)

| After | Allowed to fail typecheck | Runtime-only (typecheck clean) |
|---|---|---|
| W1 | inside the wave only: `src/simulation/progression/status.ts` (`describeEffect` switch, TS2366 / TS2678) and `src/simulation/production/rates.ts` until T1 (Effect variant) and T2 (cases) both land. End of W1: none. | none |
| W2 | inside the wave only: `src/game/math/animation.ts` TS2366 (`driverValue` switch loses its exhaustive return after T3 adds `'thermal'`) until T5a lands; `src/game/math/steamFx.ts` unresolved `import type` of `../../data/steamFx` until T3 lands. End of W2: none. | dev build: pipes not drawn (no pipe branch yet), rotor / ram / gauge / fire frames static, no steam FX, no turbine pylon cable, no era III audio; all 16 parts show. Fixed in W3. |
| W3 | inside the wave only: `src/game/scenes/WorldScene.ts` (`getHammerStrikes` missing) until T7 lands. End of W3: `npx tsc --noEmit`, `npm test`, `npm run build` clean. | none |

Any tsc error outside those rows (and outside the files of the running wave) is a real bug. Workers run only their own tests; foreign tsc errors go in NOTES.

## Decisions / deviations from `WP9.md` (deliberate, EM)

1. **Offline-cap test arithmetic corrected.** `computeOffline` uses `min(elapsed, cap)`. With `reliefValves` owned a **10 h** gap is NOT capped (`cappedSeconds` 36000, was 28800). The cap shows at a gap **> 12 h**: use a **14 h** gap -> `elapsedSeconds` 50400, `cappedSeconds` 43200. The welcome text "Buffer capped at 12h" appears only for such a gap. The WP9.md text "10 h gap -> capped 12 h" is wrong; this file wins.
2. **`startup.test.ts` moves from T2 to T4** (it needs the real era III table that T1 lands in the same wave as T2). T2 tests use injected tables only.
3. **Pipe fitting colours live in data** (rule: no `0x` literals under `src/game`): `MACHINE_LINK_STYLE.pipe.steam` and `.water` each get `fitting: { ink: 0x14110f, hi: 0x7d8286, mid: 0x5a5f63, lo: 0x3e4246 }` (ART_ERA3 §4 constants). `PipeStyleLike` therefore has a `fitting` field. `rasterPipe` returns **runs** for pipe bodies and 1x1 rects for flanges and fittings, in draw order (a later rect overwrites an earlier one); tests expand to a pixel map.
4. **`STEAM_FX.purchaseBurstDelayMs: 700`** (= `MACHINE_ASSEMBLY.durationMs`) so the purchase burst waits for the valve to land. **`AUDIO.whistle.techId: 'pressureVesselBlueprint'`** so no tech id literal sits in `src/audio` logic.
5. **`nearestPylonAnchor` side semantics.** `side` undefined or `'any'` = today's behaviour (only anchors right of `from`; existing tests stay green). `'left'` = only anchors with world x < `from.x`. `PylonFeed.side: 'any'` therefore means "right of the part" (the mast).
6. **`PylonLine` constructor** becomes `(scene, techLevels, feed: PylonFeed, componentAssembling?: () => boolean)`. WorldScene builds one per `PYLON_FEEDS`.
7. **Tech names / texts** (not in WP9.md): names must fit the tree node (<= 19 chars at `.88em`), so `pressureVesselBlueprint` is named **Vessel Blueprint**. All texts are in T1.
8. **Hammer API:** `MachineAnimator.consumeStrikes(): number` (strikes since the last call) and `MachineView.getHammerStrikes(): number` (monotonic since the last session reset).
9. **Gauge low-pass starts at 0** (state per component, cleared on reset): the needle sweeps up after a load. Accepted.
10. **Emitters are gated by tech + driver only**, not by the part's assembly tween (the chimney may smoke ~0.7 s before the boiler lands). Accepted.
11. **Tree width:** the era III tab is 7 columns = 1560 px > the 1180 px panel; `.tech-graph` already has `overflow: auto` (thin scrollbar). No CSS change (CSS is off limits). The Director checks that keyboard focus scrolls into view.
12. **T7 has no unit tests** (Phaser classes). Its acceptance is typecheck + Director smoke. Pure logic was pushed into T5a / T5b for that reason.
13. **Hammer blow rate (risk, not changed):** `hammerRam` ratio 1 on thetaM; one blow per 360 deg of thetaM. Idle drift is 20–240 deg/s so blows are 1.5–18 s apart; a click adds ~51 deg. Visible but sparse; if the Director wants more, raise `ratio` in `machineComponents.ts` (tunable, the tests only check ratio > 0).

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP9: Era III (Thermal / Pressure, resource PR). Era I + II must behave EXACTLY as before: numbers, greedy times (era I: gearRatio 4, wornMotor 13, motorTuning 20, reinforcedCrank 196, flywheel 289, pistonArray 722, improvedPistons 758, generatorBlueprint 1326 s; era II windows generator 1500-2100, substationBlueprint 3300-4500), pixels and strings.
Baseline: typecheck clean, 908 tests / 41 files green.

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, anything under public/, or ANY src/**/*.css.
- CONCURRENCY WITH THE ART DIRECTOR: an Art Director review of Era II may edit src/data/*.ts NUMBERS and src/ui/*.css while you work.
  Re-read every file RIGHT BEFORE you edit it (and again before your final validation). Keep edits SURGICAL (Edit tool with small unique anchors; never rewrite a whole file
  from memory). Never revert or "fix" a foreign change. Never touch era I / era II rows, ids or numbers. If a foreign edit makes your test fail, report it in NOTES.
- PURE (no 'phaser' import, no window/document/AudioContext): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**, src/ui/*View.ts, src/ui/*Rules.ts, src/audio/audioMath.ts.
  `import Phaser from 'phaser'` only in src/game/{entities,rendering,scenes}, src/assets/fallbackTextures.ts, src/assets/painters/painterTypes.ts (type use only).
- All balancing / tuning numbers live in src/data/. No 0x...... colour literals under src/game, src/ui, src/audio (colours come from PALETTE / MACHINE_LINK_STYLE).
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined values in src (a `!` in tests after an asserted lookup is fine).
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM, no Phaser at runtime), `*.test.ts` next to the code, `toBeCloseTo(x, 9)` for floats, avoid -0 in expectations
  (normalise -0 to 0 in code that returns numbers). Keep every existing test's intent: update to the new shape, never delete coverage.
- Other workers edit OTHER files concurrently or in earlier waves. `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list foreign errors in NOTES. Run only your own tests (plus the named regression runs).
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src (console.warn / info only where the file already does so).
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== FINAL CONTRACTS (exact; every worker codes against these; they are the source of truth) ===

// ---- C1 Tech data: src/data/types.ts, src/data/technologies.ts, notifications.ts, systemLogs.ts, story.ts (T1) ----
TECH_IDS += 'boiler','firebox','inductionHeater','steamHammer','superheater','condenser','turbine','reliefValves','pressureVesselBlueprint'   // append only, this order
Effect |= { type: 'offlineHours'; hours: number }    // adds hours*level to the offline cap; no rate / click effect
Era III rows (era 3 for all):
| id | name | kind | branch | costRes | baseCost | growth | maxLevel | effects | requires (in order) | tree col,row |
| boiler | Boiler | unlock | convergence | ee | 1000000 | null | null | [{type:'convert',amount:0.3,res:'pr'}] | [tech substationBlueprint 1] | 0,1 |
| firebox | Firebox | repeatable | mechanical | pr | 1000 | 1.3 | 25 | [{type:'convert',amount:0.15,res:'pr'}] | [tech boiler 1] | 1,0 |
| inductionHeater | Induction Heater | repeatable | automation | ee | 300000 | 1.35 | 20 | [{type:'autoAdd',amount:5,res:'pr'}] | [tech boiler 1] | 1,2 |
| steamHammer | Steam Hammer | unlock | origin | pr | 10000 | null | null | [{type:'clickEcho',seconds:1,res:'pr'}] | [tech firebox 3] | 2,0 |
| superheater | Superheater | unlock | mechanical | pr | 40000 | null | null | [{type:'rateMult',factor:2,res:'pr'}] | [tech firebox 5] | 2,1 |
| condenser | Condenser | repeatable | mechanical | pr | 60000 | 1.3 | 20 | [{type:'autoPct',percent:15,res:'pr'}] | [tech superheater 1] | 3,1 |
| turbine | Turbine | unlock | automation | pr | 300000 | null | null | [{type:'rateMult',factor:2,res:'ee'}] | [tech condenser 3] | 4,1 |
| reliefValves | Relief Valves | unlock | automation | pr | 800000 | null | null | [{type:'offlineHours',hours:4}] | [tech steamHammer 1, tech turbine 1] | 5,0 |
| pressureVesselBlueprint | Vessel Blueprint | milestone | convergence | pr | 0 | null | null | [{type:'none'}] | [tech reliefValves 1, tech condenser 5, lifetime pr 6000000] | 6,1 |
Save: additive tech keys, missing keys default 0 (readTechLevels) -> NO save version bump.

// ---- C2 Offline cap (src/simulation/production/tick.ts, progression/status.ts, production/rates.ts) (T2) ----
export function offlineCapSeconds(techLevels: Readonly<Record<TechId, number>>, techs: Record<TechId, TechDefinition> = TECHNOLOGIES): number
  // OFFLINE_CAP_SECONDS + 3600 * sum(hours * level) over 'offlineHours' effects of techs with level > 0 (iterate TECH_IDS)
applyOffline(state, nowMs, techs)  // passes offlineCapSeconds(state.techLevels, techs) to computeOffline; signatures of applyOffline / computeOffline UNCHANGED
describeEffect({ type: 'offlineHours', hours }, n) === "+" + fmt(hours * n) + "h offline buffer"     // fmt = the existing helper in status.ts
computeRates ignores 'offlineHours' (explicit `case 'offlineHours': break;`)

// ---- C3 Machine + asset contract (src/data/machineComponents.ts, palette.ts, world.ts, steamFx.ts (new); src/assets/{assetIds,manifest}.ts) (T3) ----
type AnimationDriver = 'manual' | 'automation' | 'combined' | 'electric' | 'thermal';   // thermal = rates.perSecond.pr
ComponentAnimation |=
  | { kind: 'reciprocate'; ratio: number; strokeArtPx: number; phaseDeg: number }       // sprite y offset = -(stroke/2)(1 + cos(ratio * thetaM + phase)); 0 = strike
  | { kind: 'spin'; driver: AnimationDriver; speed: SpeedCurve }                          // own angle += speed(driver)*dt, not tied to thetaM; RotSprite frames
  | { kind: 'gauge'; driver: AnimationDriver; frames: number; minLog: number; maxLog: number; tauSeconds: number }   // frames sheet, no rotation
ConnectionPoint.kind: 'belt' | 'pin' | 'cable' | 'pipe';   MachineLink.kind: 'belt' | 'rod' | 'cable' | 'pipe';
MachineLink += { via?: Vec2[]; bore?: 4 | 2; depth?: number; pipeStyle?: 'steam' | 'water' }   // pipe only. via = ABSOLUTE machine-local corners. depth default MACHINE_LINK_STYLE.pipe.depth
MACHINE_BOUNDS = { left: -448, right: 448, top: -248, bottom: 8 }
MACHINE_LINK_STYLE.pipe = { depth: MACHINE_LAYER_DEPTH.frame + 5,
  steam: { prof: [0x7d8286, 0x5a5f63, 0x3e4246, 0x1f2225],
           flange: [[0x14110f,0xa3a6a4,0x7d8286,0x5a5f63,0x3e4246,0x14110f],[0x14110f,0x7d8286,0x5a5f63,0x3e4246,0x2b2e31,0x14110f]], flangeEvery: 24,
           fitting: { ink: 0x14110f, hi: 0x7d8286, mid: 0x5a5f63, lo: 0x3e4246 } },
  water: { prof: [0x5a5f63, 0x2b2e31], flange: [[0x14110f,0x7d8286,0x3e4246,0x14110f],[0x14110f,0x5a5f63,0x2b2e31,0x14110f]], flangeEvery: 24,
           fitting: { ink: 0x14110f, hi: 0x7d8286, mid: 0x5a5f63, lo: 0x3e4246 } } }
PALETTE += emberDark 0x6a2418, ember 0xb8402a, steam 0xe8e0cc   (PALETTE_CSS gets the same three keys)
// AMENDMENT A1: spin speed uses the existing animationSpeed formula base*(1 + gain*log10(1 + v)), so the rotor (ART_ERA3 had base 0, which never moves) is:
turbineRotor.animation = { kind: 'spin', driver: 'thermal', speed: { base: 60, gain: 1.5, min: 0, max: 540 } }
// AMENDMENT A2: 'gauge' / 'frames' / 'reciprocate' need no SpeedCurve; the "every speed curve has min <= max and base > 0" invariant covers vibrate + spin only.
export interface PylonFeed { id: string; component: MachineComponentId; point: string; side: 'any' | 'left'; gate?: { techId: TechId; minLevel: number } }
export const PYLON_FEEDS: readonly PylonFeed[] = [                       // src/data/world.ts (CR-A)
  { id: 'mast', component: 'cableMast', point: 'top', side: 'any' },
  { id: 'turbine', component: 'turbine', point: 'export', side: 'left', gate: { techId: 'turbine', minLevel: 1 } } ];
New component ids (MACHINE_COMPONENT_IDS append, this order; 29 -> 45): boiler chimney steamManifold pressureGauge gaugeNeedle fireboxGlow1 fireboxGlow2 fireboxGlow3
  inductionHeater superheater reliefValves steamHammer hammerRam condenser turbine turbineRotor
New asset ids (ASSET_IDS append after 'machine.cableMast', this order; +18): 'machine.boiler','machine.chimney','machine.steamManifold','machine.gauge','machine.gaugeNeedle',
  'machine.fireGlow1','machine.fireGlow2','machine.fireGlow3','machine.inductionHeater','machine.superheater','machine.reliefValves','machine.steamHammer','machine.hammerRam',
  'machine.condenser','machine.turbine','machine.turbineRotor','fx.steamPuff','fx.smoke'
Sheets: manifest width / height = WHOLE image, `frame` = one cell; component `size` = the cell (or the image for non-sheets).
src/data/steamFx.ts (pure data):
  export type EmitterMode = { kind: 'rate'; base: number; perLog: number; min: number; max: number }                     // puffs/s = clamp(base + perLog*log10(1+v), min, max)
    | { kind: 'burst'; count: number; spacingMs: number; everyMinS: number; everyMaxS: number; minDriver: number }       // + one burst on purchase of the gate tech
    | { kind: 'strike' };                                                                                                // one puff per hammer strike
  export interface SteamEmitter { id: string; assetId: 'fx.steamPuff' | 'fx.smoke'; at: Vec2[]; gate: { techId: TechId; minLevel: number };
    driver: AnimationDriver; threshold: number; mode: EmitterMode }
  STEAM_EMITTERS (this order): chimney: fx.smoke at (-293,-240) gate boiler 1, driver thermal, threshold 0, rate {base 0.4, perLog 0.3, min 0.4, max 2}
    relief: fx.steamPuff at (-218,-94),(-211,-94) gate reliefValves 1, thermal, threshold 0, burst {count 4, spacingMs 120, everyMinS 6, everyMaxS 9, minDriver 50}
    hammer: fx.steamPuff at (-334,-98) gate steamHammer 1, thermal, threshold 0, strike
    manifold: fx.steamPuff at (-72,-182),(-44,-182),(-16,-182) gate boiler 1, driver automation, threshold 5, rate {base 0.3, perLog 0.2, min 0.3, max 1.5}
  export const STEAM_FX = { poolSize: 48, lifeMs: 1200, frames: 4, riseArtPx: 12, driftArtPxPerS: 4, scaleFrom: 1, scaleTo: 1.5, fadeFrom: 0.75, depth: DEPTH.machine + 1, purchaseBurstDelayMs: 700 }
  export const HAMMER_FX = { maxDegPerSec: 1080, midOffsetArtPx: -7, dustPuffs: 3, dustSpreadArtPx: 3, dustAt: { x: -334, y: -22 } }
  export const MILESTONE_BURST = { techId: 'pressureVesselBlueprint', emitter: 'relief', count: 4 }                    // CR-B

// ---- C4 Pure maths ----
src/game/math/animation.ts (T5a):
  driverValue(driver, manual, automation, electric = 0, thermal = 0): number                  // 'thermal' -> thermal; existing 3 / 4-arg calls unchanged
  reciprocateOffset(masterDeg, ratio, strokeArtPx, phaseDeg): number                           // round(-(stroke/2) * (1 + cos(rad(ratio*masterDeg + phaseDeg)))); 0 = strike (theta = 180 deg); never -0
  strikeCount(prevDeg, nextDeg, ratio, phaseDeg): number                                       // |floor((b-180)/360) - floor((a-180)/360)| with a = ratio*prev+phase, b = ratio*next+phase; non-finite -> 0
  gaugeFrame(v, frames, minLog, maxLog): number                                                // round(clamp01((log10(1+v)-minLog)/(maxLog-minLog)) * (frames-1)); non-finite / negative v, frames < 2, maxLog <= minLog -> 0
  lowPass(prev, target, dtSeconds, tauSeconds): number                                         // prev + (target-prev)*(1-exp(-dt/tau)); dt <= 0 or non-finite -> prev; tau <= 0 -> target
  spinStep(angleDeg, degPerSec, dtSeconds): number                                             // wrap(angle + degPerSec*dt) into [0,360), never -0; non-finite step -> wrap(angle)
src/game/math/machineLinks.ts (T5a):
  export interface PipeStyleLike { prof: readonly number[]; flange: readonly (readonly number[])[]; flangeEvery: number; fitting: { ink: number; hi: number; mid: number; lo: number } }
  export interface PipeRect { color: number; x: number; y: number; w: number; h: number }
  export function rasterPipe(points: readonly Vec2[], style: PipeStyleLike): PipeRect[]       // exact algorithm in T5a; throws Error on a non-axis-aligned consecutive pair
src/game/math/steamFx.ts (T5b, new):
  emitterRate(mode: EmitterMode, v: number): number                                            // 'rate' -> clamp(base + perLog*log10(1+max(0,v)), min, max); burst / strike -> 0; non-finite v -> treated as 0
  stepEmitter(acc: number, ratePerS: number, dtSeconds: number): { acc: number; spawn: number } // acc' = acc + rate*dt; spawn = floor(acc' + 1e-9); acc'' = acc' - spawn; rate <= 0 or dt <= 0 -> { acc, spawn: 0 }
  burstDelaySeconds(index: number, minS: number, maxS: number): number                         // minS + (maxS-minS) * hash01(index); hash01(i) = f - floor(f), f = sin(i*12.9898 + 78.233) * 43758.5453; deterministic
  puffState(ageMs: number, fx: PuffFx): { frame: number; dx: number; dy: number; scale: number; alpha: number; done: boolean }
     // PuffFx = structural type { lifeMs; frames; riseArtPx; driftArtPxPerS; scaleFrom; scaleTo; fadeFrom }; t = clamp01(age/life); frame = min(frames-1, floor(t*frames));
     // dy = -riseArtPx*t; dx = driftArtPxPerS*age/1000; scale = lerp(scaleFrom, scaleTo, t); alpha = t < fadeFrom ? 1 : 1 - (t-fadeFrom)/(1-fadeFrom); done = age >= lifeMs; negative / NaN age -> age 0
src/game/math/pylonLine.ts (T5b): PylonAnchorInput += side?: 'any' | 'left'   // undefined / 'any' = legacy (anchors right of `from` only); 'left' = only anchors with world x < from.x; none -> null
src/game/entities/MachineAnimator.ts (T7): consumeStrikes(): number     src/game/entities/MachineView.ts (T7): getHammerStrikes(): number
src/game/rendering/PylonLine.ts (T8): constructor(scene, techLevels, feed: PylonFeed, componentAssembling: () => boolean = () => false); update(camera, techLevels, deltaMs); destroy()
src/game/rendering/SteamFx.ts (T8, new): constructor(scene: Phaser.Scene, session: GameSession, getMachine: () => MachineView | null); update(deltaMs: number): void; destroy(): void
src/data/audio.ts (T6) additions:
   boiler: { lowpassHz: 160, minGain: 0.03, maxGain: 0.14, refPerSecond: 1, maxPerSecond: 100000 }
   hiss: { ms: 260, gain: 0.3, highpassHz: 2600 }
   whistle: { hzA: 880, hzB: 1175, ms: 1100, attackMs: 90, gain: 0.2, techId: 'pressureVesselBlueprint' }
src/audio/audioMath.ts (T6): boilerGain(prPerSecond: number, boilerOwned: boolean, cfg = AUDIO.boiler): number   // 0 when !boilerOwned or !(pr > 0), else lerp(minGain, maxGain, activityLevel(pr, ref, max))
src/audio/synth.ts (T6): Synth += setBoiler(gain: number): void; playHiss(): void; playWhistle(delaySeconds?: number): void
```

---

# WAVE 1 (parallel: T1, T2, T9 — disjoint files; repo green at start)

## T1 — Era III data, logs, plaque, install lines

**wave**: 1. **files_owned**: `src/data/types.ts`, `src/data/technologies.ts`, `src/data/technologies.test.ts`, `src/data/notifications.ts`, `src/data/systemLogs.ts`, `src/data/story.ts`, `src/simulation/state.test.ts`, `src/ui/systemLogRules.test.ts`, `src/ui/techTreeView.test.ts`, `src/ui/hudView.test.ts` (only if a count / tab assumption breaks it)

**objective**: land the C1 table and story data; era I / II rows untouched; fix the foreign tests that hard-code counts.

**context**: read all files first (re-read right before editing: the Art Director may be editing numbers in `technologies.ts`).
- `types.ts`: append the nine ids to `TECH_IDS`; add the `offlineHours` variant to `Effect` (trailing comment `// adds hours * level to the offline cap`). Nothing else.
- `technologies.ts`: append nine definitions after `substationBlueprint` (keys in TECH_IDS order) per C1 (`era: 3`). Texts (use exactly):
  - boiler: description `A sealed drum over a flame. Converts EE into pressure.`, flavor `Pressure detected. Vessel rating: unlisted.`
  - firebox: `Fuel the fire. More PR from the same current.`
  - inductionHeater: `Current turned to heat. +5 PR/s per level.`
  - steamHammer: `A ram on the main shaft. Clicks echo pressure.`
  - superheater: `Steam heated past its rating. Doubles PR production.`
  - condenser: `Returns the water. +15% PR production per level.`
  - turbine: `Steam spins a wheel. Doubles EE production.`
  - reliefValves: `Vents what the vessel cannot hold. +4h offline buffer.`
  - pressureVesselBlueprint: description `The machine now resembles something that holds pressure.`, flavor `Containment rating exceeded by design.`
- `notifications.ts`: nine `INSTALL_LINES` entries (<= 60 chars; those with a flavor are IDENTICAL to it): boiler `Pressure detected. Vessel rating: unlisted.` · firebox `Fuel source not on the manifest. Burning anyway.` · inductionHeater `Current turned to heat. Heat did not object.` · steamHammer `Impact logged. Target: the ground.` · superheater `Steam exceeds the temperature it was asked for.` · condenser `Water returned. Some of it was not ours.` · turbine `Output sent back up the line. Line accepted.` · reliefValves `Relief valves fitted. Relief not expected.` · pressureVesselBlueprint `Containment rating exceeded by design.`
- `systemLogs.ts`: append two entries at the END of `SYSTEM_LOGS`: id `pressure-rising`, text `Pressure rising. Safe limit field left blank.`, trigger `{ kind: 'lifetime', res: 'pr', atLeast: 1000 }`; id `steam-rain`, text `Steam tastes of rain. Logged as error.`, trigger `{ kind: 'lifetime', res: 'pr', atLeast: 1000000 }`.
- `story.ts`: append `{ milestone: 'pressureVesselBlueprint', text: 'PRIMARY FUNCTION: REST?RE' }` to `PLAQUE_LINES` (last).
- `state.test.ts`: fix any hard-coded 18 / tech-count assumption (use `TECH_IDS.length`).
- `systemLogRules.test.ts`: table-size window becomes 8..14 entries (title updated). Every place that seeds lifetime for the "ahead" cases (the `ee: 1e9` additions from WP8) also gets `pr: 1e9` so `shown.size === SYSTEM_LOGS.length` / "never repeats over 50 calls" still hold (14 entries <= 50). The "never marks a lifetime-ME entry from non-ME lifetime alone" test derives its expected size from the table (entries whose trigger is `lifetime` on `ee` / `pr` / `rs` / `xf`). Keep all other cases.
- `techTreeView.test.ts`: real-data tab assertions that expect `[1, 2]` become `[1, 2, 3]` (derive from the data where possible). `hudView.test.ts`: touch only if broken.
- `technologies.test.ts`: `TECH_LIST toHaveLength(27)`; keep all old tests; add: (1) era III table exact, a literal table (id -> kind, era, costRes, baseCost, growth, maxLevel, tree, branch, effects, requires) equal to C1; (2) every tech reachable from `handCrank` (the existing BFS test must cover 27); (3) tree positions unique per era (the existing test covers era 3); (4) `costRes` `pr` only on era III, `ee` on eras II and III; (5) names <= 19 chars for every tech; (6) `PLAQUE_LINES` has four entries in order with exact texts (null / generatorBlueprint / substationBlueprint / pressureVesselBlueprint); (7) `offlineHours` appears exactly once in the table (`reliefValves`, hours 4); (8) INSTALL_LINES has a line for every tech id, unique, <= 60 chars, boiler and pressureVesselBlueprint lines equal their flavors; (9) the two new log entries exist at the end with exact ids / thresholds.

**constraints**: pure data; no Phaser / DOM; no `any`; do not edit balance.ts or any other file. `git diff` of `technologies.ts` must show only additions from you (any Art Director hunk stays).

**acceptance**: C1 table exact; 27 techs; prerequisite graph acyclic; every tech reachable; unique tree pos per era; INSTALL_LINES complete; 2 logs; plaque line; Effect variant added.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation/state.test.ts src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/data|^src/ui|^src/simulation/state" && echo FAIL || echo OK     # status.ts / rates.ts may fail until T2: ignore
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/types.ts src/data/technologies.ts src/data/notifications.ts src/data/systemLogs.ts src/data/story.ts && echo FAIL || echo OK
git diff -U0 -- src/data/technologies.ts | grep -E "^-[^-]" && echo CHECK_REMOVED_LINES || echo ONLY_ADDITIONS
npx vitest run 2>&1 | tail -6     # list failing files that are NOT yours in NOTES
```

## T2 — Offline-cap effect

**wave**: 1. **files_owned**: `src/simulation/production/tick.ts`, `src/simulation/production/tick.test.ts`, `src/simulation/production/rates.ts`, `src/simulation/production/rates.test.ts`, `src/simulation/progression/status.ts`, `src/simulation/progression/progression.test.ts`

**objective**: C2 exactly. Defaults keep every existing call site compiling and behaving identically.

**context**: read the six files plus `src/data/balance.ts` (`OFFLINE_CAP_SECONDS` 28800) and `src/simulation/GameSession.ts` (NOT yours, NOT changed: its `applyOffline` calls the tick `applyOffline` with the default table, so the new cap flows through).
- `tick.ts`: add and export `offlineCapSeconds` (import `TECH_IDS` from `../../data/types`). `applyOffline` computes `offlineCapSeconds(state.techLevels, techs)` and passes it to `computeOffline` instead of the constant. `computeOffline` and its default param are unchanged. Comment lines in the file's style.
- `rates.ts`: add `case 'offlineHours': break;` in the effect switch and extend the header comment (offlineHours = offline cap only, no rate).
- `status.ts`: `describeEffect` gets a `case 'offlineHours'` returning the text `+<fmt(hours*n)>h offline buffer` (a template string using the existing `fmt` helper). The `Effect` variant is added by T1 in parallel; type errors about the unknown variant vanish when T1 lands.
- Tests use INJECTED tech tables only (spread `TECHNOLOGIES`, override one tech's `effects` with `[{ type: 'offlineHours', hours: 4 }]`); do not depend on the real era III rows.

**acceptance** (tests):
- `tick.test.ts`: `offlineCapSeconds` = 28800 with no effect tech owned; 43200 with the injected `hours 4` tech at level 1; level 0 ignored; a repeatable injected tech (level 3, hours 1) gives 28800 + 3*3600; two effect techs add. `applyOffline` with the injected table and a **10 h** gap: `elapsedSeconds` 36000 and `cappedSeconds` 36000 (not capped, more than the old 28800); with a **14 h** gap `elapsedSeconds` 50400 and `cappedSeconds` 43200; without the effect a 10 h gap still gives `cappedSeconds` 28800 (regression). `computeOffline` default cap unchanged.
- `rates.test.ts`: `computeRates` with the injected effect tech owned equals `computeRates` with the effect removed (perClick and perSecond deep-equal).
- `progression.test.ts`: `describeEffect({ type: 'offlineHours', hours: 4 }, 1) === '+4h offline buffer'`, `n = 3` -> `'+12h offline buffer'`, `hours 0.5, n = 1` -> `'+0.5h offline buffer'`.
- Every existing test green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation
npx tsc --noEmit 2>&1 | grep -E "^src/simulation" && echo FAIL || echo OK     # unknown-variant errors vanish once T1 landed
grep -nE "from ['\"](phaser|vitest)['\"]|\b(window|document)\b|console\.|\bany\b" src/simulation/production/tick.ts src/simulation/production/rates.ts src/simulation/progression/status.ts && echo FAIL || echo OK
git diff --stat -- src/simulation/GameSession.ts     # must be empty
```

## T9 — Stage + tree smoke scripts

**wave**: 1. **files_owned**: `scripts/smoke/stages.mjs`, `scripts/smoke/wp3-techtree.mjs`, `scripts/smoke/README.md`

**objective**: smoke stages for Era III and a tree smoke that tolerates three tabs. Tech ids are plain strings (the real techs land in the same wave).

**context**: read the three files, `scripts/smoke/wp2-crank.mjs` (style only), `src/game/debugHook.ts` (read only: `window.__wedtmd.componentState(id)`, `cameraState()`, `session`).
- `stages.mjs`: s0–s9 keep behaving exactly as today. Generalise the marker: a buy-list entry `'@<techId>'` jumps `t += 8 h; s.update(t)` up to **8** times until `s.state.techLevels[<techId>] === 1` and records `'@<techId>:true|false'`; `'@blueprint'` stays as an alias of `'@generatorBlueprint'`. Normal ids keep the existing "jump before each buy once wornMotor is owned" and the 6-retry rule. Add stages (keep `S7` and the s9 list as named constants so they can be reused):
  - `s10_boiler`: `[...S9, '@substationBlueprint', 'boiler']` where `S9` is the existing s9 buy list.
  - `s11_era3_full`: `[...S10, ...Array(3).fill('inductionHeater'), ...Array(20).fill('firebox'), 'steamHammer', 'superheater', ...Array(5).fill('condenser'), 'turbine', 'reliefValves', '@pressureVesselBlueprint']` where `S10` is the s10 list.
  - After the existing camera line, for EVERY stage also print `console.log(name, 'plaque', JSON.stringify(await p.$eval('#hud-plaque', e => e.textContent.trim()).catch(() => null)))`, and for `s10_boiler` and `s11_era3_full` print `console.log(name, 'parts', JSON.stringify(...))` = an object over the 16 new ids (`boiler, chimney, steamManifold, pressureGauge, gaugeNeedle, fireboxGlow1, fireboxGlow2, fireboxGlow3, inductionHeater, superheater, reliefValves, steamHammer, hammerRam, condenser, turbine, turbineRotor`) mapping id -> `componentState(id)?.visible ?? null` (evaluated in the page).
  - `nframes` (argv 4) / `FRAME_MS` / `ONLY` / the final `errors` JSON line unchanged.
- `wp3-techtree.mjs`: keep every existing check and key. `9_tabs` / `10_tabs` already read all `.tech-tab` buttons, so a third tab just appears (ERA III `SIGNAL ?`, disabled) — add `res['9_tabCount']` and `res['10_tabCount']` (number of tabs). Then append (before `res.errors`): fast-forward to Era III inside one `page.evaluate` using the s9 list + `'@substationBlueprint'` (same jump / retry rules as `stages.mjs`), reopen the tree via `#hud-tech`, record `11_tabs` (same shape as `10_tabs`; expect ERA II and ERA III enabled, ERA III text starting `ERA III`), click `#tech-tab-3`, record `11_header` (`#tech-me`, expect it ends `PR`), `11_nodes` (visible `.tech-node` count, expect 9), `11_boiler` (class list of `[data-tech=boiler]`); `Escape` to close. Do not assert; just record with `ok(...)`.
- `README.md`: add s10 / s11 to the stage list text and one line explaining `@<techId>` markers.

**constraints**: `.mjs` only, no new dependencies; do not edit any `src/` file.

**acceptance**: `node --check` passes for both scripts; s0–s9 code paths unchanged in behaviour; `@blueprint` alias works; new stage names exactly `s10_boiler`, `s11_era3_full`; new result keys exactly as above. (Browser runs are done by the Director.)

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
node --check scripts/smoke/stages.mjs && node --check scripts/smoke/wp3-techtree.mjs && echo SYNTAX_OK
grep -n "s10_boiler\|s11_era3_full\|@blueprint\|'plaque'\|'parts'" scripts/smoke/stages.mjs
git diff --stat -- src     # must show no change by you
```

---
