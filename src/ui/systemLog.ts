import { SYSTEM_LOG_CONFIG, SYSTEM_LOG_CUT } from '../data/systemLogs';
import type { GameSession } from '../simulation';
import type { Toasts } from './toasts';
import { cutLogMessage, markShown, nextSystemLog, seedTracker, systemLogMessage } from './systemLogRules';
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
  // WP28: Splices cut by the last new cycle, waiting for their SYS LOG line (0 = nothing queued).
  let cutQueued = 0;
  // Pending onCleared timers. Dispose and reset cancel them.
  const clearTimers = new Set<number>();

  const cancelClearTimers = (): void => {
    for (const handle of clearTimers) window.clearTimeout(handle);
    clearTimers.clear();
  };

  // A line was just shown: onShown now, onCleared after its duration.
  const announce = (id: string): void => {
    hooks.onShown?.(id);
    if (hooks.onCleared !== undefined) {
      const handle = window.setTimeout(() => {
        clearTimers.delete(handle);
        hooks.onCleared?.(id);
      }, SYSTEM_LOG_CONFIG.durationMs);
      clearTimers.add(handle);
    }
  };

  const check = (): void => {
    try {
      if (hooks.defer?.() === true) return;
      const nowMs = now();
      // WP28: the cut line comes first, at the first poll that defer allows (no gap check: the reset re-seeds the tracker, which would hold it back for minutes).
      if (cutQueued > 0) {
        toasts.show(cutLogMessage(cutQueued));
        tracker = markShown(tracker, nowMs);
        cutQueued = 0;
        announce(SYSTEM_LOG_CUT.id);
        return;
      }
      const next = nextSystemLog(tracker, session.state, nowMs);
      if (next === null) return;
      tracker = next.tracker;
      toasts.show(systemLogMessage(next.entry, session.prestige.cycle));
      announce(next.entry.id);
    } catch (error) {
      console.warn('[systemLog] check failed', error);
    }
  };

  const timer = window.setInterval(check, SYSTEM_LOG_CONFIG.checkIntervalMs);
  // 'cycle' fires after 'reset' (GameSession.beginNewCycle), so the queue survives the reset that precedes it.
  const unsubscribeCycle = session.on('cycle', ({ splicesCut }) => {
    if (splicesCut > 0) cutQueued = splicesCut;
  });
  const unsubscribe = session.on('reset', () => {
    cancelClearTimers();
    cutQueued = 0;
    tracker = seedTracker(session.state, now());
  });

  return () => {
    window.clearInterval(timer);
    cancelClearTimers();
    unsubscribeCycle();
    unsubscribe();
  };
}
