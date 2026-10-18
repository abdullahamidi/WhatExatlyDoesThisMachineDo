# WP8 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP8.md` (contracts C1–C5, tasks T1–T11) + real code read at HEAD `c31b562` (code = `fcbed15` + plan doc). Workers are `implementation-worker` agents (Haiku).
Goal: Era II (Electrical) playable crank -> `substationBlueprint`, with the infra it needs (injectable tech tables, dynamic machine bounds, camera auto-frame, era-tab tech tree). Era I numbers, times and pixels stay identical.
Baseline: 736 tests / 36 files green, typecheck + build clean.
Art: the Art Director has DELIVERED all Era II PNGs (see `docs/plan/ART_ERA2.md`; sizes verified with `file`). **Workers never touch `public/**`.** Manifest entries point at the PNGs directly (no `file: null`); procedural painters (T9b) stay as fallbacks. The Director ACCEPTED contract change requests CR1-CR4, CR6, CR7 (CR5 skipped); they are baked into the contracts below.

## How the Director uses this file

For every worker: spawn `implementation-worker`, paste **(1) the "Common preamble"** (the fenced block) then **(2) exactly one assignment block**. Same-wave workers run in parallel (max 4). Between waves run the wave's own tests (`npx vitest run <files>`) and `npx tsc --noEmit`, compare errors against the transient table, and only then start the next wave.

| Wave | Ids | Workers |
|---|---|---|
| 1 | **T1** Era II data + plaque + logs, **T2** injectable tech tables + greedy harness, **T5** camera maths, **T6** era-tab view model | 4 |
| 2 | **T3** machine/asset/palette/world contract data, **T4** Era II balance sim, **T7** tree DOM tabs, **T8** HUD plaque + crank text | 4 |
| 3 | **T9a** machine rendering (electric driver, frames, cable, 2nd belt), **T9b** fallback art + lit pylons, **T10** camera wiring, **T11** audio + stage smoke | 4 |
| 4 | **T12** world-space cable from the mast to the nearest lit pylon (CR7) | 1 |
| 5 | EM Mode B (validate, one-line glue), Director smoke tests | — |

Dependencies: T3 needs T1 (tech ids). T4 needs T1+T2. T7 needs T6. T8 needs T1. T9a/T9b need T3. T10 needs T5+T3. T11 needs T1. T12 needs T3, T9a, T9b, T10.
Same-wave coupling: T9b (`ParallaxBackground` API) and T10 (`WorldScene` caller) are written against the contracts below; `WorldScene.ts` may fail typecheck until both are done. That is inside one wave and allowed.

### Expected transient tsc errors (not a worker fault)

| After | Allowed to fail typecheck | Runtime-only (typecheck clean) |
|---|---|---|
| W1 | `src/ui/techTree.ts` (T6 renamed `meText`->`headerText`, new `era` arg; fixed by T7 in W2). Nothing else. | none; the 9-count tests are fixed inside W1 by their owners (state.test: T1, systemLogRules.test: T1, progression.test + GameSession.test: T2, techTreeView.test: T6) |
| W2 | `src/game/math/animation.ts` (T3 adds `'electric'` to `AnimationDriver`, so the `driverValue` switch loses its exhaustive return, TS2366; fixed by T9a in W3). Nothing else. | dev build shows the real `bg.pylonsLit` overlay always on (no gating yet), the spark gap never animates, the generator pulley does not turn (driver switch), and the cable links are ignored or mis-drawn by `MachineLinks` (its else-branch treats them as rods). Fixed in W3. |
| W3 | none: `npx tsc --noEmit`, `npm test`, `npm run build` all clean | none |

Any tsc error outside those rows (and outside the files of the running wave) is a real bug. Workers run only their own tests; foreign tsc errors go in NOTES.

## Decisions / deviations from `WP8.md` (deliberate, EM)

1. **Extra test-file owners** (existing tests that hard-code 9 techs / 8..10 logs go red the moment T1 lands): `state.test.ts` and `systemLogRules.test.ts` -> T1; `GameSession.test.ts` -> T2 (one-line change; T2 already owns `progression.test.ts`). Without this W1 ends red.
2. **Manifest points at the delivered PNGs in T3** (all 13 files exist, dimensions verified: generator 96x64, plinth 104x10, pulley 20x20, rotation sheet 180x180 = 9x9 grid of 20x20 with 80 frames, coils 64x40, retrofit 32x16, dynamo 24x24, rack 48x64, spark gap sheet 128x48, transformer 64x64, mast 16x112, pylons-lit 256x256). `machine.pulleyGenerator` gets `rotation: { file: 'machine/era2/rot/pulley-generator-rot.png', frames: 80 }`. The old conditional T12 (path flip) is gone; T12 is now the pylon line.
3. **`fitView` options gain `world: Size`** (needed for "centre clamped in WORLD" without importing `world.ts` into a pure test) and the result zoom is **capped at `defaultZoom`** (a small far-right bounds box must pan, not zoom in). Two additive pure helpers in `camera.ts`: `viewBounds`, `boundsInView`. `machineBounds.ts` gains `boundsToWorld`. `visibleMachineBounds` of an empty set returns the zero box at (0,0).
4. **Crank floating text via the session `click` event** (`HandCrank` subscribes and reads `gainedAll`), so `GameSession.click()` keeps returning `number` and `GameSession.ts` is NOT touched (no caller churn).
5. **Era II camera numbers (corrects WP8.md).** `visibleMachineBounds` is the union of visible boxes, not `MACHINE_BOUNDS`. Real data: era-I left edge -172 (worn motor), top -168 (piston block), mast right edge 444. So: full era II -> zoom 0.75, centre **(1552, 952)** (not 1528); `s8_generator` (right edge 316 -> world 1912, +48 margin = 1960 > 1920) -> zoom **1**, centre **(1424, 952)** (camera panned, not zoomed out). The WP8.md smoke text "s8 zoom < 1" is wrong; this file's smoke steps are authoritative.
6. **Relay replaces the purchase thunk** for era >= 2 purchases (`TECHNOLOGIES[id].era >= 2` -> `playRelay()`, else `playPurchase()`).
7. `pylonsLit` layer: alpha 0.7, no tint, `PARALLAX_FADE_MS = 1500` constant in `world.ts`.
8. T9b `ParallaxBackground` gets `constructor(scene, techLevels)` + `update(techLevels, deltaMs)`; pure helpers `isLayerVisible` / `fadeStep` live in `src/game/math/parallax.ts` (T9b owns it + its test).
9. Risk accepted, not changed: transformer `vibrate` amplitude 0.5 rounds to 0 art px in `vibrateOffset` (`Math.round(0.5*sin)`), so it is visually static. Plan value kept; Director may bump to 1 later.
10. **Accepted Art Director change requests** (supersede WP8.md §C3): CR1 `generatorHub` (228,-22); CR2 `sparkMount` (340,-53); CR3 motor retrofit offset (0,-24); CR4 generator animation `none` (no vibrate, so its shaft, pulley, belt and cable stay attached); CR6 two extra cable links (generator `termR` (284,-68) -> capacitorRack `lugL` (323,-38) sag 4; capacitorRack `lugR` (357,-38) -> transformer `primary` (384,-60) sag 3), which needs an optional per-link `sag` on `MachineLink`; CR7 mast -> pylon line in world space (T12). CR5 (spinning armature) skipped. Camera numbers of decision 5 are unaffected (extents unchanged: left -172, top -168, right 444; s8 right edge 316).

---

# Common preamble (paste before every assignment)

```text
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP8: Era II (Electrical) content + expansion infra. Era I (9 techs) must behave EXACTLY as before: numbers, greedy times (gearRatio 4, wornMotor 13, motorTuning 20, reinforcedCrank 196, flywheel 289, pistonArray 722, improvedPistons 758, generatorBlueprint 1326 s), pixels and strings.

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, anything under public/ (art is produced concurrently by someone else).
- PURE (no 'phaser' import, no `window`/`document`/`AudioContext`): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/game/math/**, src/ui/*View.ts, src/ui/*Rules.ts. DOM files (src/ui/hud.ts, src/ui/techTree.ts) may use `document`/`window` but NEVER import Phaser. `import Phaser from 'phaser'` only in src/game/{entities,rendering,scenes}, src/assets/fallbackTextures.ts, src/assets/painters/painterTypes.ts (type use only).
- All balancing/tuning numbers live in src/data/. No `0x......` colour literals under src/game, src/ui, src/audio (colours come from PALETTE / MACHINE_LINK_STYLE); src/assets/painters use PALETTE only.
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined values in src (a `!` in tests after an asserted lookup is fine).
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM, no Phaser at runtime), `*.test.ts` next to the code, `toBeCloseTo(x, 9)` for floats, avoid -0. Keep every existing test's intent: update to the new shape, never delete coverage.
- ERA-I EXACTNESS: era-I data and arithmetic must not change. Do not reorder additions, do not "simplify" maths.
- Other workers edit OTHER files concurrently or in earlier waves. `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list foreign errors in NOTES. Run only your own tests.
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src (console.warn/info only where the file already does so).
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== FINAL CONTRACTS (exact; every worker codes against these; they are the source of truth) ===

// ---- C1 Tech data: src/data/types.ts, src/data/technologies.ts (T1) ----
TECH_IDS = ['handCrank','gearRatio','reinforcedCrank','flywheel','wornMotor','motorTuning','pistonArray','improvedPistons','generatorBlueprint',
            'generator','copperWinding','motorRetrofit','dynamoCrank','capacitorBank','sparkGap','transformer','powerLines','substationBlueprint'] as const;  // append only
Era II rows (era 2 for all; costRes in the table):
| id | name | kind | branch | costRes | baseCost | growth | maxLevel | effects | requires (in order) | tree col,row |
| generator | Generator | unlock | convergence | me | 25000 | null | null | [{type:'convert',amount:0.5,res:'ee'}] | [tech generatorBlueprint 1] | 0,1 |
| copperWinding | Copper Winding | repeatable | mechanical | ee | 60 | 1.5 | 25 | [{type:'convert',amount:0.25,res:'ee'}] | [tech generator 1] | 1,0 |
| motorRetrofit | Motor Retrofit | repeatable | automation | me | 20000 | 1.35 | 20 | [{type:'autoAdd',amount:15}] | [tech generator 1] | 1,2 |
| dynamoCrank | Dynamo Crank | unlock | origin | ee | 400 | null | null | [{type:'clickEcho',seconds:1,res:'ee'}] | [tech copperWinding 3] | 2,0 |
| capacitorBank | Capacitor Bank | unlock | mechanical | ee | 2500 | null | null | [{type:'rateMult',factor:2,res:'ee'}] | [tech copperWinding 5] | 2,1 |
| sparkGap | Spark Gap | unlock | origin | ee | 10000 | null | null | [{type:'clickMult',factor:3}] | [tech dynamoCrank 1] | 3,0 |
| transformer | Transformer | repeatable | mechanical | ee | 5000 | 1.5 | 20 | [{type:'autoPct',percent:15,res:'ee'}] | [tech capacitorBank 1] | 3,1 |
| powerLines | Power Lines | unlock | automation | ee | 200000 | null | null | [{type:'rateMult',factor:2,res:'me'}] | [tech transformer 3, tech motorRetrofit 5] | 4,2 |
| substationBlueprint | Substation Blueprint | milestone | convergence | ee | 0 | null | null | [{type:'none'}] | [tech powerLines 1, tech sparkGap 1, lifetime ee 4000000] | 5,1 |
Tree positions are unique PER ERA. Save: no version bump (missing techLevels keys already default to 0).

// ---- C2 Simulation (src/simulation, T2) ----
getAllTechViews(state: GameState, techs: Record<TechId, TechDefinition> = TECHNOLOGIES): TechView[]      // TECH_IDS order (NOT TECH_LIST)
evaluateMilestones(state: GameState, techs = TECHNOLOGIES): { state: GameState; unlocked: TechId[] }      // iterate TECH_IDS over `techs`
requirementLabel(req: Requirement, techs = TECHNOLOGIES): string
getTechView(...)  // already has `techs`; must pass it to requirementLabel
interface GreedyOptions { seconds; clicksPerSecond; stepSeconds; buyIntervalSeconds; initial?: GameState; techs?: Record<TechId, TechDefinition> }
   // `techs` is threaded to applyClick/advance/computeRates/purchase/getAllTechViews/evaluateMilestones
interface GreedyResult { firstAt: Record<TechId, number>; maxValue: number; final: GameState; purchases: Array<{ t: number; id: TechId }> }   // successful buys only, in order
export function maxPurchaseGap(purchases: GreedyResult['purchases'], fromT: number, toT: number): number
   // longest interval with no buy inside [fromT, toT]: sort the buy times that lie in [fromT,toT], gaps between consecutive points of [fromT, ...times, toT], return the max.
   // fromT > toT -> 0. Non-finite fromT or toT -> Infinity.

// ---- C3 Machine + assets (src/data/machineComponents.ts, src/assets/{assetIds,manifest}.ts, src/data/{palette,world}.ts) (T3) ----
type AnimationDriver = 'manual' | 'automation' | 'combined' | 'electric';       // electric = rates.perSecond.ee
ComponentAnimation |= { kind: 'frames'; frames: number; maxHz: number; driver: AnimationDriver }
ConnectionPoint.kind: 'belt' | 'pin' | 'cable';   MachineLink.kind: 'belt' | 'rod' | 'cable';   MachineLink += sag?: number   // art px, cable only; default MACHINE_LINK_STYLE.cable.sagArtPx
MACHINE_BOUNDS = { left: -200, right: 448, top: -200, bottom: 8 }
MACHINE_LINK_STYLE.cable = { depth: MACHINE_LAYER_DEPTH.front + 1, core: 0x2f5a62, hi: 0x5fa8b4, sagArtPx: 10 }
PALETTE += cyanDark 0x2f5a62, cyan 0x5fa8b4, cyanLight 0xbff0ec     (PALETTE_CSS gets the same three keys)
CAMERA += fitMarginPx: 48, autoFrame: true          (src/data/world.ts)
export const PARALLAX_FADE_MS = 1500;               (src/data/world.ts)
ParallaxLayerDef += visibleWhen?: { techId: TechId; minLevel: number }
export const PYLON_LINE = { anchorsArt: [{x:159.5,y:59},{x:223.5,y:59},{x:148.5,y:90},{x:234.5,y:90}], sagFraction: 0.06, thicknessPx: 2, depthOffset: 1 } as const;   (src/data/world.ts; anchorsArt = wire attachment points under the insulator strings, art px inside bg.pylonsLit, origin top-left; used by T12)
New PARALLAX_LAYERS entry (appended last, no tint): { id:'pylonsLit', assetId:'bg.pylonsLit', scrollFactor:0.55, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 31, alpha: 0.7, underfill: null, visibleWhen:{techId:'powerLines',minLevel:1} }
New sockets (SOCKET_IDS append in this order): generatorBase(264,0) generatorMount(264,-42) generatorHub(228,-22) dynamoMount(70,-36) rackBase(340,0) sparkMount(340,-53) transformerBase(396,0) mastBase(436,0)
New components (MACHINE_COMPONENT_IDS append in this order; layer/bias = layer and depthBias):
| id | techId>=lvl | assetId | size | origin | socket+offset | layer/bias | animation | connections |
| generatorPlinth | generator 1 | machine.generatorPlinth | 104x10 | .5,1 | generatorBase | mid/0 | none | - |
| generator | generator 1 | machine.generator | 96x64 | .5,.5 | generatorMount | mid/1 | none (CR4: no vibrate) | termR (20,-26) cable |
| generatorPulley | generator 1 | machine.pulleyGenerator | 20x20 | .5,.5 | generatorHub | mid/5 | driven ratio -1.75 phase 0 | belt (0,0) belt r8 |
| coilStage1 | copperWinding 1 | machine.coils1 | 64x40 | .5,.5 | generatorMount | mid/2 | none | - |
| coilStage2 | copperWinding 10 | machine.coils2 | 64x40 | .5,.5 | generatorMount | mid/3 | none | - |
| coilStage3 | copperWinding 20 | machine.coils3 | 64x40 | .5,.5 | generatorMount | mid/4 | none | - |
| motorRetrofitKit | motorRetrofit 1 | machine.motorRetrofit | 32x16 | .5,.5 | motorMount +(0,-24) | mid/3 | vibrate automation amp 1 speed{8,.3,2,20} | - |
| crankDynamo | dynamoCrank 1 | machine.dynamo | 24x24 | .5,.5 | dynamoMount | frame/2 | vibrate manual amp 1 speed{8,.3,2,20} | - |
| capacitorRack | capacitorBank 1 | machine.capacitorRack | 48x64 | .5,1 | rackBase | mid/0 | none (effect glow electric thr 1 int .5) | lugL (-17,-38) cable, lugR (17,-38) cable |
| sparkGap | sparkGap 1 | machine.sparkGap | 32x48 | .5,1 | sparkMount | mid/6 | frames 4, maxHz 3, driver electric | - |
| transformer | transformer 1 | machine.transformer | 64x64 | .5,1 | transformerBase | mid/0 | vibrate electric amp .5 speed{6,.3,2,12} | primary (-12,-60) cable, bushing (16,-60) cable |
| cableMast | powerLines 1 | machine.cableMast | 16x112 | .5,1 | mastBase | back/0 | none | top (0,-108) cable |
Existing component change: flywheelPulley gets a second connection { id:'belt2', at:{x:0,y:0}, kind:'belt', radius:12 } (appended). Everything else of era I byte-identical.
New links (append, in this order): belt flywheelPulley.belt2 -> generatorPulley.belt ; cable generator.termR -> capacitorRack.lugL sag 4 ; cable capacitorRack.lugR -> transformer.primary sag 3 ; cable transformer.bushing -> cableMast.top (no sag = style default 10).
Connection points `at` are offsets from the component pivot (attach point), as for all existing points.
New asset ids (ASSET_IDS append after 'fx.steam', this order): 'bg.pylonsLit','machine.generatorPlinth','machine.generator','machine.pulleyGenerator','machine.coils1','machine.coils2','machine.coils3','machine.motorRetrofit','machine.dynamo','machine.capacitorRack','machine.sparkGap','machine.transformer','machine.cableMast'.
Manifest entries (files DELIVERED, set `file` directly; `width`,`height`,`origin`,`tileable` as listed): bg.pylonsLit file 'bg/pylons-lit.png' 256x256 origin 0,1 tileable 'x'; machine.generatorPlinth 'machine/era2/generator-plinth.png' 104x10 (.5,1); machine.generator 'machine/era2/generator.png' 96x64; machine.pulleyGenerator 'machine/era2/pulley-generator.png' 20x20 with rotation { file: 'machine/era2/rot/pulley-generator-rot.png', frames: 80 } (sheet is 180x180 = 9x9 grid); machine.coils1/2/3 'machine/era2/coils-1.png' / 'coils-2.png' / 'coils-3.png' 64x40; machine.motorRetrofit 'machine/era2/motor-retrofit.png' 32x16; machine.dynamo 'machine/era2/dynamo.png' 24x24; machine.capacitorRack 'machine/era2/capacitor-rack.png' 48x64 (.5,1); machine.sparkGap 'machine/era2/spark-gap.png' width 128 height 48 frame {width:32,height:48,count:4} origin (.5,1); machine.transformer 'machine/era2/transformer.png' 64x64 (.5,1); machine.cableMast 'machine/era2/cable-mast.png' 16x112 (.5,1). (All paths relative to public/assets/ and verified to exist.)
export function sheetFrameRects(entry: AssetEntry): Array<{ x: number; y: number; width: number; height: number }>   // manifest.ts; [] without `frame`; else `count` rects row-major, cols = floor(entry.width / frame.width)

// ---- C4 Camera (src/game/math/camera.ts + machineBounds.ts, T5; wired by T10) ----
export interface Bounds { left: number; top: number; right: number; bottom: number }          // camera.ts
export function viewBounds(center: Vec2, zoom: number, view: Size): Bounds                    // center +- view/(2*zoom)
export function boundsInView(b: Bounds, view: Bounds, margin: number): boolean                // b expanded by margin lies inside view (edges inclusive)
export function fitView(b: Bounds /* world px */, view: Size, o: { margin: number; pixelScale: number; minZoom: number; maxZoom: number;
  defaultZoom: number; defaultCenter: Vec2; world: Size }): { center: Vec2; zoom: number }
   // d = clampCenter(defaultCenter, defaultZoom, view, world). If boundsInView(b, viewBounds(d, defaultZoom, view), margin) -> { center: d, zoom: defaultZoom }.
   // else fit = min(view.width/(bw+2m), view.height/(bh+2m)); zoom = clampZoom(floor(fit/step + 1e-9)*step, minZoom, min(maxZoom, defaultZoom)) with step = zoomStep(pixelScale);
   // center = clampCenter(centre of b, zoom, view, world)
machineBounds.ts: visibleMachineBounds(techLevels: Readonly<Record<TechId, number>>, components: Readonly<Record<MachineComponentId, MachineComponentDefinition>> = MACHINE_COMPONENTS): Bounds
   // art px union of componentBounds() of components with isComponentVisible(); nothing visible -> {left:0,top:0,right:0,bottom:0}; iterate Object.values(components)
machineBounds.ts: boundsToWorld(b: Bounds, anchor: Vec2 = MACHINE_ANCHOR, scale: number = PIXEL_SCALE): Bounds     // anchor + b*scale per axis

// ---- C5 Tree tabs / plaque / crank text (T6, T1, T8) ----
src/ui/techTreeView.ts:
  interface EraTabView { era: number; label: string; reached: boolean; selected: boolean; resourceText: string }
  reachedEras(views: readonly TechView[]): number[]       // ascending; era 1 always; era n>1 when any era-n view has status !== 'locked'
  buildEraTabs(views: readonly TechView[], res: Readonly<ResourceMap>, selectedEra: number): EraTabView[]
     // one tab per era PRESENT in views (ascending). reached: label `ERA ${roman} · ${short}` (roman I..V; short of the era's resource, i.e. RESOURCE_IDS.find(id => RESOURCES[id].era === era) ?? 'me'), resourceText `${formatNumber(res[eraRes])} ${short}`;
     // not reached: label 'SIGNAL ?', resourceText ''. selected = era === selectedEra.
  buildTechTreeView(views /* ALREADY filtered to one era */, res, selected: TechId | null, era: number, layout = TECH_TREE_LAYOUT): TechTreeView
     // TechTreeView.meText is RENAMED headerText = `${formatNumber(res[eraRes])} ${short}` ("0 ME" for era I). Node x/y relative to the smallest col/row of the given views (era I: col 0 row 0 so geometry unchanged).
     // edges whose source tech is not in `views` are dropped (the requirement still shows in the detail).
  defaultSelection(views): unchanged behaviour; final fallback = 'handCrank' if present in views, else views[0]?.id ?? 'handCrank'.
src/data/story.ts (T1):  export interface PlaqueLine { milestone: TechId | null; text: string }
  export const PLAQUE_LINES: readonly PlaqueLine[] = [{ milestone: null, text: 'PRIMARY FUNCTION: UNKNOWN' }, { milestone: 'generatorBlueprint', text: 'PRIMARY FUNCTION: R?S????' }, { milestone: 'substationBlueprint', text: 'PRIMARY FUNCTION: RES?OR?' }]
src/ui/hudView.ts (T8):
  plaqueText(techLevels: Readonly<Record<TechId, number>>): string      // text of the LAST PLAQUE_LINES entry that is owned (milestone === null or techLevels[milestone] >= 1)
  HudView += plaque: string
  buildHudView(state: Pick<GameState, 'res' | 'lifetime' | 'techLevels'>, rates): HudView     // plaque = plaqueText(state.techLevels)
  clickGainText(gainedAll: Readonly<ResourceMap>): string
     // parts = RESOURCE_IDS with finite value > 0. If no part other than 'me' -> `+${formatNumber(gainedAll.me)}` (today's text, "+0" when all zero).
     // else parts.map(id => `+${formatNumber(v)} ${RESOURCES[id].short}`).join('  ')  (two spaces), e.g. "+32 ME  +1.2K EE"; ME zero + EE only -> "+1.2K EE".

// ---- Rendering / audio contracts added by the EM ----
src/game/math/animation.ts (T9a):  driverValue(driver, manual, automation, electric = 0): number   // 'electric' -> electric
                                   framesIndex(t: number, frames: number, maxHz: number, active: boolean): number   // 0 if !active, frames<2, maxHz<=0, t<0 or non-finite; else Math.floor(t*maxHz) % frames
src/game/math/machineLinks.ts (T9a): rasterCable(a: Vec2, b: Vec2, sag: number): Vec2[]
   // ordered a -> b; first = round(a), last = round(b) exactly; y(t) = a.y + (b.y-a.y)*t + 4*sag*t*(1-t), t = (x-a.x)/(b.x-a.x), sampled per integer x; consecutive samples joined with rasterLine so no gap; consecutive duplicates dropped; a.x===b.x -> rasterLine(a,b); non-finite -> [].
   // lowest (max y) point is at mid x with y = round(midY + sag).
src/game/rendering/ParallaxBackground.ts (T9b): constructor(scene: Phaser.Scene, techLevels: Readonly<Record<TechId, number>>); update(techLevels: Readonly<Record<TechId, number>>, deltaMs: number): void; destroy(): void
src/game/math/parallax.ts (T9b): isLayerVisible(def: { visibleWhen?: { techId: TechId; minLevel: number } }, techLevels: Readonly<Record<TechId, number>>): boolean   // no visibleWhen -> true
                                 fadeStep(current: number, target: number, deltaMs: number, fadeMs: number): number    // move toward target by deltaMs/fadeMs per call (linear), never overshoot, result in [0,1]; fadeMs<=0 -> target; non-finite deltaMs -> current
src/game/rendering/CameraController.ts (T10): constructor(scene: Phaser.Scene, session: GameSession); refocus(): void; destroy(): void   // subscribes to session purchase/unlock/reset itself
src/game/debugHook.ts (T11): window.__wedtmd.cameraState(): { zoom: number; centerX: number; centerY: number }
src/data/audio.ts (T11) additions:
   mains: { hz: 50, harmonicHz: 100, harmonicGain: 0.5, minGain: 0.02, maxGain: 0.09, refPerSecond: 1, maxPerSecond: 5000 }
   arc: { minRate: 0.5, maxRate: 3, refPerSecond: 1, maxPerSecond: 5000, ms: 40, gain: 0.25, highpassHz: 1800 }
   relay: { hz: 1200, ms: 18, gapMs: 55, gain: 0.35 }
src/audio/audioMath.ts (T11): mainsGain(eePerSecond: number, cfg = AUDIO.mains): number   // 0 when !(ee>0) else lerp(minGain,maxGain, activityLevel(ee, ref, max))
                              arcRate(eePerSecond: number, sparkOwned: boolean, cfg = AUDIO.arc): number   // 0 when !sparkOwned or !(ee>0), else lerp(minRate,maxRate,level), always <= maxRate (3)
src/audio/synth.ts (T11): Synth += setMains(gain: number): void; scheduleArcs(perSecond: number): void; playRelay(): void
```

---

# WAVE 1 (parallel: T1, T2, T5, T6 — disjoint files; repo green at start)

## T1 — Era II data, plaque data, logs, install lines

**wave**: 1. **files_owned**: `src/data/types.ts`, `src/data/technologies.ts`, `src/data/technologies.test.ts`, `src/data/notifications.ts`, `src/data/systemLogs.ts`, `src/data/story.ts` (new), `src/simulation/state.test.ts`, `src/ui/systemLogRules.test.ts`

**objective**: Land the C1 table and story data; keep every era-I value byte-identical; keep the two foreign tests that hard-code counts green.

**context**: read all eight files first (`git show HEAD:src/data/technologies.ts` is the era-I reference).
- `types.ts`: only append the nine ids to `TECH_IDS`. Nothing else changes.
- `technologies.ts`: append nine definitions (keys in TECH_IDS order) per C1 (`era: 2`, `costRes` per table, `flavor` only where given, `tree` per table). Do not touch the nine era-I entries. Texts (use exactly):
  - generator: description `A coil and a magnet. Converts motion into current.`, flavor `Current detected. Destination: unlisted.`
  - copperWinding: `Tighter copper turns. More EE from the same motion.`
  - motorRetrofit: `The old motor, rewired. +15 ME/s per level.`
  - dynamoCrank: `The crank now feeds a dynamo. Clicks echo current.`
  - capacitorBank: `Stores a surge and releases it later. Doubles EE production.`
  - sparkGap: `A gap that should not conduct. It does. Triples manual production.`
  - transformer: `Steps voltage. Nobody specified which way. +15% EE per level.`
  - powerLines: `Lines run toward nothing. Doubles ME production.`
  - substationBlueprint: description `The machine has begun to resemble a grid node.`, flavor `Grid handshake... no response from grid.`
- `notifications.ts`: add nine `INSTALL_LINES` entries (each <= 60 chars; those with a flavor are IDENTICAL to the flavor): generator `Current detected. Destination: unlisted.`; copperWinding `Winding count exceeds the drawing.`; motorRetrofit `Motor accepted the retrofit. Motor did not ask.`; dynamoCrank `Crank now yields something besides effort.`; capacitorBank `Charge stored. Reason for storage: pending.`; sparkGap `Discharge observed. Observers: none.`; transformer `Voltage changed. Ratio chosen by something.`; powerLines `Conductors raised toward a grid. Grid: not found.`; substationBlueprint `Grid handshake... no response from grid.`
- `systemLogs.ts`: append three entries at the END of `SYSTEM_LOGS` (ids `grid-handshake`, `load-beneath`, `copper-memory`), triggers `{ kind: 'lifetime', res: 'ee', atLeast: 1000 | 100000 | 1000000 }`, texts `Grid handshake sent. No grid answered.` / `Load detected 4 km beneath the surface.` / `Copper remembers a current older than the copper.` Existing entries untouched.
- `story.ts`: `PlaqueLine` and `PLAQUE_LINES` from C5 (imports the `TechId` type only).
- `state.test.ts`: the hard-coded `toHaveLength(9)` becomes `TECH_IDS.length`; nothing else.
- `systemLogRules.test.ts`: (1) table-size test becomes 8..12 entries (title updated). (2) the `seedTracker` test with `me: 1e9`: use `logState(T0, { me: 1e9, ee: 1e9 })` so `later.shown.size === SYSTEM_LOGS.length`. (3) "never marks a lifetime-ME entry from non-ME lifetime alone": keep the ME assertions, replace `shown.size toBe 0` with `shown.size ===` the number of table entries whose trigger is `lifetime` on `ee`/`pr`/`rs`/`xf` (derive from the table; `ee: 1e12` meets the ee entries). (4) every `ahead = logState(T0, { me: 1e9 })` in the `nextSystemLog` tests becomes `{ me: 1e9, ee: 1e9 }` so "never repeats over 50 calls" still sees `SYSTEM_LOGS.length` entries (50 calls >= 12). Keep all other cases.
- `technologies.test.ts`: `TECH_LIST toHaveLength(9)` -> 18; keep all old tests; add:
  1. Era-II table exact: a literal table (id -> kind, era, costRes, baseCost, growth, maxLevel, tree, branch, effects, requires) equal to C1.
  2. Era-I rows byte-identical: inline literal objects for the nine era-I definitions copied from `git show HEAD:src/data/technologies.ts`, compared with `toEqual`.
  3. Every tech reachable from `handCrank` (BFS: reachable when all its `tech` requirements are reachable; lifetime requirements ignored). The existing acyclic test already covers all ids.
  4. Tree positions unique per era (`${era}:${col},${row}`).
  5. `TECH_LIST` order equals `TECH_IDS`; era is 1 or 2; costRes `ee` only on era II; `PLAQUE_LINES`: first entry `milestone === null`, other milestones exist in `TECHNOLOGIES` with `kind === 'milestone'`, three entries in C5 order with exact texts.

**constraints**: pure data; no Phaser/DOM; no `any`; do not edit balance.ts or any other file. Era-I values byte-identical.

**acceptance**: C1 table exact; INSTALL_LINES complete (`notificationRules.test.ts` and `systemLogRules.test.ts` green, texts unique and <= 60 chars); `PLAQUE_LINES` as C5.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation/state.test.ts src/ui/systemLogRules.test.ts src/ui/notificationRules.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/data|^src/simulation/state" && echo FAIL || echo OK     # src/ui/techTree.ts may fail from T6: ignore
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/types.ts src/data/technologies.ts src/data/notifications.ts src/data/systemLogs.ts src/data/story.ts && echo FAIL || echo OK
```

## T2 — Injectable tech tables + greedy harness

**wave**: 1. **files_owned**: `src/simulation/progression/status.ts`, `src/simulation/progression/milestones.ts`, `src/simulation/progression/requirements.ts`, `src/simulation/progression/progression.test.ts`, `src/simulation/sim/greedy.ts`, `src/simulation/sim/greedy.test.ts` (new), `src/simulation/GameSession.test.ts`

**objective**: C2 exactly. Defaults keep every existing call site compiling and behaving identically.

**context**: read all files plus `src/simulation/balance.sim.test.ts` (NOT yours; it must keep compiling against `runGreedy`).
- `status.ts`: `getAllTechViews(state, techs = TECHNOLOGIES) => TECH_IDS.map((id) => getTechView(state, id, techs))` (import `TECH_IDS` from `../../data/types`; drop `TECH_LIST` if unused). `getTechView` passes `techs` to `requirementLabel`.
- `requirements.ts`: `requirementLabel(req, techs = TECHNOLOGIES)`; the tech branch uses `techs[req.id]`. Default output identical.
- `milestones.ts`: `evaluateMilestones(state, techs = TECHNOLOGIES)`; loop `for (const id of TECH_IDS) { const def = techs[id]; ... }`; same returns (same reference when nothing unlocks).
- `greedy.ts`: add `techs?` to `GreedyOptions` and thread it everywhere C2 lists (`const techs = o.techs ?? TECHNOLOGIES`); add `purchases` to the result (push `{ t, id: pick.id }` only when `purchase(...).ok`); add `maxPurchaseGap` per C2. Buy policy, order, 1e-9 tolerances and all arithmetic stay exactly as they are (era-I greedy times must not move).
- `progression.test.ts`: `views.length toBe(9)` becomes `TECH_IDS.length`. `GameSession.test.ts`: `getAllTechViews()).toHaveLength(9)` becomes `TECH_IDS.length` (import it if needed). Keep every other case.

**acceptance** (tests):
- progression.test: `getAllTechViews(state, techs)` with an injected table (spread `TECHNOLOGIES`; give `generatorBlueprint` the requirements `[{type:'lifetime',res:'me',amount:100}]`) reflects that table; `evaluateMilestones(state, techs)` unlocks `generatorBlueprint` at `lifetime.me = 100` while the default table does not; `requirementLabel(req, techs)` uses an injected tech name (override `gearRatio.name`).
- greedy.test.ts (new): default `runGreedy` (600 s, 4 cps, 1 s) still has `firstAt.wornMotor === 13`; with the cheaper-blueprint table a 2000 s run has a smaller `firstAt.generatorBlueprint` than the default run; `purchases` is time-ordered, contains no milestone and no time above `seconds`, and the count of each id equals `final.techLevels[id]` for non-starting non-milestone techs; `maxPurchaseGap`: no buys -> `toT - fromT`; one buy in the middle; buys outside the window ignored; buys exactly at the ends; `fromT > toT` -> 0; `toT = Infinity` -> Infinity.
- Existing tests green; era-I exact times unchanged (run `balance.sim.test.ts` as a regression check, it must pass).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation
npx tsc --noEmit 2>&1 | grep -E "^src/simulation" && echo FAIL || echo OK
grep -nE "from ['\"](phaser|vitest)['\"]|\b(window|document)\b|console\.|\bany\b" src/simulation/sim/greedy.ts src/simulation/progression/status.ts src/simulation/progression/milestones.ts src/simulation/progression/requirements.ts && echo FAIL || echo OK
```

## T5 — Camera maths

**wave**: 1. **files_owned**: `src/game/math/camera.ts`, `src/game/math/camera.test.ts`, `src/game/math/machineBounds.ts` (new), `src/game/math/machineBounds.test.ts` (new)

**objective**: C4 pure maths. No Phaser; `camera.ts` must not import `src/data/world.ts` constants (options are passed in).

**context**: read `camera.ts`, `camera.test.ts`, `machineLayout.ts` (`componentBounds`, `isComponentVisible`), `machineLayout.test.ts`. Existing exports stay byte-identical.
- `camera.ts`: add `Bounds`, `viewBounds`, `boundsInView`, `fitView` per C4 using the existing `clampCenter`, `clampZoom`, `zoomStep`. Float safety: `Math.floor(fit / step + 1e-9) * step`.
- `machineBounds.ts`: `visibleMachineBounds`, `boundsToWorld` per C4. `components` typed `Readonly<Record<MachineComponentId, MachineComponentDefinition>>`; iterate `Object.values(components)`. Use `componentBounds(def)` and `isComponentVisible(def, techLevels)` from `./machineLayout`. Import `MACHINE_ANCHOR`, `PIXEL_SCALE` from `../../data/world`.

**acceptance** (tests; use only data that exists today, i.e. era-I ids, plus synthetic component tables built by spreading `MACHINE_COMPONENTS` and overriding one entry, e.g. a wide `wornMotor` with `attach.offset.x = 400`):
- `fitView`: bounds inside the default view -> `{ center: clamped default, zoom: defaultZoom }`; era-I full bounds (`visibleMachineBounds` with every era-I tech at its max, through `boundsToWorld`) -> the default view for 1280x720 view, 2560x1440 world, margin 48, pixelScale 2, minZoom 0.5, maxZoom 2, default zoom 1, default centre (1280, 960); a 1232-wide bounds -> zoom 0.75; small far-right bounds -> zoom == defaultZoom (cap) and centre = bounds centre; bounds wider than the world -> zoom == minZoom; centre clamped inside the world (bounds at the world edge); result zoom is always k*step.
- `boundsInView`: inside, exactly on the margin edge (true), 1 px outside (false); `viewBounds` symmetrical about the centre.
- `visibleMachineBounds`: initial techLevels -> union of frame, bearingP and handCrank boxes: left -100, right 100, top -110, bottom 0 (verify by hand from the table); adding `wornMotor: 1` extends left to -172; empty or all-hidden table -> zero box; single component -> its own box. `boundsToWorld` with anchor (1280, 1120), scale 2 -> `anchor + 2*b`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math
npx tsc --noEmit 2>&1 | grep -E "^src/game/math" && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/game/math/camera.ts src/game/math/machineBounds.ts && echo FAIL || echo OK
```

## T6 — Era-tab view model

**wave**: 1. **files_owned**: `src/ui/techTreeView.ts`, `src/ui/techTreeView.test.ts`

**objective**: C5 view model (tabs, per-era tree, per-era header). `src/ui/techTree.ts` (T7, W2) fails typecheck until then: expected.

**context**: read both files. Implement `reachedEras`, `buildEraTabs`, `EraTabView`, the new `buildTechTreeView(views, res, selected, era, layout)` (rename `meText` -> `headerText`), the `defaultSelection` fallback and the min-col/min-row offset exactly as in C5. `TechTreeView.width/height` use the span `(maxCol - minCol)` / `(maxRow - minRow)`; for era I identical to today. `purchaseFailureText` and all era-I strings unchanged.
- **Tests must not depend on T1 landing** (T1 runs in parallel): era-II scenarios use an injected table (`{ ...TECHNOLOGIES, wornMotor: { ...TECHNOLOGIES.wornMotor, era: 2, costRes: 'ee', tree: { col: 3, row: 0 } }, motorTuning: { ...era 2, col 4 } }` and views via `getTechView(state, id, techs)`). Any real-data assertion concerns era I only (`views.filter((v) => v.def.era === 1)`).

**acceptance** (tests):
- Existing nodes/edges/detail tests converted to `buildTechTreeView(eraOneViews, res, selected, 1)`; era-I node x/y, width/height, 9 nodes, tech edges and every old string unchanged; `headerText` is `'0 ME'` / `'1.5K ME'`.
- `reachedEras`: fresh state -> `[1]`; injected table with an available era-II tech -> `[1, 2]`; era-II locked -> `[1]`.
- `buildEraTabs`: fresh -> one tab `ERA I · ME` (reached, selected, resourceText `0 ME`); injected era II locked -> second tab label `SIGNAL ?`, `reached false`, `resourceText ''`; reached -> `ERA II · EE` with `res.ee` formatted (`1.2K EE`); `selected` follows the argument; tabs ascending and only for eras present in the views.
- Era-II tree (injected): layout starts at col 0 (cols 3 and 4 shift to 0 and 1, node x of the first equals `padding`), edges from a tech in another era dropped while `detail.requirements` still lists them, `headerText` uses `res.ee`.
- `defaultSelection`: era I unchanged; a list without `handCrank` and nothing available -> first view id.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/techTreeView.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/ui/techTreeView" && echo FAIL || echo OK     # src/ui/techTree.ts errors expected until T7
grep -nE "from ['\"]phaser|innerHTML|\b(window|document)\b" src/ui/techTreeView.ts && echo FAIL || echo OK
```

---

# WAVE 2 (parallel: T3, T4, T7, T8 — disjoint files; wave 1 done and green)

## T3 — Machine + asset + palette + world contract data

**wave**: 2. **files_owned**: `src/data/machineComponents.ts`, `src/data/machineComponents.test.ts`, `src/data/palette.ts`, `src/data/palette.test.ts`, `src/data/world.ts`, `src/data/world.test.ts`, `src/assets/assetIds.ts`, `src/assets/manifest.ts`, `src/assets/manifest.test.ts`

**objective**: C3 exactly (including the accepted CRs), data and tests only. Manifest entries point at the delivered PNGs.

**context**: read all nine files first. Implement:
1. `machineComponents.ts`: widen `AnimationDriver`, `ComponentAnimation` (`frames`), `ConnectionPoint.kind`, `MachineLink.kind`, and add optional `sag?: number` to `MachineLink`; `MACHINE_BOUNDS`; append the 8 socket ids to `SOCKET_IDS` and positions to `MACHINE_SOCKETS`; append the 12 component ids; add the 12 definitions per the C3 table (`attach: { socket, offset }`, `effects: []` unless the table says glow; comments in the file's style); add `{ id: 'belt2', at: { x: 0, y: 0 }, kind: 'belt', radius: 12 }` to `flywheelPulley.connections`; append the four links of C3 (one belt, three cables; the two CR6 cables carry `sag: 4` and `sag: 3`); add `cable` to `MACHINE_LINK_STYLE` (keep `as const`). The generator has `animation: { kind: 'none' }` and `effects: []`. Era-I definitions otherwise byte-identical. `MACHINE_SHADOWS` unchanged.
2. `palette.ts`: three cyan keys in `PALETTE` and `PALETTE_CSS` (`css(...)` like the others).
3. `world.ts`: `PYLON_LINE` (C3); `CAMERA.fitMarginPx: 48, autoFrame: true`; `PARALLAX_FADE_MS = 1500`; `visibleWhen?` on `ParallaxLayerDef` (`import type { TechId } from './types'`); the `pylonsLit` layer from C3 as the LAST element of `PARALLAX_LAYERS`.
4. `assetIds.ts`: append the 13 ids. `manifest.ts`: 13 entries with the delivered `file` paths from C3 (one-sentence `description` each), `machine.pulleyGenerator` with `rotation`, `machine.sparkGap` with `frame: { width: 32, height: 48, count: 4 }` and width 128 / height 48; add and export `sheetFrameRects` (C3). Verify every path exists before finishing: `test -f public/assets/<file>` and `file` shows the manifest width x height (the rotation sheet is 180 x 180).
5. Tests:
 - `machineComponents.test.ts`: 29 components and 17 sockets; canonical order list extended (era-I prefix unchanged); every box inside the new `MACHINE_BOUNDS`; every socket used; the era-I `levelsForPrefix` helper unchanged plus a new era-II helper (all era-I techs maxed, then era-II techs in the order `generator, copperWinding (1/10/20 levels), motorRetrofit, dynamoCrank, capacitorBank, sparkGap, transformer, powerLines`) for new prefix tests: `generatorPulley` visible => `flywheelPulley` visible; `coilStage3` => `coilStage2` => `coilStage1`; `cableMast` => `transformer`; `motorRetrofitKit` => `wornMotor`; cable links join two `cable` points; the existing belt `|ratio|*radius` test covers `belt2`; `generatorPulley` is exempt from "driven part sits on a support" exactly like `motorPulley`, plus a new test "generatorPulley is carried by the generator bounding box"; coil stages have identical `size`, `origin` and attach (each higher stage fully covers the lower); link techs ordered by requirement (existing generic test); sparkGap animation has `kind 'frames'`, `frames 4`, `maxHz <= 3`, `driver 'electric'`; generator animation is `none`; cable links: exactly 3, each joins two `cable` points, the CR6 ones carry `sag` 4 and 3, `generator.termR`, `capacitorRack.lugL/lugR`, `transformer.primary/bushing`, `cableMast.top` all exist; `generatorHub` is (228,-22) and `sparkMount` (340,-53); the spark gap box bottom is y = -53 (the rack top plate) and its x range 324..356 lies inside the rack x range 316..364; the `motorRetrofitKit` box bottom is y = -43 and its x range lies inside the worn motor x range; the 17 era-I component definitions deep-equal a literal snapshot copied from `git show HEAD:src/data/machineComponents.ts`, EXCEPT the added `belt2` connection on `flywheelPulley` (assert that separately).
 - `palette.test.ts`: spot values for the three cyan keys; keys equal `PALETTE`.
 - `world.test.ts`: `pylonsLit` last, `visibleWhen` powerLines level 1, no tint, alpha 0.7, depth `DEPTH.background + 31`, same scrollFactor and bottomY as `pylons`; existing "no tint except pylons" and unique-id tests pass; `CAMERA.fitMarginPx === 48`, `autoFrame === true`; `PARALLAX_FADE_MS === 1500`; `PYLON_LINE.anchorsArt` has 4 points inside 0..256, `sagFraction > 0`, `thicknessPx >= 1`.
 - `manifest.test.ts`: dims test compares the FRAME size to the component size when the entry has `frame`, else the entry size; contract-dimension test extended with the 12 machine ids; rotation tests: the rotation ids are now exactly the nine WP6 ids plus `machine.pulleyGenerator` (ten), the existing png/frames checks cover it, and the `#rot` url prefix check accepts `assets/machine/rot/` and `assets/machine/era2/rot/`; `bg.pylonsLit` tileable `'x'` with power-of-two width; `sheetFrameRects`: no frame -> `[]`, `machine.sparkGap` -> 4 rects at x 0,32,64,96 each 32x48, row-major wrap (synthetic 64x64 entry, 32x32 frames, count 4 -> (0,0),(32,0),(0,32),(32,32)); the test "loads exactly the file-backed entries as images" must exclude the spritesheet entry (`machine.sparkGap`, which plans as `kind: 'spritesheet'` with frame 32x48x4); every new entry has a non-null `file` that exists on disk (existing glob test).

**constraints**: pure data; `import type` for types; do not edit era-I values; no `any`.

**acceptance**: C3 exactly (12 components, 8 sockets, 4 new links, `MACHINE_BOUNDS`, cyan palette, `pylonsLit` layer + `visibleWhen`, `PYLON_LINE`, 13 asset ids with real files); updated invariants pass; `npx tsc --noEmit` shows only the allowed `src/game/math/animation.ts` error.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/assets
npx tsc --noEmit 2>&1 | grep -vE "^src/game/math/animation.ts" | grep -E "^src/" && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/data/machineComponents.ts src/data/palette.ts src/data/world.ts src/assets/assetIds.ts src/assets/manifest.ts && echo FAIL || echo OK
```

## T4 — Era II balance sim

**wave**: 2. **files_owned**: `src/simulation/balance.sim.test.ts`, `src/data/technologies.ts` (era-II NUMBERS only), `src/data/technologies.test.ts` (matching era-II expectations only)

**objective**: prove the Era II pacing targets with the T2 harness; retune only numbers if needed.

**context**: read `balance.sim.test.ts`, `greedy.ts` (T2 result: `purchases`, `maxPurchaseGap`), `technologies.ts`. Starting values are the C1 table (from a prototype; the real harness may differ slightly).
- Rewrite `balance.sim.test.ts` keeping every existing era-I test (3600 s block, exact era-I times, determinism, interval-30 monotonicity, `initial` honoured, 10-s clicks test, `maxValue < DESIGN_MAX_VALUE`). The main run becomes `seconds: 7200` (era-I times unaffected); `console.table` lists ALL 18 techs (`TECH_IDS`, mm:ss, `never` for Infinity).
- Profiles (one `runGreedy` each in `beforeAll`, `stepSeconds: 1`): A greedy `4 cps, buyIntervalSeconds 1, 7200 s` (the main run); B `4 cps, buy 30 s, 7200 s`; C casual `1 cps, buy 30 s, 14400 s`, no offline.
- Tests that must hold: A `firstAt.generator` in [1500, 2100] and `firstAt.substationBlueprint` in [3300, 4500]; B `substationBlueprint` <= 5400; C `substationBlueprint` <= 10800; `maxPurchaseGap(result.purchases, result.firstAt.generatorBlueprint, result.firstAt.substationBlueprint)` <= 1200 for A, B and C; every era-II tech has a finite `firstAt` in A; `maxValue` finite and `< DESIGN_MAX_VALUE` for A, B, C; A is deterministic (two runs deep-equal `firstAt` and `purchases`). The whole file must run in < 10 s (check the vitest summary duration; keep profiles cheap).
- If a window is missed: retune only numbers in the era-II rows of `technologies.ts` (`baseCost`, `growth`, `maxLevel`, numeric fields inside `effects`, `minLevel` / `amount` inside `requires`) and the same numbers in the era-II table test of `technologies.test.ts` (expected values only). Never change ids, kinds, costRes, tree, branch, names, texts, requirement structure or any era-I row. Never edit the expected windows to make a test pass. If numbers alone cannot reach the windows STOP and report the measured mm:ss tables for A, B, C.

**acceptance**: all assertions above green; final era-II numbers listed in the report (the Director copies them into PROJECT_STATUS).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/balance.sim.test.ts src/data/technologies.test.ts --silent=false 2>&1 | grep -E "mm:ss|handCrank|gearRatio|reinforced|flywheel|wornMotor|motorTuning|pistonArray|improved|generator|copper|motorRetrofit|dynamo|capacitor|spark|transformer|powerLines|substation|passed|failed|Duration"
git diff --stat -- src/data/technologies.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(simulation|data)" && echo FAIL || echo OK
```

## T7 — Tech-tree DOM tabs

**wave**: 2. **files_owned**: `src/ui/techTree.ts`, `src/ui/techTree.css`, `scripts/smoke/wp3-techtree.mjs`

**objective**: era tabs in the overlay using T6's view model; accessible keyboard operation.

**context**: read `techTree.ts`, `techTree.css`, `techTreeView.ts` (T6 result), `wp3-techtree.mjs`.
- Skeleton: between `header` and `graph` add `<div id="tech-tabs" class="tech-tabs" role="tablist" aria-label="Eras">`. One `<button type="button" role="tab" class="tech-tab" id="tech-tab-N" data-era="N" aria-controls="tech-graph">` per `EraTabView`, created lazily (`ensureTab(era)`), text patched each render with `tab.label`; `aria-selected`, roving `tabindex` (selected 0, others -1), `disabled` when `!tab.reached`. `graph` gets `role="tabpanel"` and `aria-labelledby="tech-tab-<selectedEra>"` (patched on change).
- State: `selectedEra`. `open()`: `selectedEra = max(reachedEras(views))`; if `selected === null` or the selected tech's era differs from `selectedEra`, `selected = defaultSelection(views of that era)`. The tab is kept while open (a newly reached era does not switch it). `reset` event: `selectedEra = 1`, selection = default of era 1 when open.
- `buildView()`: `const all = session.getAllTechViews(); const tabs = buildEraTabs(all, session.state.res, selectedEra); const view = buildTechTreeView(all.filter((v) => v.def.era === selectedEra), session.state.res, selected, selectedEra)`. `meEl` text = `view.headerText` (era I shows the same visible "0 ME" as before). Include tab labels / reached / selected in `stampOf`.
- Selecting an era (click, or Enter/Space on a tab): ignore if not reached; else `selectedEra = era; selected = defaultSelection(era views); setFeedback(''); dirty = true; update()`.
- Keyboard on the tablist: ArrowRight / ArrowLeft move focus to the next / previous ENABLED tab (wrap); Home / End to first / last enabled; Enter / Space activate (native button click). Esc stays with the modal stack. Tab key reaches the nodes after the tablist (roving tabindex makes the tablist one tab stop).
- Rebuild only on tab or structure change: nodes / edges of the other era stay in the DOM but are hidden (`patch.hidden(refs.button, !inView)`; edge paths `patch.attr(path, 'display', inView ? 'inline' : 'none')`); the rest of the patcher logic unchanged.
- CSS: `.tech-tabs` flex row with gap, `.tech-tab` in the file's existing rust/amber variables, `.tech-tab[aria-selected="true"]` highlighted, `.tech-tab:disabled` dimmed with `cursor: not-allowed`, `.tech-tab:focus-visible { outline: 2px solid <existing amber var>; outline-offset: 2px; }`.
- Smoke script: keep every existing check; add (all into `res`): `9_tabs` = tablist present + tabs `[{text, selected, disabled}]` at first open (expect 2 tabs, era II `SIGNAL ?` disabled, era I selected), `9_header` = text of `#tech-me`, `9_arrow` = ArrowRight with focus on tab 1 leaves focus on tab 1. Then fast-forward via the session exactly like `stages.mjs` s7 (45 crank clicks; before each purchase of `['wornMotor','gearRatio'x3,'reinforcedCrank','motorTuning'x5,'flywheel','pistonArray','improvedPistons']` do `t += 8h; s.update(t)` once wornMotor is owned; then jump up to 5 times until `techLevels.generatorBlueprint === 1`), close and reopen via `#hud-tech`: `10_tabs` expects era II enabled, text starts `ERA II`, selected, `#tech-me` ends `EE`; `10_nodes` = visible `.tech-node` count (expect 9); ArrowLeft then Enter selects era I again.

**constraints**: no Phaser; `textContent`/attributes/`style` only (no innerHTML); `techTree.ts` is a DOM file.

**acceptance**: tablist/tab/tabpanel ARIA present; keyboard works; `SIGNAL ?` disabled; header per tab; opens on the highest reached era; selected tab kept while open; era I node geometry unchanged; typecheck clean for `src/ui`. (Smoke itself is run by the Director.)

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/ui" && echo FAIL || echo OK
grep -nE "from ['\"]phaser|innerHTML" src/ui/techTree.ts && echo FAIL || echo OK
node --check scripts/smoke/wp3-techtree.mjs && echo SYNTAX_OK
```

## T8 — HUD plaque + crank floating text

**wave**: 2. **files_owned**: `src/ui/hudView.ts`, `src/ui/hudView.test.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/game/entities/HandCrank.ts`, `src/game/rendering/FloatingText.ts` (only if a change is truly needed; expected none)

**objective**: C5 `plaqueText`, `HudView.plaque`, `clickGainText`; HUD plaque line; crank text lists every gained resource.

**context**: read all files. `src/simulation/GameSession.ts` is NOT yours and is not changed (`click()` stays `number`; the `click` session event already carries `gainedAll`).
- `hudView.ts`: per C5. Import `PLAQUE_LINES` from `../data/story`, `RESOURCE_IDS`, `ResourceMap`, `TechId` from `../data/types`. `buildHudView`'s state type gains `'techLevels'`; `WorldScene.ts` already passes the full `session.state`, so it stays compiling.
- `hud.ts`: after the resource rows add `<div id="hud-plaque" class="hud-plaque">` (initial text `PRIMARY FUNCTION: UNKNOWN`), written only when `view.plaque` changes. `destroy` unchanged (panel removal covers it).
- `hud.css`: `.hud-plaque { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--rust-dark); color: var(--amber-dim); font-size: .7em; letter-spacing: .12em; overflow-wrap: anywhere; }`.
- `HandCrank.ts`: constructor subscribes `ctx.session.on('click', (e) => { this.lastGain = e.gainedAll; })` BEFORE the zone handler; keep the unsubscribe and call it in `destroy()`. `onPointerDown`: `this.ctx.session.click();` then `this.floatingText.spawn(pos, clickGainText(this.lastGain))` (import `clickGainText` from `../../ui/hudView`; drop the unused `formatNumber` import). `lastGain` starts as a zero ResourceMap (`emptyResourceMap()` from `../../simulation` if exported there, else a literal `{ me: 0, ee: 0, pr: 0, rs: 0, xf: 0 }`).
- `hudView.test.ts`: states built as `{ ...createInitialState(0), res, lifetime }` (so `techLevels` is present). Keep all old expectations.

**acceptance** (tests):
- `plaqueText`: initial -> `PRIMARY FUNCTION: UNKNOWN`; `generatorBlueprint: 1` -> `PRIMARY FUNCTION: R?S????`; both blueprints -> `PRIMARY FUNCTION: RES?OR?`; only `substationBlueprint: 1` -> `RES?OR?` (last owned wins).
- `buildHudView(...).plaque` follows techLevels; every old field unchanged.
- `clickGainText`: `{me: 32}` -> `+32`; all zero -> `+0`; `{me: 32, ee: 1200}` -> `+32 ME  +1.2K EE`; `{ee: 1200}` -> `+1.2K EE`; `{me: 5, xf: 3}` -> `+5 ME  +3 ???`; NaN / negative ignored; order me, ee, pr, rs, xf.
- Era I crank text is exactly `+N` as today.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/(ui|game/entities/HandCrank|game/rendering/FloatingText|game/scenes)" && echo FAIL || echo OK
grep -nE "from ['\"]phaser|innerHTML" src/ui/hud.ts src/ui/hudView.ts && echo FAIL || echo OK
git diff --stat -- src/simulation/GameSession.ts     # must be empty
```

---

# WAVE 3 (parallel: T9a, T9b, T10, T11 — disjoint files; waves 1-2 done)

## T9a — Machine rendering (electric driver, frames, cable, second belt)

**wave**: 3. **files_owned**: `src/game/entities/MachineView.ts`, `src/game/entities/MachineAnimator.ts`, `src/game/rendering/MachineLinks.ts`, `src/game/math/machineLinks.ts`, `src/game/math/machineLinks.test.ts`, `src/game/math/animation.ts`, `src/game/math/animation.test.ts`

**objective**: render the new C3 parts and links without changing any era-I pixel.

**context**: read all seven files plus `machineComponents.ts` (T3 result).
- `animation.ts`: `driverValue(driver, manual, automation, electric = 0)` (adds the `'electric'` case; this also removes the allowed TS2366 error) and `framesIndex` per contract. Existing 3-arg calls stay valid.
- `MachineAnimator.ts`: read `const ee = this.session.rates.perSecond.ee` next to the `.me` reads; `driverValue(anim.driver, this.manual, me, ee)` in the `vibrate` case; new `case 'frames'`: `const dv = driverValue(anim.driver, this.manual, me, ee); sprite.setFrame(framesIndex(this.elapsed, anim.frames, anim.maxHz, dv >= MACHINE_MOTION.restThreshold));` where `this.elapsed` accumulates the clamped `dt` each `update` and resets to 0 on session `reset`; `getDriverValues()` also returns `electric`. Era-I paths and numbers untouched.
- `machineLinks.ts`: add `rasterCable` per contract (reuse `rasterLine`). The generator no longer vibrates (CR4), so its `termR` point is static; the other cable ends (rack lugs, transformer, mast) are static or tiny-vibrating and are read live through `pointOf`.
- `MachineLinks.ts`: `buildPlan` handles three kinds: `belt` (as today), `rod` (the current else-branch becomes `else if (link.kind === 'rod')`), `cable` (there are THREE cable links; each gets its own plan entry): endpoints via `ctx.pointOf` (both ends live, both points non-null), rounded to whole px; plan `{ a, b, sag: link.sag ?? MACHINE_LINK_STYLE.cable.sagArtPx }` with key part `c${a.x},${a.y};${b.x},${b.y};${sag}` (`'c-'` when hidden); all cable key parts joined form the cable key. New Graphics `cables` at `MACHINE_LINK_STYLE.cable.depth`, added to the parent after the caps; redrawn only when its key changes (same pattern as rods). Draw each `rasterCable(a, b, sag)` pixel set in `cable.core`, then `cable.hi` on the pixel directly above (`y - 1`) for every pixel with even `x` that is not itself a core pixel, plus each endpoint as a 2x2 `hi` dot. The second belt (`flywheelPulley.belt2 -> generatorPulley.belt`) needs no special code (it flows through the generic belt path; confirm `radiusOf` resolves by point id). `destroy()` handles the new Graphics. Axle caps: the existing loop adds one for `generatorPulley` automatically; leave it.
- `MachineView.ts`: the RT size already derives from `MACHINE_BOUNDS` (now 648 x 208, origin left/top unchanged, so era-I pixels stay identical). Update the doc comment that says RT pixel (200,200) is machine (0,0); nothing else unless typecheck demands it (frames sprites start on frame 0 like every sprite).

**acceptance** (tests):
- `driverValue('electric', 2, 3, 7) === 7`; 3-arg calls unchanged. `framesIndex`: inactive -> 0, `frames: 1` -> 0, negative / NaN `t` -> 0; with `maxHz 3, frames 4`: t 0 -> 0, 0.34 -> 1, 0.67 -> 2, 1.0 -> 3, 1.34 -> 0; the number of index changes over 10 s is <= `ceil(10 * 3)`.
- `rasterCable`: for `a=(0,0), b=(20,0), sag 10`: first `(0,0)`, last `(20,0)`, lowest point `(10,10)`, symmetric about x = 10, no gaps (consecutive points differ by <= 1 in x and in y); `sag 0` equals `rasterLine`; `a.x === b.x` equals `rasterLine`; `a` right of `b` still starts at `a`; non-finite -> `[]`; sloped cable (`b.y = 20`): the max-y point at mid x equals `round(midY + sag)` where the curve is sampled (state the expected value in the test from the formula).
- Era-I regression: existing `machineLinks.test.ts` cases untouched and green. The Director's smoke s0-s7 screenshots must match the WP7 look.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math
npx tsc --noEmit 2>&1 | grep -E "^src/game/(math|entities|rendering)" && echo FAIL || echo OK     # WorldScene.ts may fail until T9b+T10 land
grep -nE "from ['\"]phaser" src/game/math/animation.ts src/game/math/machineLinks.ts && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/game/entities/MachineView.ts src/game/entities/MachineAnimator.ts src/game/rendering/MachineLinks.ts && echo FAIL || echo OK
```

## T9b — Fallback art + lit pylons

**wave**: 3. **files_owned**: `src/assets/painters/era2.ts` (new), `src/assets/painters/era2.test.ts` (new), `src/assets/painters/background.ts`, `src/assets/painters/background.test.ts` (new), `src/assets/fallbackTextures.ts`, `src/game/rendering/ParallaxBackground.ts`, `src/game/math/parallax.ts`, `src/game/math/parallax.test.ts`

**objective**: every new asset id has a dedicated procedural painter as FALLBACK (rust palette + cyan accents, no generic plate); the real PNGs already exist and load first (fallbacks are only generated for missing textures), so painters are insurance and must never run in the normal build. A lit-pylons layer hidden until `powerLines`, then fading in (the real `bg.pylonsLit` PNG is an overlay on the pylons geometry; the fade logic is independent of art).

**context**: read all files plus `draw.ts` (`rect`, `disc`, `ring`, `line`, `lerpColor`), `machine.ts`, `generic.ts`, `manifest.ts` (T3: `sheetFrameRects`), `world.ts` (T3).
- Painters are `Painter = (g, entry) => void`, integer coords, texture-local (0,0 top-left), `PALETTE` colours only (rust family plus `cyanDark/cyan/cyanLight` as accents), everything clipped to `[0,w) x [0,h)`. In `era2.ts`: `paintGeneratorPlinth` (104x10 low riveted skid), `paintGenerator` (96x64 cast housing, cooling fins, cyan terminal strip), `paintPulleyGenerator` (20x20 face-on pulley: ring + 3 spokes + hub, with an asymmetric mark so rotation reads), `paintCoils` (64x40; stage = last char of `entry.id`: 1, 2, 3; ALL THREE paint the same opaque full 64x40 silhouette (a higher stage fully covers a lower one) with 1 / 2 / 3 rows of copper-rust windings and cyan ties), `paintMotorRetrofit` (32x16 bracket + small cyan lamp), `paintDynamo` (24x24 round can, cyan stripe), `paintCapacitorRack` (48x64: 4 stacked cylinders on a rack, cyan caps), `paintSparkGap` (sheet 128x48 = 4 frames of 32x48: electrodes + stand identical in all frames; frames 0, 1, 3 draw a dim `cyan`/`cyanDark` short arc, frame 2 a bright `cyanLight` full arc), `paintTransformer` (64x64 core + two windings + cyan bushing near x 48, y 4), `paintCableMast` (16x112 lattice mast, cyan insulator at y 2..6). Export `ERA2_PAINTERS: Record<string, Painter>` mapping the 12 new MACHINE asset ids (coils1/2/3 all to `paintCoils`) to their painters.
- `background.ts`: add and export `paintPylonsLit` using the SAME geometry constants/helpers as `paintPylons` (`PYLON_CROSSBAR_YS`, `pylonHalfWidth`, pylons at cx 64 and 192): transparent except cyan lamps (2x2 `cyan`) at both ends of every crossbar, `cyanLight` insulator dots under the top bar at `cx-17` and `cx+15` (y 55..59) and one `cyanDark` pixel under each lamp. Nothing else drawn. Existing painters untouched.
- `fallbackTextures.ts`: `PAINTERS` spreads `ERA2_PAINTERS` and maps `'bg.pylonsLit'` -> `paintPylonsLit`. After `generateTexture`, if `entry.frame` is set: `const tex = scene.textures.get(id); sheetFrameRects(entry).forEach((r, i) => tex.add(i, 0, r.x, r.y, r.width, r.height));`.
- `parallax.ts`: add `isLayerVisible` and `fadeStep` per contract (pure).
- `ParallaxBackground.ts`: per contract. For a layer with `visibleWhen` keep a per-layer fade value: strip alpha = `def.alpha * fade`, `setVisible(fade > 0)`; initial fade = 1 if `isLayerVisible(def, techLevels)` at construction else 0 (no fade-in on load); `update(techLevels, deltaMs)` moves fade toward 1 / 0 with `fadeStep(fade, target, deltaMs, PARALLAX_FADE_MS)` and only touches objects while it changes. Layers without `visibleWhen` behave exactly as today.

**acceptance** (tests, Phaser-free: painter tests call painters with a recording stub `{ fillStyle(color, alpha), fillRect(x, y, w, h) } as unknown as Gfx` and an entry from `ASSET_MANIFEST`):
- `era2.test.ts`: `Object.keys(ERA2_PAINTERS)` equals exactly the 12 new machine asset ids; every painter draws >= 10 rects, all inside the texture, all colours are PALETTE values; at least one `cyan*` colour for generator, coils, motorRetrofit, dynamo, capacitorRack, sparkGap, transformer, cableMast; coil stages 1, 2, 3 cover the same pixel union and have strictly increasing winding-rect counts; sparkGap: the four frame regions (x 0-31, 32-63, 64-95, 96-127) each contain arc colours, frame 2 has more `cyanLight` rects than the others, frames 0/1/3 contain none, and the electrode/stand rects are identical across frames.
- `background.test.ts`: `paintPylonsLit` draws only `cyan`, `cyanLight`, `cyanDark`; all rects inside 256x256; a lamp rect exists at each crossbar end of both pylons (x = cx +- half-width) for y in 60, 100, 150, 200.
- `parallax.test.ts`: existing cases kept; `isLayerVisible` (no `visibleWhen` -> true; below / at / above min level); `fadeStep` (linear move, clamps at the target from both sides, `fadeMs 0` -> target, NaN delta -> current, result in [0,1]).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/assets src/game/math/parallax.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(assets|game/math|game/rendering/ParallaxBackground)" && echo FAIL || echo OK     # WorldScene.ts may fail until T10 lands
grep -nE "paintGenericPlate" src/assets/painters/era2.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/game/math/parallax.ts src/assets/painters/era2.ts src/assets/painters/background.ts && echo FAIL || echo OK
```

## T10 — Camera wiring

**wave**: 3. **files_owned**: `src/game/rendering/CameraController.ts`, `src/game/scenes/WorldScene.ts`

**objective**: refocus and auto-frame from the visible machine bounds; wire the lit-pylons background update.

**context**: read both files, `camera.ts` + `machineBounds.ts` (T5), `world.ts` (T3), the `ParallaxBackground` contract (T9b).
- `CameraController`: constructor `(scene, session: GameSession)` (`import type` from `../../simulation`). Add private `target(): { center: Vec2; zoom: number }`: if `!CAMERA.autoFrame` -> `{ center: clampCenter(CAMERA.focus, CAMERA.defaultZoom, VIEW, WORLD), zoom: CAMERA.defaultZoom }`; else `fitView(boundsToWorld(visibleMachineBounds(session.state.techLevels)), VIEW, { margin: CAMERA.fitMarginPx, pixelScale: PIXEL_SCALE, minZoom: this.minZoom, maxZoom: CAMERA.maxZoom, defaultZoom: CAMERA.defaultZoom, defaultCenter: { x: CAMERA.focus.x, y: CAMERA.focus.y }, world: WORLD })`.
  - Initial `center`/`zoom` = `target()` (era I: identical to today, CAMERA.focus at zoom 1).
  - `refocus()`: same tween as today but towards `target()` (era I refocus identical).
  - Auto-frame: subscribe to `session.on('purchase')` and `session.on('unlock')`: if no drag is active and `!boundsInView(boundsToWorld(visibleMachineBounds(levels)), viewBounds(this.center, this.zoom, VIEW), CAMERA.fitMarginPx)` start the refocus tween to `target()`; otherwise do nothing (never auto-zooms in while the user is zoomed out and the machine fits). `session.on('reset')` -> `refocus()`. `destroy()` unsubscribes everything and cancels the tween.
  - Drag, wheel, snapping, bounds and all other behaviour untouched.
- `WorldScene`: `new CameraController(this, this.ctx.session)`; keep the background in a private field: `new ParallaxBackground(this, this.ctx.session.state.techLevels)` and in `update(_time, delta)` call `this.background?.update(this.ctx.session.state.techLevels, delta)`. Everything else, and the disposal order, unchanged.

**constraints**: no new magic numbers (margin / autoFrame come from `CAMERA`); no `0x` literals; Phaser allowed here.

**acceptance**: typecheck clean once T9b is in; era-I behaviour identical (default view); Director smoke: s7 zoom 1 centre (1280, 960); s8 zoom 1 centre about (1424, 952); s9 zoom 0.75 centre about (1552, 952).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit 2>&1 | grep -E "^src/game" && echo FAIL || echo OK     # coupling with T9b: if only ParallaxBackground errors remain, T9b is unfinished; report it
npx vitest run src/game
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/CameraController.ts src/game/scenes/WorldScene.ts && echo FAIL || echo OK
```

## T11 — Audio + stage smoke

**wave**: 3. **files_owned**: `src/data/audio.ts`, `src/audio/gameAudio.ts`, `src/audio/synth.ts`, `src/audio/audioMath.ts`, `src/audio/audioMath.test.ts`, `scripts/smoke/stages.mjs`, `src/game/debugHook.ts`

**objective**: mains hum, arc crackle, relay click, mute respected; two new smoke stages; camera state in the debug hook.

**context**: read all seven files (`synth.ts` fully: the `run` helper, `playVoice`, `playNoise`, `setHum`, `scheduleGearTicks`).
- `data/audio.ts`: add `mains`, `arc`, `relay` per contract (all numbers live here).
- `audioMath.ts`: `mainsGain`, `arcRate` per contract (reuse `activityLevel`, `clampRange`, `lerp`).
- `synth.ts` (interface + implementation, errors never escape via `run`): `setMains(gain)`: one persistent pair of oscillators (`mains.hz` sawtooth and `mains.harmonicHz` at `harmonicGain` of the level) through a lowpass at 3x hz into a gain moved with `setTargetAtTime` (like `setHum`); gain 0 = silent; created lazily on the first call; stopped in `close()`. `scheduleArcs(perSecond)`: lookahead scheduling like `scheduleGearTicks` with its own `nextArcTime`; each arc is a `playNoise` burst of `arc.ms` at `arc.gain` through a throwaway high-pass BiquadFilter at `arc.highpassHz` (nodes disconnected when the burst ends); rate <= 0 resets the schedule; the interval is `1 / min(rate, arc.maxRate)` so never more than 3 arcs/s; per-call count capped like `MAX_TICKS_PER_CALL`. `playRelay()`: two short square clicks of `relay.hz`, `relay.ms` long, `relay.gapMs` apart, gain `relay.gain`.
- `gameAudio.ts`: in `tick()`, not muted: `const ee = session.rates.perSecond.ee; s.setMains(mainsGain(ee)); s.scheduleArcs(arcRate(ee, session.state.techLevels.sparkGap >= 1));` muted: `s.setMains(0); s.scheduleArcs(0);` next to the hum lines. The `purchase` handler needs the event: `session.on('purchase', ({ id }) => ...)` with the same try / warnOnce / `!muted` guard as `oneShot`, playing `TECHNOLOGIES[id].era >= 2 ? s.playRelay() : s.playPurchase()` (import `TECHNOLOGIES` from `../data/technologies`). Era-I behaviour unchanged.
- `debugHook.ts`: `cameraState(): { zoom: number; centerX: number; centerY: number }` from `game.scene.getScene('World').cameras.main` (`zoom`, `midPoint.x`, `midPoint.y`); add to the `Window.__wedtmd` type and object. Nothing else.
- `stages.mjs`: s0-s7 stay byte-identical in behaviour; extract `const S7 = [...]` (the current `s7_full` array). Buy lists support the marker string `'@blueprint'` (jump `t += 8h; s.update(t)` up to 5 times until `s.state.techLevels.generatorBlueprint === 1`), and a normal id whose `purchase(id).ok` is false retries after an extra 8 h jump, up to 6 times. New stages: `s8_generator: [...S7, '@blueprint', 'generator']`; `s9_era2_full: [...S7, '@blueprint', 'generator', 'motorRetrofit' x5, 'copperWinding' x20, 'dynamoCrank', 'capacitorBank', 'sparkGap', 'transformer' x3, 'powerLines']`. After each stage's screenshot (the 2500 ms wait is already there, so the camera tween is done) print `console.log(name, 'camera', JSON.stringify(await p.evaluate(() => window.__wedtmd.cameraState())))` for EVERY stage, s0-s7 included. Keep the final `errors` JSON line.

**acceptance** (tests, audioMath only; WebAudio has no unit test):
- `mainsGain`: 0 for ee 0, negative and NaN; > 0 for ee 1; within `[minGain, maxGain]` for ee > 0 (including huge values, clamped); monotone non-decreasing. `arcRate`: 0 when `sparkOwned` is false, 0 when ee <= 0 or NaN, otherwise in `[minRate, maxRate]`, never above 3, monotone.
- Typecheck clean for `src/audio`, `src/data/audio.ts`, `src/game/debugHook.ts`; `node --check scripts/smoke/stages.mjs`. Existing `audioMath.test.ts` cases untouched and green.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/audio
npx tsc --noEmit 2>&1 | grep -E "^src/(audio|data/audio|game/debugHook)" && echo FAIL || echo OK
node --check scripts/smoke/stages.mjs && echo SYNTAX_OK
grep -nE "0x[0-9a-fA-F]{6}" src/audio/gameAudio.ts src/audio/synth.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/audio/*.ts && echo FAIL || echo OK
```

---

# WAVE 4 (single worker: T12 — waves 1-3 done and green)

## T12 — Mast to pylon cable in world space (CR7)

**wave**: 4. **files_owned**: `src/game/math/pylonLine.ts` (new), `src/game/math/pylonLine.test.ts` (new), `src/game/rendering/PylonLine.ts` (new), `src/game/scenes/WorldScene.ts`

**objective**: a thin cyan cable that runs from the cable mast `top` (a machine world point) to the nearest lit-pylon insulator of the parallax pylons layer. It cannot live inside the machine RenderTexture (the far end moves with parallax factor 0.55 while the mast end moves with factor 1), so it is a separate world-space Graphics.

**context**: read `ParallaxBackground.ts` (T9b result: how the `pylons` / `pylonsLit` strips are placed: `parallaxSpan(...).min` as strip left x, `parallaxPosition({x:0,y:bottomY}, CAMERA.focus, VIEW, sf).y` as bottom y, tile scale `PIXEL_SCALE`, tile width 256 art px), `parallax.ts` (`isLayerVisible`, `fadeStep`), `camera.ts`, `world.ts` (`PYLON_LINE`, `PARALLAX_LAYERS`, `PARALLAX_FADE_MS`), `machineLayout.ts`, `machineLinks.ts` (`resolveConnectionPoint`), `WorldScene.ts` (T10 result).
- Maths (why): Phaser draws an object with scroll factor sf at screen position of the WORLD point `obj + (1 - sf) * scroll` (scroll = `camera.scrollX/scrollY`), so the world point of a parallax pixel is `parallaxToWorld(obj, sf, scroll)`.
- `pylonLine.ts` (pure, no Phaser; `Vec2` from `../../data/machineComponents`):
  - `parallaxToWorld(obj: Vec2, scrollFactor: number, scroll: Vec2): Vec2` = `obj + (1 - sf) * scroll` per axis.
  - `nearestPylonAnchor(i: { from: Vec2; anchorsArt: readonly Vec2[]; tilePx: number; scale: number; scrollFactor: number; stripLeftX: number; bottomObjY: number; scroll: Vec2; tiles?: number }): Vec2 | null`: `k0 = Math.floor((i.from.x - (1 - sf) * scroll.x - stripLeftX) / (tilePx * scale))`; for every `k` in `k0 - tiles .. k0 + tiles` (tiles default 2) and every anchor `a`: `obj = { x: stripLeftX + (k * tilePx + a.x) * scale, y: bottomObjY - (tilePx - a.y) * scale }`, `world = parallaxToWorld(obj, sf, scroll)`; return the world point with the smallest distance to `from`; `null` when there are no anchors or any input is non-finite.
  - `cableParabola(a: Vec2, b: Vec2, sag: number, segments: number): Vec2[]`: `segments + 1` points (min 1 segment), float coordinates, `t = i / segments`, `y = a.y + (b.y - a.y) * t + 4 * sag * t * (1 - t)`, `x = a.x + (b.x - a.x) * t`; first and last equal `a` and `b` exactly.
- `PylonLine.ts` (Phaser): `constructor(scene: Phaser.Scene, techLevels: Readonly<Record<TechId, number>>)`, `update(camera: Phaser.Cameras.Scene2D.Camera, techLevels, deltaMs: number): void`, `destroy(): void`. One `Graphics` at depth `pylonsLit.depth + PYLON_LINE.depthOffset` (find the `pylonsLit` layer in `PARALLAX_LAYERS`), scroll factor 1. The mast point is computed once: `machineLocalToWorld(resolveConnectionPoint(MACHINE_COMPONENTS.cableMast, 'top'))` (null -> never draw). Visibility and fade follow the `pylonsLit` layer (`isLayerVisible(def, techLevels)`, `fadeStep(..., PARALLAX_FADE_MS)`, initial value 1 when already visible at construction, no fade-in on load); graphics alpha = `fade * def.alpha`; skip all work while fade is 0. Compute `stripLeftX` and `bottomObjY` exactly as `ParallaxBackground` does for the `pylons` layer (same `minZoomToFit(VIEW, WORLD)`, `parallaxSpan(WORLD.width, VIEW.width, minZoom, sf).min`, `parallaxPosition(...).y`), `tilePx = ASSET_MANIFEST['bg.pylonsLit'].width`, `scale = PIXEL_SCALE`, `anchorsArt = PYLON_LINE.anchorsArt`. Each frame (redraw only when the camera scroll or the fade changed) find the nearest anchor, `sag = distance * PYLON_LINE.sagFraction`, `cableParabola(from, anchor, sag, 24)`, draw a polyline with `lineStyle(PYLON_LINE.thicknessPx, MACHINE_LINK_STYLE.cable.core)` and a 2x2 `MACHINE_LINK_STYLE.cable.hi` dot at each end. Colours only from `MACHINE_LINK_STYLE`.
- `WorldScene.ts`: private field `pylonLine`, created after the background (`new PylonLine(this, this.ctx.session.state.techLevels)`), updated in `update(_time, delta)` (`this.pylonLine?.update(this.cameras.main, techLevels, delta)`), destroyed in the disposables (before the background). Nothing else changes.

**acceptance** (tests, `pylonLine.test.ts`):
- `parallaxToWorld`: sf 1 -> unchanged; sf 0 -> `obj + scroll`; sf 0.55 with scroll (100, 50) -> `obj + (45, 22.5)`.
- `nearestPylonAnchor`: one anchor `(0, 256)`, tilePx 256, scale 2, sf 1, scroll 0, `stripLeftX 0`, `bottomObjY 1000`: `from = (1030, 990)` -> the tile k = 2 point `(1024, 1000)`; two anchors pick the nearer; with sf 0.5 and scroll (200, 0) the result equals `parallaxToWorld` of the chosen obj point; `[]` anchors -> null; NaN input -> null; a `from` far to the left still finds a tile (k negative).
- `cableParabola`: exact endpoints; midpoint `y = mid + sag` for `segments` even; `segments + 1` points; `sag 0` is a straight line.
- Typecheck clean; Director smoke s9 shows the cable from the mast top to a lit pylon insulator that slides with parallax when the camera pans.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/pylonLine.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/game" && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/game/math/pylonLine.ts && echo FAIL || echo OK
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/PylonLine.ts src/game/scenes/WorldScene.ts && echo FAIL || echo OK
```

---

# WAVE 5 — EM Mode B

Run: `npm run typecheck`, `npm test` (baseline 736 / 36 files; expect 736 + new, no touched test file losing cases: compare `it(` / `it.each` titles against `git diff`), `npm run build` (app chunk <= 200 KB). Then:
```
grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils src/game/math src/ui/*View.ts src/ui/*Rules.ts      # must be empty
grep -rnE "0x[0-9a-fA-F]{6}" src/game src/ui src/audio --include=*.ts | grep -v test                                          # must be empty
npx vitest run src/simulation/balance.sim.test.ts --silent=false                                                               # era-I exact + Era II windows
git diff --stat HEAD -- docs/GAME_SPEC.md src/simulation/GameSession.ts src/persistence                                        # must be empty (workers never edit public/; the delivered PNGs are not worker output)
```
**Balance** (greedy 7200 s, casual 14400 s): era I exact (gearRatio 4, wornMotor 13, motorTuning 20, reinforcedCrank 196, flywheel 289, pistonArray 722, improvedPistons 758, generatorBlueprint 1326); greedy 4 cps 1 s buys: generator in [1500, 2100], substationBlueprint in [3300, 4500]; 4 cps 30 s buys: substationBlueprint <= 5400; casual 1 cps 30 s: <= 10800; `maxPurchaseGap` <= 1200 for all three profiles; `maxValue` finite and < `DESIGN_MAX_VALUE`; deterministic; file < 10 s.
**Save**: a v2 save without era-II keys loads `loaded` with era-II levels 0 (`npx vitest run src/persistence`, no new tests needed); the v1 fixture still `migrated`; round trip with era-II levels lossless (add one case only if missing, report it as glue).
**Per-criterion PASS/FAIL**: C1 table exact (compare `technologies.ts` with the preamble table, including any T4 retune recorded in its report); C2 signatures present; C3 counts (29 components, 17 sockets, 7 links total = 3 old + 4 new, 13 new asset ids with real files that exist and match the manifest sizes (`file public/assets/<f>`), `MACHINE_BOUNDS`) and the accepted CRs (hub (228,-22), spark mount (340,-53), kit offset (0,-24), generator `none`, two CR6 cables with sag 4 / 3, `PYLON_LINE`); C4 maths and tests; C5 tabs / plaque / click text; `pylonsLit` is the last layer with `visibleWhen`; `PylonLine` exists and is wired in `WorldScene`; install lines complete; three era-II logs present; the three foreign-test fixes (state, systemLogRules, GameSession) landed; relay on era >= 2 purchases; mains / arcs return 0 without generator / spark gap (read the code path).
Allowed glue: one-line integration fixes only (state it in the report).

## Director smoke test steps (after the build)

`npm run build && npx vite preview --port 4173 --strictPort &` then per `scripts/smoke/README.md` with `PW=$(npm root -g)/playwright`:
1. `wp2-crank.mjs`, `wp3-techtree.mjs`, `wp4-persistence.mjs`, `full-machine.mjs` -> each `errors` empty, 0 console errors; HUD ME rows and era-I tree texts identical to before. `wp3-techtree.mjs`: `9_tabs` shows 2 tabs with `SIGNAL ?` disabled, `9_header` ends `ME`, after the fast-forward `10_tabs` shows `ERA II` enabled and selected with header ending `EE`, `10_nodes` = 9.
2. `stages.mjs` (all stages s0-s9; `FRAME_MS=40` optional) -> 0 errors. Camera lines expected:
   - s0-s7: zoom 1, centre about (1280, 960); screenshots match the WP7 look (same parts, same pixels).
   - s8_generator: generator on its plinth, generator pulley on the shaft stub low on the generator (hub at (228,-22), belt 2 rows above the plinth) and the open belt from the flywheel hub pulley; the pulley turns (RotSprite frames); the generator body does NOT jitter; **zoom 1, centre about (1424, 952)**; HUD shows the EE row.
   - s9_era2_full: coils stage 3, capacitor rack, spark gap flickering (two frames 350 ms apart differ), transformer, mast, three sagging cables (generator terminal -> rack left lug, rack right lug -> transformer primary, transformer bushing -> mast top), the cable from the mast top to a lit pylon insulator that slides with parallax when the camera is dragged, lit pylons in the background; the spark gap sits on the rack top plate and the retrofit box sits on the motor; **zoom 0.75, centre about (1552, 952)**; HUD plaque `PRIMARY FUNCTION: RES?OR?` when `session.state.techLevels.substationBlueprint === 1` (likely, the 8 h jumps push lifetime EE past 4M), else `R?S????`.
3. Manual: press T. Before the blueprint the Era II tab reads `SIGNAL ?` (disabled). After it the tab shows `ERA II · EE` and the header `<n> EE`; keyboard-only purchase works (arrows move tabs, Tab reaches nodes, Enter / Space buy). Crank floating text is `+N` in era I and `+N ME  +M EE` after `dynamoCrank`. Pylon lamps fade in over about 1.5 s after `powerLines`. Reload after buying: the camera frames the machine on load.
4. Audio by code review only: mains gain 0 without a generator; relay on era-II purchases; mute silences everything.
5. Docs: Director updates `docs/PROJECT_STATUS.md` (WP8 done, Era II numbers deviation from the roadmap = the C1 table or T4's retune, new test count). The Art Director writes `docs/plan/ART_ERA2.md` against C3.

---

# Risks

- **Foreign hard-coded counts** (9 techs, 8..10 logs): fixed by deliberate extra ownership (T1: state.test, systemLogRules.test; T2: GameSession.test). If a worker skips them W1 ends red.
- **Era-I drift**: any reordering of era-I arithmetic or a changed era-I row breaks the exact greedy times; the T1 snapshot test, T4 exact asserts and T2 regression run guard it.
- **T4 numeric tuning** may not hit the windows with numbers alone (the prototype used another harness). T4 must STOP and report the A/B/C tables rather than widen windows. The Director then decides (a structural change is a new assignment).
- **WP8.md vs real geometry** (camera centres, s8 zoom): corrected here (decision 5). A Director who still expects "s8 zoom < 1" will read the smoke as a failure.
- **Transformer amplitude 0.5** rounds to a 0 px shake: invisible. Plan value kept; likely follow-up bump to 1.
- **T9b <-> T10 coupling** via `ParallaxBackground` / `WorldScene` inside W3: whichever lands first leaves one file red until the other is done; the Director gates on the pair.
- **Art contract drift**: PNG sizes were verified against C3 at planning time; the accepted CRs only move sockets/offsets and the generator animation. If the Art Director re-exports a sheet with another size the manifest test (frame size == component size) and the boot warning catch it.
- **T12 parallax maths** (`obj + (1 - sf) * scroll`) was derived from Phaser's camera matrix and the existing `parallaxPosition`; the unit tests prove the formula, only the Director's pan test proves it on screen. If the far end drifts against the insulator, the fix is in `nearestPylonAnchor` (strip placement constants), not in the art.
- **Generator `none` animation** removes the electric jitter; the hum lives in audio (mains), per the Art Director.
- **Haiku scope** is large for T3 (9 files), T9b (8 files) and T11 (7 files). If one stalls, split on the existing seams: T3 -> (machineComponents + test) / (palette, world, assets); T9b -> (painters + fallbackTextures) / (parallax + ParallaxBackground).
- **Spark-gap fallback sheet**: `tex.add(i, 0, ...)` on a generated canvas texture is not unit-testable; the Director's s9 screenshot is the check (flicker visible, no console errors).
- **Offline cap in stage scripts**: each 8 h jump is capped at 8 h of production; `s9_era2_full` needs about 45 purchases and relies on the retry helper (6 jumps) for the expensive copper-winding levels.
