# WP16 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP16.md` (D1-D7, T1-T9) + repo at HEAD `ded5c66`. Template: `WP15-assignments.md`.
Release 1.0: no new content/mechanics/art/music. Save stays **v2**. Era I-V balance bit-identical unless a T3 sign-off row fails.
Baseline: Director records `npx vitest run 2>&1 | grep -E "Test Files|Tests "` at WP15 final HEAD; never lower it.

## GATE (hard)
W1 starts ONLY after WP15 review fixes (src/audio, src/ui) are committed and typecheck + tests are green. Workers re-read files right before editing; keep edits additive.

## EM decisions (WIN over WP16.md)
1. `.gitignore` already has `__pycache__/`. T4 only runs `git rm -r --cached scripts/art/__pycache__` if tracked (`git ls-files scripts/art | grep pycache`) and deletes the dir. No commits.
2. Smokes take URL from `argv`. `withDebug(url)` is applied INSIDE each smoke right after argv parse (callers may pass a plain URL). Idempotent: keeps path/query/hash, sets `debug=1` if absent. Scripts that `page.reload()`/`goto(url)` keep working.
3. `full-machine.mjs` also uses `__wedtmd` — update (T4). `ftalpha.mjs` deleted. `perf.mjs` also gets `withDebug` (T4).
4. `debugEnabled(search, dev)` is pure. `bootstrap.ts` calls `debugEnabled(window.location.search, import.meta.env.DEV)` and wraps ONLY the `installDebugHook(...)` call (~line 283).
5. Footer text from pure helper `versionFooter(): string` = `v${APP_VERSION} · SAVE v${SAVE_VERSION}` (T5 decides module, see T5). UI only renders it.
6. T3 tables printed via `console.info` in the test file only (src may not print).
7. T8 (Art Director) is run by the Director; fix rounds come back as EM assignments in W3.
8. README ownership: `scripts/smoke/README.md` T4 (W1) -> T6 (W2, adds e2e-full section AND a11y section from T7 NOTES text the Director passes) -> read-only. T7 does NOT edit README.

## File ownership map (exclusive per wave)
| File | W1 | W2 | W3 |
|---|---|---|---|
| `scripts/smoke/*.mjs` existing, `scripts/smoke/lib/common.mjs`, bootstrap.ts, debugHook.ts (comment) | T4 | - | - |
| `package.json`, `src/data/{version,systemMenu}.ts`, `src/ui/systemMenu{,Model}.ts`, `systemMenu.css` | T5 | T7 (aria/css only) | - |
| `src/simulation/sim/greedy*`, `signoff.sim.test.ts` (+ `src/data/*` tune only if row fails) | T3 | - | - |
| `scripts/smoke/e2e-full.mjs`, `scripts/smoke/README.md` | - | T6 | - |
| `scripts/smoke/a11y.mjs`, `src/ui/**` css + aria | - | T7 | fix workers |
| `docs/ASSET_GUIDE.md`, `assetGuide.test.ts` | - | T9b | re-check |
| `README.md`, `CHANGELOG.md`, `docs/GAME_SPEC.md` §18 | - | - | T9a |

## Waves
| Wave | Ids | Gate |
|---|---|---|
| 1 | **T1**, **T3**, **T4**, **T5** | WP15 committed, tests green |
| 2 | **T2**, **T6**, **T7**, **T9b** | W1 merged, typecheck clean, T3 green (else tune, re-run T1) |
| 3 | **T8** (Director: art-director) + fix workers, **T9a** | W2 merged, T6 screenshots exist |
| 4 | EM Mode B + release checklist; Director T9c, commit, push, tag `v1.0.0` | W3 merged |

Transient tsc errors: none expected (W1 new files + additive optional fields; W2 T7 aria edits must not break view tests).

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP16: release 1.0. Verification, gating, docs, cleanup, fixes found by checks. NO new content, mechanics, art direction, music.
Authoritative spec you MUST read first: docs/plan/WP16.md (your task + D decisions). docs/plan/WP16-assignments.md ("EM decisions") WINS where different.
Save stays version 2. NEVER touch public/**. Era I-V balance: no change.
Baseline: typecheck clean, all tests green (count recorded by Director; never lower it).

RULES
- Create/modify ONLY files in your `files_owned`. Need another file changed? STOP, report blocker.
  Never edit package.json (unless owned), tsconfig.json, vite.config.ts, index.html, docs/** (unless owned), public/**, src/data/technologies.ts, src/simulation/production/**, src/simulation/progression/**.
- CONCURRENCY: other workers edit other files at the same time. Re-read every file RIGHT BEFORE editing. SURGICAL edits (small unique anchors; never rewrite an existing file from memory). Never revert a foreign change.
- PURE (no 'phaser', no window/document/AudioContext/localStorage): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**, src/audio/audioMath.ts, src/audio/musicMath.ts, src/ui/*View.ts, *Rules.ts, *Model.ts.
  Only src/game/{entities,rendering,scenes} may import Phaser. DOM files (src/ui/*.ts without View/Rules/Model suffix) may use document/window, never Phaser.
- Numbers, texts, ids live in src/data/. No 0x...... colour literals under src/game, src/ui, src/audio. No tech-id literals in src/audio or src/game logic.
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined in src.
- DOM text via textContent. Controls are real <button>; min font 12 px; focus-visible outline.
- Tests: Vitest node env (no DOM/Phaser/AudioContext), `*.test.ts` next to code, `toBeCloseTo(x, 9)` for floats, avoid -0. Never delete coverage.
- Smokes: Playwright via `PW_PATH` (copy header from scripts/smoke/finale.mjs); outputs /tmp/smoke; scratch scripts in the scratchpad dir NOT the repo.
- `npx tsc --noEmit` may show errors in files you do not own: ignore, list in NOTES.
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...
```

---

# WAVE 1 (parallel: T1, T3, T4, T5)

## T1 — Pure full-run e2e test
**wave** 1. **files_owned**: new `src/simulation/fullRun.e2e.test.ts`.
**objective**: WP16 T1 exactly.
**context**: read `GameSession.ts` public API, `GameSession.ending.test.ts`, `prestige.sim.test.ts`, `sim/greedy.ts` (picker style), `balance.sim.test.ts`. Public API only: injected `nowMs`, `click()`, `purchase(id)`, `update()`, `finishEndingSequence()`, `keepRunning()`, `beginNewCycle()`, `buyPerk('muscleMemory')`, `getAllTechViews()`. Picker: 4 clicks/s, 10 s steps, buy cheapest affordable. Codec round-trips via `src/persistence/codec.ts` (check real names). `DESIGN_MAX_VALUE` from data. Prefer data lookups over tech-id literals (test files may use ids WP16 names: `generatorBlueprint`, `gearRatio`, `muscleMemory`).
**constraints**: deterministic (no Date/Math.random); wall time <= 6 s; no src edits.
**acceptance**: every WP16 T1 bullet (path K <= 330 sim-min + ending phases + 1 h postgame; codec lossless at postgame and cycle 2 start; cycle-2 invariants; path N; finite < DESIGN_MAX_VALUE each step).
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/fullRun.e2e.test.ts
npx tsc --noEmit 2>&1 | grep -E "fullRun" && echo CHECK || echo OK
```

## T3 — Balance sign-off + profile D
**wave** 1. **files_owned**: `src/simulation/sim/greedy.ts`, `src/simulation/sim/greedy.test.ts`, new `src/simulation/signoff.sim.test.ts`; `src/data/*` ONLY if a row fails (STOP and report row + proposed number first).
**objective**: WP16 T3 exactly.
**context**: add `GreedyOptions.schedule?: { activeSeconds: number; offlineSeconds: number }` (additive). Offline block: no clicks/buys, production via the existing offline path (read how GameSession applies the cap: 8 h, 12 h after reliefValves, +4 h Long Silence). `firstAt` counts ACTIVE seconds; result gains `wallSeconds` ONLY when schedule set (absent -> result object bit-identical). Profile D = C (1 cps, 30 s buys) + schedule 2 h / 8 h. Signoff test asserts the WP16 T3 table and prints one markdown table per block via `console.info`. Greedy tests: absent = identical; 0 offline = identical; offline block grants exactly the capped gain.
**constraints**: existing sims unchanged and green; signoff wall time <= 10 s; no data change if all rows pass.
**acceptance**: greedy + signoff green; paste printed tables in NOTES.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation
npx tsc --noEmit 2>&1 | grep -E "^src/simulation" && echo CHECK || echo OK
git diff --stat HEAD -- src/data public     # empty unless a row failed
```

## T4 — Debug gating + cleanup
**wave** 1. **files_owned**: new `src/utils/debugFlag.ts` + `debugFlag.test.ts`, `src/game/bootstrap.ts` (gate only), `src/game/debugHook.ts` (header comment only), `scripts/smoke/*.mjs` that reference `__wedtmd` (finale, perf, prestige, stages, wp12-menus, wp2-crank, wp3-techtree, wp4-persistence, full-machine), new `scripts/smoke/lib/common.mjs`, delete `scripts/smoke/ftalpha.mjs`, `scripts/smoke/README.md`, `scripts/art/__pycache__` (EM decision 1). Non-test `src/**` files ONLY to remove TODO/console.log/unused symbols found by scans.
**objective**: WP16 T4 + EM decisions 1-4.
**context**: signatures (exact):
```ts
// src/utils/debugFlag.ts (pure)
export function debugEnabled(search: string, dev: boolean): boolean;
// dev -> true; else URLSearchParams(search) (leading '?' optional): `debug` present, value not '0'/'false' -> true; `debug=0`/`false` or absent -> false.
```
```js
// scripts/smoke/lib/common.mjs (ESM, no deps)
export function withDebug(url)              // idempotent
export const S7, S9, S10, S11, S12, S13, S14, S15   // verbatim from scripts/smoke/finale.mjs lines 14-21
export async function buyList(page, list)   // -> boolean[]; '@id' jump logic copied from finale.mjs
export function collectErrors(page)         // console error / pageerror / requestfailed / response>=400 -> { errors: string[], warnings: string[] } (live arrays)
```
Each smoke: `const url = withDebug(<argv url>)`; result keys unchanged; existing scripts may keep inline buy lists. Scans to list in hand-off: `grep -rn "TODO\|FIXME\|XXX\|console.log" src --include=*.ts | grep -v test` (must be empty); `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` (list hits; remove or justify; no tsconfig change); scratch (scratchpad dir, not committed) scan for exports with zero importers — remove if unused by src/tests/smokes. README: `?debug=1` note, `lib/common.mjs`, drop ftalpha.
**constraints**: prod behaviour otherwise identical; DEV keeps hook; no feature change.
**acceptance**: debugEnabled table test (`''`->false, `?debug`->true, `?debug=1`->true, `?debug=0`->false, `?x=1&debug`->true, dev+`''`->true, `debug=false`->false); build green; preview (port 4173) without `?debug`: `window.__wedtmd === undefined`, canvas present, 0 console errors; with `?debug=1` `wp2-crank`, `stages`, `wp4-persistence` -> `errors: []`; `node --check` all .mjs; grep scan empty.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/utils
npx tsc --noEmit
for f in scripts/smoke/*.mjs scripts/smoke/lib/*.mjs; do node --check $f || echo BAD $f; done
npm run build
grep -rn "TODO\|FIXME\|XXX\|console.log" src --include=*.ts | grep -v test
grep -rn "from 'phaser'" src/utils src/data src/simulation src/persistence
test ! -e scripts/smoke/ftalpha.mjs && test ! -e scripts/art/__pycache__ && echo GONE
```

## T5 — Version string + verify script
**wave** 1. **files_owned**: new `src/data/version.ts` + `version.test.ts`, `package.json`, `src/data/systemMenu.ts`, `src/ui/systemMenu.ts`, `src/ui/systemMenuModel.ts` (+ test), `src/ui/systemMenu.css`.
**objective**: WP16 T5 + EM decision 5.
**context**: `export const APP_VERSION = '1.0.0'`. `SAVE_VERSION` lives in `src/persistence/schema.ts`; keep `src/data` free of persistence imports: if that import is a layer/cycle problem put pure `versionFooter()` in `src/ui/systemMenuModel.ts`, else in `src/data/systemMenu.ts`; say which. SYSTEM tab footer: text `v1.0.0 · SAVE v2`, `aria-label="Version 1.0.0"`, CSS font-size >= 12 px, textContent. package.json: `"version": "1.0.0"`, script `"verify": "npm run typecheck && npm test && npm run build && node scripts/perf/bundle-budget.mjs"`. Version test reads package.json (via `fs` + JSON.parse; no tsconfig change).
**constraints**: leave `perf:bundle`; keep 6 tabs; no other UI change.
**acceptance**: `APP_VERSION === pkg.version === '1.0.0'`; footer helper output test uses imported `SAVE_VERSION`; systemMenu tests green; `npm run verify` exits 0 (run it).
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/(data|ui)" && echo CHECK || echo OK
npm run verify
git diff HEAD -- package.json
```

---

# WAVE 2 (parallel: T2, T6, T7, T9b)

## T2 — Save compatibility matrix
**wave** 2. **files_owned**: new `src/persistence/fixtures/{v2-wp8-era2,v2-wp13-postgame,v2-wp15-current,v3-future}.json`, new `src/persistence/compat.test.ts`. Existing fixtures READ-ONLY.
**objective**: WP16 T2 table exactly (7 rows).
**context**: author shapes per table; find historical field sets via `git log -p -- src/data/types.ts src/persistence/schema.ts`. Read `persistence.test.ts`, `startup.ts`, `codec.ts`, `saveManager.ts`, existing fixtures. One `describe.each`: status per table; boots via startup path into `GameSession` without throw; rates finite; re-save idempotent; export string -> import equals; every `techLevels` key in `TECHNOLOGIES`. `v2-wp15-current` byte-stable re-save. `v3-future`: refused ("newer version"), raw backup kept, fresh state boots.
**constraints**: no src change; real bug found -> STOP, report repro.
**acceptance**: all rows green; existing persistence tests untouched and green.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence
npx tsc --noEmit 2>&1 | grep -E "^src/persistence" && echo CHECK || echo OK
git diff --stat HEAD -- src/persistence/fixtures/v1-save.json src/persistence/fixtures/v2-wp11-primary.json src/persistence/fixtures/v2-cycle2.json   # empty
```

## T6 — Browser e2e smoke
**wave** 2. **files_owned**: new `scripts/smoke/e2e-full.mjs`, `scripts/smoke/README.md` (own section + a11y section text supplied by Director from T7 NOTES).
**objective**: WP16 T6 flow + acceptance exactly.
**context**: import `withDebug, S7, S9, S11, S13, S15, buyList, collectErrors` from `./lib/common.mjs` (T4). Model on `finale.mjs`, `prestige.mjs`, `wp4-persistence.mjs`, `perf.mjs`; thresholds only from `perf-budget.json`. Footer read null-safe (`[aria-label^="Version"]`). Screenshots `e2e-<cp>.png` to out dir. Prod reload without `?debug`: `__wedtmd` undefined, game boots. Second context = path N. ONE JSON with `fail: []`; exit 1 on non-empty; total wall <= 240 s asserted; 1280x720.
**constraints**: no src edits; real mouse for crank, menu, dialog, MEMORY buy; hook only for buy lists, `skipFinale`, state reads.
**acceptance**: against `vite preview`: `fail: []`, exit 0; all WP16 T6 asserts implemented.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
node --check scripts/smoke/e2e-full.mjs && echo OK
npm run build && (npx vite preview --port 4173 --strictPort > /tmp/smoke-preview.log 2>&1 &); sleep 3
mkdir -p /tmp/smoke && PW_PATH=$PW node scripts/smoke/e2e-full.mjs http://localhost:4173/ /tmp/smoke; echo exit=$?
```
(`$PW` = global Playwright path from `finale.mjs` header. Stop preview afterwards.)

## T7 — Accessibility check + fixes
**wave** 2. **files_owned**: new `scripts/smoke/a11y.mjs`; `src/ui/*.css`, `src/ui/menu/*.css`; aria/role/tabindex attribute edits in non-test `src/ui/**/*.ts`. NOT README.
**objective**: WP16 T7 checklist (10 rows) as one smoke printing JSON `{ items: { key: { pass, detail } }, fail: [] }` then a markdown table.
**context**: reuse wp12 Space/Enter + key-repeat method. Modal counts via hook (read `debugHook.ts`, null-safe). Contrast via computed colours vs nearest opaque ancestor background (small luminance fn in script). Reduced motion via `emulateMedia` and/or settings toggle; check camera shake + finale `reduced`. Flashes <= 3 Hz row: cite existing data test in `detail` (grep sparkGap/finale beam tests); none -> STOP, report (EM assigns test). UI scale 150 %: bounding boxes inside 1280x720.
**constraints**: CSS/aria only; no redesign; JS behaviour change only for a small focus-trap fix if row 3 fails (note it); existing UI tests green.
**acceptance**: `fail: []`, exit 1 on fail; NOTES list every fix (file + what) + table for README §Accessibility.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
node --check scripts/smoke/a11y.mjs && echo OK
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/ui" && echo CHECK || echo OK
npm run build && (npx vite preview --port 4174 --strictPort > /tmp/smoke-preview-a11y.log 2>&1 &); sleep 3
PW_PATH=$PW node scripts/smoke/a11y.mjs http://localhost:4174/ /tmp/smoke
grep -rnE "0x[0-9a-fA-F]{6}|innerHTML" src/ui --include=*.ts | grep -v test
```
(Use port 4174 so T6 preview on 4173 is not shared/killed.)

## T9b — ASSET_GUIDE refresh + guard test
**wave** 2. **files_owned**: `docs/ASSET_GUIDE.md`, new `src/assets/assetGuide.test.ts`.
**objective**: WP16 T9b exactly.
**context**: read `src/assets/manifest.ts` fully (113 ids / 133 files), `scripts/art/make_rot.py`, painters dir, current guide. Groups: Era I / II / III / IV / V / Finale & restored world / FX / UI & prestige; same columns (file, w×h, origin, tileable, frames, layer+depth, description), values copied from manifest. Replacement guide per kind: static sprite, tileable layer, `#rot` sheet (frame counts), frame strip, UI sheet with frame-index table (badges, icons16, perks, perk-slot), procedural-only `file: null`. Fallback + size-warning sections current. Remove "reserved: no renderer" note for `fx.steam` (verify `SteamFx.ts` renders it). Test reads manifest export + `docs/ASSET_GUIDE.md` via `fs`; fails listing missing ids.
**constraints**: no manifest/asset edits. Re-check after T8 fixes.
**acceptance**: test green; hand-check 10 ids' w×h vs manifest, report.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/assets
npx tsc --noEmit 2>&1 | grep -E "^src/assets" && echo CHECK || echo OK
```

---

# WAVE 3

## T8 — Final Art Director audit (Director runs `art-director`, Opus)
Brief: WP16 T8 verbatim. Pre-req: build + preview, smokes with `?debug=1`. Coverage: `stages.mjs` s0..s16, `finale.mjs` k1..kend + reduced, `wp12-menus` 6 tabs, tree per era tab, cycle confirm, cycle-2 start (T6 `e2e-*.png`), UI scale 150 %, postgame idle. Output: append `## Phase 6 — 1.0 full-game audit` to `docs/plan/ART_AUDIT.md` (verdict table PASS / FIX / ACCEPT-MINOR). FIX items -> EM -> workers touching only `public/assets/**`, `src/assets/manifest.ts` dims, `src/assets/painters/**`, `src/ui/*.css`. <= 2 fix rounds, re-shot, final RELEASE-READY. After any manifest/asset change: re-run `assetGuide.test.ts`, re-assign T9b doc update.

## T9a — README + CHANGELOG + spec note
**wave** 3. **files_owned**: `README.md`, new `CHANGELOG.md`, `docs/GAME_SPEC.md` (append to §18 only).
**objective**: WP16 T9a exactly.
**context**: Director pastes inputs: T3 tables, T2 matrix, T7 table, perf JSON, `npm run verify` result, test count, bundle sizes. Read `docs/plan/ROADMAP_FULL.md`, GAME_SPEC §16-§18, `docs/PROJECT_STATUS.md` (read-only).
**constraints**: no code edits; every number from supplied data or a command you ran; no invented features; no rewrite above §18.
**acceptance**: README sections per WP16 T9a (overview, setup incl. `npm run verify` + `?debug=1`, controls, features, architecture incl. `src/audio`, `src/ui/menu`, `scripts/smoke`, `scripts/perf`, Balance, Saves, Accessibility, Performance, Assets, Post-1.0 ideas); CHANGELOG `1.0.0 — 2026-10-xx` + condensed 0.x per WP; §18 note with deviations.
**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
grep -nE "^## " README.md
head -20 CHANGELOG.md
git diff HEAD -- docs/GAME_SPEC.md | grep -E "^-[^-]" | head     # empty (additions only)
```

---

# WAVE 4 — EM Mode B (not a worker)
Run: `npm run verify` · `npm test` count >= WP15 HEAD + new · `npx vitest run src/simulation/fullRun.e2e.test.ts src/simulation/signoff.sim.test.ts src/persistence/compat.test.ts src/assets/assetGuide.test.ts` (report durations) · preview 4173 with `?debug=1`: `e2e-full`, `a11y`, `stages`, `finale`, `wp12-menus`, `wp4-persistence`, `wp2-crank`, `wp3-techtree`, `prestige` -> `errors: []` / `fail: []`; `PERF_STRICT=1 perf.mjs` -> `fail: []` · preview WITHOUT `?debug`: `__wedtmd` undefined · `grep -rn "from 'phaser'" src/{simulation,data,persistence,utils}` empty · TODO/FIXME/console.log grep empty · `git diff --stat HEAD -- src/data/technologies.ts src/simulation/production src/simulation/progression` empty unless T3 reported a failing row · no file changed outside owner lists. Fill release checklist evidence (GAME_SPEC §16 15 rows, §17 8 deliverables, full-game list). If T3 tuned `src/data`: re-run T1 and T6 before PASS. Trivial glue by EM only, declared.
