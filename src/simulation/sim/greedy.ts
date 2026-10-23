import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { GameState, ResourceId, TechDefinition, TechId, TechView } from '../../data/types';
import { applyClick, advance } from '../production/tick';
import { computeRates } from '../production/rates';
import { getAllTechViews } from '../progression/status';
import { purchase } from '../progression/purchase';
import { evaluateMilestones } from '../progression/milestones';
import { createInitialState } from '../state';
import { costAt } from '../economy/cost';

// Reusable deterministic greedy-player harness for balance simulations. Pure: no clock, no
// randomness, no console, no timers. Policy: per resource, buy the cheapest available
// non-milestone tech whose costRes is that resource (ties: TECH_IDS order), only if affordable.

export interface GreedyOptions {
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
}

export interface GreedyResult {
  firstAt: Record<TechId, number>;
  maxValue: number;
  final: GameState;
  purchases: Array<{ t: number; id: TechId }>;
  /** Present only when `snapshotAt` was given. Ids never owned have no key. */
  snapshots?: Partial<Record<TechId, GameState>>;
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

/** Cheapest available, purchasable-next, non-milestone view paying in `res`; null when none. */
function pickCheapest(views: readonly TechView[], res: ResourceId): TechView | null {
  let pick: TechView | null = null;
  for (const view of views) {
    if (view.status !== 'available' || view.nextCost === null || view.def.kind === 'milestone') continue;
    if (view.def.costRes !== res) continue;
    if (pick === null || pick.nextCost === null || view.nextCost < pick.nextCost) pick = view;
  }
  return pick;
}

export function runGreedy(o: GreedyOptions): GreedyResult {
  const techs = o.techs ?? TECHNOLOGIES;
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

  const steps = Math.floor(o.seconds / o.stepSeconds);
  let clickDebt = 0;
  let maxValue = 0;
  const track = (value: number): void => {
    if (!Number.isFinite(value)) maxValue = Infinity;
    else if (value > maxValue) maxValue = value;
  };

  for (let k = 1; k <= steps; k++) {
    const t = k * o.stepSeconds;

    clickDebt += o.clicksPerSecond * o.stepSeconds;
    const clicks = Math.floor(clickDebt + 1e-9);
    clickDebt -= clicks;
    for (let i = 0; i < clicks; i++) state = applyClick(state, techs).state;

    state = advance(state, o.stepSeconds, techs);
    state = evaluateMilestones(state, techs).state;

    const ratio = t / o.buyIntervalSeconds;
    if (Math.abs(ratio - Math.round(ratio)) < 1e-9) {
      // views are rebuilt only after a successful purchase: identical picks, far fewer rebuilds
      let views = getAllTechViews(state, techs);
      for (const res of RESOURCE_IDS) {
        const pick = pickCheapest(views, res);
        if (pick !== null && pick.affordable) {
          const result = purchase(state, pick.id, techs);
          if (result.ok) {
            state = result.state;
            purchases.push({ t, id: pick.id });
            views = getAllTechViews(state, techs);
          }
        }
      }
    }
    record(t);

    const rates = computeRates(state, techs);
    for (const r of RESOURCE_IDS) {
      track(state.res[r]);
      track(state.lifetime[r]);
      track(rates.perSecond[r]);
      track(rates.perClick[r]);
    }
    if (o.stopAt !== undefined && state.techLevels[o.stopAt] >= 1) break;
  }

  return {
    firstAt,
    maxValue,
    final: state,
    purchases,
    ...(snapshotIds === undefined ? {} : { snapshots }),
  };
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
