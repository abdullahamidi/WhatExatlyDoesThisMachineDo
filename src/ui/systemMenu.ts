import './systemMenu.css';
import { MENU_REFRESH_MS, MENU_TABS, MENU_TEXT, SYSTEM_MENU_CONFIG } from '../data/systemMenu';
import { UI_ART } from '../data/achievements';
import { trapFocus } from './hotkeys';
import type { ModalStack } from './modalStack';
import { clampTab, leavingTab, muteLabel, newCycleRow, nextTab, reduceReset, resetLabel, saveFeedbackLabel } from './systemMenuModel';
import type { NewCycleRow, ResetState, TabNavKey } from './systemMenuModel';
import type { EndingPhase } from '../data/types';
import type { NewCycleHook } from '../game/newCycle';

// SYSTEM menu overlay (DOM). Built once; open/close toggle the is-open class. No Phaser.
// Esc is handled by the shared modal stack (bindEscapeToStack); this file registers no key listener.
// Tabs: SYSTEM (always first, built here) + one tab per deps.panels entry. Panels are mounted once
// into their tabpanel and refreshed when their tab is shown and when the menu opens.
// Panels may drop transient state (armed confirmations, modal-stack entries) through hide(): called
// when the menu closes and when the selection moves away from their tab.

export interface SystemMenuPanelHandle {
  refresh(): void;
  destroy(): void;
  hide?(): void;
}

export interface SystemMenuPanel {
  id: string;
  label: string;
  mount(host: HTMLElement): SystemMenuPanelHandle;
}

export interface SystemMenuDeps {
  isMuted(): boolean;
  setMuted(m: boolean): void;
  saveNow(): boolean;
  resetProgress(): void;
  modals: ModalStack;
  panels?: readonly SystemMenuPanel[];
  /** WP13: NEW CYCLE row (SYSTEM tab, postgame only). Omitted = row never shows. */
  ending?: { phase(): EndingPhase; newCycle: NewCycleHook };
}

export interface SystemMenu { open(): void; close(): void; toggle(): void; isOpen(): boolean; destroy(): void }

/** Timer pair the refresh loop needs; injected so tests can use fake timers. */
export interface IntervalTimers<H> { setInterval(fn: () => void, ms: number): H; clearInterval(handle: H): void }

/** Repeating tick with idempotent start/stop (start while running and stop while stopped do nothing). */
export interface PeriodicRefresh { start(): void; stop(): void; running(): boolean }

export function createPeriodicRefresh<H>(tick: () => void, everyMs: number, timers: IntervalTimers<H>): PeriodicRefresh {
  let handle: { value: H } | null = null;
  return {
    start(): void {
      if (handle !== null) return;
      handle = { value: timers.setInterval(tick, everyMs) };
    },
    stop(): void {
      if (handle === null) return;
      const current = handle;
      handle = null;
      timers.clearInterval(current.value);
    },
    running(): boolean {
      return handle !== null;
    },
  };
}

const MENU_STACK_ID = 'system-menu';
const RESET_STACK_ID = 'system-reset';

type ResetEventType = 'press' | 'cancel' | 'tick';

interface ElementOptions { id?: string; className?: string; text?: string }

interface TabEntry {
  id: string;
  button: HTMLButtonElement;
  pane: HTMLDivElement;
  handle: SystemMenuPanelHandle | null;
}

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

function isTabNavKey(key: string): key is TabNavKey {
  return key === 'ArrowRight' || key === 'ArrowLeft' || key === 'Home' || key === 'End';
}

export function createSystemMenu(root: HTMLElement, deps: SystemMenuDeps): SystemMenu {
  const { modals } = deps;

  // ---- DOM skeleton (built once) ----
  const overlay = createElement('div', { id: 'system-menu' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'sys-title');
  // 9-slice art (CSS keeps the plain border when a var is missing). Absolute URLs: a relative url() in a custom
  // property resolves against the stylesheet (the built CSS sits in assets/), not the page.
  overlay.style.setProperty('--ui-panel', `url("${new URL(UI_ART.panel, document.baseURI).href}")`);
  overlay.style.setProperty('--ui-button', `url("${new URL(UI_ART.button, document.baseURI).href}")`);
  overlay.style.setProperty('--ui-slice', String(UI_ART.nineSliceBorder));

  const panel = createElement('div', { id: 'system-panel' });
  const title = createElement('h2', { id: 'sys-title', text: MENU_TEXT.title });

  const tabList = createElement('div', { id: 'sys-tabs', className: 'sys-tabs' });
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-labelledby', 'sys-title');

  const body = createElement('div', { id: 'sys-body', className: 'sys-body' });

  const tabs: TabEntry[] = [];

  function addTab(id: string, label: string): TabEntry {
    const button = createElement('button', { id: `sys-tab-${id}`, className: 'sys-tab', text: label });
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `sys-panel-${id}`);
    button.setAttribute('aria-selected', 'false');
    button.tabIndex = -1;
    const pane = createElement('div', { id: `sys-panel-${id}`, className: 'sys-tabpanel' });
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', button.id);
    pane.hidden = true;
    const entry: TabEntry = { id, button, pane, handle: null };
    tabs.push(entry);
    tabList.appendChild(button);
    body.appendChild(pane);
    return entry;
  }

  // SYSTEM tab: the original controls (ids and order unchanged) live in its tabpanel.
  const systemPane = addTab(MENU_TABS.system.id, MENU_TABS.system.label).pane;

  const muteButton = createElement('button', { id: 'sys-mute', className: 'sys-btn' });
  muteButton.type = 'button';
  const saveButton = createElement('button', { id: 'sys-save', className: 'sys-btn', text: MENU_TEXT.save });
  saveButton.type = 'button';
  const resetButton = createElement('button', {
    id: 'sys-reset',
    className: 'sys-btn',
    text: resetLabel({ stage: 'idle' }),
  });
  resetButton.type = 'button';
  const cancelButton = createElement('button', { id: 'sys-reset-cancel', className: 'sys-btn', text: MENU_TEXT.cancel });
  cancelButton.type = 'button';
  cancelButton.hidden = true;
  // WP13 NEW CYCLE row: hidden by default, shown in open() only when deps.ending says postgame.
  const newCycleButton = createElement('button', { id: 'sys-new-cycle', className: 'sys-btn' });
  newCycleButton.type = 'button';
  newCycleButton.hidden = true;
  const newCycleReason = createElement('div', { id: 'sys-new-cycle-reason' });
  newCycleReason.hidden = true;
  const feedbackEl = createElement('div', { id: 'sys-feedback' });
  feedbackEl.setAttribute('aria-live', 'polite');
  const closeButton = createElement('button', { id: 'sys-close', className: 'sys-btn', text: MENU_TEXT.close });
  closeButton.type = 'button';

  systemPane.append(muteButton, saveButton, resetButton, cancelButton, newCycleButton, newCycleReason, feedbackEl);

  // Extra panels: mounted once, each into its own tabpanel.
  for (const p of deps.panels ?? []) {
    const tab = addTab(p.id, p.label);
    tab.handle = p.mount(tab.pane);
  }

  panel.append(title, tabList, body, closeButton);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  // ---- state ----
  let isOpenFlag = false;
  let destroyed = false;
  let resetState: ResetState = { stage: 'idle' };
  let returnFocus: HTMLElement | null = null;
  let feedbackTimer: number | null = null;
  let expiryTimer: number | null = null;
  let activeIndex = 0;
  let disposeFocusTrap: (() => void) | null = null;
  const tabUnbinders: Array<() => void> = [];
  // Live refresh of the active panel while the menu is open (STATS playtime etc.). Started in open(), stopped in close().
  const menuRefresh = createPeriodicRefresh(
    () => tabs[activeIndex]?.handle?.refresh(),
    MENU_REFRESH_MS,
    { setInterval: (fn, ms) => window.setInterval(fn, ms), clearInterval: (h) => window.clearInterval(h) },
  );

  const refreshMute = (): void => {
    muteButton.textContent = muteLabel(deps.isMuted());
  };

  // NEW CYCLE row state; the last computed row also guards the click (disabled rows do nothing).
  let cycleRow: NewCycleRow = newCycleRow('none', null);
  const refreshNewCycle = (): void => {
    cycleRow = newCycleRow(deps.ending?.phase() ?? 'none', deps.ending?.newCycle.blockedReason() ?? null);
    newCycleButton.hidden = !cycleRow.visible;
    newCycleButton.textContent = cycleRow.label;
    newCycleButton.classList.toggle('is-disabled', !cycleRow.enabled);
    newCycleButton.setAttribute('aria-disabled', cycleRow.enabled ? 'false' : 'true');
    if (cycleRow.enabled) newCycleButton.removeAttribute('aria-description');
    else newCycleButton.setAttribute('aria-description', cycleRow.reason);
    newCycleReason.hidden = !cycleRow.visible || cycleRow.reason === '';
    newCycleReason.textContent = cycleRow.reason;
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

  // Marks one tab as selected (ARIA, roving tabindex, visibility). Does not refresh anything.
  function selectTab(index: number): void {
    const next = clampTab(index, tabs.length);
    const left = leavingTab(activeIndex, next);
    activeIndex = next;
    if (left !== null) tabs[left]?.handle?.hide?.();
    tabs.forEach((tab, i) => {
      const on = i === activeIndex;
      tab.button.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.button.tabIndex = on ? 0 : -1;
      tab.button.classList.toggle('is-active', on);
      tab.pane.hidden = !on;
    });
  }

  // Selects a tab and refreshes the active panel (SYSTEM has no handle).
  function activateTab(index: number, focus: boolean): void {
    selectTab(index);
    tabs[activeIndex]?.handle?.refresh();
    if (focus) tabs[activeIndex]?.button.focus();
  }

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
    activateTab(0, false);
    refreshMute();
    refreshNewCycle();
    disposeFocusTrap = trapFocus(overlay);
    modals.push(MENU_STACK_ID, close);
    menuRefresh.start();
    closeButton.focus();
  }

  function close(): void {
    if (!isOpenFlag) return;
    isOpenFlag = false;
    menuRefresh.stop();
    releaseFocusTrap();
    dispatchReset('cancel');
    for (const tab of tabs) tab.handle?.hide?.();
    clearFeedback();
    overlay.classList.remove('is-open');
    modals.remove(MENU_STACK_ID);
    selectTab(0);
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

  const onNewCycle = (): void => {
    const ending = deps.ending;
    if (ending === undefined || !cycleRow.visible || !cycleRow.enabled) return;
    ending.newCycle.begin();
    close();
  };

  const onClose = (): void => {
    close();
  };

  const onBackdropClick = (event: Event): void => {
    if (event.target === overlay) close();
  };

  // Tab buttons: click selects; arrows / Home / End move focus and selection (Enter / Space use the native click).
  function listen<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    fn: (event: HTMLElementEventMap[K]) => void,
  ): void {
    el.addEventListener(type, fn);
    tabUnbinders.push(() => el.removeEventListener(type, fn));
  }

  const onTabKeydown = (event: KeyboardEvent, index: number): void => {
    const key = event.key;
    if (!isTabNavKey(key)) return;
    event.preventDefault();
    activateTab(nextTab(index, tabs.length, key), true);
  };

  tabs.forEach((tab, i) => {
    listen(tab.button, 'click', () => activateTab(i, false));
    listen(tab.button, 'keydown', (event) => onTabKeydown(event, i));
  });

  muteButton.addEventListener('click', onMute);
  saveButton.addEventListener('click', onSave);
  resetButton.addEventListener('click', onReset);
  cancelButton.addEventListener('click', onCancel);
  newCycleButton.addEventListener('click', onNewCycle);
  closeButton.addEventListener('click', onClose);
  overlay.addEventListener('click', onBackdropClick);
  selectTab(0);
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
    menuRefresh.stop();
    dispatchReset('cancel');
    destroyed = true;
    releaseFocusTrap();
    tabUnbinders.forEach((unbind) => unbind());
    tabUnbinders.length = 0;
    muteButton.removeEventListener('click', onMute);
    saveButton.removeEventListener('click', onSave);
    resetButton.removeEventListener('click', onReset);
    cancelButton.removeEventListener('click', onCancel);
    newCycleButton.removeEventListener('click', onNewCycle);
    closeButton.removeEventListener('click', onClose);
    overlay.removeEventListener('click', onBackdropClick);
    if (feedbackTimer !== null) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    clearExpiry();
    for (const tab of tabs) tab.handle?.destroy();
    overlay.remove();
  }

  return { open, close, toggle, isOpen, destroy };
}
