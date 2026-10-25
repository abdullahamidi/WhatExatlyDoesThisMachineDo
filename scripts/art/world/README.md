# Living world art toolchain (WP23a, Art Director)

What: the offline tools, colour masters and frame tables behind every `world.*` sheet and `bg.windowLit`.
Why: the denizens are hand-pixelled once in colour; the six era rows (I, II, III, IV, V, whole) are baked
deterministically by `erarecolor.py` (DENIZEN_ART D2 and Appendix A), so every pixel stays on the palette and WP23b only
redraws cells. Sources are not shipped; the PNGs under `public/assets/` are.

Requirements: Python 3.12 + Pillow (numpy optional, unused). Always run with `python -I` from the repo root.

## Files

| file | job |
|---|---|
| `pal.py` | the 25 Rust Wasteland colours (ART_BRIEF) + `VIOLET_LIGHT` #9a6ad0, one character code each; `render` / `grid`; WP23b AD3c: `RESTORED` = the restored-world colours (PALETTE green0-3 `g h i j`, skyClear0-3 `k m n o`), not part of the 25, legal only in a sheet's `restored_frames` |
| `sheets.py` | frame tables (column order = `src/data/livingWorld.ts` `WORLD_FRAMES`), cell sizes, files, era rows, pins; per-sheet gate options `only` / `only_frames`, `grow`, `parts`, `overlays`, `airborne`, `restored_frames` (AD3c) and `vertical` (AD3c: frames stacked top to bottom, `bg.virga`; `cell_origin`) |
| `erarecolor.py` | DENIZEN_ART App. A: sepia row I, per-row colour returns, row V violet rim, per-sheet pins |
| `build_sheet.py` | master frames -> sheet PNG (exact column order, 6 era rows for era-row sheets) |
| `check_sheet.py` | gate: dims == spec (and manifest when wired), RGBA 8-bit, alpha 0/255, palette-only, row I sepia-only, 1 silhouette component per cell on every sheet (WP23b; `parts=True` in `sheets.py` opts a sheet out), full ink ring, feet on the bottom row (stacked `overlays` exempt: Sensor 7 heads and glyphs; `airborne` frames exempt: the crow's flight cells, AD3b), `grow` frames only add pixels (hole; AD3c: puddle grey sizes, sprout stages), `only` codes per sheet widened per frame by `only_frames` (AD3b: girl window restored; AD3c: lamp glow warm), restored-world colours only in `restored_frames` cells (AD3c: puddle `whole`, sprout `bloom`); per-row colour stats |
| `composite.py` | pastes cells (and the lit windows) onto a 1080p store shot at a camera pose (e1 / s8 / s9; WP23b: s11 / s15 at zoom .5); bubble mock |
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

Rebuild and gate everything (24 PNGs since WP23b AD3c: 22 under `world/` + `bg/window-lit.png` + `bg/virga.png`). Every
rebuild is pixel-identical to the shipped PNG (AD-d checked all 17, AD3a all 20, AD3c and AD3d all 24), so the masters are the
source of truth:

```sh
for s in inspector dog crow girl payphone receiver sensor7 girlWindow girlMini lamp lampGlow clock stakeChain hole scraps mote windowLit \
         lantern redBall clipboardPages puddle sprout page virga; do
  python -I scripts/art/world/build_sheet.py $s && python -I scripts/art/world/check_sheet.py $s || break
done
npx vitest run src/assets/worldSheets.test.ts   # size, 8-bit RGBA, alpha 0/255, palette-only on every wired file (+ the
                                                # AD3c restored allow-list: puddle frame 9, sprout frame 4)
```

Workbench gates: PixelLab `get_upload_url`, `curl -sS -F "file=@<png>" <url>`, then `pixelart_workbench score upload:<id>` and
`lint upload:<id>`. The workbench caps a side at 512 px: lint `dog.png` (560 wide) as its two 280 px halves.

Store shots: `03-era2-generator` is the s9 pose (zoom .75), `02-era1-full` the e1 pose (zoom 1), `04-era3-boiler` the s11
pose and `07-era5-ruined` / `09-postgame-portrait` the s15 pose (zoom .5; matched by the ground line and the anchors).

## Master format (`masters/<sheet>/<sheet>.txt`, codes from `pal.py`, `.` transparent)

```
@frame <name>                  then cell-height rows of cell-width chars: the colour master of that frame
@copy <name> <src>             PLACEHOLDER CELL: a copy of <src> (base + layers) until a later wave redraws it
@layer <name> <tag> <rows...>  then cell-height rows painted over <name> only in the listed era rows
                               (I II III IV V whole); '.' keeps, '_' erases, any other code paints
# comment
```

Draw the master in full colour (the whole-row look). Era-only details are layers: the Inspector's eyes (rows III+ on
front, talk, glance, frontUmbrella, talkUmbrella) and mouth pixel (talk, talkUmbrella, rows III+). WP23b AD3a added the
closed umbrella the same way (`umbrella` layers, rows III to whole on frames 0-8) and the whole-only looks (`pressed`
coat creases on every inspector frame, `healthy` dog coat sheen) plus the dog's red `collar` (rows III to whole). The dog's eyes are layers too (rows III+: 1 px on side frames, 2 px on head / talk / lie) plus the talk mouth
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
- No green or blue anywhere before the finale. The restored-world colours (pal `RESTORED`: PALETTE green0-3, skyClear0-3)
  live in exactly two cells (WP23b AD3c): `world.puddle` frame 9 `whole` and `world.sprout` frame 4 `bloom`
  (`sheets.py` `restored_frames`, `src/assets/worldSheets.test.ts` `RESTORED_CELLS` per-id allow-list).
- Far-plane overlays (`windowLit`, `girlWindow`) have no outline (distant-layer rule, ART_BRIEF).
- PixelLab: concept and proportion reference only; calls follow ART_BRIEF "Approved anchor" (flywheel.png style, palette
  lock). Finals are hand-pixelled here.

## Gates (WP23 A13, per sheet)

`pixelart_workbench score` >= 90 on the sheet, `lint` 0 errors / 0 warnings (`pillow` info accepted), `silhouette`
1 component per cell (lint reports one component per cell on the whole sheet), `check_sheet.py` CLEAN, DENIZEN_ART 1.2
minimum on-screen sizes, and `src/assets/worldSheets.test.ts` once the manifest `file` is wired.

| sheet | PNG | workbench score | lint | check_sheet | notes |
|---|---|---|---|---|---|
| inspector | `world/inspector.png` 380x240 | 95.9 (AD3a; WP23a 95.7, walk loop 95.8) | 0 / 0, 4 info | CLEAN | 1 per cell (check_sheet), 0 holes; lint counts 99 on the sheet: the umbrellaOpen / frontUmbrella / talkUmbrella canopies on cell row 0 touch the boots of the cell above (15 cells); body 13x33 |
| windowLit | `bg/window-lit.png` 8x6 | 100.0 | 0 / 0, 2 info | CLEAN | rust-amber only |
| dog | `world/dog.png` 560x120 | AD3a halves 99.3 / 97.4 (WP23a 99.5; AD2c halves 99.3 / 99.6) | 0 / 0, 3 / 4 info (lint per 280 px half: workbench limit 512) | CLEAN | 120 components = 1 per cell (60 + 60), 0 holes; heights 16-17 art px (flat 9, sleep 10: lying poses); head / talk / lie strip silhouette 18 = 1 per cell |
| stakeChain | `world/stake-chain.png` 20x6 | 99.1 (AD3a; WP23a 97.7) | 0 / 0, 3 info | CLEAN | 1 component per cell, 0 holes |
| hole | `world/hole.png` 64x6 | 95.6 | 0 / 0, 2 info | CLEAN | 1 per cell; stages only grow (`grow` check in check_sheet) |
| scraps | `world/scraps.png` 24x4 | 99.1 | 0 / 0, 3 info | CLEAN | 1 per cell; ink edge (paper = far-plain value) |
| mote | `world/mote.png` 4x2 | 100.0 (AD3a) | 0 / 0, 2 info | CLEAN | ash `s` over `b`; moth `C` over `w` (a 1 px `C` glint scored 88: singletons) |
| crow | `world/crow.png` 240x108 | 99.8 (AD3b; WP23a 100.0) | 0 / 0, 4 info | CLEAN | 60 components = 1 per cell, 0 holes; body 24x14 (14 = the zoom .5 floor); AD3b cells 14-17 tall |
| girl | `world/girl.png` 160x168 | 98.1 (AD3b; WP23a 98.7) | 0 / 0, 3 info | CLEAN | 60 = 1 per cell, 0 holes; body 12x24 = the tone-check maximum (every AD3b cell inside it) |
| girlMini | `world/girl-mini.png` 16x12 | 100.0 | 0 / 0, 3 info | CLEAN | 1 per cell; body 5x10 |
| girlWindow | `world/girl-window.png` 16x6 | 96.0 (AD3b; WP23a 100.0) | 0 / 0, 3 info (banding = the flat lit rows) | CLEAN | rust only (`c d e f`, sheets.py `only`; the restored frame adds `A B C`, `only_frames`), no outline |
| payphone | `world/payphone.png` 168x312 | 97.8 (AD3b; WP23a 98.9) | 0 / 0, 4 info (banding = the flat glass and panel rows) | CLEAN | 36 = 1 per cell, 0 holes; body 26x51 incl. the phone unit |
| receiver | `world/receiver.png` 48x72 | 95.1 (AD3b; WP23a 95.2) | 0 / 0, 3 info | CLEAN | 1 per cell (check_sheet); lint counts 26 on the sheet: each cord on row 0 touches the handset of the cell above (onHook cells stand alone) |
| lamp | `world/street-lamp.png` 48x60 | 96.3 (AD3c; WP23a 96.7) | 0 / 0, 4 info | CLEAN | 4 components = 1 per cell, 0 holes; body 8x56 (rows 4-59) |
| lampGlow | `world/lamp-glow.png` 64x16 | 96.0 (AD3c; WP23a 96.0) | 0 / 0, 2 info (banding = the flat ellipse rows) | CLEAN | rust-amber only (`e f`, sheets.py `only`; the warm frame adds `A B`, `only_frames`), no outline, opaque: alpha is runtime |
| clock | `world/street-clock.png` 32x44 | 100.0 (AD3c; WP23a 100.0) | 0 / 0, 3 info | CLEAN | 2 = 1 per cell; face 12x12, post 4 wide, 44 tall |
| sensor7 | `world/sensor7.png` 160x240 | 97.0 (AD3c; WP23a 96.1; AD2c 95.6) | 0 / 0, 4 info | CLEAN | 48 = 1 per cell (heads, fog and glyphs are stacked overlays), 0 holes; stack 16x36 (headUp 16x39) |
| lantern | `world/lantern.png` 12x4 | 100.0 (AD3a) | 0 / 0, 3 info | CLEAN | 1 per cell, 0 holes; a 3-wide body with 1 px base / glass scored 82 (singletons) |
| redBall | `world/red-ball.png` 3x3 | 100.0 (AD3a) | 0 / 0, 2 info | CLEAN | 1 component; glint and shadow 2 px each (1 px each scored 88) |
| clipboardPages | `world/clipboard-pages.png` 18x3 | 98.7 (AD3a) | 0 / 0, 3 info | CLEAN | 1 per cell (lint: 1 on the sheet, the cells touch) |
| puddle | `world/puddles.png` 320x5 | 96.0 (AD3c) | 0 / 0, 4 info (banding = the flat water rows) | CLEAN | 10 = 1 per cell, 0 holes; grey sizes only grow (`grow`); `whole` restored colours (`restored_frames`) |
| sprout | `world/sprout.png` 40x24 | 100.0 (AD3c) | 0 / 0, 2 info | CLEAN | 5 = 1 per cell, 0 holes; stages only grow (`grow`); `bloom` restored colours (`restored_frames`) |
| page | `world/page.png` 6x4 | 100.0 (AD3c) | 0 / 0, 3 info | CLEAN | 1 per cell (lint: 1 on the sheet, the cells touch); every colour cluster >= 2 px |
| virga | `bg/virga.png` 512x128 | 100.0 (AD3c) | 0 / 0, 2 info (1-2 px clusters = the deliberate dashes and beads) | CLEAN | `parts` (a strip of streaks: 1137 components), 0 isolated px (4-connected streaks), sky ramp only (`p q`, `only`) |

AD-d final re-run (2026-10-24, all 17 PNGs): every score and lint result above reproduced exactly (dog halves 99.3 / 99.4);
check_sheet CLEAN on all 17; `worldSheets.test.ts` 20 / 20 pass with all 17 files wired.

AD3d final re-run (2026-10-25, all 24 PNGs): every score and lint result in the table above reproduced exactly
(dog halves 99.3 / 97.4); check_sheet CLEAN on all 24; see "WP23b AD3d" below.

AD2c (2026-10-24, round 3): dog head / talk / lie redrawn (F6, the front head read as a cat) and Sensor 7 headL / headR
redrawn as 3/4 heads (the flank lens read as aiming at the machine). Only those cells changed (diff bbox: dog columns 12,
13, 15; sensor7 columns 1, 3); check_sheet CLEAN, workbench numbers in the table, `worldSheets.test.ts` 20 / 20.

## Frame tables (column order is final, WP23 D7)

Era-row sheets (6 rows I, II, III, IV, V, whole): inspector, dog, crow, girl, payphone, receiver, sensor7.

| sheet | id | file | cell | frames (columns) | status |
|---|---|---|---|---|---|
| inspector | world.inspector | world/inspector.png 380x240 | 20x40 | idleA, idleB, walk0, walk1, walk2, walk3, write0, write1, glance, front, talk, shield, pat0, pat1, wave, watch, umbrellaOpen, frontUmbrella, talkUmbrella | AD-a 11 + AD3a 8 (all 19 drawn) |
| dog | world.dog | world/dog.png 560x120 | 28x20 | sit0, sit1, sniff0, sniff1, walk0, walk1, walk2, walk3, dig0, dig1, shake0, shake1, head, talk, flat, lie, sleep, chase0, chase1, wag | AD-b 13 + AD3a 7 (all 20 drawn) |
| crow | world.crow | world/crow.png 240x108 | 24x18 | frozen, perch0, perch1, head, talk, peck0, peck1, fly0, fly1, fly2 | AD-c 3 + AD3b 7 (all 10 drawn) |
| girl | world.girl | world/girl.png 160x168 | 16x28 | stand0, stand1, palm, talk, shield, run0, run1, run2, run3, lanternDrop | AD-c 2 + AD3b 8 (all 10 drawn) |
| payphone | world.payphone | world/payphone.png 168x312 | 28x52 | dark, lit, ring0, ring1, fog, restored | AD-c 4 + AD3b 2 (all 6 drawn) |
| receiver | world.receiver | world/receiver.png 48x72 | 8x12 | hang, swing0, swing1, swing2, level, onHook | AD-c 5 + AD3b 1 (all 6 drawn) |
| sensor7 | world.sensor7 | world/sensor7.png 160x240 | 20x40 | tripod, headL, headC, headR, headUp, fog, glyphDash, glyphOne | AD-d 7 + AD3c fog (all 8 drawn) |
| girlWindow | world.girlWindow | world/girl-window.png 16x6 | 4x6 | flickerA, flickerB, dark, restored | AD-c 3 + AD3b 1 (all 4 drawn) |
| girlMini | world.girlMini | world/girl-mini.png 16x12 | 8x12 | warm, cold | AD-c (2 drawn) |
| lamp | world.lamp | world/street-lamp.png 48x60 | 12x60 | dead, lit, warm, restored | AD-d 2 + AD3c 2 (all 4 drawn) |
| lampGlow | world.lampGlow | world/lamp-glow.png 64x16 | 32x16 | cold, warm | AD-d cold + AD3c warm |
| clock | world.clock | world/street-clock.png 32x44 | 16x44 | ruin, restored | AD-d ruin + AD3c restored |
| stakeChain | world.stakeChain | world/stake-chain.png 20x6 | 10x6 | chained, fallen | AD-b chained + AD3a fallen |
| hole | world.hole | world/hole.png 64x6 | 16x6 | stage1, stage2, stage3, stage4 | AD-b (4 drawn) |
| scraps | world.scraps | world/scraps.png 24x4 | 8x4 | scrap0, scrap1, scrap2 | AD-b (3 drawn) |
| mote | world.mote | world/mote.png 4x2 | 2x2 | ash, moth | AD-b ash + AD3a moth |
| windowLit | bg.windowLit | bg/window-lit.png 8x6 | 4x6 | lit, breathe | AD-a |
| lantern | world.lantern | world/lantern.png 12x4 | 6x4 | lit, fallen | AD3a (2 drawn) |
| redBall | world.redBall | world/red-ball.png 3x3 | 3x3 | ball | AD3a (1 drawn) |
| clipboardPages | world.clipboardPages | world/clipboard-pages.png 18x3 | 6x3 | thin, medium, thick | AD3a (3 drawn) |
| puddle | world.puddle | world/puddles.png 320x5 | 32x5 | size1Grey, size1Ring, size1Black, size2Grey, size2Ring, size2Black, size3Grey, size3Ring, size3Black, whole | AD3c (10 drawn) |
| sprout | world.sprout | world/sprout.png 40x24 | 8x24 | stage1, stage2, stage3, stage4, bloom | AD3c (5 drawn) |
| page | world.page | world/page.png 6x4 | 3x4 | flat, tilt | AD3c (2 drawn) |
| virga | bg.virga | bg/virga.png 512x128 | 512x64, frames stacked (frame 0 on top) | fall, frozen | AD3c (2 drawn, generated) |

`bg.windowLit`: lit = pane `#ad6236` with a 2x4 `#c98552` centre; breathe = the exhale (centre 2x2), era IV downbeat.
The renderer crops each placement to its pane from the top-left (`WORLD_FAR_PLANES.windows`, AD2c): (306, 120) /
(306, 132) / (318, 146) 4x6 on the tall tower right of centre, (143, 71) 2x4, (131, 99) 4x4, (134, 109) 1x3 in the upper
floors of the big central tower (all real `#2b2e31` cut-outs of `bg/skyline.png`; girl window (306, 106) is 4x6,
`world.girlWindow`). All six are on screen in the generator pose s8 and in s9; they come up at `WORLD_ENV.windowDimLevel`
.85 with `generator` and go full with `powerLines`.

## PLACEHOLDER CELLS (copies of an earlier frame until a later wave redraws them)

| sheet | cell(s) | copy of | redrawn in |
|---|---|---|---|

None since WP23b AD3c: no master holds an `@copy` any more (build_sheet prints no PLACEHOLDER line for any sheet).

Summary after WP23b AD3c: 24 PNGs, 131 frame columns, all 131 drawn, 0 placeholders. AD3c drew the last 5 (sensor7
fog, lamp warm and restored, lampGlow warm, clock restored) and added puddle 10, sprout 5, page 2, virga 2. (AD3b: 20
PNGs, 112 columns, 107 drawn, 5 placeholders; AD3a: 88 drawn, 24 placeholders; WP23a: 17 PNGs, 106 columns, 65 drawn,
41 placeholders.)

The WP23a pending details on the drawn inspector cells are done (AD3a): the closed umbrella layer (rows III to whole,
frames 0-8) and the whole-row pressed coat. Rows I-II of every WP23a cell are pixel-identical to WP23a (AD3a diff: rows
I-II changed only in the 15 former placeholder columns).

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
| `WORLD_ENV.receiverOnHookArt` (NEW, T14) | (13, -34) | booth cell (27.0, 18): receiver pivot while `onHook` | AD3b (proposed) |
| `WORLD_MARKS.fogColor` (NEW, T8) | `0xddc9a3` | tally colour while the booth shows `fog` (DENIZEN_ART 2.5) | AD3b (proposed) |
| `WORLD_ENV.crowLiftArtPx` | 58 | crow feet 2 px above the lamp finial (lamp top = 56) | unchanged |
| `WORLD_ENV.lampHeadArtPx` | 49 | lamp cell (6, 11): glass centre, glow + mote centre | AD-d (was 56) |
| `WORLD_ENV.clock.faceCenterArt` | (0, -36) | clock cell (8, 8): dial centre, hands origin | unchanged |
| `WORLD_ENV.sensor7.ledArt` | (2, -23) | Sensor 7 cell (12, 17): LED socket top-left | AD-d (was (3, -30)) |

## WP23b AD3a (Wave B art, part 1, 2026-10-25)

Redrawn: the 8 inspector and 7 dog placeholder columns, stakeChain `fallen`, mote `moth`; new sheets `lantern`,
`redBall`, `clipboardPages` (manifest `file` wired, ASSET_GUIDE rows). Layers added: inspector `umbrella` (III-whole,
frames 0-8), `pressed` (whole, all 19), eyes / mouth on the umbrella fronts; dog `collar` (III-whole), `healthy` (whole,
all 20), eyes on the new side heads. Frame sizes, order and era rows unchanged (D7). Rows I-II of every WP23a cell are
pixel-identical. Hand-pixelled; PixelLab used for the gates only (no generations spent).

| sheet | PNG | score | lint | silhouette (lint) | holes | check_sheet |
|---|---|---|---|---|---|---|
| inspector | 380x240 | 95.9 | 0 / 0, 4 info | 99 on the sheet = 114 cells, 15 canopy-to-boots touches across rows | 0 | CLEAN |
| dog (halves) | 560x120 | 99.3 / 97.4 | 0 / 0, 3 / 4 info | 60 / 60 | 0 / 0 | CLEAN |
| stakeChain | 20x6 | 99.1 | 0 / 0, 3 info | 2 | 0 | CLEAN |
| mote | 4x2 | 100.0 | 0 / 0, 2 info | 1 (cells touch) | 0 | CLEAN |
| lantern | 12x4 | 100.0 | 0 / 0, 3 info | 2 | 0 | CLEAN |
| redBall | 3x3 | 100.0 | 0 / 0, 2 info | 1 | 0 | CLEAN |
| clipboardPages | 18x3 | 98.7 | 0 / 0, 3 info | 1 (cells touch) | 0 | CLEAN |

Evidence (`<S>/WP23b/ad/`): `contact-<sheet>.png` (7 boards), `comp/comp-*.png` in-game-size composites on the 1080p store
shots (zoom 1: e1 shot, baseL / baseR whole cells; zoom .75: s9, era III umbrella + shake; zoom .5: s11 era III, s15 era V,
s15 postgame portrait whole) with `-crop<n>-1to1` / `-x3` crops, `gate/` the uploaded PNGs, `work/` drafts and the
authoring helpers (`gen_ins.py`, `gen_dog.py` write the masters from the WP23a originals + `ins_new.txt` / `dog_new.txt`).

Inspector notes (AD3a):
- shield = FRONT view, the clipboard raised over the face (form side out, clip on top, cell rows 11-17), hands at its
  sides, elbows out; the dome hat shows above it. Reads as "face hidden from the light" at zoom .5.
- pat0 / pat1 = bowed head, the NEAR arm reaching down-forward across the coat to the hand outside the coat front; hand
  pat0 cell x 15-16 rows 28-29, pat1 rows 29-30 (1 px lower). Contact point = pivot + (+6, -10) art px = (+12, -20) world
  px (mirrored when flipped). It lands on a dog's shoulders (dog cell (12-14, 10-11) = dog pivot + (-1, -10) art px) only
  when both stand on the same feet line: during the pat put the dog at inspector x - 10 world px (inspector flipped,
  dog facing right) with the same feet y (front row dog: inspector dy +32 world, or dog dy -32). Owner: data (T4 / T10).
- wave = near arm straight up behind the hat (hand rows 3-5), head tilted up toward the facing side: flip true faces the
  upper-left window (WORLD_POSTGAME_LOOP plays it flipped).
- watch = near forearm raised across the chest (cell row 18, elbow out at the back), steel glint `5` at the wrist
  (11, 18), head bowed to it; flipped = his left wrist.
- umbrellaOpen = canopy iron 3 2 1 (lit upper left) over the head, rib tips under the rim, shaft behind the brim to the
  far hand in front of the chin, near hand raised palm out (dry-sky gesture). The clipboard is tucked away (not drawn).
- frontUmbrella / talkUmbrella = front body under a canopy tilted over the head (apex x 14-15 over the right hand, the
  shaft x 16 with a 2 px runner under the canopy); a 1 px gap row between canopy and hat; talkUmbrella = head 1 px lower
  (the canopy cannot let it rise). Eyes (III+) row 13 / 14, mouth (III+) row 15.
- Closed umbrella (rows III-whole, frames 0-8): hooked on the far forearm under the clipboard hand, the wood crook `d`
  then the furled canopy `2 1` hanging outside the coat front to a `4` ferrule at shin height (tip row 35; contact frames
  walk0 / walk2 tip row 36 one px further out, clear of the striding foot). Rows III-IV bake it to sepia brown with the coat.
- pressed coat (whole only): the last lit `3` px of every coat panel run turns `4` (crisp light creases).
- Clipboard (paper top-edge ink row / x span) for the `world.clipboardPages` overlay, origin (0.5, 1): idleA, walk1,
  walk3, write0, write1, glance, pat0, pat1 = row 19, x 13-16 -> offset (+5, -21); idleB, walk0, walk2 = row 20 ->
  (+5, -20); watch = row 19, x 12-15 -> (+4, -21); wave = row 20, x 12-15 -> (+4, -20). front / talk / frontUmbrella /
  talkUmbrella / shield hold the board face-on (no side-view stack) and umbrellaOpen has none: keep the overlay off
  there. Data owner: `WORLD_TRACES.clipboardOffsetArt` / `clipboardFrames` (T2 draft has (4, -18), on the board face).

Dog notes (AD3a):
- shake0 / shake1 = the sitting body (no pose pop against sit0 in `dogShake`), head and chest smeared 1 px left / right
  with a ragged back line, the upright ear flapped back / forward (still above the head line), the torn stub flicked.
  No droplets: the water is not there (bible 3.2).
- flat = belly down, legs spread, head low in profile, upright ear pressed back but its tip 1 px above the head line;
  9 art px tall (a lying pose, scale unchanged).
- sleep = curled loaf, head down on the paws at the front, tail tip along the front; 10 art px tall; eyes closed (no eye
  layer).
- chase0 = extended gallop (near fore foot down, hind legs stretched back); chase1 = gathered (legs under the belly, hind
  feet down); 6 fps pair, facing right; eye layer (22, 7).
- wag = sit0 with the tail raised and curled (sit0 <-> wag at 2 fps is the wag; head and body identical to sit0).
- red collar (rows III-whole): `c` shadow under / beside the `e` strap so it reads as a strap (the palette has no red;
  rows III-IV bake `c` to `#4e2a1a`). New base straps on flat and chase0 / chase1. dig / sleep: neck hidden, no collar.
- healthy coat (whole only): every lit `e` px on the top / left edge of the coat turns `f` (a sheen line).

Props (AD3a): stakeChain `fallen` = stake leaning right, the chain lying in a short low-high S off its foot, still one
piece with the stake; mote `moth` = `C` over `w` (white moth lit by the lamp); lantern `lit` = the girl's lantern with its
bail handle, 1 px `C` dot beside the rust frame `d`, `fallen` = on its side, ink cage, dark glass `1 1`; redBall = `B B`
glint upper left, `A` ball, `d d` shadow lower right, no outline; clipboardPages = 1 / 2 / 3 sheet edges `w` / `v` with ink
ends, growing up from the bottom row.

## WP23b AD3b (Wave B art, part 2, 2026-10-25)

Redrawn: the 7 crow, 8 girl, 2 payphone, 1 receiver and 1 girlWindow placeholder columns (19 columns, every era row).
Frame sizes, order and era rows unchanged (D7). Hand-pixelled; PixelLab used for the gates only (no generations spent).
Rows I-II of every drawn cell are pixel-identical to AD3a (per-cell byte diff of all 5 sheets); the only drawn cells that
changed are the payphone `dark`, `lit`, `ring0`, `ring1` WHOLE row (the `restored` layer, see below). Gate code: the
crow's flight cells are `airborne` in `sheets.py` (no feet-on-bottom-row check), the girl window's restored frame widens
`only` through `only_frames` (`A B C`, the post-finale warm lamp light). A rebuild of all 20 sheets to a scratch folder
is byte-identical to the shipped PNGs and all 20 are check_sheet CLEAN.

| sheet | PNG | score | lint | silhouette (lint) | holes | check_sheet | cells drawn |
|---|---|---|---|---|---|---|---|
| crow | 240x108 | 99.8 | 0 / 0, 4 info | 60 | 0 | CLEAN | perch0, perch1, peck0, peck1, fly0, fly1, fly2 |
| girl | 160x168 | 98.1 | 0 / 0, 3 info | 60 | 0 | CLEAN | palm, talk, shield, run0-run3, lanternDrop |
| payphone | 168x312 | 97.8 | 0 / 0, 4 info | 36 | 0 | CLEAN | fog, restored (+ `restored` whole layers on dark / lit / ring0 / ring1) |
| receiver | 48x72 | 95.1 | 0 / 0, 3 info | 26 on the sheet (row 0 cords touch the cell above), 1 per cell in check_sheet | 0 | CLEAN | onHook |
| girlWindow | 16x6 | 96.0 | 0 / 0, 3 info | 1 (cells touch) | 0 | CLEAN | restored |

Minimum sizes (DENIZEN_ART 1.2): crow perch 17, peck 15 / 17, fly 14 / 14 / 17 art px tall (floor 14); girl 24 tall and
at most 12 wide in every cell (tone check), no eye or mouth pixel; girl window figure 2x4, no face.

Evidence (`<S>/WP23b/ad/`): `contact-{crow,girl,payphone,receiver,girlWindow}.png`; `comp3b/comp-*.png` in-game-size
composites on the denizen-free 1080p store shots of `WP22/val4/store1080` (zoom 1: e1 corner restored + crow on lamp /
booth apex, cycle 2+ high crow row I, girl run / drop whole; zoom .75: s9 era III fog booth + damp crow + girl palm /
talk; zoom .5: s11 III / IV, s15 era V, postgame portrait whole with the restored girl window) with `-crop<n>-1to1` /
`-x3` crops and `-window-x6`; `gate3b/` the uploaded PNGs; `work3b/` drafts, the 5 pre-AD3b PNGs and masters
(`before/`), the generators (`gen.py`, `mknew.py`, `*_spec.py`, `gen_pay.py`) and checkers (`dchk.py`, `celldiff.py`,
`holes.py`, `booth.py` = booth + tally marks + receiver preview).

Crow notes (AD3b):
- perch0 / perch1: upright perched crow facing right, wings folded (near wing iron 2 over the body iron 1, ragged
  primaries over an iron 0 tail), heavy ink beak; legs x 11-12 rows 15-16, toes x 9-14 on row 17 = on the lamp finial
  (lamp x 5-6) at `WORLD_ERA_ENV.crowPerchLiftArtPx` 56. perch1 = head and beak 1 px lower: the 0.5 s bob of
  `crowPerch` and the finale 13 s shield pose (head tucked). `damp` layer (III, IV, V): 1 px ink drips (beak tip on
  perch0 only, so the drop falls on the bob; tail tip on both); no gloss. whole: `gloss` (iron 3 on the crown and the
  folded wing's leading edge).
- peck0 / peck1: body tipped forward with the tail up; peck0 head lowered, beak angled down-forward; peck1 the strike,
  beak tip on the bottom row. With the KEEP hop (`hopDx` -54, `hopDy` 10) the toes land on the booth apex (51 art px;
  composite `z1-e1-corner-whole`); play them unflipped (facing right, away from the machine).
- fly0 / fly1 / fly2: the frozen body (same head, beak, tail) with the legs tucked; wings level (shallow V) / down /
  UP (tall V). The body sits 2-4 px higher on the downstroke (fly1 rows 4-17, fly0 2-15, fly2 0-16), so the 8 fps
  cycle bobs. fly2 doubles as the cycle 2+ high pose (`crowHigh`, feet lift 66: the body hovers about 11 px over the
  lamp top). As the flock lead (T16) the 24x18 cell draws at the bird's scale: about 3x a flock bird, body centred near
  cell (12, 10), so origin (0.5, 0.5) is fine.

Girl notes (AD3b):
- palm (era III vents): hood pulled forward (smudge 1 row lower), free hand raised beside the hood with the palm up
  (ink-boxed `f` at x 11 row 8, sleeve x 11 rows 9-12), lantern still hanging. talk: the hood top (rows 4-7) tilted
  1 px right, nothing else moves, no mouth. shield (13 s): the lantern raised in front of the face (box x 6-8 rows
  8-11, dot (7, 9); row V `violet` layer makes it the violet era V lantern), the hanging lantern gone.
- lanternDrop (31.5 s, 200 ms): the lantern arm lowered and out, fingers open, the lantern 2 rows lower on its bail
  (x 1-3 rows 20-23): it is still drawn in her hand, so the `world.lantern` fallen sprite should appear only after
  it (see hand-offs).
- run0-run3 (31.5-34 s): back view (no face, `d` seam down the hood), leaning to -x; run0 / run2 one boot planted on
  row 27, the other kicked up behind with its sole showing, elbow out on the other side; run1 / run3 boots together.
  All four 24 tall (no bob: the tone box allows no taller cell). Never flipped.

Booth notes (AD3b):
- fog = `lit` (the booth is lit from powerLines; vents only from era III) with fogged glass: flat `3` (#5a5f63) over
  the whole tally area so the procedural marks stay crisp, a `4` condensation row at the glass bottom (row 37, under the
  last tally row), the shadow column `2`, two clear drip runs (`1`, x 13 rows 20-37, x 14 rows 27-37) only in the gap
  between the two tally columns (pane x 7-8). Rows III bake the fog to `s` / `t`: still lighter than the dark glass.
- restored = `dark` with every rust patch painted out (nearest iron in the row; the 1 px frame posts take the column
  above), glass whole with two parallel 45 degree reflections (`3` and `2`, `4` tips, upper left, under the marks), hood
  lamp off. The `restored` layer (whole row only) gives `dark`, `lit`, `ring0`, `ring1` the same paint and glass, so the
  LAST LOOK blink (`lit` row 5) and any postgame ring show the restored booth. The unit's cradle stays empty in EVERY
  booth cell: the hung-up handset is the receiver sprite (no double handset during the blink).
- receiver onHook = the handset hung up on the unit's OUTER side, upright, cups facing the unit, on a 1 px hook prong,
  the armoured cord from the mouthpiece into the unit's bottom corner. It is drawn for a new pivot: booth origin +
  `receiverOnHookArt` (13, -34) art px = booth cell (27.0, 18), the unit's top-right corner; cell columns 0-3 are empty
  (the unit shows through), column 4 lies on the unit's ink column x 27. At the old pivot (13, -22) it would float beside
  the wall under the unit: the new key is required.
- girlWindow restored = lit warm like the restored skyline's lit windows (`B` pane, `C` glow), rust curtains `e` (sill
  `d`), and the girl as a 2x4 `c` silhouette at the curtain (1 px head, 2 px body), no face, no outline. The restored
  skyline has a plain wall at (306, 106), so this overlay is the window (keep it on the far window plane in the postgame).

Hand-offs (renderer / data tasks; numbers are art px unless named world px):
- T14 receiver: add `WORLD_ENV.receiverOnHookArt: { x: 13, y: -34 }` (`src/data/livingWorld.ts`, data owner T10/T14);
  while the script receiver is `onHook`, position the receiver (origin (0.5, 0) unchanged) at booth feet +
  `receiverOnHookArt` x `PIXEL_SCALE`, no ring jerk. Never show `onHook` at `receiverArt`.
- T14 booth: `restored` row 5 after the payphone restore time, `blink` = `lit` row 5 (already restored paint and glass,
  empty cradle), `dark` only before the restore. Nothing else changes (marks, pane, anchor).
- T8 fog: show `fog` instead of `lit` while `state.props.boothFog` (not during a ring); draw the marks in
  `WORLD_MARKS.fogColor` `0xddc9a3` while the fog frame shows (DENIZEN_ART 2.5), `0xa8957a` otherwise.
- T4 / FX2 lantern: the fallen `world.lantern` should appear at `girlRun.startS + dropMs` (31.7 s), not at `startS`
  (during `lanternDrop` the lantern is still in her hand), at x = girl x - 11 world px (her lantern: cell x 1-3, centre
  5.5 art px left of the pivot): `WORLD_ENDING.homeX.lantern` 990 -> 965 (recommended; at 990 it lands on her other side).
- T4 crow: perch at lift 56 (unchanged); pecks unflipped on the booth apex (hop unchanged); flight frames need no feet
  (airborne); crowHigh keeps `fly2` at lift 58 + 8.
- No `src/assets/worldSheets.test.ts` allow-list change: every AD3b pixel is on the 25-colour palette (+ violet in row V).

## WP23b AD3c (Wave B art, part 3, 2026-10-25)

Redrawn: the last 5 placeholder columns (sensor7 `fog` in all 6 era rows, lamp `warm` and `restored`, lampGlow `warm`,
clock `restored`). New sheets: `world.puddle` (`world/puddles.png`), `world.sprout` (`world/sprout.png`), `world.page`
(`world/page.png`), `bg.virga` (`bg/virga.png`); manifest `file` + description wired, ASSET_GUIDE rows regenerated with
`ASSET_GUIDE_OUT`, `FILE_NULL` in `src/assets/manifest.test.ts` is now only `world.shadow` (24 of 25 WP23a ids have a
file). Frame sizes, order and era rows unchanged (D7). A per-cell byte diff against the AD3b PNGs changes exactly those 5
columns (every other cell, rows I-II included, is identical); a rebuild of all 24 sheets to a scratch folder is
byte-identical to the shipped PNGs and all 24 are check_sheet CLEAN. Hand-pixelled; the virga rows come from a seeded
generator (`<S>/WP23b/ad/work3c/gen3c.py` writes `masters/virga/virga.txt`; the master is the source of truth).
PixelLab used for the gates only (no generations spent).

Toolchain: `pal.RESTORED` (8 codes, not in the 25), `restored_frames` and `vertical` in `sheets.py` / `check_sheet.py` /
`build_sheet.py` (see Files). Restored-world colours (PALETTE green0-3, skyClear0-3) appear in exactly two cells:
`world.puddle` frame 9 `whole` and `world.sprout` frame 4 `bloom`. `src/assets/worldSheets.test.ts` carries the matching
per-id allow-list (`RESTORED_CELLS`: frame index -> manifest cell rect) and checks both ways: the colours pass only
inside those rects, and both cells really use them. The gate now also covers `bg.virga`.

| sheet | PNG | score | lint | silhouette (lint) | holes | check_sheet | cells drawn |
|---|---|---|---|---|---|---|---|
| lamp | 48x60 | 96.3 | 0 / 0, 4 info | 4 | 0 | CLEAN | warm, restored |
| lampGlow | 64x16 | 96.0 | 0 / 0, 2 info | 1 (cells touch) | 0 | CLEAN | warm |
| clock | 32x44 | 100.0 | 0 / 0, 3 info | 2 | 0 | CLEAN | restored |
| sensor7 | 160x240 | 97.0 | 0 / 0, 4 info | 48 | 0 | CLEAN | fog (6 rows) |
| puddle | 320x5 | 96.0 | 0 / 0, 4 info | 10 | 0 | CLEAN | all 10 (new) |
| sprout | 40x24 | 100.0 | 0 / 0, 2 info | 5 | 0 | CLEAN | all 5 (new) |
| page | 6x4 | 100.0 | 0 / 0, 3 info | 1 (cells touch) | 0 | CLEAN | flat, tilt (new) |
| virga | 512x128 | 100.0 | 0 / 0, 2 info | 1137 (`parts`: streaks) | - | CLEAN | fall, frozen (new) |

Minimum sizes (DENIZEN_ART 1.2): lamp 56, Sensor 7 36 (stack), clock 44 art px tall, unchanged (objects floor 36). Props
and the virga strip have no floor; the sprout's tallest stage is 24 art px (48 world, 24 logical px at zoom .5). No green
or blue outside the two restored cells, no text, alpha 0 / 255 only, palette only (check_sheet + worldSheets.test.ts).

Evidence (`<S>/WP23b/ad/`): `contact-{lamp,lampGlow,clock,sensor7,puddle,sprout,page,virga}.png`; `comp3c/comp-*.png`
in-game-size composites on the denizen-free 1080p store shots of `WP22/val4/store1080` (zoom .5: `z05-s11-II-before` /
`z05-s11-III` (+ `-size2`, `-virga70`) the Q6 II -> III pair, `z05-s11-IV` (+ `-grey`) frozen virga and ringing puddle,
`z05-s15-V` (+ `-stage3`) black puddle and the bent sprout, `z05-postgame-whole`; zoom .75: `z075-s9-III` / `-IV` the
strip at the s10 zoom; zoom 1: `z1-e1-III-props`, `z1-e1-baseL-whole`, `z1-e1-baseR-whole` the survey holds at their own
scale) with `-crop<n>-1to1` / `-x3` and `-virga-1to1` / `-x3` crops (`-sensorfog-x8`, `-corner-x4` extra); `gate3c/` the
uploaded PNGs; `work3c/` the pre-AD3c PNGs and masters (`before/`), the master writer `gen3c.py`, the compositor
`ad3c_comp.py`, `view.py`, `rebuild/` (the 24-sheet rebuild), the README edit scripts.

Notes (AD3c):
- lamp `warm` (era III-V, `WORLD_LAMP.warmFromEra`, dead again at skyAperture): the same ruined lamp (rust kept), the
  glass one step warmer than `lit` (#d9822b body, #f0a848 2x2 core, #c98552 / #ad6236 shade; no #ffd27a: it stays amber,
  not bright), the seat under the glass catches more light. `restored` (finale / postgame): glass one more step (#f0a848
  body, #ffd27a core), every rust run on the post and plinth painted out with the iron of its column. Silhouette, glass
  rows 9-12 and the finial are identical in all four frames.
- lampGlow `warm`: the cold ellipses one step warmer (outer #c98552, inner #d9822b) plus a centred 8x4 #f0a848 core (rows
  6-9), still hard-stepped and opaque (alpha is runtime).
- clock `restored`: the 2 px crack becomes dial paper, rust on the post and plinth painted out, a 2 px #a3a6a4 glint on the
  upper-left bezel. No hands in the art (the dial keeps only the faint ticks; the code hands draw over it).
- sensor7 `fog`: a lens-sized overlay that repeats headR's lens ring pixel for pixel (x9..13 rows 6..11) around a fogged
  glass (x10..12 rows 7..10): milky #d2bf9c / #b8a98f over the upper left with the glint kept, the lower right wiped clear
  by drips (the dark glass). Row III (the only row the game shows it in) bakes the film to #ddc9a3 / #c9b28a over the
  #2e1a12 glass: the lens still reads as a lens. It is in `overlays` (no feet check).
- puddle: a shallow pool seen at a low angle: far bank, water rows, near bank on row 4 (the ground line). Grey = the
  bright #d2bf9c water (the haze it reflects) with a #b8a98f grey cloud that is not in this sky, wet earth banks #8a7a64,
  never blue. Ring = the same pool with the cloud scattered and one 1 px #9c9182 ripple trough ring centred on the water.
  Black = ink water that reflects nothing, banks kept. Whole = the size-3 pool with the restored sky (skyClear) and grass
  banks (green). RIGHT-ANCHORED: every size ends at cell x 30, so the sprout stands at the edge of every size and the pool
  grows to the left (away from the machine); size 1 in size 2 in size 3 (`grow`: puddles never dry). First drafts used a
  #9c9182 water field: at zoom .5 it matched the far plain (#9f8e75) and vanished; the bright water reads.
- sprout: a white etiolated seedling (2 px stem #ddc9a3 / #c9b28a on the pivot, alternate drooping pale leaves, a hook at
  the tip, wet soil #5f5244); stages 7 / 13 / 19 / 24 art px tall, each keeps every pixel of the one before (the old hook
  becomes the next leaf), stage 4 adds a top bent toward +x (the beam). bloom: green stem and leaves (green0-3), a #ddc9a3
  flower with a #f0a848 eye, upright, grass base.
- page: 3x4, flat = paper face-on with one ruled line and a shade edge, tilt = the sheet on its corner mid-flip; every
  colour cluster >= 2 px (a first draft with single-pixel corners scored 88).
- virga: 6 curtains per 512 px tile (30-96 px wide, tops at rows 0-11, gaps 16-32 + a 30 px wrap gap), streaks at pitch
  2-3 px, longest at each curtain's centre (a hanging fringe), tails curling toward +x (wind shear 0.0032 * i^2 px),
  #7a7468 head (first half), #9c9182 body, then whole dashes (3 on / 2 off, 2 on / 3 off); rows 56-63 empty. Same sf
  and 512 px tile as `bg.mountains`, so (same `layerPhase`) virga column x hangs over mountains column x: every streak
  pixel is >= 14 art px above the ridge column under it (the highest ruin peak is mountains row 69; the writer asserts
  >= 6, the DENIZEN_ART 5 rule, against `bg/mountains.png`). Every streak
  is 4-connected (a shear step draws its joint), so lint finds 0 isolated pixels. frozen = the same streaks held as 2 px
  beads every 5 rows (dark head, pale tail). Tiles on x (streaks wrap at 512). A first draft at pitch 2-4 with a short
  dark head read as faint hair at zoom .5; the denser darker heads read as rain curtains.

Hand-offs (renderer / data tasks; numbers are art px unless named world px; x = the placement x, feet = GROUND_Y + dy):
- T10 / T8 puddle (`world.puddle`, origin (0.5, 1), back row, depth `WORLD_DEPTH_OFFSETS.scraps`, dy 0): frame =
  `(size - 1) * 3 + look` (grey 0, ring 1, black 2), whole 9 (= `WORLD_PUDDLE`). The art is right-anchored: every size's
  right edge is x + 30 world px. World spans: size 1 [x, x + 30) 30 px wide, 8 tall; size 2 [x - 14, x + 30) 44 wide, 10
  tall; size 3 and whole [x - 30, x + 30) 60 wide, 10 tall. Water / ripple centre: size 1 x + 16, size 2 x + 8, size 3 x.
  Placement: x 960 (= DENIZEN_ART "930-990" for size 3), feet on GROUND_Y. The finale `whole` frame is size 3 whatever
  the size was (the pool fills at the wipe: finale only). `ripple(3)` glint: tint the sprite (e.g. 0xffffff -> lighter)
  for 120 ms, no frame change.
- T10 / T8 sprout (`world.sprout`, origin (0.5, 1), back row, same depth): x = puddle x + 36 (996), feet on GROUND_Y,
  frame = stage - 1 (0-3), bloom 4. Stem on the origin ([x - 2, x + 2) world), soil [x - 4, x + 4): 2 world px right of
  the puddle edge (990). Heights 14 / 26 / 38 / 48 world px; stage 4 leans its top toward +x (tip pixel at
  [x + 6, x + 8) world, 48 px up; toward the machine centre / beam): never flip it while the sprout stands left of x 1920
  (every placement does).
- T12 page (`world.page`, origin (0.5, 0.5), 6x8 world): `flat` for the first half of the rise, `tilt` after (no
  rotation needed), fade over the last 20 %. Start at the Inspector's feet + `WORLD_PAGES.startOffsetWorldPx` (8, -40):
  that is on his clipboard (AD3a: board top row 19-20 = feet -40 / -42 world, x +8 / +10 facing right); mirror the x
  offset (and flipX the page) when the Inspector is flipped. `driftWorldPx` +20 drifts with the canon dust.
- T12 virga (`bg.virga`): one tile sprite of ONE frame, 512x64 art -> tile scale PIXEL_SCALE 2 -> 1024x128 world per tile,
  sprite height exactly 128 world px, origin (0, 1) at the `parallaxStrip` bottom (`WORLD_VIRGA.bottomY` 1536 at
  CAMERA.focus = mountains art row 84), phase `layerPhase(0.15, 512, 2)` = the mountains' phase: keep it, the art is
  clear of the ridge column by column (>= 14 art px) only while both tiles line up. Frame 0 `fall` (era III), frame 1
  `frozen` (era IV); never let the texture tile vertically into the other frame: either build the tile sprite from the
  frame (`scene.add.tileSprite(x, y, w, 128, 'bg.virga', frame)`) or, with the whole 512x128 texture, keep height 128 and
  set `tilePositionY` to 0 / 64 (texture px) for fall / frozen. Era V: alpha fades out (art unchanged). Q6: at 1920x1080
  zoom .5 the strip is a 96 device px band (s11: y 483-579) of grey curtains over the skyline tops. Alpha .55 reads but
  faint (`comp-z05-s11-III-virga-1to1.png`); .7 reads clearly (`comp-z05-s11-III-virga70-virga-1to1.png`):
  recommended `WORLD_VIRGA.alpha` 0.7 (data owner; AD4 confirms with the live pair).
- T7 Sensor 7 fog: frame `fog` (column 5) of the state era row, same position and origin as the tripod, drawn after head
  and glyph (the existing part order: dots, tripod, head, readout, fog, LED). It is aligned to headR's lens only: show it
  while `state.sensor.fog` AND the head frame is `headR`; hide it while headC / headL / headUp shows (talk, glance, double
  blink, turn). headR is the live head in every era III framing (camera centre > sensor x + 200), so the fog is up almost
  all the time.
- T8 / T14 lamp: frame `warm` (2) from `WORLD_LAMP.warmFromEra` until the skyAperture `dead`; `restored` (3) in the
  finale / postgame script. The glass, finial and seat geometry are identical to `lit`: `WORLD_ENV.lampHeadArtPx` 49
  (glass centre, glow + mote centre) and `crowLiftArtPx` / `crowPerchLiftArtPx` stay. lampGlow frame `warm` (1) with the
  warm and the restored lamp (`lampGlowWarm`), alpha .4 / bump .2 unchanged.
- T14 clock: frame `restored` (1) once the wipe passes the clock x; dial centre cell (8, 8) = `faceCenterArt` (0, -36)
  unchanged; the second hand stays code (1 art px), hour and minute at 4:41.
- T10 sheet ids: `WORLD_FRAMES` names and order exactly as `sheets.py` FRAMES (puddle size1Grey .. whole, sprout stage1 ..
  bloom, page flat / tilt, virga fall / frozen). `bg.virga` is a single-row sheet (no era rows), frames stacked vertically.

## WP23b AD3d (final art QA, 2026-10-25)

No new art: every gate passed on all 24 PNGs (22 under `world/` + `bg/window-lit.png` + `bg/virga.png`), so no cell was
redrawn and no master changed after AD3c. Hand-pixelled sources, PixelLab used for the gates only (no generations spent).

Checks:
- Rebuild: all 24 sheets built from the masters into `<S>/WP23b/ad/work3d/rebuild/` are byte-identical to the shipped
  PNGs (`cmp`); no build prints a PLACEHOLDER line.
- `check_sheet.py` CLEAN on all 24; the manifest size, frame grid, frame count and era rows match for every id (logs
  `work3d/check/<sheet>.txt`).
- Workbench: score and lint reproduced exactly on 25 uploads (dog as two halves): every score >= 95.1, lint 0 errors /
  0 warnings, info only (`gate3d/workbench.txt`, upload ids `gate3d/uploads.txt`).
- Independent pass over the SHIPPED PNGs (`work3d/qa3d.py` -> `work3d/qa3d.txt`, FAILS 0): per cell bbox, 4-connected
  components (1 per cell on every sheet but `bg.virga`), alpha {0, 255}, palette only, violet only in row V of the 7
  era-row sheets, restored-world colours only in puddle frame 10 (`whole`, index 9) and sprout frame 5 (`bloom`, index 4)
  and present in both, no green or blue hue (HSV s >= .2, h 75-255 deg) in any other cell.
- No text: all 24 contact sheets reviewed at 4x. The only glyphs are Sensor 7's stencilled `7` and its `-` / `1` readout
  cells (allowed, DENIZEN_ART 1.5) and the procedural tally marks (code, not art).
- Wiring: 24 / 24 manifest `file`s at the PNG size; `WORLD_FRAMES` (`src/data/livingWorld.ts`) equals `sheets.FRAMES`
  for all 24 sheets (names and order) and `WORLD_SHEET_KEYS` the 24 ids; `FILE_NULL` in `src/assets/manifest.test.ts`
  is `world.shadow` only (24 of the 25 WP23a ids have a file); PLACEHOLDER table empty (131 / 131 columns drawn);
  `docs/ASSET_GUIDE.md`: all 145 table rows equal the `ASSET_GUIDE_OUT` generator output (`work3d/guide-tables.md`).
  Final wording (manifest + ASSET_GUIDE, same text): the 17 "planned file" descriptions now say "file"; payphone (restored
  = glass whole, rust painted out), red ball (cycle 2+ trace, postgame), stake, hole, lantern, girl and scraps name their
  final frames.

| sheet | PNG | score | lint (err / warn, info) | comps (lint, whole sheet) | check_sheet | min h / floor (art px) | colour rules (qa3d) |
|---|---|---|---|---|---|---|---|
| inspector | `world/inspector.png` 380x240 | 95.9 | 0 / 0, 4 | 99 (canopy-to-boots touches; 1 per cell in check_sheet) | CLEAN | 31-40 / 24 | pass |
| dog | `world/dog.png` 560x120 | 99.3 / 97.4 (halves) | 0 / 0, 3 / 4 | 60 / 60 | CLEAN | 16-17 / 14 (flat 9, sleep 10: lying) | pass |
| crow | `world/crow.png` 240x108 | 99.8 | 0 / 0, 4 | 60 | CLEAN | 14-17 / 14 | pass |
| girl | `world/girl.png` 160x168 | 98.1 | 0 / 0, 3 | 60 | CLEAN | 24 / 24 | pass |
| payphone | `world/payphone.png` 168x312 | 97.8 | 0 / 0, 4 | 36 | CLEAN | 51 / 36 | pass |
| receiver | `world/receiver.png` 48x72 | 95.1 | 0 / 0, 3 | 26 (row-0 cords touch; 1 per cell in check_sheet) | CLEAN | prop | pass |
| sensor7 | `world/sensor7.png` 160x240 | 97.0 | 0 / 0, 4 | 48 | CLEAN | 36 stack (headUp 39) / 36 | pass |
| girlWindow | `world/girl-window.png` 16x6 | 96.0 | 0 / 0, 3 | 1 (cells touch) | CLEAN | far plane | pass |
| girlMini | `world/girl-mini.png` 16x12 | 100.0 | 0 / 0, 3 | 2 | CLEAN | pylon plane | pass |
| lamp | `world/street-lamp.png` 48x60 | 96.3 | 0 / 0, 4 | 4 | CLEAN | 56 / 36 | pass |
| lampGlow | `world/lamp-glow.png` 64x16 | 96.0 | 0 / 0, 2 | 1 (cells touch) | CLEAN | overlay | pass |
| clock | `world/street-clock.png` 32x44 | 100.0 | 0 / 0, 3 | 2 | CLEAN | 44 / 36 | pass |
| stakeChain | `world/stake-chain.png` 20x6 | 99.1 | 0 / 0, 3 | 2 | CLEAN | prop | pass |
| hole | `world/hole.png` 64x6 | 95.6 | 0 / 0, 2 | 4 | CLEAN | prop | pass |
| scraps | `world/scraps.png` 24x4 | 99.1 | 0 / 0, 3 | 2 (cells touch) | CLEAN | prop | pass |
| mote | `world/mote.png` 4x2 | 100.0 | 0 / 0, 2 | 1 (cells touch) | CLEAN | prop | pass |
| windowLit | `bg/window-lit.png` 8x6 | 100.0 | 0 / 0, 2 | 1 (cells touch) | CLEAN | far plane | pass |
| lantern | `world/lantern.png` 12x4 | 100.0 | 0 / 0, 3 | 2 | CLEAN | prop | pass |
| redBall | `world/red-ball.png` 3x3 | 100.0 | 0 / 0, 2 | 1 | CLEAN | prop | pass |
| clipboardPages | `world/clipboard-pages.png` 18x3 | 98.7 | 0 / 0, 3 | 1 (cells touch) | CLEAN | overlay | pass |
| puddle | `world/puddles.png` 320x5 | 96.0 | 0 / 0, 4 | 10 | CLEAN | prop | pass |
| sprout | `world/sprout.png` 40x24 | 100.0 | 0 / 0, 2 | 5 | CLEAN | prop (24 tall) | pass |
| page | `world/page.png` 6x4 | 100.0 | 0 / 0, 3 | 1 (cells touch) | CLEAN | prop | pass |
| virga | `bg/virga.png` 512x128 | 100.0 | 0 / 0, 2 | 1137 (`parts`: streaks) | CLEAN | far strip | pass |

Minimum sizes (DENIZEN_ART 1.2; art px tall = logical px at zoom .5, every era row): people floor 24 (Inspector 31-40:
walk0 / walk2 31, idle 32-33, wave 37, umbrella 40; girl 24 in all 60 cells), animals floor 14 (dog 16-17 standing and
sitting, flat 9 and sleep 10 lying at the authored scale as in AD3a; crow 14-17), objects floor 36 (booth 51, Sensor 7
stack 36 / headUp 39, lamp 56, clock 44).

Evidence (`<S>/WP23b/ad/`):
- `contact3d/contact-<sheet>.png`: 24 boards (frames x era rows at 4x, era ladder, readability 1x / 1.5x / 2x / 3x on the
  sky and on the skyline).
- `comp3d/comp-<scene>.png` with `-crop0` / `-crop1` (left / right wing) `-1to1` / `-x3`, `-virga-`, `-windows-x6`,
  `-window-x6` (girl window) and `-mini-x6` crops: four states at three zooms on the denizen-free 1080p store shots
  (`<S>/WP22/val4/store1080/1080`), every denizen and prop of the state together:
  - zoom .5: `z05-s11-III` (era III vents: fog booth + fog marks, puddle size 1 + sprout 1, warm lamp + glow + ash motes,
    damp crow perched, Sensor 7 fog, Inspector umbrella, dog shake, girl mini on the near pylon, lit windows, virga
    fall), `z05-s11-IV` (frozen virga, breathing windows, ringing size-3 puddle, sprout 2, 5 Chladni rings, a page, the
    girl on the ground), `z05-s15-V` (black puddle, tall bent sprout, violet rims, dead lamp, violet Chladni, no shadows,
    the girl 4 steps down the front band), `z05-postgame-whole` (restored girl window figure, whole puddle + bloom, fallen
    lantern, restored booth + onHook receiver, restored lamp + moth, restored clock, crow, dog wag + red ball, Inspector
    wave).
  - zoom .75 (s9 rows): `z075-s9-III`, `-IV`, `-V`, `-whole`; zoom 1 (e1 rows): `z1-e1-III`, `-IV`, `-V`, `-whole`. At .75
    and 1 the puddle (x 1428), sprout (1464) and lantern (1527) are scale proxies in the left wing: those framings do not
    place them.
  - `-fix` variants with the hand-offs H1-H3 applied: `z05-s11-III-fix`, `z05-s11-IV-fix`, `z05-s15-V-fix`,
    `z05-postgame-whole-fix`, `z075-s9-IV-fix`, `z1-e1-III-fix`, `z1-e1-V-fix`, `z1-e1-whole-fix`; and
    `comp-redball-{s9,e1}-dx14-22-m22-x4.png` (H4: offsets 14 / 22 / -22).
- `gate3d/`: the 24 PNGs + dog halves as uploaded, `uploads.txt`, `workbench.txt`.
- `work3d/`: `qa3d.py` / `qa3d.txt`, `ad3d_comp.py` (the compositor: virga, windows, girl window, pylon mini, Chladni,
  booth + marks + receiver, lamp + glow + motes, page), `ad3d_comp_ball.py`, `desc_edit.py`, `readme_ad3d.py`,
  `rebuild/`, `check/`, `guide-tables.md`, `peek-*.png` (Chladni crops, the pylon foot of the mini).

Verdict: every cell passes and the cast, street corner and props read at all three zooms (crow 14 and girl 24 art px, at
their floors, still read at zoom .5 1080p). Four placement defects remain, all in data / renderer code, not in the PNGs
(H1-H4).

Hand-offs and tunables (renderer / data / AD4; numbers are world px unless named art px; owners through the EM):
- H1 Chladni far half floats (`WorldAtmos.drawRings`, `WORLD_CHLADNI`). The rings are ellipses round (MACHINE_ANCHOR.x,
  GROUND_Y + 10) with ry 36-84, so the far half (y < GROUND_Y) is drawn above the ground line: in the wings and between
  machine parts it paints dashed arcs over the sky, skyline and pylons (`comp-z075-s9-IV-crop0-x3`,
  `comp-z1-e1-V-crop0-1to1`, `work3d/peek-chladni-z075-s9-IV.png`). Fix: in `strokeDashedEllipse` lift the pen for every
  step whose segment has min y < GROUND_Y (keep adding to the dash length so the phase does not jump): only the near
  half-arcs draw. Numbers stay: rx 360-840 / ry 36-84, centerYOffsetPx 10, dash / gap 6, line PIXEL_SCALE, alpha .8
  (sand reads faint, violet clear; `-fix` variants).
- H2 Puddle above the ground line (WorldProps puddle + sprout, data). Feet on GROUND_Y put the 5 art px pool above the
  terrain line, on the far plain: it reads as a pale slab, not water (`comp-z1-e1-III-crop0-x3`). Fix: feet y =
  GROUND_Y + 10 (5 art px x PIXEL_SCALE: the far bank row on the ground line, the water in the ground strip) and the same
  + 10 for the sprout (it stands at the pool's right bank); depths unchanged. Proposed key `WORLD_PUDDLE.dyWorldPx: 10`
  (`src/data/worldEras.ts`) read by WorldProps for both sprites. Evidence: `comp-z1-e1-III-fix-crop0-x3`,
  `comp-z05-s15-V-fix-crop0-x3`, `comp-z05-postgame-whole-fix-crop0-x3`.
- H3 Fallen lantern behind the girl (WorldProps lantern; `WORLD_PLACEMENTS` lantern rows s15 / portrait / baseL;
  `WORLD_ENDING.homeX.lantern`). She drops it at x 965 while she stands in the front band (GROUND_Y + 32 + 8 per era V
  step = GROUND_Y + 72 with all 5 steps met), but the sprite lies on the back row (GROUND_Y): 72 px up the screen from her
  feet, on the puddle water (`comp-z05-postgame-whole-crop0-x3`). Fix: lantern feet y = the girl's feet y at the drop
  (her placement feet, + 72 with 5 steps), x 965 unchanged, front row container (offset `lamp` 0). With H2 it no longer
  touches the pool. Evidence: `comp-z05-postgame-whole-fix-crop0-x3`, `comp-z1-e1-whole-fix-crop0-1to1`.
- H4 Red ball lost in the paws (`WORLD_TRACES.redBallDxWorldPx` 14). At dog x + 14 the 3 px ball sits on the sitting
  dog's front paws in the same rust hue and reads as a paw patch. Set 22: the ball sits clear of the paws on the rim of
  the hole (`comp-redball-s9-dx14-22-m22-x4.png`).
- H5 `WORLD_VIRGA`: alpha .55 in data; AD3c recommended .7, re-confirmed here (`comp-z05-s11-III-virga-1to1` at .55 vs
  `comp3c/comp-z05-s11-III-virga70-virga-1to1`): AD4 picks live. bottomY 1536: keep (the streaks clear the ridge column
  by column by >= 14 art px only with the mountains' layerPhase; any new bottomY needs the gen3c clearance check >= 6 art
  px).
- H6 `WORLD_WINDOWS` counts (the first `lit` panes of `WORLD_FAR_PLANES.windows` stay on). Visible share per pose: s11
  6 / 6 (central-tower panes 67-83 %), s9 6 / 6 (pane 6 57 %), e1 4 (panes 2 and 3 behind the machine), s15 5 (pane 3
  (318, 146) 0 %, behind the era V machine), so at s15 the era V step `lit 4` shows 3. Optional: move (318, 146) to the
  end of `WORLD_FAR_PLANES.windows`; then 4 / 2 / 1 / 0 are all visible steps at s15 (eras II-IV light all six).
- Info, no change: the payphone `fog` cell of the whole row keeps its rust (fog shows only in era III; the finale and
  postgame use `restored` / `lit` of row 5). The girl mini on the near pylon (era III) draws at full alpha against the
  .45 pylon layer, so she reads darker than the pylon she stands by: it keeps her visible (WP23a choice; AD4 may judge).

## WP23b AD4 (in-game audit, round 4, 2026-10-25)

One cell redrawn: `lantern` frame `fallen` (F4 in docs/plan/ART_AUDIT.md). The AD3a fallen lantern was an all-dark capsule (ink
cage around 2 px of `#2b2e31` glass): in game it vanished on the dark base of the restored regrowth bush and read as a stone in the
postgame grass. Now: on its side, bail left, ink cage around still-warm glass `B` / `C` and the rust base `d` (`..KKK.` /
`.KKBdK` / `.KKCdK` / `..KKK.`), the warmest point of the inner left gap. `lit` unchanged. Gates: check_sheet CLEAN, workbench
score 91.0 (singletons -9: the two glass pixels), lint 0 / 0 (3 info), `npx vitest run src/assets/worldSheets.test.ts` 29 / 29. The
fallen lantern lies at the girl's era V feet (front row + 40, world y 1752), below the zoom-1 baseL view (bottom 1740): it shows at
the full pose, LAST LOOK, the choice and the postgame (ART_AUDIT N1). Evidence: `<S>/WP23b/ad4/crops/F4-lantern-postgame-before-after-x5.png`.
