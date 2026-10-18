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

# WAVE 2 (parallel: T3, T4, T5a, T5b — disjoint files; wave 1 done and green)

## T3 — Machine + asset + palette + world + steamFx contract data

**wave**: 2. **files_owned**: `src/data/machineComponents.ts`, `src/data/machineComponents.test.ts`, `src/data/palette.ts`, `src/data/palette.test.ts`, `src/data/world.ts`, `src/data/world.test.ts`, `src/data/steamFx.ts` (new), `src/data/steamFx.test.ts` (new), `src/assets/assetIds.ts`, `src/assets/manifest.ts`, `src/assets/manifest.test.ts`

**objective**: C3 exactly, data and tests only. Manifest points at the delivered PNGs. Era I / II component data byte-identical except `motorRetrofitKit` gains the `tie` connection.

**context**: read all files first; re-read right before each edit (the Art Director may touch `world.ts` / `machineComponents.ts` numbers). Do the TYPE edits in `machineComponents.ts` first (T5a / T5b rely on them).
1. `machineComponents.ts`
   - Types per C3 (`AnimationDriver` + `'thermal'`, three new `ComponentAnimation` kinds, `ConnectionPoint.kind` + `'pipe'`, `MachineLink` fields, `MachineLink.kind` + `'pipe'`, `MACHINE_BOUNDS`). Update the `AnimationDriver` comment (`thermal: PR/s`).
   - `SOCKET_IDS` append in this order and add to `MACHINE_SOCKETS`: boilerBase(-240,0) chimneyBase(-293,-78) superheaterSeat(-268,-73) reliefSeat(-214,-77) gaugeSeat(-192,-77) fireDoor(-196,-32) heaterSeat(-200,-36) hammerBase(-334,0) hammerTup(-334,-22) condenserBase(-402,0) turbineBase(-402,-24) turbineHub(-412,-54) manifoldSeat(-44,-168).
   - `MACHINE_COMPONENT_IDS` append the 16 ids; add the 16 definitions (columns: tech>=level · assetId · size · origin · socket (attach offset 0,0) · layer/depthBias ("-" = no bias) · animation · connections (offsets from the attach point); `effects: []` for all):

     | id | tech>=lvl | assetId | size | origin | socket | layer/bias | animation | connections |
     |---|---|---|---|---|---|---|---|---|
     | boiler | boiler>=1 | machine.boiler | 128x96 | .5,1 | boilerBase | mid/- | none | steam (-6,-91) pipe; feed (-64,-46) pipe |
     | chimney | boiler>=1 | machine.chimney | 32x160 | .5,1 | chimneyBase | mid/1 | none | - |
     | steamManifold | boiler>=1 | machine.steamManifold | 96x14 | .5,1 | manifoldSeat | back/2 | none | steam (-48,-8) pipe |
     | pressureGauge | boiler>=1 | machine.gauge | 24x24 | .5,1 | gaugeSeat | mid/2 | none | - |
     | gaugeNeedle | boiler>=1 | machine.gaugeNeedle | 24x24 | .5,1 | gaugeSeat | mid/3 | `{ kind: 'gauge', driver: 'thermal', frames: 25, minLog: 0, maxLog: 5, tauSeconds: 0.6 }` | - |
     | fireboxGlow1 | firebox>=1 | machine.fireGlow1 | 24x24 | .5,.5 | fireDoor | mid/2 | `{ kind: 'frames', frames: 4, maxHz: 3, driver: 'thermal' }` | - |
     | fireboxGlow2 | firebox>=10 | machine.fireGlow2 | 24x24 | .5,.5 | fireDoor | mid/3 | same frames animation | - |
     | fireboxGlow3 | firebox>=20 | machine.fireGlow3 | 24x24 | .5,.5 | fireDoor | mid/4 | same frames animation | - |
     | inductionHeater | inductionHeater>=1 | machine.inductionHeater | 56x40 | .5,1 | heaterSeat | mid/5 | none | tie (25,-38) cable |
     | superheater | superheater>=1 | machine.superheater | 40x32 | .5,1 | superheaterSeat | mid/2 | none | - |
     | reliefValves | reliefValves>=1 | machine.reliefValves | 16x24 | .5,1 | reliefSeat | mid/2 | none | - |
     | steamHammer | steamHammer>=1 | machine.steamHammer | 48x96 | .5,1 | hammerBase | mid/1 | none | steam (11,-79) pipe |
     | hammerRam | steamHammer>=1 | machine.hammerRam | 12x36 | .5,1 | hammerTup | mid/- | `{ kind: 'reciprocate', ratio: 1, strokeArtPx: 14, phaseDeg: 0 }` | - |
     | condenser | condenser>=1 | machine.condenser | 80x24 | .5,1 | condenserBase | mid/- | none | condensate (44,-3) pipe |
     | turbine | turbine>=1 | machine.turbine | 80x64 | .5,1 | turbineBase | mid/1 | none | steam (-10,-62) pipe; export (28,-46) cable |
     | turbineRotor | turbine>=1 | machine.turbineRotor | 28x28 | .5,.5 | turbineHub | mid/2 | `{ kind: 'spin', driver: 'thermal', speed: { base: 60, gain: 1.5, min: 0, max: 540 } }` | - |

     Add short comments in the file's style (era III block, A1 note on the rotor speed, "turbine.export is a world-space feed (PYLON_FEEDS), not a link").
   - `motorRetrofitKit.connections` gets `{ id: 'tie', at: { x: 0, y: -3 }, kind: 'cable' }` (its only change).
   - `MACHINE_LINKS` append in this order (12 links in total):
     P1 `{ from: boiler.steam, to: steamManifold.steam, kind: 'pipe', via: [(-246,-112), (-98,-112), (-98,-176)], bore: 4, pipeStyle: 'steam' }`;
     P2 `{ boiler.steam -> steamHammer.steam, kind: 'pipe', via: [(-246,-112), (-323,-112)], bore: 4, pipeStyle: 'steam' }`;
     P3 `{ boiler.steam -> turbine.steam, kind: 'pipe', via: [(-246,-112), (-412,-112)], bore: 4, pipeStyle: 'steam' }`;
     W1 `{ condenser.condensate -> boiler.feed, kind: 'pipe', via: [(-308,-3), (-308,-46)], bore: 2, depth: MACHINE_LAYER_DEPTH.mid - 1, pipeStyle: 'water' }`;
     C1 `{ motorRetrofitKit.tie -> inductionHeater.tie, kind: 'cable', sag: 3 }`.
     (`from` / `to` are `{ component, point }` objects as in the existing links.)
   - `MACHINE_LINK_STYLE.pipe` exactly as C3 (keep `as const`; `depth` uses `MACHINE_LAYER_DEPTH.frame + 5`).
   - `MACHINE_SHADOWS` append (height 2, y 0): boiler x -304 w 128; steamHammer x -358 w 48; condenser x -442 w 80 (7 shadows in total).
2. `palette.ts`: three keys in `PALETTE` and `PALETTE_CSS` (`css(...)`).
3. `world.ts`: `import type { MachineComponentId } from './machineComponents'` (type only); add and export `PylonFeed` and `PYLON_FEEDS` (C3) after `PYLON_LINE`. Nothing else.
4. `steamFx.ts` (new): types and consts exactly as C3 (`import type { Vec2, AnimationDriver } from './machineComponents'`, `import type { TechId } from './types'`, `import { DEPTH } from './world'`). `STEAM_EMITTERS` typed `readonly SteamEmitter[]`; `STEAM_FX` / `HAMMER_FX` / `MILESTONE_BURST` as `as const` or typed objects (your choice; the tests must compile).
5. `assetIds.ts`: append the 18 ids. `manifest.ts`: 18 entries (one-sentence `description` each, `tileable: 'none'`):

   | id | file (under public/assets/) | width x height | origin | frame / rotation |
   |---|---|---|---|---|
   | machine.boiler | machine/era3/boiler.png | 128x96 | .5,1 | - |
   | machine.chimney | machine/era3/chimney.png | 32x160 | .5,1 | - |
   | machine.steamManifold | machine/era3/steam-manifold.png | 96x14 | .5,1 | - |
   | machine.gauge | machine/era3/gauge.png | 24x24 | .5,1 | - |
   | machine.gaugeNeedle | machine/era3/gauge-needle.png | 600x24 | .5,1 | frame 24x24 count 25 |
   | machine.fireGlow1 / 2 / 3 | machine/era3/firebox-1.png / firebox-2.png / firebox-3.png | 96x24 | .5,.5 | frame 24x24 count 4 |
   | machine.inductionHeater | machine/era3/induction-heater.png | 56x40 | .5,1 | - |
   | machine.superheater | machine/era3/superheater.png | 40x32 | .5,1 | - |
   | machine.reliefValves | machine/era3/relief-valves.png | 16x24 | .5,1 | - |
   | machine.steamHammer | machine/era3/steam-hammer.png | 48x96 | .5,1 | - |
   | machine.hammerRam | machine/era3/hammer-ram.png | 12x36 | .5,1 | - |
   | machine.condenser | machine/era3/condenser.png | 80x24 | .5,1 | - |
   | machine.turbine | machine/era3/turbine.png | 80x64 | .5,1 | - |
   | machine.turbineRotor | machine/era3/turbine-rotor.png | 28x28 | .5,.5 | rotation `{ file: 'machine/era3/rot/turbine-rotor-rot.png', frames: 64 }` (sheet 224x224 = 8x8 cells of 28x28) |
   | fx.steamPuff | fx/steam-puff.png | 64x16 | .5,.5 | frame 16x16 count 4 |
   | fx.smoke | fx/smoke.png | 64x16 | .5,.5 | frame 16x16 count 4 |

   Verify every file exists: `file public/assets/<f>` shows the width x height above (do not edit `public/`).
6. Tests
   - `machineComponents.test.ts`: 45 components and 30 sockets; canonical order list extended (era I / II prefix unchanged); every box inside the new bounds (the generic test); every socket used; the era-I snapshot test unchanged. The "exactly three cable links" test becomes: exactly **four** cable links (the three era II ones + C1 `motorRetrofitKit.tie -> inductionHeater.tie` sag 3), each joins two `cable` points. **Pipe tests:** exactly four pipe links P1 P2 P3 W1; each joins two `pipe` points; each `bore` equals `MACHINE_LINK_STYLE.pipe[pipeStyle ?? 'steam'].prof.length`; the polyline `[from point (via `resolveConnectionPoint`), ...via, to point]` has every consecutive pair axis-aligned (dx === 0 or dy === 0, not both) and its ends equal the resolved endpoints (P1 from (-246,-91) to (-92,-176); P2 to (-323,-79); P3 to (-412,-86); W1 from (-358,-3) to (-304,-46)); W1 depth equals `MACHINE_LAYER_DEPTH.mid - 1` and every other pipe uses the default depth; both pipe styles have `fitting`. Generic tests extended: "every link endpoint references an existing component and connection point" (covers pipe), "belt / rod / cable / pipe links join matching point kinds", "every connection point appears in at least one link **except `turbine.export`**" (assert that exception explicitly and that `PYLON_FEEDS` references it), link techs ordered by requirement (existing generic test, transitive requires). Era III data: the 16 new components use the table techs / levels / assets / sizes / origins / sockets / layers / biases exactly (one table-driven test); `fireboxGlow1/2/3` share size, origin, attach and animation and have techs level 1 / 10 / 20; `turbineRotor` is `spin` thermal with base 60 gain 1.5 min 0 max 540; `hammerRam` is `reciprocate` ratio 1 stroke 14 phase 0 and its depth is below `steamHammer`'s; `gaugeNeedle` is `gauge` thermal frames 25 minLog 0 maxLog 5 tau 0.6 and its frames equal its manifest `frame.count`; fire frames equal their manifest frame count; the speed-curve invariant (A2) is extended to `spin` and skips frames / gauge / reciprocate; the 13 sockets match the contract coordinates; shadows: 7 in total, the three new ones exact; `motorRetrofitKit` equals the old definition plus the `tie` connection. An era III helper `levelsForEra3(prefix)` (all era I + II techs maxed, then boiler, firebox at 1 / 10 / 20 levels, inductionHeater, steamHammer, superheater, condenser, turbine, reliefValves) drives prefix tests: `fireboxGlow3 => fireboxGlow2 => fireboxGlow1`; `gaugeNeedle => pressureGauge`; `hammerRam => steamHammer`; `turbineRotor => turbine`; `turbine => condenser`; `inductionHeater => motorRetrofitKit`; `chimney`, `steamManifold`, `pressureGauge` visible exactly from boiler 1; every era III component visible at the full stage; every era I + II prefix test still green.
   - `palette.test.ts`: spot values for ember / emberDark / steam in `PALETTE` and `PALETTE_CSS`; keys equal.
   - `world.test.ts`: `PYLON_FEEDS` has two feeds, ids `mast` and `turbine`; the turbine feed has side `left` and gate turbine level 1, the mast has no gate; each feed's component and point exist; the machine fits the world: `MACHINE_ANCHOR.x + PIXEL_SCALE * MACHINE_BOUNDS.left >= 0` and `MACHINE_ANCHOR.y + PIXEL_SCALE * MACHINE_BOUNDS.top >= 0`; `MACHINE_BOUNDS` equals `{ left: -448, right: 448, top: -248, bottom: 8 }`; existing WP8 world tests untouched.
   - `steamFx.test.ts` (new): emitter ids unique and exactly `chimney, relief, hammer, manifold` in order; gates reference known techs with levels >= 1; every `at` point inside `MACHINE_BOUNDS`; exact values of C3 (spot-check every emitter's `mode`); rate modes have `min <= max` and `base >= min`; burst `everyMinS <= everyMaxS`, `count >= 1`; `MILESTONE_BURST.emitter` names a burst emitter, `MILESTONE_BURST.techId` is a `milestone` tech in `TECHNOLOGIES`; `STEAM_FX.frames` equals the manifest `frame.count` of `fx.steamPuff` and `fx.smoke`; `STEAM_FX.depth === DEPTH.machine + 1`; `fadeFrom` in (0,1); `lifeMs > 0`; `poolSize >= 16`; `purchaseBurstDelayMs === MACHINE_ASSEMBLY.durationMs`; `HAMMER_FX.dustAt` inside bounds and `HAMMER_FX.maxDegPerSec === 1080`.
   - `manifest.test.ts`: dims test (frame size == component size for sheets) covers the 16 new machine ids; contract-dimension test extended with the table above; the rotation ids are now the ten WP6 + WP8 ids plus `machine.turbineRotor` (**eleven**); the `#rot` url prefix check also accepts `assets/machine/era3/rot/`; the sheet entries (`machine.gaugeNeedle`, `fireGlow1/2/3`, `fx.steamPuff`, `fx.smoke`) plan as `spritesheet` with the right frame (extend the "loads exactly the file-backed entries as images" exclusion to every entry that has a `frame`); `sheetFrameRects`: `machine.gaugeNeedle` -> 25 rects at x 0..576 step 24, y 0, 24x24; `fx.steamPuff` -> 4 rects at x 0, 16, 32, 48, each 16x16; every new entry has a non-null file that exists on disk (existing glob test) and unique .png paths.

**constraints**: pure data; `import type` for types; do not edit era I / II values; no `any`.

**acceptance**: C3 + ART_ERA3 §4 / §5 exact (45 components, 30 sockets, 12 links, 7 shadows, bounds, pipe style, 18 asset ids with real files, `PYLON_FEEDS`, `steamFx.ts`); updated invariants pass; `npx tsc --noEmit` shows only the allowed `animation.ts` error (until T5a lands).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/assets
npx tsc --noEmit 2>&1 | grep -vE "^src/game/math/(animation|steamFx)\.ts" | grep -E "^src/" && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/data/machineComponents.ts src/data/palette.ts src/data/world.ts src/data/steamFx.ts src/assets/assetIds.ts src/assets/manifest.ts && echo FAIL || echo OK
for f in boiler chimney condenser firebox-1 firebox-2 firebox-3 gauge-needle gauge hammer-ram induction-heater relief-valves steam-hammer steam-manifold superheater turbine-rotor turbine; do file public/assets/machine/era3/$f.png | cut -c1-90; done; file public/assets/machine/era3/rot/turbine-rotor-rot.png public/assets/fx/steam-puff.png public/assets/fx/smoke.png | cut -c1-110
```

## T4 — Era III balance sim + save / startup compat

**wave**: 2. **files_owned**: `src/simulation/balance.sim.test.ts`, `src/persistence/persistence.test.ts`, `src/persistence/startup.test.ts`, and the **era III rows only** of `src/data/technologies.ts` (+ matching expectations in `src/data/technologies.test.ts`, the era III table test only)

**objective**: prove the Era III pacing targets with the existing harness; retune only era III numbers if needed; prove save compatibility and the 12 h offline cap through the real table.

**context**: read `balance.sim.test.ts`, `greedy.ts`, `technologies.ts` (T1 result), `persistence.test.ts`, `startup.test.ts`. Starting numbers are the C1 table (prototype: A boiler 67:17 = 4037 s, steamHammer 80:30, turbine 101:47, pressureVesselBlueprint 112:14 = 6734 s; B 126:01; C 260:31; max buy gap 182 / 150 / 300 s). Re-read `technologies.ts` right before any edit (the Art Director may edit era II numbers: never touch them).
- `balance.sim.test.ts`: keep every existing test and every era I / era II assertion. **Compute each profile ONCE per file** (module-level `beforeAll`, shared `a` / `b` / `c`; the current file runs profile A several times: reuse the shared run). Profiles (`stepSeconds 1`, no offline): A `4 cps, buy 1 s, 10800 s`; B `4 cps, buy 30 s, 12600 s`; C `1 cps, buy 30 s, 21600 s`. `console.table` lists ALL 27 techs (`TECH_IDS`, mm:ss, `never` for Infinity). New `describe('era III pacing targets (WP9 Thermal)')`:
  - A: `boiler` in [3900, 4500]; `pressureVesselBlueprint` in [6300, 8100]; every era III tech has a finite `firstAt`.
  - B: `pressureVesselBlueprint` <= 9000. C: `pressureVesselBlueprint` <= 18000.
  - `maxPurchaseGap(run.purchases, run.firstAt.substationBlueprint, run.firstAt.pressureVesselBlueprint)` <= 1200 for A, B, C.
  - B never earlier than A for any tech (the existing 30 s test iterates `TECH_IDS`: it now covers 27).
  - `maxValue` finite and `< DESIGN_MAX_VALUE` for A, B, C; A deterministic (a second run deep-equals `firstAt` and `purchases`; this second run is the only extra run allowed).
  - Era I exact times and era II windows (generator 1500–2100, substation 3300–4500, B <= 5400, C <= 10800) unchanged and green.
  - Whole file under 10 s (check the vitest summary).
- `persistence.test.ts` (read the file for how saves are built): (1) a **v2 save without any era III keys** (build via the existing serialize helper, then delete the nine era III keys from the parsed JSON `state.techLevels` and re-stringify) loads with status `loaded` and every era III level 0; (2) a round trip with era III levels set (`boiler 1`, `firebox 12`, `condenser 5`, `reliefValves 1`, `pressureVesselBlueprint 1`) is lossless; (3) the existing v1 fixture still `migrated`.
- `startup.test.ts`: keep (c). Add: (c2) a save with `{ wornMotor: 1, reliefValves: 1 }` and a **14 h** gap: `elapsedSeconds` 50400, `cappedSeconds` 43200, `gained.me` ≈ perSecond.me * 43200; (c3) the same save with a **10 h** gap: `cappedSeconds` 36000 (not capped); (c4) without `reliefValves`, 14 h gap -> `cappedSeconds` 28800 (regression). Use the real `TECHNOLOGIES` table.
- If a window is missed: retune ONLY numbers in the nine era III rows of `technologies.ts` (`baseCost`, `growth`, `maxLevel`, numeric fields inside `effects`, `minLevel` / `amount` inside `requires`) and the same numbers in the era III table test of `technologies.test.ts`. Never change ids, kinds, costRes, tree, branch, names, texts, requirement structure, `offlineHours.hours`, or any era I / II row. Never edit the expected windows to make a test pass. If numbers alone cannot reach the windows STOP and report the measured mm:ss tables for A, B, C.

**acceptance**: all assertions above green; final era III numbers (and whether any changed) listed in the report (the Director copies them into PROJECT_STATUS).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/balance.sim.test.ts src/data/technologies.test.ts src/persistence --silent=false 2>&1 | grep -E "mm:ss|boiler|firebox|induction|steamHammer|superheater|condenser|turbine|reliefValves|pressureVessel|passed|failed|Duration"
git diff --stat -- src/data/technologies.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(simulation|data|persistence)" && echo FAIL || echo OK
```

## T5a — Animation + pipe maths

**wave**: 2. **files_owned**: `src/game/math/animation.ts`, `src/game/math/animation.test.ts`, `src/game/math/machineLinks.ts`, `src/game/math/machineLinks.test.ts`

**objective**: the first seven C4 functions. Pure, no Phaser. This removes the allowed `driverValue` TS2366 once T3's `'thermal'` lands.

**context**: read all four files. Types come from `src/data/machineComponents.ts` (T3 widens `AnimationDriver` in parallel: `import type` only; write against the contract). Existing exports stay byte-identical.
- `animation.ts`: `driverValue(driver, manual, automation, electric = 0, thermal = 0)` with `case 'thermal': return thermal;`. Add `reciprocateOffset`, `strikeCount`, `gaugeFrame`, `lowPass`, `spinStep` per C4 (reuse the file's `clampTo` / `noNegativeZero`; guard non-finite inputs; comments in the file's style).
- `machineLinks.ts`: add `PipeStyleLike`, `PipeRect`, `rasterPipe` per C4. **Exact algorithm** (port of `scripts/art/era3/mock3.py: pipe()` — read it): `n = style.prof.length; h = floor(n/2); out = []`. For each consecutive pair `(p0, p1)`: identical points -> skip; `p0.y === p1.y` -> horizontal; `p0.x === p1.x` -> vertical; otherwise `throw new Error('rasterPipe: segment must be axis-aligned')`.
  - Horizontal (`lo = min(x)`, `hi = max(x)`, `L = hi - lo`, `y = p0.y`): body: for `j` in `0..n-1` push `{ color: prof[j], x: lo, y: y - h + j, w: L, h: 1 }`. Flange offsets `marks = [0, L - 2, flangeEvery, 2*flangeEvery, ...]` with the multiples kept while `m < L - 4` (python `range(flangeEvery, L - 4, flangeEvery)`); skip any mark `< 0`. For each mark `m` and `k` in `0..1`, for `j` in `0..flange[k].length-1` push `{ color: flange[k][j], x: lo + m + k, y: y - h - 1 + j, w: 1, h: 1 }`.
  - Vertical (`lo = min(y)`, `hi = max(y)`, `L = hi - lo`, `x = p0.x`): body: for `j` push `{ color: prof[j], x: x - h + j, y: lo, w: 1, h: L }`; flange pixels `{ color: flange[k][j], x: x - h - 1 + j, y: lo + m + k, w: 1, h: 1 }`.
  - After all segments: for every INTERIOR point `(x, y)` (indexes 1..len-2): `s = n + 2`; for `j` in `0..s-1` (outer), `i` in `0..s-1` (inner) push a 1x1 rect at `(x - h - 1 + i, y - h - 1 + j)` with colour `fitting.ink` if `i` or `j` is 0 or `s-1`, else `fitting.hi` if `i + j <= floor(s/2) + 1`, else `fitting.mid` if `i + j < s`, else `fitting.lo`.
  - Order = draw order; later rects overwrite earlier ones (do NOT dedupe). Fewer than 2 points -> `[]`.

**acceptance** (tests; use literal point arrays and literal style objects, do not import era III data):
- `animation.test.ts`: `driverValue('thermal', 2, 3, 7, 9) === 9` and the 3 / 4-arg calls unchanged; `reciprocateOffset(180, 1, 14, 0) === 0`, `reciprocateOffset(0, 1, 14, 0) === -14`, `reciprocateOffset(90, 1, 14, 0) === -7`, never -0 (`Object.is(x, -0)` false), ratio 2 gives two strokes per turn; `strikeCount`: 170 -> 190 = 1, 190 -> 170 = 1 (backward), 0 -> 360 = 1, 0 -> 720 = 2, 170 -> 175 = 0, a ratio -1.75 case counted on `ratio*deg + phase`, non-finite -> 0; `gaugeFrame` (frames 25, minLog 0, maxLog 5): v 0 -> 0, v 1e5 -> 24, v 99999 -> 24, v 9 -> `round(0.2 * 24) = 5`, NaN / negative / Infinity -> 0, `frames: 1` -> 0, monotone over a sweep; `lowPass`: converges (after 10 tau within 1e-4 of the target), `dt <= 0` -> prev, `tau <= 0` -> target, monotone toward the target; `spinStep`: wraps into [0,360), negative speed wraps up, 0 speed keeps the angle, never -0, non-finite step keeps the wrapped angle.
- `machineLinks.test.ts` (expand rects into a `Map<'x,y', color>`, last write wins): horizontal 10 px segment bore 4 at y = 0 from x 0 -> 10: rows -2..1 coloured `prof[0..3]` at x = 5 (a column away from the flanges); flanges at offsets 0 and L-2 (x 0,1 and x 8,9) over rows -3..2; vertical analog (cols x-2..x+1, flange cols x-3..x+2); flange marks: a 60 px segment with `flangeEvery 24` has offsets 0, 58, 24, 48 and a 50 px segment has 0, 48, 24 (the multiple 48 is skipped because 48 >= L-4 = 46); a fitting block at every interior via: size `(bore+2)^2`, ink border, `hi` colour at i+j = 2 and `lo` colour in the far corner (bore 4 and bore 2 cases; the 2-bore water style has a 2-colour prof and 4-colour flange rows); the shared first segment `(-246,-91) -> (-246,-112)` of P1, P2 and P3 (use literal P1 / P2 / P3 point lists from the contract) rasterizes to identical rects (rasterize the 2-point polyline); the full P1 polyline has no pixel outside its points' bounding box expanded by `h + 1`; a non-axis-aligned pair throws; fewer than 2 points -> `[]`; identical consecutive points are skipped without error.
- Existing tests green (`machineLinks.test.ts` existing cases untouched).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/animation.test.ts src/game/math/machineLinks.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/game/math/(animation|machineLinks)" && echo FAIL || echo OK     # TS2366 on animation.ts clears when T3 added 'thermal' AND your case exists
grep -nE "from ['\"]phaser" src/game/math/animation.ts src/game/math/machineLinks.ts && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/game/math/machineLinks.ts src/game/math/animation.ts && echo CHECK || echo OK
```

## T5b — FX + pylon maths

**wave**: 2. **files_owned**: `src/game/math/steamFx.ts` (new), `src/game/math/steamFx.test.ts` (new), `src/game/math/pylonLine.ts`, `src/game/math/pylonLine.test.ts`

**objective**: the last four C4 functions (`emitterRate`, `stepEmitter`, `burstDelaySeconds`, `puffState`) plus the `side` option of `nearestPylonAnchor`. Pure, no Phaser.

**context**: read `pylonLine.ts` + its test fully. `steamFx.ts`: `import type { EmitterMode } from '../../data/steamFx'` (T3 creates it in parallel; type-only, erased at runtime) and define `export interface PuffFx { lifeMs: number; frames: number; riseArtPx: number; driftArtPxPerS: number; scaleFrom: number; scaleTo: number; fadeFrom: number }` locally (`STEAM_FX` satisfies it structurally). **Tests must not import `src/data/steamFx` at runtime**: use local literals shaped like the contract (`{ kind: 'rate', base: 0.4, perLog: 0.3, min: 0.4, max: 2 }`, fx `{ lifeMs: 1200, frames: 4, riseArtPx: 12, driftArtPxPerS: 4, scaleFrom: 1, scaleTo: 1.5, fadeFrom: 0.75 }`).
- `pylonLine.ts`: add `side?: 'any' | 'left'` to `PylonAnchorInput`. In `nearestPylonAnchor`: `side === 'left'` skips points with `point.x >= from.x`; otherwise keep the current `point.x <= from.x` skip. Update the doc comment. Do not change `pylonAnchorPoint`, `cableParabola`, `parallaxToWorld`.

**acceptance** (tests):
- `emitterRate`: chimney curve: v 0 -> 0.4 (clamped min), v 9 -> `0.4 + 0.3*1 = 0.7`, v 1e9 -> 2 (clamped max); non-finite / negative v -> `base` clamped; burst and strike modes -> 0; monotone.
- `stepEmitter`: rate 2, dt 0.5 over 20 steps (10 s) spawns exactly 20 in total; rate 0.4 with dt 0.25 over 40 steps spawns exactly 4 (the `1e-9` guard); `acc` stays in [0,1) after each call; `rate <= 0` or `dt <= 0` -> `{ acc, spawn: 0 }` unchanged; one big dt (3.7 s at rate 1) spawns 3 and leaves ~0.7.
- `burstDelaySeconds`: for indices 0..199 every value in [min, max], deterministic (same call twice equal), at least 10 distinct values, `min === max` -> that value.
- `puffState` (1200 ms life): age 0 -> frame 0, dx 0, dy 0, scale 1, alpha 1, not done; age 299 -> frame 0, age 300 -> frame 1; age 900 -> frame 3 and alpha 1; age 1050 -> alpha 0.5; age 1199 -> alpha near 0 and not done; age 1200 -> alpha 0 and done; dy at half life = -6; dx at 1000 ms = 4; scale at half life = 1.25; negative / NaN age behaves as 0.
- `nearestPylonAnchor`: synthetic strip `anchorsArt [{x:0,y:256}]`, tilePx 256, tileHeightPx 256, scale 2, sf 1, scroll 0, stripLeftX 0, bottomObjY 1000, `from (1030, 990)`: `side: 'left'` gives the k = 2 point `(1024, 1000)`, default gives the k = 3 point `(1536, 1000)`; `'left'` never returns a point with `x >= from.x` over 200 deterministic `from.x` values; `'any'` equals the default result; no anchor on the requested side -> null; all existing `nearestPylonAnchor` / `pylonAnchorPoint` / `cableParabola` tests untouched and green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/steamFx.test.ts src/game/math/pylonLine.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/game/math/(steamFx|pylonLine)" && echo FAIL || echo OK     # unresolved ../../data/steamFx import clears when T3 lands
grep -nE "from ['\"]phaser" src/game/math/steamFx.ts src/game/math/pylonLine.ts && echo FAIL || echo OK
```

---

# WAVE 3 (parallel: T6, T7, T8 — disjoint files; waves 1–2 done and green)

## T6 — Era III audio

**wave**: 3. **files_owned**: `src/data/audio.ts`, `src/audio/gameAudio.ts`, `src/audio/synth.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`

**objective**: boiler roar, steam hiss on era III purchases, milestone whistle; mute respected; era I thunk and era II relay unchanged.

**context**: read all five files (`synth.ts` fully: `playArc` is the model for `playHiss`; `ensureWind` is the model for the roar; `setMains`; the `run` helper; `close()`). Re-read `data/audio.ts` right before editing (the Art Director may tweak numbers).
- `data/audio.ts`: add `boiler`, `hiss`, `whistle` per the contract (all numbers here; `whistle.techId` is the milestone id).
- `audioMath.ts`: `boilerGain(prPerSecond, boilerOwned, cfg = AUDIO.boiler)` per contract (reuse `activityLevel`, `clampRange`, `lerp`).
- `synth.ts` (interface + implementation; errors never escape via `run`): `setBoiler(gain)`: one persistent looped noise source (shared noise buffer) -> lowpass at `AUDIO.boiler.lowpassHz` -> gain -> master; gain moved with `setTargetAtTime` like `setHum` / `setMains`; created lazily on the first call; gain 0 = silent; stopped and disconnected in `close()`. `playHiss()`: one noise burst of `AUDIO.hiss.ms` at `AUDIO.hiss.gain` through a throwaway highpass at `AUDIO.hiss.highpassHz` (nodes disconnected when it ends, same as `playArc`). `playWhistle(delaySeconds = 0)`: two `sine` oscillators at `hzA` and `hzB` sounding together from `now + delaySeconds`, envelope = linear ramp to `gain` over `attackMs` then exponential decay to the floor by `ms` (total <= 1.2 s), oscillators stopped and disconnected when done.
- `gameAudio.ts`: in `tick()`, not muted: `const pr = session.rates.perSecond.pr; s.setBoiler(boilerGain(pr, session.state.techLevels.boiler >= 1));` muted: `s.setBoiler(0)` next to the mains lines. The `purchase` handler: `const era = TECHNOLOGIES[id].era; if (era >= 3) s.playHiss(); else if (era === 2) s.playRelay(); else s.playPurchase();` (same try / warnOnce / `!muted` guard). The `milestone` handler becomes `session.on('milestone', ({ id }) => {...})` with the same guard: `s.playSting(); if (id === AUDIO.whistle.techId) s.playWhistle((AUDIO.sting.notesHz.length * AUDIO.sting.noteMs) / 1000);` (the whistle starts after the sting). Era I and II behaviour unchanged.

**acceptance** (tests, `audioMath.test.ts` only; WebAudio has no unit test): `boilerGain`: 0 when not owned (even with huge PR/s); 0 for pr 0, negative, NaN; > 0 for pr 1 when owned; within `[minGain, maxGain]` for pr > 0 including 1e12; monotone non-decreasing; existing cases untouched. Typecheck clean for `src/audio` and `src/data/audio.ts`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio
npx tsc --noEmit 2>&1 | grep -E "^src/(audio|data/audio)" && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/audio/gameAudio.ts src/audio/synth.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/audio/*.ts && echo FAIL || echo OK
grep -nE "pressureVesselBlueprint" src/audio/gameAudio.ts src/audio/synth.ts && echo FAIL_LITERAL || echo OK
```

## T7 — Machine rendering (animator, view, pipes)

**wave**: 3. **files_owned**: `src/game/entities/MachineView.ts`, `src/game/entities/MachineAnimator.ts`, `src/game/rendering/MachineLinks.ts`

**objective**: render the 16 new parts and 5 new links; thermal driver everywhere; spin, gauge, reciprocate, fire frames; hammer strikes with dust; no era I / II pixel changes. No unit tests (Phaser classes): acceptance = typecheck + Director smoke.

**context**: read all three files plus `machineComponents.ts` (T3), `data/steamFx.ts` (T3), `math/animation.ts` + `math/machineLinks.ts` (T5a), `math/driveTrain.ts`. Re-read before editing.
- `MachineAnimator.ts`:
  - Read `const pr = this.session.rates.perSecond.pr` beside `me` / `ee`; every `driverValue(anim.driver, this.manual, me, ee)` becomes `driverValue(anim.driver, this.manual, me, ee, pr)`; `getDriverValues()` also returns `thermal`. The `frames` case needs no other change (fire glow and spark gap share it).
  - `applyAngle` and the reset loop treat `'spin'` like `'driven'` (RotSprite frames): in the not-active branch a visible `spin` sprite keeps turning like a visible `driven` one; on reset every `spin` sprite goes to angle 0.
  - New state: `spinAngles: Map<id, number>`, `gaugeValues: Map<id, number>` (both cleared on reset), `strikes = 0`, and `prevMasterDeg` captured at the top of `update` before `stepMaster`.
  - `case 'spin'`: `dv = driverValue(anim.driver, manual, me, ee, pr)`; `speed = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, dv)`; `angle = spinStep(prevAngle, speed, dt)`; store; `applyAngle(sprite, angle)`.
  - `case 'gauge'`: `target = driverValue(...)`; `value = lowPass(prev ?? 0, target, dt, anim.tauSeconds)`; store; `sprite.setFrame(gaugeFrame(value, anim.frames, anim.minLog, anim.maxLog))`.
  - `case 'reciprocate'`: `base = resolveAttachment(def)`; `deltaDeg = this.master.deg - prevMasterDeg`; `fast = dt > 0 && Math.abs(anim.ratio * deltaDeg) / dt > HAMMER_FX.maxDegPerSec`; if `fast` -> `sprite.setPosition(base.x, base.y + HAMMER_FX.midOffsetArtPx)` and no strikes; else `offset = reciprocateOffset(this.master.deg, anim.ratio, anim.strokeArtPx, anim.phaseDeg)`, `sprite.setPosition(base.x, base.y + offset)`, and `if (dt > 0) this.strikes += strikeCount(prevMasterDeg, this.master.deg, anim.ratio, anim.phaseDeg)`. Only while the part is active (visible, not assembling). Reset clears `strikes`.
  - `consumeStrikes(): number` returns `strikes` and sets it to 0. Update the class doc comment (thermal driver, spin / gauge / reciprocate).
- `MachineView.ts`:
  - `textureKey`: a `'spin'` part starts on its `#rot` sheet like `'driven'` (`def.animation.kind === 'driven' || def.animation.kind === 'spin'`).
  - Hammer: private `hammerStrikes = 0`; `getHammerStrikes(): number`. In `update()` right after `animator.update`: `const n = this.animator.consumeStrikes(); if (n > 0) { this.hammerStrikes += n; for (let i = 0; i < Math.min(n, 2); i++) this.spawnDust(HAMMER_FX.dustAt.x, HAMMER_FX.dustAt.y, HAMMER_FX.dustPuffs, HAMMER_FX.dustSpreadArtPx); }` (cap of 2 dust bursts per frame). Session `reset` sets `hammerStrikes = 0`.
  - Generalise `spawnPuff(id)` into `spawnDust(x, bottomY, count, spread)` (same tween, same `fx.dust` image, same depth, same random call order) and make `spawnPuff` call it with `(base.x, bottomY, MACHINE_ASSEMBLY.puffCount, MACHINE_ASSEMBLY.puffSpreadArtPx)`: era I / II landing puffs must be unchanged.
  - Update the doc comment: RT pixel `(-MACHINE_BOUNDS.left, -MACHINE_BOUNDS.top)` = machine (0,0) (era III: 448, 248). The RT is already sized from `MACHINE_BOUNDS` (896 x 256).
- `MachineLinks.ts`:
  - New `PipePlan { depth: number; points: Vec2[]; style: 'steam' | 'water'; key: string }`. In `buildPlan` add `else if (link.kind === 'pipe')`: endpoints `a = ctx.pointOf(from)`, `b = ctx.pointOf(to)`; if `!fromLive || !toLive || a === null || b === null` push key part `'p-'` and continue; else `points = [roundPoint(a), ...(link.via ?? []), roundPoint(b)]`, `style = link.pipeStyle ?? 'steam'`, `depth = link.depth ?? MACHINE_LINK_STYLE.pipe.depth`, key part = link index plus the joined point list (for example `p3:-246,-91;-246,-112;...`); plan list `pipes`; `pipeKey` = all key parts joined by `|`.
  - One Graphics per DISTINCT pipe depth found in `MACHINE_LINKS` (Map<number, Graphics>), created in the constructor with `.setDepth(depth)` and added to `parent` after the cables; a per-depth key = the key parts of that depth's pipes; redraw (clear, then `rasterPipe(points, MACHINE_LINK_STYLE.pipe[style])` rects in order via `fillStyle(color, 1); fillRect(x, y, w, h)`) ONLY when that depth's key changed (cache rasters by pipe key so a redraw does not re-raster unchanged pipes). Pipes are static: while nothing changes visibility no Graphics work happens. A pipe is hidden while either endpoint component is hidden or assembling (key part `'p-'`).
  - `destroy()` destroys the new Graphics and clears the caches. Belt, rod, cap and cable code paths unchanged.

**constraints**: no `0x` literals; colours only from `MACHINE_LINK_STYLE`; no new magic numbers (strike dust counts / clamp / mid offset come from `HAMMER_FX`); no changes to belt / rod / cable behaviour; Phaser allowed.

**acceptance**: typecheck clean for `src/game/entities` and `src/game/rendering/MachineLinks.ts` (`WorldScene.ts` may still fail until T8 lands); grep checks pass; Director smoke: rotor spins (frames change across 8 screenshots 60 ms apart), needle sweeps up after load, ram moves and each strike puffs dust, pipes P1–P3 + W1 + C1 drawn, a pipe is hidden while an endpoint assembles, s0–s9 pixels as before.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/(entities|rendering/MachineLinks)" && echo FAIL || echo OK     # WorldScene.ts errors belong to T8 until both are done
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/entities/MachineView.ts src/game/entities/MachineAnimator.ts src/game/rendering/MachineLinks.ts && echo FAIL || echo OK
grep -n "getHammerStrikes\|consumeStrikes\|rasterPipe\|'spin'\|'gauge'\|'reciprocate'" src/game/entities/*.ts src/game/rendering/MachineLinks.ts
```

## T8 — Steam FX + pylon feeds wiring

**wave**: 3. **files_owned**: `src/game/rendering/SteamFx.ts` (new), `src/game/rendering/PylonLine.ts`, `src/game/scenes/WorldScene.ts`

**objective**: world-space steam / smoke puffs from `STEAM_EMITTERS`; turbine -> left pylon cable (CR-A) next to the existing mast cable; relief burst on the `reliefValves` purchase and on the `pressureVesselBlueprint` milestone (CR-B). Phaser allowed here; no unit tests.

**context**: read `PylonLine.ts`, `WorldScene.ts`, `data/steamFx.ts` + `data/world.ts` (`PYLON_FEEDS`, `DEPTH`, `PIXEL_SCALE`, `MACHINE_ANCHOR`) (T3), `math/steamFx.ts` + `math/pylonLine.ts` (T5b), `math/animation.ts` (`driverValue`), `math/machineLayout.ts` (`machineLocalToWorld`), `GameSession.ts` events (`unlock` and `milestone` carry `{ id }`, `reset` carries `{}`), the `MachineView` public API (`isAssembling`, and `getHammerStrikes` from T7, coded against the contract). Re-read before editing.
- `PylonLine.ts`: constructor `(scene, techLevels, feed: PylonFeed, componentAssembling: () => boolean = () => false)`. The start point is `machineLocalToWorld(resolveConnectionPoint(MACHINE_COMPONENTS[feed.component], feed.point))` (null -> never draw). Fade target = `isLayerVisible(pylonsLit) && gateMet && !componentAssembling()` where `gateMet = feed.gate === undefined || techLevels[feed.gate.techId] >= feed.gate.minLevel` (initial fade 1 when already satisfied at construction, no fade-in on load, as today). `PylonAnchorInput` gets `side: feed.side`. Everything else (pinned anchor, key redraw, alpha = fade * layer alpha, destroy) stays; the mast feed must draw pixel-identically to today.
- `SteamFx.ts` (new):
  - State: `clock` (seconds, += dt each update, `dt = clamp(deltaMs / 1000, 0, MACHINE_MOTION.maxFrameSeconds)`), a pool of up to `STEAM_FX.poolSize` `Phaser.GameObjects.Image` created lazily (`scene.add.image(0, 0, 'fx.steamPuff', 0).setDepth(STEAM_FX.depth)`, hidden while free), live puffs `{ image, ageMs, base: Vec2 (world) }`, a queue `scheduled: Array<{ at: number; point: Vec2; assetId }>`, per emitter `{ acc, nextBurstAt: number | null, burstIndex, counter }`, and `lastStrikes`.
  - `spawn(assetId, localPoint)`: no free pool object -> drop silently; else `image.setTexture(assetId, 0).setVisible(true)`, base = `machineLocalToWorld(localPoint)`.
  - Per frame, for each emitter: `gateMet = levels[gate.techId] >= gate.minLevel` (not met: reset its acc / nextBurstAt, continue); `v = driverValue(e.driver, 0, rates.me, rates.ee, rates.pr)` from `session.rates.perSecond`;
    - `rate`: when `v >= e.threshold`: `({ acc, spawn } = stepEmitter(acc, emitterRate(mode, v), dt))`, spawn `spawn` puffs round-robin over `e.at` (`counter++ % at.length`); else `acc = 0`.
    - `burst`: when `v >= Math.max(e.threshold, mode.minDriver)`: if `nextBurstAt === null` set it to `clock + burstDelaySeconds(burstIndex++, everyMinS, everyMaxS)`; when `clock >= nextBurstAt` schedule `mode.count` puffs, puff `i` at `clock + i * spacingMs / 1000` on `at[i % at.length]`, and set the next time the same way; when `v` is below the floor set `nextBurstAt = null`.
    - `strike`: `const n = machine.getHammerStrikes()`; `n < lastStrikes` -> `lastStrikes = n`; else spawn `min(n - lastStrikes, 3)` puffs at `at[0]` and `lastStrikes = n`.
  - Events (unsubscribed in `destroy`): `session.on('unlock', ({ id }))`: for every `burst` emitter whose `gate.techId === id` schedule one burst of `mode.count` puffs starting at `clock + STEAM_FX.purchaseBurstDelayMs / 1000`. `session.on('milestone', ({ id }))`: when `id === MILESTONE_BURST.techId` schedule `MILESTONE_BURST.count` puffs at the points of emitter `MILESTONE_BURST.emitter` (spacing from that emitter's mode) starting now. `session.on('reset')`: hide and free every puff, clear `scheduled`, zero every emitter state and `lastStrikes`.
  - Scheduled items whose `at <= clock` spawn (then are removed). Live puffs: `ageMs += dt * 1000`; `puffState(ageMs, STEAM_FX)`; `done` -> hide and free; else `image.setFrame(st.frame)`, position = `base + (st.dx, st.dy) * PIXEL_SCALE` snapped to whole art px (`Math.round(x / PIXEL_SCALE) * PIXEL_SCALE`), `setScale(PIXEL_SCALE * st.scale)`, `setAlpha(st.alpha)`. Never more than `poolSize` objects exist.
  - `destroy()`: unsubscribe, destroy every pooled image (guard `image.scene`), clear arrays; safe to call twice.
- `WorldScene.ts`: replace the single `pylonLine` field with `pylonLines: PylonLine[]`, built by `PYLON_FEEDS.map((feed) => new PylonLine(this, techLevels, feed, () => this.machineView?.isAssembling(feed.component) === true))`; each updated every frame; each destroyed in the disposables where the single one was (before the background). Add `steamFx`: `new SteamFx(this, this.ctx.session, () => this.machineView)` created after the machine, `this.steamFx?.update(delta)` called AFTER `this.machineView?.update(delta)` in `update`, destroyed in the disposables before the machine's disposable. Nothing else changes; keep the shutdown try / catch loop.

**constraints**: colours / numbers only from data (`STEAM_FX`, `MACHINE_LINK_STYLE`, `PYLON_LINE`); no `0x` literals; 0 console errors; all objects destroyed on shutdown.

**acceptance**: typecheck clean for `src/game` once T7 landed; the grep checks pass; Director smoke: chimney smoke rising after the boiler; hammer puff per strike; manifold puffs once ME/s >= 5 and the boiler is owned; relief bursts every 6–9 s while PR/s > 50, once on the reliefValves purchase, a four-puff burst on the milestone; the turbine cable goes to a LEFT pylon only when `turbine` is owned and `pylonsLit` is visible; the mast cable is unchanged.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game" && echo FAIL || echo OK     # if only getHammerStrikes is missing, T7 is unfinished: report it
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/SteamFx.ts src/game/rendering/PylonLine.ts src/game/scenes/WorldScene.ts && echo FAIL || echo OK
grep -n "PYLON_FEEDS\|new SteamFx\|new PylonLine" src/game/scenes/WorldScene.ts
```

---

# WAVE 4 — EM Mode B (validate)

Run: `npm run typecheck`, `npm test` (baseline **908 / 41 files**; expect 908 + new, no touched test file losing cases: compare `it(` / `it.each` titles against `git diff`), `npm run build` (app chunk <= 200 KB). Then:
```
grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/ui/*View.ts src/ui/*Rules.ts src/audio/audioMath.ts       # must be empty
grep -rnE "0x[0-9a-fA-F]{6}" src/game src/ui src/audio --include=*.ts | grep -v test                                                              # must be empty
npx vitest run src/simulation/balance.sim.test.ts --silent=false                                                                                  # era I exact + era II + era III windows
git diff --stat HEAD -- docs/GAME_SPEC.md src/simulation/GameSession.ts public                                                                    # must be empty
git diff HEAD -- src/data/technologies.ts | grep -E "^-[^-]"                                                                                       # only Art Director hunks (era I / II numbers), none from era III workers
```
**Balance** (A 4 cps 1 s buys 10800 s · B 4 cps 30 s 12600 s · C 1 cps 30 s 21600 s, no offline): era I exact unchanged (gearRatio 4 ... generatorBlueprint 1326); era II windows unchanged; A boiler in [3900, 4500], pressureVesselBlueprint in [6300, 8100]; B <= 9000; C <= 18000; `maxPurchaseGap` substation -> vessel <= 1200 for A / B / C; B never earlier than A; maxValue finite and < DESIGN_MAX_VALUE; deterministic; whole file < 10 s.
**Save**: v2 save without era III keys -> `loaded`, levels 0; v1 fixture migrates; round trip lossless; offline cap 12 h only with reliefValves (14 h gap -> 43200; 10 h gap -> 36000).
**Per-criterion PASS / FAIL**: C1 table exact (compare `technologies.ts` with the preamble table incl. T4's retune, 27 techs, `offlineHours` variant, names <= 19 chars); C2 `offlineCapSeconds` + `describeEffect` + rates ignore; C3 counts (45 components, 30 sockets, 12 links = 7 old + P1 P2 P3 W1 C1, 7 shadows, 18 new asset ids with real files matching manifest sizes, `MACHINE_BOUNDS`, pipe style with `fitting`, rotor A1 speed, `PYLON_FEEDS`, `steamFx.ts` values, motorRetrofitKit `tie`); C4 maths and tests; era III plaque, logs, install lines; `kind 'pipe'` branch in `MachineLinks`; thermal driver in every animator path; `spin` on `#rot`; `consumeStrikes` / `getHammerStrikes`; `SteamFx` + one `PylonLine` per feed wired in `WorldScene` and destroyed; audio: roar silent without the boiler, hiss for era >= 3, relay era 2 only, whistle after the sting on the milestone, mute respected (code path read).
Allowed glue: one-line integration fixes only (state it in the report).

## Director smoke test steps (after the build)

`npm run build && npx vite preview --port 4173 --strictPort &` then per `scripts/smoke/README.md` with `PW=$(npm root -g)/playwright`:
1. `wp2-crank.mjs`, `wp3-techtree.mjs`, `wp4-persistence.mjs`, `full-machine.mjs` -> each `errors` empty, 0 console errors; era I / II tree texts identical; `wp3-techtree`: `9_tabCount` 3 with ERA II and ERA III `SIGNAL ?` disabled, `10_tabs` ERA II enabled and ERA III `SIGNAL ?`, `11_tabs` ERA III enabled with text starting `ERA III`, `11_header` ends `PR`, `11_nodes` 9.
2. `stages.mjs` (all stages s0–s11; `FRAME_MS=40` optional; `ONLY=s11_era3_full` with frames arg `8` shows ram + rotor moving) -> 0 errors. Camera lines expected:
   - s0–s9: exactly as WP8 (s0–s7 zoom 1 centre about (1280, 960); s8 zoom 1 centre about (1424, 952); s9 zoom 0.75 centre about (1552, 952)); screenshots match the WP8 look (no era III part visible).
   - **s10_boiler**: zoom 0.75, centre about **(1415, 882)** (machine bounds x 662..2168 world); the parts log shows `boiler, chimney, steamManifold, pressureGauge, gaugeNeedle` visible and the other eleven not visible; screenshot: boiler with a closed fire door, chimney with smoke rising, steam manifold on the piston block, gauge + needle sweeping up, P1 pipe header and riser (4 px bore, flanges every 24 px, fitting blocks at the corners, passing behind the chimney), HUD PR row, plaque `PRIMARY FUNCTION: RES?OR?` (substation owned).
   - **s11_era3_full**: zoom 0.5, centre **(1280, 720)** (clamped: the view is the whole world); all 16 parts visible; fire stage 3 flickering at <= 3 Hz; ram reciprocating with an exhaust puff and 3 dust puffs per strike; rotor spinning (RotSprite frames); P1–P3 steam pipes and the 2 px W1 water pipe (behind the hammer bedplate); C1 cable from the retrofit kit to the induction heater; turbine -> LEFT pylon cable with the lit pylons; relief valve bursts; chimney smoke; plaque `PRIMARY FUNCTION: REST?RE` once `pressureVesselBlueprint === 1` (else `RES?OR?`); zoom 0.5 gives 1 screen px per art px.
3. Manual: press T. The ERA III tab reads `SIGNAL ?` (disabled) before the substation; after it `ERA III · PR` and header `<n> PR`; the graph scrolls horizontally (1560 px wide) and keyboard focus scrolls nodes into view; keyboard-only purchase works. Crank text shows `+N ME  +M EE  +K PR` after `steamHammer`. **Offline:** with `reliefValves` owned, fake a **14 h** gap (`session.update(Date.now() + 14 * 3600e3)` or edit `lastSimTime` and reload) -> the welcome-back text contains `Buffer capped at 12h`; a 10 h gap shows no cap text. Audio (listen): boiler roar after the boiler (louder as PR/s rises, silent when muted), hiss on era III purchases, relay only on era II purchases, whistle after the sting on the milestone.
4. Docs (Director): `docs/PROJECT_STATUS.md` is stale for WP8 / WP9 — record WP8 done, WP9 done (era III numbers = the C1 table or T4's retune, amendments A1 / A2 + EM decisions 1–13, new test count), art contract `docs/plan/ART_ERA3.md`.

---

# Risks

- **Concurrent Art Director edits** (`src/data/*` numbers, `src/ui/*.css`): every worker re-reads before editing and keeps edits surgical; T1 / T4 touch `technologies.ts` (append / era III rows only), T3 touches `world.ts` and `machineComponents.ts`. If a foreign edit changes an era I / II test expectation the owning worker reports it; never revert.
- **T4 numeric tuning**: the prototype used a scratch harness; the windows may be missed by numbers alone. T4 must STOP and report the A / B / C mm:ss tables rather than widen windows.
- **Era I / II drift**: the era I exact test, the era II windows and the T1 / T3 snapshot tests guard it. Era III `ee` techs (boiler 1M EE, inductionHeater 300K EE) only become available after `substationBlueprint`, so earlier `firstAt` cannot move.
- **Haiku scope**: T3 (11 files, 16 components + 18 assets + tests) and T7 (animator + view + pipes) are the largest. If T3 stalls split on its seams: (machineComponents + test) / (palette, world, steamFx, assets). If T7 stalls split: (MachineAnimator) / (MachineView + MachineLinks).
- **T5a / T5b vs T3 in one wave**: `import type` of not-yet-existing symbols only breaks tsc, not vitest; the tests use local literals. The Director gates the wave on the combined `tsc` run.
- **Pipe raster fidelity**: the port of `mock3.py: pipe()` is the only reference; the unit tests pin rows, flanges, fittings and the shared P1 / P2 / P3 riser. The final proof is the Director's s10 / s11 screenshot compared with the ART_ERA3 evidence (`mock_era3_full.png` in the Art Director scratch dir).
- **Strike detection under click impulses**: a click adds ~51 deg of thetaM through a 50 ms exponential release (~870 deg/s at 60 fps, close to the 1080 deg/s clamp); two clicks inside 50 ms exceed it and the ram holds mid stroke without a strike. Intended (design), tunable in `HAMMER_FX`.
- **Strike sparsity** (decision 13): idle drift gives a blow every 1.5–18 s; if it looks dead in smoke, the Director raises the ram ratio.
- **Gauge needle at load** sweeps up from 0 (decision 9); **chimney smoke during assembly** (decision 10). Both cosmetic.
- **Tree width 1560 px** relies on the existing `overflow: auto`; if keyboard focus does not scroll, that is a follow-up CSS task for the Art Director (CSS is off limits to workers).
- **Pylon cable to the left** depends on a pylon anchor existing left of x = 532 (world); the strip spans the whole world at every zoom so one exists, but the Director's s11 screenshot is the proof. If none, the turbine cable simply does not draw (no error).
- **Offline test arithmetic**: WP9.md's "10 h gap -> 12 h cap" is wrong (decision 1); a Director who follows the old text will see "no cap text" and read it as a failure.
- **Audio** has no unit coverage beyond `audioMath`; the roar / hiss / whistle are reviewed by reading the code path and by ear.
