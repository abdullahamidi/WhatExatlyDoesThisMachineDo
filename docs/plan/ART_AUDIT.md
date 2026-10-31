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

## WP26 — v0.10.1 follow-ups audit

### AD1a — girl x and tree slots (2026-10-27)

Art Director, data picks only (no code, no asset edits). Evidence `<O>` =
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP26/ad1a/`
(`out/` numbers, `mock/` mocks, `shots/` captures from :4174 at e860578, `tools/` scripts). Verdict: **tree slots PICKED** (7 slots, 2
detours, every tab clear). **Girl x: NEEDS-DIRECTOR** (no x in 1556..1570 stays on stage).

**Girl x (Q4): NEEDS-DIRECTOR at the pick; ruled GIRL_X 1552 (Q4a, see the hand-off block).**
- GIRL_HALF = 14 world px. `world.girl` stand0 has an opaque box at art x 1..12 of 16 (origin 8): 7 art px left, 5 right, in every
  era row. The girl never flips (`restFlip`). The 7 px left part is the lantern, 10-32 px above the feet; the boots reach 4 art px
  (8 world px) left.
- Rule (3) caps her. `usableX` keeps a left-wing x only up to machine left 1576 − `wingClearPx` 24 = **1552**. That holds in 16/18 e1,
  29/29 s8 and 7/7 s9 states (`placeCast` at cycle 3, every S9 prefix plus S9 + crank servo; `out/probe-girl.txt`,
  `out/probe-girl-edges.txt`). Every x from 1554 to 1570 returns `girl: null` in those states.
- Rule (1) needs x ≥ 1538 + 8 + 14 = 1560. Rules (1) and (3) cannot both hold. Left of the scrap fails too: the s8 window is
  1496..1552 and rule (2) needs x ≥ 1544.
- AD proposal: **GIRL_X 1552** at e1, s8 and s9 ground (cycles 1-2 unchanged). It is on stage in all 54 probed states. Boots at 1544:
  6 px clear of the scrap. The lantern ends at x 1538 (0 px gap in x) but sits 4 px above the 8 px scrap, so no pixel overlaps. 56 px
  from the Inspector spot 1496; 14 px short of the machine edge. Other ways to keep a full 8 px: a girl-only wing clearance of 16 or
  less (code in `worldPlacement.ts`, outside T7) gives 1560; or row `front` at 1538 (she stands in front of the scrap).
- HUD: measured `#hud-panel` bottom in game px (UI 100 / 150): e1 196 / 298, s8 221 / 335, s9 with the AUTO-CRANK row 261 / 394, the
  same at 720p and 1080p. Her head at 1552: e1 y 464, s8 592, s9 578. She clears the panel by at least 166 game px
  (`shots/hud-*-150-*.png`, `out/probe-hud.json`).
- Evidence: `mock/AD1a-girl-s8-before-after-MOCK-x4.png` (stand0 pasted on the s8 capture at 1538 and 1552),
  `mock/girl-scrap-mock-1x.png`, `mock/girl-scrap-mock-x4.png` (1538, 1552, 1560 against the wing limit).

**Tree slots (Q6): PICKED.**
- Baseline: `edges.py` confirms the 7 N2 edges (`out/edges-baseline.txt`). The real-code probe (`buildTechTreeView`, 64 samples per
  segment, under 4 px from a third node box, the T9 guard) finds 11 hits on exactly those 7 edges (`out/probe-tree-base.txt`).
- Tab I: wornMotor (1,2) → (1,1), flywheel (3,0) → (3,1). Every tab I column is fixed by the requires chain (5 deep in 5 columns).
  The edge clears only when both ends share a row and col 2 of that row is empty. This is the only 2-move layout among the 8 valid ones
  (`out/search3-era1.txt`). wornMotor->flywheel becomes a straight run through the empty (2,1). Min col 0 and max col 4 stay (demo
  centring).
- Tab IV: echoCrank (2,0) → (4,0). harmonicCoil->echoCrank runs straight along row 0, and echoCrank->harmonicConvergence is an adjacent
  S. The other 1-move fix (harmonicConvergence to (5,0)) would take the keystone off row 1 (`out/search3-era4.txt`).
- Tab V: no layout without a detour exists. The search finds 0 layouts, even at 0 px clearance (`out/search-era5-thr.txt`).
  nullChamber has 5 in-tab children, and a col-0 root in 3 rows reaches only 4 slots with a default curve. The 36 one-detour
  layouts scramble the spine and add 5-6 crossings and 1-2 port ambiguities (`out/search3b-era5-det1-free.txt`). Row-gap detours
  (the N2 route) always cross a diagonal edge inside a 14 px column gap, which reads as a junction (`mock/cand-c1-*`, `cand-c2-*`,
  `cand-c4-*`). Pick: graviticAnchor (2,2) → (3,2), inversionCrank (2,0) → (4,0), mainsBackfeed (3,2) → (6,0), steamLance
  (4,2) → (6,2). The row 1 spine, containmentRing and resonantSiphon stay.
- DETOUR nullChamber->mainsBackfeed and nullChamber->steamLance use a new **outer-channel** path, not the N2 row-gap path. T9 adds it
  in `edgePathAround` (`src/ui/techTreeView.ts`) for the DETOUR edges only. Let g = colGap / 2. yc = min node y − padding / 2 when the
  target row is above the source; otherwise yc = max node bottom + padding / 2. d1 = sign(yc − y1), d2 = sign(yc − y2):
  `M x1 y1 C x1+g y1, x1+g y1, x1+g y1+d1·g L x1+g yc−d1·g C x1+g yc, x1+g yc, x1+2g yc L x2−2g yc C x2−g yc, x2−g yc, x2−g yc−d2·g L x2−g y2+d2·g C x2−g y2, x2−g y2, x2 y2`.
  Literals: nullChamber->mainsBackfeed =
  `M 162 148 C 169 148, 169 148, 169 141 L 169 16 C 169 9, 169 9, 176 9 L 952 9 C 959 9, 959 9, 959 16 L 959 45 C 959 52, 959 52, 966 52`;
  nullChamber->steamLance =
  `M 162 148 C 169 148, 169 148, 169 155 L 169 280 C 169 287, 169 287, 176 287 L 952 287 C 959 287, 959 287, 959 280 L 959 251 C 959 244, 959 244, 966 244`.
  The channels run in the outer padding, 9 px from the row boxes and from the canvas edge, where no other edge passes. Result: 0
  crossings, 0 port ambiguity. The two vertical legs at x 169 share the nullChamber port with nullChamber->containmentRing and
  ->resonantSiphon (one source), so they read as a bracket. Tab size is unchanged (1128 x 296).
- Proof on the scratch copy `technologies.picked.ts` (`edges.py`, `depth.py`, `tools/report.py`) and the real-code probe with the
  channel paths: every edge in tabs I-V clears every third node. Min L-inf per tab: I 7.5, II 4.6, III 4.6 (the two accepted same-row
  detours, unchanged), IV 7.5, V 6.8 (channel legs beside containmentRing and resonantSiphon). 0 samples are within 4 px
  (`out/probe-tree-picked.txt`). Of 54 edges, 38 are unchanged, 9 are better, and 7 are lower but still ≥ 7.5: handCrank->gearRatio
  62 → 7.5, the others 158 → 62 (`out/edge-diff.txt`). Crossings 0 and port ambiguity 0 in every tab (`out/report-picked.txt`).
- Constraints hold. Slots are unique per era. Max col and row per tab are unchanged: widths 812 / 970 / 1128 / 970 / 1128, height 296.
  The requires graph and the list order are unchanged. Tab I min / max col stay 0 / 4. Tabs II and III are untouched, so store
  shot 05 is unchanged.
- T9 notes:
  - `src/data/technologies.test.ts` has expected-def literals for the 7 moved techs.
  - `DETOURED` in `src/ui/techTreeView.test.ts` gains the two channel edges. The injected era-II test sets its own tree slots, so the
    pick does not affect it.
  - Keep the guard at 4 px: the accepted same-row detours measure 4.6-4.7.
- Evidence:
  - `mock/AD1a-tab1-before-after.png`, `mock/AD1a-tab5-before-after.png`, `mock/AD1a-tab4-before-after.png`. Top: capture at
    1920x1080 UI 100 (`shots/tree-tab*-1920x1080-100.png`). Middle: mock of today. Bottom: mock after. Red marks a point within 6 px
    of a third node.
  - Search logs `out/search*.txt`; tools `tools/treegeo.py`, `search3.py`, `report.py`, `treemock.py`, `apply.py`.

```
WP26-HANDOFF-BEGIN
GIRL_X = 1552
GIRL_HALF = 14
SLOT flywheel 3 1
SLOT wornMotor 1 1
SLOT echoCrank 4 0
SLOT graviticAnchor 3 2
SLOT inversionCrank 4 0
SLOT mainsBackfeed 6 0
SLOT steamLance 6 2
DETOUR nullChamber->mainsBackfeed
DETOUR nullChamber->steamLance
WP26-HANDOFF-END
```
GIRL_X = 1552: Director ruling Q4a (2026-10-27, recorded by the EM at the WP26 round 1 gate), the AD proposal above. Boots 6 px clear of the 1530 scrap, wing rule kept, cycles 1-2 unchanged. The AD2 audit checks it in the game; the plan's aim of 8 px clear is waived.

### AD1b — servo arm N1 (2026-10-27)

Art Director, recolour only (Director Q5). Evidence `<O>` =
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP26/ad1b/`
(`before/` and `after/` shot bursts with `shots.json`, `crops/` boards, `mock/` rule tries, `out/` gate report and contrast table,
`orig/` the six PNGs as shipped at e860578, `tools/`). Verdict: **N1 FIXED** with the lit rim. No backing plate, no NEEDS-DIRECTOR.

- Method: new `scripts/art/tiers/servo_rim.py` (idempotent, no arguments, writes in place).
  - The rule runs per 48x48 frame: the static PNG, and each of the 80 frames of the rot sheet.
  - An edge pixel (opaque, with a transparent 4-neighbour) whose outward normal faces the upper-left light (ART_BRIEF) becomes
    iron lit `#7d8286`. Width: 1 art px. The shadow-side ink stays (selective outline).
  - The normal is a Gaussian-weighted sum of the transparent offsets around the pixel (radius 3, sigma 1.25), so a RotSprite
    staircase gets one normal per side. Try 1 used a per-step 4-neighbour test, and try 2 added a tie rule. Both gave a dotted,
    zigzag rim on steep diagonals (`mock/try1-mk1-a.png`, `mock/try2-detail-x8.png`, frame 35). Try 3, the smoothed normal, ships
    (`mock/try3-detail.png`, `mock/try3-sheet-a.png`, `-b.png`).
  - In the terminator band (|cos| <= 0.2: the arm lies along the light, frames near 30 and 70) the up-facing side keeps the rim.
  - The hub disc keeps a fixed upper-left highlight arc while it turns (the PART_TIERS rotating-part rule).
- Files: MK I `era4/servo-arm.png` + `era4/rot/servo-arm-rot.png`; MK II `tiers/servo-arm-t2.png` + `tiers/rot/servo-arm-t2-rot.png`;
  MK III `tiers/servo-arm-t3.png` + `tiers/rot/servo-arm-t3-rot.png`.
  - 32 px change per static PNG and 2411 per rot sheet (27-32 in every one of the 80 frames), all to `#7d8286`. They were ink, or
    `#5a5f63` where RotSprite had left a gap in the outline.
  - Alpha is identical to e860578 in all six files. Canvas (48x48, 432x432) and the 80 frames are unchanged. Nothing was re-rotated.
- Marks stay distinct. The rim mask depends on alpha only, and DERUST-FULL / POLISH map neither `#7d8286` nor ink. So MK II / MK III
  are `palette_tiers.py` of the rimmed MK I: the script asserts it, and a rerun of `palette_tiers.py` into a scratch dir gives the
  shipped t2 / t3 pixel for pixel. A second run of `servo_rim.py` changes 0 px and writes byte-identical files.
- Gates:
  - `python -I scripts/art/tiers/check_gates.py`: exit 0, 91 files, 0 failures (`out/gates.md`). servo-arm t2 changes 4 px vs MK I
    (rot 212), t3 16 (rot 1424). Rust drop 100 %, rust kept 0.
  - Palette: Rust Wasteland only (MK I 5 colours, MK II 4, MK III 3).
  - `npx vitest run src/assets --maxWorkers=1`: 10 files, 210 tests pass.
  - Decoded PNG total 54.46 MiB (sizes unchanged).
  - PNG bytes: rot sheets 9671 / 4584 / 4373 → 4905 / 4896 / 4692 B; statics 304 / 273 / 259 → 331 / 319 / 290 B.
- In-game proof, no build:
  - The six PNGs were copied over the same-named files in `dist/assets/machine/` (no new file) and served by :4174.
  - Fresh Playwright context, `?debug=1`, world quiet, output popups off, day held at 720.
  - Framings s8 (generator entry), s9 and s13, at crankServo level 1 (s13: 3, still MK I), 4 and 7, at 1920x1080 and 1280x720.
    Screen px per art px: s8 3 / 2, s9 2.25 / 1.5, s13 1.5 / 1.
  - A 32-shot burst per state. Each shot is matched to its arm frame on screen: the alignment comes from the static servo base, then
    the best of the 80 frames. 571 / 576 shots matched before, 575 / 576 after (score >= 0.6).
- Contrast: WCAG relative-luminance contrast ratio, measured on screen at the arm silhouette. An arm edge pixel is compared with the
  visible X-brace pixel just outside it (brace = the `support-frame.png` pixel at that spot, with the same colour on screen). Over all
  matched frames; ranges are over the 18 states (`out/contrast-table.txt`, `out-measure-before.json`, `out-measure-after.json`).

| pair | before | after |
|---|---|---|
| lit-side edge vs brace, median | 1.86 (ink vs `#3e4246`) | 2.61 (`#7d8286` vs `#3e4246`) |
| lit-side edge vs brace, mean | 1.73-1.95 | 3.07-3.32 |
| lit-side edge pairs >= 2:1 | 8-15 % | 85-90 % |
| lit-side edge pairs <= 1.2:1 (merged) | 36-45 % | 10-15 % |
| whole silhouette vs brace, pairs >= 2:1 | 9-16 % | 40-47 % |
| whole silhouette vs brace, pairs <= 1.2:1 | 32-42 % | 20-28 % |
| arm body vs brace, median | 1.57-1.66 | 1.57-1.66 (recolour only: the body is unchanged) |

- Palette pairs:
  - `#7d8286` vs brace body `#3e4246` 2.61, vs brace ink 4.84, vs the brace's own lit edge `#7d8286` 1.00 (the remaining merged
    pairs).
  - Before: ink vs `#3e4246` 1.86, ink vs ink 1.00. Body `#5a5f63` vs `#3e4246` 1.57.
- Trade-off (accepted): where the lit side meets the bright bay (sand and sky seen through the frame), the edge goes from ink (about
  6:1) to `#7d8286` (1.2-1.6:1). The body (2.0-2.7:1) and the shadow-side ink still carry that silhouette
  (`crops/AD1b-up-frames-board.png`).
- Read at 1:1: the arm now reads as a light-edged bar with a dark lower edge in every era, mark and size, including s13 at 720p
  (1 screen px per art px). Before, only the base, lamp and rod read.
- Evidence:
  - Before / after with matched arm frames (same frame or ±1). Rows MK I / II / III; columns 1080 before, 1080 after, 720 before,
    720 after. 1:1: `crops/AD1b-s8-1x.png`, `crops/AD1b-s9-1x.png`, `crops/AD1b-s13-1x.png`. Zoomed (nearest, tiles about 312 px):
    `crops/AD1b-s8-zoom.png`, `crops/AD1b-s9-zoom.png`, `crops/AD1b-s13-zoom.png`. Picks: `crops/picks.json`.
  - Arm up and sideways: `crops/AD1b-up-frames-board.png`. Full frames: `before/<state>-full.png`, `after/<state>-full.png`.
  - Sprite level: `crops/AD1b-sprite-mk1-x7.png`, `-mk2-x7.png`, `-mk3-x7.png` (frames 0 / 20 / 30 / 50 / 60 / 70 on brace
    `#3e4246`); `crops/AD1b-rot-mk1-after-sheet-a.png`, `-b.png` (all 80 MK I frames).
- dist: `dist/assets/machine/` holds the rimmed PNGs until the EM gate rebuild, which makes dist authoritative. Nothing else in dist
  was touched. AD2 re-checks the servo in eras II and IV on the rebuilt dist.

### AD2 — WP26 audit, round 2 (2026-10-27)

Art Director, in-game checks on the rebuilt build. Verdict: **RELEASE-READY**. All six AD2 checks pass. No fix, no asset change, no tuning
(`ERA5_SKY_FADE_IN_MS` stays 24000). Four notes, none blocking.

Build under audit: `dist` and `dist-demo` 08:56 (`index-CL98UPgq.js`, `index-26bM_dqJ.js`). Scratch rebuilds of the current tree give
the same hashes, so dist is current. The six servo arm PNGs in `dist` and `dist-demo` are byte-equal to `public/`.
- Previews: :4174 is the EM's `dist` preview, left running. :4177 served `dist-demo` for the demo checks only; it was started for them and
  killed after (netstat empty).
- One Playwright browser at a time. The sky screencast ran with `GPU_ARGS` (ANGLE D3D11, RTX 3060 Ti). rAF p50 16.7 ms, p95 <= 18.1 ms, so
  the fades ran in real time with no headless clamp.

Evidence root `<A>` =
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP26/ad2/`.
Contents:
- `servo/`: 18 states, a 32-shot burst each.
- `girl/`: cycle 3 framings, `girl.json`.
- `sky/`: screencast clips with `clip.json`, `skycurves3.json`.
- `finale/`, `showcase/`, `demo/`: fresh smoke runs.
- `tree/`, `tree-demo/`: tab PNGs plus the DOM probe `tree-*.json`.
- `store/`: `SIZES=1080,2160`.
- `crops/`: boards.
- `tools/`: `shots.mjs`, `measure.py`, `board2.py` (AD1b tools), `girl.mjs`, `girlcrop.py`, `sky.mjs`, `skycurve3.py`, `tree.mjs`,
  `cmpdir.py`.

| # | check | result | evidence |
|---|---|---|---|
| 1 | Servo arm vs X-brace: eras II (s8 / s9) and IV (s13), 1080p and 720p, MK I / II / III | **PASS**. 575 / 576 burst shots matched to their arm frame. Lit-side edge vs brace: median 2.61:1 in all 18 states (v0.10.0: 1.86); mean 3.06-3.33 (1.73-1.95); pairs >= 2:1 83-94 % (8-15 %); merged pairs <= 1.2:1 6-17 % (36-45 %). Whole silhouette >= 2:1: 40-48 % (9-16 %). The arm body is unchanged (median 1.57-1.66). At 1:1 the arm reads as a light-edged bar with a dark lower edge in every state, including s13 at 720p (1 screen px per art px). Same result as AD1b on the dist copy | `crops/AD2-servo-s8-1x.png`, `-s9-1x.png`, `-s13-1x.png`, `crops/AD2-servo-s8-1x-view2.png`, `crops/AD2-servo-s{8,9,13}-zoom.png` (columns: 1080 v0.10.0, 1080 rebuilt, 720 v0.10.0, 720 rebuilt; matched frames), `out-measure-ad2.json`, `crops/servo-picks.json` |
| 2 | No figure on a scrap, cycle 3, e1 / s8 / s9 | **PASS**. Real cycle 3 run: S16, skip, BEGIN A NEW CYCLE x2, then S7 / S8 / S9 bought through the TECH INDEX. Girl at x 1552 (`ground`, `back`) in all three framings. Scraps: e1 1329 / 1421 / 1530, s8 1529, s9 1420 / 1529. Over 120 s of live world time per framing (1 s steps, settle off), no cast member came within 14 world px of a visible scrap: 0 / 360 samples. Ranges: Inspector 1448-1496, girl 1552 (stand0 / stand1 / lanternUp / tilt), Sensor 7 1384, dog and crow on the right wing. The boots clear the scrap by 6-7 world px (9-10 screen px at 1080p). The lantern hangs above the scrap end with no overlap. Settled frames at 1080p and 720p, UI 100 and 150: the girl is whole and clear of the HUD | `crops/AD2-girl-c3-before-after.png` (e1 v0.10.0 cycle 3 from WP23b AD4r5 vs WP26, same camera; s8 / s9 WP26), `crops/AD2-girl-cycle3-e1-s8-s9.png`, `girl/*-c3-*.png`, `girl/girl.json` |
| 3 | Era V sky on a real-time screencast: no snap, no violet left in a new cycle | **PASS**. 60 fps CDP screencast; p = projection of the region colour on its own stage change (table below). Every rising stage ramps linearly over the designed time and never snaps: the largest single-frame step after a 5-frame median is 0.08-0.15 of the stage, which is 2-3 RGB levels (8-bit and JPEG quantisation). A snap would be >= 0.25. Glow stage 3 was bought inside the TECH INDEX, as in play: the tree covers the first 1.4 s, then the glow keeps rising from p 0.19 to 0.97 by 5.0 s, with no jump at the close. New cycle from the choice (confirm off): the white peaks at 0.80 s and clears by 2.34 s. After that the sky is the era I beige [141,128,111] in every frame to 9 s, and no frame of the white-out shows violet | `crops/AD2-sky-eraV-stages-strip.png`, `crops/AD2-sky-newcycle-strip.png`, `sky/*/clip.json`, `sky/skycurves3.json`, `sky/v4-after.png` |
| 3b | Teaser and ShowcaseScene skies unchanged | **PASS**. `showcase.mjs` (fail [], errors []) vs the v0.10.0 §R run `<R2>/showcase`: 0.4-2.0 % of pixels, sky band <= 0.9 %, except `b_k41_5` (26 %). That frame varies by 28 % between pre-WP26 runs (WP24 val5 vs R2), so it is the survey-timing frame. Teaser frames `e_*` differ by 0.4-0.65 %. `demo.mjs` on :4177 (fail [], errors []) vs `<R2>/f4/demo`: teaser B1 / B2 differ by 15 % / 6.6 %, against 17 % / 12 % between the two v0.10.0 runs. The boards show the same sky | `crops/AD2-teaser-showcase-v0100-vs-wp26.png`, `showcase/`, `demo/` |
| 4 | Finale A7 frames vs val6 (9b7f3f1) | **PASS**. Fresh `finale.mjs` (fail [], errors []): 26 of 29 frames differ by 0.01-2.1 % (animation phase), with the sky band <= 1 %. `k41_5` (23.5 %), `k45_2` (10 %) and `world-k38` (6.8 %) are the camera-survey and flock frames. They move by 12-17 %, 2-10 % and 1-7 % between pre-WP26 runs (val5, val6, R2). Same composition and the same restored sky | `crops/AD2-finale-val6-vs-wp26.png`, `finale/` |
| 5 | TECH INDEX tabs I-V, 1080p; demo tabs I-II | **PASS**. DOM probe on the live tree (S15 save): each shown edge `path` sampled with `getPointAtLength` (>= 64 points per 100 px), L-inf distance to every shown node box except its own two ends. 54 edges, 0 samples under 4 px. Minimum per tab: I 7.6, II 4.6, III 4.6 (the two accepted same-row detours), IV 7.6, V 6.8 (the outer channels beside Containment Ring and Resonant Siphon). Demo build: fresh tab I 7.6, capped tabs I-II 7.6 / 4.6, tab III `FULL GAME` (disabled). Read at 1:1: tab I shows Worn Motor -> Flywheel as one straight run through the empty (2,1). Tab IV shows Harmonic Coil -> Echo Crank straight along row 0 and Echo Crank -> Convergence as a short S. Tab V: the two outer channels leave Null Chamber's port as a bracket with the Containment Ring / Resonant Siphon curves and turn into Mains Backfeed / Steam Lance. No crossing, and no line touches a box (N2) | `tree/full-tab{1..5}-1920x1080-100.png`, `tree/full-tab*-1920x1080-150.png`, `tree/full-tab*-1280x720-150.png`, `crops/AD2-tree-tab5-channels-x2.png`, `tree/tree-full.json`, `tree-demo/demo-fresh-tab1-1920x1080-100.png`, `tree-demo/demo-tab{1,2}-*.png`, `tree-demo/tree-demo.json` |
| 6 | Store shots re-shot, `SIZES=1080,2160` | **PASS, approved**. `store-shots.mjs` into `<A>/store`: exit 0, 175 / 175 checks, fail [], errors [], missing []. Against the approved v0.10.0 set `<R2>/store-final2`, at both sizes: **05** (tab III) 0.00 %, pixel-identical (no tab III slot moved). **03** 1.7-2.2 %, animation only (no servo in the S9 list, cycle 1 cast). **06** 1.4-2.0 % and **07** 1.2-1.4 %: animation plus the servo arm rim. Both 06 and 07 carry the MK I servo (S13 buys crankServo x3), so rank 1 (07) changed too, not only 06. The rimmed arm reads at both sizes and nothing else moved: approved. `<A>/store/2160` is a valid upload set for STEAM_RELEASE §15 row 14 | `crops/AD2-store-06-07-servo-v0100-vs-wp26.png`, `store/1080/`, `store/2160/`, `store/store-shots.json`, `store/store-top5.json` |

Era V sky stages (check 3; V1 = sky region 1920-px x 560-940, y 10-130; G1 = horizon glow at the left frame edge, behind the
semi-transparent mountains):

| stage (buy) | layer, alpha | design (24 s per unit) | t10 / t50 / t90 after the buy | p at 1 / 3 / 5 / 6 s | max step |
|---|---|---|---|---|---|
| nullChamber | violet 0 -> .25 | 6.0 s | 0.58 / 2.85 / 4.92 s | .17 / .47 / .92 / 1.0 | .083 |
| lensArray | violet .25 -> .5 | 6.0 s | 0.05 / 2.87 / 5.60 s | .24 / .55 / .84 / .95 | .079 |
| horizonField 1 | glow 0 -> .35 | 8.4 s | 0.96 / 4.16 / 8.03 s | .12 / .36 / .57 / .67 | .096 |
| horizonField 5 | violet .5 -> .75 | 6.0 s | 0.26 / 2.98 / 5.52 s | .18 / .55 / .88 / 1.0 | .108 |
| horizonField 10 | glow .35 -> .55 | 4.8 s | 0.67 / 2.46 / 4.16 s | .16 / .66 / 1.0 / 1.0 | .154 |
| horizonField 20 (in the TECH INDEX) | glow .55 -> .75 | 4.8 s | tree open to 1.4 s, then .19 / .55 / .73 / .97 at 1.5 / 2.5 / 4.0 / 5.0 s | - | no jump at close |
| skyAperture | violet .75 -> 1 | 6.0 s | 0.58 / 2.85 / 5.38 s | .17 / .50 / .82 / 1.0 | .084 |

Tuning call (Q3): **keep `ERA5_SKY_FADE_IN_MS` 24000.**
- A violet step takes 6 s. In play the buy happens inside the TECH INDEX, so after the player closes it, 3-5 s of the darkening is still
  visible. It reads as the sky turning, not as a UI blink.
- A longer fade (40 s = 10 s a step) would leave the sky at skyAperture well behind the lamp-out and the beam, which are the same
  moment.
- The smallest step (glow 0.2) takes 4.8 s, inside the 4 s floor.

Notes (accepted, no fix):
- **N1 (transient, pre-existing):** the s8 1080p UI 100 still was taken about 4 s after the generator buy while the camera was still
  easing (cx 2199, settles at 2064). The cycle 3 girl at 1552 sat on the left frame edge (screen x -10..4) for that frame. Settled
  frames show her whole at screen x 192 (1080p) and 128 (720p). The Inspector at 1472 shares the same pan. This is the WP23 era II
  camera ease, not WP26.
- **N2 (tab V reading):** the two outer channels run 13 px outside row 0 and row 2. With the shared left leg they frame the graph like a
  border. They stay legible: the leg starts at Null Chamber's port, each end turns into its own node (Mains Backfeed, Steam Lance),
  they cross nothing, and they touch no box. This is the AD1a pick; tab size unchanged.
- **N3 (girl gap):** the Q4a waiver holds in game. 6-7 world px between the boots and the scrap end reads as clear ground at every size.
  Before, the girl's left boot stood on the scrap (`crops/AD2-girl-c3-before-after.png`, top row).
- **N4 (store set scope):** WP26.md AD2 lists 03, 05 and 06. 07 (rank 1) also changed, through the servo rim, and is approved with them.
  The Director's §15 row 14 re-upload should take the whole 2160 store + alt set from one run (`<A>/store/2160`), not 06 alone.

**Verdict: RELEASE-READY (WP26 round 2).** N1 servo rim, the cycle 3 girl stop, the slow era V sky, the tree slots and channels, and the
store set all hold in the rebuilt build. No S1 / S2 open. Unchanged: finale, showcase, teaser, demo tree.

**Director close (2026-10-27): ACCEPTED.** Q4a (girl x 1552, 6 px boots gap) confirmed. N4 done: the whole store set was re-shot on the
v0.10.1 dist as `store-final3` (175/175 ok). Against this AD2 set, 05 is identical and the rest differ by animation phase only
(0.97-2.13 % of pixels), same cast and order. STEAM_RELEASE §15 rows 11 and 14 PASS for v0.10.1. N1 (camera ease, pre-existing) and N2
(tab V border reading) need no action.

## WP27 — crow, Sensor 7 and the fault marker (2026-10-27)

### ADa — crow frames and s8w geometry (wave 1)

`<O>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP27`.
Evidence under `<O>/ada/`. Diagnosis: `<O>/diag/diag.md`. Hand-pixelled in the crow master; PixelLab used for the gates only (no
generations spent). No build, no preview: the in-game check of the new cells is AD2's (wave 9).

**Crow (D5, F5.2).** Defect: in eras I-II the crow is a frozen spread-wing picture, and its bubble frames (`head`, `talk`) carry the
spread-wing body. Fix: three folded-wing columns appended to `world.crow` (old indices keep; 288 x 108 -> 360 x 108, 15 frames x 6
era rows), drawn in the master `scripts/art/world/masters/crow/crow.txt` and baked by `build_sheet.py` / `erarecolor.py`.

| column | frame | drawing | px changed vs perch0 (rows I, II / III, IV / V / whole) | rows 6-17 vs perch0 |
|---|---|---|---|---|
| 12 | `perchTurn` | perch0 with the head turned back over the shoulder: perch0's head outline, perch0's beak mirrored about the head axis (x 14.5) so it points left over the back; eye (13, 3) rows III+; gloss (whole) on the crown (16, 2) (17, 3), clear of the eye | 18 / 21 / 27 / 24 | identical; rows III-V lack perch0's beak drip (21, 6) (it hangs from the side beak) |
| 13 | `perchHead` | perch0 body + the camera-facing head of `head` on perch0's round head outline: iron 2 brows (14, 2) (16, 2), eyes (14, 3) (16, 3) rows III+, a 1 px beak stroke x 15 rows 4-5; rows I-II keep the smudge face (brows bake to #4e2a1a, no eye) | 13 / 15 / 18 / 15 | identical except the same beak drip (III-V) |
| 14 | `perchTalk` | perchHead with the lower mandible 1 px longer (15, 6); rows III+ the open-beak mouth pixel #6e3a22 at (15, 5) (the `talk` convention) | 14 / 16 / 19 / 16 | + the mandible pixel (15, 6) |

Layers follow perch0: eyes III IV V whole; damp III IV V = the tail tip only (a drip under the turned beak at (8, 6) closed a
1 px hole (9, 6) against the back: the first workbench lint found 3 holes, the drip was dropped); gloss whole = crown + perch0's
wing edge. Registered: `sheets.py` `FRAMES.crow` (+3), `WORLD_FRAMES.crow` (+3, indices 12-14), manifest `world.crow` 360 x 108,
count 90, "15 frames per era row", `docs/ASSET_GUIDE.md` block regenerated, DENIZEN_ART §2.3 table and era rows I-II.

| gate | result |
|---|---|
| `build_sheet.py crow` / `check_sheet.py crow` | exit 0 / CLEAN (manifest 360 x 108, 90); the 12 old columns are pixel-identical to the v0.10.1 PNG; the shipped PNG is the master rebuild |
| workbench `score` | sheet 99.9 (was 99.8); columns perchTurn 100.0, perchHead 100.0, perchTalk 100.0 |
| workbench `lint` | sheet 0 / 0, 4 info, 0 holes, 85 components = 90 cells - 5 ruffle crown touches; new columns 0 / 0, 3 info, 0 holes, 18 components |
| decoded PNG total | 276 PNGs, 54.49 MiB (limit 56) |

Read at 1:1 and x3 (`<O>/ada/strip-row-<I|II|III|IV|V|whole>-x3.png`: 1:1 left, x3 right; perch0, perch1, perchTurn, perchHead,
perchTalk, the old head / talk for contrast) and in game size (`<O>/ada/comp-s8w-lamp-row-<I|II|III|whole>-<1x|x3>.png`: lamp at
the s8w x 2720 on the cast-free 1080p s8cap shot, crow feet on the finial at lift 56, row I at alpha .75):
- same bird in every row: the body, wing, tail, legs and toes are perch0's pixels; only the head changes;
- the head turn reads at 1:1: the beak jumps from the right to over the back, the head stays put;
- perchHead reads as a perched crow facing the player (no side beak; eyes from row III); no spread wing in any of the three;
- perchTalk vs perchHead in rows I-II is one ink px on #2e1a12 (the `talk` convention: the beak lengthens, the mouth pixel is a
  row III+ layer); the bubble carries the talk read there. AD2 judges it in motion.

**Sensor 7 geometry (D6, F6.1).** Real code: `<O>/ada/calc/geom.ts` bundles `worldPlacement` (`framingPose`, `framingKeyOfPose`,
`viewRectOf`, `usableX`, `placeCast`, `actorBand`) and `machineBounds` with esbuild and overrides the placements under test at
run time (base = 25b7c8b data; wp27 = the F6.1 bindings + the values below): `base.json`, `wp27.json`. Drawn-pixel clearances:
`overlap.py`, `pairs.py`, `pairs2.py`, `girlscan.py`, `s11.py` (`pairs.txt`, `pairs2.txt`, `girlscan.txt`, `s10s11.txt`):
per pixel row of the shipped sprites, world px, negative = overlap; Inspector flipped (rest flip, left wing), era row II for s8 /
s8w and III / IV for s10 / s11; finale-only frames (pat0, pat1, wave, shield) out; umbrella frames only from era III; the era II mini
frame is `cold` (`palm` is the era III vents reaction). Plan convention alongside: tripod +-16, Inspector body -14..+12, mini cell
+-8 game px.

| pose | key | cx / zoom | view | machine | left wing | right wing | girl mini game x (world-eq) |
|---|---|---|---|---|---|---|---|
| generator (+ retrofit, copper, dynamo) | s8 | 2064 / 1 | 1424-2704 | 1576-2552 | 1448-1552 | 2576-2680 | 84.8 (1508.8) |
| capacitorBank, no transformer | s8w | 2112 / 1 | 1472-2752 | 1576-2648 | 1496-1552 | 2672-2728 | 58.4 (1530.4) |
| sparkGap alone, no transformer | s8w | 2104 / 1 | 1464-2744 | 1576-2632 | 1488-1552 | 2656-2720 | 62.8 (1526.8) |
| transformer, no powerLines / full | s9 | 2176 / 2192, .75 | 1339-3045 (2192) | 1576-2776 / 2808 | 1347-1552 / 1363-1552 | 2800-3005 / 2832-3021 | 170.8 (2192) |
| boiler (era III entry) | s10 | 2055 / .75 | 1202-2908 | 1302-2808 | 1226-1278 | 2832-2884 | - |
| era III-IV full | s11 | 1922 / .5 | 642-3202 | 1036-2808 | 666-1012 | 2832-3178 | - |
| steamHammer / superheater before condenser | s11 | 2006 / .5 | 726-3286 | 1204-2808 | 750-1180 | 2832-3262 | - |

(a) s8w: **Sensor 7 1500, Inspector 1552** (the draft).
- Wing: both x pass both poses. 1552 is the wing's right limit (machine left 1576 - 24); the mini sits at 1519-1539, so nothing
  can stand right of it: the pair keeps the s8 order (tripod left of the mini, Inspector right of it, facing it).
- Mini, plan convention: cx 2112 cell 1522.4-1538.4 vs Inspector body 1538 = **0.4 px overlap**, tripod right 1516 = 6.4 px clear;
  cx 2104 3.2 / 2.8 px clear. Drawn px: cx 2112 mini 1.6 px clear of every era II Inspector frame (crouch included), 10.4 px from
  the tripod; cx 2104 5.2 / 6.8. Pre-agreed fallback (a): overlap 0.4 px (hand-off 1, rounded up), the mini on the far plane.
- Tripod to Inspector 16 px (crouch, worst); scrap 1530 lies between them on the ground.
- Cycle 3+ ground girl: **none** (fallback (b)). Left wing: the best x (1522 with the tripod at 1496) leaves 0 px to both the
  tripod and the Inspector (-2 px with the tripod at 1500); she needs 24 px plus 2 x 2. Right wing (2672-2720 in both poses):
  the booth at 2678 draws 2652-2706; the x that clear it by 2 px (2716-2720) stand 14-18 px into the lamp post at 2720. The
  s8w pose lasts 28-137 s.
- Draft rest, placed at both poses: booth 2678, lamp and crow 2720, dog 2694, stake 2676, hole 2716 (front), scraps keep 1530.
- Mock with these x: `<O>/diag/mock-d6-s8w-left-x2.png`, `-right-x2.png`, `-full.png`.

(b) s8 bindings pass: Sensor 7 1470, Inspector 1536, clock 2680 are placed (clock = the right wing limit). Mini game 84.8: tripod
right game 62, Inspector left game 98, cell 76.8-92.8 inside (14.8 / 5.2 px; drawn 18.8 / 7.2). Tripod to Inspector 30 px.
- Finding, cycle 3+ ground girl at 1508: 12 px from the tripod and 4 px from the Inspector's rest frames, but F6.2 runs the crouch
  in place at the single s8 spot and the crouch boots reach x - 20: her boots overlap his by 2 px. Fix spec (EM call, no key in the
  block): `WORLD_GIRL_PLACEMENTS.s8.ground` x **1504** (tripod 8, Inspector rest 8, crouch 2 px clear; still in the wing).

(c) Eras III-IV (outside the demo).
- s10: **Sensor 7 1234, Inspector 1276 accepted, with one companion change**: `WORLD_SPOTS.s10` = `{ inspector: [{ id: 'sensor',
  dx: 0 }], dog: DOG_SPOTS }` (the s8 / s8w F6.2 form). With `INS_SPOTS` the sensor spot is 1252 (inside the 1226-1278 band) and
  reading / crouch (both travel to the sensor spot) put the Inspector 14 px (write1) / 18 px (crouch) into the tripod. At 1276:
  6 px clear (crouch, worst), tripod 1218-1250 (16 px inside the view). Without that spot change, s10 Sensor 7 must be exempt.
- s11: the plan's Inspector 800 / route [784, 824] is rejected: `INS_SPOTS` put the sensor spot at 776 (10 px into the tripod at
  750) and the route end 784 is 2 px into it (crouch). **ADa: Sensor 7 750, Inspector 816, route 792-840** (= the spots 792 / 816 /
  840): 6 / 30 / 54 px clear of the tripod (rows III and IV, crouch worst); every x passes both s11 poses (666-1012 and
  750-1180); the cycle 3+ ground girl at 880 stays 14 px clear of the 840 spot; the near mini (world-eq about 945 / 971) is far away.

(d) Era I-II audit (`wp27.json` `sweep`, 214 cases: every cumulative prefix of the S15 list, each single era II tech on S8, each
single era III tech on S10; 60 cases in eras I-II). Placed at e1 = Sensor 7, Inspector, dog, booth, lamp, crow, clock, stake, hole,
scraps, the cycle 3+ ground girl.

| pose family | cases (prefixes + singles) | off-stage, 25b7c8b data | off-stage, WP27 values |
|---|---|---|---|
| e1 (s0-s7) | 15 + 0 | none | none |
| s8 cx 2064 (generator, retrofit, copper, dynamo; singles also substationBlueprint, crankServo, dischargeLever) | 27 + 7 | Sensor 7, clock | none |
| s8w cx 2112 (capacitorBank before transformer) | 2 + 1 | Inspector, Sensor 7, dog, booth, lamp, crow, clock, stake, hole | clock (exempt), cycle 3+ girl (exempt, fallback b) |
| s8w cx 2104 (sparkGap alone) | 0 + 1 | Inspector, Sensor 7, dog, booth, clock, stake, hole | clock (exempt), cycle 3+ girl (exempt, fallback b) |
| s9 cx 2176 (transformer before powerLines) | 3 + 1 | none | none |
| s9 cx 2192 (era II full) | 2 + 1 | none | none |

Inspector placed without Sensor 7, all eras: 69 cases in the 25b7c8b data (s8 34, s10 32, s11 variant 3), 0 with the WP27 values.
Exemptions: `s8w clock` (the right wing 2672-2720 holds booth 2678, lamp and crow 2720) and `s8w girl` (no 24 px slot, above).
Info only (era III, not in this audit's scope): s10 still places no crow, lamp, clock, hole, scraps or ground girl (narrow wings).

Hand-off (T5 placements, T8a / T8b crow frames):

```
WP27-HANDOFF-BEGIN
S8W_SENSOR7 = 1500
S8W_INSPECTOR = 1552
S8W_GIRL_GROUND = none
S8W_MINI_OVERLAP_PX = 1
S10_SENSOR7 = 1234   S10_INSPECTOR = 1276
S11_SENSOR7 = 750   S11_INSPECTOR = 816   S11_ROUTE = 792,840
CROW_FRAMES = perchTurn:12 perchHead:13 perchTalk:14
WP27-HANDOFF-END
```

Outside the block (EM): s10 needs the single Inspector spot above; s8 cycle 3+ girl 1504 recommended over the 1508 binding.
`scripts/art/world/README.md` (not ADa's file) still lists crow 288 x 108 / 12 frames in its gate and frame tables.

### ADb — fault sheet and anchors (wave 2)

Evidence under `<O>/adb/` (`<O>` as in ADa). Backdrops: stills of the v0.10.1 `dist/` (preview :4174, killed after use) at
1920x1080 and 1280x720 for e1 (S7), s8, s8w (S8 + capacitorBank: cx 2112; S8 + sparkGap: cx 2104), s9, s10, s11 at cx 2006 (S11
prefix to steamHammer) and cx 1922, s12 (era IV entry), s13, s14 (era V entry) and s15: `<O>/adb/bg/<shot>-<1080|720>.png` +
`meta.json` (camera, HUD rect). Geometry: `<O>/adb/calc/anchors.ts` (real `framingPose` / `viewRectOf` / `componentBounds` /
`OUTPUT_TICK` / `FLOATING_TEXT` via esbuild) over 229 tech-level cases: every cumulative prefix of S15 plus every same-era tech
alone on S8 / S10 / S12 / S14 (prerequisites ignored, so a superset of reachable states). Ranking: `<O>/adb/calc/rank.cjs`.

**Sheet (C12).** `public/assets/fx/fault.png`, 288 x 24, 12 frames of 24 x 24, origin bottom-centre. Hand-pixelled (master
`<O>/adb/art/fault_sheet.py`, ASCII per frame; the PNG in the repo is the shipped source). No PixelLab generation spent.

| frame | content | colours |
|---|---|---|
| 0 tag lit | rounded 16 x 16 plate (ink ring, corner pixels cut), lit from the upper left (#ffd27a top / left edge, #f0a848 face, #d9822b bottom / right edge), four #ad6236 rivet dimples, a bold ink `!` (4 px wide head over 3 rows, 2 px stem, 2 x 2 dot), a 2-row pointer under the plate aiming at the part; pointer tip on row 20, rows 21-23 empty | ink + accent ramp |
| 1 tag dim | frame 0 with every amber one ramp step down (C->B, B->A, A->#ad6236, rivets #8c4a2a); identical alpha and ink | ink + accent + rust |
| 2-3 spark (I-II) | a four-point star and two streaks (bright head, amber tail) thrown off the flanks, 2-3 single glints; the frames swap sides | #ffd27a #f0a848 #d9822b |
| 4-5 steam hiss (III) | 4: jets from under the plate and low flank puffs; 5: the puffs have risen to the upper flanks and top corners | steam-puff ramp #e8e0cc #ddc9a3 #b8a98f |
| 6-7 ring wobble (IV) | dish-wave arcs on both flanks plus a cap arc; 7 one step wider with a dark inner echo | #cfe8d6 #7fae96 #3f5e52 |
| 8-9 null static (V) | interference specks and 2-px torn dashes, pale and dark mixed so they read on sky and on the chamber; the two frames share no pixel | #e0c8ff #9a6ad0 #54367a #24162f |
| 10 clear puff | eight short rays and a ring of dust where the plate was (shown alone, 250 ms) | #ffd27a #f0a848 #ddc9a3 |
| 11 spare | empty (alpha 0 everywhere): never shown | — |

Rules kept: the tag silhouette is one shape in every era (frames 0 / 1 share alpha); FX pixels never touch the tag mask grown by
1 px (checked by the master), so the FX and tag sprites may draw in either order; each era extension colour appears only in its
own era's FX frames (steam III, verdigris IV, violet V; Rust Wasteland elsewhere); colour is never the only signal (plate shape,
glyph, pointer, label).

| gate | result |
|---|---|
| size / mode / alpha | 288 x 24, RGBA 8-bit, alpha {0, 255} |
| palette | 16 colours: 8 Rust Wasteland + steam (frames 4-5) + verdigris x3 (6-7) + violet x4 (8-9), all in `src/data/palette.ts` |
| `python -I scripts/art/tiers/check_gates.py` | exit 0 (91 files, 0 failures) |
| workbench `score` (tag frame 0) | 100.0, 5 colours |
| workbench `lint` (sheet) | 0 errors; 1 warning `orphan_pixel` (71) + info `orphan_cluster` (113): the FX particles are 1-2 px glints / specks by design |
| decoded PNG total | 277 PNGs, 54.51 MiB (limit 56) |
| registration | `ASSET_IDS` + `fx.fault` (id 145, 146 total), manifest row, `manifest.test.ts` pins 145 -> 146 and the WP23a slice `slice(120)` -> `slice(120, 145)` (it pinned the tail), `assetGuide.test.ts` placement note, `docs/ASSET_GUIDE.md` block regenerated (only the new row differs) |

**Placement rule (spec for T9b; the plan says "anchor world position", undefined).** Anchor point = the top-centre of the part's
art box: `machineLocalToWorld({ x: (b.left + b.right) / 2, y: b.top })` with `b = componentBounds(MACHINE_COMPONENTS[id])`. Not
`getComponentWorldPosition(id)`: that is the pivot, which is the bottom for bottom-origin parts (pistonArray, sparkGap, boiler,
calliope, the gravitic anchors) and would put the marker inside the part. The marker container (origin bottom-centre) sits at
anchor point + `OFFSET_ART_PX` x `PIXEL_SCALE` = 28 world px above the part top, scaled with the world like the machine (1 art px
= 2 world px; no extra low-zoom scale, see S2). Inside the frame: plate rows 3-18, pointer tip row 20, rows 21-23 empty. Label
`FAULT [F]`: top-centre about 3 art px above the frame bottom (just under the pointer tip); the 16 x 2 bar under the label; both
end above the part top. Draw order FX, tag, label, bar. `onScreen(id)` for `pickAnchor`: the part is visible and the frame box
(24 x 24 art px at the anchor point + offset) lies inside the camera view inset by 80 world px.

**Anchors.** Pass = visible part's marker box (frame + label gap) at least 80 world px inside the view in every swept case of the
era, clear of the HUD panel (measured rect + 20 game px for the WP27 WIND-UP row), the crank gain block (5 lines, 14 chars,
jitter) and the WP25 output popup (`OUTPUT_TICK` anchor + offset, 10 chars, rise). Insets are world px, worst case.

| era | plan | ADb | inset (visible / cases) | why changed |
|---|---|---|---|---|
| I | wornMotor, pistonArray | **pistonArray, flywheel** | 108 (3/3), 236 (3/3) | wornMotor: the ME output popup (`OUTPUT_TICK` wornMotor + (0, -32)) rises through the marker in 3/3 cases (`<O>/adb/cand/cand-e1-1080-p0.png`) |
| II | generator, sparkGap | **sparkGap, flywheel** | 120 (7/43), 292 (43/43) | generator: the EE popup (generator + (0, -90)) sits on the tag in 43/43 (`<O>/adb/cand/cand-s8-1080-generator-p0-1x.png`); no other era II part is visible at era II entry, so the flywheel carries early era II |
| III | boiler, steamHammer | boiler, steamHammer (confirmed) | 214 (46/46), 502 (14/46) | — (the PR popup, 10 chars, starts 67 world px right of the boiler frame at s11; AD2 checks the real label width) |
| IV | spireTower, koenigFork | **spireExciter, calliope** | 604 (53/53), 608 (16/53) | spireTower: the anchor point is the crown, so once crystalLattice is owned the tag covers the crystal (`<O>/adb/cand/cand-s13-1080-p0.png`); koenigFork passes but crowds the exciter; calliope stands in open sky above the whistles. spireExciter is 19 world px clear of the crank gain block at 14 chars (39 at 12) |
| V | nullChamber, ring2Front | **graviticAnchorR, graviticAnchorL** | 216 (36/73), 216 (36/73) | nullChamber -24 and ring2Front -8: off-screen at the era V entry framing (s11 pose, the chamber top 26 game px under the screen top; `<O>/adb/cand/cand-s14-1080-top-1x.png`); nullGallery would sit inside the chamber over the core and siphons (`<O>/adb/cand/cand-s15-1080-p0.png`) |
| fallback | handCrank | handCrank (confirmed) | 284 / 304 / 324 / 480 / 332 (all cases) | — (on the frame top girder, above the crank hit circle) |

Era V has no clean anchor until graviticAnchor is owned: before it the fallback (the crank) takes every era V fault, by the
plan's own fallback rule. HUD margins (game px): graviticAnchorL is the closest, 38 under the era V HUD with the WIND-UP row
allowance (it shares the HUD's x span); every other anchor is right of the HUD. No anchor touches a gain block or popup.

**Read checks** (`<O>/adb/final/`; review shots show both anchors of an era at once, the game shows one marker; the label and
bar are mocks for spacing, T9b owns them):
- full frames `final-<shot>-<1080|720>-p<0|1>.png` (p0 = tag 0 + fx[era][0], the reduced-motion pair; p1 = tag 1 + fx[era][1]);
- crops `final-<shot>-<h>-<id>-pulse-<1x|x3>.png`: lit | dim side by side, 1:1 and x3 nearest.
- e1 / s8 (zoom 1): tag 72 client px at 1080p, 48 at 720p, reads on sky and on iron; sparks visible.
- s9 / s10 (zoom .75): 54 / 36 px; non-integer nearest scale as every sprite at this zoom.
- s11-s15 (zoom .5): 36 px at 1080p, 24 px (1 art px = 1 px) at 720p. The plate and `!` read at 1:1; the FX are faint at 720p
  (`<O>/adb/final/scale-compare-720-<1x|x3>.png`).
- Pulse: lit -> dim is one ramp step of value on an unchanged shape; at 340 ms it reads as a slow pulse (2.9 changes per s,
  1.5 Hz cycle), not a strobe. Spark / static frames move a few 1-px particles: within the 3 Hz rule.
- The FX never cover the part (they live on the flanks and above the plate) and never cover the tag.

**Specs for the EM (not ADb files):**
- **S1 (T9b debug hook, T14a smoke C).** C13 `C_marker` "within 120 screen px of the anchor part" fails when `anchorClient` is the
  part centre: marker centre to part centre at 1080p is pistonArray 165, flywheel 222, sparkGap 150 (zoom 1), boiler 167 (s10),
  graviticAnchor 135, handCrank 150 client px. Make `faultStats().anchorClient` the anchor point (part top-centre); the marker
  centre is then 52 world px away (78 client px at zoom 1, 39 at zoom .5) for every anchor.
- **S2 (not adopted; AD2 to judge in game).** A 2x marker scale at zoom <= .5 would make the era III-V tag 48 px at 720p, but
  then spireExciter overlaps the crank gain block (53/53 era IV cases), the era III fallback crank does in 16/46, and
  graviticAnchorL touches the HUD allowance (`<O>/adb/calc/anchors-14-lowz2.json`). Keep the world scale.
- **R1 (AD2 watch).** A crow bubble on the lamp can come near the sparkGap marker at s8 cx 2104 and the graviticAnchorR marker at
  s15 (both in the right wing); bubbles are transient, no data change proposed.

Hand-off (T9b applies it to `src/data/faults.ts` and its test):

```
WP27-FAULT-HANDOFF-BEGIN
ANCHORS_1 = pistonArray flywheel
ANCHORS_2 = sparkGap flywheel
ANCHORS_3 = boiler steamHammer
ANCHORS_4 = spireExciter calliope
ANCHORS_5 = graviticAnchorR graviticAnchorL
FALLBACK_ANCHOR = handCrank
ART_TAG = 0 1       ART_FX_1 = 2 3  ART_FX_2 = 2 3  ART_FX_3 = 4 5  ART_FX_4 = 6 7  ART_FX_5 = 8 9     ART_CLEAR = 10     FRAME_MS = 340
OFFSET_ART_PX = 0 -14
WP27-FAULT-HANDOFF-END
```

Outside the block (T9b): the anchor point is the part's art-box top-centre (placement rule above), not its pivot.

### AD2 — WP27 in-game audit (wave 9)

Art Director, in game. **Verdict: NOT RELEASE-READY** (round 1). The crow, Sensor 7, the tree, the HUD row, era I motion and the store set
pass. The fault marker fails A17 as built: it is drawn on the part's pivot (inside the part), not above it (F1), and era V faults stop
until Gravitic Anchor is owned (F2). The ruffle drip still falls in eras I-II (F5). Fix list F1-F7 below; F1, F2 and F5 are code.

Build under audit. **The gate builds did not exist**: `dist/` and `dist-demo/` were the v0.10.1 baseline of 11:39 (pre-WP27, no fault code;
WP27 sources 18:34-20:46; no `<O>/val/`). No build was allowed, so the working tree was served by the Vite dev server: `npx vite --port 4174
--strictPort` (full) and `npx vite --mode demo --port 4177 --strictPort` (demo); both killed after (netstat empty). The tree did not change
during the audit (last edit 20:45). Typecheck clean at the start. Rendering code is the same as a build; the only DEV branch in `src/` is the
debug hook gate. **Round 2 must re-run on the real gate builds** (tools below, a few minutes each).
- One Playwright browser at a time, 1920x1080 unless stated.
- Fix trials were emulated at run time in the dev page only (no file edit): `FaultMarker.prototype` methods and `FAULTS` /
  `WORLD_GIRL_PLACEMENTS` values patched through the dev server's own module instances.

Evidence root `<A>` = `<O>/ad2/` (`<O>` as in ADa). Boards in `<A>/crops/`; runs: `crow/`, `crow2/`, `sensor/`, `crouch/`, `crouch1504/`,
`tree/`, `tree-demo/`, `resolutions/`, `fault/` + `fault45/` (as built), `faultP/`, `faultP22/`, `faultP12/`, `faultP10/` (emulated F1 with
offsets -14 / -22 / -12 / -10), `anchors/`, `pulse/`, `hud/`, `early/`, `demo/`, `store/`. Tools in `<A>/tools/` (`crow.mjs`, `crow2.mjs`,
`sensor.mjs`, `crouch.mjs`, `tree.mjs`, `fault.mjs` (env `PATCH`, `OFFSET_Y`, `ANCHORS5`), `anchors.mjs`, `pulse.mjs`, `hud.mjs`,
`early.mjs`, `demofault.mjs`, `board.py`, `faultboard.py`).

**1. A11 crow** — PASS except the drip (F5).

| case | result | evidence |
|---|---|---|
| s0, 60 s, a click every 1.5 s (crank playback) | 40 pose runs: perch0 / perch1 bob, perchTurn, peck0 / peck1; spread frames 0 | `crow/crow.json` `s0click`, `crops/AD2-crow-s0click-strip-x2.png` |
| s0, 3 clicks then 60 s idle | perch0 150 / 150 samples, never spread (crank playback holds the folded pose) | `crow.json` `s0idle`, `crow/s0idle-t*.png` |
| e1 (S7, timed), 60 s | perch, shift, look, ruffle, peck; one tipTry 515 ms (frozenTip, 2 art px pop) | `crops/AD2-crow-e1s7-strip-x2.png` |
| s8, 60 s | perch, stutter, skip, look, peck, ruffle; one tipTry 548 ms | `crops/AD2-crow-s8-strip-x2.png` |
| feet on the finial | perched y 1568 = lamp 1680 - 56 art x 2; glitch 1564 (the 2 px pop only inside tipTry) | `crops/AD2-crow-e1-poses-x4.png` |
| bubbles | s0 CRW-01 (after 8 clicks; refused on a cold s0), e1 CRW-01, s8 CRW-04 (accepted directly): perchHead / perchTalk only | `crops/AD2-crow-c2-and-talk-x3.png`, `crow/talk*-crow-*.png` |
| cycle 2 (save cycle set to 2) | forced tipTry: fly2 at lift 66 (y 1548) for 0.7-1.7 s in e1, up to 1.2 s at s8, then perched; 60 s natural: nothing held; eras III-V: tipTry refused, no fly2 in 30 s each | `crow2/crow2.json`, `crops/AD2-crow-c2-and-talk-x3.png` |
| ruffle drip from era III only | **FAIL**: the drop falls in eras I and II (8 of 9 forced ruffles); era III correct. `CastExtras.drawDrip` has no era gate (file unchanged vs 25b7c8b) | `crow.json` `dripE1/E2/E3`, F5 |

Seen beyond the list: in eras III-IV the crow talks on the spread-wing `talk` frame and snaps back to the folded perch
(`crops/AD2-crow-talk-e3-e4-x4.png`). That is the playtest picture again, in short bursts. F6 raises `crowPerchPoseToEra` to 4.
The era V stare (`head`) is canon (untouched).

**2. A12 Sensor 7** — PASS (F7 is polish).

| framing (commit step after hook buys) | placed (world x) | result | evidence |
|---|---|---|---|
| e1 (S7) | S7 1384, Inspector 1472, all e1 objects | ok | `sensor/e1s7-c1-*.png` |
| s8 cx 2064 | S7 1470, mini, Inspector 1536 facing it; clock 2680 shows | ok | `crops/AD2-sensor7-s8-s8w-c1-x3.png`, `crops/AD2-right-wing-s8-s8w-x2.png` |
| s8w cx 2112 (capacitorBank) / cx 2104 (sparkGap) | S7 1500, Inspector 1552, booth 2678, lamp + crow 2720, dog 2694, stake 2676, hole 2716, scrap 1530; clock and girl exempt | full cast; mini clear of the Inspector by 1 art px at cx 2112 | `crops/AD2-s8w-mini-x6.png` |
| s9 (S9) | e1 positions, all objects | ok | `sensor/s9-c1-*.png` |
| s10 / s11 (cx 2006 and 1922) | S7 1234 / Insp 1276; S7 750 / Insp 816 | ok, tripod inside the view | `crops/AD2-sensor7-s9-s10-s11-x3.png` |
| cycle 3 e1 / s8 / s8w / s9 | girl 1552 / 1508 / none / 1552 | s8: her boots touch the crouching Inspector's at 1508; 1504 clears by 2 art px (ADa's number) -> F7 | `crops/AD2-girl-c3-s8-s8w-x3.png`, `crops/AD2-s8-c3-crouch-1508-vs-1504-x4.png` |

The era I-II audit found no other missing object (`sensor/sensor-c1.json`, `sensor-c3.json`).

**3. A13 tree** — PASS.
- DOM probe, S15 + the five nodes, 1080p UI 100 (`tree/tree-full.json`).
- Per tab: nodes / edges / minimum edge-to-foreign-node distance. I 10 / 11 / 7.6 px; II 11 / 12 / 4.6; III 11 / 12 / 4.6; IV 10 / 10 / 7.6;
  V 13 / 14 / 6.8. No sample under 4 px.
- The new edges are short straight runs: Improved Pistons -> Fault Lamp (5,2); Spark Gap -> Discharge Lever (5,0) through the empty (4,0);
  Bellows Drive -> Leak Whistle (4,2) (accepted, no fallback); Echo Crank -> Damping Fork (5,0); Inversion Crank -> Overrun Clutch (5,0).
- Every old edge path is byte-equal to WP26 AD2.
- Edge-to-edge probe: only shared ports. Spark Gap's fork to Substation Blueprint and Discharge Lever shares about 8 px, then splits (a
  clean fork). The tab V outer channel leg is the WP26 N2 one.
- Demo :4177: tab I Fault Lamp, tab II Discharge Lever, tabs III-V `FULL GAME` (disabled).
- `resolutions.mjs`: 119 results, fail [], errors []. Tree PNGs approved; at 1280x720 / 800 UI 150, row 2 sits below the fold as in v0.10.x
  (the graph scrolls).
- Boards: `crops/AD2-tree-tabs-1345-1080.png`, `tree/full-tab2-1920x1080-100.png`, `crops/AD2-tree-demo-tabs-1080.png`,
  `crops/AD2-res-tree-1280x800-150-old-new.png`.

**4. A17 fault marker** — **FAIL as built**. It PASSES with F1-F4 (emulated).

| item | as built | with F1 + F2 + F3 + F4 (emulated, offset -10) | evidence |
|---|---|---|---|
| placement | **on the part's pivot**: plate on the piston cylinders, the flywheel hub, the boiler plinth, the gravitic pillar base. The 2-line label lies on iron, or on the ground beside the dog. `FaultMarker.anchorPoint` uses `getComponentWorldPosition`, which ADb ruled out ("the pivot ... would put the marker inside the part") | plate in open air above each part, pointer down at it; the label overlaps only the part's top edge (stroked, readable) | `crops/AD2-fault-marker-1080-100-1x.png` vs `crops/AD2-faultP10-marker-1080-100-1x.png` |
| era V entry (S14, no gravitic anchor) | **no fault at all**: `eraAnchorOnScreen` ignores the fallback, so the clock freezes; `forceFault` true, `alive` stays null | spawns on the crank (fallback) | `fault45/e5in-1080-100-full.png`, `faultP10/e5in-*` |
| HUD, UI 150 (1080p, 720p, Deck) | clear (markers sit low) | graviticAnchorL's top sits under the UI-150 HUD (F3: R only); era III plate tops 6-11 px under the HUD bottom at -10 (1-4 px at -14, F4) | `crops/AD2-faultP-e5-L-ui150.png`, `anchors/anchors-14.json` |
| crank gain block, output popups | no overlap in any era | no overlap; the crank fallback marker sits on the frame top, its block rises to the right | `crops/AD2-fault-<era>-context.png`, `crops/AD2-faultP10-<era>-context.png` |
| denizen bubbles | e5 crow bubble clear of the marker | e5 crow bubble covers the R label while it shows; the plate stays visible (transient, ADb R1) | `crops/AD2-faultP-e5-context.png` |
| legibility | frame 72 / 54 / 36 px at zoom 1 / .75 / .5 (plate 48 / 36 / 24) at 1080p; 24 px (plate 16) at 720p and Deck at zoom .5; the plate and `!` read at 1:1; the label (font floor 12 screen px) carries the small cases | same | `crops/AD2-faultP10-marker-720-deck-x2.png` |
| pulse | tag / FX swap every 293-405 ms (2 frames, about a 1.5 Hz cycle); reads as a slow pulse | same | `pulse/pulse.json` (renderer frame log) |
| reduced motion | one frame set, no swap in 4 s; instant hide on expiry | same | `pulse.json` |
| expiry | fade, visible about 0.2 s after `alive` ends | same | `pulse.json` |
| clear popup | `CLEARED +15s / +1.26K` (I), `+18s` + 3 energy lines (III), `+22s` + 5 lines (V); readable; its own block (untracked), never merged with the crank block | same, on open sky | `crops/AD2-fault-clear-popup-x2.png` |
| Overdrive | HUD row `WIND-UP 1.9/1.9s · OVERDRIVE ×2 6s` after a clear (era V) | same | `hud/hud.json` |
| demo :4177 | era I pistonArray; era II flywheel once the teaser and the end card are past (the teaser gate holds faults, by design); F clears | same | `demo/demofault.json` |

**5. HUD row** — PASS. WIND-UP is one line inside the panel at UI 100 / 125 / 150 on 1920x1080, 1280x720 and 1280x800, in era I and in
era V with Overdrive (18 / 18, `hud/hud.json`, `crops/AD2-hud-windup-row.png`). The RELEASE line comes first in the crank block: e1
`RELEASE +0.3s`; e5 `RELEASE +0.1s` + 5 energies = 6 lines, readable (`crops/AD2-e1-release-line-x2.png`,
`crops/AD2-faultP10-e5in-context.png`).

**6. Era I motion at +2 ME/s** — PASS.
- Worn Motor after 45 hand clicks.
- Over 30 s idle: `+6 ME` popups every 3 s (10 popups); the drive train turns slowly; the cast and the crow keep acting.
- The crank turns only on clicks (by design).
- Motor Tuning makes it +2.9 / s. Nothing reads dead.
- Evidence: `early/early.json`, `crops/AD2-early-wornMotor-idle.png`.

**7. Store shots** — PASS, approved.
- `store-shots.mjs` `SIZES=1080,2160` into `<A>/store`: 213 checks, fail [], errors []; `_no_fault` 38 / 38.
- Against the v0.10.1 set `WP26/close/store-final3`:
  - hud shots 02, 03, 04, 06, 07, 09: 2.4-8.3 % of pixels. The HUD zone moves 6-12 %: the WIND-UP row and the new economy numbers (02 era I
    `CLICK +15 ME · 0.18S`, 84 / s).
  - 05 (tab III): 2.5 %. Leak Whistle at (4,2) has the focus; the detail pane reads its plain line.
  - Clean shots: 0.1-3.5 %. Animation, and the crow perched instead of spread.
- Evidence: `crops/AD2-store-hud-old-new.png`, `crops/AD2-store-05-tree-era3-hud-half.png`,
  `crops/AD2-store-02-era1-full-clean-half.png`.

Notes (no fix):
- N1: in era V, Overdrive's HUD suffix widens the panel by about 20 CSS px for its 6 s. The values shift sideways, then back. C8 text kept;
  a shorter suffix is a later polish.
- N2: the s8 scrap 1530 lies at the Inspector's boot tip. He reads and crouches over it, so it reads as the thing he inspects. Accepted.
- N3 (pre-existing, v0.10.1 identical): Spark Gap bought before the Capacitor Bank hangs in the air. Mechanical backlog: it needs its bank
  or a stand (`crops/AD2-sparkgap-alone-v0101-vs-wp27.png`).
- N4 (pre-existing): tab III Turbine -> Relief Valves crosses the Condenser -> Vessel Blueprint channel at (801, 100). The paths are
  unchanged since WP26 (accepted detour). Backlog.
- N5: era IV crank block. Its RS line can land on the RS output popup and ghost the text (`crops/AD2-e4-crankblock-vs-rs-popup-x2.png`).
  This is the WP25 popup lane, not the marker. The EM checks it against v0.10.1.
- N6: `faults.mjs` `L_release` and `D_popup` are blind by design (no hook reads Phaser text). Checked by eye above.

Fix list (DATA / PLACEMENT for T15; **F1, F2, F5 are code**, outside the T15 template: EM call, the spec is exact):

| F | sev | file | key | old -> new |
|---|---|---|---|---|
| F1 | S1 | `src/game/rendering/FaultMarker.ts` | `anchorPoint()` | `machine.getComponentWorldPosition(id)` -> the ADb rule, art-box top-centre: `const b = componentBounds(MACHINE_COMPONENTS[id]); return machineLocalToWorld({ x: (b.left + b.right) / 2, y: b.top });` (imports from `../math/machineLayout`, `../../data/machineComponents`; keep the per-id cache) |
| F1b | S1 | `src/game/debugHook.ts` | `faultStats().anchorClient` | `machine.getComponentWorldPosition(marker.anchor)` -> the same top-centre point (ADb S1), so `faults.mjs` `C_marker` (120 px) keeps passing for tall parts |
| F2 | S2 | `src/game/rendering/FaultMarker.ts` | `eraAnchorOnScreen()` | era list only -> era list, or `this.isOnScreen(FAULTS.fallbackAnchor)` (the plan's "else fallbackAnchor; none on screen = not eligible") |
| F3 | S2 | `src/data/faults.ts` (+ `src/data/faults.test.ts:29`) | `FAULTS.anchors[5]` | `['graviticAnchorR', 'graviticAnchorL']` -> `['graviticAnchorR', 'graviticAnchorR']` (with F1, L sits under the UI-150 HUD) |
| F4 | S3 | `src/data/faults.ts` | `FAULTS.layout.offsetArtPx.y` | `-14` -> `-10` (era III plate clear of the UI-150 HUD by 6-11 px) |
| F5 | S2 | `src/data/worldDay.ts` + `src/game/rendering/CastExtras.ts` | `WORLD_AMBIENT.drip` + `drawDrip()` | add `fromEra: 3`; `drawDrip` hides and resets the drop while `(this.state?.era ?? 1) < DRIP.fromEra` (plan F5.3) |
| F6 | S3 | `src/data/worldEras.ts` | `WORLD_ERA_ENV.crowPerchPoseToEra` | `2` -> `4` (eras III-IV bubbles on perchHead / perchTalk; plan F5.3 allows it) |
| F7 | S3 | `src/data/livingWorld.ts` (+ pins `livingWorld.test.ts:418-423, 682`; `worldPlacement.test.ts:325-328, 453-455, 461-462`; doc row `docs/plan/DENIZEN_ART.md:348`) | `WORLD_GIRL_PLACEMENTS.s8.ground.x` (and its comment) | `1508` -> `1504` (tripod 4 px, Inspector rest 8 px, crouch 2 art px clear) |

```
WP27-AD2-FIX-BEGIN
F1  CODE  src/game/rendering/FaultMarker.ts anchorPoint = componentBounds top-centre (ADb rule)
F1b CODE  src/game/debugHook.ts faultStats.anchorClient = same point
F2  CODE  src/game/rendering/FaultMarker.ts eraAnchorOnScreen || isOnScreen(FAULTS.fallbackAnchor)
F3  DATA  src/data/faults.ts FAULTS.anchors[5] = graviticAnchorR graviticAnchorR
F4  DATA  src/data/faults.ts FAULTS.layout.offsetArtPx.y = -10
F5  CODE  src/data/worldDay.ts WORLD_AMBIENT.drip.fromEra = 3 ; src/game/rendering/CastExtras.ts drawDrip era gate
F6  DATA  src/data/worldEras.ts WORLD_ERA_ENV.crowPerchPoseToEra = 4
F7  DATA  src/data/livingWorld.ts WORLD_GIRL_PLACEMENTS.s8.ground.x = 1504
WP27-AD2-FIX-END
```

Round 2 (after the fixes and the gate builds):
- `fault.mjs` without `PATCH`, every era, 4 views.
- `anchors.mjs`: HUD gaps at UI 150.
- `crow.mjs` `ONLY=drip,talk` + one era III talk.
- `crouch.mjs` with no `GIRL_X`.
- `store-shots.mjs`: 07 and 09 can change only if F6 or F7 moves a pose.

### AD2 — WP27 in-game audit, round 2 (2026-10-28)

Art Director, in game, on the real gate builds. **Verdict: FIXES REQUIRED** (two small data fixes, F8 and F9). Round-1 fixes F1-F7 all
hold in the build. The crow, Sensor 7, the tree, the HUD row, the RELEASE line, the gates and the store set pass. Two defects are left:
- F8: at the era V entry the fault marker falls back to the crank. Its hit zone overlaps the crank hit circle and its label covers the crank.
- F9: in era IV the crow holds the spread-wing `head` frame for up to 12 s during the pre-stare unison `look`.

Build under audit: `dist` 02:40 (`index-CdInn1wD.js` 507 521 B, `FaultMarker-BoaemCl6.js` 11 010 B) and `dist-demo` 02:40
(`index-DRMHPH8d.js`). No file under `src/` or `public/` is newer than either build, so no rebuild was needed.
- Previews: :4174 `vite preview` (dist) and :4177 `vite preview --outDir dist-demo`, each started for its runs and killed after. netstat
  was empty at the end.
- :4174 briefly served the dev server, only for the F8 / F9 runtime emulation (no file edit). It was killed after.
- One Playwright browser at a time.

Evidence root `<A2>` = `<O>/ad2/r2/` (`<O>` as in ADa).
- Runs: `crow/`, `crow2/`, `c2tip/`, `c2tip-warm/`, `sensor/`, `crouch/`, `fault/`, `pulse2/`, `gates/`, `gates2/`, `hud/`, `tree/`,
  `store/`, `demo/`, `tree-demo/`, `emu/`, `emu-e4/`.
- Boards: `crops/`.
- Tools: `tools/`. These are the round-1 tools plus `gates.mjs`, `gates2.mjs`, `c2tip.mjs`, `pulse2.mjs`, `emu.mjs` and
  `run-full.sh`. `fault.mjs` now also logs the plate top against the HUD and the marker hit zone against the crank hit circle.
- Geometry: `calc/anchors-10.json`, the ADb calculator rebuilt on the current tree with offset -10.

**Round-1 fixes in the build**

| F | check | result |
|---|---|---|
| F1 / F1b | plate above the part top, pointer down, `anchorClient` = top centre | PASS, every era (marker centre 22-33 client px above the part top) |
| F2 | era V entry spawns on the fallback | PASS (it spawns), but see F8 |
| F3 | era V `graviticAnchorR` twice | PASS (never L under the UI-150 HUD) |
| F4 | offset -10 | PASS: the plate stays below the HUD in every view; worst gap 5 px (era III, Deck UI 150), then 10 (1080 UI 150) |
| F5 | no ruffle drip in eras I-II | PASS: drip samples 0 / 0 in eras I and II, 4-5 per ruffle in era III |
| F6 | crow bubble poses folded to era IV | PASS: e3 CRW-05 and e4 CRW-07 show `perchTalk*` / `perchHead*`; e5 CRW-08 keeps the canon `talk` / `head` stare |
| F7 | cycle 3 s8 girl at 1504 | PASS: crouch, reading and write cycles; her boots are clear of his (`crops/AD2r2-crouch-c3-s8-1504-x3.png`) |

**1. A11 crow** — PASS in eras I-II. Era IV: see F9.

| case (1920x1080) | result | evidence |
|---|---|---|
| s0, 90 s, a crank click every 1.5 s (59 clicks, crank playback) | perch 101 / look 37 / shift 24 / peck 17 / ruffle 14 samples; frames perch0, perch1, perchTurn, peck0, peck1, ruffle; **spread frames 0**; feet y 1568 = lamp 1680 - 56 x 2 | `crops/AD2r2-crow-s0click-strip-x3.png`, `crow/crow.json` |
| s0, 3 clicks then 90 s idle | perch0 260 / 260 samples, never spread (crank playback holds the folded pose) | `crops/AD2r2-crow-s0idle-strip-x2.png` |
| e1 (S7, timed), 90 s | perch, shift, look, peck, ruffle, plus one glance (`perchHead`); one tipTry of about 1.0 s (frozenTip / frozen, the 2 px pop to y 1564 only inside it) | `crops/AD2r2-crow-e1s7-strip-x2.png` |
| s8, 90 s | perch, stutter, skip, look, peck, ruffle; one tipTry of about 0.8 s | `crops/AD2r2-crow-s8-strip-x2.png` |
| bubbles | s0 after 8 clicks, e1, s8 and the s8 PAY-01 chain all show `perchHead` / `perchTalk` only | `crops/AD2r2-crow-talk-eras-x3.png`, `crops/AD2r2-crow2-c2.png` |
| cycle 2 (F5.4) | 60 s natural: no fly2. Forced tipTry: fly2 at lift 66 (y 1548), then perched; per-frame render 0.72-1.53 s with the world log 0.88-1.66 s (`c2tip-warm/`). The eras III-V forced tipTry is refused, with no fly2 in 30 s each | `crow2/crow2.json`, `c2tip-warm/c2tip.json` |
| sheet style | columns 12-14 (perchTurn, perchHead, perchTalk) share perch0's body, outline and ramps in all six rows | `crops/crow-sheet-x4.png` |

**2. A12 Sensor 7** — PASS. Commit step after the hook buys, cycles 1 and 3.

| framing | placed (world x) | result |
|---|---|---|
| e1 (S7) | S7 1384, Inspector 1472, booth 2420, lamp + crow 2476, clock 2516, dog 2364 | full cast |
| s8 cx 2064 | S7 1470, the mini between, Inspector 1536 facing it; clock 2680 | full cast + clock (`crops/AD2r2-s8-left-x4.png`, `crops/AD2r2-right-wing-e1-s8-s8w-s9.png`) |
| s8w cx 2112 (capacitorBank) / cx 2104 (sparkGap) | S7 1500, Inspector 1552, booth 2678, lamp + crow 2720, dog 2694 | full cast; the mini sits behind the Inspector's hand, unoccluded (the pre-agreed 1 px fallback); clock and cycle 3 girl exempt |
| s9 | S7 1384, Inspector 1472 (cx 2192, .75) | full cast |
| s10 / s11 (cx 2006 and 1922) | S7 1234 / Inspector 1276; S7 750 / Inspector 816 | pair together, tripod in view (`crops/AD2r2-sensor7-s10-s11-x2.png`) |
| cycle 3 | girl e1 1552, s8 1504, s9 1552 | clear of the tripod and the Inspector (`crops/AD2r2-sensor7-left-c1-c3-x2.png`) |

No other era I-II object is missing (`sensor/sensor-c1.json`, `sensor-c3.json`).

**3. A17 fault marker** — PASS except F8 (era V entry).
- Shape: amber plate, `!` glyph, era FX, the `FAULT [F]` label with the code above it, and the timer bar. All nine era states read at
  1080p and 720p, UI 100 and 150, and on Deck UI 150. Plate size by zoom: 1 = 48 px, .75 = 36, .5 = 24 (16 at 720p).
- Evidence: `crops/AD2r2-fault-markers-1080-x1.png`, `crops/AD2r2-fault-markers-720-x2.png`, `crops/AD2-fault-<era>-context.png`.
- Anchors seen: e1 pistonArray / flywheel; e2 flywheel / sparkGap; e3 boiler / steamHammer; e4 spireExciter / calliope;
  e5 graviticAnchorR; e5in handCrank (fallback).
- HUD: the plate is never under the panel. Closest: era III steamHammer, 5 px at Deck UI 150 and 10 px at 1080 UI 150.
- Crank hit area: the marker zone (at least 56 px) clears the crank circle (72 world px) by 52-706 px in eras I-IV and V full.
  **e5in: it overlaps by 13 px at 1080p and 18 px at 720p / Deck, and the label lies on the crank hub (F8).**
- Flicker, read per animation frame from `faultStats().marker`: tag / FX swap 2.91-2.92 Hz in eras I and IV, with frame-quantised
  intervals of 300-384 ms (`pulse2/pulse2.json`). Reduced motion: 0 swaps in 5 s, steady `0/2` (I) and `0/6` (IV).
- Clear popup: `CLEARED +15s` / `+18s` / `+22s` plus one payout line per energy, in its own block. Overdrive: the HUD shows
  `OVERDRIVE ×2 6s` in era V.
- Gates, with a fault forced each time:
  - no marker and no clock behind the system menu, photo mode, TECH INDEX, the finale `sequence` and the `choice`;
  - the era card (eras II and IV): 19 / 19 samples with the card up and no fault; it spawns after the card closes (`gates2/`);
  - demo: the teaser and the END OF DEMO card hold it too.
  - Evidence: `crops/AD2r2-gates-half.png`, `crops/AD2r2-demo-gates-half.png`.
- Demo :4177: e1 pistonArray, e2 flywheel, F clears.

**4. HUD and tree** — PASS.
- WIND-UP is one line inside the panel at 1920x1080, 1280x720 and 1280x800, UI 100 / 125 / 150. This holds in era I and in era V with
  `· OVERDRIVE ×2 6s` (`hud/hud.json`, `crops/AD2r2-hud-windup-rows.png`).
- RELEASE is the first line of the crank block: e1 `RELEASE +0.4s` / `+45`; e5 `RELEASE +1.9s` plus 5 energies. It reads at every
  view (`crops/AD2r2-release-lines.png`).
- Tree probe, full: tabs I-V have 10 / 11 / 11 / 10 / 13 nodes and 11 / 12 / 12 / 10 / 14 edges. No edge touches a box; minimum
  distances are 7.6 / 4.6 / 4.6 / 7.6 / 6.8 px, the same as round 1.
- Shared runs are only port forks (II sparkGap 4 px, V nullChamber 18 px), plus N4 (tab III, 3 px, pre-existing).
- Demo tabs I-II are the same; tab III shows FULL GAME.

**5. Store shots** — PASS. `store-shots.mjs` `SIZES=1080`: 107 / 107 checks, fail [], errors []. `_no_fault` 19 / 19 and
`_no_output_tick` 19 / 19. Against the EM gate set `val-em2/store-1080`: 05 and 10 are identical, and the rest differ by 0.02-3.3 %
(animation phase).

**F8 (S2, data): era V entry marker on the crank**
- Before Gravitic Anchor, no era V anchor is on screen, so every era V fault takes the `handCrank` fallback.
- The plate sits on the frame girder. Its 56 px hit zone reaches 13-18 px into the crank hit circle, and the `FAULT [F]` label covers the
  crank hub. A crank click on the hub's top clears the fault instead of turning the crank. This breaks the acceptance item "never over
  the crank hit area".
- Fix: era V's second anchor becomes `generator`. ADb calculator over 73 era V cases: visible 73 / 73, minimum inset 320 world px, gain
  block 0, output popup 0.
- Emulated in game: the plate stands in open sky above the coils, 267-401 px from the crank, with the label above the coil caps. Once
  Gravitic Anchor is owned, faults alternate R and generator. `flywheel` was rejected: the crank gain block crosses it in 73 / 73.
- Evidence: `crops/AD2r2-F8-e5in-before-after.png`, `crops/AD2r2-F8-generator-e5-x2.png`, `emu/emu.json`.

**F9 (S3, data): era IV crow spread wings in the unison look**
- `WORLD_UNISON.map.pre.crow` maps `look` to `head` and the `mouth` accent to `talk`. Both are spread-wing frames.
- In 60 s of era IV the crow held `head` for one 12.0 s run, plus 0.8 s of `talk` accents. With the era IV hover this is the playtest
  picture again, and STORY_BIBLE §5.5 asks only that "the crow turns its head".
- Fix: `perchHead` / `perchTalk`, the same frames round-1 F6 gave the era III-IV bubbles. The post-observer stare (`head`) stays canon.
- Emulated: 11.9 s `perchHead` + 0.8 s `perchTalk`, folded wings.
- Evidence: `crops/AD2r2-F9-e4-unison-before-after-x4.png`, `emu-e4/emu.json`, `c2tip/c2tip.json`.

Notes (no fix):
- N7 (debug only): the first forced cycle 2 tipTry within about 2 s of a reload rendered fly2 for 2.7 s. The world log says 1.68 s, so
  the world clock ran slow just after load. After a 20 s warm-up, all 6 forced runs show 0.72-1.53 s. The 60 s natural cycle 2 run had
  no fly2.
- N8: the label lies on the part's top edge: e1 the piston caps, e4 the exciter, e3 the hammer frame. The 3 px ink stroke keeps it
  legible at every view. Accepted as in round 1.
- N9 (canon): the era IV crow hovers about 2 art px over the finial ("The crow hovers in place", STORY_BIBLE §4.1 era IV). Unchanged by F9.
- N3 / N4 from round 1 are still open as backlog: the Spark Gap floats without its bank at s8w cx 2104, and tab III has the
  turbine -> reliefValves meet.

```
WP27-AD2R2-FIX-BEGIN
F8  DATA  src/data/faultMarker.ts FAULT_MARKER.anchors[5] = graviticAnchorR generator (+ faults.test.ts pins, faults.mjs ANCHORS + J_e5in, smoke README)
F9  DATA  src/data/worldBehaviour.ts WORLD_UNISON.map.pre.crow look = perchHead ; mouth accent = perchTalk (+ worldBehaviour.test.ts guard)
WP27-AD2R2-FIX-END
```

Round 3, after F8 and F9 and a rebuild, a short check: `fault.mjs` `ONLY=e5in,e5` (generator, crank gap > 0, HUD) and `c2tip.mjs` era IV
(no `head` before the observer). Then RELEASE-READY.

### AD2 — WP27 in-game audit, round 3 (2026-10-28)

Art Director, in game, on the gate builds with F8 and F9. **Verdict: RELEASE-READY.** F8 and F9 hold. The full A11 / A12 / A13 / A17 sweep
was re-run on both builds and passes. No new fix.

Build under audit:
- `dist` 05:00: `index-B3MMpdpy.js` 507 521 B, `FaultMarker-CuqEso-v.js` 11 004 B, `LivingWorldDirector-hsKMZFG4.js` 206 248 B.
- `dist-demo` 05:00: `index-BvdlqJ06.js` 508 123 B.
- No file under `src/` or `public/` is newer than either build, so no rebuild was needed.
- The bundles carry both fixes: `graviticAnchorR","generator"` in both FaultMarker chunks, and `look:Q("perchHead")` in the lazy chunk.

Run notes:
- Previews: :4174 `vite preview` (dist) for the full runs, then :4177 `vite preview --outDir dist-demo` for the demo runs. Each was killed
  after its runs; netstat for 4174 / 4177 was empty at the end.
- One Playwright browser at a time, 1920x1080 unless stated.

Evidence root `<A3>` = `<O>/ad3/` (`<O>` as in ADa).
- Runs: `fault/`, `c2tip/`, `crow/`, `crowtalk/`, `crow2/`, `sensor/`, `crouch/`, `pulse2/`, `gates/`, `gates2/`, `hud/`, `tree/`,
  `early/`, `store/`, `e4crow/`.
- Demo runs: `demo/`, `tree-demo/`, `demo-sensor/`, `demo-crow/`.
- Boards: `crops/AD3-*`.
- Tools: `tools/`. These are the round-2 tools plus two additions:
  - `gates.mjs` gains a `postgame` gate: KEEP IT RUNNING, then forceFault.
  - `e4crow.mjs`: era IV unison crow clips.
- `run.sh` / `run2.sh` run the steps in sequence.

**Round-2 fixes in the build**

| F | check | result | evidence |
|---|---|---|---|
| F8 | era V entry (S14, no Gravitic Anchor): the marker on `generator`, not the crank | PASS. Every view picks the generator: plate over the coil caps, open sky. Crank gap: 315 px at 1080 UI 100 / 150, 200 px at 720 UI 100 and Deck UI 150 (round 2: -13 / -18). Plate top clear of the HUD. In era V full, faults alternate generator / graviticAnchorR (crank gap 200-706). | `crops/AD3-F8-e5in-before-after-x2.png`, `crops/AD3-F8-e5in-views-half.png`, `fault/fault.json` |
| F9 | era IV unison crow folded before the observer | PASS. 60 s of era IV (cycle 1): perch0 45.8 s, perchHead 11.95 s (`look`), perchTalk 0.7 s (`mouth`), perchTurn 1.0 s. `head` / `talk` 0 ms. The F9 clips show perchHead and perchTalk with folded wings on the era IV row (canon hover 2 art px, N9). | `crops/AD3-F9-e4-unison-before-after-x4.png`, `c2tip/c2tip.json`, `e4crow/e4crow.json` |

**1. A11 crow** — PASS (full and demo).

| case | result | evidence |
|---|---|---|
| s0, 90 s, a crank click every 1.5 s (59 clicks, crank playback) | Activities: perch 97, look 35, shift 24, peck 16, ruffle 14 samples. Frames: perch0, perch1, perchTurn, peck0, peck1, ruffle. Spread frames 0. Feet y 1568 = lamp 1680 - 56 x 2. Demo: the same (spread 0). | `crops/AD3-crow-s0click-strip-x3.png`, `crow/crow.json`, `demo-crow/crow.json` |
| s0, 3 clicks then 90 s idle | perch0 258 / 258 samples, never spread. Crank playback holds the folded pose by design (F5.1b). | `crow/s0idle-t*.png` |
| e1 (S7, timed), 90 s | perch, shift, look, peck, ruffle, one glance (perchHead). One tipTry, 1.31 s in the log: frozenTip / frozen, the 2 px pop to y 1564 only inside it. Demo: tipTry 1.06 s. | `crops/AD3-crow-e1s7-s8-strip-x3.png` |
| s8, 90 s | perch, stutter, skip, look, peck, ruffle. One tipTry, 0.82 s. Demo: about 0.8 s. | `crops/AD3-crow-s8-strip-x3.png` |
| bubbles | e1 CRW-01, s8 CRW-04, the s8 PAY-01 -> CRW-04 chain, e3 CRW-05, e4 CRW-07: perchHead / perchTalk only. s0 after a few clicks (`crow2`): perchHead. e5 CRW-08: the canon talk / head stare. A cold s0 refuses CRW-01 (as in rounds 1-2). | `crops/AD3-crow-talk-eras-x3.png`, `crowtalk/crow.json` |
| cycle 2 (F5.4) | 60 s natural e1: no fly2. Forced tipTry after a 20 s warm-up, sampled per animation frame: fly2 at lift 66 (y 1548) for 0.72-1.48 s in e1 and 1.02-1.47 s at s8, then perched. Eras III-V refuse the forced tipTry: no fly2 in 30 s each. The first forced try right after a reload rendered 2.6 s (debug only, N7 as in round 2). | `c2tip/c2tip.json`, `crow2.out.json` |
| ruffle drip | eras I-II 0 / 0, era III 4 samples per ruffle | `crowtalk/crow.json` |
| sheet style | Columns 12-14 (perchTurn, perchHead, perchTalk) share perch0's body, outline and ramps in all six rows. The rows I-II smudge face and the rows III+ eye and rim layers are kept. | `crops/AD3-crow-cols-x6.png`, `crops/AD3-crow-sheet-x4.png` |

**2. A12 Sensor 7** — PASS (full and demo, cycles 1 and 3).

| framing | placed (world x) | result |
|---|---|---|
| e1 (S7) | S7 1384, Inspector 1472, booth 2420, lamp + crow 2476, clock 2516, dog 2364 | full cast |
| s8 cx 2064 | S7 1470, the mini, Inspector 1536 facing it; clock 2680 | full cast and clock |
| s8w cx 2112 (capacitorBank) / cx 2104 (sparkGap) | S7 1500, Inspector 1552, booth 2678, lamp + crow 2720, dog 2694 | Full cast. The mini sits behind the Inspector's hand, unoccluded (the 1 px fallback). Clock and cycle 3 girl exempt as documented. |
| s9 | S7 1384, Inspector 1472 | full cast |
| s10 / s11 | S7 1234 / Inspector 1276; S7 750 / Inspector 816 | the pair together |
| cycle 3 | girl e1 1552, s8 1504, s9 1552 | Clear of the tripod and the Inspector. At s8 his crouch, reading and write poses keep a visible gap to her boots (about 1 art px, at 1504). |

No other era I-II object is missing (`sensor/sensor-c1.json`, `sensor-c3.json`, `demo-sensor/`).
Boards: `crops/AD3-sensor7-left-c1-x2.png`, `crops/AD3-s8-s8w-mini-x4.png`, `crops/AD3-right-wing-e1-s8-s8w-s9-x2.png`,
`crops/AD3-crouch-c3-s8-x3.png`.

**3. A17 fault marker** — PASS.
- Every era state reads at 1080p and 720p, UI 100 and 150, and on Deck UI 150: amber plate, `!` glyph, era FX, the code over the
  `FAULT [F]` label, and the timer bar (`crops/AD3-fault-markers-1080-100-x1.png`, `crops/AD3-fault-markers-720-100-x2.png`).
- Anchors seen: e1 pistonArray / flywheel; e2 flywheel / sparkGap; e3 boiler / steamHammer; e4 spireExciter / calliope;
  e5in generator; e5 generator / graviticAnchorR.
- HUD: the plate is never under the panel. Closest: era III steamHammer, 5 px at Deck UI 150 and 10 px at 1080 UI 150.
- Crank: the hit zone clears the crank circle in every era and view. Minimum 52 px (era IV spireExciter at 720 / Deck), era V entry
  200 px. No marker over the crank gain block or the output popups (`fault/*-crank-with-marker*.png`).
- Flicker, read per animation frame: 2.94 Hz (I) and 2.97 Hz (IV), intervals 300-400 ms. Reduced motion: 0 swaps, steady `0/2` / `0/6`
  frames (`pulse2/pulse2.json`, `crops/AD3-fault-pulse-reduced-x3.png`).
- Clear popup: `CLEARED +15s` / `+18s` / `+22s` plus one payout line per energy, in its own block. Era I has a single unlabelled ME
  line, the era I crank-block convention (`crops/AD3-fault-clear-popups-x2.png`).
- Overdrive: the HUD row reads `WIND-UP 1.9/1.9s · OVERDRIVE ×2 6s` and counts down; the screen-reader line carries it too.
- Gates, with a fault forced each time: no marker and no clock behind the system menu, photo mode, TECH INDEX, the finale `sequence`,
  the `choice` and **the postgame** (new this round, after KEEP IT RUNNING). Each spawns within 27-52 ms of closing where a close
  exists.
- Era card (`gates2`): 19 (era II) and 20 (era IV) samples with the card up, none with a fault alive; the fault spawns after the card.
- Demo :4177: the teaser and the END OF DEMO card hold it; e1 pistonArray and e2 flywheel; F clears (`crops/AD3-gates-third.png`,
  `crops/AD3-demo-half.png`).

**4. HUD and tree** — PASS.
- WIND-UP is one line inside the panel in 18 / 18 views: 1920x1080, 1280x720 and 1280x800 at UI 100 / 125 / 150, in era I and in era V
  with `· OVERDRIVE ×2 6s` (`hud/hud.json`, `crops/AD3-hud-windup-rows-x1.png`).
- RELEASE is the first line of the crank block: e1 `RELEASE +0.4s` / `+45`; e5 `RELEASE +1.9s` plus 5 energies
  (`crops/AD3-release-lines-x2.png`).
- Tree, full: tabs I-V have 10 / 11 / 11 / 10 / 13 nodes and 11 / 12 / 12 / 10 / 14 edges. No edge touches a box. Minimum distances
  7.6 / 4.6 / 4.6 / 7.6 / 6.8 px. Shared runs are port forks only (II sparkGap 4 px, V nullChamber 18 px), plus N4.
- Demo tabs I-II are the same; III-V read FULL GAME. Tabs fit at every view (`crops/AD3-tree-tabs-1080-half.png`).

**5. Store shots** — PASS.
- `store-shots.mjs` `SIZES=1080`: 107 checks, fail [], errors []. `_no_fault` 19 / 19 and `_no_output_tick` 19 / 19.
- Against the round-2 set: 01, 05 and 10 are identical (at most 0.04 %); the rest differ by 0.3-2.2 % (animation phase).
- 06 (era IV) shows the folded crow over the lit lamp (`crops/AD3-store-06-crow-x4.png`); F9 changes only the unison `look` pose.
- Evidence: `crops/AD3-store-1080-half.png`.

**6. Era I motion at +2 ME/s** — PASS, as in round 1.
- After Worn Motor, 30 s idle gives 10 output popups (`+6 ME`); Motor Tuning makes it +2.9 / s.
- The cast and the crow keep acting.
- Evidence: `early/early.json`.

Notes (no fix):
- N10 (polish backlog): the clear popup uses the crank block timing (`CRANK_FEEDBACK.floatMs` 1100 ms). The header reads at once, but
  the era V payout lines (6 lines) are gone in about 1 s. A longer hold for fault popups only would be a later polish. Overdrive is
  shown on the HUD row, not in the popup (plan C9).
- N11 (accepted): fault codes are per era, not per part, so an era II `COIL CHATTER` can sit on the flywheel. The flywheel drives the
  generator, and the codes are the machine's voice. Per-anchor codes would be a later polish.
- N3, N4, N7, N8 and N9 from rounds 1-2 are unchanged.

```
WP27-AD2R3-FIX-BEGIN
(none)
WP27-AD2R3-FIX-END
```

## WP28a

### AD1 — Splice objects (eras I-II), Finds and stage numbers (Art Director, 2026-10-28)

Scope: the art for the four new era I-II Splice objects and the clock's lit face, the Finds sheet, and the stage numbers
that T13a, T14a, T14b and T15b1 copy. Hand-off: `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28/plan/ad1-handoff.md` (sections a-h, one json block each). Evidence:
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28/plan/ad1/` (sheet previews at 1x and 3x, composites, tooltip mocks, `tools/` with the checks).

**1. Art** — DONE (hand-pixelled; DENIZEN_ART §11).

| sheet | PNG | check_sheet | workbench score | lint |
|---|---|---|---|---|
| world.splicesA | `world/splices-a.png` 640x24, 20 cells of 32x24 | CLEAN | 91.3 (cells 0-9) / 92.9 (cells 10-19) | 0 / 0, info only |
| world.finds | `world/finds.png` 88x8, 11 cells of 8x8 | CLEAN | 94.9 | 0 / 0, info only |

- Bicycle 26x15 (dead, spin 3, whole). A child's roadster on a rear stand; the rear wheel turns backwards (counter-clockwise).
  The pedals follow at the 2:1 chain ratio, so the 3-frame loop is seamless.
- Organ 27x24 (dead, crank 4, whole): an arched pipe front on a barrow.
- Radio 16x20 (dark, lit A, lit B, whole) on a pine crate.
- Bulb arrow sign 28x22 (dark, half A, half B, whole): bent down, the head points at the ground, no letters.
- Clock lit face 12x12: an overlay with no hands.
- No era rows: street furniture like the lamp and the clock, in a muted weathered ramp. No green or blue. Before the finale
  a lit part uses `#d9822b` on rust; `#f0a848` / `#ffd27a` appear only in the whole cells.
- Finds: 7 items, the relic note, and a 5x5 one-color glint. Eras III-IV tint it with `setTintFill(0xffd27a)`; the ground
  ring carries the C8 era accent.
- `check_sheet.py` gains per-frame `no_ring` and `conn8` (the bicycle's 1 px tubes and the glint). Rebuilds are pixel-identical.
- Decoded PNG total: 54.51 MiB → 54.57 MiB (limit 56).
- PixelLab: 20 generations (2 `create_image_pro` concept calls: bicycle and organ, 64 candidates each, flywheel anchor,
  palette lock). Proportion reference only. The AI wheels filled their spokes with sand, which is slop, so it was rejected.

**2. Placements** — DONE (hand-off c; checked by `ad1/tools/placements.py` against the worktree geometry).
- Every placement passes all checks:
  - the wing rule, with the bbox in view;
  - at least 96 px from the crank hub;
  - no overlap with any visible machine part (all parts end at `GROUND_Y`);
  - the UI 150 HUD yard limits;
  - 2D clear of the WORLD_SPOTS keep-out boxes, the cast, the ground girl and the far-plane girl mini;
  - no two objects touching.
- Only the bicycle at s8w needs the 2D reading of the spot rule: its top (G+33) is below the dog row (G+32).
- Edits against the plan draft:
  - bicycle s9 2924 yard130, s11 2960 yard130, s15 3150 back (was off);
  - organ e1 1352 yard64, s8 1466, s8w 1510, s9 1392 yard80, s11 712, s15 718 yard56;
  - radio s8 1506 yard110, s9 1530 yard104, s15 690 yard100 (AD3 had left s15 open);
  - sign s9 2990 yard76, s11 3060 yard76.
- These keep every line off the other objects and every object off the Inspector spots.
- Documented exemptions: s10 for the bicycle, organ, radio and sign (52 px wings); the radio at s8w; the sign at s8, s8w
  and s15; the clock at s8w and s10 (existing).

**3. Lines, Finds, perches, colors, tooltip** — DONE (hand-off d-h).
- Payphone drop wire at s9, s10 and s11, from the mast top (2792, 1464) to the booth gable (feet + (-8, -98)), sag 8. It
  clears the clock by 33 px and 74 px. The ground cable is used at s8 / s8w (no mast) and at s15 (the right anchor stands
  under the span).
- Find spots: 2-4 per framing, each at least 24 px from every cast foot. The crow drops land 26 px in front of the lamp.
- Perches:
  - s8: lamp, booth roof and clock;
  - s8w: lamp and booth roof;
  - s10: none (no crow there);
  - s9 / s11: the ground perch is fixed at 2924 (dog x + 36 stood the crow in the hole);
  - s15: the clock top is dropped (a hop to the inner-gap clock crosses the right anchor).
- Tooltip slab rule: above the object, below when the crank circle is in the way. Checked over all 87 placement x UI cases:
  it never covers the crank and never leaves the screen.

Open (not AD1 files; for the EM):
- `src/assets/manifest.test.ts` pins `ASSET_IDS.length` at 146 (lines 554, 725, 1128). It must be 148 now: the T17a assets
  re-pin.
- `src/assets/assetGuide.test.ts` `PLACEMENT_NOTES` needs `world.splicesA` and `world.finds` before the next writer run.
  The two guide rows were generated out of tree by the same code.
- AD3 (WP28b): move the spot and Splice drafts that now sit on these objects. These are the e1 Inspector yard 1360@64, the
  s11 hydrant 2960 yard56 and the s15 cairn 720 yard40.
- AD2 checks in game:
  - the lines draw behind the dog and the yard objects;
  - the clock overlay sits under the hands;
  - the glint tint in eras III-IV;
  - the organ and bicycle read at zoom 0.5 (s11 / s15).

```
WP28A-AD1-FIX-BEGIN
(none)
WP28A-AD1-FIX-END
```

### AD2 — WP28a in-game audit, round 1 (Art Director, 2026-10-28)

**Verdict: NOT RELEASE-READY.** The Splice art, the Find items and glints, the tooltip text, the poke ladder, the crow's arc, the clock
tick, NEXT BUY, the SPLICES tab, reduced motion and the demo pass. Blocking:
- F1 (S1): every poke zone is centred on its target's top-left corner, so only the top-left quarter of a target takes hover and clicks.
  The payphone and the lamp never take hover at e1 / s8 / s9.
- At UI 150 the camera refocus (WP22 F11) puts the yard under the HUD buttons. The s9 Bulb Sign sits 88 % under SYSTEM, the s8 / s8w
  bicycle 39-50 %, and the s8 radio is off screen. Finds spawn under SYSTEM at s8 / s9, and never spawn at s8w (F5, F6, F14).
- The Splice objects vanish on screen when the finale starts; the postgame shows no whole frame (F7).
- The lines are half an art px wide: they dash at zoom 0.5, and the era I pulse and wake beat cannot be seen (F3).
- Poke answers of the woken objects use another object's sound and show nothing (F10). The girl window / mini never answers (F11).
  The level-3 leaves walk toward the machine (F12, F9).
- The Find marker draws under the curb strip and the lines (F2). The crow floats over two perches (F8). The payphone ring is missing (F13).

Build under audit. **The G builds did not exist**: `dist/` and `dist-demo/` were from 07:13 (v0.11.0, before WP28a), there was no `<O>/val/`,
no node process ran, and :4174 / :4177 were free. The assignment allows no build, so the working tree was served by the Vite dev server,
as in WP27 AD2 round 1:
- `npx vite --port 4174 --strictPort` (full), then `npx vite --mode demo --port 4177 --strictPort` (demo).
- Each server was killed after its runs; netstat for 4174 / 4177 was empty at the end, and no node process was left.
- `tsc --noEmit` exit 0 at the start.
- No file under `src/`, `public/` or `scripts/` changed during the audit (last edit 20:29).
- The only DEV branch in `src/` is the debug hook gate (`bootstrap.ts:479`), so the rendering is the build's.
- **Round 2 must run on the real gate builds.**
- One Playwright browser at a time, 1920x1080 unless stated.

Evidence root `<V>` = `<O>/val/ad2/`.
- Runs: `frames/`, `frames-rm/`, `hover2/`, `hg/`, `uiclear/`, `finds/`, `finds-rm/`, `finds150/`, `finds-eras/`, `pokes3/`, `pokes-rm/`,
  `crowperch/`, `misc/`, `misc2/`, `screencast/`, `store/`, `demo/`.
- Boards: `crops/`.
- Tools: `tools/` (`lib.mjs`, `frames.mjs`, `hover.mjs`, `hoverdbg2.mjs`, `uiclear.mjs`, `finds.mjs`, `pokes.mjs`, `crowperch.mjs`, `misc.mjs`
  (MODE clock / post / nextbuy / tab / faultfind / pulses), `screencast.mjs` (CDP screencast, about 9 fps), `spots.cjs`, `crop.py`,
  `grid.py`, `diff.py`, `pokeboard.py`; `run2.sh`, `run2b.sh`, `run3.sh`, `run4.sh`).

| area (A16) | verdict | fixes |
|---|---|---|
| Splice objects, era I-II art (dead, woken) | PASS | — |
| Splice whole frames (postgame) | FAIL | F7 |
| Placements and composition, UI 150 | FAIL | F5, F6 |
| Lines (geometry) | PASS | — |
| Lines (pixel width, pulses, wake beat) | FAIL | F3, F4 |
| Clock tick (C6) | PASS | (poke: F10) |
| Payphone ring after its Splice | FAIL | F13 |
| Tooltip (4 lines, UI 100 / 150, crank clear) | PASS | F15 (S3) |
| Hover brackets and click areas | FAIL | F1, F17 (S3) |
| Find marker, items, glint, ring, popups, fault, HUD | FAIL | F2, F14 |
| Poke answers, eras I-V | FAIL | F9, F10, F11, F12, F18 (S3) |
| Crow hop | PASS (arc); FAIL (perch heights) | F8 |
| 1080p, 720p, Deck at UI 150 | FAIL (through F5, F14) | — |
| Reduced motion | PASS | F19 (S3) |
| NEXT BUY, SPLICES tab | PASS | F16 (S3) |
| Store shots | changed, re-approve after the fixes | — |
| Demo :4177 | PASS | — |

**1. Splice objects** — art PASS; placements FAIL at UI 150; whole frames never shown.

Dead and woken frames were checked at e1 (S7), s8, s8w (Capacitor Bank) and s9 (S9), and at s11 / s15 (zoom 0.5).
- Art:
  - Bicycle: the rear wheel spins backwards and the pedals follow.
  - Organ: the side crank turns.
  - Radio: the dial glows at 2 fps.
  - Sign: half the bulbs swap.
  - Clock: the lit face sits under the hands.
  - Every object reads at 1:1, at 3x, and at zoom 0.5.
  - Palette: 18 / 14 colours. The only cool tones are `#5a5f63` and `#7d8286` from the ART_BRIEF iron ramp; no blue or green. No letters
    on the sign.
  - Boards: `crops/e1-woken-loops-x4.png`, `crops/s9-woken-objects-x4.png`, `crops/s11-s15-objects-x3.png`.
- Placements are clear of every machine part and of the crank at both UI scales.
- UI 150: the measured HUD-button rects (`uiclear/uiclear-*.json`) are the same in game px at 1080p, 720p and Deck.

  | framing | buttons at UI 150 | UI 100 |
  |---|---|---|
  | s8 | x 2136-2680, G-9 .. G+48 | G+90 .. G+128 |
  | s8w | x 2170-2728, G-9 .. G+48 | — |
  | s9 | x 2269-3013, G+25 .. G+101 | G+232 .. G+283 |
  | s10 | x 2132-2876, G-12 .. G+64 | — |

  AD1's `SPLICE_YARD_LIMITS` used the UI 100 camera. Covered parts at UI 150:
  - s8 bicycle 39 %;
  - s8w bicycle 50 %;
  - s9 Bulb Sign 88 %. The DOM button also takes its hover, so it cannot be bought in the world.
  - s8 radio 95 % below the screen edge;
  - booth / clock feet 4-10 % (existing props, as in v0.11.0).

  Boards: `crops/AD2-ui150-hud-covers-splices-x2.png`, `crops/AD2-ui150-deck-s9.png`, `crops/AD2-s8-ui150-radio-offscreen.png` → F5, F6.
- s8w, every UI scale: the dog sits on the bicycle. Its feet are at G+32 and the handlebars at G+33, and when it walks its spots, the
  bicycle covers its feet. Board: `crops/s8w-right-dead-woken-x3.png` → F5.
- Finale and postgame: every ending frames as `portrait` (`LivingWorldDirector.ts:1253`), and `SPLICE_WORLD` has no `portrait` placement.
  - The organ, radio and bicycle vanish on screen the frame the finale starts (`crops/finale-start-vs-pre.png`).
  - The postgame shows none, and `spliceStats()` is `[]` (`misc2/post-postgame.png`) → F7.

**2. Lines and pulses** — geometry PASS; pixel width, era I pulse and scaling FAIL.
- Geometry PASS:
  - Each line starts at the outer base foot of its side (e1 2316, s9 mast 2808), never crosses the machine, and runs behind the yard objects
    and the dog.
  - The s9 drop wire hangs from the mast top to the booth gable with an 8 px sag.
  - Stakes stand every 48 px.
- The wire, the cable, its top edge and the drop wire are 1 world px, which is half an art px (PIXEL_SCALE 2). The house rule is one art px
  (PylonLine `PIXEL_SCALE`, `PYLON_LINE.thicknessPx` 2).
  - At 1080p zoom 1 they are 1-2 px against 3 px art pixels.
  - At zoom 0.5 (s11, s15) they break into dashes.
  - Boards: `crops/s8-left-dead-woken-x3.png`, `crops/s11-s15-objects-x3.png`, `crops/poke-s11-crow-x2.png` → F3.
- Era I pulse: a 1 world px `#a3a6a4` glint on the `#7d8286` stake cap. Frame diffs over 2 s find 1-2 changed px per line, and the wake
  beat shows no travelling light (`crops/e1-bikeline-seq-x4.png`, `crops/wake-beat-bicycle-x3.png`, screencast frames 5-15) → F3.
- Era II pulses read: 2x2 art px `#c98552` dots on the cable and the drop wire (`crops/s9-right-dead-woken-x3.png`).
- Scaling (`misc/pulses.txt`): every era I-II line draws 2 pulses at S7 (ME 91/s), S9 (ME 784, EE 130) and S11 (ME 784, EE 260). Only the
  speed moves (109 → 122 px/s). Computed from the era V HUD rates (ME 20.6K/s, EE 43.3K/s): 3 pulses; 4 never shows → F4.
- Reduced motion: pulses 0; the woken frames hold.
  - The era II steady dot shows under the radio crate.
  - The era I dot is 1 px under the bicycle, so it is invisible (`crops/rm-e1-s9-line-ends-x4.png`) → F3, F19.

**3. Clock and payphone**
- Clock C6: PASS.
  - Screencast at e1, 16 s: three ticks 7.4-7.6 s apart, each about 2 frames (≈ 250 ms). Each changes 6 px of the hand and snaps back.
  - The 4:41 rest frame is the same before and after (`screencast/`, `crops/clock-tick-x8.png`).
  - The tick is a 1 px flick at the rim: per spec, subtle.
  - A poke on the woken clock answers `objOrgan` and does not tick → F10.
- Payphone after its Splice: no 60-120 s ring exists. The only rings are WP24's ambient 300-480 s (`worldBehaviour.ts:119`), and nothing in
  the director or the props reads `splicePayphone` except the drop-wire perch → F13 (code, T13b2 partial).

**4. Tooltip and brackets**
- Tooltip PASS.
  - Four lines: `SPLICE · NAME` / cost / effect / state. The 14 px slab is 21 px at UI 100 and 31.5 px at UI 150 on 1080p, and readable.
  - Placed above the object and clamped to the screen.
  - Clear of the crank circle in 26 of 27 cases (`hover2/hover-e1-s8-s9-1920x1080.json`).
  - The exception: s8 UI 150 locked radio. Its 781 px state line (`LINE NOT IN REACH · 34.7 / 200K LIFETIME EE`) reaches 59 px from the
    hub (circle 144) → F15 (gone with F5, but the rule is width-blind).
- Hover and click: FAIL (F1).
  - `PokeLayer` creates its Zones with Phaser's default origin 0.5 and places them at the target's top-left (lx, ly). The live hit area is
    therefore centred on that corner, and `checkHover` drops any pointer outside the intended box.
  - Measured on all 11 e1 targets: the centre hits; (0.25 w, 0.75 h) misses (`tools/hoverdbg2.mjs`).
  - The payphone and the lamp never hover: their quarter lies under the next zone (`hover2/*.json`).
- Brackets: drawn 2 art px outside the ≥ 56 game px zone, not the sprite.
  - Small targets get a loose frame.
  - The Inspector sits about 12 px right of centre.
  - The s9 girl-mini box frames the machine's motor (`crops/hover-e1-cast-x2.png`, `crops/hover-s9-x2.png`) → F17 (S3).

**5. Finds** — art PASS; depth and UI 150 FAIL.
- Art and text:
  - 12 forced Finds at e1 show cells 0-6 and the folded-note relic at serials 4 and 9.
  - The 3-frame glint ping-pong reads, and the ring breathes.
  - Glint and ring follow C8 per era: I `#ddc9a3`; III-IV `#ffd27a` with an amber ring; V paper with a violet ring
    (`crops/finds-e1-items-x4.png`, `crops/finds-eras-glint-x4.png`).
  - Popups: `FOUND +4s` / `+6s` / `+8s`, one per spread (`finds/*.json`). A relic shows no gain block and the note announcement
    (`Field note: Bread, lamp oil, string. Ask about the dog.`).
  - Demo: the same, relic 1 at serial 4 (`demo/`).
- Fault, Find, crank block and output popup all alive at s9: no overlap. The fault plate is over the flywheel and the Find is in a wing
  (`misc2/faultfind-1.png`).
- Depth: `FindMarker` sets its container depth to `0.01 × lane` as a top-level object (`FindMarker.ts:465`), below the back row (depth 5).
  - The curb strip draws over the e1 gust item (lane 12) (`crops/finds-e1-gust-x3.png`).
  - A line crossing a spot draws over the item.
  - → F2.
- UI 150 (`finds150/`, `tools/spots.cjs`):
  - s8 crow spot (2656, 26): under SYSTEM.
  - s9 dog spot (2866, 72): under SYSTEM.
  - s9 crow spot: the ring touches the button top.
  - s10 (2870, 54): under the buttons.
  - s8w: no spot inside the 32 px view inset (the bottom is G+72), so `forceFind` ×3 spawned nothing; s8w Finds are frozen at UI 150.
  - At UI 100, s8w ground (1500, 104) is 4 px outside the left inset and s8 ground (1452, 120) is below the bottom inset.
  - Board: `crops/finds-ui150-underbutton-x2.png` → F14.

**6. Pokes** — ladder PASS; answers FAIL.
- Every target was poked 8 times per era: L1, L1, reset, then quick L1, L1, L2, L3 and two unavailable.
  - Eras: e1 (I), s9 (II), s11 (III), s13 → s11 framing (IV), s14 → s11 framing (V).
  - Results: `pokes3/pokes-*.json`, boards `crops/poke-<era>-<target>-x2.png`.
- PASS:
  - L1 bags vary.
  - L2 = `insNoted` / `dogWoofs` / `crowCaws` / `payHood`.
  - L3 = `insLeave` / `dogTrot` / `crowHopBeat`.
  - The unavailable window alternates its two wordless answers.
  - Era IV gives one accent frame each, with no walk and no hop (the crow rises 1 art px: 1564 → 1562).
  - Era V uses stare frames.
  - The girl's x never changes (e1-s11 window / mini, s13 / s14 ground 880 / 976).
  - Answer frames take `restFlip` (Inspector flipped on the left wing, dog unflipped on the right).
  - Sensor 7 never shows `glyphOne` or `headUp`.
  - Reduced motion: one held frame of ≤ 600 ms, no walk, no hop (`pokes-rm/`).
- FAIL:
  - Woken Splice objects (F10). The `object` table is one bag per era, so every object answers with that era's objects at random:
    - e1: the bicycle plays the organ;
    - era II: everything crackles or buzzes;
    - era III: the bicycle whistles;
    - era IV: bell / gramophone;
    - era V: vane / kite / cairn.
    The default case draws nothing (`LivingWorldDirector.ts`, `playAnswer`). Once woken, the payphone and the clock lose their own answers
    (ring, tick): the Splice zone covers the prop zone.
  - Girl window / mini (eras I-III, cycle 1): `poke('girl')` returns null. `pokeKeyOf` needs `placements.girl`, which is null for the
    window and the mini, yet the target shows brackets and a hand cursor → F11.
  - Level-3 leaves go to the spot farthest from the actor, which is the inner one:
    - dog e1 2388 → 2340 (24 px from the machine foot 2316);
    - s9 2856 → 2832;
    - s11 2880 → 2832;
    - Inspector s11 792 → 840.
    They walk facing the machine (A13 [R1]) → F12.
  - Era V: Inspector 792 → 840 and dog 2832 → 2880 play profile `walk` frames during the stare → F9.
  - Sensor 7: every clip plays `sensorBlink` + `turnToCamera`; the L2 lens glint is never drawn → F18 (S3).
- Sensor 7 follows the pointer:
  - `headC` within ±200 world px of the tripod, `headR` beyond, back to the camera head 3 s after the pointer stops.
  - At e1 the tripod is 104 px from the left edge, so `headL` cannot show. Per plan.

**7. Crow hop** — arc PASS; perches FAIL (F8).
- Arc PASS (`pokes3`, `crowperch/`):
  - lamp 2476 → booth 2420 (e1);
  - 2996 → 2944 (s9);
  - 3104 → 3050 (s11, s14).
  - Then booth → clock (G-88) → drop wire (2864, 1531 = on the catenary) → lamp.
  - Apex 38-40 px above the higher end (≤ 48); about 530 ms in flight.
  - Never over the machine x-range; flipped toward the travel direction in flight; lands unflipped with one `ruffle`.
  - Era V plays fly2 → fly0 (reverse). Era IV: no hop. Reduced motion: no hop.
- Perches:
  - The `lampTop` landing is G-116 (1564), but the crow rests at G-112 (1568, the lamp's top opaque row 4 of 60). After a hop back to the
    lamp it floats 4 px over the finial.
  - The booth's top opaque row is 1 of 52 (G-102), and the perch is G-104.
  - Board: `crops/crow-perches-x3.png`.

**8. NEXT BUY and SPLICES tab** — PASS.
- NEXT BUY: `NEXT BUY: GEAR RATIO · ~5S` / `COPPER WINDING · ~5S` sits on one line at UI 100 / 125 / 150 on 1080p, 720p and Deck 1280x800.
  `scrollWidth = clientWidth` (201-243 CSS px), and the dim colour sits under the goal (`misc2/nextbuy-*.png`).
- SPLICES tab:
  - Rows are readable: SPLICED rows filled, IN REACH rows outlined, DARK rows dim with the lifetime progress.
  - The detail and the PURCHASE button work.
  - At UI 150 the tab wraps onto its own row and the list scrolls.
  - Demo: rows III-V read `FULL GAME`, and tabs III-V read `FULL GAME`.
  - Each row is its own grid with `auto` columns, so the state / cost text starts at a different x on each row (510-524 px) → F16 (S3).
  - Shots: `misc/tab-splices-ui100-1920x1080.png`, `-ui150-`, `demo/tab-*`.

**9. Store shots** — `store-shots.mjs SIZES=1080`: 126 checks, fail [], errors []; `_no_find` passes.
- Against WP27 AD3 `ad3/store/1080`:
  - 02 era I full: 3.0 % / 3.2 %;
  - 03 era II: 2.0 % / 4.8 %;
  - 04 era III: 1.0 % / 1.4 %;
  - 06 era IV: 1.0 % / 1.7 %;
  - 07 era V: 1.3 % / 1.7 %.
- The dead organ, radio, bicycle and sign now stand in the yard, and the HUD numbers follow the REC data (`crops/AD2-store-old-new-half.png`).
- 01, 05, 08, 08b and 10 are animation noise (≤ 1 %).
- 09 postgame is unchanged only because of F7; it changes with F7. The set is re-approved in round 2.

Notes (no fix):
- N1: the 4:41 hands read as a dark curved bar on the lit orange face. They are the existing WP23 hands; later polish.
- N2: the lines pass behind the sitting dog at e1, s8 and s9. The depth is correct (the dog sits in front of the cable); accepted.
- N3: at s9 UI 150 the bicycle sits between SYSTEM (1 px under it) and the screen edge (3 px). Visible, but cramped.
- N4: era IV girl: `tilt` shows about 1 s after an L3. The code defers the pose to an unseen moment (`unseenMoment`), so this is her own
  runner; re-check in round 2.
- N5: the e1 lamp is dead in era I, so its poke is a sound only (plus the crow ruffle when the crow sits on it). Per plan.

Fix list (DATA = `src/data` numbers for T18; CODE = EM call, the spec is exact; CSS within budget):

| F | sev | kind | file | key | old -> new |
|---|---|---|---|---|---|
| F1 | S1 | CODE | `src/game/rendering/PokeLayer.ts` | constructor, zone | `scene.add.zone(0, 0, side, side).setScrollFactor(0)` -> `scene.add.zone(0, 0, side, side).setOrigin(0, 0).setScrollFactor(0)` (the zone box then equals the target box the brackets and `checkHover` use) |
| F2 | S2 | CODE | `src/game/rendering/FindMarker.ts:465` | container depth | `FIND_LAYOUT.yardDepth * spot.lane` -> `DEPTH.machine + 3 + FIND_LAYOUT.yardDepth * spot.lane` (the Splice yard convention, `SpliceProps.ts:52`) |
| F3 | S2 | DATA | `src/data/spliceWorld.ts` | `SPLICE_LINE_STYLE` | `era1.wireWidthPx` 1 -> 2; `era1.glintWidthPx` 1 -> 4; `era1.glintColor` `0xa3a6a4` -> `0xddc9a3`; `era1.reducedDotColor` `0xa3a6a4` -> `0xddc9a3`; `era2.cableWidthPx` 1 -> 2; `drop.widthPx` 1 -> 2 (one art px; the glint lights the whole 2x2 art px stake cap in the era I accent) |
| F4 | S2 | DATA | `src/data/worldReach.ts` | `REACH_LEVEL` | `lo.me` 1 -> 10; `hi.me` 3e5 -> 3e4; `hi.ee` 1e6 -> 1e5 (computed pulses: S7 1, S9-S11 2, era V 3, past 30K ME/s 4; EE: S8 1, S9-S11 2, era V 3) |
| F5 | S2 | DATA | `src/data/spliceWorld.ts` | `SPLICE_WORLD` placements | `spliceBicycle.s8` `{2668, 62}` -> `null`; `spliceBicycle.s8w` `{2700, 63}` -> `null`; `spliceRadio.s8` `{1506, 110}` -> `null`; `spliceSign.s9` `{2990, 76}` -> `{ x: 2954, lane: 22 }` (in front of the booth: box 2928-2984 x G-22..G+22, clear of the dog band 2820-2892, the clock by 12 px and the crow Find spot by 8 px; above the UI-150 buttons). Test `spliceWorld.test.ts`: `SPOT_2D_CLEARED` drops `'spliceBicycle s8w'`; the 4 px object test exempts the pair `spliceSign s9 / splicePayphone s9` (front-of-booth layering) |
| F6 | S2 | DATA | `src/data/spliceWorld.ts` | `SPLICE_YARD_LIMITS`, `SPLICE_HUD_RECT` | limits: `s8` 63 -> -9, `s8w` 63 -> -9, `s9` 196 -> 25, `s10` 56 -> -12 (the measured UI-150 button tops; e1 119, s11 158, s15 10 hold); rect min: `s8w` 2180 -> 2170, `s9` 2283 -> 2269, `s11` 2058 -> 2037, `s15` 2056 -> 2035 |
| F7 | S2 | DATA | `src/data/spliceWorld.ts` | `SPLICE_WORLD` placements | add `portrait` = the s15 rows: bicycle `{3150, 'back'}`, organ `{718, 56}`, clock `{2890, 'back'}`, radio `{690, 100}`, payphone `{3050, 'back'}`, sign `null` |
| F8 | S2 | DATA | `src/data/pokes.ts` | `CROW_PERCHES` (e1, s8, s8w, s9, s11, s15) | `lampTop.y` `GROUND_Y - 116` -> `GROUND_Y - 112`; `boothRoof.y` `GROUND_Y - 104` -> `GROUND_Y - 102` |
| F9 | S2 | DATA | `src/data/pokes.ts` | `INS_V.leave`, `DOG_V.leave` | `'leaveWrite'` -> `null`; `'leaveSit'` -> `null` (era V level 3 plays its l3 stare clip in place, as era IV) |
| F10 | S2 | DATA+CODE | `src/data/pokes.ts`, `src/game/math/pokes.ts`, `LivingWorldDirector.ts`, `SpliceProps.ts` | `object` table | DATA: one table per Splice object instead of the per-era bag. Bicycle l1 `[objBicycle bell 800, objBicycleSpin tick 600]`; organ `[objOrgan organ 1200, objOrganPuff tick 600]`; radio `[objRadio crackle 1200, objRadioDial tick 600]`; sign `[objSign buzz 900, objSignFlicker tick 600]`; unavailable = the two sound variants. CODE: `tableKeyOf('object:<id>')` -> that id's table; `playAnswer` routes `spliceClock` to the clock answer (`clockTickOnce`) and `splicePayphone` to the payphone answer (ring / sway / hood); `SpliceProps` draws the 1-frame twitch (the default case draws nothing today) |
| F11 | S2 | CODE | `LivingWorldDirector.ts` | `pokeKeyOf('girl')` | `p.girl === null ? null` -> key from the girl's stage (window / mini / ground) whenever her anchor is on screen |
| F12 | S2 | CODE | `LivingWorldDirector.ts` / runner `interrupt` target | level-3 leave spot | the spot farthest from the actor -> the outer spot (the one farthest from the machine x); never the inner spot, so the walk faces away (A13 [R1]) |
| F13 | S2 | CODE | `LivingWorldDirector.ts` (T13b2 scope) | payphone Splice ring | add the 60-120 s ring after `splicePayphone` (hash interval, receiver jump, ring burst, nobody on the line; WP28 Splice table #5) |
| F14 | S2 | CODE+DATA | `src/game/rendering/FindMarker.ts`; `src/data/findWorld.ts` | spot eligibility; `FIND_SPOTS` | CODE: a spot whose item box meets the HUD-button rect (DOM at the current UI scale, as `PokeLayer` reads `#ui-root`) counts as off screen. DATA: `s8w` `(1500, 104)` -> `(1508, 104)` and add `{ x: 1556, lane: 30, producer: 'ground' }`; `s8` ground `(1452, 120)` -> `(1452, 100)`; `s9` add `{ x: 2904, lane: 20, producer: 'dog' }` |
| F15 | S3 | CODE | `PokeLayer.ts` | tooltip placement | test the full slab rect (after its width) against the crank circle + clearance; flip below or shift sideways |
| F16 | S3 | CSS | `src/ui/techTree.css` | `.tech-splice-row` | `grid-template-columns: 1.2fr auto auto 2fr 1.4fr` -> `1.2fr 7.5em 6.5em 2fr 1.4fr` |
| F17 | S3 | CODE | `PokeLayer.ts` / director targets | brackets | bracket the sprite's opaque box (feet / head of the director's anchor), keep the zone ≥ 56 screen px |
| F18 | S3 | CODE | `LivingWorldDirector.ts` | Sensor 7 answer | draw `lensGlint` for the L2 / L3 clip (one 150 ms glint) and the LED solid for 3 s; L1 stays the double blink |
| F19 | S3 | CODE | `SpliceLines.ts` | `drawSteady` | the reduced-motion dot at the last stake (era I) or 12 px before the end, not at the object's feet under its sprite |

```
WP28A-AD2-FIX-BEGIN
F1  CODE  src/game/rendering/PokeLayer.ts zone setOrigin(0, 0)
F2  CODE  src/game/rendering/FindMarker.ts container depth = DEPTH.machine + 3 + yardDepth * lane
F3  DATA  src/data/spliceWorld.ts SPLICE_LINE_STYLE era1.wireWidthPx 2 glintWidthPx 4 glintColor 0xddc9a3 reducedDotColor 0xddc9a3 era2.cableWidthPx 2 drop.widthPx 2
F4  DATA  src/data/worldReach.ts REACH_LEVEL lo.me 10 hi.me 3e4 hi.ee 1e5
F5  DATA  src/data/spliceWorld.ts spliceBicycle.s8 null spliceBicycle.s8w null spliceRadio.s8 null spliceSign.s9 {2954,22} (+ spliceWorld.test.ts exemptions)
F6  DATA  src/data/spliceWorld.ts SPLICE_YARD_LIMITS s8 -9 s8w -9 s9 25 s10 -12 ; SPLICE_HUD_RECT min s8w 2170 s9 2269 s11 2037 s15 2035
F7  DATA  src/data/spliceWorld.ts portrait placements = s15 rows
F8  DATA  src/data/pokes.ts CROW_PERCHES lampTop.y G-112 boothRoof.y G-102
F9  DATA  src/data/pokes.ts INS_V.leave null DOG_V.leave null
F10 DATA+CODE per-object poke tables; spliceClock/splicePayphone route to the prop answers; SpliceProps twitch
F11 CODE  LivingWorldDirector.pokeKeyOf girl by stage
F12 CODE  level-3 leave to the outer spot
F13 CODE  payphone Splice ring 60-120 s
F14 CODE+DATA FindMarker skips spots under the HUD buttons; FIND_SPOTS s8w (1508,104) + (1556,30) ; s8 (1452,100) ; s9 + (2904,20 dog)
F15 CODE  PokeLayer tooltip full-rect crank test (S3)
F16 CSS   src/ui/techTree.css .tech-splice-row columns 1.2fr 7.5em 6.5em 2fr 1.4fr (S3)
F17 CODE  brackets on the sprite box (S3)
F18 CODE  Sensor 7 L2 lens glint (S3)
F19 CODE  SpliceLines steady dot off the object's feet (S3)
WP28A-AD2-FIX-END
```

Round 2, on the gate builds after the fixes:
- `hoverdbg2.mjs` + `hover.mjs` (F1: every quarter of every target).
- `finds.mjs` e1 (F2).
- `frames.mjs` e1 / s9, + s11 / s15 crops (F3).
- `misc.mjs MODE=pulses` + S7 (F4).
- `uiclear.mjs` all framings at UI 100 / 150 (F5, F6).
- `misc.mjs MODE=post` (F7).
- `crowperch.mjs` e1 / s9 (F8).
- `pokes.mjs` e1 / s9 / s14 (F9-F12).
- `misc.mjs MODE=clock SECS=130` (F13).
- `finds.mjs` s8 / s8w / s9 at UI 150 (F14).
- `store-shots.mjs` (02, 03, 04, 06, 07, 09).

### AD2 — WP28a in-game audit, round 2 (Art Director, 2026-10-29; workflow round 0)

**Verdict: NOT RELEASE-READY (one S2, data + small code).** Round 1 F1-F19 all land: F1-F18 PASS, F19 PASS for era II and partial for
era I. The one blocker is new and sits in the postgame only (F20): the whole bicycle is lost in the regrowth bush (and under SYSTEM at
UI 150), and the postgame dog sleeps inside the organ. Store shot 09 shows both. Two S3 items (F21, F22) are cheap polish. Everything else
in A16 passes at 1080p, 720p and Deck 1280x800, at UI 100 and 150, and in reduced motion. Canon holds.

Build under audit: the gate builds of the current tree.
- `dist/` 2026-10-29 11:27:34 and `dist-demo/` 11:27:51 (es2022, r5-F1). No file under `src/`, `public/` or `vite.config.ts` is newer.
- Served with `vite preview` on :4174 (dist) and :4177 (dist-demo). Both were killed after the runs, netstat shows 4174 / 4177 free, and no
  node or browser process is left.
- One Playwright browser at a time. 1920x1080 unless stated.

Evidence root `<R>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28a/ad0/`.
- Runs: `hd3/`, `hover/`, `frames/`, `frames-rm/`, `uiclear/`, `finds/`, `finds150/`, `finds-eras/`, `finds-rm/`, `misc/`, `crowperch/`,
  `pokes/`, `pokes-rm/`, `post150/`, `store/`, `demo/`; logs in `logs/`.
- Boards: `crops/`.
- Tools: `tools/`. These are the round 1 tools, plus `hoverdbg3.mjs` (5 points per target) and `post150.mjs` (the postgame at UI 100 /
  150, 1080p and Deck, with the cast and prop dump). `run1.sh`, `run2.sh` and `run3.sh` replay everything.

| area (A16) | verdict | evidence (`<R>`) |
|---|---|---|
| Splice objects, era I-II, dead and woken | PASS | `crops/e1-left-dead-woken-x3.png`, `crops/e1-right-dead-woken-x3.png`, `crops/s9-left-dead-woken-x3.png`, `crops/s9-right-dead-woken-x3.png` |
| Splice whole frames | FAIL (postgame, F20) | `crops/post-whole-x4.png`, `crops/store09-corners-x4.png`, `crops/F20-before-store09-organ-dog-x6.png`, `crops/post-ui150-corners-x3.png` |
| Placements, UI 100 / 150, 1080p / 720p / Deck | PASS (N3 kept) | `uiclear/uiclear-*.json`, `crops/ui150-s9-s8-1080-720-deck-x2.png` |
| Lines (1 art px, zoom 0.5) and pulses | PASS | `crops/e1-left-pulse-seq-x2.png`, `crops/s11-s15-objects-x3.png` |
| Reduced motion | PASS; F22 (S3) | `crops/rm-e1-s9-line-ends-x4.png`, `crops/rm-dot-hidden-x6.png` |
| Hover zones, brackets, tooltip | PASS | `hd3/*.json`, `hover/*.json`, `crops/hover-e1-ui100-board.png`, `hover/s9-ui150-1920x1080-full-tip-spliceSign.png` |
| Finds: items, glint, ring, eras I-V, UI 150 | PASS; F21 (S3) | `crops/finds-e1-items-x3.png`, `crops/finds-eras-glint-x3.png`, `crops/finds-ui150-near-buttons-x2.png`, `crops/finds-e1-gust-x6.png` |
| Pokes e1 / s9 / s14 at 1:1 and 3x, plus RM | PASS | `pokes/pokes-*.json`, `crops/poke-e1-*-x2.png`, `pokes-rm/` |
| Crow hop and perches | PASS | `crowperch/*.json`, `crops/crow-perches-x3.png` |
| Clock tick, payphone ring | PASS | `misc/misc-clock-1920x1080.json`, `crops/poke-clock-face-x8.png` |
| SPLICES tab, UI 100 / 150 | PASS | `misc/tab-splices-ui100-1920x1080.png`, `misc/tab-splices-ui150-1920x1080.png` |
| Store shots | 01-08 approved; 09 FAIL (F20) | `store/1080/`, `crops/store-03-04-06-07-half.png` |
| Demo :4177 | PASS | `demo/` |

**Round 1 fixes, checked in game**

| F | result | what was seen |
|---|---|---|
| F1 | PASS | `hoverdbg3` (centre plus 4 inner points per target): e1 UI 100 / 150, s9 UI 100, and s9 UI 150 on Deck. Every centre hovers its own target. A quarter misses only where a neighbour's zone lies in front, as drawn: sign over booth, clock and lamp at e1 / s9, dog / clock at s9. At s8 UI 100 the girl-mini zone covers the Inspector's centre by 1 px, and the s8 lamp hovers only in a 30 px strip left of the clock zone (N6). |
| F2 | PASS | The e1 gust item (lane 12) draws over the curb strip. Items draw over the lines. |
| F3 | PASS | Wire, cable and drop wire are one art px: 3 px at 1080p zoom 1, and continuous at zoom 0.5 (s11, s15). The era I glint lights the stake cap in `#ddc9a3` and hops stake to stake toward the object (8 frames, 250 ms apart). |
| F4 | PASS | Pulses per line: S7 1, s8 1, s8w 2, S9 2, S11 2, era V (s15) 3. |
| F5, F6 | PASS | uiclear: 7 framings x 1920x1080 / 1280x720 / 1280x800 x UI 100 / 150. Every placed Splice object is 100 % in view. The only objects under buttons are the props there since v0.11.0 (s8 clock 4-5 %, s8 / s8w / s10 booth 7-10 %) and the s9 bicycle at UI 150 (3 %, N3, `HUD_EXEMPT`). The s9 sign stands in front of the booth and clears SYSTEM by 6 px. |
| F7 | PARTIAL | The objects stay through the finale start (lines on) and show their whole frames in the postgame (lines off, `spliceStats` live). The postgame placements fail: see F20. |
| F8 | PASS | The crow stands on the booth ridge (G-102), the clock finial (G-88) and the drop wire (2864, 1531). No float. |
| F9 | PASS | Era V level 3 (s14): `insVLeave` and `dogTrot` play in place, with no walk frames. |
| F10 | PASS | Each object answers from its own table (bicycle bell / spin, organ / puff, radio / dial, sign / flicker). The woken clock ticks (6 px hand flick, back to 4:41). The woken payphone plays ring, swing and hood. The twitch is one loop frame, so mostly sound (as specified). |
| F11 | PASS | Window `winDark` / `winFlicker` at e1, mini `miniDim` / `miniLow` at s9, ground note at s14. Her x never changes (window, mini, ground 976). |
| F12 | PASS | e1 Inspector 1472 → 1448 and s9 dog 2856 → 2880: outward, facing away from the machine. |
| F13 | PASS | The first Splice ring comes 98 s after the wake: ring0 / ring1 twice, nobody on the line. The ring at 126 s is the WP24 ambient ring (the Splice gap is at least 60 s). |
| F14 | PASS | At UI 150 the spots under the buttons are skipped. s8 spawns at the gust spot; s8w spawns at (1556, 30), so it is no longer frozen. The s9 crow spot and the dog spot (2904, 20) spawn above SYSTEM, with the ring touching the button top (1080p, 720p, Deck). |
| F15 | PASS | 79 tooltips, at 1080p, 720p and Deck, UI 100 / 150, dead and woken. All stay on screen; the nearest slab edge is 170 px from the crank hub (s9 organ, 720p UI 150). |
| F16 | PASS | State, cost and effect start at the same x on every row, at UI 100 and UI 150. |
| F17 | PASS | The brackets frame the sprite (cast, the window, the mini, the objects), no longer the 56 px zone. |
| F18 | PASS | The L2 / L3 clip starts with the amber lens pixel, then the LED holds solid. L1 is the double blink. |
| F19 | PARTIAL | The era II steady dot sits 12 px before the end (s9 radio and sign). The era I dot shows on the e1 organ line. It is hidden where the last stake falls under the object: the s9 organ, and the e1 clock (half hidden). See F22. |

**Other checks**
- Splice art: dead and woken read at 1:1, 3x and zoom 0.5. No blue or green and no letters.
  - The teal pixels in the s9 / s11 crops come from the existing mast insulator and the era II pylon line; the capacitor glass and the
    postgame sky are older still.
  - WP28a pixels stay in the warm ramp plus `#5a5f63` / `#7d8286`.
- Finds, eras I-V: e1 shows items 0-6, the folded note at serials 4 and 9, and popups `FOUND +4s` / `+6s` / `+8s`.
  - Glint and ring per era: III-IV amber glint with an amber ring, V paper glint with a violet ring.
  - Reduced motion: the glint holds and the ring shows.
  - The relic note "Clock on the corner stopped at 4:41 again." keeps the canon.
- Pokes: e1, s9 and s14 (eras I, II and V), plus reduced motion at e1.
  - Every answer frame is one of the actor's own frames.
  - Reduced motion: no walk, no hop.
  - Sensor 7 never shows `glyphOne` or `headUp` in an answer. Its idle head is `headR`, as in round 1.
- Crow hop arc: e1 2476 → 2420, s9 2996 → 2944, s14 3104 → 3050. The apex is about 36 px above the higher end and the flight takes about
  470 ms. It flips toward the travel direction, then lands unflipped and ruffles.
  - Closest x to the machine: e1 2420 (right foot 2316), s9 2864 (mast 2808). Never over the machine.
- Clock: the rest frame stays 4:41 before and after every tick.
- Store shots (`SIZES=1080`): 126 checks, `fail []`, `errors []`.
  - Difference against round 1 / WP27 AD3: 02 3.2 / 3.4 %, 03 4.7 / 2.0 %, 04 1.1 / 1.3 %, 06 1.2 / 1.6 %, 07 1.6 / 1.7 %, 09 1.6 / 2.2 %.
  - 02-07 show the dead organ, radio, bicycle and sign in the yard, plus the WP27 release popup.
  - 01-08 are re-approved. 09 waits for F20.
- Demo (:4177): frames e1 / s9 woken (pulses 1 / 2); Finds s9 (relic 1 at serial 4); the SPLICES tab shows rows III-V as `FULL GAME`.
  `errors []`.

**New items**
- **F20 (S2, postgame)**: `misc/post-postgame.png`, `post150/post-*.png`, `store/1080/09-postgame-portrait-clean.png`.
  - The postgame frames as `portrait`, whose cells are the s15 rows (round 1 F7).
  - Bicycle at 3150 back: it draws in front of the regrowth strip (all 150 opaque pixels match at Deck 1:1). The bush behind shows through
    its wheels, and the dark outlines merge, so it does not read.
  - At UI 150, SYSTEM (1685-1884 x 961-1044) covers its left half. At 1280x800 UI 150 it is under SYSTEM too.
  - The right wing has no free spot: VIEW MACHINE and SYSTEM cover every yard lane from x 2113 to 3115; the back row holds the clock, the
    anchor, the booth and the lamp.
  - Organ at 718, lane 56 (box 690-746, G+8..G+56): the postgame dog home is 732 at G+32 (chase 732-768), and the Inspector pats at 742, so
    the dog sleeps inside the organ (store 09).
  - The plan keeps objects and lines as they are through the finale film. So the fix is a postgame-only placement (lines are off there),
    not a new portrait cell.
  - Mock (sheet cells pasted at the new feet): `crops/F20-mock2-postgame-left-ui100-x3.png`, `-ui150-x3.png`. Radio 674-706, bicycle
    718-770, organ 782-836: a row at G+52..G+104, 20 px or more below the dog band, clear of the pillar mound, inside the G+120 frame bottom.
- **F21 (S3)**: the e1 and s9 gust Find spot (1410) sits on the cream scrap at 1420. The era I-II glint (`#ddc9a3`) is the scrap colour,
  so the ping is lost (`crops/finds-e1-gust-x6.png`, `crops/finds-eras-glint-x3.png` s9 tile). The gust producer stays "the scraps"; the
  item moves to just in front of the scrap.
- **F22 (S3, F19 rest)**: era I stakes stand every 48 px up to the object's feet, so the last stake (the reduced-motion dot) can fall under
  the object. Stop the stakes 36 px short of the end. Measured: the e1 clock line's last stake moves 8 → 56 px from the foot; the s9 organ
  line's last stake moves 8.6 → 56.6 px (outside the organ's 27 px half width).

Notes (no fix):
- N1-N3 hold. N3: the s9 bicycle at UI 150 sits under SYSTEM, 2 px above the screen edge; visible and pokeable (exempt in the test).
- N6: hover zones overlap in the crowded wings. Every centre works except the s8 UI 100 Inspector (girl-mini zone, 1 px). Accepted.
- N7: at e1 / s9 a stake hides behind the sitting dog, and its glint shows in the transparent notch at the dog's chest. The depth is
  correct; accepted.
- N8: at postgame UI 150 the four buttons cover the booth foot and the clock base (props since v0.11.0).

| F | sev | kind | file | key | old -> new |
|---|---|---|---|---|---|
| F20 | S2 | DATA+CODE | `src/data/spliceWorld.ts`, `src/game/rendering/SpliceProps.ts`, `src/game/math/spliceWorld.test.ts` | `SpliceEntryBase.postgame`; `place()` | add `readonly postgame?: SplicePlacement`; `spliceBicycle.postgame = { x: 744, lane: 104 }`, `spliceOrgan.postgame = { x: 810, lane: 100 }` (radio, clock, payphone keep their portrait cells); SpliceProps places a record at `entry.postgame` while the postgame flag is on and re-places all records when the flag flips; test: postgame boxes inside x 648..848 and bottom <= G+112, 4 px apart from each other and the radio's portrait box, clear of the postgame dog band (`postgameDogHomeX` - 24 .. + 36 + 24, G-8..G+40) and the Inspector pat box (742 +- 20, G-66..G+32) |
| F21 | S3 | DATA | `src/data/findWorld.ts` | `FIND_SPOTS` e1 / s9 gust | e1 `{ x: 1410, lane: 12 }` -> `{ x: 1420, lane: 30 }`; s9 `{ x: 1410, lane: 16 }` -> `{ x: 1420, lane: 26 }` |
| F22 | S3 | DATA+CODE | `src/data/spliceWorld.ts`, `src/game/rendering/SpliceLines.ts` | `SPLICE_LINE_STYLE.era1.stakeEndInsetPx`; `makeLine` | add `stakeEndInsetPx: 36`; stake loop `d < len` -> `d < len - E1.stakeEndInsetPx` |

```
WP28A-AD2R2-FIX-BEGIN
F20 DATA+CODE src/data/spliceWorld.ts postgame placements bicycle {744,104} organ {810,100}; SpliceProps uses them in the postgame; spliceWorld.test.ts postgame guard
F21 DATA      src/data/findWorld.ts FIND_SPOTS e1 gust {1420,30} s9 gust {1420,26} (S3)
F22 DATA+CODE src/data/spliceWorld.ts era1.stakeEndInsetPx 36; src/game/rendering/SpliceLines.ts makeLine stops stakes 36 px short (S3)
WP28A-AD2R2-FIX-END
```

Round 3 (after F20-F22; F20 alone decides the verdict):
- `misc.mjs MODE=post`.
- `post150.mjs` (postgame at UI 100 / 150, 1080p and Deck).
- `store-shots.mjs SIZES=1080`: re-approve 09.
- `frames.mjs REDUCED=1 ONLY=e1,s9,s11` (F22; s11 is the street clock line that had no stake: its dot and glint stand on the new stake about 36 px from the clock foot). The AD tool's CASES list (`ad0/tools/frames.mjs`) holds e1, s8, s8w and s9 only and ONLY filters silently, so s11 would give no output and no error: AD2 adds `s11: [S11, SPL1]` first (`lib.mjs` exports both) and confirms the s11 files exist; the dot stands on the stake at about x 2854, clear of the clock box 2874-2906.
- `finds.mjs` e1 and s9 (gust crops, F21).
- KEEP click (EM round 2, deferred minor; canon C9, Q7 binding: relocations wait for an unseen moment): the ending frames as `portrait` from the finale on, so the world stays in view through `choice`, and `SpliceProps.setStates` re-places the records on the frame the phase turns `postgame` (the KEEP IT RUNNING click). The bicycle jumps from 3150 (right wing) to 744 lane 104 and the organ from 718 lane 56 to 810 lane 100 at the click, in view. `misc.mjs MODE=post` and `post150.mjs` shoot after the settle and do not see it. AD2 captures the click (a screencast from the click to KEEP + 2 s at 1080p) and records ACCEPT or a fix.
  - If a fix is ordered (code, EM then worker): hide both objects at KEEP and show them at the postgame feet with a short alpha fade inside the dog's hidden window (KEEP + `dogFade.toS` .. `dogEnter.fromS`, 4.5-7 s, while the crow beat holds the eye); a postgame placement delay in `SPLICE_FX`, applied by the director. That also clears the organ before the dog settles at 732 (KEEP + 8 s).

### AD2 — WP28a in-game audit, round 2 on the F20-F22 gate builds (Art Director, 2026-10-29; workflow round 2)

**Verdict: RELEASE-READY (A16).** I re-ran the full round 2 list (F1-F19, store shots) and the round 3 list (F20-F22, KEEP click) on fresh
gate builds of the current tree.
- F1-F22 hold.
- F20 (postgame) is fixed: the dog sleeps in the clear and the bicycle reads. Store 09 is re-approved.
- Two new S3 items do not block A16. Both have code specs (EM, then worker):
  - F23: in reduced motion, the steady dot of the radio line hides behind the radio crate at s9, s11 and s15. The s11 sign dot hides in
    its box. This corrects round 2, which passed the radio dot.
  - F24: at the KEEP IT RUNNING click, the bicycle and the organ jump to their postgame feet on a visible frame (canon C9). Fix: fade them
    out with the dog and fade them in during its hidden window.
- Canon holds:
  - the girl's x never changes;
  - no WP28a pixel is blue or green before the finale;
  - the sign has no letters;
  - the clock rests at 4:41;
  - denizens answer pokes and effects and never touch the machine;
  - level-3 leaves walk outward.

Build under audit.
- `npm run build` and `npm run build:demo` at 19:27 (exit 0).
  - The chunk hashes equal the 16:34 builds (`LivingWorldDirector-Dqg_9a4i`, `WorldReach-C5-HcyRF`).
  - No file under `src/`, `public/` or `vite.config.ts` is newer than `dist/`.
  - The dist chunks carry `postgame:{x:744,lane:104}`, `stakeEndInsetPx` and `x:1420,lane:30`.
- `vite preview` ran on :4174 (dist), then on :4177 (dist-demo).
  - Both were killed after use; netstat shows 4174 / 4177 free.
  - No node or browser process is left.
- One Playwright browser at a time, 1920x1080 unless stated.

Evidence root `<R2>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28a/ad2/`.
- Runs: `hd3/`, `hd4/`, `hover/`, `hold/`, `frames/`, `frames-rm/`, `frames-rm2/`, `uiclear/`, `finds/`, `finds150/`, `finds-eras/`,
  `finds-rm/`, `misc/`, `crowperch/`, `pokes/`, `pokes-rm/`, `keep/`, `post150/`, `dogprobe/`, `store/`, `demo/`; logs in `logs/`.
- Boards: `crops/`.
- Geometry: `geo/steady.ts` (bundled with esbuild).
- Tools: `tools/`. The round 2 tools, plus:
  - `frames.mjs` cases `s11`, `s11b` (S11 + every era I-II Splice) and `s15`;
  - `keepclick.mjs`: CDP screencast from KEEP - 1 s to KEEP + 12 s, with an rAF log of the Splice rows, the dog and the camera;
  - `hoverdbg4.mjs`: live target boxes, plus the element and the Inspector frame on a miss;
  - `hoverhold.mjs`: 150 samples on the s9 Inspector;
  - `dogprobe.mjs`;
  - `pokeall.py` and `wcrop.py` (world-box crops).
- `run1.sh`, `run2.sh`, `run4.sh` and `run5.sh` replay everything.

| area (A16) | verdict | evidence (`<R2>`) |
|---|---|---|
| Splice objects, era I-II, dead / woken | PASS | `crops/e1-left-dead-woken-x3.png`, `crops/e1-right-dead-woken-x3.png`, `crops/s9-left-dead-woken-x3.png`, `crops/s9-right-dead-woken-x3.png`, `crops/s11-objects-woken-t7-x3.png` |
| Splice whole frames (postgame) | PASS (F20 fixed); KEEP click F24 (S3) | `crops/F20-post-left-before-after-x4.png`, `crops/post-left-1080-deck-ui150-x4.png`, `crops/store09-left-before-after-x4.png`, `crops/keep-click-jump-left-right-x3.png` |
| Placements, UI 100 / 150, 1080p / 720p / Deck | PASS (N3 kept) | `uiclear/uiclear-e1-s8-s8w-s9-s10-s11-s15.json`, `uiclear/s9-1280x800-ui150.png` |
| Lines (1 art px, zoom 0.5), pulses, wake beat | PASS | `crops/e1-organ-line-pulse-seq-x2.png`, `crops/s11-objects-woken-t7-x3.png` |
| Reduced motion | PASS; F23 (S3) | `crops/rm-e1-line-ends-x4.png`, `crops/rm-s9-line-ends-x4.png`, `crops/F23-rm-radio-dot-hidden-s9-x6.png`, `crops/F23-rm-radio-dot-hidden-s11-s15-x6.png` |
| Hover zones, brackets, tooltip | PASS | `hd3/*.json`, `hd4/*.json`, `hold/hoverhold.json`, `crops/hover-e1-ui100-woken-cast-x3.png`, `crops/tip-s9-ui150-1080-sign-x2.png` |
| Finds: items, glint, ring, eras I-V, UI 150 | PASS (F21 fixed) | `crops/finds-e1-gust-after-x4.png`, `crops/finds-eras-glint-x3.png`, `crops/finds-s9-ui150-crow-dog-x3.png` |
| Pokes e1 / s9 / s14 at 1:1 and 3x, plus RM | PASS | `crops/poke-e1-all-t650-x1.png`, `crops/poke-e1-dog-x2.png`, `crops/poke-s9-objects-t650-x2.png`, `crops/poke-s14-cast-t650-x2.png`, `pokes-rm/` |
| Crow hop and perches | PASS | `crowperch/*.json`, `crops/crow-perches-x2.png` |
| Clock tick (4:41), payphone ring | PASS | `crops/clock-rest-tick-x6.png`, `misc/misc-clock-1920x1080.json` |
| SPLICES tab, UI 100 / 150 | PASS | `misc/tab-splices-ui100-1920x1080.png`, `misc/tab-splices-ui150-1920x1080.png` |
| Store shots | 01-09 approved (09 re-approved) | `store/1080/`, `crops/store-03-04-06-07-half.png`, `crops/store09-left-before-after-x4.png` |
| Demo :4177 | PASS | `demo/` |

**Round 1 and round 2 fixes, re-checked in game**

| F | result | what was seen |
|---|---|---|
| F1 | PASS | `hoverdbg3` / `hoverdbg4` at e1 UI 150, s9 UI 100 and s9 UI 150 on Deck: every centre hovers its own target. Corner misses come only from a neighbour's zone in front (sign over booth / clock / lamp, dog / clock; N6). One Inspector corner gave no hover per `hd3` run. `hoverhold` (150 samples) shows 1 miss, taken while the Inspector walked (`walk3`) between the box read and the pointer move. The zone follows the walker (tool artefact). |
| F2 | PASS | The e1 gust item draws over the curb strip and the lines. |
| F3 | PASS | 1 art px lines (3 px at 1080p zoom 1), continuous at zoom 0.5 (s11). The era I glint hops stake to stake in `#ddc9a3`. |
| F4 | PASS | Pulses per line: e1 1, s8 1, s8w 2, s9 2, s11 2 (`frames/frames-ui100.json`, `misc/misc-pulses-1920x1080.json`). |
| F5, F6 | PASS | `uiclear`, 7 framings x 3 views x UI 100 / 150: every Splice object is 100 % in view. Under buttons: only the props there since v0.11.0 (s8 clock 4-5 %; s8 / s8w / s10 booth 7-10 %) and the s9 bicycle at UI 150 (3 %, N3). |
| F7 | PASS | Postgame: whole frames on, lines off, `spliceStats` live. |
| F8 | PASS | The crow stands on the booth ridge (G-102), the clock finial (G-88) and the drop wire (2864, 1531). |
| F9 | PASS | s14 level 3: `insVLeave` and `dogTrot` play in place (`front`, `head` / `talk` only). |
| F10 | PASS | Each object answers from its own table. The woken clock ticks; the woken payphone swings, rings and shows its hood. |
| F11 | PASS | Window `winFlicker` / `winDark` (e1), mini `miniLow` / `miniDim` (s9), ground note (s14). Her x never changes. |
| F12 | PASS | e1 Inspector 1472 → 1448 and s9 dog 2856 → 2880, both outward. The e1 dog was already on its outer spot (2388). |
| F13 | PASS | The Splice ring comes 98 s after the wake (ring0 / ring1 twice). The ring at 126 s is the WP24 ambient ring. |
| F14 | PASS | UI 150: s8 spawns at the gust spot, s8w at (1556, 30), s9 at the crow and dog spots. Their rings touch the SYSTEM top at 1080p, 720p and Deck (as in round 2). |
| F15 | PASS | 79 tooltips at 1080p / 720p / Deck, UI 100 / 150, all on screen. The nearest slab edge is 170 px from the crank hub (s9 organ, Deck UI 150). |
| F16 | PASS | State, cost and effect columns line up at UI 100 and UI 150. |
| F17 | PASS | The brackets frame the target box (N9 on the payphone). |
| F18 | PASS | The Sensor 7 L2 answer is `s7Solid`; L1 is the blink / snap pair. |
| F19 | PARTIAL → F23 | Era I is fixed by F22. Era II: the sign (s9) and payphone (s8, s8w, s9, s10, s11, s15) dots show. The radio dot is hidden at s9, s11 and s15, and so is the s11 sign dot (F23). |
| F20 | PASS | Postgame bicycle 744 lane 104, organ 810 lane 100, radio 690 lane 100: one row at G+52..G+104, clear of the dog band and the pat box. The dog sleeps at 732 in the clear. The bicycle reads against the grass at 1080p and Deck, UI 100 / 150 (`post150/`). The buttons start at x 701 (1080p UI 150) and x 465 (Deck UI 150), so the row is clear. |
| F21 | PASS | The e1 / s9 gust item stands at (1420, 30 / 26), in front of the scrap. The cream glint reads on the pavement. |
| F22 | PASS | e1: the organ line's last stake is clear of the organ; the clock line's last stake is about 56 px from the clock foot. s9: the organ stake is clear. s11: the clock line keeps one stake at about x 2853, left of the clock box (2874-2906), with its RM dot on it. |

**KEEP click (round 3 item)**: `keep/keepclick.json`, `keep/kc-0022.png` → `kc-0023.png`, `crops/keep-click-before-after-half.png`,
`crops/keep-click-jump-left-right-x3.png`.
- The choice phase shows the whole world, with the panel only at top left.
- On the click frame, the panel closes, the lines switch off and the objects turn whole.
- On the same frame:
  - the bicycle leaves the right-wing bush (3150 back) and appears at 744 lane 104;
  - the organ steps from 718 lane 56 to 810 lane 100.
- The jump shows on screen, in the bottom corners at zoom 0.5. C9 says relocations wait for an unseen moment.
- The project's own vocabulary for this is the dog's KEEP beat: it fades out at its home at 4-4.5 s (the crow beat holds the eye), stays
  hidden 4.5-7 s, then re-enters.
- **FIX as F24 (S3).** It affects the full game only: the demo never reaches the finale.

**New items**
- **F23 (S3, reduced motion)**: `era2.steadyInsetPx` 12 puts the steady dot inside the object box wherever the cable meets the object
  steeply.
  - The path leaves the box at (`geo/steady.ts`):

    | object | framing | leaves the box at |
    |---|---|---|
    | radio | s9 | 40 px |
    | radio | s11 | 20 px |
    | radio | s15 | 19 px |
    | sign | s9 | 27 px (the dot still shows, in the open area under the arrow head) |
    | sign | s11 | 28 px |
    | payphone drop | s11 | 18 px (the dot still shows on the gable) |

  - In game (RM, pixel search for `#c98552`):
    - no dot at the s9, s11b or s15 radio, or at the s11 sign;
    - dots at the s9 sign, the s9 / s11 drop wires and the s15 payphone.
  - With 48 px, and the midpoint for lines under 96 px, every era II dot is outside its object box:
    - radio s9 (1549, 1740), s11 (939, 1748), s15 (731, 1754);
    - sign s9 (2907, 1695), s11 (3014, 1742);
    - payphone s8 / s8w / s15 at the cable midpoint.
- **F24 (S3, postgame, C9)**: the KEEP-click relocation above.

Notes (no fix):
- N1, N3, N6, N7 and N8 hold.
- N9: the payphone prop's brackets centre on the receiver, its speaker anchor (`castTargets`), so they frame the booth's right half and
  the gap to the lamp. By design; later polish.
- N10: the woken bicycle sits in the regrowth bush (3150 back) through the finale film and the choice phase. Round 2 accepted this (F20
  keeps the portrait cell through the film), and F24 moves it out at KEEP.
- N11: the dark iron piece left of the e1 / s11 dog spot is the dog's stake and cut chain (`stakeChain`, front row, DENIZEN_ART §2.4).
  - It is identical in v0.11.0, and the dog's tail curl overlaps it at 2364.
  - Accepted. WP28b AD3 (spots v2) may move the sit spot 12 px out.

| F | sev | kind | file | key | old -> new |
|---|---|---|---|---|---|
| F23 | S3 | DATA+CODE | `src/data/spliceWorld.ts`, `src/game/math/spliceWorld.ts`, `src/game/rendering/SpliceLines.ts`, `src/game/math/spliceWorld.test.ts` | `SPLICE_LINE_STYLE.era2.steadyInsetPx`; `drawSteady` phase | `steadyInsetPx` 12 -> 48. New pure `steadyDotPhase(len, insetPx)` = 0 for a non-finite or non-positive len, else `min(1 - 1e-9, max(0.5, (len - max(0, insetPx)) / len))`. `drawSteady` uses `steadyDotPhase(line.len, E2.steadyInsetPx)` instead of `Math.max(0, (line.len - E2.steadyInsetPx) / line.len)`. Test: every era II placement's dot lies outside its `spliceBoxWorld`; the radio s9 dot sits at (1549, 1740) ± 2. |
| F24 | S3 | DATA+CODE | `src/data/spliceWorld.ts`, `src/game/math/spliceWorld.ts`, `src/game/math/spliceWorld.test.ts`, `src/game/rendering/SpliceProps.ts`, `src/game/rendering/LivingWorldDirector.ts` | `SPLICE_FX.postgameMove`; `SpliceProps.setKeepClock`; `placementOf` | Data: `SPLICE_FX.postgameMove = { outFromS: 4, outToS: 4.5, inFromS: 5, inToS: 5.6 }`, inside the dog's KEEP beat (fade 4-4.5, hidden to 7). New pure `postgameMoveAt(keepS)` and `postgameMoveAlpha(keepS, reduced)`. `SpliceProps.setKeepClock(keepS)` re-places the records with `entry.postgame` on the frame the side flips and sets their alpha. The director calls it each frame in `stepSplices` with `keepClockS(scene.time.now)`. A boot into the postgame (Infinity) places at once. |

```
WP28A-AD2R3-FIX-BEGIN
F23 DATA+CODE src/data/spliceWorld.ts era2.steadyInsetPx 48; src/game/math/spliceWorld.ts steadyDotPhase; src/game/rendering/SpliceLines.ts drawSteady uses it; spliceWorld.test.ts dot-outside-box guard (S3)
F24 DATA+CODE src/data/spliceWorld.ts SPLICE_FX.postgameMove {4,4.5,5,5.6}; src/game/math/spliceWorld.ts postgameMoveAt / postgameMoveAlpha; SpliceProps.setKeepClock + placementOf; LivingWorldDirector.stepSplices calls it (S3)
WP28A-AD2R3-FIX-END
```

Re-check after F23 / F24 (polish, verified on the next gate builds; A16 stands without them):
- F23: run `frames.mjs REDUCED=1 ONLY=s9,s11b,s15`, then a pixel search for the 2 x 2 art px `#c98552` dot outside each radio and sign
  box.
- F24: run `keepclick.mjs SECS=12`. Expected:
  - the bicycle and the organ stay at their portrait cells to KEEP + 4 s;
  - their alpha reaches 0 by 4.5 s;
  - from 5 s they stand at the postgame feet, at alpha 1 by 5.6 s;
  - no frame shows an object in both places;
  - the dog re-enters at 7 s with the organ already at 810.
- After F24: run `post150.mjs` and `store-shots.mjs SIZES=1080`; store 09 should be unchanged after the settle.

## WP28b

### AD3-OBJ — Splice objects (eras III-V) and their stage numbers (Art Director, 2026-10-29)

Scope: the art for the ten era III-V Splice objects, their manifest rows, and the stage numbers that B-T5a (cells, frames, boxes,
placements, lines, line styles), B-T3c (Find spots and producers), B-T6a (perches) and B-T3b (perch tops) type in. Hand-off:
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28/plan/ad3-handoff.md` (sections O-a to O-g, code blocks; sections C follow from AD3-CELLS). Evidence:
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28b/ad3obj/` (`comp/` in-game-size mocks on the 1080p store shots, `gate/` the workbench uploads, `work/` previews,
`tools/` the drafts and the checks).

**1. Art** — DONE (hand-pixelled; DENIZEN_ART §12).

| sheet | PNG | check_sheet | workbench score | lint |
|---|---|---|---|---|
| world.splicesB | `world/splices-b.png` 396x56, 22 cells of 18x56 | CLEAN | 97.5 | 0 / 0, info only |
| world.splicesC | `world/splices-c.png` 576x18, 24 cells of 24x18 | CLEAN | 95.3 (cells 0-11) / 95.0 (cells 12-23) | 0 / 0, info only |

Per object (strip of its cells): pump 96.4, whistle 98.2, bell 94.8, kite 100.0, cairn 100.0, hydrant 92.1, gramophone 97.1,
chimes 95.2, vane 93.8, coin flap 100.0 (gate >= 90). First drafts at 89.8 (cairn), 88.3 (hydrant), 88.6 (vane) and 82.0 (coin
flap) were redrawn: the singleton colour pixels became 2 px clusters and the coin flap grew to 4 x 4 (a 2 x 2 face). Four 1 px
holes (whistle plume, kite tail loop, gramophone tonearm base, crank loop) were closed; the torn kite panel lost its hole.

- Mechanics: the pump's handle pivots on a bracket over the cap, the plunger rod rises on the down stroke, the spout mouth drops
  onto the puddle rim; the whistle's steam leaves the slot between bell and bowl and the art carries its own steam pipe; the bell
  turns about its headstock axle with a lagging clapper; the chimes hang from an arm that continues the lamp's ladder bar.
- Wrongness: the kite rises on a string pulled straight down with its tail floating up; the vane stops pointing at the roof;
  the cairn's stones hang in the air with a violet top; the hydrant's mist never lands; the coin flap rattles and nothing comes out.
- Palette: 21 colours per sheet, no green or blue, no letters (the compass cross is plain). `#f0a848` / `#ffd27a` only in the
  whole cells; violetLight only in the four lifted-cairn cells (`violet_frames`). Rebuilds are pixel-identical.
- `check_sheet.py` gains per-frame `parts_frames` (drops, plume wisps, mist specks, lifted stones) and `violet_frames`.
- Two sheets instead of one: one 24 x 56 cell for all ten would decode to 241.5 KiB; the split is 127.1 KiB. Decoded PNG total
  54.57 -> 54.70 MiB (limit 56); PNG on disk +4.4 KB (2651 + 1728 bytes).
- PixelLab: 0 generations (of the 70 allowed): the shapes were drawn directly; the workbench (free) gave the gates.
- Repo rows: `world.splicesB`, `world.splicesC` in `assetIds.ts` (ids 148-149) and `manifest.ts` (descriptions 93 / 89
  characters); ASSET_GUIDE regenerated with `ASSET_GUIDE_OUT` (+2 rows; `assetGuide.test.ts` gains the four Splice / Find
  placement notes the writer needs); `manifest.test.ts` id count 148 -> 150; `worldSheets.test.ts` names the two new ids in its
  gated list. `npx vitest run src/assets` 214 / 214, `npm run typecheck` clean.

**2. Placements, lines, Finds, perches** — DONE (hand-off O-c to O-g; `tools/place.py` against the worktree geometry).
- s11 (stages s11-s14, gated by each Splice's era): pump 946 back over the puddle; whistle 2970 back; hydrant 3100 lane 150;
  bell 3150 lane 120; gramophone 960 lane 150; cairn 880 lane 170; chimes and kite on the lamp, vane and coin flap on the booth.
- s15 / finale: pump 946 (inner gap), gramophone 760 lane 112, cairn 1014 lane 104 (inner gap), the hosted four. Whistle, hydrant
  and bell are documented exemptions at s15 (anchor on the whistle spot; the right yard under the UI 150 buttons) and at s10
  (52 px wings). Postgame: gramophone 958 lane 112, the restored whistle at 3166 back.
- Every placement clears the wing rule, the parts, the crank circle + 24, the gain-text block, the UI 150 HUD rule, spots v2 and
  today's spots (2D), every cast box incl. the Sensor 7 tripod and both girls, the s11 mini, every other object by 4 px, and no
  line crosses an object. Drafts moved: hydrant 2960@56, bell 3130@96, gramophone 800@120, cairn 720@40 and the pump 905 (all on a
  line, a spot, a Find or the organ).
- One accepted overlap: the pump's well cap covers half the s11 paper scrap at 960 until firebox tier 3 burns it (it draws
  behind). Moving the pump clears it but the drops then miss the size-1 puddle.
- Lines III pipe (flange wisps), IV standing-wave wire (amplitude 0-2 art px by L, nodes at the thirds), V lifted specks (6-10,
  violet top, bob); reduced motion: none / flat / static. No risers.
- FIND_SPOTS: s10, s11, s15 replaced (producers vent, puddle, pump, chladni, lift; organ / radio / coin return with `requires`),
  organ / radio / coin-return spots appended at s8, s8w, s9; all 25 pass (24 px from feet, UI 150 rect, crank, objects, view).
- Perches: s11 whistle top (2970, G-88) and bell frame (3150, G+64); the vane finial replaces the booth roof (dy -138), the
  chimes' arm end replaces the lamp top while the kite stands (dx 30, dy -86). Every allowed hop <= 160 px, never over the machine.

Open (not AD3-OBJ files; for the EM and the named tasks):
- B-T5a: the A14 guard needs `offsetWorld` in spliceBoxWorld, `SPOT_2D_CLEARED` for the x-only spot overlaps listed in O-g, and
  the two hosted pairs (payphone / vane, payphone / coin flap) exempt from the 4 px object gap.
- AD3-CELLS (spots v2 check): s11 Inspector yard 720@56 stands in the organ and 880@72 in the radio, s11 dog 3080@64 in the bulb
  sign, s15 Inspector yard 720@56 in the organ (era I-II objects; hand-off O-g).
- AD4 checks in game: the plume and mist at zoom 0.5, the kite string against the pylons, the vane on the apex during a ring (the
  hood rattles 1 px), the coin flap's visibility (it is 4 x 4 art px), the restored whistle at the postgame right edge at Deck
  1280x800 UI 150, the cairn's violet tops on the violet era V sky.

```
WP28B-AD3OBJ-FIX-BEGIN
(none)
WP28B-AD3OBJ-FIX-END
```

### AD3-CELLS — reaction cells and the stage checks (Art Director, 2026-10-29)

Scope: the four new denizen cells (Inspector `startle`, `point`; dog `bark0`, `bark1`) in all six era rows, and the checks that WP28b
gives AD3: the spots v2 table and the Splice visit spots against the stage, plus FX colour notes for AD4. Hand-off sections C-a to C-d
in `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28/plan/ad3-handoff.md`. Evidence:
`C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28b/ad3cells/` (`out/contact-*.png` 5x boards, `comp/` in-game-size mocks on the 1080p store
shots, `gate/` the workbench uploads, `geo/` the checkers and their tables).

**1. Cells** — DONE (hand-pixelled; DENIZEN_ART §2.1 and §2.2, WP28b paragraphs).

| cell (column) | score | lint | silhouette | pivot / pop | check_sheet |
|---|---|---|---|---|---|
| inspector startle (22) | 92.3 | 0 / 0, info only | 1 per cell, 0 holes | legs and boots = idleA (rows 31-39, all 6 rows) | CLEAN |
| inspector point (23) | 96.0 | 0 / 0, info only | 1 per cell, 0 holes | legs and boots = idleA | CLEAN |
| dog bark0 (23) | 99.7 | 0 / 0, info only | 1 per cell, 0 holes | feet = sit0 | CLEAN |
| dog bark1 (24) | 100.0 | 0 / 0, info only | 1 per cell, 0 holes | bark0 <-> bark1 change only (16, 2)-(27, 11), the head | CLEAN |
| sheets | inspector 95.8 (124 components = 144 cells - 20 canopy touches); dog halves (cells 0-12 / 13-24) 99.1 / 98.3 | 0 / 0 | | old columns pixel-identical | CLEAN |

- C1: all four are profile cells. After `restFlip` they face away from the machine. `point` is used only toward a Find on the outer side,
  and its finger ends 16-20 world px past the feet on the facing side. The fault bark faces outward.
- Palette: the 25 colours, violetLight only in row V, row I sepia only, no blue or green, no text. Decoded PNG total 54.70 -> 54.76 MiB.
- No clipboard pages overlay on `startle` / `point`, because the board stands upright or sits under the chin.
  - `src/data/worldEras.test.ts` (`FACE_ON_FRAMES`) must list both cells. That test fails until it does.
  - The fix line is in hand-off C-a. It is not an AD3-CELLS file; the EM assigns it.
- Repo: `WORLD_FRAMES` appends (inspector 22 -> 24, dog 23 -> 25); manifest `world.inspector` 480x240 (144 frames) and `world.dog`
  700x120 (150 frames). The descriptions now carry the true frame counts (95 / 88 characters). The two ASSET_GUIDE rows were
  regenerated, `manifest.test.ts` re-pinned, `npx vitest run src/assets src/data/livingWorld.test.ts` 318 / 318, `npm run typecheck`
  clean.
- PixelLab: 0 generations (of the 25 left in the AD3 budget). The workbench (free) ran the gates.

**2. Spots v2 check** — DONE (hand-off C-b; `geo/spots.py`). The table as typed failed 89 rows:
- spots on Sensor 7: s9 sensor 1380 is 4 px from the tripod;
- spots beyond Sensor 7, whose back-row walks cross it: e1 1320, s11 690, s15 690;
- spots in an era I-II object: the organ at e1, s8, s8w, s9, s11 and s15; the radio at s9; the bulb sign at s11;
- spots against the ground girl (cycle 3+ / era IV) and on the s11 sprout;
- Inspector yard feet below the UI 150 view: s8 and s8w (the camera rises there at UI 150);
- every dog yard spot at s8, s8w, s9 and s10 under the UI 150 HUD buttons. The plan's yard limits came from the UI 100 camera, the
  error AD2 F6 fixed for `SPLICE_YARD_LIMITS`.

Fixes:
- 34 correction rows, plus `WORLD_YARD.maxLane` s8 / s8w / s9 / s10 set to the measured button tops (-9 / -9 / 25 / -12);
- the corrected table fails 0 rows;
- the two pinned finding lists in the tests empty out (`KNOWN_MINI_OCCLUSIONS`, `KNOWN_SPOT_FINDINGS`).

Notes:
- B1 risk: at s8-s10 the dog keeps two spots 24-52 px apart.
- An optional UI-scale-aware spot pool (code) would give the s9 dog its yard back at UI 100.

**3. Visit spots** — DONE (hand-off C-c; `geo/visits.py`), for all 16 objects in every roaming framing they stand in.
- dx 32 holds for 15 visits.
- 14 visits need an override:
  - the organ (dx 38) everywhere;
  - the bicycle (dx 48) at e1 and s11;
  - the sign (dx 48; at s9 also lane 32);
  - the bell (dx 40);
  - the payphone (dx 28 / 44) at s8 / s9;
  - the s15 radio (dx 28).
- 14 visits are exempt: out of the walker's band, under the UI 150 HUD, on the s11 sprout, or (the s11 hydrant) boxed in by the
  bicycle and the bulb sign.
- Each visit lists the spots it may start from without a walk through an object's base (era-aware). The s11 gramophone starts only from
  y1 in era IV; once the cairn stands (era V), no walk reaches it.

**4. FX notes for AD4** (hand-off C-d). C8 holds for dust, debris, pylon dots and the ground pulse in eras I, II and V. Off C8:
- the era II arc tip `#f0a848`; proposed `#c98552`;
- the ground pulse and wave in eras III-IV (`#ddc9a3`; C8 lists `#f0a848` / `#ffd27a`).

To tune in game: the 1 art px pulse at zoom 0.5, the `REACH_LEVEL` hi values, the lamp wobble plus mains flicker under 3 Hz, the era IV
hum against the unison beat, the drift puffs over the yard objects, and debris near the Find spots and the cairn.

Open (not AD3-CELLS files; for the EM and the named tasks):
- B-T3a: apply the C-b rows and the `WORLD_YARD` values (step 0) and re-pin the two lists; type the C-c visit dx / lane / from data.
- EM: the `worldEras.test.ts` `FACE_ON_FRAMES` line (C-a).
- B-T1c1: measure the B1 walk share where the dog has a yard (e1, s11), or carry s8-s10 on the micro activities.
- AD4: in-game look of the four cells (zoom 1 / 0.75 / 0.5, eras I, III, V), the startle timing against the passing ground wave, the C-d
  items.

```
WP28B-AD3CELLS-FIX-BEGIN
(none)
WP28B-AD3CELLS-FIX-END
```

### AD4 - WP28b in-game audit (Art Director, 2026-10-30)

**Verdict: NOT YET (B10).** 3 S2 and 13 S3 rows (F25-F40). No S1. Every canon note holds. F23 and F24 (AD2 round 3) pass.

The S2 rows:
- F25: woken Splices gather nobody. The visits of D5 are not wired.
- F26: at s13 and s15 some poke targets get no zone, so they can be neither hovered nor clicked.
- F27: the newest era IV-V lines show no pulse.

Most other areas pass: roaming, reactions to faults and big buys, the reach FX, the era III-V art, the new cells, the poke bubbles and the full store-shot set (1080 and 2160).

Build under audit.
- The G2 builds were not in the repo (`dist/` held the 19:27 WP28a build; no previews ran; `<O>/val2` did not exist). I built the current tree (HEAD `4d74505` + the 47-file WP28b diff, typecheck clean) into scratch folders at 00:48:
  `vite build --outDir <A>/build/dist` and `vite build --mode demo --outDir <A>/build/dist-demo`.
  - No file under `src/`, `public/` or `vite.config.ts` is newer than these builds.
- dist chunks:
  - `index-D0mHxxNn.js` 507.9 KB
  - `LivingWorldDirector-BIlYVeZc.js` 266.6
  - `WorldReach-D5Ltfj0U.js` 41.4
  - shared `worldReach-DGPWQx9O.js` 13.7 + `faultMarker-*` 2.1
  - `FaultMarker-DziaAOUf.js` 8.5
  - CSS 41.6
- dist-demo chunks: `index-jyxi3P65.js` 508.5, Director `CX0dWp79` 266.6, WorldReach `DO17eXXe` 41.4, CSS 41.6 + demoEnd 2.7.
- Readings for the EM (no ruling here): the shared lazy row reads 15.9 KB, above the 6 KB cap of the 2026-10-29 ruling. The cause is the `worldReach` math/data chunk shared by the Director and WorldReach. The lazy world total is 323.8 KB (cap 330).
- `vite preview` ran on :4174 (dist) and, for a short demo check, :4177 (dist-demo). Both were killed by me; netstat is free afterwards.
- One Playwright browser at a time, except one ~5 min overlap: post150 and hovergrid ran together. Both are non-timing checks (N22).
- Timing readings only (load rule): roam `F_cost` world 0.275 ms (S9) / 0.277 (s15), `reachStats().meanMs` 0.087 / 0.090 (my runs 0.045-0.093), display 68 / 91.

Evidence root `<A>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28b/ad4/`.
- Runs: `roam/`, `cast/`, `cast150/`, `react/`, `react2/`, `react3/`, `react-era/`, `reach/` (incl. `*-rm`), `frames345/`, `frames345-150/`, `f23/`, `f23q/`, `prod/`, `bub/`, `cells/`, `point/`, `hover345/`, `hovergrid/`, `keep/`, `keep-all/`, `post150/`, `store-1080/`, `store-2160/`, `demo/`.
- Logs: `logs/`. Boards and crops: `crops/`.
- Geometry: `geo.json` (machine boxes, cast, spots v2 and Splice boxes per stage, from `tools/geo.ts`). Per-era rates: `tools/rates.ts`.
- Tools: `tools/`. They are cast, react / react2, reach, frames2, keep2, post150, prod, bub, cells, point, hover345, hovergrid, castan.py, reactan.py, wcrop.py, contact.py and f23.py, plus the run scripts `run1.sh`-`run5.sh`.

**1. Roaming cast (60 s screencasts, 1080p, UI 100; roam.mjs A / B; UI 150 at 1080p / 720p / Deck)**

| check | verdict | reading / evidence |
|---|---|---|
| nothing reads frozen | PASS | Longest action gap (castan, 250 ms samples):<br>- e1: Inspector 6.1 s, dog 7.5, crow 8.6<br>- s9: 6.2 / 9.8 / 8.4<br>- s11: 7.1 / 5.9 / 8.8<br>- s15: 8.1 / 8.8 / 8.3<br>roam A_gap 5.8-9.7 s at e1 / s9 / s11 / s15. Boards: `crops/cast/*-full-every4s.png`, `cast/*/cast.json` |
| era IV (s13) | FAIL (S3, F34) | The conductor switches every 12.1 s (roam `A_gap_s13` 12.08 s). Nobody walks in 60 s (unison canon). `cast/s13-*`, `roam/roam.json` |
| walks across the yard, lane depth | PASS | Spot ranges covered 100 % (roam B; the Inspector also walks yard lanes 64-170). Walk share in 60 s:<br>- Inspector: e1 26 %, s9 10, s11 19, s15 10<br>- dog: 19 / 4 / 25 / 6<br>The s9 and s15 dog has 44-48 px of spots, so it acts in place there (B1 unit failures, F40). Lines lie behind the walkers (`crops/react/e1-wake-left-x1.png`) |
| nobody walks through the machine, an object, a part or the tripod | PASS | 0 feet inside a Splice box at its lane; 0 Inspector or dog x inside the machine x-range, except the s15 dog front row (N13). `geo.json`, castan `objHits` / `inMachine` |
| nobody faces the machine at rest | PASS | 0 profile rest frames facing the machine in ~1,090 cast samples, roam `C_facing` 0 / 157, and every reaction log (react*, `reactan.py`) |
| dog and Inspector never touch | PASS | Nearest x gap 849 px (e1) |
| spots under the HUD buttons at UI 150 | PASS (N14) | The Inspector, crow and yard spots stay clear at 1080p, 720p and Deck. The dog's home row at s9 (11-16 % of its box) and s15 (48-56 %) meets the button tops, as in the accepted s10 case. `cast150/`, `crops/s15-ui150-1920x1080-dog-buttons.png` |
| demo (:4177) | PASS | e1 / s9 30 s, errors [], gaps ≤ 8.1 s, 0 facing errors. `demo/` |

**2. Reactions (C1)**: clean runs `react3/` (s9, s11, s15) plus `react2/` (e1), `react/` (wake, burst), `react-era/`; all read with `tools/reactan.py`.

| cause | verdict | reading |
|---|---|---|
| fault | PASS, with F30 | Inspector startle at 482 / 502 / 531 ms (s9 / s11 / s15).<br>Dog bark0/1 at 682 / 679 ms, outward.<br>Crow ruffle at 756-961 ms, then a hop to the highest perch (s9: the drop wire, 132 px, apex 48).<br>A walker mid-walk reacts only when the walk ends (e1 Inspector 3.5 s, s11 dog 1.65 s): F30. `crops/react-s9-fault-cast-x2.png`, `crops/react-s9-fault-dog-x2.png` |
| fault clear | PASS | writeTick at 243-393 ms, dog wag at 334 ms (late while walking, F30), Sensor 7 blink |
| Find | FAIL (S3, F29) | Dog sniffFind toward an outer Find at 1.05-1.10 s; crow glanceDown at 0.8-1.5 s; Inspector lookFind at 3.5-4.0 s (s11, s15) and point at 3.98 s toward an outer gust (e1, faces away). A Find on the far wing (crow drop, dog dig, coin return) gets no Inspector reaction at e1 or s9: `findInner` is false off his wing. Point is never seen at the machine. `crops/cells-ingame-point-e1-x3.png` |
| big buy + ground wave | PASS for the Inspector; dog FAIL (S3, F31) | Startle as the wave passes his x: 186 / 339 / 857 / 164 ms (e1 / s9 / s11 / s15). Crow ruffle 398-1027 ms. Dog lookUp 0 of 3 in eras I-III (lookBigV at 91 ms in era V). The plain lookUp shares a 30 s cooldown with the roaming pick |
| crank burst (14 clicks) | PASS | Crow ruffle (s11 733 ms) |
| era change | PASS | e1→s8: the Inspector walks to 1552 and holds front from 2.39 s for 4.5 s, the crow perchHead at 0.8 s, Sensor 7 headC. s9→s10: eraFront at 1276, eraHead, perchHead. The dog misses eraHead once (N16) |
| Splice wake and visit | FAIL (S2, F25) | No visitWrite / visitSniff in 16 s after the bicycle (e1), sign (s9) or hydrant (s11), and roam `D_visit` fails. The Director never sets `ctx.visitSpot`, never pushes the `splice` cue, and no `v<n>` spot exists |
| stagger bands | PASS | Inspector < dog < crow in every clean run |
| crow hops | PASS | Free hops in eras I-III and V: right wing only (x 2420-2516 / 2864-3000 / 3050-3108), never over the machine, ≤ 160 px. None in era IV (s13: x 3104 constant) |
| Sensor 7, girl | PASS | The girl's x never changes (window / mini / 880 / 976). Sensor 7's x is constant. Its head follows the camera side (headR, N12) and turns to headC at the era card |
| era IV | Note (N15) | The conductor takes no machine-event reaction (C11: interrupts refused while joined) |

**3. Reach FX (D6), every era** (`reach/`, `reach/*-rm`, roam E)

| effect | verdict | reading / evidence |
|---|---|---|
| crank ground pulse | PASS; colour F38 | +6 per 10 clicks (≤ 1 per 250 ms). An 8 art px cream dash runs outward and fades; it reads at zoom 1 and 0.5. On the era III-IV sand it is weak. `crops/reach-{e1,s11,s15}-pulse-left-x3.png` |
| ground wave | PASS | +1 per big buy, 3 s gap. The startle is timed to it |
| base dust, pylon pulses, dust law | PASS | baseDust 0-7 specks hopping; pylon dots 2 (s9), 4 (s11 / s13), 6 (s15) at 120 px/s; the dust law has no probe row (unit-tested) |
| lamp wobble | PASS | Big swings 0.33-0.75 per s (≤ 3 Hz with the mains flicker). Steady under RM |
| pebbles (I) | not measured | No probe row; unit-tested |
| arcs (II) | PASS; colour F37 | 5 arcs in 12 s (0.42/s), 90 ms each, at the lamp, hood and insulators |
| steam drift (III) | PASS | 1-4 puffs alive, faint, behind the cast. `crops/reach-s11-still-band.png` |
| hum and puddle rings (IV) | PASS / N18 | Lamp x 3102 ↔ 3106 and booth hood span 4 px: 1 art px, never a render jitter. Puddle rings were not seen at s13 in 12 s (no probe row; unit-tested) |
| debris lift (V) | PASS | 2 → 6 specks rise and hang by the feet and the booth. RM: 7 static specks. `crops/reach-s15-feet-x3.png` |
| no flash > 3 Hz, nothing reads as a screen effect, clutter | PASS | Every FX stays on the ground or the props. No full-screen tint, no Gnorp-style pile-up in era V. `crops/reach-s13-still-band.png`, `crops/reach-s15-still-band.png` |
| reduced motion | PASS | Every part 0 in e1-s15, debris static, lamp steady (s11 / s13: a one-way fade to 0.4, then flat) |
| photo mode | PASS | reachStats parts frozen over 1 s in every era (the machine keeps turning, as in v0.11.0). `crops/photo-e1-diff.png` |
| REACH_LEVEL per era | DATA F35 / F36 | A-run L at era entry / median / end (`tools/rates.ts`):<br>- ME: 0 / .39 / .47<br>- EE: .11 / .62 / .73<br>- PR: 0 / .55 / .61<br>- RS: 0 / .67 / .69<br>- XF: .32 / .69 / .87<br>PR and RS never pass 0.7, so the era IV 2 px hum never shows. With F35 / F36:<br>- PR: 0 / .70 / .81<br>- RS: 0 / .80 / .87, and the hum turns 2 px only at the era's end |

**4. Era III-V Splice objects and lines** (`frames345/`, `frames345-150/`, `keep-all/`, `hover345/`, `hovergrid/`)

| check | verdict | evidence |
|---|---|---|
| dead and woken frames, the wake beat | PASS | - Pump: handle up and down, drop on the puddle.<br>- Whistle: plume.<br>- Hydrant: mist.<br>- Bell: swings L / R.<br>- Gramophone, chimes sway.<br>- Vane: turns, compass cross plain.<br>- Kite: rises on a straight-up string.<br>- Cairn: stones lift with violet tops.<br>- Coin flap: visible at 4 x 4 art px.<br>`crops/obj-s11-era3-dead-woken-x3.png`, `crops/obj-s11-whistle-hydrant-seq-x3.png`, `crops/obj-s13-era4-dead-woken-x3.png`, `crops/obj-s15-era5-dead-woken-x3.png` |
| whole frames (postgame), KEEP beat | PASS | All 16 whole. The gramophone moves 760 → 958 and the whistle appears at 3166 inside the F24 window. `crops/F24-keep-all-timeline-x3.png` |
| lines III-V | PASS | Era III pipe, era IV cream standing-wave wire, era V specks; each from the outer base foot, none across the machine |
| pulses on the new lines | FAIL (S2, F27) | The 24-dot budget goes in TECH order:<br>- s13: chimes 0, gramophone 1<br>- s15: vane, kite, cairn and coin return 0 (`frames345/frames-ui100.json` seq) |
| perches (vane, kite) | FAIL (S3, F33) | The crow keeps the lamp top over the dead kite (era V, store 07). In the postgame the kite string rises out of its back (store 09). `crops/obj-s15-era5-dead-woken-x3.png`, `crops/store09-right-wp28a-vs-wp28b-x3.png` |
| UI 150 placements | PASS | Every era III-V object stays clear of the buttons and the panel. `crops/s13c-ui150-right.png`, `crops/s15c-ui150-left.png` |
| tooltips and pokes, UI 100 / 150 | FAIL (S2, F26; S3, F28) | `pokeTargets()` returns 18 targets at s13 and s15, and `POKE_LAYOUT.zones` pools 16. A 25-point grid reaches 0 of 25 points on:<br>- s13: gramophone and chimes<br>- s15: cairn, coin return and lamp<br>At centres, a neighbour's 56 px zone wins: crow → kite, vane → kite, bicycle → chimes, organ → radio, girl → pump, dog → clock. Slabs end 0.3-1.2 px past the right edge (N17). `hover345/hover345.json`, `hovergrid/hover345.json` |

**5. New cells, Find producers, poke bubbles**

| check | verdict | evidence |
|---|---|---|
| startle, point, bark0, bark1 (1:1 and 3x, six rows) | PASS | Sheets: the old palette (the bark mouth `#2e1a12` is ART_BRIEF), no blue or green, row V violet rim. `crops/cells-inspector-idle-startle-point-x4.png`, `crops/cells-dog-idle-bark0-bark1-x4.png`.<br>In game: startle and bark at e1 / s9 / s11, point at e1, all facing away. `crops/cells-ingame-{e1,s9,s11}-x3.png`, `crops/cells-ingame-point-e1-x3.png`.<br>Rows IV and V never show in game: the era IV conductor and the era V stare frames |
| Find producers | PASS, with F32 | - crow drop: perchTalk, then the item at 0.49 s<br>- gust, ground, organ, radio, coin return: item at the object's foot at 0.32-0.33 s<br>- puddle, pump, vent (0.33-0.55 s), chladni, lift: rises 12 px and hangs<br>- dog dig: digs 100 px from its item (e1: dog at 2520, item at 2420), F32<br>`crops/finds-producers-{a,b,c,d}-*.png`, `crops/s15-find02-left-x2.png` |
| poke bubbles | PASS | `Noted.` and `…` show on level-2 answers at e1, s11 and s15, above the speaker. With WORLD VOICES OFF: none in 8 ladders. `crops/poke-bubbles-e1-s11-s15.png`, `bub/` |

**6. Store shots** (`store-1080/`, `store-2160/`; both `fail []`, `errors []`, every `_no_output_tick`, `_no_fault` and `_no_find` passes)
- 01-10 re-approved at 1080 and 2160 (2160 pixel-crisp).
- 01, 03 and 05 match WP28a.
- 04, 06 and 07 add the dead era III-V objects; small, no clutter.
- 09 changes only by the new whole objects (pump, gramophone 958, cairn, vane, chimes, kite, whistle 3166). The F20 row is unchanged (`post150/`: bicycle 744, organ 810, radio 690; buttons from x 701 / 465).
- 07 and 09 carry the F33 crow-on-kite overlap. Polish only.
- Boards: `crops/store/*-wp28a-vs-wp28b.png`, `crops/store09-*-x3.png`, `crops/store2160-07-right.png`.

**7. AD2 round 3 carry-overs**
- F23 PASS. In RM, the 2 x 2 art px `#c98552` dot lies outside each box:
  - radio: s9 (1549, 1740), s11b, s15;
  - sign: s9 (2907, 1695) and s11 (3014, 1741, rerun with voices off because a voice bubble covered it).
  - Evidence: `f23/`, `f23q/`, `crops/F23-*.png`.
- F24 PASS (`keep/`, `keep-all/`, `crops/F24-keep*-timeline-x3.png`):
  - the objects hold their portrait cells to K+4.0 s, fade by 4.45-4.6 s and are hidden to 5.0 s;
  - they stand at the postgame feet from 5.04 s at alpha 1 by 5.5 s, never in both places;
  - the dog fades at K+4.0-4.5 and re-enters at K+7.0 to 732, with the organ already at 810.
  - post150 and store 09 settle unchanged (above).

**Canon notes**:
- The girl's x never changes.
- No blue or green pixel in the new art (splices-b / -c, inspector, dog: 0 saturated blue-green colours) or in the FX colours before the finale.
- No letters in art: the vane's cross is plain and the sign is an arrow.
- The clock rests at 4:41 (`crops/clock-4-41-e1-s13-x6.png`).
- No denizen at rest faces the machine.

**8. F-list**

| F | sev | kind | file | key | old -> new |
|---|---|---|---|---|---|
| F25 | S2 | CODE | `src/game/rendering/LivingWorldDirector.ts` (+ visit spots in `src/data/worldBehaviour.ts`) | D5 gathering | Wire the visits:<br>- push the `splice` cue 3-8 s after a wake;<br>- set `ctx.visitSpot` for the walker of the object's wing (Inspector left, dog right);<br>- add the `v<n>` spots per framing from the AD3-CELLS C-c table (dx 32, overrides and exemptions).<br>Recheck: roam `D_visit` |
| F26 | S2 | DATA | `src/data/findWorld.ts` | `POKE_LAYOUT.zones` | 16 -> 24 (s13 / s15 show 18 targets; 16 pooled zones leave the last two unreachable) |
| F27 | S2 | CODE | `src/game/rendering/SpliceLines.ts` | `drawPulses` budget | Two passes inside `SPLICE_FX.maxDots` (24 kept): pass 1 gives every line 1 pulse, pass 2 adds up to `pulseCount(L)` - 1 more per line in TECH order. No line with a woken object draws 0 pulses |
| F28 | S3 | CODE | `src/game/rendering/PokeLayer.ts` | hover pick | Among zones that hold the pointer, the one whose target centre is nearest wins (ties: the smaller target box), so every target hovers at its own centre (lamp, chimes, kite, vane, crow, coin flap, cairn) |
| F29 | S3 | CODE | `src/game/rendering/LivingWorldDirector.ts` | `ctx.findInner` | `sameSide && abs(there) < abs(here)` -> `findX !== null && !ctx.findOuter` (a far-wing Find gets lookFind / sniffHere, as the plan's "else lookUp") |
| F30 | S3 | CODE | `src/game/math/worldBehaviour.ts` (runner) + Director | reaction latency | A machine-event cue (fault, faultClear, find, bigBuy, era) halts a walk in progress at the next walk frame (`halt()`), so the reaction starts within 1 s, instead of after the walk's target |
| F31 | S3 | DATA | `src/data/worldBehaviour.ts` | dog bigBuy | `DOG_REACT` += `reactAct('lookBig', one('lookUp'), [1500, 2500], ['bigBuy'])`; `DOG_ROUNDS` lookUp `reaction` `['crowMove', 'ring', 'bigBuy']` -> `['crowMove', 'ring']` |
| F32 | S3 | CODE | `src/game/rendering/LivingWorldDirector.ts` | `findProducer('dog')` | Dig only when the dog's feet are within 24 px of the spot x; otherwise return lead 0 (no action) |
| F33 | S3 | CODE | `src/game/rendering/LivingWorldDirector.ts` | perch list | A Splice `perchTop` with `replaces` takes over that perch while the object is placed (dead or woken), not only woken. The crow leaves the lamp top or booth roof at the next unseen moment or by a hop |
| F34 | S3 | DATA | `src/data/worldBehaviour.ts` | `PRE_ACTIONS` beats of `still`, `sway`, `look`, `rise` | [3, 5] -> [3, 4] (max 9.6 s at 2400 ms per beat; roam `A_gap_s13` reads 12.08 s) |
| F35 | S3 | DATA | `src/data/worldReach.ts` | `REACH_LEVEL.lo.pr`, `REACH_LEVEL.hi.pr` | 1 -> 10, 1e6 -> 2e4 |
| F36 | S3 | DATA | `src/data/worldReach.ts` | `REACH_LEVEL.lo.rs`, `REACH_LEVEL.hi.rs`, `WORLD_FX.hum.strongLevel` | 1 -> 100, 1e6 -> 3e4, 0.7 -> 0.85 (S13 L 0.36 keeps roam `E_hum` > 0.3) |
| F37 | S3 | DATA | `src/data/worldReach.ts` | `REACH_FX.arc.tip` | 0xf0a848 -> 0xc98552 (C8 era II) |
| F38 | S3 | DATA+CODE | `src/data/worldReach.ts`, `src/game/rendering/ReachFx.ts` | `groundPulse.color`, `groundWave.color` | 0xddc9a3 -> per era {1: 0xddc9a3, 2: 0xddc9a3, 3: 0xffd27a, 4: 0xffd27a, 5: 0xddc9a3} (C8; the cream dash fades on the era III-IV sand) |
| F39 | S3 | DATA | `src/data/worldBehaviour.ts`, `src/game/math/spliceWorld.test.ts` | `WORLD_SPOTS.e1.dog` y2, `WORLD_SPOTS.s8w.inspector` y1, `SPOT_2D_CLEARED` | e1 dog y2 2460@72 -> 2448@60; s8w Inspector y1 1540@24 -> 1548@24; add `'spliceBicycle e1'` (y3 2520@48 is clear in 2D). Clears the two A14 failures B-T8b left |
| F40 | S3 | TUNE | `src/data/worldBehaviour.ts` (B-T1c1, measured) | weights / holds | B1 unit failures B-T8b left (24 in all with F39):<br>- Inspector 5-min walk share 5.3-7.6 % at S8-S15 (≥ 12)<br>- crow 4-run repeats up to 56 (≤ 4)<br>- lock pair up to 9.9 % (≤ 8)<br>Tune by the metrics run; no number from AD4 |

```
WP28B-AD4-FIX-BEGIN
F25 CODE src/game/rendering/LivingWorldDirector.ts + src/data/worldBehaviour.ts D5 visits: splice cue 3-8 s after a wake, ctx.visitSpot, v<n> spots from AD3-CELLS C-c (S2)
F26 DATA src/data/findWorld.ts POKE_LAYOUT.zones 16 -> 24 (S2)
F27 CODE src/game/rendering/SpliceLines.ts drawPulses two-pass budget (1 per line first, maxDots 24 kept) (S2)
F28 CODE src/game/rendering/PokeLayer.ts hover pick: nearest target centre among overlapping zones, ties to the smaller box (S3)
F29 CODE src/game/rendering/LivingWorldDirector.ts ctx.findInner = findX !== null && !ctx.findOuter (S3)
F30 CODE src/game/math/worldBehaviour.ts + LivingWorldDirector.ts machine-event cues halt a walk at the next walk frame (S3)
F31 DATA src/data/worldBehaviour.ts DOG_REACT += reactAct('lookBig', one('lookUp'), [1500, 2500], ['bigBuy']); DOG_ROUNDS lookUp reaction drops 'bigBuy' (S3)
F32 CODE src/game/rendering/LivingWorldDirector.ts findProducer('dog') digs only within 24 px of the spot, else lead 0 (S3)
F33 CODE src/game/rendering/LivingWorldDirector.ts perchTop replaces its perch while the object is placed (dead or woken) (S3)
F34 DATA src/data/worldBehaviour.ts PRE_ACTIONS still/sway/look/rise beats [3,5] -> [3,4] (S3)
F35 DATA src/data/worldReach.ts REACH_LEVEL.lo.pr 1 -> 10, REACH_LEVEL.hi.pr 1e6 -> 2e4 (S3)
F36 DATA src/data/worldReach.ts REACH_LEVEL.lo.rs 1 -> 100, REACH_LEVEL.hi.rs 1e6 -> 3e4, WORLD_FX.hum.strongLevel 0.7 -> 0.85 (S3)
F37 DATA src/data/worldReach.ts REACH_FX.arc.tip 0xf0a848 -> 0xc98552 (S3)
F38 DATA+CODE src/data/worldReach.ts + src/game/rendering/ReachFx.ts groundPulse / groundWave color per era {1,2,5: 0xddc9a3; 3,4: 0xffd27a} (S3)
F39 DATA src/data/worldBehaviour.ts WORLD_SPOTS e1 dog y2 2460@72 -> 2448@60, s8w inspector y1 1540@24 -> 1548@24; spliceWorld.test.ts SPOT_2D_CLEARED += 'spliceBicycle e1' (S3)
F40 DATA src/data/worldBehaviour.ts B1 tuning by measurement (Inspector walk share >= 12 % S8-S15, crow 4-run repeats <= 4, lock pair <= 8 %) (S3)
WP28B-AD4-FIX-END
```

Notes (no fix):
- N12: Sensor 7 rests on headR. Its head follows the camera side, a WP23 rule unchanged in WP28a; it is not a WP28b change.
- N13: at s15 the machine spans x 848-2992, so the dog's front row (2832-2880, lane 32) stands in front of the base. Pre-existing.
- N14: at UI 150 the buttons cover the s9 and s15 dog's home row, like the accepted s10 case. A UI-scale-aware spot pool (AD3-CELLS note) would free it.
- N15: era IV reacts to no machine event, by C11.
- N16: at the e1 → s8 card the dog was still in its keystone lookUp, so it missed eraHead.
- N17: the tooltip slabs end 0.3-1.2 px past the right edge at s13 / s15, 1080p. Sub-pixel; they read fine.
- N18: puddle rings were not observed at s13. They are unit-tested.
- N19: roam fails, mapped to this list:
  - `C_find` → F29; `D_visit` → F25; `A_gap_s13` → F34.
  - `C_wave` and `C_era` fail, yet the in-game startle (164-857 ms) and eraFront work. The EM should check the smoke's buyList 8 h jump before them.
- N20: the s15 pump stands in the machine's inner gap, clear of every part (AD3 accepted).
- N21: at s13 the dog sits where four or five right-wing lines meet.
- N22: post150 and hovergrid overlapped for about 5 min; both are non-timing checks.
- ME reach (era I tops at L 0.47) stays as AD2 F4 set it: the era I reach is the crank pulse. `hi.me` 3e4 -> 1e4 is a Director call if wanted.

Re-check for the next round (AD4 round 2, on fresh builds of the fixed tree):
- F25: rerun `react.mjs` wake at e1 / s9 / s11; a visitWrite or visitSniff must show within 3-8 s plus the walk. roam `D_visit` must pass.
- F26 / F28: rerun `hovergrid.mjs GRID=1` at s13 / s15, 1080p UI 100 and Deck UI 150. Every target needs ≥ 1 / 25 grid points and its own centre.
- F27: rerun `frames2.mjs`; every woken line needs pulses ≥ 1 at s13 and s15. `splices.mjs` M_eras.
- F29-F32: rerun `react2.mjs COOL=14000 SHORT=1` at e1 / s9:
  - the Inspector lookFind on far-wing Finds;
  - reactions within 1 s mid-walk;
  - the dog lookUp on a big buy;
  - then `prod.mjs` e1 (dig at the item).
- F33: rerun `frames2.mjs` s15c and store 07 / 09; the crow must not sit on the kite.
- F34: roam `A_gap_s13` ≤ 12 s.
- F35-F38: rerun `reach.mjs`; the era III-IV pulse must read on the sand, the arc tip must be copper, and the hum must stay 1 px through the s13 run.
- F39 / F40: `npx vitest run src/game/math/spliceWorld.test.ts src/game/math/worldBehaviourMetrics.test.ts` must pass.
- Then roam (all), `store-shots.mjs SIZES=1080` (07, 09).

### AD4 - WP28b in-game audit, round 3 (Art Director, 2026-10-30)

**Verdict: FIXES REQUIRED (B10).** One S2 row and six S3 rows (F41-F47). No S1.
- Round 1's F25-F40 hold on the round 3 gate builds. F25, F26 and F27 (the round 1 S2 rows) are fixed.
- F33 is fixed for the roaming crow only, so F45 carries it into the ending.
- F23 and F24 (AD2 round 3) pass again. Every canon note holds.

The S2 row, F45: every full-game ending puts the crow on top of the kite or inside the vane.
- The finale and postgame script still draws the crow on the lamp top (`WORLD_ENDING.homeX.crow` 3104, feet G-112).
- At the KEEP beat it hops to the booth roof (`keep.hopDx` -54, `hopDy` 10).
- The kite (lamp) and the vane (booth apex) are placed at `portrait` in era V, and they turn whole at KEEP, so:
  - in the choice phase, the crow sits on the tangled kite;
  - for the whole postgame loop, the whole kite's string rises out of the crow's back (store 09);
  - during the KEEP crow beat (K+3.0 to K+3.9 s, the beat that holds the eye), the vane mast runs through the crow.
- This happens in every ending, even with no era III-V Splice bought, because the dead objects stand there and turn whole too.
- C3 [R1] says the crow never overlaps either object. F33 applied the perch takeover only to the roaming perch list.

Build under audit.
- The G2 round 3 builds in the worktree: `dist/` and `dist-demo/`, 14:00. No file under `src/`, `public/`, `vite.config.ts` or `index.html` is newer, so I did not rebuild.
- G2 round 3 smokes: every one `fail []`, `errors []`. `pokes-demo` M_away failed once and passed on its rerun.
- dist chunks:
  - `index-C_iSAGdO.js` 507.9 KB
  - `LivingWorldDirector-DtfWw-Zy.js` 278.7
  - `WorldReach-rK9IS6NS.js` 48.2
  - shared: `reachLevel` 0.4 + `faultMarker` 1.0 + 1.2
  - `FaultMarker` 8.5
  - CSS 41.6
- dist-demo chunks: index 508.5, Director 278.7, WorldReach 48.2, CSS 41.6 + demoEnd 2.7.
- Headroom against the 2026-10-29 caps:
  - Director chunk about 1.3 KB (cap 280);
  - lazy world total about 0.5 KB (329.5 of 330);
  - WorldReach about 1.8 KB.
  - Every fix below is kept byte-lean. F43 removes bytes. The EM re-measures at the next gate.
- `vite preview` ran on :4174 (dist) for every run, and on :4177 (dist-demo) for the demo pass. I killed both; netstat is free and no node or headless browser is left.
- One Playwright browser at a time; all runs were sequential.

Evidence root `<A3>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28b/ad3/`.
- Runs:
  - cast: `cast/` (60 s screencasts, 1080p, UI 100), `cast150/` (1080p / 720p / Deck at UI 150), `cast100-720/`;
  - reactions: `react/`, `react2/`, `react-era/`, `rapid/`;
  - reach and frames: `reach/` (incl. `*-rm`), `frames345/`, `frames345-150/`;
  - F23 / F24: `f23/`, `f23q/`, `keep/`, `keep-all/`, `post150/`;
  - producers and cells: `prod/`, `cells/`, `point2/`;
  - hover and bubbles: `hovergrid/`, `bub/`;
  - store: `store-1080/`, `store-2160/`;
  - demo: `demo/`, `demo-react/`.
- Logs are in `logs/`, boards in `crops/`.
- Tools: the AD4 round 1 tools (`WP28b/ad4/tools/`, run from there), plus `<A3>/tools/`:
  - `rapid.mjs` (a 24-click burst);
  - `point2.mjs` (the point check, with the 30 s find pair cooldown respected);
  - `keepan.py`, `keepfr.py`, `keepboard.py` (KEEP timelines);
  - `hudcheck.py` (cast boxes against the HUD at UI 150);
  - `strip.py` (screencast strips);
  - `runA.sh`-`runE.sh`, `chain.sh`.

**1. Roaming cast**

| check | verdict | reading / evidence |
|---|---|---|
| nothing reads frozen | PASS | Longest action gap, Inspector / dog / crow (castan, 250 ms samples):<br>- e1 6.7 / 7.8 / 8.8 s<br>- s9 6.2 / 10.5 / 7.4<br>- s11 6.3 / 5.9 / 7.5<br>- s15 7.5 / 11.0 / 8.6<br>- s13: the conductor switches every 9.4 s (F34 fixed; round 1 12.1)<br>G2 roam: A_gap 6.2-11.6 s, s13 9.8. Boards: `crops/cast/*` |
| walks, yard lanes, range | PASS | Walk share in 60 s: Inspector 9-23 %, dog 4-29 %. roam B covers 100 % of the spot range. Walkers pass behind the lines (`crops/F25-e1-bicycle-wake-visit-x2.png`) |
| machine, objects, tripod, facing | PASS | In about 2,500 cast samples:<br>- 0 feet in a Splice box at its lane;<br>- 0 Inspector or dog x in the machine x-range (N13 s15 dog front row kept);<br>- 0 profile rest frames facing the machine (one mid-walk glance, N25);<br>- the Inspector and the dog stay at least 868 px apart |
| UI 150 at 1080p, 720p and Deck | PASS (R2) | `hudcheck.py`: only the dog's front row meets the buttons:<br>- s9: 10-15 % of its box under SYSTEM<br>- s15: 44-51 % under REFOCUS, 17-22 % under SYSTEM<br>Ruling R2. The Inspector, the crow and every object stay clear (`frames345-150/`) |
| UI 100 at 720p | PASS | `cast100-720/`: gaps 5.7-11.2 s, 0 facing errors |
| Sensor 7, girl | PASS | Sensor 7's x is constant. The girl never moves (window / mini / 880 / 976) |
| demo :4177 | PASS | e1 / s9 30 s: gaps ≤ 7.9 s, 0 facing errors, `errors []`. e1 bicycle wake: the dog's visitSniff walk starts at 6.1 s (`demo/`, `demo-react/`) |

**2. Reactions (C1)** (`react/` wake and burst; `react2/` clean fault, clear and Find at e1, s9, s11 and s15; `react-era/`; `point2/`; `rapid/`; read with `reactan.py`)

| cause | verdict | reading |
|---|---|---|
| fault | PASS, with F41 | - Inspector startle at 481-540 ms (e1, s9, s11); era V at 486 ms.<br>- Dog bark0/1 outward at 550 ms (s9) and 566 ms (s15).<br>- Crow ruffle, then a hop to the highest perch: s9 the drop wire; s15 bicycle seat → vane top.<br>- e1: the dog was inside its crowMove lookUp reaction and never barked (F41a).<br>- s11: the dog barked at 2.73 s, after a 2.3 s voice glance (N23) |
| fault clear | PASS | writeTick 273-354 ms, wag 477-660 ms, crow settle, Sensor 7 blink |
| Find | PASS (F29 fixed), with F41 | - Dog sniffFind / sniffHere at 0.54-1.11 s; crow glanceDown at 0.86-1.43 s.<br>- Inspector lookFind on far-wing Finds at 3.5-4.6 s: e1 crow drop and dog dig, the F29 case. N26: e1 at 4.58 s.<br>- `point2`, 6 Finds 38 s apart: point at 2.39 s toward an outer gust, facing away (`crops/cells-ingame-point-e1-x3.png`).<br>- Two of the 6 got no Inspector answer: he walked past the Find's x during the find delay, and the scheduled point or lookFind no longer held at its due time (F41b) |
| big buy + ground wave | PASS (F31 fixed), with F42 | - Startle as the wave passes his x: 294 / 330 / 832 ms (e1 / s9 / s11).<br>- Dog lookBig at 194-802 ms; lookBigV at 79 ms (era V).<br>- Crow ruffle, with its 30 % hop.<br>- At s11 the 2-frame startle clip wraps (hold above 2 s): startle → lookUp → startle again for 114 ms (F42) |
| crank burst (`rapid`) | Note, F47 | 24 clicks in 2.9 s (the rapid cue needs 18 in 3 s): the crow did not ruffle in 2 of 2 bursts (e1, s11; the default chance is 0.5). Round 1's 14-click burst never reached the cue |
| era change | PASS, with F41 | - e1 → s8: the Inspector walks 1536 → 1552 and holds front from 2.25 s; crow perchHead at 0.95 s; dog eraHead at 1.54 s; Sensor 7 headC.<br>- s9 → s10: the Inspector stayed in a Splice visit (visitWrite) and skipped eraFront (F41a).<br>- Era IV takes no machine-event reaction (R3) |
| Splice wake and visit | PASS (F25 fixed) | - e1 bicycle: the dog walks to 2440 from 7.1 s and sniffs toward the bicycle from 8.4 s.<br>- s9 sign: visitSniff from 4.4 s.<br>- roam D_visit at 7.4 s; demo at 6.1 s.<br>- s11 hydrant: exempt (boxed in, AD3 C-c).<br>Board: `crops/F25-e1-bicycle-wake-visit-x2.png` |
| crow hops | PASS | Right wing only, ≤ 160 px, never over the machine, none in era IV. s15 vane → bicycle seat apex: 55 px above the higher end (cap 48; N27) |

**3. Reach FX (D6)** (`reach/`, `reach/*-rm`, G2 roam E)

| effect | verdict | reading / evidence |
|---|---|---|
| crank ground pulse | PASS (F38 fixed) | +6 per 10 clicks. The 8 art px dash is cream in eras I-II and V and gold `#ffd27a` in III-IV, and it now reads on the sand. `crops/reach-e1-click-pulse-left-x3.png`, `crops/reach-s11-click-pulse-left-x3.png`, `crops/reach-s13-click-pulse-right-x3.png` |
| ground wave | PASS | +1 per big buy, at least 3 s apart; the startle is timed to it |
| base dust, pylon dots | PASS | Pylon dots 2 / 2 / 4 / 6 at s9 / s11 / s13 / s15, at 120 px/s along the catenary |
| lamp wobble | PASS | Glow alpha 0.13-0.69 (s13), swings under 1 per s. Steady under RM (only the lamp's one-way switch-on fade) |
| arcs (II) | PASS (F37 fixed) | 4 arcs in 12 s (0.33 per s), 90 ms each; tip `#c98552` in data |
| steam drift (III) | PASS | 1-5 puffs behind the cast |
| hum (IV) | PASS (F35, F36) | Lamp 3102 ↔ 3106, booth hood 3048 ↔ 3052, clock 2888 ↔ 2892: 1 art px. The hands draw at `clockOrigin`, so they move with the face. 4:41 holds (`crops/clock-s13-hum-4stills-x9.png`) |
| debris lift (V) | PASS | 3 → 9 specks rise and hang by the feet; RM shows 9 static specks. `crops/reach-s15-still-left-band-x2.png` |
| flash limits | PASS | Every flash kind stays ≤ 3 Hz (arcs 0.33 per s, lamp swings under 1 per s, ground pulse ≤ 4 per s and not a flash). Every FX is far below the WCAG 2.3.1 general-flash area: 25 % of a 341 x 256 CSS px block is 21,824 px². The largest FX, the lamp glow (about 60 x 40 px, alpha swing 0.12 L), is not a flash pair at all. Nothing reads as a screen effect |
| reduced motion | PASS | Every part is 0 in e1-s15; debris static; lamp steady |
| photo mode | PASS | Parts frozen over 1 s in every era |
| cost | PASS | `reachStats().meanMs` 0.044-0.094 ms (≤ 0.12). G2: world G_cost 0.263 / 0.272, display 68 / 92 |

**4. Era III-V Splice objects, lines and perches** (`frames345/`, `frames345-150/`, `keep-all/`, `hovergrid/`)

| check | verdict | evidence |
|---|---|---|
| dead, woken and whole frames | PASS | Pump, whistle (with its plume), hydrant, bell, gramophone, chimes, vane, kite, cairn, coin flap. `crops/obj-s11c-*-dead-woken-x2.png`, `crops/obj-s13c-*`, `crops/obj-s15c-*` |
| lines III-V | PASS | Pipe, standing-wave wire, lifted specks; each starts at the outer base foot and none crosses the machine |
| pulses on every woken line | PASS (F27 fixed) | s11 1-2, s13 1-3, s15 1-3: no woken line shows 0 (`frames345/frames-ui100.json`) |
| roaming perches (vane, kite) | PASS (F33 fixed) | - The crow stands cleanly on the vane finial (`crops/F33-s15-crow-vane-x6.png`).<br>- On the lamp-arm end its tail covers the dead kite's right 3 art px (N24, `crops/F33-s15-crow-arm-x8.png`).<br>- The s15 bicycle seat sits under the hanging chimes: the crow touches the chimes' pendant (F43, `crops/F43-s15-crow-bicycle-seat-chimes-x8.png`) |
| ending perches (finale, KEEP, postgame) | FAIL (S2, F45) | `crops/F45-keep-I-II-crow-vane-kite-x4.png`, `crops/F45-keep-all-crow-vane-kite-x5.png`, `crops/F45-store09-crow-kite-string-x8.png` |
| UI 150 placements | PASS | Every era III-V object stays clear of the buttons and the panel (`frames345-150/s15c-ui150-1920x1080-woken.png`) |
| hover and tooltips | PASS (F26, F28 fixed), with F46 | - `hovergrid` at s13 and s15, 1080p and Deck, UI 100 and 150: 18 targets each, 0 hover misses in 8 runs. Every target hovers at its own centre.<br>- At the right edge the slab ends 0.0-1.2 px past the viewport and loses its right border (F46, `crops/tip-s15-kite-right-edge-x3.png`) |

**5. New cells, Find producers, poke bubbles**

| check | verdict | evidence |
|---|---|---|
| startle, point, bark0, bark1 | PASS | - Sheets: 6 era rows each (`crops/cells-inspector-idle-startle-point-6rows-x4.png`, `crops/cells-dog-idle-bark0-bark1-6rows-x4.png`).<br>- In game: startle and bark0 at e1, s9 and s11, all facing away (`crops/cells-ingame-startle-bark-e1-s9-s11.png`); point at e1 toward the outer gust (`crops/cells-ingame-point-e1-x3.png`).<br>- N28: the s9 dog's bark head touches the sign's left edge |
| Find producers | PASS (F32 fixed) | - e1 dog Finds with the dog 80-100 px away: no dig, the item shows alone.<br>- s9: the dog digs at its own item.<br>- The other producers behave as in round 1.<br>`crops/F32-finds-producers-dog-crow-coin-x3.png` |
| poke bubbles | PASS | `Noted.` and `…` show on level-2 ladders at e1, s11 and s15, above the speaker. With WORLD VOICES OFF, none in 8 ladders. `crops/poke-bubbles-e1-s11-s15-x2.png` |

**6. Store shots** (`store-1080/`, `store-2160/`): both `fail []`, `errors []`; every `_no_output_tick`, `_no_fault` and `_no_find` check passes.
- 01-06, 08 and 10 are re-approved at 1080 and 2160. The 2160 set is pixel-crisp (`crops/store2160-07-right-1to1.png`).
- 07: the crow now stands on the lamp-arm end, not on the kite (round 1). Its tail still covers the dead kite's right edge (N24). Approved.
- 09: blocked by F45 (the kite string rises out of the crow). Compare `crops/F33-store07-09-right-r1-vs-r3-x4.png`.
- The other diffs against round 1 are machine animation phases only.

**7. AD2 round 3 carry-overs**
- F23 PASS: in RM, the 2 x 2 art px `#c98552` dot lies outside each box:
  - sign at s9 and s11b, in the beat frames before the dog sits on the line end (later frames hide it behind the dog);
  - radio at s9, s11b and s15.
  - Evidence: `crops/F23-rm-dots-sign-s9-s11b-radio-s9-s15-x5.png`.
- F24 PASS, both the era I-II set and all 16:
  - the objects hold their portrait cells to K+4.0 s, fade by about K+4.4 s and are hidden from 4.5 s;
  - they re-place at K+4.68 s while hidden and fade in 5.0-5.6 s;
  - no frame shows an object in two places;
  - the dog fades at K+4.0-4.5 and re-enters at K+7.0 to 732, with the organ already at 810;
  - the whistle appears at 3166 and the gramophone at 958 inside the same window;
  - post150 matches round 1.
  - Evidence: `crops/F24-keep-timeline-x2.png`, `crops/F24-keep-all-timeline-x2.png`.

**Canon notes**: all hold.
- The girl never moves.
- No blue or green pixel in the WP28b art or FX before the finale.
- No letters in the art.
- The clock rests at 4:41 and the hum moves its hands with the face.
- No denizen at rest faces the machine, and denizens react to effects, never to the machine.
- The crow hops on the right wing only and never in era IV.

**8. F-list**

| F | sev | kind | file | key | old -> new |
|---|---|---|---|---|---|
| F45 | S2 | DATA+CODE | `src/data/worldEnding.ts`, `src/game/math/worldFinale.ts`, `src/game/math/worldFinale.test.ts` | ending crow rest and KEEP hop | - Data: new `WORLD_ENDING.crowRest = { dx: 30, dy: 26 }`, the kite's lamp-arm perch (3134, G-86) against the lamp top (3104, G-112).<br>- Code: `worldFinale.ts` adds `crowRest` to the dx and dy of every crow pose it returns (film, choice, LAST LOOK, KEEP, postgame loop), so the crow rests, takes off, glides back and loops on the arm end.<br>- Data: `keep.hopDx` -54 -> -84 and `keep.hopDy` 10 -> -52, so the KEEP beat hops to the vane finial (3050, G-138). It is the vane's `perchTop`; the vane stands on the booth apex in every ending.<br>- Tests re-pinned by exactly these offsets |
| F41 | S3 | CODE | `src/game/math/worldBehaviour.ts`, `src/game/math/worldBehaviour.test.ts` | runner `reactGate` / `applyPending` / `haltEnd` | (a) A machine-event reaction (cue in `WORLD_REACT.haltCues`) pre-empts a current reaction whose activity is interruptible: the crowMove / ring lookUp and the Splice visits. A non-interruptible reaction still blocks it.<br>(b) A due reaction whose `when` no longer holds re-picks the first eligible sibling for the same cue whose `when` holds (point ↔ lookFind, sniffFind ↔ sniffHere), instead of being dropped |
| F42 | S3 | DATA | `src/data/worldBehaviour.ts` | `INS_REACT` / `INS_REACT_V` startle `holdMs` | [1800, 2200] -> [1800, 2000] (the 2-frame clip at 1 fps ends on lookUp, never wraps) |
| F43 | S3 | DATA | `src/data/pokes.ts`, `src/game/math/pokes.test.ts` | `CROW_PERCHES.s15` | Drop the `bicycleSeat` perch (3145, G-26): it sits under the chimes pendant. s15 keeps lampTop (the arm end through the kite) and boothRoof (the vane top) |
| F46 | S3 | DATA+CODE | `src/data/findWorld.ts`, `src/game/rendering/PokeLayer.ts` | `POKE_LAYOUT.tipEdgePx`; `placeTip` clamp | New `tipEdgePx: 8`. The x clamp becomes `[edge, vw - tw - edge]` (rounded), and above / below need `edge` px from the root's top / bottom. The slab keeps its border at the right edge |
| F47 | S3 | DATA | `src/data/worldBehaviour.ts`, `src/data/worldBehaviour.test.ts` | `WORLD_REACT.chanceByCue` | += `rapid: 1` (a crank burst always ruffles the crow, within the 30 s pair cooldown) |

```
WP28B-AD4R3-FIX-BEGIN
F45 DATA+CODE src/data/worldEnding.ts crowRest {dx 30, dy 26}, keep.hopDx -54 -> -84, keep.hopDy 10 -> -52; src/game/math/worldFinale.ts adds crowRest to every crow pose; worldFinale.test.ts re-pins (S2)
F41 CODE src/game/math/worldBehaviour.ts machine-event cues pre-empt interruptible reactions; a due reaction whose when fails re-picks its cue sibling (S3)
F42 DATA src/data/worldBehaviour.ts INS_REACT and INS_REACT_V startle holdMs [1800,2200] -> [1800,2000] (S3)
F43 DATA src/data/pokes.ts CROW_PERCHES.s15 drops bicycleSeat; pokes.test.ts re-pins (S3)
F46 DATA+CODE src/data/findWorld.ts POKE_LAYOUT.tipEdgePx 8; src/game/rendering/PokeLayer.ts placeTip clamps with the edge margin (S3)
F47 DATA src/data/worldBehaviour.ts WORLD_REACT.chanceByCue rapid 1; worldBehaviour.test.ts re-pins (S3)
WP28B-AD4R3-FIX-END
```

Notes (no fix):
- N23: a world-voice glance pauses its speaker's runner. The pause can catch the dog mid-walk:
  - at s11 it held the head pose for 2.3 s at 3096 lane 39, behind the bulb sign, so it read as standing on the sign table (`crops/s11-fault-dog-glance-x2.png`);
  - a 10.4 s glance also made the one 13.8 s castan gap (s11, UI 150).
  - This is the WP24 turn rule; it is rare and the dog is visibly turning, so no fix.
- N24: on the lamp-arm end the crow's tail covers the dead kite's right 3 art px (store 07). The arm ends at about 3139, so there is no room further out. Accepted; it is better than round 1.
- N25: one mid-walk `glance` frame faced the walk direction toward the machine (e1, Deck, UI 150, about 250 ms). Walks face their travel direction.
- N26: the far-wing Find answer can start up to 4.6 s after the spawn (band 2-4 s), when the Inspector finishes a walk first.
- N27: the s15 hop from the vane top peaks 7 world px above the 48 px apex cap (unit-tested law; era V reversed frames). Not visible.
- N28: at s9 the barking dog's head touches the sign's left edge (dog spot 2900, sign box from 2928).
- N29: the booth's glazing bars read as "UH" pairs at 3x. It is pre-existing WP23 art, and they are panes, not letters. Out of WP28b scope; a later art pass may break the pairs.
- N13, N14 (R2), N15 (R3), N17 (now F46), N20 and N21 hold.

Re-check for the next round, on fresh builds of the fixed tree:
- F45: rerun `keep2.mjs` (era I-II set and `ALL=1`) and `store-shots.mjs SIZES=1080`. Expected:
  - the crow rests on the lamp-arm end through the choice phase and the postgame;
  - the kite string stays clear of it;
  - the KEEP beat lands on the vane finial with the mast below its feet;
  - store 08 / 09 are re-approved.
- F41: rerun `react2.mjs COOL=14000 SHORT=1 ONLY=e1,s9` and `react2.mjs ERA=1 ONLY=s9` (eraFront at s10 during a visit), and `point2.mjs`. Every fault gets a bark; every Find gets an Inspector answer.
- F42: rerun `react.mjs ONLY=s11`; the startle ends on lookUp.
- F43: rerun `react2.mjs ONLY=s15` and `cast.mjs ONLY=s15`; the crow never lands under the chimes.
- F46: rerun `hovergrid.mjs` at s13 / s15; every slab sits at least 8 px inside the viewport with its border whole.
- F47: rerun `rapid.mjs`; the crow ruffles on each burst.
- R6 (EM round 1 gate note): the e1 bicycle seat perch moved from G+70 to G+68 (`CROW_PERCHES.e1`, so the lamp top reaches it in two hops through the clock top, 47 + 159.4 px). The crow's feet may float 1 art px above the drawn seat. AD: wake the e1 bicycle (`react2.mjs` or `cast.mjs` at e1), let the crow land on the seat via the clock top, and crop the feet at 3x. If the 2 px float is rejected, fall back to R6 option (b): the seat back at G+70, the crow stays put, and `pokeRender.test.ts` and `pokes.test.ts` are re-pinned.
- The EM re-measures the bundle rows; the lazy world total had about 0.5 KB of headroom.

### AD4 - WP28b in-game audit, round 4 (Art Director, 2026-10-31; WP28b fix round 2)

**Verdict: RELEASE-READY (B10).** F41, F42, F43, F45, F46 and F47 are fixed on fresh builds of the fixed tree. R6 passes. No new S1, S2 or S3 row. Four notes (N30-N33), no fix.
- F45 (the round 3 S2 row) is fixed in every ending:
  - the crow rests on the lamp-arm end through the choice phase and the postgame;
  - the kite string stays clear of it;
  - the KEEP beat lands on the vane finial with the mast below its feet.
- Store 08 and 09 are re-approved at 1080 and 2160.
- Round 3's passes still hold: roaming gaps, reach FX in every era, reduced motion, canon, F23 and F24.

Build under audit.
- `dist/` and `dist-demo/` were built at 2026-10-30 22:23 from the current tree (fe2aec7 plus the F41-F47 / R6 working-tree diff). No file under `src/`, `public/`, `vite.config.ts` or `index.html` is newer, so I did not rebuild.
- The chunks carry the fixes: `crowRest:{dx:30,dy:26}`, `twoHopHoldMs:600`, `tipEdgePx:8` and `rapid:1`.
- dist / dist-demo chunks:
  - index 507.9 / 508.5;
  - Director 280.000 / 280.005;
  - WorldReach 48.299 / 48.304;
  - shared 2.5 (`faultMarker` 1.1 + 1.0, `reachLevel` 0.4);
  - FaultMarker 8.5 (unchanged);
  - CSS 41.6 (demo +2.7 `demoEnd`).
- Against the R5 caps: lazy world total 330.9 (cap 334), Director 280.0 (cap 284). The EM's `perf-budget.json` rows are measured + 1.
- `vite preview` ran on :4174 (dist), twice, and on :4177 (dist-demo) for the demo pass. I killed each one after its runs; netstat shows both ports free and no node or headless browser is left.
- One Playwright browser at a time; every run was sequential.

Evidence root `<A4r4>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP28b/ad2/`.
- Runs:
  - F45: `keep/`, `keep-all/`, `store-1080/`, `store-2160/`, `post150/`;
  - reactions: `react2/`, `react-era/`, `fault3/`, `fault3-s11/`, `point3/`, `react/`, `react2-s15/`, `rapid/`;
  - R6: `crowR6/`, `crowR6b-a/`, `crowR6b-b/`, `crowR6c/`;
  - hover: `hovergrid/`;
  - spot checks: `cast/`, `cast150/`, `cast100-720/`, `reach/` (incl. `*-rm`), `f23/`;
  - demo :4177: `demo/cast/`, `demo/crowR6c/`, `demo/fault3/`.
- Logs are in `logs/`, boards in `crops/`.
- Tools: the AD4 round 1 and 3 tools, plus `<A4r4>/tools/`:
  - `fault3.mjs` (4 faults per stage, 31 s apart);
  - `point3.mjs` (6 Finds, no early stop);
  - `hovergrid2.mjs` (slab margins inside `#ui-root`);
  - `crowR6.mjs`, `crowR6b.mjs`, `crowR6c.mjs` (the bicycle wake and the level-3 poke; extra big buys; the TECH INDEX unseen moment parks the crow on the lamp top);
  - `keepcrow.py`, `pair.py` (boards).

**1. Round 3 F-list re-check**

| F | verdict | reading / evidence |
|---|---|---|
| F45 (S2) | PASS | KEEP, era I-II set and all 16:<br>- K-0.5 s (choice): the crow sits on the lamp-arm end, right of the dead kite (all 16: right of the woken kite's pole).<br>- K+3.3-3.9 s: three pecks on the vane finial; the mast is below its feet, and the crow never covers the vane rotor.<br>- K+6 to K+12 s: back on the arm end; the whole kite's string rises from the lamp top clear of the crow.<br>- Store 09 (1080, 2160): the feet stand on the arm's top row (`crops/F45-store09-crow-feet-arm-x10.png`).<br>- Store 08: arm end, with the tail over the dead kite's right edge (N24, as store 07).<br>- `post150`: at UI 150 the crow clears SYSTEM by about 40 px (1080) and 30 px (1280x800).<br>Boards: `crops/F45-store09-right-r3-vs-r4-x4.png`, `crops/F45-store08-right-r3-vs-r4-x4.png`, `crops/F45-keep-I-II-rest-peck-r4-x6.png`, `crops/F45-keep-all-crow-r4-x5.png`, `crops/F45-store2160-09-right-x2.png`, `crops/F45-post150-crow-vs-buttons.png` |
| F41a | PASS | `fault3`, every fault got a bark and a startle:<br>- e1: 4 / 4, bark at 605-683 ms (1914 ms from sleep);<br>- s9: 4 / 4 (1755 ms from sleep);<br>- s11: 2 / 2 barks;<br>- demo e1: 2 / 2.<br>`react2` e1: the dog was in lookUp at the fault and barked at 632 ms (the round 3 F41a case); the Inspector left visitWrite and startled at 511 ms.<br>`react-era` s9 → s10: eraFront and eraHead start on the card close (round 3: skipped during a visit).<br>One s11 fault met the Inspector under his umbrella and got no startle (N32) |
| F41b | PASS | `point3`, 6 Finds 38 s apart at e1: 6 / 6 got an Inspector answer at 2.9-4.1 s (5 lookFind, 1 point).<br>In try 2 he walked past the gust's x during the delay, and the point replaced the lookFind (the sibling swap). He points away from the machine toward the item (`crops/F41b-e1-point-gust-swap-x3.png`).<br>`react2`: e1 lookFind at 4.6 s (N26), s9 at 3.6 s |
| F42 | PASS | The startle is 1.0 s startle, then 0.9 s lookUp, and it ends on lookUp, with no wrap:<br>- s11 wake (`react`): startle 1060 → lookUp 2074 → write 2959 ms;<br>- e1 / s9 faults: lookUp at about 1.0 s, a stand or walk from 1.9-2.0 s |
| F43 | PASS | s15 (`react2-s15`, `cast` 60 s): the crow stands only on the vane top (3050, G-138) and the arm end (3134, G-86), plus its flights. No feet below G-86, so it never lands under the chimes |
| F46 | PASS | `hovergrid2` at s13 and s15, 1080p and Deck, UI 100 and 150: 18 targets each, 0 hover misses.<br>- Every Splice slab sits 7.5-11.7 px inside `#ui-root` with its 2 px border whole.<br>- The kite at Deck UI 100: 7.5 px (round 3: 0.0-1.2 px past the edge).<br>- `crops/F46-tip-s15-kite-1280x800-r3-vs-r4-x3.png`. N31 |
| F47 | PASS | `rapid` (24 clicks in 2.8-3.1 s): ruffleReact at 3968 / 4101 / 4000 ms at e1 / s9 / s11, 3 / 3 (round 3: 0 / 2) |

**2. R6 (the crow's two-hop landing)**

| check | verdict | reading / evidence |
|---|---|---|
| e1 bicycle wake from the lamp top | PASS | `crowR6c` (dist and dist-demo): the crow sits on the lamp top (2476, G-112).<br>- At 5.66 s it hops to the clock top (2516, G-88; 47 px).<br>- It holds 1.2 s, then hops at 7.37 s to the seat (2483, G+68; 159.4 px).<br>- It lands at 8.37 s (demo: 7.38 / 8.39 s).<br>Every x stays at 2476 or more; the e1 machine ends at 2316. `crops/R6-e1-two-hop-lamp-clock-seat-x2.png` |
| from the booth roof or the clock top | PASS | `crowR6`, `crowR6b`: booth roof → clock top (97 px, the 30 % big-buy hop) → seat (159.4 px), or clock top → seat in one hop. Every wake (5 dist, 1 demo) ended on the seat. `crops/R6-e1-bicycle-wake-crow-path-x2.png` |
| level-3 poke on the seat | PASS | `crowR6` run 0: 4 pokes (crowCaw, crowTurn, crowCaws, crowHopBeat). After the caw beat the crow hops from the seat to the clock top (159.4 px); the lamp top (180 px) and the booth roof (181 px) are skipped as out of reach |
| the seat contact (G+68) | ACCEPTED (N30) | The feet stand 1 art px (3 screen px at e1 zoom 1) above the drawn saddle. Visible at 3x, a hairline at 1:1 on a dark saddle. Accepted for the R6 landing beat (R6 option a). `crops/R6-e1-crow-seat-1to1-x3.png`, `crops/R6-e1-crow-seat-feet-x8.png` |

**3. Spot checks (round 3 passes)**

| check | verdict | reading |
|---|---|---|
| roaming (60 s, 1080p, UI 100) | PASS | Longest action gap, Inspector / dog / crow:<br>- e1 6.3 / 8.1 / 8.6 s<br>- s9 5.8 / 10.7 / 7.5<br>- s11 6.3 / 5.7 / 7.6<br>- s15 7.7 / 11.8 / 8.8<br>- s13: the conductor switches every 9.7 s<br>0 facing errors, 0 feet in a Splice box, 0 Inspector or dog x in the machine x-range (N13: the s15 dog's front row is kept). The Inspector and the dog stay at least 868 px apart. Sensor 7's x is constant; the girl never moves |
| UI 150 (1080p, 720p), 720p UI 100, demo | PASS | Gaps 5.7-11.5 s, 0 object hits.<br>One mid-walk `glance` frame faced the walk direction (e1, 720p, UI 100, one 250 ms sample; N25, the R7 watch item). Demo e1 / s9 gaps are 8.2 s at most |
| reach FX | PASS | Every era shows its effect:<br>- ground pulse (+11) and wave (+3);<br>- base dust;<br>- pylon dots 2 / 2 / 4 / 6;<br>- arcs at s9;<br>- drift 4 at s11;<br>- hum at s13 (lamp 3102 ↔ 3106, booth 3052);<br>- debris 8 at s15.<br>`meanMs` 0.046-0.097 (cap 0.12). Reduced motion: every part 0, with the debris static. Photo mode: the part counters hold over 1 s, as in round 3 |
| F23 | PASS | Reduced motion: the radio dot sits outside its box at s9 (16 px) and s15 (9 px). The sign dot shows at s9 in the beat frames, then hides behind the dog, as in round 3 |
| F24 | PASS | Era I-II set and all 16:<br>- the dog fades at K+4.0-4.5 s;<br>- the objects re-place at K+4.74 s while hidden;<br>- the dog re-enters at K+6.95-8.0 s (543 → 732).<br>Same as round 3 |
| store shots | PASS | 1080 and 2160 both `fail []`, `errors []`. Against round 3, 01-07 and 10 differ only in the machine's animation phase (`crops/store02-r3-vs-r4-half.png`) |
| canon | PASS | - The girl never moves. Sensor 7 faces the camera.<br>- No denizen touches, overlaps or walks through the machine.<br>- Reactions follow effects, never the machine.<br>- The crow hops 160 px at most, never over the machine, and none in era IV; it is off-stage at s10.<br>- No WP28b blue or green pixel before the finale. No letters in the art. The clock keeps 4:41 |

**4. F-list**: none.

Notes (no fix):
- N30 (R6): the e1 bicycle-seat perch at G+68 leaves the crow's feet 1 art px above the drawn saddle.
  - Accepted: it buys the lamp-top two-hop landing, and the gap is a hairline at 1:1.
  - If a later art pass wants it flush, raise the saddle 1 art px in `splices-a.png` cells 0-4 (the seat post grows by 1 px).
  - That pass also moves `perchTop.dy` -26 → -28 and the s9 / s11 seats G+104 → G+102. One package, with its tests.
- N31 (F46): the x clamp rounds the slab's left edge to whole px, so a fractional slab width leaves 7.5-8.5 px at the right edge (Deck, UI 100). The border is whole.
- N32 (F41): the Inspector's umbrella hold (rain) is not interruptible, so a fault during it gets no startle (s11, 1 of 2). The dog and the crow still answer. It is the weather rule.
- N33 (F45): on the vane finial the peck frames dip the beak into the air right of the finial. No mark is drawn, so no surface is needed; it reads as the crow bobbing. Watch it if mark 42 is ever drawn on the booth glass.
- N27 widened: the e1 clock top → seat hop peaks 60 px above the clock top. `crowArcY` adds |dy| / 2 + apex, so steep hops rise above the 48 px apex. Not visible as a fault.
- N13, N14 (R2), N15 (R3), N20, N21, N23, N24, N25 (R7 watch), N26, N28 and N29 hold.

Re-check list: none for WP28b.
