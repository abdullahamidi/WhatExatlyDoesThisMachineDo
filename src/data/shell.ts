// src/data/shell.ts - splash, crash overlay and related text/limits
export const SPLASH = { fadeMs: 150, maxWaitMs: 20000, firstFrameMark: 'wedtmd:first-frame', bootMark: 'wedtmd:boot' } as const;
export const CRASH = { maxMessageChars: 300, maxStackLines: 12, ignoreMessagePrefixes: ['ResizeObserver loop'] as readonly string[] } as const;
export const CRASH_TEXT = {
  title: 'THE MACHINE STALLED',
  savedLine: 'Progress was saved just before the stall.',
  unsavedLine: 'Progress could not be saved now; the last autosave is kept.',
  copy: 'COPY REPORT', copied: 'REPORT COPIED', copyFailed: 'COPY FAILED — SELECT THE TEXT BELOW',
  reload: 'RELOAD', quit: 'QUIT',
  reportHeader: 'What Exactly Does This Machine Do? — crash report',
} as const;
