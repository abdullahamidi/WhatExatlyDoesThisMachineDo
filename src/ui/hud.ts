import './hud.css';
import { HUD_TEXT } from '../data/hud';
import type { ResourceId } from '../data/types';
import type { GameContext } from '../game/context';
import { HUD_ROW_IDS } from './hudView';
import type { HudResourceRow, HudView } from './hudView';
import { resourceShort } from './revealRules';

export interface Hud { render(view: HudView): void; onViewMachine(fn: () => void): () => void; destroy(): void }

// Initial placeholder texts; the first render replaces them (WorldScene renders on create).
const INITIAL_CLICK = '+1 ME';
const INITIAL_PLAQUE = 'PRIMARY FUNCTION: UNKNOWN';

/** Write cache: `apply` runs only when the value differs from the last one applied. No DOM write otherwise. */
function cachedWrite<T>(initial: T, apply: (value: T) => void): (value: T) => void {
  let last = initial;
  return (value: T): void => {
    if (value === last) return;
    last = value;
    apply(value);
  };
}

/** DOM row of one resource plus its view applier (write-cached). */
interface ResourceRowRefs {
  row: HTMLElement;
  apply(view: HudResourceRow): void;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { id?: string; className?: string; text?: string } = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (options.id !== undefined) el.id = options.id;
  if (options.className !== undefined) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  return el;
}

/**
 * `div.hud-row.hud-res-row[data-res]` with label, value, rate and feeds spans.
 * ME starts visible and as frontier (era I); the other resources start hidden.
 */
function createResourceRow(id: ResourceId): ResourceRowRefs {
  const isMe = id === 'me';
  const label = resourceShort(id);
  const row = createElement('div', { className: isMe ? 'hud-row hud-res-row hud-row--frontier' : 'hud-row hud-res-row' });
  row.setAttribute('data-res', id);
  const labelEl = createElement('span', { className: 'hud-label', text: label });
  const valueEl = createElement('span', { id: isMe ? 'hud-me' : `hud-res-${id}`, className: 'hud-value', text: '0' });
  const rateEl = createElement('span', { id: isMe ? 'hud-per-second' : `hud-rate-${id}`, className: 'hud-rate', text: '0/s' });
  const feedsEl = createElement('span', { id: `hud-feeds-${id}`, className: 'hud-feeds' });
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  row.appendChild(rateEl);
  row.appendChild(feedsEl);
  if (!isMe) row.style.display = 'none';

  const setLabel = cachedWrite<string>(label, (text) => { labelEl.textContent = text; });
  const setValue = cachedWrite<string>('0', (text) => { valueEl.textContent = text; });
  const setRate = cachedWrite<string>('0/s', (text) => {
    rateEl.textContent = text;
    row.title = text;
  });
  const setFeeds = cachedWrite<string>('', (text) => { feedsEl.textContent = text; });
  const setVisible = cachedWrite<boolean>(isMe, (on) => { row.style.display = on ? '' : 'none'; });
  const setFrontier = cachedWrite<boolean>(isMe, (on) => { row.classList.toggle('hud-row--frontier', on); });

  return {
    row,
    apply(view: HudResourceRow): void {
      setLabel(view.label);
      setValue(view.value);
      setRate(view.rate);
      setFeeds(view.feeds ?? '');
      setVisible(view.visible);
      setFrontier(view.frontier);
    },
  };
}

export function createHud(root: HTMLElement, commands: GameContext['commands']): Hud {
  const panel = createElement('div', { id: 'hud-panel', className: 'hud-panel' });
  const titleEl = createElement('div', { id: 'hud-title', className: 'hud-title', text: HUD_TEXT.eraTitles[0] });
  panel.appendChild(titleEl);

  // One row per resource in HUD_ROW_IDS order (ME first). Unused resources stay hidden (see HudView.rows).
  const resourceRows = new Map<ResourceId, ResourceRowRefs>();
  for (const id of HUD_ROW_IDS) {
    const built = createResourceRow(id);
    panel.appendChild(built.row);
    resourceRows.set(id, built);
  }

  // Click line: crank gain, optional sub-line, optional AUTO-CRANK line (hidden until a value is given).
  const clickRow = createElement('div', { className: 'hud-row hud-click' });
  clickRow.appendChild(createElement('span', { className: 'hud-label', text: HUD_TEXT.clickLabel }));
  const clickValue = createElement('span', { id: 'hud-per-click', className: 'hud-value', text: INITIAL_CLICK });
  clickRow.appendChild(clickValue);
  const clickSub = createElement('div', { id: 'hud-per-click-me', className: 'hud-click-sub' });
  clickSub.style.display = 'none';
  const autoEl = createElement('div', { id: 'hud-auto', className: 'hud-auto' });
  autoEl.style.display = 'none';
  // WIND-UP row (WP27 C8) under the click lines, in the AUTO-CRANK look; hidden while there is no wind-up to show.
  const windupEl = createElement('div', { id: 'hud-windup', className: 'hud-auto hud-windup' });
  windupEl.style.display = 'none';
  panel.appendChild(clickRow);
  panel.appendChild(clickSub);
  panel.appendChild(autoEl);
  panel.appendChild(windupEl);

  // Machine plaque: the current primary function line (see plaqueText in hudView.ts).
  const plaque = createElement('div', { id: 'hud-plaque', className: 'hud-plaque', text: INITIAL_PLAQUE });
  panel.appendChild(plaque);

  // Cycle line under the plaque (WP14): hidden in cycle 1, `CYCLE 0043` from cycle 2.
  const cycleEl = createElement('div', { id: 'hud-cycle', className: 'hud-cycle' });
  cycleEl.hidden = true;
  panel.appendChild(cycleEl);

  const buttons = createElement('div', { id: 'hud-buttons', className: 'hud-buttons' });
  const techButton = createElement('button', { id: 'hud-tech', className: 'hud-btn', text: 'TECH INDEX' });
  techButton.type = 'button';
  techButton.title = 'TECH INDEX [T]';
  techButton.setAttribute('aria-keyshortcuts', 'T');
  const refocusButton = createElement('button', { id: 'hud-refocus', className: 'hud-btn', text: 'REFOCUS' });
  refocusButton.type = 'button';
  refocusButton.title = 'Re-center the camera on the machine';
  const systemButton = createElement('button', { id: 'hud-system', className: 'hud-btn', text: 'SYSTEM' });
  systemButton.type = 'button';
  systemButton.title = 'SYSTEM [ESC]';
  systemButton.setAttribute('aria-keyshortcuts', 'Escape');
  // Postgame only (see HudView.viewMachine); the photo mode entry is wired by WorldScene.
  const viewButton = createElement('button', { id: 'hud-view-machine', className: 'hud-btn', text: HUD_TEXT.viewMachine });
  viewButton.type = 'button';
  viewButton.title = HUD_TEXT.viewMachineTitle;
  viewButton.hidden = true;
  buttons.appendChild(techButton);
  buttons.appendChild(refocusButton);
  buttons.appendChild(viewButton);
  buttons.appendChild(systemButton);

  root.appendChild(panel);
  root.appendChild(buttons);

  const onTech = (): void => commands.openTechTree.emit();
  const onRefocus = (): void => commands.refocus.emit();
  const onSystem = (): void => commands.openSystemMenu.emit();
  // Own listener set: the same fn can subscribe twice and each unsubscribe is independent.
  const viewListeners = new Set<() => void>();
  const onView = (): void => {
    for (const fn of Array.from(viewListeners)) fn();
  };
  techButton.addEventListener('click', onTech);
  refocusButton.addEventListener('click', onRefocus);
  viewButton.addEventListener('click', onView);
  systemButton.addEventListener('click', onSystem);

  // Write caches: each field touches the DOM only when its value changes.
  const setTitle = cachedWrite<string>(HUD_TEXT.eraTitles[0], (text) => { titleEl.textContent = text; });
  const setPrimary = cachedWrite<string>(INITIAL_CLICK, (text) => { clickValue.textContent = text; });
  // WP25 C4: the click row's tooltip explains the worth suffix; empty removes the tooltip.
  const setClickTitle = cachedWrite<string | null>(null, (t) => { clickRow.title = t ?? ''; });
  const setSecondary = cachedWrite<string | null>(null, (text) => {
    clickSub.textContent = text ?? '';
    clickSub.style.display = text === null ? 'none' : '';
  });
  const setAuto = cachedWrite<string | null>(null, (text) => {
    autoEl.textContent = text ?? '';
    autoEl.style.display = text === null ? 'none' : '';
  });
  // WP27 C8: the WIND-UP row is cached on its text (the view object is new on every build), and its tooltip apart.
  const setWindup = cachedWrite<string | null>(null, (text) => {
    windupEl.textContent = text ?? '';
    windupEl.style.display = text === null ? 'none' : '';
  });
  const setWindupTitle = cachedWrite<string>('', (t) => { windupEl.title = t; });
  const setPlaque = cachedWrite<string>(INITIAL_PLAQUE, (text) => { plaque.textContent = text; });
  const setCycle = cachedWrite<string>('', (text) => {
    cycleEl.textContent = text;
    cycleEl.hidden = text === '';
  });
  const setViewMachine = cachedWrite<boolean>(false, (on) => { viewButton.hidden = !on; });

  return {
    render(view: HudView): void {
      setTitle(view.title);
      for (const rowView of view.rows) resourceRows.get(rowView.id)?.apply(rowView);
      setPrimary(view.click.primary);
      setClickTitle(view.click.title);
      setSecondary(view.click.secondary);
      setAuto(view.autoCrank);
      setWindup(view.windup?.text ?? null);
      setWindupTitle(view.windup?.title ?? '');
      setPlaque(view.plaque);
      setCycle(view.cycle ?? '');
      setViewMachine(view.viewMachine);
    },
    onViewMachine(fn: () => void): () => void {
      // Fresh closure per subscription, so one fn can be registered twice and removed independently.
      const wrapped = (): void => fn();
      viewListeners.add(wrapped);
      return () => { viewListeners.delete(wrapped); };
    },
    destroy(): void {
      techButton.removeEventListener('click', onTech);
      refocusButton.removeEventListener('click', onRefocus);
      viewButton.removeEventListener('click', onView);
      systemButton.removeEventListener('click', onSystem);
      viewListeners.clear();
      panel.remove();
      buttons.remove();
    },
  };
}
