import { TECHNOLOGIES } from '../../data/technologies';
import type { GameState, Requirement, TechDefinition } from '../../data/types';
import { formatNumber } from '../../utils/format';

/** True when a single requirement is satisfied by the current state. */
export function isRequirementMet(state: GameState, req: Requirement): boolean {
  if (req.type === 'tech') return state.techLevels[req.id] >= req.minLevel;
  return state.lifetimeMe >= req.amount;
}

/** True when every requirement of `def` is satisfied (no requirements -> true). */
export function requirementsMet(state: GameState, def: TechDefinition): boolean {
  return def.requires.every((req) => isRequirementMet(state, req));
}

/** Player-facing text for a requirement, e.g. "Gear Ratio Lv 3" or "1K lifetime ME". */
export function requirementLabel(req: Requirement): string {
  if (req.type === 'lifetimeMe') return `${formatNumber(req.amount)} lifetime ME`;
  const target = TECHNOLOGIES[req.id];
  if (req.minLevel > 1 || target.kind === 'repeatable') {
    return `${target.name} Lv ${req.minLevel}`;
  }
  return target.name;
}
