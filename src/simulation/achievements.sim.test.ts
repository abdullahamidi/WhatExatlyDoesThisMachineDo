import { beforeAll, describe, it, expect } from 'vitest';
import { ACHIEVEMENT_IDS } from '../data/achievements';
import type { AchievementId } from '../data/achievements';
import type { StatsState } from '../data/types';
import { evaluateAchievements } from './achievements';
import { computeRates } from './production/rates';
import { emptyStats } from './stats';
import { runGreedy } from './sim/greedy';
import type { GreedyResult } from './sim/greedy';

// Achievement reachability (WP12 T10). A deterministic greedy run (profile A of
// balance.sim.test.ts) must unlock every cosmetic achievement except the three that depend on
// cycles / offline time, which a single online run cannot produce. No clock, no randomness.
// Re-run: npx vitest run src/simulation/achievements.sim.test.ts

const MAIN_SECONDS = 17400;
const CLICKS_PER_SECOND = 4;

// Profile A (same as balance.sim.test.ts): 4 clicks/s, 1 s step, 1 s buy interval.
const PROFILE_A = { seconds: MAIN_SECONDS, clicksPerSecond: CLICKS_PER_SECOND, stepSeconds: 1, buyIntervalSeconds: 1 };

// Cycle and offline rows: not reachable in one online run (no cycle, no offline time).
const NOT_IN_ONLINE_RUN: ReadonlySet<AchievementId> = new Set<AchievementId>(['newCycle', 'shortNap', 'longSilence']);

const EXPECTED_UNLOCKED: readonly AchievementId[] = ACHIEVEMENT_IDS.filter((id) => !NOT_IN_ONLINE_RUN.has(id));

let run: GreedyResult;
let stats: StatsState;
let result: ReturnType<typeof evaluateAchievements>;

beforeAll(() => {
  run = runGreedy(PROFILE_A);
  stats = {
    ...emptyStats(0),
    activeSeconds: MAIN_SECONDS,
    clicks: Math.round(CLICKS_PER_SECOND * MAIN_SECONDS),
    purchases: run.purchases.length,
    lifetime: run.final.lifetime,
    maxPerSecond: computeRates(run.final).perSecond,
    cycles: 1,
  };
  result = evaluateAchievements(run.final, stats, { unlocked: {} }, 0);
});

describe('achievement reachability (one greedy online run, profile A)', () => {
  it('unlocks every achievement except the cycle and offline rows, in list order', () => {
    expect(result.unlocked).toEqual(EXPECTED_UNLOCKED);
  });

  it('keeps newCycle, shortNap and longSilence locked', () => {
    for (const id of NOT_IN_ONLINE_RUN) {
      expect(result.achievements.unlocked[id]).toBeUndefined();
    }
  });

  it('shiftWorker is met by the 17400 s run (activeSeconds >= 3600)', () => {
    expect(result.achievements.unlocked.shiftWorker).toBe(0);
  });

  it('purchase and tech-count rows are met by the run (tinkerer, engineer, fullIndex)', () => {
    expect(run.purchases.length).toBeGreaterThanOrEqual(150);
    expect(result.achievements.unlocked.tinkerer).toBe(0);
    expect(result.achievements.unlocked.engineer).toBe(0);
    expect(result.achievements.unlocked.fullIndex).toBe(0);
  });

  it('a second evaluation of the same run unlocks nothing new', () => {
    const again = evaluateAchievements(run.final, stats, result.achievements, 1);
    expect(again.unlocked).toEqual([]);
    expect(again.achievements).toBe(result.achievements);
  });
});

describe('bigNumber reachability (lifetime any >= 5e9)', () => {
  it('the online run reaches 5e9 of some resource (gauge in the red)', () => {
    const best = Math.max(...Object.values(run.final.lifetime));
    expect(best).toBeGreaterThanOrEqual(5e9);
    expect(result.achievements.unlocked.bigNumber).toBe(0);
  });
});
