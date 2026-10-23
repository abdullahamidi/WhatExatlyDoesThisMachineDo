// Pure music scheduling maths (WP15 D2). No WebAudio, no DOM, no clock: gameAudio passes times in,
// synth only plays the returned events. Randomness is seeded (mulberry32), so a theme and bar always give the same notes.

import { AUDIO } from '../data/audio';
import { MUSIC } from '../data/music';
import type { MusicNoteEvent, MusicTheme, MusicThemeId } from '../data/music';
import type { EndingPhase, TechId } from '../data/types';
import { currentEra } from '../simulation/progression/era';

/** Chance that a note slot takes a chord tone (else a scale passing tone). Musical structure from WP15 C1 (p .7). */

/** Seeded PRNG (mulberry32): returns a function giving floats in [0, 1). Same seed, same sequence. */
export function mulberry32(seed: number): () => number {
  let state = Number.isFinite(seed) ? seed >>> 0 : 0;
  return () => {
    state = (state + 1831565813) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a theme id, as an unsigned 32-bit int. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Seed for one bar: mixes the global seed, the theme and the bar's variation index. */
function barSeed(seed: number, themeId: MusicThemeId, bar: number): number {
  return (seed ^ hashId(themeId) ^ Math.imul(bar + 1, 2654435761)) >>> 0;
}

/** Bars in one loop: bars x variations. */
function loopBars(theme: MusicTheme): number {
  return Math.max(1, Math.floor(theme.bars * theme.variations));
}

/** Variation index of a bar: bar modulo the loop length, always in [0, loop). Non-finite input -> 0. */
function variationBar(theme: MusicTheme, bar: number): number {
  if (!Number.isFinite(bar)) return 0;
  const period = loopBars(theme);
  const n = Math.floor(bar);
  return ((n % period) + period) % period;
}

/** Chord root scale index for a bar (progression cycles over the loop). */
function chordDegree(theme: MusicTheme, bar: number): number {
  const len = theme.progression.length;
  if (len === 0) return 0;
  return theme.progression[variationBar(theme, bar) % len] ?? 0;
}

/** Frequency of scale index k (may run past the scale: each lap up is one octave). */
function degreeHz(theme: MusicTheme, k: number): number {
  const n = theme.scale.length;
  if (n === 0) return theme.rootHz;
  const oct = Math.floor(k / n);
  const step = theme.scale[k - oct * n] ?? 0;
  if (theme.just) return theme.rootHz * step * 2 ** oct;
  return theme.rootHz * 2 ** ((step + 12 * oct) / 12);
}

/** Duration of one bar in seconds: beatsPerBar beats at bpm. */
export function barSeconds(theme: MusicTheme): number {
  return (theme.beatsPerBar * 60) / theme.bpm;
}

/** Chord tone frequencies of a bar: the triad on the bar's chord root (root, third, fifth by scale index). */
export function chordAt(theme: MusicTheme, bar: number): number[] {
  const d = chordDegree(theme, bar);
  return [degreeHz(theme, d), degreeHz(theme, d + 2), degreeHz(theme, d + 4)];
}

/** Count of events sounding at time t (start <= t < start + dur). */
function activeAt(events: readonly MusicNoteEvent[], t: number): number {
  let n = 0;
  for (const ev of events) if (ev.startS <= t && t < ev.startS + ev.durS) n++;
  return n;
}

/**
 * Events of one bar, times relative to the bar start (0 .. barSeconds). Deterministic for (theme, bar, seed).
 * Bar bass: chord root an octave down on beat 1, sustained for the bar. Each 8th slot: density chance of a note,
 * a chord tone (MUSIC.chordToneChance) or a scale passing tone next to the root. Polyphony is capped at MUSIC.maxVoices.
 */
export function eventsForBar(theme: MusicTheme, bar: number, seed: number): MusicNoteEvent[] {
  const b = variationBar(theme, bar);
  const rng = mulberry32(barSeed(seed, theme.id, b));
  const barS = barSeconds(theme);
  const slots = theme.beatsPerBar * 2;
  const slotS = barS / slots;
  const d = chordDegree(theme, b);

  const events: MusicNoteEvent[] = [
    { startS: 0, durS: barS, hz: degreeHz(theme, d) / 2, gain: theme.bassPeak, voice: theme.voice, bass: true },
  ];
  const chordTones = [d, d + 2, d + 4];
  for (let k = 0; k < slots; k++) {
    const sounds = rng() < theme.density;
    const chord = rng() < MUSIC.chordToneChance;
    const pick = Math.floor(rng() * chordTones.length);
    const up = rng() < 0.5;
    if (!sounds) continue;
    const degree = chord ? (chordTones[pick] ?? d) : d + (up ? 1 : -1);
    const startS = k * slotS;
    if (activeAt(events, startS) >= MUSIC.maxVoices) continue;
    events.push({ startS, durS: slotS, hz: degreeHz(theme, degree), gain: theme.peak, voice: theme.voice, bass: false });
  }
  return events;
}

/**
 * Music events whose absolute start lies in [fromS, toS), sorted, at most `cap`. Bars are counted from clockStartS
 * (the theme's clock, an AudioContext time). Adjacent spans never repeat an event: each event has one start time.
 */
export function eventsInWindow(
  theme: MusicTheme,
  clockStartS: number,
  fromS: number,
  toS: number,
  cap: number,
): MusicNoteEvent[] {
  if (![clockStartS, fromS, toS, cap].every(Number.isFinite) || !(toS > fromS) || !(cap > 0)) return [];
  const barS = barSeconds(theme);
  if (!(barS > 0)) return [];
  const firstBar = Math.max(0, Math.floor((fromS - clockStartS) / barS));
  const lastBar = Math.floor((toS - clockStartS) / barS);
  const out: MusicNoteEvent[] = [];
  for (let bar = firstBar; bar <= lastBar; bar++) {
    const barStart = clockStartS + bar * barS;
    for (const ev of eventsForBar(theme, bar, MUSIC.seed)) {
      const startS = barStart + ev.startS;
      if (startS < fromS || startS >= toS) continue;
      out.push({ ...ev, startS });
    }
  }
  out.sort((a, b) => a.startS - b.startS || a.hz - b.hz);
  return out.length > cap ? out.slice(0, Math.floor(cap)) : out;
}

/**
 * Equal-power crossfade over durS: [out, in] with out^2 + in^2 = 1 (cos / sin of a quarter turn).
 * elapsed <= 0 (or NaN) -> [1, 0]; elapsed >= durS (or durS <= 0) -> [0, 1] exactly.
 */
export function crossfadeGains(elapsedS: number, durS: number): [number, number] {
  if (!(elapsedS > 0)) return [1, 0];
  if (!(durS > 0) || elapsedS >= durS) return [0, 1];
  const angle = ((elapsedS / durS) * Math.PI) / 2;
  return [Math.cos(angle), Math.sin(angle)];
}

/** Null-safe "seconds since": NaN or negative counts as not started. */
function sinceOf(v: number | null): number | null {
  return v === null || !(v >= 0) ? null : v;
}

/** Sequence duck (D6): 1 at the swell beat, linear to 0 over finaleOutS, 0 after. No swell seen in the sequence -> 0. */
function swellDuck(sinceS: number | null): number {
  if (sinceS === null) return 0;
  const span = MUSIC.duck.finaleOutS;
  if (!(span > 0)) return 0;
  return 1 - Math.min(1, sinceS / span);
}

/** Chord duck (D6): chordLevel for the resolve chord length, then linear to 1 over chordRampS. */
function chordDuck(sinceS: number): number {
  const hold = AUDIO.resolveChord.ms / 1000;
  const ramp = MUSIC.duck.chordRampS;
  const low = MUSIC.duck.chordLevel;
  if (sinceS < hold) return low;
  if (sinceS >= hold + ramp) return 1;
  return low + (1 - low) * ((sinceS - hold) / ramp);
}

/** Milestone duck (D6): milestoneLevel for milestoneS, then back to 1. */
function milestoneDuck(sinceS: number): number {
  return sinceS < MUSIC.duck.milestoneS ? MUSIC.duck.milestoneLevel : 1;
}

/**
 * Music level 0..1 from the finale beats (D6). Minimum of the active ducks; no active duck -> 1.
 * The sequence duck applies only in phase 'sequence'. Pass null for a beat that has not happened.
 */
export function duckLevel(
  phase: EndingPhase,
  sinceSwellS: number | null,
  sinceChordS: number | null,
  sinceMilestoneS: number | null,
): number {
  let level = 1;
  if (phase === 'sequence') level = Math.min(level, swellDuck(sinceOf(sinceSwellS)));
  const chord = sinceOf(sinceChordS);
  if (chord !== null) level = Math.min(level, chordDuck(chord));
  const milestone = sinceOf(sinceMilestoneS);
  if (milestone !== null) level = Math.min(level, milestoneDuck(milestone));
  return Math.min(1, Math.max(0, level));
}

/**
 * Theme from the tech levels and ending phase (D3). Phase 'sequence' -> null (music ducked silent).
 * choice / postgame -> restored. Otherwise the theme of the simulation era (MUSIC.eraThemes[currentEra]).
 */
export function musicTheme(techLevels: Readonly<Record<TechId, number>>, phase: EndingPhase): MusicThemeId | null {
  if (phase === 'sequence') return null;
  if (phase === 'choice' || phase === 'postgame') return 'restored';
  return MUSIC.eraThemes[currentEra(techLevels)];
}

/**
 * Loudest music level of a theme at the music bus (WP15 C2): busGain x the largest sum of note gains sounding at
 * once, over one full loop. A note sounds for its durS plus its release tail, so a bar's notes are summed with the
 * tails of the bars before it (an event starts at or after its bar, so only earlier bars can still be sounding).
 */
export function musicContribution(theme: MusicTheme): number {
  let peak = 0;
  const loop = loopBars(theme);
  const barS = barSeconds(theme);
  const tail = theme.releaseS;
  // Earlier bars whose tails can still reach into this bar: a tail longer than one bar reaches further back.
  const reach = 1 + Math.ceil(tail / barS);
  for (let bar = 0; bar < loop; bar++) {
    const sounding: MusicNoteEvent[] = [];
    for (let back = 0; back <= reach; back++) {
      const shiftS = back * barS;
      for (const ev of eventsForBar(theme, bar - back, MUSIC.seed)) {
        sounding.push({ ...ev, startS: ev.startS - shiftS });
      }
    }
    for (const ev of eventsForBar(theme, bar, MUSIC.seed)) {
      let sum = 0;
      for (const other of sounding) {
        if (other.startS <= ev.startS && ev.startS < other.startS + other.durS + tail) sum += other.gain;
      }
      peak = Math.max(peak, sum);
    }
  }
  return MUSIC.busGain * peak;
}

/** Music may play only when not muted, the tab is visible, and both master and music volumes are above 0. */
export function musicAllowed(muted: boolean, masterVol: number, musicVol: number, visible: boolean): boolean {
  return !muted && visible && masterVol > 0 && musicVol > 0;
}
