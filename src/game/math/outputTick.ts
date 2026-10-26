import type { ResourceMap } from '../../data/types';
import type { EraNumber } from '../../data/eras';
import { eraResource } from '../../simulation/progression/era';
import { formatCompact } from '../../utils/format';
import { resourceShort } from '../../ui/revealRules';
import type { GainLine } from '../../ui/hudView';

// WP25 machine output popups (C5): the pure maths behind OutputTicker. The timer (stepOutputTick) and the popup text
// (outputTickLine) live here so the cadence and the wording are testable without Phaser; the renderer only draws them.

/** A value that counts only when finite and > 0; anything else counts 0. */
function countable(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Advances the popup timer by dtMs. Due is true at most once per call: when the accumulated time reaches periodMs,
 * and the remainder carries over, so a long frame (dt above one period) still pops only one line and keeps its leftover time.
 * A bad period (not finite or <= 0) never pops and resets the timer.
 */
export function stepOutputTick(accMs: number, dtMs: number, periodMs: number): { accMs: number; due: boolean } {
  if (!Number.isFinite(periodMs) || periodMs <= 0) return { accMs: 0, due: false };
  const acc = countable(accMs) + countable(dtMs);
  if (acc < periodMs) return { accMs: acc, due: false };
  return { accMs: acc - periodMs * Math.floor(acc / periodMs), due: true };
}

/**
 * The popup line for the frontier resource of `era`: its per-second gain times periodS, as `+n SHORT`.
 * Null when the gain is not finite or <= 0, or when it reads as `0` (a gain below 0.1 is not shown).
 * Only the frontier ever shows, so an era I player sees ME popups and never EE or PR ones; the short label is
 * always used, so ME reads `+n ME` (the smoke relies on it).
 */
export function outputTickLine(perSecond: Readonly<ResourceMap>, era: EraNumber, periodS: number): GainLine | null {
  const res = eraResource(era);
  const gain = perSecond[res] * periodS;
  if (!Number.isFinite(gain) || gain <= 0) return null;
  const body = formatCompact(gain);
  if (body === '0') return null;
  return { res, text: '+' + body + ' ' + resourceShort(res) };
}

/**
 * Alpha factor (0..1) of a popup at ageMs: 1 up to and including holdMs, then linear down to 0 at fadeMs (WP25 AD1 F1).
 * Any non-finite argument gives 0; fadeMs <= holdMs gives 1 up to holdMs and 0 after it.
 */
export function outputTickAlpha(ageMs: number, holdMs: number, fadeMs: number): number {
  if (!Number.isFinite(ageMs) || !Number.isFinite(holdMs) || !Number.isFinite(fadeMs)) return 0;
  if (ageMs <= holdMs) return 1;
  if (fadeMs <= holdMs) return 0;
  return Math.min(1, Math.max(0, (fadeMs - ageMs) / (fadeMs - holdMs)));
}
