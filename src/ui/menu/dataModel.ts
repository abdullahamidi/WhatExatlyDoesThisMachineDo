// Pure model for the DATA tab (WP12 T8): two-step import arm, import text trimming, copy labels. No DOM, no Phaser.
import { DATA_LABELS } from '../../data/notifications';
import { SYSTEM_MENU_CONFIG } from '../../data/systemMenu';
import { reduceReset } from '../systemMenuModel';
import type { ResetEvent, ResetState } from '../systemMenuModel';

/** Two-step import: same arm period and rules as the SYSTEM reset (thin wrapper over reduceReset). */
export function reduceImport(
  s: ResetState,
  ev: ResetEvent,
  armMs: number = SYSTEM_MENU_CONFIG.resetArmMs,
): { state: ResetState; execute: boolean } {
  return reduceReset(s, ev, armMs);
}

/** Import button label for the current arm state. */
export function importLabel(s: ResetState): string {
  return s.stage === 'armed' ? DATA_LABELS.importArmed : DATA_LABELS.importIdle;
}

/** Import text as sent to the session: surrounding whitespace and newlines removed. */
export function trimImportText(text: string): string {
  return text.trim();
}

/** True when the import textarea holds something besides whitespace. */
export function canImport(text: string): boolean {
  return trimImportText(text).length > 0;
}

/** Status line after an export copy attempt. */
export function copyStatusLabel(ok: boolean): string {
  return ok ? DATA_LABELS.copied : DATA_LABELS.selectAndCopy;
}
