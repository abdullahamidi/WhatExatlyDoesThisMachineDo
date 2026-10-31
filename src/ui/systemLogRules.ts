import { SYSTEM_LOGS, SYSTEM_LOG_CONFIG, SYSTEM_LOG_CUT, SYSTEM_LOG_TITLE } from '../data/systemLogs';
import type { SystemLogEntry, SystemLogTrigger } from '../data/systemLogs';
import type { ToastMessage } from '../data/notifications';
import type { ResourceMap } from '../data/types';
import { CYCLE_LABEL } from '../data/prestige';
import { cycleLabel } from '../simulation/prestige';
import { toastOf } from './notificationRules';

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

// True when the minimum gap has passed since the last shown line (the rule nextSystemLog applies).
export function gapOpen(t: SystemLogTracker, nowMs: number, minGapMs: number = SYSTEM_LOG_CONFIG.minGapMs): boolean {
  return nowMs - t.lastShownAt >= minGapMs;
}

// Tracker after a line that is not a table entry (the Splice cut) was shown: only lastShownAt moves, like a table line.
export function markShown(t: SystemLogTracker, nowMs: number): SystemLogTracker {
  return { shown: t.shown, lastShownAt: nowMs };
}

// WP28 prestige line: the SYS LOG one-shot for the Splices a new cycle cut. {n} is the count of Splices woken before the reset.
export function cutLogMessage(n: number): ToastMessage {
  return toastOf(`log:${SYSTEM_LOG_CUT.id}`, SYSTEM_LOG_TITLE, SYSTEM_LOG_CUT.text.replaceAll('{n}', String(n)), 'system', SYSTEM_LOG_CONFIG.durationMs);
}

// Toast for one system log line. {cycle} becomes the live cycle digits (WP20), e.g. 0042.
export function systemLogMessage(e: SystemLogEntry, cycle: number = 1): ToastMessage {
  const digits = cycleLabel(cycle).slice(CYCLE_LABEL.prefix.length);
  return toastOf(`log:${e.id}`, SYSTEM_LOG_TITLE, e.text.replaceAll('{cycle}', digits), 'system', SYSTEM_LOG_CONFIG.durationMs);
}
