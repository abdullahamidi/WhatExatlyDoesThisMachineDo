import type { GameState, ResourceId, TechDefinition } from '../../data/types';

// Cost formula
// ------------
// costAt(def, level) is the price of the next purchase when `level` levels are already owned.
//   repeatable:            ceil(baseCost * growth^level - 1e-9)   (integer, non-decreasing)
//   unlock/milestone/start: baseCost                              (level is ignored)
// The 1e-9 epsilon stops float noise (e.g. 150 * 1.2 landing on 180.00000000000003) from
// bumping an exact integer up by one. The displayed price is always the charged price: the UI
// must call costAt with the same `level` that purchase() uses.

/** Cost of the next purchase of `def`, given `level` levels already owned. */
export function costAt(def: TechDefinition, level: number): number {
  if (def.kind === 'repeatable') {
    return Math.ceil(def.baseCost * Math.pow(def.growth ?? 1, level) - 1e-9);
  }
  return def.baseCost;
}

/** True when the player holds at least `cost` of resource `res`. Only `res` is read. */
export function canAfford(state: Pick<GameState, 'res'>, res: ResourceId, cost: number): boolean {
  return state.res[res] >= cost;
}
