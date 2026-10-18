# WP6b — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/ART_AUDIT.md` "Phase 3 code fixes" (C1a-C1d, C2, C3). Workers: `implementation-worker` (Haiku). No `src/simulation` change, `SAVE_VERSION` stays 1. Director pastes **Common preamble** (WP6-assignments.md "Common preamble" RULES block, same rules) + ONE task block.
All 3 tasks run in **wave 1** (parallel). After wave: `npx tsc --noEmit && npm test && npm run build`. Transient tsc errors while waves land (not a fault): T1 needs `machine.crankBrace` AssetId from T2; T3 `MachineAnimator.ts` needs `crankBrace` id from T1. Anything else = real bug.

## Contracts (frozen)
```ts
// src/data/machineComponents.ts (T1)
MACHINE_COMPONENT_IDS = ['supportFrame','bearingM','bearingP','gearLarge','mainShaft','gearSmall','crankPulley','handCrank','crankBrace',
  'flywheelPedestal','flywheel','flywheelPulley','motorPlinth','wornMotor','motorPulley','pistonYoke','pistonArray']   // 17
interface MachineComponentDefinition { ...; alsoVisibleWith?: { techId: TechId; minLevel: number }[] }
// gearLarge.techId -> 'gearRatio'. mainShaft + bearingM: techId 'gearRatio', minLevel 1, alsoVisibleWith [{ techId:'wornMotor', minLevel:1 }].
// crankBrace: { id:'crankBrace', techId:'reinforcedCrank', minLevel:1, assetId:'machine.crankBrace', attach:{socket:'crankHub',offset:{x:0,y:0}},
//   size:{width:48,height:48}, origin:{x:0.5,y:0.5}, layer:'front', depthBias:1, animation:{kind:'driven',ratio:-1.75,phaseDeg:0}, connections:[], effects:[] }
// src/game/math/machineLayout.ts (T1)
isComponentVisible(def, levels) = levels[def.techId] >= def.minLevel || (def.alsoVisibleWith ?? []).some(a => levels[a.techId] >= a.minLevel)
// src/assets (T2): AssetId 'machine.crankBrace' appended to ASSET_IDS after 'machine.pistonYoke'; manifest
//   { id:'machine.crankBrace', file:'machine/crank-brace.png', width:48, height:48, origin:{x:0.5,y:0.5}, tileable:'none',
//     description:'Riveted doubler strap and bolted boss flange that overlay the hand crank.' }
// src/game/math/crankLink.ts (T3, pure)
export const normDeg = (d: number): number            // ((d % 360) + 360) % 360, never -0
export function crankOffsetOnGearUp(crankDeg: number, masterDeg: number, ratio: number, phaseDeg: number): number
//   = normDeg(partAngle(crankDeg, ratio, phaseDeg) - partAngle(masterDeg, ratio, phaseDeg))
export function crankAngle(geared: boolean, crankDeg: number, masterDeg: number, offsetDeg: number, ratio: number, phaseDeg: number): number
//   = geared ? normDeg(partAngle(masterDeg, ratio, phaseDeg) + offsetDeg) : partAngle(crankDeg, ratio, phaseDeg)
// src/game/math/camera.ts (T3, pure). Zoom grid: PIXEL_SCALE*zoom is integer or half-integer => step = 0.5 / pixelScale (0.25 at scale 2).
export function zoomStep(pixelScale: number): number                                                  // 0.5 / pixelScale
export function snapZoom(zoom: number, pixelScale: number, min: number, max: number): number          // round(zoom/step)*step, clamp [min,max]
export function wheelToSnappedZoom(zoom: number, deltaY: number, pixelScale: number, min: number, max: number): number
//   deltaY<0: smallest grid value > zoom+1e-9; deltaY>0: largest grid value < zoom-1e-9; 0: snapZoom(zoom); result clamped [min,max]. Never returns off-grid
//   unless min/max are off-grid. Float grid values computed as k*step (k integer) so 1.25 etc. are exact.
// src/data/world.ts (T3): CAMERA gains wheelStepCooldownMs: 80 (keep every existing key; wheelZoomFactor stays, wheelToZoom stays exported/tested).
```

## T1 — data + visibility (wave 1)
- id `T1`. objective: C1a, C1b, C1c data side. files_owned: `src/data/machineComponents.ts`, `src/game/math/machineLayout.ts`, `src/data/machineComponents.test.ts`, `src/game/math/machineLayout.test.ts`, `src/game/math/machineVisibility.test.ts`.
- Do: apply contracts above (ids list+order, interface field, gearLarge tech, mainShaft/bearingM, crankBrace def after handCrank, `isComponentVisible`).
- Update tests: `machineComponents.test.ts` canonical order list + count 17; `visibleAt` calls real logic inline (same formula incl. alsoVisibleWith, no src/game import); link-coherence test uses `techsOf(def)=[techId,...alsoVisibleWith techIds]` and passes when ANY pair is equal or dependsOn either way; stage-prefix test: prefix 1 has NO mainShaft/bearingM, prefix>=2 has them; keep the "pistonYoke => mainShaft" and support checks. `machineLayout.test.ts`: start shows supportFrame, bearingP, handCrank; hidden: bearingM, mainShaft, gearLarge, gearSmall, crankBrace, rest. `machineVisibility.test.ts`: start set = {supportFrame, bearingP, handCrank}; gearRatio:1 adds {bearingM, mainShaft, gearLarge, gearSmall} (size 7).
- New describe "visibility per stage" (machineVisibility.test.ts, levels from `createInitialState(0).techLevels` + overrides): (s0) exactly 3 ids; (gearRatio 1) +4 above, no crankBrace; (wornMotor 1 only) mainShaft, bearingM, motorPlinth, wornMotor, motorPulley visible, gearLarge/gearSmall hidden; (reinforcedCrank 1 + gearRatio 3) crankBrace visible; (reinforcedCrank 1 alone) crankBrace visible; invariants over all combos of gearRatio{0,1} x wornMotor{0,1} x reinforcedCrank{0,1}: gearLarge visible <=> gearSmall visible; mainShaft visible <=> bearingM visible; mainShaft visible whenever gearLarge or wornMotor-parts visible.
- constraints: no Phaser; do not touch assets files. acceptance: contracts exact; tests above green. validation: `npx vitest run src/data/machineComponents.test.ts src/game/math/machineLayout.test.ts src/game/math/machineVisibility.test.ts`.

## T2 — assets + docs (wave 1)
- id `T2`. objective: C1c asset side, C3. files_owned: `src/assets/assetIds.ts`, `src/assets/manifest.ts`, `src/assets/manifest.test.ts`, `src/assets/fallbackTextures.ts`, `docs/ASSET_GUIDE.md` (docs/ rule exception for this file only).
- Do: add `machine.crankBrace` id + manifest entry (contract); `fallbackTextures.ts` PAINTERS `'machine.crankBrace': paintGear`; `manifest.ts` `machine.pulleyCrank` description -> `'Small flat-belt pulley (r8, centred in a 32×32 canvas) with crowned rim and solid three-rib web; belt rides inside the pinion root.'`; `machine.gearLarge` description unchanged. `manifest.test.ts`: add row to NEW_MACHINE_ENTRIES (`machine.crankBrace` 48x48 (0.5,0.5)), fix the "9 new ids" count to 10. ASSET_GUIDE: add `machine.crankBrace` table row (`machine/crank-brace.png`, 48 x 48, 0.5,0.5, layer `front`, depth 31, description above); crank row text "slim crank arm with r5.5 boss and wooden knob at r≈18" in addition to the existing description; gear rows (small + large) mention "solid recessed web, teeth one value step lighter than the frame"; pulleyCrank row (if present) r8 text; dedicated-painter list in Fallbacks mentions `machine.crankBrace` uses the gear painter.
- acceptance: asset-file-exists test passes (png already in public/assets/machine/crank-brace.png; do not create/modify pngs); size-matches-manifest test passes once T1 lands. validation: `npx vitest run src/assets`.

## T3 — animator + zoom snap (wave 1)
- id `T3`. objective: C1d, C2. files_owned: `src/game/math/crankLink.ts` (new), `src/game/math/crankLink.test.ts` (new), `src/game/math/camera.ts`, `src/game/math/camera.test.ts`, `src/game/entities/MachineAnimator.ts`, `src/game/rendering/CameraController.ts`, `src/data/world.ts`.
- C1d in `MachineAnimator`: add `crankState: MasterState`, `geared=false`, `crankOffsetDeg=0`. Crank parts = `['handCrank','crankBrace']` (use their own driven ratio/phase from data). Click handler: `if (isActive('gearSmall'))` is unknown there, so keep a field `gearsActive` updated at the top of `update()` (`isActive('gearSmall')`); click: `gearsActive ? master=addClickImpulse(master,...) : crankState=addClickImpulse(crankState,...)`, `manual` always. In `update()`: step `crankState` with `stepMaster(crankState, 0, 1, dt, clickTau)`. On the false->true edge of `gearsActive`: `crankOffsetDeg = crankOffsetOnGearUp(crankState.deg, master.deg, ratio, phase)`; move `crankState.pending` into `master.pending` (same ratio: add directly); `geared=true`. Driven loop: for crank parts use `crankAngle(geared, crankState.deg, master.deg, crankOffsetDeg, ratio, phase)`; all other driven parts unchanged (mesh phases untouched). Reset: clears `crankState`, `geared=false`, `crankOffsetDeg=0`, `gearsActive=false`.
- C2: add pure funcs (contract) to `camera.ts`; `CameraController.wheel` uses `wheelToSnappedZoom(this.zoom, deltaY, PIXEL_SCALE, this.minZoom, CAMERA.maxZoom)` and ignores events less than `CAMERA.wheelStepCooldownMs` after the last applied step (track `lastWheelMs` via `performance.now()`); `refocus` tween unchanged (ends on zoom 1, on grid).
- Tests `crankLink.test.ts` (seeded LCG, no Math.random): continuity — for 200 random (crankDeg, masterDeg) pairs `crankAngle(true, c, m, crankOffsetOnGearUp(c,m,-1.75,0), -1.75, 0)` equals `crankAngle(false, c, m, 0, -1.75, 0)` (compare mod 360, toBeCloseTo 9); after gearing, master +10 deg moves crank by exactly `-17.5` deg (mod 360); `normDeg` range [0,360), no -0. `camera.test.ts` zoom: `zoomStep(2)===0.25`; `snapZoom(1.1,2,0.5,2)===1`, `(1.13,..)===1.25`, `(2.7,..)===2`, `(0.1,..)===0.5`; every result of `snapZoom` over 500 seeded values in [0.3,2.4] satisfies `2*z` multiple of 0.5; `wheelToSnappedZoom(1,-1,2,.5,2)===1.25`, `(1,1,..)===0.75`, `(2,-1,..)===2`, `(0.5,1,..)===0.5`, off-grid `(1.1,-1,..)===1.25`, `(1.1,1,..)===1`, deltaY 0 snaps; walking in 10 times from 1 then out 10 times visits only grid values and returns to 1. Existing wheelToZoom tests stay.
- constraints: MachineAnimator/CameraController may import Phaser; no `0x` literals there; no behaviour change when all gears visible (angles identical to before, offset 0). acceptance: tests above green; no other test changed. validation: `npx vitest run src/game/math/crankLink.test.ts src/game/math/camera.test.ts` then full gate.

## Final gate (Director, then EM Mode B)
`npm run typecheck && npm test && npm run build`. EM Mode B also checks: handCrank click with no gears + motor rotates crank only (read animator), reset clears state, PROJECT_STATUS update by Director.
