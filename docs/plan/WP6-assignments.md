# WP6 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP6.md` (rationale) + `docs/plan/ART_AUDIT.md` (§3 geometry, §4 asset sizes/pivots, FROZEN). Workers are `implementation-worker` agents (Haiku). No `src/simulation` change. `SAVE_VERSION` stays 1. The art agent adds PNGs to `public/assets` concurrently; code must run without them (fallback painters).

## How the Director uses this file

For every worker: spawn `implementation-worker`, paste **(1) the "Common preamble"** then **(2) exactly one assignment block**. Same-wave workers run in parallel. Between waves run the wave's own tests plus `npx tsc --noEmit`.

| Wave | Ids | Workers |
|---|---|---|
| 1 | **T1a** assets (ids, manifest, fallback), **T1b** machine data + layout, **T2** pure drive/link math, **T6** scene polish | 4 |
| 2 | **T3** animator + crank input (+ data/drive integration test), **T4** link renderer, **T5** MachineView render path + shadows | 3 |
| 3 | EM Mode B (T7), then Director: art flip, smokes, Art Director sign-off, `docs/PROJECT_STATUS.md` | — |

Wave 1 gate: `npx vitest run src/data src/assets src/game/math src/ui` is green. Expected transient `tsc` errors after wave 1 (NOT a worker fault): ONLY in `src/game/entities/MachineAnimator.ts`, `HandCrank.ts`, `MachineView.ts` and `src/game/rendering/MachineLinks.ts` (they still use removed APIs). A tsc error anywhere else is a real bug.
Wave 2 gate: `npm run typecheck && npm test && npm run build` clean.

## Deviations from `WP6.md` (deliberate, all spelled out in the contracts below)

1. **T1 is split** into T1a (assets) and T1b (data + layout) so each Haiku task is small. Wave 1 stays at 4 workers.
2. **Pixel-exact dashes.** `rasterBelt` returns ORDERED closed pixel loops. `pointsAlongBelt` takes the inner loop (`Vec2[]`), not the analytic path, and picks by index. This way dashes always sit on real belt pixels.
3. **`beltTravel` is signed** and measured along the loop order: `-ratio * rad(masterDeg) * radius`. (The WP6 text used `|ratio|`, which would run the crank belt backwards.) Derivation: loop order is counter-clockwise on screen; a positive part angle is clockwise.
4. **`stepMaster` flushes tiny remainders.** When `|pending|` drops below 1e-3 the rest goes into `deg`, so impulses are conserved exactly. The decay test uses 12τ for a 51.4 deg-equivalent impulse (`e^-5` alone leaves 0.34, so the WP6 "5τ" statement cannot hold).
5. **Extra pure helper** `coalesceRuns` (pixels to horizontal runs) keeps the per-frame `fillRect` count low.
6. **`MachineLinks.draw` takes a `LinkDrawContext`** (adds `isLive` so caps know which rotating parts exist).
7. **RT draw offset includes the shake.** `rt.draw(parts, ox, oy)` overwrites `parts.x/y` for the draw, so the shake offset (`parts.x`, rounded) must be added to `ox`.
8. **Container layout.** The outer `container` (anchor, scale 2, depth `DEPTH.machine`) always exists. In `renderTexture` mode it holds the RT image; in `direct` mode it holds `parts`. In RT mode `parts` is created off the display list.
9. **Rod pin connection** sits at `(0,0)` with `radius 5`. The live pin position comes from `sliderCrank`, never from the data point.
10. T2's tests use literal numbers (no import of T1b data). The data to math integration test lives in T3's `driveData.test.ts`.

---

# Common preamble (paste before every assignment)

```
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP6: mechanical correctness. The machine becomes ONE drive train: a shared master angle thetaM, gears that mesh, real open belts, a crank-rod that moves the piston yoke; drawn on ONE art-pixel grid. WP1-WP5 are finished; read neighbouring files before writing. Plan: docs/plan/WP6.md, art facts: docs/plan/ART_AUDIT.md (read only).

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker. Never edit package.json, tsconfig.json, vite.config.ts, index.html, anything under src/simulation, src/data/types.ts, technologies.ts, balance.ts, palette.ts, src/persistence, src/utils, docs/, public/.
- PURE files (no 'phaser', no window/document): src/data/**, src/game/math/**, src/assets/assetIds.ts, src/assets/manifest.ts. Only src/game/{entities,rendering,scenes} + src/assets/fallbackTextures.ts import Phaser (`import Phaser from 'phaser';`).
- Phaser 3.90 typings do not declare create/preload/init on Scene: NEVER write `override` on them.
- All tuning numbers live in src/data/. In TS under src/game, src/ui, src/audio NEVER write a `0x......` hex literal (use data constants). src/data may hold hex literals.
- Coordinates: machine-local ART PX, origin = frame base centre (ground line y=0), +y DOWN, 1 art px = 2 world px (PIXEL_SCALE). Angles in degrees; positive angle = clockwise on screen (Phaser `setAngle`), i.e. direction (cos a, sin a) in y-down coordinates.
- No new dependencies, no npm install, no commits, no markdown/report files, NO png files (the art agent makes images).
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`.
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM/Phaser, no node:fs), `*.test.ts` next to code, `toBeCloseTo(x, 9)` for floats. Avoid `-0` (normalise with `v === 0 ? 0 : v`). No Math.random in tests: use a seeded LCG.
- Other workers edit OTHER files concurrently. `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list foreign errors in NOTES. Run only your own tests.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== FROZEN CONTRACTS (WP6) ===

// ---------- src/assets/assetIds.ts (T1a) ----------
// ASSET_IDS (this order): 'bg.sky','bg.mountains','bg.skyline','bg.pylons','terrain.ground','fx.dust','machine.frame','machine.crank',
//   'machine.gearSmall','machine.gearLarge','machine.flywheel','machine.motor','machine.bearingPlate','machine.pulleyMotor','machine.pulleyMain',
//   'machine.pulleyCrank','machine.pulleyFlywheel','machine.pedestal','machine.motorPlinth','machine.pistonBlock','machine.pistonYoke','fx.steam'
// 'machine.piston' is REMOVED.
// Manifest (width x height, origin; file path under public/assets/ — see T1a rule for when `file` may be non-null):
//   machine.bearingPlate    machine/bearing-plate.png        16x16  (0.5,0.5)
//   machine.pulleyMotor     machine/pulley-motor.png         12x12  (0.5,0.5)
//   machine.pulleyMain      machine/pulley-main.png          24x24  (0.5,0.5)   crank-pin boss at (+5,0) from centre at angle 0
//   machine.pulleyCrank     machine/pulley-crank.png         32x32  (0.5,0.5)
//   machine.pulleyFlywheel  machine/pulley-flywheel.png      28x28  (0.5,0.5)
//   machine.pedestal        machine/flywheel-pedestal.png    48x64  (0.5,1)     bearing centre at local (24,8)
//   machine.motorPlinth     machine/motor-plinth.png         48x10  (0.5,1)
//   machine.pistonBlock     machine/piston-block.png         96x58  (0.5,1)
//   machine.pistonYoke      machine/piston-yoke.png          80x16  (0.5,0.75)  pin eye at the pivot
//   unchanged ids keep their entries: machine.frame 200x110 (0.5,1), crank 48x48, gearSmall 40x40, gearLarge 64x64, flywheel 96x96, motor 64x48 (0.5,0.5).
// Gear sprites have ONE tooth centred on +x at angle 0.

// ---------- src/data/machineComponents.ts (T1b) ----------
export const MACHINE_COMPONENT_IDS = ['supportFrame','bearingM','bearingP','gearLarge','mainShaft','gearSmall','crankPulley','handCrank',
  'flywheelPedestal','flywheel','flywheelPulley','motorPlinth','wornMotor','motorPulley','pistonYoke','pistonArray'] as const;   // canonical order
export const SOCKET_IDS = ['mainHub','crankHub','flywheelHub','flywheelBase','motorMount','motorBase','motorPulleyHub','pistonBed','yokePin'] as const;
export const MACHINE_SOCKETS: Record<SocketId, Vec2> = {
  mainHub: {x:-44,y:-56}, crankHub: {x:0,y:-56}, flywheelHub: {x:150,y:-56}, flywheelBase: {x:150,y:0},
  motorMount: {x:-140,y:-27}, motorBase: {x:-140,y:0}, motorPulleyHub: {x:-114,y:-31}, pistonBed: {x:-44,y:-110}, yokePin: {x:-44,y:-125} };
export type ComponentAnimation =
  | { kind: 'none' }
  | { kind: 'driven'; ratio: number; phaseDeg: number }          // angle = partAngle(thetaM, ratio, phaseDeg)
  | { kind: 'slider' }                                           // pistonYoke only: position from sliderCrank
  | { kind: 'vibrate'; driver: AnimationDriver; amplitude: number; speed: SpeedCurve };   // unchanged from today
export interface ConnectionPoint { id: string; at: Vec2; kind: 'belt' | 'pin'; radius?: number }
export interface MachineLink { from: {component: MachineComponentId; point: string}; to: {component: MachineComponentId; point: string}; kind: 'belt' | 'rod' }
// MachineComponentDefinition gains optional `depthBias?: number` (integer, default 0). `flipX?`, `effects`, `connections`, `attach`, `size`, `origin`, `layer` stay.
export const MACHINE_LAYER_DEPTH = { back: 0, frame: 10, mid: 20, front: 30 };   // unchanged
export const MACHINE_BOUNDS = { left: -200, right: 200, top: -200, bottom: 8 };   // unchanged
export const MACHINE_LINKS: readonly MachineLink[] = [
  { from:{component:'motorPulley',point:'belt'}, to:{component:'mainShaft',point:'belt'}, kind:'belt' },
  { from:{component:'crankPulley',point:'belt'}, to:{component:'flywheelPulley',point:'belt'}, kind:'belt' },
  { from:{component:'mainShaft',point:'pin'}, to:{component:'pistonYoke',point:'eye'}, kind:'rod' } ];
export interface DriveTrainConfig {
  masterSpeed: SpeedCurve;                 // deg/s of thetaM, fed by the COMBINED driver (manual activity + ME/s)
  masterDirection: 1 | -1;                 // sign applied to the idle drift; -1 means a click (negative pending) turns the crank clockwise
  clickTauSeconds: number;                 // click impulse decay
  rod: { crank: MachineComponentId; pinRadius: number; pinPhaseDeg: number; length: number; sliderX: number };
  gears: { large: { teeth: number; pitchRadius: number }; small: { teeth: number; pitchRadius: number } };
}
export const DRIVE_TRAIN: DriveTrainConfig = {
  masterSpeed: { base: 60, gain: 0.5, min: 20, max: 240 }, masterDirection: -1, clickTauSeconds: 0.05,
  rod: { crank: 'mainShaft', pinRadius: 5, pinPhaseDeg: 0, length: 69, sliderX: -44 },
  gears: { large: { teeth: 14, pitchRadius: 28 }, small: { teeth: 8, pitchRadius: 16 } } };
export const MACHINE_LINK_STYLE = {
  beltDepth: MACHINE_LAYER_DEPTH.mid + 5, rodDepth: MACHINE_LAYER_DEPTH.front + 1, capDepth: MACHINE_LAYER_DEPTH.front + 2,
  belt: { outer: 0x2e1a12, inner: 0x6e3a22, dash: 0x8c4a2a, dashSpacing: 8, dashLength: 2 },
  rod:  { edge: 0x3e4246, core: 0x7d8286, eye: 0x5a5f63, eyeCentre: 0xa3a6a4, eyeRadius: 2 },
  cap:  { size: 4, hi: 0xa3a6a4, body: 0x7d8286, ring: 0x1f2225 } };   // replaces the old table; colours stay OUT of PALETTE
export interface MachineShadow { component: MachineComponentId; x: number; y: number; width: number; height: number; oval?: boolean }
export const MACHINE_SHADOWS: readonly MachineShadow[] = [
  { component:'supportFrame', x:-100, y:0, width:200, height:2 }, { component:'motorPlinth', x:-164, y:0, width:48, height:2 },
  { component:'flywheelPedestal', x:126, y:0, width:48, height:2 }, { component:'flywheel', x:138, y:0, width:24, height:3, oval:true } ];
export const MACHINE_SHADOW_STYLE = { color: 0x5f5244, alpha: 0.5, depth: -1 } as const;
export const MACHINE_RENDER: { mode: 'renderTexture' | 'direct' } = { mode: 'renderTexture' };
// MACHINE_MOTION, MACHINE_ASSEMBLY unchanged. Removed: 'shaft'/'pipe' kinds, 'rotate'/'clickRotate'/'reciprocate' animations, smallGearHub/largeGearHub.
// SpeedCurve, AnimationDriver, Vec2, MachineLayer, MachineComponentDefinition (id, techId, minLevel, assetId, attach, size, origin, layer, depthBias?, animation, connections, effects, flipX?) keep their shapes.

// ---------- src/game/math/machineLayout.ts (T1b) ----------
export function componentDepth(def: MachineComponentDefinition): number;   // MACHINE_LAYER_DEPTH[def.layer] + (def.depthBias ?? 0)
// everything else in machineLayout.ts unchanged.

// ---------- src/game/math/driveTrain.ts (T2, NEW, pure) ----------
import type { Vec2 } from '../../data/machineComponents';
export interface MasterState { deg: number; pending: number }          // deg: UNWRAPPED float thetaM; pending: queued click impulse, deg of thetaM
export function addClickImpulse(s: MasterState, crankDeg: number, crankRatio: number): MasterState;
//   pending += crankDeg / crankRatio. Non-finite crankDeg or crankRatio, or crankRatio === 0 -> returns s unchanged. Never mutates s.
export function stepMaster(s: MasterState, degPerSec: number, direction: 1 | -1, dt: number, tauSec: number): MasterState;
//   if !(dt > 0) or any of dt/degPerSec/s.deg/s.pending/tauSec non-finite -> return s. Else:
//   e = tauSec > 0 ? exp(-dt/tauSec) : 0;  take = s.pending * (1 - e);  pending' = s.pending - take;
//   if |pending'| < 1e-3 { take += pending'; pending' = 0 }   // flush: impulses are conserved exactly
//   deg' = s.deg + direction*degPerSec*dt + take.   Returns a NEW object; no -0 in pending'.
export function partAngle(masterDeg: number, ratio: number, phaseDeg: number): number;
//   wrap(ratio*masterDeg + phaseDeg) into [0,360): ((x % 360) + 360) % 360; non-finite -> 0; never -0.
export function sliderCrank(centre: Vec2, pinRadius: number, rodLength: number, angleDeg: number): { pin: Vec2; slider: Vec2 };
//   a = rad(angleDeg); pin = (cx + r cos a, cy + r sin a); dx = pin.x - cx; slider = (cx, pin.y - sqrt(max(0, L^2 - dx^2))).
export interface GearMesh { ratio: number; phaseDeg: number; teeth: number }
export function meshPhaseError(masterDeg: number, large: GearMesh, small: GearMesh): number;
//   thetaL = partAngle(masterDeg, large.ratio, large.phaseDeg); thetaS = partAngle(masterDeg, small.ratio, small.phaseDeg);
//   fL = frac(thetaL*large.teeth/360); fS = frac((thetaS-180)*small.teeth/360); return |frac(fL+fS) - 0.5|;  frac(x) = x - floor(x).  0 = perfectly meshed.

// ---------- src/game/math/machineLinks.ts (T2; `linkSegments` is DELETED; connectionOffset + resolveConnectionPoint stay as they are) ----------
export interface Arc { centre: Vec2; radius: number; startRad: number; sweepRad: number }   // points: centre + radius*(cos t, sin t), t = startRad + k*sweepRad, k in [0,1]; sweep > 0 = increasing angle
export interface BeltPath { spans: [[Vec2, Vec2], [Vec2, Vec2]]; arcs: [Arc, Arc]; length: number }
export function beltPath(a: Vec2, ra: number, b: Vec2, rb: number): BeltPath | null;
//   d = |b - a|; null when ra <= 0, rb <= 0, d === 0 or d <= |ra - rb| (one circle contains the other) or any input non-finite.
//   phi = atan2(b.y-a.y, b.x-a.x); beta = asin((ra - rb)/d) (SIGNED); tp = phi + PI/2 - beta; tm = phi - PI/2 + beta; mp = (cos tp, sin tp); mm = (cos tm, sin tm)
//   spans[0] = [a + ra*mp, b + rb*mp];  spans[1] = [a + ra*mm, b + rb*mm]
//   arcs[0] (on a, outside = away from b): centre a, radius ra, startRad tp, sweepRad PI + 2*beta
//   arcs[1] (on b, outside = away from a): centre b, radius rb, startRad tm, sweepRad PI - 2*beta        (sweeps sum to 2*PI)
//   length = |span0| + |span1| + ra*sweep0 + rb*sweep1.   Endpoints: arc0 runs spans[0][0] -> spans[1][0]; arc1 runs spans[1][1] -> spans[0][1].
export function rasterLine(p: Vec2, q: Vec2): Vec2[];          // Bresenham between Math.round(p) and Math.round(q), integers, both ends included, ordered p->q, no duplicates
export function rasterArc(arc: Arc): Vec2[];                   // n = max(1, ceil(|sweep|*radius/0.5)); t_k = start + sweep*k/n, k=0..n; Math.round each; drop CONSECUTIVE duplicates; ordered by increasing t
export function rasterBeltLoop(path: BeltPath): Vec2[];
//   ONE ordered closed loop in loop order: rasterLine(spans[0][0], spans[0][1]), reverse(rasterArc(arcs[1])), rasterLine(spans[1][1], spans[1][0]), reverse(rasterArc(arcs[0])).
//   Then remove ALL duplicate pixels, keeping the first occurrence (so order is preserved). Integers only.
export function rasterBelt(a: Vec2, ra: number, b: Vec2, rb: number): { inner: Vec2[]; outer: Vec2[] } | null;
//   inner = rasterBeltLoop(beltPath(a, ra+1, b, rb+1)); outer = rasterBeltLoop(beltPath(a, ra+2, b, rb+2)); null if either path is null.  ra, rb are the PULLEY radii.
export function pointsAlongBelt(loop: readonly Vec2[], spacing: number, offset: number): Vec2[];
//   shift = ((Math.floor(offset) % spacing) + spacing) % spacing; returns loop[i] for i = shift, shift+spacing, ... < loop.length (copies). spacing < 1 or empty loop -> [].
export function beltTravel(masterDeg: number, ratio: number, radius: number): number;   // -ratio * (masterDeg * PI/180) * radius; arc length moved along the loop order, signed; non-finite -> 0; no -0
export function coalesceRuns(points: readonly Vec2[]): Array<{ x: number; y: number; w: number; h: number }>;
//   groups integer pixels by y; within a row sorts x ascending, merges consecutive x into one run {x, y, w, h: 1}; no duplicates in = no overlap out; order: y ascending then x ascending.

// ---------- src/game/entities/MachineAnimator.ts (T3) ----------
export class MachineAnimator {
  constructor(session: GameSession, sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>);
  update(deltaMs: number, isActive: (id: MachineComponentId) => boolean): void;
  getDrive(): { masterDeg: number; degPerSec: number };            // masterDeg = unwrapped thetaM; degPerSec = idle drift magnitude of the last frame (>= 0)
  getDriverValues(): { manual: number; automation: number };       // unchanged
  destroy(): void;
}
// ---------- src/game/rendering/MachineLinks.ts (T4) ----------
export interface LinkDrawContext {
  pointOf(component: MachineComponentId, pointId: string): Vec2 | null;   // live position (sprite pos + point offset); null while hidden or assembling
  isLive(component: MachineComponentId): boolean;                         // visible AND not assembling
  masterDeg: number;                                                      // unwrapped thetaM
}
export class MachineLinks {
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container);  // creates THREE Graphics (belts, rods, caps) with setDepth(style depths) and adds them to `parent`
  draw(ctx: LinkDrawContext): void;                                        // skips all Graphics work when the geometry key is unchanged
  destroy(): void;                                                         // idempotent
}
// ---------- src/game/entities/MachineView.ts (T5) ---------- public API UNCHANGED:
//   constructor(scene, ctx: GameContext); container; sync(); isAssembling(id); getComponentState(id); getComponentSprite(id); getComponentWorldPosition(id); shake(); update(deltaMs); destroy().
```

---

# WAVE 1 (parallel: T1a, T1b, T2, T6 — disjoint files)

## T1a — Asset ids, manifest, fallback textures

**wave**: 1. **files_owned**: `src/assets/assetIds.ts`, `src/assets/manifest.ts`, `src/assets/manifest.test.ts`, `src/assets/fallbackTextures.ts`

**objective**: Register the 9 new machine assets, remove `machine.piston`, keep every size/origin equal to the frozen table.

**context**: contract block `assetIds.ts` above (ASSET_IDS order and the manifest table). Read the three files first. `AssetEntry` shape does not change.
- `assetIds.ts`: replace the id list exactly as in the contract (22 ids).
- `manifest.ts`: remove the `machine.piston` entry. Add 9 entries with the contract's width/height/origin, `tileable: 'none'`, a one-sentence `description` each (mirror the prompt cores in `docs/plan/ART_AUDIT.md` §4). Keep the order of entries as in ASSET_IDS.
- **`file` rule (IMPORTANT)**: set `file` to the path ONLY IF that file already exists at the time you run: check with `ls /home/user/WhatExatlyDoesThisMachineDo/public/assets/machine/`. Otherwise `file: null` (procedural fallback). Existing assets keep their current non-null files (`machine/support-frame.png`, `hand-crank.png`, `gear-small.png`, `gear-large.png`, `flywheel.png`, `worn-motor.png`; `terrain/ground.png` etc. untouched). The Director flips the remaining nulls to the paths in the contract table when the art lands. In NOTES list each new id with `file: null | path`.
- `fallbackTextures.ts`: add the four pulley ids (`machine.pulleyMotor`, `pulleyMain`, `pulleyCrank`, `pulleyFlywheel`) to `PAINTERS` with `paintGear`; every other new id uses the existing generic plate by default. Do not edit painter files.
- `manifest.test.ts`: keep all existing tests (they must stay valid). Add: (1) a table-driven test that each of the 9 new ids has exactly the contract width, height and origin; (2) `'machine.piston'` is not in `ASSET_IDS`; (3) the `file` values of file-backed entries are unique and end with `.png`; (4) the existing disk-file test stays as is (it passes while nulls remain).

**constraints**: pure (manifest/assetIds); no Phaser in them; do not touch painters, `machineComponents.ts` or any png.

**acceptance**: 22 ids; every new entry matches the contract; `machine.piston` gone from `src/assets`; the only tsc errors left (from other workers) are outside your files; the component-size test in `manifest.test.ts` passes after T1b lands (it reads `MACHINE_COMPONENTS`; if it fails ONLY because T1b has not landed yet, say so in NOTES).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/assets
npx tsc --noEmit
grep -rn "machine\.piston'" src/assets && echo FAIL || echo OK
```

## T1b — Machine data and layout

**wave**: 1. **files_owned**: `src/data/machineComponents.ts`, `src/data/machineComponents.test.ts`, `src/game/math/machineLayout.ts`, `src/game/math/machineLayout.test.ts`, `src/game/math/machineVisibility.test.ts`

**objective**: Rewrite the machine data to the frozen contract (16 components, 9 sockets, driven/slider animations, 3 links, drive-train config, link style, shadows, render mode) and add the sub-layer depth bias.

**context**: contract block `machineComponents.ts` above. Read the current file and test first. Keep `MACHINE_MOTION`, `MACHINE_ASSEMBLY`, `MACHINE_LAYER_DEPTH`, `MACHINE_BOUNDS`, `Vec2`, `SpeedCurve`, `AnimationDriver`, `ProductionEffect` as they are. `CRANK_FEEDBACK`/`PALETTE` imports may become unused: remove them. Keep `src/data` free of any `src/game` import.

Component table (write each as a full `MachineComponentDefinition` literal; `minLevel: 1` and `effects: []` unless stated; `origin` is the normalised pivot; `layer`+`depthBias` give the draw depth; `attach.offset` is `{x:0,y:0}` for all):

| id | techId | socket | assetId | size (w x h) | origin | layer, depthBias | animation | connections |
|---|---|---|---|---|---|---|---|---|
| supportFrame | handCrank | null | machine.frame | 200x110 | 0.5,1 | frame, 0 | none | [] |
| bearingM | handCrank | mainHub | machine.bearingPlate | 16x16 | 0.5,0.5 | frame, 1 | none | [] |
| bearingP | handCrank | crankHub | machine.bearingPlate | 16x16 | 0.5,0.5 | frame, 1 | none | [] |
| gearLarge | reinforcedCrank | mainHub | machine.gearLarge | 64x64 | 0.5,0.5 | mid, 0 | driven ratio 1, phase 0 | [] |
| mainShaft | handCrank | mainHub | machine.pulleyMain | 24x24 | 0.5,0.5 | mid, 2 | driven 1, 0 | `belt` (0,0) belt r10; `pin` (0,0) pin r5 |
| gearSmall | gearRatio | crankHub | machine.gearSmall | 40x40 | 0.5,0.5 | mid, 1 | driven -1.75, phase 22.5 | [] |
| crankPulley | flywheel | crankHub | machine.pulleyCrank | 32x32 | 0.5,0.5 | mid, 2 | driven -1.75, 0 | `belt` (0,0) belt r15 |
| handCrank | handCrank | crankHub | machine.crank | 48x48 | 0.5,0.5 | front, 0 | driven -1.75, 0 | [] |
| flywheelPedestal | flywheel | flywheelBase | machine.pedestal | 48x64 | 0.5,1 | back, 0 | none | [] |
| flywheel | flywheel | flywheelHub | machine.flywheel | 96x96 | 0.5,0.5 | mid, 0 | driven -2.1875, 0 | [] ; effects: keep the current `glow` effect |
| flywheelPulley | flywheel | flywheelHub | machine.pulleyFlywheel | 28x28 | 0.5,0.5 | mid, 3 | driven -2.1875, 0 | `belt` (0,0) belt r12 |
| motorPlinth | wornMotor | motorBase | machine.motorPlinth | 48x10 | 0.5,1 | mid, 0 | none | [] |
| wornMotor | wornMotor | motorMount | machine.motor | 64x48 | 0.5,0.5 | mid, 1 | vibrate: driver 'automation', amplitude 1, speed {base 8, gain 0.3, min 2, max 20} (as today) | [] ; effects: keep the current `vibrate` effect |
| motorPulley | wornMotor | motorPulleyHub | machine.pulleyMotor | 12x12 | 0.5,0.5 | mid, 2 | driven 2, 0 | `belt` (0,0) belt r5 |
| pistonYoke | pistonArray | yokePin | machine.pistonYoke | 80x16 | 0.5,0.75 | back, 0 | slider | `eye` (0,0) pin r2 |
| pistonArray | pistonArray | pistonBed | machine.pistonBlock | 96x58 | 0.5,1 | back, 1 | none | [] ; effects: keep the current `steam` effect |

(The `depthBias` field is omitted when 0.) Write a short comment line above each component group naming its audit role.

**machineLayout.ts**: `componentDepth(def)` returns `MACHINE_LAYER_DEPTH[def.layer] + (def.depthBias ?? 0)`; update the doc comment. Nothing else changes in that file.

**Tests to write/update** (`machineComponents.test.ts` keeps the invariants that still make sense; src/data tests must NOT import from src/game, inline helpers as today):
- Remove/replace the tests that mention `shaft`, `pipe`, `clickRotate`, `reciprocate`, `smallGearHub`, old sockets, the old gear distance range, `driverOf('gearSmall')` and `pistonArray` reciprocation.
- Ids unique and match keys; `SOCKET_IDS` equals socket keys; canonical order equals the contract list; every bbox (from the STATIC attachment) inside `MACHINE_BOUNDS`; sizes positive; origins in [0,1]; `minLevel >= 1`; `vibrate` curves have `min <= max` and `base > 0`.
- Link tests: every endpoint exists; `belt` links connect two `belt` points, `rod` links connect two `pin` points; belt endpoints have positive radius; every connection point of every component appears in at least one link; connection points of `driven` components sit at (0,0).
- **Ratios**: `|ratio| * radius` equal on both pulleys of each belt (motorPulley 2*5 = mainShaft 1*10; crankPulley 1.75*15 = flywheelPulley 2.1875*12, use `toBeCloseTo(.., 9)`).
- **Gears**: socket distance mainHub to crankHub = 44 = `DRIVE_TRAIN.gears.large.pitchRadius + small.pitchRadius`; `gearSmall.ratio === -large.teeth / small.teeth`; `gearLarge.ratio === 1`; `gearSmall.phaseDeg === 180 / small.teeth`; `gearLarge.phaseDeg === 0`.
- **Rod**: `DRIVE_TRAIN.rod.pinRadius` equals the `pin` point radius of `DRIVE_TRAIN.rod.crank`; `sliderX` equals `MACHINE_SOCKETS.mainHub.x` and `yokePin.x`; `rod.length` is >= 3 * pinRadius; `MACHINE_SOCKETS.yokePin.y` lies within [-130, -120].
- **Support**: at the full tech stage every `driven` component sits on a support: its static attachment point lies inside the bbox of one of `bearingM`, `bearingP`, `flywheelPedestal`, EXCEPT `motorPulley` (carried by the motor). Also `motorPulley`'s attachment is inside the `wornMotor` bbox.
- **Unlock coherence**: import `TECHNOLOGIES` from `./technologies`. `dependsOn(a, b)` = tech `a` requires `b` transitively (walk `requires` entries of `type === 'tech'`). For every link, the two end techs are equal or one `dependsOn` the other. Then check the stage prefixes of the order `['handCrank','gearRatio','wornMotor','motorTuning','reinforcedCrank','flywheel','pistonArray']` (a tech counts as owned at level 3 for gearRatio, 5 for motorTuning, else 1; techs not yet in the prefix are level 0): for every prefix, the visible set (`techLevels[tech] >= minLevel`) satisfies: if `pistonYoke` is visible then `mainShaft` is; every visible `driven` component (except motorPulley) has its support component visible; `mainShaft` and `bearingM` are visible at the first prefix.
- Style/shadow/render tables: depths are `beltDepth 25, rodDepth 31, capDepth 32`; `cap.size === 4`; `MACHINE_SHADOWS` has 4 entries with ids that exist; `MACHINE_RENDER.mode === 'renderTexture'`; `MACHINE_SHADOW_STYLE.depth < 0`.
- `machineLayout.test.ts`: update the visible-at-start test (`supportFrame`, `bearingM`, `bearingP`, `mainShaft`, `handCrank` visible; the other 11 hidden); `componentDepth`: supportFrame 10, bearingM 11, handCrank 30, mainShaft 22, flywheelPulley 23, pistonYoke 0, pistonArray 1, plus a literal def with `depthBias: 4`; keep the other tests (they use `crankHub`, which still exists).
- `machineVisibility.test.ts`: at start the visible set equals the 5 ids above; after `gearRatio: 1` it has `gearSmall` added (size 6); keep the other tests.

**constraints**: no Phaser; no `any`; no component beyond the table; leave `MACHINE_MOTION`/`MACHINE_ASSEMBLY` numbers alone; do not edit `world.ts`.

**acceptance**: contract exports all exist with the exact numbers above; `npx vitest run src/data/machineComponents.test.ts src/game/math/machineLayout.test.ts src/game/math/machineVisibility.test.ts` green; the manifest component-size test (T1a) is green once both land.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/game/math/machineLayout.test.ts src/game/math/machineVisibility.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|'shaft'|'pipe'|clickRotate|reciprocate|smallGearHub|largeGearHub" src/data/machineComponents.ts src/game/math/machineLayout.ts && echo FAIL || echo OK
```
(tsc errors in MachineAnimator/HandCrank/MachineView/MachineLinks are expected and not yours. `src/data/world.test.ts` is T6's and may appear mid-wave.)

## T2 — Pure drive math and belt raster

**wave**: 1. **files_owned**: `src/game/math/driveTrain.ts`, `src/game/math/driveTrain.test.ts`, `src/game/math/machineLinks.ts`, `src/game/math/machineLinks.test.ts`, `src/game/math/animation.ts`, `src/game/math/animation.test.ts`

**objective**: Implement the contract functions exactly as spelled out (driveTrain.ts, machineLinks.ts), and drop the dead `advanceAngle`/`reciprocateOffset`.

**context**: contract blocks `driveTrain.ts` and `machineLinks.ts` above. Read the three existing math files and tests first. Pure TS; no Phaser, no DOM. The only data import allowed is types from `'../../data/machineComponents'` (`Vec2`, plus `ConnectionPoint`/`MachineComponentDefinition`/`SocketId` for the kept functions). Do NOT import runtime data (`MACHINE_COMPONENTS`, `DRIVE_TRAIN`) in your tests: T1b changes it concurrently; use literals.
- `animation.ts`: keep `animationSpeed`, `decayActivity`, `addActivity`, `driverValue`, `clampFrameSeconds`, `advancePhase`, `vibrateOffset`. Delete `advanceAngle` and `reciprocateOffset` (and `noNegativeZero` only if it becomes unused). `animation.test.ts`: delete exactly the tests of the two deleted functions.
- `machineLinks.ts`: keep `connectionOffset` and `resolveConnectionPoint` exactly; delete `linkSegments`; add the contract functions. Every function gets a one-line formula comment. No `-0` in any returned coordinate.
- Loop-order check used in tests: for the returned `BeltPath`, `arcs[0]` start point equals `spans[0][0]`, arc0 end point (start + sweep) equals `spans[1][0]`, arc1 start equals `spans[1][1]`, arc1 end equals `spans[0][1]` (1e-9).

**tests (acceptance)** — `driveTrain.test.ts`:
- `sliderCrank`: for 72 angles (0,5,..,355) with centre (-44,-56), r 5, L 69: `hypot(pin - slider)` equals 69 to 1e-9 and `slider.x === centre.x`; over those angles `min(slider.y)` is about -130 (within 0.1) and `max(slider.y)` about -120 (within 0.1); pin at angle 0 is (-39,-56); when L < |dx| the slider y equals the pin y (no NaN).
- `stepMaster`: one impulse `addClickImpulse({deg:0,pending:0}, 90, -1.75)` gives pending -51.4285714...; stepping with `degPerSec 0`, dt 1/60, tau 0.05 for 12*tau worth of frames (36 frames) leaves `pending === 0` and `deg` equal to -51.428571 to 1e-6 (conserved); after 0.25 s of steps (15 frames) `deg` is within 5% of the total; `dt = 0` and negative dt return unchanged values; NaN in dt/degPerSec/tau/deg returns the state unchanged; three impulses (30, 45, 15 deg with ratio 1) then enough steps give `deg` = 90 (1e-6) when drift is 0; drift: `direction -1`, 60 deg/s, dt 0.5, no pending -> deg -30; `addClickImpulse` with ratio 0 or NaN returns the state unchanged and never mutates its input.
- `partAngle`: results in [0,360) for ratios {1,-1.75,-2.1875,2}, 200 seeded random masters in [-1e5,1e5]; `Object.is(partAngle(0,1,0), 0)`; `partAngle(-90,1,0) === 270`; `partAngle(360,1,0) === 0`; ratio -1.75, master -51.4285714285714 -> about 90 (1e-6); NaN -> 0.
- `meshPhaseError`: with large `{ratio:1, phaseDeg:0, teeth:14}` and small `{ratio:-1.75, phaseDeg:22.5, teeth:8}`: below 1e-9 for 1000 seeded random masters in [-1e4,1e4] and for master 0; with small phase 0 it is greater than 0.1 for master 0; the result is always in [0, 0.5].

`machineLinks.test.ts`:
- Keep the `connectionOffset`/`resolveConnectionPoint` tests but remove their dependency on `handCrank.shaft`: use a literal definition (the existing `literalDef` helper) with a `belt` point; delete the `linkSegments` tests.
- `beltPath` for the motor belt (a=(-114,-31), ra=6, b=(-44,-56), rb=11, i.e. pulley radii +1): span ends lie on the circles (|end - centre| equals the radius, 1e-9); each span is tangent (dot of the span direction with the radius vector at both ends is 0 within 1e-9); `arcs[0].sweepRad + arcs[1].sweepRad === 2*PI` (1e-9); small-wrap sweep in degrees is about 172.3 and large about 187.7 (0.1); loop-order check passes; `length` equals the sum of its parts; equal radii (ra = rb) give sweeps PI and PI with parallel spans; the crank belt (a=(0,-56) r16, b=(150,-56) r13) has the spans' a-end y values about -72 and -40 (0.1); returns null when one circle contains the other, for d = 0, ra <= 0, NaN.
- `rasterLine`: horizontal, vertical, diagonal and shallow-slope cases; endpoints included; all integers; no duplicates; reversed call gives the reversed list; p === q gives one point.
- `rasterArc`: full circle radius 10 gives integer points, every point within 0.6 of the true circle, consecutive points are 8-neighbours (dx, dy in {-1,0,1}); no consecutive duplicates.
- `rasterBeltLoop` / `rasterBelt` on the motor belt and crank belt: all coordinates integers, no duplicate pixels, consecutive pixels `max(|dx|,|dy|) <= 2`, last pixel within 2 of the first; `outer.length > inner.length`; `rasterBelt` null for a degenerate (contained) pair.
- `pointsAlongBelt`: loop of 20 points, spacing 8, offset 0 gives indices 0,8,16; offset 3 gives 3,11,19; offset -1 gives 7,15; offset 8 equals offset 0; empty loop or spacing 0 gives [].
- `beltTravel`: master -90, ratio 2, radius 5 gives 5*PI (1e-9); ratio -1.75 flips the sign; NaN gives 0; `Object.is(beltTravel(0, 1, 5), 0)`.
- `coalesceRuns`: pixels (0,0),(1,0),(2,0),(5,0),(0,1) give runs `{0,0,3,1},{5,0,1,1},{0,1,1,1}`; unsorted input works; empty input gives [].

**constraints**: pure; each function's behaviour exactly as in the contract (do not "improve" signatures); tests use a seeded LCG, no `Math.random`; no `-0`.

**acceptance**: all listed tests pass; `animation.ts` no longer exports `advanceAngle`/`reciprocateOffset`; `linkSegments` gone.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/driveTrain.test.ts src/game/math/machineLinks.test.ts src/game/math/animation.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|\bany\b|linkSegments|advanceAngle|reciprocateOffset" src/game/math/driveTrain.ts src/game/math/machineLinks.ts src/game/math/animation.ts && echo FAIL || echo OK
```
(tsc errors in MachineAnimator.ts / the MachineLinks.ts renderer are expected: they still import the deleted functions until wave 2.)

## T6 — Scene polish (non-machine)

**wave**: 1. **files_owned**: `src/data/world.ts`, `src/data/world.test.ts` (NEW), `src/data/notifications.ts`, `src/game/rendering/ParallaxBackground.ts`, `src/ui/toasts.css`

**objective**: Haze the far layers and move the toast column out of the machine's way.

**context**: read the five current files. Do not touch `src/ui/toasts.ts`, `notificationRules.ts` or their tests.
- `world.ts`: `ParallaxLayerDef` gains optional `tint?: number`. `PARALLAX_LAYERS`: pylons `alpha: 0.45, tint: 0xb8a98f`; skyline `alpha: 0.4`; sky and mountains unchanged. Add a comment `// tint: haze colour multiplied into the layer (audit S3 #14)`.
- `ParallaxBackground.ts`: for the tileSprite branch, call `.setTint(def.tint)` only when `def.tint !== undefined` (a small `if` after creating is fine). The hex lives in data, none in this file.
- `notifications.ts`: `TOAST_CONFIG.maxVisible: 2` (other keys unchanged). Existing notification tests stay green.
- `toasts.css`: `#toast-stack` becomes a fixed top-right column: `position: fixed; top: 16px; right: 16px; left: auto; transform: none; align-items: flex-end;` (keep z-index 200, pointer-events none, flex column, gap). `.toast`: `box-sizing: border-box; max-width: min(360px, 92vw); text-align: right;` Keep fonts, borders, animations. Add a comment `/* top-right column: never covers x < 900 at 1280x720 (right 16 + width 360); audit defect 11 */`.
- `world.test.ts` (NEW): pylons alpha 0.45 and tint `0xb8a98f`; skyline alpha 0.4; mountains 0.45 and sky 1 unchanged; every other layer has no `tint`; `TOAST_CONFIG.maxVisible === 2` (import from `./notifications`); all `alpha` in (0,1]; `PARALLAX_LAYERS` ids are unique.

**constraints**: no other balance changes; no Phaser in data; do not change depth values.

**acceptance**: the values above; tests green for these files; CSS contains `right: 16px`, no `left: 50%`, and `max-width: min(360px`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/world.test.ts src/ui
npx tsc --noEmit
grep -n "left: 50%" src/ui/toasts.css && echo FAIL || echo OK
grep -n "0x" src/game/rendering/ParallaxBackground.ts && echo FAIL || echo OK
```

---

# WAVE 2 (parallel: T3, T4, T5 — disjoint files; wave 1 done and its gate green)

## T3 — Animator and crank input

**wave**: 2. **files_owned**: `src/game/entities/MachineAnimator.ts`, `src/game/entities/HandCrank.ts`, `src/game/math/driveData.test.ts` (NEW)

**objective**: One master angle drives every part; the crank click input becomes a world-space circular `Zone`; the data to math integration is tested.

**context**: read both files, `src/data/machineComponents.ts` (new), `src/game/math/driveTrain.ts`, `animation.ts`, `machineLayout.ts`, contract `MachineAnimator` above. Imports: `stepMaster`, `addClickImpulse`, `partAngle`, `sliderCrank`, `type MasterState` from `../math/driveTrain`; `animationSpeed`, `decayActivity`, `addActivity`, `driverValue`, `clampFrameSeconds`, `advancePhase`, `vibrateOffset` from `../math/animation`; `resolveAttachment` from `../math/machineLayout`; `DRIVE_TRAIN`, `MACHINE_COMPONENTS`, `MACHINE_COMPONENT_IDS`, `MACHINE_MOTION` from data; `CRANK_FEEDBACK` from `../../data/world`.

`MachineAnimator`:
- State: `master: MasterState = {deg:0, pending:0}`, `manual = 0`, `lastDegPerSec = 0`, `phases: Map` (vibrate only).
- Constructor subscriptions: `session.on('click', ({gained}) => { manual = addActivity(manual, gained, MACHINE_MOTION.manualTauSeconds); master = addClickImpulse(master, CRANK_FEEDBACK.degreesPerClick, crankRatio); })` where `crankRatio` is read once from `MACHINE_COMPONENTS.handCrank.animation` (it must be `kind === 'driven'`, else throw an Error). `session.on('reset', ...)`: `master = {deg:0,pending:0}`, `manual = 0`, `lastDegPerSec = 0`, `phases.clear()`, then set angle 0 on every sprite whose animation is `driven`.
- `update(deltaMs, isActive)`:
  1. `dt = clampFrameSeconds(...)`; `manual = decayActivity(manual, dt, tau)`; `dv = driverValue('combined', manual, session.rates.perSecond)`.
  2. `degPerSec = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(DRIVE_TRAIN.masterSpeed, dv)`; `master = stepMaster(master, degPerSec, DRIVE_TRAIN.masterDirection, dt, DRIVE_TRAIN.clickTauSeconds)`; `lastDegPerSec = degPerSec`.
  3. For every id in `MACHINE_COMPONENT_IDS` with a sprite and `isActive(id)`: `driven` -> `sprite.setAngle(partAngle(master.deg, anim.ratio, anim.phaseDeg))`; `slider` -> `c = resolveAttachment(MACHINE_COMPONENTS[DRIVE_TRAIN.rod.crank])` (the crank hub), `crankAnim = MACHINE_COMPONENTS[DRIVE_TRAIN.rod.crank].animation` (must be `driven`), `angle = partAngle(master.deg, crankAnim.ratio, crankAnim.phaseDeg) + DRIVE_TRAIN.rod.pinPhaseDeg`, `s = sliderCrank(c, DRIVE_TRAIN.rod.pinRadius, DRIVE_TRAIN.rod.length, angle).slider`, `sprite.setPosition(DRIVE_TRAIN.rod.sliderX, Math.round(s.y))`; `vibrate` -> as the current code (speed from its own `anim.speed` and its own driver value, phase map, `vibrateOffset`, rest position when speed 0). Parts that are inactive or assembling are NOT touched.
  4. Never touches the position of any `driven` sprite.
- `getDrive()` returns `{ masterDeg: master.deg, degPerSec: lastDegPerSec }`; `getDriverValues()` keeps working (`manual`, `automation`); `destroy()` unsubscribes both.
- Delete the old `angles` map, `zeroRotations` for `rotate`, and every use of `advanceAngle` / `reciprocateOffset`.

`HandCrank`:
- Constructor signature unchanged: `(scene, ctx, machine, floatingText)`. No sprite lookup, no tween, no angle writes. Remove `spin`, `targetAngle`, `tween`, `rebaseAngles`, the `FULL_TURN_DEG`/`REBASE_THRESHOLD_DEG` constants.
- Input: `const pos = machine.getComponentWorldPosition('handCrank'); const r = CRANK_FEEDBACK.hitRadius * PIXEL_SCALE; this.zone = scene.add.zone(pos.x, pos.y, 2 * r, 2 * r).setDepth(DEPTH.machine + 1); this.zone.setInteractive({ hitArea: new Phaser.Geom.Circle(r, r, r), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true });` (zone hit areas are in local top-left coordinates, hence centre `(r, r)`). `import { DEPTH, PIXEL_SCALE, CRANK_FEEDBACK } from '../../data/world'`.
- `pointerdown` handler: `const gained = this.ctx.session.click();` then `this.floatingText.spawn(this.machine.getComponentWorldPosition('handCrank'), '+' + formatNumber(gained));` then `this.machine.shake();`. (The turn comes from the animator's click subscription.)
- `destroy()`: `if (this.zone.scene) { this.zone.off('pointerdown', handler); this.zone.destroy(); }`.

`driveData.test.ts` (NEW, node env, pure, imports real data + math):
- Mesh with real data: build `large`/`small` as `{ratio, phaseDeg, teeth}` from `MACHINE_COMPONENTS.gearLarge/gearSmall.animation` and `DRIVE_TRAIN.gears`; `meshPhaseError` below 1e-9 for 1000 seeded random masters in [-1e4,1e4]; and above 0.1 at master 0 if `small.phaseDeg` is replaced by 0.
- Rod with real data: over 72 angles `slider.y` stays in [-130.1, -119.8] and `|pin - slider| = 69`; the yoke rest position `round(slider.y)` at master 0 equals `MACHINE_SOCKETS.yokePin.y` (-125).
- Click feel: simulate 60 fps for 0.25 s (15 steps) from `{deg:0,pending:0}` after one `addClickImpulse(s, CRANK_FEEDBACK.degreesPerClick, crankRatio)` with `degPerSec 0` and `DRIVE_TRAIN.clickTauSeconds`: the unwrapped crank angle `crankRatio * deg` (a positive number, since both are negative) is between 85 and 91; the pinion mesh error at that master is below 1e-9.
- Idle drift direction: with `masterDirection` and 60 deg/s over 1 s the unwrapped crank angle `crankRatio * deg` is positive.
- Belt kinematics: for every belt link, `abs(ratio_from * radius_from)` equals `abs(ratio_to * radius_to)`, using `connections[].radius` and `animation.ratio`.

**constraints**: no new constants in these files except the zone depth offset (`DEPTH.machine + 1`); no hex literals; sprite `setAngle` only for `driven`; no `any`; `HandCrank` keeps calling `session.click()` exactly once per click and nothing else mutates state; Phaser typings: no `override` on `create`.

**acceptance**: `npx tsc --noEmit` has no errors in your files (MachineView/MachineLinks may still error until T4/T5 land: list them); `driveData.test.ts` green; reasoning check: one click gives +90 degrees of crank rotation in about 0.25 s, the pinion stays meshed (test), idle drift turns the crank clockwise, reset zeroes everything, hidden or assembling parts are not touched.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/driveData.test.ts
npx tsc --noEmit
grep -nE "advanceAngle|reciprocate|clickRotate|tweens|0x[0-9a-fA-F]{6}|\bany\b" src/game/entities/MachineAnimator.ts src/game/entities/HandCrank.ts && echo FAIL || echo OK
```

## T4 — Link renderer

**wave**: 2. **files_owned**: `src/game/rendering/MachineLinks.ts`

**objective**: Draw belts, the conrod and the axle caps as 1x1 pixel rectangles on integer art px, with the contract API.

**context**: read the current file, `src/data/machineComponents.ts` (new: `MACHINE_LINKS`, `MACHINE_LINK_STYLE`, `DRIVE_TRAIN`, `MACHINE_COMPONENTS`, `MACHINE_COMPONENT_IDS`), `src/game/math/machineLinks.ts`, `driveTrain.ts` and `machineLayout.ts` (new). Contract `MachineLinks`/`LinkDrawContext` above (the class is constructed by `MachineView` as `new MachineLinks(scene, parts)`).
- Constructor: three Graphics created with `scene.make.graphics({}, false)` (NOT `scene.add`), `setDepth(MACHINE_LINK_STYLE.beltDepth | rodDepth | capDepth)`, each added with `parent.add(g)`. Fields: `belts`, `rods`, `caps`.
- A private `plot(g, color, pixels)` helper: `g.fillStyle(color, 1)`, then for each run of `coalesceRuns(pixels)`: `g.fillRect(run.x, run.y, run.w, run.h)`. All coordinates are integers.
- `draw(ctx)`: build the geometry first, compute a string `key` from integers only (belt endpoints rounded to 1/100 plus the dash shift, rod pin and eye rounded, cap positions, the live flags), and return early when `key === lastKey`. Otherwise clear all three Graphics and redraw:
  - **Belts** (`link.kind === 'belt'`): `a = ctx.pointOf(from...)`, `b = ctx.pointOf(to...)`; skip if either is null or either `isLive` is false. `ra`, `rb` = the `radius` of the two connection points (skip when missing or <= 0). `r = rasterBelt(a, ra, b, rb)`; skip when null. Pass 1: plot every belt's `outer` in `belt.outer` colour; pass 2: every belt's `inner` in `belt.inner` colour; pass 3: dashes. Dashes: `travel = beltTravel(ctx.masterDeg, fromRatio, ra)` where `fromRatio` is the `ratio` of `MACHINE_COMPONENTS[link.from.component].animation` when `kind === 'driven'` (else 0); for `j` in `0..dashLength-1` take `pointsAlongBelt(r.inner, belt.dashSpacing, Math.floor(travel) + j)` and plot all of them in `belt.dash` colour (so each dash is `dashLength` pixels long along the loop, one dash per `dashSpacing` pixels).
  - **Rod** (`link.kind === 'rod'`): needs `isLive(from.component)` and `isLive(to.component)`. `hub = ctx.pointOf(link.from.component, link.from.point)` (the pin point sits at the pulley centre, offset 0,0; skip when null). `crankAnim = MACHINE_COMPONENTS[link.from.component].animation` must be `driven`; `angle = partAngle(ctx.masterDeg, crankAnim.ratio, crankAnim.phaseDeg) + DRIVE_TRAIN.rod.pinPhaseDeg`; `pin = sliderCrank(hub, DRIVE_TRAIN.rod.pinRadius, DRIVE_TRAIN.rod.length, angle).pin` rounded to integers; `eye = ctx.pointOf(link.to.component, link.to.point)` rounded (the yoke sprite already sits at the rounded slider y). Core line = `rasterLine(pin, eye)` in `rod.core`; edge rows = `rasterLine(pin + n, eye + n)` and `rasterLine(pin - n, eye - n)` where `n = (Math.round(nx), Math.round(ny))` and `(nx, ny)` is the unit normal of `eye - pin` (if the rod length is 0 skip the edges); edges plotted FIRST in `rod.edge`, then the core. Then the two eyes: for each of `pin`, `eye` plot the disc of radius `rod.eyeRadius` (all integer `(dx,dy)` with `dx*dx + dy*dy <= r*r`) in `rod.eye`, then the centre pixel in `rod.eyeCentre`.
  - **Caps**: ids with `animation.kind === 'driven'` and `ctx.isLive(id)`: position = `resolveAttachment(MACHINE_COMPONENTS[id])` (static socket), deduped by `x,y`. Each cap is `cap.size` x `cap.size` pixels with its top-left at `(x - cap.size/2, y - cap.size/2)`: the whole border ring in `cap.ring`, the inner 2x2 in `cap.body`, and the inner top-left pixel in `cap.hi`. Draw order: ring, body, hi.
- `destroy()`: destroy the three Graphics when they still have a `scene`; reset `lastKey`; safe to call twice.
- Constants (`KEY_SCALE`) stay named constants at the top; NO hex literals; the colours come only from `MACHINE_LINK_STYLE`.

**constraints**: no `lineBetween`, no `lineStyle`, no strokes: only `fillRect`; the early-return key check must be cheap (no raster work before it except what the key needs); no `any`; Phaser typings.

**acceptance**: `npx tsc --noEmit` clean in this file; reasoning check: an idle machine with no moved parts skips all Graphics work; hidden or assembling endpoints skip that link; at the start (only handCrank, mainShaft, bearings visible) only caps are drawn (no belt, no rod); dashes sit on real inner-row pixels; no fractional coordinates reach `fillRect`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "lineBetween|lineStyle|scene\.add|0x[0-9a-fA-F]{6}|\bany\b" src/game/rendering/MachineLinks.ts && echo FAIL || echo OK
```

## T5 — MachineView render path and contact shadows

**wave**: 2. **files_owned**: `src/game/entities/MachineView.ts`, `src/game/scenes/WorldScene.ts`

**objective**: Render the machine into an art-resolution RenderTexture (one pixel grid), keep every other behaviour, and add contact shadows. `WorldScene.ts` only if wiring needs it (likely untouched).

**context**: read `MachineView.ts`, contracts above, `src/data/machineComponents.ts` (new: `MACHINE_RENDER`, `MACHINE_SHADOWS`, `MACHINE_SHADOW_STYLE`, `MACHINE_BOUNDS`, `MACHINE_LAYER_DEPTH`) and `machineLayout.ts` (`componentDepth` now includes the bias). Verified Phaser 3.90 facts (from `node_modules/phaser/src/textures/DynamicTexture.js`): `RenderTexture#draw(entries, x, y)` sets the entry's position to `(x, y)` for the draw and restores it afterwards (so the `parts` container's own `x` is overwritten); a Container off the display list can be drawn; Graphics and visible children are honoured; `RenderTexture#clear()` exists; `rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)` sets sampling.
- **Display structure**: the outer `container` is created exactly as today (`scene.add.container(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y).setScale(PIXEL_SCALE).setDepth(DEPTH.machine)`). Mode `MACHINE_RENDER.mode`:
  - `'direct'`: `parts = scene.add.container(0, 0); container.add(parts)` (today's behaviour).
  - `'renderTexture'`: `parts = scene.make.container({ x: 0, y: 0 }, false)` (off the display list); `rt = scene.make.renderTexture({ x: MACHINE_BOUNDS.left, y: MACHINE_BOUNDS.top, width: MACHINE_BOUNDS.right - MACHINE_BOUNDS.left, height: MACHINE_BOUNDS.bottom - MACHINE_BOUNDS.top }, false).setOrigin(0, 0)` (400x208), `rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST)`, `container.add(rt)`. If the typings reject `make.renderTexture`, use `new Phaser.GameObjects.RenderTexture(scene, x, y, w, h)`. The RT image lands at world `MACHINE_ANCHOR + (left,top)*2`, scale 2, via the container.
- Sprites: `scene.add.sprite(...)` then `parts.add(sprite)` stays valid in both modes (Container.add removes it from the display list). Order of construction stays: sprites, then `new MachineLinks(scene, parts)`, then the shadow Graphics, then `parts.sort('depth')` once, then the animator.
- **Depth**: `setDepth(componentDepth(def))` (already via `componentDepth`; the bias comes from T1b).
- **Update** (`update(deltaMs)`): `animator.update(deltaMs, isActive)`; `const d = animator.getDrive()`; `links.draw({ pointOf, isLive: isActive, masterDeg: d.masterDeg })`; `drawShadows()`; then in RT mode `rt.clear(); rt.draw(parts, -MACHINE_BOUNDS.left + Math.round(parts.x), -MACHINE_BOUNDS.top + Math.round(parts.y));` (the rounded `parts.x/y` carries the shake). In `direct` mode nothing more.
- **Shadows**: one Graphics (`scene.make.graphics({}, false)`), `setDepth(MACHINE_SHADOW_STYLE.depth)`, added to `parts` BEFORE the sort. `drawShadows()` builds `key` = the ids of `MACHINE_SHADOWS` whose component `isActive` (visible and not assembling) joined by ','; returns when the key equals the last key; else clears and draws: `fillStyle(color, alpha)`; rect shadow: `fillRect(x, y, width, height)`; oval shadow: for each row `j` in `0..height-1`: `t = (j + 0.5 - height/2) / (height/2)`, `w = Math.round(width * Math.sqrt(1 - t*t))`, `fillRect(x + Math.floor((width - w) / 2), y + j, w, 1)`. Integer coordinates only. Reset `lastShadowKey = ''` on `reset()`/`sync()`.
- Everything else unchanged: assembly tween (+ `partLanded` emit), `settle`, dust puffs (still `scene.add.image` then `parts.add`), shake on `parts`, `getComponentState`, `getComponentSprite`, `getComponentWorldPosition`, `reset`, `refresh`.
- **destroy()**: same order as today (unsubscribe, assemblies, puffs, animator, links), then `this.shakeTween?.stop()`, in RT mode `parts.destroy(true)` (it is not a child of `container`), then `container.destroy(true)` (frees the RT image and its texture). Guard against a Phaser-side destroy already done (check `scene`).
- `pointOf` stays: sprite position + `connectionOffset(...)`; it is now fed to the links only.
- Update the class doc comment to describe the two render modes.

**constraints**: no hex literals (colours from `MACHINE_SHADOW_STYLE`); no `override` on `create`; no new constants except where named at the top of the file; do not edit data files; the public API does not change; `direct` mode must behave exactly like today (plus the new pieces).

**acceptance**: `npm run typecheck && npm test && npm run build` clean after T3 and T4 land; reasoning check: RT mode draws once per frame after the animator and links; the RT origin maps machine (0,0) to the anchor (RT pixel (200,200) is the machine origin: `-left = 200`, `-top = 200`); the parts container is not on the display list in RT mode; assembling parts are drawn (they are children) but only live parts get shadows/links; `destroy` leaves no RT or Graphics.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "0x[0-9a-fA-F]{6}|\bany\b|override create" src/game/entities/MachineView.ts && echo FAIL || echo OK
grep -n "MACHINE_RENDER\|renderTexture\|\.draw(parts\|rt\.draw" src/game/entities/MachineView.ts
```
(If T3/T4 have not landed yet when you run tsc, errors on `getDrive` / `LinkDrawContext` are theirs: list them in NOTES.)

---

# WAVE 3 — EM Mode B (T7) and Director

Run: `npm run typecheck`, `npm test`, `npm run build`. Greps:
```
grep -rnE "'shaft'|'pipe'|clickRotate|reciprocate|smallGearHub|largeGearHub|machine\.piston'|linkSegments|advanceAngle" src
grep -rn "phaser" src/simulation src/data src/persistence src/utils src/game/math
git diff --stat HEAD -- src/simulation          # must be empty
```
Check each acceptance in WP6.md Wave 1/2 against the code (esp. unlock coherence test, ratio tests, `driveData.test.ts`, T4 integer-only drawing, T5 offsets). Allowed glue: one-line integration fixes only.

**Director after Mode B (data edits, no worker needed):**
1. Read the art agent's "Produced assets" table in `docs/plan/ART_AUDIT.md`. For each new id set `file` in `src/assets/manifest.ts` (paths in the contract table) and re-run `npm test` (the disk-file test now bites; sizes must equal the table).
2. Smokes per `scripts/smoke/README.md`: `wp2-crank`, `wp3-techtree`, `wp4-persistence`, `full-machine` must print `errors: []`; `handCrank`, `gearSmall`, `wornMotor` still become visible at the expected steps; clicking the crank still credits ME (zone input).
3. Art Director reviews `full.png` and `full-zoom.png` against audit §2 defects 1-11 and §5. Tuning edits are DATA only: gear `phaseDeg`, `DRIVE_TRAIN.rod.pinPhaseDeg`, socket numbers, `MACHINE_RENDER.mode = 'direct'` if the RT path fails.
4. Update `docs/PROJECT_STATUS.md`, commit.

---

# Risks

- **RenderTexture + Graphics + off-list Container** is the biggest unknown (Phaser source says it works; not yet run in a browser). T5 keeps `direct` mode working; flip `MACHINE_RENDER.mode` if the full-machine smoke shows nothing or blur.
- **Fallback gears do not mesh.** `paintGear` makes 10 and 16 teeth; the real gears are 8 and 14. With fallback art the mesh test still passes (math only) but the picture will overlap. Real PNGs fix it; a gear whose sprite tooth is not on +x only needs `phaseDeg` tuned.
- **Manifest flip** (`file: null` to paths) is a Director step after art lands; until then the game uses fallback plates for the new parts (generic rust plates with an X; pulleys use the gear painter).
- **Motor vibration** moves `wornMotor` by up to 1 px but not `motorPulley`/plinth: a 1 px pulley-to-motor offset while running. Accept, or add the vibrate offset to `motorPulley` in a later tweak.
- **Before gearRatio** the crank (ratio -1.75) and mainShaft (ratio 1) spin at unrelated visual speeds (no mesh yet). Audit-approved; mainShaft is the motor/piston target.
- **Belt dash seam**: dashes are index-based on a closed loop, so one gap per belt can be shorter at the loop seam. Cosmetic.
- **Zone input**: the crank hit area is now world-space; the camera drag threshold logic is unchanged but must be re-checked by the `wp2-crank` smoke.
- Behaviour change: toasts `maxVisible 2` (no WP3 test asserts 3; verified by grep).
