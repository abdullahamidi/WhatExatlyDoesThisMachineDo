import { describe, it, expect } from 'vitest';
import { cycleTransitionAlpha, cycleTransitionEndMs, cycleTransitionPeakMs } from './cycleTransition';
import { CYCLE_TRANSITION } from '../../data/prestige';

const FULL = [false, true] as const;

/** Samples the alpha curve every `stepMs` from 0 to `endMs` inclusive. */
function sample(reduced: boolean, stepMs: number): number[] {
  const end = cycleTransitionEndMs(reduced);
  const out: number[] = [];
  for (let t = 0; t <= end; t += stepMs) out.push(cycleTransitionAlpha(t, reduced));
  return out;
}

describe('cycle transition timings', () => {
  it('peak and end follow the data timings (full and reduced)', () => {
    expect(cycleTransitionPeakMs(false)).toBe(CYCLE_TRANSITION.inMs);
    expect(cycleTransitionEndMs(false)).toBe(CYCLE_TRANSITION.inMs + CYCLE_TRANSITION.outMs);
    expect(cycleTransitionPeakMs(true)).toBe(CYCLE_TRANSITION.reduced.inMs);
    expect(cycleTransitionEndMs(true)).toBe(CYCLE_TRANSITION.reduced.inMs + CYCLE_TRANSITION.reduced.outMs);
  });

  it('every timing is positive and the peak comes before the end', () => {
    for (const reduced of FULL) {
      expect(cycleTransitionPeakMs(reduced)).toBeGreaterThan(0);
      expect(cycleTransitionEndMs(reduced)).toBeGreaterThan(cycleTransitionPeakMs(reduced));
    }
  });

  it('reduced motion finishes within 1.2 s of game time', () => {
    expect(cycleTransitionEndMs(true)).toBeLessThanOrEqual(1200);
    expect(cycleTransitionEndMs(true)).toBeLessThan(cycleTransitionEndMs(false));
  });
});

describe('cycleTransitionAlpha', () => {
  it('is 0 at 0 and before the transition', () => {
    for (const reduced of FULL) {
      expect(cycleTransitionAlpha(0, reduced)).toBe(0);
      expect(cycleTransitionAlpha(-1, reduced)).toBe(0);
      expect(cycleTransitionAlpha(-1e6, reduced)).toBe(0);
    }
  });

  it('reads 0 for non-finite times', () => {
    expect(cycleTransitionAlpha(Number.NaN, false)).toBe(0);
    expect(cycleTransitionAlpha(Number.POSITIVE_INFINITY, false)).toBe(0);
    expect(cycleTransitionAlpha(Number.NEGATIVE_INFINITY, true)).toBe(0);
  });

  it('is 1 at the peak', () => {
    expect(cycleTransitionAlpha(cycleTransitionPeakMs(false), false)).toBeCloseTo(1, 9);
    expect(cycleTransitionAlpha(cycleTransitionPeakMs(true), true)).toBeCloseTo(1, 9);
  });

  it('is 0 at the end and 0 after it', () => {
    for (const reduced of FULL) {
      const end = cycleTransitionEndMs(reduced);
      expect(cycleTransitionAlpha(end, reduced)).toBe(0);
      expect(cycleTransitionAlpha(end + 1, reduced)).toBe(0);
      expect(cycleTransitionAlpha(end * 10, reduced)).toBe(0);
    }
  });

  it('stays within 0..1 everywhere', () => {
    for (const reduced of FULL) {
      for (const a of sample(reduced, 7)) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rises monotonically up to the peak and falls monotonically after it', () => {
    for (const reduced of FULL) {
      const peak = cycleTransitionPeakMs(reduced);
      const end = cycleTransitionEndMs(reduced);
      let prev = -1;
      for (let t = 0; t <= peak; t += 5) {
        const a = cycleTransitionAlpha(t, reduced);
        expect(a).toBeGreaterThanOrEqual(prev);
        prev = a;
      }
      prev = 2;
      for (let t = peak; t <= end; t += 5) {
        const a = cycleTransitionAlpha(t, reduced);
        expect(a).toBeLessThanOrEqual(prev);
        prev = a;
      }
    }
  });

  it('ease-out in: alpha at half the in-time is 1 - (1/2)^3 = 0.875', () => {
    const peak = cycleTransitionPeakMs(false);
    expect(cycleTransitionAlpha(peak / 2, false)).toBeCloseTo(0.875, 9);
  });

  it('fades out linearly: alpha at the middle of the out-time is 0.5', () => {
    for (const reduced of FULL) {
      const peak = cycleTransitionPeakMs(reduced);
      const end = cycleTransitionEndMs(reduced);
      expect(cycleTransitionAlpha((peak + end) / 2, reduced)).toBeCloseTo(0.5, 9);
    }
  });

  it('reduced timings are used when reduced is true', () => {
    const t = CYCLE_TRANSITION.reduced.inMs + CYCLE_TRANSITION.reduced.outMs / 2;
    expect(cycleTransitionAlpha(t, true)).toBeCloseTo(0.5, 9);
    expect(cycleTransitionAlpha(CYCLE_TRANSITION.reduced.inMs, true)).toBeCloseTo(1, 9);
    expect(cycleTransitionAlpha(CYCLE_TRANSITION.reduced.inMs, false)).toBeLessThan(1);
  });
});
