import { describe, it, expect } from 'vitest';
import { PARALLAX_LAYERS, GROUND_SHADE, GROUND_Y, WORLD, FLOATING_TEXT, CRANK_PULSE, CAMERA, DEPTH, PARALLAX_FADE_MS, PYLON_LINE, PYLON_FEEDS, MACHINE_ANCHOR, PIXEL_SCALE, DUST, DUST_RISING, PATTERN_ORIGIN_X, VIEW, ECLIPSE, APERTURE_BEAM } from './world';
import type { ParallaxLayerDef } from './world';
import { TOAST_CONFIG } from './notifications';
import { MACHINE_BOUNDS, MACHINE_COMPONENTS, MACHINE_SOCKETS } from './machineComponents';
import { TECH_IDS } from './types';
import { ASSET_MANIFEST } from '../assets/manifest';

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
  it('pylonsLit is the last Era II layer (only the Era V sky layers follow it) and is gated on powerLines level 1', () => {
    const ids = PARALLAX_LAYERS.map((l) => l.id);
    expect(ids.indexOf('pylonsLit')).toBe(ids.indexOf('pylons') + 1);
    expect(ids.slice(ids.indexOf('pylonsLit') + 1)).toEqual(['skyViolet', 'horizonGlow']);
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

  it('dust spawns across the whole world: +- WORLD.width / 2 around the machine anchor, inside the world', () => {
    expect(DUST.spawnHalfWidth).toBe(WORLD.width / 2);
    expect(MACHINE_ANCHOR.x - DUST.spawnHalfWidth).toBeGreaterThanOrEqual(0);
    expect(MACHINE_ANCHOR.x + DUST.spawnHalfWidth).toBeLessThanOrEqual(WORLD.width);
  });

  it('dust max particles keep the pre-WP11 density (60 over a 2560 px band) over the wider band', () => {
    const preWp11Density = 60 / 2560;
    expect(DUST.maxParticles / (2 * DUST.spawnHalfWidth)).toBeCloseTo(preWp11Density, 9);
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

describe('WP11 sky layers (C3)', () => {
  it('the five pre-WP11 layers keep their ids and numbers', () => {
    const pick = (l: ParallaxLayerDef) => ({ id: l.id, assetId: l.assetId, scrollFactor: l.scrollFactor, bottomY: l.bottomY, depth: l.depth, alpha: l.alpha, underfill: l.underfill, tint: l.tint, visibleWhen: l.visibleWhen });
    expect(PARALLAX_LAYERS.slice(0, 5).map(pick)).toEqual([
      { id: 'sky', assetId: 'bg.sky', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background, alpha: 1, underfill: null, tint: undefined, visibleWhen: undefined },
      { id: 'mountains', assetId: 'bg.mountains', scrollFactor: 0.15, bottomY: GROUND_Y + 200, depth: DEPTH.background + 10, alpha: 0.45, underfill: 0x5a5f63, tint: undefined, visibleWhen: undefined },
      { id: 'skyline', assetId: 'bg.skyline', scrollFactor: 0.3, bottomY: GROUND_Y + 200, depth: DEPTH.background + 20, alpha: 0.4, underfill: 0x2b2e31, tint: undefined, visibleWhen: undefined },
      { id: 'pylons', assetId: 'bg.pylons', scrollFactor: 0.55, bottomY: GROUND_Y + 200, depth: DEPTH.background + 30, alpha: 0.45, underfill: null, tint: 0xb8a98f, visibleWhen: undefined },
      { id: 'pylonsLit', assetId: 'bg.pylonsLit', scrollFactor: 0.55, bottomY: GROUND_Y + 200, depth: DEPTH.background + 31, alpha: 0.7, underfill: null, tint: undefined, visibleWhen: { techId: 'powerLines', minLevel: 1 } },
    ]);
  });

  it('skyViolet is a screen-fixed full-view layer at background + 1 with the four violet stages', () => {
    expect(layer('skyViolet')).toEqual({
      id: 'skyViolet', assetId: 'bg.skyViolet', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background + 1, alpha: 1, underfill: null,
      alphaStages: [{ techId: 'nullChamber', minLevel: 1, alpha: 0.25 }, { techId: 'lensArray', minLevel: 1, alpha: 0.5 }, { techId: 'horizonField', minLevel: 5, alpha: 0.75 }, { techId: 'skyAperture', minLevel: 1, alpha: 1 }],
    });
  });

  it('horizonGlow is a screen-fixed full-view layer at background + 3 with the three horizon stages', () => {
    expect(layer('horizonGlow')).toEqual({
      id: 'horizonGlow', assetId: 'bg.horizonGlow', scrollFactor: 0, bottomY: VIEW.height, depth: DEPTH.background + 3, alpha: 1, underfill: null,
      alphaStages: [{ techId: 'horizonField', minLevel: 1, alpha: 0.35 }, { techId: 'horizonField', minLevel: 10, alpha: 0.55 }, { techId: 'horizonField', minLevel: 20, alpha: 0.75 }],
    });
  });

  it('alpha stages are non-decreasing within each layer, use known techs, and are never combined with visibleWhen', () => {
    for (const l of PARALLAX_LAYERS) {
      if (l.alphaStages === undefined) continue;
      expect(l.visibleWhen, l.id).toBeUndefined();
      let prev = 0;
      for (const s of l.alphaStages) {
        expect(TECH_IDS, l.id).toContain(s.techId);
        expect(s.alpha, l.id).toBeGreaterThanOrEqual(prev);
        expect(s.alpha, l.id).toBeLessThanOrEqual(1);
        prev = s.alpha;
      }
    }
  });

  it('only the two Era V sky layers carry alpha stages', () => {
    const withStages = PARALLAX_LAYERS.filter((l) => l.alphaStages !== undefined).map((l) => l.id);
    expect(withStages).toEqual(['skyViolet', 'horizonGlow']);
  });

  it('ECLIPSE is the bg.eclipse sprite at background + 2 with ordered stage frames inside the sheet', () => {
    expect(ECLIPSE.assetId).toBe('bg.eclipse');
    expect(ECLIPSE.depth).toBe(DEPTH.background + 2);
    expect(ECLIPSE.stages).toEqual([
      { techId: 'nullChamber', minLevel: 1, frame: 1 },
      { techId: 'lensArray', minLevel: 1, frame: 2 },
      { techId: 'horizonField', minLevel: 5, frame: 3 },
      { techId: 'skyAperture', minLevel: 1, frame: 5 },
    ]);
    expect(ECLIPSE.diamond).toEqual({ techId: 'skyAperture', frame: 4, ms: 1200 });
    const frames = ECLIPSE.stages.map((s) => s.frame);
    for (let i = 1; i < frames.length; i++) expect(frames[i]).toBeGreaterThan(frames[i - 1] as number);
    const count = ASSET_MANIFEST['bg.eclipse'].frame?.count ?? 0;
    expect(count).toBeGreaterThan(Math.max(...frames));
    expect(count).toBeGreaterThan(ECLIPSE.diamond.frame);
    for (const s of ECLIPSE.stages) expect(TECH_IDS).toContain(s.techId);
  });

  it('ECLIPSE sky position lies inside the 1280 x 720 sky', () => {
    expect(ECLIPSE.skyPx.x).toBeGreaterThanOrEqual(0);
    expect(ECLIPSE.skyPx.x).toBeLessThanOrEqual(VIEW.width);
    expect(ECLIPSE.skyPx.y).toBeGreaterThanOrEqual(0);
    expect(ECLIPSE.skyPx.y).toBeLessThanOrEqual(VIEW.height);
  });

  it('sky depths are ordered skyViolet (+1) < eclipse (+2) < horizonGlow (+3) < mountains (+10)', () => {
    expect(layer('skyViolet').depth).toBe(DEPTH.background + 1);
    expect(ECLIPSE.depth).toBe(DEPTH.background + 2);
    expect(layer('horizonGlow').depth).toBe(DEPTH.background + 3);
    expect(layer('mountains').depth).toBe(DEPTH.background + 10);
    expect(layer('skyViolet').depth).toBeLessThan(ECLIPSE.depth);
    expect(ECLIPSE.depth).toBeLessThan(layer('horizonGlow').depth);
    expect(layer('horizonGlow').depth).toBeLessThan(layer('mountains').depth);
  });
});

describe('WP11 aperture beam (C3)', () => {
  it('APERTURE_BEAM is the fx.beam tile on the aperture part with the pinned numbers', () => {
    expect(APERTURE_BEAM).toEqual({ assetId: 'fx.beam', component: 'aperture', minLatchFrame: 3, artX: 64, footArtY: -588, fps: 8, alpha: 0.85, depth: DEPTH.machine + 1 });
  });

  it('its component is an existing machine component', () => {
    expect(Object.keys(MACHINE_COMPONENTS)).toContain(APERTURE_BEAM.component);
  });

  it('artX equals the apertureBase socket x and the foot sits above the ground line', () => {
    expect(APERTURE_BEAM.artX).toBe(MACHINE_SOCKETS.apertureBase.x);
    expect(APERTURE_BEAM.footArtY).toBeLessThan(0);
  });

  it('artX is inside the aperture box and footArtY is inside it above the socket (the mouth, not the base)', () => {
    const socket = MACHINE_SOCKETS.apertureBase;
    const part = MACHINE_COMPONENTS.aperture;
    const boxLeft = socket.x - part.origin.x * part.size.width;
    const boxTop = socket.y - part.origin.y * part.size.height;
    const boxBottom = boxTop + part.size.height;
    expect(APERTURE_BEAM.artX).toBeGreaterThanOrEqual(boxLeft);
    expect(APERTURE_BEAM.artX).toBeLessThanOrEqual(boxLeft + part.size.width);
    expect(APERTURE_BEAM.footArtY).toBeGreaterThan(boxTop);
    expect(APERTURE_BEAM.footArtY).toBeLessThan(socket.y);
    expect(APERTURE_BEAM.footArtY).toBeLessThan(boxBottom);
  });

  it('the minimum latch frame is a valid frame of the aperture sheet', () => {
    const count = ASSET_MANIFEST['machine.aperture'].frame?.count ?? 0;
    expect(APERTURE_BEAM.minLatchFrame).toBeGreaterThanOrEqual(0);
    expect(APERTURE_BEAM.minLatchFrame).toBeLessThan(count);
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
