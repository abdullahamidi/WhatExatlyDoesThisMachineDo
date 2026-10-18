# Art — Era II (Electrical) set

Authority: `docs/plan/WP8.md` §C3 is the contract (ids, files, sizes, origins, frames). This file adds art notes, exact
local geometry, and **Contract change requests** (CR, at the end). Nothing here overrides §C3 until the Director accepts a CR.
Coordinates: machine-local art px, origin = frame base centre, +y down, ground row y = −1 (contact on y 0). "corner" = pixel-grid corner.
Era II grows to the **right** (+x) of the flywheel (roadmap §1). Right edge 444 ≤ `MACHINE_BOUNDS.right` 448.

## 1. References → rules
- Edison bipolar "Long-legged Mary Ann" dynamo (Smithsonian NMAH 1287625, https://www.si.edu/object/nmah_1287625; IEEE EMC newsletter
  https://ewh.ieee.org/soc/emcs/acstrial/newsletters/fall09/Its_a_Dynamo.html): two tall field coils rise from two pole shoes, joined by an iron
  yoke on top; drum armature sits **between the pole shoes at the bottom**; commutator + brush rocker on the shaft; a wheel on the armature
  shaft takes the belt. → generator silhouette, shaft low.
- Belt-driven dynamos sit on slide rails, a screw pulls the feet back to tension the belt (US697998A https://patents.google.com/patent/US697998A/en).
  → generator plinth = cast bedplate with slide rail slot + tension screw at the right end.
- Leyden-jar battery: jars in parallel, brass rod + ball knob per jar, knobs joined by a brass bar; discharger = two brass balls across an
  adjustable gap (Museo Bergamo https://www.museoscienzebergamo.it/fisicaalmuseo/en/strumenti-en/battery-of-leyden-jars/, Teylers
  https://beeld.teylersmuseum.nl/digital_library/Emags/Van_Marum%27s_Scientific_Instruments/page_101.html). → rack + spark gap on top.
- Oil transformer: tank + cooling tubes, porcelain bushings with metal flanges on the lid (https://electrical-engineering-portal.com/transformer-tank-bushings-insulation-impedance).
- Line insulators: aqua glass (Hemingray) on pins; the wire is tied in the groove, not on the top (https://www.insulators.info/general/profiles/106hemi.htm).
- Arc lamps (Brush 1880, https://lafavre.us/brush/lamparc.htm) researched; not in §C3 (mast is 16 px wide, no room). Kept as an idea only.
- House rules kept: R1 axles end-on (pulleys face-on), R2 open belt tangents + wrap on the side away from the other pulley, R4 every part
  stands on steel/ground, RotSprite sheets for rotating parts, locked palette, alpha 0/255 only, crop/pad/hand-pixel only (no resampling).

## 2. Palette
Rust Wasteland (ART_BRIEF) + cyan ramp `#2f5a62 #5fa8b4 #bff0ec` (accents only: glass insulators, jar glass, arc, lit lamps).
Material mapping: copper windings = rust ramp `#6e3a22 #8c4a2a #ad6236 #c98552` in clean horizontal bands (rust = patches) + `#f0a848` glints;
brass knobs/electrodes = `#c98552 #8c4a2a` + `#ffd27a` glint; porcelain bushings = sand ramp; tin foil = iron light `#7d8286 #a3a6a4`.
All 12 PNGs + overlay verified: every opaque pixel is a palette colour, alpha ∈ {0,255}.

## 3. Power flow (mechanical + electrical, every stage coherent)
crank / motor → (existing belts) → flywheel shaft F (150,−56) → **double-groove hub pulley** (existing `flywheelPulley`, new point `belt2`, r12)
→ open belt → generator pulley (r8, ratio −1.75, belt speed |−1.1667·12| = |−1.75·8| = 14) → Mary Ann armature → field coils →
terminals (aqua insulators on the yoke) → capacitor rack (Leyden battery) + spark gap across it → transformer → bushing → mast → lit pylons.
Crank Dynamo: friction dynamo whose roller rides the **underside of the crank→flywheel belt's lower span** (bottle-dynamo principle), clamped to
the right X-brace of the frame; every crank stroke runs the belt → roller → EE (matches `clickEcho`). Motor Retrofit: terminal box + bonding
strap on the worn motor (feedback EE → ME).
Two belts share the hub pulley: crank belt wraps its right side, generator belt its left side → together a ring around the pulley = a
double-groove pulley seen end-on (correct for open belts, R2).
Belt (CR1, superseded by the in-game review): hub (268,−25): C = 122.0, β = 1.9°, wrap 176.2° on the r8 pulley (≥ 120° rule), 183.8° on the hub; lowest belt row ≈ −17, 2 rows clear of the generator sole bar (−14). Belt is in front of the left pole shoe (belt depth 25 > generator), pulley coaxial on the armature.

## 4. Components (files under `public/assets/`, all delivered)
| component | file | size | origin → socket | art geometry (local px = canvas px) |
|---|---|---|---|---|
| generatorPlinth | machine/era2/generator-plinth.png | 104×10 | .5,1 → (264,0) | cast bedplate: rail slot rows 1..3 with tension screw, end lug x94..98, hex head x99..102; foot strip rows 7..9; bottom row on ground. World x 212..316, top row −10 |
| generator | machine/era2/generator.png | 96×64 | .5,.5 → (264,−42) | Mary Ann seen **end-on** (R1, in-game review 2026-10-18): yoke + field coils rows 5..39 unchanged; pole shoes rows 40..58 (left x 26..45, right mirror x 58..77, feet flare, bolts (28,56)/(75,56)) embrace an end-on armature about corner (52,49) = world (268,−25): copper slot ring r 8..9.5, ink outline r 9.5..10.5, air gap r 10.5..11.5, bore face r 11.5..12.5; zinc spacer rows 57..58; foot row 59; sole bar rows 60..63 shortened to x 22..81 (bottom row = world −11 on the plinth). Terminals unchanged: world (251,−68)/(284,−68). Old side-on drum + stub shaft + pedestals removed (shaft lay in the picture plane under a face-on pulley = R1 break, and the armature axis ran through both pole shoes) |
| generatorPulley | machine/era2/pulley-generator.png + rot/pulley-generator-rot.png | 20×20, sheet 180×180 (9×9, 80 f, 4.5°/f) | .5,.5 → hub | disc r8 about corner (10,10), crowned rim, recessed web, 4 diagonal ribs + rim fleck (rotation cue). Frame k = source rotated clockwise k·4.5° (make_rot.py). Same N as the crank group (|ratio| 1.75) |
| coilStage1/2/3 | machine/era2/coils-1/2/3.png | 64×40 | .5,.5 → (264,−42) | two coils, inner x 14..23 / 47..56, rows 13..25 (stage 3: bulged x 12..25 / 45..58, brass bands rows 16/22, `#f0a848` glints). 1 = clean mid copper, 2 = bright copper, 3 = heavy winding. Stage n fully covers n−1 and the base winding |
| motorRetrofitKit | machine/era2/motor-retrofit.png | 32×16 | .5,.5 → motorMount + (0,−24) **CR3** | terminal box x10..21 rows 8..15 (row 15 on housing top −43), aqua lead-in bushing x14..17 rows 5..7 (wire tie corner (16,5) = world (−140,−54)), conduit gland x7..9, copper bonding strap x22..27 |
| crankDynamo | machine/era2/dynamo.png | 24×24 | .5,.5 → (70,−36) | canvas (0,0) = world (58,−48). Body r6 + roller r3 concentric at corner (12,6) = world (70,−42). Roller top row 3 = world −45 = under the belt's lower row (−46/−45 at x70) → contact. Casing lip one value step lighter than the frame + copper winding ring for separation. Clamp bar rows 12..14 bolted on the X-brace at (20,13). Terminal at (12,17) |
| capacitorRack | machine/era2/capacitor-rack.png | 48×64 | .5,1 → (340,0) | content x 5..42, rows 11..63. 6 identical jars (pitch 7), brass knob bus rows 17..19 / 39..41. Top tie plate rows 11..14 → **top row world −53** (spark-gap seat). Terminal lugs (aqua bolts) corner (7.5,25.5)/(41.5,25.5) = world (323,−38)/(357,−38) |
| sparkGap | machine/era2/spark-gap.png | sheet 128×48, frame 32×48 ×4 | .5,1 → **(340,−53) CR2** | art in rows 16..47 of each frame. Base plate rows 41..47 (bottom row sits on rack plate). Glass posts x2..9 / 22..29 with petticoat sheds. Balls x8..12 / 19..23 rows 16..20, gap x13..18. f0 rest (no arc), f1 arc, **f2 bright arc + corona**, f3 decay (thin) |
| transformer | machine/era2/transformer.png | 64×64 | .5,1 → (396,0) | tank x 12..58, lid rows 21..23, gauge window x 9..11. 3 identical bushings, stud pixels x 19–20 / 33–34 / **47–48**, rows 3..5 → right stud covers corner (48,4) = contract `bushing` (16,−60) = world (412,−60). Others world (384,−60), (398,−60). Bottom row on ground |
| cableMast | machine/era2/cable-mast.png | 16×112 | .5,1 → (436,0) | riveted twin-chord lattice pole (chords x1..4 / 11..14, battens every 10 rows, zigzag diagonals), cap plate rows 9..11, aqua pin insulator rows 0..8 x5..10: wire groove at corner (8,4) = contract `top` (0,−108). Foot plate rows 108..111 |
| bg.pylonsLit | bg/pylons-lit.png | 256×256 | 0,1, tileable x | **overlay only**: 128 px, transparent elsewhere. 4 insulator strings (x158..161/222..225 rows 49..58, x147..150/233..236 rows 80..89) in `#5fa8b4`/`#2f5a62` with `#bff0ec` glints + 2 px apex lamp (191..192,1). Same geometry as `bg/pylons.png` (rolled +64 version) |

Contact / support check: plinth → ground; generator sole bar → plinth; rack, transformer, mast → ground; spark gap → rack top plate (CR2);
kit → motor housing (CR3); dynamo → frame X-brace clamp; pulley → generator shaft (CR1). No floating part with all CRs applied.
Shadows (code, `MACHINE_SHADOWS` style): generatorPlinth x 212 w 104; capacitorRack x 318 w 44; transformer x 370 w 52; cableMast x 428 w 16 (h 2).

## 5. Animation
- generatorPulley: `driven` ratio −1.75, RotSprite sheet 80 frames (`rotationFrame(deg, 80)`), manifest `rotation: { file: 'machine/era2/rot/pulley-generator-rot.png', frames: 80 }`.
- sparkGap: `frames` 4, maxHz 3 (flash rule), driver electric; frame 0 = no arc, so the cycle reads as crackle with dark beats.
- crankDynamo / motorRetrofitKit: vibrate as §C3. Generator: see CR4.
- Optional generator armature spin (CR5): scratch `.../scratchpad/era2/c3/generator-spin.png` 480×64 (5 frames: 4 slot phases + 1 blur), not in public.

## 6. Contract change requests (Director decides; assets already match the requested numbers)
| # | §C3 now | requested | reason |
|---|---|---|---|
| CR1 | `generatorHub` (228,−42) | **(228,−22)** | Mary Ann armature/shaft is between the pole shoes at the bottom (refs §1); shaft stub centre in the art = (228,−21.5). At −42 the pulley floats 20 px above the shaft at coil height (evidence `crop_asis_defects_4x.png`). At −22 the belt clears the plinth by 2 rows. Belt C 85.1, wrap 174.6° |
| CR2 | `sparkMount` (290,−74) | **(340,−53)** | (290,−74) is in the air right of the generator yoke (yoke ends x 290, 16 px overhang) → floating (same evidence). Leyden battery + discharger on top is the historic assembly; rack top plate top row = −53. Sheet size/frames unchanged |
| CR3 | `motorRetrofitKit` offset (0,−30) | **(0,−24)** | at −30 the 32×16 kit bottom row is −50, motor housing top is −43 → 6 px gap (floating box, `crop_asis_motorkit_6x.png`). At −24 bottom row −44 sits on the housing |
| CR4 | generator `vibrate electric amp 1` | `none` (or amp 0) | the pulley is a fixed socket on the generator shaft; a jittering body shears off its own shaft/pulley and belt. Hum belongs in audio |
| CR5 (optional) | generator anim | `frames` 5 from `machine/era2/generator-spin.png` (driver electric, frame 4 when |ω| high) | spinning armature drum reads "dynamo running"; file ready in scratch, only shipped if accepted |
| CR6 (optional) | 1 cable link | + generator `termR` (284,−68) → capacitorRack `lugL` (323,−38), sag 4; capacitorRack `lugR` (357,−38) → transformer `primary` (384,−60), sag 3 | makes the electrical path readable end to end (generator → bank → transformer → mast). Points exist in the art |
| CR7 (note) | — | mast → pylon line: world-space parabola from mast `top` to the nearest lit pylon insulator (pylons layer x after parallax), depth just above `pylonsLit` | the roadmap's "cable to nearest pylon"; not drawable inside the machine RT |
Accent note: `MACHINE_LINK_STYLE.cable` cyan core/hi is fine at 1–2 px; keep cables thin (cyan stays an accent).

## 7. Production log
PixelLab `create_image_pro`, palette Rust Wasteland + cyan, style = flywheel anchor (344ab19d…), no_background:
generator e2e34f9f (9 cand., picked #2), capacitor 825a35e3 (16, #0), spark gap f81a0fa1 (36, reference only), transformer a6581fc8 (16, #1),
mast 17d5f9b9 (4, insulator taken from #0), magneto 31d1e85f (49, rejected: closed loop core). Curation: right coil = translated copy of left
(same light), insulators re-shaded, jars/bushings made identical by translation, drum + coil stages + base winding hand-pixelled, bedplate
widened by uniform column repeat into the plinth, right-end screw redrawn (removed glyph-like AI artefact). Hand-pixelled: pulley, spark gap
(+arc frames), dynamo, retrofit kit, mast 16×112, lit pylon overlay. RotSprite: `python3 scripts/art/make_rot.py OUT SRC '{"pulley-generator":80}'`
(script now takes optional SRC dir + parts JSON; default era-I behaviour unchanged). Build scripts: scratch `.../scratchpad/era2/tools/`.
Evidence (scratch `/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era2/`):
`mock_era2_full_3x.png` (all parts, CR1–CR3 + CR6 cables), `mock_era2_contract_links_only_3x.png`, `mock_era2_contract_asis_3x.png` (§C3 numbers),
`stages_coils_spark.png` (coil stages 0–3, spark frames 0–3), `crop_generator_6x.png`, `crop_dynamo_10x.png`, `crop_right_4x.png`.

## 8. In-game review (2026-10-18, build 3246d87 + review fixes) — what changed
- Generator redrawn end-on (see §4 row). `generatorHub` (228,−22) → **(268,−25)** in `src/data/machineComponents.ts` (+ CR1 pin in
  `machineComponents.test.ts`). npm test 908/908 green. Evidence: scratch `rev2/s2/a_s8.png`, `rev2/s2_gen_3x.png`, `rev2/s2_full_gen_3x.png`
  (before: `rev2/s/a_s8.png`, `rev2/gen_src_8x.png`).
- CSS: `.tech-node-name` wraps to 2 lines (milestone names, no ellipsis); `#tech-graph` thin rust scrollbar; toasts `text-wrap: balance`
  (no one-word orphan lines); toast stack drops behind the TECH INDEX backdrop while it is open (a SYS LOG toast covered CLOSE [ESC]).

## In-game review — code fixes
Evidence base (scratch): `/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/` + the `rev2/...` paths below.
| # | sev | file | change | why / evidence |
|---|---|---|---|---|
| F1 | high | `src/ui/techTreeView.ts` `TECH_TREE_LAYOUT` | `nodeWidth: 176 → 160`, `colGap: 48 → 28` (rest unchanged) | Era II has 6 columns (generator → … → power lines → substation; prerequisite chain is 6 deep, data cannot fold it). Graph scrollWidth 1336 vs clientWidth 1142 at 1280×720: **Substation Blueprint node is clipped off the right edge**, two edges run into the border, no visible scrollbar (overlay scrollbars). New width 40 + 6·160 + 5·28 = 1140 ≤ 1142; era I 952. Longest non-milestone names (REINFORCED CRANK, IMPROVED PISTONS, 16 ch) fit 136 px inner width; milestone names wrap via the shipped CSS. Tests use the constants → stay green. Evidence: `rev2/s/k_tree_era2.png` (bug), `rev2/tree_sim160.png` (simulated fix, edges stale in the sim only) |
| F2 | low | `src/data/world.ts` `CAMERA.fitMarginPx` + pin `src/data/world.test.ts:73-74` | `48 → 72` (Director: decision-5 number, pinned, so not changed here) | From capacitor rack to transformer (zoom-1 stages) the default view still "fits", machine sits off-centre: left margin 165 px, right 65 px, rack crowds the toast column (`rev2/s/d_spark.png`). With 72 the default view stops fitting and `fitView` recentres at zoom 1 (bounds 1050 + 144 ≤ 1280). Full era II stays zoom 0.75 (1232 + 144 > 1280) |
| F3 | info | — | none | Zoom 0.75 = 1.5 screen px per art px (half-integer grid by design): alternating 1/2 px columns, most visible on 1 px cables and the mast lattice. Accepted; only fix would be preferring integer art scale (zoom 0.5/1.0) in `fitView` |
| F4 | info | ART_ERA3 pass | none | ART_ERA3.md line 6 cites "generator hub −22" as baseline; now (268,−25). Only matters if an era III part attaches to the generator pulley/hub |
