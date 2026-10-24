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
