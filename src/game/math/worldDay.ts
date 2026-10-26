// Living world day, weather and ambient maths (WP24 T4): the recorded-Tuesday clock (progress is the era tape filling on a log scale, the
// presented minute eases toward its target and never falls), the one-multiply light tint, the weather per era (base wind, gust sines and
// hash gust events, the slew to still air, the dust breath, vent puffs), the micro-event schedules, the mote orbit, and the shadow and
// lamp gains.
// Why: the clocks, the renderers and the tests read one tested rule; every number comes from src/data (WORLD_DAY, WORLD_WEATHER,
// WORLD_AMBIENT), and the era gates are read from TECHNOLOGIES at runtime.
// Pure: no Phaser, no DOM, no Date. Minutes are clock minutes since midnight (540 = 09:00); times are simulation ms.
import { TECHNOLOGIES } from '../../data/technologies';
import type { EndingPhase, ResourceId, TechId } from '../../data/types';
import { WORLD_ENV } from '../../data/livingWorld';
import { WORLD_AMBIENT, WORLD_DAY, WORLD_WEATHER } from '../../data/worldDay';
import type { MicroFlags, MicroKind } from '../../data/worldDay';
import { currentEra, eraResource } from '../../simulation/progression/era';
import type { WorldEra } from './worldState';

export interface DayInput {
  levels: Readonly<Record<TechId, number>>;
  lifetime: Readonly<Record<ResourceId, number>>;
  phase: EndingPhase;
  edition: 'full' | 'demo';
}

// The weather of an era at its tape position p (label: the sky word, 'still' in the postgame).
export interface WeatherState {
  era: WorldEra;
  label: 'dry' | 'front' | 'calm' | 'still';
  baseWind: number;
  gusts: boolean;
  virgaAlpha: number;
  virgaSpeed: number;
  dustDrift: boolean;
  vents: boolean;
}

// The ambient values the clocks hand to the renderers each frame (the virga values scale the transition queue's own virga).
export interface Ambient {
  wind: number;
  dustDrift: number;
  virgaAlpha: number;
  virgaSpeed: number;
  lampGain: number;
  shadowDx: number;
  shadowWidth: number;
  // The clocks' own clock in ms: it stops while the tape is frozen (dt 0), so the era II mains flicker holds through the freeze (A10).
  mainsMs: number;
  micro: MicroFlags;
}

// Structural era identities, not tuning: the era the front builds in (the vents era, D6) and the still-air era of the dust breath (D6).
const FRONT_ERA: WorldEra = 3;
const STILL_ERA: WorldEra = 5;
// The 8-bit channel maximum (0xff, 255).
const CHANNEL_MAX = 0xff;
// Micro kinds in data order: the index salts each kind's hash stream.
const MICRO_KINDS = Object.keys(WORLD_AMBIENT.micro) as MicroKind[];

// Sine hash of two integers in [0, 1): deterministic, no random source (as worldPlayback.ts).
function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}
// Clamp to [0, 1]; NaN reads as 0.
function clamp01(v: number): number {
  return v > 0 ? Math.min(1, v) : 0;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
// The value of a [lo, hi] range at hash h in [0, 1).
function span(range: readonly [number, number], h: number): number {
  return range[0] + (range[1] - range[0]) * h;
}
// Non-negative finite number, else 0.
function nonNeg(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}
// Whole number, never -0 (Math.round of a small negative gives -0).
function roundZero(v: number): number {
  return Math.round(v) + 0;
}

// The lifetime amount the era gate asks for, read from TECHNOLOGIES (never a literal). 0 when the milestone has no lifetime requirement.
function gateAmount(era: WorldEra): number {
  const req = TECHNOLOGIES[WORLD_DAY.gates[era]].requires.find((r) => r.type === 'lifetime');
  return req?.type === 'lifetime' ? req.amount : 0;
}

// Tape position of a lifetime amount, 0 to 1: a log scale from gate × 10^-decades (0) up to the gate (1 - tailShare), then one tail of
// tailDecades up to gate × 10^tailDecades (1). Zero or unknown lifetime and a missing gate read as 0.
function tapeP(lifetime: number, gate: number): number {
  if (!(lifetime > 0) || !(gate > 0)) return 0;
  const { decades, tailDecades, tailShare } = WORLD_DAY;
  const x = Math.log10(lifetime / gate);
  if (x <= 0) return (1 - tailShare) * clamp01((x + decades) / decades);
  return (1 - tailShare) + tailShare * clamp01(x / tailDecades);
}

// The era now (the highest keystone owned) and its tape position from the era resource's lifetime.
export function dayProgress(i: DayInput): { era: WorldEra; p: number } {
  const era = currentEra(i.levels);
  return { era, p: tapeP(i.lifetime[eraResource(era)], gateAmount(era)) };
}

// The minute the clock is heading for. An ending phase holds heldMin (16:41, "the minute never turns"). Otherwise the era band
// from fromMin to toMin follows p; the demo edition never goes past demoMaxMin.
export function dayTargetMin(i: DayInput): number {
  if (i.phase !== 'none') return WORLD_DAY.heldMin;
  const { era, p } = dayProgress(i);
  const band = WORLD_DAY.bands.find((b) => b.era === era);
  const min = band === undefined ? WORLD_DAY.startMin : band.fromMin + p * (band.toMin - band.fromMin);
  return i.edition === 'demo' ? Math.min(min, WORLD_DAY.demoMaxMin) : min;
}

// The presented minute moves toward the target by the eased share (smoothMs) of the gap, at most maxRateMinPerS. It never decreases:
// a target at or below the presented minute holds it (a new cycle snaps through the clock, not here).
export function stepDayMin(presented: number, target: number, dtMs: number): number {
  if (!(target > presented)) return presented;
  const dt = nonNeg(dtMs);
  const eased = (target - presented) * (1 - Math.exp(-dt / WORLD_DAY.smoothMs));
  return presented + Math.min(eased, WORLD_DAY.maxRateMinPerS * dt / 1000);
}

// The unpacked channels of a 0xRRGGBB value.
function unpack(rgb: number): [number, number, number] {
  return [(rgb >> 16) & CHANNEL_MAX, (rgb >> 8) & CHANNEL_MAX, rgb & CHANNEL_MAX];
}

// Linear per-channel blend of the tint keys at minute min, clamped to the first and the last key.
function keyChannels(min: number): [number, number, number] {
  const keys = WORLD_DAY.tintKeys;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return [0, 0, 0];
  if (min <= first.min) return unpack(first.rgb);
  if (min >= last.min) return unpack(last.rgb);
  for (let k = 1; k < keys.length; k++) {
    const lo = keys[k - 1];
    const hi = keys[k];
    if (lo === undefined || hi === undefined || min > hi.min) continue;
    const f = (min - lo.min) / (hi.min - lo.min);
    const a = unpack(lo.rgb);
    const b = unpack(hi.rgb);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  }
  return unpack(last.rgb);
}

// Packs three channel values (rounded, clamped to 0..255) into 0xRRGGBB.
function pack(r: number, g: number, b: number): number {
  const ch = (v: number): number => clamp(Math.round(v), 0, CHANNEL_MAX);
  return (ch(r) << 16) | (ch(g) << 8) | ch(b);
}

// The light tint of the ruin layers at minute min: one multiply of the blended keys. The era III front darkens every channel by
// lerp(1, frontDarken, p) on top.
export function dayTint(min: number, era: WorldEra, p: number): number {
  const [r, g, b] = keyChannels(min);
  const f = era === FRONT_ERA ? lerp(1, WORLD_DAY.frontDarken, clamp01(p)) : 1;
  return pack(r * f, g * f, b * f);
}

// Brightness of a tint: its brightest channel over full scale (0 to 1).
export function tintBrightness(rgb: number): number {
  const [r, g, b] = unpack(rgb);
  return Math.max(r, g, b) / CHANNEL_MAX;
}

// The weather of an era at tape position p. Ending phases stop the wind and the gusts (the postgame reads 'still'); the dust breathes
// only in still air with no ending. Virga and vents follow the era row and the vents flag.
export function weatherOf(era: WorldEra, p: number, phase: EndingPhase, vents: boolean): WeatherState {
  const row = WORLD_WEATHER.eras[era];
  const ending = phase !== 'none';
  const f = clamp01(p);
  return {
    era,
    label: phase === 'postgame' ? 'still' : WORLD_WEATHER.labels[era],
    baseWind: ending ? 0 : lerp(row.wind[0], row.wind[1], f),
    gusts: row.gusts && !ending,
    virgaAlpha: lerp(row.virgaAlpha[0], row.virgaAlpha[1], f),
    virgaSpeed: lerp(row.virgaSpeed[0], row.virgaSpeed[1], f),
    dustDrift: era === STILL_ERA && !ending,
    vents,
  };
}

// Gust events of one seed, memoized: event k starts gustAt(k).afterMs after event k - 1 ends and lasts gustAt(k).lengthMs. The list
// grows lazily to the queried time (a cache: the values never depend on the query order).
interface GustTrack { starts: number[]; lengths: number[]; endMs: number }
const gustTracks = new Map<number, GustTrack>();

function gustTrack(seed: number): GustTrack {
  let track = gustTracks.get(seed);
  if (track === undefined) {
    track = { starts: [], lengths: [], endMs: 0 };
    gustTracks.set(seed, track);
  }
  return track;
}

// Appends events until the last one ends after tMs. A gust row with no gap and no length cannot advance, so the list stops there.
function extendGusts(track: GustTrack, seed: number, tMs: number): void {
  while (track.endMs <= tMs) {
    const gust = gustAt(track.starts.length, seed);
    if (!(gust.afterMs + gust.lengthMs > 0)) return;
    const start = track.endMs + gust.afterMs;
    track.starts.push(start);
    track.lengths.push(gust.lengthMs);
    track.endMs = start + gust.lengthMs;
  }
}

// Index of the last start at or before t, or -1 (the starts ascend).
function lastStartAtOrBefore(starts: readonly number[], t: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const start = starts[mid];
    if (start !== undefined && start <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

// The hash gust bump at tMs: amp × sin²(π × progress) inside an event (it rises and falls back to calm), else 0.
function gustBump(tMs: number, seed: number): number {
  const track = gustTrack(seed);
  extendGusts(track, seed, tMs);
  const j = lastStartAtOrBefore(track.starts, tMs);
  if (j < 0) return 0;
  const start = track.starts[j];
  const length = track.lengths[j];
  if (start === undefined || length === undefined || !(length > 0) || tMs >= start + length) return 0;
  const s = Math.sin(Math.PI * ((tMs - start) / length));
  return WORLD_WEATHER.gustEvent.amp * s * s;
}

// The three gust sines at tMs: each has its own period and a phase hashed from the seed.
function gustSinesAt(tMs: number, seed: number): number {
  let sum = 0;
  WORLD_WEATHER.gustSines.forEach((sine, j) => {
    sum += sine.amp * Math.sin((2 * Math.PI * tMs) / sine.periodMs + 2 * Math.PI * hash01(seed, j));
  });
  return sum;
}

// Wind at tMs in [0, windMax]: base × (1 + gust), gust = the three sines plus the hash gust events. Still air (no gusts) reads the base.
export function windAt(tMs: number, weather: WeatherState, seed: number): number {
  const t = Number.isFinite(tMs) ? tMs : 0;
  const { windMax } = WORLD_WEATHER;
  if (!weather.gusts) return clamp(weather.baseWind, 0, windMax);
  const gust = gustSinesAt(t, seed) + gustBump(t, seed);
  return clamp(weather.baseWind * (1 + gust), 0, windMax);
}

// The base wind slewed toward its target at windSlewPerS (per second): it never overshoots.
export function easeBaseWind(current: number, target: number, dtMs: number): number {
  const step = WORLD_WEATHER.windSlewPerS * nonNeg(dtMs) / 1000;
  const gap = target - current;
  if (!(Math.abs(gap) > step)) return target;
  return current + Math.sign(gap) * step;
}

// The dust stream's speed factor at tMs: 1 ± amp on one sine in still air (era V with no ending), else exactly 1.
export function dustDriftAt(tMs: number, weather: WeatherState): number {
  if (!weather.dustDrift) return 1;
  const { amp, periodMs } = WORLD_WEATHER.dustDrift;
  return 1 + amp * Math.sin((2 * Math.PI * tMs) / periodMs);
}

// The gap (ms) to vent puff k while the vents are on: a world schedule by hash, not tied to the steam bursts (D6).
export function ventPuffAt(k: number, seed: number): number {
  return span(WORLD_WEATHER.ventPuff.everyMs, hash01(seed + WORLD_AMBIENT.seeds.vent, k));
}

// Gust event k: the gap before it (afterMs) and its length (lengthMs), by hash.
export function gustAt(k: number, seed: number): { afterMs: number; lengthMs: number } {
  const event = WORLD_WEATHER.gustEvent;
  const s = seed + WORLD_AMBIENT.seeds.gust;
  return { afterMs: span(event.everyMs, hash01(s, 2 * k)), lengthMs: span(event.lengthMs, hash01(s, 2 * k + 1)) };
}

// Whether a micro kind runs in an era (its row's eras).
export function microActive(kind: MicroKind, era: WorldEra): boolean {
  const eras: readonly WorldEra[] = WORLD_AMBIENT.micro[kind].eras;
  return eras.includes(era);
}

// Micro event k of a kind: the gap before it and its hold, inside the row ranges by hash. A kind that is off in the era never fires
// (afterMs Infinity, holdMs 0).
export function microAt(kind: MicroKind, k: number, seed: number, era: WorldEra): { afterMs: number; holdMs: number } {
  if (!microActive(kind, era)) return { afterMs: Infinity, holdMs: 0 };
  const row = WORLD_AMBIENT.micro[kind];
  const s = seed + WORLD_AMBIENT.seeds.micro + MICRO_KINDS.indexOf(kind);
  return { afterMs: span(row.everyMs, hash01(s, 2 * k)), holdMs: span(row.holdMs, hash01(s, 2 * k + 1)) };
}

// The per-mote constants of moteOrbit (radius, period, drift period, phase). They are hashed from (seed, i) once per seed and kept in a
// table of one entry per mote (WORLD_ENV.motes.count), so a frame reads them instead of drawing the hashes again.
interface MoteSpec { radius: number; period: number; driftPeriod: number; phase: number }

function newMoteSpec(): MoteSpec {
  return { radius: 0, period: 0, driftPeriod: 0, phase: 0 };
}

// Fills one mote's constants with the per-call formulas (the same operations in the same order, so the orbit is bit-equal).
function fillMoteSpec(spec: MoteSpec, i: number, seed: number): void {
  const { radiusPx, periodMs, driftPeriods } = WORLD_AMBIENT.motes;
  spec.radius = radiusPx[0] + (radiusPx[1] - radiusPx[0]) * hash01(seed, i);
  spec.period = periodMs[0] + (periodMs[1] - periodMs[0]) * hash01(seed, i + 10);
  spec.driftPeriod = spec.period * driftPeriods;
  spec.phase = hash01(seed, i + 20) * 2 * Math.PI;
}

// The table holds the seed it was filled with; a new seed refills it at once. A mote index past the table is filled in the scratch spec.
const MOTE_TABLE: MoteSpec[] = Array.from({ length: WORLD_ENV.motes.count }, () => newMoteSpec());
const MOTE_SCRATCH = newMoteSpec();
let moteTableSeed: number | null = null;

// The constants of mote i for a seed: the table entry (refilled when the seed changes), or the scratch spec for an index outside the table.
function moteSpecOf(i: number, seed: number): MoteSpec {
  const spec = Number.isInteger(i) ? MOTE_TABLE[i] : undefined;
  if (spec === undefined) {
    fillMoteSpec(MOTE_SCRATCH, i, seed);
    return MOTE_SCRATCH;
  }
  if (moteTableSeed !== seed) {
    MOTE_TABLE.forEach((s, k) => fillMoteSpec(s, k, seed));
    moteTableSeed = seed;
  }
  return spec;
}

// Mote i at time tMs: each mote has its own radius, period and phase, hashed from (seed, i) inside WORLD_AMBIENT.motes, so no two motes
// share one ellipse. Its ellipse is half as tall as it is wide, and a slow sideways drift (up to driftPx, the sine running at driftPeriods
// mote periods) carries it along. Whole art px, never -0. The seed is optional (0 for the default).
export function moteOrbit(i: number, tMs: number, seed = 0): { dx: number; dy: number } {
  const { driftPx } = WORLD_AMBIENT.motes;
  const spec = moteSpecOf(i, seed);
  const angle = 2 * Math.PI * (tMs / spec.period) + spec.phase;
  const drift = roundZero(driftPx * Math.sin(2 * Math.PI * (tMs / spec.driftPeriod) + spec.phase));
  return {
    dx: roundZero(roundZero(spec.radius * Math.cos(angle)) + drift),
    dy: roundZero((spec.radius / 2) * Math.sin(angle)),
  };
}

// The shadow shift and widening at minute min: 0 at the start of the day, the full dxMaxPx and widthScaleMax at the held minute.
export function shadowOf(min: number): { dx: number; widthScale: number } {
  const { startMin, heldMin, shadow } = WORLD_DAY;
  const f = clamp01((min - startMin) / (heldMin - startMin));
  return { dx: shadow.dxMaxPx * f, widthScale: 1 + (shadow.widthScaleMax - 1) * f };
}

// The lamp glow gain at minute min: 1 up to the ramp start, rising linearly to max at the ramp end.
export function lampGain(min: number): number {
  const { fromMin, toMin, max } = WORLD_DAY.lampGain;
  if (min <= fromMin) return 1;
  if (min >= toMin) return max;
  return 1 + (max - 1) * (min - fromMin) / (toMin - fromMin);
}
