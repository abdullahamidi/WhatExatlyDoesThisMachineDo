# WP16b-1 - Worker Assignments (Engineering Manager, Mode A)

Source: WP16b-1 plan (store polish: F1-F4, F5 wiring, F7, top-5 manifest; AD pre-audit `docs/plan/WP16b-preaudit.md`) + repo read at HEAD `7edeb2e`.
Repo `C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo` (branch `claude/funny-hawking-q6kq0w`). Baseline: typecheck clean, 110 files / 3225 tests, build OK, bundle PASS (app <= 460 KB raw, css <= 40 KB, css ~38.5 KB).
Parallel track: WP21 in `C:/Users/sanan/wedtmd-art` (never touch; also never `wedtmd-shell`). Program decisions in `docs/plan/STEAM_DEMO_PROGRAM.md` WIN.

## EM decisions / deviations from the plan (these WIN for workers)
1. **Plan T1 and T4 are merged** into one task `T1` (world data + title CSS; tiny, disjoint files). Plan T4 acceptance (css grep, budget) moves to the EM gate after W1.
2. **T5 receives the complete new file text** (near-total rewrite of one file; whole-file Write allowed, LF). Contract C5 of the plan is implemented 1:1; extras: `withHidden` restores in reverse order (an element matched by two selectors); the 08b typed check does 1 rAF (plan) plus a poll of <= 1 s (20 x 50 ms) before judging; the pass condition is unchanged.
3. `store_top5_complete` is recorded after the browser closes, only when both variants run; `store-top5.json` is always written.
4. T3 keeps the ui.py LEDGER note on a new header line 3. Syntax check uses `ast.parse` (no `__pycache__` writes). A no-write guard harness for `logo_plate.main` (save patched in memory) is added (check e2). No script is ever run with a `public/assets` target.
5. Working-tree files are CRLF (autocrlf=true, index LF): workers use single-line Edit anchors on existing files; new files LF. Heredoc appends (T1) are accepted.
6. Scratch dirs: T2 `O/t2`, T3 `O/py`, T5 `O/t5-1080` (no collisions). `O` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP16b-1`.
7. Art is final (D1): no PNG changes. mountains underfill is the literal `0x5f5244` (D2, overrides pre-audit `PALETTE.grayDark`), skyline `null` (D3). No renderer change needed (`ParallaxBackground.ts` already null-safe).

## Waves
| Wave | Ids | Gate |
|---|---|---|
| 1 | **T1** world underfills + title CSS, **T2** asset descriptions/docs, **T3** art script guards | baseline green |
| gate (EM/Director, once) | `npm run typecheck`; `npm test` (>= 110 files, >= 3227 tests); `npm run build`; `node scripts/perf/bundle-budget.mjs` (css <= 40 KB, delta ~ +170 B); `grep -o "title-screen.is-open)>#hud-panel" dist/assets/*.css` finds a match; ASSET_GUIDE diff = SAME; `git status --porcelain public/assets` empty | W1 merged |
| 2 | **T5** store-shots (smoke runs against the fresh dist on :4173; NO build) | gate PASS |
| 3 | EM Mode B validation (below); EM opens all 19 1080 PNGs and >= 3 2160 PNGs; Director updates `docs/PROJECT_STATUS.md`, commits (never `package-lock.json`) | W2 done |

### Transient tsc errors
None expected in any wave (T1 data change is type-safe: `underfill: number | null`; T2/T3/T5 touch no TS logic).

## File ownership (exclusive)
| Task | Files |
|---|---|
| T1 | `src/data/world.ts`, `src/data/world.test.ts`, `src/ui/titleScreen.css` |
| T2 | `src/assets/manifest.ts`, `docs/ASSET_GUIDE.md`, `docs/plan/ART_BRIEF.md` |
| T3 | `scripts/art/era5/bg.py`, `scripts/art/era5/ui.py`, `scripts/art/era5/logo_plate.py` (new), `scripts/art/era5/mock5.py` |
| T5 | `scripts/smoke/store-shots.mjs` |

Forbidden for all (WP21 or out of scope): `src/ui/techTree*`, `toasts*`, `eraCard*`, `demoEnd*`, `guidance*`, `src/ui/menu/*`, `systemMenu*`, `src/data/edition*`, `demo*`, `ShowcaseScene.ts`, `teaser.ts`, `plateCap*`, `src/simulation/**`, `src/persistence/startup*`, `src/main.ts`, `bootstrap.ts`, `debugHook.ts`, `package.json`, `desktop/**`, `docs/STEAM_RELEASE.md`, `scripts/smoke/README.md`, `README.md`, `CHANGELOG.md`, `docs/GAME_SPEC.md`, all `public/assets/` PNGs.

## Task summaries
- **T1** `world.ts` rows: mountains `underfill: 0x5f5244`, skyline `underfill: null` (comments as in plan C1). `world.test.ts`: two updated expectations in the "five pre-WP11 layers" test + new `describe('WP16b far plain (F5)')` with 2 tests (3225 -> >= 3227). `titleScreen.css`: appended 3-selector `visibility: hidden` block keyed on `#ui-root:has(> #title-screen.is-open)`.
- **T2** two manifest descriptions, two ASSET_GUIDE rows (table must equal generator output), new "underfill must match art" paragraph, ART_BRIEF lines 42, 43, 59, 60, 63.
- **T3** `bg.py mountains_restored()` row fill `g0` for rows >= 156 (dry run `check_mr.py` -> equal, diffPx 0); `ui.py` `--force` guard on logo.png; new `logo_plate.py` (pixel-exact AD port, shipped-path guard); `mock5.py` underfills mirror world.ts.
- **T5** `store-shots.mjs`: 19 shots/size (01-04, 06, 07, 08, 09 hud+clean; 05, 10, 08b hud only); toasts hidden in HUD shots except 03; clean uiRoot shots FIRST for 01-04/06 (live framing, 01 settle 2.5 s); tree hides HUD panel+buttons; title version hidden; new checks `10_hud_hidden`, `10_hud_back`, `08b_typed`, `store_top5_complete`, `*_clean_hud_hidden` for uiRoot shots; `FINALE_TYPED_T = 64.0`; `<outdir>/store-top5.json`; header comment is the doc (README refresh after WP21).

## Package validation (EM Mode B, each its own Bash call, paths quoted)
1. `npm run typecheck` clean. 2. `npx vitest run src/data/world.test.ts src/assets/assetGuide.test.ts src/assets/manifest.test.ts` green. 3. `npm test` >= 110 files, >= 3227 tests, 0 failed. 4. `npm run build && node scripts/perf/bundle-budget.mjs` PASS + css grep match.
5. ASSET_GUIDE regeneration diff = SAME. 6. Art checks a-f + e2 (see T3). 7. `SIZES=1080` store-shots into `O/store-1080`: fail [], errors [], 19 PNGs, `store-top5.json` missing []. 8. `SIZES=2160` into `O/store-2160`: 19 PNGs 3840x2160. 9. `band_probe.py` on `O/store-1080/1080` exit 0.
10. EM Reads all 19 1080 PNGs: no grey band (incl. under pylons in 04/06/07); no WELCOME BACK in 02-hud/04-hud (03-hud keeps milestone toast); 10-title no HUD, no version; 05 no HUD fragments; clean 01-04/06 live framing; 08b = 5 typed lines, no buttons, no SKIP. Also >= 3 2160 PNGs (07-clean, 06-hud, 10-title).
11. a11y: `node scripts/smoke/a11y.mjs "http://localhost:4173/" "<O>/a11y"`; 12. `e2e-full.mjs "http://localhost:4173/" "<O>/e2e"`; 13. regression: `ux.mjs "...?debug=1"`, `wp2-crank.mjs "...?debug=1"`, `shell.mjs "http://localhost:4173/"` (mkdir outdirs first; all `PW_PATH=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`). 14. `grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils` empty. 15. `git status --porcelain`: only the 11 task files + Director docs; never `package-lock.json`.

## Risks to watch in review
- `*_08_clean_hud_hidden` (new check for the finale) fails if the HUD sets its own `visibility` during the finale: report, do not weaken.
- `_08b_typed` depends on `.finale-line` textContent having no cursor glyph; `FINALE_TYPED_T` margin is 0.467 s, clock keeps running, so buttons/SKIP are hidden by inline style.
- `_10_hud_hidden` needs the W1 build (CSS `:has`); T5 step 1 verifies the dist.
- 03-hud may also show a WELCOME BACK toast (keepToasts keeps all toasts): accepted per plan, note in report.
