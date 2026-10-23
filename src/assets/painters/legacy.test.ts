import { describe, it, expect } from 'vitest';
import { LEGACY_PAINTERS } from './legacy';
import type { Gfx, Painter } from './painterTypes';
import { ASSET_MANIFEST, sheetFrameRects } from '../manifest';
import type { AssetEntry } from '../manifest';
import type { AssetId } from '../assetIds';
import { PALETTE } from '../../data/palette';

interface Rect { x: number; y: number; w: number; h: number; color: number; alpha: number }
interface Cell { x: number; y: number; width: number; height: number }

// Recording stub: captures every fillRect with the colour and alpha set by the last fillStyle call.
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
const CYAN_VALUES = new Set<number>([PALETTE.cyan, PALETTE.cyanDark, PALETTE.cyanLight]);
const LEGACY_IDS: AssetId[] = [
  'machine.generatorGlow', 'machine.bellows', 'machine.exciterFeed', 'machine.backfeedTerminal', 'machine.steamLance',
];

function entryOf(id: AssetId): AssetEntry {
  return ASSET_MANIFEST[id];
}

// Cells of a sheet entry, or the whole texture for a single-image entry.
function cellsOf(entry: AssetEntry): Cell[] {
  const cells = sheetFrameRects(entry);
  return cells.length > 0 ? cells : [{ x: 0, y: 0, width: entry.width, height: entry.height }];
}

function inCell(r: Rect, cell: Cell): boolean {
  return r.x >= cell.x && r.x + r.w <= cell.x + cell.width && r.y >= cell.y && r.y + r.h <= cell.y + cell.height;
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

describe('LEGACY_PAINTERS', () => {
  it('maps exactly the 5 WP17 legacy feed asset ids', () => {
    expect(Object.keys(LEGACY_PAINTERS).sort()).toEqual([...LEGACY_IDS].sort());
  });

  it('every painter draws at least 8 rects, all inside the texture and one cell, in PALETTE colours only', () => {
    for (const id of LEGACY_IDS) {
      const entry = entryOf(id);
      const painter = LEGACY_PAINTERS[id];
      expect(painter, id).toBeDefined();
      if (painter === undefined) continue;
      const rects = record(painter, entry);
      const cells = cellsOf(entry);
      expect(rects.length, id).toBeGreaterThanOrEqual(8);
      for (const r of rects) {
        expect(r.x, id).toBeGreaterThanOrEqual(0);
        expect(r.y, id).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, id).toBeLessThanOrEqual(entry.width);
        expect(r.y + r.h, id).toBeLessThanOrEqual(entry.height);
        expect(cells.some((c) => inCell(r, c)), id).toBe(true);
        expect(PALETTE_VALUES.has(r.color), id).toBe(true);
      }
    }
  });

  it('draws at least 8 rects in every cell of the two sheets', () => {
    for (const id of ['machine.generatorGlow', 'machine.bellows'] as const) {
      const entry = entryOf(id);
      const painter = LEGACY_PAINTERS[id];
      expect(painter, id).toBeDefined();
      if (painter === undefined) continue;
      const rects = record(painter, entry);
      const cells = sheetFrameRects(entry);
      expect(cells.length, id).toBe(entry.frame?.count);
      for (const cell of cells) {
        expect(rects.filter((r) => inCell(r, cell)).length, `${id} cell x${cell.x}`).toBeGreaterThanOrEqual(8);
      }
    }
  });
});

describe('machine.generatorGlow sheet', () => {
  const entry = entryOf('machine.generatorGlow');
  const painter = LEGACY_PAINTERS['machine.generatorGlow'];
  const rects = painter === undefined ? [] : record(painter, entry);
  const cells = sheetFrameRects(entry);
  const ALPHAS = [0.12, 0.24, 0.38, 0.55];
  // Belt pulley circle in cell-local px: centre (52,49), r 11.
  const PULLEY_X = 52;
  const PULLEY_Y = 49;
  const PULLEY_R2 = 121;

  it('has four 96x64 cells at x 0, 96, 192, 288', () => {
    expect(cells).toEqual([
      { x: 0, y: 0, width: 96, height: 64 },
      { x: 96, y: 0, width: 96, height: 64 },
      { x: 192, y: 0, width: 96, height: 64 },
      { x: 288, y: 0, width: 96, height: 64 },
    ]);
  });

  it('draws the overlay of each cell at the contract alpha', () => {
    ALPHAS.forEach((alpha, k) => {
      const cell = cells[k];
      expect(cell, `cell ${k}`).toBeDefined();
      if (cell === undefined) return;
      const own = rects.filter((r) => inCell(r, cell));
      expect(own.length, `cell ${k}`).toBeGreaterThanOrEqual(8);
      for (const r of own) expect(r.alpha, `cell ${k}`).toBeCloseTo(alpha, 9);
    });
  });

  it('uses only the cyan overlay colours', () => {
    for (const r of rects) expect(r.color === PALETTE.cyan || r.color === PALETTE.cyanLight).toBe(true);
  });

  it('has a strictly increasing alpha*area sum per cell', () => {
    const sums = cells.map((cell) =>
      rects.filter((r) => inCell(r, cell)).reduce((s, r) => s + r.alpha * r.w * r.h, 0),
    );
    expect(sums[0]).toBeGreaterThan(0);
    for (let k = 1; k < sums.length; k++) {
      expect(sums[k], `cell ${k}`).toBeGreaterThan(sums[k - 1] ?? Infinity);
    }
  });

  it('keeps every drawn pixel outside the belt pulley circle in every cell', () => {
    const inside: string[] = [];
    for (const cell of cells) {
      for (const r of rects.filter((rr) => inCell(rr, cell))) {
        for (let y = r.y; y < r.y + r.h; y++) {
          for (let x = r.x; x < r.x + r.w; x++) {
            const lx = x - cell.x;
            const ly = y - cell.y;
            if ((lx - PULLEY_X) ** 2 + (ly - PULLEY_Y) ** 2 <= PULLEY_R2) inside.push(`x${cell.x} ${lx},${ly}`);
          }
        }
      }
    }
    expect(inside).toEqual([]);
  });

  it('draws the terminal strip as two rects (8,52,34,2) and (63,52,25,2) in every cell', () => {
    for (const cell of cells) {
      const own = rects.filter((r) => inCell(r, cell));
      expect(own.some((r) => r.x === cell.x + 8 && r.y === 52 && r.w === 34 && r.h === 2 && r.color === PALETTE.cyanLight), `cell x${cell.x} left`).toBe(true);
      expect(own.some((r) => r.x === cell.x + 63 && r.y === 52 && r.w === 25 && r.h === 2 && r.color === PALETTE.cyanLight), `cell x${cell.x} right`).toBe(true);
    }
  });
});

describe('machine.bellows sheet', () => {
  const entry = entryOf('machine.bellows');
  const painter = LEGACY_PAINTERS['machine.bellows'];
  const rects = painter === undefined ? [] : record(painter, entry);
  const cells = sheetFrameRects(entry);
  // Topmost painted row in column x = cell.x + 1 (the free left end of the tilted top board), per cell.
  const tipRows = cells.map((cell) => Math.min(...rects.filter((r) => r.x <= cell.x + 1 && cell.x + 1 < r.x + r.w).map((r) => r.y)));

  it('has four 60x28 cells at x 0, 60, 120, 180', () => {
    expect(cells.map((c) => c.x)).toEqual([0, 60, 120, 180]);
    expect(cells.every((c) => c.width === 60 && c.height === 28 && c.y === 0)).toBe(true);
  });

  it('covers the nozzle texture (59,16) and (59,17) in every cell', () => {
    for (const cell of cells) {
      expect(rects.some((r) => covers(r, cell.x + 59, 16)), `cell x${cell.x} row 16`).toBe(true);
      expect(rects.some((r) => covers(r, cell.x + 59, 17)), `cell x${cell.x} row 17`).toBe(true);
    }
  });

  it('starts the tilted top board at the per-cell tip row at its free left end (x = 1): 0, 6, 11, 6', () => {
    expect(tipRows).toEqual([0, 6, 11, 6]);
  });

  it('draws the legs over (11,25) and (35,25) in every cell', () => {
    for (const cell of cells) {
      expect(rects.some((r) => covers(r, cell.x + 11, 25)), `cell x${cell.x} left leg`).toBe(true);
      expect(rects.some((r) => covers(r, cell.x + 35, 25)), `cell x${cell.x} right leg`).toBe(true);
    }
  });

  it('gives the four cells different tilts (three distinct tip rows)', () => {
    expect(new Set(tipRows).size).toBe(3);
  });
});

describe('machine.exciterFeed', () => {
  const painter = LEGACY_PAINTERS['machine.exciterFeed'];
  const rects = painter === undefined ? [] : record(painter, entryOf('machine.exciterFeed'));

  it('has a cyan colour in rows y 0..4', () => {
    expect(rects.some((r) => CYAN_VALUES.has(r.color) && r.y <= 4)).toBe(true);
  });

  it('shows the cable lug (8,2) in cyan', () => {
    expect(topColor(rects, 8, 2)).toBe(PALETTE.cyan);
  });

  it('stacks insulator discs in grayDark and industrialGray', () => {
    expect(rects.some((r) => r.color === PALETTE.grayDark)).toBe(true);
    expect(rects.some((r) => r.color === PALETTE.industrialGray)).toBe(true);
  });
});

describe('machine.backfeedTerminal', () => {
  const painter = LEGACY_PAINTERS['machine.backfeedTerminal'];
  const rects = painter === undefined ? [] : record(painter, entryOf('machine.backfeedTerminal'));

  it('has a cyan colour in rows y 20..23', () => {
    expect(rects.some((r) => CYAN_VALUES.has(r.color) && r.y >= 20 && r.y + r.h <= 24)).toBe(true);
  });

  it('shows the bottom cable lug (8,22) in cyan', () => {
    expect(topColor(rects, 8, 22)).toBe(PALETTE.cyan);
  });

  it('has the grayDark plate on rows 0..2 and violet accents', () => {
    expect(rects.some((r) => r.color === PALETTE.grayDark && r.y === 0 && r.h === 3)).toBe(true);
    expect(rects.some((r) => r.color === PALETTE.violet)).toBe(true);
    expect(rects.some((r) => r.color === PALETTE.violetPale)).toBe(true);
  });
});

describe('machine.steamLance', () => {
  const painter = LEGACY_PAINTERS['machine.steamLance'];
  const rects = painter === undefined ? [] : record(painter, entryOf('machine.steamLance'));

  it('has a rust handwheel, shown at the top of the rim (8,0)', () => {
    expect(rects.some((r) => r.color === PALETTE.rust)).toBe(true);
    expect(topColor(rects, 8, 0)).toBe(PALETTE.rust);
  });

  it('has a steam highlight on the valve block', () => {
    expect(rects.some((r) => r.color === PALETTE.steam)).toBe(true);
  });

  it('has a rect touching row 23 (the flanged port at the bottom edge)', () => {
    expect(rects.some((r) => r.y + r.h === 24)).toBe(true);
  });
});
