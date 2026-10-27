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

## WP23a — living world audit (Art Director AD2, 2026-10-24)

Verdict: **FIX LIST** (not RELEASE-READY). 15 F items: 1 S1 (girl mini hidden, her lines point at the motor), 7 S2, 7 S3.
**Q6 gate: PASS** after data tuning (six lit windows + glow read at 1920x1080, default camera, on the powerLines entry).
Text: 15 / 15 captured bubble texts verbatim to the bible bank (`<S>/bible/final/lines.mjs`). Live region `<Speaker>: <line>` OK.

Evidence root `<O>/ad2/` (`<O>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP23a`):
`cap/` full frames + probe JSON per frame, `crops/` 2x-10x nearest crops and boards, `turn/<tag>/` CDP screencast frames + rAF sampler
`log.json`, `walk75/`, `tools/` (capture scripts: `lib.mjs`, `states.mjs`, `bubbles.mjs`, `chain.mjs`, `q6.mjs`, `turn.mjs`, `glances.mjs`,
`sensor.mjs`, `flicker.mjs`, `cycle2.mjs`, `demo.mjs`, `notree.mjs`, `walk75.mjs`; `crop.py`, `strip.py`). Original data file before
tuning: `<O>/ad2/livingWorld.before-ad2.ts`.

Build under audit: at AD2 start `dist/` was the pre-WP23a build (12:47, no world code; `<O>/val/` empty: the T14 gate had not run).
AD2 ran `npm run typecheck` (clean) and `npm run build` (dist, served by :4174) and `npm run build:demo` (dist-demo, :4177 started
once, killed after, port free). Final dist / dist-demo carry the tuned values below. `bundle-budget.mjs`: **FAIL**, app js 499.3 KB > 460
(F14). Staging: buys run with the TECH INDEX open (`t` ... Escape), as in real play; REFOCUS before every default-camera frame.

### Capture index (`<O>/ad2/cap/`)
| set | files |
|---|---|
| states, default camera, quiet | `state-{s0,s2,s7,s8,s9}-{720,1080}.png`; `state-{s7,s9}-{720u125,720u150,deck}.png` (deck = 1280x800 UI 150) |
| cycle 2 era I (fixture `v2-cycle2.json` seeded under `wedtmd.save`) | `cycle2-e1-720.png`, `cycle2-e1-1080.png` (cycle 2, framing e1, booth 42 marks) |
| bubble ladder | `bub-{s7,s9}-{720u100,720u125,720u150,1080,deck}-<LINE>.png` (s7: INS-02 DOG-02 CRW-01 GRL-01; s9: INS-06 PAY-03 DOG-05 GRL-03), 40 frames |
| CROSSED LINES (real generator buy) | `chain-{720u100,720u150,1080}-NN.png` (PAY-01, PAY-01 + CRW-04, INS-05 + CRW-04) |
| demo (:4177) | `demo-{720,1080}-teaser.png` (no bubble), `-card`, `-keep-freeze`, `-PAY-05`, `-INS-07`, `-GRL-06`, `-DOG-12`, `-hold.png` (after reload) |
| Q6 pairs 1920x1080 | `q6-t4-gen-before.png` / `q6-t4-gen-after.png`, `q6-t4-pl-before.png` / `q6-t4-pl-after.png` (+ `-plate` without DOM); shipped values `q6-r0-*`; ladder `q6-t1-*`, `q6-t2-*`, `q6-t3-*` |
| turn / glance | `<O>/ad2/turn/talk-ins02-thr3/` (tracking frame), `turn/talk-ins02-rm/` (reduced), `turn/talk-ins02-nothr/` (fade), `turn/glance-s7b/`; `cap/glance-{s7,s9}-*.png` |
| other | `sensor-cx*.png` (head L/C/R), `flicker-s9-{normal,rm}.png`, `notree-s9-720u150.png` (relocation hold) |

Boards (`<O>/ad2/crops/`): `q6-t4-pl-pair-band.png`, `q6-t4-gen-pair-band.png`, `q6-tuning-ladder-x2.png`, `q6-tower-r0-vs-t1-x3.png`,
`story-talk-ins02.png`, `story-talk-ins02-thr.png`, `story-track-x8.png`, `story-talk-rm.png`, `story-glance-booth.png`, `glances-x4.png`,
`sensor7-heads-x4.png`, `walk-zoom075-x5.png`, `marks-cycle1-vs-cycle2-x8.png`, `marks-mock-v1-x8.png`, `marks-mock-v1-gamescale-x3.png`,
`lampglow-alpha-mock-x3.png`, `girlmini-mock-x2.png`, `girlmini-mock150-x2.png`, `dog-art-frames-x8.png`, `demo-720-hold-dog-x6.png`,
`chain-720u150-stack-x2.png`, `tail-dog02-720u150-x8.png`, `tail-grl01-720u150-x8.png`, `corner-grl01-720u150-x10.png`, `corner-dog02-720u100-x10.png`.

### Q6 proof (era I -> II entry, 1920x1080, UI 100, default camera, quiet world)
| moment | change a player sees | result |
|---|---|---|
| buy `generator` (era card, framing e1 -> s8) | girl window flicker -> dark (one 4x6 art px window, sf .3); girl mini appears **behind the motor** (F1); corner repack is unseen (TECH INDEX open) | no background-scale change (`q6-t4-gen-pair-band.png`) |
| buy `powerLines` (s9), shipped values | canon pylons relit; 3 of the 6 lit windows sit behind the machine ((158,208), (167,207), (404,216) land at screen x 624 / 637 / 993, under the frame and transformer); halo pad 6 at alpha .2 is lost on the .4 skyline | lit windows **do not read** (`q6-r0-pl-before/after.png`, `q6-tower-r0-vs-t1-x3.png`) |
| buy `powerLines`, tuned (t4) | six warm window tiles on two skyline towers (right tower screen ~1270, left tower ~120 at 1080p), plus lamp + glow, booth hood light, motes | **reads without looking for it: PASS** (`q6-t4-pl-pair-band.png`, `q6-t4-pl-before.png` / `q6-t4-pl-after.png`) |

Ladder tried (`q6-tuning-ladder-x2.png`): t1 pad 8 / alpha .3 (big blotchy rect stacks), t2 pad 3 / .5, t3 pad 5 / .4 (overlap stripe between
stacked windows), **t4 pad 3 / .65** = crisp lit tiles, no overlap (vertical window gap is 6 art px, pad 3 + 3 touch). At UI 150 the
left-tower windows at y 334-363 game px sit under the HUD panel; the right tower and the slit stay visible (`state-s9-deck.png`).
A dedicated overlay strip is not needed for WP23a; if a playtest still misses it, the next step is a skyline window-band overlay (AD + EM).

### Tuned values (`src/data/livingWorld.ts`, allowed keys only; `npx vitest run src/data/livingWorld.test.ts` 60 pass, + worldPlacement /
worldState / textSweep 130 pass; typecheck clean; CRLF kept)
| key | was | now | why |
|---|---|---|---|
| `WORLD_ENV.windowAlpha` | 0.85 | 1 | lit core must beat the art's own rust window at .4 layer alpha |
| `WORLD_ENV.windowGlow.padArtPx` | 6 | 3 | no overlap between the stacked tower windows (6 art px gap): crisp tiles, no stripe |
| `WORLD_ENV.windowGlow.alpha` | 0.2 | 0.65 | the halo was invisible on the grey tower at 1080p |
| `WORLD_ENV.windowGlow.color` | 0xad6236 | 0xd9822b | saturated palette orange separates from the grey tower by chroma (same luminance band); windows stay rust-amber |
| `WORLD_FAR_PLANES.windows` | (158,208) 3x6, (167,207) 4x6, (306,120), (306,132), (318,146) 4x6, (404,216) 2x4 | (306,120), (306,132), (318,146) 4x6; (-206,132), (-194,146) 4x6, (-206,155) 1x6 | the three dropped windows are covered by the machine at s9; the new three are real skyline cut-outs on the same tower one tile left (artX - 512), a different subset so the repeat does not show |
Untouched: windowGlow.fadeMs, lampHeadArtPx 49, crowLiftArtPx 58, receiverArt, sensor7.ledArt, clock.faceCenterArt, motes, ring, mainsFlicker
(all land where they should in the crops). Doc follow-up (AD, S3): DENIZEN_ART §5.1 `bg.windowLit` placements row and the
`scripts/art/world/README.md` crop list still name the old six.

### Gates
| gate | result | evidence |
|---|---|---|
| one pixel grid | PASS: every denizen and prop at PIXEL_SCALE 2 like the machine (2 screen px per art px at zoom 1) | `crops/s7-720-right-x3.png`, `crops/story-track-x8.png` |
| palette-only rows | PASS: sepia row I, faded row II on screen; halo `#d9822b`, glow `#ad6236/#c98552`, marks `#a8957a` all palette | `crops/s7-720-left-x3.png`, `crops/s9-720-corner-x4.png` |
| no denizen faces the machine | PASS with one S3: rest poses face away (Inspector left, dog / crow / booth unit right); Sensor 7 points at the frame centre by spec; the Inspector's write frames at the route end face the machine (head bowed) -> F8 | `crops/story-talk-ins02.png` (f003-f005) |
| tail points at the head | FAIL: girl mini hidden behind the motor (F1); CROSSED LINES at UI 150 the PAY-01 box covers the crow its CRW-04 tail points at (F2). All other 36 bubbles: tail on the head / receiver / window | `cap/bub-s9-720u150-GRL-03.png`, `cap/demo-720-GRL-06.png`, `crops/chain-720u150-stack-x2.png` |
| bubble never covers crank / prompt / gain text | PASS: crank hub at game (640, 408), circle + 24 and the gain block (game 656-856 x 160-280 at e1) reserved; GRL-01 at UI 150 drops below the window because above would hit the gain block; no bubble under the crank prompt (onboarding silence) | `cap/bub-s7-720u150-GRL-01.png` |
| nothing un-happens | PASS in I-II: girl window dark stays dark, lamp / windows / booth light stay on, hole only grows (stage rule), dog lie persists after reload | `cap/demo-720-hold.png` |
| ladder (DENIZEN_ART 4.2) | PASS: era I above head at every scale (INS-02 UI 150 device 24-348 x 354-423, panel bottom 298); s9 Inspector INS-06 below the feet at UI 150 and Deck (513-582, buttons start x 712); right wing PAY-03 / DOG-05 at UI 150 top 369 / 399 (toasts end <= 260, buttons >= 639); GRL-01 anchored to the window (tail up at window x 998); chain = 2 bubbles, never overlapping (slot 2 reserves slot 1) | `cap/bub-*` |
| readability floors | PASS: Inspector 66 / 50 px (zoom 1 / .75), dog 32 / 24, crow 28 / 21, booth 96 / 72, Sensor 7 72 / 54, lamp 112 / 84, clock 88 / 66 (logical px). Far-plane girl window / mini are distance figures by design (5x10 body, 20 / 15 px) | crops above |
| roundPixels at zoom .75 | PASS with S3: static sprites hold; walking Inspector steps 6 world px = 4.5 screen px, so the 1 / 2 px art-column pattern flips between steps (mild shimmer at 8 fps) -> F12 | `crops/walk-zoom075-x5.png` |
| DOM tail join | PASS: paper core runs through the border band, down and up tails; notched 2x2 corners. S3: at non-integer root zoom (UI 125 / 150, all 1080p) edges carry a 1 px AA fringe -> F11 | `crops/tail-dog02-720u150-x8.png`, `crops/tail-grl01-720u150-x8.png`, `crops/corner-grl01-720u150-x10.png` vs `crops/corner-dog02-720u100-x10.png` |
| machine stays the focus | PASS except the era II lamp glow: a solid orange plate at the right edge pulls the eye (F4) | `crops/s9-720-corner-x4.png` |
| Sensor 7 head tracking | PASS: camera centre 1620 -> headR, 1320 -> headC, 1170 / 1020 / 870 -> headL (sensor 1384, range 200) | `crops/sensor7-heads-x4.png` |
| girl tone (DENIZEN_ART 2.4) | PASS: window 4x6 and mini 5x10 (<= 12x24), never moves, face a smudge, never in the centre third (screen x 996 window, 177 / 240 mini) | `crops/girlmini-mock-x2.png` |
| bubble text = bible | PASS 15 / 15 verbatim (CRW-01 DOG-02 GRL-01 INS-02 DOG-05 PAY-01 GRL-03 INS-06 PAY-03 INS-05 CRW-04 DOG-12 GRL-06 INS-07 PAY-05) | probe JSON `.bubble.text`, `.live` |
| placeholders never visible in I-II | PASS: frames seen in every probe = inspector idle/walk/write/glance/front/talk, dog sit/sniff/dig/head/talk/lie, crow frozen/head/talk, sensor headL/C/R, lamp dead/lit, clock ruin, booth dark/lit, receiver hang/swing/level, girl window-flicker/window-dark/mini; no ink-silhouette fallback on screen | all `cap/*.json` `.living` |
| turn storyboard | PASS: walk -> front with the tracking band (rows shifted 2 art px, one frame, 226 ms sample under 12x CPU throttle) -> talk / front alternation -> front hold -> snap back to the profile loop (walk, facing away). Deviations: the band is drawn on the front frame, not on the held loop frame (accepted); the head bob never stops (F9) | `crops/story-talk-ins02-thr.png`, `crops/story-track-x8.png`, `crops/story-talk-ins02.png` |
| glance | PASS: Inspector glance = profile body + front head; dog / crow head frame; booth = receiver swings to `level` 1.5 s and back; WORLD VOICES OFF keeps glances. S3: a glance and a line can start on the same frame (F10) | `crops/glances-x4.png`, `crops/story-glance-booth.png` |
| reduced motion (`updateSettings({ reducedMotion: true })`) | PASS: no tracking band on the snap; bubble opacity 1 on its first frame (normal: 0 -> .33 -> .67 -> 1 in 150 ms); mains flicker off (window clip 16 / 16 frames identical vs 11 distinct normal); motes static | `crops/story-talk-rm.png`, `turn/talk-ins02-rm/log.json`, `turn/talk-ins02-nothr/log.json` |
| demo | PASS with F6: teaser shows no denizen and no bubble; POST-CAP PAY-05 / INS-07 / GRL-06 / DOG-12 play in order; after reload the dog lies facing the camera (`variant lie`, x 2856) at 720p and 1080p | `cap/demo-*-teaser.png`, `cap/demo-*-hold.png` |
| cycle 2 era I | PASS: same staging as cycle 1, marks 40 + 2 = 42 drawn (8 groups + 2) | `crops/marks-cycle1-vs-cycle2-x8.png` |

### F-list
| F | sev | what / where | evidence | owner | exact change |
|---|---|---|---|---|---|
| F1 | S1 | Girl mini (era II, pylon plane) stands **behind the motor** at s8 (screen x 177, motor 168-262) and s9 (x 240, motor 191-262). GRL-03/04/05 and the demo's GRL-06 tails point at the motor: the machine seems to speak; her era II arrival is never seen | `cap/bub-s9-720u150-GRL-03.png`, `cap/demo-720-GRL-06.png`, `crops/girlmini-mock-x2.png`, `crops/girlmini-mock150-x2.png` | T15 | `src/data/livingWorld.ts` `WORLD_FAR_PLANES.girlMini.footArtX` 192 -> **146** (12 art px left of the pylon's left leg, art x 158; tile origin stays 576: `farPlaneLiterals` nearest rule picks screen 164 vs the 256 target). Feet strip (868, 1160) -> game x e1 164, s8 84.8 (Inspector body 32-64 clear), s9 170.8 (sprite right edge 175 < machine edge 178). `src/game/math/worldPlacement.test.ts` 'places the girl mini foot': foot {x: 868, y: 1160}, e1 x 164, `Math.round(atS8.x)` 85, `Math.round(atS9.x)` 171; add: s8 x + 8 < 152 and s9 x + 6 < 178 (half sprite width vs the machine left edge per framing) and s8 x - 8 > 64 (Inspector body) |
| F2 | S2 | CROSSED LINES at UI 150 (s8): PAY-01 bubble (device 942-1270 x 440-513) covers the crow; CRW-04's tail points at the PAY-01 box. Two speakers share the right wing, the ladder only reserves the other bubble | `crops/chain-720u150-stack-x2.png`, `cap/chain-720u150-02.png` | EM | `src/ui/worldBubbleController.ts` `reservedFor(slot, g)`: also reserve the figure of every other speaker of an active line or chain on screen: `{ x: head.x - 12, y: head.y - 4, w: 24, h: feet.y - head.y + 4 }` (root CSS px, from the director's anchor). PAY-01 then falls to `side` (left of the receiver, over the generator) and the crow stays visible. Recheck `chain-720u150` and world.mjs B |
| F3 | S2 | Booth tally marks read as a lit 3x3 window grid: 4 strokes at pitch 1 merge into solid 4x4 blocks, the 5th (diagonal) is drawn on top and vanishes. Open question 1 ("what do the 41 marks count?") is lost | `crops/s7-720-booth-x8.png`, `crops/marks-cycle1-vs-cycle2-x8.png`, mock `crops/marks-mock-v1-x8.png`, `crops/marks-mock-v1-gamescale-x3.png` | EM (code + test) + T15 (data) | `WORLD_MARKS` = `{ base: 40, groupSize: 5, groupCols: 2, rows: 5, strokeH: 4, strokePitch: 2, groupPitch: 9, rowGap: 1, slash: [[1, 3], [3, 2], [5, 1]], pane: { x: 6, y: 13, w: 16, h: 24 }, color: 0xa8957a }` (capacity 50). `src/game/math/worldPlayback.ts` `tallyRects`: `x0 = (g % groupCols) * groupPitch`, `y0 = floor(g / groupCols) * (strokeH + rowGap)`; mark j < 4 -> `{ x: x0 + j * strokePitch, y: y0, w: 1, h: strokeH }`; j = 4 -> one 1x1 rect per `slash` entry at `(x0 + dx, y0 + dy)` (the slash sits in the gaps, so it shows). Update `worldPlayback.test.ts` tallyRects cases (41 -> 8 groups + 1 stroke; 45 -> 9 groups; rects inside 16x24) |
| F4 | S2 | Era II lamp glow renders at alpha 0.8: a solid orange plate (mushroom cap) on the lamp, the brightest object at the frame edge; spec is a faint two-step halo (.22 / .12) | `crops/s9-720-corner-x4.png`, mock `crops/lampglow-alpha-mock-x3.png` | EM | `src/game/rendering/WorldProps.ts` `LAMP_GLOW_ALPHA` 0.8 -> **0.4**, moved to data as `WORLD_ENV.lampGlow: { alpha: 0.4, brightAlpha: 0.2 }` so the AD can tune it (ripple bump `LAMP_BRIGHT_ALPHA` 0.2 -> `brightAlpha`) |
| F5 | S2 | Buys made outside the TECH INDEX keep the e1 placements at s8 / s9 (relocation hold): dog under the generator, crow on top of it. Real play buys inside the tree (correct there), but `world.mjs` case D buys with `buyList` alone, so `D_s8_placed` / `D_s9_placed` will fail at the gate | `cap/notree-s9-720u150.png` + `.json` (framing s9, placements dog 2364, crow 2476) | EM (T12) | `scripts/smoke/world.mjs` `caseD` (and caseG before `G_display`): `await page.keyboard.press('t'); await sleep(400);` before each `buyList`, `await page.keyboard.press('Escape'); await sleep(600);` after. Guard (director, optional): a held placement whose x lies inside the new framing's machine box (A1 rule) hides until the next unseen moment instead of drawing over the machine |
| F6 | S2 | Dog front-head frames (`head`, `talk`, `lie` = the demo hold image) read as a cat: two pointed ears, round face, no muzzle | `crops/dog-art-frames-x8.png`, `crops/demo-720-hold-dog-x6.png`, `crops/demo-1080-hold-corner-x2.png`, `crops/glances-x4.png` | AD | masters `scripts/art/world/masters/dog/`: on head / talk / lie add a 3 px light muzzle (`t`) one row below the eye line with a 1 px ink nose at its bottom centre; torn ear = 1 px folded stub at the skull side (not a triangle); head 1 px wider at the jaw. Rebake 6 rows, gates (score >= 90, lint 0/0, silhouette 1, check_sheet), `worldSheets.test.ts` |
| F7 | S2 | Dog hole (era II, `load-beneath`) sits under the dog's head (dog x + 20, depth row -0.1): only a 1-row sliver shows in dig frames; "what is under the ground?" has no picture | `crops/s9-1080-dog-hole-x5.png` | T15 (+ EM for world.mjs) | `WORLD_PLACEMENTS` hole x = dog x + 30: e1 2384 -> **2394**, s8 2624 -> **2634**, s9 2876 -> **2886** (pit spans x+14..x+46, nose at x+20 stays in it). `livingWorld.test.ts` placement rows; `scripts/smoke/world.mjs` `PLACED.*.hole` same numbers; DENIZEN_ART §3 props row (AD doc) |
| F8 | S3 | Inspector write frames at the route end (dx +24, no flip) face the machine | `crops/story-talk-ins02.png` f003-f005 | T15 | `WORLD_LOOPS.inspector` entries 10-13 (`write0`, `write1`, `write0`, `write1` at dx 24): add `flip: true` (he turns, writes facing away, walks back) |
| F9 | S3 | Talk bob runs for the whole bubble (`OPEN_TALK_BLIPS = Infinity`); spec: min(words, 8) blips at 8 fps, then hold front. Audio blips stop, the head keeps nodding 4-6 s | `turn/talk-ins02-thr3/log.json` (talk/front to the end) | EM | `src/game/rendering/LivingWorld.ts`: `setTalking(id, on, blips?)` stores `blipCount(text)` on the turn (director passes it at bubble show); `turnPose` -> `talkPose(t, turn.tl, turn.blips ?? 8)` |
| F10 | S3 | A glance and a line can start on the same frame: front -> glance -> front flash inside a talk turn, and a crow `head` glance during INS-04 (glance within 10 s of a bubble) | `turn/talk-ins02-thr/log.json` (659 front, 764 glance, 867 front), `tools/dbg-glance.mjs` output | EM | `LivingWorldDirector.update()`: run `scheduler.tick()` / `startCue()` before `stepGlances()`, and in `stepGlances` return when `this.active.length > 0` after the cue (already checked) or when a cue started this frame |
| F11 | S3 | Bubble edges blur by 1 px at non-integer `#ui-root` zoom (UI 125 / 150, every 1080p frame): translate in fractional CSS px | `crops/corner-grl01-720u150-x10.png` vs `crops/corner-dog02-720u100-x10.png` | EM | `src/ui/worldVoice.ts` move(): `x = Math.round(x * zoom) / zoom`, `y = Math.round(y * zoom) / zoom` before `transform: translate(...)`; same for `--tx` |
| F12 | S3 | Walk shimmer at zoom .75: route steps of 6 world px = 4.5 screen px flip the 1 / 2 px art-column pattern every step | `crops/walk-zoom075-x5.png` | T15 | `WORLD_LOOPS.inspector` dx values on multiples of 8 (-24, -16, -8, 0, 8, 16, 24; frames walk0-3 cycling, write at 24): 8 world px = 6 screen px = 4 art px at .75, so the column pattern holds; zoom 1 / .5 unaffected |
| F13 | S3 | Debug: `worldSay` is accepted while the World sleeps (demo teaser / card): `silence` stays `null` (refreshSilence runs only in update), GRL-05 sits in `activeLines` through teaser and card, no bubble | `tools/dbg-teaser.mjs` output (phase teaser, `sil: null`, `say=true`) | EM | `LivingWorldDirector`: `onSleep()` sets `this.silence = 'asleep'`; `debugSay()` calls `refreshSilence()` first. `scripts/smoke/demo.mjs` `B_bubble_hidden_teaser` also requires `said === false` |
| F14 | S2 | Bundle budget: app js 499.3 KB > 460 (A12 expects about +15 KB; actual +96.5 KB over 402.8) | `node scripts/perf/bundle-budget.mjs` -> `bundle budget: FAIL (1 breach)` | EM | find the growth (likely data / sheet tables or a duplicated import in the living-world chunk); split the world layer into a lazy chunk or trim, then re-run the budget |
| F15 | S3 | Docs: DENIZEN_ART §5.1 `bg.windowLit` placements and `scripts/art/world/README.md` crop list still name the old six windows | this section, Tuned values | AD | update both to the tuned list |

Accepted notes (no fix): tracking band drawn on the front frame instead of the held loop frame (reads as the same glitch); lamp / clock
props are full-colour iron next to the sepia booth in era I (they are not era-row sheets; matches the machine); at UI 150 the left-tower
lit windows sit under the HUD panel (right tower carries Q6); GRL-01 goes below the window at UI 150 (gain block above); CROSSED LINES
waits for the 120 s min gap after INS-04 (scheduler rule, not art); booth hood light in `lit` is 2 px (fine at s9).

Round 2 (AD2b) re-checks: F1 (`bub-s9-*-GRL-03`, `demo-*-GRL-06`, `q6-*-gen-after` mini visible), F2 (`chain-720u150`), F3 / F7 (booth and
dog crops at e1 / s9), F4 (`s9` corner), F6 (hold image 720 / 1080), F5 (world.mjs D green), F14 (budget PASS), then the S3 items.

### WP23a round 2 (Art Director AD2b, 2026-10-24)

Verdict: **FIX LIST** (not RELEASE-READY). Fixed 4 / 15 (F1, F7, F8, F12, all data). Open 11 (F3 now **S1**: T15 half-applied,
typecheck red) + new F16 (S2, from the F1 move) + sub-items F1b, F7b. **Q6: PASS** (re-run, same as AD2 t4). Placeholders: none on screen.

Build under audit: T15 changed only `src/data/livingWorld.ts` + `src/data/livingWorld.test.ts` (17:48; F1 `footArtX` 146, F3 new
`WORLD_MARKS` shape, F7 hole + 30, F8 write flip, F12 dx on 8). No EM code fix landed (`WorldProps.ts`, `LivingWorld.ts`,
`LivingWorldDirector.ts`, `worldBubbleController.ts`, `worldVoice.ts`, `worldPlayback.ts`, `world.mjs`, `demo.mjs` untouched since AD2).
No EM rebuild (`dist/` = AD2 build 17:25). `npm run typecheck`: **FAIL** `src/game/math/worldPlayback.ts(165,48): TS2339 Property 'gapX'
does not exist` -> `npm run build` blocked. `npx vitest run src/data/livingWorld.test.ts src/game/math/ src/ui/worldVoiceModel.test.ts`:
7 fail / 1040 pass (all 7 = `worldPlayback.test.ts > tallyRects`). AD2b captured a vite-only scratch build of the working tree
(`npx vite build --outDir <O>/ad2b/dist-t15`; `--mode demo` -> `dist-demo-t15`) served to Playwright by route interception (no port;
4174 / 4177 untouched). Evidence root `<O>/ad2b/`: `cap/`, `crops/`, `frames/` (CDP screencast frames named by the rAF variant at the
frame time), `turn/`, `tools/` (AD2 tools + `lib.mjs` route base, `sync.mjs` / `dogsync.mjs`, `maskset*.py`).

| F | round 2 | evidence (`<O>/ad2b/`) | note / owner |
|---|---|---|---|
| F1 | **FIXED** | `crops/f1-s8-720-girl-x4.png`, `crops/f1-s9-720-girl-x4.png`, `crops/q6-r2-gen-after-left-x3.png`, `crops/f1-grl03-720u150-tail-x6.png`, `crops/f1-grl03-1080-tail-x6.png`, `cap/demo-720-GRL-06.png` | girl mini clear of motor and Inspector: game x ~85 at s8, ~171 at s9 (motor base 192); she stands on the pylon foot line. GRL-03 tail on her head at 720u100 / 720u150 / 1080 / Deck, demo GRL-06 too. **F1b open (S3, T15 / EM):** `worldPlacement.test.ts` 'places the girl mini foot' still hard-codes foot (960, 1160) and 177 / 240 and never reads `WORLD_FAR_PLANES.girlMini`: green, but it no longer guards the shipped value. Apply the AD2 F1 test spec |
| F2 | STILL OPEN | `cap/chain-720u150-02.png` | PAY-01 box over the crow, CRW-04 tail on the PAY-01 box (code unchanged). EM: fold into F16 |
| F3 | STILL OPEN, **S1** | `crops/f3-s7-720-booth-x6.png`, `crops/f4-s9-720-corner-x4.png` (empty pane) | data in, code not: `tallyRects` reads `gapX` -> typecheck red, build blocked; in a vite-only build every rect x = NaN and the booth pane shows **no marks**. EM first: `tallyRects` + `worldPlayback.test.ts` per the AD2 F3 spec (data already matches) |
| F4 | STILL OPEN | `crops/f4-s9-720-corner-x4.png` | orange plate on the lamp (code unchanged). EM per AD2 |
| F5 | STILL OPEN | `scripts/smoke/world.mjs` caseD lines 287-299 | still `buyList` outside the TECH INDEX. EM per AD2 |
| F6 | STILL OPEN | `crops/f6-demo-720-hold-dog-x8.png`, `crops/dog-sheet-keyframes-x8.png` | `dog.png` / `masters/dog/dog.txt` unchanged (14:43): head / talk / lie (= demo hold image) still a cat face. AD art task per AD2 |
| F7 | **FIXED** | `crops/f7-s9-1080-dog-hole-x5.png`, `crops/f7-dogsync-s9-1080-x3.png`, `crops/f7-hole-sit-vs-dig-x8.png`, `crops/f6-demo-720-hold-dog-x8.png` | stage-1 pit now shows whole: right of the paws in sit / sniff, at the nose in dig, and in the demo hold image. **F7b open (S2, gate):** `world.mjs` `PLACED.{e1,s8,s9}.hole` still 2384 / 2624 / 2876 -> `D_*_placed` fails against data 2394 / 2634 / 2886 (EM). DENIZEN_ART §2 (line 211) and §3 (line 316) hole rows `dog x + 20` -> `+ 30` (AD doc, with F15) |
| F8 | **FIXED** | `frames/ins-s9-720b/`, `crops/f8-f12-ins-s9-075-x4.png` (cells 008-010) | write0 / write1 at dx 24 drawn flipped: he turns, writes facing away, walks back |
| F9 | STILL OPEN | `turn/talk-ins02/log.json` | talk / front toggles from 992 ms to the end of the 7 s window (code unchanged). EM per AD2 |
| F10 | STILL OPEN | `LivingWorldDirector.ts` 310-313 | `stepGlances` still runs before `scheduler.tick` / `startCue`. EM per AD2 |
| F11 | STILL OPEN | `crops/f11-corner-chain-720u150-x10.png` | border row at UI 150: (162,147,120) fringe, ink, ink, (121,109,89) fringe. EM per AD2 |
| F12 | **FIXED** | `crops/f12-walk-pattern-x8.png`, `frames/ins-s9-720b/` | route x 1448..1496 on 8 px steps; the same pose at x 1488 and 1456 is pixel-identical after the 24 screen px shift: no column flip at zoom .75 |
| F13 | STILL OPEN | `cap/demo-720-teaser.png` + run log (`teaserSay: true`, no bubble) | `worldSay` still accepted while asleep. EM per AD2 |
| F14 | STILL OPEN | `node scripts/perf/bundle-budget.mjs <O>/ad2b/dist-t15` | app js 499.4 KB > 460: FAIL. EM per AD2 |
| F15 | STILL OPEN | DENIZEN_ART.md line 490, `scripts/art/world/README.md` line 150 | still the old six windows. AD doc task |
| **F16** | **NEW, S2** | `crops/grl03-720u100-wide-x3.png`, `crops/grl03-1080-wide-x2.png`, `crops/f1-grl03-720u150-wide-x4.png`, `crops/grl03-deck-wide-x3.png`, `crops/f16-grl06-720-x3.png` | with the girl at x ~171 her bubbles (GRL-03..06, demo GRL-06) take `above` over the left wing and sit on the **Inspector's head** (720u100, 1080); at 720u150 / Deck also on **Sensor 7's head**. Tail is right, but a primary face is hidden and the box reads as his. Owner EM, exact change below (also closes F2) |

F16 + F2 exact change (EM; `src/ui/worldBubbleController.ts`, director feeds it):
- `BubbleControllerDeps.figures(): readonly { id: SpeakerId | 'sensor7'; head: Vec2; padX: number }[]`: world-px head of every visible
  ground denizen (inspector, dog, crow, sensor7) at its **placement** x (not the animated x, so the box does not chase the walk);
  `padX` world px: inspector 36 (route +-24 + 12), dog / crow / sensor7 12.
- `reservedFor(slot, g)`: besides the other slot's box, reserve for every figure whose id != the slot's speaker the game-px box
  `{ x: s.x - padX * zoom, y: s.y - 4, w: 2 * padX * zoom, h: 24 }` (`s` = `screenOfWorld(head, 1, camera)`, as the anchor path does),
  converted with the geo (kx, ky, ox, oy). Ladder order unchanged.
- Expected: GRL-03 / GRL-06 drop to `below` (ground band, tail up, as AD2 saw at UI 150), PAY-01 moves off the crow, Inspector and
  Sensor 7 stay visible. Gate: no era I-II line ends `blocked` in `bubbles.mjs` s7 / s9 x 5 viewports, `chain.mjs`, `demo.mjs`.

Checks this round:
| check | result | evidence |
|---|---|---|
| Q6 pair, 1920x1080, UI 100, default camera, quiet | **PASS**: `powerLines` adds six lit window tiles on the two skyline towers (left ~x 120-150, right ~x 1270-1300) + lamp glow + booth light + relit insulators; `generator` adds the dark girl window and the now visible girl mini (game x 84), not background scale: `powerLines` carries Q6. Cams e1 (1, 1920, 1520), s8 (1, 2064, 1464), s9 pre (.75, 2176, 1504), s9 (.75, 2192, 1504) | `cap/q6-r2-{gen,pl}-{before,after}[-plate].png`, `crops/q6-r2-pl-pair-band.png`, `crops/q6-r2-gen-after-left-x3.png` |
| DENIZEN_ART 8.2 on the changed frames | one grid PASS (F12 identical patterns); palette PASS (no art changed); no denizen faces the machine PASS (F8 flip); tail on head PASS for the girl at all 4 viewports, F2 still FAIL; crank / prompt / gain PASS (ladder unchanged); nothing un-happens PASS (hole at the new x, stage 1, kept after the demo reload) | crops above |
| placeholders never visible in I-II | **PASS**: 36 probes, visible frames = clock ruin; crow frozen / head; dog sit0 / sit1 / sniff0 / dig0 / dig1 / head / talk / lie; girl window-flicker / mini; inspector idleA / idleB / walk0-3 / write0 / write1 / front / talk; lamp dead / lit; payphone dark / lit / ring1; receiver hang / swing0-2 / level; sensor7 headR. No ink fallback on screen. The empty booth pane is F3 (missing marks), not a placeholder | `cap/*.json .living` |
| text | verbatim to the bible bank: INS-06 PAY-03 DOG-05 GRL-03 PAY-01 CRW-04 INS-05 PAY-05 INS-07 GRL-06 DOG-12 | probe `.bubble.text`, run logs |
| dog frame vs debug variant | match within one frame (CDP screencast + rAF log on one clock); the AD2-era screenshot mismatch was capture latency | `crops/f7-dogsync-s9-1080-x3.png` |

Accepted notes (no fix): the new inspector loop has three in-place walk frames per lap (walk0 at -24 after the idles, walk3 at +24,
flipped walk0 at +24 after writing): 125 ms start / stop steps, they read as settling. The girl mini (5x10) reads as a small far figure
at the pylon foot (design, DENIZEN_ART 2.4). No allowed-key tuning this round: no open item is a WORLD_ENV / windows number (F4 needs
the AD2 code move to data first).

Order for the Director: EM F3 first (unblocks typecheck and build), then F16 + F2, F7b + F5 (world.mjs), F4, F9, F10, F11, F13, F14,
F1b; AD art / doc task F6 + F15 + the hole row. Round 3 (AD2c) after a real `npm run build` / `build:demo`: F3 (booth s7 + cycle 2),
F16 / F2 (`bub-s9-*-GRL-03`, `chain-720u150`, demo GRL-06), F4, F6 hold image, F9-F11, F13, F14 budget, world.mjs D green.

### WP23a round 3 (Art Director AD2c, 2026-10-24)

Verdict: **FIX LIST** (not RELEASE-READY). Closed this round: F1b F2(geometry) F3 F4 F5 F6 F7b F9 F10 F11 F13 F14 F15 F16 + the S3
Sensor 7 head. **New S1: F17, F18, F19** (all one cause family: the F16 head reserve leaves the payphone no ladder step on the
right corner, and two schedulers do not survive a waiting / blocked member) and **F20** (test pin of my Q6 tuning, trivial).
**Q6 era I -> II entry (generator): PASS** after the AD2c data change below. Placeholders on screen: none (88 probes).

Build under audit: waves 1-2 landed (typecheck clean, vitest 134 files 3978 pass / 17 skipped before AD2c). AD2c ran
`npm run typecheck` (clean), `npm run build` (dist on :4174), `npm run build:demo` (dist-demo, served to Playwright by route
interception, no port; 4177 never started). `node scripts/perf/bundle-budget.mjs`: **PASS** app js 438.3 KB (limit 460; the
living world is a lazy chunk `LivingWorldDirector-*.js` 67.7 KB), css 41.0 / demo 43.7 KB (45). After AD2c tuning:
`npx vitest run` 1 fail / 3977 pass / 17 skipped (the fail is F20), typecheck clean. Evidence root `<O>/ad2c/`: `cap/` frames +
probe JSON, `crops/`, `turn/`, `tools/` (AD2b tools on :4174 + `bub3.mjs` ladder with head-overlap test and a blocked check,
`holdforce.mjs`, `dogprev.py`, `doghead.py`, `s7draft.py`, `s7prev.py`, `setwin.py`, `bandmock.py`), `vt/ladder.test.ts` (scratch
vitest probe of the real `placeBubble`), `work/` (masters and data before AD2c: `dog.before.*`, `sensor7.before.*`,
`livingWorld.before-ad2c.ts`).

**Art (AD, done).**
| item | change | gates | evidence |
|---|---|---|---|
| F6 dog front head (head, talk, lie) | flat skull top; torn ear = 1 px flap folded down on the right skull side (no second point); `t` bridge between the eyes; 3 px `u` muzzle one row below the eye line with the ink nose `K` at its bottom centre; jaw 1 px wider; `u` chin; talk drops the chin over the collar. `u`, not `t`: `t` bakes to the lit-coat sepia in rows I-II | check_sheet CLEAN; workbench halves 99.3 / 99.6, lint 0 / 0; silhouette 1 per cell (18 on the 3 columns x 6 rows); `worldSheets.test.ts` 20 / 20; only columns 12 / 13 / 15 changed | `crops/dog-heads-before-after-x12.png`, `crops/dog-contact-ad2c.png`, in game `crops/f6-dog-ingame-z1-z075.png` (zoom 1 and .75, 720p / 1080p), hold image after reload `crops/f6-hold-reload-720-1080.png` |
| S3 Sensor 7 headR (and the mirror headL) | redrawn as 3/4 heads: side panel shows, lens ring 5 wide flush with the turn-side box edge, glass 3x4 still facing the viewer, no barrel past the box. The old flank lens + barrel pointed at the machine at e1 / s9 (bible 3.6: it watches the camera). Frame order and sheet size unchanged | check_sheet CLEAN; workbench 95.6, lint 0 / 0, 48 components = 1 per cell; `worldSheets.test.ts` 20 / 20; only columns 1 / 3 changed | `crops/s7-heads-before-after-x10.png`, `crops/sensor7-contact-ad2c.png`, in game `crops/s3-sensor7-headR-ingame.png` |

Note for the Director: Task 2 needed `public/assets/world/sensor7.png` (rebuilt from `scripts/art/world/masters/sensor7/`), which
was not in the AD2c file list; nothing else in `public/` changed besides `world/dog.png`.

**Q6 era I -> II entry (generator, s8), 1920x1080, UI 100, default camera, quiet, buys inside the TECH INDEX.**
Shipped W1-C (dim .5, AD2 six windows): the generator pose shows only the 3 right-tower windows (the 3 left-tower ones sit at
game x -66, off screen), muted at .5; the tower already had the girl's warm flicker, so the net change reads as "one warm tile
became three dim ones": **does not read without looking** (`cap/q6-c0-gen-*`, `crops/q6-c0-gen-pair-right.png`). Ladder:
dim .9 alone (`crops/q6-c0-vs-c1-gen-after.png`, still one tower); a light-spill ellipse mock behind the group (no gain,
`crops/q6-bandmock-s8-a25-a40.png`, rejected); all six on the big central tower (c2: the s9 pylon plane crosses three of them,
rejected, `crops/q6-c2-pl-tower-x3.png`); **hybrid h** = three right-tower windows (AD2) + three real cut-outs in the upper floors
of the big central tower, chosen clear of the s8 / s9 machine top, the HUD at UI 150 and the s9 pylon, halos touching without
overlap. Dim ladder on h: .5 muted, .7 reads, .9 crisp (`crops/q6-h-dim-ladder.png`) -> .85.
Result: the generator now lights six warm tiles on two towers right above the machine, where the eye already is, while the girl
window goes dark. **Reads without looking for it: PASS.** powerLines keeps its own step (windows full, lamp + glow, booth light,
motes, canon pylons). Final pairs: `<O>/ad2c/q6-gen-before.png`, `q6-gen-after.png`, `q6-pl-before.png`, `q6-pl-after.png`,
band board `<O>/ad2c/q6-band-pairs.png` (half size `crops/q6-band-pairs-half.png`). Dim windows sit on the far plane (depth
background + 21.5) behind the machine: never over it (all `state-*` frames, UI 100 / 150, deck).

Tuned values (`src/data/livingWorld.ts`, allowed keys only, CRLF kept):
| key | was | now | why |
|---|---|---|---|
| `WORLD_ENV.windowDimLevel` | 0.5 | 0.85 | Q6: .5 was muted on the grey towers at 1080p |
| `WORLD_FAR_PLANES.windows` | (306,120) (306,132) (318,146) 4x6; (-206,132) (-194,146) 4x6; (-206,155) 1x6 | (306,120) (306,132) (318,146) 4x6; (143,71) 2x4; (131,99) 4x4; (134,109) 1x3 | the left-tower three were off screen in the generator pose and under the HUD at UI 150; the new three are real `#2b2e31` cut-outs of `bg/skyline.png`, visible in s8 and s9 |
Untouched: windowGlow (pad 3, .65, `#d9822b`, 1500 ms), windowAlpha 1, lampGlow (.4 / bump .2: W1-C numbers confirmed in
`WorldProps.ts` `(alpha + bump) * mains`), motes. Six windows stay six (bible era V countdown).

**Round 3 checks.**
| F | result | evidence (`<O>/ad2c/`) |
|---|---|---|
| F16 | **FIXED**: GRL-03 / 04 / 05 at s9 and demo GRL-06 go `below` (tail up to the girl mini) at 720u100 / 720u150 / 1080 / deck; Inspector and Sensor 7 stay visible; head-overlap test 0 hits on 30 shown bubbles | `crops/f16-grl-below-4vp-x2.png`, `cap/bub-s9-*-GRL-0{3,4,5}.png` + JSON `.covers` |
| F2 | geometry FIXED (PAY-01 never lands on the crow) but see F17 / F18: PAY-01 now shows last (720u100, 1080) or never (720u150, deck) | `cap/chain-*-0N.png`, `chain-run.txt` |
| F3 | **FIXED**: 41 = 8 groups + 1, cycle 2 = 8 + 2, read as tally marks, no window grid | `crops/f3-booth-s7-vs-cycle2-x6.png` |
| F4 | **FIXED**: faint two-step halo at .4, no plate | `crops/f4-s9-720-corner-x5.png`, `crops/f4-s9-1080-corner-x4.png` |
| F5 / F7b / F1b | **FIXED** (code read): world.mjs case D buys inside the TECH INDEX, `PLACED.*.hole` 2394 / 2634 / 2886, the girl-mini test reads `WORLD_FAR_PLANES` | `scripts/smoke/world.mjs` 51-53, 254-260; `worldPlacement.test.ts` 145-151 |
| F6 | art **FIXED**; hold image after reload = `lie` at 720p and 1080p **only with DOG-12 forced**: the natural POST-CAP arc never reaches DOG-12 (F18 + F19), reload shows `dig1` | `crops/f6-hold-reload-720-1080.png`, `holdforce` vs `demo-run.json` |
| F9 | **FIXED**: INS-02 = 6 talk / front pulses 636-1901 ms (6 words), then front hold to the bubble end | `turn/talk-ins02b/log.json` |
| F10 | **FIXED**: with a line and a glance due on one frame, the line starts and no random glance shows; WORLD VOICES OFF keeps glances (receiver `level`). One of three runs showed inspector `glance` + crow `head` at the start of INS-04: that is the `beat.failedSync` (dog, inspector, crow 250 ms apart; in `seen`), held by debug quiet until the frame the line was due (accepted note) | `glance-run.txt`, `glance-run2.txt` |
| F11 | **FIXED**: bubble corners at UI 150, 1080 and deck = ink + paper only (3 colours in a 14 px corner box, no fringe) | `crops/f11-corner-720u150-vs-u100-x12.png`, `crops/f11-corner-1080-x12.png` |
| F13 | **FIXED**: demo teaser `worldSay('GRL-05')` = false, no bubble | `demo-run.json` (`teaserSay: false`) |
| F14 | **FIXED**: budget PASS, app 438.3 KB | `bundle-budget.mjs` |
| F15 | **FIXED** (AD doc): DENIZEN_ART 2.2 / 2.4 / 2.5 / 2.6 / 3 / 4.2 / 5 / 5.1 and the README match the data (hole x + 30, girl mini foot 146 / strip (868, 1160) / game x 164 / 85 / 171, the new six windows, WORLD_MARKS, lamp glow .4 / .2, windows dim at generator, head reserve, 3/4 Sensor 7 heads) | docs |
| 8.2 house rules on changed frames | one grid PASS; palette PASS (check_sheet); no denizen faces the machine PASS (dog front head to camera, Sensor 7 3/4 to the viewer); tail on head PASS for every shown bubble; crank / prompt / gain PASS (ladder unchanged); nothing un-happens PASS (lie persists after reload, hole stays) | crops above |
| placeholders | none on screen in 88 probes (inspector idle / walk / write / front / talk, dog sit / sniff / dig / head / talk / lie, crow frozen / head, sensor7 headR, lamp dead / lit, clock ruin, booth dark / lit / ring, receiver hang / swing / level, girl window-flicker / mini) | `cap/*.json .living` |
| text | every shown bubble verbatim to the bank (INS-02 DOG-02 CRW-01 GRL-01 INS-06 DOG-05 GRL-03 GRL-04 GRL-05 PAY-01 CRW-04 INS-05 INS-07 GRL-06 DOG-12) | probe `.bubble.text` |

**F-list (open).**
| F | sev | what / where | evidence | owner | exact change |
|---|---|---|---|---|---|
| F18 | S1 | Every payphone line is **blocked** on the right corner since the F16 head reserve: PAY-03 at s9 BLOCKED at 720u100 / 720u150 / 1080 / deck (11.6-11.8 s wait, never shown); demo PAY-05 blocked; PAY-02 (core, `buy powerLines`) and PAY-04 share the geometry. Real `placeBubble` on the measured s9 UI 100 geometry (receiver head (1224, 459), feet 492, box 216x46, crow reserve (1234, 380, 18, 24), dog reserve (1129, 485, 18, 24)) returns null: above hits the crow over the lamp, below hits the dog, the centred side-left box hits the dog; without the reserves it is `above` (1056, 399) as in AD2b | `cap/bub-s9-*-PAY-03.json` (`shown: BLOCKED`), `vt/ladder.test.ts` | EM | `src/game/math/worldBubble.ts` `sidePlacement`: per wing (outward first) try two y values, the current centred `mid - h / 2`, then head-aligned `head.y - h - tailH` (body + tail end at the head line), both clamped as now; first box clear of every reserved rect wins. Prototype in `vt/ladder.test.ts`: s9 UI 100 -> side-left (994, 405); s9 UI 150 (root px) -> (586, 252); s8 PAY-01 UI 150 -> (574, 301). Add these three as `worldBubble.test.ts` cases (crow + dog reserves) and re-run `bub3.mjs` (PAY-03) and `chain.mjs` |
| F17 | S1 | CROSSED LINES plays **out of order**: CRW-04 ("Operator. Operator.") shows first, then INS-05, and PAY-01 ("Hello? Operator?") last at 720u100 / 1080 and never at 720u150 / deck. `chainTick` treats "no bubble visible" as the step wait being over, so step 2 starts during PAY-01's 2.2 s dial + ring prelude (and during any placement wait) | `chain-run.txt`, `cap/chain-720u100-0{1,2,3}.png` | EM | `src/game/math/worldVoice.ts` `chainTick`: return null while a member of the run is in flight and has not shown yet (new ctx flag, e.g. `chainMemberWaiting`, set by the director from `this.active` lines with `phase === 'wait'` and a chain id); the run goes on after that member shows for `chainStepAfterMs` or ends blocked (placeWait). Unit test: step 2 is not offered while step 1 waits in its prelude. Recheck `chain.mjs` x 4 viewports: PAY-01, CRW-04, INS-05 in order |
| F19 | S1 | The demo POST-CAP arc **stalls on a blocked member**: a POST-CAP line under 60 % (PAY-05 blocked) puts the cursor back to it with `nextAtMs = now`, so it retries every placeWait and DOG-12 never comes: no `lie` hold image after reload (dog `dig1`; `seen` lacks DOG-12) | `demo-run.json`, `cap/demo-720-DOG-12.json` (`activeLines: ['PAY-05']`) | EM | `worldVoice.ts` result handler, `rec.kind === 'postCap'`: when the line never showed (fraction 0 from a placeWait expiry, not a cut), count it; after 2 blocked attempts move the cursor past it (it stays unseen) so the arc reaches DOG-12. F18 removes today's trigger; this keeps the hold image safe from any future layout block. Test: a POST-CAP member blocked twice is skipped and the next step plays |
| F20 | S1 (gate, trivial) | `src/data/livingWorld.test.ts` 439 pins `WORLD_ENV.windowDimLevel` to 0.5; AD2c tuned it to 0.85 (Q6) | vitest 1 fail | EM | `expect(WORLD_ENV.windowDimLevel).toBe(0.85);` (keep the > 0 / < 1 checks). No test pins the window list |

Accepted notes (no fix): at 6x zoom a tally group can read as "UH" (slash pixels in the gaps); at game scale the groups read as
marks and the count difference shows (slash mocks `crops/f3b-slash-mock.png`: no variant better). The 2x4 / 1x3 window crops take
the top-left of the 4x6 lit frame, so the small ones show a darker L of pane inside the halo; at 1080p it reads as a lit tile.
The side bubble of F18 may cover the street clock (a prop, not a face). A wordless beat and a line can start on one frame (seen only with
debug quiet holding `beat.failedSync`; in play the wornMotor beat and INS-04 are minutes apart); optional EM guard: no line starts
while a beat runs.

Order for the Director: EM F18 + F17 + F19 + F20 (one package: `worldBubble.ts`, `worldVoice.ts`, `LivingWorldDirector.ts`
ctx flag, tests), rebuild, then AD2d short recheck: `bub3.mjs` (PAY-03 shown at 4 viewports, no head covered), `chain.mjs`
(order PAY-01, CRW-04, INS-05 at 4 viewports), `demo.mjs` natural arc (PAY-05 ... DOG-12, then `lie` after reload), world.mjs D.
Gates proved green this round (keep): Q6 era II entry, F3 F4 F6-art F9 F10 F11 F13 F14 F16, budget, placeholders, palette.

### WP23a round 4 (Art Director AD2d, 2026-10-25)

Verdict: **FIX LIST** (not RELEASE-READY)

Closed this round: **F17, F18, F19, F20** (all proved on the final build), Q6 era I -> II entry **PASS**, bubble font = HUD
face **PASS**. Open: two new **S2**, both small code fixes with a proven prototype: **F21** (a side bubble in `centred` y mode
hangs its tail at the ground beside a short speaker: DOG-02 at 720p UI 150 and Deck) and **F22** (the demo tape freeze shows no
tracking line: the cast arms it from a clock that stopped while the World slept under the END OF DEMO card). A13 stays open
until both land and AD2e rechecks them.

Build under audit (wave 1 landed 02:32-02:33: `worldVoice.css` HUD font stack, smoke README, lazy-chunk budget row). AD2d step 0
(`<O>/ad2d/step0-*.txt`): `npm run typecheck` clean; `npm run build` + `npm run build:demo` OK; `bundle-budget.mjs` **PASS** on
dist (app 438.3 KB / 460, lazy world 68.7 / 80, css 41.0 / 45) and dist-demo (438.9, 68.7, css 43.8); `npx vitest run` (no browser
open) 134 files, **3992 pass / 17 skipped / 0 failed**; `worldVoice.css` minified **980 B** (<= 1000); freshness: `find src public
docs scripts -newer dist/index.html` and `-newer dist-demo/index.html` print nothing. dist served by :4174; dist-demo served to
Playwright by route interception (`http://ad2b.test/`, no port; 4177 never started). Evidence root `<O>/ad2d/`: `cap/` frames +
probe JSON (every bubble judged by `tools/checks.mjs`: faces incl. the payphone receiver, tail tip vs head x, HUD panel / buttons /
hint / visible toasts, crank circle + 24, gain block), `crops/`, `turn/` (CDP screencast frames + rAF variant log), `tools/`
(`bub4.mjs`, `chain4.mjs`, `demo4.mjs`, `check5.mjs`, `mock.mjs`, `patchf22.py`, `regdiff.py`, AD2c tools), `vt/ladder.test.ts`
(scratch probe of the real `placeBubble`), run logs `bub4-run.txt`, `bub4-u125-run.txt`, `chain4-run.txt`, `demo-run.json`,
`check4-run.txt`, `check5-run.txt`.

| # | check | result | evidence (`<O>/ad2d/`) |
|---|---|---|---|
| 1 | F18 ladder, s7 (INS-02 DOG-02 CRW-01 GRL-01) + s9 (INS-06 PAY-02 PAY-03 PAY-04 DOG-05 GRL-03 GRL-04 GRL-05) at 720u100 / 720u150 / 1080 / deck (+ 720u125) | **F18 FIXED; check FAIL on one line (F21)**. 60 / 60 forced lines shown in 308-417 ms, none BLOCKED; 0 faces covered (Inspector, Sensor 7, crow, dog, payphone receiver); 0 hits on HUD panel, buttons, hint, toasts, crank circle + 24, gain block; 60 / 60 verbatim. PAY-02 / 03 / 04 go `side` head-aligned at every viewport: box left of the booth, tail ends on the booth hood 23 px (UI 100) / 35 px (UI 150, 1080) left of the receiver; crow and dog clear; the box covers the booth's own hood top and machine art (allowed). Tail on head everywhere **except DOG-02 at 720u150 and deck**: `side` + `centred`, box left of the dog, tail tip 45 px left and ~50 px below the head, on bare ground (F21). UI 125: DOG-02 `below`, fine | `bub4-run.txt`, `bub4-u125-run.txt`, `cap/bub-*.png/.json` (`.judge`), `crops/f18-pay03-4vp.png`, `crops/c1-pay03-s9-720u150-x2.png`, `crops/c1-dog02-s7-720u150-x2.png` |
| 2 | F17 CROSSED LINES, real `generator` buy in the TECH INDEX, 4 viewports | **PASS**. Oscillator log on the page clock (t from chain step 1): dial tone 350 Hz at 0, ring 480 Hz bursts at +1.07..1.12 s and +1.67..1.72 s with booth `ring0` frames, PAY-01 shown +2.45..2.57 s, CRW-04 joins +4.49..4.57 s, INS-05 after PAY-01 ends (+7.95..8.02 s). Order PAY-01, CRW-04, INS-05 at all 4; max 2 bubbles up; `seen` = failedSync, PAY-01, CRW-04, INS-05. PAY-01 never covers the crow (`above`, tail on the receiver at UI 100 / 1080; `side` head-aligned onto the booth at UI 150 / deck); CRW-04 above the crow, tail on its head | `chain4-run.txt`, `cap/chain-{720u100,720u150,1080,deck}-0N.png` + `.json`, `crops/c2-chain-720u150-02-x2.png`, `crops/c2-chain-720u100-03-x3.png` |
| 3 | F19 natural POST-CAP on dist-demo, no forcing (time skips only), 720 + 1080 | **F19 FIXED; check FAIL on the tracking line (F22)**. Teaser: `worldSay` false, no bubble, silence `asleep`. KEEP TINKERING: one freeze, every denizen still for about 1.2 s after the card leaves (screencast), `beat.tapeFreeze` in `seenEver` once; **no tracking line on any frame** (F22). Then PAY-05 (`side`), INS-07 (`above`), GRL-06 (`below`, tail up to the girl mini), DOG-12 (`below`) in order, verbatim, live region `<Speaker>: <line>`, 0 faces / HUD / crank / gain hits; postCap step 4. Reload: END OF DEMO card, KEEP: no second freeze (longest still 559 / 565 ms vs 2274 / 2365 the first time), dog `lie` facing the camera, 3 x 130 s skips: no bubble, no repeated line | `demo-run.json`, `cap/demo-{720,1080}-{teaser,card,PAY-05,INS-07,GRL-06,DOG-12,hold}.png`, `turn/demo-{720,1080}-keep/` (+ `log.json`), `turn/demo-*-reload/`, `crops/c3-keep-720-left-x4.png`, `crops/c3-hold-720-dog-x8.png`, `crops/c3-hold-1080-dog-x6.png` |
| 4 | Q6 + placeholders, 1920x1080 UI 100, default camera, quiet, buys in the TECH INDEX; states s0 s2 s7 s8 s9 + cycle 2 era I at 720p / 1080p | **PASS**. `generator`: six warm tiles light on two towers right above the machine (3 on the big central tower, 3 on the right tower) while the girl window goes dark: reads without looking for it (Q6 gate). `powerLines`: windows to full, lamp + glow, relit insulators, the lattice tower. Cams e1 (1, 1920, 1520) -> s8 (1, 2064, 1464); s9 pre (.75, 2176, 1504) -> s9 (.75, 2192, 1504). States and cycle 2 (cycle 2, e1, booth 42 marks) match AD2c. Visible variants in 74 probes: clock ruin; crow frozen / head / talk; dog sit0 sit1 sniff0 sniff1 dig0 dig1 head talk lie; girl window-flicker / mini; inspector idleA idleB walk0-3 write0 write1 front talk; lamp dead / lit; payphone dark / lit / ring0; receiver hang swing0-2 level; sensor7 headR. No ink-fallback placeholder on screen (the 9 boot fallbacks are era III+ / cycle / postgame ids, never drawn in I-II; denizen shadows are their own generated `world.shadow#w` keys) | `cap/q6-d4-{gen,pl}-{before,after}[-plate].png`, `crops/q6-d4-gen-pair-band.png`, `crops/q6-d4-pl-pair-band.png`, `cap/state-*-{720,1080}.png`, `cap/cycle2-e1-{720,1080}.png`, `crops/c4-states-720-board.png`, `check4-run.txt` |
| 5 | Bubble font, A13 gates, house rules, reduced motion, WORLD VOICES | **PASS**. Computed `font-family` of `.wv` = the HUD stack, 14 / 18 px, letter-spacing normal; the font actually used (CDP `getPlatformFontsForNode`) = **Consolas for the bubble and the HUD** at UI 100 and 150. All 36 bubble boxes that AD2c also captured have the same size (wrap and width unchanged). Border band pure ink and edge rows pure paper on all 60 bubbles at UI 100 / 125 / 150 / 1080 / deck (the only non-ink band pixels are the tail's paper core: 8x2 at zoom 1, 12x3 at 1.5): F11 holds. Reduced motion: bubble opacity 1 on its first frame (normal 0 -> .33 -> .67 -> 1), clean snap to front, no tracking band (normal shows it). RARE: non-core INS-02 refused by force and by its trigger (`chamber-seal`), core INS-01 plays. OFF: force refused, no bubble after a trigger + 10 min skip, `seen` unchanged (4 -> 4), loops and receiver glances go on | `cap/check5.json`, `cap/font-u{100,150}-DOG-02.png`, `crops/c5-font-bubble-u100-u150-hud.png`, `crops/c5-turn-snap-normal-vs-rm-x4.png`, `turn/talk-ins02{,-rm}/log.json` |

**A13 gates.**
| gate | result | evidence |
|---|---|---|
| workbench score >= 90 | PASS (cited, no PNG changed since AD2c): inspector 95.7, windowLit 100, dog 99.5 (AD2c heads 99.3 / 99.6), stakeChain 97.7, hole 95.6, scraps 99.1, mote 100, crow 100, girl 98.7, girlMini 100, girlWindow 100, payphone 98.9, receiver 95.2, lamp 96.7, lampGlow 96.0, clock 100, sensor7 96.1 (AD2c 3/4 heads 95.6); min 95.2 | `scripts/art/world/README.md` gate table; `ls -l --time-style=full-iso public/assets/world/*.png public/assets/bg/window-lit.png`: newest `sensor7.png` 2026-10-24 19:42:41, `dog.png` 19:39:15 (`<O>/ad2d/png-mtimes.txt`) |
| lint 0 errors / 0 warnings | PASS on all 17 sheets (pillow info accepted; dog linted as two 280 px halves) | same table |
| silhouette 1 component | PASS: 1 per cell on every sheet (dog 120, inspector 114, crow 60, girl 60, payphone 36, sensor7 48 ...) | same table |
| palette-only + alpha 0 / 255 + dims | PASS: `npx vitest run src/assets` 8 files / 151 pass (`worldSheets.test.ts` included) | `<O>/ad2d/assets-vitest.txt` |
| DENIZEN_ART 1.2 minimum sizes | PASS: Inspector 66 / 50, dog 32 / 24, crow 28 / 21, booth 96 / 72, Sensor 7 72 / 54, lamp 112 / 84 logical px at zoom 1 / .75 (floors 24 / 14 / 36) | art unchanged since AD2 measure |
| AD in-game verdict RELEASE-READY | **NOT YET**: F21, F22 open (S2) | this section |

**DENIZEN_ART 8.2 on every AD2d frame.** One pixel grid PASS (art and PIXEL_SCALE unchanged). Palette-only era rows PASS.
No denizen faces the machine PASS (rest poses face away, the write flip holds, turns snap to the camera). Tail points at the head:
PASS on 59 of 60 ladder bubbles, all chain and demo bubbles; **FAIL DOG-02 at 720u150 / deck (F21)**. Bubble never covers crank,
prompt or gain text PASS (0 hits in 60 ladder + 24 chain + 8 demo judgments). Nothing un-happens PASS (girl window stays dark,
lamp / windows stay lit, hole stays, the dog `lie` hold survives reload).

Accepted notes (no fix): payphone side bubbles cover the top of the booth's own hood and the machine's battery / transformer
art; the receiver, the crow and the dog stay clear. In the turn runs a natural line came up after INS-02 (`wv on up`): the scheduler
had a due line, not a defect. The F21 proposal moves PAY-02 / 03 / 04 at UI 100 / 1080 from `side` to `above` with the tail on
the receiver; its box edge meets the crow's wing tip but leaves the crow's head clear (mock
`crops/f21-pay03-720u100-now-vs-mock-x3.png`): accepted in advance.

**F-list (open).**
| F | sev | what / where | evidence (`<O>/ad2d/`) | owner | exact change |
|---|---|---|---|---|---|
| F21 | S2 | DOG-02 (era I) at 720p UI 150 and Deck goes `side` with `centred` y: the body is centred on the dog, the tail hangs from the bottom near corner onto bare ground 45 px left and ~50 px below the dog's head. A `centred` side bubble can never put its bottom tail on a short speaker's head. Cause: since the payphone head reserve, `above` (box 615-831 x 284-338 root px) hits the receiver reserve (769, 312, 16, 16) and `below` hits the buttons; the side step is the only one left. Real `placeBubble` on the measured geometry reproduces the shipped box exactly (493, 333) | `crops/c1-dog02-s7-720u150-x2.png`, `cap/bub-s7-{720u150,deck}-DOG-02.png/.json`, prototype `vt/ladder.test.ts`, mocks `crops/f21-dog02-720u150-now-vs-mock-x2.png`, `crops/f21-dog02-deck-now-vs-mock-x2.png` | EM | `src/game/math/worldBubble.ts` `placeBubble`: after step 2 (below, centred x) and before the side step, try the box **slid** so the tail sits at its far end on the head x: `L = clampedX(Math.ceil(head.x - (w - tailMargin)), w, viewport)`, `R = clampedX(Math.floor(head.x - tailMargin), w, viewport)`, inward first (`head.x >= viewport.w / 2 ? [L, R] : [R, L]`); for each x with `tailX = head.x - x` in [tailMargin, w - tailMargin]: first every candidate `above` (same y and tests as step 1), then every candidate `below` (same as step 2). Return side `above` / `below` with a new optional `slide: 'L' \| 'R'` (absent = centred). Then the side step with `SIDE_Y_MODES = ['head', 'centred']` (head first: its tail ends on the head line). `src/ui/worldBubbleController.ts`: keep `slide` in the slot (like `sideY`, set at show and at the recheck, lines 227 / 273) and make `placementOf` compute the above / below x with the same L / R formula when `slide` is set, else today's centred clamp (without this the per-frame follow snaps the box back and the recheck flips it). Tests in `worldBubble.test.ts`: (a) DOG-02 s7 UI 150, root px: head (723.33, 344), feet (723.33, 368.67), size 216x46, viewport 853.33x480, reserved panel (16, 16, 270, 182.67), buttons (474.67, 426, 362.67, 38), crank (362.67, 208, 128, 128), gain (437.33, 106.67, 133.33, 80), receiver (769.33, 312, 16, 16), crow (789.33, 245.33, 16, 16), Inspector (88, 298.67, 48, 16), Sensor 7 (61.33, 297.33, 16, 16) -> `above`, x 518, y 284, slide `L`; (b) s9 payphone UI 100 (AD2c F18 case: head (1224, 459), feet 492, crow (1234, 380, 18, 24), dog (1129, 485, 18, 24)) -> `above`, x 1018, y 399; (c) s9 payphone UI 150 (head (816, 306), feet 328, crow (823, 253, 12, 16), dog (753, 323, 12, 16)) -> unchanged `side` `head` (586, 252); (d) invariant: every `above` / `below` result has `x + tailX` within 1 px of `head.x`. AD2e recheck: `bub4.mjs` s7 + s9 at 720u150 / deck / 720u100 / 1080 (DOG-02 tail on the head, PAY tails on the receiver or booth, 0 faces covered), `chain4.mjs` |
| F22 | S2 | The demo POST-CAP tape freeze (STORY_BIBLE 8.2: "every loop freezes for 1.2 s with a tracking line") shows **no tracking line**: freeze PASS, band never drawn (720 and 1080). Cause: the beat starts on the World's wake frame (KEEP TINKERING), before `cast.update`; `LivingWorld.tapeFreeze` sets `trackUntilMs = this.nowMs + trackingFrameMs` with `nowMs` from the last update **before** the World slept under the card, so the window has already passed when the next update sets the fresh time. Proven on a scratch copy of dist-demo (never the repo): arming the band on the next update draws it on the first two frames after the card leaves | shipped `turn/demo-{720,1080}-keep/` (`regdiff`: 0.00 change on every denizen 874-1149 ms); fixed `turn/demo-720-keep-f22/`; board `crops/f22-freeze-track-shipped-vs-fix-x5.png`; patch `tools/patchf22.py` | EM | `src/game/rendering/LivingWorldDirector.ts` `update()`: read `const sceneNow = this.scene.time.now;` at the top (before `runDue`) and call a new `this.cast.syncNow(sceneNow)` (`src/game/rendering/LivingWorld.ts`: `syncNow(nowMs: number): void { this.nowMs = nowMs; }`), so every beat or turn started this frame (tape freeze, a turn on a wake frame) uses the current time; keep passing `sceneNow` to `cast.update` / `props.update` below. Equivalent minimal form (the one proven): `tapeFreeze` sets `this.trackPending = !this.reduced`, and `update()` right after `this.nowMs = nowMs` does `if (this.trackPending) { this.trackUntilMs = nowMs + WORLD_ENV.trackingFrameMs; this.trackPending = false; }`. AD2e recheck: `demo4.mjs` keep run at 720 / 1080 (band on a frame within 150 ms after the card leaves, freeze still 1.2 s), reduced motion: no band |

No tuning this round: no open item is a `WORLD_ENV` / `WORLD_FAR_PLANES.windows` number; no art defect found (no PNG touched).

Order for the Director: EM F21 + F22 (one small package: `worldBubble.ts` + test, `worldBubbleController.ts`, `LivingWorld.ts`,
`LivingWorldDirector.ts`), rebuild both editions, then AD2e short recheck: `bub4.mjs` (DOG-02 at 720u150 / deck, PAY at 4
viewports), `chain4.mjs` (4 viewports), `demo4.mjs` (keep frames: band; arc + hold unchanged). Keep green (proved this round):
F17 F18 F19 F20, Q6, font, F11 corners, reduced motion, RARE / OFF, budgets, placeholders, palette, A13 art gates.

### WP23a round 5 (Art Director AD2e, 2026-10-25)

Verdict: **FIX LIST** (not RELEASE-READY)

Closed this round: **F21** (DOG-02 tail on the dog's head at 720u150 and Deck) and **F22** (tape-freeze tracking line drawn),
both proved on the final build. Open: one new **S2**, **F23**: the slid `above` payphone box (new with F21) sits within the
crow's era II stutter of the crow's head reserve, so at UI 150 (s8: 720u150, Deck) and UI 125 (s9) a payphone bubble can fade
in `above` and jump about 36 px left / 9 px down to `side` at the first 250 ms recheck. One-line fix, proven on a scratch
build. A13 stays open until F23 lands and AD2f rechecks it.

Build under audit (F21 + F22 landed 03:53-03:58: `worldBubble.ts` + test, `worldBubbleController.ts`, `LivingWorld.ts`,
`LivingWorldDirector.ts`). At 04:16 dist was still the 03:16 build and nothing else was running, so AD2e step 0 rebuilt both
editions itself, as in AD2c / AD2d (`<O>/ad2e/step0-*.txt`): `npm run typecheck` clean; `npm run build` (dist 04:16:50) + `npm run
build:demo` (04:17:00) OK; `bundle-budget.mjs` **PASS** on dist (app 438.3 KB / 460, lazy world 69.8 / 80, css 41.0 / 45) and
dist-demo (438.9, 69.8, css 43.8); `npx vitest run` 134 files, **4000 pass / 17 skipped / 0 failed**; freshness: `find src public
docs scripts -newer dist/index.html` and `-newer dist-demo/index.html` print nothing. dist is served on :4174. dist-demo goes to
Playwright through route interception (no port; 4177 never started). Evidence root `<O>/ad2e/`. It holds `cap/` (frames + probe
JSON, each bubble judged by `tools/checks.mjs`), `crops/`, `turn/` (CDP screencast frames + rAF logs) and `tools/` (AD2d tools
re-pointed to `ad2e`; `bub4.mjs` now samples every shown box on rAF for 1.6 s; `demo4.mjs` adds `RM=1`, the card-off time and
denizen body boxes; new `bandbody.py`, `flip.mjs`, `refit.mjs`, `flipshot.mjs`, `board.py`, `patchlog.py`, `patchf23.py`). Scratch
builds `dist-dbg/` (logs reserved rects) and `dist-f23/` (F23 proof) are copies, never the repo.

| # | check | result | evidence (`<O>/ad2e/`) |
|---|---|---|---|
| 1 | F21 ladder, s7 (INS-02 DOG-02 CRW-01 GRL-01) + s9 (INS-06 PAY-02/03/04 DOG-05 GRL-03/04/05) at 720u150 / deck / 720u100 / 1080 + 720u125 | **F21 FIXED; stability FAIL at UI 125 (F23)**. 60 / 60 forced lines shown in 312-419 ms, none BLOCKED, 60 / 60 verbatim, 0 hits on HUD panel / buttons / hint / toasts / crank circle + 24 / gain block. **DOG-02 at 720u150 and deck: `above`, slide `L`, box (776, 426) / (776, 466) client, tail tip 1084 = the director's head anchor x 1085 (723.33 root) within 1 px**, on the dog's left ear, 0 faces covered (was `side` + `centred`, tail on bare ground 45 px off). Only DOG-02 and the PAY lines at UI 100 changed vs AD2d. PAY-02/03/04 at 720u100 / 1080: `above` slid, box (1018, 399) / (1527, 599), tail on the receiver (dx 0-1). Its top-right corner meets the crow's lower-left tail edge, so the judge's broad crow box (32 world px) reads `crow` on 4 of 6. The head and beak stay clear: the accepted-in-advance AD2d note. PAY at UI 150 / 125: `side` head-aligned onto the booth hood, as in AD2d. Box stable over 1.6 s (6 rechecks) on 59 / 60. **The 60th, PAY-02 at 720u125, showed `above` at (966, 384) and moved to `side` (936, 391) at the first recheck: F23** | `bub4-a-run.txt`, `bub4-b-run.txt` (`stab`, `stabKeys`), `cap/bub-*.png/.json`, `crops/f21-dog02-720u150-ad2d-vs-ad2e-x2.png`, `crops/f21-dog02-deck-ad2d-vs-ad2e-x2.png`, `crops/f21-dog02-tail-720u150-deck-x5.png`, `crops/f21-pay03-720u100-ad2d-vs-ad2e-x4.png`, `crops/f21-pay03-1080-ad2d-vs-ad2e-x3.png`, `crops/f21-pay-above-crow-wing-x6.png` |
| 2 | CROSSED LINES, real `generator` buy in the TECH INDEX, 4 viewports | **PASS (order) / see F23**. Times from chain step 1: PAY-01 +2.48..2.55 s (after dial + ring, booth `ring0`), CRW-04 +4.45..4.51 s, INS-05 +7.87..8.04 s at all 4. At most 2 bubbles; `seen` = failedSync, PAY-01, CRW-04, INS-05; 0 errors. CRW-04 is above the crow with its tail on the head. PAY-01 never covers the crow's head. At 720u150 the judge (+0.2 s) saw PAY-01 `above` slid (897-1221, tail dx 0, touching the broad crow box at 1 px). The screenshot a moment later already shows it `side` (861, 452): the F23 jump inside the core chain | `chain4-run.txt`, `cap/chain-{720u100,720u150,1080,deck}-0N.png` + `.json`, `cap/chain-720u150.json` (`judged[0]` vs `judged[1]`) |
| 3 | F22 + POST-CAP arc on dist-demo, no forcing (time skips only), 720 + 1080; reduced-motion keep run | **F22 FIXED; arc PASS**. The tracking line shows on the **first two screencast frames after the card leaves** (+77 / +145 ms at 720, +88 / +158 ms at 1080). Shifted row bands: Inspector and Sensor 7 rows 459-467 (720) / 688-700 (1080), dog 513-516 / 769-774. Then every denizen is still (0 thresholded change vs mid-freeze) until +1253 / +1216 ms, and they move again at +1325 / +1284 ms: about 1.2 s at the about 70 ms screencast step. The pre-fix build at the same frame was a control: no band. **Reduced motion: no band**, 0.00 change on every denizen to +1178 ms, motion at +1245. Teaser: `worldSay` false, no bubble, silence `asleep`. `beat.tapeFreeze` in `seenEver` once. The arc runs in order: PAY-05 (now `above`, tail on the receiver, the F21 UI 100 change), INS-07 `above`, GRL-06 `below` (tail up to the girl mini), DOG-12 `below`. All verbatim, live region `<Speaker>: <line>`, 0 face / HUD / crank / gain hits (PAY-05 720 `crow` = the accepted wing-edge contact), `postCap` step 4. Reload: card, KEEP, **no second freeze** (longest still 560 / 572 ms vs 2284 / 2255), dog `lie` facing the camera, 3 x 130 s skips: no bubble | `demo-run.json`, `demo4-run.txt`, `turn/demo-{720,1080}-keep/` (+ `log.json` `cardOff`), `turn/demo-*-reload/`, `crops/f22-band-720-inspector-x5.png`, `crops/f22-band-1080-inspector-x4.png`, `tools/bandbody.py`; RM `demo-keep-rm.json`, `turn/demo-720-keep-rm/`; pre-fix control `demo-keep-calib-pre.json`, `turn/demo-720-keep-calib-pre/`; `cap/demo-{720,1080}-{teaser,card,PAY-05,INS-07,GRL-06,DOG-12,hold}.png` |
| 4 | Regression: Q6, font, reduced motion, RARE / OFF, states s0 s7 s9 at 720 / 1080 vs AD2d | **PASS, no new defect**. Q6 (1920x1080, UI 100, default camera, quiet, buys in the TECH INDEX): the cameras match AD2d: e1 (1, 1920, 1520) -> s8 (1, 2064, 1464); s9 pre (.75, 2176, 1504) -> s9 (.75, 2192, 1504). The `-plate` frames match AD2d above the machine (diff bbox starts at y 468 in `gen-after`, the animated machine and cast). The six warm tiles on two towers still light while the girl window goes dark. Font: `.wv` = the HUD stack, 14 / 18 px; used font Consolas for the bubble and the HUD at UI 100 and 150. RARE: non-core INS-02 is refused by force and by its trigger; core INS-01 plays. OFF: force refused, no bubble, `seen` 4 -> 4, loops and receiver glances go on (the same 23 variants as AD2d). Boot fallbacks are the same 9 era III+ ids. Reduced-motion INS-02: bubble opacity 1 on its first frame, clean snap to front. States: same cameras, display objects 53 / 56 / 56, the same visible ids; variants differ only in loop phase; no placeholder | `q6-run.txt`, `cap/q6-e5-{gen,pl}-{before,after}[-plate].png`, `crops/q6-e5-gen-pair-band-half.png`, `cap/check5.json`, `check5-run.txt`, `turn/talk-inspector-rm/log.json`, `cap/state-{s0,s7,s9}-{720,1080}.png/.json`, `crops/c4-state-{s0,s7,s9}-720-ad2d-vs-ad2e.png` |

**F23 cause (measured, scratch `dist-dbg/` logging the reserved rects at show and at every failed recheck).** Era II plays
`WORLD_LOOPS.crowStutter` (dx 0, 0, 4, 0), so `LivingWorld.anchor('crow')` (from `feetX = placement.x + dx`) moves the crow's
head reserve (`LivingWorldDirector.reservedHeads`) by 4 world px every loop. The F21 slid box sits right inside that band. At
s9 UI 125 the box (773-989 root) clears the reserve only while it is at 989.6 (dx 4) and overlaps it at 987.2 (dx 0). At s8 UI
150 the same holds within 2.7 root px. A line shown in the dx 4 phase gets `above` / `L`. The next recheck runs in the dx 0
phase, `fits()` fails and `placeBubble` returns `side`. Counts: s8 720u150 3 / 9 and Deck 4 / 9 forced payphone lines (each
one shown `above` jumped); s9 720u125 1 / 9 in the logged run and 3 / 12 in the traces + ladder. UI 100 / 1080 never jump: the
box right edge (1234) only touches the dx 0 reserve. Deck, rAF trace: PAY-03 fades in at (897, 483) (opacity 0 / .33 / .67 at
+260 / 383 / 443 ms) and is at (861, 492), opacity 1, from +504 ms. The screencast frames show it nearly opaque at the `above`
spot at +498..567 ms and moved by +748 ms.

**A13 gates.**
| gate | result | evidence |
|---|---|---|
| workbench >= 90, lint 0 / 0, silhouette 1 component, palette-only + alpha 0 / 255 + dims, DENIZEN_ART 1.2 sizes | PASS: **cited from AD2d** (no PNG changed). `public/assets/world/*.png` and `bg/window-lit.png` mtimes match `<O>/ad2d/png-mtimes.txt`; `find public/assets -newer <O>/ad2d/png-mtimes.txt` prints nothing; `npx vitest run` (incl. `worldSheets.test.ts`) green | `<O>/ad2e/png-mtimes.txt`, `step0-vitest.txt` |
| AD in-game verdict RELEASE-READY | **NOT YET**: F23 open (S2) | this section |

**DENIZEN_ART 8.2 on every AD2e frame.** One pixel grid PASS. Palette-only era rows PASS (art unchanged). No denizen faces
the machine PASS. **Tail points at the head: PASS on all 60 ladder, 20 chain and 8 demo judgments (DOG-02 fixed)**. Bubble
never covers crank, prompt or gain text PASS (0 hits). Nothing un-happens PASS (hole, lit lamp and windows, dark girl window,
the dog `lie` hold after reload). Extra 4.2 rule ("re-evaluated at most every 250 ms, with hysteresis, so a pan does not flip
it"): **FAIL F23** (a jump with no camera move).

Accepted notes (no fix). The `above` payphone box at UI 100 / 1080 touches the crow's lower-left tail edge by 3-5 client px;
the head and beak stay clear (`crops/f21-pay-above-crow-wing-x6.png`, accepted in advance in AD2d). The dog tail tips sit
7-11 client px left of the judge's dog-box centre: that box is wider than the head, and the tip is on the director's head
anchor within 1 px, inside the head span (as at UI 100 in AD2d). On the first payphone line after a long time skip the side
box follows a settling camera by 1-3 px: it tracks the world, not a placement change.

**F-list (open).**
| F | sev | what / where | evidence (`<O>/ad2e/`) | owner | exact change |
|---|---|---|---|---|---|
| F23 | S2 | A payphone bubble shown `above` slid (F21) jumps about 36 px left / 9 px down to `side` at the first 250 ms recheck, with no camera move. It happens at s8 UI 150 (720u150 and Deck: CROSSED LINES PAY-01, core) and at s9 UI 125, on about 1 in 3 payphone lines. Cause: the crow's era II stutter (`crowStutter` dx 4) moves its head anchor and so its head reserve, and the slid box lies inside that 4 world px band. Fails the AD2e "no flip" acceptance and DENIZEN_ART 4.2 | `flip-720u125-s9.json`, `flip-720u125-s9-b.json` (per-frame box / opacity / crow x), `refit-720u125.json` + `.txt`, `refit-720u150-s8.txt`, `refit-deck-s8.txt` (show vs refit reserved rects: crow reserve x 989.6 vs 987.2), `flipshot-deck-s8.json`, `turn/f23-flip-deck-s8/`, board `crops/f23-flip-deck-s8-frames-x1.png`, `cap/chain-720u150.json`; proof `tools/patchf23.py`, `dist-f23/`, `refit-f23-{720u150-s8,deck-s8,720u125-s9,720u100-s9}.json` | EM | `src/game/rendering/LivingWorld.ts` `anchor(id, cam)`, walker branch: anchor the crow on its loop base, `const x = id === 'crow' && w.placement !== null ? w.placement.x : w.feetX; return speakerAnchor(x, w.feetY, frameOf(id).height * PIXEL_SCALE, cam);`. Comment: era II `crowStutter` dx and the one-frame ripple nudge must not move the crow's head reserve or its own tail (AD2e F23); the crow has no travelling loop in eras I-II. Nothing else changes: `feetX`, drawing, `livingWorld()` x and the other walkers stay as they are. Proven on the scratch build: **36 / 36 forced payphone lines, 0 refits**. s8 720u150 and Deck plus s9 720u125 go `side` every time; s9 720u100 goes `above` / `L` every time (tail on the receiver, unchanged). Side effect: CRW-04's tail stops sliding 3 px with the stutter. Do not use a tolerance in `fits()` instead: it would let a box overlap a face. Optional repo guard (EM): `scripts/smoke/world.mjs` forces PAY-03 six times at s8 Deck and asserts the box left / top stay within 4 px over 700 ms after `.wv.on`. AD2f recheck: `flip.mjs` / `refit.mjs` / `flipshot.mjs` at s8 720u150 + Deck and s9 720u125 (0 jumps); `bub4.mjs` s9 720u100 / 1080 (PAY `above`, tail on the receiver) + DOG-02 720u150 / Deck; `chain4.mjs` 720u150 / Deck (PAY-01 `side` for the whole line) |

No tuning this round. F23 is not a `WORLD_ENV` / `WORLD_FAR_PLANES.windows` number, and widening `headReserve.padWorldPx.other`
would move every payphone and dog placement. No art defect found (no PNG touched).

Order for the Director: EM F23 (one line in `LivingWorld.ts`, optional `world.mjs` guard), rebuild both editions, then AD2f
short recheck (above). Keep green (proved this round): F21 DOG-02, F22 band + freeze + reduced motion, POST-CAP arc + hold, F17
F18 F19 F20, Q6, font, RARE / OFF, budgets, placeholders, palette, A13 art gates.

### WP23a round 6 (Art Director AD2f, 2026-10-25)

Verdict: **RELEASE-READY** (A13 in-game gate closed for WP23a)

Closed this round: **F23** (payphone bubble jump), proved on the shipped build at all three configs where it showed. No new
defect. No S1 / S2 / S3 open. The scene reads as inhabited at every viewport: the Inspector walks, writes and turns to the camera,
Sensor 7 watches, the dog sits / sniffs / digs, the crow stutters on the wire, the booth rings and its receiver swings, and the girl
window flickers in era I. The lines land: verbatim, one or two bubbles at a time, each tail on its speaker, and the CROSSED LINES
chain runs dial -> ring -> PAY-01 -> CRW-04 -> INS-05.

Build under audit: dist and dist-demo of 05:07:11 / 05:07:24 (after the F23 edit at 05:06:39). Step 0 (`<O>/ad2f/`): `find src public
docs scripts -newer dist/index.html` and `find src public scripts -newer dist-demo/index.html` print nothing (`step0-fresh.txt`). The only
source file newer than the AD2e build is `src/game/rendering/LivingWorld.ts` (`changed-since-ad2e.txt`). Both bundles carry the fix:
`LivingWorldDirector-*.js` has `const n=e==="crow"&&s.placement!==null?s.placement.x:s.feetX`. No rebuild was needed: AD2f changed no
source or asset file. dist was served by :4174. dist-demo was served by `vite preview --outDir dist-demo --port 4177 --strictPort`,
started for this round and killed after it (port free again). One Playwright browser at a time. Evidence root `<O>/ad2f/`. It holds
`cap/` (frames + probe JSON, every bubble judged by `tools/checks.mjs`), `crops/` and `turn/` (CDP screencast frames + rAF logs). The
AD2e tools are in `tools/`, re-pointed to `ad2f`, with these changes: `flip.mjs` takes `CASE=s8`; `flipshot.mjs` counts jumps and keeps
the frames of a stable line (`SAVE=1`); `chain4.mjs` adds a rAF trace of every shown bubble box (`wvtrace`); `demo4.mjs` takes `BASE`.
There is also a new `flipan.mjs` (trace summary). `dist-dbg/` is a copy of the shipped dist with the logging-only `patchlog.py` (it logs
reserved rects; no behaviour change), never the repo.

| # | check | result | evidence (`<O>/ad2f/`) |
|---|---|---|---|
| 1 | F23 `flip.mjs`: per-rAF trace of every bubble from `worldSay` to +2.4 s, forced payphone lines, shipped dist | **PASS, 0 jumps / 31 lines**. s8 720u150: 9 / 9 PAY-02/03/04 `side` at (861, 452). s8 Deck: 9 / 9 `side` at (861, 492). s9 720u125: 12 / 12 `side` at (936, 391), plus INS-06 `above`. In every line the crow x alternates 2656 / 2660 (s8) or 2996 / 3000 (s9): the stutter still plays and the box does not move. Only the first line after the 120 s time skip follows the settling camera by 1-3 px (863 -> 861 -> 860, the accepted AD2e note) | `flip-{720u150,deck}-s8.json`, `flip-720u125-s9.json`, `flip-*-run.txt`, `tools/flipan.mjs` |
| 2 | F23 `refit.mjs`: reserved rects at show and at every failed 250 ms recheck (`dist-dbg/`, logging only) | **PASS, 0 refits** at s8 720u150 (13 shows), s8 Deck (15) and s9 720u125 (10). The crow head reserve is now constant: (813.33, 282.67) on 12 / 12 and 14 / 14 payphone shows at UI 150, x 987.2 on 10 / 10 at UI 125 (AD2e: 989.6 at show vs 987.2 at refit). The few `null` shows are a line waiting while the due CROSSED LINES chain holds the spot (CRW-04 follows). They are not placements; AD2e had the same | `refit-{720u150,deck}-s8.txt/.json`, `refit-720u125-s9.txt/.json` |
| 3 | F23 `flipshot.mjs`: CDP screencast of 9 forced payphone lines per config | **PASS, 0 jumps / 27 tries** (25 shown inside the 1.2 s window; the 2nd try at Deck and 720u125 starts late behind a due chain line, the same as the AD2e shipped run). Frames: the box is opaque at the `side` spot from fade-in to fade-out (Deck +497 / +739 / +1050 ms), where AD2e showed `above` at +498 and `side` at +748 | `flipshot-{deck,720u150}-s8.json`, `flipshot-720u125-s9.json`, `turn/f23-stable-{deck,720u150}-s8/`, `turn/f23-stable-720u125-s9/`, board `crops/f23-deck-s8-ad2e-flip-vs-ad2f-stable-x2.png` |
| 4 | `bub4.mjs`: s9 at 720u100 / 1080, s7 at 720u150 / Deck (DOG-02), s9 at 720u125 | **PASS**. 32 / 32 forced lines shown in 313-413 ms, none BLOCKED, 32 / 32 verbatim, 0 hits on the HUD panel / buttons / hint / toasts / crank circle + 24 / gain block, rAF box stable over 1.6 s on 32 / 32. PAY-02/03/04 at 720u100 / 1080: `above` slid at (1018, 399) / (1527, 599), tail dx 0-1 on the receiver. The judge's broad crow box reads `crow` on 4 / 6 (1 at 720, 3 at 1080): the accepted wing-edge contact, head and beak clear, as in AD2e. DOG-02 at 720u150 / Deck: `above` at (776, 426) / (776, 466), tail dx -10 vs the judge box centre (on the head anchor, as in AD2e). PAY at 720u125: `side` at (936, 391), tail on the booth hood (dx -29, accepted since AD2d). Screenshots match AD2e box for box | `bub4-{a,b,c}-run.txt`, `cap/bub-*.png/.json`, `crops/f21-dog02-720u150-deck-ad2e-vs-ad2f-x2.png`, `crops/pay-above-720u100-ad2e-vs-ad2f-x3.png` |
| 5 | `chain4.mjs` CROSSED LINES, real `generator` buy in the TECH INDEX, 720u150 + Deck | **PASS: PAY-01 is `side` for the whole line**. The rAF trace holds one box only, (861, 452) / (861, 492), through 8 / 7 change records; it was `above` at the AD2e +0.2 s judge. Times from the 350 Hz dial: ring 480 Hz +1.26..1.86 / +1.22..1.82 s, PAY-01 +2.61 / +2.57 s, CRW-04 +4.18 / +4.08 s, INS-05 +7.69 / +7.73 s. At most 2 bubbles; `seen` = failedSync, PAY-01, CRW-04, INS-05; 0 errors. CRW-04 sits above the crow, tail dx 0 / -4: the tail stays on the loop base while the judge box follows the stutter, the side effect AD2e predicted | `chain4-run.txt`, `cap/chain-{720u150,deck}.json` (`wvtrace`), `cap/chain-{720u150,deck}-0N.png` |
| 6 | `node scripts/smoke/world.mjs` on :4174 (full) and :4177 (demo) | **PASS**. 20 / 20 checks both, `fail` [], `errors` [], stderr empty. Demo `G_era3_hidden` is skipped by design (era III refused) | `world.json`, `world-demo.json` |
| 7 | Q6 era I -> II pair, 1920x1080 UI 100, default camera, quiet, buys in the TECH INDEX | **PASS**. Cameras: e1 (1, 1920, 1520) -> s8 (1, 2064, 1464); s9 pre (.75, 2176, 1504) -> s9 (.75, 2192, 1504), the same as AD2d / AD2e. The `-plate` frames vs AD2e have 0 px changed by more than 24 above y 460 on gen-before, gen-after and pl-after; pl-before has 197 px at (486-662, 441-460), the machine top. The background is identical. After `generator` six warm tiles light on the two towers above the machine while the girl window goes dark, and the change reads at a glance | `q6-run.txt`, `cap/q6-f6-{gen,pl}-{before,after}[-plate].png`, `crops/q6-f6-gen-pair.png`, `crops/q6-f6-gen-pair-towers.png`, `crops/q6-f6-pl-pair.png`, `crops/q6-diffmask-*.png` |
| 8 | Reduced motion | **PASS**. Talk INS-02: bubble opacity 0 -> 1 on its first frame (+651 ms), clean snap walk3 -> front, then talk / front. Demo keep with RM on: no band; 0.00 change on every denizen body from +77 to +1183 ms after the card leaves; motion from +1251 | `turn-rm-run.txt`, `turn/talk-inspector-rm/`, `demo-keep-rm.json`, `turn/demo-720-keep-rm/` |
| 9 | WORLD VOICES RARE / OFF + font | **PASS**, identical to AD2e. RARE: non-core INS-02 refused by force and by its `chamber-seal` trigger; core INS-01 plays. OFF: force refused, no bubble, `seen` 4 -> 4, 23 variants (loops and receiver glances go on). Font: `.wv` = the HUD stack, 14 / 18 px; Consolas used for the bubble and the HUD at UI 100 and 150. Boot fallbacks: the same 9 ids (era III+ / postgame, never drawn in I-II) | `check5-run.txt`, `cap/check5.json`, `cap/font-u{100,150}-DOG-02.png` |
| 10 | Demo POST-CAP on :4177, no forcing (time skips only), 720 + 1080 | **PASS**. Teaser: `worldSay` false, no bubble, silence `asleep`. KEEP TINKERING: the tracking line on the first two frames after the card leaves (+74 / +145 ms at 720, +86 / +159 at 1080; rows Inspector + Sensor 7 459-467 / 688-700, dog 513-516 / 769-774). Then still until +1256 / +1152 and moving at +1327 / +1225: the 1.2 s freeze. `beat.tapeFreeze` once. Arc in order: PAY-05 `above` (tail dx 1 / 0 on the receiver), INS-07 `above`, GRL-06 `below` (tail up to the girl mini), DOG-12 `below`. All verbatim, live region `<Speaker>: <line>`, 0 HUD / crank / gain hits; `postCap` step 4. Reload: card, KEEP, no second freeze (longest still 566 / 583 ms vs 2292 / 2124 the first time), dog `lie`, 3 x 130 s skips with no bubble. 0 errors | `demo-run.json`, `demo4-run.txt`, `band-{720,1080}.txt`, `turn/demo-{720,1080}-{keep,reload}/`, `crops/f22-band-720-inspector-x5.png`, `cap/demo-{720,1080}-{teaser,card,PAY-05,INS-07,GRL-06,DOG-12,hold}.png` |
| 11 | One bubble per UI scale | **PASS**. UI 100: 720 PAY-03 `above`, 1080 INS-06 `above`. UI 125: PAY-02 `side`. UI 150: 720 DOG-02 `above` / L, Deck CRW-01 `above`. All have the ink border, the paper fill and the tail on the speaker. `worldVoice.css` is unchanged since 02:32, so the AD2d F11 band proof holds | `crops/bubble-per-ui-scale-x2.png` |

**A13 gates.**
| gate | result | evidence |
|---|---|---|
| workbench >= 90, lint 0 / 0, silhouette 1 component, palette-only + alpha 0 / 255 + dims, DENIZEN_ART 1.2 sizes | PASS: **cited from AD2d** (no PNG changed). The `public/assets/world/*.png` + `bg/window-lit.png` mtimes are the same as in `<O>/ad2d/png-mtimes.txt`. `npx vitest run src/assets --maxWorkers=2`: 8 files / 151 pass (incl. `worldSheets.test.ts`) | `<O>/ad2f/png-mtimes.txt`, `<O>/ad2f/assets-vitest.txt` |
| AD in-game verdict RELEASE-READY | **YES** (F17-F23 closed, Q6 PASS, no S1 / S2 / S3 open) | this section |

**DENIZEN_ART 8.2 on every AD2f frame.** One pixel grid PASS. Palette-only era rows PASS (art unchanged). No denizen faces the
machine PASS. Tail points at the head PASS (32 ladder, 15 chain, 8 demo judgments). Bubble never covers crank, prompt or gain text
PASS (0 hits). Nothing un-happens PASS (hole, lit lamp and windows, dark girl window, dog `lie` hold after reload). 4.2
"re-evaluated at most every 250 ms, with hysteresis, so a pan does not flip it" **PASS** (0 jumps in 31 traced lines and 27 screencast tries, 0 refits in 38 logged shows).

Accepted notes (no fix, unchanged from AD2e). The `above` payphone box at UI 100 / 1080 touches the crow's lower-left wing edge;
the head and beak stay clear. The dog tail tip sits 7-11 client px left of the judge's dog-box centre, on the director's head
anchor. The payphone `side` tail ends on the booth hood 29-36 px left of the receiver at UI 125 / 150. On the first payphone line
after a long time skip, the side box follows a settling camera by 1-3 px.

**F-list (open):** none. Optional, not a gate: the AD2e repo guard for F23 (`scripts/smoke/world.mjs` forces PAY-03 six times at s8
Deck and asserts box left / top within 4 px over 700 ms after `.wv.on`) was not added. Add it when `world.mjs` is next touched
(WP23b), so a later placement change cannot bring the jump back unseen.

No tuning this round; no art defect found (no PNG touched). Order for the Director: WP23a may merge on the AD side. Keep green into
WP23b: F17-F23, Q6, font, RARE / OFF, reduced motion, POST-CAP arc + hold, budgets, placeholders, palette, A13 art gates.

## WP23b — living world audit (Art Director AD4, round 4, 2026-10-25)

Verdict: **FIXES REQUIRED** (not RELEASE-READY). 1 S1, 6 S2, 1 S3 smoke gap, 6 accepted notes. Every code fix is prototyped on a
scratch build and proved in a new screenshot (`after*/`); none is in the repo code yet (workers, B10). One asset is fixed here (F4).
The arc reads: eras get stranger (umbrella under a dry sky, virga, white sprout, the girl on the ground, readout `1`, violet rims,
reverse walks, black puddle, dead lamp), the wave restores every denizen (rows 4 -> 5 at the derived times), the postgame holds the
same day (pat, mark 42, PAY-12, Sensor 7 turn), cycle 2 shows marks 42, the red ball, the crow frozen high, readout `1`, the
clipboard, INS-14 / PAY-13. It breaks at two story beats: **LAST LOOK has no girl at her window and the postgame window is empty**
(F1), and **the pat hides the dog** (F5).

Build under audit: `dist` 16:10:23 and `dist-demo` 16:10:42 (no `src` / `public` / `scripts` file newer: step 0). :4174 served
`dist`; :4177 was not started (demo judged from the EM gate `<O>/val4/world-demo` and `<O>/val4/demo`, both fail [] errors [], plus
the era-row diff below). After F4 AD4 ran `npm run build`: dist now carries the new `world/lantern.png` (app 483.2 KB, lazy world
chunk 116.1 KB, code unchanged). One Playwright browser at a time. Evidence root `<O>/ad4/` (`<O>` =
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP23b`):
`cap/` (states, bubbles, Chladni; PNG + probe JSON), `fin/` (finale keys, choice, reduced motion), `pg/` (postgame on the KEEP clock,
PAY-12, Sensor 7 turn), `cyc/` (cycles 2 and 3), `crops/` (1:1 to 10x nearest crops, boards, before / after pairs), `after/`,
`after2/`, `after3/` (the same captures on the prototype build), `tools/` (`lib.mjs` with a route-intercepted `http://ad4.test/`
base for scratch builds, `states.mjs`, `bubbles.mjs`, `finale.mjs`, `chladni.mjs`, `cycle2.mjs`, `regress.py`, `board.py`,
`crop.py`), `proto/` (scratch copy of `src` + `public` with the F1-F3 and F5-F7 edits; `dist-proto/`), `proto-fixes.diff` (the
exact prototype lines), `head/` (the b96599c world PNGs).

### Captures
| set | files (`<O>/ad4/`) |
|---|---|
| eras, default camera, quiet | `cap/state-{s9,s10,s11,s12,s13,s14,s15}-1080.png`; `cap/state-{s10,s11,s13,s15}-{720,720u150,1080u150}.png` |
| bubbles eras III-V (18 lines x 4 configs) | `cap/bub-{s10,s11,s13,s15}-{720,720u150,1080,1080u150}-<LINE>.png`; boards `crops/board-bub-720u150.png`, `crops/board-bub-1080u150-s13s15.png` |
| finale film 1080 / 720u150 | `fin/fin-{1080,720u150}-k{13_1,19_6,24_3,30_9,31_1,32,33,37_5,38,41_3,45_3,48_5,59_85}.png`, `-choice.png`; board `crops/board-fin-1080.png` |
| reduced motion film | `fin/fin-rm-1080-k{15,24_4,31_7,36,38_5,41_3,45_3,49_5,59_9}.png`; board `crops/board-fin-rm.png` |
| postgame (KEEP clock) | `pg/pg-{1080,720u150}-keep{0_6,2_5,3_6,4_3,6,7_5,9_5,14,24,26,28_5,33}.png`, `-PAY-12.png`, `-sensorTurn.png` |
| cycles 2 / 3, era I | `cyc/cyc{2,3}-e1-{1080,720}.png`, `cyc/cyc2-{INS-14,PAY-13}-{1080,720}.png` |
| Chladni by tier | `cap/chladni-s13-sw{3,8,20}.png`, `cap/chladni-s15-sw20.png` |

### Gates
| gate | result | evidence |
|---|---|---|
| placements s10 / s11 / s13 / s15 (A1 rule) | PASS. Wings only, clear of the machine and the hub. s10 booth 2858 at the right edge; at UI 150 the SYSTEM button covers the s10 dog and the booth feet (accepted, the DENIZEN_ART fix 6 logic). Era V girl front row 976, dy 40 after 5 steps, clear of the left anchor | `cap/state-*.png`, `crops/s15-1080-left-x4.png` |
| bubble ladder III-V | PASS. 72 / 72 forced lines shown and verbatim (CRW-05 = `Zero-zero-four-two. Zero-zero-four-two.` in cycle 1); tails on the girl mini, the girl on the ground and the receiver; none on the HUD panel, buttons or toasts. `below` at s13 UI 150 (INS-10, GRL-10, DOG-10) and `side` for the payphone, as DENIZEN_ART 4.2 predicts. Overlaps machine art only (allowed) | `crops/board-bub-*.png`, `cap/bub-*.json` |
| palette lock | PASS. `npx vitest run src/assets/worldSheets.test.ts` 29 / 29; F4 lantern `check_sheet` CLEAN, workbench score 91.0, lint 0 / 0 (upload `65011c4e-c064-4b8a-b170-c4a3bd931629`) | — |
| no denizen faces the machine | PASS. Era V reverse walks face the machine only while moving, head down (the WP23a walk grammar); rest poses face away | `crops/s15-ins-x10.png` |
| readability floors | PASS at zoom .5 / .75 / 1 (sheet sizes unchanged since AD3d). Era V girl lantern merges with her rim (N2) | `crops/s15-1080-left-x4.png` |
| flicker <= 3 Hz | PASS by data: downbeat accents on `TIER_HEARTBEAT` 2.4 s (0.42 Hz), era V crow stutter 4-frame loop at 8 fps (2 Hz), double exposure 1 per 30-60 s for 120 ms, girl window 1.5-4 s. Reduced motion: no double exposure (world.mjs `I_double_exposure`), no breathing, static crow | world.mjs val4 |
| no spoiler before the finale | PASS. The 18 era III-V texts + INS-14 / PAY-13 / PAY-12 / INS-PG are verbatim to bible 5.2; no `/restor/i`; virga, puddles and sprout stay grey / white; green only in whole cells (sprout bloom, puddle whole, Sensor 7 LED) | `cap/bub-*.json`, `cyc/*.json` |
| finale (B-A5) | PASS except F1. Shields show as the camera comes back (16-19.3 s; 13 s is the crown shot, no denizen in frame by canon camera). lanternDrop at 31.8 s, she runs left 32-34 s with her back to us. Crow lead from 38.4 s, back on the perch by 49.4 s. LAST LOOK flips at the derived time, every on-screen denizen front (inspector front, dog head, crow head, Sensor 7 headC); the choice holds the stare. Survey holds: baseL Sensor 7 headUp with the green LED, the Inspector, the bloom, the sky puddle; baseR dog unchained, clock, booth marks readable at zoom 1, empty lamp | `crops/board-fin-1080.png`, `crops/fin-1080-baseR-right-x3.png`, `crops/fin-1080-baseL-sensor-x8.png` |
| reduced motion film | PASS. Whole row at 24.4 s, the girl gone, the fallen lantern from 24.4 s, crow cut 38.5-49.3 s, LAST LOOK instant at 59.9 s | `crops/board-fin-rm.png`, `fin/fin-rm-*.json` |
| postgame (B-A6) | PASS except F1, F2, F5. LAST LOOK poses at KEEP +0.6 s, all turned away at +2.6 s, the crow pecks mark 42 on the booth roof at +3.65 s, the dog fades at home and re-enters on the left wing (chase 639 -> sleep 732), pat + in-world `Good boy.` (loopS 14.5-20), watch, wave, PAY-12, Sensor 7 headC turn | `pg/*.png`, `crops/pg-1080-peck-x4.png` |
| PAY-12 at UI 150 | PASS (`above`, tail on the hood, clear of the buttons) | `pg/pg-720u150-PAY-12.png` |
| cycle 2+ (B-A7) | PASS except F6. Marks 42 / 43, red ball beside the paws, crow frozen in `fly2` above the lamp, readout `1`, clipboard thin / medium, girl mini (cycle 2) / ground (cycle 3), INS-14 and PAY-13 verbatim | `cyc/*.png`, `crops/cyc2-1080-right-x3.png`, `crops/cyc3-1080-left-x4.png` |
| demo regression (eras I-II unchanged) | PASS. In every era-row sheet the row I and II cells of every frame the demo uses are pixel-identical to b96599c (`tools/regress.py`; the changed cells are only frames of eras III+, the finale and the postgame: inspector shield / pat / wave / watch / umbrella, dog shake / flat / sleep / chase / wag, crow perch / peck / fly, girl ground frames, booth fog / restored, receiver onHook, Sensor 7 fog, lamp warm / restored, glow warm, clock restored, mote moth, stake fallen, girl window restored); demo + world-demo smokes green at val4 | `crops/demo-keep-wp23a-vs-wp23b.png` |

### Q6 (each era entry adds a background-scale change seen at the default camera, 1920x1080)
| entry | change | result |
|---|---|---|
| II -> III | virga curtains across the whole sky band above the ridge (sf .15, alpha .55 reads: AD3d H5, keep .55), warm lamp + glow, puddle, white sprout | **PASS** `crops/q6-II-III-band.png`, `crops/s11-1080-virga-x3.png` |
| III -> IV | shipped: the virga freezes into beads (subtle) and the girl comes down to the ground; the Chladni rings need standingWave MK III (level 8) and the smoke path buys 3, so **no rings**; after a reload in era IV the virga even falls again (F3) | **FAIL as shipped** `crops/q6-III-IV-band.png`, `crops/virga-sequence.png`. With F3 + F7 (rings from standingWave MK I, alpha 1): dashed sand rings in the ground band in front of the machine + frozen beads: **PASS (marginal)** `crops/Q6-chladni-s13-before-after-x1.png`, `crops/Q6-III-IV-after-band.png` |
| IV -> V | the six windows go dark by stage, the virga fades out, black puddle, tall bent sprout, dead lamp | **PASS** `crops/q6-IV-V-band.png` |

### F-list
| F | sev | defect | evidence (`<O>/ad4/`) | owner | exact change |
|---|---|---|---|---|---|
| F1 | S1 | The girl's restored window is invisible at LAST LOOK and in the whole postgame. `WorldProps.paintDynamic` sets the girl window alpha to `WORLD_ENV.windowAlpha * windowsAlpha`, and the script's `windowsAlpha` is `1 - skyline track` = 0 from 37.3 s and 0 in the postgame. "The girl appears at her restored window", "the girl at her curtain" and the Inspector's wave up at her have no picture | `crops/F1-girlwindow-lastlook-before-after-x8.png` (1080p screen x 1227-1233, y 588-597 at the full pose) | worker FX2 | `this.girlWindow.setAlpha(clamp01(WORLD_ENV.windowAlpha * (this.propScript?.girlWindow === 'restored' ? 1 : wa)))`; probe reports the restored window (FX2 d) |
| F2 | S2 | The PAY-12 bubble covers its own booth at UI 100 (1080p). The script anchor of the payphone is the booth top for head **and** feet; the crow's head reserve blocks the centred `above`, and the centred `below` then lands on the booth body (marks and clock hidden). B-A6 wants it above the hood | `crops/F2-pay12-1080-before-after-x2.png`, `pg/pg-1080-PAY-12.png` | worker FX2 | `WorldProps.anchor('payphone')`, script branch: `return { head: top, feet: screenOfWorld({ x: b.x, y: b.y }, 1, cam) }` (feet = booth feet). Proto: `above`, slid left, tail on the hood, crow and booth clear; UI 150 unchanged (`above`) |
| F3 | S2 | The virga keeps falling in era IV / V after a load or any jump into era IV. `WorldAtmos` builds the tile sprite on frame `fall` but starts `virgaFrame = 'frozen'`, so the first apply in era IV skips `setFrame`. Every reload in era IV shows rain falling ("virga hangs frozen" lost) | `crops/F3-virga-reload-eraIV-before-after-x3.png`, `crops/virga-sequence.png` | worker FX1 | `private virgaFrame: 'fall' \| 'frozen' = 'fall';` and the probe reads the drawn frame |
| F4 | S2 | The fallen lantern is unreadable: an all-dark 6x3 capsule (ink + `#2b2e31` glass) that vanishes on the dark base of the restored bush and reads as a stone in the postgame grass | `crops/F4-lantern-postgame-before-after-x5.png` | **AD, fixed** | `masters/lantern/lantern.txt` frame `fallen` redrawn: on its side, ink cage, warm glass `B` / `C`, rust base `d` (`..KKK.` / `.KKBdK` / `.KKCdK` / `..KKK.`); `public/assets/world/lantern.png` rebuilt, check_sheet CLEAN, score 91.0, lint 0 / 0, worldSheets 29 / 29 |
| F5 | S2 | The pat hides the dog. In the postgame the Inspector is re-parented into the front row (Z7) after the dog at the same depth, so he draws over the sitting dog's head; the beat reads as a man with a brown lump at his feet | `crops/F5-pat-before-after-x8.png`, `crops/pat-mock-x8.png` | worker FX3 | Z7 pick: the resident draws on top. `LivingWorld.placeInRow`: body and blend depth = `WORLD_DEPTH_OFFSETS.cast` in the walker's home row, `cast - 0.02` in a visited row, then `sortWorldRows`. Proto: the dog sits in front of his legs, head and ear clear |
| F6 | S2 | Cycle 2+ era I (framing e1): the girl mini (pylon plane, game x 164) stands inside the Inspector's route (body 152-232 game px) and shows as a dark blob behind his legs. At e1 the pylon-plane foot sits on the ground line, and the scraps at 1420 / 1530 cover every spot between Sensor 7 and the pylon (tried art x 132 and 186) | `crops/F6-cyc2-girlmini-before-after-x4.png`, `crops/F6-cyc2-mini-132-vs-186-x2.png`, `crops/F6-cyc2-mini-before-after-x2.png` | worker FX2 | `WORLD_FAR_PLANES.girlMini.footArtXE1: 100` (e1 only: game x 72, between scrap 1330 (game 50) and Sensor 7 (88-120), 64 px from the view edge, clear of the HUD at UI 150); WorldProps sets the mini x from the framing on every apply (s8 / s9 keep footArtX 146: 85 / 171) |
| F7 | S2 (Q6) | III -> IV background change too weak (see Q6) | as Q6 | worker FX4 | `WORLD_CHLADNI.intensityByTier` `[{ minTier: 3, intensity: 2 }, { minTier: 1, intensity: 1 }]`, `alpha` 0.8 -> 1 (Director Q6 lets the AD scale it; bible §10 MK III / V becomes MK I / III) + the 4 tests that pin the old mapping |
| F8 | S3 | The smokes cannot see F1-F3 (J_drawn / K_drawn assume no girl entry after 31.5 s, K_pay12 checks only the UI 150 buttons, the virga probe reported the field and not the drawn frame) | — | worker FX5 | `scripts/smoke/world.mjs` J_drawn / K_drawn / K_pay12 / new K_pay12_ui100 / J_girl_window / I_virga_frozen + README |

### Notes (accepted, no fix)
- N1 The baseL hold does not show the lantern: it lies at the girl's era V feet (front row + 40 = world y 1752) and the baseL view
  ends at y 1740 (canon camera; the survey keys must not move). It shows at the full pose from 31.7 s, at LAST LOOK, at the choice and
  in the whole postgame (after F4: a warm lantern in the grass). Doc follow-up: bible 9.1 / DENIZEN_ART 3 baseL row.
- N2 Era V girl: the violet rim runs over her lantern, so the "violet lantern" is not a separate light at zoom .5.
- N3 The crow leads the 38 s flock at its own 20x14 size; the canon flock birds are far smaller: it reads as a near bird ahead of a
  far flock.
- N4 AD3d H6: era V `lit 4` shows 3 windows at s15 (pane (318, 146) behind the machine). The steps still read.
- N5 The restored regrowth bushes stand around the left-wing figures in the finale and the postgame (behind them by depth).
- N6 The double-exposure frame (120 ms) was not caught on a still; schedule, counter and reduced-motion off are proved by world.mjs
  `I_double_exposure`.

### finale.mjs frame baselines
**Not re-approved this round.** `finale-world-k59_83.png` and `finale-world-postgame.png` change with F1 (window) and F4 (lantern).
The keys 13, 24.3, 31.1, 38, 41 and 45 are approved as they are in `<O>/val4/finale/`; re-approve 59.83 and the postgame on the
first finale.mjs run after B10.

### Re-check list (next round)
F1 (LAST LOOK + postgame window, 1080 and 720), F2 (PAY-12 at UI 100, 1080 and 720; UI 150 unchanged), F3 (era IV after a reload:
beads), F4 (postgame lantern, 1080 and 720), F5 (pat crop), F6 (cycle 2 e1 at 1080 and 720u150), F7 (Q6 III -> IV pair on the
smoke stage list), world.mjs and finale.mjs green, finale baselines.

### WP23b round 5 (Art Director AD4r5, 2026-10-25)

Verdict: **RELEASE-READY.** F1-F7 closed in game, F8 green in the EM gate (val6 / val7), no S1 / S2 open. N7 (postgame dog facing)
accepted, N8 (pat bubble tail) recorded. finale.mjs frame baselines re-approved (B-A10). The arc reads end to end: era III umbrella
under the dry virga, era IV frozen beads + sand rings + the girl on the ground, era V violet rims, dark windows, black puddle, dead
lamp, reverse dog walk; the wave restores every denizen; LAST LOOK lands with the girl at her lit window; the postgame holds the same
day (pat, wave at the window, mark 42, PAY-12, Sensor 7 turn); cycle 2 shows marks 42, the red ball, the crow frozen high, readout
`1`, the clipboard and the girl mini, cycle 3 the girl on the ground.

Build under audit: `dist` 19:08:42, `dist-demo` 19:08:55; no `src` / `public` / `scripts/art` file newer (only `scripts/smoke`
perf-budget.json, README.md, world.mjs). :4174 served `dist`; :4177 not started (demo judged from sheets + the EM val7 demo frames).
No rebuild, no source or asset change this round. One Playwright browser at a time; vitest `--maxWorkers=2`.
Evidence root `<R>` = `<O>/ad4r5/` (`<O>` as round 4): `fin/`, `pg/`, `cap/`, `cyc/`, `facing/`, `demo/`, `crops/`; tools in
`<R>/tools/` (finale.mjs, states-reload.mjs, cycle2.mjs, bubbles.mjs, era4-facing.mjs, crop.py, board.py, imgdiff.py; they reuse
`<O>/ad4/tools/lib.mjs`). Keyed postgame stills land 0-2 s after their label at 1080 (screenshot time); the JSON beside each still is
read just before the shot.

| check | result | evidence (`<R>/`) |
|---|---|---|
| F1 girl window, LAST LOOK 59.83 s + postgame (1080, 720, 720u150, 1080u150) | **PASS.** Lit restored window with the girl at her curtain at 59.83 s and through the postgame (wave beat included); probe `girl window-restored visible` at every key | `crops/F1-girlwindow-k59_83-r4-vs-r5-x8.png`, `crops/F1-girlwindow-pg-wave-r4-vs-r5-x8.png`, `crops/F1-girlwindow-720-k59_83-vs-pgwave-x10.png`, `crops/F1-girlwindow-720u150-k59_83-r4-vs-r5-x10.png`, `crops/F1-girlwindow-720u150-pgwave-r4-vs-r5-x10.png` |
| F2 PAY-12 (UI 100 and 150) | **PASS.** `above` in all 4 configs, tail on the booth hood, booth marks and clock clear, clear of the buttons (1080: box b 891 vs buttons t 999; 720u150: 587 vs 639); text `Thank you for holding.` | `crops/F2-pay12-1080-r4-vs-r5-x2.png`, `crops/F2-pay12-720-r5-x3.png`, `crops/F2-pay12-720u150-r5-x3.png`, `crops/F2-pay12-1080u150-r5-x2.png` |
| F3 virga after reload (era IV / V) | **PASS.** s13 save + reload: drawn frame `frozen` on the first probe and 3 s later, beads only, never streaks; s15 reload: strip hidden (era V fade), no fall | `crops/F3-virga-eraIV-before-vs-after-reload-x3.png`, `crops/F3-virga-eraIII-fall-vs-eraIV-reload-x3.png`, `cap/state-s1{3,5}-1080-reload*.{png,json}` |
| F4 fallen lantern | **PASS.** Warm capsule in the postgame grass at 1080 and 720 (was a dark stone) | `crops/F4-lantern-pg-1080-r4-vs-r5-x10.png`, `crops/pg-720-keep24-left-x5.png` |
| F5 pat order | **PASS.** Dog sits in front of the Inspector's legs, head and ear clear, hand on the shoulder, in-world `Good boy.` | `crops/F5-pat-1080-r4-vs-r5-x4.png`, `pg/pg-720-keep26.png` |
| F6 cycle 2 girl mini (e1) | **PASS.** Stands between the scrap and Sensor 7, clear of the Inspector route, 1080 and 720u150. Cycle traces: marks 42 / 43, red ball, crow `fly2` high, readout `one`, clipboard thin / medium, girl mini / ground; INS-14, PAY-13 verbatim | `crops/F6-cyc2-girlmini-1080-r4-vs-r5-x4.png`, `crops/F6-cyc2-girlmini-720u150-r5-x5.png`, `cyc/*.png` |
| F7 Q6 III -> IV | **PASS (marginal, as R4).** Era IV entry (s12, resonatorSpire): virga freezes to beads, the girl comes down; standingWave MK I-III (s13, `rings-3`, alpha 1) adds dashed sand rings in the ground band | `crops/F7-chladni-s13-r4-vs-r5-x2.png`, `crops/Q6-III-IV-s11-vs-s13-band-x1.png` |
| F8 smokes | PASS by the EM gate: val6 (a11y, ux, resolutions, e2e, finale, showcase, perf, prestige, store1080) and val7 (world-demo, demo, finale-perf, soak) fail [] errors [] | `<O>/val6/progress.txt`, `<O>/val7/progress.txt` |
| finale film keys 1080 (13, 19.6, 24.3, 31.1, 32, 38, 41, 45, 59.83, 60.5) | PASS. Shield, wave restore, girl run with her back to us, crow lead, survey holds, LAST LOOK (inspector `front`, dog `head`, crow `head`, Sensor 7 `headC`, girl window) | `crops/board-fin-1080.png`, `crops/lastlook-1080-{left,right}-x4.png` |
| finale.mjs frame baselines (B-A10) | **RE-APPROVED.** `finale-world-k59_83.png` (window lit, typing `Y`) and `finale-world-postgame.png` (window, warm lantern, dog asleep by its ball). Keys 13 / 24.3 / 31.1 / 38 / 41 / 45 differ from the val4 set only by animation phase (machine, sound arcs, flock, crow wing; 9k-234k px), same composition: approved | `<O>/val6/finale/finale-world-*.png`, `crops/baseline-k{24_3,38}-val4-vs-val6.png`, `crops/smoke-k59_83-girlwindow-x8.png`, `crops/smoke-postgame-{left,right}-x5.png` |
| reduced-motion finale | PASS. Whole row at 24.4 s, girl gone, crow cut, LAST LOOK poses with `lastLook` true at 59.9 s, no blink (world.mjs `J_reduced` in the gate) | `crops/board-fin-rm-1080.png`, `fin/fin-rm-1080-k59_9.{png,json}` |
| postgame beats | PASS. Turn away by +2.5 s, crow hop / `peck0` at the booth (+3.0 / +3.87 s), tally 42, dog re-entry on the left wing, pat, wave at the window, write, PAY-12, Sensor 7 `headC` turn (4 configs) | `crops/board-pg-720-wings.png`, `crops/pg-peck-720-vs-720u150-x5.png`, `pg/pg-*-sensorTurn.png` |
| regression eras III / IV / V, 1080 UI 100 | PASS. Palette: `worldSheets.test.ts` 29 / 29. Faces: rest poses face away (left wing left, right wing right); the Inspector's rightward patrol leg faces the machine head down on the clipboard (WP23a walk grammar; 96 timed samples in era IV); era V stare is camera-front. Bubbles: 6 / 6 (INS-08, DOG-08, GRL-10, INS-10, PAY-11, GRL-11) clear of the HUD panel and the buttons, tails on the speakers | `cap/state-s{9..15}-1080.png`, `crops/s11-1080-{left-x5,right-x4}.png`, `crops/s13-1080-cast-left-x8.png`, `crops/s15-1080-{left-x5,right-x4}.png`, `facing/strip2-x6.png`, `crops/board-bub-1080-eras.png` |
| demo eras I-II unchanged | PASS. World PNGs untouched since R4 (all 12:13 except `lantern.png` 17:40, not used by the demo); `regress.py` vs b96599c shows the same cells as R4 (III+ / finale / postgame frame columns only); val7 world-demo vs val4: animation phase only | `demo/demo-s9-150-val4-vs-val7.png` |

Notes (accepted, no fix):
- N7 Postgame dog facing (`src/data/worldEnding.ts` `WORLD_POSTGAME_LOOP.dog`, flip false on sleep / wake / calm / sleep2): kept. At
  x 732 the dog faces right toward the Inspector (784 / 742) and its red ball (754), the two targets of the postgame beats; the
  machine is far past them. `patted` must stay flip false (the pat contact test), so a flip on wake / calm would add a turn at
  14 s and 20 s, and sleep / sleep2 must match each other across the 90 s wrap; flipping them would make the dog sleep with its back
  to its ball. The DENIZEN_ART 1.4 facing rule targets the pre-finale rest poses; in the postgame the dog looks at its people.
- N8 `Good boy.` at 1080 UI 100 uses the `side` box right of Sensor 7's head; its tail sits ~35 screen px right of the Inspector's
  head (same as R4). The Inspector is the only speaker in the beat; it reads.

## R — store set (v0.10.0)

Art Director, §R row 14 + row 11, 2026-10-25. Verdict: **FIXES REQUIRED** (one smoke-script fix, F1; no asset, data or game change).
The repo script's set passes every check but shows a state play never reaches: the living-world cast is on the previous framing's
spots in 4 of the 6 store / alt frames. The fixed set is prototyped and judged (`proto/set3/`): store quality, order unchanged.

Build under audit: `dist` 21:11:41 (`index-DAjYYxoV.js`, `index-cyaZ_Ykl.css`), `dist-demo` 21:12:07; `find src public scripts/art
-newer dist/index.html` prints nothing; `APP_VERSION` 0.10.0. :4173 = `vite preview` of `dist`, started for this round and killed after
it. One Playwright browser at a time. Evidence root `<R>` = `.../scratchpad/R/` (`store-final/` = repo-script set; `ad-store/` =
AD work: `probe04/`, `crops/`, `tools/`, `proto/`).

### Repo-script set (`<R>/store-final/`, run 22:02:50–22:06:35, `SIZES=1080,2160`)
exit 0, `fail []`, `errors []`, 115 / 115 checks ok; 38 PNGs (19 at 1920x1080, 19 at 3840x2160); 28 `*_no_spoiler` true (plate
frame <= 2, plaque `PRIMARY FUNCTION: RES?OR?` on 03-07 and 09, `UNKNOWN` / `R?S????` on 01 / 02, hits []), 8 `*_plate_cap` true
(01 / 10 / 09 `substationBlueprint`, 08 null), `store_top5_complete` true, missing []. Plates read `RES?OR?` at 2160
(`crops/p07-plate-2160-x4.png`); no RESTORE / RESTORATION text in any store or alt frame. Machine art, tiers, palette: intact
(belts on their pulleys, valve wheel clear, MK tiers as WP22 R5).

### F1 (S2, store-facing): cast on stale spots
| frame | rank | seen | should be (play) |
|---|---|---|---|
| `03-era2-generator-hud` | 3 | booth, clock, lamp hidden behind the generator / transformer; crow pokes over the generator yoke | era II right wing: clock, booth + receiver, lit lamp + glow, crow, dog |
| `04-era3-boiler-hud` | alt | no Inspector, no Sensor 7, no puddle / sprout, no lamp / booth (all behind the boiler / flywheel) | Inspector under the umbrella, Sensor 7, puddle, white sprout, warm lamp, booth fog, crow, dog |
| `06-era4-spire-hud` | 2 | no girl | the girl on the ground (era IV beat) |
| `07-era5-ruined-clean` | 1 | no girl | the girl in the front row, violet rim (era V beat) |

Cause: `unseenChangeOk` (`src/game/math/worldPlacement.ts`) lets a cast relocation commit only while the TECH INDEX is open or
when old and new spots are both off screen. In play every buy is made in the TECH INDEX, so the cast moves there. `store-shots.mjs`
buys through `session.purchase` with the tree closed, so the cast keeps the old spots; stem 05 opens the tree once (06 / 07 then
start from s11 spots and miss the girl). Probe (`ad-store/probe04/s11-probe.json`, 0-18 s after the S11 buys): inspector 1472,
sensor7 1384, dog 2364, payphone 2420, lamp 2476, puddle / sprout hidden, unchanged for 18 s; AD4r5 s11 (real buys): 784 / 712 /
2856 / 3050 / 3104. Game code is right (WP23a / WP23b gates); the script is not play-faithful.

Fix (owner: worker via EM, `scripts/smoke/store-shots.mjs`, exact diff `<R>/ad-store/proto/F1-store-shots.diff`, patched file
`<R>/ad-store/proto/store-shots.F1.mjs`, CRLF): add `waitWithTreeBlink(page, totalMs)` after `quietWorld` (`t`, 600 ms, Escape,
then wait `max(300, totalMs - elapsed)`), and replace the post-buy wait in stems 02 / 03 / 04 / 06 / 07 (`waitForTimeout(2500)` x3,
`12000`, `15000`) with `waitWithTreeBlink(page, <same ms>)`; header note lines. The blink runs right after the buys: their fly-ins
started with the tree closed, so the close releases nothing and the camera does not nudge (framing pixel-same as before); the total
wait is unchanged, so the stem 03 milestone toast stays opaque (shot at +5.2 s / 2160, +5.5 s / 1080; fade starts at 6.5 s).
A blink after a 1 s settle (proto 2) shot 03 at 2160 with the toast mid-fade: rejected. README `### store-shots.mjs`: after the
"Hide rules for hud shots" line add: "TECH INDEX blink (AD R): stems 02, 03, 04, 06 and 07 open and close the TECH INDEX once right
after the buy list (`t`, 600 ms, Escape; the total wait is unchanged). The living world moves its cast to a new framing only while
the tree is open (`unseenChangeOk`), as in play; without it the cast keeps the previous framing's spots."

Proof (`<R>/ad-store/proto/set3/`, the F1 behaviour + a timing log, 22:23:38–22:27:22): exit 0, `fail []`, `errors []`, 115 / 115,
28 no_spoiler + 8 plate_cap true, missing []. Board `crops/board-cast-repo-vs-fix-2160.png` (per stem: repo top, fix bottom; 03, 04,
06, 07 wings at 2160). 02, 05, 08, 08b, 09, 10 unchanged (09 portrait placements are forced by the ending).

### Store set and order (unchanged, G8)
1 `07-era5-ruined-clean` (violet era V, the girl front row, dead lamp, black puddle), 2 `06-era4-spire-hud` (four-resource HUD,
plaque capped, girl on the ground, sand rings), 3 `03-era2-generator-hud` (milestone toast, era II cast at the lit lamp), 4
`05-tree-era3-hud`, 5 `09-postgame-portrait-clean` (restored world, booth tally 42, warm lamp, dog by the lantern); alt
`04-era3-boiler-hud` (umbrella under the dry virga). Upload the 2160 files of the post-F1 run.

Notes (no block): N1 a WELCOME BACK toast shows mid-session (02 / 04 log) from the 8 h `session.update` jumps in `buyList`; the
toast stack is hidden in every hud shot but 03, where only the milestone shows. N2 gain floaters vary with the 3-click timing (06
hud: legible at 1080, outside the frame band at 2160); intended.

Re-check after F1 (Director / EM, no AD round needed if all hold): re-run into `<R>/store-final` (preview restarted): fail [],
errors [], 115 checks, 28 + 8 true; 03 hud 2160: lamp + booth on the right wing and the milestone toast opaque; 04: Inspector with
umbrella at the left; 06: girl left of the boiler; 07: girl in the front row. Any miss: back to the AD.

**Row 11 release art sign-off (v0.10.0):** in-game PASS (WP22 round 5, WP23a AD2f, WP23b AD4r5: RELEASE-READY); store set PENDING
F1, PASS when the post-F1 run meets the re-check above (cast as in `proto/set3/`).

### R round 2 (store set after F1)

Art Director, 2026-10-25. Verdict: **FIXES REQUIRED** (F2 + F3, both smoke-script only; no asset, data or game change). F1 holds:
every cast re-check passes at 2160 and 1080. Two new script defects: the rank 5 frame (09) loses the dog by machine speed, and the 2160
02 hud shot has no ME number.

Build: `dist` 21:11 (`APP_VERSION` 0.10.0), no source change since. :4173 = fresh `vite preview` for this round, killed after it
(netstat empty). One Playwright browser at a time. `scripts/smoke/store-shots.mjs` = `proto/store-shots.F1.mjs` (CRLF-insensitive
diff empty); README blink paragraph present.

Gate (`<R>/store-final2/`, 22:44:24-22:47:41, `SIZES=1080,2160`): exit 0, `fail []`, `errors []`, 115 / 115 checks ok; 38 PNGs;
28 `*_no_spoiler` true (frame <= 2, plaque `RES?OR?` 03-07 / 09, `UNKNOWN` / `R?S????` 01 / 02, hits []), 8 `*_plate_cap` true
(01 / 10 / 09 `substationBlueprint`, 08 null), `store_top5_complete` true, missing []. Store order unchanged (07, 06, 03, 05, 09; alt 04).

| re-check | 2160 | 1080 | evidence (`<R>/ad-store/r2/`) |
|---|---|---|---|
| 03 hud: lamp + booth on the right wing, toast opaque | PASS: clock, booth + receiver, lit lamp + glow, crow, dog; MILESTONE toast full | PASS | `03-wings-2160-x1.png`, `03-wings-1080-x3.png`, `03-toast-2160.png` |
| 04 hud: Inspector with umbrella at the left | PASS: umbrella, Sensor 7, sprout, warm lamp, booth, crow, dog | PASS | `04-wings-*` |
| 06 hud: girl on the ground | PASS: left of the boiler | PASS | `06-wings-*` |
| 07 clean: girl in the front row | PASS: front row, violet rim, dead lamp, black puddle + sprout | PASS | `07-wings-*` |
| 02, 05, 08, 08b, 10 unchanged | PASS except 02 hud 2160 (F3); 05 pixel-same as set3 | PASS | `sheet-rest-*-{1080,2160}.png` |
| 09 unchanged | FAIL: no dog (clean, both sizes) (F2) | FAIL | `09-left-4runs-2160.png`, `09-band-L-new-vs-p3-1080x2.png` |

F2 (S2, store-facing, rank 5): 09 clean shows the dog only by chance. The KEEP beats (`WORLD_ENDING.keep`): the dog fades 4-4.5 s
after KEEP, is hidden until 7 s, runs in 7-8 s, settles 9 s. Stem 09 shoots hud at +2.5 s and clean when the hud capture ends, so
clean lands in 4.5-9 s by machine speed: `store-final` and set3 caught the dog, `store-final2` (both sizes) did not; 09 hud never
has it. Fix: wait for `worldState().script.keepS >= 10` (loop running, dog asleep at its left-wing spot by the Sensor 7 lantern),
both shots before 22 s (Inspector walk at loop 13.34 s; no line fires before the pat); check `<size>_09_keep_window`.

F3 (S3, spare frame, guard for every hud shot): `02-era1-full-hud` 2160 has `ME` with no number (1080 fine; set3 / `store-final`
fine; set4 repeats it). Probe (`tools/hudme-probe2.mjs`): after `uiRootHiddenShot` toggles `#ui-root` inline visibility, the next
HUD counter bump leaves `#hud-me` computed `visibility: hidden` with no matching rule and no inline style (CDP matched styles empty;
Chromium animation base style); dpr 1 escapes by timing. Photo mode and the title (class rules) do not reproduce it
(`tools/hudme-probe3.mjs`); the game never sets that inline style, so no game bug. Fix: hudShot sets and restores an inline
`visibility` on every `#hud-panel` node right before the shot, then checks `<size>_<id>_hud_values_visible` (`{ values, hidden }`).
Evidence `r2/probe/hudme-before-after-2160.png`.

Fix (owner: worker via EM): `scripts/smoke/store-shots.mjs` = `<R>/ad-store/proto/store-shots.F2F3.mjs` (CRLF, `node --check` ok;
diff `proto/F2F3-store-shots.diff`); `scripts/smoke/README.md` = `proto/README.F2F3.md` (CRLF; diff `proto/F2F3-README.diff`:
stem 09 row, KEEP clock + HUD style refresh paragraphs after the blink paragraph, two check names).

Proof (`<R>/ad-store/proto/set5/`, F2 + F3, 23:08:53-23:12:12): exit 0, `fail []`, `errors []`, 137 / 137 (115 + 2 `09_keep_window`
14.8 / 15.6 s + 20 `hud_values_visible`, hidden 0), 28 + 8 true, missing []. 09 clean / hud: dog asleep by the lantern at both
sizes; 02 hud 2160: `ME 1.23M`; 03 / 04 / 06 / 07 cast and the 03 toast as `store-final2` (`r2/set5/board-02-09-03.png`,
`r2/set5/board-cast-{2160-x1,1080-x3}.png`); other frames animation-only diffs.

Re-check after F2 + F3 (Director / EM, no AD round if all hold): fresh preview, re-run into `<R>/store-final3`: fail [], errors [],
137 checks, 28 + 8 true, missing []; 09 clean 2160 + 1080: the dog asleep at the left wing; 02 hud 2160: ME number shown; 03 / 04 /
06 / 07 as this round. Upload the 2160 store + alt files of that run. Any miss: back to the AD.

**Row 11 release art sign-off (v0.10.0):** in-game PASS (unchanged). Store set: not final. F1 PASS; PENDING F2 + F3; PASS when the
`store-final3` run meets the re-check above (as in `proto/set5/`).

### §R re-check 2026-10-27

Art Director, v0.10.0 store set after WP24 (living world v2) + WP25 (passive-first HUD), STEAM_RELEASE §15 rows 11 + 14. Verdict:
**FIXES REQUIRED** (F4, one data number + its test literal, then a store-shots re-run; no asset, script or game-logic change). The
round-1 F1 (cast on stale spots) holds. The WP24 world and the WP25 HUD read clean in every store and alt frame. New find: the rank 4
frame (05, TECH INDEX tab III) shows a false dependency.

Set under audit: `<R2>/store-final/`, `<R2>` =
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/R2/`
(code d0625bf, `SIZES=1080,2160`). `<R2>/store-final.json`: exit 0, `fail []`, `errors []`, 175 / 175 checks ok; 38 PNGs; 28
`*_no_spoiler` true (frame <= 2, plaque `RES?OR?` 03-07 / 09, `UNKNOWN` / `R?S????` 01 / 02, hits []), 8 `*_plate_cap` true, 38
`*_no_output_tick` true (visible 0, shown = base), 20 `*_hud_values_visible` (hidden 0), `09_keep_window` 14.5 / 15.4 s,
`store_top5_complete` true, missing []. Stills only: no preview, no browser (Director perf / soak runs). AD evidence
`<R2>/ad-recheck/` (`crops/`, `mock/`, `tools/`). Old / new boards use the R round 2 proof `<R>/ad-store/proto/set5/` (pre-WP24 /
WP25): set5 top, store-final bottom.

| rank | frame | 2160 + 1080 | result |
|---|---|---|---|
| 1 | `07-era5-ruined-clean` | Girl front row, violet rim. Inspector and dog now face the camera (era V stare = WP24 settle rest frame): more uncanny than set5. Crow flares its wings on the dead lamp (hover cell, violet rim, feet on the finial): reads as a flare, not a glitch. Black puddle + sprout, plate `RES?OR?`, no text | PASS |
| 2 | `06-era4-spire-hud` | Girl on the ground left of the boiler; Inspector, Sensor 7, dog, crow on the lit lamp. Warmer sky (WP24 day tint). HUD `CLICK +218 RS · 0.2S` / `+11 ME` / `AUTO-CRANK 3/S · +655 RS/S`, one line each, inside the panel. 3-click gain block legible right of the spire at both sizes | PASS |
| 3 | `03-era2-generator-hud` | Clock, booth + hanging receiver, lit lamp + glow + moths, crow hovering (era II canon, as set5), dog. Ruin windows lit, the girl's window dimmed (WP24 canon). MILESTONE toast opaque at both sizes. HUD `CLICK +78 EE · 0.25S` / `+5.6 ME` (no servo in the S9 list, so no AUTO-CRANK row) | PASS |
| 4 | `05-tree-era3-hud` | `boiler->bellowsDrive` dives behind Induction Heater: it enters the top border and leaves as a stub at the right into Bellows Drive. Reads Boiler -> Induction Heater -> Bellows Drive; Bellows Drive needs Boiler only. Same in set5: pre-existing since WP17 put Bellows Drive at (2,2). Missed by WP16b-3, R and R2; WP25 F2 covers same-row edges only | **FAIL (F4)** |
| 5 | `09-postgame-portrait-clean` | Cast as set5 (held loop, D17): dog asleep by the lantern, Inspector, Sensor 7, crow + moths on the warm lamp | PASS |
| alt | `04-era3-boiler-hud` | Cast on its spots: Sensor 7 + Inspector left, sprout, lamp, booth, crow, dog right. The Inspector holds the umbrella folded (settle rest frame), so the "umbrella under the dry virga" beat is gone (N1). HUD `CLICK +90 PR · 0.25S` / `+5.6 ME` | PASS (N1) |

- WP24 in stills: no half-faded or mid-transition denizen in any store or alt frame at either size. `worldSettle(true)` parks every
  runner on its rest frame at its home spot and snaps targets on the TECH INDEX blink. Cast alpha is full; no runner walks or is cut by
  a frame edge (outermost: Sensor 7 at x ≈ 50, dog / booth / lamp inside x 1920 - 70). 1080 cast = 2160 cast
  (`crops/board-cast-1080-x2.png`).
- WP25: HUD lines read cleanly at 1:1 2160 (`crops/hud-panels-03-04-06-07-2160.png`). No output popup in any frame. The floating
  numbers in the hud frames are the 3-click gain block (values = 3 x CLICK).
- Spoilers: name plates `RES?OR?` in 03, 04, 06, 07, 09 (`crops/plates-2160-x3.png`); HUD plaque `RES?OR?`; era V HUD `NEXT: PRIMARY
  FUNCTION`; no RESTORE / RESTORATION text in a store or alt frame.

**Round-1 F1 (cast on stale spots): FIXED, holds.** 03: right-wing cast at the lit lamp. 04: Sensor 7 + Inspector left; lamp, booth,
crow and dog right. 06: girl on the ground. 07: girl front row. Evidence: `crops/{03,04,06,07,09}-wing{L,R}-old-new-2160.png`,
`crops/*-wings-1080-x2.png`.

F4 (S2, store-facing, rank 4): tab III edge `boiler->bellowsDrive` passes through Induction Heater.
- Geometry (`TECH_TREE_LAYOUT` px): `edgePath` = `M 162 148 C 248 148, 248 244, 334 244` goes 25.5 px deep into Induction Heater
  (176-320 x 210-278).
- Fix (data, owner: worker via EM): `src/data/technologies.ts` `bellowsDrive.tree` `{ col: 2, row: 2 }` -> `{ col: 3, row: 2 }`; the same
  literal in the expected era III def in `src/data/technologies.test.ts` (line 445). (3,2) is Grid Exciter's slot in tab IV, so the edge
  takes the shape of the accepted `resonatorSpire->gridExciter`.
- New path `M 162 148 C 327 148, 327 244, 492 244` clears Induction Heater and Superheater by 11.5 each (34 px at 2160) and crosses no
  edge. No edge enters (3,2). No other edge in eras I-V changes (`tools/edges.py`, `tools/depth.py`). Tab width (max col 6), the
  per-era unique-slot test and keyboard order (list order) are unchanged.
- Proof (MOCK painted on the 2160 frame, not a capture): `crops/F4-tree3-shipped-vs-mock-2160.png`,
  `mock/05-tree-era3-hud-MOCK-bellows32-2160.png`. One curve runs Boiler -> Bellows Drive under Superheater and over Induction
  Heater; Bellows Drive sits under Condenser. The 1 px nub on Induction Heater's right border and the faint box around the moved node
  are mock seams.

Re-check after F4 (Director / EM; no AD round if all of it holds):
- Fresh `vite preview` of the rebuilt `dist`, then `store-shots.mjs` `SIZES=1080,2160` into `<R2>/store-final2`.
- Run: fail [], errors [], 175 checks; 28 / 8 / 38 true; missing [].
- 05 at both sizes: Bellows Drive under Condenser; one curve from Boiler that passes under Superheater and over Induction Heater; no
  stub between Induction Heater and the empty (2,2).
- Every other frame: animation-phase diffs only.
- Upload the 2160 store + alt files of that run. Any miss: back to the AD.

Notes (no block):
- N1: 04 alt loses the open umbrella (settle rest frame). Accept: it is the alt only and still reads as era III (virga, steam, cast).
- N2 (in game, not in the store set; S3 follow-up for the Director): 7 more edges pass through a third node.
  - Tab I `wornMotor->flywheel`, through the Reinforced Crank and Motor Tuning corners, 21 px deep. Demo-visible:
    `<R2>/resolutions/res-1920x1080-100-tree.png`, `crops/tree-e1-wornMotor-flywheel-1080x2.png`.
  - Tab IV `echoCrank->harmonicConvergence`, through Crystal Lattice.
  - Tab V `nullChamber->graviticAnchor`, `nullChamber->mainsBackfeed`, `nullChamber->steamLance`, `graviticAnchor->skyAperture`,
    `inversionCrank->finalAlignment`.
  - A cross-row detour in `edgePathAround` (route through the gap next to the target row) clears all 7 (`tools/edges.py`). In tab V,
    though, 4 detours would share the row 1-2 gap and merge into an ambiguous bus. Tab V needs its own layout pass.
- N3: The hud frames show click gains, not the machine popups (off by design for the set). The passive pitch is carried by the HUD
  (`AUTO-CRANK`, the `/S` rates, the worth in seconds). Accept.
- N4: In 06 hud the `+33 ME` gain line sits on a lit ruin window plate (orange on orange). The ink stroke keeps it legible at both
  sizes. Accept.

Store order: **keep** (1 `07-era5-ruined-clean`, 2 `06-era4-spire-hud`, 3 `03-era2-generator-hud`, 4 `05-tree-era3-hud`, 5
`09-postgame-portrait-clean`; alt `04-era3-boiler-hud`). The era V stare makes rank 1 stronger. 06 now carries the passive message in
the HUD (AUTO-CRANK + four `/S` rates). After F4, 05 shows a clean dependency tree.

**Row 11 release art sign-off (v0.10.0):** in game PASS (WP22 R5, WP23a AD2f, WP23b AD4r5, WP24 AD2 round 2, WP25 AD1 round 2).
Store set: round-1 F1 PASS, R2 F2 / F3 PASS (09 dog asleep, 02 ME number shown); PENDING F4. **Row 14 (store screenshots):** PENDING
F4. Both rows PASS when the `store-final2` run meets the re-check above.

**Director F4 re-check (2026-10-27): HOLDS.** `bellowsDrive.tree` (2,2) -> (3,2) applied to `src/data/technologies.ts` and the test literal. Rebuilt dist, fresh preview, `store-shots.mjs` `SIZES=1080,2160` into `<R2>/store-final2`: exit 0, 175/175 checks, `fail []`, `errors []`; 28 / 8 / 38 true; missing []. 05 (1080 and 2160): Bellows Drive under Condenser, one curve from Boiler under Superheater and over Induction Heater, (2,2) empty, no stub. Other frames vs `store-final`: animation phase only (gears, wheels, smoke, core swirl, gain floats; 0.1-2.9 % of pixels, cast unchanged; `<R2>/f4-diff-07-era5-ruined-clean.png`, `<R2>/f4-diff-03-era2-generator-hud.png`). **Row 11 and row 14: PASS.** N2 goes to WP26 (docs/plan/WP26.md T9).

## WP25 — passive-first audit

Art Director AD1, round 1, 2026-10-26. Verdict: **FIXES REQUIRED** (1 S1, 1 S2, 3 notes; both fixes are code, owner worker via EM;
no asset, balance or simulation change). The economy is right: in a real-time 10 min era II run at 0.5 clicks/s the machine makes
91 % of the EE and 98.5 % of the ME. The HUD says it (CLICK worth in seconds, AUTO-CRANK output). The machine output popups, the one
on-screen sign of the machine's output, do not: they start dim, fade from the first frame, are drawn small, and sit on the part
bodies. The click's gain block reads stronger than the machine's 5x larger number, and from era III on the popups are illegible.
Both fixes are prototyped on the live build and checked in new screenshots (`proto1/`, `proto3/`, `proto*u150/`, `tree/`).

Build under audit: `dist` 04:47 (`index-E1NyXld9.js`, `index-cyaZ_Ykl.css`), `dist-demo` 04:47; `find src public -newer
dist/index.html` prints nothing. :4175 = the package's `vite preview` of `dist`. :4176 was started for the demo teaser check only and
killed after it (netstat empty). One Playwright browser at a time. Evidence root `<A>` =
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP25/ad1/`:
`run10/` (10 min era II run, frame + numbers every minute, `run10.json`), `stills/` (shipped build: eras I-V, servo MK I-III,
HUD per resolution and UI scale, reduced motion, bubble + gain block, photo, zoom 0.5, showcase, finale, postgame), `demo/` (demo
teaser, card, KEEP TINKERING), `proto1/`, `proto3/`, `proto1u150/`, `proto3u150/` (F1 prototype: the `OUTPUT_TICK` numbers and the
two code lines patched into the served bundle in flight with a Playwright route; repo untouched), `tree/` (F2 prototype: the detour
path written into the one SVG edge), `crops/` (1:1 to 6x nearest crops and boards), `tools/` (`run10.mjs`, `stills.mjs`,
`stills-proto.mjs`, `teaser.mjs`, `tree.mjs`, `tree3.mjs`, `crop.py`, `board.py`).

### 10 min era II run at 0.5 clicks/s (the R1 check)
Phase 0 (synthetic clock): fresh game, 4 clicks/s, the `runGreedy` buy rule (cheapest available per resource, every 1 s) until the
Generator: owned at 1556 s = T1's 25:56, so the in-page player is profile P1 at the era II entry. Phase 1 (real time, 1280x720,
UI 100): real mouse clicks on the crank every 2 s, the same buy rule every 1 s, 10 min.

| min | ME/s | EE/s | HUD CLICK | HUD AUTO-CRANK | EE from clicks (cum.) | popup |
|---|---|---|---|---|---|---|
| 0 | 261 | 6.1 | `+12 ME · 0.05s` | — | — | — |
| 2 | 346 | 31.8 | `+7.9 EE · 0.25s` (Dynamo Crank at 1:13) | — | 6.0 % | `+95 EE` |
| 5 | 455 | 130 | `+25 EE · 0.2s` | `1/s · +25 EE/s` (Crank Servo at 4:38) | 9.6 % | `+389 EE` |
| 10 | 595 | 265 | `+52 EE · 0.2s` | `1/s · +52 EE/s` | 9.2 % | `+793 EE` |

Totals: EE +77.8K (clicks 7.1K = 9.2 %), ME +270K (clicks 4.2K = 1.5 %); 300 clicks, 28 buys (one per 21 s), 200 popups (exactly
one per 3 s, never two on screen), `meanMs` <= 0.0073 (limit 0.05). A 4-click/s player would add about 8 x 7.1K = 57K EE here
(early era II, servo level 1, is the click-heaviest stretch; the plan's integrated era II share for A is 31 %). Progress comes from
the machine: PASS on the numbers and the HUD. On screen the popups fail it (F1): `run10/run10-m02.png`, `run10-m10.png`,
`crops/run10-m02-gen-x3.png`, `crops/run10-m10-gen-x3.png` (a faint number on the generator yoke, through the crow).
Board: `crops/run10-hud-m00-m05-m10.png`.

### Checks
| item | result | evidence (`<A>`) |
|---|---|---|
| HUD CLICK / AUTO-CRANK at 1280x720 UI 100 / 125 / 150, 1920x1080 UI 100 / 125 / 150, Deck 1280x800 UI 150 | PASS. One line each, inside the panel at every size (`CLICK +78 EE · 0.09S`, `+5.6 ME`, `AUTO-CRANK 7/S · +551 EE/S`; panel right edge 437 at 720p UI 150). The worth reads as seconds next to the `/S` rates; the row title explains it. Strings exact (C4) | `stills/hud-*.png`, `crops/hud-board-720.png`, `crops/hud-board-1080.png` |
| Crank Servo in era II, MK I / II / III (levels 1 / 4 / 7), framings s8 (generator entry) and s9 | PASS (art note N1). Under the crank inside the frame, iron + copper like the generator's windings, so it reads as era II kit; MK II lamp, MK III copper coil block read as steps. Mechanics right: a parallel crank (rod R1 from the servo arm pin to the crank pin, both throws 19 art px, same phase, both `driven` ratio -1.75), so the rod stays vertical at 32 art px | `stills/s8-servo{1,4,7}.png`, `stills/s9-servo7.png`, `crops/servo-mk-board-x4.png`, `crops/run10-m05-servo-x4.png` |
| Output popups, era I (Worn Motor) | readable at birth, gone after about 0.7 s (alpha 0.7, linear fade from frame 0) | `crops/e1-burst-board-x3.png` |
| Output popups, eras II-V | **FAIL (F1)**: on the generator yoke and the perched crow (II), inside the boiler barrel (III), on the spire lattice (IV), inside the null chamber cage (V); 10-13 px at the era III-V default zoom 0.5 | `crops/s9-burst-board-x3.png`, `crops/e3-boiler-x4.png`, `crops/e4-spire-x4.png`, `stills/e5-popup.png`, `crops/s9-zoom05-gen-x4.png` |
| Hierarchy vs the crank gain block | **FAIL (F1)**: 6 clicks `+472 EE / +33 ME` bright and bold above the frame, the machine's `+2.59K EE` a ghost on the generator | `stills/s9-bubble-click-popup.png`, `stills/e1-c-click-popup.png` |
| Placement vs gain block, denizen bubbles, HUD | PASS: no overlap with the gain block (crank +116 / -128) or the bubbles (INS-01 at the left wing, dog line at the ground) | `stills/s9-bubble-click-popup.png`, `proto1/s8-servo7.png` |
| Palette | PASS: crank gain colours (`#ffd27a`, cyanLight, steam, verdigrisLight, violetPale) + ink stroke; era V reads `???` before the reveal | `stills/e5-popup.png` |
| Not spammy | PASS: one line per 3 s, never two on screen (run10 200 / 200) | `run10/run10.json` |
| Gates: before the first click, photo, finale, postgame | PASS: shown 0 before the click; photo shown 23 -> 23, visible 0; finale shown 9 frozen, visible 0 for 6 s; postgame (KEEP, 6 crank clicks) shown 9 frozen, visible 0 | `stills/stills.json`, `stills/s9-photo.png`, `stills/e5-finale.png`, `stills/e5-postgame.png` |
| Gates: demo teaser, card, KEEP TINKERING | PASS: teaser 10 samples visible 0, shown 3 frozen; card visible 0; popups resume after KEEP | `demo/teaser.json`, `demo/demo-teaser-{2,6}.png`, `demo/demo-card.png`, `demo/demo-afterkeep.png` |
| Full-build showcase (`showcasePlay`) | PASS on screen (World asleep, not drawn). `outputStats()` keeps reporting `visible: 1` for the popup frozen when the World slept (N3) | `stills/s9-showcase.png` |
| Reduced motion | PASS on the rule (`rising` false, y 1572 constant, fade only); the static number sits on the generator yoke (F1) | `crops/rm-burst-board-x3.png` |
| Tab II tree, Crank Servo at (2,2) | **FAIL (F2)**: the Motor Retrofit -> Power Lines edge runs behind the Crank Servo node, so it reads Motor Retrofit -> Crank Servo -> Power Lines (Power Lines needs Motor Retrofit 5 + Transformer 3, not the servo). Same defect, older, in tab III: Condenser -> Vessel Blueprint behind Turbine | `crops/tree-tab2-edge-x2.png`, `crops/F2-tree-before-after-100.png`, `crops/F2-tree3-before-after-100.png` |

### F1 (S1, the WP25 message): machine output popups illegible and placed on the parts
Cause: `OUTPUT_TICK` alpha 0.7 with a linear fade from frame 0 (readable about 0.6 s of 3 s), `fontScale` 0.8 (10-13 px at zoom 0.5,
the default from late era II on), and one shared `offset` from anchors with different origins: wornMotor / generator resolve to
their centre, boiler / spireTower / nullChamber to their base, so a single y cannot clear every part. Data alone cannot fix the
placement; it needs a per-era offset (code) plus a short hold before the fade (code).

Fix (owner: worker via EM; files `src/data/ux.ts`, `src/data/ux.test.ts`, `src/game/math/outputTick.ts`,
`src/game/math/outputTick.test.ts`, `src/game/rendering/OutputTicker.ts`):
- `OUTPUT_TICK`: `fadeMs` 1800 -> 2400; new `holdMs: 1000`; `alpha` 0.7 -> 0.9; `fontScale` 0.8 -> 1; `offset` `{ x: 0, y: -24 }`
  -> per era `{ 1: { x: 0, y: -32 }, 2: { x: 0, y: -90 }, 3: { x: 30, y: -200 }, 4: { x: 190, y: -160 }, 5: { x: 240, y: -116 } }`
  (world px from the anchor's resolved position; `satisfies Record<EraNumber, { x: number; y: number }>`). `periodMs` 3000,
  `riseWorldPx` 36, `poolSize` 3 and `anchor` unchanged. Comment "one dim line" -> "one line".
- `outputTick.ts`: `outputTickAlpha(ageMs, holdMs, fadeMs): number` = 1 while `ageMs <= holdMs`, then linear to 0 at `fadeMs`
  (`min(1, max(0, (fadeMs - ageMs) / (fadeMs - holdMs)))`; non-finite or `fadeMs <= holdMs` -> 0 past `holdMs`).
- `OutputTicker.step`: alpha = `OUTPUT_TICK.alpha * outputTickAlpha(slot.ageMs, OUTPUT_TICK.holdMs, OUTPUT_TICK.fadeMs)` (the rise
  keeps its ease-out over `fadeMs`). `startPopup`: `const off = OUTPUT_TICK.offset[era]`, start = anchor + `off` (the crank
  fallback during an anchor fly-in uses the same offset; transient).
- Tests: every era 1-5 has a finite offset with `y <= 0`; `0 <= holdMs < fadeMs <= periodMs`; `outputTickAlpha` at 0, holdMs, the
  midpoint of the fade, fadeMs, NaN.
Where it lands (prototype): era I above the motor; era II above the generator yoke and the crow; era III above the steam manifold,
between the chimney and the frame, and below the HUD panel at 720p / 800p UI 150 (servo owned, the tall panel); era IV right of
the spire between coil rings 1 and 2, on the sky; era V right of the null chamber cage on the violet sky. Same size as the click's
gain block, slightly dimmer (0.9 vs 1), readable (alpha >= 0.45) for about 1.7 s of every 3 s, still one at a time.
Proof: `crops/F1-before-after-eras-x2.png` (eras I-V, shipped left / fix right), `crops/F1-before-after-rm-zoom-x2.png` (reduced
motion at 1.2 s, zoom 0.5), `proto1/s9-bubble-click-popup.png` (machine `+2.59K EE` now level with the click's `+472 EE`),
`proto1/s8-servo7.png`, `crops/proto1-e1-burst-x3.png`, `crops/F1-e3-proto3-board.png` (era III y -200 at UI 100 and 150; y -240
and -220 rejected: hidden under the 720p UI 150 panel, `crops/F1-e3-proto2-board.png`), `proto1u150/e{4,5}-u150-*.png`.

### F2 (S2, demo-visible): tree edges run behind a node on their row
Fix (owner: worker via EM; files `src/ui/techTreeView.ts`, `src/ui/techTreeView.test.ts`): export
`edgePathAround(from, to, nodes, layout = TECH_TREE_LAYOUT)`. It returns `edgePath(from, to)` unless `from.y === to.y` and another
node on that row lies strictly between them (`n.y === from.y`, `from.x < n.x < to.x`). Then it routes through the row gap:
`g = layout.colGap / 2`, `yc = from.y - layout.rowGap / 2` (top row: `from.y + from.height + layout.rowGap / 2`),
`M x1 y1 C x1+g y1, x1+g yc, x1+2g yc L x2-2g yc C x2-g yc, x2-g y2, x2 y2` (x1 / y1 = from right-middle, x2 / y2 = to
left-middle). `buildTechTreeView` uses it for every edge. Data: exactly two edges change. Tab II `motorRetrofit->powerLines` =
`M 320 244 C 327 244, 327 196, 334 196 L 636 196 C 643 196, 643 244, 650 244`; tab III `condenser->pressureVesselBlueprint` =
`M 636 148 C 643 148, 643 100, 650 100 L 952 100 C 959 100, 959 148, 966 148`. Every other edge of eras I-V equals `edgePath`.
No data change: every 3-row slot for Crank Servo in tab II sits on an edge or makes a backward edge, so (2,2) stays.
Proof (DOM prototype, those exact strings): `crops/F2-tree-before-after-100.png`, `crops/F2-tree-150-after.png`,
`crops/F2-tree3-before-after-100.png`. The line now arcs over Crank Servo and Turbine into Power Lines and the Vessel Blueprint.

### Notes (no block)
- N1 (D16 follow-up, art): the servo arm (dark iron) is lost against the frame's X-brace behind it at 1:1 in era II (it was in era IV
  too); only the base, lamp and rod read. Follow-up for the servo-tier repaint after WP24: a lighter rim on the arm's lit side
  (`#7d8286`) or a dark backing plate behind the hub. Recorded per D16; not a WP25 fix.
- N2: the CLICK worth (`0.09S`) is honest and fits. Under R1 it is meant to be small; it reads well next to the `/S` rates.
- N3: `outputStats()` keeps the sleeping World's popup counted as visible during `showcasePlay`; nothing shows on screen. Smokes
  that assert `visible: 0` during the showcase would need `setOutputTicks(false)` first. No fix needed.

### Re-check for round 2 (after F1 + F2, EM rebuild)
`economy.mjs` full + demo fail [] errors [] (`D_reduced`, `G_output_cost` included); `tools/stills.mjs` cases e1, e2, e3, e4, e5
on the rebuilt `dist` = the `proto*` frames (era III with the servo owned at 1280x720 / 1280x800 UI 150 below the panel); tab II and
tab III edges as `tree/*-after.png`; `store-shots` `_no_output_tick` unchanged. RELEASE-READY when those hold.

## WP25 — passive-first audit, round 2

Art Director AD1, round 2, 2026-10-26. Verdict: **RELEASE-READY**. F1 and F2 hold on the rebuilt build. Round 2 found one new
S2 (F3: at UI 150 the era III popup rose under the HUD panel). The Art Director fixed it in `OUTPUT_TICK` data (plan C5: "the AD
tunes the numbers") and checked it on a rebuilt `dist` / `dist-demo`. Open: no fix. N1 stays the D16 follow-up.

R1 check (task): in a real-time 10 min era II run at 0.5 clicks/s the machine makes 90.8 % of the EE and 98.5 % of the ME. On
screen, a bright `+95 EE` → `+793 EE` rises above the generator every 3 s, next to a HUD CLICK worth of `+7.9 EE · 0.25S` →
`+52 EE · 0.2S`. A player can see that the machine carries progression and that clicking is a bonus.

Build under audit:
- Rounds 1 → 2: `dist` 06:11 (`index-D1RA_kKX.js`); `find src public -newer dist/index.html` printed nothing.
- After F3: `dist` `index-SR9b44Ys.js` (488.98 KB) and `dist-demo` `index-CeG4X6aB.js` (489.58 KB), both built 07:27 local.
  bundle-budget PASS on both: CSS 41.0 / 43.8 KB, unchanged; lazy world 116.6 KB.
- The served bundle carries `3:{x:190,y:-216}`.
- `src/data/ux.test.ts` + `src/game/math/outputTick.test.ts`: 35 / 35 pass (`--maxWorkers=1`); `tsc --noEmit` runs inside the build.
- Ports: :4175 = the package preview of `dist`. :4176 was started for the demo pass only, killed after it (netstat empty).
- Load: one Playwright browser at a time. The build waited until WP24's `perf.mjs` / `world.mjs` had ended.

Evidence root `<A2>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP25/ad2/`.
| folder | contents |
|---|---|
| `economy/`, `economy-demo/`, `rebuilt/economy/` | economy.mjs full, demo, full after F3 |
| `stills/` | round-1 `stills.mjs`: eras I-V, servo MK I-III, HUD per size, reduced motion, gates |
| `stills2/` | eras III-V at 720p / 800p / 1080p and UI 100 / 150; era II hierarchy |
| `run10/` | the 10 min era II run |
| `e3time*/`, `rebuilt/e3-s10/`, `rebuilt/e3-s11/` | era III popup over its whole life against the panel; `ship` vs route-patched variants |
| `tree/` | tab II / III on the build |
| `demo/` | teaser, card, KEEP |
| `crops/` | boards at 1:1 to 4x nearest |
| `tools/` | `stills.mjs`, `stills2.mjs`, `run10.mjs`, `sum10.cjs`, `e3time.mjs`, `tree2.mjs`, `teaser.mjs`, `crop.py`, `board.py` |

### 10 min era II run at 0.5 clicks/s (round 2, same protocol as round 1)
| min | ME/s | EE/s | HUD CLICK | HUD AUTO-CRANK | EE from clicks (cum.) | popup |
|---|---|---|---|---|---|---|
| 0 | 261 | 6.1 | `+12 ME · 0.05s` | — | — | — |
| 2 | 346 | 31.8 | `+7.9 EE · 0.25s` | — | 6.0 % | `+95 EE` |
| 5 | 455 | 130 | `+25 EE · 0.2s` | `1/s · +25 EE/s` (servo at 4:38) | 9.6 % | `+389 EE` |
| 10 | 595 | 265 | `+52 EE · 0.2s` | `1/s · +52 EE/s` | 9.2 % | `+793 EE` |

Totals: EE +78.1K (clicks 7.1K = 9.2 %), ME +271K (clicks 4.2K = 1.5 %); 300 clicks, 28 buys (the same list as round 1), 199
popups (one per 3 s, never two on screen), `meanMs` 0.009. The economy is equal to round 1 to rounding: F1 / F2 / F3 change no
balance.
Evidence:
- `run10/run10-m02.png`, `run10-m05.png`, `run10-m10.png`;
- `crops/run10-popups-m02-m10-x3.png`;
- `crops/run10-hud-popup-m00-m10-x2.png`;
- before / after (round 1 ghost on the yoke behind the crow → round 2 crisp on open sky): `crops/run10-m02-before-after-x3.png`.

### Round-1 items re-checked
| item | result | evidence (`<A2>`) |
|---|---|---|
| F1 output popups, eras I-V (offset per era, hold 1 s, alpha 0.9, fontScale 1) | PASS. Era I `+51 ME` above the motor. Era II above the generator, crow clear. Era III above the steam manifold. Era IV right of the spire. Era V right of the null chamber cage on the violet sky. Each popup draws at the click gain block's size, fully readable for its 1 s hold, gone by 2.4 s, at most one on screen | `stills/e1-b-popup.png`, `stills/s8-servo1.png`, `stills/s9-servo7.png`, `stills/e3-popup.png`, `stills/e4-popup.png`, `stills/e5-popup.png`, `crops/e2-popup-board-x3.png`, `crops/e345-popup-board-x4.png`, `crops/s9-burst-board-x3.png` |
| Hierarchy vs the click gain block | PASS. Era I: `+51 ME` (machine) next to `+5` / `+1` (clicks), same size | `stills/e1-c-click-popup.png`, `stills2/h2-720-100.png` |
| F2 tree edges | PASS. Tab II `motorRetrofit->powerLines` and tab III `condenser->pressureVesselBlueprint` equal the spec strings in the DOM (`tree2.json` `ok: true` at UI 100 / 150). On screen the lines arc over Crank Servo / Turbine | `tree/tree-tab2-100.png`, `tree/tree-tab2-150.png`, `tree/tree-tab3-100.png` |
| HUD CLICK / AUTO-CRANK, 720p UI 100 / 125 / 150, 1080p UI 100 / 125 / 150, 800p UI 150, eras II-V | PASS. One line each, inside the panel (`F_hud_fit` full + demo; `stills2.json` panel boxes). Strings exact: `+90 PR · 0.14s`, `AUTO-CRANK 3/s · +655 RS/s`, `+17.1K ??? · 0.23s` | `crops/hud-board-720.png`, `stills/hud-*.png`, `stills2/e*-*.png` |
| Crank Servo in era II, MK I / II / III | PASS as art, N1 open (D16 follow-up). Unchanged from round 1 | `crops/servo-mk-board-x4.png`, `stills/s8-servo{1,4,7}.png` |
| Reduced motion | PASS. `rising` false, y 1506 constant across 9 frames, fade only. The number now sits on the sky, not on the yoke | `crops/rm-burst-board-x3.png` |
| Gates | PASS on screen and in stats. Photo: shown 27 frozen, visible 0. Finale: 12 samples 9/0. Postgame (6 clicks): 12 samples 9/0. Full showcase: nothing drawn (N3) | `crops/gates-board.png`, `stills/stills.json` |
| Demo (`dist-demo`) | economy.mjs fail [] errors [] (`G_output_cost` 0.011). Teaser and card: shown 3 frozen, nothing drawn. KEEP TINKERING: popups resume (`+1.78K EE` above the generator) | `economy-demo.json`, `demo/demo-teaser-2.png`, `demo/demo-card.png`, `demo/demo-afterkeep.png` |
| Palette | PASS. Crank gain colours + ink stroke; era V `???` | `crops/e345-popup-board-x4.png` |

### F3 (S2, fixed in data by the AD): era III popup rose under the HUD panel at UI 150
Defect: with the servo owned (the tall era III panel) at 1280x720, 1280x800 and 1920x1080 UI 150, the era III popup was born 3 px
below the panel's bottom edge (panel bottom 430, popup top ≈ 433 at 720p). It rises 18 screen px, and the DOM panel covers the
canvas. Result: readable at 0.8 s, half hidden at 1.5 s, gone under the panel at 2.3 s; about 1 s of its 2.4 s life.
Round 1 sampled only 300-400 ms ages and missed it. UI 100 / 125 and the era III entry framing (zoom 0.75) were fine.
Fix (applied, `src/data/ux.ts`): `OUTPUT_TICK.offset[3]` `{ x: 30, y: -200 }` → `{ x: 190, y: -216 }`, plus the comment line.
- The popup now spawns right of the boiler, over the manifold run, between the HUD panel and the piston rack. Gaps at UI 150:
  720p ≈ 11 px to the panel / 6 px to the rack; 800p ≈ 11 / 8; 1080p ≈ 11 / 8 (9-char worst case `+1.89K PR`).
- y −216 also lifts it 8 px off the manifold pipe it was born on (round-1 placement).
- The era III entry framing (boiler only, zoom 0.75) puts it over the boiler's outlet pipe, left of the piston rack, below the panel.
- Other eras, `periodMs`, the hold / fade, the font and the pool are unchanged. The demo never reaches era III, so it only gains
  the literal.
Tuning: route-patched trials (repo untouched): x 180 / y −216 left about 4 px to the panel at 720p, so x 190 was chosen.
Proof:
- before / after at 720p UI 150 over the popup's life: `crops/F3-e3-ui150-before-after-x2.png` (ship 0.8 / 1.5 / 2.3 s vs x 190 at
  0.9 / 1.5 / 2.2 s; also 800p / 1080p);
- rebuilt build, every size: `crops/F3-rebuilt-e3-allsizes-x2.png`; full frame `rebuilt/e3-s11/ship-1280x720-100-a100.png`;
- entry framing: `e3time-s10/x190y-216-1280x720-150-a500.png`;
- numbers: `rebuilt/e3-s11/e3time.json` (visible 1 at 0.7 / 1.7 s at every size).
Owner note: `src/data/ux.ts` is a WP25 file (T8 / T11, data). The diff is one number pair + one comment. No EM rebuild is needed:
`dist` / `dist-demo` are already rebuilt. economy.mjs full on the rebuilt `dist`: fail [] errors [] (`G_output_cost` 0.017).
store-shots turn popups off, so their `_no_output_tick` checks are unaffected.

### Notes (no block)
- N1 (unchanged, D16 follow-up): the servo arm (dark iron) is lost against the frame's X-brace in era II. Needs a lighter lit-side
  rim (`#7d8286`) or a dark backing plate behind the hub in the servo-tier repaint after WP24.
- N3 (extended): `outputStats().visible` keeps one frozen popup counted while the World sleeps. Seen in the full showcase and now
  also in the demo teaser and on the END OF DEMO card (round 1 read 0 there; the 1 s hold makes a popup more likely to be on screen
  when the World falls asleep). Nothing is drawn, `shown` stays frozen, and the slot finishes its fade after KEEP. A smoke that
  asserts `visible: 0` during the teaser or card must call `setOutputTicks(false)` first, or read `shown`. No fix needed.
- N4: the HUD worth suffix renders upper-case (`0.14S`) like every HUD unit (`/S`). It stays honest under R1 (0.09-0.25 s). Its
  row title reads "One turn of the crank = 0.14 s of machine output".
- N5 (smoke artifact, not a defect): the synthetic-clock buy lists trigger the offline-return lines (DOG-07 "He waited the whole
  time. Good boy.", the WELCOME BACK toast) in the era framings.

### Reference rules used (web, floating-number readability)
Sources: bugnet.io "how to fix floating damage numbers overlapping into an unreadable blob" and "how to build a damage number
system"; the Factorio DamageIndicator mod changelog; a Last Epoch forum thread on floating combat text.
| rule | how WP25 meets it |
|---|---|
| Aggregate a continuous source into one number per window (no per-tick spam) | `periodMs` 3000 |
| Cap what is visible | pool 3; never two on screen in 200 popups |
| Pool the labels | created once |
| A fixed spawn spot per source | per-era offset |
| Do not let a steady small number sink under bigger, more frequent ones | the machine popup is drawn at the gain block's size, and its number is 5-15x the click's |

## WP24 — living world v2 audit

Art Director AD2, plan gate A12. Round 1 (2026-10-26, build 616b9c3): **FIXES REQUIRED** (1 high, 2 medium, 6 notes). Round 2
(2026-10-27, build 9b7f3f1, Revision 6): **RELEASE-READY**. The scene reads as a living place moving through a recorded Tuesday: every
denizen keeps doing different, canon-true things on its own clock (no repeat, no lockstep, no teleport), purchases and eras arrive over
seconds (crossfades, staggers, buzz-ons), the far ruins drift from a grey morning to an amber 16:41, and eras IV and V read uncanny but
alive (unison choreography, the stare, moonwalks, the breathing dust and Chladni lines), never static and never looping. No art changed
in AD2; the three fixes were data and renderer code (EM / workers).

Method: Playwright at 1920x1080 (and 1280x720 UI 150), one browser at a time, `?debug=1`. Long watches use `worldAdvance` (2 s steps
of world time, a probe of the cast, props, behaviour and day per step, a PNG per step, the behaviour log at the end); real-time strips
use a CDP screencast (9-16 fps) plus an in-page rAF sampler of `livingWorld()`, `worldProps()` and `worldTransitions()`; forced states
use `worldBehaviourNext` and `worldDayHold`. Round 1 served `dist` on :4175 and `dist-demo` on :4176; round 2 used the EM's :4174
(left running) and `dist-demo` on :4176 (stopped after). Evidence root `<A>` =
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP24/ad2/`:
`run/{full,demo,reduced,ui150,post,day}/` (round 1 long watches and strips), `motion/full/` (round 1 screencasts + rAF),
`r2/{full,reduced,demo}/` (round 2), `shots/` (boards and crops), `user/` (three images for the user, `captions.txt`), `work/`
(`lib.mjs`, `audit.mjs`, `motion.mjs`, `r2.mjs`, `analyze.py`, `group.py`, `timeline.py`, `mot.py`, `halo.py`, `halo2.py`,
`rise.py`).

### Round 1: variety per state (1920x1080, quiet, world time)
| state (watch) | Inspector | dog | crow | girl | evidence |
|---|---|---|---|---|---|
| S7 era I (5 min) | 7 activities / 7 looks | 6 / 6 | frozen <-> tipTry (canon era I) | window (flicker, dims) | `run/full/s7-long/`, `run/full/sheet-s7-long-*.png`, `run/full/poses-s7-*.png` |
| S9 era II (5 min) | 7 / 8 | 7 / 8 (dig bouts, sleep, scratch) | 4 / 3 (stutter, skip, freeze, tipTry) | mini flicker / dim | `run/full/s9-long/`, `run/full/sheet-s9-long-dog.png` |
| S11 era III vents (5 min) | 8 / 9 (umbrella on vent puffs) | 7 / 7 (shake on puffs) | 4 / 4 (perch, ruffle, peck, shift) | mini 3 (palm) | `run/full/s11-long/`, `run/full/poses-s11-*.png` |
| S13 before ONE OBSERVER (5 min) | unison 6 actions, 6 looks | 6 | 6 | 6 (lanternUp, tilt) | `run/full/s13b-long/`, `run/full/poses-s13b-girl.png` |
| S13 after ONE OBSERVER (10 min) | unison 5 actions, 4 looks, 18 beat walks | 4 | 4 | 5 (the hum) | `run/full/s13a-long/`, `run/full/group-s13a-rt.png` |
| S15 era V (10 min) | 4 / 4 (reversed backsteps, sensor walks, mouthing) | 4 / 4 | 3 / 3 | 4 / 4 | `run/full/s15-long/`, `run/full/group-s15-long.png` |

Every state: 0 A->A, top exact 4-run <= 2 per window. Real-time rAF steps: walks 8 world px per drawn frame, the crow stutter 4,
0 at rest: no teleport in any stage (`motion/full/*/motion.json`, `work/mot.py`). Demo (`run/demo/`): S7 and post-cap S9 keep the same
variety after KEEP TINKERING, day held at 13:00 (`shots/demo-card-and-postcap.png`). Reduced motion (`run/reduced/`): activities still
vary (umbrella, shake), receiver `hang`, micro flags off, motes static, walks rare (D15). 1280x720 UI 150: the cast stays readable
under the HUD in eras II-V (`shots/ui150-1280x720-grid.png`).

### Round 1: transitions and time
| item | result | evidence |
|---|---|---|
| generator (S7 -> S8) | era row 0 -> 1 over 8.5 s, cast alpha and shadow 4 s, LED 3 s, girl window out 4 s, motes one at a time, windows staggered about 5 s apart; **halo plates popped all at once (F1)** | `run/full/tr-s8-generator/`, `shots/F1-halo-pop.png` |
| powerLines | lamp buzz-on about 1.25 Hz for 3 s (limit 3 Hz), glow 0 -> .4, booth hood stutter-on after the lamp, pylon cables, windows dim -> lit one by one | `run/full/tr-s9-powerlines/`, `work/tr-powerlines-sheet.png`, `motion/full/tr-s9-powerlines/` |
| era III / IV entries | era row crossfade 8.6 s / 8 s; scrap burn, puddle 45 s, sprout 40 s, virga 20 s, fog 30 s; era IV fog clears, virga freezes, Chladni rings arrive | `run/full/tr-s10-era3/`, `run/full/tr-s11-pressure/`, `run/full/tr-s13-era4/`, `shots/era4-crossfade-strip.png` |
| era V entry | lamp flickers out about 2 s, windows dark one by one over 12 s, shadows 10 s | `run/full/tr-s15-era5/` |
| day tint | 09:00 `0xe6e1d8`, 13:00 white, 16:41 `0xdcc3a6` on the ruin layers only (ground, machine, cast untouched); subtle, R >= G >= B; drifts with progress inside each band | `run/day/`, `work/day-s9-sheet.png`, `user/02-day-clock-0900-1300-1641.png` |
| postgame / finale | postgame holds 16:41, wind 0, the restored twins untinted; finale k12 against the §R set (`<S>/R/finale`) differs only by the warm key on the ruins before the wave, k40 and postgame match | `run/post/`, `shots/postgame-grid.png`, `shots/finale-R-vs-wp24.png` |
| new cells | palette and alpha 0/255 PASS (`worldSheets.test.ts`, painters 38/38); lookUp, crouch, umbrellaHalf, scratch, dog lookUp, frozenTip, ruffle, lanternUp, tilt and the mini palm read at in-game size; lanternUp holds the lantern at the chest, never the raised shield | `run/full/poses-s7-inspector.png`, `run/full/poses-s11-*.png`, `run/full/poses-s13b-girl.png` |

### Round 1 findings
- **F1 (high, an instant change).** At the generator buy all six window halo plates appeared together at about t 9.3 s while the window
  sprites rose one by one; plates stood empty up to about 10 s and read as flat orange boxes (the era V lights-out had the mirror case).
  Cause: `WorldProps.drawHalo(count)` drew the committed `windowsLit` count with one alpha (the brightest window). Fix (Revision 6):
  `WorldProps.paintHalo` fills each window's halo at that window's own presented level and redraws only while a level moves by 1/255.
  Evidence `shots/F1-halo-pop.png`, `shots/gen-windows-strip.png`.
- **F2 (medium, eras IV-V read flatter than measured).** `WORLD_ERA_ENV.riseWorldPx` 1 = half an art px (`PIXEL_SCALE` 2); at zoom 0.5
  with `roundPixels` it rounded away: stare -> rise changed crow 0 px, girl 3, dog 15 (the leash line only), so after ONE OBSERVER the dog
  and crow showed only head <-> talk. Fix: `riseWorldPx` 2 (one art px; the bible's "rises 1 px"). Evidence `shots/F2-rise-subpixel.png`.
- **F3 (medium, AD1b-3 H1).** Crouch at the `scrap` spot looked at bare ground (e1/s9 x 1496 facing left, the 1530 scrap behind his
  heel; s11 x 808, the 830 / 960 scraps already burned). Moving spots or scraps fails (any target 28 px ahead of the spot lies under
  `mid`; the cycle 3+ girl stands at 1538). Fix: crouch travels to `sensor` (e1/s9 1448 with the 1420 scrap 28 px ahead; s11 760 at
  Sensor 7's foot; s8 none). Evidence `shots/h1-crouch-live-vs-mock.png`, `shots/h1-s11-live-vs-mock.png`.

### Round 2 (build 9b7f3f1)
| check | result | evidence |
|---|---|---|
| F1 generator, 1080p, screencast 16 fps, 250 ms grid over 44 s | PASS. Halo + window pixels switch in six clusters at 9.9 / 15.9 / 19.4 / 23.5 / 28.9 / 33.2 s = the six window onsets (alpha > 0.05); no plate lights before its window. Earlier small clusters are the girl's window going out (8.9 s, canon 4 s) and machine-assembly noise | `r2/full/gen/`, `shots/F1-r2-halo-fixed.png`, `shots/r2-gen-right-tower-x5.png`, `work/halo2.py` |
| F1 era V lights-out | PASS. Each plate flickers and fades with its own window (w3 4.3 s, w2 5.3 s, w1 8.5 s, w0 flickers 11.2 / 11.5 s then fades to 13.2 s); the 1.1 s cluster is the horizon-glow sky stage | `r2/full/vout/`, `shots/F1-r2-era5-lightsout.png` |
| F1 demo generator (:4176) | PASS. Same six clusters at 10.0 / 15.9 / 19.2 / 23.6 / 28.8 / 33.2 s | `r2/demo/gen/` |
| F2 S13 after ONE OBSERVER, conductor pinned stare -> rise x3 | PASS. Same frames, y -2 world: changed px dog 350, crow 322-365, girl 176, Inspector 468-484 (round 1: 15 / 0 / 3); the lift shows a 1 px gap over the shadow ("things fall up") | `shots/F2-r2-rise.png`, `r2/full/s13a-*.png` |
| F2 reduced motion | PASS. Rise 0 px on all four bodies, y unchanged | `shots/F2-r2-rise-reduced.png`, `r2/reduced/` |
| F3 crouch e1 / s9 / s11 | PASS. e1 and s9 kneel at 1448 over the 1420 scrap just past the boot; s11 kneels at 760 at Sensor 7's foot, inspecting the instrument | `shots/F3-r2-crouch.png`, `r2/full/crouch-*.png` |
| variety after the fixes (S11, 5 min) | unchanged: Inspector 8 / 9, dog 7, crow 4, girl 3, 0 A->A | `r2/full/s11-long/` |
| finale / postgame frames | PASS. `val6` (9b7f3f1) against `val5` (pre-fix): same composition; differences are animation phase (dust, steam, parts, crow), about 1 % of pixels outside the timing-sensitive wave frames k41.5 and world-k38 | `shots/finale-r2-prefix-vs-fix.png` |

User images refreshed from 9b7f3f1 (01 shows the new crouch at Sensor 7; 03 the era IV crossfade); 02 (day holds on a fully lit S9
scene) is unaffected by the halo fix.

### Notes (accepted, no fix)
- N1 The mains flicker is one 1.7 s sine on every lit light (`WorldProps.mainsOf`), canon "slow mains flicker"; it moves the glow area
  about +-1 % in luminance, not perceptible as a loop. Its comment says era II only; the code runs from era II on.
- N2 From era III the Sensor 7 LED blinks every 2.4 s: the WP22 MK V heartbeat (`heartbeatLow`), a deliberate machine sync. The D10
  "reading" dims (8-20 s) and the era I irregular blink (2.2-5.7 s) work.
- N3 The crow's `head` / `talk` cells are the hover body with the head to the camera (WP23 art), so an era III glance flares the perched
  crow for about 1 s; glances are out of WP24 scope and it reads as a startle.
- N4 The cycle 3+ ground girl at 1538 stands on the 1530 scrap (pre-existing, WP23b data).
- N5 `src/assets/painters/world.test.ts` hit the 5 s default timeout once under CPU load (passes alone; 8.1 s file).
- N6 Cycle 2 crow `crowHigh` held through eras I-II: canon uncanny stillness (Revision 5 (b)); not re-captured.

### Verdict
**RELEASE-READY** (round 2, 9b7f3f1). F1-F3 fixed and verified in new captures; no new defect found.
