import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { GameState, ResourceId, ResourceMap, TechDefinition, TechId, TechStatus } from '../../data/types';
import type { EraNumber } from '../../data/eras';
import { canAfford, costAt } from '../economy/cost';
import { applyClick, advance, applyOffline } from '../production/tick';
import { computeRates } from '../production/rates';
import { getTechStatus } from '../progression/status';
import { purchase } from '../progression/purchase';
import { currentEra } from '../progression/era';
import { evaluateMilestones } from '../progression/milestones';
import type { EraCap } from '../progression/edition';
import { createInitialState } from '../state';
import { emptyResourceMap } from '../resources';

// Reusable deterministic greedy-player harness for balance simulations. Pure: no clock, no
// randomness, no console, no timers. Policy: per resource, buy the cheapest available
// non-milestone tech whose costRes is that resource (ties: TECH_IDS order), only if affordable.

/**
 * Repeating play blocks (profile D). Active block: clicks, buys, production. Offline block (after each
 * full active block, never after the last one): no clicks, no buys, automation credited once through
 * the existing applyOffline path (capped by offlineCapSeconds). offlineSeconds 0 = no offline blocks.
 */
export interface GreedySchedule {
  activeSeconds: number;
  offlineSeconds: number;
}

/** One era's income in one run: `manual` = click gains, `passive` = automation (auto-cranks incl.) + offline credit. */
export interface IncomeSplit {
  manual: ResourceMap;
  passive: ResourceMap;
}

export interface GreedyOptions {
  /** Active-seconds budget (with `schedule`, offline blocks do not count towards it). */
  seconds: number;
  clicksPerSecond: number;
  stepSeconds: number;
  buyIntervalSeconds: number;
  initial?: GameState;
  techs?: Record<TechId, TechDefinition>;
  /** Stop after the step that first owns this tech (default: run the full `seconds`). */
  stopAt?: TechId;
  /** Record the state right after the step each listed tech is first owned (t = 0 counts). */
  snapshotAt?: readonly TechId[];
  /** Optional active/offline block schedule. Absent = continuous active play (no offline). */
  schedule?: GreedySchedule;
  /** Demo edition era cap: techs above it are never bought, milestones above it never unlock. Absent = full game. */
  maxEra?: EraCap;
  /**
   * Clicks per second for the step ending at t, read from the state at the start of that step (before its clicks).
   * Overrides clicksPerSecond. A result that is not finite or is < 0 throws RangeError.
   */
  clickRate?: (state: Readonly<GameState>, t: number) => number;
  /** Split income into manual (clicks) and passive (automation + offline) per era. Bookkeeping only: the run is unchanged. */
  trackIncome?: boolean;
}

export interface GreedyResult {
  /** Active seconds (offline time does not advance it). */
  firstAt: Record<TechId, number>;
  maxValue: number;
  final: GameState;
  /** Purchase times in active seconds. */
  purchases: Array<{ t: number; id: TechId }>;
  /** Present only when `snapshotAt` was given. Ids never owned have no key. */
  snapshots?: Partial<Record<TechId, GameState>>;
  /** Wall-clock seconds simulated (active + offline). Present only when `schedule` is set. */
  wallSeconds?: number;
  /** Present only when `trackIncome` is true. All five eras exist; era = currentEra at the start of each step. */
  income?: Record<EraNumber, IncomeSplit>;
}

/** One purchase with its price and the level it brought the tech to. */
export interface LedgerEntry {
  t: number;
  id: TechId;
  res: ResourceId;
  /** Level after the buy. */
  level: number;
  cost: number;
}

/** What the picker needs per tech (status, next price); the same values getTechView reports, without text. */
interface Candidate {
  id: TechId;
  def: TechDefinition;
  status: TechStatus;
  nextCost: number | null;
}

/** Price of the next purchase, or null when there is nothing left to buy. Mirrors nextCostFor in progression/status.ts. */
function nextCostOf(state: GameState, id: TechId, techs: Record<TechId, TechDefinition>): number | null {
  const def = techs[id];
  const level = state.techLevels[id];
  if (def.kind === 'starting' || def.kind === 'milestone') return null;
  if (def.kind === 'unlock') return level >= 1 ? null : costAt(def, level);
  if (def.maxLevel !== null && level >= def.maxLevel) return null;
  return costAt(def, level);
}

/** Candidates in TECH_IDS order. Built per buy tick (cheap: no effect or requirement text). */
function candidates(state: GameState, techs: Record<TechId, TechDefinition>, maxEra: EraCap): Candidate[] {
  return TECH_IDS.map((id) => ({
    id,
    def: techs[id],
    status: getTechStatus(state, id, techs, maxEra),
    nextCost: nextCostOf(state, id, techs),
  }));
}

/** Cheapest available, purchasable-next, non-milestone candidate paying in `res`; null when none. */
function pickCheapest(list: readonly Candidate[], res: ResourceId): Candidate | null {
  let pick: Candidate | null = null;
  for (const c of list) {
    if (c.status !== 'available' || c.nextCost === null || c.def.kind === 'milestone') continue;
    if (c.def.costRes !== res) continue;
    if (pick === null || pick.nextCost === null || c.nextCost < pick.nextCost) pick = c;
  }
  return pick;
}

/** All five eras with zero income, so a tracked run always has every era key (also the never-visited ones). */
function emptyIncome(): Record<EraNumber, IncomeSplit> {
  const split = (): IncomeSplit => ({ manual: emptyResourceMap(), passive: emptyResourceMap() });
  return { 1: split(), 2: split(), 3: split(), 4: split(), 5: split() };
}

/** Adds `delta` into `into` in place. Only bookkeeping maps owned by one run are passed here, never game state. */
function addInto(into: ResourceMap, delta: Readonly<ResourceMap>): void {
  for (const id of RESOURCE_IDS) into[id] += delta[id];
}

/** Adds the per-resource change `after - before` into `into` in place (same ownership rule as addInto). */
function addDelta(into: ResourceMap, before: Readonly<ResourceMap>, after: Readonly<ResourceMap>): void {
  for (const id of RESOURCE_IDS) into[id] += after[id] - before[id];
}

export function runGreedy(o: GreedyOptions): GreedyResult {
  const techs = o.techs ?? TECHNOLOGIES;
  const maxEra = o.maxEra ?? null;
  let state: GameState = o.initial ?? createInitialState(0);
  const firstAt = {} as Record<TechId, number>;
  for (const id of TECH_IDS) firstAt[id] = Infinity;
  const purchases: Array<{ t: number; id: TechId }> = [];
  const snapshotIds = o.snapshotAt;
  const snapshots: Partial<Record<TechId, GameState>> = {};

  const record = (t: number): void => {
    for (const id of TECH_IDS) {
      if (firstAt[id] === Infinity && state.techLevels[id] >= 1) firstAt[id] = t;
    }
    if (snapshotIds === undefined) return;
    for (const id of snapshotIds) {
      if (snapshots[id] === undefined && state.techLevels[id] >= 1) snapshots[id] = structuredClone(state);
    }
  };
  record(0);

  const schedule = o.schedule;
  if (schedule !== undefined) {
    const { activeSeconds, offlineSeconds } = schedule;
    const blocks = activeSeconds / o.stepSeconds;
    if (
      !Number.isFinite(activeSeconds) ||
      activeSeconds <= 0 ||
      !Number.isFinite(offlineSeconds) ||
      offlineSeconds < 0 ||
      Math.abs(blocks - Math.round(blocks)) > 1e-9
    ) {
      throw new RangeError('runGreedy: schedule needs finite activeSeconds > 0 (multiple of stepSeconds) and offlineSeconds >= 0');
    }
  }

  const steps = Math.floor(o.seconds / o.stepSeconds);
  const incomeByEra = o.trackIncome === true ? emptyIncome() : undefined;
  let clickDebt = 0;
  let maxValue = 0;
  let activeT = 0;
  let offlineTotal = 0;
  const track = (value: number): void => {
    if (!Number.isFinite(value)) maxValue = Infinity;
    else if (value > maxValue) maxValue = value;
  };
  const observe = (): void => {
    const rates = computeRates(state, techs);
    for (const r of RESOURCE_IDS) {
      track(state.res[r]);
      track(state.lifetime[r]);
      track(rates.perSecond[r]);
      track(rates.perClick[r]);
    }
  };

  for (let k = 1; k <= steps; k++) {
    const t = k * o.stepSeconds;
    activeT = t;
    // Era at the start of the step (before its clicks, advance and buys): the income bookkeeping key.
    const era = currentEra(state.techLevels);

    // WHY: the rate is read before this step's clicks, so a rule reacts to what was bought in earlier steps.
    const rate = o.clickRate !== undefined ? o.clickRate(state, t) : o.clicksPerSecond;
    if (o.clickRate !== undefined && (!Number.isFinite(rate) || rate < 0)) {
      throw new RangeError(`runGreedy: clickRate must be finite and >= 0 (got ${rate} at t = ${t})`);
    }
    clickDebt += rate * o.stepSeconds;
    const clicks = Math.floor(clickDebt + 1e-9);
    clickDebt -= clicks;
    for (let i = 0; i < clicks; i++) {
      const click = applyClick(state, techs);
      state = click.state;
      if (incomeByEra !== undefined) addInto(incomeByEra[era].manual, click.gainedAll);
    }

    const lifeBeforeAdvance = state.lifetime;
    state = advance(state, o.stepSeconds, techs);
    if (incomeByEra !== undefined) addDelta(incomeByEra[era].passive, lifeBeforeAdvance, state.lifetime);
    state = evaluateMilestones(state, techs, maxEra).state;

    const ratio = t / o.buyIntervalSeconds;
    if (Math.abs(ratio - Math.round(ratio)) < 1e-9) {
      // candidates are rebuilt only after a successful purchase: identical picks, far fewer rebuilds
      let list = candidates(state, techs, maxEra);
      for (const res of RESOURCE_IDS) {
        const pick = pickCheapest(list, res);
        if (pick !== null && pick.nextCost !== null && canAfford(state, pick.def.costRes, pick.nextCost)) {
          const result = purchase(state, pick.id, techs, maxEra);
          if (result.ok) {
            state = result.state;
            purchases.push({ t, id: pick.id });
            list = candidates(state, techs, maxEra);
          }
        }
      }
    }
    record(t);
    observe();
    if (o.stopAt !== undefined && state.techLevels[o.stopAt] >= 1) break;

    // Offline block after a full active block (not after the last step of the budget).
    if (schedule !== undefined && schedule.offlineSeconds > 0 && k < steps) {
      const ratio = t / schedule.activeSeconds;
      if (Math.abs(ratio - Math.round(ratio)) < 1e-9) {
        const lifeBeforeOffline = state.lifetime;
        // WHY: era taken just before the credit, so buys made earlier in this step already count.
        const offlineEra = currentEra(state.techLevels);
        const offline = applyOffline({ ...state, lastSimTime: 0 }, schedule.offlineSeconds * 1000, techs);
        state = { ...offline.state, lastSimTime: state.lastSimTime };
        if (incomeByEra !== undefined) addDelta(incomeByEra[offlineEra].passive, lifeBeforeOffline, state.lifetime);
        offlineTotal += schedule.offlineSeconds;
        state = evaluateMilestones(state, techs, maxEra).state;
        record(t);
        observe();
      }
    }
  }

  const result: GreedyResult = {
    firstAt,
    maxValue,
    final: state,
    purchases,
    ...(snapshotIds === undefined ? {} : { snapshots }),
  };
  if (schedule !== undefined) result.wallSeconds = activeT + offlineTotal;
  if (incomeByEra !== undefined) result.income = incomeByEra;
  return result;
}

/**
 * Longest interval inside [fromT, toT] with no purchase. Buys outside the range are ignored,
 * buys exactly on the ends split nothing. fromT > toT -> 0; non-finite bounds -> Infinity.
 */
export function maxPurchaseGap(
  purchases: GreedyResult['purchases'],
  fromT: number,
  toT: number,
): number {
  if (!Number.isFinite(fromT) || !Number.isFinite(toT)) return Infinity;
  if (fromT > toT) return 0;
  const times = purchases
    .map((p) => p.t)
    .filter((t) => t >= fromT && t <= toT)
    .sort((a, b) => a - b);
  const points = [fromT, ...times, toT];
  let gap = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1] ?? fromT;
    const next = points[i] ?? toT;
    gap = Math.max(gap, next - prev);
  }
  return gap;
}

/**
 * Prices each purchase in order: cost = costAt(def, levelBefore), res = def.costRes,
 * level = levelBefore + 1. `initialLevels` is copied, never mutated.
 */
export function purchaseLedger(
  purchases: GreedyResult['purchases'],
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
  initialLevels: Readonly<Record<TechId, number>> = createInitialState(0).techLevels,
): LedgerEntry[] {
  const levels: Record<TechId, number> = { ...initialLevels };
  const ledger: LedgerEntry[] = [];
  for (const p of purchases) {
    const def = techs[p.id];
    const levelBefore = levels[p.id];
    const level = levelBefore + 1;
    levels[p.id] = level;
    ledger.push({ t: p.t, id: p.id, res: def.costRes, level, cost: costAt(def, levelBefore) });
  }
  return ledger;
}

/**
 * Seconds from the last buy of `res` at or before endT up to endT, in minutes. No such buy ->
 * the whole span [0, endT]. Buys after endT are ignored; a buy exactly at endT gives 0.
 */
export function deadMinutes(ledger: readonly LedgerEntry[], res: ResourceId, endT: number): number {
  let lastT: number | null = null;
  for (const entry of ledger) {
    if (entry.res !== res || entry.t > endT) continue;
    if (lastT === null || entry.t > lastT) lastT = entry.t;
  }
  return (endT - (lastT ?? 0)) / 60;
}

/**
 * Share of produced `res` spent on purchases in the window (fromT, toT] (left exclusive, right
 * inclusive). Produced = lifetimeTo - lifetimeFrom; produced <= 0 or non-finite -> 0.
 */
export function spendShare(
  ledger: readonly LedgerEntry[],
  res: ResourceId,
  fromT: number,
  toT: number,
  lifetimeFrom: number,
  lifetimeTo: number,
): number {
  const produced = lifetimeTo - lifetimeFrom;
  if (!Number.isFinite(produced) || produced <= 0) return 0;
  let spent = 0;
  for (const entry of ledger) {
    if (entry.res === res && entry.t > fromT && entry.t <= toT) spent += entry.cost;
  }
  return spent / produced;
}

/**
 * Share of `res` income that came from manual clicks in `era`: manual / (manual + passive). 0 when the era has no
 * income entry, or the total is 0 or not finite.
 */
export function manualShare(income: Record<EraNumber, IncomeSplit>, era: EraNumber, res: ResourceId): number {
  const split: IncomeSplit | undefined = income[era];
  if (split === undefined) return 0;
  const manual = split.manual[res];
  const total = manual + split.passive[res];
  if (!Number.isFinite(total) || total === 0) return 0;
  return manual / total;
}
