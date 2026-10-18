import './dataPanel.css';
import { DATA_LABELS } from '../../data/notifications';
import { SYSTEM_MENU_CONFIG } from '../../data/systemMenu';
import type { ModalStack } from '../modalStack';
import type { ResetState } from '../systemMenuModel';
import { canImport, copyStatusLabel, importLabel, reduceImport, trimImportText } from './dataModel';

// DATA tab (WP12 T8). DOM only: no Phaser, no GameSession import. Text is always written with textContent.
// EXPORT fills a read-only textarea, selects it and tries the clipboard (best effort).
// IMPORT is two-step: the first press arms (5 s window, like RESET), the second press calls deps.importString.
// While armed, the import pushes a modal-stack entry so Esc cancels the arm before it closes the menu.
// Storage is only touched through deps; a successful import ends in deps.reload().

export interface DataPanelDeps {
  exportString(): string;
  importString(text: string): { ok: true } | { ok: false; error: string };
  reload(): void;
  modals: ModalStack;
  copyText?(text: string): Promise<boolean>;
}

export interface DataPanelHandle {
  refresh(): void;
  /** Drops an armed import (and its modal-stack entry). Called by the system menu on close and on tab change. */
  hide(): void;
  destroy(): void;
}

const IMPORT_STACK_ID = 'data-import';

interface ElementOptions {
  id?: string;
  className?: string;
  text?: string;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.id !== undefined) node.id = options.id;
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}

// Default clipboard write: resolves false when the API is missing or refuses (never throws).
async function clipboardWrite(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function createDataPanel(host: HTMLElement, deps: DataPanelDeps): DataPanelHandle {
  const { modals } = deps;

  // ---- EXPORT ----
  const exportSection = createElement('section', { className: 'data-section' });
  const exportTitle = createElement('h3', { className: 'data-title', text: DATA_LABELS.exportTitle });
  const exportButton = createElement('button', {
    id: 'sys-data-export',
    className: 'data-btn',
    text: DATA_LABELS.exportButton,
  });
  exportButton.type = 'button';
  const exportLabel = createElement('label', { className: 'data-label', text: DATA_LABELS.exportField });
  const exportField = createElement('textarea', { id: 'sys-data-export-text', className: 'data-text' });
  exportField.readOnly = true;
  exportField.rows = 4;
  exportField.spellcheck = false;
  exportLabel.htmlFor = exportField.id;
  const exportStatus = createElement('div', { id: 'sys-data-export-status', className: 'data-status' });
  exportStatus.setAttribute('aria-live', 'polite');
  exportSection.append(exportTitle, exportButton, exportLabel, exportField, exportStatus);

  // ---- IMPORT ----
  const importSection = createElement('section', { className: 'data-section' });
  const importTitle = createElement('h3', { className: 'data-title', text: DATA_LABELS.importTitle });
  const importHint = createElement('p', { className: 'data-hint', text: DATA_LABELS.importHint });
  importHint.id = 'sys-data-import-hint';
  const importLabelEl = createElement('label', { className: 'data-label', text: DATA_LABELS.importField });
  const importField = createElement('textarea', { id: 'sys-data-import-text', className: 'data-text' });
  importField.rows = 4;
  importField.spellcheck = false;
  importField.setAttribute('autocomplete', 'off');
  importField.setAttribute('aria-describedby', importHint.id);
  importLabelEl.htmlFor = importField.id;
  const importRow = createElement('div', { className: 'data-row' });
  const importButton = createElement('button', { id: 'sys-data-import', className: 'data-btn', text: importLabel({ stage: 'idle' }) });
  importButton.type = 'button';
  const cancelButton = createElement('button', {
    id: 'sys-data-import-cancel',
    className: 'data-btn',
    text: DATA_LABELS.importCancel,
  });
  cancelButton.type = 'button';
  cancelButton.hidden = true;
  importRow.append(importButton, cancelButton);
  const importStatus = createElement('div', { id: 'sys-data-import-status', className: 'data-status' });
  importStatus.setAttribute('aria-live', 'polite');
  importSection.append(importTitle, importHint, importLabelEl, importField, importRow, importStatus);

  const wrap = createElement('div', { className: 'data-panel' });
  wrap.append(exportSection, importSection);
  host.appendChild(wrap);

  // ---- state ----
  let destroyed = false;
  let armState: ResetState = { stage: 'idle' };
  let expiryTimer: number | null = null;
  let copyToken = 0;

  function paintImport(): void {
    const armed = armState.stage === 'armed';
    const text = importLabel(armState);
    if (importButton.textContent !== text) importButton.textContent = text;
    importButton.classList.toggle('is-armed', armed);
    cancelButton.hidden = !armed;
  }

  function clearExpiry(): void {
    if (expiryTimer !== null) {
      window.clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  // Single place that changes the arm: keeps the expiry timer and the modal-stack entry in step.
  function setArmed(next: ResetState): void {
    armState = next;
    clearExpiry();
    if (next.stage === 'armed') {
      modals.push(IMPORT_STACK_ID, cancelImport);
      expiryTimer = window.setTimeout(onExpiry, SYSTEM_MENU_CONFIG.resetArmMs);
    } else {
      modals.remove(IMPORT_STACK_ID);
    }
    paintImport();
  }

  function onExpiry(): void {
    expiryTimer = null;
    setArmed({ stage: 'idle' });
  }

  function cancelImport(): void {
    setArmed({ stage: 'idle' });
  }

  function showImportStatus(text: string): void {
    if (importStatus.textContent !== text) importStatus.textContent = text;
  }

  async function tryCopy(text: string): Promise<boolean> {
    try {
      return await (deps.copyText !== undefined ? deps.copyText(text) : clipboardWrite(text));
    } catch {
      return false;
    }
  }

  // ---- handlers ----
  const onExport = (): void => {
    const text = deps.exportString();
    exportField.value = text;
    exportField.select();
    exportStatus.textContent = '';
    copyToken += 1;
    const token = copyToken;
    void tryCopy(text).then((ok) => {
      if (destroyed || token !== copyToken) return;
      exportStatus.textContent = copyStatusLabel(ok);
    });
  };

  const onImport = (): void => {
    if (!canImport(importField.value)) {
      setArmed({ stage: 'idle' });
      showImportStatus(DATA_LABELS.importEmpty);
      return;
    }
    const r = reduceImport(armState, { type: 'press', nowMs: Date.now() });
    if (!r.execute) {
      setArmed(r.state);
      showImportStatus('');
      return;
    }
    setArmed({ stage: 'idle' });
    const result = deps.importString(trimImportText(importField.value));
    if (result.ok) {
      deps.reload();
      return;
    }
    showImportStatus(result.error);
  };

  const onCancel = (): void => {
    cancelImport();
    importButton.focus();
  };

  exportButton.addEventListener('click', onExport);
  importButton.addEventListener('click', onImport);
  cancelButton.addEventListener('click', onCancel);
  paintImport();

  return {
    refresh(): void {
      if (destroyed) return;
      paintImport();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearExpiry();
      modals.remove(IMPORT_STACK_ID);
      exportButton.removeEventListener('click', onExport);
      importButton.removeEventListener('click', onImport);
      cancelButton.removeEventListener('click', onCancel);
      wrap.remove();
    },
  };
}
