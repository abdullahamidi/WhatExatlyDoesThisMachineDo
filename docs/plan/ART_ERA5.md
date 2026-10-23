# Art — Era V (Unknown Flux, resource XF) + Finale + Prestige/Achievement UI — CONTRACT

Authority: art + machine contract for the Era V content WP (roadmap WP13), the ending WP (WP14), prestige (WP15) and the achievements
panel (WP10). Ids, files, sizes, origins, sockets, links, frame counts and world numbers below are final; all PNGs exist under
`public/assets/` (§11). Content WPs may retune numbers in `src/data/` only where marked *(tunable)*.
Coordinates: machine-local art px, origin = frame base centre, +y down, ground contact on row y −1. "corner" = pixel-grid corner.
A socket y with origin (.5,1) = the corner under the sprite's bottom row (same convention as ART_ERA4: the spire bottom row −111 sits on socket −110).
Baseline: ART_ERA2 (generator hub (268,−25) after the in-game review), ART_ERA3 (+ its in-game review), ART_ERA4 (spire axis x 64, crown
plate top −418, crystal tip −458). Era V grows **up** (crown) and to **both far ends** (anchors ±520) — roadmap §1.

## 0. Deviations from roadmap §1 / ART_ERA4 §7 (read first)
| # | roadmap / earlier note | contract | why |
|---|---|---|---|
| CR-A | "null core 96×96 atop spire"; ART_ERA4 `coreSeat` (64,−466) | **lantern crown**: cantilever gallery 128×30 on the spire top + lantern chamber 128×116 (lattice posts, truss yoke, 3 field electrodes) + **null core 64×64 (sphere r 28) floating at (64,−490)** inside it. `coreSeat` is superseded | load path (R4): a 96 px ball cannot sit on the 14 px crown plate; lighthouse/radome practice is a gallery + lantern on the tower top. Height budget: the whole machine must fit zoom 0.5 (§5) |
| CR-B | "2–4 procedural orbiting rings" | 4 static tilted-ellipse sprites (back half + front half each) + one **procedural bead** per ring (`orbit` animation, pure maths) | crisp 1-px rings (no runtime rotation jaggies), motion still procedural |
| CR-C | "lens array (3×24×24)" | one **lens column** 32×48: 3 edge-on biconvex lenses (24/20/16 wide) in a tapered cage + converging light-cone sheet | side elevation: a lens that sends the beam **up** has a vertical axis → seen edge-on. A face-on 24×24 lens would aim the beam at the viewer |
| CR-D | "gravitic anchors 32×128 driven into ground at ±520" | as roadmap **+ two guy cables** from the anchor eyes to the chamber yoke (new cable style `guy`) | guyed-mast load path: the anchors hold the top-heavy crown; without the guys the anchors are disconnected parts |
| CR-E | inversionCrank (no art named) | **inversion ghost**: violet outline of the mirrored hand crank on the crank hub, RotSprite, turns **opposite** to the crank, visible for the 3 s click-echo window | the click echo made visible on the crank itself; exotic era = field, no hardware needed |
| CR-F | horizonField / primaryFunction (no art named) | horizonField = background overlay (360° eclipse horizon glow), no machine part; primaryFunction = name-plate frame 5 + white beam (finale) | horizonField is R (not U), so the "every unlock has ≥ 1 component" test is unaffected; `ending` effect needs an exemption in that test |
| CR-G | camera min zoom derived = 0.5 | world growth makes the derived min zoom 1/3 → **explicit `CAMERA.minZoom: 0.5`** everywhere | below 0.5 one art px < 1 screen px (pixel art breaks, mesh/rot frames shimmer) |

## 1. References → rules
- Lighthouse Fresnel optic: central bull's-eye, rings of refracting prisms + reflecting prisms above/below redirect stray light into one beam;
  the optic sits on a pedestal inside a lantern room on a gallery; clockwork rotation turns the beam into flashes
  (https://en.wikipedia.org/wiki/Fresnel_lens, https://www.staugustinelighthouse.org/2015/11/18/lighthouse-technology-frensel-lens/,
  https://pharology.eu/howlighthouseswork/H12_lensesandprisms.html, https://vineyardgazette.com/node/77723). → gallery + lantern chamber on the spire
  top, the Era IV crystal is the "lamp", the lenses collect the core's output into one vertical beam; no rotating flash (no strobe rule).
- Svalbard Seed Vault portal art "Perpetual Repercussion": steel/mirror/prism triangles that make the building visible from far away, turquoise-white
  fibre light in polar night (https://www.regjeringen.no/en/topics/food-fisheries-and-agriculture/svalbard-global-seed-vault/mer-om-det-fysiske-anlegget/id2365142/,
  https://www.hmdb.org/m.asp?m=277106). → tone: restoration machinery is a **beacon** (vertical light, quiet, cold-white), not an explosion.
- Total eclipse: partial phases → Baily's beads → **diamond ring** (one bright bead + faint corona) at 2nd/3rd contact; during totality the horizon
  glows orange all round (https://earthsky.org/astronomy-essentials/stages-of-a-total-eclipse-what-to-look-for, https://solarwatch.app/en/resources/bailys-beads-eclipse,
  https://apod.nasa.gov/apod/ap150328.html). → Era V "sun dims" = the sun is eclipsed step by step; totality sky = dark violet above, 360° warm horizon band;
  the finale's single white fade happens on the diamond-ring frame (3rd contact = light returns).
- Ecological succession: pioneers (lichen, moss, dry tufts) → grasses/herbs → shrubs → trees; secondary succession on old soil is fast and grasses
  come back first (https://www.britannica.com/science/pioneer-species, https://www.worldatlas.com/articles/what-is-ecological-succession.html).
  → regrowth strips in 3 stages in that order; green spreads outward from the machine.
- Terra Nil (restoration game): the satisfaction is watching brown → green spread per region (https://shacknews.com/article/134777/terra-nil-review-nature-appreciation).
  → the restoration is shown as a **wipe outward from the machine**, not a global crossfade.
- Screw/helical ground anchors + guy wires: shaft with helix plates screwed in, guy-wire eye on the head, guy angle set at installation
  (https://www.firgelliauto.com/blogs/mechanisms/screw-anchor, https://blog.hubbell.com/en/hubbellpowersystems/12-steps-to-install-earth-anchors-round-rod-and-ss-anchors,
  https://patents.google.com/patent/US8506207). → anchor = riveted pile with collars, forged eye on a domed cap, heaped earth where it went in.
- Gimbals / armillary rings: nested rings rotating about a common centre (https://www.museoscienzebergamo.it/fisicaalmuseo/en/?p=967,
  https://patents.google.com/patent/US131148). Side view of a tilted circle = ellipse; the near half passes **in front of** the centre body.
  → ring sprites split into back/front halves, bead depth from sin φ.
- Palette discipline: value first, hue-shift ramps (cool shadows, warm lights), 8–32 colours per scene, accents on small areas
  (https://www.wayline.io/learn/pixel-art/2, https://www.gamedev.net/articles/visual-arts/color-palettes-r4964/). → green ramp cool-dark → yellow-light,
  dusk ramp is desaturated (large area), violet stays on small parts.
- House rules kept: R1 axles end-on, R4 every part stands on steel/ground (the core is held by 3 field electrodes — the one deliberate exotic exception),
  locked palette, alpha 0/255, crop/pad/hand-pixel only, RotSprite for rotation, light from upper-left, flashes ≤ 3 Hz.

## 2. Palette (PALETTE += in `src/data/palette.ts`; all 53 new PNGs verified: every opaque pixel in the palette, alpha ∈ {0,255})
| ramp | hex (dark → light) | use |
|---|---|---|
| violet (roadmap, accent) | `#24162f #54367a #9a6ad0 #e0c8ff` | core rim/spiral, rings, beads, electrode tips, siphon glow/arcs, lens light, beam, eclipse corona, anchor coils, ghost |
| dusk (new, large areas) | `#2b2236 #3e3049 #5b4a5f #7d6a72` | `bg.skyViolet` bands only |
| restored sky (roadmap + 2) | `#3f6690 #6f9fc8 #a8d0e8 #d6ecf0` | `bg.skyRestored`, white beam, restored mountain haze, glass |
| regrowth green (roadmap + 2) | `#2e4a36 #5f8a4a #8fb46a #c2d68a` | ground, regrowth, roof gardens, foothills |
Suggested names: `violetDark violet violetLight violetPale`, `dusk0..3`, `skyClear0..3`, `green0..3`. Materials: crown iron = iron ramp; brass lens cells /
plate = rust ramp; insulators/siphon bases = sand ramp; lens glass = `#a3a6a4 #e8e0cc #7d8286`.

## 3. Flow (resonance → exotic, coherent at every unlock)
Crystal (Era IV RS lamp, crown plate) → **null core** floating at the focus of three electrodes (posts L/R at core height, yoke above) →
`containmentRing` rings orbit it (field) · `resonantSiphon` glass siphon tubes on the gallery deck arc RS into the core rim · `lensArray` lens
column on the yoke collects the core's output · `skyAperture` clamshell on top opens → vertical beam to the sky. `graviticAnchor` piles at ±520
guy the crown to the ground. `inversionCrank`: every crank click leaves a 3 s counter-rotating violet ghost of the crank (xf click echo).
`horizonField`: the horizon glows violet all round. Plate on the frame girder spells the function as it is discovered (§4, `namePlate`).

## 4. Components (all files under `public/assets/`, all delivered)
New sockets: galleryBase(64,−395) chamberBase(64,−418) coreHub(64,−490) lensBase(64,−534) apertureBase(64,−582) siphon(30|98|18|110|42|86, −418)
siphonArcs(64,−468) anchorL(−520,0) anchorR(520,0) plateSeat(64,−96) (crank hub (0,−56) existing).
| component | tech ≥lvl | asset id → file | size | origin | socket | layer/bias | animation |
|---|---|---|---|---|---|---|---|
| nullGallery | nullChamber 1 | machine.nullGallery → machine/era5/null-gallery.png | 128×30 | .5,1 | galleryBase | mid/3 | none |
| nullChamber | nullChamber 1 | machine.nullChamber → machine/era5/null-chamber.png | 128×116 | .5,1 | chamberBase | mid/5 | none |
| nullCore | nullChamber 1 | machine.nullCore → machine/era5/null-core.png (+rot machine/era5/rot/null-core-rot.png, 64 f, 8×8, 512×512) | 64×64 | .5,.5 | coreHub | mid/7 | spin exotic {base 6, gain 30, min 6, max 240} deg/s *(tunable)* |
| nullCoreGlint | nullChamber 1 | machine.nullCoreGlint → machine/era5/null-core-glint.png | 64×64 | .5,.5 | coreHub | mid/8 | none (static: light stays upper-left, audit #12) |
| ringNBack (N=1..4) | containmentRing 1/8/16/25 | machine.ringNBack → machine/era5/ringN-back.png | 112×72 | .5,.5 | coreHub | mid/6 | none |
| ringNFront | same | machine.ringNFront → machine/era5/ringN-front.png | 112×72 | .5,.5 | coreHub | mid/9 | none |
| ringNBead | same | machine.ringBead → machine/era5/ring-bead.png | 5×5 | .5,.5 | coreHub + orbit offset | mid/6 when sin φ < 0, front/0 when ≥ 0 | orbit (§6) |
| siphonPairS (S=1..3) ×2 tubes | resonantSiphon 1/10/20 | machine.siphonTube → machine/era5/siphon-tube.png | 12×30 | .5,1 | siphon x pair S: (30,98) (18,110) (42,86), y −418 | mid/4 | none |
| siphonArcsS | same | machine.siphonArcsS → machine/era5/siphon-arcs-S.png sheet 512×64, frame 128×64 ×4 | 128×64 | .5,.5 | siphonArcs | mid/8 | frames 4, maxHz 8, exotic, frame offset S−1 |
| graviticAnchorL/R | graviticAnchor 1 | machine.graviticAnchor → machine/era5/gravitic-anchor.png | 32×128 | .5,1 | anchorL / anchorR | mid/0 | none · cable `eye` (0,−121) |
| anchorGlowL/R stage 1/2/3 | graviticAnchor 1/5/10 | machine.anchorGlow1/2/3 → machine/era5/anchor-glow-1/2/3.png sheet 128×128, frame 32×128 ×4 | 32×128 | .5,1 | anchorL / anchorR | mid/1 | frames 4, maxHz 3, exotic (stage n covers n−1, same frame index) |
| inversionGhost | inversionCrank 1 | machine.inversionGhost → machine/era5/inversion-ghost.png (+rot machine/era5/rot/inversion-ghost-rot.png, 80 f, 9×9, 432×432) | 48×48 | .5,.5 | (0,−56) crank hub | mid/9 (over gears/belts, under the crank) | driven ratio **+1.75**, phase 0; echo visibility §6 |
| lensLight | lensArray 1 | machine.lensLight → machine/era5/lens-light.png sheet 128×48, frame 32×48 ×4 | 32×48 | .5,1 | lensBase | mid/1 | frames 4, maxHz 3, exotic (frame 0 = dark) |
| lensColumn | lensArray 1 | machine.lensColumn → machine/era5/lens-column.png | 32×48 | .5,1 | lensBase | mid/3 | none |
| aperture | lensArray 1 | machine.aperture → machine/era5/aperture.png sheet 384×28, frame 64×28 ×6 | 64×28 | .5,1 | apertureBase | mid/3 | latch: frame 0 until skyAperture ≥ 1, then 0→5 at 5 fps once, hold 5 |
| namePlate | always (frame by stage) | machine.namePlate → machine/era5/name-plate.png sheet 240×11, frame 40×11 ×6 | 40×11 | .5,1 | plateSeat | frame/2 | stage frame: 0 `???????` (dusty), 1 generator≥1 `R?S????`, 2 boiler≥1 `RES?OR?`, 3 resonatorSpire≥1 `REST?RE`, 4 nullChamber≥1 `RESTOR?`, 5 ending restored `RESTORE` |
Chamber connection points (rel. to chamberBase): cable `eyeL` (−62.5,−109.5) = world (1.5,−527.5), `eyeR` (62.5,−109.5) = world (126.5,−527.5).
Electrode tips (art only): (31,−490) (96,−490) (64,−520) — 4–5 px air gap to the core rim r 28 (x 36..92, rows −518..−463).
`finalAlignment` (milestone) and `horizonField` have no machine component (§6, §7). Shadows (`MACHINE_SHADOWS`, h 2): anchors x −536 w 32 · x 504 w 32.

**Links**
| id | kind | from → to | style | gate |
|---|---|---|---|---|
| G1 | cable sag 6 | nullChamber `eyeL` (1.5,−527.5) → graviticAnchorL `eye` (−520,−121) | **guy** | graviticAnchor |
| G2 | cable sag 6 | nullChamber `eyeR` (126.5,−527.5) → graviticAnchorR `eye` (520,−121) | guy | graviticAnchor |
`MACHINE_LINK_STYLE.guy = { depth: MACHINE_LAYER_DEPTH.frame + 5, core: 0x3e4246, under: 0x1f2225 }` — 1 px core + 1 px darker row below (wire rope), no cyan.
Anchor/chamber sprites draw over the cable ends (eye lugs cover them = cable through the eye).

**Ring geometry** (centre = coreHub (64,−490); canvas centre corner (56,36); X = a·cosφ·cos t − b·sinφ·sin t, Y = a·cosφ·sin t + b·sinφ·cos t, +y down)
| ring | gate | a | b | tilt t | extent (art) | bead φ0 | bead dir |
|---|---|---|---|---|---|---|---|
| ring1 | containmentRing 1 | 36 | 7 | −10° | ±35.5 × ±9.3 | 0° | + |
| ring2 | containmentRing 8 | 42 | 10 | 16° | ±40.6 × ±15 | 97° | − |
| ring3 | containmentRing 16 | 46 | 13 | −24° | ±42.4 × ±22.1 | 194° | + |
| ring4 | containmentRing 25 | 50 | 18 | 30° | ±44.2 × ±29.5 | 291° | − |
Front half = pixels with sin φ ≥ 0 (near side), back half sin φ < 0. Bead sprite centre = (64 + X, −490 + Y) floored. The rasteriser is
`scripts/art/era5/parts.py rings()` (2400 samples, floor, L-corner cleanup) — a pure `orbitPoint(ring, φ)` must use the same formula.

**Clearances (checked in mock):** gallery deck rows −418..−415 = crown plate level; truss chord feet (56,−397)/(71,−397) land on the tower legs (outer x 57/70)
with gusset plates; truss chord ≥ 12 rows above the Era IV dish shells (top −390). Crystal (x 51..76, −466..−419) stands on the deck between the
siphon pairs (pair 3 x 36..47 / 80..91). Core rim 4 rows above the crystal tip (−458), 2 rows under the top electrode (−520). Chamber posts x 5..10 / 117..122
outside ring4 (x 20..108). Yoke truss −531..−524, collar −534..−531 (x 50..77). Lens column −582..−535 on the collar; aperture −610..−583, open petals
inside x 32..95. Beam foot = aperture mouth row −588. Guys: G1 passes 60 rows above the chimney crown (−238 at x −293, line y ≈ −298) and above the smoke
(≤ −276); G2 clears the transformer/mast (line y ≈ −184 at x 436, mast top −108). Anchors x −536..−505 / 504..535 beyond the condenser (−442) and mast (444).
Plate x 44..83 rows −107..−97 on the frame top-girder face between the tower shoes (rows −115..−110 above).
**Contact / support check:** gallery → spire legs + crown plate; chamber feet → deck; core → field (3 electrodes); rings/beads → field; siphons → deck;
lens column → yoke collar; aperture → lens column top ring; anchors → ground (earth mound); guys → yoke eyes + anchor eyes; ghost → field on the crank hub;
plate → girder face. No floating hardware at any unlock order (`stages_era5.png`).

## 5. World / camera growth (exact)
| constant (`src/data/world.ts`, `machineComponents.ts`) | now | Era V |
|---|---|---|
| `WORLD` | 2560×1440 | **3840×2160** |
| `GROUND_Y` | 1120 | **1680** |
| `MACHINE_ANCHOR` | (1280, GROUND_Y) | **(1920, GROUND_Y)** |
| `CAMERA.focus` | (1280, GROUND_Y − 160) | **(1920, GROUND_Y − 160)** (offset unchanged) |
| `CAMERA.minZoom` (new) | derived 0.5 | **0.5 explicit**; replace every `minZoomToFit(VIEW, WORLD)` floor (CameraController, ParallaxBackground sky display size `VIEW / 0.5`, PylonLine) with `Math.max(CAMERA.minZoom, minZoomToFit(...))` |
| `MACHINE_BOUNDS` | {−448, 448, −248, 8} | **{left −560, right 560, top −608, bottom 8}** → RT 1120×616 (RT origin x −448 → −560, y → −608; every older offset unchanged) |
| `CAMERA.hudTopInsetPx` shift (WIP in camera.ts) | unlimited | **cap the downward shift so `bottom + margin` stays on screen**: `shift = min(inset − topScreenY, view.height − margin·zoom − bottomScreenY)`, never < 0 |
Checks: bounds art 1120×616 → world 2240×1232; fit (margin 72) = min(1280/2384, 720/1376) = 0.523 → snapped **0.5** (step 0.25) ✓ (the Era V crown must
stay ≤ 648 art tall above ground+8; current top −608 has 32 rows spare). Full view: centre world (1920, 1080) (art (0,−300)), visible x 640..3200,
y 360..1800 — inside the world ✓; machine top at screen y 52, ground at screen 660. With the hud inset cap the view moves down by ≤ 16 px.
Everything defined from `GROUND_Y` / `MACHINE_ANCHOR` (parallax `bottomY`, `DUST.spawn*`, terrain, horizon strip, steam emitters, pylon line) moves with them.
Literal 1280/1120 values exist only in `world.ts` (grep checked). Terrain shows 480 world px under the ground (2160 − 1680) ≥ the 120 visible at full view ✓.
Parallax at full framing (camera 220 art above `CAMERA.focus`): horizons rise above the machine ground by 220·(1−sf) px → mountains 187, skyline 154,
pylons 99 (underfill reads as a far plain; accepted, same behaviour as Era IV at zoom 0.5; see `finale_k1_era5_complete.png`).
RT cost: 1120×616 = +61 % pixels vs Era IV — re-check the 4 ms RT budget in the perf smoke (WP16).
Auto-frame on nullChamber / graviticAnchor / lensArray / skyAperture purchase (zoom stays 0.5 once the anchors are in).

## 6. Animation + FX (Era V play)
- New `AnimationDriver` `'exotic'` = `rates.perSecond.xf`. New kinds (pure, tested): `orbit { ring: RingGeo; phi0Deg; dir: 1|−1; speed: SpeedCurve }`
  (φ += dir·speed(exotic)·dt; position/depth §4; speed {base 20, gain 25, min 20, max 180}·(1 + 0.25·(N−1)) deg/s *(tunable)*), `latch { techId; minLevel; frames; fps }`
  (plays 0→frames−1 once when the gate first holds, then holds; load with the gate already true = last frame), `stage { frames; gates: [TechId, minLevel][]; endingFrame }`
  (frame = number of gates met; `endingFrame` when `ending.restored`). Everything else reuses `frames`, `spin`, `driven`, `none`.
- nullCore: spin + static glint (3-arm log spiral, symmetric rim → no orbiting highlight).
- Rings: static sprites; beads orbit. `finalAlignment` milestone: all beads tween to φ = 90° (lined up under the core) over 1.5 s, hold 2 s, resume;
  core spin ×3 for 2 s; anchor glow frame 2 held 2 s *(tunable)*.
- Siphon arcs frames 1..3 = x2 / x3+x1 dots / x2 (adjacent steps, frame 0 none → ≤ 2 Hz flash at 8 fps). Lens light 0 dark, 1..3 brightness steps.
- Anchor glow: coil groove lights x1 → x2+x3 glints → x1. Stage 1 = bottom collar, 2 = +middle, 3 = all three.
- inversionGhost: angle = +1.75·θM (crank is −1.75·θM) → same 80-frame sheet, `rotationFrame(angle, 80)`. Visible only while `now − lastClick < 3 s`
  (matches `clickEcho xf 3 s`): alpha 1 (0–1.5 s), 0.66 (1.5–2.25 s), 0.33 (2.25–3 s), then hidden — hard steps, no tween.
- Beam (world-space, not in the RT): `fx.beam` sheet 64×32, frame 16×32 ×4 (motes rise 8 px/frame, seamless 32-row tile) → tileSprite 32 world px wide,
  centre x = MACHINE_ANCHOR.x + 2·64, bottom = GROUND_Y − 2·588, up to world y 0; 8 fps; **blend NORMAL, alpha 0.85** (palette-true, no additive
  colour shift); visible when skyAperture ≥ 1 and the aperture latch has reached frame ≥ 3. Depth just above the machine RT. Finale → `fx.beamWhite`.
- Sky (Era V "sky darkens, sun dims"), all screen-fixed with the same transform as `bg.sky` (sky px (x,y) → screen at zoom 0.5 1:1):
  `bg.skyViolet` 1280×720 alpha by stage: nullChamber .25 · lensArray .5 · horizonField 5 .75 · skyAperture 1.0 (fade `PARALLAX_FADE_MS`);
  `bg.eclipse` sheet 288×48, frame 48×48 ×6, centred on sky px **(372, 290)** (= the sun in `bg/sky.png`): 0 full sun (identical to the baked sun),
  1 bite (nullChamber), 2 half (lensArray), 3 crescent (horizonField 5), 4 diamond ring (1.2 s on the skyAperture purchase, finale beat), 5 totality (skyAperture);
  `bg.horizonGlow` 1280×720 overlay (rows 520..719) alpha by horizonField level 1/10/20 = .35/.55/.75 *(tunable)*.
- Dust (Era IV rising dust) unchanged in Era V. Reduced motion: orbit/spin clamped (max 60 deg/s), arcs maxHz 4, ghost static frame, beam frame 0.
- Audio hooks (optional, WP16): sub-bass drone ∝ log xf/s; reversed swell on Era V purchases; soft "bead tick" on finalAlignment.

## 7. Finale — reveal storyboard (`primaryFunction`, ≈ 75 s + reading; skippable; resumable at S5)
Camera views: **FULL** = centre (1920, 1080) zoom 0.5 · **CROWN** = centre (2048, 640) zoom 1.0 (world (MACHINE_ANCHOR.x + 128, GROUND_Y − 1040) = art (64,−520)).
Only integer art scales (0.5 / 1.0). Tweens cubic in-out.
| shot | t (s) | camera | action | assets |
|---|---|---|---|---|
| S0 hush | 0.0–2.0 | → FULL (2.0 s) | input locked except SKIP (Esc / button), HUD + toasts fade 1.0 s | — |
| S1 spin-up | 2.0–10.0 | FULL, static | finale override ramps every driver to its max over 6 s (`driverValue = max(actual, lerp)`); calliope burst at 4.0; arcs every frame; anchor glow f2 hold; lens light f3; audio swell | existing + era5 sheets |
| S2 aperture | 10.0–19.3 | → CROWN 10.0–13.0; → FULL 16.0–19.0 (starts under the white) | 13.0 beam switches to `fx.beamWhite`, head rises from the mouth at 900 world px/s; 14.5 eclipse f4 (diamond ring); **15.0 one soft white fade** `#e8e0cc` α 0→.85 (1.2 s ease-out), hold 0.6 s, out 2.5 s — no strobe | fx.beamWhite, bg.eclipse f4 |
| S3 restoration | 19.3–49.3 | FULL; survey (WP18) 38.5–49.3: → baseL (1320,1380,×1) arrive 41.0, hold to 42.0 → baseR (2520,1380,×1) arrive 45.0, hold to 46.0 → FULL at 49.3; skipped under reduced motion | sky crossfade violet→restored 19.3–27.3; eclipse f4→3→2→1→0 every 1.5 s then hide (restored sky has its own sun at the same spot); horizon glow → 0 in 4 s; dust reverses (speedY +[6,18]) 6 s then stops; **ground wipe** `terrain.groundGreen` revealed from machine x outward at 120 world px/s each side (21.3 → 37.3 reaches the world edges), mask edge stepped per 8 rows by 0–16 px (no ruler edge); `bg.regrowth1/2/3` follow the wipe front 2 / 5 / 8 s behind; mountains crossfade 27.3–33.3, skyline 29.3–37.3; plate frame 4→5 at 30.0 (+3 dust puffs); `fx.seed` from 25.0; bird flock enters right at 38.0; 30.0 restored accent (WP18b): era V energy sprites swap to their #restored variants (warm lit core, pale rings/arcs/siphons/anchor glows) | bg.skyRestored, bg.mountainsRestored, bg.skylineRestored, terrain.groundGreen, bg.regrowth1-3, fx.seed, fx.bird |
| S4 reveal | 49.3–≈71 | FULL | `ui.nameplate` (×3) fades in top-left 0.8 s; terminal panel (`ui.panel` 9-slice, ≤ 560 px wide, top-left under the nameplate, clear of the crown) types 30 cps: `PRIMARY FUNCTION: RESTORE` / `Restoration target: world state, prior.` / `Observer count: 1.` / `Operator identity: you.` (2.0 s pause each) | ui.nameplate, ui.panel |
| S5 choice | ≈71– | FULL | last line `Restoration holds while the machine runs.` + **[KEEP IT RUNNING]** (`ui.button` hover frame, `icons16` keep) / **[BEGIN A NEW CYCLE]** (`icons16` cycle); resolving chord | ui.button, ui.icons16 |
Reduced motion: camera cuts (0.4 s fade through the current sky colour), no white fade (1.0 s crossfade at α ≤ .5), ground/regrowth crossfade 3 s instead of the wipe,
static beam frame, no birds/seeds motion, eclipse frames swap without the diamond-ring beat. Skip → S5 end state at once.
**Postgame (KEEP IT RUNNING):** restored layers persist (save `ending.restored`), beam white α .85, eclipse hidden, horizon glow 0, dust emitter swapped for
`fx.seed` (⅓ rate), a 3–6 bird flock every 40–70 s *(tunable)*, plate frame 5. Machine art unchanged (it stays a rusty machine; the world healed).
**New cycle transition (WP15):** FULL view; white `#e8e0cc` α 0→1 (0.8 s); under it: wasteland layers + Era I machine (parts removed, no fly-out);
α 1→0 (1.5 s); HUD shows `CYCLE 0043` (stamp SFX). Reduced motion: 1.0 s crossfade.
Background layer list for WP14 (`PARALLAX_LAYERS` additions, same rules as existing layers; `visibleWhen` extended with `ending`):
`skyViolet` (sf 0, depth background+1) · `eclipse` (sf 0, sprite) · `horizonGlow` (sf 0, depth background+2) · `skyRestored` (sf 0, background+3) ·
`mountainsRestored` (sf .15, alpha .45, underfill `#2e4a36`, ground row 156) · `skylineRestored` (sf .3, alpha .4, underfill `#2b2e31`, ground row 220) ·
`regrowth1..3` (sf 1, depth ground+1 — behind the machine, strip bottom row on GROUND_Y + 6 world px) · `groundGreen` (terrain twin, masked by the wipe).

## 8. Prestige UI art (WP15) — shown in the system menu at CSS scale ×2, `image-rendering: pixelated`
- `ui.echo` 32×32 (currency icon, violet rings) + `ui.icons16` frame 0 (inline 16×16). Text: `ECHOES 4 (+40% ALL/S)`.
- `ui.perks` sheet 160×32, frame 32×32 ×5: 0 Muscle Memory (worn motor + gear), 1 Residual Charge (Leyden jar, violet charge), 2 Long Silence (hourglass),
  3 Servo Recall (crank disc + recall arc), 4 Ledger (PixelLab book, job c4639c43 #8). Each sits in `ui.perkSlot` sheet 108×36, frame 36×36 ×3
  (0 locked iron rim, 1 affordable amber rim, 2 owned violet rim + check pip), icon inset 2 px. Status also in text (`OWNED`, cost `2 ECHOES`).
- `ui.icons16` sheet 80×16: 0 echo · 1 cycle (new cycle) · 2 keep running · 3 lock · 4 check.
- `ui.button` sheet 72×24, frame 24×24 ×3 (normal / hover / pressed) and `ui.panel` 24×24 — 9-slice, 8 px borders (matches `.hud-panel` colours).

## 9. Achievement badges (WP10) — `ui.badges` sheet 384×24, frame 24×24 ×16; `ui.badgesLocked` same layout (iron-flattened silhouette)
Locked badges also get `ui.icons16` lock (frame 3) at the bottom-right → status not by colour only. Icon index → suggested achievement:
0 firstTurn (first crank) · 1 steadyHand (100 clicks) · 2 tireless (1 000+ clicks) · 3 wornMotor · 4 blueprint (Generator Blueprint) · 5 eraElectric ·
6 eraThermal · 7 eraResonance · 8 eraExotic · 9 restoration (ending) · 10 newCycle · 11 echoes · 12 longSilence (offline 8 h) · 13 automation (crank servo) ·
14 bigNumber (gauge in the red: 1 Qa of any resource) · 15 keeper (lighthouse: all memory perks / second ending). ~30 achievements may share icons
(`AchievementDefinition.icon: number`).

## 10. Title / logo
- `ui.logo` 230×50: "WHAT EXACTLY DOES / THIS MACHINE DO?" cast amber letters (hand 5×7 font, 2-px strokes) on a riveted iron plate — title / menu header at ×2.
- `ui.logoMark` 32×32: 12-tooth gear with an amber "?" — favicon / app icon (index.html `<link rel="icon">`, outside `src/`).
- `ui.nameplate` 136×24: cast brass "RESTORATION ENGINE" — reveal title card (×3) and postgame menu header.

## 11. Files (53 PNGs, 113 KB total; assets dir 1.6 MB ≤ 8 MB budget)
`machine/era5/`: null-gallery, null-chamber, null-core, null-core-glint, ring1..4-back/front, ring-bead, siphon-tube, siphon-arcs-1..3, lens-column,
lens-light, aperture, gravitic-anchor, anchor-glow-1..3, inversion-ghost, name-plate; `machine/era5/rot/`: null-core-rot (64 f), inversion-ghost-rot (80 f).
`finale/`: sky-violet, eclipse, horizon-glow, sky-restored, skyline-restored, mountains-restored, regrowth-1..3. `terrain/ground-green.png` (recolour of
`ground.png`, same seams). `fx/`: beam, beam-white, seed (32×8, 8×8 ×4), bird (16×5, 8×5 ×2). `ui/`: nameplate, logo, logo-mark, icons16, echo, perks,
perk-slot, badges, badges-locked, button, panel.

## 12. Contract notes / requests (Director decides)
| # | item | reason |
|---|---|---|
| CR-A..G | §0 | mechanical correctness, pixel integrity, world budget |
| CR-H (needed) | `machineComponents.test` "every unlock has ≥ 1 component": exempt effect `ending` (primaryFunction) | its visuals are the finale (plate frame 5, white beam) |
| CR-I (optional) | Era V machine-RT tint `0xe6dcf0` at skyAperture (eclipse light on the rust) | unifies the dark sky and the beige machine; off by default |
| CR-J (optional) | parallax `CAMERA.focus.y` → GROUND_Y − 300 for late eras | layers would sit lower at the full view; costs early-game alignment — not recommended now |
| CR-K (optional) | audio §6 / finale: resolving major chord at S5, wind stops at S3 start, synth bird chirps with the flock | roadmap §4 End audio |

## 13. Production log
PixelLab `create_image_pro` (style = flywheel anchor 344ab19d…, locked palette): anchor eb21bdda (4 cand., reference only: violet used as shadow, pointed
pile tip above ground, rust-coloured rubble — redrawn by hand to its proportions: domed octagon cap + forged eye, 3 riveted collars, 2 plate seams, earth mound);
flora d46635a1 (64 cand., 26 picked for the regrowth strips, PixelLab ground rows 27..31 dropped; sources in `scripts/art/era5/src/flora/`); ledger c4639c43
(64 cand., #8 used as perk 4, `src/ledger-8.png`). Hand-pixelled from geometry: gallery truss, chamber (lattice posts, truss yoke, electrodes), core
(log spiral) + glint, 4 rings (ellipse raster), bead, siphon tube + arcs, lens column + light, aperture clamshell (petals rasterised per angle 0/18/36/54/72/90°),
ghost (outline of the mirrored hand crank), name plate (3×5 font), skies (hard bands, broken edges, flat streaks), eclipse (6 phases), horizon glow,
restored skyline (same footprints as the ruins), restored mountains (recolour + foothills), green ground (recolour), fx, all UI (5×7 / 3×5 fonts in `fonts.py`).
RotSprite: `python3 scripts/art/make_rot.py public/assets/machine/era5/rot public/assets/machine/era5 '{"null-core":64,"inversion-ghost":80}'`.
Tools `scripts/art/era5/`: `parts.py [part…]` (machine parts + `era5-geo.json`), `bg.py [name…]` (skies, layers, fx), `ui.py [name…]`, `fonts.py`, `pal.py`,
`helpers.py`, `mock_base.py` (Era I–IV compositor, generator hub fixed to (268,−25)), `mock5.py` (Era I–V + scenes; env `U5` 0..9, `WORLD` old|violet|mid|restored,
`SCENE=1`, see header), `keyframes.py` (finale shots), `sheetview.py`. Run order: `parts.py && make_rot.py … && bg.py && ui.py && keyframes.py`
(mock needs `ERA4_GEN` = scratch `era4/gen/` for the Era IV tower json).
Evidence (scratch `/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era5/`): `mock_era5_full.png` / `-2x` / `-3x`
(Era I–V), `base_era4-2x.png` (before), `stages_era5.png` (unlock order 0..9), `crop_crown_3x.png`, `crop_anchorL_3x.png`, `crop_plate_6x.png`,
`anim_sheet_era5_3x.png`, `finale_k1_era5_complete.png`, `finale_k2_crown_zoom1.png`, `finale_k3_white_peak.png`, `finale_k4_restoring.png`,
`finale_k5_reveal.png`, `finale_k6_choice.png`, `finale_storyboard.png`; UI sheets `u1.png` (badges ×4), `u2.png` (perks/slots/icons ×4), `u3.png` (logo/nameplate ×3).

## 14. In-game review (WP11 build, Art Director) — evidence scratch `…/scratchpad/ad11*/`
| # | defect | verdict / fix | owner |
|---|---|---|---|
| F1 | sky not violet in s15 | **capture artefact**: headless Chromium runs 4–8 fps, Phaser clamps delta → 1.5 s fades take > 10 s real; at the 2.5 s smoke wait skyViolet sits at α .25. After 15 s: α 1, sky = `#24162f` (`ad11w/s15_era5_full.png`). Game code OK. Fix the smoke: `stages.mjs` wait `+(process.env.WAIT_MS ?? (name >= 's14' ? 12000 : 2500))` | EM → worker (scripts/smoke) |
| F2 | framing: Era V ground at screen 665 (buttons kiss the base); world growth also **changed eras III/IV** (pre-WP11 the 1440-high world locked the zoom-0.5 centre at GROUND−400 → ground at screen 560; now III ground 480, IV 648) | `fitView` (`src/game/math/camera.ts`): new option `fullView?: { groundY: number; groundBandPx: number; topMinPx: number }` (CameraController passes `GROUND_Y`, `CAMERA.fullViewGroundBandPx` 160, `CAMERA.fullViewTopMinPx` 24 — constants already added). When the fitted `zoom ≤ o.minZoom + 1e-9`, replace the HUD-inset shift with: `Gpref = H − groundBandPx`; `Gmin = topMinPx + (groundY − b.top)·zoom`; `Gmax = H − margin − (b.bottom − groundY)·zoom`; `G = min(Gmax, max(Gpref, Gmin))`; `centre.y = groundY − (G − H/2)/zoom`; then `clampCenter` as now. Zoom > min unchanged (eras I–II pixel-identical, verified). Result: III/IV ground 560 (= pre-WP11), Era V ground 640, crown top ≈ 22, button bar 28 px below the ground line, guy cable passes x 339 at y ≈ 349 (HUD bottom 278). Tests: era III/IV bounds → centre.y = GROUND_Y − 400 at zoom .5; Era V bounds {−560,560,−616,8} → G = 640 | EM → worker |
| F3 | eclipse corona under the HUD panel corner (panel right 385, corona left 349) | **fixed** `src/ui/hud.css` `.hud-plaque` `font-size: max(12px, .65em); letter-spacing: .05em` → panel right 337 (+2 shadow) at the Era V plaque (`ad11css/hud2x.png`). Sun/eclipse position unchanged (eras I–IV sky identical) | done |
| F4 | name plate frame 4 `RESTOR?` re-hides the E revealed in frame 3 `REST?RE` | **fixed** `machine/era5/name-plate.png`: f4 = `RESTORE` (weathered), f5 = `RESTORE` cleaned (weathering d/e/f → `#c98552`, right rivets lit) = finale "plate polished" beat | done |
| F5 | plate ≠ HUD plaque (s9: plaque `RES?OR?`, plate `R?S????`): plate gates generator/boiler/spire/nullChamber, plaque gates the blueprints | `machineComponents.ts` namePlate `gates: [['generatorBlueprint',1],['substationBlueprint',1],['pressureVesselBlueprint',1],['harmonicConvergence',1]]` (= `PLAQUE_LINES` milestones); update `machineComponents.test.ts` gate-id expectation | EM → worker |
| F6 | inversion ghost barely legible (1-px violet outline on dark iron) | **fixed** `inversion-ghost.png` + pale `#e0c8ff` inner rim (2-px glow line), rot sheet regenerated (`make_rot.py … '{"inversion-ghost":80}'`, 432², 81 cells) | done |
OK (no action): crown/aperture/beam not clipped (aperture top y ≈ 65, ≈ 40 after F2); guy cables clear of HUD + toast at the full view; anchors on earth mounds, eyes + guys connected; rings back/front + beads depth correct over 16 frames; siphon arcs tube→rim; lens column on yoke; eras I–II framing, ground pattern, parallax, pylons, dust identical to pre-WP11 (`ad11all/cmp_*.png`, diffs = animation/toasts only).

## 15. Finale in-game review (WP13 build, Art Director) — evidence scratch `…/scratchpad/ad13/` (`v1/` = fixes, `v2/` = fixes + violet start)
| # | defect | verdict / fix | owner |
|---|---|---|---|
| R1 | **all finale UI art 404** (no nameplate, panel/button/icon frames missing → "orange box offset left of KEEP" = focus ring around an empty 48 px frame cell) | root cause: `url(assets/ui/x.png)` put into a CSS custom property is resolved against the stylesheet that reads `var()` → in the build `/assets/index-*.css` → `/assets/assets/ui/x.png` (preview SPA fallback serves text/html). Same bug in system menu + tech tree. Fix: absolute URL before it enters the property. `src/ui/finale.ts` `artUrl`: `const path = resolveAssetUrl(ASSET_MANIFEST[id]); return path === null ? null : new URL(path, document.baseURI).href;` and quote: `` `url("${plateUrl}")` `` (×4). `src/ui/systemMenu.ts` L81–82 + `src/ui/techTree.ts` L107: `` `url("${new URL(UI_ART.panel, document.baseURI).href}")` `` (same for button / icons16). Verified in a scratch build: 0 bad PNG responses, plate/panel/buttons render (`v2/kend.png`) | EM → worker |
| R2 | empty black panel S0–S4 (k1…k40), covers the eclipse at CROWN (k12) | **fixed** `finale.css`: `.finale-panel:not(:has(.finale-line:not(:empty))) { visibility: hidden }` (`v2/k1.png`). Optional code twin: `setHidden(panel, no char shown)` in `renderLines` | done |
| R3 | grey band skyline→ground after restoration = `skylineRestored` ground rows + underfill `grayDark` α .4 (+ green0 α .45) over pale sky → `#657572` | **fixed** `finale/skyline-restored.png` rows 220–319 → green fields (g1, hedge row g0, dashed furrows, buildings pixel-identical; `bg.py skyline`), `world.ts` skylineRestored underfill `PALETTE.green1` (+ test). Band now sage `#799a7c`, lighter than the near ground (aerial perspective) (`v2/k40.png`). Not Terrain bands (ink α .07, fine) | done |
| R4 | disabled NEW CYCLE at opacity .6: skyline through the button; reason line `#a8957a` on sky ≈ 1.6:1 | **fixed** `finale.css`: disabled = frame 2 (dark cell), icon α .5, label amber-dim, opaque; `.finale-reason` own plate (iron-2, rust-dark border, ink ring, haze text ≈ 9:1) (`v2/kend.png`) | done |
| R5 | nameplate not visible at kend | = R1 (layout slot 408×72 present, image 404) | R1 |
| R6 | seeds reuse dust y band + alpha .35→0: pale `b3` seeds = lower-sky colour, invisible | data **added** `FINALE_SEEDS.spawnY [GROUND_Y−360, GROUND_Y−8]`, `alpha [0.15, 0.9]` ([end, start]). Code: `FinaleFx.ts` seeds emitter `y: { min: FINALE_SEEDS.spawnY[0], max: FINALE_SEEDS.spawnY[1] }`, `alpha: { start: FINALE_SEEDS.alpha[1], end: FINALE_SEEDS.alpha[0] }` (verified in scratch build) | EM → worker |
| R7 | wipe edge 0–16 world px = 0–8 screen px → reads as a ruler edge | **fixed** `FINALE_WIPE.maxStepPx 32, stepPx 4` (0–16 screen px; 32 keeps "not complete at 37.0" test) (`v1/k24_wipeL4x.png` before, `v2/k24_edge3x.png` after) | done |
| R8 | smoke keyframes start on a beige sky | **capture artefact** (F1 again): skyViolet still fading after the instant buy list. `finale.mjs`: `await page.waitForTimeout(15000)` before `buyList(['primaryFunction'])` | EM → worker (scripts/smoke) |
| R9 (low) | far-ground haze `GROUND_SHADE.haze` = beige `skyHaze` α .3 over the green ground | postgame/restored: Terrain haze colour → `PALETTE.skyClear1` when `ending.restored` (Terrain reads a `restored` flag) | later |
OK vs storyboard: one white fade `#e8e0cc` α .85 at 15.0, no strobe (k15.6); diamond ring 14.5 → f3/2/1/0 every 1.5 s then hidden, restored sun same spot; beam white from 13.0; flock enters right 38 s, `i1` silhouettes readable on blue; regrowth trails wipe; plate f5 at 30; skip/choice focus on KEEP (focus ring now hugs the button).
