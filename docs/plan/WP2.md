# Work Package 2: World + Interactive Crank

Goal: the game boots into a pannable/zoomable wasteland with a rusty machine frame whose hand crank, when clicked, calls `GameSession.click()` with visible feedback, while an HTML terminal HUD shows ME, ME/click and ME/s live. All art is procedural and resolved through a central asset registry, so PixelLab PNGs can replace it later via the manifest alone.

Builds on WP1 (unchanged): `GameSession` (`click(): number`, `update(nowMs?)`, `state`, `rates`, `on(type, fn)`), `createInitialState(nowMs)`, `formatNumber(n, mode?)`, `formatRate(n)`, all from `src/simulation/index.ts` / `src/utils/format.ts`.

## Conventions (all tasks)
- Phaser 3.90: **no `override`** on `init/preload/create/update`. Scenes receive dependencies through their constructor (`new WorldScene(ctx)`), not the registry.
- Pure modules (no Phaser, no DOM): `src/data/**`, `src/utils/**`, `src/game/math/**`, `src/assets/manifest.ts`, `src/assets/assetIds.ts`, `src/ui/hudView.ts`. Only these get unit tests.
- Every visual tuning number lives in `src/data/world.ts`, `src/data/palette.ts` or `src/data/machineComponents.ts`. No magic numbers in scenes or entities.
- **Coordinate systems:** *World px* = the logical 2560×1440 world (origin top-left, +y down). *Art px* = source-texture pixels. Everything on the machine is positioned in **machine-local art px**: origin = centre of the frame base on the ground line, +x right, +y down (so parts sit at negative y). The machine container sits at `MACHINE_ANCHOR` and is scaled by `PIXEL_SCALE`, so `world = MACHINE_ANCHOR + local × PIXEL_SCALE`. Children use scale 1, keeping every part on the art pixel grid.
- Texture key == asset id. Gameplay and rendering code only uses asset ids, never file paths.

## Contracts (written by T0; everyone else codes against these exactly)

`src/data/world.ts`
```ts
export const VIEW = { width: 1280, height: 720 } as const;
export const WORLD = { width: 2560, height: 1440 } as const;
export const GROUND_Y = 1120;                                // world px of the horizon/ground line
export const PIXEL_SCALE = 2;                                // art px -> world px
export const MACHINE_ANCHOR = { x: 1280, y: GROUND_Y } as const;
export const CAMERA = { focus: { x: 1280, y: GROUND_Y - 160 }, defaultZoom: 1, maxZoom: 2,
  wheelZoomFactor: 1.1, dragThresholdPx: 4, refocusMs: 450 } as const; // minZoom = minZoomToFit(VIEW, WORLD) = 0.5
export interface ParallaxLayerDef { id: string; assetId: AssetId; scrollFactor: number;
  bottomY: number /* world y where the texture bottom appears at default focus */; depth: number;
  alpha: number; underfill: number | null /* colour filled below the texture so panning shows no gaps */ }
export const PARALLAX_LAYERS: readonly ParallaxLayerDef[]; // sky 0, mountains/ruins 0.15, skyline 0.3, pylons 0.55
export const GROUND_LAYER = { assetId: 'terrain.ground', depth: 0 } as const; // scrollFactor 1, GROUND_Y..WORLD.height
export const DUST: { maxParticles: number; frequencyMs: number; lifespanMs: [number, number];
  speedX: [number, number]; speedY: [number, number]; alpha: [number, number]; scale: [number, number]; depth: number };
export const CRANK_FEEDBACK = { degreesPerClick: 90, tweenMs: 160, shakePx: 1, shakeMs: 60,
  floatRisePx: 48, floatMs: 700, floatPoolSize: 24 } as const;
export const DEPTH = { background: -100, ground: 0, machine: 100, dust: 200, floatingText: 300 } as const;
```
`src/data/palette.ts` — `PALETTE` hex numbers: `sand, dirtyBeige, rust, rustDark, industrialGray, grayDark, mutedOrange, skyTop, skyHaze, ink` + `PALETTE_CSS` (same as `#rrggbb` strings for the HUD).

`src/assets/assetIds.ts`
```ts
export const ASSET_IDS = ['bg.sky','bg.mountains','bg.skyline','bg.pylons','terrain.ground','fx.dust',
  'machine.frame','machine.crank','machine.gearSmall','machine.gearLarge','machine.flywheel',
  'machine.motor','machine.piston','fx.steam'] as const;
export type AssetId = typeof ASSET_IDS[number];
```
`src/assets/manifest.ts` (pure)
```ts
export interface AssetEntry {
  id: AssetId;
  file: string | null;            // path under public/assets/ (e.g. 'machine/hand-crank.png'); null = procedural only
  width: number; height: number;  // source art px; the fallback is generated at this size; replacements must match
  origin: { x: number; y: number };
  tileable: 'none' | 'x' | 'xy';
  frame?: { width: number; height: number; count: number }; // spritesheet entries (WP3+)
  description: string;            // feeds ASSET_GUIDE.md in WP5
}
export const ASSET_MANIFEST: Record<AssetId, AssetEntry>; // all `file: null` in WP2
export interface AssetLoad { key: AssetId; url: string; kind: 'image' | 'spritesheet'; frame?: AssetEntry['frame'] }
export function resolveAssetUrl(entry: AssetEntry, baseUrl?: string /* 'assets/' */): string | null;
export function planAssetLoads(manifest?: Record<AssetId, AssetEntry>, baseUrl?: string): AssetLoad[];
export function missingTextureIds(has: (key: string) => boolean, ids?: readonly AssetId[]): AssetId[];
```
`src/data/machineComponents.ts` (data contract for WP3; WP2 renders only `supportFrame` + `handCrank`)
```ts
export const MACHINE_COMPONENT_IDS = ['supportFrame','handCrank','gearSmall','gearLarge',
  'flywheel','wornMotor','pistonArray'] as const;
export type MachineComponentId = typeof MACHINE_COMPONENT_IDS[number];
export const SOCKET_IDS = ['crankHub','smallGearHub','largeGearHub','flywheelHub','motorMount','pistonBed'] as const;
export type SocketId = typeof SOCKET_IDS[number];
export interface Vec2 { x: number; y: number }
export type MachineLayer = 'back' | 'frame' | 'mid' | 'front';
export const MACHINE_LAYER_DEPTH: Record<MachineLayer, number>; // back 0, frame 10, mid 20, front 30
export type AnimationDriver = 'manual' | 'automation';          // drives from perClick events / perSecond
export interface SpeedCurve { base: number; gain: number; min: number; max: number }
export type ComponentAnimation =
  | { kind: 'none' }
  | { kind: 'clickRotate'; degreesPerClick: number; tweenMs: number }                 // hand crank
  | { kind: 'rotate'; driver: AnimationDriver; direction: 1 | -1; speed: SpeedCurve } // deg/s
  | { kind: 'reciprocate'; driver: AnimationDriver; axis: 'x' | 'y'; amplitude: number; speed: SpeedCurve } // cycles/s
  | { kind: 'vibrate'; driver: AnimationDriver; amplitude: number; speed: SpeedCurve };
export interface ConnectionPoint { id: string; at: Vec2 /* component-local art px from pivot */; kind: 'shaft' | 'belt' | 'pipe' }
export interface ProductionEffect { kind: 'vibrate' | 'glow' | 'dust' | 'steam'; driver: AnimationDriver;
  threshold: number /* driver value at which it starts */; intensity: number }
export interface MachineComponentDefinition {
  id: MachineComponentId; techId: TechId; minLevel: number;  // visible when techLevels[techId] >= minLevel
  assetId: AssetId; attach: { socket: SocketId | null; offset: Vec2 }; // null = machine origin
  size: { width: number; height: number };                   // art px, must equal manifest dims
  origin: Vec2;                                               // normalised pivot
  layer: MachineLayer; animation: ComponentAnimation;
  connections: ConnectionPoint[]; effects: ProductionEffect[];
}
export interface MachineLink { from: { component: MachineComponentId; point: string };
  to: { component: MachineComponentId; point: string }; kind: ConnectionPoint['kind'] }
export const MACHINE_BOUNDS: { left: number; right: number; top: number; bottom: number }; // art px, e.g. -200/200/-260/0
export const MACHINE_SOCKETS: Record<SocketId, Vec2>;      // fixed attachment points on the frame (machine-local art px)
export const MACHINE_COMPONENTS: Record<MachineComponentId, MachineComponentDefinition>;
export const MACHINE_LINKS: readonly MachineLink[];         // [] in WP2; WP3 fills
```
`supportFrame`: techId `handCrank`, socket `null`, origin (0.5, 1), layer `frame`, ~200×110 art px. `handCrank`: techId `handCrank`, socket `crankHub`, origin (0.5, 0.5), layer `front`, `clickRotate` using `CRANK_FEEDBACK`. WP3 entries hold provisional sockets/sizes/animations that fit `MACHINE_BOUNDS`; WP3 tunes them and adds links.

`src/utils/signal.ts` — `createSignal<T = void>(): { emit(v: T): void; on(fn: (v: T) => void): () => void }` (a throwing listener is logged and skipped).
`src/game/context.ts`
```ts
export interface GameContext { session: GameSession;
  commands: { refocus: Signal<void>; openTechTree: Signal<void> } }
```

## Tasks

- **T0 Contracts + data** — files: `src/data/world.ts`, `src/data/palette.ts`, `src/data/machineComponents.ts`, `src/assets/assetIds.ts`, `src/assets/manifest.ts` (types + `ASSET_MANIFEST` data + function signatures implemented in T2; T0 may stub with `throw`), `src/utils/signal.ts` (+ `signal.test.ts`), `src/game/context.ts`. Depends on: WP1.
  Acceptance: exports match the contracts exactly; `npm run typecheck` passes; signal test covers emit/unsubscribe/throwing listener; no Phaser imports.
- **T1 Camera + parallax math (pure)** — `src/game/math/camera.ts` + `camera.test.ts`, `src/game/math/parallax.ts` + `parallax.test.ts`. Depends on: T0.
  Functions: `minZoomToFit(view, world): number`; `clampZoom(z, min, max)`; `clampCenter(center, zoom, view, world): Vec2` (keeps the visible rect `view/zoom` inside the world; centres an axis if the view is larger than the world); `zoomAroundPoint(center, pointerWorld, oldZoom, newZoom): Vec2` (pointer's world point stays fixed); `wheelToZoom(zoom, deltaY, factor, min, max)`; `dragToCenter(startCenter, dragScreenDelta, zoom): Vec2`; `worldToClient(world, worldView:{x,y}, zoom, canvasRect:{left,top,width,height}, gameSize:{width,height}): Vec2`; `parallaxPosition(worldPos, focus, viewSize, sf)` = `worldPos − (1−sf)(focus − viewSize/2)` (layer appears at `worldPos` when centred on focus); `parallaxSpan(worldLen, viewLen, minZoom, sf): {min, max}` (layer-local range visible over all clamped camera positions/zooms).
  Acceptance: `minZoomToFit(VIEW, WORLD) === 0.5`; clampCenter never lets the view rect leave the world at zoom 0.5/1/2 and returns the world centre at minZoom; zoomAroundPoint invariant holds (±1e-9); wheel up/down respect min/max; `parallaxSpan(…, sf=1)` = `[0, worldLen]`, span widens as sf→0; `parallaxPosition` identity at sf=1; worldToClient maps view centre to canvas centre and scales with CSS size.
- **T2 Asset registry + procedural fallbacks** — `src/assets/manifest.ts` (implement functions), `src/assets/manifest.test.ts`, `src/assets/fallbackTextures.ts` (Phaser), `src/assets/painters/background.ts`, `src/assets/painters/machine.ts`. Depends on: T0.
  `fallbackTextures.ts`: `ensureFallbackTextures(scene: Phaser.Scene): AssetId[]` generates via `Graphics.generateTexture(id, w, h)` every id in `missingTextureIds(k => scene.textures.exists(k))`, using a bespoke painter if one exists or a generic labelled rust-plate painter otherwise; returns the generated ids. Painters `(g: Phaser.GameObjects.Graphics, entry: AssetEntry) => void`, `PALETTE` only. Bespoke painters: sky (desaturated gradient bands + haze), mountains/ruins silhouette, ruined skyline (broken towers, few dim windows), pylons + sagging wires (horizontally tileable), cracked terrain (tileable), dust (2–3 px blob), frame (riveted rusty girders), crank (hub + arm + handle radiating from the centre). Gears get a simple toothed-circle painter; the other WP3 ids use the generic painter.
  Acceptance: tests check that every `ASSET_IDS` entry has a manifest entry with matching `id`, positive integer dims and an origin in [0,1]; `resolveAssetUrl` returns null for `file: null` and `'assets/<file>'` otherwise; `planAssetLoads` skips null files and picks `spritesheet` when `frame` exists; `missingTextureIds` works; every non-null `file` exists on disk (checked with `import.meta.glob('/public/assets/**/*.png')`, no Node types); `machineComponents` `size` equals the manifest dims of its `assetId`. Tileable textures have widths that are multiples of their pattern period.
- **T3 HUD (HTML/CSS)** — `src/ui/hudView.ts` + `hudView.test.ts`, `src/ui/hud.ts`, `src/ui/hud.css`. Depends on: T0.
  `buildHudView(state: GameState, rates: ProductionRates): HudView` with `HudView = { me: string; perClick: string; perSecond: string }` (`formatNumber(me)`, `formatNumber(perClick)`, `formatRate(perSecond)`). `createHud(root: HTMLElement, commands: GameContext['commands']): { render(view: HudView): void; destroy(): void }`. `render` only writes `textContent` that changed. Element ids: `#hud-me`, `#hud-per-click`, `#hud-per-second`, `#hud-tech`, `#hud-refocus`. Tech button: visible but marked `aria-disabled`, with tooltip "TECH INDEX — ACCESS PENDING"; it still emits `openTechTree`. Refocus emits `refocus`.
  Style: industrial terminal look (dark iron panel, rust border, amber monospace text, uppercase labels, subtle scanlines, system monospace fonts only, no remote assets). `#ui-root` stays `pointer-events:none`; only the panel and buttons are `auto`. Top-left readout and a bottom-right button cluster, both usable at 1280×720 and when the window is resized.
  Acceptance: hudView tests (initial "0" / "1" / "0/s"; 1500 ME → "1.5K"); no Phaser import in `src/ui`.
- **T4 Machine layout + animation math (pure)** — `src/game/math/machineLayout.ts` + test, `src/game/math/animation.ts` + test, `src/data/machineComponents.test.ts`. Depends on: T0.
  `resolveAttachment(def, sockets = MACHINE_SOCKETS): Vec2` (socket + offset, machine-local art px); `machineLocalToWorld(p, anchor = MACHINE_ANCHOR, scale = PIXEL_SCALE): Vec2`; `isComponentVisible(def, techLevels)`; `componentDepth(def)`; `animationSpeed(curve: SpeedCurve, driverValue: number): number` = `driverValue <= 0 || !finite ? 0 : clamp(base × (1 + gain × log10(1 + v)), min, max)`.
  Acceptance: data tests check that ids and connection-point ids are unique, every `techId` is in `TECH_IDS`, every referenced socket exists, each component's bounding box (from attachment + size + origin) lies inside `MACHINE_BOUNDS`, `minLevel ≥ 1`, and `SpeedCurve` has `min ≤ max`. Also: animationSpeed is 0 at v=0 and for NaN, monotonic, never above `max` even at v=1e12, never below `min` for v>0. `supportFrame` + `handCrank` are visible in `createInitialState`; the others are not.
- **T5 Wasteland rendering** — `src/game/rendering/ParallaxBackground.ts`, `src/game/rendering/Terrain.ts`, `src/game/rendering/DustField.ts`. Depends on: T1, T2.
  ParallaxBackground builds one `TileSprite` per `PARALLAX_LAYERS` entry. Width comes from `parallaxSpan` (x) and `x`/`y` from `parallaxPosition`. It uses `setScrollFactor(sf)` and a solid underfill rectangle when `underfill !== null`. The sky (sf 0) covers `VIEW / minZoom` around the view centre. Terrain: a ground `TileSprite` from `GROUND_Y` to `WORLD.height` across the world width, plus a thin darker horizon strip. DustField: a Phaser particle emitter (`fx.dust`) driven by `DUST`, with slow sideways drift and low alpha across the visible world above the ground, capped at `maxParticles`.
  Acceptance: no sky/background gaps at the four pan extremes for zoom 0.5, 1 and 2 (Director screenshots); layers move at visibly different rates while panning; nothing in these classes reads or writes game state.
- **T6 Camera controller** — `src/game/rendering/CameraController.ts`. Depends on: T1.
  `new CameraController(scene)`: sets bounds `WORLD`, zoom `defaultZoom`, centres on `CAMERA.focus`. Drag-pan with the left/middle mouse button starts only when the `pointerdown` has an empty `currentlyOver` (so clicking the crank never pans) and the pointer moves more than `dragThresholdPx`. Wheel zooms around the pointer via `wheelToZoom` + `zoomAroundPoint` + `clampCenter`. `refocus()` pans/zooms to the focus over `refocusMs`, and an active drag/wheel cancels it. `destroy()` removes the listeners.
  Acceptance: zoom stays within [0.5, 2]; the view never leaves the world; refocus works from any extreme; the page itself does not scroll on wheel.
- **T7 Machine entities + click feedback** — `src/game/entities/MachineView.ts`, `src/game/entities/HandCrank.ts`, `src/game/rendering/FloatingText.ts`. Depends on: T2, T4.
  `MachineView(scene, ctx)`: a container at `MACHINE_ANCHOR`, scale `PIXEL_SCALE`, depth `DEPTH.machine`. It creates sprites for visible components from `MACHINE_COMPONENTS` (WP2: frame + crank), placed with `resolveAttachment`, `origin` and `componentDepth`, and exposes `shake()`, `getComponentWorldPosition(id)` and `destroy()`. `HandCrank`: an interactive sprite with a generous circular hit area and hand cursor. On `pointerdown` it calls `ctx.session.click()`, then (a) accumulates a target angle `+degreesPerClick` and tweens to it (`tweenMs`, killing the previous tween so rapid clicks stay responsive), (b) calls `FloatingText.spawn(worldPos, '+' + formatNumber(gained))`, (c) calls `MachineView.shake()` (±`shakePx` art px yoyo over `shakeMs`, never drifting). FloatingText: pooled `Text` objects (`floatPoolSize`, recycling the oldest), monospace, `mutedOrange`, rising `floatRisePx` and fading over `floatMs`, depth `DEPTH.floatingText`.
  Acceptance: each click on the crank adds exactly `rates.perClick` ME; 20 rapid clicks produce 20 ME and no runaway tweens/objects (pool bounded); after shakes the frame returns to its exact position; entities never mutate `GameState` except through `session.click()`.
- **T8 Scenes + bootstrap + main loop** — `src/game/scenes/BootScene.ts`, `src/game/scenes/WorldScene.ts`, `src/game/bootstrap.ts`, `src/game/debugHook.ts`, `src/main.ts` (reduced to `bootstrap()`), `public/assets/.gitkeep`. Depends on: T3, T5, T6, T7.
  `bootstrap()`: `const session = new GameSession({ state: createInitialState(Date.now()) })` (WP4 adds load/save), builds `GameContext`, `createHud(#ui-root, ctx.commands)`, starts `Phaser.Game` (`parent 'game'`, `VIEW` size, `pixelArt: true`, `roundPixels: true`, FIT + CENTER_BOTH, scenes `[new BootScene(), new WorldScene(ctx, hud)]`). BootScene: `preload` queues `planAssetLoads()` and logs `FILE_LOAD_ERROR` with `console.warn` (never error); `create` runs `ensureFallbackTextures(this)` and then starts `World`. WorldScene `create` builds the background, terrain, dust, machine, crank, floating text and camera, and subscribes `commands.refocus → camera.refocus()`. WorldScene `update`: `ctx.session.update()` then `hud.render(buildHudView(session.state, session.rates))`. Scene files stay thin (<120 lines), and listeners/subscriptions are cleaned up on scene `shutdown`. `debugHook.ts` installs `window.__wedtmd = { session, crankClientPoint(): {x,y} }` (uses `worldToClient`; typed via `declare global`) for the smoke test.
  Acceptance: `npm run dev` shows the wasteland, the machine and the HUD; clicking the crank raises the HUD ME immediately; the refocus button recentres; no console errors.
- **T9 Integration + validation (EM, Mode B)** — fix glue mismatches and run all the checks below. Depends on: T0–T8.

Waves: A = T0 → B (parallel 4) = T1, T2, T3, T4 → C (parallel 3) = T5, T6, T7 → D = T8 → E = T9.
File ownership is exclusive per task as listed. Only T2 edits `manifest.ts` after T0, and only T8 edits `main.ts`.

## Package acceptance / validation commands
```
npm run typecheck && npm test && npm run build
grep -rnE "from ['\"]phaser" src/simulation src/data src/persistence src/utils src/game/math src/ui src/assets/manifest.ts src/assets/assetIds.ts && echo FAIL || echo OK
grep -rnE "override (init|preload|create|update)\b" src/game && echo FAIL || echo OK
grep -rnE "0x[0-9a-fA-F]{6}" src/game && echo "WARN: colours outside palette" || echo OK
```
Headless smoke test (Director; Playwright Chromium from `/opt/pw-browsers`, script kept in the scratchpad, **not** added to package.json). Run against `npm run build && npx vite preview`. Checks: the page loads; a `canvas` exists inside `#game`; `#hud-me` shows "0". Then call `window.__wedtmd.crankClientPoint()` and do 5 mouse clicks there, after which `#hud-me` shows "5" and `#hud-per-click` shows "1". Wheel and drag must not throw. Clicking `#hud-refocus` works. Zero `console.error`/`pageerror` events and no failed network requests. Screenshots at default view, at zoom 0.5 and at a zoomed-in pan extreme confirm the layered wasteland and machine.
Also update `docs/PROJECT_STATUS.md` (WP2 done, decisions: coordinate system, texture key = asset id, constructor-injected context).

## Out of scope for this package
Tech tree UI (the button stays a placeholder), rendering WP3 components, component manager/unlock assembly animations, automation-driven animation, shafts/belts drawing, save/load/autosave/offline UI, notifications/story logs, audio and the mute toggle, settings/reset, real PixelLab PNGs, `docs/ASSET_GUIDE.md`, balance changes, new npm dependencies.
