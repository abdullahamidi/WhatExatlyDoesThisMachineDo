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
  orbitPoint,
  orbitFront,
  orbitStep,
  alignStep,
  latchFrame,
  stageFrameOf,
  echoAlpha,
  mirrorAngle,
  milestonePhase,
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

describe('driverValue resonance', () => {
  it('picks the resonance value for the resonance driver', () => {
    expect(driverValue('resonance', 2, 3, 7, 9, 11)).toBe(11);
    expect(driverValue('resonance', 1, 2)).toBe(0);
  });

  it('leaves the other drivers unchanged with the resonance argument present', () => {
    expect(driverValue('thermal', 2, 3, 7, 9)).toBe(9);
    expect(driverValue('thermal', 2, 3, 7, 9, 11)).toBe(9);
    expect(driverValue('electric', 2, 3, 7, 9, 11)).toBe(7);
    expect(driverValue('combined', 2, 3, 7, 9, 11)).toBe(5);
    expect(driverValue('manual', 2, 3, 7, 9, 11)).toBe(2);
    expect(driverValue('automation', 2, 3, 7, 9, 11)).toBe(3);
  });
});

describe('driverValue exotic', () => {
  it('picks the exotic value for the exotic driver', () => {
    expect(driverValue('exotic', 2, 3, 7, 9, 11, 13)).toBe(13);
    expect(driverValue('exotic', 1, 2)).toBe(0);
  });

  it('leaves the other drivers unchanged with the exotic argument present', () => {
    expect(driverValue('manual', 2, 3, 7, 9, 11, 13)).toBe(2);
    expect(driverValue('automation', 2, 3, 7, 9, 11, 13)).toBe(3);
    expect(driverValue('combined', 2, 3, 7, 9, 11, 13)).toBe(5);
    expect(driverValue('electric', 2, 3, 7, 9, 11, 13)).toBe(7);
    expect(driverValue('thermal', 2, 3, 7, 9, 11, 13)).toBe(9);
    expect(driverValue('resonance', 2, 3, 7, 9, 11, 13)).toBe(11);
  });
});

// ART section 4 ring geometry (tilt in degrees) used by the orbit tests below.
const RINGS = [
  { a: 36, b: 7, tiltDeg: -10 },
  { a: 42, b: 10, tiltDeg: 16 },
  { a: 46, b: 13, tiltDeg: -24 },
  { a: 50, b: 18, tiltDeg: 30 },
] as const;

function orbitSamples(ring: { a: number; b: number; tiltDeg: number }): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 3600; i++) out.push(orbitPoint(ring, i * 0.1)); // phi step 0.1 deg
  return out;
}

describe('orbitPoint', () => {
  it('matches the ART section 4 extents within 0.5 px', () => {
    const extents = [
      { x: 35.5, y: 9.3 },
      { x: 40.6, y: 15 },
      { x: 42.4, y: 22.1 },
      { x: 44.2, y: 29.5 },
    ];
    RINGS.forEach((ring, i) => {
      const pts = orbitSamples(ring);
      const maxX = Math.max(...pts.map((p) => Math.abs(p.x)));
      const maxY = Math.max(...pts.map((p) => Math.abs(p.y)));
      const want = extents[i];
      expect(want).toBeDefined();
      expect(Math.abs(maxX - (want?.x ?? 0))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(maxY - (want?.y ?? 0))).toBeLessThanOrEqual(0.5);
    });
  });

  it('is the tilted start point at phi 0', () => {
    const ring = RINGS[1];
    expect(ring).toBeDefined();
    if (!ring) return;
    const t = (ring.tiltDeg * Math.PI) / 180;
    const p = orbitPoint(ring, 0);
    expect(p.x).toBeCloseTo(ring.a * Math.cos(t), 9);
    expect(p.y).toBeCloseTo(ring.a * Math.sin(t), 9);
  });

  it('gives (0, b) for zero tilt at phi 90', () => {
    const p = orbitPoint({ a: 40, b: 12, tiltDeg: 0 }, 90);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(12, 9);
  });

  it('never returns -0 over the samples', () => {
    for (const ring of RINGS) {
      for (const p of orbitSamples(ring)) {
        expect(Object.is(p.x, -0)).toBe(false);
        expect(Object.is(p.y, -0)).toBe(false);
      }
    }
  });
});

describe('orbitFront', () => {
  it('is true for the upper half and multiples of 90 that are not 270', () => {
    for (const phi of [0, 45, 90, 180, 450]) expect(orbitFront(phi)).toBe(true);
  });

  it('is false for the lower half, 270 and negative angles', () => {
    for (const phi of [181, 270, 359, -90]) expect(orbitFront(phi)).toBe(false);
  });
});

describe('orbitStep', () => {
  it('wraps forward past 360', () => {
    expect(orbitStep(350, 1, 20, 1)).toBeCloseTo(10, 9);
  });

  it('wraps backward past 0', () => {
    expect(orbitStep(10, -1, 20, 1)).toBeCloseTo(350, 9);
  });

  it('keeps the angle for dt 0', () => {
    expect(orbitStep(123, 1, 50, 0)).toBe(123);
  });

  it('keeps the angle for a NaN speed or dt', () => {
    expect(orbitStep(45, 1, Number.NaN, 1)).toBe(45);
    expect(orbitStep(45, 1, 10, Number.NaN)).toBe(45);
  });

  it('stays in [0, 360) over a sweep', () => {
    for (let phi = -720; phi <= 720; phi += 37) {
      for (const dir of [1, -1] as const) {
        const x = orbitStep(phi, dir, 333, 0.7);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(360);
      }
    }
  });
});

describe('alignStep', () => {
  it('moves linearly along the short way for dir 1', () => {
    expect(alignStep(10, 90, 1, 0)).toBeCloseTo(10, 9);
    expect(alignStep(10, 90, 1, 0.5)).toBeCloseTo(50, 9);
  });

  it('lands exactly on the target at t01 1', () => {
    expect(alignStep(10, 90, 1, 1)).toBe(90);
  });

  it('goes the long way for dir -1', () => {
    expect(alignStep(10, 90, -1, 1)).toBe(90);
    expect(alignStep(10, 90, -1, 0.5)).toBeCloseTo(230, 9);
  });

  it('returns the target for every t01 when starting on it', () => {
    for (const dir of [1, -1] as const) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(alignStep(90, 90, dir, t)).toBe(90);
      }
    }
  });

  it('is monotone along dir', () => {
    let prevForward = 0;
    let prevBack = 0;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const forward = alignStep(10, 90, 1, t);
      const back = alignStep(10, 90, -1, t);
      const travelForward = (forward - 10 + 360) % 360;
      const travelBack = (10 - back + 360) % 360;
      expect(travelForward).toBeGreaterThanOrEqual(prevForward - 1e-9);
      expect(travelBack).toBeGreaterThanOrEqual(prevBack - 1e-9);
      prevForward = travelForward;
      prevBack = travelBack;
    }
  });
});

describe('latchFrame', () => {
  it('steps at 5 fps over 6 frames', () => {
    expect([0, 0.1, 0.2, 0.4, 0.8, 1.0].map((s) => latchFrame(s, 6, 5))).toEqual([0, 0, 1, 2, 4, 5]);
  });

  it('holds the last frame after the sequence', () => {
    expect(latchFrame(5, 6, 5)).toBe(5);
  });

  it('is 0 for null and negative time', () => {
    expect(latchFrame(null, 6, 5)).toBe(0);
    expect(latchFrame(-1, 6, 5)).toBe(0);
  });

  it('shows the last frame for Infinity (gate already true at load)', () => {
    expect(latchFrame(Number.POSITIVE_INFINITY, 6, 5)).toBe(5);
  });
});

describe('stageFrameOf', () => {
  it('maps the gates met onto frames 0..4', () => {
    expect([0, 1, 2, 3, 4].map((m) => stageFrameOf(m, 6))).toEqual([0, 1, 2, 3, 4]);
  });

  it('clamps to the last frame and to 0', () => {
    expect(stageFrameOf(9, 6)).toBe(5);
    expect(stageFrameOf(-2, 6)).toBe(0);
  });

  it('uses the ending frame when restored', () => {
    expect(stageFrameOf(4, 6, true, 5)).toBe(5);
    expect(stageFrameOf(0, 6, true, 5)).toBe(5);
  });

  it('uses the normal clamp when restored without an ending frame', () => {
    expect(stageFrameOf(2, 6, true)).toBe(2);
    expect(stageFrameOf(9, 6, true)).toBe(5);
  });
});

describe('echoAlpha', () => {
  const STEPS = [
    { untilS: 1.5, alpha: 1 },
    { untilS: 2.25, alpha: 0.66 },
    { untilS: 3, alpha: 0.33 },
  ] as const;

  it('steps down hard across the three windows', () => {
    expect(echoAlpha(0, STEPS)).toBe(1);
    expect(echoAlpha(1.6, STEPS)).toBe(0.66);
    expect(echoAlpha(2.3, STEPS)).toBe(0.33);
  });

  it('is 0 at and after the last window, and for null', () => {
    expect(echoAlpha(3.0, STEPS)).toBe(0);
    expect(echoAlpha(null, STEPS)).toBe(0);
  });

  it('moves a boundary value to the next step', () => {
    expect(echoAlpha(1.5, STEPS)).toBe(0.66);
  });
});

describe('mirrorAngle', () => {
  it('mirrors and wraps into [0, 360)', () => {
    expect(mirrorAngle(90)).toBe(270);
    expect(mirrorAngle(-45)).toBe(45);
    expect(mirrorAngle(725)).toBe(355);
  });

  it('returns +0 for 0 and 360 (never -0)', () => {
    expect(Object.is(mirrorAngle(0), -0)).toBe(false);
    expect(mirrorAngle(0)).toBe(0);
    expect(Object.is(mirrorAngle(360), -0)).toBe(false);
    expect(mirrorAngle(360)).toBe(0);
  });

  it('returns 0 for non-finite input', () => {
    expect(mirrorAngle(Number.NaN)).toBe(0);
    expect(mirrorAngle(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('milestonePhase', () => {
  it('is none without a milestone', () => {
    expect(milestonePhase(null, 1500, 2000)).toEqual({ phase: 'none', t01: 0 });
  });

  it('aligns over alignMs, then holds over holdMs, then ends', () => {
    expect(milestonePhase(0, 1500, 2000)).toEqual({ phase: 'align', t01: 0 });
    const half = milestonePhase(0.75, 1500, 2000);
    expect(half.phase).toBe('align');
    expect(half.t01).toBeCloseTo(0.5, 9);
    expect(milestonePhase(1.5, 1500, 2000)).toEqual({ phase: 'hold', t01: 0 });
    const mid = milestonePhase(2.5, 1500, 2000);
    expect(mid.phase).toBe('hold');
    expect(mid.t01).toBeCloseTo(0.5, 9);
    expect(milestonePhase(3.5, 1500, 2000)).toEqual({ phase: 'none', t01: 0 });
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
