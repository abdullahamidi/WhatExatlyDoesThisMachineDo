import './settingsPanel.css';
import { SETTINGS_LABELS } from '../../data/settings';
import type { SettingsState } from '../../data/types';
import type { FullscreenControl } from '../fullscreen';
import {
  fullscreenRow,
  hotkeyHelpLines,
  radioPatch,
  settingsViewModel,
  toggleAction,
  volumePatch,
  volumeText,
} from './settingsView';
import type { RadioControl, SettingsControl, SettingsSection, ToggleControl, VolumeControl } from './settingsView';

// SETTINGS tab (DOM, WP12 T7). Built once from deps.get(); refresh() rewrites only the values that changed,
// so the DOM is never rebuilt and focus stays where it is. Talks to the game only through SettingsPanelDeps.

export interface SettingsPanelDeps {
  get(): Readonly<SettingsState>;
  update(patch: Partial<SettingsState>): void;
  subscribe(fn: () => void): () => void;
  /** Session-only FULLSCREEN row in DISPLAY. Shown only when supported(). */
  fullscreen?: Pick<FullscreenControl, 'supported' | 'isOn' | 'toggle' | 'onChange'>;
  /** CONFIRM NEW CYCLE row visible only when prestige matters; omitted = always shown. */
  cycleRelevant?: () => boolean;
}

export interface SettingsPanelHandle {
  refresh(): void;
  destroy(): void;
}

type Sync = (control: SettingsControl) => void;

const SECTION_TITLE: Readonly<Record<SettingsSection, string>> = {
  audio: SETTINGS_LABELS.sectionAudio,
  display: SETTINGS_LABELS.sectionDisplay,
  access: SETTINGS_LABELS.sectionAccess,
};

interface ElementOptions {
  id?: string;
  className?: string;
  text?: string;
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

function buildVolume(c: VolumeControl, deps: SettingsPanelDeps): { el: HTMLElement; sync: Sync } {
  const id = `sys-set-${c.id}`;
  const row = createElement('div', { className: 'settings-row' });
  const label = createElement('label', { className: 'settings-label', text: c.label });
  label.htmlFor = id;
  const input = createElement('input', { id });
  input.type = 'range';
  input.min = String(c.min);
  input.max = String(c.max);
  input.step = String(c.step);
  input.value = String(c.value);
  input.setAttribute('aria-valuetext', c.valueText);
  const text = createElement('span', { className: 'settings-value', text: c.valueText });
  // `input` is the live readout only; the stored value changes on `change` (commit).
  input.addEventListener('input', () => {
    const next = volumeText(Number(input.value));
    text.textContent = next;
    input.setAttribute('aria-valuetext', next);
  });
  input.addEventListener('change', () => deps.update(volumePatch(c.id, Number(input.value))));
  row.append(label, input, text);

  const sync: Sync = (next) => {
    if (next.kind !== 'volume') return;
    if (input.value !== String(next.value)) input.value = String(next.value);
    if (text.textContent !== next.valueText) text.textContent = next.valueText;
    if (input.getAttribute('aria-valuetext') !== next.valueText) input.setAttribute('aria-valuetext', next.valueText);
  };
  return { el: row, sync };
}

function buildRadio(c: RadioControl, deps: SettingsPanelDeps): { el: HTMLElement; sync: Sync } {
  const labelId = `sys-set-${c.id}-label`;
  const group = createElement('div', { className: 'settings-row settings-radio' });
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', labelId);
  const label = createElement('span', { id: labelId, className: 'settings-label', text: c.label });
  const choices = createElement('div', { className: 'settings-choices' });
  const inputs = new Map<string, HTMLInputElement>();
  for (const option of c.options) {
    const choice = createElement('label', { className: 'settings-choice' });
    const input = createElement('input');
    input.type = 'radio';
    input.name = `sys-set-${c.id}`;
    input.value = option.value;
    input.checked = option.checked;
    input.addEventListener('change', () => {
      const patch = radioPatch(c.id, input.value);
      if (patch !== null) deps.update(patch);
    });
    choice.append(input, createElement('span', { text: option.label }));
    choices.appendChild(choice);
    inputs.set(option.value, input);
  }
  group.append(label, choices);

  const sync: Sync = (next) => {
    if (next.kind !== 'radio') return;
    for (const option of next.options) {
      const input = inputs.get(option.value);
      if (input !== undefined && input.checked !== option.checked) input.checked = option.checked;
    }
  };
  return { el: group, sync };
}

function buildToggle(c: ToggleControl, deps: SettingsPanelDeps): { el: HTMLElement; sync: Sync } {
  const row = createElement('div', { className: 'settings-row' });
  row.hidden = c.hidden === true;
  const button = createElement('button', { id: `sys-set-${c.id}`, className: 'settings-toggle' });
  button.type = 'button';
  button.setAttribute('aria-pressed', c.pressed ? 'true' : 'false');
  button.disabled = c.disabled;
  const state = createElement('span', { className: 'settings-state', text: c.stateText });
  button.append(createElement('span', { text: c.label }), ' ', state);
  button.addEventListener('click', () => {
    if (button.disabled) return;
    deps.update(toggleAction(c.id, deps.get()));
  });
  row.appendChild(button);

  const sync: Sync = (next) => {
    if (next.kind !== 'toggle') return;
    const hidden = next.hidden === true;
    if (row.hidden !== hidden) row.hidden = hidden;
    const pressed = next.pressed ? 'true' : 'false';
    if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    if (button.disabled !== next.disabled) button.disabled = next.disabled;
    if (state.textContent !== next.stateText) state.textContent = next.stateText;
  };
  return { el: row, sync };
}

interface FullscreenView {
  el: HTMLElement;
  sync(): void;
}

/** FULLSCREEN row: a toggle button (state from the control, not optimistic) and the key hint beside it. */
function buildFullscreen(fs: Pick<FullscreenControl, 'isOn' | 'toggle'>): FullscreenView {
  const initial = fullscreenRow(fs.isOn());
  const row = createElement('div', { className: 'settings-row settings-fullscreen' });
  const button = createElement('button', { id: 'sys-set-fullscreen', className: 'settings-toggle' });
  button.type = 'button';
  button.setAttribute('aria-pressed', initial.pressed ? 'true' : 'false');
  const state = createElement('span', { className: 'settings-state', text: initial.stateText });
  button.append(createElement('span', { text: initial.label }), ' ', state);
  button.addEventListener('click', () => fs.toggle());
  const hint = createElement('span', { className: 'settings-hint', text: initial.hint });
  row.append(button, hint);

  const sync = (): void => {
    const next = fullscreenRow(fs.isOn());
    const pressed = next.pressed ? 'true' : 'false';
    if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    if (state.textContent !== next.stateText) state.textContent = next.stateText;
  };
  return { el: row, sync };
}

function buildControl(control: SettingsControl, deps: SettingsPanelDeps): { el: HTMLElement; sync: Sync } {
  switch (control.kind) {
    case 'volume':
      return buildVolume(control, deps);
    case 'radio':
      return buildRadio(control, deps);
    case 'toggle':
      return buildToggle(control, deps);
  }
}

export function createSettingsPanel(host: HTMLElement, deps: SettingsPanelDeps): SettingsPanelHandle {
  const root = createElement('div', { id: 'sys-settings', className: 'settings-panel' });
  const syncers = new Map<string, Sync>();
  const groups = new Map<SettingsSection, HTMLElement>();

  let group: HTMLElement | null = null;
  let lastSection: SettingsSection | null = null;
  for (const control of settingsViewModel(deps.get(), { cycleRelevant: deps.cycleRelevant?.() ?? true })) {
    if (control.section !== lastSection) {
      lastSection = control.section;
      const headingId = `sys-set-h-${control.section}`;
      group = createElement('section', { className: 'settings-section' });
      group.setAttribute('aria-labelledby', headingId);
      group.appendChild(createElement('h3', { id: headingId, className: 'settings-heading', text: SECTION_TITLE[control.section] }));
      groups.set(control.section, group);
      root.appendChild(group);
    }
    const built = buildControl(control, deps);
    group?.appendChild(built.el);
    syncers.set(control.id, built.sync);
  }

  // FULLSCREEN row goes last in DISPLAY, and only when the runtime supports it (Electron host or browser API).
  const fs = deps.fullscreen;
  const fullscreen: FullscreenView | null = fs !== undefined && fs.supported() ? buildFullscreen(fs) : null;
  let unsubscribeFullscreen: () => void = () => undefined;
  if (fs !== undefined && fullscreen !== null) {
    groups.get('display')?.appendChild(fullscreen.el);
    unsubscribeFullscreen = fs.onChange(() => fullscreen.sync());
  }

  const help = createElement('section', { className: 'settings-section settings-help' });
  help.setAttribute('aria-labelledby', 'sys-set-h-keys');
  help.appendChild(createElement('h3', { id: 'sys-set-h-keys', className: 'settings-heading', text: SETTINGS_LABELS.sectionHotkeys }));
  const keys = createElement('ul', { className: 'settings-keys' });
  for (const line of hotkeyHelpLines()) keys.appendChild(createElement('li', { text: line }));
  help.appendChild(keys);
  root.appendChild(help);
  host.appendChild(root);

  let destroyed = false;

  function refresh(): void {
    if (destroyed) return;
    for (const control of settingsViewModel(deps.get(), { cycleRelevant: deps.cycleRelevant?.() ?? true })) {
      syncers.get(control.id)?.(control);
    }
    fullscreen?.sync();
  }

  const unsubscribe = deps.subscribe(refresh);

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    unsubscribeFullscreen();
    syncers.clear();
    root.remove();
  }

  return { refresh, destroy };
}
