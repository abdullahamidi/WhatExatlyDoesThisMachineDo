# WP17 - Worker Assignments (Engineering Manager, Mode A)

Source: planner WP17 (D1-D11, C1-C8, T1-T11) + `docs/plan/STEAM_DEMO_PROGRAM.md` (wins) + repo read at HEAD `5636a42`. Template: `WP15-assignments.md`.
Baseline: typecheck clean, 73 files / 2274 tests, build OK. Save stays **v2** (missing tech ids load as 0, uncapped levels load unclamped; persistence code already does this).
Parallel track: WP19 (Steam shell) in `C:/Users/sanan/wedtmd-shell`. WP17 workers never touch that folder, `bootstrap.ts`, `main.ts`, `index.html`, `package.json`, `BootScene.ts`, `systemMenu.*`, `settingsView.ts`, `data/settings.ts`, `src/persistence/*`, `src/audio/*`, `data/audio.ts`, `data/music.ts`.

## Verification done by the EM before decomposing
- Tree slots (era 3 (2,2), era 4 (3,2), era 5 (3,2) and (4,2)) are free. No `Record<TechId,...>` literal outside `INSTALL_LINES`. No `Record<MachineComponentId|SocketId>` outside `machineComponents.ts`. `ASSET_MANIFEST` is the only exhaustive `Record<AssetId>`.
- Planner numbers re-computed: all C6 saturation values and speed-continuity values check out (nullCore at 4.65 = 141.0 vs 141.4, beads at 5 = 179.4 vs 180, transformer 30 and turbine 800 identical). Chimney 3.45e6, lance 6.31e6.
- `machineComponents.ts` effects are dead data (no reader), safe to empty.

## EM deviations from the planner text (these WIN)
1. **Task split / wave layout.** T6 is split: T6 = pure view model + WorldScene call, **T12 = HUD DOM + CSS** (`hud.ts`, `hud.css`; hud.css was T6's). The new machine guard tests moved out of T7 into **T9** (new file `src/data/machineComponents.wp17.test.ts`), so T7 stays data + pin updates and T9 owns every driver-refit guard (machine and steam). Waves: W1 T1 T2 T3 T4; W2 T5 T6 T7 T12; W3 T8 T9 T10 T11; W4 EM Mode B.
2. **Pipe link count is 7, not 6.** 5 existing pipes + bellows hose + steam lance = 7; 3 belts + 2 rods + 8 cables + 7 pipes = 20 links.
3. **generatorGlow painter vs pulley.** The planner rule (winding area y 10..54 and strip (8,52,80,2) with the pulley circle r 11 at (52,49) empty) is self-contradictory. T4 draws the winding as row spans that skip the circle and the strip as two rects (8,52,34,2) + (63,52,25,2).
4. **WP13 asset test** `slice(98)` -> `slice(98, 112)` (T4) because 5 ids are appended after it.
5. **T5 ladder L3** also relaxes the T1 guard `growth >= 1.4` if it lowers legacy growth to 1.35.
6. Prompts avoid double quotes / backslashes and use `cd '<R>'` so the Director can paste them through JSON safely.

## Waves
| Wave | Tasks | Gate |
|---|---|---|
| 1 | **T1** economy data + copy, **T2** greedy helpers, **T3** era/HUD data + formatters, **T4** legacy assets + painters | baseline green |
| 2 | **T5** balance guards + save test + tuning owner (needs T1, T2), **T6** HUD view model (needs T3), **T7** machine data (needs T1, T4), **T12** HUD DOM + CSS (contract only, parallel to T6) | W1 merged; Director applies N1 first |
| 3 | **T8** crank gain text (needs T6), **T9** steam lance + machine guard tests (needs T1, T7), **T10** animator hz cycles (needs T7), **T11** smokes + README (contract only) | W2 merged, tsc clean |
| 4 | EM Mode B (below) | W3 merged |

### Transient tsc / test state (inside a wave only)
| After | Allowed |
|---|---|
| W1 | tsc clean expected (T1 adds ids, consumers are dynamic; T4 adds manifest entries in the same task). `persistence.test.ts` 2 pins fail (N1). |
| W2 (in flight) | `src/ui/hud.ts` (T12) vs `hudView.ts` (T6) mismatch until both land. After W2: tsc clean. `HandCrank.ts` still uses `clickGainText` (T6 keeps it). |
| W3 (in flight) | `FloatingText.spawn` removed by T8 together with the only caller (`HandCrank`). `SteamFx.ts` `'steamLance'` needs T7 (landed). `MachineAnimator` `anim.hz` needs T7 (landed). After W3: tsc clean. |

## Notes for the Director (cannot be done inside WP17)
- **N1 (blocking for a green `npm test`)**: `src/persistence/persistence.test.ts` line 581 `expect(ERA_FOUR_IDS).toHaveLength(9)` -> `10`; line 624 `expect(ERA_FIVE_IDS).toHaveLength(10)` -> `12`. Apply right after W1 merges (before W2) so worker full-suite runs are clean. WP19 worktree conflict is trivial.
- N2: `hud.css` may conflict with WP19 `--ui-zoom` anchoring edits (T12 adds `max-width: 324px` on `.hud-panel`).
- N3: `MachineAnimator.ts` / `SteamFx.ts` edits are localized (WP15 T7 likely cut).
- N4: WP15 T4: map `MUSIC.keystones` / bed trims to `currentEra` (now in `src/simulation`); purchase cue for legacy techs keyed by `RESOURCES[costRes].era`.
- N5: `docs/plan/WP17.md` does not exist in the repo; these prompts are self-contained. Save this file as `docs/plan/WP17-assignments.md`.

## Tasks (full worker prompts are in the structured output `waves[].tasks[].prompt`; paste verbatim after the preamble)
| Id | Wave | Files owned | Depends |
|---|---|---|---|
| T1 | 1 | `src/data/types.ts` (TECH_IDS), `src/data/technologies.ts`, `src/data/notifications.ts` (INSTALL_LINES), `src/data/technologies.test.ts`, `src/simulation/progression/status.ts` (autoClick text), `src/simulation/progression/progression.test.ts` | - |
| T2 | 1 | `src/simulation/sim/greedy.ts`, `greedy.test.ts` | - |
| T3 | 1 | `src/data/eras.ts`, `src/data/hud.ts`, `src/data/hud.test.ts`, `src/simulation/progression/era.ts`, `era.test.ts`, `src/simulation/index.ts`, `src/simulation/production/rates.ts`, `rates.test.ts`, `src/utils/format.ts`, `format.test.ts` | - |
| T4 | 1 | `src/assets/assetIds.ts`, `manifest.ts`, `manifest.test.ts`, `painters/legacy.ts`, `painters/legacy.test.ts`, `fallbackTextures.ts`, `docs/ASSET_GUIDE.md` | - |
| T5 | 2 | `src/simulation/balance.sim.test.ts`, `src/simulation/legacyFeeds.save.test.ts`; conditional numeric fields in `src/data/technologies.ts` + `technologies.test.ts` | T1, T2 |
| T6 | 2 | `src/ui/hudView.ts`, `hudView.test.ts`, `src/game/scenes/WorldScene.ts` (renderHud call) | T3 |
| T7 | 2 | `src/data/machineComponents.ts`, `machineComponents.test.ts` | T1, T4 |
| T12 | 2 | `src/ui/hud.ts`, `src/ui/hud.css` | T3 (types), T6 (parallel) |
| T8 | 3 | `src/game/math/gainBlock.ts`+test, `src/game/rendering/FloatingText.ts`, `src/game/entities/HandCrank.ts`, `src/data/world.ts` (FLOATING_TEXT), `world.test.ts`, `src/ui/hudView.ts`+test (delete clickGainText only) | T6 |
| T9 | 3 | `src/data/steamFx.ts`+test, `src/game/rendering/SteamFx.ts` (RATE_EMITTER_PART), `src/data/machineComponents.wp17.test.ts` | T1, T7 |
| T10 | 3 | `src/game/entities/MachineAnimator.ts`, `src/game/math/animation.ts`+test | T7 |
| T11 | 3 | `scripts/smoke/stages.mjs`, `finale.mjs`, `wp3-techtree.mjs` (comments), `README.md` | contract only |

## Mode B checklist (W4, EM runs; Director applies N1 first)
```
R='C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo'; cd "$R"
PW=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright
OUT=C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP17
npm run typecheck ; npm test ; npm run build            # build refreshes the running preview on :4173 (do not start another server)
npx vitest run src/simulation/balance.sim.test.ts src/simulation/prestige.sim.test.ts src/simulation/achievements.sim.test.ts src/simulation/sim/greedy.test.ts src/simulation/legacyFeeds.save.test.ts --silent=false --reporter=verbose
mkdir -p "$OUT/stages" "$OUT/wp2" "$OUT/wp3" "$OUT/finale"
PW_PATH=$PW ONLY=s0_crank,s9_era2_full,s11_era3_full,s13_era4_full,s15_era5_full,s16_postgame node scripts/smoke/stages.mjs http://localhost:4173/ "$OUT/stages"
PW_PATH=$PW node scripts/smoke/wp2-crank.mjs http://localhost:4173/ "$OUT/wp2" ; ... wp3-techtree.mjs ... "$OUT/wp3" ; ... finale.mjs ... "$OUT/finale"
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils      # empty
git diff --name-only 5636a42 -- src/game/bootstrap.ts src/main.ts index.html package.json src/game/scenes/BootScene.ts src/ui/systemMenu.ts src/data/systemMenu.ts src/ui/menu/settingsView.ts src/data/settings.ts src/persistence src/audio src/data/audio.ts src/data/music.ts   # only the N1 file
```
Pass criteria: all smokes `errors: []`; finale `finale_0_fastforward_failed: []`; stages s15 buys all `:true`, `parts5` all true, `parts17` all true at s15/s16; hud titles s0 'ERA I · MECHANICAL', s9 'ERA II · ELECTRICAL', s11 'ERA III · PRESSURE', s13 'ERA IV · RESONANCE', s15 'ERA V · ???', s16 'RESTORATION ENGINE'; visible rows 1/2/3/4/5/5; frontier me/ee/pr/rs/xf/xf; auto null at s11 and 'AUTO-CRANK 3/s' at s13; panel right <= 340; `bellowsFrames` not all equal; balance report table (A/B/C era ends, dead minutes, spend shares) in the EM report; PF in A 230-290 min; era I EXACT test green; wp3 node counts era III 10, IV 10, V 12. Director / Art Director eyeball s9/s11/s13/s15/s16 PNGs: title + rows readable, gain block stacked and tinted, not on beam or plate, new parts and cables / pipes visible (generator glow, bellows, exciter feed cable, backfeed cable, steam riser + lance puffs). Coordinates of the 5 parts are placeholders the Art Director (A17) may move.

If the HUD panel overflows (right > 340) the fix is CSS-only in `src/ui/hud.css` (T12 re-assignment). If the T5 guards are red after L3 the EM reports the table and the Director decides (no new techs, no era I-III change).

## Common preamble
(see structured output field `preamble`; pasted before every worker prompt)
