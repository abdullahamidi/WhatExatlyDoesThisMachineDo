# WP14 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP14.md` (contracts C1-C6, decisions D1-D13, tasks) + repo read at HEAD `94b384e` (WP13 W1 landed/committed; WP13 W2/W3 NOT landed).
Template: `WP13-assignments.md`. Numbering: WP14 = new-cycle prestige. Save stays **v2** (additive `prestige`). Era I-V balance bit-identical. **No new art; workers never touch `public/**`.**
Verified: `git status` at planning = only WP13 files (`src/game/newCycle.ts` stub, `world.test.ts`). `grep -ri prestige src` = only the old `META_MULT` comment in `src/data/balance.ts`. **No WP14 code exists.** The "WP14-looking edits" a reviewer saw were WP13 W1 (ending/finale/palette/assets).
Baseline: Director re-records `npx vitest run 2>&1 | grep -E "Test Files|Tests "` at WP13 final HEAD; never lower it.

## GATE (hard)
WP14 W1 starts ONLY after: WP13 W3 merged + WP13 Mode B PASS + WP13 committed. Before W1 the Director re-reads these WP13 FINAL contracts and, if any differ from the list below, tells the EM (assignments get patched, not guessed):
`NewCycleHook {blockedReason(): string|null; begin(): void}` + `createNewCycleStub()` in `src/game/newCycle.ts` · `GameContext.newCycle` · `EndingState`/`GameState.ending` · `isRevealed(e)` + `isFinaleLocked(e)` in `src/simulation/progression/ending.ts` (exported from `simulation/index.ts`) · session `ending` event, `finishEndingSequence()`, `keepRunning()` · `src/ui/revealRules.ts` `setRevealed/resourceShort` · `createFinaleOverlay` (`render(null)` pops `'finale'` modal, removes `#ui-root.finale-active`) · `FinaleDirector` handles session `reset` (t 0, neutral frame, `setRevealed(false)`) · `SystemMenuDeps.ending { phase(); newCycle }` + `#sys-new-cycle` row · `__wedtmd.skipFinale/finaleState` · `settings.reducedMotion` + `motionPolicy(settings).flashes` · `FINALE_CHOICE.cycle.label/cycleStubReason`, `REVEALED.xf.short`.

## SHARED FILES WITH WP13 (all FLAGGED: WP13 workers finish first; WP14 workers re-read, never revert foreign hunks, extend only)
| File | WP13 owner | WP14 owner | Rule |
|---|---|---|---|
| `src/data/types.ts` | T1 (EndingState) | T1 (PrestigeState, SettingsState), T4 (envelope/load) | append only |
| `src/simulation/{GameSession,events,index}.ts` | T1 | T3a (+T2 index exports) | keep ending code/order `purchase->unlock->milestone->achievement->ending` |
| `src/persistence/{schema,saveController}.ts` (+tests) | T1 | T4 | `ending` save logic untouched |
| `src/game/newCycle.ts` (+test) | T3 | T6a | KEEP `NewCycleHook` + `createNewCycleStub` exports + stub tests |
| `src/game/bootstrap.ts` | T3 ctx, T6b menu call, T11 overlay/hotkeys/reveal | T9 ONLY | swap stub -> controller; keep `ctx.newCycle` type |
| `src/game/scenes/WorldScene.ts`, `src/game/debugHook.ts` | T11 | T9 | CycleTransition AFTER FinaleDirector, dispose FIRST |
| `src/ui/finale.ts`, `finaleView.ts`, `finale.css` | T5 | T9 (ONLY if overlay leaks `finale-active`/modal on reset) | else read-only |
| `src/ui/systemMenu*.ts`, `src/data/systemMenu.ts` | T6b | T7 (`data/systemMenu.ts` MENU_TABS only) | menu ids/rows untouched |
| `src/ui/{hudView,hud,techTree,notificationRules}.ts` (+tests) | T6a (resourceShort) | T8a | keep `resourceShort` usage |
| `src/audio/{synth,gameAudio,audioMath}.ts`, `src/data/audio.ts` | T7 | T8b | keep chord/chirp/wind code |
| `scripts/smoke/{finale.mjs,README.md}` | T4 | T9 | edit one step only |
| `src/data/finale.ts` | T2 | nobody | READ-ONLY for WP14 |
Not shared with WP13: `src/data/{prestige,settings,achievements,notifications}.ts`, `src/simulation/{prestige,settings,achievements,sim/*}`, `src/ui/menu/*` (WP12 only), new files.

## How the Director uses this file
Per worker: spawn `implementation-worker`, paste **(1) Common preamble** then **exactly one assignment**. Same-wave workers parallel (max 4). After each wave: that wave's tests + `npx tsc --noEmit`, compare transient table, then next wave.
| Wave | Ids | Gate |
|---|---|---|
| 1 | **T1** data+types+setting, **T2** pure prestige logic, **T6a** controller+transition maths+confirm view | WP13 final + committed |
| 2 | **T3a** GameSession, **T3b** achievements, **T5** balance sim, **T7** MEMORY panel | W1 merged, tsc clean |
| 3 | **T4** persistence, **T6b** transition renderer + confirm DOM, **T8a** HUD/stats/settings/tree/toast, **T8b** stamp SFX | W2 merged, tsc clean |
| 4 | **T9** wiring + smoke -> EM Mode B, reviewer, Art Director | W3 merged |

### Transient tsc errors (inside a wave only)
| After | Allowed |
|---|---|
| W1 | T2/T6a import T1 types (`PrestigeState`, `PerkId`, `ECHO_RULES`...) until T1 lands (T1 writes `types.ts` + `prestige.ts` exports FIRST); tests building a full `SettingsState` literal fail until T1 fixes them |
| W2 | T3b new `evaluateAchievements`/`conditionMet` param optional, no break; T3a passes `this.prestige` after T3b lands; T7 `deps.buyPerk` types come from T3a (contract C3) |
| W3 | T4 `types.ts` envelope fields break codec/startup only inside T4's own files; T8a `session.on('cycle')` typed by T3a (landed) |
| W4 | none |
Runtime after W3: everything exists, stub still wired -> game plays as WP13 until T9.

## EM decisions / deviations from WP14.md (these WIN)
1. Dependencies on WP13 are by FINAL contract above, not WP13.md. Reduced motion = `settings.reducedMotion` via `motionPolicy(settings).flashes` (NO media query, no `reducedMotion.ts`). Transition `reduced = !motionPolicy(session.settings).flashes` read at `play()` start.
2. `beginNewCycle` emits `reset` first: bootstrap's `session.on('reset', toasts.clear)` and `systemLog` reset run BEFORE the `cycle` toast. Required order, tested in T3a (reset -> cycle -> achievement).
3. saveController does NOT save on `reset` (only `resetProgress()` wipes). New cycle persists via the `cycle` event (T4).
4. Hotkey guard (T9): bootstrap `toggleTechTree` (`t` works with modals open) and `openMenu` also return when `cycleController.isBusy()` or `modals.has('cycleConfirm')`, next to WP13's `isFinaleLocked` guard.
5. Confirm dialog xf label via `resourceShort('xf')` (`src/ui/revealRules.ts`, WP13) -> `RF` (run is revealed); `buildCycleConfirm(preview, xfShort: string)` stays pure.
6. T9 owns `finale.ts` ONLY as fallback; first verify the WP13 overlay already drops its modal + `finale-active` when director emits `render(null)` after `reset`.
7. Re-read each file RIGHT BEFORE editing; small unique-anchor Edits.

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP14: new-cycle prestige (Echoes, five Memory perks, CYCLE 0043 transition, MEMORY panel, prestige save).
Authoritative spec you MUST read first: docs/plan/WP14.md — "C Contracts" C1-C6 and "D Decisions" are exact and binding (all numbers, names, signatures).
THIS ASSIGNMENT FILE (docs/plan/WP14-assignments.md, "EM decisions" + "SHARED FILES") WINS over WP14.md where they differ.
WP13 (finale) is landed: read src/game/newCycle.ts (NewCycleHook stub — keep it), src/simulation/progression/ending.ts (isRevealed), src/ui/revealRules.ts.
Art: docs/plan/ART_ERA5.md §7-8. PNGs exist (public/assets/ui/{echo,perks,perk-slot,button,panel,icons16}.png). NEVER touch public/**.
Era I-V behave EXACTLY as before: default prestige = identical numbers, events, strings. Save stays version 2.
Baseline: typecheck clean, all tests green (count recorded by the Director; never lower it).

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, public/**, src/data/technologies.ts, src/simulation/production/**, src/simulation/progression/**. CSS only if a *.css is in your files_owned.
- CONCURRENCY: other workers edit other files at the same time. Re-read every file RIGHT BEFORE you edit it (and before final validation). Keep edits SURGICAL (Edit tool, small unique anchors; never rewrite an existing file from memory). Never revert a foreign change.
- PURE (no 'phaser', no window/document/AudioContext/localStorage): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**, src/game/newCycle.ts,
  src/ui/*View.ts, src/ui/*Rules.ts, src/ui/*Model.ts, src/ui/menu/*View.ts, src/audio/audioMath.ts.
  Only src/game/{entities,rendering,scenes}, src/assets/fallbackTextures.ts may import Phaser. DOM files (src/ui/*.ts without View/Rules/Model suffix) may use document/window, never Phaser.
- All balancing numbers, texts, ids live in src/data/ (prestige.ts). No 0x...... colour literals under src/game, src/ui, src/audio (use PALETTE / PALETTE_CSS).
  No tech-id string literals in src/audio or src/game logic.
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined in src.
- DOM text ALWAYS via textContent (never innerHTML). Controls are real <button>; icon-only controls need accessible names; min font 12 px in CSS you write;
  every interactive element gets `:focus-visible { outline: 2px solid <palette css var>; outline-offset: 2px }`.
- Tests: Vitest, node env (no DOM, no Phaser at runtime), `*.test.ts` next to the code, `toBeCloseTo(x, 9)` for floats, avoid -0. Never delete coverage: when a count/list changes update to the new value, keep intent. Reset module state in afterEach.
- `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list them in NOTES. Run only your own tests (plus the named regression runs).
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...
```

---

# WAVE 1 (parallel: T1, T2, T6a — disjoint files)

## T1 — Data + types + setting
**wave** 1. **files_owned**: new `src/data/prestige.ts`, new `src/data/prestige.test.ts`, `src/data/types.ts` (add `PrestigeState`, `SettingsState.confirmNewCycle` ONLY), `src/data/settings.ts`, `src/simulation/{settings,settings.test}.ts`, plus any other `*.test.ts` that fails `tsc` ONLY because `SettingsState` gained a field (list in NOTES). **SHARED**: `types.ts` (WP13 T1 landed `ending`; append).
**objective**: C1 exact + C1 types + `confirmNewCycle` (default true). Write exports/types FIRST (T2, T6a import them).
**context**: WP14.md C1 verbatim (PERK_IDS, PerkEffect, PerkDefinition, PERKS, PERK_LIST, ECHO_RULES, MEMORY_SOURCE_TECH, CYCLE_LABEL, CYCLE_TRANSITION, PRESTIGE_ART, PRESTIGE_TEXT incl. confirm-dialog lines / KEPT + RESET lists / toast title / status words `COST n ECHOES`, `NEED n ECHOES`). `PerkEffect`/`TechId` via `import type`. `normalizeSettings` stays lenient: wrong type -> default true.
**constraints**: pure data; no balance change elsewhere; PALETTE only for colour.
**acceptance**: 5 perks in PERK_IDS order, costs 1/2/2/3/3, icons 0..4 unique; every TechId in `startLevels` exists in TECHNOLOGIES; `costMult` ids = the 4 keystone converters and each has a `convert` effect; thresholds ascending; CYCLE_TRANSITION ms > 0; PRESTIGE_ART frames x count = sheet dims (perks 160/32 = 5, slot 108/36 = 3); `confirmNewCycle` default true, non-boolean -> default; existing settings tests green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation/settings.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(data|simulation/settings)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser" src/data/prestige.ts && echo FAIL || echo OK
git diff --stat HEAD -- src/data/technologies.ts public     # empty
```

## T2 — Pure prestige logic
**wave** 1. **files_owned**: new `src/simulation/{prestige,prestige.test}.ts`, `src/simulation/index.ts` (add exports only). **SHARED**: `index.ts` (WP13 exports ending API; append).
**objective**: C2 exact. Contract-first against T1.
**context**: WP14.md C2 line by line. Uses `TECHNOLOGIES`, `PERKS`, `ECHO_RULES`, `MEMORY_SOURCE_TECH`, `createInitialState` (ending DEFAULT via WP13), `isRevealed`. `cycleTechs` returns `base` ITSELF when `echoMultiplier === 1` and no perks; never mutates `base`; multiplier + `autoClick` + `offlineHours` effects appended to `handCrank.effects` (`{type:'rateMult',factor,res:'all'}` only when factor != 1); `convertPct` multiplies every `convert.amount`; `costMult` multiplies `baseCost`.
**constraints**: pure; no `Math.random`; no mutation (deep-freeze test).
**acceptance**: echoesForCycle 3 at 5.36e8 / 0 / NaN / -5, 4 at 2e9, 6 at 1e12; echoMultiplier 1 / 1.9 / 10 at earned 0 / 3 / 40 (cap 30); spent/unspent; perkStatus; buyPerk returns `owned` / `insufficient` failures, keeps PERK_IDS order, never mutates input; `cycleTechs(TECHNOLOGIES, DEFAULT_PRESTIGE) === TECHNOLOGIES`; residual x1.5 on every convert; ledger halves exactly 4 baseCosts; handCrank gains exactly the expected effects; `computeRates(..., cycleTechs)`: perSecond 'all' x multiplier at a fixed era-I state, `offlineCapSeconds` +4 h with longSilence, perSecond +perClick with servoRecall; applyStartLevels never lowers a level, SAME object when unchanged; newCycleState; cycleLabel 1 -> `CYCLE 0042`, 2 -> `CYCLE 0043`; normalizePrestige table (undefined, string, floats, negatives, unknown/duplicate perks, over-spend drops last perk); cyclePreview (allowed = isRevealed, echoesGained, nextBonusXf null past last threshold).
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/prestige.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/simulation/(prestige|index)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b|Math\.random" src/simulation/prestige.ts && echo FAIL || echo OK
git diff --stat HEAD -- src/data/technologies.ts src/simulation/production src/simulation/progression     # empty
```

## T6a — Controller + transition maths + confirm view
**wave** 1. **files_owned**: `src/game/{newCycle,newCycle.test}.ts`, new `src/game/math/{cycleTransition,cycleTransition.test}.ts`, new `src/ui/{cycleConfirmView,cycleConfirmView.test}.ts`. **SHARED**: `newCycle.ts` + test (WP13 T3: KEEP stub + its tests).
**objective**: C6 pure parts.
**context**: WP14.md C6 verbatim. `createNewCycleController(deps)` returns `NewCycleHook & { preview(): CyclePreview; isBusy(): boolean }`; `CyclePort` structural type (`state`, `prestige`, `settings`, `beginNewCycle`). `cyclePreview`, `CYCLE_TRANSITION`, `PRESTIGE_TEXT` from T1/T2. `buildCycleConfirm(preview: CyclePreview, xfShort: string): { title; gainLine; bonusLine; thresholdHint: string | null; kept: string[]; reset: string[]; confirmLabel; cancelLabel }` (title `BEGIN CYCLE 0043?`, gain `+3 ECHOES -> ECHOES 3 (+90% ALL/S)`, hint `+1 ECHO AT 2B <xfShort>` via `formatNumber` style helper already in repo).
**constraints**: pure; no Phaser/DOM; no 0x; deterministic; keep `createNewCycleStub`.
**acceptance**: controller with fakes: blockedReason busy -> `PRESTIGE_TEXT.busy`, not allowed -> `PRESTIGE_TEXT.blocked`, else null; confirm ON -> confirm called, no transition yet; OFF -> transition; commit while busy ignored; `onPeak` calls `beginNewCycle` exactly once; `closeDialogs` called; busy cleared on done; no-scene sync path (onPeak then onDone immediately); `cycleTransitionAlpha` 0 at 0, 1 at peak, 0 at end, 0 after, monotone each half, reduced timings; peak/end ms helpers; `buildCycleConfirm` table (threshold hint null when none); stub tests untouched.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/newCycle.test.ts src/game/math/cycleTransition.test.ts src/ui/cycleConfirmView.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(game/newCycle|game/math/cycleTransition|ui/cycleConfirmView)" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b|0x[0-9a-fA-F]{6}|Math\.random" src/game/newCycle.ts src/game/math/cycleTransition.ts src/ui/cycleConfirmView.ts && echo FAIL || echo OK
grep -n "createNewCycleStub" src/game/newCycle.ts
```

---

# WAVE 2 (parallel: T3a, T3b, T5, T7 — disjoint files; W1 merged)

## T3a — GameSession integration
**wave** 2. **files_owned**: `src/simulation/{GameSession,events}.ts`, new `src/simulation/GameSession.prestige.test.ts`, `src/simulation/GameSession.test.ts` (only if needed). **SHARED**: GameSession/events (WP13 T1 ending code).
**objective**: C3 exact.
**context**: WP14.md C3. Today the session calls pure fns with the default `TECHNOLOGIES` (line ~162 uses `TECHNOLOGIES[id]`; `computeRates`, `applyClick`, `advance`, `applyOffline`, `evaluateMilestones`, `purchase`, `getTechView(s)` all take optional `techs`) -> pass `this.techs` EVERYWHERE incl. the offline path and `autoClick` perks. Cache `this.techs` on prestige change only. `beginNewCycle(nowMs?)`: events `reset` -> `cycle` -> achievements check (pass `this.prestige` to `evaluateAchievements` once T3b lands; until then omit, same wave). `buyPerk`: `unlock` per tech 0->1 (wornMotor), `revision++`, `prestige` event. `reset()`: prestige -> DEFAULT. Keep WP13 `purchase` order `purchase -> unlock -> milestone -> achievement -> ending`.
**constraints**: default session (no prestige option) byte-identical numbers/events; no `any`.
**acceptance**: WP14.md T3a acceptance list: no events + false before reveal; after reveal event order reset -> cycle -> achievement; res/lifetime/clicks 0, start levels applied, ending none, stats lifetime/clicks/purchases kept, `stats.cycles` 2, `bestCycleSeconds` min over two cycles, achievements kept; buyPerk recomputes rates, `unlock` wornMotor then `prestige`, revision bumps, failing buy nothing; Ledger halves `getTechView('generator').nextCost`; Long Silence raises offline cap; reset -> DEFAULT; constructor option `prestige` normalised, `stats.cycles := prestige.cycle`.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation
npx tsc --noEmit 2>&1 | grep -E "^src/simulation" && echo CHECK || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b" src/simulation/GameSession.ts && echo FAIL || echo OK
git diff --stat HEAD -- src/simulation/production src/simulation/progression src/data/technologies.ts    # empty
```

## T3b — Achievements
**wave** 2. **files_owned**: `src/data/{achievements,achievements.test}.ts`, `src/simulation/{achievements,achievements.test,achievements.sim.test}.ts`, `src/ui/menu/achievementsView.test.ts` (count literals only).
**objective**: C4 exact.
**context**: WP14.md C4: `{ type: 'prestige'; key: 'echoesEarned' | 'perksOwned'; atLeast }`; new optional trailing params `prestige = DEFAULT_PRESTIGE` on `conditionMet` / `evaluateAchievements`; rows `echoes` 'Echo Chamber' icon 11 (echoesEarned 9) and `keeper` 'Keeper' icon 15 (perksOwned 5), both secret, desc <= 60 chars. 33 total. Existing `cycles` achievement (stat key) untouched.
**acceptance**: 33 ids unique, icons 11/15 exist in badge sheet range, both secret; conditionMet prestige keys; sim-test exception list += echoes, keeper; counter = list length; old call sites compile unchanged.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/achievements.test.ts src/simulation/achievements.test.ts src/simulation/achievements.sim.test.ts src/ui/menu/achievementsView.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(data/achievements|simulation/achievements|ui/menu/achievementsView)" && echo CHECK || echo OK
```

## T5 — Prestige balance sim
**wave** 2. **files_owned**: new `src/simulation/prestige.sim.test.ts`, `src/simulation/sim/{greedy,greedy.test}.ts`.
**objective**: prove cycle-2 ≈ 55-62 % of cycle 1; optional `stopAt`.
**context**: WP14.md T5 + Measured table + scratch script `/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/wp14/sim3.ts` (read only; copy ideas, handCrank-injection = `cycleTechs`). `greedy.ts` option `stopAt?: TechId` (stop after the step that first owns it); default behaviour byte-identical (greedy.test unchanged + 1 new test). Use `newCycleState` + `cycleTechs(TECHNOLOGIES, prestige)` as `initial`/`techs`.
**acceptance**: WP14.md T5 list: `echoesForCycle(c1 lifetime.xf) = 3`; cycle 2 (3 Echoes) each spend {none, muscleMemory, residualCharge, servoRecall, ledger, muscle+residual} PF/c1 in [0.50, 0.65]; cycle 3 (6 Echoes, muscle+residual+servo) in [0.35, 0.55] and < cycle 2 none; max meta (30 counted, all perks) >= 0.12; every maxValue finite < DESIGN_MAX_VALUE; casual (1 cps, 30 s buys) cycle 2 <= 0.65 x its c1; no purchase gap > 1200 s between generatorBlueprint and primaryFunction in cycle-2 runs; file <= 15 s; console.table of ratios. `balance.sim.test.ts` untouched + green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/prestige.sim.test.ts src/simulation/sim
npx vitest run src/simulation/balance.sim.test.ts
git diff --stat HEAD -- src/data src/simulation/production src/simulation/progression    # empty
```

## T7 — MEMORY panel
**wave** 2. **files_owned**: new `src/ui/menu/{memoryPanel,memoryView,memoryView.test}.ts`, new `src/ui/menu/memoryPanel.css`, `src/data/systemMenu.ts` (`MENU_TABS.memory` between records and data ONLY). **SHARED**: `src/data/systemMenu.ts` (WP13 T6b).
**objective**: WP14.md T7. Study `src/ui/menu/achievementsPanel.ts` + `statsPanel.ts` (WP12 tab pattern: panel factory registered by the menu — read how `systemMenu.ts` consumes `MENU_TABS` and panels; if registration needs `systemMenu.ts`/`bootstrap.ts` edits, expose `createMemoryPanel(deps)` with the same shape as the other panels and report in NOTES; T9 wires it).
**context**: `buildMemoryView(prestige, preview, revealed)` per WP14.md T7 (header `ECHOES n (+p% ALL/S)`, `UNSPENT u`, `CYCLE 00xx`, next-cycle line when revealed, `NO CYCLE RECORDED.` only when no Echo and not revealed, 5 cards with slot frame 0/1/2, icon frame, name, description, status `OWNED` / `COST n ECHOES` / `NEED n ECHOES`, `canBuy`, aria-label `<name>, <status>, <cost>`). Deps: `{ session-like { prestige; on('prestige'|'cycle'|'reset') }, preview(): CyclePreview, buyPerk(id), revealed(): boolean }`. DOM: `ui.echo` x2, perk + slot sheets x2 via background-position, `image-rendering: pixelated`, RECALL -> `deps.buyPerk(id)` -> refresh; refresh on events only; textContent only; text >= 12 px; focus-visible.
**acceptance**: view table tests (no Echo, 3 Echoes none owned, residual owned, all owned, unrevealed vs revealed); `MENU_TABS` has 6 tabs in order system/settings/stats/records/memory/data (update any tab-count test you find in `src/data` or `src/ui` ONLY if in your files; else NOTES).
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/menu src/data
npx tsc --noEmit 2>&1 | grep -E "^src/(ui/menu/memory|data/systemMenu)" && echo CHECK || echo OK
grep -nE "innerHTML|from ['\"]phaser|0x[0-9a-fA-F]{6}" src/ui/menu/memoryPanel.ts src/ui/menu/memoryView.ts && echo FAIL || echo OK
grep -nE "font-size:\s*([0-9]|1[01])px" src/ui/menu/memoryPanel.css && echo SMALL_FONT || echo OK
```

---

# WAVE 3 (parallel: T4, T6b, T8a, T8b — disjoint files; W2 merged)

## T4 — Persistence
**wave** 3. **files_owned**: `src/data/types.ts` (envelope/load/meta fields ONLY), `src/persistence/{schema,codec,saveManager,saveController,startup}.ts` + their tests, `src/persistence/{persistence,statsSchema,exchange,startup}.test.ts` as needed, new `src/persistence/fixtures/v2-cycle2.json`. **SHARED**: `types.ts`, `schema.ts`, `saveController.ts` (+tests) with WP13 T1 `ending` logic — extend only.
**objective**: C5 exact. SAVE_VERSION stays 2.
**context**: WP14.md C5. `readPrestige = normalizePrestige` (missing -> DEFAULT, bad -> normalised, never `recovered`). Controller writes `session.prestige`; `saveNow` on `cycle` and `prestige` events (see how `achievement` / `ending` are wired); export includes it; import writes imported prestige, settings stay current. `startup`: `prestige: load.prestige` into `GameSessionOptions`. `resetProgress()` already wipes storage.
**acceptance**: old v2 save without prestige -> loaded + DEFAULT; v1 fixture still migrates; cycle-2 fixture round-trips lossless (cycle, earned, perks, `confirmNewCycle` false in settings); bad prestige (string, negative, unknown perk, over-spend) -> normalised, status `loaded`; export -> import keeps prestige; writes on `cycle` and `prestige`; reset clears; `SAVE_VERSION === 2`; WP13 ending tests green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence src/simulation src/data
npx tsc --noEmit 2>&1 | grep -E "^src/(persistence|data/types)" && echo CHECK || echo OK
grep -rn "SAVE_VERSION" src/data/balance.ts src/persistence/*.ts | head
```

## T6b — Transition renderer + confirm DOM
**wave** 3. **files_owned**: new `src/game/rendering/CycleTransition.ts`, new `src/ui/cycleConfirm.ts`, new `src/ui/cycleConfirm.css`.
**objective**: C6 Phaser/DOM parts.
**context**: WP14.md C6 + D10/D11. `CycleTransition(scene)`: one screen-fixed rect (scrollFactor 0, colour `CYCLE_TRANSITION.color`, depth above every world object incl. FinaleFx, below DOM), uses `cycleTransitionAlpha/PeakMs/EndMs` (T6a); `play(reduced, onPeak, onDone)`, `update(deltaMs)` (clamp 250 ms; `onPeak` exactly once even with 250 ms steps), `isActive()`, `getState()`, `destroy()`. `createCycleConfirm(root, { modals })`: modal id `cycleConfirm`, `trapFocus` from `./hotkeys`, `ui.panel` 9-slice + `.hud-panel` fallback, `ui.button` frames + `ui.icons16` frame 1 on BEGIN, asset URLs via the same helper `finale.ts` uses, content from `buildCycleConfirm` + `resourceShort('xf')`; focus BEGIN on open; Esc/CANCEL closes through the modal stack; `aria-live="polite"` gain line; z-index above finale overlay + system menu (read their CSS z-indexes); write text only when changed; listeners removed in `destroy()`.
**acceptance**: signatures exact; no 0x; textContent only; font >= 12 px; destroy cleans rect + DOM.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/(game/rendering/CycleTransition|ui/cycleConfirm)" && echo CHECK || echo OK
npx vitest run src/game src/ui
grep -nE "0x[0-9a-fA-F]{6}|innerHTML" src/game/rendering/CycleTransition.ts src/ui/cycleConfirm.ts && echo FAIL || echo OK
grep -nE "font-size:\s*([0-9]|1[01])px" src/ui/cycleConfirm.css && echo SMALL_FONT || echo OK
```

## T8a — HUD / stats / settings / tree / toast
**wave** 3. **files_owned**: `src/ui/{hudView,hudView.test,hud}.ts`, `src/ui/hud.css`, `src/ui/menu/{statsView,statsView.test,settingsView,settingsView.test,settingsPanel}.ts`, `src/ui/{notificationRules,notificationRules.test,toasts,techTree}.ts`, `src/data/notifications.ts`. **SHARED**: hud*/techTree/notificationRules (WP13 T6a `resourceShort`; keep).
**objective**: WP14.md T8a.
**context**: HUD model `cycle: string | null` (null at cycle 1, `cycleLabel` otherwise; read from `session.prestige.cycle`) rendered under the plaque, text only when changed; stats `BEST CYCLE` row (`formatDuration`, hidden while `bestCycleSeconds` null); settings toggle `CONFIRM NEW CYCLE: ON/OFF` (`aria-pressed`, same pattern as `statusMarkers`); `connectCycleNotices(session, toasts)` in `toasts.ts` toasting on `cycle` (title `CYCLE 0043`, body `+3 ECHOES (+90% ALL/S)`, tone system; text built by a pure fn in `notificationRules.ts`); `techTree.ts` marks dirty on `prestige` and `cycle`. Re-read WP13 edits first.
**acceptance**: pure builders tested (hud cycle null/CYCLE 0043, stats row hidden/shown, settings model toggle, cycle toast text); default HUD strings unchanged at cycle 1; `RESOURCES[..].short` not reintroduced.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/(ui|data/notifications)" && echo CHECK || echo OK
grep -nE "innerHTML|RESOURCES\[[^]]*\]\.short" src/ui/hud.ts src/ui/techTree.ts src/ui/toasts.ts && echo FAIL || echo OK
```

## T8b — Stamp SFX
**wave** 3. **files_owned**: `src/data/audio.ts` (`AUDIO.stamp`), `src/audio/{synth,gameAudio,audioMath,audioMath.test}.ts`. **SHARED**: all (WP13 T7 chord/chirp/wind).
**objective**: `playStamp()` on session `cycle`.
**context**: short low noise thump + metallic click <= 300 ms, `sfx` bus; params in `AUDIO.stamp`; pure helper in `audioMath.ts` (`stampPartials`/envelope list) tested; `gameAudio` subscribes `session.on('cycle')`, unsubscribes on dispose; mute + volume buses respected; no AudioContext before a gesture (existing lazy path); errors never escape.
**acceptance**: helper tests; existing audio tests unchanged; no tech-id or 0x literals.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio
npx tsc --noEmit 2>&1 | grep -E "^src/(audio|data/audio)" && echo CHECK || echo OK
grep -nE "0x[0-9a-fA-F]{6}|from ['\"]phaser" src/audio/*.ts && echo FAIL || echo OK
```

---

# WAVE 4 (single: T9)

## T9 — Wiring + smoke
**wave** 4. **files_owned**: `src/game/{bootstrap,debugHook}.ts`, `src/game/context.ts` (only if the controller must be exposed), `src/game/scenes/WorldScene.ts`, `src/ui/finale.ts` (FALLBACK only, EM decision 6), new `scripts/smoke/prestige.mjs`, `scripts/smoke/{finale.mjs,README.md}`. **SHARED with WP13 T11/T5/T4**: all; extend only.
**objective**: replace the stub; mount everything; smoke.
**context**: bootstrap: build `createNewCycleController({ session, now, confirm: cycleConfirm.open, playTransition: (onPeak,onDone) => worldScene port or sync fallback, closeDialogs: () => { techTree.close(); systemMenu.close(); } })` and assign to `ctx.newCycle` (finale overlay + system menu already read `ctx.newCycle`); late-bound port to WorldScene's `CycleTransition` (`reduced = !motionPolicy(session.settings).flashes`); `createCycleConfirm(root, { modals })`; MEMORY panel created + registered with `{ prestige, preview: controller.preview, buyPerk: id => session.buyPerk(id), revealed }`; `connectCycleNotices(session, toasts)`; hotkey guards per EM decision 4. WorldScene: create `CycleTransition` AFTER `FinaleDirector`, update it each frame after the director, dispose FIRST; push a `'cycle'` modal while active (input lock). `debugHook`: `prestige()`, `cycleState()` (C6). `finale.mjs`: step "BEGIN A NEW CYCLE disabled" -> enabled + reason line absent. `prestige.mjs`: WP14.md Validation Smoke steps (1)-(6), checks via `ok(...)` only, keys `prestige_*`, shot per step, `node --check` clean. README documents it. FIRST verify (grep + read) that after `reset` the WP13 overlay removes the `'finale'` modal and `finale-active`; edit `finale.ts` only if it does not.
**constraints**: no economy state in game layer; no tech-id literals; no 0x; 0 console errors; `npm run build` green.
**acceptance**: after a finale -> NEW CYCLE -> confirm -> transition -> cycle 2 (wasteland, Era I only, HUD `CYCLE 0043`, toast, Echoes 3); MEMORY tab works; postgame path works; confirm OFF skips dialog; reduced motion <= 1.2 s; hard reset clears prestige.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npm run typecheck && npx vitest run src/game src/ui && npm run build
for f in prestige finale; do node --check scripts/smoke/$f.mjs || echo "SYNTAX FAIL $f"; done
grep -nE "0x[0-9a-fA-F]{6}" src/game/bootstrap.ts src/game/scenes/WorldScene.ts src/game/debugHook.ts && echo FAIL || echo OK
grep -n "createNewCycleStub\|createNewCycleController\|cycleState\|prestige()" src/game/bootstrap.ts src/game/debugHook.ts
```

---

# Mode B checklist (after W4)
`npm run typecheck` · `npm test` (>= WP13 final + new) · `npm run build` (app chunk <= 200 KB) · `npx vitest run src/simulation/balance.sim.test.ts` (unchanged) · `npx vitest run src/simulation/prestige.sim.test.ts` (ratios printed) · `grep -rn "from 'phaser'" src/{simulation,data,persistence,utils,game/math} src/game/newCycle.ts src/ui/*View.ts src/ui/menu/*View.ts` empty · `grep -rnE "0x[0-9a-fA-F]{6}" src/game src/ui src/audio --include=*.ts | grep -v test` empty · `grep -rn innerHTML src/ui` empty · `git diff --stat HEAD -- src/data/technologies.ts src/simulation/production src/simulation/progression public` empty · no file changed outside owner lists · WP13 stub tests + ending tests still green.
Smokes (build + `vite preview`): wp2-crank, wp3-techtree, wp4-persistence, wp12-menus (tab count +1), stages, finale, prestige -> 0 errors. Art Director: transition peak/after shots, MEMORY panel 1280x720, confirm dialog. Docs (Director): PROJECT_STATUS (cycle-2 ratios), roadmap deviation note (D1/D3/D5).
