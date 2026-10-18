import { beforeAll, describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { GameState, ResourceId, TechDefinition, TechId, TechView } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { runGreedy, maxPurchaseGap } from './greedy';
import type { GreedyOptions, GreedyResult } from './greedy';
import { applyClick, advance, offlineCapSeconds } from '../production/tick';
import { computeRates } from '../production/rates';
import { getAllTechViews } from '../progression/status';
import { purchase } from '../progression/purchase';
import { evaluateMilestones } from '../progression/milestones';
import { createInitialState } from '../state';

const CLICKS_PER_SECOND = 4;

function options(seconds: number) {
  return { seconds, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds: 1 };
}

// Test-local copy of the pre-optimisation harness: the views are recomputed for every resource.
function referencePickCheapest(views: readonly TechView[], res: ResourceId): TechView | null {
  let pick: TechView | null = null;
  for (const view of views) {
    if (view.status !== 'available' || view.nextCost === null || view.def.kind === 'milestone') continue;
    if (view.def.costRes !== res) continue;
    if (pick === null || pick.nextCost === null || view.nextCost < pick.nextCost) pick = view;
  }
  return pick;
}

function referenceRun(o: GreedyOptions): GreedyResult {
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
      for (const res of RESOURCE_IDS) {
        const pick = referencePickCheapest(getAllTechViews(state, techs), res);
        if (pick !== null && pick.affordable) {
          const result = purchase(state, pick.id, techs);
          if (result.ok) {
            state = result.state;
            purchases.push({ t, id: pick.id });
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
  }

  return { firstAt, maxValue, final: state, purchases };
}

// Era-I table, with the generatorBlueprint lifetime requirement lowered from 200K ME to 20K ME.
const cheapBlueprint: Record<TechId, TechDefinition> = {
  ...TECHNOLOGIES,
  generatorBlueprint: {
    ...TECHNOLOGIES.generatorBlueprint,
    requires: TECHNOLOGIES.generatorBlueprint.requires.map((req) =>
      req.type === 'lifetime' ? { ...req, amount: 20000 } : req,
    ),
  },
};

describe('runGreedy', () => {
  let defaultRun: GreedyResult;
  let cheapRun: GreedyResult;

  beforeAll(() => {
    defaultRun = runGreedy(options(2000));
    cheapRun = runGreedy({ ...options(2000), techs: cheapBlueprint });
  });

  it('keeps the era-I wornMotor time on the default table (600 s run)', () => {
    const run = runGreedy(options(600));
    expect(run.firstAt.wornMotor).toBe(13);
  });

  it('a cheaper blueprint table reaches generatorBlueprint sooner than the default table', () => {
    expect(cheapRun.firstAt.generatorBlueprint).toBeLessThan(defaultRun.firstAt.generatorBlueprint);
  });

  it('purchases are time-ordered, within the run, and never contain a milestone', () => {
    const { purchases } = defaultRun;
    expect(purchases.length).toBeGreaterThan(0);
    for (let i = 0; i < purchases.length; i++) {
      const p = purchases[i];
      if (p === undefined) throw new Error('missing purchase');
      expect(p.t).toBeGreaterThan(0);
      expect(p.t).toBeLessThanOrEqual(2000);
      expect(TECHNOLOGIES[p.id].kind).not.toBe('milestone');
      if (i > 0) expect(p.t).toBeGreaterThanOrEqual(purchases[i - 1]?.t ?? 0);
    }
  });

  it('purchase counts match final tech levels for non-starting, non-milestone techs', () => {
    const { purchases, final } = defaultRun;
    for (const id of TECH_IDS) {
      const def = TECHNOLOGIES[id];
      if (def.kind === 'starting' || def.kind === 'milestone') continue;
      expect(purchases.filter((p) => p.id === id).length).toBe(final.techLevels[id]);
    }
  });

  it('the optimised harness matches the per-resource reference run (same picks, same order)', () => {
    const opts = options(1500);
    const fast = runGreedy(opts);
    const reference = referenceRun(opts);
    expect(fast.firstAt).toEqual(reference.firstAt);
    expect(fast.purchases).toEqual(reference.purchases);
    expect(fast.maxValue).toEqual(reference.maxValue);
  });

  it('stopAt ends the run on the step that first owns the tech, matching the full run up to there', () => {
    const full = runGreedy(options(1500));
    const stopped = runGreedy({ ...options(1500), stopAt: 'gearRatio' });
    expect(stopped.firstAt.gearRatio).toBe(4);
    expect(stopped.firstAt.wornMotor).toBe(Infinity);
    expect(stopped.final.totalClicks).toBe(16);
    expect(stopped.purchases).toEqual(full.purchases.filter((p) => p.t <= 4));
  });

  it('era I exact first-purchase times hold on the optimised harness', () => {
    const run = runGreedy(options(1500));
    expect(run.firstAt.gearRatio).toBe(4);
    expect(run.firstAt.wornMotor).toBe(13);
    expect(run.firstAt.motorTuning).toBe(20);
    expect(run.firstAt.reinforcedCrank).toBe(196);
    expect(run.firstAt.flywheel).toBe(289);
    expect(run.firstAt.pistonArray).toBe(722);
    expect(run.firstAt.improvedPistons).toBe(758);
    expect(run.firstAt.generatorBlueprint).toBe(1326);
  });
});

describe('maxPurchaseGap', () => {
  it('no buys -> the whole window', () => {
    expect(maxPurchaseGap([], 0, 10)).toBe(10);
  });

  it('one buy in the middle splits the window', () => {
    expect(maxPurchaseGap([{ t: 4, id: 'gearRatio' }], 0, 10)).toBe(6);
  });

  it('buys outside the window are ignored', () => {
    expect(maxPurchaseGap([{ t: -5, id: 'gearRatio' }, { t: 20, id: 'gearRatio' }], 0, 10)).toBe(10);
  });

  it('buys exactly at the ends count as points', () => {
    const buys = [
      { t: 0, id: 'gearRatio' as const },
      { t: 4, id: 'gearRatio' as const },
      { t: 10, id: 'gearRatio' as const },
    ];
    expect(maxPurchaseGap(buys, 0, 10)).toBe(6);
    expect(maxPurchaseGap([{ t: 0, id: 'gearRatio' }, { t: 10, id: 'gearRatio' }], 0, 10)).toBe(10);
  });

  it('fromT greater than toT -> 0', () => {
    expect(maxPurchaseGap([], 10, 0)).toBe(0);
  });

  it('toT = Infinity -> Infinity', () => {
    expect(maxPurchaseGap([{ t: 4, id: 'gearRatio' }], 0, Infinity)).toBe(Infinity);
  });
});

// Automation-only play for schedule tests: no clicks, and buyIntervalSeconds 1e6 keeps the buy tick
// off every step of the short runs below (ratio t / 1e6 never rounds to an exact tick for t < 5e5).
const QUIET = { clicksPerSecond: 0, stepSeconds: 1, buyIntervalSeconds: 1e6 };

describe('runGreedy schedule (profile D offline blocks)', () => {
  const base = createInitialState(0);
  const automated = { ...base, techLevels: { ...base.techLevels, wornMotor: 1 } };

  it('absent schedule: the result has no wallSeconds key', () => {
    const run = runGreedy(options(300));
    expect('wallSeconds' in run).toBe(false);
  });

  it('schedule with 0 offline seconds is identical to the continuous run (wallSeconds = active seconds)', () => {
    const continuous = runGreedy(options(1500));
    const scheduled = runGreedy({ ...options(1500), schedule: { activeSeconds: 300, offlineSeconds: 0 } });
    expect(scheduled.firstAt).toEqual(continuous.firstAt);
    expect(scheduled.purchases).toEqual(continuous.purchases);
    expect(scheduled.maxValue).toEqual(continuous.maxValue);
    expect(scheduled.final).toEqual(continuous.final);
    expect(scheduled.wallSeconds).toBe(1500);
  });

  it('an offline block grants exactly the capped gain (8 h cap binds for 10 h away)', () => {
    const r = computeRates(automated).perSecond.me;
    expect(r).toBeGreaterThan(0);
    expect(offlineCapSeconds(automated.techLevels)).toBe(28800);
    const continuous = runGreedy({ ...QUIET, seconds: 200, initial: automated });
    const away = runGreedy({
      ...QUIET,
      seconds: 200,
      initial: automated,
      schedule: { activeSeconds: 100, offlineSeconds: 36000 },
    });
    expect(away.final.res.me - continuous.final.res.me).toBeCloseTo(r * 28800, 9);
    expect(away.wallSeconds).toBe(36200);
  });

  it('an offline block shorter than the cap grants its full elapsed gain', () => {
    const r = computeRates(automated).perSecond.me;
    const continuous = runGreedy({ ...QUIET, seconds: 200, initial: automated });
    const away = runGreedy({
      ...QUIET,
      seconds: 200,
      initial: automated,
      schedule: { activeSeconds: 100, offlineSeconds: 1000 },
    });
    expect(away.final.res.me - continuous.final.res.me).toBeCloseTo(r * 1000, 9);
    expect(away.wallSeconds).toBe(1200);
  });

  it('Relief Valves raise the offline cap to 12 h', () => {
    const vented = { ...automated, techLevels: { ...automated.techLevels, reliefValves: 1 } };
    const r = computeRates(vented).perSecond.me;
    expect(offlineCapSeconds(vented.techLevels)).toBe(43200);
    const continuous = runGreedy({ ...QUIET, seconds: 200, initial: vented });
    const away = runGreedy({
      ...QUIET,
      seconds: 200,
      initial: vented,
      schedule: { activeSeconds: 100, offlineSeconds: 50000 },
    });
    expect(away.final.res.me - continuous.final.res.me).toBeCloseTo(r * 43200, 9);
  });

  it('no offline block after the last active block', () => {
    const continuous = runGreedy({ ...QUIET, seconds: 100, initial: automated });
    const away = runGreedy({
      ...QUIET,
      seconds: 100,
      initial: automated,
      schedule: { activeSeconds: 100, offlineSeconds: 36000 },
    });
    expect(away.final).toEqual(continuous.final);
    expect(away.wallSeconds).toBe(100);
  });

  it('offline blocks add no clicks', () => {
    const continuous = runGreedy({ ...options(20), buyIntervalSeconds: 1e6 });
    const away = runGreedy({
      ...options(20),
      buyIntervalSeconds: 1e6,
      schedule: { activeSeconds: 10, offlineSeconds: 1000 },
    });
    expect(away.final.totalClicks).toBe(continuous.final.totalClicks);
    expect(away.final.totalClicks).toBe(80);
  });

  it('rejects an active block that is not a whole number of steps', () => {
    expect(() =>
      runGreedy({ ...options(20), stepSeconds: 2, schedule: { activeSeconds: 5, offlineSeconds: 10 } }),
    ).toThrow(RangeError);
  });
});
