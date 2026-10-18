import { describe, it, expect } from 'vitest';
import { PARALLAX_LAYERS } from './world';
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

describe('TOAST_CONFIG', () => {
  it('shows at most two toasts', () => {
    expect(TOAST_CONFIG.maxVisible).toBe(2);
  });
});
