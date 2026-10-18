// New-cycle confirm dialog model (WP14 T6a). Pure: no DOM, no Phaser. Turns the CyclePreview and the short xf label
// into the texts the dialog shows (DOM wiring lives in cycleConfirm.ts). Texts: src/data/prestige.ts (PRESTIGE_TEXT).
import { PRESTIGE_TEXT } from '../data/prestige';
import type { CyclePreview } from '../simulation/prestige';
import { formatNumber } from '../utils/format';

export interface CycleConfirmModel {
  title: string;               // BEGIN CYCLE 0043?
  gainLine: string;            // +3 ECHOES -> ECHOES 3 (+90% ALL/S)
  bonusLine: string;           // NEXT CYCLE: +90% ALL/S
  thresholdHint: string | null; // +1 ECHO AT 2B RF; null when no threshold is left
  kept: string[];              // KEPT list lines
  reset: string[];             // RESET list lines
  confirmLabel: string;        // BEGIN CYCLE 0043
  cancelLabel: string;         // CANCEL
}

/**
 * Confirm dialog model for the preview. xfShort is the Restoration Flux label as the player sees it (`resourceShort('xf')`,
 * `RF` once revealed). Thresholds format with the player's default notation (2e9 -> `2B`).
 */
export function buildCycleConfirm(preview: CyclePreview, xfShort: string): CycleConfirmModel {
  const label = preview.label;
  const bonus = `+${preview.bonusPctAfter}% ${PRESTIGE_TEXT.allPerSecond}`;
  const next = preview.nextBonusXf;
  return {
    title: `${PRESTIGE_TEXT.begin} ${label}?`,
    gainLine: `+${preview.echoesGained} ${PRESTIGE_TEXT.echoes} -> ${PRESTIGE_TEXT.echoes} ${preview.echoesAfter} (${bonus})`,
    bonusLine: `${PRESTIGE_TEXT.nextCycle}: ${bonus}`,
    thresholdHint: next === null ? null : `${PRESTIGE_TEXT.echoAt} ${formatNumber(next)} ${xfShort}`,
    kept: [...PRESTIGE_TEXT.kept],
    reset: [...PRESTIGE_TEXT.reset],
    confirmLabel: `${PRESTIGE_TEXT.begin} ${label}`,
    cancelLabel: PRESTIGE_TEXT.cancel,
  };
}
