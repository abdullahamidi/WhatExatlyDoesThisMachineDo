import { describe, it, expect } from 'vitest';
import { resolveHotkey, wrapFocusIndex, type HotkeyEventLike, type HotkeyTargetKind } from './hotkeyRules';

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
