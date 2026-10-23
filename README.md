# What Exactly Does This Machine Do?

A 2D incremental (idle) game prototype about an unexplained machine in a rust-coloured wasteland. You turn a
hand crank to make Mechanical Energy (ME), spend it on technologies, and unlock new parts of the machine.
The game is built with Phaser 3, strict TypeScript, Vite and Vitest. Progress is saved to `localStorage`;
there is no server.

Core experience: turn a crank, buy upgrades, and watch the machine assemble itself part by part. The first
session is paced to last roughly 15 to 30 minutes.

## Requirements

- Node.js **22.12 or newer** (Vitest 5 declares `^22.12.0 || ^24.0.0 || >=26.0.0`; Vite 6 alone would run on
  Node 18+, but the test toolchain does not).
- npm (ships with Node).
- A modern browser with WebAudio and `localStorage` (audio is optional and starts after the first gesture).

## Setup

```bash
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server (default http://localhost:5173). |
| `npm run typecheck` | `tsc --noEmit` with the strict project config. |
| `npm test` | Runs the Vitest suite once (simulation, persistence, data, UI-model and math tests). |
| `npm run build` | Type-checks, then produces the production bundle in `dist/`. |
| `npm run preview` | Serves the built `dist/` locally (default http://localhost:4173). Run `npm run build` first. |
| `npm run verify` | Typecheck + test + build. |
| `npm run desktop:dev` | Builds, then runs the Electron shell on `desktop/`. |
| `npm run build:steam` | Packaged Windows build in `out/steam/full/win-x64/`. |
| `npm run build:steam-demo` | Same for the demo edition folder `out/steam/demo/win-x64/`. |

Steam packaging, SteamPipe and Auto-Cloud details: [`docs/STEAM_RELEASE.md`](docs/STEAM_RELEASE.md).

Balance simulation only:

```bash
npx vitest run src/simulation/balance.sim.test.ts
```

## Controls

| Input | Effect |
|---|---|
| Left-click the hand crank | +ME per click (ME/click). The crank turns, the machine shakes and a `+N` text floats up. |
| Mouse wheel | Zooms in or out around the pointer. Zoom range is 0.5x to 2x. |
| Drag (left or middle button) | Pans the camera. A drag starts only after 4 px of movement; a press that starts on an interactive object (such as the crank) does not pan. |
| REFOCUS button (HUD) | Animates the camera back to the default view on the machine. |
| TECH INDEX button (HUD) | Opens the technology tree overlay. Clicking the dark backdrop also closes it. |
| SYSTEM button (HUD) | Opens the system menu: audio on/off, SAVE STATE, RESET PROGRESS (press once to arm, press again within 5 s to erase; CANCEL disarms). |
| Esc | Closes the top-most open dialog (reset confirmation first, then the system menu or tech tree). Does nothing when no dialog is open. |

While a dialog is open the game canvas ignores pointer input, so the world does not react behind the overlay.

## Architecture

### Layers

- **Pure simulation** (`src/simulation`, `src/data`, `src/persistence`, `src/utils`): no Phaser, no DOM.
  `GameSession` is the single gateway for the UI and renderers. It exposes commands (`click`, `purchase`,
  `update`, `reset`, settings), typed events, and immutable snapshots with a `revision` counter.
- **Phaser rendering** (`src/game`): scenes, the machine view, the hand crank, the camera controller, the
  parallax background and particle effects. Renderers read session state; they never own economy state.
- **DOM UI** (`src/ui`): HUD, tech tree, system menu, toasts, system log and the shared modal stack. The
  overlays sit on top of the canvas inside `#ui-root`.
- **Audio** (`src/audio`): WebAudio synth for sound effects, hum, gear ticks and wind. No audio files.
- **Assets** (`src/assets`, `public/assets`): PNG art loaded through a manifest, with procedural fallbacks.

### Data flow

```
input (canvas pointer/wheel, DOM buttons)
  -> GameSession (pure sim: click, update(dt), purchase, reset)
  -> events + immutable snapshots (state, rates, revision)
  -> Phaser renderers (WorldScene, MachineView, HandCrank, camera, background)
  -> DOM UI (HUD, tech tree, system menu, toasts, system log)

SaveController <-> localStorage['wedtmd.save']   (autosave every 15 s, on purchase/milestone, on page hide)
data tables (src/data) -> simulation (costs, effects, prerequisites, milestones)
data tables (src/data) -> renderers (machine component layout, world geometry, palette)
```

Boot order (`src/game/bootstrap.ts`): load save -> `new GameSession(...)` -> apply offline progress once
(capped at 8 hours, reported once) -> build UI and modal stack -> start autosave -> start the Phaser game.
Offline gaps longer than 60 s seen during play also go through the offline path.

### Folder map

| Path | Contents |
|---|---|
| `src/data/` | Balance and content tables: technologies, balance constants, machine components, world/camera, system logs, notifications, palette, audio, system menu. |
| `src/simulation/` | `GameSession`, state factory, economy (costs), production (rates, tick), progression (status, requirements, purchase, milestones), typed events. |
| `src/persistence/` | Versioned JSON codec, validation and recovery of corrupt saves, `SaveManager`, `SaveController`, startup. |
| `src/game/` | `bootstrap.ts`, `scenes/` (BootScene, WorldScene), `entities/` (MachineView, HandCrank, MachineAnimator), `rendering/`, `math/` (pure geometry and animation helpers with tests). |
| `src/ui/` | HUD, tech tree (`techTree.ts` + pure `techTreeView.ts`), system menu, toasts, system log, modal stack, notification rules. |
| `src/audio/` | `gameAudio.ts` (controller), `synth.ts` (WebAudio), `audioMath.ts`. |
| `src/assets/` | Asset ids, manifest, fallback textures, procedural painters. |
| `src/utils/` | Number and rate formatting, signal helper. |
| `public/assets/` | Shipped PNG art (`bg`, `fx`, `machine`, `terrain`). |
| `docs/` | `GAME_SPEC.md` (requirements), `PROJECT_STATUS.md`, `ASSET_GUIDE.md`, `plan/` (work packages). |

## Implemented features

- **WP1, pure core**: production model (additive bonuses, then multiplicative modifiers), costs with
  `ceil(base * growth^level)`, technology prerequisites, milestones, `GameSession` facade, versioned save codec.
- **WP2, world and crank**: wasteland parallax (sky, mountains, skyline, pylons, terrain, dust), camera with
  drag-pan, wheel zoom and animated refocus, the machine frame and the clickable hand crank with `+ME`
  feedback, terminal-style HUD.
- **WP3, tech tree and machine**: tech tree overlay (nodes, prerequisite lines, states, detail panel with
  current and next effects, costs and shortfalls), toasts, modular machine components that assemble when
  unlocked, procedural machine animation driven by clicks and ME/s.
- **WP4, save, audio and menus**: autosave and save on unload, load with recovery of corrupt saves, offline
  progress with a welcome-back summary, system menu (save, mute, two-step reset), Esc/modal stack, WebAudio
  sound effects and ambience, rare system log entries.
- **WP5, balance and polish**: retuned technology costs (see Balance), the greedy balance simulation test,
  the PixelLab asset guide, this README, and a split build (Phaser in its own chunk).

## Balance

The first session is tuned against greedy-player targets: a player who clicks four times per second and
buys the cheapest available technology each second.

Final simulation results (`src/simulation/balance.sim.test.ts`, 3600 simulated seconds, deterministic):

| First reached at | Greedy time (mm:ss) | Assertion |
|---|---:|---|
| Gear Ratio (level 1) | 0:04 | not asserted |
| Worn Motor | 0:13 | under 60 s |
| Motor Tuning | 0:20 | not asserted |
| Reinforced Crank | 3:16 | 180-300 s |
| Flywheel | 4:49 | not asserted |
| Piston Array | 12:02 | 600-900 s |
| Improved Pistons | 12:38 | not asserted |
| Generator Blueprint | 22:06 | 1200-1800 s |

**Deviation from the spec (explicit).** `docs/GAME_SPEC.md` section 6 gives initial balancing numbers. A
greedy player reached every milestone in under a minute with those numbers, so the values were retuned.
The spec text itself is not edited; the spec calls its numbers initial targets. Retuned values live only in
`src/data/technologies.ts` and `src/data/systemLogs.ts`.

| Tech | Spec base / growth | Current base / growth / max level |
|---|---|---|
| Gear Ratio | 10 / 1.15 | 15 / 1.3 / 15 (was 25) |
| Reinforced Crank | 50 | 2000 |
| Flywheel | 150 / 1.20 | 4000 / 1.35 / 10 |
| Worn Motor | 25 | 40 |
| Motor Tuning | 40 / 1.18 | 60 / 1.3 / 25 |
| Piston Array | 250 | 12000 |
| Improved Pistons | 120 / 1.20 | 6000 / 1.3 / 25 |
| Generator Blueprint | 1,000 lifetime ME | 200,000 lifetime ME |

System log lifetime-ME triggers were scaled the same way: 25 / 120 / 600 / 2500 became 500 / 5000 / 30000 /
100000. Effects, prerequisites and technology ids did not change.

To re-run the targets after editing the data:

```bash
npx vitest run src/simulation/balance.sim.test.ts
```

The test prints a table of first-reached times per run and asserts the four targets above. If one fails, tune
one knob (Reinforced Crank base cost, Piston Array base cost, Generator Blueprint threshold, or Worn Motor
base cost) and update the tests that assert those values.

## Assets

Art is generated with PixelLab in a locked palette (see `docs/plan/ART_BRIEF.md`) and placed under
`public/assets/`. Replacement, spritesheet and fallback rules are in [`docs/ASSET_GUIDE.md`](docs/ASSET_GUIDE.md).
Audio is synthesized at runtime; no audio files are shipped.

## Development workflow

Work is split across a planning and implementation hierarchy of Claude agents. Agent roles and the iteration
loop are described in [`CLAUDE.md`](CLAUDE.md); work packages and their assignments are in `docs/plan/`.
Project progress is tracked in [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

## Next milestones

- Electricity era after the Generator Blueprint (not implemented; no electricity resource yet).
- Big-number support for very large values.
- Save export and import.
- Real audio assets to replace the synthesized sound.
- Accessibility and keyboard navigation for the tech tree and system menu.
- More machine parts and more technologies.
