import { describe, it, expect } from 'vitest';
import type { SpeedCurve } from '../../data/machineComponents';
import {
  animationSpeed,
  decayActivity,
  addActivity,
  driverValue,
  clampFrameSeconds,
  advancePhase,
  vibrateOffset,
  framesIndex,
  reciprocateOffset,
  strikeCount,
  gaugeFrame,
  lowPass,
  spinStep,
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

  it('picks the electric value for the electric driver, and 3-arg calls stay valid', () => {
    expect(driverValue('electric', 2, 3, 7)).toBe(7);
    expect(driverValue('electric', 2, 3)).toBe(0);
    expect(driverValue('manual', 2, 3, 7)).toBe(2);
    expect(driverValue('automation', 2, 3, 7)).toBe(3);
    expect(driverValue('combined', 2, 3, 7)).toBe(5);
  });
});

describe('framesIndex', () => {
  it('stays on frame 0 while inactive', () => {
    expect(framesIndex(0.5, 4, 3, false)).toBe(0);
    expect(framesIndex(1.0, 4, 3, false)).toBe(0);
  });

  it('stays on frame 0 for a single frame sheet', () => {
    expect(framesIndex(1.0, 1, 3, true)).toBe(0);
  });

  it('returns 0 for negative, NaN and infinite time', () => {
    expect(framesIndex(-0.5, 4, 3, true)).toBe(0);
    expect(framesIndex(Number.NaN, 4, 3, true)).toBe(0);
    expect(framesIndex(Number.POSITIVE_INFINITY, 4, 3, true)).toBe(0);
  });

  it('advances at maxHz and wraps the frame count', () => {
    expect(framesIndex(0, 4, 3, true)).toBe(0);
    expect(framesIndex(0.34, 4, 3, true)).toBe(1);
    expect(framesIndex(0.67, 4, 3, true)).toBe(2);
    expect(framesIndex(1.0, 4, 3, true)).toBe(3);
    expect(framesIndex(1.34, 4, 3, true)).toBe(0);
  });

  it('changes index at most ceil(seconds * maxHz) times over 10 s', () => {
    const dt = 0.01;
    let changes = 0;
    let prev = framesIndex(0, 4, 3, true);
    for (let step = 1; step < 1000; step++) {
      const cur = framesIndex(step * dt, 4, 3, true);
      if (cur !== prev) changes++;
      prev = cur;
    }
    expect(changes).toBeLessThanOrEqual(Math.ceil(10 * 3));
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

describe('driverValue thermal', () => {
  it('picks the thermal value for the thermal driver', () => {
    expect(driverValue('thermal', 2, 3, 7, 9)).toBe(9);
    expect(driverValue('thermal', 2, 3)).toBe(0);
  });

  it('leaves the other drivers unchanged with the thermal argument present', () => {
    expect(driverValue('manual', 2, 3, 7, 9)).toBe(2);
    expect(driverValue('automation', 2, 3, 7, 9)).toBe(3);
    expect(driverValue('combined', 2, 3, 7, 9)).toBe(5);
    expect(driverValue('electric', 2, 3, 7, 9)).toBe(7);
  });
});

describe('reciprocateOffset', () => {
  it('is 0 at the strike and -stroke at the top of travel', () => {
    expect(reciprocateOffset(180, 1, 14, 0)).toBe(0);
    expect(reciprocateOffset(0, 1, 14, 0)).toBe(-14);
    expect(reciprocateOffset(90, 1, 14, 0)).toBe(-7);
  });

  it('never returns -0', () => {
    for (let deg = 0; deg < 360; deg++) {
      expect(Object.is(reciprocateOffset(deg, 1, 14, 0), -0)).toBe(false);
    }
    expect(Object.is(reciprocateOffset(180, 1, 14, 0), -0)).toBe(false);
  });

  it('stays within [-stroke, 0]', () => {
    for (let deg = 0; deg < 720; deg += 3) {
      const o = reciprocateOffset(deg, 1, 14, 0);
      expect(o).toBeGreaterThanOrEqual(-14);
      expect(o).toBeLessThanOrEqual(0);
    }
  });

  it('gives two strokes per turn at ratio 2', () => {
    let runs = 0;
    let prev = reciprocateOffset(359, 2, 14, 0);
    for (let deg = 0; deg < 360; deg++) {
      const cur = reciprocateOffset(deg, 2, 14, 0);
      if (cur === 0 && prev !== 0) runs++;
      prev = cur;
    }
    expect(runs).toBe(2);
  });

  it('gives one stroke per turn at ratio 1', () => {
    let runs = 0;
    let prev = reciprocateOffset(359, 1, 14, 0);
    for (let deg = 0; deg < 360; deg++) {
      const cur = reciprocateOffset(deg, 1, 14, 0);
      if (cur === 0 && prev !== 0) runs++;
      prev = cur;
    }
    expect(runs).toBe(1);
  });

  it('returns 0 for non-finite input', () => {
    expect(reciprocateOffset(Number.NaN, 1, 14, 0)).toBe(0);
    expect(reciprocateOffset(90, Number.POSITIVE_INFINITY, 14, 0)).toBe(0);
  });
});

describe('strikeCount', () => {
  it('counts one crossing of 180 deg forwards and backwards', () => {
    expect(strikeCount(170, 190, 1, 0)).toBe(1);
    expect(strikeCount(190, 170, 1, 0)).toBe(1);
  });

  it('counts whole turns of 360 deg', () => {
    expect(strikeCount(0, 360, 1, 0)).toBe(1);
    expect(strikeCount(0, 720, 1, 0)).toBe(2);
  });

  it('counts nothing inside one half turn', () => {
    expect(strikeCount(170, 175, 1, 0)).toBe(0);
  });

  it('counts on the ratio times the angle plus phase', () => {
    // ratio -1.75: a = 0, b = -630 -> floor(-2.25) = -3 vs floor(-0.5) = -1 -> 2 crossings
    expect(strikeCount(0, 360, -1.75, 0)).toBe(2);
    // a = 0, b = 350 -> one crossing
    expect(strikeCount(0, -200, -1.75, 0)).toBe(1);
  });

  it('returns 0 for non-finite input', () => {
    expect(strikeCount(Number.NaN, 10, 1, 0)).toBe(0);
    expect(strikeCount(0, Number.POSITIVE_INFINITY, 1, 0)).toBe(0);
    expect(strikeCount(0, 10, Number.NaN, 0)).toBe(0);
  });
});

describe('gaugeFrame', () => {
  const FRAMES = 25;
  const MIN_LOG = 0;
  const MAX_LOG = 5;

  it('maps the log scale onto the frame range', () => {
    expect(gaugeFrame(0, FRAMES, MIN_LOG, MAX_LOG)).toBe(0);
    expect(gaugeFrame(1e5, FRAMES, MIN_LOG, MAX_LOG)).toBe(24);
    expect(gaugeFrame(99999, FRAMES, MIN_LOG, MAX_LOG)).toBe(24);
    expect(gaugeFrame(9, FRAMES, MIN_LOG, MAX_LOG)).toBe(5);
  });

  it('returns 0 for NaN, negative and infinite values', () => {
    expect(gaugeFrame(Number.NaN, FRAMES, MIN_LOG, MAX_LOG)).toBe(0);
    expect(gaugeFrame(-5, FRAMES, MIN_LOG, MAX_LOG)).toBe(0);
    expect(gaugeFrame(Number.POSITIVE_INFINITY, FRAMES, MIN_LOG, MAX_LOG)).toBe(0);
  });

  it('returns 0 for a single frame sheet or an empty log range', () => {
    expect(gaugeFrame(1e5, 1, MIN_LOG, MAX_LOG)).toBe(0);
    expect(gaugeFrame(1e5, FRAMES, 5, 5)).toBe(0);
    expect(gaugeFrame(1e5, FRAMES, 5, 0)).toBe(0);
  });

  it('is monotone over a sweep of values', () => {
    let prev = gaugeFrame(0, FRAMES, MIN_LOG, MAX_LOG);
    for (let e = -2; e <= 6; e += 0.05) {
      const cur = gaugeFrame(10 ** e, FRAMES, MIN_LOG, MAX_LOG);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe('lowPass', () => {
  it('converges to the target', () => {
    let x = 0;
    const tau = 0.5;
    for (let step = 0; step < 100; step++) x = lowPass(x, 1, 0.05, tau); // 10 tau in total
    expect(Math.abs(x - 1)).toBeLessThan(1e-4);
  });

  it('keeps the previous value for dt <= 0 or non-finite dt', () => {
    expect(lowPass(3, 10, 0, 1)).toBe(3);
    expect(lowPass(3, 10, -1, 1)).toBe(3);
    expect(lowPass(3, 10, Number.NaN, 1)).toBe(3);
  });

  it('jumps to the target for tau <= 0', () => {
    expect(lowPass(3, 10, 0.1, 0)).toBe(10);
    expect(lowPass(3, 10, 0.1, -2)).toBe(10);
  });

  it('moves monotonically toward the target from either side', () => {
    let up = 0;
    let down = 5;
    for (let step = 0; step < 50; step++) {
      const nextUp = lowPass(up, 1, 0.05, 0.5);
      const nextDown = lowPass(down, 1, 0.05, 0.5);
      expect(nextUp).toBeGreaterThanOrEqual(up);
      expect(nextUp).toBeLessThanOrEqual(1);
      expect(nextDown).toBeLessThanOrEqual(down);
      expect(nextDown).toBeGreaterThanOrEqual(1);
      up = nextUp;
      down = nextDown;
    }
  });
});

describe('spinStep', () => {
  it('wraps into [0, 360)', () => {
    for (let angle = -720; angle <= 720; angle += 37) {
      for (const step of [-500, -3.5, 0, 12.25, 400]) {
        const x = spinStep(angle, step, 1);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(360);
      }
    }
  });

  it('wraps a negative speed up past zero', () => {
    expect(spinStep(10, -30, 1)).toBeCloseTo(340, 9);
  });

  it('wraps a forward step past 360', () => {
    expect(spinStep(350, 20, 1)).toBeCloseTo(10, 9);
  });

  it('keeps the angle at zero speed', () => {
    expect(spinStep(123.5, 0, 5)).toBe(123.5);
  });

  it('never returns -0', () => {
    expect(Object.is(spinStep(0, 0, 1), -0)).toBe(false);
    expect(Object.is(spinStep(0, -360, 1), -0)).toBe(false);
    expect(Object.is(spinStep(360, 0, 1), -0)).toBe(false);
  });

  it('keeps the wrapped angle for a non-finite step', () => {
    expect(spinStep(370, Number.NaN, 1)).toBeCloseTo(10, 9);
    expect(spinStep(10, Number.POSITIVE_INFINITY, 1)).toBeCloseTo(10, 9);
    expect(spinStep(10, 5, Number.NaN)).toBeCloseTo(10, 9);
  });
});
