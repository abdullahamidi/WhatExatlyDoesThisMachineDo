# Art — Era IV (Resonance, resource RS) — CONTRACT

Authority: art + machine contract for WP12 (Era IV content). Ids, files, sizes, origins, sockets, links and frame counts below are final;
all PNGs exist in `public/assets/machine/era4/`. WP12 may retune numbers in `src/data/` only where marked *(tunable)*.
Coordinates: machine-local art px, origin = frame base centre, +y down, ground contact on row y −1. "corner" = pixel-grid corner.
Baseline: ART_ERA2 (CR1–CR3, CR6) + ART_ERA3 (Era III layout, `pipe` link, `MachineLink.depth`). Era IV grows **up** (roadmap §1).

## 0. Deviation from roadmap §1 / ART_ERA3 §7 note (read first)
Roadmap: "spire 64×320 above piston block (to −430)". ART_ERA3 note: "spire foot above the piston block at y ≤ −183, clear of the P1 riser".
**Contract: the spire is an 80×320 lattice tower standing on the frame top girder, right of the piston block, legs straight over frame posts
29..38 and 92..99** (axis x 64, top −430, crystal tip −458). Reasons: (1) load path — every leg sits on a post, straight down to the ground (R4);
above the block the only seats are the 6-px block standards, crossed by the steam manifold and the P1 elbow; (2) the block top is better used by
the **calliope** (steam whistles screwed onto the manifold's three stud bosses) — the real way pressure becomes sound (§1); (3) composition:
the spire axis (x 64) is near the machine centre (−442..448); the Era I piston block stays readable. The ART_ERA3 riser constraint is moot
(nothing of Era IV comes within 60 px of the riser x −100..−97); the calliope top is −218.

## 1. References → rules
- Tesla's oscillator (1893 patent): a steam-driven reciprocating piston; Tesla's (unverified) story of it shaking a building by matching its
  resonant frequency (https://en.wikipedia.org/wiki/Tesla%27s_oscillator). → `spireExciter`: steam cylinder + sprung plunger at the tower foot,
  fed by a pipe from the old steam manifold, its plunger is the bottom anchor of the resonator rod.
- Wardenclyffe: metal lattice tower, the tower as oscillator, top terminal on the crown (https://en.wikipedia.org/wiki/Wardenclyffe_Tower,
  https://teslasciencecenter.org/announcements/inventor-teslas-plant-nearing-completion). Lattice towers: legs + horizontals + X diagonals at
  30–60° to the leg, K/X panels, tapered profile (https://www.joe.uobaghdad.edu.iq/index.php/main/article/view/2431, lattice-tower patents US9926717).
  → 4-tone iron legs (5 → 2 px), panels shrinking up (40 → 15 px), X bracing where the panel is ≥ 9 px wide, single alternating diagonal above;
  concave (Eiffel-like) leg curve d = 6 + 24.5·(1−t)^1.6; shoes bolted on the girder over the posts.
- Standing waves: drawn as the **envelope** (max displacement), nodes fixed, antinodes swell; string fixed at both ends, n antinodes
  (https://physics.drexel.edu/~lane/Phys106demos/standingwave/UnderstandingSWDia1.html, https://demonstrations.wolfram.com/TransverseStandingWaves/).
  → `spireWave`: 3rd harmonic on the rod (exciter → crown), dotted dark-verdigris envelope + moving bright line, node ticks at L/3, 2L/3.
- Koenig / Marloye tuning fork on an open-ended wooden resonance box (box ≈ λ/4, node at the closed end, loud from the mouth)
  (https://physics.kenyon.edu/EarlyApparatus/Rudolf_Koenig_Apparatus/Tuning_Forks_on_Resonators/Tuning_Forks_on_Resonators.html,
  https://hoodmuseum.dartmouth.edu/objects/2002.1.34035). → `koenigFork` (echoCrank): rings by sympathetic resonance with every crank knock.
- Steam calliope: whistles mounted on a steam manifold, one valve under each whistle (https://www.americanheritage.com/dont-boil-calliope-player-or-good-news-music-lovers,
  https://www.mmdigest.com/archives/Digests/200407/2004.07.08.05.html). A whistle is a pressure-driven resonator. → `calliope` (pressureResonator):
  3 graded brass bell whistles on tee valves, screwed onto the 3 stud bosses of the Era III manifold.
- Acoustic mirrors (Denge, 1928): parabolic dishes with a microphone pole at the focus (https://en.wikipedia.org/wiki/RAF_Denge).
  Side elevation of a paraboloid with horizontal axis: rim circle edge-on = **vertical line** at the rim plane, back = parabola → filled **D**
  silhouette (a thin crescent is a cross-section, not a side view — first PixelLab batch rejected for this). Seams of constant depth = vertical
  lines. Focus beyond the rim plane (f 18.75 px, depth 12 px). → `emitterDish` + horn at the focus facing the mirror.
- Quartz: hexagonal prism (6 m faces) capped by r/z rhombohedral faces (pointed termination) (https://mineralmatters.substack.com/p/tessin-habit-quartz).
  Side view → 3 visible prism faces + 3 termination facets. → `crystal`: main prism + 2 small leaning crystals, hard facets, no halo.
- Toroid top-load / corona ring on HV resonators (https://pupman.com/listarchives/2018/Aug/msg00005.php): side view of a horizontal torus =
  stadium (capsule). → `coilRingN`: toroidal copper winding (diagonal wire gaps), verdigris patina clusters.
- Synchroscope (pointer stops at 12 o'clock when in phase, https://en.wikipedia.org/wiki/Synchroscope) researched; not used (no room at 1:1).
- Pixel glow without slop: value contrast first, a short ramp (3 steps), hard clusters, no outer halo/gradient, pulses step only between adjacent
  ramp values (https://www.wayline.io/learn/pixel-art/2, https://pixeljoint.com/forum/printer_friendly_posts.asp?TID=19888).
- House rules kept: R1 axles end-on (servo output shaft = disc boss), R4 every part stands on steel/ground, parallel-crank coupling (equal pin
  radii, coupler parallel to the line of centres) for the servo, locked palette, alpha 0/255, crop/pad/hand-pixel only, RotSprite for rotation,
  accents only on small areas, light from upper-left.

## 2. Palette
Rust Wasteland + Era II cyan (unused here) + Era III ember/steam (unused here) + **Era IV verdigris**:
`PALETTE += verdigrisDark 0x3f5e52, verdigris 0x7fae96, verdigrisLight 0xcfe8d6` (accents only: crystal, standing-wave line, dish waves, coil
patina + glints, exciter sight glass, servo lamp, calliope patina specks, dish receiver lamp).
Materials: tower/exciter/servo/dish = iron ramp + clustered rust; coil rings = copper (rust ramp clean bands `#4e2a1a..#c98552`) + verdigris patina;
whistles = brass (`#8c4a2a #ad6236 #c98552`) + verdigris specks; fork box = wood (rust ramp, grain lines); fork tines = steel (`#a3a6a4 #7d8286`).
All 15 PNGs verified: every opaque pixel a palette colour, alpha ∈ {0,255}.

## 3. Flow (pressure → resonance, coherent at every unlock)
PR (Era III steam main) → manifold right end → **pipe P4** (bore 4) → `spireExciter` (Tesla-type oscillator) → plunger drives the **resonator rod**
(2 px, centre of the tower, exciter eye (64,−142) → crown underside (64,−414)) → tower = resonant structure; crown cradles the crystal.
- `harmonicCoil` adds toroidal coils around the tower (Q up).
- `pressureResonator`: steam whistles on the manifold (pressure → standing sound wave).
- `crankServo`: gearbox on the frame bottom girder turns the hand crank through a coupling rod on the crank knob (automation of the manual choice).
- `echoCrank`: Koenig fork rings sympathetically on every crank click (click echo).
- `phaseLock`: twin acoustic mirrors on the tower broadcast the locked phase (mult all).
- `standingWave`: visible standing wave on the rod.  `crystalLattice`: quartz crystal in the crown cradle (feeds PR/EE: ×2 both).

## 4. Type additions (WP12, pure data/maths; no Phaser in data)
```ts
type AnimationDriver = 'manual' | 'automation' | 'combined' | 'electric' | 'thermal' | 'resonance';   // resonance = rates.perSecond.rs
// MachineLink.kind 'rod' generalised: endpoints may be two `pin` points on parts with `driven` animation:
//   end = attachPos + rotate(pin.at, partAngle)   (clockwise, 0 = sprite as drawn). Existing mainShaft→yoke rod unchanged.
// MachineLink.depth?: number (Era III) is used for R1 (front + 4).
```
No new link kind, no new animation kind (only `frames`, `driven`, `none`).

New sockets: spireBase(64,−110) spireRod(64,−142) coilRing1(64,−157) coilRing2(64,−223) coilRing3(64,−274) coilRing4(64,−330)
dishL(35,−360) dishR(93,−360) dishWavesL(−5,−360) dishWavesR(133,−360) crystalSeat(64,−418) calliopeSeat(−44,−178) forkBase(16,−110)
servoBase(0,−14) servoHub(0,−24).

## 5. Components (all files under `public/assets/`, all delivered)
| component | tech ≥lvl | asset id → file | size | origin | socket | layer/bias | animation | connections (rel. to attach) |
|---|---|---|---|---|---|---|---|---|
| spireTower | resonatorSpire 1 | machine.spireTower → machine/era4/spire-tower.png | 80×320 | .5,1 | spireBase | mid/0 | none | – |
| spireExciter | resonatorSpire 1 | machine.spireExciter → machine/era4/spire-exciter.png | 24×32 | .5,1 | spireBase | mid/2 | none | pipe `steam` (−12,−16) |
| spireWave | standingWave 1 | machine.spireWave → machine/era4/spire-wave.png sheet 128×270, frame 16×270 ×8 | 16×270 | .5,1 | spireRod | mid/1 | frames 8, maxHz 12, resonance *(tunable)* | – |
| coilRing1 | harmonicCoil 1 | machine.coilRing1 → machine/era4/coil-ring-1.png sheet 248×8, frame 62×8 ×4 | 62×8 | .5,.5 | coilRing1 | mid/3 | frames 4, maxHz 6, resonance | – |
| coilRing2 | harmonicCoil 8 | machine.coilRing2 → machine/era4/coil-ring-2.png sheet 192×8, frame 48×8 ×4 | 48×8 | .5,.5 | coilRing2 | mid/3 | frames 4, maxHz 6, resonance | – |
| coilRing3 | harmonicCoil 16 | machine.coilRing3 → machine/era4/coil-ring-3.png sheet 144×8, frame 36×8 ×4 | 36×8 | .5,.5 | coilRing3 | mid/3 | frames 4, maxHz 6, resonance | – |
| coilRing4 | harmonicCoil 25 | machine.coilRing4 → machine/era4/coil-ring-4.png sheet 120×8, frame 30×8 ×4 | 30×8 | .5,.5 | coilRing4 | mid/3 | frames 4, maxHz 6, resonance | – |
| calliope | pressureResonator 1 | machine.calliope → machine/era4/calliope.png | 72×40 | .5,1 | calliopeSeat | back/3 | none (puff fx §6) | – |
| servoBase | crankServo 1 | machine.servoBase → machine/era4/servo-base.png | 28×20 | .5,1 | servoBase | mid/3 | none | – |
| servoArm | crankServo 1 | machine.servoArm → machine/era4/servo-arm.png (+rot machine/era4/rot/servo-arm-rot.png, 80 f, 9×9, 432×432) | 48×48 | .5,.5 | servoHub | front/3 | driven ratio −1.75, phase 0 (= handCrank) | pin `pin` (0,−19) |
| koenigFork | echoCrank 1 | machine.koenigFork → machine/era4/koenig-fork.png sheet 88×44, frame 22×44 ×4 | 22×44 | .5,1 | forkBase | mid/0 | frames 4, maxHz 12, manual | – |
| emitterDishL | phaseLock 1 | machine.emitterDish → machine/era4/emitter-dish.png | 40×64 | .5,.5 | dishL | mid/4 | none | – |
| emitterDishR | phaseLock 1 | machine.emitterDish (same file) | 40×64 | .5,.5 | dishR | mid/4, **flipX** | none | – |
| dishWavesL | phaseLock 1 | machine.dishWaves → machine/era4/dish-waves.png sheet 240×64, frame 40×64 ×6 | 40×64 | .5,.5 | dishWavesL | mid/4 | frames 6, maxHz 8, resonance | – |
| dishWavesR | phaseLock 1 | machine.dishWaves (same file) | 40×64 | .5,.5 | dishWavesR | mid/4, **flipX** | frames 6, maxHz 8, resonance | – |
| crystal | crystalLattice 1 | machine.crystal → machine/era4/crystal.png sheet 128×48, frame 32×48 ×4 | 32×48 | .5,1 | crystalSeat | mid/4 | frames 4, maxHz 4, resonance | – |
Existing parts get new connections: `steamManifold` pipe `outR` at (33,−8) (= right end flange, world (−11,−176)); `handCrank` pin `pin` at (0,−19)
(= knob centre; knob cols 20..28 rows 1..8 of hand-crank.png, hub corner (24,24)).
flipX: origin is the sprite centre, so mirroring about it is exact; R sockets are the mirror of L about x 64 (x' = 128 − x).
Frame 0 of every sheet is the rest frame (held when the driver is below rest): wave = straight glowing rod (cos 0) + envelope; rings = no glint;
crystal = dim; dish waves = empty; fork = tines straight.
`harmonicConvergence` (milestone) has no component (FX only, §6). Shadows: none new (every Era IV part stands on steel).

**Links**
| id | kind | from → to | via (absolute) | style | tech gate (implicit) |
|---|---|---|---|---|---|
| P4 | pipe bore 4 | steamManifold `outR` (−11,−176) → spireExciter `steam` (52,−126) | (48,−176) (48,−126) | steam (Era III) | resonatorSpire (+ boiler, always true by then) |
| R1 | rod, depth front+4 | servoArm `pin` → handCrank `pin` | – | Era I rod style | crankServo |
R1 geometry: servo hub (0,−24), crank hub (0,−56), equal pin radius 19, same angle (both `driven −1.75`) → rod always vertical, length 32 (parallel
crank). Servo pin lowest point y −5 (above ground; the eye overlaps the bottom girder in front). Checked at 0/90/180/270° (`servo_angles_6x.png`).

**Clearances (checked in mock):** tower shoes x 28..39 / 88..99 on girder top −110 over posts 29..38 / 92..99; piston block right edge x 3, fork x 5..26,
tower left shoe x 28 (1 px gaps). Tower right leg ≤ x 99, flywheel ≥ x 102. P4 rows −179..−174 clear fork top −154, ring1 −161..−154, calliope
bottom −179 ends x −10; P4 riser x 46..49 inside the tower (passes behind legs, battens and ring1). Servo base rows −34..−15 on bottom girder top −14,
pinion tip −36 (1 row clear), belt lower span ≥ −41. Calliope stubs x −75..−69 / −48..−41 / −20..−13 cover the stud pairs (−73,−72) (−45,−44)
(−17,−16), bottom row −179 on header top −178. Dish trunnion col touches leg outer x 55 (L) / 72 (R) at row −360; ring4 (x 49..78, −334..−327) clear of
the dish shells (x ≤ 41 there). Crystal bottom row −419 on crown plate top −418, inside the claws (x 52..55 / 72..75).

**Contact / support check:** tower → frame posts; exciter → girder; rod → exciter eye + crown; rings → battens (−158/−224/−275/−331, centred
on the batten); dishes → trunnion on the leg; crystal → crown plate in claws; calliope → manifold studs; fork box → girder; servo feet → bottom
girder; servo arm → servo shaft. No floating part at any unlock order (`stages_era4.png`).

## 6. Animation + FX
- spireWave: frame k displacement d = A·sin(3πs/L)·cos(90° + 45°·k), L 270, A 5 (4 on the top third, the tower is narrow there); dotted
  envelope ±A|sin| in `#3f5e52` every 2nd row; line `#cfe8d6` + `#7fae96` right of it; node ticks rows 90 and 180. 12 fps → 1.5 Hz cycle.
  Constant brightness (motion only, no flash).
- coilRingN: glint (`#cfe8d6/#7fae96` 4×2) at ¼, ½, ¾ of the ring width in frames 1..3, frame 0 none → current running round the toroid.
- crystal: 0 dim (`#7d8286/#3f5e52/#2b2e31`), 1 mid, 2 bright (`#cfe8d6/#7fae96/#3f5e52` + 4 sparkles), 3 mid → 1 Hz pulse at maxHz 4; adjacent
  ramp steps only (≤ 3 Hz flash rule held).
- dishWaves: frames 1..5 a wave front leaves the mirror (radius 17 + 7k about the focus, ±26 rows), trailing faint front; frame 0 empty → pings.
- koenigFork: tines ±1 px at the tips (frames 1/3), driver `manual` → rings while crank clicks decay (no linkage: sympathetic resonance).
  Audio hook: tuning-fork ping per click when echoCrank ≥ 1.
- servoArm: RotSprite 80 frames (same N and ratio as the crank group: frame = rotationFrame(angle, 80)).
- FX (data, world-space, reuse Era III emitter code): `STEAM_EMITTERS` += calliope mouths (−72,−193) (−44,−193) (−16,−194) `fx.steamPuff`,
  a 2-puff burst from one whistle (round-robin) every 5–8 s while RS/s > 1 *(tunable)*, all three on purchase and on the harmonicConvergence milestone.
- Rising dust (roadmap "dust drifts upward"): when resonatorSpire ≥ 1, `DUST.speedY` → [−18, −6] world px/s, spawnTopY → GROUND_Y − 900
  (art −450, spire height), fade over 1.5 s *(tunable)*. Reduced motion: speedY [−6, −2], wave/ring/dish maxHz clamped to 4.
- harmonicConvergence milestone: 1 s hold of crystal frame 2 + dish-wave restart + calliope burst (code; no art).

## 7. World / camera
- Full machine bounds (art): x −442..448 (unchanged), top **−458** (crystal tip) → `MACHINE_BOUNDS = { left: −448, right: 448, top: −470, bottom: 8 }`
  (RT 896×478; RT origin y moves −248 → −470, every older offset unchanged).
- World: crystal tip y = 1120 − 2·458 = 204, bounds top 1120 − 940 = 180 ≥ 0 → **fits WORLD 2560×1440, no WORLD/GROUND_Y growth for Era IV.**
- fitView (margin 48): width as Era III → zoom 0.5 (min zoom = whole world); height 478 art = 956 + 96 = 1052 ≤ 1440 ✓. At 0.5 the camera centre clamps
  to (1280, 720): ground at screen y 560, spire top at screen y ≈ 100. Auto-frame on resonatorSpire / phaseLock / crystalLattice purchase (no zoom change).
- **Era V warning:** null core 96×96 above the crystal (crown top −466 → core top ≈ −564 + rings) exceeds the current world top (art −560 at
  GROUND_Y 1120). Era V needs the roadmap growth (WORLD 3840×2160, GROUND_Y 1680 → art top limit −840). Era V socket for the core: `coreSeat` (64,−466)
  (top of the crystal canvas; the core may float above the crystal, claws already cradle it).

## 8. Contract notes / requests (optional, Director decides)
| # | item | reason |
|---|---|---|
| CR-A (decided here, §0) | spire on frame posts, x 28..99, axis 64, 80×320 (not 64×320 above the block) | load path, calliope on the manifold, composition |
| CR-B (optional) | audio: whistle chord on harmonicConvergence (3 sine partials ~ 3:4:5, 1.2 s) + fork ping per click (echoCrank) | roadmap audio "tuning-fork pings"; art already shows the sources |
| CR-C (note) | roadmap "servo arm 48×48" = static gearbox 28×20 + rotating arm 48×48 + rod R1 (parallel crank); "twin emitter dishes 48×64" = one 40×64 file + flipX, waves as a separate 40×64 frame sheet; "crystal 48×48" = 32×48 | mechanical correctness and no wasted canvas |
| CR-D (optional) | spireExciter `vibrate resonance amp 1` | **not recommended**: the exciter carries P4 and the rod anchor; jitter shears both (same reason as ART_ERA2 CR4) |

## 9. Production log
PixelLab `create_image_pro`, palette Rust Wasteland + verdigris, style = flywheel anchor (344ab19d…), no_background:
crystal 6b3227f4 (36 cand., reference only: mottled beige stripes + rock base = slop), dish b06f5471 (16, rejected: crescent cross-section profile,
large copper area), fork f0024a89 (49, reference for box proportions; copper tines rejected), whistles a0a867d3 (16, **#0 used**: `#f0a848` streaks →
`#c98552`, grey specks on bells → verdigris, each whistle re-spaced onto its stud), servo gearbox 394b3885 (64, not used: boss off-centre).
Hand-pixelled to exact geometry: tower (profile, panels, X bracing, shoes, crown + claws, rod), exciter, standing-wave sheet (maths), toroid rings ×4,
crystal (prism/termination rasterised from geometry, 4 glow frames), acoustic mirror (D silhouette, f 18.75), dish waves, Koenig fork + box (4 frames),
servo gearbox, servo arm. RotSprite: `python3 scripts/art/make_rot.py public/assets/machine/era4/rot public/assets/machine/era4 '{"servo-arm":80}'`.
Tools: `scripts/art/era4/` — `tower.py` (writes tower + geometry json), `parts.py [part…]` (all other parts), `mock4.py` (Era I–IV compositor:
`python3 mock4.py out.png 3 0 3 0 17 1 1`, env `U4=0..9` unlock stage, `K4` anim frame, `CRANK` crank/servo rot frame), `compose.py`, `pal.py`, `helpers.py`.
Run order: `python3 tower.py && python3 parts.py` (PixelLab whistle source kept in `scripts/art/era4/src/whistle-0.png`; `tower-geo.json`/`rings.json` go to ERA4_GEN).
Evidence (scratch `/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era4/`):
`mock_era4_full.png` / `-2x` / `-3x` (Era I–IV), `mock_era3_baseline-2x.png` (before), `stages_era4.png` / `-2x` (unlock order), `anim_sheet_era4.png`,
`servo_angles_6x.png`, `crop_base_4x.png`, `crop_top_4x.png`, `crop_rings_4x.png`, `crop_servo_6x.png`.

## Director decisions
- CR-A ACCEPTED: spire on the frame top girder (axis x 64), calliope on the piston block.
- CR-B ACCEPTED: fork ping per click (echoCrank owned), whistle chord on harmonicConvergence milestone.
- CR-C ACCEPTED: roadmap size changes (servo base+arm+rod, one dish file + flipX, crystal 32×48).
- CR-D ACCEPTED: no vibration on the exciter.

## In-game review (WP10, Art Director)
Build at http://localhost:4173/ (s12_spire, s13_era4_full), close-ups at zoom 2 + motion frames. Evidence (scratch `…/scratchpad/ad4/`):
`crown.png dishes.png rings.png calliope.png base.png servo.png`, `s12/base.png s12/top.png`, `servo_2x.png crankknob_f0.png crankknob_f6.png`,
`top_sheet.png` (wave/crystal/dish-wave motion), `calli_sheet.png` (before) / `calli_after_sheet.png` (after), `s13_spire_2x.png`.

**Pass:** spire shoes on girder over posts; rod exciter eye → crown; rings 1–4 on battens, graded, glint frames; P4 header → riser x 47 → exciter port,
no gap; calliope stubs on the studs; fork box on girder (1 px gaps); exciter on girder; dishes D-silhouette, rim outward, horn at focus facing the
mirror, trunnion on leg, waves leave outward; crystal in claws, 4-frame pulse; servo feet on bottom girder; **R1 vertical at every sampled angle,
top eye on the crank knob centre (r 19), bottom on the servo pin** (servo_2x.png); no floating part in s12 or s13; composition at 0.5 reads (T shape,
spire axis near centre, top ≈ screen y 100, clear of HUD).

| # | defect | fix | status |
|---|---|---|---|
| D1 | calliope puffs spawned at the mouth slot (−193) rose 20 px straight up the bell face → read as a lamp inside the brass, not a whistle toot | `STEAM_EMITTERS.calliope.at` → bell caps + 4 px: (−72,−211) (−44,−216) (−16,−221) (`src/data/steamFx.ts` + test) | **done**, calli_after_sheet.png: plume above each cap, round robin, ~1 burst / 5–8 s |
| D2 | Era III `manifold` leak emitter (−72/−44/−16, −182, rate 0.3–1.5/s) still fires once the calliope sits on the studs: puffs appear at every whistle foot and climb the bells, drowning the round-robin toots (most of the puffs in calli_after_sheet.png are these) | **code**: `SteamEmitter.until?: { techId: TechId; minLevel: number }` (emitter quiet once reached); `SteamFx` active = gate met && !until met; data `manifold.until = { techId: 'pressureResonator', minLevel: 1 }` (the whistle tee valves seal the studs). Test: manifold inactive at pressureResonator 1, calliope active. | spec → EM |
| D3 (low) | hand-crank knob is worn wood `#8a7a64/#a8957a`, near the sky/sand value; at 1:1 R1's top eye can look pinned to air when the knob overlaps sky | none for WP10 (Era I asset, outlined in ink; geometry correct). Optional later: knob 1 value darker (`#5f5244` body, `#8a7a64` light) in hand-crank.png + re-run make_rot | note |

**WP11 (world 3840×2160, GROUND_Y 1680) flags**
- W1 minZoom: `minZoomToFit(VIEW, WORLD)` becomes 1/3 → art px = 0.667 screen px (non-integer): 1–2 px features (spire rod, wave line, ring glints,
  dish-wave arcs, belts, R1) drop rows / shimmer. Keep the zoom ladder on art-integer steps (0.5, 1, 1.5, 2; 0.25 only if an overview is required, and
  then accept 2:1 decimation). Era V top (art −840) at 0.5 = 840 screen px > 720 → the whole machine no longer fits at 0.5; auto-frame should pan, not zoom below 0.5.
- W2 `MACHINE_ANCHOR.x` and `CAMERA.focus.x` are literal 1280 → derive from `WORLD.width / 2` (Era IV parts are machine-local, unaffected).
- W3 `bg.sky` 1280×720 at scrollFactor 0: verify cover at the new min zoom; above art −470 the view shows only the flat top cloud band (s12/top.png) → Era V needs a taller sky gradient/zenith band.
- W4 `DUST.maxParticles` 60 spread over `WORLD.width`: density per screen drops by 1/3 at 3840 → scale to 90 (or spawn x around the camera). `DUST_RISING.spawnTopY` is GROUND_Y-relative: OK.
- W5 parallax spans (`parallaxSpan`, pylon line) depend on minZoom → re-shoot s0/s9/s13 after the change.
