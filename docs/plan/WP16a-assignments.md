# WP16a — Worker Assignments (Engineering Manager, Mode A)

Source: WP16a plan (WP16 part A, slimmed by `docs/plan/STEAM_DEMO_PROGRAM.md` D8; program decisions WIN) + repo read at HEAD `66fa021`.
Worktree `C:/Users/sanan/wedtmd-shell`, branch `claude/release-wp16`. Baseline: typecheck clean, 108 files / 3155 tests, build OK, bundle PASS (app 396,165 B raw <= 460 KB, css 38,416 B <= 40 KB, headroom ~1.5 KB).
Already done, do not redo: fullRun.e2e, signoff.sim, debug gate (`src/utils/debugFlag.ts`), version v0.9.0. WP21 runs in `C:/Users/sanan/wedtmd-art` (never touch). WP16b follows WP21.

> EM INCIDENT NOTE (delete before commit): during planning the EM ran a glob loop in the wrong cwd (main repo `C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo`): it dropped the last byte of 8 root files and left 13 stray untracked files. Repaired the same minute (last `\n` restored, strays removed). Verified: main repo `git status --porcelain` empty, `git diff --stat` empty. wedtmd-shell untouched (only pre-existing ` M package-lock.json`). Common preamble now forces `cd` into the worktree on every Bash call.

## EM decisions / deviations from the plan (these WIN for workers)
1. **Plan T4 (a11y CSS) is merged into T2** (both tiny, disjoint files). Task id `T2+T4`.
2. **Plan T6 (a11y smoke) is split** (> 300 lines of new logic): `T6a` = `scripts/smoke/lib/a11y-audit.mjs` (contrast/name/size audit, tab walk, focus log, rect helpers; no dependency on common.mjs, so it runs in W1) and `T6b` = `scripts/smoke/a11y.mjs` (cases A-G, W2). Plan check names and cases are unchanged.
3. **Fixtures are staged byte-exact** at `<O>/fixtures-src/` (sha256 in the T1 prompt). T1 copies them with `cp` and verifies hashes; it never retypes them. Director may also pre-copy them into `src/persistence/fixtures/` before spawning T1 (T1 step 1 is idempotent).
4. **No `npm run build` in W1/W2 by workers** (D5). EM builds once between W1 and W2. T10 (conditional, W3) builds once itself because T9 uses no preview.
5. Extra optional `CompatRow` fields allowed in T1: `cycles`, `noAchievements`, `absentLevels` (for the `stats.cycles`, `achievements.unlocked {}` and `no key quantumFoo` expectations of the plan table).
6. `auditScope` returns `{ rootCount, checked, unnamed, small, contrast, deferred, inactive, indeterminate }`; a check with `rootCount === 0` fails (no vacuous passes).
7. Working-tree files are CRLF (git autocrlf=true, index LF). Workers use single-line Edit anchors; new files LF. `docs/ASSET_GUIDE.md` may be rewritten whole with LF.
8. Staging-only paths: `<O>` = `C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad/WP16a`.

## Waves
| Wave | Ids | Gate |
|---|---|---|
| 1 | **T1** save compat matrix, **T2+T4** smoke lib + a11y CSS fixes, **T3** ASSET_GUIDE guard + refresh, **T6a** a11y audit lib | baseline green |
| gate | EM/Director: typecheck, both new vitest files, both lib selftests, `npm run build`, `node scripts/perf/bundle-budget.mjs` (css delta <= +200 B) | W1 merged |
| 2 | **T5** e2e-full, **T6b** a11y.mjs, **T7** soak, **T8** store-shots (smokes only, NO builds, all against :4174) | gate PASS |
| gate | Director reads T6b report: non-deferred fail beyond FX1/FX2 -> spawn T10 | W2 done |
| 3 | **T9** smoke README, **T10** a11y follow-ups (CONDITIONAL; builds once + reruns a11y/ux/resolutions/shell if it ran) | W2 done |
| 4 | EM Mode B validation (below), EM opens store PNGs, Director commits (never `package-lock.json`) | W3 done |

### Transient tsc errors (inside a wave only)
| After | Allowed |
|---|---|
| W1 | none expected (all W1 tasks touch disjoint new files; CSS has no TS effect). A worker may see errors in a sibling's file mid-edit: ignore. |
| W2 | none (only .mjs files) |
| W3 | none |

## File ownership (exclusive)
| Task | Files |
|---|---|
| T1 | `src/persistence/fixtures/{v2-wp8-era2,v2-wp13-postgame,v2-pre-legacy,v2-current-full,v2-out-of-range,v3-future}.json`, `corrupt-save.txt`, `src/persistence/compat.test.ts` |
| T2+T4 | `scripts/smoke/lib/common.mjs`, `src/ui/systemMenu.css` |
| T3 | `src/assets/assetGuide.test.ts`, `docs/ASSET_GUIDE.md` |
| T6a | `scripts/smoke/lib/a11y-audit.mjs` |
| T5 | `scripts/smoke/e2e-full.mjs` |
| T6b | `scripts/smoke/a11y.mjs` |
| T7 | `scripts/smoke/soak.mjs` |
| T8 | `scripts/smoke/store-shots.mjs` |
| T9 | `scripts/smoke/README.md` (append only) |
| T10 (cond.) | `src/ui/*.css`, `src/ui/menu/*.css`, aria-only hunks in `src/ui/*.ts` / `src/ui/menu/*.ts` (never `toasts*`, `eraCard*`, `techTree*`) |
Forbidden for all: `src/simulation/**` (except new test files), `src/game/**`, `src/data/**`, non-test `src/persistence/*.ts`, `src/ui/toasts*`, `src/ui/eraCard*`, `src/ui/techTree*`, `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, `docs/GAME_SPEC.md`, existing fixtures, existing smokes.

## Task summaries (full self-contained prompts are the `prompt` fields; they carry contracts C1-C8 verbatim)
### T1 Save compat matrix (W1)
Copy 7 staged fixtures (sha256-verified); write `compat.test.ts`: `describe.each(ROWS)` over 10 files, 8 `it`s (codec fields, invariants, idempotent re-save + lossless, session boot, export->import, host `pickStorage` + flush, new cycle, legacy feeds). Accept: `npx vitest run src/persistence/compat.test.ts` green (>= 64 tests), `npx vitest run src/persistence` green, typecheck clean for own files.

### T2+T4 Smoke lib + a11y CSS (W1)
`scripts/smoke/lib/common.mjs` exactly per C2 (lists byte-identical to `stages.mjs` items/order, selftest without PW_PATH, no import side effects). `systemMenu.css`: FX1 (`--steam:#e8e0cc;` after `--haze`; `.sys-tab.is-active` color `var(--steam)`) and FX2 (`#ui-root[data-reduced-motion="on"] #sys-reset.is-armed { animation: none; }` after the media block). Css delta <= +200 B. No build.

### T3 ASSET_GUIDE guard (W1)
`src/assets/assetGuide.test.ts` per C7 (5 checking `it`s + 1 env-gated writer) and `docs/ASSET_GUIDE.md` tables regenerated for all 117 ids between `<!-- asset-table:start/end -->`, prose refresh. Accept: test green; removing a row makes it fail (shown once, reverted).

### T6a a11y audit lib (W1)
`lib/a11y-audit.mjs`: `DEFERRED_SCOPES`, pure colour maths, `auditScope`, `tabWalk`, `installFocusLog`/`resetFocusLog`/`missingFocus`, `focusId`, `setUiScale`, `rectInViewport`; `--selftest` for the maths; browser sanity run against the live preview (scratch script).

### T5 e2e (W2)
`e2e-full.mjs` per C3 (12 steps, ~45 check names). Accept: run vs :4174 -> `fail: []`, `errors: []`, >= 12 PNGs, wallMs <= 300000.

### T6b a11y (W2)
`a11y.mjs` per C4 (cases A-G). Accept: `fail: []`, `errors: []` after the W1 build; `deferred` = exactly WP21-owned items; any other finding is reported (not weakened, not fixed) for T10.

### T7 soak (W2)
`soak.mjs` per C5. Accept: `SOAK_MIN=5` run -> `fail: []`, `errors: []`, >= 9 samples, baseline tSec >= 60; `SOAK_MIN=1` exits 2.

### T8 store shots (W2)
`store-shots.mjs` per C6. Accept: `SIZES=1080` and `SIZES=2160` runs -> 18 PNGs each at exact sizes, `fail: []`, `errors: []`; worker views 01 hud, 07 clean, 09 clean.

### T9 smoke README (W3)
Append `## Release verification smokes (WP16a)` to `scripts/smoke/README.md`: lib, e2e-full, a11y, soak, store-shots; every check-name template of each script appears; deferred semantics (D6), store table, soak limits table.

### T10 a11y follow-ups (W3, CONDITIONAL)
CSS/aria only, palette colours only, total css delta (T2+T4 + T10) <= +600 B raw; rebuild once; rerun a11y, ux, resolutions, shell.

## Mode B validation (W4, EM) — each line is one Bash call, `O` inlined
1. `cd C:/Users/sanan/wedtmd-shell && npm run typecheck`
2. `... npx vitest run src/persistence/compat.test.ts src/assets/assetGuide.test.ts`
3. `... npm test` -> >= 110 files, >= 3215 tests, 0 failed
4. `... npm run build && node scripts/perf/bundle-budget.mjs` -> PASS (css <= 40 KB, app <= 460 KB)
5. `... node scripts/smoke/lib/common.mjs --selftest` and `node scripts/smoke/lib/a11y-audit.mjs --selftest`
6. `PW_PATH=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright node scripts/smoke/e2e-full.mjs http://localhost:4174/ <O>/e2e`
7. `... a11y.mjs http://localhost:4174/ <O>/a11y`
8. `... SOAK_MIN=5 node scripts/smoke/soak.mjs http://localhost:4174/ <O>/soak` (timeout 600000)
9. `... SIZES=1080 node scripts/smoke/store-shots.mjs ...` and `SIZES=2160` (timeout 600000 each); EM opens all 18 `1080` PNGs and >= 3 `2160` PNGs with Read.
10. Regression (mkdir -p each outdir): `wp2-crank.mjs http://localhost:4174/?debug=1`, `ux.mjs ?debug=1`, `shell.mjs http://localhost:4174/`, `resolutions.mjs ?debug=1` -> `errors: []` / `fail: []`.
11. `grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils` -> empty
12. `git status --porcelain` -> only owned files + pre-existing ` M package-lock.json` (never stage it).
Also check: fixtures sha256 vs prompt, `git diff --numstat src/ui/systemMenu.css` small, no file outside ownership touched, deferred list in `a11y.json` contains only `#tech-overlay` / `#toast-stack` / `#era-card` items.

## Deferred to WP16b (WP21-owned files)
Tech tree focus trap (`techTree.ts`), milestone node text contrast and purchased node level/cost contrast (`techTree.css`), any toast / era-card items T6b lists under `deferred`. Also: Art Director audit, GPU perf re-check, demo e2e, 30-60 min soak, README/CHANGELOG/STEAM_RELEASE/GAME_SPEC section 18, PROJECT_STATUS final.

---

# Common preamble (paste before every assignment)

(See the `preamble` field; identical text. Defines `<R>` = `C:/Users/sanan/wedtmd-shell`, `<O>` = scratchpad `WP16a` dir, `<PW>` = Playwright path.)
