# Art — Era III (Thermal / Pressure, resource PR) — CONTRACT

Authority: this file is the art + machine contract for WP11 (Era III content). Ids, files, sizes, origins, sockets, links and frame
counts below are final; all PNGs exist in `public/assets/`. WP11 may retune numbers in `src/data/` only where marked *(tunable)*.
Coordinates: machine-local art px, origin = frame base centre, +y down, ground contact on row y −1. "corner" = pixel-grid corner.
Baseline it builds on: WP8 §C3 + ART_ERA2 CR1–CR3 (generator hub −22, spark gap on rack, retrofit kit at motorMount+(0,−24)).
Era III grows **left** (−x) of the worn motor plus a **chimney** (roadmap §1). Left edge −442 ≥ new `MACHINE_BOUNDS.left` −448.

## 1. References → rules
- Locomotive-type fire-tube boiler: firebox (water-jacketed, staybolted side sheets) at one end, barrel with fire tubes, smokebox +
  chimney at the other; steam dome on top is where the driest steam is drawn off; safety valves on the boiler top
  (https://www.steamlocomotives.org/how-railways-work/parts-of-a-steam-locomotive, https://kevinboone.me/steam101.html,
  https://engineeringhulk.com/locomotive-boiler-parts-working-and-applications/). → firebox right (toward the operator/motor), smokebox +
  chimney left, steam main leaves from the dome top.
- Safety valves: lever-and-weight → Salter spring balance → Ramsbottom (two plug valves joined by a spring-loaded lever, tamper-proof)
  (https://en.wikipedia.org/wiki/Safety_valve). → `reliefValves` = Ramsbottom pair on the firebox top.
- Bourdon gauge: 270° pointer sweep; mounted on a siphon (pigtail ring) so steam never reaches the tube
  (https://www.spiraxsarco.com/learn-about-steam/pipeline-ancillaries/gauges-sight-glasses-vacuum-breakers,
  https://open-exam-prep.com/study-guides/ar-boiler-operator/fittings-and-trim/pressure-gauges-and-siphons). → dial 270°, siphon ring stem.
- Riveted iron stack: thin plates bound with hoops, bottom plate riveted as a flange bolted onto the smokebox; metal stacks on base plates
  (https://patents.google.com/patent/US15225, https://codelibrary.amlegal.com/codes/solon/latest/solon_oh/0-0-0-15195). → hoops every 18 rows,
  petticoat + bolted flange on a seat plate on the smokebox.
- Nasmyth steam hammer: bedplate, two standards, cylinder with valve chest on top, piston rod, tup sliding in guides, separate anvil block
  (Science Museum co8042427 https://collection.sciencemuseumgroup.org.uk/objects/co8042427/nasmyth-steam-hammer, model co46223). Self-acting
  valve gear → repetitive blows; early hammers exhausted to atmosphere. → frame static, tup+rod = moving ram, flat anvil die (not a horned
  smith's anvil), exhaust puff per blow.
- De Laval impulse turbine: steam fully expanded in stationary nozzles, jets hit buckets on the wheel rim; casing face-on round
  (https://patents.google.com/patent/US522066A/en). High wheel speed → reduction gearing to the generator. → round casing face-on, nozzle chest
  on top, inspection window shows the bucket wheel, gearcase bridge to an end-on alternator (axle end-on rule R1 kept).
- Surface condenser sits **under** the turbine exhaust; hotwell at the bottom, condensate pumped back
  (https://en.wikipedia.org/wiki/Surface_condenser, https://savree.com/en/encyclopedia/steam-turbine-condenser). → turbine stands on the condenser
  deck; condensate line from the hotwell back to the boiler feed.
- Steam piping: flanged bolted joints, supports near flanges/valves, span rule of thumb ≈ (DN + 10) ft (https://wermac.org/steel/pipesupports_spacing.html).
  Scale: motor 64 px ≈ 1.5 m → 1 px ≈ 2.5 cm; 4 px main ≈ 10 cm bore; longest free span 148 px ≈ 3.7 m (dome riser → frame girder) — inside the rule.
- House rules kept: R1 axles end-on, R4 every part stands on steel/ground, locked palette, alpha 0/255, crop/pad/hand-pixel only, RotSprite for
  rotating parts, accents only on small areas, light from upper-left.

## 2. Palette
Rust Wasteland (ART_BRIEF) + Era II cyan (only the two aqua bushings) + **Era III accents**:
`PALETTE += emberDark 0x6a2418, ember 0xb8402a, steam 0xe8e0cc` (accents only: fire glow, superheater hot bends, gauge red zone + pointer, steam puff highlight).
Material mapping: boiler/stack/hammer/turbine = iron ramp + clustered rust; bricks = rust ramp one value step darker (no ember on bricks);
induction coil = Era II copper bands (`#6e3a22 #8c4a2a #ad6236 #c98552` + `#f0a848` glints); gauge bezel = brass (`#c98552 #ad6236 #8c4a2a`), face `#ddc9a3`;
fire = `#6a2418 #b8402a #ad6236 #d9822b #f0a848 #ffd27a`; coal smoke = `#5a5f63 #7d8286 #9c9182`; steam = `#b8a98f #ddc9a3 #e8e0cc`.
All 19 PNGs verified: every opaque pixel is a palette colour, alpha ∈ {0,255}.

## 3. Flow (electrical → thermal → mechanical, coherent at every unlock)
EE bus (Era II motor-retrofit terminal, always present: powerLines needs motorRetrofit 5) → **cable C1** → induction coil wound round the
firebox (`inductionHeater`) + coal fire (`firebox` glow) → boiler → dome → **steam main** (4 px pipe, header at y −112):
- **P1 → steam manifold on the Era I piston block**: the three old cylinders now take steam (the pistons were always slider-crank on θM; a
  slider-crank is reversible, so the old linkage now *drives* the main shaft). Existing `pistonArray` steam effect = exhaust. This is the
  thermal → mechanical tie-in to the existing machine.
- **P2 → steam hammer** valve chest (ram reciprocates on θM, click echo = hammer blow; exhaust to atmosphere).
- **P3 → turbine** nozzle → bucket wheel → reduction gear → alternator (`turbine` = EE ×2) → optional export cable to the grid (CR-A).
- Turbine exhaust drops into the **condenser** under it → **W1** condensate (2 px) → boiler feed on the smokebox.
- `superheater`: serpentine on the barrel top, dome → coil → tee into the riser. `reliefValves`: Ramsbottom pair, vent puffs.

## 4. Type additions (WP11, pure data/maths; no Phaser in data)
```ts
type AnimationDriver = 'manual' | 'automation' | 'combined' | 'electric' | 'thermal';   // thermal = rates.perSecond.pr
ComponentAnimation |=
  | { kind: 'reciprocate'; ratio: number; strokeArtPx: number; phaseDeg: number }   // sprite y offset = -(stroke/2)·(1 + cos(ratio·θM + phase)); 0 = strike
  | { kind: 'spin'; driver: AnimationDriver; speed: SpeedCurve }                     // own angle += speed(driver)·dt (deg/s), not tied to θM; RotSprite frames
  | { kind: 'gauge'; driver: AnimationDriver; frames: number; minLog: number; maxLog: number; tauSeconds: number }
      // frame = round(clamp01((log10(1 + v) - minLog)/(maxLog - minLog))·(frames-1)), v low-pass filtered with tau; frames sheet, no rotation
ConnectionPoint.kind: 'belt' | 'pin' | 'cable' | 'pipe';
MachineLink.kind: 'belt' | 'rod' | 'cable' | 'pipe';  MachineLink += { via?: Vec2[]; bore?: 4 | 2; depth?: number }   // via = absolute machine-local corners
MACHINE_BOUNDS = { left: -448, right: 448, top: -248, bottom: 8 }                 // RT 896×256; era I/II offsets unchanged (RT origin moves left: −200→−448)
MACHINE_LINK_STYLE.pipe = { depth: MACHINE_LAYER_DEPTH.frame + 5,                 // above frame/back parts, behind every mid part (pipes pass behind the chimney)
  steam: { prof: [0x7d8286, 0x5a5f63, 0x3e4246, 0x1f2225],                        // across the bore: top→bottom (horizontal), left→right (vertical)
           flange: [[0x14110f,0xa3a6a4,0x7d8286,0x5a5f63,0x3e4246,0x14110f],[0x14110f,0x7d8286,0x5a5f63,0x3e4246,0x2b2e31,0x14110f]], flangeEvery: 24 },
  water: { prof: [0x5a5f63, 0x2b2e31], flange: [[0x14110f,0x7d8286,0x3e4246,0x14110f],[0x14110f,0x5a5f63,0x2b2e31,0x14110f]], flangeEvery: 24 } }
```
**Pipe raster (pure `rasterPipe(points, bore)`, tested; reference impl `.../scratchpad/era3/tools/mock3.py: pipe()`):** points = [from, ...via, to], all
axis-aligned. Segment (x0,y)→(x1,y): cols [min,max), rows y−bore/2 … y+bore/2−1 coloured by `prof`. Vertical likewise (cols x−bore/2 …). Flanges: 2 px long,
bore+2 wide (1 px proud each side), at offset 0 and L−2 of every segment and every 24 px between (skip if < 4 px from the end). Every interior via =
fitting block (bore+2)² centred on the corner: ink border, inside `#7d8286` where i+j ≤ s/2+1, `#5a5f63` where i+j < s, else `#3e4246`.
Links sharing a segment draw identical pixels (no special tee code); the shared corner block reads as a tee. Pipes are static (no flow animation).
Link visible when both endpoint components are visible (existing rule).

New sockets: boilerBase(−240,0) chimneyBase(−293,−78) superheaterSeat(−268,−73) reliefSeat(−214,−77) gaugeSeat(−192,−77) fireDoor(−196,−32)
heaterSeat(−200,−36) hammerBase(−334,0) hammerTup(−334,−22) condenserBase(−402,0) turbineBase(−402,−24) turbineHub(−412,−54) manifoldSeat(−44,−168).

## 5. Components (all files under `public/assets/`, all delivered)
| component | tech ≥lvl | asset id → file | size | origin | socket | layer/bias | animation | connections (rel. to attach) |
|---|---|---|---|---|---|---|---|---|
| boiler | boiler 1 | machine.boiler → machine/era3/boiler.png | 128×96 | .5,1 | boilerBase | mid/0 | none | pipe `steam` (−6,−91) · pipe `feed` (−64,−46) |
| chimney | boiler 1 | machine.chimney → machine/era3/chimney.png | 32×160 | .5,1 | chimneyBase | mid/1 | none | – |
| steamManifold | boiler 1 | machine.steamManifold → machine/era3/steam-manifold.png | 96×14 | .5,1 | manifoldSeat | back/2 | none | pipe `steam` (−48,−8) |
| pressureGauge | boiler 1 | machine.gauge → machine/era3/gauge.png | 24×24 | .5,1 | gaugeSeat | mid/2 | none | – |
| gaugeNeedle | boiler 1 | machine.gaugeNeedle → machine/era3/gauge-needle.png sheet 600×24, frame 24×24 ×25 | 24×24 | .5,1 | gaugeSeat | mid/3 | gauge thermal, frames 25, minLog 0, maxLog 5, tau .6 *(tunable)* | – |
| fireboxGlow1/2/3 | firebox 1/10/20 | machine.fireGlow1/2/3 → machine/era3/firebox-1/2/3.png sheet 96×24, frame 24×24 ×4 | 24×24 | .5,.5 | fireDoor | mid/2,3,4 | frames 4, maxHz 3, thermal | – |
| inductionHeater | inductionHeater 1 | machine.inductionHeater → machine/era3/induction-heater.png | 56×40 | .5,1 | heaterSeat | mid/5 | none | cable `tie` (25,−38) |
| superheater | superheater 1 | machine.superheater → machine/era3/superheater.png | 40×32 | .5,1 | superheaterSeat | mid/2 | none | – |
| reliefValves | reliefValves 1 | machine.reliefValves → machine/era3/relief-valves.png | 16×24 | .5,1 | reliefSeat | mid/2 | none (vent fx §6) | – |
| steamHammer | steamHammer 1 | machine.steamHammer → machine/era3/steam-hammer.png | 48×96 | .5,1 | hammerBase | mid/1 | none | pipe `steam` (11,−79) |
| hammerRam | steamHammer 1 | machine.hammerRam → machine/era3/hammer-ram.png | 12×36 | .5,1 | hammerTup | mid/0 (behind frame) | reciprocate ratio 1, stroke 14, phase 0 | – |
| condenser | condenser 1 | machine.condenser → machine/era3/condenser.png | 80×24 | .5,1 | condenserBase | mid/0 | none | pipe `condensate` (44,−3) |
| turbine | turbine 1 | machine.turbine → machine/era3/turbine.png | 80×64 | .5,1 | turbineBase | mid/1 | none | pipe `steam` (−10,−62) · cable `export` (28,−46) |
| turbineRotor | turbine 1 | machine.turbineRotor → machine/era3/turbine-rotor.png (+rot machine/era3/rot/turbine-rotor-rot.png, 64 f, 8×8, 224×224) | 28×28 | .5,.5 | turbineHub | mid/2 | spin thermal speed {base 0, gain 40, min 0, max 540} *(tunable)* | – |
`motorRetrofitKit` (Era II) gets a new connection: cable `tie` at (0,−3) (= insulator wire groove, world (−140,−54)).
Stage rule: fireboxGlow stage n covers every pixel of stage n−1 in every frame (verified 0 px uncovered), so min-level visibility alone gives the 3 stages;
all three use the same frame index. With firebox 0 the boiler art shows a closed door with 3 dim vent slots.
Shadows (`MACHINE_SHADOWS`, h 2): boiler x −304 w 128 · steamHammer x −358 w 48 · condenser x −442 w 80.

**Links**
| id | kind | from → to | via (absolute) | style | tech gate (implicit) |
|---|---|---|---|---|---|
| P1 | pipe bore 4 | boiler `steam` (−246,−91) → steamManifold `steam` (−92,−176) | (−246,−112) (−98,−112) (−98,−176) | steam | boiler |
| P2 | pipe bore 4 | boiler `steam` → steamHammer `steam` (−323,−79) | (−246,−112) (−323,−112) | steam | steamHammer |
| P3 | pipe bore 4 | boiler `steam` → turbine `steam` (−412,−86) | (−246,−112) (−412,−112) | steam | turbine |
| W1 | pipe bore 2, depth mid−1 | condenser `condensate` (−358,−3) → boiler `feed` (−304,−46) | (−308,−3) (−308,−46) | water (runs behind the hammer bedplate) | condenser |
| C1 | cable sag 3 | motorRetrofitKit `tie` (−140,−54) → inductionHeater `tie` (−175,−74) | – | Era II cable style | inductionHeater |
Clearances (checked in mock): header rows −114..−111 clear hammer top −93, turbine top −88, gauge top −101, relief top −101, frame girder top −110 (elbow at
(−98,−112) rests on it); riser x −100..−97 clears the piston-block standard (x ≥ −91); header passes behind the chimney stack (x −300..−287).

**Contact / support check:** boiler, hammer, condenser → ground; chimney → seat plate on smokebox (top row −78); turbine bedplate → condenser deck (row −24);
superheater stand → barrel top (−73); relief valves + gauge siphon → firebox top (−77); heater terminal → firebox right face; manifold drops → cylinder cap bosses
(−168); ram → in guides (rod top always hidden: rod top row −58 at strike, −72 at full lift; crosshead rows −71..−58 + cylinder rows −93..−72 cover it; frame gland −57..−54).
No floating part at any unlock order (stages sheet).

## 6. Animation + FX
- hammerRam: `reciprocate` ratio 1 on θM, stroke 14 art px; tup face touches the die (y −22) at θM = 180°. Clicks advance θM → every crank click = a visible
  blow (matches `clickEcho`). Emit 1 `fx.steamPuff` at (−334,−98) and 3 dust puffs (existing assembly puff style, 3 px spread) at (−334,−22) on each strike
  (when the offset crosses 0). Max 3 blows/s visible (clamp: if θM speed > 1080°/s keep the ram at mid stroke, `offset = −7`) *(tunable)*.
- turbineRotor: `spin`, RotSprite 64 frames over 360° (16 buckets → 4 frames per bucket pitch, so ≤ 540°/s keeps ≤ 1.5 frames per 60 fps step); frame = `rotationFrame(angle, 64)`.
- gaugeNeedle: frames 0..24 = −135°..+135° (0 = straight up, clockwise); last two ticks of the dial are the ember red zone. Frame from log PR/s (formula §4).
- fireboxGlow: `frames` 4 @ ≤ 3 Hz, thermal driver; frame 0 when PR/s < restThreshold (embers stay visible, no flash: all fire tones are adjacent ramp steps).
- New FX sheets (manifest `fx.steamPuff` → fx/steam-puff.png 64×16, frame 16×16 ×4; `fx.smoke` → fx/smoke.png 64×16 ×4; origin .5,.5): frame = age quartile;
  puff rises 12 art px, drifts +x 4 px/s (wind, matches dust), scale 1→1.5, alpha 1 → 0 in the last quartile. World-space particles (not in the RT).
  Emitters (art px, `STEAM_EMITTERS` data): chimney top (−293,−240) `fx.smoke`, rate = clamp(0.4 + 0.3·log10(1+PR/s), 0.4, 2)/s, thermal;
  relief valves (−218,−94) and (−211,−94) `fx.steamPuff`, a short 4-puff burst every 6–9 s (deterministic jitter) while PR/s > 50 *(tunable)* and once on purchase;
  hammer exhaust (above); existing `pistonArray` steam effect switches to `fx.steamPuff` at the manifold drops (−72/−44/−16, −182) once boiler ≥ 1.
  Reduced motion (WP10): emit ≤ 1 puff/s per emitter, no hammer dust.
- `fx.steam` (old 16×16) stays valid; new sheets add the steam-white `#e8e0cc` highlight.

## 7. World / camera
- Full machine bounds (art): x −442..448, top −238 (chimney crown) → `MACHINE_BOUNDS = { left: −448, right: 448, top: −248, bottom: 8 }`.
- World x of the left edge = 1280 − 2·442 = 396 ≥ 0, chimney crown world y = 1120 − 476 = 644, smoke ≤ 1120 − 2·290 = 540: **fits WORLD 2560×1440, no WORLD/GROUND_Y
  growth for Era III** (keep roadmap 3840×2160 for Era IV/V if their bounds need it).
- fitView (margin 48): full Era I–III width 890 art = 1780 world + 96 → zoom ≤ 0.682 → snapped **0.5** (step 0.25); centre clamps to 1280 (view = whole world width).
  Height 246 art = 492 + 96 = 588 < 1440 ✓. After `boiler` only (Era II full + boiler/chimney, left −309): 1514 + 96 → **0.75**. Auto-frame on boiler/hammer/turbine purchase.
  Zoom 0.5 = 1 screen px per art px (integer, crisp).
- Era IV note: the spire foot above the piston block must sit at y ≤ −183 (manifold top row −182) and clear the P1 riser (x −100..−97, up to −179).

## 8. Contract notes / requests (optional, Director decides)
| # | item | reason |
|---|---|---|
| CR-A (optional) | turbine `export` (−374,−70) → world-space cable to the nearest lit pylon on the **left** (same code as ART_ERA2 CR7), visible from turbine 1 | makes "turbine = EE ×2" readable (turbo-alternator feeds the grid); without it the alternator + bushing still read |
| CR-B (optional) | milestone `pressureVesselBlueprint`: brief whistle puff burst from the relief valves (4 puffs) + audio whistle | roadmap audio "whistle on milestone"; no new art |
| CR-C (note) | roadmap sizes changed: condenser is a new component (80×24, under the turbine); steam hammer split into frame 48×96 + ram 12×36; gauge needle = 25-frame sheet (no RotSprite: a 1-px needle rotated breaks up); "pipe tile" replaced by the code raster above | mechanical correctness (§1) and pixel quality |

## 9. Production log
PixelLab `create_image_pro`, palette Rust Wasteland (+ember), style = flywheel anchor (344ab19d…), no_background:
boiler 38d48b98 (4 cand., picked #0), steam hammer 95fd84e9 (9, #3), turbine 679d85aa (9, reference only), condenser dd4afe87 (16, rejected: sand/rust
bands, ember stripes). Curation: boiler — ember bricks → rust one step darker, fire door closed (plate, latch, 3 vent slots), chimney seat plate added on the
smokebox; hammer — tup + rod lifted out into `hammer-ram.png`, gland redrawn, horned smith's anvil replaced by anvil block + sow block + die, valve hand-wheel
removed (pipe inlet). Hand-pixelled to exact geometry: chimney, turbine (casing r24 about corner (30,34), window r13, gearcase, alternator r10, nozzle chest),
rotor (16 curved buckets, r12, radially symmetric shading), condenser, gauge + 25 needle frames, relief valves, superheater, induction heater, steam manifold,
firebox glow 3×4 frames, fx sheets. RotSprite: `python3 scripts/art/make_rot.py public/assets/machine/era3/rot public/assets/machine/era3 '{"turbine-rotor":64}'`.
Build scripts (scratch): `.../scratchpad/era3/tools/build.py` + `parts2.py` (assets), `mock3.py` (compositor, pipe reference raster; env `UNLOCK=1..9`).
Evidence (scratch `/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era3/`):
`mock_era3_full.png` / `-2x` / `-3x` (Era I+II+III), `mock_era2_baseline-2x.png` (before), `stages_era3.png` (unlock order 1–8),
`anim_sheet_4x.png` (hammer stroke ×8 phases, fire frames, gauge sweep), `crop_left_4x.png`, `crop_boiler_4x.png`, `crop_firebox_6x.png`, `crop_manifold_6x.png`.

## Director decisions
- CR-A ACCEPTED: turbine `export` → nearest lit pylon (left) world-space cable, reuse Era II PylonLine code.
- CR-B ACCEPTED: whistle steam burst on pressureVesselBlueprint milestone.
- Asset rebuild tools: scripts/art/era3/ (build.py, parts2.py, mock3.py incl. pipe() reference raster).
