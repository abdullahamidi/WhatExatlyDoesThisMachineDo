# WP1 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/WP1.md` + `docs/GAME_SPEC.md`. Workers are `implementation-worker` agents (Haiku).

## How the Director uses this file

For every worker: spawn `implementation-worker` and paste **(1) the "Common preamble" below** followed by **(2) exactly one assignment block**. Workers in the same wave run in parallel; do not start a wave until the previous wave is validated (`npx tsc --noEmit` clean + that wave's tests green).

| Wave | Assignment ids | Parallel workers |
|---|---|---|
| A | **T0** | 1 |
| B | **T1** (data + cost.ts), **T3** (formatting) | 2 |
| C | **T2** (rates + tick/offline), **T4** (persistence), **T5** (progression) | 3 |
| D | **T6** (GameSession facade + barrel) | 1 |
| (then) | T7 = Engineering Manager Mode B (validate, fix glue, status) | — |

Deviations from `WP1.md` (deliberate, to make real parallelism safe — each wave only depends on files that already exist):
- `cost.ts`/`cost.test.ts` moved from T2 to **T1** (it is tiny and T1 owns the data it is tested against). T2 now = `rates.ts` + `tick.ts` only.
- **T5 moved up to wave C** (needs only T1 + cost.ts + T3 + T0 state, not T2). **T6 is alone in wave D** (needs T2 + T5).
- `validateEnvelope` takes `nowMs`; `deserialize`/`migrate` take an injectable migrations table (needed for tests).

---

# Common preamble (paste before every assignment)

```
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)

RULES
- Create/modify ONLY the files listed in your `files_owned`. If you need a change in any other file, STOP and report it as a blocker. Never edit src/data/types.ts, src/simulation/state.ts, package.json, tsconfig.json unless you are T0.
- Pure code only: files under src/simulation, src/data, src/persistence, src/utils must NOT import 'phaser' and must NOT use `window.` / `document.` (use `globalThis` if you really need a global).
- No balance numbers outside src/data/. No new dependencies. Do not run `npm install` (only T0 does). Do not commit.
- TS is strict: `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`. Use `import type { ... }` for type-only imports and `export type { ... }` for type-only re-exports. Imports between project files use relative paths WITHOUT file extension (e.g. `'../../data/types'`).
- Tests: Vitest, `import { describe, it, expect } from 'vitest'`, files named `*.test.ts` next to the code. Use `toBeCloseTo(x, 9)` for floats.
- Other workers are editing OTHER files at the same time. `npx tsc --noEmit` may show errors in files you do not own (half-written). Ignore those, fix only your own, and mention foreign errors in NOTES. Run only your own tests (`npx vitest run <path>`), not the whole suite.
- Test helper pattern (define locally in each test file; do not share files):
    const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
      const s = createInitialState(0);
      return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
    };

FINAL REPORT FORMAT
STATUS: done | blocked | partial
FILES: created/modified list
VALIDATION: each command -> result (paste failing output tail if any)
NOTES/BLOCKERS: ...

=== SHARED CONTRACT: src/data/types.ts (written verbatim by T0; everyone else imports from it) ===
export const TECH_IDS = ['handCrank','gearRatio','reinforcedCrank','flywheel','wornMotor',
  'motorTuning','pistonArray','improvedPistons','generatorBlueprint'] as const;
export type TechId = typeof TECH_IDS[number];
export type TechKind = 'starting' | 'unlock' | 'repeatable' | 'milestone';
export type Branch = 'origin' | 'mechanical' | 'automation' | 'convergence';
export type Effect =                       // repeatable effects apply per level
  | { type: 'clickAdd'; amount: number }   // additive ME/click
  | { type: 'clickMult'; factor: number }  // multiplicative manual
  | { type: 'autoAdd'; amount: number }    // additive ME/s
  | { type: 'autoPct'; percent: number }   // additive % pool -> (1 + sum%/100)
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

=== MODULE SIGNATURE INDEX (all of WP1; code against these exactly) ===
// src/data/balance.ts (T1)
export const OFFLINE_CAP_SECONDS = 8 * 3600;  export const AUTOSAVE_INTERVAL_MS = 15000;
export const SAVE_KEY = 'wedtmd.save';  export const SAVE_BACKUP_KEY = 'wedtmd.save.corrupt';
export const MAX_UPDATE_SECONDS = OFFLINE_CAP_SECONDS;
// src/data/technologies.ts (T1)
export const TECHNOLOGIES: Record<TechId, TechDefinition>;   export const TECH_LIST: TechDefinition[];  // same order as TECH_IDS
// src/simulation/state.ts (T0)
export const DEFAULT_SETTINGS: SettingsState;                // { muted: false }  (callers copy it: { ...DEFAULT_SETTINGS })
export function createInitialState(nowMs: number): GameState;
// src/simulation/economy/cost.ts (T1)
export function costAt(def: TechDefinition, level: number): number;
export function canAfford(state: GameState, cost: number): boolean;
// src/simulation/production/rates.ts (T2)
export function computeRates(state: GameState, techs?: Record<TechId, TechDefinition>): ProductionRates;  // default TECHNOLOGIES
// src/simulation/production/tick.ts (T2)
export function applyClick(state: GameState): { state: GameState; gained: number };
export function advance(state: GameState, seconds: number): GameState;
export function computeOffline(state: GameState, nowMs: number, capSeconds?: number): OfflineReport;   // default OFFLINE_CAP_SECONDS
export function applyOffline(state: GameState, nowMs: number): { state: GameState; report: OfflineReport };
// src/utils/format.ts (T3)
export function formatNumber(n: number, mode?: 'floor' | 'ceil' | 'round'): string;   // default 'floor'
export function formatRate(n: number): string;   export function formatDuration(seconds: number): string;
// src/persistence/* (T4)
export const SAVE_VERSION = 1;   (schema.ts)
export type Migration = (data: unknown) => unknown;
export const MIGRATIONS: Record<number, Migration>;
export function migrate(data: unknown, migrations?: Record<number, Migration>): { ok: true; data: unknown; migrated: boolean } | { ok: false; error: string };
export function validateEnvelope(input: unknown, nowMs: number): { ok: true; envelope: SaveEnvelope } | { ok: false; error: string };
export function serialize(state: GameState, settings: SettingsState, nowMs: number): string;     (codec.ts)
export function deserialize(raw: string | null, nowMs: number, migrations?: Record<number, Migration>): LoadResult;
export interface KeyValueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }  (saveManager.ts)
export class MemoryStorage implements KeyValueStorage {}
export class SaveManager { constructor(storage: KeyValueStorage, key?: string); load(nowMs: number): LoadResult; save(state: GameState, settings: SettingsState, nowMs: number): boolean; reset(): void }
export function browserStorage(): KeyValueStorage;
// src/simulation/progression/* (T5)
export function isRequirementMet(state: GameState, req: Requirement): boolean;          (requirements.ts)
export function requirementsMet(state: GameState, def: TechDefinition): boolean;
export function requirementLabel(req: Requirement): string;
export function getTechStatus(state: GameState, id: TechId): TechStatus;                (status.ts)
export function getTechView(state: GameState, id: TechId): TechView;
export function getAllTechViews(state: GameState): TechView[];                          // TECH_LIST order
export function purchase(state: GameState, id: TechId): PurchaseResult;                 (purchase.ts)
export function evaluateMilestones(state: GameState): { state: GameState; unlocked: TechId[] };   (milestones.ts)
// src/simulation/GameSession.ts + events.ts + index.ts (T6) — see T6 block
```

---

# WAVE A

## T0 — Scaffold + contracts

**objective**: Create a building, type-checking Vite+TS+Phaser project skeleton, install dependencies, and write the shared contract files.

**wave**: A (runs alone; everything else depends on it)

**files_owned** (exclusive):
`package.json`, `package-lock.json` (generated), `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`, `src/data/types.ts`, `src/simulation/state.ts`, `src/simulation/state.test.ts`

**context / exact contents**

1. `package.json`:
   - `"name": "what-exactly-does-this-machine-do"`, `"private": true`, `"version": "0.1.0"`, `"type": "module"`.
   - scripts: `"dev": "vite"`, `"build": "tsc --noEmit && vite build"`, `"preview": "vite preview"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"test:watch": "vitest"`.
   - `"dependencies": { "phaser": "3.90.0" }` (exact, no caret).
   - `"devDependencies": { "typescript": "~5.9.3", "vite": "^6.4.4", "vitest": "^3.2.7" }`. NOTHING else (no @types/*, no eslint, no prettier).
   - Then run `npm install` in the repo root (registry access works). If a version range cannot be resolved, run `npm view <pkg> versions --json`, pick the nearest version within the SAME range family (same major/minor for `~`, same major for `^`), and REPORT the change. Never switch Phaser off 3.90.0 (npm `latest` is Phaser 4 — wrong).
2. `tsconfig.json`: `compilerOptions`: `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `lib: ["ES2022","DOM","DOM.Iterable"]`, `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `isolatedModules: true`, `esModuleInterop: true`, `skipLibCheck: true`, `resolveJsonModule: true`, `useDefineForClassFields: true`, `noEmit: true`, `types: ["vite/client"]`. `"include": ["src", "vite.config.ts"]`.
3. `vite.config.ts`: `import { defineConfig } from 'vitest/config';` export default `defineConfig({ base: './', build: { chunkSizeWarningLimit: 1600 }, test: { environment: 'node', include: ['src/**/*.test.ts'], passWithNoTests: true } })`.
4. `index.html`: `<!doctype html>`, `lang="en"`, charset + viewport metas, `<title>What Exactly Does This Machine Do?</title>`, inline `<style>`: `html,body{margin:0;height:100%;background:#0d0b09;overflow:hidden}` `#game{position:fixed;inset:0}` `#ui-root{position:fixed;inset:0;pointer-events:none}`. Body: `<div id="game"></div><div id="ui-root"></div><script type="module" src="/src/main.ts"></script>`.
5. `.gitignore`: `node_modules`, `dist`, `coverage`, `*.log`, `*.tsbuildinfo`, `.vite`, `.DS_Store`.
6. `src/main.ts`: `import Phaser from 'phaser';` One `class BootScene extends Phaser.Scene` (constructor `super('Boot')`; `override create(): void { this.cameras.main.setBackgroundColor('#14110f'); }`). Then `new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 1280, height: 720, backgroundColor: '#14110f', pixelArt: true, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [BootScene] })`. Nothing else.
7. `src/data/types.ts`: copy the "SHARED CONTRACT" block from the preamble VERBATIM (all exports, same names, same field order; add `export` where shown).
8. `src/simulation/state.ts`: imports `TECH_IDS` (value) and types from `../data/types`. Exports `DEFAULT_SETTINGS: SettingsState = { muted: false }` and `createInitialState(nowMs: number): GameState` returning `{ me: 0, lifetimeMe: 0, totalClicks: 0, techLevels, lastSimTime: nowMs, createdAt: nowMs }` where `techLevels` is built by looping `TECH_IDS` (`const techLevels = {} as Record<TechId, number>; for (const id of TECH_IDS) techLevels[id] = id === 'handCrank' ? 1 : 0;`). Each call must return a fresh object.
9. `src/simulation/state.test.ts`: `createInitialState(1234)` -> `me 0`, `lifetimeMe 0`, `totalClicks 0`, `techLevels.handCrank === 1`, all other 8 levels `0`, `Object.keys(techLevels).length === 9`, `lastSimTime === 1234`, `createdAt === 1234`; two calls return different objects (`not.toBe`) and mutating one's `techLevels` does not affect the other; `DEFAULT_SETTINGS` equals `{ muted: false }`.

**constraints**: nothing in `src/main.ts` beyond the minimal game; no extra deps; do not create any other src files; `override` keyword is mandatory on overridden methods.

**acceptance**
- `npm install` succeeds; `npm ls phaser` shows `phaser@3.90.0`; `npm ls typescript vite vitest` shows versions inside the ranges.
- `npm run typecheck`, `npm test` (state.test.ts passes, exit 0), `npm run build` (produces `dist/`) all succeed.
- `package-lock.json` exists. `git status` shows `node_modules` and `dist` are ignored.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo && npm install && npm ls phaser typescript vite vitest
npm run typecheck && npm test && npm run build
git status --short
```

---

# WAVE B (parallel: T1 and T3 — disjoint files)

## T1 — Technology data, balance constants, cost formula

**objective**: Encode the spec §6 technology table as typed data, the balance constants, and the pure cost functions, with tests.

**wave**: B (parallel with T3)

**files_owned**: `src/data/technologies.ts`, `src/data/balance.ts`, `src/data/technologies.test.ts`, `src/simulation/economy/cost.ts`, `src/simulation/economy/cost.test.ts`

**context**: Import types from `../data/types` (see SHARED CONTRACT) and `createInitialState` from `src/simulation/state.ts` (exists after T0).

`src/data/balance.ts` — exactly these exports: `OFFLINE_CAP_SECONDS = 8 * 3600`, `AUTOSAVE_INTERVAL_MS = 15000`, `SAVE_KEY = 'wedtmd.save'`, `SAVE_BACKUP_KEY = 'wedtmd.save.corrupt'`, `MAX_UPDATE_SECONDS = OFFLINE_CAP_SECONDS`.

`src/data/technologies.ts` — `export const TECHNOLOGIES: Record<TechId, TechDefinition>` and `export const TECH_LIST: TechDefinition[] = TECH_IDS.map(id => TECHNOLOGIES[id])` (import `TECH_IDS` as a value). Use EXACTLY this table (`requires` order matters; `growth`/`maxLevel` are `null` for non-repeatable):

| id | name | kind | branch | baseCost | growth | maxLevel | effects | requires | tree {col,row} |
|---|---|---|---|---:|---:|---:|---|---|---|
| handCrank | Hand Crank | starting | origin | 0 | null | null | `[{clickAdd,1}]` | `[]` | 0,1 |
| gearRatio | Gear Ratio | repeatable | mechanical | 10 | 1.15 | 25 | `[{clickAdd,1}]` | `[tech handCrank 1]` | 1,0 |
| reinforcedCrank | Reinforced Crank | unlock | mechanical | 50 | null | null | `[{clickMult,2}]` | `[tech gearRatio 3]` | 2,0 |
| flywheel | Flywheel | repeatable | mechanical | 150 | 1.20 | 10 | `[{autoPct,10}]` | `[tech reinforcedCrank 1, tech wornMotor 1]` | 3,0 |
| wornMotor | Worn Motor | unlock | automation | 25 | null | null | `[{autoAdd,1}]` | `[tech handCrank 1]` | 1,2 |
| motorTuning | Motor Tuning | repeatable | automation | 40 | 1.18 | 25 | `[{autoAdd,1}]` | `[tech wornMotor 1]` | 2,2 |
| pistonArray | Piston Array | unlock | automation | 250 | null | null | `[{autoAdd,5}]` | `[tech motorTuning 5]` | 3,2 |
| improvedPistons | Improved Pistons | repeatable | automation | 120 | 1.20 | 25 | `[{autoAdd,2}]` | `[tech pistonArray 1]` | 4,2 |
| generatorBlueprint | Generator Blueprint | milestone | convergence | 0 | null | null | `[{none}]` | `[tech pistonArray 1, tech flywheel 1, lifetimeMe 1000]` | 4,1 |

Descriptions (non-empty; use these) and optional flavor:
- handCrank: "A rusted crank. Turn it to generate Mechanical Energy." / flavor "Manual operation detected."
- gearRatio: "Better-meshed gears. +1 ME per click per level."
- reinforcedCrank: "A sturdier crank arm. Doubles manual production." / flavor "This component was not designed to be replaced."
- flywheel: "A heavy wheel that stores momentum. +10% automation production per level."
- wornMotor: "A salvaged motor that turns by itself. +1 ME/s." / flavor "Synchronization unsuccessful."
- motorTuning: "Adjustments to the worn motor. +1 ME/s per level."
- pistonArray: "Rows of pistons hammering in sequence. +5 ME/s."
- improvedPistons: "Tighter tolerances, harder strokes. +2 ME/s per level."
- generatorBlueprint: "Something in the machine has begun to resemble a plan." / flavor "Primary function: UNKNOWN."

`src/simulation/economy/cost.ts`:
```ts
export function costAt(def: TechDefinition, level: number): number
// repeatable: Math.ceil(def.baseCost * Math.pow(def.growth ?? 1, level) - 1e-9); every other kind: def.baseCost
export function canAfford(state: GameState, cost: number): boolean   // state.me >= cost
```
`level` is the number of levels ALREADY owned (cost of the next purchase). Add a header comment documenting the formula and that displayed price == charged price.

**constraints**: all numbers live only in `technologies.ts`/`balance.ts`; no logic in data files except the `TECH_LIST` map.

**acceptance** (tests to write; all must pass)
- `technologies.test.ts`: ids unique and `Object.keys(TECHNOLOGIES)` equals `TECH_IDS` (as sets) and `TECH_LIST.length === 9` with `TECH_LIST.map(t=>t.id)` equal to `[...TECH_IDS]`; each `TECHNOLOGIES[id].id === id`; every `requires` tech id is a key of `TECHNOLOGIES`; prerequisite graph (tech-type requirements only) is acyclic (DFS with visiting-set); repeatables have `growth > 1` and `maxLevel >= 1`; non-repeatables have `growth === null && maxLevel === null`; `tree` positions (`col,row` as string key) unique; every `description` non-empty; exact-value table test for `baseCost`/`growth`/`maxLevel`/`kind` of all 9 (growths 1.15, 1.2, 1.18, 1.2; maxLevels 25, 10, 25, 25); `reinforcedCrank.effects` equals `[{type:'clickMult',factor:2}]`; `flywheel.effects` equals `[{type:'autoPct',percent:10}]`; generatorBlueprint is `milestone`, `baseCost 0`, `requires` equals `[{type:'tech',id:'pistonArray',minLevel:1},{type:'tech',id:'flywheel',minLevel:1},{type:'lifetimeMe',amount:1000}]`; balance constants have the exact values listed (`OFFLINE_CAP_SECONDS === 28800`, `MAX_UPDATE_SECONDS === 28800`).
- `cost.test.ts`: `costAt(gearRatio, 0..3)` = `10, 12, 14, 16`; `costAt(motorTuning, 1) === 48`; `costAt(motorTuning, 0) === 40`; `costAt(flywheel, 0) === 150`, `costAt(flywheel, 1) === 180`; `costAt(improvedPistons, 0) === 120`, `costAt(improvedPistons,1) === 144`; unlock `costAt(wornMotor, 0) === 25` and `costAt(pistonArray, 0) === 250` (level ignored); `costAt(handCrank,0) === 0`; every repeatable cost for levels 0..24 is an integer and strictly non-decreasing; `canAfford({me:10,...},10) === true`, `canAfford(me 9.999, 10) === false`, `canAfford(me 0, 0) === true`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation/economy
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/data src/simulation/economy && echo FAIL || echo OK
```

## T3 — Number formatting

**objective**: Implement display formatting helpers with a single extensible suffix table, with tests.

**wave**: B (parallel with T1)

**files_owned**: `src/utils/format.ts`, `src/utils/format.test.ts`

**context** (no project imports needed):
```ts
export const NUMBER_SUFFIXES: ReadonlyArray<{ value: number; suffix: string }> =
  [{ value: 1e3, suffix: 'K' }, { value: 1e6, suffix: 'M' }, { value: 1e9, suffix: 'B' }, { value: 1e12, suffix: 'T' }]; // the ONLY suffix table
export type RoundMode = 'floor' | 'ceil' | 'round';
export function formatNumber(n: number, mode: RoundMode = 'floor'): string
export function formatRate(n: number): string        // `${formatNumber(n)}/s`
export function formatDuration(seconds: number): string
```
Algorithm for `formatNumber` (apply `mode` to the MAGNITUDE; re-attach `-` afterwards unless the result string is "0"):
1. `!Number.isFinite(n)` -> `"0"`.
2. `a = Math.abs(n)`. If `a >= 1e15` -> `a.toExponential(2)` with the `+` removed (`"1.00e+15"` -> `"1.00e15"`), sign re-attached.
3. If `a < 1000`: round `a` to 1 decimal using the mode (`floor`: `Math.floor(a*10 + 1e-9)/10`; `ceil`: `Math.ceil(a*10 - 1e-9)/10`; `round`: `Math.round(a*10)/10`). If the result is `>= 1000` treat `a` as exactly 1000 and fall into step 4. Else output with trailing ".0" trimmed (`12.0` -> "12").
4. Else (1000 <= a < 1e15): pick the LARGEST suffix entry with `value <= a`; `scaled = a / value`. Keep **3 significant digits**: decimals = 2 if `scaled < 10`, 1 if `scaled < 100`, else 0; round `scaled` to `decimals` using the same mode/epsilon pattern. If the rounded value `>= 1000`: move to the next suffix with scaled = 1; if there is no next suffix, return `"1.00e15"`. Trim trailing zeros and a trailing dot (`1.00`->"1", `1.50`->"1.5"). Output = number string + suffix.

`formatDuration(seconds)`: non-finite or `< 0` -> `"0s"`; `s = Math.floor(seconds)`; `>= 3600`: `"Xh Ym"` (hours = floor(s/3600), minutes = floor(s%3600/60); omit the ` Ym` part when minutes is 0); `>= 60`: `"Xm Ys"` (omit ` Ys` when seconds is 0); else `"Xs"`. Hours are never converted to days.

**constraints**: no imports; no DOM; single suffix array; pure functions.

**acceptance** (test cases to write, exact expected strings)
- floor (default): `0->"0"`, `999->"999"`, `12.79->"12.7"`, `0.5->"0.5"`, `0.05->"0"`, `999.99->"999.9"`, `1000->"1K"`, `1500->"1.5K"`, `1001->"1K"`, `12345->"12.3K"`, `123456->"123K"`, `999999->"999K"`, `1e6->"1M"`, `2.5e6->"2.5M"`, `1e9->"1B"`, `1e12->"1T"`, `1e15->"1.00e15"`, `2.5e16->"2.50e16"`.
- ceil: `1001->"1.01K"`, `12.79->"12.8"`, `999999->"1M"`, `0.01->"0.1"`.
- round: `12.79->"12.8"`, `999999->"1M"`, `999.95->"1K"`.
- negatives: `-12.79->"-12.7"`, `-1500->"-1.5K"`, `-0.01->"0"`.
- invalid: `NaN`, `Infinity`, `-Infinity` -> `"0"`.
- `formatRate(12.5)->"12.5/s"`, `formatRate(0)->"0/s"`, `formatRate(1500)->"1.5K/s"`.
- `formatDuration`: `0->"0s"`, `45->"45s"`, `59.9->"59s"`, `60->"1m"`, `90->"1m 30s"`, `3599->"59m 59s"`, `3600->"1h"`, `3661->"1h 1m"`, `8040->"2h 14m"`, `28800->"8h"`, `-5->"0s"`, `NaN->"0s"`.
- `NUMBER_SUFFIXES` is exported, has 4 entries, strictly ascending `value`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/utils
npx tsc --noEmit
grep -nE "\b(window|document)\." src/utils/format.ts && echo FAIL || echo OK
```

---

# WAVE C (parallel: T2, T4, T5 — disjoint directories; T1, T3 are done)

## T2 — Production rates + tick / offline

**objective**: Implement the documented production formula, click/advance/offline pure functions, and tests.

**wave**: C

**files_owned**: `src/simulation/production/rates.ts`, `src/simulation/production/tick.ts`, `src/simulation/production/rates.test.ts`, `src/simulation/production/tick.test.ts`

**context**: imports: `TECH_IDS` + types from `../../data/types`; `TECHNOLOGIES` from `../../data/technologies`; `OFFLINE_CAP_SECONDS` from `../../data/balance`; `createInitialState` from `../state` (tests only).

`rates.ts`: header comment documenting the formula (required):
```
perClick  = (SUM clickAdd.amount x level) x PRODUCT(clickMult.factor ^ level)
perSecond = (SUM autoAdd.amount x level) x (1 + SUM(autoPct.percent x level) / 100)
Additive aggregation first, then multipliers. Unlock/milestone/starting level is 0 or 1. clickMult affects manual only; autoPct affects automation only.
```
`export function computeRates(state: GameState, techs: Record<TechId, TechDefinition> = TECHNOLOGIES): ProductionRates` — loop `TECH_IDS`, `level = state.techLevels[id]`, skip level <= 0, accumulate over `techs[id].effects` (`none` ignored).

`tick.ts`:
- `applyClick(state)`: `gained = computeRates(state).perClick`; returns `{ state: {...state, me: me+gained, lifetimeMe: lifetimeMe+gained, totalClicks: totalClicks+1}, gained }`.
- `advance(state, seconds)`: if `!Number.isFinite(seconds) || seconds <= 0` return the SAME `state` reference; else `g = computeRates(state).perSecond * seconds` and return `{...state, me: me+g, lifetimeMe: lifetimeMe+g}` (does NOT touch `lastSimTime`).
- `computeOffline(state, nowMs, capSeconds = OFFLINE_CAP_SECONDS)`: `elapsed = (nowMs - state.lastSimTime)/1000`; if not finite or negative -> 0; `capped = Math.min(elapsed, capSeconds)`; `gained = computeRates(state).perSecond * capped` (perSecond ONLY — never clicks). Returns `{ elapsedSeconds: elapsed, cappedSeconds: capped, gained }`.
- `applyOffline(state, nowMs)`: `report = computeOffline(state, nowMs)`; returns `{ state: {...state, me: me+report.gained, lifetimeMe: lifetimeMe+report.gained, lastSimTime: nowMs}, report }` — ALWAYS sets `lastSimTime = nowMs`, even when the clock went backwards. Never mutate inputs.

**constraints**: no balance numbers (the only constant is imported); no mutation; no DOM/Phaser.

**acceptance** (tests, exact values; use `withLevels`)
- `rates.test.ts`: initial -> `{perClick:1, perSecond:0}`; `gearRatio:3` -> perClick 4; `gearRatio:3, reinforcedCrank:1` -> perClick 8; `wornMotor:1, motorTuning:5` -> perSecond 6; + `pistonArray:1` -> 11; + `improvedPistons:2` -> 15; + `flywheel:2` -> 18 (`toBeCloseTo(18, 9)`); `flywheel:1` with no auto tech -> perSecond 0; `flywheel:1, wornMotor:1` -> perSecond `1.1` (closeTo); `reinforcedCrank:1` alone -> perClick 2; flywheel does not change perClick; custom `techs` argument (spread `TECHNOLOGIES` and replace `handCrank.effects` with `[{type:'clickAdd',amount:5}]`) -> perClick 5.
- `tick.test.ts`: `applyClick(initial)` -> `gained 1`, `me 1`, `lifetimeMe 1`, `totalClicks 1`, input state unchanged; `applyClick` with `gearRatio:3, reinforcedCrank:1` -> gained 8. `advance(state(wornMotor:1,motorTuning:5), 10)` -> `me 60`, `lifetimeMe 60`; `advance(..., 0)`, `-1`, `NaN`, `Infinity` return the same reference; 100 x `advance(s, 0.1)` vs 1 x `advance(s, 10)`: `me` equal within 1e-9 (use `toBeCloseTo(x, 9)`); advance keeps `lastSimTime` unchanged. Offline (rate 6/s, `lastSimTime: 0`): `computeOffline(s, 3_600_000)` -> `{elapsedSeconds:3600, cappedSeconds:3600, gained:21600}`; `computeOffline(s, 36_000_000)` (10 h) -> `{elapsedSeconds:36000, cappedSeconds:28800, gained:172800}`; clock backwards (`lastSimTime: 5000`, now `1000`) -> all zero; initial state (perSecond 0) after 1 h -> gained 0 even though clicks exist; custom cap: `computeOffline(s, 3_600_000, 60)` -> cappedSeconds 60, gained 360. `applyOffline(s, 3_600_000)` -> `state.me 21600`, `lifetimeMe 21600`, `lastSimTime 3600000`; a SECOND `applyOffline(result.state, 3_600_000)` -> `report.gained === 0` and `me` still 21600; `applyOffline` with now before lastSimTime -> me unchanged, `lastSimTime === now`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/production
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/simulation/production && echo FAIL || echo OK
```

## T4 — Persistence

**objective**: Versioned, defensive save/load: schema validation + migrations, JSON codec, storage-backed SaveManager, tests with in-memory storage.

**wave**: C

**files_owned**: `src/persistence/schema.ts`, `src/persistence/codec.ts`, `src/persistence/saveManager.ts`, `src/persistence/persistence.test.ts`

**context**: imports: types + `TECH_IDS` from `../data/types`; `TECHNOLOGIES` from `../data/technologies`; `SAVE_KEY`, `SAVE_BACKUP_KEY` from `../data/balance`; `createInitialState`, `DEFAULT_SETTINGS` from `../simulation/state`. Hand-written type guards only (no zod etc.). No top-level access to `window`/`localStorage` — use `globalThis` inside functions only.

`schema.ts`:
```ts
export const SAVE_VERSION = 1;
export type Migration = (data: unknown) => unknown;   // MIGRATIONS[n] migrates a version-n envelope to version n+1
export const MIGRATIONS: Record<number, Migration> = {};   // empty for v1
export function migrate(data: unknown, migrations: Record<number, Migration> = MIGRATIONS):
  { ok: true; data: unknown; migrated: boolean } | { ok: false; error: string }
```
`migrate`: `data` must be a non-null non-array object with an integer `version` >= 0 else `{ok:false}`; `version > SAVE_VERSION` -> `{ok:false, error:'Save is from a newer version'}`; while `version < SAVE_VERSION`: `fn = migrations[version]` (may be undefined -> `{ok:false}`); `data = { ...(fn(data) as object), version: version + 1 }` (wrap `fn` in try/catch -> `{ok:false}`); `migrated = true`.

`validateEnvelope(input: unknown, nowMs: number): { ok: true; envelope: SaveEnvelope } | { ok: false; error: string }` — lenient normaliser, strict on wrong types:
- input must be a plain object, `version === SAVE_VERSION`, else error.
- `savedAt`: missing -> `nowMs`; present must be finite number else error.
- `state`: must be an object (error otherwise). `me`, `lifetimeMe`, `totalClicks`: missing -> default (`me` 0, `lifetimeMe` = me, `totalClicks` 0); present must be a finite number `>= 0` (NaN, Infinity, negative, string -> error). After reading: `totalClicks = Math.floor(totalClicks)`, `lifetimeMe = Math.max(lifetimeMe, me)`. `lastSimTime`, `createdAt`: missing -> `nowMs`; present must be finite number.
- `techLevels`: missing -> initial levels; present must be a plain object (error otherwise). For each id in `TECH_IDS`: missing -> default (handCrank 1, others 0); present must be a finite number (else error); `Math.floor`; clamp to `[0, max]` where `max = TECHNOLOGIES[id].maxLevel` for repeatables and `1` for every other kind. Unknown keys are dropped. Finally force `techLevels.handCrank = 1`.
- `settings`: missing -> `{ ...DEFAULT_SETTINGS }`; present must be an object; `muted` missing -> default, present must be boolean else error.
- The returned envelope contains ONLY known fields (fresh objects).

`codec.ts`:
- `serialize(state, settings, nowMs)`: `JSON.stringify({ version: SAVE_VERSION, savedAt: nowMs, state, settings })`.
- `deserialize(raw, nowMs, migrations = MIGRATIONS): LoadResult`: `raw === null` -> `{ state: createInitialState(nowMs), settings: {...DEFAULT_SETTINGS}, status: 'new' }`. Otherwise `JSON.parse` in try/catch -> on failure/`migrate` failure/`validateEnvelope` failure return `{ state: createInitialState(nowMs), settings: {...DEFAULT_SETTINGS}, status: 'recovered', error: <message> }`. Success: `status = migrated ? 'migrated' : 'loaded'`, state/settings from the validated envelope. codec does NOT touch storage.

`saveManager.ts`:
```ts
export interface KeyValueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export class MemoryStorage implements KeyValueStorage { /* Map-backed */ }
export class SaveManager {
  constructor(storage: KeyValueStorage, key: string = SAVE_KEY)
  load(nowMs: number): LoadResult   // raw = getItem(key) in try/catch (throws -> treat as no save, status 'new', error set). deserialize. If status==='recovered' and raw!==null: try { storage.setItem(SAVE_BACKUP_KEY, raw) } catch {}
  save(state: GameState, settings: SettingsState, nowMs: number): boolean   // try setItem(key, serialize(...)) -> true; catch -> false (never throws)
  reset(): void   // try removeItem(key), swallow errors
}
export function browserStorage(): KeyValueStorage   // inside try: use (globalThis as {localStorage?: KeyValueStorage}).localStorage after a probe write/remove; any failure -> new MemoryStorage()
```

**constraints**: module must not touch `window`/`localStorage` at import time; no exceptions escape `save`/`reset`/`browserStorage`; don't change the shared types.

**acceptance** (tests in `persistence.test.ts`, using `MemoryStorage`; helper `withLevels`)
- Round trip: state `{me:123.5, lifetimeMe:500, totalClicks:7, gearRatio:4, wornMotor:1, lastSimTime:1000, createdAt:500}` + settings `{muted:true}` -> `deserialize(serialize(s,set,2000), 3000)` deep-equals `{state:s, settings:set, status:'loaded'}` (no `error` key). Also via `SaveManager.save` then `.load` -> same.
- `deserialize(null, 5000)` -> `status 'new'`, state deep-equals `createInitialState(5000)`, settings `{muted:false}`.
- `status 'recovered'` (state deep-equals `createInitialState(now)`, `error` is a non-empty string) for: `'{not json'`, `''`, `'123'`, `'null'`, `'[]'`, `JSON.stringify({version:1,savedAt:1,state:{me:-5}})`, `...state:{me:'ten'}`, `...state:{me:null}` (what NaN serialises to), and the raw string `'{"version":1,"state":{"me":1e999}}'` (Infinity), `{version: 999, ...valid}` (future), `{version:1, state:{...}, settings:{muted:'yes'}}`, `techLevels: {gearRatio: 'x'}`.
- A bare `JSON.stringify({version:1})` (no `state` object) -> `'recovered'`.
- Missing fields: `JSON.stringify({version:1, state:{me:50}})` -> status `'loaded'`, `me 50`, `lifetimeMe 50`, `totalClicks 0`, `handCrank 1`, other levels 0, `lastSimTime === nowMs` passed in, `createdAt === nowMs`, settings `{muted:false}`.
- Unknown tech ids dropped: `techLevels: {gearRatio:2, bogus:9}` -> result has no `bogus` key, `gearRatio 2`.
- Clamping: `gearRatio: 999` -> 25; `flywheel: 11` -> 10; `wornMotor: 5` -> 1; `gearRatio: -3` -> 0; `gearRatio: 2.9` -> 2; `handCrank: 0` -> forced 1; `lifetimeMe` lower than `me` (`me 100, lifetimeMe 10`) -> `lifetimeMe 100`.
- Migration: raw v0 `JSON.stringify({version:0, savedAt:1, state:{me:5}})` with injected `{0: (d) => ({ ...(d as object), settings: { muted: true } })}` -> `status 'migrated'`, `me 5`, `settings.muted === true`. Same raw with default (empty) MIGRATIONS -> `'recovered'`. Direct `migrate` tests: version 1 -> `{ok:true, migrated:false}`; version 2 -> `{ok:false}`; non-object -> `{ok:false}`.
- SaveManager: `load` on empty storage -> `'new'`; after corrupt data in storage under `SAVE_KEY`, `load` -> `'recovered'` AND `storage.getItem(SAVE_BACKUP_KEY)` equals the raw corrupt text; `save` returns `true`; `save` against a storage whose `setItem` throws (quota) returns `false` without throwing; `reset()` then `load` -> `'new'`; custom key respected (`new SaveManager(mem, 'other')` writes under 'other').
- `browserStorage()` in the node test env returns an object that works (set/get/remove round trip).
- Importing the three modules does not throw in node (no `window`).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence
npx tsc --noEmit
grep -nE "\b(window|document)\." src/persistence/*.ts && echo FAIL || echo OK
```

## T5 — Progression (requirements, status/views, purchase, milestones)

**objective**: Implement tech requirement checks, status/view derivation, immutable purchasing, and automatic milestone evaluation, with tests.

**wave**: C

**files_owned**: `src/simulation/progression/requirements.ts`, `src/simulation/progression/status.ts`, `src/simulation/progression/purchase.ts`, `src/simulation/progression/milestones.ts`, `src/simulation/progression/progression.test.ts`

**context**: imports: types from `../../data/types`; `TECHNOLOGIES`, `TECH_LIST` from `../../data/technologies`; `costAt`, `canAfford` from `../economy/cost`; `formatNumber` from `../../utils/format`; `createInitialState` from `../state` (tests). Signatures: see MODULE SIGNATURE INDEX (`progression` block).

Rules (all must be implemented exactly as written):
- `isRequirementMet(state, req)`: `tech` -> `state.techLevels[req.id] >= req.minLevel`; `lifetimeMe` -> `state.lifetimeMe >= req.amount`. `requirementsMet(state, def)` = every requirement met (empty -> true).
- `requirementLabel(req)`: `lifetimeMe` -> `` `${formatNumber(req.amount)} lifetime ME` `` (1000 -> "1K lifetime ME"). `tech` -> `name = TECHNOLOGIES[req.id].name`; if `req.minLevel > 1` OR the required tech's `kind === 'repeatable'` -> `` `${name} Lv ${req.minLevel}` `` else just `name`. So: handCrank -> "Hand Crank", wornMotor -> "Worn Motor", `gearRatio 3` -> "Gear Ratio Lv 3", `flywheel 1` -> "Flywheel Lv 1", `motorTuning 5` -> "Motor Tuning Lv 5".
- `getTechStatus(state, id)`: `level = state.techLevels[id]`, `def = TECHNOLOGIES[id]`.
  - `starting` -> `'purchased'` if level >= 1 else `'available'` (handCrank is forced to 1 so effectively purchased).
  - `milestone` -> `'purchased'` if level >= 1 else `'locked'` (a milestone is never `'available'`, even if its conditions are met but unevaluated).
  - `unlock` -> level >= 1 -> `'purchased'`; else requirementsMet -> `'available'`; else `'locked'`.
  - `repeatable` -> `maxLevel !== null && level >= maxLevel` -> `'purchased'`; else level >= 1 -> `'available'`; else requirementsMet -> `'available'`; else `'locked'`.
- `getTechView(state, id)`:
  - `level` = owned level; `requirements` = `def.requires.map(req => ({req, met: isRequirementMet(state, req), label: requirementLabel(req)}))`.
  - `nextCost`: `null` for `starting`/`milestone`, for owned `unlock`, and for maxed repeatable; otherwise `costAt(def, level)` (shown even when locked).
  - `affordable = status === 'available' && nextCost !== null && canAfford(state, nextCost)`.
  - Effect text helper `effectText(effects, n)` for `n` levels: join parts with `", "`; parts: `clickAdd` -> `+${amount*n} ME/click`; `clickMult` -> `×${factor**n} manual production`; `autoAdd` -> `+${amount*n} ME/s`; `autoPct` -> `+${percent*n}% automation`; `none` -> `Effect unknown`. Numbers rendered with `String(Number(x.toFixed(2)))`.
  - `currentEffectText = level === 0 ? 'None' : effectText(def.effects, level)`. `nextEffectText`: `effectText(def.effects, 1)` when `level === 0` (includes locked unlocks and an unowned milestone); `effectText(def.effects, level + 1)` (cumulative total) for a repeatable with `1 <= level < maxLevel`; `null` otherwise (owned unlock/starting/owned milestone, or maxed repeatable).
- `getAllTechViews(state)` = `TECH_LIST.map(t => getTechView(state, t.id))`.
- `purchase(state, id)`: never mutates; checks IN THIS ORDER: kind `starting` or `milestone` -> `{ok:false, reason:'notPurchasable'}`; `unlock` with level >= 1 -> `'owned'`; repeatable with `maxLevel !== null && level >= maxLevel` -> `'maxed'`; `!requirementsMet` -> `'locked'`; `!canAfford(state, cost)` -> `'insufficient'`. Success: `cost = costAt(def, level)`; new state = `{...state, me: state.me - cost, techLevels: {...state.techLevels, [id]: level + 1}}` (lifetimeMe untouched); return `{ ok: true, state: next, cost, newLevel: level + 1 }`. Failures return no state (caller's state is unchanged).
- `evaluateMilestones(state)`: iterate `TECH_LIST` in order; for each `kind === 'milestone'` with level 0 and `requirementsMet(current, def)` -> set its level to 1 (using the updated state for later items), push id. Returns `{ state, unlocked }`; if nothing unlocked, return the SAME `state` reference and `unlocked: []`. Consumes no ME, idempotent.

**constraints**: no imports of Phaser/DOM; no balance numbers; never mutate inputs; keep each file focused (one concern per file).

**acceptance** (tests in `progression.test.ts`, exact values)
- Initial state statuses: handCrank `purchased`; gearRatio `available`; wornMotor `available`; reinforcedCrank, flywheel, motorTuning, pistonArray, improvedPistons, generatorBlueprint all `locked`.
- Unlock thresholds via `getTechStatus`: reinforcedCrank locked at `gearRatio:2`, available at `gearRatio:3`; flywheel locked with only `reinforcedCrank:1` (+gearRatio 3), locked with only `wornMotor:1`, available with both; motorTuning available with `wornMotor:1`; pistonArray locked at `motorTuning:4`, available at `motorTuning:5` (+wornMotor 1); improvedPistons available with `pistonArray:1`; gearRatio at 25 -> `purchased`; at 24 -> `available`.
- Labels: `requirementLabel({type:'tech',id:'gearRatio',minLevel:3}) === 'Gear Ratio Lv 3'`, `{tech wornMotor 1}` -> 'Worn Motor', `{tech flywheel 1}` -> 'Flywheel Lv 1', `{lifetimeMe 1000}` -> '1K lifetime ME'; generatorBlueprint view `requirements.map(r => r.label)` equals `['Piston Array','Flywheel Lv 1','1K lifetime ME']`, all `met:false` initially.
- Views: `gearRatio` at level 2, me 20: `status 'available'`, `level 2`, `nextCost 14`, `affordable true`, `currentEffectText '+2 ME/click'`, `nextEffectText '+3 ME/click'`; at me 13 -> `affordable false`. gearRatio level 0: current `'None'`, next `'+1 ME/click'`, nextCost 10. wornMotor owned: current `'+1 ME/s'`, next `null`, nextCost `null`, status `purchased`. reinforcedCrank unowned: current `'None'`, next `'×2 manual production'`, nextCost 50. flywheel level 2 (with prereqs): current `'+20% automation'`, next `'+30% automation'`. handCrank: current `'+1 ME/click'`, next `null`, nextCost `null`. generatorBlueprint unowned: current 'None', next 'Effect unknown'; owned: current 'Effect unknown', next null. gearRatio level 25: nextCost `null`, next `null`. `getAllTechViews(initial).length === 9` in `TECH_IDS` order.
- Purchase failures (state deep-equal before/after for the INPUT state; result has only `ok:false` + `reason`): initial, `purchase('gearRatio')` -> `insufficient`; `purchase('motorTuning')` with me 1000 -> `locked`; `purchase('reinforcedCrank')` me 1000, `gearRatio:2` -> `locked`; `purchase('wornMotor')` when owned -> `owned`; `purchase('gearRatio')` at level 25 (me 1e9) -> `maxed`; `purchase('handCrank')` -> `notPurchasable`; `purchase('generatorBlueprint')` (even with me 1e9, locked) -> `notPurchasable`.
- Purchase success: `{me:10, lifetimeMe:10}` buy gearRatio -> `ok`, `cost 10`, `newLevel 1`, new `me 0`, `techLevels.gearRatio 1`, `lifetimeMe 10`; input state unchanged (`me 10`, level 0, different object refs for state and techLevels). Level 1 with me 12 -> cost 12, newLevel 2, me 0. `reinforcedCrank` with me 50, `gearRatio:3` -> cost 50, me 0, level 1; buying it again -> `owned`. Spending never reduces `lifetimeMe` (assert across 3 successive purchases).
- Milestones: `{pistonArray:1, flywheel:1}` with `lifetimeMe 999` -> `unlocked []` and same state reference; `lifetimeMe 1000` -> `unlocked ['generatorBlueprint']`, `techLevels.generatorBlueprint 1`, `me` unchanged; calling again on the result -> `unlocked []` (idempotent, same reference); missing `flywheel` -> none; missing `pistonArray` -> none. Status of generatorBlueprint after unlock: `purchased`.
- Scripted two-branch run: start `{...createInitialState(0), me: 1e6, lifetimeMe: 1e6}`; call `purchase` in order and assert `ok` each time: gearRatio x3 (10,12,14), reinforcedCrank (50), wornMotor (25), flywheel (150), motorTuning x5 (40,48,56,66,78), pistonArray (250). Then `evaluateMilestones` -> `unlocked ['generatorBlueprint']`; final `me === 1e6 - 799`; final `lifetimeMe === 1e6`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/progression
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/simulation/progression && echo FAIL || echo OK
grep -rnE "\b(window|document)\." src/simulation/progression && echo FAIL || echo OK
```

---

# WAVE D

## T6 — GameSession facade, events, barrel

**objective**: Compose the pure modules into a single stateful `GameSession` with typed events, and a barrel export.

**wave**: D (alone; T2 and T5 are complete)

**files_owned**: `src/simulation/events.ts`, `src/simulation/GameSession.ts`, `src/simulation/index.ts`, `src/simulation/GameSession.test.ts`

**context**: imports available (all exist now; signatures in MODULE SIGNATURE INDEX): `applyClick, advance, applyOffline` from `./production/tick`; `computeRates` from `./production/rates`; `purchase` from `./progression/purchase`; `evaluateMilestones` from `./progression/milestones`; `getTechView, getAllTechViews` from `./progression/status`; `createInitialState` from `./state`; `MAX_UPDATE_SECONDS` from `../data/balance`; types from `../data/types`.

`events.ts`:
```ts
import type { OfflineReport, TechId } from '../data/types';
export interface SessionEvents {
  click: { gained: number };
  purchase: { id: TechId; level: number; cost: number };
  unlock: { id: TechId };            // tech level 0 -> 1, INCLUDING milestones
  milestone: { id: TechId };
  offline: OfflineReport;
  reset: Record<string, never>;
}
export type Listener<K extends keyof SessionEvents> = (payload: SessionEvents[K]) => void;
export class TypedEmitter {   // listeners per event type; emit() calls each listener inside try/catch (log with console.error, never rethrow); on() returns an unsubscribe () => void
  on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void;
  emit<K extends keyof SessionEvents>(type: K, payload: SessionEvents[K]): void;
}
```

`GameSession.ts`:
```ts
export interface GameSessionOptions { state: GameState; now?: () => number }   // now defaults to Date.now
export class GameSession {
  constructor(options: GameSessionOptions)
  get state(): GameState                         // current immutable snapshot (never mutated in place)
  get rates(): ProductionRates                   // cached; recomputed ONLY when state.techLevels reference changes
  click(): number                                // applyClick; emit 'click'; then milestone check; returns gained
  purchase(id: TechId): PurchaseResult           // on failure: no events, state unchanged. On success: set state, recompute rates, emit 'purchase' {id, level: newLevel, cost}; if previous level was 0 emit 'unlock' {id}; then milestone check
  update(nowMs?: number): void                   // nowMs default this.now(); if !finite return; dt = clamp((nowMs - state.lastSimTime)/1000, 0, MAX_UPDATE_SECONDS); state = advance(state, dt) then lastSimTime = nowMs (always); then milestone check
  applyOffline(nowMs?: number): OfflineReport    // call once after load; uses production/tick applyOffline; emits 'offline' (always, even if gained 0); then milestone check; returns the report
  getTechView(id: TechId): TechView;  getAllTechViews(): TechView[]
  reset(nowMs?: number): void                    // state = createInitialState(nowMs ?? now()); recompute rates; emit 'reset' {}
  on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void
}
```
Private "milestone check": `evaluateMilestones(state)`; adopt new state (recompute rates since techLevels changed); for each unlocked id emit `'unlock' {id}` THEN `'milestone' {id}`. Event order for a purchase that completes a milestone: `purchase`, `unlock`(purchased tech, only if first level), `unlock`(milestone), `milestone`. A single private `setState(next)` helper should recompute `rates` only when `next.techLevels !== this._state.techLevels`. The constructor does not emit events and does not mutate the given state.

`index.ts` barrel (use `export type` for type-only): re-export everything from `./GameSession`, `./events`, `./state`, `./economy/cost`, `./production/rates`, `./production/tick`, `./progression/requirements`, `./progression/status`, `./progression/purchase`, `./progression/milestones`. Do NOT export from persistence or data. If two modules export the same name, report as a blocker (none expected).

**constraints**: no Phaser/DOM imports; no timers; no `Date.now()` except as the default of the injectable `now`; no balance numbers; do not edit T2/T5 files — report mismatches as blockers.

**acceptance** (tests in `GameSession.test.ts`; use a fake clock `let t = 0; now: () => t`; build states via `withLevels` with `lastSimTime: 0`)
- `click()` on initial -> returns 1, `state.me 1`, `lifetimeMe 1`, `totalClicks 1`; 'click' listener received `{gained:1}`.
- `update`: `wornMotor:1` (1/s), `lastSimTime 0`: `update(5000)` -> `me 5`, `lastSimTime 5000`; `update(5000)` again -> `me` still 5. Clamp: `update(36_000_000)` from `lastSimTime 0` at 1/s -> `me 28800`. Clock backwards: `lastSimTime 10_000`, `update(2_000)` -> `me` unchanged, `lastSimTime 2000`. `update()` with no arg uses the fake clock.
- `rates`: initial `{perClick:1, perSecond:0}`; the same object reference is returned across `update` calls (`expect(a).toBe(b)`); after buying `gearRatio` perClick is 2.
- `applyOffline`: state `wornMotor:1, motorTuning:5` (6/s), `lastSimTime 0`: `applyOffline(3_600_000)` -> report `{elapsedSeconds:3600, cappedSeconds:3600, gained:21600}`, `state.me 21600`; then `update(3_600_000)` -> `me` still 21600 (no double count); 'offline' event fired once with that report. 10 h offline -> `cappedSeconds 28800`, `gained 172800`.
- Purchase flow: initial `purchase('gearRatio')` -> `{ok:false, reason:'insufficient'}`, no events. After 10 clicks (me 10): `purchase('gearRatio')` -> `ok`, `cost 10`, `newLevel 1`, `me 0`, `rates.perClick 2`; events seen (record all in order) after that purchase: `['purchase:gearRatio:1:10', 'unlock:gearRatio']`. Then 6 clicks (me 12) -> `purchase('gearRatio')` ok cost 12, newLevel 2 and ONLY a `purchase` event (no second `unlock`).
- Milestone order: state `{gearRatio:3, reinforcedCrank:1, wornMotor:1, motorTuning:5, pistonArray:1}` with `me 1000, lifetimeMe 2000`; `purchase('flywheel')` -> ok, cost 150, `me 850`; recorded events exactly `[purchase{flywheel,1,150}, unlock{flywheel}, unlock{generatorBlueprint}, milestone{generatorBlueprint}]`; `state.techLevels.generatorBlueprint === 1`, `me` still 850; a later `update` emits no further milestone/unlock events.
- Listeners: `const off = session.on('click', fn)`; after `off()`, `click()` does not call `fn`. A listener that throws (spy `console.error` with `vi.spyOn(console,'error').mockImplementation(()=>{})`) does not make `click()` throw, and a second listener still receives the event.
- `reset(5000)`: after clicks and a purchase -> `me 0`, `totalClicks 0`, levels = initial, `lastSimTime 5000`, `rates.perClick 1`; 'reset' event fired once.
- `getAllTechViews().length === 9`; `getTechView('gearRatio').status === 'available'` initially.
- Barrel: `import * as api from './index'` exposes `GameSession`, `createInitialState`, `computeRates`, `purchase`, `evaluateMilestones`, `costAt` (typeof function).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/GameSession.test.ts
npx tsc --noEmit
grep -rnE "from ['\"]phaser" src/simulation && echo FAIL || echo OK
grep -rnE "\b(window|document)\." src/simulation && echo FAIL || echo OK
```

---

# T7 — Integration (Engineering Manager, Mode B; not a worker assignment)

After wave D: run `npm install && npm ls phaser typescript vite vitest`, `npm run typecheck`, `npm test`, `npm run build`, and the two grep checks from `WP1.md` (`src/simulation src/data src/persistence src/utils` for `phaser` imports; `src/simulation src/data src/utils` for `window.`/`document.`); check `package.json` has only `phaser` as runtime dep; walk each task's acceptance list; emit fix assignments (same format) for failures.

# Risks / notes for the Director

1. T0 is the single point of failure (npm resolution of `vite ^6.4.4` / `vitest ^3.2.7`, Phaser typings under `esModuleInterop`, `vitest run` exiting 1 with no tests — mitigated by `passWithNoTests` and a small `state.test.ts`). Validate wave A fully before B.
2. Parallel workers share one tree: transient `tsc` errors in sibling files are expected inside a wave; the preamble tells workers to ignore them. Run a clean full `npx tsc --noEmit` + `npx vitest run` between waves.
3. Interpretation choices made by the EM where the plan was silent (workers follow these, change only via a new assignment): `formatNumber` = 1 decimal below 1K, 3 significant digits above, with rollover; milestone status is `locked` until owned; `nextEffectText` is the cumulative effect at level+1; `click()`/`purchase()`/`applyOffline()` also trigger the milestone check (not only `update`); milestone unlock emits `unlock` then `milestone`; `update` always sets `lastSimTime = now`.
4. T4 (persistence) and T6 (event ordering) are the highest Haiku-difficulty tasks; if either returns `partial`, give it a targeted fix assignment listing the failing test names rather than re-running the whole task.
5. In T4, a missing `state` object is an error (`'recovered'`), whereas missing fields INSIDE `state` are filled from defaults (`'loaded'`) — both cases are in its test list.
