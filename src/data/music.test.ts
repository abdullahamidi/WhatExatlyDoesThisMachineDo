import { describe, it, expect } from 'vitest';
import { MUSIC } from './music';
import type { MusicThemeId, MusicTheme } from './music';
import { AUDIO } from './audio';
import type { BedId } from './audio';
import { ERA_KEYSTONES } from './eras';

const THEME_IDS: MusicThemeId[] = ['mech', 'elec', 'therm', 'reson', 'exotic', 'restored'];
const THEMES: MusicTheme[] = THEME_IDS.map((id) => MUSIC.themes[id]);

describe('MUSIC themes', () => {
  it('has exactly the six contract themes, each keyed by its own id', () => {
    expect(Object.keys(MUSIC.themes).sort()).toEqual([...THEME_IDS].sort());
    for (const id of THEME_IDS) expect(MUSIC.themes[id].id).toBe(id);
  });

  it.each(THEME_IDS)('%s: scale is ascending, non-empty, and starts at the root', (id) => {
    const t = MUSIC.themes[id];
    expect(t.scale.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < t.scale.length; i++) {
      const prev = t.scale[i - 1] ?? NaN;
      const cur = t.scale[i] ?? NaN;
      expect(cur).toBeGreaterThan(prev);
    }
    expect(t.scale[0]).toBe(t.just ? 1 : 0);
  });

  it.each(THEME_IDS)('%s: progression degrees index into the scale', (id) => {
    const t = MUSIC.themes[id];
    expect(t.progression.length).toBeGreaterThan(0);
    for (const deg of t.progression) {
      expect(Number.isInteger(deg)).toBe(true);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(t.scale.length);
    }
  });

  it.each(THEME_IDS)('%s: tempo, bars and variations are sane', (id) => {
    const t = MUSIC.themes[id];
    expect(t.bpm).toBeGreaterThanOrEqual(30);
    expect(t.bpm).toBeLessThanOrEqual(90);
    expect(t.beatsPerBar).toBeGreaterThan(0);
    expect(Number.isInteger(t.bars)).toBe(true);
    expect(t.bars).toBeGreaterThan(0);
    expect(Number.isInteger(t.variations)).toBe(true);
    expect(t.variations).toBeGreaterThanOrEqual(1);
  });

  it.each(THEME_IDS)('%s: levels stay quiet and densities are fractions', (id) => {
    const t = MUSIC.themes[id];
    expect(t.peak).toBeGreaterThan(0);
    expect(t.peak).toBeLessThanOrEqual(0.1);
    expect(t.bassPeak).toBeGreaterThan(0);
    expect(t.bassPeak).toBeLessThanOrEqual(0.1);
    expect(t.density).toBeGreaterThanOrEqual(0);
    expect(t.density).toBeLessThanOrEqual(1);
  });

  it.each(THEME_IDS)('%s: pitch, envelope and filter values are positive and finite', (id) => {
    const t = MUSIC.themes[id];
    for (const v of [t.rootHz, t.attackS, t.releaseS, t.lowpassHz]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
    expect(Number.isFinite(t.detuneCents)).toBe(true);
    expect(t.detuneCents).toBeGreaterThanOrEqual(0);
  });

  it('keeps the contract voices for the themes that name one', () => {
    expect(MUSIC.themes.mech.voice).toBe('pluck');
    expect(MUSIC.themes.elec.voice).toBe('pulse');
    expect(MUSIC.themes.therm.voice).toBe('swell');
    expect(MUSIC.themes.reson.voice).toBe('bell');
    expect(MUSIC.themes.exotic.voice).toBe('reverse');
    expect(MUSIC.themes.restored.voice).toBe('warm');
  });

  it('exotic never returns to the tonic (no degree 0)', () => {
    expect(MUSIC.themes.exotic.progression).not.toContain(0);
  });
});

describe('MUSIC eraThemes', () => {
  it('maps eras 1..5 to mech, elec, therm, reson, exotic', () => {
    expect(MUSIC.eraThemes).toEqual({ 1: 'mech', 2: 'elec', 3: 'therm', 4: 'reson', 5: 'exotic' });
  });

  it('uses only existing theme ids, all distinct, and never restored', () => {
    const values = Object.values(MUSIC.eraThemes);
    for (const theme of values) {
      expect(Object.keys(MUSIC.themes)).toContain(theme);
      expect(theme).not.toBe('restored');
    }
    expect(new Set(values).size).toBe(5);
  });

  it('gives every keystone era a theme other than the era I theme', () => {
    for (const { era } of ERA_KEYSTONES) {
      expect(MUSIC.eraThemes[era]).not.toBe(MUSIC.eraThemes[1]);
    }
  });

  it('no longer carries the old keystone list', () => {
    expect('keystones' in MUSIC).toBe(false);
  });
});

describe('MUSIC scheduler constants', () => {
  it('keeps the scheduler lookahead above the audio tick so windows never starve', () => {
    expect(MUSIC.lookaheadS).toBeGreaterThan(AUDIO.updateIntervalMs / 1000);
  });

  it('has sane mix and voice caps', () => {
    expect(MUSIC.busGain).toBeGreaterThan(0);
    expect(MUSIC.busGain).toBeLessThanOrEqual(1);
    expect(MUSIC.maxEventsPerCall).toBeGreaterThan(0);
    expect(MUSIC.maxVoices).toBeGreaterThanOrEqual(1);
    expect(MUSIC.crossfadeS).toBeGreaterThan(0);
    expect(MUSIC.startDelayS).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(MUSIC.seed)).toBe(true);
  });

  it('keeps duck levels as fractions of full volume', () => {
    expect(MUSIC.duck.chordLevel).toBeGreaterThanOrEqual(0);
    expect(MUSIC.duck.chordLevel).toBeLessThanOrEqual(1);
    expect(MUSIC.duck.milestoneLevel).toBeGreaterThanOrEqual(0);
    expect(MUSIC.duck.milestoneLevel).toBeLessThanOrEqual(1);
    expect(MUSIC.duck.finaleOutS).toBeGreaterThan(0);
    expect(MUSIC.duck.chordRampS).toBeGreaterThan(0);
    expect(MUSIC.duck.milestoneS).toBeGreaterThan(0);
  });
});

describe('AUDIO mix data (WP15)', () => {
  const BEDS: BedId[] = ['hum', 'gear', 'mains', 'boiler', 'pad', 'servo', 'drone', 'wind', 'rain'];
  // First era (1-based) in which each bed exists in the game.
  const FIRST_ERA: Record<BedId, number> = {
    hum: 1, gear: 1, wind: 1, mains: 2, boiler: 3, pad: 4, servo: 4, drone: 5, rain: 3,
  };
  // WP26: the boiler is re-trimmed in its own first era (era III) so the rain bed fits the 0.45 sum; every other bed starts untrimmed.
  const FIRST_ERA_TRIM: Partial<Record<BedId, number>> = { boiler: 0.8 };

  it('has a trim row for every bed with five eras', () => {
    expect(Object.keys(AUDIO.bedTrim).sort()).toEqual([...BEDS].sort());
    for (const bed of BEDS) expect(AUDIO.bedTrim[bed]).toHaveLength(5);
  });

  it.each(BEDS)('%s: trims are in (0, 1]', (bed) => {
    for (const v of AUDIO.bedTrim[bed]) {
      // Rain is silent from era IV (trim 0); every other bed stays audible.
      if (bed === 'rain') expect(v).toBeGreaterThanOrEqual(0);
      else expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it.each(BEDS)('%s: first present era is untrimmed (boiler: WP26 re-trim) and later eras never grow', (bed) => {
    const row = AUDIO.bedTrim[bed];
    const first = FIRST_ERA[bed] - 1;
    expect(row[first]).toBe(FIRST_ERA_TRIM[bed] ?? 1);
    for (let i = first + 1; i < row.length; i++) {
      expect(row[i] ?? NaN).toBeLessThanOrEqual(row[i - 1] ?? NaN);
    }
  });

  it('limiter sits below the master with a finite release', () => {
    const l = AUDIO.limiter;
    expect(l.threshold).toBeLessThan(0);
    expect(l.knee).toBeGreaterThanOrEqual(0);
    expect(l.ratio).toBeGreaterThanOrEqual(1);
    expect(l.attack).toBeGreaterThan(0);
    expect(l.release).toBeGreaterThan(0);
  });
});
