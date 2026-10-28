# DENIZEN ART: Living World (WP22 art spec, Art Director)

User request (2026-10-24): the scene feels lonely with only the machine. Add a ruined world with people, animals and
objects in it. They change a little with each era, may turn to the camera and talk to the player, and carry the story.

- Status: design and proof only. No file under `src/`, `scripts/`, `public/` or the tests was changed.
- Story source: `docs/plan/STORY_BIBLE.md` (cast, lines, cadence). This doc is the art and staging layer on top of it.
  Where the two disagree, this doc wins for pixels, colors, sizes, positions and the bubble's look. The bible wins
  for text and timing.
- Companion: `docs/plan/PART_TIERS.md` (WP23, part evolution).
- Proof set: `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22-23/proof-denizens/` (§7).

## 0. Decisions at a glance

| # | decision |
|---|---|
| D1 | **One pixel grid.** Every denizen and prop uses `PIXEL_SCALE` 2, the same as the machine. No per-zoom scaling and no picture-in-picture lens. Readability comes from silhouette, a full ink outline, placement and the bubble tail (§1.3). |
| D2 | **Palette-step fidelity replaces the bible's "sepia sprite + color twin crossfade".** Each denizen has one color master per frame. An offline recolor script bakes 6 era rows (I, II, III, IV, V, whole), and color comes back one material per era. Every pixel stays on the 25-color palette. There is no twin sprite, which halves the display objects and avoids muddy blend colors. Only the era I ghost uses alpha (.75). |
| D3 | **Era V: violet rim, no shadow.** From `horizonField` ≥ 5 every denizen loses its shadow. The era V row puts a 1 px `violetLight` rim on both flanks ("light from every side"). It ties the figures into the violet sky and keeps them readable on it. |
| D4 | **Paper bubble.** The DOM bubble is paper `#ddc9a3` with ink `#14110f` text and a 2 px pixel border with notched corners, plus a stepped tail. Dark slabs with orange borders stay the machine's voice; paper is the world's voice. This replaces the bible's `#1d1f21` bubble. Contrast is 11.6:1. |
| D5 | **Turn grammar.** The speaking turn is a snap to the front frame. A glance is a head-only frame on the profile body (the uncanny one). Talking is a 1 px head bob, with a mouth pixel from era III. Front frames hold the clipboard, form side out, toward the camera. |
| D6 | **Placement is a per-framing table** (§3), computed from reader 2's view and machine rects. It fixes 5 conflicts in the bible's table: the era II corner at s8, the lamp and crow past the view edge at s9, the era III entry booth, the era V clock inside the right anchor, and the postgame dog hidden behind the buttons. |
| D7 | **Postgame dog loop moves to the left wing.** At UI 100 the bottom-right buttons cover the right wing's front row, and at UI 150 they cover every foot there. |
| D8 | **Assets.** New category `world`. One sheet per denizen: rows = era variant, columns = frames in a fixed order. About 1.55 MiB decoded in total (§6.5). |
| D9 | **Production.** Masters are hand-pixelled. PixelLab is used for concepts and proportion references only: sprites ≤ 24 px wide are where AI output fails. Gate: workbench `score` ≥ 90 and `lint` with 0 errors and 0 warnings. |
| D10 | **Sign-offs.** §18.2 (people in the restored world) is approved with conditions (§8.1). The girl's tone is approved with conditions (§2.4). |

---

## 1. Global rules

### 1.1 Scale

- A person is 32-33 art px tall, so 1 art px ≈ 5.3 cm.
  - The support frame (110 art px) is 3.4 people tall, and the flywheel (96 art px) is 5 m across.
  - The machine dwarfs the people. That is intended: it is the focus, and they are fragments.
- Size ratios (art px): Inspector 16×33 body, girl 12×24 (a child, about 0.73 of an adult), dog 24×16 (a medium
  dog), crow 20×14 (a large crow, wings spread), booth 24×48 (2.5 m), Sensor 7 16×36 (tripod 1.9 m), lamp 8×56
  (3 m), clock post 4×40 with a 12×12 face.

### 1.2 Minimum on-screen size (height in logical px at 1280×720; ×1.5 on a 1080p display)

| denizen | art h | zoom 1 (eras I, II start) | zoom .75 (s9, s10) | zoom .5 (s11-s15, finale, postgame) | floor | pass |
|---|---|---|---|---|---|---|
| Inspector | 33 | 66 | 50 | 33 | people ≥ 24 | yes |
| Girl | 24 | 48 | 36 | 24 | people ≥ 24 | yes, at the floor |
| Dog | 16 | 32 | 24 | 16 | animals ≥ 14 | yes |
| Crow | 14 | 28 | 21 | 14 | animals ≥ 14 | yes, at the floor |
| Booth | 48 | 96 | 72 | 48 | objects ≥ 36 | yes |
| Sensor 7 | 36 | 72 | 54 | 36 | objects ≥ 36 | yes |
| Street lamp | 56 | 112 | 84 | 56 | objects ≥ 36 | yes |

- The floors are the smallest sizes that still pass the 1× silhouette test (§1.3) on the proof.
- No denizen may be authored smaller than its floor.
- The Steam Deck (1280×800) runs at the same logical sizes.

### 1.3 How they stay readable (chosen) and what was rejected

1. **Silhouette test.** Each denizen, filled solid ink at 1 screen px per art px, must read as what it is:

   | denizen | key silhouette |
   |---|---|
   | Inspector | dome hat with a forward peak, long coat, clipboard |
   | Dog | low wedge, one upright ear, curled tail |
   | Crow | two spread wing fans |
   | Girl | pointed hood triangle, lantern dot |
   | Booth | tall box, peaked hood |
   | Sensor 7 | A-frame tripod, box head |

   Run `pixelart_workbench silhouette <id>`: one component (the crow's split wingtips are allowed).
2. **Full 1 px ink outline** on every denizen (not the selective outline the machine uses).
   - At zoom .5 the denizens stand in front of busy pylons and skyline. A full ring keeps them separate.
   - The workbench reports this as `pillow` info. Accept it: it is deliberate.
3. **Value.**
   - Eras I-IV: dark figures on the light sky and far plain. The coat value is #3e4246-#5a5f63 against #a8957a-#d2bf9c.
   - Era V: the violet rim (D3) on the dark violet sky.
   - The era I ghost stays at alpha ≥ .7. At .75 the proof reads clearly, with the pylon behind faintly visible.
4. **One unique prop each**, kept 3 art px or larger: clipboard, umbrella, lantern glow, receiver, LED, collar.
5. **Placement.**
   - Wings only, never in front of the machine.
   - Tall denizens stand in the back row. The small dog stands in the front row, so the plain ground band is behind its
     head instead of the skyline.
   - The crow sits 56 art px up on the lamp, against the sky.
6. **Speaker identification** does not depend on size. The cues are the snap turn, the 1-frame tracking line and the
   bubble tail, which always points at the head (§4).

**Rejected:**
- **Scale-up at zoom .5** (2× art): the pixel density would no longer match the machine (defect class 4), and it
  breaks the monumental scale.
- **Picture-in-picture "tape monitor" lens** (second Phaser camera): it costs a second render pass and competes
  with the machine for focus. It could be revisited in v1.1 for the dog only, if a playtest says so.

### 1.4 Rows and depth

| row | depth | feet y (world) | used by |
|---|---|---|---|
| far window plane | `DEPTH.background + 21.5` (-78.5; above skyline -80 and skylineRestored -79), sf 0.3 | the skyline art row | girl window overlay, six lit windows |
| pylon plane | `DEPTH.background + 32` (-68; above pylonsLit -69 and its wire), sf 0.55 | pylon base row | girl mini (eras II-III) |
| back row | `DEPTH.ground + 5` (5) | `GROUND_Y` | Inspector, Sensor 7, booth, lamp + crow, clock, girl (IV), puddles, sprout, scraps |
| front row | `DEPTH.machine + 3` (103) | `GROUND_Y` + 24 to + 48 | dog, hole, stake, red ball, girl (V steps) |

- **Shadows.**
  - One flat ink ellipse per grounded denizen at alpha .28: 14×3 for people, 18×3 for the dog, 26×3 for the booth.
    Sensor 7 gets three 2×1 foot dots.
  - Era I halves the alpha. From `horizonField` ≥ 5 there is none. They come back with the finale wave.
- **Facing.**
  - At rest a profile faces away from the machine: left-wing figures face left, right-wing figures face right.
  - Walking toward the machine, the head stays down on the clipboard or nose.
  - `flipX` is allowed for denizens. The light flips with it, which is tolerated at 24 px or under. Machine art
    never flips.

### 1.5 Palette rules (from the bible §2.4, art side)

- Rust Wasteland only (the 25 colors in `ART_BRIEF.md`), plus `violetLight` (`#9a6ad0`) for the era V rim and the
  double-exposure tint.
- No green or blue on any denizen or prop in a pre-finale frame. The only exceptions are the crow's blue-black
  gloss and Sensor 7's green LED, and only in whole rows.
- **Red has no slot in the palette.** Use these instead:
  - the dog's "red" collar: `#8c4a2a` / `#ad6236`;
  - the red ball: `#d9822b` with a `#f0a848` glint and a `#8c4a2a` shadow. It is the warmest pixel on screen,
    which is what the story needs.
- The LED "red" is `#ad6236` and "amber" is `#f0a848`.
- Lit windows are rust-amber (`#ad6236` core, `#c98552` center), never warm yellow, until the finale.
- No text in art. Ruled lines on the clipboard are allowed. Sensor 7's stenciled `7` and its two readout glyphs are
  the only exceptions.

### 1.6 Era ladder (palette-step fidelity, D2)

| row | colors that come back | other changes |
|---|---|---|
| I | none: full sepia (map in Appendix A) | alpha .75 before `wornMotor`, .85 after; shadow ×.5; face is a smudge, no eyes |
| II | accents come back as faded rust (`#d9822b` → `#8c4a2a`, `#f0a848` → `#ad6236`) | alpha 1; mains flicker is code |
| III | accents, skin and wood/leather (`#d9822b #f0a848 #c98552 #ad6236 #8c4a2a`) | 2 eye pixels; era props (umbrella, red collar, damp crow) |
| IV | + iron (`#1f2225`..`#5a5f63`) | — |
| V | everything | violet rim on both flanks; no shadow from `horizonField` ≥ 5 |
| whole | everything | restored props (pressed coat, chain gone, glass whole, glossy crow, green LED) |

- Proof: the ladder is row 1 of `contact-inspector.png`.
- The rows are baked offline by `eraRecolor` (Appendix A), which is deterministic and checked to be palette-only.
- **Era-only frames** (the umbrella, the restored chain-off dog) are drawn on a prop layer in the master and enabled
  per row by the script.

---

## 2. Cast sheets

Frame sizes are art px. The pivot is (0.5, 1): feet on the bottom row, body centered. Sheet = 6 era rows × N frames.

### 2.1 The Inspector `world.inspector` (proved, §7)

- **Size:** frame 20×40, body 16×33 (the canopy needs the top rows). Silhouette: dome hat with a forward peak, long
  coat with a slight hem flare, clipboard at the chest.
- **Colors (master):**
  - hat: sand `w v u t`;
  - coat: iron `3 2 1`;
  - hi-vis: `#d9822b`;
  - skin: rust `f e d`;
  - clipboard: board `#8c4a2a`, paper `#ddc9a3`, clip `#a3a6a4 #7d8286`;
  - umbrella canopy: iron `1 2 3`.
- **Frames (19, in sheet order):**

  | # | frames |
  |---|---|
  | 0-1 | idle a/b (breath: hat and shoulders 1 px) |
  | 2-5 | walk ×4 |
  | 6-7 | write ×2 (pencil hand) |
  | 8 | glance (profile body, front head) |
  | 9 | front (form side out to the camera) |
  | 10 | talk (front, head +1 px; mouth pixel from row III) |
  | 11 | shield (clipboard over the face, finale 13 s) |
  | 12-13 | pat ×2 |
  | 14 | wave |
  | 15 | watch |
  | 16 | umbrella open, palm out |
  | 17 | front umbrella |
  | 18 | talk umbrella |

  The closed umbrella hooked on the forearm is on the prop layer for rows III to whole, on frames 0-8.
- **Animation:**
  - idle 2 frames at 2 fps;
  - walk 8 fps, reversed in era V;
  - route: rest x ± 24 world, as 3 steps, write, walk back. Before `wornMotor`, one frame per crank click.
- **Cycle trace:** a 6×3 `world.clipboardPages` overlay with 3 frames (thicker per finished cycle). It is one extra
  sprite, shown only from cycle 2.
- **Per era:** row as in §1.6; the bible §3.1 behaviors on top. Era IV: front at rest after ONE OBSERVER (the stare).
- **Readability:** 33 / 50 / 66 logical px. Proof at 1×, 1.5×, 2× and 3× passes.

**WP24 (2026-10-26): walks, spots and the three new Inspector cells.**
- **Walk speed.** A walk draws 8 world px per frame at the playback fps: 16, 32 or 64 world px/s at 2, 4 or 8 fps. Holds run on real time and drawn frames snap to the mode fps. Before `wornMotor`, a crank click draws the next frame instead.
- **Spots, not the shuttle.** The route above is replaced. The Inspector walks between three spots: the sensor (-24 world px from his placement x), mid (0) and the scrap (+24). A walk covers at least 24 world px and lasts at most 6 s, so a sensor-to-scrap walk is six drawn frames. Every walk ends in an arrival hold, and a walk never follows a walk.
- **New cells** (frames 19–21; sheet 440 × 240, 22 frames per row):
  - 19 `lookUp`: idle body with the head tilted back to the sky and the board held one px lower. Rows III to whole keep the closed umbrella hooked on the forearm.
  - 20 `crouch`: kneels on the far knee with the board on the near knee; 26 px tall. The crouch travels to the Sensor 7 spot. The AD1b-1 hand-off that stopped it short of the scrap is superseded by WP24 Revision 6.
  - 21 `umbrellaHalf`: umbrellaOpen with the canopy half open. The vent reaction runs half, open, half.

### 2.2 The Dog `world.dog`

- **Size:** frame 28×20, body 24×16. A low wedge with one upright ear, one torn ear and a curled tail. The coat is
  rust `d e` and the belly `t`. The collar tag is blank (`#a8957a`).
- **Frames (20):**

  | # | frames |
  |---|---|
  | 0-1 | sit ×2 (dropped-frame loop seam in I-II is code) |
  | 2-3 | sniff ×2 |
  | 4-7 | walk ×4 |
  | 8-9 | dig ×2 |
  | 10-11 | shake ×2 |
  | 12 | head to camera (glance and stare); front-head dog cues (AD2c F6): flat skull top, the torn ear folded down as a 1 px flap on the skull side (never a second point), 3 px light muzzle (`u`) one row below the eye line with a 1 px ink nose at its bottom centre, `t` bridge between the eyes, jaw 1 px wider |
  | 13 | talk (head to camera, jaw 1 px: the light chin drops over the collar) |
  | 14 | flat (beam) |
  | 15 | lie facing camera (demo hold image; same front-head cues as 12) |
  | 16 | sleep |
  | 17-18 | chase ×2 (whole row) |
  | 19 | wag (tail up) |

- **Props:**
  - `world.stakeChain`: 10×6, 2 frames (chained / chain fallen).
  - `world.hole`: 16×6, 4 stages, front row, dog x + 30 (AD2 F7: the pit spans x + 14 .. x + 46, so the dig nose at
    x + 20 stays in it and the whole stage 1 pit shows beside the paws). It never refills.
  - `world.redBall`: 3×3, cycle 2+ and postgame.
- **Per era:** I sepia ghost, II flicker, III red collar (rust) back, IV still (the wag snaps to the downbeat),
  V backwards walk, whole without the chain.
- **Readability:** 16 logical px at zoom .5, at the floor. Mitigations:
  - the front row, so the ground band is behind it;
  - the upright ear always breaks the top line;
  - no frame drops the ear.

**WP24 (2026-10-26): the dog's new cells** (frames 20–22; sheet 644 × 120, 23 frames per row).
- 20 `scratch0` and 21 `scratch1`: the sit body with the near hind leg lifted from the haunch to a paw behind the ear (paw rows 6–8, then 7–9, on a 6 fps stroke). The far hind foot stays on the ground. Used by the scratch round, eras I–III.
- 22 `lookUp`: the sit body with the head tilted back to the sky, muzzle up; the upright ear stays upright. Used by the lookUp round (eras I–III, after a crow move or a ring) and by the era IV `look` beat.
- Frames 16 (`sleep`) and 19 (`wag`) are reused before the finale. No new cell.

### 2.3 The Crow `world.crow`

- **Size:** frame 24×18, body 20×14. Wedge body, two spread wing fans, hooked beak. Ink and iron `0 1 2` with a
  ragged trailing edge. The whole row adds the blue-black gloss.
- **Frames (10):**

  | # | frames |
  |---|---|
  | 0 | frozen mid-flap |
  | 1-2 | perch ×2 |
  | 3 | head to camera |
  | 4 | talk (beak open) |
  | 5-6 | peck ×2 (mark 42) |
  | 7-9 | takeoff and flight ×3 (whole only, handed to the `fx.bird` pool at 38 s) |
  | 10-11 | tip try, ruffle (WP24, below) |
  | 12-14 | perched, wings folded: head turned back (`perchTurn`), head to camera (`perchHead`), talk (`perchTalk`) (WP27, below) |

- **Placement:** 56 art px above the lamp foot. It never travels before the finale. The stutter is a code offset of
  4 world px.
- **Readability:** 14 px at zoom .5, at the floor. The sky behind it is the lightest value on screen, so the ink
  wings read.

**WP24 (2026-10-26): the crow's new cells** (frames 10–11; sheet 288 × 108, 12 frames per row).
- 10 `frozenTip`: frozen with the near wing tip lifted 2 px. Used by the tip try (eras I–II). The III-to-whole cells carry frozen's layers.
- 11 `ruffle`: perch0 puffed and damp, crown and breast 1 px out, one wet point under the breast (the falling drop is code). Used by the era III ruffle round.
- The cycle 2+ hold (`fly2`, frozen mid-flight) reuses existing frames.

**WP27 (2026-10-27): the crow's perched frames** (frames 12–14; sheet 360 × 108, 15 frames per row). Eras I–II rest on these and
on perch0 / perch1 / peck / ruffle: wings folded, the spread-wing frames only in the tip-try glitch (at most 1.8 s).
- 12 `perchTurn`: perch0 with the head turned back over the shoulder, beak pointing left over the back (perch0's beak mirrored about
  the head axis, eye (13, 3) from row III). Rows 6–17 are perch0. Used by the look clip (perchTurn ↔ perch0).
- 13 `perchHead`: the perch0 body with the camera-facing head of `head` (iron 2 brows, eyes from row III, a 1 px beak stroke).
  The crow's front and glance pose in eras I–II.
- 14 `perchTalk`: perchHead with the lower mandible 1 px longer and, from row III, the open-beak mouth pixel. The crow's talk
  pose in eras I–II.

### 2.4 The Girl with the Lantern `world.girl`, `world.girlMini`, `world.girlWindow`

- **Size:**
  - ground: frame 16×28, body 12×24. A pointed hood triangle, yellow raincoat `#d9822b`/`#f0a848` (accent is
    allowed: she is the one saturated figure), boots `a`, and a lantern 3×4 with a 1 px glow dot. The face is always
    a 2-tone smudge.
  - `world.girlMini`: 8×12 frame, 5×10 body, 2 frames (lantern warm / cold white `#ddc9a3`). Pylon plane foot at
    `WORLD_FAR_PLANES.girlMini` footArtX 146, footArtY 157 (AD2 F1: 12 art px left of the pylon's left leg), i.e. the
    feet strip point (868, 1160); game x ≈ 164 / 85 / 171 at e1 / s8 / s9, clear of the motor and the Inspector.
  - `world.girlWindow`: 4×6, 4 frames: flicker a, flicker b, dark, restored with a 2×4 figure at the curtain.
- **Frames (10):** stand facing ×2 (sway), palm out 1, talk 1, shield (lantern raised) 1, back-run ×4 (finale),
  lantern-dropped 1. The lantern on the ground is `world.lantern` (6×4, 2 frames: lit / fallen).
- **Window:**
  - It is the 4×6 window at skyline art (306, 106) of one tile instance: the tile whose repeat is nearest screen
    x 0.30 × VIEW at the era I default framing.
  - It is placed once (not tiled) on the far window plane. The Engineering Manager computes the parallax x once with
    `parallaxStrip` + `patternShift` and stores it in `src/data/livingWorld.ts`.
  - Alpha .85, so it reads as the one lit point against the skyline layer's .4.
- **Tone check: approved with conditions.**
  - Her body never exceeds 12×24.
  - She never moves on screen.
  - She is never nearer than 900 world px to the crank hub, and never in the screen center third.
  - Her face is never more than a smudge.
  - The "approach" in era V moves her feet down the foreground band (+8 world px per step, 5 steps), not toward the
    machine.
  - In the finale she runs away from the camera.

**WP24 (2026-10-26): the girl's new cells and the mini palm.** Ground: frames 10–11, sheet 192 × 168, 12 frames per row. Mini: frame 2, sheet 24 × 12, 3 frames in one row.
- 10 `lanternUp`: faces the camera, hood and face smudge as stand0. The lantern is held forward at chest height, below the shoulder, with the arm bent. It is never raised: the raised lantern is the finale `shield` (frame 4), and the two must read as different poses. Body 11 × 24.
- 11 `tilt`: stand0 with the hood tipped to one side. Lantern, hand, coat and boots stay as stand0, so the era IV beat moves only the head. Body 12 × 24.
- Both new ground frames face the camera and sit in `WORLD_STARE_SAFE`.
- girlMini frame 2 `palm`: the cold lantern with the free hand raised beside the hood, palm up (6 × 11 in the 8 × 12 cell). Used by the mini palm on a vent puff (era III).
- The mini flicker needs no cell: it is the cold frame (1) with a per-frame alpha of 1 and 0.8. The warm frame (0) is never shown in eras II–III.

### 2.5 The Payphone booth and street corner `world.payphone`, `world.receiver`, `world.lamp`, `world.clock`

- **Booth:**
  - frame 28×52, body 24×48. Peaked hood, 16×24 glass pane, iron `2 3 4` with rust patches.
  - Frames: dark, lit (hood light), ring-shake ×2, fog overlay, cracked restored-whole.
  - The tally marks are procedural, drawn into the pane at load (`WORLD_MARKS`, AD2 F3): pane (6, 13) 16×24 art px;
    a group = 4 vertical strokes 1×4 at pitch 2 plus the fifth as a 3 px slash in the gaps ((1, 3), (3, 2), (5, 1)),
    so it reads as a tally, not a window grid; groups in 2 columns (pitch 9) × 5 rows (row gap 1), capacity 50.
    Color `#a8957a`, `#ddc9a3` in the fog frame. Count 40 + cycle, 41 + cycle from the postgame on.
- **Receiver `world.receiver`:** 8×12, 6 frames: hang, swing ×3, level (era V, pointed at the camera), on hook. It
  is a separate sprite on the cord pivot. The bubble anchors here.
- **Lamp `world.lamp`:** frame 12×60, body 8×56, 4 frames: dead, lit, warm, restored. Plus `world.lampGlow` 32×16
  with 2 hard-stepped ellipses (outer `#ad6236`, inner `#c98552`, opaque in the PNG), shown in II-IV and the
  postgame. Runtime alpha `WORLD_ENV.lampGlow` .4, + .2 (`bumpAlpha`) for `rippleMs` on a lamp ripple or flicker,
  times the mains flicker (AD2 F4: the old .8 read as a solid orange plate).
- **Clock `world.clock`:** frame 16×44, 2 frames (ruin, restored). The hands are a 1 px Graphics overlay.

### 2.6 Sensor 7 `world.sensor7`

- **Size:** frame 20×40, body 16×36. A-frame tripod, box head, one round lens, stenciled `7`, a 5×7 readout window.
- **Frames:**
  - tripod 1;
  - head left, center, right, up (sky) 4, as a separate sprite on the head pivot;
  - lens fog overlay 1;
  - readout glyphs `–` and `1` (5×7);
  - LED 1×1. It is a separate 1-px sprite so the color can swap without new frames: `#ad6236`, `#f0a848`, then
    `PALETTE.green2` in the whole state only.
- **Head tracking:** the head picks L/C/R from the camera center x relative to the sensor (±200 world). It is
  "looking at you" by pointing at the frame center. headL / headR are 3/4 heads (AD2c): the side panel shows and the
  lens glass still faces the viewer, flush with the turn-side edge, no barrel past the box. A flank lens with a barrel
  read as aiming at the machine, which sits right of the sensor in e1 / s9 (bible §3.6: it watches the camera, so it
  reports nothing about the machine).

---

## 3. Placement per framing (feet x in world px; reader 2 view and machine rects)

**Rule:** usable wing = [view edge + 24, machine edge − 24]. Positions are data per framing key in `livingWorld.ts`.
A denizen that does not fit is off-stage for that framing and its lines wait. Moves happen only while the TECH INDEX
is open or off-screen.

| framing | view x | machine x | Sensor 7 | Inspector (rest / route) | girl | dog (front) | clock | booth | lamp + crow |
|---|---|---|---|---|---|---|---|---|---|
| s0-s7 (era I; cycle 2+) | 1280-2560 | 1720 / 1576 → 2120 / 2316 | 1384 | 1472 / 1448-1496 | window (sf .3) | 2364 | 2516 | 2420 | 2476 |
| s8 (era II, generator: CROSSED LINES) | 1424-2704 | 1576-2552 | 1470 (WP27) | 1536 / none, one spot (WP27) | pylon foot (sf .55; feet strip 868, 1160 = game x ≈ 85, between the tripod and the Inspector); cycle 3+ ground 1504 (WP27; ART_AUDIT WP27 ADa and AD2 F7: 1504 clears the in-place crouch) | 2604 | 2680 (WP27) | 2604 | 2656 |
| s8w (era II, capacitorBank or sparkGap before transformer; cx 2104-2112, WP27) | 1464-2752 | 1576-2632 / 2648 | 1500 | 1552 / none, one spot | pylon foot (game x ≈ 63 / 58; the mini cell touches the Inspector's clipboard by 0.4 px at cx 2112, drawn px 1.6 px clear); cycle 3+: none (no 24 px slot, ART_AUDIT WP27) | 2694 | off (exempt: right wing holds booth, lamp, crow) | 2678 | 2720 |
| s9 (era II full) | 1339-3045 | 1576-2808 | 1384 | 1472 / ± 24 | pylon foot (game x ≈ 171) | 2856 | 2900 | 2944 | 2996 |
| s10 (era III entry: PAY-06) | 1202-2908 | 1302-2808 | off | 1252 / none | pylon (nearer) | 2858 | off | 2858 | off |
| s11-s14 (III-IV, V start) | 642-3202 | 1036-2808 | 712 | 784 / 760-808 | III pylon; IV back row 880 | 2856 | 2890 | 3050 | 3104 |
| s15 (era V full) | 640-3200 | 848-2992 (anchors 848-912, 2928-2992) | 712 | 784 / 760-808 | inner left gap 976, front row, y + 8 per step | 2856 | 2890 | 3050 | 3104 |
| finale full / choice / postgame | 640-3200 | as s15 | 712 | 784 | window (restored) | postgame: **left wing 732 front** | 2890 | 3050 | 3104 |
| finale baseL (zoom 1) | 680-1960 | — | 712 | 784 | lantern in the grass 990 | — | — | — | — |
| finale baseR (zoom 1) | 1880-3160 | — | — | — | — | 2856 | 2890 | 3050 | 3104 |

**Props** (back row unless noted):

| prop | era | x (world) |
|---|---|---|
| stake + chain | all | dog x − 16 |
| hole (front row) | II on | dog x + 30 (e1 2394, s8 2634, s9 2886) |
| scraps ×3 | I-II | 1330 / 1420 / 1530 |
| scraps ×3 | III | 690 / 830 / 960 |
| puddles | III on | 930-990 (3 sizes) |
| sprout | III on | 996 |
| red ball (front row) | cycle 2+ | dog x + 14 |
| Chladni rings | IV on | around the machine base, procedural |

Fixes against the bible's §3.0 table (all re-checked with the rule above):
1. **Era I right corner.** It was dog 2364, clock 2420, booth 2470, lamp 2540, which puts the lamp and crow at
   2520-2560 against the view edge (2560). Repacked to booth 2420, lamp 2476, clock 2516.
2. **s8.** The bible's corner sits at x ≥ 2852, off-screen. But PAY-01 rings at `buy generator`, at this framing.
   The booth and lamp move to 2604 / 2656, which fits the usable 2576-2680. The clock is off-stage.
3. **s9.** The bible's lamp at 3030 and crow to 3050 cross the view edge at 3045. Packed into 2832-3021.
4. **s10.** Only 52 px is usable on each wing. The booth must be visible for PAY-06 ("Someone moved me."), so it
   stands at 2858. It moves to 3050 at s11, unseen, which literally repeats its line's joke.
5. **Era V clock.** The bible's 2990 sits inside the right anchor (2928-2992). It goes to 2890, in the inner right
   gap under the guy cable. The booth and lamp keep the same x from era III through the postgame, so nothing moves
   when the anchors land.
6. **Postgame dog.**
   - Buttons at UI 100 cover world x 2112-3168 below screen y 666. The right-wing front row (feet 672-684) is hidden.
     At UI 150 the buttons start at y 639 and cover even the back row's feet.
   - The dog's loop (sleep, pat, red ball) moves to the left wing at 732 (front row), between Sensor 7 and the
     Inspector, who pats it there.
   - PAY-12's bubble anchors above the booth hood (y 612 at zoom .5), which stays visible.
7. **Girl, era IV.** The bible's ≈ 620 is outside every zoom-.5 view (left edge 642), so GRL-10 would never show. Set
   to 880 in the back row. She relocates to the inner gap when the left anchor lands (the anchor is bought in the TECH
   INDEX, so the move is unseen).

---

## 4. Speech bubble and the turn to camera

### 4.1 Look (DOM, screen space, anchored to a world point)

| property | value (CSS px at UI 100; `#ui-root` zoom does the rest) |
|---|---|
| element | one pooled `div#world-voice` (plus `#world-voice-2` for unison) in `#ui-root`, class `wv`, `aria-hidden="true"` |
| fill / text | paper `#ddc9a3` / ink `#14110f` (11.6:1) |
| border | 2 px ink drawn with 4 offset box-shadows, so the corners are notched 2×2 (pixel bubble, no border-radius) |
| tail | stepped, 12 wide × 8 tall: ink rim, paper core, merged into the border band; tip x = the speaker's head x, clamped to [10, w − 10] |
| font | `14px/18px` HUD monospace stack, sentence case, no letter-spacing (the machine is uppercase and spaced) |
| padding | 5 px 8 px |
| max width | 200 px → 250 at UI 125, 300 at UI 150. 52-character lines wrap to 2-3 lines. |
| size at 720p | 2 lines: 200×50 (UI 100), 250×62 (UI 125), 300×75 (UI 150), plus an 8 px tail |
| z-index | 70: above the HUD panel, below the era card (80), TECH INDEX (100), photo chip, title, menus, finale, toasts |
| motion | opacity 0 → 1 in 150 ms with `steps(3)` (pixel fade); none under reduced motion. Only `transform` and `opacity` are written per frame. |
| hidden | photo mode by the existing rule (never `is-open`); `#ui-root.finale-active .wv{display:none}`; World SLEEP/WAKE; tab hidden |
| a11y | one visually hidden polite live region elsewhere gets `Inspector: <line>`; the bubble itself is aria-hidden, so it is never read twice and never focusable |

CSS as shipped (src/ui/worldVoice.css, with the live region and the HUD font stack) is about 1.0 KB minified (1000 B limit; the bible's 0.9 KB is relaxed to 1.0 KB; demo css about 43.8 of 45 KB):
```css
.wv{position:absolute;left:0;top:0;z-index:70;max-width:200px;padding:5px 8px;background:#ddc9a3;color:#14110f;
 font:14px/18px ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;pointer-events:none;opacity:0;
 box-shadow:0 -2px #14110f,0 2px #14110f,-2px 0 #14110f,2px 0 #14110f;transition:opacity .15s steps(3)}
.wv.on{opacity:1}
.wv::after{content:"";position:absolute;top:100%;left:calc(var(--tx) - 6px);width:12px;height:8px;background:#14110f;
 clip-path:polygon(0 0,100% 0,100% 4px,10px 4px,10px 6px,8px 6px,8px 8px,4px 8px,4px 6px,2px 6px,2px 4px,0 4px)}
.wv::before{content:"";position:absolute;z-index:1;top:100%;left:calc(var(--tx) - 4px);width:8px;height:4px;
 background:#ddc9a3;clip-path:polygon(0 0,100% 0,100% 2px,6px 2px,6px 4px,2px 4px,2px 2px,0 2px)}
.wv.up::after,.wv.up::before{top:auto;bottom:100%;transform:scaleY(-1)}
#ui-root[data-reduced-motion="on"] .wv{transition:none}
@media (prefers-reduced-motion:reduce){.wv{transition:none}}
#ui-root.finale-active .wv{display:none}
```

### 4.2 Placement and camera behavior

- **Anchor:** the speaker's head top in world px (the receiver for the booth, the window for GRL-01).
  - Client point = `worldToClient`, then `(client − cachedCanvasRect.left) / uiZoom`.
  - The canvas rect is cached on resize. The bubble is written with `transform: translate(...)` only.
- **Ladder** (bible §7.5) on the safe rect = viewport inset 8 px, minus the HUD panel, toast stack, button row,
  `#hud-hint`, era card, finale column, SKIP and the crank prompt rects, the other chain bubble, and the head of every
  other visible ground denizen (`WORLD_LAYOUT.headReserve`: pad 36 world px for the Inspector, 12 for the rest, a 24
  game px box from 4 above the head; AD2b F16 / F2, so a bubble never hides another face):
  1. Above the head, tail down, gap 6 px. The box is clamped horizontally and the tail slides.
  2. If that hits a reserved rect: below the feet in the foreground band, class `up`, tail up.
  3. If the clamp leaves the head outside [x0 + 10, x1 − 10]: to the side, outward wing first.
  4. Otherwise the line waits up to 10 s, then counts as blocked.
- **Checked numbers** (logical px, 2-line bubble at UI 150 = 89 px including tail and gap):

  | framing | above-head top | reserved edge | result |
  |---|---|---|---|
  | era I s0-s7 | 365 | panel bottom 235-298 | above-head clear |
  | era II s9, Inspector | 353 | panel bottom 364, x 24-443 | collides → below feet, 498-587; buttons start at x 712, clear |
  | era III s11 | 425 (proof B150) | panel 401 | clear |
  | era IV s13 | 438 | panel 467 | collides → below feet, 566-655; buttons start at x 698, clear |
  | era V s15 | 512 | panel 504 | clear by 8 px |
  | postgame booth, PAY-12 | — | — | above the hood at x ≈ 1204; toasts end at y 260, clear |

  The right wing at s9/s11 (bubble 331-512) is clear of the toasts (≤ 260) and the hint/buttons (≥ 600).
- **Off-screen speaker:** a line does not start unless the head point is inside the view inset 16 px and a ladder
  step fits. There is no edge arrow and no off-screen pointer: the world must be seen to speak.
- **Camera moves while the bubble is up:**
  - The bubble follows every frame. Its size never changes with camera zoom, only with UI scale.
  - If the head leaves the inset view, the bubble fades out in 150 ms and the bible's 60 % rule decides "seen".
  - The ladder is re-evaluated at most every 250 ms, with hysteresis, so a pan does not flip it back and forth.
- **Overlap with machine art** is allowed (it is a DOM layer). Overlap with the crank hit circle + 24, the crank
  prompt, or the gain-text spawn rect (crank + (116, −128), 200×120) is not. The proof's era III bubble at UI 150
  overlaps the compressor, which is accepted.

### 4.3 The turn-to-camera beat (code on the speaker sprite; timings in bible §7.1)

| t | sprite | bubble |
|---|---|---|
| 0 | the current loop holds its frame; 1 frame of tracking line (rows 18-22 shifted 2 art px; off under reduced motion) | — |
| +1 frame | snap to **front**, no in-between | — |
| +300 ms | talk: alternate front / talk at 8 fps for min(words, 8) blips, then hold front. Rows I-II bob only; mouth pixel from row III. | fade in 150 ms |
| +300 + D (D = 2600 + 55 × chars, 3500-6500 ms) | hold front | fade out 150 ms |
| + 600 ms | snap back to profile; the loop resumes on its held frame | — |

**Variants:**
- **Glance:** the **glance** frame (head only, body stays in profile) for 1.5 s, with the tracking line. No bubble,
  no blip.
- **Stare** (ONE OBSERVER through era V): at rest the sprite uses **front**; profile only while walking.
- **Unison** (SYNCHRONIZATION): both speakers snap on the same downbeat frame. Two bubbles, one per wing, never
  stacked.
- **Per-denizen "front":**

  | denizen | front |
  |---|---|
  | dog | the head-to-camera frame |
  | crow | the head frame |
  | booth | the receiver swings to its level frame |
  | Sensor 7 | head C + LED double-blink (it never speaks) |
  | girl | always front already: her beat is the sway freezing for 300 ms |

- **Era V:** locomotion plays backwards; the snap is the same.
- **LAST LOOK** (59.83 s): every on-screen denizen snaps to front on the same frame, with no tracking line (film
  frames stay clean).

---

## 5. Environment arc: layer changes and assets

The canon layers stay (pylonsLit, steam and smoke, rising dust, violet sky, eclipse, glow, beam, restoration). Every
addition below is small, local and on the wings (the far-plane windows sit behind the machine top, on the skyline).
No new full-screen background is needed. The finale wipe stays the only large change. Q6 gate (WP23.md): every era
entry adds one background-scale change a player notices at the default camera at 1920×1080; for I → II that is the
six windows coming up at `generator` (AD2c proof pairs).

| era | sky / far planes | ground and props | light | weather / life |
|---|---|---|---|---|
| I | `world.girlWindow` flicker on the far window plane (1.5-4 s irregular; one frame per crank click before `wornMotor`) | booth dark (41 marks faint), lamp dead, clock stopped, stake + cut chain, 3 scraps, Sensor 7 | none | canon dust; the crow perched, wings folded (tip-try glitch of at most 1.8 s); the dog sitting |
| II | at `generator` the girl's window goes dark (frame 2) and **6 × `bg.windowLit`** come up dim (`WORLD_ENV.windowDimLevel` .85, fade `windowGlow.fadeMs`; the Q6 era II entry change, AD2c); at `powerLines` they go full (1, + mains flicker) | booth lit hood, receiver swing; hole stage 1 at `load-beneath` | `world.lampGlow` on at `powerLines`; mains flicker ±.08 alpha (code) | 4-5 `world.mote` ash motes orbit the lamp (1 emitter); the crow perched, wings folded (tip-try glitch of at most 1.8 s) |
| III | **`bg.virga`** on an sf 0.15 strip above the mountain ridge at lifetime PR ≥ 1M: rain streaks that stop 6 art px above the ridge | `world.puddle` 1-3 at `condenser` MK I/III/V (reflect `#b8a98f`/`#d2bf9c` cloud, never blue); `world.sprout` white stages 1-2; booth fog overlay at vents (marks sharp); scraps burn away with firebox tiers | lamp warm frame | Inspector umbrella, girl hood and palm at vents; damp crow perched |
| IV | windows breathe on the downbeat (alpha .85 ↔ 1; static under reduced motion); `bg.virga` frame 2 (frozen) | Chladni rings (procedural Graphics around the machine base, `#c9b28a` 1 px dashes, intensity 1/2 from `standingWave` MK I/III (AD4 F7, Q6 scale-up; alpha 1)); puddles ring on downbeats (1-px ring frames 2); `world.page` lifts every ≈ 40 s | lamp pulses on the downbeat | motes freeze mid-orbit; the crow hovers 2 px |
| V | windows off by stage 6 → 4 → 2 → 1 → 0 (nullChamber, lensArray, horizonField ≥ 5, skyAperture); virga fades out | puddles black frame (reflect nothing); sprout stages 3-4 (tall, white, bent toward the beam); Chladni lines tinted `violetLight`; hole stays | lamp dead at the skyAperture diamond; no shadows from horizonField ≥ 5; violet rim rows | motes fall into the dead lamp; double exposure (code: one frame, violet tint, 15 % alpha) |
| finale | girl window → restored frame at 59.83 s | each prop turns whole when `wipeHalfWidthPx` reaches its x: sprout bloom, puddles show the restored sky, chain falls, receiver hangs itself up, clock second hand sweeps; **the marks stay** | `world.lampGlow` warm | the crow leads the 38 s flock |
| postgame | restored | `world.lantern` fallen at 990; red ball; the minute hand never turns | warm, constant | `world.mote` white moth frames at the lamp |

### 5.1 New asset list (proposed ids; files under `public/assets/`)

| id | file | frame (art px) | frames | layer / depth | notes |
|---|---|---|---|---|---|
| `world.inspector` | `world/inspector.png` | 20×40 | 19 × 6 rows | back row | proved |
| `world.clipboardPages` | `world/clipboard-pages.png` | 6×3 | 3 | back row +0.1 | cycle trace |
| `world.dog` | `world/dog.png` | 28×20 | 20 × 6 rows | front row | |
| `world.stakeChain` | `world/stake-chain.png` | 10×6 | 2 | front row | |
| `world.hole` | `world/hole.png` | 16×6 | 4 | front row −0.1 | |
| `world.redBall` | `world/red-ball.png` | 3×3 | 1 | front row | |
| `world.crow` | `world/crow.png` | 24×18 | 10 × 6 rows | back row +0.2 | |
| `world.girl` | `world/girl.png` | 16×28 | 10 × 6 rows | back / front row | |
| `world.girlMini` | `world/girl-mini.png` | 8×12 | 2 | pylon plane | |
| `world.girlWindow` | `world/girl-window.png` | 4×6 | 4 | far window plane | |
| `world.lantern` | `world/lantern.png` | 6×4 | 2 | back row | |
| `world.payphone` | `world/payphone.png` | 28×52 | 6 × 6 rows | back row | marks are procedural |
| `world.receiver` | `world/receiver.png` | 8×12 | 6 × 6 rows | back row +0.1 | |
| `world.lamp` | `world/street-lamp.png` | 12×60 | 4 | back row | |
| `world.lampGlow` | `world/lamp-glow.png` | 32×16 | 2 (cold, warm) | back row +0.05 | |
| `world.clock` | `world/street-clock.png` | 16×44 | 2 | back row | hands procedural |
| `world.sensor7` | `world/sensor7.png` | 20×40 | tripod 1 + head 4 + fog 1 + glyphs 2, × 6 rows | back row | LED is a 1-px sprite |
| `world.puddle` | `world/puddles.png` | 32×5 | 3 sizes × 3 (grey, ring, black) + whole | back row −0.2 | |
| `world.sprout` | `world/sprout.png` | 8×24 | 5 (4 white, 1 green bloom) | back row | |
| `world.scraps` | `world/scraps.png` | 8×4 | 3 | back row −0.2 | |
| `world.mote` | `world/mote.png` | 2×2 | 2 (ash, moth) | dust depth | 1 emitter, pool 5 |
| `world.page` | `world/page.png` | 3×4 | 2 | dust depth | |
| `world.shadow` | procedural | 14×3 / 18×3 / 26×3 | — | row −0.01 | Graphics ellipse, baked once |
| `bg.windowLit` | `bg/window-lit.png` | 4×6 | 2 (lit, breathe) | far window plane | 6 placements on real skyline cut-outs (`WORLD_FAR_PLANES.windows`, AD2c): (306, 120) 4×6, (306, 132) 4×6, (318, 146) 4×6 on the tall tower right of centre; (143, 71) 2×4, (131, 99) 4×4, (134, 109) 1×3 in the upper floors of the big central tower. All six show in the generator pose (s8) and in s9, above the machine top, clear of the HUD and of the pylon plane; the frame is cropped from its top-left to each cut-out. Halo `windowGlow` pad 3 art px, alpha .65, `#d9822b`: halos touch, never overlap |
| `bg.virga` | `bg/virga.png` | 512×64 | 2 (falling, frozen) | sf 0.15, depth −89.5 | tileable on x, sky ramp only |
| — | procedural | — | — | DEPTH.ground + 3 | Chladni rings (Graphics), tally marks (canvas into the pane), tracking line (row shift at load) |

---

## 6. Production plan

### 6.1 Method per asset (PixelLab plus hand work)

| asset | concept / reference tool | final |
|---|---|---|
| Inspector | `create_character_pro_flash` side view, 24×36, palette-locked, 2 seeds (done, 12 gens): proportions only | hand-pixel master (done, §7) |
| Girl | `create_character_pro_flash` side view, 16×28 custom, 2 seeds (12 gens) | hand-pixel (12 px wide: AI output is reference only) |
| Dog | `create_character_pro_flash` with `template_id` dog, side, 28×20 (6 gens) + `create_image_pro` 28×20 (64 candidates, 10 gens) | hand-pixel |
| Crow | `create_image_pro` 24×18 (64 candidates, 10 gens) | hand-pixel |
| Booth | `create_object_pro_flash` 28×52, 1 direction (5 gens) + `create_image_pro` 28×52 (25 candidates, ~15 gens) | concept + hand fix; receiver hand-pixel |
| Sensor 7, lamp, clock | `create_image_pro` 20×40, 12×60, 16×44 (10 gens each) | hand fix |
| Props (hole, puddles, sprout, scraps, lantern, ball, motes, page, stake) | `create_image_pro` 32×32 sheets (4 calls, 40 gens) | hand-pixel |
| Walk / dig / back-run cycles | `animate_character` v3, 1 direction, 4-8 frames as **timing reference** only (~10 gens) | hand-pixel |
| Virga, windows, glow | none | pixel ops (`pixelart_workbench` draw / edit) |
| Era rows | none | `eraRecolor` script (Appendix A), deterministic |

**Not used for finals:**
- `animate_object` and `edit_image` on ≤ 24 px sprites: they smear 1-px features (eyes, ear, beak).
- `create_character` standard mode: chibi proportions. The proof's 64 `create_image_pro` candidates were all
  big-headed.

### 6.2 Budget

| item | value |
|---|---|
| Generations | about 150 planned + 50 % retries ≈ **225** |
| Balance | 3,774 left after the proof (spent 22), reset 2026-11-10 |
| Palette lock | `palette` = the 25 Rust Wasteland hex values, `palette_name` "Rust Wasteland", on every call. The style anchor URL in `ART_BRIEF.md` has expired ("Result not found"). Use `style_image` base64 of `public/assets/machine/flywheel.png` for outline and shading only. |

### 6.3 Review steps (each asset; Art Director gate)

1. Concept candidates → AD picks one, for proportion and silhouette.
2. Hand-pixel the color master and its prop layers.
3. Run `pixelart_workbench` `score` (≥ 90), `lint` (0 errors and 0 warnings; `pillow` info accepted),
   `silhouette` (1 component) and `storyboard` (loops: no pops, a fixed pivot).
4. `eraRecolor` bakes the 6 rows. A test checks that every pixel is on the palette and alpha is 0/255.
5. In game, 1:1 and 3× crops at zoom 1 / .75 / .5 at 720p and 1080p, eras I, III and V. Compare with the proof.
6. AD sign-off per wave, then a store-shot re-approval.

### 6.4 Files, ids, ASSET_GUIDE

- **Category `world`** joins `bg`, `terrain`, `fx`, `machine`, `ui`. `ASSET_GUIDE.md`:
  - add a "World — Living world" table with one row per id;
  - add `world` to the category list;
  - one paragraph on era-row sheets.

  `assetGuide.test.ts` enforces one row per manifest id.
- **Manifest:**
  - era-row sheets need a new optional field `eraRows: 6`, with frame w/h as today;
  - frame names are listed in data (`livingWorld.ts`), never by magic index in render code.
- **Fallbacks:** each id gets a procedural painter that fills an ink silhouette of the right size (rect body + head
  disc / box / tripod), so a missing PNG still stages the scene.
- **Sources:** masters and prop layers as PNG + the recolor script under `tools/art/livingWorld/` (proposal). They are
  not shipped.

**WP24 (2026-10-26): sheet widths after the layout extension (AD1a).** New frames sit at the end of each sheet, so no existing index moves. Sizes were checked against the PNG headers. The manifest carries the width and `frame.count`; its descriptions keep the old counts (WP24 D8).

| sheet | file | size (px) | before (px, frames) | frame (art px) | per row | rows | frames |
|---|---|---|---|---|---|---|---|
| inspector | `world/inspector.png` | 440 × 240 | 380 × 240, 19 | 20 × 40 | 22 | 6 | 132 |
| dog | `world/dog.png` | 644 × 120 | 560 × 120, 20 | 28 × 20 | 23 | 6 | 138 |
| crow | `world/crow.png` | 288 × 108 | 240 × 108, 10 | 24 × 18 | 12 | 6 | 72 |
| girl | `world/girl.png` | 192 × 168 | 160 × 168, 10 | 16 × 28 | 12 | 6 | 72 |
| girlMini | `world/girl-mini.png` | 24 × 12 | 16 × 12, 2 | 8 × 12 | 3 | 1 | 3 |

girlMini is one row (no era rows).

### 6.5 Texture and display-object budget

- **Textures (RGBA decoded):**

  | sheet | size |
  |---|---|
  | Inspector | 380×240 = 356 KiB |
  | dog | 560×120 = 263 KiB |
  | booth + receiver | 168×312 + 48×72 = 218 KiB |
  | crow | 240×108 = 101 KiB |
  | girl + mini + window | 160×168 + small = 110 KiB |
  | Sensor 7 | 160×240 = 150 KiB |
  | lamp, clock, glow | 40 KiB |
  | props | ≈ 60 KiB |
  | virga | 512×128 = 256 KiB |
  | **total** | **≈ 1.55 MiB** (current total 36.8 MiB) |

  PNG on disk is about 60 KB (budget 8 MB, used 1.49).
- **Display objects:**
  - In use: 6 denizens + Sensor 7 head and LED and readout + receiver + window overlay + mini (1 sprite whose plane
    changes) + 6 shadows + lamp glow + clock hands + about 12 props + 6 windows + virga + Chladni + 2 emitters
    ≈ **44**.
  - Grouped in 2 row containers plus the far-plane sprites, the top-level count rises by ≈ **14**: peak 76 → about
    90 of 500.
  - Everything is created once and hidden, never destroyed, on a new cycle.

### 6.6 Waves (matching the bible)

| wave | scope |
|---|---|
| A (demo) | Inspector, dog, crow, girl (window, mini, ground stand), booth + receiver, lamp, clock, Sensor 7, rows I-II, stake, hole, scraps, motes, windows, bubble CSS. ≈ 60 % of the art. |
| B | rows III-V, umbrella frames, puddles, sprout, virga, page, Chladni, violet rim, girl era V. |
| C | whole rows, shield, run and chase frames, lantern, red ball, restored window, finale hand-offs. |

---

## 7. Proof (Inspector, two era states, turn frames, bubble over real store shots)

Folder: `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22-23/proof-denizens/`

| file | shows |
|---|---|
| `contact-inspector.png` | contact sheet: era ladder I-whole, frame set at 6×, readability at 1 / 1.5 / 2 / 3×, turn-to-camera storyboard, 1:1 in-game crops |
| `composite-era1-ins01-1080.png` (+ `-ui150`) | era I, s7 zoom 1, sepia ghost (alpha .75), talk frame, INS-01, over `store-final3/1080/02-era1-full-hud.png` |
| `composite-era3-ins08-1080.png` (+ `-ui150`) | era III, s11 zoom .5, umbrella open, eyes, hi-vis back, INS-08, over `04-era3-boiler-hud.png`; the tail slides when the box clamps to the left edge |
| `composite-era5-ins12-1080.png` | era V, s15 zoom .5, violet rim, no shadow, INS-12, over `07-era5-ruined-hud.png` |
| `inspector-era1..6-sheet.png` | 8 proof frames per era row (side, glance, front, talk, side umbrella, umbrella open, front umbrella, talk umbrella) |
| `tools/insp3.py`, `tools/build.py`, `tools/contact.py`, `tools/pal.py` | the master (ASCII), recolor, bubble renderer, compositor |
| `work/ref-pixellab-ae62a404-*.png`, `work/pro64/grid64.png` | PixelLab references: pro-flash character `ae62a404` (picked for proportions) and 64 `create_image_pro` candidates (rejected: chibi) |

**Verdict:**
- The master scores 97.0 with `lint` 0 errors and 0 warnings (info: deliberate ink ring, 6 single-pixel glints,
  1 silhouette component).
- It reads as a person with a hat and a clipboard at 33 logical px (zoom .5, 720p).
- The paper bubble separates from the beige sky through its ink rim, and from the violet sky through the paper.
- **Proof limits:**
  - The composites are pasted onto stills, so the in-engine `roundPixels` placement and the live HUD rects still need
    the Wave A screenshot check.
  - The bubble is drawn with PIL, not the DOM, so the final CSS must be checked in-game for the tail join.

---

## 8. Sign-offs and conditions

### 8.1 GAME_SPEC §18.2 draft (people in the restored world): approved with conditions

1. Figures in the restored windows are ≤ 2×4 art px silhouettes with no faces.
2. The Inspector's and the girl's whole rows use the Rust Wasteland palette only. No restored greens or blues on
   people.
3. Faces never get more than 2 eye pixels and 1 mouth pixel. The girl's face stays a smudge in every row.
4. No denizen overlaps any machine part in any framing (checked in §3), and none is ever drawn at the screen center
   third.

### 8.2 House art rules for review (add to the AD audit checklist)

- one pixel grid;
- palette-only era rows;
- no denizen faces the machine;
- the tail always points at the head;
- the bubble never covers the crank, the prompt or the gain text;
- no "un-happening" frame before the finale: holes never refill, puddles never dry, the sprout never shrinks.

---

## 9. References (rules taken)

- [Bugnet: how to make pixel art that reads clearly](https://bugnet.io/blog/how-to-make-pixel-art-that-reads-clearly):
  - the silhouette must work before detail;
  - test at 1× game scale;
  - keep the strongest contrast for what matters.

  Used in §1.3.
- [Wayline, Pixel Art for Games lesson 5](https://www.wayline.io/learn/pixel-art/4): about 5-6 colors per small
  sprite, each with a job. The Inspector master uses 15 colors over 6 materials, about 2-3 per material.
- [PixelJoint critique thread](https://pixeljoint.com/forum/printer_friendly_posts.asp?TID=26448): use outlines
  only where readability needs them. Here it needs them: a full ring, §1.3.2.
- [AGS SpeechBubble module](https://new-site.adventuregamestudio.co.uk/forums/modules-plugins-tools/module-speechbubble-v0-8-0/100):
  it clamps the bubble x into the viewport. This spec adds the sliding tail and the side fallback, §4.2.
- [OpenGameArt pixel speech bubbles (CC0)](https://opengameart.org/content/pixel-speech-bubbles): notched-corner
  pixel frames with a stepped tail. That is the look of §4.1, built in CSS instead of tiles.

---

## 10. Open risks

1. **Small sizes at zoom .5.** The dog (16 px) and the crow (14 px) sit at the floor on a 720p window. If Wave A
   playtests say "can't see the dog", the fallback is the front row plus a 2 px rim of `#ddc9a3` on the dog only.
   There is no scale change.
2. **CSS headroom.** The demo is at 42.8 / 44 KB and this adds ≈ 1.0 KB. Raise `cssKb` to 45 at the start of WP
   (bible Appendix D).
3. **Changes to the finale film.** Adding denizens means new finale frame baselines and store-shot re-approval.
   - The baseR hold must show the booth whole. Today it fits at x 3026-3074 inside 1880-3160.
   - Do not move the survey keys.
4. **The era I to II difference is subtle on the figures** (alpha and faded stripes). By design the props carry era
   II (lamp, booth light, windows). If testers miss it, give row II the skin back early.
5. **The bubble crosses machine art** at UI 150 on the narrow left wings (era III proof). This is allowed by the
   rule, but it needs an AD look in every era at UI 150.
6. **Hand-pixel time.** About 76 character frames and 30 prop frames, mostly by hand. AI cannot do 12-24 px sprites
   to this standard (64 of 64 `create_image_pro` candidates were chibi). Wave A is the critical path for the demo.
7. **The proof is composited on stills.** The live engine check (`roundPixels` at zoom .75, the real HUD rects at
   every UI scale, the DOM tail join) is pending until Wave A.
8. **Two overrides of the story bible need the Director's OK:**
   - D2: palette-step fidelity instead of the twin crossfade, which changes the bible's code map: there is no color
     twin;
   - D4: a paper bubble instead of `#1d1f21`.
9. **The `ART_BRIEF.md` style anchor URL has expired.** Re-anchor PixelLab calls on a base64 of `flywheel.png`, and
   update the brief.

---

## Appendix A. `eraRecolor` (offline; proof implementation in `tools/build.py`)

- **Sepia map** (row I, every material):

  | from | to |
  |---|---|
  | `#1f2225`, `#2b2e31` | `#2e1a12` |
  | `#3e4246`, `#6e3a22` | `#4e2a1a` |
  | `#5a5f63`, `#8c4a2a` | `#5f5244` |
  | `#7d8286`, `#ad6236`, `#7a7468` | `#8a7a64` |
  | `#a3a6a4`, `#c98552`, `#d9822b`, `#9c9182` | `#a8957a` |
  | `#f0a848`, `#b8a98f` | `#c9b28a` |
  | `#ffd27a`, `#d2bf9c` | `#ddc9a3` |

  Ink and the sand ramp map to themselves. This is luminance-matched (CIE L\*), then hand-tuned so the coat keeps
  3 tones.
- **Returns per row:**
  - II: `#d9822b` → `#8c4a2a` and `#f0a848` → `#ad6236`;
  - III: `#d9822b #f0a848 #c98552 #ad6236 #8c4a2a` own;
  - IV: + `#1f2225 #2b2e31 #3e4246 #5a5f63` own;
  - V and whole: all own.
- **Row V rim:** in every row of a frame whose run is ≥ 7 px wide, the first interior pixel on each flank becomes
  `#9a6ad0`. The outline stays ink.
- **Per-denizen material maps** may pin a color to a later row. Example: the girl's raincoat yellow returns only in
  row III, because she is the color thread.
