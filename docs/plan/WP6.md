# WP6 — Mechanical correctness & visual polish (code/data side)

Goal: the machine runs as one coherent drive train (shared master angle, meshing gears, real belts and conrod) drawn on a
single art-px grid, using the new assets from `docs/plan/ART_AUDIT.md` (§3–§5). All coordinates are machine-local art px
(origin = frame base centre, +y down). Asset sizes and pivots are FROZEN (audit §4).

External input **A0**: the art agent puts the PNGs into `public/assets/machine/*` and `terrain/ground.png`. Code must run without
them (fallback painters). `manifest.test` "disk file" check and the final screenshot need A0.

## Decisions
- **Art-res RenderTexture: yes.** Phaser 3.90 `RenderTexture.draw(container, x, y)` renders a Container with its children
  (Graphics too). The parts container stays off the display list (`scene.make.*`, scale 1). It is redrawn into an RT of
  size `MACHINE_BOUNDS` (400×208) every frame. The RT image sits at `MACHINE_ANCHOR`, scale `PIXEL_SCALE`, NEAREST filter.
  Result: sprites, rotations and links all land on one 1-art-px grid (defect 7). The cost is about 25 draws per frame.
  Input does not use sprites any more: the crank gets a circular `Zone`. Fallback: `MACHINE_RENDER.mode = 'direct'`
  keeps today's scaled container, and the integer-px link raster still applies. Flip this flag only if the smokes or the
  screenshot fail.
- **θM is unwrapped float64.** Ratios are not integers (1.75, 2.1875), so wrapping θM would make parts jump. Only
  `ratio·θM + phase` is wrapped, and only for display.
- **Link kinds become `belt | rod`.** `shaft` and `pipe` are removed. Co-axial parts share one socket.
- **Sub-layer depth** comes from a new optional `depthBias` (integer, default 0): depth = `MACHINE_LAYER_DEPTH[layer] + depthBias`.

## Contracts (Wave 1 freezes these; Wave 2 codes against them)
`src/assets/assetIds.ts`: add `machine.bearingPlate, machine.pulleyMotor, machine.pulleyMain, machine.pulleyCrank,
machine.pulleyFlywheel, machine.pedestal, machine.motorPlinth, machine.pistonBlock, machine.pistonYoke`. Remove `machine.piston`.
The manifest uses the audit §4 file, size and pivot for each id. Fallback: `paintGenericPlate`, and pulleys may reuse `paintGear`.

`src/data/machineComponents.ts`:
- `MachineComponentId` = existing ids + `mainShaft, bearingM, bearingP, crankPulley, flywheelPulley, flywheelPedestal,
  motorPlinth, motorPulley, pistonYoke`. `pistonArray` stays (it is the static block, asset `machine.pistonBlock`).
  The smokes read the ids `handCrank`, `gearSmall` and `wornMotor`, so keep them.
- `SocketId` = `mainHub(-44,-56)`, `crankHub(0,-56)`, `flywheelHub(150,-56)`, `flywheelBase(150,0)`, `motorMount(-140,-27)`,
  `motorBase(-140,0)`, `motorPulleyHub(-114,-31)`, `pistonBed(-44,-110)`, `yokePin(-44,-125)`.
  Remove `smallGearHub` and `largeGearHub`.
- `ComponentAnimation` = `none` | `{kind:'driven'; ratio; phaseDeg}` | `{kind:'slider'}` (yoke) | `vibrate` (motor, unchanged).
  Remove `rotate`, `clickRotate` and `reciprocate`.
- `ConnectionPoint.kind` = `'belt' | 'pin'`. `MachineLink.kind` = `'belt' | 'rod'`.
- Table (layer+bias / anim):

| id | tech | socket | asset | layer+bias | anim |
|---|---|---|---|---|---|
| supportFrame | handCrank | null | frame | frame | none |
| bearingM / bearingP | handCrank | mainHub / crankHub | bearingPlate | frame+1 | none |
| gearLarge | reinforcedCrank | mainHub | gearLarge | mid | driven 1, 0 |
| mainShaft | handCrank | mainHub | pulleyMain | mid+2 | driven 1, 0; belt r10; pin r5 |
| gearSmall | gearRatio | crankHub | gearSmall | mid+1 | driven -1.75, 22.5 |
| crankPulley | flywheel | crankHub | pulleyCrank | mid+2 | driven -1.75, 0; belt r15 |
| handCrank | handCrank | crankHub | crank | front | driven -1.75, 0 |
| flywheelPedestal | flywheel | flywheelBase | pedestal (0.5,1) | back | none |
| flywheel | flywheel | flywheelHub | flywheel | mid | driven -2.1875, 0 |
| flywheelPulley | flywheel | flywheelHub | pulleyFlywheel | mid+3 | driven -2.1875, 0; belt r12 |
| motorPlinth | wornMotor | motorBase | motorPlinth (0.5,1) | mid | none |
| wornMotor | wornMotor | motorMount | motor | mid+1 | vibrate (as now) |
| motorPulley | wornMotor | motorPulleyHub | pulleyMotor | mid+2 | driven 2, 0; belt r5 |
| pistonYoke | pistonArray | yokePin | pistonYoke (0.5,0.75) | back | slider |
| pistonArray | pistonArray | pistonBed | pistonBlock (0.5,1) | back+1 | none |

- `MACHINE_LINKS`: belt motorPulley.belt→mainShaft.belt; belt crankPulley.belt→flywheelPulley.belt; rod mainShaft.pin→pistonYoke.eye.
- `DRIVE_TRAIN = { masterSpeed: SpeedCurve (deg/s of θM, combined driver; start base 60 gain .5 min 20 max 240),
  masterDirection: -1 (a click turns the crank +), clickTauSeconds: 0.05, rod: { crank:'mainShaft', pinRadius:5, pinPhaseDeg:0,
  length:69, sliderX:-44 }, gears: { large:{teeth:14,pitchRadius:28}, small:{teeth:8,pitchRadius:16} } }`.
  Gear sprites must have one tooth centred on +x at angle 0. If they do not, tune `phaseDeg` only.
- `MACHINE_LINK_STYLE` (replaces the current one): `beltDepth: mid+5, rodDepth: front+1, capDepth: front+2,`
  `belt:{outer:0x2e1a12, inner:0x6e3a22, dash:0x8c4a2a, dashSpacing:8, dashLength:2}`,
  `rod:{edge:0x3e4246, core:0x7d8286, eye:0x5a5f63, eyeCentre:0xa3a6a4, eyeRadius:2}`,
  `cap:{size:4, hi:0xa3a6a4, body:0x7d8286, ring:0x1f2225}`. These colours stay out of `PALETTE` (the CSS mirror is untouched).
- `MACHINE_SHADOWS: {component, x, y, width, height, oval?}[]`: frame (-100,0,200,2); motorPlinth (-164,0,48,2);
  flywheelPedestal (126,0,48,2); flywheel oval (138,0,24,3). `MACHINE_SHADOW_STYLE = {color:0x5f5244, alpha:0.5, depth:-1}`.
- `MACHINE_RENDER = { mode: 'renderTexture' | 'direct' }`, default `'renderTexture'`.

`src/game/math/driveTrain.ts` (NEW, pure):
- `interface MasterState { deg: number; pending: number }`
- `addClickImpulse(s, crankDeg, crankRatio): MasterState` gives `pending += crankDeg / crankRatio`
- `stepMaster(s, degPerSec, direction, dt, tauSec): MasterState` with `take = pending·(1-e^(-dt/τ))`, `deg += direction·degPerSec·dt + take`
- `partAngle(masterDeg, ratio, phaseDeg): number` returns a value wrapped to [0,360), with no -0
- `sliderCrank(centre, pinRadius, rodLength, angleDeg): { pin: Vec2; slider: Vec2 }` with
  `pin = c + r(cos a, sin a)`, `slider = (c.x, pin.y - sqrt(L² - (pin.x-c.x)²))`
- `meshPhaseError(masterDeg, large{ratio,phaseDeg,teeth}, small{...}): number` returns `|frac(fL+fS) - 0.5|`, where
  `fL = frac(θL·zL/360)` and `fS = frac((θS-180)·zS/360)`

`src/game/math/machineLinks.ts` (pure; `linkSegments` is replaced):
- `beltPath(a, ra, b, rb): { spans: [[Vec2,Vec2],[Vec2,Vec2]]; arcs: [Arc, Arc]; length } | null`, with
  `Arc = {centre, radius, startRad, sweepRad}`. The outside wraps are small `π-2β` and large `π+2β`, with `β = asin((ra-rb)/C)`.
- `rasterLine(p, q): Vec2[]` (Bresenham, integer), `rasterArc(arc): Vec2[]` (sampled ≤0.5 px, rounded, deduped)
- `rasterBelt(a, ra, b, rb): { inner: Vec2[]; outer: Vec2[] }` uses rows at r+1 (inner) and r+2 (outer)
- `pointsAlongBelt(path, spacing, offset): Vec2[]` (dash anchors, integer)
- `beltTravel(masterDeg, ratio, radius) = |ratio|·rad(masterDeg)·radius`

## Wave 1 (parallel)
- **T1 Data + asset contract.** Files: `src/data/machineComponents.ts`, `machineComponents.test.ts`, `src/assets/assetIds.ts`,
  `manifest.ts`, `manifest.test.ts`, `fallbackTextures.ts`, `src/game/math/machineLayout.ts` (+test: depthBias),
  `machineVisibility.test.ts`. Depends on: none (A0 only for the disk-file test).
  Acceptance:
  - Everything listed under Contracts exists.
  - Every component size equals its manifest entry.
  - All bboxes lie inside `MACHINE_BOUNDS`.
  - The data tests pass:
    - `ratio·r` is equal on both pulleys of each belt (motor 2·5 = 1·10; crank 1.75·15 = 2.1875·12).
    - Gear centre distance 44 = 28+16, and gearSmall.ratio = -teethL/teethS.
    - The pinion `phaseDeg` = 180/teethS.
    - Every rotating part's socket has a bearing plate or pedestal at stage "all".
    - Unlock coherence: for each link, the later-unlocked end's tech requires (transitively) the other end's tech, or uses
      the same tech. Check every prefix stage along `TECHNOLOGIES.requires`.
  - No `shaft` or `pipe` remains in `src/`.
- **T2 Pure drive math.** Files: `src/game/math/driveTrain.ts` (+`.test.ts` NEW), `src/game/math/machineLinks.ts` (+test).
  `animation.ts` keeps `animationSpeed`, `decayActivity`, `addActivity`, `driverValue`, `clampFrameSeconds`, `advancePhase` and
  `vibrateOffset`. Delete the now-unused `advanceAngle` and `reciprocateOffset` together with their tests.
  Depends on: none (the signatures above). No Phaser.
  Acceptance (tests):
  - Rod: `|pin-slider| = L` (1e-9) for 72 angles. The slider y range is [-130,-119.8]±0.1 for the audit numbers.
  - Belt:
    - Span ends lie on the r+1 circles and are tangent (dot product ≈ 0).
    - The wrap sweeps sum to 2π, and the small sweep is π-2β.
    - Arc ends equal the span ends.
    - Motor belt: wraps ≈172°/188°.
    - The returned path is null when one circle contains the other.
  - Raster: all coordinates are integers with no duplicates, and the line endpoints are included.
  - `stepMaster`:
    - Pending decays to under 1e-3 within 5τ.
    - The sum of impulses equals the total deg added.
    - dt = 0 is a no-op, and NaN inputs keep the state.
  - `meshPhaseError` < 1e-9 for 1000 random θM with the data ratios. It is clearly > 0 when phase = 0.
  - `partAngle` gives no -0 and stays in [0,360).
- **T6 Scene polish (non-machine).** Files: `src/data/world.ts`, `src/game/rendering/ParallaxBackground.ts`, `src/ui/toasts.css`,
  `src/data/notifications.ts` (+related tests). Depends on: none.
  Acceptance:
  - Pylons alpha 0.45 and tint 0xb8a98f (new optional `tint` on `ParallaxLayerDef`); skyline alpha 0.4.
  - `#toast-stack` is a fixed top-right column (`right:16px`, items right-aligned, max-width ≤360px).
  - `maxVisible: 2`.
  - Toasts never cover x < 900 at 1280×720.
  - `npm test` stays green.

## Wave 2 (parallel; depends on T1+T2)
- **T3 Animator + crank input.** Files: `src/game/entities/MachineAnimator.ts`, `HandCrank.ts`. Depends on: T1, T2.
  Acceptance:
  - A single `MasterState`:
    - The combined driver (manual activity + ME/s) goes through `animationSpeed(DRIVE_TRAIN.masterSpeed)`, with rest below
      `restThreshold`.
    - Each session `click` calls `addClickImpulse(CRANK_FEEDBACK.degreesPerClick, handCrank.ratio)`.
    - `reset` zeroes the state.
  - Every `driven` sprite gets `setAngle(partAngle(...))`.
  - The yoke gets `y = round(sliderCrank(...).slider.y)` and `x = sliderX`.
  - The motor keeps vibrating.
  - Inactive or assembling parts are untouched.
  - New method `getDrive(): { masterDeg; degPerSec }`.
  - HandCrank:
    - Stops tweening or setting the sprite angle.
    - Its input is a circular `Zone` (radius `hitRadius·PIXEL_SCALE`, world pos from `getComponentWorldPosition('handCrank')`,
      depth above the machine, hand cursor).
    - It still calls `session.click`, spawns the floating text and shakes the machine.
    - It destroys the Zone on `destroy`.
  - One click turns the crank about +90° within ≈0.25 s, and the pinion stays meshed with the large gear.
- **T4 Link renderer.** Files: `src/game/rendering/MachineLinks.ts`. Depends on: T1, T2.
  Acceptance:
  - Three Graphics objects (belts, rods, caps) at the style depths. All drawing is 1×1 `fillRect` at integer art px.
  - Belts:
    - The outer and inner rows come from `rasterBelt`.
    - 2-px dashes sit on the inner row at `pointsAlongBelt(..., 8, beltTravel mod 8)`, where the travel uses the
      from-pulley's ratio and radius.
    - Skipped when either end is hidden or assembling.
  - Rod:
    - 3-px bar (core line plus edge rows offset ±1 along the normal), from the crank pin to the yoke eye, both taken from
      `sliderCrank` with the live θM.
    - r2 eyes with a centre pixel at both pins.
  - Caps: a 4×4 static cap at every visible rotating-part socket (deduped).
  - API: `draw(pointOf, drive)`. When the drive is idle and nothing moved, it skips the redraw (key check is kept).
- **T5 MachineView render path + shadows.** Files: `src/game/entities/MachineView.ts`, plus `src/game/scenes/WorldScene.ts` only
  if it needs wiring. Depends on: T1 (T3 and T4 APIs from the contract).
  Acceptance:
  - `renderTexture` mode:
    - The parts container is off the display list.
    - The RT is 400×208 with origin mapping machine (0,0) to `MACHINE_ANCHOR`, at scale 2, NEAREST, `DEPTH.machine`.
    - Each `update` runs animator → links → `rt.clear().draw(container, -left, -top)`.
  - `direct` mode equals today's behaviour.
  - Depth uses `componentDepth` (with bias), sorted once.
  - Contact shadows: one Graphics at the shadow depth, redrawn when visibility changes, drawing only rows for visible components.
  - Assembly fly-in, dust puffs, shake, `getComponentState` and `getComponentWorldPosition` behave as before.
  - `destroy` frees the RT and the Zone owner is untouched.

## Wave 3 — validation (EM Mode B + Director)
- **T7.** Depends on: T1–T6 and A0.
  Steps:
  - `npm run typecheck`, `npm test` and `npm run build` are clean.
  - Director Playwright smokes (`scripts/smoke/README.md`): `wp2-crank`, `wp3-techtree`, `wp4-persistence` and `full-machine`
    all report `errors: []`.
  - The ids `handCrank`, `gearSmall` and `wornMotor` are still visible at the expected steps.
  - The crank click target still credits ME.
  - Unlock stages are checked by screenshot after each smoke step: no link points at a hidden part, and no floating part.
  - The Art Director reviews `full.png` and `full-zoom.png` against audit §2 defects 1–11 and §5.
  - Phase/tuning edits change data numbers only.
  - Then update `docs/PROJECT_STATUS.md`.

## Package acceptance / validation commands
`npm run typecheck && npm test && npm run build`. Then run the smokes per `scripts/smoke/README.md` and get Art Director
sign-off on the full-machine screenshot. `grep -rn "'shaft'\|'pipe'\|clickRotate\|reciprocate" src` returns nothing.

## Out of scope
PNG creation or regeneration (art agent A0: frame mid-rail inpaint, ground regen, post symmetry); pre-rendered rotation
strips; rim-light overlay (S3 #12); steam, glow and dust production effects; camera refocus; economy or balance changes;
new techs; save schema changes (none needed).
