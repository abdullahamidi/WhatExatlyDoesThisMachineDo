import './titleScreen.css';
import { SYSTEM_MENU_CONFIG } from '../data/systemMenu';
import { TITLE_LOGO, TITLE_TEXT } from '../data/title';
import { trapFocus } from './hotkeys';
import type { ModalStack } from './modalStack';
import { reduceReset } from './systemMenuModel';
import type { ResetEvent, ResetState } from './systemMenuModel';
import { TITLE_BUTTON_DOM_IDS, titleView } from './titleModel';
import type { TitleButtonId, TitleView } from './titleModel';

// Title screen (WP19 T7, DOM). Built once in createTitleScreen; open/close toggle the is-open class. No Phaser.
// The title is a modal-stack entry: Esc means CONTINUE. NEW GAME with a save is a two-step press (5 s arm window,
// reduceReset from systemMenuModel); Esc or expiry disarms the confirm entry only, the title stays.
// Backdrop clicks do nothing. SETTINGS / CREDITS / QUIT call their deps and leave the title open.

export const TITLE_STACK_ID = 'title';
export const TITLE_CONFIRM_STACK_ID = 'title-confirm';

export type TitleResult = 'continue' | 'newGame';

export interface TitleScreenDeps {
  modals: ModalStack;
  hasSave: boolean;
  canQuit: boolean;
  versionLine: string;
  versionAria: string;
  onClose(result: TitleResult): void;
  openSettings(): void;
  openCredits(): void;
  quit(): void;
}

export interface TitleScreen {
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

function makeButton(id: TitleButtonId): HTMLButtonElement {
  const button = el('button', { id: TITLE_BUTTON_DOM_IDS[id], className: 'title-btn' });
  button.type = 'button';
  return button;
}

export function createTitleScreen(root: HTMLElement, deps: TitleScreenDeps): TitleScreen {
  const { modals } = deps;

  // ---- DOM skeleton (built once) ----
  const overlay = el('div', { id: 'title-screen' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', TITLE_TEXT.dialogLabel);

  const panel = el('div', { id: 'title-panel' });
  const logo = el('img', { id: 'title-logo' });
  // Absolute URL: the logo path is relative to the page, not to the stylesheet.
  logo.src = new URL(TITLE_LOGO.url, document.baseURI).href;
  logo.alt = TITLE_TEXT.logoAlt;
  logo.width = TITLE_LOGO.width * TITLE_LOGO.scale;
  logo.height = TITLE_LOGO.height * TITLE_LOGO.scale;
  logo.draggable = false;

  const menu = el('div', { className: 'title-menu' });
  const buttonFor: Record<TitleButtonId, HTMLButtonElement> = {
    continue: makeButton('continue'),
    newGame: makeButton('newGame'),
    settings: makeButton('settings'),
    credits: makeButton('credits'),
    quit: makeButton('quit'),
  };
  // Button order comes from the model (titleView), so the DOM order matches the spec order.
  const initial = titleView({ hasSave: deps.hasSave, canQuit: deps.canQuit, newGameArmed: false });
  for (const item of initial.buttons) menu.appendChild(buttonFor[item.id]);

  panel.append(logo, menu);

  const version = el('div', { id: 'title-version', text: deps.versionLine });
  version.setAttribute('aria-label', deps.versionAria);

  overlay.append(panel, version);
  root.appendChild(overlay);

  // ---- state ----
  let isOpenFlag = false;
  let destroyed = false;
  let resetState: ResetState = { stage: 'idle' };
  let expiryTimer: number | null = null;
  let disposeFocusTrap: (() => void) | null = null;

  // Applies the model to the buttons: labels, hidden state, armed look on NEW GAME.
  function render(): TitleView {
    const armed = resetState.stage === 'armed';
    const view = titleView({ hasSave: deps.hasSave, canQuit: deps.canQuit, newGameArmed: armed });
    for (const item of view.buttons) {
      const button = buttonFor[item.id];
      if (button.textContent !== item.label) button.textContent = item.label;
      button.hidden = !item.visible;
    }
    buttonFor.newGame.classList.toggle('is-armed', armed);
    return view;
  }

  const clearExpiry = (): void => {
    if (expiryTimer !== null) {
      window.clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  };

  // Schedules the arm expiry for the time left on the window (re-scheduled if a timer fires early).
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

  // Keeps the button look, the confirm stack entry and the expiry timer in step with resetState.
  function syncResetUi(): void {
    render();
    if (resetState.stage === 'armed') {
      modals.push(TITLE_CONFIRM_STACK_ID, disarm);
      scheduleExpiry();
    } else {
      clearExpiry();
      modals.remove(TITLE_CONFIRM_STACK_ID);
    }
  }

  // Applies one reset event; returns true only for the confirming press.
  function dispatchReset(type: ResetEvent['type']): boolean {
    const r = reduceReset(resetState, { type, nowMs: Date.now() });
    resetState = r.state;
    syncResetUi();
    return r.execute;
  }

  function disarm(): void {
    dispatchReset('cancel');
  }

  function releaseFocusTrap(): void {
    const dispose = disposeFocusTrap;
    disposeFocusTrap = null;
    if (dispose !== null) dispose();
  }

  function open(): void {
    if (destroyed || isOpenFlag) return;
    isOpenFlag = true;
    overlay.classList.add('is-open');
    const view = render();
    disposeFocusTrap = trapFocus(overlay);
    modals.push(TITLE_STACK_ID, () => dismiss('continue'));
    buttonFor[view.focus].focus();
  }

  function close(): void {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    disarm();
    releaseFocusTrap();
    modals.remove(TITLE_CONFIRM_STACK_ID);
    modals.remove(TITLE_STACK_ID);
    overlay.classList.remove('is-open');
  }

  // Closes the title, then reports the choice (Esc and CONTINUE pass 'continue').
  function dismiss(result: TitleResult): void {
    close();
    deps.onClose(result);
  }

  const onNewGame = (): void => {
    if (!deps.hasSave) {
      dismiss('newGame');
      return;
    }
    if (dispatchReset('press')) dismiss('newGame');
  };

  // Click handlers, kept so destroy() can remove them.
  const handlers: ReadonlyArray<readonly [HTMLButtonElement, () => void]> = [
    [buttonFor.continue, () => dismiss('continue')],
    [buttonFor.newGame, onNewGame],
    [buttonFor.settings, () => deps.openSettings()],
    [buttonFor.credits, () => deps.openCredits()],
    [buttonFor.quit, () => deps.quit()],
  ];
  for (const [button, fn] of handlers) button.addEventListener('click', fn);

  function isOpen(): boolean {
    return isOpenFlag;
  }

  function destroy(): void {
    if (destroyed) return;
    close();
    destroyed = true;
    releaseFocusTrap();
    for (const [button, fn] of handlers) button.removeEventListener('click', fn);
    clearExpiry();
    overlay.remove();
  }

  return { open, close, isOpen, destroy };
}
