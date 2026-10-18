import './cycleConfirm.css';
import { ASSET_MANIFEST, resolveAssetUrl } from '../assets/manifest';
import type { AssetId } from '../assets/assetIds';
import { PRESTIGE_TEXT } from '../data/prestige';
import type { CyclePreview } from '../simulation/prestige';
import { buildCycleConfirm } from './cycleConfirmView';
import type { CycleConfirmModel } from './cycleConfirmView';
import { trapFocus } from './hotkeys';
import type { ModalStack } from './modalStack';
import { resourceShort } from './revealRules';

// New-cycle confirm dialog (WP14 C6 / D10, DOM). Built once. open(preview, onConfirm) fills it from buildCycleConfirm and
// shows it as the modal 'cycleConfirm' (Esc and CANCEL close through the modal stack). BEGIN closes the dialog first and
// then runs onConfirm (the controller's commit). Stacks above the finale overlay (160) and the system menu (150).

export interface CycleConfirmDeps {
  modals: ModalStack;
}

export interface CycleConfirmHandle {
  open(preview: CyclePreview, onConfirm: () => void): void;
  close(): void;
  destroy(): void;
}

const MODAL_ID = 'cycleConfirm';
/** ui.icons16 frame on the BEGIN button (ART_ERA5 §8). */
const BEGIN_ICON = 1;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}

/** Writes text only when it changed (no DOM churn on repeated opens). */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Absolute URL for a CSS url(): a relative path inside a custom property resolves against the stylesheet, not the page. */
function artUrl(id: AssetId): string | null {
  const path = resolveAssetUrl(ASSET_MANIFEST[id]);
  return path === null ? null : new URL(path, document.baseURI).href;
}

interface ButtonParts {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
}

/** Button = ui.button frame cell (hover frame when primary) + optional ui.icons16 icon + text label. */
function makeButton(id: string, icon: number | null, primary: boolean): ButtonParts {
  const button = el('button', 'cycle-confirm-btn');
  button.type = 'button';
  button.id = id;
  if (primary) button.classList.add('cycle-confirm-btn--primary');
  const frame = el('span', 'cycle-confirm-btn-frame');
  if (icon !== null) {
    const glyph = el('span', 'cycle-confirm-btn-icon');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.style.setProperty('--icon', String(icon));
    frame.appendChild(glyph);
  }
  const label = el('span', 'cycle-confirm-btn-label');
  button.append(frame, label);
  return { button, label };
}

interface ListParts {
  section: HTMLElement;
  list: HTMLUListElement;
  key: string;
}

function makeList(heading: string, id: string): ListParts {
  const section = el('section', 'cycle-confirm-list-block');
  section.id = id;
  const title = el('h3', 'cycle-confirm-list-title', heading);
  const list = el('ul', 'cycle-confirm-list');
  section.append(title, list);
  return { section, list, key: '' };
}

/** Rebuilds the list items only when the lines changed. */
function setList(parts: ListParts, lines: readonly string[]): void {
  const key = lines.join('\n');
  if (parts.key === key) return;
  parts.key = key;
  parts.list.textContent = '';
  for (const line of lines) parts.list.appendChild(el('li', undefined, line));
}

export function createCycleConfirm(root: HTMLElement, deps: CycleConfirmDeps): CycleConfirmHandle {
  // ---- DOM skeleton (built once) ----
  const overlay = el('div', 'cycle-confirm');
  overlay.id = 'cycle-confirm';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'cycle-confirm-title');
  overlay.hidden = true;
  const panelUrl = artUrl('ui.panel');
  if (panelUrl !== null) overlay.style.setProperty('--cycle-panel', `url("${panelUrl}")`);
  const buttonUrl = artUrl('ui.button');
  if (buttonUrl !== null) overlay.style.setProperty('--cycle-button', `url("${buttonUrl}")`);
  const iconsUrl = artUrl('ui.icons16');
  if (iconsUrl !== null) overlay.style.setProperty('--cycle-icons', `url("${iconsUrl}")`);

  const panel = el('div', 'cycle-confirm-panel');
  const title = el('h2', 'cycle-confirm-title');
  title.id = 'cycle-confirm-title';
  // Gain line is the polite live region: the new Echo total is announced when the dialog opens.
  const gain = el('p', 'cycle-confirm-gain');
  gain.setAttribute('aria-live', 'polite');
  const hint = el('p', 'cycle-confirm-hint');
  const lists = el('div', 'cycle-confirm-lists');
  const kept = makeList(PRESTIGE_TEXT.keptTitle, 'cycle-confirm-kept');
  const reset = makeList(PRESTIGE_TEXT.resetTitle, 'cycle-confirm-reset');
  lists.append(kept.section, reset.section);
  const buttons = el('div', 'cycle-confirm-buttons');
  const beginParts = makeButton('cycle-confirm-begin', BEGIN_ICON, true);
  const cancelParts = makeButton('cycle-confirm-cancel', null, false);
  cancelParts.label.textContent = PRESTIGE_TEXT.cancel;
  buttons.append(beginParts.button, cancelParts.button);
  panel.append(title, gain, hint, lists, buttons);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  // ---- state ----
  let shown = false;
  let destroyed = false;
  let pending: (() => void) | null = null;
  let returnFocus: HTMLElement | null = null;
  let disposeFocusTrap: (() => void) | null = null;

  function render(model: CycleConfirmModel): void {
    setText(title, model.title);
    setText(gain, model.gainLine);
    setHidden(hint, model.thresholdHint === null);
    setText(hint, model.thresholdHint ?? '');
    setList(kept, model.kept);
    setList(reset, model.reset);
    setText(beginParts.label, model.confirmLabel);
  }

  /** Esc via the modal stack (or any stack close): the dialog closes, the entry below stays. */
  const onModalClose = (): void => {
    if (!destroyed) close();
  };

  const onBegin = (): void => {
    const confirm = pending;
    if (confirm === null) return;
    close();
    confirm();
  };
  const onCancel = (): void => {
    close();
  };
  beginParts.button.addEventListener('click', onBegin);
  cancelParts.button.addEventListener('click', onCancel);

  function open(preview: CyclePreview, onConfirm: () => void): void {
    if (destroyed) return;
    pending = onConfirm;
    render(buildCycleConfirm(preview, resourceShort('xf')));
    if (!shown) {
      shown = true;
      const active = document.activeElement;
      returnFocus = active instanceof HTMLElement && !overlay.contains(active) ? active : null;
      overlay.hidden = false;
      if (disposeFocusTrap !== null) disposeFocusTrap();
      disposeFocusTrap = trapFocus(overlay);
    }
    // push moves an open entry to the top and replaces its close fn.
    deps.modals.push(MODAL_ID, onModalClose);
    beginParts.button.focus();
  }

  function close(): void {
    if (!shown) return;
    shown = false;
    pending = null;
    if (disposeFocusTrap !== null) {
      disposeFocusTrap();
      disposeFocusTrap = null;
    }
    deps.modals.remove(MODAL_ID);
    const active = document.activeElement;
    if (active instanceof HTMLElement && overlay.contains(active)) active.blur();
    overlay.hidden = true;
    const back = returnFocus;
    returnFocus = null;
    if (back !== null && back.isConnected) back.focus();
  }

  function destroy(): void {
    if (destroyed) return;
    close();
    destroyed = true;
    beginParts.button.removeEventListener('click', onBegin);
    cancelParts.button.removeEventListener('click', onCancel);
    overlay.remove();
  }

  return { open, close, destroy };
}
