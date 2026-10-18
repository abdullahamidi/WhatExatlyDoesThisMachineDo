// Pure mapping from production rate (ME/s) to audio parameters. No DOM, no WebAudio.

import { AUDIO } from '../data/audio';
import { VOLUME_RANGE } from '../data/settings';

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

/** Resonance pad gain (Era IV): 0 unless the spire is owned and rs > 0 (or NaN -> 0), else lerp(minGain, maxGain, level). */
export function padGain(rsPerSecond: number, owned: boolean, cfg: typeof AUDIO.pad = AUDIO.pad): number {
  if (!owned || !(rsPerSecond > 0)) return 0;
  const level = activityLevel(rsPerSecond, cfg.refPerSecond, cfg.maxPerSecond);
  return clampRange(lerp(cfg.minGain, cfg.maxGain, level), cfg.minGain, cfg.maxGain);
}

/** Drone gain (Era V): 0 unless nullChamber is owned and xf > 0 (or NaN -> 0), else lerp(minGain, maxGain, level). */
export function droneGain(xfPerSecond: number, owned: boolean, cfg: typeof AUDIO.drone = AUDIO.drone): number {
  if (!owned || !(xfPerSecond > 0)) return 0;
  const level = activityLevel(xfPerSecond, cfg.refPerSecond, cfg.maxPerSecond);
  return clampRange(lerp(cfg.minGain, cfg.maxGain, level), cfg.minGain, cfg.maxGain);
}

/** Servo fraction: level / maxLevel clamped to [0, 1]; 0 for non-finite or non-positive level, or maxLevel <= 0. */
export function servoFraction(level: number, maxLevel: number): number {
  if (!Number.isFinite(level) || level <= 0 || !(maxLevel > 0)) return 0;
  return clampRange(level / maxLevel, 0, 1);
}

/** Servo whirr gain: 0 at fraction 0, else lerp(minGain, maxGain, fraction). */
export function servoGain(level: number, maxLevel: number, cfg: typeof AUDIO.servo = AUDIO.servo): number {
  const fraction = servoFraction(level, maxLevel);
  if (fraction === 0) return 0;
  return lerp(cfg.minGain, cfg.maxGain, fraction);
}

/** Servo whirr pitch (Hz): lerp(minHz, maxHz, fraction); minHz at fraction 0. */
export function servoHz(level: number, maxLevel: number, cfg: typeof AUDIO.servo = AUDIO.servo): number {
  return lerp(cfg.minHz, cfg.maxHz, servoFraction(level, maxLevel));
}

/** Bus gain from a volume percent: clamped to the volume range, then divided by its max; non-finite -> 1 (unity). */
export function busGain(volumePct: number): number {
  if (!Number.isFinite(volumePct)) return 1;
  return clampRange(volumePct, VOLUME_RANGE.min, VOLUME_RANGE.max) / VOLUME_RANGE.max;
}

/** Master target: 0 when muted or locked, else base (default AUDIO.masterGain) times volume01 (default 1). */
export function masterTarget(muted: boolean, unlocked: boolean, base: number = AUDIO.masterGain, volume01 = 1): number {
  return muted || !unlocked ? 0 : base * volume01;
}

/** Level set pushed to the synth: master target, wind on/off and the two bus gains. */
export interface LevelSnapshot {
  readonly master: number;
  readonly wind: boolean;
  readonly sfxBus: number;
  readonly ambientBus: number;
}

/** True when `next` differs from the last applied set, or when nothing was applied yet (null). Object.is keeps NaN equal to NaN. */
export function levelsChanged(prev: LevelSnapshot | null, next: LevelSnapshot): boolean {
  if (prev === null) return true;
  return (
    !Object.is(prev.master, next.master) ||
    prev.wind !== next.wind ||
    !Object.is(prev.sfxBus, next.sfxBus) ||
    !Object.is(prev.ambientBus, next.ambientBus)
  );
}
