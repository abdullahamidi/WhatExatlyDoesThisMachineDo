// Fullscreen control (WP19 T9). Electron host: delegates to the main process (F11 / Alt+Enter are handled there).
// Web build: browser Fullscreen API on the document root, plus Alt+Enter. Session-only: never saved. DOM only, no Phaser.

export interface HostFullscreen {
  setFullscreen(on: boolean): void;
  isFullscreen(): boolean;
  onFullscreenChange(cb: (on: boolean) => void): () => void;
}

export interface FullscreenControl {
  supported(): boolean;
  isOn(): boolean;
  set(on: boolean): void;
  toggle(): void;
  onChange(fn: (on: boolean) => void): () => void;
  destroy(): void;
}

const FULLSCREEN_CHANGE_EVENT = 'fullscreenchange';
const KEYDOWN_EVENT = 'keydown';
const ENTER_KEY = 'Enter';

function hostControl(host: HostFullscreen): FullscreenControl {
  return {
    supported: (): boolean => true,
    isOn: (): boolean => host.isFullscreen(),
    set: (on: boolean): void => host.setFullscreen(on),
    toggle: (): void => host.setFullscreen(!host.isFullscreen()),
    onChange: (fn: (on: boolean) => void): (() => void) => host.onFullscreenChange(fn),
    destroy: (): void => undefined,
  };
}

/** Runs a browser fullscreen request; rejections and missing methods are ignored, nothing is thrown. */
function attempt(run: () => Promise<void> | undefined): void {
  try {
    run()?.catch(() => undefined);
  } catch {
    // The API is missing or refused the call: the state simply stays as it is.
  }
}

function webControl(doc: Document, win: Window): FullscreenControl {
  const supported = (): boolean => doc.fullscreenEnabled === true;

  const isOn = (): boolean => {
    const el: Element | null | undefined = doc.fullscreenElement;
    return el !== null && el !== undefined;
  };

  const set = (on: boolean): void => {
    if (on === isOn()) return;
    if (on) {
      attempt(() => doc.documentElement.requestFullscreen?.());
    } else {
      attempt(() => doc.exitFullscreen?.());
    }
  };

  const toggle = (): void => set(!isOn());

  const onChange = (fn: (on: boolean) => void): (() => void) => {
    const listener = (): void => fn(isOn());
    doc.addEventListener(FULLSCREEN_CHANGE_EVENT, listener);
    return (): void => doc.removeEventListener(FULLSCREEN_CHANGE_EVENT, listener);
  };

  // Capture phase so the shortcut wins over focused controls. Only Alt+Enter; F11 stays with the browser.
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== ENTER_KEY || !e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    if (!supported()) return;
    e.preventDefault();
    e.stopPropagation();
    toggle();
  };
  win.addEventListener(KEYDOWN_EVENT, onKeyDown, true);

  return {
    supported,
    isOn,
    set,
    toggle,
    onChange,
    destroy: (): void => {
      win.removeEventListener(KEYDOWN_EVENT, onKeyDown, true);
    },
  };
}

/**
 * Fullscreen control for the current runtime. With a host (Electron) every call goes to the host and
 * no key listener is installed. Without one (browser) the Fullscreen API is used and Alt+Enter toggles it.
 */
export function createFullscreen(
  host: HostFullscreen | null,
  doc: Document = document,
  win: Window = window,
): FullscreenControl {
  return host === null ? webControl(doc, win) : hostControl(host);
}
