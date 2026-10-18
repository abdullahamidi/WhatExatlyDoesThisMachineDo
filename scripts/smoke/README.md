# Browser smoke tests (Playwright, not part of `npm test`)

Uses a globally installed Playwright with a local Chromium.

```
npm run build && npx vite preview --port 4173 --strictPort &
PW=$(npm root -g)/playwright
mkdir -p /tmp/smoke
PW_PATH=$PW node scripts/smoke/wp2-crank.mjs        http://localhost:4173/ /tmp/smoke
PW_PATH=$PW node scripts/smoke/wp3-techtree.mjs     http://localhost:4173/ /tmp/smoke
PW_PATH=$PW node scripts/smoke/wp4-persistence.mjs  http://localhost:4173/ /tmp/smoke
PW_PATH=$PW node scripts/smoke/full-machine.mjs     http://localhost:4173/ /tmp/smoke/full.png
PW_PATH=$PW node scripts/smoke/finale.mjs           http://localhost:4173/ /tmp/smoke
PW_PATH=$PW node scripts/smoke/prestige.mjs         http://localhost:4173/ /tmp/smoke
```
Each prints a JSON result; `errors` must be empty. They use the read-only `window.__wedtmd` debug hook.
PW_PATH=$PW node scripts/smoke/stages.mjs http://localhost:4173/ /tmp/smoke/stages   # unlock-stage screenshots (ONLY=s0_crank,... FRAME_MS=40 optional)

Stages s0_crank … s9_era2_full (era I / II), s10_boiler and s11_era3_full (era III; s10 / s11 also print the 16 Era III part visibilities), s12_spire and s13_era4_full (era IV; s12 / s13 also print `parts4`, the 16 Era IV part visibilities), s14_null (era V start; prints `parts5`), s15_era5_full and s16_postgame (era V; print `parts5`, the 38 Era V part visibilities; both click the crank 3x before the screenshot so the inversion ghost shows). `s16_postgame` = s15 buys + primaryFunction, then `skipFinale()`, click KEEP IT RUNNING, 2.5 s settle, shot (postgame world). Every stage prints its plaque text and camera state.
In a buy list, `@<techId>` jumps 8 h at a time (up to 8 jumps) until that tech is owned; `@blueprint` is an alias of `@generatorBlueprint`.
`PERF=1` (stages.mjs): for s13_era4_full and s15_era5_full, waits 3 s after the screenshot and prints `machineStats` (`{ meanMs, maxMs, components }`, or `null` when the hook is missing).
wp3-techtree.mjs result keys: `12_tab5` (fifth tab text, expect `SIGNAL ?`), `13_tabs`, `13_tabCount` (expect 5), `13_header` (expect ends `???`), `13_nodes` (expect 10), `13_null` (classes of `nullChamber`, `'missing'` when absent).
wp12-menus.mjs (WP12 menus / keyboard / settings / records / export-import): `PW_PATH=$PW node scripts/smoke/wp12-menus.mjs http://localhost:4173/ /tmp/smoke` (screenshots `wp12-0*.png` in the outdir). Keys: `1_first_crank_toasts` (contains `RECORD LOGGED`), `2_esc_menu` (true), `2_arrow_right` (selected tab = `sys-tab-settings`), `3_tab_trapped` (true after 12 Tabs), `4_settings` / `4_root_attrs` (volume 40, reduced motion on, UI scale 125, notation scientific; `#ui-root` zoom `1.25`), `5_space` (`delta` 10, `heldDelta` 0), `6_tree_t` (`[true, false]`), `7_records_firstTurn` (1), `7_records_counter`, `8_stats_clicks_cell` = `8_stats_clicks_session`, `9_hud_me_scientific` (contains `e`), `10_settings_after_reload` (same settings), `11_restored` (all true), `12_garbage` (status text, `meSame` / `clicksSame` true), `13_typing_in_textarea` (`treeOpen` false, `clicksDelta` 0). `errors` must be empty.

`finale.mjs` (WP13 ending sequence, PRIMARY FUNCTION reveal, postgame): `PW_PATH=$PW node scripts/smoke/finale.mjs http://localhost:4173/ /tmp/smoke`. Runs in fresh contexts: (1) buy `primaryFunction` after the era V list, HUD hidden, crank does not change clicks, `modalCount` ≥ 1; keyframes via `finaleSeek` at 1, 6, 12, 15.6, 24, 30.5, 34, 40, 56, end (screenshots `finale-k<label>.png`); (3) 5 s playback from t 20, reload → `choice` (KEEP IT RUNNING shown, plate frame 5); (4) Esc / `t` do nothing at choice, KEEP → `postgame`, `localStorage` `state.ending.phase` postgame, crank works, reload keeps postgame, system menu BEGIN A NEW CYCLE row (WP14: enabled, reason line absent), reset from menu → plate frame 4; skip run (Esc during sequence → `choice`, t = end); reduced run (`session.updateSettings({ reducedMotion: true })` before the buy: `reduced`, overlay alpha at 15.6, wipe mode at 24, birds, beam animate).
Result keys (all `finale_*`): `finale_0_fastforward_failed` (expect `[]`), `finale_1_buy`, `finale_1_t_sequence`, `finale_k1` … `finale_kend` (each: `t`, `shot`, `plate` = name plate texture frame, `frame` = full `FinaleFrame`), `finale_2_playback_t`, `finale_3_reload_choice`, `finale_4_esc_t_choice`, `finale_4_keep`, `finale_4_crank_postgame`, `finale_5_reload_postgame`, `finale_6_newcycle`, `finale_7_reset`, `finale_skip`, `finale_r_start`, `finale_r_15_6`, `finale_r_24`. `finale_FAILED` appears only if the run threw. `errors` must be empty (the KEEP click failure is also recorded there).
Missing hook fields (`finaleState`, `finaleSeek`, `skipFinale`, `displayObjects`, `componentState().frame`) print `null`; they never throw.
`prestige.mjs` (WP14 new cycle, Echoes, Memory perks, postgame path, confirm setting, reduced motion, hard reset): `PW_PATH=$PW node scripts/smoke/prestige.mjs http://localhost:4173/ /tmp/smoke`. Four fresh contexts. Result keys (all `prestige_*`, checks only via `ok(...)`): (A) `prestige_0_choice`; finale BEGIN A NEW CYCLE opens the confirm dialog (`prestige_1_dialog`, gain line `+3 ECHOES`); CANCEL changes nothing (`prestige_1_cancel`); BEGIN runs the transition (`prestige_1_transition`: `started`, `maxAlpha` >= .95, `done`, `wallMs`); after it `prestige_1_after` (prestige `{cycle 2, echoesEarned 3, perks []}`, modals 0, HUD `CYCLE 0043`, toast, res all 0, only start techs, ending none, generator hidden, finale phase none, stats cycles 2); `prestige_1_record` (cycle + `CYCLE 0043` toast); `prestige_1_saved` (save has `prestige`); `prestige_1_reload` / `prestige_1_crank` (same after reload, crank works). MEMORY tab: `prestige_2_memory_head` (`ECHOES 3 (+90% ALL/S)`, `UNSPENT 3`), `prestige_2_residual` (OWNED, UNSPENT 1), `prestige_2_muscle` (wornMotor level visible at once), `prestige_2_locked` (servo / ledger / long silence disabled, `NEED` text). `prestige_6_reset` (hard reset: prestige default, no HUD cycle line). (B) `prestige_3_*`: KEEP IT RUNNING -> SYSTEM row BEGIN A NEW CYCLE enabled -> confirm -> cycle 2. (C) `prestige_4_confirm_off`: SETTINGS toggle CONFIRM NEW CYCLE OFF -> row starts the transition with no dialog. (D) `prestige_5_reduced`: reduced motion, transition ends with `lastTMs` <= 1200 (`gameMsOk`). `prestige_FAILED` only if the run threw; `errors` must be empty. Shots: `prestige-<step>.png`.

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
