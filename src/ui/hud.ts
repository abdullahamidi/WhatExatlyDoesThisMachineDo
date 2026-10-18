import './hud.css';
import type { GameContext } from '../game/context';
import type { HudView } from './hudView';

export interface Hud { render(view: HudView): void; destroy(): void }

interface Readout { me: string; perClick: string; perSecond: string }

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
  const initial: Readout = { me: '0', perClick: '1', perSecond: '0/s' };

  const panel = createElement('div', { id: 'hud-panel', className: 'hud-panel' });
  panel.appendChild(createElement('div', { className: 'hud-title', text: 'MECHANICAL ENERGY' }));
  const me = createRow('ME', 'hud-me', initial.me);
  const perClick = createRow('ME/CLICK', 'hud-per-click', initial.perClick);
  const perSecond = createRow('ME/S', 'hud-per-second', initial.perSecond);
  panel.appendChild(me.row);
  panel.appendChild(perClick.row);
  panel.appendChild(perSecond.row);

  const buttons = createElement('div', { id: 'hud-buttons', className: 'hud-buttons' });
  const techButton = createElement('button', { id: 'hud-tech', className: 'hud-btn', text: 'TECH INDEX' });
  techButton.type = 'button';
  techButton.title = 'Open the technology index';
  const refocusButton = createElement('button', { id: 'hud-refocus', className: 'hud-btn', text: 'REFOCUS' });
  refocusButton.type = 'button';
  refocusButton.title = 'Re-centre the camera on the machine';
  const systemButton = createElement('button', { id: 'hud-system', className: 'hud-btn', text: 'SYSTEM' });
  systemButton.type = 'button';
  systemButton.title = 'Open the system menu';
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

  return {
    render(view: HudView): void {
      setText(me.value, 'me', view.me);
      setText(perClick.value, 'perClick', view.perClick);
      setText(perSecond.value, 'perSecond', view.perSecond);
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
