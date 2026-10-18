# WP11 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP11.md` (contracts C1-C4, decisions D1-D11, tasks T1-T9) + `docs/plan/ART_ERA5.md` (art contract) + real code read at HEAD `294399e` (WP10 committed; WP10 validation/review may still add small fixes in `src/game/entities`, `src/game/rendering`, `src/data`). Template: `WP10-assignments.md`.
Goal: Era V (Unknown Flux, XF, label `???`) playable `harmonicConvergence` -> `primaryFunction` purchase: 10 techs (+ `ending` marker effect), 38 machine parts on the delivered PNGs, `exotic` driver, world growth 3840x2160 / GROUND_Y 1680 / `CAMERA.minZoom 0.5`, violet sky + eclipse + horizon glow, world-space aperture beam, drone / swell / bead-tick audio, logs. NO finale, NO prestige.
Baseline (verified at HEAD by running `balance.sim.test.ts`: 33 tests pass, 3.7 s): era IV firstAt A resonatorSpire 122:51, crankServo 124:14, harmonicConvergence **174:13**; B **189:07**; C **351:33** = WP10 prototype exactly, so the WP11 era V cost prototype base holds (prototype A primaryFunction 254:37, B 270:00, C 447:30; T4 re-proves it once era V data lands). **Workers never touch `public/**`.** All 30 used PNGs exist (dims checked with `file`). No new fallback painters.

## How the Director uses this file
For every worker: spawn `implementation-worker`, paste **(1) the Common preamble** (fenced block) then **(2) exactly one assignment block**. Same-wave workers run in parallel (max 4). Between waves run that wave's tests (`npx vitest run <files>`) and `npx tsc --noEmit`, compare errors with the transient table, then start the next wave. Record the test count + file count at WP10 HEAD (`npx vitest run 2>&1 | tail -6`) BEFORE W1; every later run must keep it >=.

| Wave | Ids | Workers |
|---|---|---|
| 1 | **T1** Era V data + `ending` effect, **T2** world growth data + pure camera/parallax maths, **T8** Era V audio, **T9** smoke scripts | 4 |
| 2 | **T3a** machine components data, **T3b** palette + assets + sky data, **T4** balance sim + save compat, **T5** pure maths | 4 |
| 3 | **T6a** animator, **T6b** machine view + links + debug hook, **T7a** world-growth renderers, **T7b** sky + eclipse + beam + scene | 4 |
| 4 | EM Mode B (validate, glue only), reviewer, Art Director screenshot check, Director smoke | - |

Dependencies: T1, T2, T9 none; T8 needs T1 (tech-id literals; transient). T3a needs T1 (+ T3b `assetIds.ts` first, same wave). T3b needs T1 and T2 (`world.ts` handed over after W1). T4 needs T1. T5 needs T3a types (`import type` only, same wave, contract-first). T6a needs T3a + T5. T6b needs T3a and the T6a signatures below (same wave, contract-first). T7a needs T2. T7b needs T2, T3b and the T6b signature below (same wave, contract-first).

### Expected transient tsc errors (not a worker fault)
| After | Allowed to fail typecheck (inside the wave only) | Runtime-only at end of wave (typecheck clean) |
|---|---|---|
| W1 | `src/data/audio.ts` unknown `TechId` literals (`'nullChamber'`, `'finalAlignment'`) until T1 `types.ts` lands. `status.ts` / `rates.ts` both belong to T1: none. End of W1: none. | Sky drawn 3x too large (minZoom 1/3), backgrounds / ground / pylons phase-shifted, camera clamps to the new world; fixed in W3 (T7a, T7b). Dust still spawns over x 0..3840. |
| W2 | `src/game/math/animation.ts` TS2366 (`driverValue` switch) until T3a (`'exotic'`) AND T5 land; `src/data/machineComponents.ts` unknown `AssetId` literals until T3b lands `assetIds.ts` (T3b does that FIRST). End of W2: none. | Era V parts show but are static (no orbit / latch / stage / exotic frames; beads parked stacked on the core hub), no guy cables, no eclipse / violet sky / beam. |
| W3 | `src/game/scenes/WorldScene.ts` until T7b; `src/game/entities/MachineView.ts` until T6a's `consumeDepthChanged` / `latchFrame` exist. End of W3: typecheck, tests, build clean. | none |
Any other tsc error is a real bug. Workers run only their own tests; foreign tsc errors go in NOTES.

## EM decisions / deviations from WP11.md
1. **Pattern-phase helper.** C2 gives `patternShift` + `phaseShiftPx`, but the strip period is needed too: `ParallaxStripInput += phaseShiftPx?: number; periodPx?: number` (both optional; geometry changes only when BOTH are given, else today's exactly). T2 also adds `layerPhase(scrollFactor, artWidth, scale): { periodPx; phaseShiftPx }` in `parallax.ts` (`periodPx = artWidth * scale`, `phaseShiftPx = patternShift(scrollFactor, CAMERA.focus.x, PATTERN_ORIGIN_X, periodPx)`). Every renderer (ParallaxBackground, PylonLine, Terrain) uses this one helper so they cannot diverge.
2. **Ground tile shift without the Phaser tile-position API:** Terrain builds the ground tileSprite at `x = phaseShiftPx - periodPx`, `width = WORLD.width + periodPx` (same trick as the strips). `layerPhase(1, groundArtWidth 256, PIXEL_SCALE)` gives shift 128, period 512.
3. **Foreign tests that hard-code the old world** are fixed by T2 (owner of the constants): `src/game/math/machineLayout.test.ts` (anchor literal) is added to T2's files; `camera.test.ts`, `parallax.test.ts`, `world.test.ts` derive from constants. T2 also rewrites the `MACHINE_BOUNDS`-dependent assertions in `world.test.ts` (line ~142 `toBe(180)`) so they stay green after T3a changes the bounds in W2 (`>= 0` / derive).
4. **`milestonePhase` pure helper** (T5, additive to C4) so the finalAlignment bead timeline is unit-tested: `milestonePhase(secondsSince: number | null, alignMs: number, holdMs: number): { phase: 'none' | 'align' | 'hold'; t01: number }`. T6a uses it for beads (align then hold); core spin x3 and glow hold use plain comparisons with `coreSpinMs` / `glowHoldMs`.
5. **NamePlate must not change bounds:** `namePlate` is visible from the start (handCrank 1). Its box (x 44..84, y -107..-96) must lie inside the `supportFrame` box so `visibleMachineBounds` of every era I-IV level set is unchanged (T3a test).
6. **Ghost angle:** the ghost component keeps the data `{ kind: 'driven', ratio: +1.75, phaseDeg: 0 }` (art contract) but the animator special-cases `INVERSION_GHOST_FX.component`: angle = `mirrorAngle(drivenAngle of INVERSION_GHOST_FX.mirrorOf)` (D6); alpha / visibility from `echoAlpha`; it is NOT in `CRANK_PARTS`.
7. **Manifest origins unspecified in WP11:** `fx.beam` (0.5, 1), `bg.horizonGlow` (0.5, 0.5).
8. **Concurrent edits:** WP10 review fixes may land in `src/game/entities/*`, `src/game/rendering/*`, `src/data/*` while WP11 runs. WP11 edits are additive; every worker re-reads each file RIGHT BEFORE editing, uses small unique-anchor Edit calls, never rewrites a file from memory, never reverts a foreign hunk.

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP11: Era V (Unknown Flux, resource XF, label "???"), techs nullChamber..primaryFunction, world growth to 3840x2160. No finale, no prestige.
Era I-IV must behave EXACTLY as before: numbers, greedy times (era I: gearRatio 4, wornMotor 13, motorTuning 20, reinforcedCrank 196, flywheel 289, pistonArray 722, improvedPistons 758, generatorBlueprint 1326 s; era II windows generator 1500-2100, substationBlueprint 3300-4500; era III windows boiler 3900-4500, pressureVesselBlueprint 6300-8100; era IV windows resonatorSpire 7050-7800 (now 7371), harmonicConvergence 9900-12300 (now 10453)), pixels and strings. Exceptions: the new 40x11 name plate on the girder, and what follows from the world growth (see C2).
Baseline: typecheck clean, all tests green (count recorded by the Director before W1; never lower it).
Specs: docs/plan/WP11.md (contracts), docs/plan/ART_ERA5.md (art contract; wins for ids, files, sizes, origins, sockets, links, frames, FX and world numbers). This assignment text wins over both where they differ.

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, anything under public/, or ANY src/**/*.css.
- CONCURRENCY: other workers edit other files at the same time, and a WP10 review may touch src/game/entities, src/game/rendering, src/data.
  Re-read every file RIGHT BEFORE you edit it (and again before final validation). Keep edits SURGICAL (Edit tool, small unique anchors; never rewrite a whole file from memory). Era V changes are ADDITIVE.
  Never revert or "fix" a foreign change. Never touch era I / II / III / IV rows, ids or numbers (except where your task says so). If a foreign edit makes your test fail, report it in NOTES.
- PURE (no 'phaser' import, no window/document/AudioContext): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**, src/ui/*View.ts, src/ui/*Rules.ts, src/audio/audioMath.ts.
  `import Phaser from 'phaser'` only in src/game/{entities,rendering,scenes}, src/assets/fallbackTextures.ts, src/assets/painters/painterTypes.ts (type use only).
- All balancing / tuning numbers live in src/data/. No 0x...... colour literals under src/game, src/ui, src/audio. No tech-id string literals in src/audio or src/game logic (read ids from data tables).
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined values in src (a `!` in tests after an asserted lookup is fine).
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM, no Phaser at runtime), `*.test.ts` next to the code, `toBeCloseTo(x, 9)` for floats, avoid -0 in expectations. Never delete coverage: when a count / list changes, update the assertion to the new value and keep the test's intent; derive from data where possible.
- `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list them in NOTES. Run only your own tests (plus the named regression runs).
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== FINAL CONTRACTS (exact; every worker codes against these) ===

// ---- C1 Tech data (T1): src/data/{types,technologies,notifications,systemLogs}.ts + `ending` effect ----
TECH_IDS += 'nullChamber','containmentRing','resonantSiphon','graviticAnchor','inversionCrank','lensArray','horizonField','skyAperture','finalAlignment','primaryFunction'   // append only, this order
Effect |= { type: 'ending' }      // marker only: no rate / click / offline effect. WP12 starts the finale from it.
describeEffect({ type: 'ending' }, n) === 'Engages the primary function'
Era V rows (era 5 for all; requires items are { type:'tech', id, minLevel } / { type:'lifetime', res, amount }):
| id | name | kind | branch | costRes | baseCost | growth | maxLevel | effects | requires (in order) | tree col,row |
| nullChamber | Null Chamber | unlock | convergence | rs | 8000000 | null | null | [convert amount 0.1 res xf] | [tech harmonicConvergence 1] | 0,1 |
| containmentRing | Containment Ring | repeatable | mechanical | xf | 300 | 1.25 | 25 | [convert amount 0.05 res xf] | [tech nullChamber 1] | 1,0 |
| resonantSiphon | Resonant Siphon | repeatable | automation | rs | 10000000 | 1.35 | 20 | [autoAdd amount 2 res xf] | [tech nullChamber 1] | 1,2 |
| graviticAnchor | Gravitic Anchor | repeatable | origin | me | 1500000 | 1.5 | 10 | [rateMult factor 1.1 res 'all'] | [tech nullChamber 1] | 2,2 |
| inversionCrank | Inversion Crank | unlock | origin | xf | 4000 | null | null | [clickEcho seconds 3 res xf] | [tech containmentRing 3] | 2,0 |
| lensArray | Lens Array | unlock | mechanical | xf | 12000 | null | null | [rateMult factor 2 res xf] | [tech containmentRing 5] | 2,1 |
| horizonField | Horizon Field | repeatable | mechanical | xf | 40000 | 1.3 | 20 | [autoPct percent 15 res xf] | [tech lensArray 1] | 3,1 |
| skyAperture | Sky Aperture | unlock | automation | xf | 10000000 | null | null | [rateMult factor 3 res 'all'] | [tech horizonField 5, tech graviticAnchor 3] | 4,1 |
| finalAlignment | Final Alignment | milestone | convergence | xf | 0 | null | null | [none] | [tech skyAperture 1, tech inversionCrank 1, lifetime xf 200000000] | 5,1 |
| primaryFunction | Primary Function | unlock | convergence | xf | 500000000 | null | null | [ending] | [tech finalAlignment 1] | 6,1 |
Descriptions: nullChamber "A lantern on the spire holds a sphere of nothing. Converts RS into ???." · containmentRing "Another ring around the core. More ??? from the same resonance." · resonantSiphon "Glass siphons arc resonance into the core. +2 ???/s per level." · graviticAnchor "Piles at both ends guy the crown to the ground. x1.1 all production per level." · inversionCrank "Every turn leaves a turn going the other way. Clicks echo 3s of ???." · lensArray "Three lenses gather the core into one line. Doubles ??? production." · horizonField "The horizon glows on every side. +15% ??? production per level." · skyAperture "The crown opens to the sky. x3 all production." · finalAlignment "Every ring, lens and anchor now points the same way." · primaryFunction "Engage the primary function."
INSTALL_LINES (<= 60 chars; * = also the tech `flavor`): nullChamber* "Chamber sealed around nothing. Nothing is rising." · containmentRing "Ring aligned. The core did not touch it." · resonantSiphon "Siphon primed. It drinks the hum." · graviticAnchor "Anchor driven. The ground pulled back." · inversionCrank "The crank turned twice. Once backwards." · lensArray "Lenses focused. Target: upward." · horizonField "Horizon brightened. Sun not consulted." · skyAperture "Aperture open. The sky looked back." · finalAlignment* "Alignment complete. Awaiting operator." · primaryFunction "Primary function engaged."
Logs appended after `observer-one` (lifetime xf): { id 'units-unknown', text 'Units not recognised. Continuing.', atLeast 1000 }, { id 'cycle-0041', text 'Cycle 0041 nearly complete.', atLeast 1000000 }, { id 'operator-located', text 'Operator identity: located.', atLeast 100000000 }.
Plaque: NO new PLAQUE_LINES row. Save: additive tech keys default 0 -> NO save version bump.

// ---- C2 World growth (T2: src/data/world.ts + src/game/math/{camera,parallax}.ts; renderers T7a / T7b) ----
WORLD = { width: 3840, height: 2160 }; GROUND_Y = 1680; MACHINE_ANCHOR = { x: 1920, y: GROUND_Y }
CAMERA.focus = { x: 1920, y: GROUND_Y - 160 }; CAMERA.minZoom = 0.5   // explicit; the comment "derived" is removed
export const PATTERN_ORIGIN_X = 1280;    // world x the tiled patterns are phased to (= the pre-WP11 anchor): eras I-IV backgrounds stay pixel-identical
DUST.spawnHalfWidth = 1280               // dust spawns in MACHINE_ANCHOR.x +- spawnHalfWidth (was 0..WORLD.width)
// camera.ts
effectiveMinZoom(view: Size, world: Size, floor: number): number     // Math.max(floor, minZoomToFit(view, world)) -> 0.5 for the new world
// parallax.ts
patternShift(scrollFactor: number, focusX: number, originX: number, periodPx: number): number   // ((sf * (focusX - originX)) mod period + period) mod period, in [0, period); 0 when focusX === originX; never -0
layerPhase(scrollFactor: number, artWidth: number, scale: number): { periodPx: number; phaseShiftPx: number }   // EM decision 1
ParallaxStripInput += phaseShiftPx?: number; periodPx?: number     // when BOTH given: left = span.min - periodPx + phaseShiftPx, width = span width + periodPx; else today's geometry exactly
stageAlpha(stages: readonly { techId: TechId; minLevel: number; alpha: number }[], levels: Readonly<Record<TechId, number>>): number   // max alpha over met stages, 0 if none
stageFrame(stages: readonly { techId: TechId; minLevel: number; frame: number }[], levels): number                                       // frame of the LAST met stage in list order, 0 if none
skyPxToScrollZero(p: Vec2, view: Size, minZoom: number): Vec2          // view/2 + (p - view/2) / minZoom  (sky px -> sf-0 object position)
Every renderer that used `minZoomToFit(VIEW, WORLD)` (CameraController, ParallaxBackground sky size + strips, PylonLine) uses `effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom)`. Ground tile + every parallax strip + pylon wire anchors use `layerPhase` (ground: sf 1, art width of terrain.ground, scale PIXEL_SCALE).
`fitView` is unchanged.

// ---- C3 Machine + asset + sky data (T3a machineComponents, T3b palette / assets / sky) ----
type AnimationDriver = ... | 'exotic'                                  // = rates.perSecond.xf
ComponentAnimation |=
  | { kind: 'orbit'; ring: 1 | 2 | 3 | 4; phi0Deg: number; dir: 1 | -1; speed: SpeedCurve; speedScale: number; frontLayer: MachineLayer; frontBias: number }   // phi += dir * speed(exotic) * speedScale * dt; depth when sin(phi) >= 0: frontLayer/frontBias, else the component's own layer/bias
  | { kind: 'latch'; techId: TechId; minLevel: number; frames: number; fps: number }    // frame 0 until the gate holds, then 0 -> frames-1 once, hold last; gate already true at load = last frame
  | { kind: 'stage'; frames: number; gates: readonly (readonly [TechId, number])[]; endingFrame: number }   // frame = number of gates met; endingFrame unused until WP12
`frames` kind += frameOffset?: number                                  // frame = (framesIndex(...) + offset) % frames
export const RING_GEOMETRY = { 1: { a: 36, b: 7, tiltDeg: -10 }, 2: { a: 42, b: 10, tiltDeg: 16 }, 3: { a: 46, b: 13, tiltDeg: -24 }, 4: { a: 50, b: 18, tiltDeg: 30 } } as const;
export const INVERSION_GHOST_FX = { component: 'inversionGhost', mirrorOf: 'handCrank', echoSeconds: 3, alphaSteps: [{ untilS: 1.5, alpha: 1 }, { untilS: 2.25, alpha: 0.66 }, { untilS: 3, alpha: 0.33 }] } as const;
export const EXOTIC_MILESTONE_FX = { techId: 'finalAlignment', beadPhiDeg: 90, alignMs: 1500, holdMs: 2000, core: 'nullCore', coreSpinMult: 3, coreSpinMs: 2000,
  anchorGlows: ['anchorGlow1L','anchorGlow1R','anchorGlow2L','anchorGlow2R','anchorGlow3L','anchorGlow3R'], glowFrame: 2, glowHoldMs: 2000 } as const;
MachineLink += cableStyle?: 'power' | 'guy'                            // cable only, default 'power' (today's cyan)
MACHINE_LINK_STYLE.guy = { depth: MACHINE_LAYER_DEPTH.frame + 5, core: 0x3e4246, under: 0x1f2225 }
MACHINE_BOUNDS = { left: -560, right: 560, top: -616, bottom: 8 }      // RT 1120 x 624
Sockets appended (this order, 45 -> 60): galleryBase(64,-395) chamberBase(64,-418) coreHub(64,-490) lensBase(64,-534) apertureBase(64,-582) siphon1L(30,-418) siphon1R(98,-418) siphon2L(18,-418) siphon2R(110,-418) siphon3L(42,-418) siphon3R(86,-418) siphonArcs(64,-468) anchorL(-520,0) anchorR(520,0) plateSeat(64,-96)
Component ids appended (this order, 61 -> 99): nullGallery nullChamber nullCore nullCoreGlint ring1Back ring2Back ring3Back ring4Back ring1Front ring2Front ring3Front ring4Front ring1Bead ring2Bead ring3Bead ring4Bead siphonTube1L siphonTube1R siphonTube2L siphonTube2R siphonTube3L siphonTube3R siphonArcs1 siphonArcs2 siphonArcs3 graviticAnchorL graviticAnchorR anchorGlow1L anchorGlow1R anchorGlow2L anchorGlow2R anchorGlow3L anchorGlow3R inversionGhost lensLight lensColumn aperture namePlate
Links 14 -> 16 (appended after R1): G1 nullChamber.eyeL -> graviticAnchorL.eye, G2 nullChamber.eyeR -> graviticAnchorR.eye, kind 'cable', sag 6, cableStyle 'guy'.
Shadows 7 -> 9 (appended): graviticAnchorL x -536 y 0 w 32 h 2; graviticAnchorR x 504 y 0 w 32 h 2.
Assets (+30, appended after the WP10 ids, this order): machine.nullGallery .nullChamber .nullCore .nullCoreGlint .ring1Back .ring2Back .ring3Back .ring4Back .ring1Front .ring2Front .ring3Front .ring4Front .ringBead .siphonTube .siphonArcs1 .siphonArcs2 .siphonArcs3 .graviticAnchor .anchorGlow1 .anchorGlow2 .anchorGlow3 .inversionGhost .lensLight .lensColumn .aperture .namePlate, then bg.skyViolet, bg.eclipse, bg.horizonGlow, fx.beam.
Rotation sheets 12 -> 14: machine.nullCore 'machine/era5/rot/null-core-rot.png' 64 frames; machine.inversionGhost 'machine/era5/rot/inversion-ghost-rot.png' 80 frames.
src/data/world.ts sky additions (T3b, after T2's constants):
  ParallaxLayerDef += alphaStages?: readonly { techId: TechId; minLevel: number; alpha: number }[]   // target alpha = stageAlpha(); fades PARALLAX_FADE_MS; never combined with visibleWhen
  PARALLAX_LAYERS += { id: 'skyViolet', assetId: 'bg.skyViolet', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background + 1, alpha: 1, underfill: null,
                       alphaStages: [{ techId: 'nullChamber', minLevel: 1, alpha: 0.25 }, { techId: 'lensArray', minLevel: 1, alpha: 0.5 }, { techId: 'horizonField', minLevel: 5, alpha: 0.75 }, { techId: 'skyAperture', minLevel: 1, alpha: 1 }] },
                     { id: 'horizonGlow', assetId: 'bg.horizonGlow', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background + 3, alpha: 1, underfill: null,
                       alphaStages: [{ techId: 'horizonField', minLevel: 1, alpha: 0.35 }, { techId: 'horizonField', minLevel: 10, alpha: 0.55 }, { techId: 'horizonField', minLevel: 20, alpha: 0.75 }] }   // both appended after pylonsLit
  export const ECLIPSE = { assetId: 'bg.eclipse', skyPx: { x: 372, y: 290 }, depth: DEPTH.background + 2,
    stages: [{ techId: 'nullChamber', minLevel: 1, frame: 1 }, { techId: 'lensArray', minLevel: 1, frame: 2 }, { techId: 'horizonField', minLevel: 5, frame: 3 }, { techId: 'skyAperture', minLevel: 1, frame: 5 }],
    diamond: { techId: 'skyAperture', frame: 4, ms: 1200 } } as const;     // frame 0 (= baked sun) -> sprite hidden
  export const APERTURE_BEAM = { assetId: 'fx.beam', component: 'aperture', minLatchFrame: 3, artX: 64, footArtY: -588, fps: 8, alpha: 0.85, depth: DEPTH.machine + 1 } as const;
    // tile 32 world px wide (16 art px x 2), centre x MACHINE_ANCHOR.x + 2*64, bottom GROUND_Y - 2*588, top world y 0, blend NORMAL. `component` is a plain string literal (no MachineComponentId import in world.ts).
PALETTE += violetDark 0x24162f, violet 0x54367a, violetLight 0x9a6ad0, violetPale 0xe0c8ff, dusk0 0x2b2236, dusk1 0x3e3049, dusk2 0x5b4a5f, dusk3 0x7d6a72   (+ PALETTE_CSS twin)

// ---- C4 Pure maths (T5: src/game/math/animation.ts) ----
driverValue(driver, manual, automation, electric = 0, thermal = 0, resonance = 0, exotic = 0): number     // 'exotic' -> exotic
orbitPoint(ring: { a: number; b: number; tiltDeg: number }, phiDeg: number): Vec2   // t, p in rad: X = a cos p cos t - b sin p sin t, Y = a cos p sin t + b sin p cos t (+y down); never -0
orbitFront(phiDeg: number): boolean                           // sin(phi) >= 0, exact at multiples of 90 deg (0, 90, 180 true; 270 false)
orbitStep(phiDeg: number, dir: 1 | -1, degPerSec: number, dt: number): number   // wrapped into [0, 360)
alignStep(phiDeg: number, targetDeg: number, dir: 1 | -1, t01: number): number  // move along dir from phi to the next angle == targetDeg (mod 360); t01 0..1 linear; t01 1 lands on target exactly
latchFrame(secondsSinceGate: number | null, frames: number, fps: number): number // null -> 0; >= (frames-1)/fps -> frames-1; loaded-with-gate -> pass Infinity
stageFrameOf(gatesMet: number, frames: number, restored = false, endingFrame?: number): number   // clamp(gatesMet, 0, frames-1); restored (and endingFrame given) -> endingFrame
echoAlpha(secondsSinceClick: number | null, steps: readonly { untilS: number; alpha: number }[]): number   // null or >= last untilS -> 0; else alpha of the first step with s < untilS (hard steps)
mirrorAngle(deg: number): number                              // -deg normalised to [0, 360), never -0
milestonePhase(secondsSince: number | null, alignMs: number, holdMs: number): { phase: 'none' | 'align' | 'hold'; t01: number }   // EM decision 4

// ---- Shared render-side signatures (contract-first across W3 workers) ----
MachineAnimator.consumeDepthChanged(): boolean         // T6a: true once after any bead changed front/back depth since the last call, then false
MachineAnimator.latchFrame(id: MachineComponentId): number | null     // T6a: current frame of a latch part, null for any other part
MachineView.latchFrame(id: MachineComponentId): number | null         // T6b: passthrough to the animator
window.__wedtmd.machineStats(): { meanMs: number; maxMs: number; components: number }   // T6b
window.__wedtmd.cameraState(): { zoom; centerX; centerY; relX; relY }   // T6b: rel = centre - MACHINE_ANCHOR
```

---

# WAVE 1 (parallel: T1, T2, T8, T9 - disjoint files; repo green at start)

## T1 - Era V data, `ending` effect, logs, install lines

**wave**: 1. **files_owned**: `src/data/types.ts`, `src/data/technologies.ts`, `src/data/technologies.test.ts`, `src/data/notifications.ts`, `src/data/systemLogs.ts`, `src/simulation/production/rates.ts`, `src/simulation/production/rates.test.ts`, `src/simulation/progression/status.ts`, `src/simulation/progression/progression.test.ts`, `src/simulation/state.test.ts`, `src/ui/systemLogRules.test.ts`, `src/ui/techTreeView.test.ts`, `src/ui/hudView.test.ts` (only if broken)

**objective**: land C1 exactly; era I-IV rows untouched; add the `ending` marker effect (no rate / click / offline contribution); fix foreign tests that hard-code counts.

**context** (read all files first; re-read right before editing; the era IV block in `technologies.ts` ends with `harmonicConvergence` and is the format template):
- `types.ts`: append the ten ids to `TECH_IDS` after `'harmonicConvergence'`; add `| { type: 'ending' } // marker: starts the finale (WP12); no rate, click or offline effect` to `Effect` before `none`.
- `technologies.ts`: append ten definitions AFTER `harmonicConvergence` (same field order as the era IV rows: id, name, kind, branch, era, costRes, baseCost, growth, maxLevel, effects, requires, description, [flavor], tree). `nullChamber.flavor` = its install line; `finalAlignment.flavor` = its install line. Do not touch any other row (`git diff -U0 -- src/data/technologies.ts | grep '^-[^-]'` must be empty or only foreign hunks).
- `notifications.ts`: add ten entries at the end of `INSTALL_LINES` (after `harmonicConvergence`). `systemLogs.ts`: append three entries after `observer-one`. NO change to `story.ts`.
- `rates.ts`: in the effect switch add `case 'ending': break; // marker only` next to `case 'none'` (header comment: `ending` contributes nothing). `status.ts`: `describeEffect` `case 'ending': return 'Engages the primary function';`. Grep `src` for other exhaustive switches on `Effect['type']` (`case 'autoClick'`) outside your files: report them in NOTES instead of editing.
- `rates.test.ts`: new case using the existing `withEffects` helper (injected table, never the real era V rows): `withEffects({ gearRatio: [{ type: 'ending' }] })` with `withLevels({ gearRatio: 3 })` gives `perClick` and `perSecond` deep-equal to the same table with `gearRatio` effects `[]`. Also assert the offline-cap field of the rates result (read `rates.ts` for its name) is unchanged by `ending`.
- `progression.test.ts` (inside `describe('describeEffect')`): `describeEffect({ type: 'ending' }, 1) === 'Engages the primary function'` and for n = 3.
- `state.test.ts`: only if a tech count is hard-coded (use `TECH_IDS.length`). `systemLogRules.test.ts`: the cap `<= 17` -> `<= 20` (title and `toBeLessThanOrEqual(20)`); every `logState(T0, { me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9 })` also gets `xf: 1e9` (check `logState`'s param type); `shown.size === SYSTEM_LOGS.length` stays true (raise a loop bound only if it fails). `techTreeView.test.ts`: real-data tab assertions: lengths `4 -> 5`, `[1,2,3,4] -> [1,2,3,4,5]`, `reached` arrays get a trailing `false`, add `expect(tabs[4]).toEqual({ era: 5, label: 'SIGNAL ?', reached: false, selected: false, resourceText: '' })` where the test uses the real table (adapt to what fails if tables are injected; derive from data where possible).
- `technologies.test.ts` (structure: `ERA_FOUR_IDS`, literal tables): `TECH_LIST toHaveLength(36)` -> 46; era list `[1,2,3,4]` -> `[1,2,3,4,5]`; the `costRes` per-era tests must stay true for eras I-IV (restrict id lists if they assert "only X on era N"). Add `const ERA_FIVE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 5)` and `describe('era V technology table')`: (1) literal table of all ten rows equal to C1 (id -> kind, era, costRes, baseCost, growth, maxLevel, tree, branch, effects, requires); (2) every tech reachable from `handCrank` (existing BFS test covers 46); (3) tree positions unique within era 5; (4) costRes: me only graviticAnchor, rs only nullChamber + resonantSiphon, xf the other seven; (5) names <= 19 chars for every tech; (6) `PLAQUE_LINES` still has five entries (unchanged); (7) `ending` appears exactly once in the table (`primaryFunction`, its only effect); (8) INSTALL_LINES has a line for every tech id, unique, <= 60 chars, nullChamber and finalAlignment lines equal their flavors; (9) the three new logs are the last three, exact ids / texts / thresholds, thresholds increase within resource `xf`; (10) the prerequisite graph is acyclic (extend the existing test or a DFS); (11) every era V tech's prerequisite chain contains `harmonicConvergence` (nothing of era V is reachable earlier).

**constraints**: pure; no Phaser / DOM; no `any`; no other file.

**acceptance**: C1 table exact; 46 techs; acyclic; all reachable; unique tree pos per era; era I-IV rows byte-identical; INSTALL_LINES complete (<= 60); 3 logs increasing; `ending` contributes nothing to perClick / perSecond / offline cap (test with an injected table); describe text exact; names <= 19 chars.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/(data/(types|technologies|notifications|systemLogs)|simulation|ui)" && echo FAIL || echo OK     # src/data/audio.ts literals may fail until T8: ignore
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/types.ts src/data/technologies.ts src/data/notifications.ts src/data/systemLogs.ts src/simulation/production/rates.ts src/simulation/progression/status.ts && echo FAIL || echo OK
git diff -U0 -- src/data/technologies.ts | grep -E "^-[^-]" && echo CHECK_REMOVED_LINES || echo ONLY_ADDITIONS
git diff --stat -- src/simulation/GameSession.ts src/data/story.ts     # must be empty
npx vitest run 2>&1 | tail -8     # list failing files that are NOT yours in NOTES
```

## T2 - World growth data + pure camera / parallax maths + framing test

**wave**: 1. **files_owned**: `src/data/world.ts`, `src/data/world.test.ts`, `src/game/math/camera.ts`, `src/game/math/camera.test.ts`, `src/game/math/parallax.ts`, `src/game/math/parallax.test.ts`, `src/game/math/machineLayout.test.ts`, new `src/game/math/framing.test.ts`

**objective**: C2 constants and pure functions only. No renderer edits (T7a / T7b). Existing exports stay compatible (`minZoomToFit`, `parallaxStrip` default geometry, `fitView`).

**context** (read the files; re-read `world.ts` right before editing: the WP10 review may have touched it):
- `world.ts`: `WORLD`, `GROUND_Y`, `MACHINE_ANCHOR`, `CAMERA.focus` per C2 (keep every other `CAMERA` field; add `minZoom: 0.5`; replace the trailing "minZoom is derived ..." comment with "minZoom explicit (below 0.5 one art px is smaller than a screen px)", keep the other two comment clauses); add `export const PATTERN_ORIGIN_X = 1280;` with a comment; `DUST` gets `spawnHalfWidth: 1280` (extend its inline type). Do NOT add the sky constants (T3b does, in W2). Nothing else. The literals 1280 / 1120 may remain in `world.ts` only (VIEW, PATTERN_ORIGIN_X, spawnHalfWidth).
- `camera.ts`: add `effectiveMinZoom(view, world, floor)` next to `minZoomToFit` (keep `minZoomToFit`).
- `parallax.ts`: add `patternShift`, `layerPhase`, `stageAlpha`, `stageFrame`, `skyPxToScrollZero`; extend `ParallaxStripInput` + `parallaxStrip` (phase only when BOTH `phaseShiftPx` and `periodPx` are defined). `layerPhase` imports `CAMERA`, `PATTERN_ORIGIN_X` from `../../data/world` (pure data import is fine). `patternShift` returns `0` (not -0) for an exact multiple; non-finite inputs -> 0.
- Tests that hard-code the old world and WILL break; fix them (derive from constants, keep the intent): `machineLayout.test.ts` line ~42 (`machineLocalToWorld({0,0})` equals `{ x: MACHINE_ANCHOR.x, y: MACHINE_ANCHOR.y }`); `camera.test.ts` line ~27 (`minZoomToFit(VIEW, WORLD)` is now 1/3: assert `toBeCloseTo(1/3, 9)` and add `effectiveMinZoom(VIEW, WORLD, 0.5) === 0.5`; `effectiveMinZoom({1280,720}, {1280,720}, 0.25) === 1`), lines ~50-51 and ~373-374 (clampCenter / fitView expectations using `WORLD`: recompute for the new world, or use a local `OLD_WORLD = { width: 2560, height: 1440 }` where the test is about clamping geometry, not the game world); `parallax.test.ts` (uses `minZoomToFit(VIEW, WORLD)`: switch to `effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom)` or a local old world where exact numbers matter; its literal-2560 tests stay); `world.test.ts` (assertions on world numbers: derive from constants; the bounds-fit block at lines ~130-142 must stay green AFTER T3a sets `MACHINE_BOUNDS` to -560/560/-616: use `>= 0` / `<= WORLD.*` instead of `toBe(180)`; `DUST_RISING` and `GROUND_SHADE` tests stay).
- New tests:
  - `world.test.ts`: C2 constants exact (`WORLD`, `GROUND_Y`, `MACHINE_ANCHOR`, `CAMERA.focus` = anchor.x / `GROUND_Y - 160`, `CAMERA.minZoom` 0.5, `PATTERN_ORIGIN_X` 1280, `DUST.spawnHalfWidth` 1280); `MACHINE_ANCHOR.x +- DUST.spawnHalfWidth` inside the world; `CAMERA.focus` inside the world.
  - `camera.test.ts`: `effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom) === 0.5`.
  - `parallax.test.ts`: `patternShift`: sf 0 -> 0; focus === origin -> 0; `(0.3, 1920, 1280, 1024)` = 192; `(0.55, 1920, 1280, 512)` = 352; `(1, 1920, 1280, 512)` = 128; negative `focusX - originX` gives a value in [0, period); never `Object.is(v, -0)` over a small grid. `parallaxStrip` with neither / only one of the two new fields deep-equals today's output; with both: `left = span.min - periodPx + phaseShiftPx`, `width = span width + periodPx`, `bottom` and `height` unchanged. `layerPhase(0.3, 512, 2)` = `{ periodPx: 1024, phaseShiftPx: patternShift(0.3, CAMERA.focus.x, 1280, 1024) }`. **Pattern invariance:** for every `PARALLAX_LAYERS` scrollFactor > 0 and art widths 256 and 512: the screen x of a tile boundary with the camera centred on `CAMERA.focus` (screen = objectX - sf * (focus.x - view.width / 2); boundary object x = strip.left + k * period) equals, modulo the period, the legacy value (legacy focus x 1280, no phase, `strip.left = span.min`). `stageAlpha`: none met 0, one met, several met (max, even when a later stage has a lower alpha), unmet; `stageFrame`: last met in list order, none -> 0; `skyPxToScrollZero({372,290}, VIEW, 0.5)` = (104, 220); at minZoom 1 it returns the input.
  - new `framing.test.ts`: import `visibleMachineBounds`, `boundsToWorld` (`./machineBounds`), `fitView`, `effectiveMinZoom`. Inline tech-level sets (all other techs 0, helper over `TECH_IDS`) for stages s0 (none), s1 gearRatio 1, s2 wornMotor 1, s3 wornMotor + gearRatio 1, s7 (full era I), s9 (era II full), s10, s11 (era III full), s13 (era IV full): take the exact buy lists from `scripts/smoke/stages.mjs` (S7 / S9 / S10 / S11 / S13 buys; `@x` markers mean tech x = 1). For each: `fitView` with LEGACY inputs (world `{2560,1440}`, anchor (1280,1120), focus (1280, 960), margin / pixelScale / maxZoom / defaultZoom / hudTopInsetPx as `CameraController.target()` uses them, minZoom 0.5) and with NEW inputs (`WORLD`, `MACHINE_ANCHOR`, `CAMERA.focus`, `effectiveMinZoom`). Whenever the legacy zoom >= 0.75 the new zoom equals it and `centre - anchor` is identical (legacy centre - (1280,1120) equals new centre - MACHINE_ANCHOR). For the zoom-0.5 sets (s11, s13): new zoom 0.5; the new view (`viewBounds`) contains the machine world bounds grown by the margin; the machine top screen y `(top - centre.y) * 0.5 + 360` is >= the smaller of `CAMERA.hudTopInsetPx` and the bottom-capped value (compute both). Pin D4: s11 ground screen y `(MACHINE_ANCHOR.y - centre.y) * 0.5 + 360` = 480 and s13 = 640 (`toBeCloseTo`); if the real fitView gives different numbers STOP and report them in NOTES instead of editing the expectation.
- Do NOT edit `MACHINE_BOUNDS` / machineComponents (T3a). Framing uses only era I-IV components, so it stays valid after W2 (namePlate is inside the frame, see EM 5).

**constraints**: pure data / maths; no Phaser; no renderer files; `world.ts` additive + the C2 numbers only.

**acceptance**: C2 exact; `effectiveMinZoom(VIEW, WORLD, 0.5) === 0.5`; `patternShift` cases; default `parallaxStrip` unchanged; pattern invariance test; framing test as above; all existing tests (updated where they used the old world) green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/world.test.ts src/game/math
npx tsc --noEmit 2>&1 | grep -E "^src/(data/world|game/math)" && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/data/world.ts src/game/math/camera.ts src/game/math/parallax.ts && echo FAIL || echo OK
grep -n "1280\|1120" src/data/world.ts          # only VIEW, PATTERN_ORIGIN_X, DUST.spawnHalfWidth (and comments) may remain
git diff -U0 -- src/data/world.ts | grep -E "^-[^-]"     # only the lines you changed (WORLD, GROUND_Y, MACHINE_ANCHOR, CAMERA, comment) + foreign hunks
```

## T8 - Era V audio

**wave**: 1. **files_owned**: `src/data/audio.ts`, `src/audio/gameAudio.ts`, `src/audio/synth.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`

**objective**: sub-bass drone (log XF/s, silent until nullChamber), reversed-swell purchase sound for era 5, soft bead ticks on the finalAlignment milestone after the sting; mute respected; era I thunk, II relay, III hiss, IV fork ping, whistle, chord unchanged.

**context** (read all five; model functions in `synth.ts`: the WP10 `setPad` (persistent oscillators + LFO), `playForkPing`, `playChord`, `playWhistleTone`, `playHiss` (noise burst), `close()`; in `gameAudio.ts`: `tick()`, the purchase / milestone handlers; re-read before editing):
- `data/audio.ts` (add before `} as const;`, comments in the file's style; `techId` literals resolve once T1 lands):
  ```
  drone: { hz: 41, partialRatio: 2, partialGain: 0.3, lfoHz: 0.07, lfoDepth: 0.35, minGain: 0.02, maxGain: 0.09, refPerSecond: 1, maxPerSecond: 100000000, techId: 'nullChamber' },
  swell: { ms: 900, noiseLowpassFromHz: 300, noiseLowpassToHz: 2400, noiseGain: 0.18, sawHz: 110, sawGain: 0.12, gain: 0.3 },
  beadTick: { hz: 2200, count: 4, gapMs: 80, ms: 30, gain: 0.12, techId: 'finalAlignment' },
  ```
- `audioMath.ts` (pure; reuse `activityLevel`, `clampRange`, `lerp`): `droneGain(xfPerSecond: number, owned: boolean, cfg = AUDIO.drone): number` (same shape as `padGain`: 0 when `!owned` or `!(xf > 0)`; else `clampRange(lerp(minGain, maxGain, activityLevel(xf, ref, max)), minGain, maxGain)`).
- `synth.ts`: `setDrone(gain: number): void` (persistent: a sine at `hz` plus a sine at `hz * partialRatio` through a gain `partialGain`, into a drone gain into master; a slow sine LFO at `lfoHz` into a depth gain on the drone gain's AudioParam like the pad; lazily created; `gain === 0` and never started -> return; gain moved with `setTargetAtTime`); `playSwell(): void` (reversed swell: a noise buffer through a lowpass whose cutoff rises exponentially `noiseLowpassFromHz` -> `noiseLowpassToHz` over `ms`, plus a sawtooth at `sawHz`; both through one gain that rises exponentially from the floor to `gain` over `ms / 1000` and then STOPS HARD (gain to 0 with a ~5 ms ramp at the end, sources stopped and disconnected when done); reuse the noise-buffer helper `playHiss` uses); `playBeadTicks(delaySeconds = 0): void` (`count` short sine ticks at `hz`, `gapMs` apart, each `ms` long with exponential decay, the first starting `delaySeconds` from now; nodes disconnected when done). `close()` also stops / disconnects the drone oscillators + LFO (inside the existing try). Errors never escape (use `run`).
- `gameAudio.ts`: `tick()` not muted: `s.setDrone(droneGain(session.rates.perSecond.xf, levels[AUDIO.drone.techId] >= 1));` next to the pad line; muted branch `s.setDrone(0);` next to `s.setPad(0)`. Purchase handler: `if (era >= 5) s.playSwell(); else if (era >= 4) s.playForkPing(); else if ...` (keep the lower branches exactly). Milestone handler: add `if (id === AUDIO.beadTick.techId) s.playBeadTicks((AUDIO.sting.notesHz.length * AUDIO.sting.noteMs) / 1000);` after the chord line. Click handler unchanged. Update doc comments.

**acceptance (tests, `audioMath.test.ts` only)**: `droneGain`: 0 when not owned (even xf 1e12); 0 for xf 0, negative, NaN; > 0 for xf 1 owned; within `[minGain, maxGain]` for xf 1e15; monotone non-decreasing over xf = 1, 10, 1e3, 1e6, 1e9; at `maxPerSecond` equals `maxGain` (toBeCloseTo). Existing cases untouched. `src/audio` and `src/data/audio.ts` typecheck clean once T1's ids exist.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio
npx tsc --noEmit 2>&1 | grep -E "^src/(audio|data/audio)" && echo "FAIL (ok only for the two TechId literals until T1 lands)" || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/audio/gameAudio.ts src/audio/synth.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/audio/*.ts && echo FAIL || echo OK
grep -nE "'(nullChamber|finalAlignment|resonatorSpire|echoCrank|crankServo|harmonicConvergence|pressureVesselBlueprint)'" src/audio/gameAudio.ts src/audio/synth.ts src/audio/audioMath.ts && echo FAIL_LITERAL || echo OK
```

## T9 - Stage + tree smoke scripts

**wave**: 1. **files_owned**: `scripts/smoke/stages.mjs`, `scripts/smoke/wp3-techtree.mjs`, `scripts/smoke/README.md`

**objective**: smoke stages for Era V (plus perf probe) and a tree smoke that tolerates five tabs. Tech and component ids are plain strings; hook fields that land later (`machineStats`, `relX`) are optional-chained.

**context** (read the three files; `stages.mjs` has `S7`, `S9`, `S10`, `S11`, `S12`, `PARTS`, `PARTS4`, stages up to `s13_era4_full` with the era IV list inline; `wp3-techtree.mjs` ends with the `12_*` block then `res.errors = errors`):
- `stages.mjs`: s0-s13 behave unchanged. Refactor the inline s13 list into `const S13 = [...S12, ...Array(3).fill('crankServo'), ...Array(25).fill('harmonicCoil'), ...Array(3).fill('pressureResonator'), 'echoCrank', 'phaseLock', ...Array(3).fill('standingWave'), 'crystalLattice', '@harmonicConvergence'];` and `s13_era4_full: S13` (same buys). Add `const S14 = [...S13, 'nullChamber'];` `const S15 = [...S14, ...Array(25).fill('containmentRing'), ...Array(20).fill('resonantSiphon'), ...Array(10).fill('graviticAnchor'), 'inversionCrank', 'lensArray', ...Array(20).fill('horizonField'), 'skyAperture', '@finalAlignment'];` `const S16 = [...S15, 'primaryFunction'];` stages `s14_null: S14`, `s15_era5_full: S15`, `s16_primary: S16`. Add `PARTS5` = the 38 Era V component ids in the C3 order (nullGallery ... namePlate, exactly the list in FINAL CONTRACTS) and print `console.log(name, 'parts5', JSON.stringify(<same evaluate as parts4>))` for `s14_null`, `s15_era5_full`, `s16_primary`. The existing camera print already logs the whole `cameraState()` object (it gains `relX` / `relY` once T6b lands): keep it. For `s15_era5_full` and `s16_primary` only: AFTER the existing 2500 ms wait and BEFORE the screenshot, re-read `crankClientPoint()` and click the crank 3 times (so the 3 s inversion ghost is visible in the screenshot and the `nframes` frames), then wait 150 ms. Env `PERF=1`: for `s13_era4_full` and `s15_era5_full` after the screenshot wait 3000 ms and print `console.log(name, 'machineStats', JSON.stringify(await p.evaluate(() => window.__wedtmd.machineStats?.() ?? null)))`. Plaque, `@` marker logic, `nframes`, `FRAME_MS`, `ONLY`, the final `errors` line unchanged.
- `wp3-techtree.mjs`: keep every existing check and key; the era IV block's expectations change because the era V tab now exists: update the comments next to `11_tabCount` / `12_tabCount` to "expect 5". Add `res['12_tab5']` = text of the fifth `.tech-tab` (expect `SIGNAL ?`, `''` when missing) right after `12_tabCount`. After the `12_spire` line and before the final `Escape` / `res.errors` lines append: fast-forward to harmonicConvergence inside one `page.evaluate` with the same jump / retry rules (copy the existing fast-forward pattern; `buys` = the full S13 list written inline), reopen via `#hud-tech`, record `13_tabs` (same shape as `12_tabs`; expect ERA V enabled, text starting `ERA V`), `13_tabCount` (expect 5), click `#tech-tab-5`, record `13_header` (`#tech-me`, expect ends `???`), `13_nodes` (visible `.tech-node` count, expect 10), `13_null` (class list of `[data-tech=nullChamber]`, fallback `'missing'`). Do not assert; only `ok(...)`.
- `README.md`: stage list text: add `s14_null`, `s15_era5_full`, `s16_primary` (these print `parts5`; s15 / s16 click the crank 3x before the shot), the `PERF=1` line, the new result keys; keep the `@<techId>` line.

**constraints**: `.mjs` only; no `src/` edits.

**acceptance**: `node --check` passes both; new stage names exactly `s14_null`, `s15_era5_full`, `s16_primary`; new result keys exactly `12_tab5`, `13_tabs`, `13_tabCount`, `13_header`, `13_nodes`, `13_null`; `PARTS5` has 38 unique ids.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
node --check scripts/smoke/stages.mjs && node --check scripts/smoke/wp3-techtree.mjs && echo SYNTAX_OK
grep -n "s14_null\|s15_era5_full\|s16_primary\|parts5\|machineStats\|13_tabs\|12_tab5" scripts/smoke/stages.mjs scripts/smoke/wp3-techtree.mjs
node -e "const s=require('fs').readFileSync('scripts/smoke/stages.mjs','utf8'); const m=s.match(/const PARTS5 = \[([^\]]*)\]/); const a=m[1].split(',').map(x=>x.trim().replace(/'/g,'')).filter(Boolean); console.log(a.length, new Set(a).size)"     # 38 38
git diff --stat -- src     # must show no change by you
```

---

# WAVE 2 (parallel: T3a, T3b, T4, T5 - disjoint files; wave 1 done and green)

## T3a - Machine components data

**wave**: 2. **files_owned**: `src/data/machineComponents.ts`, `src/data/machineComponents.test.ts`

**objective**: C3 machine part: types, sockets, 38 components, 2 links, 2 shadows, bounds, FX consts, guy style. Era I-IV component data byte-identical. Types FIRST (T5 / T6a / T6b rely on them).

**context** (read file + test first; re-read before each edit; the WP10 review may have touched both: keep foreign hunks):
1. Types: `AnimationDriver` += `| 'exotic'` (comment `exotic: XF/s (rates.perSecond.xf)`); `ComponentAnimation` += the `orbit`, `latch`, `stage` variants exactly as C3; the `frames` variant += `frameOffset?: number` (comment); `MachineLink` += `cableStyle?: 'power' | 'guy'` (cable only); `MACHINE_LINK_STYLE.guy = { depth: MACHINE_LAYER_DEPTH.frame + 5, core: 0x3e4246, under: 0x1f2225 }` (0x literals are allowed in this data file, same as `cable`); `MACHINE_BOUNDS = { left: -560, right: 560, top: -616, bottom: 8 }` (comment: aperture box rows -610..-583 need -616; RT 1120 x 624).
2. `MACHINE_COMPONENT_IDS`: append the 38 ids in the C3 order after `'crystal'`. `SOCKET_IDS`: append the 15 ids after `'servoHub'`; `MACHINE_SOCKETS`: add the 15 coordinates (comment `// Era V seats: gallery / chamber / core hub / lens / aperture, siphon pairs, siphon arcs, anchors, name plate.`).
3. Add the 38 definitions after `crystal` (before the closing `};`), same field layout, `effects: []`, comments in the file's style. Columns: tech>=level / assetId / size / origin / socket (offset 0,0) / layer + depthBias ("-" = omit) / animation / connections:

| id | tech>=lvl | assetId | size | origin | socket | layer/bias | animation | connections |
|---|---|---|---|---|---|---|---|---|
| nullGallery | nullChamber>=1 | machine.nullGallery | 128x30 | .5,1 | galleryBase | mid/3 | none | - |
| nullChamber | nullChamber>=1 | machine.nullChamber | 128x116 | .5,1 | chamberBase | mid/5 | none | `eyeL` (-62.5,-109.5) cable, `eyeR` (62.5,-109.5) cable |
| nullCore | nullChamber>=1 | machine.nullCore | 64x64 | .5,.5 | coreHub | mid/7 | `{ kind: 'spin', driver: 'exotic', speed: { base: 6, gain: 30, min: 6, max: 240 } }` | - |
| nullCoreGlint | nullChamber>=1 | machine.nullCoreGlint | 64x64 | .5,.5 | coreHub | mid/8 | none | - |
| ring1Back..ring4Back | containmentRing>=1 / 8 / 16 / 25 | machine.ring1Back..ring4Back | 112x72 | .5,.5 | coreHub | mid/6 | none | - |
| ring1Front..ring4Front | same levels | machine.ring1Front..ring4Front | 112x72 | .5,.5 | coreHub | mid/9 | none | - |
| ring1Bead..ring4Bead | same levels | machine.ringBead | 5x5 | .5,.5 | coreHub | mid/6 | `{ kind: 'orbit', ring: N, phi0Deg: 0 / 97 / 194 / 291, dir: 1 / -1 / 1 / -1, speed: { base: 20, gain: 25, min: 20, max: 180 }, speedScale: 1 / 1.25 / 1.5 / 1.75, frontLayer: 'front', frontBias: 0 }` | - |
| siphonTubeSL / siphonTubeSR (S = 1..3) | resonantSiphon>=1 / 10 / 20 | machine.siphonTube | 12x30 | .5,1 | siphonSL / siphonSR | mid/4 | none | - |
| siphonArcs1..3 | resonantSiphon>=1 / 10 / 20 | machine.siphonArcs1..3 | 128x64 | .5,.5 | siphonArcs | mid/8 | `{ kind: 'frames', frames: 4, maxHz: 8, driver: 'exotic', frameOffset: S - 1 }` | - |
| graviticAnchorL / R | graviticAnchor>=1 | machine.graviticAnchor | 32x128 | .5,1 | anchorL / anchorR | mid/0 | none | `eye` (0,-121) cable |
| anchorGlowNL / NR (N = 1..3) | graviticAnchor>=1 / 5 / 10 | machine.anchorGlow1..3 | 32x128 | .5,1 | anchorL / anchorR | mid/1 | `{ kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }` | - |
| inversionGhost | inversionCrank>=1 | machine.inversionGhost | 48x48 | .5,.5 | crankHub | mid/9 | `{ kind: 'driven', ratio: 1.75, phaseDeg: 0 }` | - |
| lensLight | lensArray>=1 | machine.lensLight | 32x48 | .5,1 | lensBase | mid/1 | `{ kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }` | - |
| lensColumn | lensArray>=1 | machine.lensColumn | 32x48 | .5,1 | lensBase | mid/3 | none | - |
| aperture | lensArray>=1 | machine.aperture | 64x28 | .5,1 | apertureBase | mid/3 | `{ kind: 'latch', techId: 'skyAperture', minLevel: 1, frames: 6, fps: 5 }` | - |
| namePlate | handCrank>=1 | machine.namePlate | 40x11 | .5,1 | plateSeat | frame/2 | `{ kind: 'stage', frames: 6, gates: [['generator', 1], ['boiler', 1], ['resonatorSpire', 1], ['nullChamber', 1]], endingFrame: 5 }` | - |

   No `flipX` anywhere in era V (light stays upper-left). Define each of the 38 components explicitly (no loops generating the object: keep the literal style of the file).
4. `MACHINE_LINKS`: append G1, G2 per C3 after R1 (comment `// Era V guy cables: chamber yoke eyes to the gravitic anchor eyes (wire rope, no cyan).`). `MACHINE_SHADOWS`: append the two anchor shadows per C3. After `RESONANCE_MILESTONE_FX` add `RING_GEOMETRY`, `INVERSION_GHOST_FX`, `EXOTIC_MILESTONE_FX` exactly per C3 with short comments.
5. Tests (`machineComponents.test.ts`; find by the literals): counts 61 -> 99 components, 45 -> 60 sockets, links 14 -> 16 (cable links 4 -> 6; the generic "cable links join two cable points" and "every connection point appears in a link" tests now also hold for `eyeL`, `eyeR`, `eye`), shadows 7 -> 9, bounds `{ -560, 560, -616, 8 }`; canonical id order list extended (era I-IV prefix unchanged). New era V tests: a table-driven test over the 38 components (tech, level, asset, size, origin, socket, layer, bias, animation, connections exactly as the table); sockets equal the 15 coordinates; every box inside the bounds (generic); every socket used (generic); ring back / front pairs share size, socket and gate; bead gate = its ring gate; bead orbit data consistent: `ring` equals the id digit, `phi0Deg` / `dir` / `speedScale` per table; each `RING_GEOMETRY` ellipse extent (ring1 +-35.5 x +-9.3, ring2 +-40.6 x +-15, ring3 +-42.4 x +-22.1, ring4 +-44.2 x +-29.5, within 0.5) fits inside the 112x72 ring sprite box centred on its centre; `anchorGlowN` gates 1 / 5 / 10 for both L and R; siphon pairs mirror about x 64 (socket x of L + R = 128); guy links join two `cable` points, `cableStyle: 'guy'`, `sag` 6, each endpoint component is visible only when its own tech is owned; `MACHINE_LINK_STYLE.guy` exact and its depth is below every anchor / chamber `componentDepth` (sprites cover the cable ends); the 4 existing cable links have no `cableStyle`; **coverage test (CR-H):** the existing "every unlock tech has a component" test gets exactly one new exemption (techs whose effects include `ending` = primaryFunction), nothing else weakened; every era V `unlock` tech other than primaryFunction is referenced by some component `techId` / `alsoVisibleWith` / `latch.techId` / `stage` gate; `INVERSION_GHOST_FX.component` / `.mirrorOf`, `EXOTIC_MILESTONE_FX.core` / `.anchorGlows` are component ids, the glows are `frames` parts with `glowFrame < frames`, `EXOTIC_MILESTONE_FX.techId` is a `milestone` tech; `inversionGhost` is `driven` with ratio = `-(handCrank ratio)` and phase 0; frame count x cell width = sheet width for `siphonArcsS` (4 x 128), `anchorGlowN` (4 x 32), `lensLight` (4 x 32), `aperture` (6 x 64), `namePlate` (6 x 40) against `ASSET_MANIFEST` (if T3b has not landed in the same wave, re-run at the end and report); **namePlate is inside supportFrame** (`componentBounds` boxes) and `visibleMachineBounds` of a level set owning only era I-IV techs (helper `levelsForEra4`) is unchanged by the plate (compare with the `namePlate` entry removed from the component map); visibility prefix tests with a helper `levelsForEra5(prefix)` (all era I-IV techs maxed, then era V techs): `ring4Back => ring3Back => ring2Back => ring1Back`; `siphonTube3L => siphonTube2L => siphonTube1L`; `anchorGlow3L => anchorGlow2L => anchorGlow1L`; `nullGallery`, `nullChamber`, `nullCore`, `nullCoreGlint` visible exactly from nullChamber 1; `inversionGhost` only with inversionCrank; `lensLight`, `lensColumn`, `aperture` exactly with lensArray; `namePlate` visible with no techs besides the starting handCrank; all 99 visible at the full stage; every era I-IV visibility test still green.

**constraints**: pure data; `import type`; do not edit era I-IV values; no `any`. `AssetId` literals resolve once T3b lands `assetIds.ts` (same wave); vitest does not typecheck, so run tests; tsc errors on the 26 new `machine.*` asset literals are transient (NOTES).

**acceptance**: C3 exact: 99 components, 60 sockets, 16 links, 9 shadows, bounds; era I-IV byte-identical; new invariants pass.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/machineComponents.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/data/machineComponents" | grep -v "machine\.\(nullGallery\|nullChamber\|nullCore\|ring\|siphon\|graviticAnchor\|anchorGlow\|inversionGhost\|lens\|aperture\|namePlate\)" ; echo "(only transient AssetId errors may remain)"
grep -nE "from ['\"]phaser" src/data/machineComponents.ts && echo FAIL || echo OK
git diff -U0 -- src/data/machineComponents.ts | grep -E "^-[^-]"     # only foreign hunks + the lines you changed (bounds, AnimationDriver, frames variant, MachineLink comment, ids / sockets array ends)
```

## T3b - Palette, assets, sky data

**wave**: 2. **files_owned**: `src/data/palette.ts`, `src/data/palette.test.ts`, `src/data/world.ts` (sky additions ONLY), `src/data/world.test.ts` (sky tests only), `src/assets/assetIds.ts`, `src/assets/manifest.ts`, `src/assets/manifest.test.ts`

**objective**: C3 data part. **Edit `assetIds.ts` FIRST** (T3a typechecks against it). `world.ts` was edited by T2 in W1: re-read it right before editing, additive only.

**context** (read all; re-read before each edit):
1. `assetIds.ts`: append the 30 ids after the WP10 ids in the exact C3 order.
2. `manifest.ts`: 30 entries after the last WP10 entry (same layout as `machine.crystal` / `machine.servoArm`; `tileable: 'none'`; one-sentence `description`). width / height = WHOLE image; `frame` = one cell; files under `public/assets/`:

| id | file | width x height | origin | frame / rotation |
|---|---|---|---|---|
| machine.nullGallery | machine/era5/null-gallery.png | 128x30 | .5,1 | - |
| machine.nullChamber | machine/era5/null-chamber.png | 128x116 | .5,1 | - |
| machine.nullCore | machine/era5/null-core.png | 64x64 | .5,.5 | rotation `{ file: 'machine/era5/rot/null-core-rot.png', frames: 64 }` (sheet 512x512 = 8x8 cells of 64x64) |
| machine.nullCoreGlint | machine/era5/null-core-glint.png | 64x64 | .5,.5 | - |
| machine.ring1Back .. ring4Back | machine/era5/ringN-back.png | 112x72 | .5,.5 | - |
| machine.ring1Front .. ring4Front | machine/era5/ringN-front.png | 112x72 | .5,.5 | - |
| machine.ringBead | machine/era5/ring-bead.png | 5x5 | .5,.5 | - |
| machine.siphonTube | machine/era5/siphon-tube.png | 12x30 | .5,1 | - |
| machine.siphonArcs1..3 | machine/era5/siphon-arcs-N.png | 512x64 | .5,.5 | frame 128x64 count 4 |
| machine.graviticAnchor | machine/era5/gravitic-anchor.png | 32x128 | .5,1 | - |
| machine.anchorGlow1..3 | machine/era5/anchor-glow-N.png | 128x128 | .5,1 | frame 32x128 count 4 |
| machine.inversionGhost | machine/era5/inversion-ghost.png | 48x48 | .5,.5 | rotation `{ file: 'machine/era5/rot/inversion-ghost-rot.png', frames: 80 }` (sheet 432x432 = 9x9 cells of 48x48) |
| machine.lensLight | machine/era5/lens-light.png | 128x48 | .5,1 | frame 32x48 count 4 |
| machine.lensColumn | machine/era5/lens-column.png | 32x48 | .5,1 | - |
| machine.aperture | machine/era5/aperture.png | 384x28 | .5,1 | frame 64x28 count 6 |
| machine.namePlate | machine/era5/name-plate.png | 240x11 | .5,1 | frame 40x11 count 6 |
| bg.skyViolet | finale/sky-violet.png | 1280x720 | .5,.5 | - |
| bg.eclipse | finale/eclipse.png | 288x48 | .5,.5 | frame 48x48 count 6 |
| bg.horizonGlow | finale/horizon-glow.png | 1280x720 | .5,.5 | - |
| fx.beam | fx/beam.png | 64x32 | .5,1 | frame 16x32 count 4 |

   Verify every file with `file public/assets/<f>` (read-only).
3. `palette.ts`: add the 8 keys to `PALETTE` and `PALETTE_CSS` (`css(...)` helper like the neighbours).
4. `world.ts` (after T2's constants, additive): `ParallaxLayerDef.alphaStages?` (field + comment), the two `PARALLAX_LAYERS` rows appended AFTER `pylonsLit`, `ECLIPSE`, `APERTURE_BEAM` exactly per C3 (both consts `as const`; `component: 'aperture'` stays a plain literal).
5. Tests:
   - `palette.test.ts`: the 8 keys in `PALETTE` and `PALETTE_CSS` (exact values; CSS strings of the same colours); key sets equal; no two keys share a value.
   - `world.test.ts`: sky layers exact (ids, assets, scrollFactor 0, depths background + 1 / + 3, alphaStages exact); alpha stages non-decreasing within each layer; every stage tech id is a known tech; `ECLIPSE` exact (stage frames strictly increasing; `bg.eclipse` frame count > every stage frame and the diamond frame; `skyPx` inside 1280x720); depths ordered skyViolet (+1) < eclipse (+2) < horizonGlow (+3) < mountains (+10); `APERTURE_BEAM` exact, its `component` is the `aperture` id in `MACHINE_COMPONENTS` (import the data), `artX` equals the `apertureBase` socket x (64), `footArtY` -588; existing layer rows unchanged (deep-equal the five existing ids and their numbers); existing tests untouched.
   - `manifest.test.ts`: the dims test (cell == component size for sheets / files) covers the 26 new machine ids (shared files `machine.ringBead` x4, `machine.siphonTube` x6, `machine.graviticAnchor` x2, `machine.anchorGlow1..3` x2 each: relax any "one component per asset" assertion for exactly these); contract-dimension table extended with the table above; rotation entries now **fourteen** (add `machine.nullCore`, `machine.inversionGhost`); the `#rot` url prefix check also accepts `assets/machine/era5/rot/`; sheet entries plan as `spritesheet` with the right frame; `sheetFrameRects`: `machine.siphonArcs2` -> 4 rects x 0,128,256,384 of 128x64; `machine.aperture` -> 6 rects x 0..320 step 64 of 64x28; `machine.namePlate` -> 6 rects x 0..200 step 40 of 40x11; `bg.eclipse` -> 6 rects x 0..240 step 48 of 48x48; `fx.beam` -> 4 rects x 0,16,32,48 of 16x32; every new entry has a non-null existing file, unique .png paths. If a cross-check with `MACHINE_COMPONENTS` fails only because T3a (same wave) has not landed yet, re-run at the end and report in NOTES.

**constraints**: pure data; no `0x` outside palette / data; no era I-IV edits; `world.ts` additive only (do NOT change T2's constants).

**acceptance**: 30 asset ids with real files matching manifest sizes; 8 palette keys; sky rows / ECLIPSE / APERTURE_BEAM exact; 14 rotation entries.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/palette.test.ts src/data/world.test.ts src/assets
npx tsc --noEmit 2>&1 | grep -E "^src/(assets|data/(palette|world))" && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/data/palette.ts src/data/world.ts src/assets/assetIds.ts src/assets/manifest.ts && echo FAIL || echo OK
(cd public/assets && for f in machine/era5/*.png machine/era5/rot/*.png finale/sky-violet.png finale/eclipse.png finale/horizon-glow.png fx/beam.png; do printf "%s " $f; file $f | sed 's/.*PNG image data, //' | cut -d, -f1-2; done)
git diff -U0 -- src/data/world.ts | grep -E "^-[^-]"     # nothing of yours may appear (additions only)
```

## T4 - Balance sim Era V + save compat

**wave**: 2. **files_owned**: `src/simulation/balance.sim.test.ts`, `src/simulation/sim/greedy.ts` and `greedy.test.ts` (only if the file-time budget needs it), `src/persistence/persistence.test.ts`, and the **era V rows only** of `src/data/technologies.ts` (+ the matching literal-table lines of the era V test in `src/data/technologies.test.ts`)

**objective**: prove the Era V pacing targets, keep the file < 10 s, prove save compat. This is also the check of the planner's cost prototype; retune era V NUMBERS only if a window is missed.

**context** (read all; re-read `technologies.ts` before any edit):
- `balance.sim.test.ts`: keep every existing test and assertion. Profiles (`stepSeconds 1`, no offline): A `4 cps, buy 1 s, 17400 s` (change `MAIN_SECONDS` to 17400), B `4 cps, buy 30 s, 18000 s`, C `1 cps, buy 30 s, 28800 s`. Existing era IV windows and the `aPrefix` 3600 s determinism rerun stay. `console.table` already lists all `TECH_IDS` (46 now). New `describe('era V pacing targets (WP11 Unknown Flux)')` with `ERA_FIVE_IDS`:
  - A: `nullChamber` <= `firstAt.harmonicConvergence + 900`; `primaryFunction` in [13800, 17400] s (230-290 min); `primaryFunction - harmonicConvergence` in [3600, 6600]; `finalAlignment < primaryFunction`; every era V tech has a finite `firstAt`.
  - B: `primaryFunction` <= 18000. C: `primaryFunction` <= 28800 (8 h casual budget, no offline).
  - `maxPurchaseGap(run.purchases, run.firstAt.harmonicConvergence, run.firstAt.primaryFunction)` <= 1200 for A, B, C.
  - B never earlier than A for any tech (existing test covers 46); `maxValue` finite and `< DESIGN_MAX_VALUE` for A, B, C.
  - The whole file runs under 10 s (the existing `aMs < 10000` test stays; target <= 8 s). If it exceeds 8 s, optimise `greedy.ts` WITHOUT changing picks (prove with the existing reference-run test in `greedy.test.ts`), else report.
  Expected (planner prototype): A nullChamber 179:42, graviticAnchor 179:43, containmentRing 180:37, resonantSiphon 188:44, inversionCrank 191:23, lensArray 191:49, horizonField 192:20, skyAperture 226:50, finalAlignment 236:47, primaryFunction 254:37 (15277 s); B primaryFunction 270:00 (16200 s); C 447:30 (26850 s); max buy gap convergence -> primaryFunction A / B / C 477 / 300 / 270 s; final A levels containmentRing 25, resonantSiphon 16, graviticAnchor 7, horizonField 20, crankServo 10; maxValue <= 1.7e10. Era I-IV firstAt MUST be unchanged (era V techs only become available after convergence): era IV A 174:13, B 189:07, C 351:33.
- `persistence.test.ts` (existing helpers `withLevels`, `raw`, `serialize`, `deserialize`, v1 fixture): (1) a v2 save WITHOUT the ten era V keys (serialize `withLevels({ gearRatio: 2 })`, `JSON.parse`, delete the ten ids from `state.techLevels`, stringify, `deserialize`) -> status `loaded`, each era V level `0`; (2) round trip lossless with `{ nullChamber: 1, containmentRing: 12, resonantSiphon: 3, graviticAnchor: 4, finalAlignment: 1, primaryFunction: 1 }` and non-zero xf in `res` and `lifetime`; (3) the v1 fixture still `migrated`; `SAVE_VERSION` unchanged (assert the current literal value); (4) a save with `primaryFunction: 1` loads with `techLevels.primaryFunction === 1` (WP12 decides the resume; WP11 only preserves it).
- Retune rule (only if a window is missed): change ONLY numbers in the ten era V rows (`baseCost`, `growth`, `maxLevel`, numeric fields inside `effects`, `minLevel` / `amount` inside `requires`) and the same numbers in the era V literal-table test; never ids, kinds, costRes, tree, branch, names, texts, requirement structure, or any era I-IV row. Never edit expected windows. If numbers alone cannot reach them STOP and report the A / B / C mm:ss tables.

**acceptance**: all assertions green; final era V numbers (changed or not) and the A / B / C mm:ss table in the report; file time reported.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/balance.sim.test.ts src/simulation/sim src/data/technologies.test.ts src/persistence --silent=false 2>&1 | grep -E "mm:ss|nullChamber|containmentRing|resonantSiphon|graviticAnchor|inversionCrank|lensArray|horizonField|skyAperture|finalAlignment|primaryFunction|harmonicConvergence|passed|failed|Duration"
git diff --stat -- src/data/technologies.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(simulation|data|persistence)" && echo FAIL || echo OK
```

## T5 - Pure maths

**wave**: 2. **files_owned**: `src/game/math/animation.ts`, `src/game/math/animation.test.ts`

**objective**: C4. Pure, no Phaser. Existing exports stay byte-identical. (`camera.ts` / `parallax.ts` were T2's in W1; `machineLinks.ts` needs no change: the existing `rasterCable` is style-agnostic, verify by reading it and say so in NOTES.) `AnimationDriver` widens to `'exotic'` in T3a in parallel: `import type` only; write the new functions with inline structural types (`{ a: number; b: number; tiltDeg: number }`, `readonly { untilS: number; alpha: number }[]`).

**context** (read both files; all nine new functions go into `animation.ts`):
- `driverValue(driver, manual, automation, electric = 0, thermal = 0, resonance = 0, exotic = 0)`: add `case 'exotic': return exotic; // exotic only` (update the doc comment: "... or exotic (XF/s)").
- `orbitPoint(ring, phiDeg)`: `t = tiltDeg * PI / 180`, `p = phiDeg * PI / 180`, `X = a cos p cos t - b sin p sin t`, `Y = a cos p sin t + b sin p cos t` (+y down); results normalised with a no-negative-zero helper.
- `orbitFront(phiDeg)`: normalise `d = ((phi % 360) + 360) % 360`; true when `d <= 180` (so 0, 90, 180 true; 270 false), exact at multiples of 90.
- `orbitStep(phi, dir, degPerSec, dt)`: `((phi + dir * degPerSec * dt) % 360 + 360) % 360`; non-finite inputs return `phi` normalised; never -0.
- `alignStep(phi, target, dir, t01)`: `dist = dir === 1 ? mod(target - phi, 360) : mod(phi - target, 360)` in [0, 360); result = `phi + dir * dist * clamp01(t01)` wrapped to [0, 360); at `t01 >= 1` return exactly `mod(target, 360)`.
- `latchFrame(s, frames, fps)`: `s === null` -> 0; `s === Infinity` -> `frames - 1`; `s < 0` -> 0; else `min(frames - 1, floor(s * fps))`; `frames < 1` or `fps <= 0` -> 0 (but Infinity with valid frames -> `frames - 1`). `stageFrameOf(met, frames, restored = false, endingFrame)`: `restored && endingFrame !== undefined` -> endingFrame clamped, else `clamp(floor(met), 0, frames - 1)`. `echoAlpha(s, steps)`: `s === null || s < 0` -> 0; first step with `s < untilS` -> its alpha; none -> 0. `mirrorAngle(deg)`: `mod(-deg, 360)`, no -0, non-finite -> 0. `milestonePhase`: EM decision 4 (null / negative / >= (alignMs + holdMs) / 1000 -> none t01 0; align t01 = s * 1000 / alignMs; hold t01 = (s * 1000 - alignMs) / holdMs).

**acceptance (tests; literal data only, do not import era V data)**:
- `driverValue('exotic', 2, 3, 7, 9, 11, 13) === 13`; `driverValue('resonance', 2, 3, 7, 9, 11) === 11` (6 args, exotic defaults 0); `driverValue('exotic', 1, 2) === 0`; the 3 / 4 / 5-arg calls unchanged.
- `orbitPoint` matches the ART §4 extents: for rings {36,7,-10}, {42,10,16}, {46,13,-24}, {50,18,30} the max |X| and max |Y| over 3600 samples (phi step 0.1 deg) are within 0.5 of ring1 +-35.5 x +-9.3, ring2 +-40.6 x +-15, ring3 +-42.4 x +-22.1, ring4 +-44.2 x +-29.5; `orbitPoint(ring, 0)` = `(a cos t, a sin t)`; no component `Object.is(v, -0)` over the samples; tilt 0 phi 90 -> `(0, b)`.
- `orbitFront`: 0, 45, 90, 180 true; 181, 270, 359 false; -90 false; 450 true. `orbitStep`: wraps both ways, dir -1 from 10 by 20 deg -> 350, dt 0 unchanged, NaN -> unchanged.
- `alignStep`: `(10, 90, 1, 0) = 10`; `(10, 90, 1, 0.5) = 50`; `(10, 90, 1, 1) = 90` exactly; dir -1 from 10 to 90 goes the long way (t 1 -> 90 exactly, t 0.5 -> 230); from the target itself returns the target for every t; monotone along dir (sampled).
- `latchFrame`: 0, 0.1, 0.2, 0.4, 0.8, 1.0 s at 5 fps / 6 frames -> 0, 0, 1, 2, 4, 5; 5 s -> 5; null -> 0; Infinity -> 5; negative -> 0. `stageFrameOf`: 0..4 gates -> 0..4; 9 -> 5 (frames 6); negative -> 0; `restored` with endingFrame 5 -> 5; `restored` without endingFrame -> normal clamp. `echoAlpha` with steps `[{1.5,1},{2.25,.66},{3,.33}]`: at 0 -> 1, 1.6 -> .66, 2.3 -> .33, 3.0 -> 0, null -> 0, 1.5 -> .66 (boundary goes to the next step). `mirrorAngle`: 90 -> 270, 0 -> 0 (not -0), 360 -> 0, -45 -> 45, 725 -> 355. `milestonePhase(null, 1500, 2000)` none; 0 -> align t01 0; 0.75 -> align 0.5; 1.5 -> hold 0; 2.5 -> hold 0.5; 3.5 -> none.
- Existing tests green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/animation.test.ts src/game/math/machineLinks.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/game/math/animation\.ts" && echo FAIL || echo OK     # TS2366 clears when T3a added 'exotic' AND your case exists
grep -nE "from ['\"]phaser" src/game/math/animation.ts && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/game/math/animation.ts && echo CHECK || echo OK
git diff --stat -- src/game/math/machineLinks.ts     # must be empty
```

---

# WAVE 3 (parallel: T6a, T6b, T7a, T7b - disjoint files; waves 1-2 done and green)

## T6a - Animator

**wave**: 3. **files_owned**: `src/game/entities/MachineAnimator.ts`

**objective**: exotic driver in every path, orbiting beads with depth switching, frames `frameOffset`, latch, stage, inversion ghost, EXOTIC_MILESTONE_FX. Era I-IV behaviour unchanged. No unit tests (Phaser class); acceptance = typecheck + Director smoke.

**context** (read the file, `machineComponents.ts` (T3a types and consts), `math/animation.ts` (T5), `math/machineLayout.ts` (`resolveAttachment`, `componentDepth`), `math/driveTrain.ts`; re-read before editing; the WP10 review may have touched the file):
- Exotic: `const xf = this.session.rates.perSecond.xf;` and pass it as the 7th argument in EVERY `driverValue(anim.driver, this.manual, me, ee, pr, rs)` call in `update` (assembling `spin`, `vibrate`, `frames`, `spin`, `gauge`); `getDriverValues()` also returns `exotic: rates.xf` (extend the return type).
- Bead orbits (`case 'orbit'`): per-component angle map `orbitAngles` (initial `anim.phi0Deg`, cleared on reset); each active frame: `dv` = xf; `speed = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, dv) * anim.speedScale`; `phi = orbitStep(prev, anim.dir, speed, dt)`; position = `resolveAttachment(def)` + `{ x: Math.floor(p.x), y: Math.floor(p.y) }` with `p = orbitPoint(RING_GEOMETRY[anim.ring], phi)`; depth = `orbitFront(phi) ? MACHINE_LAYER_DEPTH[anim.frontLayer] + anim.frontBias : componentDepth(def)`; when it differs from the sprite's depth call `sprite.setDepth(...)` and set `this.depthChanged = true`. A bead that is assembling (not active) is left to the assembly tween. Public `consumeDepthChanged(): boolean` returns and clears the flag. Reset: clear `orbitAngles`, restore every bead sprite to its own `componentDepth` and flag a change.
- Frames offset: in `case 'frames'` the index becomes `(framesIndex(this.elapsed - origin, anim.frames, anim.maxHz, fdv >= MACHINE_MOTION.restThreshold) + (anim.frameOffset ?? 0)) % anim.frames` (identical to today when `frameOffset` is absent). Keep the crystal hold logic as is.
- Exotic milestone FX (data `EXOTIC_MILESTONE_FX`; a further `session.on('milestone')` subscription, unsubscribed in `destroy()`, cleared on reset): on `id === EXOTIC_MILESTONE_FX.techId` store `exoticMilestoneAt = this.elapsed` and capture each bead's current angle. Each frame `const ph = milestonePhase(secondsSince, alignMs, holdMs)`: while `align`, every orbit bead angle = `alignStep(angleAtStart, EXOTIC_MILESTONE_FX.beadPhiDeg, anim.dir, ph.t01)`; while `hold`, angle = `beadPhiDeg`; afterwards normal orbit resumes FROM that angle (`orbitAngles` holds it). The `EXOTIC_MILESTONE_FX.core` spin speed is multiplied by `coreSpinMult` for `coreSpinMs` after the milestone (in `spinPart`, id check + animator clock). Each part in `anchorGlows` shows frame `glowFrame` instead of its cycle for `glowHoldMs` after the milestone (same pattern as the crystal hold).
- Latch (`case 'latch'`): per-component state map `latchStart: Map<id, number | 'done'>`; each ACTIVE frame read `gate = this.session.state.techLevels[anim.techId] >= anim.minLevel`. No state yet and gate true -> `'done'` (load shows the last frame: `latchFrame(Infinity, ...)`); no state and gate false -> remember "seen false" (frame 0); seen false then gate true -> start at `this.elapsed`; gate false again (reset) -> clear. Frame = `latchFrame(secondsSinceOrNullOrInfinity, anim.frames, anim.fps)` applied with `sprite.setFrame`. Reset clears the map. Public `latchFrame(id): number | null` returns the last computed frame for latch parts (0 before the first active frame) and null for any other part.
- Stage (`case 'stage'`): `met = anim.gates.filter(([techId, level]) => levels[techId] >= level).length`; `sprite.setFrame(stageFrameOf(met, anim.frames, false, anim.endingFrame))`.
- Ghost: in the active branch, BEFORE the `switch`: `if (id === INVERSION_GHOST_FX.component) { ...; continue; }`. Track `lastClickAt` (set in the existing `click` subscription to `this.elapsed`; null after reset). `const since = this.lastClickAt === null ? null : this.elapsed - this.lastClickAt; const alpha = echoAlpha(since, INVERSION_GHOST_FX.alphaSteps); sprite.setVisible(alpha > 0).setAlpha(alpha); if (alpha > 0) applyAngle(sprite, mirrorAngle(this.drivenAngle(INVERSION_GHOST_FX.mirrorOf, drivenOf(INVERSION_GHOST_FX.mirrorOf))))`. In the assembling branch the ghost follows the generic `driven` rule (its fly-in tween owns alpha). `MachineView.settle` sets visible / alpha 1, so the ghost hides itself on its first active frame (accepted). Do NOT add the ghost to `CRANK_PARTS`.
- Update the class doc comment (exotic = XF/s; orbit / latch / stage / ghost; the two milestone FX).

**constraints**: no `0x` literals; no tech-id string literals (read ids from data: `anim.techId`, `anim.gates`, `INVERSION_GHOST_FX`, `EXOTIC_MILESTONE_FX`); era I-IV pixels unchanged; no console.

**acceptance**: typecheck clean for `src/game/entities/MachineAnimator.ts`; greps pass; Director smoke: beads orbit the core (rings 1/3 one way, 2/4 the other), switch front/back, speed rises with XF/s; arcs / glow / lens light cycle; aperture opens once over 1.2 s after skyAperture (5 fps) and holds; a save with skyAperture shows it open at once; plate frame 4 once nullChamber is owned; the ghost counter-rotates on the crank for 3 s after a manual click with alpha steps 1 / .66 / .33; on finalAlignment beads line up under the core in 1.5 s, hold 2 s, resume, core spins x3 for 2 s, glows hold frame 2 for 2 s.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/entities/MachineAnimator" && echo FAIL || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/entities/MachineAnimator.ts && echo FAIL || echo OK
grep -nE "'(nullChamber|containmentRing|skyAperture|finalAlignment|inversionCrank|aperture|namePlate|inversionGhost)'" src/game/entities/MachineAnimator.ts && echo FAIL_LITERAL || echo OK
grep -n "exotic\|consumeDepthChanged\|latchFrame\|milestonePhase\|mirrorAngle\|echoAlpha" src/game/entities/MachineAnimator.ts
```

## T6b - Machine view, guy cables, debug hook

**wave**: 3. **files_owned**: `src/game/entities/MachineView.ts`, `src/game/rendering/MachineLinks.ts`, `src/game/debugHook.ts`

**objective**: RT from the new bounds, bead depth re-sort, `latchFrame` passthrough, guy cables, perf probe + camera relX / relY in the hook. 0 console errors. Power cables, belts, pipes, rods unchanged.

**context** (read all three + `machineComponents.ts` (T3a), `math/machineLinks.ts` (`rasterCable`, `connectionOffset`); re-read before editing):
- `MachineView.ts`: in `update()`, right after `this.animator.update(...)`: `if (this.animator.consumeDepthChanged()) this.parts.sort('depth');` (the RT draw follows in the same frame). Add `latchFrame(id: MachineComponentId): number | null { return this.animator.latchFrame(id); }`. Perf probe: ring buffer of the last 120 `update()` durations (`performance.now()` around the whole body), exposed via `getUpdateStats(): { meanMs: number; maxMs: number; components: number }` (`components` = `this.sprites.size`; empty buffer -> zeros). Doc comment: era V bounds `pixel (560, 616)`, RT 1120 x 624; the RT size already derives from `MACHINE_BOUNDS` (verify, no code change).
- `MachineLinks.ts`: guy cables. A link with `kind === 'cable'` and `cableStyle === 'guy'` goes into a separate plan list `guyCables: CablePlan[]` with its own key `guyKey` (hidden `'g-'` while either end is hidden / assembling, same rule as power cables); the existing power cable list, key and drawing are untouched for links without `cableStyle` or with `'power'`. New `Graphics` `guyCables` at `MACHINE_LINK_STYLE.guy.depth` added to `parent`, destroyed / cleared with the others, redrawn only when `guyKey` changes. Draw: for each plan `core = rasterCable(a, b, sag)` plotted in `MACHINE_LINK_STYLE.guy.core` (1 px) and, for every core pixel, the pixel directly below `(x, y + 1)` in `MACHINE_LINK_STYLE.guy.under` unless that pixel is itself a core pixel (no cyan highlight, no 2x2 caps). Endpoints rounded to whole art px exactly like power cables (`roundPoint`).
- `debugHook.ts`: `cameraState()` returns `{ zoom, centerX, centerY, relX: centerX - MACHINE_ANCHOR.x, relY: centerY - MACHINE_ANCHOR.y }` (update the declared type); add `machineStats(): { meanMs: number; maxMs: number; components: number }` reading `MachineView.getUpdateStats()` through the same scene lookup `componentState` uses (zeros when the machine is missing); declare it in the `window.__wedtmd` type. No other hook changes.

**constraints**: no `0x` literals (colours only from `MACHINE_LINK_STYLE`); no tech-id literals; no console.

**acceptance**: typecheck clean for the three files (`MachineView` may fail until T6a lands `consumeDepthChanged` / `latchFrame` in the same wave); greps pass; Director smoke: RT 1120x624, era I-IV parts at unchanged machine-local pixels; the two guy cables run from the chamber eyes to the anchor eyes (1 px core + 1 px dark row under), appear only when both ends are visible, no cyan; `window.__wedtmd.machineStats()` returns numbers; `cameraState()` has relX / relY.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/(entities/MachineView|rendering/MachineLinks|debugHook)" && echo "FAIL (ok only for consumeDepthChanged / latchFrame until T6a)" || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/entities/MachineView.ts src/game/rendering/MachineLinks.ts src/game/debugHook.ts && echo FAIL || echo OK
grep -n "guy\|consumeDepthChanged\|latchFrame\|getUpdateStats\|machineStats\|relX" src/game/entities/MachineView.ts src/game/rendering/MachineLinks.ts src/game/debugHook.ts
```

## T7a - World-growth renderers

**wave**: 3. **files_owned**: `src/game/rendering/CameraController.ts`, `src/game/rendering/PylonLine.ts`, `src/game/rendering/Terrain.ts`, `src/game/rendering/DustField.ts`

**objective**: `effectiveMinZoom` everywhere; ground tile + pylon strip geometry with the pattern phase; dust spawn range anchor +- 1280; no other behaviour change (camera pan / zoom / autoframe, pylon anchor choice, dust rising logic untouched).

**context** (read all four + `math/camera.ts`, `math/parallax.ts` (T2: `effectiveMinZoom`, `layerPhase`, `parallaxStrip` phase fields), `data/world.ts`; re-read before editing):
- `CameraController.ts`: `private readonly minZoom: number = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);` (import `effectiveMinZoom`; drop `minZoomToFit` from the import). Nothing else.
- `PylonLine.ts` `pylonStrip(def)`: `const phase = layerPhase(def.scrollFactor, entry.width, PIXEL_SCALE);` pass `phaseShiftPx: phase.phaseShiftPx, periodPx: phase.periodPx` to `parallaxStrip`, `minZoom: effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom)`; `stripLeftX` stays `geometry.left` (the shifted left: tile boundaries land where they did before the world growth, relative to the anchor), `bottomObjY`, `tilePx`, `tileHeightPx` as before. The anchor pinned on first light is chosen exactly as before (same `nearestPylonAnchor` call); cable endpoints must sit at the same anchor-relative world px as before WP11.
- `Terrain.ts`: ground tileSprite at `x = phase.phaseShiftPx - phase.periodPx`, `y = GROUND_Y`, `width = WORLD.width + phase.periodPx`, `height = WORLD.height - GROUND_Y`, with `phase = layerPhase(1, ASSET_MANIFEST[GROUND_LAYER.assetId].width, PIXEL_SCALE)` (import `ASSET_MANIFEST`, `layerPhase`; comment: tile boundaries stay where they were relative to the machine, EM decision 2). The horizon strip, haze and shade band rectangles keep `x = 0, width = WORLD.width` (flat colours).
- `DustField.ts`: `moteConfig` x range `{ min: MACHINE_ANCHOR.x - DUST.spawnHalfWidth, max: MACHINE_ANCHOR.x + DUST.spawnHalfWidth }` for BOTH emitters (import `MACHINE_ANCHOR`; drop `WORLD` if unused). `setRising` logic unchanged; update the header comment ("across the band around the machine").

**constraints**: no `0x`; no new tuning numbers in these files; all objects destroyed as before.

**acceptance**: typecheck clean for the four files; greps pass; Director smoke: s0-s10 zoom and anchor-relative camera centre unchanged vs WP10 HEAD, ground pattern / pylon cables / dust density look the same; no gap at the world edges at zoom 0.5; 0 console errors.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game/rendering/(CameraController|PylonLine|Terrain|DustField)" && echo FAIL || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/CameraController.ts src/game/rendering/Terrain.ts src/game/rendering/DustField.ts && echo FAIL || echo OK
grep -n "minZoomToFit\|effectiveMinZoom\|layerPhase\|spawnHalfWidth" src/game/rendering/CameraController.ts src/game/rendering/PylonLine.ts src/game/rendering/Terrain.ts src/game/rendering/DustField.ts
```

## T7b - Sky (violet + eclipse + glow), aperture beam, scene

**wave**: 3. **files_owned**: `src/game/rendering/ParallaxBackground.ts`, new `src/game/rendering/Eclipse.ts`, new `src/game/rendering/ApertureBeam.ts`, `src/game/scenes/WorldScene.ts`

**objective**: strips with the pattern phase, alphaStages sky layers, eclipse sprite, world-space beam, scene wiring. Phaser allowed; no unit tests; 0 console errors.

**context** (read the four files + `data/world.ts` (T2 / T3b: `PARALLAX_LAYERS`, `ECLIPSE`, `APERTURE_BEAM`, `PARALLAX_FADE_MS`), `math/parallax.ts` (`layerPhase`, `stageAlpha`, `stageFrame`, `skyPxToScrollZero`, `fadeStep`, `parallaxStrip`), the `GameSession` event types (`purchase`, `reset` payloads: read, do not edit); re-read `WorldScene.ts` right before editing: it may have foreign edits):
- `ParallaxBackground.ts`: `const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);` (sky display size stays `VIEW / minZoom` = 2560 x 1440). Strips: pass `phaseShiftPx` + `periodPx` from `layerPhase(def.scrollFactor, ASSET_MANIFEST[def.assetId].width, PIXEL_SCALE)` to `parallaxStrip` (the underfill rectangle keeps `geometry.left` / `geometry.width`, so it grows with the strip). `alphaStages` layers (sky branch): a fading layer whose `fade` is the alpha divided by `def.alpha`: initial fade = `stageAlpha(def.alphaStages, techLevels)` (load = instant, no fade-in), target each frame = `stageAlpha(...)`, moved with `fadeStep(fade, target, deltaMs, PARALLAX_FADE_MS)`, `applyFade` sets alpha `def.alpha * fade` and `setVisible(fade > 0)`; a reset lowers the target to 0 so the layer fades out (accepted). `visibleWhen` layers unchanged (`isLayerVisible`).
- `Eclipse.ts`: `class Eclipse { constructor(scene, session: GameSession); update(deltaMs); destroy() }`. One sprite from `ECLIPSE.assetId` (sheet frames 48x48), `setScrollFactor(0)`, position `skyPxToScrollZero(ECLIPSE.skyPx, VIEW, effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom))`, scale `1 / minZoom` (= 2), depth `ECLIPSE.depth`, frame `stageFrame(ECLIPSE.stages, levels)`, hidden while the frame is 0 (the baked sun in `bg.sky` shows). Diamond ring: on a `purchase` event of `ECLIPSE.diamond.techId` show `ECLIPSE.diamond.frame` for `ECLIPSE.diamond.ms`, then the stage frame (5); at construction with the tech already owned: stage frame only. Frame changes are instant (no tween). `reset` -> recompute (frame 0 -> hidden), cancel the diamond timer. Unsubscribe in `destroy()`.
- `ApertureBeam.ts`: `class ApertureBeam { constructor(scene, session: GameSession, latchFrameOf: () => number | null); update(deltaMs); destroy() }`. One `scene.add.tileSprite(centreX, bottomY, 32, bottomY, APERTURE_BEAM.assetId)` with `centreX = MACHINE_ANCHOR.x + PIXEL_SCALE * APERTURE_BEAM.artX`, `bottomY = MACHINE_ANCHOR.y + PIXEL_SCALE * APERTURE_BEAM.footArtY` (= 504), `setOrigin(0.5, 1)`, `setTileScale(PIXEL_SCALE, PIXEL_SCALE)`, height `bottomY` (reaches world y 0), `setDepth(APERTURE_BEAM.depth)`, `setAlpha(APERTURE_BEAM.alpha)`, blend NORMAL (default), initially hidden. Frame: `floor(clock * APERTURE_BEAM.fps) % 4` of the sheet on the tile sprite (`setFrame`); if a tileSprite on a sheet frame renders wrong or the API rejects it, fall back to a stack of `ceil(bottomY / 64)` plain Image sprites of the same frame (document the fallback in the file comment; report which path was used). Visible while `session.state.techLevels[<latch tech>] >= 1` AND `latchFrameOf()` is non-null and `>= APERTURE_BEAM.minLatchFrame`. The latch tech id comes from the aperture component's latch data (`MACHINE_COMPONENTS[APERTURE_BEAM.component as MachineComponentId].animation`, kind `latch` -> `techId` and `minLevel`), not from a literal. `reset` -> hidden. Destroy all objects in `destroy()`.
- `WorldScene.ts`: add fields `eclipse: Eclipse | null`, `beam: ApertureBeam | null`; create after the machine view exists: `new Eclipse(this, this.ctx.session)`, `new ApertureBeam(this, this.ctx.session, () => this.machineView?.latchFrame(APERTURE_BEAM.component as MachineComponentId) ?? null)` (import `APERTURE_BEAM` from data/world, the type from machineComponents); `update()` calls `this.eclipse?.update(delta)` and `this.beam?.update(delta)` after the machine update; both destroyed in the disposables (null the field first, keep the shutdown try / catch loop; they are disposed before the background). Nothing else changes.

**constraints**: colours / numbers only from data; no `0x`; no tech-id literals; all objects destroyed on shutdown; era I-IV backgrounds pixel-identical (same anchor-relative camera).

**acceptance**: typecheck clean for `src/game` (`MachineView.latchFrame` exists after T6b in the same wave); greps pass; Director smoke: sky strips / skyline / pylons look identical to WP10 HEAD in s0-s11; s14 violet sky alpha .25 + eclipse bite; s15 violet 1.0, totality, horizon glow .75, beam from the aperture mouth to the top of the screen after the latch passes frame 3; s16 unchanged; reset hides violet / beam / eclipse; 0 console errors.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game" && echo FAIL || echo OK
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/ParallaxBackground.ts src/game/rendering/Eclipse.ts src/game/rendering/ApertureBeam.ts src/game/scenes/WorldScene.ts && echo FAIL || echo OK
grep -n "effectiveMinZoom\|layerPhase\|stageAlpha\|stageFrame\|skyPxToScrollZero\|new Eclipse\|new ApertureBeam" src/game/rendering/*.ts src/game/scenes/WorldScene.ts
```

---

# WAVE 4 - EM Mode B (validate)

Run: `npm run typecheck`, `npm test` (baseline = the count the Director recorded before W1; expect baseline + new; compare `it(` titles against `git diff` so no touched test file lost cases), `npm run build` (app chunk <= 200 KB). Then:
```
grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/ui/*View.ts src/ui/*Rules.ts src/audio/audioMath.ts   # must be empty
grep -rnE "0x[0-9a-fA-F]{6}" src/game src/ui src/audio --include=*.ts | grep -v test                                                      # must be empty
grep -rn "minZoomToFit" src --include=*.ts | grep -v test                                                                                 # only camera.ts (definition + effectiveMinZoom use)
grep -rnE "\b(1280|1120)\b" src --include=*.ts | grep -v "test.ts"                                                                       # only world.ts (VIEW, PATTERN_ORIGIN_X, spawnHalfWidth), machine-local data, painters
npx vitest run src/simulation/balance.sim.test.ts --silent=false                                                                           # era I exact + II + III + IV + V windows, < 10 s
git diff --stat HEAD -- docs/GAME_SPEC.md src/simulation/GameSession.ts public                                                            # must be empty
git diff HEAD -- src/data/technologies.ts | grep -E "^-[^-]"                                                                              # must be empty (additive) except foreign WP10-review hunks
```
**Balance** (A 17400 s, B 18000 s, C 28800 s): era I exact; era II / III / IV windows unchanged (era IV A 174:13, B 189:07, C 351:33); A nullChamber <= convergence + 900 s; primaryFunction in [13800, 17400]; primaryFunction - harmonicConvergence in [3600, 6600]; finalAlignment < primaryFunction; every era V tech finite; B primaryFunction <= 18000; C <= 28800; `maxPurchaseGap(convergence -> primaryFunction)` <= 1200 A / B / C; B never earlier than A; maxValue finite < DESIGN_MAX_VALUE; deterministic 3600 s prefix; file < 10 s.
**Save**: WP10-shape save without era V keys -> `loaded`, levels 0; v1 fixture migrates; round trip lossless (incl. primaryFunction 1); no SAVE_VERSION change.
**Per-criterion PASS / FAIL**: C1 (46 techs, `ending` variant + describe text, rate / offline neutrality, names <= 19, install lines, 3 logs, no plaque change); C2 (WORLD / GROUND_Y / anchor / focus / minZoom / PATTERN_ORIGIN_X / dust half width; `effectiveMinZoom`; `patternShift`, `layerPhase`, strip phase; framing test; renderers switched: CameraController, ParallaxBackground, PylonLine, Terrain, DustField); C3 (99 components, 60 sockets, 16 links = 14 + G1 + G2, 9 shadows, 30 new asset ids with real files, 14 rotation entries, `MACHINE_BOUNDS` -616, `RING_GEOMETRY`, `INVERSION_GHOST_FX`, `EXOTIC_MILESTONE_FX`, guy style + `cableStyle`, palette 8 keys, sky layers / ECLIPSE / APERTURE_BEAM); C4 maths + tests incl. `milestonePhase`; `exotic` driver in every animator path; orbit beads + `consumeDepthChanged` + `parts.sort`; latch / stage / ghost / milestone FX in the animator; guy cables in MachineLinks; `machineStats` + `relX/relY` in the hook; Eclipse + ApertureBeam + alphaStages sky + WorldScene create / update / destroy; audio (drone silent without nullChamber, swell on era 5 purchases, bead ticks after the sting, mute respected, no tech-id literals in src/audio). Check D1 (primaryFunction data only: no sequence, no state field), D5, D6, D7.
Allowed glue: one-line integration fixes only (state them).

## Director smoke test steps (after the build)
`npm run build && npx vite preview --port 4173 --strictPort &` then per `scripts/smoke/README.md` with `PW=$(npm root -g)/playwright`. First run `stages.mjs` s0-s13 at WP10 HEAD (before W1) and keep the camera lines as the baseline.
1. `wp2-crank`, `wp3-techtree`, `wp4-persistence`, `full-machine` -> `errors` empty; `wp3-techtree`: `11_tabCount` / `12_tabCount` / `13_tabCount` 5, `12_tab5` `SIGNAL ?`, `13_tabs` ERA V enabled, `13_header` ends `???`, `13_nodes` 10.
2. `stages.mjs` s0-s16 -> 0 errors. s0-s10 camera zoom + relX / relY identical to the baseline (old run: centre - (1280,1120)); backgrounds, ground, pylon cables identical side by side (dust random); only the name plate is new on the girder. s11 / s13 zoom 0.5, ground screen y 480 / 640 (D4; Art Director accepts or files an R-fix). s14: gallery + chamber + floating core spinning, no rings, plate `RESTOR?`, eclipse bite, violet sky .25, camera 0.5. s15 (`ONLY=s15_era5_full`, frames `8`): all 38 parts, 4 rings with beads in front / behind the core, siphon arcs, anchors + glows at +-520 with guy cables to the chamber eyes (clear of chimney / smoke / mast), lens light, aperture open + violet beam to the top of the screen, eclipse totality, violet 1.0, horizon glow .75, ghost counter-rotating after the 3 clicks, machine top >= 40 px, ground <= 672 px on screen. s16: primaryFunction owned, no errors, nothing else changes.
3. Perf: `PERF=1 ONLY=s13_era4_full,s15_era5_full`: s15 `machineStats` meanMs <= 4 and <= 1.8 x s13 (report both; over budget = WP16 note, not a blocker unless > 8 ms).
4. Manual: T -> ERA V `SIGNAL ?` before convergence then header `<n> ???`; keyboard-only purchase; graviticAnchor node `x1.1 ...`; primaryFunction node text `Engages the primary function`; audio: drone audible after nullChamber, swell on era V purchases, bead ticks after the sting on finalAlignment.
5. Docs (Director): `docs/PROJECT_STATUS.md` (WP10 done + WP11: numbers, D1-D11, EM 1-8), `docs/ASSET_GUIDE.md` era V entries.

---

# Risks
- **Concurrent edits** (WP10 review: entities / rendering / data): all WP11 edits additive; every worker re-reads before editing; T3b touches `world.ts` after T2; T6b / T7b touch `MachineView.ts` / `WorldScene.ts` last in their waves.
- **World growth side effects** (T2 / T7a / T7b): every old literal world number in tests is derived (EM 3); pixel identity of eras I-IV is protected by `PATTERN_ORIGIN_X` + `layerPhase` and verified by the T2 invariance test and the Director side-by-side smoke. The ground shift trick (EM 2) is the only Phaser-side phase mechanism: if a tileSprite at a negative x looks wrong, report, do not switch to `tilePosition`.
- **T3a size** (38 components + big test): if it stalls split on its seams: (types + sockets + ids + links + shadows + FX consts) / (38 definitions + tests).
- **T6a** is the riskiest Phaser work (orbit depth, latch, ghost, milestone timeline): if it stalls split into (exotic + frameOffset + stage + latch) / (orbit + ghost + milestone). `consumeDepthChanged` and `latchFrame` signatures are fixed so T6b / T7b are unaffected.
- **Ghost vs crank**: data says `driven +1.75` but the angle is `mirrorAngle(crank displayed angle)` (EM 6); the generic `driven` angle only matters during the fly-in.
- **Balance**: prototype from a scratch harness; T4 stops and reports tables if windows are missed by numbers alone. Profile A runs 17400 steps: harness is already optimised (WP10 D5); budget < 10 s.
- **Bead half pixel**: a 5x5 bead with origin .5 sits on a half pixel (ART formula floors the centre); the RT nearest filter keeps it crisp. Art Director checks the s15 crop.
- **Smoke jump limit**: `@finalAlignment` needs lifetime xf 200M; the stage helper tries 8 jumps of 8 h (offline). If it prints `false`, the Director runs a longer jump loop for s15 / s16.
- **Perf**: RT 1120x624 (+63 % pixels) + 99 sprites; probe via `machineStats`; no lever in WP11 (WP16).
- **Audio** has no unit coverage beyond `audioMath`: reviewed by reading the code path and by ear.
