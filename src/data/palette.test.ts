import { describe, it, expect } from 'vitest';
import { PALETTE, PALETTE_CSS } from './palette';
import type { PaletteKey } from './palette';

describe('PALETTE_CSS', () => {
  it('every value is a lowercase #rrggbb string', () => {
    for (const value of Object.values(PALETTE_CSS)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has the expected spot values', () => {
    expect(PALETTE_CSS.rust).toBe('#8c4a2a');
    expect(PALETTE_CSS.ink).toBe('#14110f');
  });

  it('has the same keys as PALETTE', () => {
    expect(Object.keys(PALETTE_CSS).sort()).toEqual(Object.keys(PALETTE).sort());
  });

  it('matches PALETTE numerically for every key', () => {
    for (const k of Object.keys(PALETTE) as PaletteKey[]) {
      expect(parseInt(PALETTE_CSS[k].slice(1), 16)).toBe(PALETTE[k]);
    }
  });
});
