import type { TechId } from './types';

// Music bed tuning (WP15). Every music number lives here; src/audio only reads it.
// Times in seconds, frequencies in Hz, gains linear (0..1). `scale` is semitones, or frequency ratios when `just` is true.
// `progression` holds one scale index per bar (0-based, always < scale.length); it cycles over `bars`.

export type MusicThemeId = 'mech' | 'elec' | 'therm' | 'reson' | 'exotic' | 'restored';
export type MusicVoice = 'pluck' | 'pulse' | 'swell' | 'bell' | 'reverse' | 'warm';

export interface MusicNoteEvent {
  startS: number; durS: number; hz: number; gain: number; voice: MusicVoice; bass: boolean;
}

export interface MusicTheme {
  id: MusicThemeId;
  rootHz: number;
  scale: readonly number[];
  just?: boolean;
  progression: readonly number[];
  bpm: number;
  beatsPerBar: number;
  bars: number;
  variations: number;
  voice: MusicVoice;
  attackS: number;
  releaseS: number;
  lowpassHz: number;
  detuneCents: number;
  density: number;
  peak: number;
  bassPeak: number;
}

// Keystone tech -> theme, highest owned wins (D3). Order is the priority order.
const KEYSTONES: readonly (readonly [TechId, MusicThemeId])[] = [
  ['generator', 'elec'],
  ['boiler', 'therm'],
  ['resonatorSpire', 'reson'],
  ['nullChamber', 'exotic'],
];

const THEMES: Record<MusicThemeId, MusicTheme> = {
  mech: {
    id: 'mech', rootHz: 110, scale: [0, 3, 5, 7, 10], progression: [0, 3, 1, 4],
    bpm: 56, beatsPerBar: 4, bars: 8, variations: 2,
    voice: 'pluck', attackS: 0.01, releaseS: 1.2, lowpassHz: 1400, detuneCents: 0,
    density: 0.35, peak: 0.07, bassPeak: 0.06,
  },
  elec: {
    id: 'elec', rootHz: 98, scale: [0, 2, 3, 5, 7, 8, 10], progression: [0, 3, 0, 4],
    bpm: 60, beatsPerBar: 4, bars: 8, variations: 2,
    voice: 'pulse', attackS: 0.005, releaseS: 0.4, lowpassHz: 900, detuneCents: 6,
    density: 0.5, peak: 0.05, bassPeak: 0.05,
  },
  therm: {
    id: 'therm', rootHz: 73.42, scale: [0, 1, 3, 5, 7, 8, 10], progression: [0, 1, 0, 6],
    bpm: 52, beatsPerBar: 4, bars: 8, variations: 2,
    voice: 'swell', attackS: 1.2, releaseS: 2.0, lowpassHz: 600, detuneCents: 0,
    density: 0.25, peak: 0.06, bassPeak: 0.06,
  },
  reson: {
    id: 'reson', rootHz: 110, just: true, scale: [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3], progression: [0, 1, 0, 3],
    bpm: 48, beatsPerBar: 4, bars: 8, variations: 2,
    voice: 'bell', attackS: 0.005, releaseS: 3.0, lowpassHz: 3000, detuneCents: 0,
    density: 0.3, peak: 0.06, bassPeak: 0.06,
  },
  exotic: {
    id: 'exotic', rootHz: 82, scale: [0, 2, 4, 6, 8, 10], progression: [1, 4, 1, 4, 2, 4],
    bpm: 40, beatsPerBar: 4, bars: 6, variations: 2,
    voice: 'reverse', attackS: 2.0, releaseS: 0.05, lowpassHz: 1200, detuneCents: 0,
    density: 0.2, peak: 0.05, bassPeak: 0.05,
  },
  restored: {
    id: 'restored', rootHz: 130.81, scale: [0, 2, 4, 5, 7, 9, 11], progression: [0, 4, 5, 3],
    bpm: 64, beatsPerBar: 4, bars: 8, variations: 2,
    voice: 'warm', attackS: 0.05, releaseS: 1.6, lowpassHz: 2000, detuneCents: 0,
    density: 0.4, peak: 0.07, bassPeak: 0.06,
  },
};

export const MUSIC = {
  themes: THEMES,
  keystones: KEYSTONES,
  busGain: 0.36,   // release tails overlap across bars: keeps the music sum <= 0.15 of full scale (WP15 review)
  chordToneChance: 0.7,   // chance a melody note is a chord tone (else a scale passing tone)
  lookaheadS: 0.5,
  maxEventsPerCall: 16,
  maxVoices: 8,
  crossfadeS: 6,
  startDelayS: 0.1,
  // Finale ducking (D6) and milestone dip.
  duck: { finaleOutS: 3, chordLevel: 0.25, chordRampS: 4, milestoneLevel: 0.5, milestoneS: 1.5 },
  // One shared echo for all music (3 nodes).
  space: { delayS: 0.38, feedback: 0.3, lowpassHz: 1800, wet: 0.25 },
  seed: 41,
} as const;

// Live readout for the debug hook and smoke tests (GameAudio.stats()).
export interface AudioStats {
  unlocked: boolean;
  running: boolean;
  theme: MusicThemeId | null;
  slotGains: [number, number];
  duck: number;
  liveVoices: number;
  musicVoices: number;
  dropped: number;
  peakDb: number | null;
}
