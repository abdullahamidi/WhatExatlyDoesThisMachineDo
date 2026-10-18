// Pure model for the SYSTEM menu: two-step reset reducer and button labels (WP4).
import { MUTE_LABELS, RESET_LABELS, SAVE_LABELS, SYSTEM_MENU_CONFIG } from '../data/systemMenu';

export type ResetState = { stage: 'idle' } | { stage: 'armed'; armedAt: number };

export interface ResetEvent {
  type: 'press' | 'cancel' | 'tick';
  nowMs: number;
}

/**
 * Two-step reset. The execute flag is true only for the confirming press
 * (armed + press within armMs). Expired arms return to idle on tick or re-arm on press.
 */
export function reduceReset(
  s: ResetState,
  ev: ResetEvent,
  armMs: number = SYSTEM_MENU_CONFIG.resetArmMs,
): { state: ResetState; execute: boolean } {
  if (ev.type === 'cancel') return { state: { stage: 'idle' }, execute: false };

  if (s.stage === 'idle') {
    if (ev.type === 'press') return { state: { stage: 'armed', armedAt: ev.nowMs }, execute: false };
    return { state: { stage: 'idle' }, execute: false };
  }

  // armed
  const elapsed = ev.nowMs - s.armedAt;
  if (ev.type === 'press') {
    if (elapsed < armMs) return { state: { stage: 'idle' }, execute: true };
    return { state: { stage: 'armed', armedAt: ev.nowMs }, execute: false };
  }
  // tick
  if (elapsed >= armMs) return { state: { stage: 'idle' }, execute: false };
  return { state: s, execute: false };
}

export function muteLabel(muted: boolean): string {
  return muted ? MUTE_LABELS.off : MUTE_LABELS.on;
}

export function resetLabel(s: ResetState): string {
  return s.stage === 'armed' ? RESET_LABELS.armed : RESET_LABELS.idle;
}

export function saveFeedbackLabel(ok: boolean): string {
  return ok ? SAVE_LABELS.ok : SAVE_LABELS.failed;
}
