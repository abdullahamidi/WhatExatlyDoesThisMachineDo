import { beforeAll, describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { GameState, ResourceId, TechDefinition, TechId, TechView } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { runGreedy, maxPurchaseGap, purchaseLedger, deadMinutes, spendShare, manualShare } from './greedy';
import type { GreedyOptions, GreedyResult, IncomeSplit, LedgerEntry } from './greedy';
import { applyClick, advance, offlineCapSeconds } from '../production/tick';
import { computeRates } from '../production/rates';
import { getAllTechViews } from '../progression/status';
import { purchase } from '../progression/purchase';
import { evaluateMilestones } from '../progression/milestones';
import { createInitialState } from '../state';
import { costAt } from '../economy/cost';
import { emptyResourceMap } from '../resources';
import type { EraNumber } from '../../data/eras';

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
    expect(run.firstAt.wornMotor).toBe(18);
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
    expect(run.firstAt.wornMotor).toBe(18);
    expect(run.firstAt.motorTuning).toBe(23);
    expect(run.firstAt.reinforcedCrank).toBe(205);
    expect(run.firstAt.flywheel).toBe(297);
    expect(run.firstAt.pistonArray).toBe(730);
    expect(run.firstAt.improvedPistons).toBe(761);
    expect(run.firstAt.generatorBlueprint).toBe(1327);
  });
});

// WP21 demo cap: the greedy player never buys above era II, and era-II progress is unaffected.
describe('runGreedy demo era cap (WP21)', () => {
  let capped: GreedyResult;
  let full: GreedyResult;

  beforeAll(() => {
    capped = runGreedy({ ...options(5400), maxEra: 2 });
    full = runGreedy(options(5400));
  });

  it('owns and buys no tech above the era cap', () => {
    for (const id of TECH_IDS) {
      if (TECHNOLOGIES[id].era > 2) expect(capped.final.techLevels[id]).toBe(0);
    }
    for (const p of capped.purchases) expect(TECHNOLOGIES[p.id].era).toBeLessThanOrEqual(2);
  });

  it('Substation Blueprint is owned at the same time with and without the cap', () => {
    expect(Number.isFinite(capped.firstAt.substationBlueprint)).toBe(true);
    expect(Number.isFinite(full.firstAt.substationBlueprint)).toBe(true);
    expect(capped.firstAt.substationBlueprint).toBe(full.firstAt.substationBlueprint);
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

function buy(t: number, res: ResourceId, cost = 10): LedgerEntry {
  return { t, id: 'gearRatio', res, level: 1, cost };
}

describe('measurement helpers (WP17)', () => {
  it('snapshotAt leaves firstAt, purchases, maxValue and final identical to the plain run', () => {
    const plain = runGreedy(options(1500));
    const withSnaps = runGreedy({ ...options(1500), snapshotAt: ['gearRatio', 'wornMotor'] });
    expect(withSnaps.firstAt).toEqual(plain.firstAt);
    expect(withSnaps.purchases).toEqual(plain.purchases);
    expect(withSnaps.maxValue).toEqual(plain.maxValue);
    expect(withSnaps.final).toEqual(plain.final);
    expect('snapshots' in plain).toBe(false);
    expect('snapshots' in withSnaps).toBe(true);
  });

  it('snapshot is the state right after the step the tech is first owned, and is a separate object', () => {
    const run = runGreedy({ ...options(1500), snapshotAt: ['gearRatio'] });
    const snap = run.snapshots?.gearRatio;
    expect(snap).toBeDefined();
    expect(snap?.totalClicks).toBe(16);
    expect(snap?.techLevels.gearRatio).toBe(1);
    expect(snap).not.toBe(run.final);
  });

  it('a tech owned at t = 0 (handCrank) is snapshotted before any step', () => {
    const run = runGreedy({ ...options(100), snapshotAt: ['handCrank'] });
    expect(run.snapshots?.handCrank?.totalClicks).toBe(0);
    expect(run.snapshots?.handCrank?.techLevels.handCrank).toBe(1);
  });

  it('an id never owned in the run has no snapshot key', () => {
    const run = runGreedy({ ...options(100), snapshotAt: ['primaryFunction'] });
    expect(run.snapshots).toBeDefined();
    expect('primaryFunction' in (run.snapshots ?? {})).toBe(false);
  });

  it('purchaseLedger prices the 1500 s run with the era-I first buys', () => {
    const run = runGreedy(options(1500));
    const ledger = purchaseLedger(run.purchases);
    expect(ledger.length).toBe(run.purchases.length);
    expect(ledger[0]).toEqual({ t: 4, id: 'gearRatio', res: 'me', level: 1, cost: 15 });
    expect(ledger.find((e) => e.id === 'wornMotor')).toEqual({
      t: 18,
      id: 'wornMotor',
      res: TECHNOLOGIES.wornMotor.costRes,
      level: 1,
      cost: 40,
    });
  });

  it('every ledger cost equals costAt(def, levelBefore) and levels step by one per buy', () => {
    const run = runGreedy(options(1500));
    const ledger = purchaseLedger(run.purchases);
    const levels = { ...createInitialState(0).techLevels };
    for (const entry of ledger) {
      const def = TECHNOLOGIES[entry.id];
      const levelBefore = levels[entry.id];
      expect(entry.level).toBe(levelBefore + 1);
      expect(entry.cost).toBe(costAt(def, levelBefore));
      expect(entry.res).toBe(def.costRes);
      levels[entry.id] = entry.level;
    }
  });

  it('ledger spend in ME equals produced ME (lifetime - remaining) on the 1500 s run', () => {
    const run = runGreedy(options(1500));
    const ledger = purchaseLedger(run.purchases);
    const spent = ledger.filter((e) => e.res === 'me').reduce((sum, e) => sum + e.cost, 0);
    const produced = run.final.lifetime.me - run.final.res.me;
    expect(produced).toBeGreaterThan(0);
    expect(Math.abs(spent - produced) / produced).toBeLessThan(1e-9);
  });

  it('the last ledger level of every bought tech equals its final level', () => {
    const run = runGreedy(options(1500));
    const ledger = purchaseLedger(run.purchases);
    for (const id of TECH_IDS) {
      const own = ledger.filter((e) => e.id === id);
      if (own.length === 0) continue;
      expect(own[own.length - 1]?.level).toBe(run.final.techLevels[id]);
    }
  });

  it('deadMinutes: last buy of the resource up to endT, in minutes', () => {
    const ledger = [buy(100, 'ee'), buy(400, 'me')];
    expect(deadMinutes(ledger, 'ee', 400)).toBe(5);
  });

  it('deadMinutes: no buy of the resource -> whole span endT / 60', () => {
    const ledger = [buy(100, 'ee'), buy(400, 'me')];
    expect(deadMinutes(ledger, 'pr', 600)).toBe(10);
  });

  it('deadMinutes: entries after endT are ignored', () => {
    const ledger = [buy(100, 'ee'), buy(500, 'ee')];
    expect(deadMinutes(ledger, 'ee', 400)).toBe(5);
  });

  it('deadMinutes: a buy exactly at endT gives 0', () => {
    expect(deadMinutes([buy(400, 'me')], 'me', 400)).toBe(0);
  });

  it('spendShare: left bound exclusive, right bound inclusive, other resources ignored', () => {
    const ledger = [buy(10, 'me', 5), buy(20, 'me', 7), buy(30, 'ee', 100), buy(40, 'me', 3)];
    // (10, 40] for ME: t = 20 (7) and t = 40 (3); t = 10 and the EE buy are excluded.
    expect(spendShare(ledger, 'me', 10, 40, 0, 100)).toBeCloseTo(0.1, 9);
    expect(spendShare(ledger, 'me', 9, 10, 0, 100)).toBeCloseTo(0.05, 9);
    expect(spendShare(ledger, 'me', 10, 10, 0, 100)).toBe(0);
  });

  it('spendShare: zero or negative produced -> 0', () => {
    const ledger = [buy(20, 'me', 7)];
    expect(spendShare(ledger, 'me', 0, 100, 50, 50)).toBe(0);
    expect(spendShare(ledger, 'me', 0, 100, 50, 10)).toBe(0);
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

// WP25 (T2): click-rate overrides and the manual / passive income split. Profile A = 4 cps, buy every 1 s.
describe('runGreedy clickRate and income tracking (WP25)', () => {
  const ERAS: readonly EraNumber[] = [1, 2, 3, 4, 5];

  // Every resource: sum over eras of (manual + passive) equals the final lifetime (rel 1e-9; abs 1e-9 at 0).
  function expectConserved(run: GreedyResult): void {
    const income = run.income;
    if (income === undefined) throw new Error('expected income');
    for (const res of RESOURCE_IDS) {
      const sum = ERAS.reduce((acc, era) => acc + income[era].manual[res] + income[era].passive[res], 0);
      const expected = run.final.lifetime[res];
      if (expected === 0) expect(Math.abs(sum)).toBeLessThanOrEqual(1e-9);
      else expect(Math.abs(sum - expected) / Math.abs(expected)).toBeLessThanOrEqual(1e-9);
    }
  }

  it('a constant clickRate of 4 equals clicksPerSecond 4 (600 s)', () => {
    const plain = runGreedy(options(600));
    const constant = runGreedy({ ...options(600), clickRate: () => 4 });
    expect(constant.firstAt).toEqual(plain.firstAt);
    expect(constant.purchases).toEqual(plain.purchases);
  });

  it('a switch at Worn Motor changes only later clicks', () => {
    const plain = runGreedy(options(100));
    const w = plain.firstAt.wornMotor;
    if (!Number.isFinite(w)) throw new Error('expected Worn Motor within 100 s');
    const switched = runGreedy({
      ...options(100),
      clickRate: (state) => (state.techLevels.wornMotor >= 1 ? 0.5 : 4),
    });
    expect(switched.firstAt.handCrank).toBe(plain.firstAt.handCrank);
    expect(switched.firstAt.gearRatio).toBe(plain.firstAt.gearRatio);
    expect(switched.firstAt.wornMotor).toBe(w);
    expect(switched.purchases.filter((p) => p.t <= w)).toEqual(plain.purchases.filter((p) => p.t <= w));
    // Steps 1..w click at 4/s; the later steps click at 0.5/s from zero debt, so one click every second step.
    expect(switched.final.totalClicks).toBe(4 * w + Math.floor((100 - w) / 2));
  });

  // WP25 (P1 Generator rule): the rate is read at the start of each step, before its clicks and buys. The buy that
  // owns the Generator happens after step tGen's clicks, so step tGen still clicks at 4/s and step tGen + 1 reads the
  // owned Generator. No one-step adjustment is needed: steps 1..tGen give 4 x tGen clicks, and steps tGen + 1..T click at
  // 0.5/s from zero debt, one click every second step, floor((T - tGen) / 2) clicks.
  it('a Generator switch changes only the clicks after the Generator is owned (2000 s)', () => {
    const plain = runGreedy(options(2000));
    const tGen = plain.firstAt.generator;
    if (!Number.isFinite(tGen)) throw new Error('expected the Generator within 2000 s');
    const switched = runGreedy({
      ...options(2000),
      clickRate: (state) => (state.techLevels.generator >= 1 ? 0.5 : 4),
    });
    expect(switched.firstAt.generator).toBe(tGen);
    expect(switched.purchases.filter((p) => p.t <= tGen)).toEqual(plain.purchases.filter((p) => p.t <= tGen));
    expect(switched.final.totalClicks).toBe(4 * tGen + Math.floor((2000 - tGen) / 2));
  });

  it('0.5 cps is one click per 2 s', () => {
    const clicksIn = (seconds: number): number =>
      runGreedy({ ...options(seconds), clickRate: () => 0.5 }).final.totalClicks;
    expect(clicksIn(10)).toBe(5);
    expect(clicksIn(11)).toBe(5);
    expect(clicksIn(12)).toBe(6);
  });

  it('a clickRate that is NaN, negative or infinite throws RangeError', () => {
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(() => runGreedy({ ...options(5), clickRate: () => bad })).toThrow(RangeError);
      expect(() => runGreedy({ ...options(5), clickRate: () => bad })).toThrow(/^runGreedy: clickRate/);
    }
  });

  it('a clickRate of 0 is valid and gives no clicks', () => {
    expect(runGreedy({ ...options(5), clickRate: () => 0 }).final.totalClicks).toBe(0);
  });

  it('state-based switch (P1e rule): each step reads motorTuning at its start, so the change lands the step after the buy', () => {
    const calls: Array<{ t: number; level: number; rate: number }> = [];
    const run = runGreedy({
      ...options(600),
      clickRate: (state, t) => {
        const level = state.techLevels.motorTuning;
        const rate = level >= 5 ? 0.5 : 4;
        calls.push({ t, level, rate });
        return rate;
      },
    });
    const fifth = run.purchases.filter((p) => p.id === 'motorTuning')[4];
    if (fifth === undefined) throw new Error('expected a 5th motorTuning purchase within 600 s');
    const p = fifth.t;
    expect(calls.length).toBe(600);
    for (const c of calls) {
      if (c.t <= p) {
        expect(c.level).toBeLessThan(5);
        expect(c.rate).toBe(4);
      } else {
        expect(c.level).toBeGreaterThanOrEqual(5);
        expect(c.rate).toBe(0.5);
      }
    }
    const next = calls.find((c) => c.t === p + 1);
    if (next === undefined) throw new Error('expected a call at p + 1');
    expect(next.level).toBeGreaterThanOrEqual(5);
    expect(next.rate).toBe(0.5);
  });

  it('trackIncome leaves firstAt, purchases and final identical (600 s)', () => {
    const plain = runGreedy(options(600));
    const tracked = runGreedy({ ...options(600), trackIncome: true });
    expect(tracked.firstAt).toEqual(plain.firstAt);
    expect(tracked.purchases).toEqual(plain.purchases);
    expect(tracked.final).toEqual(plain.final);
  });

  it('conservation: profile A (2000 s) income sums to the final lifetime per resource', () => {
    const run = runGreedy({ ...options(2000), trackIncome: true });
    expect(run.final.lifetime.ee).toBeGreaterThan(0);
    expectConserved(run);
  });

  it('conservation holds with an offline schedule (100 s active / 3600 s offline, 600 s)', () => {
    const run = runGreedy({
      ...options(600),
      trackIncome: true,
      schedule: { activeSeconds: 100, offlineSeconds: 3600 },
    });
    expectConserved(run);
  });

  it('income is absent without trackIncome; with it all five eras exist; era-I manual ME share is in (0, 1)', () => {
    expect(runGreedy(options(600)).income).toBeUndefined();
    expect('income' in runGreedy(options(600))).toBe(false);
    const income = runGreedy({ ...options(2000), trackIncome: true }).income;
    if (income === undefined) throw new Error('expected income');
    expect(Object.keys(income).sort()).toEqual(['1', '2', '3', '4', '5']);
    const share = manualShare(income, 1, 'me');
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });

  it('manualShare: manual / (manual + passive) for the era and resource; 0 for an empty or non-finite total', () => {
    const split = (manual: number, passive: number): IncomeSplit => ({
      manual: { ...emptyResourceMap(), me: manual },
      passive: { ...emptyResourceMap(), me: passive },
    });
    const income: Record<EraNumber, IncomeSplit> = {
      1: split(25, 75),
      2: split(0, 0),
      3: split(Number.POSITIVE_INFINITY, 1),
      4: split(0, 0),
      5: split(0, 0),
    };
    expect(manualShare(income, 1, 'me')).toBe(0.25);
    expect(manualShare(income, 2, 'me')).toBe(0);
    expect(manualShare(income, 1, 'ee')).toBe(0);
    expect(manualShare(income, 3, 'me')).toBe(0);
  });
});
