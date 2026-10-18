# WP3 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP3.md` + `docs/GAME_SPEC.md` (§6, §7, §8, §10). Workers are `implementation-worker` agents (Haiku). No `src/simulation` change by anyone.

## How the Director uses this file

For every worker: spawn `implementation-worker`, paste **(1) the "Common preamble"** then **(2) exactly one assignment block**. Same-wave workers run in parallel. Between waves run `npx tsc --noEmit` and that wave's tests (EM Mode B or Director).

| Wave | Ids | Workers |
|---|---|---|
| A | **T1** machine data + links, **T2** tech tree view model (pure), **T3** notification data + rules (pure), **T4** motion/link/visibility math (pure) | 4 |
| B | **T5** tech tree overlay (DOM), **T6** toasts (DOM), **T7a** MachineAnimator + MachineLinks (Phaser), **T7b** MachineView rewrite (Phaser) | 4 |
| C | **T8** wiring: bootstrap, WorldScene, HUD, debug hook | 1 |
| D | **T9** = EM Mode B (validate, glue, socket tuning from screenshots), then Director smoke test | — |

Deviations from `WP3.md` (deliberate):
1. **T4 moved to wave A** (runs parallel with T1; it only needs T1's *types*, which are spelled out below, so tsc may show transient errors in T4 files until T1 lands). Frees wave B for T7a/T7b.
2. **T7 split** into T7a (animator + links drawing) and T7b (MachineView). T7b codes against T7a's exact signatures. T4 also owns a new pure `machineVisibility.ts` (visible set + newly-visible diff) so MachineView stays thin.
3. **Tech tree refresh (Director note)**: never gate on `session.revision` (bumps every frame). DOM built once; `update()` while open builds the pure view each frame (9 nodes, cheap) and patches DOM only if a *stamp* (ME text, per-node status/level/affordable/selected, detail buyState + shortfall) changed or a `dirty` flag set by session `purchase`/`unlock`/`reset` events.
4. **`MACHINE_MOTION.restThreshold` applies to the DRIVER value**, not to speed (speed curves have `min` 30+, so a speed threshold of 0.05 would never fire). Manual decays 1.33 -> 0.05 in ~2.5 s, matching "gears rest about 3 s after last click".
5. **No backdrop-click-to-close** (Director smoke step 4 clicks the canvas point while open and then keeps using the overlay; a backdrop close would break step 5). Close = button or Esc only.
6. `MACHINE_ASSEMBLY` gets two extra keys: `puffEndScale`, `puffAlpha` (no magic numbers in MachineView).
7. `WorldScene` exposes `getMachine(): MachineView | null` (a `readonly` field cannot be assigned in `create`).
8. Sockets are provisional (art is being remade). **All socket/point numbers live only in `src/data/machineComponents.ts`**, so a tuning pass edits numbers only. The tests are written as invariants (mesh inequality, ids, kinds), not exact coordinates.

---

# Common preamble (paste before every assignment)

```
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP3: terminal-style TECH INDEX overlay (DOM), toasts (DOM), machine parts that bolt on with an assembly animation and move at clamped speeds, drawn shafts/belts. WP1 (simulation) and WP2 (world, HUD, crank) are finished; read neighbouring files before writing.

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker. Never edit package.json, tsconfig.json, vite.config.ts, index.html, anything under src/simulation, src/persistence, src/utils, src/data/types.ts, technologies.ts, balance.ts, world.ts, palette.ts.
- PURE files (no 'phaser', no `window`/`document`): src/data/**, src/game/math/**, src/ui/techTreeView.ts, src/ui/notificationRules.ts. DOM files in src/ui (techTree.ts, toasts.ts) may use `document`/`window` but NEVER import Phaser. Only src/game/{entities,rendering,scenes} + debugHook/bootstrap import Phaser (`import Phaser from 'phaser';`).
- Phaser 3.90 typings do not declare create/preload/init on Scene: NEVER write `override` on them. `update(_time: number, delta: number)` DOES need `override`. When unsure of a Phaser signature grep node_modules/phaser/types/phaser.d.ts.
- All tuning numbers/texts live in src/data/. In TS under src/game and src/ui NEVER write a `0x......` hex literal (use PALETTE / PALETTE_CSS). CSS files may use hex values, with the comment `/* keep in sync with src/data/palette.ts */` (see src/ui/hud.css).
- Rendering never mutates GameState. Only mutation allowed in WP3: `session.purchase(id)` from the tech tree.
- No new dependencies, no npm install, no commits, no markdown/report files.
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension.
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env (no DOM/Phaser), `*.test.ts` next to code, `toBeCloseTo(x, 9)` for floats. Avoid `-0`: `expect(x).toBe(0)` fails for -0, so normalise `-0` to `0` in functions.
- Other workers edit OTHER files concurrently. `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list foreign errors in NOTES. Run only your own tests.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

COORDINATES: art px = source texture px; PIXEL_SCALE 2 world px per art px. Machine-local art px: origin = centre of frame base on the ground, +x right, +y down. MachineView container scale = PIXEL_SCALE, children at scale 1. Sprites sit at `resolveAttachment(def)` with `def.origin` as pivot.

=== EXISTING APIS (do not change) ===
// src/simulation (barrel '../simulation'): GameSession { state: ReadonlyGameState; rates: {perClick, perSecond}; revision: number;
//   click(): number; purchase(id: TechId): PurchaseResult; getAllTechViews(): TechView[]; getTechView(id); on(type, fn): () => void }
// events: click{gained} purchase{id,level,cost} unlock{id} milestone{id} reset{} offline settings. purchase emits 'purchase' then (if level was 0) 'unlock'; state is already updated when events fire.
// src/data/types.ts: TechId, TECH_IDS, TechKind 'starting'|'unlock'|'repeatable'|'milestone', TechStatus 'locked'|'available'|'purchased', PurchaseFailure 'locked'|'maxed'|'owned'|'insufficient'|'notPurchasable',
//   PurchaseResult = {ok:true; state; cost; newLevel} | {ok:false; reason},
//   TechView { id; def: TechDefinition; status; level; nextCost: number|null; affordable: boolean (available && me>=nextCost); requirements: {req; met; label}[]; currentEffectText; nextEffectText: string|null }
//   TechDefinition { id; name; kind; branch; baseCost; growth; maxLevel: number|null; effects; requires: Requirement[]; description; flavor?: string; tree: {col,row} }
//   Requirement = {type:'tech'; id; minLevel} | {type:'lifetimeMe'; amount}
// src/data/technologies.ts: TECHNOLOGIES: Record<TechId, TechDefinition>, TECH_LIST. Tree cols 0..4, rows 0..2.
// src/utils/format.ts: formatNumber(n, mode?) ("1.5K"), formatCost(n) (ceil), formatRate(n).
// src/utils/signal.ts: Signal<T>{emit,on}. src/game/context.ts: GameCommands { refocus: Signal<void>; openTechTree: Signal<void> }, GameContext { session; commands }.
// src/data/palette.ts: PALETTE (numbers), PALETTE_CSS (strings). Keys: sand dirtyBeige rust rustDark industrialGray grayDark mutedOrange skyTop skyHaze ink.
// src/data/machineComponents.ts (current): MACHINE_COMPONENT_IDS, MachineComponentId, SocketId, Vec2, MACHINE_LAYER_DEPTH, MACHINE_SOCKETS, MACHINE_COMPONENTS, MACHINE_LINKS (=[]), MachineLink, MACHINE_BOUNDS, ComponentAnimation, SpeedCurve, ConnectionPoint.
// src/game/math/machineLayout.ts: resolveAttachment(def, sockets?), isComponentVisible(def, techLevels), componentDepth(def), componentBounds(def), machineLocalToWorld(p).
// src/game/math/animation.ts: animationSpeed(curve, driverValue) (0 for <=0/non-finite; else base*(1+gain*log10(1+v)) clamped [min,max]).
// src/ui/hud.css style: dark iron panels, rust borders, amber text, monospace, uppercase, letter-spacing .08em, scanline overlay.

=== NEW CONTRACTS (spelled out so parallel workers integrate) ===
// ---- src/data/machineComponents.ts (T1) additions ----
export type AnimationDriver = 'manual' | 'automation' | 'combined';   // was 'manual' | 'automation'
export interface ConnectionPoint { id: string; at: Vec2; kind: 'shaft' | 'belt' | 'pipe'; radius?: number }   // radius: belt pulley radius, art px
// MachineComponentDefinition gains optional  flipX?: boolean   (mirror sprite and connection x)
export const MACHINE_MOTION = { manualTauSeconds: 0.75, maxFrameSeconds: 0.1, restThreshold: 0.05 } as const;   // restThreshold compares the DRIVER value
export const MACHINE_ASSEMBLY = { durationMs: 700, dropArtPx: 28, startScale: 0.4, ease: 'Back.easeOut',
  puffCount: 12, puffSpreadArtPx: 18, puffRiseArtPx: 10, puffMs: 650, puffEndScale: 2.5, puffAlpha: 0.7 } as const;
export const MACHINE_LINK_STYLE = { depth: 15, width: { shaft: 3, belt: 2, pipe: 4 },
  color: { shaft: PALETTE.industrialGray, belt: PALETTE.grayDark, pipe: PALETTE.rustDark }, outline: PALETTE.ink } as const;
// ---- src/game/math/animation.ts (T4) ----
export function decayActivity(value: number, dtSeconds: number, tauSeconds: number): number;
export function addActivity(value: number, gained: number, tauSeconds: number): number;
export function driverValue(driver: AnimationDriver, manual: number, automation: number): number;
export function clampFrameSeconds(deltaMs: number, maxSeconds: number): number;
export function advanceAngle(deg: number, degPerSecond: number, direction: 1 | -1, dtSeconds: number): number;
export function advancePhase(phase: number, cyclesPerSecond: number, dtSeconds: number): number;
export function reciprocateOffset(phase: number, amplitude: number): number;
export function vibrateOffset(phase: number, amplitude: number): Vec2;
// ---- src/game/math/machineLinks.ts (T4) ----
export function connectionOffset(def: MachineComponentDefinition, pointId: string): Vec2 | null;
export function resolveConnectionPoint(def: MachineComponentDefinition, pointId: string, sockets?: Record<SocketId, Vec2>): Vec2 | null;
export function linkSegments(kind: ConnectionPoint['kind'], a: Vec2, ra: number, b: Vec2, rb: number): Array<[Vec2, Vec2]>;
// ---- src/game/math/machineVisibility.ts (T4) ----
export function visibleComponentIds(techLevels: Readonly<Record<TechId, number>>): Set<MachineComponentId>;
export function newlyVisible(prev: ReadonlySet<MachineComponentId>, next: ReadonlySet<MachineComponentId>): MachineComponentId[];  // MACHINE_COMPONENT_IDS order
// ---- src/ui/techTreeView.ts (T2) ---- (pure)
export const TECH_TREE_LAYOUT = { nodeWidth: 176, nodeHeight: 68, colGap: 48, rowGap: 28, padding: 20 } as const;
export type TechKindLabel = 'ORIGIN' | 'UNLOCK' | 'REPEATABLE' | 'MILESTONE';
export type BuyState = 'buy' | 'insufficient' | 'locked' | 'maxed' | 'owned' | 'automatic';
export interface TechNodeView { id: TechId; name: string; status: TechStatus; kindLabel: TechKindLabel; milestone: boolean;
  levelText: string; costText: string | null; affordable: boolean; selected: boolean; x: number; y: number; width: number; height: number }
export interface TechEdgeView { key: string; from: TechId; to: TechId; met: boolean; d: string }
export interface TechDetailView { id: TechId; name: string; kindLabel: TechKindLabel;
  statusLabel: 'LOCKED' | 'AVAILABLE' | 'PURCHASED' | 'MAXED' | 'ACHIEVED';
  description: string; flavor: string | null; requirements: Array<{ label: string; met: boolean }>; levelText: string;
  currentEffect: string; nextEffect: string | null; costText: string | null;
  buyState: BuyState; buyLabel: string; buyEnabled: boolean; shortfallText: string | null }
export interface TechTreeView { width: number; height: number; meText: string; nodes: TechNodeView[]; edges: TechEdgeView[]; detail: TechDetailView | null }
export function techNodePosition(tree: { col: number; row: number }, layout?: typeof TECH_TREE_LAYOUT): { x: number; y: number };
export function edgePath(from: TechNodeView, to: TechNodeView): string;
export function defaultSelection(views: readonly TechView[]): TechId;
export function buildTechTreeView(views: readonly TechView[], me: number, selected: TechId | null, layout?: typeof TECH_TREE_LAYOUT): TechTreeView;
export function purchaseFailureText(reason: PurchaseFailure, shortfall: number): string;
// ---- src/data/notifications.ts + src/ui/notificationRules.ts (T3) ----
export type ToastTone = 'info' | 'system' | 'milestone';
export interface ToastMessage { key: string; title: string; body: string | null; tone: ToastTone; durationMs: number }
export const TOAST_CONFIG = { maxVisible: 3, durationMs: 3200, milestoneDurationMs: 6500, fadeMs: 250 } as const;
export const FIRST_CLICK_MESSAGE = 'Manual operation detected.';
export const INSTALL_LINES: Record<TechId, string>;
export type NotificationEvent = { type: 'click'; totalClicks: number } | { type: 'purchase'; id: TechId; level: number }
  | { type: 'unlock'; id: TechId } | { type: 'milestone'; id: TechId };
export function messageFor(event: NotificationEvent): ToastMessage | null;
// ---- DOM / Phaser APIs (waves B, C) ----
// src/ui/techTree.ts:  export interface TechTree { open(): void; close(): void; isOpen(): boolean; update(): void; destroy(): void }
//                      export function createTechTree(root: HTMLElement, session: GameSession, commands: GameCommands): TechTree;
// src/ui/toasts.ts:    export interface Toasts { show(msg: ToastMessage): void; destroy(): void }
//                      export function createToasts(root: HTMLElement, config?: typeof TOAST_CONFIG): Toasts;
//                      export function connectNotifications(session: GameSession, toasts: Toasts): () => void;
// src/game/entities/MachineAnimator.ts:
//   export class MachineAnimator { constructor(session: GameSession, sprites: ReadonlyMap<MachineComponentId, Phaser.GameObjects.Sprite>);
//     update(deltaMs: number, isActive: (id: MachineComponentId) => boolean): void;
//     getDriverValues(): { manual: number; automation: number }; destroy(): void }
// src/game/rendering/MachineLinks.ts:
//   export class MachineLinks { constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container);
//     draw(pointOf: (component: MachineComponentId, pointId: string) => Vec2 | null): void; destroy(): void }
// src/game/entities/MachineView.ts additions:
//   update(deltaMs: number): void;  isAssembling(id: MachineComponentId): boolean;
//   getComponentState(id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number };
```

---

# WAVE A (parallel: T1, T2, T3, T4 — disjoint files)

## T1 — Machine data: drivers, sockets, connection points, links

**wave**: A. **files_owned**: `src/data/machineComponents.ts`, `src/data/machineComponents.test.ts`

**objective**: Add the new contract types/constants, retune sockets so the 7 parts form one machine, add connection points and links. Pure data, no logic.

**context** (edit the existing file; keep every existing export and the WP2 type shapes):
1. `import { PALETTE } from './palette';`
2. Types/constants exactly as in the contract (AnimationDriver gains `'combined'`; `ConnectionPoint.radius?`; `MachineComponentDefinition.flipX?`; `MACHINE_MOTION`, `MACHINE_ASSEMBLY`, `MACHINE_LINK_STYLE`). Each constant gets a one-line comment per key group.
3. `MACHINE_SOCKETS` (provisional, art px): crankHub (-60,-43), smallGearHub (-30,-52), largeGearHub (8,-66), pistonBed (54,-48), flywheelHub (150,-48), motorMount (-150,-24). Add a comment: `// PROVISIONAL: art is being remade; tuning edits numbers only.`
4. Animations: gearSmall `rotate` driver `'combined'` (rest unchanged); gearLarge `rotate` `'combined'`; flywheel `rotate` `'combined'`; wornMotor `vibrate` `'automation'` (unchanged); pistonArray `reciprocate` `'automation'`, axis 'y', **amplitude 3** (was 6). Effects keep their current values.
5. `connections` (replace the single `shaft` point where listed; sizes/origins/assetIds unchanged):
   - supportFrame: unchanged (`shaft` (0,0)).
   - handCrank: `shaft` (0,0) kind shaft.
   - gearSmall: `shaft` (0,0) shaft; `belt` (0,0) belt radius 7.
   - gearLarge: `shaft` (0,0) shaft; `belt` (0,0) belt radius 14.
   - flywheel: `shaft` (0,0) shaft; `belt` (0,0) belt radius 24.
   - wornMotor: `pulley` at (-20,-6) kind belt radius 8.
   - pistonArray: `crank` at (36,-12) kind shaft.
6. `MACHINE_LINKS` (replace the empty array):
   1. handCrank.shaft -> gearSmall.shaft, kind shaft
   2. wornMotor.pulley -> gearSmall.belt, kind belt
   3. gearLarge.belt -> flywheel.belt, kind belt
   4. flywheel.shaft -> pistonArray.crank, kind shaft
7. Update the doc comment above `MACHINE_LINKS` ("Drive-train links between components.").

**tests** (`machineComponents.test.ts`): keep all existing tests EXCEPT replace "has no machine links in WP2" with:
- every link endpoint references an existing component and an existing connection point id of that component;
- link `kind` equals the `kind` of BOTH endpoint points;
- belt endpoints have `radius > 0`;
- connection points of every `rotate` or `clickRotate` component are at exactly (0,0);
- every component except `supportFrame` appears in at least one link;
- gearSmall/gearLarge mesh: centre distance (between their sockets, since offsets are 0) is `< (w1 + w2) / 2` and `> max(w1, w2) / 2` (use `Math.hypot`; read sizes from `MACHINE_COMPONENTS`);
- `MACHINE_MOTION`, `MACHINE_ASSEMBLY`, `MACHINE_LINK_STYLE` exist; `MACHINE_ASSEMBLY.puffCount` is a positive integer; `pistonArray` amplitude <= 3;
- gearSmall/gearLarge/flywheel drivers are `'combined'`, wornMotor and pistonArray drivers are `'automation'`.
The existing bounds test must still pass (it uses the new sockets).

**constraints**: pure (no Phaser, no `window`/`document`); sizes must still equal the manifest dims; do not rename anything; `MACHINE_LINKS` stays typed `readonly MachineLink[]`.

**acceptance**: tests above pass; `npx tsc --noEmit` shows no errors in these two files (T4 files may still be incomplete).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data/machineComponents.test.ts src/game/math/machineLayout.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/machineComponents.ts && echo FAIL || echo OK
```

## T2 — Tech tree view model (pure)

**wave**: A. **files_owned**: `src/ui/techTreeView.ts`, `src/ui/techTreeView.test.ts`

**objective**: A pure function turning `TechView[]` + ME + selection into everything the DOM overlay renders.

**context**: imports `TechView`, `TechId`, `TechStatus`, `PurchaseFailure` from `../data/types`; `formatCost`, `formatNumber` from `../utils/format`. Tests import `getAllTechViews`, `createInitialState` from `../simulation` and build states by spreading `createInitialState(0)` with `{ me, lifetimeMe, techLevels: {...} }` (techLevels is `Record<TechId, number>`).

Rules (exact):
- `TECH_TREE_LAYOUT` as contract. `techNodePosition(tree, layout)`: `x = padding + col*(nodeWidth+colGap)`, `y = padding + row*(nodeHeight+rowGap)`.
- `kindLabel`: starting -> `'ORIGIN'`, unlock -> `'UNLOCK'`, repeatable -> `'REPEATABLE'`, milestone -> `'MILESTONE'`. `milestone = def.kind === 'milestone'`.
- `levelText`: repeatable -> `LV ${level}/${maxLevel ?? '∞'}`; unlock/starting -> `INSTALLED` if level>=1 else `NOT INSTALLED`; milestone -> `ACHIEVED` if level>=1 else `PENDING`.
- `costText`: `nextCost === null ? null : formatCost(nextCost) + ' ME'`.
- node: `affordable = view.affordable`, `selected = id === selected`, width/height from layout, position from `techNodePosition(def.tree)`.
- `TechTreeView.width = padding*2 + (maxCol+1)*nodeWidth + maxCol*colGap`; height likewise with rows (maxCol/maxRow computed over the views' `def.tree`). `meText = formatNumber(me)`. Nodes in `views` order.
- Edges: for each view (`to`) in order, for each `requirement` whose `req.type === 'tech'` in order: `{ key: `${req.id}->${to.id}`, from: req.id, to: to.id, met: requirement.met, d: edgePath(fromNode, toNode) }`. `edgePath`: `x1 = from.x + from.width`, `y1 = from.y + from.height/2`, `x2 = to.x`, `y2 = to.y + to.height/2`, `mx = (x1+x2)/2`, returns `` `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` ``.
- `selected === null` or unknown id -> `detail: null`.
- Detail: `statusLabel`: locked -> `LOCKED`; purchased: milestone -> `ACHIEVED`, repeatable (at max) -> `MAXED`, else `PURCHASED`; available -> `AVAILABLE`. `description = def.description`, `flavor = def.flavor ?? null`, `requirements = view.requirements.map(r => ({label: r.label, met: r.met}))`, `currentEffect = view.currentEffectText`, `nextEffect = view.nextEffectText`, `levelText`/`costText` as above.
- `buyState` (evaluate in this order): milestone: level 0 -> `automatic`, else `owned`; unlock/starting with level>=1 -> `owned`; repeatable with `maxLevel !== null && level >= maxLevel` -> `maxed`; `status === 'locked'` -> `locked`; `view.affordable` -> `buy`; else `insufficient`.
- `buyLabel`: buy -> `PURCHASE — ${costText}`; insufficient -> `INSUFFICIENT ME`; locked -> `REQUIREMENTS UNMET`; maxed -> `MAXIMUM LEVEL`; owned -> `INSTALLED` (but `ACHIEVED` for a milestone); automatic -> `MILESTONE — AUTOMATIC`.
- `buyEnabled = buyState === 'buy' || buyState === 'insufficient'`. `shortfallText = buyState === 'insufficient' && nextCost !== null ? `NEED ${formatCost(nextCost - me)} MORE ME` : null` (clamp the difference at >= 0).
- `defaultSelection(views)`: first view with `affordable`; else first with `status === 'available' && def.kind !== 'starting'`; else `'handCrank'`.
- `purchaseFailureText(reason, shortfall)`: insufficient -> `NEED ${formatCost(shortfall)} MORE ME`; locked -> `REQUIREMENTS UNMET`; maxed -> `MAXIMUM LEVEL`; owned -> `ALREADY INSTALLED`; notPurchasable -> `CANNOT BE PURCHASED`.

**constraints**: pure (no Phaser, no DOM); no `any`; switch statements exhaustive; one-line formula comment per function.

**acceptance** (tests): initial state -> 9 nodes at `techNodePosition(def.tree)`, `width`/`height` equal the formulas (1112 x 300 for the current table); 10 edges; initially only `handCrank->gearRatio` and `handCrank->wornMotor` are `met`; each edge `d` starts with `M <from right-mid>` and ends with `<to left-mid>`; `selected=null` -> `detail=null`; gearRatio at ME 0 -> `insufficient`, shortfall `NEED 10 MORE ME`, `buyEnabled` true; at ME 10 -> `buy`, label contains `10 ME`; reinforcedCrank -> `locked` with unmet requirement `Gear Ratio Lv 3`; generatorBlueprint -> `automatic`, `milestone: true`, `kindLabel: 'MILESTONE'`, a requirement label containing `lifetime ME`; with gearRatio at level 25 -> `maxed`, node levelText `LV 25/25`, statusLabel `MAXED`; handCrank -> `owned`; milestone at level 1 -> `owned` with label `ACHIEVED`; `purchaseFailureText('insufficient', 3.2)` contains `4`; `defaultSelection` on the initial state is `gearRatio`; at ME 10 it is still `gearRatio`; `levelText` for gearRatio is `LV 0/25`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/techTreeView.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document)\b" src/ui/techTreeView.ts && echo FAIL || echo OK
```

## T3 — Notification data + rules (pure)

**wave**: A. **files_owned**: `src/data/notifications.ts`, `src/ui/notificationRules.ts`, `src/ui/notificationRules.test.ts`

**objective**: Toast texts/config and the pure mapping from session events to toasts.

**context**:
`src/data/notifications.ts` (imports `type TechId`): `ToastTone`, `ToastMessage`, `TOAST_CONFIG`, `FIRST_CLICK_MESSAGE`, `INSTALL_LINES` exactly per contract. `INSTALL_LINES` values (each non-empty, <= 60 chars, no emojis):
- handCrank: `Manual operation detected.`
- gearRatio: `Gear mesh recalibrated. Cause: unknown.`
- reinforcedCrank: `This component was not designed to be replaced.`
- flywheel: `Rotational mass acquired. Purpose: pending.`
- wornMotor: `Synchronization unsuccessful.`
- motorTuning: `Tolerance revised. Operator identity not found.`
- pistonArray: `Reciprocating assembly online. Observers: none.`
- improvedPistons: `Stroke length exceeds specification.`
- generatorBlueprint: `Primary function: UNKNOWN.`

`src/ui/notificationRules.ts` (imports `TECHNOLOGIES` from `../data/technologies`, the notifications data): `NotificationEvent`, `messageFor`. `NAME = TECHNOLOGIES[id].name.toUpperCase()`. Rules:
- `click`: only when `totalClicks === 1` -> `{ key: 'first-click', title: FIRST_CLICK_MESSAGE, body: null, tone: 'system', durationMs: TOAST_CONFIG.durationMs }`; else null.
- `purchase`: `level <= 1` -> null; else `{ key: 'purchase:'+id, title: `${NAME} — LV ${level}`, body: null, tone: 'info', durationMs: TOAST_CONFIG.durationMs }`.
- `unlock`: milestone-kind tech -> null; else `{ key: 'unlock:'+id, title: `INSTALLED: ${NAME}`, body: INSTALL_LINES[id], tone: 'info', durationMs: TOAST_CONFIG.durationMs }`.
- `milestone`: `{ key: 'milestone:'+id, title: `MILESTONE: ${NAME}`, body: INSTALL_LINES[id], tone: 'milestone', durationMs: TOAST_CONFIG.milestoneDurationMs }`.

**constraints**: pure; no `window`/`document`; no logic in `notifications.ts`.

**acceptance** (tests): `INSTALL_LINES` has every `TECH_IDS` key, each line non-empty and <= 60 chars, and the 4 lines that equal a `TECHNOLOGIES[id].flavor` are identical to it; click only at 1 (0, 2, 50 -> null); purchase level 1 -> null, level 2 -> title `GEAR RATIO — LV 2` key `purchase:gearRatio`, same key at level 3; unlock gearRatio -> `INSTALLED: GEAR RATIO` + body; unlock generatorBlueprint -> null; milestone generatorBlueprint -> tone `milestone`, `durationMs === TOAST_CONFIG.milestoneDurationMs`, title `MILESTONE: GENERATOR BLUEPRINT`; no result ever has an empty title.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/notificationRules.test.ts
npx tsc --noEmit
grep -nE "from ['\"]phaser|\b(window|document)\b" src/ui/notificationRules.ts src/data/notifications.ts && echo FAIL || echo OK
```

## T4 — Motion, link and visibility math (pure)

**wave**: A (parallel with T1; imports T1's types `AnimationDriver`, `ConnectionPoint`, `flipX` — transient tsc errors until T1 lands are expected; your tests do not depend on T1's new data, only on existing `MACHINE_COMPONENT_IDS`/`MACHINE_COMPONENTS`).
**files_owned**: `src/game/math/animation.ts`, `src/game/math/animation.test.ts`, `src/game/math/machineLinks.ts`, `src/game/math/machineLinks.test.ts`, `src/game/math/machineVisibility.ts`, `src/game/math/machineVisibility.test.ts`

**objective**: Pure functions for activity smoothing, angle/phase advance, link geometry and visible-set diffing. KEEP `animationSpeed` and the existing animation tests unchanged; add to them.

**context** (all functions get a one-line formula comment):
`animation.ts` additions (`import type { AnimationDriver, SpeedCurve, Vec2 }`):
- `decayActivity(value, dt, tau)`: `dt <= 0` or non-finite -> `value`; else `r = value * Math.exp(-dt / tau)`; `r < 1e-3 ? 0 : r`.
- `addActivity(value, gained, tau)`: ignore `gained <= 0` or non-finite (return `value`); else `value + gained / tau`.
- `driverValue(driver, manual, automation)`: manual -> manual; automation -> automation; combined -> manual + automation.
- `clampFrameSeconds(deltaMs, maxSeconds)`: NaN/negative -> 0; else `Math.min(deltaMs / 1000, maxSeconds)`.
- `advanceAngle(deg, degPerSecond, direction, dt)`: `x = deg + direction*degPerSecond*dt`; return `((x % 360) + 360) % 360` (non-finite x -> wrap of `deg`, and `-0` -> 0).
- `advancePhase(phase, cps, dt)`: `x = phase + cps*dt`; return `x - Math.floor(x)` (non-finite -> wrap of phase); result in `[0,1)`.
- `reciprocateOffset(phase, amplitude)`: `Math.round(-amplitude * (1 - Math.cos(2*Math.PI*phase)) / 2)`, normalise `-0` to `0`.
- `vibrateOffset(phase, amplitude)`: `x = Math.round(amplitude * Math.sin(2*Math.PI*phase*7))`, `y = Math.round(amplitude * Math.sin(2*Math.PI*phase*11 + 1))`, normalise `-0` to `0`.
`machineLinks.ts` (`import type { ConnectionPoint, MachineComponentDefinition, SocketId, Vec2 }`; `import { resolveAttachment } from './machineLayout'`):
- `connectionOffset(def, pointId)`: find point by id in `def.connections`; null if missing; `{ x: def.flipX ? -at.x : at.x, y: at.y }`.
- `resolveConnectionPoint(def, pointId, sockets?)`: offset null -> null; else `resolveAttachment(def, sockets) + offset`.
- `linkSegments(kind, a, ra, b, rb)`: if `kind !== 'belt'` -> `[[a, b]]`. Belt: `dx,dy = b-a`, `d = hypot`; degenerate (`d <= Math.abs(ra - rb)` or `(ra <= 0 && rb <= 0)`, includes `d === 0`) -> `[[a, b]]`. Else `u = (dx/d, dy/d)`, `n = (-u.y, u.x)`, `k = (ra - rb)/d`, `s = Math.sqrt(1 - k*k)`; for `sign` in `[1, -1]`: `m = (k*u.x + sign*s*n.x, k*u.y + sign*s*n.y)`; segment `[a + ra*m, b + rb*m]`. Return the 2 segments (+1 first).
`machineVisibility.ts`: `visibleComponentIds(techLevels)` = `new Set` of ids where `isComponentVisible(MACHINE_COMPONENTS[id], techLevels)` (import from `./machineLayout`); `newlyVisible(prev, next)` = ids in `MACHINE_COMPONENT_IDS` order that are in `next` and not in `prev`.

**constraints**: pure; no Phaser/DOM; no `any`; fresh objects returned.

**acceptance** (tests):
- Steady clicking: `g=1`, `rate=5/s`, `tau=0.75`, step 0.01 s for 10 s (add `g` every 0.2 s, decay each step); mean of the value over the last 5 s is within 15% of `g*rate`. Decay to 0 after 10 tau (`decayActivity(5, 7.5, 0.75) === 0`, since e^-10*5 < 1e-3). `dt <= 0` returns the value; `addActivity` ignores 0/negative/NaN. Combined = sum; manual/automation pick their input.
- `advanceAngle(350, 20, 1, 1) === 10`; `(10, 20, -1, 1) === 350`; huge/negative dt stays in `[0,360)`; `advancePhase` stays in `[0,1)` for dt = -3.7 and 1e6; `reciprocateOffset(0, 3) === 0` (use `toBe(0)`, so no -0), `(0.5, 3) === -3`, `(0.25, 4) === -2`; `vibrateOffset` over 200 phases always returns integers with `|x|,|y| <= A`, and is deterministic; `clampFrameSeconds(5000, 0.1) === 0.1`, `(16, 0.1) === 0.016`, `(NaN, 0.1) === 0`, `(-5, 0.1) === 0`.
- Belt: circles `(0,0) r 10` and `(100,0) r 4` -> 2 segments; each endpoint lies on its circle (distance to centre equals radius +-1e-6) and `(p - centre) . (q - p) = 0` (+-1e-6) for both ends; mirrored segments (y signs opposite). Equal radii -> segments parallel to a-b. Degenerate: `d <= |ra-rb|`, both radii 0, same point -> exactly one segment `[a,b]`. shaft/pipe -> `[[a,b]]`.
- `connectionOffset` with a literal def (`flipX: true`, point `at (6,-2)`) -> `(-6,-2)`; without flipX -> `(6,-2)`; unknown id -> null. `resolveConnectionPoint` = `resolveAttachment + at` for a real def from `MACHINE_COMPONENTS` and honours custom `sockets`.
- Visibility: initial techLevels (handCrank 1, others 0 — build it with `createInitialState(0).techLevels` from `../../simulation`) -> exactly `supportFrame`, `handCrank`; with gearRatio 1 adds `gearSmall`; `newlyVisible` returns only the added ids in canonical order; equal sets -> `[]`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/game/math/animation.test.ts src/game/math/machineLinks.test.ts src/game/math/machineVisibility.test.ts
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/game/math && echo FAIL || echo OK
```

---

# WAVE B (parallel: T5, T6, T7a, T7b — disjoint files; wave A done and green)

## T5 — Tech tree overlay (DOM)

**wave**: B. **files_owned**: `src/ui/techTree.ts`, `src/ui/techTree.css`

**objective**: The terminal-style TECH INDEX overlay. DOM built once; a render step patches only what changed.

**context**: `techTree.ts` imports `./techTree.css`, `GameSession` (type) from `../simulation`, `GameCommands` (type) from `../game/context`, `buildTechTreeView`, `defaultSelection`, `purchaseFailureText` and the view types from `./techTreeView`, `TechId`. NO Phaser.

DOM (create with `document.createElement`; SVG with `createElementNS('http://www.w3.org/2000/svg', ...)`), appended to `root`:
```
#tech-overlay[role=dialog][aria-modal=true][aria-labelledby=tech-title]   (class is-open while open; display:none otherwise)
  #tech-panel
    header: h2#tech-title "TECH INDEX" · #tech-me (text = view.meText + ' ME') · button#tech-close "CLOSE [ESC]"
    #tech-graph (overflow:auto)
      div.tech-graph-inner (position:relative; width/height = view.width/height px)
        svg#tech-edges (width/height attrs) > path[data-edge=key] (class is-met when met; attribute d)
        button.tech-node[data-tech=id] (position:absolute; left/top/width/height px)  children: span.tech-node-name, span.tech-node-level, span.tech-node-cost
    #tech-detail
      #tech-detail-name, #tech-detail-kind, #tech-detail-status, #tech-detail-desc, #tech-detail-flavor,
      ul#tech-req-list > li.is-met|.is-unmet ("✓ label" / "✗ label"), #tech-level,
      #tech-effect-current ("NOW: " + text), #tech-effect-next ("NEXT: " + text, hidden when null), #tech-cost, #tech-shortfall,
      button#tech-buy, #tech-feedback[aria-live=polite]
```
Node classes: `is-locked | is-available | is-purchased` (from status), plus `is-milestone`, `is-selected`, `is-affordable` when set. Node name text = `node.name`; level text; cost text (empty string when null).

Behaviour:
- State: `selected: TechId | null`, `dirty = true`, `lastStamp = ''`, `isOpenFlag`.
- `buildView()` = `buildTechTreeView(session.getAllTechViews(), session.state.me, selected)`.
- `render(view)`: first call creates node/edge elements (keyed by id/key); every call patches textContent/className/attributes ONLY IF the new value differs from a cached string (keep a small `Map` of last written values per element/field). Detail panel hides (`hidden`) when `detail` is null. `#tech-buy`: text = `buyLabel`; keep it clickable when `insufficient` (buyEnabled true) so the denied feedback works: `disabled = !buyEnabled`; set `data-buy-state` = buyState. `#tech-shortfall` shows `shortfallText` or empty.
- `stamp(view)`: string of `meText`, each node `id:status:levelText:affordable:selected`, and `detail.buyState + detail.shortfallText + detail.costText`. `update()`: if not open return; `view = buildView()`; if `dirty || stamp(view) !== lastStamp` then `render(view)`, `dirty = false`, store stamp. **Do NOT use `session.revision` anywhere.**
- Subscribe in the factory: `session.on('purchase'|'unlock'|'reset')` -> `dirty = true` (on `reset` also `selected = null`, clear feedback); `commands.openTechTree.on(() => open())`. Keep all unsubscribes for `destroy`.
- `open()`: if already open return; remember `document.activeElement`; `selected ??= defaultSelection(session.getAllTechViews())`; add class `is-open`; add `window` `keydown` listener (Escape -> `close()`); `dirty = true; update();` focus `#tech-close`.
- `close()`: remove class and the keydown listener; clear feedback; restore focus; NO backdrop-click handling (clicks on the backdrop do nothing).
- Node click -> `selected = id`, clear `#tech-feedback`, `dirty = true; update()` (works only while open).
- `#tech-buy` click: if no selection return. `before = session.getTechView(selected)`; `result = session.purchase(selected)`. Failure: feedback text = `purchaseFailureText(result.reason, Math.max(0, (before.nextCost ?? 0) - session.state.me))`, add class `is-denied` on the button for 400 ms (`window.setTimeout`, clear previous timer, remove class). Success: feedback = `result.newLevel > 1 ? 'LEVEL ' + result.newLevel : 'INSTALLED'`, then `dirty = true; update()`. Keep the timer handle for `destroy`.
- `isOpen()` returns the flag. `destroy()`: close if open, unsubscribe everything, clear the timer, remove the overlay node.

CSS (`techTree.css`; define variables on `#tech-overlay` copying the HUD palette: `--ink:#14110f; --iron:#2b2e31; --iron-2:#1d1f21; --rust:#8c4a2a; --rust-dark:#4e2a1a; --amber:#d9822b; --amber-dim:#a8957a; --haze:#d2bf9c;` with comment `/* keep in sync with src/data/palette.ts */`):
- `#tech-overlay`: `position:fixed; inset:0; z-index:100; display:none; pointer-events:auto; background:rgba(8,6,5,.82); align-items:center; justify-content:center; overscroll-behavior:contain;` `.is-open {display:flex}`.
- `#tech-panel`: `width:min(1180px,96vw); max-height:94vh; display:flex; flex-direction:column;` iron-2 background, 2px rust border, ink outer ring, scanline `::after` like the HUD, monospace uppercase font, amber text.
- Layout: graph on top (`flex:0 1 auto; overflow:auto; max-height:46vh`), detail below as a 2-column grid (left: name/kind/status/desc/flavor/requirements; right: level/effects/cost/shortfall/buy/feedback). At 1280x720 everything must be visible without scrolling the panel; at narrow widths the graph scrolls.
- Nodes: iron background, rust border; `.is-locked` dimmed (opacity .5, dashed border); `.is-available` amber border; `.is-purchased` filled rust-dark with haze text; `.is-affordable` amber glow (box-shadow); `.is-selected` 2px haze outline. **`.is-milestone` distinct shape + colour**: octagonal `clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)` with an amber-dark gradient background (no border; clip-path hides it).
- Edges: stroke `--rust-dark`, 2px, no fill; `.is-met` stroke `--amber`.
- `#tech-buy`: HUD button look; `[disabled]` opacity .5; `[data-buy-state=insufficient]` dimmed amber but cursor pointer; `.is-denied` runs a 400 ms `@keyframes` horizontal shake. `#tech-feedback` min-height reserved (no layout jump).
- `prefers-reduced-motion`: no shake animation.

**constraints**: no Phaser import; no `any`; no innerHTML with dynamic text (use `textContent`); no listeners left after `destroy`; the overlay never calls anything but `session.purchase` as a mutation; `session.revision` unused.

**acceptance**: typecheck clean; reasoning check against the Director smoke test: 9 `.tech-node`, 10 `#tech-edges path`, `[data-tech=reinforcedCrank]` has `is-locked`, `[data-tech=generatorBlueprint]` has `is-milestone`; selecting gearRatio shows `#tech-buy` text containing `10 ME` at ME >= 10; a second buy with ME 0 shows `INSUFFICIENT` in `#tech-feedback` and leaves ME unchanged; Esc closes; only one `keydown` listener exists while open and none after close/destroy.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "from ['\"]phaser|\brevision\b|innerHTML|0x[0-9a-fA-F]{6}" src/ui/techTree.ts && echo FAIL || echo OK
```

## T6 — Toasts (DOM)

**wave**: B. **files_owned**: `src/ui/toasts.ts`, `src/ui/toasts.css`

**objective**: A small toast stack plus the subscription that turns session events into toasts.

**context**: imports `./toasts.css`, `TOAST_CONFIG`, `ToastMessage` from `../data/notifications`, `messageFor` from `./notificationRules`, `GameSession` (type) from `../simulation`. NO Phaser.

`createToasts(root, config = TOAST_CONFIG)`:
- Creates `div#toast-stack` (appended to `root`, `aria-live="polite"`).
- `show(msg)`: `key` exists -> reuse its element: set title/body text, set tone class, show/hide the body element, clear both timers, remove `is-fading`, restart timers (position in the stack unchanged). Otherwise create `div.toast.toast--<tone>` containing `div.toast-title` and `div.toast-body` (hidden when `body === null`), append; if more than `config.maxVisible` toasts exist, remove the OLDEST (first in insertion order) and clear its timers.
- Timers via `window.setTimeout`: after `msg.durationMs` add `is-fading`; after a further `config.fadeMs` remove the element and the map entry. Keep `{ el, fadeTimer, removeTimer }` per key.
- `destroy()`: clear all timers, remove the stack element, clear the map. `show` after destroy is a no-op.

`connectNotifications(session, toasts)`: subscribes `click` -> `messageFor({type:'click', totalClicks: session.state.totalClicks})`, `purchase` -> `{type:'purchase', id, level}`, `unlock` -> `{type:'unlock', id}`, `milestone` -> `{type:'milestone', id}`; non-null results go to `toasts.show`. Returns one function that calls all four unsubscribes.

CSS: variables on `#toast-stack` (same HUD palette + comment). `#toast-stack`: `position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:200; pointer-events:none; display:flex; flex-direction:column; gap:8px; align-items:center;`. `.toast`: iron-2 background, 2px rust border, amber monospace uppercase text, letter-spacing .08em, max-width `min(560px, 92vw)`, entry animation (fade/slide-down ~200 ms), `transition: opacity` equal to the fade (250 ms); `.is-fading {opacity:0}`. `.toast-title` amber, `.toast-body` amber-dim smaller. `.toast--system` haze left border; **`.toast--milestone`**: amber border, amber-tinted background, pulsing amber `box-shadow` glow keyframes, larger title. `prefers-reduced-motion`: no animation.

**constraints**: no Phaser; `textContent` only; no leaked timers; `click` toast uses `session.state.totalClicks` read at event time.

**acceptance**: typecheck clean; same key twice leaves one element and restarts timers; the 4th distinct key removes the oldest; destroy leaves no timers or DOM.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "from ['\"]phaser|innerHTML|0x[0-9a-fA-F]{6}" src/ui/toasts.ts && echo FAIL || echo OK
```

## T7a — MachineAnimator + MachineLinks (Phaser)

**wave**: B. **files_owned**: `src/game/entities/MachineAnimator.ts`, `src/game/rendering/MachineLinks.ts`

**objective**: Drive part motion from clicks and ME/s, and draw shafts/belts between live part positions.

**context**:
`MachineAnimator` (imports `GameSession` type; `MACHINE_COMPONENTS`, `MACHINE_COMPONENT_IDS`, `MACHINE_MOTION`; `animationSpeed`, `decayActivity`, `addActivity`, `driverValue`, `clampFrameSeconds`, `advanceAngle`, `advancePhase`, `reciprocateOffset`, `vibrateOffset` from `../math/animation`; `resolveAttachment` from `../math/machineLayout`):
- Fields: `manual = 0`; `Map<MachineComponentId, number>` for angles and phases. Subscribes `session.on('click', ({gained}) => manual = addActivity(manual, gained, MACHINE_MOTION.manualTauSeconds))` and `session.on('reset', ...)` (manual = 0, clear both maps). Keep both unsubscribes.
- `update(deltaMs, isActive)`: `dt = clampFrameSeconds(deltaMs, MACHINE_MOTION.maxFrameSeconds)`; `manual = decayActivity(manual, dt, tau)`; `automation = session.rates.perSecond`. For each id in `MACHINE_COMPONENT_IDS`: `anim = MACHINE_COMPONENTS[id].animation`; skip kinds `none` and `clickRotate` (HandCrank owns the crank); skip if no sprite or `!isActive(id)`. `dv = driverValue(anim.driver, manual, automation)`; `speed = dv < MACHINE_MOTION.restThreshold ? 0 : animationSpeed(anim.speed, dv)`.
  - `rotate`: `angle = advanceAngle(stored ?? 0, speed, anim.direction, dt)`; store; `sprite.setAngle(angle)`.
  - `reciprocate`: `phase = advancePhase(stored ?? 0, speed, dt)`; `off = reciprocateOffset(phase, anim.amplitude)`; `base = resolveAttachment(def)`; `sprite.setPosition(base.x + (axis==='x' ? off : 0), base.y + (axis==='y' ? off : 0))`. When speed is 0 leave the sprite where it is.
  - `vibrate`: if speed is 0 -> `sprite.setPosition(base.x, base.y)`; else advance phase and `sprite.setPosition(base.x + o.x, base.y + o.y)` with `o = vibrateOffset(phase, anim.amplitude)`.
- `getDriverValues()` returns `{ manual, automation: session.rates.perSecond }`. `destroy()` unsubscribes.
`MachineLinks` (imports `Phaser`; `MACHINE_LINKS`, `MACHINE_COMPONENTS`, `MACHINE_LINK_STYLE`; `linkSegments` from `../math/machineLinks`):
- Constructor: `this.graphics = scene.add.graphics().setDepth(MACHINE_LINK_STYLE.depth); container.add(this.graphics);` (the container sorts by depth itself; do NOT sort here).
- `draw(pointOf)`: for each link: `a = pointOf(from.component, from.point)`, `b = pointOf(to.component, to.point)`; skip if either null. `ra`/`rb` = the `radius ?? 0` of the connection point definitions (lookup in `MACHINE_COMPONENTS[...].connections` by id). `segments = linkSegments(link.kind, a, ra, b, rb)`. Build a string key of all rounded (x100) segment coordinates + kinds for all drawn links; if equal to `lastKey` return without touching the Graphics. Else `graphics.clear()` and draw all outlines first (`lineStyle(width + 2, MACHINE_LINK_STYLE.outline, 1)`, `lineBetween` per segment), then all colours (`lineStyle(width, color[kind], 1)`), so outlines never cover colours. Store `lastKey`. If nothing is drawn, clear and set key to `''`.
- `destroy()`: `graphics.destroy()` (safe if already destroyed: check `graphics.scene`).

**constraints**: no magic numbers (all from data); no `0x` literals; no allocation-heavy per-frame work beyond the key string; no `override` on lifecycle methods (none are used here).

**acceptance**: typecheck clean; reasoning check: after the last click and with ME/s 0, `manual` falls below 0.05 about 2.5 s later and rotate/vibrate parts stop; with ME/s > 0 the flywheel/motor/pistons keep moving; speeds never exceed `speed.max` (guaranteed by `animationSpeed`); HandCrank sprite is never touched.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "0x[0-9a-fA-F]{6}|override (init|preload|create)\b" src/game/entities/MachineAnimator.ts src/game/rendering/MachineLinks.ts && echo FAIL || echo OK
```

## T7b — MachineView: assembly, visibility sync, animator and links wiring

**wave**: B (codes against T7a/T4/T1 signatures from the contracts; transient tsc errors until they land are expected). **files_owned**: `src/game/entities/MachineView.ts`

**objective**: Extend `MachineView` (keep the current structure: outer `container`, inner `parts` shake target, sprites map, `shake()`, `getComponentSprite`, `getComponentWorldPosition`, `destroy`) so newly unlocked parts assemble, motion runs, and links draw.

**context** (imports to add: `MACHINE_ASSEMBLY`, `MACHINE_LAYER_DEPTH` from data/machineComponents; `visibleComponentIds`, `newlyVisible` from `../math/machineVisibility`; `connectionOffset` from `../math/machineLinks`; `MachineAnimator` from `./MachineAnimator`; `MachineLinks` from `../rendering/MachineLinks`):
- New fields: `visibleIds: Set<MachineComponentId>`; `assembling = new Map<MachineComponentId, Phaser.Tweens.Tween>()`; `puffs = new Map<Phaser.GameObjects.Image, Phaser.Tweens.Tween>()`; `animator`; `links`; unsubscribes for `unlock`, `purchase`, `reset`.
- Constructor: after creating sprites call `sprite.setFlipX(def.flipX === true)`; create `this.links = new MachineLinks(scene, this.parts)` BEFORE the existing `this.parts.sort('depth')`; `this.animator = new MachineAnimator(ctx.session, this.sprites)`; `visibleIds = visibleComponentIds(techLevels)` and apply visibility instantly (no assembly on build/load); subscribe: `unlock` and `purchase` -> `this.refresh(true)`; `reset` -> `this.reset()`.
- `refresh(animate)`: `next = visibleComponentIds(session.state.techLevels)`; `added = newlyVisible(this.visibleIds, next)`; for each id not in `next`: kill its assembly tween (if any), `sprite.setVisible(false)`; `this.visibleIds = next`; for each `added` id: `animate ? this.startAssembly(id) : this.settle(id, true)`. (Second call from the paired purchase/unlock event is a harmless no-op.)
- `startAssembly(id)`: kill an existing assembly tween for id; `base = resolveAttachment(def)`; `sprite.setVisible(true).setPosition(base.x, base.y - MACHINE_ASSEMBLY.dropArtPx).setScale(MACHINE_ASSEMBLY.startScale).setAlpha(0)`; `tween = scene.tweens.add({ targets: sprite, y: base.y, scaleX: 1, scaleY: 1, alpha: 1, duration: MACHINE_ASSEMBLY.durationMs, ease: MACHINE_ASSEMBLY.ease, onComplete: () => { this.settle(id, true); this.spawnPuff(id); this.shake(); } })`; `assembling.set(id, tween)`.
- `settle(id, visible)`: delete the assembly entry; `sprite.setVisible(visible).setPosition(base.x, base.y).setScale(1).setAlpha(1)` (exact end state; do not touch `angle`).
- `spawnPuff(id)`: `puffCount` times: `img = scene.add.image(base.x + rand(-spread, spread), bottomY, 'fx.dust')` where `bottomY = base.y + (1 - def.origin.y) * def.size.height`, `.setAlpha(MACHINE_ASSEMBLY.puffAlpha).setDepth(MACHINE_LAYER_DEPTH.front + 1)`; `this.parts.add(img)` (appended on top, no re-sort); tween `{ y: bottomY - puffRiseArtPx, alpha: 0, scale: puffEndScale, duration: puffMs, onComplete: () => { this.puffs.delete(img); img.destroy(); } }`; `puffs.set(img, tween)`. Use `Math.random()` (visual only). Total puffs alive can never exceed `puffCount * parts being assembled`.
- `reset()`: stop all assembly tweens and clear the map, stop+destroy all puffs, then `visibleIds = visibleComponentIds(techLevels)`, and for every component `settle(id, visibleIds.has(id))`. Keep the existing public `sync()` method working (it can call the same non-animated path: recompute `visibleIds` and settle all).
- `update(deltaMs)`: `animator.update(deltaMs, (id) => this.visibleIds.has(id) && !this.assembling.has(id))`; then `links.draw(this.pointOf)` where `pointOf = (component, pointId) => { if (!visibleIds.has(component) || assembling.has(component)) return null; const sprite = sprites.get(component); const off = connectionOffset(MACHINE_COMPONENTS[component], pointId); return sprite && off ? { x: sprite.x + off.x, y: sprite.y + off.y } : null; }` (a bound arrow property, not recreated per frame).
- `isAssembling(id)` = `assembling.has(id)`. `getComponentState(id)` = `{ visible: sprite.visible, assembling, alpha: sprite.alpha, scale: sprite.scaleX }` (sprite missing -> `{visible:false, assembling:false, alpha:0, scale:0}`).
- `destroy()`: unsubscribe all three; stop every assembly/puff tween and destroy puffs; `animator.destroy()`; `links.destroy()`; then the existing teardown (`shakeTween` stop, `container.destroy(true)`). Tweens must be stopped BEFORE `container.destroy`.

**constraints**: no new numbers in the file (all from `MACHINE_ASSEMBLY`); no `0x` literals; no changes to HandCrank-facing API (`getComponentSprite`, `getComponentWorldPosition`, `shake`); `shake()` unchanged; do not tween anything on the crank sprite.

**acceptance**: typecheck clean; reasoning check: a part ends exactly at base position, scale 1, alpha 1, visible, not assembling (the `settle` call in `onComplete`); two unlocks in quick succession leave one tween per part and puffs bounded; `reset` leaves no tween/puff alive; on a fresh load nothing assembles; `animator` never moves a part that is hidden or assembling; links appear only after both ends have landed.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit
grep -nE "0x[0-9a-fA-F]{6}" src/game/entities/MachineView.ts && echo FAIL || echo OK
```

---

# WAVE C

## T8 — Integration wiring

**wave**: C (needs T5, T6, T7b). **files_owned**: `src/game/bootstrap.ts`, `src/game/scenes/WorldScene.ts`, `src/ui/hud.ts`, `src/ui/hud.css`, `src/game/debugHook.ts`

**objective**: Wire overlay, toasts, machine update loop and debug hooks.

**context**:
- `bootstrap.ts`: after `createHud`: `const toasts = createToasts(root); connectNotifications(session, toasts); const techTree = createTechTree(root, session, ctx.commands);` `new WorldScene(ctx, { hud, techTree })`; `installDebugHook(session, game, techTree)`. (Do not store the unsubscribe; the app lives for the page.)
- `WorldScene.ts`: constructor `(ctx: GameContext, ui: { hud: Hud; techTree: TechTree })`. Keep a private `machineView: MachineView | null = null`, assigned in `create`; public `getMachine(): MachineView | null`. Replace `update`:
  ```ts
  override update(_time: number, delta: number): void {
    this.ctx.session.update();
    this.machineView?.update(delta);
    if (this.ctx.session.revision !== this.lastRevision) this.renderHud();
    this.ui.techTree.update();
  }
  ```
  Everything else (disposables order, shutdown handling) unchanged. File stays under 120 lines. Set `machineView = null` in the `machine` disposable.
- `hud.ts`: `#hud-tech`: remove the `aria-disabled` line; `title = 'Open the technology index'`. `hud.css`: delete the `.hud-btn[aria-disabled="true"]` rule.
- `debugHook.ts`: signature `installDebugHook(session, game, techTree: TechTree)`; extend the global type: `__wedtmd?: { session; crankClientPoint(): {x,y}; componentState(id: MachineComponentId): { visible: boolean; assembling: boolean; alpha: number; scale: number } | null; techTreeOpen(): boolean }`. `componentState` gets `game.scene.getScene('World')`, casts to `WorldScene` (`import type`), returns `scene.getMachine()?.getComponentState(id) ?? null`. `techTreeOpen = () => techTree.isOpen()`. No cheat/mutation helpers.

**constraints**: no behaviour change besides the above; no `override` on `create`; `update` keeps `override`; no Phaser import in `hud.ts`.

**acceptance**: `npx tsc --noEmit` passes; `npm run build` passes; `#hud-tech` click emits `openTechTree` (overlay opens); no `aria-disabled` left in `src/ui/hud.ts`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx tsc --noEmit && npm run build
grep -rnE "override (init|preload|create)\b|aria-disabled" src && echo FAIL || echo OK
wc -l src/game/scenes/WorldScene.ts
```

---

# WAVE D — T9 (EM Mode B)

Run the package validation block from `WP3.md` (typecheck, test, build, purity greps, `git diff --stat HEAD -- src/simulation` empty). Check every acceptance above against code. Allowed glue: one-line fixes, socket/point number tuning in `machineComponents.ts` from screenshots (keep the gear-mesh inequality, link-kind and `(0,0)` rotating-point tests green). Then the Director runs the Playwright smoke test from `WP3.md`.
