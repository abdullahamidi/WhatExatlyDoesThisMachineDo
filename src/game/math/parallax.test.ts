import { describe, it, expect } from 'vitest';
import {
  parallaxPosition, parallaxSpan, parallaxStrip, isLayerVisible, fadeStep, layerFadeMs,
  patternShift, layerPhase, stageAlpha, stageFrame, skyPxToScrollZero,
} from './parallax';
import { clampCenter, effectiveMinZoom } from './camera';
import { VIEW, WORLD, CAMERA, PARALLAX_LAYERS, PARALLAX_FADE_MS, ERA5_SKY_FADE_IN_MS, PIXEL_SCALE, PATTERN_ORIGIN_X } from '../../data/world';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';

// Pre-WP11 game world: the legacy focus x (1280) and world (2560 x 1440) for the invariance checks.
const OLD_WORLD = { width: 2560, height: 1440 } as const;
const OLD_FOCUS_X = 1280;

describe('parallaxStrip', () => {
  it('matches parallaxSpan and parallaxPosition for the powerLines layer geometry', () => {
    const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
    const strip = parallaxStrip({
      scrollFactor: 0.15, bottomY: 1320, artHeight: 256, scale: 2,
      world: WORLD, view: VIEW, focus: { x: 1280, y: 960 }, minZoom,
    });
    const span = parallaxSpan(WORLD.width, VIEW.width, minZoom, 0.15);
    const pos = parallaxPosition({ x: 0, y: 1320 }, { x: 1280, y: 960 }, VIEW, 0.15);
    expect(strip.left).toBeCloseTo(span.min, 9);
    expect(strip.width).toBeCloseTo(span.max - span.min, 9);
    expect(strip.bottom).toBeCloseTo(pos.y, 9);
  });

  it('takes the height from the art height times scale, not the width', () => {
    const base = { scrollFactor: 0.55, bottomY: 1000, world: WORLD, view: VIEW, focus: { x: 1280, y: 960 }, minZoom: 0.5 };
    expect(parallaxStrip({ ...base, artHeight: 128, scale: 3 }).height).toBe(384);
    expect(parallaxStrip({ ...base, artHeight: 256, scale: 2 }).height).toBe(512);
  });

  it('has a width equal to the world width when the view fits the world at minZoom', () => {
    const strip = parallaxStrip({
      scrollFactor: 1, bottomY: 0, artHeight: 10, scale: 1, world: WORLD, view: VIEW, focus: CAMERA.focus, minZoom: 0.5,
    });
    expect(strip.left).toBeCloseTo(0, 9);
    expect(strip.width).toBeCloseTo(WORLD.width, 9);
    expect(strip.bottom).toBeCloseTo(0, 9);
  });
});

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

describe('layerFadeMs (WP26 C5)', () => {
  const sky = { fadeInMs: ERA5_SKY_FADE_IN_MS };
  const byId = (id: string) => {
    const found = PARALLAX_LAYERS.find((l) => l.id === id);
    if (!found) throw new Error(`missing parallax layer ${id}`);
    return found;
  };

  it('a rising layer with the slow option on fades over fadeInMs', () => {
    expect(layerFadeMs(sky, 0, 0.25, true)).toBe(ERA5_SKY_FADE_IN_MS);
    expect(layerFadeMs(sky, 0.5, 0.75, true)).toBe(ERA5_SKY_FADE_IN_MS);
  });

  it('a falling layer keeps PARALLAX_FADE_MS, even with the slow option on', () => {
    expect(layerFadeMs(sky, 0.5, 0.25, true)).toBe(PARALLAX_FADE_MS);
    expect(layerFadeMs(sky, 1, 0, true)).toBe(PARALLAX_FADE_MS);
  });

  it('a layer already at its target keeps PARALLAX_FADE_MS', () => {
    expect(layerFadeMs(sky, 0.25, 0.25, true)).toBe(PARALLAX_FADE_MS);
  });

  it('a layer without fadeInMs keeps fadeMs ?? PARALLAX_FADE_MS, even with the slow option on', () => {
    expect(layerFadeMs({}, 0, 1, true)).toBe(PARALLAX_FADE_MS);
    expect(layerFadeMs({ fadeMs: 6000 }, 0, 1, true)).toBe(6000);
  });

  it('with the slow option off every layer keeps fadeMs ?? PARALLAX_FADE_MS', () => {
    expect(layerFadeMs(sky, 0, 0.25, false)).toBe(PARALLAX_FADE_MS);
    expect(layerFadeMs({ fadeMs: 6000, fadeInMs: ERA5_SKY_FADE_IN_MS }, 0, 1, false)).toBe(6000);
  });

  it('a layer with both fadeMs and fadeInMs uses fadeInMs only when rising under the slow option', () => {
    const both = { fadeMs: 6000, fadeInMs: ERA5_SKY_FADE_IN_MS };
    expect(layerFadeMs(both, 0, 1, true)).toBe(ERA5_SKY_FADE_IN_MS);
    expect(layerFadeMs(both, 1, 0, true)).toBe(6000);
    expect(layerFadeMs(both, 0, 1, false)).toBe(6000);
  });

  it('the era V sky layers rise over fadeInMs and the skyline keeps PARALLAX_FADE_MS', () => {
    expect(layerFadeMs(byId('skyViolet'), 0, 0.25, true)).toBe(ERA5_SKY_FADE_IN_MS);
    expect(layerFadeMs(byId('horizonGlow'), 0, 0.35, true)).toBe(ERA5_SKY_FADE_IN_MS);
    expect(layerFadeMs(byId('skyline'), 0, 1, true)).toBe(PARALLAX_FADE_MS);
  });

  it('a 0.25 stage fades in 16 ms frames without a jump and takes at least 4000 ms', () => {
    const def = byId('skyViolet');
    const frameMs = 16;
    const maxStep = frameMs / ERA5_SKY_FADE_IN_MS + 1e-12;
    let fade = 0;
    let elapsed = 0;
    while (fade < 0.25 && elapsed < 60000) {
      const next = fadeStep(fade, 0.25, frameMs, layerFadeMs(def, fade, 0.25, true));
      expect(next - fade).toBeGreaterThan(0);
      expect(next - fade).toBeLessThanOrEqual(maxStep);
      fade = next;
      elapsed += frameMs;
    }
    expect(fade).toBe(0.25);
    expect(elapsed).toBeGreaterThanOrEqual(4000);
  });
});

describe('patternShift', () => {
  it('is 0 for scroll factor 0', () => {
    expect(patternShift(0, 1920, 1280, 512)).toBe(0);
  });

  it('is 0 when the focus equals the origin', () => {
    expect(patternShift(0.55, 1280, 1280, 512)).toBe(0);
    expect(patternShift(0.3, PATTERN_ORIGIN_X, PATTERN_ORIGIN_X, 1024)).toBe(0);
  });

  it('wraps sf * (focus - origin) into [0, period)', () => {
    expect(patternShift(0.3, 1920, 1280, 1024)).toBeCloseTo(192, 9);
    expect(patternShift(0.55, 1920, 1280, 512)).toBeCloseTo(352, 9);
    expect(patternShift(1, 1920, 1280, 512)).toBeCloseTo(128, 9);
  });

  it('stays in [0, period) for a negative focus - origin', () => {
    const v = patternShift(0.3, 1000, 1280, 1024);
    expect(v).toBeCloseTo(940, 9);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1024);
  });

  it('returns +0 for an exact multiple of the period', () => {
    const v = patternShift(1, 1280 + 512, 1280, 512);
    expect(v).toBe(0);
    expect(Object.is(v, -0)).toBe(false);
  });

  it('never returns -0 and stays in [0, period) over a grid', () => {
    for (const sf of [-1, -0.5, 0, 0.15, 0.3, 0.55, 1]) {
      for (const focus of [0, 1000, 1280, 1920, 2560]) {
        for (const origin of [0, 1280]) {
          for (const period of [256, 512, 1024]) {
            const v = patternShift(sf, focus, origin, period);
            expect(Object.is(v, -0)).toBe(false);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(period);
          }
        }
      }
    }
  });

  it('returns 0 for non-finite input or a non-positive period', () => {
    expect(patternShift(Number.NaN, 1920, 1280, 512)).toBe(0);
    expect(patternShift(Number.POSITIVE_INFINITY, 1920, 1280, 512)).toBe(0);
    expect(patternShift(0.3, 1920, 1280, 0)).toBe(0);
  });
});

describe('layerPhase', () => {
  it('returns the art width times scale as the period and the pattern shift', () => {
    expect(layerPhase(0.3, 512, 2)).toEqual({
      periodPx: 1024,
      phaseShiftPx: patternShift(0.3, CAMERA.focus.x, PATTERN_ORIGIN_X, 1024),
    });
  });

  it('gives the ground tile (sf 1, 256 art px, scale 2) a shift of 128 and a period of 512', () => {
    expect(layerPhase(1, 256, PIXEL_SCALE)).toEqual({ periodPx: 512, phaseShiftPx: 128 });
  });
});

describe('parallaxStrip pattern phase', () => {
  const base = {
    scrollFactor: 0.55, bottomY: 1000, artHeight: 256, scale: 2,
    world: WORLD, view: VIEW, focus: { x: 1280, y: 960 }, minZoom: 0.5,
  };

  it('is unchanged when neither phase field is given', () => {
    expect(parallaxStrip(base)).toEqual(parallaxStrip({ ...base }));
  });

  it('is unchanged when only one of the two phase fields is given', () => {
    const plain = parallaxStrip(base);
    expect(parallaxStrip({ ...base, phaseShiftPx: 100 })).toEqual(plain);
    expect(parallaxStrip({ ...base, periodPx: 512 })).toEqual(plain);
  });

  it('starts one period early plus the shift and widens by one period when both are given', () => {
    const plain = parallaxStrip(base);
    const phased = parallaxStrip({ ...base, phaseShiftPx: 100, periodPx: 512 });
    expect(phased.left).toBeCloseTo(plain.left - 512 + 100, 9);
    expect(phased.width).toBeCloseTo(plain.width + 512, 9);
    expect(phased.bottom).toBe(plain.bottom);
    expect(phased.height).toBe(plain.height);
  });
});

describe('pattern invariance (WP11 world growth)', () => {
  // Tile boundaries must land where the legacy camera (focus x 1280) put them, modulo the period.
  const cases: Array<{ name: string; sf: number; artWidth: number }> = [
    ...PARALLAX_LAYERS.filter((l) => l.scrollFactor > 0).flatMap((l) => [
      { name: `${l.id} art 256`, sf: l.scrollFactor, artWidth: 256 },
      { name: `${l.id} art 512`, sf: l.scrollFactor, artWidth: 512 },
    ]),
    { name: 'ground', sf: 1, artWidth: 256 },
  ];

  for (const c of cases) {
    it(`${c.name}: tile boundaries sit where the legacy camera put them`, () => {
      const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
      const { periodPx, phaseShiftPx } = layerPhase(c.sf, c.artWidth, PIXEL_SCALE);
      expect(phaseShiftPx).toBeGreaterThanOrEqual(0);
      expect(phaseShiftPx).toBeLessThan(periodPx);
      const now = parallaxStrip({
        scrollFactor: c.sf, bottomY: 0, artHeight: c.artWidth, scale: PIXEL_SCALE,
        world: WORLD, view: VIEW, focus: CAMERA.focus, minZoom, phaseShiftPx, periodPx,
      });
      const legacy = parallaxStrip({
        scrollFactor: c.sf, bottomY: 0, artHeight: c.artWidth, scale: PIXEL_SCALE,
        world: OLD_WORLD, view: VIEW, focus: { x: OLD_FOCUS_X, y: 960 }, minZoom,
      });
      // screen x of an object at world x when the camera is centred on focusX: x - sf * (focusX - view / 2)
      const screenX = (x: number, focusX: number): number => x - c.sf * (focusX - VIEW.width / 2);
      for (let k = -3; k <= 6; k++) {
        const d = screenX(now.left + k * periodPx, CAMERA.focus.x) - screenX(legacy.left + k * periodPx, OLD_FOCUS_X);
        const r = ((d % periodPx) + periodPx) % periodPx;
        expect(Math.min(r, periodPx - r)).toBeLessThan(1e-9);
      }
    });
  }
});

function levelsOf(entries: Partial<Record<TechId, number>>): Record<TechId, number> {
  const out = {} as Record<TechId, number>;
  for (const t of TECH_IDS) out[t] = 0;
  for (const [id, level] of Object.entries(entries)) {
    if (level !== undefined && id in out) out[id as TechId] = level;
  }
  return out;
}

describe('stageAlpha', () => {
  const STAGES: readonly { techId: TechId; minLevel: number; alpha: number }[] = [
    { techId: 'gearRatio', minLevel: 1, alpha: 0.25 },
    { techId: 'wornMotor', minLevel: 1, alpha: 0.5 },
    { techId: 'powerLines', minLevel: 5, alpha: 0.75 },
    { techId: 'resonatorSpire', minLevel: 1, alpha: 1 },
  ];

  it('is 0 when no stage is met', () => {
    expect(stageAlpha(STAGES, levelsOf({}))).toBe(0);
    expect(stageAlpha(STAGES, levelsOf({ powerLines: 4 }))).toBe(0);
  });

  it('is the alpha of the one met stage', () => {
    expect(stageAlpha(STAGES, levelsOf({ gearRatio: 1 }))).toBe(0.25);
    expect(stageAlpha(STAGES, levelsOf({ resonatorSpire: 1 }))).toBe(1);
  });

  it('is the max alpha over several met stages, even when a later stage has a lower alpha', () => {
    expect(stageAlpha(STAGES, levelsOf({ gearRatio: 1, wornMotor: 1 }))).toBe(0.5);
    expect(stageAlpha(STAGES, levelsOf({ wornMotor: 1, powerLines: 5, gearRatio: 1 }))).toBe(0.75);
    expect(stageAlpha([{ techId: 'wornMotor', minLevel: 1, alpha: 0.9 }, { techId: 'gearRatio', minLevel: 1, alpha: 0.2 }],
      levelsOf({ wornMotor: 1, gearRatio: 1 }))).toBe(0.9);
  });

  it('is 0 for an empty stage list', () => {
    expect(stageAlpha([], levelsOf({ gearRatio: 9 }))).toBe(0);
  });
});

describe('stageFrame', () => {
  const STAGES: readonly { techId: TechId; minLevel: number; frame: number }[] = [
    { techId: 'gearRatio', minLevel: 1, frame: 1 },
    { techId: 'wornMotor', minLevel: 1, frame: 2 },
    { techId: 'powerLines', minLevel: 5, frame: 3 },
    { techId: 'resonatorSpire', minLevel: 1, frame: 5 },
  ];

  it('is 0 when no stage is met', () => {
    expect(stageFrame(STAGES, levelsOf({}))).toBe(0);
  });

  it('is the frame of the only met stage', () => {
    expect(stageFrame(STAGES, levelsOf({ gearRatio: 1 }))).toBe(1);
  });

  it('is the frame of the last met stage in list order', () => {
    expect(stageFrame(STAGES, levelsOf({ gearRatio: 1, wornMotor: 1 }))).toBe(2);
    expect(stageFrame(STAGES, levelsOf({ gearRatio: 1, resonatorSpire: 1 }))).toBe(5);
  });

  it('ignores a stage whose minLevel is not reached', () => {
    expect(stageFrame(STAGES, levelsOf({ gearRatio: 1, powerLines: 4 }))).toBe(1);
  });
});

describe('skyPxToScrollZero', () => {
  it('maps the violet sky eclipse point {372, 290} to {104, 220} at minZoom 0.5 on the 1280 x 720 view', () => {
    const p = skyPxToScrollZero({ x: 372, y: 290 }, VIEW, 0.5);
    expect(p.x).toBeCloseTo(104, 9);
    expect(p.y).toBeCloseTo(220, 9);
  });

  it('returns the input at minZoom 1', () => {
    const p = skyPxToScrollZero({ x: 372, y: 290 }, VIEW, 1);
    expect(p.x).toBeCloseTo(372, 9);
    expect(p.y).toBeCloseTo(290, 9);
  });
});
