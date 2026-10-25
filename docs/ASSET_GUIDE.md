# Asset Guide

How art is named, sized, rendered, replaced and falls back. Source of truth: `src/assets/assetIds.ts` (ids),
`src/assets/manifest.ts` (file, size, pivot, tiling, frames, description), `src/assets/fallbackTextures.ts`
(procedural painters), `src/game/scenes/BootScene.ts` (loading and warnings).

## Naming

- Every asset has an id `<category>.<name>` (camelCase name), listed in `ASSET_IDS`.
- Default file path: `public/assets/<category>/<kebab-name>.png`, so `machine.gearSmall` maps to
  `public/assets/machine/gear-small.png`.
- Categories in use: `bg`, `terrain`, `fx`, `machine`, `ui`, `world` (`world.*` = the living world: denizens, street and props, WP23a).
- The manifest `file` field (relative to `public/assets/`) and the generated table below are authoritative. Many ids
  do not follow the default path (for example `machine.crank` -> `machine/hand-crank.png`), so read the file from the
  table or the manifest, never from the id.

## Palette and style

- Palette "Rust Wasteland": ink, iron, rust, sand, sky ramps, plus a small accent ramp (orange/yellow).
  Accent is for glints, heat and warning paint only, never large areas.
- Side view, flat elevation, light from upper-left. 3-4 tone shading per material. Hard clusters, no dithering noise.
- Machine parts: symmetric and readable at 2x. Rotating parts (crank hub, gears, flywheel) perfectly centred and round.
- Background layers: low contrast, fewer colours, silhouettes, no outlines.
- Full brief, exact hex values and prompts: `docs/plan/ART_BRIEF.md`.

## Asset table

All sizes are art px (`width` x `height` in the manifest). Pivot `origin` is normalised (0-1) inside the sprite.
Machine-local depths are relative to the machine container, which sits at world depth 100 (`DEPTH.machine`).

<!-- asset-table:start -->

### World

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `bg.sky` | `bg/sky.png` | 1280 x 720 | 0.5, 0.5 | none | none | parallax `sky`, scroll 0, world depth -100 | Dusty sky in the four sky palette tones as hard stepped strata, pale sun disc upper-left (light direction); screen-fixed, shown at 2x. |
| `bg.mountains` | `bg/mountains.png` | 512 x 256 | 0, 1 | x | none | parallax `mountains`, scroll 0.15, world depth -90 | Far ridge with distant ruins; tiles horizontally, period = width, ground line at y=156; rows 156-255 far-plain ramp (bottom rows #5f5244 = layer underfill). |
| `bg.skyline` | `bg/skyline.png` | 512 x 320 | 0, 1 | x | none | parallax `skyline`, scroll 0.3, world depth -80 | Ruined city skyline; tiles horizontally, period = width, ground line at y=220; rows 220-319 transparent (layer underfill null). |
| `bg.pylons` | `bg/pylons.png` | 256 x 256 | 0, 1 | x | none | parallax `pylons`, scroll 0.55, world depth -70 | Rusted pylons with sagging wires; tiles horizontally, period = width, ground line at y=156. |
| `terrain.ground` | `terrain/ground.png` | 256 x 128 | 0, 0 | xy | none | ground, world depth 0 | Cracked sand ground tile that tiles in both directions. |
| `bg.pylonsLit` | `bg/pylons-lit.png` | 256 x 256 | 0, 1 | x | none | parallax `pylonsLit`, scroll 0.55, world depth -69 | Pylons with their wires lit; the same tiling as bg.pylons, shown once the power lines are running. |
| `bg.skyViolet` | `finale/sky-violet.png` | 1280 x 720 | 0.5, 0.5 | none | none | parallax `skyViolet`, scroll 0, world depth -99 | Violet night sky in hard stepped strata, screen-fixed, faded in as the null tech stages arrive. |
| `bg.eclipse` | `finale/eclipse.png` | 288 x 48 | 0.5, 0.5 | none | 6 (48 x 48) | eclipse in the sky (ECLIPSE), world depth -98 | Six-frame eclipse sheet: a dark disc with a ring that grows across the sky, frame 0 is the baked sun. |
| `bg.horizonGlow` | `finale/horizon-glow.png` | 1280 x 720 | 0.5, 0.5 | none | none | parallax `horizonGlow`, scroll 0, world depth -97 | Soft glow along the horizon on every side, screen-fixed, brightening with the horizon field. |
| `bg.skyRestored` | `finale/sky-restored.png` | 1280 x 720 | 0.5, 0.5 | none | none | parallax `skyRestored`, scroll 0, world depth -96 | Restored clear sky in hard stepped strata, screen-fixed, faded in by the finale track over the violet sky. |
| `bg.mountainsRestored` | `finale/mountains-restored.png` | 512 x 256 | 0, 1 | x | none | parallax `mountainsRestored`, scroll 0.15, world depth -89 | Far ridge recoloured green with foothills; tiles horizontally, same footprint as bg.mountains. |
| `bg.skylineRestored` | `finale/skyline-restored.png` | 512 x 320 | 0, 1 | x | none | parallax `skylineRestored`, scroll 0.3, world depth -79 | Restored city skyline on the same footprints as bg.skyline; tiles horizontally, period = width. |
| `bg.regrowth1` | `finale/regrowth-1.png` | 512 x 32 | 0, 1 | x | none | finale regrowth (FINALE wipe), world depth 2 | Regrowth strip, stage 1 of 3 (succession order, ART_ERA5 §1); tiles horizontally, period = width. |
| `bg.regrowth2` | `finale/regrowth-2.png` | 512 x 32 | 0, 1 | x | none | finale regrowth (FINALE wipe), world depth 2 | Regrowth strip, stage 2 of 3 (succession order, ART_ERA5 §1); tiles horizontally, period = width. |
| `bg.regrowth3` | `finale/regrowth-3.png` | 512 x 32 | 0, 1 | x | none | finale regrowth (FINALE wipe), world depth 2 | Regrowth strip, stage 3 of 3 (succession order, ART_ERA5 §1); tiles horizontally, period = width. |
| `terrain.groundGreen` | `terrain/ground-green.png` | 256 x 128 | 0, 0 | xy | none | restored ground (RESTORED_GROUND), world depth 0.5 | Green recolour of terrain.ground with the same seams; tiles in both directions. |
| `bg.windowLit` | `bg/window-lit.png` | 8 x 6 | 0, 0 | none | 2 (4 x 6) | living world, far window plane (6 skyline windows) | Lit skyline window in rust-amber, 2 frames (lit, breathe), six placements on the skyline windows; planned file bg/window-lit.png. |
| `bg.virga` | none (procedural) | 512 x 128 | 0, 1 | x | 2 (512 x 64) | living world, sf 0.15 strip at depth -89.5 (sky ramp) | Rain streak strip tiling on x above the mountain ridge, 2 frames (falling, frozen), sky ramp only; WP23b art, procedural fallback until then. |

### World — Living world

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `world.inspector` | `world/inspector.png` | 380 x 240 | 0.5, 1 | none | 114 (20 x 40); 6 era rows | living world, back row; era rows I-V and whole | Inspector sheet, 19 frames per era row (dome hat, long coat, clipboard at the chest, umbrella) in rows I, II, III, IV, V, whole; planned file world/inspector.png. |
| `world.clipboardPages` | none (procedural) | 18 x 3 | 0.5, 1 | none | 3 (6 x 3) | living world, back row +0.1 (on the Inspector) | Cycle trace on the Inspector clipboard, 3 frames of 6x3; WP23b art, procedural fallback until then. |
| `world.dog` | `world/dog.png` | 560 x 120 | 0.5, 1 | none | 120 (28 x 20); 6 era rows | living world, front row | Dog sheet, 20 frames per era row (low wedge, one upright ear, curled tail) in rows I, II, III, IV, V, whole; planned file world/dog.png. |
| `world.stakeChain` | `world/stake-chain.png` | 20 x 6 | 0.5, 1 | none | 2 (10 x 6) | living world, front row | Stake with its chain on the ground, 2 frames; planned file world/stake-chain.png. |
| `world.hole` | `world/hole.png` | 64 x 6 | 0.5, 1 | none | 4 (16 x 6) | living world, front row -0.1 | Dig hole in the ground, 4 frames (dig stages); planned file world/hole.png. |
| `world.redBall` | none (procedural) | 3 x 3 | 0.5, 1 | none | none | living world, front row (postgame) | Red ball prop, one 3x3 frame: mutedOrange ball with a glint and a shadow (postgame); WP23b art, procedural fallback until then. |
| `world.crow` | `world/crow.png` | 240 x 108 | 0.5, 1 | none | 60 (24 x 18); 6 era rows | living world, back row +0.2 | Crow sheet, 10 frames per era row (wedge body, two wing fans, hooked beak) in rows I, II, III, IV, V, whole; planned file world/crow.png. |
| `world.girl` | `world/girl.png` | 160 x 168 | 0.5, 1 | none | 60 (16 x 28); 6 era rows | living world, back / front row (the girl) | Girl with the lantern, 10 frames per era row (hood, raincoat, lantern, stand, talk, shield, back-run) in rows I, II, III, IV, V, whole; planned file world/girl.png. |
| `world.girlMini` | `world/girl-mini.png` | 16 x 12 | 0.5, 1 | none | 2 (8 x 12) | living world, pylon plane | Girl seen from the pylon plane, 2 frames (lantern warm, lantern cold white); planned file world/girl-mini.png. |
| `world.girlWindow` | `world/girl-window.png` | 16 x 6 | 0, 0 | none | 4 (4 x 6) | living world, far window plane | Girl in the far window, 4 frames (flicker a, flicker b, dark, restored figure at the curtain); planned file world/girl-window.png. |
| `world.lantern` | none (procedural) | 12 x 4 | 0.5, 1 | none | 2 (6 x 4) | living world, back row | Lantern prop, 2 frames; WP23b art, procedural fallback until then. |
| `world.payphone` | `world/payphone.png` | 168 x 312 | 0.5, 1 | none | 36 (28 x 52); 6 era rows | living world, back row (booth) | Payphone booth, 6 frames per era row (dark, lit hood, ring-shake x2, fog overlay, cracked restored whole) in rows I, II, III, IV, V, whole; tally marks are procedural; planned file world/payphone.png. |
| `world.receiver` | `world/receiver.png` | 48 x 72 | 0.5, 0 | none | 36 (8 x 12); 6 era rows | living world, back row +0.1 | Booth receiver, 6 frames per era row (hang, swing x3, level, on hook) in rows I, II, III, IV, V, whole; planned file world/receiver.png. |
| `world.lamp` | `world/street-lamp.png` | 48 x 60 | 0.5, 1 | none | 4 (12 x 60) | living world, back row (street lamp) | Street lamp, 4 frames (dead, lit, warm, restored); planned file world/street-lamp.png. |
| `world.lampGlow` | `world/lamp-glow.png` | 64 x 16 | 0.5, 0.5 | none | 2 (32 x 16) | living world, back row +0.05 | Lamp glow overlay, 2 frames (cold, warm); planned file world/lamp-glow.png. |
| `world.clock` | `world/street-clock.png` | 32 x 44 | 0.5, 1 | none | 2 (16 x 44) | living world, back row (street clock) | Street clock, 2 frames (ruin, restored); the hands are a procedural overlay; planned file world/street-clock.png. |
| `world.sensor7` | `world/sensor7.png` | 160 x 240 | 0.5, 1 | none | 48 (20 x 40); 6 era rows | living world, back row (Sensor 7) | Sensor 7, 8 frames per era row (tripod, four head poses, lens fog, two readout glyphs) in rows I, II, III, IV, V, whole; the LED is a separate 1 px sprite; planned file world/sensor7.png. |
| `world.puddle` | none (procedural) | 320 x 5 | 0.5, 1 | none | 10 (32 x 5) | living world, back row -0.2 | Puddle strip, 10 frames (3 sizes x grey, ring, black, plus whole); WP23b art, procedural fallback until then. |
| `world.sprout` | none (procedural) | 40 x 24 | 0.5, 1 | none | 5 (8 x 24) | living world, back row | Sprout, 5 frames (4 white stages, 1 green bloom); WP23b art, procedural fallback until then. |
| `world.scraps` | `world/scraps.png` | 24 x 4 | 0.5, 1 | none | 3 (8 x 4) | living world, back row -0.2 | Scrap pile on the ground, 3 frames (burned away by the firebox tiers); planned file world/scraps.png. |
| `world.mote` | `world/mote.png` | 4 x 2 | 0.5, 0.5 | none | 2 (2 x 2) | living world, dust depth (1 emitter, pool 5) | Ash mote and white moth speck, 2 frames (ash, moth); one emitter with a pool of 5; planned file world/mote.png. |
| `world.page` | none (procedural) | 6 x 4 | 0.5, 0.5 | none | 2 (3 x 4) | living world, dust depth | Paper page that lifts from the ground about every 40 s in era IV, 2 frames; WP23b art, procedural fallback until then. |
| `world.shadow` | none (procedural) | 26 x 3 | 0.5, 0.5 | none | none | living world, row -0.01 (procedural Graphics, baked once) | Procedural shadow ellipse baked once in game; this 26x3 texture is a fallback only and never gets a file. |

### Machine — Era I

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `machine.frame` | `machine/support-frame.png` | 200 x 110 | 0.5, 1 | none | none | machine layer `frame`, depth 10 | Riveted, rusty support frame whose base sits on the ground line. |
| `machine.crank` | `machine/hand-crank.png` | 48 x 48 | 0.5, 0.5 | none | rot 80 (`machine/rot/hand-crank-rot.png`) | machine layer `front`, depth 30 | Hand crank with its hub at the centre; the player clicks it to work the machine. |
| `machine.gearSmall` | `machine/gear-small.png` (tiers t2 `machine/tiers/gear-small-t2.png` + rot `machine/tiers/rot/gear-small-t2-rot.png`, t3 `machine/tiers/gear-small-t3.png` + rot `machine/tiers/rot/gear-small-t3-rot.png`) | 40 x 40 | 0.5, 0.5 | none | rot 80 (`machine/rot/gear-small-rot.png`) | machine layer `mid`, depth 21 | Small toothed gear meshed into the drive train. |
| `machine.gearLarge` | `machine/gear-large.png` (tiers t2 `machine/tiers/gear-large-t2.png` + rot `machine/tiers/rot/gear-large-t2-rot.png`, t3 `machine/tiers/gear-large-t3.png` + rot `machine/tiers/rot/gear-large-t3-rot.png`) | 64 x 64 | 0.5, 0.5 | none | rot 140 (`machine/rot/gear-large-rot.png`) | machine layer `mid`, depth 20 | Large reinforced toothed gear that slows and steadies the drive. |
| `machine.flywheel` | `machine/flywheel.png` (tiers t3 `machine/tiers/flywheel-t3.png` + rot `machine/tiers/rot/flywheel-t3-rot.png`) | 96 x 96 | 0.5, 0.5 | none | rot 180 (`machine/rot/flywheel-rot.png`) | machine layer `mid`, depth 20 | Heavy flywheel that stores momentum for the machine. |
| `machine.motor` | `machine/worn-motor.png` (tiers t2 `machine/tiers/worn-motor-t2.png`, t3 `machine/tiers/worn-motor-t3.png`, t4 `machine/tiers/worn-motor-t4.png`, t5 `machine/tiers/worn-motor-t5.png` + pulse `machine/tiers/worn-motor-t5b.png`) | 64 x 48 | 0.5, 0.5 | none | none | machine layer `mid`, depth 21 | Worn electric motor bolted to the frame, shaking as it runs. |
| `machine.bearingPlate` | `machine/bearing-plate.png` | 16 x 16 | 0.5, 0.5 | none | none | machine layer `frame`, depth 11 | Square riveted steel bearing plate with a round bearing housing at its centre. |
| `machine.pulleyMotor` | `machine/pulley-motor.png` | 12 x 12 | 0.5, 0.5 | none | rot 24 (`machine/rot/pulley-motor-rot.png`) | machine layer `mid`, depth 22 | Tiny steel V-pulley seen face-on, with a rim ring and a hub dot. |
| `machine.pulleyMain` | `machine/pulley-main.png` (tiers t2 `machine/tiers/pulley-main-t2.png` + rot `machine/tiers/rot/pulley-main-t2-rot.png`, t3 `machine/tiers/pulley-main-t3.png` + rot `machine/tiers/rot/pulley-main-t3-rot.png`) | 24 x 24 | 0.5, 0.5 | none | rot 140 (`machine/rot/pulley-main-rot.png`) | machine layer `mid`, depth 22 | Cast main pulley face-on with a 4-hole web and a raised crank-pin boss at its right side. |
| `machine.pulleyCrank` | `machine/pulley-crank.png` (tiers t3 `machine/tiers/pulley-crank-t3.png` + rot `machine/tiers/rot/pulley-crank-t3-rot.png`) | 32 x 32 | 0.5, 0.5 | none | rot 80 (`machine/rot/pulley-crank-rot.png`) | machine layer `mid`, depth 22 | Small flat-belt pulley (r8, centred in a 32×32 canvas) with crowned rim and solid three-rib web; belt rides inside the pinion root. |
| `machine.pulleyFlywheel` | `machine/pulley-flywheel.png` (tiers t3 `machine/tiers/pulley-flywheel-t3.png` + rot `machine/tiers/rot/pulley-flywheel-t3-rot.png`) | 28 x 28 | 0.5, 0.5 | none | rot 180 (`machine/rot/pulley-flywheel-rot.png`) | machine layer `mid`, depth 23 | Hub pulley bolted to the flywheel, seen face-on with four spokes. |
| `machine.pedestal` | `machine/flywheel-pedestal.png` (tiers t2 `machine/tiers/flywheel-pedestal-t2.png`, t3 `machine/tiers/flywheel-pedestal-t3.png` + pulse `machine/tiers/flywheel-pedestal-t3b.png`) | 48 x 64 | 0.5, 1 | none | none | machine layer `back`, depth 21 | Cast-iron A-frame bearing stand in side view with a plummer block cap and bolted foot plates. |
| `machine.motorPlinth` | `machine/motor-plinth.png` (tiers t2 `machine/tiers/motor-plinth-t2.png`, t3 `machine/tiers/motor-plinth-t3.png`, t4 `machine/tiers/motor-plinth-t4.png`, t5 `machine/tiers/motor-plinth-t5.png`) | 48 x 10 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Low riveted iron skid with four hold-down bolts and sand dust along its top edge. |
| `machine.pistonBlock` | `machine/piston-block.png` (tiers t2 `machine/tiers/piston-block-t2.png`, t3 `machine/tiers/piston-block-t3.png`, t4 `machine/tiers/piston-block-t4.png`, t5 `machine/tiers/piston-block-t5.png` + pulse `machine/tiers/piston-block-t5b.png`) | 96 x 58 | 0.5, 1 | none | none | machine layer `back`, depth 1 | Static block of three identical vertical cylinders with capped heads on a foot plate. |
| `machine.pistonYoke` | `machine/piston-yoke.png` | 80 x 16 | 0.5, 0.75 | none | none | machine layer `back`, depth 0 | Horizontal steel crosshead bar with a centre pin eye and three plunger rods rising from it. |
| `machine.crankBrace` | `machine/crank-brace.png` | 48 x 48 | 0.5, 0.5 | none | rot 80 (`machine/rot/crank-brace-rot.png`) | machine layer `front`, depth 31 | Riveted doubler strap and bolted boss flange that overlay the hand crank. |
| `machine.namePlate` | `machine/era5/name-plate.png` | 240 x 11 | 0.5, 1 | none | 6 (40 x 11) | machine layer `frame`, depth 12 | Six-frame name plate on the girder: the stamped label lights one more stage per frame. |
| `machine.gearRim` | `machine/tiers/decals/gear-rim.png` | 64 x 64 | 0.5, 0.5 | none | none | machine layer `mid`, depth 20.5 | Static brass annulus (radius 20-22) laid over the large gear rim at MK III: rotationally symmetric, a glint arc at the upper left; never turns with the gear. |
| `machine.flywheelRim2` | `machine/tiers/decals/flywheel-rim-2.png` | 96 x 96 | 0.5, 0.5 | none | none | machine layer `mid`, depth 20.5 | Static clean-iron annulus over the flywheel rim at MK II (re-tyred rim): lit arc upper left, shadow arc lower right; rotationally symmetric. |
| `machine.flywheelRim3` | `machine/tiers/decals/flywheel-rim-3.png` | 96 x 96 | 0.5, 0.5 | none | none | machine layer `mid`, depth 20.6 | Flywheel rim 2 plus a one pixel brass inlay ring, drawn over rim 2 at MK III; rotationally symmetric. |

### Machine — Era II

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `machine.generatorPlinth` | `machine/era2/generator-plinth.png` | 104 x 10 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Cast bedplate with a tension-screw slot that the generator set stands on. |
| `machine.generator` | `machine/era2/generator.png` | 96 x 64 | 0.5, 0.5 | none | none | machine layer `mid`, depth 21 | Generator body with a coil housing, a shaft end and a cable terminal on the right. |
| `machine.pulleyGenerator` | `machine/era2/pulley-generator.png` | 20 x 20 | 0.5, 0.5 | none | rot 80 (`machine/era2/rot/pulley-generator-rot.png`) | machine layer `mid`, depth 25 | Generator belt pulley seen face-on, with a rim, spokes and a hub. |
| `machine.coils1` | `machine/era2/coils-1.png` (tiers t2 `machine/tiers/coils-1-t2.png`) | 64 x 40 | 0.5, 0.5 | none | none | machine layer `mid`, depth 22 | First coil stage: a single winding of copper wire around the generator frame. |
| `machine.coils2` | `machine/era2/coils-2.png` | 64 x 40 | 0.5, 0.5 | none | none | machine layer `mid`, depth 23 | Second coil stage: a denser copper winding that covers the first stage. |
| `machine.coils3` | `machine/era2/coils-3.png` (tiers t5 `machine/tiers/coils-3-t5.png`) | 64 x 40 | 0.5, 0.5 | none | none | machine layer `mid`, depth 24 | Third coil stage: a heavy copper winding that covers the lower stages. |
| `machine.motorRetrofit` | `machine/era2/motor-retrofit.png` (tiers t2 `machine/tiers/motor-retrofit-t2.png`, t3 `machine/tiers/motor-retrofit-t3.png`, t4 `machine/tiers/motor-retrofit-t4.png`, t5 `machine/tiers/motor-retrofit-t5.png` + pulse `machine/tiers/motor-retrofit-t5b.png`) | 32 x 16 | 0.5, 0.5 | none | none | machine layer `mid`, depth 23 | Retrofit control box with a wired terminal strip, bolted on top of the worn motor. |
| `machine.dynamo` | `machine/era2/dynamo.png` | 24 x 24 | 0.5, 0.5 | none | none | machine layer `frame`, depth 12 | Small friction dynamo: a housing with a roller that rides the underside of the crank belt, clamped to the frame. |
| `machine.capacitorRack` | `machine/era2/capacitor-rack.png` | 48 x 64 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Rack of capacitor cans on a steel frame with two lugs on the top plate. |
| `machine.sparkGap` | `machine/era2/spark-gap.png` | 128 x 48 | 0.5, 1 | none | 4 (32 x 48) | machine layer `mid`, depth 26 | Four-frame spark gap sheet: two electrodes with a flickering discharge between them. |
| `machine.transformer` | `machine/era2/transformer.png` (tiers t2 `machine/tiers/transformer-t2.png`, t3 `machine/tiers/transformer-t3.png`, t4 `machine/tiers/transformer-t4.png`, t5 `machine/tiers/transformer-t5.png` + pulse `machine/tiers/transformer-t5b.png`) | 64 x 64 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Transformer tank with a primary and a bushing lug on its top. |
| `machine.cableMast` | `machine/era2/cable-mast.png` | 16 x 112 | 0.5, 1 | none | none | machine layer `back`, depth 0 | Tall steel mast with a cable head at the top that carries the line to the pylons. |
| `machine.generatorGlow` | `machine/legacy/generator-glow.png` | 384 x 64 | 0.5, 0.5 | none | 4 (96 x 64) | machine layer `mid`, depth 24 | Four-frame EE gauge overlay laid 1:1 on the generator (frame = EE/s level): field-coil turn gaps, armature air-gap ring, terminal caps and brush sparks light cyan; everything stays inside the generator silhouette except the level-3 brush sparks, which rise up to 2 px above the terminal caps; drawn under the belt and the generator pulley. |

### Machine — Era III

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `machine.boiler` | `machine/era3/boiler.png` | 128 x 96 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Riveted pressure boiler drum on a cradle, with a steam outlet at the top and a feed port on the left. |
| `machine.chimney` | `machine/era3/chimney.png` | 32 x 160 | 0.5, 1 | none | none | machine layer `mid`, depth 21 | Tall riveted smokestack with a flared cap and a collar at its foot. |
| `machine.steamManifold` | `machine/era3/steam-manifold.png` | 96 x 14 | 0.5, 1 | none | none | machine layer `back`, depth 2 | Flat steam manifold header with three branch stubs and a port at its left end. |
| `machine.gauge` | `machine/era3/gauge.png` | 24 x 24 | 0.5, 1 | none | none | machine layer `mid`, depth 22 | Round pressure gauge dial with a bezel and tick marks, without its needle. |
| `machine.gaugeNeedle` | `machine/era3/gauge-needle.png` | 600 x 24 | 0.5, 1 | none | 25 (24 x 24) | machine layer `mid`, depth 23 | Twenty-five frame sheet of the gauge needle, one needle angle per frame from zero to full scale. |
| `machine.fireGlow1` | `machine/era3/firebox-1.png` (tiers t2 `machine/tiers/firebox-1-t2.png`) | 96 x 24 | 0.5, 0.5 | none | 4 (24 x 24) | machine layer `mid`, depth 22 | Four-frame firebox glow sheet, first stage: a dull ember behind the fire door. |
| `machine.fireGlow2` | `machine/era3/firebox-2.png` | 96 x 24 | 0.5, 0.5 | none | 4 (24 x 24) | machine layer `mid`, depth 23 | Four-frame firebox glow sheet, second stage: a brighter fire behind the fire door. |
| `machine.fireGlow3` | `machine/era3/firebox-3.png` (tiers t5 `machine/tiers/firebox-3-t5.png`) | 96 x 24 | 0.5, 0.5 | none | 4 (24 x 24) | machine layer `mid`, depth 24 | Four-frame firebox glow sheet, third stage: a white-hot fire behind the fire door. |
| `machine.inductionHeater` | `machine/era3/induction-heater.png` (tiers t2 `machine/tiers/induction-heater-t2.png`, t3 `machine/tiers/induction-heater-t3.png`, t4 `machine/tiers/induction-heater-t4.png`, t5 `machine/tiers/induction-heater-t5.png` + pulse `machine/tiers/induction-heater-t5b.png`) | 56 x 40 | 0.5, 1 | none | none | machine layer `mid`, depth 25 | Induction heater coil housing on a small plinth with a cable tie on its side. |
| `machine.superheater` | `machine/era3/superheater.png` | 40 x 32 | 0.5, 1 | none | none | machine layer `mid`, depth 22 | Superheater drum with a tube bundle and a glowing outlet collar. |
| `machine.reliefValves` | `machine/era3/relief-valves.png` | 16 x 24 | 0.5, 1 | none | none | machine layer `mid`, depth 22 | Pair of spring-loaded relief valves on a short stand, capped with vent hoods. |
| `machine.steamHammer` | `machine/era3/steam-hammer.png` | 48 x 96 | 0.5, 1 | none | none | machine layer `mid`, depth 21 | Steam hammer housing with a cylinder, a steam inlet on its side and a guide column below. |
| `machine.hammerRam` | `machine/era3/hammer-ram.png` | 12 x 36 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Hammer ram: a short iron piston with a flat striking face at its foot. |
| `machine.condenser` | `machine/era3/condenser.png` (tiers t2 `machine/tiers/condenser-t2.png`, t3 `machine/tiers/condenser-t3.png`, t4 `machine/tiers/condenser-t4.png`, t5 `machine/tiers/condenser-t5.png` + pulse `machine/tiers/condenser-t5b.png`) | 80 x 24 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Long condenser tank on feet with a condensate port at its right end. |
| `machine.turbine` | `machine/era3/turbine.png` | 80 x 64 | 0.5, 1 | none | none | machine layer `mid`, depth 21 | Turbine casing with a steam inlet on the left and an export cable terminal on the right. |
| `machine.turbineRotor` | `machine/era3/turbine-rotor.png` | 28 x 28 | 0.5, 0.5 | none | rot 64 (`machine/era3/rot/turbine-rotor-rot.png`) | machine layer `mid`, depth 22 | Turbine rotor seen face-on, a bladed wheel on a hub. |
| `machine.bellows` | `machine/legacy/bellows.png` (tiers t2 `machine/tiers/bellows-t2.png`, t3 `machine/tiers/bellows-t3.png` + pulse `machine/tiers/bellows-t3b.png`) | 240 x 28 | 0.5, 1 | none | 4 (60 x 28) | machine layer `front`, depth 30 | Four-frame great forge bellows (open, half, closed, half) on two iron legs; the boards hinge at the iron snout and the nozzle (texture 59, rows 16..17) feeds the hose to the boiler tuyere. |

### Machine — Era IV

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `machine.spireTower` | `machine/era4/spire-tower.png` | 80 x 320 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Lattice resonator tower on a squat base, tapering to a bare mast at the top. |
| `machine.spireExciter` | `machine/era4/spire-exciter.png` | 24 x 32 | 0.5, 1 | none | none | machine layer `mid`, depth 22 | Small steam exciter housing on the tower foot with a steam inlet on its left side. |
| `machine.spireWave` | `machine/era4/spire-wave.png` (tiers t2 `machine/tiers/spire-wave-t2.png`, t3 `machine/tiers/spire-wave-t3.png`, t4 `machine/tiers/spire-wave-t4.png`, t5 `machine/tiers/spire-wave-t5.png`) | 128 x 270 | 0.5, 1 | none | 8 (16 x 270) | machine layer `mid`, depth 21 | Eight-frame standing wave sheet: a thin vibrating rod shown at one phase per frame. |
| `machine.coilRing1` | `machine/era4/coil-ring-1.png` (tiers t2 `machine/tiers/coil-ring-1-t2.png`) | 248 x 8 | 0.5, 0.5 | none | 4 (62 x 8) | machine layer `mid`, depth 23 | Four-frame toroidal coil ring, widest of the four stacked windings. |
| `machine.coilRing2` | `machine/era4/coil-ring-2.png` | 192 x 8 | 0.5, 0.5 | none | 4 (48 x 8) | machine layer `mid`, depth 23 | Four-frame toroidal coil ring, second winding up the tower. |
| `machine.coilRing3` | `machine/era4/coil-ring-3.png` | 144 x 8 | 0.5, 0.5 | none | 4 (36 x 8) | machine layer `mid`, depth 23 | Four-frame toroidal coil ring, third winding up the tower. |
| `machine.coilRing4` | `machine/era4/coil-ring-4.png` | 120 x 8 | 0.5, 0.5 | none | 4 (30 x 8) | machine layer `mid`, depth 23 | Four-frame toroidal coil ring, narrowest winding at the top of the coil. |
| `machine.calliope` | `machine/era4/calliope.png` (tiers t2 `machine/tiers/calliope-t2.png`, t3 `machine/tiers/calliope-t3.png`, t4 `machine/tiers/calliope-t4.png`, t5 `machine/tiers/calliope-t5.png` + pulse `machine/tiers/calliope-t5b.png`) | 72 x 40 | 0.5, 1 | none | none | machine layer `back`, depth 3 | Calliope: a row of three steam whistles on a brass-trimmed manifold box. |
| `machine.servoBase` | `machine/era4/servo-base.png` (tiers t2 `machine/tiers/servo-base-t2.png`, t3 `machine/tiers/servo-base-t3.png` + pulse `machine/tiers/servo-base-t3b.png`) | 28 x 20 | 0.5, 1 | none | none | machine layer `mid`, depth 23 | Low servo gearbox housing with a bolted foot and an empty hub seat on top. |
| `machine.servoArm` | `machine/era4/servo-arm.png` (tiers t2 `machine/tiers/servo-arm-t2.png` + rot `machine/tiers/rot/servo-arm-t2-rot.png`, t3 `machine/tiers/servo-arm-t3.png` + rot `machine/tiers/rot/servo-arm-t3-rot.png`) | 48 x 48 | 0.5, 0.5 | none | rot 80 (`machine/era4/rot/servo-arm-rot.png`) | machine layer `front`, depth 33 | Servo arm seen face-on: a hub, a toothed arm and a pin boss that the coupling rod hooks onto. |
| `machine.koenigFork` | `machine/era4/koenig-fork.png` | 88 x 44 | 0.5, 1 | none | 4 (22 x 44) | machine layer `mid`, depth 20 | Four-frame Koenig tuning fork sheet, the tines swinging as it rings. |
| `machine.emitterDish` | `machine/era4/emitter-dish.png` | 40 x 64 | 0.5, 0.5 | none | none | machine layer `mid`, depth 24 | Parabolic emitter dish on a yoke, facing outward from the tower. |
| `machine.dishWaves` | `machine/era4/dish-waves.png` | 240 x 64 | 0.5, 0.5 | none | 6 (40 x 64) | machine layer `mid`, depth 24 | Six-frame sheet of the rings of wave light that leave an emitter dish. |
| `machine.crystal` | `machine/era4/crystal.png` | 128 x 48 | 0.5, 1 | none | 4 (32 x 48) | machine layer `mid`, depth 24 | Four-frame quartz crystal sheet seated in the crown, one glow level per frame. |
| `machine.exciterFeed` | `machine/legacy/exciter-feed.png` (tiers t2 `machine/tiers/exciter-feed-t2.png`, t3 `machine/tiers/exciter-feed-t3.png` + pulse `machine/tiers/exciter-feed-t3b.png`) | 16 x 28 | 0.5, 1 | none | none | machine layer `mid`, depth 23 | Cyan glass insulator on a riveted terminal box with a copper strap into the spire exciter; the cable lug is the cap (texture 10,1). |

### Machine — Era V

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `machine.nullGallery` | `machine/era5/null-gallery.png` | 128 x 30 | 0.5, 1 | none | none | machine layer `mid`, depth 23 | Low gallery rail under the null chamber, a bare steel ledge with a pale edge. |
| `machine.nullChamber` | `machine/era5/null-chamber.png` (restored `machine/era5/restored/null-chamber.png`) | 128 x 116 | 0.5, 1 | none | none | machine layer `mid`, depth 25 | Null chamber: a riveted lantern housing on the spire with two yoke eyes on its flanks. |
| `machine.nullCore` | `machine/era5/null-core.png` (restored `machine/era5/restored/null-core.png`, `machine/era5/restored/rot/null-core-rot.png`) | 64 x 64 | 0.5, 0.5 | none | rot 64 (`machine/era5/rot/null-core-rot.png`) | machine layer `mid`, depth 27 | Null core seen face-on: a dark sphere with a faint rim, turned by the exotic flux. |
| `machine.nullCoreGlint` | `machine/era5/null-core-glint.png` (restored `machine/era5/restored/null-core-glint.png`) | 64 x 64 | 0.5, 0.5 | none | none | machine layer `mid`, depth 28 | Specular glint laid over the null core, a single pale highlight on the sphere. |
| `machine.ring1Back` | `machine/era5/ring1-back.png` (restored `machine/era5/restored/ring1-back.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 26 | First containment ring, back half: the arc that passes behind the core. |
| `machine.ring2Back` | `machine/era5/ring2-back.png` (restored `machine/era5/restored/ring2-back.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 26 | Second containment ring, back half: the arc that passes behind the core. |
| `machine.ring3Back` | `machine/era5/ring3-back.png` (restored `machine/era5/restored/ring3-back.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 26 | Third containment ring, back half: the arc that passes behind the core. |
| `machine.ring4Back` | `machine/era5/ring4-back.png` (restored `machine/era5/restored/ring4-back.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 26 | Fourth containment ring, back half: the outermost arc that passes behind the core. |
| `machine.ring1Front` | `machine/era5/ring1-front.png` (restored `machine/era5/restored/ring1-front.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 29 | First containment ring, front half: the arc that crosses in front of the core. |
| `machine.ring2Front` | `machine/era5/ring2-front.png` (restored `machine/era5/restored/ring2-front.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 29 | Second containment ring, front half: the arc that crosses in front of the core. |
| `machine.ring3Front` | `machine/era5/ring3-front.png` (restored `machine/era5/restored/ring3-front.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 29 | Third containment ring, front half: the arc that crosses in front of the core. |
| `machine.ring4Front` | `machine/era5/ring4-front.png` (restored `machine/era5/restored/ring4-front.png`) | 112 x 72 | 0.5, 0.5 | none | none | machine layer `mid`, depth 29 | Fourth containment ring, front half: the outermost arc that crosses in front of the core. |
| `machine.ringBead` | `machine/era5/ring-bead.png` (restored `machine/era5/restored/ring-bead.png`) | 5 x 5 | 0.5, 0.5 | none | none | machine layer `mid`, depth 26 | Five-pixel bead that rides a containment ring. |
| `machine.siphonTube` | `machine/era5/siphon-tube.png` (restored `machine/era5/restored/siphon-tube.png`) | 12 x 30 | 0.5, 1 | none | none | machine layer `mid`, depth 24 | Narrow glass siphon tube standing on the gallery, one of six in pairs. |
| `machine.siphonArcs1` | `machine/era5/siphon-arcs-1.png` (restored `machine/era5/restored/siphon-arcs-1.png`) | 512 x 64 | 0.5, 0.5 | none | 4 (128 x 64) | machine layer `mid`, depth 28 | Four-frame resonance arc sheet for the first siphon pair, arcs flickering between the tubes. |
| `machine.siphonArcs2` | `machine/era5/siphon-arcs-2.png` (restored `machine/era5/restored/siphon-arcs-2.png`) | 512 x 64 | 0.5, 0.5 | none | 4 (128 x 64) | machine layer `mid`, depth 28 | Four-frame resonance arc sheet for the second siphon pair, arcs flickering between the tubes. |
| `machine.siphonArcs3` | `machine/era5/siphon-arcs-3.png` (restored `machine/era5/restored/siphon-arcs-3.png`) | 512 x 64 | 0.5, 0.5 | none | 4 (128 x 64) | machine layer `mid`, depth 28 | Four-frame resonance arc sheet for the third siphon pair, arcs flickering between the tubes. |
| `machine.graviticAnchor` | `machine/era5/gravitic-anchor.png` | 32 x 128 | 0.5, 1 | none | none | machine layer `mid`, depth 20 | Gravitic anchor pile driven into the sand, with a guy eye at its head. |
| `machine.anchorGlow1` | `machine/era5/anchor-glow-1.png` (restored `machine/era5/restored/anchor-glow-1.png`) | 128 x 128 | 0.5, 1 | none | 4 (32 x 128) | machine layer `mid`, depth 21 | Four-frame glow sheet for the first gravitic anchor stage, a faint halo along the pile. |
| `machine.anchorGlow2` | `machine/era5/anchor-glow-2.png` (restored `machine/era5/restored/anchor-glow-2.png`) | 128 x 128 | 0.5, 1 | none | 4 (32 x 128) | machine layer `mid`, depth 21 | Four-frame glow sheet for the second gravitic anchor stage, a brighter halo along the pile. |
| `machine.anchorGlow3` | `machine/era5/anchor-glow-3.png` (restored `machine/era5/restored/anchor-glow-3.png`) | 128 x 128 | 0.5, 1 | none | 4 (32 x 128) | machine layer `mid`, depth 21 | Four-frame glow sheet for the third gravitic anchor stage, the strongest halo along the pile. |
| `machine.inversionGhost` | `machine/era5/inversion-ghost.png` (restored `machine/era5/restored/inversion-ghost.png`, `machine/era5/restored/rot/inversion-ghost-rot.png`) | 48 x 48 | 0.5, 0.5 | none | rot 80 (`machine/era5/rot/inversion-ghost-rot.png`) | machine layer `mid`, depth 29 | Inversion ghost: a faint mirrored copy of the hand crank that trails the real crank. |
| `machine.lensLight` | `machine/era5/lens-light.png` (restored `machine/era5/restored/lens-light.png`) | 128 x 48 | 0.5, 1 | none | 4 (32 x 48) | machine layer `mid`, depth 21 | Four-frame lens light sheet: a pale beam source at the lens base, flickering per frame. |
| `machine.lensColumn` | `machine/era5/lens-column.png` | 32 x 48 | 0.5, 1 | none | none | machine layer `mid`, depth 23 | Lens column: a tall glass tube that gathers the core into one line. |
| `machine.aperture` | `machine/era5/aperture.png` (restored `machine/era5/restored/aperture.png`) | 384 x 28 | 0.5, 1 | none | 6 (64 x 28) | machine layer `mid`, depth 23 | Six-frame aperture sheet: a crown shutter that opens one leaf per frame toward the sky. |
| `machine.backfeedTerminal` | `machine/legacy/backfeed-terminal.png` (tiers t2 `machine/tiers/backfeed-terminal-t2.png`, t3 `machine/tiers/backfeed-terminal-t3.png` + pulse `machine/tiers/backfeed-terminal-t3b.png`) | 16 x 28 | 0.5, 0 | none | none | machine layer `mid`, depth 24 | Suspension string under the null gallery deck: hanger plate with a violet lead-in bushing, four cyan glass discs, conductor clamp and copper jumper; the cable lug is the bottom cap (texture 8,26). |
| `machine.steamLance` | `machine/legacy/steam-lance.png` (tiers t2 `machine/tiers/steam-lance-t2.png`, t3 `machine/tiers/steam-lance-t3.png` + pulse `machine/tiers/steam-lance-t3b.png`) | 16 x 32 | 0.5, 0 | none | none | machine layer `mid`, depth 25 | Steam lance valve hung under the null gallery deck: mount plate, globe valve with a rust handwheel, flanged inlet at the bottom (texture 8,32). |

### FX

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `fx.dust` | none (procedural) | 4 x 4 | 0.5, 0.5 | none | none | dust field (DUST), world depth 200 | Single dust mote particle drifting over the wasteland. |
| `fx.steam` | `fx/steam.png` | 16 x 16 | 0.5, 0.5 | none | none | reserved: no renderer (live steam uses fx.steamPuff / fx.smoke) | Steam puff particle released by working pistons. |
| `fx.steamPuff` | `fx/steam-puff.png` | 64 x 16 | 0.5, 0.5 | none | 4 (16 x 16) | steam emitters (STEAM_EMITTERS), world depth 101 | Four-frame steam puff sheet, a pale cloud that grows and thins as it rises. |
| `fx.smoke` | `fx/smoke.png` | 64 x 16 | 0.5, 0.5 | none | 4 (16 x 16) | chimney smoke (STEAM_EMITTERS), world depth 101 | Four-frame dark smoke puff sheet, used for the boiler chimney. |
| `fx.beam` | `fx/beam.png` | 64 x 32 | 0.5, 1 | none | 4 (16 x 32) | aperture beam (APERTURE_BEAM), world depth 101 | Four-frame aperture beam tile: a pale vertical shaft of light, one 16-px slice per frame. |
| `fx.beamWhite` | `fx/beam-white.png` | 64 x 32 | 0.5, 1 | none | 4 (16 x 32) | finale white beam (FINALE_BEAM) | Four-frame white beam tile: the pale light shaft of the finale, one 16-px slice per frame. |
| `fx.seed` | `fx/seed.png` | 32 x 8 | 0.5, 0.5 | none | 4 (8 x 8) | finale seeds (FINALE_SEEDS), world depth 200 | Four-frame seed mote drifting over the restored ground; one 8-px cell per frame. |
| `fx.bird` | `fx/bird.png` | 16 x 5 | 0.5, 0.5 | none | 2 (8 x 5) | finale birds (FINALE_BIRDS) | Two-frame bird silhouette (wing up / down) for the flocks over the restored world. |

### UI

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `ui.nameplate` | `ui/nameplate.png` | 136 x 24 | 0, 0 | none | none | DOM UI (CSS background image) | Finale nameplate, drawn once and shown three times in the top-left corner (ART_ERA5 §10). |
| `ui.panel` | `ui/panel.png` | 24 x 24 | 0, 0 | none | none | DOM UI (CSS background image) | Nine-slice terminal panel frame for the finale overlay (ART_ERA5 §8). |
| `ui.button` | `ui/button.png` | 72 x 24 | 0, 0 | none | 3 (24 x 24) | DOM UI (CSS background image) | Three-frame finale button sheet, 24-px cells (ART_ERA5 §8). |
| `ui.icons16` | `ui/icons16.png` | 80 x 16 | 0, 0 | none | 5 (16 x 16) | DOM UI (CSS background image) | Five 16-px icons for the finale buttons (ART_ERA5 §8). |
<!-- asset-table:end -->

Regenerate the table: `ASSET_GUIDE_OUT=<abs path> npx vitest run src/assets/assetGuide.test.ts` writes this block to
`<abs path>`; paste it between the markers. The same test fails if a row is missing or wrong.

Layer/depth sources: `src/data/world.ts` (`PARALLAX_LAYERS`, `GROUND_LAYER`, `DUST.depth`, `DEPTH`) and
`src/data/machineComponents.ts` (`MACHINE_LAYER_DEPTH`, component `layer`).

Parallax art below its ground line must match the layer `underfill` in `PARALLAX_LAYERS` (`src/data/world.ts`), or a flat band shows whenever the camera sits above its default height: `bg.mountains` rows 156-255 are a far-plain ramp ending in `#5f5244` (= underfill `0x5f5244`); `bg.skyline` rows 220-319 are transparent (underfill `null`); `bg.mountainsRestored` / `bg.skylineRestored` keep their green fields (underfill `green0` / `green1`).

## Rendering

- Scale: `PIXEL_SCALE = 2` (`src/data/world.ts`), one art px = two world px.
- Nearest-neighbour: `pixelArt: true` and `roundPixels: true` in `src/game/bootstrap.ts`. Procedural textures
  are also set to `NEAREST` in `fallbackTextures.ts`.
- Side view, light from upper-left (see Palette and style).
- Pivot: `origin` in the manifest is the sprite pivot. Machine parts take their pivot from `MACHINE_COMPONENTS`,
  whose `size` must equal the manifest dims of `assetId`.

## Replacing an existing asset

1. Export the PNG at exactly the manifest `width` x `height` (crop/pad, never resample). Keep the pivot rule from the brief.
2. Drop it at `public/assets/<file>` (the path in the table above).
3. In `src/assets/manifest.ts`, set the entry's `file` (only needed for `file: null` entries). Keep `width`, `height`
   and `origin` unchanged.
4. Run `npm run dev`, open the game, and check the browser console: no `[assets] failed to load` and no
   `[assets] size mismatch` warning for the id.
5. Run `npm test` (manifest tests check file presence and dims).

## Spritesheets

- Add `frame: { width, height, count }` to the manifest entry. `planAssetLoads` then loads the asset as a
  spritesheet with `frameWidth`/`frameHeight` set from `frame`. No BootScene change is needed.
- `width` x `height` in the manifest must be the full sheet size in px, because the size check compares the
  whole source image.
- Frames are read left to right, then top to bottom. Sheet width must be a multiple of `frame.width`.
  `count` is the number of frames present.
- Frame counts are load-bearing: a machine component with `ComponentAnimation` kind `frames` in
  `src/data/machineComponents.ts` must use `frames` equal to the manifest `frame.count` of its `assetId`.

**Era-row sheets (`eraRows`, WP23a).** The living-world sheets (`world.*`) stack one row per era variant: row order
I, II, III, IV, V, whole. The manifest sets `eraRows: 6` next to `frame`; `height = frame.height * eraRows`,
`frame.count = (width / frame.width) * eraRows`, and the frame index is `row * columns + column` with
`columns = width / frame.width`. Frame names belong in data (`src/data/livingWorld.ts`), never in render code by
magic index. `src/assets/manifest.test.ts` (WP23a) checks the arithmetic and `src/assets/worldSheets.test.ts` is the
PNG gate (8-bit RGBA, size, alpha 0 or 255, palette only).

### RotSprite sheets

- Manifest `rotation: { file, frames }` (file under `public/assets/`): a pre-rendered RotSprite rotation sheet of
  `frames` frames.
- Texture key `<id>#rot` (`ROT_SUFFIX` in `src/assets/manifest.ts`). The sheet is a grid; each frame is the entry
  `width` x `height`.
- Generated by `scripts/art/make_rot.py`: `python scripts/art/make_rot.py OUT_DIR [SRC_DIR] [PARTS_JSON]`.
- The gear sheets keep the 1.75 ratio: `machine.gearSmall` 80 frames, `machine.gearLarge` 140 frames (140 / 80 = 1.75),
  so meshed gears stay in step.

## Fallbacks and warnings

- `file: null` entries are always procedural. Fallback textures are generated at the manifest size.
- If a file fails to load, Phaser raises the load error and `BootScene` logs
  `[assets] failed to load <key> <url>` (console warning). The procedural texture for that id is generated
  instead and the game keeps running.
- `PAINTERS` in `src/assets/fallbackTextures.ts` (plus `ERA2_PAINTERS`, `LEGACY_PAINTERS` and `WORLD_PAINTERS`); every other id uses `paintGenericPlate`.
- WP17 legacy feed parts (`machine.generatorGlow`, `machine.bellows`, `machine.exciterFeed`, `machine.backfeedTerminal`,
  `machine.steamLance`) use `LEGACY_PAINTERS` in `src/assets/painters/legacy.ts`.
  Since A17 these ids have PNGs (`machine/legacy/`); the painters are only the load-failure fallback and approximate the art
  (older, smaller geometry inside the larger A17 textures).
- Generated ids are logged once: `[assets] generated fallback textures: <ids>`.

## A17 art sources and restored variants

- `scripts/art/a17/build.py` regenerates `machine/legacy/*.png` (hand-pixelled, locked palette, alpha 0/255) and stamps the
  tuyere collar on `machine/era3/boiler.png` (rows 72..74, cols 97..102). Rerun after any change to `era2/generator.png`
  (the glow is laid 1:1 on it).
- `scripts/art/a17/restored.py` writes `machine/era5/restored/` (+ `restored/rot/`): the postgame "restored machine" accent,
  a per-pixel palette swap of the era V energy sprites (null core inverted to a warm lit core; glint, beads, lens light warm;
  rings, arcs, siphon fluid, anchor glows, inversion ghost, aperture horns and chamber violet pixels pale steam-white).
  Same sizes, frames and rotation sheets as the originals (22 files + 2 rot sheets, about 52 KB). Wired by WP18b, see below.

### Restored variants (WP18b)

- Manifest: `AssetEntry.restored?: { file; rotationFile? }` on the 22 era V energy ids (null chamber, core, glint, ring halves, bead, siphon tube and arcs, anchor glows, inversion ghost, lens light, aperture). Paths are under `public/assets/`.
- Texture keys: `<id>#restored` and, with `rotationFile`, `<id>#restored#rot`. `planAssetLoads` emits them right after the original and `#rot` loads; `BootScene` loads them at boot (24 extra loads, about 52 KB). A variant has the same size, frame layout and rotation layout as the original; `src/assets/manifest.test.ts` enforces the PNG sizes.
- Trigger: `MachineAnimator.setFinale` moves the parts that have a variant onto their `#restored` textures when the finale frame `restored` flag turns true (name-plate beat at t 30 of the ending sequence, choice, postgame, and a reload into choice or postgame), and back when it turns false (seek back below t 30, menu reset, new cycle). The swap is instant in every motion mode. `ShowcaseScene` (the teaser) never swaps.
- A variant that is missing or failed to load keeps the original texture; there is no painter fallback for restored keys.
- Regenerate the PNGs with `python -I scripts/art/a17/restored.py`.
- Add a variant for another id: put the PNG (same size) under `<dir>/restored/`, add `restored: { file }` to its manifest entry, add a row to the restored table in `src/assets/manifest.test.ts`. No code change.

## Part evolution tiers (WP22)

Repeatable part tracks evolve through 3 or 5 tiers (MK I-V) as their tech level rises. A tier is a rendering-only view of
tech levels: no save field, no simulation change. Design: `docs/plan/PART_TIERS.md`; build contract: `docs/plan/WP22.md`.
MK I is always the shipped file; tier art adds variants, never edits the shipped PNG.

### Ladders

| tier | 5-step name | 3-step name | material | silhouette | light |
|---|---|---|---|---|---|
| MK I | SALVAGED | SALVAGED | shipped art: clustered rust, caked dust, odd bolts | as found | none |
| MK II | PATCHED | REINFORCED (3-step: patch + band merged) | bright rust flakes knocked back to iron, stains stay low, riveted patch plates (`#5a5f63` / `#7d8286` / rivets `#a3a6a4`), new bright bolts | +1 small bolt-on | none |
| MK III | REINFORCED | AS BUILT (3-step: finish + lamp + heartbeat merged) | rust 0 outside identity marks, dust cleaned, machined lit edges | +1 structural element that reads at 1 px (band, gusset, strap, radiator, saddle) | none |
| MK IV | TUNED | - | iron straps become brass hoops (rust ramp in clean straight bands, `#ffd27a` glint), plates re-enamelled (`#c9b28a`), small `#d9822b` hazard mark on a moving or live guard | +1 instrument or cover (cowl, sight glass, oiler, valve wheel) | brass glint |
| MK V | AS BUILT | - | flawless, polished top edges, 1 px warm seam (`#d9822b` with a `#f0a848` core) | +pilot lamp (3x3 `#ffd27a` core, `#f0a848` cross, `#d9822b` corners, ink ring) | heartbeat |

- The top tier always carries the warm accent: a lamp on static parts, a brass glint ring on rotating parts.
- MK V never uses green or blue, regrowth tones or `RESTOR` text (store-shot `no_spoiler`).
- Brass is the rust ramp in clean straight bands; rust is patches. Brass from MK IV on does not count as rust in G1.

### Gates (every variant; `scripts/art/tiers/check_gates.py` machine-checks G1-G3, the pulse and decal rules)

| gate | rule |
|---|---|
| G1 step | the track's tier changes at least 4 px of silhouette, structure, brass or accent (all its hosts plus decal px); MK II keeps at least 30 % less MK I rust; MK III keeps 0 MK I rust outside identity marks |
| G2 identity | every opaque MK I px stays opaque; outline, mounting points and identity marks stay (motor: nameplate footprint, shaft, feet). Waived only for the procedural spire wave (its waveform is redrawn per mode) |
| G3 contract | same canvas, origin, frame count and frame layout; alpha 0 or 255; palette = Rust Wasteland plus the era extension colours the MK I file already uses or the host spec names (fire glow 3 steam white `#e8e0cc`, condenser sight-glass cyan ramp; decals: Rust Wasteland only); reserved zones gain no px (table below); rot sheets keep the shipped sheet's alpha exactly |
| G4 craft | `pixelart_workbench lint` 0 errors; `score` at or above the MK I score minus 3 (rot sheets measured on the real sheet; sheets over the workbench limits on frame-aligned tiles) |
| G5 scale | every step reads at zoom 0.5 (1 screen px per art px) in the era where it is usually reached, judged on a real screenshot crop (`composite_*.py`), not only at 4x |

### Rotating hosts and decals

- Rotating hosts (gears, main pulley, flywheel, flywheel and crank pulleys, servo arm) change by exact per-pixel palette
  maps applied to the static PNG and to the shipped rot sheet (DERUST-LIGHT, DERUST-FULL, POLISH; PART_TIERS 2.3). The sheet
  is never re-rotated, so frame counts and the 80 / 140 and 180 / 180 ratio locks stay as shipped.
- A static decal over a spinning part must be rotationally symmetric: rims, rings, plain discs, a centred lamp. No bolts,
  spokes or text. Its fixed upper-left highlight is physically right on a turning wheel. Every decal px lies over a px the
  host keeps opaque in all rot frames and in its static PNG; the mask is symmetric under 90 degree turns and mirrors.
- Decals draw in the host's layer at host depth + bias: `machine.gearRim` on gearLarge from MK III (+0.5),
  `machine.flywheelRim2` on the flywheel from MK II (+0.5), `machine.flywheelRim3` from MK III (+0.6, over rim 2). Belts,
  links and parts in front of the host still cover the decal; a decal never covers a belt. There is no hub decal: the
  pulley and crank cover the hubs.

### Reserved zones (texture px; G3, no new opaque px; "keep" = px stay exactly as MK I because a link attaches there)

| host | reserved / keep |
|---|---|
| worn motor | x23-43 rows 0-7 (retrofit kit), x52-63 (pulley and belt), rows 41-47 (plinth); identity: nameplate x24-37 rows 18-25 |
| motor retrofit kit | x0-12 rows 0-4; stays inside its 32x16 and never covers more of the motor |
| flywheel pedestal | rows 0-38 (behind the flywheel disc and hub pulley) |
| coils 3 | new px only over the generator body |
| piston block | plunger rod columns x18-21, x46-49, x74-77 rows 36-45 (the yoke rods run behind the block) |
| transformer | x0-15 rows 0-20 (left bushing cable), x49-63 rows 0-4 (right bushing cable) |
| induction heater | keep the tie insulator x50-55 rows 0-5; new px only over the boiler |
| condenser | keep the hotwell nozzle x76-79 rows 0-13 |
| bellows | keep the nozzle tip x59 rows 15-18 (hose link); new px only over the boiler |
| exciter feed | keep the cable lug rows 0-1 |
| calliope | the three manifold ports: x0-14, x28-41, x58-71 rows 37-39 |
| servo base | keep the breather cap x17-20 rows 0-2; the arm hub covers x9-18 rows 5-14 (nothing new drawn there) |
| spire wave | columns 0-1 and 14-15 of every frame (the wave stays inside the rod column) |
| backfeed terminal | rows 24-27 (cable lug and the cable leaving it); keep the bushing px (12, 1) and x6-9 rows 25-27 |
| steam lance | keep the inlet pipe x4-11 rows 27-31 (link at (8, 32)); x12-15 rows 24-31 (lance puff start) |
| rot hosts, decals | alpha unchanged (palette maps only); decals stay over opaque host px |

Every host also keeps other parts' sockets, belt and cable paths and `MACHINE_BOUNDS` clear.

### Files and manifest wiring

- Files under `public/assets/machine/tiers/`: `<stem>-t<N>.png`; rot sheets `rot/<stem>-t<N>-rot.png`; heartbeat low
  frames `<stem>-t<N>b.png`; decals `decals/<name>.png`. `<stem>` is the entry's own file stem (`machine.motor` ->
  `worn-motor`, `machine.pedestal` -> `flywheel-pedestal`).
- Manifest: `tiers?: readonly { from; file; rotationFile?; pulseFile? }[]` on the host entry. `from` = tier number 2..5,
  strictly ascending. Variants may be sparse: the resolver shows the highest declared tier at or below the current one,
  else the base (`machine.coils1` only t2, `machine.coils3` only t5, `machine.fireGlow1` t2, `machine.fireGlow3` t5,
  `machine.coilRing1` t2, the flywheel set only t3).
- Texture keys: `<id>#t<N>`, `<id>#t<N>#rot` (`#rot` always last), `<id>#t<N>b`. `planAssetLoads` emits them after the
  entry's own, `#rot` and restored loads; everything loads at boot (WP22 T13 defers `#t*#rot` only if `bootMs` fails).
- A rotation entry's every tier carries both `file` (static, same palette map) and `rotationFile`. `rotationFile` only on
  entries with `rotation`. No entry has both `tiers` and `restored` (restored wins on restored ids).
- Heartbeat frame rule: `pulseFile` only on the asset's highest tier and never on a rotation entry. The frame has the same
  alpha as its tier; only warm accent px change, each one ramp step dimmer (`#ffd27a` -> `#f0a848` -> `#d9822b` ->
  `#8c4a2a`); a frame sheet dims the same px in every frame. All top-tier lamps alternate `#t<N>` / `#t<N>b` on one
  shared clock (`TIER_HEARTBEAT.periodMs` 2400 in `src/data/machineTiers.ts`), so every MK V part pulses in unison.
- Decals are their own ids (`machine.gearRim`, `machine.flywheelRim2`, `machine.flywheelRim3`); their load-failure
  fallback is a procedural annulus painter at the manifest size (WP22 T1b).
- `node scripts/art/tiers/check_wiring.mjs` checks that every PNG under `machine/tiers/` is referenced exactly once,
  every reference exists, the naming and pulse / rot rules, and the PNG sizes.

### Pipeline (`scripts/art/tiers/`, run from the repo root; Art Director only)

| method | hosts | tools |
|---|---|---|
| A scripted hand-pixel stamps | motor, plinth, retrofit kit, coils 1 / 3, fire glows 1 / 3, condenser, induction heater, servo base, exciter feed, backfeed terminal, steam lance, flywheel pedestal, bellows (4 frames), coil ring 1 (4 frames) | `<host>_tiers.py` char-grid edits of the shipped PNG (template `motor_tiers.py`), shared `tierlib.py` (locked palette, exact maps, PNG writer) |
| B PixelLab `edit_image` + snap + hand fix | transformer (radiator, fan), calliope (4th whistle), piston block (tie rods, hoops) only | block-in with method A first, then `pixellab_merge.py` (alpha cut, nearest locked-palette snap, hand correction). A generation is never shipped raw |
| C palette maps on rot sheets | gear large / small, main pulley, flywheel, flywheel pulley, crank pulley, servo arm | `palette_tiers.py` (clone of `scripts/art/a17/restored.py`; map applied to the PNG and its rot sheet, no re-rotation) |
| D procedural | spire wave modes 4-7 (8 frames) | `wave_tiers.py` (sin(n pi y / L) cos(wt) per frame; amplitude 5 sqrt(3 / n)) |
| E decals | gear rim, flywheel rims 2 / 3 | `decal_tiers.py` (pure annulus geometry) |

- Rebuild everything and run the gates: `python scripts/art/tiers/batch1.py --report <gates.md> --g4 <g4.json>`;
  gates alone: `python scripts/art/tiers/check_gates.py --report <out.md> --g4 <g4.json> [--notes <notes.md>]`.
- Review: `contact_tiers.py` / `contact_p1.py` (contact sheets), `composite_shot.py`, `composite_p1.py`,
  `composite_p1b.py`, `composite_p2.py`, `composite_host.py` (variants painted into a real 1280x720 shot at zoom 0.5 / 1
  only where the MK I px is visible, so parts in front keep covering them).
- Finalise with crop / pad only, never resample. `tierlib.png_bytes_best` writes each PNG as the smaller of an optimised
  RGBA and an optimised indexed encoding (both lossless; the indexed one is round-trip checked).

### Budget (AD4f, 91 PNGs)

- Bytes: 518,590 (506.4 KiB) of the 1,228,800 B cap for `machine/tiers/**`; `public/assets` 1724.0 KB as
  `bundle-budget.mjs` counts it (manual limit 2700, script gate 8000). Largest file: `rot/flywheel-t3-rot.png` 228,696 B.
- Decoded RGBA of the added textures (every PNG w x h x 4, frames included): 16.10 MiB, about 52.9 MiB total with the
  36.8 MiB baseline (target 56 MiB). The flywheel MK III rot sheet alone is 6.4 MiB.
- To shrink: re-save with optimal PNG compression or drop palette entropy; never resample or change a canvas.

## Size mismatch warning

If a loaded texture's source size differs from the manifest, `BootScene` logs (warning, never throws):

`[assets] size mismatch for <id> got <w>x<h>, manifest <w>x<h>`

Source (`src/game/scenes/BootScene.ts`): `console.warn('[assets] size mismatch for', id, \`got ${source.width}x${source.height}, manifest ${entry.width}x${entry.height}\`)`.

What to do:
- Preferred: re-export the PNG at the manifest size (crop/pad with transparency; do not scale).
- If the size is intentionally different: update `width`/`height` in the manifest, then also update every place that
  depends on them: `MachineComponentDefinition.size` for machine parts (must equal manifest dims), tile period for
  tileable backgrounds (period = width), and `docs/ASSET_GUIDE.md` table. Run `npm test` and `npm run typecheck`.

## Adding a new asset id

1. Add the id to `ASSET_IDS` in `src/assets/assetIds.ts`.
2. Add an entry to `ASSET_MANIFEST` in `src/assets/manifest.ts`. The `Record<AssetId, AssetEntry>` type makes
   typecheck fail until this exists.
3. Optional: add a painter to `PAINTERS` in `src/assets/fallbackTextures.ts`. Without one, the generic plate is used.
4. Add the PNG at `public/assets/<category>/<kebab-name>.png` and set `file`, or use `file: null` for procedural-only.
5. Use the id in a renderer (`src/game/`), then regenerate the table (command below); `assetGuide.test.ts` fails if a row is missing or wrong.
6. Run `npm run typecheck` and `npm test`.
