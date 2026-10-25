// Tests for worldGlance (WP23a, WP23b): the seeded glance schedule (bible §7.6) for eras I-IV, the era gap ranges for k = 0..999,
// the four glance targets, determinism for a seed and a different sequence for another seed; and the era V double exposure
// schedule (30-60 s, the four whole-self targets, its own hash stream). Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { glanceSchedule, GLANCE_TARGETS, doubleExposureSchedule } from './worldGlance';
import type { DoubleExposureTarget } from './worldGlance';
import { WORLD_GLANCE, WORLD_GLANCE_SEED } from '../../data/livingWorld';
import { WORLD_DOUBLE_EXPOSURE } from '../../data/worldEras';

const SAMPLES = 1000;

describe('GLANCE_TARGETS', () => {
  it('lists the four glance denizens in order', () => {
    expect([...GLANCE_TARGETS]).toEqual(['inspector', 'dog', 'crow', 'payphone']);
  });
});

describe('glanceSchedule', () => {
  it('is deterministic for the same k, seed and era', () => {
    for (const era of [1, 2, 3, 4] as const) {
      for (let k = 0; k < 50; k++) {
        expect(glanceSchedule(k, WORLD_GLANCE_SEED, era)).toEqual(glanceSchedule(k, WORLD_GLANCE_SEED, era));
      }
    }
  });

  it('keeps every gap inside the era range, as a whole number of ms (k = 0..999)', () => {
    for (const era of [1, 2, 3, 4] as const) {
      const { minMs, maxMs } = WORLD_GLANCE[era];
      for (let k = 0; k < SAMPLES; k++) {
        const { afterMs } = glanceSchedule(k, WORLD_GLANCE_SEED, era);
        expect(Number.isInteger(afterMs)).toBe(true);
        expect(afterMs).toBeGreaterThanOrEqual(minMs);
        expect(afterMs).toBeLessThanOrEqual(maxMs);
      }
    }
  });

  it('gives era I and era II their own ranges (era I 6-9 min, era II 5-8 min)', () => {
    expect(WORLD_GLANCE[1]).toEqual({ minMs: 360000, maxMs: 540000 });
    expect(WORLD_GLANCE[2]).toEqual({ minMs: 300000, maxMs: 480000 });
  });

  it('gives era III and era IV their own ranges (era III 4-7 min, era IV 3-5 min)', () => {
    expect(WORLD_GLANCE[3]).toEqual({ minMs: 240000, maxMs: 420000 });
    expect(WORLD_GLANCE[4]).toEqual({ minMs: 180000, maxMs: 300000 });
  });

  it('spreads the era III and era IV gaps over the whole range (both ends reached within 5 %, k = 0..999)', () => {
    for (const era of [3, 4] as const) {
      const { minMs, maxMs } = WORLD_GLANCE[era];
      const span = maxMs - minMs;
      const gaps = [...new Set(Array.from({ length: SAMPLES }, (_, k) => glanceSchedule(k, WORLD_GLANCE_SEED, era).afterMs))];
      expect(gaps.length, `era ${era}`).toBeGreaterThan(SAMPLES / 2);
      expect(Math.min(...gaps), `era ${era} low end`).toBeLessThan(minMs + span * 0.05);
      expect(Math.max(...gaps), `era ${era} high end`).toBeGreaterThan(maxMs - span * 0.05);
    }
  });

  it('only returns the four targets, and uses each of them (k = 0..999)', () => {
    const counts = new Map<string, number>();
    for (let k = 0; k < SAMPLES; k++) {
      const { denizen } = glanceSchedule(k, WORLD_GLANCE_SEED, 1);
      expect(GLANCE_TARGETS).toContain(denizen);
      counts.set(denizen, (counts.get(denizen) ?? 0) + 1);
    }
    expect(counts.size).toBe(GLANCE_TARGETS.length);
    for (const target of GLANCE_TARGETS) expect(counts.get(target) ?? 0).toBeGreaterThan(0);
  });

  it('gives different sequences for different seeds', () => {
    const run = (seed: number): string[] => {
      const out: string[] = [];
      for (let k = 0; k < 20; k++) {
        const g = glanceSchedule(k, seed, 1);
        out.push(`${g.afterMs}:${g.denizen}`);
      }
      return out;
    };
    expect(run(WORLD_GLANCE_SEED)).not.toEqual(run(WORLD_GLANCE_SEED + 1));
    expect(run(WORLD_GLANCE_SEED)).toEqual(run(WORLD_GLANCE_SEED));
  });
});

describe('doubleExposureSchedule', () => {
  const seed = WORLD_DOUBLE_EXPOSURE.seed;

  it('keeps the era V schedule at 30-60 s with the four whole-self targets', () => {
    expect(WORLD_DOUBLE_EXPOSURE.minMs).toBe(30000);
    expect(WORLD_DOUBLE_EXPOSURE.maxMs).toBe(60000);
    expect([...WORLD_DOUBLE_EXPOSURE.targets]).toEqual(['inspector', 'dog', 'crow', 'girl']);
  });

  it('is deterministic for the same k and seed', () => {
    for (let k = 0; k < 50; k++) {
      expect(doubleExposureSchedule(k, seed)).toEqual(doubleExposureSchedule(k, seed));
    }
  });

  it('keeps every gap inside the range, as a whole number of ms (both ends inclusive, k = 0..999)', () => {
    const { minMs, maxMs } = WORLD_DOUBLE_EXPOSURE;
    for (let k = 0; k < SAMPLES; k++) {
      const { afterMs } = doubleExposureSchedule(k, seed);
      expect(Number.isInteger(afterMs)).toBe(true);
      expect(afterMs).toBeGreaterThanOrEqual(minMs);
      expect(afterMs).toBeLessThanOrEqual(maxMs);
    }
  });

  it('spreads the gaps over the whole range (both ends reached within 5 %, k = 0..999)', () => {
    const { minMs, maxMs } = WORLD_DOUBLE_EXPOSURE;
    const span = maxMs - minMs;
    const gaps = [...new Set(Array.from({ length: SAMPLES }, (_, k) => doubleExposureSchedule(k, seed).afterMs))];
    expect(gaps.length).toBeGreaterThan(SAMPLES / 2);
    expect(Math.min(...gaps)).toBeLessThan(minMs + span * 0.05);
    expect(Math.max(...gaps)).toBeGreaterThan(maxMs - span * 0.05);
  });

  it('only returns the listed targets, and uses each of them (k = 0..999)', () => {
    const counts = new Map<DoubleExposureTarget, number>();
    for (let k = 0; k < SAMPLES; k++) {
      const { target } = doubleExposureSchedule(k, seed);
      expect(WORLD_DOUBLE_EXPOSURE.targets).toContain(target);
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    expect(counts.size).toBe(WORLD_DOUBLE_EXPOSURE.targets.length);
    for (const target of WORLD_DOUBLE_EXPOSURE.targets) expect(counts.get(target) ?? 0).toBeGreaterThan(0);
  });

  it('gives different sequences for different seeds', () => {
    const run = (s: number): string[] => {
      const out: string[] = [];
      for (let k = 0; k < 20; k++) {
        const d = doubleExposureSchedule(k, s);
        out.push(`${d.afterMs}:${d.target}`);
      }
      return out;
    };
    expect(run(seed)).not.toEqual(run(seed + 1));
    expect(run(seed)).toEqual(run(seed));
  });
});
