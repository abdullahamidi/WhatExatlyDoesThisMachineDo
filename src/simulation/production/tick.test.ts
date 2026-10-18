import { describe, it, expect } from 'vitest';
import type { GameState, TechId } from '../../data/types';
import { createInitialState } from '../state';
import { applyClick, advance, computeOffline, applyOffline } from './tick';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Automation rate: wornMotor 1 + motorTuning 5 = 6 ME/s.
const auto6 = (extra: Partial<GameState> = {}) => withLevels({ wornMotor: 1, motorTuning: 5 }, extra);

describe('applyClick', () => {
  it('adds one click of Hand Crank production and counts the click', () => {
    const s = createInitialState(0);
    const before = structuredClone(s);
    const { state, gained } = applyClick(s);
    expect(gained).toBeCloseTo(1, 9);
    expect(state.me).toBeCloseTo(1, 9);
    expect(state.lifetimeMe).toBeCloseTo(1, 9);
    expect(state.totalClicks).toBe(1);
    expect(s).toEqual(before);
  });

  it('uses manual multipliers', () => {
    const { gained } = applyClick(withLevels({ gearRatio: 3, reinforcedCrank: 1 }));
    expect(gained).toBeCloseTo(8, 9);
  });
});

describe('advance', () => {
  it('adds perSecond * seconds to me and lifetimeMe', () => {
    const next = advance(auto6(), 10);
    expect(next.me).toBeCloseTo(60, 9);
    expect(next.lifetimeMe).toBeCloseTo(60, 9);
  });

  it('returns the same reference for non-positive or non-finite steps', () => {
    const s = auto6();
    expect(advance(s, 0)).toBe(s);
    expect(advance(s, -1)).toBe(s);
    expect(advance(s, NaN)).toBe(s);
    expect(advance(s, Infinity)).toBe(s);
  });

  it('is step-size independent', () => {
    const s = auto6();
    let stepped = s;
    for (let i = 0; i < 100; i++) stepped = advance(stepped, 0.1);
    const single = advance(s, 10);
    expect(stepped.me).toBeCloseTo(single.me, 9);
  });

  it('does not touch lastSimTime', () => {
    const s = auto6({ lastSimTime: 1234 });
    expect(advance(s, 10).lastSimTime).toBe(1234);
  });
});

describe('computeOffline', () => {
  it('1 hour at 6/s', () => {
    expect(computeOffline(auto6({ lastSimTime: 0 }), 3_600_000)).toEqual({
      elapsedSeconds: 3600,
      cappedSeconds: 3600,
      gained: 21600,
    });
  });

  it('10 hours is capped at 8 hours', () => {
    const r = computeOffline(auto6({ lastSimTime: 0 }), 36_000_000);
    expect(r.elapsedSeconds).toBeCloseTo(36000, 9);
    expect(r.cappedSeconds).toBe(28800);
    expect(r.gained).toBeCloseTo(172800, 9);
  });

  it('clock going backwards yields all zeros', () => {
    expect(computeOffline(auto6({ lastSimTime: 5000 }), 1000)).toEqual({
      elapsedSeconds: 0,
      cappedSeconds: 0,
      gained: 0,
    });
  });

  it('initial state (no automation) gains nothing even with clicks', () => {
    const s = createInitialState(0);
    const r = computeOffline({ ...s, totalClicks: 500 }, 3_600_000);
    expect(r.elapsedSeconds).toBe(3600);
    expect(r.gained).toBeCloseTo(0, 9);
  });

  it('honours a custom cap', () => {
    const r = computeOffline(auto6({ lastSimTime: 0 }), 3_600_000, 60);
    expect(r.cappedSeconds).toBe(60);
    expect(r.gained).toBeCloseTo(360, 9);
  });
});

describe('applyOffline', () => {
  it('credits offline gain and advances lastSimTime', () => {
    const { state, report } = applyOffline(auto6({ lastSimTime: 0 }), 3_600_000);
    expect(report.gained).toBeCloseTo(21600, 9);
    expect(state.me).toBeCloseTo(21600, 9);
    expect(state.lifetimeMe).toBeCloseTo(21600, 9);
    expect(state.lastSimTime).toBe(3_600_000);
  });

  it('a second application at the same time gains nothing', () => {
    const first = applyOffline(auto6({ lastSimTime: 0 }), 3_600_000);
    const second = applyOffline(first.state, 3_600_000);
    expect(second.report.gained).toBe(0);
    expect(second.state.me).toBeCloseTo(21600, 9);
  });

  it('a time before lastSimTime leaves me unchanged but still sets lastSimTime', () => {
    const s = auto6({ lastSimTime: 5000, me: 42 });
    const { state } = applyOffline(s, 1000);
    expect(state.me).toBe(42);
    expect(state.lastSimTime).toBe(1000);
  });
});
