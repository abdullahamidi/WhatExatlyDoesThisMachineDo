// Typed contract of the Electron host bridge (window.wedtmdHost). Pure: no engine or DOM imports.
// The preload script defines the object; the web build has none and every caller must cope with null.

/** Save storage exposed by the host. Writes go to userData in the main process. */
export interface HostStorageBridge {
  /** Every stored key -> raw value (sync IPC). */
  loadAll(): Record<string, string>;
  /** Async write of one key; main writes it atomically. */
  set(key: string, value: string): void;
  /** Async delete of one key. */
  remove(key: string): void;
  /** Sync write of every entry (null = delete). True only when all were written. */
  flush(pending: Record<string, string | null>): boolean;
}

/** The desktop host injected by the preload script as `window.wedtmdHost`. */
export interface WedtmdHost {
  readonly kind: 'electron';
  readonly version: string;
  /** process.platform, e.g. 'win32'. */
  readonly platform: string;
  readonly isPackaged: boolean;
  readonly storage: HostStorageBridge;
  /** Main enforces the URL allowlist. */
  openExternal(url: string): void;
  quit(): void;
  setFullscreen(on: boolean): void;
  isFullscreen(): boolean;
  onFullscreenChange(cb: (on: boolean) => void): () => void;
}

declare global {
  interface Window {
    wedtmdHost?: WedtmdHost;
  }
}

/** Object-typed check that never throws. Functions and primitives are not objects here. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const STORAGE_FUNCTIONS = ['loadAll', 'set', 'remove', 'flush'] as const;
const HOST_FUNCTIONS = ['openExternal', 'quit', 'setFullscreen', 'isFullscreen', 'onFullscreenChange'] as const;

function isWedtmdHost(value: unknown): value is WedtmdHost {
  if (!isObject(value) || value.kind !== 'electron') return false;
  const storage = value.storage;
  if (!isObject(storage)) return false;
  return (
    STORAGE_FUNCTIONS.every((name) => typeof storage[name] === 'function') &&
    HOST_FUNCTIONS.every((name) => typeof value[name] === 'function')
  );
}

/**
 * Returns the validated host bridge found on `scope` (the window in the browser), or null.
 * Returns the same object that was found, not a copy. Never throws, even for hostile input.
 */
export function getHost(
  scope: { wedtmdHost?: unknown } = globalThis as unknown as { wedtmdHost?: unknown },
): WedtmdHost | null {
  try {
    const candidate: unknown = scope.wedtmdHost;
    return isWedtmdHost(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
