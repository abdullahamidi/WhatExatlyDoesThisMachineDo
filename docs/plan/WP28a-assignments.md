# WP28a - Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP28.md` (WP28a parts, "Director answers" binding) + repo read at HEAD `4f962fb` (v0.11.0 + WP28 plan). Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/playtest-wp28`. Nobody commits; `package-lock.json` is never staged.
Baseline: typecheck clean; vitest 5746 pass / 17 skipped (165 files); app JS 507.5 / 508.1 (demo) of 510 KB; Director chunk 206.2 / 206.3 of 210; FaultMarker 11.0 of 12; CSS 41.1 / 43.9 (demo) of 45; check_gates 91 files 0 failures; GPU p95 16.8 ms; pacing A p90 1:24 max 4:24, B p90 1:56 max 6:08.
Fence: dist preview :4174 and dist-demo preview :4177 only (the EM gate starts them and kills them; restart after every rebuild); never 4173 / 4175 / 4176 / 5173; the main tree is idle. One Playwright browser at a time. Workers run vitest with `--maxWorkers=1` on their own files only; at most 3 agents per wave.
`<S>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad`, `<O>` = `<S>/WP28`, `<E>` = `<O>/eco` (harness, read only; never re-bundle), EOL helper `<S>/WP28a/tools/eol.mjs` (modes `crlf`, `lf`, `check`), AD1 hand-off `<O>/plan/ad1-handoff.md`, gate output `<O>/val/`, PW = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`.

## EM decisions / deviations (these WIN for workers)
1. **Q6 Find payout 4 / 6 / 8 s.** `FindClock` gets a second rng `payRng = (seed ^ FINDS.paySeedXor) | 0`; each spawn draws one value from it (`spreadS` of `FINDS.payoutSpreadS` = [-2, 0, 2], equal weight) and stores it in `FindAlive.spreadS`. The interval stream is untouched, so every C5 parity case (spawn / expire steps, draws) still holds exactly. A collect pays `max(0, payoutSeconds + spreadS)` seconds; `collectFind` returns `seconds`; the session `find` event and the popup (`FOUND +{s}s`) carry it. Mean stays 6 s (+1 s per Organ / Kite), so the REC gates hold within 1 %.
2. **Splices live in a new data file** `src/data/splices.ts` (compact builder + 16 defs, exported `SPLICE_TECHS`), merged into `TECHNOLOGIES` by one spread. Reason: `technologies.ts` plus its 1300-line test is too big for one pass together with the Splices.
3. **Splits** (each over one Haiku pass): T1 -> T1a (Splices, types, effect text, pacing constants) + T1b (REC economy data + `technologies.test.ts`); T13 -> T13a (data + maths) / T13b1 (renderers) / T13b2 (director + props); T14 -> T14a (Find marker, WorldReach shell) / T14b (poke layer, tooltip, hook rest); T15 -> T15a (pure pokes, runner `interrupt`, behaviour data) / T15b1 (cast overlay, crow hop, Sensor 7, props answers) / T15b2 (director); T17 -> T17a / T17b by directory. The plan task T2 (keys) is merged into T11 (keys + audio), because both edit the same wiring (`context.ts`, `bootstrap.ts`).
4. **Poke sounds use the existing `feedback.worldSound` signal** with a new variant `{ kind: 'poke'; id: PokeSoundId }` (no `ReachAudioPort`: WorldScene has no audio handle). `GameAudio` counts them in `stats().pokes`. `denies` counts the existing `purchaseDenied` handler.
5. **Save equivalence test (Director answer Q4)** is owned by T3 (`src/persistence/economyRemap.equivalence.test.ts`). EM pre-check (scratch `<S>/WP28a/savecheck.ts`): with the REC numbers as typed, a remapped save keeps perSecond within 1 % in eras I-II (exactly 0 %), but drifts up to 1.4 % in era III and 2.8 % in eras IV-V (per-level roundings: bellowsDrive and gridExciter 2.5 vs 8/3, inductionHeater 0.65 vs 1.9/3, resonantSiphon 0.37 / 1.7, graviticAnchor 1.05^2 vs 1.1). The test asserts 1 % for eras I-II, 3 % for III-V, prints the table, and the EM reports this to the Director. Tiers are identical for every old level (exact rule).
6. `pokeTargets` is split: T13b2 fills the Splice targets, T15b2 adds the cast and prop targets. Crow perches for s8 / s8w / s10 come from the AD1 hand-off (T15a leaves them empty, T15b1 fills them).
7. T4 adds `relicTotal(maxEra)` and `FIND_TEXT.blankTitle`; T6 adds `RELICS_MAX = 15` (T8 pins it equal to `RELIC_NOTES.length`). The `find` event payload adds `seconds`.
8. Pacing helper `purchaseGaps(purchases, endT, firstAt?)` takes an optional `firstAt` map for the era column.
9. The wave plan has 8 pre-gate waves (plan: 7) because of the splits; no wave exceeds 3 units.

## Waves
| W | Ids | Notes |
|---|---|---|
| 1 | **T1a**, **AD1** (Opus), **T15a** | no dependencies |
| 2 | **T1b**, **T4**, **T6** | all need T1a |
| 3 | **T3**, **T7**, **T13a** | T3 needs T1b + T6; T7 needs T4; T13a needs AD1 + T1a |
| 4 | **T8**, **T9**, **T13b1** | T8 needs T4 + T6; T9 needs T1b + T3 + T7; T13b1 needs T13a + AD1 |
| 5 | **T11**, **T12**, **T13b2** | T11 and T12 need T8; T13b2 needs T13b1 |
| 6 | **T10**, **T14a**, **T15b1** | T10 needs T8; T14a needs T11, T8, T13b2, AD1; T15b1 needs T15a, T13b2 |
| 7 | **T14b**, **T15b2**, **T5** | T14b needs T14a; T15b2 needs T15b1; T5 needs T1b |
| 8 | **T16**, **T17a**, **T17b** | re-pins need everything above |
| 9 | **G** (EM Mode B + reviewer), **AD2** (Opus) | order: EM steps 1-8 (builds, previews), then AD2, then EM smokes 9-11, never two browsers |
| 10 | **T18** (conditional) | the EM issues it from the AD2 and reviewer lists |
Transient tsc errors: none expected after any wave. Inside a wave, an error that points into a sibling file is ignored and named in the report.

## File ownership (exclusive per wave; a file moves between owners only across waves)
- T1a: `src/data/types.ts`, `pacing.ts`, `splices.ts`, `splices.test.ts`, `technologies.ts` (import + spread only), `notifications.ts`, `systemLogs.ts`, `src/simulation/progression/status.ts`, `src/simulation/production/rates.ts`, `src/simulation/faults.ts`, `progression.test.ts`.
- AD1: `public/assets/world/splices-a.png`, `finds.png`, `scripts/art/world/**`, `src/assets/manifest.ts`, `assetIds.ts`, `docs/ASSET_GUIDE.md`, `docs/plan/DENIZEN_ART.md`, `docs/plan/ART_AUDIT.md` (AD1 part), `<O>/plan/ad1-handoff.md`.
- T15a: `src/data/pokes.ts`, `src/game/math/pokes.ts` (+test), `src/game/math/worldBehaviour.ts` (+test), `src/data/worldBehaviour.ts` (+test).
- T1b: `technologies.ts` (all but the merge lines), `technologies.test.ts`. T4: `src/simulation/finds.ts` (+test), `src/data/finds.ts` (+test). T6: `economyMigration.ts` (+test), `src/persistence/{schema,codec,compat.test,persistence.test}.ts`, `src/data/livingWorld.ts`, `src/simulation/worldSave.ts`, `GameSession.world.test.ts`.
- T3: `src/data/{machineTiers,machineComponents,world,livingWorld}.ts` (+ their tests), `src/data/pacing.test.ts`, `src/game/math/{partTiers,showcase}.test.ts`, `src/persistence/economyRemap.equivalence.test.ts`. T7: `src/simulation/sim/{greedy,pacing}.ts` (+tests). T13a: `src/data/{spliceWorld,worldReach}.ts`, `src/game/math/{spliceWorld,reachLevel}.ts` (+tests).
- T8: `src/simulation/{GameSession,events,index}.ts`, `GameSession.finds.test.ts`, `GameSession.purchaseMax.test.ts`. T9: the ten sim test files named in its prompt. T13b1: `src/game/rendering/{SpliceProps,SpliceLines}.ts`.
- T11: `src/data/{settings,audio}.ts`, `src/ui/{hotkeyRules,hotkeys}.ts` (+test), `src/game/{context,bootstrap}.ts`, `src/ui/menu/settingsView.ts` (+test), `src/audio/**`. T12: `src/ui/{techTreeView,techTree}.ts` (+test), `techTree.css`, `src/data/ux.ts` (SPLICE_TAB only). T13b2: `LivingWorldDirector.ts`, `WorldProps.ts`.
- T10: `src/data/ux.ts` (NEXT_BUY), `src/ui/{guidanceView,guidance,notificationRules,toasts,systemLog,systemLogRules}.ts` (+tests), `guidance.css`, `src/ui/menu/{achievementsView,achievementsPanel}.ts` (+test), `achievementsPanel.css`. T14a: `WorldReach.ts`, `FindMarker.ts`, `src/game/math/findMarker.ts` (+test), `src/data/findWorld.ts`, `WorldScene.ts`, `bootstrap.ts` (warm-up line), `debugHook.ts` (find part). T15b1: `LivingWorld.ts`, `worldPlayback.ts`, `WorldProps.ts`, `src/data/pokes.ts` (perches).
- T14b: `PokeLayer.ts`, `WorldReach.ts`, `debugHook.ts`, `CameraController.ts`, `src/data/world.ts` (dragPassName), `src/ui/worldVoice.css`. T15b2: `LivingWorldDirector.ts`. T5: smoke buy lists named in its prompt + the TS lists in `worldBehaviourMetrics.ts` and four tests.
- T16: `scripts/smoke/{finds,splices,pokes}.mjs`, `economy.mjs`, `store-shots.mjs`, `README.md`. T17a / T17b: failing tests by directory (data, simulation, persistence, utils, assets / game, ui, audio). AD2: `docs/plan/ART_AUDIT.md` (AD2 part).
- Forbidden for all: `package.json`, `package-lock.json`, `src/persistence/fixtures/**`, `public/assets/**` (AD only), the main repo folder, WP28b work.

## Task summaries (full prompts are the `prompt` fields)
- **T1a**: types (16 ids, `Branch` splice, `findSeconds` / `findRate`), `SPLIT_PARTS` + `ECON_REVISION`, 16 Splices (builder), wake lines, `SYSTEM_LOG_CUT`, `describeEffect` (fine convert numbers, new effects), `isSplice`, no-op rate / fault cases. TECH_LIST 55 -> 71.
- **T1b**: the 17 REC tracks, 15 requirement minLevels, 21 unlock prices, 13 description numbers; `technologies.test.ts` re-pinned (era filters skip Splices, count 71, A4 guard learns the new effects, US-spelling list).
- **T4**: `FINDS`, 15 relic notes, texts, `relicTotal`; pure clock with the Q6 spread; parity tests.
- **T6**: `econ: 28` remap (`economyMigration.ts`, schema, codec), `relics` in the world block, fixture expectations listed old -> new.
- **T3**: visual thresholds `parts x (L - 1) + 1` (tiers, staged parts, world stages, shadows rule), guard `pacing.test.ts` (A2), save equivalence test (Q4).
- **T7**: multi-buy greedy (`buyPasses` 50), Finds process, events / availableAt, `find` income, `pacing.ts` helpers.
- **T13a**: `SPLICE_WORLD` data from the AD1 hand-off, `REACH_LEVEL`, `spliceState`, tooltip, pulses, `linePath`, clock tick schedule, placement guard (A14).
- **T8**: session Finds (`stepFinds`, `collectFind`, `debugForceFind`), `purchaseMax`, `recordWorld` keeps relics, `splicesCut`.
- **T9**: `pacing.sim.test.ts` (PC1-PC13), re-targets (EXACT era I, demoCap window, click-share formulas), Finds options on every profile.
- **T13b1**: `SpliceProps` and `SpliceLines` renderers. **T13b2**: director wiring, wake beat, clock lit face, payphone ring cadence, Splice targets, stubs.
- **T11**: key `g` + `collectFind` command + SETTINGS > KEYS line + audio cues (finds, relic, splice wake, pokes).
- **T12**: SPLICES tab + rows + BUY MAX. **T10**: NEXT BUY line, FIELD NOTES, relic toast, SYS LOG cut line.
- **T14a**: WorldReach shell, Find marker, key path, hook (find). **T14b**: poke layer, tooltip, drag pass-through, wake announcement, hook (rest).
- **T15a**: pure ladder, bags, data tables, `interrupt`, behaviour data. **T15b1**: overlay, crow hop, Sensor 7, props answers. **T15b2**: `poke`, targets, stats, `flip`.
- **T5**: buy-list remap in smokes and tests. **T16**: smokes finds / splices / pokes, README, F_hud_fit, store shots. **T17a / b**: re-pins.

## G gate (EM Mode B, W9): the plan Validation steps 1-14 plus
- Step 6: the EM adds `lazyReachKb`, `lazySharedKb` and `lazyWorldTotalKb` rows to `scripts/perf/bundle-budget.mjs` and sets limits (measured + 1 KB, never above P14 caps; `cssKb` 45; app growth over 508.1 on dist-demo <= +13.0).
- Add: the `economyRemap.equivalence` table is printed and recorded (decision 5); harness parity of the Finds clock (C5 cases) and the greedy step order read side by side with `<E>/g28.ts`; Q6 spread check (A find income share near 5.4 %).
- Failures go back as fix assignments (T18 or the owner); the AD2 fix list `F<n>` is data / placements / CSS only.
