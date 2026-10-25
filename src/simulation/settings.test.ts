import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS_VALUES, NOTATIONS, REDUCED_MOTION, UI_SCALES, VOLUME_RANGE, WORLD_VOICES } from '../data/settings';
import type { SettingsState } from '../data/types';
import { motionPolicy, normalizeSettings } from './settings';

const D = DEFAULT_SETTINGS_VALUES;

describe('normalizeSettings defaults', () => {
  it('returns the default values for undefined input', () => {
    expect(normalizeSettings(undefined)).toEqual(D);
  });

  it('returns the default values for an empty object', () => {
    expect(normalizeSettings({})).toEqual(D);
  });

  it('keeps valid values unchanged', () => {
    const valid: SettingsState = {
      muted: true, masterVolume: 40, sfxVolume: 0, ambientVolume: 75, musicVolume: 20,
      notation: 'engineering', reducedMotion: true, screenShake: false, statusMarkers: true, uiScale: 150,
      confirmNewCycle: false, worldVoices: 'rare',
    };
    expect(normalizeSettings(valid)).toEqual(valid);
  });

  it('returns a new object, never the input or the base object', () => {
    const raw = { ...D };
    const out = normalizeSettings(raw);
    expect(out).not.toBe(raw);
    expect(out).not.toBe(D);
    const base = { ...D, muted: true };
    expect(normalizeSettings(undefined, base)).not.toBe(base);
    expect(normalizeSettings({}, base)).not.toBe(base);
  });
});

describe('normalizeSettings per field', () => {
  // [field, bad value, expected result with defaults]
  const badTypes: Array<[keyof SettingsState, unknown]> = [
    ['muted', 'yes'], ['muted', 1], ['muted', null],
    ['masterVolume', '50'], ['masterVolume', true], ['masterVolume', null],
    ['sfxVolume', '50'], ['sfxVolume', null], ['sfxVolume', []],
    ['ambientVolume', '50'], ['ambientVolume', {}],
    ['musicVolume', '50'], ['musicVolume', null], ['musicVolume', false],
    ['notation', 1], ['notation', null], ['notation', ['suffix']],
    ['reducedMotion', 'true'], ['reducedMotion', 0],
    ['screenShake', 'false'], ['screenShake', null],
    ['statusMarkers', 1], ['statusMarkers', 'on'],
    ['uiScale', '125'], ['uiScale', null], ['uiScale', { value: 125 }],
    ['confirmNewCycle', 'no'], ['confirmNewCycle', 0], ['confirmNewCycle', null],
    ['worldVoices', 'ON'], ['worldVoices', 1], ['worldVoices', null], ['worldVoices', true],
  ];

  it.each(badTypes)('wrong type for %s (%j) falls back to default', (field, bad) => {
    const out = normalizeSettings({ [field]: bad });
    expect(out[field]).toEqual(D[field]);
    expect(out).toEqual(D);
  });

  it.each(badTypes)('wrong type for %s (%j) falls back to base value', (field, bad) => {
    const base: SettingsState = {
      muted: true, masterVolume: 30, sfxVolume: 31, ambientVolume: 32, musicVolume: 33,
      notation: 'scientific', reducedMotion: true, screenShake: false, statusMarkers: true, uiScale: 125,
      confirmNewCycle: false, worldVoices: 'off',
    };
    const out = normalizeSettings({ [field]: bad }, base);
    expect(out[field]).toEqual(base[field]);
  });

  const volumes: Array<['masterVolume' | 'sfxVolume' | 'ambientVolume' | 'musicVolume', number, number]> = [];
  for (const f of ['masterVolume', 'sfxVolume', 'ambientVolume', 'musicVolume'] as const) {
    volumes.push(
      [f, 0, 0],
      [f, 100, 100],
      [f, 50, 50],
      [f, 72.6, 73],
      [f, 72.4, 72],
      [f, 150, 100],
      [f, 1e9, 100],
      [f, -5, 0],
    );
  }

  it.each(volumes)('volume %s = %d becomes %d', (field, raw, expected) => {
    expect(normalizeSettings({ [field]: raw })[field]).toBe(expected);
  });

  it.each([
    ['masterVolume', NaN],
    ['sfxVolume', NaN],
    ['ambientVolume', NaN],
    ['musicVolume', NaN],
    ['masterVolume', Infinity],
    ['sfxVolume', -Infinity],
  ] as const)('non-finite volume %s = %d falls back to default', (field, raw) => {
    expect(normalizeSettings({ [field]: raw })[field]).toBe(D[field]);
  });

  it.each(['masterVolume', 'sfxVolume', 'ambientVolume', 'musicVolume'] as const)(
    'non-finite volume %s uses base when base is given',
    (field) => {
      const base = { ...D, [field]: 33 };
      expect(normalizeSettings({ [field]: NaN }, base)[field]).toBe(33);
    },
  );

  it('keeps volume 0 and volume 100 as-is (no -0)', () => {
    const out = normalizeSettings({ masterVolume: -0, sfxVolume: -0.4 });
    expect(Object.is(out.masterVolume, 0)).toBe(true);
    expect(Object.is(out.sfxVolume, 0)).toBe(true);
  });

  it.each(NOTATIONS)('accepts notation %s', (n) => {
    expect(normalizeSettings({ notation: n }).notation).toBe(n);
  });

  it.each([['Suffix'], ['sci'], [''], ['SUFFIX'], ['binary']])('unknown notation %j falls back to default', (n) => {
    expect(normalizeSettings({ notation: n }).notation).toBe(D.notation);
  });

  it.each(UI_SCALES)('accepts uiScale %d', (s) => {
    expect(normalizeSettings({ uiScale: s }).uiScale).toBe(s);
  });

  it.each(WORLD_VOICES)('accepts worldVoices %s', (w) => {
    expect(normalizeSettings({ worldVoices: w }).worldVoices).toBe(w);
  });

  it.each([['ON'], ['Rare'], [''], ['loud'], [0], [null]])('unknown worldVoices %j falls back to default on', (w) => {
    expect(normalizeSettings({ worldVoices: w }).worldVoices).toBe('on');
  });

  it.each([[0], [90], [124], [126], [200], [NaN], [-100]])('unknown uiScale %d falls back to default', (s) => {
    expect(normalizeSettings({ uiScale: s }).uiScale).toBe(D.uiScale);
  });

  it('honours base per field when the field is missing', () => {
    const base: SettingsState = { ...D, muted: true, masterVolume: 12, notation: 'engineering', uiScale: 150 };
    const out = normalizeSettings({}, base);
    expect(out).toEqual(base);
  });

  it('honours base for a valid patch on other fields', () => {
    const base: SettingsState = { ...D, sfxVolume: 20, statusMarkers: true };
    const out = normalizeSettings({ muted: true }, base);
    expect(out).toEqual({ ...base, muted: true });
  });

  it('drops unknown keys', () => {
    const out = normalizeSettings({ muted: true, extra: 1, __proto__x: 2, notes: 'hi' });
    expect(Object.keys(out).sort()).toEqual(Object.keys(D).sort());
    expect(out).toEqual({ ...D, muted: true });
    expect('extra' in out).toBe(false);
  });
});

describe('normalizeSettings non-object input', () => {
  it.each([[null], [3], ['x'], [true], [[]], [[1, 2]], [0], [NaN]])('raw %j gives defaults', (raw) => {
    const out = normalizeSettings(raw);
    expect(out).toEqual(D);
  });

  it('raw non-object with base gives a copy of base', () => {
    const base: SettingsState = { ...D, muted: true, uiScale: 125 };
    for (const raw of [null, 7, 'text', []]) {
      const out = normalizeSettings(raw, base);
      expect(out).toEqual(base);
      expect(out).not.toBe(base);
    }
  });

  it('never throws for odd input', () => {
    const odd: unknown[] = [undefined, null, Symbol('x'), () => 1, new Date(0), Object.create(null)];
    for (const raw of odd) {
      expect(() => normalizeSettings(raw)).not.toThrow();
      expect(normalizeSettings(raw)).toEqual(D);
    }
  });
});

describe('settings data sanity', () => {
  it('volume range is 0..100 and step divides the span', () => {
    expect(VOLUME_RANGE.min).toBe(0);
    expect(VOLUME_RANGE.max).toBe(100);
    expect((VOLUME_RANGE.max - VOLUME_RANGE.min) % VOLUME_RANGE.step).toBe(0);
  });

  it('default volumes sit inside the volume range', () => {
    for (const v of [D.masterVolume, D.sfxVolume, D.ambientVolume, D.musicVolume]) {
      expect(v).toBeGreaterThanOrEqual(VOLUME_RANGE.min);
      expect(v).toBeLessThanOrEqual(VOLUME_RANGE.max);
    }
  });

  it('UI scales contain the default', () => {
    expect(UI_SCALES).toContain(D.uiScale);
  });

  it('notations contain the default and have no duplicates', () => {
    expect(NOTATIONS).toContain(D.notation);
    expect(new Set(NOTATIONS).size).toBe(NOTATIONS.length);
  });

  it('default screen shake is on, reduced motion off', () => {
    expect(D.screenShake).toBe(true);
    expect(D.reducedMotion).toBe(false);
    expect(D.statusMarkers).toBe(false);
    expect(D.muted).toBe(false);
  });

  it('music volume defaults to 70 and sits inside the volume range', () => {
    expect(D.musicVolume).toBe(70);
    expect(D.musicVolume).toBeGreaterThanOrEqual(VOLUME_RANGE.min);
    expect(D.musicVolume).toBeLessThanOrEqual(VOLUME_RANGE.max);
  });

  it('v2 save without musicVolume loads with 70 and keeps every other field', () => {
    const saved: Record<string, unknown> = { ...D, muted: true, sfxVolume: 40 };
    delete saved['musicVolume'];
    const wire = JSON.parse(JSON.stringify(saved)) as unknown;
    const out = normalizeSettings(wire);
    expect(out.musicVolume).toBe(70);
    expect(out).toEqual({ ...D, muted: true, sfxVolume: 40 });
  });

  it('music volume round-trips through JSON and clamps like the other sliders', () => {
    const wire = JSON.parse(JSON.stringify({ ...D, musicVolume: 35 })) as unknown;
    expect(normalizeSettings(wire).musicVolume).toBe(35);
    expect(normalizeSettings({ musicVolume: 250 }).musicVolume).toBe(100);
    expect(normalizeSettings({ musicVolume: -3 }).musicVolume).toBe(0);
    expect(normalizeSettings({ musicVolume: NaN }).musicVolume).toBe(70);
  });

  it('world voices default to on (WP23a); a missing or invalid value gives on, a valid one is kept', () => {
    expect(D.worldVoices).toBe('on');
    expect(WORLD_VOICES).toContain(D.worldVoices);
    expect(normalizeSettings({ muted: true }).worldVoices).toBe('on');
    expect(normalizeSettings({ worldVoices: 'loud' }).worldVoices).toBe('on');
    expect(normalizeSettings({ worldVoices: 'off' }).worldVoices).toBe('off');
  });

  it('a v2 save without worldVoices loads with on and keeps every other field', () => {
    const saved: Record<string, unknown> = { ...D, muted: true, uiScale: 125 };
    delete saved['worldVoices'];
    const wire = JSON.parse(JSON.stringify(saved)) as unknown;
    const out = normalizeSettings(wire);
    expect(out.worldVoices).toBe('on');
    expect(out).toEqual({ ...D, muted: true, uiScale: 125 });
  });

  it('a patch through normalizeSettings sets worldVoices and keeps the other keys', () => {
    const base: SettingsState = { ...D, masterVolume: 40, uiScale: 150, worldVoices: 'on' };
    const out = normalizeSettings({ worldVoices: 'rare' }, base);
    expect(out).toEqual({ ...base, worldVoices: 'rare' });
    expect(normalizeSettings({ worldVoices: 'off', muted: true }, out)).toEqual({ ...out, worldVoices: 'off', muted: true });
  });

  it('confirm new cycle is on by default and keeps a valid boolean', () => {
    expect(D.confirmNewCycle).toBe(true);
    expect(normalizeSettings({ confirmNewCycle: false }).confirmNewCycle).toBe(false);
    expect(normalizeSettings({ confirmNewCycle: true }).confirmNewCycle).toBe(true);
  });
});

describe('motionPolicy', () => {
  const base = { ...D };

  it('normal motion with shake on', () => {
    expect(motionPolicy({ ...base, reducedMotion: false, screenShake: true })).toEqual({
      shake: true, cameraTween: true, flashes: true, maxDegPerSec: null, assemblyDrop: true,
    });
  });

  it('normal motion with shake off keeps tweens and drops', () => {
    expect(motionPolicy({ ...base, reducedMotion: false, screenShake: false })).toEqual({
      shake: false, cameraTween: true, flashes: true, maxDegPerSec: null, assemblyDrop: true,
    });
  });

  it('reduced motion with shake on turns every effect off and caps the crank speed', () => {
    expect(motionPolicy({ ...base, reducedMotion: true, screenShake: true })).toEqual({
      shake: false, cameraTween: false, flashes: false, maxDegPerSec: 180, assemblyDrop: false,
    });
    expect(REDUCED_MOTION.maxDegPerSec).toBe(180);
  });

  it('reduced motion with shake off gives the same policy', () => {
    expect(motionPolicy({ ...base, reducedMotion: true, screenShake: false })).toEqual({
      shake: false, cameraTween: false, flashes: false, maxDegPerSec: 180, assemblyDrop: false,
    });
  });

  it('does not depend on other fields', () => {
    const a = motionPolicy({ ...base, reducedMotion: false, muted: true, uiScale: 150 });
    const b = motionPolicy({ ...base, reducedMotion: false, muted: false, uiScale: 100 });
    expect(a).toEqual(b);
  });
});
