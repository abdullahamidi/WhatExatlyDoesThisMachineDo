# WP6c assignments (Phase 4 art code fixes C4-1..C4-5)

Source: `docs/plan/ART_AUDIT.md` "Phase 4 code fixes"; scratch prototype `docs/plan/proto/wp6c-proto.diff` (workers may adapt; diff against a
scratch tree, not `git apply`-able as is). Assets on disk: `public/assets/bg/sky.png`, `public/assets/machine/rot/*-rot.png`.
`scripts/art/make_rot.py` + `rotsprite.py` already exist, do not touch. Rules: strict TS, no Phaser in `src/data|simulation|utils`, constants in `src/data/`.

## Shared contracts (exact)
```ts
// src/assets/manifest.ts
export interface AssetEntry { /* existing */ rotation?: { file: string; frames: number } }   // file under public/assets/
export interface AssetLoad { key: string /* was AssetId; now also 'machine.x#rot' */; url: string; kind: 'image' | 'spritesheet'; frame?: AssetEntry['frame'] }
// planAssetLoads(): after each entry's own load (if any), if entry.rotation: push
//   { key: id + '#rot', url: baseUrl + rotation.file, kind: 'spritesheet', frame: { width: entry.width, height: entry.height, count: rotation.frames } }
// src/game/math/driveTrain.ts
export function rotationFrame(deg: number, frames: number): number   // n=((deg%360)+360)%360; Math.round(n/360*frames) % frames
// src/data/world.ts
export const GROUND_SHADE: { color: number; alpha: number; bandStarts: readonly number[]; haze: { color: number; alpha: number; height: number } }
//   = { color: PALETTE.ink, alpha: 0.07, bandStarts: [64,128,192], haze: { color: PALETTE.skyHaze, alpha: 0.3, height: 18 } }  (audit value 0.3, not proto 0.35)
export const FLOATING_TEXT = { ...existing, color: '#ffd27a' }       // add field `color`
export const CRANK_PULSE = { color: 0xffd27a, radiusArtPx: 20, strokeArtPx: 2, alphaPeak: 0.6, periodMs: 1200 } as const
```
Rotation table (all ids prefixed `machine.`, files under `machine/rot/`): flywheel flywheel-rot.png 180; gearLarge gear-large-rot.png 140;
gearSmall gear-small-rot.png 80; crank hand-crank-rot.png 80; crankBrace crank-brace-rot.png 80; pulleyMain pulley-main-rot.png 140;
pulleyCrank pulley-crank-rot.png 80; pulleyFlywheel pulley-flywheel-rot.png 180; pulleyMotor pulley-motor-rot.png 24.
Sheet frame size = entry width/height (flywheel 96, gearLarge 64, gearSmall 40, crank/brace 48, pulleyMain 24, pulleyCrank 32, pulleyFlywheel 28, pulleyMotor 12).

## Wave 1 (parallel)

### W1 manifest + boot loading (C4-1 loader, C4-2 sky)
- files_owned: `src/assets/manifest.ts`, `src/assets/manifest.test.ts`, `src/game/scenes/BootScene.ts`
- Do: add `rotation` to the 9 entries; `bg.sky` `file: 'bg/sky.png'`, description
  `'Dusty sky in the four sky palette tones as hard stepped strata, pale sun disc upper-left (light direction); screen-fixed, shown at 2x.'`;
  widen `AssetLoad.key` to `string`; extend `planAssetLoads` per contract; BootScene spritesheet load adds `endFrame: load.frame.count - 1`.
  Fix existing test "loads exactly the file-backed entries ... as images": compare only `kind === 'image'` loads (no `#rot` keys). Custom-manifest plan test stays valid.
  New tests: each `rotation.file` exists in `import.meta.glob('/public/assets/**/*.png')`, `frames` integer > 1; exactly 9 rotation entries;
  planAssetLoads emits one `#rot` spritesheet per rotation entry with contract frame size/count and url `assets/machine/rot/...`; `bg.sky` file non-null.
- Constraints: leave other entries alone; keep `file: null` support. `grep -rn "AssetLoad\|planAssetLoads" src` for other consumers (BootScene expected only).
- Validation: `npm run typecheck && npx vitest run src/assets`.

### W2 rotation math + animator + view (C4-1 runtime)
- files_owned: `src/game/math/driveTrain.ts`, `src/game/math/driveTrain.test.ts`, `src/game/entities/MachineAnimator.ts`, `src/game/entities/MachineView.ts`
- Do: add `rotationFrame` (contract). MachineView sprite creation (~line 96): texture =
  `def.animation.kind === 'driven' && scene.textures.exists(def.assetId + '#rot') ? def.assetId + '#rot' : def.assetId`, frame 0.
  MachineAnimator: module-level `applyAngle(sprite, deg)` (see proto): if `sprite.texture.key.endsWith('#rot')` and `frameTotal - 1 > 1` then
  `setFrame(rotationFrame(deg, sprite.texture.frameTotal - 1)); setAngle(0)` (frameTotal counts `__BASE`) else `setAngle(deg)`.
  Replace all three `setAngle(...)` calls (reset handler, non-active visible driven part, active driven case). Leave slider/vibrate untouched.
- Tests (driveTrain.test.ts; import `MACHINE_COMPONENTS`, `DRIVE_TRAIN` from `../../data/machineComponents`):
  1. rotationFrame: (0,80)=0, (4.5,80)=1, (-4.5,80)=79, (359.9,80)=0, (22.5,80)=5, (360,80)=0, (724.5,80)=1; sweep -720..720 step 0.37 for frames 24/80/140/180: integer in [0,frames).
  2. gear frame ratio: 140/80 === 1.75 === `-MACHINE_COMPONENTS.gearSmall.animation.ratio` (large ratio is 1); pinion phase 22.5 deg => `rotationFrame(22.5, 80) === 5`.
  3. mesh pairing: for k in 0..139, master = k*360/140: large frame (N 140) === k; small frame (N 80) === ((5 - k) % 80 + 80) % 80
     (angles via `partAngle` with ratio/phase from MACHINE_COMPONENTS); `meshPhaseError` on frame-quantised angles (frame*360/N) equals `meshPhaseError(master, ...)` within 1e-9
     (teeth from `DRIVE_TRAIN.gears`: large 14, small 8).
  4. shared shaft: parts with equal ratio share N (main-shaft group 140: gearLarge, pulleyMain; crank group 80: gearSmall, handCrank, crankBrace, pulleyCrank; flywheel group 180: flywheel, pulleyFlywheel) - short smoke test that identical angles give identical frames per group.
- Validation: `npm run typecheck && npx vitest run src/game/math`.

### W3 text + ground (C4-3, C4-4)
- files_owned: `src/data/world.ts`, `src/data/world.test.ts`, `src/game/rendering/FloatingText.ts`, `src/game/rendering/Terrain.ts`
- Do: world.ts: add `GROUND_SHADE`, `CRANK_PULSE` (W4 consumes), `FLOATING_TEXT.color` per contract; no other edits. FloatingText.spawn: two tweens, both `CRANK_FEEDBACK.floatMs`:
  y -= `floatRisePx` `Cubic.easeOut`; alpha 0 `Quad.easeIn` with `onComplete` hide. Text style `color: FLOATING_TEXT.color`, `fontStyle: 'bold'`, keep ink stroke
  (remove now-unused imports). Terrain: after horizon strip add haze rectangle at `GROUND_Y + HORIZON_STRIP.height` (height `haze.height`) and one ink rectangle per
  `bandStarts` entry from `GROUND_Y + start` to `WORLD.height`; origin 0,0; depth `GROUND_LAYER.depth + 1`; push to `this.objects` (see proto).
- Tests (world.test.ts): bandStarts strictly ascending, >= 0, < WORLD.height - GROUND_Y; alphas in (0,1]; haze.height > 0; FLOATING_TEXT.color matches `/^#[0-9a-f]{6}$/i`; CRANK_PULSE alphaPeak in (0,1], periodMs > 0.
- Validation: `npm run typecheck && npx vitest run src/data`.

## Wave 2 (needs W3 world.ts)

### W4 first-click pulse ring (C4-5)
- files_owned: `src/game/entities/HandCrank.ts`
- Do: in constructor, if `ctx.session.state.totalClicks === 0` (field exists in `src/simulation/state.ts`; confirm it is on `ReadonlyGameState`) create a stroke-only circle:
  `scene.add.circle(pos.x, pos.y, CRANK_PULSE.radiusArtPx * PIXEL_SCALE)`, `setStrokeStyle(CRANK_PULSE.strokeArtPx * PIXEL_SCALE, CRANK_PULSE.color)`, no fill,
  `setAlpha(0)`, depth `DEPTH.machine + 1`; looping tween alpha 0 -> `alphaPeak` -> 0 (yoyo, leg `periodMs / 2`, `repeat: -1`).
  First pointerdown and `destroy()` kill the tween and destroy the ring; never recreate. No economy mutation; click handler order unchanged.
- Validation: `npm run typecheck`.

## Acceptance (EM Mode B)
1. `npm run typecheck`, `npm test`, `npm run build` clean.
2. No `setAngle(` in MachineAnimator outside `applyAngle`; BootScene passes `endFrame`.
3. 9 `#rot` loads planned, sky loaded from file; rotationFrame, gear 140/80 ratio and mesh-pairing tests present and passing.
4. FloatingText: two tweens (Cubic.easeOut y, Quad.easeIn alpha), colour `#ffd27a` bold; Terrain adds haze + 3 bands from `GROUND_SHADE`.
5. Pulse ring only before first click; torn down on click and destroy.
6. No Phaser in `src/data`; no file edited outside its owner list.
