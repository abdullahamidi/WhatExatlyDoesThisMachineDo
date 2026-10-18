import { ACHIEVEMENT_LIST } from '../data/achievements';
import type { AchievementCondition, AchievementDefinition, AchievementId } from '../data/achievements';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { AchievementsState, GameState, StatsState, TechId } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import type { PrestigeState } from '../data/types';
import { DEFAULT_PRESTIGE } from './prestige';

// Achievement conditions and evaluation (WP12, C3; WP14 C4 prestige rows). Pure: no clock, no storage.

/** Minimal state view a condition needs: only the tech levels. */
export interface ReadonlyGameStateLike {
  readonly techLevels: Readonly<Record<TechId, number>>;
}

export interface AchievementEvaluation {
  achievements: AchievementsState;
  unlocked: AchievementId[];
}

function maxLifetime(stats: StatsState): number {
  let best = 0;
  for (const id of RESOURCE_IDS) {
    const value = stats.lifetime[id];
    if (value > best) best = value;
  }
  return best;
}

/** Number of owned techs, excluding the starting ones (handCrank). */
function countTechsOwned(state: GameState | ReadonlyGameStateLike): number {
  let count = 0;
  for (const id of TECH_IDS) {
    if (state.techLevels[id] >= 1 && TECHNOLOGIES[id].kind !== 'starting') count += 1;
  }
  return count;
}

export function conditionMet(
  c: AchievementCondition,
  state: GameState | ReadonlyGameStateLike,
  stats: StatsState,
  prestige: PrestigeState = DEFAULT_PRESTIGE,
): boolean {
  switch (c.type) {
    case 'stat':
      return stats[c.key] >= c.atLeast;
    case 'tech':
      return state.techLevels[c.id] >= c.minLevel;
    case 'lifetime': {
      const value: number = c.res === 'any' ? maxLifetime(stats) : stats.lifetime[c.res];
      return value >= c.atLeast;
    }
    case 'maxRate':
      return stats.maxPerSecond[c.res] >= c.atLeast;
    case 'techsOwned':
      return countTechsOwned(state) >= c.atLeast;
    case 'prestige': {
      const value = c.key === 'perksOwned' ? prestige.perks.length : prestige.echoesEarned;
      return value >= c.atLeast;
    }
  }
}

/**
 * Unlocks every definition whose condition holds and is not yet unlocked, in list order.
 * Existing timestamps (including ids outside `defs`) are kept. Returns the SAME `current`
 * object when nothing new unlocked.
 */
export function evaluateAchievements(
  state: GameState | ReadonlyGameStateLike,
  stats: StatsState,
  current: AchievementsState,
  nowMs: number,
  defs: readonly AchievementDefinition[] = ACHIEVEMENT_LIST,
  prestige: PrestigeState = DEFAULT_PRESTIGE,
): AchievementEvaluation {
  const unlocked: AchievementId[] = [];
  for (const def of defs) {
    if (current.unlocked[def.id] !== undefined || unlocked.includes(def.id)) continue;
    if (conditionMet(def.condition, state, stats, prestige)) unlocked.push(def.id);
  }
  if (unlocked.length === 0) return { achievements: current, unlocked };

  const next: Partial<Record<AchievementId, number>> = { ...current.unlocked };
  for (const id of unlocked) next[id] = nowMs;
  return { achievements: { unlocked: next }, unlocked };
}
