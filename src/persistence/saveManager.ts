import type { GameState, LoadResult, SettingsState } from '../data/types';
import { SAVE_BACKUP_KEY, SAVE_KEY } from '../data/balance';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { emptyStats } from '../simulation/stats';
import { DEFAULT_PRESTIGE } from '../simulation/prestige';
import { normalizeWorld } from '../simulation/worldSave';
import { deserialize, serialize } from './codec';
import type { SaveMeta } from './codec';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage used when no persistent storage is available, and in tests. */
export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

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

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Loads and saves the game save through a KeyValueStorage. Its methods never throw. */
export class SaveManager {
  private readonly storage: KeyValueStorage;
  private readonly key: string;

  constructor(storage: KeyValueStorage, key: string = SAVE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  load(nowMs: number): LoadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(this.key);
    } catch (e) {
      return {
        state: createInitialState(nowMs),
        settings: { ...DEFAULT_SETTINGS },
        stats: emptyStats(nowMs),
        achievements: { unlocked: {} },
        prestige: { ...DEFAULT_PRESTIGE, perks: [] },
        world: normalizeWorld(undefined),
        status: 'new',
        error: `Could not read save: ${errorMessage(e)}`,
      };
    }

    const result = deserialize(raw, nowMs);
    if (result.status === 'recovered' && raw !== null) {
      try {
        this.storage.setItem(SAVE_BACKUP_KEY, raw);
      } catch {
        // Backup is best effort; the recovered state is still returned.
      }
    }
    return result;
  }

  /** Returns true when the save was written, false when storage refused it. */
  save(state: GameState, settings: SettingsState, nowMs: number, meta?: SaveMeta): boolean {
    try {
      this.storage.setItem(this.key, serialize(state, settings, nowMs, meta));
      return true;
    } catch {
      return false;
    }
  }

  /** Copies the current raw save text to `key`. Returns false when there is no save or storage refuses. */
  backup(key: string): boolean {
    try {
      const raw = this.storage.getItem(this.key);
      if (raw === null) return false;
      this.storage.setItem(key, raw);
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    try {
      this.storage.removeItem(this.key);
    } catch {
      // Nothing else to do if storage refuses the removal.
    }
  }
}

/**
 * Returns the browser's localStorage (via globalThis) when it is usable, otherwise in-memory storage.
 * Never throws.
 */
export function browserStorage(): KeyValueStorage {
  try {
    const ls = (globalThis as { localStorage?: KeyValueStorage }).localStorage;
    if (ls) {
      const probe = '__wedtmd_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    }
  } catch {
    // Storage blocked or unavailable (private mode, disabled site data): fall through.
  }
  return new MemoryStorage();
}
