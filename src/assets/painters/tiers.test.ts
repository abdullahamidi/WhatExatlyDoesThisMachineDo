import { describe, it, expect } from 'vitest';
import { TIER_PAINTERS, paintGearRim, paintFlywheelRim2, paintFlywheelRim3 } from './tiers';
import type { Gfx, Painter } from './painterTypes';
import { ASSET_MANIFEST } from '../manifest';
import type { AssetEntry } from '../manifest';
import type { AssetId } from '../assetIds';
import { PALETTE } from '../../data/palette';

interface Rect { x: number; y: number; w: number; h: number; color: number; alpha: number }

// Recording stub (legacy.test.ts pattern): captures every fillRect with the colour and alpha set by the last fillStyle call.
function record(paint: Painter, entry: AssetEntry): Rect[] {
  const rects: Rect[] = [];
  let color = 0;
  let alpha = 1;
  const stub = {
    fillStyle(c: number, a: number): void {
      color = c;
      alpha = a;
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      rects.push({ x, y, w, h, color, alpha });
    },
  };
  paint(stub as unknown as Gfx, entry);
  return rects;
}

const PALETTE_VALUES = new Set<number>(Object.values(PALETTE));

// Ring band [lo, hi] of each decal (pixel-centre distance) and `hole`: nothing may be painted at d < hole.
interface DecalCase { id: AssetId; painter: Painter; lo: number; hi: number; hole: number }
const DECALS: DecalCase[] = [
  { id: 'machine.gearRim', painter: paintGearRim, lo: 19.5, hi: 22.5, hole: 19 },
  { id: 'machine.flywheelRim2', painter: paintFlywheelRim2, lo: 39.8, hi: 47.5, hole: 39 },
  { id: 'machine.flywheelRim3', painter: paintFlywheelRim3, lo: 39.8, hi: 47.5, hole: 39 },
];

function entryOf(id: AssetId): AssetEntry {
  return ASSET_MANIFEST[id];
}

// Distance from the texture centre to the centre of pixel (x, y).
function distOf(entry: AssetEntry, x: number, y: number): number {
  return Math.hypot(x + 0.5 - entry.width / 2, y + 0.5 - entry.height / 2);
}

function covers(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

// Colour a pixel ends up with: the last rect drawn over it wins.
function topColor(rects: readonly Rect[], x: number, y: number): number | undefined {
  let color: number | undefined;
  for (const r of rects) {
    if (covers(r, x, y)) color = r.color;
  }
  return color;
}

// Every pixel any rect covers, as "x,y" keys.
function coveredKeys(rects: readonly Rect[]): Set<string> {
  const keys = new Set<string>();
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) keys.add(`${x},${y}`);
    }
  }
  return keys;
}

describe('TIER_PAINTERS', () => {
  it('maps exactly the 3 decal asset ids to their painters', () => {
    expect(Object.keys(TIER_PAINTERS).sort()).toEqual(DECALS.map((c) => c.id).sort());
    expect(TIER_PAINTERS['machine.gearRim']).toBe(paintGearRim);
    expect(TIER_PAINTERS['machine.flywheelRim2']).toBe(paintFlywheelRim2);
    expect(TIER_PAINTERS['machine.flywheelRim3']).toBe(paintFlywheelRim3);
  });
});

for (const c of DECALS) {
  describe(`${c.id} fallback annulus`, () => {
    const entry = entryOf(c.id);
    const rects = record(c.painter, entry);

    it('draws 1x1 rects at alpha 1 in PALETTE colours only', () => {
      expect(rects.length).toBeGreaterThan(0);
      for (const r of rects) {
        expect(r.w === 1 && r.h === 1, `${r.x},${r.y}`).toBe(true);
        expect(r.alpha, `${r.x},${r.y}`).toBe(1);
        expect(PALETTE_VALUES.has(r.color), `${r.x},${r.y}`).toBe(true);
      }
    });

    it('keeps every rect inside the texture', () => {
      for (const r of rects) {
        expect(r.x, `${r.x},${r.y}`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${r.x},${r.y}`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, `${r.x},${r.y}`).toBeLessThanOrEqual(entry.width);
        expect(r.y + r.h, `${r.x},${r.y}`).toBeLessThanOrEqual(entry.height);
      }
    });

    it(`leaves the centre (d < ${c.hole}) and the four corners unpainted`, () => {
      for (const r of rects) expect(distOf(entry, r.x, r.y), `${r.x},${r.y}`).toBeGreaterThanOrEqual(c.hole);
      const corners: Array<[number, number]> = [
        [0, 0], [entry.width - 1, 0], [0, entry.height - 1], [entry.width - 1, entry.height - 1],
      ];
      for (const [x, y] of corners) expect(rects.some((r) => covers(r, x, y)), `corner ${x},${y}`).toBe(false);
    });

    it(`keeps every painted pixel inside the ring band ${c.lo}..${c.hi}`, () => {
      for (const r of rects) {
        const d = distOf(entry, r.x, r.y);
        expect(d >= c.lo && d <= c.hi, `${r.x},${r.y} d=${d}`).toBe(true);
      }
    });

    it('closes the ring: every 45 degree sector has painted pixels on the band middle', () => {
      const mid = (c.lo + c.hi) / 2;
      const cx = entry.width / 2;
      const cy = entry.height / 2;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const x = Math.floor(cx + mid * Math.cos(a));
        const y = Math.floor(cy + mid * Math.sin(a));
        expect(rects.some((r) => covers(r, x, y)), `sector ${k} at ${x},${y}`).toBe(true);
      }
    });

    it('is deterministic: a second run paints the same rects', () => {
      expect(record(c.painter, entry)).toEqual(rects);
    });
  });
}

describe('machine.gearRim glint', () => {
  const rects = record(paintGearRim, entryOf('machine.gearRim'));

  it('shows the upper-left glint arc in mutedOrange', () => {
    expect(topColor(rects, 16, 16)).toBe(PALETTE.mutedOrange); // d about 21.9, upper left
  });

  it('keeps the lower-right of the rim rust (no glint)', () => {
    expect(topColor(rects, 47, 47)).toBe(PALETTE.rust); // d about 21.9, lower right
  });
});

describe('machine.flywheelRim2 shading', () => {
  const entry = entryOf('machine.flywheelRim2');
  const rects = record(paintFlywheelRim2, entry);

  it('shades the lower-right inner arc grayDark and the upper-left one industrialGray', () => {
    expect(topColor(rects, 77, 77)).toBe(PALETTE.grayDark); // d about 41.7, lower right
    expect(topColor(rects, 18, 18)).toBe(PALETTE.industrialGray); // d about 41.7, upper left
  });

  it('draws the outer ink edge (d 46.5..47)', () => {
    expect(topColor(rects, 94, 48)).toBe(PALETTE.ink); // d about 46.50
  });
});

describe('machine.flywheelRim3 over machine.flywheelRim2', () => {
  const rim2 = record(paintFlywheelRim2, entryOf('machine.flywheelRim2'));
  const rim3 = record(paintFlywheelRim3, entryOf('machine.flywheelRim3'));

  it('covers every pixel that rim 2 covers', () => {
    const keys3 = coveredKeys(rim3);
    for (const key of coveredKeys(rim2)) expect(keys3.has(key), key).toBe(true);
  });

  it('draws the rust inlay over the rim 2 iron at d 42.5..43.4', () => {
    expect(topColor(rim2, 90, 50)).toBe(PALETTE.industrialGray); // d about 42.57
    expect(topColor(rim3, 90, 50)).toBe(PALETTE.rust);
  });
});
