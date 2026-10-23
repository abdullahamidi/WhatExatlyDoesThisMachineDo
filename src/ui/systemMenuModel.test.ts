import { describe, it, expect } from 'vitest';
import { reduceReset, muteLabel, resetLabel, saveFeedbackLabel, nextTab, clampTab, leavingTab, newCycleRow, tabIndexFor, shellRows, demoEndingRow, prestigeUiVisible, nextVisibleTab } from './systemMenuModel';
import type { ResetState } from './systemMenuModel';
import { SYSTEM_MENU_CONFIG } from '../data/systemMenu';
import { FINALE_CHOICE } from '../data/finale';

const IDLE: ResetState = { stage: 'idle' };
const ARM = SYSTEM_MENU_CONFIG.resetArmMs;

describe('reduceReset', () => {
  it('first press arms without executing', () => {
    const r = reduceReset(IDLE, { type: 'press', nowMs: 1000 });
    expect(r).toEqual({ state: { stage: 'armed', armedAt: 1000 }, execute: false });
  });

  it('confirming press within the window executes and returns to idle', () => {
    const armed: ResetState = { stage: 'armed', armedAt: 1000 };
    const r = reduceReset(armed, { type: 'press', nowMs: 2000 });
    expect(r.execute).toBe(true);
    expect(r.state).toEqual(IDLE);
  });

  it('tick after expiry returns to idle without executing', () => {
    const armed: ResetState = { stage: 'armed', armedAt: 1000 };
    const r = reduceReset(armed, { type: 'tick', nowMs: 1000 + ARM });
    expect(r).toEqual({ state: IDLE, execute: false });
  });

  it('tick before expiry keeps the armed state', () => {
    const armed: ResetState = { stage: 'armed', armedAt: 1000 };
    const r = reduceReset(armed, { type: 'tick', nowMs: 1000 + ARM - 1 });
    expect(r.state).toEqual(armed);
    expect(r.execute).toBe(false);
  });

  it('cancel disarms without executing', () => {
    const armed: ResetState = { stage: 'armed', armedAt: 1000 };
    expect(reduceReset(armed, { type: 'cancel', nowMs: 1500 })).toEqual({ state: IDLE, execute: false });
  });

  it('idle with tick or cancel stays idle without executing', () => {
    expect(reduceReset(IDLE, { type: 'tick', nowMs: 5 })).toEqual({ state: IDLE, execute: false });
    expect(reduceReset(IDLE, { type: 'cancel', nowMs: 5 })).toEqual({ state: IDLE, execute: false });
  });

  it('press after expiry re-arms without executing', () => {
    const armed: ResetState = { stage: 'armed', armedAt: 1000 };
    const r = reduceReset(armed, { type: 'press', nowMs: 1000 + ARM + 10 });
    expect(r).toEqual({ state: { stage: 'armed', armedAt: 1000 + ARM + 10 }, execute: false });
  });

  it('honours a custom armMs', () => {
    const armed: ResetState = { stage: 'armed', armedAt: 0 };
    expect(reduceReset(armed, { type: 'press', nowMs: 99 }, 100).execute).toBe(true);
    expect(reduceReset(armed, { type: 'press', nowMs: 100 }, 100).execute).toBe(false);
    expect(reduceReset(armed, { type: 'tick', nowMs: 100 }, 100).state).toEqual(IDLE);
  });

  it('execute is true only for the confirming press', () => {
    const events = [
      { type: 'tick' as const, nowMs: 0 },
      { type: 'cancel' as const, nowMs: 0 },
      { type: 'press' as const, nowMs: 0 },
      { type: 'press' as const, nowMs: ARM + 1 },
      { type: 'tick' as const, nowMs: ARM * 3 },
    ];
    for (const ev of events) {
      expect(reduceReset(IDLE, ev).execute).toBe(false);
    }
    const armed: ResetState = { stage: 'armed', armedAt: 0 };
    expect(reduceReset(armed, { type: 'tick', nowMs: 1 }).execute).toBe(false);
    expect(reduceReset(armed, { type: 'cancel', nowMs: 1 }).execute).toBe(false);
  });

  it('does not mutate the input state', () => {
    const armed: ResetState = { stage: 'armed', armedAt: 1000 };
    const snapshot = { ...armed };
    reduceReset(armed, { type: 'press', nowMs: 1000 + ARM + 1 });
    reduceReset(armed, { type: 'tick', nowMs: 1000 + ARM + 1 });
    expect(armed).toEqual(snapshot);
  });
});

describe('labels', () => {
  it('uses the exact strings', () => {
    expect(muteLabel(false)).toBe('AUDIO: ON');
    expect(muteLabel(true)).toBe('AUDIO: OFF');
    expect(resetLabel(IDLE)).toBe('RESET PROGRESS');
    expect(resetLabel({ stage: 'armed', armedAt: 0 })).toBe('CONFIRM: ERASE ALL?');
    expect(saveFeedbackLabel(true)).toBe('STATE WRITTEN');
    expect(saveFeedbackLabel(false)).toBe('WRITE FAILED');
  });
});

describe('nextTab', () => {
  it('moves right and left by one', () => {
    expect(nextTab(0, 4, 'ArrowRight')).toBe(1);
    expect(nextTab(2, 4, 'ArrowRight')).toBe(3);
    expect(nextTab(3, 4, 'ArrowLeft')).toBe(2);
  });

  it('wraps at both ends', () => {
    expect(nextTab(3, 4, 'ArrowRight')).toBe(0);
    expect(nextTab(0, 4, 'ArrowLeft')).toBe(3);
  });

  it('Home goes to the first tab and End to the last', () => {
    expect(nextTab(2, 4, 'Home')).toBe(0);
    expect(nextTab(1, 4, 'End')).toBe(3);
    expect(nextTab(0, 4, 'Home')).toBe(0);
    expect(nextTab(3, 4, 'End')).toBe(3);
  });

  it('a single tab stays on itself for every key', () => {
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End'] as const) {
      expect(nextTab(0, 1, key)).toBe(0);
    }
  });

  it('no tabs returns 0', () => {
    expect(nextTab(0, 0, 'ArrowRight')).toBe(0);
    expect(nextTab(0, 0, 'End')).toBe(0);
  });

  it('clamps an out-of-range current index before moving', () => {
    expect(nextTab(9, 4, 'ArrowRight')).toBe(0);
    expect(nextTab(-3, 4, 'ArrowLeft')).toBe(3);
    expect(nextTab(Number.NaN, 4, 'ArrowRight')).toBe(1);
  });
});

describe('clampTab', () => {
  it('keeps in-range indexes', () => {
    expect(clampTab(0, 3)).toBe(0);
    expect(clampTab(2, 3)).toBe(2);
  });

  it('clamps below 0 and above count - 1', () => {
    expect(clampTab(-1, 3)).toBe(0);
    expect(clampTab(3, 3)).toBe(2);
    expect(clampTab(100, 3)).toBe(2);
  });

  it('non-finite index and empty tab lists give 0', () => {
    expect(clampTab(Number.NaN, 3)).toBe(0);
    expect(clampTab(Number.POSITIVE_INFINITY, 3)).toBe(0);
    expect(clampTab(5, 0)).toBe(0);
  });

  it('single tab always 0', () => {
    expect(clampTab(0, 1)).toBe(0);
    expect(clampTab(7, 1)).toBe(0);
  });
});

describe('leavingTab', () => {
  it('returns the tab being left when the selection moves', () => {
    expect(leavingTab(4, 0)).toBe(4);
    expect(leavingTab(0, 3)).toBe(0);
  });

  it('returns null when the selection stays on the same tab', () => {
    expect(leavingTab(2, 2)).toBeNull();
    expect(leavingTab(0, 0)).toBeNull();
  });
});

describe('tabIndexFor', () => {
  const TABS = ['system', 'settings', 'stats'];

  it('returns the index of a known tab id', () => {
    expect(tabIndexFor(TABS, 'settings')).toBe(1);
    expect(tabIndexFor(TABS, 'stats')).toBe(2);
    expect(tabIndexFor(TABS, 'system')).toBe(0);
  });

  it('unknown id, undefined id and an empty list give 0', () => {
    expect(tabIndexFor(TABS, 'nope')).toBe(0);
    expect(tabIndexFor(TABS, undefined)).toBe(0);
    expect(tabIndexFor([], 'settings')).toBe(0);
    expect(tabIndexFor([], undefined)).toBe(0);
  });
});

describe('shellRows', () => {
  it('maps hasCredits to credits and canQuit to quit, all four combinations', () => {
    expect(shellRows({ hasCredits: false, canQuit: false })).toEqual({ credits: false, quit: false });
    expect(shellRows({ hasCredits: true, canQuit: false })).toEqual({ credits: true, quit: false });
    expect(shellRows({ hasCredits: false, canQuit: true })).toEqual({ credits: false, quit: true });
    expect(shellRows({ hasCredits: true, canQuit: true })).toEqual({ credits: true, quit: true });
  });
});

describe('demoEndingRow', () => {
  it('shows only when available (demo edition) and reached (cap tech owned), all four combinations', () => {
    expect(demoEndingRow({ available: false, reached: false })).toEqual({ visible: false });
    expect(demoEndingRow({ available: false, reached: true })).toEqual({ visible: false });
    expect(demoEndingRow({ available: true, reached: false })).toEqual({ visible: false });
    expect(demoEndingRow({ available: true, reached: true })).toEqual({ visible: true });
  });
});

describe('newCycleRow', () => {
  it('is invisible in none, sequence and choice', () => {
    for (const phase of ['none', 'sequence', 'choice'] as const) {
      expect(newCycleRow(phase, 'blocked').visible).toBe(false);
      expect(newCycleRow(phase, null).visible).toBe(false);
    }
  });

  it('postgame with a reason is visible, disabled, and carries the reason', () => {
    const row = newCycleRow('postgame', FINALE_CHOICE.cycleStubReason);
    expect(row).toEqual({
      visible: true,
      enabled: false,
      label: 'BEGIN A NEW CYCLE',
      reason: 'Cycle 0043 is still calibrating.',
    });
  });

  it('postgame without a reason is visible and enabled with an empty reason', () => {
    expect(newCycleRow('postgame', null)).toEqual({
      visible: true,
      enabled: true,
      label: FINALE_CHOICE.cycle.label,
      reason: '',
    });
  });
});

describe('prestigeUiVisible', () => {
  it('shows only once prestige matters (cycle > 1, choice, postgame)', () => {
    expect(prestigeUiVisible('none', 1)).toBe(false);
    expect(prestigeUiVisible('sequence', 1)).toBe(false);
    expect(prestigeUiVisible('choice', 1)).toBe(true);
    expect(prestigeUiVisible('postgame', 1)).toBe(true);
    expect(prestigeUiVisible('none', 2)).toBe(true);
  });
});

describe('nextVisibleTab', () => {
  const VIS = [true, true, true, false, true];

  it('arrows step over hidden tabs and wrap', () => {
    expect(nextVisibleTab(2, VIS, 'ArrowRight')).toBe(4);
    expect(nextVisibleTab(4, VIS, 'ArrowRight')).toBe(0);
    expect(nextVisibleTab(0, VIS, 'ArrowLeft')).toBe(4);
    expect(nextVisibleTab(4, VIS, 'ArrowLeft')).toBe(2);
  });

  it('Home and End go to the first and last visible tab', () => {
    expect(nextVisibleTab(2, VIS, 'Home')).toBe(0);
    expect(nextVisibleTab(0, VIS, 'End')).toBe(4);
  });

  it('a hidden current index is clamped before moving', () => {
    expect(nextVisibleTab(3, VIS, 'ArrowRight')).toBe(4);
    expect(nextVisibleTab(9, VIS, 'ArrowRight')).toBe(0);
  });

  it('only one visible tab maps to itself for every key', () => {
    const one = [false, true, false];
    expect(nextVisibleTab(1, one, 'ArrowRight')).toBe(1);
    expect(nextVisibleTab(1, one, 'ArrowLeft')).toBe(1);
    expect(nextVisibleTab(1, one, 'Home')).toBe(1);
    expect(nextVisibleTab(1, one, 'End')).toBe(1);
  });

  it('no visible tab (or no tabs) gives 0 for every key', () => {
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End'] as const) {
      expect(nextVisibleTab(1, [false, false], key)).toBe(0);
      expect(nextVisibleTab(0, [], key)).toBe(0);
    }
  });

  it('Home skips a hidden first tab', () => {
    expect(nextVisibleTab(2, [true, false, true], 'Home')).toBe(0);
    expect(nextVisibleTab(0, [false, true, true], 'Home')).toBe(1);
  });
});
