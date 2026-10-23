# WP19 - Worker Assignments (Engineering Manager, Mode A)

Source: WP19 plan (D1-D17, C1-C10, T1-T14) + repo read at HEAD `5636a42` in worktree `C:/Users/sanan/wedtmd-shell` (branch `claude/steam-shell`).
Goal: fused, packaged Windows Electron app (SteamPipe ContentRoot) + file saves, title screen, QUIT/CREDITS, crash overlay, splash, fullscreen, canvas-anchored UI. Web build keeps working without the host. Save stays v2. Test count never below 2274.
NEVER touch `C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo` (WP17 runs there).

## EM decisions / deviations from the plan (these WIN for workers)
1. **T1 split** into T1a (install, package.json, desktop/package.json, preload.cjs, icons) and T1b (`desktop/main.cjs` + probe). main.cjs is ~400 lines of Electron glue: too big to share a pass with the install and icons.
2. **dist is shared and a concurrent `vite build` corrupts it.** Only one task per wave may build or run browser smokes: W1 T4 (`npx vite build`, not `npm run build`), W2 T6 (`npx vite build`), W4 T13, W5 T10, W6 T14. All other workers: typecheck + their own vitest files only.
3. **T1b probe stages from a copy of the old dist** (`$SD/dist-baseline`, copied by T1a as its very first action). No build needed, no race. The packaged-like layout (`<app>/main.cjs` + `<app>/dist`) exercises the DIST_DIR staged branch.
4. **Wave order changed** (dependencies + the dist race): W1 T1a T2 T3 T4 · W2 T1b T5 T6 T7 · W3 T8 T9 T11 T12 · W4 T13 · W5 T10 · W6 T14. T10 moved after T13 because `build:steam` rebuilds dist and typechecks the integrated tree.
5. **Crash saver** returns `ok && flushed` (`saveNow()` result AND `picked.flush()` result) instead of `ok` alone: the overlay must not claim "saved" when the file write failed. Everything else in C7 is unchanged.
6. **T5 manual crash check** is dropped from T5 (no build allowed in W2 for T5) and is covered by `shell.mjs` `G_crash` in T13.
7. `getHost` default scope: `globalThis as unknown as { wedtmdHost?: unknown }` (a plain cast trips TS weak-type checks).
8. main.cjs crash dialog path text is built with `path.join('%APPDATA%', USER_DIR, 'saves')` so no backslash literals are needed.
9. `package.mjs` gets an extra optional flag `--no-asar-integrity` used only for the D17 fallback (documented in the script header and STEAM_RELEASE.md).
10. `fullscreen.ts` Alt+Enter handler also calls `stopPropagation()` and only acts when fullscreen is `supported()` (web only).
11. W1 only: T4 turns overlays `absolute` while `index.html` and `bootstrap.ts` are still old (root is `fixed; inset:0`, `root.style.zoom` still set by bootstrap). wp12 steps after UI scale 125 may clip in this wave only; T4 reports, never fixes (T6/T13 land the real anchoring).
12. Re-read each file right before editing; small unique-anchor Edits.

## Waves
| Wave | Tasks | Dist owner | Notes |
|---|---|---|---|
| 1 | **T1a** toolchain+preload+icons, **T2** host+hostStorage, **T3** shell data+helpers, **T4** display+viewport+CSS | T4 | T1a copies dist first |
| 2 | **T1b** main.cjs+probe, **T5** crash+storage warning+main.ts, **T6** splash+index.html, **T7** title+credits | T6 | T6 may skip preview checks if a foreign file blocks the build (shell.mjs A_nohook covers it) |
| 3 | **T8** system menu rows, **T9** fullscreen+settings row, **T11** smoke scripts, **T12** docs | none | T11 writes scripts only; run acceptance after T13 |
| 4 | **T13** bootstrap integration + all smokes | T13 | single owner of bootstrap.ts |
| 5 | **T10** packaging script + fuses + notices | T10 | needs T1b + T13 |
| 6 | **T14** desktop smoke on packaged exe | T14 | needs T10, T11, T13 |

Then: implementation reviewer, EM Mode B, Art Director on title/splash/credits/letterbox screenshots (CSS fixes via EM).

### Transient tsc errors
| After | Allowed |
|---|---|
| W1 | none (new files + package.json; nothing is wired) |
| W2 | none (T5 main.ts imports only T2/T3/T5 files; T6 BootScene imports T3/T6 files; T7 imports T3 + existing systemMenuModel) |
| W3 | none (T8 and T9 are independent) |
| W4 | none after T13 |
Inside a wave a worker may see tsc errors from another worker's half-written file; ignore, list in NOTES.

## File ownership (no overlaps inside a wave)
| Task | Files |
|---|---|
| T1a | package.json, package-lock.json, .gitignore, desktop/package.json, desktop/preload.cjs, desktop/icon.png, desktop/icon.ico, scripts/desktop/make_icon.py |
| T1b | desktop/main.cjs |
| T2 | src/platform/host.ts(+test), src/persistence/hostStorage.ts(+test), src/data/storage.ts |
| T3 | src/data/{version,title,credits,shell}.ts, version.test.ts, credits.test.ts, src/utils/{debugFlag,versionLine}.ts(+tests) |
| T4 | src/data/display.ts(+test), src/ui/viewportMath.ts(+test), src/ui/viewportSync.ts, techTree.css, systemMenu.css, finale.css, cycleConfirm.css, toasts.css |
| T5 | src/ui/crashModel.ts(+test), crashOverlay.ts/.css, storageWarning.ts/.css, src/main.ts |
| T6 | index.html, public/boot.js, src/ui/splash.ts(+test), src/game/scenes/BootScene.ts |
| T7 | src/ui/titleModel.ts(+test), titleScreen.ts/.css, credits.ts/.css |
| T8 | src/ui/systemMenu.ts, systemMenu.css, systemMenuModel.ts(+test), src/data/systemMenu.ts |
| T9 | src/ui/fullscreen.ts, src/ui/menu/settingsPanel.ts/.css, settingsView.ts(+test) |
| T10 | scripts/desktop/package.mjs, THIRD_PARTY_NOTICES.txt |
| T11 | scripts/smoke/{README.md,shell.mjs,resolutions.mjs}, delete ftalpha.mjs |
| T12 | docs/STEAM_RELEASE.md, README.md (commands section only) |
| T13 | src/game/bootstrap.ts, src/game/debugHook.ts (header comment only), src/data/packageVersion.test.ts |
| T14 | scripts/smoke/desktop.mjs, scripts/smoke/README.md (desktop section only) |
Shared sequentially: `systemMenu.css` (T4 W1 -> T8 W3), `scripts/smoke/README.md` (T11 W3 -> T14 W6), `README.md` (T12 only).
Never edited by WP19: hud.ts/hudView.ts/hud.css, technologies.ts, types.ts, notifications.ts, world.ts, machineComponents.ts, src/simulation/**, src/game/entities/**, src/game/rendering/**, src/assets/**, scripts/smoke/stages.mjs, src/audio/**, audio.ts, music.ts, balance.ts, settings.ts, toasts.ts, WorldScene.ts.

## Task summaries (full self-contained prompts are in the worker prompt list)
- **T1a**: exact-pinned electron 44.7.0 / @electron/packager 20.3.0 / @electron/fuses 2.1.3; package.json version 0.9.0 + 5 scripts; ignores `out/` `build/`; desktop/package.json; preload.cjs verbatim; Pillow NEAREST icons (png 256, ico 6 frames). Accept: `npx electron --version` = v44.7.0; icon check pixel-exact.
- **T1b**: main.cjs per C2 (app:// scheme + CSP + path guard, IPC, atomic saves + .bak, window state, hooks, logs). Accept: scratch CDP probe passes every check (storage, .bak, traversal, CSP header, window.open null, renderer.log, window.json).
- **T2**: `host.ts` (C1), `hostStorage.ts` + `storage.ts` (C3), tests with fake bridge + fake timers.
- **T3**: version/title/credits/shell data (verbatim), `debugEnabled`/`urlFlag` table, `versionLine`/`versionAriaLabel`.
- **T4**: `display.ts` (FRAME_RATE limit 78), `uiZoom`/`rootBox`/`cssPx` tables, frame-cap accumulator test, `viewportSync`, five CSS conversions. Accept: wp3 + wp12 smokes at 1280x720.
- **T5**: `crashModel` + tests, crash overlay (body-level, first error only, saver registry), `#storage-warning` banner, `main.ts` final shape (no performance.mark).
- **T6**: `index.html` (favicon, boot.js, contain:layout, letterbox gradient, splash), `public/boot.js`, `splash.ts` (+`splashWidth` tests), BootScene progress.
- **T7**: `titleModel` (+tables), `titleScreen`, `credits` DOM + CSS; stack ids `title`, `title-confirm`, `credits`.
- **T8**: `open(tabId?)`, `#sys-credits`, `#sys-quit`, `#sys-footer`, `tabIndexFor`, `shellRows`, MENU_TEXT additions.
- **T9**: `createFullscreen`, SETTINGS fullscreen row, `fullscreenRow`, 4th hotkey help line.
- **T10**: `package.mjs` (stage -> packager -> copy -> fuses -> JSON line), `THIRD_PARTY_NOTICES.txt`. Accept: exe boots over CDP; asar listing; fuse wire; demo build once.
- **T11**: `shell.mjs` keys A-G, `resolutions.mjs` matrix, README rewrite (`?debug=1`, Windows outdirs).
- **T12**: `docs/STEAM_RELEASE.md` 13 sections + README commands.
- **T13**: C7 bootstrap in order, `packageVersion.test.ts`, `npm run verify`, all smokes.
- **T14**: `desktop.mjs` keys 1-7 over CDP, release build, sizes + fuse wire report.

## Package validation (EM Mode B) - run from the worktree
```bash
R="C:/Users/sanan/wedtmd-shell"; cd "$R"
npm run verify
npx electron --version
npm run build:steam && du -sh "$R/out/steam/full/win-x64"
npm run build   # refresh preview dist (production)
for s in wp2-crank wp3-techtree wp12-menus wp4-persistence finale prestige; do PW_PATH=... node scripts/smoke/$s.mjs "http://localhost:4174/?debug=1" "$SD/$s"; done
ONLY=s0_crank,s9_era2_full,s15_era5_full node scripts/smoke/stages.mjs "http://localhost:4174/?debug=1" "$SD/stages"
node scripts/smoke/shell.mjs "http://localhost:4174/" "$SD/shell"
node scripts/smoke/resolutions.mjs "http://localhost:4174/?debug=1" "$SD/res"
node scripts/smoke/desktop.mjs "$R/out/steam/full/win-x64/WhatExactlyDoesThisMachineDo.exe" "$SD/desktop"
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/platform   # empty
git diff --name-only 5636a42 -- <WP17 no-touch list>                                      # empty
git status --short --ignored out build                                                    # only '!!' lines
```
Pass: every smoke JSON `errors: []` and `fail: []` where present; tests >= 2274 + new; app chunk raw size reported (report only).

## Merge-risk note for the Director (shared with track A)
`src/game/bootstrap.ts`, `src/ui/techTree.css`, `src/ui/toasts.css`, `src/ui/systemMenu.ts`, `index.html`.
