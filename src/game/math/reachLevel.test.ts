// Tests for reachLevel (WP28a, P17): bounds, monotone in rate, bad inputs read 0 (hi not above lo included), and the shipped
// REACH_LEVEL bounds. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { reachLevel } from './reachLevel';
import { REACH_LEVEL } from '../../data/worldReach';
import { RESOURCE_IDS } from '../../data/types';

describe('reachLevel', () => {
  it('reads 0 at or below lo and 1 at or above hi', () => {
    expect(reachLevel(0, 1, 1e6)).toBe(0);
    expect(reachLevel(1, 1, 1e6)).toBe(0);
    expect(reachLevel(0.5, 1, 1e6)).toBe(0);
    expect(reachLevel(-Infinity, 1, 1e6)).toBe(0);
    expect(reachLevel(1e6, 1, 1e6)).toBe(1);
    expect(reachLevel(1e9, 1, 1e6)).toBe(1);
    expect(reachLevel(Infinity, 1, 1e6)).toBe(1);
  });

  it('is the log scale between the bounds (a decade is 1 / log10(hi / lo) of the range)', () => {
    expect(reachLevel(10, 1, 1e6)).toBeCloseTo(1 / 6, 12);
    expect(reachLevel(1e3, 1, 1e6)).toBeCloseTo(0.5, 12);
    expect(reachLevel(Math.sqrt(1e6), 1, 1e6)).toBeCloseTo(0.5, 12);
  });

  it('is monotone in rate and always inside [0, 1]', () => {
    let prev = -1;
    for (let r = 0; r <= 2e6; r = r === 0 ? 0.5 : r * 1.37) {
      const L = reachLevel(r, 1, 3e5);
      expect(L).toBeGreaterThanOrEqual(0);
      expect(L).toBeLessThanOrEqual(1);
      expect(L).toBeGreaterThanOrEqual(prev);
      prev = L;
    }
  });

  it('reads 0 for bad input: NaN rate, lo not positive, hi not above lo, non-finite bounds', () => {
    expect(reachLevel(NaN, 1, 1e6)).toBe(0);
    expect(reachLevel(100, 0, 1e6)).toBe(0);
    expect(reachLevel(100, -1, 1e6)).toBe(0);
    expect(reachLevel(100, NaN, 1e6)).toBe(0);
    expect(reachLevel(100, 1, Infinity)).toBe(0);
    expect(reachLevel(100, 1e6, 1e6)).toBe(0);
    expect(reachLevel(100, 1e6, 1)).toBe(0);
    expect(reachLevel(1e9, 1e6, 1)).toBe(0);
  });

  it('reads the shipped REACH_LEVEL bounds: lo 1 (ME 10) and hi per energy, every energy in RESOURCE_IDS', () => {
    for (const id of RESOURCE_IDS) {
      expect(REACH_LEVEL.lo[id]).toBe(id === 'me' ? 10 : 1);
      expect(REACH_LEVEL.hi[id]).toBeGreaterThan(REACH_LEVEL.lo[id]);
      expect(reachLevel(REACH_LEVEL.hi[id], REACH_LEVEL.lo[id], REACH_LEVEL.hi[id])).toBe(1);
    }
    expect(REACH_LEVEL.hi.me).toBe(3e4);
    expect(REACH_LEVEL.hi.ee).toBe(1e5);
    expect(REACH_LEVEL.hi.xf).toBe(1e6);
  });
});
