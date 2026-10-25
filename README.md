# What Exactly Does This Machine Do?

An idle game about an unexplained machine in a rust-coloured wasteland. Turn the hand crank, buy technologies across five eras, and watch the machine assemble itself part by part, with each part gaining visible tiers as it is upgraded. A few denizens of the wasteland change with each era and sometimes speak to you. Its purpose is revealed in the finale. It is built with Phaser 3, strict TypeScript, Vite and Vitest. Progress is saved locally (`localStorage` in the browser, save files in the desktop build); there is no server.

## Editions

Version 0.10.0 (`package.json`). The full game and the Steam demo are built from one codebase.

| | Full game | Demo |
|---|---|---|
| Content | All five eras, the finale, the postgame and new cycles. | Eras I and II (with the living world for those eras), capped at the Substation Blueprint. |
| Config | `EDITIONS.full` in `src/data/edition.ts`, no cap. | `EDITIONS.demo` in `src/data/edition.ts`: cap `substationBlueprint`, max era 2, label `DEMO`. |
| Vite mode | `production` | `demo` |
| Browser build | `npm run build`, output `dist/` | `npm run build:demo`, output `dist-demo/` |
| Windows package | `npm run build:steam`, output `out/steam/full/win-x64/` | `npm run build:steam-demo`, output `out/steam/demo/win-x64/` |

**Demo end flow**

1. Reaching the Substation Blueprint milestone (it completes on its own once its requirements are met) starts a 4 s timer. Then the final-machine teaser plays for about 9.5 s. Its caption is `PRIMARY FUNCTION: RES?OR?`, and the machine's name stays redacted.
2. The teaser holds on its last frame for 1.5 s. Then the card `END OF DEMO — THE MACHINE IS NOT FINISHED.` opens with four buttons: WISHLIST ON STEAM, KEEP TINKERING (closes the card), REPLAY TEASER and QUIT (desktop build only).
3. WISHLIST ON STEAM opens the full game's store page (through the Steam client in the desktop build). The link uses the placeholder app id `0000000` until the Steam page exists; see [`docs/STEAM_RELEASE.md`](docs/STEAM_RELEASE.md) section 14.

**Demo differences in the UI**

- SYSTEM tab: a DEMO ENDING row appears once the Substation Blueprint is owned and reopens the card.
- Tech Index: era tabs III to V read FULL GAME. Techs above era II cannot be bought.
- No MEMORY tab and no new-cycle rows.
- RECORDS shows `/18` (the records reachable in eras I and II) instead of `/33`.
- A full-game save loaded by the demo is clamped to the cap. The original save text is kept under `wedtmd.save.fullgame`.

**Demo cap timings.** Greedy test players reach the Substation Blueprint in these windows (active play, mm:ss). Source: `src/simulation/demoCap.sim.test.ts`; re-run with `npx vitest run src/simulation/demoCap.sim.test.ts`.

| Path | Clicks and buys (test profile) | Window | Reached |
|---|---|---|---|
| A | 4 clicks/s, buys every 1 s | 55:00 to 66:00 | 60:23 |
| B | 4 clicks/s, buys every 30 s | 66:00 to 80:00 | 72:52 |
| N | new player: 2 clicks/s, buys every 10 s | 90:00 to 108:00 | 98:29 |
| C | 1 click/s, buys every 30 s | 135:00 to 163:00 | 148:28 |

## How to play

**Crank.** Click the hand crank, or press Space or Enter, to make Mechanical Energy (ME). Keyboard presses are capped at 15 per second, and key repeat is ignored.

**Tech Index.** Press `T` or the TECH INDEX button in the HUD. Buy technologies with the energy shown on each node. Keystones open the next era. The HUD line `NEXT:` names the next milestone or keystone.

**Living world.** A few denizens of the wasteland stand at the edges of the scene and change with each era. Now and then one turns to you and speaks in a speech bubble. WORLD VOICES in SETTINGS sets how often: ON, RARE or OFF.

**Eras and energies**

| Era | Energy | Keystone (opens the era) | Milestone (before the next keystone) |
|---|---|---|---|
| I · MECHANICAL | Mechanical Energy (ME) | none (starting era) | Generator Blueprint |
| II · ELECTRICAL | Electrical Energy (EE) | Generator | Substation Blueprint |
| III · PRESSURE | Pressure (PR) | Boiler | Vessel Blueprint |
| IV · RESONANCE | Resonance (RS) | Resonator Spire | Convergence |
| V · ??? | Unknown Flux (???), shown as Restoration Flux (RF) after the reveal | Null Chamber | Final Alignment, then Primary Function |

**Feeds.** Five repeatable techs spend an older energy and boost a newer one. Only Resonant Siphon has a max level.

| Tech | Era | Cost | Effect per level | Cost growth | Max level |
|---|---|---|---|---|---|
| Bellows Drive | III | ME, base 250,000 | +8 % PR production | 2.5 | none |
| Grid Exciter | IV | EE, base 2,000,000 | +8 % RS production | 1.4 | none |
| Mains Backfeed | V | EE, base 20,000,000 | +6 % ??? production | 1.4 | none |
| Steam Lance | V | PR, base 5,000,000 | +6 % ??? production | 1.4 | none |
| Resonant Siphon | V | RS, base 10,000,000 | +2 ???/s and +5 % ??? production | 1.3 | 20 |

**Offline progress.** Progress made while the game is closed is credited on return, up to 8 h. Relief Valves (era III tech, costs PR) add 4 h, and the Long Silence perk adds 4 h more, so the cap is 16 h at most. A WELCOME BACK toast reports the gain after an absence of at least 60 s. The game autosaves every 15 s, and again when the page is hidden.

**Finale.** Buying Primary Function starts the ending, and the machine's purpose is revealed (`PRIMARY FUNCTION: RESTORE`). Esc skips the sequence. Then a choice appears: KEEP IT RUNNING continues into the postgame, and BEGIN A NEW CYCLE starts a new cycle. From the choice on, the HUD title reads RESTORATION ENGINE.

**Postgame and VIEW MACHINE.** In the postgame the HUD shows VIEW MACHINE, which opens photo mode. Drag to pan, use the mouse wheel or `+` / `-` to zoom, and use the arrow keys to pan. Esc or `EXIT VIEW [ESC]` leaves it.

**New cycle.** BEGIN A NEW CYCLE resets the machine, resources and tech levels, and the finale replays from the start. Settings, stats and achievements are kept, along with Echoes and Memory perks. A confirm dialog comes first unless CONFIRM NEW CYCLE is off in SETTINGS.

Each finished cycle grants 3 Echoes, plus one for each Restoration Flux threshold reached (2B, 8B and 32B lifetime RF). Each Echo adds +30 % to every per-second rate, counting up to 30 Echoes. Clicks are not affected. Spend Echoes on Memory perks in SYSTEM > MEMORY. That tab appears from the second cycle on, or once the Primary Function is engaged.

| Perk | Cost (Echoes) | Effect |
|---|---|---|
| Muscle Memory | 1 | Each new cycle starts with Worn Motor 1 and Gear Ratio 3. |
| Residual Charge | 2 | Every converter yields 50 % more. |
| Long Silence | 2 | Offline cap +4 hours. |
| Servo Recall | 3 | Automatic crank: +1 click per second, offline too. |
| Ledger | 3 | Keystone converters (Generator to Null Chamber) cost half. |

## Controls

| Input | Effect |
|---|---|
| Left-click the hand crank | +ME per click (ME/click). The crank turns, the machine shakes and a `+N` text floats up. |
| Space / Enter | Same as a click, when no dialog is open and no button or text field has focus. Capped at 15 presses per second; key repeat is ignored. |
| Mouse wheel | Zooms in or out around the pointer. Zoom range is 0.5x to 2x. |
| Drag (left or middle button) | Pans the camera. A drag starts only after 4 px of movement; a press that starts on an interactive object (such as the crank) does not pan. |
| REFOCUS button (HUD) | Animates the camera back to the default view on the machine. |
| `T` | Opens the technology tree, or closes it when it is open. |
| TECH INDEX button (HUD) | Opens the technology tree. Clicking the dark backdrop closes it. |
| SYSTEM button (HUD) | Opens the SYSTEM menu. RESET PROGRESS is two-step: press once to arm, press again within 5 s to erase; CANCEL disarms. |
| Esc | Closes the top-most open dialog (for example the reset confirmation, tech tree, credits or photo mode). With no dialog open, opens the SYSTEM menu, except during the finale or a new cycle. Does nothing at the finale choice. |
| F11 / Alt+Enter | Toggles fullscreen. The desktop shell handles both keys. In the browser, Alt+Enter toggles fullscreen and F11 stays with the browser. The FULLSCREEN row in SETTINGS does the same. |
| Tab / Shift+Tab | Move focus between controls. Focus stays inside an open dialog. |
| Arrow keys | In the tech tree, move between era tabs. In the SYSTEM menu, move between tabs (Home and End jump to the ends). In photo mode, pan. |

While a dialog is open the game canvas ignores pointer input, so the world does not react behind the overlay.

## Settings and accessibility

**SETTINGS tab**

- AUDIO: MASTER, SFX, AMBIENT and MUSIC volumes, 0 to 100 % in steps of 5. Defaults 100, 100, 100 and 70 %. The audio on/off switch is in the SYSTEM tab.
- DISPLAY: NUMBERS (SUFFIX, SCIENTIFIC, ENGINEERING; default SUFFIX), UI SCALE (100 %, 125 %, 150 %; default 100 %), WORLD VOICES (ON, RARE, OFF; default ON), STATUS MARKERS (default off), CONFIRM NEW CYCLE (default on; shown once the finale or a new cycle is in play), FULLSCREEN (where supported).
- ACCESS: REDUCED MOTION (default off) and SCREEN SHAKE (default on; locked off while REDUCED MOTION is on).
- KEYS: the three shortcuts (SPACE / ENTER crank, T TECH INDEX, ESC MENU).

**SYSTEM menu tabs:** SYSTEM, SETTINGS, STATS, RECORDS, MEMORY, DATA.

- SYSTEM: SAVE STATE, AUDIO ON/OFF, RESET PROGRESS, CREDITS, QUIT TO DESKTOP (desktop build), DEMO ENDING (demo, once the cap is owned) and BEGIN A NEW CYCLE (postgame).
- RECORDS: 33 achievement records (18 in the demo).
- MEMORY: Echoes and Memory perks (see New cycle above).
- DATA: EXPORT SAVE shows a read-only save string to copy. IMPORT SAVE takes a pasted save string; it replaces the current save, and the old save is backed up first.

**Accessibility**

- Keyboard play: `T` opens the tech tree, arrow keys move between era tabs, Tab reaches the tech nodes, and Enter or Space buys.
- Visible focus rings. While open, Tab and Shift+Tab stay inside the title screen, credits, SYSTEM menu, TECH INDEX, finale, new-cycle confirm and END OF DEMO card.
- Text is at least 12 px. WCAG contrast and accessible names are checked by `scripts/smoke/a11y.mjs` (Playwright; see `scripts/smoke/README.md`).
- REDUCED MOTION caps the crank wobble, turns off camera tweens and assembly drops, and locks SCREEN SHAKE off. On a new save, the OS `prefers-reduced-motion` setting turns it on at first start.
- UI SCALE goes up to 150 %.

## Requirements

- Node.js **22.12 or newer** (Vitest 5 declares `^22.12.0 || ^24.0.0 || >=26.0.0`; Electron 44 needs `>= 22.12.0`; Vite 6 alone would run on Node 18+, but the test toolchain does not).
- npm (ships with Node).
- A modern browser with WebAudio and `localStorage` (audio is optional and starts after the first gesture).
- For `npm run icon:desktop`: Python 3 with Pillow. For the packaged builds: Windows x64.

## Setup

```bash
npm install
```

`npm run desktop:dev` needs the Electron binary. If it reports the binary as missing, run `node node_modules/electron/install.js` or `npm approve-scripts electron`, then try again.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server (default http://localhost:5173). |
| `npm run build` | Type-checks, then produces the production bundle in `dist/`. |
| `npm run build:demo` | Same with Vite mode `demo`, output `dist-demo/`. |
| `npm run preview` | Serves the built `dist/` locally (default http://localhost:4173). Run `npm run build` first. |
| `npm run typecheck` | `tsc --noEmit` with the strict project config. |
| `npm run verify` | Typecheck, `npm test`, `npm run build`, then the bundle budget check (`node scripts/perf/bundle-budget.mjs`). |
| `npm test` | Runs the Vitest suite once. |
| `npm run test:watch` | Runs Vitest in watch mode. |
| `npm run desktop:dev` | Builds `dist/`, then runs the Electron shell on `desktop/`. |
| `npm run build:steam` | Packaged Windows build of the full edition in `out/steam/full/win-x64/`. |
| `npm run build:steam-demo` | Packaged Windows build of the demo edition in `out/steam/demo/win-x64/`. |
| `npm run icon:desktop` | Rebuilds `desktop/icon.png` and `desktop/icon.ico` from `public/assets/ui/logo-mark.png` (Python 3 with Pillow). |
| `npm run perf:bundle` | Checks the built `dist/` against the raw size budgets in `scripts/smoke/perf-budget.json`. Exits 1 on a breach. |

Steam packaging, SteamPipe and Auto-Cloud details: [`docs/STEAM_RELEASE.md`](docs/STEAM_RELEASE.md).

## Saves

The browser build keeps saves in `localStorage`. The desktop build keeps them as files (see below). A save is plain JSON with a version number (`SAVE_VERSION`, currently 2, in `src/persistence/schema.ts`). Format changes are additive and migrate step by step (`MIGRATIONS` in the same file). The optional `world` block (living-world lines seen) was added without a version bump.

**Browser keys** (`src/data/balance.ts`)

| Key | Holds | Written |
|---|---|---|
| `wedtmd.save` | The active save. | Autosave every 15 s; also on purchase, milestone, achievement, ending, new cycle, perk, settings and reset changes, on import, on page hide and on unload. |
| `wedtmd.save.corrupt` | Raw text of a save that failed validation, copied before the game recovers. | At boot, when the stored save is recovered. |
| `wedtmd.save.preimport` | The save as it was before a player import overwrote it. | Before IMPORT SAVE (SYSTEM > DATA) writes the imported save. |
| `wedtmd.save.fullgame` | The original full-game save text, kept when the demo clamps the save to its era cap. | Demo boot, only when the clamp changes the save. |

**Desktop build (Electron).** Each key is a file `saves/<key>.json` under the user-data folder. The folder depends on the edition and on whether the build is packaged (`docs/STEAM_RELEASE.md` section 7):

| Build | User-data folder |
|---|---|
| Full game, packaged | `%APPDATA%/WhatExactlyDoesThisMachineDo/` |
| Full game, unpackaged dev run | `%APPDATA%/WhatExactlyDoesThisMachineDo-dev/` |
| Demo, packaged | `%APPDATA%/WhatExactlyDoesThisMachineDo Demo/` |
| Demo, unpackaged dev run | `%APPDATA%/WhatExactlyDoesThisMachineDo Demo-dev/` |

Files inside `saves/`:

- `wedtmd.save.json`: the main save.
- `wedtmd.save.json.bak`: the previous generation. It is copied before each write, and it is read instead when the main file is missing, empty or unreadable.
- `<key>.json.tmp`: the transient write. It is fsynced, then renamed over the main file.

Notes:

- The first desktop launch copies an existing browser save family (`wedtmd.save`, `wedtmd.save.corrupt`, `wedtmd.save.preimport`) once, when the desktop host has no save yet.
- A save file that exists but cannot be read (for example an antivirus lock) blocks writes for that session. The cause is logged to `logs/main.log`.
- Demo and full game never share saves. Browser saves are per origin, so host the demo web build (`dist-demo/`) on its own site or origin.

**Recovery.** A save that fails validation (including a save from a newer version) starts a fresh game. Its raw text is copied to `wedtmd.save.corrupt` first, and a toast reports the recovery. If storage is unusable, saves fall back to memory and a banner says so.

**Export and import.** SYSTEM > DATA: EXPORT SAVE shows the save as a text string. IMPORT SAVE is two-step (the second press within 5 s confirms). The current save goes to `wedtmd.save.preimport` before the imported save is written.

**Compatibility tests.** `src/persistence/compat.test.ts` runs the 10 rows of `src/persistence/fixtures/` (one v1 save, seven v2 saves, one save from a newer version, one corrupt text) through the codec, `SaveManager` with `startSession`, export/import and the host storage path.

## Tests and smokes

`npm test` runs the Vitest suite once (`vitest run`). `npm run test:watch` runs it in watch mode. Unit tests sit next to the code as `*.test.ts`. The deterministic simulation checks use `*.sim.test.ts` and `*.e2e.test.ts`.

Big suites:

| File | Checks |
|---|---|
| `src/simulation/balance.sim.test.ts` | Greedy-player pacing for eras I to V, energy continuity, determinism. Prints the first-reached table. |
| `src/simulation/signoff.sim.test.ts` | Balance sign-off: era-end windows, Primary Function by path, purchase gaps, Memory cycles (see Balance). |
| `src/simulation/demoCap.sim.test.ts` | Demo cap timings for the four greedy paths (see Editions). |
| `src/simulation/fullRun.e2e.test.ts` | Full run through `GameSession` with save round trips: keystones, finale, postgame, cycle 2, numeric guards. |
| `src/persistence/compat.test.ts` | Save compatibility matrix, 10 fixture rows (see Saves). |
| `src/assets/assetGuide.test.ts` | `docs/ASSET_GUIDE.md` table: one correct row per manifest id. |

Browser smokes (Playwright, not part of `npm test`) live in `scripts/smoke/`. They need the Playwright package (`PW_PATH`, the folder that contains it), a served build (`npm run build`, then `npm run preview`) and, for the `window.__wedtmd` debug hook, `?debug=1`. Each script prints one JSON object. Usage for every script is in [`scripts/smoke/README.md`](scripts/smoke/README.md).

Release smokes:

- `e2e-full.mjs`: one browser run from the title screen to a new cycle and a reload, with real keyboard and mouse input.
- `a11y.mjs`: keyboard reach, focus traps, focus rings, accessible names, 12 px text floor, WCAG contrast, reduced motion, UI scale 150.
- `ux.mjs`: first-impression checks (crank prompt, guidance, era cards, layout at UI scale 100 and 150).
- `resolutions.mjs`: HUD, tech tree and SYSTEM menu against the canvas at five viewports.
- `soak.mjs`: timed run (`SOAK_MIN` minutes) with heap, display object, DOM node and voice samples.
- `store-shots.mjs`: reproducible Steam store screenshots (`SIZES`, `VARIANTS`).
- `demo.mjs` and `demo-cases.mjs`: the demo edition, on the `dist-demo/` build served on its own port.
- `perf.mjs`: stage timings, frame p95, heap, voices and boot against `scripts/smoke/perf-budget.json` (see Performance budgets).

Older content and menu smokes (`wp2-crank.mjs`, `wp3-techtree.mjs`, `wp4-persistence.mjs`, `wp12-menus.mjs`, `finale.mjs`, `prestige.mjs`, `showcase.mjs`, `stages.mjs`, `full-machine.mjs`) and the shell and desktop checks (`shell.mjs`, `desktop.mjs`) are described in the same README.

## Architecture

### Layers

- **Pure simulation** (`src/simulation`, `src/data`, `src/persistence`, `src/utils`): no Phaser and no DOM.
  `GameSession` is the single gateway for the UI and renderers. It exposes commands (`click`, `purchase`,
  `update`, `reset`, settings), typed events, and immutable snapshots with a `revision` counter.
- **Phaser rendering** (`src/game`): scenes (`BootScene`, `WorldScene`, `ShowcaseScene`), the machine view, the hand
  crank, the camera controller, the parallax background, the finale and particle effects. Renderers read session
  state; they never own economy state.
- **DOM UI** (`src/ui`, `src/ui/menu`): HUD, tech tree, system menu and its panels (settings, stats, achievements,
  memory, data), toasts, system log, title screen, credits, the END OF DEMO card and the shared modal stack. The
  overlays sit on top of the canvas inside `#ui-root`.
- **Audio** (`src/audio`): WebAudio synth for sound effects, hum, gear ticks, wind and music. No audio files.
- **Assets** (`src/assets`, `public/assets`): PNG art loaded through a manifest, with procedural fallbacks.
- **Platform** (`src/platform`, `desktop/`): `src/platform/host.ts` is the typed contract of the Electron host bridge
  (`window.wedtmdHost`). Without a host (browser build) saves use `localStorage`; with the host (desktop build) saves
  are files written by the main process. `desktop/` holds the Electron main process (`main.cjs`), the preload script
  (`preload.cjs`) and the edition naming (`edition.cjs`).
- **Edition** (`src/data/edition.ts`): the full game and the demo are one codebase. The Vite mode (`production` or
  `demo`, read in `src/main.ts`) selects `EDITIONS.full` or `EDITIONS.demo`. These set the era cap, the demo-aware
  panels and the lazily loaded END OF DEMO module.

### Data flow

```
input (canvas pointer/wheel, DOM buttons)
  -> GameSession (pure sim: click, update(dt), purchase, reset)
  -> events + immutable snapshots (state, rates, revision)
  -> Phaser renderers (WorldScene, MachineView, HandCrank, camera, background)
  -> DOM UI (HUD, tech tree, system menu, toasts, system log)

SaveController <-> host storage (localStorage['wedtmd.save'] in the browser, file saves in Electron)   (autosave every 15 s, on purchase/milestone, on page hide)
data tables (src/data) -> simulation (costs, effects, prerequisites, milestones)
data tables (src/data) -> renderers (machine component layout, world geometry, palette)
```

Boot order (`src/game/bootstrap.ts`): load the save and start the session (`startSession`: `GameSession` is built and
offline progress is applied once, capped at 8 hours and reported once; the demo clamps a full-game save to its cap and
keeps the original text) -> write the session back -> build the modal stack and UI -> start autosave and the unload
saves -> create the audio controller -> start the Phaser game. Offline gaps longer than 60 s seen during play also go
through the offline path. The 8 hour cap is the baseline (`OFFLINE_CAP_SECONDS`); the extra techs and the perk
that raise it are under Offline progress in How to play.

### Folder map

| Path | Contents |
|---|---|
| `src/data/` | Balance and content tables: technologies, balance constants (`balance.ts`), edition config (`edition.ts`), machine components, world/camera, system logs, notifications, palette, audio, system menu, credits. |
| `src/simulation/` | `GameSession`, state factory, economy (costs), production (rates, tick), progression (status, requirements, purchase, milestones, era, ending), prestige (new cycles), achievements, stats, typed events, `sim/` (greedy balance player used by the sims). |
| `src/persistence/` | Versioned JSON codec and migrations, validation and recovery of corrupt saves, `SaveManager`, `SaveController` (autosave), startup, host storage (`hostStorage.ts`), import and export (`exchange.ts`), compatibility fixtures. |
| `src/platform/` | Typed host bridge contract (`host.ts`) and its tests. |
| `src/game/` | `bootstrap.ts` (composition root), `scenes/` (BootScene, WorldScene, ShowcaseScene), `entities/` (MachineView, HandCrank, MachineAnimator), `rendering/`, `math/` (pure geometry and animation helpers with tests). |
| `src/ui/` | HUD, tech tree (`techTree.ts` + pure `techTreeView.ts`), system log, toasts, title screen, credits, finale, END OF DEMO card, modal stack, guidance, notification rules. |
| `src/ui/menu/` | SYSTEM menu panels: settings, stats, achievements, memory, data, each with a pure view or model module. |
| `src/audio/` | `gameAudio.ts` (controller), `synth.ts` (WebAudio), `audioMath.ts`, `musicMath.ts`. |
| `src/assets/` | Asset ids, manifest, fallback textures, procedural painters, asset guide test. |
| `src/utils/` | Number and rate formatting, signal helper, version line, debug flag. |
| `desktop/` | Electron shell: `main.cjs` (window, file saves, logs), `preload.cjs` (`window.wedtmdHost` bridge), `edition.cjs` (edition naming), app icon files. |
| `scripts/desktop/` | `package.mjs` (Windows packaging with `@electron/packager`, one build per edition), `make_icon.py` (desktop icon from the logo mark). |
| `scripts/perf/` | Bundle budget check, perf median merge and perf tables. |
| `scripts/smoke/` | Browser smokes (Playwright) and `perf-budget.json`. See `scripts/smoke/README.md`. |
| `scripts/art/` | Python pixel-art builders (numpy, Pillow) for era and A17 art and rotation sheets. |
| `public/assets/` | Shipped PNG art (`bg`, `finale`, `fx`, `machine`, `terrain`, `ui`). |
| `docs/` | `GAME_SPEC.md` (requirements), `PROJECT_STATUS.md`, `ASSET_GUIDE.md`, `STEAM_RELEASE.md` (packaging and release checklist), `plan/` (work packages and assignments). |

## Balance

The first session is tuned against greedy-player targets: a player who clicks four times per second and
buys the cheapest available technology each second.

Final simulation results (`src/simulation/balance.sim.test.ts`, deterministic, profile A):

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

The test prints a table of first-reached times per run and asserts the four targets above, plus the era II to V and
energy checks in the same file. If one fails, tune one knob (Reinforced Crank base cost, Piston Array base cost,
Generator Blueprint threshold, or Worn Motor base cost) and update the asserted ranges.

### Sign-off numbers (WP16)

`src/simulation/signoff.sim.test.ts` plays four deterministic paths to Primary Function. The path descriptions are
copied from the test header. Times are minutes:seconds of simulated time. "Active" is play time; the wall clock adds
the offline time of path D.

| Path | Play style |
|---|---|
| A | 4 clicks/s, buys every second |
| B | 4 clicks/s, buys every 30 s |
| C | 1 click/s, buys every 30 s, no offline |
| D | C with a 2 h active / 8 h offline schedule |

Era-end windows (path A):

| Milestone | Tech | Window | Path A |
|---|---|---|---|
| Blueprint | `generatorBlueprint` | 20:00-30:00 | 22:06 |
| Substation | `substationBlueprint` | 55:00-75:00 | 60:23 |
| Vessel | `pressureVesselBlueprint` | 105:00-135:00 | 110:36 |
| Convergence | `harmonicConvergence` | 165:00-205:00 | 166:30 |
| Primary Function | `primaryFunction` | 230:00-290:00 | 249:31 |

Primary Function by path:

| Path | Active | Wall clock | Check |
|---|---|---|---|
| A | 249:31 | 249:31 | 230 to 290 min |
| B | 264:00 | 264:00 | at or before 300 min |
| C | 428:30 | 428:30 | at or before 480 min |
| D | 289:30 | 1249:30 | at or before C (active) and 480 min |

Longest gap between purchases, generatorBlueprint to primaryFunction (active seconds, limit 1200 s): A 308 s,
B 300 s, C 450 s, D 390 s.

Memory cycles (ratio = Primary Function time / cycle 1 of the same profile):

| Run | Primary Function | Ratio | Check |
|---|---|---|---|
| Cycle 2, 3 Echoes, Muscle Memory (A) | 157:57 | 0.633 | at most 0.65 |
| Cycle 2, 3 Echoes, Residual Charge (A) | 150:25 | 0.603 | at most 0.65 |
| Cycle 2, 3 Echoes, Servo Recall (A) | 144:14 | 0.578 | at most 0.65 |
| Cycle 2, 3 Echoes, Ledger (A) | 152:28 | 0.611 | at most 0.65 |
| Cycle 2, 3 Echoes, no perk (A) | 158:08 | 0.634 | reference for cycle 3 |
| Cycle 3, 6 Echoes, Muscle Memory + Residual Charge + Servo Recall (A) | 112:39 | 0.451 | below cycle 2 with no perk |
| Casual cycle 2, 3 Echoes, no perk (C) | 249:00 | 0.581 | at most 0.65 of casual cycle 1 |

Summary: cycle 2 is 0.578 to 0.634 of cycle 1 on path A. Cycle 3 is 0.451 of cycle 1 on path A. Casual cycle 2 is
0.581 of casual cycle 1 (path C). Every run stays finite and below `DESIGN_MAX_VALUE` (`src/data/balance.ts`).

Re-run the sign-off, the balance targets and the demo cap timings:

```bash
npx vitest run src/simulation/signoff.sim.test.ts --silent=false --reporter=verbose
npx vitest run src/simulation/balance.sim.test.ts
npx vitest run src/simulation/demoCap.sim.test.ts
```

`--silent=false` shows the printed tables. `balance.sim.test.ts` has a wall-clock check (era I under 10 s) and uses
Vitest's default 10 s hook timeout, so on a loaded machine it can fail without any change in the numbers. Run it on an
idle machine.

## Performance budgets

Limits come from `scripts/smoke/perf-budget.json`. The bundle limits are checked by `scripts/perf/bundle-budget.mjs`
against the built `dist/`. Sizes are raw, in decimal KB and MB.

| Budget | Limit | Checked by |
|---|---|---|
| App JS (`index-*.js`, raw) | 500 KB | `npm run perf:bundle` |
| Lazy living-world chunk (`LivingWorldDirector-*.js`, raw) | 120 KB | `npm run perf:bundle` |
| Phaser chunk (`phaser-*.js`, raw) | 1500 KB | `npm run perf:bundle` |
| CSS (raw) | 45 KB | `npm run perf:bundle` |
| `public/assets` total | 8000 KB | `npm run perf:bundle` |
| Boot (navigation start to first frame) | 3000 ms | `scripts/smoke/perf.mjs` |
| Heap (era V stage) | 150 MB | `scripts/smoke/perf.mjs` |
| Display objects | 500 | `scripts/smoke/perf.mjs` |
| Live audio voices | 48 | `scripts/smoke/perf.mjs` |
| Frame p95 | 17 ms | `scripts/smoke/perf.mjs` with `PERF_GPU=1`, on a GPU machine |

The App JS gzip size is printed but not gated. The browser perf file also gates machine and UI timings, tech tree open
time and the cycle display share (see its `_notes`). Without `PERF_GPU=1` the frame keys are report-only, and a software
renderer under `PERF_GPU=1` is a fail.

- `npm run perf:bundle`: checks the built `dist/` against the bundle limits. Run `npm run build` first. Exit 1 on a breach.
- `npm run verify`: typecheck, `npm test`, `npm run build`, then the bundle check.
- Browser perf run: see the WP15 perf smoke in [`scripts/smoke/README.md`](scripts/smoke/README.md).

## Assets and audio

Art is generated with PixelLab in a locked palette (see `docs/plan/ART_BRIEF.md`) and placed under
`public/assets/`. Replacement, spritesheet and fallback rules are in [`docs/ASSET_GUIDE.md`](docs/ASSET_GUIDE.md).
`src/assets/assetGuide.test.ts` guards that guide against drift from the manifest.
Audio is synthesized at runtime with Web Audio (`src/audio/synth.ts`); no audio files are shipped.

## Credits and licences

- Game by abdullahamidi.
- Art: pixel art created with PixelLab AI tools and hand-finished by abdullahamidi.
- Sound: all sound and music synthesized live with Web Audio.
- Built with Phaser 3 (MIT License, Phaser Studio Inc.), Electron and Chromium (desktop build), TypeScript and Vite.

The CREDITS screen in the SYSTEM menu shows the credit sections from `src/data/credits.ts`. The full third-party
texts are in [`THIRD_PARTY_NOTICES.txt`](THIRD_PARTY_NOTICES.txt): Phaser 3.90.0 and Electron 44.7.0 licence texts.
Chromium licences are in `LICENSES.chromium.html` next to the desktop executable.

## Development workflow

Work is split across a planning and implementation hierarchy of Claude agents. Agent roles and the iteration
loop are described in [`CLAUDE.md`](CLAUDE.md); work packages and their assignments are in `docs/plan/`.
Project progress is tracked in [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

## Known limitations

- No Steamworks SDK, overlay or Steam achievements integration yet. Achievements are in-game only.
- No native gamepad support. Keyboard and mouse only.
- No Linux or macOS depot. Windows build only; Steam Deck runs it through Proton.
- Render-scale crispness at 1080p is a later polish item.

Release history: [`CHANGELOG.md`](CHANGELOG.md).
