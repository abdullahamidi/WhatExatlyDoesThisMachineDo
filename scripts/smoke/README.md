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

Stages s0_crank … s9_era2_full (era I / II), s10_boiler and s11_era3_full (era III; s10 / s11 also print the 16 Era III part visibilities), s12_spire and s13_era4_full (era IV; s12 / s13 also print `parts4`, the 16 Era IV part visibilities), s14_null (era V start; prints `parts5`), s15_era5_full and s16_postgame (era V; print `parts5`, the 38 Era V part visibilities; both click the crank 3x before the screenshot so the inversion ghost shows). `s16_postgame` = s15 buys + primaryFunction, then `skipFinale()`, click KEEP IT RUNNING, 2.5 s settle, shot (postgame world). Every stage prints its plaque text, camera state and `hud` (WP17 HUD state, see below).
In a buy list, `@<techId>` jumps 8 h at a time (up to 8 jumps) until that tech is owned; `@blueprint` is an alias of `@generatorBlueprint`.
`@<techId>:<n>` buys that tech until its level is `n` (a rejected buy gets an 8 h jump and a retry, up to 128 rounds), then pushes `@<techId>:<n>:true|false`; e.g. `@resonantSiphon:20`.
`PERF=1` (stages.mjs): for s13_era4_full and s15_era5_full, waits 3 s after the screenshot and prints `machineStats` (`{ meanMs, maxMs, components }`, or `null` when the hook is missing).
WP17 (energy continuity, Legacy Feeds): S11 buys `bellowsDrive` x3, S13 `gridExciter` x5, S15 `@resonantSiphon:20`, `@graviticAnchor:10`, `mainsBackfeed` x5, `steamLance` x5 (the `finale.mjs` S lists mirror `stages.mjs`).
`hud` (every stage, one line): `{ title, visibleRows, frontier, click, clickSub, auto, right, bottom }` = `#hud-title` text, shown `.hud-res-row` count, `data-res` of `.hud-row--frontier`, `#hud-per-click` text, `#hud-per-click-me` text (`null` when hidden), `#hud-auto` text (`null` when hidden), `#hud-panel` right / bottom edge in px (`null` when missing). Expected, in the order s0 / s9 / s11 / s13 / s15 / s16:
title `ERA I · MECHANICAL` / `ERA II · ELECTRICAL` / `ERA III · PRESSURE` / `ERA IV · RESONANCE` / `ERA V · ???` / `RESTORATION ENGINE`; visibleRows 1 / 2 / 3 / 4 / 5 / 5; frontier `me` / `ee` / `pr` / `rs` / `xf` / `xf`; auto `null` at s11 and `AUTO-CRANK 3/s` at s13; right <= 340 on every stage.
`parts17` (s9_era2_full, s11_era3_full, s13_era4_full, s15_era5_full, s16_postgame; visibility of the 5 legacy feed parts): all `true` at s15_era5_full and s16_postgame.
`bellowsFrames` (s11_era3_full, s15_era5_full): `componentState('bellows').frame` sampled 4 times, 350 ms apart (span >= 1 s); the frames must not all be equal.
wp3-techtree.mjs result keys: `11_nodes` (era III tab, expect 10), `12_tab5` (fifth tab text, expect `SIGNAL ?`), `12_nodes` (era IV tab, expect 10), `13_tabs`, `11_tabCount` / `12_tabCount` / `13_tabCount` (expect 5, tabs unchanged), `13_header` (expect ends `???`), `13_nodes` (era V tab, expect 12), `13_null` (classes of `nullChamber`, `'missing'` when absent).
wp12-menus.mjs (WP12 menus / keyboard / settings / records / export-import): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/wp12-menus.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke` (screenshots `wp12-0*.png` in the outdir). Keys: `1_first_crank_toasts` (contains `RECORD LOGGED`), `2_esc_menu` (true), `2_arrow_right` (selected tab = `sys-tab-settings`), `3_tab_trapped` (true after 12 Tabs), `4_settings` / `4_root_attrs` (volume 40, reduced motion on, UI scale 125, notation scientific; `#ui-root` zoom `1.25`), `5_space` (`delta` 10, `heldDelta` 0), `6_tree_t` (`[true, false]`), `7_records_firstTurn` (1), `7_records_counter`, `8_stats_clicks_cell` = `8_stats_clicks_session`, `9_hud_me_scientific` (contains `e`), `10_settings_after_reload` (same settings), `11_restored` (all true), `12_garbage` (status text, `meSame` / `clicksSame` true), `13_typing_in_textarea` (`treeOpen` false, `clicksDelta` 0). `errors` must be empty.

`finale.mjs` (WP13 ending sequence, PRIMARY FUNCTION reveal, postgame): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/finale.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke`. Runs in fresh contexts: (1) buy `primaryFunction` after the era V list, HUD hidden, crank does not change clicks, `modalCount` ≥ 1; keyframes via `finaleSeek` at 1, 3.9, 5.4, 6, 6.9, 12, 15.6, 24, 30.5, 34, 40, 41.5, 45.2, 56, end (screenshots `finale-k<label>.png`); (3) 5 s playback from t 20, reload → `choice` (KEEP IT RUNNING shown, plate frame 5); (4) Esc / `t` do nothing at choice, KEEP → `postgame`, `localStorage` `state.ending.phase` postgame, crank works, reload keeps postgame, system menu BEGIN A NEW CYCLE row (WP14: enabled, reason line absent), reset from menu → plate frame 4; skip run (Esc during sequence → `choice`, t = end); reduced run (`session.updateSettings({ reducedMotion: true })` before the buy: `reduced`, overlay alpha at 15.6, wipe mode at 24, birds, beam animate, and at 42 `finale_r_42`, see WP18).
Result keys (all `finale_*`): `finale_0_fastforward_failed` (expect `[]`), `finale_1_buy`, `finale_1_t_sequence`, `finale_k1` … `finale_kend` (each: `t`, `shot`, `plate` = name plate texture frame, `frame` = full `FinaleFrame`, plus WP18 `completeEra` = `frame.completeEra`, `hidden` = `partsVisible().hidden`, `camera` = `cameraState()` `{ zoom, centerX, centerY, relX, relY }`), `finale_2_playback_t`, `finale_3_reload_choice`, `finale_4_esc_t_choice`, `finale_4_keep`, `finale_4_crank_postgame`, `finale_5_reload_postgame` (also WP18 `camera`), `finale_6_newcycle`, `finale_7_reset`, `finale_skip`, `finale_r_start`, `finale_r_15_6`, `finale_r_24`, `finale_r_42` (WP18: `t`, `completeEra`, `camera`). `finale_FAILED` appears only if the run threw. `errors` must be empty (the KEEP click failure is also recorded there).
Missing hook fields (`finaleState`, `finaleSeek`, `skipFinale`, `displayObjects`, `componentState().frame`, WP18 `partsVisible`, `cameraState`) print `null`; they never throw.
WP18 expectations (`finale.mjs`): every `finale_k<label>` now also records `completeEra`, `hidden` and `camera`; the new keys are `finale_k3_9`, `finale_k5_4`, `finale_k6_9`, `finale_k41_5`, `finale_k45_2`. `completeEra` is 3 / 4 / 5 at t 3.9 / 5.4 / 6.9 (completion steps at t 3 / 4.5 / 6). `camera` is (1320, 1380, 1) at `finale_k41_5` (baseL hold 41.0-42.0) and (2520, 1380, 1) at `finale_k45_2` (baseR hold 45.0-46.0; seek 45.2 because the 250 ms settle must stay inside the hold). `finale_5_reload_postgame.camera` is (1920, 1080, .5), the canonical portrait. `finale_r_42` has zoom .5: the survey is skipped under reduced motion. Screenshots: `finale-k<label>.png`, `finale-reduced-42.png`.
`prestige.mjs` (WP14 new cycle, Echoes, Memory perks, postgame path, confirm setting, reduced motion, hard reset): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/prestige.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke`. Four fresh contexts. Result keys (all `prestige_*`, checks only via `ok(...)`): (A) `prestige_0_choice`; finale BEGIN A NEW CYCLE opens the confirm dialog (`prestige_1_dialog`, gain line `+3 ECHOES`); CANCEL changes nothing (`prestige_1_cancel`); BEGIN runs the transition (`prestige_1_transition`: `started`, `maxAlpha` >= .95, `done`, `wallMs`); after it `prestige_1_after` (prestige `{cycle 2, echoesEarned 3, perks []}`, modals 0, HUD `CYCLE 0043`, toast, res all 0, only start techs, ending none, generator hidden, finale phase none, stats cycles 2); `prestige_1_record` (cycle + `CYCLE 0043` toast); `prestige_1_saved` (save has `prestige`); `prestige_1_reload` / `prestige_1_crank` (same after reload, crank works). MEMORY tab: `prestige_2_memory_head` (`ECHOES 3 (+90% ALL/S)`, `UNSPENT 3`), `prestige_2_residual` (OWNED, UNSPENT 1), `prestige_2_muscle` (wornMotor level visible at once), `prestige_2_locked` (servo / ledger / long silence disabled, `NEED` text). `prestige_6_reset` (hard reset: prestige default, no HUD cycle line). (B) `prestige_3_*`: KEEP IT RUNNING -> SYSTEM row BEGIN A NEW CYCLE enabled -> confirm -> cycle 2. (C) `prestige_4_confirm_off`: SETTINGS toggle CONFIRM NEW CYCLE OFF -> row starts the transition with no dialog. (D) `prestige_5_reduced`: reduced motion, transition ends with `lastTMs` <= 1200 (`gameMsOk`). `prestige_FAILED` only if the run threw; `errors` must be empty. Shots: `prestige-<step>.png`.

Env vars: `PW_PATH` (required: global Playwright dir), `PERF=1` (finale.mjs: extra run sampling `finale_perf_s1_t8` at t 8–10, `finale_perf_s3_t22` / `finale_perf_s3_t36` at t 22–36, and `finale_perf_postgame`, each `finaleMeanMs`, `machineMeanMs`, `displayObjects`; report only), `WAIT_MS` (stages.mjs: overrides the settle wait for every stage), `FRAME_MS` / `ONLY` / `PERF` (stages.mjs, as above).

## WP15 perf smoke + bundle budget

`perf.mjs` (profiling probes + budgets). Usage, after a build served on a scratch port:
```
PW_PATH=$(npm root -g)/playwright node scripts/smoke/perf.mjs http://localhost:<port>/ /tmp/smoke          # report
PW_PATH=$(npm root -g)/playwright PERF_STRICT=1 node scripts/smoke/perf.mjs http://localhost:<port>/ /tmp/smoke   # exit 1 on breach
PERF_GPU=1 ...   # also gate rAF frame p95 (<= 17 ms); report-only otherwise
ONLY=s0_crank,finale ...   # subset of stages (stage names as in stages.mjs; "finale" = the finale probe run)
```
Prints ONE JSON `{ metrics, budgets, fail, errors }` on stdout (and `<outdir>/perf.json` when an outdir is given). `errors` must be empty; console / page errors also count as a `fail` entry under `PERF_STRICT=1`.
Stages: `s0_crank`, `s9_era2_full`, `s13_era4_full`, `s15_era5_full`, `s16_postgame` (stages.mjs buy lists, fresh context each). Per stage: 10 s warm-up, then 3 samples 2 s apart (each sample reads the 120-frame `machineStats` / `uiStats` rings). `s15` also runs the tech tree probe (era V tab, median of 5 sync opens + forced layout) and the heap probe (`gc()`, then 30 s idle, `gc()`). `s16` runs a new cycle after the KEEP settle and compares `displayObjects` with `s0`. Finale: fresh context, buy list + `primaryFunction`, `finaleSeek` to t 8 / 22 / 34 / 36 (2 s window each).
Gate values: stage means and stage maxes use the median of the 3 windows (raw per-window max is `machineMaxMsRaw` / `uiMaxMsRaw`); finale = worst probe point; `displayObjects` = max of s15, s16 and finale t34; audio = max over running samples only.
Every probe is null-safe: a missing hook field (`audioStats` lands with T4) reports `null` and never fails the run.

Budgets: `scripts/smoke/perf-budget.json` only (numbers are not in the script). Env override: `PERF_<METRIC>` where the metric key is converted camelCase to SCREAMING_SNAKE:
`PERF_MACHINE_MEAN_MS`, `PERF_MACHINE_MAX_MS` (<= 20), `PERF_UI_MEAN_MS`, `PERF_UI_MAX_MS` (<= 8), `PERF_FINALE_MEAN_MS` (<= 2), `PERF_DISPLAY_OBJECTS` (<= 500), `PERF_TECH_TREE_OPEN_MS` (<= 8), `PERF_HEAP_MB` (<= 150, MB = 1e6 bytes), `PERF_HEAP_GROWTH_MB` (<= 8), `PERF_BOOT_MS` (<= 3000, navigation start to first-frame mark), `PERF_LIVE_VOICES` (<= 48), `PERF_MUSIC_VOICES` (<= 8), `PERF_PEAK_DBFS` (<= -1), `PERF_FRAME_P95_MS` (<= 17, gated only with `PERF_GPU=1`), `PERF_CYCLE_DISPLAY_PCT` (<= 10, new cycle vs s0).
Metric names in the JSON: `metrics.gate` (one value per budget key), `metrics.stages.<stage>`, `metrics.finale.t<8|22|34|36>`, `metrics.techTree`, `metrics.heap`, `metrics.cycle`, `metrics.frames`, `metrics.boot`.
Note: frame max spikes come from CPU contention in the container, so the stage max gates use the median of the 3 windows; the raw max stays in the report.

`bundle-budget.mjs` (npm `perf:bundle`): `npm run build && npm run perf:bundle` (or `node scripts/perf/bundle-budget.mjs <distDir>`). Reads `<dist>/assets` (index-*.js app chunk <= 340 KB raw / 100 KB gzip, phaser-*.js <= 1500 KB, *.css <= 30 KB) and `public/assets` (<= 8000 KB), limits from `perf-budget.json` `bundle`, decimal KB. Prints a table; exit 1 on any breach.

`src/game/math/perfBudget.test.ts` (in `npm test`): machine render target `MACHINE_BOUNDS` <= 2048 px per side and <= 16 MB RGBA; worst-case live particles (steam pool + dust + finale seeds + birds) <= 300, with steam derived from `STEAM_EMITTERS` / `MILESTONE_BURSTS` / `FINALE_BOOST` and capped by `STEAM_FX.poolSize`.

## WP18 final machine showcase

Debug hook fields (`window.__wedtmd`, test-only, `src/game/debugHook.ts`). None of them writes the session, the save or the display levels:
- `partsVisible()`: `{ visible, total, hidden }` of the World machine (`MachineView.partsVisibility()`). Shows what the machine draws, so the finale completion beat is visible here. `null` before the world scene exists.
- `photoMode(on, opts?)`: `on` forces photo mode from any phase (`opts.hint`, default shown); `off` exits. Returns the active flag afterwards. `false` without a photo controller (no `#ui-root`).
- `photoState()`: `{ active, hint }`, or `null`.
- `showcasePlay(opts?)`: starts the teaser (`ShowcaseScene.play`) with the live settings and sleeps the World. `{ reduced: true }`: portrait from t 0, no ramps.
- `showcaseSeek(t)`: jumps the running teaser clock to `t` and renders at once. No-op when the teaser is not running. Does not fire `onDone`.
- `showcaseState()`: `{ active, t, era, apertureOpen, boost, done, visible, total, hidden, camera }` of the teaser, or `null` when it is not running.
- `showcaseStop()`: stops the teaser and wakes the World when `showcasePlay` put it to sleep.
- `cameraState()` and `finaleState().frame.completeEra` are the existing readouts used by the WP18 keys.

`showcase.mjs` (WP18 final machine showcase: finale survey, portrait, photo mode, teaser): `PW_PATH=$PW node scripts/smoke/showcase.mjs http://localhost:4173/ <outdir>`. Playwright viewport 1280 x 720 at `deviceScaleFactor` 3, so every PNG is 3840 x 2160. Each PNG size is read from its IHDR bytes; a mismatch goes to `errors`. Prints ONE JSON `{ showcase_*, shots, errors }` on stdout; `errors` must be empty. Writes 13 PNG files. Run order: A, B, C, D, C2, F, E. B, C, D, C2 and F run in one browser context (one game); A and E each open a fresh context. A run that throws adds `showcase_FAILED_<run>` and an entry in `errors`.

Shots (13 PNG files in `<outdir>`):
- `a_era5_ruined`: run A, photo mode with the hint off, real levels, HUD hidden. Taken with the pointer not moved (`still`).
- `b_k2_5`, `b_k3_9`, `b_k5_4`, `b_k6_9`, `b_k41_5`, `b_k45_2`, `b_k56`: run B finale keyframes. `b_k2_5` is t 2.5 (before the completion beat); `b_k3_9` / `b_k5_4` / `b_k6_9` show the completion beat (eras 3 / 4 / 5); `b_k41_5` / `b_k45_2` are the survey holds (baseL / baseR); `b_k56` is shot S4 with the portrait camera.
- `c_postgame_portrait`: run C, postgame, canonical portrait pose.
- `d_photo_postgame`: run D, VIEW MACHINE photo mode in postgame, pointer not moved.
- `e_teaser_era2`: run E, teaser 300 ms after play (era II); `e_teaser_assembling`: teaser at t 3 or later (era IV parts assembling); `e_teaser_end`: teaser done (aperture open, portrait).

Main assertions (run order):
- Run A (fresh context): 45 crank clicks, then the full S15 buy list, 15 s wait for the era V sky, `photoMode(true, { hint: false })`, 1.2 s settle. Asserts: every buy ok; `partsVisible().hidden` subset of `['inversionGhost']`; `photoState().active`; `#hud-panel` visibility `hidden`; camera (1920, 1080, .5).
- Run B (fresh context): 45 crank clicks, then the GREEDY buy list (copperWinding x10, firebox x10, harmonicCoil x16, containmentRing x16, bellowsDrive x3, gridExciter x5, horizonField x10, `@resonantSiphon:11`, `@graviticAnchor:4`, `@finalAlignment`; no mainsBackfeed, no steamLance). Asserts: every buy ok. Then 15 s wait, buy `primaryFunction` (asserts ok), and `finaleSeek` steps (300 ms settle unless noted):
  - `b_k2_5` (t 2.5): completeEra 0; at least 6 hidden parts, including `siphonTube3L`, `coilStage3`, `steamLance`.
  - `b_k3_9`, `b_k5_4`, `b_k6_9` (250 ms settle, the film clock keeps running): completeEra 3 / 4 / 5; `coilStage3` shown at 3.9, `coilRing4` shown at 5.4; hidden subset of `['inversionGhost']` at 6.9; the real `resonantSiphon` level stays 11 (the completion beat is display only).
  - `b_k41_5` (baseL hold): camera (1320, 1380, 1).
  - `b_k45_2` (baseR hold): camera (2520, 1380, 1). Seek 45.2 so the settle stays inside the 45.0-46.0 hold.
  - `b_k56` (shot S4): camera portrait (1920, 1080, .5).
- Run C (same context): `skipFinale`, KEEP IT RUNNING, wait for the stored phase `postgame` (3 s poll), 2.5 s settle. Asserts: phase `postgame`; `#hud-title` `RESTORATION ENGINE`; name plate frame 5; camera portrait; hidden subset of `['inversionGhost']`; `#hud-view-machine` shown with width and height > 0.
- Run D (same context): focus `#hud-view-machine`, Enter, 3.2 s. Asserts: photo active with hint false; modalCount 1; `#hud-panel` visibility `hidden`; `#photo-exit` opacity `0`. Then a 200 px drag must change centerX, wheel -100 must raise zoom, ArrowRight must change centerX. Escape ends photo mode: photo inactive, camera portrait, `#hud-panel` visible, modalCount 0.
- Run C2 (same context): reload. Asserts: phase `postgame`; camera portrait; hidden subset of `['inversionGhost']`.
- Run F (same context, no shot): VIEW MACHINE with Enter (hint off), ArrowRight re-arms the hint (hint on), `t` opens the tech tree. Asserts: photo inactive, tech tree open, modalCount 1, focus on `#tech-close` (not back on the HUD button). Escape closes the tree: modalCount 0. After Esc closes the tree, focus must be on `#hud-view-machine` or `#hud-tech` (never body); techTree.close() falls back there when the opener (the hidden photo exit chip) is no longer rendered.
- Run E (fresh context, `#ui-root` visibility hidden): `showcasePlay()`, 300 ms, era 2 (shot `e_teaser_era2`). Then `showcaseSeek(2.2)` and poll until t >= 3 (60 s cap); shot `e_teaser_assembling`. Then `showcaseSeek(6.5)` and poll until done (60 s cap), 600 ms settle; shot `e_teaser_end`. Asserts: done, era 5, apertureOpen, hidden subset of `['inversionGhost']`, camera portrait, real `session.state.techLevels.generator` still 0. Then `showcaseStop()`: `showcaseState()` null, and one crank click raises `totalClicks` by exactly 1.
- Teaser time never comes from wall time: each step seeks, then polls with a long cap, so a slow headless frame rate only costs wall time.

Result keys: `showcase_A`, `showcase_B_k2_5`, `showcase_B_k3_9`, `showcase_B_k5_4`, `showcase_B_k6_9`, `showcase_B_k41_5`, `showcase_B_k45_2`, `showcase_B_k56`, `showcase_C`, `showcase_D`, `showcase_C2`, `showcase_F`, `showcase_E_era2`, `showcase_E_assembling`, `showcase_E_end`, `showcase_E_stop`.
