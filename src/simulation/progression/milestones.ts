import { TECHNOLOGIES } from '../../data/technologies';
import { TECH_IDS } from '../../data/types';
import type { GameState, TechDefinition, TechId } from '../../data/types';
import { requirementsMet } from './requirements';

/**
 * Unlocks every milestone whose requirements are now met. Milestones are free and
 * idempotent: an owned milestone is skipped, and when nothing unlocks the input
 * state is returned by reference.
 */
export function evaluateMilestones(
  state: GameState,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): { state: GameState; unlocked: TechId[] } {
  let current = state;
  const unlocked: TechId[] = [];
  for (const id of TECH_IDS) {
    const def = techs[id];
    if (def.kind !== 'milestone') continue;
    if (current.techLevels[id] !== 0) continue;
    if (!requirementsMet(current, def)) continue;
    current = { ...current, techLevels: { ...current.techLevels, [id]: 1 } };
    unlocked.push(id);
  }
  return unlocked.length === 0 ? { state, unlocked } : { state: current, unlocked };
}
