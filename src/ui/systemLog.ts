import { SYSTEM_LOG_CONFIG } from '../data/systemLogs';
import type { GameSession } from '../simulation';
import type { Toasts } from './toasts';
import { nextSystemLog, seedTracker, systemLogMessage } from './systemLogRules';
import type { SystemLogTracker } from './systemLogRules';

// Rare system-log toasts (WP4). DOM-side connector: polls on a timer. No Phaser.

// Optional hooks for the living-world director (WP23a). Without them the connector behaves as before.
export interface SystemLogHooks {
  /** True postpones this poll. The tracker is untouched, so the log fires on a later poll. */
  defer?: () => boolean;
  /** Called right after the toast is shown. */
  onShown?: (id: string) => void;
  /** Called SYSTEM_LOG_CONFIG.durationMs after the show. Cancelled (never called) by dispose or reset. */
  onCleared?: (id: string) => void;
}

// Starts the poll that shows at most one system log per minGap. Returns the disposer.
export function connectSystemLog(
  session: GameSession,
  toasts: Toasts,
  now: () => number = Date.now,
  hooks: SystemLogHooks = {},
): () => void {
  let tracker: SystemLogTracker = seedTracker(session.state, now());
  // Pending onCleared timers. Dispose and reset cancel them.
  const clearTimers = new Set<number>();

  const cancelClearTimers = (): void => {
    for (const handle of clearTimers) window.clearTimeout(handle);
    clearTimers.clear();
  };

  const check = (): void => {
    try {
      if (hooks.defer?.() === true) return;
      const next = nextSystemLog(tracker, session.state, now());
      if (next === null) return;
      tracker = next.tracker;
      toasts.show(systemLogMessage(next.entry, session.prestige.cycle));
      hooks.onShown?.(next.entry.id);
      if (hooks.onCleared !== undefined) {
        const id = next.entry.id;
        const handle = window.setTimeout(() => {
          clearTimers.delete(handle);
          hooks.onCleared?.(id);
        }, SYSTEM_LOG_CONFIG.durationMs);
        clearTimers.add(handle);
      }
    } catch (error) {
      console.warn('[systemLog] check failed', error);
    }
  };

  const timer = window.setInterval(check, SYSTEM_LOG_CONFIG.checkIntervalMs);
  const unsubscribe = session.on('reset', () => {
    cancelClearTimers();
    tracker = seedTracker(session.state, now());
  });

  return () => {
    window.clearInterval(timer);
    cancelClearTimers();
    unsubscribe();
  };
}
