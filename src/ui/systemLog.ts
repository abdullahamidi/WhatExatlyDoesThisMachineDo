import { SYSTEM_LOG_CONFIG } from '../data/systemLogs';
import type { GameSession } from '../simulation';
import type { Toasts } from './toasts';
import { nextSystemLog, seedTracker, systemLogMessage } from './systemLogRules';
import type { SystemLogTracker } from './systemLogRules';

// Rare system-log toasts (WP4). DOM-side connector: polls on a timer. No Phaser.

// Starts the poll that shows at most one system log per minGap. Returns the disposer.
export function connectSystemLog(session: GameSession, toasts: Toasts, now: () => number = Date.now): () => void {
  let tracker: SystemLogTracker = seedTracker(session.state, now());

  const check = (): void => {
    try {
      const next = nextSystemLog(tracker, session.state, now());
      if (next === null) return;
      tracker = next.tracker;
      toasts.show(systemLogMessage(next.entry));
    } catch (error) {
      console.warn('[systemLog] check failed', error);
    }
  };

  const timer = window.setInterval(check, SYSTEM_LOG_CONFIG.checkIntervalMs);
  const unsubscribe = session.on('reset', () => {
    tracker = seedTracker(session.state, now());
  });

  return () => {
    window.clearInterval(timer);
    unsubscribe();
  };
}
