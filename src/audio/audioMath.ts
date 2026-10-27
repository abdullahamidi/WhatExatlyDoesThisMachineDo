// Pure mapping from production rate (ME/s) to audio parameters. No DOM, no WebAudio.

import { AUDIO } from '../data/audio';
import type { BedId, PurchaseCue } from '../data/audio';
import type { EraNumber } from '../data/eras';
import { RESOURCES } from '../data/resources';
import { TECHNOLOGIES } from '../data/technologies';
import { VOLUME_RANGE } from '../data/settings';
import type { EndingPhase, ResourceId, TechId } from '../data/types';
import { currentEra } from '../simulation/progression/era';

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

/** Purchase cue by the era of the paying resource; unknown -> 'purchase'. */
export function purchaseCue(res: ResourceId): PurchaseCue {
  return AUDIO.purchaseCueByEra[eraOf(RESOURCES[res]?.era ?? 1) - 1] ?? 'purchase';
}

const ERAS: readonly EraNumber[] = [1, 2, 3, 4, 5];

/** Era from any number: floored and clamped to 1..5; non-finite -> 1. */
function eraOf(n: number): EraNumber {
  if (!Number.isFinite(n)) return 1;
  return ERAS[Math.min(ERAS.length - 1, Math.max(0, Math.floor(n) - 1))] ?? 1;
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
  rain: AUDIO.rain.gain,
};

/** Era in which each bed first arrives (the '-' cells of the WP15 bed table); a bed counts only from its arrival era on. */
const BED_ARRIVAL_ERA: Record<BedId, EraNumber> = {
  hum: 1,
  gear: 1,
  mains: 2,
  boiler: 3,
  pad: 4,
  servo: 4,
  drone: 5,
  wind: 1,
  rain: 3,
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

/** Structural view of the world weather readout (GameFeedback.worldWeather in src/game/context.ts); no import from src/game. */
export interface WeatherInput {
  readonly live: boolean;
  readonly wind: number;
  readonly virgaAlpha: number;
  readonly virgaSpeed: number;
}

/** Wind and rain levels for one update (gains already carry the era trim). */
export interface WeatherMix {
  readonly windGain: number;
  readonly windLfo: boolean;
  readonly rainGain: number;
  readonly rainHz: number;
  readonly live: boolean;
}

/**
 * Wind and rain beds for one update (WP26). Muted: both gains 0 (live is still reported). Not live (no readout, or live false):
 * the v0.10.0 wind at full gain with the gust LFO, and no rain. Live: wind = gain x (floor + (1 - floor) x clamp01(wind / refWind)),
 * no LFO, so still air keeps the floor instead of silence; rain = gain x era trim x clamp01(alpha / alphaRef) x clamp01(speed / speedRef),
 * its pitch rising from hzMin to hzMax with the speed, and falling to hzMin where the era trims the rain bed to 0 (the hiss drops
 * as it fades). Non-finite readings count as 0.
 */
export function weatherMix(input: WeatherInput | null, era: number, muted: boolean): WeatherMix {
  const live = input !== null && input.live === true;
  if (muted) return { windGain: 0, windLfo: false, rainGain: 0, rainHz: AUDIO.rain.hzMin, live };
  if (input === null || !live) {
    return { windGain: AUDIO.wind.gain * bedTrim('wind', era), windLfo: true, rainGain: 0, rainHz: AUDIO.rain.hzMin, live: false };
  }
  const wind = Number.isFinite(input.wind) ? input.wind : 0;
  const windLevel = AUDIO.wind.floor + (1 - AUDIO.wind.floor) * clampRange(wind / AUDIO.wind.refWind, 0, 1);
  const alpha = Number.isFinite(input.virgaAlpha) ? clampRange(input.virgaAlpha / AUDIO.rain.alphaRef, 0, 1) : 0;
  const speed = Number.isFinite(input.virgaSpeed) ? clampRange(input.virgaSpeed / AUDIO.rain.speedRef, 0, 1) : 0;
  const rainTrim = bedTrim('rain', era); // a trim of 0 (era IV+) also pins the pitch to hzMin, so the fade glides the hiss down
  return {
    windGain: AUDIO.wind.gain * bedTrim('wind', era) * windLevel,
    windLfo: false,
    rainGain: AUDIO.rain.gain * rainTrim * alpha * speed,
    rainHz: lerp(AUDIO.rain.hzMin, AUDIO.rain.hzMax, rainTrim > 0 ? speed : 0),
    live: true,
  };
}

/** Live inputs for the ambient mix: production per second per resource, owned tech levels and the mute flag. `weather` is the world readout (WP26); null or absent means no world. */
export interface AmbientInput {
  readonly perSecond: Readonly<Record<ResourceId, number>>;
  readonly techLevels: Readonly<Record<TechId, number>>;
  readonly muted: boolean;
  readonly weather?: WeatherInput | null;
}

/** Ambient bed parameters for one update. Gains already carry the era trim; gearGain is the scale passed to synth.scheduleGearTicks. */
export interface AmbientMix {
  readonly era: EraNumber;
  readonly humHz: number;
  readonly humGain: number;
  readonly gearRate: number;
  readonly gearGain: number;
  readonly mainsGain: number;
  readonly arcRate: number;
  readonly boilerGain: number;
  readonly padGain: number;
  readonly droneGain: number;
  readonly servoGain: number;
  readonly servoHz: number;
  readonly windGain: number;
  readonly windLfo: boolean;
  readonly rainGain: number;
  readonly rainHz: number;
  readonly live: boolean;
}

/**
 * Ambient bed mix (WP15R): era from the owned era techs (simulation currentEra), each bed driven by its own resource rate, era trims from AUDIO.bedTrim.
 * Muted: every gain and rate is 0 except the hum pitch (still follows ME/s), the servo pitch (minHz) and the neutral gearGain 1.
 * Wind and rain (WP26) come from weatherMix with the same era and mute flag, so muting silences them too.
 */
export function ambientMix(input: AmbientInput): AmbientMix {
  const { perSecond, techLevels, muted } = input;
  const { me, ee, pr, rs, xf } = perSecond;
  const era = currentEra(techLevels);
  const weather = weatherMix(input.weather ?? null, era, muted);
  if (muted) {
    return {
      era,
      humHz: humFrequency(me),
      humGain: 0,
      gearRate: 0,
      gearGain: 1,
      mainsGain: 0,
      arcRate: 0,
      boilerGain: 0,
      padGain: 0,
      droneGain: 0,
      servoGain: 0,
      servoHz: AUDIO.servo.minHz,
      ...weather,
    };
  }
  const owned = (id: TechId): boolean => Number.isFinite(techLevels[id]) && techLevels[id] >= 1;
  const servoLevel = techLevels[AUDIO.servo.techId];
  const servoMax = TECHNOLOGIES[AUDIO.servo.techId].maxLevel ?? 1;
  return {
    era,
    humHz: humFrequency(me),
    humGain: humGain(me) * bedTrim('hum', era),
    gearRate: gearTickRate(me),
    gearGain: bedTrim('gear', era),
    mainsGain: mainsGain(ee) * bedTrim('mains', era),
    arcRate: arcRate(ee, owned(AUDIO.arc.techId)),
    boilerGain: boilerGain(pr, owned(AUDIO.boiler.techId)) * bedTrim('boiler', era),
    padGain: padGain(rs, owned(AUDIO.pad.techId)) * bedTrim('pad', era),
    droneGain: droneGain(xf, owned(AUDIO.drone.techId)) * bedTrim('drone', era),
    servoGain: servoGain(servoLevel, servoMax) * bedTrim('servo', era),
    servoHz: servoHz(servoLevel, servoMax),
    ...weather,
  };
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
