import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PART_TIER_FX } from '../../data/machineTiers';
import { tierBeatFrame } from './tierBeat';
import type { TierBeatFrame } from './tierBeat';

const SOURCE_URL = new URL('./tierBeat.ts', import.meta.url);

/** The frame with nothing lit: no flash, no swap, no ghost, no bolts, no shine, no shake, no fade, no glints, not done. */
const IDLE: TierBeatFrame = { flash: 0, swapped: false, ghost: null, bolts: 0, shine: null, shake: false, fade: null, glints: false, done: false };

/** PART_TIER_FX with some timings replaced. The const literal types would reject, say, 300 for beatMs, so the override is typed as number. */
function customFx(overrides: Partial<Record<'beatMs' | 'swapAtMs' | 'reducedFadeMs' | 'reducedGlintMs', number>>): typeof PART_TIER_FX {
  return { ...PART_TIER_FX, ...overrides } as typeof PART_TIER_FX;
}

describe('tierBeatFrame (full motion)', () => {
  it('t0: first flash step, not swapped, no ghost, no bolts, no shine, no shake, not done', () => {
    expect(tierBeatFrame(0, false)).toEqual({ ...IDLE, flash: 1 });
  });

  it('t60: second flash step', () => {
    const frame = tierBeatFrame(60, false);
    expect(frame.flash).toBe(2);
    expect(frame.swapped).toBe(false);
    expect(frame.ghost).toBeNull();
  });

  it('t120: swapped, flash over, ghost at scale 1 and alpha 0.55', () => {
    const frame = tierBeatFrame(120, false);
    expect(frame.flash).toBe(0);
    expect(frame.swapped).toBe(true);
    expect(frame.ghost).not.toBeNull();
    expect(frame.ghost?.scale).toBeCloseTo(1, 4);
    expect(frame.ghost?.alpha).toBeCloseTo(0.55, 4);
  });

  it('t250: ghost mid fade at scale 1.0624 and alpha 0.264', () => {
    const ghost = tierBeatFrame(250, false).ghost;
    expect(ghost?.scale).toBeCloseTo(1.0624, 4);
    expect(ghost?.alpha).toBeCloseTo(0.264, 4);
  });

  it('t350: first bolt-down crown lit, ghost still fading', () => {
    const frame = tierBeatFrame(350, false);
    expect(frame.bolts).toBe(1);
    expect(frame.ghost).not.toBeNull();
  });

  it('t450: both bolt crowns lit and the ghost gone', () => {
    const frame = tierBeatFrame(450, false);
    expect(frame.bolts).toBe(2);
    expect(frame.ghost).toBeNull();
  });

  it('t600: settle shake on, shine sweep at 0.2', () => {
    const frame = tierBeatFrame(600, false);
    expect(frame.shake).toBe(true);
    expect(frame.shine).toBeCloseTo(0.2, 4);
  });

  it('t800: shine sweep over', () => {
    expect(tierBeatFrame(800, false).shine).toBeNull();
  });

  it('t900: beat done', () => {
    const frame = tierBeatFrame(900, false);
    expect(frame.done).toBe(true);
    expect(frame.flash).toBe(0);
    expect(frame.swapped).toBe(true);
    expect(frame.glints).toBe(false);
    expect(frame.fade).toBeNull();
  });

  it('keeps the step edges exact: flash 1 below 60, flash 2 from 60 to 119, bolts from 350 and 450', () => {
    expect(tierBeatFrame(59, false).flash).toBe(1);
    expect(tierBeatFrame(119, false).flash).toBe(2);
    expect(tierBeatFrame(349, false).bolts).toBe(0);
    expect(tierBeatFrame(449, false).bolts).toBe(1);
  });

  it('keeps the ghost window exact: lit from 120 to 369, gone at 370', () => {
    expect(tierBeatFrame(119, false).swapped).toBe(false);
    expect(tierBeatFrame(369, false).ghost).not.toBeNull();
    expect(tierBeatFrame(370, false).ghost).toBeNull();
  });

  it('keeps the shine and shake edges exact', () => {
    expect(tierBeatFrame(549, false).shine).toBeNull();
    expect(tierBeatFrame(550, false).shine).toBeCloseTo(0, 4);
    expect(tierBeatFrame(799, false).shine).not.toBeNull();
    expect(tierBeatFrame(599, false).shake).toBe(false);
    expect(tierBeatFrame(600, false).shake).toBe(true);
  });

  it('is not done one millisecond before beatMs', () => {
    expect(tierBeatFrame(899, false).done).toBe(false);
  });
});

describe('tierBeatFrame (reduced motion)', () => {
  it('t0: swapped at once, crossfade fully on, glints on, not done', () => {
    expect(tierBeatFrame(0, true)).toEqual({ flash: 0, swapped: true, ghost: null, bolts: 0, shine: null, shake: false, fade: 1, glints: true, done: false });
  });

  it('t250: crossfade over, glints still held, not done', () => {
    expect(tierBeatFrame(250, true)).toEqual({ flash: 0, swapped: true, ghost: null, bolts: 0, shine: null, shake: false, fade: null, glints: true, done: false });
  });

  it('t400: glints gone and beat done', () => {
    expect(tierBeatFrame(400, true)).toEqual({ flash: 0, swapped: true, ghost: null, bolts: 0, shine: null, shake: false, fade: null, glints: false, done: true });
  });

  it('crossfade falls linearly from alpha 1 to 0 across reducedFadeMs', () => {
    expect(tierBeatFrame(125, true).fade).toBeCloseTo(0.5, 4);
    expect(tierBeatFrame(249, true).fade).toBeGreaterThan(0);
  });

  it('never flashes, ghosts, bolts, shines or shakes at any sampled time', () => {
    for (let t = 0; t <= 1000; t += 25) {
      const frame = tierBeatFrame(t, true);
      expect(frame.flash, `t ${t}`).toBe(0);
      expect(frame.swapped, `t ${t}`).toBe(true);
      expect(frame.ghost, `t ${t}`).toBeNull();
      expect(frame.bolts, `t ${t}`).toBe(0);
      expect(frame.shine, `t ${t}`).toBeNull();
      expect(frame.shake, `t ${t}`).toBe(false);
    }
  });
});

describe('tierBeatFrame (time input)', () => {
  it('reads negative time as 0 in both modes', () => {
    expect(tierBeatFrame(-50, false)).toEqual(tierBeatFrame(0, false));
    expect(tierBeatFrame(-1, true)).toEqual(tierBeatFrame(0, true));
  });

  it('reads NaN and infinite time as 0 in both modes', () => {
    expect(tierBeatFrame(Number.NaN, false)).toEqual(tierBeatFrame(0, false));
    expect(tierBeatFrame(Number.POSITIVE_INFINITY, false)).toEqual(tierBeatFrame(0, false));
    expect(tierBeatFrame(Number.NEGATIVE_INFINITY, true)).toEqual(tierBeatFrame(0, true));
    expect(tierBeatFrame(Number.NaN, true)).toEqual(tierBeatFrame(0, true));
  });

  it('defaults to PART_TIER_FX', () => {
    expect(tierBeatFrame(250, false)).toEqual(tierBeatFrame(250, false, PART_TIER_FX));
    expect(tierBeatFrame(250, true)).toEqual(tierBeatFrame(250, true, PART_TIER_FX));
  });
});

describe('tierBeatFrame (custom fx)', () => {
  it('honours a custom fx object in full motion', () => {
    const custom = customFx({ swapAtMs: 50, beatMs: 300 });
    const frame = tierBeatFrame(60, false, custom);
    expect(frame.flash).toBe(2);
    expect(frame.swapped).toBe(true);
    // 10 ms into a 250 ms ghost: p = 0.04, scale = 1 + 0.12 * 0.04.
    expect(frame.ghost?.scale).toBeCloseTo(1.0048, 4);
    expect(tierBeatFrame(299, false, custom).done).toBe(false);
    expect(tierBeatFrame(300, false, custom).done).toBe(true);
    expect(tierBeatFrame(49, false, custom).swapped).toBe(false);
  });

  it('honours a custom fx object in reduced motion', () => {
    const custom = customFx({ reducedFadeMs: 100, reducedGlintMs: 150 });
    expect(tierBeatFrame(100, true, custom).fade).toBeNull();
    expect(tierBeatFrame(100, true, custom).glints).toBe(true);
    expect(tierBeatFrame(150, true, custom).glints).toBe(false);
    expect(tierBeatFrame(150, true, custom).done).toBe(true);
    expect(tierBeatFrame(149, true, custom).done).toBe(false);
  });
});

describe('tierBeat.ts purity', () => {
  it('imports no Phaser module', () => {
    const source = readFileSync(SOURCE_URL, 'utf8');
    expect(source).not.toMatch(/from\s+['"]phaser/);
    expect(source).not.toMatch(/import\s+['"]phaser/);
  });
});
