# WP18b — Showcase integration: restored warm core (A17 variants wired), photo-mode a11y, final 3840×2160 machine shots

Follow-up to WP18 (docs/plan/WP18.md) and A17 (docs/plan/A17.md, "Postgame accent (for WP18)" (a)–(f)). Program: docs/plan/STEAM_DEMO_PROGRAM.md D3.
Baseline 69ed967: typecheck clean, 101 files / 2975 tests, build OK, bundle PASS (dist app chunk 379.6 KB raw of 400).

## Facts checked in the code (trust these)
- 24 PNGs on disk under `public/assets/machine/era5/restored/**`: 22 plain + `rot/null-core-rot.png` + `rot/inversion-ghost-rot.png`. Each PNG has the same IHDR size as its original (checked: all OK, about 52 KB in total). Nothing references them yet.
- `AssetEntry` has no `restored` field. `planAssetLoads` emits `id` and `id#rot` only. BootScene loads every planned load (`load.spritesheet` when frame is set, else `load.image`) and size-checks only `ASSET_IDS`. **BootScene needs no change.**
- 33 machine components use the 22 restored asset ids: siphonTube ×6, ringBead ×4, anchorGlow1-3 ×2 each, and 1 each for the rest.
- `MachineView` creates spin/driven sprites on `${assetId}#rot` when that texture exists. `applyAngle` / `angleOf` test `key.endsWith('#rot')`, so `#restored#rot` still counts as a rotation sheet.
- `FinaleFrame.restored` is true in sequence from t ≥ 30 (FINALE_PLATE.atS, the plate beat) and in choice and postgame. It is false in none. `FinaleDirector.apply` pushes `machine.applyFinale({boost, restored})` every frame outside `none`, and once on entering `none` (reset / new cycle). ShowcaseScene always pushes `restored: false`.
- Lamps lit (WP18): `RESTORED_ACCENT.holdFrames` = FINALE_BOOST holds + crystal 2. It is used only by the animator's `frames` branch.
  - `generatorGlow` is animation kind **`gauge`** (frames 4), so it is not covered today.
- Crystal: the A17 mock (`scratchpad/A17/acc1/c_core.png`) predates WP18 and showed crystal frame 0 (#3f5e52 dark green). Since WP18, restored with boost 0 holds frame 2 (#cfe8d6 / #7fae96, the brightest). This is a data fix that already exists; WP18b only asserts it.
- `src/ui/photoMode.css`: `.photo-chip--hint, .photo-chip:hover { opacity: 1; }`. `:focus-visible` is missing, so a keyboard-focused chip is invisible.
- `showcase.mjs` run D asserts `#photo-exit` opacity `'0'` (line 259). That assertion breaks once focus-visible shows the chip. The script writes 13 shots and has no crown close-up.
- The teaser API lives in `src/game/math/teaser.ts`, not in `showcase.ts` as WP18 C4 says.
- `scripts/smoke/README.md` line 170 says app ≤ 340 KB / gzip 100 / css 30. `perf-budget.json` says 400 / 130 / 40.
- Vitest env is node and tsconfig `types: ["vite/client"]`. A dynamic `import(NODE_FS)` with a const string variable typechecks and runs in vitest 5 (probed).

## D — Decisions
- **D1 Data shape.** Add `AssetEntry.restored?: { file; rotationFile? }` on exactly 22 ids (table C1). A variant is a separate texture `${id}#restored` / `${id}#restored#rot`, loaded at boot (24 extra loads, ~52 KB). No new AssetId.
- **D2 Trigger = `FinaleFrame.restored`** (the same `finaleRestored` flag as stage endingFrame and lamps lit):
  - The swap happens on the false→true transition: sequence t 30 (with the plate beat), choice, postgame, boot or reload into choice/postgame.
  - It is reverted on true→false: seek back below 30, neutral frame after reset or new cycle.
  - The animator `reset` handler also reverts at once.
  - The swap is instant in every motion mode (A17 (f): reduced motion unaffected).
- **D3 Swap rule (pure).**
  - Restored target = `${assetId}#restored#rot` when the sprite now shows a `#rot` key, else `${assetId}#restored`.
  - Back target = `${assetId}#rot` or `${assetId}`.
  - Keep the frame index.
  - If the target texture does not exist or the entry has no `restored`, keep the current key (fallback to the original).
- **D4 Lamps lit + generator.** `RESTORED_ACCENT.holdFrames += generatorGlow: 3` (= gauge frames − 1). The animator `gauge` case holds it under the same rule as frames parts: `finaleRestored && boost === 0`. The data stays in src/data.
- **D5 Crystal.**
  - No new art in WP18b. Frame 2 hold stays.
  - Smokes assert crystal frame 2 in postgame. The AD verdict on `d_photo_crown.png` decides.
  - If it still reads wrong → follow-up: Art Director adds a `machine.crystal` restored PNG + manifest row. Zero code: the D1 mechanism is generic.
- **D6 Photo chip a11y.** `:focus-visible` joins the opacity:1 rule.
  - Run D asserts `photoState().hint === false` (not opacity). The new focus check: if the chip matches `:focus-visible`, its opacity must be `'1'`.
  - Shots blur the chip first, so store shots have no DOM.
- **D7 Crown close-up shot** `d_photo_crown.png`: postgame photo mode driven by real keys from the portrait.
  - Keys: `=` ×4 (zoom .5→1.5), ArrowRight ×2 (+64 world each), ArrowUp ×6 (−64 each) → camera (2048, 696, 1.5).
  - Zoom 1.5 × PIXEL_SCALE 2 = 3 screen px per art px (integer scale).
  - View art y −612..−372 holds the aperture top (−610), lens, chamber, core (−490), siphons, crystal and gallery (−395).
- **D8 Scope guard.** Not edited: MachineView, WorldScene, BootScene, ShowcaseScene, public/assets, simulation, balance, saves, audio. WP20/WP15R files are forbidden (list in Validation).

## C — Contracts

### C1 `src/assets/manifest.ts`
```ts
export interface AssetEntry {
  // ...existing fields unchanged...
  /** Postgame restored-accent variant (A17 art, wired WP18b): same width/height, frame layout and rotation layout as the original.
   *  Loaded as `${id}#restored` (same kind + frame as the entry) and, with rotationFile, `${id}#restored#rot` (frame = entry.width x entry.height, count = rotation.frames). Paths under public/assets/. */
  restored?: { file: string; rotationFile?: string };
}
export const ROT_SUFFIX = '#rot';
export const RESTORED_SUFFIX = '#restored';
/** `${id}#restored`, or `${id}#restored#rot` when rotation is true. */
export function restoredTextureKey(id: AssetId, rotation: boolean): string;
```
`AssetLoad.key` comment: "an AssetId, `${id}#rot`, `${id}#restored` or `${id}#restored#rot`".

`planAssetLoads` per id, in this order: `[id]`, `[id#rot]` (unchanged), then:
- `id#restored` when `entry.file !== null && entry.restored !== undefined`:
  - load = `{ key, url: baseUrl + entry.restored.file, kind: entry.frame ? 'spritesheet' : 'image' }`
  - `frame: entry.frame` only when defined, exactly as for the original load
- `id#restored#rot` when `entry.rotation !== undefined && entry.restored?.rotationFile !== undefined`:
  - load = `{ key, url: baseUrl + rotationFile, kind: 'spritesheet', frame: { width: entry.width, height: entry.height, count: entry.rotation.frames } }`

Restored table (22 ids; file = `entry.file` with `machine/era5/` → `machine/era5/restored/`; rotationFile = `rotation.file` with `machine/era5/rot/` → `machine/era5/restored/rot/`):
| id | restored.file | rotationFile | size (frame) |
|---|---|---|---|
| machine.nullChamber | machine/era5/restored/null-chamber.png | — | 128×116 |
| machine.nullCore | machine/era5/restored/null-core.png | machine/era5/restored/rot/null-core-rot.png | 64×64; rot 512×512 (64 fr) |
| machine.nullCoreGlint | machine/era5/restored/null-core-glint.png | — | 64×64 |
| machine.ring1Back … ring4Back | machine/era5/restored/ring{1..4}-back.png | — | 112×72 |
| machine.ring1Front … ring4Front | machine/era5/restored/ring{1..4}-front.png | — | 112×72 |
| machine.ringBead | machine/era5/restored/ring-bead.png | — | 5×5 |
| machine.siphonTube | machine/era5/restored/siphon-tube.png | — | 12×30 |
| machine.siphonArcs1/2/3 | machine/era5/restored/siphon-arcs-{1,2,3}.png | — | 512×64 (128×64 ×4) |
| machine.anchorGlow1/2/3 | machine/era5/restored/anchor-glow-{1,2,3}.png | — | 128×128 (32×128 ×4) |
| machine.inversionGhost | machine/era5/restored/inversion-ghost.png | machine/era5/restored/rot/inversion-ghost-rot.png | 48×48; rot 432×432 (80 fr) |
| machine.lensLight | machine/era5/restored/lens-light.png | — | 128×48 (32×48 ×4) |
| machine.aperture | machine/era5/restored/aperture.png | — | 384×28 (64×28 ×6) |

Load totals: 22 `#restored` (8 spritesheets: siphonArcs1-3, anchorGlow1-3, lensLight, aperture; 14 images) + 2 `#restored#rot` = 24 keys containing `#restored`.

### C2 `src/game/math/restoredTextures.ts` (new, pure, no Phaser)
```ts
import type { AssetId } from '../../assets/assetIds';
import { ASSET_MANIFEST, RESTORED_SUFFIX, ROT_SUFFIX, restoredTextureKey } from '../../assets/manifest';
import { MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
/** Components whose asset has `restored`, MACHINE_COMPONENT_IDS order; computed once, Object.freeze'd, same reference every call. */
export function restoredComponentIds(): readonly MachineComponentId[];
/** key.includes(RESTORED_SUFFIX). */
export function isRestoredKey(key: string): boolean;
/** D3: rot = currentKey.endsWith(ROT_SUFFIX); target = restored ? restoredTextureKey(assetId, rot) : (rot ? assetId + ROT_SUFFIX : assetId);
 *  returns currentKey when ASSET_MANIFEST[assetId].restored === undefined or !has(target). */
export function swapTextureKey(assetId: AssetId, currentKey: string, restored: boolean, has: (key: string) => boolean): string;
/** Number(name) when it is an integer >= 0, else 0 ('__BASE', '', '-1', '1.5' -> 0). */
export function frameIndexOfName(name: string | number): number;
```
`restoredComponentIds()` = these 33, in order: nullChamber, nullCore, nullCoreGlint, ring1Back, ring2Back, ring3Back, ring4Back, ring1Front, ring2Front, ring3Front, ring4Front, ring1Bead, ring2Bead, ring3Bead, ring4Bead, siphonTube1L, siphonTube1R, siphonTube2L, siphonTube2R, siphonTube3L, siphonTube3R, siphonArcs1, siphonArcs2, siphonArcs3, anchorGlow1L, anchorGlow1R, anchorGlow2L, anchorGlow2R, anchorGlow3L, anchorGlow3R, inversionGhost, lensLight, aperture.

### C3 `src/data/showcase.ts`
```ts
/** Restored accent 'lamps lit': in the restored state with boost 0 these frames / gauge parts hold their bright frame (generatorGlow = top gauge frame, A17 (d)). */
export const RESTORED_ACCENT = {
  holdFrames: { ...FINALE_BOOST.holdFrames, crystal: RESONANCE_MILESTONE_FX.holdFrame, generatorGlow: 3 } satisfies Partial<Record<MachineComponentId, number>>,
} as const;
```

### C4 `src/game/entities/MachineAnimator.ts`
- Imports: `restoredComponentIds, swapTextureKey, frameIndexOfName` from `'../math/restoredTextures'`.
- New field: `private texturesRestored = false;`.
- New method `private applyRestoredTextures(on: boolean): void`:
  - Return when `on === this.texturesRestored`; else set the field.
  - For each `id` of `restoredComponentIds()`:
    - `sprite = this.sprites.get(id)`; skip when undefined or `!sprite.scene`.
    - `key = swapTextureKey(MACHINE_COMPONENTS[id].assetId, sprite.texture.key, on, (k) => sprite.scene.textures.exists(k))`.
    - When `key !== sprite.texture.key` → `sprite.setTexture(key, frameIndexOfName(sprite.frame.name))`.
- `setFinale(f)`: after `this.finaleRestored = f.restored;` call `this.applyRestoredTextures(this.finaleRestored);`.
- `reset` handler, appended at the end: `this.finaleRestored = false; this.applyRestoredTextures(false);`.
- `case 'gauge'`, first statements: `const lit = RESTORED_HOLD_FRAMES[id]; if (lit !== undefined && this.finaleRestored && boost === 0) { sprite.setFrame(lit); break; }`.
- Class doc comment gets 2 lines: the restored texture swap (D2/D3) and the gauge hold.
- Nothing else changes.

### C5 `src/game/debugHook.ts` (append only; `installDebugHook` signature unchanged)
```ts
// WP18b restored accent probes (World machine)
restoredTextures(): { swapped: MachineComponentId[]; total: number } | null;  // ids of restoredComponentIds() whose sprite key isRestoredKey; total = restoredComponentIds().length (33); null without machine
textureKey(id: MachineComponentId): string | null;                           // getMachine()?.getComponentSprite(id)?.texture.key ?? null
```

### C6 `src/ui/photoMode.css`
Line `.photo-chip--hint, .photo-chip:hover { opacity: 1; }` → `.photo-chip--hint, .photo-chip:focus-visible, .photo-chip:hover { opacity: 1; }`. Every other rule stays byte-identical.

### C7 Expected probe values (smokes)
| probe | when | expected |
|---|---|---|
| `restoredTextures().swapped.length` | none; sequence t < 30 (k1…k24, B k2_5/k3_9/k5_4/k6_9); run A (era V, no finale) | 0 |
| same | sequence t ≥ 30 (k30_5…kend, B k41_5/k56), choice, postgame, reload postgame, reduced r_42 | 33 (= total) |
| same | after menu reset (finale_7_reset), after new cycle (prestige_3_after) | 0 |
| `textureKey('nullCore')` | postgame / after new cycle | `machine.nullCore#restored#rot` / `machine.nullCore#rot` |
| `textureKey('ring1Bead')`, `textureKey('aperture')` | postgame | `machine.ringBead#restored`, `machine.aperture#restored` |
| `componentState(id).frame` | postgame | generatorGlow 3, crystal 2, lensLight 3, anchorGlow1L 2 |
| camera | D2 after keys | (2048±2, 696±2, 1.5±.01) |
| PNG count in final-shots | after showcase.mjs | 14 (13 WP18 + `d_photo_crown`), each 3840×2160 |

## Tasks (EM waves; exclusive file ownership; ≤ 4 parallel)

### W1
**T1 Manifest restored variants + load plan.** Files: `src/assets/manifest.ts`, `src/assets/manifest.test.ts` (co-owned test). Depends: none.
Acceptance:
- C1 exactly: interface field, 22 entries per the table, constants, `restoredTextureKey`, `planAssetLoads` rules. Descriptions and dims unchanged.
- Existing test edits:
  - "loads exactly the file-backed entries … as images": filter `l.kind === 'image' && !l.key.includes('#')`.
  - "plans one #rot spritesheet per rotation entry": filter `l.key.endsWith('#rot') && !l.key.includes('#restored')`.
- New `describe('A17 restored variants (WP18b)')`:
  1. Exactly the 22 table ids have `restored`.
  2. File naming rule; `rotationFile` defined iff `entry.rotation` is defined.
  3. Every file and rotationFile is in `import.meta.glob('/public/assets/**/*.png')`; the distinct count is 24.
  4. Async dims test via `pngSize(file)`:
     - Helper: `const NODE_FS = 'node:fs'`; `(await import(/* @vite-ignore */ NODE_FS)) as { readFileSync(p: URL): Uint8Array }`; read `new URL('../../public/assets/' + file, import.meta.url)`; `DataView.getUint32(16/20)`.
     - Restored = original IHDR = manifest width/height. Restored rot = original rot IHDR.
  5. Each `#restored` load `toEqual` the C1 shape. `indexOf(id#restored) === indexOf(id#rot or id) + 1`.
  6. `#restored#rot` loads for nullCore (64×64×64) and inversionGhost (48×48×80) sit right after their `#restored`. 24 keys contain `#restored`.
  7. Custom fixture: an entry with `file: null` plus `restored` → no restored load. `restored.rotationFile` without `rotation` → no `#restored#rot`.
  8. `restoredTextureKey` both forms; `ROT_SUFFIX` `'#rot'`, `RESTORED_SUFFIX` `'#restored'`.
- `npx vitest run src/assets/manifest.test.ts` green; typecheck clean.

**T2 Lamps-lit generator hold (data).** Files: `src/data/showcase.ts`, `src/data/showcase.test.ts` (co-owned). Depends: none.
Acceptance:
- C3 exactly.
- Test "every key is a real frames component…" becomes "every key is a frames or gauge component with its hold frame in [0, anim.frames)": `expect(['frames','gauge']).toContain(anim.kind)`.
- Test "keeps the finale boost holds…": also expects `holds.generatorGlow === 3` and `=== MACHINE_COMPONENTS.generatorGlow.animation.frames - 1` (narrow on kind `gauge`). Key set = FINALE_BOOST keys + `crystal` + `generatorGlow`.
- `npx vitest run src/data/showcase.test.ts` green.

**T3 Photo chip a11y + docs.** Files: `src/ui/photoMode.css`, `docs/plan/WP18.md`, `docs/plan/ART_ERA5.md`, `docs/ASSET_GUIDE.md`. No test file. Depends: none (contracts C1–C4 fixed).
Acceptance:
- C6 exactly; `git diff` of the CSS is 1 line.
- WP18.md: append a section `## Post-merge notes (WP18b)` with these bullets:
  - (1) C4 deviation: `TeaserEra`, `TeaserFrame`, `teaserLevels`, `teaserRates`, `teaserFrame` live in `src/game/math/teaser.ts`; `showcase.ts` keeps visualMaxLevels/visualMaxForEra/sceneMaxForEra/mergeDisplayLevels/portraitPose/machineFitPose/apertureGate/photoPanPose/photoZoomPose. **WP21 imports the teaser API from teaser.ts.**
  - (2) D6 v2: restored texture swap (WP18b D2/D3) + generatorGlow hold 3.
  - (3) Photo chip `:focus-visible` shows the chip.
  - (4) showcase.mjs writes 14 shots (+`d_photo_crown`).
- ART_ERA5.md §7 S3 row:
  - Camera cell = `FULL; survey (WP18) 38.5–49.3: → baseL (1320,1380,×1) arrive 41.0, hold to 42.0 → baseR (2520,1380,×1) arrive 45.0, hold to 46.0 → FULL at 49.3; skipped under reduced motion`.
  - Append to the action cell: `; 30.0 restored accent (WP18b): era V energy sprites swap to their #restored variants (warm lit core, pale rings/arcs/siphons/anchor glows)`.
- ASSET_GUIDE.md "A17 art sources and inert variants" → rename to "A17 art sources and restored variants". Replace "Inert until WP18…" with a "Restored variants (WP18b)" subsection covering:
  - the `restored` field;
  - key naming `#restored` / `#restored#rot`;
  - boot loads, same size/frames as the original (size enforced by manifest.test);
  - trigger: plate beat t 30, choice, postgame; reverted on seek back / reset / new cycle; ShowcaseScene never;
  - missing variant → original;
  - regenerate with `python -I scripts/art/a17/restored.py`;
  - adding a variant for another id = PNG under `<dir>/restored/` + manifest `restored` + manifest.test table row, no code.
  - Fix the count: 22 files + 2 rot sheets, about 52 KB.

**T4 Smokes + smoke README.** Files: `scripts/smoke/showcase.mjs`, `scripts/smoke/finale.mjs`, `scripts/smoke/prestige.mjs`, `scripts/smoke/README.md`. Depends: contracts C5/C7 only. The runtime proof is T8.
Acceptance:
- showcase.mjs:
  - Header: runs A, B, C, D, D2, C2, F, E; 14 PNGs.
  - Console handler (in `open()`): also push warnings matching `/\[assets\] (failed to load|size mismatch)|has no frame/` to `errors`.
  - Helpers:
    - `restored()` → `restoredTextures()`
    - `texKey(id)`
    - `frameOf(id)` (componentState frame)
    - `chipState()` → `{opacity, focused, focusVisible}` of `#photo-exit` (`el.matches(':focus-visible')`)
    - `blurChip()`
    - `const RESTORED_TOTAL = 33`
    - `const CROWN = { zoomIn: 4, right: 2, up: 6, x: 2048, y: 696, z: 1.5 }`
  - A: after the 1200 ms wait, `blurChip()`, wait 500. Assert chip opacity `'0'`, swapped 0, total 33. Shot unchanged.
  - B: swapped 0 at k2_5 and the 3 era keys; 33 at k41_5 and k56.
  - C: swapped 33 = total; texKey nullCore `machine.nullCore#restored#rot`, ring1Bead `machine.ringBead#restored`, aperture `machine.aperture#restored`; frames generatorGlow 3, crystal 2, lensLight 3, anchorGlow1L 2.
  - D:
    - Replace `chipOpacity === '0'` with `photo?.hint === false` (already asserted; keep one assert).
    - Add assert `chip.focused === true` and `(!chip.focusVisible || chip.opacity === '1')`; record chip.
    - Then `blurChip()`, wait 500, assert opacity `'0'`, then shot `d_photo_postgame` (still). The rest of D is unchanged.
  - New D2 (same context, after D):
    1. `page.focus('#hud-view-machine')`, Enter, wait 1500, `blurChip()`.
    2. Press `=` ×4, `ArrowRight` ×2, `ArrowUp` ×6 (80 ms between presses), wait 3200, no mouse move.
    3. Assert photo active, hint false, camera = CROWN ±2/±.01, chip opacity `'0'`, swapped 33, crystal frame 2.
    4. Shot `d_photo_crown` (still).
    5. Escape, wait 900 → photo inactive, camera portrait.
    6. `res.showcase_D2`.
  - C2: swapped 33.
  - `node --check scripts/smoke/showcase.mjs` OK.
- finale.mjs:
  - Helper `restoredSwapped()` (`restoredTextures()?.swapped?.length ?? null`).
  - Add field `restoredSwapped` to `finale_k*`, `finale_3_reload_choice`, `finale_5_reload_postgame`, `finale_7_reset`, `finale_r_42`. Record only.
  - Header mentions WP18b.
- prestige.mjs:
  - RUN B `prestige_3_postgame` += `restoredSwapped`, `coreKey`; `prestige_3_after` += the same.
  - `errors.push` when postgame ≠ 33 / `machine.nullCore#restored#rot`, or when after ≠ 0 / `machine.nullCore#rot`.
- README:
  - Line 170 bundle text → `index-*.js app chunk <= 400 KB raw / 130 KB gzip, phaser-*.js <= 1500 KB, *.css <= 40 KB`.
  - WP18 hook list += `restoredTextures()`, `textureKey(id)`.
  - showcase section: 14 PNGs incl. `d_photo_crown`; run order; new A/B/C/D/D2/C2 asserts; warning capture.
  - New "WP18b expectations" paragraph with the C7 table values for finale.mjs (k<30 → 0, k≥30.5 → 33, 3_reload_choice 33, 5_reload_postgame 33, 7_reset 0, r_42 33) and prestige.mjs.
- `node --check` passes for all 3 scripts.

### W2
**T5 Pure swap helper.** Files: `src/game/math/restoredTextures.ts` (new), `src/game/math/restoredTextures.test.ts` (new, co-owned). Depends: T1.
Acceptance:
- C2 exactly; no Phaser import.
- Tests:
  - `restoredComponentIds()` equals the 33-id list (exact order), `Object.isFrozen`, same reference twice.
  - No other component's asset has `restored`.
  - `swapTextureKey`:
    - (nullCore, `machine.nullCore#rot`, true) → `machine.nullCore#restored#rot`; back with false → `machine.nullCore#rot`.
    - (nullCore, `machine.nullCore`, true) → `machine.nullCore#restored`.
    - (ringBead, `machine.ringBead`, true) → `machine.ringBead#restored`; back → `machine.ringBead`.
    - Idempotent on an already-restored key.
    - `has = k => !k.includes('#restored')` → aperture stays `machine.aperture`.
    - (crystal, `machine.crystal`, true, has all) → `machine.crystal`.
  - `isRestoredKey` true/false cases.
  - `frameIndexOfName` with 0, 3, '5', '__BASE', '-1', '1.5', '' → 0, 3, 5, 0, 0, 0, 0.
- `npx vitest run src/game/math/restoredTextures.test.ts` green.

### W3
**T6 Animator wiring.** Files: `src/game/entities/MachineAnimator.ts`. No unit test (Phaser; proven by T8 smokes). Depends: T2, T5.
Acceptance:
- C4 exactly. The diff is limited to imports, 1 field, 1 method, the setFinale line, the 2 reset lines, the gauge hold and doc lines.
- typecheck + `npm test` green; `MachineView.ts` untouched.

**T7 Debug hook probes.** Files: `src/game/debugHook.ts`. Depends: T5.
Acceptance:
- C5 exactly. Two fields appended to the `Window.__wedtmd` type and the object; existing fields untouched.
- Null-safe when the World machine is missing. Typecheck clean.

### W4 (EM Mode B)
**T8 Validate + final shots.** Files: none in the repo (outputs only). Depends: T1–T7.
Acceptance:
- All validation commands pass: errors [] / fail [] everywhere.
- 14 PNGs at 3840×2160 in `.../scratchpad/final-shots/`.
- C7 values hold in the JSONs.
- EM Reads every final-shot PNG and reports a verdict per shot:
  - `a_era5_ruined`: violet core, no chip/HUD.
  - `b_k56`: warm core in FULL.
  - `c_postgame_portrait`: warm lit core, pale rings/arcs/siphons/anchor glows, mint crystal, `RESTORATION ENGINE`.
  - `d_photo_postgame`: no HUD, no chip.
  - `d_photo_crown`: aperture top fully in frame, core near centre, crystal + gallery visible, no chip.
  - `e_teaser_end`: violet, never restored.
- Art Director re-check of `d_photo_crown` / `c_postgame_portrait` (core reads warm at zoom .5; crystal verdict per D5).

**T9 (conditional) Crown framing tune — single owner.** Files: `scripts/smoke/showcase.mjs` (`CROWN` constants only) + README CROWN numbers. Depends: T8. Assign only if the review fails the framing.
- Procedure: change key counts (`up` 5..6, `right` 1..3; zoom stays 1.5, `zoomIn` 4) and recompute the expected centre: `x = 1920 + 64·right`, `y = 1080 − 64·up`.
- Rebuild not needed; rerun showcase.mjs; Read `d_photo_crown.png`.
- Targets: aperture top ≥ 1 art px (3 CSS px) inside the frame, core within ±80 CSS px of the centre, gallery visible.

## Package acceptance / validation commands (Git Bash; preview at :4173 serves dist — rebuild only, never start another server)
```
cd "C:/Users/sanan/OneDrive/Masaüstü/WhatExatlyDoesThisMachineDo"
npm run typecheck
npm test                                   # >= 102 files, >= 2975 + new tests, all pass
npm run build
node scripts/perf/bundle-budget.mjs        # PASS; app raw <= 400 KB (baseline 379.6; WP18b adds <= 4 KB), gzip <= 130
npx vitest run src/assets/manifest.test.ts src/game/math/restoredTextures.test.ts src/data/showcase.test.ts src/game/math/showcase.test.ts src/game/math/teaser.test.ts
grep -rln "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/assets/manifest.ts   # empty
git diff --name-only 69ed967 -- 'src/ui/techTree*' 'src/ui/toasts*' src/ui/hud.ts src/ui/hudView.ts src/ui/hud.css 'src/ui/systemMenu*' src/ui/menu 'src/ui/titleScreen*' src/data/notifications.ts src/data/hud.ts src/data/achievements.ts src/data/steamFx.ts src/data/shell.ts src/assets/painters index.html src/audio src/data/audio.ts src/data/music.ts scripts/smoke/perf.mjs scripts/smoke/perf-budget.json desktop public/assets src/game/scenes src/game/entities/MachineView.ts src/data/machineComponents.ts src/simulation src/persistence   # empty
PW=C:/Users/sanan/AppData/Roaming/npm/node_modules/playwright
S="C:/Users/sanan/AppData/Local/Temp/claude/C--Users-sanan-OneDrive-Masa-st--WhatExatlyDoesThisMachineDo/7775e8fb-b1f6-4c83-880e-d18e41a0468f/scratchpad"
OUT="$S/WP18b"; FINAL="$S/final-shots"
mkdir -p "$OUT/finale" "$OUT/stages" "$OUT/prestige" "$OUT/shell" "$FINAL"
PW_PATH=$PW node scripts/smoke/showcase.mjs "http://localhost:4173/?debug=1" "$FINAL" > "$OUT/showcase.json"   # errors [], 14 shots, C7 values
PW_PATH=$PW node scripts/smoke/finale.mjs "http://localhost:4173/?debug=1" "$OUT/finale" > "$OUT/finale.json"     # errors [], restoredSwapped per C7
PW_PATH=$PW ONLY=s15_era5_full,s16_postgame node scripts/smoke/stages.mjs "http://localhost:4173/?debug=1" "$OUT/stages" > "$OUT/stages.json"   # errors [], parts17 all true
PW_PATH=$PW node scripts/smoke/prestige.mjs "http://localhost:4173/?debug=1" "$OUT/prestige" > "$OUT/prestige.json" # errors [] (new-cycle swap-back asserted)
PW_PATH=$PW node scripts/smoke/shell.mjs "http://localhost:4173/" "$OUT/shell" > "$OUT/shell.json"                # base URL WITHOUT query (README); fail [], errors []
node -e 'const fs=require("fs"),p=process.argv[1];const f=fs.readdirSync(p).filter(n=>n.endsWith(".png"));const bad=f.filter(n=>{const b=fs.readFileSync(p+"/"+n);return b.readUInt32BE(16)!==3840||b.readUInt32BE(20)!==2160});console.log(f.length,"png bad:",bad)' "$FINAL"   # 14 png bad: []
```
The Director sends `$FINAL/*.png` to the user (SendUserFile) after the T8 verdicts.

## Director notes
- Crystal (D5): no code lever beyond the frame 2 hold. If AD rejects it, open an art follow-up (`machine.crystal` restored PNG + manifest row + test-table row).
- Parallel tracks: WP20 (UX) and WP15R (audio/perf) also touch `scripts/smoke/README.md`? WP15R owns perf.mjs/perf-budget.json only. Merge README by hand if it conflicts. App-chunk headroom ~20 KB is shared with WP20.
- WP21: the teaser stays unrestored (ShowcaseScene pushes `restored: false`). The demo never loads a restored look on screen, even though the textures are loaded at boot.
- The Director updates docs/PROJECT_STATUS.md (WP18 row: restored accent v2 + 14 shots).

## Out of scope
- New art or PixelLab, a crystal variant, painter fallbacks for restored keys.
- Lazy-loading restored textures; BootScene size-check of variants (the test covers dims).
- Tween/crossfade for the swap (instant by design).
- HUD/menu/toast/title changes (WP20), audio/perf smoke (WP15R), demo edition (WP21).
- Simulation, balance, save schema, MachineView/WorldScene/ShowcaseScene edits.
