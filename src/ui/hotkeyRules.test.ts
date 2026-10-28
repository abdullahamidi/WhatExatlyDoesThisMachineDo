import { describe, it, expect } from 'vitest';
import {
  pushTrap, removeTrap, resolveHotkey, topTrap, wrapFocusIndex, type HotkeyEventLike, type HotkeyTargetKind,
} from './hotkeyRules';

function ev(overrides: Partial<HotkeyEventLike> = {}): HotkeyEventLike {
  return {
    key: ' ',
    repeat: false,
    ctrl: false,
    meta: false,
    alt: false,
    targetKind: 'other',
    modalOpen: false,
    ...overrides,
  };
}

const FIRST = -Infinity;
const NOW = 5000;

describe('resolveHotkey crank', () => {
  it.each([' ', 'Enter'])('maps %j to crank on a plain first press', (key) => {
    expect(resolveHotkey(ev({ key }), FIRST, NOW)).toBe('crank');
  });

  it('ignores other keys', () => {
    expect(resolveHotkey(ev({ key: 'a' }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'Tab' }), FIRST, NOW)).toBeNull();
  });

  it('ignores held-key repeat', () => {
    expect(resolveHotkey(ev({ repeat: true }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'Enter', repeat: true }), FIRST, NOW)).toBeNull();
  });

  it.each([
    ['ctrl', { ctrl: true }],
    ['meta', { meta: true }],
    ['alt', { alt: true }],
  ])('ignores Space with %s held', (_name, mods) => {
    expect(resolveHotkey(ev(mods), FIRST, NOW)).toBeNull();
  });

  it.each<HotkeyTargetKind>(['editable', 'interactive'])('ignores Space and Enter on a %s target', (targetKind) => {
    expect(resolveHotkey(ev({ targetKind }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'Enter', targetKind }), FIRST, NOW)).toBeNull();
  });

  it('ignores the crank while a modal is open', () => {
    expect(resolveHotkey(ev({ modalOpen: true }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'Enter', modalOpen: true }), FIRST, NOW)).toBeNull();
  });

  it('allows the next crank at exactly 1000 / 15 ms and blocks 66 ms', () => {
    expect(resolveHotkey(ev(), 1000, 1066)).toBeNull();
    expect(resolveHotkey(ev(), 1000, 1067)).toBe('crank');
    expect(resolveHotkey(ev(), 1000, 1200)).toBe('crank');
  });

  it('treats a first press (lastCrankMs = -Infinity) as always allowed', () => {
    expect(resolveHotkey(ev(), FIRST, 0)).toBe('crank');
  });

  it('caps a steady 66 ms press cadence: every second press cranks (66 < 66.67 ms)', () => {
    let last = FIRST;
    let fired = 0;
    let presses = 0;
    for (let t = 0; t <= 660; t += 66) {
      presses += 1;
      const action = resolveHotkey(ev(), last, t);
      if (action === 'crank') {
        fired += 1;
        last = t;
      }
    }
    expect(presses).toBe(11);
    expect(fired).toBe(6);
  });
});

describe('resolveHotkey tech tree (t)', () => {
  const targets: HotkeyTargetKind[] = ['other', 'interactive'];

  it.each(['t', 'T'])('toggles the tree on %j in every non-editable state', (key) => {
    for (const targetKind of targets) {
      for (const modalOpen of [false, true]) {
        expect(resolveHotkey(ev({ key, targetKind, modalOpen }), FIRST, NOW)).toBe('techTree');
      }
    }
  });

  it('is ignored on an editable target (typing t in a text box)', () => {
    expect(resolveHotkey(ev({ key: 't', targetKind: 'editable' }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'T', targetKind: 'editable', modalOpen: true }), FIRST, NOW)).toBeNull();
  });

  it('ignores held-key repeat', () => {
    expect(resolveHotkey(ev({ key: 't', repeat: true }), FIRST, NOW)).toBeNull();
  });

  it('ignores t with a modifier', () => {
    expect(resolveHotkey(ev({ key: 't', ctrl: true }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 't', meta: true }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 't', alt: true }), FIRST, NOW)).toBeNull();
  });

  it('does not depend on the crank timing', () => {
    expect(resolveHotkey(ev({ key: 't' }), 4999, NOW)).toBe('techTree');
  });
});

describe('resolveHotkey fault (f)', () => {
  it.each(['f', 'F'])('clears a fault on %j in a plain state', (key) => {
    expect(resolveHotkey(ev({ key }), FIRST, NOW)).toBe('fault');
    expect(resolveHotkey(ev({ key, targetKind: 'other' }), FIRST, NOW)).toBe('fault');
  });

  it('works on an interactive target such as a focused button, like t', () => {
    expect(resolveHotkey(ev({ key: 'f', targetKind: 'interactive' }), FIRST, NOW)).toBe('fault');
    expect(resolveHotkey(ev({ key: 'F', targetKind: 'interactive' }), FIRST, NOW)).toBe('fault');
  });

  it.each([
    ['ctrl', { ctrl: true }],
    ['meta', { meta: true }],
    ['alt', { alt: true }],
  ])('ignores f with %s held', (_name, mods) => {
    expect(resolveHotkey(ev({ key: 'f', ...mods }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'F', ...mods }), FIRST, NOW)).toBeNull();
  });

  it('ignores held-key repeat', () => {
    expect(resolveHotkey(ev({ key: 'f', repeat: true }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'F', repeat: true }), FIRST, NOW)).toBeNull();
  });

  it('is blocked while a modal is open', () => {
    expect(resolveHotkey(ev({ key: 'f', modalOpen: true }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'F', modalOpen: true, targetKind: 'interactive' }), FIRST, NOW)).toBeNull();
  });

  it('is ignored on an editable target (typing f in a text box)', () => {
    expect(resolveHotkey(ev({ key: 'f', targetKind: 'editable' }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'F', targetKind: 'editable' }), FIRST, NOW)).toBeNull();
  });

  it('does not match F11 or F5 (the lower-cased key is f11 / f5, not f)', () => {
    expect(resolveHotkey(ev({ key: 'F11' }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'F5' }), FIRST, NOW)).toBeNull();
  });

  it('does not depend on the crank timing', () => {
    expect(resolveHotkey(ev({ key: 'f' }), 4999, NOW)).toBe('fault');
  });

  it('leaves Space (crank), t (tech tree) and Escape (menu) as before', () => {
    expect(resolveHotkey(ev({ key: ' ' }), FIRST, NOW)).toBe('crank');
    expect(resolveHotkey(ev({ key: 't' }), FIRST, NOW)).toBe('techTree');
    expect(resolveHotkey(ev({ key: 'Escape' }), FIRST, NOW)).toBe('menu');
  });
});

describe('resolveHotkey menu (Escape)', () => {
  it('opens the menu on Escape when no modal is open', () => {
    expect(resolveHotkey(ev({ key: 'Escape' }), FIRST, NOW)).toBe('menu');
    expect(resolveHotkey(ev({ key: 'Escape', targetKind: 'interactive' }), FIRST, NOW)).toBe('menu');
  });

  it('leaves Escape to the modal stack while a modal is open', () => {
    expect(resolveHotkey(ev({ key: 'Escape', modalOpen: true }), FIRST, NOW)).toBeNull();
  });

  it('ignores Escape repeat and Escape on an editable target', () => {
    expect(resolveHotkey(ev({ key: 'Escape', repeat: true }), FIRST, NOW)).toBeNull();
    expect(resolveHotkey(ev({ key: 'Escape', targetKind: 'editable' }), FIRST, NOW)).toBeNull();
  });

  it('ignores Escape with a modifier', () => {
    expect(resolveHotkey(ev({ key: 'Escape', ctrl: true }), FIRST, NOW)).toBeNull();
  });
});

describe('resolveHotkey unrelated keys', () => {
  it.each(['a', 'Shift', 'ArrowLeft', 'Tab', 'q'])('returns null for %j', (key) => {
    for (const targetKind of ['editable', 'interactive', 'other'] as const) {
      for (const modalOpen of [false, true]) {
        expect(resolveHotkey(ev({ key, targetKind, modalOpen }), FIRST, NOW)).toBeNull();
      }
    }
  });
});

describe('wrapFocusIndex', () => {
  it.each([
    [0, 3, false, 1],
    [1, 3, false, 2],
    [2, 3, false, 0],
    [2, 3, true, 1],
    [1, 3, true, 0],
    [0, 3, true, 2],
    [0, 1, false, 0],
    [0, 1, true, 0],
  ])('index %s of %s (backwards=%s) -> %s', (index, count, backwards, expected) => {
    expect(wrapFocusIndex(index, count, backwards)).toBe(expected);
  });

  it('returns -1 for an empty ring', () => {
    expect(wrapFocusIndex(0, 0, false)).toBe(-1);
    expect(wrapFocusIndex(-1, 0, true)).toBe(-1);
  });

  it('moves focus-outside (-1) to the first item forward and the last backwards', () => {
    expect(wrapFocusIndex(-1, 3, false)).toBe(0);
    expect(wrapFocusIndex(-1, 3, true)).toBe(2);
  });

  it('treats out-of-range and non-integer indexes like outside focus', () => {
    expect(wrapFocusIndex(7, 3, false)).toBe(0);
    expect(wrapFocusIndex(7, 3, true)).toBe(2);
    expect(wrapFocusIndex(Number.NaN, 3, false)).toBe(0);
    expect(wrapFocusIndex(0.5, 3, true)).toBe(2);
  });
});

describe('focus trap stack', () => {
  it('pushes onto the top: the last armed trap is the one that owns Tab', () => {
    let stack: string[] = [];
    stack = pushTrap(stack, 'finale');
    expect(topTrap(stack)).toBe('finale');
    stack = pushTrap(stack, 'confirm');
    expect(stack).toEqual(['finale', 'confirm']);
    expect(topTrap(stack)).toBe('confirm');
  });

  it('returns a new array and never mutates the input', () => {
    const before: readonly string[] = ['finale'];
    const after = pushTrap(before, 'confirm');
    expect(before).toEqual(['finale']);
    expect(after).not.toBe(before);
    const removed = removeTrap(after, 'finale');
    expect(after).toEqual(['finale', 'confirm']);
    expect(removed).toEqual(['confirm']);
  });

  it('re-pushing an armed trap moves it to the top without duplicating it', () => {
    const stack = pushTrap(pushTrap(['a', 'b'], 'a'), 'c');
    expect(pushTrap(stack, 'a')).toEqual(['b', 'c', 'a']);
  });

  it('removing the top hands Tab back to the trap below', () => {
    const stack = pushTrap(pushTrap(['menu'], 'confirm'), 'other');
    const afterTop = removeTrap(stack, 'other');
    expect(topTrap(afterTop)).toBe('confirm');
    expect(topTrap(removeTrap(afterTop, 'confirm'))).toBe('menu');
  });

  it('removing a middle trap keeps the order of the rest and leaves the top unchanged', () => {
    const stack = ['finale', 'menu', 'confirm'];
    const afterMiddle = removeTrap(stack, 'menu');
    expect(afterMiddle).toEqual(['finale', 'confirm']);
    expect(topTrap(afterMiddle)).toBe('confirm');
  });

  it('removing an absent trap is a no-op', () => {
    expect(removeTrap(['a', 'b'], 'zzz')).toEqual(['a', 'b']);
    expect(removeTrap<string>([], 'a')).toEqual([]);
  });

  it('an empty stack has no top', () => {
    expect(topTrap<string>([])).toBeNull();
  });

  it('identity, not value: two distinct trap tokens are separate entries', () => {
    const a = { name: 'x' };
    const b = { name: 'x' };
    const stack = pushTrap(pushTrap([], a), b);
    expect(stack).toHaveLength(2);
    expect(topTrap(removeTrap(stack, a))).toBe(b);
    expect(removeTrap(stack, { name: 'x' })).toHaveLength(2);
  });
});
