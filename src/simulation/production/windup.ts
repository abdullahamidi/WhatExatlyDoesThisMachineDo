import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type { GameState, ResourceMap, TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { addMaps, emptyResourceMap } from '../resources';

// Wind-up (WP27 C3): the machine stores part of its output and the next manual turn of the crank releases it.
// The store is counted in seconds of output: `stored` seconds release `stored x perSecond[r]` of every energy.
// Capacity and refill come from the `windup` effects of owned techs (per level). The store is transient: it is
// not saved (SAVE_VERSION stays 2), so it refills while the game runs and across an offline span on load.
// Pure functions: inputs are never mutated; a release that takes nothing returns the same state object.

/** Store capacity (seconds of output) and refill rate (seconds of output per second). */
export interface WindupParams { cap: number; refill: number }

/** Capacity and refill of the owned techs: sum of windup.seconds / windup.refill x level (level > 0). */
export function windupParams(
  levels: Readonly<Record<TechId, number>>,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): WindupParams {
  let cap = 0;
  let refill = 0;
  for (const id of TECH_IDS) {
    const level = levels[id];
    if (!(level > 0)) continue;
    for (const effect of techs[id].effects) {
      if (effect.type !== 'windup') continue;
      cap += effect.seconds * level;
      refill += effect.refill * level;
    }
  }
  return { cap, refill };
}

/**
 * Stored seconds after `seconds` of refill: min(cap, stored + refill x seconds). Negative input counts as 0
 * (a clock that went backwards refills nothing) and so does any non-finite stored or seconds value.
 */
export function refillWindup(stored: number, p: WindupParams, seconds: number): number {
  const held = Number.isFinite(stored) ? Math.max(0, stored) : 0;
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return Math.min(p.cap, held + p.refill * elapsed);
}

/**
 * Manual turn releases the store: take = min(stored, cap) (a non-finite or negative store counts as 0).
 * Every energy gains take x max(0, perSecond[r]); res and lifetime move together; totalClicks is not changed
 * (applyClick counts the click). Taking nothing returns the same state object with zero gains.
 */
export function releaseWindup(
  state: GameState,
  stored: number,
  p: WindupParams,
  perSecond: Readonly<ResourceMap>,
): { state: GameState; gained: ResourceMap; released: number } {
  const held = Number.isFinite(stored) ? Math.max(0, stored) : 0;
  const take = Math.min(held, p.cap);
  // `!(take > 0)` also catches a NaN cap, which must release nothing.
  if (!(take > 0)) return { state, gained: emptyResourceMap(), released: 0 };
  const gained = emptyResourceMap();
  for (const r of RESOURCE_IDS) gained[r] = take * Math.max(0, perSecond[r]);
  return {
    state: { ...state, res: addMaps(state.res, gained), lifetime: addMaps(state.lifetime, gained) },
    gained,
    released: take,
  };
}
