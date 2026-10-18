# WP8 — Expansion infra + Era II (Electrical) content

Goal: playable from crank to `substationBlueprint`. Era II (EE) gets techs, machine parts (fallback painters first, PixelLab art drops in by file),
`cable` link, lit pylons, logs, plaque, hum/arc audio. Infra it needs: injectable tech tables, dynamic machine bounds + camera auto-frame,
era-tab tech tree. Era I numbers, times and visuals stay identical.
Merges roadmap WP8 (infra) + WP9 (Era II content). HUD resource rows already shipped in WP7 (T5a), so not in this package.
Baseline: 736 tests / 36 files green, typecheck + build clean (commit fcbed15).
`docs/plan/ART_ERA2.md` was missing when this plan was written, so **§C3 below is the art contract** (Art Director must match ids, files, sizes, origins, frames).
If ART_ERA2.md shows up later and disagrees, this file wins for ids/sizes. The Art Director may only add notes there.

## Folded WP7 review notes
- (a) Crank floating text shows only the ME gain. It must list every non-zero resource in `gainedAll` (clickEcho now exists): T8.
- (b) The tech tree header shows only "ME". Each era tab header must show that tab's resource amount: T6/T7.
- (c) `getAllTechViews`/`getTechView` need an injectable `techs` param. The greedy harness also needs it for era tables: T2. (`getTechView` already has it. `getAllTechViews`, `evaluateMilestones` and `requirementLabel` do not.)

## Contracts (all pure, no Phaser in data/simulation/utils/persistence)
### C1 Tech data (`src/data/types.ts`, `src/data/technologies.ts`)
```ts
TECH_IDS = [...9 era-I ids, 'generator','copperWinding','motorRetrofit','dynamoCrank','capacitorBank',
            'sparkGap','transformer','powerLines','substationBlueprint'] as const;   // append only, era-I order unchanged
```
Era II table: tuned initial values. These deviate from roadmap §1 (150K ME generator gave first generator at 90 min); a prototype sim hit the window with them.
| id | kind | era/costRes | baseCost | growth/max | effects | requires | tree col,row |
|---|---|---|---|---|---|---|---|
| generator | unlock | 2/me | 25000 | – | convert(ee,0.5) | generatorBlueprint | 0,1 |
| copperWinding | repeatable | 2/ee | 60 | 1.5/25 | convert(ee,0.25) | generator | 1,0 |
| motorRetrofit | repeatable | 2/me | 20000 | 1.35/20 | autoAdd(me,15) | generator | 1,2 |
| dynamoCrank | unlock | 2/ee | 400 | – | clickEcho(ee,1) | copperWinding 3 | 2,0 |
| capacitorBank | unlock | 2/ee | 2500 | – | rateMult(ee,2) | copperWinding 5 | 2,1 |
| sparkGap | unlock | 2/ee | 10000 | – | clickMult 3 | dynamoCrank | 3,0 |
| transformer | repeatable | 2/ee | 5000 | 1.5/20 | autoPct(ee,15) | capacitorBank | 3,1 |
| powerLines | unlock | 2/ee | 200000 | – | rateMult(me,2) | transformer 3, motorRetrofit 5 | 4,2 |
| substationBlueprint | milestone | 2/ee | 0 | – | none | powerLines, sparkGap, lifetime ee 4,000,000 | 5,1 |
Branches: generator/substation `convergence`, copper/capacitor/transformer `mechanical`, dynamo/spark `origin`, retrofit/powerLines `automation`.
Descriptions are short and cryptic. Flavor: generator "Current detected. Destination: unlisted.", substationBlueprint "Grid handshake... no response from grid."
Tree positions are unique **per era**. Era I rows/cols are untouched.
Prototype greedy results (4 clicks/s, buy every 1 s): generator 29:18, powerLines 49:26, substation 60:23. Same at 30 s buys: 72:52. Casual (1 click/s, 30 s buys): 148:28. Max gap between buys 126 s. Max value ~1e7.
Save: adding tech keys is an additive change. Missing `techLevels` keys already default to 0 (schema `readTechLevels`), so there is **no version bump**.

### C2 Simulation signatures (`src/simulation`)
```ts
getAllTechViews(state: GameState, techs: Record<TechId, TechDefinition> = TECHNOLOGIES): TechView[]      // TECH_IDS order
evaluateMilestones(state: GameState, techs = TECHNOLOGIES): { state; unlocked: TechId[] }              // iterate TECH_IDS over techs
requirementLabel(req: Requirement, techs = TECHNOLOGIES): string
interface GreedyOptions { …; techs?: Record<TechId, TechDefinition> }   // threaded to applyClick/advance/computeRates/purchase/getAllTechViews/evaluateMilestones
interface GreedyResult  { firstAt; maxValue; final; purchases: Array<{ t: number; id: TechId }> }  // successful buys only, in order
export function maxPurchaseGap(purchases: GreedyResult['purchases'], fromT: number, toT: number): number  // longest interval with no buy in [fromT,toT]
```
### C3 Machine + asset contract (`src/data/machineComponents.ts`, `src/assets/{assetIds,manifest}.ts`). Machine-local art px, y up = negative
```ts
type AnimationDriver = 'manual' | 'automation' | 'combined' | 'electric';          // electric = rates.perSecond.ee
ComponentAnimation |= { kind: 'frames'; frames: number; maxHz: number; driver: AnimationDriver }  // frame index steps at <= maxHz while driver > restThreshold, else frame 0
ConnectionPoint.kind: 'belt' | 'pin' | 'cable';   MachineLink.kind: 'belt' | 'rod' | 'cable'
MACHINE_BOUNDS = { left: -200, right: 448, top: -200, bottom: 8 }      // RT size; era-I offsets unchanged (RT origin left/top unchanged)
MACHINE_LINK_STYLE.cable = { depth: MACHINE_LAYER_DEPTH.front + 1, core: 0x2f5a62, hi: 0x5fa8b4, sagArtPx: 10 }
PALETTE += cyanDark 0x2f5a62, cyan 0x5fa8b4, cyanLight 0xbff0ec   // accents only
```
New sockets: generatorBase(264,0) generatorMount(264,-42) generatorHub(228,-42) dynamoMount(70,-36) rackBase(340,0) sparkMount(290,-74) transformerBase(396,0) mastBase(436,0).
| component | tech ≥lvl | asset id → file (under public/assets/) | size | origin | socket (+offset) | layer/bias | animation | connections |
|---|---|---|---|---|---|---|---|---|
| generatorPlinth | generator 1 | machine.generatorPlinth → machine/era2/generator-plinth.png | 104×10 | .5,1 | generatorBase | mid/0 | none | – |
| generator | generator 1 | machine.generator → machine/era2/generator.png | 96×64 | .5,.5 | generatorMount | mid/1 | vibrate electric amp 1 | – |
| generatorPulley | generator 1 | machine.pulleyGenerator → machine/era2/pulley-generator.png (+rot machine/era2/rot/pulley-generator-rot.png, 80 f) | 20×20 | .5,.5 | generatorHub | mid/5 | driven ratio −1.75 | belt r8 |
| coilStage1/2/3 | copperWinding 1/10/20 | machine.coils1/2/3 → machine/era2/coils-1/2/3.png | 64×40 | .5,.5 | generatorMount | mid/2,3,4 | none | – |
| motorRetrofitKit | motorRetrofit 1 | machine.motorRetrofit → machine/era2/motor-retrofit.png | 32×16 | .5,.5 | motorMount (0,−30) | mid/3 | vibrate automation | – |
| crankDynamo | dynamoCrank 1 | machine.dynamo → machine/era2/dynamo.png | 24×24 | .5,.5 | dynamoMount | frame/2 | vibrate manual | – |
| capacitorRack | capacitorBank 1 | machine.capacitorRack → machine/era2/capacitor-rack.png | 48×64 | .5,1 | rackBase | mid/0 | none (glow effect electric) | – |
| sparkGap | sparkGap 1 | machine.sparkGap → machine/era2/spark-gap.png sheet 128×48, frame 32×48 ×4 | 32×48 | .5,1 | sparkMount | mid/6 | frames 4, maxHz 3, electric | – |
| transformer | transformer 1 | machine.transformer → machine/era2/transformer.png | 64×64 | .5,1 | transformerBase | mid/0 | vibrate electric amp .5 | cable `bushing` at (16,−60) |
| cableMast | powerLines 1 | machine.cableMast → machine/era2/cable-mast.png | 16×112 | .5,1 | mastBase | back/0 | none | cable `top` at (0,−108) |
Coil rule: each higher stage fully covers the lower one (same 64×40 footprint), so min-level visibility alone gives the 3 stages.
New links: belt flywheelPulley `belt2` (new point, centre, r12) → generatorPulley `belt` (|−1.1667|·12 = |−1.75|·8 = 14). Cable: transformer `bushing` → cableMast `top`.
Background: `bg.pylonsLit` → bg/pylons-lit.png, 256×256, origin 0,1, tileable x. Same geometry as `bg.pylons`, transparent except cyan lamps/insulators.
New `PARALLAX_LAYERS` entry `pylonsLit` (the pylons params, depth +31) with `visibleWhen: { techId: 'powerLines', minLevel: 1 }`. It fades 0 → layer alpha over 1500 ms.
Manifest rule: an entry gets `file` set only if the PNG exists at implementation time, otherwise `file: null` (procedural fallback; the manifest test requires files to exist). The art phase flips paths and adds `rotation` without touching code.
### C4 Camera (`src/game/math/camera.ts`, new `src/game/math/machineBounds.ts`)
```ts
export interface Bounds { left: number; top: number; right: number; bottom: number }
visibleMachineBounds(techLevels, components = MACHINE_COMPONENTS): Bounds   // art px union of visible boxes (attach + origin + size)
fitView(b: Bounds /*world px*/, view: Size, o: { margin: number; pixelScale: number; minZoom: number; maxZoom: number;
        defaultZoom: number; defaultCenter: Vec2 }): { center: Vec2; zoom: number }
// default view (defaultCenter, defaultZoom) contains b ± margin → return default (era I unchanged);
// else zoom = largest grid value (k·zoomStep) <= min(view.w/(bw+2m), view.h/(bh+2m)), clamped; center = b centre
CAMERA += fitMarginPx: 48, autoFrame: true
```
Full era II (bounds −200..448 art → world 880..2176) ⇒ zoom 0.75, centre x 1528. Full era I ⇒ zoom 1, CAMERA.focus.
### C5 Tree tabs (`src/ui/techTreeView.ts`) and plaque (`src/data/story.ts`, `src/ui/hudView.ts`)
```ts
interface EraTabView { era: number; label: string; reached: boolean; selected: boolean; resourceText: string }
reachedEras(views): number[]          // era 1 always; era n reached when any era-n tech status !== 'locked'
buildEraTabs(views, res, selectedEra): EraTabView[]   // one tab per era present in views; label `ERA I · ME` when reached, else `SIGNAL ?` (disabled)
buildTechTreeView(views /* already filtered to one era */, res, selected, era, layout?)   // TechTreeView.meText → headerText = `${formatNumber(res[eraRes])} ${short}`
PLAQUE_LINES = [{ milestone: null, text: 'PRIMARY FUNCTION: UNKNOWN' }, { milestone: 'generatorBlueprint', text: 'PRIMARY FUNCTION: R?S????' },
                { milestone: 'substationBlueprint', text: 'PRIMARY FUNCTION: RES?OR?' }]   // data only
plaqueText(techLevels): string        // in hudView.ts: last owned entry; HudView += plaque
clickGainText(gainedAll: ResourceMap): string   // hudView.ts: only ME non-zero → "+32" (today's text); else "+32 ME  +1.2K EE" (non-zero, RESOURCE_IDS order)
```

## Tasks (exclusive file ownership; tests next to code)
- T1 Era II data: `src/data/{types,technologies,technologies.test,notifications,systemLogs,story(new)}.ts`. Depends on: none.
  Acceptance: C1 table exact. INSTALL_LINES gets the 9 new ids (generator "Current detected. Destination: unlisted.").
  3 logs with lifetime ee triggers: 1K "Grid handshake sent. No grid answered.", 100K "Load detected 4 km beneath the surface.", 1M "Copper remembers a current older than the copper.".
  Tests: prereq graph acyclic, every tech reachable from handCrank, unique tree pos per era, era-I rows byte-identical, era-II eras/costRes match, `PLAQUE_LINES` milestones exist.
- T2 Injectable tech tables + harness: `src/simulation/progression/{status,milestones,requirements,progression.test}.ts`, `src/simulation/sim/greedy.ts`, `src/simulation/sim/greedy.test.ts (new)`. Depends on: none.
  Acceptance: C2 signatures. Defaults keep every existing call site compiling. A test with an injected table (e.g. a cheaper generatorBlueprint) changes the views, the milestone and the greedy result. `purchases` is ordered. `maxPurchaseGap` unit-tested. Existing tests stay green.
- T3 Machine + asset contract data: `src/data/{machineComponents,machineComponents.test,palette,palette.test,world,world.test}.ts`, `src/assets/{assetIds,manifest,manifest.test}.ts`. Depends on: T1.
  Acceptance: C3 exactly (12 components, 8 sockets, 2 links, MACHINE_BOUNDS, cyan palette, pylonsLit layer def + `visibleWhen` type).
  Updated invariants pass: all boxes inside MACHINE_BOUNDS, every socket used, cable links join two `cable` points, belt ratio·radius rule, generatorPulley allowed unsupported (like motorPulley), link techs ordered by requirement, stage prefixes coherent.
  Era-I component data byte-identical. Manifest dims == component sizes.
- T4 Balance sim Era II: `src/simulation/balance.sim.test.ts`. May retune **numbers only** in `src/data/technologies.ts` era-II rows (+ the matching `technologies.test.ts` expectations). Depends on: T1, T2.
  Acceptance: see Validation §Balance. `console.table` lists all 18 techs. Final numbers go in the T4 report.
- T5 Camera maths: `src/game/math/{camera,camera.test,machineBounds(new),machineBounds.test(new)}.ts`. Depends on: none (injectable component table; uses current MACHINE_COMPONENTS types).
  Acceptance: C4. Tests: era I full → default view. Synthetic wide bounds → snapped zoom ≤ fit, ≥ minZoom. Centre clamped in WORLD. Empty/1-component cases.
- T6 Tab view model: `src/ui/{techTreeView,techTreeView.test}.ts`. Depends on: none (uses `def.era`).
  Acceptance: C5 tabs. Era-filtered layout starts at col 0. Edges whose source is in another era are dropped (the requirement still shows in the detail). headerText uses the tab resource (b). Era-I node geometry unchanged.
- T7 Tree DOM tabs: `src/ui/{techTree.ts,techTree.css}`, `scripts/smoke/wp3-techtree.mjs`. Depends on: T6.
  Acceptance: tablist/tab ARIA roles. ←/→ moves tabs, Enter/Space selects, Tab reaches nodes, visible focus ring. `SIGNAL ?` tab disabled. Header text per tab.
  Opens on the highest reached era. Selected tab kept while open. Rebuild only on tab/structure change. Smoke passes, 0 console errors.
- T8 HUD plaque + crank text: `src/ui/{hudView,hudView.test,hud,hud.css}.ts`, `src/game/entities/HandCrank.ts`, `src/game/rendering/FloatingText.ts`, `src/simulation/GameSession.ts`(+test) only if `click()` must return gainedAll. Depends on: T1.
  Acceptance: plaque line under the HUD rows ("PRIMARY FUNCTION: UNKNOWN" at start). Floating text uses `clickGainText` (a): era I unchanged "+N", after dynamoCrank "+N ME  +M EE". `click()` may return `{ gained, gainedAll }` only if every caller is updated in this task.
- T9a Machine rendering: `src/game/entities/{MachineView,MachineAnimator}.ts`, `src/game/math/{machineLinks,machineLinks.test,animation,animation.test}.ts`, `src/game/rendering/MachineLinks.ts`. Depends on: T3.
  Acceptance: the `electric` driver reads perSecond.ee. `frames` anim ≤3 Hz (pure `framesIndex(t, frames, maxHz, active)` tested). Cable drawn as a pixel parabola (`rasterCable(a,b,sag)` tested, endpoints exact, lowest point = mid + sag). Second belt drawn. RT sized from MACHINE_BOUNDS. Era-I frame pixels unchanged (stages.mjs s0–s7 visually the same).
- T9b Fallback art + lit pylons: `src/assets/painters/{era2(new),background}.ts`, `src/assets/fallbackTextures.ts`, `src/game/rendering/ParallaxBackground.ts`. Depends on: T3.
  Acceptance: every C3 asset id has a painter in Rust palette + cyan accents (no generic plate). sparkGap sheet has 4 frames, one bright. `paintPylonsLit` matches pylon geometry. pylonsLit hidden until powerLines, then fades in. Real PNGs override fallbacks automatically.
- T10 Camera wiring: `src/game/rendering/CameraController.ts`, `src/game/scenes/WorldScene.ts`. Depends on: T5, T3.
  Acceptance: refocus = tween to `fitView(visibleMachineBounds)`. After purchase/milestone/load, auto-frame when the visible bounds ± margin leave the current worldView. Never auto-zooms in while the user is zoomed out containing the machine. Era I refocus is identical to today.
- T11 Audio + stage smoke: `src/data/audio.ts`, `src/audio/{gameAudio,synth,audioMath,audioMath.test}.ts`, `scripts/smoke/stages.mjs`, `src/game/debugHook.ts`. Depends on: T1 (audio), T3 (smoke ids).
  Acceptance: 50 Hz mains hum layer (gain on log EE/s, silent while generator 0). Arc crackle noise bursts ≤3/s while sparkGap owned and EE/s>0. Relay click on era-II purchases. Mute respected.
  stages.mjs adds `s8_generator` (s7 + 8h jumps until generatorBlueprint, then generator) and `s9_era2_full` (all era-II techs incl. powerLines). The script logs `camera.zoom` via debugHook `cameraState()`.

## Waves (≤4 parallel)
W1 = T1, T2, T5, T6 · W2 = T3, T4, T7, T8 · W3 = T9a, T9b, T10, T11. Typecheck is green at the end of every wave.
(T1 must keep `INSTALL_LINES` complete. T3 runs after T1 because component `techId`s need the new ids.)

## Validation (EM Mode B)
Commands: `npm run typecheck` · `npm test` (≥736 + new, all green) · `npm run build` (app chunk ≤200 KB) · `grep -rn "from 'phaser'" src/{simulation,data,persistence,utils}` must be empty.
**Balance** (`npx vitest run src/simulation/balance.sim.test.ts`, SIM 7200 s for greedy, 14400 s for casual):
- Era I exact, unchanged: gearRatio 4, wornMotor 13, motorTuning 20, reinforcedCrank 196, flywheel 289, pistonArray 722, improvedPistons 758, generatorBlueprint 1326.
- Greedy 4 clicks/s, 1 s buys: generator ∈ [1500, 2100] s. substationBlueprint ∈ [3300, 4500] s (55–75 min).
- Greedy 4 clicks/s, 30 s buys: substationBlueprint ≤ 5400 s. Casual 1 click/s, 30 s buys, no offline: substationBlueprint ≤ 10800 s.
- `maxPurchaseGap(purchases, firstAt.generatorBlueprint, firstAt.substationBlueprint)` ≤ 1200 s (both profiles).
- maxValue finite and < DESIGN_MAX_VALUE. Deterministic. Whole file < 10 s.
**Save:** a v2 save without era-II keys loads `loaded`, era-II levels 0. The v1 fixture still migrates. Round-trip with era-II levels is lossless (persistence tests).
**Smoke** (dev server; `PW_PATH=... node scripts/smoke/<x>.mjs`): wp2-crank, wp3-techtree (tabs), wp4-persistence, full-machine, `stages.mjs` s0–s9. All must show 0 console errors.
- s0–s7 screenshots match the WP7 look (camera default, same parts).
- s8: generator, plinth, pulley and belt from the flywheel visible. Camera auto-framed (zoom < 1). HUD EE row visible.
- s9: coils stage 3, capacitor, spark gap flicker, transformer, mast + sagging cable, lit pylons. Plaque `R?S????`. Zoom 0.75.
- Manual: press T → Era II tab shows `SIGNAL ?` before the blueprint. After it, the tab header reads "<n> EE". Keyboard-only purchase works. Crank floating text shows ME + EE after dynamoCrank.
Docs: Director updates PROJECT_STATUS (era-II numbers deviation, WP8 done). The Art Director writes ART_ERA2.md against §C3.

## Out of scope for WP8
WORLD/GROUND_Y growth (era II fits: max world x 2176 < 2560; deferred to WP11). Era III+ data/components. Settings/accessibility menu (WP10), reduced motion.
Stats/achievements, prestige, export/import, music bed. PixelLab art production itself (Art phase A9, file drops only). Any save version bump.
