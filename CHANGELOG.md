# Changelog

Notable changes per release, newest first. Work packages are named WPn; plans are in `docs/plan/`.

## 0.12.0 — Warm world — 2026-10-29

### Added
- **WP28a** Splices: 16 one-time purchases that wire the machine to a dead object of the old world. A spliced line wakes the object, partly wrong: the bicycle's back wheel turns backwards, the barrel organ plays three notes short, the payphone rings with nobody on the line. Buy an object by clicking it in the world (hover shows its name, cost and effect) or from the new SPLICES tab of the TECH INDEX. A woken object keeps a small live animation, and a line runs from the machine to it with pulses that grow with output. Eras I-II: bicycle, barrel organ, street clock, radio, payphone, bulb sign. Eras III-V: hand pump, factory whistle, hydrant, bell, gramophone, wind chimes, weathervane, kite, cairn, coin return.
- **WP28a** Splice lines are cut by Prestige. The objects go dark again, with one SYS LOG line: "Lines cut: n. Objects dark again."
- **WP28a** Finds: now and then a glinting item lies on the ground near a denizen or in the wind. Pick it up with G (PICK UP FIND, listed in SETTINGS > KEYS) within about 25 s for 4, 6 or 8 s of all output. Every fifth find is a field note from the prior world: 15 notes, listed under FIELD NOTES in the RECORDS tab. Finds start after Worn Motor. They never happen offline or behind a menu. The demo has them too.
- **WP28a** NEXT BUY line under the HUD goal: the next purchase that is not yet affordable, with a rough time at the passive rate (`NEXT BUY: COPPER WINDING · ~40s`).
- **WP28a** BUY MAX on repeatable techs (Shift-click, Shift+Enter, or the BUY MAX button in the detail panel). One press buys as many levels as the energy pays for.
- **WP28a** Pokes: click a denizen, the payphone, the lamp, the clock, Sensor 7 or a woken object and it answers with a short reaction. Repeated pokes escalate, then the target goes quiet for 20 s. Pokes change nothing in the economy and stop in the finale and the postgame.
- **WP28b** Roaming: the cast walks across the wing and the empty yard, in lanes. Walks between spots are visible; a relocation waits for an unseen moment. The Inspector, the dog and the crow start an action (a new activity, a walk, a reaction, a poke answer or a hop) at least every 12 s.
- **WP28b** Reactions to the machine's effects, never to the machine itself. A fault makes the Inspector startle, the dog bark and the crow ruffle. A big purchase sends a ground wave across the scene, and each walker reacts when the wave reaches it. An era change walks the Inspector to his inner spot, front on. A Find makes the crow glance down, the Inspector point at it (outer side) or look up (inner side), and the dog sniff toward it (outer side). A woken object draws a visit from the Inspector (left-wing objects) or the dog (right-wing objects), in eras I-III and V. Reactions start within about 1 s of their cause, except the Inspector's Find reaction (2 to 4 s) and the visit (3 to 8 s after the wake). The ground wave reaches each walker when the wave does, at 300 px/s from the machine's edge.
- **WP28b** Two poke bubbles: the Inspector's level-2 answer (the third poke within 8 s) may show "Noted." in eras I-III and V, and the girl's level-2 answer may show a wordless "…" bubble. Each has a 50 % chance (RARE: 25 %), at most one per actor per 120 s and four per hour, never over a line bubble, and none with WORLD VOICES off.
- **WP28b** Free crow hops: the crow may hop between perches on the right wing (at most 160 px, never over the machine, none in era IV). A fault sends it to the highest perch, and a big purchase hops it 30 % of the time. The finale flight is unchanged.
- **WP28b** The machine's reach: a crank click sends a small pulse along the ground. Output drives pulses along the pylon line, a little dust at the base and a lamp that wobbles. Each era has one signature effect: pebbles hop at the machine's feet (I), arcs on the wires and lights (II), steam drifting across the yard (III), loose objects that hum and puddles that ripple (IV), small debris that lifts (V). A big purchase sends a ground wave through the scene. Flashes stay at or below 3 a second. Reduced motion turns all of it off; the debris specks hang still.
- **WP28b** Splice objects and lines for eras III-V (a pipe, a standing-wave wire, lifted specks), and new denizen frames: a startle, a point at a find and two barks.
- **WP28b** Find producers: the crow's item drops from its perch, the dog digs at it (within 24 px), a gust flips a scrap, and a woken organ, radio, payphone or pump twitches as its item rises. Eras III-V add a puddle ring and a vent puff (III), Chladni rings that walk the item to a node (IV), and an item that lifts and bobs (V).

### Changed
- **WP28a** Pacing (playtest 2026-10-28: waits got boring when the player tired of clicking). The 17 split techs are cut into two or three smaller steps each, at the same power and the same total time. Requirements and unlock prices changed to match, and the unlock prices are about 0.65 of their 0.11.0 values. Purchases come about twice as often. Sims: A p90 gap 1:24 → 0:42 and max 4:24 → 1:40; B p90 gap 1:56 → 1:02 and max 6:08 → 2:33 before the final alignment.
- **WP28a** TECH INDEX: a SPLICES tab, with its own affordable count. The era tab counts and the tree graph leave Splices out. The badge counts them.
- **WP28a** Keys: G = PICK UP FIND, listed after F = CLEAR FAULT under SETTINGS > KEYS.
- **WP28b** Build target is ES2022 (Director ruling, 2026-10-29). Bundle caps for this release: app 525 KB, Director chunk 280, WorldReach 50, shared lazy 6, lazy world total 330, CSS 45; the limits in `scripts/smoke/perf-budget.json` follow the measured sizes within these caps.
- Saves: no version change (version 2). The save format is additive: the optional `world.relics` count (a missing count is 0). The Find clock is not saved.

### Notes for existing saves
- Split-track levels are doubled or tripled on load, at the same power. A save written before this version (the `econ` marker below 28) is remapped once. Its machine, visible tiers and output stay the same: within 1 % in eras I-II and within 3 % in eras III-V.
- Requirements and prices of the split and unlock techs changed (see Changed).
- Splices start dark. Every Splice object stands dead until it is bought.

### Deviations from the plan (WP28b)
- The 9.5 s micro rule (plan D5) was not built. The 12 s action gap holds through the hold caps instead: 10 s for a hold, 8 s for an early static run (10 s in era V). A micro activity starts only when no other activity may start.
- Era IV's POST stare is capped at 4 beats (9.6 s), so the 12 s gap holds. The stare itself is 2 to 4 beats.
- Era IV's unison hold is not counted in the 12 s action gap (the canon hold of the plan, B1; `ACTION_EXEMPT` in `world.mjs`).
- Era IV takes no machine-event reaction (C11, AD4 N15; Director ruling 2026-10-30 R3).
- The B1 walk-share floors are per state (Director ruling 2026-10-30 R1; `B1_WALK_FLOOR` in `worldBehaviourMetrics.test.ts`). The 12-20 % rule is the unit gate's.
- The dog's front-row spots (lane 32) may lie under the UI 150 HUD buttons (Director ruling 2026-10-30 R2; AD4 N14).
- Machine-event reactions start within 1 s of their cause, except the Inspector's Find reaction (2 to 4 s), the ground wave (when the wave reaches the walker) and the visit (3 to 8 s after the wake).
- A machine-event reaction on a walker that is mid-walk at 2 fps (era I, before the piston array) cuts the walk at the next drawn tick (500 ms). The dog's reaction can then start up to 1.1 s after its cause (the 600 ms stagger plus one tick). At 4 fps and above it stays within 1.0 s.
- The T2 coverage floor is per state (Director ruling 2026-10-30 R4; `T2_COVER_FLOOR` in `worldBehaviourMetrics.test.ts`). The S7 Inspector (era I walks at 2-4 fps) is pinned at 61.5 %, its lowest 90 s window over seeds 1-5; every other row keeps 70 %.
- The crow lands on the bicycle seat (e1, s9, s11, s15) and the sign top (s9, s11) where those objects stand, each within 160 px of another perch. The other framings have none: s8 and s8w have no bicycle or sign on stage, e1 and s15 no sign, and s10 no crow.
- Director rulings 2026-10-30 R1-R3 are recorded in docs/plan/WP28.md.

## 0.11.0 — Click curve and Faults — 2026-10-28

### Added
- **WP27** Machine Faults (playtest feedback): from Fault Lamp (era I, in the demo too), a part of the machine now and then throws a fault: an amber FAULT plate with its code (BELT SLIP, ARC LEAK, SEAL HISS ...) and a draining timer bar. Click it or press F within 8 s to clear it for 15 s of every energy's output. A missed fault costs nothing. Faults come every 90-180 s of active play, never in the first 3 minutes, never offline, never behind menus, the era card, photo mode, the finale or the demo cards. Screen readers announce them; REDUCED MOTION shows a steady plate.
- **WP27** Wind-up: from Reinforced Crank, the machine stores a little of its output while you are not cranking (the HUD WIND-UP row). The next turn of the crank releases all of it (RELEASE +Ns in the click popup), so an occasional click stays worth it late in the run.
- **WP27** Four new nodes that keep the crank warm: Discharge Lever (era II, demo), Leak Whistle (era III), Damping Fork (era IV) and Overrun Clutch (era V). They raise the wind-up (up to 2 s), the fault payout (up to 22 s), the fault rate and window, and in era V a cleared fault gives ×2 output for 6 s (OVERDRIVE).
- **WP27** F key: CLEAR FAULT (listed under SETTINGS keys). New fault sounds per era.

### Changed
- **WP27** Click curve (playtest feedback): the first minutes are a cranking game again. Worn Motor gives +2 ME/s (was +17), Motor Tuning +0.9 per level, Piston Array +60 for 3000 ME. Cranking earns about three quarters of era I income for the first 4 minutes, the machine passes a steady 4-click/s crank at about 7 minutes, and the click still earns about a third of era II income. From era III the machine carries the run; clicks, the wind-up and faults stay a clear bonus.
- **WP27** Mechanical clicks: one crank echo now pays seconds of output in every energy, ME included (Reinforced Crank 0.15 s, Dynamo Crank +0.3 s, Echo Crank and Inversion Crank +0.05 s each). An ME click is never weaker than an electric one. Reinforced Crank costs 1200 and drops its ×1.5.
- **WP27** Balance re-tuned around the new curve: converter rates for eras II-V, Crank Servo growth 2.0, Bellows Drive growth 1.5, Gravitic Anchor growth 2.0, Generator Blueprint 400 000 ME. An always-cranking player reaches the eras at the same times as 0.10.1 (final alignment about 250 min). A player who cranks only the first 5 minutes and then watches finishes in about 1.45× that time.
- **WP27** Prestige re-tuned for the new curve: Residual Charge 10 % (was 50 %), Echo bonus 14 % per Echo (was 15 %), up to 12 Echoes counted (was 30).
- **WP27** Crow (playtest feedback): in eras I and II the crow now sits on the lamp with folded wings and keeps busy (looks back, pecks, ruffles, shifts). The spread-wing freeze is only a rare glitch of about a second. Three new crow frames. Its feet now rest on the lamp top.
- **WP27** Sensor 7 (playtest feedback): it stays next to the Inspector through era II (and in eras III-V). Mid era II (Capacitor Bank or Spark Gap before the Transformer), the whole cast no longer leaves the stage; the clock stays at the era II entry.
- **WP27** Bundle budget: app JS limit 510 KB (was 500). The fault marker loads as its own small chunk.
- Saves: no change (version 2). Wind-up and the fault clock are not saved; a load starts a fresh clock.

### Verification
- §R-lite v0.11.0 (`docs/STEAM_RELEASE.md` section 15, all 15 rows): typecheck clean; 5746 tests pass, 17 skip; new `clickCurve.sim.test.ts` (K1-K12) and `scripts/smoke/faults.mjs` (full and demo).
- Builds and bundle budgets pass: app 507.5 / 510 KB (limit raised from 500 for the faults and wind-up code), lazy world 206.2 / 210 KB, fault marker chunk 11.0 / 12 KB.
- GPU perf median of 3: frame p95 16.8 ms (budget 17). 30 min soak flat. Packaged demo and full exes pass `desktop.mjs`. Store set re-shot (`store-final4`); Art Director RELEASE-READY.

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
