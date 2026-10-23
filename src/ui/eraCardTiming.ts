import { ERA_CARD } from '../data/ux';

/** CSS custom properties for the era card fades, so the CSS holds no duration literal. */
export function eraCardTimingVars(card: { readonly fadeInMs: number; readonly fadeOutMs: number } = ERA_CARD): Record<string, string> {
  return { '--era-card-in': `${card.fadeInMs}ms`, '--era-card-out': `${card.fadeOutMs}ms` };
}
