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
