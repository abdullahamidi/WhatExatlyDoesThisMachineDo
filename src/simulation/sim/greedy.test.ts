import { beforeAll, describe, it, expect } from 'vitest';
import { TECH_IDS } from '../../data/types';
import type { TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { runGreedy, maxPurchaseGap } from './greedy';
import type { GreedyResult } from './greedy';

const CLICKS_PER_SECOND = 4;

function options(seconds: number) {
  return { seconds, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds: 1 };
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
