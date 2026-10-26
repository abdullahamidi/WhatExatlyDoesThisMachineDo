import { describe, it, expect, afterEach, vi } from 'vitest';
import { nextSystemLog, seedTracker, systemLogMessage } from './systemLogRules';
import type { SystemLogTracker } from './systemLogRules';
import { INSTALL_LINES, FIRST_CLICK_MESSAGE } from '../data/notifications';
import { SYSTEM_LOGS, SYSTEM_LOG_CONFIG } from '../data/systemLogs';
import type { SystemLogEntry } from '../data/systemLogs';
import { TECH_IDS } from '../data/types';
import type { ResourceMap } from '../data/types';
import { GameSession, createInitialState } from '../simulation';
import { connectSystemLog } from './systemLog';
import type { SystemLogHooks } from './systemLog';
import type { Toasts } from './toasts';

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
  it('has 8 to 23 entries with unique ids', () => {
    expect(SYSTEM_LOGS.length).toBeGreaterThanOrEqual(8);
    expect(SYSTEM_LOGS.length).toBeLessThanOrEqual(23);
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

// WP23b optional machine logs (bible §5.4): 23 entries (WP25 adds manual-optional), the new slots pinned by table position, text and trigger.
describe('SYSTEM_LOGS WP23b slots', () => {
  const indexOf = (id: string): number => SYSTEM_LOGS.findIndex((e) => e.id === id);

  it('has 23 entries', () => {
    expect(SYSTEM_LOGS).toHaveLength(23);
  });

  // WP25 slot: manual-optional (lifetime EE 500K) sits between load-beneath and copper-memory.
  it('puts manual-optional between load-beneath and copper-memory (lifetime EE 500K)', () => {
    const i = indexOf('manual-optional');
    expect(i).toBeGreaterThan(0);
    expect(SYSTEM_LOGS[i - 1]?.id).toBe('load-beneath');
    expect(SYSTEM_LOGS[i + 1]?.id).toBe('copper-memory');
    expect(SYSTEM_LOGS[i]).toEqual({
      id: 'manual-optional',
      text: 'Manual operation no longer required. Still detected.',
      trigger: { kind: 'lifetime', res: 'ee', atLeast: 500000 },
    });
  });

  it('puts perimeter-umbrella directly before steam-rain (lifetime PR 100K)', () => {
    const i = indexOf('perimeter-umbrella');
    expect(i).toBeGreaterThan(0);
    expect(SYSTEM_LOGS[i + 1]?.id).toBe('steam-rain');
    expect(SYSTEM_LOGS[i]).toEqual({
      id: 'perimeter-umbrella',
      text: 'Umbrella detected. Precipitation: none.',
      trigger: { kind: 'lifetime', res: 'pr', atLeast: 100000 },
    });
  });

  it('puts perimeter-phase directly after signal-below (lifetime RS 5M)', () => {
    const i = indexOf('perimeter-phase');
    expect(i).toBeGreaterThan(0);
    expect(SYSTEM_LOGS[i - 1]?.id).toBe('signal-below');
    expect(SYSTEM_LOGS[i]).toEqual({
      id: 'perimeter-phase',
      text: 'Perimeter moving in phase. Not counted.',
      trigger: { kind: 'lifetime', res: 'rs', atLeast: 5000000 },
    });
  });
});

describe('seedTracker', () => {
  it('marks already-met entries as shown and sets lastShownAt', () => {
    const state = logState(T0);
    const tracker = seedTracker(state, T0);
    expect(tracker.shown.size).toBe(0);
    expect(tracker.lastShownAt).toBe(T0);

    const later = seedTracker(logState(T0, { me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9, xf: 1e9 }), T0 + 1e9);
    expect(later.shown.size).toBe(SYSTEM_LOGS.length);
    expect(later.lastShownAt).toBe(T0 + 1e9);
  });

  it('never marks a lifetime-ME entry from non-ME lifetime alone', () => {
    const onlyEe = logState(T0, { ee: 1e12, pr: 1e12, rs: 1e12, xf: 1e12 });
    const tracker = seedTracker(onlyEe, T0);
    const meIds = SYSTEM_LOGS.filter((e) => e.trigger.kind === 'lifetime' && e.trigger.res === 'me').map((e) => e.id);
    expect(meIds.length).toBeGreaterThan(0);
    for (const id of meIds) expect(tracker.shown.has(id)).toBe(false);
    const nonMeLifetime = SYSTEM_LOGS.filter(
      (e) => e.trigger.kind === 'lifetime' && ['ee', 'pr', 'rs', 'xf'].includes(e.trigger.res),
    );
    expect(tracker.shown.size).toBe(nonMeLifetime.length);
  });
});

describe('nextSystemLog', () => {
  const fresh = logState(T0);
  const minGapMs = SYSTEM_LOG_CONFIG.minGapMs;

  it('returns null inside the minimum gap', () => {
    const t = seedTracker(fresh, T0);
    const ahead = logState(T0, { me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9, xf: 1e9 });
    expect(nextSystemLog(t, ahead, T0 + minGapMs - 1)).toBeNull();
  });

  it('returns exactly one eligible entry after the gap, in table order', () => {
    const t = seedTracker(fresh, T0);
    const now = T0 + minGapMs;
    const ahead = logState(T0, { me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9, xf: 1e9 });
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
    const ahead = logState(T0, { me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9, xf: 1e9 });
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
    nextSystemLog(t, logState(T0, { me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9, xf: 1e9 }), T0 + minGapMs);
    expect([...t.shown]).toEqual(before);
    expect(t.lastShownAt).toBe(beforeLast);
  });

  it('honours a custom gap', () => {
    const t = seedTracker(fresh, T0);
    const ahead = logState(T0, { me: 1e9, ee: 1e9, pr: 1e9, rs: 1e9, xf: 1e9 });
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

  // Synthetic entry so the {cycle} tests do not depend on the real table text.
  const synthetic = (text: string): SystemLogEntry => ({ id: 't', text, trigger: { kind: 'playSeconds', atLeast: 0 } });

  it('replaces {cycle} with the live cycle digits', () => {
    const entry = synthetic('Cycle {cycle} nearly complete.');
    expect(systemLogMessage(entry, 1).body).toBe('Cycle 0042 nearly complete.');
    expect(systemLogMessage(entry, 2).body).toBe('Cycle 0043 nearly complete.');
  });

  it('keeps text without the token unchanged', () => {
    const entry = synthetic('Reading accepted.');
    expect(systemLogMessage(entry, 1).body).toBe('Reading accepted.');
    expect(systemLogMessage(entry, 5).body).toBe('Reading accepted.');
  });

  it('replaces every {cycle} token in one text', () => {
    expect(systemLogMessage(synthetic('Cycle {cycle} of {cycle}.'), 3).body).toBe('Cycle 0044 of 0044.');
  });

  it('defaults to cycle 1 when called with one argument', () => {
    expect(systemLogMessage(synthetic('Cycle {cycle}.')).body).toBe('Cycle 0042.');
  });
});

// connectSystemLog hooks (WP23a). Fake timers drive the poll, the onCleared timer and the window stub; Date is faked too.
describe('connectSystemLog hooks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // Session at T0 with zero lifetime: only playSeconds logs can fire. observer-count (120 s) is the first eligible entry,
  // and its first poll at minGapMs also clears the gap since the seed at T0.
  const FIRST_KEY = 'log:observer-count';
  const FIRST_ID = 'observer-count';
  const FIRST_SHOW_MS = SYSTEM_LOG_CONFIG.minGapMs;
  const POLL_MS = SYSTEM_LOG_CONFIG.checkIntervalMs;
  const LIFE_MS = SYSTEM_LOG_CONFIG.durationMs;

  interface Rig {
    events: string[];
    gate: { deferred: boolean };
    session: GameSession;
    dispose: () => void;
  }

  // Window timers resolve the global at call time, so the fake timers installed by useFakeTimers apply.
  function startRig(withHooks: boolean): Rig {
    vi.useFakeTimers({ now: T0 });
    vi.stubGlobal('window', {
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
      clearInterval: (handle: ReturnType<typeof setInterval>) => clearInterval(handle),
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
      clearTimeout: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
    });
    const events: string[] = [];
    const gate = { deferred: false };
    const toasts: Toasts = {
      show: (msg) => {
        events.push(`show:${msg.key}`);
      },
      clear: () => {},
      destroy: () => {},
    };
    const hooks: SystemLogHooks = withHooks
      ? {
          defer: () => gate.deferred,
          onShown: (id) => {
            events.push(`shown:${id}`);
          },
          onCleared: (id) => {
            events.push(`cleared:${id}`);
          },
        }
      : {};
    const session = new GameSession({ state: createInitialState(T0), now: () => Date.now() });
    const dispose = connectSystemLog(session, toasts, () => Date.now(), hooks);
    return { events, gate, session, dispose };
  }

  const clearedEvents = (rig: Rig): string[] => rig.events.filter((e) => e.startsWith('cleared:'));

  it('calls onShown with the id right after toasts.show', () => {
    const rig = startRig(true);
    vi.advanceTimersByTime(FIRST_SHOW_MS - POLL_MS);
    expect(rig.events).toEqual([]);
    vi.advanceTimersByTime(POLL_MS);
    expect(rig.events).toEqual([`show:${FIRST_KEY}`, `shown:${FIRST_ID}`]);
    rig.dispose();
  });

  it('calls onCleared exactly durationMs after the show, once', () => {
    const rig = startRig(true);
    vi.advanceTimersByTime(FIRST_SHOW_MS);
    expect(rig.events).toEqual([`show:${FIRST_KEY}`, `shown:${FIRST_ID}`]);
    vi.advanceTimersByTime(LIFE_MS - 1);
    expect(clearedEvents(rig)).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(clearedEvents(rig)).toEqual([`cleared:${FIRST_ID}`]);
    vi.advanceTimersByTime(LIFE_MS * 2);
    expect(clearedEvents(rig)).toEqual([`cleared:${FIRST_ID}`]);
    rig.dispose();
  });

  it('defer true postpones the log until defer returns false, then shows the same log', () => {
    const rig = startRig(true);
    rig.gate.deferred = true;
    // Polls at 120 s, 125 s and 130 s are all deferred; the tracker stays untouched.
    vi.advanceTimersByTime(FIRST_SHOW_MS + 2 * POLL_MS);
    expect(rig.events).toEqual([]);
    rig.gate.deferred = false;
    vi.advanceTimersByTime(POLL_MS);
    expect(rig.events).toEqual([`show:${FIRST_KEY}`, `shown:${FIRST_ID}`]);
    rig.dispose();
  });

  it('dispose cancels a pending onCleared and the poll', () => {
    const rig = startRig(true);
    vi.advanceTimersByTime(FIRST_SHOW_MS);
    expect(vi.getTimerCount()).toBe(2);
    rig.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(LIFE_MS * 2);
    expect(clearedEvents(rig)).toEqual([]);
    expect(rig.events).toEqual([`show:${FIRST_KEY}`, `shown:${FIRST_ID}`]);
  });

  it('a session reset cancels a pending onCleared', () => {
    const rig = startRig(true);
    vi.advanceTimersByTime(FIRST_SHOW_MS);
    rig.session.reset(Date.now());
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(LIFE_MS * 2);
    expect(clearedEvents(rig)).toEqual([]);
    rig.dispose();
  });

  it('without hooks it shows the same log and schedules no onCleared timer', () => {
    const rig = startRig(false);
    vi.advanceTimersByTime(FIRST_SHOW_MS);
    expect(rig.events).toEqual([`show:${FIRST_KEY}`]);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(LIFE_MS * 2);
    expect(rig.events).toEqual([`show:${FIRST_KEY}`]);
    rig.dispose();
  });
});
