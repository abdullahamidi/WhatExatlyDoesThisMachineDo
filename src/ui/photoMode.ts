import './photoMode.css';
import { PHOTO_MODE } from '../data/photoMode';
import { photoKeyAction, shouldRestoreFocus } from './photoModeRules';
import type { FocusHolder } from './photoModeRules';

// Photo mode DOM overlay (WP18). One exit chip plus the pan / zoom keys. The root class hides every other #ui-root child
// (CSS), so this module never touches the HUD DOM. The chip fades out after a hint; pointer move, focus or hover brings it back.
// Esc is not handled here: the shared modal stack closes the 'photo' entry.

export interface PhotoOverlayDeps {
  onExit(): void;
  onPan(dx: -1 | 0 | 1, dy: -1 | 0 | 1): void;
  onZoom(dir: 1 | -1): void;
}

export interface PhotoOverlay {
  show(opts: { hint: boolean }): void;
  hide(): void;
  isShown(): boolean;
  hintVisible(): boolean;
  destroy(): void;
}

// Focus goes back here on exit so keyboard users land on the button that opened photo mode.
const VIEW_MACHINE_ID = 'hud-view-machine';

export function createPhotoOverlay(root: HTMLElement, deps: PhotoOverlayDeps): PhotoOverlay {
  const chip = document.createElement('button');
  chip.id = 'photo-exit';
  chip.className = 'photo-chip';
  chip.type = 'button';
  chip.hidden = true;
  chip.setAttribute('aria-label', PHOTO_MODE.exitAria);
  chip.textContent = PHOTO_MODE.exitLabel;
  root.appendChild(chip);

  let shown = false;
  let destroyed = false;
  let hint = false;
  let hintTimer: number | null = null;
  // Set only around our own chip.focus() call, so entering photo mode does not count as user activity.
  let programmaticFocus = false;

  function clearHint(): void {
    if (hintTimer !== null) {
      window.clearTimeout(hintTimer);
      hintTimer = null;
    }
    hint = false;
    chip.classList.toggle('photo-chip--hint', false);
  }

  function armHint(): void {
    if (hintTimer !== null) window.clearTimeout(hintTimer);
    hint = true;
    chip.classList.toggle('photo-chip--hint', true);
    hintTimer = window.setTimeout(clearHint, PHOTO_MODE.hintMs);
  }

  const onPointerMove = (): void => {
    if (shown) armHint();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = photoKeyAction(e.key);
    if (action === null) return;
    e.preventDefault();
    if (action.kind === 'pan') deps.onPan(action.dx, action.dy);
    else deps.onZoom(action.dir);
    // keyboard counterpart of the pointermove hint: the chip fades after hintMs, so every handled key shows it again
    armHint();
  };

  const onChipFocus = (): void => {
    if (shown && !programmaticFocus) armHint();
  };

  const onChipClick = (): void => {
    deps.onExit();
  };

  chip.addEventListener('click', onChipClick);
  chip.addEventListener('focus', onChipFocus);

  function show(opts: { hint: boolean }): void {
    if (destroyed) return;
    if (shown) {
      if (opts.hint) armHint();
      return;
    }
    shown = true;
    root.classList.add(PHOTO_MODE.rootClass);
    chip.hidden = false;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKeyDown);
    programmaticFocus = true;
    try {
      chip.focus({ preventScroll: true });
    } finally {
      programmaticFocus = false;
    }
    if (opts.hint) armHint();
    else clearHint();
  }

  function hide(): void {
    if (!shown) return;
    // Read focus before chip.hidden: hiding the focused chip drops focus to body and loses who held it.
    const active = document.activeElement;
    const holder: FocusHolder = active === chip ? 'chip' : active === null || active === document.body ? 'none' : 'other';
    shown = false;
    clearHint();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('keydown', onKeyDown);
    root.classList.remove(PHOTO_MODE.rootClass);
    chip.hidden = true;
    // A modal that took focus (tech tree opened with T) keeps it; only the chip or nothing hands focus back.
    if (shouldRestoreFocus(holder)) {
      const back = document.getElementById(VIEW_MACHINE_ID);
      if (back !== null && !back.hidden) back.focus({ preventScroll: true });
    }
  }

  function destroy(): void {
    if (destroyed) return;
    hide();
    destroyed = true;
    chip.removeEventListener('click', onChipClick);
    chip.removeEventListener('focus', onChipFocus);
    chip.remove();
  }

  return {
    show,
    hide,
    isShown: () => shown,
    hintVisible: () => hint,
    destroy,
  };
}
