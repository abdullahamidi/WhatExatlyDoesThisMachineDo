// Photo mode key and entry rules (WP18). Pure: no DOM globals, no Phaser. The DOM overlay lives in photoMode.ts.
import type { EndingPhase } from '../data/types';

export type PhotoKeyAction = { kind: 'pan'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 } | { kind: 'zoom'; dir: 1 | -1 };

/** ArrowLeft/Right/Up/Down -> pan (-1,0)/(1,0)/(0,-1)/(0,1); '+' and '=' -> zoom 1; '-' and '_' -> zoom -1; anything else null. */
export function photoKeyAction(key: string): PhotoKeyAction | null {
  switch (key) {
    case 'ArrowLeft':
      return { kind: 'pan', dx: -1, dy: 0 };
    case 'ArrowRight':
      return { kind: 'pan', dx: 1, dy: 0 };
    case 'ArrowUp':
      return { kind: 'pan', dx: 0, dy: -1 };
    case 'ArrowDown':
      return { kind: 'pan', dx: 0, dy: 1 };
    case '+':
    case '=':
      return { kind: 'zoom', dir: 1 };
    case '-':
    case '_':
      return { kind: 'zoom', dir: -1 };
    default:
      return null;
  }
}

/** Photo mode may start when no modal is open and the phase is postgame, or (debug / smoke only: force) phase none. Never in sequence / choice. */
export function canEnterPhoto(phase: EndingPhase, modalOpen: boolean, force: boolean): boolean {
  return !modalOpen && (phase === 'postgame' || (force && phase === 'none'));
}

export type FocusHolder = 'chip' | 'none' | 'other';

/** Leaving photo mode returns focus to VIEW MACHINE only while focus is on the exit chip or nowhere. A modal that took focus (e.g. the tech tree opened with T) keeps it. */
export function shouldRestoreFocus(holder: FocusHolder): boolean {
  return holder !== 'other';
}
