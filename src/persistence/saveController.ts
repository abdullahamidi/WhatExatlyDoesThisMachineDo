import type { GameSession } from '../simulation';
import { AUTOSAVE_INTERVAL_MS, SAVE_PREIMPORT_KEY } from '../data/balance';
import { RESOURCE_IDS } from '../data/types';
import { serialize } from './codec';
import { encodeSave, parseImport } from './exchange';
import type { SaveManager } from './saveManager';

/** Minimal timer abstraction so the controller can be tested without real timers. */
export interface Scheduler {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(h: unknown): void;
}

export interface SaveController {
  /** Writes the current state, settings, stats, achievements and prestige. Returns the write result; never throws. */
  saveNow(): boolean;
  /** Erases the save, starts a fresh session (settings kept) and writes the fresh state. */
  resetProgress(): void;
  /** Starts autosave and event-driven saves. Idempotent. Does nothing after a successful import. */
  start(): void;
  /** Stops autosave and event-driven saves. Idempotent; start() works again afterwards. */
  dispose(): void;
  /** The current save as an export string (base64 of the save JSON). */
  exportString(): string;
  /**
   * Imports a save export string. Invalid text leaves storage untouched. A valid one backs up the
   * current save, writes the imported progress with the CURRENT settings, then suspends all saving.
   * The caller must reload the page afterwards.
   */
  importString(text: string): { ok: true } | { ok: false; error: string };
  readonly lastSaveOk: boolean | null;
}

const defaultScheduler: Scheduler = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as Parameters<typeof globalThis.clearInterval>[0]),
};

/**
 * Owns all writes to the save after boot: the periodic autosave, saves on purchase, milestone,
 * achievement, ending, cycle, perk (prestige) and settings changes, the manual save, the reset and the player import.
 * Holds no economy state of its own.
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
  let suspended = false;
  let timer: unknown = undefined;
  let unsubscribers: Array<() => void> = [];
  let warnedNonFinite = false;

  /** Counters that must be finite numbers before anything is written; NaN/Infinity would corrupt the save. */
  const hasNonFiniteCounter = (): boolean => {
    const s = session.state;
    if (![s.lastSimTime, s.totalClicks].every(Number.isFinite)) return true;
    return RESOURCE_IDS.some((id) => !Number.isFinite(s.res[id]) || !Number.isFinite(s.lifetime[id]));
  };

  const meta = () => ({ stats: session.stats, achievements: session.achievements, prestige: session.prestige });

  const saveNow = (): boolean => {
    if (suspended) return false;
    try {
      if (hasNonFiniteCounter()) {
        if (!warnedNonFinite) {
          warnedNonFinite = true;
          console.warn('[saveController] non-finite state counter; save skipped');
        }
        lastSaveOk = false;
        return lastSaveOk;
      }
      lastSaveOk = saveManager.save(session.state, session.settings, now(), meta());
    } catch {
      lastSaveOk = false;
    }
    return lastSaveOk;
  };

  const dispose = (): void => {
    if (!running) return;
    running = false;
    scheduler.clearInterval(timer);
    timer = undefined;
    for (const off of unsubscribers) off();
    unsubscribers = [];
  };

  return {
    saveNow,

    resetProgress(): void {
      saveManager.reset();
      session.reset(now());
      saveNow();
    },

    start(): void {
      if (running || suspended) return;
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
        session.on('achievement', () => {
          saveNow();
        }),
        session.on('ending', () => {
          saveNow();
        }),
        session.on('cycle', () => {
          saveNow();
        }),
        session.on('prestige', () => {
          saveNow();
        }),
      ];
    },

    dispose,

    exportString(): string {
      return encodeSave(serialize(session.state, session.settings, now(), meta()));
    },

    importString(text: string): { ok: true } | { ok: false; error: string } {
      const parsed = parseImport(text, now());
      if (!parsed.ok) return { ok: false, error: parsed.error };

      saveManager.backup(SAVE_PREIMPORT_KEY);
      const { envelope } = parsed;
      const written = saveManager.save(envelope.state, session.settings, envelope.savedAt, {
        stats: envelope.stats,
        achievements: envelope.achievements,
        prestige: envelope.prestige,
      });
      lastSaveOk = written;
      if (!written) return { ok: false, error: 'Could not write the imported save.' };

      suspended = true;
      dispose();
      return { ok: true };
    },

    get lastSaveOk(): boolean | null {
      return lastSaveOk;
    },
  };
}
