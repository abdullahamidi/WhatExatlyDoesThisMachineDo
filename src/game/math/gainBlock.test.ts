import { describe, it, expect } from 'vitest';
import { mergeGains, gainFontPx, gainBlockBox } from './gainBlock';
import type { GainBlock } from './gainBlock';
import type { Bounds } from './camera';
import { boundsToWorld } from './machineBounds';
import { componentBounds, machineLocalToWorld, resolveAttachment } from './machineLayout';
import { FLOATING_TEXT } from '../../data/world';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { ResourceMap } from '../../data/types';

const COALESCE_MS = 300;
const BLOCK_MAX_MS = 900;

function gains(patch: Partial<ResourceMap>): ResourceMap {
  return { me: 0, ee: 0, pr: 0, rs: 0, xf: 0, ...patch };
}

/** A block whose every field is frozen, so any write to it throws in strict mode. */
function frozenBlock(patch: Partial<ResourceMap>, startMs: number, lastMs: number): GainBlock {
  return Object.freeze({ gains: Object.freeze(gains(patch)), startMs, lastMs });
}

describe('mergeGains', () => {
  it('starts a fresh block when there is none', () => {
    const r = mergeGains(null, gains({ me: 5 }), 1000, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.merged).toBe(false);
    expect(r.block).toEqual({ gains: gains({ me: 5 }), startMs: 1000, lastMs: 1000 });
  });

  it('merges a click 250 ms after the last one: gains summed, start kept, last updated', () => {
    const open = frozenBlock({ me: 5 }, 1000, 1000);
    const r = mergeGains(open, gains({ me: 3, ee: 2 }), 1250, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.merged).toBe(true);
    expect(r.block).toEqual({ gains: gains({ me: 8, ee: 2 }), startMs: 1000, lastMs: 1250 });
  });

  it('merges a click exactly 300 ms after the last one (inclusive)', () => {
    const open = frozenBlock({ me: 5 }, 1000, 1000);
    const r = mergeGains(open, gains({ me: 1 }), 1300, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.merged).toBe(true);
    expect(r.block.lastMs).toBe(1300);
  });

  it('starts a fresh block 301 ms after the last one', () => {
    const open = frozenBlock({ me: 5 }, 1000, 1000);
    const r = mergeGains(open, gains({ ee: 2 }), 1301, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.merged).toBe(false);
    expect(r.block).toEqual({ gains: gains({ ee: 2 }), startMs: 1301, lastMs: 1301 });
  });

  it('starts a fresh block once the block is 900 ms old, even when the last click was just now', () => {
    const open = frozenBlock({ me: 5 }, 0, 800);
    const r = mergeGains(open, gains({ me: 1 }), 900, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.merged).toBe(false);
    expect(r.block).toEqual({ gains: gains({ me: 1 }), startMs: 900, lastMs: 900 });
  });

  it('starts a fresh block when now is before the last click', () => {
    const open = frozenBlock({ me: 5 }, 1000, 1000);
    const r = mergeGains(open, gains({ me: 1 }), 999, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.merged).toBe(false);
    expect(r.block).toEqual({ gains: gains({ me: 1 }), startMs: 999, lastMs: 999 });
  });

  it('counts NaN, negative and infinite gains as 0 in a fresh block', () => {
    const r = mergeGains(null, { me: Number.NaN, ee: -3, pr: Number.POSITIVE_INFINITY, rs: 2, xf: 0 }, 0, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.block.gains).toEqual(gains({ rs: 2 }));
  });

  it('counts NaN, negative and infinite gains as 0 in a merged block', () => {
    const open = frozenBlock({ me: 4 }, 0, 0);
    const r = mergeGains(open, { me: Number.NaN, ee: -3, pr: Number.POSITIVE_INFINITY, rs: 2, xf: -1 }, 100, COALESCE_MS, BLOCK_MAX_MS);
    expect(r.merged).toBe(true);
    expect(r.block.gains).toEqual(gains({ me: 4, rs: 2 }));
  });

  it('never mutates its inputs (frozen block and gains do not throw)', () => {
    const open = frozenBlock({ me: 1 }, 0, 0);
    const gained = Object.freeze(gains({ me: 2 }));
    const merged = mergeGains(open, gained, 100, COALESCE_MS, BLOCK_MAX_MS);
    expect(merged.block.gains).not.toBe(open.gains);
    expect(open.gains).toEqual(gains({ me: 1 }));
    const fresh = mergeGains(null, gained, 0, COALESCE_MS, BLOCK_MAX_MS);
    expect(fresh.block.gains).not.toBe(gained);
    expect(gained).toEqual(gains({ me: 2 }));
  });
});

describe('gainFontPx', () => {
  it('keeps the base size at zoom 1 (16 screen px is below 24 world px)', () => {
    expect(gainFontPx(1, 24, 16)).toBe(24);
  });

  it('doubles to 32 world px at zoom 0.5 to keep 16 screen px', () => {
    expect(gainFontPx(0.5, 24, 16)).toBe(32);
  });

  it('grows to 64 world px at zoom 0.25', () => {
    expect(gainFontPx(0.25, 24, 16)).toBe(64);
  });

  it('rounds the world size up to whole px (16 / 0.6 -> 27)', () => {
    expect(gainFontPx(0.6, 24, 16)).toBe(27);
  });

  it('falls back to the base size for zoom 0, NaN, negative or infinite zoom', () => {
    expect(gainFontPx(0, 24, 16)).toBe(24);
    expect(gainFontPx(Number.NaN, 24, 16)).toBe(24);
    expect(gainFontPx(-1, 24, 16)).toBe(24);
    expect(gainFontPx(Number.POSITIVE_INFINITY, 24, 16)).toBe(24);
  });
});

describe('gainBlockBox', () => {
  it('is maxChars * charWidthEm * fontPx wide and centred on anchor.x', () => {
    const b = gainBlockBox({ x: 100, y: 50 }, 3, 10, 24, 2, 0.5);
    expect(b.right - b.left).toBeCloseTo(120, 9);
    expect(b.left).toBeCloseTo(40, 9);
    expect(b.right).toBeCloseTo(160, 9);
    expect((b.left + b.right) / 2).toBeCloseTo(100, 9);
  });

  it('has its bottom on anchor.y and is lineCount * (fontPx + lineGapPx) tall', () => {
    const b = gainBlockBox({ x: 100, y: 50 }, 3, 10, 24, 2, 0.5);
    expect(b.bottom).toBeCloseTo(50, 9);
    expect(b.bottom - b.top).toBeCloseTo(78, 9);
    expect(b.top).toBeCloseTo(-28, 9);
  });
});

/** Strict overlap: boxes that only touch at an edge do not intersect. */
function overlaps(a: Bounds, r: Bounds): boolean {
  return a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top;
}

/** Support-frame top beam in world px: art x -100..100, y -110..-100 (MACHINE_ANCHOR scale). */
function topBeamWorld(): Bounds {
  const a = machineLocalToWorld({ x: -100, y: -110 });
  const b = machineLocalToWorld({ x: 100, y: -100 });
  return { left: a.x, top: a.y, right: b.x, bottom: b.y };
}

describe('crank gain block clearance (WP17 T8)', () => {
  for (const zoom of [1, 0.5]) {
    for (const jitter of [-6, 0, 6]) {
      it(`at zoom ${zoom} with x jitter ${jitter} clears the top beam and the name plate`, () => {
        const fontPx = gainFontPx(zoom, FLOATING_TEXT.fontSizePx, FLOATING_TEXT.minScreenPx);
        const crank = machineLocalToWorld(resolveAttachment(MACHINE_COMPONENTS.handCrank));
        const anchor = {
          x: crank.x + FLOATING_TEXT.spawnOffset.x + jitter,
          y: crank.y + FLOATING_TEXT.spawnOffset.y,
        };
        const scale = fontPx / FLOATING_TEXT.fontSizePx;
        const box = gainBlockBox(anchor, 5, 10, fontPx, FLOATING_TEXT.lineGapPx * scale, FLOATING_TEXT.charWidthEm);
        expect(overlaps(box, topBeamWorld())).toBe(false);
        expect(overlaps(box, boundsToWorld(componentBounds(MACHINE_COMPONENTS.namePlate)))).toBe(false);
      });
    }
  }
});
