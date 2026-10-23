# Browser smoke tests (Playwright, not part of `npm test`)

Uses the global Playwright install with its local Chromium. Smokes are plain Node `.mjs` scripts: they import only
Playwright (through `PW_PATH`) and Node built-ins.

## Setup

- Playwright: `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright` (replace `<you>` with your user name).
- Preview: `<preview>` means the preview server URL. On this track it is `http://localhost:4174`. Start it once with
  `npm run build`, then `npx vite preview --port 4174 --strictPort`. Smokes never start a server.
- The preview is a PRODUCTION build. The debug hook `window.__wedtmd` exists only with `?debug=1`. Without it the
  page has no hook (the shell smoke checks this).
- `?debug=1` also skips the title screen. Add `&title=1` to show it: `"<preview>/?debug=1&title=1"`.
- `shell.mjs` takes the base URL WITHOUT a query (it builds its own query per case). Every other example uses
  `"<preview>/?debug=1"`.
- Outdirs: absolute Windows paths, e.g. `C:/Users/<you>/AppData/Local/Temp/smoke/...`. The shell and resolutions
  smokes create their outdir.
- Output: each script prints ONE JSON object to stdout. Shell and resolutions print `{ results, fail, errors }`.
  `fail` lists the check names that did not hold (expect `[]`). `errors` collects console errors, page errors and failed
  requests (expect `[]`). Exit code is 1 when either is non-empty. An exception adds `FAILED:<case>:<message>` to `fail`.

## Shell smoke (WP19): `shell.mjs`

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/shell.mjs "<preview>/" C:/Users/<you>/AppData/Local/Temp/smoke/shell
```

Base URL without query (the script adds `?debug=1`, `?debug=1&title=1`, etc.). Fresh 1280x720 context per case, except
C and D, which share one context. Screenshots in the outdir: `shell-A-title.png`, `shell-C-credits.png`,
`shell-E-menu.png`, `shell-G-crash.png`.

| case | URL | checks (names in `results` / `fail`) |
|---|---|---|
| `A_nohook` | base | waits for `wedtmd:first-frame` + 600 ms: `A_no_hook` (no `window.__wedtmd`), `A_title_open` (`#title-screen.is-open`), `A_splash_gone` (`#splash` removed), `A_boot_mark_before_first_frame` (`wedtmd:boot` startTime < first-frame), `A_title_version` (`#title-version` = `v0.9.0 · SAVE v2`), `A_continue_hidden` (fresh profile), `A_escape_closes_title` |
| `B_debug` | `?debug=1` | `B_hook_defined`, `B_title_closed` |
| `C_title` | `?debug=1&title=1` | `#title-settings` opens the SYSTEM menu on SETTINGS (`C_settings_menu_open`, `C_settings_tab_selected`); Esc closes the menu, title stays (`C_esc_closes_menu`, `C_title_open_after_menu`); `#title-credits` opens credits, Esc closes them, title stays (`C_credits_open`, `C_esc_closes_credits`, `C_title_open_after_credits`); `#title-new` closes the title (`C_new_game_closes_title`), `audioUnlocked()` true (`C_audio_unlocked`); 3 crank clicks give `totalClicks` 3 (`C_three_crank_clicks`) |
| `D_newgame` | same context as C | `saveNow()`, reload: `#title-continue` visible (`D_continue_visible`) and focused (`D_continue_focused`); `#title-new` reads `CONFIRM: ERASE ALL?` (`D_new_game_armed_label`); second press closes the title (`D_new_game_closes_title`) and resets `totalClicks` to 0 (`D_clicks_reset`) |
| `E_footer` | `?debug=1`, Esc opens SYSTEM | `#sys-footer` = `v0.9.0 · SAVE v2` (`E_footer_text`), font size >= 12 px (`E_footer_font_size_12px`), `aria-label` = `Version 0.9.0` (`E_footer_aria_label`), `#sys-credits` visible (`E_credits_visible`), `#sys-quit` absent or hidden on web (`E_quit_absent_or_hidden`), click opens credits (`E_credits_opens`) |
| `F_fullscreen` | `?debug=1`, Esc, `#sys-tab-settings` | when `document.fullscreenEnabled`: `#sys-set-fullscreen` exists; `F_fullscreen_control` records `{ fullscreenEnabled, control }`. `F_keys_hint`: `.settings-keys li` includes `F11 / ALT+ENTER  FULLSCREEN` |
| `G_crash` | `?debug=1` | a timer throws: `#crash-overlay` visible within 3 s (`G_overlay_visible_3s`), text has `THE MACHINE STALLED` and `smoke crash` (`G_overlay_text`); a second throw keeps exactly one overlay (`G_single_overlay`); `#crash-reload` reloads and the overlay is gone (`G_reload_clears_overlay`). Console/page errors containing `smoke crash` or starting with `[crash]` are dropped from `errors` for this case only |
| `errors` | all cases | console errors, page errors, failed requests, each prefixed with the case key |

## Resolutions smoke (WP19): `resolutions.mjs`

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/resolutions.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/resolutions
```

Matrix: viewports 1280x720, 1280x800, 1920x1080, 2560x1440, 3440x1440 x `uiScale` 100 and 150 (10 fresh contexts,
`deviceScaleFactor` 1). Each run waits for `componentState('handCrank')`, calls `session.updateSettings({ uiScale })`,
waits 300 ms, then measures `getBoundingClientRect`:
- `#game canvas` (reference), `#ui-root`, `#hud-panel`, `#hud-buttons`;
- `#tech-panel` (after `t`);
- `#system-panel` on the SYSTEM tab (after Esc, Esc), then `#system-panel` on the SETTINGS tab (after `#sys-tab-settings`).

Assertions, named `<w>x<h>-<scale>_<check>`:
- `tech-open`, `system-open`, `settings-open` (`<w>x<h>-<scale>_tech-open`, `_system-open`, `_settings-open`): the panel
  really is open. `#tech-overlay.is-open` after `t`; `#system-menu.is-open` after Esc, Esc; `#system-menu.is-open` and
  `#sys-tab-settings` `aria-selected="true"` on the SETTINGS tab;
- `hud-panel_inside`, `hud-buttons_inside`, `tech-panel_inside`, `system-panel_inside`, `system-settings_inside`: rect lies
  inside the canvas rect (1 px tolerance). `inside()` and `sameRect()` require a non-zero width and height on both rects,
  so a missing or 0x0 panel never passes;
- `ui-root_equals_canvas`: `#ui-root` rect equals the canvas rect (1 px);
- `zoom`: `parseFloat(#ui-root.style.zoom)` equals `uiZoom(canvasH, scale)` within 0.001, where
  `uiZoom = round4(min(6, max(1, canvasH / 720) * scale / 100))` and `canvasH` is the canvas rect height. The result
  holds `{ got, want }`;
- `1920x1080-<scale>_hud-height-ratio` and `2560x1440-<scale>_hud-height-ratio`: `#hud-panel` height is 1.5x and 2x the
  1280x720 height of the same scale (12 % tolerance). The value is the measured ratio.

Title rows (uiScale 150, viewports 1280x720 and 1280x800): set uiScale, `saveNow()`, wait 500 ms, reload with `&title=1`,
then check `title-<w>x<h>-150_title_open` and `title-<w>x<h>-150_title-panel_inside`.

Outputs:
- screenshots `res-<w>x<h>-<scale>-hud.png`, `-tree.png`, `-menu.png` (`-menu.png` is the SETTINGS tab);
- `results.rects["<w>x<h>-<scale>"]` = compact `[x, y, w, h]` per element (`canvas`, `ui`, `hud`, `buttons`, `tech`,
  `system`, `settings`); title rows hold `canvas` and `title-panel`.

## Desktop smoke (desktop.mjs)

Runs against the PACKAGED Windows exe (Steam shell, WP19 T14). It needs a built exe first: `npm run build:steam`
writes `out/steam/full/win-x64/WhatExactlyDoesThisMachineDo.exe`. No browser preview is involved.

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/desktop.mjs "<repo>/out/steam/full/win-x64/WhatExactlyDoesThisMachineDo.exe" C:/Users/<you>/AppData/Local/Temp/smoke/desktop
```

- Env `DESKTOP_CDP_PORT` (default `9339`): the port passed as `--remote-debugging-port`. Pick another one when 9339 is busy.
- Why CDP: the EnableNodeCliInspectArguments fuse is OFF in the packaged build, so Playwright `_electron.launch` cannot
  attach. The smoke starts the exe with `--remote-debugging-port` and calls `chromium.connectOverCDP`.
- Isolated user data: the smoke sets `WEDTMD_USER_DATA=<outdir>/userdata` and deletes that folder first. The real
  `%APPDATA%` save is never touched. The second launch (`6_relaunch`) reuses the same folder.
- Output: one JSON object `{ results, fail, errors }`. Exit code 1 when `fail` is non-empty (expect `[]`). `errors`
  lists console errors and page errors from the attached page (expect `[]`). Screenshots: `desktop-title.png`,
  `desktop-game.png`.
- Every launch is killed in a finally block (`taskkill /T /F`), also after a failure.

| key | checks |
|---|---|
| `cdp_attach` | the exe answers on the CDP port and an `app://wedtmd/` page is found (`value.reason` on failure) |
| `1_title_fresh` | fresh profile: `#title-screen` is open, `#title-continue` hidden, `#title-quit` visible, `#title-version` = `v0.9.0 · SAVE v2` |
| `1b_content_size` | fresh profile: the page area is exactly 1280x720 (`window.innerWidth` / `innerHeight`) |
| `2_gates` | `window.__wedtmd` undefined, `window.wedtmdHost.kind` = `electron`, `isPackaged` true |
| `3_crank` | `#title-new` closes the title; 20 Space presses at 100 ms gaps change `#hud-me` (`before` / `after`) |
| `4_fullscreen` | F11 on, then F11 off (800 ms settle each). `value.f11Routed` is true only when both toggles work. Otherwise the fallback runs: Escape, `#sys-tab-settings`, `#sys-set-fullscreen` on and off, Escape (`value.settings`). Either path must toggle on and off |
| `5_quit` | Escape opens SYSTEM when closed, `#sys-quit` click: the process exits within 10 s, `saves/wedtmd.save.json` parses with `state.totalClicks` >= 15, `window.json` exists |
| `6_relaunch` | second launch on the same folder: `#title-continue` visible and focused, click, 5 Space presses, quit. `totalClicks` gained >= 3 over the first run and `saves/wedtmd.save.json.bak` exists |
| `6b_content_size_stable` | still 1280x720 after quit and relaunch (`window.json` stores the page size, so the window does not grow) |
| `7_csp` | `logs/renderer.log` has no line matching `Content Security Policy` or `Refused to`, and no page error was collected after attach |

f11Routed is false under CDP because injected keys skip the main-process input hook; real F11 and Alt+Enter keystrokes (SendKeys) were verified to toggle fullscreen in WP19 round 0.

Boot-only fallback: when CDP never attaches, `cdp_attach` fails and the smoke runs `boot_only` instead. The process
must stay alive for 10 s and `saves/wedtmd.save.json` must exist (the boot save). Keys 1 to 6 are not run.
`7_csp` still reads `renderer.log`.

## Content smokes (window.__wedtmd hook, `?debug=1` required)

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/wp2-crank.mjs        "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/wp3-techtree.mjs     "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/wp4-persistence.mjs  "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/full-machine.mjs     "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/full.png
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/finale.mjs           "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/prestige.mjs         "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke
```
Each prints a JSON result; `errors` must be empty. They use the read-only `window.__wedtmd` debug hook.

PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/stages.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/stages   # unlock-stage screenshots (ONLY=s0_crank,... FRAME_MS=40 optional)

Stages s0_crank … s9_era2_full (era I / II), s10_boiler and s11_era3_full (era III; s10 / s11 also print the 16 Era III part visibilities), s12_spire and s13_era4_full (era IV; s12 / s13 also print `parts4`, the 16 Era IV part visibilities), s14_null (era V start; prints `parts5`), s15_era5_full and s16_postgame (era V; print `parts5`, the 38 Era V part visibilities; both click the crank 3x before the screenshot so the inversion ghost shows). `s16_postgame` = s15 buys + primaryFunction, then `skipFinale()`, click KEEP IT RUNNING, 2.5 s settle, shot (postgame world). Every stage prints its plaque text and camera state.
In a buy list, `@<techId>` jumps 8 h at a time (up to 8 jumps) until that tech is owned; `@blueprint` is an alias of `@generatorBlueprint`.
`PERF=1` (stages.mjs): for s13_era4_full and s15_era5_full, waits 3 s after the screenshot and prints `machineStats` (`{ meanMs, maxMs, components }`, or `null` when the hook is missing).
wp3-techtree.mjs result keys: `12_tab5` (fifth tab text, expect `SIGNAL ?`), `13_tabs`, `13_tabCount` (expect 5), `13_header` (expect ends `???`), `13_nodes` (expect 10), `13_null` (classes of `nullChamber`, `'missing'` when absent).
wp12-menus.mjs (WP12 menus / keyboard / settings / records / export-import): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/wp12-menus.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke` (screenshots `wp12-0*.png` in the outdir). Keys: `1_first_crank_toasts` (contains `RECORD LOGGED`), `2_esc_menu` (true), `2_arrow_right` (selected tab = `sys-tab-settings`), `3_tab_trapped` (true after 12 Tabs), `4_settings` / `4_root_attrs` (volume 40, reduced motion on, UI scale 125, notation scientific; `#ui-root` zoom `1.25`), `5_space` (`delta` 10, `heldDelta` 0), `6_tree_t` (`[true, false]`), `7_records_firstTurn` (1), `7_records_counter`, `8_stats_clicks_cell` = `8_stats_clicks_session`, `9_hud_me_scientific` (contains `e`), `10_settings_after_reload` (same settings), `11_restored` (all true), `12_garbage` (status text, `meSame` / `clicksSame` true), `13_typing_in_textarea` (`treeOpen` false, `clicksDelta` 0). `errors` must be empty.

`finale.mjs` (WP13 ending sequence, PRIMARY FUNCTION reveal, postgame): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/finale.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke`. Runs in fresh contexts: (1) buy `primaryFunction` after the era V list, HUD hidden, crank does not change clicks, `modalCount` ≥ 1; keyframes via `finaleSeek` at 1, 6, 12, 15.6, 24, 30.5, 34, 40, 56, end (screenshots `finale-k<label>.png`); (3) 5 s playback from t 20, reload → `choice` (KEEP IT RUNNING shown, plate frame 5); (4) Esc / `t` do nothing at choice, KEEP → `postgame`, `localStorage` `state.ending.phase` postgame, crank works, reload keeps postgame, system menu BEGIN A NEW CYCLE row (WP14: enabled, reason line absent), reset from menu → plate frame 4; skip run (Esc during sequence → `choice`, t = end); reduced run (`session.updateSettings({ reducedMotion: true })` before the buy: `reduced`, overlay alpha at 15.6, wipe mode at 24, birds, beam animate).
Result keys (all `finale_*`): `finale_0_fastforward_failed` (expect `[]`), `finale_1_buy`, `finale_1_t_sequence`, `finale_k1` … `finale_kend` (each: `t`, `shot`, `plate` = name plate texture frame, `frame` = full `FinaleFrame`), `finale_2_playback_t`, `finale_3_reload_choice`, `finale_4_esc_t_choice`, `finale_4_keep`, `finale_4_crank_postgame`, `finale_5_reload_postgame`, `finale_6_newcycle`, `finale_7_reset`, `finale_skip`, `finale_r_start`, `finale_r_15_6`, `finale_r_24`. `finale_FAILED` appears only if the run threw. `errors` must be empty (the KEEP click failure is also recorded there).
Missing hook fields (`finaleState`, `finaleSeek`, `skipFinale`, `displayObjects`, `componentState().frame`) print `null`; they never throw.

`prestige.mjs` (WP14 new cycle, Echoes, Memory perks, postgame path, confirm setting, reduced motion, hard reset): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/prestige.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke`. Four fresh contexts. Result keys (all `prestige_*`, checks only via `ok(...)`): (A) `prestige_0_choice`; finale BEGIN A NEW CYCLE opens the confirm dialog (`prestige_1_dialog`, gain line `+3 ECHOES`); CANCEL changes nothing (`prestige_1_cancel`); BEGIN runs the transition (`prestige_1_transition`: `started`, `maxAlpha` >= .95, `done`, `wallMs`); after it `prestige_1_after` (prestige `{cycle 2, echoesEarned 3, perks []}`, modals 0, HUD `CYCLE 0043`, toast, res all 0, only start techs, ending none, generator hidden, finale phase none, stats cycles 2); `prestige_1_record` (cycle + `CYCLE 0043` toast); `prestige_1_saved` (save has `prestige`); `prestige_1_reload` / `prestige_1_crank` (same after reload, crank works). MEMORY tab: `prestige_2_memory_head` (`ECHOES 3 (+90% ALL/S)`, `UNSPENT 3`), `prestige_2_residual` (OWNED, UNSPENT 1), `prestige_2_muscle` (wornMotor level visible at once), `prestige_2_locked` (servo / ledger / long silence disabled, `NEED` text). `prestige_6_reset` (hard reset: prestige default, no HUD cycle line). (B) `prestige_3_*`: KEEP IT RUNNING -> SYSTEM row BEGIN A NEW CYCLE enabled -> confirm -> cycle 2. (C) `prestige_4_confirm_off`: SETTINGS toggle CONFIRM NEW CYCLE OFF -> row starts the transition with no dialog. (D) `prestige_5_reduced`: reduced motion, transition ends with `lastTMs` <= 1200 (`gameMsOk`). `prestige_FAILED` only if the run threw; `errors` must be empty. Shots: `prestige-<step>.png`.

Env vars: `PW_PATH` (required: global Playwright dir), `PERF=1` (finale.mjs: extra run sampling `finale_perf_s1_t8` at t 8–10, `finale_perf_s3_t22` / `finale_perf_s3_t36` at t 22–36, and `finale_perf_postgame`, each `finaleMeanMs`, `machineMeanMs`, `displayObjects`; report only), `WAIT_MS` (stages.mjs: overrides the settle wait for every stage), `FRAME_MS` / `ONLY` / `PERF` (stages.mjs, as above).
