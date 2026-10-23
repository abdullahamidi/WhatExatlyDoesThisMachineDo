import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriodicRefresh } from './systemMenu';
import type { IntervalTimers } from './systemMenu';
import { MENU_REFRESH_MS } from '../data/systemMenu';

// Fake timers only: the refresh loop is driven through the injected timer pair (no DOM, no real waits).
const fakeTimers: IntervalTimers<ReturnType<typeof setInterval>> = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle),
};

describe('SYSTEM menu panel refresh loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('refresh period is 1 s', () => {
    expect(MENU_REFRESH_MS).toBe(1000);
  });

  it('ticks once per MENU_REFRESH_MS while started (3 s -> 3 refreshes)', () => {
    const tick = vi.fn();
    const loop = createPeriodicRefresh(tick, MENU_REFRESH_MS, fakeTimers);
    loop.start();
    expect(loop.running()).toBe(true);

    vi.advanceTimersByTime(3 * MENU_REFRESH_MS);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('stops ticking after stop (close) and leaves no timer behind', () => {
    const tick = vi.fn();
    const loop = createPeriodicRefresh(tick, MENU_REFRESH_MS, fakeTimers);
    loop.start();
    vi.advanceTimersByTime(3 * MENU_REFRESH_MS);
    expect(tick).toHaveBeenCalledTimes(3);

    loop.stop();
    expect(loop.running()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5 * MENU_REFRESH_MS);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('no leak after destroy: a started loop stopped by destroy keeps no timer', () => {
    const tick = vi.fn();
    const loop = createPeriodicRefresh(tick, MENU_REFRESH_MS, fakeTimers);
    loop.start();
    expect(vi.getTimerCount()).toBe(1);

    loop.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10 * MENU_REFRESH_MS);
    expect(tick).not.toHaveBeenCalled();
  });

  it('start while running does not add a second timer', () => {
    const tick = vi.fn();
    const loop = createPeriodicRefresh(tick, MENU_REFRESH_MS, fakeTimers);
    loop.start();
    loop.start();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(MENU_REFRESH_MS);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('stop while stopped is a no-op', () => {
    const tick = vi.fn();
    const loop = createPeriodicRefresh(tick, MENU_REFRESH_MS, fakeTimers);
    expect(() => loop.stop()).not.toThrow();
    loop.start();
    loop.stop();
    expect(() => loop.stop()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts after a stop (reopen the menu) with a fresh period', () => {
    const tick = vi.fn();
    const loop = createPeriodicRefresh(tick, MENU_REFRESH_MS, fakeTimers);
    loop.start();
    vi.advanceTimersByTime(MENU_REFRESH_MS / 2);
    loop.stop();

    loop.start();
    vi.advanceTimersByTime(2 * MENU_REFRESH_MS);
    expect(tick).toHaveBeenCalledTimes(2);
    loop.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
