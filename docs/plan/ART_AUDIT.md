# Art Audit — drive train + scene (Phase 1, audit only)

Evidence (scratch, not committed): `.../scratchpad/ad/aud.png`, `aud-zoom.png`, 3× crops `c-left.png` (motor/crank/pinion),
`c-mid.png` (gears), `c-fly.png` (flywheel), `c-top.png` (pistons), `assets4x.png`; user shot `images/1.png`.
Coordinates: machine-local art px, origin = frame base centre, +y down (ground y=0). PIXEL_SCALE 2.
Measured frame: posts x −100..−93, −36..−27, 29..38, 94..99; X-brace gussets centred (−64,−56), (0,−56), (65,−56);
top girder y −110..−95; bottom girder y −14..−2.

## 1. Reference rules (research)
- R1 Side elevation: every axle points into the screen, so a shaft is seen **end-on as a dot/cap**, never as a line between
  two wheel centres. Lines between wheels can only be belts, rods (pin-to-pin) or nothing (gear mesh).
- R2 Open belt = two external tangent spans + wrap arcs on the **outside** of each pulley; small pulley wrap = 180°−2β,
  large = 180°+2β, β = asin((R−r)/C); min wrap ≈120° on the small pulley. Open belt: both pulleys turn the same way;
  ω_driven = ω_driver·r_driver/r_driven. Flat belts ride crowned pulley rims.
  (https://www.firgelliauto.com/blogs/mechanisms/open-belt-drive, https://moodle.nptcgroup.ac.uk/pluginfile.php/1317074/mod_resource/content/2/BeltDriveEquations.pdf,
  https://en.wikipedia.org/wiki/Belt_(mechanical), https://www.firgelliauto.com/blogs/mechanisms/plain-pulley-for-flat-belt)
- R3 Gears mesh only with **equal module/pitch**; pitch circles tangent, centre distance = Rp1+Rp2; ratio = z2/z1, opposite
  rotation. (https://akbis.gaziantep.edu.tr/yonetim/upload/files/4841-5608.pdf, https://www.elesa-ganter.com/en/TechnicalDataWWW/21-the-tooth-td-013-art-003,
  https://danotes.mech.uwa.edu.au/gears/meshing/meshing.html)
- R4 Shafts sit in bearing housings bolted to a base/pedestal (pillow/plummer block); flywheel is keyed to the crankshaft next
  to a main bearing, belt pulley on flywheel or crankshaft (hit-and-miss / stationary engines).
  (https://en.wikipedia.org/wiki/Pillow_block_bearing, https://en.wikipedia.org/wiki/Hit-and-miss_engine, https://en.wikipedia.org/wiki/Line_shaft)
- R5 Crank → connecting rod (rigid, pin at each end) → crosshead/yoke → piston rod; stroke = 2·crank radius, rod ≥ 3× crank
  radius. (https://www.firgelliauto.com/blogs/mechanisms/slider-crank-linkage, https://www.firgelliauto.com/blogs/mechanisms/cross-head-slide)
- R6 Pixel art: one pixel grid for everything; arbitrary-angle runtime rotation causes jaggies (use RotSprite-style pre-rendered
  frames or rotate at native res); gear frames repeat every 360°/z.
  (https://godotshaders.com/shader/rotsprite-like-algorithm-for-cleaner-pixel-art-rotation, https://pixeljoint.com/forum/forum_posts.asp?TID=26635,
  https://pixelparmesan.com/anti-aliasing-fundamentals-for-pixel-artists, https://opengameart.org/content/simple-conveyor-belt)

## 2. Ranked defects
| # | sev | what (evidence) | why wrong | fix |
|---|---|---|---|---|
| 1 | S1 | `shaft` links drawn as straight bars between centres: crank(−62,−78)→gearSmall(−30,−30); flywheel(150,−48)→piston(76,−118) (c-left, c-fly) | R1: shaft end-on; a bar centre-to-centre is a rigid link that would lock both wheels | delete `shaft` link kind for different axles; co-axial parts share one socket; crank→piston becomes animated `rod` (§3) |
| 2 | S1 | belts are 2 static tangent lines, no wrap arcs, end inside parts: motor r8 at stub tip, gearSmall r7 (inside teeth), gearLarge r14 (mid-spokes), flywheel r24 (mid-spokes) | R2: belt must ride a visible pulley rim and wrap it | add pulley sprites at every belt end; belt = tangents + arcs at r+1; draw above the pulley stack (§3) |
| 3 | S1 | flywheel at (150,−48), r48: rim touches ground y=0, 2 px off frame edge, no axle/bearing/pedestal | R4: floating wheel, reads as cart wheel | A-frame bearing pedestal at x150, hub raised to y −56 (8 px ground clearance), bearing cap on hub |
| 4 | S1 | gears do not mesh: centre dist 46.7, tips 13.6+30.7=44.3 → 2.4 px air gap; large 12T pitch ≈14.7 px vs small 8T ≈9.4 px; brief asked 16/10 | R3 | regen both at module 4 (§4); centre dist 44 exact; phase-lock rotation |
| 5 | S1 | each part rotates on its own speed curve (small 90°/s, large 60°/s, flywheel 120°/s, clamps differ) and pistons have independent phase | ratios break under clamps; teeth interpenetrate; pistons not tied to any crank | one master angle θM; every part = ratio·θM + phase (§3 table); pistons from θM |
| 6 | S1 | motor belt goes to the gear area with no pulley; motor stub bare; motor feet sink 1 px into ground, no plinth | R2/R4 | motor pulley r5 on stub; plinth 48×10; motor centre y −27 |
| 7 | S2 | mixed pixel density: Graphics lines and rotated sprites rasterise at 1 screen px (½ art px); static sprites at 2 (fuzzy flywheel rim c-fly) | R6 | render machine into an art-res RenderTexture (≈420×220, scale 1) shown ×2, NEAREST; links drawn at integer art px (Bresenham) |
| 8 | S2 | link style heavy: width 2–4 + 2 px ink outline = 4–6 art px black bars; depth 15 puts belts **behind** gears | readability; belt hidden at its pulley | belt 2 px, rod 3 px, no extra outline; belts/rods depth above their pulleys (front+1) |
| 9 | S2 | piston-array: 3 non-identical "car pistons" in open air (middle 25% wider), orange valve blob floating, whole sprite incl. bolted base bobs ±3 px | AI-slop asymmetry; static base must not move | split: static `pistonBlock` + moving `pistonYoke`; identical cylinders |
| 10 | S2 | crank + pinion on X-brace with no bearing; crank hub r12.5 hides any pulley | R4 | bearing plates on a new mid-rail; crank pulley r15 > hub |
| 11 | S2 | HUD toasts (y 15–215 screen, x 414–866) cover piston tops (≈y 180) at default camera | focal object hidden | toasts to top-right column x≥900, max 2 visible; or camera focus GROUND_Y−190 |
| 12 | S3 | baked upper-left light rotates with gears/flywheel → highlight orbits | lighting inconsistency | P3: symmetric shading on rotating parts + static rim-light overlay sprite |
| 13 | S3 | ground tile reads top-down (plates ~40 screen px, dark #5f5244 cracks) under a side view; no contact shadows | perspective/scale mismatch, parts float | regen ground foreshortened (plates 3:1, cracks #8a7a64), shadow strips under frame/plinth/pedestal |
| 14 | S3 | pylons layer alpha .75, lattice visible through frame gaps (c-left) competes with truss | depth/clutter | pylons alpha .45 + haze tint; skyline alpha .4 |
| 15 | S3 | frame posts asymmetric (left 8 px, right 6 px); piston base sinks 4 px behind top girder (bed y −106) | AI asymmetry / overlap | inpaint right post to 8 px; bed y −110 |

## 3. Drive-train design (mechanically coherent, valid at every unlock stage)
Power flow: hand crank → pinion P ⇄ large gear on main shaft M; motor → belt → M; M crank pin → conrod → yoke → 3 plungers;
P crank-pulley → belt → flywheel hub pulley on F. Axles end-on, all axle centres in frame on a new horizontal **mid-rail**
(y −59..−53, x −93..28, riveted, part of frame) so every bearing is bolted to steel.

| element | component (tech) | centre / pivot | size, radius | notes |
|---|---|---|---|---|
| mid-rail | supportFrame (handCrank) | y −56 | 122×6 strip in frame art | inpaint into support-frame.png |
| bearing plate M | mainShaft NEW (handCrank) | (−44,−56) | 16×16, centre | frame layer +1 |
| main pulley / crank disc | mainShaft (handCrank) | (−44,−56) | 24×24, belt r10, crank pin r5 | rotates θM; always visible so motor+pistons have a target |
| large gear 14T | gearLarge (reinforcedCrank) | (−44,−56) | 64×64, Rp28 tip32 | behind main pulley, ratio +1 |
| bearing plate P | handCrank | (0,−56) on mid gusset | 16×16 | |
| pinion 8T | gearSmall (gearRatio) | (0,−56) | 40×40, Rp16 tip20 | ratio −1.75, phase +22.5° |
| crank pulley | crankPulley NEW (flywheel) | (0,−56) | 32×32, belt r15 | between pinion and crank, ratio −1.75 |
| hand crank | handCrank | (0,−56) | 48×48, arm ≈22 | front; angle = P angle (−1.75θM) |
| flywheel | flywheel (flywheel) | F (150,−56) | 96×96, r48, bottom y −8 | ratio −1.75·15/12 = −2.1875 |
| flywheel hub pulley | flywheel | (150,−56) | 28×28, belt r12 | front of flywheel |
| flywheel pedestal | flywheel | bottom-centre (150,0) | 48×64, bearing at local (24,8) | back layer, legs seen through spokes |
| motor | wornMotor | (−140,−27) | 64×48 | on plinth; flipX false |
| motor plinth | wornMotor | bottom-centre (−140,0) | 48×10 | |
| motor pulley | wornMotor | (−114,−31) | 12×12, belt r5 | ratio +2 (r10/r5) |
| piston block (static) | pistonArray | bottom-centre (−44,−110) | 96×58; cylinders y −168..−136, foot y −114..−110 | 3 identical cylinders, 20 px wide, pitch 28 (x −72,−44,−16) |
| piston yoke (moving) | pistonArray | pin eye at (−44, y) | 80×16, pivot (0.5,0.75) | bar 6 px, rods 10 px up; stroke 10 |
| axle caps | procedural | every axle centre | 4×4 | top of each stack, static |

Links (replace `MACHINE_LINKS`; kinds `belt` | `rod`; `shaft` removed, co-axial = same socket):
- belt motorPulley(−114,−31,r5) → mainPulley(−44,−56,r10): C 74.4, β 3.9°, wraps 172°/188°. Crosses left post in front.
- belt crankPulley(0,−56,r15) → flywheelHubPulley(150,−56,r12): C 150, spans at y −72→−69 (top) and −40→−43 (bottom), clear of motor/pistons.
- rod mainPulley.pin (r5 at θM) → yoke pin (−44, y): L = 69, y = −56 − (5cosθ + √(69² − (5sinθ)²)) → range −130..−120; yoke bar −133..−115 clears foot (−114) and cylinders (−136).
Rotation: θM integrates the existing combined speed curve; crank clicks add an impulse to θM. Ratios above; open belts keep
direction, mesh flips it. Gear phase: pinion offset 180°/8 so a tooth sits in a gap at the pitch point (x −16).

Render rules:
- Belt: centreline radius r+1, 2 px thick, outer px #2e1a12, inner px #6e3a22; tangent spans + outside wrap arcs (arc on
  each pulley through the side facing away from the other pulley). Moving dashes: 2 px #8c4a2a every 8 px on inner row,
  offset (ω·r·t) mod 8. Integer art-px raster (Bresenham line + midpoint circle filtered by angle). Depth: above its pulleys.
- Conrod: 3 px bar (#3e4246 / #7d8286 / #3e4246), eyes r2 #5a5f63 with #a3a6a4 centre pixel at both pins; rigid length,
  recomputed per frame. Depth front+1.
- Shaft: never a line; 4×4 cap #a3a6a4 TL px, #7d8286 body, #1f2225 ring, non-rotating.

## 4. New / regenerated assets (PixelLab create_image_pro, palette "Rust Wasteland", style_image_url = flywheel anchor,
no_background true, side view, light upper-left, then workbench repair+lint, crop/pad only)
| id (new) | file | size | pivot | prompt core |
|---|---|---|---|---|
| machine.bearingPlate | machine/bearing-plate.png | 16×16 | centre | square riveted steel plate, 4 corner bolts, round bearing housing ring r5 at exact centre, iron ramp |
| machine.pulleyMotor | machine/pulley-motor.png | 12×12 | centre | tiny steel V-pulley face-on, rim ring, hub dot, perfectly round |
| machine.pulleyMain | machine/pulley-main.png | 24×24 | centre | cast pulley face-on r10 rim 2 px, 4-hole web, raised crank-pin boss at (+5,0) from centre, rust patches |
| machine.pulleyCrank | machine/pulley-crank.png | 32×32 | centre | flat-belt pulley face-on r15, 3 px crowned rim, 5 spokes, hub r5 |
| machine.pulleyFlywheel | machine/pulley-flywheel.png | 28×28 | centre | hub pulley r12, 3 px rim, 4 spokes, bolted to hub |
| machine.pedestal | machine/flywheel-pedestal.png | 48×64 | 0.5,1 | cast-iron A-frame bearing stand side view, two splayed legs, cross tie, plummer block cap at top centre (24,8), bolted foot plates on bottom row |
| machine.motorPlinth | machine/motor-plinth.png | 48×10 | 0.5,1 | low riveted iron skid with 4 hold-down bolts, sand dust on top edge |
| machine.pistonBlock | machine/piston-block.png | 96×58 | 0.5,1 | three IDENTICAL vertical cylinders with bolted head caps on two side standards over a foot plate; open gap between foot and cylinder bottoms; no pistons visible |
| machine.pistonYoke | machine/piston-yoke.png | 80×16 | 0.5,0.75 | horizontal steel crosshead bar 6 px tall with centre pin eye, three 4 px plunger rods rising 10 px at x −28,0,+28 |
| machine.gearSmall (regen) | machine/gear-small.png | 40×40 | centre | spur gear 8 teeth, module 4: tip r20, root r11, tooth 6 px wide at pitch, solid web, hub r4 |
| machine.gearLarge (regen) | machine/gear-large.png | 64×64 | centre | spur gear 14 teeth, tip r32, root r23, tooth 6 px at pitch, 5 spokes, hub r6 key slot |
| terrain.ground (regen) | terrain/ground.png | 256×128 | 0,0 | flattened crack plates 3:1, low contrast, #8a7a64 base |
Optional pre-rendered rotation strips (if RenderTexture route is rejected): gearSmall 6 frames/45°, gearLarge 6/25.7°,
flywheel 8/60°, pulleys 4–6 frames per symmetry period, crank 16/360°.

## 5. Scene polish
- Composition: bbox x −172..198; crank at x 0 = focal centre; pistons top-left balance flywheel right. Keep MACHINE_ANCHOR.
- Contact shadows: 1–2 px strip #5f5244 α0.5 under frame base (x −100..100), plinth, pedestal feet; 3 px oval under flywheel rim gap.
- Scale: rivets 1 px everywhere; no part below 2 px detail; keep 2× only (no 1× sprites mixed).
- Depth/haze: pylons α .45 + tint #b8a98f; skyline α .4; mountains unchanged; no lattice behind frame at default camera.
- Lighting: light upper-left on static parts; rotating parts lit symmetrically; optional static rim overlay.
- HUD: toasts top-right column; never overlap y < −170 art at zoom 1.

## 6. Existing-asset defects
- gear-large: 12T (brief 16), module ≈4.7 px; gear-small: 8T, content only 28 px in 40 canvas (6 px empty border) → regen.
- piston-array: asymmetric, automotive pistons, floating valve → replace (block + yoke).
- support-frame: right post 6 px vs left 8 px; add mid-rail; otherwise good (keep).
- worn-motor, flywheel, hand-crank: crisp, palette-correct, keep; flywheel hub hole shows sky → cover with bearing cap/hub pulley.

## Produced assets (Phase 2, 2026-10-18)
All sizes/pivots = §4 contract (unchanged). Locked palette only, alpha 0/255 only, no resampling.
Art-px coords; "corner" = pixel-grid corner (pivot (0.5,0.5) of an even canvas = corner W/2,H/2).

| id | path (public/assets/) | size | pivot | notes |
|---|---|---|---|---|
| machine.gearSmall (regen) | machine/gear-small.png | 40×40 | 0.5,0.5 | 8T module 4, tip r20, root r11, Rp16; **tooth centred on +x at angle 0**; pinion phase +22.5° meshes |
| machine.gearLarge (regen) | machine/gear-large.png | 64×64 | 0.5,0.5 | 14T module 4, tip r32, root r23, Rp28; **tooth centred on +x at angle 0**; 5 spokes, hub key slot up |
| machine.pulleyMotor | machine/pulley-motor.png | 12×12 | 0.5,0.5 | disc r5 (10 px), V-groove rings |
| machine.pulleyMain | machine/pulley-main.png | 24×24 | 0.5,0.5 | disc r10; crank-pin boss centred at (+5,0) from centre (corner 17,12) = rod pin at θM=0 |
| machine.pulleyCrank | machine/pulley-crank.png | 32×32 | 0.5,0.5 | disc r15, crowned rim, 5 straight spokes, see-through gaps |
| machine.pulleyFlywheel | machine/pulley-flywheel.png | 28×28 | 0.5,0.5 | disc r12, 4 spokes, solid hub r5 (covers flywheel bore r4), 4 bolts |
| machine.bearingPlate | machine/bearing-plate.png | 16×16 | 0.5,0.5 | ring centred at corner (8,8) |
| machine.pedestal | machine/flywheel-pedestal.png | 48×64 | 0.5,1 | bearing bore centred at corner (24,8); feet on row 63 |
| machine.motorPlinth | machine/motor-plinth.png | 48×10 | 0.5,1 | content cols 1..46; motor (centre −140,−27) feet land on top row |
| machine.pistonBlock | machine/piston-block.png | 96×58 | 0.5,1 | cylinders rows 0..29 + glands rows 30..35 (y −168..−132); rod bores centred at local x 20/48/76 (world −72/−44/−16); standards cols 1..6 / 89..94; foot rows 53..57 |
| machine.pistonYoke | machine/piston-yoke.png | 80×16 | 0.5,0.75 | bar rows 10..15, rods 4 px cols 10..13/38..41/66..69 rows 0..9, pin bore 2×2 centred on pivot corner (40,12) |
| machine.frame (edit) | machine/support-frame.png | 200×110 | 0.5,1 | mid-rail rows 51..56 (y −59..−54) cols 8..127, behind posts/gussets; right post widened to 8 px (cols 192..199) |
| terrain.ground (regen) | terrain/ground.png | 256×128 | 0,0 | tileable xy; foreshortened plates ~3:1, base #8a7a64, cracks #7a7468, lit edges #a8957a |

Method: PixelLab create_image_pro (palette + anchor style, template reference) for pedestal, plinth, piston block,
bearing plate, ground; finalized by crop/pad, whole-pixel shifts, row/column duplication in uniform bands, re-inked edges.
Rotating parts (gears, 4 pulleys) are hand-pixelled to the exact module-4 / radius geometry (PixelLab candidates
shrank radii and changed tooth shapes) with radially symmetric shading (S3), one value step lighter than the frame
(face #5a5f63) for separation. piston-yoke hand-pixelled. Workbench score: gear-large 98.1, gear-small 95.0,
pulley-crank 99.1, pedestal 98.3, piston-block 95.9 (lint 0 errors).

Mesh verification (`scratchpad/ad/p2/meshtest.py`, centre distance 44, large 0°, pinion +22.5°):
static sprite overlap 0 px; pixel-raster analytic sweep over one tooth period 0 px; continuous 4× supersample 0 px²;
NEAREST-rotated sprite sweep ≤1 px in 7/30 frames (rounding only → use art-res RenderTexture per #7).
Tooth thickness at pitch 5.2 px (not 6) — needed for zero interference.

Notes for workers (no contract change):
- Depth: pistonYoke directly **behind** pistonBlock so rods slide into the glands (gland bottom y −132 = rod tip at BDC).
- Old `machine/piston-array.png` is left in place, unused once block+yoke are wired.
- Bearing plates are mostly hidden by main pulley (r10) / crank pulley (r15); still place them (visible pre-unlock / corners).

## Phase 3 — integrated review (2026-10-18)
Evidence (scratch): `.../scratchpad/p3/final/full.png`, `full-zoom.png`, `stages_sheet.png` (8 unlock stages s0..s7),
`p3/c7d.png` (full machine 3×), `p3/c7d_hub.png` (gear/crank hub 6×), `p3/t_rod.png` (rod/yoke 16 frames), `p3/fr2/` (belt-dash frames).
Stage capture script: `.../scratchpad/p3/stages.mjs` (ONLY=, FRAME_MS=, frames arg).

### Fixed (assets + numeric data)
| # | defect | fix | evidence |
|---|---|---|---|
| P3-1 | S1 large gear "ghosted/doubled": 5 open spoke windows showed frame post x −36..−27 + X-brace through the web; gear face #5a5f63 ≈ frame #3e4246 | gear-large: windows filled with recessed web #2b2e31 (ribbed solid web); teeth+rim lifted one value step (#5a5f63→#7d8286, #7d8286→#a3a6a4, #3e4246→#5a5f63) for r>21.5; tooth geometry unchanged (mesh proof of Phase 2 still valid) | c7d_hub.png |
| P3-2 | S1 crank hub = 4 concentric rings (pinion r20, crank pulley r15, belt r16 on top of pinion teeth, crank disc r12.5) → mush, pinion unreadable, mesh point hidden | pulley-crank redrawn r8 solid-web (3 ribs, crowned rim) in same 32×32 canvas; `crankPulley` belt radius 15→8 (belt rides inside pinion root r11); flywheel + flywheelPulley ratio −2.1875→−1.1666666667 (=−1.75·8/12, belt speed equal both ends, test green); hand-crank redrawn as slim arm + r5.5 boss (knob kept) so pulley + pinion teeth read | c7d_hub.png, final/full-zoom.png |
| P3-3 | S2 pinion teeth same grey as frame | gear-small teeth/rim lifted one value step (r>9.5), same mapping as P3-1 | c7d_hub.png |
| P3-4 | S1 flywheel pedestal hidden behind flywheel (only feet visible) | `flywheelPedestal.depthBias` 21 (back 0 + 21): near-side A-frame stand drawn over the flywheel (20), under overhung hub pulley (23) and belt (25) = wheel / bearing / overhung pulley order of a real stationary engine | final/full-zoom.png, stages_sheet s5 |
| P3-5 | S2 crank-pulley + flywheel-pulley open spoke windows showed parts behind (pinion web / flywheel hub) | pulley-flywheel windows filled #2b2e31 (solid web) | c7d.png |
| P3-6 | — | new asset ready for C1c: `machine/crank-brace.png` 48×48 pivot centre (riveted doubler strap on the arm rows 10..17 + bolted flange r5.4..8 round the boss), overlays hand-crank 1:1 | p3/brace8x.png |

Verified OK (no change): rod length rigid, yoke stroke 10, yoke bar clears foot/glands over 16 frames (t_rod.png); static parts
pixel-identical across frames (no jitter; girder/plinth/frame diff bbox None); crank→flywheel belt top span dashes move +x while
crank pulley turns clockwise (open belt, correct); HUD panel / toasts (x≥905, y≤155) do not overlap machine at default camera
or at the 1.46 zoom shot; `npm test` 560/560, typecheck clean, smoke errors [].

### Phase 3 code fixes (for Engineering Manager; Art Director did not edit these)
**C1 (S1) unlock-stage coherence.** Stages s0 (crank only), s1 (+gearRatio), s2/s3 (+motor), s6 (pistons, no reinforcedCrank)
show the hand crank and the main pulley turning together with nothing joining them; s1 shows the pinion meshing with nothing
(large gear only arrives at reinforcedCrank). Fix:
- C1a `src/data/machineComponents.ts` `gearLarge` (line ~154): `techId: 'reinforcedCrank'` → `'gearRatio'` (gear pair appears together on Gear Ratio).
- C1b hide the main shaft until something drives it: `src/data/machineComponents.ts` interface `MachineComponentDefinition` (after line 42)
  add `alsoVisibleWith?: { techId: TechId; minLevel: number }[]`; `src/game/math/machineLayout.ts:18` `isComponentVisible` returns
  `levels[def.techId] >= def.minLevel || (def.alsoVisibleWith ?? []).some(a => levels[a.techId] >= a.minLevel)`.
  `mainShaft` and `bearingM`: `techId: 'gearRatio'`, `alsoVisibleWith: [{ techId: 'wornMotor', minLevel: 1 }]`.
  Update `src/data/machineComponents.test.ts:85` `visibleAt` to call `isComponentVisible` (support test stays valid: mainShaft centre is on bearingM, same visibility).
  Result: s0 = crank on bearing P only ("only a small hand crank"); s1 = crank+pinion+large gear+main pulley (coherent train).
- C1c Reinforced Crank must still add a visible part: new component `crankBrace` — `src/assets/assetIds.ts` add `'machine.crankBrace'`;
  `src/assets/manifest.ts` entry `{ id: 'machine.crankBrace', file: 'machine/crank-brace.png', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, tileable: 'none', description: 'Riveted doubler strap and bolted boss flange that overlay the hand crank.' }`
  (+ `manifest.test.ts` row, fallback painter `paintGear`); `MACHINE_COMPONENT_IDS` insert `'crankBrace'` after `'handCrank'` (tests: 16→17 ids, canonical order list);
  def `{ id: 'crankBrace', techId: 'reinforcedCrank', minLevel: 1, assetId: 'machine.crankBrace', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } }, size: { width: 48, height: 48 }, origin: { x: 0.5, y: 0.5 }, layer: 'front', depthBias: 1, animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 }, connections: [], effects: [] }`.
  Axle cap (front+2) stays on top.
- C1d (S2) motor bought before Gear Ratio (s2, s6-without-gears): crank is spun by the motor through no visible link.
  `src/game/entities/MachineAnimator.ts`: keep a second `crankState: MasterState` stepped with degPerSec 0 (click impulses only).
  While `!isActive('gearSmall')`: click impulses go to `crankState` only; `handCrank`/`crankBrace` angle = `partAngle(crankState.deg, ratio, phase)`.
  When gearSmall becomes active: store `crankOffset = crankAngleNow - partAngle(master.deg, -1.75, 0)` and add it to handCrank/crankBrace from then on (no snap; pinion/large-gear phases untouched so the mesh stays exact). Reset clears both.

**C2 (S3) uneven pixels at non-integer zoom.** Wheel zoom factor 1.1 gives 2.2/2.42/2.93 screen px per art px → irregular pixel
widths, gear teeth look jagged at zoom (final/full-zoom.png). `src/game/rendering/CameraController.ts:65`: snap the result of
`wheelToZoom` to the nearest step where `PIXEL_SCALE * zoom` is an integer or half-integer (zoom ∈ {0.5, 0.75, 1, 1.25, 1.5, 1.75, 2}),
or tween between those steps. Gameplay unaffected.

**C3 (S3) docs/manifest text.** `src/assets/manifest.ts:78` pulleyCrank description → `'Small flat-belt pulley (r8, centred in a 32×32 canvas) with crowned rim and solid three-rib web; belt rides inside the pinion root.'`;
`docs/ASSET_GUIDE.md` crank row: "slim crank arm with r5.5 boss and wooden knob at r≈18"; gear rows: "solid recessed web, teeth one value step lighter than the frame".

## Phase 4 — release-quality gate (2026-10-18)
Evidence (scratch `.../scratchpad/p4/`): `final/full.png`, `final/stages/s0..s7`, `final/u03-tree.png`, `final/u04-tree-sel.png`,
`final/u06-system.png`, `final/u02-toasts.png` (repo build); prototype of the code fixes below (scratch copy `p4/proto`, port 4180):
`proto_full2.png`, `mo2/s7-z4-f00.png` (zoom 2), `mo2_s7_hub.png` (art-res motion sheet), `ft3_c.png` (floating text);
before: `mo_s7_hub.png`, `mo/s7-z4-f00.png`, `rs_flywheel.png` / `rs_gear-large.png` (NN vs RotSprite), `fly_round_cmp2.png`.
Headless note: Chromium runs this scene at ~7–25 fps, so tweens < 300 ms are mostly missed by screenshots; sample alpha via a dev hook.

### Fixed (assets, numeric data, CSS)
| # | defect | fix | evidence |
|---|---|---|---|
| P4-1 | Pylon lattice centred behind the crank / gear mesh at the default camera (pylons at screen x 127/640/1152) — focal-point clutter | `bg/pylons.png` rolled +64 art px (np.roll, tileable, no resample) → pylons at x 255 (left of motor) / 767 (right bay, top shows between pistons and flywheel) | final/full.png |
| P4-2 | Flywheel silhouette not round: rim outer radius 47.9 (axes) … 52.3 (diagonals) = squircle → wheel "egg-wobbles" while spinning, rotated corners clip | `machine/flywheel.png` trimmed to circle r 47.6 about corner (48,48), outline re-inked #14110f, 1-px lit lip ring #5f5244 (r 45.6–46.6); 799 px removed, palette unchanged | fly_round_cmp2.png, final/stages/s5 |
| P4-3 | Tech-tree names truncated: "REINFORCED CRA…", "GENERATOR BLUE…", "IMPROVED PISTO…" | `techTree.css` `.tech-node-name` .88em, letter-spacing 0, bold (19 chars = 150 px ≤ 152 px inner width) | final/u04-tree-sel.png |
| P4-4 | "+N" click text practically invisible: alpha fades with Cubic.easeOut over 700 ms (alpha .49 @140 ms, .18 @300 ms), 20 px mutedOrange on the dark girder | `world.ts` `floatMs` 1100, `floatRisePx` 40, `FLOATING_TEXT` fontSizePx 24, strokePx 4, spawnOffsetY −56 (clears knob arc); rest = C4-3 | ft3_c.png (with C4-3) |
| P4-5 | HUD: small labels top-aligned against the 1.6em ME value, secondary rows touching | `hud.css` `.hud-row` align-items baseline, line-height 1.25, 2 px between rows | final/full.png |
| P4-6 | Assets for code fixes (inert until wired): `bg/sky.png` 1280×720 (4 sky tones as hard stepped strata + pale sun r17/halo r25 upper-left = light direction; 5 palette colours); `machine/rot/*-rot.png` RotSprite rotation sheets (table C4-1) | — | proto_full2.png |

Verified OK: unlock stages s0..s7 coherent (s2/s6 motor drives main pulley only, crank independent); crank brace reads at s4+ (thicker riveted arm + flange);
belts tangent, open belt direction correct; rod eye stays on main-pulley boss; toasts never cover x < 904; system menu / reset confirm legible.
`npm test` 584/584, `npm run typecheck` clean, `npm run build` ok, smoke errors [].

### Phase 4 code fixes (Engineering Manager; Art Director did not edit code)
**C4-1 (S2, most visible art defect) RotSprite rotation frames instead of NN `setAngle`.** NN rotation at art res breaks 1-px outlines into
hairy spurs (flywheel rim, gear teeth) every frame. Sheets are ready in `public/assets/machine/rot/`: grid, row-major, frame k = source rotated
**clockwise** by k·360/N about the canvas-centre corner (Scale2x×3 → NN rotate → centre-sample /8; frame 0 = source; source colours only).
| assetId | file | frame W×H | N | cols×rows |
|---|---|---|---|---|
| machine.flywheel | machine/rot/flywheel-rot.png | 96×96 | 180 | 14×13 |
| machine.gearLarge | machine/rot/gear-large-rot.png | 64×64 | 140 | 12×12 |
| machine.gearSmall | machine/rot/gear-small-rot.png | 40×40 | 80 | 9×9 |
| machine.crank | machine/rot/hand-crank-rot.png | 48×48 | 80 | 9×9 |
| machine.crankBrace | machine/rot/crank-brace-rot.png | 48×48 | 80 | 9×9 |
| machine.pulleyMain | machine/rot/pulley-main-rot.png | 24×24 | 140 | 12×12 |
| machine.pulleyCrank | machine/rot/pulley-crank-rot.png | 32×32 | 80 | 9×9 |
| machine.pulleyFlywheel | machine/rot/pulley-flywheel-rot.png | 28×28 | 180 | 14×13 |
| machine.pulleyMotor | machine/rot/pulley-motor-rot.png | 12×12 | 24 | 5×5 |
Frame counts are load-bearing: 140/80 = 1.75 = gear ratio and pinion phase 22.5° = 5 frames, so both gears always show an exact mesh pair
(overlap ≤ 2 px in 20/140 frames, NN today ≤ 2 px in 36/140); parts sharing a shaft share N (main 140, crank 80, flywheel 180).
- `src/assets/manifest.ts`: `AssetEntry.rotation?: { file: string; frames: number }`; set it on the 9 entries above. `planAssetLoads()` emits an extra
  `{ key: id + '#rot', url: 'assets/' + rotation.file, kind: 'spritesheet', frame: { width, height, count: frames } }`. `manifest.test.ts`: rotation file exists in the glob, frames integer > 1.
- `src/game/scenes/BootScene.ts:21`: pass `endFrame: load.frame.count - 1` to `this.load.spritesheet`.
- `src/game/math/driveTrain.ts` (pure): `export function rotationFrame(deg: number, frames: number): number { const n = ((deg % 360) + 360) % 360; return Math.round((n / 360) * frames) % frames; }`
  + tests: (0,80)→0, (4.5,80)→1, (−4.5,80)→79, (359.9,80)→0, (22.5,80)→5.
- `src/game/entities/MachineView.ts:96` sprite texture: `def.animation.kind === 'driven' && scene.textures.exists(def.assetId + '#rot') ? def.assetId + '#rot' : def.assetId`, frame 0.
- `src/game/entities/MachineAnimator.ts` lines 94, 117, 123: replace `setAngle(x)` with `applyAngle(sprite, x)` = if texture key ends with `#rot`:
  `setFrame(rotationFrame(x, sprite.texture.frameTotal - 1)); setAngle(0)` else `setAngle(x)` (fallback when a sheet is missing).
- Regeneration script (put in `scripts/art/make_rot.py`; source: scratch `p4/tools/make_rot.py` + `p4/tools/rotsprite.py`; algorithm in this section) —
  rerun whenever a rotating source PNG changes. Prototype diff: scratch `p4/proto.diff`.

**C4-2 (S3) sky asset.** `src/assets/manifest.ts:17` `bg.sky` `file: null` → `'bg/sky.png'`; description → `'Dusty sky in the four sky palette tones as hard stepped strata, pale sun disc upper-left (light direction); screen-fixed, shown at 2x.'`
(fallback painter stays). Adds top-dark → horizon-light depth and a light source matching the machine's upper-left lighting.

**C4-3 (S2) floating "+N" readability.** `src/game/rendering/FloatingText.ts`: split the tween — `y` with `Cubic.easeOut`, `alpha: 0` with
`Quad.easeIn` (same duration; `onComplete` hide on the alpha tween) → alpha ≥ .8 for the first 400 ms (measured .98/.91/.80/.58/.38/.14 at 0.15 s steps);
text style `color: '#ffd27a'` (palette accent light), `fontStyle: 'bold'` (ink stroke 4 px from data) → readable on dark girder and on haze.

**C4-4 (S4, polish) ground depth.** `src/data/world.ts`: `GROUND_SHADE = { color: PALETTE.ink, alpha: 0.07, bandStarts: [64, 128, 192], haze: { color: PALETTE.skyHaze, alpha: 0.3, height: 18 } }` (world px below GROUND_Y);
`src/game/rendering/Terrain.ts`: after the horizon strip add one haze rectangle at `GROUND_Y + HORIZON_STRIP.height` (height 18) and one ink rectangle per band start
from `GROUND_Y + start` to `WORLD.height` (depth `GROUND_LAYER.depth + 1`, origin 0,0). Hard steps, no gradient: far ground hazed, foreground darker. Evidence proto_full2.png.

**C4-5 (S4, optional) first-click affordance.** At s0 the crank is ~40 screen px in an empty frame. Until the first click, pulse the crank knob:
a 2-art-px ring #ffd27a alpha 0→.6→0 at r 20 art px around crankHub, 1.2 s period, stop on first click. Code only (HandCrank.ts), no asset.

## Phase 5 — final release verdict (2026-10-18)
Verdict: **RELEASE-READY.** Evidence (scratch `.../scratchpad/p5/`): `full.png`, `full_after.png`, `stages_sheet.png` (s0..s7), `mo/s7-z4-f00..15.png` (zoom 2),
`pulse_sheet.png` (s0, 14 frames @100 ms), `ui/u01-floattext.png`, `ui/u04-tree-sel.png`, `ui_sheet.png`, `ground3x.png`, `sun3x_after.png`.
Tools: `p5/tools/meshframes.py` (identifies the RotSprite frame of each gear in a screenshot), `p5/tools/ftalpha.mjs` (float-text alpha via dev server).

Verified (C4-1..C4-5 live in the preview build):
- C4-1 RotSprite: 16 consecutive zoom-2 frames, gear-large and pinion frame read back from pixels; every pair satisfies kP ≡ 5 − kL (mod 10 = one tooth pitch at 140/80 frames) → exact mesh pair every frame, opposite directions. No NN spurs on teeth / flywheel rim.
- C4-2 sky: stepped strata + sun upper-left, 2 screen px per sky px = machine pixel density.
- C4-3 float text: #ffd27a bold, alpha .93 @ 0.31 s, .82 @ 0.45 s, .70 @ 0.63 s, .49 @ 0.78 s, 0 @ 1.1 s (Quad.easeIn); readable on girder.
- C4-4 ground: hard haze/ink bands at +18/64/128/192, no gradient.
- C4-5 crank pulse: 2-art-px #ffd27a ring r20, alpha cycles ~1.2 s, gone after first click.
- Stages s0..s7 coherent; UI panels (HUD, tech tree, system, reset confirm) legible, names not truncated. `npm test` 602/602, typecheck clean, build ok, smoke errors [].

### Fixed (asset)
| # | defect | fix | evidence |
|---|---|---|---|
| P5-1 | Sun disc + halo had 1-px "pimples" at the 4 cardinal points (midpoint-circle artefact), visible at 1:1 | `bg/sky.png`: 8 pixels (halo 372,265 / 347,290 / 397,290 / 372,315; disc 372,273 / 355,290 / 389,290 / 372,307) set to the surrounding tone; palette unchanged (5 colours) | sun3x_after.png |

### Phase 5 notes (no code change required for release)
- Cosmetic, accepted: thin cloud streaks pass behind the sun disc (sun in front of cloud). Optional later asset tweak only.
- `p4/tools/ui.mjs` late-tree step buys with insufficient ME (script issue, not game) — u08 shows early tree; not a defect.

## A17 — WP17 legacy feed parts, generator glow, crank gain text (2026-10-23)
Evidence (scratch `.../scratchpad/A17/`): before `base/s9..s16*.png` + crops `base/c_*.png`; after (prototype = worktree + codeSpec,
port 4181) `final/s9_era2_full.png`, `final/s11_era3_full.png`, `final/s13_era4_full.png`, `final/s15_era5_full.png`,
`final/s16_postgame.png`, crops `final/c_*.png`, side by side `final/compare.png`; era I gain text `v1/s7_full.png`; postgame accent
`acc1/s16_postgame.png`, `acc1/c_core.png`; art previews `out1/p_glow.png`, `out1/p_bellows.png`, `out1/bel8.png`, `out1/p_exciter.png`,
`out1/p_gallery.png`. Smoke `CLICK_SHOT=1 ONLY=s9_era2_full,s11_era3_full,s13_era4_full,s15_era5_full,s16_postgame`: errors [], parts17 as
expected, bellowsFrames [3,1,2,3]. Prototype: typecheck clean, 84 files / 2610 tests green (2605 + 5 new), bundle budget PASS.

### References -> rules
- Great forge bellows: boards hinged at the snout (nozzle block), leather sides held out by internal ribs, upper board pumped /
  weighted, snout -> tuyere pipe -> fire (https://www.beautifuliron.com/forge_blowrFireH.htm,
  http://warehamforgeblog.blogspot.com/2008/01/bellows-reconstruction-2.html). -> wedge in side elevation, folds radiate from the
  snout, nozzle hose into a collar at the firebox foot (grate / ash-pit level). Scale 1 art px ~ 2.5 cm -> 46 px board ~ 1.2 m.
- Suspension insulator string: cap-and-pin discs linked pin-to-cap, hung from the crossarm, conductor clamped below
  (https://glassian.org/Suspension/index.html, https://www.sciencedirect.com/topics/engineering/pin-insulator). -> backfeed =
  string under the gallery deck, lug at the bottom clamp, jumper up into a deck bushing.
- Steam lance / soot-blower wall unit: a valve admits steam from the feed pipe into a short lance through the wall, jet at the tip
  (https://www.merchantnavydecoded.com/soot-blower-in-boiler/, https://allindustrialtraining.com/soot-blower/). -> valve hung under
  the deck, riser into its flanged bottom port, lance through the deck; puffs rise above the deck.
- House rules kept: R4 every part stands on / hangs from steel, locked palette + era accents, alpha 0/255, no resampling, cables
  and pipes end on drawn lugs / ports.

### Defects found (base shots) -> fix
| # | sev | defect (evidence) | fix | after |
|---|---|---|---|---|
| A17-1 | S1 | generatorGlow = flat translucent cyan box 84x44 over the generator, incl. sky through the yoke arch and over the belt (base/c_s9_gen.png) | new `machine/legacy/generator-glow.png` 384x64: 4 gauge frames laid 1:1 on generator.png, opaque palette pixels inside the silhouette (coil turn gaps, armature air-gap ring r 8.6..10.4, caps, L3 brush sparks; the 4 L3 spark px rise up to 2 px above the terminal caps); depthBias 6 -> 4 so the belt + pulley cover it | final/c_s9_gen.png, final/c_s15_gen.png |
| A17-2 | S1 | bellows = 40x24 brick-coloured box flat on the boiler brickwork, reads as an ash door (base/c_s11_boiler.png) | new `machine/legacy/bellows.png` 240x28 (4 cells 60x28): great bellows wedge on 2 iron legs, sand boards, leather folds, iron snout; seat (-242,0); hose (-212,-11)->(-204,-11)->(-204,-22) into a new tuyere collar on boiler.png | final/c_s11_boiler.png |
| A17-3 | S1 | exciterFeed post overlaps the right spire leg shoe (x 80..95 vs leg 88..99), dark-on-dark, not connected to the exciter (base/c_s13_exc.png) | new `machine/legacy/exciter-feed.png` 16x28: cyan glass insulator on a terminal box in the gap between exciter and leg, copper strap into the exciter flank; seat (80,-110), lug (82,-137) | final/c_s13_exc.png |
| A17-4 | S1 | steamLance floats 19 px below the gallery truss beside the dish; steam puffs appear 35 px above it with no path (base/c_s15_top.png) | new `machine/legacy/steam-lance.png` 16x32 hung from the deck underside (seat (20,-414)); riser extended to port (20,-382) | final/c_s15_top.png |
| A17-5 | S1 | backfeedTerminal floats 19 px below the gallery's right end, not attached (base/c_s15_top.png) | new `machine/legacy/backfeed-terminal.png` 16x28 suspension string from the deck underside (seat (120,-414)), lug (120,-388) | final/c_s15_top.png |
| A17-6 | S2 | crank gain block (bottom-centre crank + (-40,-70) art) sits on the piston cylinders / calliope in every era with pistons (base/s15_era5_full.png) | spawn over the frame's right half (+116,-128 world) in eras I-III, right of the spire above the flywheel (+316,-138 world) once spireTower is visible | final/compare.png, v1/s7_full.png |
| A17-7 | S3 | gain-line stroke fixed 4 world px while the font scales with zoom (thin at zoom 0.5) | stroke = strokePx * fontPx / fontSizePx (m3) | final/s15_era5_full.png |

Verified OK: no part overlaps a neighbour it should not; the exciter / backfeed cables end on the drawn lugs; hose and riser join the
drawn ports; glow under belt; bellows animates (frames cycle); gain block >= 16 screen px at zoom 0.5, clear of beam, plate, pistons,
calliope, spire, dishes and the backfeed cable; workbench lint 0 errors / 0 warnings on bellows, exciter feed, backfeed, lance.
PixelLab: create_image_pro jobs 5b7182c7 (bellows, 25 cand.), c2a50bff (insulator, 64), 466ec779 (valve, 64) used as references only:
candidates were 3/4-view (bellows), seam-split (insulators) or had side ports that do not match the vertical flow (valves), so the
final sprites are hand-pixelled in `scripts/art/a17/build.py` (deterministic, locked palette).

### Postgame restored-machine accent (D3, for WP18)
Decision: in `choice` / `postgame` (finale restored = true) the era V energy sprites swap to `machine/era5/restored/` variants
(produced, inert): null core inverts from violet void to a warm lit core (ink -> #e8e0cc, x0 -> #ffd27a, x1 -> #f0a848,
x2 -> #d9822b); glint, beads, lens light warm (x0..x3 -> #6a2418 #d9822b #f0a848 #ffd27a); rings, siphon arcs, siphon fluid,
anchor glows, inversion ghost, aperture horns and chamber violet pixels pale steam (x0,x1 -> #c9b28a, x2 -> #ddc9a3, x3 -> #e8e0cc).
Warm core against the restored blue sky = strongest read (a white / sky-blue core vanishes into #6f9fc8..#a8d0e8); everything else
on the machine stays rust/iron. Evidence acc1/c_core.png. Wiring spec in the A17 codeSpec (WP18 owns the code).

### Art Director verification, round 0 (worktree `claude/art-a17`, patch applied, 2026-10-23)
Verdict: **RELEASE-READY**. Evidence (scratch `.../scratchpad/A17/ad_r0/`): `s7_full.png`, `s9_era2_full.png`, `s11_era3_full.png`,
`s13_era4_full.png`, `s15_era5_full.png`, `s16_postgame.png` (`CLICK_SHOT=1`), crops `c_s9_gen.png`, `c_s15_gen.png`, `c_s11_bel6.png`,
`c_s16_bel6.png`, `c_s11_wide.png`, `c_s13_exc.png`, `c_s15_top.png`, `c_s16_top.png`, contact sheet `verify.png`; gain block at full
alpha (rAF frozen right after the clicks) `fz/s11_era3_full.png`, `fz/s15_era5_full.png`, `fz2/s7_full.png` (zoom 1),
`fz2/s7_full-zin.png` (zoom 1.75), `fz2/s15_era5_full-zin.png` (zoom 1.25), crop `g_frozen.png`; log `stages.log`, `console.log`.
- Gates: build (tsc) clean; vitest 84 files / 2610 tests pass; bundle budget PASS (app 344.3 KB / gzip 101.8 KB, assets 1205 KB).
  Smoke errors []; parts17 all true at s15 and s16; bellowsFrames s11 [1,1,2,3], s15 [0,1,2,3]; wp2-crank errors [] / failed [].
  Console: the 5 legacy PNGs load 200, no `[assets] size mismatch`, no load failure (only the old `fx.dust` fallback line).
- Assets: dims match the manifest (384x64, 240x28, 16x28, 16x28, 16x32); alpha 0/255 only; every pixel on the locked palette
  (legacy, boiler, the 24 restored variants); restored variants are the same size as their originals; boiler.png = 17 px changed (collar).
- Part crops match the prototype `final/*.png`: exciter, lance and backfeed 0 changed px; generator / boiler / bellows diffs only from
  the belt, fire and bellows animation phase.
- Acceptance 5: no cyan box on the generator (coil gaps + air-gap ring inside the silhouette, sky through the yoke clean, under the
  belt and pulley); bellows stands on the ground in front of the plinth, hose into the tuyere collar; exciter insulator sits between
  the exciter and the right spire leg, cable on the cap, strap into the exciter; lance and backfeed string hang from the deck
  underside, riser into the lance flange, cable on the string's bottom lug; gain block clear of pistons, calliope, spire, dishes,
  plate, beam and cables at zoom 0.5 / 0.75 / 1 / 1.25 / 1.75. At full alpha the ink stroke reads at zoom 0.5.
- Notes (S3, non-blocking, off this worktree's files): (n1) lance puffs spawn at (20,-430) (`src/data/steamFx.ts`), about 10 px
  above the deck top in front of capsule 1. (-421..-424) would start them at the deck surface. (n2) The bellows has no drawn
  actuator (pole handle free); a rocker or chain to the drive would be polish. (n3) The bellows fallback painter still draws the
  old 40-px geometry; its nozzle does not reach the A17 hose start (59,17). This only shows on a load failure. (n4) The see-through
  gap under the boiler drum (boiler.png rows 69..74, cols 39..70) predates A17 (the same pixels show in the base shot). It is OK
  as a saddle gap.

## WP18b — showcase integration, restored warm core, final 3840x2160 set (Art Director round 1, 2026-10-23)
Verdict: **RELEASE-READY**. No asset repair, no code fix. Evidence (scratch `.../scratchpad/WP18b/ad1/`): fresh run
`showcase.mjs "http://localhost:4173/?debug=1"` -> `shots/*.png` (14, all 3840x2160), `showcase.json` (errors []); half-size views
`v/h_*.png`; 3x crops `v/c_core_pg.png` (restored), `v/c_core_a.png` (ruined), `v/c_gallery_pg.png`, `v/c_gen_pg.png`, `v/c_bellows_pg.png`,
`v/c_exc_pg.png`, `v/c_crown_puff.png`; plates `v/plates.png`, `v/plate_sheet.png`, `v/c_plate_era2.png`; grid check `v/crown_offgrid.png`;
EM set vs AD set `v/em_vs_ad.png`. dist build 15:42 is newer than every WP18b source edit.

### Gates
| gate | result | evidence |
|---|---|---|
| whole machine visible + framed | PASS: both pillars, guy anchors, aperture horns (top ink row at device y 177 = 59 art px under the top edge at zoom .5) in a, b_k56, c, d_photo_postgame, e_end | `v/h_*.png` |
| A17 legacy parts readable | PASS: generator glow held on gauge frame 3 (coil gaps + air-gap ring + cap sparks, under belt); bellows wedge in front of the plinth, hose into collar (same as A17 r0); exciter insulator between exciter and leg; lance valve + backfeed string hang from the deck | `v/c_gen_pg.png`, `v/c_bellows_pg.png`, `v/c_exc_pg.png`, `v/c_gallery_pg.png` |
| restored core = warm lit heart vs blue sky | PASS: core #ffd27a/#f0a848/#d9822b with #e8e0cc eye on #6f9fc8/#a8d0e8; rings, arcs, siphon fluid, anchor glows pale steam; lens light warm | `v/c_core_pg.png`, `shots/d_photo_crown.png` |
| crystal (D5) | PASS: frame 2 #cfe8d6/#7fae96 + ink outline reads mint at zoom .5 and 1.5. No dark-green regression. **No `machine.crystal` restored variant needed** | `v/c_gallery_pg.png` |
| no violet on swapped parts | PASS: whole-frame scan finds #9a6ad0 only as 1 art px on `backfeed-terminal.png` (12,1) = the drawn "violet lead-in bushing" (legacy, not swapped, A17 left legacy feeds unchanged). Lavender in c = DOM RF label | scan in this audit |
| photo shots zero HUD/DOM | PASS: a, d_photo_postgame, d_photo_crown have no HUD and no chip (chip opacity '0', hud hidden in json) | `shots/a_era5_ruined.png`, `shots/d_photo_*.png` |
| era V ruined = violet world | PASS: violet strata sky, violet core, eclipse sun, dark crystal | `shots/a_era5_ruined.png` |
| crown framing (D7/T9) | PASS, no T9 needed: camera (2048,696,1.5); aperture horns top at device y 99 (11 art px inside); core centre about (1920,1090) device = frame centre +-4 CSS px; crystal, gallery, lance, backfeed in frame | `shots/d_photo_crown.png` |
| pixel integrity | PASS: zoom .5 shots = exact 3x3 device blocks (0 non-uniform); crown machine layer on one 9-px grid (x mod 9 = 3, y mod 9 = 0) for core, aperture, posts, deck, lance, backfeed. Off-grid edges only on parallax skyline/mountain layers (expected) | `v/crown_offgrid.png` |
| C7 probes | PASS: A 0; B k2_5/k3_9/k5_4/k6_9 0, k41_5/k45_2/k56 33; C 33, nullCore `#restored#rot`, ringBead/aperture `#restored`, frames generatorGlow 3 / crystal 2 / lensLight 3 / anchorGlow1L 2; D chip focus-visible opacity '1' then blurred '0'; D2 33 + crystal 2; C2 33 | `showcase.json` |

EM set (`.../scratchpad/final-shots/`) vs AD set: 11 shots differ <= 1.6 % (animation phase). b_k41_5, b_k45_2 and e_teaser_assembling differ
20–41 % because the survey pan / teaser zoom was caught a few frames apart. Both versions are clean compositions, so either set can ship.

### Notes (S3, not WP18b scope, no block)
- N1 (WP21 demo teaser): name plate shows stage frame 4 = full `RESTORE` in e_teaser_assembling and e_teaser_end. Era II teaser shows
  frame 2 `RES?OR?`. D4 wants the name redacted in the demo. Lever for WP21: clamp the `namePlate` frame in the teaser (ShowcaseScene) to
  <= 2 (what a demo player already saw), e.g. a pure `TEASER_PLATE_MAX_FRAME = 2` in src/data.
- N2 (steamFx owner, = A17 n1): lance puffs spawn at (20,-430) (`src/data/steamFx.ts`), about 10 px above the deck. In the crown close-up a
  translucent puff sits over siphon capsules 1–2 (`v/c_crown_puff.png`). The capsules stay readable through it. Spawn at y -423 so the puff
  rises from the lance at the deck surface.
- N3 (accepted): restored sky = 3 flat strata (#3f6690 / #6f9fc8 / #a8d0e8, edge wobble 1 art px) from `src/data/palette.ts`.
  The zenith-to-mid step is large but deliberate (WP16). Optional later polish: one intermediate stratum.
- N4 (accepted): the backfeed violet bushing pixel stays violet in postgame. It matches the RF colour in the HUD (RF still feeds the grid).

## WP16b-1 — store polish verification: far plain, title without HUD, store-shots F1–F4/F7, top-5 manifest (Art Director round 0, 2026-10-23)
Verdict: **RELEASE-READY**. No asset repair, no code fix. Evidence (scratch `.../scratchpad/WP16b-1/ad-r0/`): fresh `npm run build`
(bundle PASS: app 396.3 KB, css 38.7 KB; `title-screen.is-open)>#hud-panel` present in dist css), then
`store-shots.mjs "http://localhost:4173/"` with SIZES=1080 -> `s1080/` and SIZES=2160 -> `s2160/`: each fail [] errors [], 19 PNGs
(1920x1080 / 3840x2160), `store-top5.json` store 5 / alt 1 / pressKit 4 / missing []. Crops in `crops/`, tools in `tools/`.

### Gates
| gate | result | evidence |
|---|---|---|
| grey band gone (F5) | PASS: `band_probe.py` 0 rows in all 19 shots (WP16a: clean 01/02/03 230, 04 211, 06 208; hud 04/06 91) | probe run, `crops/06h-plain-left.png` |
| far plain reads as dusty plain, eras I–IV | PASS: ramp rows at layer alpha .45 over the sepia sky give #b2a083 -> #9f8e75 down to the ground; skyline bases fade into it (no dark underside stripe) | `s1080/1080/04-era3-boiler-clean.png`, `06-era4-spire-*.png` |
| background pylons grounded | PASS: pylon feet sit on the ramp step (#a8957a -> #8a7a64 rows), so they read as standing on the plain | `crops/04c-pylonfoot-x3.png` |
| era V dusk not too striped (watch item) | ACCEPTED: 3 steps under the pylons at screen rows 793 / 885 / 951 = `finale/horizon-glow.png` tex rows 528 / 588 / 634 x1.5, the same edges as WP16a. Only the contrast changed: luma 119 -> 87 -> 113 -> 146 (steps -32/+26/+33; WP16a -19/+15/+20). That is within the era V sky's own strata steps (+26/+30/+17), and the lighter base gives the dark machine a better silhouette. At Steam thumbnail size it reads as a dusk glow | `crops/07c-old-vs-new.png`, `crops/2160-07c-plain.png`, `crops/store-top5-thumbs.png` |
| title (F3/F6) | PASS: `10_hud_hidden` [hidden x3] is computed before any inline style; no version line; `10_hud_back` visible. The bolted plate reads as cast iron (bevel, 4 rivets, rust streaks under the top bolts, cast letters with a 1 px shadow), crisp at x6 / x12 | `s1080/1080/10-title-hud.png`, `crops/10-logo-1x.png`, `crops/2160-10-logo.png` |
| toasts (F1) | PASS: no WELCOME BACK in 02-hud / 04-hud; 03-hud keeps the SUBSTATION BLUEPRINT milestone (story hook), crisp at 4K | `crops/2160-03h-toast.png` |
| tree (F4) | PASS: no HUD panel / buttons at the left edge or bottom-right of 05 | `s1080/1080/05-tree-era3-hud.png` |
| clean framing (F2) | PASS: 01–04 and 06 clean use the live camera on the current machine (centred, no gain text); `<size>_<id>_clean_hud_hidden` ok x8 per size | `01-era1-start-clean.png`, `04-era3-boiler-clean.png` |
| finale typed (F7, press kit) | PASS: `08b_typed` count 5, empty 0, last line exact, phase sequence, t 64.03; no SKIP, no buttons | `s1080/1080/08b-finale-typed-hud.png` |
| no regression, restored world | PASS: 09-clean vs WP16a differs 1.39 % and only on animated parts (gears, flywheel, beam, puffs, birds). Background pixel-identical | `crops/diff-09-postgame-portrait-clean.png` |
| no regression, era V world | PASS: 07-clean differs only in rows 709–989 (the intended F5 zone) plus animated parts. Sky, eclipse, ridge and skyline tops are identical | `crops/diff-07-era5-ruined-clean.png` |
| 2160 = clean 2x | PASS: 07 tower/core, HUD panel, toast and logo are crisp at 1:1 of 4K | `crops/2160-*.png` |
| art scripts (F5/F6 generators) | PASS: py_compile ok; `check_mr.py` equal True diffPx 0; `logo_plate.build()` == shipped logo; shipped-path write without --force exits 2; `git status public/assets` empty | this audit |

### Store set (store-top5.json order)
1 07-era5-ruined-clean, 2 06-era4-spire-hud, 3 03-era2-generator-hud, 4 05-tree-era3-hud, 5 09-postgame-portrait-clean
(alt 04-era3-boiler-hud). All are store quality at 1080 and 2160. The set spreads across five palettes (violet, sepia x2, UI, blue/green).

### Notes (no block)
- N1 (optional polish, after WP21): to soften the era V plain further, add a 2-tex-row ordered dither at the `horizon-glow.png` band
  edges (rows 588 and 634). This is an art-only change; re-run 07 and the finale shots afterwards.
- N2 (known, = WP18b N2): a lance steam puff sits over siphon capsule 1 in the 06–09 shots. Still open in `src/data/steamFx.ts`.
- N3 (press kit only): in 08-finale-reveal-hud a 3-step dark mark at (10–18, 230–236) is a background bird sprite caught at the frame edge.
- N4 (WP21-owned, unchanged): guidance prompt in 01-hud; the tree's empty lower right.

## WP16b-2 — tree contrast / trap / layout, compact in-tree toast, one guidance prompt (Art Director round 0, 2026-10-23)
Verdict: **FIXES REQUIRED** (3 CSS fixes, one file: `src/ui/techTree.css`). No asset repair. Evidence root
`.../scratchpad/WP16b-2/ad0/`. dist (20:13) and dist-demo (20:13) newer than every WP16b-2 source edit (19:35–19:36).
Fresh runs: `ux.json` (fail [], errors []), `a11y.json` (fail [], errors [], deferred []), `res.json` (fail []), `wp3.json`
(failed []), `demo.json` on dist-demo :4177 (fail []). Own captures: `cap/` (`scripts/ad-tree.mjs`: first screen 1280x720 /
1920x1080 at UI 100/150; tree eras I–III at 1280x720, 1920x1080, 1280x800 x UI 100/125/150), crops `v/`, probes `ms/`, `fx/`, `pp/`.

### Gates
| gate | result | evidence |
|---|---|---|
| first screen = one prompt | PASS: t0 crank prompt only; 15 clicks hint callout + TECH INDEX pulse, no count chip; after first buy NEXT goal line only (1280x720, 1920x1080, UI 100/150) | `ux/ux-A1-prompt.png`, `ux/ux-A2-hint.png`, `ux/ux-A5-goal.png`, `cap/fs-*-c15.png`, `cap/fs-*-goal.png` |
| purchased node level/cost | PASS: sand on rust-dark, crisp at 1:1 and 3x | `cap/tree-1280x720-100-e1-purchased.png` |
| milestone text | PASS: ink on amber -> amber-dim plate, readable at every scale (old rust-dark stop gone) | `v/c_ms_plain_1080.png` |
| milestone selected / keyboard focus | **FAIL (F1)**: inset ink ring sits next to the dark graph, so it reads as a 2 px smaller plate, not a selection. At 1:1 a selected milestone looks unselected; focus (4 px ink) reads as a dark rim only | `v/c_ms_selected_1080.png`, `v/c_ms_focus_1080.png`, `v/ms_cur_vs_A.png` |
| insufficient PURCHASE | **FAIL (F2)**: amber-dim text + amber-dim frame is now the brightest frame in the pane, it outshines an affordable PURCHASE (rust frame). First tree a new player sees | `v/buy_states.png`, `ux/ux-A3-tree-buy.png` |
| panel stability | **FAIL (F3, pre-existing, store-visible)**: UI 100 panel top moves 42..72 CSS px (1280x720) / 64..109 device px (1920x1080) and PURCHASE 476..506 as selection or tab changes; UI 125/150 graph box resizes on every node click (242..297 device px at 150) | `pp/panel-probe.json` (cur rows) |
| in-tree toast | PASS at UI 100 (clear of panel). UI 125/150: clear of heading, readout, tabs, CLOSE, PURCHASE; box overlaps the panel's top-left frame corner (N1) | `ux/ux-T-*.png`, `v/c_T720_150_toast.png`, `v/c_T720_125_toast.png` |
| PURCHASE + feedback row | PASS at 100/125 (no dead gap); 150 feedback wraps to 4 lines in the narrow column (N3) | `cap/fs-1280x720-100-tree-buy.png`, `cap/fs-1280x720-150-tree-buy.png` |
| graph centred | PASS: era I/II node extents equal gaps (e.g. 1080p era II 158/160 px) | `ux/ux-A3-tree-buy.png`, `pp/pp-fix5-1920x1080-100-2-substationBlueprint.png` |
| demo END card unchanged | PASS: card rows y 240–480 identical to pre-WP16b-2 run (`scratchpad/mainint2/demo2/demo-B4-card.png`); 6948 diff px only in the animated scene above/below | `demo/demo-B4-card.png`, `v/demo_card_diff.png` |

### Fixes (all `src/ui/techTree.css`, palette vars only, ~+150 B raw)
- F1 milestone rings: `.tech-node.is-milestone.is-selected { outline: none; box-shadow: inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--haze); }`
  and `.tech-node.is-milestone:focus-visible { box-shadow: inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--haze), inset 0 0 0 6px var(--ink); }`
  (ink rim against the plate 6.4:1, haze line against the ink rim; reads as a frame like the haze ring of plain nodes).
- F2 insufficient frame: `border-color: var(--rust-dark)` (era-tab frame) instead of amber-dim; text stays amber-dim (5.70:1), no opacity.
- F3 stable panel: `#tech-panel` gets `height: min(94%, 640px)` (max-height 94 % kept); `#tech-detail` `flex: 1 1 0; min-height: 8em`
  (was `1 1 auto` / `5.5em`). UI 100: panel, PURCHASE and graph never move, detail never scrolls (eras I–III, 9 selections), panel top
  40 CSS px so the toast (bottom 30) stays above the frame. UI 125/150: graph keeps one height per era (333 / 269 device px at 1280x720).
- Verification script: `scripts/verify-r0.mjs` (scratch). Current build: 21 fails (F1 x10, F2, F3 x10). Same build with the fix CSS
  injected (`AD_INJECT=scripts/fix-r0.css`): fail [] (`vr0-inject.json`, shots `vr0-inject/`).

### Notes (S3, no block)
- N1: at UI 125/150 (and 1280x800 125/150) the panel sits at its 94 % cap, so the compact toast box overlaps the panel's top-left frame
  corner (toast left 20–36 vs frame 26–38). Never covers text; transient. WP16b-3 may anchor it to the frame.
- N2 (pre-existing): UI 150 at 16:9 leaves ~1.7 graph rows and a scrolling detail; tabs wrap once 4+ eras are named. Functional
  (scroll, PURCHASE pinned). WP16b-3 look at the Deck 150 case.
- N3: UI 150 feedback beside PURCHASE wraps to 4 lines (about the height of PURCHASE + 2 stacked lines). Accept.
- N4: the haze ring stops at the octagon's cut corners (bracket look). Accept, matches the clipped plate.
- N5: first-click two-toast burst unchanged (out of scope, WP16b-3).

### Art Director round 1 (2026-10-23)
Verdict: **FIXES REQUIRED** (1 CSS fix F4 + 1 polish F5, one file `src/ui/techTree.css`, about +35 B raw). No asset repair. Evidence root
`.../scratchpad/WP16b-2/ad1/`. dist and dist-demo (21:37) newer than the r0 fix edit (`techTree.css` 21:17). Fresh runs: `ux.json`
(fail [], errors [], all WP16b-2 checks true incl. 12 `T_*`), `a11y.json` (fail [], errors [], deferred []; `C_trap`, `C_trap_back`,
`H_*` true), `res.json` (fail []), `wp3.json` (failed []), `demo.json` on dist-demo :4177 (fail []; server stopped), `vr1.json` (r0
F1–F3 checks on the built game: fail []). Own: `cap/` (first screen + tree eras I–III, 3 viewports x UI 100/125/150), `sweep/`
(`scripts/detail-sweep.mjs`: every node of every reached era at S9/S12/S14/S15, 3 viewports x 3 scales), `servo/`, `hdr/`, crops `v/`.

| gate | result | evidence |
|---|---|---|
| r0 F1 milestone rings | PASS: selected = ink rim + haze line, reads as a frame at 1:1 (720p, 1080p); focus adds an inner ink line | `v/c_ms_selected_100.png`, `v/c_ms_selected_1080.png`, `v/c_ms_focus_100.png` |
| r0 F2 insufficient PURCHASE | PASS: amber-dim text, rust-dark frame, opacity 1; quieter than an affordable PURCHASE | `vr1/v-F2-insufficient.png`, `ux/ux-A3-tree-buy.png` |
| r0 F3 stable panel | PASS: UI 100 panel top 40/60/80, PURCHASE and graph fixed over 50 nodes x 5 eras; UI 125/150 one graph height per era | `vr1.json`, `sweep/sweep.json` |
| first screen = one prompt | PASS: t0 crank prompt only; 15 clicks hint + pulse, no chip; after first buy goal line only (1280x720, 1920x1080, UI 100/150) | `ux/ux-A1-prompt.png`, `ux/ux-A2-hint.png`, `ux/ux-A5-goal.png`, `cap/fs-1920x1080-100-*.png` |
| purchased / milestone node text | PASS: sand on rust-dark and ink on amber -> amber-dim, crisp at 1:1 and 3x | `v/c_purch_100.png`, `v/c_ms_selected_1080.png` |
| detail pane at UI 100 | **FAIL (F4, from r0 F3)**: the fixed 640 px panel clips Crank Servo (era IV) while short of ME: `NEED ... MORE ME` cut mid-glyph at 1280x720, 1920x1080, 1280x800 (overflow 7 px = the reserved shortfall row). Only node over at UI 100 | `servo/servo-1280x720-100.png`, `v/servo_before_after.png` (top), `sweep/sweep.json` |
| in-tree toast | PASS: one 13 px line; clear of heading, readout, tabs, CLOSE, PURCHASE at UI 100/125/150 (720p, 1080p); UI 100 above the panel frame | `ux/ux-T-*.png`, `v/c_toast_1080_100.png` |
| PURCHASE + feedback row | PASS at UI 100 (one row, no gap: buy [721,474,904,512], feedback [916,475,1212,511]); UI 150 see N3 | `cap/fs-1280x720-100-tree-buy.png` |
| graph centred | PASS: era I node gaps 184/184 px (720p), 276/277 px (1080p) | `ux/ux-A3-tree-buy.png`, `vr1/v-F1-1920x1080_100-selected.png` |
| demo END card unchanged | PASS: 0 diff px inside the card rect vs pre-WP16b-2 (`scratchpad/mainint2/demo2/demo-B4-card.png`), r0 and EM shots; diffs only in the animated scene | `demo/demo-B4-card.png`, `v/demo_card_diff.png` |

Fixes (all `src/ui/techTree.css`):
- F4: `#tech-panel` `height: min(94%, 640px)` -> `min(94%, 648px)`; `#tech-detail` `padding-top: 10px` -> `6px`. Injected
  (`scripts/fix-r1.css`): Crank Servo NEED line fully shown, overflow 0 with 5 px spare on 3 viewports (`servo-fix/`); UI 100 sweep 0
  overflow over 78 nodes (`sweep-fix/sweep.json`); r0 checks pass (`vr1-inject.json`: panel top 36/54/76 still, toast bottom 29.6 < 36).
- F5 (S3 polish): `#tech-title { white-space: nowrap; }`. Era V at UI 150 the heading broke into `TECH` / `INDEX` beside the
  5-energy readout; with nowrap it stays one line, header height unchanged, graph +6 px (`hdr/hdr-cur-1280x720-150.png` vs
  `hdr/hdr-fix-1280x720-150.png`, `hdr-cur.json` / `hdr-fix.json`).

Notes (S3, no block, WP16b-3):
- N2 (update, pre-existing): UI 125: 42 of 50 nodes overflow the detail by 16–76 device px; UI 150: 48 of 50 by 25–87 px (locked
  milestones lose their requirement list below the fold; the pane scrolls, headless shots hide the thin scrollbar). Before WP16b-2 the
  150 case was the same (38–82 px, r0 `pp/panel-probe.json` cur rows) plus a jumping graph. WP16b-3: side-by-side graph/detail at
  UI >= 125, or shorter detail copy.
- N3 (update): UI 150 first-purchase feedback wraps to 5 lines beside PURCHASE and pushes LV ~100 px down until the next selection.
- N6: UI 150 era V: CLOSE [ESC] wraps to 2 lines and the readout puts `???` alone on line 2 (`hdr/hdr-fix-1280x720-150.png`). Accept.
- N1, N4, N5 unchanged.

### Art Director round 2 (2026-10-24)
Verdict: **RELEASE-READY**. No fix, no asset repair. Evidence root `.../scratchpad/WP16b-2/ad2/`. dist (23:12) and dist-demo (23:13)
newer than the r1 fix edit (`techTree.css` 22:49); built css carries `min(94%,648px)` and `#tech-title{…white-space:nowrap…}`;
:4174 serves `index-ahXaeu7d.css`. Bundle: full css 39.7/44 KB, demo css 42.5/44 KB (D11 caps 41.0 / 43.5 met). Fresh runs:
`ux.json` (fail [], errors []; `A_one_prompt_t0/hint/goal`, `A_hint_chip_hidden`, `A_chip_back`, `A_feedback_beside_buy`,
`D_100_graph_centered`, 12 `T_*` true), `a11y.json` (fail [], errors [], deferred []; `C_trap`, `C_trap_back`, `C_contrast`, all `H_*`
true; one indeterminate = title version label, unchanged), `wp3.json` (failed []), `res.json` (fail [], 6 viewports x UI 100/150),
`demo.json` on dist-demo :4177 (fail [], errors []; server stopped). Own: `cap/` (first screen 2 viewports x UI 100/150; tree eras I–III,
3 viewports x 3 scales), `servo/`, `hdr/`, `sweep/` (166 node selections per viewport, S9/S12/S14/S15), crops `v/`.

| gate | result | evidence |
|---|---|---|
| r1 F4 Crank Servo NEED line | PASS: `NEED 1M MORE ME` fully shown, overflow 0, 5 px spare (shortfall bottom 663 vs detail 668 at 720p; 993/1002 at 1080p; 703/708 at 1280x800) | `servo/servo-1280x720-100.png`, `v/c_servo_100.png`, `servo.json` |
| UI 100 detail / panel stability | PASS: 0 overflow on every node of every reached era, 3 viewports x 4 stages; panel top 36/54/76, PURCHASE top 466/697/506, graph 298/446/298 device px, one value each | `sweep/sweep.json` |
| r1 F5 heading one line | PASS: `TECH INDEX` one line at UI 150 era V (title height 29 px at 720p = one line; was 2 lines in r1 `hdr-cur`) | `hdr/hdr-cur-1280x720-150.png`, `hdr.json` |
| first screen = one prompt | PASS: t0 crank prompt only; 15 clicks hint callout + pulse, chip hidden (`::after` none); after first buy NEXT goal only (720p, 1080p, UI 100/150) | `ux/ux-A1-prompt.png`, `ux/ux-A2-hint.png`, `ux/ux-A5-goal.png`, `cap/fs-1920x1080-*-{t0,c15,goal}.png` |
| purchased / milestone text | PASS: sand INSTALLED/LV on rust-dark, ink on amber -> amber-dim, crisp at 1:1 and 2–3x | `v/c_purch_100.png`, `v/c_ms_selected_1080.png` |
| milestone selected / focus | PASS: ink rim + haze line reads as a frame; focus adds the inner ink line (`:focus-visible` true, 9 configs) | `v/c_ms_selected_1080.png`, `v/c_ms_focus_1080.png`, `cap/ad-tree-all.json` |
| PURCHASE + feedback row, insufficient | PASS: one row, no gap (720p buy [721,466,904,504], feedback [916,467,1212,503], LV top 508); insufficient = amber-dim text, rust-dark frame | `v/c_buyrow_100.png`, `ux/ux-A3-tree-buy.png` |
| in-tree toast | PASS: one 13 px line, bottom above the title top in 9 configs (e.g. 720p@150 toast [24,6,250,44] vs title top 60); UI 100 above the panel frame | `ux/ux-T-*.png`, `v/c_toast_720_100.png`, `cap/ad-tree-all.json` |
| graph centred / wide screens | PASS: era I centred at 720p, 1080p, 1280x800, 3440x1440 | `ux/ux-A3-tree-buy.png`, `res/res-3440x1440-100-tree.png` |
| demo END card unchanged | PASS: 0 diff px inside the card rect [360,243,921,477] vs pre-WP16b-2 `scratchpad/mainint2/demo2/demo-B4-card.png`; diffs only in the animated scene | `demo/demo-B4-card.png`, `v/demo_card_diff.png` |

Notes (S3, no block, carried to WP16b-3 final audit): N2 UI 125/150 detail scroll (125: up to 76 px, 150: up to 87 px; same as r1) and,
at UI 150, the graph shows ~1.7 rows (partial third row; a scrolled graph can cut the top row) — side-by-side graph/detail or a height-fit
zoom at UI >= 125 is the WP16b-3 candidate, check on Deck 1280x800 @150; N1 toast over the panel frame corner at UI 125/150; N3, N4, N5,
N6 unchanged.

## WP16b-3 — final release audit (Art Director round 1, 2026-10-24)
Verdict: **FIXES REQUIRED** (F1 data `src/data/steamFx.ts` + test, F2 `src/ui/toasts.css`, F3 `src/ui/systemMenu.css`; about +280 B raw css).
No asset repair (WP16b-1 N1 declined).

Evidence root `.../scratchpad/WP16b-3/ad1/` (`cap/` 140 full + 16 demo PNGs and `probe-*.json`, `crops/`, `sheets/`, `g7/`, `g7-demo/`,
`card/`, `menu/`, `menu-demo/`, `lance/`, capture tools in `scripts/`). Build under audit: dist 02:27:14 (`index-C6mqOGny.js`,
`index-C9C___4e.css`, served by :4174), dist-demo 02:27:26 (`index-DliD1n07.js`); newest WP16b-3 source edit `store-shots.mjs` 01:54:29
(`WorldScene.ts` 01:54:16; docs 02:15). Nothing newer than dist, so no AD build. Demo preview on :4177 started twice by the AD, stopped,
netstat free afterwards; :4174 untouched.

Smoke runs used (EM `val3/`, 02:29–02:41, same build): a11y, ux (incl. case M), resolutions, e2e-full, wp3, wp2, showcase, store-shots
SIZES=1080, demo.mjs on :4177: each fail [] errors []. Store set judged: `store-final2/` (02:18, build 02:00 = same hashes): 19 + 19 PNGs,
28 `*_no_spoiler` + 8 `*_plate_cap` true, `store_top5_complete` true, missing [].

Capture matrix (`scripts/ad-cap.mjs`, `?debug=1`, fresh context per K, deviceScaleFactor 1; 20 screens each: title, first, e1, e2-card, e2,
e3-card, e3, e4, e5, tree-e1/e3/e5 at S15, menu-system/settings/stats, finale-reveal (56 s), finale-typed (64.0 s), postgame, photo,
cycle-confirm). Demo (:4177): title, tree, teaser-e5 (`showcaseSeek(6.0)`), card.

| K | viewport | UI | canvas | HUD panel / buttons | demo |
|---|---|---|---|---|---|
| K1 | 1920x1080 | 100 | 0,0–1920,1080 | 24,24–471,504 / 1338,999–1896,1056 | yes |
| K2 | 2560x1440 | 100 | 0,0–2560,1440 | 32,32–629,669 / 1784,1332–2528,1408 | — |
| K3 | 3440x1440 | 100 | 440,0–3000,1440 | 472,32–1069,669 / 2224,1332–2968,1408 | — |
| K4 | 1280x800 | 100 | 0,40–1280,760 | 16,56–314,374 / 892,706–1264,744 | yes |
| K5 | 1280x800 | 150 | 0,40–1280,760 | 24,64–471,544 / 698,679–1256,736 | yes |
| K6 | 1280x720 | 100 | 0,0–1280,720 | 16,16–314,334 / 892,666–1264,704 | yes |
| K7 | 1280x720 | 150 | 0,0–1280,720 | 24,24–471,504 / 698,639–1256,696 | — |

### Gates
| G | result | evidence |
|---|---|---|
| G1 UI inside canvas, no box over text | **FAIL (F2)**: at UI 125/150 the toast stack (z 200) lands on the era card (z 80) and covers its title (`ERA III · PRE…`, WELCOME BACK box) or its frame (MILESTONE box), every viewport (card-probe `toastOverCard` true at 1280x720, 1280x800, 1920x1080 @150 and 1280x720 @125; false @100). Everything else PASS: 582 UI boxes in 140 shots + 20 in 16 demo shots, 0 outside the canvas | `cap/full-1280x800-150-e3-card.png`, `crops/k5-e3-card-x2.png`, `crops/k5-e2-card-x2.png`, `card/cur-*.png` |
| G2 text legible, no unintended truncation | **FAIL (F3)**: web/demo build, SYSTEM tab at UI 150 on 1280x720 / 1280x800: `.sys-body` 262 / 255 CSS px, the version footer `v0.9.0 · SAVE v2` is cut through mid-glyph (also in the EM run `val3/ux/ux-D-150-menu-system.png`). Desktop host (QUIT row): footer fully below the fold, clean. Other overflow is designed: settings/stats tabs scroll, tree detail scroll at 150 (N2), sr-only `finale-sr` | `crops/k7-menu-system-version-x3.png`, `menu/menu-cur.json`, `menu-demo/menu-cur.json` |
| G3 art integrity (era I–V, postgame) | **FAIL (F1)**: the lance puff column sits on the valve wheel and orange flange in the store frames 07 / 09 (1080 and 2160) and in every era V / postgame frame. Machine art otherwise intact at K1 1:1 and store 2160: belts tangent and wrapping, shafts in bearings, pipes joined, no seams | `crops/07-lance-2160-x4.png`, `crops/09-lance-1080-x8.png`, `crops/k1-postgame-drive-x2.png`, `crops/k1-postgame-left-x2.png` |
| G4 HUD placement, ultrawide, letterbox | PASS: panel top-left and buttons bottom-right inside the canvas at K1–K7; K3 canvas 440–3000 with HUD anchored to it; letterbox themed (warm dark texture #130e0b / #150f0c / #0f0c0a), K4/K5 40 px bars same | `cap/full-3440x1440-100-e5.png`, `crops/k3-letterbox-edge.png`, `cap/probe-full-*.json` |
| G5 store spoilers | PASS: 28 `*_no_spoiler` true; 07 plate `RES?OR?` (1080, 2160), 06 plate + plaque `PRIMARY FUNCTION: RES?OR?`, 09 plate `RES?OR?` (1080, 2160); no RESTORE / RESTORATION ENGINE text in any store or alt frame (07, 06, 03, 05, 09, 04 read at 1080, plate/plaque crops at 2160) | `crops/g5-07-plate-1080-x8.png`, `crops/g5-07-plate-2160-x4.png`, `crops/g5-06-plaque-1080-x3.png`, `crops/g5-06-plaque-2160-x2.png`, `crops/g5-06-plate-1080-x8.png`, `crops/g5-09-plate-1080-x8.png`, `crops/g5-09-plate-2160-x4.png` |
| G6 demo | PASS at K1/K4/K5/K6: teaser plate frame 2 (`plateFrame` 2, t 6.16, era 5), caption `PRIMARY FUNCTION: RES?OR?`, END OF DEMO card intact (panel 540,366–1380,714 at K1), tabs `ERA I · ME / SIGNAL ? / FULL GAME` x3 | `cap/demo-*-teaser-e5.png`, `cap/demo-*-card.png`, `cap/demo-*-tree.png`, `sheets/sheet-demo.png` |
| G7 Deck tree at S15 | PASS: K4 and K5 eras I/III/V: PURCHASE inside the panel and hit-testable (K5 726,534–1000/1029/1043,591), selected node inside the graph viewport, tabs not clipped (K5: two rows), detail scrolls to its end (K5 35/56/35 px); K4 no scroll | `g7/full-1280x800-150-tree-e1.png`, `g7/full-1280x800-150-tree-e5.png`, `g7/full-1280x800-150-tree-e3-detail-end.png`, `g7/full-1280x800-100-tree-e5.png`, `g7/g7-full.json` |
| G8 store order | PASS: WP16b-1 order confirmed (below) | `store-final2/store-top5.json` |

No_spoiler checker gap: not real, no fix. `document.body.innerText` returns the text that is rendered, which is what the PNG shows; in a
clean shot the HUD is hidden and not in the image. The check also asserts the `#hud-plaque` text (textContent, read even when hidden) and
the plate frame; canvas text holds no RESTOR string except the plate (frame-checked); the only CSS generated text is the count chip.

Lance study (WP16b-1 N2): the puff (16 px sheet, rises 20 art px, drifts +4 art px/s, scale 1 → 1.75, fade from t 0.75) can only rise
32 px between the lance bottom (y −382) and the deck underside (−414); siphon capsule bottom −418. Spawn (20, −384) clears the capsules but
the column climbs straight over the valve (38 wheel cells covered at full alpha; avg 11.4). Clean background rebuilt from 81 frames at
2160 (`lance/bg-lance.png`, lance sprite placed at its measured spot, art (20,−414) = clip (120,138), 3 px per art px), mock-ups of 5 spawn
points with the real sheet and motion (`crops/lance-mock-2160-x2.png`, `scripts/lance_sim.py`): (28, −385) starts at the right end of the
flange collar (y −390..−388), rises beside the valve body, wheel overlap 0.4 avg / 4 cells max, capsule 0, top −417 (deck bar only, faded).
Row 1 of the mock (20, −384) matches the shipped frames, so the model is faithful.

### D7 triage (all 10 notes)
| note | decision | reason |
|---|---|---|
| WP16b-2 N1 in-tree toast over tech panel frame corner, UI 125/150 | accept | transient, frame corner only, never text (`g7/full-1280x800-150-tree-e1.png`) |
| WP16b-2 N2 UI 150 tree cramped, Deck 1280x800 @100/@150 | accept | G7 holds at K4/K5; graph ~1.5 rows scroll, tabs wrap, PURCHASE pinned; no redesign (D8) |
| WP16b-2 N3 UI 150 PURCHASE feedback wraps 4–5 lines | accept | first purchase only, clears on next selection, not store-visible |
| WP16b-2 N4 milestone haze ring cut at octagon corners | accept | matches the clipped plate (bracket look) |
| WP16b-2 N5 first-click two-toast burst | accept | two stacked toasts, no overlap, legible (`val3/ux/ux-M1-cycle-prompt.png`); no logic change |
| WP16b-2 N6 UI 150 era V CLOSE wraps, `???` alone on line 2 | accept | legible designed wrap (`g7/full-1280x800-150-tree-e5.png`), not store |
| WP16b-1 N1 era V horizon-glow band edges dither | decline | the whole era V sky is hard-stepped strata; a dither on the glow layer alone would be the odd layer; reads as dusk glow at store size (`crops/07-horizon-1080-1x.png`); no PNG change at the final gate |
| WP16b-1 N2 lance puff over siphon capsule 2L | **fix F1** | (20, −384) clears the capsules but covers the valve wheel; (28, −385) vents beside the valve |
| WP16b-1 N3 bird at frame edge in 08-finale-reveal-hud | accept | press kit only |
| WP16b-1 N4 guidance prompt in 01-hud; tree's empty lower right | accept | 01 not in the store set; 05 lower right is open space, the graph stays balanced |

New notes (S3, accepted): era card covers the HUD panel's right frame at UI 150 (card left 383/400 vs panel right 443, 8 px clear of the
`›PR` text) — transient, no text; the finale reveal box widens 404 → 422 px as line 5 types (press kit only); cycle confirm CANCEL key has
a blank key cap (frame 0, no icon in `ui.icons16`), reads as the neutral key, not store-facing.

### Store set (`store-final2/`)
Order confirmed (G8): 1 `07-era5-ruined-clean` (strongest silhouette, violet), 2 `06-era4-spire-hud` (HUD readout, plaque capped),
3 `03-era2-generator-hud` (milestone toast, story hook), 4 `05-tree-era3-hud` (the tech tree), 5 `09-postgame-portrait-clean` (blue/green
payoff, plate capped, no HUD); alt `04-era3-boiler-hud` for a strict no-reveal set. Five palettes, no text spoiler. `store-final2/` is
not the final set: F1 changes the lance puffs in 07 and 09, so T10 shoots a new folder after the fix wave and AD round 2 judges it.
F2 and F3 do not touch store frames (the era card is dismissed before every shot, the menu is never shot).

### Fixes
- F1 `src/data/steamFx.ts` emitter `lance`: `at: [{ x: 20, y: -384 }]` → `at: [{ x: 28, y: -385 }]`; comment says the spawn sits on the
  right of the lance flange collar. `src/data/steamFx.test.ts` lance expectation `[{ x: 20, y: -384 }]` → `[{ x: 28, y: -385 }]`.
- F2 `src/ui/toasts.css`: the six `body:has(#tech-overlay.is-open)` selectors of the WP21 / WP16b-2 compact rules (newest toast only, body
  hidden, padding 3px 10px, one 13 px title line) → `body:has(#tech-overlay.is-open, #era-card.is-shown)`; the position rules (top-left,
  max-width) stay tree-only. Injected (`scripts/fix-r1.css`): `toastOverCard` false at 6 configs, one title line top-right while the
  card is up, full stack back after it (`card/fix-1280x800-150-e3-card.png`).
- F3 `src/ui/systemMenu.css`: add `#sys-feedback:empty { min-height: 0; }` after the `#sys-feedback` rule. Injected: web 1280x720 /
  1280x800 @150 `.sys-body` fits (255 / 255, footer inside); desktop host footer stays fully below the fold (293 / 255); UI 100/125 unchanged.

### Art Director round 2 (2026-10-24)
Verdict: **RELEASE-READY**. F1, F2 and F3 landed as specified and are verified on fresh builds; final store set `store-final3/` is
store quality with no spoiler. Evidence root `.../scratchpad/WP16b-3/ad2b/` (`crops/`, `card/`, `card-demo/`, `menu/`, `menu-demo/`,
`menu-save/`, `cap-demo/`, `diff1080/`, `diff2160/`, tools in `scripts/`); round 1 probes re-run without injection.

Build under audit (built by the AD after the fix wave): dist 03:33:10 (`index-CBc2E7U9.js`, `index-BLzpQPog.css`, served by :4174),
bundle budget PASS (app js 402.8 / 460 KB, css 40.0 / 44 KB); dist-demo 03:33:24 (`index-BpnQFyiE.js`, same css + `demoEnd-T7IDDcWp.css`),
PASS (app js 404.8 KB, css 42.8 / 44 KB). Newest source edit `src/ui/toasts.css` 03:32:09 (`steamFx.ts` 03:31:52, `systemMenu.css` 03:32:05),
older than both builds. `tsc --noEmit` clean (in build); `npx vitest run src/data/steamFx.test.ts src/game/math/steamFx.test.ts
src/game/math/perfBudget.test.ts` 64 pass. Demo preview :4177 started once by the AD, stopped, no LISTENING afterwards; :4174 untouched.

| F | fix as landed | result | evidence |
|---|---|---|---|
| F1 | `src/data/steamFx.ts` lance `at` (20, −384) → (28, −385); test expectation same | **PASS**. Valve wheel fully visible in 07 and 09 clean: 351 of 351 wheel px at 2160 (`store-final2`: 18 and 9). Puffs start at the right end of the flange collar and rise beside the valve body; siphon capsules and their bases clear; puff top stays under the deck girder (1080: y ≈ 373 vs girder 369). Same in 07 hud and in the demo teaser at era V | `crops/f1-lance-before-after.png` (top `store-final2`, bottom `store-final3`; 07 / 09 at 1080 ×8 and 2160 ×4), `crops/07-lance-1080-x8.png`, `crops/09-lance-2160-x4.png`, `crops/07hud-lance-1080-x8.png`, `crops/demo-teaser-lance-1080-x8.png` |
| F2 | `src/ui/toasts.css` compact rules under `body:has(#tech-overlay.is-open, #era-card.is-shown)`; position rules tree-only | **PASS**. card-probe: `toastOverCard` false in 12 / 12 (1280x720 @100/125/150, 1280x800 @150, 1920x1080 @100/150, era II and III cards) and 6 / 6 era II cards on the demo build. While the card is up: one title line top right (RECORD LOGGED / WELCOME BACK); after it the normal stack with bodies returns; the demo teaser (no card) keeps the full stack. Rects equal the round 1 injection | `crops/f2-k5-e3-card-x2.png`, `crops/f2-k5-e2-card-x2.png`, `crops/f2-1280x720-125-e3-card-x2.png`, `crops/f2-demo-k5-e2-card-x2.png`, `card/card-r2.log`, `card-demo/card-r2demo.log` |
| F3 | `src/ui/systemMenu.css` `#sys-feedback:empty { min-height: 0; }` | **PASS**. menu-probe: web 1280x720 / 1280x800 @150 `.sys-body` 255 / 255, footer `v0.9.0 · SAVE v2` inside and whole; 1920x1080 @150 258 / 258; UI 100 / 125 unchanged; demo build the same (`v0.9.0 · DEMO · SAVE v2`); desktop host footer fully below the fold (293 / 255). Rects equal the round 1 injection (`ad1/menu/menu-fix.json`) | `crops/f3-system-1280x720-150-x3.png`, `crops/f3-system-1280x800-150-x3.png`, `crops/f3-demo-system-1280x720-150-x3.png`, `menu/menu-r2.json`, `menu-demo/menu-r2demo.json` |

Final store set `store-final3/` (C7, one run 03:33–03:36 on the build above, SIZES / VARIANTS unset, exit 0): `fail []`, `errors []`,
115 / 115 checks ok; 38 PNGs (`1080/` 19 at 1920×1080, `2160/` 19 at 3840×2160); `store-top5.json` sizes `["1080","2160"]`, plateCap
`substationBlueprint`, missing `[]`; 28 `*_no_spoiler` true (plate frame ≤ 2, plaque `PRIMARY FUNCTION: RES?OR?` on 03–07 and 09, hits `[]`),
8 `*_plate_cap` true (01 / 10 / 09 `substationBlueprint`, 08 null), `store_top5_complete` true. Crops (C7 boxes, framing unchanged):
`store-final3/crops/07-plate-1080.png`, `07-plate-2160.png`, `06-plate-1080.png`, `06-plaque-1080.png`, plus `09-plate-1080.png`,
`09-plate-2160.png`, `06-plaque-2160.png`: every plate reads `RES?OR?`, both plaques `PRIMARY FUNCTION: RES?OR?`. Store order unchanged
(G8): 1 `07-era5-ruined-clean`, 2 `06-era4-spire-hud`, 3 `03-era2-generator-hud`, 4 `05-tree-era3-hud`, 5 `09-postgame-portrait-clean`;
alt `04-era3-boiler-hud`. All 6 looked at 1080 and 2160: no RESTORE / RESTORATION text, no art defect, valve wheel clear in 07 / 09.
Pixel diff vs `store-final2/` is animation phase only (gears, belts, puffs, sparks, clouds, floaters); framing and HUD unchanged
(`diff1080/`, `diff2160/`). `store-final2/` is superseded; `store-final3/` is the set for the Director to send.

New notes (S3, accepted, no block):
- R2-N1: web / demo build, UI 150 at 1280x720 / 1280x800: for 1.6 s after SAVE (`STATE WRITTEN`, `saveFeedbackMs`) the feedback row is
  back, `.sys-body` 262 / 255, and the version footer is cut at the bottom edge until the line clears (`menu-save/r2-1280x720-150-saved.png`,
  `crops/f3-save-feedback-1280x720-150-x3.png`). Transient, body scrolls, info text only; the desktop host keeps the footer below the fold in
  both states. Post-demo option: `#sys-feedback:not(:empty) + #sys-footer { margin-top: 0; }` (footer is the next sibling; 262 − 8 = 254 fits).
- R2-N2: a fresh lance puff appears about 2 art px right of the collar, then grows and drifts; reads as a vent jet (steam is clear for a
  short way out of a port). Accepted.

## WP22 — part tiers audit

Art Director round 1 (AD5, plan AD4), 2026-10-24. Verdict: **FIXES REQUIRED** (F1, F2, F3 must land; F4, F5 should land; F6 optional).
The tier art itself is release quality: 91 / 91 variants pass G1-G5, every era I-II track reads at every tier at zoom 1 and 0.5, the
heartbeat is in phase on all 13 pulse hosts, decals sit correctly under the belts. The defects are in the beat FX layering, the
bolt-down points and the ring 1 bead after the alignment. All are code / data fixes for workers; no PNG changes.

Evidence root `<A>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22/ad/audit/`
(tools in `<A>tools/`: `kit.mjs`, `beat.mjs`, `stages.mjs`, `tracks.mjs`, `tracks2.mjs`, `ring.mjs`, `flyins.mjs`, `hb.mjs`, `binput.mjs`, `ghostmock.py`, `crops.py`, `sheet.py`, `mounts.py`).
Beat frames use Playwright's fake clock (`page.clock`): paused, Phaser's smoothed delta flushed with 15 frames, then stepped 16 ms per frame,
so every grab is an exact beat time (screenshots take 0.55-1.4 s on this box, so real-time grabs cannot hit 60 ms steps).

Build under audit: worktree `C:/Users/sanan/wedtmd-art` (branch `claude/tiers-wp22`) after F1-F6; typecheck clean; `npx vitest run` 126 files,
3711 pass / 16 skipped. `npm run build` (dist 18:49:47; newest source edit 18:46:10): app js 433.6 / 460 KB, css 40.0 (<= 40.1), public 1724.0 KB (<= 2700), bundle budget PASS;
`npm run build:demo` (dist-demo 18:50:10): app js 435.6 KB, css 42.8 (<= 42.9), PASS. Full build on :4175 (existing preview, untouched); demo on :4176 started by
the AD (netstat empty before), stopped after (`taskkill //PID 15048 //T //F`, netstat empty).

Step 0 gate (`scripts/smoke/tiers.mjs`): :4176 demo `fail []`, `errors []` (A-E, H; F/G skipped by design). :4175 full `fail ["B_input"]`,
`errors []`, every other check true (A, C, D, E, F, G, H). B_input is the smoke script, not the build: `snap(0)` runs before the crank
click, and a full screenshot takes 0.55-1.4 s here, so the click lands after the 900 ms beat (`activeAtClick 0`, clicks +1; 3 / 3 runs;
on :4176 it passed with the click at about 900 ms). Direct probe without the screenshot (`<A>tools/binput.mjs`): click 330-590 ms after
Esc, `activeAtClick 1`, `activeAfterClick 1`, totalClicks +1, 3 / 3. Input during a beat is never blocked. Fix F5. Audit continued.

### G1-G5 per host
G1-G3 = `python -I scripts/art/tiers/check_gates.py --report <A>gates/gates-ad5.md --g4 .../WP22/ad/final/g4.json`: files 91, bytes 518,591,
**failures 0** (142 PASS rows: per file and per track tier step). G4 = AD4f records (`WP22/ad/final/g4.json`, all 91 lint 0 errors) plus an AD5
re-measure via `pixelart_workbench` (uploads `<A>g4/uploads.txt`): 14 scores identical to the records (worn-motor-t4 91.7, piston-block-t5
96.0, transformer-t5 95.1, motor-retrofit-t2 92.0 / MK I 93.8, condenser-t2 95.3, bellows-t2 94.5 / 96.3, coil-ring-1-t2 100, steam-lance-t3
96.6, flywheel-pedestal-t2 97.5 / 98.3, decals/flywheel-rim-3 96.0, spire-wave-t2..t5 88.0 / MK I 88.0); lint 0 errors on spire-wave-t2..t5,
motor-retrofit-t2, bellows-t2, worn-motor-t4, flywheel-rim-3. Note: `spire-wave-t2..t5.png` were regenerated at 17:14, after the AD4f G4
records (16:14; md5 differs from `ad/p2/md5-post2.txt`); re-measured: scores and lint unchanged (orphan_pixel warnings 960-1060 = the dotted
field lines; MK I has 1135). The regenerated set climbs 3 / 4 / 5 / 6 / 7 antinodes MK I to MK V (monotonic, physics-true).
G5 = live in-game captures on the wired build (not composites).

| host (track, tiers) | variants | G1-G3 | G4 lint / score vs MK I | G5 in game (zoom 1 / 0.5) | evidence |
|---|---|---|---|---|---|
| worn-motor (motorTuning, 5) | t2-t5, t5b | PASS | 0 / >= 90.3 vs 91.7 | PASS: patches, iron bands, brass hoops + cowl, eye lamp; Era I backdrop brass reads brass (risk 2) | `<A>tracks/rows/track-motorTuning.png` |
| motor-plinth (motorTuning, 5) | t2-t5 | PASS | 0 / >= 91.9 vs 90.2 | PASS | same |
| gear-large, gear-small, pulley-main (gearRatio, 3) | t2, t3 + rot | PASS | 0 / sheets >= MK I | PASS: derust, polished; rim brass at 0.5 | `<A>tracks/rows/track-gearRatio.png` |
| decal gear-rim (gearRatio t3) | 1 | PASS (symmetric, over opaque) | 0 | PASS: under belt loop and piston rod | `<A>crops/decals-belt-crossings-x3.png` |
| flywheel, pulley-flywheel, pulley-crank (flywheel, 3) | t3 + rot | PASS | 0 / 9-tile mean 91.7 vs 91.6 | PASS | `<A>tracks/rows/track-flywheel.png` |
| flywheel-pedestal (flywheel, 3) | t2, t3, t3b | PASS | 0 / 97.5, 97.3 vs 98.3 | PASS | same |
| decals flywheel-rim-2 / -3 (flywheel t2 / t3) | 2 | PASS | 0 / 96.0 | PASS: re-tyred rim, brass inlay; belts over | `<A>crops/decals-hubs-z2.png` |
| piston-block (improvedPistons, 5) | t2-t5, t5b | PASS | 0 / >= MK I - 3 | PASS: braces at MK III are the strongest step | `<A>tracks/rows/track-improvedPistons.png` |
| coils-1 t2 / coils-3 t5 (copperWinding, 5) | 2 | PASS | 0 | PASS | `<A>tracks/rows/track-copperWinding.png` |
| motor-retrofit (motorRetrofit, 5) | t2-t5, t5b | PASS | 0 / 92.0 vs 93.8 (-1.8) | PASS (small host, MK II quiet, beat carries it) | `<A>tracks/rows/track-motorRetrofit.png` |
| transformer (transformer, 5) | t2-t5, t5b | PASS | 0 / 95.1 vs 94.9 | PASS: radiators, fans, lamp | `<A>tracks/rows/track-transformer.png` |
| firebox-1 t2 / firebox-3 t5 (firebox, 5) | 2 (4 frames) | PASS | 0 | PASS (D3: taller, brighter flames at zoom 1) | `<A>p1/rows/D3-D4.png` |
| induction-heater (inductionHeater, 5) | t2-t5, t5b | PASS | 0 | PASS (s11, s16) | `<A>stages/1920x1080/s16-z1.png` |
| condenser (condenser, 5) | t2-t5, t5b | PASS | 0 / 95.3 = MK I | PASS; D1 MK II quiet (4 rust specks off, bright rivets) | `<A>p1/rows/D1-condenser.png` |
| bellows (bellowsDrive, 3) | t2, t3, t3b | PASS | 0 / 94.5 vs 96.3 (-1.8) | PASS; D2 MK II straps dark on dark, MK III nozzle + lamp clear | `<A>p1/rows/D2-bellows.png` |
| coil-ring-1 t2 (harmonicCoil, 5) | 1 (4 frames) | PASS | 0 / 100 | PASS; D4 cyan glints quiet at 0.5 | `<A>p1/rows/D3-D4.png` |
| calliope (pressureResonator, 5) | t2-t5, t5b | PASS | 0 | PASS (s16) | `<A>stages/1920x1080/s16-z1.png` |
| servo-base, servo-arm rot (crankServo, 3) | t2, t3, t3b; t2, t3 | PASS | 0 | PASS; D5 MK II quiet, MK III cover + lamp clear | `<A>p1/rows/D5-servo.png` |
| spire-wave (standingWave, 5) | t2-t5 | PASS (G2 waived, method D) | 0 / 88.0 = MK I | PASS (s13, s16) | `<A>stages/1920x1080/s16-z05.png` |
| exciter-feed (gridExciter, 3) | t2, t3, t3b | PASS | 0 / 92.1 vs 94.0 | PASS | `<A>stages/1920x1080/s16-z1.png` |
| backfeed-terminal (mainsBackfeed, 3) | t2, t3, t3b | PASS | 0 | PASS | same |
| steam-lance (steamLance, 3) | t2, t3, t3b | PASS | 0 / 96.6 | PASS; D6 MK III collar + 2 px lamp quiet, heartbeat helps | `<A>p1/rows/D6-lance.png` |
| rings / siphons / anchor glows (containmentRing, resonantSiphon, graviticAnchor) | staged only | n/a | n/a | PASS at s15 / s16; ring 1 bead see F3 | `<A>ring/sheet-ring.png` |

### Verdicts
- **Ghost: ACCEPT plain `setTintFill(#c98552)`; REJECT the 2x2 checker.** Mock-up on the real frame (`<A>beat/ghost-mock-plain-vs-checker-x3.png`):
  the checker turns the expanding shell into a screen-door mesh at t176-t256 (dither noise, against ART_BRIEF "hard clusters, no dithering
  noise"; 4 px squares at zoom 2). The live plain ghost reads as a hot shell lifting off, but at alpha 0.8 it hides the new art for the
  whole reveal (t128-t256 is a flat orange blob: `<A>beat/motor-full/motor-full-t0128.png`, `-t0176.png`). At 0.55 the MK II patches and bands
  read through it from t128 and the halo still reads (`<A>beat/ghost-mock-a080-vs-a055-x3.png`) → F4. No TierBeatFx checker work.
- **Beat timing: PASS** (motor 4 → 5, full motion, `<A>beat/sheet-motor-full-x2.png`; frames `<A>beat/motor-full/motor-full-t0000.png` anticipation,
  `-t0064` flash step 2 (#ffd27a 0.6), `-t0128` swapped + ghost, `-t0256` ghost 0.36 / x1.065 + rust flakes, `-t0352` first bolt crown, `-t0448`,
  `-t0608` settle, `-t0704` shine band, `-t0800`, `-t0896` at rest; `tierBeatsActive` 1 through t896, 0 after 900). Every event within one frame
  (16 ms) of PART_TIER_FX. Gear 5 → 6 (rot host, `<A>beat/sheet-gear-full-x2.png`) and flywheel 3 → 4 (`<A>beat/sheet-flywheel-full-x2.png`) same
  timeline. Settle shake and bell are not visible in stills (tiers.mjs and audio tests cover them).
- **Reduced motion: PASS with F1 / F2 / F6.** `<A>beat/sheet-motor-reduced-x2.png`, `-gear-`, `-flywheel-`: swap at t0 under a 250 ms crossfade,
  4 static #ffd27a glints to t400, beat over by t448 (tiers.mjs D_short 453 / 476 ms); no flash, ghost, shake, debris or shine; heartbeat stays.
  Defects: the crossfade image draws over front parts (flywheel t64-t128: the old pedestal bearing block over the hub pulley) → F1; the glints
  float in air beside the motor plinth and below the gear → F2; on a rotating host the static old frame double-exposes the turning teeth for
  250 ms (`<A>beat/gear-reduced/gear-reduced-t0128.png`) → F6 (optional).
- **Burst: PASS** (case C pattern, 4 beats + 2 instant, `<A>beat/sheet-burst-full.png`, `<A>beat/burst-full/log.json`): gear t64, pedestal t128,
  motor t256, pistons t368 (120 ms stagger, track order reads as a left-to-right cascade), retrofit kit and transformer swap at once with debris,
  peak `tierBeatsActive` 4, quiet by t1408; reduced burst over by t800. Not spam. Same F1 layering (pedestal flash over the wheel hub t128,
  piston flash over the frame girder t368).
- **Heartbeat: PASS.** Era I-II MK V set (motor, pistons, retrofit kit, transformer, pedestal t3): 28 samples, 0 mixed, half-periods
  1056-1358 ms (`<A>tracks/1280x720/heartbeat.json`). Postgame, all 13 pulse hosts, sampled once per animation frame for 6 s: 34 frames, 0 mixed,
  half-periods 1105 / 1309 / 1126 / 1302 ms, mean 1.21 s vs 1.2 s (jitter = 6 fps headless) (`<A>heartbeat/heartbeat-postgame.json`). Lamp frames
  `<A>tracks/1280x720/e2-15-heartbeat-low.png` / `-high.png`.
- **Decals vs belts: PASS.** Main hub: the belt loop and the piston rod draw over the gear-rim brass ring; flywheel hub MK II / MK III and
  postgame: every belt crosses over rim 2 / rim 3 (`<A>crops/decals-hubs-z2.png`, `<A>crops/decals-belt-crossings-x3.png`, zoom 2 and x3).
  Fly-ins: `buyPerk('muscleMemory')` after a new cycle, gearLarge lands at MK I in 700 ms with no rim decal at any frame, no beat
  (`<A>flyin-perk/sheet-perk.png`; the yellow ring is the WP20 crank prompt). Demo teaser: opens on the built era II machine, so era I-II
  hosts (and their decals) appear at once at top tier (gear rim, flywheel inlay, MK V piston caps and lamp:
  `<A>flyin-teaser/teaser-t0-base-x2.png`); plate stays redacted `RES?OR?` (`<A>flyin-teaser/teaser-plate-x8.png`); end frame
  `<A>flyin-teaser/teaser-end.png` (era V, top tiers, masked caption).
- **Brass vs rust at zoom 0.5 on the Era I backdrop (risk 2): PASS.** Motor MK IV / V hoops, gear rim and flywheel inlay read as clean brass
  bands, MK I rust reads as mottled patches (`<A>tracks/rows/track-motorTuning.png`, `<A>tracks/1280x720/e1-08-motor5-pist5-z05.png`).
- **Stages: PASS** at 1280x720 UI 100 and 1920x1080, zoom 1 / 0.75 / 0.5, errors [] (`<A>stages/1280x720/`, `<A>stages/1920x1080/`:
  `s2`, `s4`, `s7`, `s9`, `s11`, `s13`, `s15`, `s16` postgame, `s16-photo-z05` / `-z1` photo mode). Tiers per stage as expected (s16: every
  track at its top). No tier part breaks a silhouette, socket or belt path.
- **TECH INDEX detail at UI 150: PASS by eye.** `LV 24/25 · MK IV — MK V AT LV 25` on one line, 9 px inside the panel edge
  (`.../WP22/val/tiers/tiers-H-ui150.png`); the clipped cost row under it is the existing scrolling panel (WP16b-2 N2 / N3).
- **Ring bead overlap: ACCEPT during the finalAlignment hold; FIX after it (F3).** During align + hold both ring-1 beads sit at beadPhiDeg 90:
  one bead, reads as the alignment beat (Director call stands). But `MachineAnimator.placeBead` (`:538-545`) leaves `orbitAngles` = 90 for
  both, and ring1Bead / ring1Bead2 share ring, dir, speed and speedScale (`machineComponents.ts:977`, `:1014`), so after the hold they orbit
  stacked for the rest of the session (finale, postgame, store shots) until reload or reset: the containment MK II part disappears.
  Code-deterministic; the pixel probe (`<A>ring/`) is inconclusive because beads pass behind the core.

### Fix list (owner = worker via T14, unless noted)
- **F1 (S1, code + data) beat overlays above front parts.** `src/game/entities/TierBeatFx.ts`: flash, ghost and shine use the fixed depth
  `MACHINE_LAYER_DEPTH.front + 3`, so the overlay of a back / mid host covers pulleys, belts and front parts (flywheelPedestal depth 21 → its
  flash, ghost, shine and reduced crossfade cover flywheelPulley 23 and the belts; gearLarge 20 → covers pulleyMain 22 and the belt loop;
  pistonArray 1 → covers the frame girder). Fix: in `play()` set `flash`, `ghost` and the slot's shine image depth to
  `host.depth + PART_TIER_FX.overlayDepthBias`, then `parts.sort('depth')` once (keep the `parts` reference from the constructor);
  `src/game/entities/TierShine.ts`: add `setDepth(slot: number, depth: number)` (or a depth argument on `show`). `src/data/machineTiers.ts`
  `PART_TIER_FX` += `overlayDepthBias: 0.05` (new key, with a comment). The particle pool (debris, crowns, glints, torque sparks) stays at
  `front + 4`. Verify: re-run `<A>tools/beat.mjs` flywheel / gear full + reduced: pulley and belts crisp over the flash at t64 / t128 / t608.
- **F2 (S1, data) bolt-down points float.** 14 of 18 primary hosts use the default box-corner mounts, which land on transparent pixels
  (`<A>tools/mounts.py`): crowns, torque sparks and reduced glints spark in mid air (motor: beside the plinth). `src/data/machineTiers.ts`
  `PART_TIERS` add `mounts` (art px from the host origin; every point checked opaque on MK I and every tier, inside the host box):
  gearRatio `{ gearLarge: [{x:-4,y:0},{x:4,y:0}] }` (hub set screws, over the pulley) · motorTuning `{ wornMotor: [{x:-10,y:15},{x:8,y:15}] }`
  (foot flanges) · copperWinding `{ coilStage1: [{x:-14,y:4},{x:19,y:4}] }` · motorRetrofit `{ motorRetrofitKit: [{x:-7,y:6},{x:4,y:6}] }` ·
  transformer `{ transformer: [{x:-17,y:-1},{x:20,y:-1}] }` · firebox `{ fireboxGlow1: [{x:-2,y:-1},{x:2,y:-1}] }` (flame roots) ·
  inductionHeater `{ inductionHeater: [{x:-15,y:-4},{x:16,y:-4}] }` · condenser `{ condenser: [{x:-22,y:-1},{x:21,y:-1}] }` (outer saddles) ·
  bellowsDrive `{ bellows: [{x:-19,y:-1},{x:5,y:-1}] }` (legs) · pressureResonator `{ calliope: [{x:-28,y:-1},{x:27,y:-1}] }` ·
  standingWave `{ spireWave: [{x:0,y:-2},{x:0,y:-268}] }` (rod ends = fixed nodes) · gridExciter `{ exciterFeed: [{x:2,y:-1},{x:6,y:-1}] }` ·
  mainsBackfeed `{ backfeedTerminal: [{x:-3,y:1},{x:3,y:1}] }` · steamLance `{ steamLance: [{x:-4,y:1},{x:4,y:1}] }` (top brackets).
  Defaults already on the art (keep): flywheelPedestal, pistonArray, servoBase, coilRing1. `machineTiers.test.ts` in-box test covers them.
- **F3 (S1, code + data) ring1Bead2 stacks on ring1Bead after the alignment.** `src/data/machineComponents.ts`: orbit animation type +=
  optional `alignOffsetDeg?: number`; `ring1Bead2` `alignOffsetDeg: 180`. `src/game/entities/MachineAnimator.ts` `placeBead`: align target and
  hold = `EXOTIC_MILESTONE_FX.beadPhiDeg + (anim.alignOffsetDeg ?? 0)` (bead 2 aligns to 270, behind the core, so the hold still reads as one
  front column; after the hold the two beads stay 180 deg apart). `machineComponents.test.ts`: ring1Bead2 contract `alignOffsetDeg: 180`.
  Verify: `<A>tools/ring.mjs`, two ring-1 beads 180 deg apart at +6 s / +15 s after the purchase.
- **F4 (S2, data + test) ghost alpha.** `src/data/machineTiers.ts` `PART_TIER_FX.ghostAlpha` 0.8 → 0.55; `src/game/math/tierBeat.test.ts`
  t120 alpha 0.8 → 0.55 (title too), t250 alpha 0.384 → 0.264. (AD-owned number, but the pinned test is not AD-owned: one worker lands both.)
- **F5 (S2, smoke) tiers.mjs B_input race.** `scripts/smoke/tiers.mjs` case B: move `await snap(0);` below the `c.check('B_input', ...)` line
  (click first, then the four shots); shot names unchanged, achieved offsets still recorded in `B_played`.
- **F6 (S3, optional, code) reduced crossfade on rotating hosts.** `src/game/entities/TierBeatFx.ts` `drawReduced`: when
  `isRotating(beat.primary)`, keep the crossfade image hidden (swap at t0 + glints only); a static old frame over a turning gear double-exposes
  the teeth for 250 ms.

### Notes (accepted, no fix)
- N1 D1 condenser MK II, D2 bellows MK II, D4 coil ring 1 MK II, D5 servo arm, D6 lance MK III are quiet steps at zoom 0.5; each passes G1
  and its per-host spec, the beat (debris, crowns) carries the moment, the next step is strong. Optional post-WP22 polish: bellows-t2 strap
  lit edge to #7d8286.
- N2 This box renders the headless page at about 6 fps in postgame and screenshots take 0.55-1.4 s while sibling smokes run; real-time
  frame grabs are unreliable here (hence the fake clock, and F5).
- N3 No PNG, manifest, PART_TIER_FX or ASSET_GUIDE change in this round (nothing to regenerate). Round 2 after T14: re-run `beat.mjs`
  (all strips), `ring.mjs`, `tiers.mjs` on both builds and look at the F1 / F2 / F3 frames.

### Round 2 (AD5r2)

Art Director round 2 on the T14 build, 2026-10-24. Verdict: **FIXES REQUIRED**. F1 did not land (only its data key); F3 passes for the
finalAlignment hold and after it, but the second ring-1 bead is not opposite the first after the containmentRing MK II purchase (new F9);
the copper-winding MK V beat crowns on the default corners and one lands in the sky (new F7). F2, F4, F5 and the new level-line text pass.
No PNG, manifest, ASSET_GUIDE or PART_TIER_FX number change.

Evidence root `<A2>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22/ad/audit2/`
(tools in `<A2>tools/`: round 1 `beat.mjs`, `kit.mjs`, `sheet.py`; new `beatdbg.mjs` (beat.mjs plus a per-frame TierBeatFx log), `glints.mjs`,
`glintsheet.py`, `glintzoom.py` (one reduced beat per mount host, glint frame t48 vs t480), `ring2.mjs` (bead angles solved from the sprite
positions through a read-only `Sprite.prototype.setPosition` probe on `window.Phaser`), `mounts2.py`, `mounts2s.py`, `mounts3.py`
(mount pixels vs alpha per tier file and per tier step), `layout2.ts` (layout, tiers, mounts and PART_TIER_FX dump)).

Start: worktree quiet for 4 min (no edit after 20:42) before the build. Build under audit: typecheck clean; `npx vitest run` 126 files,
3717 pass / 16 skipped. `npm run build` (dist 20:50:22): app js 434.3 / 460 KB, css 40.0 (<= 40.1), public 1724.0 KB, bundle budget PASS.
`npm run build:demo` (dist-demo 20:50:38): app js 436.3 KB, css 42.8 (<= 42.9), PASS. Ports: :4175 existing preview of this dist (serves
`index-BNYJD84C.js`, not started or stopped); :4176 demo preview started by the AD (netstat empty before), stopped after
(`taskkill //PID 21496 //T //F`, netstat empty); 4173 / 4174 / 4177 untouched.

| item | status | evidence |
|---|---|---|
| F1 beat overlays above front parts | **FAIL: code not landed** | `<A2>f1/flywheel-full-hub-x3.png`, `<A2>f1/gear-full-hub-x3.png`, `<A2>f1/burst-pistons-girder-x3.png`, `<A2>f1/flywheel-reduced-hub-x3.png` |
| F2 bolt crowns, torque sparks, reduced glints on the 14 hosts | PASS 14 / 14 (spire 1 px wobble accepted) | `<A2>f2/zoom-p1-reduced.png`, `-p2-`, `-p3-`; `<A2>f2/motor-crowns-glints-r1-vs-r2-x3.png`, `<A2>f2/gear-crowns-glints-r1-vs-r2-x3.png`; `<A2>mounts/mounts2.json` |
| F2 scope: MK V primaries coilStage3 / fireboxGlow3 | FAIL coilStage3 (new F7) | `<A2>f2/zoom-p1-reduced.png` tile `coil3-mk5 @(20,73)`; `<A2>mounts/mounts3.json` |
| F3 finalAlignment hold: one front column, bead 2 behind the core | PASS | `<A2>ring-hold/ring-hold-core-x5.png` (B-fa-04500), `<A2>ring-hold/ring-log.json` |
| F3 after the hold: beads 180 deg apart at +6 / +15 s | PASS (177 / 178; 171 at +12 s) | `<A2>ring-hold/ring-log.json` |
| F3 after the containmentRing MK II purchase: 180 deg apart at +6 / +15 s | **FAIL: 93 / 81 deg** (new F9) | `<A2>ring/ring-A-mk2-core-x5.png`, `<A2>ring/ring-log.json` |
| F4 ghost alpha 0.55 | PASS | `<A2>f4/motor-ghost-r1-vs-r2-x3.png`, `<A2>beat/sheet-motor-full-x2.png` |
| F5 tiers.mjs, both builds | PASS: fail [], errors [] | `<A2>tiers-full.json`, `<A2>tiersB2.json`, `<A2>tiersB3.json`, `<A2>tiers-demo.json` |
| Level line `LV 19/25 · MK III — MK IV AT 20` at UI 150 | PASS | `<A2>tiers-full/tiers-H19-ui150.png` |

- F1: `PART_TIER_FX.overlayDepthBias: 0.05` and its machineTiers.test bounds landed, the code half did not: `TierBeatFx.ts` (mtime 18:40,
  before the round 1 audit) still builds the flash and ghost pools at `MACHINE_LAYER_DEPTH.front + 3` and never re-depths them, `TierShine.ts`
  has no per-slot depth, and nothing in `src/` reads `overlayDepthBias`. Frames are the round 1 defect unchanged: flywheel full t64 flash and
  t128 ghost over flywheelPulley and both belts, gear full t64 / t128 over pulleyMain and the belt loop, burst t368 piston flash over the
  girder top edge, reduced flywheel t64 / t128 old pedestal bearing block over the hub pulley. Re-issued below.
- F2: one reduced beat per declared host in game (`glints.mjs` p1 / p2 / p3), glint frame t48 against t480: kit bracket, coil-1 bobbin feet,
  transformer tank feet, heater, firebox flame roots, bellows legs, condenser saddles, calliope feet, spire rod ends, exciter box, backfeed
  bar, lance bracket: every glint on opaque art. Motor feet and gear hub crowns (full t352 / t448) and glints (reduced t64) now sit on the
  foot flanges and hub set screws; round 1 had them on the floor and under the gear. Static check (`mounts2.py`, every frame of every
  tier file): 0 misses except the empty padding cells 140-143 of the gear rotation sheets and the spire rod wobble. Crowns and torque sparks
  share `mountPoints`, so the reduced glints place all three.
- F2 scope gap (round 1 listed swaps[0] only): the beat primary is the first swap host whose key changes (`tierRelease.primaryOf`), so
  copperWinding 4 → 5 plays on coilStage3 and firebox 4 → 5 on fireboxGlow3, both on default bottom corners. coilStage3 (64x40, the MK V
  art has empty bottom corners): the left crown / glint lands on the sky beside the base, the right one on the base edge. fireboxGlow3:
  the corners land on the firebox housing (boiler art), reads as bolting the grate, no float. Fix F7.
- F3: round 1's `ring.mjs` never saw the hold: finalAlignment is a milestone that unlocks itself once skyAperture, inversionCrank and
  the lifetime XF are met, so the S15 setup fired it unseen. `ring2.mjs` holds skyAperture back and buys it under the frozen clock. Hold
  frame: ring1Bead phi 90 depth 30 (front), ring1Bead2 phi 269 depth 26 (behind the core), ring 2 / ring 4 beads at 90-91: one front
  column. After the hold: 177 / 171 / 178 deg at +6 / +12 / +15 s. Phase A (S14, containmentRing 3 → 4): ring1Bead2 starts at its absolute
  phi0 180 while ring1Bead is wherever its orbit is: 77 / 93 / 79 / 87 / 81 deg apart at +3 / +6 / +9 / +12 / +15 s, both beads on the
  front arc at +6 s. The pair stays unbalanced until the finalAlignment hold or a reload (both restart from phi0 0 / 180). Fix F9.
- F4: at 0.55 the MK V cowl, hoops and panel lines read through the ghost from t128; round 1 at 0.8 was a flat orange blob to t256. Gear
  t128: the new teeth read through it. Halo still reads.
- F5: :4175 full run all checks true (A-H, F_restored 34); B_input 3 / 3 (full run, then ONLY=B twice): clicks 45 → 46, activeAtClick 1,
  with the B shots landing 1.2-7.8 s late. :4176: fail [], errors [], FG_skipped_demo.
- Level line: `LV 19/25 · MK III — MK IV AT 20` on one line at UI 150, NOW +19 ME/S and NEXT +20 ME/S visible; H19_fit_100 / H19_fit_150
  true (span 19 / 29 = one line box), LV 24 line `LV 24/25 · MK IV — MK V AT 25` the same, demo the same. The cost row under NEXT is the
  scrolling panel clip (round 1, WP16b-2 N2 / N3).
- Beat timing unchanged vs round 1 (`<A2>beat/sheet-*-x2.png`, `<A2>beat/sheet-burst-full.png`): full beats 900 ms, reduced over by
  t432-t448, burst full quiet by t1408, reduced by t800. F6 (optional) not done: reduced gear t64 still double-exposes the teeth
  (`<A2>beat/gear-reduced/gear-reduced-t0064.png`).

#### Fix list, round 2 (owner = worker, unless noted)
- **F1 (S1, code) re-issue, code half only.** `src/game/entities/TierShine.ts`: add `setDepth(slot: number, depth: number): void`
  (`this.images[slot]?.setDepth(depth)`). `src/game/entities/TierBeatFx.ts`: keep the constructor `parts` as `private readonly parts`; in
  `play()`, once `flash` and `ghost` are known: `const depth = host.depth + PART_TIER_FX.overlayDepthBias; flash.setDepth(depth);
  ghost.setDepth(depth); this.shine.setDepth(slot, depth); this.parts.sort('depth');`. The particle pool stays at `front + 4`. Component
  depths are integers and the decals sit at host + 0.5 / 0.6, so host + 0.05 is above the host and below every part in front of it.
  Verify: `<A2>tools/beatdbg.mjs` flywheel / gear full + reduced and burst full: pulleys and belts crisp at t64 / t128, girder over the
  piston flash at t368, pedestal crossfade under the hub pulley.
- **F7 (S2, data) MK V beat mounts.** `src/data/machineTiers.ts` `PART_TIERS`: copperWinding `mounts` += `coilStage3: [{ x: -14, y: 4 },
  { x: 19, y: 4 }]`; firebox `mounts` += `fireboxGlow3: [{ x: -2, y: -1 }, { x: 2, y: -1 }]` (the stage-1 points; same attachment; opaque
  on coils-3, coils-3-t5 and every frame of firebox-3-t5, and on the stage-1 art under them). The existing in-box test covers them.
  Verify: `<A2>tools/glints.mjs` p1 / p2 reduced, `coil3-mk5` and `firebox3-mk5` glints on the bobbin feet and flame roots.
- **F9 (S2, code + data) ring1Bead2 opposite ring1Bead when it comes in.** `src/data/machineComponents.ts`: orbit animation type +=
  optional `phaseOf?: MachineComponentId` (lead bead: on its first placement this bead starts at the lead's current angle +
  (phi0Deg - lead phi0Deg)); `ring1Bead2` `phaseOf: 'ring1Bead'`. `src/game/math/animation.ts`: `followPhase(leadDeg, phi0Deg, leadPhi0Deg)`
  wrapped to [0, 360) (+ test: 141, 180, 0 → 321; 300, 180, 0 → 120). `src/game/entities/MachineAnimator.ts`: one start-angle helper used
  by `placeBead` (`from`) and by the exotic milestone handler (`exoticFrom`): the recorded angle, else `followPhase` of the lead's recorded
  angle when `phaseOf` is set and recorded, else `phi0Deg`. ring1Bead is placed before ring1Bead2 in every frame (id order), so after a
  reload the pair still starts at 0 / 180. `machineComponents.test.ts`: ring1Bead2 contract `phaseOf: 'ring1Bead'`, no other orbit part
  sets it. Verify: `<A2>tools/ring2.mjs` phase A: 180 ± 12 deg (solver quantization) at +3 to +15 s after the MK II purchase.
- **F8 (S3, optional, code) spark pixel origin.** `src/game/entities/TierSparks.ts` constructor: pool images `.setOrigin(0)`. A 1x1 image
  at origin 0.5 on an integer point is centred on a pixel corner, so the rasterizer picks one of four pixels: measured 0-1 px left / up of
  the authored mount, varying by run and zoom. All 14 hosts were on art in this run, but at a (-1, -1) landing the firebox flame-root
  glints, the heater MK I-III left glint and the backfeed / lance glint pixels miss by 1 px (`<A2>mounts/mounts2-rendered.json`). Origin 0
  puts a spark exactly on the authored pixel, which `mounts2.py` checks (0 misses), and puts debris on the art grid.
- **F6 (S3, optional)** carried from round 1, unchanged.

#### Notes, round 2 (no fix)
- N-r2-1 Harness: under the paused fake clock the Phaser loop sometimes stops getting frames (`game.loop.frame` constant, beat time
  frozen): flywheel reduced (2 runs), burst reduced (1 run), one glint host and the first 2.5 s of the ring hold run. Reruns with the
  per-frame log (`beatdbg.mjs`) and a freeze guard (`glints.mjs`) pass; a real-time probe shows the same flywheel reduced beat swapping and
  ending. Not a game defect. Stuck runs kept in `<A2>beat/flywheel-reduced-run1-stuck/`, `-run2-stuck/`, `<A2>beat/burst-reduced-run1-stuck/`.
- N-r2-2 A purchase through `session.purchase` snaps the camera to the default framing (zoom 0.5-1), so the F2 / F3 in-game captures are
  at default zoom (1-2 screen px per art px) and are read at x5-x10.
- Round 3 after F1 / F7 / F9: `beatdbg.mjs` flywheel / gear full + reduced and burst full, `glints.mjs` p1 / p2 reduced, `ring2.mjs`
  (phase A and hold), `tiers.mjs` on both builds.

### Round 3 (AD5r3)

Art Director round 3 on the F1 / F7 / F9 / F10 build, 2026-10-24. Verdict: **RELEASE-READY**. F1, F7 and F9 pass in game on both
motion settings; F10 holds (tiers.mjs clean on both builds, double purchases end at the higher tier). F2 / F4 / F5 still hold. F6 / F8 stay
deferred (optional). No PNG, manifest, ASSET_GUIDE or PART_TIER_FX number change.

Evidence root `<A3>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22/ad/audit3/`
(tools in `<A3>tools/`: round 2 `kit.mjs`, `layout.json`, `glints.mjs`, `glintsheet.py`, `glintzoom.py`, `sheet.py`; `beatdbg.mjs` now with the
freeze guard (retry until `game.loop.frame` steps, `freezeTries` logged) and `BEAT_TARGETS` / `BEAT_SUFFIX`; new `ring3.mjs` (ring2.mjs plus the
freeze guard, both ring-1 beads read by id from `MachineView.sprites` and solved on ring 1 only), `f10.mjs` (double-purchase key trace),
`rowcmp.py` (round 2 vs round 3 crops of the same box)).

Start: the four fixes are in source (`TierBeatFx.play` sets flash / ghost / shine depth to `host.depth + PART_TIER_FX.overlayDepthBias` and
re-sorts `parts`; `TierShine.setDepth`; `PART_TIERS` mounts `coilStage3` / `fireboxGlow3`; `ring1Bead2.phaseOf: 'ring1Bead'` with
`MachineAnimator.startAngle` / `followPhase`; `MachineView` swap hook `Math.max(change.to, this.trackTier(techId))`). dist / dist-demo (21:47 /
21:48) were older than the newest fix edit (22:44:20), so the AD rebuilt: `npm run build` (dist 22:45:24): app js 435.0 KB, css 40.0 KB;
`npm run build:demo` (dist-demo 22:45:37): app js 437.0 KB, css 40.0 + 2.8 KB. Typecheck clean; `npx vitest run` 126 files, 3723 pass /
16 skipped. Ports: :4175 existing preview of this dist (serves `index-DjtunAym.js`; not started or stopped); :4176 demo preview started by the
AD (netstat empty before; served `index-Bj96sfD3.js`), stopped after (`taskkill //PID 23792 //T //F`, netstat empty); 4173 / 4174 / 4177 untouched.

| item | status | evidence |
|---|---|---|
| F1 flywheel full: flywheelPulley and both belts over the pedestal flash (t64) and ghost (t128) | PASS (r2: pulley and belts under the flash) | `<A3>f1/flywheel-full-hub-r2-vs-r3-x3.png` |
| F1 flywheel full: shine under the hub pulley and the lower belt | PASS: dense t560-t800, band on the pedestal legs t624-t768, never on the pulley or a belt | `<A3>f1/flywheel-full-shine-dense-x2.png`, `-dense2-x2.png`, `<A3>f1/flywheel-full-shine-hub-x5.png`, `<A3>f1/flywheel-full-shine-r2-vs-r3-x2.png` |
| F1 gear full: pulleyMain and the belt loop over the gearLarge flash (t64) and ghost (t128) | PASS | `<A3>f1/gear-full-hub-r2-vs-r3-x3.png` |
| F1 reduced: pedestal crossfade under the hub pulley (t64 / t128); gear crossfade under pulleyMain | PASS | `<A3>f1/flywheel-reduced-hub-r2-vs-r3-x3.png`, `<A3>f1/gear-reduced-hub-r2-vs-r3-x3.png` |
| F1 burst full: girder top edge over the piston flash (t368); crank rod over the flash (t368) and ghost (t608) | PASS (r2: rod tinted at the rail crossing) | `<A3>f1/burst-pistons-girder-r2-vs-r3-x3.png`, `<A3>f1/burst-pistons-rail-rod-r2-vs-r3-x8.png` |
| F1 no new defect: overlays on their own host, ghost 0.55 hot shell, timing | PASS: full beats end t912, reduced t400, burst full t1264 (4th beat 360 + 900), reduced burst t768, peak 4 | `<A3>beat/sheet-*-x2.png`, `<A3>beat/sheet-burst-*.png`, `<A3>beat/*/log.json`, `<A3>beat/run.log` |
| F7 coilStage3 MK V (coil3-mk5, reduced): glints on the bobbin feet | PASS (r2: left glint in the sky, right on the base edge) | `<A3>f7/coil3-mk5-glints-r2-vs-r3-x6.png`, `<A3>f7/zoom-p1-reduced.png` |
| F7 fireboxGlow3 MK V (firebox3-mk5, reduced): glints on the flame roots | PASS (N-r3-1) | `<A3>f7/firebox3-mk5-glints-r2-vs-r3-x10.png`, `<A3>f7/zoom-p2-reduced.png` |
| F7 the other hosts unchanged | PASS: 11 / 12 glint hosts (p1-p3) same art offsets as r2; kit moved with its sprite (motor vibration phase), still on the bracket ends; reduced gear glints on the hub set screws (t64), reduced motor glints on the foot flanges (f10 case B t48) | `<A3>f7/sheet-p1-reduced.json`, `-p2-`, `-p3-`, `<A3>f7/kit-glints-r2-vs-r3-x6.png`, `<A3>f7/zoom-p3-reduced.png`, `<A3>f1/gear-reduced-hub-r2-vs-r3-x3.png`, `<A3>f10/f10-B-motor-glints-x6.png` |
| F9 phase A (S14, containmentRing 3 → 4): ring-1 beads 180 ± 12 deg apart | PASS: 176 / 180 / 177 / 178 / 178 / 175 / 178 at +1 / +2 / +3 / +6 / +9 / +12 / +15 s (r2: 77-93) | `<A3>f9/ring3/ring-log.json`, `<A3>f9/ring3.log`, `<A3>f9/ring-A-mk2-core-x5.png` |
| F9 finalAlignment hold: one front column, bead 2 behind the core | PASS: t1500-t3400 ring1Bead phi 90 depth 30, ring1Bead2 phi 269 depth 26 | `<A3>f9/ring-B-hold-core-x5.png`, `<A3>f9/ring3/ring-log.json` |
| F9 after the hold | PASS: 179 / 176 / 170 / 175 / 175 at +4.5 / +6 / +9 / +12 / +15 s | `<A3>f9/ring3/ring-log.json` |
| F10 `tiers.mjs` :4175 full | PASS: fail [], errors [] (all A-H true, B_input clicks 45 → 46 activeAtClick 1, F_restored 34, D_short 454) | `<A3>tiers-full.json`, `<A3>tiers-full/` |
| F10 `tiers.mjs` :4176 demo | PASS: fail [], errors [], FG_skipped_demo | `<A3>tiers-demo.json`, `<A3>tiers-demo/` |
| F10 quick double purchase ends at the higher tier | PASS (cases A, B, C below) | `<A3>f10/f10-sheet-x2.png`, `<A3>f10/f10-A/log.json`, `-B/`, `-C/` |
| F2 / F6 / F8 notes; no PNG, manifest or PART_TIER_FX number change | PASS: `public/assets` no file newer than 18:00, `manifest.ts` / `ASSET_GUIDE.md` 17:23, `TierSparks.ts` 17:28; PART_TIER_FX equal to the r2 dump (`<A3>tools/layout.json` fx) | this table, `git status` |

- F1 burst detail: at the piston block the flash rows are the block's own base rail (pistonArray bottom row y -111 sits on the supportFrame top
  row y -110; the boxes do not overlap), identical in r2 and r3, so the flash on it is correct and the frame's top edge carries no flash pixel.
  What F1 changes in that frame is everything drawn between the host and `front`: the crank rod now crosses the flash and the t608 ghost crisp.
  The shine skips rotating hosts by design (`isRotating`), so the gear has none.
- F10 cases (`f10.mjs`, fake clock): A full, tree closed: motorTuning 4 → 5, then → 10 48 ms later: keys `machine.motor` → `#t2` at t48 (the
  first beat is cancelled and swaps) → `#t3` at t176 (second beat swap), never back; B reduced: `#t2` t16 → `#t3` t64. C: a held release of
  4 beats (copperWinding 4 → 5 is the 4th, staggered 360 ms on coilStage1), then copperWinding → 25 at t48 with the tree closed: coilStage1
  `#t2` and coilStage3 `#t5` at once; the staggered MK II beat still plays (t360-t1264) and its swap at t480 leaves the track at MK V (the
  pre-F10 hook would have set it back to tier 2). All three end at the higher tier.
- Harness (N-r2-1 again): the first flywheel / gear full runs froze (`loop.frame` stuck at 134, `tMs` 0): kept in
  `<A3>beat/flywheel-full-run1-stuck/`, `<A3>beat/gear-full-run1-stuck/`; with the guard every rerun stepped (`freezeTries` 1-2). The
  unguarded `ring2.mjs` rerun (`<A3>f9/ring/`) froze for the first second and its ring guess put ring-1 beads on rings 2-4 in 5 of 8 phase A
  samples; `ring3.mjs` fixes both. Not a game defect.

#### Notes, round 3 (no fix)
- N-r3-1 Reduced motion, firebox MK V: the glints sit on the flame roots as specified, but they are #ffd27a on #ffd27a / #f0a848 flame, so
  they barely show at zoom 0.5. The taller, brighter MK V flame carries the beat. Accepted.
- N-r3-2 ring1Bead2 lands with the generic fly-in dust puff (`MachineView` puffs on every landing): a beige smear across the core at +1 s
  (`<A3>f9/ring-A-mk2-landing-r2-vs-r3-x5.png`; the same in r2). It predates F9. Optional post-WP22 polish: no landing puff for orbit parts.
- N-r3-3 The coil3 MK V glint frames also show a faint ambient smoke wisp drifting over the coil base (x 88 → 93 from t48 to t480, fading).
  It is world ambience, not a tier overlay.
- F6 and F8 stay optional and deferred, unchanged: reduced gear t64 / t128 still double-exposes the teeth; reduced glints land 0-1 px
  left of the authored mount, all on art.

Round 3 verdict: **RELEASE-READY** (no F-list; F6 / F8 optional, deferred).

### Round 4 (AD5r4)

Art Director round 4, 2026-10-25: in-game verification at the DEFAULT camera (the game's own framing, never zoomed by the tool),
era by era, 1920x1080 and 1280x720, UI 100 and 150, full and reduced motion. Verdict: **FIXES REQUIRED** (F11 must land).
At UI 100 a player clearly sees every track evolve in both editions; at UI 150 the Era II default framing puts the piston array
(and its MK II / MK III beats) under the HUD panel (F11, camera code, worker). One quiet demo step was repaired by the AD in this
round (F12, piston MK II art, done and verified in game).

Evidence root `<A4>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22/ad4/`
(tools in `<A4>tools/`: `eras.mjs` (one playthrough per config, 22 releases e1a-e5f that cross all 66 tier steps of the 21 tracks
inside the TECH INDEX; shots before / in-tree / t256 / t608 / t1600 under the fake clock with the round 3 freeze guard; sidecar JSON
with crank point, camera, canvas rect, tiers, keys, levels), `pairs.py` (per release and track: host-box crops at 1:1 screen px,
before | t256 | t608 | after, no resampling; x2 / x3 nearest copies), `montage.py`, `crophost.py`, `assetstep.py` (per-step pixel
stats on the shipped PNGs), `rot.mjs` (rotating hosts across a swap), round 1 `hb.mjs` / `flyins.mjs`, `layout.json` regenerated
from the current source).

Build under audit: worktree `C:/Users/sanan/wedtmd-art` (branch `claude/tiers-wp22`). Start: dist 23:17:21 / dist-demo 23:17:33,
newer than the last source edit (`machineTiers.ts` 23:16:32, comment only: the bundles are the round 3 ones, `index-DjtunAym.js` /
`index-Bj96sfD3.js`). After F12 the AD rebuilt both (dist 00:28:21, dist-demo 00:28:30; same JS hashes, only
`piston-block-t2.png` differs): app js 435.0 / 437.0 KB, css 40.0 / 42.8 KB, public 1724.2 KB, bundle budget PASS both;
`npx vitest run src/assets` 8 files / 167 pass. Ports: :4175 existing preview (PID 16736, not started or stopped); :4176 demo
preview started by the AD (netstat empty before), stopped after (`taskkill //PID 4528 //T //F`, netstat empty); 4173 / 4174 / 4177
untouched.

| item | status | evidence |
|---|---|---|
| `tiers.mjs` :4175 full, before and after the rebuild | PASS: fail [], errors [] (A-H, B_input activeAtClick 1, C_cap 4, C_machine_ms 0.60, D_short 461 / 459, F_restored 34, G silent) | `<A4>tiers-full.json`, `<A4>tiers-full-r.json` |
| `tiers.mjs` :4176 demo, before and after the rebuild | PASS: fail [], errors [], FG_skipped_demo, D_short 450 | `<A4>tiers-demo.json`, `<A4>tiers-demo-r.json` |
| every tier step in game, 1280x720 and 1920x1080 UI 100 | 66 / 66 tier-ups reached (partTiers before -> after per release), 0 failed buys, errors []; default zoom Era I 1, Era II 0.75, Era III-V 0.5 | `<A4>eras/1280x720-ui100-full/`, `<A4>eras/1920x1080-ui100-full/`, logs `<A4>eras-1280-100.log`, `<A4>eras-1920-100.log` |
| each step reads at true size | PASS at UI 100 with the quiet steps in N-r4-1 (the beat carries them, the next step is strong); piston MK II was quiet and is fixed (F12) | strips `<A4>pairs/1280x720-ui100/*-x1.png` (x2 / x3 copies), montages `<A4>mont/e2b-x1.png`, `e2c-x1.png`, `e3b-x2.png`, `e4b-x2.png`, `e4c-x2.png`, `e4d-x2.png`, `e4e-x2.png` |
| mid-beat frames at the default camera | PASS: flash / ghost silhouettes and debris read at zoom 1, 0.75 and 0.5; 4-beat releases cascade left to right | `<A4>eras/1280x720-ui100-full/e1a-1mid256.png`, `<A4>eras/1920x1080-ui100-full/e4c-1mid256.png` |
| UI 150, 1280x720 and 1920x1080 (e1a, e2b, e3b, e4c, e5c; + e1b, e2c) | **FAIL (F11)**: Era II at UI 150 the HUD panel (VIEW y <= 365) covers the piston array and the girder top at the default framing (zoom 0.75); the e2c pistons MK II -> III beat plays entirely under it. Eras I and III-V: every tier host outside the panel (Era V left anchor top collar touches the panel edge, N-r4-3) | `<A4>evidence/F11-ui100-vs-ui150-e2c-t256.png`, `<A4>eras-ui150b/1280x720-ui150-full/e2c-1mid256.png`, `<A4>eras/1920x1080-ui150-full/e2b-1mid256.png` |
| palette lock (G1-G3) | PASS: `check_gates.py` 91 files, failures 0, before (518,591 B) and after F12 (518,742 B) | `<A4>gates-ad4.md`, `<A4>gates-ad4-after.md` |
| rotating hosts (rot sheets) | PASS: 2.5 s per-frame samples before / after: 0 keys without `#rot` (6 hosts), 23-33 distinct frames each; gear and flywheel MK II -> III swap at t128 (one frame after swapAtMs), rotation frame continuous across the swap (104, 104, 103); crops t64-t256: no blank, static or wrong frame | `<A4>rot/log.json`, `<A4>rot/gear-swap5.png`, `<A4>rot/fly-swap5.png` |
| MK V heartbeat | PASS: postgame, 13 pulse hosts, 36 samples, 0 mixed, half-periods 1096-1281 ms | `<A4>heartbeat/heartbeat-postgame.json` |
| beat never blocks input | PASS (tiers.mjs B_input, both builds, twice) | as above |
| reduced motion (e1a, e2b, e3b, e4c, e5c) | PASS: swap under the crossfade, glints on the mounts, no flash / ghost / shake / debris / shine; releases quiet by 640 ms (3 beats) and 768 ms (4 beats); errors [] | `<A4>mont/red-e1a-motor-x2.png`, `<A4>mont/red-e4c-x2.png`, `<A4>eras/1280x720-ui100-reduced/` |
| decals | PASS: gear rim and flywheel rims sit under the belts in every era frame; no decal at MK I; showcase / teaser / finale show them with their hosts | `<A4>eras/1280x720-ui100-full/e1b-2after.png`, `<A4>flyin-teaser/teaser-t00000.png` |
| showcase / finale / teaser tiers | PASS: `showcase.mjs` errors [], every track at its top at k41.5 / k45.2 / k56 / C / D2 / C2, restored 34; `finale.mjs` errors [], restoredSwapped 34 at k41.5 / end; teaser t0 = era I-II at top tiers, end = era V at top tiers, plate `RES?OR?` | `<A4>showcase.json`, `<A4>mont/sc-postgame-machine-crop.png`, `<A4>finale/finale-k41_5.png`, `<A4>flyin-teaser/teaser-end.png` |
| demo shows eras I-II only | PASS: e1a-e2c on :4176, `partTiers()` holds the 7 era I-II tracks only, visible hosts era I-II only, errors [] | `<A4>eras-demo/1280x720-ui100-full/e2c-2after.png` |
| text | PASS: in-tree compact toast `GEAR RATIO — LV 15 · MK III`; UI 150 toast `MOTOR RETROFIT — LV 3 → 7 · MK II` wraps to 2 lines inside its box | `<A4>eras/1280x720-ui100-full/e1b-0tree.png`, `<A4>eras/1280x720-ui150-full/e2b-0before.png` |

#### Fixes, round 4
- **F11 (S2, code, worker) HUD inset does not grow with the UI scale.** `CAMERA.hudTopInsetPx` (240 VIEW px) was measured at UI 100;
  the DOM HUD scales with `uiZoom` (canvas fit x uiScale / 100), so at UI 150 its panel reaches VIEW y 365 in Era II and the fitted
  machine top (240) sits under it. Fix: `src/game/math/camera.ts` new pure `hudTopInsetAt(basePx, uiScale)` =
  `Math.round(basePx * s + 16 * max(0, s - 1))`, s = uiScale / 100 (invalid -> 1): 240 / 304 / 368 at 100 / 125 / 150;
  `src/game/rendering/CameraController.ts` `target()` passes `hudTopInsetAt(CAMERA.hudTopInsetPx, session.settings.uiScale)` and a
  `'settings'` subscription refocuses once when the UI scale changes (not while overridden, not in the choice / postgame portrait);
  `src/game/math/camera.test.ts` covers both. Expected: Era II at UI 150, top at VIEW y 368 (panel bottom 365), base about 620, above
  the button row (640). UI 100 framing, store shots and the showcase portrait unchanged. Verify (round 5): `eras.mjs` UI 150 e2b / e2c
  at 1280x720 and 1920x1080, piston array fully below the panel through the beat; `tiers.mjs` both builds.
- **F12 (S2, art, AD, DONE) piston MK II did not read at zoom 1.** MK I has almost no rust, so the gland nuts and the pipe clamp
  (70 px) were the whole step. `scripts/art/tiers/piston_tiers.py`: one riveted 5x5 patch plate per barrel at staggered heights
  (lit top / left edge, 4 rivets, 1 px drop shadow), written to `piston-block-t2.png` only; MK III-V are built from the plate-less
  grid and are byte-identical (md5 unchanged). G1-G3 PASS; G4 lint 0 errors, score 96.0 vs MK I 95.9; tierCoverage green.
  PART_TIERS §2.3 MK II cell updated. In game (rebuilt dist): three light plates read at true size in Era I.
  Evidence `<A4>evidence/F12-pistons-mk2-r3-vs-r4.png`, `<A4>eras-r/1280x720-ui100-full/e1b-2after.png`, `<A4>eras-r/1920x1080-ui100-full/e1b-2after.png`.

#### Notes, round 4 (no fix)
- N-r4-1 Quiet steps at the default camera (true size), each with its full beat, each followed by a strong step: motor MK II
  (patch plates, moderate), copper winding MK II (tape ends; the generator gauge glow dominates the coil), motor retrofit MK II
  (8 px on a 32x16 accessory), transformer MK II (rust off the tank base), firebox MK II (flame +2 px), condenser MK II, bellows MK II,
  coil ring 1 MK II, servo MK II, steam lance MK III, containment ring MK II (one 5 px bead; reads in motion as a second orbiting
  bead), gravitic anchor MK II / III (the shipped era V collar glow, a 1 px pulsing line; staged). Accepted. Optional post-WP22
  polish: retrofit kit MK II lid edge, condenser MK II patch plates.
- N-r4-2 At zoom 0.5 (Eras III-V) one art px is one canvas px; small-host steps are found by the beat flash, then read on a zoom-in.
  The wheel zoom (0.5-2) is the designed way to inspect parts.
- N-r4-3 Era V UI 150: the left gravitic anchor's top collar (glow 3) sits at the HUD panel's bottom edge; visible. F11 does not
  change the min-zoom framing (fullView branch). Accepted.
- N-r4-4 Harness: the freeze guard needed 1-2 tries per release; every release stepped. Not a game defect.
- F6 / F8 stay optional and deferred.

Round 4 verdict: **FIXES REQUIRED** (F11). F12 done.

### Round 5 (Director, F11 closed)
- **F11 DONE.** `hudTopInsetAt(base, uiScale, pad)` in `src/game/math/camera.ts` (240 / 304 / 368 at UI 100 / 125 / 150, pad
  `CAMERA.hudTopInsetPadPx` 16); `CameraController.target()` uses it and a `'settings'` subscription refocuses once on a UI scale
  change (not while overridden, not in the choice / postgame portrait). Second cause found in game: the WP20 release nudge
  (`nudgeToward`) panned the fitted Era II view back down (centre y 1333 -> 1438) after the TECH INDEX closed. New pure
  `hudSafeCenterY` clamps the nudge so the machine top stays below the inset at fitted zooms (min zoom fullView unchanged).
- Verify: `eras.mjs` e2b / e2c at 1280x720 and 1920x1080 UI 150: centre y holds 1333 through both releases, piston array
  fully below the panel (top VIEW y 368, ground 620, above the button row). UI 100: centre 1504 unchanged. tiers.mjs full + demo,
  ux.mjs, resolutions.mjs, stages.mjs, store-shots SIZES=1080: fail [] errors []. vitest 126 files / 3731 pass.
- Evidence: `<scratchpad>/WP22/f11/eras2/1280x720-ui150-full/e2c-1mid256.png` (after) vs
  `<A4>eras-ui150b/1280x720-ui150-full/e2c-1mid256.png` (before).

- Opus review of the fix: one blocker (the clamp also fired when the player had zoomed in, so a release nudge could not reach a part).
  Fixed: the clamp applies only when the whole machine fits between the inset and the bottom margin at the current zoom; test added.
  Re-verified: UI 150 centre 1333 holds, UI 100 1504 unchanged, tiers.mjs clean.

Round 5 verdict: **RELEASE-READY** (WP22).
