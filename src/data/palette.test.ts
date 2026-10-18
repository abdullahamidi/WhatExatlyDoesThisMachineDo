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

  it('has the three cyan keys for the Era II wiring', () => {
    expect(PALETTE_CSS.cyanDark).toBe('#2f5a62');
    expect(PALETTE_CSS.cyan).toBe('#5fa8b4');
    expect(PALETTE_CSS.cyanLight).toBe('#bff0ec');
    expect(PALETTE.cyanDark).toBe(0x2f5a62);
    expect(PALETTE.cyan).toBe(0x5fa8b4);
    expect(PALETTE.cyanLight).toBe(0xbff0ec);
  });

  it('has the three Era III keys for the thermal machine', () => {
    expect(PALETTE_CSS.emberDark).toBe('#6a2418');
    expect(PALETTE_CSS.ember).toBe('#b8402a');
    expect(PALETTE_CSS.steam).toBe('#e8e0cc');
    expect(PALETTE.emberDark).toBe(0x6a2418);
    expect(PALETTE.ember).toBe(0xb8402a);
    expect(PALETTE.steam).toBe(0xe8e0cc);
  });

  it('has the three Era IV verdigris keys for the resonance machine', () => {
    expect(PALETTE_CSS.verdigrisDark).toBe('#3f5e52');
    expect(PALETTE_CSS.verdigris).toBe('#7fae96');
    expect(PALETTE_CSS.verdigrisLight).toBe('#cfe8d6');
    expect(PALETTE.verdigrisDark).toBe(0x3f5e52);
    expect(PALETTE.verdigris).toBe(0x7fae96);
    expect(PALETTE.verdigrisLight).toBe(0xcfe8d6);
  });

  it('has the eight Era V violet and dusk keys for the finale sky', () => {
    expect(PALETTE_CSS.violetDark).toBe('#24162f');
    expect(PALETTE_CSS.violet).toBe('#54367a');
    expect(PALETTE_CSS.violetLight).toBe('#9a6ad0');
    expect(PALETTE_CSS.violetPale).toBe('#e0c8ff');
    expect(PALETTE_CSS.dusk0).toBe('#2b2236');
    expect(PALETTE_CSS.dusk1).toBe('#3e3049');
    expect(PALETTE_CSS.dusk2).toBe('#5b4a5f');
    expect(PALETTE_CSS.dusk3).toBe('#7d6a72');
    expect(PALETTE.violetDark).toBe(0x24162f);
    expect(PALETTE.violet).toBe(0x54367a);
    expect(PALETTE.violetLight).toBe(0x9a6ad0);
    expect(PALETTE.violetPale).toBe(0xe0c8ff);
    expect(PALETTE.dusk0).toBe(0x2b2236);
    expect(PALETTE.dusk1).toBe(0x3e3049);
    expect(PALETTE.dusk2).toBe(0x5b4a5f);
    expect(PALETTE.dusk3).toBe(0x7d6a72);
  });

  it('no two palette keys share a value', () => {
    const values = Object.values(PALETTE);
    expect(new Set(values).size).toBe(values.length);
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
