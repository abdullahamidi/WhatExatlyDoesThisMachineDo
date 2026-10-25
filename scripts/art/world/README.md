# Living world art toolchain (WP23a, Art Director)

What: the offline tools, colour masters and frame tables behind every `world.*` sheet and `bg.windowLit`.
Why: the denizens are hand-pixelled once in colour; the six era rows (I, II, III, IV, V, whole) are baked
deterministically by `erarecolor.py` (DENIZEN_ART D2 and Appendix A), so every pixel stays on the palette and WP23b only
redraws cells. Sources are not shipped; the PNGs under `public/assets/` are.

Requirements: Python 3.12 + Pillow (numpy optional, unused). Always run with `python -I` from the repo root.

## Files

| file | job |
|---|---|
| `pal.py` | the 25 Rust Wasteland colours (ART_BRIEF) + `VIOLET_LIGHT` #9a6ad0, one character code each; `render` / `grid` |
| `sheets.py` | frame tables (column order = `src/data/livingWorld.ts` `WORLD_FRAMES`), cell sizes, files, era rows, pins |
| `erarecolor.py` | DENIZEN_ART App. A: sepia row I, per-row colour returns, row V violet rim, per-sheet pins |
| `build_sheet.py` | master frames -> sheet PNG (exact column order, 6 era rows for era-row sheets) |
| `check_sheet.py` | gate: dims == spec (and manifest when wired), RGBA 8-bit, alpha 0/255, palette-only, row I sepia-only, 1 silhouette component, full ink ring, feet on the bottom row (stacked `overlays` exempt: Sensor 7 heads and glyphs), `grow` frames only add pixels (hole); per-row colour stats |
| `composite.py` | pastes cells (and the lit windows) onto a 1080p store shot at a camera pose (e1 / s8 / s9); bubble mock |
| `contact.py` | review board: frames x rows (placeholders boxed), era ladder, readability 1x/1.5x/2x/3x, composite crops |
| `masters/<sheet>/<sheet>.txt` | ASCII colour master (optionally `masters/<sheet>/<frame>.png` cell overrides) |

## Commands

```sh
python -I scripts/art/world/build_sheet.py inspector                 # -> public/assets/world/inspector.png
python -I scripts/art/world/check_sheet.py inspector                 # exit 0 = CLEAN
python -I scripts/art/world/build_sheet.py windowLit && python -I scripts/art/world/check_sheet.py windowLit
python -I scripts/art/world/build_sheet.py inspector --frames <dir>  # also one PNG per cell (for the workbench)
python -I scripts/art/world/contact.py inspector <out.png> --frames idleA,walk0,front --crop <composite.png>:x0,y0,x1,y1
python -I scripts/art/world/composite.py <store shot 1080p> <out.png> --pose e1 --sheet inspector --frame idleA \
       --row I --x 1472 --flip --alpha .85 --shadow 14 --shadow-scale .5 [--bubble "<line>" --ui 150]
python -I scripts/art/world/composite.py <shot> <out.png> --pose s9 --windows lit [--window-set proposed]
```

Rebuild and gate everything (17 PNGs: 16 under `world/` + `bg/window-lit.png`). Every rebuild is pixel-identical to the shipped
PNG (AD-d checked all 17), so the masters are the source of truth:

```sh
for s in inspector dog crow girl payphone receiver sensor7 girlWindow girlMini lamp lampGlow clock stakeChain hole scraps mote windowLit; do
  python -I scripts/art/world/build_sheet.py $s && python -I scripts/art/world/check_sheet.py $s || break
done
npx vitest run src/assets/worldSheets.test.ts   # size, 8-bit RGBA, alpha 0/255, palette-only on every wired file
```

Workbench gates: PixelLab `get_upload_url`, `curl -sS -F "file=@<png>" <url>`, then `pixelart_workbench score upload:<id>` and
`lint upload:<id>`. The workbench caps a side at 512 px: lint `dog.png` (560 wide) as its two 280 px halves.

Store shots: `03-era2-generator` is the s9 pose (zoom .75), `02-era1-full` the e1 pose (zoom 1).

## Master format (`masters/<sheet>/<sheet>.txt`, codes from `pal.py`, `.` transparent)

```
@frame <name>                  then cell-height rows of cell-width chars: the colour master of that frame
@copy <name> <src>             PLACEHOLDER CELL: a copy of <src> (base + layers) until a later wave redraws it
@layer <name> <tag> <rows...>  then cell-height rows painted over <name> only in the listed era rows
                               (I II III IV V whole); '.' keeps, '_' erases, any other code paints
# comment
```

Draw the master in full colour (the whole-row look). Era-only details are layers: the Inspector's eyes (rows III+ on
front, talk, glance) and mouth pixel (talk, rows III+). WP23b adds the closed umbrella the same way (rows III to whole on
frames 0-8). The dog's eyes are layers too (rows III+: 1 px on side frames, 2 px on head / talk / lie) plus the talk mouth
pixel; rows I-II keep a smudge face.

## Era rows (DENIZEN_ART App. A)

| row | colours |
|---|---|
| I | full sepia: `#1f2225 #2b2e31 -> #2e1a12`, `#3e4246 #6e3a22 -> #4e2a1a`, `#5a5f63 #8c4a2a -> #5f5244`, `#7d8286 #ad6236 #7a7468 -> #8a7a64`, `#a3a6a4 #c98552 #d9822b #9c9182 -> #a8957a`, `#f0a848 #b8a98f -> #c9b28a`, `#ffd27a #d2bf9c -> #ddc9a3`; ink, rust `a b` and the sand ramp keep |
| II | sepia + accents as faded rust: `#d9822b -> #8c4a2a`, `#f0a848 -> #ad6236` |
| III | `#d9822b #f0a848 #c98552 #ad6236 #8c4a2a` own |
| IV | + iron `#1f2225 #2b2e31 #3e4246 #5a5f63` own |
| V | all own + `#9a6ad0` rim: first interior pixel on both flanks of every run >= 7 px (ink stays ink) |
| whole | all own |

Per-sheet pins (`sheets.py`): `{code: first own row}`; before that row the code takes the sepia map and skips the row II
faded return. The girl pins `A`/`B` (raincoat yellow) and `C` (lantern dot) to row III: before it the dot bakes to `#ddc9a3`,
the cold white lantern of era II.

Runtime, not baked: alpha .75 / .85 / 1 (era I before / after `wornMotor`, era II), shadows, flicker, tracking line,
reverse playback (WORLD_PLAYBACK in `src/data/livingWorld.ts`).

## Conventions

- One pixel grid: PIXEL_SCALE 2, like the machine. Cells are art px; pivot (0.5, 1) = feet on the bottom cell row.
- Full 1 px ink ring on every denizen (DENIZEN_ART 1.3); the workbench reports it as `pillow` info: accepted.
- Facing: masters face RIGHT (+x). `flip: true` in `WORLD_LOOPS` = faces left. Walk and write frames keep the head
  bowed (hat lowered over the face), so a figure walking toward the machine never looks at it.
- No text in art; eyes <= 2 px, mouth 1 px, and only from row III.
- Far-plane overlays (`windowLit`, `girlWindow`) have no outline (distant-layer rule, ART_BRIEF).
- PixelLab: concept and proportion reference only; calls follow ART_BRIEF "Approved anchor" (flywheel.png style, palette
  lock). Finals are hand-pixelled here.

## Gates (WP23 A13, per sheet)

`pixelart_workbench score` >= 90 on the sheet, `lint` 0 errors / 0 warnings (`pillow` info accepted), `silhouette`
1 component per cell (lint reports one component per cell on the whole sheet), `check_sheet.py` CLEAN, DENIZEN_ART 1.2
minimum on-screen sizes, and `src/assets/worldSheets.test.ts` once the manifest `file` is wired.

| sheet | PNG | workbench score | lint | check_sheet | notes |
|---|---|---|---|---|---|
| inspector | `world/inspector.png` 380x240 | 95.7 (walk loop 95.8) | 0 / 0, 4 info | CLEAN | 114 components = 1 per cell; body 13x33 |
| windowLit | `bg/window-lit.png` 8x6 | 100.0 | 0 / 0, 2 info | CLEAN | rust-amber only |
| dog | `world/dog.png` 560x120 | 99.5 (walk loop row II 98.7); AD2c front heads: halves 99.3 / 99.6 | 0 / 0, 3 info (lint per 280 px half: workbench limit 512) | CLEAN | 120 components = 1 per cell, 0 holes; heights 16-17 art px; head / talk / lie strip silhouette 18 = 1 per cell |
| stakeChain | `world/stake-chain.png` 20x6 | 97.7 | 0 / 0, 2 info | CLEAN | 1 component per cell |
| hole | `world/hole.png` 64x6 | 95.6 | 0 / 0, 2 info | CLEAN | 1 per cell; stages only grow (`grow` check in check_sheet) |
| scraps | `world/scraps.png` 24x4 | 99.1 | 0 / 0, 3 info | CLEAN | 1 per cell; ink edge (paper = far-plain value) |
| mote | `world/mote.png` 4x2 | 100.0 | 0 / 0, 1 info | CLEAN | ash `s` over `b` |
| crow | `world/crow.png` 240x108 | 100.0 | 0 / 0, 3 info | CLEAN | 60 components = 1 per cell, 0 holes; body 24x14 (14 = the zoom .5 floor) |
| girl | `world/girl.png` 160x168 | 98.7 | 0 / 0, 3 info | CLEAN | 60 = 1 per cell, 0 holes; body 12x24 = the tone-check maximum |
| girlMini | `world/girl-mini.png` 16x12 | 100.0 | 0 / 0, 3 info | CLEAN | 1 per cell; body 5x10 |
| girlWindow | `world/girl-window.png` 16x6 | 100.0 | 0 / 0, 1 info | CLEAN | rust only (`c d e f`, sheets.py `only`), no outline |
| payphone | `world/payphone.png` 168x312 | 98.9 | 0 / 0, 4 info (banding = the flat glass and panel rows) | CLEAN | 36 = 1 per cell, 0 holes; body 26x51 incl. the phone unit |
| receiver | `world/receiver.png` 48x72 | 95.2 | 0 / 0, 3 info | CLEAN | 1 per cell (check_sheet); lint counts 21 on the sheet: each cord on row 0 touches the handset of the cell above |
| lamp | `world/street-lamp.png` 48x60 | 96.7 | 0 / 0, 3 info | CLEAN | 4 components = 1 per cell, 0 holes; body 8x56 (rows 4-59) |
| lampGlow | `world/lamp-glow.png` 64x16 | 96.0 | 0 / 0, 3 info (banding = the flat ellipse rows) | CLEAN | rust-amber only (`e f`, sheets.py `only`), no outline, opaque: alpha is runtime |
| clock | `world/street-clock.png` 32x44 | 100.0 | 0 / 0, 3 info | CLEAN | 2 = 1 per cell; face 12x12, post 4 wide, 44 tall |
| sensor7 | `world/sensor7.png` 160x240 | 96.1; AD2c 3/4 headL / headR: 95.6 | 0 / 0, 4 info | CLEAN | 48 = 1 per cell (heads and glyphs are stacked overlays), 0 holes; stack 16x36 (headUp 16x39) |

AD-d final re-run (2026-10-24, all 17 PNGs): every score and lint result above reproduced exactly (dog halves 99.3 / 99.4);
check_sheet CLEAN on all 17; `worldSheets.test.ts` 20 / 20 pass with all 17 files wired.

AD2c (2026-10-24, round 3): dog head / talk / lie redrawn (F6, the front head read as a cat) and Sensor 7 headL / headR
redrawn as 3/4 heads (the flank lens read as aiming at the machine). Only those cells changed (diff bbox: dog columns 12,
13, 15; sensor7 columns 1, 3); check_sheet CLEAN, workbench numbers in the table, `worldSheets.test.ts` 20 / 20.

## Frame tables (column order is final, WP23 D7)

Era-row sheets (6 rows I, II, III, IV, V, whole): inspector, dog, crow, girl, payphone, receiver, sensor7.

| sheet | id | file | cell | frames (columns) | status |
|---|---|---|---|---|---|
| inspector | world.inspector | world/inspector.png 380x240 | 20x40 | idleA, idleB, walk0, walk1, walk2, walk3, write0, write1, glance, front, talk, shield, pat0, pat1, wave, watch, umbrellaOpen, frontUmbrella, talkUmbrella | AD-a (11 drawn, 8 placeholders) |
| dog | world.dog | world/dog.png 560x120 | 28x20 | sit0, sit1, sniff0, sniff1, walk0, walk1, walk2, walk3, dig0, dig1, shake0, shake1, head, talk, flat, lie, sleep, chase0, chase1, wag | AD-b (13 drawn, 7 placeholders) |
| crow | world.crow | world/crow.png 240x108 | 24x18 | frozen, perch0, perch1, head, talk, peck0, peck1, fly0, fly1, fly2 | AD-c (3 drawn, 7 placeholders) |
| girl | world.girl | world/girl.png 160x168 | 16x28 | stand0, stand1, palm, talk, shield, run0, run1, run2, run3, lanternDrop | AD-c (2 drawn, 8 placeholders) |
| payphone | world.payphone | world/payphone.png 168x312 | 28x52 | dark, lit, ring0, ring1, fog, restored | AD-c (4 drawn, 2 placeholders) |
| receiver | world.receiver | world/receiver.png 48x72 | 8x12 | hang, swing0, swing1, swing2, level, onHook | AD-c (5 drawn, 1 placeholder) |
| sensor7 | world.sensor7 | world/sensor7.png 160x240 | 20x40 | tripod, headL, headC, headR, headUp, fog, glyphDash, glyphOne | AD-d (7 drawn, 1 placeholder) |
| girlWindow | world.girlWindow | world/girl-window.png 16x6 | 4x6 | flickerA, flickerB, dark, restored | AD-c (3 drawn, 1 placeholder) |
| girlMini | world.girlMini | world/girl-mini.png 16x12 | 8x12 | warm, cold | AD-c (2 drawn) |
| lamp | world.lamp | world/street-lamp.png 48x60 | 12x60 | dead, lit, warm, restored | AD-d (2 drawn, 2 placeholders) |
| lampGlow | world.lampGlow | world/lamp-glow.png 64x16 | 32x16 | cold, warm | AD-d (1 drawn, 1 placeholder) |
| clock | world.clock | world/street-clock.png 32x44 | 16x44 | ruin, restored | AD-d (1 drawn, 1 placeholder) |
| stakeChain | world.stakeChain | world/stake-chain.png 20x6 | 10x6 | chained, fallen | AD-b (chained drawn, fallen placeholder) |
| hole | world.hole | world/hole.png 64x6 | 16x6 | stage1, stage2, stage3, stage4 | AD-b (4 drawn) |
| scraps | world.scraps | world/scraps.png 24x4 | 8x4 | scrap0, scrap1, scrap2 | AD-b (3 drawn) |
| mote | world.mote | world/mote.png 4x2 | 2x2 | ash, moth | AD-b (ash drawn, moth placeholder) |
| windowLit | bg.windowLit | bg/window-lit.png 8x6 | 4x6 | lit, breathe | AD-a |

`bg.windowLit`: lit = pane `#ad6236` with a 2x4 `#c98552` centre; breathe = the exhale (centre 2x2), era IV downbeat.
The renderer crops each placement to its pane from the top-left (`WORLD_FAR_PLANES.windows`, AD2c): (306, 120) /
(306, 132) / (318, 146) 4x6 on the tall tower right of centre, (143, 71) 2x4, (131, 99) 4x4, (134, 109) 1x3 in the upper
floors of the big central tower (all real `#2b2e31` cut-outs of `bg/skyline.png`; girl window (306, 106) is 4x6,
`world.girlWindow`). All six are on screen in the generator pose s8 and in s9; they come up at `WORLD_ENV.windowDimLevel`
.85 with `generator` and go full with `powerLines`.

## PLACEHOLDER CELLS (copies of an earlier frame until a later wave redraws them)

| sheet | cell(s) | copy of | redrawn in |
|---|---|---|---|
| inspector | shield, pat0, pat1, wave, watch, umbrellaOpen, frontUmbrella, talkUmbrella (all 6 rows) | idleA | WP23b |
| dog | shake0, shake1, flat, sleep, chase0, chase1, wag (all 6 rows) | sit0 | WP23b |
| stakeChain | fallen | chained | WP23b (finale: chain fallen off) |
| mote | moth | ash | WP23b (postgame white moth) |
| crow | perch0, perch1, peck0, peck1, fly0, fly1, fly2 (all 6 rows) | frozen | WP23b (era III perch, mark 42 pecks, finale flight) |
| girl | palm, talk, shield, run0, run1, run2, run3, lanternDrop (all 6 rows) | stand0 | WP23b (eras III-V, finale run) |
| payphone | fog, restored (all 6 rows) | dark | WP23b (era III fog, finale whole glass) |
| receiver | onHook (all 6 rows) | hang | WP23b (finale: hangs itself up) |
| girlWindow | restored | dark | WP23b (2x4 figure at the curtain) |
| sensor7 | fog (all 6 rows) | tripod | WP23b (era III lens-fog overlay, lens-sized) |
| lamp | warm, restored | lit | WP23b (era III warm lamp, finale restored lamp) |
| lampGlow | warm | cold | WP23b (era III / finale / postgame warm glow) |
| clock | restored | ruin | WP23b (finale: crack gone; the second hand is code) |

Summary: 17 PNGs, 106 frame columns; 65 drawn, 41 placeholders (inspector 8, dog 7, crow 7, girl 8,
payphone 2, receiver 1, girlWindow 1, stakeChain 1, mote 1, sensor7 1, lamp 2, lampGlow 1, clock 1). Every placeholder
is a cell needed only from era III on, the finale or the postgame (`LIVING_WORLD.maxEra` 2 hides them in WP23a).

Pending details on drawn inspector cells (WP23b, not placeholders): the closed umbrella layer (rows III to whole,
frames 0-8) and the whole-row restored look (pressed coat). Rows III to whole are recolours of the WP23a frames until then
(hidden in WP23a: `LIVING_WORLD.maxEra` 2).

Dog notes (AD-b): sit / sniff share one sitting body (sniff = head raised, nose to the air; no pose pop in the `WORLD_LOOPS.dog`
seam); dig = rear standing, head down at the hole in front (nose at cell x 24 = dog x + 20 world, inside the pit: the hole
sits at dog x + 30 and spans x + 14 .. x + 46, AD2 F7);
head / talk = front head on the sitting body (talk = jaw 1 px lower over the collar); lie = sphinx pose side-on with the
head turned to the camera (demo hold image: upright ear above the head line, collar band + blank tag under a chin
shadow). Upright ear at the back of the skull, torn ear = 1 px stub. Collar = `e` band + `u` tag (rows I-II read as a
light band on the sepia coat). Hole and stake sit in the front row with the dog: see `composite.py --sheet hole/stakeChain`.
Front head (AD2c F6, it read as a cat): flat skull top, the torn ear folded down as a 1 px flap on the right skull side
(never a second point), `t` bridge between the eyes, 3 px `u` muzzle one row below the eye line with the ink nose at its
bottom centre, jaw 1 px wider, `u` chin; `u` not `t`, because `t` bakes to the same sepia as the lit coat `e` in rows I-II.

Crow notes (AD-c): frozen mid-flap, faces right (right wing, no flip): near wing iron 2 with 1 px primary fingers and a
ragged trailing edge, far wing iron 0 behind it, fanned tail, ink beak with the hook down, feet hanging on the bottom row
(feet = cell row 17 = `crowLiftArtPx` above the lamp foot). head = only the head turned to the camera (round head, the
beak foreshortened to a 1 px stroke between the eyes); talk = head with the lower mandible 1 px longer (rows I-II: a bob),
the mouth pixel `c` is a rows III+ layer. Eye layers rows III+ (`4` glint, 1 px side, 2 px front). whole adds a gloss
layer (iron 3 on the near wing leading edge and the crown); the palette has no blue, so the gloss is the cool iron ramp.

Girl notes (AD-c): faces the camera, never flipped; legs centred on the pivot. Tone check (DENIZEN_ART 2.4 / 8.1): body
12x24 max, face = 2-tone smudge (`f` / `e` in the hood shadow `c`), no eye or mouth pixel in any row or layer. stand1 =
hood and face 1 px right (the sway); coat, lantern and boots never move. girlMini (pylon plane) keeps the era I-II sand
coat in both frames (only the lantern dot differs: warm `C`, cold `w`). girlWindow sits on the skyline window at art
(306, 106), whose `#6e3a22` core is exactly 4x6.

Booth notes (AD-c): glass x6..21, y12..37, plain `1` with the frame shadow `0` on its top row and right column.
`WORLD_MARKS.pane` = (6, 13, 16, 24) (AD-c moved y 8 -> 13 for this art): the procedural marks start under the shadow
row. The phone unit sits on the outer right side (away from the machine), interior x24..26, ink x27, rows 18..29, cradle
empty. `WORLD_ENV.receiverArt` = (13, -22) (AD-c, was (6, -34)): the receiver pivot is cell (27.0, 30), the cord (receiver
column 3) hangs from the unit's bottom row and the handset (receiver columns 2..5) clears the box edge by 1 px. ring0 /
ring1 rattle only the hood (box, glass, unit fixed, so marks and pivot never drift); the lamp is dark in the ring frames.
Receiver: hang centred under the pivot, swing0-2 = +1, +2, +2 raised (pendulum top), outward only; level = the cup seen
face-on 1 px below the unit on a cord stub (the payphone's "front" and its bubble anchor).

Street corner notes (AD-d): lamp and clock are single-row street furniture in the machine's iron (lit from the upper
left, 2 px posts `4 2`, rust runs, flared plinths), so they read as the same cast-iron family. Lamp: finial row 4 (the
crow's dangling feet sit 2 px above it: `crowLiftArtPx` 58), pyramid hood, lantern glass x4..7 rows 9..12; dead = dark
glass with a crack, lit = `#c98552` / `#ad6236` glass with a `#d9822b` 2x2 core, the frame posts and the seat below catch
the light. `WORLD_ENV.lampHeadArtPx` = 49 (AD-d, was 56): the glass centre, cell (6, 11); `world.lampGlow` (origin .5, .5)
and the ash-mote orbit centre there. lampGlow = two hard-stepped ellipses (outer 32x16 `#ad6236`, inner 18x8 `#c98552`),
opaque in the PNG (the gate allows alpha 0 / 255 only); the renderer sets `WORLD_ENV.lampGlow.alpha` .4, + `bumpAlpha` .2
for `rippleMs` on a ripple or lamp flicker (+ mains flicker; AD2 F4, the old .8 read as a plate), depth glow +0.05 above
the lamp. Clock: face 12x12 at x2..13 rows 2..13, dial centre = cell (8, 8) = origin + `faceCenterArt`
(0, -36); NO hands in the art (1 art px ink lines in code, hour 3 / minute 5, 4:41). The dial keeps ONE dark mark (a 2 px
crack, upper right) and faint ticks: two dark marks above the downward 4:41 hands read as a frowning face.

Sensor 7 notes (AD-d): stacked overlays at one position and pivot (sheets.py `overlays`): draw `tripod`, then one head,
then one glyph. tripod = round pan socket (rows 13-14), iron body x6..13 rows 15..23 with the stencilled 7 and the LED
socket, side readout box x13..17 rows 16..22 (blank window), A-frame wood legs + 2 px ink rear leg to three feet on row
39 (x2..4, x9..10, x15..17; foot dots at -6.5, 0, +6.5 art px = -13, 0, +13 world px). Heads = box x5..14 rows 4..13
(headUp: box rows 5..13 + barrel rows 1..4); headC lens 6x6 centred, headL / headR 3/4 heads (AD2c: side panel showing,
lens ring 5 wide flush with the turn-side box edge, glass 3x4 still facing the viewer, no barrel past the box; the old
flank lens + barrel read as aiming at the machine), headUp lens at the sky. Glyph cells = the readout box with a 3x5 glyph (`-`, `1`). The head bottom ink row 13
covers the socket top, the glyph box matches the tripod window pixel for pixel. Default framings e1 / s9 have the camera
centre > 200 world px right of x 1384, so the live head is headR (3/4: looking out at the viewer, turned toward the frame centre). LED: not art; the
renderer draws a 2x2 world px square with top-left = origin + 2 * `WORLD_ENV.sensor7.ledArt` = (2, -23) art px (AD-d, was
(3, -30)), i.e. exactly over the ink socket at cell (12, 17); setOrigin(0, 0), or centre it at + (1, 1) world px.

Art-coordinate data the sheets are drawn to (`src/data/livingWorld.ts`; AD-owned tuning keys, WP23a-assignments):

| key | value | cell point | set by |
|---|---|---|---|
| `WORLD_MARKS.pane` | x 6, y 13, 16x24 | booth glass under its shadow row | AD-c (y 8 -> 13) |
| `WORLD_ENV.receiverArt` | (13, -22) | booth cell (27.0, 30): receiver pivot | AD-c (was (6, -34)) |
| `WORLD_ENV.crowLiftArtPx` | 58 | crow feet 2 px above the lamp finial (lamp top = 56) | unchanged |
| `WORLD_ENV.lampHeadArtPx` | 49 | lamp cell (6, 11): glass centre, glow + mote centre | AD-d (was 56) |
| `WORLD_ENV.clock.faceCenterArt` | (0, -36) | clock cell (8, 8): dial centre, hands origin | unchanged |
| `WORLD_ENV.sensor7.ledArt` | (2, -23) | Sensor 7 cell (12, 17): LED socket top-left | AD-d (was (3, -30)) |
