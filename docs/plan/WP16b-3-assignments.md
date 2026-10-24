# WP16b-3 — Worker Assignments (Engineering Manager, Mode A)

Source: WP16b-3 plan (final release pass v0.9.0) + repo read at HEAD `3219580`.
Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/release-wp16`. Baseline: typecheck clean, 119 files / 3409 tests (16 skipped), build + build:demo OK, bundle PASS (full app 401.8/460 KB, css 39.9/44 KB; dist-demo app 403.7, css 42.6/44).
Fence: Director soak runs on the main repo folder + :4173. Never touch it, never build there, never kill node processes not started by the task. :4174 serves this worktree's `dist/` (rebuild only, never start/stop). Demo preview only on :4177, one runner at a time.
`<O>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP16b-3`. `<PW>` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`.
EM created scratch helper `<O>/tools/eol.mjs` (modes `crlf`, `lf`, `check`) so workers can restore line endings after edits.

## EM decisions / deviations from the plan (these WIN for workers)
1. **T11 split** into `T11a` (`docs/STEAM_RELEASE.md`) and `T11b` (`CHANGELOG.md`). Disjoint files, run in parallel in W6; each is exact-text editing but two files in one Haiku pass is error-prone.
2. **T2 acceptance grep fixed**: `grep -rl "setPlateCap" src/game` hits 5 files, not 4 (the 4 owned files + the T1 header comment in `src/game/math/plateCap.ts`).
3. **T2 edit style**: the four insert-a-method edits use a single-line anchor trick (replace the last statement line of the previous method with itself + `}` + new method without its closing brace; the original `}` closes the new method). Anchors verified unique at `3219580`.
4. **Line endings**: working tree is CRLF (index LF) except `CHANGELOG.md` (LF). Every prompt tells the worker to run `node <O>/tools/eol.mjs crlf|lf <file>` after editing and verify with `git ls-files --eol` + `git diff --stat`.
5. **T8 / T9 are templates** filled by the Director from the AD fix list (`{{X}}`, `{{Y}}`, `{{FILES}}`, `{{FIXES}}`). If the AD accepts N2, T8 is not spawned. T9 is spawned only for files named in the fix list; one instance per file; if the fix list touches more than 3 distinct files besides `steamFx`, group several small CSS files into one instance (W4 holds max 4 workers).
6. **T7 and T10 are `art-director` (Opus) tasks**, not Haiku workers. T6 (EM build gate) and T12 (reviewer + EM Mode B) are not workers; they are listed below and not in the wave JSON.
7. **Browser runners one at a time** (D10 and the Director's soak on the same box): EM runs store-shots, ux, a11y, ... sequentially.
8. Cap does not touch the `primaryFunction` plaque line (`PRIMARY FUNCTION: RESTORE`). Only reachable in postgame; the postgame HUD shot is press kit and the clean shot hides the HUD. Accepted.
9. **T6 triage rule for `_no_spoiler` failures**: `value.frame > 2` -> fix assignment to T2 (cap not applied). `value.hits` non-empty -> read the hit text. Real visible text (HUD row, toast, tree label) -> report to Director (shot joins `PRESS_KIT_ONLY` or the text is hidden: Director decides). Hit only in visually hidden text (aria live region, `clip` text; `innerText` still includes it) -> fix assignment to T3: scan only elements with a client rect and no clip (e.g. skip `[aria-live]` and `.sr-only`).

## Waves
| Wave | Ids | Gate after |
|---|---|---|
| 1 | **T1** plate cap helpers + tests, **T3** store-shots cap + spoiler checks, **T4** ux case M | none (tsc clean expected: T1 adds exports only; T3/T4 are `.mjs`) |
| 2 | **T2** wiring + debug hook (needs T1), **T5** smoke README (needs T3, T4) | **T6 EM gate** (below) |
| 3 | **T7** Art Director round 1 (agent `art-director`) | Director reads verdict + fix list |
| 4 | **T8** lance spawn (unless N2 accepted), **T9** AD CSS/script fixes (conditional, one per file) | EM rebuilds `npm run build` then `npm run build:demo` once, budgets |
| 5 | **T10** Art Director round 2 + final store shots (agent `art-director`) | Director reads verdict; not RELEASE-READY -> new fix list back to W4 |
| 6 | **T11a** STEAM_RELEASE, **T11b** CHANGELOG | none |
| 7 | `implementation-reviewer` (Opus) on the combined diff, then **T12** EM Mode B validation. Director: row 9 soak numbers, PROJECT_STATUS, commit (never `package-lock.json`) | |

### Transient tsc errors (inside a wave only)
| After | Allowed |
|---|---|
| W1 | none |
| W2 | none (T2 imports `plateFrameCap` / `cappedPlateFrame` from T1, already merged). A sibling's half-edited file mid-wave: ignore. |
| W4 | none (T8 changes a data value + its test together) |
| W6 | none (docs only) |

## File ownership (exclusive)
| Task | Files |
|---|---|
| T1 | `src/game/math/plateCap.ts`, `src/game/math/plateCap.test.ts` |
| T2 | `src/game/entities/MachineAnimator.ts`, `src/game/entities/MachineView.ts`, `src/game/scenes/WorldScene.ts`, `src/game/debugHook.ts` |
| T3 | `scripts/smoke/store-shots.mjs` |
| T4 | `scripts/smoke/ux.mjs` |
| T5 | `scripts/smoke/README.md` (three named regions only) |
| T7 | `docs/plan/ART_AUDIT.md` (append); optional AD-owned `public/assets/finale/horizon-glow.png` + `scripts/art/era5/bg.py` |
| T8 | `src/data/steamFx.ts`, `src/data/steamFx.test.ts` |
| T9 (cond.) | only the files named in the AD fix list, from: `src/ui/techTree.css`, `src/ui/toasts.css`, `src/ui/eraCard.css`, `src/ui/hud.css`, `src/ui/systemMenu.css`, `src/ui/photoMode.css`, `src/ui/finale.css`, `src/ui/demoEnd.css`, `src/ui/cycleConfirm.css`, `scripts/smoke/store-shots.mjs` (store order only) |
| T10 | `docs/plan/ART_AUDIT.md` (append round 2) |
| T11a | `docs/STEAM_RELEASE.md` |
| T11b | `CHANGELOG.md` |
Forbidden for all: `src/simulation/**`, `src/data/technologies.ts`, `src/persistence/**`, `package.json`, `package-lock.json`, `docs/PROJECT_STATUS.md`, `src/game/scenes/ShowcaseScene.ts`, `public/assets/**` and `scripts/art/**` (except the AD's optional repair), the main repo folder, :4173.

## Task summaries (full self-contained prompts are the `prompt` fields)
- **T1 (W1)**: `plateFrameCap` + `cappedPlateFrame` appended to `plateCap.ts`; +15 tests (6 + 7 `it.each` rows, prefix-equivalence test, plaque test). File goes 9 -> 24 tests. Accept: vitest on the file green, typecheck clean, no Phaser import.
- **T3 (W1)**: store-shots `PLATE_CAP` constants, `setCap` + `spoilerState` helpers, `_plate_cap` (x4) and `_no_spoiler` (x14) checks, `08-finale-reveal-clean` to pressKitOnly, `plateCap` in `store-top5.json`, header lines. Accept: `node --check`, 4 `setCap` call sites, usage exit 2.
- **T4 (W1)**: ux case M (`M_cycle_start`, `M_one_prompt_t0`, `M_one_prompt_goal`, shots `ux-M1-cycle-prompt`, `ux-M2-cycle-goal`), runs after the T cases, before `perf`.
- **T2 (W2)**: `plateMaxTech` + `setPlateCap` in `MachineAnimator` (stage case caps namePlate only), forward in `MachineView`, `plateCap` field + `setPlateCap` / `getPlateCap` + capped plaque in `WorldScene.renderHud`, hook fields `setPlateCap` / `plateCap`. Null cap = unchanged behaviour. Accept: typecheck, `npx vitest run src/game src/ui`, `ShowcaseScene.ts` untouched.
- **T5 (W2)**: smoke README: UX smoke case M row + shots, WP18 hook bullets, `### store-shots.mjs` rewrite (19 PNGs, 11 stems in run order, plate-cap column, all check names, `store-top5.json` shape).
- **T6 (EM gate, after W2)**: typecheck, `npm test` (119 files / 3424 tests / 16 skipped), `npm run build` + budget (css <= 40.2 KB), `npm run build:demo` + budget (css <= 42.9 KB), then store-shots `SIZES=1080` -> `<O>/w2/store-1080` and ux -> `<O>/w2/ux` (one at a time). Both `fail []`, `errors []`. EM Reads `<O>/w2/store-1080/1080/07-era5-ruined-clean.png` and `06-era4-spire-hud.png`: plate/plaque not RESTORE.
- **T7 (W3, AD)**: capture matrix K1-K7 (140 full + 16 demo PNGs), gates G1-G8, D7 triage of 10 notes, store order, verdict + fix list appended to ART_AUDIT.
- **T8 (W4)**: lance `at` value + comment + test expectation only.
- **T9 (W4, cond.)**: AD fix entries applied exactly, palette vars only, css delta <= +300 B raw.
- **T10 (W5, AD)**: verify each F#, final store shots both sizes (C7 numbers), crops, round-2 verdict.
- **T11a (W6)**: STEAM_RELEASE section 15 rows + GPU numbers subsection, section 10 spoiler note + never-upload line (+ rank table only if AD changed order).
- **T11b (W6)**: CHANGELOG 0.9.0 bullet renames (WP16b-1/-2), new WP16b-3 bullets, Verification replaced by three bullets.

## T6 EM gate (after W2; one Bash call per line)
1. `cd "C:/Users/sanan/wedtmd-shell" && npm run typecheck`
2. `cd "C:/Users/sanan/wedtmd-shell" && npx vitest run src/game/math/plateCap.test.ts` -> 24 tests
3. `cd "C:/Users/sanan/wedtmd-shell" && npm test` -> 119 files, 3424 tests, 16 skipped, 0 failed
4. `cd "C:/Users/sanan/wedtmd-shell" && npm run build && node scripts/perf/bundle-budget.mjs` -> PASS, css <= 40.2 KB, app <= 460 KB
5. `cd "C:/Users/sanan/wedtmd-shell" && npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo` -> PASS, css <= 42.9 KB
6. `mkdir -p "<O>/w2" && cd "C:/Users/sanan/wedtmd-shell" && SIZES=1080 PW_PATH="<PW>" node scripts/smoke/store-shots.mjs "http://localhost:4174/" "<O>/w2/store-1080"` (run_in_background; takes minutes) -> `fail []`, `errors []`; `results['1080_01_plate_cap']`, `_10_`, `_09_` = `{ ok: true, value: 'substationBlueprint' }`, `1080_08_plate_cap` value null, 14 `1080_*_no_spoiler` ok, `store-top5.json` has `plateCap`, pressKitOnly lists `08-finale-reveal-clean`.
7. `cd "C:/Users/sanan/wedtmd-shell" && PW_PATH="<PW>" node scripts/smoke/ux.mjs "http://localhost:4174/?debug=1" "<O>/w2/ux"` -> `fail []`, `errors []`, `M_cycle_start`, `M_one_prompt_t0`, `M_one_prompt_goal` not in fail; PNGs `ux-M1-cycle-prompt.png`, `ux-M2-cycle-goal.png`. A game-side M fail (prompts stack) is not fixed in the smoke: Director decides.
8. EM Reads the two store PNGs. Any fail -> fix assignment to the owning task (T2 / T3 / T4) before W3.

## T12 EM Mode B validation (after W6; `PW` = `C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright`, `O` as above)
1. `cd "C:/Users/sanan/wedtmd-shell" && npm run typecheck`
2. `cd "C:/Users/sanan/wedtmd-shell" && npx vitest run src/game/math/plateCap.test.ts src/data/steamFx.test.ts`
3. `cd "C:/Users/sanan/wedtmd-shell" && npm test` -> 119 files, 3409 + 15 tests, 0 failed
4. `cd "C:/Users/sanan/wedtmd-shell" && npm run build && node scripts/perf/bundle-budget.mjs` -> PASS, css <= 40.2 KB
5. `cd "C:/Users/sanan/wedtmd-shell" && npm run build:demo && node scripts/perf/bundle-budget.mjs dist-demo` -> PASS, css <= 42.9 KB
6. `cd "C:/Users/sanan/wedtmd-shell" && node scripts/smoke/lib/a11y-audit.mjs --selftest && node scripts/smoke/lib/common.mjs --selftest`
7. a11y vs `http://localhost:4174/` (outdir `<O>/val/a11y`) -> `fail []`, `errors []`, `deferred []`
8. ux vs `http://localhost:4174/?debug=1` (`<O>/val/ux`) -> `fail []`, `errors []`, `M_*` true
9. resolutions.mjs vs `?debug=1` (`<O>/val/res`) -> `fail []`, `errors []`
10. e2e-full.mjs vs base (`<O>/val/e2e`) -> `fail []`, `errors []`
11. wp3-techtree.mjs (`<O>/val/wp3`) and wp2-crank.mjs (`<O>/val/wp2`) vs `?debug=1` -> `errors []`, `failed []`
12. showcase.mjs vs `?debug=1` (`<O>/val/showcase`) -> exit 0, `errors []`
13. `SIZES=1080` store-shots (`<O>/val/store-1080`) -> `fail []`, `errors []`, 14 `_no_spoiler` + 4 `_plate_cap` ok
14. python Pillow crop of `<O>/val/store-1080/1080/07-era5-ruined-clean.png` box (1000, 815, 1110, 860) x8 NEAREST -> EM Reads: plate reads `RES?OR?`
15. Demo: netstat :4177 empty; background `npx vite preview --outDir dist-demo --port 4177 --strictPort`; poll 200; `demo.mjs "http://localhost:4177/" "<O>/val/demo"` -> `fail []`, `errors []`; stop (netstat + taskkill the node child), netstat :4177 empty again
16. `node -e "const m=require('<O>/store-final/store-top5.json');console.log(m.sizes,m.plateCap,m.missing,m.store.map(s=>s.name),m.alt.map(a=>a.name))"` -> `['1080','2160'] substationBlueprint []` + AD order; `ls "<O>/store-final/1080" | wc -l` = 19, same for 2160
17. EM Reads: `<O>/store-final/crops/07-plate-1080.png`, `07-plate-2160.png`, `06-plaque-1080.png`, `<O>/ad1/cap/full-1280x800-100-tree-e5.png`, `full-1280x800-150-tree-e5.png`, `full-1280x800-150-tree-e3.png`, `<O>/val/ux/ux-M1-cycle-prompt.png`, `ux-M2-cycle-goal.png`
18. `cd "C:/Users/sanan/wedtmd-shell" && grep -c "PENDING WP16b-3" docs/STEAM_RELEASE.md && grep -n "^| 1[01] |" docs/STEAM_RELEASE.md && grep -c "WP16b-3" CHANGELOG.md && grep -c "^## WP16b-3 — final release audit" docs/plan/ART_AUDIT.md` -> `1`, rows 10/11 PASS, >= 3, `1`
19. `cd "C:/Users/sanan/wedtmd-shell" && grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils` -> empty
20. `cd "C:/Users/sanan/wedtmd-shell" && git diff --stat src/game/scenes/ShowcaseScene.ts src/data/technologies.ts package.json` -> empty; `git status --porcelain` -> only T1-T11 files (+ ` M package-lock.json`, never staged)
Also: STEAM_RELEASE sections 1-9 and 11-14 byte-identical (`git diff -U0 docs/STEAM_RELEASE.md | grep '^@@'` hunks only in section 10 and 15).

## Out of scope
Soak run and row 9 numbers (Director); GPU perf runs (done); PROJECT_STATUS, commit, push (Director); tree layout redesign (N2, D8); notification / toast logic (N5); balance, rates, schema, `package.json`, deps; ShowcaseScene / demo teaser behaviour; committed audit-capture scripts (AD scratch only); README.md / GAME_SPEC.md edits; desktop packaging (`build:steam*`, desktop smoke), Steam upload, VDF, Steamworks SDK; any PNG change other than the AD's optional horizon-glow repair.
