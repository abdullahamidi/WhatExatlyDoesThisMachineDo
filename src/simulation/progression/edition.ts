import { RESOURCES } from '../../data/resources';
import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type {
  EndingState,
  GameState,
  PrestigeState,
  ResourceId,
  ResourceMap,
  TechDefinition,
  TechId,
} from '../../data/types';

// Edition era cap (WP21, Steam demo). Pure: a null cap is the full game, and every function then
// returns its input by reference, so the default path cannot drift from the full game.

/** Highest era the edition allows; null = full game. */
export type EraCap = number | null;

/** True when the tech's era is inside the cap. */
export function eraAllowed(def: Pick<TechDefinition, 'era'>, maxEra: EraCap): boolean {
  return maxEra === null || def.era <= maxEra;
}

/** True when the resource's era is inside the cap. */
export function resourceAllowed(id: ResourceId, maxEra: EraCap): boolean {
  return maxEra === null || RESOURCES[id].era <= maxEra;
}

/**
 * Zeroes everything above the cap: tech levels, resource stock and lifetime, and a finale in
 * progress. Returns the same state object when nothing changes, so a second call is a no-op.
 * Copies only the sub-objects it changes; a save from a larger edition must not carry era-III+
 * progress into the demo.
 */
export function clampStateToEra(
  state: GameState,
  maxEra: EraCap,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
): { state: GameState; changed: boolean } {
  if (maxEra === null) return { state, changed: false };

  let techLevels: Record<TechId, number> | null = null;
  let res: ResourceMap | null = null;
  let lifetime: ResourceMap | null = null;
  for (const id of TECH_IDS) {
    if (eraAllowed(techs[id], maxEra) || state.techLevels[id] === 0) continue;
    techLevels ??= { ...state.techLevels };
    techLevels[id] = 0;
  }
  for (const id of RESOURCE_IDS) {
    if (resourceAllowed(id, maxEra)) continue;
    if (state.res[id] !== 0) {
      res ??= { ...state.res };
      res[id] = 0;
    }
    if (state.lifetime[id] !== 0) {
      lifetime ??= { ...state.lifetime };
      lifetime[id] = 0;
    }
  }
  const endingCleared = state.ending.phase !== 'none' || state.ending.engagedAt !== null;

  if (techLevels === null && res === null && lifetime === null && !endingCleared) {
    return { state, changed: false };
  }
  const ending: EndingState = endingCleared ? { phase: 'none', engagedAt: null } : state.ending;
  return {
    state: {
      ...state,
      techLevels: techLevels ?? state.techLevels,
      res: res ?? state.res,
      lifetime: lifetime ?? state.lifetime,
      ending,
    },
    changed: true,
  };
}

/**
 * Applies the era cap to a loaded save: the state via clampStateToEra, and Echoes/cycle progress
 * reset to a fresh cycle 1 (the demo has no new-cycle loop). Unchanged parts keep their references.
 */
export function clampLoadToEra(
  load: { state: GameState; prestige: PrestigeState },
  maxEra: EraCap,
): { state: GameState; prestige: PrestigeState; changed: boolean } {
  if (maxEra === null) return { state: load.state, prestige: load.prestige, changed: false };

  const clamped = clampStateToEra(load.state, maxEra);
  const p = load.prestige;
  const prestigeReset = p.cycle !== 1 || p.echoesEarned !== 0 || p.perks.length > 0;
  // Inline literal: importing ../prestige here would create a cycle (prestige imports progression/ending).
  const prestige: PrestigeState = prestigeReset ? { cycle: 1, echoesEarned: 0, perks: [] } : p;
  return { state: clamped.state, prestige, changed: clamped.changed || prestigeReset };
}
