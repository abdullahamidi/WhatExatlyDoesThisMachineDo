import { SAVE_BACKUP_KEY, SAVE_KEY, SAVE_PREIMPORT_KEY } from '../data/balance';
import { HOST_STORAGE } from '../data/storage';
import type { HostStorageBridge, WedtmdHost } from '../platform/host';
import { MemoryStorage } from './saveManager';
import type { KeyValueStorage } from './saveManager';

/** Minimal timer abstraction so the debounce can be tested without real timers. */
export interface TimeoutPort {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** KeyValueStorage whose writes reach the host bridge after a debounce, or at once through flush(). */
export interface HostStorage extends KeyValueStorage {
  /** Sends every pending write now in one bridge call. True when nothing was pending or the bridge wrote all of it. */
  flush(): boolean;
  /** Number of keys still waiting to reach the bridge. */
  pendingCount(): number;
}

// Looked up at call time, so vi.useFakeTimers() and other global replacements apply.
const defaultTimers: TimeoutPort = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as Parameters<typeof globalThis.clearTimeout>[0]),
};

/**
 * Sync-loaded cache over the host bridge. Reads come from the cache only. A write updates the cache and
 * marks its key pending; the first pending write starts one timer (later writes do not restart it), and when
 * it fires every pending key goes to the bridge. flush() sends everything at once.
 * Only the constructor throws (when the bridge cannot load). The other methods never throw.
 */
export function createHostStorage(
  bridge: HostStorageBridge,
  opts: { debounceMs?: number; timers?: TimeoutPort } = {},
): HostStorage {
  const debounceMs = opts.debounceMs ?? HOST_STORAGE.debounceMs;
  const timers = opts.timers ?? defaultTimers;

  const cache = new Map<string, string>();
  // key -> value to write, or null to delete.
  const pending = new Map<string, string | null>();
  let armed = false;
  let handle: unknown = undefined;

  const loaded: unknown = bridge.loadAll();
  if (typeof loaded === 'object' && loaded !== null) {
    for (const [key, value] of Object.entries(loaded as Record<string, unknown>)) {
      if (typeof value === 'string') cache.set(key, value);
    }
  }

  const disarm = (): void => {
    if (!armed) return;
    const h = handle;
    armed = false;
    handle = undefined;
    try {
      timers.clearTimeout(h);
    } catch {
      // A timer that cannot be cleared fires later and finds only what is still pending.
    }
  };

  const writeOne = (key: string, value: string | null): boolean => {
    try {
      if (value === null) bridge.remove(key);
      else bridge.set(key, value);
      return true;
    } catch {
      return false;
    }
  };

  const drain = (): void => {
    armed = false;
    handle = undefined;
    for (const [key, value] of Array.from(pending)) {
      if (writeOne(key, value) && pending.get(key) === value) pending.delete(key);
    }
  };

  const arm = (): void => {
    if (armed) return;
    try {
      handle = timers.setTimeout(drain, debounceMs);
      armed = true;
    } catch {
      // No timer: the write stays pending until flush() or the next write arms one.
    }
  };

  return {
    getItem(key: string): string | null {
      return cache.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      cache.set(key, value);
      pending.set(key, value);
      arm();
    },
    removeItem(key: string): void {
      cache.delete(key);
      pending.set(key, null);
      arm();
    },
    flush(): boolean {
      disarm();
      if (pending.size === 0) return true;
      try {
        const ok = bridge.flush(Object.fromEntries(pending)) === true;
        if (ok) pending.clear();
        return ok;
      } catch {
        return false;
      }
    },
    pendingCount(): number {
      return pending.size;
    },
  };
}

export type StorageKind = 'host' | 'local' | 'memory';

export interface PickedStorage {
  storage: KeyValueStorage;
  kind: StorageKind;
  /** Keys copied from localStorage into the host on this boot (empty when nothing was copied). */
  imported: readonly string[];
  flush(): boolean;
}

/** The save family that is copied once from localStorage into a host that has no save yet. */
export const IMPORT_KEYS: readonly string[] = [SAVE_KEY, SAVE_BACKUP_KEY, SAVE_PREIMPORT_KEY];

function openHost(host: WedtmdHost, o: { timers?: TimeoutPort; debounceMs?: number }): HostStorage | null {
  try {
    return createHostStorage(host.storage, { timers: o.timers, debounceMs: o.debounceMs });
  } catch {
    return null;
  }
}

function readLegacy(source: KeyValueStorage, key: string): string | null {
  try {
    return source.getItem(key);
  } catch {
    return null;
  }
}

/**
 * One-time copy of the localStorage save family into a host that has no save yet. Skipped when the host
 * already has SAVE_KEY, when legacy() throws, or when the source is in-memory. Returns the keys copied.
 */
function importFromLegacy(target: HostStorage, legacy: () => KeyValueStorage): string[] {
  const imported: string[] = [];
  if (target.getItem(SAVE_KEY) !== null) return imported;
  let source: KeyValueStorage;
  try {
    source = legacy();
  } catch {
    return imported;
  }
  if (source instanceof MemoryStorage) return imported;
  for (const key of IMPORT_KEYS) {
    const value = readLegacy(source, key);
    if (value === null) continue;
    target.setItem(key, value);
    imported.push(key);
  }
  return imported;
}

function legacyStorage(legacy: () => KeyValueStorage): PickedStorage {
  let storage: KeyValueStorage;
  try {
    storage = legacy();
  } catch {
    storage = new MemoryStorage();
  }
  return {
    storage,
    kind: storage instanceof MemoryStorage ? 'memory' : 'local',
    imported: [],
    flush: () => true,
  };
}

/**
 * Chooses where the save lives. With a usable host: host storage, after a one-time import from
 * localStorage when the host has no save (one flush after the copy). Otherwise the legacy storage,
 * reported as 'local', or as 'memory' when it is in-memory. Never throws.
 */
export function pickStorage(o: {
  host: WedtmdHost | null;
  legacy: () => KeyValueStorage;
  timers?: TimeoutPort;
  debounceMs?: number;
}): PickedStorage {
  const hostStorage = o.host ? openHost(o.host, o) : null;
  if (hostStorage !== null) {
    const imported = importFromLegacy(hostStorage, o.legacy);
    if (imported.length > 0) hostStorage.flush();
    return { storage: hostStorage, kind: 'host', imported, flush: () => hostStorage.flush() };
  }
  return legacyStorage(o.legacy);
}
