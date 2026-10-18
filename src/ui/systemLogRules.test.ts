import { describe, it, expect } from 'vitest';
import { nextSystemLog, seedTracker, systemLogMessage } from './systemLogRules';
import type { SystemLogTracker } from './systemLogRules';
import { INSTALL_LINES, FIRST_CLICK_MESSAGE } from '../data/notifications';
import { SYSTEM_LOGS, SYSTEM_LOG_CONFIG } from '../data/systemLogs';
import { TECH_IDS } from '../data/types';
import type { ResourceMap } from '../data/types';

const T0 = 1_000_000_000;

// Lifetime map with every resource 0 except the overrides.
const lifetimeOf = (overrides: Partial<ResourceMap> = {}): ResourceMap => ({
  me: 0,
  ee: 0,
  pr: 0,
  rs: 0,
  xf: 0,
  ...overrides,
});

// Log state at createdAt with the given lifetime overrides.
const logState = (createdAt: number, overrides: Partial<ResourceMap> = {}) => ({
  lifetime: lifetimeOf(overrides),
  createdAt,
});

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

  it('has positive thresholds in increasing order per trigger kind (lifetime per resource)', () => {
    const last: Record<string, number> = {};
    for (const entry of SYSTEM_LOGS) {
      const { trigger } = entry;
      const key = trigger.kind === 'lifetime' ? `lifetime:${trigger.res}` : trigger.kind;
      const { atLeast } = trigger;
      expect(atLeast).toBeGreaterThan(0);
      expect(atLeast).toBeGreaterThanOrEqual(last[key] ?? 0);
      last[key] = atLeast;
    }
  });
});

describe('seedTracker', () => {
  it('marks already-met entries as shown and sets lastShownAt', () => {
    const state = logState(T0);
    const tracker = seedTracker(state, T0);
    expect(tracker.shown.size).toBe(0);
    expect(tracker.lastShownAt).toBe(T0);

    const later = seedTracker(logState(T0, { me: 1e9 }), T0 + 1e9);
    expect(later.shown.size).toBe(SYSTEM_LOGS.length);
    expect(later.lastShownAt).toBe(T0 + 1e9);
  });

  it('never marks a lifetime-ME entry from non-ME lifetime alone', () => {
    const onlyEe = logState(T0, { ee: 1e12, pr: 1e12, rs: 1e12, xf: 1e12 });
    const tracker = seedTracker(onlyEe, T0);
    const meIds = SYSTEM_LOGS.filter((e) => e.trigger.kind === 'lifetime' && e.trigger.res === 'me').map((e) => e.id);
    expect(meIds.length).toBeGreaterThan(0);
    for (const id of meIds) expect(tracker.shown.has(id)).toBe(false);
    expect(tracker.shown.size).toBe(0);
  });
});

describe('nextSystemLog', () => {
  const fresh = logState(T0);
  const minGapMs = SYSTEM_LOG_CONFIG.minGapMs;

  it('returns null inside the minimum gap', () => {
    const t = seedTracker(fresh, T0);
    const ahead = logState(T0, { me: 1e9 });
    expect(nextSystemLog(t, ahead, T0 + minGapMs - 1)).toBeNull();
  });

  it('returns exactly one eligible entry after the gap, in table order', () => {
    const t = seedTracker(fresh, T0);
    const now = T0 + minGapMs;
    const ahead = logState(T0, { me: 1e9 });
    const result = nextSystemLog(t, ahead, now);
    expect(result).not.toBeNull();
    expect(result?.entry).toBe(SYSTEM_LOGS[0]);
    expect(result?.tracker.shown.has(SYSTEM_LOGS[0]?.id ?? '')).toBe(true);
    expect(result?.tracker.lastShownAt).toBe(now);
  });

  it('returns null when nothing is eligible', () => {
    const t = seedTracker(fresh, T0);
    // Save created just now: no playtime trigger met, no ME earned.
    const brandNew = logState(T0 + minGapMs);
    expect(nextSystemLog(t, brandNew, T0 + minGapMs)).toBeNull();
  });

  it('never repeats an entry over 50 calls spaced by the gap', () => {
    const ahead = logState(T0, { me: 1e9 });
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
    nextSystemLog(t, logState(T0, { me: 1e9 }), T0 + minGapMs);
    expect([...t.shown]).toEqual(before);
    expect(t.lastShownAt).toBe(beforeLast);
  });

  it('honours a custom gap', () => {
    const t = seedTracker(fresh, T0);
    const ahead = logState(T0, { me: 1e9 });
    expect(nextSystemLog(t, ahead, T0 + 10, { minGapMs: 10 })).not.toBeNull();
    expect(nextSystemLog(t, ahead, T0 + 9, { minGapMs: 10 })).toBeNull();
  });

  it('does not fire a lifetime-ME entry when only ee lifetime is large', () => {
    const t = seedTracker(fresh, T0);
    const onlyEe = logState(T0, { ee: 1e12 });
    const result = nextSystemLog(t, onlyEe, T0 + minGapMs);
    // Only playtime entries can fire here; no ME-lifetime entry may be picked.
    if (result !== null) {
      expect(result.entry.trigger.kind).toBe('playSeconds');
    }
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
