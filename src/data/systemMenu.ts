// SYSTEM menu timings and labels (WP4). Pure data: no logic lives in this file.

// Reset arm timeout and save feedback display time (ms).
export const SYSTEM_MENU_CONFIG = {
  resetArmMs: 5000,
  saveFeedbackMs: 1600,
} as const;

export const MUTE_LABELS = {
  on: 'AUDIO: ON',
  off: 'AUDIO: OFF',
} as const;

export const RESET_LABELS = {
  idle: 'RESET PROGRESS',
  armed: 'CONFIRM: ERASE ALL?',
} as const;

export const SAVE_LABELS = {
  ok: 'STATE WRITTEN',
  failed: 'WRITE FAILED',
} as const;

// Fixed menu texts (title and always-visible controls outside the tab panels).
export const MENU_TEXT = {
  title: 'SYSTEM',
  close: 'CLOSE [ESC]',
  save: 'SAVE STATE',
  cancel: 'CANCEL',
} as const;

// Tab bar entries. The SYSTEM tab is always first; deps.panels add tabs after it.
export const MENU_TABS = {
  system: { id: 'system', label: 'SYSTEM' },
  settings: { id: 'settings', label: 'SETTINGS' },
  stats: { id: 'stats', label: 'STATS' },
  records: { id: 'records', label: 'RECORDS' },
  memory: { id: 'memory', label: 'MEMORY' },
  data: { id: 'data', label: 'DATA' },
} as const;
