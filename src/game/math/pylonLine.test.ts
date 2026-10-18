import { describe, it, expect } from 'vitest';
import { parallaxToWorld, nearestPylonAnchor, cableParabola } from './pylonLine';
import type { PylonAnchorInput } from './pylonLine';

/** Base input: one anchor at the tile's bottom-left-ish corner, sf 1, no scroll, strip at 0. */
function input(overrides: Partial<PylonAnchorInput> = {}): PylonAnchorInput {
  return {
    from: { x: 1030, y: 990 },
    anchorsArt: [{ x: 0, y: 256 }],
    tilePx: 256,
    scale: 2,
    scrollFactor: 1,
    stripLeftX: 0,
    bottomObjY: 1000,
    scroll: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('parallaxToWorld', () => {
  it('is the identity for sf 1', () => {
    expect(parallaxToWorld({ x: 300, y: -40 }, 1, { x: 100, y: 50 })).toEqual({ x: 300, y: -40 });
  });

  it('adds the full scroll for sf 0', () => {
    expect(parallaxToWorld({ x: 300, y: -40 }, 0, { x: 100, y: 50 })).toEqual({ x: 400, y: 10 });
  });

  it('adds (1 - sf) * scroll for sf 0.55', () => {
    const p = parallaxToWorld({ x: 10, y: 20 }, 0.55, { x: 100, y: 50 });
    expect(p.x).toBeCloseTo(10 + 45, 9);
    expect(p.y).toBeCloseTo(20 + 22.5, 9);
  });
});

describe('nearestPylonAnchor', () => {
  it('picks the tile k = 2 anchor for a start point in that tile', () => {
    const p = nearestPylonAnchor(input());
    expect(p).not.toBeNull();
    expect(p?.x).toBeCloseTo(1024, 9);
    expect(p?.y).toBeCloseTo(1000, 9);
  });

  it('picks the nearer of two anchors', () => {
    const p = nearestPylonAnchor(input({
      from: { x: 1230, y: 740 },
      anchorsArt: [{ x: 0, y: 256 }, { x: 100, y: 128 }],
    }));
    expect(p?.x).toBeCloseTo(1224, 9);
    expect(p?.y).toBeCloseTo(744, 9);
  });

  it('returns the world point of the chosen obj point for sf 0.5 with scroll', () => {
    const p = nearestPylonAnchor(input({
      from: { x: 1130, y: 990 },
      scrollFactor: 0.5,
      scroll: { x: 200, y: 0 },
    }));
    // obj point of tile k = 2 is (1024, 1000); world = obj + (100, 0)
    expect(p).not.toBeNull();
    expect(p?.x).toBeCloseTo(1124, 9);
    expect(p?.y).toBeCloseTo(1000, 9);
  });

  it('finds a tile to the far left (negative k)', () => {
    const p = nearestPylonAnchor(input({ from: { x: -2000, y: 990 } }));
    expect(p?.x).toBeCloseTo(-2048, 9);
    expect(p?.y).toBeCloseTo(1000, 9);
  });

  it('returns null without anchors', () => {
    expect(nearestPylonAnchor(input({ anchorsArt: [] }))).toBeNull();
  });

  it('returns null for non-finite input', () => {
    expect(nearestPylonAnchor(input({ from: { x: NaN, y: 0 } }))).toBeNull();
    expect(nearestPylonAnchor(input({ scroll: { x: 0, y: Infinity } }))).toBeNull();
    expect(nearestPylonAnchor(input({ anchorsArt: [{ x: 0, y: NaN }] }))).toBeNull();
  });
});

describe('cableParabola', () => {
  it('has segments + 1 points with exact ends', () => {
    const a = { x: 1.1, y: 2.3 };
    const b = { x: 7.7, y: -4.4 };
    const pts = cableParabola(a, b, 3, 5);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual(a);
    expect(pts[5]).toEqual(b);
  });

  it('puts the midpoint at the chord midpoint plus sag for an even segment count', () => {
    const pts = cableParabola({ x: 0, y: 0 }, { x: 100, y: 40 }, 5, 4);
    const mid = pts[2];
    expect(mid?.x).toBeCloseTo(50, 9);
    expect(mid?.y).toBeCloseTo(20 + 5, 9);
  });

  it('is a straight line for zero sag', () => {
    const pts = cableParabola({ x: 0, y: 0 }, { x: 10, y: 10 }, 0, 4);
    for (const p of pts) {
      expect(p.y).toBeCloseTo(p.x, 9);
    }
  });

  it('uses at least one segment', () => {
    expect(cableParabola({ x: 0, y: 0 }, { x: 1, y: 1 }, 0, 0)).toHaveLength(2);
  });
});
