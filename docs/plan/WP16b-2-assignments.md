# WP16b-2 — Worker Assignments (Engineering Manager, Mode A)

Source: WP16b-2 plan (release docs + deferred a11y/UX fixes) + repo read at HEAD `5db7528`.
Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/release-wp16`. Baseline: typecheck clean, 119 files / 3394 tests (16 skipped), build OK, bundle PASS (full app 401.5/460 KB, css 39.0/44 KB; dist-demo app 403.5, css 41.7/44).
Parallel track WP16b-1 (store polish) lives in the main repo (preview 4173) and `C:/Users/sanan/wedtmd-art` (4175): never touch. D2 fence in the preamble. `<O>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP16b-2`.

## EM decisions / deviations from the plan (these WIN for workers)
1. **Plan T1 + T2 merged** into `T1` (three tiny edits, disjoint from every other task; frees a wave-1 slot).
2. **Plan T7 (README) split** into `T7a` (everything above `## Architecture`, W1) and `T7b` (new `## Saves` + `## Tests and smokes`, then `## Architecture` to EOF, W2). Same file, never concurrent; `T7b` runs after `T7a` is merged. Reason: > 300 lines of prose with ~20 source files to verify.
3. **Plan T9 moved to W1** (no dependency; plan had W2). `T8` (CHANGELOG) stays W2. Result: W1 = T1, T3, T7a, T9; W2 = T4, T5, T7b, T8; W3 = T6 (+ T10 conditional).
4. Working-tree files are CRLF (git autocrlf=true, index LF). Every prompt tells the worker to keep line endings, use single-line anchors or node scripts, and verify with `git ls-files --eol` + `git diff --stat`. New files LF. `a11y.mjs` / `a11y-audit.mjs` are LF.
5. Clarification of C4 invariant: `activePrompt === null` also holds for every `phase !== 'none'` even when `crankPromptVisible(0)` is true; the test encodes `phase !== 'none' || (none of the three predicates)`.
6. D10 builds: workers never build; the EM builds once after W1 and once after T10 (if it ran).

## Waves
| Wave | Ids | Gate after |
|---|---|---|
| 1 | **T1** tree trap + contrast + layout + compact toast, **T3** guidance one prompt, **T7a** README top, **T9** STEAM_RELEASE + GAME_SPEC | EM: `npm run typecheck`, `npm test`, then `npm run build` + `node scripts/perf/bundle-budget.mjs` (css <= 41.0 KB), `npm run build:demo` + `node scripts/perf/bundle-budget.mjs dist-demo` (css <= 43.5 KB). Fail -> fix assignment before W2. |
| 2 | **T4** a11y gating, **T5** ux smoke, **T7b** README bottom, **T8** CHANGELOG (no builds; T4/T5 hit :4174, sequentially safe in parallel) | Director reads T4/T5 reports. Any non-inactive game-side fail -> spawn T10 with the pasted items. |
| 3 | **T6** smoke README, **T10** CONDITIONAL (then EM rebuilds once and reruns a11y + ux) | T6 done, T10 verified if run |
| 4 | `implementation-reviewer` (Opus) on the combined diff, then EM Mode B validation (below). Director updates PROJECT_STATUS and commits (never `package-lock.json`). | |

### Transient tsc errors (inside a wave only)
| After | Allowed |
|---|---|
| W1 | none expected (T1 only adds an import of an existing export; T3 changes `guidance.ts` and `guidanceView.ts` together, same owner). A worker may see a sibling's half-edited file mid-wave: ignore. |
| W2 | none (only .mjs / .md) |
| W3 | none |

## File ownership (exclusive)
| Task | Files |
|---|---|
| T1 | `src/ui/techTree.ts`, `src/ui/techTree.css`, `src/ui/toasts.css` |
| T3 | `src/ui/guidanceView.ts`, `src/ui/guidanceView.test.ts`, `src/ui/guidance.ts`, `src/ui/guidance.css` |
| T7a (W1) then T7b (W2) | `README.md` |
| T9 | `docs/STEAM_RELEASE.md`, `docs/GAME_SPEC.md` |
| T4 | `scripts/smoke/lib/a11y-audit.mjs`, `scripts/smoke/a11y.mjs` |
| T5 | `scripts/smoke/ux.mjs` |
| T8 | `CHANGELOG.md` (new) |
| T6 | `scripts/smoke/README.md` (three named regions only) |
| T10 (cond.) | `src/ui/techTree.css`, `src/ui/toasts.css`, `src/ui/eraCard.css` |
Forbidden for all: D2 fence (`src/data/world.ts`, `world.test.ts`, `src/ui/titleScreen.css`, `scripts/smoke/store-shots.mjs`, `src/assets/manifest.ts`, `docs/ASSET_GUIDE.md`, `docs/plan/ART_BRIEF.md`, `docs/plan/WP16b-preaudit.md`, `scripts/art/**`, `public/assets/**`, `scripts/smoke/perf-budget.json`), `src/simulation/**`, `src/data/**`, `src/persistence/**`, `src/game/**`, `package.json`, `package-lock.json`, `docs/PROJECT_STATUS.md`.

## Task summaries (full self-contained prompts are the `prompt` fields)
- **T1 (W1)**: C1 trap (`trapFocus(overlay)` armed in open, released in close/destroy, additions only); C2 eight CSS edits (sand var, purchased sand text, milestone gradient amber->amber-dim, ink selection/focus rings, side column grid, PURCHASE + feedback first row, insufficient colour without opacity, centred graph); C3 compact in-tree toast block at EOF of toasts.css. Accept: numstat deletions 0 on techTree.ts, one new hex `#c9b28a`, typecheck, `npx vitest run src/ui`, CRLF kept.
- **T3 (W1)**: C4 `activePrompt` + `GuidancePrompt`, `guidance.ts` wiring, chip-hide CSS rule, 12 table rows + 1 invariant test (+13). Accept: guidanceView tests green, typecheck clean, no `src/data/ux.ts` change.
- **T7a (W1)**: README top (premise, Editions + demo cap timings from `demoCap.sim`, How to play, Controls, Settings and accessibility, Requirements/Setup, Commands with all 15 scripts). Tail from `## Architecture` byte-identical.
- **T9 (W1)**: STEAM_RELEASE section 10 row + `### Screenshot set (v0.9.0)` + `### Capsule art` + `## 15 Release checklist (v0.9.0 demo)` (15 rows, exactly 3 `PENDING WP16b-3`); GAME_SPEC `### 18.1` appended (deletions 0).
- **T4 (W2)**: a11y lib (DEFERRED_SCOPES `[]`, `.is-fading` skip, `tabWalk` key param, self-test 22 checks) + a11y.mjs (`settleOverlays`, C_tree gates incl. `C_trap_back`, new case H, B_hud settle). Accept: selftest ok, run vs :4174 `fail []`, `errors []`, `deferred []`.
- **T5 (W2)**: ux.mjs: blockers `#tech-title` / `#tech-me`, `promptState`, `feedbackBesideBuy`, `graphCentered`, case A/D additions, `runCase` viewport param, case T (12 checks, 6 shots). Accept: `fail []`, `errors []`, worker views `ux-T-1280x720-150.png` + `ux-A2-hint.png`.
- **T7b (W2)**: README `## Saves`, `## Tests and smokes`, Architecture rewrite, Balance sign-off tables (run `signoff.sim`), budgets, assets, credits, workflow, Known limitations; deletes Implemented features / Next milestones.
- **T8 (W2)**: new CHANGELOG with 0.9.0 and 0.1.0 (WP1..WP14 one line each).
- **T6 (W3)**: smoke README regions: UX smoke section, a11y-audit lib bullets, `### a11y.mjs`. Not `### soak.mjs`, not `### store-shots.mjs`, not WP21 sections.
- **T10 (W3, conditional)**: only pasted real failures; palette-only; <= +300 B.

## EM Mode B validation (after W3; one Bash call per line; `PW` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`)
1. `cd "C:/Users/sanan/wedtmd-shell" && npm run typecheck`
2. `cd "C:/Users/sanan/wedtmd-shell" && npx vitest run src/ui/guidanceView.test.ts`
3. `cd "C:/Users/sanan/wedtmd-shell" && npm test` -> >= 119 files, >= 3407 tests, 0 failed
4. `cd "C:/Users/sanan/wedtmd-shell" && npm run build && node scripts/perf/bundle-budget.mjs` -> PASS, css <= 41.0 KB
5. `cd "C:/Users/sanan/wedtmd-shell" && npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo` -> PASS, css <= 43.5 KB
6. `cd "C:/Users/sanan/wedtmd-shell" && node scripts/smoke/lib/a11y-audit.mjs --selftest && node scripts/smoke/lib/common.mjs --selftest`
7. a11y vs `http://localhost:4174/` -> `fail []`, `errors []`, `deferred []`
8. ux vs `http://localhost:4174/?debug=1` -> `fail []`, `errors []`
9. resolutions.mjs vs `?debug=1`; 10. e2e-full.mjs vs base; 11. wp3-techtree, wp2-crank, wp12-menus (wp12 `3_tab_trapped` true, `14_tree_space` `{open:true,focusNode:true}`)
12. Demo: background `npx vite preview --outDir dist-demo --port 4177 --strictPort`; poll 200; `demo.mjs` -> `fail []`, `errors []`; stop 4177 only (netstat + taskkill). Never start/stop :4174.
13. EM LOOKS (Read): `ux-D-100-tree.png`, `ux-D-150-tree.png`, `ux-D-100-tree-e2.png`, `ux-D-150-tree-e2.png`, `ux-T-1280x720-150.png`, `ux-T-1920x1080-100.png`, `ux-A1-prompt.png`, `ux-A2-hint.png`, `ux-A3-tree-buy.png`, `ux-A5-goal.png`, `a11y-H-tree1.png`: heading clear of the toast; PURCHASE + feedback one row, no gap under PURCHASE; milestone octagons amber->beige with readable ink; first screen one prompt; no chip while the hint shows.
14. README script coverage one-liner prints `[]`.
15. `git diff --numstat docs/GAME_SPEC.md` deletions 0; `grep -c "PENDING WP16b-3" docs/STEAM_RELEASE.md` = 3; `grep -c "^## 0.9.0 — Steam demo candidate — 2026-10-23" CHANGELOG.md` = 1.
16. `grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils` -> empty.
17. `git status --porcelain` -> only T1..T10 files + `CHANGELOG.md` (+ pre-existing ` M package-lock.json`, never staged); no D2 fence file touched.

## Out of scope
Soak 30-60 min, quiet-machine GPU perf, final Art Director audit (WP16b-3); PROJECT_STATUS and commit (Director); every WP16b-1 file; first-click toast burst; focus return to a mouse-clicked TECH INDEX (Known issue); milestone toast translucent top (a11y `indeterminate`); hiding the HUD with the tree open; tree node positions / legend / DOM; copy changes in `src/data/ux.ts`; balance, data, schema, package.json, new deps; Steam upload, VDF, Steamworks SDK.
