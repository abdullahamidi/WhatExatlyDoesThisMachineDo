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

export type TabNavKey = 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End';

/** Clamps a tab index into 0..count-1 (0 when there are no tabs). */
export function clampTab(index: number, count: number): number {
  if (count <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

/** Tab being left when the selection moves from `from` to `to`; null when the selection stays put. */
export function leavingTab(from: number, to: number): number | null {
  return from === to ? null : from;
}

/** Tab index after a navigation key. Arrows wrap; Home / End jump to the ends. */
export function nextTab(index: number, count: number, key: TabNavKey): number {
  if (count <= 0) return 0;
  const i = clampTab(index, count);
  switch (key) {
    case 'ArrowRight':
      return (i + 1) % count;
    case 'ArrowLeft':
      return (i - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
  }
}
