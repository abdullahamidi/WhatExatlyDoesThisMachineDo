import type { NumberNotation, SettingsState, UiScale, WorldVoices } from './types';

// Settings defaults, ranges, hotkeys and player-facing labels (WP12). Pure data: no logic lives in this file.

export const DEFAULT_SETTINGS_VALUES: SettingsState = {
  muted: false,
  masterVolume: 100,
  sfxVolume: 100,
  ambientVolume: 100,
  musicVolume: 70,
  notation: 'suffix',
  reducedMotion: false,
  screenShake: true,
  statusMarkers: false,
  uiScale: 100,
  confirmNewCycle: true,
  worldVoices: 'on',
};

// Volume sliders: integer percent. `step` must divide `max - min`.
export const VOLUME_RANGE = { min: 0, max: 100, step: 5 } as const;

export const NOTATIONS: readonly NumberNotation[] = ['suffix', 'scientific', 'engineering'];

export const UI_SCALES: readonly UiScale[] = [100, 125, 150];

// WORLD VOICES (WP23a): the living-world speech bubbles. ON = full cadence, RARE = a thinner schedule, OFF = none.
export const WORLD_VOICES: readonly WorldVoices[] = ['on', 'rare', 'off'];

// Reduced motion: caps the crank wobble speed (deg/s) and turns off tweens and drops.
export const REDUCED_MOTION = { maxDegPerSec: 180, cameraTweenMs: 0, assemblyDropPx: 0 } as const;

// Crank keys and their rate cap (presses per second, every press beyond it is ignored).
export const CRANK_KEYS = { keys: [' ', 'Enter'], maxPerSecond: 15 } as const;

// Keyboard shortcuts for non-crank actions (`t` and `f` matched case-insensitively).
// `fault` clears a machine fault (WP27): the fault marker listens to the clearFault command.
export const HOTKEYS = { techTree: 't', fault: 'f', menu: 'Escape' } as const;

export const SETTINGS_LABELS = {
  sectionAudio: 'AUDIO',
  sectionDisplay: 'DISPLAY',
  sectionAccess: 'ACCESS',
  sectionHotkeys: 'KEYS',
  mute: 'AUDIO MUTE',
  masterVolume: 'MASTER',
  sfxVolume: 'SFX',
  ambientVolume: 'AMBIENT',
  musicVolume: 'MUSIC',
  notation: 'NUMBERS',
  notations: { suffix: 'SUFFIX', scientific: 'SCIENTIFIC', engineering: 'ENGINEERING' },
  uiScale: 'UI SCALE',
  uiScales: { 100: '100 %', 125: '125 %', 150: '150 %' },
  worldVoices: 'WORLD VOICES',
  worldVoicesOptions: { on: 'ON', rare: 'RARE', off: 'OFF' },
  reducedMotion: 'REDUCED MOTION',
  screenShake: 'SCREEN SHAKE',
  screenShakeLocked: 'OFF (REDUCED MOTION)',
  statusMarkers: 'STATUS MARKERS',
  confirmNewCycle: 'CONFIRM NEW CYCLE',
  on: 'ON',
  off: 'OFF',
  keyCrank: 'SPACE / ENTER',
  keyTechTree: 'T',
  keyFault: 'F',
  keyMenu: 'ESC',
  hotkeyCrank: 'CRANK',
  hotkeyTechTree: 'TECH INDEX',
  hotkeyFault: 'CLEAR FAULT',
  hotkeyMenu: 'MENU',
} as const;
