import { describe, it, expect } from 'vitest';
import type { SpeedCurve } from '../../data/machineComponents';
import { animationSpeed } from './animation';

const CURVE: SpeedCurve = { base: 90, gain: 0.5, min: 30, max: 360 };

describe('animationSpeed', () => {
  it('returns 0 for zero, negative, NaN and infinite drivers', () => {
    expect(animationSpeed(CURVE, 0)).toBe(0);
    expect(animationSpeed(CURVE, -5)).toBe(0);
    expect(animationSpeed(CURVE, Number.NaN)).toBe(0);
    expect(animationSpeed(CURVE, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('follows base * (1 + gain * log10(1 + v)) inside the range', () => {
    // v = 9 -> log10(10) = 1 -> 90 * 1.5 = 135
    expect(animationSpeed(CURVE, 9)).toBeCloseTo(135, 9);
  });

  it('is non-decreasing in the driver value', () => {
    const values = [1, 2, 5, 10, 100, 1e3, 1e6].map((v) => animationSpeed(CURVE, v));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] ?? 0);
    }
  });

  it('never exceeds max', () => {
    expect(animationSpeed(CURVE, 1e12)).toBe(CURVE.max);
    const steep: SpeedCurve = { base: 90, gain: 5, min: 30, max: 360 };
    expect(animationSpeed(steep, 1e12)).toBe(steep.max);
  });

  it('never drops below min', () => {
    const flat: SpeedCurve = { base: 10, gain: 0.1, min: 30, max: 360 };
    expect(animationSpeed(flat, 0.001)).toBe(flat.min);
  });
});
