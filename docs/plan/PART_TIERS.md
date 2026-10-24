# PART EVOLUTION TIERS (WP22-23 design, Art Director)

User request (2026-10-24): buying a new part and watching it land feels great. Upgrading it afterwards feels like a
static, boring screen. Parts should start weak-looking and visibly evolve as they level up. Not every level: 3 or 5
phases, depending on the part's upgrade capacity.

Status: design and proof only. No file under `src/`, `scripts/`, `public/` or tests was changed.
Build contract: `docs/plan/WP22.md` wins where it differs (beat cap 4, one FX set per change on its primary host, new `tiers.mjs` instead of edits to stages/perf/soak, `'prestige'` path, burst toast rule, deferred rot loads, out-of-tree nudge out of scope).
Proof set: `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22-23/proof-tiers/`.

## 0. Decisions at a glance

| # | decision |
|---|---|
| D1 | A tier is a **rendering-only view of tech levels**. It adds no save field, no economy effect and no simulation code. `tierOf(level, track.levels)` is pure. |
| D2 | **Tier count:** let `cap = min(maxLevel, reach)`. If `cap >= 18` the track gets 5 tiers, otherwise 3. `reach` is the level each profile (A, B, C) holds at `primaryFunction`, minimum over the three. Thresholds sit on reachable levels and are listed per tech in §1. |
| D3 | **Tier names:** MK I..MK V. 5-step ladder: SALVAGED, PATCHED, REINFORCED, TUNED, AS BUILT. 3-step ladder: SALVAGED, REINFORCED, AS BUILT. The top tier always carries the warm accent: a lamp on static parts, a brass glint ring on rotating parts. |
| D4 | **Mechanism:** texture swap per sprite (`${assetId}#t${n}`, `${assetId}#t${n}#rot`), with the restored-variant pattern generalised in one resolver. Rotating hosts use palette-swapped rot sheets (no re-rotation) plus static, rotationally symmetric decals. Existing staged components (coil stages, firebox glows, coil rings, containment rings, siphons, anchor glows) are tiers already and are folded in, not replaced. |
| D5 | **Tier-up beat (900 ms, never blocks input):** heat flash, swap, old-shell ghost, debris that tells the step (rust flakes, then scale chips, then sparks, then rising motes), two bolt-down sparks, a shine sweep and a ratchet-and-bell sound. Between tiers a single torque tick plays, its pitch climbing toward the next mark. It is held while the TECH INDEX is open and plays on close, like fly-ins. |
| D6 | **Priority:** P0 = Era I-II (7 techs, the whole demo). P1 = Era III-IV. P2 = Era V and legacy feeds (mostly retunes and small swaps). |

## 1. Tier rule

### 1.1 Validation of the proposal

The proposal was: `maxLevel <= 15` gives 3 tiers, `maxLevel >= 20` gives 5, uncapped feeds get 5 on a log-like list.
- **Capped part: kept.** No tech has a `maxLevel` between 16 and 19, so `maxLevel` alone already splits the 22 repeatables cleanly.
- **Reach: changed.** Five capped techs never reach `maxLevel` in a normal run:
  - crankServo 7/10
  - resonantSiphon 11/20
  - graviticAnchor 3/10
  - motorRetrofit 19/20
  - pressureResonator 19/20

  Their top tier must sit on a level the player actually reaches, so the rule uses `cap = min(maxLevel, reach)`.
- **Uncapped feeds: changed to 3 tiers.**
  - Their reach is only 4 (bellowsDrive), 8 (mainsBackfeed), 13 (steamLance) and 15 (gridExciter), because growth is 1.4 to 2.5.
  - Five tiers would put tier-ups on consecutive levels, which is noise, not a moment.
  - The `cap >= 18` rule gives them 3 tiers. That is the same count as gearRatio (15), so one rule covers every track.
- **Thresholds:** hand-set from the level curve and the time curve together.
  - Pure time-even spacing piles tiers onto the slow tail (motorTuning would get 1/14/22/24/25).
  - Pure level-even spacing ignores the burst techs.
  - The first MK II arrives early (gearRatio L6 at about 4 min) so the player learns the feature in the first minutes.

Measured with `runGreedy` (`src/simulation/sim/greedy.ts`), stopping at `primaryFunction`.
- Profiles:
  - A: 4 cps, buy every 1 s
  - B: 4 cps, buy every 30 s
  - C: 1 cps, buy every 30 s
- `primaryFunction` is reached at 250 / 264 / 428 min.
- Script: `scratchpad/WP22-23/work/tiers.ts`, bundled with esbuild.

### 1.2 Thresholds per tech (minutes = when the tier is reached in profiles A / B / C)

| tech (era, maxLevel) | reach | tiers | MK levels | min A | min B | min C | fold-in / note |
|---|---|---|---|---|---|---|---|
| gearRatio (I, 15) | 15 | 3 | 1 / 6 / 15 | 0/0/2 | 1/4/13 | 1/4/13 | first MK II of the game |
| flywheel (I, 10) | 10 | 3 | 1 / 4 / 10 | 5/10/46 | 18/21/58 | 20/33/110 | |
| motorTuning (I, 25) | 25 | 5 | 1 / 5 / 10 / 20 / 25 | 0/1/2/9/36 | 4/8/13/20/48 | 4/8/13/30/90 | proof part |
| improvedPistons (I, 25) | 25 | 5 | 1 / 5 / 10 / 20 / 25 | 13/20/48/140/216 | 22/29/59/154/230 | 40/56/113/241/381 | |
| copperWinding (II, 25) | 25 | 5 | 1 / 5 / 10 / 20 / 25 | 30/31/32/45/79 | 39/41/44/58/92 | 76/78/81/111/193 | coilStage1/2/3 at 1/10/20 = MK I/III/IV, kept |
| motorRetrofit (II, 20) | 19 | 5 | 1 / 4 / 8 / 13 / 18 | 31/44/61/137/224 | 40/56/74/151/238 | 79/107/137/228/392 | top 18 = reach - 1 slack |
| transformer (II, 20) | 20 | 5 | 1 / 4 / 8 / 13 / 20 | 33/35/41/59/154 | 46/49/54/72/169 | 83/89/102/145/324 | |
| firebox (III, 25) | 25 | 5 | 1 / 5 / 10 / 20 / 25 | 69/73/81/93/107 | 82/86/94/106/121 | 167/171/181/212/246 | fireboxGlow1/2/3 at 1/10/20 = MK I/III/IV, kept |
| inductionHeater (III, 20) | 20 | 5 | 1 / 4 / 8 / 13 / 20 | 68/73/102/152/234 | 81/86/115/167/249 | 167/179/240/322/409 | |
| condenser (III, 20) | 20 | 5 | 1 / 4 / 8 / 13 / 20 | 87/92/103/118/156 | 100/105/117/132/171 | 197/210/236/273/326 | |
| bellowsDrive (III, none) | 4 | 3 | 1 / 2 / 3 | 75/115/169 | 87/127/183 | 165/206/321 | growth 2.5 |
| harmonicCoil (IV, 25) | 25 | 5 | 1 / 4 / 8 / 16 / 25 | 121/122/124/132/136 | 135/137/139/147/152 | 281/282/284/293/299 | coilRing1-4 at 1/8/16/25 = MK I/III/IV/V, kept |
| pressureResonator (IV, 20) | 19 | 5 | 1 / 4 / 8 / 13 / 18 | 122/135/154/185/238 | 136/149/169/200/253 | 283/300/324/362/413 | top 18 = reach - 1 slack |
| crankServo (IV, 10) | 7 | 3 | 1 / 4 / 7 | 121/147/237 | 135/161/251 | 281/296/407 | |
| standingWave (IV, 20) | 20 | 5 | 1 / 4 / 8 / 13 / 20 | 135/137/142/154/195 | 152/154/158/170/210 | 298/301/307/324/374 | |
| gridExciter (IV, none) | 15 | 3 | 1 / 7 / 14 | 122/160/243 | 135/175/257 | 281/331/419 | |
| containmentRing (V, 25) | 25 | 5 | 1 / 4 / 8 / 16 / 25 | 172/174/176/181/182 | 188/190/192/199/205 | 347/349/352/359/365 | ring{n} at 1/8/16/25 = MK I/III/IV/V, kept |
| resonantSiphon (V, 20) | 11 | 3 | 1 / 5 / 10 | 180/215/241 | 195/230/255 | 357/402/417 | **retune** stage gates 10/20 to 5/10 (L20 is never reached today) |
| graviticAnchor (V, 10) | 3 | 3 | 1 / 2 / 3 | 173/190/232 | 187/204/246 | 348/356/402 | **retune** anchorGlow2/3 gates 5/10 to 2/3 (L5 and L10 are never reached today) |
| mainsBackfeed (V, none) | 8 | 3 | 1 / 4 / 7 | 174/207/240 | 189/222/255 | 349/390/416 | |
| steamLance (V, none) | 13 | 3 | 1 / 7 / 12 | 171/190/241 | 187/205/255 | 347/368/416 | |
| horizonField (V, 20) | 20 | none | | | | | world-only response (horizonGlow / skyViolet / eclipse stages) stays as is; no MK marks, so "MK" means machine parts only |

Cadence: 21 tracks give 66 tier-ups per run.
- Profile B: 2 to 7 tier-ups per 15 min, longest gap 12.5 min, about one tier-up every 4 min on average.
- Profile C: longest gap 26.5 min, all in the slow Era I-II stretch. motorRetrofit, transformer and improvedPistons fill it.
- Demo (Eras I-II, capped at substationBlueprint): every Era I-II track reaches MK III or more, and motorTuning and copperWinding reach MK V. The demo showcases the feature in full.

### 1.3 Folding in the existing staged visuals

- **Unchanged and named as tiers:** coilStage1/2/3 and fireboxGlow1/2/3 at 1/10/20, plus coilRing1-4 and ring{1-4}Back/Front/Bead at 1/8/16/25.
- **Gaps filled with swaps or one new component:**
  - copperWinding and firebox: MK II and MK V are filled by texture swaps on the stage-1 and stage-3 sprites.
  - harmonicCoil: MK II is a texture swap on coilRing1.
  - containmentRing: MK II is one new orbit component (see §2.3). Its ring assets carry restored variants, so no texture swap is allowed there.
- **Retunes (data only):** resonantSiphon stages 2/3 move from minLevel 10/20 to 5/10, and graviticAnchor glows 2/3 from 5/10 to 2/3. Today those visuals show up only in the finale showcase.
- **Beat routing:** a staged component that becomes visible keeps its fly-in, which already reads as an upgrade. It also fires the tier toast mark and the tier-up sound, but not the swap beat.

## 2. Visual tier language

### 2.1 Ladder (applies to every host)

| tier | name | material | silhouette | light / FX | animation |
|---|---|---|---|---|---|
| MK I | SALVAGED | Shipped art. Rust as clustered patches, caked dust in the sand ramp, odd or missing bolts. | as found | none | as now |
| MK II | PATCHED | Flaking bright rust (`#ad6236 #8c4a2a #6e3a22`) knocked off to value-matched iron. Dark stains (`#4e2a1a`) stay, low down. Riveted patch plates (fill `#5a5f63`, lit edge `#7d8286`, rivets `#a3a6a4`). New bright bolt heads. | +1 small bolt-on (patch, bolt, clamp) | none | — |
| MK III | REINFORCED | Rust 0 outside identity marks; dust cleaned. Machined rim highlights on the lit (upper-left) edges. | **+1 structural element that reads at 1 px:** clamp band, gusset, strap, radiator, extra saddle. A vertical element on horizontal-ribbed parts, and the reverse. | none | — |
| MK IV | TUNED | Iron straps become **brass hoops** (rust ramp in clean, straight bands with an `#ffd27a` glint; per ART_ERA2 copper/brass is the rust ramp in clean bands, rust is patches). Plates re-enamelled (field `#c9b28a`). Small safety-orange `#d9822b` mark on the guard of a moving part (ANSI Z535 machine-hazard orange). | +1 instrument or cover (fan cowl, sight glass, oiler, valve wheel) | brass glint | — |
| MK V | AS BUILT | Flawless: no rust, no dust, polished top edges. A **warm seam** (1 px `#d9822b` with a `#f0a848` core) along one structural line. | +pilot lamp (3x3 `#ffd27a` core, `#f0a848` cross, `#d9822b` corners, ink ring) | **Heartbeat:** lamp and seam alternate `#t5` / `#t5b` (one ramp step dimmer) on ONE global clock (period 2.4 s), so every MK V part pulses in unison. | vibrate hosts: amplitude reduced (tuned = balanced) |

Story reading. The machine is secretly a restoration engine, and it fixes itself before it fixes the world.
- **Repair, not decoration.** MK II-IV read as a mechanic's honest repair arc. Order of work: mechanical first (patches, bolts), then structural (bands), then finish (paint, brass). Paint comes last, as in real motor overhauls.
- **The uncanny top tier.**
  - MK V is called AS BUILT, not "upgraded": the part returns to a state older than the wasteland.
  - It looks too new for this world, and it starts to breathe in step with every other MK V part.
  - Late in the run the machine pulses as one organism. That feeds the mystery and is not just "better".
  - The motor's MK V lamp sits in the end bell like an eye.
- **Foreshadowing without spoiling.** The warm lamp colour matches the finale's restored-variant lamps (A17 `restored.py` LAMP map), so the finale rhymes with what the player has been building.
- **What MK V must avoid:** no green or blue, no regrowth tones and no `RESTOR` text (store-shot `no_spoiler`). The finale's world restoration stays the payoff.

3-tier tracks use SALVAGED → REINFORCED → AS BUILT. Their MK II merges the patch and band steps; MK III merges finish, lamp and heartbeat.

### 2.2 Readability and identity gates (Art Director checks every variant)

| gate | rule |
|---|---|
| G1 step | Each tier differs from the previous one by a silhouette or structural change of at least 4 art px, **or** at least 4 px of new brass or accent, **and** the rust share drops. Target: MK II is 30 % or more below MK I; MK III has 0 rust outside identity marks. Brass from MK IV on is rust-ramp colour in straight bands and does not count as rust. |
| G2 identity | Every opaque pixel of MK I stays opaque in later tiers. Colour may change; the outline, mounting points and identity marks stay (motor: plate footprint, shaft, feet). |
| G3 contract | Same canvas, origin, frame count and frame layout. Alpha is 0 or 255. Locked palette: Rust Wasteland plus the era extensions already used by that host. Reserved zones stay empty: other parts' sockets, belt and cable paths, `MACHINE_BOUNDS`. |
| G4 craft | `pixelart_workbench lint`: 0 errors. `score` at or above MK I score minus 3. |
| G5 scale | Every step must read at zoom 0.5 (1 screen px per art px) in the era where the tier is usually reached. Check it on a real screenshot crop, not only at 4x. |

### 2.3 Per-host deltas

Rot = RotSprite sheet host. Palette maps are per-pixel exact colour maps applied to the PNG **and** its rot sheet (the `scripts/art/a17/restored.py` method, with no re-rotation).
- **DERUST-LIGHT:** `#ad6236→#7d8286`, `#c98552→#a3a6a4`, `#8c4a2a→#5a5f63`
- **DERUST-FULL:** DERUST-LIGHT plus `#6e3a22→#3e4246`, `#4e2a1a→#3e4246`, `#2e1a12→#2b2e31`
- **POLISH:** DERUST-FULL plus `#3e4246→#5a5f63` on rows lit from the upper left; in practice that means the whole sheet.

| tech | host component(s) | method | MK II | MK III | MK IV | MK V |
|---|---|---|---|---|---|---|
| gearRatio (3) | gearLarge, gearSmall, mainShaft (rot 140/80/140) | rot palette swap + 1 static decal | (REINFORCED) DERUST-LIGHT on all 3 sheets: the teeth lose the orange scale; stains stay | (AS BUILT) DERUST-FULL plus POLISH on all 3 sheets. Decal `machine.gearRim` (64x64, static brass annulus r22-23 on the gearLarge rim, `#c98552`/`#8c4a2a`, `#ffd27a` glint arc at the upper left), bias +0.5. Hubs are covered by the pulley and crank, so there is no hub decal. | — | — |
| flywheel (3) | flywheelPedestal (static 48x64); flywheel, flywheelPulley, crankPulley (rot 180/180/80) | static swap + rot palette swap + decals | (REINFORCED) pedestal `#t2`: rust off, gusset plates at the leg feet, 2 bright anchor bolts per foot. Decal `machine.flywheelRim2` (96x96 static annulus over the rim, clean iron: lit arc `#a3a6a4` upper-left, shadow arc `#1f2225` lower-right) = re-tyred rim | (AS BUILT) DERUST-FULL on flywheel, flywheelPulley and crankPulley. Pedestal `#t3`: brass bearing cap, 2x2 warm sight-glass lamp on the bearing (heartbeat). Decal `machine.flywheelRim3` = rim2 plus a 1 px brass inlay ring (`#c98552`), drawn over rim2. | — | — |
| motorTuning (5) | wornMotor (vibrate 64x48), motorPlinth (static 48x10); optional motorPulley (rot 24) | static swap (proof done) | 2 riveted patch plates (NDE bell low; fins upper DE side), flaking scale off, bright bolts on feet and bell ties; plinth derust + 2 bolts | rust 0, dust cleaned, 2 iron clamp bands across all fins (rivets every 9 rows), machined bell rims, foot flanges 2 px wider and bolted; patches stay | TEFC fan cowl on the NDE (silhouette +5 px left), patches gone (re-cast), bands become brass hoops, nameplate re-enamelled (cream + orange hazard band, same footprint), shaft polished, plinth top edge polished; motorPulley POLISH optional | pilot "eye" lamp in the NDE bell, warm seam in the lower fin slot (row 27), brass foot and plinth bolts, heartbeat `#t5b`, vibrate amplitude 1 → 0.5 |
| improvedPistons (5) | pistonArray (static 96x58); optional pistonYoke (slider 80x16) | static swap | left upright and base derusted, bright gland nuts on the 3 heads, patch on the manifold pipe | 2 iron hoops per cylinder barrel; diagonal tie-rod braces in the see-through gap under the cylinders (biggest silhouette change on this part) | brass gland caps with glint, piston rods polished (1 px `#a3a6a4`), brass oiler cups on the manifold, orange bands on the base-beam ends | pressure lamp at the manifold centre (heartbeat), warm seam along the base-beam top |
| copperWinding (5) | coilStage1/2/3 (64x40) | static swap on 2 stages | `machine.coils1#t2`: windings re-laid tight, sand-ramp tape (`#c9b28a`) at both ends, 1 glint | coilStage2 (existing) | coilStage3 (existing) | `machine.coils3#t5`: varnish line `#ffd27a` along the top turn, warm seam between the 2 coils. No heartbeat: the generatorGlow gauge already lives here. |
| motorRetrofit (5) | motorRetrofitKit (vibrate 32x16) | static swap | box derust, bright cable gland | second insulator (cyan ramp), strap clamp down to the motor top | brass terminal studs, orange "live" stripe on the lid | warm pilot lamp on the box face (heartbeat). Stays inside 32x16. Must not cover more of the motor. |
| transformer (5) | transformer (vibrate 64x64) | static swap (PixelLab edit + snap for the radiator) | rust cleaned off the tank base rows, sight glass cleared (`#bff0ec`), new lid bolts | radiator panel bank on the right flank: vertical fins 4 px proud, rows 20-60. Real ONAN cooling stage. | cooling fan on the radiator (real ONAF stage: fans raise the rating), brass bushing caps, orange danger plate | warm lamp on the lid, warm seam at the lid joint (heartbeat) |
| firebox (5) | fireboxGlow1/2/3 (frames 4, 24x24) | 4-frame sheet swap | `machine.fireGlow1#t2`: flame +2 px, ember row brighter (ember ramp) | glow2 (existing) | glow3 (existing) | `machine.fireGlow3#t5`: steam-white core (`#e8e0cc`) in all 4 frames |
| inductionHeater (5) | inductionHeater (static 56x40) | static swap | copper bars cleaned: patches become clean bands | 2 horizontal iron clamp straps across the 7 bars | water-cooling pipe along the bottom with a brass valve; brass bus bar on top | bar highlight column warm (`#f0a848`, "heated"), lamp on the insulator box (heartbeat) |
| condenser (5) | condenser (static 80x24) | static swap | 4 rust patches off, bright rivets | 2 extra support saddles + tube-sheet bands | sight glass (cyan), brass drain cock, orange pipe band | lamp at the right end cap, warm seam along the shell joint (heartbeat) |
| bellowsDrive (3) | bellows (frames 4, 60x28) | 4-frame sheet swap | (REINFORCED) leather patched (sand-ramp patches), iron straps on both boards | (AS BUILT) brass nozzle and hinges, lamp on the iron leg (same position in all 4 frames; heartbeat) | — | — |
| harmonicCoil (5) | coilRing1-4 (frames 4) | 4-frame sheet swap on ring 1 | `machine.coilRing1#t2`: copper re-wound (patina gone), verdigris spots become cyan glints | ring2 (existing) | ring3 (existing) | ring4 (existing) |
| pressureResonator (5) | calliope (static 72x40) | static swap (PixelLab edit + snap for the whistle) | whistles derusted (clean copper) | 4th, smallest whistle between 2 and 3, strap bracket | brass valve wheel, orange throttle lever | lamp on the manifold, warm whistle mouths (heartbeat). Optional audio: calliope burst chord +1 note per tier (`src/data/audio.ts`). |
| crankServo (3) | servoBase (static 28x20), servoArm (rot 80) | static swap + rot palette swap | (REINFORCED) base derust, gusset, bright bolts; arm DERUST-FULL | (AS BUILT) base brass cover + lamp (heartbeat); arm POLISH | — | — |
| standingWave (5) | spireWave (frames 8, 16x270) | **procedural** 8-frame sheets (Python, exact) | harmonic mode 2 (2 antinodes over 270 px) | mode 3 | mode 4 | mode 5. Amplitude scales with 1/sqrt(n); same cyan/verdigris palette. Physics-true cue: higher modes have more nodes. |
| gridExciter (3) | exciterFeed (static 16x28) | static swap | (REINFORCED) 2 more insulator discs, brass ferrule | (AS BUILT) warm lamp at the base (heartbeat) | — | — |
| containmentRing (5) | ring{1-4}Back/Front/Bead | 1 new component | new orbit component `ring1Bead2` (asset `machine.ringBead`, same orbit as ring1Bead, `phi0Deg: 180`: the orbit field, ring1Bead has `phi0Deg: 0`). It inherits the restored swap, so RESTORED_TOTAL goes 33 → 34. | ring2 (existing) | ring3 (existing) | ring4 (existing) |
| resonantSiphon (3) | siphonTube{1-3}L/R, siphonArcs1-3 | data retune | stage 2 at L5 | stage 3 at L10 | — | — |
| graviticAnchor (3) | anchorGlow{1-3}L/R | data retune | glow 2 at L2 | glow 3 at L3 | — | — |
| mainsBackfeed (3) | backfeedTerminal (static 16x28) | static swap | (REINFORCED) extra insulator skirt, cable clamp | (AS BUILT) brass cap + warm lamp (heartbeat) | — | — |
| steamLance (3) | steamLance (static 16x32) + lance steam emitter | static swap + `steamFx` data | (REINFORCED) new bright valve wheel, iron collar | (AS BUILT) brass nozzle + warm lamp (heartbeat); lance emitter scale x1.25 per tier (`src/data/steamFx.ts`) | — | — |

Rotating-part rule: a static decal over a spinning part must be **rotationally symmetric**: rims, rings, plain discs, a centred lamp. No bolts, spokes or text. The light comes from the upper left, so a fixed highlight arc on a turning wheel is physically right. A bolt that does not turn is not.

## 3. The tier-up moment

### 3.1 Full-motion beat (data: `PART_TIER_FX` in `src/data/machineTiers.ts`)

| t (ms) | what | detail |
|---|---|---|
| 0 | anticipation | ratchet tick (audio), no movement |
| 0-120 | heat flash | 2 steps: a silhouette image of the **old** texture filled `#f0a848` at alpha 0.85, then `#ffd27a` at 0.6, 60 ms each. The host sprite is not tinted. |
| 120 | swap | host `setTexture(resolveTierKey(...), sameFrameIndex)` |
| 120-370 | old-shell ghost | pooled image of the old texture, checker-dithered `#c98552`, at the host origin. Scale 1 → 1.12, alpha 0.8 → 0. It expands from the host origin, so bottom-origin parts grow upward. |
| 120-620 | debris tells the step | 8 to 10 pooled 1x1 art px particles, by step: I→II rust flakes (`#8c4a2a #ad6236 #6e3a22`) falling (gravity 120 art px/s², fade 500 ms); II→III grey scale chips (`#5a5f63 #3e4246`) falling; III→IV sparks (`#ffd27a #f0a848`) shooting up and out, 300 ms; IV→V warm motes (`#ffd27a #e8e0cc`) rising slowly, 900 ms (rhymes with the Era IV rising dust) |
| 350, 450 | bolt-down | 3-pixel `#ffd27a` spark crowns at the host's two mount points (bottom corners inset 4 art px, or `mounts` from data), each with a ratchet tick pitched up one step |
| 550-800 | shine sweep | diagonal 2 px band, `#ffd27a` / `#ddc9a3` checker, clipped to the **new** texture alpha, upper-left → lower-right, 4 frames. Built on demand as a CanvasTexture from the new key; LRU cache of 8. Rot hosts skip it: they turn under it. |
| 600 | settle | `shake()` at 0.5x the landing amplitude, bell "ting" (FM, sfx bus) |
| (on purchase) | toast | The existing purchase toast gains the mark: `MOTOR TUNING — LV 5 · MK II`. It fires on the `purchase` event, not on the beat. Template in `src/data`. |

- Storyboard: `proof-tiers/motor-tierup-storyboard-3x.png`.
- Total: 900 ms.
- Position untouched: the animator writes position every frame for vibrate, slider and orbit kinds, so the beat uses only overlay images, scale on the ghost, and the texture swap.

### 3.2 Between tiers: torque tick

On every level purchase that does not change the tier:
- The visible host gets one 3-pixel spark at alternating mount points.
- A ratchet tick plays, its pitch `base · 2^(k/12)`, where k = levels already bought inside the current tier. The pitch ladder resets at each tier-up, so the player *hears* the next mark approaching.
- No flash.

In the TECH INDEX detail (no CSS): `levelText` becomes `LV 7 / 25 · MK II — MK III AT LV 10`. At the top tier it reads `LV 25 / 25 · MK V AS BUILT`. Strings live in `src/data`, follow the textSweep rules, and contain no `RESTOR`.

### 3.3 Queueing, camera, input

- **TECH INDEX hold.** Most purchases happen in the TECH INDEX, so beats follow the fly-in hold (`MachineView.assemblyHold`, `ASSEMBLY_QUEUE` stagger 120 ms, max 8 steps).
  - Per host only the final tier change plays. Its debris type comes from the last step crossed.
  - Torque ticks collapse to one per host.
  - Beats above the cap (`PART_TIER_FX.maxBeatsPerRelease` = 4, WP22 D6) swap instantly with debris only.
  - On close, the existing centroid nudge (`camera.nudgeToward`, `CAMERA_NUDGE` max 160 world px) includes the tier-beat hosts.
- **Outside the tree** (keyboard buys, future buy hooks): nudge toward the host only when all three hold:
  - its world box is not inside the view rect minus 48 px;
  - there was no manual pan or zoom in the last 3 s;
  - no camera override is active (finale, photo).
- **Never blocks input.** No modal, no input lock, all FX non-interactive; the crank hit zone is untouched. A new beat on a host that is mid-beat finishes the old one instantly first.
- **Pools, created once in MachineView and hidden when idle:** 64 particles (debris, bolt crowns and torque sparks; an empty pool skips the request), 4 flash images, 4 ghosts, 4 shine images. The beat unit is one change per track; its FX run on its primary host only (WP22 D7). Nothing is created or destroyed per beat, as the soak gates require. Machine sprites render into the RT, so `displayObjects()` does not change.

### 3.4 Reduced motion (`motionPolicy`)

- No flash, ghost scale, shake, falling debris or shine sweep.
- Instead: a 250 ms crossfade (pooled old-texture image, alpha 1 → 0) and 4 static `#ffd27a` glint pixels at the mount points, held 400 ms, then gone.
- Sound and toast as normal. Mute and the sfx volume are honoured.
- The heartbeat stays: 0.42 Hz, one ramp step, far below 3 flashes/s. It is ambient machine animation, which reduced motion keeps.

### 3.5 Other paths

| path | behaviour |
|---|---|
| load / `sync()` | tiers applied instantly, no beat |
| `reset` / new cycle (white peak) | `sync()` snaps every host back to MK I |
| `buyPerk` (prestige start levels, no `purchase` event) | MachineView also subscribes to `'prestige'`: tiers applied instantly and the tier baseline reset; no `sync()` (buyPerk emits `'unlock'` first, and its fly-ins must still land and clunk, WP14); no beat, no signal |
| finale completion (`refreshDisplay`), teaser (`ShowcaseScene.applyLevels`) | instant swaps, no beat: the film owns the moment. P2 option: one shine sweep across all MK V parts at S3. |
| restored swap (finale, postgame) | `applyRestoredTextures` goes through the same resolver. Restored wins for restored ids; no asset has both `tiers` and `restored` (guard test). |
| demo | Era I-II tracks are live in the demo; all assets already ship in `dist-demo` |

### 3.6 Audio (`src/data/audio.ts`, new `Synth` methods)

- `refit`: 3 noise ratchet ticks rising, then the FM bell at settle. One at a time; queued beats reuse the voice.
- `torqueTick(k)`: one noise tick at the pitch ladder. At most 3 concurrent; extras are dropped.
- Voices stay well under the cap (48 live, growth ≤ 8).

## 4. Engineering spec (for EM → workers)

1. **`src/data/machineTiers.ts`** (pure).
   - `PartTierTrack`:
     - `{ techId; levels: readonly number[]; swaps: readonly MachineComponentId[]; decals?: readonly TierDecal[]; stages?: readonly MachineComponentId[]; vibrateAmplitude?: readonly number[]; pulse?: { fromTier: number }; mounts?: Partial<Record<MachineComponentId, readonly Vec2[]>> }`
   - `TierDecal`:
     - `{ id: string; host: MachineComponentId; assetId: AssetId; fromTier: number; depthBias: number }`
   - Constants: `PART_TIERS` (the §1.2 table, without horizonField), `TIER_MARKS`, `TIER_NAMES_5`, `TIER_NAMES_3`, `PART_TIER_FX` (§3 numbers), `TIER_HEARTBEAT = { periodMs: 2400 }`.
2. **Manifest** (`src/assets/manifest.ts`).
   - Field: `tiers?: { from: number; file: string; rotationFile?: string }[]`. `from` is the tier number, so sparse variants are allowed: coils1 has only 2, coils3 only 5.
   - Keys: `${id}#t${n}` and `${id}#t${n}#rot`. `#rot` stays **last** (`MachineAnimator.applyAngle` / `angleOf` test `endsWith('#rot')`).
   - Optional pulse frame: `${id}#t5b`.
   - `planAssetLoads` plans them after the restored loads.
   - Decal assets are new AssetIds: `machine.gearRim`, `machine.flywheelRim2`, `machine.flywheelRim3`.
3. **`src/game/math/partTiers.ts`** (pure). It replaces the inside of `swapTextureKey`.
   - `tierOf(level, levels)`: level 0 counts as tier 1.
   - `partTierMap(techLevels)`.
   - `resolveTextureKey(assetId, { tier, restored, rot, pulseLow }, has)`. Precedence: restored, then the highest existing `#tk` with k ≤ tier, then base. It never drops `#rot`.
4. **MachineView** (`src/game/entities/MachineView.ts`).
   - Initial key (`:126-128`) goes through the resolver.
   - `sync()` applies tiers instantly.
   - `refresh()` diffs the tier map after the visibility diff and runs the beat (§3) on visible, non-assembling hosts, respecting `assemblyHold`.
   - Subscribe to `'prestige'`: apply tiers instantly and reset the tier baseline only (no `sync()`, no `stopAssemblies`).
   - Decal sprites are created once in the `parts` container at the host attachment, with host depth + bias, visible when the host is visible and its tier ≥ `fromTier`.
   - Emit `feedback.partEvolved` (new `Signal` in `src/game/context.ts:10`); `gameAudio.ts:422` plays the refit sound.
5. **MachineAnimator.**
   - `setTiers(map)` and `applyRestoredTextures` both call the resolver and keep `frameIndexOfName` (`:608`). One owner per sprite texture.
   - Heartbeat: for `pulse` hosts at the top tier, `pulseLow = floor(elapsed / (periodMs/2)) % 2`, using the shared clock so all parts stay in phase.
   - `vibrateAmplitude[tier-1]` overrides `anim.amplitude`.
6. **Showcase** (`src/game/math/showcase.ts:58-63`).
   - For each track, `raise(levels, techId, last(levels))`.
   - Finale completion, postgame, photo mode and the teaser then show top tiers.
   - Snapshot `showcase.test.ts:18-26` gains motorTuning 25, improvedPistons 25, gearRatio 15, flywheel 10, etc.; ABSENT keeps horizonField, finalAlignment and primaryFunction.
7. **Tech tree view.** `levelText` in `src/ui/techTreeView.ts` `detailOf` (`:267`) is extended with the MK text (§3.2). The live purchase toast is `purchaseBurstMessage` (`src/ui/notificationRules.ts:180-190`, via `toasts.ts:163-171`; `messageFor` `purchase` is not on the live path). It appends ` · MK n` (the tier of `toLevel`) when `tier(fromLevel) < tier(toLevel)`, so a burst `LV 3 → 6` that crosses L5 shows the mark.
8. **Retunes** (`src/data/machineComponents.ts`).
   - siphonTube2L/R, siphonArcs2: minLevel 10 → 5.
   - siphonTube3L/R, siphonArcs3: minLevel 20 → 10.
   - anchorGlow2L/R: 5 → 2.
   - anchorGlow3L/R: 10 → 3.
   - New component `ring1Bead2`, appended at the end of `MACHINE_COMPONENT_IDS`.
9. **Debug hook.** `partTiers(): Record<TechId, number>`, `tierBeatsActive(): number`. `textureKey(id)` exists already.
10. **Tests.**
    - New `machineTiers.test.ts` checks:
      - levels ascending, `[0] = 1`, length 3 or 5, top ≤ maxLevel;
      - the 3-or-5 rule against the reach table;
      - swap hosts exist and are not restored ids;
      - every declared variant has the same size and frames as its base;
      - decals stay inside the host box and `MACHINE_BOUNDS`;
      - every repeatable except horizonField has a track.
    - New `partTiers.test.ts`: tierOf, resolver precedence, sparse variants, `#rot` last.
    - Existing tests to update:
      - `manifest.test.ts:361-380`: the `#rot` filter must use `=== id + '#rot'`, or it picks up `#tN#rot`.
      - `manifest.test.ts:345-348`: 14 rotation ids unchanged.
      - The 117-id counts, if decal AssetIds are added.
      - `machineComponents.test.ts`: Era V contract tables for the retunes, plus the count 104 → 105 for `ring1Bead2`.
      - `restoredTextures.test.ts`: 33 → 34.
      - `assetGuide.test.ts`: table regenerated with `ASSET_GUIDE_OUT`.
11. **Smokes.**
    - `stages.mjs`: buy motorTuning to 5/10/20/25 and assert `textureKey('wornMotor')` is `machine.motor#t2..#t5`.
    - `showcase.mjs`: top tiers in the full machine; RESTORED_TOTAL 34.
    - `perf.mjs`: run a burst of 8 beats during the `machineMeanMs` window (gate 4 ms).
    - `soak.mjs`: display and DOM flat across beats.
    - `store-shots.mjs`: regenerate; beats finish by 1 s and shots are at ≥ 2.5 s.
    - `ux.mjs`: one-prompt rule unchanged.
    - STEAM_RELEASE §15 evidence re-run.

## 5. Production plan

### 5.1 Method per host

| method | hosts | tool | notes |
|---|---|---|---|
| **A. Scripted hand-pixel stamps** (proof method) | wornMotor, motorPlinth, motorRetrofitKit, coils1/3, fireGlow1/3, condenser, inductionHeater, servoBase, exciterFeed, backfeedTerminal, steamLance, flywheelPedestal, bellows (4 frames), coilRing1 (4 frames) | Python + PIL char-grid edits on the shipped PNG (template: `scratchpad/WP22-23/tools/motor_tiers.py`); then `pixelart_workbench lint` + `score` | Exact palette, identity kept by construction, free. About 1 h per 5-tier host. |
| **B. PixelLab `edit_image` from the current tier, then palette snap + hand fix** | transformer (radiator, fan), calliope (4th whistle), pistonArray (tie-rod braces, hoops) | `edit_image(image_urls=[upload:<tier n-1>])` at ~10 gens; nearest-palette snap; hand-correct with method A | Proof finding: the edit kept silhouette and identity, but **100 % of pixels were off-palette** (median ΔRGB 3.7, p90 27 after snap) and it put the asked-for bands at the wrong place. Always snap and correct. Never ship raw. |
| **C. Palette-map scripts on rot sheets** | gearLarge, gearSmall, pulleyMain, flywheel, pulleyFlywheel, pulleyCrank, servoArm (+ optional pulleyMotor) | new `scripts/art/tiers/palette_tiers.py` (clone of `scripts/art/a17/restored.py`: map applied to the PNG and its rot sheet, no re-rotation) | Frame counts unchanged (ratio lock 80/140, 180/180). `make_rot.py` is not needed. If ever needed: pass SRC explicitly on Windows (`make_rot.py` has a hard-coded Linux path at `:9`). |
| **D. Procedural** | spireWave modes 2-5 | Python: sin(nπy/L)·cos(ωt) per frame, 8 frames, same palette as `spire-wave.png` | Exact and repeatable |
| **E. Decals** | `machine.gearRim`, `machine.flywheelRim2`, `machine.flywheelRim3` | method A (an annulus is pure geometry) | Must be rotationally symmetric (§2.3) |

PixelLab inpaint lesson from the proof: an inpaint mask laid over transparent margin (8x25 at the motor's left edge) returned almost nothing, and the 10 generations were wasted. To add new geometry, block it in first (method A), then inpaint over the sketch.

### 5.2 PixelLab budget

- Balance: **3,796 generations** left (Tier 2, resets 2026-11-10). The proof spent 20 (1 inpaint + 1 edit).
- Estimate:
  - Method B: 3 hosts × 3 tiers × 10 gens × 2 tries = **180**.
  - Inpaint repairs: ~15 × 10 = **150**.
  - Contingency: 150.
  - **Total about 480 generations (13 % of the balance).** Everything else is free (scripts and workbench).

### 5.3 Texture budget (RGBA decoded; current total 36.8 MiB)

| item | count | decoded MiB |
|---|---|---|
| rot palette swaps: gear set (gearLarge 768², gearSmall 360², pulleyMain 288²) × 2 tiers | 6 sheets | 6.12 |
| rot palette swap: flywheel set (1344x1248, 392x364, 288²) × 1 tier (MK III only; MK II is decals) | 3 sheets | 7.26 |
| rot palette swaps: servoArm (432²) × 2 | 2 | 1.42 |
| rot: pulleyMotor (60²) × 1 (optional) | 1 | 0.01 |
| static swaps (≈ 60 PNGs, largest spireWave 128x270 × 4 = 0.53) | ~60 | ≈ 1.3 |
| decals (64², 96² × 2) + pulse frames | ~12 | ≈ 0.1 |
| **total added** | | **≈ 16.2 MiB → ≈ 53 MiB** |

- Disk: about +1.1 MB of PNG (flywheel rot tier about 573 KB). `publicAssetsKb` goes 1486 → about 2600 of 8000.
- Boot: everything is loaded up front, so `bootMs` (3000) must be re-measured.
- Mitigation if boot regresses: load `#t*#rot` sheets in a background `load.start()` on the World scene's loader, started from MachineView after create (`BootScene.ts:45` `scene.start('World')` shuts Boot down, so Boot cannot run a second load; WP22 T13). The resolver's `has()` fallback shows the lower tier until the sheet arrives. MK III flywheel is needed at the earliest 46 min in.
- GPU and decoded memory are not gated (`heapMb` counts `usedJSHeapSize` only).

### 5.4 Files, ids and ASSET_GUIDE

- **Files:**
  - `public/assets/machine/tiers/<stem>-t<n>.png`
  - rot sheets: `public/assets/machine/tiers/rot/<stem>-t<n>-rot.png`
  - pulse frames: `<stem>-t5b.png`
  - decals: `public/assets/machine/tiers/decals/<name>.png`
- **Keys:** `machine.motor#t2` … `machine.motor#t5`, `machine.motor#t5b`, `machine.gearLarge#t3#rot`.
- **ASSET_GUIDE:**
  - New section "Part evolution tiers": ladder (§2.1), gates G1-G5, rotating-decal rule, reserved zones per host, and the pipeline.
  - `fileCell` (`assetGuide.test.ts:98-106` pattern) lists tier variants the way it lists restored ones.
  - New rows for the 3 decal AssetIds.
  - Regenerate the table with `ASSET_GUIDE_OUT`.

### 5.5 Waves

| wave | scope | why first |
|---|---|---|
| P0 | engine (§4.1-4.7, 4.9-4.11) + Era I-II art: motorTuning (proof → ship), gearRatio, flywheel, improvedPistons, copperWinding, motorRetrofit, transformer | the user's complaint lives in the first hour; it is all demo scope |
| P1 | firebox, inductionHeater, condenser, bellowsDrive, harmonicCoil, pressureResonator, crankServo, standingWave, gridExciter | mid-game hosts |
| P2 | §4.8 retunes, ring1Bead2, mainsBackfeed, steamLance; optional finale shine wave and calliope chord | Era V burst techs; small art |

## 6. Web references (what to borrow)

1. **Clash of Clans, Builder Base Cannon and Double Cannon** ([Cannon/Builder Base](https://clashofclans.fandom.com/wiki/Cannon/Builder_Base), [Double Cannon](https://clashofclans.fandom.com/wiki/Double_Cannon); summary via search, the pages returned HTTP 402 when fetched).
   - The look changes only at chosen levels, not every level.
   - Early form: plain dark barrel on a wooden mount; later: stabilizers, then ridges and a metal mount.
   - Copper and gold accents *spread across bands, plates and foundation* as level rises.
   - **Borrow:** milestone-only changes, a material ladder, and accents that spread outward from bands. That is our iron band → brass hoop step.
2. **Factorio assembling machine 1/2/3 and belt tiers** ([Assembling machine 2](https://wiki.factorio.com/Assembling_machine_2), [Fast transport belt](https://wiki.factorio.com/Fast_transport_belt)).
   - Each tier is a fixed step in capability (belt "operating at double speed"; assembler 0.75 → 1.25 speed, more module slots).
   - Each tier has its own fixed look. The tier colours (belts yellow/red/blue) are from the AD's knowledge; the fetched pages did not state them.
   - **Borrow:** one dominant cue per tier that reads at the smallest zoom, and the same cue across every part. Our cues: rust → bolts → band → brass → lamp.
3. **Stardew Valley tool upgrades** ([Tools](https://stardewvalleywiki.com/Tools), [Blacksmith](https://stardewvalleywiki.com/Blacksmith)).
   - 5 ordered tiers (basic, copper, steel, gold, iridium) on a fixed silhouette, upgraded in order.
   - The sprite look per tier is from AD knowledge; the fetched pages did not describe it.
   - **Borrow:** a five-step ladder the player learns once and reads on every object, with no tier skipping.
4. **Electric motor overhaul practice** ([Dreisilker, basic steps of motor repair](https://dreisilker.com/blog/the-basic-steps-of-electric-motor-repair), [15 MW motor refurbishment](https://www.crown.co.za/electricity-control/drives-motors-and-switchgear/36383-refurbishing-a-15-mw-wound-rotor-induction-motor)).
   - The nameplate is documented and never removed.
   - Mechanical and electrical work comes first; the repaint comes last, after the test run.
   - **Borrow:** the motor keeps its nameplate footprint every tier (identity anchor), and paint and brass arrive late (MK IV).
5. **Stationary steam engine restorations** ([Fanshawe Pioneer Village George White engine](https://www.lcf.on.ca/stories-backend/2019/4/3/full-steam-ahead-fanshawe-pioneer-villages-steam-engine-restored), [Corliss engine, National Museum of Industrial History](https://asme.org/about-asme/media-inquiries/press-releases/national-museum-of-industrial-history-restores-massive-working-steam-engine,-sets-public-debut-date)).
   - Steps: surface rust cleaned, brass polished, new paint, then pin striping and lettering as the final finish.
   - **Borrow:** polished brass and a fine lining line as the "finished" cue (MK IV brass, MK V warm seam).
6. **Transformer cooling stages ONAN → ONAF** ([GIGA Energy, cooling methods](https://www.gigaenergy.com/blog/transformer-cooling-methods), [ONAN vs ONAF](https://mb-drive-services.com/how-do-onan-and-onan-onaf-transformers-compare/)).
   - Radiators carry the base rating; fans added to the radiators raise it in steps.
   - **Borrow:** transformer MK III radiator bank, MK IV fan. A real capacity upgrade you can see.
7. **ANSI Z535 / OSHA safety colours** ([Graphic Products](https://www.graphicproducts.com/articles/safety-colors/), [Valmet](https://www.valmet.com/insights/articles/up-and-running/reliability/FRSafetyColors/)).
   - Orange marks machine parts that can crush, cut or shock; yellow marks caution.
   - **Borrow:** the small `#d9822b` marks at MK IV go only on guards of moving or energised parts. They are meaningful accents, not decoration.

General asset-pack practice (Fab / Creative Market building packs with 5 visual upgrade stages) confirms 5 as the common stage count. ([Fab listing](https://www.fab.com/listings/073a8ed2-5987-4695-9774-3811534d3361?lang=de), [Creative Market 2D Buildings](https://creativemarket.com/LayerLabGames/292324202-2D-Buildings-Town))

## 7. Proof set (motorTuning: wornMotor + motorPlinth, 5 tiers)

Dir: `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP22-23/proof-tiers/`

| file | content |
|---|---|
| `worn-motor.png` (= shipped MK I), `worn-motor-t2.png` … `worn-motor-t5.png`, `worn-motor-t5b.png` (heartbeat low frame) | 64x48, centre origin |
| `motor-plinth.png` (shipped), `motor-plinth-t2.png` … `-t5.png` | 48x10, bottom origin |
| `motor-tiers-contact-4x.png` | tiers left to right, labelled. Rows: sprite alone 4x; assembled with plinth + pulley 4x; in-game size at zoom 0.5 and 1 |
| `motor-tiers-in-game-era3-4x.png` | each tier composited into the real Era III frame (`s11`, zoom 0.5, 1 art px = 1 screen px) at the measured offsets (motor (468,510), plinth (475,550), retrofit kit (484,502) re-drawn on top), shown at 4x |
| `motor-tierup-storyboard-3x.png` | MK I → MK II beat, 10 frames with timings |

Measured:

| tier | rust px (outside plate) | opaque px | workbench score | lint |
|---|---|---|---|---|
| MK I (shipped) | 194 | 1289 | 91.7 | — |
| MK II | 122 | 1289 | 90.5 | — |
| MK III | 0 | 1297 | 90.3 | — |
| MK IV | 62 (brass hoops, not rust) | 1389 | 91.7 | 0 errors |
| MK V | 66 (brass + warm bolts) | 1389 | 91.1 | 0 errors |

- Script-checked on every file: 0 off-palette pixels, alpha in {0, 255}.
- MK I is visibly identical to the shipped `worn-motor.png` and `motor-plinth.png`; it ships as the existing file.
- MK I opaque pixels stay opaque in every tier (G2, 0 lost).
- New pixels: MK III 8 (foot flanges), MK IV/V 100 (cowl and flanges). None falls in a reserved zone: retrofit kit x23-43 rows ≤ 7, pulley and belt x ≥ 52, plinth rows ≥ 41.
- The in-game composite shows each step readable at zoom 0.5 (G5).

Tools (scratch, not repo):
- `scratchpad/WP22-23/tools/motor_tiers.py` (the tier edits; template for method A)
- `contact.py`
- `preview.py`

## 8. Open risks

1. **Boot time.** About +1.1 MB of PNG loaded up front, the flywheel MK III rot sheet alone 573 KB. Re-measure `bootMs` (gate 3000); fall back to background loading of `#t*#rot`.
2. **Brass read.** At zoom 0.5, brass hoops (rust ramp in clean bands) could read as rust stripes to some players. The proof composite reads as brass next to the Era III copper heater. Re-check on the Era I backdrop at zoom 1 before shipping P0.
3. **Beat spam in bursts.** harmonicCoil, containmentRing and horizonField levels arrive within about 17 min, and the tree-close release caps at 8 beats. Watch for perceived noise. Lever: raise the stagger, or limit per-release beats to 4.
4. **Texture ownership.** Three writers touch sprite textures (rot frames, restored swap, tiers, plus the heartbeat). A missed path will flicker or drop `#rot`. Mitigation: one resolver and the tests in §4.10.
5. **Spec conflict.** GAME_SPEC says the environment is "relatively static". Tiers change only parts, not the world, but GAME_SPEC needs an append-only §18.2 note covering both WP22 (living world) and WP23 (tiers).
6. **Store shots and marketing.** The machine looks different at every level now. Store shots, the trailer and README images must be regenerated and re-approved (`no_spoiler` still passes: no `RESTOR` text).
7. **Retune churn.** The siphon and anchor gate changes touch Era V contract tests and the showcase snapshot. If churn is unwanted, option B: leave them (unreachable visuals stay finale-only) and give those two tracks the beat only.
8. **PixelLab drift.** `edit_image` output is fully off-palette and can move features. Budget assumes 2 tries; method A covers any host if PixelLab fails.
9. **Decal occlusion.** Belt and link layers vs decals on mainHub and flywheelHub must be verified in a screenshot (MachineLinks depth vs host + 0.5). The gear hub decal was dropped because the pulley and crank cover it.
