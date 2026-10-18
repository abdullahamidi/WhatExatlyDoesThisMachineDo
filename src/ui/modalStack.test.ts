import { describe, it, expect, vi, afterEach } from 'vitest';
import { createModalStack, bindEscapeToStack } from './modalStack';
import type { EscapeEventLike, EscapeTarget } from './modalStack';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createModalStack', () => {
  it('closeTop on an empty stack returns false', () => {
    const stack = createModalStack();
    expect(stack.closeTop()).toBe(false);
    expect(stack.isOpen()).toBe(false);
    expect(stack.topId()).toBeNull();
  });

  it('tracks order, size and top', () => {
    const stack = createModalStack();
    stack.push('a', () => {});
    stack.push('b', () => {});
    expect(stack.topId()).toBe('b');
    expect(stack.size()).toBe(2);
    expect(stack.has('a')).toBe(true);
    expect(stack.has('x')).toBe(false);
  });

  it('closeTop calls only the top close and removes it', () => {
    const stack = createModalStack();
    const closeA = vi.fn();
    const closeB = vi.fn();
    stack.push('a', closeA);
    stack.push('b', closeB);
    expect(stack.closeTop()).toBe(true);
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
    expect(stack.has('b')).toBe(false);
    expect(stack.topId()).toBe('a');
  });

  it('removes the top entry even when its close does not remove itself', () => {
    const stack = createModalStack();
    stack.push('a', () => {});
    stack.push('b', () => {});
    stack.closeTop();
    expect(stack.size()).toBe(1);
    expect(stack.has('b')).toBe(false);
  });

  it('keeps the stack consistent when close throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const stack = createModalStack();
    stack.push('a', () => {});
    stack.push('b', () => {
      throw new Error('boom');
    });
    expect(() => stack.closeTop()).not.toThrow();
    expect(stack.has('b')).toBe(false);
    expect(stack.topId()).toBe('a');
    expect(console.error).toHaveBeenCalled();
  });

  it('re-pushing an id moves it to the top and replaces its close', () => {
    const stack = createModalStack();
    const oldClose = vi.fn();
    const newClose = vi.fn();
    stack.push('a', oldClose);
    stack.push('b', () => {});
    stack.push('a', newClose);
    expect(stack.topId()).toBe('a');
    expect(stack.size()).toBe(2);
    stack.closeTop();
    expect(newClose).toHaveBeenCalledTimes(1);
    expect(oldClose).not.toHaveBeenCalled();
  });

  it('remove of an unknown id is a no-op', () => {
    const stack = createModalStack();
    stack.push('a', () => {});
    expect(() => stack.remove('zzz')).not.toThrow();
    expect(stack.size()).toBe(1);
  });

  it('remove drops the entry without calling close', () => {
    const stack = createModalStack();
    const close = vi.fn();
    stack.push('a', close);
    stack.remove('a');
    expect(close).not.toHaveBeenCalled();
    expect(stack.isOpen()).toBe(false);
  });

  it('remover is idempotent and a stale remover does nothing', () => {
    const stack = createModalStack();
    const removeFirst = stack.push('a', () => {});
    removeFirst();
    removeFirst();
    expect(stack.has('a')).toBe(false);

    const staleRemove = stack.push('a', () => {});
    stack.push('a', () => {});
    staleRemove();
    expect(stack.has('a')).toBe(true);
    expect(stack.size()).toBe(1);
  });

  it('onChange fires only when open state flips', () => {
    const stack = createModalStack();
    const seen: boolean[] = [];
    stack.onChange((open) => seen.push(open));
    stack.push('a', () => {});
    stack.push('b', () => {});
    stack.closeTop();
    stack.closeTop();
    expect(seen).toEqual([true, false]);
  });

  it('onChange unsubscribe works', () => {
    const stack = createModalStack();
    const fn = vi.fn();
    const off = stack.onChange(fn);
    off();
    stack.push('a', () => {});
    expect(fn).not.toHaveBeenCalled();
  });

  it('a throwing onChange listener does not break the stack', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const stack = createModalStack();
    stack.onChange(() => {
      throw new Error('listener');
    });
    expect(() => stack.push('a', () => {})).not.toThrow();
    expect(stack.isOpen()).toBe(true);
  });
});

interface FakeTarget extends EscapeTarget {
  listener: ((e: EscapeEventLike) => void) | null;
  capture: boolean | undefined;
  removed: boolean;
}

function fakeTarget(): FakeTarget {
  const target: FakeTarget = {
    listener: null,
    capture: undefined,
    removed: false,
    addEventListener(_type, listener, capture) {
      target.listener = listener;
      target.capture = capture;
    },
    removeEventListener(_type, listener, capture) {
      if (listener === target.listener && capture === target.capture) target.removed = true;
    },
  };
  return target;
}

function keyEvent(key: string): EscapeEventLike & { prevented: boolean; stopped: boolean } {
  const e = {
    key,
    prevented: false,
    stopped: false,
    preventDefault() {
      e.prevented = true;
    },
    stopPropagation() {
      e.stopped = true;
    },
  };
  return e;
}

describe('bindEscapeToStack', () => {
  it('Escape with an open stack closes the top and stops the event', () => {
    const stack = createModalStack();
    const close = vi.fn();
    stack.push('a', close);
    const target = fakeTarget();
    bindEscapeToStack(stack, target);
    const e = keyEvent('Escape');
    target.listener?.(e);
    expect(close).toHaveBeenCalledTimes(1);
    expect(e.prevented).toBe(true);
    expect(e.stopped).toBe(true);
    expect(target.capture).toBe(true);
    expect(stack.isOpen()).toBe(false);
  });

  it('Escape with an empty stack does nothing', () => {
    const stack = createModalStack();
    const target = fakeTarget();
    bindEscapeToStack(stack, target);
    const e = keyEvent('Escape');
    target.listener?.(e);
    expect(e.prevented).toBe(false);
    expect(e.stopped).toBe(false);
  });

  it('other keys are ignored', () => {
    const stack = createModalStack();
    const close = vi.fn();
    stack.push('a', close);
    const target = fakeTarget();
    bindEscapeToStack(stack, target);
    const e = keyEvent('Enter');
    target.listener?.(e);
    expect(close).not.toHaveBeenCalled();
    expect(e.prevented).toBe(false);
    expect(stack.isOpen()).toBe(true);
  });

  it('disposer removes the same listener', () => {
    const stack = createModalStack();
    const target = fakeTarget();
    const dispose = bindEscapeToStack(stack, target);
    dispose();
    expect(target.removed).toBe(true);
  });

  it('two stacked dialogs need two Escape presses', () => {
    const stack = createModalStack();
    const closeA = vi.fn();
    const closeB = vi.fn();
    stack.push('a', closeA);
    stack.push('b', closeB);
    const target = fakeTarget();
    bindEscapeToStack(stack, target);
    target.listener?.(keyEvent('Escape'));
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
    target.listener?.(keyEvent('Escape'));
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(stack.isOpen()).toBe(false);
  });
});
