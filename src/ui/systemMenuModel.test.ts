import { describe, it, expect } from 'vitest';
import { reduceReset, muteLabel, resetLabel, saveFeedbackLabel } from './systemMenuModel';
import type { ResetState } from './systemMenuModel';
import { SYSTEM_MENU_CONFIG } from '../data/systemMenu';

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
