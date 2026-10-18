import type { Vec2 } from '../../data/machineComponents';

/** World point of a parallax pixel: obj + (1 - sf) * scroll per axis (Phaser draws it at obj - sf * scroll on screen). */
export function parallaxToWorld(obj: Vec2, scrollFactor: number, scroll: Vec2): Vec2 {
  return {
    x: obj.x + (1 - scrollFactor) * scroll.x,
    y: obj.y + (1 - scrollFactor) * scroll.y,
  };
}

/** Inputs of nearestPylonAnchor: the strip geometry as ParallaxBackground draws it, plus the camera scroll. */
export interface PylonAnchorInput {
  from: Vec2;                  // world point the cable starts at
  anchorsArt: readonly Vec2[]; // wire attachment points, art px inside one tile (origin top-left)
  tilePx: number;              // tile width in art px
  scale: number;               // art px -> strip px
  scrollFactor: number;        // parallax factor of the layer
  stripLeftX: number;          // strip left x in parallax space
  bottomObjY: number;          // strip bottom y in parallax space
  scroll: Vec2;                // camera scrollX / scrollY
  tiles?: number;              // tiles to test on each side of the nearest one (default 2)
}

/**
 * World point of the anchor nearest to `from` over the tiles around `from`; null when there are no anchors,
 * the tile size is not positive, or any input is non-finite.
 */
export function nearestPylonAnchor(input: PylonAnchorInput): Vec2 | null {
  const { from, anchorsArt, tilePx, scale, scrollFactor: sf, stripLeftX, bottomObjY, scroll } = input;
  const span = Math.max(0, Math.floor(input.tiles ?? 2)); // whole tiles on each side
  const numbers = [from.x, from.y, tilePx, scale, sf, stripLeftX, bottomObjY, scroll.x, scroll.y, input.tiles ?? 2];
  if (anchorsArt.length === 0 || tilePx * scale <= 0) return null;
  if (!numbers.every((v) => Number.isFinite(v))) return null;
  if (!anchorsArt.every((a) => Number.isFinite(a.x) && Number.isFinite(a.y))) return null;

  const k0 = Math.floor((from.x - (1 - sf) * scroll.x - stripLeftX) / (tilePx * scale)); // tile under the start point
  let best: Vec2 | null = null;
  let bestDistance = Infinity;
  for (let k = k0 - span; k <= k0 + span; k++) {
    for (const a of anchorsArt) {
      const obj: Vec2 = {
        x: stripLeftX + (k * tilePx + a.x) * scale,
        y: bottomObjY - (tilePx - a.y) * scale,
      };
      const world = parallaxToWorld(obj, sf, scroll);
      const distance = Math.hypot(world.x - from.x, world.y - from.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = world;
      }
    }
  }
  return best;
}

/**
 * Parabolic cable from a to b with `segments` (min 1) equal steps: y = a.y + (b.y - a.y) t + 4 sag t (1 - t).
 * Returns segments + 1 points; first and last are exactly a and b.
 */
export function cableParabola(a: Vec2, b: Vec2, sag: number, segments: number): Vec2[] {
  const n = Number.isFinite(segments) ? Math.max(1, Math.floor(segments)) : 1; // whole steps, at least one
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; // curve parameter
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t + 4 * sag * t * (1 - t), // sagging curve
    });
  }
  out[0] = { x: a.x, y: a.y }; // exact ends
  out[n] = { x: b.x, y: b.y };
  return out;
}
