import { describe, it, expect } from 'vitest';
import { PARALLAX_LAYERS, GROUND_SHADE, GROUND_Y, WORLD, FLOATING_TEXT, CRANK_PULSE, CAMERA, DEPTH, PARALLAX_FADE_MS, PYLON_LINE, PYLON_FEEDS, MACHINE_ANCHOR, PIXEL_SCALE, DUST, DUST_RISING, PATTERN_ORIGIN_X } from './world';
import type { ParallaxLayerDef } from './world';
import { TOAST_CONFIG } from './notifications';
import { MACHINE_BOUNDS, MACHINE_COMPONENTS } from './machineComponents';
import { TECH_IDS } from './types';

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
    expect(CAMERA.fitMarginPx).toBe(72);
    expect(CAMERA.autoFrame).toBe(true);
  });

  it('auto-frame keeps the machine top 240 px below the top of the view (HUD inset)', () => {
    expect(CAMERA.hudTopInsetPx).toBe(240);
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

describe('PYLON_FEEDS (WP9 CR-A world-space cable feeds)', () => {
  it('has two feeds, mast and turbine, in that order', () => {
    expect(PYLON_FEEDS.map((f) => f.id)).toEqual(['mast', 'turbine']);
  });

  it('the mast feed has no gate and takes anchors on its right side', () => {
    const mast = PYLON_FEEDS[0];
    expect(mast?.gate).toBeUndefined();
    expect(mast?.side).toBe('any');
  });

  it('the turbine feed is gated on turbine level 1 and takes anchors on its left side', () => {
    const turbine = PYLON_FEEDS[1];
    expect(turbine?.side).toBe('left');
    expect(turbine?.gate).toEqual({ techId: 'turbine', minLevel: 1 });
  });

  it('the turbine feed leads its cable up from the export to (-374, -94) above the casing', () => {
    expect(PYLON_FEEDS[1]?.leadTo).toEqual({ x: -374, y: -94 });
    expect(PYLON_FEEDS[0]?.leadTo).toBeUndefined();
  });

  it('each feed names an existing component and one of its connection points', () => {
    for (const feed of PYLON_FEEDS) {
      const def = MACHINE_COMPONENTS[feed.component];
      expect(def, feed.id).toBeDefined();
      expect(def.connections.some((c) => c.id === feed.point), feed.id).toBe(true);
    }
  });

  it('the machine fits the world: its left and top bounds stay on screen at the machine anchor', () => {
    expect(MACHINE_ANCHOR.x + PIXEL_SCALE * MACHINE_BOUNDS.left).toBeGreaterThanOrEqual(0);
    expect(MACHINE_ANCHOR.y + PIXEL_SCALE * MACHINE_BOUNDS.top).toBeGreaterThanOrEqual(0);
    expect(MACHINE_ANCHOR.x + PIXEL_SCALE * MACHINE_BOUNDS.right).toBeLessThanOrEqual(WORLD.width);
  });

  it('MACHINE_BOUNDS encloses the era IV box (-448..448 x, -470..8 y art px)', () => {
    expect(MACHINE_BOUNDS.left).toBeLessThanOrEqual(-448);
    expect(MACHINE_BOUNDS.right).toBeGreaterThanOrEqual(448);
    expect(MACHINE_BOUNDS.top).toBeLessThanOrEqual(-470);
    expect(MACHINE_BOUNDS.bottom).toBeGreaterThanOrEqual(8);
  });

  it('the machine top stays on the world: its top edge is at or below the top of the world at the machine anchor', () => {
    expect(MACHINE_ANCHOR.y + PIXEL_SCALE * MACHINE_BOUNDS.top).toBeGreaterThanOrEqual(0);
  });
});

describe('WP11 world growth (C2)', () => {
  it('world is 3840 x 2160 with the ground line at 1680', () => {
    expect(WORLD).toEqual({ width: 3840, height: 2160 });
    expect(GROUND_Y).toBe(1680);
  });

  it('machine anchor sits on the ground line at the world centre x', () => {
    expect(MACHINE_ANCHOR).toEqual({ x: 1920, y: 1680 });
    expect(MACHINE_ANCHOR.x).toBe(WORLD.width / 2);
  });

  it('camera focus is 160 world px above the ground line at the anchor x, and inside the world', () => {
    expect(CAMERA.focus).toEqual({ x: MACHINE_ANCHOR.x, y: GROUND_Y - 160 });
    expect(CAMERA.focus.x).toBeGreaterThanOrEqual(0);
    expect(CAMERA.focus.x).toBeLessThanOrEqual(WORLD.width);
    expect(CAMERA.focus.y).toBeGreaterThanOrEqual(0);
    expect(CAMERA.focus.y).toBeLessThanOrEqual(WORLD.height);
  });

  it('camera minZoom is the explicit 0.5 floor', () => {
    expect(CAMERA.minZoom).toBe(0.5);
  });

  it('pattern origin is the pre-WP11 anchor x (1280)', () => {
    expect(PATTERN_ORIGIN_X).toBe(1280);
  });

  it('dust spawns +- 1280 around the machine anchor, inside the world', () => {
    expect(DUST.spawnHalfWidth).toBe(1280);
    expect(MACHINE_ANCHOR.x - DUST.spawnHalfWidth).toBeGreaterThanOrEqual(0);
    expect(MACHINE_ANCHOR.x + DUST.spawnHalfWidth).toBeLessThanOrEqual(WORLD.width);
  });
});

describe('DUST_RISING (WP10 rising dust)', () => {
  it('is the resonator spire gate at level 1 with speedY [-18, -6] and spawn top GROUND_Y - 900', () => {
    expect(DUST_RISING).toEqual({ techId: 'resonatorSpire', minLevel: 1, speedY: [-18, -6], spawnTopY: GROUND_Y - 900 });
  });

  it('rises: speedY is ordered and negative (screen y goes up)', () => {
    expect(DUST_RISING.speedY[0]).toBeLessThanOrEqual(DUST_RISING.speedY[1]);
    expect(DUST_RISING.speedY[1]).toBeLessThan(0);
  });

  it('spawns inside the world and above the normal dust spawn top', () => {
    expect(DUST_RISING.spawnTopY).toBeGreaterThanOrEqual(0);
    expect(DUST_RISING.spawnTopY).toBeLessThan(DUST.spawnTopY);
  });

  it('its gate tech is a known tech', () => {
    expect(TECH_IDS).toContain(DUST_RISING.techId);
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
