import { TECHNOLOGIES } from '../../data/technologies';
import type { GameState, PurchaseResult, TechId } from '../../data/types';
import { canAfford, costAt } from '../economy/cost';
import { requirementsMet } from './requirements';

/**
 * Attempts to buy one level of a technology. Never mutates `state`; on failure the
 * result carries only the reason, so the caller's state is untouched by construction.
 * Spending reduces `me` only; `lifetimeMe` is never changed.
 */
export function purchase(state: GameState, id: TechId): PurchaseResult {
  const def = TECHNOLOGIES[id];
  const level = state.techLevels[id];

  if (def.kind === 'starting' || def.kind === 'milestone') {
    return { ok: false, reason: 'notPurchasable' };
  }
  if (def.kind === 'unlock' && level >= 1) {
    return { ok: false, reason: 'owned' };
  }
  if (def.kind === 'repeatable' && def.maxLevel !== null && level >= def.maxLevel) {
    return { ok: false, reason: 'maxed' };
  }
  if (!requirementsMet(state, def)) {
    return { ok: false, reason: 'locked' };
  }
  const cost = costAt(def, level);
  if (!canAfford(state, cost)) {
    return { ok: false, reason: 'insufficient' };
  }

  const next: GameState = {
    ...state,
    me: state.me - cost,
    techLevels: { ...state.techLevels, [id]: level + 1 },
  };
  return { ok: true, state: next, cost, newLevel: level + 1 };
}
