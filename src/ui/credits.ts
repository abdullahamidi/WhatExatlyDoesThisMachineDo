import './credits.css';
import { CREDITS, CREDITS_TEXT } from '../data/credits';
import { trapFocus } from './hotkeys';
import type { ModalStack } from './modalStack';

// CREDITS modal (WP19 T7, DOM). Shared: opened from the title screen and later from the SYSTEM menu.
// Built once; open/close toggle the is-open class. Esc is handled by the shared modal stack only.
// Backdrop click and the CLOSE button close it; focus returns to the element that had it before open().

export const CREDITS_STACK_ID = 'credits';

export interface CreditsModal {
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

interface ElementOptions {
  id?: string;
  className?: string;
  text?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, options: ElementOptions = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.id !== undefined) node.id = options.id;
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}

export function createCredits(root: HTMLElement, o: { modals: ModalStack }): CreditsModal {
  const { modals } = o;

  // ---- DOM skeleton (built once) ----
  const overlay = el('div', { id: 'credits-overlay' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'credits-title');

  const panel = el('div', { id: 'credits-panel' });
  panel.appendChild(el('h2', { id: 'credits-title', text: CREDITS_TEXT.title }));
  for (const section of CREDITS) {
    panel.appendChild(el('h3', { className: 'credits-heading', text: section.heading }));
    for (const line of section.lines) {
      panel.appendChild(el('p', { className: 'credits-line', text: line }));
    }
  }
  const closeButton = el('button', { id: 'credits-close', className: 'sys-btn-like', text: CREDITS_TEXT.close });
  closeButton.type = 'button';
  panel.appendChild(closeButton);

  overlay.appendChild(panel);
  root.appendChild(overlay);

  // ---- state ----
  let isOpenFlag = false;
  let destroyed = false;
  let returnFocus: HTMLElement | null = null;
  let disposeFocusTrap: (() => void) | null = null;

  function releaseFocusTrap(): void {
    const dispose = disposeFocusTrap;
    disposeFocusTrap = null;
    if (dispose !== null) dispose();
  }

  function open(): void {
    if (destroyed || isOpenFlag) return;
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement ? active : null;
    isOpenFlag = true;
    overlay.classList.add('is-open');
    disposeFocusTrap = trapFocus(overlay);
    modals.push(CREDITS_STACK_ID, close);
    closeButton.focus();
  }

  function close(): void {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    releaseFocusTrap();
    overlay.classList.remove('is-open');
    modals.remove(CREDITS_STACK_ID);
    const target = returnFocus;
    returnFocus = null;
    if (target !== null && target.isConnected) target.focus();
  }

  const onCloseClick = (): void => {
    close();
  };

  const onBackdropClick = (event: Event): void => {
    if (event.target === overlay) close();
  };

  closeButton.addEventListener('click', onCloseClick);
  overlay.addEventListener('click', onBackdropClick);

  function isOpen(): boolean {
    return isOpenFlag;
  }

  function destroy(): void {
    if (destroyed) return;
    close();
    destroyed = true;
    closeButton.removeEventListener('click', onCloseClick);
    overlay.removeEventListener('click', onBackdropClick);
    overlay.remove();
  }

  return { open, close, isOpen, destroy };
}
