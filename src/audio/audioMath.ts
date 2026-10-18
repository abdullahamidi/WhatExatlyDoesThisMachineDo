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

/** Mains hum gain (Era II): 0 when ee <= 0 or NaN, else lerp(minGain, maxGain, level); always within [minGain, maxGain] when positive. */
export function mainsGain(eePerSecond: number, cfg: typeof AUDIO.mains = AUDIO.mains): number {
  if (!(eePerSecond > 0)) return 0;
  const level = activityLevel(eePerSecond, cfg.refPerSecond, cfg.maxPerSecond);
  return clampRange(lerp(cfg.minGain, cfg.maxGain, level), cfg.minGain, cfg.maxGain);
}

/**
 * Arc crackle rate (arcs/s): 0 unless the spark gap is owned and ee > 0 (or NaN -> 0),
 * else lerp(minRate, maxRate, level); never above maxRate (3 arcs/s).
 */
export function arcRate(eePerSecond: number, sparkOwned: boolean, cfg: typeof AUDIO.arc = AUDIO.arc): number {
  if (!sparkOwned || !(eePerSecond > 0)) return 0;
  const level = activityLevel(eePerSecond, cfg.refPerSecond, cfg.maxPerSecond);
  return clampRange(lerp(cfg.minRate, cfg.maxRate, level), cfg.minRate, cfg.maxRate);
}

/** Boiler roar gain (Era III): 0 unless the boiler is owned and pr > 0 (or NaN -> 0), else lerp(minGain, maxGain, level). */
export function boilerGain(prPerSecond: number, boilerOwned: boolean, cfg: typeof AUDIO.boiler = AUDIO.boiler): number {
  if (!boilerOwned || !(prPerSecond > 0)) return 0;
  const level = activityLevel(prPerSecond, cfg.refPerSecond, cfg.maxPerSecond);
  return clampRange(lerp(cfg.minGain, cfg.maxGain, level), cfg.minGain, cfg.maxGain);
}

/** Master target: 0 when muted or locked, else base (default AUDIO.masterGain). */
export function masterTarget(muted: boolean, unlocked: boolean, base: number = AUDIO.masterGain): number {
  return muted || !unlocked ? 0 : base;
}
