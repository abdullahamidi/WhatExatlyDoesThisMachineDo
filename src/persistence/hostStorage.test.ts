import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SAVE_BACKUP_KEY, SAVE_KEY, SAVE_PREIMPORT_KEY } from '../data/balance';
import { HOST_STORAGE } from '../data/storage';
import type { HostStorageBridge, WedtmdHost } from '../platform/host';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { MemoryStorage, SaveManager } from './saveManager';
import type { KeyValueStorage } from './saveManager';
import { createHostStorage, IMPORT_KEYS, pickStorage } from './hostStorage';
import type { TimeoutPort } from './hostStorage';

type BridgeCall =
  | { op: 'set'; key: string; value: string }
  | { op: 'remove'; key: string }
  | { op: 'flush'; pending: Record<string, string | null> };

interface Faults {
  set: boolean;
  remove: boolean;
  flush: 'ok' | 'false' | 'throw';
  loadAll: boolean;
}

interface FakeBridge {
  bridge: HostStorageBridge;
  /** What the main process has written to disk. */
  disk: Map<string, string>;
  /** Writes received in order (loadAll is not logged). */
  calls: BridgeCall[];
  faults: Faults;
}

/** In-memory disk and call log. Pass an existing disk to reopen the same files (a second launch). */
function fakeBridge(disk: Map<string, string> = new Map()): FakeBridge {
  const calls: BridgeCall[] = [];
  const faults: Faults = { set: false, remove: false, flush: 'ok', loadAll: false };
  const bridge: HostStorageBridge = {
    loadAll: () => {
      if (faults.loadAll) throw new Error('ipc unavailable');
      return Object.fromEntries(disk);
    },
    set: (key, value) => {
      calls.push({ op: 'set', key, value });
      if (faults.set) throw new Error('disk full');
      disk.set(key, value);
    },
    remove: (key) => {
      calls.push({ op: 'remove', key });
      if (faults.remove) throw new Error('remove failed');
      disk.delete(key);
    },
    flush: (pending) => {
      calls.push({ op: 'flush', pending: { ...pending } });
      if (faults.flush === 'throw') throw new Error('sync write failed');
      if (faults.flush === 'false') return false;
      for (const [key, value] of Object.entries(pending)) {
        if (value === null) disk.delete(key);
        else disk.set(key, value);
      }
      return true;
    },
  };
  return { bridge, disk, calls, faults };
}

const opsOf = (calls: readonly BridgeCall[], op: BridgeCall['op']): BridgeCall[] => calls.filter((c) => c.op === op);

function fakeHost(bridge: HostStorageBridge): WedtmdHost {
  return {
    kind: 'electron',
    version: '0.0.0-test',
    platform: 'win32',
    isPackaged: false,
    storage: bridge,
    openExternal: () => {},
    quit: () => {},
    setFullscreen: () => {},
    isFullscreen: () => false,
    onFullscreenChange: () => () => {},
  };
}

/** A plain Map-backed storage that is NOT MemoryStorage, standing in for localStorage. */
class MapStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

  constructor(entries: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(entries)) this.map.set(key, value);
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

class ThrowingGetStorage implements KeyValueStorage {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {}
  removeItem(): void {}
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createHostStorage: cache', () => {
  it('seeds reads from loadAll', () => {
    const f = fakeBridge(new Map([[SAVE_KEY, 'saved']]));
    const storage = createHostStorage(f.bridge);
    expect(storage.getItem(SAVE_KEY)).toBe('saved');
    expect(storage.getItem('missing')).toBeNull();
  });

  it('drops non-string loadAll values', () => {
    const raw: Record<string, unknown> = { keep: 'yes', num: 5, nothing: null, obj: {}, flag: true };
    const bridge: HostStorageBridge = { ...fakeBridge().bridge, loadAll: () => raw as Record<string, string> };
    const storage = createHostStorage(bridge);
    expect(storage.getItem('keep')).toBe('yes');
    expect(storage.getItem('num')).toBeNull();
    expect(storage.getItem('nothing')).toBeNull();
    expect(storage.getItem('obj')).toBeNull();
    expect(storage.getItem('flag')).toBeNull();
  });

  it('seeds nothing when loadAll returns a non-object', () => {
    const bridge: HostStorageBridge = { ...fakeBridge().bridge, loadAll: () => null as unknown as Record<string, string> };
    const storage = createHostStorage(bridge);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('shows a write at once while nothing reaches the bridge yet', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem(SAVE_KEY, 'v1');
    expect(storage.getItem(SAVE_KEY)).toBe('v1');
    expect(f.calls).toEqual([]);
    expect(storage.pendingCount()).toBe(1);
  });

  it('a throwing loadAll makes createHostStorage throw', () => {
    const f = fakeBridge();
    f.faults.loadAll = true;
    expect(() => createHostStorage(f.bridge)).toThrow('ipc unavailable');
  });
});

describe('createHostStorage: debounce', () => {
  it('sends nothing before 500 ms, then one set at 500 ms', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem(SAVE_KEY, 'a');
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs - 1);
    expect(f.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(f.calls).toEqual([{ op: 'set', key: SAVE_KEY, value: 'a' }]);
    expect(storage.pendingCount()).toBe(0);
  });

  it('coalesces three writes of one key into one set with the last value', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('k', 'a');
    vi.advanceTimersByTime(100);
    storage.setItem('k', 'b');
    vi.advanceTimersByTime(100);
    storage.setItem('k', 'c');
    vi.advanceTimersByTime(299);
    expect(f.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(opsOf(f.calls, 'set')).toEqual([{ op: 'set', key: 'k', value: 'c' }]);
  });

  it('does not restart the timer on a later write', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', '1');
    vi.advanceTimersByTime(400);
    storage.setItem('b', '2');
    vi.advanceTimersByTime(99);
    expect(f.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(f.calls).toEqual([
      { op: 'set', key: 'a', value: '1' },
      { op: 'set', key: 'b', value: '2' },
    ]);
    vi.advanceTimersByTime(399);
    expect(f.calls).toHaveLength(2);
  });

  it('sends two different keys as two sets', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
    expect(opsOf(f.calls, 'set')).toEqual([
      { op: 'set', key: 'a', value: '1' },
      { op: 'set', key: 'b', value: '2' },
    ]);
  });

  it('starts a new window for a write after the previous one fired', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('k', 'a');
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
    storage.setItem('k', 'b');
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs - 1);
    expect(opsOf(f.calls, 'set')).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(opsOf(f.calls, 'set')).toHaveLength(2);
  });

  it('honours the debounceMs option', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge, { debounceMs: 50 });
    storage.setItem('k', 'v');
    vi.advanceTimersByTime(49);
    expect(f.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(f.calls).toHaveLength(1);
  });

  it('schedules and clears through the injected timers port', () => {
    const f = fakeBridge();
    const scheduled: Array<() => void> = [];
    const cleared: unknown[] = [];
    const timers: TimeoutPort = {
      setTimeout: (fn) => {
        scheduled.push(fn);
        return scheduled.length;
      },
      clearTimeout: (handle) => {
        cleared.push(handle);
      },
    };
    const storage = createHostStorage(f.bridge, { timers, debounceMs: 123 });
    storage.setItem('k', 'v');
    expect(scheduled).toHaveLength(1);
    expect(f.calls).toEqual([]);
    scheduled[0]?.();
    expect(f.calls).toEqual([{ op: 'set', key: 'k', value: 'v' }]);
    storage.setItem('k', 'w');
    storage.flush();
    expect(cleared).toEqual([2]);
  });
});

describe('createHostStorage: remove', () => {
  it('hides the key at once and sends one remove after the window', () => {
    const f = fakeBridge(new Map([[SAVE_KEY, 'x']]));
    const storage = createHostStorage(f.bridge);
    storage.removeItem(SAVE_KEY);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(f.calls).toEqual([]);
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
    expect(f.calls).toEqual([{ op: 'remove', key: SAVE_KEY }]);
    expect(f.disk.has(SAVE_KEY)).toBe(false);
  });

  it('remove then set of the same key keeps only the last intent', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('k', 'a');
    storage.removeItem('k');
    storage.setItem('k', 'b');
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
    expect(f.calls).toEqual([{ op: 'set', key: 'k', value: 'b' }]);
  });

  it('set then remove of the same key keeps only the remove', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('k', 'a');
    storage.removeItem('k');
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
    expect(f.calls).toEqual([{ op: 'remove', key: 'k' }]);
  });

  it('counts pending keys, not writes', () => {
    const storage = createHostStorage(fakeBridge().bridge);
    storage.setItem('a', '1');
    storage.setItem('a', '2');
    storage.removeItem('b');
    expect(storage.pendingCount()).toBe(2);
  });
});

describe('createHostStorage: flush', () => {
  it('sends every pending entry in one bridge.flush call, null for removes, and returns true', () => {
    const f = fakeBridge(new Map([['b', 'old']]));
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', 'A');
    storage.removeItem('b');
    expect(storage.flush()).toBe(true);
    expect(f.calls).toEqual([{ op: 'flush', pending: { a: 'A', b: null } }]);
    expect(f.disk.get('a')).toBe('A');
    expect(f.disk.has('b')).toBe(false);
    expect(storage.pendingCount()).toBe(0);
  });

  it('clears the timer so nothing is sent after flush', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', 'A');
    storage.flush();
    vi.advanceTimersByTime(5000);
    expect(f.calls.map((c) => c.op)).toEqual(['flush']);
  });

  it('with nothing pending returns true and makes no bridge call', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    expect(storage.flush()).toBe(true);
    expect(f.calls).toEqual([]);
  });

  it('a write after flush starts a new window', () => {
    const f = fakeBridge();
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', '1');
    storage.flush();
    storage.setItem('b', '2');
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
    expect(f.calls.map((c) => c.op)).toEqual(['flush', 'set']);
  });
});

describe('createHostStorage: failures', () => {
  it('a throwing bridge.set leaves the entry pending until flush', () => {
    const f = fakeBridge();
    f.faults.set = true;
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', 'A');
    expect(() => vi.advanceTimersByTime(HOST_STORAGE.debounceMs)).not.toThrow();
    expect(opsOf(f.calls, 'set')).toHaveLength(1);
    expect(storage.pendingCount()).toBe(1);
    expect(storage.getItem('a')).toBe('A');

    f.faults.set = false;
    expect(storage.flush()).toBe(true);
    expect(storage.pendingCount()).toBe(0);
    expect(f.disk.get('a')).toBe('A');
  });

  it('a throwing bridge.remove leaves the entry pending', () => {
    const f = fakeBridge(new Map([['a', 'A']]));
    f.faults.remove = true;
    const storage = createHostStorage(f.bridge);
    storage.removeItem('a');
    expect(() => vi.advanceTimersByTime(HOST_STORAGE.debounceMs)).not.toThrow();
    expect(storage.pendingCount()).toBe(1);
  });

  it('bridge.flush returning false keeps pending and flush returns false', () => {
    const f = fakeBridge();
    f.faults.flush = 'false';
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', 'A');
    expect(storage.flush()).toBe(false);
    expect(storage.pendingCount()).toBe(1);

    f.faults.flush = 'ok';
    expect(storage.flush()).toBe(true);
    expect(storage.pendingCount()).toBe(0);
    expect(f.disk.get('a')).toBe('A');
  });

  it('bridge.flush throwing keeps pending and flush returns false', () => {
    const f = fakeBridge();
    f.faults.flush = 'throw';
    const storage = createHostStorage(f.bridge);
    storage.setItem('a', 'A');
    expect(() => storage.flush()).not.toThrow();
    expect(storage.flush()).toBe(false);
    expect(storage.pendingCount()).toBe(1);

    f.faults.flush = 'ok';
    expect(storage.flush()).toBe(true);
    expect(storage.pendingCount()).toBe(0);
  });

  it('no method throws when the bridge is fully broken', () => {
    const f = fakeBridge();
    f.faults.set = true;
    f.faults.remove = true;
    f.faults.flush = 'throw';
    const storage = createHostStorage(f.bridge);
    expect(() => {
      storage.setItem('a', 'A');
      storage.removeItem('b');
      storage.getItem('a');
      vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
      storage.flush();
    }).not.toThrow();
    expect(storage.pendingCount()).toBe(2);
  });
});

describe('pickStorage', () => {
  it('imports a localStorage save into a host with no save, flushes once, and reads it back', () => {
    const f = fakeBridge();
    const legacy = new MapStorage({ [SAVE_KEY]: 'LOCAL-SAVE' });
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => legacy });

    expect(picked.kind).toBe('host');
    expect(picked.imported).toEqual([SAVE_KEY]);
    expect(f.calls).toEqual([{ op: 'flush', pending: { [SAVE_KEY]: 'LOCAL-SAVE' } }]);
    expect(picked.storage.getItem(SAVE_KEY)).toBe('LOCAL-SAVE');
    expect(f.disk.get(SAVE_KEY)).toBe('LOCAL-SAVE');
  });

  it('copies every IMPORT_KEYS entry that has a value, in IMPORT_KEYS order', () => {
    expect(IMPORT_KEYS).toEqual([SAVE_KEY, SAVE_BACKUP_KEY, SAVE_PREIMPORT_KEY]);
    const f = fakeBridge();
    const legacy = new MapStorage({ [SAVE_KEY]: 'S', [SAVE_BACKUP_KEY]: 'B', [SAVE_PREIMPORT_KEY]: 'P' });
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => legacy });
    expect(picked.imported).toEqual([SAVE_KEY, SAVE_BACKUP_KEY, SAVE_PREIMPORT_KEY]);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toEqual({
      op: 'flush',
      pending: { [SAVE_KEY]: 'S', [SAVE_BACKUP_KEY]: 'B', [SAVE_PREIMPORT_KEY]: 'P' },
    });
  });

  it('imports only the keys that have values', () => {
    const f = fakeBridge();
    const legacy = new MapStorage({ [SAVE_BACKUP_KEY]: 'B' });
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => legacy });
    expect(picked.imported).toEqual([SAVE_BACKUP_KEY]);
  });

  it('a host that already has a save never calls legacy() and imports nothing', () => {
    const f = fakeBridge(new Map([[SAVE_KEY, 'HOST']]));
    const legacy = vi.fn(() => new MapStorage({ [SAVE_KEY]: 'LOCAL' }));
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy });
    expect(legacy).not.toHaveBeenCalled();
    expect(picked.kind).toBe('host');
    expect(picked.imported).toEqual([]);
    expect(f.calls).toEqual([]);
    expect(picked.storage.getItem(SAVE_KEY)).toBe('HOST');
  });

  it('a MemoryStorage legacy is never imported', () => {
    const f = fakeBridge();
    const memory = new MemoryStorage();
    memory.setItem(SAVE_KEY, 'M');
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => memory });
    expect(picked.kind).toBe('host');
    expect(picked.imported).toEqual([]);
    expect(f.calls).toEqual([]);
  });

  it('a legacy() that throws means no import, and the host is still used', () => {
    const f = fakeBridge();
    const picked = pickStorage({
      host: fakeHost(f.bridge),
      legacy: () => {
        throw new Error('denied');
      },
    });
    expect(picked.kind).toBe('host');
    expect(picked.imported).toEqual([]);
    expect(f.calls).toEqual([]);
  });

  it('a legacy whose getItem throws means no import', () => {
    const f = fakeBridge();
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => new ThrowingGetStorage() });
    expect(picked.kind).toBe('host');
    expect(picked.imported).toEqual([]);
    expect(f.calls).toEqual([]);
  });

  it('the returned flush() sends nothing when nothing is pending', () => {
    const f = fakeBridge();
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => new MapStorage() });
    expect(picked.flush()).toBe(true);
    expect(f.calls).toEqual([]);
  });

  it('the returned flush() sends a write made through the picked storage', () => {
    const f = fakeBridge();
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => new MapStorage() });
    picked.storage.setItem(SAVE_KEY, 'new');
    expect(picked.flush()).toBe(true);
    expect(f.disk.get(SAVE_KEY)).toBe('new');
  });

  it('passes debounceMs through to the host storage', () => {
    const f = fakeBridge();
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => new MemoryStorage(), debounceMs: 20 });
    picked.storage.setItem('k', 'v');
    vi.advanceTimersByTime(19);
    expect(f.calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(f.calls).toEqual([{ op: 'set', key: 'k', value: 'v' }]);
  });

  it('passes timers through to the host storage', () => {
    const f = fakeBridge();
    const scheduled: Array<() => void> = [];
    const timers: TimeoutPort = {
      setTimeout: (fn) => {
        scheduled.push(fn);
        return scheduled.length;
      },
      clearTimeout: () => {},
    };
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => new MemoryStorage(), timers });
    picked.storage.setItem('k', 'v');
    expect(scheduled).toHaveLength(1);
    expect(f.calls).toEqual([]);
  });

  it('no host with a localStorage-like legacy is kind local and returns that storage', () => {
    const legacy = new MapStorage({ [SAVE_KEY]: 'x' });
    const picked = pickStorage({ host: null, legacy: () => legacy });
    expect(picked.kind).toBe('local');
    expect(picked.storage).toBe(legacy);
    expect(picked.imported).toEqual([]);
    expect(picked.flush()).toBe(true);
    expect(picked.storage.getItem(SAVE_KEY)).toBe('x');
  });

  it('no host with a MemoryStorage legacy is kind memory', () => {
    const memory = new MemoryStorage();
    const picked = pickStorage({ host: null, legacy: () => memory });
    expect(picked.kind).toBe('memory');
    expect(picked.storage).toBe(memory);
    expect(picked.flush()).toBe(true);
  });

  it('no host and a throwing legacy() falls back to memory without throwing', () => {
    const blocked = (): KeyValueStorage => {
      throw new Error('blocked');
    };
    expect(() => pickStorage({ host: null, legacy: blocked })).not.toThrow();
    const picked = pickStorage({ host: null, legacy: blocked });
    expect(picked.kind).toBe('memory');
    picked.storage.setItem('k', 'v');
    expect(picked.storage.getItem('k')).toBe('v');
  });

  it('a host whose loadAll throws falls back to the legacy storage as local', () => {
    const f = fakeBridge();
    f.faults.loadAll = true;
    const legacy = new MapStorage({ [SAVE_KEY]: 'x' });
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => legacy });
    expect(picked.kind).toBe('local');
    expect(picked.storage).toBe(legacy);
    expect(picked.imported).toEqual([]);
    expect(picked.flush()).toBe(true);
  });

  it('a host whose loadAll throws with a MemoryStorage legacy falls back to memory', () => {
    const f = fakeBridge();
    f.faults.loadAll = true;
    const picked = pickStorage({ host: fakeHost(f.bridge), legacy: () => new MemoryStorage() });
    expect(picked.kind).toBe('memory');
    expect(picked.imported).toEqual([]);
  });
});

describe('round trip through the host storage', () => {
  it('a save written through SaveManager survives a restart over the same disk', () => {
    const first = fakeBridge();
    const hostStorage = createHostStorage(first.bridge);
    const state = createInitialState(0);
    const settings = { ...DEFAULT_SETTINGS, muted: false };

    expect(new SaveManager(hostStorage).save(state, settings, 10)).toBe(true);
    expect(hostStorage.flush()).toBe(true);

    const second = fakeBridge(first.disk);
    const reopened = createHostStorage(second.bridge);
    const result = new SaveManager(reopened).load(10);
    expect(result.status).toBe('loaded');
    expect(result.state).toEqual(state);
    expect(result.settings).toEqual(settings);
  });

  it('a debounced write reaches the disk without an explicit flush', () => {
    const first = fakeBridge();
    const hostStorage = createHostStorage(first.bridge);
    new SaveManager(hostStorage).save(createInitialState(0), { ...DEFAULT_SETTINGS, muted: true }, 10);
    expect(first.disk.has(SAVE_KEY)).toBe(false);
    vi.advanceTimersByTime(HOST_STORAGE.debounceMs);
    expect(first.disk.has(SAVE_KEY)).toBe(true);

    const reopened = createHostStorage(fakeBridge(first.disk).bridge);
    expect(new SaveManager(reopened).load(10).status).toBe('loaded');
  });

  it('a reset stays reset after a restart', () => {
    const first = fakeBridge(new Map([[SAVE_KEY, '{}']]));
    const hostStorage = createHostStorage(first.bridge);
    new SaveManager(hostStorage).reset();
    expect(hostStorage.flush()).toBe(true);

    const reopened = createHostStorage(fakeBridge(first.disk).bridge);
    expect(new SaveManager(reopened).load(10).status).toBe('new');
  });
});
