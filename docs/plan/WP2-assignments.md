# WP2 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP2.md` + `docs/GAME_SPEC.md`. Workers are `implementation-worker` agents (Haiku). WP1 code is complete and is NOT touched by any WP2 worker.

## How the Director uses this file

For every worker: spawn `implementation-worker` and paste **(1) the "Common preamble" below** followed by **(2) exactly one assignment block**. Workers in the same wave run in parallel; do not start a wave until the previous wave is validated (`npx tsc --noEmit` clean + that wave's tests green; EM Mode B or the Director runs this between waves).

| Wave | Assignment ids | Parallel workers |
|---|---|---|
| A | **T0a** (world/palette/assetIds/signal/context/painter helpers), **T0b** (manifest + machine component data) | 2 |
| B | **T1** (camera + parallax math), **T2** (fallback textures + machine painters + manifest tests), **T2b** (background painters), **T4** (machine layout + animation math + data tests) | 4 |
| C | **T3** (HUD), **T5** (wasteland rendering), **T6** (camera controller), **T7** (machine entities + click feedback) | 4 |
| D | **T8** (scenes + bootstrap + debug hook) | 1 |
| E | **T9** = Engineering Manager Mode B (validate, glue, then Director runs the smoke test) | — |

Deviations from `WP2.md` (deliberate; each wave only compile-depends on files from earlier waves, except wave A where T0b imports two small files from T0a):
1. **T0 split into T0a + T0b** (parallel). T0b may show transient tsc errors for imports from T0a's files until both finish; that is expected.
2. **Manifest functions are implemented in T0b** (they are 3 one-liners), so T2 no longer edits `manifest.ts`. T2 owns the tests (`manifest.test.ts`) instead. Nobody edits `manifest.ts` after T0b.
3. **T2 split in two**: T2 = machine painters + generic painter + `fallbackTextures.ts` + manifest tests; **T2b** = `painters/background.ts`. Shared painter helpers (`painterTypes.ts`, `draw.ts`, `rng.ts`) are written by T0a so both can use them.
4. The generic painter has **no text label** (a Graphics object cannot draw text): it paints a rust plate with a `mutedOrange` X and rivets, which is clearly a placeholder.
5. `parallaxSpan` acceptance in WP2.md ("span widens as sf to 0") is wrong when `viewLen / minZoom == worldLen` (true here: the width is constant, the span only shifts). T1 below has the corrected, exact expectations.
6. Extra constants added to the T0 contracts (all additive): `PARALLAX_BOTTOM_MARGIN`, `HORIZON_STRIP`, `FLOATING_TEXT`, `CRANK_FEEDBACK.hitRadius`, `DUST.spawnTopY/spawnBottomY`, `PaletteKey`; extra function `componentBounds` in T4.
7. `MachineView` creates a sprite for **every** component and toggles `visible` from `techLevels` (`sync()`, called at construction and on the `reset` event). This is the "build from techLevels, rebuild on reset" rule, and WP3 only has to call `sync()` on `unlock`. In WP2 only `supportFrame` and `handCrank` are visible.
8. `buildHudView` takes `Pick<GameState, 'me'>` (so `session.state` as `ReadonlyGameState` and test literals both work).

---

# Common preamble (paste before every assignment)

```
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths when reading/writing)
Work package WP2: a pannable/zoomable procedural wasteland, a rusty machine frame, a clickable hand crank, an HTML HUD. WP1 (simulation, data, persistence, utils) is finished; do not edit it.

RULES
- Create/modify ONLY the files listed in your `files_owned`. If you need a change in any other file, STOP and report it as a blocker. Never edit package.json, tsconfig.json, vite.config.ts, index.html, or anything under src/simulation, src/persistence, src/utils (except src/utils/signal*.ts for T0a), src/data/types.ts, src/data/technologies.ts, src/data/balance.ts.
- PURE files (must NOT import 'phaser', must NOT use `window.` / `document.`): everything under src/data, src/utils, src/game/math, src/assets/manifest.ts, src/assets/assetIds.ts, src/assets/painters/rng.ts, src/ui/hudView.ts. `src/ui/hud.ts` may use `document` but not Phaser. Files in src/game and src/assets/painters|fallbackTextures may import Phaser.
- Phaser files: use `import Phaser from 'phaser';` (default import, works with esModuleInterop). NEVER write `override` on scene lifecycle methods (`init`, `preload`, `create`, `update`): Phaser 3.90 typings do not declare them, so `override` is a compile error. Scene constructors take their dependencies as constructor arguments (no registry).
- Every visual tuning number lives in src/data/world.ts, src/data/palette.ts or src/data/machineComponents.ts. No magic numbers in scenes/entities/renderers. Colours come from PALETTE (numbers) or PALETTE_CSS (strings). In src/game NEVER write a `0x......` hex literal.
- No new dependencies. Do NOT run `npm install`. Do not commit. Do not write markdown/report files.
- TS is strict: `noUncheckedIndexedAccess` (array/Record indexing returns `T | undefined`: handle it), `noImplicitOverride`, `isolatedModules`. Use `import type { ... }` for type-only imports and `export type { ... }` for type-only re-exports. Relative imports WITHOUT file extension.
- Tests: Vitest, `import { describe, it, expect } from 'vitest'`, `*.test.ts` next to the code, environment is node (no DOM, no Phaser in tests). Use `toBeCloseTo(x, 9)` for floats. Only PURE modules get tests.
- Other workers edit OTHER files at the same time. `npx tsc --noEmit` may report errors in files you do not own (half-written or not yet written). Ignore those, fix only your own, and list foreign errors in NOTES. Run only your own tests (`npx vitest run <path>`), not the whole suite.
- Phaser cannot run in node, so Phaser code is validated by typecheck only; when unsure of a Phaser signature, grep node_modules/phaser/types/phaser.d.ts instead of guessing.

COORDINATE SYSTEMS (used everywhere)
- World px: logical 2560x1440 world, origin top-left, +y down. Ground line at y = GROUND_Y = 1120.
- Art px: source-texture pixels. PIXEL_SCALE = 2 world px per art px.
- Machine-local art px: origin = centre of the frame base on the ground line, +x right, +y down (parts sit at negative y). The machine container sits at MACHINE_ANCHOR with scale PIXEL_SCALE; world = MACHINE_ANCHOR + local * PIXEL_SCALE. Container children use scale 1.
- Texture key == asset id (e.g. 'machine.crank'). Gameplay/rendering code only uses asset ids, never file paths.
- Screen/view px: the 1280x720 game canvas (VIEW). Camera zoom z shows a world rect of (1280/z)x(720/z) around the camera centre `c`. Phaser: scroll = c - VIEW/2 (independent of zoom), so `camera.centerOn(c.x, c.y)` sets the centre.

FINAL REPORT FORMAT
STATUS: done | blocked | partial
FILES: created/modified list
VALIDATION: each command -> result (paste failing output tail if any)
NOTES/BLOCKERS: ...

=== GAME SESSION API (src/simulation/index.ts barrel; WP1, final) ===
import { GameSession, createInitialState, DEFAULT_SETTINGS } from '../simulation';   // path relative to the importing file
import type { ReadonlyGameState, SessionEvents, Listener } from '../simulation';
// also exported: TypedEmitter, costAt, canAfford, computeRates, applyClick, advance, computeOffline, applyOffline,
//   isRequirementMet, requirementsMet, requirementLabel, getTechStatus, getTechView, getAllTechViews, purchase, evaluateMilestones
interface GameSessionOptions { state: GameState; settings?: SettingsState; now?: () => number }
class GameSession {
  constructor(options: GameSessionOptions)            // credits no time, emits no events
  get state(): ReadonlyGameState                      // immutable snapshot, replaced on every change (techLevels is readonly too)
  get rates(): Readonly<ProductionRates>              // { perClick, perSecond }; same object until techLevels change
  get settings(): Readonly<SettingsState>             // { muted: boolean }
  get revision(): number                              // +1 on every state/settings change (NOTE: update() changes lastSimTime every frame, so it advances nearly every frame; UI still diffs its text)
  click(): number                                     // manual click; returns ME gained
  purchase(id: TechId): PurchaseResult
  update(nowMs?: number): void                        // per frame; first call / gaps > OFFLINE_REPORT_THRESHOLD_SECONDS (60) are routed through applyOffline
  applyOffline(nowMs?: number): OfflineReport         // bootstrap calls this once before starting the loop
  getTechView(id: TechId): TechView;  getAllTechViews(): TechView[]
  reset(nowMs?: number): void                         // emits 'reset'; NO unlock events
  setMuted(muted: boolean): void                      // emits 'settings' when changed
  on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void   // returns unsubscribe
}
interface SessionEvents { click: { gained: number }; purchase: { id: TechId; level: number; cost: number };
  unlock: { id: TechId }; milestone: { id: TechId }; offline: OfflineReport; reset: Record<string, never>; settings: SettingsState }
type ReadonlyGameState = Readonly<Omit<GameState, 'techLevels'>> & { readonly techLevels: Readonly<Record<TechId, number>> }
// GameState = { me, lifetimeMe, totalClicks, techLevels: Record<TechId, number>, lastSimTime, createdAt }   (src/data/types.ts)
// TechId = 'handCrank'|'gearRatio'|'reinforcedCrank'|'flywheel'|'wornMotor'|'motorTuning'|'pistonArray'|'improvedPistons'|'generatorBlueprint'; TECH_IDS (from src/data/types) is the array
// src/utils/format.ts: formatNumber(n, mode?: 'floor'|'ceil'|'round'): string  (default 'floor'; 1500 -> "1.5K", 0 -> "0");
//   formatRate(n): string ("12.5/s", "0/s"); formatCost(n): string (ceil rounding, for prices); formatDuration(s): string
// src/data/balance.ts: OFFLINE_REPORT_THRESHOLD_SECONDS = 60 (and others)
Renderers build initial visuals from `session.state.techLevels` (no unlock events fire on load/reset) and rebuild on the 'reset' event.

=== SHARED CONTRACT: src/data/palette.ts (T0a writes it verbatim) ===
export const PALETTE = {
  sand: 0xc9b28a, dirtyBeige: 0xa8957a, rust: 0x8c4a2a, rustDark: 0x4e2a1a, industrialGray: 0x5a5f63,
  grayDark: 0x2b2e31, mutedOrange: 0xd9822b, skyTop: 0x7a7468, skyHaze: 0xd2bf9c, ink: 0x14110f,
} as const;
export type PaletteKey = keyof typeof PALETTE;
export const PALETTE_CSS: Record<PaletteKey, string>;   // same colours as '#rrggbb' lowercase strings, e.g. PALETTE_CSS.rust === '#8c4a2a'

=== SHARED CONTRACT: src/assets/assetIds.ts ===
export const ASSET_IDS = ['bg.sky','bg.mountains','bg.skyline','bg.pylons','terrain.ground','fx.dust',
  'machine.frame','machine.crank','machine.gearSmall','machine.gearLarge','machine.flywheel',
  'machine.motor','machine.piston','fx.steam'] as const;
export type AssetId = typeof ASSET_IDS[number];

=== SHARED CONTRACT: src/data/world.ts (T0a writes it verbatim) ===
import type { AssetId } from '../assets/assetIds';
import { PALETTE } from './palette';
export const VIEW = { width: 1280, height: 720 } as const;
export const WORLD = { width: 2560, height: 1440 } as const;
export const GROUND_Y = 1120;                                   // world y of the ground/horizon line
export const PIXEL_SCALE = 2;                                   // art px -> world px
export const MACHINE_ANCHOR = { x: 1280, y: GROUND_Y } as const;
export const CAMERA = { focus: { x: 1280, y: GROUND_Y - 160 }, defaultZoom: 1, maxZoom: 2,
  wheelZoomFactor: 1.1, dragThresholdPx: 4, refocusMs: 450 } as const;   // minZoom is derived: minZoomToFit(VIEW, WORLD) === 0.5
export const DEPTH = { background: -100, ground: 0, machine: 100, dust: 200, floatingText: 300 } as const;
export const PARALLAX_BOTTOM_MARGIN = 200;                      // world px the non-sky layer textures extend below the ground line (hidden behind the ground)
export interface ParallaxLayerDef { id: string; assetId: AssetId; scrollFactor: number;
  bottomY: number;      // world y where the texture BOTTOM appears when the camera is centred on CAMERA.focus
  depth: number; alpha: number;
  underfill: number | null }   // colour of a rectangle filled below the texture so panning shows no gap
export const PARALLAX_LAYERS: readonly ParallaxLayerDef[] = [
  { id: 'sky',       assetId: 'bg.sky',       scrollFactor: 0,    bottomY: VIEW.height,                       depth: DEPTH.background,      alpha: 1,    underfill: null },
  { id: 'mountains', assetId: 'bg.mountains', scrollFactor: 0.15, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 10, alpha: 0.7,  underfill: PALETTE.industrialGray },
  { id: 'skyline',   assetId: 'bg.skyline',   scrollFactor: 0.3,  bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 20, alpha: 0.85, underfill: PALETTE.grayDark },
  { id: 'pylons',    assetId: 'bg.pylons',    scrollFactor: 0.55, bottomY: GROUND_Y + PARALLAX_BOTTOM_MARGIN, depth: DEPTH.background + 30, alpha: 1,    underfill: null },
];
export const GROUND_LAYER = { assetId: 'terrain.ground', depth: DEPTH.ground } as const;   // scrollFactor 1, spans GROUND_Y..WORLD.height
export const HORIZON_STRIP = { height: 6, color: PALETTE.rustDark, alpha: 0.6 } as const;  // thin darker strip at GROUND_Y
export const DUST: { maxParticles: number; frequencyMs: number; lifespanMs: [number, number]; speedX: [number, number];
  speedY: [number, number]; alpha: [number, number]; scale: [number, number]; depth: number; spawnTopY: number; spawnBottomY: number } =
  { maxParticles: 60, frequencyMs: 250, lifespanMs: [6000, 11000], speedX: [10, 30], speedY: [-4, 4],
    alpha: [0, 0.35] /* [end, start] fade */, scale: [1, 2.5], depth: DEPTH.dust,
    spawnTopY: GROUND_Y - 520, spawnBottomY: GROUND_Y - 20 };
export const CRANK_FEEDBACK = { degreesPerClick: 90, tweenMs: 160, shakePx: 1 /* art px */, shakeMs: 60,
  floatRisePx: 48, floatMs: 700, floatPoolSize: 24, hitRadius: 36 /* art px, crank click area */ } as const;
export const FLOATING_TEXT = { fontSizePx: 20, strokePx: 3, jitterX: 14, spawnOffsetY: -40 } as const;   // world px

=== SHARED CONTRACT: src/data/machineComponents.ts (T0b writes it; types verbatim) ===
import type { TechId } from './types';   import type { AssetId } from '../assets/assetIds';   import { CRANK_FEEDBACK } from './world';
export const MACHINE_COMPONENT_IDS = ['supportFrame','handCrank','gearSmall','gearLarge','flywheel','wornMotor','pistonArray'] as const;
export type MachineComponentId = typeof MACHINE_COMPONENT_IDS[number];
export const SOCKET_IDS = ['crankHub','smallGearHub','largeGearHub','flywheelHub','motorMount','pistonBed'] as const;
export type SocketId = typeof SOCKET_IDS[number];
export interface Vec2 { x: number; y: number }
export type MachineLayer = 'back' | 'frame' | 'mid' | 'front';
export const MACHINE_LAYER_DEPTH: Record<MachineLayer, number>;      // back 0, frame 10, mid 20, front 30
export type AnimationDriver = 'manual' | 'automation';
export interface SpeedCurve { base: number; gain: number; min: number; max: number }
export type ComponentAnimation =
  | { kind: 'none' }
  | { kind: 'clickRotate'; degreesPerClick: number; tweenMs: number }
  | { kind: 'rotate'; driver: AnimationDriver; direction: 1 | -1; speed: SpeedCurve }                       // deg/s
  | { kind: 'reciprocate'; driver: AnimationDriver; axis: 'x' | 'y'; amplitude: number; speed: SpeedCurve }  // cycles/s
  | { kind: 'vibrate'; driver: AnimationDriver; amplitude: number; speed: SpeedCurve };
export interface ConnectionPoint { id: string; at: Vec2; kind: 'shaft' | 'belt' | 'pipe' }
export interface ProductionEffect { kind: 'vibrate' | 'glow' | 'dust' | 'steam'; driver: AnimationDriver; threshold: number; intensity: number }
export interface MachineComponentDefinition {
  id: MachineComponentId; techId: TechId; minLevel: number;      // visible when techLevels[techId] >= minLevel
  assetId: AssetId; attach: { socket: SocketId | null; offset: Vec2 };   // socket null = machine origin
  size: { width: number; height: number };                       // art px, equals the manifest dims of assetId
  origin: Vec2;                                                  // normalised pivot of the sprite
  layer: MachineLayer; animation: ComponentAnimation; connections: ConnectionPoint[]; effects: ProductionEffect[];
}
export interface MachineLink { from: { component: MachineComponentId; point: string }; to: { component: MachineComponentId; point: string }; kind: ConnectionPoint['kind'] }
export const MACHINE_BOUNDS = { left: -200, right: 200, top: -260, bottom: 0 };   // machine-local art px
export const MACHINE_SOCKETS: Record<SocketId, Vec2>;
export const MACHINE_COMPONENTS: Record<MachineComponentId, MachineComponentDefinition>;
export const MACHINE_LINKS: readonly MachineLink[];              // [] in WP2

=== SHARED CONTRACT: src/assets/manifest.ts (T0b writes + implements; pure) ===
import { ASSET_IDS } from './assetIds';   import type { AssetId } from './assetIds';
export interface AssetEntry { id: AssetId; file: string | null /* path under public/assets/, null = procedural only */;
  width: number; height: number /* source art px; fallback generated at this size; replacements must match */;
  origin: { x: number; y: number }; tileable: 'none' | 'x' | 'xy';
  frame?: { width: number; height: number; count: number }; description: string }
export const ASSET_MANIFEST: Record<AssetId, AssetEntry>;        // all `file: null` in WP2
export interface AssetLoad { key: AssetId; url: string; kind: 'image' | 'spritesheet'; frame?: AssetEntry['frame'] }
export function resolveAssetUrl(entry: AssetEntry, baseUrl: string = 'assets/'): string | null;   // file === null ? null : baseUrl + file
export function planAssetLoads(manifest: Record<AssetId, AssetEntry> = ASSET_MANIFEST, baseUrl: string = 'assets/'): AssetLoad[];   // ASSET_IDS order; skips file === null; kind 'spritesheet' iff entry.frame
export function missingTextureIds(has: (key: string) => boolean, ids: readonly AssetId[] = ASSET_IDS): AssetId[];   // ids for which !has(id)

=== SHARED CONTRACT: src/utils/signal.ts and src/game/context.ts (T0a) ===
export interface Signal<T = void> { emit(value: T): void; on(fn: (value: T) => void): () => void }
export function createSignal<T = void>(): Signal<T>;             // a throwing listener is logged with console.error and skipped
// src/game/context.ts
import type { GameSession } from '../simulation';   import type { Signal } from '../utils/signal';
export interface GameCommands { refocus: Signal<void>; openTechTree: Signal<void> }
export interface GameContext { session: GameSession; commands: GameCommands }

=== SHARED CONTRACT: painter helpers (T0a writes; T2 and T2b use) ===
// src/assets/painters/painterTypes.ts
import Phaser from 'phaser';   import type { AssetEntry } from '../manifest';
export type Gfx = Phaser.GameObjects.Graphics;
export type Painter = (g: Gfx, entry: AssetEntry) => void;       // draws into a Graphics at texture-local coordinates, (0,0) = top-left, size entry.width x entry.height
// src/assets/painters/rng.ts (pure)
export function createRng(seed: number): () => number;           // mulberry32, returns floats in [0,1); same seed -> same sequence
// src/assets/painters/draw.ts (all coordinates are integers in texture px; `alpha` defaults to 1)
export function rect(g: Gfx, color: number, x: number, y: number, w: number, h: number, alpha?: number): void;       // fillStyle + fillRect
export function disc(g: Gfx, color: number, cx: number, cy: number, r: number, alpha?: number): void;                // pixel loop: 1x1 fillRect for every pixel with dx*dx+dy*dy <= r*r
export function ring(g: Gfx, color: number, cx: number, cy: number, rOuter: number, rInner: number, alpha?: number): void;   // pixels with rInner*rInner < d2 <= rOuter*rOuter
export function line(g: Gfx, color: number, x0: number, y0: number, x1: number, y1: number, thickness?: number, alpha?: number): void;  // Bresenham; stamps thickness x thickness squares (thickness default 1)
export function lerpColor(a: number, b: number, t: number): number;                                                  // per-channel linear mix, t clamped to [0,1], result rounded integer 0xRRGGBB
```

---

# WAVE A (parallel: T0a and T0b)

## T0a — World/palette/asset-id data, signal, context, painter helpers

**objective**: Write the shared data contracts and tiny utilities that every other WP2 task imports.

**wave**: A (parallel with T0b; T0b imports `world.ts`, `assetIds.ts` from here, and `painterTypes.ts` imports `AssetEntry` from T0b; transient tsc errors about those are expected until both workers finish)

**files_owned**: `src/data/palette.ts`, `src/data/palette.test.ts`, `src/data/world.ts`, `src/assets/assetIds.ts`, `src/utils/signal.ts`, `src/utils/signal.test.ts`, `src/game/context.ts`, `src/assets/painters/painterTypes.ts`, `src/assets/painters/rng.ts`, `src/assets/painters/rng.test.ts`, `src/assets/painters/draw.ts`

**context**: copy the contracts above VERBATIM:
- `src/data/palette.ts`: the `PALETTE` object (exact hex values), `PaletteKey`, and `PALETTE_CSS` built with a local helper `const css = (n: number): string => '#' + n.toString(16).padStart(6, '0');` and one explicit entry per key (`sand: css(PALETTE.sand), ...`), typed `Record<PaletteKey, string>`.
- `src/data/world.ts`: exactly the block above (imports, every export, same names/values/comments). `DEPTH` must be declared BEFORE `PARALLAX_LAYERS`, `GROUND_LAYER` and `DUST` because they use it.
- `src/assets/assetIds.ts`: exactly the block above.
- `src/utils/signal.ts`: `Signal` interface + `createSignal<T = void>()`. Keep listeners in a `Set<(value: T) => void>`; `on` wraps `fn` in a fresh closure, adds the closure and returns an unsubscribe that deletes only that closure (safe to call twice; the same function subscribed twice needs two unsubscribes); `emit` iterates over `Array.from(set)` and wraps each call in try/catch that does `console.error('[signal] listener threw', error)`. For `T = void`, `emit()` must be callable with no argument (the signature `emit(value: T): void` allows this when T is void).
- `src/game/context.ts`: exactly as above (type-only imports).
- `src/assets/painters/painterTypes.ts`, `rng.ts`, `draw.ts` per the painter-helper contract. `draw.ts` imports `Gfx` with `import type { Gfx } from './painterTypes';`. In `disc`/`ring` loop over the bounding square `[cx-r, cx+r] x [cy-r, cy+r]`. `line` uses the classic integer Bresenham loop and for every step calls `rect(g, color, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, alpha)`. `rng.ts` is mulberry32:
  `let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };`

**constraints**: `world.ts`, `palette.ts`, `assetIds.ts`, `signal.ts`, `rng.ts` are PURE (no phaser import). Only `painterTypes.ts` imports Phaser (type use). No logic in the data files besides `css()`. Do not add any other exports to the contract files.

**acceptance**
- `palette.test.ts`: every `PALETTE_CSS` value matches `/^#[0-9a-f]{6}$/`; `PALETTE_CSS.rust === '#8c4a2a'`, `PALETTE_CSS.ink === '#14110f'`; keys of `PALETTE` equal keys of `PALETTE_CSS`; `parseInt(PALETTE_CSS[k].slice(1), 16) === PALETTE[k]` for all k.
- `signal.test.ts`: emit reaches all listeners with the payload; unsubscribe stops delivery (and calling it twice is harmless); a throwing listener (spy on `console.error` with `vi.spyOn(console, 'error').mockImplementation(() => {})`) does not stop the next listener and `emit` does not throw; `createSignal()` (void) can `emit()` with no argument; a listener added during emit is not called for that emit.
- `rng.test.ts`: same seed yields the same first 5 values; different seeds differ; 1000 values all in [0,1).
- Exports of `world.ts`/`palette.ts`/`assetIds.ts`/`context.ts` match the contract exactly.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/palette.test.ts src/utils/signal.test.ts src/assets/painters/rng.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser" src/data/palette.ts src/data/world.ts src/assets/assetIds.ts src/utils/signal.ts src/assets/painters/rng.ts && echo FAIL || echo OK
```

## T0b — Asset manifest + machine component data

**objective**: Write `manifest.ts` (types, data, three small functions) and `machineComponents.ts` (types + provisional data for all 7 components).

**wave**: A (parallel with T0a; imports `AssetId` from `../assets/assetIds`, `CRANK_FEEDBACK` from `./world`, `TechId` from `./types`; transient errors until T0a finishes are expected)

**files_owned**: `src/assets/manifest.ts`, `src/data/machineComponents.ts`

**context**: types per the contracts above, verbatim. Data:

`ASSET_MANIFEST` — exactly these entries (all `file: null`, no `frame`); `description` = one short non-empty sentence each describing the asset and its role:

| id | width | height | origin x,y | tileable | note for description |
|---|---:|---:|---|---|---|
| bg.sky | 1280 | 720 | 0.5, 0.5 | none | hazy desaturated sky, haze near 65% height |
| bg.mountains | 512 | 256 | 0, 1 | x | far ridge with ruins; period = width; ground line at y=156 |
| bg.skyline | 512 | 320 | 0, 1 | x | ruined skyline; period = width; ground line at y=220 |
| bg.pylons | 256 | 256 | 0, 1 | x | pylons with sagging wires; period = width; ground line at y=156 |
| terrain.ground | 256 | 128 | 0, 0 | xy | cracked sand ground tile |
| fx.dust | 4 | 4 | 0.5, 0.5 | none | dust mote particle |
| machine.frame | 200 | 110 | 0.5, 1 | none | riveted rusty support frame, base on the ground line |
| machine.crank | 48 | 48 | 0.5, 0.5 | none | hand crank, hub at the centre |
| machine.gearSmall | 40 | 40 | 0.5, 0.5 | none | small gear |
| machine.gearLarge | 64 | 64 | 0.5, 0.5 | none | large gear |
| machine.flywheel | 96 | 96 | 0.5, 0.5 | none | flywheel |
| machine.motor | 64 | 48 | 0.5, 0.5 | none | worn motor |
| machine.piston | 96 | 64 | 0.5, 1 | none | piston array, base at the bottom |
| fx.steam | 16 | 16 | 0.5, 0.5 | none | steam puff particle |

Build it as a literal `Record<AssetId, AssetEntry>` (TS then forces every id to be present). Functions exactly as in the contract: `resolveAssetUrl(entry, baseUrl = 'assets/')` returns `null` when `entry.file === null`, else `baseUrl + entry.file`; `planAssetLoads` iterates `ASSET_IDS` in order, looks up `manifest[id]`, skips null urls, `kind = entry.frame ? 'spritesheet' : 'image'`, includes `frame` only when defined; `missingTextureIds` = `ids.filter(id => !has(id))`.

`machineComponents.ts` data (all vectors machine-local art px):
- `MACHINE_LAYER_DEPTH = { back: 0, frame: 10, mid: 20, front: 30 }`.
- `MACHINE_SOCKETS`: crankHub (-70,-62); smallGearHub (-20,-62); largeGearHub (30,-58); flywheelHub (130,-60); motorMount (-146,-30); pistonBed (0,-98).
- `MACHINE_LINKS = []`.
- `MACHINE_COMPONENTS` — one entry per id, `attach.offset` {x:0,y:0} for all:

| id | techId | minLevel | assetId | socket | size w×h | origin | layer | animation |
|---|---|---:|---|---|---|---|---|---|
| supportFrame | handCrank | 1 | machine.frame | null | 200×110 | (0.5,1) | frame | `{kind:'none'}` |
| handCrank | handCrank | 1 | machine.crank | crankHub | 48×48 | (0.5,0.5) | front | `{kind:'clickRotate', degreesPerClick: CRANK_FEEDBACK.degreesPerClick, tweenMs: CRANK_FEEDBACK.tweenMs}` |
| gearSmall | gearRatio | 1 | machine.gearSmall | smallGearHub | 40×40 | (0.5,0.5) | mid | rotate, manual, direction -1, speed {base 90, gain 0.5, min 30, max 360} |
| gearLarge | reinforcedCrank | 1 | machine.gearLarge | largeGearHub | 64×64 | (0.5,0.5) | mid | rotate, manual, direction 1, speed {base 60, gain 0.5, min 20, max 240} |
| flywheel | flywheel | 1 | machine.flywheel | flywheelHub | 96×96 | (0.5,0.5) | mid | rotate, automation, direction 1, speed {base 120, gain 0.6, min 30, max 480} |
| wornMotor | wornMotor | 1 | machine.motor | motorMount | 64×48 | (0.5,0.5) | mid | vibrate, automation, amplitude 1, speed {base 8, gain 0.3, min 2, max 20} |
| pistonArray | pistonArray | 1 | machine.piston | pistonBed | 96×64 | (0.5,1) | back | reciprocate, automation, axis 'y', amplitude 6, speed {base 1.5, gain 0.4, min 0.5, max 6} |

  `connections`: every component gets exactly one point `{ id: 'shaft', at: { x: 0, y: 0 }, kind: 'shaft' }`. `effects`: `wornMotor` -> `[{ kind: 'vibrate', driver: 'automation', threshold: 1, intensity: 0.5 }]`; `pistonArray` -> `[{ kind: 'steam', driver: 'automation', threshold: 5, intensity: 0.6 }]`; `flywheel` -> `[{ kind: 'glow', driver: 'automation', threshold: 10, intensity: 0.4 }]`; all others `[]`. Annotate the constant as `Record<MachineComponentId, MachineComponentDefinition>` so `id` literals are checked.
- `MACHINE_BOUNDS = { left: -200, right: 200, top: -260, bottom: 0 }`.

**constraints**: pure (no Phaser, no DOM); no logic in either file other than the three manifest functions; `size` of every component MUST equal the manifest width/height of its `assetId` (copy from the tables); do not change the contract type shapes.

**acceptance**: `npx tsc --noEmit` shows no errors in these two files once T0a's files exist; `ASSET_MANIFEST` has all 14 ids with `id` fields matching their keys; every component bounding box (socket + offset - origin*size .. + size) lies within `MACHINE_BOUNDS` (checked by T4's tests).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document)\." src/assets/manifest.ts src/data/machineComponents.ts && echo FAIL || echo OK
```

---

# WAVE B (parallel: T1, T2, T2b, T4 — disjoint files; T0a/T0b are done)

## T1 — Camera + parallax math (pure)

**objective**: Implement and test the pure camera and parallax functions.

**wave**: B

**files_owned**: `src/game/math/camera.ts`, `src/game/math/camera.test.ts`, `src/game/math/parallax.ts`, `src/game/math/parallax.test.ts`

**context**: `import type { Vec2 } from '../../data/machineComponents';` In tests also import `VIEW`, `WORLD`, `CAMERA` from `'../../data/world'`.

`camera.ts` (all pure, no Phaser):
```ts
export interface Size { width: number; height: number }
export interface RectLike { left: number; top: number; width: number; height: number }
export function minZoomToFit(view: Size, world: Size): number      // Math.max(view.width / world.width, view.height / world.height)
export function clampZoom(z: number, min: number, max: number): number
export function clampCenter(center: Vec2, zoom: number, view: Size, world: Size): Vec2
export function zoomAroundPoint(center: Vec2, pointerWorld: Vec2, oldZoom: number, newZoom: number): Vec2
export function wheelToZoom(zoom: number, deltaY: number, factor: number, min: number, max: number): number
export function dragToCenter(startCenter: Vec2, dragScreenDelta: Vec2, zoom: number): Vec2
export function worldToClient(world: Vec2, worldView: Vec2, zoom: number, canvasRect: RectLike, gameSize: Size): Vec2
```
Definitions (per axis for the 2-D ones):
- `clampCenter`: visible length `vl = viewLen / zoom`; if `vl >= worldLen` return `worldLen / 2` for that axis, else clamp the centre to `[vl/2, worldLen - vl/2]`. Returns a new object.
- `zoomAroundPoint`: `newCenter = pointerWorld - (pointerWorld - center) * (oldZoom / newZoom)` (the pointer's world point stays under the same screen pixel).
- `wheelToZoom`: `deltaY < 0` -> `zoom * factor` (zoom in); `deltaY > 0` -> `zoom / factor`; `0` -> unchanged; then `clampZoom`.
- `dragToCenter`: `start - delta / zoom` per axis (dragging right moves the camera left).
- `worldToClient`: `worldView` is Phaser's `camera.worldView` top-left; `screen = (world - worldView) * zoom` (game px); `client = canvasRect.left/top + screen * canvasRect.width/height / gameSize.width/height`.

`parallax.ts` (imports `Size` from `./camera`):
```ts
export function parallaxPosition(worldPos: Vec2, focus: Vec2, viewSize: Size, sf: number): Vec2
// = { x: worldPos.x - (1 - sf) * (focus.x - viewSize.width / 2), y: worldPos.y - (1 - sf) * (focus.y - viewSize.height / 2) }
// i.e. an object with scrollFactor sf placed at this position appears at worldPos when the camera is centred on `focus`.
export function parallaxSpan(worldLen: number, viewLen: number, minZoom: number, sf: number): { min: number; max: number }
// Range of OBJECT positions (Phaser x or y, before scrollFactor) that can ever be on screen for an object with scrollFactor sf,
// over all clamped camera centres and all zooms >= minZoom:
//   min = (1 - sf) * (viewLen / 2) * (1 - 1 / minZoom)
//   max = sf * worldLen + (1 - sf) * (viewLen / 2) * (1 + 1 / minZoom)
```
(Derivation for the reviewer: an object at position p with factor sf is visible iff `p - sf*s` lies in `[viewLen/2 - viewLen/(2z), viewLen/2 + viewLen/(2z)]` where the scroll is `s = c - viewLen/2`; the extremes occur at zoom = minZoom with the centre at the clamped world edge.)

**constraints**: pure; no `any`; every function returns fresh objects; give each function a one-line comment with its formula.

**acceptance** (tests, exact values)
- camera: `minZoomToFit(VIEW, WORLD) === 0.5`; `clampZoom(5, 0.5, 2) === 2`, `clampZoom(0.1, 0.5, 2) === 0.5`. `clampCenter({x:-500,y:-500}, 1, VIEW, WORLD)` -> `{x:640,y:360}`; `clampCenter({x:9999,y:9999}, 1, VIEW, WORLD)` -> `{x:1920,y:1080}`; at zoom 2 the min is `{x:320,y:180}` and the max `{x:2240,y:1260}`; at zoom 0.5 any input returns `{x:1280,y:720}` (view equals world). A loop over zooms [0.5, 1, 2] and centres on a 5x5 grid from -1000 to 4000 asserts the visible rect (`centre ± view/(2·zoom)`) is inside `[0, WORLD]`. If the view is larger than the world (view 1000, world 500, zoom 1) the centre is `world/2`.
- `zoomAroundPoint` invariant: for several (center, pointer, oldZoom, newZoom) combos, `(pointerWorld - newCenter) * newZoom` equals `(pointerWorld - center) * oldZoom` per axis within 1e-9; unchanged zoom returns the same centre values.
- `wheelToZoom(1, -100, 1.1, 0.5, 2)` is `1.1` (closeTo); `wheelToZoom(1, 100, 1.1, 0.5, 2)` is `1/1.1`; `wheelToZoom(2, -100, 1.1, 0.5, 2) === 2`; `wheelToZoom(0.5, 100, 1.1, 0.5, 2) === 0.5`; `deltaY = 0` leaves the zoom unchanged.
- `dragToCenter({x:1000,y:500}, {x:100,y:-50}, 2)` -> `{x:950,y:525}`; at zoom 1 -> `{x:900,y:550}`.
- `worldToClient` (gameSize 1280x720, `worldView {x:640,y:360}`, zoom 1): world `{1280,720}` with `canvasRect {left:0,top:0,width:1280,height:720}` -> `{640,360}`; with `canvasRect {left:100,top:50,width:640,height:360}` -> `{420,230}`; world `{1920,1080}` with that same rect -> `{740,410}`; zoom 2 with `worldView {x:960,y:540}` and the 640x360 rect: world `{1280,720}` -> `{420,230}` (view centre maps to canvas centre).
- parallax: `parallaxPosition({x:0,y:1320}, {x:1280,y:960}, VIEW, 0.15)` -> `{x:-544, y:810}`; `sf = 1` is identity for any focus; `sf = 0` gives `worldPos - (focus - view/2)`; focus equal to the view centre gives identity for every sf.
- `parallaxSpan(2560, 1280, 0.5, 1)` -> `{min:0,max:2560}`; `sf 0` -> `{min:-640,max:1920}`; `sf 0.5` -> `{min:-320,max:2240}`; `sf 0.15` -> `{min:-544,max:2016}`; for these inputs `max - min === 2560` always; with `(3000, 1000, 0.5, sf)` the width is `sf*3000 + (1-sf)*2000`. Brute-force test: for sf in [0, 0.15, 0.3, 0.55, 1], zoom in [0.5, 1, 2], and centre c in the two extremes of the clamped range (`clampCenter` with world 2560 / view 1280 gives them), the visible interval `[sf*(c - 640) + 640 - 640/z, sf*(c - 640) + 640 + 640/z]` lies inside `[min, max]` (tolerance 1e-9).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/camera.test.ts src/game/math/parallax.test.ts
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/game/math && echo FAIL || echo OK
```

## T2 — Fallback texture generator, machine + generic painters, manifest tests

**objective**: Generate every missing texture procedurally at boot via Phaser, paint the machine parts, and test the (pure) asset manifest.

**wave**: B

**files_owned**: `src/assets/fallbackTextures.ts`, `src/assets/painters/machine.ts`, `src/assets/painters/generic.ts`, `src/assets/manifest.test.ts`

**context**: imports: `Painter` from `./painters/painterTypes`; `rect, disc, ring, line` from `./painters/draw`; `createRng` from `./painters/rng`; `PALETTE` from `../data/palette`; `ASSET_MANIFEST, missingTextureIds` from `./manifest`; `AssetId` from `./assetIds`. Background painters live in T2b's `./painters/background` and export exactly: `paintSky, paintMountains, paintSkyline, paintPylons, paintGround, paintDust` (all `Painter`).

`fallbackTextures.ts`:
```ts
import Phaser from 'phaser';
export function ensureFallbackTextures(scene: Phaser.Scene): AssetId[]
```
- `const missing = missingTextureIds((key) => scene.textures.exists(key));`
- A module-level `const PAINTERS: Partial<Record<AssetId, Painter>> = { 'bg.sky': paintSky, 'bg.mountains': paintMountains, 'bg.skyline': paintSkyline, 'bg.pylons': paintPylons, 'terrain.ground': paintGround, 'fx.dust': paintDust, 'machine.frame': paintFrame, 'machine.crank': paintCrank, 'machine.gearSmall': paintGear, 'machine.gearLarge': paintGear };`
- For each missing id: `const entry = ASSET_MANIFEST[id]; const g = scene.make.graphics({ x: 0, y: 0 }, false); (PAINTERS[id] ?? paintGenericPlate)(g, entry); g.generateTexture(id, entry.width, entry.height); g.destroy(); scene.textures.get(id).setFilter(Phaser.Textures.FilterMode.NEAREST);` Collect the ids. Finally `console.info('[assets] generated fallback textures:', generated.join(', '))` only when the list is non-empty. Return the list.

Painters (all `Painter`, texture-local coordinates, colours ONLY from `PALETTE`, drawn with the `draw.ts` helpers so everything is on the pixel grid):

`generic.ts` — `export const paintGenericPlate: Painter = (g, entry) => ...` with `w = entry.width, h = entry.height`: `rect(g, PALETTE.rustDark, 0,0,w,h)`; `rect(g, PALETTE.rust, 1,1,w-2,h-2)`; 1-px border drawn as four edge rects in `PALETTE.ink` alpha 0.8; rivets `disc(g, PALETTE.dirtyBeige, x, y, 1)` at the 4 corners inset by 4; a placeholder X: `line(g, PALETTE.mutedOrange, 4,4,w-5,h-5,1,0.8)` and `line(g, PALETTE.mutedOrange, w-5,4,4,h-5,1,0.8)`.

`machine.ts` — exports `paintFrame`, `paintCrank`, `paintGear`. (Below, a colour name means `PALETTE.<name>`; `rect(c, x,y,w,h[,a])` means `rect(g, PALETTE.c, x,y,w,h[,a])`, same for `disc/line`.)

`paintFrame` (texture 200×110; base at y=110; the crank bearing must line up with socket `crankHub` = machine-local (-70,-62) = texture (30,48); right upright centre x=170):
1. Base beam: `rect(rustDark, 0,94,200,16)`, `rect(rust, 0,94,200,12)`, highlight `rect(mutedOrange, 0,94,200,1, 0.35)`.
2. Feet: `rect(grayDark, 6,104,22,6)`, `rect(grayDark, 172,104,22,6)`.
3. Uprights: `rect(rust, 18,24,24,70)` and `rect(rust, 158,24,24,70)`; shading `rect(rustDark, 38,24,4,70)` and `rect(rustDark, 178,24,4,70)`.
4. Braces: `line(rustDark, 42,92,100,26,3)` and `line(rustDark, 158,92,100,26,3)`.
5. Top beam: `rect(rust, 10,12,180,14)`, underside `rect(rustDark, 10,24,180,2)`, highlight `rect(mutedOrange, 10,12,180,1, 0.35)`.
6. Crank bearing plate on the left upright: `disc(grayDark, 30,48,12)`, `disc(industrialGray, 30,48,9)`, `disc(grayDark, 30,48,3)`.
7. Rivets: for `x = 8; x < 200; x += 16`: `disc(dirtyBeige, x, 100, 1)` and `disc(dirtyBeige, x, 19, 1)`.
8. Weathering: `const rng = createRng(11)`; 40 times: `rect(mutedOrange, floor(rng()*196), floor(rng()*98)+12, 2, 1, 0.25)`; 25 times `rect(ink, floor(rng()*196), floor(rng()*98)+12, 1, 2, 0.3)`.

`paintCrank` (48×48, centre (24,24); the arm points UP so rotation is visible; the part is not rotationally symmetric):
1. Counterweight: `rect(rustDark, 21,28,6,8)`, `disc(rustDark, 24,38,4)`.
2. Arm: outline `rect(rustDark, 20,4,8,22)`, then `rect(rust, 21,5,6,20)`; arm end `disc(rust, 24,7,4)`.
3. Handle (bright, invites clicking): outline `rect(ink, 13,1,22,7, 0.8)`, `rect(mutedOrange, 14,2,20,5)`, highlight `rect(dirtyBeige, 14,2,20,1, 0.7)`.
4. Hub on top: `disc(grayDark, 24,24,9)`, `disc(industrialGray, 24,24,6)`, `disc(rustDark, 24,24,2)`, highlight `disc(dirtyBeige, 22,22,1, 0.6)`.

`paintGear` (square texture, `c = entry.width / 2`; works for 40 and 64): `n = Math.max(8, Math.round(entry.width / 4))`, `rOuter = c - 1`, `rBody = rOuter - 4`, `body = entry.id === 'machine.gearLarge' ? PALETTE.rust : PALETTE.industrialGray`.
1. Tooth outlines first: for `i = 0..n-1`, `angle = 2*Math.PI*i/n`, for `r = rBody; r <= rOuter; r++`: `rect(g, PALETTE.grayDark, Math.round(c + Math.cos(angle)*r) - 2, Math.round(c + Math.sin(angle)*r) - 2, 5, 5)`.
2. `disc(grayDark, c, c, rBody + 1)`; `disc(body, c, c, rBody)`.
3. Teeth body: same loops as step 1 but `rect(g, body, ... - 1, ... - 1, 3, 3)`.
4. Inner ring `ring(grayDark, c, c, rBody - 3, rBody - 4)`; four spokes for k = 0..3: `line(grayDark, c, c, Math.round(c + Math.cos(k*Math.PI/2)*(rBody-3)), Math.round(c + Math.sin(k*Math.PI/2)*(rBody-3)), 2)` (so rotation is visible); hub `disc(grayDark, c, c, Math.max(3, Math.round(entry.width / 10) + 1))`, `disc(rustDark, c, c, 2)`; highlight `disc(dirtyBeige, c - 2, c - 2, 1, 0.5)`.

`manifest.test.ts` (pure tests; vitest env is node; use `import.meta.glob` for the disk check, no Node types):
- every `ASSET_IDS` entry exists in `ASSET_MANIFEST` with `entry.id === id`, integer `width`/`height` > 0, origin x,y within [0,1], non-empty description; `Object.keys(ASSET_MANIFEST).length === ASSET_IDS.length`.
- `resolveAssetUrl` returns `null` for `file: null`, `'assets/machine/x.png'` for `file: 'machine/x.png'`, and respects a custom `baseUrl` (`'/a/'` -> `'/a/machine/x.png'`).
- `planAssetLoads()` on the real manifest is `[]`. With a custom manifest (spread `ASSET_MANIFEST`; replace `machine.crank` by `{...ASSET_MANIFEST['machine.crank'], file: 'machine/hand-crank.png'}` and `fx.dust` by `{...ASSET_MANIFEST['fx.dust'], file: 'fx/dust.png', frame: {width: 4, height: 4, count: 3}}`) it returns exactly, in `ASSET_IDS` order (`fx.dust` comes BEFORE `machine.crank`): `[{key:'fx.dust', url:'assets/fx/dust.png', kind:'spritesheet', frame:{width:4,height:4,count:3}}, {key:'machine.crank', url:'assets/machine/hand-crank.png', kind:'image'}]` (the image entry must have no `frame` key: use `toEqual`).
- `missingTextureIds(() => false)` returns all 14 ids in `ASSET_IDS` order; `missingTextureIds((k) => k !== 'fx.steam')` returns `['fx.steam']`; `missingTextureIds(() => true)` returns `[]`; a custom `ids` argument is honoured.
- Disk check: `const files = import.meta.glob('/public/assets/**/*.png');` then for every manifest entry with a non-null `file`, `Object.keys(files)` contains `` `/public/assets/${entry.file}` `` (vacuously true today).
- Tileable widths: for entries with `tileable` `'x'` or `'xy'`, `width` is a power of two (periods used by the painters: 512, 256).
- `MACHINE_COMPONENTS[id].size` equals `{ width, height }` of `ASSET_MANIFEST[def.assetId]` for every component (import `MACHINE_COMPONENTS` from `'../data/machineComponents'`).

**constraints**: `manifest.test.ts` is pure; only `fallbackTextures.ts` touches `Phaser.Scene`/`Textures`; no randomness except via `createRng(seed)` (deterministic textures); never draw outside `[0,w)×[0,h)`; no text drawing.

**acceptance**: `npx vitest run src/assets/manifest.test.ts` green; `npx tsc --noEmit` has no errors in the four owned files (errors from the not-yet-existing `./painters/background` exports are expected until T2b finishes: list them in NOTES); every `AssetId` ends up with a painter or the generic plate.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/assets/manifest.test.ts
npx tsc --noEmit
grep -nE "0x[0-9a-fA-F]{6}" src/assets/fallbackTextures.ts src/assets/painters/machine.ts src/assets/painters/generic.ts && echo "FAIL: colour literal" || echo OK
```

## T2b — Background painters

**objective**: Paint the wasteland textures (sky, mountains, skyline, pylons, ground, dust) procedurally.

**wave**: B

**files_owned**: `src/assets/painters/background.ts`

**context**: imports `Painter` from `./painterTypes`; `rect, disc, line, lerpColor` from `./draw`; `createRng` from `./rng`; `PALETTE` from `../../data/palette`. Export exactly: `paintSky`, `paintMountains`, `paintSkyline`, `paintPylons`, `paintGround`, `paintDust`, each typed `Painter` (`export const paintSky: Painter = (g, entry) => {...}`). Sizes are fixed by the manifest (below). Everything on the integer pixel grid; colours only from `PALETTE` (mixed with `lerpColor` or alpha); deterministic (`createRng(seed)`).

Tileable textures MUST wrap: the left and right edges join seamlessly, so only use periodic functions of x with integer cycle counts across the texture width, or keep items at least 20 px from both edges.

- **paintSky** (1280×720; displayed at 2× so each art px is 2 world px): for `y = 0; y < 720; y += 16`: `t = y / 720`; `color = t < 0.65 ? lerpColor(PALETTE.skyTop, PALETTE.skyHaze, t / 0.65) : PALETTE.skyHaze`; `rect(g, color, 0, y, 1280, 16)`. Haze streaks: `rng = createRng(1)`; 16 times: `rect(g, skyHaze, floor(rng()*1000), 360 + floor(rng()*160), 200 + floor(rng()*300), 4, 0.35)`. Dim sun: `disc(sand, 960, 380, 70, 0.10)`, `disc(sand, 960, 380, 44, 0.14)`, `disc(skyHaze, 960, 380, 24, 0.5)`.
- **paintMountains** (512×256, ground line at y=156): module-level helper `ridge(x) = Math.round(46 + 14*Math.sin(2*Math.PI*2*x/512) + 9*Math.sin(2*Math.PI*5*x/512 + 1) + 5*Math.sin(2*Math.PI*11*x/512 + 2))` (range 18..74, periodic because the cycle counts are integers). For every `x in 0..511`: `rect(industrialGray, x, ridge(x), 1, 256 - ridge(x))` (columns fill to the bottom, so the bottom rows are opaque `industrialGray`, matching the layer underfill). Shading: for every x where `Math.floor(x / 16) % 2 === 0`: `rect(grayDark, x, ridge(x) + 6, 1, 60, 0.25)`. Ruin teeth (x in 20..490 only): `rng = createRng(2)`; for `x0` in `[70, 190, 300, 410, 470]`: `h = 14 + floor(rng()*16)`, `w = 6 + floor(rng()*5)`: `rect(grayDark, x0, ridge(x0) - h, w, h + 8)` and a stepped top `rect(grayDark, x0 + 2, ridge(x0) - h - 5, 3, 5)`.
- **paintSkyline** (512×320, ground line at y=220): `rng = createRng(7)`; `x = 0; while (x < 512)`: `w = Math.min(20 + floor(rng()*28), 512 - x)`; `h = 60 + floor(rng()*90)`; if `rng() < 0.18` then `h += 50`; `top = 220 - h`; `rect(grayDark, x, top, w, 320 - top)` (to the bottom: opaque); left edge shade `rect(ink, x, top, 1, 320 - top, 0.4)`; when `rng() < 0.5` a broken top: `rect(grayDark, x + floor(w*0.2), top - 8, floor(w*0.4), 8)` and a rebar spike `rect(grayDark, x + floor(w*0.6), top - 14, 2, 14)`; windows: for `wx = x + 4; wx + 2 < x + w - 2; wx += 8` and `wy = top + 6; wy < 215; wy += 10`: `r = rng()`; if `r < 0.12` `rect(rust, wx, wy, 2, 3, 0.5)`; else if `r < 0.14` `rect(mutedOrange, wx, wy, 2, 3, 0.55)`. Then `x += w + floor(rng()*4)`.
- **paintPylons** (256×256, transparent background, ground line at y=156, the bottom 100 px are hidden below the ground): two pylons at centres `cx = 64` and `cx = 192`. Each: legs `line(ink, cx-10, 255, cx-2, 40, 2)` and `line(ink, cx+10, 255, cx+2, 40, 2)`; crossbars at `y` in `[60, 100, 150, 200]` with half-width `hw = 3 + Math.round((y - 40) / 18)`: `rect(ink, cx - hw, y, hw*2, 2)`; X braces between consecutive crossbars (`line(ink, cx - hwA, yA, cx + hwB, yB, 1)` and the mirror `line(ink, cx + hwA, yA, cx - hwB, yB, 1)`); top arm `rect(ink, cx - 18, 52, 36, 3)`; insulators `rect(ink, cx - 17, 55, 2, 5)` and `rect(ink, cx + 15, 55, 2, 5)`. Wires (1 px, `ink`, alpha 0.8) with sag: helper `wire(x0, x1, dy)`: for each integer `x` in `[x0, x1]`: `t = (x - x0)/(x1 - x0)`; `y = Math.round(58 + dy + 22 * 4 * t * (1 - t))`; `rect(ink, ((x % 256) + 256) % 256, y, 1, 1, 0.8)` (the modulo makes wires wrap across the tile edge). Call exactly: `wire(80, 176, 0)`, `wire(208, 304, 0)`, `wire(80, 176, 8)`, `wire(208, 304, 8)` (pylon A right insulator at 80 to pylon B left insulator at 176; pylon B right insulator at 208 to the next tile's pylon A left insulator at 304).
- **paintGround** (256×128, fully opaque, tileable in x and y): `rect(sand, 0,0,256,128)`; `rng = createRng(3)`; 220 speckles: `rect(c, floor(rng()*254), floor(rng()*127), 1 + floor(rng()*2), 1, a)` where `(c, a)` = (dirtyBeige, 0.6) for 60%, (rustDark, 0.25) for 25%, (skyHaze, 0.3) for the rest (choose with one `rng()` draw); 14 pebbles `rect(dirtyBeige, x, y, 3, 2, 0.9)` + shadow `rect(rustDark, x, y + 2, 3, 1, 0.4)` at random positions inside [4,248]×[4,120]; 6 cracks: start `(sx, sy)` random in [20,236]×[20,108], then 5 segments of length `6 + floor(rng()*8)` at random angles (`rng() * 2 * Math.PI`), each drawn with `line(rustDark, x, y, nx, ny, 1, 0.55)` after clamping both endpoints to `[0,255]×[0,127]`.
- **paintDust** (4×4): `rect(dirtyBeige, 1, 0, 2, 4)` and `rect(dirtyBeige, 0, 1, 4, 2)` (plus-shaped blob).

**constraints**: no Phaser calls other than through `draw.ts` helpers; no tests (painters need Phaser); each function < 50 lines (module-level helpers like `ridge` are not exported).

**acceptance**: `npx tsc --noEmit` has no errors in this file; the six exports exist with the exact names; all coordinates stay inside the texture (skyline last building clamps to width 512, wires use modulo).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "0x[0-9a-fA-F]{6}" src/assets/painters/background.ts && echo "FAIL: colour literal" || echo OK
```

## T4 — Machine layout + animation math (pure), component data tests

**objective**: Implement and test the pure machine layout and animation-speed functions and the data invariants of `machineComponents.ts`.

**wave**: B

**files_owned**: `src/game/math/machineLayout.ts`, `src/game/math/machineLayout.test.ts`, `src/game/math/animation.ts`, `src/game/math/animation.test.ts`, `src/data/machineComponents.test.ts`

**context**: imports: `MACHINE_COMPONENTS, MACHINE_SOCKETS, MACHINE_BOUNDS, MACHINE_LAYER_DEPTH, MACHINE_COMPONENT_IDS, SOCKET_IDS` and types `MachineComponentDefinition, SpeedCurve, Vec2, SocketId` from `'../../data/machineComponents'` (from `'./machineComponents'` inside `src/data`); `MACHINE_ANCHOR, PIXEL_SCALE` from `'../../data/world'`; `TECH_IDS` and type `TechId` from `'../../data/types'`; `createInitialState` from `'../../simulation'` (tests only).

`machineLayout.ts`:
```ts
export function resolveAttachment(def: MachineComponentDefinition, sockets: Record<SocketId, Vec2> = MACHINE_SOCKETS): Vec2
// base = socket === null ? {0,0} : (sockets[socket] ?? {0,0}); result = base + attach.offset; machine-local art px
export function machineLocalToWorld(p: Vec2, anchor: Vec2 = MACHINE_ANCHOR, scale: number = PIXEL_SCALE): Vec2   // { x: anchor.x + p.x*scale, y: anchor.y + p.y*scale }
export function isComponentVisible(def: MachineComponentDefinition, techLevels: Readonly<Record<TechId, number>>): boolean   // techLevels[def.techId] >= def.minLevel
export function componentDepth(def: MachineComponentDefinition): number   // MACHINE_LAYER_DEPTH[def.layer]
export function componentBounds(def: MachineComponentDefinition, sockets?: Record<SocketId, Vec2>): { left: number; right: number; top: number; bottom: number }
// p = resolveAttachment(def, sockets); left = p.x - origin.x*size.width; right = left + size.width; top = p.y - origin.y*size.height; bottom = top + size.height
```
`animation.ts`:
```ts
export function animationSpeed(curve: SpeedCurve, driverValue: number): number
// !Number.isFinite(driverValue) || driverValue <= 0 ? 0 : clamp(curve.base * (1 + curve.gain * Math.log10(1 + driverValue)), curve.min, curve.max)
```

**constraints**: pure (no Phaser/DOM); no constants besides the imported ones.

**acceptance** (tests)
- `machineLayout.test.ts`: `resolveAttachment(MACHINE_COMPONENTS.supportFrame)` is `{0,0}`; `handCrank` is `{x:-70,y:-62}`; with an offset (`{...def, attach:{socket:'crankHub', offset:{x:3,y:-4}}}`) -> `{-67,-66}`; a custom sockets table is honoured. `machineLocalToWorld({x:0,y:0})` -> `{1280,1120}`; `({x:-70,y:-62})` -> `{1140, 996}`; custom anchor/scale honoured. `isComponentVisible`: with `createInitialState(0).techLevels`, `supportFrame` and `handCrank` visible, the five others not; with `{...levels, gearRatio:1}` `gearSmall` visible; with `wornMotor:1` `wornMotor` visible. `componentDepth(supportFrame) === 10`, `handCrank === 30`, `pistonArray === 0`. `componentBounds(supportFrame)` -> `{left:-100,right:100,top:-110,bottom:0}`.
- `animation.test.ts` (curve `{base:90, gain:0.5, min:30, max:360}`): v=0 -> 0; v=-5 -> 0; NaN -> 0; Infinity -> 0; v=9 -> `90*(1+0.5*1) = 135` (closeTo); non-decreasing over `[1,2,5,10,100,1e3,1e6]`; never above `max` for `v=1e12` (also with a curve such as `{base:90, gain:5, min:30, max:360}` where the raw value exceeds max: result equals `max`); for a curve whose raw value at tiny v is below `min` (e.g. `{base:10, gain:0.1, min:30, max:360}`, v=0.001) the result is `min`.
- `machineComponents.test.ts`: `MACHINE_COMPONENT_IDS` unique and equal to `Object.keys(MACHINE_COMPONENTS)` as sets, each `MACHINE_COMPONENTS[id].id === id`; connection-point ids unique within each component; every `techId` is in `TECH_IDS`; every non-null `attach.socket` is a key of `MACHINE_SOCKETS` and `SOCKET_IDS` equals `Object.keys(MACHINE_SOCKETS)` as sets; every component's `componentBounds` lies inside `MACHINE_BOUNDS`; `minLevel >= 1`; origin values in [0,1]; size > 0; for every animation with `speed`: `speed.min <= speed.max` and `speed.base > 0`; `supportFrame` and `handCrank` both have `techId === 'handCrank'`; `handCrank.animation` equals `{kind:'clickRotate', degreesPerClick:90, tweenMs:160}`; `MACHINE_LINKS` is empty; `MACHINE_LAYER_DEPTH` equals `{back:0, frame:10, mid:20, front:30}`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/machineLayout.test.ts src/game/math/animation.test.ts src/data/machineComponents.test.ts
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/game/math src/data && echo FAIL || echo OK
```

---

# WAVE C (parallel: T3, T5, T6, T7 — disjoint files; waves A and B are done)

## T3 — HUD (HTML/CSS terminal)

**objective**: A pure view-model function plus a DOM HUD (top-left readout, bottom-right buttons) in an industrial terminal style.

**wave**: C

**files_owned**: `src/ui/hudView.ts`, `src/ui/hudView.test.ts`, `src/ui/hud.ts`, `src/ui/hud.css`

**context**: imports: `formatNumber, formatRate` from `'../utils/format'`; types `GameState, ProductionRates` from `'../data/types'`; type `GameContext` from `'../game/context'` (`GameContext['commands']`: `{ refocus: Signal<void>; openTechTree: Signal<void> }`). No Phaser anywhere in `src/ui`.

`hudView.ts` (pure):
```ts
export interface HudView { me: string; perClick: string; perSecond: string }
export function buildHudView(state: Pick<GameState, 'me'>, rates: Readonly<ProductionRates>): HudView
// me: formatNumber(state.me); perClick: formatNumber(rates.perClick); perSecond: formatRate(rates.perSecond)
```
`hud.ts`:
```ts
import './hud.css';
export interface Hud { render(view: HudView): void; destroy(): void }
export function createHud(root: HTMLElement, commands: GameContext['commands']): Hud
```
- Build the DOM with `document.createElement` (no innerHTML) and append to `root`. Structure (the ids are required):
  - `<div id="hud-panel" class="hud-panel">` containing `<div class="hud-title">MECHANICAL ENERGY</div>` and three rows `<div class="hud-row"><span class="hud-label">ME</span><span id="hud-me" class="hud-value">0</span></div>`, a row labelled `ME/CLICK` with `#hud-per-click` (initial text `1`), and a row labelled `ME/S` with `#hud-per-second` (initial text `0/s`).
  - `<div id="hud-buttons" class="hud-buttons">` containing `<button id="hud-tech" class="hud-btn" type="button" aria-disabled="true" title="TECH INDEX — ACCESS PENDING">TECH INDEX</button>` and `<button id="hud-refocus" class="hud-btn" type="button" title="Re-centre the camera on the machine">REFOCUS</button>`.
- `render(view)`: keep the last written strings and only assign `element.textContent` when the string changed.
- Click handlers: `#hud-tech` click -> `commands.openTechTree.emit()` (the button has `aria-disabled="true"` and is visibly dimmed, but it is NOT the `disabled` attribute so it still receives clicks and shows its tooltip); `#hud-refocus` click -> `commands.refocus.emit()`.
- `destroy()`: remove both click listeners and remove `#hud-panel` and `#hud-buttons` from `root`. Calling it twice must not throw.

`hud.css` (must work at 1280×720 and when the window is resized; system fonts only, no remote assets, no `@import url`):
- Define CSS variables on `.hud-panel, .hud-buttons` with the literal palette hexes (comment: "keep in sync with src/data/palette.ts"): `--ink:#14110f; --iron:#2b2e31; --iron-2:#1d1f21; --rust:#8c4a2a; --rust-dark:#4e2a1a; --amber:#d9822b; --amber-dim:#a8957a; --haze:#d2bf9c;`.
- `.hud-panel{position:fixed;top:16px;left:16px;min-width:clamp(180px,18vw,260px);padding:10px 14px;background:var(--iron-2);border:2px solid var(--rust);box-shadow:0 0 0 2px var(--ink),inset 0 0 18px rgba(0,0,0,.6);color:var(--amber);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:clamp(12px,1.5vw,18px);text-transform:uppercase;letter-spacing:.08em;pointer-events:auto;user-select:none}`.
- Scanlines via `.hud-panel::after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px)}`.
- `.hud-title{color:var(--amber-dim);font-size:.75em;margin-bottom:6px;border-bottom:1px solid var(--rust-dark);padding-bottom:4px}`; `.hud-row{display:flex;justify-content:space-between;gap:16px}`; `.hud-label{color:var(--amber-dim)}`; `.hud-value{font-variant-numeric:tabular-nums;text-shadow:0 0 6px rgba(217,130,43,.55)}`; `#hud-me{font-size:1.6em}`.
- `.hud-buttons{position:fixed;right:16px;bottom:16px;display:flex;gap:10px;pointer-events:auto}`; `.hud-btn{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:clamp(11px,1.3vw,15px);text-transform:uppercase;letter-spacing:.08em;color:var(--amber);background:var(--iron-2);border:2px solid var(--rust);padding:8px 14px;cursor:pointer}`; `.hud-btn:hover{background:var(--rust-dark);color:var(--haze)}`; `.hud-btn:focus-visible{outline:2px solid var(--amber);outline-offset:2px}`; `.hud-btn[aria-disabled="true"]{opacity:.55;cursor:help}`.
- Do NOT set `pointer-events` on `#ui-root` (index.html already sets `none`); only the panel and the buttons are `auto`.

**constraints**: no Phaser import in `src/ui`; `hudView.ts` has no DOM and no CSS import (so vitest in node can import it); `hud.ts` is not unit-tested; no timers.

**acceptance** (tests in `hudView.test.ts`): `buildHudView({me:0},{perClick:1,perSecond:0})` -> `{me:'0',perClick:'1',perSecond:'0/s'}`; `me: 1500` -> `me '1.5K'`; `perClick 12` -> `'12'`; `perSecond 12.5` -> `'12.5/s'`; `perSecond 1500` -> `'1.5K/s'`; passing `createInitialState(0)` (from `'../simulation'`) as the state compiles and gives `me '0'`; NaN `me` -> `'0'`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/ui && echo FAIL || echo OK
grep -nE "\b(window|document)\." src/ui/hudView.ts && echo FAIL || echo OK
```

## T5 — Wasteland rendering (parallax, terrain, dust)

**objective**: Render the layered wasteland with Phaser objects driven only by `src/data/world.ts` and the camera/parallax math.

**wave**: C

**files_owned**: `src/game/rendering/ParallaxBackground.ts`, `src/game/rendering/Terrain.ts`, `src/game/rendering/DustField.ts`

**context**: imports: `Phaser from 'phaser'`; `VIEW, WORLD, GROUND_Y, PIXEL_SCALE, CAMERA, PARALLAX_LAYERS, GROUND_LAYER, HORIZON_STRIP, DUST` from `'../../data/world'`; `ASSET_MANIFEST` from `'../../assets/manifest'`; `minZoomToFit` from `'../math/camera'`; `parallaxPosition, parallaxSpan` from `'../math/parallax'`. These classes never read or write `GameSession`/game state. Textures with ids from the manifest already exist when these are constructed (BootScene ran `ensureFallbackTextures`).

Each class: `constructor(scene: Phaser.Scene)`, `destroy(): void` (destroys every object it created).

`ParallaxBackground`: `const minZoom = minZoomToFit(VIEW, WORLD);` for each `def` of `PARALLAX_LAYERS`:
- If `def.scrollFactor === 0` (sky): `scene.add.image(VIEW.width / 2, VIEW.height / 2, def.assetId).setScrollFactor(0).setDepth(def.depth).setAlpha(def.alpha).setDisplaySize(VIEW.width / minZoom, VIEW.height / minZoom)`. (At zoom 0.5 the visible object-space rect for a scrollFactor-0 object is exactly 2560×1440 around the view centre.)
- Otherwise: `const entry = ASSET_MANIFEST[def.assetId]; const sf = def.scrollFactor;` `const spanX = parallaxSpan(WORLD.width, VIEW.width, minZoom, sf); const spanY = parallaxSpan(WORLD.height, VIEW.height, minZoom, sf); const pos = parallaxPosition({ x: 0, y: def.bottomY }, CAMERA.focus, VIEW, sf);`
  - Texture strip: `scene.add.tileSprite(spanX.min, pos.y, spanX.max - spanX.min, entry.height * PIXEL_SCALE, def.assetId).setOrigin(0, 1).setTileScale(PIXEL_SCALE, PIXEL_SCALE).setScrollFactor(sf).setDepth(def.depth).setAlpha(def.alpha)`. (x comes from the span, y from `parallaxPosition`; the tile pattern is horizontally periodic so its phase does not matter.)
  - If `def.underfill !== null` and `spanY.max - pos.y > 0`: `scene.add.rectangle(spanX.min, pos.y, spanX.max - spanX.min, spanY.max - pos.y, def.underfill).setOrigin(0, 0).setScrollFactor(sf).setDepth(def.depth).setAlpha(def.alpha)`.
  - Keep every created object in a private array for `destroy()`.

`Terrain`: ground `scene.add.tileSprite(0, GROUND_Y, WORLD.width, WORLD.height - GROUND_Y, GROUND_LAYER.assetId).setOrigin(0, 0).setTileScale(PIXEL_SCALE, PIXEL_SCALE).setDepth(GROUND_LAYER.depth)`; horizon strip `scene.add.rectangle(0, GROUND_Y, WORLD.width, HORIZON_STRIP.height, HORIZON_STRIP.color, HORIZON_STRIP.alpha).setOrigin(0, 0).setDepth(GROUND_LAYER.depth + 1)`.

`DustField`: `const emitter = scene.add.particles(0, 0, 'fx.dust', { x: { min: 0, max: WORLD.width }, y: { min: DUST.spawnTopY, max: DUST.spawnBottomY }, lifespan: { min: DUST.lifespanMs[0], max: DUST.lifespanMs[1] }, speedX: { min: DUST.speedX[0], max: DUST.speedX[1] }, speedY: { min: DUST.speedY[0], max: DUST.speedY[1] }, scale: { min: DUST.scale[0], max: DUST.scale[1] }, alpha: { start: DUST.alpha[1], end: DUST.alpha[0] }, frequency: DUST.frequencyMs, maxAliveParticles: DUST.maxParticles });` then `emitter.setDepth(DUST.depth); emitter.fastForward(DUST.lifespanMs[1]);` (pre-populates so the first frame already has dust). This is the Phaser 3.60+ particle API (`scene.add.particles(x, y, texture, config)` returns a `ParticleEmitter` game object; there is no `createEmitter`). If a config key is rejected by the typings, check `ParticleEmitterConfig` in `node_modules/phaser/types/phaser.d.ts` and adapt.

**constraints**: no magic numbers (use the data constants; `0`, `1` and `/ 2` for centring are fine); no hex colour literals; `setTileScale(x, y)` is the TileSprite method; nothing here touches `GameSession`.

**acceptance**: typecheck clean for these files; three classes exported with `constructor(scene)` and `destroy()`; screenshots (T9) show layered parallax with no gaps at the four pan extremes for zoom 0.5/1/2.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -rnE "0x[0-9a-fA-F]{6}" src/game/rendering/ParallaxBackground.ts src/game/rendering/Terrain.ts src/game/rendering/DustField.ts && echo "FAIL: colour literal" || echo OK
grep -rnE "override (init|preload|create|update)\b" src/game/rendering/ParallaxBackground.ts src/game/rendering/Terrain.ts src/game/rendering/DustField.ts && echo FAIL || echo OK
grep -rnE "GameSession|simulation" src/game/rendering/ParallaxBackground.ts src/game/rendering/Terrain.ts src/game/rendering/DustField.ts && echo FAIL || echo OK
```

## T6 — Camera controller

**objective**: Drag-pan, wheel-zoom-at-pointer and animated refocus for the main camera, with all math delegated to `src/game/math`.

**wave**: C

**files_owned**: `src/game/rendering/CameraController.ts`

**context**: imports: `Phaser from 'phaser'`; `VIEW, WORLD, CAMERA` from `'../../data/world'`; `PALETTE_CSS` from `'../../data/palette'`; type `Vec2` from `'../../data/machineComponents'`; `minZoomToFit, clampZoom, clampCenter, zoomAroundPoint, wheelToZoom, dragToCenter` from `'../math/camera'`.

```ts
export class CameraController {
  constructor(scene: Phaser.Scene)
  refocus(): void
  destroy(): void
}
```
Design (own the state; never read the camera back):
- Fields: `center: Vec2`, `zoom: number`, `minZoom = minZoomToFit(VIEW, WORLD)`, `drag: { startCenter: Vec2; startX: number; startY: number; active: boolean } | null`, `refocusTween: Phaser.Tweens.Tween | null`.
- Constructor: `cam = scene.cameras.main`; `cam.setBounds(0, 0, WORLD.width, WORLD.height)`; `cam.setBackgroundColor(PALETTE_CSS.ink)`; `zoom = CAMERA.defaultZoom`; `center = clampCenter({ x: CAMERA.focus.x, y: CAMERA.focus.y }, zoom, VIEW, WORLD)`; `apply()`; register the five handlers below with `scene.input.on(...)`, keeping the handler function references so `destroy()` can `scene.input.off(name, handler)`. `apply()` = `cam.setZoom(this.zoom); cam.centerOn(this.center.x, this.center.y);`.
- `pointerdown(pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[])`: ignore when `currentlyOver.length > 0` (so clicking the crank never starts a pan) or when neither `pointer.leftButtonDown()` nor `pointer.middleButtonDown()`; otherwise `drag = { startCenter: { ...center }, startX: pointer.x, startY: pointer.y, active: false }`.
- `pointermove(pointer)`: return if `drag === null || !pointer.isDown`; `dx = pointer.x - drag.startX`, `dy = pointer.y - drag.startY` (game px = view px); if `!drag.active` and `Math.hypot(dx, dy) <= CAMERA.dragThresholdPx` return; set `drag.active = true`; `cancelRefocus()`; `center = clampCenter(dragToCenter(drag.startCenter, { x: dx, y: dy }, zoom), zoom, VIEW, WORLD)`; `apply()`.
- `pointerup` and `pointerupoutside`: `drag = null`.
- `wheel(pointer, currentlyOver, deltaX, deltaY)`: `cancelRefocus()`; `newZoom = wheelToZoom(zoom, deltaY, CAMERA.wheelZoomFactor, minZoom, CAMERA.maxZoom)`; if `newZoom === zoom` return; `pointerWorld = { x: center.x + (pointer.x - VIEW.width / 2) / zoom, y: center.y + (pointer.y - VIEW.height / 2) / zoom }`; `center = clampCenter(zoomAroundPoint(center, pointerWorld, zoom, newZoom), newZoom, VIEW, WORLD)`; `zoom = newZoom`; `apply()`. Zoom stays in `[0.5, 2]` because `wheelToZoom` clamps.
- `refocus()`: `cancelRefocus(); drag = null;` `from = { center: { ...center }, zoom }`; `toZoom = CAMERA.defaultZoom`; `toCenter = clampCenter({ x: CAMERA.focus.x, y: CAMERA.focus.y }, toZoom, VIEW, WORLD)`; `refocusTween = scene.tweens.addCounter({ from: 0, to: 1, duration: CAMERA.refocusMs, ease: 'Sine.easeInOut', onUpdate: (tween) => { const t = tween.getValue() ?? 1; zoom = clampZoom(from.zoom + (toZoom - from.zoom) * t, minZoom, CAMERA.maxZoom); center = clampCenter({ x: from.center.x + (toCenter.x - from.center.x) * t, y: from.center.y + (toCenter.y - from.center.y) * t }, zoom, VIEW, WORLD); apply(); }, onComplete: () => { refocusTween = null; } })`. `cancelRefocus()` = `refocusTween?.stop(); refocusTween = null`.
- `destroy()`: `cancelRefocus()`, remove all five input handlers (`'pointerdown'`, `'pointermove'`, `'pointerup'`, `'pointerupoutside'`, `'wheel'`), `drag = null`.
- The page must not scroll on wheel: `index.html` already has `overflow:hidden`, and T8 sets `input.mouse.preventDefaultWheel: true` in the game config. Do nothing extra here.

**constraints**: do not call `cam.pan/zoomTo/startFollow` (they fight our state); no magic numbers; use arrow functions or bound methods so `this` is correct; do not read/write game state; no `0x` literals.

**acceptance**: typecheck clean; zoom always within `[0.5, 2]`; the view rect never leaves the world (every centre passes through `clampCenter`); `refocus()` returns to focus/zoom 1 from any extreme and is cancelled by drag/wheel; listeners removed on `destroy()`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "0x[0-9a-fA-F]{6}" src/game/rendering/CameraController.ts && echo FAIL || echo OK
grep -nE "override (init|preload|create|update)\b" src/game/rendering/CameraController.ts && echo FAIL || echo OK
```

## T7 — Machine entities + click feedback

**objective**: The machine container with its component sprites, the interactive hand crank (click -> `session.click()` + rotation tween + shake + floating "+N"), and a pooled floating-text emitter.

**wave**: C

**files_owned**: `src/game/entities/MachineView.ts`, `src/game/entities/HandCrank.ts`, `src/game/rendering/FloatingText.ts`

**context**: imports: `Phaser from 'phaser'`; `MACHINE_ANCHOR, PIXEL_SCALE, DEPTH, CRANK_FEEDBACK, FLOATING_TEXT` from `'../../data/world'`; `MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS` and types `MachineComponentId, Vec2` from `'../../data/machineComponents'`; `PALETTE_CSS` from `'../../data/palette'`; `resolveAttachment, machineLocalToWorld, isComponentVisible, componentDepth` from `'../math/machineLayout'`; type `GameContext` from `'../context'`; `formatNumber` from `'../../utils/format'`.

`FloatingText` (`src/game/rendering/FloatingText.ts`):
```ts
export class FloatingText {
  constructor(scene: Phaser.Scene)
  spawn(worldPos: Vec2, text: string): void
  destroy(): void
}
```
- Pool: `Phaser.GameObjects.Text[]`, created lazily up to `CRANK_FEEDBACK.floatPoolSize`; a `next` index; when the pool is full, recycle round-robin (the oldest): first `scene.tweens.killTweensOf(textObj)`.
- Create each with `scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: FLOATING_TEXT.fontSizePx + 'px', color: PALETTE_CSS.mutedOrange, stroke: PALETTE_CSS.ink, strokeThickness: FLOATING_TEXT.strokePx }).setOrigin(0.5).setDepth(DEPTH.floatingText)`.
- `spawn`: pick/recycle a text, `setText(text)`, `setPosition(worldPos.x + (Math.random() - 0.5) * 2 * FLOATING_TEXT.jitterX, worldPos.y + FLOATING_TEXT.spawnOffsetY)`, `setAlpha(1).setVisible(true)`, then `scene.tweens.add({ targets: textObj, y: textObj.y - CRANK_FEEDBACK.floatRisePx, alpha: 0, duration: CRANK_FEEDBACK.floatMs, ease: 'Cubic.easeOut', onComplete: () => textObj.setVisible(false) })`. Never create more than `floatPoolSize` Text objects.
- `destroy()`: kill tweens of pooled texts, destroy them, empty the pool.

`MachineView` (`src/game/entities/MachineView.ts`):
```ts
export class MachineView {
  readonly container: Phaser.GameObjects.Container
  constructor(scene: Phaser.Scene, ctx: GameContext)
  sync(): void                                         // visibility from session.state.techLevels
  getComponentSprite(id: MachineComponentId): Phaser.GameObjects.Sprite | undefined
  getComponentWorldPosition(id: MachineComponentId): Vec2   // machineLocalToWorld(resolveAttachment(MACHINE_COMPONENTS[id]))
  shake(): void
  destroy(): void
}
```
- Constructor: `container = scene.add.container(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y).setScale(PIXEL_SCALE).setDepth(DEPTH.machine)`. For every id in `MACHINE_COMPONENT_IDS`: `def = MACHINE_COMPONENTS[id]; att = resolveAttachment(def); sprite = scene.add.sprite(att.x, att.y, def.assetId).setOrigin(def.origin.x, def.origin.y).setDepth(componentDepth(def));` store in a `Map<MachineComponentId, Phaser.GameObjects.Sprite>` and `container.add(sprite)`. A Phaser container renders children in LIST order, so call `container.sort('depth')` after all are added. Then `sync()`. Subscribe `const off = ctx.session.on('reset', () => this.sync())` and keep it for `destroy()`.
- `sync()`: for each component `sprite.setVisible(isComponentVisible(def, ctx.session.state.techLevels))`. (WP2: only `supportFrame` and `handCrank` are visible; no component is created/destroyed after construction.)
- `shake()`: fields `private readonly shakeOffset = { x: 0 }` and `private shakeTween: Phaser.Tweens.Tween | null = null`. If a tween is running: `shakeTween.stop()`. Reset `shakeOffset.x = 0; container.setPosition(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y)`. Then `shakeTween = scene.tweens.add({ targets: shakeOffset, x: CRANK_FEEDBACK.shakePx * PIXEL_SCALE, duration: CRANK_FEEDBACK.shakeMs / 2, yoyo: true, ease: 'Sine.easeInOut', onUpdate: () => container.setX(MACHINE_ANCHOR.x + shakeOffset.x), onComplete: () => { shakeOffset.x = 0; container.setPosition(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y); shakeTween = null; } })`. The container must return to its EXACT anchor after every shake (an interrupted shake is repaired by the reset at the start of the next one).
- `destroy()`: call the `reset` unsubscribe, stop the shake tween, reset the position, `container.destroy(true)` (destroys the children).

`HandCrank` (`src/game/entities/HandCrank.ts`):
```ts
export class HandCrank {
  constructor(scene: Phaser.Scene, ctx: GameContext, machine: MachineView, floatingText: FloatingText)
  destroy(): void
}
```
- `const sprite = machine.getComponentSprite('handCrank')`; if undefined throw `new Error('handCrank sprite missing')`.
- Input: `sprite.setInteractive({ hitArea: new Phaser.Geom.Circle(cx, cy, CRANK_FEEDBACK.hitRadius), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true })` where hit-area coordinates are texture-local: `cx = MACHINE_COMPONENTS.handCrank.size.width / 2`, `cy = MACHINE_COMPONENTS.handCrank.size.height / 2` (no literals; the radius of 36 art px is deliberately generous).
- Animation config: `const anim = MACHINE_COMPONENTS.handCrank.animation;` if `anim.kind !== 'clickRotate'` throw; use `anim.degreesPerClick` and `anim.tweenMs`.
- `sprite.on('pointerdown', handler)`; the handler:
  1. `const gained = ctx.session.click();` (the ONLY state mutation).
  2. `this.targetAngle += anim.degreesPerClick; this.tween?.stop(); this.tween = scene.tweens.add({ targets: sprite, angle: this.targetAngle, duration: anim.tweenMs, ease: 'Cubic.easeOut', onComplete: () => { sprite.angle = this.targetAngle % 360; this.targetAngle = sprite.angle; this.tween = null; } });` (stopping the old tween keeps rapid clicks responsive; the target accumulates so 20 quick clicks end exactly 1800° from the start).
  3. `floatingText.spawn(machine.getComponentWorldPosition('handCrank'), '+' + formatNumber(gained));`
  4. `machine.shake();`
- `destroy()`: `sprite.off('pointerdown', handler)`, `sprite.disableInteractive()`, stop the tween.

**constraints**: entities never mutate `GameState` except through `session.click()`; no timers (`setTimeout`/`setInterval`); no object creation per click except the bounded floating-text pool and tweens; no magic numbers or `0x` colours; no `override` on lifecycle methods; do not import `ParallaxBackground`/`Terrain`.

**acceptance**: typecheck clean; each click calls `session.click()` exactly once and the HUD ME rises by `rates.perClick` immediately; 20 rapid clicks -> 20×perClick ME, no more than `floatPoolSize` Text objects, at most one live crank tween and one live shake tween; after shakes `container.x/y` equals `MACHINE_ANCHOR` exactly.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -rnE "0x[0-9a-fA-F]{6}" src/game/entities src/game/rendering/FloatingText.ts && echo FAIL || echo OK
grep -rnE "override (init|preload|create|update)\b|setTimeout|setInterval" src/game/entities src/game/rendering/FloatingText.ts && echo FAIL || echo OK
```

---

# WAVE D

## T8 — Scenes, bootstrap, debug hook, main

**objective**: Wire everything together: boot scene (asset loading + fallback textures), world scene, bootstrap with the session lifecycle, a window debug hook for the smoke test, and a thin `main.ts`.

**wave**: D (alone; waves A-C are complete)

**files_owned**: `src/game/scenes/BootScene.ts`, `src/game/scenes/WorldScene.ts`, `src/game/bootstrap.ts`, `src/game/debugHook.ts`, `src/main.ts` (replaces the WP0 placeholder), `public/assets/.gitkeep` (empty file)

**context**: exports to use (all exist): `planAssetLoads` from `src/assets/manifest`; `ensureFallbackTextures` from `src/assets/fallbackTextures`; `ParallaxBackground`, `Terrain`, `DustField`, `CameraController`, `FloatingText` from `src/game/rendering/*`; `MachineView`, `HandCrank` from `src/game/entities/*`; `createHud`, type `Hud` from `src/ui/hud`; `buildHudView` from `src/ui/hudView`; `createSignal` from `src/utils/signal`; type `GameContext` from `src/game/context`; `GameSession, createInitialState` from `src/simulation`; `VIEW` from `src/data/world`; `PALETTE_CSS` from `src/data/palette`; `MACHINE_COMPONENTS` from `src/data/machineComponents`; `resolveAttachment, machineLocalToWorld` from `src/game/math/machineLayout`; `worldToClient` from `src/game/math/camera`.

`BootScene` (`super('Boot')`, no constructor args):
- `preload(): void` — `this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => console.warn('[assets] failed to load', file.key, file.url));` then for each `planAssetLoads()` entry: kind `'spritesheet'` -> `this.load.spritesheet(key, url, { frameWidth: frame.width, frameHeight: frame.height })` (skip if `frame` is undefined), else `this.load.image(key, url)`. Never `console.error`.
- `create(): void` — `ensureFallbackTextures(this); this.scene.start('World');`

`WorldScene` (`super('World')`, constructor `(ctx: GameContext, hud: Hud)` stored as `private readonly` fields). Keep the file under 120 lines.
- `create(): void`: build `ParallaxBackground`, `Terrain`, `DustField`, `MachineView(this, ctx)`, `FloatingText`, `HandCrank(this, ctx, machine, floatingText)`, `CameraController`; keep them in local variables. Push cleanups into `private readonly disposables: Array<() => void>`: each object's `destroy`, and the unsubscribe returned by `ctx.commands.refocus.on(() => camera.refocus())`. `this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { for (const d of this.disposables) d(); this.disposables.length = 0; });`. Render the HUD once: `this.renderHud()`.
- `update(): void`: `this.ctx.session.update();` then `if (this.ctx.session.revision !== this.lastRevision) this.renderHud();`
- `private renderHud(): void`: `this.lastRevision = session.revision; this.hud.render(buildHudView(session.state, session.rates));`. (`lastRevision` starts at -1. The HUD itself only writes changed text, so a revision that advances nearly every frame, because `update()` moves `lastSimTime`, is harmless.)
- Nothing here mutates game state; only `session.state/rates/revision` are read.

`bootstrap.ts`: `export function bootstrap(): Phaser.Game`:
1. `const session = new GameSession({ state: createInitialState(Date.now()) });` (WP4 adds load/save.)
2. `session.applyOffline();` once, BEFORE the loop starts (lifecycle rule).
3. `const ctx: GameContext = { session, commands: { refocus: createSignal(), openTechTree: createSignal() } };`
4. `const root = document.getElementById('ui-root'); if (!root) throw new Error('#ui-root missing');` `const hud = createHud(root, ctx.commands);`
5. `const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: VIEW.width, height: VIEW.height, backgroundColor: PALETTE_CSS.ink, pixelArt: true, roundPixels: true, input: { mouse: { preventDefaultWheel: true } }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [new BootScene(), new WorldScene(ctx, hud)] });`
6. `installDebugHook(session, game); return game;`

`debugHook.ts`:
```ts
declare global { interface Window { __wedtmd?: { session: GameSession; crankClientPoint(): { x: number; y: number } } } }
export function installDebugHook(session: GameSession, game: Phaser.Game): void
```
`crankClientPoint()`: `world = machineLocalToWorld(resolveAttachment(MACHINE_COMPONENTS.handCrank))`; `cam = game.scene.getScene('World').cameras.main`; `rect = game.canvas.getBoundingClientRect()`; return `worldToClient(world, { x: cam.worldView.x, y: cam.worldView.y }, cam.zoom, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, { width: game.scale.gameSize.width, height: game.scale.gameSize.height })`. Assign `window.__wedtmd = { session, crankClientPoint }`. Header comment: "test-only hook, safe to ship".

`main.ts`: only `import { bootstrap } from './game/bootstrap'; bootstrap();`

**constraints**: no `override` on `init/preload/create/update`; no magic numbers/hex literals in `src/game`; scene files thin; every listener/subscription cleaned in `SHUTDOWN`; `public/assets/.gitkeep` is an empty file; do not edit `index.html`.

**acceptance**: `npm run typecheck`, `npm test` and `npm run build` pass; `npm run dev` shows the wasteland, machine and HUD; clicking the crank raises HUD ME immediately; the refocus button recentres; no console errors (verified in T9 by the Director's smoke test).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
npm test
npm run build
grep -rnE "override (init|preload|create|update)\b" src/game && echo FAIL || echo OK
wc -l src/game/scenes/WorldScene.ts   # must be < 120
```

---

# T9 — Integration + validation (Engineering Manager, Mode B; not a worker assignment)

After wave D (and after each earlier wave for its own files): run `npm run typecheck && npm test && npm run build`, then the three grep checks from `WP2.md` ("Package acceptance / validation commands"). Walk every task's acceptance list against the code. Specific glue checks:
- painter export names in `background.ts` / `machine.ts` / `generic.ts` match what `fallbackTextures.ts` imports; every `AssetId` ends with a texture (BootScene logs the generated ids).
- `PARALLAX_LAYERS[*].underfill` matches the bottom-row colour of the corresponding painter (mountains `industrialGray`, skyline `grayDark`).
- `MACHINE_COMPONENTS[*].size` equals manifest dimensions (test in `manifest.test.ts`); the crank hub position in `paintFrame` (30,48) corresponds to socket `crankHub` (-70,-62) (frame texture origin (0.5, 1): local x = 30 - 100, y = 48 - 110).
- no `override` on lifecycle methods; no `0x` literals in `src/game`; no Phaser imports in pure dirs.
Emit fix assignments in the same format for failures. Then the Director runs the headless smoke test per `WP2.md` and updates `docs/PROJECT_STATUS.md`.

# Risks / notes for the Director

1. **Wave A cross-imports**: T0b imports from T0a files and `painterTypes.ts` imports `AssetEntry` from T0b. Tsc errors between the two are expected inside the wave; validate wave A as a whole before starting B.
2. **Painters cannot be tested in node** (Phaser needs a browser). Visual correctness of T2/T2b is only checked in T9 screenshots. Expect one tuning iteration (seam visibility in `bg.*`, haze position vs the horizon). Keep the first fix round targeted (one painter constant), not a rewrite.
3. **Parallax correctness is math-derived** (`parallaxSpan` formula, `bottomY = GROUND_Y + 200`, underfill). If a gap appears at an extreme in the screenshots, first check T1's brute-force test and the `underfill`/`bottomY` values in `world.ts` before touching renderers. WP2.md's acceptance sentence "span widens as sf to 0" is wrong; the corrected expectations are in T1.
4. **Phaser 3.90 APIs verified against the installed typings**: `TileSprite.setTileScale`, `ParticleEmitterConfig.maxAliveParticles`, `ParticleEmitter.fastForward`, `Texture.setFilter`, `InputConfig.mouse.preventDefaultWheel` exist. `Graphics.generateTexture` is used from an off-scene `scene.make.graphics(..., false)` object.
5. **`session.revision` advances nearly every frame** because `update()` moves `lastSimTime` each frame (a `setState` on a time-only change). Gating HUD renders on revision therefore saves little; the HUD's own text diff is what prevents DOM writes. A one-line WP1 follow-up (do not bump revision when only `lastSimTime` changes) would make the gate effective; not required for WP2.
6. **Hit testing of a rotating/scaled crank inside a Container**: the circle hit area is texture-local and centred, so rotation does not change it, and container scale 2 is handled by Phaser's input transform. If clicks miss in the smoke test, check that `setInteractive` is called after the sprite was added to the container.
7. **Haiku-difficulty hot spots**: T1 (parallaxSpan + brute-force test), T6 (state-owned camera + counter tween), T2/T2b painters (long literal specs). If one returns `partial`, send a targeted fix assignment listing the failing tests or screenshot defect instead of re-running the whole task.
8. **Contract additions** beyond `WP2.md` (all additive, listed in the deviations section) belong in the WP2 status entry: `PARALLAX_BOTTOM_MARGIN`, `HORIZON_STRIP`, `FLOATING_TEXT`, `CRANK_FEEDBACK.hitRadius`, `DUST.spawnTopY/spawnBottomY`, `PaletteKey`, `componentBounds`, `painters/{painterTypes,draw,rng,generic}.ts`.
