import { TECH_IDS } from '../../data/types';
import type { GameState, ProductionRates, TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';

// Production formula (spec section 6). Pure function of the owned tech levels.
//
//   perClick  = (SUM clickAdd.amount  x level) x PRODUCT(clickMult.factor ^ level)
//   perSecond = (SUM autoAdd.amount   x level) x (1 + SUM(autoPct.percent x level) / 100)
//
// Additive aggregation happens first, then multipliers. Unlock/milestone/starting levels are
// 0 or 1. clickMult affects manual production only; autoPct affects automation only.
// Techs with level <= 0 contribute nothing; `none` effects are ignored.

/** Production per click (manual) and per second (automation) for the current tech levels. */
export function computeRates(
  state: GameState,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): ProductionRates {
  let clickAdd = 0;
  let clickMult = 1;
  let autoAdd = 0;
  let autoPct = 0;

  for (const id of TECH_IDS) {
    const level = state.techLevels[id];
    if (level <= 0) continue;
    for (const effect of techs[id].effects) {
      switch (effect.type) {
        case 'clickAdd':
          clickAdd += effect.amount * level;
          break;
        case 'clickMult':
          clickMult *= Math.pow(effect.factor, level);
          break;
        case 'autoAdd':
          autoAdd += effect.amount * level;
          break;
        case 'autoPct':
          autoPct += effect.percent * level;
          break;
        case 'none':
          break;
      }
    }
  }

  return {
    perClick: clickAdd * clickMult,
    perSecond: autoAdd * (1 + autoPct / 100),
  };
}
