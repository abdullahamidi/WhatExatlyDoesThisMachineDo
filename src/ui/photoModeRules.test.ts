import { describe, it, expect } from 'vitest';
import { canEnterPhoto, photoKeyAction, shouldRestoreFocus } from './photoModeRules';
import type { EndingPhase } from '../data/types';

describe('photoKeyAction pan', () => {
  it.each([
    ['ArrowLeft', -1, 0],
    ['ArrowRight', 1, 0],
    ['ArrowUp', 0, -1],
    ['ArrowDown', 0, 1],
  ] as const)('maps %j to pan (%s, %s)', (key, dx, dy) => {
    expect(photoKeyAction(key)).toEqual({ kind: 'pan', dx, dy });
  });
});

describe('photoKeyAction zoom', () => {
  it.each(['+', '='])('maps %j to zoom in (1)', (key) => {
    expect(photoKeyAction(key)).toEqual({ kind: 'zoom', dir: 1 });
  });

  it.each(['-', '_'])('maps %j to zoom out (-1)', (key) => {
    expect(photoKeyAction(key)).toEqual({ kind: 'zoom', dir: -1 });
  });
});

describe('photoKeyAction unrelated keys', () => {
  it.each(['a', ' ', 'Escape', 'Enter', '', 'Shift', 'w', '0'])('returns null for %j', (key) => {
    expect(photoKeyAction(key)).toBeNull();
  });
});

describe('canEnterPhoto', () => {
  const phases: EndingPhase[] = ['none', 'sequence', 'choice', 'postgame'];
  const cases: [EndingPhase, boolean, boolean, boolean][] = [];
  for (const phase of phases) {
    for (const modalOpen of [false, true]) {
      for (const force of [false, true]) {
        const expected = !modalOpen && (phase === 'postgame' || (force && phase === 'none'));
        cases.push([phase, modalOpen, force, expected]);
      }
    }
  }

  it('has 16 phase x modal x force cases', () => {
    expect(cases).toHaveLength(16);
  });

  it.each(cases)('phase=%s modalOpen=%s force=%s -> %s', (phase, modalOpen, force, expected) => {
    expect(canEnterPhoto(phase, modalOpen, force)).toBe(expected);
  });

  it('is true only for postgame without a modal, and for none with force', () => {
    const truthy = cases.filter(([, , , expected]) => expected).map(([phase, modalOpen, force]) => ({ phase, modalOpen, force }));
    expect(truthy).toEqual([
      { phase: 'none', modalOpen: false, force: true },
      { phase: 'postgame', modalOpen: false, force: false },
      { phase: 'postgame', modalOpen: false, force: true },
    ]);
  });

  it('never enters during sequence or choice, even when forced', () => {
    expect(canEnterPhoto('sequence', false, true)).toBe(false);
    expect(canEnterPhoto('choice', false, true)).toBe(false);
  });
});

describe('shouldRestoreFocus', () => {
  it('restores when focus is on the exit chip', () => {
    expect(shouldRestoreFocus('chip')).toBe(true);
  });

  it('restores when nothing holds focus', () => {
    expect(shouldRestoreFocus('none')).toBe(true);
  });

  it('keeps focus when another modal took it', () => {
    expect(shouldRestoreFocus('other')).toBe(false);
  });
});
