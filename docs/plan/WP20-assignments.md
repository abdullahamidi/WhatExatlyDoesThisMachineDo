# WP20 - Worker Assignments (Engineering Manager, Mode A)

Source: WP20 plan (D1-D17, C1-C11, T1-T15) + repo read at `c44d655` in worktree `C:/Users/sanan/wedtmd-art` (branch `claude/ux-wp20`).
Goal: first 10 minutes of the Steam demo read well: crank prompt, TECH INDEX cue, fly-in after tree close, keyboard-safe tree that fits, next goal, era cards, calm toasts, clean menu, small click juice.
NEVER touch `C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo` (WP18) or `C:/Users/sanan/wedtmd-shell` (WP15R).
Baseline: typecheck clean, 95 files / 2825 tests, build OK, bundle raw 364.3/400 KB, gzip 108.8/110 KB, css 33.8/40.

## EM decisions / deviations from the plan (these WIN for workers)
1. **T10 split** into T10a (`guidance.ts/.css`: goal line, hint, badge, bump) and T10b (`eraCard.ts/.css`). One pass would be ~450 lines incl. CSS. `eraCard.ts` declares its own `EraCardDeps` (same shape as `GuidanceDeps`, structural) so T10a and T10b run in parallel with no cross import.
2. **Wave order changed** (plan W2/W4 had 5 tasks once T10 split; 17 tasks, 4 slots x 4 waves): W1 T1 T2 T3 T4 · W2 T5 T7 T8 T12 · W3 T9 T10a T10b T11 · W4 T13 T6 T14 T15. T6 (toasts, needs only T1) moves to W4, T12 (settings, no deps) moves to W2 so T13 can wire it. Every dependency still precedes its user.
3. **T4 does not export `nextCostFor`.** T7 re-derives status/cost with `requirementsMet` + `costAt` + `canAfford` (all take Pick types); parity with `getAllTechViews` is proven by T7 tests.
4. **T9 stagger applies to HELD tweens only** (`delay = min(heldCount, 8) x 120 ms`); non-held tweens keep delay 0 so purchases with the tree closed look exactly as before.
5. **dist is shared** with the preview server on :4175; a concurrent `vite build` corrupts it. Workers NEVER run `npm run build`, `vite build`, preview, or any Playwright smoke. T15 only runs `node --check`. EM Mode B builds once and runs every smoke.
6. `affordableBadge(count)` aria uses the REAL count (`TECH INDEX, 100 affordable`); only the visible text caps at `99+`.
7. `data-affordable`: tabs carry a number string (`'0'` hides the chip); `#hud-tech` carries the badge text (`''` hides it, `'99+'` on overflow).
8. `eraHeaderText` replaces the old single-resource header; old tests that assert the old header are updated to the new semantics (T2).
9. `EraTabView` gains `affordable` + `ariaLabel`; old `toEqual` tab expectations are updated (T2).
10. T4 test fixtures use a synthetic `SystemLogEntry` with `{cycle}`; the real `cycle-0041` text is asserted in T3 `textSweep.test.ts`.
11. Re-read each file right before editing; small unique-anchor Edits. WorldScene / debugHook / MachineView / CameraController / HandCrank / hud.ts: additive hunks only (WP18/WP15R edit them elsewhere).

## Waves
| Wave | Tasks | Notes |
|---|---|---|
| 1 | **T1** ux data + CRANK_PULSE, **T2** tree view model, **T3** text sweep tables, **T4** effect text + cycle log | no deps |
| 2 | **T5** tree DOM (needs T2), **T7** pure guidance + affordable (needs T1), **T8** crank prompt + sparks (needs T1), **T12** settings panel | |
| 3 | **T9** fly-in hold + camera nudge (needs T1, T5), **T10a** guidance DOM (needs T1, T5, T7), **T10b** era card DOM (needs T1, T5, T7), **T11** system menu | |
| 4 | **T13** bootstrap wiring (needs T10a, T10b, T11, T12), **T6** toasts (needs T1), **T14** art notes, **T15** smokes (script only) | T15 cannot run the smoke; EM does |
| 5 | implementation reviewer (Opus), EM Mode B (build + all smokes), Art Director on `ux-*.png` + stages s0/s9/s15 | |

### Transient tsc errors
| After | Allowed |
|---|---|
| W1 | none |
| W2 | none (T5 adds `onOpenChange`; no other code builds a TechTree object. New fields are optional or additive) |
| W3 | none (`SystemMenuPanel.visible?` optional) |
| W4 | none after T13 |
Inside a wave a worker may see tsc errors from a sibling's half-written file: list in report, never fix.

## File ownership (no overlaps inside a wave)
| Task | Files |
|---|---|
| T1 | src/data/ux.ts(+test), src/data/world.ts (CRANK_PULSE line), world.test.ts |
| T2 | src/ui/techTreeView.ts(+test) |
| T3 | src/data/technologies.ts(+test), notifications.ts, systemLogs.ts, achievements.ts(+test), textSweep.test.ts, src/ui/hud.ts (2 title strings) |
| T4 | src/simulation/progression/status.ts, progression.test.ts, src/ui/systemLogRules.ts(+test), systemLog.ts |
| T5 | src/ui/techTree.ts, techTree.css |
| T6 | src/ui/notificationRules.ts(+test), toasts.ts, toasts.css |
| T7 | src/simulation/progression/affordable.ts(+test), src/ui/guidanceView.ts(+test) |
| T8 | src/game/entities/HandCrank.ts, src/game/rendering/CrankSparks.ts, src/game/debugHook.ts (crankPrompt only) |
| T9 | src/game/entities/MachineView.ts, src/game/rendering/CameraController.ts, src/game/math/nudge.ts(+test), src/game/scenes/WorldScene.ts (one block) |
| T10a | src/ui/guidance.ts, guidance.css |
| T10b | src/ui/eraCard.ts, eraCard.css |
| T11 | src/ui/systemMenu.ts, systemMenuModel.ts(+test), systemMenu.css |
| T12 | src/ui/menu/settingsView.ts(+test), settingsPanel.ts, settingsPanel.css, src/data/settings.ts (hotkeyTechTree) |
| T13 | src/game/bootstrap.ts |
| T14 | src/data/steamFx.ts(+test), src/assets/painters/legacy.ts(+test), src/data/shell.ts, index.html (#splash transition), src/ui/splash.test.ts |
| T15 | scripts/smoke/ux.mjs, stages.mjs, wp12-menus.mjs, README.md |

## Mode B validation (EM, after W4)
```
cd "C:/Users/sanan/wedtmd-art"
npm run typecheck && npm test            # >= 99 files, > 2825 tests
npx vitest run src/simulation/balance.sim.test.ts src/simulation/achievements.sim.test.ts src/data/ux.test.ts src/ui/techTreeView.test.ts src/ui/guidanceView.test.ts src/game/math/nudge.test.ts src/data/textSweep.test.ts
npm run build && node scripts/perf/bundle-budget.mjs     # raw <= 400 KB must pass; report gzip
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/ui/guidanceView.ts src/ui/techTreeView.ts src/game/math/nudge.ts   # nothing
git diff --name-only c44d655 -- <forbidden list>          # nothing
git diff --numstat c44d655 -- src/game/scenes/WorldScene.ts src/game/debugHook.ts   # deletions 0
smokes: wp2 wp3 wp12 wp4 stages(ONLY=s0_crank,s7_full,s9_era2_full,s13_era4_full,s15_era5_full) shell resolutions ux prestige finale
```
Pass: every smoke `errors: []`; shell/resolutions/ux `fail: []`; wp12 `14_tree_space` `{open:true,focusNode:true}`, `6_tree_t` `[true,false]`. EM opens every `ux-*.png` and stages s0/s15.

## Risks to watch
- **Node text fit.** Node is now 144x68. A 2-line name (e.g. `Pressure Resonator`) plus level plus cost may clip the cost line. T5 tightens line-height/gap in CSS only (layout constants are T2's and fixed). Art Director checks the era IV/V tree shots.
- **Bundle gzip** has 1.2 KB headroom. If gzip > 110 KB: Director sign-off item (raise `appGzipKb` at merge in the WP15R track). WP20 never edits `perf-budget.json`.
- **Toast stack top-left** in the open tree may cover era tabs for 3.2 s with 2 toasts (accepted by D3). Never CLOSE or PURCHASE.
- **Tuning owner after W4**: numbers in `src/data/ux.ts` only (one fix worker); CSS sizes in the owning task's CSS file.
