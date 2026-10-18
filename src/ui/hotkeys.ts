// Global keyboard shortcuts and the focus trap (WP12 T5). DOM only: no Phaser.
// Decision rules live in hotkeyRules.ts. Escape-to-close stays in modalStack's capture listener;
// the bubble listener here only sees Escape when no modal consumed it (it opens the system menu).

import type { ModalStack } from './modalStack';
import { resolveHotkey, wrapFocusIndex } from './hotkeyRules';
import type { HotkeyTargetKind } from './hotkeyRules';

export interface HotkeyDeps {
  modals: ModalStack;
  crank(): void;
  toggleTechTree(): void;
  openMenu(): void;
  now?(): number;
}

/** Input types that take no typed text: they keep the global keys (space, t, Escape). */
const NON_TEXT_INPUT_TYPES: readonly string[] = ['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image'];

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'summary',
  '[role="button"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="slider"]',
  'input[type="range"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
].join(', ');

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Classifies a keydown target: text entry (editable) > clickable controls (interactive) > everything else. */
function classifyTarget(target: EventTarget | null): HotkeyTargetKind {
  if (!(target instanceof HTMLElement)) return 'other';
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return 'editable';
  if (target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.includes(target.type)) return 'editable';
  if (target.isContentEditable) return 'editable';
  if (target.matches(INTERACTIVE_SELECTOR)) return 'interactive';
  return 'other';
}

/**
 * Binds the global keys on `target` (bubble phase). Handled keys are preventDefault-ed;
 * lastCrankMs moves only when the crank action fires. Returns the disposer.
 */
export function bindHotkeys(target: Window, deps: HotkeyDeps): () => void {
  const now = deps.now ?? ((): number => performance.now());
  let lastCrankMs = -Infinity;

  const listener = (event: KeyboardEvent): void => {
    const t = now();
    const action = resolveHotkey(
      {
        key: event.key,
        repeat: event.repeat,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        targetKind: classifyTarget(event.target),
        modalOpen: deps.modals.isOpen(),
      },
      lastCrankMs,
      t,
    );
    if (action === null) return;
    event.preventDefault();
    if (action === 'crank') {
      lastCrankMs = t;
      deps.crank();
    } else if (action === 'techTree') {
      deps.toggleTechTree();
    } else {
      deps.openMenu();
    }
  };

  target.addEventListener('keydown', listener);
  return () => {
    target.removeEventListener('keydown', listener);
  };
}

/** Visible, enabled, tabbable descendants in document order. */
function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * Keeps Tab / Shift+Tab inside `container`: focus cycles over its visible focusable descendants.
 * Focus outside the container enters at the first (Tab) or last (Shift+Tab) item. Returns the disposer.
 */
export function trapFocus(container: HTMLElement): () => void {
  const doc = container.ownerDocument;
  const listener = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const items = focusableWithin(container);
    const active = doc.activeElement;
    const index = items.findIndex((el) => el === active);
    const next = items[wrapFocusIndex(index, items.length, event.shiftKey)];
    event.preventDefault();
    next?.focus();
  };

  doc.addEventListener('keydown', listener);
  return () => {
    doc.removeEventListener('keydown', listener);
  };
}
