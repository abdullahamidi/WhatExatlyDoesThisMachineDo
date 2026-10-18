// Finale overlay model (WP13 T5). Pure: no DOM, no Phaser. Turns the ending phase, the finale clock and the
// new-cycle reason into what the overlay shows. The DOM wiring lives in finale.ts. Texts and timings: src/data/finale.ts.
import { FINALE_REVEAL } from '../data/finale';
import type { EndingPhase } from '../data/types';
import { typewriter } from '../game/math/finale';

export interface FinaleOverlayLine {
  text: string;   // full line
  shown: number;  // visible character count: text.slice(0, shown)
}

export interface FinaleOverlayModel {
  skipVisible: boolean;        // SKIP button (sequence only)
  nameplateAlpha: number;      // 0..1 name plate fade
  lines: FinaleOverlayLine[];  // body lines + lastLine
  buttons: boolean;            // KEEP / NEW CYCLE shown
  cycleEnabled: boolean;       // BEGIN A NEW CYCLE can be used
  cycleReason: string | null;  // why it is disabled (null when enabled)
}

/**
 * Overlay model for the ending phase at finale time t (seconds since the film started).
 * null for 'none' and 'postgame' (no overlay). 'sequence' types the reveal at t - FINALE_REVEAL.startS; 'choice' shows
 * every line complete with the buttons up. blockedReason null = the new-cycle button is enabled.
 */
export function buildFinaleOverlay(
  phase: EndingPhase,
  t: number,
  reduced: boolean,
  blockedReason: string | null,
): FinaleOverlayModel | null {
  const cycleEnabled = blockedReason === null;
  if (phase === 'choice') {
    const texts = [...FINALE_REVEAL.lines, FINALE_REVEAL.lastLine];
    return {
      skipVisible: false,
      nameplateAlpha: 1,
      lines: texts.map((text) => ({ text, shown: text.length })),
      buttons: true,
      cycleEnabled,
      cycleReason: blockedReason,
    };
  }
  if (phase !== 'sequence') return null;
  const tw = typewriter(t - FINALE_REVEAL.startS, FINALE_REVEAL, reduced);
  return {
    skipVisible: true,
    nameplateAlpha: tw.nameplateAlpha,
    lines: tw.lines.map((line) => ({ text: line.text, shown: line.shown })),
    buttons: tw.buttons,
    cycleEnabled,
    cycleReason: blockedReason,
  };
}
