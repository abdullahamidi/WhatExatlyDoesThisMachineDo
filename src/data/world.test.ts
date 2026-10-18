import { describe, it, expect } from 'vitest';
import { PARALLAX_LAYERS, GROUND_SHADE, GROUND_Y, WORLD, FLOATING_TEXT, CRANK_PULSE, CAMERA, DEPTH, PARALLAX_FADE_MS, PYLON_LINE } from './world';
import type { ParallaxLayerDef } from './world';
import { TOAST_CONFIG } from './notifications';

function layer(id: string): ParallaxLayerDef {
  const found = PARALLAX_LAYERS.find((l) => l.id === id);
  if (!found) throw new Error(`missing parallax layer ${id}`);
  return found;
}

describe('PARALLAX_LAYERS haze', () => {
  it('pylons are hazed with alpha 0.45 and tint 0xb8a98f', () => {
    expect(layer('pylons').alpha).toBe(0.45);
    expect(layer('pylons').tint).toBe(0xb8a98f);
  });

  it('skyline alpha is 0.4', () => {
    expect(layer('skyline').alpha).toBe(0.4);
  });

  it('mountains and sky keep their alpha', () => {
    expect(layer('mountains').alpha).toBe(0.45);
    expect(layer('sky').alpha).toBe(1);
  });

  it('every layer other than pylons has no tint', () => {
    for (const l of PARALLAX_LAYERS) {
      if (l.id === 'pylons') continue;
      expect(l.tint).toBeUndefined();
    }
  });

  it('every alpha is in (0, 1]', () => {
    for (const l of PARALLAX_LAYERS) {
      expect(l.alpha).toBeGreaterThan(0);
      expect(l.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('layer ids are unique', () => {
    const ids = PARALLAX_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('PARALLAX_LAYERS Era II pylons', () => {
  it('pylonsLit is the last layer and is gated on powerLines level 1', () => {
    expect(PARALLAX_LAYERS[PARALLAX_LAYERS.length - 1]?.id).toBe('pylonsLit');
    expect(layer('pylonsLit').visibleWhen).toEqual({ techId: 'powerLines', minLevel: 1 });
  });

  it('pylonsLit has no tint, alpha 0.7 and depth background + 31', () => {
    expect(layer('pylonsLit').tint).toBeUndefined();
    expect(layer('pylonsLit').alpha).toBe(0.7);
    expect(layer('pylonsLit').depth).toBe(DEPTH.background + 31);
  });

  it('pylonsLit shares scrollFactor and bottomY with pylons', () => {
    expect(layer('pylonsLit').scrollFactor).toBe(layer('pylons').scrollFactor);
    expect(layer('pylonsLit').bottomY).toBe(layer('pylons').bottomY);
  });

  it('only pylonsLit has visibleWhen among the existing layers', () => {
    for (const l of PARALLAX_LAYERS) {
      if (l.id === 'pylonsLit') continue;
      expect(l.visibleWhen).toBeUndefined();
    }
  });
});

describe('camera auto-frame and pylon line', () => {
  it('auto-frame is on with a 48 px margin', () => {
    expect(CAMERA.fitMarginPx).toBe(48);
    expect(CAMERA.autoFrame).toBe(true);
  });

  it('parallax fade lasts 1500 ms', () => {
    expect(PARALLAX_FADE_MS).toBe(1500);
  });

  it('pylon line has four anchors inside the 256 px art, positive sag and a visible thickness', () => {
    expect(PYLON_LINE.anchorsArt.length).toBe(4);
    for (const a of PYLON_LINE.anchorsArt) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(256);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(256);
    }
    expect(PYLON_LINE.sagFraction).toBeGreaterThan(0);
    expect(PYLON_LINE.thicknessPx).toBeGreaterThanOrEqual(1);
  });
});

describe('TOAST_CONFIG', () => {
  it('shows at most two toasts', () => {
    expect(TOAST_CONFIG.maxVisible).toBe(2);
  });
});

describe('GROUND_SHADE', () => {
  it('band starts are strictly ascending, non-negative and inside the ground', () => {
    const starts = GROUND_SHADE.bandStarts;
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i] as number;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(WORLD.height - GROUND_Y);
      if (i > 0) expect(s).toBeGreaterThan(starts[i - 1] as number);
    }
  });

  it('alphas are in (0, 1]', () => {
    expect(GROUND_SHADE.alpha).toBeGreaterThan(0);
    expect(GROUND_SHADE.alpha).toBeLessThanOrEqual(1);
    expect(GROUND_SHADE.haze.alpha).toBeGreaterThan(0);
    expect(GROUND_SHADE.haze.alpha).toBeLessThanOrEqual(1);
  });

  it('haze height is positive', () => {
    expect(GROUND_SHADE.haze.height).toBeGreaterThan(0);
  });
});

describe('FLOATING_TEXT and CRANK_PULSE', () => {
  it('floating text colour is a 6-digit hex string', () => {
    expect(FLOATING_TEXT.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('crank pulse peak alpha is in (0, 1] and period is positive', () => {
    expect(CRANK_PULSE.alphaPeak).toBeGreaterThan(0);
    expect(CRANK_PULSE.alphaPeak).toBeLessThanOrEqual(1);
    expect(CRANK_PULSE.periodMs).toBeGreaterThan(0);
  });
});
