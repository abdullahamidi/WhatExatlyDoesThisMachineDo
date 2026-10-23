# WP21 - Worker Assignments (Engineering Manager, Mode A)

Source: WP21 plan (D1-D12, C1-C14, T1-T14) + repo read at `f21697c` in worktree `C:/Users/sanan/wedtmd-art` (branch `claude/ux-wp20`).
Goal: Steam demo edition. Cap at Substation Blueprint (era II), final-machine teaser, END OF DEMO card, demo build + packaging, WP20 UX follow-ups.
NEVER touch `C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo` (WP18b) or `C:/Users/sanan/wedtmd-shell`.
Fence (WP18b owns): `src/assets/manifest.ts`, `assetIds.ts`, `loader*`, `src/game/entities/MachineView.ts`, `MachineAnimator.ts`, `src/ui/photoMode*`, `scripts/smoke/showcase.mjs`, `docs/ASSET_GUIDE.md`, `docs/plan/WP18.md`, `ART_ERA5.md`, `public/assets/**`; also never edit `src/data/showcase.ts`, `ShowcaseScene.ts`, `math/teaser.ts`, `WorldScene.ts`. `debugHook.ts` additive only. `README.md` of smokes: append at the end only.
Baseline: typecheck clean, 107 files / 3136 tests, build OK, bundle raw app 393.0/400 KB, css 38.4/40 KB.
Cap timing measured: A 3623 s, B 4372 s, N 5909 s, C 8908 s (windows in T10).

## EM decisions / deviations from the plan (these WIN for workers)
1. **T14 split into T14 + T15.** One pass for demo.mjs would be ~300+ lines of delicate Playwright. T14 = `demo.mjs` (kit, runner, cases A and B, README). T15 = `demo-cases.mjs` (cases C, D, E, F). Both code against the `kit` contract in the T14/T15 prompts. W4 has 3 tasks.
2. **Smoke save edits use an init script + sessionStorage flag** (`wedtmd.smokeEdit` ops, `wedtmd.smokeEditS` result), as wp4-persistence.mjs does. A direct localStorage edit before `reload()` would be overwritten by the pagehide/beforeunload save flush. Cases E and F use `kit.editOnNextLoad`.
3. **T8 runs `node scripts/desktop/package.mjs --mode demo` directly**, not `npm run build:steam-demo` (its typecheck prefix can fail on in-flight W2 files). Retry once after 60 s on a failure in a file it does not own.
4. **T4 retry rule**: `npx vite build` (no tsc) may hit a sibling's half-written file; wait 60 s, retry up to 3 times, then report. T4 is the only dist builder in W1; T13 the only one in W4 (T8 builds into `build/vite-demo`).
5. **STEAM_RELEASE.md**: demo section is appended as `## 14 Demo edition` (no renumbering). Section 1 gets small edits.
6. **T2 inlines the default prestige literal** in `clampLoadToEra` (no import of `../prestige`: import-cycle risk).
7. **T12 has no unit test** (Vitest runs in node, no DOM); the prompt carries the full state/side-effect algorithm and the smokes (T14/T15, executed by EM in W5) prove it.
8. **T11 updates old `toEqual` tab expectations** (`fullGame: false` on every tab). `techTree.ts` stays unchanged (it already renders `tab.label` and disables `!tab.reached`).
9. **`scripts/perf/bundle-budget.mjs` is not edited.** For `dist-demo` the EM reads the css row as report-only (> 40 KB goes to the Director). `perf-budget.json` is Director-only.
10. **T13 does not fix files it does not own.** A smoke failure caused by `demoEnd.ts`, `demoEndModel.ts` etc. is reported; EM Mode B issues fix assignments.
11. Reducer: idle + `reset` returns the same reference (no-op cell). `bootCheck({ teaser: true })` dispatches `capReached` then `delayElapsed` with no timer; the 4 s delay only follows a live `milestone` event.
12. Re-read each file right before editing; small unique-anchor edits.

## Waves
| Wave | Tasks | Notes |
|---|---|---|
| 1 | **T1** edition/demo data + build:demo, **T2** pure era gate, **T3** SYSTEM DEMO ENDING row, **T4** WP20 follow-ups (CSS, era card timing, ux.mjs, runs vite build + ux smoke) | no deps |
| 2 | **T5** GameSession + greedy cap (needs T2), **T6** demo end model (needs T1), **T7** records + stats filters, **T8** desktop demo packaging + doc (needs T1 for URLs; runs packager once) | |
| 3 | **T9** startup clamp (needs T1, T2, T5), **T10** cap timing sim test (needs T1, T5), **T11** tree + guidance demo views (needs T1, T2, T5), **T12** demo end DOM controller (needs T1, T6) | |
| 4 | **T13** composition wiring + builds + full smokes (needs T1, T3, T5, T6, T7, T9, T11, T12), **T14** demo.mjs A+B + README, **T15** demo-cases.mjs C-F | T14/T15 only `node --check` |
| 5 | implementation reviewer (Opus), EM Mode B (all validation + demo/desktop smokes), Art Director on demo-*.png + ux-D-150 | |

### Transient tsc errors
| After | Allowed |
|---|---|
| W1 | none expected (TechView gains a required field; no other W1 task builds TechView objects; `techTreeView.ts` gets a temporary `case 'demo'`) |
| W2 | none expected (`maxEra` params are optional; T6 only needs T1 files) |
| W3 | none expected |
| W4 | T13 may see errors until T12/T6 exports are used correctly; none allowed at the end |
Inside a wave a worker may see tsc errors from a sibling's half-written file: list in the report, never fix.

## File ownership (no overlaps inside a wave)
| Task | Files |
|---|---|
| T1 | src/data/edition.ts(+test), demo.ts(+test), balance.ts (SAVE_FULLGAME_KEY), package.json (build:demo), .gitignore |
| T2 | src/data/types.ts, src/simulation/progression/edition.ts(+test), purchase.ts, status.ts, milestones.ts, affordable.ts(+test), src/simulation/index.ts, src/ui/techTreeView.ts (one temporary case line) |
| T3 | src/data/systemMenu.ts, src/ui/systemMenuModel.ts(+test), src/ui/systemMenu.ts |
| T4 | src/ui/toasts.css, techTree.css, eraCard.ts, eraCard.css, eraCardTiming.ts(+test), scripts/smoke/ux.mjs |
| T5 | src/simulation/GameSession.ts, GameSession.demo.test.ts, sim/greedy.ts(+test) |
| T6 | src/ui/demoEndModel.ts(+test) |
| T7 | src/ui/menu/achievementsView.ts(+test), achievementsPanel.ts, statsView.ts(+test), statsPanel.ts |
| T8 | desktop/edition.cjs, desktop/main.cjs, scripts/desktop/package.mjs, src/platform/desktopEdition.test.ts, scripts/smoke/desktop.mjs, docs/STEAM_RELEASE.md |
| T9 | src/persistence/startup.ts(+test) |
| T10 | src/simulation/demoCap.sim.test.ts |
| T11 | src/ui/techTreeView.ts(+test), guidanceView.ts(+test), guidance.ts |
| T12 | src/ui/demoEnd.ts, demoEnd.css |
| T13 | src/main.ts, src/game/bootstrap.ts, src/game/debugHook.ts (additive) |
| T14 | scripts/smoke/demo.mjs, scripts/smoke/README.md (append) |
| T15 | scripts/smoke/demo-cases.mjs |
`src/ui/techTreeView.ts` is touched by T2 (W1) and T11 (W3) only: sequential, no overlap.

## Mode B validation (EM, after W4)
```
R="C:/Users/sanan/wedtmd-art"; PW=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright
OUT="C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP21"
1. cd "$R" && npm run typecheck
2. cd "$R" && npm test                                   # 0 failures, >= 3136 + new
3. npx vitest run src/simulation/demoCap.sim.test.ts src/simulation/progression/edition.test.ts src/simulation/GameSession.demo.test.ts src/persistence/startup.test.ts src/ui/demoEndModel.test.ts
4. grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/ui/demoEndModel.ts src/ui/demoEnd.ts   # empty
5. npm run build && node scripts/perf/bundle-budget.mjs   # app raw <= 400, css <= 40; grep -l "demo-teaser" dist/assets/*.js -> none
6. npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo   # app raw gated; css report; ls dist-demo/assets | grep demoEnd
7. full smokes on :4175: wp2-crank, wp3-techtree (12_tab5 = SIGNAL ?), ux, ONLY=s0_crank,s9_era2_full stages
8. demo preview (background, :4176): demo.mjs -> fail [], errors []; stop the server afterwards
9. npm run build:steam-demo; DESKTOP_EDITION=demo desktop.mjs (1_title_fresh DEMO line, 8_demo_tabs); if CDP cannot attach record boot_only + reason
10. LOOK at $OUT/demo/demo-*.png, $OUT/ux/ux-D-150-tree.png, ux-D-150-tree-e2.png, ux-A3-tree-buy.png, $OUT/desktop-demo/desktop-title.png
```
Fix assignments go to the file owners above. Port 4175 is never restarted; no balance edits on a failing cap window (report numbers; Director signs off).
