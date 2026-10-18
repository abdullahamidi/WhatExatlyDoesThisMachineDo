// Pure mapping from production rate (ME/s) to audio parameters. No DOM, no WebAudio.

import { AUDIO } from '../data/audio';

/** Clamp x into [lo, hi]; NaN falls back to lo; -0 comes back as +0. */
function clampRange(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  const y = Math.min(hi, Math.max(lo, x));
  return y === 0 ? 0 : y;
}

/** Linear interpolation: a + (b - a) * t. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Activity level: log(1 + ps/ref) / log(1 + max/ref), clamped to [0, 1]; invalid input -> 0. */
export function activityLevel(perSecond: number, ref: number, max: number): number {
  if (!(perSecond > 0)) return 0;
  const denom = Math.log(1 + max / ref);
  if (!(denom > 0)) return 0;
  return clampRange(Math.log(1 + perSecond / ref) / denom, 0, 1);
}

/** Hum frequency: lerp(minHz, maxHz, level); always within [minHz, maxHz]. */
export function humFrequency(perSecond: number, cfg: typeof AUDIO.hum = AUDIO.hum): number {
  const level = activityLevel(perSecond, cfg.refPerSecond, cfg.maxPerSecond);
  return clampRange(lerp(cfg.minHz, cfg.maxHz, level), cfg.minHz, cfg.maxHz);
}

/** Hum gain: 0 when ps <= 0 or NaN, else lerp(minGain, maxGain, level). */
export function humGain(perSecond: number, cfg: typeof AUDIO.hum = AUDIO.hum): number {
  if (!(perSecond > 0)) return 0;
  const level = activityLevel(perSecond, cfg.refPerSecond, cfg.maxPerSecond);
  return clampRange(lerp(cfg.minGain, cfg.maxGain, level), cfg.minGain, cfg.maxGain);
}

/**
 * Gear tick rate (ticks/s): 0 when ps <= 0 or NaN, else lerp(minPerSecond, maxPerSecond, level).
 * The level uses the hum's activity curve (AUDIO.hum ref/max) so both sounds rise together.
 */
export function gearTickRate(perSecond: number, cfg: typeof AUDIO.gearTick = AUDIO.gearTick): number {
  if (!(perSecond > 0)) return 0;
  const level = activityLevel(perSecond, AUDIO.hum.refPerSecond, AUDIO.hum.maxPerSecond);
  return clampRange(lerp(cfg.minPerSecond, cfg.maxPerSecond, level), cfg.minPerSecond, cfg.maxPerSecond);
}

/** Master target: 0 when muted or locked, else base (default AUDIO.masterGain). */
export function masterTarget(muted: boolean, unlocked: boolean, base: number = AUDIO.masterGain): number {
  return muted || !unlocked ? 0 : base;
}
