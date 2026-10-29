// Keyboard shortcut rules (WP12 T5). Pure: plain objects only, no DOM globals.
// The DOM binding lives in hotkeys.ts.

import { CRANK_KEYS, HOTKEYS } from '../data/settings';

export type HotkeyAction = 'crank' | 'techTree' | 'fault' | 'find' | 'menu';
export type HotkeyTargetKind = 'editable' | 'interactive' | 'other';

export interface HotkeyEventLike {
  key: string;
  repeat: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  targetKind: HotkeyTargetKind;
  modalOpen: boolean;
}

const CRANK_KEY_SET: readonly string[] = CRANK_KEYS.keys;
const CRANK_MIN_GAP_MS = 1000 / CRANK_KEYS.maxPerSecond;

/**
 * Decides which global action (if any) a keydown triggers.
 * `lastCrankMs` is the time of the last crank action (-Infinity before the first one).
 */
export function resolveHotkey(e: HotkeyEventLike, lastCrankMs: number, nowMs: number): HotkeyAction | null {
  if (e.ctrl || e.meta || e.alt) return null;
  if (e.targetKind === 'editable') return null;

  if (CRANK_KEY_SET.includes(e.key)) {
    if (e.repeat || e.modalOpen || e.targetKind !== 'other') return null;
    return nowMs - lastCrankMs >= CRANK_MIN_GAP_MS ? 'crank' : null;
  }

  if (e.key.toLowerCase() === HOTKEYS.techTree) {
    return e.repeat ? null : 'techTree';
  }

  // F clears a machine fault (WP27). Like t it works on an interactive target (a focused button) and is
  // blocked by an open modal, so a dialog never sees the fault action behind it.
  if (e.key.toLowerCase() === HOTKEYS.fault) {
    return !e.repeat && !e.modalOpen ? 'fault' : null;
  }

  // G picks up a Find (WP28). Same rules as F: it works on an interactive target and an open modal blocks it.
  if (e.key.toLowerCase() === HOTKEYS.find) {
    return !e.repeat && !e.modalOpen ? 'find' : null;
  }

  if (e.key === HOTKEYS.menu) {
    return !e.modalOpen && !e.repeat ? 'menu' : null;
  }

  return null;
}

/**
 * Index after a Tab step inside a ring of `count` items.
 * count 0 -> -1. An index outside 0..count-1 (e.g. -1 = focus not inside) goes to the first item
 * (forward) or the last item (backwards). Otherwise wraps at both ends.
 */
export function wrapFocusIndex(index: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    return backwards ? count - 1 : 0;
  }
  if (backwards) return (index - 1 + count) % count;
  return (index + 1) % count;
}

/**
 * Focus-trap stack (oldest first). Only the top (most recently armed) trap handles Tab, so stacked dialogs
 * never fight over focus. Pure: returns a new array, never mutates the input.
 */
export function pushTrap<T>(stack: readonly T[], trap: T): T[] {
  return [...stack.filter((t) => t !== trap), trap];
}

/** Removes `trap` wherever it sits in the stack (a middle trap disposed first leaves the others in order). */
export function removeTrap<T>(stack: readonly T[], trap: T): T[] {
  return stack.filter((t) => t !== trap);
}

/** The trap that owns Tab: the top of the stack, or null when the stack is empty. */
export function topTrap<T>(stack: readonly T[]): T | null {
  if (stack.length === 0) return null;
  return stack[stack.length - 1] ?? null;
}
