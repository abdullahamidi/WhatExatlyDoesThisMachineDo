import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { stepOutputTick, outputTickLine, outputTickAlpha } from './outputTick';
import type { ResourceMap } from '../../data/types';
import { setRevealed } from '../../ui/revealRules';

// WP25 machine output popups (C5): the timer and the popup text. The cadence must give one pop per period no matter
// how the frames are cut, and the text shows only the frontier resource.
const PERIOD_MS = 3000;

function perSecond(patch: Partial<ResourceMap>): ResourceMap {
  return { me: 0, ee: 0, pr: 0, rs: 0, xf: 0, ...patch };
}

describe('stepOutputTick', () => {
  it('carries the remainder: dt 1000 three times is due on the third call with 0 left', () => {
    let s = stepOutputTick(0, 1000, PERIOD_MS);
    expect(s).toEqual({ accMs: 1000, due: false });
    s = stepOutputTick(s.accMs, 1000, PERIOD_MS);
    expect(s).toEqual({ accMs: 2000, due: false });
    s = stepOutputTick(s.accMs, 1000, PERIOD_MS);
    expect(s).toEqual({ accMs: 0, due: true });
  });

  it('a 4000 ms frame from 0 is due with 1000 ms carried over', () => {
    expect(stepOutputTick(0, 4000, PERIOD_MS)).toEqual({ accMs: 1000, due: true });
  });

  it('a 10000 ms frame from 0 is due once with 1000 ms carried over', () => {
    expect(stepOutputTick(0, 10000, PERIOD_MS)).toEqual({ accMs: 1000, due: true });
  });

  it('exactly one period is due with 0 left', () => {
    expect(stepOutputTick(2000, 1000, PERIOD_MS)).toEqual({ accMs: 0, due: true });
  });

  it('100 calls of dt 100 give exactly 3 due pops over 10 s', () => {
    let acc = 0;
    let dues = 0;
    for (let i = 0; i < 100; i++) {
      const s = stepOutputTick(acc, 100, PERIOD_MS);
      acc = s.accMs;
      if (s.due) dues++;
    }
    expect(dues).toBe(3);
  });

  it('counts zero, NaN and negative dt as 0', () => {
    expect(stepOutputTick(500, 0, PERIOD_MS)).toEqual({ accMs: 500, due: false });
    expect(stepOutputTick(500, Number.NaN, PERIOD_MS)).toEqual({ accMs: 500, due: false });
    expect(stepOutputTick(500, -800, PERIOD_MS)).toEqual({ accMs: 500, due: false });
  });

  it('counts a NaN, infinite or negative accMs as 0', () => {
    expect(stepOutputTick(Number.NaN, 1000, PERIOD_MS)).toEqual({ accMs: 1000, due: false });
    expect(stepOutputTick(Number.POSITIVE_INFINITY, 1000, PERIOD_MS)).toEqual({ accMs: 1000, due: false });
    expect(stepOutputTick(-2000, 1000, PERIOD_MS)).toEqual({ accMs: 1000, due: false });
  });

  it('a bad period (not finite or <= 0) gives { accMs: 0, due: false }', () => {
    for (const p of [0, -3000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(stepOutputTick(2500, 1000, p)).toEqual({ accMs: 0, due: false });
    }
  });
});

describe('outputTickLine', () => {
  afterEach(() => {
    setRevealed(false);
  });

  it('era I shows the ME gain over the period: 10 ME/s over 3 s is +30 ME', () => {
    expect(outputTickLine(perSecond({ me: 10 }), 1, 3)).toEqual({ res: 'me', text: '+30 ME' });
  });

  it('era II reads ee only, even when me is huge: 1234.5 EE/s over 3 s is +3.7K EE', () => {
    expect(outputTickLine(perSecond({ me: 1e12, ee: 1234.5 }), 2, 3)).toEqual({ res: 'ee', text: '+3.7K EE' });
  });

  it('shows only the frontier: era I ignores a passive ee gain', () => {
    expect(outputTickLine(perSecond({ me: 0, ee: 50 }), 1, 3)).toBeNull();
  });

  it('is null for a zero, NaN, negative or infinite gain', () => {
    expect(outputTickLine(perSecond({ me: 0 }), 1, 3)).toBeNull();
    expect(outputTickLine(perSecond({ me: Number.NaN }), 1, 3)).toBeNull();
    expect(outputTickLine(perSecond({ me: -5 }), 1, 3)).toBeNull();
    expect(outputTickLine(perSecond({ me: Number.POSITIVE_INFINITY }), 1, 3)).toBeNull();
  });

  it('is null when the gain reads as 0 (0.01 ME/s is below 0.1 and not shown)', () => {
    expect(outputTickLine(perSecond({ me: 0.01 }), 1, 3)).toBeNull();
  });

  it('era V reads ??? before the reveal and RF after setRevealed(true)', () => {
    expect(outputTickLine(perSecond({ xf: 5 }), 5, 3)).toEqual({ res: 'xf', text: '+15 ???' });
    setRevealed(true);
    expect(outputTickLine(perSecond({ xf: 5 }), 5, 3)).toEqual({ res: 'xf', text: '+15 RF' });
  });
});

describe('outputTickAlpha', () => {
  it('holds full alpha up to and including holdMs', () => {
    expect(outputTickAlpha(0, 1000, 2400)).toBe(1);
    expect(outputTickAlpha(1000, 1000, 2400)).toBe(1);
  });

  it('fades linearly from holdMs to 0 at fadeMs', () => {
    expect(outputTickAlpha(1700, 1000, 2400)).toBeCloseTo(0.5, 10);
    expect(outputTickAlpha(2400, 1000, 2400)).toBe(0);
    expect(outputTickAlpha(3000, 1000, 2400)).toBe(0);
  });

  it('gives 0 for a NaN age', () => {
    expect(outputTickAlpha(Number.NaN, 1000, 2400)).toBe(0);
  });

  it('with fadeMs <= holdMs it is 1 up to holdMs and 0 after it', () => {
    expect(outputTickAlpha(1500, 1000, 1000)).toBe(0);
    expect(outputTickAlpha(500, 1000, 1000)).toBe(1);
  });
});

describe('outputTick.ts purity', () => {
  it('has no Phaser import (pure maths)', () => {
    const src = readFileSync(new URL('./outputTick.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from ['"]phaser['"]/);
  });
});
