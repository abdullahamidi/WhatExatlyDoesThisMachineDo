# WP7 — Worker Assignments (Engineering Manager, Mode A)

Source: `docs/plan/ROADMAP_FULL.md` §1 (formula), §3 (systems), §6 (WP7 spec) + real code read at HEAD `49fc3f1`. Workers are `implementation-worker` agents (Haiku).
Goal: replace the single-ME economy with a resource map + generic effects, save v1 -> v2, number suffixes, reusable greedy harness. **No new content.** Era I plays identically: greedy 4 clicks/s first-purchase times stay `wornMotor 0:13 (13 s)`, `reinforcedCrank 3:16 (196 s)`, `pistonArray 12:02 (722 s)`, `generatorBlueprint 22:06 (1326 s)` (verified against HEAD with `--silent=false`; also gearRatio 0:04, flywheel 4:49 = 289 s, motorTuning 0:20, improvedPistons 12:38 = 758 s). Baseline: 602 tests, 34 files, all green.

## How the Director uses this file

For every worker: spawn `implementation-worker`, paste **(1) the "Common preamble"** then **(2) exactly one assignment block**. Same-wave workers run in parallel. Between waves run the wave's own tests (`npx vitest run <files>`) and `npx tsc --noEmit`, and compare errors against the "Expected transient tsc errors" table.

| Wave | Ids | Workers |
|---|---|---|
| 1 | **T1** core types + resource table + tech/log data + `simulation/{resources,state}` (+tests), **T3** number formatting + balance constants | 2 |
| 2 | **T2a** rates + tick + cost (+tests), **T4a** save v2 schema + migration + fixture (+persistence tests), **T5b** notification/system-log rules + animator/audio call sites + smoke script edits | 3 |
| 3 | **T2b** progression + GameSession + events + barrel (+tests) | 1 |
| 4 | **T4b** startup/saveController call sites (+tests), **T5a** HUD + tech-tree view/DOM, **T6** greedy harness + balance sim | 3 |
| 5 | EM Mode B (validate, one-line glue), Director smoke tests | — |

Why 4 build waves: every simulation module depends on the new types (T1); `GameSession`/progression depend on the new `computeRates`/`applyClick`/`canAfford` (T2a); persistence controller tests, UI view tests and the harness call `GameSession`/`getAllTechViews`/`purchase` at runtime (T2b). Splitting T2 into T2a/T2b keeps each Haiku worker at <= 9 files. `createInitialState` lives in T1 so T4a can run beside T2a.

### Expected transient tsc errors (not a worker fault)

| After | Allowed to fail typecheck |
|---|---|
| W1 | everything importing the changed types: all of `src/simulation/**` (except `resources*.ts`, `state*.ts`), `src/persistence/**`, `src/ui/**`, `src/audio/**`, `src/game/**` |
| W2 | `src/simulation/{GameSession,events,index}.ts`, `src/simulation/progression/*`, `src/simulation/GameSession.test.ts`, `src/simulation/balance.sim.test.ts`, `src/persistence/{saveController,startup}*`, `src/ui/{hud,hudView,techTree,techTreeView}*`, `src/game/scenes/WorldScene.ts` |
| W3 | `src/persistence/{saveController,startup}*` (tests/impl where they use `me`/`gained`), `src/ui/{hud,hudView,techTree,techTreeView}*`, `src/game/scenes/WorldScene.ts`, `src/simulation/balance.sim.test.ts` |
| W4 | none: `npx tsc --noEmit`, `npm test`, `npm run build` all clean |

Any tsc error outside those lists (and outside the files of the running wave) is a real bug. Workers run only their own tests; foreign tsc errors go in NOTES.

## Decisions / deviations from `ROADMAP_FULL.md` §6 (deliberate)

1. **T2 split** into T2a/T2b, **T5 split** into T5a (HUD+tree)/T5b (rules, animator, audio, smoke), **T4 split** into T4a/T4b (see wave reasoning above). Roadmap waves (W1 T1+T3, W2 T2, W3 T4+T5+T6) become 4 build waves.
2. **Harness buy policy.** The roadmap says "cheapest affordable per resource"; the OLD sim buys the globally cheapest *available* tech and only if affordable. To keep era-I times exact the harness uses: per resource, the cheapest AVAILABLE non-milestone tech whose `costRes` is that resource (ties: TECH_IDS order, strict `<`); buy it only if affordable. At most one purchase per resource per buy tick. With only `me` this equals the old policy. **Do not change to "cheapest affordable"** (it would change era-I times).
3. **Injectable tech tables** so every new effect type is unit-testable without era II data: optional trailing `techs: Record<TechId, TechDefinition> = TECHNOLOGIES` on `computeRates`, `applyClick`, `advance`, `computeOffline`, `applyOffline`, `purchase`, `getTechView`. Default behaviour unchanged.
4. `META_MULT = 1` and `DESIGN_MAX_VALUE = 1e100` both live in `src/data/balance.ts` (T3). Rates multiply by `META_MULT` (prestige hook for WP15).
5. `GameSession.click()` still returns the ME gained (`number`) so `HandCrank` floating text is untouched. `HandCrank.ts`, `WorldScene.ts`, `bootstrap.ts`, `debugHook.ts`, `systemLog.ts`, `toasts.ts`, `context.ts` need NO change (their calls stay type-compatible by design: `buildHudView(session.state, session.rates)`, `seedTracker(session.state, ...)`).
6. HUD: only a pure `rows` view + hidden DOM rows for non-ME resources (hidden while `lifetime == 0 && perSecond == 0`). Proper HUD resource rows are WP8.
7. `formatNumber` for 1e15..1e36 changes from `1.00e15` to suffixes (Qa..Dc) as the roadmap requires; everything below 1e15 is byte-identical.
8. Era-I flavour/log/plaque text, assets, camera, world, settings, stats: untouched.

---

# Common preamble (paste before every assignment)

```
PROJECT: "What Exactly Does This Machine Do?" — Phaser 3.90 + strict TypeScript + Vite + Vitest incremental game.
Repo root: /home/user/WhatExatlyDoesThisMachineDo   (use absolute paths)
Work package WP7: replace the single Mechanical-Energy economy with a multi-resource economy (resource map + generic effects), migrate saves v1 -> v2, add big-number suffixes, make the greedy balance simulation a reusable harness. NO new content: era I (9 techs, all cost ME) must behave exactly as before, to the float.

RULES
- Create/modify ONLY the files in your `files_owned`. Need another file changed? STOP, report as blocker.
  Never edit package.json, tsconfig.json, vite.config.ts, index.html, docs/**, anything under public/ or src/assets/.
- PURE (no 'phaser', no `window`/`document`/`AudioContext`): src/data/**, src/simulation/**, src/persistence/**, src/utils/**, src/ui/*Rules.ts, src/ui/*View.ts. DOM files (src/ui/hud.ts, src/ui/techTree.ts) may use `document`/`window` but NEVER import Phaser.
- All balancing constants live in src/data/. No `0x......` literals under src/game, src/ui, src/audio.
- TS strict + noUncheckedIndexedAccess + noImplicitOverride + isolatedModules. `import type` for types. Relative imports without extension. No `any`. No `!` non-null on possibly-undefined values in src (a `!` in tests after an asserted lookup is fine).
- Tests: Vitest (`import { describe, it, expect } from 'vitest'`), node env, `*.test.ts` next to code, `toBeCloseTo(x, 9)` for floats, avoid `-0` (normalise). Keep every existing test's intent: update it to the new shape, do not delete coverage.
- ERA-I EXACTNESS: for era-I data, `X * 1`, `X + 0`, `Math.pow(1, n)` must not change any value. Do not reorder additions of era-I terms. Do not "simplify" arithmetic.
- Other workers edit OTHER files concurrently or in earlier waves. `npx tsc --noEmit` may show errors in files you do not own: ignore, fix only yours, list foreign errors in NOTES. Run only your own tests.
- No new dependencies, no npm install, no commits, no markdown/report files, no console.log in src.
- Report in caveman style. FORMAT:
  STATUS: done | blocked | partial / FILES: ... / VALIDATION: command -> result / NOTES/BLOCKERS: ...

=== FINAL CONTRACTS (exact; every worker codes against these; they are the source of truth) ===

// ---- src/data/types.ts (T1) ----
export const RESOURCE_IDS = ['me', 'ee', 'pr', 'rs', 'xf'] as const;
export type ResourceId = typeof RESOURCE_IDS[number];
export type ResourceMap = Record<ResourceId, number>;
export interface ResourceDefinition { id: ResourceId; name: string; short: string; era: number; source: ResourceId | null; convExp: number }
export type Effect =                                   // repeatable effects apply per level
  | { type: 'clickAdd'; amount: number }               // additive ME/click
  | { type: 'clickMult'; factor: number }              // multiplicative manual ME
  | { type: 'autoAdd'; amount: number; res?: ResourceId }   // additive /s, res defaults to 'me'
  | { type: 'autoPct'; percent: number; res?: ResourceId }  // additive % pool, res defaults to 'me'
  | { type: 'rateMult'; factor: number; res: ResourceId | 'all' }  // multiplicative per-second
  | { type: 'convert'; amount: number; res: ResourceId }    // source = RESOURCES[res].source
  | { type: 'clickEcho'; seconds: number; res: ResourceId } // per click = seconds*lvl * perSecond[res]
  | { type: 'none' };
export type Requirement =
  | { type: 'tech'; id: TechId; minLevel: number }
  | { type: 'lifetime'; res: ResourceId; amount: number };   // replaces { type: 'lifetimeMe' }
// TechDefinition gains two REQUIRED fields (placed after `branch`): era: number; costRes: ResourceId
// GameState = { res: ResourceMap; lifetime: ResourceMap; totalClicks: number; techLevels: Record<TechId, number>; lastSimTime: number; createdAt: number }   // `me` and `lifetimeMe` are REMOVED
// ProductionRates = { perClick: ResourceMap; perSecond: ResourceMap }
// OfflineReport = { elapsedSeconds: number; cappedSeconds: number; gained: ResourceMap }
// Unchanged: TechId, TechKind, Branch, TechStatus, TechView, RequirementView, PurchaseFailure, PurchaseResult, SettingsState, SaveEnvelope, LoadStatus, LoadResult.

// ---- src/data/resources.ts (T1) ----
export const RESOURCES: Record<ResourceId, ResourceDefinition>;
//   me {name 'Mechanical Energy', short 'ME',  era 1, source null, convExp 1}
//   ee {name 'Electrical Energy', short 'EE',  era 2, source 'me', convExp 0.5}
//   pr {name 'Pressure',          short 'PR',  era 3, source 'ee', convExp 0.5}
//   rs {name 'Resonance',         short 'RS',  era 4, source 'pr', convExp 0.5}
//   xf {name 'Unknown Flux',      short '???', era 5, source 'rs', convExp 0.5}
export const RESOURCE_LIST: ResourceDefinition[];   // RESOURCE_IDS.map(id => RESOURCES[id])

// ---- src/data/balance.ts (T3, additive) ----
export const DESIGN_MAX_VALUE = 1e100;   // balance sims assert every value is finite and below this
export const META_MULT = 1;              // all-resource per-second multiplier; 1 until prestige (WP15)

// ---- src/simulation/resources.ts (T1) ----
export function emptyResourceMap(): ResourceMap;                                   // fresh object, all five keys 0
export function addMaps(a: Readonly<ResourceMap>, b: Readonly<ResourceMap>): ResourceMap;   // per key a+b, new object
export function scaleMap(m: Readonly<ResourceMap>, k: number): ResourceMap;        // per key (m*k)+0 (turns -0 into 0), new object

// ---- src/simulation/state.ts (T1) ----
export const DEFAULT_SETTINGS: SettingsState;                                       // unchanged { muted: false }
export function createInitialState(nowMs: number): GameState;   // res = emptyResourceMap(), lifetime = emptyResourceMap(), totalClicks 0, techLevels handCrank 1 / others 0, lastSimTime = createdAt = nowMs

// ---- src/simulation/production/rates.ts (T2a) ----
export function computeRates(
  state: Pick<GameState, 'techLevels'>,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
  resources: Record<ResourceId, ResourceDefinition> = RESOURCES,
): ProductionRates;
// Accumulate over TECH_IDS (level <= 0 skipped), per effect with L = level:
//   clickAdd: clickAdd += amount*L            clickMult: clickMult *= Math.pow(factor, L)
//   autoAdd:  autoAdd[res ?? 'me'] += amount*L   autoPct: autoPct[res ?? 'me'] += percent*L
//   rateMult: res === 'all' ? allMult *= Math.pow(factor, L) : resMult[res] *= Math.pow(factor, L)
//   convert:  convert[res] += amount*L        clickEcho: echo[res] += seconds*L        none: nothing
// Then, for r in RESOURCE_IDS order (me, ee, pr, rs, xf), d = resources[r]:
//   base = autoAdd[r]
//   if (d.source !== null && convert[r] !== 0) base += convert[r] * Math.pow(perSecond[d.source], d.convExp)
//   perSecond[r] = base * (1 + autoPct[r] / 100) * resMult[r] * allMult * META_MULT      // exactly this multiplication order
// perClick.me = clickAdd * clickMult;  for r !== 'me': perClick[r] = echo[r] * perSecond[r]   (clickMult does NOT apply to echo; a clickEcho with res 'me' is ignored)
// resMult / allMult start at 1, all other accumulators at 0. Returns fresh maps.

// ---- src/simulation/production/tick.ts (T2a) ----
export function applyClick(state: GameState, techs?: Record<TechId, TechDefinition>): { state: GameState; gained: number; gainedAll: ResourceMap };
//   rates = computeRates(state, techs); gainedAll = rates.perClick; gained = gainedAll.me
//   new state: res = addMaps(res, gainedAll), lifetime = addMaps(lifetime, gainedAll), totalClicks + 1
export function advance(state: GameState, seconds: number, techs?: Record<TechId, TechDefinition>): GameState;     // same reference for non-finite or <= 0 seconds; else res/lifetime += perSecond*seconds per resource (scaleMap + addMaps)
export function computeOffline(state: GameState, nowMs: number, capSeconds?: number /* OFFLINE_CAP_SECONDS */, techs?: Record<TechId, TechDefinition>): OfflineReport;   // gained = scaleMap(perSecond, capped)
export function applyOffline(state: GameState, nowMs: number, techs?: Record<TechId, TechDefinition>): { state: GameState; report: OfflineReport };  // credits report.gained to res AND lifetime, lastSimTime = nowMs
// elapsed rule unchanged: raw = (nowMs - lastSimTime)/1000; elapsed = finite && >= 0 ? raw : 0; capped = min(elapsed, cap)

// ---- src/simulation/economy/cost.ts (T2a) ----
export function costAt(def: TechDefinition, level: number): number;                    // UNCHANGED
export function canAfford(state: Pick<GameState, 'res'>, res: ResourceId, cost: number): boolean;   // state.res[res] >= cost

// ---- src/simulation/progression (T2b) ----
export function purchase(state: GameState, id: TechId, techs?: Record<TechId, TechDefinition>): PurchaseResult;
//   unchanged order of checks; afford check = canAfford(state, def.costRes, cost);
//   next = { ...state, res: { ...state.res, [def.costRes]: state.res[def.costRes] - cost }, techLevels: {...} }   // `lifetime` keeps the SAME reference
export function isRequirementMet(state: Pick<GameState, 'techLevels' | 'lifetime'>, req: Requirement): boolean;   // lifetime: state.lifetime[req.res] >= req.amount
export function requirementLabel(req: Requirement): string;     // lifetime -> `${formatNumber(amount)} lifetime ${RESOURCES[res].short}`  e.g. "200K lifetime ME"
export function getTechView(state: GameState, id: TechId, techs?: Record<TechId, TechDefinition>): TechView;   // affordable = status 'available' && nextCost !== null && canAfford(state, def.costRes, nextCost)
export function describeEffect(effect: Effect, n: number): string;   // exported from status.ts; texts below
//   clickAdd `+${fmt(amount*n)} ME/click` | clickMult `×${fmt(factor**n)} manual production`
//   autoAdd  `+${fmt(amount*n)} ${short}/s`  (short of res ?? 'me')
//   autoPct  res 'me' (or absent): `+${fmt(percent*n)}% automation`; other: `+${fmt(percent*n)}% ${short} production`
//   rateMult `×${fmt(factor**n)} ${res === 'all' ? 'all' : short} production`
//   convert  `Converts ${srcShort}/s into ${short}/s (×${fmt(amount*n)})`      clickEcho `Clicks echo ${fmt(seconds*n)}s of ${short}/s`      none 'Effect unknown'
//   fmt(x) = String(Number(x.toFixed(2)))   (existing helper, keep)
// evaluateMilestones: no signature change.

// ---- src/simulation/events.ts + GameSession (T2b) ----
// SessionEvents.click    = { gained: number /* ME */; gainedAll: ResourceMap }
// SessionEvents.purchase = { id: TechId; level: number; cost: number; res: ResourceId }    // res = TECHNOLOGIES[id].costRes
// all other events unchanged (offline: OfflineReport now carries ResourceMap gained)
export type ReadonlyGameState = Readonly<Omit<GameState, 'techLevels' | 'res' | 'lifetime'>> & {
  readonly techLevels: Readonly<Record<TechId, number>>; readonly res: Readonly<ResourceMap>; readonly lifetime: Readonly<ResourceMap> };
// GameSession public API otherwise unchanged. click(): number still returns ME gained. rates: Readonly<ProductionRates> (maps).
// src/simulation/index.ts additionally exports: emptyResourceMap, addMaps, scaleMap (from './resources').

// ---- src/data/systemLogs.ts (T1) ----
export type SystemLogTrigger = { kind: 'lifetime'; res: ResourceId; atLeast: number } | { kind: 'playSeconds'; atLeast: number };
// the four former { kind: 'lifetimeMe', atLeast: X } entries become { kind: 'lifetime', res: 'me', atLeast: X } (same ids/texts/thresholds)

// ---- src/utils/format.ts (T3) ----
export type RoundMode = 'floor' | 'ceil' | 'round';                       // existing
export type NumberNotation = 'suffix' | 'scientific' | 'engineering';
export const NUMBER_SUFFIXES: ReadonlyArray<{ value: number; suffix: string }>;   // K 1e3, M 1e6, B 1e9, T 1e12, Qa 1e15, Qi 1e18, Sx 1e21, Sp 1e24, Oc 1e27, No 1e30, Dc 1e33
export function formatNumber(n: number, mode?: RoundMode /* 'floor' */, notation?: NumberNotation /* 'suffix' */): string;
export function formatCost(n: number, notation?: NumberNotation): string;   // = formatNumber(n, 'ceil', notation)
export function formatRate(n: number, notation?: NumberNotation): string;   // = `${formatNumber(n, 'floor', notation)}/s`
export function formatDuration(seconds: number): string;                    // unchanged

// ---- src/persistence/schema.ts (T4a) ----
export const SAVE_VERSION = 2;
export function migrateV1ToV2(data: unknown): unknown;        // exported for tests
export const MIGRATIONS: Record<number, Migration>;           // { 1: migrateV1ToV2 }
// migrate()/validateEnvelope()/deserialize()/serialize() signatures UNCHANGED. SaveEnvelope.state is the new GameState shape.

// ---- src/ui/hudView.ts (T5a) ----
export interface HudResourceRow { id: ResourceId; label: string; value: string; perSecond: string; visible: boolean }
export interface HudView { me: string; perClick: string; perSecond: string; rows: HudResourceRow[] }   // rows = ee, pr, rs, xf in order (never 'me')
export function buildHudView(state: Pick<GameState, 'res' | 'lifetime'>, rates: Readonly<ProductionRates>): HudView;
// me = formatNumber(res.me); perClick = formatNumber(rates.perClick.me); perSecond = formatRate(rates.perSecond.me)
// row: label = RESOURCES[id].short; value = formatNumber(res[id]); perSecond = formatRate(rates.perSecond[id]); visible = lifetime[id] > 0 || rates.perSecond[id] > 0

// ---- src/ui/techTreeView.ts (T5a) ----
export function buildTechTreeView(views: readonly TechView[], res: Readonly<ResourceMap>, selected: TechId | null, layout?: typeof TECH_TREE_LAYOUT): TechTreeView;   // meText = formatNumber(res.me)
export function purchaseFailureText(reason: PurchaseFailure, shortfall: number, res?: ResourceId /* 'me' */): string;   // 'insufficient' -> `NEED ${n} MORE ${RESOURCES[res].short}`
// cost text = `${formatCost(nextCost)} ${RESOURCES[def.costRes].short}`; buy label for 'insufficient' = `INSUFFICIENT ${short}`; shortfall = nextCost - res[def.costRes]; era-I strings stay byte-identical.

// ---- src/ui/notificationRules.ts, src/ui/systemLogRules.ts (T5b) ----
export function welcomeBackMessage(r: OfflineReport): ToastMessage | null;
// null if no resource in RESOURCE_IDS order has gained[id] > 0, or elapsedSeconds < WELCOME_MIN_ELAPSED_SECONDS.
// body = `Unattended for ${formatDuration(elapsed)}. ${parts.join(', ')} accumulated.` with parts = `+${formatNumber(gained[id])} ${RESOURCES[id].short}` for each id with gained[id] > 0 (ME only -> identical text to before), then the existing ` Buffer capped at ${formatDuration(cappedSeconds)}.` when elapsed > capped.
// systemLogRules: LogState = { lifetime: Readonly<ResourceMap>; createdAt: number }; lifetime trigger met when s.lifetime[trigger.res] >= trigger.atLeast. seedTracker / nextSystemLog take that LogState (callers pass session.state).

// ---- src/simulation/sim/greedy.ts (T6) ----
export interface GreedyOptions { seconds: number; clicksPerSecond: number; stepSeconds: number; buyIntervalSeconds: number; initial?: GameState }
export interface GreedyResult { firstAt: Record<TechId, number>; maxValue: number; final: GameState }
export function runGreedy(o: GreedyOptions): GreedyResult;
```

---

# WAVE 1 (parallel: T1, T3 — disjoint files)

## T1 — Core types, resource table, tech/log data, resource helpers, initial state

**wave**: 1. **files_owned**: `src/data/types.ts`, `src/data/resources.ts` (new), `src/data/resources.test.ts` (new), `src/data/technologies.ts`, `src/data/technologies.test.ts`, `src/data/systemLogs.ts`, `src/simulation/resources.ts` (new), `src/simulation/resources.test.ts` (new), `src/simulation/state.ts`, `src/simulation/state.test.ts`

**objective**: Land the type/data foundation exactly as the FINAL CONTRACTS.

**context**: read the files first.
- `types.ts`: apply the contract block (`RESOURCE_IDS`, `ResourceId`, `ResourceMap`, `ResourceDefinition`, new `Effect`, new `Requirement`, `era`/`costRes` on `TechDefinition`, new `GameState`, `ProductionRates`, `OfflineReport`). Keep every other export untouched, keep `TECH_IDS`.
- `resources.ts`: `RESOURCES` and `RESOURCE_LIST` with the exact table in the contract (convExp of `me` = 1, unused).
- `technologies.ts`: add `era: 1, costRes: 'me',` right after `branch:` in ALL nine entries. Change ONLY `generatorBlueprint.requires[2]` to `{ type: 'lifetime', res: 'me', amount: 200000 }`. Every other value byte-identical.
- `systemLogs.ts`: change the `SystemLogTrigger` type and the four `lifetimeMe` entries as in the contract. No other change.
- `simulation/resources.ts`: the three helpers. Iterate `RESOURCE_IDS`; build into an object literal with all five keys. `scaleMap` computes `m[id] * k + 0`.
- `state.ts`: `createInitialState` per contract (use `emptyResourceMap()` for both maps; separate objects).
- Update `state.test.ts` and the `generatorBlueprint` expectation in `technologies.test.ts` (`{ type: 'lifetime', res: 'me', amount: 200000 }`).

**constraints**: pure; no Phaser/DOM; no `any`. Do not touch `balance.ts` (T3 owns it; `technologies.test.ts` imports old balance constants only, which stay).

**acceptance** (tests):
- `resources.test.ts`: `RESOURCE_IDS` is exactly `['me','ee','pr','rs','xf']`; `RESOURCE_LIST` has 5 entries in that order; `me.source === null`; sources form the chain me <- ee <- pr <- rs <- xf (`RESOURCES[RESOURCE_IDS[i]].source === RESOURCE_IDS[i-1]`); `era === index + 1`; `convExp` of every non-me resource is 0.5; shorts unique; `xf.short === '???'`; names/shorts match the contract table exactly.
- `technologies.test.ts`: all 9 techs have `era === 1` and `costRes === 'me'`; the table's kinds/baseCosts/growth/maxLevels are unchanged (existing table test stays green); generatorBlueprint requirement updated.
- `simulation/resources.test.ts`: `emptyResourceMap()` returns a fresh object each call with five `0` values; `addMaps`/`scaleMap` return new objects and never mutate inputs; `scaleMap(m, 0)` has no `-0` (use `Object.is(v, 0)` for a map with a negative entry); `scaleMap(m, 2)` doubles; `addMaps` adds per key.
- `state.test.ts`: `createInitialState(5)` has `res`/`lifetime` all zero, they are distinct objects, `techLevels.handCrank === 1`, others 0, `lastSimTime === createdAt === 5`; two calls return independent maps (mutating one does not affect the other).

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/data src/simulation/resources.test.ts src/simulation/state.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(data|simulation/(resources|state))" && echo FAIL || echo OK   # other files are expected to fail until later waves
grep -nE "from ['\"]phaser|\b(window|document)\b" src/data/types.ts src/data/resources.ts src/data/technologies.ts src/data/systemLogs.ts src/simulation/resources.ts src/simulation/state.ts && echo FAIL || echo OK
```

## T3 — Number formatting + balance constants

**wave**: 1. **files_owned**: `src/utils/format.ts`, `src/utils/format.test.ts`, `src/data/balance.ts`

**objective**: Suffixes through `Dc`, scientific fallback at >= 1e36, notation modes, two new constants.

**context**: read `format.ts` and `format.test.ts`. Keep the existing algorithm (rounding modes, decimals rule: scaled < 10 -> 2 decimals, < 100 -> 1, else 0; `trimZeros`; carry to the next suffix when rounding reaches 1000).
- `NUMBER_SUFFIXES`: 11 entries as in the contract. `EXPONENT_CEILING` becomes `'1.00e36'`; `formatMagnitude` switches to exponent form at `a >= 1e36` using `a.toExponential(2).replace('+', '')` (so `1.23e36`). A value that rounds up past `999.x Dc` (carry out of the last suffix) returns `EXPONENT_CEILING`.
- `NumberNotation` + third parameter `notation = 'suffix'` on `formatNumber`; `formatCost(n, notation?)`, `formatRate(n, notation?)` pass it through. Invalid input (`NaN`, ±Infinity) still returns `'0'`.
- Below 1000 every notation uses the existing path (e.g. `12.7`, `0.5`, `999.9`).
- `'scientific'` (>= 1000): mantissa with 2 decimals (rounded per `mode`; if it rounds to `10.00` bump the exponent and use `1.00`), always keep trailing zeros: `1500 -> '1.50e3'`, `1e6 -> '1.00e6'`, `123456 -> '1.23e5'` (floor). Get mantissa/exponent from `a.toExponential(9)` parsing to avoid `Math.log10` edge cases at exact powers of ten.
- `'engineering'` (>= 1000): exponent is the largest multiple of 3 <= the decimal exponent, mantissa in [1, 1000), decimals by the same rule as suffix (2/1/0) then `trimZeros`: `1500 -> '1.5e3'`, `123456 -> '123e3'`, `1e6 -> '1e6'`, `2.5e16 -> '25e15'`. Handle the carry (mantissa rounds to 1000 -> next multiple of 3, mantissa `1`).
- `balance.ts`: append `DESIGN_MAX_VALUE = 1e100` and `META_MULT = 1` with one-line comments; nothing else changes.
- `format.test.ts`: update the suffix-count test (11 entries, strictly ascending, names exactly as contract); replace the two exponent rows: `[1e15,'1Qa']`, `[2.5e16,'25Qa']`; add rows for `1e18 '1Qi'`, `1e21 '1Sx'`, `1e24 '1Sp'`, `1e27 '1Oc'`, `1e30 '1No'`, `1e33 '1Dc'`, `1.5e33 '1.5Dc'`, `1e36 '1.00e36'`, `1.234e36 '1.23e36'`, `1e100 '1.00e100'`; carry rows (`999999999999999` with ceil/round -> `1Qa`, `9.999e35` with round -> `1.00e36`); every old row below 1e15 stays; negatives; the notation rows listed above (both modes, plus `<1000` identical to suffix, plus `formatCost(1500,'engineering') === '1.5e3'`, `formatRate(1500,'scientific') === '1.50e3/s'`); default notation equals `'suffix'`.

**constraints**: pure; no `any`; no new exports beyond the contract (`NumberNotation` type, the two constants).

**acceptance**: all existing below-1e15 outputs byte-identical (existing it.each rows pass unmodified except the two 1e15+ rows); suffix boundaries correct; `formatNumber(Infinity) === '0'`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/utils/format.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(utils|data/balance)" && echo FAIL || echo OK
```

---

# WAVE 2 (parallel: T2a, T4a, T5b — disjoint files; wave 1 done)

## T2a — Rates, tick, cost on resource maps

**wave**: 2. **files_owned**: `src/simulation/production/rates.ts`, `src/simulation/production/rates.test.ts`, `src/simulation/production/tick.ts`, `src/simulation/production/tick.test.ts`, `src/simulation/economy/cost.ts`, `src/simulation/economy/cost.test.ts`

**objective**: Implement the exact `computeRates`, `applyClick`, `advance`, `computeOffline`, `applyOffline`, `canAfford` contracts.

**context**: read all six files first. Follow the contract formulas literally (multiplication order, `Math.pow`, the `convert[r] !== 0` guard, `META_MULT` from `../../data/balance`, `RESOURCES` from `../../data/resources`, helpers from `../resources`). `costAt` is untouched. Update the header comments to describe the new formula (the roadmap §1 conversion rule). `advance`/`computeOffline`/`applyOffline` use `scaleMap(perSecond, seconds)` then `addMaps` into BOTH `res` and `lifetime`. `advance` keeps returning the same reference for non-finite or `<= 0` seconds. `computeRates` takes `Pick<GameState,'techLevels'>`.

**constraints**: pure; no `any`; do not edit state.ts (T1). Era-I numbers must be float-identical (see preamble).

**acceptance** (tests; use injected tech tables built by spreading `TECHNOLOGIES` and overriding existing ids with the effect under test, e.g. `wornMotor`):
- Existing rates tests converted: era-I `perClick.me` / `perSecond.me` values identical (1, 4, 8, 6, 11, 15, 18, 1.1, 2, ...); `perSecond.ee/pr/rs/xf` and `perClick.ee/pr/rs/xf` all exactly 0 for era-I states.
- Every new effect: `autoAdd` with `res:'ee'` (ee += amount*L, me unaffected); `autoAdd` without `res` goes to `me`; `autoPct` with `res:'ee'` only scales ee; `rateMult` for one resource; `rateMult` `res:'all'`; `convert`: me autoAdd 4 + convert ee 0.5 => `perSecond.ee === 1` (0.5*sqrt(4)); with `rateMult ee ×2` => 2; with `autoPct ee 50` => 1.5; with `rateMult all ×4` and me autoAdd 4 => me 16, ee 8 (0.5*sqrt(16)*4); chain me autoAdd 16, convert ee 0.5 (=> ee 2), convert pr 1 => `pr === Math.sqrt(2)`; convert with zero source => 0; `clickEcho` ee 2 s with `perSecond.ee === 1` => `perClick.ee === 2`, `perClick.me` unaffected, clickMult not applied to echo, echo scales with level; echo on `me` is ignored; `none` ignored; level 0 techs ignored; custom `resources` table param honoured (e.g. a convExp of 1).
- `tick.test.ts`: `applyClick` on era-I state: `gained === gainedAll.me`, `res.me`/`lifetime.me` both += gained, `totalClicks + 1`, other resources unchanged; with an injected table that gives ee echo: `res.ee`/`lifetime.ee` increase by `gainedAll.ee`. `advance`: all resources and lifetimes grow by `perSecond*seconds` (injected table with ee), same reference for 0/negative/NaN; input never mutated. `computeOffline`/`applyOffline`: `gained` is a ResourceMap, every resource gains `perSecond[r]*capped`, cap honoured, backwards clock -> zero elapsed, `lastSimTime = nowMs`, lifetime credited, `lifetime` never decreases.
- `cost.test.ts`: `canAfford(state, 'me', cost)` equals old behaviour; `canAfford` on `'ee'` reads only `res.ee` (me rich, ee 0 -> false); `costAt` tests unchanged.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/production src/simulation/economy
npx tsc --noEmit 2>&1 | grep -E "^src/simulation/(production|economy)" && echo FAIL || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b|\bany\b" src/simulation/production/rates.ts src/simulation/production/tick.ts src/simulation/economy/cost.ts && echo FAIL || echo OK
```

## T4a — Save v2 schema, migration, fixture

**wave**: 2. **files_owned**: `src/persistence/schema.ts`, `src/persistence/persistence.test.ts`, `src/persistence/fixtures/v1-save.json` (new)

**objective**: `SAVE_VERSION = 2`, `MIGRATIONS[1]`, resource-map validation, v1 fixture test. `codec.ts`/`saveManager.ts` need no change (do not edit; if they fail typecheck report it).

**context**: read `schema.ts` and `persistence.test.ts` fully.
- `migrateV1ToV2(data)`: if `data` is a plain object whose `state` is a plain object: return `{ ...data, state: { ...rest, res: { me }, lifetime: { me: lifetimeMe } } }` where `rest` is the state without `me`/`lifetimeMe`, and a key is included only when the v1 value is not `undefined` (so a v1 save with `me: 50` and no `lifetimeMe` gives `res: { me: 50 }`, `lifetime: {}`). Values are copied untouched (even wrong types) so validation still rejects bad saves. If `state` is not an object, return `data` unchanged (validation fails later). Never throw. Do not mutate the input.
- `readState` v2: `readResourceMap(input, key, fallback)`: `undefined` -> defaults (res: all 0; lifetime: per key = `res[id]`); not a plain object -> `fail('"<key>" must be an object')`; per `RESOURCE_IDS` key: `undefined` -> default; present must be finite and `>= 0` else `fail('"<key>.<id>" must be a finite number >= 0')`. Unknown keys dropped. Final `lifetime[id] = Math.max(lifetime[id], res[id])`. `totalClicks` floor, `lastSimTime`, `createdAt`, `techLevels` logic unchanged. Remove old `me`/`lifetimeMe` reading.
- `migrate()` is generic and works as is with `SAVE_VERSION = 2` and `MIGRATIONS = { 1: migrateV1ToV2 }`. Update the comments.
- Fixture `src/persistence/fixtures/v1-save.json`, exactly:
```
{"version":1,"savedAt":1700000000000,"state":{"me":12345.5,"lifetimeMe":98765.25,"totalClicks":321,"techLevels":{"handCrank":1,"gearRatio":6,"reinforcedCrank":1,"flywheel":2,"wornMotor":1,"motorTuning":9,"pistonArray":0,"improvedPistons":0,"generatorBlueprint":0},"lastSimTime":1700000000000,"createdAt":1699990000000},"settings":{"muted":true}}
```
- Rewrite `persistence.test.ts` to the v2 shape: helper `raw(state, extra)` writes `version: 2`; state literals use `res: { me: ... }` / `lifetime: { me: ... }`; round-trip state built with `res`/`lifetime` maps (`emptyResourceMap()` from `../simulation/resources` spread with overrides). Keep ALL existing cases (bad inputs table, missing fields, unknown tech ids, clamps, SaveManager, FailingStorage, browserStorage, etc.) converted. Specific fixes: the injected-migration test must inject `{ 0: ..., 1: migrateV1ToV2 }` and assert `state.res.me === 5`; `migrate` "current version unchanged" uses version 2; "future version fails" uses version 3 (and `validateEnvelope({ version: 3 ...})`); built-in table test: `Object.keys(MIGRATIONS)` equals `['1']` and `SAVE_VERSION === 2`.

**constraints**: pure; no `any`; `import v1Save from './fixtures/v1-save.json'` is allowed (tsconfig has `resolveJsonModule`); feed `JSON.stringify(v1Save)` to `deserialize`.

**acceptance** (tests):
- v1 fixture: `deserialize(JSON.stringify(v1Save), 5)` -> `status === 'migrated'`, `state.res.me === 12345.5`, `state.lifetime.me === 98765.25`, `totalClicks === 321`, `techLevels` equal to the fixture's levels, `lastSimTime`/`createdAt` preserved, `settings.muted === true`, other resources all 0 for `res` and `lifetime`.
- `migrateV1ToV2`: moves me/lifetimeMe, leaves other state fields, does not mutate input, tolerates missing `state`, non-object `state`, missing `lifetimeMe`; after migration the result validates (`version` is set by `migrate()`).
- v2 round trip lossless (including non-zero `ee`/`rs` and `lifetime` > `res`); `deserialize(serialize(state, ...))` has status `'loaded'`.
- Missing `res` keys -> 0; missing `lifetime` -> equals `res`; `lifetime[id] < res[id]` raised to `res[id]`; negative `res.ee`, `res.me: 'ten'`, `res.me: null`, `lifetime.pr: Infinity` (`1e999` literal), `res: 5` (non-object) -> status `'recovered'`; unknown resource key dropped.
- v1 save with `me: -5` / `me: 'ten'` / `me: 1e999` still recovered (via migration then validation). A v1 save `{ state: { me: 50 } }` loads as `migrated` with `res.me === 50`, `lifetime.me === 50`.
- Corrupt-save backup path: SaveManager test still backs up raw text under `SAVE_BACKUP_KEY` for corrupt JSON and for a v1 save that fails validation after migration.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence/persistence.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/persistence/(schema|persistence.test|codec|saveManager)" && echo FAIL || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b|\bany\b" src/persistence/schema.ts && echo FAIL || echo OK
```

## T5b — Notification and system-log rules, animator/audio call sites, smoke scripts

**wave**: 2. **files_owned**: `src/ui/notificationRules.ts`, `src/ui/notificationRules.test.ts`, `src/ui/systemLogRules.ts`, `src/ui/systemLogRules.test.ts`, `src/game/entities/MachineAnimator.ts`, `src/audio/gameAudio.ts`, `scripts/smoke/wp2-crank.mjs`, `scripts/smoke/wp3-techtree.mjs`, `scripts/smoke/wp4-persistence.mjs`, `scripts/smoke/full-machine.mjs`, `scripts/smoke/stages.mjs`, `scripts/smoke/ftalpha.mjs`

**objective**: Adapt the leaf consumers to the new shapes. Behaviour for era I identical.

**context**:
- `notificationRules.ts` `welcomeBackMessage`: per the contract (resources listed in `RESOURCE_IDS` order, `short` from `RESOURCES` in `../data/resources`). `recoveredMessage`/`messageFor` unchanged (the `purchase` event only gained `res`). Update `notificationRules.test.ts`: its `report()` helper builds `gained` as a ResourceMap (`{ me, ee: 0, pr: 0, rs: 0, xf: 0 }`); all existing welcome-back expectations keep their exact strings (ME only). Add: multi-resource body `+1.5K ME, +20 EE accumulated.`; only-EE gain -> message exists with `+20 EE`; `xf` shows `???`; all-zero or NaN/negative -> null; non-finite gains ignored.
- `systemLogRules.ts`: `LogState` per contract, `triggerMet` uses `s.lifetime[trigger.res]`. Update the tests: states become `{ lifetime: { me: 1e9, ee: 0, pr: 0, rs: 0, xf: 0 }, createdAt }` via a local helper; the test that tracks "thresholds increase within a kind" groups by `kind === 'lifetime' ? \`lifetime:${trigger.res}\` : kind`; add a case asserting via `seedTracker` on the real table that a state with only `lifetime.ee` large (me 0) never marks a `me` entry as shown.
- `MachineAnimator.ts`: the three `this.session.rates.perSecond` reads (lines ~118, ~149, ~194) become `this.session.rates.perSecond.me`. The click listener (`gained`) is unchanged. Nothing else.
- `gameAudio.ts` line ~96: `session.rates.perSecond.me`.
- Smoke scripts (read each, change only what breaks): `wp4-persistence.mjs` `st()` uses `s.state.me` -> `s.state.res.me`, `s.rates.perSecond` -> `s.rates.perSecond.me`; grep the other listed scripts for `state.me`, `lifetimeMe`, `rates.perSecond`, `rates.perClick`, `.gained` and fix the same way (`full-machine.mjs` returns `rates: s.rates` as JSON: leave). Do not run them (no browser here).

**constraints**: pure rules files; no Phaser import in `src/ui/*Rules.ts`; do not import `../simulation` from non-test rules files; no `any`.

**acceptance**: rules tests green; `grep -n "perSecond" src/game/entities/MachineAnimator.ts src/audio/gameAudio.ts` shows only `.perSecond.me` reads (plus the audioMath parameter names); `grep -nE "state\.me\b|lifetimeMe" scripts/smoke/*.mjs` is empty.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui/notificationRules.test.ts src/ui/systemLogRules.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/(ui/(notificationRules|systemLogRules)|game/entities/MachineAnimator|audio/gameAudio)" && echo FAIL || echo OK
grep -nE "state\.me\b|lifetimeMe" scripts/smoke/*.mjs src/ui/*Rules.ts && echo FAIL || echo OK
grep -nE "from ['\"]phaser" src/ui/notificationRules.ts src/ui/systemLogRules.ts src/audio/gameAudio.ts && echo FAIL || echo OK
```

---

# WAVE 3 (single worker: T2b — waves 1 and 2 done)

## T2b — Progression, GameSession, events, barrel

**wave**: 3. **files_owned**: `src/simulation/progression/purchase.ts`, `src/simulation/progression/requirements.ts`, `src/simulation/progression/status.ts`, `src/simulation/progression/milestones.ts`, `src/simulation/progression/progression.test.ts`, `src/simulation/GameSession.ts`, `src/simulation/GameSession.test.ts`, `src/simulation/events.ts`, `src/simulation/index.ts`

**objective**: Wire purchase/requirements/status/session to resource maps exactly per the contracts. `milestones.ts` should need no code change (it only calls `requirementsMet`); touch it only if tsc demands.

**context**: read all nine files. Waves 1-2 are done: `computeRates`, `applyClick`, `advance`, `computeOffline`, `applyOffline`, `canAfford(state, res, cost)`, `createInitialState`, `RESOURCES` exist.
- `purchase.ts`: add `techs = TECHNOLOGIES` param, use `techs[id]`; afford via `canAfford(state, def.costRes, cost)`; deduct from `res[def.costRes]` only; `lifetime` reference unchanged. Check order unchanged.
- `requirements.ts`: `isRequirementMet(state: Pick<GameState,'techLevels'|'lifetime'>, req)`; `requirementsMet(state, def)` same Pick; `requirementLabel` lifetime branch `${formatNumber(req.amount)} lifetime ${RESOURCES[req.res].short}`; the tech branch uses the global `TECHNOLOGIES` as before.
- `status.ts`: `getTechStatus`/`getTechView` get optional `techs` param (default `TECHNOLOGIES`), `affordable` via `canAfford(state, def.costRes, nextCost)`; extract `describeEffect(effect, n)` (exported) replacing `effectPart`, texts exactly per contract; era-I effect strings byte-identical (`+1 ME/click`, `×2 manual production`, `+1 ME/s`, `+10% automation`, `Effect unknown`). `getAllTechViews(state)` unchanged signature.
- `events.ts`: `click` and `purchase` payloads per contract.
- `GameSession.ts`: `ReadonlyGameState` per contract; `click()`: `const { state, gained, gainedAll } = applyClick(this.current)` then emit `{ gained, gainedAll }`, return `gained`; `purchase()` emits `{ id, level, cost, res: TECHNOLOGIES[id].costRes }` (import `TECHNOLOGIES`); `applyOffline`, `update`, `reset` otherwise untouched; update class comment where it says ME.
- `index.ts`: also export `emptyResourceMap, addMaps, scaleMap` from `./resources`.
- Tests: convert `progression.test.ts` and `GameSession.test.ts` to the new state shape (`res`/`lifetime` maps; helper `withMe(state, n)` setting `res.me` and `lifetime.me`). Keep all existing cases.

**constraints**: pure; no `any`; GameSession API otherwise unchanged; no new events.

**acceptance** (tests):
- Every old purchase/requirement/status/session test passes after conversion with identical expectations (era-I costs, texts, event order, revision behaviour, offline report, reset).
- New: with an injected table where `wornMotor.costRes = 'ee'`: `purchase` deducts `res.ee` (not `res.me`), fails `insufficient` when `res.ee` is short even if `res.me` is huge, succeeds when `res.ee` suffices, and `lifetime` is the SAME object reference before/after; `getTechView(..., techs).affordable` follows `res.ee`. Purchase never decreases `lifetime` (era I, multiple buys).
- `isRequirementMet` with `{ type: 'lifetime', res: 'ee', amount: 100 }` reads `lifetime.ee` only; `requirementLabel({ type:'lifetime', res:'me', amount:200000 }) === '200K lifetime ME'` and the generatorBlueprint view's requirement label is `'200K lifetime ME'`; `res:'ee'` label ends `lifetime EE`; `xf` -> `???`.
- `describeEffect`: one assertion per effect type per contract text (incl. rateMult 'all', convert, clickEcho, non-me autoAdd/autoPct).
- `GameSession`: `click` event payload `gainedAll.me === gained`; `purchase` event has `res: 'me'`; offline via `applyOffline` gives `report.gained` ResourceMap with only `me > 0` for a motor save and credits `res`/`lifetime`; milestones still fire when `lifetime.me >= 200000` with pistonArray + flywheel; `reset` gives zero maps.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation --exclude src/simulation/balance.sim.test.ts
npx tsc --noEmit 2>&1 | grep -E "^src/simulation/" | grep -v balance.sim && echo FAIL || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b|\bany\b" src/simulation/GameSession.ts src/simulation/events.ts src/simulation/progression/purchase.ts src/simulation/progression/requirements.ts src/simulation/progression/status.ts src/simulation/progression/milestones.ts && echo FAIL || echo OK
```
(`balance.sim.test.ts` still imports the old per-file helpers and is rewritten in W4/T6; if it fails here that is expected.)

---

# WAVE 4 (parallel: T4b, T5a, T6 — disjoint files; waves 1-3 done)

## T4b — Startup and save controller on resource maps

**wave**: 4. **files_owned**: `src/persistence/startup.ts`, `src/persistence/saveController.ts`, `src/persistence/startup.test.ts`, `src/persistence/saveController.test.ts`

**objective**: Finish persistence call sites; prove the v1 -> v2 boot path end to end.

**context**: read all four files. `startup.ts` likely needs no code change (check; edit only comments if so). `saveController.ts`: `hasNonFiniteCounter` must test `lastSimTime`, `totalClicks` AND every value of `session.state.res` and `session.state.lifetime` (loop `RESOURCE_IDS` from `../data/types`). Update both tests: `state.me` -> `state.res.me`, `offline.gained` -> `offline.gained.me`, states built with `{ ...createInitialState(t0), res: {...}, lifetime: {...} }` (`emptyResourceMap` from `../simulation/resources`). Existing acceptance (WP4 T1 cases a-e, controller cases) stays.

**constraints**: pure; no `window`/`document`/Phaser; no `any`.

**acceptance** (tests, plus the old ones):
- v1 fixture boot: put `JSON.stringify(v1Save)` (`import v1Save from './fixtures/v1-save.json'`) into `MemoryStorage` at `SAVE_KEY`; `startSession(new SaveManager(storage), 1700000000000 + 1000)` -> `load.status === 'migrated'`, `session.state.res.me` is the fixture ME plus `offline.gained.me` (motor owned, so `perSecond * 1`, `toBeCloseTo`), `lifetime.me` likewise, levels/clicks identical; the stored JSON afterwards has `version === 2` and `state.res`; a second `startSession` on the same storage reports `status === 'loaded'` and no double award.
- Controller: a non-finite value in `res.ee` or `lifetime.xf` makes `saveNow()` false with nothing written (build the state with `NaN` in that field); existing counters check kept.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/persistence
npx tsc --noEmit 2>&1 | grep -E "^src/persistence" && echo FAIL || echo OK
grep -nE "from ['\"]phaser|\b(window|document)\b" src/persistence/startup.ts src/persistence/saveController.ts && echo FAIL || echo OK
```

## T5a — HUD and tech-tree view/DOM

**wave**: 4. **files_owned**: `src/ui/hudView.ts`, `src/ui/hudView.test.ts`, `src/ui/hud.ts`, `src/ui/techTreeView.ts`, `src/ui/techTreeView.test.ts`, `src/ui/techTree.ts`

**objective**: Resource-aware HUD view + tree text. Era-I output byte-identical; non-ME rows hidden while unused.

**context**: read all six files and `src/ui/hud.css` (do NOT edit CSS; `.hud-row` sets display, so hide rows with `row.style.display = 'none'` / `''`, not the `hidden` attribute).
- `hudView.ts`/`techTreeView.ts`: exactly the contracts. `techTreeView.ts` imports `RESOURCES` from `../data/resources`. `formatShortfall` unchanged; `detailOf(view, res)` uses `res[view.def.costRes]`.
- `hud.ts`: keep the existing ME rows and ids (`hud-me`, `hud-per-click`, `hud-per-second`), buttons and `destroy`. After the three ME rows create one `hud-row` per non-ME resource (ee, pr, rs, xf; labels from `RESOURCES[id].short`) using the existing `createRow(label, valueId, initial)`, value id `hud-res-<id>`, initial text `'0'`, display none initially. `render(view)`: ME rows as today; for each `view.rows` entry: set text to `row.value` (cached, only write on change), set `title` to `row.perSecond`, toggle display by `row.visible`. Row elements are removed by `panel.remove()` in `destroy`.
- `techTree.ts`: line ~284 `buildTechTreeView(session.getAllTechViews(), session.state.res, selected)`; line ~354 `purchaseFailureText(result.reason, Math.max(0, (before.nextCost ?? 0) - session.state.res[before.def.costRes]), before.def.costRes)`. Search the file for any other use of `state.me` or `'ME'` literals tied to cost/shortfall and adapt only those. Do not touch Esc/modal logic.
- Tests: `hudView.test.ts` uses `{ res: {...emptyResourceMap(), me: 1500}, lifetime: emptyResourceMap() }` and rates maps (`{ perClick: {...emptyResourceMap(), me: 1}, perSecond: {...} }`); keep every old expectation (`'1.5K'`, `'12.5/s'`, NaN -> `'0'`). `techTreeView.test.ts`: `stateWith` sets `res.me` via a helper; `buildTechTreeView(views, emptyResourceMap(), null)`; keep all old expectations.

**constraints**: no Phaser anywhere; `textContent`/`title`/`style.display` only (no innerHTML); `hudView.ts`/`techTreeView.ts` pure; `WorldScene.ts` is NOT edited (its call `buildHudView(session.state, session.rates)` must still compile).

**acceptance** (tests):
- `buildHudView` initial state: `me '0'`, `perClick '1'`, `perSecond '0/s'`, `rows` length 4 in ee,pr,rs,xf order, all `visible === false`, labels `EE`,`PR`,`RS`,`???`.
- row visible when `lifetime.ee > 0` alone, and when `perSecond.pr > 0` alone; value/perSecond text formats; era-I `me/perClick/perSecond` strings unchanged for all old inputs.
- Tree: era-I cost text (`'15 ME'` style) unchanged, `buyLabel` `'INSUFFICIENT ME'`, shortfall `NEED n MORE ME`; with views from `getTechView(state, 'wornMotor', techsWithEeCost)` (injected table with `costRes: 'ee'`): cost text ends `EE`, label `INSUFFICIENT EE`, shortfall `NEED n MORE EE` computed from `res.ee`; `purchaseFailureText('insufficient', 5, 'ee') === 'NEED 5 MORE EE'`, default res gives `... MORE ME`; `meText` shows `res.me`.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/ui
npx tsc --noEmit 2>&1 | grep -E "^src/(ui|game/scenes)" && echo FAIL || echo OK
grep -nE "from ['\"]phaser|innerHTML" src/ui/hud.ts src/ui/hudView.ts src/ui/techTree.ts src/ui/techTreeView.ts && echo FAIL || echo OK
```

## T6 — Greedy harness + balance sim

**wave**: 4. **files_owned**: `src/simulation/sim/greedy.ts` (new), `src/simulation/balance.sim.test.ts`

**objective**: Move the greedy simulation into a pure reusable `runGreedy` and prove era I is unchanged to the second.

**context**: read the old `balance.sim.test.ts` (its `runGreedy` + `pickCheapest`) and the contract. Algorithm, exactly:
```
state = o.initial ?? createInitialState(0); firstAt[id] = Infinity for all TECH_IDS; record(0)
steps = Math.floor(o.seconds / o.stepSeconds); clickDebt = 0; maxValue = 0
for k = 1..steps:
  t = k * o.stepSeconds
  clickDebt += o.clicksPerSecond * o.stepSeconds; n = Math.floor(clickDebt + 1e-9); clickDebt -= n
  repeat n: state = applyClick(state).state
  state = advance(state, o.stepSeconds)
  state = evaluateMilestones(state).state
  if t is a multiple of o.buyIntervalSeconds (|t / interval - Math.round(t / interval)| < 1e-9):
    for res of RESOURCE_IDS (me, ee, pr, rs, xf order):
      views = getAllTechViews(state)                       // recompute per resource: earlier buys change state
      pick = cheapest view with status 'available', nextCost !== null, def.kind !== 'milestone', def.costRes === res
             (ties: TECH_IDS order, strict '<')
      if (pick !== null && pick.affordable) { r = purchase(state, pick.id); if (r.ok) state = r.state }
  record(t)     // firstAt[id] = t the first time techLevels[id] >= 1
  maxValue = max(maxValue, every state.res[r], state.lifetime[r], rates.perSecond[r], rates.perClick[r]); if any is not finite set maxValue = Infinity
return { firstAt, maxValue, final: state }
```
Imports directly from `../production/tick`, `../production/rates`, `../progression/status`, `../progression/purchase`, `../progression/milestones`, `../state`, `../../data/types`. No clock, no randomness, no console, no timers.
- Rewrite `balance.sim.test.ts`: `const result = runGreedy({ seconds: 3600, clicksPerSecond: 4, stepSeconds: 1, buyIntervalSeconds: 1 })` in `beforeAll`, keep the `console.table` + `formatMmSs`; keep the four old range tests; ADD exact-time tests: `wornMotor === 13` (0:13), `reinforcedCrank === 196` (3:16), `pistonArray === 722` (12:02), `generatorBlueprint === 1326` (22:06); also exact: gearRatio 4, flywheel 289, motorTuning 20, improvedPistons 758. Add: `maxValue` finite and `< DESIGN_MAX_VALUE` (import from `../data/balance`); determinism (two runs deep-equal `firstAt`); `buyIntervalSeconds: 30` yields every `firstAt` >= the interval-1 value; `initial` honoured (start from a state with `wornMotor` owned -> `firstAt.wornMotor === 0`); a 10-s run returns `final.totalClicks === 40`; the whole file runs in < 10 s.

**constraints**: harness is pure (no `vitest`, no DOM); do not edit any other file; if the era-I times differ from the numbers above STOP and report the measured table (do not edit the expected numbers).

**acceptance**: the exact times above; harness reusable (WP9+ will call it with era II data); `maxValue` assertion present.

**validation**
```
cd /home/user/WhatExatlyDoesThisMachineDo
npx vitest run src/simulation/balance.sim.test.ts --silent=false 2>&1 | grep -E "mm:ss|handCrank|gearRatio|reinforced|flywheel|wornMotor|motorTuning|pistonArray|improved|generator|passed|failed"
npx tsc --noEmit 2>&1 | grep -E "^src/simulation/(sim|balance)" && echo FAIL || echo OK
grep -nE "from ['\"](phaser|vitest)['\"]|\b(window|document)\b|console\." src/simulation/sim/greedy.ts && echo FAIL || echo OK
```

---

# WAVE 5 — EM Mode B

Run: `npm run typecheck`, `npm test` (baseline 602; tests were rewritten and extended so expect >= 602 + new, no file losing cases), `npm run build`. Then:
```
npx vitest run src/simulation/balance.sim.test.ts --silent=false      # era-I times 0:13 / 3:16 / 12:02 / 22:06, unchanged
grep -rn "from 'phaser'" src/simulation src/data src/persistence src/utils            # must be empty
grep -rnE "lifetimeMe|state\.me\b" src scripts --include=*.ts --include=*.mjs         # must be empty (no stale single-ME API)
grep -rn "perSecond\b" src/game src/audio | grep -v "\.me"                            # review: no unmapped rates use
git diff --stat HEAD -- public src/assets docs/GAME_SPEC.md                           # must be empty
```
Checks: `SAVE_VERSION === 2` and `MIGRATIONS` has only key 1; v1 fixture loads `migrated` with identical ME/levels/clicks; HUD rows for ee/pr/rs/xf hidden at era I; `requirementLabel` of generatorBlueprint is `200K lifetime ME`; era-I tech table values byte-identical except `era`/`costRes`/lifetime requirement; every new effect type has a rates unit test; no `console.log` added; test-case counts per rewritten test file not lower than before (compare `git diff` of `it(`/`it.each` titles). Allowed glue: one-line integration fixes only (state it).

## Director smoke test additions (after the build)

1. `npm run build && npx vite preview --port 4173 --strictPort &` then, per `scripts/smoke/README.md`: `wp2-crank.mjs`, `wp3-techtree.mjs`, `wp4-persistence.mjs`, `full-machine.mjs`, `stages.mjs` -> each `errors` empty, 0 console errors; HUD ME rows and tech-tree texts identical to before.
2. Manual v1 migration: in a fresh page set `localStorage['wedtmd.save']` to the contents of `src/persistence/fixtures/v1-save.json`, reload -> `__wedtmd.session.state.res.me` is about 12345.5 (plus a little offline accrual), `state.lifetime.me` about 98765.25, techs and machine parts as in the fixture, muted true, welcome-back toast lists `ME`; wait for autosave (<= 15 s) or call `__wedtmd.saveNow()` -> stored JSON has `"version":2` and `state.res`; reload again -> loads without migration.
3. Greedy regression: play (or debug fast-forward) through to `generatorBlueprint` -> milestone toast fires; no console errors; tech cost texts end with `ME`.

---

# Risks

- **Era-I float drift**: any reordering of era-I arithmetic changes the greedy times (13/196/722/1326 s). Mitigation: contract fixes multiplication order, preamble forbids "simplifying", T6 asserts the exact seconds, T6 must STOP instead of editing numbers.
- **Harness buy policy**: "cheapest affordable" (roadmap wording) differs from the old "cheapest available, buy if affordable". Contract uses the latter per resource; a worker "fixing" it breaks times.
- **Transient red tree**: waves 1-3 leave the repo non-compiling by design (table above). Do not let a worker "fix" foreign files; Director gate = own-wave tests + allowed-errors table.
- **T2b is the single critical-path worker** (9 files). If it stalls, the Director may split progression vs session at the cost of one extra wave; do not parallelise either half with T2a (runtime dependence).
- **persistence.test.ts rewrite** (T4a) is wide: guard is the "keep ALL existing cases" rule; EM Mode B compares case counts.
- **Format change at 1e15..1e36** alters any UI string above 1e15 (none exist in era I); rounding carry cases at suffix boundaries and the scientific/engineering carry are the likeliest bugs: explicit test rows required.
- **HUD hidden rows** use inline `display:none` because `.hud-row` sets display; if CSS later adds `!important`, WP8 revisits.
- **Smoke scripts** cannot be run by workers (no browser); only the Director/EM run them (wave 5).
- `META_MULT` is applied inside `computeRates`; WP15 must replace it with a state-derived multiplier (needs a new `computeRates` argument): note for the next planner.
