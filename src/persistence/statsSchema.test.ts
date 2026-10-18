import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_IDS } from '../data/achievements';
import { RESOURCE_IDS } from '../data/types';
import type { GameState, ResourceMap, StatsState } from '../data/types';
import { createInitialState } from '../simulation/state';
import { deriveStats, emptyStats } from '../simulation/stats';
import { emptyResourceMap } from '../simulation/resources';
import { readAchievements, readStats } from './schema';

const NOW = 1_700_000_000_000;

const resources = (values: Partial<ResourceMap> = {}): ResourceMap => ({ ...emptyResourceMap(), ...values });

/** A state whose derived stats are easy to tell apart from the fresh defaults. */
const sourceState = (): GameState => ({
  ...createInitialState(NOW),
  totalClicks: 9,
  res: resources({ me: 3 }),
  lifetime: resources({ me: 50, ee: 4 }),
  createdAt: NOW - 1000,
});

const validStats = (): StatsState => ({
  activeSeconds: 3600,
  offlineSeconds: 600,
  longestOfflineSeconds: 500,
  clicks: 30,
  purchases: 4,
  lifetime: resources({ me: 60, pr: 2 }),
  maxPerSecond: resources({ me: 1.25 }),
  cycles: 2,
  bestCycleSeconds: 1800,
  startedAt: NOW - 5000,
});

describe('readStats: missing or non-object block', () => {
  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
    ['array', [1, 2]],
    ['number', 5],
    ['string', 'x'],
  ])('%s -> derived stats', (_name, input) => {
    const state = sourceState();
    expect(readStats(input, state, NOW)).toEqual(deriveStats(state, NOW));
  });

  it('derived stats take clicks from totalClicks and lifetime from the state', () => {
    const derived = readStats(undefined, sourceState(), NOW);
    expect(derived.clicks).toBe(9);
    expect(derived.lifetime).toEqual(resources({ me: 50, ee: 4 }));
    expect(derived.maxPerSecond).toEqual(emptyResourceMap());
    expect(derived.cycles).toBe(1);
    expect(derived.bestCycleSeconds).toBeNull();
    expect(derived.startedAt).toBe(NOW - 1000);
  });

  it('falls back to nowMs for startedAt when createdAt is not usable', () => {
    const state = { ...sourceState(), createdAt: Number.NaN };
    expect(readStats(undefined, state, NOW).startedAt).toBe(NOW);
  });
});

describe('readStats: a valid block is kept', () => {
  it('returns every field unchanged', () => {
    expect(readStats(validStats(), sourceState(), NOW)).toEqual(validStats());
  });

  it('returns a new object and never mutates the input', () => {
    const input = validStats();
    const before = JSON.stringify(input);
    const out = readStats(input, sourceState(), NOW);
    expect(out).not.toBe(input);
    expect(out.lifetime).not.toBe(input.lifetime);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('readStats: per-field lenient table', () => {
  const durationFields = ['activeSeconds', 'offlineSeconds', 'longestOfflineSeconds', 'startedAt'] as const;
  const countFields = ['clicks', 'purchases', 'cycles'] as const;

  const badValues: Array<[string, unknown]> = [
    ['null (NaN in JSON)', null],
    ['string', 'ten'],
    ['negative', -4],
    ['object', { x: 1 }],
    ['boolean', true],
  ];

  it.each(durationFields.flatMap((field) => badValues.map(([label, value]) => [field, label, value] as const)))(
    '%s with %s -> derived value',
    (field, _label, value) => {
      const state = sourceState();
      const derived = deriveStats(state, NOW);
      const out = readStats({ ...validStats(), [field]: value }, state, NOW);
      expect(out[field]).toBe(derived[field]);
    },
  );

  it.each(countFields.flatMap((field) => badValues.map(([label, value]) => [field, label, value] as const)))(
    '%s with %s -> derived value',
    (field, _label, value) => {
      const state = sourceState();
      const derived = deriveStats(state, NOW);
      const out = readStats({ ...validStats(), [field]: value }, state, NOW);
      expect(out[field]).toBe(derived[field]);
    },
  );

  it('floors fractional counts', () => {
    const out = readStats({ ...validStats(), clicks: 12.9, purchases: 3.2, cycles: 2.5 }, sourceState(), NOW);
    expect(out.clicks).toBe(12);
    expect(out.purchases).toBe(3);
    expect(out.cycles).toBe(2);
  });

  it('keeps zero as a valid value for every duration and count', () => {
    const zeros = {
      ...validStats(),
      activeSeconds: 0,
      offlineSeconds: 0,
      longestOfflineSeconds: 0,
      clicks: 0,
      purchases: 0,
      cycles: 0,
    };
    const out = readStats(zeros, sourceState(), NOW);
    expect(out.activeSeconds).toBe(0);
    expect(out.clicks).toBe(0);
    expect(out.cycles).toBe(0);
  });

  it('bestCycleSeconds: null and finite >= 0 are kept; anything else is the derived null', () => {
    const state = sourceState();
    expect(readStats({ ...validStats(), bestCycleSeconds: null }, state, NOW).bestCycleSeconds).toBeNull();
    expect(readStats({ ...validStats(), bestCycleSeconds: 0 }, state, NOW).bestCycleSeconds).toBe(0);
    expect(readStats({ ...validStats(), bestCycleSeconds: 1800 }, state, NOW).bestCycleSeconds).toBe(1800);
    expect(readStats({ ...validStats(), bestCycleSeconds: -1 }, state, NOW).bestCycleSeconds).toBeNull();
    expect(readStats({ ...validStats(), bestCycleSeconds: 'fast' }, state, NOW).bestCycleSeconds).toBeNull();
    const { bestCycleSeconds: _omitted, ...withoutBest } = validStats();
    expect(readStats(withoutBest, state, NOW).bestCycleSeconds).toBeNull();
  });

  it('a missing field takes its derived value', () => {
    const state = sourceState();
    const { clicks: _clicks, lifetime: _lifetime, ...partial } = validStats();
    const out = readStats(partial, state, NOW);
    expect(out.clicks).toBe(9);
    expect(out.lifetime).toEqual(resources({ me: 50, ee: 4 }));
    expect(out.activeSeconds).toBe(3600);
  });
});

describe('readStats: resource maps per key', () => {
  it('keeps valid keys and falls back per key for invalid ones', () => {
    const state = sourceState();
    const out = readStats(
      {
        ...validStats(),
        lifetime: { me: 'ten', ee: -1, pr: 7, gold: 99 },
        maxPerSecond: { me: null, rs: 3.5 },
      },
      state,
      NOW,
    );
    expect(out.lifetime.me).toBe(state.lifetime.me);
    expect(out.lifetime.ee).toBe(state.lifetime.ee);
    expect(out.lifetime.pr).toBe(7);
    expect(out.lifetime).not.toHaveProperty('gold');
    expect(Object.keys(out.lifetime)).toHaveLength(RESOURCE_IDS.length);
    expect(out.maxPerSecond.me).toBe(0);
    expect(out.maxPerSecond.rs).toBe(3.5);
  });

  it('a non-object map takes the derived values', () => {
    const state = sourceState();
    const out = readStats({ ...validStats(), lifetime: 'x', maxPerSecond: [1] }, state, NOW);
    expect(out.lifetime).toEqual(state.lifetime);
    expect(out.maxPerSecond).toEqual(emptyResourceMap());
  });
});

describe('readAchievements', () => {
  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
    ['array', []],
    ['number', 3],
    ['no unlocked key', {}],
    ['unlocked is an array', { unlocked: [] }],
    ['unlocked is a number', { unlocked: 5 }],
  ])('%s -> no achievements', (_name, input) => {
    expect(readAchievements(input)).toEqual({ unlocked: {} });
  });

  it('keeps known ids with finite timestamps', () => {
    const out = readAchievements({ unlocked: { firstTurn: NOW, steadyHand: 0, blueprint: NOW + 5 } });
    expect(out).toEqual({ unlocked: { firstTurn: NOW, steadyHand: 0, blueprint: NOW + 5 } });
  });

  it('drops unknown ids', () => {
    const out = readAchievements({ unlocked: { firstTurn: NOW, notAnAchievement: NOW, toString: NOW } });
    expect(out).toEqual({ unlocked: { firstTurn: NOW } });
    expect(Object.keys(out.unlocked)).toEqual(['firstTurn']);
  });

  it('drops non-finite and negative timestamps', () => {
    const out = readAchievements({
      unlocked: { firstTurn: null, steadyHand: 'yesterday', tireless: -1, unrelenting: {}, fullIndex: NOW },
    });
    expect(out).toEqual({ unlocked: { fullIndex: NOW } });
  });

  it('keeps only ids from the achievement list', () => {
    const everything = Object.fromEntries(ACHIEVEMENT_IDS.map((id) => [id, NOW]));
    const out = readAchievements({ unlocked: { ...everything, bogus: NOW } });
    expect(Object.keys(out.unlocked)).toHaveLength(ACHIEVEMENT_IDS.length);
    expect(out.unlocked).not.toHaveProperty('bogus');
  });

  it('returns a new object and never mutates the input', () => {
    const input = { unlocked: { firstTurn: NOW } };
    const before = JSON.stringify(input);
    const out = readAchievements(input);
    expect(out.unlocked).not.toBe(input.unlocked);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('emptyStats sanity for the readers', () => {
  it('readStats returns emptyStats-shaped output when handed an empty block for an empty state', () => {
    const state = createInitialState(NOW);
    const out = readStats({}, state, NOW);
    expect(out).toEqual({ ...emptyStats(NOW), clicks: 0, lifetime: emptyResourceMap(), startedAt: NOW });
  });
});
