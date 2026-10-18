import { TECHNOLOGIES } from '../../data/technologies';
import { TECH_IDS } from '../../data/types';
import type { EndingPhase, EndingState, GameState, TechDefinition, TechId } from '../../data/types';

// Ending phase machine (WP13, C1). Pure: no clock, no storage. Illegal transitions return the
// SAME state object, so callers can detect a no-op with `next === state`.

export const DEFAULT_ENDING: EndingState = { phase: 'none', engagedAt: null };

/** True when the tech carries the `ending` marker effect (the finale trigger). Rate-neutral. */
export function hasEndingEffect(def: TechDefinition): boolean {
  return def.effects.some((e) => e.type === 'ending');
}

/** True when at least one owned tech (level > 0) carries the `ending` marker. */
function ownsEndingTech(levels: Readonly<Record<TechId, number>>): boolean {
  return TECH_IDS.some((id) => levels[id] > 0 && hasEndingEffect(TECHNOLOGIES[id]));
}

/**
 * Starts the finale when an ending tech is owned and the phase is `none`:
 * phase -> `sequence`, engagedAt -> lastSimTime. Any other state returns the same object.
 */
export function startEnding(state: GameState): GameState {
  if (state.ending.phase !== 'none') return state;
  if (!ownsEndingTech(state.techLevels)) return state;
  return { ...state, ending: { phase: 'sequence', engagedAt: state.lastSimTime } };
}

/**
 * Legal steps only: `sequence` -> `choice` and `choice` -> `postgame`. Any other request returns
 * the same object.
 */
export function advanceEnding(state: GameState, to: 'choice' | 'postgame'): GameState {
  const from = state.ending.phase;
  const legal = (to === 'choice' && from === 'sequence') || (to === 'postgame' && from === 'choice');
  if (!legal) return state;
  return { ...state, ending: { phase: to, engagedAt: state.ending.engagedAt } };
}

/**
 * Load rule for the ending block:
 *  - an ending tech owned while the phase is `none` (WP11 save) -> `choice`;
 *  - `sequence` -> `choice` (a reload mid-sequence resumes at the choice);
 *  - no ending tech owned while the phase is not `none` -> DEFAULT_ENDING.
 * Anything else is returned unchanged.
 */
export function normalizeEnding(e: EndingState, levels: Readonly<Record<TechId, number>>): EndingState {
  const owned = ownsEndingTech(levels);
  if (e.phase !== 'none' && !owned) return { ...DEFAULT_ENDING };
  if (e.phase === 'sequence') return { phase: 'choice', engagedAt: e.engagedAt };
  if (e.phase === 'none' && owned) return { phase: 'choice', engagedAt: e.engagedAt };
  return e;
}

/** The reveal (PRIMARY FUNCTION: RESTORE, restored labels) applies from the choice on. */
export function isRevealed(e: EndingState): boolean {
  return e.phase === 'choice' || e.phase === 'postgame';
}

/** Input is locked while the cinematic or the choice is on screen. */
export function isFinaleLocked(e: EndingState): boolean {
  return e.phase === 'sequence' || e.phase === 'choice';
}

/** Every phase value, in order. */
export const ENDING_PHASES: readonly EndingPhase[] = ['none', 'sequence', 'choice', 'postgame'];
