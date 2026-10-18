import { describe, it, expect } from 'vitest';
import { parallaxToWorld, nearestPylonAnchor, pylonAnchorPoint, cableParabola } from './pylonLine';
import type { PylonAnchorInput } from './pylonLine';

/** Base input: one anchor at the tile's bottom-left-ish corner, square tile, sf 1, no scroll, strip at 0. */
function input(overrides: Partial<PylonAnchorInput> = {}): PylonAnchorInput {
  return {
    from: { x: 1000, y: 990 },
    anchorsArt: [{ x: 0, y: 256 }],
    tilePx: 256,
    tileHeightPx: 256,
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
    const c = nearestPylonAnchor(input());
    expect(c?.ref).toEqual({ tile: 2, index: 0 });
    expect(c?.point.x).toBeCloseTo(1024, 9);
    expect(c?.point.y).toBeCloseTo(1000, 9);
  });

  it('picks the nearer of two anchors', () => {
    const c = nearestPylonAnchor(input({
      from: { x: 1210, y: 740 },
      anchorsArt: [{ x: 0, y: 256 }, { x: 100, y: 128 }],
    }));
    expect(c?.ref).toEqual({ tile: 2, index: 1 });
    expect(c?.point.x).toBeCloseTo(1224, 9);
    expect(c?.point.y).toBeCloseTo(744, 9);
  });

  it('ignores anchors left of the mast', () => {
    // anchors sit at x = 512 k; from x 1030 the nearest anchor right of it is k = 3 (x 1536)
    const c = nearestPylonAnchor(input({ from: { x: 1030, y: 990 } }));
    expect(c?.ref.tile).toBe(3);
    expect(c?.point.x).toBeCloseTo(1536, 9);
  });

  it('returns null when every anchor in the tile window is left of the mast', () => {
    // window of the mast's own tile only: its anchor (x 512) lies left of from.x 1000
    expect(nearestPylonAnchor(input({ from: { x: 1000, y: 990 }, tiles: 0 }))).toBeNull();
  });

  it('returns the world point of the chosen obj point for sf 0.5 with scroll', () => {
    const c = nearestPylonAnchor(input({
      from: { x: 1100, y: 990 },
      scrollFactor: 0.5,
      scroll: { x: 200, y: 0 },
    }));
    // obj point of tile k = 2 is (1024, 1000); world = obj + (100, 0) = (1124, 1000)
    expect(c?.ref.tile).toBe(2);
    expect(c?.point.x).toBeCloseTo(1124, 9);
    expect(c?.point.y).toBeCloseTo(1000, 9);
  });

  it('finds a tile to the far left (negative k)', () => {
    const c = nearestPylonAnchor(input({ from: { x: -1990, y: 990 } }));
    expect(c?.ref.tile).toBe(-3);
    expect(c?.point.x).toBeCloseTo(-1536, 9);
    expect(c?.point.y).toBeCloseTo(1000, 9);
  });

  it('uses the tile height for the anchor y on a non-square tile', () => {
    // tile 256 wide, 128 tall: art y 59 sits 69 art px above the strip bottom
    const c = nearestPylonAnchor(input({
      from: { x: 1000, y: 800 },
      tileHeightPx: 128,
      anchorsArt: [{ x: 159.5, y: 59 }],
      bottomObjY: 1000,
    }));
    expect(c?.point.y).toBeCloseTo(1000 - (128 - 59) * 2, 9);
    expect(c?.point.x).toBeCloseTo(2 * 256 * 2 + 159.5 * 2, 9);
  });

  it('returns null without anchors', () => {
    expect(nearestPylonAnchor(input({ anchorsArt: [] }))).toBeNull();
  });

  it('returns null for a tile of zero height', () => {
    expect(nearestPylonAnchor(input({ tileHeightPx: 0 }))).toBeNull();
  });

  it('returns null for non-finite input', () => {
    expect(nearestPylonAnchor(input({ from: { x: NaN, y: 0 } }))).toBeNull();
    expect(nearestPylonAnchor(input({ scroll: { x: 0, y: Infinity } }))).toBeNull();
    expect(nearestPylonAnchor(input({ anchorsArt: [{ x: 0, y: NaN }] }))).toBeNull();
    expect(nearestPylonAnchor(input({ tileHeightPx: NaN }))).toBeNull();
    expect(nearestPylonAnchor(input({ tiles: NaN }))).toBeNull();
  });
});

describe('pylonAnchorPoint', () => {
  it('matches the point nearestPylonAnchor chose for the same input', () => {
    const base = input({ from: { x: 1000, y: 990 } });
    const choice = nearestPylonAnchor(base);
    expect(choice).not.toBeNull();
    if (choice === null) return;
    expect(pylonAnchorPoint(base, choice.ref)).toEqual(choice.point);
  });

  it('keeps following the same pinned anchor when the camera pans', () => {
    const ref = { tile: 2, index: 0 };
    const at0 = pylonAnchorPoint(input({ scrollFactor: 0.5, scroll: { x: 0, y: 0 } }), ref);
    const at200 = pylonAnchorPoint(input({ scrollFactor: 0.5, scroll: { x: 200, y: 0 } }), ref);
    expect(at0?.x).toBeCloseTo(1024, 9);
    expect(at200?.x).toBeCloseTo(1124, 9);
    expect(at200?.y).toBeCloseTo(at0?.y ?? NaN, 9);
  });

  it('returns null for an unknown anchor index or non-finite input', () => {
    expect(pylonAnchorPoint(input(), { tile: 2, index: 1 })).toBeNull();
    expect(pylonAnchorPoint(input({ from: { x: NaN, y: 0 } }), { tile: 2, index: 0 })).toBeNull();
    expect(pylonAnchorPoint(input(), { tile: 0.5, index: 0 })).toBeNull();
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
