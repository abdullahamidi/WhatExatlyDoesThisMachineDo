import { CYCLE_TRANSITION } from '../../data/prestige';

// New-cycle transition maths (WP14 C6, ART_ERA5 §7). Pure: the white screen alpha as a function of the transition
// clock tMs (ms since play() started). Ease-out in to the peak (the cycle swap happens there), linear out after it.
// Every timing lives in src/data/prestige.ts (CYCLE_TRANSITION). No Phaser, no DOM, no random source.

function clamp01(k: number): number {
  return Math.min(Math.max(k, 0), 1);
}

/** Cubic ease out on k clamped to 0..1. */
function easeOutCubic(k: number): number {
  return 1 - Math.pow(1 - clamp01(k), 3);
}

/** Peak time in ms: the screen is fully white and the cycle swap runs. Reduced motion uses its own, shorter in. */
export function cycleTransitionPeakMs(reduced: boolean): number {
  return reduced ? CYCLE_TRANSITION.reduced.inMs : CYCLE_TRANSITION.inMs;
}

/** End time in ms: the white has faded out. Alpha is 0 from here on. */
export function cycleTransitionEndMs(reduced: boolean): number {
  const outMs = reduced ? CYCLE_TRANSITION.reduced.outMs : CYCLE_TRANSITION.outMs;
  return cycleTransitionPeakMs(reduced) + outMs;
}

/**
 * White alpha 0..1 at transition time tMs: 0 at 0, ease-out to 1 at the peak, linear back to 0 at the end, 0 after.
 * Negative or non-finite times read as 0 (before the transition).
 */
export function cycleTransitionAlpha(tMs: number, reduced: boolean): number {
  if (!Number.isFinite(tMs) || tMs <= 0) return 0;
  const peak = cycleTransitionPeakMs(reduced);
  if (tMs < peak) return easeOutCubic(tMs / peak);
  const end = cycleTransitionEndMs(reduced);
  if (tMs < end) return 1 - (tMs - peak) / (end - peak);
  return 0;
}
