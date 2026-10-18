import { describe, it, expect } from 'vitest';
import { emitterActive, emitterRate, stepEmitter, burstDelaySeconds, puffState, burstPoints } from './steamFx';
import type { PuffFx } from './steamFx';
import type { Vec2 } from '../../data/machineComponents';
import { STEAM_EMITTERS } from '../../data/steamFx';
import type { SteamEmitter } from '../../data/steamFx';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';

// Local literals shaped like the data contract (the pure-maths cases avoid the data; the emitterActive
// acceptance cases at the end read the real STEAM_EMITTERS).
const CHIMNEY_RATE = { kind: 'rate', base: 0.4, perLog: 0.3, min: 0.4, max: 2 } as const;
const BURST = { kind: 'burst', count: 4, spacingMs: 120, everyMinS: 6, everyMaxS: 9, minDriver: 50 } as const;
const STRIKE = { kind: 'strike' } as const;

/** Every tech at level 0, with `over` applied. */
function levels(over: Partial<Record<TechId, number>> = {}): Record<TechId, number> {
  const base = Object.fromEntries(TECH_IDS.map((id) => [id, 0])) as Record<TechId, number>;
  return { ...base, ...over };
}

function emitterNamed(id: string): SteamEmitter {
  const found = STEAM_EMITTERS.find((e) => e.id === id);
  if (!found) throw new Error(`missing emitter ${id}`);
  return found;
}

const PUFF: PuffFx = {
  lifeMs: 1200,
  frames: 4,
  riseArtPx: 12,
  driftArtPxPerS: 4,
  scaleFrom: 1,
  scaleTo: 1.5,
  fadeFrom: 0.75,
};

describe('emitterActive', () => {
  const gated = { gate: { techId: 'boiler', minLevel: 1 } } as const;
  const gatedUntil = { ...gated, until: { techId: 'pressureResonator', minLevel: 1 } } as const;

  it('is active when the gate is met and there is no until', () => {
    expect(emitterActive(gated, levels({ boiler: 1 }))).toBe(true);
    expect(emitterActive(gated, levels({ boiler: 3 }))).toBe(true);
  });

  it('is inactive while the gate is unmet', () => {
    expect(emitterActive(gated, levels())).toBe(false);
    expect(emitterActive(gatedUntil, levels())).toBe(false);
  });

  it('stays active while the until tech is below its minLevel, and goes quiet once it reaches it', () => {
    expect(emitterActive(gatedUntil, levels({ boiler: 1, pressureResonator: 0 }))).toBe(true);
    expect(emitterActive(gatedUntil, levels({ boiler: 1, pressureResonator: 1 }))).toBe(false);
    expect(emitterActive(gatedUntil, levels({ boiler: 1, pressureResonator: 2 }))).toBe(false);
  });

  it('manifold is active before pressureResonator 1 and inactive at pressureResonator 1', () => {
    const manifold = emitterNamed('manifold');
    expect(emitterActive(manifold, levels({ boiler: 1, pressureResonator: 0 }))).toBe(true);
    expect(emitterActive(manifold, levels({ boiler: 1, pressureResonator: 1 }))).toBe(false);
  });

  it('manifold stays inactive without its boiler gate, whatever pressureResonator is', () => {
    expect(emitterActive(emitterNamed('manifold'), levels({ pressureResonator: 0 }))).toBe(false);
  });

  it('calliope is active at pressureResonator 1 (its gate, no until)', () => {
    expect(emitterActive(emitterNamed('calliope'), levels({ pressureResonator: 1 }))).toBe(true);
  });

  it('calliope is inactive at pressureResonator 0', () => {
    expect(emitterActive(emitterNamed('calliope'), levels({ pressureResonator: 0 }))).toBe(false);
  });
});

describe('emitterRate', () => {
  it('clamps the chimney curve at its minimum for an idle driver', () => {
    expect(emitterRate(CHIMNEY_RATE, 0)).toBeCloseTo(0.4, 9);
  });

  it('follows base + perLog * log10(1 + v) between the clamps', () => {
    expect(emitterRate(CHIMNEY_RATE, 9)).toBeCloseTo(0.4 + 0.3 * 1, 9);
  });

  it('clamps at the maximum for a huge driver', () => {
    expect(emitterRate(CHIMNEY_RATE, 1e9)).toBeCloseTo(2, 9);
  });

  it('treats negative and non-finite drivers as 0 (base clamped)', () => {
    expect(emitterRate(CHIMNEY_RATE, -5)).toBeCloseTo(0.4, 9);
    expect(emitterRate(CHIMNEY_RATE, NaN)).toBeCloseTo(0.4, 9);
    expect(emitterRate(CHIMNEY_RATE, Infinity)).toBeCloseTo(0.4, 9);
    expect(emitterRate(CHIMNEY_RATE, -Infinity)).toBeCloseTo(0.4, 9);
    expect(emitterRate({ kind: 'rate', base: 0.1, perLog: 0.3, min: 0.4, max: 2 }, NaN)).toBeCloseTo(0.4, 9);
  });

  it('gives 0 for burst and strike emitters', () => {
    expect(emitterRate(BURST, 0)).toBe(0);
    expect(emitterRate(BURST, 1e9)).toBe(0);
    expect(emitterRate(STRIKE, 0)).toBe(0);
    expect(emitterRate(STRIKE, 1e9)).toBe(0);
  });

  it('is monotone non-decreasing in the driver', () => {
    let prev = -Infinity;
    for (let v = 0; v <= 1000; v += 7) {
      const r = emitterRate(CHIMNEY_RATE, v);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });
});

describe('stepEmitter', () => {
  it('spawns exactly 20 puffs for rate 2 over 20 steps of 0.5 s', () => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const step = stepEmitter(acc, 2, 0.5);
      acc = step.acc;
      total += step.spawn;
    }
    expect(total).toBe(20);
  });

  it('spawns exactly 4 puffs for rate 0.4 over 40 steps of 0.25 s (float guard)', () => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      const step = stepEmitter(acc, 0.4, 0.25);
      acc = step.acc;
      total += step.spawn;
    }
    expect(total).toBe(4);
  });

  it('keeps acc in [0, 1) after every call', () => {
    let acc = 0;
    for (let i = 0; i < 500; i++) {
      const step = stepEmitter(acc, 0.4, 0.25);
      acc = step.acc;
      expect(acc).toBeGreaterThanOrEqual(0);
      expect(acc).toBeLessThan(1);
    }
  });

  it('changes nothing for a non-positive rate or dt', () => {
    expect(stepEmitter(0.3, 0, 1)).toEqual({ acc: 0.3, spawn: 0 });
    expect(stepEmitter(0.3, -2, 1)).toEqual({ acc: 0.3, spawn: 0 });
    expect(stepEmitter(0.3, 2, 0)).toEqual({ acc: 0.3, spawn: 0 });
    expect(stepEmitter(0.3, 2, -1)).toEqual({ acc: 0.3, spawn: 0 });
  });

  it('spawns 3 and carries about 0.7 for one big step (3.7 s at rate 1)', () => {
    const step = stepEmitter(0, 1, 3.7);
    expect(step.spawn).toBe(3);
    expect(step.acc).toBeCloseTo(0.7, 9);
  });
});

describe('burstDelaySeconds', () => {
  it('stays inside [min, max] for indices 0..199', () => {
    for (let i = 0; i < 200; i++) {
      const d = burstDelaySeconds(i, 6, 9);
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThanOrEqual(9);
    }
  });

  it('is deterministic for the same index', () => {
    for (let i = 0; i < 50; i++) {
      expect(burstDelaySeconds(i, 6, 9)).toBe(burstDelaySeconds(i, 6, 9));
    }
  });

  it('spreads over at least 10 distinct values', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(burstDelaySeconds(i, 6, 9));
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });

  it('returns min when min equals max', () => {
    for (let i = 0; i < 20; i++) {
      expect(burstDelaySeconds(i, 7.5, 7.5)).toBe(7.5);
    }
  });
});

describe('burstPoints', () => {
  const a: Vec2 = { x: -72, y: -193 };
  const b: Vec2 = { x: -44, y: -193 };
  const c: Vec2 = { x: -16, y: -194 };
  const P: readonly Vec2[] = [a, b, c];

  it('uses every point in turn for a null single point', () => {
    expect(burstPoints(P, 3, null)).toEqual([a, b, c]);
    expect(burstPoints(P, 6, null)).toEqual([a, b, c, a, b, c]);
  });

  it('puts every puff on one point for a single index', () => {
    expect(burstPoints(P, 2, 1)).toEqual([b, b]);
  });

  it('normalises the single index modulo the point count', () => {
    expect(burstPoints(P, 2, 4)).toEqual([b, b]);
    expect(burstPoints(P, 2, -1)).toEqual([c, c]);
  });

  it('gives nothing for no points or a count of zero or less', () => {
    expect(burstPoints([], 3, null)).toEqual([]);
    expect(burstPoints([], 3, 0)).toEqual([]);
    expect(burstPoints(P, 0, null)).toEqual([]);
    expect(burstPoints(P, -2, 1)).toEqual([]);
  });

  it('returns the same point objects as the input', () => {
    const out = burstPoints(P, 3, null);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
    expect(out[2]).toBe(c);
    expect(burstPoints(P, 2, 2)[0]).toBe(c);
  });
});

describe('puffState', () => {
  it('starts at frame 0, no offset, scale 1, alpha 1, not done', () => {
    expect(puffState(0, PUFF)).toEqual({ frame: 0, dx: 0, dy: 0, scale: 1, alpha: 1, done: false });
  });

  it('steps frames every life / frames (300 ms here)', () => {
    expect(puffState(299, PUFF).frame).toBe(0);
    expect(puffState(300, PUFF).frame).toBe(1);
    expect(puffState(900, PUFF).frame).toBe(3);
  });

  it('keeps alpha 1 until the fade starts (900 ms), then fades', () => {
    expect(puffState(900, PUFF).alpha).toBeCloseTo(1, 9);
    expect(puffState(1050, PUFF).alpha).toBeCloseTo(0.5, 9);
  });

  it('is nearly transparent and not done just before the end', () => {
    const s = puffState(1199, PUFF);
    expect(s.alpha).toBeLessThan(0.01);
    expect(s.done).toBe(false);
  });

  it('is transparent and done at the end of life', () => {
    const s = puffState(1200, PUFF);
    expect(s.alpha).toBe(0);
    expect(s.done).toBe(true);
  });

  it('rises riseArtPx at half life', () => {
    expect(puffState(600, PUFF).dy).toBeCloseTo(-6, 9);
  });

  it('drifts driftArtPxPerS per second', () => {
    expect(puffState(1000, PUFF).dx).toBeCloseTo(4, 9);
  });

  it('scales linearly from scaleFrom to scaleTo', () => {
    expect(puffState(600, PUFF).scale).toBeCloseTo(1.25, 9);
  });

  it('treats negative and NaN ages as 0', () => {
    expect(puffState(-50, PUFF)).toEqual(puffState(0, PUFF));
    expect(puffState(NaN, PUFF)).toEqual(puffState(0, PUFF));
  });
});
