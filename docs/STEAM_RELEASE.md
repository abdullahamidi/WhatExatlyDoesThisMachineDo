# Steam release guide

Single source of truth for building, packaging and shipping the Windows Steam build (Electron desktop shell).
Version 0.9.0. The browser build (`npm run build`, `npm run preview`) is unchanged and still runs without the host.

Code: `desktop/` (shell), `scripts/desktop/` (packager, icon), `src/platform/` (host bridge).
Program decisions: `docs/plan/STEAM_DEMO_PROGRAM.md` (D4 editions, D5 shell).

## 1 Builds and editions

| Command | Vite mode | Edition | Output |
|---|---|---|---|
| `npm run verify` | default | none | typecheck + test + build (browser `dist/`) |
| `npm run desktop:dev` | default | none | builds `dist/`, then runs Electron on `desktop/` |
| `npm run build:steam` | `production` | `full` | `out/steam/full/win-x64/` |
| `npm run build:steam-demo` | `demo` | `demo` | `out/steam/demo/win-x64/` |
| `npm run icon:desktop` | none | none | `desktop/icon.png`, `desktop/icon.ico` |

`build:steam` / `build:steam-demo` steps:

1. `npm run typecheck` (`tsc --noEmit`).
2. `vite build --mode <mode>` into `build/vite-<edition>/` (`dist/` is never touched).
3. `scripts/desktop/package.mjs` stages the app and packages Windows x64 with `@electron/packager`.
4. Fuses flipped with `@electron/fuses` (section 3).
5. Result folder = SteamPipe ContentRoot (section 4).

- Demo edition: era cap, end card and its own save folder and Steam app. See section 14.
- `out/`, `build/` and `dist/` are gitignored. Do not commit them.

## 2 Prerequisites

| Item | Requirement |
|---|---|
| Build host | Windows 10/11 x64 |
| Node.js | 22.12 or newer (repo uses Node 24) |
| npm | 11 (gates install scripts) |
| Electron | 44.7.0, pinned exact (devDependency) |
| Packager, fuses | `@electron/packager` 20.3.0, `@electron/fuses` 2.1.3, pinned exact |
| Python | Python 3 + Pillow, only for `npm run icon:desktop` |
| steamcmd | Only for uploads (section 4) |
| Playwright | Global install, only for smoke scripts. Not needed to build |

After `npm install`, download the Electron binary (npm 11 blocks install scripts):

```bash
npm install
node node_modules/electron/install.js
```

Or: `npm approve-scripts electron`.

## 3 Security posture

- Custom privileged scheme `app://wedtmd` serves `dist/` with a path guard and a MIME map. Start URL:
  `app://wedtmd/index.html`.
- Content-Security-Policy header on every response: `script-src 'self'`, no inline scripts. The boot mark is the
  external classic script `public/boot.js`.
- `contextIsolation` ON, `sandbox` ON, `nodeIntegration` OFF.
- Preload exposes only `window.wedtmdHost`.
- IPC handlers check the sender frame URL.
- DevTools and F12 only when unpackaged. Reload and zoom keys blocked when packaged.
- `window.open` and navigation denied.
- `shell.openExternal` allowlist: `https://store.steampowered.com/` and `steam://`.
- Permissions: `fullscreen` and `clipboard-sanitized-write` only. Everything else denied.
- Debug hook: `WEDTMD_DEBUG=1` (section 7).

Fuses (`@electron/fuses`):

| Fuse | Value |
|---|---|
| RunAsNode | OFF |
| EnableNodeOptionsEnvironmentVariable | OFF |
| EnableNodeCliInspectArguments | OFF |
| EnableEmbeddedAsarIntegrityValidation | ON |
| OnlyLoadAppFromAsar | ON |

- The desktop smoke attaches over CDP via `--remote-debugging-port`, because the inspect fuse is OFF.
- If the asar-integrity fuse had to be turned off, it is recorded under Known limitations (section 13).

## 4 SteamPipe

ContentRoot `out/steam/<edition>/win-x64/` contains:

- `WhatExactlyDoesThisMachineDo.exe`
- `resources/app.asar`
- `THIRD_PARTY_NOTICES.txt`
- `LICENSES.chromium.html`

VDF files are docs only for now. They are not committed yet and `steam/` does not exist in the repo. When they are
added, they live in `steam/`, and the paths below are relative to that folder.

`steam/app_build_0000000.vdf`:

```
"appbuild"
{
  "appid" "0000000"
  "desc" "WEDTMD full v0.9.0"
  "buildoutput" "..\build\steam-output\"
  "contentroot" "..\out\steam\full\win-x64\"
  "setlive" ""
  "preview" "0"
  "depots"
  {
    "0000001" "depot_build_0000001.vdf"
  }
}
```

`steam/depot_build_0000001.vdf`:

```
"DepotBuildConfig"
{
  "DepotID" "0000001"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
  "FileExclusion" "*.pdb"
}
```

- Placeholders: `0000000` = Steam app id, `0000001` = full depot id. Replace both with the real ids.
- Demo edition (second pair, separate files): app `0000002`, depot `0000003`, `contentroot`
  `..\out\steam\demo\win-x64\`, `DepotID` `0000003`. Suggested names: `app_build_0000002.vdf`,
  `depot_build_0000003.vdf`.

Upload:

```bash
steamcmd +login <builder> +run_app_build "<absolute path>\app_build_0000000.vdf" +quit
```

Beta-branch flow:

1. `npm run build:steam`.
2. Set `"setlive" "beta"` in the app build VDF. `beta` is a branch name that must exist in Steamworks.
3. Upload with the steamcmd command above.
4. Install from the beta branch in the Steam client and test (section 12).
5. Promote to default in the Steamworks UI.
6. Keep `"setlive" ""` for uploads that must not go live.

## 5 Launch option

| Field | Value |
|---|---|
| Executable | `WhatExactlyDoesThisMachineDo.exe` |
| Operating system | Windows |
| Architecture | 64-bit |
| Arguments | none |

## 6 Steam Auto-Cloud

Steamworks > Application > Cloud:

| Field | Value |
|---|---|
| Root | `WinAppDataRoaming` |
| Subdirectory | `WhatExactlyDoesThisMachineDo/saves` |
| Pattern | `*.json` |
| OS | Windows |
| Byte quota | 1 MB |
| File count | 10 |

- `.bak` and `.tmp` files are not synced (the pattern matches `*.json` only).
- `window.json` and `logs/` are outside `saves/`. Not synced.
- `saves/` can also hold `wedtmd.save.corrupt.json` and `wedtmd.save.preimport.json`. They match `*.json` and
  count toward the quota.
- Native Linux build (later): root override `LinuxXdgConfigHome`, same subdirectory.
- Proton: uses the prefix's Roaming folder (`compatdata/<appid>/pfx/drive_c/users/steamuser/AppData/Roaming/`).
- Demo edition has its own Auto-Cloud subdirectory and never shares saves with the full game (section 14).

## 7 Save and log locations

Environment variables:

| Variable | Effect |
|---|---|
| `WEDTMD_USER_DATA` | Absolute path. Overrides the user-data folder. Used by smokes. |
| `WEDTMD_DEBUG=1` | Loads `?debug=1`. Unpackaged dev run only. Ignored in the packaged exe. |
| `SteamDeck=1` | First launch starts fullscreen when no `window.json` exists (section 11). |

User-data folder:

| Build | Folder |
|---|---|
| Packaged | `%APPDATA%/WhatExactlyDoesThisMachineDo/` |
| Unpackaged (dev run) | `%APPDATA%/WhatExactlyDoesThisMachineDo-dev/` |
| Packaged demo | `%APPDATA%/WhatExactlyDoesThisMachineDo Demo/` |
| Unpackaged demo (dev run) | `%APPDATA%/WhatExactlyDoesThisMachineDo Demo-dev/` |

Contents (under the user-data folder):

| Path | Content |
|---|---|
| `saves/wedtmd.save.json` | Main save (key `wedtmd.save`, save format v2) |
| `saves/wedtmd.save.json.bak` | Previous generation |
| `saves/<key>.json.tmp` | Transient write. Not synced |
| `window.json` | Page (content) size, position, maximized, fullscreen |
| `logs/renderer.log` | Renderer log |
| `logs/main.log` | Main-process log |

- Logs rotate at 1 MB to `.1`.
- Browser build keeps using `localStorage`. The first host launch imports an existing `localStorage` save once.

## 8 AI content disclosure (draft)

Draft answers for the Steam AI questionnaire. Review before submit.

- Art: pre-generated with PixelLab AI tools, then edited and curated by the developer.
- Live generation: nothing is generated while playing.
- Audio: procedural synthesis (Web Audio). No AI audio.
- Text: no AI-generated text is produced at runtime.
- Open: verify PixelLab's current terms for commercial use and the required subscription tier before release.

## 9 Steam Input template

Skeleton only, not yet configured. Configure in the Steam Input configurator, export the VDF, commit it under
`steam/input/`.

| Controller input | Keyboard / mouse | Use |
|---|---|---|
| A | Space | Crank |
| Y | T | Tech tree |
| Start | Esc | Menu / close |
| B | Esc | Menu / close |
| Right trackpad | Mouse | Pointer |
| R2 | Left mouse click | Click |
| D-pad | Tab / Shift+Tab / Enter | UI navigation |

Native gamepad support is not implemented (section 13).

## 10 Store asset checklist

| Asset | Size (px) | Notes |
|---|---|---|
| Header capsule | 920 x 430 | |
| Small capsule | 462 x 174 | |
| Main capsule | 1232 x 706 | |
| Vertical capsule | 748 x 896 | |
| Library capsule | 600 x 900 | |
| Library hero | 3840 x 1240 | |
| Library logo | 1280 x 720 | Transparent PNG |
| Screenshots | 1920 x 1080 min, 16:9 | scripts/smoke/store-shots.mjs: SIZE 1080 = 1920x1080, SIZE 2160 = 3840x2160 (1920x1080 viewport at device scale 2); store order in <outdir>/store-top5.json |
| Trailer | 1080p60 | Record with OBS from the packaged build (no ffmpeg on the build machine) |

- Verify sizes against the current Steamworks documentation before upload.

### Screenshot set (v0.9.0)

Use the 3840 x 2160 files (SIZE 2160 output). The order is written to `<outdir>/store-top5.json`.

Store and alt shots are taken with the in-world name plate and the HUD plaque capped at `RES?OR?` (debug hook `setPlateCap('substationBlueprint')`, rendering only; the same cap as the demo teaser). `scripts/smoke/store-shots.mjs` checks each of them for spoiler text (`<size>_<stem>_<variant>_no_spoiler`). Press-kit shots are not capped.

| Rank | File | Use |
|---|---|---|
| 1 | `07-era5-ruined-clean` | Era V, ruined plain, HUD hidden |
| 2 | `06-era4-spire-hud` | Era IV, spire, four-resource HUD |
| 3 | `03-era2-generator-hud` | Era II, generator, wide machine |
| 4 | `05-tree-era3-hud` | TECH INDEX, era III |
| 5 | `09-postgame-portrait-clean` | Restored world (mild spoiler) |
| alt | `04-era3-boiler-hud` | No-reveal alternative to rank 5 |

Never upload:

- `08-finale-reveal-hud` (spoiler)
- `08-finale-reveal-clean` (spoiler: finale reveal)
- `09-postgame-portrait-hud` (spoiler)
- `08b-finale-typed-hud` (spoiler: full reveal text)
- `10-title-hud` (title screen is not gameplay; Steam wants gameplay)

### Capsule art

From `public/assets/ui/logo.png` (230 x 50 px). Scale by a whole number with nearest-neighbour only. Example:

- x4 = 920 x 200, placed on a clean 3840 x 2160 screenshot for the 920 x 430 header capsule.
- x5 = 1150 x 250, on a transparent canvas, for the 1280 x 720 library logo.

## 11 Deck / Proton / Linux notes

- Steam Deck runs the Windows build through Proton.
- Deck panel 1280 x 800: `#ui-root` anchors to the canvas. Letterbox is themed.
- `SteamDeck=1`: first launch starts fullscreen when no `window.json` exists.
- FPS cap: 60 fps target, 78 fps limit.
  - 60 Hz and 120 Hz panels run 60 fps.
  - 90 Hz Deck OLED runs an even 45 fps.
- No native Linux depot yet. Linux Auto-Cloud root is in section 6.

## 12 Release checklist

Before step 1: bump the version together in `package.json`, `desktop/package.json` and the VDF `desc`.

1. [ ] `npm run verify` (typecheck + test + build) passes.
2. [ ] `npm run build:steam` passes. `out/steam/full/win-x64/` has the section 4 contents.
       (Demo edition: `npm run build:steam-demo`, `out/steam/demo/win-x64/`.)
3. [ ] Desktop smoke `scripts/smoke/desktop.mjs` passes.
4. [ ] steamcmd upload to a beta branch (`"setlive" "beta"`).
5. [ ] Install and test from the Steam client on the beta branch. Check Auto-Cloud round trip, Deck run and
       progress kept after quit and relaunch.
6. [ ] Set the build live (promote beta to default in the Steamworks UI).

## 13 Known limitations

- No Steamworks SDK, no overlay, no achievements.
- No native gamepad support. Steam Input keyboard template only (section 9).
- No Linux or macOS depot.
- Disk-write errors are not shown in SAVE STATE feedback.
- Platform scope: `docs/GAME_SPEC.md` says "Desktop browser". The Steam build is a desktop app. The browser build
  remains.
- Render-scale crispness at 1080p (Scale.EXPAND) is a later display-quality package. Not demo-blocking.
- Asar-integrity fuse: only if it had to be turned off. Record the reason and fallback here.
- A save file that exists but stays unreadable (for example an antivirus lock) is not overwritten during that session; the cause is logged in logs/main.log.
- Window default is a 1280x720 PAGE area; on displays about 768 px high the window frame can reach below the work area.

## 14 Demo edition

The demo is a separate Steam app with its own depot, save folder, window title and app user model id. It never
shares a depot or a save folder with the full game. Names live in `desktop/edition.cjs`, caps and links in
`src/data/edition.ts`, end-flow copy and timings in `src/data/demo.ts`.

| Item | Full game | Demo |
|---|---|---|
| Steam app | `0000000` | `0000002` (placeholder, section 4) |
| Depot | `0000001` | `0000003` (placeholder, section 4) |
| Vite output | `build/vite-full/` | `build/vite-demo/` |
| SteamPipe ContentRoot | `out/steam/full/win-x64/` | `out/steam/demo/win-x64/` |
| Window title | `What Exactly Does This Machine Do?` | `What Exactly Does This Machine Do? Demo` |
| App user model id | `com.abdullahamidi.wedtmd` | `com.abdullahamidi.wedtmd.demo` |
| Save folder (packaged) | `%APPDATA%/WhatExactlyDoesThisMachineDo/saves` | `%APPDATA%/WhatExactlyDoesThisMachineDo Demo/saves` |
| Launch option | section 5 | section 5, set on the demo app |

Demo VDF pair (docs only, same rules as section 4, paths relative to `steam/`):

`steam/app_build_0000002.vdf`:

```
"appbuild"
{
  "appid" "0000002"
  "desc" "WEDTMD demo v0.9.0"
  "buildoutput" "..\build\steam-output\"
  "contentroot" "..\out\steam\demo\win-x64\"
  "setlive" ""
  "preview" "0"
  "depots"
  {
    "0000003" "depot_build_0000003.vdf"
  }
}
```

`steam/depot_build_0000003.vdf`:

```
"DepotBuildConfig"
{
  "DepotID" "0000003"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
  "FileExclusion" "*.pdb"
}
```

Upload: `steamcmd +login <builder> +run_app_build "<absolute path>\app_build_0000002.vdf" +quit`.

Demo Auto-Cloud (Steamworks > Application > Cloud on the demo app):

| Field | Value |
|---|---|
| Root | `WinAppDataRoaming` |
| Subdirectory | `WhatExactlyDoesThisMachineDo Demo/saves` |
| Pattern | `*.json` |
| OS | Windows |
| Byte quota | 1 MB |
| File count | 10 |

Wishlist target:

- Both shells point at the FULL game page, Steam app `0000000` (placeholder).
- Desktop opens `steam://store/0000000` through the Steam client. Web opens `https://store.steampowered.com/app/0000000/`.
- To change the id: edit `STEAM_STORE` in `src/data/edition.ts` (`appId`, `storeUrl`, `steamUrl`). The `EXTERNAL_ALLOW`
  prefixes in `desktop/main.cjs` (`https://store.steampowered.com/`, `steam://`) must still cover the new URLs.

Era cap:

- The demo stops at era II, Substation Blueprint (`capTech` and `maxEra` in `src/data/edition.ts`).
- Eras III to V stay locked. Their tech tree tabs read FULL GAME and are disabled.

End flow:

1. Substation Blueprint milestone.
2. Wait 4 s (`DEMO_END.triggerDelayMs`).
3. Final-machine teaser (about 9.5 s).
4. END OF DEMO card. Buttons: WISHLIST ON STEAM, KEEP TINKERING, REPLAY TEASER, QUIT (desktop only). Esc = KEEP TINKERING.
5. SYSTEM menu row DEMO ENDING re-opens the card.

Saves:

- No automatic carry-over between demo and full. To move progress, use SYSTEM > DATA: export in one build, import
  in the other.
- When a demo boot had to clamp a save (progress beyond the cap), the original text is kept under the storage key
  `wedtmd.save.fullgame` (file `saves/wedtmd.save.fullgame.json`).

Web demo:

- `npm run build:demo` writes `dist-demo/`. Host it as a separate site or origin. Browser saves are per origin, so
  the demo and full web builds never mix saves.

Demo verification checklist:

1. [ ] `npm run build:demo`, then `npx vite preview --outDir dist-demo --port 4176 --strictPort` (keep running).
       `node scripts/smoke/demo.mjs http://localhost:4176/ <outdir>` (needs `PW_PATH`). Stop the preview afterwards.
2. [ ] `npm run build:steam-demo`. `out/steam/demo/win-x64/` has the section 4 contents.
3. [ ] `DESKTOP_EDITION=demo PW_PATH=<playwright dir> node scripts/smoke/desktop.mjs out/steam/demo/win-x64/WhatExactlyDoesThisMachineDo.exe <outdir>`.

## 15 Release checklist (v0.9.0 demo)

Evidence per program decision D8 (docs/plan/STEAM_DEMO_PROGRAM.md). Upload steps stay in section 12. Status: PASS = verified with the evidence named; PENDING = still to run in the final release pass.

| # | D8 item | Evidence | Status |
|---|---|---|---|
| 1 | Pure full-run e2e | `src/simulation/fullRun.e2e.test.ts` (paths K and N, codec round trip, cycle 2) | PASS |
| 2 | Save compat matrix (incl. pre-legacy save) | `src/persistence/compat.test.ts` + `src/persistence/fixtures/` (10 rows) | PASS |
| 3 | Balance sign-off | `src/simulation/signoff.sim.test.ts` (A 22:06 / 60:23 / 110:36 / 166:30 / 249:31; B 264:00; C 428:30; D 289:30 active) | PASS |
| 4 | Demo cap timings | `src/simulation/demoCap.sim.test.ts` (A 60:23, B 72:52, N 98:29, C 148:28) | PASS |
| 5 | Browser e2e, full | `scripts/smoke/e2e-full.mjs` | PASS (WP16b-3 validation) |
| 6 | Browser e2e, demo | `scripts/smoke/demo.mjs` + `demo-cases.mjs` on `dist-demo` | PASS (WP16b-3 validation) |
| 7 | Accessibility | `scripts/smoke/a11y.mjs` (`fail []`, `deferred []`), `scripts/smoke/ux.mjs` (incl. case M) | PASS (WP16b-3 validation) |
| 8 | Resolutions 1280x720, 1280x800, 1920x1080, 2560x1440, 3440x1440 | `scripts/smoke/resolutions.mjs` | PASS (WP16b-3 validation) |
| 9 | Soak 30–60 min | `scripts/smoke/soak.mjs` `SOAK_MIN=30..60` (WP16a 5 min run: PASS, heap 92.5 MB) | PENDING WP16b-3 (Director: soak 60 min running) |
| 10 | Quiet-machine GPU perf (frame p95 ≤ 17 ms) | `PERF_GPU=1 scripts/smoke/perf.mjs`, median of 3 (`scripts/perf/perf-median.mjs`): frame p95 16.8 ms, post-purchase p95 16.7 ms (RTX 3060 Ti, D3D11); see below | PASS (WP16b-3) |
| 11 | Final Art Director audit (incl. 1080p, Deck 1280x800) | `docs/plan/ART_AUDIT.md` "WP16b-3 — final release audit" (1920x1080, 2560x1440, 3440x1440, 1280x800 UI 100/150, 1280x720 UI 100/150; full + demo) | PASS (WP16b-3) |
| 12 | ASSET_GUIDE refresh + guard | `src/assets/assetGuide.test.ts`, `docs/ASSET_GUIDE.md` | PASS |
| 13 | Docs | `README.md`, `CHANGELOG.md`, this file section 10/15, `docs/GAME_SPEC.md` section 18.1, `scripts/smoke/README.md` | PASS (WP16b-3) |
| 14 | Store screenshots (3840x2160, HUD-free) | `scripts/smoke/store-shots.mjs` + `store-top5.json` (plate cap `RES?OR?`, `no_spoiler` checks) | PASS (WP16b-3 final set) |
| 15 | Bundle budget, full + demo | `node scripts/perf/bundle-budget.mjs` and `… dist-demo` | PASS (WP16b-3 validation) |

### Row 10 evidence (quiet-machine GPU perf, 2026-10-24)
- Run: main 3219580, quiet machine, `PERF_GPU=1`, median of 3 per half, 6 runs (`scripts/perf/perf-median.mjs`).
- renderer ANGLE NVIDIA GeForce RTX 3060 Ti D3D11, gpu true, fail []
- frameP95Ms 16.8 (budget 17)
- postFrameP95Ms 16.7 (budget 17)
- machineMeanMs 0.91 (budget 4)
- machineMaxMs 1.6 (budget 40)
- uiMeanMs 0.04
- uiMaxMs 0.2
- finaleMeanMs 0.05
- displayObjects 76 (budget 500)
- techTreeOpenMs 1.7
- heapMb 97.4 (budget 150)
- heapGrowthMb 0
- bootMs 777.6 (budget 3000)
- liveVoices 7
- musicVoices 5
- peakDbfs -17.18
- cycleDisplayPct 4.29
- Every stage frame p50/p95 16.7 / 16.7–16.8 ms (vsync 60 Hz).
