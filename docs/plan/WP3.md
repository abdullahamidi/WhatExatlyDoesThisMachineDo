# Work Package 3: Tech Tree + Machine Growth

Goal: the player opens a terminal-style TECH INDEX overlay from the HUD and buys technologies there. Each new technology bolts a moving part onto the machine (assembly drop + dust puff). The parts turn, vibrate or pump at clamped speeds driven by clicking and ME/s, and are joined by drawn shafts and belts. Short thematic toasts confirm purchases, installs and the Generator Blueprint milestone.

Builds on WP1 and WP2 (both complete; no WP1 simulation code changes). These are used exactly as they exist:
`GameSession` (`purchase(id): PurchaseResult`, `getAllTechViews()`, `state`, `rates`, `revision`, `on('click'|'purchase'|'unlock'|'milestone'|'reset')`), `TechView`/`TechStatus`/`PurchaseFailure` (`src/data/types.ts`), `TECHNOLOGIES`/`TECH_LIST`, `formatCost`/`formatNumber`/`formatRate` (`src/utils/format.ts`), `MACHINE_COMPONENTS`/`MACHINE_SOCKETS`/`MACHINE_LINKS`/`MACHINE_LAYER_DEPTH` (`src/data/machineComponents.ts`), `resolveAttachment`/`componentDepth`/`isComponentVisible`/`componentBounds` (`src/game/math/machineLayout.ts`), `animationSpeed` (`src/game/math/animation.ts`), `GameContext`/`GameCommands` (`src/game/context.ts`), `createHud`/`Hud` (`src/ui/hud.ts`), `MachineView`, `HandCrank`, `WorldScene`, `installDebugHook`.
Facts from the repo: the PNGs in `public/assets/machine/` match the manifest sizes. In machine-local art px the frame PNG has post tops at y=-68, a top beam from y=-48 to -38, a base plate from y=-10 to 0, and posts at x≈-55/0/+50. Gears, flywheel and crank rotate about their sprite centre. `docs/PROJECT_STATUS.md` still says "WP2 planning", so the Director refreshes it at the end of this package.

## Conventions (all tasks)
- Pure (no Phaser, no DOM, unit-tested): `src/data/**`, `src/game/math/**`, `src/ui/techTreeView.ts`, `src/ui/notificationRules.ts`. DOM modules in `src/ui/` never import Phaser.
- All tuning numbers (motion, assembly, link style, toast timing, message text) live in `src/data/`. Tree layout numbers live in `TECH_TREE_LAYOUT` (pure, in `techTreeView.ts`).
- Phaser 3.90: no `override` on `create`/`preload`/`init`. `WorldScene.update` keeps its existing `override` and gains `(_time: number, delta: number)`.
- Rendering never mutates `GameState`. The only new mutation path is `session.purchase(id)`, called from the tech tree.
- The UI style reuses the WP2 HUD variables (`--iron-2`, `--rust`, `--amber`, …) with system monospace fonts and no remote assets.

## Contracts

`src/data/machineComponents.ts` (T1; additive except the WP2 "no links" test)
```ts
export type AnimationDriver = 'manual' | 'automation' | 'combined';
// manual = smoothed ME/s from recent clicks; automation = session.rates.perSecond; combined = manual + automation
export interface ConnectionPoint { id: string; at: Vec2; kind: 'shaft' | 'belt' | 'pipe'; radius?: number /* belt pulley radius, art px */ }
export interface MachineComponentDefinition { /* existing fields */ flipX?: boolean /* mirror sprite + connection x */ }
export const MACHINE_MOTION = { manualTauSeconds: 0.75, maxFrameSeconds: 0.1, restThreshold: 0.05 } as const;
export const MACHINE_ASSEMBLY = { durationMs: 700, dropArtPx: 28, startScale: 0.4, ease: 'Back.easeOut',
  puffCount: 12, puffSpreadArtPx: 18, puffRiseArtPx: 10, puffMs: 650 } as const;
export const MACHINE_LINK_STYLE = { depth: 15 /* between frame 10 and mid 20 */, width: { shaft: 3, belt: 2, pipe: 4 },
  color: { shaft: PALETTE.industrialGray, belt: PALETTE.grayDark, pipe: PALETTE.rustDark }, outline: PALETTE.ink } as const;
export const MACHINE_LINKS: readonly MachineLink[]; // filled (see T1)
```
`src/game/math/animation.ts` (T4, additions next to `animationSpeed`)
```ts
export function decayActivity(value: number, dtSeconds: number, tauSeconds: number): number; // value·e^(−dt/τ); dt<=0 → value; result < 1e-3 → 0
export function addActivity(value: number, gained: number, tauSeconds: number): number;      // value + gained/τ (steady clicking → ≈ ME/s); ignores gained<=0/non-finite
export function driverValue(driver: AnimationDriver, manual: number, automation: number): number; // combined = manual + automation
export function clampFrameSeconds(deltaMs: number, maxSeconds: number): number;             // [0, max], NaN → 0
export function advanceAngle(deg: number, degPerSecond: number, direction: 1 | -1, dtSeconds: number): number; // wrapped to [0,360)
export function advancePhase(phase: number, cyclesPerSecond: number, dtSeconds: number): number;              // wrapped to [0,1)
export function reciprocateOffset(phase: number, amplitude: number): number; // round(−amplitude·(1−cos 2πφ)/2): 0 at φ=0, −amplitude at φ=0.5
export function vibrateOffset(phase: number, amplitude: number): Vec2;       // integer art px, |x|,|y| ≤ amplitude, deterministic (sin-based)
```
`src/game/math/machineLinks.ts` (T4)
```ts
export function connectionOffset(def: MachineComponentDefinition, pointId: string): Vec2 | null; // `at`, x mirrored when flipX
export function resolveConnectionPoint(def: MachineComponentDefinition, pointId: string, sockets?: Record<SocketId, Vec2>): Vec2 | null; // resolveAttachment + offset
export function linkSegments(kind: ConnectionPoint['kind'], a: Vec2, ra: number, b: Vec2, rb: number): Array<[Vec2, Vec2]>;
// shaft/pipe → [[a,b]]; belt → the 2 outer tangent segments of circles (a,ra),(b,rb); degenerate (d<=|ra−rb| or both radii 0) → [[a,b]]
```
`src/ui/techTreeView.ts` (T2, pure)
```ts
export const TECH_TREE_LAYOUT = { nodeWidth: 176, nodeHeight: 68, colGap: 48, rowGap: 28, padding: 20 } as const;
export type TechKindLabel = 'ORIGIN' | 'UNLOCK' | 'REPEATABLE' | 'MILESTONE';
export type BuyState = 'buy' | 'insufficient' | 'locked' | 'maxed' | 'owned' | 'automatic';
export interface TechNodeView { id: TechId; name: string; status: TechStatus; kindLabel: TechKindLabel; milestone: boolean;
  levelText: string; costText: string | null; affordable: boolean; selected: boolean; x: number; y: number; width: number; height: number }
export interface TechEdgeView { key: string /* `${from}->${to}` */; from: TechId; to: TechId; met: boolean; d: string }
export interface TechDetailView { id: TechId; name: string; kindLabel: TechKindLabel; statusLabel: 'LOCKED' | 'AVAILABLE' | 'PURCHASED' | 'MAXED' | 'ACHIEVED';
  description: string; flavor: string | null; requirements: Array<{ label: string; met: boolean }>; levelText: string;
  currentEffect: string; nextEffect: string | null; costText: string | null;
  buyState: BuyState; buyLabel: string; buyEnabled: boolean /* true for 'buy' and 'insufficient' */; shortfallText: string | null }
export interface TechTreeView { width: number; height: number; meText: string; nodes: TechNodeView[]; edges: TechEdgeView[]; detail: TechDetailView | null }
export function techNodePosition(tree: { col: number; row: number }, layout?: typeof TECH_TREE_LAYOUT): { x: number; y: number };
export function edgePath(from: TechNodeView, to: TechNodeView): string; // `M x1 y1 C mx y1, mx y2, x2 y2`, from right-mid of `from` to left-mid of `to`
export function defaultSelection(views: readonly TechView[]): TechId;   // first affordable, else first 'available' non-starting, else 'handCrank'
export function buildTechTreeView(views: readonly TechView[], me: number, selected: TechId | null, layout?: typeof TECH_TREE_LAYOUT): TechTreeView;
export function purchaseFailureText(reason: PurchaseFailure, shortfall: number): string;
```
Texts: levelText is `LV 3/25` for repeatables (`∞` when `maxLevel` is null), `INSTALLED`/`NOT INSTALLED` for unlock/starting, `ACHIEVED`/`PENDING` for milestones. costText is `formatCost(nextCost) + ' ME'` or null. buyLabel per state: buy → `PURCHASE — <costText>`; insufficient → `INSUFFICIENT ME`, with shortfallText `NEED <formatCost(cost − me)> MORE ME`; locked → `REQUIREMENTS UNMET`; maxed → `MAXIMUM LEVEL`; owned → `INSTALLED`; automatic → `MILESTONE — AUTOMATIC`. Edges come from every `tech` requirement (10 in total). `lifetimeMe` requirements appear only in the detail list.

`src/data/notifications.ts` + `src/ui/notificationRules.ts` (T3)
```ts
export type ToastTone = 'info' | 'system' | 'milestone';
export interface ToastMessage { key: string; title: string; body: string | null; tone: ToastTone; durationMs: number }
export const TOAST_CONFIG = { maxVisible: 3, durationMs: 3200, milestoneDurationMs: 6500, fadeMs: 250 } as const;
export const FIRST_CLICK_MESSAGE = 'Manual operation detected.';
export const INSTALL_LINES: Record<TechId, string>; // one terse line per tech, e.g. wornMotor 'Synchronization unsuccessful.', generatorBlueprint 'Primary function: UNKNOWN.'
// notificationRules.ts
export type NotificationEvent = { type: 'click'; totalClicks: number } | { type: 'purchase'; id: TechId; level: number }
  | { type: 'unlock'; id: TechId } | { type: 'milestone'; id: TechId };
export function messageFor(event: NotificationEvent): ToastMessage | null;
```
Rules:
- click → a toast only when `totalClicks === 1` (system, key `first-click`).
- purchase at level 1 → null (the unlock toast covers it). Level ≥2 → info `<NAME> — LV n`, key `purchase:<id>`, so repeated buys replace the toast instead of stacking.
- unlock of a milestone-kind tech → null. Any other unlock → info `INSTALLED: <NAME>`, body from `INSTALL_LINES`.
- milestone → tone `milestone`, title `MILESTONE: <NAME>`, `milestoneDurationMs`.

DOM / Phaser APIs (T5–T8)
```ts
// src/ui/techTree.ts
export interface TechTree { open(): void; close(): void; isOpen(): boolean; update(): void; destroy(): void }
export function createTechTree(root: HTMLElement, session: GameSession, commands: GameCommands): TechTree;
// src/ui/toasts.ts
export interface Toasts { show(msg: ToastMessage): void; destroy(): void }
export function createToasts(root: HTMLElement, config?: typeof TOAST_CONFIG): Toasts;
export function connectNotifications(session: GameSession, toasts: Toasts): () => void; // subscribes click/purchase/unlock/milestone → messageFor
// src/game/entities/MachineAnimator.ts
export class MachineAnimator { constructor(session: GameSession, sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>);
  update(deltaMs: number, isActive: (id: MachineComponentId) => boolean): void; getDriverValues(): { manual: number; automation: number }; destroy(): void }
// src/game/rendering/MachineLinks.ts
export class MachineLinks { constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container);
  draw(pointOf: (component: MachineComponentId, pointId: string) => Vec2 | null): void; destroy(): void }
// MachineView additions
update(deltaMs: number): void; isAssembling(id: MachineComponentId): boolean;
getComponentState(id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number };
```

## Tasks

- **T1 Machine data: layout, links, drivers** — files: `src/data/machineComponents.ts`, `src/data/machineComponents.test.ts`. Depends on: WP2.
  Add the contract types and constants, then tune sockets and links so the 7 parts form one machine:
  - Motor on the ground left of the frame, crank on the left post at beam height (front layer), and two meshing gears left of centre.
  - Pistons standing on the right half of the top beam, flywheel on the ground right of the frame.
  - Provisional sockets: crankHub(-60,-43), smallGearHub(-30,-52), largeGearHub(8,-66), pistonBed(54,-48), flywheelHub(150,-48), motorMount(-150,-24). Inspect the PNGs and adjust.
  - Drivers: gears and flywheel `rotate` with `combined`; motor `vibrate` with `automation`; pistons `reciprocate` y with `automation`, amplitude ≤3.
  - Links (at least): crank↔smallGear shaft; motor pulley↔smallGear belt; largeGear↔flywheel belt or shaft; flywheel↔pistonArray shaft. Use `flipX` on the motor only if its shaft faces away. Sizes stay equal to the manifest dims.
  Acceptance:
  - The bounds test still passes.
  - The WP2 test "has no machine links" is replaced by new tests: every link endpoint references an existing component and point; the link kind equals both points' kind; belt ends have `radius > 0`; connection points on `rotate`/`clickRotate` components sit at (0,0).
  - Every component except `supportFrame` appears in ≥1 link.
  - gearSmall/gearLarge centre distance is < (w₁+w₂)/2 and > max(w)/2 (they mesh).
  - `MACHINE_MOTION`/`ASSEMBLY`/`LINK_STYLE` exist and `typecheck` passes.
- **T2 Tech tree view model (pure)** — `src/ui/techTreeView.ts`, `src/ui/techTreeView.test.ts`. Depends on: WP2.
  Acceptance (tests build `views` with `getAllTechViews(state)` from `src/simulation`):
  - 9 nodes at `techNodePosition(def.tree)`; `width`/`height` cover the max col/row plus padding.
  - 10 edges. Initially only handCrank→gearRatio and handCrank→wornMotor are `met`. Each `d` starts at from-right-mid and ends at to-left-mid.
  - `selected=null` → `detail=null`.
  - gearRatio at ME 0 → `insufficient`, shortfall `NEED 10 MORE ME`, `buyEnabled` true. At ME 10 → `buy`, label contains `10 ME`.
  - reinforcedCrank → `locked`, requirement `Gear Ratio Lv 3` unmet.
  - generatorBlueprint → `automatic`, `milestone: true`, kindLabel `MILESTONE`, includes the lifetime-ME line.
  - Repeatable at maxLevel → `maxed` (`LV 25/25`). handCrank → `owned`.
  - `purchaseFailureText('insufficient', 3.2)` mentions `4`. `defaultSelection` on the initial state → `gearRatio`.
  - No DOM/Phaser imports.
- **T3 Notification data + rules (pure)** — `src/data/notifications.ts`, `src/ui/notificationRules.ts`, `src/ui/notificationRules.test.ts`. Depends on: WP2.
  Acceptance:
  - `INSTALL_LINES` covers all `TECH_IDS` with non-empty lines of ≤60 chars, in the §10 tone; it reuses the existing flavors where present.
  - Tests cover every rule above: first click only; no toast for level-1 purchase or milestone-unlock; repeat-purchase key stable; milestone tone and duration.
- **T4 Motion + link math (pure)** — `src/game/math/animation.ts` (extend), `src/game/math/animation.test.ts` (extend), `src/game/math/machineLinks.ts`, `src/game/math/machineLinks.test.ts`. Depends on: T1.
  Acceptance:
  - Steady clicking (gained g every 1/r s, simulated 10 s) converges to ≈ g·r (±15%). Decay reaches 0 after 10τ. Combined = sum.
  - Angles and phases stay in range for negative/huge dt.
  - reciprocate is 0 at φ=0 and −A at 0.5. vibrate returns integers within ±A.
  - `clampFrameSeconds(5000, 0.1) = 0.1`.
  - Belt segments: each endpoint lies on its circle (±1e-6) and is perpendicular to its radius. Degenerate inputs → one segment. `flipX` mirrors x.
  - `resolveConnectionPoint` = attachment + at.
- **T5 Tech tree overlay (DOM)** — `src/ui/techTree.ts`, `src/ui/techTree.css`. Depends on: T2.
  DOM structure:
  - `#tech-overlay` is a full-screen fixed backdrop (`pointer-events:auto`, z-index above the HUD, hidden when closed, `role="dialog"`, `aria-modal`). Inside it sits `#tech-panel`.
  - The panel header holds the `TECH INDEX` title, `#tech-me`, and the `#tech-close` button.
  - `#tech-graph` is scrollable if too small. It holds an SVG `#tech-edges` (paths `data-edge=key`, class `is-met`) under `button.tech-node[data-tech=id]` with classes `is-locked|is-available|is-purchased|is-milestone|is-selected|is-affordable`. Milestone nodes get a distinct shape and colour.
  - `#tech-detail` holds name, kind, status, `#tech-detail-desc`, `#tech-detail-flavor`, `#tech-req-list` (`li.is-met|.is-unmet` with ✓/✗), `#tech-level`, `#tech-effect-current`, `#tech-effect-next`, `#tech-cost`, `#tech-buy`, and `#tech-feedback` (`aria-live`).
  Behaviour:
  - The DOM is built once. `render` patches only the changed text and classes.
  - `update()` does nothing unless the overlay is open and `session.revision` or the selection changed.
  - Opening uses `commands.openTechTree` (selection: previous, else `defaultSelection`). Close via the button, Esc (window keydown, listening only while open) or a backdrop click.
  - `#tech-buy` → `session.purchase(id)`. On failure: `purchaseFailureText` in `#tech-feedback` plus an `is-denied` shake on the button (~400 ms). On success: short feedback (`LEVEL n` / `INSTALLED`).
  Acceptance:
  - While open, mouse events never reach the canvas (the backdrop covers it), and wheel events don't zoom the camera.
  - It works at 1280×720 and when the window is resized.
  - `destroy` removes listeners and nodes.
- **T6 Toasts (DOM)** — `src/ui/toasts.ts`, `src/ui/toasts.css`. Depends on: T3.
  `#toast-stack` sits top-centre, above the tech overlay, and is `pointer-events:none`. Each toast is `.toast.toast--<tone>` with a title and an optional body; milestone toasts get the distinct amber-glow style.
  Acceptance:
  - A toast with the same key replaces the text and restarts the timer.
  - At most `maxVisible` toasts show; the oldest is dropped.
  - Toasts fade out after `durationMs`; all timers are cleared on destroy.
  - `connectNotifications` reads `session.state.totalClicks` for click events and returns an unsubscribe-all.
- **T7 Machine growth rendering** — `src/game/entities/MachineView.ts` (modify), `src/game/entities/MachineAnimator.ts`, `src/game/rendering/MachineLinks.ts`. Depends on: T1, T4.
  MachineAnimator:
  - Keeps `manual` via `addActivity` on session `click` and `decayActivity` each frame; `automation = session.rates.perSecond`.
  - Per active component, `animationSpeed(def.animation.speed, driverValue(...))` (treated as 0 below `restThreshold`) drives rotate (angle), reciprocate (y/x offset from the base attachment) or vibrate (offset). `dt` comes from `clampFrameSeconds`.
  - Skips `none` and `clickRotate`, so the crank stays owned by HandCrank.
  MachineLinks:
  - One `Graphics` at `MACHINE_LINK_STYLE.depth` inside the machine container, outlined lines from `linkSegments`.
  - Redraws only when the endpoint geometry changed. A link is drawn only when both endpoints return non-null.
  MachineView:
  - Tracks the visible set. On `unlock`/`purchase`, components that became visible run an assembly: start `dropArtPx` above with `startScale`/alpha 0, tween to base over `durationMs`, then a dust puff (≤`puffCount` `fx.dust` images or one particle `explode`, destroyed after `puffMs`) and `shake()`.
  - `isAssembling` is true during the tween. `pointOf` returns null for hidden or assembling parts, so links appear when the part lands.
  - `reset` → kill tweens and run an instant `sync()`. Initial build/load → no assembly.
  - `update(delta)` runs the animator, then the links. `flipX` is applied with `setFlipX`.
  Acceptance:
  - Ends exactly on base position, scale 1 and alpha 1.
  - Rapid double unlocks don't leak tweens or puff objects.
  - Motion stops (gears at rest) about 3 s after the last click when ME/s is 0. With ME/s > 0 the motor vibrates and pistons pump; speeds never exceed the curve `max`.
  - `HandCrank` still works.
- **T8 Integration wiring** — `src/game/bootstrap.ts`, `src/game/scenes/WorldScene.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/game/debugHook.ts`. Depends on: T5, T6 (APIs) and T7 (API only, so it can run parallel to T7).
  - bootstrap: `createToasts(root)`, `connectNotifications(session, toasts)`, `createTechTree(root, session, ctx.commands)`; `new WorldScene(ctx, { hud, techTree })`.
  - WorldScene: stores `machine` as a public readonly field. `update(_t, delta)`: `session.update()` → `machine.update(delta)` → HUD render if the revision changed → `techTree.update()`. Stays <120 lines.
  - HUD: `#hud-tech` loses `aria-disabled`, title `Open the technology index`; delete the dead CSS rule.
  - debugHook: adds read-only `componentState(id)` (via the World scene's `machine.getComponentState`) and `techTreeOpen(): boolean`. No cheat helpers.
  Acceptance: `typecheck` passes; `#hud-tech` opens the overlay; no console errors on boot.
- **T9 Integration + validation (EM Mode B, then Director smoke test)** — Depends on: T1–T8. Fix glue, tune T1 sockets from screenshots, run all checks below.

Waves: **A** (3 parallel) = T1, T2, T3 → **B** (3) = T4, T5, T6 → **C** (2) = T7, T8 → **D** = T9.
File ownership is exclusive per task as listed. Nobody else edits `machineComponents.ts` after T1, except EM socket tuning in T9.

## Package acceptance / validation commands
```
npm run typecheck && npm test && npm run build
grep -rnE "from ['\"]phaser" src/simulation src/data src/persistence src/utils src/game/math src/ui && echo FAIL || echo OK
grep -rnE "\b(window|document)\b" src/ui/techTreeView.ts src/ui/notificationRules.ts src/data && echo FAIL || echo OK
grep -rnE "override (init|preload|create)\b" src/game && echo FAIL || echo OK
grep -rnE "0x[0-9a-fA-F]{6}" src/game src/ui && echo "WARN: colours outside palette" || echo OK
git diff --stat HEAD -- src/simulation   # must be empty
```
Director Playwright smoke test (extends the WP2 script in the scratchpad; run against `npm run build && npx vite preview`; zero `console.error`/`pageerror`, no failed requests):
1. Boot. `#hud-me`="0", `#hud-per-click`="1", `#hud-per-second`="0/s". `componentState('gearSmall').visible` is false.
2. Click `crankClientPoint()` once → a `.toast` containing "Manual operation detected." appears. Click 9 more → `#hud-me`="10".
3. Click `#hud-tech` → `#tech-overlay` visible, `techTreeOpen()` true, 9 `.tech-node` and 10 `#tech-edges path`. `[data-tech=reinforcedCrank]` has `is-locked`; `[data-tech=generatorBlueprint]` has `is-milestone`.
4. Click at `crankClientPoint()` while open → `#hud-me` stays "10" (canvas is shielded).
5. Click `[data-tech=gearRatio]` → `#tech-buy` contains "10 ME"; click it → `#hud-per-click`="2", `#hud-me`="0", the node shows `LV 1/25`. Click `#tech-buy` again → `#tech-feedback` contains "INSUFFICIENT", ME is unchanged.
6. Press Escape → overlay hidden. After the assembly delay, `componentState('gearSmall')` = visible, alpha 1, scale 1, not assembling.
7. Click the crank 13× → ME "26". Open the tree, select `wornMotor`, buy → `#hud-per-second`="1/s" and an `INSTALLED: WORN MOTOR` toast appears. `componentState('wornMotor').visible` is true; after about 1 s it is no longer assembling.
8. Close the tree, wait 3 s → `#hud-me` has increased (automation). Screenshots: overlay open (detail panel), machine with gear + motor + link, and a mid-assembly frame.
Director then updates `docs/PROJECT_STATUS.md` (WP2 + WP3 done; decisions: `combined` driver, links drawn from live sprite positions, overlay shields the canvas).

## Out of scope for this package
Save/load/autosave wiring, offline welcome-back summary, reset/settings UI, audio and mute (WP4). Production effects rendering (glow/steam/dust from `effects[]`) and belt-motion texture animation (WP5 polish). Tree zoom/pan, keyboard navigation of nodes, balance changes, any `src/simulation` change, new npm dependencies, new PixelLab art, `docs/ASSET_GUIDE.md`.
