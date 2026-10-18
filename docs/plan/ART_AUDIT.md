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
