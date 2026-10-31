// Tests for the world props' reach maths (WP28b, D6 b, c; r1-FX1): the lamp wobble, the era IV hum, the era I pebble count and the era IV puddle
// ring gaps. Moved from worldReach.test.ts with their maths (math/worldFx.ts). Pure maths, no Phaser. The numbers come from src/data/worldFx.ts.
import { describe, expect, it } from 'vitest';
import { humOffsetPx, lampWobbleAt, pebbleCount, puddleRingGapMs } from './worldFx';
import { REACH_FX } from '../../data/worldReach';
import { WORLD_FX } from '../../data/worldFx';

const MS_PER_SECOND = 1000;
const SIM_MS = 10 * MS_PER_SECOND;

// Sign flips of the hum per second over 10 s of 1 ms samples at one level.
function humFlipsPerS(level01: number): number {
  let flips = 0;
  let prev = 0;
  for (let t = 0; t <= SIM_MS; t++) {
    const v = Math.sign(humOffsetPx(level01, t, 0));
    if (v !== 0 && prev !== 0 && v !== prev) flips++;
    if (v !== 0) prev = v;
  }
  return flips / (SIM_MS / MS_PER_SECOND);
}

describe('lamp wobble (D6 b)', () => {
  it('lamp wobble stays inside maxAmp x L and cycles at about lampWobble.hz (at most maxFlashHz)', () => {
    let peak = 0;
    let ups = 0;
    let prev = lampWobbleAt(0, 1);
    for (let t = 1; t <= SIM_MS; t++) {
      const v = lampWobbleAt(t, 1);
      peak = Math.max(peak, Math.abs(v));
      if (prev < 0 && v >= 0) ups++;
      prev = v;
    }
    const perS = ups / (SIM_MS / MS_PER_SECOND);
    expect(peak).toBeLessThanOrEqual(WORLD_FX.lampWobble.maxAmp + 1e-12);
    expect(peak).toBeGreaterThan(WORLD_FX.lampWobble.maxAmp * 0.99);
    expect(perS).toBeGreaterThan(1.1);
    expect(perS).toBeLessThan(1.4);
    expect(perS).toBeLessThanOrEqual(REACH_FX.maxFlashHz);
    expect(lampWobbleAt(250, 0)).toBe(0);
  });
});

describe('hum, pebbles and puddles (D6 b, c)', () => {
  it('the hum is 0 up to startLevel, 1 px to strongLevel and 2 px above', () => {
    const peakAt = (L: number): number => {
      let m = 0;
      for (let t = 0; t < SIM_MS; t += 7) m = Math.max(m, Math.abs(humOffsetPx(L, t, 0)));
      return m;
    };
    expect(peakAt(0)).toBe(0);
    expect(peakAt(0.3)).toBe(0);
    expect(peakAt(0.31)).toBe(1);
    expect(peakAt(0.85)).toBe(1);
    expect(peakAt(0.86)).toBe(2);
    expect(peakAt(1)).toBe(2);
  });

  it('the hum sign flips 2-4 times a second across the level range', () => {
    for (const L of [0.31, 0.5, 0.71, 1]) {
      const flips = humFlipsPerS(L);
      expect(flips).toBeGreaterThanOrEqual(2);
      expect(flips).toBeLessThanOrEqual(4);
    }
  });

  it('pebbleCount is 2 below minLevel and 2..6 above it', () => {
    expect(pebbleCount(0)).toBe(2);
    expect(pebbleCount(0.09)).toBe(2);
    expect(pebbleCount(0.25)).toBe(3);
    expect(pebbleCount(0.5)).toBe(4);
    expect(pebbleCount(1)).toBe(6);
    expect(pebbleCount(NaN)).toBe(2);
    for (let L = 0; L <= 1; L += 0.01) {
      const c = pebbleCount(L);
      expect(c).toBeGreaterThanOrEqual(2);
      expect(c).toBeLessThanOrEqual(6);
    }
  });

  it('puddle ring gaps sit inside everyMs, vary, and repeat for the same counters', () => {
    const [lo, hi] = WORLD_FX.puddleRing.everyMs;
    const gaps: number[] = [];
    for (let k = 0; k < 200; k++) gaps.push(puddleRingGapMs(k, 3));
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(lo);
      expect(g).toBeLessThanOrEqual(hi);
    }
    expect(new Set(gaps).size).toBeGreaterThan(100);
    expect(puddleRingGapMs(5, 3)).toBe(puddleRingGapMs(5, 3));
    const nan = puddleRingGapMs(NaN, NaN);
    expect(nan).toBeGreaterThanOrEqual(lo);
    expect(nan).toBeLessThanOrEqual(hi);
  });
});
