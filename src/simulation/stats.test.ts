import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS } from '../data/types';
import type { ResourceMap, StatsState } from '../data/types';
import { createInitialState } from './state';
import { addLifetimeDelta, bumpMaxRates, deriveStats, emptyStats } from './stats';

const zeros = (): ResourceMap => ({ me: 0, ee: 0, pr: 0, rs: 0, xf: 0 });

describe('emptyStats', () => {
  it('starts every counter at zero with one cycle and no best cycle', () => {
    const s = emptyStats(1234);
    expect(s).toEqual({
      activeSeconds: 0,
      offlineSeconds: 0,
      longestOfflineSeconds: 0,
      clicks: 0,
      purchases: 0,
      lifetime: zeros(),
      maxPerSecond: zeros(),
      cycles: 1,
      bestCycleSeconds: null,
      startedAt: 1234,
    });
  });

  it('returns fresh resource maps on every call', () => {
    const a = emptyStats(0);
    const b = emptyStats(0);
    expect(a).not.toBe(b);
    expect(a.lifetime).not.toBe(b.lifetime);
    expect(a.maxPerSecond).not.toBe(b.maxPerSecond);
    a.lifetime.me = 5;
    a.maxPerSecond.ee = 3;
    expect(b.lifetime.me).toBe(0);
    expect(b.maxPerSecond.ee).toBe(0);
  });
});

describe('deriveStats', () => {
  it('derives a fresh save: zero counters, startedAt from createdAt', () => {
    const state = createInitialState(5000);
    const s = deriveStats(state, 9999);
    expect(s.clicks).toBe(0);
    expect(s.lifetime).toEqual(zeros());
    expect(s.maxPerSecond).toEqual(zeros());
    expect(s.activeSeconds).toBe(0);
    expect(s.offlineSeconds).toBe(0);
    expect(s.longestOfflineSeconds).toBe(0);
    expect(s.purchases).toBe(0);
    expect(s.cycles).toBe(1);
    expect(s.bestCycleSeconds).toBeNull();
    expect(s.startedAt).toBe(5000);
  });

  it('takes clicks and lifetime from the state', () => {
    const state = createInitialState(100);
    state.totalClicks = 42;
    state.lifetime = { me: 1500, ee: 7, pr: 0, rs: 0, xf: 3 };
    const s = deriveStats(state, 200);
    expect(s.clicks).toBe(42);
    expect(s.lifetime).toEqual({ me: 1500, ee: 7, pr: 0, rs: 0, xf: 3 });
    expect(s.startedAt).toBe(100);
  });

  it('copies lifetime instead of sharing the state object', () => {
    const state = createInitialState(1);
    const s = deriveStats(state, 1);
    expect(s.lifetime).not.toBe(state.lifetime);
    state.lifetime.me = 99;
    expect(s.lifetime.me).toBe(0);
  });

  it('uses nowMs as startedAt when createdAt is not finite', () => {
    const state = createInitialState(10);
    state.createdAt = Number.NaN;
    expect(deriveStats(state, 777).startedAt).toBe(777);
    state.createdAt = Infinity;
    expect(deriveStats(state, 888).startedAt).toBe(888);
  });

  it('does not mutate the state', () => {
    const state = createInitialState(3);
    state.totalClicks = 4;
    const before = JSON.stringify(state);
    deriveStats(state, 9);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('addLifetimeDelta', () => {
  it('adds positive per-resource growth', () => {
    const base: StatsState = emptyStats(0);
    const prev: ResourceMap = { me: 10, ee: 0, pr: 5, rs: 0, xf: 1 };
    const next: ResourceMap = { me: 25, ee: 4, pr: 5, rs: 2, xf: 1 };
    const s = addLifetimeDelta(base, prev, next);
    expect(s.lifetime).toEqual({ me: 15, ee: 4, pr: 0, rs: 2, xf: 0 });
  });

  it('adds onto existing lifetime totals', () => {
    const base: StatsState = { ...emptyStats(0), lifetime: { me: 100, ee: 0, pr: 0, rs: 0, xf: 0 } };
    const s = addLifetimeDelta(base, zeros(), { ...zeros(), me: 5 });
    expect(s.lifetime.me).toBe(105);
  });

  it('ignores negative deltas', () => {
    const base: StatsState = { ...emptyStats(0), lifetime: { me: 50, ee: 0, pr: 0, rs: 0, xf: 0 } };
    const s = addLifetimeDelta(base, { ...zeros(), me: 80 }, { ...zeros(), me: 20 });
    expect(s).toBe(base);
    expect(s.lifetime.me).toBe(50);
  });

  it('ignores NaN and infinite deltas', () => {
    const base = emptyStats(0);
    expect(addLifetimeDelta(base, zeros(), { ...zeros(), me: Number.NaN })).toBe(base);
    expect(addLifetimeDelta(base, zeros(), { ...zeros(), me: Infinity })).toBe(base);
    const prevNaN = { ...zeros(), ee: Number.NaN };
    expect(addLifetimeDelta(base, prevNaN, { ...zeros(), ee: 5 })).toBe(base);
  });

  it('returns the same object when nothing was added', () => {
    const base = emptyStats(0);
    expect(addLifetimeDelta(base, zeros(), zeros())).toBe(base);
    expect(addLifetimeDelta(base, { ...zeros(), me: 9 }, { ...zeros(), me: 9 })).toBe(base);
  });

  it('does not mutate inputs', () => {
    const base = emptyStats(0);
    const prev = zeros();
    const next = { ...zeros(), me: 3 };
    const s = addLifetimeDelta(base, prev, next);
    expect(s).not.toBe(base);
    expect(base.lifetime.me).toBe(0);
    expect(prev).toEqual(zeros());
    expect(next).toEqual({ ...zeros(), me: 3 });
    expect(s.lifetime).not.toBe(base.lifetime);
  });

  it('keeps other stats fields untouched', () => {
    const base: StatsState = { ...emptyStats(4), clicks: 7, purchases: 2 };
    const s = addLifetimeDelta(base, zeros(), { ...zeros(), xf: 1 });
    expect(s.clicks).toBe(7);
    expect(s.purchases).toBe(2);
    expect(s.startedAt).toBe(4);
    for (const id of RESOURCE_IDS) expect(s.maxPerSecond[id]).toBe(0);
  });
});

describe('bumpMaxRates', () => {
  it('raises each resource to the new rate when higher', () => {
    const base = emptyStats(0);
    const s = bumpMaxRates(base, { me: 3, ee: 0, pr: 1.5, rs: 0, xf: 0 });
    expect(s.maxPerSecond).toEqual({ me: 3, ee: 0, pr: 1.5, rs: 0, xf: 0 });
  });

  it('keeps the old maximum when the new rate is lower', () => {
    const base: StatsState = { ...emptyStats(0), maxPerSecond: { me: 10, ee: 2, pr: 0, rs: 0, xf: 0 } };
    const s = bumpMaxRates(base, { me: 4, ee: 5, pr: 0, rs: 0, xf: 0 });
    expect(s.maxPerSecond).toEqual({ me: 10, ee: 5, pr: 0, rs: 0, xf: 0 });
  });

  it('ignores NaN and infinite rates', () => {
    const base = emptyStats(0);
    expect(bumpMaxRates(base, { ...zeros(), me: Number.NaN })).toBe(base);
    expect(bumpMaxRates(base, { ...zeros(), me: Infinity })).toBe(base);
  });

  it('returns the same object when nothing was raised', () => {
    const base: StatsState = { ...emptyStats(0), maxPerSecond: { me: 10, ee: 0, pr: 0, rs: 0, xf: 0 } };
    expect(bumpMaxRates(base, { ...zeros(), me: 10 })).toBe(base);
    expect(bumpMaxRates(base, { ...zeros(), me: 1 })).toBe(base);
    expect(bumpMaxRates(base, zeros())).toBe(base);
  });

  it('does not mutate inputs', () => {
    const base = emptyStats(0);
    const rates = { ...zeros(), me: 2 };
    const s = bumpMaxRates(base, rates);
    expect(s).not.toBe(base);
    expect(base.maxPerSecond.me).toBe(0);
    expect(rates).toEqual({ ...zeros(), me: 2 });
    expect(s.maxPerSecond).not.toBe(base.maxPerSecond);
  });

  it('leaves lifetime untouched', () => {
    const base: StatsState = { ...emptyStats(0), lifetime: { me: 9, ee: 0, pr: 0, rs: 0, xf: 0 } };
    const s = bumpMaxRates(base, { ...zeros(), me: 5 });
    expect(s.lifetime.me).toBe(9);
  });
});
