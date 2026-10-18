import { TECH_LIST } from '../../data/technologies';
import type { GameState, TechId } from '../../data/types';
import { requirementsMet } from './requirements';

/**
 * Unlocks every milestone whose requirements are now met. Milestones are free and
 * idempotent: an owned milestone is skipped, and when nothing unlocks the input
 * state is returned by reference.
 */
export function evaluateMilestones(state: GameState): { state: GameState; unlocked: TechId[] } {
  let current = state;
  const unlocked: TechId[] = [];
  for (const def of TECH_LIST) {
    if (def.kind !== 'milestone') continue;
    if (current.techLevels[def.id] !== 0) continue;
    if (!requirementsMet(current, def)) continue;
    current = { ...current, techLevels: { ...current.techLevels, [def.id]: 1 } };
    unlocked.push(def.id);
  }
  return unlocked.length === 0 ? { state, unlocked } : { state: current, unlocked };
}
