# Roadmap (Task Planner)

- **WP1 — Tooling + pure simulation core** (below).
- **WP2 — World + interactive crank:** Boot/World scenes, central asset registry with procedurally generated fallback textures, wasteland parallax layers (sky, mountains/ruins, city skyline, pylons, cracked terrain) + dust particles, camera pan/zoom/refocus with bounds, machine support frame + clickable hand crank wired to `GameSession.click()` (rotation, floating +ME, small shake), minimal HTML HUD (ME, ME/click, ME/s), main loop calling `session.update()`.
- **WP3 — Tech tree + machine growth:** HTML/CSS tech tree overlay (nodes from `TechDefinition.tree`, prerequisite lines, locked/available/purchased styling, cost/level/current+next effect, insufficient-funds feedback); `machineComponents.ts` data + component manager listening to `unlock` events (fixed attachment points, assembly animation, gears/flywheel/motor/pistons with procedural animation tied to ME/s, clamped; connecting shafts/belts).
- **WP4 — Persistence, feedback, audio:** autosave interval + `visibilitychange`, load on startup, offline welcome-back summary, reset with confirmation; settings incl. mute; thematic notification/log system; WebAudio synth (crank, motor/gear loops, unlock sting, ambience) — optional and non-blocking.
- **WP5 — Polish & verification:** balance pass for first 15–30 min, `docs/ASSET_GUIDE.md` + manifest, README + architecture notes, browser smoke test (no console errors), §16 checklist walk-through.

---

# Work Package 1: Tooling + Pure Simulation Core

Goal: a building, type-checked project whose entire economy/progression/offline/save logic is pure TypeScript (no Phaser, no DOM) and covered by Vitest; later visual packages only consume it.

## Contracts (written by T0; all other tasks code against these exactly)

`src/data/types.ts`:
```ts
export const TECH_IDS = ['handCrank','gearRatio','reinforcedCrank','flywheel','wornMotor',
  'motorTuning','pistonArray','improvedPistons','generatorBlueprint'] as const;
export type TechId = typeof TECH_IDS[number];
export type TechKind = 'starting' | 'unlock' | 'repeatable' | 'milestone';
export type Branch = 'origin' | 'mechanical' | 'automation' | 'convergence';
export type Effect =                       // repeatable effects apply per level
  | { type: 'clickAdd'; amount: number }   // additive ME/click
  | { type: 'clickMult'; factor: number }  // multiplicative manual
  | { type: 'autoAdd'; amount: number }    // additive ME/s
  | { type: 'autoPct'; percent: number }   // additive % pool → (1 + Σ%/100)
  | { type: 'none' };
export type Requirement =
  | { type: 'tech'; id: TechId; minLevel: number }
  | { type: 'lifetimeMe'; amount: number };
export interface TechDefinition {
  id: TechId; name: string; kind: TechKind; branch: Branch;
  baseCost: number; growth: number | null; maxLevel: number | null; // growth/maxLevel only for repeatable
  effects: Effect[]; requires: Requirement[];
  description: string; flavor?: string;
  tree: { col: number; row: number };      // layout hint for WP3 tech UI
}
export interface GameState {
  me: number; lifetimeMe: number; totalClicks: number;
  techLevels: Record<TechId, number>;      // 0 = not owned; unlock/milestone owned = 1
  lastSimTime: number;                     // epoch ms of last simulated point
  createdAt: number;
}
export interface SettingsState { muted: boolean }
export interface ProductionRates { perClick: number; perSecond: number }
export type TechStatus = 'locked' | 'available' | 'purchased';
// locked = reqs unmet; available = can buy (incl. repeatable level≥1 below max);
// purchased = owned unlock/starting/milestone, or repeatable at maxLevel
export interface RequirementView { req: Requirement; met: boolean; label: string }
export interface TechView {
  id: TechId; def: TechDefinition; status: TechStatus; level: number;
  nextCost: number | null; affordable: boolean; requirements: RequirementView[];
  currentEffectText: string; nextEffectText: string | null;
}
export type PurchaseFailure = 'locked' | 'maxed' | 'owned' | 'insufficient' | 'notPurchasable';
export type PurchaseResult =
  | { ok: true; state: GameState; cost: number; newLevel: number }
  | { ok: false; reason: PurchaseFailure };
export interface OfflineReport { elapsedSeconds: number; cappedSeconds: number; gained: number }
export interface SaveEnvelope { version: number; savedAt: number; state: GameState; settings: SettingsState }
export type LoadStatus = 'new' | 'loaded' | 'migrated' | 'recovered';
export interface LoadResult { state: GameState; settings: SettingsState; status: LoadStatus; error?: string }
```
`src/simulation/state.ts`: `createInitialState(nowMs: number): GameState` (ME 0, all levels 0 except `handCrank: 1`, `lastSimTime = createdAt = nowMs`), `DEFAULT_SETTINGS`.

**Production formula** (documented in `rates.ts` header + tested):
`perClick = (Σ clickAdd×level) × Π(clickMult^level)`;
`perSecond = (Σ autoAdd×level) × (1 + Σ(autoPct×level)/100)`.
Additive aggregation first, then multipliers. Unlock "level" ∈ {0,1}.

**Cost:** `costAt(def, level) = def.kind==='repeatable' ? Math.ceil(baseCost × growth^level − 1e-9) : baseCost` — displayed price == charged price (integer).

## Tasks
- **T0 Scaffold + contracts** — `package.json` (`"type":"module"`; scripts `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `typecheck`, `test` (`vitest run`), `test:watch`; deps `phaser: "3.90.0"` exact; devDeps `typescript ~5.9`, `vite ^6`, `vitest ^3` — nothing else), `package-lock.json`, `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, target ES2022, moduleResolution bundler), `vite.config.ts` (from `vitest/config`; `base: './'`; test env `node`, include `src/**/*.test.ts`; raise `chunkSizeWarningLimit` for Phaser), `index.html` (`#game` + `#ui-root` containers), `src/main.ts` (minimal `Phaser.Game`, `pixelArt: true`, 1280×720 FIT, one empty scene with dark bg), `.gitignore`, `src/data/types.ts`, `src/simulation/state.ts`. Depends on: —.
  Acceptance: `npm install`, `npm run typecheck`, `npm run build` succeed; `npm test` runs (no tests OK); `npm ls phaser` = 3.90.0.
- **T1 Data: technologies + balance** — `src/data/technologies.ts` (`TECHNOLOGIES: Record<TechId, TechDefinition>`, `TECH_LIST` in tree order), `src/data/balance.ts` (`OFFLINE_CAP_SECONDS = 8*3600`, `AUTOSAVE_INTERVAL_MS = 15000`, `SAVE_KEY = 'wedtmd.save'`, `SAVE_BACKUP_KEY = 'wedtmd.save.corrupt'`, `MAX_UPDATE_SECONDS = OFFLINE_CAP_SECONDS`), `src/data/technologies.test.ts`. Depends on: T0.
  Acceptance: values match spec §6 exactly (costs, growth 1.15/1.20/1.18/1.20, effects, prerequisites); Reinforced Crank = `clickMult 2`; Flywheel = `autoPct 10`; Generator Blueprint = milestone, cost 0, requires `pistonArray≥1`, `flywheel≥1`, `lifetimeMe 1000`. maxLevels: Gear Ratio 25, Flywheel 10, Motor Tuning 25, Improved Pistons 25. Tests: unique ids, every requirement references a defined id, prerequisite graph acyclic, repeatables have growth>1, non-repeatables have growth/maxLevel `null`, unique `tree` positions, non-empty description. No balance number outside `src/data/`.
- **T2 Economy + production + tick/offline** — `src/simulation/economy/cost.ts` (`costAt`, `canAfford(state,cost)`), `src/simulation/production/rates.ts` (`computeRates(state, techs = TECHNOLOGIES): ProductionRates`), `src/simulation/production/tick.ts` (`applyClick(state): {state; gained}`, `advance(state, seconds): GameState` — adds ME + lifetimeMe, ignores dt≤0/non-finite; `computeOffline(state, nowMs, capSeconds = OFFLINE_CAP_SECONDS): OfflineReport`; `applyOffline(state, nowMs): {state; report}` — always sets `lastSimTime = nowMs`) + tests. Depends on: T0, T1.
  Acceptance: Gear Ratio cost L0..3 = 10/12/14/16; Motor Tuning L1 = 48. Initial 1/click, 0/s; Gear Ratio 3 → 4/click; +Reinforced Crank → 8. Worn Motor + Motor Tuning 5 → 6/s; +Piston Array → 11; +Improved Pistons 2 → 15; +Flywheel 2 → 18.0/s. 100×`advance(0.1)` ≡ 1×`advance(10)` (±1e-9). Offline capped at 8h, clamps to 0 if clock went backwards, uses `perSecond` only; second `applyOffline` at same `now` gains 0. Spending never reduces `lifetimeMe`.
- **T3 Number formatting** — `src/utils/format.ts` (`formatNumber(n, mode: 'floor'|'ceil'|'round'='floor')`, `formatRate(n)` → "12.5/s", `formatDuration(seconds)` → "2h 14m" / "45s"), `src/utils/format.test.ts`. Depends on: T0.
  Acceptance: 0→"0", 999→"999", 12.79→"12.7" (<1K: ≤1 decimal, trailing ".0" trimmed); 1000→"1K", 1500→"1.5K", 12345→"12.3K", 999999→"999K" (floor); 1e6→"1M", 1e9→"1B", 1e12→"1T", ≥1e15→"1.00e15"; ceil mode 1001→"1.01K"; negatives keep sign; NaN/Infinity→"0". Suffix table is a single array (extensible).
- **T4 Persistence** — `src/persistence/schema.ts` (`SAVE_VERSION = 1`, `validateEnvelope(unknown)`, `migrate(data, migrations = MIGRATIONS)` with `MIGRATIONS: Record<number,(d:unknown)=>unknown>`), `src/persistence/codec.ts` (`serialize(state, settings, nowMs): string`, `deserialize(raw: string|null, nowMs): LoadResult`), `src/persistence/saveManager.ts` (`interface KeyValueStorage {getItem;setItem;removeItem}`, `class SaveManager(storage, key = SAVE_KEY)` with `load(nowMs)`, `save(state, settings, nowMs)` → boolean, never throws on quota, `reset()`; `browserStorage()` returns localStorage or in-memory fallback) + tests with an in-memory storage. Hand-written guards, no schema libs. Depends on: T0, T1.
  Acceptance: round-trip deep-equal; `null`→`'new'`; invalid JSON / wrong types / NaN or negative ME / future version → `'recovered'` with fresh initial state and raw text written to `SAVE_BACKUP_KEY`; missing fields filled from defaults; unknown tech ids dropped; levels clamped to [0,maxLevel] (unlock/milestone [0,1]); `handCrank` forced to 1; injected v0→v1 test migration → `'migrated'`; module doesn't touch `window` at import time.
- **T5 Progression** — `src/simulation/progression/requirements.ts` (`isRequirementMet`, `requirementsMet(state, def)`, `requirementLabel(req)` → "Gear Ratio Lv 3" / "1K lifetime ME"), `status.ts` (`getTechStatus`, `getTechView(state,id)`, `getAllTechViews(state)`; effect texts like "+1 ME/click", "+10% automation"), `purchase.ts` (`purchase(state, id): PurchaseResult`, immutable), `milestones.ts` (`evaluateMilestones(state): {state; unlocked: TechId[]}`) + tests. Depends on: T1, T2.
  Acceptance: initial: Gear Ratio & Worn Motor available, Hand Crank purchased, others locked; Reinforced Crank unlocks at Gear Ratio 3; Flywheel needs Reinforced Crank + Worn Motor; Piston Array needs Motor Tuning 5; Improved Pistons needs Piston Array; failures leave state unchanged with correct reason (insufficient/locked/maxed/owned/notPurchasable for milestone/starting); success deducts exact cost, lifetimeMe unchanged; Generator Blueprint auto-unlocks only when all three conditions hold, consumes no ME, idempotent, reported once; full two-branch scripted run from initial reaches Generator Blueprint.
- **T6 GameSession facade** — `src/simulation/GameSession.ts`, `src/simulation/events.ts`, `src/simulation/index.ts` (barrel) + tests. `constructor({state, now = Date.now})`; `state` (readonly), `rates` (cached, recomputed on change); `click(): number`; `purchase(id): PurchaseResult`; `update(nowMs?)` advances by `clamp((now−lastSimTime)/1000, 0, MAX_UPDATE_SECONDS)`, sets `lastSimTime`, then evaluates milestones; `applyOffline(nowMs?): OfflineReport` (call once after load); `getTechView/getAllTechViews`; `reset(nowMs?)`; `on<K extends keyof SessionEvents>(type, fn): () => void`. `SessionEvents = { click:{gained}; purchase:{id;level;cost}; unlock:{id} /* level 0→1, incl. milestones */; milestone:{id}; offline:OfflineReport; reset:{} }`. Depends on: T2, T4 types, T5.
  Acceptance: purchase → unlock (first level only) → milestone event order; listeners unsubscribable; throwing listener doesn't break session; `update` twice with same `now` adds nothing; `applyOffline` then `update(now)` doesn't double-count; works with fake clock; no Phaser/DOM imports.
- **T7 Integration (EM)** — barrel exports, run all validation, fix T5/T6 mismatches, update status. Depends on: T1–T6.

Waves: A = T0 → B (parallel) = T1, T2, T3, T4 → C (parallel) = T5, T6 → D = T7.

## Validation
```
npm install && npm ls phaser typescript vite vitest
npm run typecheck
npm test
npm run build
grep -rnE "from ['\"]phaser" src/simulation src/data src/persistence src/utils && echo FAIL || echo OK
grep -rnE "\b(window|document)\." src/simulation src/data src/utils && echo FAIL || echo OK
```
Only `phaser` as a runtime dependency.

## Out of scope
Scenes/art, asset registry, camera, HUD, tech tree UI, `machineComponents.ts`, autosave timers / visibilitychange wiring, notifications/story messages, audio, ASSET_GUIDE/README, balance tuning.
