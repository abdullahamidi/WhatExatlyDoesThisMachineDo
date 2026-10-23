import './crashOverlay.css';
import { CRASH_TEXT } from '../data/shell';
import { crashInfo, crashReport, crashView, shouldIgnoreError } from './crashModel';
import type { CrashInfo, CrashSource, CrashView } from './crashModel';

// Crash overlay and global error guard (WP19 T5). DOM only: no Phaser. Text is always written with textContent.
// Body-level, so it still shows when #ui-root is missing. Only the first report shows the overlay and runs the
// saver; later reports just log. report() never throws.

export interface CrashHost { quit(): void; platform: string; isPackaged: boolean }

export interface CrashGuard { report(err: unknown, source: CrashSource): void; crashed(): boolean; dispose(): void }

export interface CrashGuardOptions { versionLine: string; host: CrashHost | null; win?: Window; doc?: Document }

interface ElementOptions { id?: string; className?: string; text?: string }

interface OverlayParts {
  overlay: HTMLDivElement;
  copy: HTMLButtonElement;
  reload: HTMLButtonElement;
  quit: HTMLButtonElement | null;
  report: HTMLTextAreaElement;
}

const OVERLAY_ID = 'crash-overlay';
const SPLASH_ID = 'splash';
const LOG_PREFIX = '[crash]';

// Save hook registered by the save controller. Returns true when the progress save succeeded.
let saver: (() => boolean) | null = null;
// Module-level guard: a second install returns this one.
let current: CrashGuard | null = null;

// The last call wins; null clears the hook.
export function registerCrashSaver(fn: (() => boolean) | null): void {
  saver = fn;
}

// Null when no saver is registered. A throwing saver counts as a failed save.
function runSaver(): boolean | null {
  const fn = saver;
  if (fn === null) return null;
  try {
    return fn() === true;
  } catch {
    return false;
  }
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  if (options.id !== undefined) el.id = options.id;
  if (options.className !== undefined) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  return el;
}

function buildOverlay(doc: Document, view: CrashView): OverlayParts {
  const overlay = createEl(doc, 'div', { id: OVERLAY_ID });
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'crash-title');

  const panel = createEl(doc, 'div', { id: 'crash-panel' });
  const title = createEl(doc, 'h2', { id: 'crash-title', text: view.title });
  const message = createEl(doc, 'p', { id: 'crash-message', text: view.message });
  panel.append(title, message);
  if (view.savedLine !== null) {
    panel.appendChild(createEl(doc, 'p', { id: 'crash-saved', text: view.savedLine }));
  }

  const actions = createEl(doc, 'div', { className: 'crash-actions' });
  const copy = createEl(doc, 'button', { id: 'crash-copy', text: view.copyLabel });
  copy.type = 'button';
  const reload = createEl(doc, 'button', { id: 'crash-reload', text: view.reloadLabel });
  reload.type = 'button';
  actions.append(copy, reload);
  let quit: HTMLButtonElement | null = null;
  if (view.showQuit) {
    quit = createEl(doc, 'button', { id: 'crash-quit', text: view.quitLabel });
    quit.type = 'button';
    actions.appendChild(quit);
  }
  panel.appendChild(actions);

  const report = createEl(doc, 'textarea', { id: 'crash-report' });
  report.readOnly = true;
  report.hidden = true;
  panel.appendChild(report);

  panel.appendChild(createEl(doc, 'div', { id: 'crash-version', text: view.version }));
  overlay.appendChild(panel);
  return { overlay, copy, reload, quit, report };
}

export function installCrashGuard(o: CrashGuardOptions): CrashGuard {
  if (current !== null) return current;
  const win = o.win ?? window;
  const doc = o.doc ?? document;
  const host = o.host;

  let crashedFlag = false;

  // Copies the report: fills the textarea, then writes the clipboard. Failure shows the selectable text.
  async function copyReport(parts: OverlayParts, info: CrashInfo, saved: boolean | null): Promise<void> {
    const text = crashReport(info, {
      versionLine: o.versionLine,
      runtime: host === null ? 'web' : `electron ${host.platform} ${host.isPackaged ? 'packaged' : 'dev'}`,
      userAgent: win.navigator.userAgent,
      isoTime: new Date().toISOString(),
      saved,
    });
    parts.report.value = text;
    let copied = true;
    try {
      await win.navigator.clipboard.writeText(text);
    } catch {
      copied = false;
    }
    parts.copy.textContent = copied ? CRASH_TEXT.copied : CRASH_TEXT.copyFailed;
    if (!copied) {
      parts.report.hidden = false;
      parts.report.focus();
      parts.report.select();
    }
  }

  function renderOverlay(info: CrashInfo, saved: boolean | null): void {
    const view = crashView(info, { versionLine: o.versionLine, canQuit: host !== null, saved });
    doc.getElementById(OVERLAY_ID)?.remove();
    const parts = buildOverlay(doc, view);
    parts.copy.addEventListener('click', () => {
      void copyReport(parts, info, saved);
    });
    parts.reload.addEventListener('click', () => {
      win.location.reload();
    });
    parts.quit?.addEventListener('click', () => {
      host?.quit();
    });
    doc.body.appendChild(parts.overlay);
    parts.reload.focus();
  }

  // Never throws. The flag is set before the saver runs, so a crash inside the saver only logs.
  function report(err: unknown, source: CrashSource): void {
    try {
      if (crashedFlag) {
        console.error(LOG_PREFIX, err);
        return;
      }
      crashedFlag = true;
      const info = crashInfo(err, source);
      const saved = runSaver();
      console.error(LOG_PREFIX, err);
      doc.getElementById(SPLASH_ID)?.remove();
      renderOverlay(info, saved);
    } catch {
      // The guard itself must not add a second failure.
    }
  }

  const onError = (e: ErrorEvent): void => {
    if (shouldIgnoreError(e.message)) return;
    report(e.error ?? e.message, 'error');
  };
  const onRejection = (e: PromiseRejectionEvent): void => {
    report(e.reason, 'rejection');
  };

  const guard: CrashGuard = {
    report,
    crashed: (): boolean => crashedFlag,
    dispose(): void {
      win.removeEventListener('error', onError);
      win.removeEventListener('unhandledrejection', onRejection);
      if (current === guard) current = null;
    },
  };

  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  current = guard;
  return guard;
}
