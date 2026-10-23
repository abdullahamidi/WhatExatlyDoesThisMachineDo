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
2. `vite build --mode <mode>` into `dist/`.
3. `scripts/desktop/package.mjs` stages the app and packages Windows x64 with `@electron/packager`.
4. Fuses flipped with `@electron/fuses` (section 3).
5. Result folder = SteamPipe ContentRoot (section 4).

- Demo edition: the folder and edition name are the only difference for now. Demo gating (era cap, end card)
  arrives in a later package.
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
- Open decision: whether demo and full share saves (later package).

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
| Screenshots | 1920 x 1080 min, 16:9 | Plan: 1280 x 720 at device scale 3 = 3840 x 2160 via Playwright |
| Trailer | 1080p60 | Record with OBS from the packaged build (no ffmpeg on the build machine) |

- Verify sizes against the current Steamworks documentation before upload.

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
