# WP25 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP25.md` (Revisions 1-3, authoritative) + GAME_SPEC economy + code at `6258d5a` (its `src/` equals `6245240`).
Worktree `C:/Users/sanan/wedtmd-art`, branch `claude/eco-wp25` (base `6258d5a`). Parallel package: WP24 (`C:/Users/sanan/wedtmd-shell`, ports :4174 / :4177). WP25 merges first.
Baseline: typecheck clean, 148 test files / 4736 pass / 17 skipped, build OK, app 483.2 / demo 483.8 KB (appRawKb 500), lazy world 116.6 KB (120), css 41.0 / 43.8 KB (45); world.mjs G_cost quiet 0.17-0.19 ms; every smoke `fail []`, `errors []`.
Fence: :4175 already serves `dist/` (re-reads files per request; `npm run build` refreshes it; never start another server there). :4176 = demo preview (`npx vite preview --outDir dist-demo --port 4176 --strictPort`, background, only when needed; `netstat -ano | grep ':4176 .*LISTENING'` before and after; `taskkill //PID <pid> //F` when done). Never touch :4173 / :4174 / :4177. Load: at most 3 units per wave, one Playwright browser at a time. Nobody commits; never stage `package-lock.json`.
`<S>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad`, `<O>` = `<S>/WP25` (dirs `calib/ val/ tools/ ad/` exist; `tools/eol.mjs` = line-ending helper `crlf|lf|check`; `tools/failing.mjs <report.json>` = failing-test lister for a vitest JSON report). `<PW>` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`. `<BASE>` = `6258d5a`.

## Director decisions that win over the plan
D1 V0p, reading R1 (click = extra action); WP25b Surge only if the user asks. T1 runs on Opus (plan D14). Servo era-II art: the existing Crank Servo art stays next to the generator; an AD1 finding is a follow-up art item, not a WP25 blocker (D16). No save version bump; balance constants only in `src/data`; `rates.ts` / `tick.ts` untouched unless the plan's STOP rule triggers (then stop and report). Release refresh (store set, STEAM_RELEASE, CHANGELOG) is not WP25.

## EM decisions / deviations (these WIN for workers)
1. **Splits (each plan task above one Haiku pass).** T3 -> T3a (`technologies.ts` + test) and T3b (`prestige`, `systemLogs`, new `systemLogs.test.ts`). T6 -> T6a (`passiveFirst.sim.test.ts`) and T6b (balance / signoff / demoCap / worldLogs edits). T8 -> T8a (data + pure maths + tests) and T8b (OutputTicker + WorldScene + debug hook + the store-shots hunks). T9 -> `economy.mjs` + README only (the store-shots hunks moved to T8b: they are tied to the C6 hook names).
2. **Waves (<= 3 units).** W1 T1, T2, T8a · W2 T3a, T3b, T6a · W3 T4, T5, T6b · W4 T7, T8b, T9 · gates between waves (below) · W5 AD1 · W6 T11 (conditional) -> T12 -> Director.
3. **WorldScene.** The plan counts 3 single-line behaviour hunks. A 4th single-line hunk, the import line after `import { FloatingText } ...` (`:14`), is unavoidable. To keep the 3 behaviour hunks single-line without a class field, `OutputTicker` keeps a `WeakMap<Phaser.Scene, OutputTicker>` and exposes `OutputTicker.of(scene)`; the update hunk is `OutputTicker.of(this)?.update(delta);` and the debug hook reads the same registry. WP24 never edits the import block (its only hunk is at `:454`). The Director tells WP24 at X0.
4. **T4 scope widened.** The plan lists `src/simulation`, `src/ui`, `src/persistence`. The T3 retune also reaches `src/data`, `src/game`, `src/audio` tests, so T4 owns EVERY test file that fails after W2, except the files owned by other tasks, the WP24-owned world files and the two read-only sims. T4 gets its work list from the G2 gate (`<O>/val/failing-after-w2.txt`).
5. **patch.json carries the description strings** (exact text per tech) and T1 also writes `base.json` + `verify-patch.ts`, so T3a / T3b apply data mechanically and the EM gate proves "data diff = patch.json" with one command.
6. **T7 also owns `src/data/hud.test.ts`** (the new HUD_TEXT strings are asserted there).
7. **D13 tables** in `WP25.md` and `WP24.md` were compared mechanically: byte-identical. Anchors re-checked at `6258d5a`: WorldScene `:163` / `:314` / `:465`.
8. **Servo cost is ME in era II** (`crankServo` costRes stays `me`): the era-II table tests change from "ME only on generator / motorRetrofit" to "... and crankServo".
9. **Validation list adapted:** step 7 of the plan (start :4175) is dropped (already served); only :4176 is started.

## Waves
| wave | units | depends |
|---|---|---|
| W1 | **T1** seed verification + finalization (Opus, scratch only) · **T2** greedy harness options · **T8a** OUTPUT_TICK data + `outputTick.ts` | - |
| G1 | EM: typecheck; `npx vitest run src/simulation/sim/greedy.test.ts src/game/math/outputTick.test.ts src/data/ux.test.ts --maxWorkers=2`; read `<O>/calib/status.txt` and `values.md` (STOP -> Director) | |
| W2 | **T3a** technologies retune · **T3b** prestige + SYS LOG · **T6a** `passiveFirst.sim.test.ts` | T3a, T3b: T1 · T6a: T1, T2 |
| G2 | EM (heavy, Director serializes): typecheck; the non-sim vitest run with the json reporter into `<O>/val/g2.json`, then `node "<O>/tools/failing.mjs" "<O>/val/g2.json"` redirected to `<O>/val/failing-after-w2.txt`; sims `passiveFirst`, `prestige`, `machineTiers`, `achievements`, `signoff` (tables equal `values.md`; the repo is the final truth, a harness-vs-repo difference -> Director); `verify-patch.cjs` rebuilt, all sections OK | |
| W3 | **T4** unit re-pins · **T5** servo era-II ripple + ASSET_GUIDE block · **T6b** balance / signoff / demoCap / worldLogs edits | T4, T5: T3a, T3b, G2 file · T6b: T1, T2 |
| G3 | EM: typecheck; full `npx vitest run --maxWorkers=2` (only HUD / T8b / T9 items may still be open); the 8 sim files (validation step 3); the A2 `git diff --stat` checks (validation step 5) | |
| W4 | **T7** HUD lines · **T8b** OutputTicker + wiring + hook + store-shots · **T9** `economy.mjs` + README | T7: T3a, T3b · T8b: T8a |
| G4 = T10 | EM gate: the validation list below (builds, previews, smokes). Quiet PC only; the Director serializes it with WP24's heavy runs | |
| W5 | **AD1** in-game audit (Opus Art Director, appends to `ART_AUDIT.md`) | G4 build |
| W6 | **T11** AD-listed fixes (conditional: data / CSS only) -> EM rebuild -> AD1 round 2 -> **T12** Opus review + EM Mode B -> Director (README, CHANGELOG, GAME_SPEC 18.4, STORY_BIBLE 5.4, PROJECT_STATUS, merge, commit) | |

### Allowed transient errors
End of every wave: `npm run typecheck` clean (W1-W4 add only optional fields, new files, data values and tests). Inside a wave a sibling's half-written file may error: re-run typecheck at the end of your task. Known TEST failures between waves: after W2 the tests that pin old numbers (technologies, ui, simulation, persistence, audio, game) fail until T3a's own re-pins and W3 (T4 / T5 / T6b) land; `passiveFirst.sim` and the old sims may fail inside W2 only because T3a / T3b are still editing data. After W3 only `hudView` / T8b / T9 items may be open.

## File ownership (exclusive per wave)
| Task | Files |
|---|---|
| T1 | `<O>/calib/**` only (no repo file) |
| T2 | `src/simulation/sim/greedy.ts`, `src/simulation/sim/greedy.test.ts` |
| T8a | `src/data/ux.ts` (tail), `src/data/ux.test.ts`, `src/game/math/outputTick.ts`, `src/game/math/outputTick.test.ts` |
| T3a | `src/data/technologies.ts`, `src/data/technologies.test.ts` |
| T3b | `src/data/prestige.ts`, `src/data/prestige.test.ts`, `src/data/systemLogs.ts`, `src/data/systemLogs.test.ts` (new) |
| T6a | `src/simulation/passiveFirst.sim.test.ts` (new) |
| T4 | every test file that fails after W2 and is not owned below / WP24 / read-only; plus comment-only `+90%` -> `+45%` in `src/ui/cycleConfirmView.ts`, `src/ui/menu/memoryView.ts`, `src/ui/notificationRules.ts` |
| T5 | `src/data/machineComponents.test.ts`, `src/data/machineTiers.test.ts`, `src/game/math/showcase.test.ts`, `src/game/math/teaser.test.ts`, `src/ui/menu/achievementsView.test.ts`, `src/audio/audioMath.test.ts`, `src/assets/assetGuide.test.ts` (only if failing), `src/assets/tierCoverage.test.ts` (only if failing), `docs/ASSET_GUIDE.md` (generated block only) |
| T6b | `src/simulation/balance.sim.test.ts`, `signoff.sim.test.ts`, `demoCap.sim.test.ts`, `worldLogs.sim.test.ts` |
| T7 | `src/data/hud.ts`, `src/data/hud.test.ts`, `src/ui/hudView.ts`, `src/ui/hudView.test.ts`, `src/ui/hud.ts` (row `title` only) |
| T8b | `src/game/rendering/OutputTicker.ts` (new), `src/game/scenes/WorldScene.ts` (4 single-line hunks), `src/game/debugHook.ts` (tail append + one import), `scripts/smoke/store-shots.mjs` (2 hunks) |
| T9 | `scripts/smoke/economy.mjs` (new), `scripts/smoke/README.md` (append `## Passive-first economy (WP25)`) |
| AD1 | `docs/plan/ART_AUDIT.md` (append `## WP25 — passive-first audit`), `<O>/ad/**` |

Forbidden for every worker: files outside the task list, non-test files in `src/simulation/production/**`, `src/simulation/progression/**`, `src/persistence/**`, `src/data/types.ts`, `src/data/balance.ts`, `package.json`, `package-lock.json`, `public/assets/**`, WP24-owned files (D13 table), the read-only sims `machineTiers.sim.test.ts` and `achievements.sim.test.ts`. Workers never build, never start servers, never run Playwright, run vitest only on their own files with `--maxWorkers=1`.

## Cross-task contracts (canonical)
```ts
// src/simulation/sim/greedy.ts (T2)
export interface IncomeSplit { manual: ResourceMap; passive: ResourceMap }
// GreedyOptions += clickRate?: (state: Readonly<GameState>, t: number) => number;  trackIncome?: boolean;
// GreedyResult  += income?: Record<EraNumber, IncomeSplit>;
export function manualShare(income: Record<EraNumber, IncomeSplit>, era: EraNumber, res: ResourceId): number;
// src/data/ux.ts (T8a)
export const OUTPUT_TICK = { periodMs: 3000, fadeMs: 1800, riseWorldPx: 36, alpha: 0.7, fontScale: 0.8, poolSize: 3,
  anchor: { 1: 'wornMotor', 2: 'generator', 3: 'boiler', 4: 'spireTower', 5: 'nullChamber' }, offset: { x: 0, y: -24 } };
// src/game/math/outputTick.ts (T8a)
export function stepOutputTick(accMs: number, dtMs: number, periodMs: number): { accMs: number; due: boolean };
export function outputTickLine(perSecond: Readonly<ResourceMap>, era: EraNumber, periodS: number): GainLine | null;
// src/game/rendering/OutputTicker.ts (T8b)
export class OutputTicker { static of(scene: Phaser.Scene): OutputTicker | undefined; constructor(scene, ports); update(dtMs); setEnabled(on); stats(): OutputTickerStats; destroy() }
// debug hook (T8b): outputStats(): { shown; visible; y: number | null; rising; last: string | null; meanMs } | null ; setOutputTicks(on: boolean): void
// src/data/hud.ts + src/ui/hudView.ts (T7)
// HUD_TEXT += { worthSep: ' · ', clickWorth: '{s}s', clickWorthTitle: 'One turn of the crank = {s} s of machine output', autoCrankOutput: '+{v} {res}/s' }
// HudClickLine += title: string | null ;  export function formatWorth(seconds: number): string
```
Calibration outputs (T1, `<O>/calib/`): `status.txt`, `values.md` (H2 headings fixed: 0 Status, 1 Reproduction, 2 Final variant, 3 Data diff, 4 Targets, 5 Era-I EXACT, 6 Demo windows, 7 Servo, 8 Log replay, 9 machineTiers, 10 Pins for the repo sims), `patch.json`, `base.json`, `verify-patch.ts` (bundle + run: `node verify-patch.cjs [TECHS|ECHO|PERKS|LOG]`).

## Gate G4 = T10 validation list (EM; one Bash call per line; `<N>` = 2 while the user is away)
1. `cd "C:/Users/sanan/wedtmd-art" && npm run typecheck` -> clean
2. `cd "C:/Users/sanan/wedtmd-art" && npx vitest run --maxWorkers=2` -> 0 failed; pass >= 4736 + new
3. `... npx vitest run src/simulation/passiveFirst.sim.test.ts src/simulation/signoff.sim.test.ts src/simulation/balance.sim.test.ts src/simulation/demoCap.sim.test.ts src/simulation/prestige.sim.test.ts src/simulation/machineTiers.sim.test.ts src/simulation/worldLogs.sim.test.ts src/simulation/achievements.sim.test.ts --maxWorkers=2` -> pass; printed tables equal `<O>/calib/values.md`
4. `... grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math/outputTick.ts` -> empty
5. `... git diff --stat 6258d5a -- src/simulation/production src/simulation/progression src/persistence src/data/types.ts src/data/balance.ts` -> only `*.test.ts`; `git diff --stat 6258d5a -- src/simulation/machineTiers.sim.test.ts src/simulation/achievements.sim.test.ts` -> empty; `verify-patch.cjs` (rebuilt first) -> every section OK
6. (quiet PC) `npm run build && node scripts/perf/bundle-budget.mjs` -> PASS; `npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo` -> PASS; CSS growth <= 0.2 KB, app <= 500 KB
7. Start only the demo preview on :4176 (see Fence); poll HTTP 200
8. `PW_PATH=<PW> node scripts/smoke/economy.mjs "http://localhost:4175/?debug=1" <O>/val/economy` -> `fail []`, `errors []` (`G_output_cost` included); same on :4176 (`<O>/val/economy-demo`)
9. Same pattern: `demo.mjs` (:4176), `ux.mjs`, `resolutions.mjs`, `tiers.mjs` (full + demo), `prestige.mjs`, `e2e-full.mjs`, `a11y.mjs`, `world.mjs` (`G_display`), `perf.mjs`, `stages.mjs` with `ONLY=s0_crank,s9_era2_full,s13_era4_full` -> `fail []`, `errors []`
10. `SIZES=1080 PW_PATH=<PW> node scripts/smoke/store-shots.mjs "http://localhost:4175/" <O>/val/store-1080` -> `fail []`, `errors []`; every `1080_<id>_<variant>_no_output_tick` check present and passing
11. Stop :4176 (netstat -> taskkill); netstat empty afterwards
12. EM LOOKS: `<O>/val/economy/economy-F-100.png`, `economy-F-150.png`, `economy-B-tab2.png`
13. `git status --porcelain` -> only task files (+ ` M package-lock.json`, never staged)
Fails go to the owning task as fix assignments (same format). A repo-vs-harness balance difference goes to the Director.

## AD1, T11, T12 (AD1 is a prompt; T11 / T12 are not decomposed here)
- AD1 (Opus Art Director, after G4): servo at levels 1 / 4 / 7 in era II framings s8 / s9 (the era-IV-made part next to the generator; an art finding follows D16 = follow-up, not a block); HUD CLICK / AUTO-CRANK lines at 1280x720 UI 100 / 150, 1920x1080, Deck 1280x800 UI 150; output popups in each era (placement against the crank gain block, denizen bubbles, HUD; legibility at zoom 0.5); reduced motion. Output: verdict + fix list `F<n>` (file, key, old -> new; data only) in ART_AUDIT.
- T11 (conditional): the AD list only; `OUTPUT_TICK` numbers, `HUD_TEXT`, `src/ui/hud.css` (<= +0.2 KB). EM rebuilds; AD1 round 2.
- T12: Opus `implementation-reviewer` on the combined diff (focus: data diff = `patch.json`, no formula drift, determinism, no Phaser in pure files), then EM Mode B (the G4 list). The Director then does README (line 76 `+30 %` -> `+15 %` per Echo, perk table, "Balance" deviations), CHANGELOG (Unreleased, Echo halving note), GAME_SPEC 18.4 note, STORY_BIBLE 5.4 note (23 SYS LOGs), PROJECT_STATUS, merge, commit, and asks the user Q1 ("R1 kept; say Surge to start WP25b").

## Out of scope
WP25b Surge, any save field or version, `rates.ts` / `tick.ts` formula changes, new tech ids or effect types, `maxLevel` changes on PART_TIERS tracks, art files, living-world code (WP24), new settings, GAME_SPEC section 6 edits, store shots / STEAM_RELEASE / CHANGELOG release entry / version bump, PROJECT_STATUS, merge, commit (Director).

## Flags for the Director
1. WorldScene gets 4 single-line hunks (the import line is the 4th) and `OutputTicker.of(scene)` replaces a class field (EM decision 3). No anchor clash with WP24; tell WP24 at X0.
2. T1 must be dispatched as an Opus agent (general-purpose agent with model opus), not as the Haiku `implementation-worker`.
3. Seed margins are thin (P1e 1.338 vs 1.35; B 45 s before N; demo C 85:31): T1 / G2 may need the D3 / D6 levers; the B / N order fallback needs the Director's call (plan).
4. T4 gets its list from G2; if G2 shows failing files owned by WP24 (world* tests) they are NOT edited here: the Director decides.
5. The ASSET_GUIDE block is regenerated by T5; WP24 regenerates it again at X0 (D13).

## Task summaries (full self-contained prompts are the `prompt` fields of the wave JSON)
- **T1 (W1, Opus)** reproduce D8 / V1 / V0 / S2n2 to the second, verify the seed table, final values, every target row, log replay, tiers5 claims; writes status / values / patch / base / verify-patch.
- **T2 (W1)** `clickRate`, `trackIncome`, `income`, `manualShare` in the greedy harness + tests.
- **T8a (W1)** `OUTPUT_TICK` + data test; pure `stepOutputTick` / `outputTickLine` + tests.
- **T3a (W2)** apply `patch.json` to `technologies.ts`; re-pin technologies tests; description-vs-effect guard (A4).
- **T3b (W2)** Echo bonus 15 %, PERKS description guard, `+45%` comments, `manual-optional` SYS LOG + new test.
- **T6a (W2)** `passiveFirst.sim.test.ts`: P1 / P0 / P2 / Q / P1e rows, manual shares, snapshots, servo pacing, P1 continuity, report tables.
- **T4 (W3)** unit re-pins from the G2 list; every changed expectation old -> new.
- **T5 (W3)** servo era-II ripple tests + regenerated ASSET_GUIDE block.
- **T6b (W3)** EXACT era-I re-pin, C <= 360 min row, demo windows N / C / P1d, worldLogs `manual-optional` checks.
- **T7 (W4)** HUD click worth + auto-crank output suffixes, `formatWorth`, row title.
- **T8b (W4)** OutputTicker renderer, WorldScene hunks, debug hook, store-shots `_no_output_tick`.
- **T9 (W4)** `economy.mjs` (cases A-G) + README section.
- **AD1 (W5)** in-game audit.
