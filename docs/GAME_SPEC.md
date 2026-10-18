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
