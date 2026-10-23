import { TECHNOLOGIES } from '../../data/technologies';
import { TECH_IDS } from '../../data/types';
import type { GameState, TechDefinition, TechId } from '../../data/types';
import { costAt, canAfford } from '../economy/cost';
import { requirementsMet } from './requirements';

// WP20 pure mirror of getTechView(...).affordable. The TECH INDEX badge counts these on every HUD
// refresh, so this skips building views and texts. Parity with getAllTechViews is pinned in tests.

/** True when the tech can be bought now. Same rules as status.ts (getTechStatus + nextCostFor). */
function isAffordable(
  state: Pick<GameState, 'res' | 'lifetime' | 'techLevels'>,
  id: TechId,
  techs: Readonly<Record<TechId, TechDefinition>>,
): boolean {
  const def = techs[id];
  const level = state.techLevels[id];
  const owned = level >= 1;
  if (def.kind === 'starting' || def.kind === 'milestone') return false;
  if (def.kind === 'unlock' && owned) return false;
  if (def.kind === 'repeatable' && def.maxLevel !== null && level >= def.maxLevel) return false;
  // An owned repeatable stays buyable even if its requirements have lapsed (status.ts treats it as available).
  if (!owned && !requirementsMet(state, def)) return false;
  return canAfford(state, def.costRes, costAt(def, level));
}

/** Ids of the techs the player can buy right now, in TECH_IDS order. */
export function affordableTechIds(
  state: Pick<GameState, 'res' | 'lifetime' | 'techLevels'>,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
): TechId[] {
  return TECH_IDS.filter((id) => isAffordable(state, id, techs));
}
