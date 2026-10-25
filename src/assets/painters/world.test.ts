// WP23a living-world fallback painters: every painter stays inside its texture and cells, uses PALETTE colours only,
// and every frame cell gets a silhouette. Recording stub (same pattern as legacy.test.ts), no Phaser.
import { describe, it, expect } from 'vitest';
import { WORLD_PAINTERS } from './world';
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
const WORLD_IDS: AssetId[] = [
  'world.inspector', 'world.clipboardPages', 'world.dog', 'world.stakeChain', 'world.hole', 'world.redBall',
  'world.crow', 'world.girl', 'world.girlMini', 'world.girlWindow', 'world.lantern', 'world.payphone',
  'world.receiver', 'world.lamp', 'world.lampGlow', 'world.clock', 'world.sensor7', 'world.puddle',
  'world.sprout', 'world.scraps', 'world.mote', 'world.page', 'world.shadow', 'bg.windowLit', 'bg.virga',
];
const TALL_IDS: AssetId[] = ['world.payphone', 'world.receiver', 'world.sensor7', 'world.lamp', 'world.clock'];
const SILHOUETTE_IDS: AssetId[] = ['world.inspector', 'world.girl', 'world.girlMini', 'world.dog', 'world.crow'];
const BOX_IDS = WORLD_IDS.filter((id) => !SILHOUETTE_IDS.includes(id));

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

function paintedOf(id: AssetId): { entry: AssetEntry; rects: Rect[] } {
  const entry = ASSET_MANIFEST[id];
  const painter = WORLD_PAINTERS[id];
  if (painter === undefined) throw new Error(`no world painter for ${id}`);
  return { entry, rects: record(painter, entry) };
}

describe('WORLD_PAINTERS', () => {
  it('maps exactly the 25 WP23a ids', () => {
    expect(Object.keys(WORLD_PAINTERS).sort()).toEqual([...WORLD_IDS].sort());
  });

  it('every painter draws only inside the texture and in one cell, in PALETTE colours only', () => {
    for (const id of WORLD_IDS) {
      const { entry, rects } = paintedOf(id);
      const cells = cellsOf(entry);
      expect(rects.length, id).toBeGreaterThan(0);
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

  it('draws something in every frame cell of every sheet', () => {
    for (const id of WORLD_IDS) {
      const { entry, rects } = paintedOf(id);
      for (const cell of sheetFrameRects(entry)) {
        expect(rects.some((r) => inCell(r, cell)), `${id} x${cell.x} y${cell.y}`).toBe(true);
      }
    }
  });

  it('inks the outline: the top-left pixel of every tall box and flat cell is ink', () => {
    for (const id of BOX_IDS) {
      const { entry, rects } = paintedOf(id);
      for (const cell of cellsOf(entry)) {
        expect(topColor(rects, cell.x, cell.y), `${id} cell x${cell.x}`).toBe(PALETTE.ink);
      }
    }
  });

  it('covers every pixel of the 2x2 mote cells with ink (no body room)', () => {
    const { entry, rects } = paintedOf('world.mote');
    for (const cell of cellsOf(entry)) {
      for (let y = cell.y; y < cell.y + cell.height; y++) {
        for (let x = cell.x; x < cell.x + cell.width; x++) {
          expect(topColor(rects, x, y), `x${x} y${y}`).toBe(PALETTE.ink);
        }
      }
    }
  });
});

describe('world person silhouettes', () => {
  it('draws the Inspector head in dirtyBeige and the coat in industrialGray in every cell', () => {
    const { entry, rects } = paintedOf('world.inspector');
    for (const cell of sheetFrameRects(entry)) {
      expect(topColor(rects, cell.x + 10, cell.y + 5), `head x${cell.x}`).toBe(PALETTE.dirtyBeige);
      expect(topColor(rects, cell.x + 10, cell.y + 20), `coat x${cell.x}`).toBe(PALETTE.industrialGray);
    }
  });

});

describe('world animal, bird and tall box silhouettes', () => {
  it('gives the dog a rustDark ear in every cell', () => {
    const { entry, rects } = paintedOf('world.dog');
    for (const cell of sheetFrameRects(entry)) {
      expect(rects.some((r) => inCell(r, cell) && r.color === PALETTE.rustDark), `x${cell.x}`).toBe(true);
    }
  });

  it('draws exactly two wing rects in industrialGray per crow cell', () => {
    const { entry, rects } = paintedOf('world.crow');
    for (const cell of sheetFrameRects(entry)) {
      expect(rects.filter((r) => inCell(r, cell) && r.color === PALETTE.industrialGray).length, `x${cell.x} y${cell.y}`).toBe(2);
    }
  });

  it('gives every tall box a grayDark cap at the top and an industrialGray body below it', () => {
    for (const id of TALL_IDS) {
      const { entry, rects } = paintedOf(id);
      for (const cell of cellsOf(entry)) {
        expect(topColor(rects, cell.x + 1, cell.y + 1), `${id} cap`).toBe(PALETTE.grayDark);
        expect(topColor(rects, cell.x + Math.floor(cell.width / 2), cell.y + cell.height - 3), `${id} body`).toBe(PALETTE.industrialGray);
      }
    }
  });
});
