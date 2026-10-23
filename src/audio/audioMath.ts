// Pure mapping from production rate (ME/s) to audio parameters. No DOM, no WebAudio.

import { AUDIO } from '../data/audio';
import type { BedId } from '../data/audio';
import { MUSIC } from '../data/music';
import { VOLUME_RANGE } from '../data/settings';
import type { EndingPhase, TechId } from '../data/types';

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

/** Resolve chord frequencies (Hz): rootHz * each ratio, in ratio order. Non-finite or non-positive root -> empty list. */
export function chordFrequencies(rootHz: number, ratios: readonly number[]): number[] {
  if (!Number.isFinite(rootHz) || rootHz <= 0) return [];
  return ratios.map((ratio) => rootHz * ratio);
}

/** One FM-ish chirp: starts at startS (seconds from the cue), sweeps fromHz -> toHz over durationS. */
export interface ChirpSweep {
  readonly startS: number;
  readonly durationS: number;
  readonly fromHz: number;
  readonly toHz: number;
}

/** The chirp fields the sweep list reads (widened to numbers so tests can pass other configs). */
export interface ChirpConfig {
  readonly count: number;
  readonly gapMs: number;
  readonly sweepMs: number;
  readonly fromHz: number;
  readonly toHz: number;
}

/** Flock chirp list: `count` sweeps from AUDIO.chirp, gapMs apart, all the same length and pitch range. */
export function chirpSweeps(cfg: ChirpConfig = AUDIO.chirp): ChirpSweep[] {
  const sweeps: ChirpSweep[] = [];
  for (let i = 0; i < cfg.count; i++) {
    sweeps.push({ startS: (i * cfg.gapMs) / 1000, durationS: cfg.sweepMs / 1000, fromHz: cfg.fromHz, toHz: cfg.toHz });
  }
  return sweeps;
}

/** The stamp fields the envelope list reads (widened to numbers so tests can pass other configs). */
export interface StampConfig {
  readonly thumpHz: number;
  readonly thumpMs: number;
  readonly thumpGain: number;
  readonly noiseMs: number;
  readonly noiseLowpassHz: number;
  readonly noiseGain: number;
  readonly clickHz: number;
  readonly clickDelayMs: number;
  readonly clickMs: number;
  readonly clickGain: number;
}

/**
 * One stamp part. `hz` is the thump's settled pitch, the rattle's lowpass cutoff, or the click's fundamental;
 * synth.ts reads the remaining shape (thump drop, click partial ratio, click attack) from AUDIO.stamp.
 */
export interface StampPartial {
  readonly kind: 'thump' | 'rattle' | 'click';
  readonly startS: number;
  readonly durationS: number;
  readonly hz: number;
  readonly gain: number;
}

/** Stamp envelope list (WP14 cycle start): thump and rattle start together at the cue, the metallic click follows after clickDelayMs. */
export function stampPartials(cfg: StampConfig = AUDIO.stamp): StampPartial[] {
  return [
    { kind: 'thump', startS: 0, durationS: cfg.thumpMs / 1000, hz: cfg.thumpHz, gain: cfg.thumpGain },
    { kind: 'rattle', startS: 0, durationS: cfg.noiseMs / 1000, hz: cfg.noiseLowpassHz, gain: cfg.noiseGain },
    { kind: 'click', startS: cfg.clickDelayMs / 1000, durationS: cfg.clickMs / 1000, hz: cfg.clickHz, gain: cfg.clickGain },
  ];
}

/**
 * Wind bed allowed by the ending phase: on in 'none' and 'sequence' (the sequence is cut by the windStop beat
 * through a local flag in gameAudio); off in 'choice' and 'postgame'.
 */
export function windAllowed(phase: EndingPhase): boolean {
  return phase === 'none' || phase === 'sequence';
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

/** Mix era 1..5 (WP15 D8): era I before any keystone, II..V from generator, boiler, resonatorSpire, nullChamber. */
export type Era = 1 | 2 | 3 | 4 | 5;

const ERAS: readonly Era[] = [1, 2, 3, 4, 5];

/** Era from any number: floored and clamped to 1..5; non-finite -> 1. */
function eraOf(n: number): Era {
  if (!Number.isFinite(n)) return 1;
  return ERAS[Math.min(ERAS.length - 1, Math.max(0, Math.floor(n) - 1))] ?? 1;
}

/** Current era from the highest owned keystone (MUSIC.keystones order: generator 2 .. nullChamber 5). None owned -> 1. */
export function currentEra(techLevels: Readonly<Record<TechId, number>>): Era {
  let index = -1;
  for (let i = 0; i < MUSIC.keystones.length; i++) {
    const entry = MUSIC.keystones[i];
    if (entry && techLevels[entry[0]] >= 1) index = i;
  }
  return eraOf(index + 2);
}

/** Ambient bed trim for an era (AUDIO.bedTrim row, era clamped to 1..5). Bad or missing data -> 1. */
export function bedTrim(bed: BedId, era: number): number {
  const trim = AUDIO.bedTrim[bed][eraOf(era) - 1];
  return trim !== undefined && Number.isFinite(trim) ? trim : 1;
}

/** Loudest level each ambient bed reaches before its era trim (from the bed's own config). */
const BED_PEAK_GAIN: Record<BedId, number> = {
  hum: AUDIO.hum.maxGain,
  gear: AUDIO.gearTick.gain,
  mains: AUDIO.mains.maxGain,
  boiler: AUDIO.boiler.maxGain,
  pad: AUDIO.pad.maxGain,
  servo: AUDIO.servo.maxGain,
  drone: AUDIO.drone.maxGain,
  wind: AUDIO.wind.gain,
};

/** Era in which each bed first arrives (the '-' cells of the WP15 bed table); a bed counts only from its arrival era on. */
const BED_ARRIVAL_ERA: Record<BedId, Era> = {
  hum: 1,
  gear: 1,
  mains: 2,
  boiler: 3,
  pad: 4,
  servo: 4,
  drone: 5,
  wind: 1,
};

/** Sum of peak bed gain x era trim over the beds present in that era (WP15 C2 invariant: <= 0.45). */
export function ambientPeakSum(era: number): number {
  const e = eraOf(era);
  let sum = 0;
  for (const bed of Object.keys(BED_PEAK_GAIN) as BedId[]) {
    if (BED_ARRIVAL_ERA[bed] <= e) sum += BED_PEAK_GAIN[bed] * bedTrim(bed, e);
  }
  return sum;
}

/** Level set pushed to the synth: master target, wind on/off and the three bus gains. */
export interface LevelSnapshot {
  readonly master: number;
  readonly wind: boolean;
  readonly sfxBus: number;
  readonly ambientBus: number;
  readonly musicBus: number;
}

/** True when `next` differs from the last applied set, or when nothing was applied yet (null). Object.is keeps NaN equal to NaN. */
export function levelsChanged(prev: LevelSnapshot | null, next: LevelSnapshot): boolean {
  if (prev === null) return true;
  return (
    !Object.is(prev.master, next.master) ||
    prev.wind !== next.wind ||
    !Object.is(prev.sfxBus, next.sfxBus) ||
    !Object.is(prev.ambientBus, next.ambientBus) ||
    !Object.is(prev.musicBus, next.musicBus)
  );
}
