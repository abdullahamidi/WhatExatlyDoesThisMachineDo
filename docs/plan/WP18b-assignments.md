# WP18b - Worker Assignments (Engineering Manager, Mode A)

Source: WP18b plan (D1-D8, C1-C7, T1-T9) + repo read at HEAD `69ed967` (branch `claude/funny-hawking-q6kq0w`).
Goal: wire the A17 restored era V variants (24 PNGs under `public/assets/machine/era5/restored/**`) into the renderer so the postgame machine shows the warm lit core; photo chip `:focus-visible`; 14th final shot `d_photo_crown`; smokes assert the swap. Save stays v2, no new AssetId, BootScene / MachineView / WorldScene / ShowcaseScene untouched.
Parallel tracks: WP20 (`C:/Users/sanan/wedtmd-art`) and WP15R (`C:/Users/sanan/wedtmd-shell`) - never touch. Forbidden list in this repo: see Package validation, step "scope guard".

## EM decisions / deviations from the plan (these WIN for workers)
1. **T1 split** into T1 (`manifest.ts`, wave 1) and T1b (`manifest.test.ts`, wave 2). 22 entry edits + planAssetLoads and ~170 lines of tests (table, PNG-IHDR reader, fixtures) do not fit one Haiku pass. Consequence: between W1 and W2 exactly 2 existing tests in `manifest.test.ts` fail by design ("loads exactly the file-backed entries ... as images", "plans one #rot spritesheet per rotation entry ...").
2. **T4 split** into T4a (`showcase.mjs`, wave 1) and T4b (`finale.mjs`, `prestige.mjs`, `scripts/smoke/README.md`, wave 2). showcase.mjs alone is 10 edits including a new run.
3. **CSS line moved into T2** (data + test + CSS, all 1-line class); **T3 is docs only**.
4. **T8 / T9 are not worker tasks.** T8 = EM Mode B (validation + final shots + per-shot verdicts) and the Art Director re-check; T9 (crown framing tune) is a conditional worker task, prompt below, assigned only if review fails the framing.
5. **dist is shared** (preview server serves `dist/` at :4173, re-reads per request). NO worker builds or runs browser smokes. Only the EM (Mode B, after W3) runs `npm run build` once and then the smokes in series.
6. `pngSize` helper in T1b reads IHDR through a `DataView` with `byteOffset` (node small Buffers are pooled; `buf.buffer` alone can start at a nonzero offset).
7. T4a asserts also `showcase_B_k45_2` = 33 (t 45.2 >= 30 so restored); the plan listed only k41_5 and k56.
8. Re-read each file right before editing; small unique-anchor Edits.

## Waves
| Wave | Tasks | Notes |
|---|---|---|
| 1 | **T1** manifest.ts, **T2** showcase data + test + photoMode.css, **T3** docs, **T4a** showcase.mjs | all independent |
| 2 | **T1b** manifest.test.ts, **T4b** finale/prestige/README, **T5** restoredTextures.ts + test | T1b and T5 need T1; T4b needs nothing but reads T4a |
| 3 | **T6** MachineAnimator, **T7** debugHook | T6 needs T2 + T5; T7 needs T5 |
| 4 | **T8** EM Mode B (not a worker) | build, all smokes, Read every PNG, AD re-check |
| 5 (cond.) | **T9** crown framing tune | only if T8 fails the d_photo_crown framing |

### Allowed transient failures
| After | Allowed |
|---|---|
| W1 | typecheck clean. vitest: only the 2 named `manifest.test.ts` tests fail (fixed by T1b) |
| W2 | none (T1b fixes the 2 tests; T5 imports only T1's exports) |
| W3 | none |
Inside a wave a worker may see tsc errors from another worker's half-written file: list in NOTES, do not fix.

## File ownership (no overlaps inside a wave)
| Task | Files |
|---|---|
| T1 | src/assets/manifest.ts |
| T2 | src/data/showcase.ts, src/data/showcase.test.ts, src/ui/photoMode.css |
| T3 | docs/plan/WP18.md, docs/plan/ART_ERA5.md, docs/ASSET_GUIDE.md |
| T4a | scripts/smoke/showcase.mjs |
| T1b | src/assets/manifest.test.ts |
| T4b | scripts/smoke/finale.mjs, scripts/smoke/prestige.mjs, scripts/smoke/README.md |
| T5 | src/game/math/restoredTextures.ts, src/game/math/restoredTextures.test.ts (new) |
| T6 | src/game/entities/MachineAnimator.ts |
| T7 | src/game/debugHook.ts (append only) |
| T9 (cond.) | scripts/smoke/showcase.mjs (CROWN constants), scripts/smoke/README.md (CROWN numbers) |
No file appears in two tasks of the same wave. `scripts/smoke/README.md` is T4b only (T9 later). Merge note for the Director: WP15R/WP20 may also edit `scripts/smoke/README.md` and append to `src/game/debugHook.ts`; merge by hand.

## Task summaries (full self-contained prompts are in the waves payload)
- **T1** `AssetEntry.restored?: { file; rotationFile? }` on exactly 22 ids; `ROT_SUFFIX`, `RESTORED_SUFFIX`, `restoredTextureKey(id, rotation)`; `planAssetLoads` per id: `[id]`, `[id#rot]`, `[id#restored]` (file-backed + restored; same kind/frame as original), `[id#restored#rot]` (rotation + rotationFile). 24 extra loads. Greps: 22 restored entry lines, 24 distinct paths all on disk.
- **T2** `RESTORED_ACCENT.holdFrames` += `generatorGlow: 3`; showcase.test.ts: frames-or-gauge rule, generatorGlow = frames-1 = 3, key set = FINALE_BOOST keys + crystal + generatorGlow; `.photo-chip--hint, .photo-chip:focus-visible, .photo-chip:hover { opacity: 1; }` (1-line diff).
- **T3** WP18.md "Post-merge notes (WP18b)" (teaser API lives in teaser.ts, D6 v2, chip focus-visible, 14 shots); ART_ERA5.md section 7 S3 row (survey camera + 30.0 restored accent); ASSET_GUIDE.md heading "A17 art sources and restored variants" + "Restored variants (WP18b)" subsection.
- **T4a** showcase.mjs: warnings capture, helpers (`restored`, `texKey`, `frameOf`, `chipState`, `blurChip`, `checkRestored`), `RESTORED_TOTAL = 33`, `CROWN`; asserts in A (chip 0, swapped 0), B (0 at k2_5/k3_9/k5_4/k6_9, 33 at k41_5/k45_2/k56), C (33, keys, lamp frames 3/2/3/2), D (hint false, chip focused, focus-visible => opacity 1, blur, opacity 0, shot), new D2 (keys => camera (2048,696,1.5), shot `d_photo_crown`), C2 (33). 14 shots.
- **T1b** two existing tests narrowed; new describe 'A17 restored variants (WP18b)' with 8 tests (table of 22, naming rule, disk files 24 distinct, PNG dims vs originals, load shapes and order, rot loads, fixtures, key helpers).
- **T4b** finale.mjs `restoredSwapped` in k*/3_reload_choice/5_reload_postgame/7_reset/r_42; prestige.mjs RUN B `restoredSwapped` + `coreKey` with error pushes (33 / `machine.nullCore#restored#rot` in postgame, 0 / `machine.nullCore#rot` after new cycle); README: bundle budget line (400 KB / 130 KB gzip / css 40 KB), hook bullets, showcase section (14 PNG, D2, asserts), WP18b expectations.
- **T5** pure `restoredTextures.ts`: `restoredComponentIds()` (33 ids, frozen, same ref), `isRestoredKey`, `swapTextureKey` (D3 rule + fallback), `frameIndexOfName`; tests as in the contract.
- **T6** MachineAnimator: `texturesRestored` field, `applyRestoredTextures(on)`, call in `setFinale`, revert in `reset`, `gauge` hold for `generatorGlow` (restored and boost 0). Diff about +30 lines.
- **T7** debugHook: `restoredTextures()` and `textureKey(id)`, null-safe.

## T8 - EM Mode B (not a worker task): validate + final shots
Run in this order after W3 (single owner of build and browser smokes; the preview at :4173 serves `dist`, never start another server):
```
cd "C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo"
npm run typecheck
npm test                                   # >= 102 files, >= 2975 + new tests, all pass
npm run build
node scripts/perf/bundle-budget.mjs        # PASS; app raw <= 400 KB (baseline 379.6; WP18b adds <= 4 KB), gzip <= 130
npx vitest run src/assets/manifest.test.ts src/game/math/restoredTextures.test.ts src/data/showcase.test.ts src/game/math/showcase.test.ts src/game/math/teaser.test.ts
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/assets/manifest.ts   # empty
git diff --name-only 69ed967 -- 'src/ui/techTree*' 'src/ui/toasts*' src/ui/hud.ts src/ui/hudView.ts src/ui/hud.css 'src/ui/systemMenu*' src/ui/menu 'src/ui/titleScreen*' src/data/notifications.ts src/data/hud.ts src/data/achievements.ts src/data/steamFx.ts src/data/shell.ts src/assets/painters index.html src/audio src/data/audio.ts src/data/music.ts scripts/smoke/perf.mjs scripts/smoke/perf-budget.json desktop public/assets src/game/scenes src/game/entities/MachineView.ts src/data/machineComponents.ts src/simulation src/persistence   # empty (scope guard)
PW=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright
S="C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad"
OUT="$S/WP18b"; FINAL="$S/final-shots"
mkdir -p "$OUT/finale" "$OUT/stages" "$OUT/prestige" "$OUT/shell" "$FINAL"
PW_PATH=$PW node scripts/smoke/showcase.mjs "http://localhost:4173/?debug=1" "$FINAL" > "$OUT/showcase.json"   # errors [], 14 shots, C7 values
PW_PATH=$PW node scripts/smoke/finale.mjs "http://localhost:4173/?debug=1" "$OUT/finale" > "$OUT/finale.json"     # errors [], restoredSwapped per C7
PW_PATH=$PW ONLY=s15_era5_full,s16_postgame node scripts/smoke/stages.mjs "http://localhost:4173/?debug=1" "$OUT/stages" > "$OUT/stages.json"   # errors [], parts17 all true
PW_PATH=$PW node scripts/smoke/prestige.mjs "http://localhost:4173/?debug=1" "$OUT/prestige" > "$OUT/prestige.json" # errors [] (new-cycle swap-back asserted)
PW_PATH=$PW node scripts/smoke/shell.mjs "http://localhost:4173/" "$OUT/shell" > "$OUT/shell.json"                # base URL WITHOUT query; fail [], errors []
node -e 'const fs=require("fs"),p=process.argv[1];const f=fs.readdirSync(p).filter(n=>n.endsWith(".png"));const bad=f.filter(n=>{const b=fs.readFileSync(p+"/"+n);return b.readUInt32BE(16)!==3840||b.readUInt32BE(20)!==2160});console.log(f.length,"png bad:",bad)' "$FINAL"   # 14 png bad: []
```
C7 expected probe values (check in the JSONs):
| probe | when | expected |
|---|---|---|
| `restoredTextures().swapped.length` | none; sequence t < 30; run A | 0 |
| same | sequence t >= 30.5, choice, postgame, reload postgame, reduced r_42 | 33 (= total) |
| same | after menu reset (`finale_7_reset`), after new cycle (`prestige_3_after`) | 0 |
| `textureKey('nullCore')` | postgame / after new cycle | `machine.nullCore#restored#rot` / `machine.nullCore#rot` |
| `textureKey('ring1Bead')`, `textureKey('aperture')` | postgame | `machine.ringBead#restored`, `machine.aperture#restored` |
| `componentState(id).frame` | postgame | generatorGlow 3, crystal 2, lensLight 3, anchorGlow1L 2 |
| camera in D2 | after keys | (2048 +-2, 696 +-2, 1.5 +-.01) |
| PNG count in final-shots | after showcase.mjs | 14, each 3840x2160 |

Mode B then Reads every PNG in `$FINAL` and reports a verdict per shot: `a_era5_ruined` violet core, no chip/HUD; `b_k56` warm core in FULL; `c_postgame_portrait` warm lit core, pale rings/arcs/siphons/anchor glows, mint crystal, `RESTORATION ENGINE`; `d_photo_postgame` no HUD, no chip; `d_photo_crown` aperture top fully in frame, core near centre, crystal + gallery visible, no chip; `e_teaser_end` violet, never restored. Art Director re-checks `d_photo_crown` / `c_postgame_portrait` (core reads warm at zoom .5; crystal verdict per D5: if crystal frame 2 still reads wrong, open an art follow-up: `machine.crystal` restored PNG + manifest row + test-table row; zero code, the mechanism is generic). The Director then sends `$FINAL/*.png` to the user and updates `docs/PROJECT_STATUS.md` (WP18 row: restored accent v2 + 14 shots).

## T9 (conditional) - crown framing tune, single owner
Assign only if the T8 review fails the crown framing. Files: `scripts/smoke/showcase.mjs` (the `CROWN` constant only) + `scripts/smoke/README.md` (CROWN numbers only: the `d_photo_crown` bullet and Run D2 bullet). Worker prompt:
```
ASSIGNMENT T9: retune the crown close-up key counts.
Owned: scripts/smoke/showcase.mjs (only the line `const CROWN = { zoomIn: 4, right: 2, up: 6, x: 2048, y: 696, z: 1.5 };`) and scripts/smoke/README.md (only the camera numbers in the `d_photo_crown` and Run D2 bullets).
Rules: zoom stays 1.5 (zoomIn 4: 4 x `=` from .5, grid step .25). Change `up` in 5..6 and `right` in 1..3 only. Expected centre: x = 1920 + 64*right, y = 1080 - 64*up (each arrow press pans 96 screen px / 1.5 = 64 world px). Update CROWN.x / CROWN.y to match.
Targets (given by the EM from the review): <aperture top >= 1 art px (3 CSS px) inside the frame | core within +-80 CSS px of the centre | gallery visible>.
Validate: node --check scripts/smoke/showcase.mjs. Do NOT build or run the browser; the EM reruns showcase.mjs (no rebuild needed) and Reads d_photo_crown.png.
```

## Out of scope
New art / PixelLab / crystal variant; painter fallbacks for restored keys; lazy-loading restored textures; BootScene size check of variants (the test covers dims); tween or crossfade for the swap (instant by design); HUD / menu / toast / title (WP20); audio / perf smoke (WP15R); demo edition (WP21 - the teaser stays unrestored); simulation, balance, save schema; MachineView / WorldScene / ShowcaseScene edits.
