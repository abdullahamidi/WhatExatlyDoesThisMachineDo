import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { GameState, ResourceId, TechId, TechView } from '../../data/types';
import { applyClick, advance } from '../production/tick';
import { computeRates } from '../production/rates';
import { getAllTechViews } from '../progression/status';
import { purchase } from '../progression/purchase';
import { evaluateMilestones } from '../progression/milestones';
import { createInitialState } from '../state';

// Reusable deterministic greedy-player harness for balance simulations. Pure: no clock, no
// randomness, no console, no timers. Policy: per resource, buy the cheapest available
// non-milestone tech whose costRes is that resource (ties: TECH_IDS order), only if affordable.

export interface GreedyOptions {
  seconds: number;
  clicksPerSecond: number;
  stepSeconds: number;
  buyIntervalSeconds: number;
  initial?: GameState;
}

export interface GreedyResult {
  firstAt: Record<TechId, number>;
  maxValue: number;
  final: GameState;
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
  let state: GameState = o.initial ?? createInitialState(0);
  const firstAt = {} as Record<TechId, number>;
  for (const id of TECH_IDS) firstAt[id] = Infinity;

  const record = (t: number): void => {
    for (const id of TECH_IDS) {
      if (firstAt[id] === Infinity && state.techLevels[id] >= 1) firstAt[id] = t;
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
    for (let i = 0; i < clicks; i++) state = applyClick(state).state;

    state = advance(state, o.stepSeconds);
    state = evaluateMilestones(state).state;

    const ratio = t / o.buyIntervalSeconds;
    if (Math.abs(ratio - Math.round(ratio)) < 1e-9) {
      for (const res of RESOURCE_IDS) {
        const pick = pickCheapest(getAllTechViews(state), res);
        if (pick !== null && pick.affordable) {
          const result = purchase(state, pick.id);
          if (result.ok) state = result.state;
        }
      }
    }
    record(t);

    const rates = computeRates(state);
    for (const r of RESOURCE_IDS) {
      track(state.res[r]);
      track(state.lifetime[r]);
      track(rates.perSecond[r]);
      track(rates.perClick[r]);
    }
  }

  return { firstAt, maxValue, final: state };
}
