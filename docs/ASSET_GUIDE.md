# Asset Guide

How art is named, sized, rendered, replaced and falls back. Source of truth: `src/assets/assetIds.ts` (ids),
`src/assets/manifest.ts` (file, size, pivot, tiling, frames, description), `src/assets/fallbackTextures.ts`
(procedural painters), `src/game/scenes/BootScene.ts` (loading and warnings).

## Naming

- Every asset has an id `<category>.<name>` (camelCase name), listed in `ASSET_IDS`.
- Default file path: `public/assets/<category>/<kebab-name>.png`, so `machine.gearSmall` maps to
  `public/assets/machine/gear-small.png`.
- Categories in use: `bg`, `terrain`, `fx`, `machine`.
- The manifest `file` field (relative to `public/assets/`) is authoritative. Known exceptions to the default mapping:
  `machine.crank` -> `machine/hand-crank.png`, `machine.motor` -> `machine/worn-motor.png`,
  `machine.piston` -> `machine/piston-array.png`, `machine.frame` -> `machine/support-frame.png`.

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

| id | file (under `public/assets/`) | width x height | origin (pivot) | tileable | frames | layer + depth | description |
|---|---|---|---|---|---|---|---|
| `bg.sky` | none (`file: null`, procedural) | 1280 x 720 | 0.5, 0.5 (centre) | none | none | parallax sky, screen-fixed, world depth -100 | Hazy, desaturated sky with a bright haze band near 65% of the height. |
| `bg.mountains` | `bg/mountains.png` | 512 x 256 | 0, 1 (bottom-left) | x | none | parallax, scroll 0.15, world depth -90 | Far ridge with distant ruins; tiles horizontally, period = width, ground line at y=156. |
| `bg.skyline` | `bg/skyline.png` | 512 x 320 | 0, 1 (bottom-left) | x | none | parallax, scroll 0.3, world depth -80 | Ruined city skyline; tiles horizontally, period = width, ground line at y=220. |
| `bg.pylons` | `bg/pylons.png` | 256 x 256 | 0, 1 (bottom-left) | x | none | parallax, scroll 0.55, world depth -70 | Rusted pylons with sagging wires; tiles horizontally, period = width, ground line at y=156. |
| `terrain.ground` | `terrain/ground.png` | 256 x 128 | 0, 0 (top-left) | xy | none | ground layer, world depth 0 | Cracked sand ground tile that tiles in both directions. |
| `fx.dust` | none (`file: null`, procedural) | 4 x 4 | 0.5, 0.5 (centre) | none | none | dust field emitter, world depth 200; landing puffs at machine-local depth 31 | Single dust mote particle drifting over the wasteland. |
| `machine.frame` | `machine/support-frame.png` | 200 x 110 | 0.5, 1 (bottom-centre) | none | none | machine layer `frame`, depth 10 | Riveted, rusty support frame whose base sits on the ground line. |
| `machine.crank` | `machine/hand-crank.png` | 48 x 48 | 0.5, 0.5 (centre) | none | none | machine layer `front`, depth 30 | Hand crank with its hub at the centre; the player clicks it to work the machine. Slim crank arm with r5.5 boss and wooden knob at r≈18. |
| `machine.gearSmall` | `machine/gear-small.png` | 40 x 40 | 0.5, 0.5 (centre) | none | none | machine layer `mid`, depth 20 | Small toothed gear meshed into the drive train. Solid recessed web, teeth one value step lighter than the frame. |
| `machine.gearLarge` | `machine/gear-large.png` | 64 x 64 | 0.5, 0.5 (centre) | none | none | machine layer `mid`, depth 20 | Large reinforced toothed gear that slows and steadies the drive. Solid recessed web, teeth one value step lighter than the frame. |
| `machine.flywheel` | `machine/flywheel.png` | 96 x 96 | 0.5, 0.5 (centre) | none | none | machine layer `mid`, depth 20 | Heavy flywheel that stores momentum for the machine. |
| `machine.motor` | `machine/worn-motor.png` | 64 x 48 | 0.5, 0.5 (centre) | none | none | machine layer `mid`, depth 20 | Worn electric motor bolted to the frame, shaking as it runs. |
| `machine.piston` | `machine/piston-array.png` | 96 x 64 | 0.5, 1 (bottom-centre) | none | none | machine layer `back`, depth 0 | Piston array whose base sits at the bottom of the sprite, pumping up and down. |
| `machine.crankBrace` | `machine/crank-brace.png` | 48 x 48 | 0.5, 0.5 (centre) | none | none | machine layer `front`, depth 31 | Riveted doubler strap and bolted boss flange that overlay the hand crank. |
| `fx.steam` | `fx/steam.png` | 16 x 16 | 0.5, 0.5 (centre) | none | none | reserved: no renderer yet (steam effect is data only) | Steam puff particle released by working pistons. |
| `machine.generatorGlow` | `machine/legacy/generator-glow.png` (A17) | 384 x 64 | 0.5, 0.5 (centre) | none | 4 (96 x 64 cells) | machine layer `mid`, depth 24 (bias 4: over coil stage 3, under the belt and generator pulley at 25) | Four-frame EE gauge overlay laid 1:1 on `era2/generator.png` (frame = EE/s level): field-coil turn gaps, armature air-gap ring (r 8.6..10.4 round texture 52,49), terminal caps, level-3 brush sparks (inside the generator silhouette except the sparks, which rise up to 2 px above the terminal caps). |
| `machine.bellows` | `machine/legacy/bellows.png` (A17) | 240 x 28 | 0.5, 1 (bottom-centre) | none | 4 (60 x 28 cells: open, half, closed, half) | machine layer `front`, depth 30 | Great forge bellows in side elevation on two iron legs: sand-plank boards hinged at the iron snout, leather side with fold ribs, pole handle; nozzle core rows 16..17 at the right edge (texture 59) = the 2-bore hose to the boiler tuyere. |
| `machine.exciterFeed` | `machine/legacy/exciter-feed.png` (A17) | 16 x 28 | 0.5, 1 (bottom-centre) | none | none | machine layer `mid`, depth 23 | Cyan glass insulator (3 sheds) on a riveted terminal box, copper strap into the spire exciter's right flank (texture x 0); the cable lug is the cap (texture 10,1). |
| `machine.backfeedTerminal` | `machine/legacy/backfeed-terminal.png` (A17) | 16 x 28 | 0.5, 0 (top-centre) | none | none | machine layer `mid`, depth 24 | Suspension string hung under the null gallery deck: hanger plate with violet lead-in bushing, 4 cyan glass cap-and-pin discs, conductor clamp, copper jumper; the cable lug is the bottom cap (texture 8,26). |
| `machine.steamLance` | `machine/legacy/steam-lance.png` (A17) | 16 x 32 | 0.5, 0 (top-centre) | none | none | machine layer `mid`, depth 25 | Steam lance valve hung under the null gallery deck: bolted mount plate, globe valve with a face-on rust handwheel, flanged 4-bore inlet stub at the bottom (port texture 8,32) that the steam riser joins. |

Layer/depth sources: `src/data/world.ts` (`PARALLAX_LAYERS`, `GROUND_LAYER`, `DUST.depth`, `DEPTH`) and
`src/data/machineComponents.ts` (`MACHINE_LAYER_DEPTH`, component `layer`).

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
- Sprites are created without a frame index today (frame 0 shown). To animate, pass a frame index in the
  renderer code that creates the sprite.
- No entry uses frames yet.

## Fallbacks and warnings

- `file: null` entries are always procedural. Fallback textures are generated at the manifest size.
- If a file fails to load, Phaser raises the load error and `BootScene` logs
  `[assets] failed to load <key> <url>` (console warning). The procedural texture for that id is generated
  instead and the game keeps running.
- Dedicated painters: `bg.sky`, `bg.mountains`, `bg.skyline`, `bg.pylons`, `terrain.ground`, `fx.dust`,
  `machine.frame`, `machine.crank`, `machine.gearSmall`, `machine.gearLarge`. `machine.crankBrace` uses the gear
  painter (`paintGear`). All other ids use the generic rust
  plate with an X (`paintGenericPlate`): `machine.flywheel`, `machine.motor`, `machine.piston`, `fx.steam`.
- WP17 legacy feed parts (`machine.generatorGlow`, `machine.bellows`, `machine.exciterFeed`, `machine.backfeedTerminal`,
  `machine.steamLance`) use `LEGACY_PAINTERS` in `src/assets/painters/legacy.ts`.
  Since A17 these ids have PNGs (`machine/legacy/`); the painters are only the load-failure fallback and approximate the art
  (older, smaller geometry inside the larger A17 textures).
- Generated ids are logged once: `[assets] generated fallback textures: <ids>`.

## A17 art sources and inert variants

- `scripts/art/a17/build.py` regenerates `machine/legacy/*.png` (hand-pixelled, locked palette, alpha 0/255) and stamps the
  tuyere collar on `machine/era3/boiler.png` (rows 72..74, cols 97..102). Rerun after any change to `era2/generator.png`
  (the glow is laid 1:1 on it).
- `scripts/art/a17/restored.py` writes `machine/era5/restored/` (+ `restored/rot/`): the postgame "restored machine" accent,
  a per-pixel palette swap of the era V energy sprites (null core inverted to a warm lit core; glint, beads, lens light warm;
  rings, arcs, siphon fluid, anchor glows, inversion ghost, aperture horns and chamber violet pixels pale steam-white).
  Same sizes, frames and rotation sheets as the originals. Inert until WP18 wires a restored texture swap (ART_AUDIT A17).

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
5. Use the id in a renderer (`src/game/`), and add a row to the table in this guide.
6. Run `npm run typecheck` and `npm test`.
