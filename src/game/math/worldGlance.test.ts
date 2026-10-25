// Tests for worldGlance (WP23a): the seeded glance schedule (bible §7.6). Era gap ranges for k = 0..999, the four glance
// targets, determinism for a seed and a different sequence for another seed. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { glanceSchedule, GLANCE_TARGETS } from './worldGlance';
import { WORLD_GLANCE, WORLD_GLANCE_SEED } from '../../data/livingWorld';

const SAMPLES = 1000;

describe('GLANCE_TARGETS', () => {
  it('lists the four glance denizens in order', () => {
    expect([...GLANCE_TARGETS]).toEqual(['inspector', 'dog', 'crow', 'payphone']);
  });
});

describe('glanceSchedule', () => {
  it('is deterministic for the same k, seed and era', () => {
    for (const era of [1, 2] as const) {
      for (let k = 0; k < 50; k++) {
        expect(glanceSchedule(k, WORLD_GLANCE_SEED, era)).toEqual(glanceSchedule(k, WORLD_GLANCE_SEED, era));
      }
    }
  });

  it('keeps every gap inside the era range, as a whole number of ms (k = 0..999)', () => {
    for (const era of [1, 2] as const) {
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
