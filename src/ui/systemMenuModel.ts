// Pure model for the SYSTEM menu: two-step reset reducer and button labels (WP4), NEW CYCLE row (WP13).
import { MUTE_LABELS, RESET_LABELS, SAVE_LABELS, SYSTEM_MENU_CONFIG } from '../data/systemMenu';
import { FINALE_CHOICE } from '../data/finale';
import type { EndingPhase } from '../data/types';

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

export interface NewCycleRow {
  visible: boolean;
  enabled: boolean;
  label: string;
  reason: string;
}

/** BEGIN A NEW CYCLE row in the SYSTEM tab: visible only in postgame; enabled when the hook has no reason. */
export function newCycleRow(phase: EndingPhase, reason: string | null): NewCycleRow {
  return {
    visible: phase === 'postgame',
    enabled: reason === null,
    label: FINALE_CHOICE.cycle.label,
    reason: reason ?? '',
  };
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

/** Index of the tab with `id`; 0 when `id` is undefined or not in the list. */
export function tabIndexFor(tabIds: readonly string[], id: string | undefined): number {
  if (id === undefined) return 0;
  const index = tabIds.indexOf(id);
  return index < 0 ? 0 : index;
}

/** WP19 shell rows in the SYSTEM tab: CREDITS and QUIT TO DESKTOP show only when their hooks are given. */
export function shellRows(o: { hasCredits: boolean; canQuit: boolean }): { credits: boolean; quit: boolean } {
  return { credits: o.hasCredits, quit: o.canQuit };
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

/** WP20 (D12): MEMORY-style tabs show once prestige matters: a second cycle, or the ending choice / postgame. */
export function prestigeUiVisible(phase: EndingPhase, cycle: number): boolean {
  return cycle > 1 || phase === 'choice' || phase === 'postgame';
}

/**
 * WP20 (D12): tab index after a navigation key, skipping hidden tabs. Home / End jump to the first / last visible
 * tab; arrows wrap. The walk ends at `index` itself, so a lone visible tab maps to itself. No visible tab gives 0.
 */
export function nextVisibleTab(index: number, visible: readonly boolean[], key: TabNavKey): number {
  const count = visible.length;
  const first = visible.indexOf(true);
  if (first < 0) return 0;
  if (key === 'Home') return first;
  if (key === 'End') return visible.lastIndexOf(true);
  const i = clampTab(index, count);
  const step = key === 'ArrowRight' ? 1 : -1;
  for (let k = 1; k <= count; k++) {
    const j = (((i + step * k) % count) + count) % count;
    if (visible[j] === true) return j;
  }
  return i;
}
