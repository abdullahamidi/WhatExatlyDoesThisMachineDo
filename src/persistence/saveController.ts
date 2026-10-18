import type { GameSession } from '../simulation';
import { AUTOSAVE_INTERVAL_MS } from '../data/balance';
import { RESOURCE_IDS } from '../data/types';
import type { SaveManager } from './saveManager';

/** Minimal timer abstraction so the controller can be tested without real timers. */
export interface Scheduler {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(h: unknown): void;
}

export interface SaveController {
  /** Writes the current state and settings. Returns the write result; never throws. */
  saveNow(): boolean;
  /** Erases the save, starts a fresh session (settings kept) and writes the fresh state. */
  resetProgress(): void;
  /** Starts autosave and event-driven saves. Idempotent. */
  start(): void;
  /** Stops autosave and event-driven saves. Idempotent; start() works again afterwards. */
  dispose(): void;
  readonly lastSaveOk: boolean | null;
}

const defaultScheduler: Scheduler = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as Parameters<typeof globalThis.clearInterval>[0]),
};

/**
 * Owns all writes to the save after boot: the periodic autosave, saves on purchase, milestone and
 * mute changes, the manual save and the reset. Holds no economy state of its own.
 */
export function createSaveController(o: {
  session: GameSession;
  saveManager: SaveManager;
  now?: () => number;
  scheduler?: Scheduler;
  intervalMs?: number;
}): SaveController {
  const { session, saveManager } = o;
  const now = o.now ?? (() => Date.now());
  const scheduler = o.scheduler ?? defaultScheduler;
  const intervalMs = o.intervalMs ?? AUTOSAVE_INTERVAL_MS;

  let lastSaveOk: boolean | null = null;
  let running = false;
  let timer: unknown = undefined;
  let unsubscribers: Array<() => void> = [];
  let warnedNonFinite = false;

  /** Counters that must be finite numbers before anything is written; NaN/Infinity would corrupt the save. */
  const hasNonFiniteCounter = (): boolean => {
    const s = session.state;
    if (![s.lastSimTime, s.totalClicks].every(Number.isFinite)) return true;
    return RESOURCE_IDS.some((id) => !Number.isFinite(s.res[id]) || !Number.isFinite(s.lifetime[id]));
  };

  const saveNow = (): boolean => {
    try {
      if (hasNonFiniteCounter()) {
        if (!warnedNonFinite) {
          warnedNonFinite = true;
          console.warn('[saveController] non-finite state counter; save skipped');
        }
        lastSaveOk = false;
        return lastSaveOk;
      }
      lastSaveOk = saveManager.save(session.state, session.settings, now());
    } catch {
      lastSaveOk = false;
    }
    return lastSaveOk;
  };

  return {
    saveNow,

    resetProgress(): void {
      saveManager.reset();
      session.reset(now());
      saveNow();
    },

    start(): void {
      if (running) return;
      running = true;
      timer = scheduler.setInterval(() => {
        saveNow();
      }, intervalMs);
      unsubscribers = [
        session.on('purchase', () => {
          saveNow();
        }),
        session.on('milestone', () => {
          saveNow();
        }),
        session.on('settings', () => {
          saveNow();
        }),
      ];
    },

    dispose(): void {
      if (!running) return;
      running = false;
      scheduler.clearInterval(timer);
      timer = undefined;
      for (const off of unsubscribers) off();
      unsubscribers = [];
    },

    get lastSaveOk(): boolean | null {
      return lastSaveOk;
    },
  };
}
