// Tests for worldTierPort (WP23 X1): the live port reads the WP22 maths (parity with partTierMap at every level of every track, a tech
// with no track is tier 1 and top 1, anyTop, the heartbeat phase on World scene time), the tracker offers DOG-04 and INS-13 through
// the port (and nothing through the stub), the hole stage follows the motorRetrofit tier, and a purity check (no Phaser, no DOM).
// Pure maths, no Phaser.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { PART_TIERS } from '../../data/machineTiers';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import { heartbeatLow, partTierMap, topTierOf, trackOf } from './partTiers';
import { WP22_TIER_PORT } from './worldTierPort';
import { createTierTracker, STUB_TIER_PORT } from './worldTierRules';
import { deriveWorldState } from './worldState';

function levelsOf(over: Partial<Record<TechId, number>> = {}): Record<TechId, number> {
  const out = {} as Record<TechId, number>;
  for (const id of TECH_IDS) out[id] = over[id] ?? 0;
  return out;
}

// Every other tech at level 0; the one named tech at the given level.
function levelsWith(id: TechId, level: number): Record<TechId, number> {
  const over: Partial<Record<TechId, number>> = {};
  over[id] = level;
  return levelsOf(over);
}

describe('tierOf and topTier against the WP22 maths', () => {
  it('equals partTierMap for every track at every level from 0 to the last threshold + 2', () => {
    for (const track of PART_TIERS) {
      const last = track.levels[track.levels.length - 1] ?? 0;
      for (let level = 0; level <= last + 2; level++) {
        const over: Partial<Record<TechId, number>> = {};
        over[track.techId] = level;
        const expected = partTierMap(over)[track.techId];
        expect(WP22_TIER_PORT.tierOf(track.techId, levelsOf(over))).toBe(expected);
        expect(WP22_TIER_PORT.topTier(track.techId)).toBe(topTierOf(track));
      }
    }
  });

  it('matches partTierMap with every track at the same level in one record', () => {
    for (let level = 0; level <= 30; level++) {
      const over: Partial<Record<TechId, number>> = {};
      for (const track of PART_TIERS) over[track.techId] = level;
      const levels = levelsOf(over);
      const map = partTierMap(over);
      for (const track of PART_TIERS) {
        expect(WP22_TIER_PORT.tierOf(track.techId, levels)).toBe(map[track.techId]);
      }
    }
  });

  it('reads the thresholds: improvedPistons tier 3 at level 10, motorTuning tier 5 at level 25', () => {
    expect(WP22_TIER_PORT.tierOf('improvedPistons', levelsWith('improvedPistons', 9))).toBe(2);
    expect(WP22_TIER_PORT.tierOf('improvedPistons', levelsWith('improvedPistons', 10))).toBe(3);
    expect(WP22_TIER_PORT.tierOf('motorTuning', levelsWith('motorTuning', 4))).toBe(1);
    expect(WP22_TIER_PORT.tierOf('motorTuning', levelsWith('motorTuning', 5))).toBe(2);
    expect(WP22_TIER_PORT.tierOf('motorTuning', levelsWith('motorTuning', 25))).toBe(5);
  });

  it('gives tier 1 and top 1 for a tech with no track', () => {
    for (const id of ['reinforcedCrank', 'horizonField'] as const) {
      expect(trackOf(id)).toBeUndefined();
      expect(WP22_TIER_PORT.tierOf(id, levelsWith(id, 50))).toBe(1);
      expect(WP22_TIER_PORT.topTier(id)).toBe(1);
    }
  });
});

describe('anyTop', () => {
  it('is false with no levels', () => {
    expect(WP22_TIER_PORT.anyTop(levelsOf())).toBe(false);
  });

  it('is true when motorTuning sits at its last threshold and false one level below', () => {
    expect(WP22_TIER_PORT.anyTop(levelsWith('motorTuning', 25))).toBe(true);
    expect(WP22_TIER_PORT.anyTop(levelsWith('motorTuning', 24))).toBe(false);
  });

  it('is true for each track at its top threshold (3- and 5-tier tracks) and false one level below', () => {
    for (const track of PART_TIERS) {
      const top = track.levels[track.levels.length - 1] ?? 0;
      expect(WP22_TIER_PORT.anyTop(levelsWith(track.techId, top))).toBe(true);
      expect(WP22_TIER_PORT.anyTop(levelsWith(track.techId, top - 1))).toBe(false);
    }
  });
});

describe('heartbeatLow', () => {
  const SAMPLES = [0, 1199, 1200, 2399, 2400, 3600] as const;

  it('equals partTiers heartbeatLow at each sample', () => {
    for (const ms of SAMPLES) {
      expect(WP22_TIER_PORT.heartbeatLow(ms)).toBe(heartbeatLow(ms));
    }
  });

  it('is low in the second half of each 2400 ms period', () => {
    expect(SAMPLES.map((ms) => WP22_TIER_PORT.heartbeatLow(ms))).toEqual([false, false, true, true, false, true]);
  });
});

describe('createTierTracker over WP22_TIER_PORT', () => {
  it('offers DOG-04 at improvedPistons 10 on each close until DOG-04 is seen, and nothing at 9', () => {
    expect(createTierTracker(WP22_TIER_PORT).onIndexClose(levelsWith('improvedPistons', 9), 0).offers).toEqual([]);
    const t = createTierTracker(WP22_TIER_PORT);
    expect(t.onIndexClose(levelsWith('improvedPistons', 10), 0).offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
    expect(t.onIndexClose(levelsWith('improvedPistons', 10), 100).offers).toEqual([{ kind: 'tier', techId: 'improvedPistons', tier: 3 }]);
    const seen = createTierTracker(WP22_TIER_PORT, undefined, (id) => id === 'DOG-04');
    expect(seen.onIndexClose(levelsWith('improvedPistons', 10), 100).offers).toEqual([]);
  });

  it('offers the first top tier on each close at motorTuning 25 until INS-13 is seen, and turns the heartbeat on', () => {
    const t = createTierTracker(WP22_TIER_PORT);
    expect(t.heartbeat()).toBe(false);
    expect(t.onIndexClose(levelsWith('motorTuning', 24), 0).offers).toEqual([]);
    const top = t.onIndexClose(levelsWith('motorTuning', 25), 0);
    expect(top.offers).toEqual([{ kind: 'tier', firstTop: true }]);
    expect(top.heartbeat).toBe(true);
    expect(t.heartbeat()).toBe(true);
    expect(t.onIndexClose(levelsWith('motorTuning', 25), 100).offers).toEqual([{ kind: 'tier', firstTop: true }]);
    const seen = createTierTracker(WP22_TIER_PORT, undefined, (id) => id === 'INS-13');
    expect(seen.onIndexClose(levelsWith('motorTuning', 25), 100).offers).toEqual([]);
  });

  it('offers nothing through the stub, so the binding is what offers them', () => {
    expect(createTierTracker(STUB_TIER_PORT).onIndexClose(levelsWith('improvedPistons', 10), 0).offers).toEqual([]);
    const stub = createTierTracker(STUB_TIER_PORT);
    expect(stub.onIndexClose(levelsWith('motorTuning', 25), 0).offers).toEqual([]);
    expect(stub.heartbeat()).toBe(false);
  });
});

describe('hole stage through the port', () => {
  it('is 2 / 3 / 4 at motorRetrofit 8 / 13 / 18 (tiers 3 / 4 / 5) once load-beneath EE is reached, and 0 below it', () => {
    const stage = (level: number, lifetimeEe: number): number => {
      const levels = levelsWith('motorRetrofit', level);
      return deriveWorldState({
        levels,
        lifetimeEe,
        cycle: 1,
        edition: 'full',
        dogLies: false,
        motorRetrofitTier: WP22_TIER_PORT.tierOf('motorRetrofit', levels),
        phase: 'none',
      }).props.holeStage;
    };
    expect([8, 13, 18].map((level) => stage(level, 100000))).toEqual([2, 3, 4]);
    expect(stage(18, 99999)).toBe(0);
  });
});

describe('worldTierPort purity', () => {
  it('stays free of Phaser and DOM globals', () => {
    const src = readFileSync(new URL('./worldTierPort.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*phaser/i);
    expect(src).not.toContain('document.');
    expect(src).not.toContain('window.');
  });
});
