// Reach level (WP28a, P17): the normalised level L of a per-second rate on a log scale, from lo (L 0) to hi (L 1). Why: the Splice
// pulses and the world's reach effects read one law, so a faster machine shows more. Pure: no Phaser, no DOM. Bounds come from
// src/data/worldReach.ts (REACH_LEVEL) at the call site.

function clampUnit(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** L in [0, 1]: clamp(log10(max(rate, lo) / lo) / log10(hi / lo), 0, 1). Bad input (NaN rate, lo not positive, hi not above lo, a
 *  non-finite bound) reads 0. Monotone in rate; a rate of hi or more reads 1. */
export function reachLevel(rate: number, lo: number, hi: number): number {
  if (Number.isNaN(rate) || !Number.isFinite(lo) || !Number.isFinite(hi) || !(lo > 0) || !(hi > lo)) return 0;
  return clampUnit(Math.log10(Math.max(rate, lo) / lo) / Math.log10(hi / lo));
}
