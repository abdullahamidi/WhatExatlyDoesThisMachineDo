import type { AssetEntry } from '../manifest';
import type { Gfx, Painter } from './painterTypes';
import { rect, disc, line, lerpColor } from './draw';
import { createRng } from './rng';
import { PALETTE } from '../../data/palette';

// Background painters: procedural wasteland textures. Texture-local coordinates, (0,0) = top-left.
// Every fill is clipped to the texture so nothing is drawn outside [0,w) x [0,h).

type Filler = (color: number, x: number, y: number, w: number, h: number, alpha?: number) => void;

// rect() clipped to the texture bounds.
function clipper(g: Gfx, entry: AssetEntry): Filler {
  return (color, x, y, w, h, alpha = 1) => {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(entry.width, x + w);
    const y1 = Math.min(entry.height, y + h);
    if (x1 > x0 && y1 > y0) rect(g, color, x0, y0, x1 - x0, y1 - y0, alpha);
  };
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Consecutive pairs [xs[i-1], xs[i]].
function pairs<T>(xs: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1];
    const b = xs[i];
    if (a !== undefined && b !== undefined) out.push([a, b]);
  }
  return out;
}

// Skyline ground line y, and the y below which windows are not drawn.
const SKYLINE_GROUND_Y = 220;
const SKYLINE_WINDOW_MAX_Y = 215;

// Mountain ridge: periodic in x with period 512 (integer cycle counts).
const RIDGE_PERIOD = 512;
function ridge(x: number): number {
  return Math.round(
    46 +
      14 * Math.sin((2 * Math.PI * 2 * x) / RIDGE_PERIOD) +
      9 * Math.sin((2 * Math.PI * 5 * x) / RIDGE_PERIOD + 1) +
      5 * Math.sin((2 * Math.PI * 11 * x) / RIDGE_PERIOD + 2),
  );
}

export const paintSky: Painter = (g, entry) => {
  const box = clipper(g, entry);
  for (let y = 0; y < entry.height; y += 16) {
    const t = y / entry.height;
    const color = t < 0.65 ? lerpColor(PALETTE.skyTop, PALETTE.skyHaze, t / 0.65) : PALETTE.skyHaze;
    rect(g, color, 0, y, entry.width, 16);
  }
  const rng = createRng(1);
  for (let i = 0; i < 16; i++) {
    box(PALETTE.skyHaze, Math.floor(rng() * 1000), 360 + Math.floor(rng() * 160), 200 + Math.floor(rng() * 300), 4, 0.35);
  }
  disc(g, PALETTE.sand, 960, 380, 70, 0.1);
  disc(g, PALETTE.sand, 960, 380, 44, 0.14);
  disc(g, PALETTE.skyHaze, 960, 380, 24, 0.5);
};

export const paintMountains: Painter = (g, entry) => {
  const box = clipper(g, entry);
  for (let x = 0; x < entry.width; x++) {
    const top = ridge(x);
    rect(g, PALETTE.industrialGray, x, top, 1, entry.height - top);
    if (Math.floor(x / 16) % 2 === 0) box(PALETTE.grayDark, x, top + 6, 1, 60, 0.25);
  }
  const rng = createRng(2);
  for (const x0 of [70, 190, 300, 410, 470]) {
    const h = 14 + Math.floor(rng() * 16);
    const w = 6 + Math.floor(rng() * 5);
    box(PALETTE.grayDark, x0, ridge(x0) - h, w, h + 8);
    box(PALETTE.grayDark, x0 + 2, ridge(x0) - h - 5, 3, 5);
  }
};

function paintBuildingWindows(box: Filler, rng: () => number, x: number, w: number, top: number): void {
  for (let wx = x + 4; wx + 2 < x + w - 2; wx += 8) {
    for (let wy = top + 6; wy < SKYLINE_WINDOW_MAX_Y; wy += 10) {
      const r = rng();
      if (r < 0.12) box(PALETTE.rust, wx, wy, 2, 3, 0.5);
      else if (r < 0.14) box(PALETTE.mutedOrange, wx, wy, 2, 3, 0.55);
    }
  }
}

export const paintSkyline: Painter = (g, entry) => {
  const box = clipper(g, entry);
  const rng = createRng(7);
  let x = 0;
  while (x < entry.width) {
    const w = Math.min(20 + Math.floor(rng() * 28), entry.width - x);
    let h = 60 + Math.floor(rng() * 90);
    if (rng() < 0.18) h += 50;
    const top = SKYLINE_GROUND_Y - h;
    box(PALETTE.grayDark, x, top, w, entry.height - top);
    box(PALETTE.ink, x, top, 1, entry.height - top, 0.4);
    if (rng() < 0.5) {
      box(PALETTE.grayDark, x + Math.floor(w * 0.2), top - 8, Math.floor(w * 0.4), 8);
      box(PALETTE.grayDark, x + Math.floor(w * 0.6), top - 14, 2, 14);
    }
    paintBuildingWindows(box, rng, x, w, top);
    x += w + Math.floor(rng() * 4);
  }
};

// Wire with a sag, wrapped across the tile edge with modulo.
function paintWire(g: Gfx, tileWidth: number, x0: number, x1: number, dy: number): void {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const y = Math.round(58 + dy + 22 * 4 * t * (1 - t));
    rect(g, PALETTE.ink, ((x % tileWidth) + tileWidth) % tileWidth, y, 1, 1, 0.8);
  }
}

const PYLON_CROSSBAR_YS = [60, 100, 150, 200];
const PYLON_LEG_BOTTOM_Y = 255;
const PYLON_LEG_TOP_Y = 40;

// Crossbar half-width grows with height.
function pylonHalfWidth(y: number): number {
  return 3 + Math.round((y - 40) / 18);
}

function paintPylon(g: Gfx, cx: number): void {
  line(g, PALETTE.ink, cx - 10, PYLON_LEG_BOTTOM_Y, cx - 2, PYLON_LEG_TOP_Y, 2);
  line(g, PALETTE.ink, cx + 10, PYLON_LEG_BOTTOM_Y, cx + 2, PYLON_LEG_TOP_Y, 2);
  for (const y of PYLON_CROSSBAR_YS) {
    const hw = pylonHalfWidth(y);
    rect(g, PALETTE.ink, cx - hw, y, hw * 2, 2);
  }
  for (const [yA, yB] of pairs(PYLON_CROSSBAR_YS)) {
    const hwA = pylonHalfWidth(yA);
    const hwB = pylonHalfWidth(yB);
    line(g, PALETTE.ink, cx - hwA, yA, cx + hwB, yB, 1);
    line(g, PALETTE.ink, cx + hwA, yA, cx - hwB, yB, 1);
  }
  rect(g, PALETTE.ink, cx - 18, 52, 36, 3);
  rect(g, PALETTE.ink, cx - 17, 55, 2, 5);
  rect(g, PALETTE.ink, cx + 15, 55, 2, 5);
}

export const paintPylons: Painter = (g, entry) => {
  paintPylon(g, 64);
  paintPylon(g, 192);
  paintWire(g, entry.width, 80, 176, 0);
  paintWire(g, entry.width, 208, 304, 0);
  paintWire(g, entry.width, 80, 176, 8);
  paintWire(g, entry.width, 208, 304, 8);
};

// Lit overlay for the pylons (fallback for bg.pylonsLit): cyan lamps at both ends of every crossbar, lit insulators
// and a dark pixel under each lamp. Nothing else is drawn. Lamps sit on the crossbar ends (left column cx-hw,
// right column cx+hw-2 so the 2-px lamp stays inside the bar), mirrored about cx.
export const paintPylonsLit: Painter = (g) => {
  for (const cx of [64, 192]) {
    rect(g, PALETTE.cyanLight, cx - 17, 55, 2, 5);
    rect(g, PALETTE.cyanLight, cx + 15, 55, 2, 5);
    for (const y of PYLON_CROSSBAR_YS) {
      const hw = pylonHalfWidth(y);
      for (const x of [cx - hw, cx + hw - 2]) {
        rect(g, PALETTE.cyan, x, y, 2, 2);
        rect(g, PALETTE.cyanDark, x, y + 2, 1, 1);
      }
    }
  }
};

function paintSpeckles(g: Gfx, rng: () => number): void {
  for (let i = 0; i < 220; i++) {
    const r = rng();
    const [c, a]: readonly [number, number] =
      r < 0.6 ? [PALETTE.dirtyBeige, 0.6] : r < 0.85 ? [PALETTE.rustDark, 0.25] : [PALETTE.skyHaze, 0.3];
    const x = Math.floor(rng() * 254);
    const y = Math.floor(rng() * 127);
    const w = 1 + Math.floor(rng() * 2);
    rect(g, c, x, y, w, 1, a);
  }
}

function paintPebbles(g: Gfx, rng: () => number): void {
  for (let i = 0; i < 14; i++) {
    const x = 4 + Math.floor(rng() * 245);
    const y = 4 + Math.floor(rng() * 117);
    rect(g, PALETTE.dirtyBeige, x, y, 3, 2, 0.9);
    rect(g, PALETTE.rustDark, x, y + 2, 3, 1, 0.4);
  }
}

// Cracks: each is a chain of 5 segments, endpoints clamped to the tile.
function paintCracks(g: Gfx, rng: () => number, width: number, height: number): void {
  for (let i = 0; i < 6; i++) {
    let x = 20 + Math.floor(rng() * 217);
    let y = 20 + Math.floor(rng() * 89);
    for (let s = 0; s < 5; s++) {
      const len = 6 + Math.floor(rng() * 8);
      const angle = rng() * 2 * Math.PI;
      const nx = clampInt(x + Math.round(Math.cos(angle) * len), 0, width - 1);
      const ny = clampInt(y + Math.round(Math.sin(angle) * len), 0, height - 1);
      line(g, PALETTE.rustDark, x, y, nx, ny, 1, 0.55);
      x = nx;
      y = ny;
    }
  }
}

export const paintGround: Painter = (g, entry) => {
  rect(g, PALETTE.sand, 0, 0, entry.width, entry.height);
  const rng = createRng(3);
  paintSpeckles(g, rng);
  paintPebbles(g, rng);
  paintCracks(g, rng, entry.width, entry.height);
};

export const paintDust: Painter = (g) => {
  rect(g, PALETTE.dirtyBeige, 1, 0, 2, 4);
  rect(g, PALETTE.dirtyBeige, 0, 1, 4, 2);
};
