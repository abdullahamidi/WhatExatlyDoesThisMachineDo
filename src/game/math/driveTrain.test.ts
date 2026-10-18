import { describe, it, expect } from 'vitest';
import type { Vec2 } from '../../data/machineComponents';
import {
  addClickImpulse,
  stepMaster,
  partAngle,
  sliderCrank,
  meshPhaseError,
} from './driveTrain';
import type { GearMesh, MasterState } from './driveTrain';

/** Seeded linear congruential generator in [0, 1). No Math.random. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Uniform value in [lo, hi) from a generator. */
function uniform(rand: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * rand();
}

const FRAME = 1 / 60; // seconds per frame at 60 fps

/** Runs n steps of the master with the given drift, impulse decay and direction. */
function run(s: MasterState, n: number, degPerSec: number, direction: 1 | -1, tau: number): MasterState {
  let state = s;
  for (let i = 0; i < n; i++) state = stepMaster(state, degPerSec, direction, FRAME, tau);
  return state;
}

describe('sliderCrank', () => {
  const centre: Vec2 = { x: -44, y: -56 };
  const angles = Array.from({ length: 72 }, (_, i) => i * 5);

  it('keeps the rod length between pin and slider', () => {
    for (const a of angles) {
      const { pin, slider } = sliderCrank(centre, 5, 69, a);
      expect(Math.hypot(pin.x - slider.x, pin.y - slider.y)).toBeCloseTo(69, 9);
    }
  });

  it('keeps the slider on the guide x', () => {
    for (const a of angles) {
      expect(sliderCrank(centre, 5, 69, a).slider.x).toBe(centre.x);
    }
  });

  it('sweeps the slider between about -130 and -120', () => {
    const ys = angles.map((a) => sliderCrank(centre, 5, 69, a).slider.y);
    expect(Math.min(...ys)).toBeCloseTo(-130, 0);
    expect(Math.max(...ys)).toBeCloseTo(-120, 0);
    expect(Math.abs(Math.min(...ys) + 130)).toBeLessThan(0.1);
    expect(Math.abs(Math.max(...ys) + 120)).toBeLessThan(0.1);
  });

  it('puts the pin at angle 0 on the right of the centre', () => {
    const { pin } = sliderCrank(centre, 5, 69, 0);
    expect(pin.x).toBeCloseTo(-39, 9);
    expect(pin.y).toBeCloseTo(-56, 9);
  });

  it('gives the pin y as the slider y when the rod is shorter than the pin offset', () => {
    const { pin, slider } = sliderCrank({ x: 0, y: 0 }, 5, 3, 0);
    expect(Number.isNaN(slider.y)).toBe(false);
    expect(slider.y).toBeCloseTo(pin.y, 9);
  });
});

describe('stepMaster', () => {
  it('releases one impulse fully and conserves it', () => {
    const s = addClickImpulse({ deg: 0, pending: 0 }, 90, -1.75);
    expect(s.pending).toBeCloseTo(-51.4285714285714, 9);
    const done = run(s, 36, 0, 1, 0.05);
    expect(done.pending).toBe(0);
    expect(done.deg).toBeCloseTo(-51.428571, 6);
  });

  it('releases about 99% of the impulse within 0.25 s', () => {
    const s = addClickImpulse({ deg: 0, pending: 0 }, 90, -1.75);
    const partial = run(s, 15, 0, 1, 0.05);
    expect(Math.abs(partial.deg + 51.4285714)).toBeLessThan(0.05 * 51.4285714); // within 5% of the total
  });

  it('returns the state unchanged for dt 0 or negative dt', () => {
    const s: MasterState = { deg: 12, pending: -20 };
    expect(stepMaster(s, 60, 1, 0, 0.05)).toEqual(s);
    expect(stepMaster(s, 60, 1, -0.5, 0.05)).toEqual(s);
  });

  it('returns the state unchanged for NaN dt, degPerSec, tau or deg', () => {
    const s: MasterState = { deg: 12, pending: -20 };
    expect(stepMaster(s, 60, 1, Number.NaN, 0.05)).toEqual(s);
    expect(stepMaster(s, Number.NaN, 1, FRAME, 0.05)).toEqual(s);
    expect(stepMaster(s, 60, 1, FRAME, Number.NaN)).toEqual(s);
    expect(stepMaster({ deg: Number.NaN, pending: 0 }, 60, 1, FRAME, 0.05)).toEqual({ deg: Number.NaN, pending: 0 });
  });

  it('adds three queued impulses to 90 deg', () => {
    let s: MasterState = { deg: 0, pending: 0 };
    s = addClickImpulse(s, 30, 1);
    s = addClickImpulse(s, 45, 1);
    s = addClickImpulse(s, 15, 1);
    const done = run(s, 60, 0, 1, 0.05);
    expect(done.deg).toBeCloseTo(90, 6);
    expect(done.pending).toBe(0);
  });

  it('drifts with direction and speed when nothing is queued', () => {
    const s = stepMaster({ deg: 0, pending: 0 }, 60, -1, 0.5, 0.05);
    expect(s.deg).toBeCloseTo(-30, 9);
    expect(s.pending).toBe(0);
  });

  it('never returns -0 in pending', () => {
    const s = stepMaster({ deg: 0, pending: -0 }, 0, 1, FRAME, 0.05);
    expect(Object.is(s.pending, -0)).toBe(false);
    expect(Object.is(s.deg, -0)).toBe(false);
  });
});

describe('addClickImpulse', () => {
  it('returns the state unchanged for ratio 0 or NaN and never mutates its input', () => {
    const s: MasterState = { deg: 1, pending: 2 };
    const copy: MasterState = { deg: 1, pending: 2 };
    expect(addClickImpulse(s, 90, 0)).toBe(s);
    expect(addClickImpulse(s, 90, Number.NaN)).toBe(s);
    expect(addClickImpulse(s, Number.NaN, 1)).toBe(s);
    expect(s).toEqual(copy);
  });

  it('adds crankDeg / ratio to pending and returns a new object', () => {
    const s: MasterState = { deg: 1, pending: 2 };
    const out = addClickImpulse(s, 90, -1.75);
    expect(out).not.toBe(s);
    expect(out.deg).toBe(1);
    expect(out.pending).toBeCloseTo(2 - 90 / 1.75, 9);
    expect(s).toEqual({ deg: 1, pending: 2 });
  });
});

describe('partAngle', () => {
  const ratios = [1, -1.75, -2.1875, 2];

  it('stays in [0, 360) for seeded random masters', () => {
    const rand = lcg(7);
    for (const ratio of ratios) {
      for (let i = 0; i < 200; i++) {
        const master = uniform(rand, -1e5, 1e5);
        const a = partAngle(master, ratio, 0);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(360);
      }
    }
  });

  it('returns +0 for zero', () => {
    expect(Object.is(partAngle(0, 1, 0), 0)).toBe(true);
  });

  it('wraps negative and full-turn masters', () => {
    expect(partAngle(-90, 1, 0)).toBe(270);
    expect(partAngle(360, 1, 0)).toBe(0);
  });

  it('brings the crank back to about 90 deg after one click', () => {
    expect(partAngle(-51.4285714285714, -1.75, 0)).toBeCloseTo(90, 6);
  });

  it('returns 0 for NaN', () => {
    expect(partAngle(Number.NaN, 1, 0)).toBe(0);
    expect(partAngle(10, Number.NaN, 0)).toBe(0);
  });
});

describe('meshPhaseError', () => {
  const large: GearMesh = { ratio: 1, phaseDeg: 0, teeth: 14 };
  const small: GearMesh = { ratio: -1.75, phaseDeg: 22.5, teeth: 8 };

  it('is zero for seeded random masters', () => {
    const rand = lcg(11);
    for (let i = 0; i < 1000; i++) {
      const master = uniform(rand, -1e4, 1e4);
      expect(meshPhaseError(master, large, small)).toBeLessThan(1e-9);
    }
  });

  it('is zero at master 0', () => {
    expect(meshPhaseError(0, large, small)).toBeLessThan(1e-9);
  });

  it('is large at master 0 when the small phase is 0', () => {
    expect(meshPhaseError(0, large, { ...small, phaseDeg: 0 })).toBeGreaterThan(0.1);
  });

  it('stays in [0, 0.5]', () => {
    const rand = lcg(3);
    for (let i = 0; i < 500; i++) {
      const master = uniform(rand, -1e4, 1e4);
      const phase = uniform(rand, -360, 360);
      const e = meshPhaseError(master, large, { ...small, phaseDeg: phase });
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(0.5);
    }
  });
});
