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

## UX smoke (WP20): `ux.mjs`

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/ux.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/ux
```

Fresh context per case, 1280x720 unless noted (`D_100`, `D_150`, `T_1280x720` and `T_1920x1080` each get their own; case T uses its viewport; case `M` (WP16b-3) runs after the T cases and before `perf`). Prints ONE JSON object `{ results, fail, errors }`;
expect `fail` and `errors` to be `[]`. Each case waits for `componentState('handCrank')` before it starts.

| case | checks (names in `results` / `fail`) |
|---|---|
| `A` (fresh) | `A_prompt_visible` (`crankPrompt()` after load), `A_no_hint`, `A_one_prompt_t0` (only the crank prompt is up at load: `#hud-hint` and `#hud-goal` hidden), `A_prompt_gone` (after one real click), `A_hint_visible` (`#hud-hint` shows `TECH INDEX` after 15 clicks), `A_badge` (`#hud-tech` `data-affordable` >= 1), `A_one_prompt_hint` (only `#hud-hint` is up after 15 clicks), `A_hint_chip_hidden` (the TECH INDEX count chip, `#hud-tech` `::after`, has `display: none` while the hint shows), `A_focus_node` (after `t`, focus is the `.tech-node.is-selected`), `A_tab_chip` (first `.tech-tab` `data-affordable` >= 1), `A_space_keeps_tree`, `A_space_buys` (`gearRatio` level 1 after Space), `A_feedback_flavor` (`#tech-feedback` contains `gear mesh recalibrated`), `A_feedback_beside_buy` (`#tech-feedback` sits right of `#tech-buy` on the same row, `#tech-level` starts below both), `A_held` (`gearSmall` assembling, alpha < 0.05 while the tree is open), `A_toast_coalesced` (a `LV 1 → 4` toast, at most 2 toasts), `A_toast_above` (`#toast-stack` z-index 200, no toast over `#tech-close` / `#tech-buy`), `A_toast_clear_tabs` (WP21: at most one toast, none over a `.tech-tab`, `#tech-close`, `#tech-buy`, `#tech-title` or `#tech-me`), `A_fly_in_after_close` (`gearSmall` visible, alpha >= 0.99, not assembling), `A_hint_gone`, `A_goal_line` (`#hud-goal` starts with `NEXT:`), `A_one_prompt_goal` (only `#hud-goal` is up after the tree closes), `A_chip_back` (the count chip is back: `#hud-tech` `::after` is not `display: none`, or `data-affordable` is absent) |
| `B` (fresh) | `B_card_shown` (`#era-card` title `ERA II · ELECTRICAL`), `B_card_skipped` (a click hides it), `B_card_held` (hidden while the tree is open), `B_card_after_close` (`ERA III · PRESSURE` after Esc), `B_reduced_no_nudge` (camera `centerX` / `centerY` / `zoom` unchanged within 0.5 across the Esc; value `{ before, after }`), `B_card_reduced` (visible with `animationName` `none` under reduced motion) |
| `C` (fresh) | `C_no_card_in_finale` (full S15 + `primaryFunction`, `#era-card` hidden 500 ms later) |
| `D_100`, `D_150` (fresh each) | `D_<s>_fit` (`#tech-graph` `scrollWidth <= clientWidth + 1`; value `{ scrollWidth, clientWidth }`), `D_<s>_pf_selected` (selected node is `primaryFunction`), `D_<s>_pf_in_view` (its rect lies inside `#tech-graph`, 1 px), `D_100_graph_centered` (UI 100 only: after `#tech-tab-1` the visible nodes sit centred in `#tech-graph`, left and right gaps equal within 4 px), `D_<s>_buy_visible` / `D_<s>_buy_visible_e2` (WP21: PURCHASE has a size, sits inside the tech panel, the detail pane and the viewport, and is the element hit at its centre; `_e2` after era II and `powerLines`), `D_<s>_toast_clear_tabs` (WP21: after a `copperWinding` buy, the same toast rule as A), `D_<s>_menu_fixed` (`#system-panel` height equal within 1 px on every visible `#sys-tabs` tab; value = the heights), `D_<s>_memory_hidden` (`#sys-tab-memory` hidden in phase none) |
| `T_1280x720`, `T_1920x1080` (fresh each, at that viewport) | After the S11 buy list (era III) and the era card click-away: `t`, tab 3, one `firebox` buy (an 8 h jump and a retry when rejected), 450 ms, for UI scale 100, 125 and 150 (`uiScale` set before each pass; the tree is closed by Escape after each). Per pass: `T_<w>x<h>_<s>_toast_shown` (exactly one visible `.toast`; detail `{ bought, vis }`), `T_<w>x<h>_<s>_toast_clear` (the toast hits none of `.tech-tab`, `#tech-close`, `#tech-buy`, `#tech-title`, `#tech-me`; the `toastClearTabs` rule). 12 checks in all |
| `M` (fresh) | WP16b-3, a new cycle with Muscle Memory: S16 buy list, `skipFinale`, click `#finale-cycle`, then `#cycle-confirm-begin`, wait until `prestige().cycle` is 2 with the transition done (`cycleState().busy` false, `transition.active` false), `session.buyPerk('muscleMemory')`, 600 ms. `M_cycle_start` (perk bought ok; cycle 2, `totalClicks` 0, `wornMotor` 1, `gearRatio` 3; value `{ perkOk, cycle, clicks, wornMotor, gearRatio }`), `M_one_prompt_t0` (only the crank prompt is up: `count` 1 and `prompt` true), `M_one_prompt_goal` (after one real crank click only `#hud-goal` is up: `count` 1 and `goal` true) |
| `perf` | `perf_click` only (report, never in `fail`): `{ ui: uiStats(), machine: machineStats() }` after 30 clicks, 100 ms apart |

Screenshots in the outdir: `ux-A1-prompt.png`, `ux-A2-hint.png`, `ux-A3-tree-buy.png`, `ux-A4-flyin.png`, `ux-A5-goal.png`,
`ux-B1-card.png`, `ux-B2-card-after-close.png`, `ux-B3-card-reduced.png`, and per uiScale `ux-D-100-tree.png`, `ux-D-100-tree-e2.png`,
`ux-D-100-menu-system.png`, `ux-D-100-menu-settings.png` (the same set with `150`), and case T's six shots `ux-T-<w>x<h>-<s>.png` (`1280x720` and `1920x1080`, each at `100`, `125`, `150`). Case M (WP16b-3) adds `ux-M1-cycle-prompt.png` and `ux-M2-cycle-goal.png`.

Failed checks are listed by name in `fail`; a thrown exception becomes `FAILED:<case>:<message>`. `errors` collects console
errors, page errors and failed requests, each prefixed with the case key.

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
`CLICK_SHOT=1` (stages.mjs): clicks the crank 3x before every stage shot so the gain block is in the screenshot.
An `#era-card` shown at screenshot time is clicked away first (WP20).
WP17 (energy continuity, Legacy Feeds): S11 buys `bellowsDrive` x3, S13 `gridExciter` x5, S15 `@resonantSiphon:20`, `@graviticAnchor:10`, `mainsBackfeed` x5, `steamLance` x5 (the `finale.mjs` S lists mirror `stages.mjs`).
`hud` (every stage, one line): `{ title, visibleRows, frontier, click, clickSub, auto, right, bottom }` = `#hud-title` text, shown `.hud-res-row` count, `data-res` of `.hud-row--frontier`, `#hud-per-click` text, `#hud-per-click-me` text (`null` when hidden), `#hud-auto` text (`null` when hidden), `#hud-panel` right / bottom edge in px (`null` when missing). Expected, in the order s0 / s9 / s11 / s13 / s15 / s16:
title `ERA I · MECHANICAL` / `ERA II · ELECTRICAL` / `ERA III · PRESSURE` / `ERA IV · RESONANCE` / `ERA V · ???` / `RESTORATION ENGINE`; visibleRows 1 / 2 / 3 / 4 / 5 / 5; frontier `me` / `ee` / `pr` / `rs` / `xf` / `xf`; auto `null` at s11 and `AUTO-CRANK 3/s` at s13; right <= 340 on every stage.
`parts17` (s9_era2_full, s11_era3_full, s13_era4_full, s15_era5_full, s16_postgame; visibility of the 5 legacy feed parts): all `true` at s15_era5_full and s16_postgame.
`bellowsFrames` (s11_era3_full, s15_era5_full): `componentState('bellows').frame` sampled 4 times, 350 ms apart (span >= 1 s); the frames must not all be equal.
wp3-techtree.mjs result keys: `11_nodes` (era III tab, expect 10), `12_tab5` (fifth tab text, expect `SIGNAL ?`), `12_nodes` (era IV tab, expect 10), `13_tabs`, `11_tabCount` / `12_tabCount` / `13_tabCount` (expect 5, tabs unchanged), `13_header` (expect ends `???`), `13_nodes` (era V tab, expect 12), `13_null` (classes of `nullChamber`, `'missing'` when absent).
wp12-menus.mjs (WP12 menus / keyboard / settings / records / export-import): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/wp12-menus.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke` (screenshots `wp12-0*.png` in the outdir). Keys: `1_first_crank_toasts` (contains `RECORD LOGGED`), `2_esc_menu` (true), `2_arrow_right` (selected tab = `sys-tab-settings`), `3_tab_trapped` (true after 12 Tabs), `4_settings` / `4_root_attrs` (volume 40, reduced motion on, UI scale 125, notation scientific; `#ui-root` zoom `1.25`), `5_space` (`delta` 10, `heldDelta` 0), `6_tree_t` (`[true, false]`), `7_records_firstTurn` (1), `7_records_counter`, `8_stats_clicks_cell` = `8_stats_clicks_session`, `9_hud_me_scientific` (contains `e`), `10_settings_after_reload` (same settings), `11_restored` (all true), `12_garbage` (status text, `meSame` / `clicksSame` true), `13_typing_in_textarea` (`treeOpen` false, `clicksDelta` 0), `14_tree_space` (`{ open: true, focusNode: true }`: Space inside the tree keeps it open, WP20). `errors` must be empty.

`finale.mjs` (WP13 ending sequence, PRIMARY FUNCTION reveal, postgame): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/finale.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke`. Runs in fresh contexts: (1) buy `primaryFunction` after the era V list, HUD hidden, crank does not change clicks, `modalCount` ≥ 1; keyframes via `finaleSeek` at 1, 3.9, 5.4, 6, 6.9, 12, 15.6, 24, 30.5, 34, 40, 41.5, 45.2, 56, end (screenshots `finale-k<label>.png`); (3) 5 s playback from t 20, reload → `choice` (KEEP IT RUNNING shown, plate frame 5); (4) Esc / `t` do nothing at choice, KEEP → `postgame`, `localStorage` `state.ending.phase` postgame, crank works, reload keeps postgame, system menu BEGIN A NEW CYCLE row (WP14: enabled, reason line absent), reset from menu → plate frame 4; skip run (Esc during sequence → `choice`, t = end); reduced run (`session.updateSettings({ reducedMotion: true })` before the buy: `reduced`, overlay alpha at 15.6, wipe mode at 24, birds, beam animate, and at 42 `finale_r_42`, see WP18).
Result keys (all `finale_*`): `finale_0_fastforward_failed` (expect `[]`), `finale_1_buy`, `finale_1_t_sequence`, `finale_k1` … `finale_kend` (each: `t`, `shot`, `plate` = name plate texture frame, `frame` = full `FinaleFrame`, plus WP18 `completeEra` = `frame.completeEra`, `hidden` = `partsVisible().hidden`, `camera` = `cameraState()` `{ zoom, centerX, centerY, relX, relY }`), `finale_2_playback_t`, `finale_3_reload_choice`, `finale_4_esc_t_choice`, `finale_4_keep`, `finale_4_crank_postgame`, `finale_5_reload_postgame` (also WP18 `camera`), `finale_6_newcycle`, `finale_7_reset`, `finale_skip`, `finale_r_start`, `finale_r_15_6`, `finale_r_24`, `finale_r_42` (WP18: `t`, `completeEra`, `camera`). `finale_FAILED` appears only if the run threw. `errors` must be empty (the KEEP click failure is also recorded there).
Missing hook fields (`finaleState`, `finaleSeek`, `skipFinale`, `displayObjects`, `componentState().frame`, WP18 `partsVisible`, `cameraState`) print `null`; they never throw.
WP18 expectations (`finale.mjs`): every `finale_k<label>` now also records `completeEra`, `hidden` and `camera`; the new keys are `finale_k3_9`, `finale_k5_4`, `finale_k6_9`, `finale_k41_5`, `finale_k45_2`. `completeEra` is 3 / 4 / 5 at t 3.9 / 5.4 / 6.9 (completion steps at t 3 / 4.5 / 6). `camera` is (1320, 1380, 1) at `finale_k41_5` (baseL hold 41.0-42.0) and (2520, 1380, 1) at `finale_k45_2` (baseR hold 45.0-46.0; seek 45.2 because the 250 ms settle must stay inside the hold). `finale_5_reload_postgame.camera` is (1920, 1080, .5), the canonical portrait. `finale_r_42` has zoom .5: the survey is skipped under reduced motion. Screenshots: `finale-k<label>.png`, `finale-reduced-42.png`.

WP18b expectations (restored texture swap): `finale.mjs` records `restoredSwapped` (= `restoredTextures().swapped.length`, `null` when the hook is missing) in every `finale_k<label>`, `finale_3_reload_choice`, `finale_5_reload_postgame`, `finale_7_reset` and `finale_r_42`. Expected: 0 for t < 30 (`finale_k1` ... `finale_k24`), 33 for t >= 30.5 (`finale_k30_5` ... `finale_kend`), 33 at `finale_3_reload_choice`, 33 at `finale_5_reload_postgame`, 0 at `finale_7_reset` (the menu reset reverts), 33 at `finale_r_42` (reduced motion swaps instantly too). `prestige.mjs` RUN B records `restoredSwapped` and `coreKey` in `prestige_3_postgame` (expect 33 and `machine.nullCore#restored#rot`) and in `prestige_3_after` (expect 0 and `machine.nullCore#rot`: the new cycle swaps back); a mismatch is pushed into `errors`.
`prestige.mjs` (WP14 new cycle, Echoes, Memory perks, postgame path, confirm setting, reduced motion, hard reset): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/prestige.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke`. Four fresh contexts. Result keys (all `prestige_*`, checks only via `ok(...)`): (A) `prestige_0_choice`; finale BEGIN A NEW CYCLE opens the confirm dialog (`prestige_1_dialog`, gain line `+3 ECHOES`); CANCEL changes nothing (`prestige_1_cancel`); BEGIN runs the transition (`prestige_1_transition`: `started`, `maxAlpha` >= .95, `done`, `wallMs`); after it `prestige_1_after` (prestige `{cycle 2, echoesEarned 3, perks []}`, modals 0, HUD `CYCLE 0043`, toast, res all 0, only start techs, ending none, generator hidden, finale phase none, stats cycles 2); `prestige_1_record` (cycle + `CYCLE 0043` toast); `prestige_1_saved` (save has `prestige`); `prestige_1_reload` / `prestige_1_crank` (same after reload, crank works). MEMORY tab: `prestige_2_memory_head` (`ECHOES 3 (+90% ALL/S)`, `UNSPENT 3`), `prestige_2_residual` (OWNED, UNSPENT 1), `prestige_2_muscle` (wornMotor level visible at once), `prestige_2_locked` (servo / ledger / long silence disabled, `NEED` text). `prestige_6_reset` (hard reset: prestige default, no HUD cycle line). (B) `prestige_3_*`: KEEP IT RUNNING -> SYSTEM row BEGIN A NEW CYCLE enabled -> confirm -> cycle 2. (C) `prestige_4_confirm_off`: SETTINGS toggle CONFIRM NEW CYCLE OFF -> row starts the transition with no dialog. (D) `prestige_5_reduced`: reduced motion, transition ends with `lastTMs` <= 1200 (`gameMsOk`). `prestige_FAILED` only if the run threw; `errors` must be empty. Shots: `prestige-<step>.png`.

Env vars: `PW_PATH` (required: global Playwright dir), `PERF=1` (finale.mjs: extra run sampling `finale_perf_s1_t8` at t 8–10, `finale_perf_s3_t22` / `finale_perf_s3_t36` at t 22–36, and `finale_perf_postgame`, each `finaleMeanMs`, `machineMeanMs`, `displayObjects`; report only), `WAIT_MS` (stages.mjs: overrides the settle wait for every stage), `FRAME_MS` / `ONLY` / `PERF` (stages.mjs, as above).

## WP15 perf smoke + bundle budget

Browser perf smoke (`perf.mjs`, Chromium on the real Windows GPU) and the bundle budget (`bundle-budget.mjs`). Both read
their limits from `scripts/smoke/perf-budget.json`. The machine is CPU-loaded by parallel workflows, so every reported
number is the MEDIAN of 3 runs (`scripts/perf/perf-median.mjs`). A single run is for debugging only.

### One perf run

Build and serve the preview on port 4174 (see Setup), then:

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/perf
```

- `<preview>` is `http://localhost:4174` on this track. Keep one server on 4174; never start a second one.
- `?debug=1` is needed for the hook `window.__wedtmd`. When the URL has no `debug` param, perf.mjs adds `debug=1` itself
  before every page load.
- Outdir: absolute Windows path (the session scratchpad works too). The run writes `<outdir>/perf.json`.
- Stdout: ONE JSON object `{ metrics, budgets, fail, errors }`. Expect `fail` `[]` and `errors` `[]`.

Env vars:

| env | effect |
|---|---|
| `PW_PATH` | required: global Playwright dir (see Setup). |
| `PERF_GPU=1` | real GPU: Chromium launches with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`. Gates `frameP95Ms` and `postFrameP95Ms` (both <= 17 ms). Without it these two keys are report-only. A software renderer (SwiftShader, llvmpipe, basic render) under `PERF_GPU=1` is a fail. |
| `PERF_HEADED=1` | headed launch. Use it as the fallback when the renderer string is SwiftShader under `PERF_GPU=1`. |
| `PERF_PROFILE=1` | CDP CPU profile of post repeat #1, the keystone window and idle window #3. Result `top`: 10 entries `{ fn, selfMs }`, the `(idle)`, `(program)` and `(root)` nodes excluded (`(garbage collector)` kept). `.cpuprofile` files go into the outdir. The production build is minified: map hot spots by `url:line:col` against `dist/assets`. |
| `PERF_STRICT=1` | exit 1 when `fail` is non-empty. Console and page errors count as a fail (`errors N > 0`). |
| `ONLY=<list>` | comma list of stages to run: `s0_crank`, `s7_era1_full`, `s9_era2_full`, `s11_era3_full`, `s13_era4_full`, `s15_era5_full`, `s16_postgame`, `finale` (the finale probe run). |
| `PERF_<METRIC>=<n>` | overrides one budget. Key camelCase to SCREAMING_SNAKE, e.g. `PERF_POST_MACHINE_MAX_MS`. Read by perf.mjs only; perf-median uses the JSON file. |

Budget keys (`scripts/smoke/perf-budget.json`, top level; a value must be <= limit unless noted):

| key | env override | limit |
|---|---|---|
| `machineMeanMs` | `PERF_MACHINE_MEAN_MS` | 4 ms |
| `machineMaxMs` | `PERF_MACHINE_MAX_MS` | 40 ms |
| `postMachineMaxMs` | `PERF_POST_MACHINE_MAX_MS` | 40 ms (0-3 s after a purchase) |
| `uiMeanMs` | `PERF_UI_MEAN_MS` | 2 ms |
| `uiMaxMs` | `PERF_UI_MAX_MS` | 8 ms |
| `finaleMeanMs` | `PERF_FINALE_MEAN_MS` | 2 ms |
| `displayObjects` | `PERF_DISPLAY_OBJECTS` | 500 |
| `techTreeOpenMs` | `PERF_TECH_TREE_OPEN_MS` | 8 ms |
| `heapMb` | `PERF_HEAP_MB` | 150 MB (MB = 1e6 bytes) |
| `heapGrowthMb` | `PERF_HEAP_GROWTH_MB` | 8 MB |
| `bootMs` | `PERF_BOOT_MS` | 3000 ms (navigation start to first frame) |
| `liveVoices` | `PERF_LIVE_VOICES` | 48 |
| `musicVoices` | `PERF_MUSIC_VOICES` | 8 |
| `peakDbfs` | `PERF_PEAK_DBFS` | -1 dBFS |
| `frameP95Ms` | `PERF_FRAME_P95_MS` | 17 ms (GPU only) |
| `postFrameP95Ms` | `PERF_POST_FRAME_P95_MS` | 17 ms (GPU only) |
| `cycleDisplayPct` | `PERF_CYCLE_DISPLAY_PCT` | 10 % (new cycle vs the pre-cycle display count) |

### Stages and probes

Each stage: fresh context at 1280x720, buy list = the WP17 list of `stages.mjs` (`@<tech>` and `@<tech>:<n>` markers as there).

- `s0_crank`: no buys. `boot` = `navToBootMs`, `bootMs`, `bootToFirstFrameMs`. audioWiring probe: clicks the crank, opens the
  SYSTEM menu, sets `#sys-set-musicVolume` to 0, then to 70, and reads the music bus and voices from `audioStats`.
  `audioWiring.ok` is true / false, or null when the build has no levels. `ok === false` fails `audioWiring`.
- `s7_era1_full`, `s9_era2_full`, `s11_era3_full`, `s13_era4_full`, `s15_era5_full`: buy lists from `stages.mjs`.
- `s16_postgame`: same list plus `primaryFunction`, `skipFinale()` and KEEP IT RUNNING. Then a new cycle through the
  SYSTEM menu row (WP14). `cycle.pct` = display object count after the cycle vs before it (no leak; parts are hidden,
  not destroyed, so the check is growth, not shrink).
- `s15_era5_full` extra: tech tree probe (era V tab, median of 5 sync opens with forced layout, `techTree.medianMs`) and
  heap probe (`gc()` and read, 30 s idle, `gc()` and read; `heap.usedMb`, `heap.growthMb`).

Idle windows (every stage): 10 s warm-up, then 3 windows of 2 s. Per window: rAF frame deltas and the `machineStats`,
`uiStats`, `displayObjects` and `audioStats` probes (120-frame rings). Stage keys:
- `frameP50Ms`, `frameP95Ms`, `frameMaxMs`: over all frames of the 3 windows.
- `machineMeanMs`, `machineMaxMs`, `uiMeanMs`, `uiMaxMs`: median of the 3 windows. `machineMaxMsRaw`, `uiMaxMsRaw`: max of
  the 3 windows (raw).
- `displayObjects`: max of the 3 windows.
- `audio`: `liveVoices`, `musicVoices`, `peakDb` (max over running windows), `era`, `theme`, `musicBus`.

Post-purchase windows (`stage.post`, s7 / s11 / s15). Each window = settle 1 s, the purchase, then 3 s of frame and probe
readings.
- s7: gearRatio x3 (repeat windows), then the generator keystone after `@blueprint`.
- s11: bellowsDrive x3, then the resonatorSpire keystone.
- s15: steamLance x3.
- Repeat windows are read as `post.repeat`, the keystone window as `post.keystone`. Gates `postMachineMaxMs` and
  `postFrameP95Ms` (GPU only) take the max over them.

Finale (fresh context): buy list S15 + `primaryFunction`, then `finaleSeek` to t 8, 22, 34 and 36, 2 s window each:
`finale.t<n>` = `finaleMeanMs`, `machineMeanMs`, `machineMaxMs`, `uiMeanMs`, `uiMaxMs`, `displayObjects`. Gate
`finaleMeanMs` = worst point.

Audio eras: s7 / s9 / s11 / s13 / s15 expect era 1 / 2 / 3 / 4 / 5 (`audioEra <stage> <got> != <want>` fails).
s16_postgame expects theme `restored` (`audioTheme` fails).

Renderer: `metrics.renderer` = `{ renderer, vendor, software }` from a probe canvas (not the game canvas), read on the first
page load. `software` is true for SwiftShader, llvmpipe or basic render.

Gate values: stage means and maxes gate on the median of the 3 windows (raw per-window max in `machineMaxMsRaw` /
`uiMaxMsRaw`). `displayObjects` = max of s15, s16 and finale t34. Audio = max over running samples only. Every probe is
null-safe: a missing hook field reports `null` and never fails the run.

Single-run JSON keys: `metrics.gate`, `metrics.stages.<stage>`, `metrics.finale.t<8|22|34|36>`, `metrics.techTree`,
`metrics.heap`, `metrics.cycle`, `metrics.frames` (`n`, `p50Ms`, `p95Ms`, `gated`), `metrics.boot`, `metrics.renderer`,
`metrics.audioWiring`.

### Median of 3 (every reported number)

Run two halves, three times each. Half A = `s0_crank,s7_era1_full,s9_era2_full,s11_era3_full`. Half B =
`s13_era4_full,s15_era5_full,s16_postgame,finale`. Each command is its own Bash call with a 10 minute timeout
(`timeout` 600000). `PERF_GPU=1` on all six. If a run fails with `gpu requested but renderer is software`, re-run that
half with `PERF_HEADED=1`.

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright PERF_GPU=1 ONLY=s0_crank,s7_era1_full,s9_era2_full,s11_era3_full node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-1-a
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright PERF_GPU=1 ONLY=s13_era4_full,s15_era5_full,s16_postgame,finale node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-1-b
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright PERF_GPU=1 ONLY=s0_crank,s7_era1_full,s9_era2_full,s11_era3_full node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-2-a
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright PERF_GPU=1 ONLY=s13_era4_full,s15_era5_full,s16_postgame,finale node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-2-b
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright PERF_GPU=1 ONLY=s0_crank,s7_era1_full,s9_era2_full,s11_era3_full node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-3-a
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright PERF_GPU=1 ONLY=s13_era4_full,s15_era5_full,s16_postgame,finale node scripts/smoke/perf.mjs "http://localhost:4174/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-3-b
node scripts/perf/perf-median.mjs C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-*-a/perf.json C:/Users/<you>/AppData/Local/Temp/smoke/perf/gpu-*-b/perf.json > C:/Users/<you>/AppData/Local/Temp/smoke/perf/median.json
node scripts/perf/perf-tables.mjs C:/Users/<you>/AppData/Local/Temp/smoke/perf/median.json
```

- `median.json` = `{ runs, renderers, gpu, gate, stages, finale, boot, budgets, audioWiring, fail }`. `gpu` is true only when
  every input ran with `PERF_GPU=1`. Each stage holds `n` (inputs that had it, 3 expected).
  `gate.frameP95Ms` and `gate.postFrameP95Ms` are the MAX of the per-stage median p95 values (conservative, not a pooled p95).
- perf-median gates with the `perf-budget.json` values only; `PERF_*` overrides are not read there. `fail` = gate breaches,
  carried run failures (`audioEra`, `audioTheme`, `audioWiring`, `gpu`, `errors`) and error counts per file.
- `PERF_STRICT=1 node scripts/perf/perf-median.mjs ...` exits 1 when `fail` is non-empty (the JSON is still printed).
- `perf-tables.mjs <median.json>` prints the markdown tables to stdout.

### Bundle budget

```
npm run build && node scripts/perf/bundle-budget.mjs
```

npm script `perf:bundle` runs the second command (`npm run build && npm run perf:bundle` is the same). Reads
`dist/assets`; another dist dir can be passed as the argument. Decimal KB, raw sizes only (program D7):

| check | files | limit |
|---|---|---|
| app js raw | `index-*.js` | <= 500 KB (`appRawKb`) |
| phaser js raw | `phaser-*.js` | <= 1500 KB (`phaserKb`) |
| lazy world js raw | `LivingWorldDirector-*.js` | <= 80 KB (`lazyWorldKb`, WP23a) |
| css raw | `*.css` | <= 45 KB (`cssKb`) |
| public assets | `public/assets` total | <= 8000 KB (`publicAssetsKb`) |

The gzip size of the app chunk is printed with status `report` and never breaches. A raw breach prints `BREACH` and exits 1.

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
- `restoredTextures()` (WP18b): `{ swapped, total }` of the World machine: `swapped` = ids of the parts (of the 33 that have an A17 restored variant) whose sprite texture key contains `#restored`, `total` = 33. `null` before the world scene exists.
- `textureKey(id)` (WP18b): the sprite texture key of one machine part, e.g. `machine.nullCore#restored#rot`; `null` without a machine or sprite.
- `setPlateCap(maxTech)` (WP16b-3): caps the World name plate frame and the HUD plaque line at a plate gate tech. `'substationBlueprint'` gives plate frame 2 (`RES?OR?`) and the plaque `PRIMARY FUNCTION: RES?OR?` (the demo teaser cap, `EDITIONS.demo.capTech`). `null`, or a tech that is not a plate gate, clears the cap. Returns the cap in force; `null` without a World scene. Rendering only: session, save and display levels are unchanged. A page reload clears it. The cap wins over the finale ending frame, so a capped postgame plate reads `RES?OR?`. `store-shots.mjs` uses it.
- `plateCap()` (WP16b-3): the cap in force, or `null` (no cap, or no World scene).
- `cameraState()` and `finaleState().frame.completeEra` are the existing readouts used by the WP18 keys.

`showcase.mjs` (WP18 final machine showcase: finale survey, portrait, photo mode, teaser): `PW_PATH=$PW node scripts/smoke/showcase.mjs http://localhost:4173/ <outdir>`. Playwright viewport 1280 x 720 at `deviceScaleFactor` 3, so every PNG is 3840 x 2160. Each PNG size is read from its IHDR bytes; a mismatch goes to `errors`. Prints ONE JSON `{ showcase_*, shots, errors }` on stdout; `errors` must be empty. Writes 14 PNG files. Run order: A, B, C, D, D2, C2, F, E. B, C, D, D2, C2 and F run in one browser context (one game); A and E each open a fresh context. A run that throws adds `showcase_FAILED_<run>` and an entry in `errors`. Console warnings matching `[assets] failed to load`, `[assets] size mismatch` or `has no frame` also go to `errors` (WP18b).

Shots (14 PNG files in `<outdir>`):
- `a_era5_ruined`: run A, photo mode with the hint off, real levels, HUD hidden. Taken with the pointer not moved (`still`).
- `b_k2_5`, `b_k3_9`, `b_k5_4`, `b_k6_9`, `b_k41_5`, `b_k45_2`, `b_k56`: run B finale keyframes. `b_k2_5` is t 2.0 (before the completion beat at t 3; the key keeps its name); `b_k3_9` / `b_k5_4` / `b_k6_9` show the completion beat (eras 3 / 4 / 5); `b_k41_5` / `b_k45_2` are the survey holds (baseL / baseR); `b_k56` is shot S4 with the portrait camera.
- `c_postgame_portrait`: run C, postgame, canonical portrait pose.
- `d_photo_postgame`: run D, VIEW MACHINE photo mode in postgame, pointer not moved.
- `d_photo_crown`: run D2, postgame photo mode driven by real keys from the portrait (`=` x4, ArrowRight x2, ArrowUp x6): camera (2048, 696, 1.5) = 3 screen px per art px on the crown (aperture top, lens, null chamber, core, siphons, crystal, gallery). Chip blurred, pointer not moved.
- `e_teaser_era2`: run E, teaser 300 ms after play (era II); `e_teaser_assembling`: teaser at t 3 or later (era IV parts assembling); `e_teaser_end`: teaser done (aperture open, portrait).

Main assertions (run order):
- Run A (fresh context): 45 crank clicks, then the full S15 buy list, 15 s wait for the era V sky, `photoMode(true, { hint: false })`, 1.2 s settle. Asserts: every buy ok; `partsVisible().hidden` subset of `['inversionGhost']`; `photoState().active`; `#hud-panel` visibility `hidden`; camera (1920, 1080, .5). Then the exit chip is blurred and polled up to 3 s (`waitChipHidden`) until its computed opacity is <= 0.001 (the 300 ms fade is slow in 4K headless): `#photo-exit` opacity <= 0.001; `restoredTextures().swapped` is 0 of 33 (era V, no finale).
- Run B (fresh context): 45 crank clicks, then the GREEDY buy list (copperWinding x10, firebox x10, harmonicCoil x16, containmentRing x16, bellowsDrive x3, gridExciter x5, horizonField x10, `@resonantSiphon:11`, `@graviticAnchor:4`, `@finalAlignment`; no mainsBackfeed, no steamLance). Asserts: every buy ok. Then 15 s wait, buy `primaryFunction` (asserts ok), and `finaleSeek` steps (300 ms settle unless noted):
  - `b_k2_5` (t 2.0, 150 ms settle, `partsVisible()` read before `finaleState()` because the film clock keeps running; asserts t < 3): completeEra 0; at least 6 hidden parts, including `siphonTube3L`, `coilStage3`, `steamLance`.
  - `b_k3_9`, `b_k5_4`, `b_k6_9` (250 ms settle, the film clock keeps running): completeEra 3 / 4 / 5; `coilStage3` shown at 3.9, `coilRing4` shown at 5.4; hidden subset of `['inversionGhost']` at 6.9; the real `resonantSiphon` level stays 11 (the completion beat is display only).
  - `b_k41_5` (baseL hold): camera (1320, 1380, 1).
  - `b_k45_2` (baseR hold): camera (2520, 1380, 1). Seek 45.2 so the settle stays inside the 45.0-46.0 hold.
  - `b_k56` (shot S4): camera portrait (1920, 1080, .5).
  - `restoredTextures().swapped.length` is 0 at `b_k2_5`, `b_k3_9`, `b_k5_4`, `b_k6_9` and 33 at `b_k41_5`, `b_k45_2`, `b_k56` (the swap starts with the name-plate beat at t 30).
- Run C (same context): `skipFinale`, KEEP IT RUNNING, wait for the stored phase `postgame` (3 s poll), 2.5 s settle. Asserts: phase `postgame`; `#hud-title` `RESTORATION ENGINE`; name plate frame 5; camera portrait; hidden subset of `['inversionGhost']`; `#hud-view-machine` shown with width and height > 0. Restored accent: swapped 33 of 33; texture keys nullCore `machine.nullCore#restored#rot`, ring1Bead `machine.ringBead#restored`, aperture `machine.aperture#restored`; frames generatorGlow 3, crystal 2, lensLight 3, anchorGlow1L 2.
- Run D (same context): focus `#hud-view-machine`, Enter, 3.2 s. Asserts: photo active with hint false; modalCount 1; `#hud-panel` visibility `hidden`; the focused exit chip is shown (opacity 1) when it matches `:focus-visible` (WP18b), then it is blurred and polled until hidden (opacity <= 0.001) before the shot `d_photo_postgame`. Then a 200 px drag must change centerX, wheel -100 must raise zoom, ArrowRight must change centerX. Escape ends photo mode: photo inactive, camera portrait, `#hud-panel` visible, modalCount 0.
- Run D2 (same context, WP18b): focus `#hud-view-machine`, Enter, 1.5 s, blur the chip and poll until hidden; press `=` x4, ArrowRight x2, ArrowUp x6 (80 ms apart), 3.2 s, no mouse move. Asserts: photo active with hint false; camera (2048, 696, 1.5); chip opacity <= 0.001 (polled); swapped 33 of 33; crystal frame 2; shot `d_photo_crown`. Escape: photo inactive, camera portrait.
- Run C2 (same context): reload. Asserts: phase `postgame`; camera portrait; hidden subset of `['inversionGhost']`; swapped 33 of 33 after the reload into postgame.
- Run F (same context, no shot): VIEW MACHINE with Enter (hint off), ArrowRight re-arms the hint (hint on), `t` opens the tech tree. Asserts: photo inactive, tech tree open, modalCount 1, focus on `#tech-close` (not back on the HUD button). Escape closes the tree: modalCount 0. After Esc closes the tree, focus must be on `#hud-view-machine` or `#hud-tech` (never body); techTree.close() falls back there when the opener (the hidden photo exit chip) is no longer rendered.
- Run E (fresh context, `#ui-root` visibility hidden): `showcasePlay()`, 300 ms, era 2 (shot `e_teaser_era2`). Then `showcaseSeek(2.2)` and poll until t >= 3 (60 s cap); shot `e_teaser_assembling`. Then `showcaseSeek(6.5)` and poll until done (60 s cap), 600 ms settle; shot `e_teaser_end`. Asserts: done, era 5, apertureOpen, hidden subset of `['inversionGhost']`, camera portrait, real `session.state.techLevels.generator` still 0. Then `showcaseStop()`: `showcaseState()` null, and one crank click raises `totalClicks` by exactly 1.
- Teaser time never comes from wall time: each step seeks, then polls with a long cap, so a slow headless frame rate only costs wall time.

Result keys: `showcase_A`, `showcase_B_k2_5`, `showcase_B_k3_9`, `showcase_B_k5_4`, `showcase_B_k6_9`, `showcase_B_k41_5`, `showcase_B_k45_2`, `showcase_B_k56`, `showcase_C`, `showcase_D`, `showcase_D2`, `showcase_C2`, `showcase_F`, `showcase_E_era2`, `showcase_E_assembling`, `showcase_E_end`, `showcase_E_stop`.
Note: frame max spikes come from CPU contention in the container, so the stage max gates use the median of the 3 windows; the raw max stays in the report.

## WP21 Steam demo edition smokes (`demo.mjs`, `demo-cases.mjs`)

Runs against the DEMO build: era cap at Substation Blueprint (era II), END OF DEMO card, final-machine teaser. Serve the
demo build on its own port. Port 4175 keeps the production dist, so never use it here.

```
npm run build:demo
npx vite preview --outDir dist-demo --port 4176 --strictPort    # background; stop it after the run
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/demo.mjs "http://localhost:4176/" C:/Users/<you>/AppData/Local/Temp/smoke/demo
```

- Base URL WITHOUT query. Each case adds its own (`?debug=1`; case A uses `?debug=1&title=1`).
- Prints ONE JSON `{ results, fail, errors }`. Exit code 1 when `fail` or `errors` is non-empty; expect both `[]`.
- Viewport 1280x720, `deviceScaleFactor` 1, fresh context per case. Wishlist popups are answered offline (route on
  `store.steampowered.com`). Timeouts: waiting to teaser 8000 ms, teaser to card 60000 ms.
- `demo.mjs` runs A, then B with C in the same page, then D, E, F. `demo-cases.mjs` holds C to F.

| case | what |
|---|---|
| `A` | fresh start: title (`#title-version` = `v0.9.0 · DEMO · SAVE v2`), tech tree (5 tabs, eras III to V FULL GAME), SYSTEM menu (footer, no MEMORY tab, no DEMO ENDING row, RECORDS `/18`) |
| `B` | reach the cap (S9 list + Substation Blueprint): waiting, teaser, card, wishlist, keep, tree after, SYSTEM row |
| `C` | same page as B: reload with the cap owned, boot card, replay and skip |
| `D` | reduced motion: portrait teaser and card |
| `E` | clamp of a full-game save (era III levels, ending engaged, Echoes) that keeps an era II level (`copperWinding` 2), and its backup key |
| `F` | boot where the offline catch-up crosses the cap: the stored save has the cap reset (`substationBlueprint` 0) and lifetime EE just under 4M, saved 1 h ago, so the boot teaser plays (`F_cap_not_yet` is read from the stored save) |

Checks `A`: `A_title_demo`, `A_tabs_full_game`, `A_era3_refused` (`purchase('boiler')` reason `demo`), `A_footer_demo`,
`A_memory_hidden`, `A_demo_row_hidden`, `A_records_18`.

Checks `B`: `B_s9_buys`, `B_cap_owned`, `B_waiting`, `B_boiler_locked`, `B_teaser_started` (detail: ms since the cap, at
least 3800), `B_caption` (`PRIMARY FUNCTION: RES?OR?`), `B_hud_hidden`, `B_no_spoiler`, `B_teaser_to_card`, `B_era3_seen`,
`B_teaser_end`, `B_card_open`, `B_card_title`, `B_card_focus`, `B_quit_hidden`, `B_feedback_hidden`, `B_tab_trap`,
`B_wishlist`, `B_keep`, `B_keep_crank`, `B_hud_rows` (2 rows), `B_tree_after`, `B_system_row`, `B_esc_keeps`, `B_plate_redacted`
(the live World name plate frame is 2 and every teaser sample, card included, shows the same frame), `B_keep_focus` (case B opens the tree with the TECH INDEX button; after KEEP, focus is back on `#hud-tech`, visible and outside `#tech-overlay`). Notes, not
failures: `B2_missed` / `B3_missed` (the era V or end teaser shot was not caught at a sample).
Check `D_plate_redacted` (case D, card open): the teaser plate frame is 2 (RES?OR?) under reduced motion too.

Screenshots in the outdir: `demo-A1-title.png`, `demo-A2-tree.png`, `demo-A3-menu.png`, `demo-B1-teaser-era3.png`,
`demo-B2-teaser-era5.png`, `demo-B3-teaser-end.png`, `demo-B4-card.png`, `demo-B5-keep.png`, `demo-C1-boot-card.png`,
`demo-D1-reduced.png`, `demo-F1-boot-teaser.png`.

Save edits (cases E and F): `kit.editOnNextLoad(page, ops)` puts the ops in sessionStorage `wedtmd.smokeEdit`, e.g.
`[{ path: 'state.techLevels.boiler', set: 1 }, { path: 'state.lastSimTime', add: -3600000 }]`. `set: '$lastSimTime'` means
the save's own lastSimTime. `'$lastSimTime'` works only as the whole value of an op, so address the field itself (for example `state.ending.engagedAt`), never inside an object value. A generic init script on every context applies the ops to `localStorage['wedtmd.save']`
before the app boots, then removes the flag, so it runs once. A direct localStorage edit would not work: the pagehide
flush rewrites the save on reload. The edited string is kept in sessionStorage `wedtmd.smokeEditS`; `kit.editedSave(page)`
returns it.

## WP21 changes to the earlier smokes

- `ux.mjs` WP21 checks: `A_toast_clear_tabs` (case A: at most one toast, none over an era tab, CLOSE or PURCHASE);
  `D_<s>_buy_visible` (PURCHASE has a size, sits inside the tech panel, the detail pane and the viewport, and is the
  element hit at its centre); `D_<s>_buy_visible_e2` (the same after era II and `powerLines`); `D_<s>_toast_clear_tabs`
  (after a `copperWinding` buy). Shot `ux-D-<s>-tree-e2.png` (`<s>` = 100 and 150).
- `desktop.mjs` with `DESKTOP_EDITION=demo`: for the demo exe (`npm run build:steam-demo`, `out/steam/demo/win-x64/`). It
  expects the DEMO version line `v0.9.0 · DEMO · SAVE v2` and adds check `8_demo_tabs` (the era cap tabs). The default
  `full` edition is unchanged.
- Debug hook `window.__wedtmd.demoState()` returns `{ edition, phase, capReached, cardOpen, teaserActive, caption }`, or
  `null` when the demo controller is absent (full game). `phase` is `idle`, `waiting`, `teaser` or `card`.

## Release verification smokes (WP16a)

Release gate smokes: two shared libraries and four browser runs. Same rules as the smokes above (Node `.mjs`, Playwright through `PW_PATH`, never starts a server).

- Base URL WITHOUT a query: `"<preview>/"` (trailing slash). Each script adds its own query (`debug=1`, or `debug=1&title=1`).
- Outdir: absolute path. Each browser script writes `<outdir>/<name>.json` and prints the same JSON object to stdout (`e2e-full.json`, `a11y.json`, `soak.json`, `store-shots.json`).
- Exit codes: `0` ok; `1` when `fail` or `errors` is non-empty; `2` usage error (missing arguments, bad env value, `PW_PATH` unset).
- Every script clicks the crank at least 45 times before its first buy list (`wornMotor` costs 40 ME).
- Do not rebuild `dist` while a smoke runs. The preview server re-reads `dist` on every request, so a rebuild mid-run changes the game under the smoke.

### Shared libraries

`scripts/smoke/lib/common.mjs`: Node built-ins only. Importing has no side effects and needs no `PW_PATH`.

| Export | Meaning |
|---|---|
| `S7`, `S9`, `S11`, `S13`, `S15` | Cumulative buy lists per era (copies of the `stages.mjs` lists). |
| `STAGES` | `[['s7', S7], ['s9', S9], ...]` in play order. |
| `ERA_TITLES` | Expected HUD era title per stage (`ERA I · MECHANICAL` ... `ERA V · ???`). |
| `HUD_ROWS` | Expected visible HUD resource rows per stage (1, 2, 3, 4, 5). |
| `LEGACY_FEEDS` | Legacy energy feed parts: `bellowsDrive`, `gridExciter`, `mainsBackfeed`, `steamLance`. |
| `ASSET_WARNING_RE` | Asset loader console warnings that count as errors. |
| `GPU_ARGS` | Chromium flags for `SOAK_GPU=1` (`--use-angle=d3d11`, `--enable-gpu`, `--ignore-gpu-blocklist`). |
| `PREVIEW_HINT` | `http://localhost:4174/` (the preview URL; never started by a smoke). |
| `delta(prev, next)` | Items of `next` after the `prev` prefix. Throws when `prev` is not a prefix. |
| `withQuery(base, params)` | URL with the given query parameters set. |
| `loadChromium()` | Playwright chromium from `PW_PATH`. Exits 2 when unset. |
| `readBudget()` | Parsed `scripts/smoke/perf-budget.json`. |
| `makeReport()` | `{ results, fail, errors, check(name, cond, detail) }`. A failing name goes to `fail` once. |
| `watchPage(page, errors, tag)` | Records console errors, asset warnings, page errors, failed requests and HTTP >= 400. |
| `waitReady(page, timeoutMs)` | Waits for the debug hook and the hand crank, then a 400 ms settle. |
| `crankClicks(page, n, gapMs)` | `n` real mouse clicks on the hand crank. |
| `buyInPage(buys)` | Buy runner for `page.evaluate`. Entries: `<techId>`, `@<techId>:<n>`, `@<techId>`, `@blueprint`. Returns `<entry>:<bool>` per entry. |
| `buyList(page, buys)` | Runs `buyInPage`; returns the failed entries (`[]` = every buy worked). |
| `dismissEraCard(page)` | Clicks `#era-card` away when it is open. |
| `hudState(page)` | `{ title, visibleRows, frontier, click, clickSub, auto, right, bottom }`, or `null` on error. |
| `poll(page, fn, arg, capMs, stepMs)` | Re-evaluates `fn(arg)` in the page until truthy or the cap; returns the last value. |
| `waitPhotoChipHidden(page, capMs)` | Blurs `#photo-exit`, polls its opacity to <= 0.001. Returns the final opacity. |
| `pngSize(file)` | `{ width, height }` from the PNG IHDR. Throws when the file is not a PNG. |

Self-test (pure, no browser): `node scripts/smoke/lib/common.mjs --selftest`. Prints one line `{ ok, checks }`; exit 0 when every check holds. Checks: `prefix_s7_s9`, `prefix_s9_s11`, `prefix_s11_s13`, `prefix_s13_s15`, `delta_length`, `delta_reverse_throws`, `with_query`, `png_gear_small_40`, `budget_heap_150`.

`scripts/smoke/lib/a11y-audit.mjs`: page audit, Tab walker, focus log and WCAG maths. Never imports Playwright.

- `DEFERRED_SCOPES` = `[]` since WP16b-2: the tree (`#tech-overlay`), toast (`#toast-stack`) and era card (`#era-card`) scopes gate now. The export stays for later packages; a scope listed there routes its findings to `deferred` (report-only).
- `auditScope(page, scopeSel)` returns `{ rootCount, checked: { controls, text }, unnamed, small, contrast, deferred, inactive, indeterminate }`. Only visible elements are audited, and elements inside `.is-fading` (a toast or era card leaving) are skipped. Item kinds:
  - `unnamed`: a control (button, link, input, tab, radio, ...) with no accessible name (aria-label, aria-labelledby, label, own text, title).
  - `small`: text below 12 px (`fontPx`).
  - `contrast`: text below its WCAG ratio.
  - Each item: `{ kind, sel, text, ratio, need, fontPx }`.
- WCAG 1.4.3: normal text >= 4.5:1; large text (>= 24 px, or >= 18.66 px at weight >= 700) >= 3:1. The foreground alpha and the opacity of the element and its ancestors count. The background is the composite of the layers from the element outwards up to the first opaque layer. Gradient backgrounds use the minimum ratio over all colour stops.
- `inactive`: contrast items inside `:disabled`, `[aria-disabled="true"]` or `.is-locked` are exempt. They are listed here and never fail.
- `deferred`: items of any kind inside a `DEFERRED_SCOPES` scope. Report-only; empty since WP16b-2 (`DEFERRED_SCOPES` is `[]`). Items that are D8-exempt inactive text (disabled, `aria-disabled`, `.is-locked`) carry `inactive: true`; skip those when fixing.
- `indeterminate`: text with no parseable colour, or with no opaque background before body. `ratio` is `null`. Report-only. These are listed as they are, whatever the scope.
- Other exports: `tabWalk(page, n, scopeSel = null, key = 'Tab')` (`key` n times, `'Tab'` or `'Shift+Tab'`, 60 ms apart; each record has `tag`, `id`, `cls`, `tech`, `ring`, `named`, `inScope`). A ring is an outline >= 1 px or a box-shadow. `missingFocus(page, containerSel)` (visible enabled controls the focus log never saw; a radio group counts once). `installFocusLog`, `resetFocusLog`, `focusId`, `setUiScale(page, pct)`, `rectInViewport(page, sel, tolPx)`. Pure helpers: `parseCssColor`, `compositeOver`, `relativeLuminance`, `contrastRatio`, `neededRatio`.
- Self-test (pure, no browser): `node scripts/smoke/lib/a11y-audit.mjs --selftest`. Prints one line `{ ok, checks, values }`; exit 0 when all 22 checks hold (contrast maths, colour parsing, `deferred_scopes_empty`, `ink_on_amber_6_43`, `ink_on_amber_dim_6_49`, `sand_on_rust_dark_6_12`). Without the flag it prints usage and exits 2.

### e2e-full.mjs

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/e2e-full.mjs "<preview>/" C:/Users/<you>/AppData/Local/Temp/smoke/e2e
```

One run, one fresh 1280x720 context, from the title screen to a new cycle and a reload. Real keyboard and mouse input throughout. Each step has its own guard and one screenshot. A step exception adds `FAILED:<NN>_<name>:<first line>` to `fail` and the run goes on. Wall time limit: 300000 ms.

| Step | Screenshots (`e2e-<NN>-<name>.png`) | Check names | Expect |
|---|---|---|---|
| 01 title | `01-title` | `01_title_open`, `01_continue_hidden`, `01_new_focused` | title open; CONTINUE hidden on a fresh profile; NEW GAME focused |
| 02 newgame | `02-newgame` | `02_title_closed`, `02_clicks` | Enter closes the title; 30 clicks (20 crank + 10 Space) |
| 03 tree | `03-tree` | `03_tree_open`, `03_reached_gearRatio`, `03_bought_gearRatio`, `03_tree_closed` | tree opens; Gear Ratio reached by Tab and bought (level 1); tree closes |
| 04 save | `04-save` | `04_saved` | SYSTEM > SAVE stores `gearRatio` 1 |
| 05 continue | `05-continue` | `05_continue_focused`, `05_progress_kept` | CONTINUE focused after reload; gearRatio 1 and 30 clicks kept |
| 06 eras | `06-eras`, `06-s7`, `06-s9`, `06-s11`, `06-s13`, `06-s15` | `06_<key>_buys`, `06_<key>_title`, `06_<key>_rows`, `06_<key>_displayObjects` (`<key>` = `s7`, `s9`, `s11`, `s13`, `s15`) | buy list all ok; HUD title = `ERA_TITLES[key]`; visible rows = `HUD_ROWS[key]`; display objects <= 500 |
| 07 finale | `07-finale`, `07-finale-mid` | `07_buy`, `07_sequence`, `07_choice`, `07_keep_visible` | `primaryFunction` bought; sequence runs; Escape reaches the choice; KEEP visible |
| 08 keep | `08-keep` | `08_postgame`, `08_title` | KEEP IT RUNNING enters postgame; HUD title `RESTORATION ENGINE` |
| 09 view | `09-view`, `09-view-photo` | `09_photo_on`, `09_hud_hidden`, `09_photo_off`, `09_hud_back` | VIEW MACHINE hides the HUD; Escape restores it |
| 10 newcycle | `10-newcycle`, `10-newcycle-confirm` | `10_menu_open`, `10_row_enabled`, `10_confirm_open`, `10_cycle2`, `10_cycle_label`, `10_fresh_run`, `10_crank_works` | BEGIN A NEW CYCLE, confirm, cycle 2; label contains `CYCLE 0043`; fresh run; crank works |
| 11 reload | `11-reload` | `11_cycle_kept`, `11_label_kept` | SAVE, reload, CONTINUE: cycle 2 and label kept |
| 12 footer | `12-footer` | `12_footer` | SYSTEM footer text starts with `v0.9.0` |
| run | none | `wall_time` | `wallMs` <= 300000 |

Outputs:
- `<outdir>/e2e-full.json` (same object as stdout): `results` (per check: boolean, or `{ ok, value }` when a detail is recorded), `metrics` (per stage `s7`..`s15`: `displayObjects`, `machine` = `machineStats()`, `heapMb`), `wallMs`, `fail`, `errors`.
- Screenshots as listed above (`e2e-<NN>-<name>.png`, one guard shot per step plus the extra shots).
- Exit 1 when `fail` or `errors` is non-empty; 2 on missing arguments. A setup failure appears as `FAILED:setup:<msg>`.

### a11y.mjs

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/a11y.mjs "<preview>/" C:/Users/<you>/AppData/Local/Temp/smoke/a11y
```

Cases. Each case adds its own query. A, E, F, G and H each open a fresh 1280x720 context; B, C and D share one context.

| Case | Scope | What it does |
|---|---|---|
| `A_title` | `#title-screen` | Tab 8 times from NEW GAME; audit the title |
| `A_credits` | `#credits-overlay` | Opens CREDITS from the title; Escape returns to the title |
| `B_hud` | `#ui-root` | 10 Space presses (10 clicks), 10 crank clicks; Tab 6 times through the HUD |
| `C_tree` | `#tech-overlay` | `t`; focus on the selected node (`C_focus_selected`); Tab 30 times inside the overlay (`C_trap`); CLOSE focused, Shift+Tab 3 times (`C_trap_back`); audit the tree |
| `D_menu` | `#system-menu` | SYSTEM menu; Tab 12 times; every visible SYSTEM tab (`<tab>`) audited |
| `E_reduced` | `#ui-root` | Reduced motion on; RESET confirm opened; no running CSS animation |
| `F_finale` | `#finale-overlay`, `#photo-exit`, `#system-menu`, `#cycle-confirm` | Finale choice, postgame, photo mode, MEMORY tab, cycle confirm |
| `G_scale150` | title, credits, HUD, tech tree, SYSTEM tabs | UI scale 150 after a reload; every panel inside the viewport |
| `H_cards` | `#era-card`, `#tech-overlay`, `#toast-stack` | After the S9 buy list: era card audited (`H_card`); tree tab 2 (`H_tree2`) and tab 1 (`H_tree1`: the purchased `generatorBlueprint` milestone node and >= 3 purchased nodes) audited; one `copperWinding` purchase toast audited (`H_toast`, names not checked) |

Check names (`<tab>` = each visible SYSTEM tab: `system`, `settings`, `stats`, `records`, `memory`, `data`; a fresh game showed `system`, `settings`, `stats`, `records`, `data`; `memory` appears later):

| Case | Check names |
|---|---|
| `A_title` | `A_reach`, `A_trap`, `A_rings`, `A_names`, `A_contrast`, `A_font12` |
| `A_credits` | `A_credits_trap`, `A_credits_rings`, `A_credits_names`, `A_credits_contrast`, `A_credits_esc` |
| `B_hud` | `B_space_crank`, `B_reach`, `B_rings`, `B_names`, `B_contrast`, `B_font12` |
| `C_tree` | `C_focus_selected`, `C_reach`, `C_trap`, `C_trap_back`, `C_rings`, `C_names`, `C_contrast`, `C_font12` |
| `D_menu` | `D_system_reach`, `D_trap`, `D_rings`; per tab: `D_<tab>_reach`, `D_<tab>_rings`, `D_<tab>_names`, `D_<tab>_contrast`, `D_<tab>_font12` |
| `E_reduced` | `E_root_attr`, `E_no_animations` |
| `F_finale` | `F_buys`, `F_choice_reach`, `F_choice_trap`, `F_choice_rings`, `F_choice_names`, `F_choice_contrast`, `F_choice_font12`, `F_choice_150_inside`, `F_postgame`, `F_post_reach`, `F_photo_reach`, `F_photo_ring`, `F_photo_name`, `F_memory_names`, `F_memory_contrast`, `F_memory_font12`, `F_memory_150_inside`, `F_confirm_reach`, `F_confirm_trap`, `F_confirm_rings`, `F_confirm_names`, `F_confirm_contrast`, `F_confirm_font12`, `F_confirm_150_inside`, `F_confirm_cancel` |
| `G_scale150` | `G_title_inside`, `G_credits_inside`, `G_hud_inside`, `G_tree_inside`, `G_menu_<tab>_inside` |
| `H_cards` | `H_buys`, `H_card_shown`, `H_card_names`, `H_card_contrast`, `H_card_font12`, `H_tree2_names`, `H_tree2_contrast`, `H_tree2_font12`, `H_tree1_milestone`, `H_tree1_purchased`, `H_tree1_names`, `H_tree1_contrast`, `H_tree1_font12`, `H_toast_shown`, `H_toast_contrast`, `H_toast_font12` |

Check meanings: `_reach` = every required control reached by Tab (`C_reach`: `tech-close` and `tech-buy` reached, >= 3 node ids, >= 1 tab). `_trap` = every Tab press stays inside the scope (`C_trap_back`: three Shift+Tab presses from CLOSE stay inside `#tech-overlay` and the first stop is not CLOSE). `C_focus_selected` = focus on the selected tech node after `t`. `_rings` = every focus target (not body) shows a focus ring. `_names` = no unnamed control. `_contrast` = no text below its WCAG ratio. `_font12` = no text below 12 px. `_inside` = element rect inside the 1280x720 viewport at UI scale 150 (1 px tolerance). `D_system_reach` is reused by the `system` tab: the first failure is kept. `A_credits` has no `_font12` check.

`settleOverlays(page)` (WP16b-2 helper, run before the `B_hud`, `C_tree`, `H_card`, `H_tree2` and `H_toast` audits): polls (3 s cap, 100 ms step) until no `#toast-stack .toast` and no `#era-card` has `.is-fading` or a running CSS animation. The milestone toast's `toast-pulse` animation is ignored.

Deferred and report-only semantics:
- `deferred` is empty since WP16b-2: `DEFERRED_SCOPES` is `[]`, so the tree (`#tech-overlay`), toast and era-card scopes gate and their findings fail. Expected run: `fail []`, `errors []`, `deferred []`.
- The milestone toast (gradient with a translucent top over the canvas) stays `indeterminate` (report-only, never fails).
- Inactive items (`:disabled`, `[aria-disabled="true"]`, `.is-locked`) stay exempt: they go to `inactive` and never fail. `inactive` and `indeterminate` (no colour or no opaque background) are report-only.

Outputs:
- `<outdir>/a11y.json` (2-space JSON, same as stdout): `results`, `fail`, `deferred`, `inactive`, `indeterminate` (each audit item carries `at`, the case label), `errors`.
- Screenshots: `a11y-A-title.png`, `a11y-A-credits.png`, `a11y-B-hud.png`, `a11y-C-tree.png`, `a11y-D-menu-<tab>.png`, `a11y-E-reduced.png`, `a11y-F-choice.png`, `a11y-F-photo.png`, `a11y-F-memory.png`, `a11y-F-confirm.png`, `a11y-G-menu.png`, `a11y-H-card.png`, `a11y-H-tree2.png`, `a11y-H-tree1.png`, `a11y-H-toast.png`.
- Failure keys: `FAILED:<case>:<first line>` (`<case>` = `A_title`, `A_credits`, `B_hud`, `C_tree`, `D_menu`, `E_reduced`, `F_finale`, `G_scale150`, `H_cards`) or `FAILED:run:<first line>`.
- Exit 1 when `fail` or `errors` is non-empty; 2 on missing arguments.

### soak.mjs

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright SOAK_MIN=5 node scripts/smoke/soak.mjs "<preview>/" C:/Users/<you>/AppData/Local/Temp/smoke/soak
```

Env vars:

| Variable | Default | Rule |
|---|---|---|
| `SOAK_MIN` | `30` | Run length in minutes, minimum 2. |
| `SOAK_SAMPLE_S` | `30` | Seconds between samples, minimum 5. |
| `SOAK_GPU` | unset | `1` = launch with the real GPU (`GPU_ARGS`, ANGLE d3d11). |

A bad value exits 2 with the usage line. Chromium runs with `--js-flags=--expose-gc` (gc before each sample) and `--enable-precise-memory-info`. The validation run is `SOAK_MIN=5`. The 30 to 60 minute run belongs to WP16b.

Setup: `?debug=1`; 45 crank clicks; the S15 buy list (check `setup_buys`); 15 s wait; era card dismissed.

Action schedule (loop tick 250 ms; each task runs when due, never overlapping):

| Task | First at | Then every | Action |
|---|---|---|---|
| crank | 2 s | 2 s | One real mouse click on the hand crank. |
| buy | 15 s | 30 s | One legacy feed buy in turn (`bellowsDrive`, `gridExciter`, `mainsBackfeed`, `steamLance`). A rejected buy gets one 8 h time jump, then one retry. |
| tech | 20 s | 60 s | `t`, 1.5 s, Escape. |
| menu | 40 s | 90 s | Escape until no modal, Escape, click `#sys-tab-stats`, 1 s, Escape. |
| sample | 0 s | `SOAK_SAMPLE_S` | Escape until no modal (max 3), gc(), then the probes. |

The final sample runs after the loop, then `soak-end.png`.

Probes per sample: `heapMb` (`performance.memory`), `displayObjects`, `toasts` (`#toast-stack .toast`), `domNodes`, `liveVoices` (`audioStats()`, `null` when absent), `machineMeanMs`.

Limits. Baseline = first sample with `tSec` >= 60; last = final sample. Results land in `limits` as `{ value, limit }`.

| Check | Rule | Limit (source) |
|---|---|---|
| `heap_cap` | max `heapMb` <= limit | 150 MB (`perf-budget.json` `heapMb`) |
| `heap_growth` | last - baseline `heapMb` <= limit | 16 MB (`SOAK_LIMITS.heapGrowthMb`) |
| `heap_slope` | least-squares slope of `heapMb` over samples with `tSec` >= 60, MB per min, <= limit. Needs >= 2 such samples, else fails | 1.0 MB/min (`heapSlopeMbPerMin`) |
| `display_cap` | max `displayObjects` <= limit | 500 (`perf-budget.json` `displayObjects`) |
| `display_growth` | last `displayObjects` <= baseline x limit | x 1.10 (`displayGrowthRatio`) |
| `toasts_cap` | max toasts <= limit | 4 (`toastsCap`) |
| `dom_growth` | last - baseline `domNodes` <= limit | 200 (`domGrowth`) |
| `voices_cap` | max `liveVoices` <= limit | 48 (`perf-budget.json` `liveVoices`). Passes with `null` when no sample has `liveVoices` |
| `voices_growth` | last - baseline `liveVoices` <= limit | 8 (`voicesGrowth`). Passes with `null` when no sample has `liveVoices` |

Also: `setup_buys` (S15 list all ok) and `no_baseline` (fails when no sample reaches `tSec` 60). The perf budget's `heapGrowthMb` (8) belongs to the perf smoke; soak uses its own 16 MB.

Outputs:
- `<outdir>/soak.json` (2-space JSON) and stdout: `{ minutes, samples, baseline, last, limits, purchases: { ok, tried }, fail, errors }`. Each sample: `{ tSec, heapMb, displayObjects, toasts, domNodes, liveVoices, machineMeanMs }`.
- `<outdir>/soak-end.png`. Progress lines `[soak] t=...` go to stderr.
- Exit 1 when `fail` or `errors` is non-empty; 2 on usage. An exception adds `FAILED:soak:<msg>`.

### store-shots.mjs

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/store-shots.mjs "<preview>/" C:/Users/<you>/AppData/Local/Temp/smoke/store
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright SIZES=2160 VARIANTS=clean node scripts/smoke/store-shots.mjs "<preview>/" C:/Users/<you>/AppData/Local/Temp/smoke/store
```

`<preview>/` is the base URL without a query (the script adds `?debug=1`).

Env vars (unset or blank = all; an unknown or empty entry = usage, exit 2):
- `SIZES` (default `1080,2160`): `1080` = viewport 1920x1080 at deviceScaleFactor 1 (PNG 1920x1080). `2160` = same viewport at deviceScaleFactor 2 (PNG 3840x2160).
- `VARIANTS` (default `hud,clean`): `hud` = live UI. `clean` = no HUD: photo mode without the hint (stems 07 and 09) or `#ui-root` hidden (the other stems).

Plate cap (WP16b-3): store and alt shots are taken with the World name plate and the HUD plaque capped at `RES?OR?` through `window.__wedtmd.setPlateCap('substationBlueprint')` (rendering only; the same cap as the demo teaser), so no shot spells the finale answer. The cap is set at stems 01, 10 (the title reload clears it) and 09, and cleared at stem 08; the finale shots (08, 08b) are uncapped press-kit shots.

One fresh context per size; the stems run in one continuous session per size. `VARIANTS` only drops shots; the setup always runs. Shot table in run order (`<stem>` = two-digit id; file = `<outdir>/<size>/<file stem>-<variant>.png`):

| Stem | File stem | Setup | Variants | Plate cap |
|---|---|---|---|---|
| `01` | `01-era1-start` | `?debug=1`, 12 crank clicks (120 ms apart), 2.5 s. clean first (`#ui-root` hidden), then hud (3 more crank clicks) | hud, clean | capped |
| `02` | `02-era1-full` | 33 crank clicks, S7 buy list, 2.5 s | hud, clean | capped |
| `03` | `03-era2-generator` | S7 to S9 buys, 2.5 s. hud keeps the milestone toast | hud, clean | capped |
| `04` | `04-era3-boiler` | S9 to S11 buys, 2.5 s | hud, clean | capped |
| `05` | `05-tree-era3` | `t`, click `#tech-tab-3`, 600 ms; `#hud-panel` and `#hud-buttons` hidden for the shot; Escape after | hud | capped |
| `06` | `06-era4-spire` | S11 to S13 buys, 12 s | hud, clean | capped |
| `07` | `07-era5-ruined` | S13 to S15 buys, 15 s. hud first, then clean (photo mode) | hud, clean | capped |
| `10` | `10-title` | Save, reload with `title=1`, cap set again, 1.5 s, title screen open; `#title-version` hidden for the shot; then CONTINUE | hud | capped |
| `08` | `08-finale-reveal` | cap cleared, `primaryFunction` buy, 2 s, `finaleSeek(56)`, phase `sequence`. hud, then clean (`#ui-root` hidden) | hud, clean | uncapped |
| `08b` | `08b-finale-typed` | `finaleSeek(64.0)`, up to 1 s polling for the 5th line; `#finale-skip` and `#finale-overlay .finale-buttons` hidden for the shot. Only when `VARIANTS` has hud | hud | uncapped |
| `09` | `09-postgame-portrait` | cap set, `skipFinale`, KEEP IT RUNNING, phase `postgame`, 2.5 s. hud first, then clean (photo mode) | hud, clean | capped |

Hide rules for hud shots: `#toast-stack` is hidden except at stem 03. The era card is dismissed first and the pointer is parked at (5, 5).

Per size: 19 PNGs (stems 01 to 04, 06, 07, 08 and 09 give 2 each = 16; 05, 08b and 10 give 1 each = 3). Both sizes: 38. Each PNG size is checked from its IHDR.

Check names (`<size>` = `1080` or `2160`; `<stem>` = `01` to `10`; `<variant>` = `hud` or `clean`):
- `<size>_<stem>_<variant>_png`: one per shot; the PNG is 1920x1080 (`1080`) or 3840x2160 (`2160`).
- `<size>_<stem>_clean_hud_hidden`: clean shots (stems `01`, `02`, `03`, `04`, `06`, `07`, `08`, `09`); `#hud-panel` is hidden at shot time (photo mode active for `07` and `09`, `#ui-root` hidden for the rest). Only with the clean variant.
- `<size>_02_buys`, `<size>_03_buys`, `<size>_04_buys`, `<size>_06_buys`, `<size>_07_buys`, `<size>_08_buys`: the buy list ran with every buy ok.
- `<size>_<stem>_plate_cap` (x4: `01`, `10`, `09`, `08`): the cap in force equals the request: `substationBlueprint` for `01`, `10`, `09`; `null` for `08`.
- `<size>_<stem>_<variant>_no_spoiler` (x14: `01` to `04` hud and clean, `05` hud, `06` and `07` hud and clean, `09` clean): for stems 01 to 07 and 09, every shot that is not in `pressKitOnly`: the name plate frame (`componentState('namePlate').frame`) is at most 2 and no visible text line of the page (`document.body.innerText`) matches `/RESTOR/i`, and the HUD plaque text (`#hud-plaque` textContent, read even when the HUD is hidden) does not match `/RESTOR/i`. Value `{ frame, plaque, hits }`.
- `<size>_10_title_open`: title screen open after the reload.
- `<size>_10_hud_hidden`: `#hud-panel`, `#hud-buttons` and `#toast-stack` computed visibility are all `hidden` behind the title (read before the shot).
- `<size>_10_hud_back`: `#hud-panel` visible again 800 ms after CONTINUE.
- `<size>_08_sequence`: finale phase `sequence` after `finaleSeek(56)`.
- `<size>_08b_typed`: value `{ count, empty, last, phase, t }`: 5 complete lines, the last is `Restoration holds while the machine runs.`; phase `sequence` or `choice` both pass.
- `<size>_09_postgame`: ending phase `postgame`.
- `store_top5_complete` (only when both variants run): no store or alt file is missing.

Failure keys: `FAILED:<size>/<stem>:<first line>` (the run goes on with the next stem), `FAILED:<size>/setup:<first line>`, `FAILED:launch:<first line>`.

Outputs:
- `<outdir>/<size>/<file stem>-<variant>.png` (19 per size).
- `<outdir>/store-shots.json` (2-space JSON) and stdout: `{ shots, results, fail, errors }`. Each `shots[]` entry: `{ file, size, stem, variant, width, height }`, where `file` is absolute and `stem` is the file stem. Each `results` entry of a check with a detail is `{ ok, value }`.
- `<outdir>/store-top5.json` = `{ sizes, plateCap, store, alt, pressKitOnly, missing }`. `plateCap` = `substationBlueprint`. `store` = the five store picks in `STORE_TOP5` order (rank 1 to 5, files per size). `alt` = the alternative(s) in `STORE_ALT` (`04-era3-boiler-hud`, replaces the rank 5 shot). `pressKitOnly` = shots that are never store screenshots, with the reason: `08-finale-reveal-hud`, `08-finale-reveal-clean`, `08b-finale-typed-hud`, `09-postgame-portrait-hud`, `10-title-hud`. `missing` = `<size>/<name>` for every store or alt file not captured for a requested size.
- Exit 0 clean; 1 when `fail` or `errors` is non-empty; 2 on a usage error.

## Part tiers (WP22): tiers.mjs

Part evolution tiers (render only, no save field): each repeatable track shows MK I to MK V as its tech level rises, with a 900 ms non-blocking tier-up beat. Node `.mjs`, Playwright through `PW_PATH`, debug hook (`?debug=1`), never starts a server.

Usage: `PW_PATH=<playwright dir> node scripts/smoke/tiers.mjs "<url with ?debug=1>" <outdir>` (no arguments: usage on stderr, exit 2). Prints ONE JSON object `{ results, fail, errors }`; exit 1 when `fail` or `errors` is non-empty. Fresh 1280 x 720 context per case; an exception adds `FAILED:<case>:<message>` to `fail` and the run goes on. `ONLY=A,B` runs only the listed cases. G needs the F page of the same run: `ONLY=F,G`; G alone records `FAILED:G:no context`.

Demo run (dist-demo preview): `PW_PATH=<playwright dir> node scripts/smoke/tiers.mjs "http://localhost:4176/?debug=1" <outdir>` runs cases A-E and H (H is era I, so it runs in the demo build too). A throwaway probe page opened before the cases reads `demoState()`; when it is not null the era cap blocks S15 and `primaryFunction`, so F and G are skipped and `FG_skipped_demo` is recorded. `ONLY=A,B,C,D,E,H` does the same explicitly.

| case | setup | checks |
|---|---|---|
| A keys (deviceScaleFactor 2) | 45 crank clicks first (a fresh page has no ME, `wornMotor` costs 40), then `wornMotor`, then `@motorTuning:5/10/20/25`; then `@gearRatio:6` and `@gearRatio:15` | `A_motor_tiers`, `A_pulse`, `A_gear_t2`, `A_gear_t3`, `A_rot_turns` |
| B hold | 45 crank clicks first, `wornMotor`, `@motorTuning:4`, wait until the hosts finished their fly-in, TECH INDEX open (`t`), `@motorTuning:5`; Esc; one crank click 120 ms after Esc; then the four `tiers-B-*` shots (after the click) | `B_held`, `B_played`, `B_input`, `B_done` |
| C burst | 45 crank clicks first, then the 15-entry prefix (`wornMotor`, `@gearRatio:5`, `reinforcedCrank`, `@motorTuning:9`, `@flywheel:3`, `pistonArray`, `@improvedPistons:4`, `@blueprint`, `generator`, `@motorRetrofit:3`, `@copperWinding:5`, `dynamoCrank`, `capacitorBank`, `sparkGap`, `@transformer:3`); wait until the hosts (`gearLarge`, `flywheelPedestal`, `wornMotor`, `pistonArray`, `motorRetrofitKit`, `transformer`) finished their fly-in; TECH INDEX open; six tier steps in one release (`@gearRatio:6`, `@flywheel:4`, `@motorTuning:10`, `@improvedPistons:5`, `@motorRetrofit:4`, `@transformer:4`); Esc. Expected after the burst: gearRatio 2, flywheel 2, motorTuning 3, improvedPistons 2, motorRetrofit 2, transformer 2. gearRatio, flywheel, motorTuning and improvedPistons play beats (track order, cap 4); motorRetrofit and transformer swap instantly | `C_setup`, `C_cap` (`peak === 4`: six swap changes, cap 4, exactly four beats active), `C_all_applied` (all six at their expected tier within 1500 ms; value `{ allAt, tiers }`), `C_machine_ms` |
| D reduced | 45 crank clicks first, `updateSettings({ reducedMotion: true })`, `wornMotor`, `@motorTuning:4`, wait until the hosts finished their fly-in, TECH INDEX, `@motorTuning:5`, Esc | `D_played`, `D_short`, `D_applied` |
| E reload | 45 crank clicks first, `wornMotor`, `@motorTuning:10`, `@gearRatio:6`; `saveNow()`; reload. `E_silent`: `tierBeatsActive()` sampled every 50 ms for 500 ms from the moment the hook is ready (value: max) | `E_silent`, `E_keys` |
| H detail fit | fresh page, `wornMotor`, `@motorTuning:19` (MK III, the 31-char worst case). For UI 100, then UI 150: `updateSettings({ uiScale })`, TECH INDEX, click the MOTOR TUNING node, 300 ms, measure `#tech-level` against `#tech-detail`; Esc. Then `@motorTuning:24` (MK IV, tree closed) and the same two UI scales on the same page. The one-line test compares the text's line boxes (the UI root is CSS-zoomed) | `H19_text_100`, `H19_text_150` (text `LV 19/25 · MK III — MK IV AT 20`), `H19_fit_100`, `H19_fit_150`, `H_text_100`, `H_text_150` (text `LV 24/25 · MK IV — MK V AT 25`), `H_fit_100`, `H_fit_150` (no horizontal overflow, level right edge within the detail right edge + 1 px, one line) |
| F finale | 45 crank clicks, S15, `primaryFunction`, `skipFinale()`, KEEP IT RUNNING; new cycle from the SYSTEM row (`#sys-new-cycle`, then `#cycle-confirm-begin`) | `F_setup`, `F_top`, `F_restored`, `F_cycle_mk1` |
| G perk | after F, same page: `session.buyPerk('muscleMemory')`; 1500 ms of 50 ms samples | `G_perk_buy`, `G_perk_lands`, `G_perk_silent` |

Shots (outdir): `tiers-A-motor-t1.png` to `tiers-A-motor-t5.png` (motor crop, 120 x 90 px at the motor centre, zoom 2); `tiers-B-0.png`, `tiers-B-120.png`, `tiers-B-450.png`, `tiers-B-700.png` (taken after the B crank click, so the names are the requested offsets after Esc and the achieved offsets, later than the names, are in the `B_played` value); `tiers-H19-ui150.png` (case H at level 19, UI 150) and `tiers-H-ui150.png` (case H at level 24, UI 150): the TECH INDEX with the MOTOR TUNING level line.

Hook probes: `partTiers()` (`Partial<Record<TechId, number>>`, or `null` without a World scene: the displayed tier of each track with a visible host) and `tierBeatsActive()` (tier-up beats in flight). The other fields are `textureKey(id)`, `componentState(id)`, `techTreeOpen()`, `crankClientPoint()`, `cameraState()`, `machineStats()`, `saveNow()`, `skipFinale()`, `cycleState()`, `restoredTextures()` and `session` (`purchase`, `update`, `updateSettings`, `buyPerk`, `state.techLevels`, `state.totalClicks`, `state.ending.phase`).

Strip rule: every key comparison except `A_pulse` strips a trailing pulse frame, `base(k) = k.replace(/(#t[0-9])b$/, '$1')`, so `machine.motor#t5b` compares as `machine.motor#t5`. `A_pulse` reads the raw keys and needs both `#t5` and `#t5b`.

`showcase.mjs` and `prestige.mjs` (WP22, option A): 34 restored parts (`RESTORED_TOTAL` 34; `ring1Bead2` joins the containment ring). `showcase.mjs` `checkTiersTop(key)` runs at `showcase_B_k41_5`, `showcase_B_k45_2`, `showcase_B_k56`, `showcase_C`, `showcase_D2` and `showcase_C2`: every track at its top tier in `partTiers()` (settled within 3 s). A mismatch is pushed as `<key> tiers top mismatch: ...`; the result is kept as `tiersTop` in that entry. `prestige.mjs` RUN B: `prestige_3_postgame` expects `restoredSwapped` 34 (was 33) and top tiers at the postgame (`prestige_3_postgame tiers top mismatch: ...`); after the new cycle every tier is MK I (`prestige_3_after tiers not MK I: ...`). The lists are kept as `tiersMiss`.

## Living world (WP23a): `world.mjs`

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/world.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/world
```

Runs on the full build (`http://localhost:4174/?debug=1`) and on the demo build (`http://localhost:4177/?debug=1`, the demo preview). Fresh 1280x720 context per case, A to H. Prints ONE JSON object `{ results, fail, errors }`; expect `fail` and `errors` to be `[]`. Exit code 1 when either is non-empty; exit 2 on a usage error. A failing check carries `worldState().silence` in its detail. The script starts no server.

| case | checks (names in `results` / `fail`) |
|---|---|
| `A` (fresh, no clicks) | `A_frozen`: the Inspector and Dog variants from `livingWorld()` stay the same over 2 s (five samples, 400 ms apart). `A_crank_step`: one real crank click changes the Inspector or the Dog variant. Shot `world-A-s0.png` |
| `B` (fresh) first line | 16 real crank clicks (one clears the crank prompt, 15 more pay for Gear Ratio at 15 ME), `buyInPage(['gearRatio'])`, then one evaluate: `worldQuiet(false)`, `worldAdvance(120000)`, `worldLogShown('observer-count')`, `worldAdvance(6000)`. `B_bubble`: `worldBubble().visible` within 8 s. `B_rects`: the visible `.wv.on` box does not overlap `#hud-panel`, `#toast-stack` (only while a toast shows), `#hud-buttons` or `#hud-hint`, at UI 100 and at UI 150. `B_live`: `#world-voice-live` text is exactly `Inspector: Unchanged. I'm not on the count either.`. `B_aria`: every `.wv` has `aria-hidden="true"`, no `tabindex`, and is not focusable. Shots `world-B-100.png` (UI 100) and `world-B-150.png` (UI 150) |
| `C` (fresh) silence | after the first moment, the bubble is gone and no toast shows. Control: `worldSay('INS-02')` is true. Then each state refuses it (`worldSay` false, no `.wv.on`): `C_tree` (TECH INDEX open, key `t`), `C_card` (45 clicks, the S8 list with `buyInPage`; `#era-card` visible), `C_photo` (`photoMode(true, { hint: false })`), `C_menu` (SYSTEM menu, Escape) |
| `D` (fresh, UI 150) framings | `D_s7_placed` (S7 list, framing `e1`), `D_s8_placed` (S8, framing `s8`; era card dismissed first), `D_s9_placed` (S9, framing `s9`). Each: `worldState().placements` equals the table (listed ids at their x, `null` when off-stage; scraps are not listed), the framing matches, and no placed x lies over the machine box or inside the crank circle + 24. Shots `world-D-s7-150.png`, `world-D-s8-150.png`, `world-D-s9-150.png` |
| `E` (fresh) settings | `E_rare`: RARE refuses the non-core `INS-02` (`worldSay` false), and ON accepts it again (control). `E_off`: OFF refuses `DOG-02`; over 800 ms `audioStats().worldBlips` and `worldState().seen` do not change and no `.wv.on` shows |
| `F` (fresh) persist | `F_seen`: after the first moment, `saveNow()` and a reload, `worldState().seen` contains `INS-01`. `F_no_repeat`: after `worldAdvance(400000)` and `worldLogShown('observer-count')`, no bubble or live text of INS-01 appears in a 6 s watch |
| `G` (fresh) budget | S9 list: `G_display` (`displayObjects()` <= 100), `G_cost` (`worldStats().meanMs` averaged over 20 samples, 5 s, <= 0.3). `G_era3_hidden`: S10 = S9 + `@substationBlueprint`, `boiler` (local copy of the list); the TECH INDEX opens and closes once; then every `livingWorld()` entry has `visible` false and `worldState().hidden` is true. On the demo the era III purchase is refused (`purchase('boiler').reason === 'demo'`), so the check records `value.skipped` and passes |
| `H` (fresh) tier port (WP23 X1) | era I: `@improvedPistons:9`, then `:10`, each through `buyInTree` (TECH INDEX closed after). `H_dog_line`: DOG-04 is queued (`worldState().pending`, `activeLines` or `seen`) after level 10 and not after 9. `H_first_top`: `@motorTuning:25`, then INS-13 is queued. `H_heartbeat`: `worldState().tierHeartbeat` is false before the top tier and true after it. `H_hole`: era II (the rest of S9), lifetime EE topped up to 100000 (8 h stretches through `session.update`), then `@motorRetrofit` 8 / 13 / 18 read `worldState().holeStage` (2 / 3 / 4). Every H check carries `tierProbe` in its detail (era, heartbeat, hole stage, lifetime EE, `cameraState()`, the Inspector and Dog from `livingWorld()`) |
| `H` (fresh) over-cap and boot seed | `H_overcap_pre`: era II (S7 + S9 rest), no heartbeat, INS-13 not queued. `H_overcap`: one TECH INDEX release of `@gearRatio:6`, `@flywheel:4`, `@motorTuning:10`, `@improvedPistons:5`, `@motorRetrofit:18` (five tracks; the fifth is past the four-beat cap, so it has no partEvolved); the displayed tiers read 2 / 2 / 3 / 2 / 5 and INS-13 is queued after the close with the heartbeat on. `H_boot_seed`: `saveNow()`, reload, `tierHeartbeat` on before any TECH INDEX open |

Check names (27): `A_frozen`, `A_crank_step`, `B_bubble`, `B_rects`, `B_live`, `B_aria`, `C_tree`, `C_card`, `C_photo`, `C_menu`, `D_s7_placed`, `D_s8_placed`, `D_s9_placed`, `E_rare`, `E_off`, `F_seen`, `F_no_repeat`, `G_display`, `G_cost`, `G_era3_hidden`, `H_dog_line`, `H_first_top`, `H_heartbeat`, `H_hole`, `H_overcap_pre`, `H_overcap`, `H_boot_seed`.

Debug API used (`window.__wedtmd`, WP23 C7): `worldState()`, `worldSay(id)`, `worldQuiet(on)`, `worldAdvance(ms)`, `worldLogShown(logId)`, `livingWorld()`, `worldStats()`, `worldBubble()`. Also the existing `session` (`updateSettings`, `purchase`), `saveNow()`, `photoMode()`, `photoState()`, `techTreeOpen()`, `systemMenuOpen()`, `audioStats()`, `displayObjects()`, `crankClientPoint()`, `cameraState()`, `partTiers()`. `worldClock` is not used.

Shots in the outdir: `world-A-s0.png`, `world-B-100.png`, `world-B-150.png`, `world-D-s7-150.png`, `world-D-s8-150.png`, `world-D-s9-150.png`. The UI 150 bubble shot shows the forced `INS-02` line: `INS-01` has left the screen by then, and the layout is the same.

Timing is deterministic without waiting for the game clock:
- `worldAdvance(ms)` moves the scheduler clock and the play time together, so the first-moment gate (90 s), the gaps, the TTLs and the idle gate all move at once. It does not wait for frames: the checks poll for the bubble (cap 8 s).
- `worldAdvance(120000)`, `worldLogShown('observer-count')` and `worldAdvance(6000)` run in ONE evaluate. No frame runs between them, so the core log reply (priority 1) takes the slot before the 45 s idle line (priority 4) can. The reply comes when the log clears (5 s of scheduler time) plus the 1 s clear gap.
- `worldSay(id)` forces a line past gaps and caps, but not past hard silence. C and E use it as a probe; each refusal is preceded by a control that the same line plays in the plain state.

Constants in the script mirror DENIZEN_ART §3 and must move with it: machine x-ranges per framing (S7 1576-2316, S8 1576-2552, S9 1576-2808), the placement table (`PLACED`), the crank hub x 1920 with 96 world px clearance (hit circle 72 + 24) and the wing clearance 24. Gear Ratio costs 15 ME, so the first moment needs 16 clicks, not one.

Demo note: the demo caps era II. The teaser follows the Substation Blueprint milestone after `DEMO_END.triggerDelayMs` (4 s), so the D and G reads happen within the first seconds after the S9 buys.

### Existing smokes touched by WP23a

Five existing smokes gain living-world checks (WP23 T13). Their old checks keep their names and order. The new names:
`B_bubble_hidden_teaser`, `B_no_spoiler_bubble`, `G_freeze`, `G_pay05`, `G_ins07`, `G_grl06`, `G_dog12`, `G_hold`, `G_no_refreeze`,
`W_live_region`, `W_bubble_aria_hidden`, `W_tab_walk_unchanged`, `A_no_bubble_prompt`, `A_crank_point_unchanged`,
`<w>x<h>-150_bubble_inside`, `<w>x<h>-150_bubble_clear_hud`.

- `store-shots.mjs`: `worldQuiet(true)` runs before every stem, and again after each navigation (stems 01 and 10 reload). No bubble, blip or glance reaches a store shot. No check changed or added.
- `demo.mjs` (demo build only):
  - `B_bubble_hidden_teaser` (case B, during the teaser): `worldSay('GRL-05')` is refused. It passes only when the hook answers, the demo phase is `teaser`, no `.wv.on` node exists and `worldBubble()` is null or not visible. A missing hook fails the check.
  - `B_no_spoiler` is unchanged (teaser frame, `document.body.innerText` has no `RESTOR`). `B_no_spoiler_bubble` re-runs the same scan at the end of case B with a bubble on screen: `worldQuiet(false)`, one crank click, one purchase, `worldAdvance(120000)`, `worldSay('GRL-05')`. The GRL-05 bubble must be visible and the scan must find no `RESTOR`. The name differs from `B_no_spoiler` so the teaser value stays recorded.
  - Case G (POST-CAP, fresh page, runs last): the cap, then KEEP TINKERING. `G_freeze`: the KEEP TINKERING click and a requestAnimationFrame watch run in ONE evaluate; frame 2 is the baseline (frame 1 may still be the pre-freeze frame). It passes when the first frame whose `livingWorld()` variants differ comes at least 1000 ms after the click (`TAPE_FREEZE_MIN_HOLD_MS`, slack under the 1200 ms freeze; the watch lasts 4 s) and `seenEver` has exactly one `beat.tapeFreeze`. Then `worldAdvance(21000)` gives `G_pay05` (PAY-05 `We're sorry. This call cannot be completed.`), and `worldAdvance(125000)` before each of `G_ins07`, `G_grl06` and `G_dog12`. Each check needs the bubble with its text and the id in `worldState().seen`. `G_hold`: after a reload the dog entry of `livingWorld()` has variant `lie`. `G_no_refreeze`: `seen` and `seenEver` are unchanged after `worldAdvance(300000)`, and `seenEver` still has one tape freeze.
- `a11y.mjs` (T13b): `W_live_region` (the polite live region reads `<Speaker>: <line>` for a shown line), `W_bubble_aria_hidden` (every bubble is `aria-hidden="true"` and not focusable), `W_tab_walk_unchanged` (the Tab walk is the same with a bubble on screen). Bubbles come from `worldSay`.
- `ux.mjs` (T13b): `A_no_bubble_prompt` (no bubble while the crank prompt shows), `A_crank_point_unchanged` (the crank click point is the same with the layer on).
- `resolutions.mjs` (T13b): `<w>x<h>-150_bubble_inside` (the bubble box lies inside the viewport at UI 150) and `<w>x<h>-150_bubble_clear_hud` (it does not overlap the HUD rects), one pair per resolution.

Expected run: `fail: []` and `errors: []` for `demo.mjs` on `http://localhost:4177/` (case G included) and for each smoke above on its own build.
