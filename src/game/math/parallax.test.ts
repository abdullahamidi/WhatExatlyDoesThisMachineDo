import { describe, it, expect } from 'vitest';
import { parallaxPosition, parallaxSpan, isLayerVisible, fadeStep } from './parallax';
import { clampCenter } from './camera';
import { VIEW, WORLD, CAMERA } from '../../data/world';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';

describe('parallaxPosition', () => {
  it('places a sf 0.15 layer at the expected position for a non-centre focus', () => {
    const p = parallaxPosition({ x: 0, y: 1320 }, { x: 1280, y: 960 }, VIEW, 0.15);
    expect(p.x).toBeCloseTo(-544, 9);
    expect(p.y).toBeCloseTo(810, 9);
  });

  it('uses the layer focus from the camera constants', () => {
    const p = parallaxPosition({ x: 500, y: 900 }, CAMERA.focus, VIEW, 0.55);
    expect(p.x).toBeCloseTo(500 - 0.45 * (CAMERA.focus.x - 640), 9);
    expect(p.y).toBeCloseTo(900 - 0.45 * (CAMERA.focus.y - 360), 9);
  });

  it('is the identity for sf 1 at any focus', () => {
    const focuses = [{ x: 0, y: 0 }, { x: 1280, y: 960 }, { x: 2560, y: 1440 }];
    for (const focus of focuses) {
      expect(parallaxPosition({ x: 333, y: 444 }, focus, VIEW, 1)).toEqual({ x: 333, y: 444 });
    }
  });

  it('subtracts the full scroll offset for sf 0', () => {
    const focus = { x: 1280, y: 960 };
    const p = parallaxPosition({ x: 100, y: 200 }, focus, VIEW, 0);
    expect(p.x).toBeCloseTo(100 - (focus.x - 640), 9);
    expect(p.y).toBeCloseTo(200 - (focus.y - 360), 9);
  });

  it('is the identity for every sf when focus is the view centre', () => {
    const centre = { x: VIEW.width / 2, y: VIEW.height / 2 };
    for (const sf of [0, 0.15, 0.3, 0.55, 1]) {
      const p = parallaxPosition({ x: 77, y: 88 }, centre, VIEW, sf);
      expect(p.x).toBeCloseTo(77, 9);
      expect(p.y).toBeCloseTo(88, 9);
    }
  });
});

describe('parallaxSpan', () => {
  it('matches the exact expectations for a 2560 world and 1280 view at minZoom 0.5', () => {
    const s1 = parallaxSpan(2560, 1280, 0.5, 1);
    expect(s1.min).toBeCloseTo(0, 9);
    expect(s1.max).toBeCloseTo(2560, 9);
    const s0 = parallaxSpan(2560, 1280, 0.5, 0);
    expect(s0.min).toBeCloseTo(-640, 9);
    expect(s0.max).toBeCloseTo(1920, 9);
    const s5 = parallaxSpan(2560, 1280, 0.5, 0.5);
    expect(s5.min).toBeCloseTo(-320, 9);
    expect(s5.max).toBeCloseTo(2240, 9);
    const s15 = parallaxSpan(2560, 1280, 0.5, 0.15);
    expect(s15.min).toBeCloseTo(-544, 9);
    expect(s15.max).toBeCloseTo(2016, 9);
  });

  it('has a constant width of worldLen when viewLen / minZoom equals worldLen', () => {
    for (const sf of [0, 0.15, 0.3, 0.55, 1]) {
      const s = parallaxSpan(2560, 1280, 0.5, sf);
      expect(s.max - s.min).toBeCloseTo(2560, 9);
    }
  });

  it('has width sf * worldLen + (1 - sf) * viewLen / minZoom for a non-fitting view', () => {
    for (const sf of [0, 0.3, 0.55, 1]) {
      const s = parallaxSpan(3000, 1000, 0.5, sf);
      expect(s.max - s.min).toBeCloseTo(sf * 3000 + (1 - sf) * 2000, 9);
    }
  });

  it('contains every visible interval for the clamped camera extremes', () => {
    const view = { width: 1280, height: 720 };
    const world = { width: 2560, height: 1440 };
    const minZoom = 0.5;
    for (const sf of [0, 0.15, 0.3, 0.55, 1]) {
      const { min, max } = parallaxSpan(world.width, view.width, minZoom, sf);
      for (const zoom of [0.5, 1, 2]) {
        const low = clampCenter({ x: -1e9, y: 0 }, zoom, view, world).x;
        const high = clampCenter({ x: 1e9, y: 0 }, zoom, view, world).x;
        for (const c of [low, high]) {
          const lo = sf * (c - 640) + 640 - 640 / zoom;
          const hi = sf * (c - 640) + 640 + 640 / zoom;
          expect(lo).toBeGreaterThanOrEqual(min - 1e-9);
          expect(hi).toBeLessThanOrEqual(max + 1e-9);
        }
      }
    }
  });
});

function levelsWith(id: TechId, level: number): Record<TechId, number> {
  const out = {} as Record<TechId, number>;
  for (const t of TECH_IDS) out[t] = 0;
  out[id] = level;
  return out;
}

describe('isLayerVisible', () => {
  const gated = { visibleWhen: { techId: 'powerLines' as TechId, minLevel: 1 } };

  it('is true for a layer without visibleWhen', () => {
    expect(isLayerVisible({}, levelsWith('powerLines', 0))).toBe(true);
  });

  it('is false below the minimum level and true at and above it', () => {
    expect(isLayerVisible(gated, levelsWith('powerLines', 0))).toBe(false);
    expect(isLayerVisible(gated, levelsWith('powerLines', 1))).toBe(true);
    expect(isLayerVisible(gated, levelsWith('powerLines', 3))).toBe(true);
  });

  it('ignores levels of other techs', () => {
    expect(isLayerVisible(gated, levelsWith('generator', 5))).toBe(false);
  });
});

describe('fadeStep', () => {
  it('moves linearly by deltaMs / fadeMs', () => {
    expect(fadeStep(0, 1, 300, 1500)).toBeCloseTo(0.2, 9);
    expect(fadeStep(0.5, 0, 150, 1500)).toBeCloseTo(0.4, 9);
    expect(fadeStep(0.2, 1, 750, 1500)).toBeCloseTo(0.7, 9);
  });

  it('clamps at the target from below and from above', () => {
    expect(fadeStep(0.9, 1, 10000, 1500)).toBe(1);
    expect(fadeStep(0.1, 0, 10000, 1500)).toBe(0);
    expect(fadeStep(1, 1, 16, 1500)).toBe(1);
    expect(fadeStep(0, 0, 16, 1500)).toBe(0);
  });

  it('jumps to the target when fadeMs is 0', () => {
    expect(fadeStep(0, 1, 16, 0)).toBe(1);
    expect(fadeStep(1, 0, 16, 0)).toBe(0);
  });

  it('keeps the current value for a non-finite delta', () => {
    expect(fadeStep(0.3, 1, Number.NaN, 1500)).toBe(0.3);
    expect(fadeStep(0.3, 0, Number.POSITIVE_INFINITY, 1500)).toBe(0.3);
  });

  it('keeps the result in [0, 1] for out-of-range targets', () => {
    const v = fadeStep(0.5, 3, 100, 1500);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
    expect(fadeStep(0.99, 2, 1e6, 1500)).toBe(1);
  });
});
