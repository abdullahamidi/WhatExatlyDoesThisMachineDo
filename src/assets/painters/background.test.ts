import { describe, it, expect } from 'vitest';
import { paintPylonsLit } from './background';
import type { Gfx } from './painterTypes';
import { ASSET_MANIFEST } from '../manifest';
import { PALETTE } from '../../data/palette';

interface Rect { x: number; y: number; w: number; h: number; color: number }

function record(): Rect[] {
  const rects: Rect[] = [];
  let color = 0;
  const stub = {
    fillStyle(c: number): void {
      color = c;
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      rects.push({ x, y, w, h, color });
    },
  };
  paintPylonsLit(stub as unknown as Gfx, ASSET_MANIFEST['bg.pylonsLit']);
  return rects;
}

// Pylon centres and crossbar geometry, as in paintPylons.
const PYLON_CENTRES = [64, 192];
const CROSSBAR_YS = [60, 100, 150, 200];
function halfWidth(y: number): number {
  return 3 + Math.round((y - 40) / 18);
}

function covers(rects: readonly Rect[], px: number, py: number, color: number): boolean {
  return rects.some((r) => r.color === color && px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
}

describe('paintPylonsLit', () => {
  const rects = record();

  it('draws only cyan, cyanLight and cyanDark', () => {
    const allowed = new Set<number>([PALETTE.cyan, PALETTE.cyanLight, PALETTE.cyanDark]);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) expect(allowed.has(r.color)).toBe(true);
  });

  it('keeps every rect inside the 256x256 texture', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(256);
      expect(r.y + r.h).toBeLessThanOrEqual(256);
    }
  });

  it('lights both ends of every crossbar of both pylons', () => {
    for (const cx of PYLON_CENTRES) {
      for (const y of [60, 100, 150, 200]) {
        const hw = halfWidth(y);
        expect(covers(rects, cx - hw, y, PALETTE.cyan), `left end cx${cx} y${y}`).toBe(true);
        expect(covers(rects, cx + hw - 1, y, PALETTE.cyan), `right end cx${cx} y${y}`).toBe(true);
      }
    }
  });
});
