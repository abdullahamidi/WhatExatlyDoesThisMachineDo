import './hud.css';
import { RESOURCES } from '../data/resources';
import type { ResourceId } from '../data/types';
import type { GameContext } from '../game/context';
import { HUD_ROW_IDS } from './hudView';
import type { HudView, HudResourceRow } from './hudView';

export interface Hud { render(view: HudView): void; destroy(): void }

interface Readout { me: string; perClick: string; perSecond: string; plaque: string }

/** DOM refs and last-written values of one non-ME resource row. */
interface ResourceRowRefs {
  row: HTMLElement;
  value: HTMLElement;
  written: { value: string; perSecond: string; visible: boolean };
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

function createRow(label: string, valueId: string, initial: string): { row: HTMLElement; value: HTMLElement } {
  const row = createElement('div', { className: 'hud-row' });
  row.appendChild(createElement('span', { className: 'hud-label', text: label }));
  const value = createElement('span', { id: valueId, className: 'hud-value', text: initial });
  row.appendChild(value);
  return { row, value };
}

export function createHud(root: HTMLElement, commands: GameContext['commands']): Hud {
  const initial: Readout = { me: '0', perClick: '1', perSecond: '0/s', plaque: 'PRIMARY FUNCTION: UNKNOWN' };

  const panel = createElement('div', { id: 'hud-panel', className: 'hud-panel' });
  panel.appendChild(createElement('div', { className: 'hud-title', text: 'MECHANICAL ENERGY' }));
  const me = createRow('ME', 'hud-me', initial.me);
  const perClick = createRow('ME/CLICK', 'hud-per-click', initial.perClick);
  const perSecond = createRow('ME/S', 'hud-per-second', initial.perSecond);
  panel.appendChild(me.row);
  panel.appendChild(perClick.row);
  panel.appendChild(perSecond.row);

  // One row per non-ME resource, hidden until the resource is used (see HudView.rows).
  const resourceRows = new Map<ResourceId, ResourceRowRefs>();
  for (const id of HUD_ROW_IDS) {
    const built = createRow(RESOURCES[id].short, `hud-res-${id}`, '0');
    built.row.style.display = 'none';
    panel.appendChild(built.row);
    resourceRows.set(id, {
      row: built.row,
      value: built.value,
      written: { value: '0', perSecond: '0/s', visible: false },
    });
  }

  // Machine plaque: the current primary function line (see plaqueText in hudView.ts).
  const plaque = createElement('div', { id: 'hud-plaque', className: 'hud-plaque', text: initial.plaque });
  panel.appendChild(plaque);

  const buttons = createElement('div', { id: 'hud-buttons', className: 'hud-buttons' });
  const techButton = createElement('button', { id: 'hud-tech', className: 'hud-btn', text: 'TECH INDEX' });
  techButton.type = 'button';
  techButton.title = 'TECH TREE [T]';
  techButton.setAttribute('aria-keyshortcuts', 'T');
  const refocusButton = createElement('button', { id: 'hud-refocus', className: 'hud-btn', text: 'REFOCUS' });
  refocusButton.type = 'button';
  refocusButton.title = 'Re-centre the camera on the machine';
  const systemButton = createElement('button', { id: 'hud-system', className: 'hud-btn', text: 'SYSTEM' });
  systemButton.type = 'button';
  systemButton.title = 'SYSTEM [ESC]';
  systemButton.setAttribute('aria-keyshortcuts', 'Escape');
  buttons.appendChild(techButton);
  buttons.appendChild(refocusButton);
  buttons.appendChild(systemButton);

  root.appendChild(panel);
  root.appendChild(buttons);

  const written: Readout = { ...initial };

  const onTech = (): void => commands.openTechTree.emit();
  const onRefocus = (): void => commands.refocus.emit();
  const onSystem = (): void => commands.openSystemMenu.emit();
  techButton.addEventListener('click', onTech);
  refocusButton.addEventListener('click', onRefocus);
  systemButton.addEventListener('click', onSystem);

  const setText = (el: HTMLElement, key: keyof Readout, text: string): void => {
    if (written[key] === text) return;
    written[key] = text;
    el.textContent = text;
  };

  const renderResourceRow = (rowView: HudResourceRow): void => {
    const refs = resourceRows.get(rowView.id);
    if (refs === undefined) return;
    const written = refs.written;
    if (written.value !== rowView.value) {
      written.value = rowView.value;
      refs.value.textContent = rowView.value;
    }
    if (written.perSecond !== rowView.perSecond) {
      written.perSecond = rowView.perSecond;
      refs.row.title = rowView.perSecond;
    }
    if (written.visible !== rowView.visible) {
      written.visible = rowView.visible;
      refs.row.style.display = rowView.visible ? '' : 'none';
    }
  };

  return {
    render(view: HudView): void {
      setText(me.value, 'me', view.me);
      setText(perClick.value, 'perClick', view.perClick);
      setText(perSecond.value, 'perSecond', view.perSecond);
      for (const rowView of view.rows) renderResourceRow(rowView);
      setText(plaque, 'plaque', view.plaque);
    },
    destroy(): void {
      techButton.removeEventListener('click', onTech);
      refocusButton.removeEventListener('click', onRefocus);
      systemButton.removeEventListener('click', onSystem);
      panel.remove();
      buttons.remove();
    },
  };
}
