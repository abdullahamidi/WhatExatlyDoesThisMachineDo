# WP9 — Era III (Thermal / Pressure, resource PR)

Goal: playable from `substationBlueprint` to `pressureVesselBlueprint`. Era III gets 9 techs, the `offlineHours` effect (relief valves: offline cap 8 h → 12 h),
16 machine parts on real PNGs, `pipe` links with via points, `thermal` driver, reciprocate / spin / gauge animations, world-space steam/smoke FX,
turbine → pylon export cable (CR-A), milestone whistle burst (CR-B), boiler roar / hiss / whistle audio, logs, plaque.
= roadmap "WP11 Era III" (renumbered). Art contract: `docs/plan/ART_ERA3.md` (wins for ids, files, sizes, origins, sockets, links, frames; this file wins for
tech numbers and the 2 amendments in §C3). All 19 PNGs exist (sizes verified with `file`) → manifest `file` points at them directly; no new fallback painters
(missing files fall back to `paintGenericPlate`, sheets keep frames via `sheetFrameRects`). Baseline: HEAD 17de367, typecheck/test/build clean.
**Concurrency rule:** an Art Director Era II review may edit `src/data/*` numbers and `src/ui/*.css` during this WP. Every worker re-reads its files right before
editing, never reverts foreign edits, never touches era I/II rows or any `src/ui/*.css`.

## Contracts (pure: no Phaser in data/simulation/utils/persistence)
### C1 Tech data (`src/data/types.ts`, `technologies.ts`)
```ts
TECH_IDS += 'boiler','firebox','inductionHeater','steamHammer','superheater','condenser','turbine','reliefValves','pressureVesselBlueprint'  // append only
Effect |= { type: 'offlineHours'; hours: number }    // adds hours*level to the offline cap; no rate/click effect
```
Numbers: prototype greedy (scratch copy of the harness) — roadmap costs finished era III 90 s after the substation (EE stock ~0.5 M, EE income ~4.7 K/s incl. echo).
| id | kind | era/costRes | baseCost | growth/max | effects | requires | tree col,row | branch |
|---|---|---|---|---|---|---|---|---|
| boiler | unlock | 3/ee | 1,000,000 | – | convert(pr,0.3) | substationBlueprint | 0,1 | convergence |
| firebox | repeatable | 3/pr | 1,000 | 1.3/25 | convert(pr,0.15) | boiler | 1,0 | mechanical |
| inductionHeater | repeatable | 3/ee | 300,000 | 1.35/20 | autoAdd(pr,5) | boiler | 1,2 | automation |
| steamHammer | unlock | 3/pr | 10,000 | – | clickEcho(pr,1) | firebox 3 | 2,0 | origin |
| superheater | unlock | 3/pr | 40,000 | – | rateMult(pr,2) | firebox 5 | 2,1 | mechanical |
| condenser | repeatable | 3/pr | 60,000 | 1.3/20 | autoPct(pr,15) | superheater | 3,1 | mechanical |
| turbine | unlock | 3/pr | 300,000 | – | rateMult(ee,2) | condenser 3 | 4,1 | automation |
| reliefValves | unlock | 3/pr | 800,000 | – | offlineHours 4 | steamHammer, turbine | 5,0 | automation |
| pressureVesselBlueprint | milestone | 3/pr | 0 | – | none | reliefValves, condenser 5, lifetime pr 6,000,000 | 6,1 | convergence |
Prototype result (A = 4 clicks/s 1 s buys): boiler 67:17, steamHammer 80:30, turbine 101:47, pressureVesselBlueprint 112:14; B (30 s buys) 126:01;
C (1 click/s, 30 s buys) 260:31; max buy gap substation→vessel 182/150/300 s; maxValue ~1.2e8. Era I/II firstAt unchanged.
Install lines (INSTALL_LINES; flavor = same text where marked *): boiler* "Pressure detected. Vessel rating: unlisted." · firebox "Fuel source not on the manifest.
Burning anyway." · inductionHeater "Current turned to heat. Heat did not object." · steamHammer "Impact logged. Target: the ground." · superheater "Steam exceeds the
temperature it was asked for." · condenser "Water returned. Some of it was not ours." · turbine "Output sent back up the line. Line accepted." · reliefValves
"Relief valves fitted. Relief not expected." · pressureVesselBlueprint* "Containment rating exceeded by design."
Logs (lifetime pr): 1,000 `pressure-rising` "Pressure rising. Safe limit field left blank." · 1,000,000 `steam-rain` "Steam tastes of rain. Logged as error."
Plaque: `PLAQUE_LINES += { milestone: 'pressureVesselBlueprint', text: 'PRIMARY FUNCTION: REST?RE' }` (era III shows `RES?OR?` from substation, already there).
Save: additive tech keys → missing keys default 0 (`readTechLevels`) → **no version bump**.
### C2 Offline cap (`src/simulation/production/tick.ts`, `progression/status.ts`, `production/rates.ts`)
```ts
export function offlineCapSeconds(techLevels: Readonly<Record<TechId, number>>, techs = TECHNOLOGIES): number
  // OFFLINE_CAP_SECONDS + 3600 * Σ(hours * level) over offlineHours effects of techs with level > 0
applyOffline(state, nowMs, techs)  // now passes offlineCapSeconds(state.techLevels, techs) to computeOffline (signature of both unchanged)
describeEffect({type:'offlineHours',hours}, n) === `+${fmt(hours*n)}h offline buffer`;  computeRates ignores 'offlineHours'
```
`MAX_UPDATE_SECONDS` unchanged (gaps > 60 s already route through applyOffline). Welcome-back "Buffer capped at 12h" works unchanged.
### C3 Machine + asset contract (`src/data/machineComponents.ts`, `palette.ts`, `world.ts`, new `steamFx.ts`; `src/assets/{assetIds,manifest}.ts`)
Exactly ART_ERA3 §2 (palette ember/emberDark/steam), §4 (types, `MACHINE_BOUNDS {-448,448,-248,8}`, `MACHINE_LINK_STYLE.pipe`, 13 sockets), §5 (16 components,
connections, shadows, 5 links P1 P2 P3 W1 C1, motorRetrofitKit `tie` (0,−3)), plus:
```ts
MachineLink += { via?: Vec2[]; bore?: 4 | 2; depth?: number; pipeStyle?: 'steam' | 'water' }   // pipe only; depth default MACHINE_LINK_STYLE.pipe.depth; W1: bore 2, depth MID-1, water
// AMENDMENT A1: spin speed uses the existing animationSpeed formula base*(1+gain*log10(1+v)); ART_ERA3's {base 0,...} would never move.
turbineRotor.animation = { kind: 'spin', driver: 'thermal', speed: { base: 60, gain: 1.5, min: 0, max: 540 } }   // ~150°/s at 10 PR/s, ~370°/s at 2.5K (tunable)
// AMENDMENT A2: 'gauge'/'frames'/'reciprocate' need no SpeedCurve; the speed-curve invariant test covers vibrate + spin only.
export interface PylonFeed { id: string; component: MachineComponentId; point: string; side: 'any' | 'left'; gate?: { techId: TechId; minLevel: number } }
export const PYLON_FEEDS: readonly PylonFeed[] = [                                   // world.ts (CR-A)
  { id: 'mast', component: 'cableMast', point: 'top', side: 'any' },
  { id: 'turbine', component: 'turbine', point: 'export', side: 'left', gate: { techId: 'turbine', minLevel: 1 } } ];
```
New ids: components `boiler chimney steamManifold pressureGauge gaugeNeedle fireboxGlow1 fireboxGlow2 fireboxGlow3 inductionHeater superheater reliefValves
steamHammer hammerRam condenser turbine turbineRotor` (29 → 45); assets `machine.boiler .chimney .steamManifold .gauge .gaugeNeedle .fireGlow1 .fireGlow2
.fireGlow3 .inductionHeater .superheater .reliefValves .steamHammer .hammerRam .condenser .turbine .turbineRotor fx.steamPuff fx.smoke` (+18). Sheets: manifest
width/height = whole image, `frame` = cell (gaugeNeedle 600×24 / 24×24×25, fireGlowN 96×24 / 24×24×4, fx 64×16 / 16×16×4); turbineRotor `rotation:
{ file: 'machine/era3/rot/turbine-rotor-rot.png', frames: 64 }`.
`src/data/steamFx.ts` (pure data, ART_ERA3 §6):
```ts
export type EmitterMode = { kind: 'rate'; base: number; perLog: number; min: number; max: number }   // puffs/s = clamp(base + perLog*log10(1+v), min, max)
  | { kind: 'burst'; count: number; spacingMs: number; everyMinS: number; everyMaxS: number; minDriver: number }  // + one burst on purchase of gate tech
  | { kind: 'strike' };                                                                             // one puff per hammer strike
export interface SteamEmitter { id: string; assetId: 'fx.steamPuff' | 'fx.smoke'; at: Vec2[]; gate: { techId: TechId; minLevel: number };
  driver: AnimationDriver; threshold: number; mode: EmitterMode }
STEAM_EMITTERS = [ chimney: fx.smoke (−293,−240) boiler 1, thermal, thr 0, rate {0.4,0.3,0.4,2} ·
  relief: fx.steamPuff (−218,−94),(−211,−94) reliefValves 1, thermal, burst {4,120,6,9,50} · hammer: fx.steamPuff (−334,−98) steamHammer 1, strike ·
  manifold: fx.steamPuff (−72,−182),(−44,−182),(−16,−182) boiler 1, automation, thr 5, rate {0.3,0.2,0.3,1.5} ]
STEAM_FX = { poolSize: 48, lifeMs: 1200, frames: 4, riseArtPx: 12, driftArtPxPerS: 4, scaleFrom: 1, scaleTo: 1.5, fadeFrom: 0.75, depth: DEPTH.machine + 1 }
HAMMER_FX = { maxDegPerSec: 1080, midOffsetArtPx: -7, dustPuffs: 3, dustSpreadArtPx: 3, dustAt: { x: -334, y: -22 } }
MILESTONE_BURST = { techId: 'pressureVesselBlueprint', emitter: 'relief', count: 4 }   // CR-B
```
### C4 Pure maths (`src/game/math/animation.ts`, `machineLinks.ts`, new `steamFx.ts`, `pylonLine.ts`)
```ts
driverValue(driver, manual, automation, electric = 0, thermal = 0)              // 'thermal' → thermal (= perSecond.pr)
reciprocateOffset(masterDeg, ratio, strokeArtPx, phaseDeg): number              // round(-(stroke/2)*(1+cos(rad(ratio*θ+phase)))); 0 = strike (θ=180°)
strikeCount(prevDeg, nextDeg, ratio, phaseDeg): number                          // times ratio*θ+phase crossed 180 (mod 360), either direction
gaugeFrame(v, frames, minLog, maxLog): number                                   // ART_ERA3 §4 formula; non-finite/negative v → 0
lowPass(prev, target, dtSeconds, tauSeconds): number                            // prev + (target-prev)*(1-exp(-dt/tau)); dt<=0 → prev
spinStep(angleDeg, degPerSec, dtSeconds): number                                // wrapped [0,360)
interface PipeStyleLike { prof: readonly number[]; flange: readonly (readonly number[])[]; flangeEvery: number }
rasterPipe(points: readonly Vec2[], style: PipeStyleLike): Array<{ color: number; x: number; y: number; w: number; h: number }>
  // bore = prof.length; ART_ERA3 §4 raster == scripts/art/era3/mock3.py pipe() (port it 1:1); throws on non-axis-aligned consecutive points
emitterRate(mode, v): number · stepEmitter(acc, ratePerS, dt): { acc; spawn: number } · burstDelaySeconds(index, minS, maxS): number  // deterministic hash jitter
puffState(ageMs, fx): { frame; dx; dy; scale; alpha; done }                     // frame = age quartile; dy = -rise*t; dx = drift*age/1000; alpha 1→0 after fadeFrom
nearestPylonAnchor(input & { side?: 'any' | 'left' })                           // 'left': only anchors with world x < from.x; none → null
```

## Tasks (exclusive file ownership; tests next to code)
- **T1 Era III data** — `src/data/{types,technologies,technologies.test,notifications,systemLogs,story}.ts`, plus count fixes in `src/simulation/state.test.ts`,
  `src/ui/systemLogRules.test.ts` (≤12 → ≤14), `src/ui/techTreeView.test.ts` (tabs [1,2] → [1,2,3]), `src/ui/hudView.test.ts` (only if broken). Depends: none.
  Acceptance: C1 table exact; 27 techs; prereq graph acyclic; every tech reachable; unique tree pos per era; era I/II rows byte-identical to HEAD (after any AD edits);
  INSTALL_LINES complete; 2 logs; plaque line; Effect variant added.
- **T2 Offline-cap effect** — `src/simulation/production/{tick,tick.test,rates,rates.test}.ts`, `src/simulation/progression/{status,progression.test}.ts`,
  `src/persistence/startup.test.ts`. Depends: none (injected tech tables in tests).
  Acceptance: C2; cap 28800 with no effect, 43200 with an injected offlineHours 4 tech owned, level 0 ignored, repeatable levels multiply; 10 h gap → capped 12 h,
  `elapsedSeconds` 10 h; effect text exact; rates unchanged by the effect; startup test with reliefValves owned (real table) caps at 43200.
- **T3 Machine + asset contract data** — `src/data/{machineComponents,machineComponents.test,palette,palette.test,world,world.test,steamFx(new),steamFx.test(new)}.ts`,
  `src/assets/{assetIds,manifest,manifest.test}.ts`. Depends: T1.
  Acceptance: C3 + ART_ERA3 §4/§5 exact (45 components, 30 sockets, 12 links, 7 shadows, bounds, pipe style); era I/II component data byte-identical except
  motorRetrofitKit gains `tie`; invariants: boxes inside MACHINE_BOUNDS, every socket used, pipe links join two `pipe` points, polyline from→via→to axis-aligned,
  cable links join `cable` points, every connection point linked except `turbine.export` (world-space PYLON_FEEDS), link techs ordered by requirement, fire stages
  share box; manifest dims == component sizes (cell for sheets), 11 rotation entries, files exist; STEAM_EMITTERS gates are known techs, points inside bounds.
- **T4 Balance sim Era III + save compat** — `src/simulation/balance.sim.test.ts`, `src/persistence/persistence.test.ts`; may retune **era-III numbers only** in
  `src/data/technologies.ts` (+ matching `technologies.test.ts` expectations). Depends: T1.
  Acceptance: Validation §Balance; compute profiles A/B/C once per file (module-level beforeAll) and reuse; `console.table` lists 27 techs; final numbers in report.
  Save: v2 save without era-III keys → `loaded`, era-III levels 0; round-trip with era-III levels lossless; v1 fixture still migrates.
- **T5a Animation + pipe maths** — `src/game/math/{animation,animation.test,machineLinks,machineLinks.test}.ts`. Depends: T3 types (same wave, contract-first).
  Acceptance: C4 first 7 functions; tests: offset 0 at θ=180, −stroke at θ=0, strikes counted forward and backward, gauge ends 0/frames−1, lowPass converges,
  rasterPipe: horizontal/vertical rows+cols, flanges at 0, L−2, every 24 (skip <4 from end), fitting block at each interior via, P1/P2 share identical header pixels.
- **T5b FX + pylon maths** — `src/game/math/{steamFx(new),steamFx.test(new),pylonLine,pylonLine.test}.ts`. Depends: T3 (EmitterMode type).
  Acceptance: C4 last 5 functions; rate clamp, accumulator spawns exact counts over 10 s, jitter within [min,max] and deterministic, puff alpha 1 until 0.75 then 0
  at life end, frame quartiles; `side:'left'` never returns an anchor right of `from`; default behaviour unchanged (existing tests green).
- **T6 Era III audio** — `src/data/audio.ts`, `src/audio/{gameAudio,synth,audioMath,audioMath.test}.ts`. Depends: T1.
  Acceptance: `AUDIO.boiler` roar = lowpassed noise, gain on log PR/s (same curve helper as mains), silent while boiler 0; `AUDIO.hiss` short highpassed noise on
  era-3 purchases (relay stays era 2 only; era 1 thunk unchanged); `AUDIO.whistle` (~two-tone 880/1175 Hz, ≤1.2 s, soft attack) on `pressureVesselBlueprint`
  milestone after the sting; mute respected; pure gain/rate helpers unit-tested.
- **T7 Machine rendering** — `src/game/entities/{MachineView,MachineAnimator}.ts`, `src/game/rendering/MachineLinks.ts`. Depends: T3, T5a.
  Acceptance: thermal driver = perSecond.pr in every animation path; `spin` parts start on `#rot` and pick `rotationFrame`; `gauge` low-passed frame; fire glow frames;
  `reciprocate` ram y = base + offset, clamped to midOffset when |Δθ|/dt > 1080; each strike (unclamped) spawns HAMMER_FX dust in `parts` and bumps
  `MachineView.getHammerStrikes(): number` (monotonic, reset → 0); pipes drawn from `rasterPipe` into one Graphics per distinct depth, redrawn only on
  visibility-key change, hidden while an endpoint is hidden/assembling; RT sized from MACHINE_BOUNDS; era I/II world pixels unchanged (stages s0–s9).
- **T8 Steam FX + pylon feeds wiring** — `src/game/rendering/{SteamFx(new),PylonLine}.ts`, `src/game/scenes/WorldScene.ts`. Depends: T3, T5b, T7 (getHammerStrikes).
  Acceptance: SteamFx = pooled world-space sprites (≤ STEAM_FX.poolSize, frame by age), emitters per STEAM_EMITTERS gated by tech + driver threshold; relief bursts
  every 6–9 s while PR/s > 50, once on reliefValves purchase, 4-puff burst on pressureVesselBlueprint milestone (CR-B); hammer puff per new strike;
  manifold puffs once boiler ≥ 1. PylonLine takes a `PylonFeed`; WorldScene builds one per PYLON_FEEDS; turbine line visible only when gate met AND pylonsLit
  visible, anchors left of the turbine; mast line unchanged. All destroyed on shutdown; 0 console errors.
- **T9 Stage + tree smoke** — `scripts/smoke/{stages.mjs,wp3-techtree.mjs,README.md}`. Depends: none (ids as strings).
  Acceptance: `@<milestoneId>` step jumps 8 h up to 8 times until owned (`@blueprint` kept as alias); `s10_boiler` = s9 + `@substationBlueprint`, `boiler`;
  `s11_era3_full` = s10 + inductionHeater×3, firebox×20, steamHammer, superheater, condenser×5, turbine, reliefValves, `@pressureVesselBlueprint`; logs camera,
  plaque text and component states for the 16 new ids; wp3-techtree tolerates 3 tabs (ERA III `SIGNAL ?` before substation).

## Waves (≤4 parallel; typecheck green at the end of every wave)
W1 = T1, T2, T9 · W2 = T3, T4, T5a, T5b · W3 = T6, T7, T8 · W4 = EM Mode B + Director smoke.
Transient (inside a wave only): W1 `status.ts` TS2366 until T1+T2 both land. W2 `animation.ts` until T3+T5a both land; runtime-only after W2: pipes mis-drawn,
rotor/ram/gauge static, no FX (fixed in W3). T8 codes against `getHammerStrikes()` from the contract while T7 writes it.

## Validation (EM Mode B)
Commands: `npm run typecheck` · `npm test` (all green, count ≥ HEAD + new) · `npm run build` (app chunk ≤ 200 KB) · `grep -rn "from 'phaser'" src/{simulation,data,persistence,utils}` empty.
**Balance** (`npx vitest run src/simulation/balance.sim.test.ts`; A 4 clicks/s 1 s buys 10800 s · B 4 clicks/s 30 s buys 12600 s · C 1 click/s 30 s buys 21600 s, no offline):
- Era I exact unchanged (gearRatio 4 … generatorBlueprint 1326); era II windows unchanged (generator 1500–2100, substation 3300–4500, B ≤ 5400, C ≤ 10800).
- A: boiler ∈ [3900, 4500] s; pressureVesselBlueprint ∈ [6300, 8100] s (105–135 min, roadmap §1); every era-III tech reached.
- B: pressureVesselBlueprint ≤ 9000 s. C: pressureVesselBlueprint ≤ 18000 s (casual ≤ 5 h; whole game ≤ 8 h budget).
- `maxPurchaseGap(purchases, firstAt.substationBlueprint, firstAt.pressureVesselBlueprint)` ≤ 1200 s for A, B, C. B never earlier than A for any tech.
- maxValue finite and < DESIGN_MAX_VALUE; deterministic; whole file < 10 s.
**Save:** v2 save without era-III keys → `loaded`, levels 0; v1 fixture migrates; round-trip lossless; offline cap 12 h only with reliefValves (tests).
**Smoke** (dev server; `PW_PATH=... node scripts/smoke/<x>.mjs`): wp2-crank, wp3-techtree, wp4-persistence, full-machine, `stages.mjs` s0–s11; 0 console errors.
- s0–s9 identical to WP8 look (same zooms: s9 0.75).
- s10: boiler, chimney (smoke rising), steam manifold, gauge + needle, P1 pipe header/riser, HUD PR row, plaque `RES?OR?`, zoom 0.75.
- s11: all 16 parts, fire stage 3 flicker ≤ 3 Hz, ram reciprocating + exhaust puffs, rotor spinning, P1–P3 + W1 pipes (W1 behind hammer bedplate), C1 cable,
  turbine → left pylon cable, relief bursts, plaque `REST?RE`, zoom 0.5 (centre x 1280). Frames arg `8` (`ONLY=s11_era3_full`) shows ram + rotor moving.
- Manual: T → ERA III tab `SIGNAL ?` before substation, then header "<n> PR"; keyboard-only purchase works; reload after a faked 10 h gap with reliefValves →
  welcome-back "Buffer capped at 12h"; crank text shows "+N ME  +M EE  +K PR" after steamHammer; boiler roar audible, whistle on milestone.
Docs (Director): PROJECT_STATUS is stale (WP8 not recorded) — update for WP8 + WP9 (era-III numbers, amendments A1/A2, offline effect).

## Out of scope
Era IV+ data/components, WORLD/GROUND_Y growth (era III fits 2560×1440 per ART_ERA3 §7), settings/reduced motion (WP10; FX must just stay within pool caps),
stats/achievements, prestige, export/import, music bed, new PNGs or bespoke era-III fallback painters, pipe flow animation, any `src/ui/*.css` change, save version bump.
