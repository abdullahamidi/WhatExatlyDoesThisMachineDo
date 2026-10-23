// src/data/demo.ts - end-of-demo timings and copy. The demo controller reads these; rendering stays in src/game.

/** Timings are in milliseconds, except the stack ids which name the two overlay stacks. */
export const DEMO_END = {
  /** Wait after the Substation Blueprint milestone before the final-machine teaser starts. */
  triggerDelayMs: 4000,
  /** Hold on the teaser's last frame before the END OF DEMO card appears. */
  holdEndMs: 1500,
  /** How often the controller advances the session while the World scene sleeps. */
  tickMs: 1000,
  /** Retry interval while a title, credits or cycle dialog blocks the teaser from starting. */
  blockedRetryMs: 1000,
  teaserStackId: 'demo-teaser',
  cardStackId: 'demo-end',
} as const;

export const DEMO_TEXT = {
  cardTitle: 'END OF DEMO — THE MACHINE IS NOT FINISHED.',
  cardBody: 'Eras III to V, the rest of the machine and what it is for are in the full game.',
  wishlist: 'WISHLIST ON STEAM',
  keep: 'KEEP TINKERING',
  replay: 'REPLAY TEASER',
  quit: 'QUIT',
  feedback: 'SEND FEEDBACK',
  dialogLabel: 'End of demo',
  teaserKicker: 'FULL GAME PREVIEW',
  skip: 'SKIP [ESC]',
  fullGameTab: 'FULL GAME',
  fullGameOnly: 'FULL GAME ONLY',
} as const;
