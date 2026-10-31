# Game Specification — What Exactly Does This Machine Do?

> Authoritative requirements for the first playable vertical slice. Copied from the project brief.

## 1. Game Vision

The game takes place in a desolate post-apocalyptic wasteland. Humanity is seemingly gone. The world is barren, silent, and abandoned.

In the middle of an enormous flat wasteland stands a mysterious, rusty industrial machine. Nobody knows what it does.

The player does not control a character. The player interacts directly with the machine and its systems using the mouse.

At the beginning, the machine is almost entirely inactive. Only a small hand crank can be operated. By turning the crank, the player generates Mechanical Energy (ME). This energy can be spent on upgrades, automation, and new machine components. As the game progresses, the machine grows into an increasingly large and complex industrial structure.

Central fantasy: **Start with a rusty hand crank. Eventually operate a colossal machine capable of manipulating incomprehensible amounts of energy, without initially knowing its purpose.**

The machine must visibly evolve as the player progresses.

## 2. Core Design Principles

1. Every major technological upgrade should produce a visible change to the machine.
2. The game must be satisfying to watch, not just satisfying to optimize numerically.
3. Keep the early game simple and understandable.
4. Introduce complexity gradually.
5. Preserve meaningful decisions between manual efficiency and automation.
6. Avoid excessive micromanagement.
7. Avoid punishing the player with irreversible progression traps.
8. The game must feel atmospheric, mysterious, industrial, and slightly unsettling.
9. The machine's true purpose must remain unknown in the prototype.
10. Do not implement mechanics that are not necessary for the first playable vertical slice.

Primarily an incremental game, not a realistic engineering simulator. Avoid real-world mechanical physics simulations. Use deterministic mathematical production systems.

## 3. Technology Stack

- Phaser 3
- TypeScript with strict typing
- Vite
- HTML/CSS for overlay interfaces where appropriate
- Vitest for core gameplay logic tests
- LocalStorage for saving

Desktop browser. 16:9 viewport primary layout, reasonable support for browser resizing. Clean architecture separating gameplay simulation from rendering. No backend, authentication, multiplayer, or external database. Avoid unnecessary dependencies.

## 4. World and Visual Style

### Camera and composition
Single 2D side-view scene. Environment:
- Flat, cracked, dusty terrain
- A distant ruined city skyline
- Abandoned electrical infrastructure
- Hazy mountains or industrial ruins
- A polluted, desaturated sky
- Occasional drifting dust particles
- The mysterious machine as the central focal point

Parallax background layers for depth. Player can pan and zoom the camera within sensible bounds. Button to refocus the camera on the machine. The machine remains the primary point of interest.

### Visual direction
Pixel-art aesthetics. Initial palette: desaturated sand, rusty brown, dark industrial gray, muted orange, dirty beige. Brighter colors sparingly to communicate activity, energy, heat, technological advancement. Environment relatively static; machine increasingly animated.

### Important constraint
The machine is an exterior structure. DO NOT create internal rooms, interior exploration, characters walking through the machine, or a dungeon-like layout.

### Asset strategy
PixelLab will be used to create pixel art. The project must support replacing placeholder assets with PixelLab sprites without modifying gameplay systems. Centralized asset registry and documentation of required assets. Initial prototype uses procedural placeholders / geometric sprites / local temporary assets. Never depend on assets that do not exist. Consistent rendering dimensions and pixel-art scaling.

## 5. Core Incremental Mechanics

### Primary resource: Mechanical Energy (ME)
Only spendable resource. Maintain: current ME, lifetime ME generated, ME per manual interaction, ME per second, upgrade levels, technology unlock states. Simulation independent of rendering frame rate.

### Manual production
Clicking the hand crank generates ME. Initially 1 ME per click, 0 ME/s. Each click: crank rotates, small mechanical movement, floating +ME indicator, temporary sound feedback, visible counter update. Responsive.

### Automation
Automation generates ME/s. Animations visually respond to the active production system. An automated motor visibly rotates/drives connected components. Production speed and animation speed related readably, but animation speed clamped.

### Economy
Data-driven formulas: `Cost(level) = BaseCost × GrowthFactor ^ level`. Sensible rounding for displayed prices. All economy config centralized in data files. No scattered balancing constants.

## 6. Technology Tree

Prerequisites and locked/unlocked(available)/purchased states. Three progression types:
1. Technology Unlock: purchased once
2. Repeatable Upgrade: purchased multiple times
3. Milestone: unlocked automatically when conditions are met

Branch A: Mechanical Efficiency — Hand Crank → Gear Ratio → Reinforced Crank → Flywheel
Branch B: Automation — Hand Crank → Worn Motor → Motor Tuning → Piston Array
A later technology requires progress in both branches (prepares Electricity era). Do not implement electricity as a resource.

| Technology | Type | Base Cost | Effect |
|---|---|---:|---|
| Hand Crank | Starting | 0 | +1 ME/click |
| Gear Ratio | Repeatable | 10 | +1 ME/click per level |
| Reinforced Crank | Unlock | 50 | ×2 manual production |
| Flywheel | Repeatable | 150 | +10% automation production per level |
| Worn Motor | Unlock | 25 | +1 ME/s |
| Motor Tuning | Repeatable | 40 | +1 ME/s per level |
| Piston Array | Unlock | 250 | +5 ME/s |
| Improved Pistons | Repeatable | 120 | +2 ME/s per level |
| Generator Blueprint | Milestone | 1,000 lifetime ME | Teases the next technology era |

Growth factors: Gear Ratio 1.15, Flywheel 1.20, Motor Tuning 1.18, Improved Pistons 1.20. (Initial balancing targets.)

Prerequisites:
- Gear Ratio requires Hand Crank.
- Reinforced Crank requires Gear Ratio level 3.
- Worn Motor is available after Hand Crank.
- Motor Tuning requires Worn Motor.
- Flywheel requires Reinforced Crank and Worn Motor.
- Piston Array requires Motor Tuning level 5.
- Improved Pistons requires Piston Array.
- Generator Blueprint requires Piston Array, Flywheel level 1, and at least 1,000 lifetime ME.

Lifetime ME never decreases when spending. Milestones don't consume currency. Repeatables have understandable costs, scaling, max levels where appropriate. Tech UI shows prerequisites, current effects, next-level effects, costs.

Production = additive bonus aggregation followed by multiplicative modifiers; documented and unit tested.

## 7. Machine Visualization System

Modular visual components, each with: unique component ID, associated technology ID, visual position and dimensions, active/inactive state, optional animation config, optional connection points, optional production-driven effects.

Examples: hand crank, small gears, large gears, flywheel, worn motor, piston array, mechanical support frame.

Fixed attachment locations; no manual placement. When a technology is unlocked: (1) component appears, (2) short assembly animation, (3) mechanical animations activate, (4) silhouette grows/more complex. Previously unlocked components stay visible.

Procedural animation: gear rotation, crank rotation, piston reciprocation, flywheel rotation, vibration. No physics engine. Coherent machine, not disconnected decorations; shafts/belts/pipes may be drawn.

## 8. UI/UX

Industrial control terminal feel; not modern/bright/mobile.

Main HUD: current ME, ME per click, ME per second, access to Technology Tree, save/settings controls.

Technology Tree overlay/panel: zoomable/pannable if needed, nodes connected by prerequisite lines, distinct locked/available/purchased states, clickable nodes, purchase buttons, costs and descriptions, repeatable levels, clear insufficient-resource feedback. Mouse usable.

Feedback for: manual production, upgrade purchases, technology unlocks, new mechanical parts, milestones, offline production on return. Short thematic notifications; avoid noise.

Number formatting: 1,000 → 1K; 1,000,000 → 1M; 1,000,000,000 → 1B. JS numbers OK; structure for later big-number support.

## 9. Save System and Offline Progress

Autosave at intervals; save on visibility change; load on startup; schema versioning; recovery to valid initial state on corrupt data; manual reset with confirmation.

Offline: elapsed real time since last saved simulation point; award production at persisted automation rate; cap 8 hours; brief welcome-back summary. No offline income from clicks. No frame replay. Loading must not award duplicate offline progress.

## 10. Environmental Storytelling

No conventional story intro. Discovery via environment details, strange machine labels, short malfunction messages, technology descriptions, rare system logs. Purpose unexplained. Examples: "Manual operation detected." "Primary function: UNKNOWN." "Synchronization unsuccessful." "Operator identity not found." "This component was not designed to be replaced." Use sparingly. No NPCs/dialogue.

## 11. Sound Design

Audio architecture for: crank sounds, gear and motor loops, mechanical activation, technology unlocks, subtle wasteland ambience. Temporary locally generated effects (e.g. WebAudio synthesis) or silent placeholders. Optional, never blocks gameplay. Mute toggle. No copyrighted or remote audio.

## 12. Project Architecture

Suggested:
```
src/
  main.ts
  game/ (scenes/, entities/, components/, rendering/)
  simulation/ (economy/, progression/, production/)
  data/ (technologies.ts, machineComponents.ts, balance.ts)
  ui/
  persistence/
  audio/
  assets/
  utils/
```
Rules: no giant monolithic scene files; data-driven tech definitions; pure testable economy; save data not coupled to Phaser; deterministic simulation update model; rendering separate from economy; avoid unnecessary abstraction.

## 13. PixelLab Asset Integration

Create `docs/ASSET_GUIDE.md` documenting required sprites, suggested dimensions, animation frames, naming conventions, pivot/origin, layering, how to replace temporary assets. Asset manifest covering at least: wasteland background layers, terrain tiles, hand crank, small gear, large gear, flywheel, worn motor, piston array, machine support structure, steam/dust effects. Nearest-neighbor sampling. Fallbacks so missing files don't crash.

## 14. Out of Scope
Player movement, interiors, combat, enemies, multiplayer, inventory grids, crafting, fluid sim, realistic physics, arbitrary construction, prestige, multiple worlds, multiple currencies, full electricity, quests, mobile UI, backend.

## 15. Development Workflow
1. Project structure & tooling. 2. Pure TS economy & progression. 3. Tests for formulas, prerequisites, purchases, save logic. 4. Wasteland scene with procedural placeholders. 5. Interactive crank. 6. Automatic production & machine component visualization. 7. Interactive tech tree. 8. Persistence & offline progress. 9. Visual & audio feedback. 10. Polish & verify playability.

## 16. Acceptance Criteria
- Game starts in a browser without runtime errors.
- Post-apocalyptic wasteland visible.
- Mysterious rusty machine in the central scene.
- Clicking its crank generates ME.
- Energy purchases upgrades.
- Player can unlock an automated motor.
- Automated production increases ME over time.
- Progress through two tech branches works.
- Major unlocks visibly add moving machine parts.
- Tech tree displays dependencies and purchase states.
- Camera can zoom and pan.
- Save and restore progress.
- Offline progress calculated correctly.
- Critical simulation logic covered by automated tests.
- PixelLab assets can replace placeholders without rewriting gameplay logic.

Core experience: "I found a strange machine. I started turning a crank. Now it is growing into something I don't understand."

## 17. Deliverables
1. Working source code 2. README with setup/run 3. Playable prototype 4. Automated tests 5. Asset guide for PixelLab 6. Short architecture explanation 7. Implemented features list 8. Suggested next milestones.

Prioritize making the first 15–30 minutes coherent, satisfying, and visually responsive.

## 18. Full-game extension (user directive)
The user asked for the complete game beyond the vertical slice. `docs/plan/ROADMAP_FULL.md` is the
authoritative extension: it supersedes §14 (out-of-scope list, which applied to the first version only)
and §2.9 (the purpose is revealed in the finale).

### 18.1 Steam demo release note (v0.9.0, 2026-10-23)
Append-only note. Nothing above this line was changed.
- Shipped for the Steam demo: two editions from one codebase (full; demo = Vite mode `demo`, capped at the Substation Blueprint, eras I–II,
  final-machine teaser with the name redacted, END OF DEMO card with a wishlist link); energy continuity (every energy keeps a sink in
  every later era through uncapped legacy feeds: Bellows Drive, Grid Exciter, Mains Backfeed, Steam Lance); final machine showcase
  (completion beat, survey camera, postgame portrait, VIEW MACHINE photo mode); a Windows desktop build (Electron) next to the browser build.
- Requirements beyond §1–§17 now live in `docs/plan/ROADMAP_FULL.md` (full game), `docs/plan/STEAM_DEMO_PROGRAM.md` (decisions D1–D8, they
  win over older plans) and the work-package plans `docs/plan/WP17.md` to `docs/plan/WP21.md`, `docs/plan/WP16.md`, `docs/plan/WP16a.md`.
- Release evidence: `docs/STEAM_RELEASE.md` §15. Changes: `CHANGELOG.md`. Balance deviations from §6: `README.md` (Balance).

### 18.2 User directive (2026-10-24): evolving parts and a living world
Append-only note. Nothing above this line was changed.
- **Evolving parts.** Upgrading a part changes how it looks, not only how fast it runs. Every repeatable part track evolves through 3 or 5
  visual tiers (MK I SALVAGED to MK V AS BUILT; 5 when the track's reachable cap is 18 or more) at fixed, reachable levels, with a short tier-up
  beat that never blocks input. Tiers are rendering only: no save field, no balance change. Design `docs/plan/PART_TIERS.md`, plan `docs/plan/WP22.md`.
- **A living world.** The scene is no longer the machine alone. Six denizens (two people, two animals, two objects) stand on the wings of the
  scene, change with each era, and may turn to the camera and address the player with a rare single line (mysterious, funny or creepy by era).
  The world gets stranger, not better, until the finale. The environment changes a little each era (small, local, partly wrong); the finale's
  restoration wipe stays the only large change. Design `docs/plan/STORY_BIBLE.md` (text, timing) and `docs/plan/DENIZEN_ART.md` (art, staging);
  plan `docs/plan/WP23.md` (WP23a eras I-II and the demo, WP23b eras III-V, finale, postgame, cycle 2+).
- **Superseded, for the denizen and environment layer only:** §10 "No NPCs/dialogue" (denizens may speak; "use sparingly" still applies);
  §4 "Environment relatively static"; §1 "barren, silent"; the ART_ERA5 convention of no people in the finale or the restored world.
- **Still in force:** the machine stays the focal point and an exterior structure; denizens never face, touch, overlap or walk through the machine
  (§4); no denizen line names the machine's function or contains "RESTOR", so every reveal stays in the machine's own text; the denizens are
  fragments of the prior world, not survivors and not observers ("Humanity is seemingly gone" holds); people in the restored world follow the
  Art Director's conditions (DENIZEN_ART §8.1).
- Persistence and settings: one optional `world` block in save v2 (lines seen) and one setting, WORLD VOICES ON / RARE / OFF. No save version bump.

### 18.3 Release note (v0.10.0, 2026-10-25)
Append-only note. Nothing above this line was changed.
- Shipped in 0.10.0: evolving parts (3 or 5 visual MK tiers per repeatable part, with a tier-up beat; rendering only, no balance change) and the living world (six denizens, environment changes each era, WORLD VOICES ON / RARE / OFF, the finale and postgame layer, traces across cycles).
- Budgets raised for the release: app JS 500 KB raw, lazy living-world chunk 120 KB, CSS 45 KB (`scripts/smoke/perf-budget.json`). Timing rows wait for a quiet PC.
- Player-facing details: `CHANGELOG.md` (0.10.0). Release evidence: `docs/STEAM_RELEASE.md` §15.

### 18.4 User playtest (2026-10-25): passive-first economy (WP25)
The player said clicking felt mandatory and passive income a small add-on. WP25 retunes data only (no formula, no save change):
click echoes cut (Dynamo / Steam Hammer 0.25 s, Echo Crank 0.5 s, Inversion 0.75 s; Spark Gap ×1.5, Echo Crank ×2), the
Crank Servo moves to era II (motorRetrofit 1, 30K ME), passive output tilted per energy, Echo bonus 30 → 15 % per Echo. A player
who drops to 0.5 clicks/s after era I reaches every gate in about 1.17–1.2× the always-clicking time (was 1.7–2.15×); clicks are
25–31 % of income for the 4-cps player (was 74–80 %). The HUD shows what a click is worth in seconds of output, the machine shows
its own output in popups, and a SYSTEM line notes "Manual operation no longer required." Director calls: generator.baseCost
25000 → 25500 (keeps the era-I windows; outside the planned lever list) and no new ME-priced tech in era IV (ME keeps being spent:
continuity 92 %, dead time 4.0 min ≤ 5).

### 18.5 User playtest (2026-10-25): living world v2 (WP24)
Append-only note (WP24 T14, 2026-10-26). Nothing above this line was changed.
- **Scheduler.** Each denizen runs its own weighted list of activities per era: rest, walks between spots, reactions to cues. No walk follows a walk, and each boot of a played save opens elsewhere in the sequence. Before Worn Motor, one crank click steps every walker. Canon holds: the girl never moves on screen, the crow never travels before the finale, Sensor 7 faces the camera.
- **Recorded Tuesday.** The day runs from 09:00 toward 16:41 on the stopped street clock (about 4:41) as the machine's lifetime fills; the finale and postgame hold 16:41. The light tint is subtle (never more than 14 % darker) and the wind follows the era. The postgame keeps its exact 90 s loop. WP26: the wind bed follows the live wind, an era III rain hiss follows the visible virga, and the era V violet sky and horizon glow rise over 24 s for a full fade.
- **No instant change.** Every change that used to snap (era rows, lamp, booth, windows, motes, hole, puddles, sprout, fog, virga) now crossfades, ramps or flickers in over 1.5 s to 60 s. Queued changes start 1 s after the gate closes and stagger 0.6–1.2 s apart. An interruption pauses a walker or pose; it never skips it.
- **§4 reading.** "Environment relatively static" now reads: "the environment lives slowly in the background, canon-bound; the machine stays the focus." §4 itself is unchanged.

### 18.6 User playtest (2026-10-27): click curve, Faults, living crow (WP27)
Append-only note (WP27, 2026-10-27). Nothing above this line was changed.
The playtest found three problems. The era I crow was a frozen picture with its wings spread. The first passive buy (Worn Motor, +17 ME/s) was far too high, so clicking died, and mechanical clicks gave far less than electric ones. The device beside the Inspector in era II (Sensor 7) did not render. The player wanted the curve to run clicks first, then clicks plus passive income, then passive income with clicks optional but still worth something: tree upgrades and on-screen events keep clicking warm.
- **Hand (0 to about 4 min).** Worn Motor (+2 ME/s) is worth about 0.67 clicks/s when bought. Clicks are at least 75 % of ME income until 2:00 and at least 50 % until 4:00. Passive ME passes the 4-cps clicking at about 6:50, around Piston Array.
- **Hand plus machine (rest of era I through era II).** Clicks give 30–50 % of income for a 4-cps player.
- **Machine (eras III–V).** Plain clicks give 10–25 %. With the click branch and Faults, an active player earns at least 35 % from active play.
- **Whole run.** A player who clicks for 5 minutes and then drops to 0.5 cps finishes at 1.2–1.6× the always-clicking time (measured 1.45×). The always-clicking finale stays within 10 % of before: 250:09 (was 250:11).

Clicks, mechanics and fixes:
- **Click echo.** Every click also yields seconds of the machine's output in every energy, ME included: Reinforced Crank 0.15 s, Dynamo Crank 0.3 s, Echo Crank 0.05 s, Inversion Crank 0.05 s. A mechanical click is never worth less than another energy's click.
- **Wind-up (click branch).** The machine stores output: capacity 0.35 s at Reinforced Crank, up to 2.0 s fully invested, refilling up to 0.2 s per second. The next manual turn of the crank releases all of it ("RELEASE +1.4s", HUD row WIND-UP). Servo cranks never release it. Nodes: Reinforced Crank, Flywheel (per level), Steam Hammer, Discharge Lever, Damping Fork, Overrun Clutch.
- **Machine Faults.** Fault Lamp (3000 ME, after Improved Pistons) turns them on. A fault shows on a part of the machine for 8 s, 90–180 s apart: never in the first 3 minutes of a session, never offline, and only while the game is visible and interactive. Clearing it (click, or key F) pays 15 s of all output (18 s and 22 s with later nodes); missing it costs nothing. Leak Whistle ×0.9 interval; Damping Fork +4 s window and +4 s payout; Overrun Clutch ×2 output for 6 s after a clear. Era II and later nodes: Discharge Lever (20000 EE), Leak Whistle (100000 PR, after Bellows Drive), Damping Fork (300000 RS), Overrun Clutch (50000 XF). The demo has Fault Lamp and Discharge Lever. Key F (CLEAR FAULT) is listed in SETTINGS > KEYS. Neither mechanic is saved: no save field, SAVE_VERSION stays 2.
- **Crow and Sensor 7.** In eras I–II the crow is perched with folded wings: it looks, pecks and ruffles. Spread wings show only as a glitch of at most 1.8 s. From cycle 2 the old held flight pose appears only as that glitch, never in eras III–V. Its bubbles use the folded frames through era IV, and the ruffle drip falls only from era III. Sensor 7 stands next to the Inspector in every era II framing (new framing s8w).
- **Economy retune.** The F2hi tables are in `docs/plan/WP27.md`. Residual Charge 50 → 10 %; Echo bonus 15 → 14 % per Echo, with 12 Echoes counted (prestige bounds unchanged). The hum bed ceiling rises from 40000 to 1000000 per second so late ME output does not saturate it.

### 18.7 User playtest (2026-10-28): no dead waits, Splices, Finds, a warm world (WP28)
Append-only note (WP28, 2026-10-29, shipped as 0.12.0 with WP28a and WP28b together). Nothing above this line was changed.
The playtest found three problems. Waiting for an upgrade, with the player tired of clicking, was boring: the 90th-percentile wait
for a player who stops clicking was 1:56. The environment still looked dead: things moved in fixed places and could not be
touched. The machine's effects were too faint to see, and the player wanted more things to act on.

Decisions (the full plan is `docs/plan/WP28.md`; the numbers live in `src/data/`):
- **D1 No dead wait.** The 17 split techs are cut into two or three steps each, at the same power and the same total time.
  Unlock prices fall to about 0.65 of their v0.11.0 values (Generator, Fault Lamp and Primary Function unchanged). BUY MAX buys
  repeatables in one press. A NEXT BUY line under the HUD goal names the next purchase that is not yet affordable, with a rough
  time. Sims as printed at WP28a: A p90 gap 1:24 → 0:42, B p90 1:56 → 1:02, B max 6:08 → 2:33 before the final alignment, A
  primary function 246:40 (was 250:09), B / A 1.497.
- **D2 Splices.** Sixteen one-time purchases, each in an energy in play. A line runs from the machine to a dead object of the
  old world and wakes it, partly wrong: the bicycle's back wheel turns the wrong way, the kite rises with no wind. Bought from
  the world or the SPLICES tab. Prestige darkens them again, with one SYS LOG line. The eras III-V objects (WP28b) are a pump, a
  factory whistle, a hydrant, a bell, a gramophone, wind chimes, a weathervane, a kite, a cairn and a coin return; their lines are
  an iron pipe (III), a standing-wave wire (IV) and lifted debris specks (V).
- **D3 Finds.** A glinting item lies near a denizen or in the wind. Pick it up with G within about 25 s for 4, 6 or 8 s of all
  output. Every fifth one is a relic: a field note from the prior world, with no payout. No miss counter, no offline Finds.
- **D4 Pokes.** Every denizen and every woken object answers a click with a short, varied reaction. Repeats escalate, then the
  target goes quiet for 20 s. No economy effect. Two poke bubbles (WP28b): the Inspector's level-2 answer may show "Noted." (eras
  I-III and V), and the girl's level-2 answer may show a wordless "…". Each has a 50 % chance (RARE: 25 %), at most one per actor
  per 120 s and four an hour, never over a line bubble, and none with WORLD VOICES off.
- **D5 Roaming and reacting.** The cast walks the wing and the empty yard in lanes. Walks between spots are visible; a relocation
  waits for an unseen moment (the TECH INDEX open, or both places off-screen). The Inspector, the dog and the crow start an action
  at least every 12 s (the B1 gate; the girl never moves). Denizens react to faults, Finds, big purchases, era changes and woken
  objects, never to the machine itself. A reaction starts within about 1 s of its cause (a reaction that walks also waits for the
  walk gate), except the Inspector's Find reaction (2 to 4 s after the spawn), the ground wave (each walker reacts when the wave
  reaches its x) and a visit (3 to 8 s after the wake, once the walker stands on a spot the stand can be reached from). A visit is the Inspector's (left-wing objects) or the dog's (right-wing
  objects), in eras I-III and V; the crow has no visit stand and no visit activity. Once per wake, when a hop is allowed, by one hop or two through a middle perch (each at most 160 px, never over the machine) when such a path exists (else it stays put), the crow lands on the woken object's perch top where one exists (the bicycle seat, the sign top, the whistle top and the bell frame; the vane top and the kite top, which take the booth roof and the lamp top). Never in era IV or under reduced motion. A Find's producer acts first: the crow's item drops from its perch, the
  dog digs at it within 24 px, a gust flips a scrap, and a woken organ, radio, payphone or pump twitches as its item rises.
- **D6 The machine's reach.** A crank click sends a pulse along the ground. Output drives the pylon-line pulses, the base dust and
  the lamp wobble. Each era has one signature effect (pebbles at the machine's feet in I, arcs in II, steam in III, hum and ripples
  in IV, debris in V), and a big purchase sends a ground wave. Flashes stay at or below 3 Hz. Reduced motion turns the effects off;
  the debris specks hang still.
- **D7 Text, a11y, audio.** English, plain words, US spelling, no exclamation marks, and the ellipsis is the single character …. Finds and Splices are announced to screen
  readers, the Splice list is keyboard reachable, and each new event has a synth cue.
- **D8 Budgets.** The Director's rulings of 2026-10-29 set the caps: app JS 525 KB, Director chunk 280 KB, WorldReach 50 KB, shared
  lazy 6 KB, lazy world total 330 KB, CSS 45 KB. The build target is ES2022. Boot and GPU frame p95 (17 ms) stay the hard gates.
- **D9 Docs and version.** Version 0.12.0 (one release for both parts). `CHANGELOG.md`, this note, `docs/plan/STORY_BIBLE.md`,
  `docs/plan/DENIZEN_ART.md` and the README Balance section.
- **D10 Execution.** WP28a (economy: pacing, Splices, Finds, pokes) and WP28b (roaming, reactions, reach, Splice objects for eras
  III-V, poke bubbles) in two passes with one gate.

Canon held (C1-C14 in `docs/plan/WP28.md`): the girl never moves on screen; Sensor 7 faces the camera; denizens never touch,
overlap or walk through the machine; the crow hops on the right wing only, at most 160 px, never over the machine, and not in
era IV; no line names the machine's function or contains the R-word; no blue or green before the finale; no readable text in
art; the clock keeps 4:41.

Rulings (2026-10-29): the save remap is held to 1 % in eras I-II and 3 % in eras III-V (Q4). Find payouts are 4, 6 or 8 s with
equal weight (Q6). For the budgets (Q14), the trim-first order ran before any cap was raised; the caps above are the Director's
ruling after that trim.

Carry-overs from the Art Director's round 3 (S3, WP28b). F23: under reduced motion, the steady dot of an era II line sits 48 px
before the object's end, clear of the radio crate and the sign box; a line under 96 px takes its midpoint. F24: at the KEEP IT
RUNNING click the postgame-moved objects (the bicycle, the organ, the whistle and the gramophone) fade out from 4 s to nothing at
4.5 s, switch sides while hidden, and fade in at their postgame feet from 5 s to full at 5.6 s. Under reduced motion they switch
at 5 s with no fade.

Acceptance pointers: `docs/plan/WP28.md`, sections "Package acceptance, WP28a" and "Package acceptance, WP28b" (B1-B11); the Art
Director verdicts in `docs/plan/ART_AUDIT.md` (`## WP28a`, `## WP28b`); the sims in `src/simulation/pacing.sim.test.ts` and
`src/simulation/balance.sim.test.ts`; the smokes listed in `scripts/smoke/README.md`. Release details: `CHANGELOG.md` (0.12.0).
