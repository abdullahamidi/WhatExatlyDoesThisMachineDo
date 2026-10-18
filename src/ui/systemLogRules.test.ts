import { describe, it, expect } from 'vitest';
import { nextSystemLog, seedTracker, systemLogMessage } from './systemLogRules';
import type { SystemLogTracker } from './systemLogRules';
import { INSTALL_LINES, FIRST_CLICK_MESSAGE } from '../data/notifications';
import { SYSTEM_LOGS, SYSTEM_LOG_CONFIG } from '../data/systemLogs';
import { TECH_IDS } from '../data/types';

const T0 = 1_000_000_000;

describe('SYSTEM_LOGS table', () => {
  it('has 8 to 10 entries with unique ids', () => {
    expect(SYSTEM_LOGS.length).toBeGreaterThanOrEqual(8);
    expect(SYSTEM_LOGS.length).toBeLessThanOrEqual(10);
    const ids = new Set(SYSTEM_LOGS.map((e) => e.id));
    expect(ids.size).toBe(SYSTEM_LOGS.length);
  });

  it('has short non-empty texts that do not repeat install or first-click lines', () => {
    const taken = new Set<string>([FIRST_CLICK_MESSAGE, ...TECH_IDS.map((id) => INSTALL_LINES[id])]);
    for (const entry of SYSTEM_LOGS) {
      expect(entry.text.length).toBeGreaterThan(0);
      expect(entry.text.length).toBeLessThanOrEqual(60);
      expect(taken.has(entry.text)).toBe(false);
    }
  });

  it('has positive thresholds in increasing order per trigger kind', () => {
    const last: Record<string, number> = { lifetimeMe: 0, playSeconds: 0 };
    for (const entry of SYSTEM_LOGS) {
      const { kind, atLeast } = entry.trigger;
      expect(atLeast).toBeGreaterThan(0);
      expect(atLeast).toBeGreaterThanOrEqual(last[kind] ?? 0);
      last[kind] = atLeast;
    }
  });
});

describe('seedTracker', () => {
  it('marks already-met entries as shown and sets lastShownAt', () => {
    const state = { lifetimeMe: 0, createdAt: T0 };
    const tracker = seedTracker(state, T0);
    expect(tracker.shown.size).toBe(0);
    expect(tracker.lastShownAt).toBe(T0);

    const later = seedTracker({ lifetimeMe: 1e9, createdAt: T0 }, T0 + 1e9);
    expect(later.shown.size).toBe(SYSTEM_LOGS.length);
    expect(later.lastShownAt).toBe(T0 + 1e9);
  });
});

describe('nextSystemLog', () => {
  const fresh = { lifetimeMe: 0, createdAt: T0 };
  const minGapMs = SYSTEM_LOG_CONFIG.minGapMs;

  it('returns null inside the minimum gap', () => {
    const t = seedTracker(fresh, T0);
    const ahead = { lifetimeMe: 1e9, createdAt: T0 };
    expect(nextSystemLog(t, ahead, T0 + minGapMs - 1)).toBeNull();
  });

  it('returns exactly one eligible entry after the gap, in table order', () => {
    const t = seedTracker(fresh, T0);
    const now = T0 + minGapMs;
    const ahead = { lifetimeMe: 1e9, createdAt: T0 };
    const result = nextSystemLog(t, ahead, now);
    expect(result).not.toBeNull();
    expect(result?.entry).toBe(SYSTEM_LOGS[0]);
    expect(result?.tracker.shown.has(SYSTEM_LOGS[0]?.id ?? '')).toBe(true);
    expect(result?.tracker.lastShownAt).toBe(now);
  });

  it('returns null when nothing is eligible', () => {
    const t = seedTracker(fresh, T0);
    // Save created just now: no playtime trigger met, no ME earned.
    const brandNew = { lifetimeMe: 0, createdAt: T0 + minGapMs };
    expect(nextSystemLog(t, brandNew, T0 + minGapMs)).toBeNull();
  });

  it('never repeats an entry over 50 calls spaced by the gap', () => {
    const ahead = { lifetimeMe: 1e9, createdAt: T0 };
    let t: SystemLogTracker = seedTracker(fresh, T0);
    const seen: string[] = [];
    for (let i = 1; i <= 50; i++) {
      const result = nextSystemLog(t, ahead, T0 + i * minGapMs);
      if (result === null) continue;
      seen.push(result.entry.id);
      t = result.tracker;
    }
    expect(seen.length).toBe(SYSTEM_LOGS.length);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('does not mutate its input tracker', () => {
    const t = seedTracker(fresh, T0);
    const before = [...t.shown];
    const beforeLast = t.lastShownAt;
    nextSystemLog(t, { lifetimeMe: 1e9, createdAt: T0 }, T0 + minGapMs);
    expect([...t.shown]).toEqual(before);
    expect(t.lastShownAt).toBe(beforeLast);
  });

  it('honours a custom gap', () => {
    const t = seedTracker(fresh, T0);
    const ahead = { lifetimeMe: 1e9, createdAt: T0 };
    expect(nextSystemLog(t, ahead, T0 + 10, { minGapMs: 10 })).not.toBeNull();
    expect(nextSystemLog(t, ahead, T0 + 9, { minGapMs: 10 })).toBeNull();
  });
});

describe('systemLogMessage', () => {
  it('uses the log key, SYS LOG title and the entry text', () => {
    const entry = SYSTEM_LOGS[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    const msg = systemLogMessage(entry);
    expect(msg.key).toBe(`log:${entry.id}`);
    expect(msg.title).toBe('SYS LOG');
    expect(msg.body).toBe(entry.text);
    expect(msg.tone).toBe('system');
    expect(msg.durationMs).toBe(SYSTEM_LOG_CONFIG.durationMs);
  });
});
