import './finale.css';
import { ASSET_MANIFEST, resolveAssetUrl } from '../assets/manifest';
import type { AssetId } from '../assets/assetIds';
import { FINALE_CHOICE, FINALE_HUD, FINALE_REVEAL, REVEALED } from '../data/finale';
import type { NewCycleHook } from '../game/newCycle';
import { trapFocus } from './hotkeys';
import type { FinaleOverlayModel } from './finaleView';
import type { ModalStack } from './modalStack';

// Finale overlay (WP13 T5, DOM). Built once; render(model) shows / updates it, render(null) hides it. The model comes
// from buildFinaleOverlay (finaleView.ts). Esc goes through the shared modal stack: sequence -> onSkip, choice -> nothing.
// Hidden while shown: #ui-root gets .finale-active (HUD + toasts fade), the HUD panels get `inert`, the tech tree and
// system menu are closed. Everything is undone on render(null) and destroy().

export interface FinaleOverlayDeps {
  modals: ModalStack;
  newCycle: NewCycleHook;
  closeDialogs(): void;
  onSkip(): void;
  onKeep(): void;
  onNewCycle(): void;
}

export interface FinaleOverlayHandle {
  render(model: FinaleOverlayModel | null): void;
  destroy(): void;
}

const MODAL_ID = 'finale';
const HUD_IDS: readonly string[] = ['hud-panel', 'hud-buttons'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}

/** Button = ui.button frame cell (hover frame when primary) + ui.icons16 icon + text label. */
function makeButton(id: string, label: string, icon: number, primary: boolean): HTMLButtonElement {
  const button = el('button', 'finale-btn');
  button.type = 'button';
  button.id = id;
  if (primary) button.classList.add('finale-btn--primary');
  const frame = el('span', 'finale-btn-frame');
  const glyph = el('span', 'finale-btn-icon');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.style.setProperty('--icon', String(icon));
  frame.appendChild(glyph);
  button.append(frame, el('span', 'finale-btn-label', label));
  return button;
}

function artUrl(id: AssetId): string | null {
  return resolveAssetUrl(ASSET_MANIFEST[id]);
}

export function createFinaleOverlay(root: HTMLElement, deps: FinaleOverlayDeps): FinaleOverlayHandle {
  // ---- DOM skeleton (built once) ----
  const overlay = el('div', 'finale-overlay');
  overlay.id = 'finale-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', REVEALED.plaque);
  overlay.hidden = true;
  const plateUrl = artUrl('ui.nameplate');
  if (plateUrl !== null) overlay.style.setProperty('--finale-plate', `url(${plateUrl})`);
  const panelUrl = artUrl('ui.panel');
  if (panelUrl !== null) overlay.style.setProperty('--finale-panel', `url(${panelUrl})`);
  const buttonUrl = artUrl('ui.button');
  if (buttonUrl !== null) overlay.style.setProperty('--finale-button', `url(${buttonUrl})`);
  const iconsUrl = artUrl('ui.icons16');
  if (iconsUrl !== null) overlay.style.setProperty('--finale-icons', `url(${iconsUrl})`);

  const column = el('div', 'finale-column');

  // Name plate: ui.nameplate at nameplateScale (pixel-exact integer scale).
  const plate = el('div', 'finale-plate');
  plate.setAttribute('aria-hidden', 'true');
  const plateEntry = ASSET_MANIFEST['ui.nameplate'];
  plate.style.width = `${plateEntry.width * FINALE_REVEAL.nameplateScale}px`;
  plate.style.height = `${plateEntry.height * FINALE_REVEAL.nameplateScale}px`;

  // Terminal panel: typed lines. Each line element is created on demand.
  const panel = el('div', 'finale-panel');
  panel.style.maxWidth = `${FINALE_REVEAL.panelMaxWidthPx}px`;
  // Completed lines are mirrored to a polite live region (screen readers).
  const live = el('div', 'finale-sr');
  live.setAttribute('aria-live', 'polite');
  panel.appendChild(live);

  const lineEls: HTMLParagraphElement[] = [];
  const writtenLines: string[] = [];
  const lineNode = (index: number): HTMLParagraphElement => {
    const existing = lineEls[index];
    if (existing !== undefined) return existing;
    const p = el('p', 'finale-line');
    lineEls[index] = p;
    panel.insertBefore(p, live);
    return p;
  };

  // Buttons row: KEEP IT RUNNING / BEGIN A NEW CYCLE (+ reason line when blocked).
  const buttons = el('div', 'finale-buttons');
  const keep = makeButton('finale-keep', FINALE_CHOICE.keep.label, FINALE_CHOICE.keep.icon, true);
  const cycle = makeButton('finale-cycle', FINALE_CHOICE.cycle.label, FINALE_CHOICE.cycle.icon, false);
  const cycleReason = el('div', 'finale-reason');
  cycleReason.id = 'finale-cycle-reason';
  buttons.append(keep, cycle, cycleReason);
  column.append(plate, panel, buttons);

  const skip = el('button', 'finale-skip', FINALE_CHOICE.skipLabel);
  skip.type = 'button';
  skip.id = 'finale-skip';
  overlay.append(column, skip);
  root.appendChild(overlay);
  root.style.setProperty('--finale-fade-ms', `${FINALE_HUD.fadeMs}ms`);

  // ---- state ----
  let shown = false;
  let destroyed = false;
  let skippable = false;
  let cycleEnabled = false;
  let focusedFor: HTMLButtonElement | null = null;
  let disposeFocusTrap: (() => void) | null = null;
  let mirrored = 0;
  let plateOpacity = '';
  let cycleDisabled: string | null = null;
  let cycleAria: string | null = null;
  let reasonText = '';

  // Esc via the modal stack: sequence -> skip. The stack drops this entry after close() returns, so the overlay
  // always puts it back while shown (choice: Esc does nothing).
  const onModalClose = (): void => {
    if (destroyed || !shown) return;
    if (skippable) deps.onSkip();
    if (shown && !destroyed) deps.modals.push(MODAL_ID, onModalClose);
  };

  const onKeep = (): void => {
    deps.onKeep();
  };
  const onSkip = (): void => {
    deps.onSkip();
  };
  const onCycle = (): void => {
    if (!cycleEnabled) return;
    if (deps.newCycle.blockedReason() !== null) return;
    deps.onNewCycle();
  };
  keep.addEventListener('click', onKeep);
  skip.addEventListener('click', onSkip);
  cycle.addEventListener('click', onCycle);

  const setHudInert = (inert: boolean): void => {
    for (const id of HUD_IDS) {
      const node = root.querySelector<HTMLElement>(`#${id}`);
      if (node === null) continue;
      if (inert) node.setAttribute('inert', '');
      else node.removeAttribute('inert');
    }
  };

  const resetCaches = (): void => {
    writtenLines.length = 0;
    for (const node of lineEls) node.textContent = '';
    mirrored = 0;
    live.textContent = '';
    plateOpacity = '';
    cycleDisabled = null;
    cycleAria = null;
    reasonText = '';
    cycle.classList.remove('is-disabled');
    cycle.removeAttribute('aria-disabled');
    cycle.removeAttribute('aria-description');
    cycleReason.textContent = '';
  };

  function show(): void {
    if (shown) return;
    shown = true;
    deps.closeDialogs();
    root.classList.add('finale-active');
    setHudInert(true);
    overlay.hidden = false;
  }

  function hide(): void {
    if (!shown) return;
    shown = false;
    focusedFor = null;
    if (disposeFocusTrap !== null) {
      disposeFocusTrap();
      disposeFocusTrap = null;
    }
    deps.modals.remove(MODAL_ID);
    root.classList.remove('finale-active');
    setHudInert(false);
    const active = document.activeElement;
    if (active instanceof HTMLElement && overlay.contains(active)) active.blur();
    overlay.hidden = true;
    resetCaches();
  }

  function renderLines(model: FinaleOverlayModel): void {
    model.lines.forEach((line, i) => {
      const text = line.text.slice(0, line.shown);
      if (writtenLines[i] === text) return;
      writtenLines[i] = text;
      lineNode(i).textContent = text;
    });
    // Mirror each line once it is complete, in order.
    let next = model.lines[mirrored];
    while (next !== undefined && next.shown >= next.text.length) {
      live.appendChild(el('p', undefined, next.text));
      mirrored++;
      next = model.lines[mirrored];
    }
  }

  function renderButtons(model: FinaleOverlayModel): void {
    setHidden(buttons, !model.buttons);
    cycleEnabled = model.cycleEnabled;
    const disabled = model.cycleEnabled ? 'false' : 'true';
    if (cycleDisabled !== disabled) {
      cycleDisabled = disabled;
      cycle.setAttribute('aria-disabled', disabled);
      cycle.classList.toggle('is-disabled', !model.cycleEnabled);
    }
    const reason = model.cycleReason ?? '';
    if (reasonText !== reason) {
      reasonText = reason;
      cycleReason.textContent = reason;
    }
    setHidden(cycleReason, model.cycleReason === null);
    const description = model.cycleEnabled ? null : model.cycleReason;
    if (cycleAria !== description) {
      cycleAria = description;
      if (description === null) cycle.removeAttribute('aria-description');
      else cycle.setAttribute('aria-description', description);
    }
  }

  function updateFocus(model: FinaleOverlayModel): void {
    if (model.buttons) {
      if (disposeFocusTrap === null) disposeFocusTrap = trapFocus(overlay);
      if (focusedFor !== keep) {
        focusedFor = keep;
        keep.focus();
      }
    } else if (model.skipVisible && focusedFor !== skip) {
      focusedFor = skip;
      skip.focus();
    }
  }

  function render(model: FinaleOverlayModel | null): void {
    if (destroyed) return;
    if (model === null) {
      hide();
      return;
    }
    show();
    if (!deps.modals.has(MODAL_ID)) deps.modals.push(MODAL_ID, onModalClose);
    skippable = model.skipVisible;

    const opacity = String(model.nameplateAlpha);
    if (plateOpacity !== opacity) {
      plateOpacity = opacity;
      plate.style.opacity = opacity;
    }
    setHidden(skip, !model.skipVisible);

    renderLines(model);
    renderButtons(model);
    updateFocus(model);
  }

  function destroy(): void {
    if (destroyed) return;
    hide();
    destroyed = true;
    keep.removeEventListener('click', onKeep);
    skip.removeEventListener('click', onSkip);
    cycle.removeEventListener('click', onCycle);
    root.style.removeProperty('--finale-fade-ms');
    overlay.remove();
  }

  return { render, destroy };
}
