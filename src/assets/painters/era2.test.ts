import { describe, it, expect } from 'vitest';
import { ERA2_PAINTERS } from './era2';
import type { Gfx, Painter } from './painterTypes';
import { ASSET_MANIFEST } from '../manifest';
import type { AssetEntry } from '../manifest';
import type { AssetId } from '../assetIds';
import { PALETTE } from '../../data/palette';

interface Rect { x: number; y: number; w: number; h: number; color: number; alpha: number }

// Recording stub: captures every fillRect with the colour set by the last fillStyle call.
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

function entryOf(id: AssetId): AssetEntry {
  return ASSET_MANIFEST[id];
}

function pixelKeys(rects: readonly Rect[]): Set<string> {
  const keys = new Set<string>();
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) keys.add(`${x},${y}`);
    }
  }
  return keys;
}

const NEW_MACHINE_IDS: AssetId[] = [
  'machine.generatorPlinth', 'machine.generator', 'machine.pulleyGenerator',
  'machine.coils1', 'machine.coils2', 'machine.coils3',
  'machine.motorRetrofit', 'machine.dynamo', 'machine.capacitorRack',
  'machine.sparkGap', 'machine.transformer', 'machine.cableMast',
];

describe('ERA2_PAINTERS', () => {
  it('maps exactly the 12 new machine asset ids', () => {
    expect(Object.keys(ERA2_PAINTERS).sort()).toEqual([...NEW_MACHINE_IDS].sort());
  });

  it('every painter draws at least 10 rects, all inside the texture, in PALETTE colours only', () => {
    for (const id of NEW_MACHINE_IDS) {
      const entry = entryOf(id);
      const painter = ERA2_PAINTERS[id];
      expect(painter, id).toBeDefined();
      if (painter === undefined) continue;
      const rects = record(painter, entry);
      expect(rects.length, id).toBeGreaterThanOrEqual(10);
      for (const r of rects) {
        expect(r.x, id).toBeGreaterThanOrEqual(0);
        expect(r.y, id).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, id).toBeLessThanOrEqual(entry.width);
        expect(r.y + r.h, id).toBeLessThanOrEqual(entry.height);
        expect(PALETTE_VALUES.has(r.color), id).toBe(true);
      }
    }
  });

  it('uses at least one cyan accent for the electrical parts', () => {
    const withCyan: AssetId[] = [
      'machine.generator', 'machine.coils1', 'machine.motorRetrofit', 'machine.dynamo',
      'machine.capacitorRack', 'machine.sparkGap', 'machine.transformer', 'machine.cableMast',
    ];
    for (const id of withCyan) {
      const painter = ERA2_PAINTERS[id];
      expect(painter, id).toBeDefined();
      if (painter === undefined) continue;
      const rects = record(painter, entryOf(id));
      expect(rects.some((r) => CYAN_VALUES.has(r.color)), id).toBe(true);
    }
  });
});

describe('coil stages', () => {
  const stages: AssetId[] = ['machine.coils1', 'machine.coils2', 'machine.coils3'];

  it('cover the same pixel union (the full 64x40 silhouette)', () => {
    const unions = stages.map((id) => {
      const painter = ERA2_PAINTERS[id];
      expect(painter).toBeDefined();
      if (painter === undefined) return new Set<string>();
      return pixelKeys(record(painter, entryOf(id)));
    });
    expect(unions[0]?.size).toBe(64 * 40);
    for (const u of unions) {
      expect(u).toEqual(unions[0]);
    }
  });

  it('have strictly increasing winding-rect counts', () => {
    const counts = stages.map((id) => {
      const painter = ERA2_PAINTERS[id];
      if (painter === undefined) return -1;
      return record(painter, entryOf(id)).filter((r) => r.color === PALETTE.rust).length;
    });
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(counts[0] ?? Infinity);
    expect(counts[2]).toBeGreaterThan(counts[1] ?? Infinity);
  });
});

describe('spark gap sheet', () => {
  const entry = entryOf('machine.sparkGap');
  const painter = ERA2_PAINTERS['machine.sparkGap'];
  const frameX = [0, 32, 64, 96];
  const rects = painter === undefined ? [] : record(painter, entry);

  function inFrame(r: Rect, frame: number): boolean {
    const x0 = frameX[frame] ?? 0;
    return r.x >= x0 && r.x + r.w <= x0 + 32;
  }

  it('has arc colours in every frame region', () => {
    for (let f = 0; f < 4; f++) {
      expect(rects.some((r) => inFrame(r, f) && CYAN_VALUES.has(r.color)), `frame ${f}`).toBe(true);
    }
  });

  it('draws the bright arc only in frame 2', () => {
    for (let f = 0; f < 4; f++) {
      const bright = rects.filter((r) => inFrame(r, f) && r.color === PALETTE.cyanLight).length;
      if (f === 2) expect(bright).toBeGreaterThan(0);
      else expect(bright).toBe(0);
    }
    const frame2 = rects.filter((r) => inFrame(r, 2) && r.color === PALETTE.cyanLight).length;
    const others = [0, 1, 3].map((f) => rects.filter((r) => inFrame(r, f) && r.color === PALETTE.cyanLight).length);
    for (const o of others) expect(frame2).toBeGreaterThan(o);
  });

  it('keeps electrodes and stand identical across frames', () => {
    const solid = (frame: number): string[] =>
      rects
        .filter((r) => inFrame(r, frame) && !CYAN_VALUES.has(r.color))
        .map((r) => `${r.x - (frameX[frame] ?? 0)},${r.y},${r.w},${r.h},${r.color},${r.alpha}`)
        .sort();
    const base = solid(0);
    expect(base.length).toBeGreaterThan(0);
    for (let f = 1; f < 4; f++) expect(solid(f)).toEqual(base);
  });
});
