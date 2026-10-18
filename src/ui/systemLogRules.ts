import { SYSTEM_LOGS, SYSTEM_LOG_CONFIG, SYSTEM_LOG_TITLE } from '../data/systemLogs';
import type { SystemLogEntry, SystemLogTrigger } from '../data/systemLogs';
import type { ToastMessage } from '../data/notifications';
import type { ResourceMap } from '../data/types';

// Pure scheduler for rare system-log toasts (WP4). No DOM, no Phaser, no mutation of inputs.

export interface SystemLogTracker {
  readonly shown: ReadonlySet<string>;
  readonly lastShownAt: number;
}

// Minimal state slice the rules read.
interface LogState {
  lifetime: Readonly<ResourceMap>;
  createdAt: number;
}

// True when the trigger condition holds for this state at nowMs.
function triggerMet(trigger: SystemLogTrigger, s: LogState, nowMs: number): boolean {
  if (trigger.kind === 'lifetime') return s.lifetime[trigger.res] >= trigger.atLeast;
  // playSeconds: time since the save was created.
  return (nowMs - s.createdAt) / 1000 >= trigger.atLeast;
}

// Tracker for a fresh session: entries already met are treated as shown, so they never fire late.
export function seedTracker(s: LogState, nowMs: number): SystemLogTracker {
  const shown = new Set<string>();
  for (const entry of SYSTEM_LOGS) {
    if (triggerMet(entry.trigger, s, nowMs)) shown.add(entry.id);
  }
  return { shown, lastShownAt: nowMs };
}

// At most one log per call: the first unshown, eligible entry in table order, unless inside the gap.
export function nextSystemLog(
  t: SystemLogTracker,
  s: LogState,
  nowMs: number,
  cfg: { minGapMs: number } = { minGapMs: SYSTEM_LOG_CONFIG.minGapMs },
): { entry: SystemLogEntry; tracker: SystemLogTracker } | null {
  if (nowMs - t.lastShownAt < cfg.minGapMs) return null;
  for (const entry of SYSTEM_LOGS) {
    if (t.shown.has(entry.id)) continue;
    if (!triggerMet(entry.trigger, s, nowMs)) continue;
    const shown = new Set<string>(t.shown);
    shown.add(entry.id);
    return { entry, tracker: { shown, lastShownAt: nowMs } };
  }
  return null;
}

// Toast for one system log line.
export function systemLogMessage(e: SystemLogEntry): ToastMessage {
  return {
    key: `log:${e.id}`,
    title: SYSTEM_LOG_TITLE,
    body: e.text,
    tone: 'system',
    durationMs: SYSTEM_LOG_CONFIG.durationMs,
  };
}
