import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS_VALUES, SETTINGS_LABELS, VOLUME_RANGE } from '../../data/settings';
import type { SettingsState } from '../../data/types';
import {
  fullscreenRow,
  hotkeyHelpLines,
  notationOf,
  radioPatch,
  settingsViewModel,
  toggleAction,
  uiRootAttrs,
  uiScaleOf,
  volumePatch,
  volumeText,
} from './settingsView';
import type { RadioControl, ToggleControl, VolumeControl } from './settingsView';

function withSettings(patch: Partial<SettingsState>): SettingsState {
  return { ...DEFAULT_SETTINGS_VALUES, ...patch };
}

function volume(s: SettingsState, id: 'masterVolume' | 'sfxVolume' | 'ambientVolume'): VolumeControl {
  const found = settingsViewModel(s).find((c) => c.id === id);
  expect(found?.kind).toBe('volume');
  return found as VolumeControl;
}

function radio(s: SettingsState, id: 'notation' | 'uiScale'): RadioControl {
  const found = settingsViewModel(s).find((c) => c.id === id);
  expect(found?.kind).toBe('radio');
  return found as RadioControl;
}

function toggle(s: SettingsState, id: 'reducedMotion' | 'statusMarkers' | 'screenShake' | 'confirmNewCycle'): ToggleControl {
  const found = settingsViewModel(s).find((c) => c.id === id);
  expect(found?.kind).toBe('toggle');
  return found as ToggleControl;
}

describe('settingsViewModel (default settings)', () => {
  const model = settingsViewModel(DEFAULT_SETTINGS_VALUES);

  it('lists controls in AUDIO, DISPLAY, ACCESS order', () => {
    expect(model.map((c) => c.id)).toEqual([
      'masterVolume', 'sfxVolume', 'ambientVolume', 'notation', 'uiScale', 'statusMarkers', 'confirmNewCycle', 'reducedMotion', 'screenShake',
    ]);
    expect(model.map((c) => c.section)).toEqual([
      'audio', 'audio', 'audio', 'display', 'display', 'display', 'display', 'access', 'access',
    ]);
  });

  it('volume rows read VOLUME_RANGE and show 100 %', () => {
    for (const id of ['masterVolume', 'sfxVolume', 'ambientVolume'] as const) {
      const row = volume(DEFAULT_SETTINGS_VALUES, id);
      expect(row.value).toBe(100);
      expect(row.valueText).toBe('100 %');
      expect(row.min).toBe(VOLUME_RANGE.min);
      expect(row.max).toBe(VOLUME_RANGE.max);
      expect(row.step).toBe(VOLUME_RANGE.step);
      expect(row.label).toBe(SETTINGS_LABELS[id]);
    }
  });

  it('notation radio has the three names, only SUFFIX checked', () => {
    const row = radio(DEFAULT_SETTINGS_VALUES, 'notation');
    expect(row.options.map((o) => o.value)).toEqual(['suffix', 'scientific', 'engineering']);
    expect(row.options.map((o) => o.label)).toEqual(['SUFFIX', 'SCIENTIFIC', 'ENGINEERING']);
    expect(row.options.map((o) => o.checked)).toEqual([true, false, false]);
  });

  it('UI scale radio has 100 / 125 / 150, only 100 checked', () => {
    const row = radio(DEFAULT_SETTINGS_VALUES, 'uiScale');
    expect(row.options.map((o) => o.value)).toEqual(['100', '125', '150']);
    expect(row.options.map((o) => o.label)).toEqual(['100 %', '125 %', '150 %']);
    expect(row.options.map((o) => o.checked)).toEqual([true, false, false]);
  });

  it('toggles: status markers off, confirm new cycle on, reduced motion off, screen shake on', () => {
    const confirm = toggle(DEFAULT_SETTINGS_VALUES, 'confirmNewCycle');
    expect(confirm).toMatchObject({ section: 'display', pressed: true, stateText: 'ON', disabled: false });
    expect(confirm.label).toBe(SETTINGS_LABELS.confirmNewCycle);
    const markers = toggle(DEFAULT_SETTINGS_VALUES, 'statusMarkers');
    expect(markers).toMatchObject({ pressed: false, stateText: 'OFF', disabled: false });
    const reduced = toggle(DEFAULT_SETTINGS_VALUES, 'reducedMotion');
    expect(reduced).toMatchObject({ pressed: false, stateText: 'OFF', disabled: false });
    const shake = toggle(DEFAULT_SETTINGS_VALUES, 'screenShake');
    expect(shake).toMatchObject({ pressed: true, stateText: 'ON', disabled: false });
  });
});

describe('settingsViewModel (changed settings)', () => {
  it('volume text follows the stored value', () => {
    expect(volume(withSettings({ masterVolume: 70 }), 'masterVolume')).toMatchObject({ value: 70, valueText: '70 %' });
    expect(volume(withSettings({ sfxVolume: 0 }), 'sfxVolume').valueText).toBe('0 %');
  });

  it('notation and UI scale checked flags follow the stored value', () => {
    const n = radio(withSettings({ notation: 'engineering' }), 'notation');
    expect(n.options.map((o) => o.checked)).toEqual([false, false, true]);
    const u = radio(withSettings({ uiScale: 150 }), 'uiScale');
    expect(u.options.map((o) => o.checked)).toEqual([false, false, true]);
  });

  it('status markers ON when set', () => {
    expect(toggle(withSettings({ statusMarkers: true }), 'statusMarkers')).toMatchObject({ pressed: true, stateText: 'ON' });
  });

  it('confirm new cycle OFF when turned off', () => {
    expect(toggle(withSettings({ confirmNewCycle: false }), 'confirmNewCycle')).toMatchObject({ pressed: false, stateText: 'OFF' });
  });

  it('reduced motion ON when set', () => {
    expect(toggle(withSettings({ reducedMotion: true }), 'reducedMotion')).toMatchObject({ pressed: true, stateText: 'ON' });
  });

  it('screen shake OFF when turned off outside reduced motion', () => {
    expect(toggle(withSettings({ screenShake: false }), 'screenShake')).toMatchObject({
      pressed: false,
      stateText: 'OFF',
      disabled: false,
    });
  });

  it('screen shake is disabled and shows OFF (REDUCED MOTION) while reduced motion is on', () => {
    for (const screenShake of [true, false]) {
      expect(toggle(withSettings({ reducedMotion: true, screenShake }), 'screenShake')).toEqual({
        kind: 'toggle',
        section: 'access',
        id: 'screenShake',
        label: SETTINGS_LABELS.screenShake,
        pressed: false,
        stateText: 'OFF (REDUCED MOTION)',
        disabled: true,
      });
    }
  });
});

describe('uiRootAttrs', () => {
  it('maps UI scale to zoom', () => {
    expect(uiRootAttrs(withSettings({ uiScale: 100 })).zoom).toBe('1');
    expect(uiRootAttrs(withSettings({ uiScale: 125 })).zoom).toBe('1.25');
    expect(uiRootAttrs(withSettings({ uiScale: 150 })).zoom).toBe('1.5');
  });

  it('maps status markers and reduced motion to on / off', () => {
    expect(uiRootAttrs(DEFAULT_SETTINGS_VALUES)).toEqual({ zoom: '1', statusMarkers: 'off', reducedMotion: 'off' });
    expect(uiRootAttrs(withSettings({ statusMarkers: true, reducedMotion: true }))).toEqual({
      zoom: '1',
      statusMarkers: 'on',
      reducedMotion: 'on',
    });
  });
});

describe('hotkeyHelpLines', () => {
  it('lists crank, tech tree, menu and fullscreen keys', () => {
    expect(hotkeyHelpLines()).toEqual(['SPACE / ENTER  CRANK', 'T  TECH TREE', 'ESC  MENU', 'F11 / ALT+ENTER  FULLSCREEN']);
  });
});

describe('fullscreenRow', () => {
  it('shows ON and pressed when fullscreen is on', () => {
    expect(fullscreenRow(true)).toEqual({
      label: 'FULLSCREEN',
      stateText: 'ON',
      pressed: true,
      hint: 'F11 / ALT+ENTER',
    });
  });

  it('shows OFF and not pressed when fullscreen is off', () => {
    expect(fullscreenRow(false)).toEqual({
      label: 'FULLSCREEN',
      stateText: 'OFF',
      pressed: false,
      hint: 'F11 / ALT+ENTER',
    });
  });
});

describe('volumeText', () => {
  it('appends the percent sign with a space', () => {
    expect(volumeText(0)).toBe('0 %');
    expect(volumeText(70)).toBe('70 %');
  });
});

describe('option lookups', () => {
  it('notationOf accepts only known names', () => {
    expect(notationOf('scientific')).toBe('scientific');
    expect(notationOf('SUFFIX')).toBeNull();
    expect(notationOf('')).toBeNull();
  });

  it('uiScaleOf accepts only known scales', () => {
    expect(uiScaleOf('125')).toBe(125);
    expect(uiScaleOf('110')).toBeNull();
    expect(uiScaleOf('abc')).toBeNull();
  });
});

describe('patches', () => {
  it('volumePatch targets the matching field', () => {
    expect(volumePatch('masterVolume', 40)).toEqual({ masterVolume: 40 });
    expect(volumePatch('sfxVolume', 5)).toEqual({ sfxVolume: 5 });
    expect(volumePatch('ambientVolume', 0)).toEqual({ ambientVolume: 0 });
  });

  it('radioPatch returns a patch for known values and null otherwise', () => {
    expect(radioPatch('notation', 'engineering')).toEqual({ notation: 'engineering' });
    expect(radioPatch('notation', 'bogus')).toBeNull();
    expect(radioPatch('uiScale', '150')).toEqual({ uiScale: 150 });
    expect(radioPatch('uiScale', '99')).toBeNull();
  });

  it('toggleAction flips only its own field', () => {
    expect(toggleAction('reducedMotion', DEFAULT_SETTINGS_VALUES)).toEqual({ reducedMotion: true });
    expect(toggleAction('statusMarkers', DEFAULT_SETTINGS_VALUES)).toEqual({ statusMarkers: true });
    expect(toggleAction('screenShake', DEFAULT_SETTINGS_VALUES)).toEqual({ screenShake: false });
    expect(toggleAction('screenShake', withSettings({ screenShake: false }))).toEqual({ screenShake: true });
    expect(toggleAction('confirmNewCycle', DEFAULT_SETTINGS_VALUES)).toEqual({ confirmNewCycle: false });
    expect(toggleAction('confirmNewCycle', withSettings({ confirmNewCycle: false }))).toEqual({ confirmNewCycle: true });
  });
});
