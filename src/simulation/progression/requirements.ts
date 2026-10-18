import { RESOURCES } from '../../data/resources';
import { TECHNOLOGIES } from '../../data/technologies';
import type { GameState, Requirement, TechDefinition, TechId } from '../../data/types';
import { formatNumber } from '../../utils/format';

/** True when a single requirement is satisfied by the current state. */
export function isRequirementMet(
  state: Pick<GameState, 'techLevels' | 'lifetime'>,
  req: Requirement,
): boolean {
  if (req.type === 'tech') return state.techLevels[req.id] >= req.minLevel;
  return state.lifetime[req.res] >= req.amount;
}

/** True when every requirement of `def` is satisfied (no requirements -> true). */
export function requirementsMet(
  state: Pick<GameState, 'techLevels' | 'lifetime'>,
  def: TechDefinition,
): boolean {
  return def.requires.every((req) => isRequirementMet(state, req));
}

/** Player-facing text for a requirement, e.g. "Gear Ratio Lv 3" or "200K lifetime ME". */
export function requirementLabel(
  req: Requirement,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): string {
  if (req.type === 'lifetime') {
    return `${formatNumber(req.amount)} lifetime ${RESOURCES[req.res].short}`;
  }
  const target = techs[req.id];
  if (req.minLevel > 1 || target.kind === 'repeatable') {
    return `${target.name} Lv ${req.minLevel}`;
  }
  return target.name;
}
