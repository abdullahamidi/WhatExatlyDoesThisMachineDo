# WP22 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP22.md` (authoritative) + `docs/plan/PART_TIERS.md` + repo read at HEAD `0fab65c` (W0 seed).
Worktree `C:/Users/sanan/wedtmd-art`, branch `claude/tiers-wp22`. Baseline: typecheck clean, 119 files / 3428 tests (16 skipped), build OK, app 402.8 / demo 404.8 KB, css 40.0 / 42.8 KB (limit 45), displayObjects peak 76, bootMs 777.6.
Director decisions applied: **D5 option A** (siphon stages 5 / 10, anchor glows 2 / 3, new `ring1Bead2` with `phi0Deg: 180`, restored parts 33 -> 34, components 104 -> 105); every "Director call" in WP22.md stands; art is Opus Art Director only; release refresh (store shots, STEAM_RELEASE, CHANGELOG, PROJECT_STATUS) is NOT part of WP22.
`<S>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad`. `<O>` = `<S>/WP22`. `<PW>` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`. Proof set `<S>/WP22-23/proof-tiers/`, edit template `<S>/WP22-23/tools/motor_tiers.py`. EOL helper (existing): `<S>/WP16b-3/tools/eol.mjs` (`crlf` | `lf` | `check`).
Ports: :4175 serves this worktree's `dist/` (rebuild only, never start or stop it). :4176 = demo preview, started and stopped only by the EM or the AD (netstat before and after). Never :4173, :4174, :4177, never the worktree `C:/Users/sanan/wedtmd-shell`.

## Unit rule
A wave holds at most 4 UNITS. Tasks that share a unit run one after another in the listed order (the Director spawns step 2 after step 1 reports); units of a wave run in parallel. An AD task is one unit.

## EM decisions / deviations from the plan (these WIN for workers)
1. **T1 split** into T1a (ids, manifest field, loader, tests, 3 guide rows), T1b (decal fallback painters), T1c (assetGuide.test hunk + ASSET_GUIDE regen, after T2).
2. **T3 split** into T3a (`partTiers.ts` + `restoredTextures.ts`, W2), T3b (`tierBeat.ts`, W1, needs only T2), T3c (`tierRelease.ts`, new pure planner for the hold / release, W3).
3. **T7 split** into T7a (`TierSparks.ts` + `TierShine.ts`, W3), T7b (`TierBeatFx.ts`, W4), T7c (`MachineView.ts` + `machineSource.ts` + `debugHook.ts`, W4). T9 is merged into T7c (the probes live in MachineView; same contract).
4. **T11 split** into T11a (`tiers.mjs` harness + cases A-D, W2) and T11b (cases E-G + showcase.mjs + prestige.mjs + README, W4).
5. **New T17** (W5): `src/assets/tierCoverage.test.ts` ties PART_TIERS to the manifest `tiers` and bounds the tier PNG bytes.
6. **AD split per wave**: AD1 (W1 production, batch 1) -> AD2w (W2 wire batch 1 + produce pistons / transformer) -> AD3a / AD3b (W3, P1 art) -> AD4a / AD4f (W4, P2 art + final report). AD5 audit = W6, round 2 = W8 (conditional). The AD owns `manifest.ts` tier fields from W2 on (T1a is done by then).
7. `diffTiers(prev, next, tracks?, manifest?)` takes an optional manifest (fixtures in tests; the real manifest has tiers only after the AD wired them).
8. `tierLevelSuffix` returns null for level < 1 (an unbuilt part has no mark).
9. Extra data exports in `machineTiers.ts` (T2): `TierDebrisKind`, `TIER_DEBRIS`, `TIER_FX_COLORS`, `PART_TIER_FX.ghostAlpha` and `flashAlpha`. The ghost is a plain tinted copy (`setTintFill`); the checker dither is judged by AD5 and, if wanted, comes back as a T14 fix.
10. `TierBeatFx.play` gains `delayMs` (release stagger) and the class gains `instant`, `torque`, `reset` (contract in the T7b / T7c prompts).
11. `splitRelease` ignores staged changes (they are neither beats nor instant). MachineView and `planTierRelease` handle staged changes themselves. A change with `hosts.length === 0` (no art wired for it) plays nothing and emits nothing.
12. Host `techId` is NOT asserted equal to the track tech (motorTuning hosts belong to the wornMotor unlock, improvedPistons hosts to pistonArray). Stage hosts are asserted.
13. Cross-check `AUDIO.refit.bellAtMs === PART_TIER_FX.settleMs` lives in T3a's test (T5 runs before T2 exists).

## Waves
| Wave | Units (steps in order) | Gate after |
|---|---|---|
| 1 | **A** T1a -> T1b -> T1c (T1c waits for T2) · **B** T10 -> T2 -> T3b (T2 waits for T10 and T1a) · **C** T5 · **D** AD1 (production batch 1) | Director: `npm run typecheck`; `npm test` red only in `src/game/math/teaser.test.ts` (104 -> 105) and `src/game/math/showcase.test.ts` (visual-max snapshot moves with the retune); both are T8 in W2 |
| 2 | T3a · T8 · T11a · **E** AD2w (wire batch 1, then pistons + transformer) | typecheck; `npm test` fully green |
| 3 | T4 · **F** T6 -> T3c · T7a · **G** AD3a -> AD3b | typecheck; `npm test` green |
| 4 | **H** T7b -> T7c · T11b · **I** AD4a -> AD4f | typecheck; `npm test` green |
| 5 | T17 -> **EM gate T12** (-> T13 only if bootMs > 3000) | build, budgets, smokes (below) |
| 6 | AD5 in-game audit (on the T12 build) | Director reads verdict + fix list |
| 7 | T14 AD-listed fixes (conditional, template) -> EM rebuild | build + budgets |
| 8 | AD5r2 audit round 2 (conditional) -> reviewer (Opus) -> T15 EM Mode B | Director: PROJECT_STATUS, merge order, commit |

### Transient errors (inside a wave only)
| Wave | Allowed |
|---|---|
| W1 | none expected. T2 / T1c / T3b start only after their start conditions (grep checks in the prompts). `teaser.test.ts` and `showcase.test.ts` stay red after W1 (expected, T8 owns both in W2). |
| W2 | none. AD2w may see a sibling's half-edited file in `typecheck`: re-run once, ignore files it does not own. |
| W3 | none (T6 adds `setTiers` that nothing calls yet; T7a adds new files). |
| W4 | none (T7c starts after T7b). |

## File ownership (exclusive per wave)
| Task | Files |
|---|---|
| T1a | `src/assets/assetIds.ts`, `src/assets/manifest.ts`, `src/assets/manifest.test.ts`, `docs/ASSET_GUIDE.md` (3 rows) |
| T1b | `src/assets/painters/tiers.ts`, `tiers.test.ts` (new), `src/assets/fallbackTextures.ts` |
| T1c | `src/assets/assetGuide.test.ts`, `docs/ASSET_GUIDE.md` (generated block) |
| T10 | `src/data/machineComponents.ts`, `machineComponents.test.ts`, `src/game/math/restoredTextures.test.ts` |
| T2 | `src/data/machineTiers.ts`, `machineTiers.test.ts` (new) |
| T3b | `src/game/math/tierBeat.ts`, `tierBeat.test.ts` (new) |
| T5 | `src/data/audio.ts`, `src/audio/synth.ts`, `src/audio/gameAudio.ts`, `src/audio/gameAudio.test.ts` |
| AD1 | `public/assets/machine/tiers/**` (batch 1), `scripts/art/tiers/**`, `<O>/ad/**` |
| T3a | `src/game/math/partTiers.ts`, `partTiers.test.ts` (new), `src/game/math/restoredTextures.ts` |
| T8 | `src/game/math/showcase.ts`, `showcase.test.ts`, `teaser.test.ts`, `src/simulation/machineTiers.sim.test.ts` (new) |
| T11a | `scripts/smoke/tiers.mjs` (new) |
| AD2w | `src/assets/manifest.ts` (tier / decal fields), `docs/ASSET_GUIDE.md`, `public/assets/machine/tiers/**`, `scripts/art/tiers/**`; may fix a red tier-key filter in `src/assets/manifest.test.ts` |
| T4 | `src/ui/techTreeView.ts` (`detailOf`), `techTreeView.test.ts`, `src/ui/notificationRules.ts` (`purchaseBurstMessage`), `notificationRules.test.ts`, `src/data/textSweep.test.ts` |
| T6 | `src/game/entities/MachineAnimator.ts` |
| T3c | `src/game/math/tierRelease.ts`, `tierRelease.test.ts` (new) |
| T7a | `src/game/entities/TierSparks.ts`, `TierShine.ts` (new) |
| AD3a/b, AD4a/f | same AD ownership as AD2w; AD4f also the `docs/ASSET_GUIDE.md` section "Part evolution tiers" |
| T7b | `src/game/entities/TierBeatFx.ts` (new) |
| T7c | `src/game/entities/MachineView.ts`, `machineSource.ts`, `src/game/debugHook.ts` |
| T11b | `scripts/smoke/tiers.mjs` (cases E-G), `showcase.mjs`, `prestige.mjs`, `README.md` |
| T17 | `src/assets/tierCoverage.test.ts` (new) |
| T13 (cond.) | `src/assets/manifest.ts`, `manifest.test.ts`, `src/game/entities/MachineView.ts` |
| T14 (cond.) | only files named in the AD fix list |
| AD5 / AD5r2 | `docs/plan/ART_AUDIT.md` (append), AD art files named in its fix list |

Forbidden for all: `src/simulation/**` (except T8's new test), `src/persistence/**`, `src/data/technologies.ts`, `src/data/types.ts`, settings files, `src/game/scenes/{WorldScene,BootScene,ShowcaseScene}.ts`, `src/game/context.ts`, `src/game/bootstrap.ts`, `scripts/smoke/{store-shots,perf,soak,stages,e2e-full,a11y,ux,resolutions,demo,finale}.mjs`, `scripts/smoke/perf-budget.json`, `CHANGELOG.md`, `docs/STEAM_RELEASE.md`, `docs/PROJECT_STATUS.md`, `docs/GAME_SPEC.md`, `package.json`, `package-lock.json`, any CSS.

## Task summaries (full self-contained prompts are the `prompt` fields)
- **T1a**: 3 decal ids (117 -> 120), `AssetEntry.tiers`, `tierTextureKey`, `planAssetLoads` tier loads (own, `#tN`, `#tN#rot`, `#tNb`), 3 decal manifest entries, exact-key rot filter, fixture + guard tests, 3 guide rows.
- **T1b**: annulus fallback painters for the 3 decals in PALETTE colours + tests.
- **T1c**: `machineEra` / `layerCell` resolve decals through `PART_TIERS`, `fileCell` lists tier variants, ASSET_GUIDE block regenerated with `ASSET_GUIDE_OUT`.
- **T10**: siphon gates 5 / 10, anchor glows 2 / 3, `ring1Bead2` (appended last), Era V contract tables, counts 104 -> 105 and 33 -> 34.
- **T2**: `machineTiers.ts` = PART_TIERS section 1.2 verbatim + FX + text + sweep + debris data; 16-group test file.
- **T3b**: `tierBeatFrame` full / reduced timeline + tests at 9 + 3 timestamps.
- **T5**: `AUDIO.refit` / `torqueTick`, `playRefit` / `playTorqueTick(step)` after `playClunk`, subscriptions after `partLanded`, fake-synth tests.
- **AD1**: tools + motorTuning (ship the proof) + gearRatio + flywheel + copperWinding + motorRetrofit: 40 PNGs.
- **T3a**: `partTiers.ts` (tierOf, partTierMap, hostTiers, resolveTextureKey, diffTiers, splitRelease, heartbeatLow, torqueStep, tierLevelSuffix, tierToastSuffix) + `swapTextureKey` delegating to the resolver.
- **T8**: showcase raises each track to its top; snapshots; teaser count; sim guard A2 with printed table.
- **T11a**: `tiers.mjs` harness + cases A-D.
- **AD2w**: wire batch 1, regenerate the guide, produce pistons + transformer (PixelLab + snap), wire: 50 PNGs total.
- **T4**: MK text in `detailOf`, ` · MK n` in `purchaseBurstMessage`, textSweep `TIER_SWEEP`.
- **T6**: `setTiers`, `hostTier`, resolver in the animator, heartbeat pass before the kind loop, vibrate amplitude per tier, `update(..., nowMs?)`.
- **T3c**: `planTierRelease` (pure): beats / instant / staged / torques from level snapshots.
- **T7a**: 64-particle pool (`TierSparks`) and shine CanvasTexture LRU (`TierShine`).
- **AD3a/b**: P1 art: fire glows, induction heater, condenser, coil ring 1, bellows, exciter feed, then calliope (PixelLab), servo base / arm, spire wave modes 2-5: 85 PNGs total.
- **T7b**: `TierBeatFx` (flash, swap, ghost, debris, bolts, shine, shake, reduced path, instant, torque, cancel, reset).
- **T7c**: tier state, purchase / hold / release / prestige / sync / refreshDisplay paths, decals, signals, probes, `shake(amplitude)`; debug hook probes.
- **T11b**: cases E-G, showcase top-tier checks + RESTORED_TOTAL 34, prestige 34 + tier findings, README section.
- **AD4a/f**: backfeed terminal + steam lance (P2), final gate report, guide section, size budget: 91 PNGs.
- **T17**: coverage test (expected variants table, naming rule, pulse and rot rules, 1200 KB bound).
- **T13** (cond., bootMs > 3000): `#t*#rot` loads deferred to a World-loader background load.
- **T14** (cond., template): AD5 fix list applied.
- **AD5 / AD5r2**: in-game audit, ART_AUDIT section `## WP22 — part tiers audit`.

## Expected art files after each AD step (hand-off)
- After W1 (AD1, 40 PNGs, not wired): `worn-motor-t2..t5`, `worn-motor-t5b`, `motor-plinth-t2..t5`, `gear-large-t2/t3` + `rot/gear-large-t2/t3-rot`, same for `gear-small` and `pulley-main`, `flywheel-pedestal-t2/t3/t3b`, `flywheel-t3` + rot, `pulley-flywheel-t3` + rot, `pulley-crank-t3` + rot, `decals/gear-rim`, `decals/flywheel-rim-2`, `decals/flywheel-rim-3`, `coils-1-t2`, `coils-3-t5`, `motor-retrofit-t2..t5/t5b`.
- After W2 (AD2w, 50 PNGs, 14 assets + 3 decals wired): + `piston-block-t2..t5/t5b`, `transformer-t2..t5/t5b`.
- After W3 (AD3a/b, 85 PNGs, wired): + `firebox-1-t2`, `firebox-3-t5`, `induction-heater-t2..t5/t5b`, `condenser-t2..t5/t5b`, `coil-ring-1-t2`, `bellows-t2/t3/t3b`, `exciter-feed-t2/t3/t3b`, `calliope-t2..t5/t5b`, `servo-base-t2/t3/t3b`, `servo-arm-t2/t3` + rot, `spire-wave-t2..t5`.
- After W4 (AD4a/f, 91 PNGs, wired): + `backfeed-terminal-t2/t3/t3b`, `steam-lance-t2/t3/t3b`.

## T12 EM gate (W5; one Bash call per line; `<O>` and `<PW>` inlined as absolute paths)
1. T17 green first. `cd "C:/Users/sanan/wedtmd-art" && npm run typecheck`; `npm test` (0 failed).
2. `npm run build && node scripts/perf/bundle-budget.mjs` -> PASS (app <= 460, css <= 45; manual: css <= 40.1, publicAssetsKb <= 2700). `npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo` -> PASS (css <= 42.9).
3. :4175 serves the fresh `dist/`. Demo preview (background): `npx vite preview --outDir dist-demo --port 4176 --strictPort` after `netstat -ano | grep ':4176 .*LISTENING'` is empty; check again after.
4. `PW_PATH="<PW>" node scripts/smoke/tiers.mjs "http://localhost:4175/?debug=1" "<O>/val/tiers"` and the same on :4176 (cases A-E) -> `fail []`, `errors []`.
5. Pre-runs: `showcase.mjs`, `finale.mjs`, `prestige.mjs`, `perf.mjs` (gates bootMs <= 3000, machineMeanMs <= 4; read displayObjects 76 +- 2), `store-shots.mjs` with `SIZES=1080` (no-regression, 14 `_no_spoiler` true), `demo.mjs` on :4176. All `fail []`, `errors []`.
6. bootMs > 3000 (median of 3 `perf.mjs` runs) -> spawn T13. Any other red -> fix assignment to the owning task.
7. Stop :4176 (`taskkill //PID <pid> //F`), netstat empty.

## T15 Mode B (W8)
Package acceptance A1-A10 and validation commands 1-17 of WP22.md, run after the Opus reviewer.
