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
| `A_nohook` | base | waits for `wedtmd:first-frame` + 600 ms: `A_no_hook` (no `window.__wedtmd`), `A_title_open` (`#title-screen.is-open`), `A_splash_gone` (`#splash` removed), `A_boot_mark_before_first_frame` (`wedtmd:boot` startTime < first-frame), `A_title_version` (`#title-version` = `v<version> · SAVE v2`, version from package.json), `A_continue_hidden` (fresh profile), `A_escape_closes_title` |
| `B_debug` | `?debug=1` | `B_hook_defined`, `B_title_closed` |
| `C_title` | `?debug=1&title=1` | `#title-settings` opens the SYSTEM menu on SETTINGS (`C_settings_menu_open`, `C_settings_tab_selected`); Esc closes the menu, title stays (`C_esc_closes_menu`, `C_title_open_after_menu`); `#title-credits` opens credits, Esc closes them, title stays (`C_credits_open`, `C_esc_closes_credits`, `C_title_open_after_credits`); `#title-new` closes the title (`C_new_game_closes_title`), `audioUnlocked()` true (`C_audio_unlocked`); 3 crank clicks give `totalClicks` 3 (`C_three_crank_clicks`) |
| `D_newgame` | same context as C | `saveNow()`, reload: `#title-continue` visible (`D_continue_visible`) and focused (`D_continue_focused`); `#title-new` reads `CONFIRM: ERASE ALL?` (`D_new_game_armed_label`); second press closes the title (`D_new_game_closes_title`) and resets `totalClicks` to 0 (`D_clicks_reset`) |
| `E_footer` | `?debug=1`, Esc opens SYSTEM | `#sys-footer` = `v<version> · SAVE v2` (`E_footer_text`, version from package.json), font size >= 12 px (`E_footer_font_size_12px`), `aria-label` = `Version <version>` (`E_footer_aria_label`), `#sys-credits` visible (`E_credits_visible`), `#sys-quit` absent or hidden on web (`E_quit_absent_or_hidden`), click opens credits (`E_credits_opens`) |
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
| `1_title_fresh` | fresh profile: `#title-screen` is open, `#title-continue` hidden, `#title-quit` visible, `#title-version` = `v<version> · SAVE v2` (version from package.json) |
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
`@<techId>:<n>` buys that tech until its level is `n` (a rejected buy gets an 8 h jump and a retry, up to 512 rounds), then pushes `@<techId>:<n>:true|false`; e.g. `@resonantSiphon:20`.
`PERF=1` (stages.mjs): for s13_era4_full and s15_era5_full, waits 3 s after the screenshot and prints `machineStats` (`{ meanMs, maxMs, components }`, or `null` when the hook is missing).
`CLICK_SHOT=1` (stages.mjs): clicks the crank 3x before every stage shot so the gain block is in the screenshot.
An `#era-card` shown at screenshot time is clicked away first (WP20).
WP17 (energy continuity, Legacy Feeds): S11 buys `bellowsDrive` x3, S13 `gridExciter` x5, S15 `@resonantSiphon:20`, `@graviticAnchor:10`, `mainsBackfeed` x5, `steamLance` x5 (the `finale.mjs` S lists mirror `stages.mjs`).
`hud` (every stage, one line): `{ title, visibleRows, frontier, click, clickSub, auto, right, bottom }` = `#hud-title` text, shown `.hud-res-row` count, `data-res` of `.hud-row--frontier`, `#hud-per-click` text, `#hud-per-click-me` text (`null` when hidden), `#hud-auto` text (`null` when hidden), `#hud-panel` right / bottom edge in px (`null` when missing). Expected, in the order s0 / s9 / s11 / s13 / s15 / s16:
title `ERA I · MECHANICAL` / `ERA II · ELECTRICAL` / `ERA III · PRESSURE` / `ERA IV · RESONANCE` / `ERA V · ???` / `RESTORATION ENGINE`; visibleRows 1 / 2 / 3 / 4 / 5 / 5; frontier `me` / `ee` / `pr` / `rs` / `xf` / `xf`; auto `null` at s11 and `AUTO-CRANK 3/s` at s13; right <= 340 on every stage.
`parts17` (s9_era2_full, s11_era3_full, s13_era4_full, s15_era5_full, s16_postgame; visibility of the 5 legacy feed parts): all `true` at s15_era5_full and s16_postgame.
`bellowsFrames` (s11_era3_full, s15_era5_full): `componentState('bellows').frame` sampled 4 times, 350 ms apart (span >= 1 s); the frames must not all be equal.
wp3-techtree.mjs result keys: `11_nodes` (era III tab, expect 10), `12_tab5` (fifth tab text, expect `SIGNAL ?`), `12_nodes` (era IV tab, expect 10), `13_tabs`, `11_tabCount` / `12_tabCount` / `13_tabCount` (expect 5, tabs unchanged; every `.tech-tab` query skips the SPLICES tab, `#tech-tab-splices`), `13_header` (expect ends `???`), `13_nodes` (era V tab, expect 12), `13_null` (classes of `nullChamber`, `'missing'` when absent).
wp12-menus.mjs (WP12 menus / keyboard / settings / records / export-import): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/wp12-menus.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke` (screenshots `wp12-0*.png` in the outdir). Keys: `1_first_crank_toasts` (contains `RECORD LOGGED`), `2_esc_menu` (true), `2_arrow_right` (selected tab = `sys-tab-settings`), `3_tab_trapped` (true after 12 Tabs), `4_settings` / `4_root_attrs` (volume 40, reduced motion on, UI scale 125, notation scientific; `#ui-root` zoom `1.25`), `5_space` (`delta` 10, `heldDelta` 0), `6_tree_t` (`[true, false]`), `7_records_firstTurn` (1), `7_records_counter`, `8_stats_clicks_cell` = `8_stats_clicks_session`, `9_hud_me_scientific` (contains `e`), `10_settings_after_reload` (same settings), `11_restored` (all true), `12_garbage` (status text, `meSame` / `clicksSame` true), `13_typing_in_textarea` (`treeOpen` false, `clicksDelta` 0), `14_tree_space` (`{ open: true, focusNode: true }`: Space inside the tree keeps it open, WP20). `errors` must be empty.

`finale.mjs` (WP13 ending sequence, PRIMARY FUNCTION reveal, postgame): `PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/finale.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke`. Runs in fresh contexts: (1) buy `primaryFunction` after the era V list, HUD hidden, crank does not change clicks, `modalCount` ≥ 1; keyframes via `finaleSeek` at 1, 3.9, 5.4, 6, 6.9, 12, 15.6, 24, 30.5, 34, 40, 41.5, 45.2, 56, end (screenshots `finale-k<label>.png`); (3) 5 s playback from t 20, reload → `choice` (KEEP IT RUNNING shown, plate frame 5); (4) Esc / `t` do nothing at choice, KEEP → `postgame`, `localStorage` `state.ending.phase` postgame, crank works, reload keeps postgame, system menu BEGIN A NEW CYCLE row (WP14: enabled, reason line absent), reset from menu → plate frame 4; skip run (Esc during sequence → `choice`, t = end); reduced run (`session.updateSettings({ reducedMotion: true })` before the buy: `reduced`, overlay alpha at 15.6, wipe mode at 24, birds, beam animate, and at 42 `finale_r_42`, see WP18).
Result keys (all `finale_*`): `finale_0_fastforward_failed` (expect `[]`), `finale_1_buy`, `finale_1_t_sequence`, `finale_k1` … `finale_kend` (each: `t`, `shot`, `plate` = name plate texture frame, `frame` = full `FinaleFrame`, plus WP18 `completeEra` = `frame.completeEra`, `hidden` = `partsVisible().hidden`, `camera` = `cameraState()` `{ zoom, centerX, centerY, relX, relY }`), `finale_2_playback_t`, `finale_3_reload_choice`, `finale_4_esc_t_choice`, `finale_4_keep`, `finale_4_crank_postgame`, `finale_5_reload_postgame` (also WP18 `camera`), `finale_6_newcycle`, `finale_7_reset`, `finale_skip`, `finale_r_start`, `finale_r_15_6`, `finale_r_24`, `finale_r_42` (WP18: `t`, `completeEra`, `camera`). `finale_FAILED` appears only if the run threw. `errors` must be empty (the KEEP click failure is also recorded there).
Missing hook fields (`finaleState`, `finaleSeek`, `skipFinale`, `displayObjects`, `componentState().frame`, WP18 `partsVisible`, `cameraState`) print `null`; they never throw.
WP18 expectations (`finale.mjs`): every `finale_k<label>` now also records `completeEra`, `hidden` and `camera`; the new keys are `finale_k3_9`, `finale_k5_4`, `finale_k6_9`, `finale_k41_5`, `finale_k45_2`. `completeEra` is 3 / 4 / 5 at t 3.9 / 5.4 / 6.9 (completion steps at t 3 / 4.5 / 6). `camera` is (1320, 1380, 1) at `finale_k41_5` (baseL hold 41.0-42.0) and (2520, 1380, 1) at `finale_k45_2` (baseR hold 45.0-46.0; seek 45.2 because the 250 ms settle must stay inside the hold). `finale_5_reload_postgame.camera` is (1920, 1080, .5), the canonical portrait. `finale_r_42` has zoom .5: the survey is skipped under reduced motion. Screenshots: `finale-k<label>.png`, `finale-reduced-42.png`.

WP18b expectations (restored texture swap): `finale.mjs` records `restoredSwapped` (= `restoredTextures().swapped.length`, `null` when the hook is missing) in every `finale_k<label>`, `finale_3_reload_choice`, `finale_5_reload_postgame`, `finale_7_reset` and `finale_r_42`. Expected: 0 for t < 30 (`finale_k1` ... `finale_k24`), 33 for t >= 30.5 (`finale_k30_5` ... `finale_kend`), 33 at `finale_3_reload_choice`, 33 at `finale_5_reload_postgame`, 0 at `finale_7_reset` (the menu reset reverts), 33 at `finale_r_42` (reduced motion swaps instantly too). `prestige.mjs` RUN B records `restoredSwapped` and `coreKey` in `prestige_3_postgame` (expect 33 and `machine.nullCore#restored#rot`) and in `prestige_3_after` (expect 0 and `machine.nullCore#rot`: the new cycle swaps back); a mismatch is pushed into `errors`.
WP23b world film keys (`finale.mjs`): the living world finale frame is read from `worldState().script` (`null` without the world director). Records only, no asserts. Each keyframe record holds `seekT`, `t`, `reduced`, `lastLook`, `keepS`, `loopS`, `lead` (the crow flock lead `{ frame, row }`) and `cast` = `{ visible, frame, row, x }` for `inspector`, `dog`, `crow`, `girl`, `sensor7`; `marks` and `marksPlus` ride along.
- `finale_world_k13`: seek 13 s, shield poses (row 4). Shot `finale-world-k13.png`.
- `finale_world_k24_3`: seek 24.3 s, stare poses at row 4 (restores not yet). Shot `finale-world-k24_3.png`.
- `finale_world_k31_1`: seek 31.1 s (dog restore, girl run lead-in). Shot `finale-world-k31_1.png`.
- `finale_world_k38`: seek 38.0 s (crow takeoff over: world crow hidden, `lead` = fly frames at row 5). Shot `finale-world-k38.png`.
- `finale_world_k41`: seek 41.0 s (baseL survey hold, `lead` non-null). Shot `finale-world-k41.png`.
- `finale_world_k45`: seek 45.0 s (baseR survey hold, `lead` non-null). Shot `finale-world-k45.png`.
- `finale_world_k59_83`: seek 59.83 s (LAST LOOK: `lastLook` true, stare poses at row 5, girl hidden, `lead` null). Shot `finale-world-k59_83.png`.
- `finale_world_restore`: per denizen `flipS` = the first film time its row is 5 (scanned in-game over 24.0-40.0 s, bisected to about 0.0002 s; the crossfade ends there, so the restore time is `flipS` minus the crossfade), `before` = row at `flipS` - 0.25 (expect 4), `after` = row at `flipS` + 0.25 (expect 5). Reference restore times (WP23b R4): inspector 32.77, dog 31.1, crow 33.17, girl 31.17, sensor7 33.37.
- `finale_world_lastlook`: `flipS` = the first film time `lastLook` is true (scanned 55-62 s, bisected; expect 59.83), `pre` = sample at `flipS` - 0.05 (`lastLook` false), `post` = sample at `flipS` + 0.05 (stare poses at row 5, girl hidden).
- `finale_world_reduced` (RUN 3, reduced motion): samples at 24.3 (every cast member row 5, girl hidden), 37.5 (crow visible), 38.0 (crow cut: visible false, `lead` null), 49.3 (crow back on perch0, `lead` null). No shot.
- `finale_world_postgame` (RUN 2: KEEP IT RUNNING from the skipped choice; the postgame clock is real time, `keepS` in each sample): `snaps` = the first sample at keepS 0.5 (LAST LOOK poses), 1.5 (turn away: inspector idleA, dog sit0, crow perch0, sensor7 headUp), 3.0, 5.0 (dog faded: `visible` false), 6.0 (`marks`, `marksPlus`, `marksDrawn` = `marks` + `marksPlus`, expect 42 in cycle 1, `null` when a field is missing), 9.0 (loop start: dog settled at x 732, `loopS` ~0). `crowBeat` = crow frame / visible / x changes from 3.0 to 6.5 s (the scratch pecks peck0 / peck1). Shot `finale-world-postgame.png`.

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
| lazy world js raw | `LivingWorldDirector-*.js` | <= 120 KB (`lazyWorldKb`, WP23b; was 80 at WP23a) |
| lazy fault marker js raw | `FaultMarker-*.js` | <= 12 KB (`lazyFaultKb`, WP27; the row is printed only when the key is set) |
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
| `A` | fresh start: title (`#title-version` = `v<version> · DEMO · SAVE v2`), tech tree (5 tabs, eras III to V FULL GAME), SYSTEM menu (footer, no MEMORY tab, no DEMO ENDING row, RECORDS `/20`) |
| `B` | reach the cap (S9 list + Substation Blueprint): waiting, teaser, card, wishlist, keep, tree after, SYSTEM row |
| `C` | same page as B: reload with the cap owned, boot card, replay and skip |
| `D` | reduced motion: portrait teaser and card |
| `E` | clamp of a full-game save (era III levels, ending engaged, Echoes) that keeps an era II level (`copperWinding` 4: two tech levels per old level, `SPLIT_PARTS`), and its backup key |
| `F` | boot where the offline catch-up crosses the cap: the stored save has the cap reset (`substationBlueprint` 0) and lifetime EE just under 4M, saved 1 h ago, so the boot teaser plays (`F_cap_not_yet` is read from the stored save) |

Checks `A`: `A_title_demo`, `A_tabs_full_game`, `A_era3_refused` (`purchase('boiler')` reason `demo`), `A_footer_demo`,
`A_memory_hidden`, `A_demo_row_hidden`, `A_records_20`.

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
  expects the DEMO version line `v<version> · DEMO · SAVE v2` (version from package.json) and adds check `8_demo_tabs` (the era cap tabs). The default
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

`scripts/smoke/lib/common.mjs`: Node built-ins only. Importing reads package.json once; no other side effects and needs no `PW_PATH`.

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
| `APP_VERSION` | version from the repo package.json (title / footer / aria checks) |
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

Self-test (pure, no browser): `node scripts/smoke/lib/common.mjs --selftest`. Prints one line `{ ok, checks }`; exit 0 when every check holds. Checks: `prefix_s7_s9`, `prefix_s9_s11`, `prefix_s11_s13`, `prefix_s13_s15`, `delta_length`, `delta_reverse_throws`, `with_query`, `png_gear_small_40`, `budget_heap_150`, `app_version_semver`.

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
| 12 footer | `12-footer` | `12_footer` | SYSTEM footer text starts with `v<version>` (package.json) |
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
| `09` | `09-postgame-portrait` | cap set, `skipFinale`, KEEP IT RUNNING, phase `postgame`, then up to 15 s polling for the KEEP clock `worldState().script.keepS >= 10`. hud first, then clean (photo mode) | hud, clean | capped |

Hide rules for hud shots: `#toast-stack` is hidden except at stem 03. The era card is dismissed first and the pointer is parked at (5, 5).

TECH INDEX blink (AD R): stems 02, 03, 04, 06 and 07 open and close the TECH INDEX once right after the buy list (`t`, 600 ms, Escape; the total wait is unchanged). The living world moves its cast to a new framing only while the tree is open (`unseenChangeOk`), as in play; without it the cast keeps the previous framing's spots.

KEEP clock (AD R2 F2): stem 09 shoots once `keepS` (seconds since KEEP IT RUNNING) is at least 10, not after a fixed 2.5 s. The dog fades out 4 to 4.5 s after KEEP, is hidden until 7 s, runs in from the left wing at 7 to 8 s and settles at 9 s (`WORLD_ENDING.keep`), so a fixed wait put the clean shot in that gap depending on machine speed. At `keepS` 10 the postgame loop runs and the dog sleeps at its left-wing spot; both shots must end before 22 s, where the Inspector starts the walk to the pat (loop 13.34 s). No line fires before the pat.

HUD style refresh (AD R2 F3): every hud shot sets and restores an inline `visibility` on each `#hud-panel` node right before the shot. `#ui-root` hidden by inline style (the clean shots of stems 01 to 04, 06 and 08) followed by a HUD counter bump can leave the frontier `.hud-value` with a stale computed `visibility: hidden` in Chromium (no rule and no inline style match; it is the animation base style), which blanked the ME number in the 2160 `02` hud shot. Photo mode and the title screen hide the HUD by class rules and do not show it; the game never sets that inline style.

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
- `<size>_09_keep_window`: value = `keepS` read after both 09 shots; passes when 10 <= `keepS` < 22.
- `<size>_<stem>_hud_values_visible`: hud shots where `#hud-panel` computes visible (read after the style refresh); value `{ values, hidden }`: at least one displayed `.hud-value` and none computes hidden. Stems where the panel is hidden at shot time get no entry.
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
| `G` (fresh) budget | S9 list: `G_display` (`displayObjects()` <= 100), `G_cost` (`worldStats().meanMs` averaged over 20 samples, 5 s, <= 0.3; sampled only when `worldState().silence` is null. A silent world (asleep on the demo) records `value.skipped` with the silence state and passes: report-only, not a cost reading). `G_era3_hidden` (WP23b: replaced by `G_era3_visible`, see the WP23b keys below): S10 = S9 + `@substationBlueprint`, `boiler` (local copy of the list); the TECH INDEX opens and closes once; then every `livingWorld()` entry has `visible` false and `worldState().hidden` is true. On the demo the era III purchase is refused (`purchase('boiler').reason === 'demo'`), so the check records `value.skipped` and passes |
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

### WP23b keys (`world.mjs`, T18)

WP23b adds these checks to `world.mjs` on top of the WP23a names (`G_era3_hidden` is replaced by `G_era3_visible`). I to L read the era III to postgame states; the demo build records `skipped` where it cannot reach the state (`value.skipped`), and a skipped check passes. One line per check:
- `G_era3_visible`: S10 = S9 + `@substationBlueprint`, `boiler`: `worldState().hidden` is false and an entry of `livingWorld()` is visible (era III is on).
- `G_display_peak`: `displayObjects()` <= 100 at the era V and postgame peak.
- `I_s10_placed`: era III placements (`worldState().placements`) match the R6 rows (x and row per id); wing and hub rules for non-inner ids, inner ids inside the machine inner bounds.
- `I_s11_placed`: the same placement check on the S11 list.
- `I_s13_placed`: the same placement check on the S13 list (era IV).
- `I_chladni`: case I, S13: `worldState().chladni` >= 1 and the visible `chladni` entry of `livingWorld()` shows `rings-3` (or `rings-5`) (AD4 F7: the one Q6 III -> IV background change that reads; a tier or data regression would otherwise stay green). Demo: skipped.
- `I_s15_placed`: the same placement check on the S15 list (era V).
- `I_umbrella`: S11 vents: the Inspector variant is `umbrellaOpen` and `worldState().vents` is true.
- `I_puddle_sprout`: S11 puddle size >= 1 and sprout >= 1, both visible; S15 puddle look black and sprout 4.
- `I_virga_frozen`: case M, S13 bought in one go from era I (no failed buy), then the era card and 0.5 s: the visible `virga` entry of `livingWorld()` shows the `frozen` frame within 3 s (AD4 F3: the strip kept falling after a direct era IV load).
- `I_sync`: `sync-success` log: DOG-09 and CRW-06 are both in `activeLines` on one sample, PAY-09 after them, `unison` true. Cadence (Z9): the case is on a fresh page, so it first plays `worldQuiet(false)`, `worldAdvance(400000)` and `settle()` (the 90 s first moment, the 60 s warm-up and the 120 s minGap all need scheduler time). The sync chain then waits behind the minGap of the last line (120 s from its start), so the unison is polled for up to 300 s of 1 s steps. After PAY-09 it plays `worldAdvance(130000)` and `settle()` before the observer-one reply. The S13 buys go through the TECH INDEX (`buyInTree`): the era IV girl (GRL-09's speaker) is placed only while the tree is open.
- `I_one_observer`: `observer-one` log: a poll (cap 120 x `worldAdvance(500)` + 120 ms) keeps the first sample where `readout` is `one` and `stare` is true (Z9: the readout and the stare come up after the reply); then INS-10 then GRL-09, each polled up to 300 s of `worldAdvance(1000)` because the chain waits out the minGap of the last line.
- `I_accent_still`: case M, the Inspector entry is sampled once per rendered frame (requestAnimationFrame) for 8 s before (grown in 4 s steps, up to 20 s, until one accent pair is seen) and 8 s after observer-one (the second window only once the stare is on); no two consecutive samples of the same `write0` or `front` variant (at most 200 ms apart, both visible) differ in x (the era IV accent and the stare never slide a walker; walk steps keep their profile frames); each window needs at least 40 samples spanning at least 7500 ms and at least one such pair (no vacuous pass); after the stare at least one `walk` frame is seen; the detail carries samplesBefore / samplesAfter / spanBeforeMs / spanAfterMs. Demo: skipped.
- `I_girl_steps`: S15: girl steps 1, 2 and 3 are exact (`girlSteps` = n, `placements.girl.dy` = 8 x n). g4 accepts 4 or 5 steps with dy = 8 x steps (Z9: the 8 h jump that buys skyAperture also meets finalAlignment, so two steps can land together). g5 needs 5 steps and dy 40.
- `I_girl_step_clamp`: a 50 ms sampler of `placements.girl.dy` (nulls skipped), installed before the first era V buy and read and cleared after g5: at least 5 samples, and no rise between two samples above 12 world px (`WORLD_GIRL.stepMaxWorldPx`).
- `I_nothing_unhappens`: `holeStage`, puddle, sprout and `girlSteps` never fall from S9 to S15.
- `I_double_exposure`: era V: `worldAdvance` until `doubleExposures` >= 1; none under reduced motion.
- `I_reverse`: era V: `reverse` is true.
- `I_stare_dog`: era V, after the observer-one log: the stare is on and a walking dog keeps its profile (walk) frames: no two close samples show the front frame `head` at different x (no sideways glide facing the camera); at least one walk frame is seen. Demo: skipped.
- `J_restore_times`: on a `primaryFunction` save, `finaleSeek` at the derived restore times: script cast row 4 before and row 5 after each denizen's restore time.
- `J_shield`: shield poses from 13.0 to 19.3 s (script cast frames).
- `J_last_look`: LAST LOOK at 59.83 s: stare poses at row 5, girl hidden.
- `J_crow_flight`: crow takeoff at 37.0 s, world crow hidden 38.0 to 47.5 s with `lead`, back on the perch at 49.3 s.
- `J_drawn`: `finaleSeek` at 30, 36, 40, 48.5 and 59.9 s, 350 ms each, then the visible `livingWorld()` ids, the restored girl window as `girlWindow` (the `girl` entry with variant `window-restored`; `girl` is the girl figure only). 30: girl present. 36: girl absent, `girlWindow` absent, crow present. 40: crow absent (the lead flock flies), inspector and dog present. 48.5: crow present. 59.9: girl absent; `girlWindow` (restored at LAST LOOK), inspector, dog, crow and sensor7 present.
- `J_no_bubble`: no living world bubble while the film plays (`worldBubble()` not visible).
- `J_reduced`: reduced motion film: every cast member whole at 24.3 s, girl gone, crow cut 38.0 to 49.3 s.
- `J_skip`: skip (Esc) lands on the end-of-film state (choice, t at the end).
- `K_turn_away`: postgame, KEEP +1.5 s: everyone turns away (inspector idleA, dog sit0, crow perch0, sensor7 headUp).
- `K_mark42`: postgame, KEEP +3 s: the crow scratches mark 42 (three pecks), `marks` 41 plus 1 in cycle 1. Z9 formula: every sample from keepS 5.5 on has `marks + (script.marksPlus ?? 0)` = 42 (`marks` is the state count; `marksPlus` is the crow's extra peck mark on the film script, recorded per sample).
- `K_loop`: the 90 s postgame loop: the Inspector pats the dog at 14.5 s (loop modulo 90).
- `K_pay12`: PAY-12 after 600 s of postgame; at UI 150 the bubble is `above` (over the booth hood) and its box overlaps no HUD button rect.
- `K_pay12_ui100`: the same line forced at UI 100 (`settle()`, `updateSettings({ uiScale: 100 })`, `worldSay('PAY-12')`, poll up to 6 s for the bubble): the bubble is `above` and overlaps no HUD button rect (AD4 F2). The UI scale goes back to 150 after it.
- `K_sensor_turn`: Sensor 7 camera turn once per cycle after 1200 s of postgame (head on the camera, readout 1).
- `K_ins_pg`: postgame via KEEP: the scripted Inspector line (INS-PG) plays once per session.
- `K_drawn`: the visible `livingWorld()` ids in each postgame sample (the restored window as `girlWindow`). The girl figure is never drawn; the restored window (`girlWindow`) is drawn in every sample. The dog is not drawn for keepS 4.6-6.9 (the window must have samples) and is drawn for keepS 9 and later. The crow is drawn in every sample.
- `L_marks`: cycle 2 and 3 saves (through `beginNewCycle`): marks = 40 + cycle.
- `L_red_ball`: cycle 2 and later: the red ball trace is in the living world (`livingWorld()` has `redBall`).
- `L_readout`: cycle 2 and later: the Sensor 7 readout is `one`.
- `L_girl_stage`: cycle 2 and 3 saves: the girl's stage follows the cycle trace (stage 1 in cycle 2, stage 3 in cycle 3).
- `L_pay13`: cycle 2: the PAY-13 / PAY-14 opener plays about 60 s after the first purchase of the cycle. Z9: that purchase is the one made before INS-14, because the onboarding prompt is a hard silence right after `beginNewCycle`.
- `L_cyc_lines`: cycle 2 and 3 saves: after `beginNewCycle` each cycle gets 16 crank clicks, the Gear Ratio purchase and `settle()`. Then INS-14 reads `Same rounds. Page one. You look familiar.` (cycle 2) and GRL-12 reads `Cycle 0044. You came back. So did we.` (cycle 3: `{cycle}` is the 4-digit label 42 + cycle - 1, so 0044).
- `F23_no_flip`: viewport 1280x800, stage s8 (generator), PAY-03 forced six times (each bubble cleared first); the `.wv.on` box is sampled 7 times over 700 ms after it turns on, and its left and top stay within 4 px of the first sample (no flip).

Run a subset with the env `ONLY` (Z9): a comma list of case keys, for example `ONLY=H,I,M,J,K,L`. Keys: A B C D E F G H I M J JR K L F23 (H runs both H cases). Unset runs every case. An unknown key exits 2 before the browser starts.

Debug API added for these checks: `worldState().script` (`null` or `{ active, t, reduced, lastLook, keepS, postgameS, loopS, lead, sensorTurn, marksPlus, cast }`), `worldState().phase, cycle, stare, vents, reverse, eraAgeS, girlStage, girlSteps, marks, readout, puddle, sprout, scraps, windowsLit, virga, chladni, lamp, unison, doubleExposures, opener`, `placements[key]` = `{ x, row, dy }`. The finale keys (`finale_world_*`) are listed under `finale.mjs` above.

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

## Living world v2 (WP24): world.mjs

Same usage and `ONLY` as WP23. The WP24 keys are `NV`, `NC`, `NT`, `NU`, `NK`, `ND`, `NE`, `NY`, `NS`, `NH` (run alone with `ONLY=ND,NE,NY,NS`). The demo edition records `value.skipped` where a check needs era III: NV / NC / NU / NK era III stages, `NE`, `NS`, and the `NY` tint and held checks. Where the demo cap sleeps the world after the S9 buys, the motion checks record `value.skipped` too (demo note below). Each new check name is listed once below. Timing checks (`N_defer_*`, `N_lamp_buzz`, `N_flicker*`, `N_era_fade`) read rAF samples in wall time with one frame of slack (`FRAME_SLACK_MS`); the queue's own `startedAtMs` spacing is exact.

- `N_<s>_distinct`, `N_<s>_no_repeat`, `N_<s>_walk_share`, `N_<s>_lockstep` (NV, 10 min windows at 250 ms steps, s = s7, s8, s9, s10, s11, s13b, s13a, s15): distinct looks (V1), no 4-activity run seen more than twice and no adjacent repeat (V2), walk share at most 30 % (V8) and, for the Inspector and the dog outside era IV, at least 1.5 % (WP28b r2, a dead-roamer floor; an absent actor is skipped), starts within 125 ms of another runner (V5, rest stages low, era IV high). Every value carries the runner `k` at the window start.
- `N_s9_changes`, `N_s11_changes`, `N_s13a_changes`, `N_s15_changes` (NC, V4): every walker, the receiver, the motes, the lamp glow, the booth hood, the Sensor 7 LED, the scraps, the sprout, the Chladni rings and the clock change inside their gap limits over 180 s. The rows listed for the stage in `CHANGE_REQUIRED` must be shown in the window: S9 the receiver, motes 0-4, scrap0, scrap1, the lamp glow, booth hood, Sensor 7 LED and clock; S11 the receiver, motes 0-4, scrap0, the sprout, the lamp glow, booth hood, Sensor 7 LED and clock; S13 (after) the lamp glow, booth hood, Sensor 7 LED and clock; S15 the booth hood, Sensor 7 LED, rings 0-2 and clock. A required row never shown fails as `missing:<key>` in `over`. The walkers stay checked by the `denizens` test.
- `N_s13a_rendered`, `N_s15_rendered` (NC, stare): under the stare each walker shows at least 3 distinct rendered states and no variant outside `WORLD_STARE_SAFE`.
- `N_no_teleport` (NT, V6): walker x steps at most 8 world px on a walk and 4 px at rest over 15 s, with a forced glance (WP28b r1: on a flight the bound is time-aware, see the WP28b action-gap section). Demo: skipped (demo note) when the cap sleeps the world.
- `N_umbrella`, `N_umbrella_talk` (NU, replaces `I_umbrella`; the trigger is read from the behaviour log, not from snapshot sampling): seen = a natural Inspector umbrella is logged with `reaction` true (1 s `worldAdvance` steps, 180 at most); talk = `worldBehaviourNext('inspector', 'umbrella')` pins a new umbrella, and the forced INS-08 line shows `talkUmbrella` while that pinned umbrella is open; ended = an umbrella entry in the log after the pin cursor (the last log entry before the pin). The demo skips both.
- `N_crank` (NK): one crank click steps every visible walker by one (a parked walker, the girl in the window stage, is not counted: her step stays 0), and `worldBehaviour()` holds for 2 s without clicks. `N_reduced` (WP24 r2): one reduced-motion page, stages S9, S11 and S13 in that order (each buys the rest of its cumulative list), 10 min each. Per stage: the receiver stays on `hang` on every shown sample; the micro flags `hitch`, `clockTwitch`, `lampDip` and `boothDip` are never true (read per sample from `worldDay().micro`, `micro.samples` must be above 0); every runner shows at least 3 activities (the girl at S9: 2, the mini has two before the vents). No Sensor 7 term: its double blink is canon under reduced motion and draws the front head.
- `G_cost` (G, WP24 r2): the check value also carries `parts`, the `worldStats().parts` means in ms (`cast`, `props`, `atmos`, `clocks`, `runners`), read once after the 20 samples. Informational: the 0.3 ms limit and the gate are unchanged.
- `N_defer_hold` (ND): TECH INDEX open 3 s after the S9 buys: the lamp variant is still `dead`, and `worldTransitions()` lists the lamp, booth and windows.
- `N_defer_start` (ND): the first start is at least 1000 ms after the index closes (one frame of slack), starts are 600 ms apart or more, and nothing starts while the index is open.
- `N_windows_stagger` (ND): all six windows light one at a time, in window order, and the first and the last rise are 15 s apart or more. A window is lit when its series rises by 0.05 or more (peak minus its first sample) and reaches 95 % of its peak at a later sample. The sampler runs 50 s; `det` lists `[id, rise sample, ms, peak]`.
- `N_lamp_buzz` (ND): the lamp reads lit for good from 2.5 s or more after its start.
- `N_flicker` (ND): at most 3 on-to-off alpha toggles per 1 s window for the lamp glow, the booth hood and `window0`-`window5`. `lampToggles` in the value (informational) counts the lamp variant changes per 1 s window.
- `N_flicker_reduced` (ND, reduced-motion page, same buys on a fresh save): from the lamp's first start over 9 s (3 s buzz, 4 s glow, 2 s slack) the `lampGlow` prop row reaches 0.2, never falls by more than 0.01 from its first sample above 0.02, and the lamp variant changes at most once (a plain fade). The lamp entry's top alpha is not read.
- `N_era_fade` (NE): `worldTransitions()` `eraRow` entries per `worldAdvance(250)` step: k starts at 0.05 or less, never falls, reaches 0.95 before the row leaves, and `durMs` (read at the first positive k) is at least 8000. The ramp is not timed on the step grid (real frames add their own steps); up to 120 steps.
- `N_day_bands` (NY): `worldDay().target` at S0, S9, S11 and S15 lies in 540-660, 660-780, 780-880 and 950-1001 and rises strictly; `min` never falls. Demo: the target stays at or under 780 after the cap.
- `N_day_tint` (NY): at the holds 540, 780, 950 and 1001 (`worldDayHold`), the tint has R >= G >= B and brightness max(R, G, B) / 255 >= 0.86.
- `N_day_held` (NY, postgame on a fresh save): after KEEP and 10 s of settle, 60 s of advance with `min` 1001, `tint` `0xdcc3a6` and `wind` 0.
- `N_settle` (NS): S9, `worldSettle(true)`, the era III buy: `worldTransitions()` empty within 1 s, every runner `step` unchanged for 3 s, `worldDay().min` equals the target.
- `N_demo_hold` (NH, demo only): the S9 buys open the END OF DEMO card (cap 70 s), then KEEP TINKERING, `worldAdvance(21000)` and PAY-05, INS-07, GRL-06 and DOG-12 seen in order, 125 s apart (each seen within 10 s). One run is 80 s of advance in four 20 s steps, with a 400 ms settle after each step. It runs twice: right away, and after `saveNow()` and a reload (the seen state comes back from the save). It reads `worldBehaviour()` `k` of the Inspector and the crow, and the dog variant from `livingWorld()`. Pass in both runs: the Inspector `k` grows by 3 or more, the crow `k` by 2 or more, and the dog variant is `lie` at the end. Why: DOG-12 suspends the dog runner only. A hold that parks every runner (the WP24 r3 bug, fixed in `LivingWorldDirector.ts`) freezes the walkers, and `demo.mjs` G_hold checks the dog only. Full edition: skipped (the demo hold exists only in the demo build).

Demo note (A10): `demoSilence` reads the world after the S9 buys (the S9 variety and changes rows, NT and ND). The world is silent when the reason is asleep, the layer hidden or the tab hidden, or when `worldState().playMs` does not move over two frames (quiet comes first in the reason order and hides asleep, so the clock is read too). Then the motion checks of those cases record `value.skipped`: the S9 variety and changes rows, the no-teleport check and the ND motion checks (not the hold check). The full build is strict. The ND race fix (WP24 r2): `deferRun` reads the silence right after the buys and again after its sampling window, and the first non-null read decides. A world the cap puts to sleep during the 3 s hold is recorded as `value.skipped` (not a failed timing check), and the full build still reads null.

Existing checks changed under WP24:
- `A_frozen`: unchanged (crank mode has no real-time progress).
- `A_crank_step`: reads `worldBehaviour()`: every visible walker's `step` is one more after one click. A parked walker (the girl in the window stage) is not counted.
- `I_chladni`: `drain(['chladni'], 60)` after the S13 buys, then the variant read as before.
- `I_virga_frozen`: `drain(['virga'], 120)`, then `frozen` within 3 s.
- `I_puddle_sprout`: `drain(['puddle', 'sprout'], 120)` before the `vis11` read and before the black puddle read.
- `I_stare_dog`: after the stare, `worldBehaviourNext('dog', 'wander')`, then the 24-sample loop as before.
- `I_accent_still`: `worldBehaviourNext('conductor', 'still')` before the stare; `worldBehaviourNext('conductor', 'beat')` after it, then the 8 s sampler (the Inspector walks on its first downbeat).

Settle lines (WP24, no wait, keyframe or check changed): `finale.mjs` calls `window.__wedtmd?.worldSettle?.(true)` before its 15 s sky wait, and `showcase.mjs` before each of its two 15 s sky waits (`showcase_A`, `showcase_B`).

Debug members used by the WP24 checks: `worldBehaviour()`, `worldBehaviourLog()`, `worldBehaviourNext(actor, activity)`, `worldDay()`, `worldDayHold(min)`, `worldTransitions()`, `worldSettle(on)`, `worldProps()`, `worldState()` (`silence`, `playMs`), and the `alpha` / `y` fields of `livingWorld()`.

## Passive-first economy (WP25): `economy.mjs`

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/economy.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/economy
```

Fresh context per case, 1280x720, deviceScaleFactor 1. Case `A` has its own context; cases `B` to `G` share one fresh page (era II only). On the demo build the run first skips the cap teaser and presses KEEP TINKERING (step `B_demo`), then runs the same checks. Prints ONE JSON object `{ results, fail, errors }`; expect `fail` and `errors` to be `[]`. Each case waits for `componentState('handCrank')`. An exception adds `FAILED:<case>:<message>` to `fail` (on the shared page the key is the group: `B`, `C`, `D`, `E`, `F` or `G`) and the run goes on.

| case | what it does | checks (names in `results` / `fail`) |
|---|---|---|
| `A` (fresh) | waits 5 s without a click, then 45 crank clicks and `wornMotor`; polls up to 4.5 s for the first popup | `A_no_tick_before_click` (`outputStats()` not null, `shown` 0 and `visible` 0), `A_buy` (the failed-buy list is empty), `A_tick` (`shown` >= 1 and the latest popup text is `+<n> ME`; value `{ shown, last }`) |
| `B`-`G` (one shared page) | 45 crank clicks, the S9 list and `@crankServo:3` (`B_buy`: the failed-buy list is empty), the era card click-away, `B_demo`, 500 ms | (see the rows below) |
| `B_demo` (step of `B`-`G`, demo build only) | when `demoState()` is not null: waits up to 8 s for the cap teaser, clicks `#demo-skip` if it runs, then clicks `#demo-keep` (KEEP TINKERING) on the card and waits for phase `idle`; 500 ms. On the full build `demoState()` is null and it returns at once | no check name; a throw adds `FAILED:B_demo:<message>` to `fail` |
| `B` tab II | `t`, click `#tech-tab-2`, count the rendered `.tech-node[data-tech=crankServo]`, screenshot `economy-B-tab2.png`, then tab IV if it is enabled, Esc | `B_tab_two` (one rendered Crank Servo node on tab II, none on tab IV, the tree closed; value `{ onTwo, onFour, fourLocked }`) |
| `B` AUTO-CRANK line | reads `#hud-auto` (polled up to 3 s) | `B_auto_line` (matches `^AUTO-CRANK 3/s · [+][^ ]+ EE/s$`; value is the text) |
| `B` servo parts | reads `componentState('servoBase')` and `componentState('servoArm')` (polled up to 3 s) | `B_parts` (both visible; value `{ base, arm }`) |
| `C` click worth | reads `#hud-per-click` (polled up to 3 s) and the `title` of the `.hud-click` row | `C_worth` (the text ends with ` · <n>s` or ` · <0.01s`), `C_title` (the title matches `^One turn of the crank = .+ s of machine output$`) |
| `D` photo mode | `photoMode(true)`, 400 ms, then 6 s | `D_photo` (`shown` unchanged and `photoState().active` true; photo mode is turned off after) |
| `D` reduced motion | `reducedMotion: true`; up to 3 attempts: wait for a visible popup (cap 8 s), 4 samples 250 ms apart; reduced motion off after | `D_reduced` (3 or more samples with `visible` >= 1, all with `rising` false and the same non-null `y`; value = the samples of the last attempt) |
| `E` quiet | `setOutputTicks(false)`, 300 ms, then 12 samples 500 ms apart; ticks back on | `E_quiet` (`shown` frozen and `visible` 0 in every sample; value `{ s0, samples }`) |
| `F` HUD fit | `uiScale` 100, 125, 150 (400 ms each; shot `economy-F-<ui>.png`); back to 100 | `F_hud_fit_100`, `F_hud_fit_125`, `F_hud_fit_150` (`#hud-per-click` and `#hud-auto` one line each, inside `#hud-panel`), `F_hud_fit` (all three) |
| `G` output cost | ticks on, reduced motion off, 30 s of popups | `G_output_cost` (`shown` > 0 and `meanMs` <= 0.05; value `{ shown, meanMs }`) |

Notes:
- Tab IV is a disabled button until era IV is reached. The script clicks it only when it is enabled; `fourLocked: true` in the `B_tab_two` value means it was not clicked and `onFour` is 0 by lock.
- Hidden tech nodes stay in the DOM (`hidden`), so the Crank Servo count only includes rendered nodes.

Debug API used (WP25 C6): `outputStats()` returns `{ shown, visible, y, rising, last, meanMs }` or `null`: `shown` = popups started, `visible` = popups on screen, `y` = world y of the newest visible popup (`null` when none), `rising` = false under reduced motion, `last` = the latest popup text, `meanMs` = mean `update()` ms over the last 300 frames. `setOutputTicks(on)`: off also hides the visible popups at once. The checks also use `photoMode`, `photoState`, `componentState`, `techTreeOpen`, `hudState` and `session.updateSettings`. A build without the hook reads `null` and the checks fail by name.

Store shots (`store-shots.mjs`, WP25 C7): every shot adds `<size>_<id>_<variant>_no_output_tick`. It passes when the page has no visible popup and `shown` is unchanged since that page's `quietWorld` call; it passes when the hook is missing.

Expected run: `fail: []` and `errors: []` on `http://localhost:4175/?debug=1` (full) and on `http://localhost:4176/?debug=1` (demo). `G_output_cost` needs a quiet PC: 30 s of popups on a loaded machine can push `meanMs` past 0.05 without a real regression.

## Weather audio (WP26): weather-audio.mjs

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/weather-audio.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/weather-audio
```

Levels only, never timing. Fresh context per case, 1280x720, deviceScaleFactor 1. Case `MAIN` runs one page (the full edition goes through eras I to V, the demo through eras I and II); `REDUCED` and `TEASER` each get a fresh page. Each page takes 45 real crank clicks (they unlock the audio and bank the ME that Worn Motor costs; as `economy.mjs`), then reads `audioStats()`: the last 200 ms ambient tick (`windGain`, `windLfo`, `rainGain`, `rainHz`, `live`) and `levels.wind`. Those reads are post-gate: zero when muted, in the choice and in the postgame. The windows advance the world in 1 s steps (`worldAdvance`). Prints ONE JSON object `{ edition, results, fail, errors, samples }` and writes `<outdir>/weather-audio.json`. Exit 1 when `fail` or `errors` is non-empty, 2 on usage.

Expected run: fail [] and errors [] on http://localhost:4174/?debug=1 (full) and http://localhost:4177/?debug=1 (demo).

Constants (mirrored by hand from `src/data/audio.ts`, one block at the top of the script): `WIND_GAIN` 0.05 (AUDIO.wind.gain), `WIND_FLOOR` 0.3 (AUDIO.wind.floor), `FLOOR_GAIN` = WIND_GAIN x WIND_FLOOR = 0.015, `TOL` 0.0005 (level tolerance). `RAIN_HZ_MIN` 1800 and `RAIN_HZ_MAX` 3200 mirror AUDIO.rain.hzMin / hzMax. A "zero" check passes when the value is within TOL of 0.

Settle note: `worldSettle(true)` forces the gusts off (constant wind). Each stage therefore lands with settle on for 700 ms and then settle off before its variation window. Never read a wind window while settle is on.

| check | what it means |
|---|---|
| `W_unlock` | 45 crank clicks set `audioUnlocked()` true (poll up to 3 s) |
| `W_ambient_present` | `audioStats().ambient` is non-null after the first tick |
| `S7_buys`, `S9_buys`, `S11_buys`, `S13_buys`, `S15_buys`, `FINALE_buys`, `REDUCED_buys` | the failed-buy list is empty (value = the failed entries) |
| `S7_live`, `S9_live` | every 20 s window sample has `live` true (value = count of samples that are not live) |
| `S7_wind_varies`, `S9_wind_varies` | max - min of the wind gain over the 20 s window is at least 0.1 x WIND_GAIN |
| `S7_rain_zero`, `S9_rain_zero` | the max rain gain over the window is within TOL of 0 (no virga before era III) |
| `S7_wind_range`, `S9_wind_range` | every wind gain is within [FLOOR_GAIN - TOL, WIND_GAIN + TOL] |
| `S7_no_lfo`, `S9_no_lfo` | `windLfo` is false in the last sample |
| `S11_rain_positive` | the rain gain goes above 0 within 5 s of landing era III (poll every 250 ms, no world step) |
| `S11_virga_visible` | diagnostic only: `livingWorld()` has a visible `virga` entry; reported in results, never in fail |
| `S11_rain_hz` | the rain pitch is within [1800, 3200] Hz |
| `S13_rain_zero` | the max rain gain over the first 15 s of the 70 s window (era IV, no settle) is within TOL of 0 |
| `S13_wind_floor` | the last wind gain of the 70 s window is within TOL of FLOOR_GAIN and `windLfo` is false (the base wind eases to zero over about 60 s) |
| `S15_rain_zero`, `S15_wind_floor` | after landing era V: rain within TOL of 0, wind within TOL of FLOOR_GAIN |
| `MUTE_zero` | muted for 600 ms: wind gain and rain gain within TOL of 0, `levels.wind` false (full at S15, demo at S9) |
| `MUTE_restore` | unmuted for 700 ms: wind gain above 0 |
| `FINALE_buys` | `primaryFunction` buys (full only) |
| `FINALE_floor_before_stop` | `finaleSeek(10)`, 600 ms: wind gain within TOL of FLOOR_GAIN |
| `FINALE_wind_stop` | `finaleSeek(20)`, 800 ms: wind gain within TOL of 0 and `levels.wind` false. When the seek does not fire the beat, the script seeks 18.5 and plays 2 s; the value has `fallback: true` |
| `POSTGAME_wind_zero` | after `skipFinale()` and KEEP IT RUNNING, 1.5 s: wind gain within TOL of 0 and `levels.wind` false |
| `S9_reduced_wind_varies` | reduced motion on, the 20 s window after S9: max - min of the wind gain is at least 0.1 x WIND_GAIN |
| `TEASER_live_false` | `showcasePlay()` makes `ambient.live` false within 3 s |
| `TEASER_back` | report only (boolean, never in fail): `ambient.live` is true again within 4 s after `showcaseStop()` |
| `DEMO_rain_always_zero` | demo only: the max rain gain over the S7 and S9 windows is within TOL of 0 |
| `FAILED:<case>:<message>` | a thrown error in that case (in `fail`) |

## Faults and wind-up (WP27)

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/faults.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/faults
```

`faults.mjs` (WP27 C13) runs the fault cases `A` to `O` in ONE browser, a fresh context per case, 1920x1080 unless a case says otherwise. Prints ONE JSON object `{ results, fail, errors }`; `errors` holds the page errors and the console errors. Expected run: `fail: []` and `errors: []` on `http://localhost:4174/?debug=1` (full) and on `http://localhost:4177/?debug=1` (demo, where case `O` is the demo case).

| case | setup | checks (names in `results` / `fail`) | shots |
|---|---|---|---|
| `A` locked | fresh run (waits until `faultStats()` is non-null, the lazy marker), then 10 s | `A_locked` (`faultStats().unlocked` false, `spawned` 0, no marker) | none |
| `B` unlock | S7 list and `faultLamp` | `B_toast` (install toast with the Fault Lamp line), `B_tree` (faultLamp node on tab I at slot (5,2)) | none |
| `C` spawn | `forceFault()` | `C_marker` (within 1.5 s: `marker.visible`, the centre inside the viewport and within 120 screen px of the anchor part), `C_announce` (the world-voice live region contains `Fault:`) | `faults-C-e1.png` |
| `D` clear by pointer | click `client` (the marker centre) | `D_caught` (caught +1; ME and every other energy with perSecond > 0 gained at least 0.95 x payoutSeconds x perSecond), `D_popup` (the first line of the newest gain block is `CLEARED +<payout seconds>s`, e.g. `CLEARED +15s` in era I, within 1 s), `D_cue` (audio fault-clear count +1) | none |
| `E` clear by key | `forceFault()`, press `f` | `E_key` (caught +1) | none |
| `F` miss | `forceFault()`, wait the window + 1.5 s | `F_missed` (missed +1, resources unchanged apart from passive income, marker hidden), `F_input` (`marker.interactive` false) | none |
| `G` no stacking | `forceFault()` twice while alive | `G_single` (spawned +1 only) | none |
| `H` gates | photo mode on, then `forceFault()`; TECH INDEX open, then `forceFault()` | `H_photo`, `H_tree` (no marker, `alive` stays null for 3 s; a spawn within 1.5 s after closing) | none |
| `I` reduced motion | reduced motion on, `forceFault()` | `I_steady` (`marker.tagFrame` and `fxFrame` constant over 6 samples in 2 s, each at least 0) | none |
| `J` eras | S9, S11, S13 and S15 lists, `forceFault()` each | `J_anchor_<era>` (marker on an anchor of that era, on screen; era V's list is `graviticAnchorR` and `generator`, see `FAULT_MARKER.anchors` in `src/data/faultMarker.ts`) | `faults-J-<key>.png` (`e2` to `e5`) |
| `J_e5in` | own run: S14 list (S13 + `nullChamber`, era V without the Gravitic Anchor) and the fault techs, `forceFault()` | `J_e5in` (within 1.5 s: marker visible, `anchor` `generator` (era V's second anchor; the crank fallback is no longer used in era V), `eligible` true) | `faults-J-e5in.png` |
| `K` Overdrive | S15 list and `overrunClutch`, `forceFault()`, clear | `K_overdrive` (`overdriveLeft` 5-6 s right after; the HUD WIND-UP row contains `OVERDRIVE`) | none |
| `L` wind-up | after Reinforced Crank: wait 12 s, one click | `L_release` (`gainLines()[0]` matches `/^RELEASE \+\d/` right after the click; the store is 0 at the `'click'` event and the event's `released` (seconds paid) matches the stored seconds read before the click) | none |
| `M` quiet | `setFaults(false)`, then `forceFault()` | `M_quiet` (no marker for 3 s) | none |
| `N` cost | 30 s with a fault alive (S9) | `N_cost` (`marker.meanMs` at most 0.05) | none |
| `O` demo | dist-demo (`:4177`): S7 + `faultLamp`, S9 + `dischargeLever` | `O_demo` (B, C, D and E pass; the `dischargeLever` node on tab II at (5,0); the tab III node shows FULL GAME) | none |

`I_steady`, `L_release` and `D_popup` are real checks now (no skip and no hook gap): `I` reads the marker frames, `L` reads the RELEASE line from `gainLines()` and the store at the `'click'` event (a one-shot `session.on` probe: the store is 0 there and `released` matches the stored seconds), `D` reads the clear popup header from `gainLines()`. The skips left are the demo era cap (eras III-V) and case `O` on the full build. `J_e5in` is the one new case (WP27 F-SMOKE).

Debug API (WP27 C11, `src/game/debugHook.ts`):
- `faultStats()`: `{ unlocked, alive, nextIn, spawned, caught, missed, overdriveLeft, eligible, marker, client, anchorClient }`, or `null` without a World scene or marker (the marker is a lazy chunk: it may be absent for the first moments after load). `marker` is the FaultMarker `stats()` (`visible`, `interactive`, `eligible`, `anchor`, `anchorWorld`, `code`, `x`, `y`, `age`, `window`, `shown`, `cleared`, `missed`, `meanMs`, `tagFrame`, `fxFrame`). `anchorWorld` is the anchor part's top-centre point in world px (`null` without an anchor); `tagFrame` and `fxFrame` are the last frames set on the tag and FX sprites (`-1` before the first set; `I_steady` compares them). `client` is the marker centre in client px (`null` while hidden); `anchorClient` is the anchor point (the part's top centre) in client px (`null` without an anchor). The smokes click `client`.
- `gainLines()`: the text of each line (`string[]`) of the newest floating gain block: the crank block (its first line is `RELEASE +0.3s`-style after a wind-up release) or the clear popup (its first line is `CLEARED +<payout seconds>s`); `null` without a World scene.
- `forceFault()`: calls `session.debugForceFault()`; the next eligible clock step spawns a fault. `false` when refused.
- `setFaults(on)`: the marker gate. Off hides a live marker and freezes the clock. No-op without a marker.
- `windupStats()`: `{ stored, cap, refill }`: the stored wind-up seconds, the cap (seconds) and the refill (seconds per second).

HUD fit (`economy.mjs`, `F_hud_fit`): the table row `F` of the WP25 section also checks the WIND-UP row (WP27 C8, `#hud-windup`; visible once Reinforced Crank is owned, which the S7 list gives) at UI 100, 125 and 150. The row is one line, its whole box lies inside `#hud-panel` (`windup.contained`), and the panel lies inside the viewport (`panelInView`). The per-scale records `F_hud_fit_100`, `F_hud_fit_125` and `F_hud_fit_150` carry `windup` and `panelInView`; `F_hud_fit` is still the AND of the three scales. The CLICK and AUTO-CRANK checks are unchanged.

### Crow talk (`world.mjs`, `crowTalk_e1` and `crowTalk_s8`)

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright ONLY=crowTalk_e1,crowTalk_s8 node scripts/smoke/world.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/world
```

Each case is a fresh run at UI 150 (the framing `caseD` checks): the hook buys (`buyList`), the F6.4 commit step (press `t`, 1.2 s, Escape), then the placements at the framing (`e1` or `s8`). `worldSay` forces the crow's line: `CRW-01` (era I, log reply) for `crowTalk_e1`, `CRW-04` (crossedLines step 2) for `crowTalk_s8`. Within 1.5 s the crow entry of `livingWorld()` has `speaking` true; then six samples 600 ms apart (3 s) show its `variant` in `perchHead` / `perchTalk` only (never `head`, `talk`, `frozen` or `frozenTip`). Both cases also run in the full run and on the demo edition (eras I and II are open there).

| check | what it means |
|---|---|
| `crowTalk_e1` | the buys and the e1 placements pass, `worldSay('CRW-01')` is true, the crow speaks and the six samples are folded-wing poses. Shot `world-crowTalk-e1.png`. Value: `buyFail`, `problems`, `said`, `speaking`, `poses` |
| `crowTalk_s8` | the same at framing s8 with `CRW-04`. Shot `world-crowTalk-s8.png` (also taken on a skip). When `worldSay` refuses `CRW-04` (the chain gate) the check records `value.skipped` with the reason and does not fail; AD2 checks a crossed-lines chain by eye on the shot. A failed buy or placement still fails |

### Store shots: `_no_fault` (`store-shots.mjs`)

`quietWorld` also turns the fault marker gate off (`setFaults(false)`), and every shot adds `<size>_<id>_<variant>_no_fault`. It passes when `faultStats()` is null (no World scene, or a build without the hook) or `faultStats().marker.visible` is false. The check sits next to `_no_output_tick`.

## Finds, Splices and pokes (WP28a)

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/finds.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/finds
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/splices.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/splices
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/pokes.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/pokes
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/economy.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/economy
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/store-shots.mjs "<preview>" C:/Users/<you>/AppData/Local/Temp/smoke/store
```

Each script runs ONE browser, a fresh context per case, 1920x1080 (economy.mjs: 1280x720, as before). Each prints ONE JSON object (`finds`, `splices` and `pokes` add `edition`; `{ results, fail, errors }` otherwise) and writes `<outdir>/<name>.json`. `errors` holds the page errors and the console errors. Exit 0 when `fail` and `errors` are empty, 1 otherwise, 2 on a usage error. Expected run: `fail: []` and `errors: []` on `http://localhost:4174/?debug=1` (full) and on `http://localhost:4177/?debug=1` (demo). A skip is `{ skip: reason }` in `results`, never in `fail`. Setup checks `<KEY>_buys` (a buy list of a case, `buyList`) sit in `results` and fail the run when a buy fails.

The buys use `buyList` (`lib/common.mjs`), then the F6.4 commit step (press `t`, wait 1.2 s, Escape, 2.5 s, dismiss the era card, cursor off the canvas). The cast moves to a new framing only while the TECH INDEX is open, so the commit step comes before any framing-dependent check.

### `finds.mjs` (Finds, WP28a C15)

| case | setup | checks (names in `results` / `fail`) | shots |
|---|---|---|---|
| `A` locked | fresh run, 10 s | `A_locked` (`unlocked` false, `spawned` 0, no marker) | none |
| `B` spawn | S7 list, `forceFind()` | `B_marker` (within 1.5 s: visible, centre inside the viewport, `marker.spot` at least 0), `B_announce` (the live region contains `glints`) | `finds-B-e1.png` |
| `C` pointer | S7 list; three picks, each `forceFind()`, then a click on the marker centre once its client point holds still (two reads 150 ms apart are equal, 1.5 s cap: the first Find's crow drop moves it for about 300 ms) | `C_caught` (caught +1, and every energy with a rate gained at least 0.95 x s x perSecond, s read from the popup; the detail has `settled`, `reads` and `clickAt` per pick), `C_popup` (at least one `FOUND +<s>s` popup seen; every seen one has s = 4, 6 or 8), `C_cue` (audio `finds` +1 per pick) | none |
| `D` key | `forceFind()`, press `g` | `D_key` (caught +1) | none |
| `E` expire | `forceFind()`, wait 26.5 s | `E_gone` (marker hidden, alive null, missed +1), `E_input` (`marker.interactive` false), `E_quiet` (no `miss` text in `document.body`) | none |
| `F` single | `forceFind()` twice | `F_single` (spawned +1 only) | none |
| `G` gates | photo mode on, `forceFind()`; then the live Find is cleared (`clearLive`); TECH INDEX open, `forceFind()` | `G_photo`, `G_clear` (WP28b r1: the Find is taken before the next gate; each try waits for the marker, presses G and polls for caught +1; up to 5 tries 500 ms apart; the detail carries `visibleAtPress`), `G_tree` (no marker for 3 s; a spawn within 1.5 s after the gate closes) | none |
| `H` reduced motion | reduced motion on, `forceFind()` | `H_steady` (`marker.glintFrame` constant over 6 samples in 2 s) | none |
| `I` relic | four Finds by the key path (serials 0-3), then serial 4 (a relic) | `I_toast` (toast titled `FIELD NOTE 1/15`, `1/6` on the demo), `I_records` (RECORDS `FIELD NOTES 1/15`, note 1), `I_save` (after a save and a reload, `world.relics` is 1) | none |
| `J` coexist | S7 list and `faultLamp`; `forceFault()` and `forceFind()` | `J_both` (both markers visible; `f` clears the fault; `g` takes the Find) | none |
| `K` cost | S9 list, 30 s with a Find kept alive | `K_cost` (`marker.meanMs` at most 0.05; a first read above it waits 5 s and reads again, and the second read passes; the detail holds both reads as `meanMs: [first, second]`) | none |
| `L` demo | demo build only (`:4177`): S7 list; B, C and D, then serials 2-4 (the relic) | `L_demo` (B, C and D pass; RECORDS `FIELD NOTES 1/6`); full build: skip | `finds-L-demo.png` |

Each Find pays 4, 6 or 8 s (`FINDS.payoutS` 6 with `payoutSpreadS` [-2, 0, 2]); the popup header is `FOUND +<s>s`. A relic pays nothing and shows the FIELD NOTE toast.

### `splices.mjs` (Splices, WP28a C15)

| case | setup | checks | shots |
|---|---|---|---|
| `A` dead | S7 list | `A_placed` (bicycle, organ and clock placed and visible; none woken; no line anywhere) | none |
| `B` hover | S7 list, hover the bicycle | `B_cursor` (canvas cursor `pointer`), `B_tip` (`.wv-tip.on` lines: `SPLICE · BICYCLE`, `900 ME`, `+5% automation`, a state line; the crank hub is outside the tooltip box) | none |
| `C` buy by click | S7 list, one 8 h jump, click the bicycle | `C_woken` (state `woken`, frame changed, `line` true, `pulses` 1-4), `C_order` (samples every 30 ms up to 300 ms after the click: the frame reads `dead` in a sample within 300 ms while the state is `woken`, and reads `woken` at 1.5 s; the wake beat holds the dead frame, so the pulse runs before the wake; reduced motion passes), `C_toast` (`Line spliced. Wheel turning. Direction disputed.`), `C_announce` (`Spliced: Bicycle`), `C_cue` (audio `splices` +1) | none |
| `D` deny | fresh run; `wornMotor` bought (the first-run onboarding silence keeps every poke target disabled until then; `pokeTargets()` polled for an enabled one, 20 s cap); then click the organ, then the bicycle (both locked) | `D_deny` (level unchanged, audio `denies` +1 per click, the state line `NEED ... MORE ME` or `LINE NOT IN REACH`; the detail has `silence` `{ firstBuy, enabled }`) | none |
| `E` keyboard | S7 list, 8 h jumps until the clock is affordable; `t`; Tab until the selected tab (`role` tab, `tabindex` 0), End (SPLICES), Enter; Tab to the clock row, Enter; Tab to `BUY`, Enter (the tablist has a roving tabindex) | `E_tab` (the SPLICES tab shown, `data-affordable` at least 1), `E_bought` (focus steps `reachedSelected`, `reachedTab`, `reachedRow`, `reachedBuy`; clock `woken`), `E_esc` (Escape closes the TECH INDEX) | none |
| `F` era II | S9 list, radio, payphone and sign | `F_s9` (every era I-II object placed; the documented exemptions are none at s9) | `splices-F-s9.png` |
| `G` pulses | S7 list and the bicycle, then S7 to S11 (more output); demo: skip | `G_scale` (pulses at least 1, non-decreasing, at most 4) | none |
| `H` reduced motion | S7 list and the bicycle, reduced motion on | `H_static` (woken frame constant over 6 samples in 2 s; `pulses` 0) | none |
| `I` prestige | S7 list, bicycle and organ woken, S15 and `primaryFunction`, `skipFinale()`, `#finale-cycle` and `#cycle-confirm-begin`; demo: skip | `I_dark` (every Splice `locked` or `available`, no line), `I_log` (SYS LOG toast `Lines cut: 2. Objects dark again.` within 20 s of the transition end; no cycle toast has `LINES CUT`) | none |
| `J` BUY MAX | S9 list, 8 h jump, TECH INDEX on era II, Shift+click `copperWinding` | `J_max` (level +2 or more in one action; resources at least 0), `J_once` (one `purchase` event through `session.on` and exactly one save write (the `wedtmd.save` key, through a `Storage.prototype.setItem` wrapper) stamped within 100 ms before to 600 ms after it; the 15 s autosave interval is a no-op in that page (`noAutosave`); 20 s of idle writes are counted first and recorded as `idle20sWrites`), `J_audio` (`liveVoices` at most idle + 3 at 150 ms), `J_frame` (longest rAF frame in the click second at most `max(50, idle + 60)` ms; `idle` is the same rAF probe over an idle second first; the detail has `idleLongestMs` and `boundMs`) | none |
| `K` NEXT BUY | S7 list, then a spend-down: every affordable tech (`getAllTechViews()`) gets `purchaseMax` (repeatables) or `purchase` (unlocks), round after round (200 cap) until none is affordable; `#hud-tech` `data-affordable` cleared (2 s) | `K_text` (`nextBuyText()` matches `NEXT BUY: <name> · ~<n><h|m|s>[ <n><m|s>]`; `#hud-tech` `data-affordable` empty; the detail has the spend-down `spent` and `cleared`) | none |
| `L` demo | demo build only (`:4177`): S9 list | `L_demo` (the six era I-II Splices placed and not locked; the era III-V rows in the SPLICES tab read `FULL GAME`); full build: skip | `splices-L-demo.png` |
| `N` drag | S7 list, 8 h jump, a 120 px drag from the bicycle | `N_drag` (camera centre moved at least 40 world px; bicycle level 0) | none |

### `pokes.mjs` (pokes, WP28a C15)

| case | setup | checks | shots |
|---|---|---|---|
| `A` hover | S7 list; hover the Inspector, dog, crow, Sensor 7 and payphone | `A_brackets` (`pokeStats().hover` names each target in turn; cursor `pointer`) | none |
| `B` answer | S7 list; `poke('inspector')` (debug), then a real click on the Inspector | `B_fast` (`pokeStats().last.inspector.reaction` is set within 0.1 s; within 0.6 s the Inspector's `livingWorld()` variant differs from before or equals the first frame of that reaction's clip: the Inspector can show that frame before the poke, so a change alone can miss it; the first frames are mirrored from `src/data/pokes.ts`), `B_sound` (audio `pokes` +1 at 200 ms after the click: the ack tick) | none |
| `C` variety | ten dog pokes, 1.2 s apart, each after `pokeReset()` | `C_noRepeat` (no two consecutive identical reactions) | none |
| `D` ladder | four dog pokes within 6 s, then a 5th and a 6th | `D_leave` (level 3 after the 4th; the dog's x moved at least 16 px; the 5th and 6th are `dogIdleHead` / `dogIdleLookUp`, different from each other) | none |
| `E` crow hop | four crow pokes | `E_hop` (the crow moved at least 8 px from its perch; its x stayed right of the machine anchor) | none |
| `F` girl | window girl at e1; poke `girl` | `F_still` (x and feet y unchanged over 3 s, read 20 times 150 ms apart; her window frame changed: a read shows a `variant` other than the start frame (the answer's dark or other flicker frame; an `alpha` change alone does not pass, `lit`)) | none |
| `G` Sensor 7 | e1: pointer right of the tripod, then at its centre; s9 (`delta(S7, S9)`, commit): pointer left of it. The offset is 260 world px x camera zoom x canvas scale (client px) | `G_track` (`livingWorld()` variant `headR` and `headC` at e1, each within 0.5 s of the pointer move; `headL` at s9 within 0.5 s, after a pan drag that pokes nothing (`pan.pokeFree`); a `headL` target that is off the canvas is a `{ skip }` with its reason, and the e1 `headL` always is one: the tripod is about 156 client px from the left edge) | none |
| `H` economy | 20 pokes over 30 s | `H_none` (each energy gained its rate x elapsed, within 1 %) | none |
| `I` silence | photo mode on, then off; then S15 and `primaryFunction`, `skipFinale()` (demo: photo mode only) | `I_off` (`pokeTargets()` has targets and every one is disabled) | none |
| `J` crank | 20 real clicks on the hub | `J_crank` (20 `click` events; no poke; the answered list unchanged) | none |
| `K` reduced motion | reduced motion on, four crow pokes | `K_noHop` (the crow's x unchanged over 3 s) | none |
| `L` drag | a 120 px drag that starts on the dog | `L_drag` (camera centre moved at least 40 world px; `pokeStats().last.dog` unchanged) | none |
| `M` facing | four pokes each on the Inspector and the dog, at e1 and at s9 (S7 list, then S9 buys and commit) | `M_away` (per actor and framing: pokes 1 and 3 are preceded by `forceGlance(actor)`, and `forced` (the glances started) must be above 0 for each actor and framing. The answer window runs on the page clock from the poke time + the real `delayMs` (`pokeStats().last[actor].delayMs`) to + the clip length (`INS_CLIPS`, or 2000 ms for a dog clip) + 100 ms. Every profile frame inside it has `flip` true left of the machine anchor and false right of it; walk frames are not profile frames. Samples outside the window are skipped and counted (`skipped`): they are the WP23 ambient camera glance, drawn unflipped while the head turns to the camera) | none |

### Debug hook names used (C14, `src/game/debugHook.ts`)

- `findStats()`: `{ unlocked, alive, nextIn, spawned, caught, missed, relics, eligible, marker, client }`. `marker` is the FindMarker stats (`visible`, `interactive`, `spot`, `meanMs`, `glintFrame`); `client` is the marker centre in client px, `null` while hidden. `forceFind()`, `setFinds(on)`.
- `spliceStats()`: one row per Splice in table order: `{ id, state, placed, visible, x, y, frame, line, pulses }`.
- `pokeTargets()`: `{ id, kind, enabled, x, y, w, h }` in client px (on screen only). `poke(id)`: the reaction id or `null` (no ack, no sound: a probe). `pokeStats()`: `{ hover, last, unavailable }`; each `last[id]` row is `{ reaction, level, atMs, delayMs }` (`delayMs`: the answer delay drawn for that poke). `pokeReset()`. `forceGlance(id)`: starts an ambient glance of the actor `id` (the M case calls it with `inspector` and `dog`); `false` when refused.
- `reachStats()`: `{ objects, meanMs, parts }`. `nextBuyText()`: the `#hud-goal-buy` text, `null` when hidden.
- `livingWorld()` rows carry `flip` (the sprite's flipX).
- `audioStats()`: `finds`, `relics`, `splices`, `pokes` (poke cues started: the ack tick counts, muted pokes do not), `denies` (the `purchaseDenied` count). The counters move only while the audio is unlocked and not muted.

### Known gaps (read before a run)

- `H_steady` reads `findStats().marker.glintFrame`. The FindMarker stats do not carry it yet: until they do, `H_steady` fails by name with its reason.
- `B_sound` uses a real click: the debug `poke()` plays no sound (it is a probe by design), so the poke sound is measured on the zone path.
- `E_hop` checks the perch change and the right wing; the machine bbox is not in the hook (the linePath and hop unit tests carry it). `F_s9` checks placement only; the line path is covered by the unit test.
- `F_still` runs the window girl at e1; the ground girl (cycle 3 save) is not in this run.
- `I_off` on the demo build covers photo mode only (the finale needs era V).
- `K_text` also requires an empty affordable badge (`#hud-tech` `data-affordable`): a readout that shows while a tech is affordable fails the case.

### Store shots: `_no_find` (`store-shots.mjs`)

`quietWorld` also turns the Find gate off (`setFinds(false)`), and every shot adds `<size>_<id>_<variant>_no_find`. It passes when `findStats()` is null (no World scene, or a build without the hook), or when `findStats().marker.visible` is false and `findStats().alive` is null. The check sits next to `_no_fault`.

### Economy HUD fit: NEXT BUY (`economy.mjs`, `F_hud_fit`)

`F_hud_fit` also covers the NEXT BUY line (`#hud-goal-buy`, WP28). When the line is shown at UI 100, 125 and 150, its whole box must lie inside `#hud-panel` (`buy.contained`); when it is hidden, the scale passes without it. The per-scale records `F_hud_fit_100`, `F_hud_fit_125` and `F_hud_fit_150` carry `buy` (`shown`, `lines`, `contained`). The line count is recorded, not gated: a readout that wraps stays inside the panel.

## Roaming and reach (WP28b)

```
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/roam.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/roam
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/world.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/world
PW_PATH=C:/Users/<you>/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/splices.mjs "<preview>/?debug=1" C:/Users/<you>/AppData/Local/Temp/smoke/splices
```

`roam.mjs` runs in real time on a quiet PC: nothing is paused or advanced, the scheduler runs on the frames, so a full run takes several minutes (the A cases sample 90 s each). It runs one browser, a fresh context per case, 1920x1080, and prints `{ edition, results, fail, errors }` (it writes `<outdir>/roam.json`). `ONLY=<comma list>` (env, WP28b r1) runs cases alone: `A_e1`, `A_s9`, `A_s11`, `A_s13`, `A_s15`, `C`, `D`, `E` (the five E cases and `E_reduced`), `F`; an unknown key exits 2 before the browser starts. Example: `ONLY=C,D node scripts/smoke/roam.mjs ...`. The edition is read on the first page of the run, so a lone case reads it too. Expected run: `fail: []` and `errors: []` on `http://localhost:4174/?debug=1` (full) and on `http://localhost:4177/?debug=1` (demo, where the era III-V cases skip with a reason). Exit codes as the other smokes.

### `roam.mjs` (roaming and reach, WP28b C15)

| case | setup | checks | shots |
|---|---|---|---|
| `A` gap | S7 (e1), S9, S11 and S15, each a fresh run: 90 s of samples every 250 ms; S13 (era IV) the same run with the conductor | `A_gap_e1`, `A_gap_s9`, `A_gap_s11`, `A_gap_s15` (the Inspector, the dog and the crow each act at least every 12 s), `A_gap_s13` (the era IV conductor switches at least every 12 s) | `roam-<stage>.png` per stage |
| `B` range | the same runs | `B_range_e1`, `B_range_s9`, `B_range_s11`, `B_range_s15` (the Inspector and the dog cover at least 60 % of their spot x-range; `SPOT_RANGE` mirrors `WORLD_SPOTS`) | none |
| `C` reactions | S9; the big buy that sends the ground wave (waits out the 30 s big-buy cooldown first; then one 8 h jump, a 5 s settle and the unlock bought with no jump), `forceFault()`, `forceFind()`, then the era III keystone (a 5 s settle after its buys) and the era card closed | `C_wave` (the Inspector startles within the wave's travel time to his spot + 1 s: 2.65 s at S9), `C_fault` (the Inspector, the dog and the crow within 1.1 s: 1 s + one sample), `C_find` (the Inspector points or looks up within 5.5 s; the dog sniffs within 1.5 s), `C_era` (8 s: the Inspector's `eraFront` must start inside the window and he rests front at his inner-most spot); `C_facing`: no profile frame of the Inspector or the dog faces the machine in any sample taken in those windows | none |
| `D` gather | S7; the bicycle bought by `buyList` (a session purchase), then the walker on its wing | `D_visit`: within 15 s the walker shows its visit activity (`visitSniff` for the dog, `visitWrite` for the Inspector) while it stands at the visit stand (48 px on the machine side of the bicycle: 2440 at e1, AD3 C-c; a normal spot near it does not pass). The detail carries `activity`, `activitySeenMs`, `hitAtMs`, `standX` and `lastWalkerX` | none |
| `E` reach | crank 10 clicks on S7; S9, S11, S13 and S15 (the same stages with reduced motion for `E_reduced`) | `E_pulse` (`groundPulse` rises by 1-10 and at most 4 per second of the run), `E_arc` (era II: `arc` grows within 20 s), `E_drift` (era III: `drift` above 0 within 30 s), `E_hum` (era IV: the lamp glow or the booth hood moves at least 1 px in x over 3 s), `E_lift` (era V: `debris` above 0 within 20 s); `E_reduced`: with reduced motion no part reports activity (one check over e1, s9, s11, s13 and s15) | none |
| `F` budget | S9, one retry after 5 s when the first read is above the cap; then S15 | `F_cost`: `worldStats().meanMs` at most 0.30 at S9; `reachStats().meanMs` at most 0.12 at S9 and S15. `F_display`: display objects at most 100 at S9 and S15 | none |

Each `A_gap` row measures the gap of one actor as the longest run of samples with no action: an activity id change, a restarted activity clock or 8 px of travel from the last action (`actionGapMs`; the close cousin of `worstActionGap` in `world.mjs`, below). `A_gap_s13` counts the conductor's switches (a new activity id or a restarted clock on the Inspector or the dog). `roam.mjs` has no canon-hold exemption, so an era IV `hold` counts toward the gap here; `world.mjs` (`ACTION_EXEMPT`) and the unit gate (`worldBehaviourMetrics.ts`) do not count it.

### `world.mjs` action gap (WP28b B1)

- The three roamers (the Inspector, the dog, the crow) take the action gap in the V4 changes checks (`N_s9_changes`, `N_s11_changes`, `N_s13a_changes`, `N_s15_changes`): at most 12 s in every stage (`ACTION_LIMIT_S`, `WORLD_BEHAVIOUR.actionGapMs`; it was the 20 s / 30 s V4 gap).
- An action is an id change of the activity, a step of a walk or a flight (a walk counts continuously while x changes), or 8 px of travel (`ACTION_PX`) from where the last action left the sprite. A same-clip loop (the idle breath, `sit0` / `sit1`, `perch0` / `perch1`) is not an action. A hidden sample ends the run.
- Era IV (`s13a`): the `hold` id stops the clock (`ACTION_EXEMPT`, the canon hold of `worldBehaviourMetrics.ts`). WP28b r1: the `stare` is no longer exempt (the POST stare is capped by the metrics task). No other stage exempts an id, the era V stare included.
- The girl keeps the V4 gap (20 s; 30 s in era V) and every prop row keeps its limit. Prop rows now carry `hold: true` (no prop has an activity, so nothing changes for them).
- `N_no_teleport` (WP28b r1, time-aware): a step on a move variant (a walk, `walk0`-`walk3`, or a flight, `fly0`-`fly2`) may move up to `max(8, speed x dt + 1)` px, where `dt` is the frame gap in seconds (`moveLimitPx`): a walk at 64 px/s (8 px a tick at 8 fps) and a flight at 160 px/s (`CROW_HOP.pxPerS`). At 60 fps the walk bound stays 8 px (strict); a 50 ms rAF gap lets a flight move 8 px. A step off a move variant keeps 4 px (`REST_PX`). Each sampled row carries its frame time `t`; a violation reports `dx`, `limit`, `dtMs`.
- `N_<s>_walk_share` (WP28b r1, r2): the walk share is at most 30 % (`WALK_SHARE_MAX`). For the Inspector and the dog it is at least 1.5 % (`WALK_SHARE_MIN` 0.015, `WALK_SHARE_FLOOR`) in every stage except era IV (`s13a`, `s13b`: `WALK_SHARE_SKIP`, the conductor runs the cast there), and only for an actor present in the window (an absent actor is skipped, not failed). Director ruling 2026-10-30 R1: the row only catches a dead roamer; the 12-20 % rule belongs to the unit gate (`worldBehaviourMetrics.test.ts`, per-state floors). The detail carries `floor`.
- `N_<s>_rendered` (`s13a`, `s15`): the stray-variant test skips walk and flight frames (the stare rest rule, A3 of the metrics: a flight is a move).
- The variety rows (`N_<s>_distinct`, `no_repeat`, `lockstep`) are unchanged. `G_cost` and `G_display` are unchanged.

### `splices.mjs` M_eras (WP28b B5)

| case | setup | checks | shots |
|---|---|---|---|
| `M_s11` | era III: the S11 list, one page; the pump, the whistle and the hydrant | `M_s11` (before the buys each object is placed and visible; each wakes; after the wakes each reads `line` true and `pulses` 1-4); `M_s11_buys` (setup) | `splices-M-s11.png` |
| `M_s13` | era IV: the S13 list, one page; the bell, the gramophone and the chimes | `M_s13` (as above) | `splices-M-s13.png` |
| `M_s15` | era V: the S15 list, one page; the payphone wakes first, then the weathervane, the kite, the cairn and the Coin Return (it needs the payphone) | `M_s15` (as above, for the four era V objects) | `splices-M-s15.png` |

Each object is bought after 8 h jumps (12 at most) until it is affordable: by a click on its object when the object is on screen and enabled, else through the SPLICES tab path (case E's keys). `EXEMPT_M` lists no documented null cell: every era object stands at its stage's framing. Demo: the three checks skip with a reason.

### Debug hook names used (WP28b, `src/game/debugHook.ts`)

- `reachStats()`: `{ objects, meanMs, parts }`. The `parts` keys: `groundPulse` (ground pulses started since load), `groundWave` (ground waves started), `baseDust` (base specks hopping now), `pylonPulse` (pylon dots drawn), `arc` (arcs started), `drift` (drift puffs alive), `debris` (debris specks alive) and `debrisMoving` (the debris specks that move: 0 under reduced motion).
- `worldStats()`, `livingWorld()`, `worldBehaviour()`, `worldBehaviourLog()`, `worldProps()`, `spliceStats()`, `pokeTargets()` and `forceFault()` / `forceFind()` are as before.

### Known gaps (read before a run)

- The era IV Chladni amplitude (D6 (c) IV, `WorldAtmos`) is not in WP28b: no task owns `WorldAtmos`. `E_hum` checks the lamp and booth hum only.
- `roam.mjs` `F_cost` and `world.mjs` `G_cost` are timing checks: see the load rule below.
- `M_eras` clicks an object only when it is on screen; the SPLICES tab path covers the rest. The detail of each `M_<stage>` row carries the path used (`wake`: `via` and `woken` per object).

### Load rule (timing checks)

Timing checks (`world.mjs` `G_cost`, `finds.mjs` `K_cost`, `faults.mjs` `N_cost` and `C_order`, `roam.mjs` `F_cost`, the `perf.mjs` boot and machine times) that fail under load are rerun alone with nothing else running on the PC before they are judged. If a quiet rerun still fails, an A/B against a scratch build of `0db4856` under the same load decides whether the code is the cause.
