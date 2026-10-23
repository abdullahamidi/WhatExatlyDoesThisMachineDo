# Art Brief — PixelLab asset pass

Goal: every sprite looks hand-made by one pixel artist. No AI slop: no noise speckle, no muddy
gradients, no anti-alias halos, no melted/asymmetric mechanical shapes, no random text/symbols,
no perspective drift (everything is flat side elevation / face-on).

## Palette (mandatory — pass as `palette` to every PixelLab call, palette_name "Rust Wasteland")
```
ink        #14110f
iron       #1f2225 #2b2e31 #3e4246 #5a5f63 #7d8286 #a3a6a4
rust       #2e1a12 #4e2a1a #6e3a22 #8c4a2a #ad6236 #c98552
sand       #5f5244 #8a7a64 #a8957a #c9b28a #ddc9a3
sky        #7a7468 #9c9182 #b8a98f #d2bf9c
accent     #d9822b #f0a848 #ffd27a
```
Accent (orange/yellow) only for small glints, heat, warning paint — never large areas.

## Style rules
- Side view, light from upper-left. 3–4 tone shading per material from its ramp. Hard clusters, no dithering noise.
- Selective outline: darkest ramp tone / ink on the shadow side; lighter on the lit side.
- Rust as clustered patches on iron, not uniform orange.
- Mechanical parts symmetric and readable at 2× scale. Rotating parts (crank hub, gears, flywheel) perfectly centred and round.
- Distant background layers: low contrast, fewer colours (sky/sand/iron light tones), silhouettes, no outlines.

## Tools
- Machine parts: `create_image_pro` (no_background true, palette above, `style_image_url` = approved anchor after step 1).
- Backgrounds: `create_image_pro` with **no_background true** (layers are alpha-blended over a separate sky image — sky area MUST be transparent), palette above, `max_colors` ≤ 6–8. Ground tile: no_background false.
- Cleanup on every approved image: `pixelart_workbench` `repair <id>`, then `lint <id>`; fix flagged orphan pixels/outline gaps.
- Download final PNG via the returned download URL into `public/assets/...` (exact path below).

## Asset list (sizes are fixed by the manifest — final PNG must match exactly)
| asset id | final file | size | pivot | prompt core |
|---|---|---|---|---|
| machine.flywheel (ANCHOR) | machine/flywheel.png | 96×96 | centre | heavy cast-iron flywheel, face-on, thick rim, 6 spokes, riveted hub, rust patches |
| machine.gearLarge | machine/gear-large.png | 64×64 | centre | large spur gear face-on, 16 square teeth, 4 spokes, hub with key slot |
| machine.gearSmall | machine/gear-small.png | 40×40 | centre | small spur gear face-on, 10 teeth, solid web, hub |
| machine.crank | machine/hand-crank.png | 48×48 | hub at exact centre (24,24) | hand crank face-on: round hub disc at centre, one straight arm up to a worn wooden handle knob; arm+knob must fit within top half |
| machine.frame | machine/support-frame.png | 200×110 | bottom-centre; base touches bottom row | riveted steel truss support frame, side elevation: top girder, base beam, 4 posts, X braces, see-through gaps |
| machine.motor | machine/worn-motor.png | 64×48 | centre | worn industrial electric motor side view: finned cylindrical housing, mounting feet, shaft stub to the right, faded warning plate |
| machine.piston | machine/piston-array.png | 96×64 | bottom-centre; base touches bottom row | three vertical piston cylinders on a shared bolted base plate, steel rods, small pipes |
| fx.steam | fx/steam.png | 16×16 | centre | small soft steam puff, 3 tones of sky/sand light colours |
| bg.mountains | bg/mountains.png | 512×256 | horizontally tileable | distant hazy mountain ridge with faint ruined structures, silhouette only, ground line at y=156; rows 156-255 far-plain ramp (WP16b): row 156 #b8a98f, 157-170 #a8957a, 171-196 #8a7a64, 197-255 #5f5244, sparse 1 px dashes, tileable on x; layer underfill #5f5244 |
| bg.skyline | bg/skyline.png | 512×320 | horizontally tileable | ruined city skyline silhouette: broken towers, exposed girders, few dim windows, ground line at y=220; rows 220-319 transparent (WP16b; layer underfill none, the mountains far plain shows through) |
| bg.pylons | bg/pylons.png | 256×256 | horizontally tileable | one derelict lattice power pylon with sagging cables leaving both edges at the same heights, ground line at y=156, transparent elsewhere |
| terrain.ground | terrain/ground.png | 256×128 | tileable both axes | flat cracked dry wasteland ground seen from the side-top, sand ramp, sparse pebbles and fine cracks |

Tileable seam method: generate, then `np.roll` the image by half its width (PIL), and `inpaint_image` a
24–32 px vertical strip over the centre seam with the same prompt and palette; roll back. Check the wrap
by tiling 3× side by side.

Size method: if PixelLab returns a different canvas, crop to the content bbox and pad (transparent) to
the exact size honouring the pivot rule — never resample/scale.

## Approved anchor
machine.flywheel = job 344ab19d-a156-4ed0-8aab-fc27fedf71b5 index 0 (workbench score 97.2).
Style URL for `style_image_url`: https://api.pixellab.ai/mcp/images/344ab19d-a156-4ed0-8aab-fc27fedf71b5/download?index=0

## Background REDO prompts (Opus review round 1 — all rejected)
- bg.mountains: "transparent background, no sky. One low-contrast distant ridge silhouette in #9c9182/#b8a98f, faint ruin silhouettes in #7d8286 only. Ridge peaks between y=90 and y=140 and meets the left and right edges at the same height (y≈135). Solid #5a5f63 from y=156 down. No creatures, no objects, no black, no outlines, no foreground." max_colors 6. (Superseded by WP16b for the rows below the ground line: see the asset table.)
- bg.skyline: "transparent background. Ruined towers and girders in #2b2e31/#3e4246/#5a5f63 only, a few dim #6e3a22 windows, no haze or smoke smears, no ink-black foreground rubble. Building bases on y=220, solid #2b2e31 from y=220 down. The outer 16px at the left and right edges are low rubble at the same height." (Superseded by WP16b for the rows below the ground line: see the asset table.)
- bg.pylons: "single pylon centred at x=128, feet exactly on y=156, about 130px tall (top near y=24). Fully transparent below y=156: no ground, rubble or grass. Cables hang from the crossarm tips and droop to their lowest point at the left and right image edges, crossing both edges at the same heights (y≈84 and y≈96)." Then clear rows ≥157 by pixel fill.
- terrain.ground: "seamless texture, orthographic view straight down onto flat cracked dry earth. Even density everywhere: no horizon, haze, gradient, paths or diagonal streaks. Base #8a7a64 with #a8957a/#c9b28a crack plates, #5f5244 fine cracks, a few small pebbles."
Post-fix by pixel ops (allowed): below-ground rows as in the asset table (mountains far-plain ramp, skyline transparent), clear transparent zones, seam inpaint.
