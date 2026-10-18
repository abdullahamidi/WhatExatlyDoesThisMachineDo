import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_LIST } from '../data/achievements';
import type { AchievementDefinition } from '../data/achievements';
import type { AchievementsState, StatsState, TechId } from '../data/types';
import { conditionMet, evaluateAchievements } from './achievements';
import type { ReadonlyGameStateLike } from './achievements';
import { createInitialState } from './state';
import { emptyResourceMap } from './resources';

function makeStats(over: Partial<StatsState> = {}): StatsState {
  return {
    activeSeconds: 0,
    offlineSeconds: 0,
    longestOfflineSeconds: 0,
    clicks: 0,
    purchases: 0,
    lifetime: emptyResourceMap(),
    maxPerSecond: emptyResourceMap(),
    cycles: 1,
    bestCycleSeconds: null,
    startedAt: 0,
    ...over,
  };
}

function stateWithTechs(levels: Partial<Record<TechId, number>>): ReadonlyGameStateLike {
  const state = createInitialState(0);
  for (const [id, level] of Object.entries(levels)) {
    state.techLevels[id as TechId] = level ?? 0;
  }
  return state;
}

const EMPTY: AchievementsState = { unlocked: {} };

describe('conditionMet', () => {
  const state = createInitialState(0);

  it('stat conditions compare each key with >=', () => {
    const cases: Array<[Partial<StatsState>, 'clicks' | 'purchases' | 'activeSeconds' | 'longestOfflineSeconds' | 'cycles', number]> = [
      [{ clicks: 99 }, 'clicks', 100],
      [{ purchases: 24 }, 'purchases', 25],
      [{ activeSeconds: 3599 }, 'activeSeconds', 3600],
      [{ longestOfflineSeconds: 3599 }, 'longestOfflineSeconds', 3600],
      [{ cycles: 1 }, 'cycles', 2],
    ];
    for (const [over, key, atLeast] of cases) {
      const cond = { type: 'stat' as const, key, atLeast };
      expect(conditionMet(cond, state, makeStats(over)), key).toBe(false);
      const exact = makeStats(over);
      exact[key] = atLeast;
      expect(conditionMet(cond, state, exact), key).toBe(true);
      const above = makeStats(over);
      above[key] = atLeast + 1;
      expect(conditionMet(cond, state, above), key).toBe(true);
    }
  });

  it('tech conditions honour minLevel', () => {
    const cond = { type: 'tech' as const, id: 'crankServo' as const, minLevel: 10 };
    expect(conditionMet(cond, stateWithTechs({ crankServo: 9 }), makeStats())).toBe(false);
    expect(conditionMet(cond, stateWithTechs({ crankServo: 10 }), makeStats())).toBe(true);
    expect(conditionMet(cond, stateWithTechs({ crankServo: 0 }), makeStats())).toBe(false);
  });

  it('tech minLevel 1 needs one level', () => {
    const cond = { type: 'tech' as const, id: 'generator' as const, minLevel: 1 };
    expect(conditionMet(cond, stateWithTechs({ generator: 0 }), makeStats())).toBe(false);
    expect(conditionMet(cond, stateWithTechs({ generator: 1 }), makeStats())).toBe(true);
  });

  it('lifetime with a specific resource reads stats.lifetime', () => {
    const cond = { type: 'lifetime' as const, res: 'me' as const, atLeast: 1e6 };
    const lifetime = { ...emptyResourceMap(), me: 1e6 };
    expect(conditionMet(cond, state, makeStats({ lifetime }))).toBe(true);
    expect(conditionMet(cond, state, makeStats({ lifetime: { ...emptyResourceMap(), me: 999999 } }))).toBe(false);
    // state.lifetime is not the source
    const withState = { ...createInitialState(0), lifetime: { ...emptyResourceMap(), me: 1e9 } };
    expect(conditionMet(cond, withState, makeStats())).toBe(false);
  });

  it("lifetime 'any' is the maximum over resources", () => {
    const cond = { type: 'lifetime' as const, res: 'any' as const, atLeast: 1e15 };
    expect(conditionMet(cond, state, makeStats())).toBe(false);
    expect(conditionMet(cond, state, makeStats({ lifetime: { ...emptyResourceMap(), xf: 1e15 } }))).toBe(true);
    expect(conditionMet(cond, state, makeStats({ lifetime: { ...emptyResourceMap(), pr: 9e14, rs: 5e14 } }))).toBe(false);
  });

  it('maxRate reads stats.maxPerSecond for one resource', () => {
    const cond = { type: 'maxRate' as const, res: 'ee' as const, atLeast: 1000 };
    expect(conditionMet(cond, state, makeStats({ maxPerSecond: { ...emptyResourceMap(), ee: 999 } }))).toBe(false);
    expect(conditionMet(cond, state, makeStats({ maxPerSecond: { ...emptyResourceMap(), ee: 1000 } }))).toBe(true);
    expect(conditionMet(cond, state, makeStats({ maxPerSecond: { ...emptyResourceMap(), pr: 5000 } }))).toBe(false);
  });

  it('techsOwned counts owned non-starting techs only', () => {
    const cond = { type: 'techsOwned' as const, atLeast: 2 };
    // handCrank is level 1 in the initial state but is 'starting': not counted.
    expect(conditionMet(cond, createInitialState(0), makeStats())).toBe(false);
    expect(conditionMet(cond, stateWithTechs({ gearRatio: 1 }), makeStats())).toBe(false);
    expect(conditionMet(cond, stateWithTechs({ gearRatio: 1, flywheel: 1 }), makeStats())).toBe(true);
    // repeatable techs count once, however many levels
    expect(conditionMet(cond, stateWithTechs({ gearRatio: 5 }), makeStats())).toBe(false);
  });
});

describe('evaluateAchievements', () => {
  it('returns the same current object and no ids when nothing unlocks', () => {
    const result = evaluateAchievements(createInitialState(0), makeStats(), EMPTY, 500);
    expect(result.achievements).toBe(EMPTY);
    expect(result.unlocked).toEqual([]);
  });

  it('unlocks one achievement with the nowMs timestamp', () => {
    const result = evaluateAchievements(createInitialState(0), makeStats({ clicks: 1 }), EMPTY, 777);
    expect(result.unlocked).toEqual(['firstTurn']);
    expect(result.achievements).not.toBe(EMPTY);
    expect(result.achievements.unlocked).toEqual({ firstTurn: 777 });
    expect(EMPTY.unlocked).toEqual({});
  });

  it('several unlocks come in list order', () => {
    const result = evaluateAchievements(createInitialState(0), makeStats({ clicks: 100 }), EMPTY, 9);
    expect(result.unlocked).toEqual(['firstTurn', 'steadyHand']);
    expect(result.achievements.unlocked).toEqual({ firstTurn: 9, steadyHand: 9 });
  });

  it('never re-unlocks and keeps the existing timestamp', () => {
    const current: AchievementsState = { unlocked: { firstTurn: 5 } };
    const result = evaluateAchievements(createInitialState(0), makeStats({ clicks: 1 }), current, 999);
    expect(result.unlocked).toEqual([]);
    expect(result.achievements).toBe(current);
    expect(result.achievements.unlocked.firstTurn).toBe(5);
  });

  it('keeps timestamps of ids that are not in defs', () => {
    const foreign: Record<string, number> = { legacyThing: 42 };
    const current: AchievementsState = { unlocked: foreign };
    const result = evaluateAchievements(createInitialState(0), makeStats({ clicks: 1 }), current, 10);
    expect(result.unlocked).toEqual(['firstTurn']);
    expect(result.achievements.unlocked).toEqual({ legacyThing: 42, firstTurn: 10 });
  });

  it('only evaluates a custom defs argument', () => {
    const defs: AchievementDefinition[] = [ACHIEVEMENTS.tinkerer];
    const stats = makeStats({ clicks: 100, purchases: 25 });
    const result = evaluateAchievements(createInitialState(0), stats, EMPTY, 3, defs);
    expect(result.unlocked).toEqual(['tinkerer']);
    expect(result.achievements.unlocked).toEqual({ tinkerer: 3 });
  });

  it('default defs is the full ACHIEVEMENT_LIST', () => {
    const everything = makeStats({
      clicks: 10000,
      purchases: 150,
      activeSeconds: 3600,
      longestOfflineSeconds: 28800,
      cycles: 2,
    });
    const withDefault = evaluateAchievements(createInitialState(0), everything, EMPTY, 1);
    const withList = evaluateAchievements(createInitialState(0), everything, EMPTY, 1, ACHIEVEMENT_LIST);
    expect(withDefault.unlocked).toEqual(withList.unlocked);
    expect(withDefault.unlocked).toContain('newCycle');
    expect(withDefault.unlocked).toContain('longSilence');
  });

  it('records nowMs as the timestamp of every new unlock', () => {
    const first = evaluateAchievements(createInitialState(0), makeStats({ clicks: 1 }), EMPTY, 100);
    const second = evaluateAchievements(createInitialState(0), makeStats({ clicks: 100 }), first.achievements, 200);
    expect(second.unlocked).toEqual(['steadyHand']);
    expect(second.achievements.unlocked).toEqual({ firstTurn: 100, steadyHand: 200 });
  });
});
