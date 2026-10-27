# Changelog

Notable changes per release, newest first. Work packages are named WPn; plans are in `docs/plan/`.

## 0.10.1 — Follow-ups — 2026-10-27

### Changed
- **WP26** Weather sound: in the world, the wind bed follows the live wind, so gusts are audible. Still air keeps a quiet floor (eras IV and V, and the finale before the wind stops).
- **WP26** Era III rain: a soft rain hiss follows the visible virga at about -30 dB. Its pitch falls and it fades as the virga slows and freezes. There is no rain in the demo (eras I and II), nor in eras IV and V.
- **WP26** Era III mix: the boiler sound is 20 % quieter, so the rain fits without making the mix louder.
- **WP26** Era V sky: the violet sky and horizon glow now rise slowly in the world view. A full fade takes 24 s, so a 0.25 step takes about 6 s. The sky does not snap, and fades out stay quick. The teaser and the showcase keep their timing.
- **WP26** Living world: the girl (cycles 3 and up) stands beside the scrap pile, not on it. Cycles 1 and 2 are unchanged.
- **WP26** Living world: unused denizen loop tables are removed (inspector walk, dog roam, crow stutter and others). No visual change.
- **WP26** Crank Servo: the arm has a one-pixel light edge, so it reads against the X-brace on MK I to MK III. Same shape and size.
- **WP26** TECH INDEX: seven tree slots moved in tabs I, IV and V, so no line passes behind another node. In tab V, two lines from Null Chamber now route around the outside of the graph.
- No change to saves, economy, settings or text.

### Verification
- §R-lite (`docs/STEAM_RELEASE.md` section 15): typecheck clean; 5496 tests pass, 17 skip; builds and bundle budgets pass (app 493.9 / 500 KB, lazy world 205.3 / 210 KB).
- GPU perf median of 3: frame p95 16.7 ms (budget 17). 30 min soak: heap growth 2.0 MB, display objects flat. World update 0.28 ms (budget 0.3).
- New `scripts/smoke/weather-audio.mjs` (full and demo). Packaged demo and full exes pass `desktop.mjs`. Store set re-shot (`store-final3`) and approved by the Art Director.

## 0.10.0 — Living machine — 2026-10-27

### Added
- **WP22** Part evolution tiers: repeatable parts change how they look as they are upgraded, through 3 or 5 visual tiers (MK I SALVAGED to MK V AS BUILT). Visual only: no balance change, no save field.
- **WP22** Tier-up beat: a short flash and sparks when a part reaches its next tier. It never blocks input; with REDUCED MOTION it becomes a crossfade.
- **WP22** MK marks in the Tech Index and in toasts. The showcase, the ending, the demo teaser and new cycles show each part at its reached tier.
- **WP23a** Living world, eras I and II: six denizens stand at the edges of the scene and change with each era. Now and then one turns to you and speaks in a speech bubble.
- **WP23a** WORLD VOICES setting (DISPLAY): ON, RARE or OFF.
- **WP23a** The environment changes a little each era, starting with the tower windows in era II.
- **WP23b** Living world, eras III to V: more environment changes each era (weather, puddles, fog, scattered pages, light), with a violet rim in era V.
- **WP23b** The finale and the postgame include the denizens. The postgame has a 90-second loop of their behaviour.
- **WP23b** New cycles leave traces in the world. Two more system logs.
- **WP23a / WP23b** Demo: the living world covers eras I and II, with its own short arc after the Substation Blueprint cap.
- **WP24** Living world v2 (playtest feedback): every denizen runs its own day of varied activities. They walk between spots, write, crouch at Sensor 7, look up, scratch, doze, open an umbrella when a vent puffs, and react to the machine. No move repeats back to back, and nobody teleports.
- **WP24** The recorded Tuesday: a day clock runs from 09:00 to 16:41 as the machine progresses. The far ruins drift from grey morning to neutral noon to amber afternoon. Wind and gusts move dust, rain and sprouts. The finale and the postgame hold at 16:41.
- **WP24** No instant changes. Era changes crossfade over 8 seconds. The lamp buzzes on, the booth lights after it, and the windows and their glow light one at a time. Fog, puddles and burning scraps fade in over 20 to 45 seconds.
- **WP24** New denizen poses (11 cells) and small ambient events (a lamp dip, a clock twitch, a dripping crow).
- **WP25** Passive-first economy (playtest feedback): the machine now carries progression and the crank is an optional bonus. A player who drops to half a click per second after era I reaches each era gate in about 1.2× the always-clicking time (was up to 2.15×).
- **WP25** The HUD shows what one crank turn is worth in seconds of machine output, plus the AUTO-CRANK rate. The machine shows its own output in small popups. A SYSTEM log notes "Manual operation no longer required."
- **WP25** The Crank Servo (auto-crank) moves to era II, so the demo has it too.

### Changed
- **WP22** HUD inset follows UI SCALE (100, 125 and 150 %).
- **WP23a** Saves: an optional `world` block (which living-world lines were seen). No save version change; older saves load as before.
- **WP25** Balance: click echoes are shorter (Dynamo and Steam Hammer 0.25 s, Echo Crank 0.5 s, Inversion 0.75 s). Passive output is raised per energy. The Echo bonus is 15 % per Echo (was 30 %), and total pace is still faster than before. Generator cost 25 500. Data only: no save change.
- **§R** TECH INDEX era III: Bellows Drive moves one column right, so its line from the Boiler no longer runs behind Induction Heater.

### Verification
- Bundle budgets (`scripts/smoke/perf-budget.json`, checked by `scripts/perf/bundle-budget.mjs`): app JS raw <= 500 KB (was 460 KB), lazy living-world chunk <= 210 KB (was 120 KB; WP24 behaviour, day clock and transitions; loads with the World scene, off the boot path), CSS <= 45 KB (was 44 KB).
- Timing rows, re-measured on a quiet PC (`docs/STEAM_RELEASE.md` section 15, all 15 rows PASS): GPU perf median of 3, frame p95 16.8 ms (budget 17); 60 min soak, heap 99.0 to 100.9 MB, display objects flat; world update 0.27 ms (budget 0.3).
- Known note: denizens are small at the default camera (the Inspector is about 30 px tall at 1080p, smaller at zoom 0.5 in eras III to V). They are readable but easy to miss.

## 0.9.0 — Steam demo candidate — 2026-10-23

### Added
- **WP17** Legacy feed techs, uncapped, so each energy stays in use after its era: Bellows Drive (ME, era III), Grid Exciter (EE, era IV), Mains Backfeed (EE, era V), Steam Lance (PR, era V). Resonant Siphon adds +5 % ??? (Unknown Flux) rate.
- **A17** Hand-pixelled art for the legacy feeds (bellows, exciter insulator, backfeed string, steam lance) and the generator glow.
- **WP18** Final machine completion beat: the ending steps the machine display from era III to era V over the first 6 s. Rendering only; simulation unchanged.
- **WP18** Survey camera move in the ending (skipped under reduced motion).
- **WP18** Postgame portrait: one fixed FULL-view pose for KEEP, reload and refocus.
- **WP18** VIEW MACHINE photo mode (postgame): HUD hidden, drag, wheel and arrow-key pan and zoom, Esc exits.
- **WP18** ShowcaseScene: separate scene with its own camera. Base for the demo teaser.
- **WP18b** Restored warm core in postgame: A17 texture variants, lamps lit.
- **WP19** Steam desktop shell (Electron 44.7.0): `npm run build:steam` and `npm run build:steam-demo`; host file saves (atomic write, `.bak` copy); crash overlay; splash; title screen; credits; quit; fullscreen setting; UI anchored to the canvas.
- **WP20** Onboarding crank prompt; TECH INDEX cue with affordable-purchase badges; next-goal line; era cards on era keystones.
- **WP21** Demo edition, capped at the Substation Blueprint (era II). Eras III to V show FULL GAME in the tree and cannot be bought.
- **WP21** Final-machine teaser after the cap, with the plate name redacted (`PRIMARY FUNCTION: RES?OR?`).
- **WP21** END OF DEMO card: WISHLIST ON STEAM, KEEP TINKERING, REPLAY TEASER, QUIT (desktop only).
- **WP21** Build scripts `npm run build:demo` (output `dist-demo/`) and `npm run build:steam-demo`; demo smokes `scripts/smoke/demo.mjs` and `scripts/smoke/demo-cases.mjs`.
- **WP15** Music bed per era: crossfade on era change, ducking under the finale chord. MUSIC volume slider with its own bus.
- **WP15** Perf probes `uiStats`, `perfMarks`, `audioStats`; perf smoke `scripts/smoke/perf.mjs`.
- **WP15R** GPU perf smoke (`PERF_GPU=1`, median of 3 windows, idle and post-purchase windows).
- **WP16a** Save compatibility tests (`src/persistence/compat.test.ts`, historical-shape fixtures).
- **WP16a** Smokes `e2e-full`, `a11y`, `soak`, `store-shots`; ASSET_GUIDE guard test (`src/assets/assetGuide.test.ts`).
- **WP16b-2** Release docs: `README.md`, `CHANGELOG.md`, `docs/STEAM_RELEASE.md` (release checklist).
- **WP16b-3** Store-shot plate cap: debug hook `setPlateCap` / `plateCap` (`?debug=1`, rendering only) caps the World name plate and the HUD plaque at `RES?OR?`; `scripts/smoke/store-shots.mjs` uses it for every store and alt shot and checks them for spoiler text.
- **WP16b-3** ux smoke case M: one guidance prompt at the start of a new cycle with Muscle Memory.

### Changed
- **WP15R** Purchase cue follows the energy that pays. Rate-driven music beds refit to at least 3x the post-finale rate. Music themes and bed trims use the simulation `currentEra`.
- **WP17** HUD: title shows the current era (I to V). Each energy row shows stock, rate and feed hint; frontier row emphasised.
- **WP17** Crank gain text: one tinted line per active energy. Clicks within 300 ms merge into one block. Text size compensates for camera zoom.
- **WP20** Part fly-in is visible after the tree closes (camera nudge), not behind the open tree. Toasts sit above the tree backdrop. Level toasts coalesce.
- **WP20** Tree fits at UI 150 %, keyboard-safe, with the selected node kept in view. System menu has fixed height. Text sweep.
- **WP16a** Active menu tab text contrast raised. Reset pulse stops under in-game reduced motion. Title version text colour fixed.
- **WP16b-1** Store art: far-plain ramp under the ridge line replaces the flat grey band. Logo plate redrawn with bolts.
- **WP16b-2** TECH INDEX: Tab focus trapped inside the overlay.
- **WP16b-2** TECH INDEX: tree text contrast fixed (milestone node ink; purchased node level and cost text).
- **WP16b-2** Compact in-tree toast.
- **WP16b-2** One guidance prompt at a time.
- **WP16b-2** Tree layout: PURCHASE beside its feedback line; graph centred; stable panel height (PURCHASE and graph keep their place).
- **WP16b-3** Lance steam puff spawns at (28,-385), the right end of the flange collar: vents beside the valve, valve wheel fully visible, siphon capsules clear (store shots 07/09 and demo teaser).
- **WP16b-3** While the era card is up the toast stack goes compact (newest toast, title only, one 13 px line), so at UI 125/150 no toast covers the era card.
- **WP16b-3** An empty SYSTEM menu feedback line no longer reserves a row, so the version footer fits the SYSTEM tab at UI 150 on 1280x720/1280x800 (web and demo builds).

### Verification
- Balance sign-off (`src/simulation/signoff.sim.test.ts`, greedy profile A): era ends 22:06 / 60:23 / 110:36 / 166:30 / 249:31.
- Demo cap timings (`src/simulation/demoCap.sim.test.ts`): profile A 60:23, B 72:52, new player 98:29, C 148:28.
- a11y smoke (`scripts/smoke/a11y.mjs`): `fail []`, `deferred []`.
- Bundle budgets (`scripts/smoke/perf-budget.json`, checked by `scripts/perf/bundle-budget.mjs`): app raw <= 460 KB, css <= 44 KB.
- GPU perf (`PERF_GPU=1`, median of 3, RTX 3060 Ti D3D11): frame p95 16.8 ms, post-purchase p95 16.7 ms (budget 17), boot 777.6 ms, heap 97.4 MB.
- Final Art Director audit: RELEASE-READY (`docs/plan/ART_AUDIT.md`, WP16b-3).
- Soak 60 min: `docs/STEAM_RELEASE.md` section 15 row 9.

## 0.1.0 — development builds — 2026-10-18
- WP1: Tooling and pure simulation core.
- WP2: Wasteland scene, asset registry, camera, crank, HUD.
- WP3: Tech tree overlay and modular machine components.
- WP4: Save/load, offline welcome-back, system menu, audio, system logs.
- WP5: Balance, ASSET_GUIDE, README, build split, browser smoke scripts.
- WP6: Mechanical correctness and art polish (drive train, assets, RotSprite).
- WP7: Multi-resource core (ME, EE, PR, RS, XF), save v2 migration, number suffixes to Dc, greedy sim harness.
- WP8: Multi-era infrastructure and Era II Electrical.
- WP9: Era III Thermal/Pressure.
- WP10: Era IV Resonance.
- WP11: Era V Exotic.
- WP12: Settings, accessibility, stats, achievements, save export/import, reduced motion.
- WP13: Ending sequence, reveal, postgame, restored world.
- WP14: New-cycle prestige: Echoes, Memory perks, MEMORY tab, cycle transition.
