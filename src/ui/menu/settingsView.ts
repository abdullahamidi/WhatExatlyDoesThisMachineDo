// SETTINGS tab model (WP12 T7). Pure: maps SettingsState to control descriptors and to patches. No DOM.
import { DISPLAY_TEXT } from '../../data/display';
import { NOTATIONS, SETTINGS_LABELS, UI_SCALES, VOLUME_RANGE } from '../../data/settings';
import type { NumberNotation, SettingsState, UiScale } from '../../data/types';

export type SettingsSection = 'audio' | 'display' | 'access';
export type VolumeId = 'masterVolume' | 'sfxVolume' | 'ambientVolume' | 'musicVolume';
export type RadioId = 'notation' | 'uiScale';
export type ToggleId = 'reducedMotion' | 'statusMarkers' | 'screenShake' | 'confirmNewCycle';

export const VOLUME_IDS: readonly VolumeId[] = ['masterVolume', 'sfxVolume', 'ambientVolume', 'musicVolume'];

export interface RadioOption { value: string; label: string; checked: boolean }

export interface VolumeControl {
  kind: 'volume';
  section: SettingsSection;
  id: VolumeId;
  label: string;
  value: number;
  valueText: string;
  min: number;
  max: number;
  step: number;
}

export interface RadioControl {
  kind: 'radio';
  section: SettingsSection;
  id: RadioId;
  label: string;
  options: RadioOption[];
}

export interface ToggleControl {
  kind: 'toggle';
  section: SettingsSection;
  id: ToggleId;
  label: string;
  pressed: boolean;
  stateText: string;
  disabled: boolean;
  /** Row is left out of the panel (not just disabled). Only confirmNewCycle sets it. */
  hidden?: boolean;
}

export type SettingsControl = VolumeControl | RadioControl | ToggleControl;

/** FULLSCREEN row of the DISPLAY section. Session-only: not a SettingsState field. */
export interface FullscreenRow {
  label: string;
  stateText: string;
  pressed: boolean;
  hint: string;
}

export interface UiRootAttrs {
  zoom: string;
  statusMarkers: 'on' | 'off';
  reducedMotion: 'on' | 'off';
}

/** Volume text shown next to a slider, e.g. "70 %". */
export function volumeText(value: number): string {
  return `${value} %`;
}

export function notationOf(value: string): NumberNotation | null {
  return NOTATIONS.find((n) => n === value) ?? null;
}

export function uiScaleOf(value: string): UiScale | null {
  const n = Number(value);
  return UI_SCALES.find((u) => u === n) ?? null;
}

function toggleControl(id: ToggleId, s: Readonly<SettingsState>, section: SettingsSection): ToggleControl {
  const label = SETTINGS_LABELS[id];
  if (id === 'screenShake' && s.reducedMotion) {
    // Shake is forced off while reduced motion is on; the stored value is kept for later.
    return { kind: 'toggle', section, id, label, pressed: false, stateText: SETTINGS_LABELS.screenShakeLocked, disabled: true };
  }
  const on = s[id];
  return { kind: 'toggle', section, id, label, pressed: on, stateText: on ? SETTINGS_LABELS.on : SETTINGS_LABELS.off, disabled: false };
}

/**
 * Control descriptors in display order: AUDIO, DISPLAY, ACCESS.
 * cycleRelevant: CONFIRM NEW CYCLE only matters once prestige is in play, so it is hidden until then (default: shown).
 */
export function settingsViewModel(s: Readonly<SettingsState>, opts?: { cycleRelevant?: boolean }): SettingsControl[] {
  const volumes: VolumeControl[] = VOLUME_IDS.map((id) => ({
    kind: 'volume',
    section: 'audio',
    id,
    label: SETTINGS_LABELS[id],
    value: s[id],
    valueText: volumeText(s[id]),
    min: VOLUME_RANGE.min,
    max: VOLUME_RANGE.max,
    step: VOLUME_RANGE.step,
  }));
  const notation: RadioControl = {
    kind: 'radio',
    section: 'display',
    id: 'notation',
    label: SETTINGS_LABELS.notation,
    options: NOTATIONS.map((n) => ({ value: n, label: SETTINGS_LABELS.notations[n], checked: n === s.notation })),
  };
  const uiScale: RadioControl = {
    kind: 'radio',
    section: 'display',
    id: 'uiScale',
    label: SETTINGS_LABELS.uiScale,
    options: UI_SCALES.map((u) => ({ value: String(u), label: SETTINGS_LABELS.uiScales[u], checked: u === s.uiScale })),
  };
  return [
    ...volumes,
    notation,
    uiScale,
    toggleControl('statusMarkers', s, 'display'),
    { ...toggleControl('confirmNewCycle', s, 'display'), hidden: !(opts?.cycleRelevant ?? true) },
    toggleControl('reducedMotion', s, 'access'),
    toggleControl('screenShake', s, 'access'),
  ];
}

/** Root attributes for the app shell (T9 applies them to the top-level game root element). */
export function uiRootAttrs(s: Readonly<SettingsState>): UiRootAttrs {
  return {
    zoom: String(s.uiScale / 100),
    statusMarkers: s.statusMarkers ? 'on' : 'off',
    reducedMotion: s.reducedMotion ? 'on' : 'off',
  };
}

/** Patch for a volume slider commit. */
export function volumePatch(id: VolumeId, value: number): Partial<SettingsState> {
  switch (id) {
    case 'masterVolume':
      return { masterVolume: value };
    case 'sfxVolume':
      return { sfxVolume: value };
    case 'ambientVolume':
      return { ambientVolume: value };
    case 'musicVolume':
      return { musicVolume: value };
  }
}

/** Patch for a radio choice; null when the value is not a known option. */
export function radioPatch(id: RadioId, value: string): Partial<SettingsState> | null {
  if (id === 'notation') {
    const notation = notationOf(value);
    return notation === null ? null : { notation };
  }
  const uiScale = uiScaleOf(value);
  return uiScale === null ? null : { uiScale };
}

/** Patch for a toggle press: flips the stored value (the shake toggle is disabled while reduced motion is on). */
export function toggleAction(id: ToggleId, s: Readonly<SettingsState>): Partial<SettingsState> {
  switch (id) {
    case 'reducedMotion':
      return { reducedMotion: !s.reducedMotion };
    case 'statusMarkers':
      return { statusMarkers: !s.statusMarkers };
    case 'screenShake':
      return { screenShake: !s.screenShake };
    case 'confirmNewCycle':
      return { confirmNewCycle: !s.confirmNewCycle };
  }
}

/** FULLSCREEN row descriptor for the given state (ON / OFF). */
export function fullscreenRow(on: boolean): FullscreenRow {
  return {
    label: DISPLAY_TEXT.fullscreen,
    stateText: on ? SETTINGS_LABELS.on : SETTINGS_LABELS.off,
    pressed: on,
    hint: DISPLAY_TEXT.fullscreenKeys,
  };
}

/** Keyboard help lines for the bottom of the SETTINGS tab. */
export function hotkeyHelpLines(): string[] {
  return [
    `${SETTINGS_LABELS.keyCrank}  ${SETTINGS_LABELS.hotkeyCrank}`,
    `${SETTINGS_LABELS.keyTechTree}  ${SETTINGS_LABELS.hotkeyTechTree}`,
    `${SETTINGS_LABELS.keyMenu}  ${SETTINGS_LABELS.hotkeyMenu}`,
    `${DISPLAY_TEXT.fullscreenKeys}  ${DISPLAY_TEXT.fullscreen}`,
  ];
}
