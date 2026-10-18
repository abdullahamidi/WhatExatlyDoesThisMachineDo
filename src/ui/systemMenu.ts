import './systemMenu.css';
import { SYSTEM_MENU_CONFIG } from '../data/systemMenu';
import type { ModalStack } from './modalStack';
import { muteLabel, reduceReset, resetLabel, saveFeedbackLabel } from './systemMenuModel';
import type { ResetState } from './systemMenuModel';

// SYSTEM menu overlay (DOM). Built once; open/close toggle the is-open class. No Phaser.
// Esc is handled by the shared modal stack (bindEscapeToStack); this file registers no key listener.

export interface SystemMenuDeps {
  isMuted(): boolean;
  setMuted(m: boolean): void;
  saveNow(): boolean;
  resetProgress(): void;
  modals: ModalStack;
}

export interface SystemMenu { open(): void; close(): void; toggle(): void; isOpen(): boolean; destroy(): void }

const MENU_STACK_ID = 'system-menu';
const RESET_STACK_ID = 'system-reset';

type ResetEventType = 'press' | 'cancel' | 'tick';

interface ElementOptions { id?: string; className?: string; text?: string }

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (options.id !== undefined) el.id = options.id;
  if (options.className !== undefined) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  return el;
}

export function createSystemMenu(root: HTMLElement, deps: SystemMenuDeps): SystemMenu {
  const { modals } = deps;

  // ---- DOM skeleton (built once) ----
  const overlay = createElement('div', { id: 'system-menu' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'sys-title');

  const panel = createElement('div', { id: 'system-panel' });
  const title = createElement('h2', { id: 'sys-title', text: 'SYSTEM' });

  const muteButton = createElement('button', { id: 'sys-mute', className: 'sys-btn' });
  muteButton.type = 'button';
  const saveButton = createElement('button', { id: 'sys-save', className: 'sys-btn', text: 'SAVE STATE' });
  saveButton.type = 'button';
  const resetButton = createElement('button', {
    id: 'sys-reset',
    className: 'sys-btn',
    text: resetLabel({ stage: 'idle' }),
  });
  resetButton.type = 'button';
  const cancelButton = createElement('button', { id: 'sys-reset-cancel', className: 'sys-btn', text: 'CANCEL' });
  cancelButton.type = 'button';
  cancelButton.hidden = true;
  const feedbackEl = createElement('div', { id: 'sys-feedback' });
  feedbackEl.setAttribute('aria-live', 'polite');
  const closeButton = createElement('button', { id: 'sys-close', className: 'sys-btn', text: 'CLOSE [ESC]' });
  closeButton.type = 'button';

  panel.append(title, muteButton, saveButton, resetButton, cancelButton, feedbackEl, closeButton);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  // ---- state ----
  let isOpenFlag = false;
  let destroyed = false;
  let resetState: ResetState = { stage: 'idle' };
  let returnFocus: HTMLElement | null = null;
  let feedbackTimer: number | null = null;
  let expiryTimer: number | null = null;

  const refreshMute = (): void => {
    muteButton.textContent = muteLabel(deps.isMuted());
  };

  const clearFeedback = (): void => {
    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    feedbackEl.textContent = '';
  };

  const showSaveFeedback = (ok: boolean): void => {
    if (feedbackTimer !== null) window.clearTimeout(feedbackTimer);
    feedbackEl.textContent = saveFeedbackLabel(ok);
    feedbackTimer = window.setTimeout(() => {
      feedbackTimer = null;
      feedbackEl.textContent = '';
    }, SYSTEM_MENU_CONFIG.saveFeedbackMs);
  };

  const clearExpiry = (): void => {
    if (expiryTimer !== null) {
      window.clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  };

  // Schedules the reset expiry for the time left on the arm window (re-scheduled if a timer fires early).
  function scheduleExpiry(): void {
    clearExpiry();
    if (resetState.stage !== 'armed') return;
    const remaining = Math.max(0, resetState.armedAt + SYSTEM_MENU_CONFIG.resetArmMs - Date.now());
    expiryTimer = window.setTimeout(onExpiry, remaining);
  }

  function onExpiry(): void {
    expiryTimer = null;
    dispatchReset('tick');
  }

  // Keeps the reset button, cancel button and the RESET stack layer in step with resetState.
  function syncResetUi(): void {
    const armed = resetState.stage === 'armed';
    resetButton.textContent = resetLabel(resetState);
    resetButton.classList.toggle('is-armed', armed);
    cancelButton.hidden = !armed;
    if (armed) {
      modals.push(RESET_STACK_ID, cancelReset);
      scheduleExpiry();
    } else {
      clearExpiry();
      modals.remove(RESET_STACK_ID);
    }
  }

  // Applies one reset event; returns true only for the confirming press.
  function dispatchReset(type: ResetEventType): boolean {
    const r = reduceReset(resetState, { type, nowMs: Date.now() });
    resetState = r.state;
    syncResetUi();
    return r.execute;
  }

  function cancelReset(): void {
    dispatchReset('cancel');
  }

  function open(): void {
    if (destroyed || isOpenFlag) return;
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement ? active : null;
    isOpenFlag = true;
    overlay.classList.add('is-open');
    refreshMute();
    modals.push(MENU_STACK_ID, close);
    closeButton.focus();
  }

  function close(): void {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    dispatchReset('cancel');
    clearFeedback();
    overlay.classList.remove('is-open');
    modals.remove(MENU_STACK_ID);
    const target = returnFocus;
    returnFocus = null;
    if (target !== null && target.isConnected) target.focus();
  }

  const onMute = (): void => {
    deps.setMuted(!deps.isMuted());
    refreshMute();
  };

  const onSave = (): void => {
    showSaveFeedback(deps.saveNow());
  };

  const onReset = (): void => {
    if (dispatchReset('press')) {
      deps.resetProgress();
      close();
    }
  };

  const onCancel = (): void => {
    cancelReset();
    resetButton.focus();
  };

  const onClose = (): void => {
    close();
  };

  const onBackdropClick = (event: Event): void => {
    if (event.target === overlay) close();
  };

  muteButton.addEventListener('click', onMute);
  saveButton.addEventListener('click', onSave);
  resetButton.addEventListener('click', onReset);
  cancelButton.addEventListener('click', onCancel);
  closeButton.addEventListener('click', onClose);
  overlay.addEventListener('click', onBackdropClick);
  refreshMute();

  function toggle(): void {
    if (isOpenFlag) close();
    else open();
  }

  function isOpen(): boolean {
    return isOpenFlag;
  }

  function destroy(): void {
    if (destroyed) return;
    close();
    dispatchReset('cancel');
    destroyed = true;
    muteButton.removeEventListener('click', onMute);
    saveButton.removeEventListener('click', onSave);
    resetButton.removeEventListener('click', onReset);
    cancelButton.removeEventListener('click', onCancel);
    closeButton.removeEventListener('click', onClose);
    overlay.removeEventListener('click', onBackdropClick);
    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    clearExpiry();
    overlay.remove();
  }

  return { open, close, toggle, isOpen, destroy };
}
