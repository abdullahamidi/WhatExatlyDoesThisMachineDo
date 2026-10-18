import type { Gfx } from './painterTypes';

// All coordinates are integers in texture px. `alpha` defaults to 1.

// Filled axis-aligned rectangle.
export function rect(g: Gfx, color: number, x: number, y: number, w: number, h: number, alpha: number = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x, y, w, h);
}

// Filled circle, drawn as 1x1 pixels where dx*dx + dy*dy <= r*r (pixel-grid friendly).
export function disc(g: Gfx, color: number, cx: number, cy: number, r: number, alpha: number = 1): void {
  g.fillStyle(color, alpha);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) g.fillRect(x, y, 1, 1);
    }
  }
}

// Annulus: 1x1 pixels where rInner*rInner < dx*dx + dy*dy <= rOuter*rOuter.
export function ring(g: Gfx, color: number, cx: number, cy: number, rOuter: number, rInner: number, alpha: number = 1): void {
  g.fillStyle(color, alpha);
  const outer = rOuter * rOuter;
  const inner = rInner * rInner;
  for (let y = cy - rOuter; y <= cy + rOuter; y++) {
    for (let x = cx - rOuter; x <= cx + rOuter; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (inner < d2 && d2 <= outer) g.fillRect(x, y, 1, 1);
    }
  }
}

// Integer Bresenham line; every step stamps a thickness x thickness square so the line stays on the pixel grid.
export function line(g: Gfx, color: number, x0: number, y0: number, x1: number, y1: number, thickness: number = 1, alpha: number = 1): void {
  const half = Math.floor(thickness / 2);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    rect(g, color, x - half, y - half, thickness, thickness, alpha);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Per-channel linear mix of two 0xRRGGBB colours; t is clamped to [0,1]; result is a rounded integer 0xRRGGBB.
export function lerpColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const mix = (shift: number): number => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * k);
  };
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
