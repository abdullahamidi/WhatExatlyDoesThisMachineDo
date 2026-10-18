import { describe, it, expect } from 'vitest';
import { normDeg, crankOffsetOnGearUp, crankAngle } from './crankLink';

const RATIO = -1.75;
const PHASE = 0;

/** Seeded LCG (no Math.random): returns values in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Smallest unsigned distance between two angles, in degrees, in [0, 180]. */
function angularGap(a: number, b: number): number {
  const d = normDeg(a - b);
  return Math.min(d, 360 - d);
}

describe('normDeg', () => {
  it('maps into [0, 360)', () => {
    const rnd = lcg(7);
    for (let i = 0; i < 200; i++) {
      const v = normDeg((rnd() - 0.5) * 20000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });

  it('wraps known values', () => {
    expect(normDeg(720)).toBe(0);
    expect(normDeg(-90)).toBe(270);
    expect(normDeg(370)).toBe(10);
  });

  it('never returns -0', () => {
    expect(Object.is(normDeg(-0), 0)).toBe(true);
    expect(Object.is(normDeg(-360), 0)).toBe(true);
    expect(Object.is(normDeg(360), 0)).toBe(true);
    expect(Object.is(normDeg(-1e-300), 0)).toBe(true);
  });
});

describe('crank link continuity', () => {
  it('gearing does not move the crank: geared angle equals free angle', () => {
    const rnd = lcg(12345);
    for (let i = 0; i < 200; i++) {
      const c = (rnd() - 0.5) * 3600;
      const m = (rnd() - 0.5) * 3600;
      const offset = crankOffsetOnGearUp(c, m, RATIO, PHASE);
      const geared = crankAngle(true, c, m, offset, RATIO, PHASE);
      const free = crankAngle(false, c, m, 0, RATIO, PHASE);
      expect(angularGap(geared, free)).toBeCloseTo(0, 9);
    }
  });

  it('after gearing, +10 deg of master moves the crank by -17.5 deg', () => {
    const rnd = lcg(999);
    for (let i = 0; i < 50; i++) {
      const c = rnd() * 3600;
      const m = rnd() * 3600;
      const offset = crankOffsetOnGearUp(c, m, RATIO, PHASE);
      const before = crankAngle(true, c, m, offset, RATIO, PHASE);
      const after = crankAngle(true, c, m + 10, offset, RATIO, PHASE);
      expect(angularGap(after, before + -17.5)).toBeCloseTo(0, 9);
    }
  });

  it('zero offset when gearing starts with the crank in step with the master', () => {
    expect(crankOffsetOnGearUp(0, 0, RATIO, PHASE)).toBe(0);
  });
});
