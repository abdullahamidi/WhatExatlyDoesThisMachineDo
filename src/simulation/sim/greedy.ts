import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { GameState, ResourceId, TechDefinition, TechId, TechStatus } from '../../data/types';
import { canAfford, costAt } from '../economy/cost';
import { applyClick, advance, applyOffline } from '../production/tick';
import { computeRates } from '../production/rates';
import { getTechStatus } from '../progression/status';
import { purchase } from '../progression/purchase';
import { evaluateMilestones } from '../progression/milestones';
import { createInitialState } from '../state';

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
  /** Optional active/offline block schedule. Absent = continuous active play (no offline). */
  schedule?: GreedySchedule;
}

export interface GreedyResult {
  /** Active seconds (offline time does not advance it). */
  firstAt: Record<TechId, number>;
  maxValue: number;
  final: GameState;
  /** Purchase times in active seconds. */
  purchases: Array<{ t: number; id: TechId }>;
  /** Wall-clock seconds simulated (active + offline). Present only when `schedule` is set. */
  wallSeconds?: number;
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
function candidates(state: GameState, techs: Record<TechId, TechDefinition>): Candidate[] {
  return TECH_IDS.map((id) => ({
    id,
    def: techs[id],
    status: getTechStatus(state, id, techs),
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

export function runGreedy(o: GreedyOptions): GreedyResult {
  const techs = o.techs ?? TECHNOLOGIES;
  let state: GameState = o.initial ?? createInitialState(0);
  const firstAt = {} as Record<TechId, number>;
  for (const id of TECH_IDS) firstAt[id] = Infinity;
  const purchases: Array<{ t: number; id: TechId }> = [];

  const record = (t: number): void => {
    for (const id of TECH_IDS) {
      if (firstAt[id] === Infinity && state.techLevels[id] >= 1) firstAt[id] = t;
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

    clickDebt += o.clicksPerSecond * o.stepSeconds;
    const clicks = Math.floor(clickDebt + 1e-9);
    clickDebt -= clicks;
    for (let i = 0; i < clicks; i++) state = applyClick(state, techs).state;

    state = advance(state, o.stepSeconds, techs);
    state = evaluateMilestones(state, techs).state;

    const ratio = t / o.buyIntervalSeconds;
    if (Math.abs(ratio - Math.round(ratio)) < 1e-9) {
      // candidates are rebuilt only after a successful purchase: identical picks, far fewer rebuilds
      let list = candidates(state, techs);
      for (const res of RESOURCE_IDS) {
        const pick = pickCheapest(list, res);
        if (pick !== null && pick.nextCost !== null && canAfford(state, pick.def.costRes, pick.nextCost)) {
          const result = purchase(state, pick.id, techs);
          if (result.ok) {
            state = result.state;
            purchases.push({ t, id: pick.id });
            list = candidates(state, techs);
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
        const offline = applyOffline({ ...state, lastSimTime: 0 }, schedule.offlineSeconds * 1000, techs);
        state = { ...offline.state, lastSimTime: state.lastSimTime };
        offlineTotal += schedule.offlineSeconds;
        state = evaluateMilestones(state, techs).state;
        record(t);
        observe();
      }
    }
  }

  const result: GreedyResult = { firstAt, maxValue, final: state, purchases };
  if (schedule !== undefined) result.wallSeconds = activeT + offlineTotal;
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
