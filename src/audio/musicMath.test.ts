import { describe, it, expect } from 'vitest';
import { MUSIC } from '../data/music';
import type { MusicNoteEvent, MusicTheme, MusicThemeId } from '../data/music';
import { TECH_IDS } from '../data/types';
import type { EndingPhase, TechId } from '../data/types';
import {
  barSeconds,
  chordAt,
  crossfadeGains,
  duckLevel,
  eventsForBar,
  eventsInWindow,
  musicAllowed,
  musicContribution,
  musicTheme,
  mulberry32,
} from './musicMath';

const THEMES: MusicTheme[] = Object.values(MUSIC.themes);

function zeroLevels(): Record<TechId, number> {
  const levels = {} as Record<TechId, number>;
  for (const id of TECH_IDS) levels[id] = 0;
  return levels;
}

function levelsOwning(...owned: TechId[]): Record<TechId, number> {
  const levels = zeroLevels();
  for (const id of owned) levels[id] = 1;
  return levels;
}

/** Octave-independent pitch class in [0, 1) (log2 fraction), for chord-membership checks. */
function pitchClass(hz: number): number {
  const frac = Math.log2(hz) % 1;
  return frac < 0 ? frac + 1 : frac;
}

function samePitchClass(a: number, b: number): boolean {
  const d = Math.abs(pitchClass(a) - pitchClass(b));
  return Math.min(d, 1 - d) < 1e-9;
}

/** Scale tones of a theme as frequencies on its root (ratios when just, semitones otherwise). */
function scaleHz(theme: MusicTheme): number[] {
  return theme.scale.map((s) => (theme.just ? theme.rootHz * s : theme.rootHz * 2 ** (s / 12)));
}

function loopOf(theme: MusicTheme): number {
  return theme.bars * theme.variations;
}

describe('mulberry32', () => {
  it('same seed gives the same sequence; different seeds diverge', () => {
    const a = mulberry32(41);
    const b = mulberry32(41);
    const c = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    const seqC = Array.from({ length: 20 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('returns floats in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('barSeconds and chordAt', () => {
  it('barSeconds is beatsPerBar at bpm', () => {
    const mech = MUSIC.themes.mech;
    expect(barSeconds(mech)).toBeCloseTo((4 * 60) / 56, 9);
  });

  it('chordAt returns three finite tones on the progression root', () => {
    for (const theme of THEMES) {
      const tones = chordAt(theme, 0);
      expect(tones).toHaveLength(3);
      for (const hz of tones) expect(Number.isFinite(hz) && hz > 0).toBe(true);
    }
    expect(chordAt(MUSIC.themes.mech, 0)[0]).toBeCloseTo(110, 9);
  });

  it('chordAt on a just theme uses the ratio table (root, 5/4, 5/3 for reson degree I)', () => {
    const reson = MUSIC.themes.reson;
    const [root, third, sixth] = chordAt(reson, 0);
    expect(root).toBeCloseTo(110, 9);
    expect(third).toBeCloseTo(110 * (5 / 4), 9);
    expect(sixth).toBeCloseTo(110 * (5 / 3), 9);
  });
});

describe('eventsForBar', () => {
  it('is deterministic for the same theme, bar and seed', () => {
    for (const theme of THEMES) {
      for (let bar = 0; bar < loopOf(theme); bar++) {
        expect(eventsForBar(theme, bar, MUSIC.seed)).toEqual(eventsForBar(theme, bar, MUSIC.seed));
      }
    }
  });

  it('repeats every bars x variations bars (loop period)', () => {
    for (const theme of THEMES) {
      const period = loopOf(theme);
      for (let bar = 0; bar < period; bar++) {
        expect(eventsForBar(theme, bar + period, MUSIC.seed), `${theme.id} bar ${bar}`).toEqual(
          eventsForBar(theme, bar, MUSIC.seed),
        );
      }
    }
  });

  it('starts with a bass note on beat 1, an octave under the chord root', () => {
    for (const theme of THEMES) {
      const first = eventsForBar(theme, 0, MUSIC.seed)[0];
      expect(first?.bass).toBe(true);
      expect(first?.startS).toBe(0);
      expect(first?.gain).toBe(theme.bassPeak);
      expect(first?.hz).toBeCloseTo(chordAt(theme, 0)[0]! / 2, 9);
    }
  });

  it('every note is a chord tone (or a scale passing tone) and every bass note is the chord root', () => {
    for (const theme of THEMES) {
      const scale = scaleHz(theme);
      for (let bar = 0; bar < loopOf(theme); bar++) {
        const chord = chordAt(theme, bar);
        for (const ev of eventsForBar(theme, bar, MUSIC.seed)) {
          const inChord = chord.some((hz) => samePitchClass(hz, ev.hz));
          const inScale = scale.some((hz) => samePitchClass(hz, ev.hz));
          expect(inChord || inScale, `${theme.id} bar ${bar} hz ${ev.hz}`).toBe(true);
          if (ev.bass) expect(samePitchClass(chord[0]!, ev.hz), `${theme.id} bass bar ${bar}`).toBe(true);
        }
      }
    }
  });

  it('all hz are finite and within 20 to 5000 Hz', () => {
    for (const theme of THEMES) {
      for (let bar = 0; bar < loopOf(theme); bar++) {
        for (const ev of eventsForBar(theme, bar, MUSIC.seed)) {
          expect(Number.isFinite(ev.hz)).toBe(true);
          expect(ev.hz).toBeGreaterThanOrEqual(20);
          expect(ev.hz).toBeLessThanOrEqual(5000);
        }
      }
    }
  });

  it('keeps every event inside its bar', () => {
    for (const theme of THEMES) {
      const barS = barSeconds(theme);
      for (let bar = 0; bar < loopOf(theme); bar++) {
        for (const ev of eventsForBar(theme, bar, MUSIC.seed)) {
          expect(ev.startS).toBeGreaterThanOrEqual(0);
          expect(ev.startS).toBeLessThan(barS);
          expect(ev.startS + ev.durS).toBeLessThanOrEqual(barS + 1e-9);
          expect(ev.durS).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never exceeds maxVoices sounding at once', () => {
    for (const theme of THEMES) {
      for (let bar = 0; bar < loopOf(theme); bar++) {
        const events = eventsForBar(theme, bar, MUSIC.seed);
        for (const ev of events) {
          const live = events.filter((o) => o.startS <= ev.startS && ev.startS < o.startS + o.durS).length;
          expect(live).toBeLessThanOrEqual(MUSIC.maxVoices);
        }
      }
    }
  });
});

describe('eventsInWindow', () => {
  const theme = MUSIC.themes.restored;
  const barS = barSeconds(theme);
  const clock = 100;

  it('keeps events with start in [fromS, toS), sorted, absolute times', () => {
    const events = eventsInWindow(theme, clock, clock, clock + 2 * barS, 1000);
    expect(events.length).toBeGreaterThan(0);
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      expect(ev.startS).toBeGreaterThanOrEqual(clock);
      expect(ev.startS).toBeLessThan(clock + 2 * barS);
      if (i > 0) expect(ev.startS).toBeGreaterThanOrEqual(events[i - 1]!.startS);
    }
  });

  it('honours the cap', () => {
    expect(eventsInWindow(theme, clock, clock, clock + 4 * barS, 3).length).toBeLessThanOrEqual(3);
    expect(eventsInWindow(theme, clock, clock, clock + 4 * barS, 0)).toEqual([]);
  });

  it('adjacent windows never repeat an event and together cover the span', () => {
    const from = clock;
    const to = clock + 3 * barS;
    const whole = eventsInWindow(theme, clock, from, to, 1000);
    const step = MUSIC.lookaheadS;
    const pieces: MusicNoteEvent[] = [];
    for (let t = from; t < to; t += step) {
      pieces.push(...eventsInWindow(theme, clock, t, Math.min(to, t + step), 1000));
    }
    const keys = pieces.map((e) => `${e.startS}|${e.hz}|${e.voice}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(pieces.map((e) => e.startS)).toEqual(whole.map((e) => e.startS));
  });

  it('returns nothing for an empty or non-finite span', () => {
    expect(eventsInWindow(theme, clock, clock + 1, clock + 1, 10)).toEqual([]);
    expect(eventsInWindow(theme, clock, Number.NaN, clock + 1, 10)).toEqual([]);
    expect(eventsInWindow(theme, Number.POSITIVE_INFINITY, clock, clock + 1, 10)).toEqual([]);
  });

  it('keeps polyphony within maxVoices across bars', () => {
    for (const t of THEMES) {
      const events = eventsInWindow(t, clock, clock, clock + 2 * loopOf(t) * barSeconds(t), 100000);
      for (const ev of events) {
        const live = events.filter((o) => o.startS <= ev.startS && ev.startS < o.startS + o.durS).length;
        expect(live).toBeLessThanOrEqual(MUSIC.maxVoices);
      }
    }
  });
});

describe('musicTheme', () => {
  it('no keystone -> mech (reset / new cycle)', () => {
    expect(musicTheme(zeroLevels(), 'none')).toBe('mech');
  });

  it('each keystone maps to its theme', () => {
    expect(musicTheme(levelsOwning('generator'), 'none')).toBe('elec');
    expect(musicTheme(levelsOwning('boiler'), 'none')).toBe('therm');
    expect(musicTheme(levelsOwning('resonatorSpire'), 'none')).toBe('reson');
    expect(musicTheme(levelsOwning('nullChamber'), 'none')).toBe('exotic');
  });

  it('the highest owned keystone wins', () => {
    expect(musicTheme(levelsOwning('generator', 'boiler'), 'none')).toBe('therm');
    expect(musicTheme(levelsOwning('generator', 'nullChamber', 'boiler'), 'none')).toBe('exotic');
  });

  it('choice and postgame play restored whatever the keystones', () => {
    const all = levelsOwning('generator', 'boiler', 'resonatorSpire', 'nullChamber');
    const phases: EndingPhase[] = ['choice', 'postgame'];
    for (const phase of phases) {
      expect(musicTheme(all, phase)).toBe('restored');
      expect(musicTheme(zeroLevels(), phase)).toBe('restored');
    }
  });

  it('sequence has no theme (ducked silent)', () => {
    expect(musicTheme(levelsOwning('boiler'), 'sequence')).toBeNull();
  });

  it('returns only known theme ids', () => {
    const ids: MusicThemeId[] = ['mech', 'elec', 'therm', 'reson', 'exotic', 'restored'];
    const got = musicTheme(levelsOwning('nullChamber'), 'none');
    expect(ids).toContain(got);
  });
});

describe('crossfadeGains', () => {
  it('endpoints are exact: start [1, 0], end [0, 1]', () => {
    expect(crossfadeGains(0, MUSIC.crossfadeS)).toEqual([1, 0]);
    expect(crossfadeGains(MUSIC.crossfadeS, MUSIC.crossfadeS)).toEqual([0, 1]);
    expect(crossfadeGains(MUSIC.crossfadeS * 3, MUSIC.crossfadeS)).toEqual([0, 1]);
    expect(crossfadeGains(-2, MUSIC.crossfadeS)).toEqual([1, 0]);
  });

  it('is equal-power: out^2 + in^2 within 1e-6 of 1 across the fade', () => {
    for (let i = 0; i <= 60; i++) {
      const [out, inn] = crossfadeGains((i / 60) * MUSIC.crossfadeS, MUSIC.crossfadeS);
      expect(out * out + inn * inn).toBeCloseTo(1, 6);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(inn).toBeGreaterThanOrEqual(0);
    }
  });

  it('is halfway at half the time (equal gains)', () => {
    const [out, inn] = crossfadeGains(MUSIC.crossfadeS / 2, MUSIC.crossfadeS);
    expect(out).toBeCloseTo(Math.SQRT1_2, 9);
    expect(inn).toBeCloseTo(Math.SQRT1_2, 9);
  });
});

describe('duckLevel', () => {
  it('sequence: 1 at the swell beat, 0.5 at 1.5 s, 0 from 3 s on', () => {
    expect(duckLevel('sequence', 0, null, null)).toBeCloseTo(1, 9);
    expect(duckLevel('sequence', 1.5, null, null)).toBeCloseTo(0.5, 9);
    expect(duckLevel('sequence', 3, null, null)).toBeCloseTo(0, 9);
    expect(duckLevel('sequence', 10, null, null)).toBe(0);
  });

  it('sequence with no swell seen is silent', () => {
    expect(duckLevel('sequence', null, null, null)).toBe(0);
  });

  it('chord: 0.25 for 4 s, then linear to 1 at 8 s', () => {
    expect(duckLevel('postgame', null, 0, null)).toBeCloseTo(0.25, 9);
    expect(duckLevel('postgame', null, 3.9, null)).toBeCloseTo(0.25, 9);
    expect(duckLevel('postgame', null, 4, null)).toBeCloseTo(0.25, 9);
    expect(duckLevel('postgame', null, 6, null)).toBeCloseTo(0.625, 9);
    expect(duckLevel('postgame', null, 8, null)).toBeCloseTo(1, 9);
    expect(duckLevel('postgame', null, 20, null)).toBe(1);
  });

  it('milestone: 0.5 for 1.5 s, then 1', () => {
    expect(duckLevel('none', null, null, 0)).toBeCloseTo(0.5, 9);
    expect(duckLevel('none', null, null, 1.49)).toBeCloseTo(0.5, 9);
    expect(duckLevel('none', null, null, 1.5)).toBe(1);
  });

  it('no beat -> 1; overlapping ducks take the minimum', () => {
    expect(duckLevel('none', null, null, null)).toBe(1);
    expect(duckLevel('postgame', null, 0, 0)).toBeCloseTo(0.25, 9);
  });

  it('invalid since values count as no beat', () => {
    expect(duckLevel('none', null, Number.NaN, null)).toBe(1);
    expect(duckLevel('none', null, -1, null)).toBe(1);
  });

  it('always within 0..1', () => {
    for (const phase of ['none', 'sequence', 'choice', 'postgame'] as const) {
      for (const t of [0, 0.5, 1.5, 3, 4, 6, 8, 12]) {
        const level = duckLevel(phase, t, t, t);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('musicAllowed', () => {
  it('true when audible, visible and both volumes are above 0', () => {
    expect(musicAllowed(false, 70, 70, true)).toBe(true);
  });

  it('false when muted, hidden, or either volume is 0', () => {
    expect(musicAllowed(true, 70, 70, true)).toBe(false);
    expect(musicAllowed(false, 0, 70, true)).toBe(false);
    expect(musicAllowed(false, 70, 0, true)).toBe(false);
    expect(musicAllowed(false, 70, 70, false)).toBe(false);
    expect(musicAllowed(false, Number.NaN, 70, true)).toBe(false);
  });
});

describe('musicContribution', () => {
  it('each theme at the music bus stays within 0.15 (C2)', () => {
    for (const theme of THEMES) {
      expect(musicContribution(theme), theme.id).toBeLessThanOrEqual(0.15);
      expect(musicContribution(theme), theme.id).toBeGreaterThan(0);
    }
  });
});
