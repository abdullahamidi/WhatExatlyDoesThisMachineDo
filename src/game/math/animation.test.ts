import { describe, it, expect } from 'vitest';
import type { SpeedCurve } from '../../data/machineComponents';
import {
  animationSpeed,
  decayActivity,
  addActivity,
  driverValue,
  clampFrameSeconds,
  advanceAngle,
  advancePhase,
  reciprocateOffset,
  vibrateOffset,
} from './animation';

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

describe('decayActivity', () => {
  it('returns the value unchanged for dt <= 0 or non-finite dt', () => {
    expect(decayActivity(2, 0, 0.75)).toBe(2);
    expect(decayActivity(2, -1, 0.75)).toBe(2);
    expect(decayActivity(2, Number.NaN, 0.75)).toBe(2);
    expect(decayActivity(2, Number.POSITIVE_INFINITY, 0.75)).toBe(2);
  });

  it('decays by e^(-dt / tau)', () => {
    expect(decayActivity(1, 0.75, 0.75)).toBeCloseTo(Math.exp(-1), 9);
  });

  it('snaps to 0 after about 10 tau', () => {
    expect(decayActivity(5, 7.5, 0.75)).toBe(0);
  });
});

describe('addActivity', () => {
  it('adds gained / tau', () => {
    expect(addActivity(1, 2, 0.5)).toBeCloseTo(5, 9);
  });

  it('ignores zero, negative and NaN gains', () => {
    expect(addActivity(1, 0, 0.5)).toBe(1);
    expect(addActivity(1, -3, 0.5)).toBe(1);
    expect(addActivity(1, Number.NaN, 0.5)).toBe(1);
  });
});

describe('steady clicking activity', () => {
  it('settles near gain * rate per second', () => {
    const tau = 0.75;
    const dt = 0.01;
    let value = 0;
    const samples: number[] = [];
    for (let step = 0; step < 1000; step++) {
      if (step % 20 === 0) value = addActivity(value, 1, tau); // one click every 0.2 s (5 per second)
      value = decayActivity(value, dt, tau);
      if (step >= 500) samples.push(value); // last 5 s
    }
    const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    expect(Math.abs(mean - 5) / 5).toBeLessThan(0.15);
  });
});

describe('driverValue', () => {
  it('picks manual, automation, or their sum', () => {
    expect(driverValue('manual', 2, 3)).toBe(2);
    expect(driverValue('automation', 2, 3)).toBe(3);
    expect(driverValue('combined', 2, 3)).toBe(5);
  });
});

describe('clampFrameSeconds', () => {
  it('caps long frames at the maximum', () => {
    expect(clampFrameSeconds(5000, 0.1)).toBe(0.1);
  });

  it('converts milliseconds to seconds below the cap', () => {
    expect(clampFrameSeconds(16, 0.1)).toBeCloseTo(0.016, 9);
  });

  it('returns 0 for NaN and negative input', () => {
    expect(clampFrameSeconds(Number.NaN, 0.1)).toBe(0);
    expect(clampFrameSeconds(-5, 0.1)).toBe(0);
  });
});

describe('advanceAngle', () => {
  it('advances forward and wraps past 360', () => {
    expect(advanceAngle(350, 20, 1, 1)).toBe(10);
  });

  it('advances backward and wraps below 0', () => {
    expect(advanceAngle(10, 20, -1, 1)).toBe(350);
  });

  it('stays in [0, 360) for huge and negative dt', () => {
    for (const dt of [1e6, 1e12, -1e6, -3.7]) {
      const a = advanceAngle(123, 45, 1, dt);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(360);
    }
  });

  it('never returns -0', () => {
    expect(Object.is(advanceAngle(0, 0, 1, 0), -0)).toBe(false);
    expect(advanceAngle(360, 0, 1, 0)).toBe(0);
  });
});

describe('advancePhase', () => {
  it('stays in [0, 1) for negative and huge dt', () => {
    for (const dt of [-3.7, 1e6]) {
      const p = advancePhase(0.2, 1.5, dt);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  it('wraps forward progress', () => {
    expect(advancePhase(0.75, 0.5, 1)).toBeCloseTo(0.25, 9);
  });
});

describe('reciprocateOffset', () => {
  it('is zero at phase 0', () => {
    expect(reciprocateOffset(0, 3)).toBe(0);
  });

  it('reaches -amplitude at half a cycle', () => {
    expect(reciprocateOffset(0.5, 3)).toBe(-3);
  });

  it('rounds to whole px', () => {
    expect(reciprocateOffset(0.25, 4)).toBe(-2);
  });
});

describe('vibrateOffset', () => {
  it('returns integers bounded by the amplitude', () => {
    const amplitude = 3;
    for (let i = 0; i < 200; i++) {
      const o = vibrateOffset(i / 200, amplitude);
      expect(Number.isInteger(o.x)).toBe(true);
      expect(Number.isInteger(o.y)).toBe(true);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(amplitude);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(amplitude);
    }
  });

  it('is deterministic for the same phase', () => {
    expect(vibrateOffset(0.37, 2)).toEqual(vibrateOffset(0.37, 2));
  });
});
