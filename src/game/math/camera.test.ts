import { describe, it, expect } from 'vitest';
import {
  minZoomToFit,
  clampZoom,
  clampCenter,
  zoomAroundPoint,
  wheelToZoom,
  dragToCenter,
  worldToClient,
} from './camera';
import type { RectLike } from './camera';
import { VIEW, WORLD, CAMERA } from '../../data/world';

describe('minZoomToFit / clampZoom', () => {
  it('derives the fit-to-world minimum zoom', () => {
    expect(minZoomToFit(VIEW, WORLD)).toBe(0.5);
    expect(CAMERA.maxZoom).toBe(2);
  });

  it('clamps zoom into [min, max]', () => {
    expect(clampZoom(5, 0.5, 2)).toBe(2);
    expect(clampZoom(0.1, 0.5, 2)).toBe(0.5);
    expect(clampZoom(1.25, 0.5, 2)).toBe(1.25);
  });
});

describe('clampCenter', () => {
  it('clamps to the world edges at zoom 1', () => {
    expect(clampCenter({ x: -500, y: -500 }, 1, VIEW, WORLD)).toEqual({ x: 640, y: 360 });
    expect(clampCenter({ x: 9999, y: 9999 }, 1, VIEW, WORLD)).toEqual({ x: 1920, y: 1080 });
  });

  it('clamps to the smaller visible rect at zoom 2', () => {
    expect(clampCenter({ x: -1, y: -1 }, 2, VIEW, WORLD)).toEqual({ x: 320, y: 180 });
    expect(clampCenter({ x: 99999, y: 99999 }, 2, VIEW, WORLD)).toEqual({ x: 2240, y: 1260 });
  });

  it('centres the world when the view covers it (zoom 0.5)', () => {
    expect(clampCenter({ x: -300, y: 4000 }, 0.5, VIEW, WORLD)).toEqual({ x: 1280, y: 720 });
    expect(clampCenter({ x: 1, y: 1 }, 0.5, VIEW, WORLD)).toEqual({ x: 1280, y: 720 });
  });

  it('keeps the visible rect inside the world for a grid of centres', () => {
    const centres = [-1000, 250, 1500, 2750, 4000];
    for (const zoom of [0.5, 1, 2]) {
      for (const x of centres) {
        for (const y of centres) {
          const c = clampCenter({ x, y }, zoom, VIEW, WORLD);
          const halfW = VIEW.width / (2 * zoom);
          const halfH = VIEW.height / (2 * zoom);
          expect(c.x - halfW).toBeGreaterThanOrEqual(-1e-9);
          expect(c.x + halfW).toBeLessThanOrEqual(WORLD.width + 1e-9);
          expect(c.y - halfH).toBeGreaterThanOrEqual(-1e-9);
          expect(c.y + halfH).toBeLessThanOrEqual(WORLD.height + 1e-9);
        }
      }
    }
  });

  it('centres a view larger than the world', () => {
    const c = clampCenter({ x: 10, y: 10 }, 1, { width: 1000, height: 1000 }, { width: 500, height: 500 });
    expect(c).toEqual({ x: 250, y: 250 });
  });

  it('returns a new object', () => {
    const input = { x: 640, y: 360 };
    const out = clampCenter(input, 1, VIEW, WORLD);
    expect(out).not.toBe(input);
  });
});

describe('zoomAroundPoint', () => {
  it('keeps the pointer world point under the same screen pixel', () => {
    const combos: Array<{ center: { x: number; y: number }; pointer: { x: number; y: number }; oldZoom: number; newZoom: number }> = [
      { center: { x: 1280, y: 960 }, pointer: { x: 1500, y: 1000 }, oldZoom: 1, newZoom: 2 },
      { center: { x: 900, y: 500 }, pointer: { x: 200, y: 1300 }, oldZoom: 2, newZoom: 1 },
      { center: { x: 1000, y: 700 }, pointer: { x: 1100, y: 650 }, oldZoom: 0.5, newZoom: 1.1 },
      { center: { x: 2000, y: 300 }, pointer: { x: 100, y: 100 }, oldZoom: 1.3, newZoom: 0.7 },
    ];
    for (const { center, pointer, oldZoom, newZoom } of combos) {
      const next = zoomAroundPoint(center, pointer, oldZoom, newZoom);
      expect((pointer.x - next.x) * newZoom).toBeCloseTo((pointer.x - center.x) * oldZoom, 9);
      expect((pointer.y - next.y) * newZoom).toBeCloseTo((pointer.y - center.y) * oldZoom, 9);
    }
  });

  it('returns the same centre when the zoom is unchanged', () => {
    const center = { x: 1234.5, y: 567.25 };
    const next = zoomAroundPoint(center, { x: 100, y: 900 }, 1.5, 1.5);
    expect(next.x).toBeCloseTo(center.x, 9);
    expect(next.y).toBeCloseTo(center.y, 9);
  });
});

describe('wheelToZoom', () => {
  it('zooms in on negative deltaY and out on positive deltaY', () => {
    expect(wheelToZoom(1, -100, 1.1, 0.5, 2)).toBeCloseTo(1.1, 9);
    expect(wheelToZoom(1, 100, 1.1, 0.5, 2)).toBeCloseTo(1 / 1.1, 9);
  });

  it('clamps at the limits', () => {
    expect(wheelToZoom(2, -100, 1.1, 0.5, 2)).toBe(2);
    expect(wheelToZoom(0.5, 100, 1.1, 0.5, 2)).toBe(0.5);
  });

  it('leaves zoom unchanged for deltaY 0', () => {
    expect(wheelToZoom(1.4, 0, 1.1, 0.5, 2)).toBe(1.4);
  });
});

describe('dragToCenter', () => {
  it('moves the centre opposite to the drag, scaled by zoom', () => {
    expect(dragToCenter({ x: 1000, y: 500 }, { x: 100, y: -50 }, 2)).toEqual({ x: 950, y: 525 });
    expect(dragToCenter({ x: 1000, y: 500 }, { x: 100, y: -50 }, 1)).toEqual({ x: 900, y: 550 });
  });
});

describe('worldToClient', () => {
  const gameSize = { width: 1280, height: 720 };
  const fullRect: RectLike = { left: 0, top: 0, width: 1280, height: 720 };
  const smallRect: RectLike = { left: 100, top: 50, width: 640, height: 360 };

  it('maps at zoom 1 with a full-size canvas', () => {
    expect(worldToClient({ x: 1280, y: 720 }, { x: 640, y: 360 }, 1, fullRect, gameSize)).toEqual({ x: 640, y: 360 });
  });

  it('applies the canvas offset and scale', () => {
    const a = worldToClient({ x: 1280, y: 720 }, { x: 640, y: 360 }, 1, smallRect, gameSize);
    expect(a.x).toBeCloseTo(420, 9);
    expect(a.y).toBeCloseTo(230, 9);
    const b = worldToClient({ x: 1920, y: 1080 }, { x: 640, y: 360 }, 1, smallRect, gameSize);
    expect(b.x).toBeCloseTo(740, 9);
    expect(b.y).toBeCloseTo(410, 9);
  });

  it('maps the view centre to the canvas centre at zoom 2', () => {
    const p = worldToClient({ x: 1280, y: 720 }, { x: 960, y: 540 }, 2, smallRect, gameSize);
    expect(p.x).toBeCloseTo(420, 9);
    expect(p.y).toBeCloseTo(230, 9);
  });
});
