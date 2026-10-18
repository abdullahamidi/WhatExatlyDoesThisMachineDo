import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSignal } from './signal';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createSignal', () => {
  it('delivers the payload to every listener', () => {
    const signal = createSignal<number>();
    const a = vi.fn();
    const b = vi.fn();
    signal.on(a);
    signal.on(b);
    signal.emit(42);
    expect(a).toHaveBeenCalledWith(42);
    expect(b).toHaveBeenCalledWith(42);
  });

  it('stops delivery after unsubscribe, and a second unsubscribe is harmless', () => {
    const signal = createSignal<string>();
    const fn = vi.fn();
    const off = signal.on(fn);
    off();
    off();
    signal.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps the same function subscribed twice independently', () => {
    const signal = createSignal<number>();
    const fn = vi.fn();
    const offA = signal.on(fn);
    signal.on(fn);
    offA();
    signal.emit(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('skips a throwing listener, logs it, and does not throw from emit', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const signal = createSignal<number>();
    const after = vi.fn();
    signal.on(() => {
      throw new Error('boom');
    });
    signal.on(after);
    expect(() => signal.emit(7)).not.toThrow();
    expect(after).toHaveBeenCalledWith(7);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('supports a void signal emitted with no argument', () => {
    const signal = createSignal();
    const fn = vi.fn();
    signal.on(fn);
    signal.emit();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call a listener added during emit for that emit', () => {
    const signal = createSignal<number>();
    const late = vi.fn();
    signal.on(() => {
      signal.on(late);
    });
    signal.emit(1);
    expect(late).not.toHaveBeenCalled();
    signal.emit(2);
    expect(late).toHaveBeenCalledWith(2);
  });
});
