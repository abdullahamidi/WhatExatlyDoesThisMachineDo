import { describe, it, expect } from 'vitest';
import {
  minZoomToFit,
  effectiveMinZoom,
  clampZoom,
  clampCenter,
  zoomAroundPoint,
  wheelToZoom,
  dragToCenter,
  worldToClient,
  zoomStep,
  snapZoom,
  hudTopInsetAt,
  hudSafeCenterY,
  wheelToSnappedZoom,
  viewBounds,
  boundsInView,
  fitView,
} from './camera';
import type { Bounds, FitViewOptions, RectLike } from './camera';
import { VIEW, WORLD, CAMERA, GROUND_Y, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { createInitialState } from '../../simulation';
import { visibleMachineBounds, boundsToWorld } from './machineBounds';

// Pre-WP11 game world (2560 x 1440, anchor 1280 / 1120, focus 1280 / 960): the geometry tests below keep their literal numbers.
const OLD_WORLD = { width: 2560, height: 1440 } as const;
const OLD_ANCHOR = { x: 1280, y: 1120 } as const;
const OLD_FOCUS = { x: 1280, y: 960 } as const;

describe('minZoomToFit / effectiveMinZoom / clampZoom', () => {
  it('derives the fit-to-world minimum zoom (one third for the 3840 x 2160 world)', () => {
    expect(minZoomToFit(VIEW, WORLD)).toBeCloseTo(1 / 3, 9);
    expect(CAMERA.maxZoom).toBe(2);
  });

  it('effectiveMinZoom keeps the explicit floor for the game world', () => {
    expect(effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom)).toBe(0.5);
  });

  it('effectiveMinZoom is the fit minimum when it exceeds the floor', () => {
    expect(effectiveMinZoom({ width: 1280, height: 720 }, { width: 1280, height: 720 }, 0.25)).toBe(1);
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
    expect(clampCenter({ x: 9999, y: 9999 }, 1, VIEW, WORLD)).toEqual({ x: 3200, y: 1800 });
  });

  it('clamps to the smaller visible rect at zoom 2', () => {
    expect(clampCenter({ x: -1, y: -1 }, 2, VIEW, WORLD)).toEqual({ x: 320, y: 180 });
    expect(clampCenter({ x: 99999, y: 99999 }, 2, VIEW, WORLD)).toEqual({ x: 3520, y: 1980 });
  });

  it('centres the world when the view covers it (zoom 0.5, pre-WP11 world)', () => {
    expect(clampCenter({ x: -300, y: 4000 }, 0.5, VIEW, OLD_WORLD)).toEqual({ x: 1280, y: 720 });
    expect(clampCenter({ x: 1, y: 1 }, 0.5, VIEW, OLD_WORLD)).toEqual({ x: 1280, y: 720 });
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

describe('zoom grid (pixel-perfect steps)', () => {
  const PS = 2;
  const MIN = 0.5;
  const MAX = 2;

  /** Seeded LCG (no Math.random): returns values in [0, 1). */
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /** True when PIXEL_SCALE * zoom is an integer or half-integer, i.e. zoom is a multiple of 0.25 at scale 2. */
  const onGrid = (z: number): boolean => Number.isInteger(z * 4);

  it('step is 0.5 / pixel scale', () => {
    expect(zoomStep(2)).toBe(0.25);
  });

  it('snaps to the nearest grid value and clamps', () => {
    expect(snapZoom(1.1, PS, MIN, MAX)).toBe(1);
    expect(snapZoom(1.13, PS, MIN, MAX)).toBe(1.25);
    expect(snapZoom(2.7, PS, MIN, MAX)).toBe(2);
    expect(snapZoom(0.1, PS, MIN, MAX)).toBe(0.5);
  });

  it('every snapped zoom from a seeded sweep lies on the grid', () => {
    const rnd = lcg(42);
    for (let i = 0; i < 500; i++) {
      const z = snapZoom(0.3 + rnd() * 2.1, PS, MIN, MAX);
      expect(onGrid(z)).toBe(true);
      expect(z).toBeGreaterThanOrEqual(MIN);
      expect(z).toBeLessThanOrEqual(MAX);
    }
  });

  it('wheel steps move one grid value per notch', () => {
    expect(wheelToSnappedZoom(1, -1, PS, MIN, MAX)).toBe(1.25);
    expect(wheelToSnappedZoom(1, 1, PS, MIN, MAX)).toBe(0.75);
    expect(wheelToSnappedZoom(2, -1, PS, MIN, MAX)).toBe(2);
    expect(wheelToSnappedZoom(0.5, 1, PS, MIN, MAX)).toBe(0.5);
  });

  it('wheel steps from an off-grid zoom land on the grid', () => {
    expect(wheelToSnappedZoom(1.1, -1, PS, MIN, MAX)).toBe(1.25);
    expect(wheelToSnappedZoom(1.1, 1, PS, MIN, MAX)).toBe(1);
  });

  it('wheel with deltaY 0 snaps to the grid', () => {
    expect(wheelToSnappedZoom(1.1, 0, PS, MIN, MAX)).toBe(1);
    expect(wheelToSnappedZoom(1.13, 0, PS, MIN, MAX)).toBe(1.25);
  });

  it('wheel results never leave the grid over a seeded walk', () => {
    const rnd = lcg(7);
    let z = 1;
    for (let i = 0; i < 300; i++) {
      const dy = rnd() < 0.5 ? -1 : 1;
      z = wheelToSnappedZoom(z, dy, PS, MIN, MAX);
      expect(onGrid(z)).toBe(true);
      expect(z).toBeGreaterThanOrEqual(MIN);
      expect(z).toBeLessThanOrEqual(MAX);
    }
  });

  it('zooming in 10 times then out 10 times visits only grid values and ends at the limits', () => {
    let z = 1;
    for (let i = 0; i < 10; i++) {
      z = wheelToSnappedZoom(z, -1, PS, MIN, MAX);
      expect(onGrid(z)).toBe(true);
    }
    expect(z).toBe(2);
    for (let i = 0; i < 10; i++) {
      z = wheelToSnappedZoom(z, 1, PS, MIN, MAX);
      expect(onGrid(z)).toBe(true);
    }
    expect(z).toBe(0.5);
  });

  it('four notches in and four out return exactly to zoom 1', () => {
    let z = 1;
    for (let i = 0; i < 4; i++) z = wheelToSnappedZoom(z, -1, PS, MIN, MAX);
    expect(z).toBe(2);
    for (let i = 0; i < 4; i++) z = wheelToSnappedZoom(z, 1, PS, MIN, MAX);
    expect(z).toBe(1);
  });
});

describe('viewBounds / boundsInView', () => {
  it('spans view / zoom around the centre, symmetrically', () => {
    const b = viewBounds({ x: 1280, y: 960 }, 2, { width: 1280, height: 720 });
    expect(b).toEqual({ left: 960, top: 780, right: 1600, bottom: 1140 });
    expect((b.left + b.right) / 2).toBe(1280);
    expect((b.top + b.bottom) / 2).toBe(960);
  });

  it('accepts a box inside the view and a box exactly on the margin edge', () => {
    const view: Bounds = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(boundsInView({ left: 20, top: 20, right: 80, bottom: 80 }, view, 10)).toBe(true);
    expect(boundsInView({ left: 10, top: 10, right: 90, bottom: 90 }, view, 10)).toBe(true);
    expect(boundsInView({ left: 0, top: 0, right: 100, bottom: 100 }, view, 0)).toBe(true);
  });

  it('rejects a box 1 px outside the margin on any side', () => {
    const view: Bounds = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(boundsInView({ left: 10, top: 10, right: 90, bottom: 90 }, view, 11)).toBe(false);
    expect(boundsInView({ left: 10, top: 10, right: 91, bottom: 90 }, view, 10)).toBe(false);
    expect(boundsInView({ left: 9, top: 10, right: 90, bottom: 90 }, view, 10)).toBe(false);
    expect(boundsInView({ left: 10, top: 10, right: 90, bottom: 101 }, view, 0)).toBe(false);
  });
});

describe('fitView', () => {
  const FIT: FitViewOptions = {
    margin: 48,
    pixelScale: 2,
    minZoom: 0.5,
    maxZoom: 2,
    defaultZoom: 1,
    defaultCenter: { ...OLD_FOCUS },
    world: OLD_WORLD,
  };

  /** Era-I levels: every era-I tech at its max (null max = 1), era-II techs at 0. */
  function eraOneMaxed(): Record<TechId, number> {
    const levels: Record<TechId, number> = { ...createInitialState(0).techLevels };
    for (const id of TECH_IDS) {
      const def = TECHNOLOGIES[id];
      if (def.era === 1) levels[id] = def.maxLevel ?? 1;
    }
    return levels;
  }

  it('keeps the default view when the bounds already fit it, centre clamped in the world', () => {
    const b: Bounds = { left: 900, top: 700, right: 1000, bottom: 800 };
    expect(fitView(b, VIEW, FIT)).toEqual({ center: { x: 1280, y: 960 }, zoom: 1 });
    const small: Bounds = { left: 100, top: 100, right: 200, bottom: 200 };
    expect(fitView(small, VIEW, { ...FIT, defaultCenter: { x: 100, y: 100 } })).toEqual({ center: { x: 640, y: 360 }, zoom: 1 });
  });

  it('returns the default view for the full era-I machine bounds', () => {
    const b = boundsToWorld(visibleMachineBounds(eraOneMaxed()), OLD_ANCHOR);
    expect(fitView(b, VIEW, FIT)).toEqual({ center: { x: 1280, y: 960 }, zoom: 1 });
  });

  it('returns the default view at the game focus for the full era-I machine bounds in the 3840 x 2160 world', () => {
    const b = boundsToWorld(visibleMachineBounds(eraOneMaxed()));
    const game = { ...FIT, defaultCenter: { x: CAMERA.focus.x, y: CAMERA.focus.y }, world: WORLD };
    expect(fitView(b, VIEW, game)).toEqual({ center: { x: CAMERA.focus.x, y: CAMERA.focus.y }, zoom: 1 });
  });

  it('fits a 1232-wide bounds at zoom 0.75', () => {
    const b: Bounds = { left: 1000, top: 500, right: 2232, bottom: 900 };
    expect(fitView(b, VIEW, FIT)).toEqual({ center: { x: 1616, y: 700 }, zoom: 0.75 });
  });

  it('caps a small far-right bounds at the default zoom and centres on it', () => {
    const b: Bounds = { left: 1850, top: 900, right: 1900, bottom: 950 };
    expect(fitView(b, VIEW, FIT)).toEqual({ center: { x: 1875, y: 925 }, zoom: 1 });
  });

  it('falls back to minZoom when the bounds are wider than the world', () => {
    const b: Bounds = { left: 0, top: 0, right: 2600, bottom: 100 };
    expect(fitView(b, VIEW, FIT)).toEqual({ center: { x: 1280, y: 720 }, zoom: 0.5 });
  });

  it('clamps the centre inside the world for bounds at the world edge', () => {
    const b: Bounds = { left: 2400, top: 1300, right: 2560, bottom: 1440 };
    const out = fitView(b, VIEW, FIT);
    expect(out.center).toEqual({ x: 1920, y: 1080 });
    expect(out.zoom).toBe(1);
  });

  it('always returns a zoom on the k * step grid', () => {
    const step = 0.25;
    const sizes: Array<[number, number]> = [[100, 50], [500, 200], [900, 400], [1232, 400], [1600, 300], [2600, 100]];
    for (const [w, h] of sizes) {
      for (const x0 of [0, 700, 1500]) {
        const b: Bounds = { left: x0, top: 200, right: x0 + w, bottom: 200 + h };
        const { zoom } = fitView(b, VIEW, FIT);
        expect(Math.abs(zoom / step - Math.round(zoom / step))).toBeLessThan(1e-9);
        expect(zoom).toBeGreaterThanOrEqual(0.5);
        expect(zoom).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('fitView HUD top inset', () => {
  const FIT: FitViewOptions = {
    margin: 72,
    pixelScale: 2,
    minZoom: 0.5,
    maxZoom: 2,
    defaultZoom: 1,
    defaultCenter: { ...OLD_FOCUS },
    world: OLD_WORLD,
  };
  // s10 boiler-only machine bounds in world px (x 662..2168 per WP9 s10; zoom 0.75, unshifted centre y 882)
  const S10: Bounds = { left: 662, top: 635, right: 2168, bottom: 1129 };

  /** Screen y of the bounds top for a fitted view. */
  function topScreenY(b: Bounds, center: { x: number; y: number }, zoom: number): number {
    return (b.top - center.y) * zoom + VIEW.height / 2;
  }

  it('keeps the s10 machine top at or below the HUD inset', () => {
    const inset = CAMERA.hudTopInsetPx;
    const out = fitView(S10, VIEW, { ...FIT, hudTopInsetPx: inset });
    expect(out.zoom).toBe(0.75);
    expect(topScreenY(S10, out.center, out.zoom)).toBeGreaterThanOrEqual(inset - 1e-9);
    expect(topScreenY(S10, out.center, out.zoom)).toBeCloseTo(inset, 6);
  });

  it('leaves the s10 view unshifted without the inset (crown under the HUD, screen y 175)', () => {
    const out = fitView(S10, VIEW, FIT);
    expect(out.zoom).toBe(0.75);
    expect(out.center.y).toBe(882);
    expect(topScreenY(S10, out.center, out.zoom)).toBeCloseTo(174.75, 6);
  });

  it('keeps the zoom 0.5 case unchanged (world-sized bounds, centred)', () => {
    const b: Bounds = { left: 0, top: 0, right: 2600, bottom: 100 };
    expect(fitView(b, VIEW, { ...FIT, hudTopInsetPx: 240 })).toEqual({ center: { x: 1280, y: 720 }, zoom: 0.5 });
    expect(fitView(b, VIEW, FIT)).toEqual({ center: { x: 1280, y: 720 }, zoom: 0.5 });
  });

  it('does not move a fitted view whose top already clears the inset', () => {
    const b: Bounds = { left: 1000, top: 700, right: 2232, bottom: 900 }; // zoom 0.75, top screen y 285
    expect(fitView(b, VIEW, { ...FIT, hudTopInsetPx: 240 })).toEqual(fitView(b, VIEW, FIT));
    expect(fitView(b, VIEW, FIT).zoom).toBe(0.75);
  });

  it('never pushes the machine base (plus margin) below the screen to clear the HUD', () => {
    // tall machine: top under the HUD and base already near the bottom edge
    const b = { left: 900, right: 1660, top: 500, bottom: 1100 };
    const out = fitView(b, VIEW, { ...FIT, hudTopInsetPx: 240 });
    const plain = fitView(b, VIEW, FIT);
    const bottom = (c: { center: { y: number }; zoom: number }): number => (b.bottom - c.center.y) * c.zoom + VIEW.height / 2;
    expect(out.center.y).toBeLessThan(plain.center.y); // it does move up
    expect(bottom(out)).toBeLessThanOrEqual(VIEW.height - FIT.margin + 1e-9);
  });

  it('does not move when the base has no room below', () => {
    const b = { left: 900, right: 1660, top: 380, bottom: 1180 };
    expect(fitView(b, VIEW, { ...FIT, hudTopInsetPx: 240 })).toEqual(fitView(b, VIEW, FIT));
  });
});

describe('hudTopInsetAt (WP22 F11, inset follows the UI scale)', () => {
  it('gives 240 / 304 / 368 at UI 100 / 125 / 150', () => {
    expect(hudTopInsetAt(240, 100, 16)).toBe(240);
    expect(hudTopInsetAt(240, 125, 16)).toBe(304);
    expect(hudTopInsetAt(240, 150, 16)).toBe(368);
  });

  it('falls back to UI 100 for an invalid scale and never pads below 100', () => {
    expect(hudTopInsetAt(240, Number.NaN, 16)).toBe(240);
    expect(hudTopInsetAt(240, 0, 16)).toBe(240);
    expect(hudTopInsetAt(240, -50, 16)).toBe(240);
    expect(hudTopInsetAt(240, 50, 16)).toBe(120);
  });

  it('matches the CAMERA data at UI 100 (store shots and UI 100 framing unchanged)', () => {
    expect(hudTopInsetAt(CAMERA.hudTopInsetPx, 100, CAMERA.hudTopInsetPadPx)).toBe(CAMERA.hudTopInsetPx);
  });

  it('keeps a fitted machine top below the UI 150 inset when the base has room', () => {
    const fit: FitViewOptions = {
      margin: 72, pixelScale: 2, minZoom: 0.5, maxZoom: 2, defaultZoom: 1,
      defaultCenter: { ...OLD_FOCUS }, world: OLD_WORLD,
    };
    const b: Bounds = { left: 1000, top: 700, right: 2232, bottom: 900 }; // zoom 0.75, unshifted top screen y 285
    const inset = hudTopInsetAt(CAMERA.hudTopInsetPx, 150, CAMERA.hudTopInsetPadPx);
    const out = fitView(b, VIEW, { ...fit, hudTopInsetPx: inset });
    const top = (b.top - out.center.y) * out.zoom + VIEW.height / 2;
    const base = (b.bottom - out.center.y) * out.zoom + VIEW.height / 2;
    expect(out.zoom).toBe(0.75);
    expect(top).toBeCloseTo(inset, 6);
    expect(base).toBeLessThanOrEqual(VIEW.height - fit.margin + 1e-9);
  });
});

describe('hudSafeCenterY (WP22 F11, release nudge vs HUD inset)', () => {
  // machine top world y 1344, zoom 0.75, view height 720, inset 368 -> limit 1344 - 8 / 0.75 = 1333.33
  const LIMIT = 1344 - (368 - 360) / 0.75;

  it('passes a pan that keeps the top below the inset', () => {
    expect(hudSafeCenterY(1300, 1320, 1344, 0.75, 720, 368)).toBe(1300);
    expect(hudSafeCenterY(LIMIT, 1320, 1344, 0.75, 720, 368)).toBe(LIMIT);
  });

  it('stops a downward pan at the limit (the Era II UI 150 case: 1333 -> 1438 is held at 1333.33)', () => {
    expect(hudSafeCenterY(1438, 1333, 1344, 0.75, 720, 368)).toBeCloseTo(LIMIT, 9);
  });

  it('never pans further down when the top already sits under the HUD, but still allows an upward pan', () => {
    expect(hudSafeCenterY(1500, 1450, 1344, 0.75, 720, 368)).toBe(1450);
    expect(hudSafeCenterY(1400, 1450, 1344, 0.75, 720, 368)).toBe(1400);
  });

  it('is the identity at UI 100 for the framing fitView already chose', () => {
    const limit100 = 1344 - (240 - 360) / 0.75; // 1504, the UI 100 Era II centre
    expect(hudSafeCenterY(limit100, limit100, 1344, 0.75, 720, 240)).toBe(1504);
  });
});

describe('fitView fullView (ART_ERA5 F2, min zoom framing)', () => {
  const FULL: FitViewOptions = {
    margin: CAMERA.fitMarginPx,
    pixelScale: PIXEL_SCALE,
    minZoom: effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom),
    maxZoom: CAMERA.maxZoom,
    defaultZoom: CAMERA.defaultZoom,
    defaultCenter: { x: CAMERA.focus.x, y: CAMERA.focus.y },
    world: WORLD,
    hudTopInsetPx: CAMERA.hudTopInsetPx,
    fullView: { groundY: GROUND_Y, groundBandPx: CAMERA.fullViewGroundBandPx, topMinPx: CAMERA.fullViewTopMinPx },
  };

  /** Screen y of a world y for a fitted view. */
  function screenY(worldY: number, out: { center: { y: number }; zoom: number }): number {
    return (worldY - out.center.y) * out.zoom + VIEW.height / 2;
  }

  it('Era V bounds {-560, 560, -616, 8} at min zoom put the ground line at screen y 640', () => {
    const b = boundsToWorld({ left: -560, right: 560, top: -616, bottom: 8 }, MACHINE_ANCHOR);
    const out = fitView(b, VIEW, FULL);
    expect(out.zoom).toBe(0.5);
    expect(screenY(GROUND_Y, out)).toBeCloseTo(640, 9);
    expect(out.center.y).toBeCloseTo(GROUND_Y - 280 / 0.5, 9);
  });

  it('a short machine at min zoom keeps the ground line at H - groundBandPx (screen y 560, centre GROUND_Y - 400)', () => {
    const b: Bounds = { left: 0, top: GROUND_Y - 200, right: 2600, bottom: GROUND_Y + 8 };
    const out = fitView(b, VIEW, FULL);
    expect(out.zoom).toBe(0.5);
    expect(screenY(GROUND_Y, out)).toBeCloseTo(560, 9);
    expect(out.center.y).toBeCloseTo(GROUND_Y - 400, 9);
  });

  it('a tall machine at min zoom is lowered so its top sits at topMinPx (ground at screen y 600), base within the margin', () => {
    const b: Bounds = { left: 0, top: GROUND_Y - 1152, right: 2600, bottom: GROUND_Y + 8 };
    const out = fitView(b, VIEW, FULL);
    expect(out.zoom).toBe(0.5);
    expect(screenY(GROUND_Y, out)).toBeCloseTo(600, 9);
    expect(screenY(b.top, out)).toBeCloseTo(CAMERA.fullViewTopMinPx, 9);
    expect(screenY(b.bottom, out)).toBeLessThanOrEqual(VIEW.height - CAMERA.fitMarginPx + 1e-9);
  });

  it('zoom above the min is unchanged by fullView', () => {
    const b: Bounds = { left: 1000, top: 500, right: 2232, bottom: 900 }; // zoom 0.75
    const plain = fitView(b, VIEW, { ...FULL, fullView: undefined });
    expect(plain.zoom).toBe(0.75);
    expect(fitView(b, VIEW, FULL)).toEqual(plain);
  });
});
