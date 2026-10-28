import { describe, it, expect } from 'vitest';
import type { GameState, ResourceMap, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { createInitialState } from '../state';
import { refillWindup, releaseWindup, windupParams } from './windup';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

const zeroMap = (): ResourceMap => ({ me: 0, ee: 0, pr: 0, rs: 0, xf: 0 });

// Output per second for the release tests: a zero entry (pr) must gain nothing there.
const PER_SECOND: ResourceMap = { me: 10, ee: 4, pr: 0, rs: 2, xf: 1 };

describe('windupParams', () => {
  it('is zero with no wind-up tech owned (initial state)', () => {
    expect(windupParams(createInitialState(0).techLevels)).toEqual({ cap: 0, refill: 0 });
  });

  it('Reinforced Crank at level 1: cap 0.35 s, refill 0.035 s/s', () => {
    const p = windupParams(withLevels({ reinforcedCrank: 1 }).techLevels);
    expect(p.cap).toBeCloseTo(0.35, 12);
    expect(p.refill).toBeCloseTo(0.035, 12);
  });

  it('Flywheel adds 0.015 s and 0.0015 s/s per level (10 levels: 0.15 and 0.015)', () => {
    const p = windupParams(withLevels({ flywheel: 10 }).techLevels);
    expect(p.cap).toBeCloseTo(0.15, 12);
    expect(p.refill).toBeCloseTo(0.015, 12);
  });

  it.each(['steamHammer', 'dischargeLever', 'dampingFork', 'overrunClutch'] as const)(
    '%s adds 0.375 s cap and 0.0375 s/s refill',
    (id) => {
      const levels: Partial<Record<TechId, number>> = {};
      levels[id] = 1;
      const p = windupParams(withLevels(levels).techLevels);
      expect(p.cap).toBeCloseTo(0.375, 12);
      expect(p.refill).toBeCloseTo(0.0375, 12);
    },
  );

  it('everything owned: cap 2.0 s and refill 0.2 s/s', () => {
    const p = windupParams(
      withLevels({
        reinforcedCrank: 1,
        flywheel: 10,
        steamHammer: 1,
        dischargeLever: 1,
        dampingFork: 1,
        overrunClutch: 1,
      }).techLevels,
    );
    expect(p.cap).toBeCloseTo(2.0, 12);
    expect(p.refill).toBeCloseTo(0.2, 12);
  });

  it('a level 0 tech adds nothing', () => {
    expect(windupParams(withLevels({ reinforcedCrank: 0, flywheel: 0 }).techLevels)).toEqual({ cap: 0, refill: 0 });
  });

  it('ignores techs without a windup effect', () => {
    expect(windupParams(withLevels({ handCrank: 1, gearRatio: 5, wornMotor: 1 }).techLevels)).toEqual({
      cap: 0,
      refill: 0,
    });
  });

  it('uses a custom technology table when provided', () => {
    const techs = {
      ...TECHNOLOGIES,
      reinforcedCrank: {
        ...TECHNOLOGIES.reinforcedCrank,
        effects: [{ type: 'windup' as const, seconds: 2, refill: 0.5 }],
      },
    };
    const p = windupParams(withLevels({ reinforcedCrank: 3 }).techLevels, techs);
    expect(p.cap).toBeCloseTo(6, 12);
    expect(p.refill).toBeCloseTo(1.5, 12);
  });

});

describe('refillWindup', () => {
  const p = { cap: 2, refill: 0.2 };

  it('adds refill x seconds to the store', () => {
    expect(refillWindup(0.5, p, 5)).toBeCloseTo(1.5, 12);
  });

  it('clamps at the cap', () => {
    expect(refillWindup(1.9, p, 100)).toBe(2);
    expect(refillWindup(2, p, 1)).toBe(2);
  });

  it('no seconds, no refill', () => {
    expect(refillWindup(0.7, p, 0)).toBe(0.7);
  });

  it('negative stored counts as 0', () => {
    expect(refillWindup(-3, p, 5)).toBeCloseTo(1, 12);
  });

  it('negative seconds refill nothing', () => {
    expect(refillWindup(0.5, p, -10)).toBe(0.5);
  });

  it('NaN and Infinity stored count as 0', () => {
    expect(refillWindup(NaN, p, 5)).toBeCloseTo(1, 12);
    expect(refillWindup(Infinity, p, 5)).toBeCloseTo(1, 12);
  });

  it('NaN and Infinity seconds count as 0', () => {
    expect(refillWindup(0.5, p, NaN)).toBe(0.5);
    expect(refillWindup(0.5, p, Infinity)).toBe(0.5);
  });

  it('cap 0 gives 0', () => {
    expect(refillWindup(0, { cap: 0, refill: 0.2 }, 10)).toBe(0);
    expect(refillWindup(5, { cap: 0, refill: 0.2 }, 10)).toBe(0);
  });
});

describe('releaseWindup', () => {
  const p = { cap: 2, refill: 0.2 };

  it('releases every stored second on every energy (a zero rate gains 0)', () => {
    const s = withLevels({});
    const r = releaseWindup(s, 1.5, p, PER_SECOND);
    expect(r.released).toBe(1.5);
    expect(r.gained.me).toBeCloseTo(15, 12);
    expect(r.gained.ee).toBeCloseTo(6, 12);
    expect(r.gained.pr).toBe(0);
    expect(r.gained.rs).toBeCloseTo(3, 12);
    expect(r.gained.xf).toBeCloseTo(1.5, 12);
  });

  it('moves res and lifetime together by the gains', () => {
    const s = withLevels(
      {},
      { res: { me: 100, ee: 5, pr: 0, rs: 0, xf: 0 }, lifetime: { me: 300, ee: 5, pr: 0, rs: 0, xf: 0 } },
    );
    const r = releaseWindup(s, 1.5, p, PER_SECOND);
    expect(r.state.res.me).toBeCloseTo(115, 12);
    expect(r.state.lifetime.me).toBeCloseTo(315, 12);
    expect(r.state.res.ee).toBeCloseTo(11, 12);
    expect(r.state.lifetime.ee).toBeCloseTo(11, 12);
    expect(r.state.res.pr).toBe(0);
  });

  it('does not change totalClicks', () => {
    const s = withLevels({}, { totalClicks: 42 });
    expect(releaseWindup(s, 1.5, p, PER_SECOND).state.totalClicks).toBe(42);
  });

  it('a stored value above the cap is cut to the cap', () => {
    const r = releaseWindup(withLevels({}), 5, p, PER_SECOND);
    expect(r.released).toBe(2);
    expect(r.gained.me).toBe(20);
  });

  it('a store equal to the cap releases the whole cap', () => {
    expect(releaseWindup(withLevels({}), 2, p, PER_SECOND).released).toBe(2);
  });

  it('negative and non-finite stored release nothing and return the same object', () => {
    const s = withLevels({});
    for (const stored of [-1, NaN, Infinity]) {
      const r = releaseWindup(s, stored, p, PER_SECOND);
      expect(r.state).toBe(s);
      expect(r.released).toBe(0);
      expect(r.gained).toEqual(zeroMap());
    }
  });

  it('cap 0 returns the same state object with zero gains', () => {
    const s = withLevels({});
    const r = releaseWindup(s, 3, { cap: 0, refill: 0.2 }, PER_SECOND);
    expect(r.state).toBe(s);
    expect(r.gained).toEqual(zeroMap());
    expect(r.released).toBe(0);
  });

  it('a negative rate gains 0 (a release never takes output back)', () => {
    const r = releaseWindup(withLevels({}), 1, p, { me: -5, ee: 0, pr: 0, rs: 0, xf: 0 });
    expect(r.gained.me).toBe(0);
  });

  it('does not mutate its inputs', () => {
    const s = withLevels({}, { res: { me: 1, ee: 0, pr: 0, rs: 0, xf: 0 } });
    const before = structuredClone(s);
    const rate = { ...PER_SECOND };
    releaseWindup(s, 1.5, p, rate);
    expect(s).toEqual(before);
    expect(rate).toEqual(PER_SECOND);
  });
});
