import type { Vec2 } from '../../data/machineComponents';

/** World point of a parallax pixel: obj + (1 - sf) * scroll per axis (Phaser draws it at obj - sf * scroll on screen). */
export function parallaxToWorld(obj: Vec2, scrollFactor: number, scroll: Vec2): Vec2 {
  return {
    x: obj.x + (1 - scrollFactor) * scroll.x,
    y: obj.y + (1 - scrollFactor) * scroll.y,
  };
}

/** Inputs of the anchor functions: the strip geometry as ParallaxBackground draws it, plus the camera scroll. */
export interface PylonAnchorInput {
  from: Vec2;                  // world point the cable starts at (the mast top)
  anchorsArt: readonly Vec2[]; // wire attachment points, art px inside one tile (origin top-left)
  tilePx: number;              // tile width in art px
  tileHeightPx: number;        // tile height in art px
  scale: number;               // art px -> strip px
  scrollFactor: number;        // parallax factor of the layer
  stripLeftX: number;          // strip left x in parallax space
  bottomObjY: number;          // strip bottom y in parallax space
  scroll: Vec2;                // camera scrollX / scrollY
  tiles?: number;              // tiles to test on each side of the nearest one (default 2)
  side?: 'any' | 'left';       // undefined / 'any' = right of `from` (legacy); 'left' = only anchors left of `from`
}

/** A pinnable anchor: tile index k along the strip and the index into anchorsArt. */
export interface PylonAnchorRef {
  tile: number;
  index: number;
}

/** A chosen anchor with its current world point. */
export interface PylonAnchorChoice {
  ref: PylonAnchorRef;
  point: Vec2;
}

function validPylonInput(input: PylonAnchorInput): boolean {
  const { from, anchorsArt, tilePx, tileHeightPx, scale, scrollFactor: sf, stripLeftX, bottomObjY, scroll } = input;
  if (anchorsArt.length === 0 || tilePx * scale <= 0 || tileHeightPx <= 0) return false;
  const numbers = [from.x, from.y, tilePx, tileHeightPx, scale, sf, stripLeftX, bottomObjY, scroll.x, scroll.y];
  if (!numbers.every((v) => Number.isFinite(v))) return false;
  return anchorsArt.every((a) => Number.isFinite(a.x) && Number.isFinite(a.y));
}

/** World point of anchor `index` in tile `k`; the caller has validated the input. */
function anchorWorld(input: PylonAnchorInput, k: number, a: Vec2): Vec2 {
  const { tilePx, tileHeightPx, scale, scrollFactor: sf, stripLeftX, bottomObjY, scroll } = input;
  const obj: Vec2 = {
    x: stripLeftX + (k * tilePx + a.x) * scale,
    y: bottomObjY - (tileHeightPx - a.y) * scale, // art y counts down from the tile top
  };
  return parallaxToWorld(obj, sf, scroll);
}

/**
 * Anchor nearest to `from` over the tiles around `from`. By default only anchors lying right of `from`
 * (world x > from.x) count; `side: 'left'` only anchors with world x < from.x. Null when there is no such
 * anchor or the input is invalid. Ties keep the first candidate.
 */
export function nearestPylonAnchor(input: PylonAnchorInput): PylonAnchorChoice | null {
  const { from, anchorsArt, tilePx, scale, scrollFactor: sf, stripLeftX, scroll } = input;
  const tiles = input.tiles ?? 2;
  const leftSide = input.side === 'left';
  if (!Number.isFinite(tiles) || !validPylonInput(input)) return null;
  const span = Math.max(0, Math.floor(tiles)); // whole tiles on each side

  const k0 = Math.floor((from.x - (1 - sf) * scroll.x - stripLeftX) / (tilePx * scale)); // tile under the start point
  let best: PylonAnchorChoice | null = null;
  let bestDistance = Infinity;
  for (let k = k0 - span; k <= k0 + span; k++) {
    for (let index = 0; index < anchorsArt.length; index++) {
      const a = anchorsArt[index];
      if (a === undefined) continue;
      const point = anchorWorld(input, k, a);
      if (leftSide ? point.x >= from.x : point.x <= from.x) continue; // wires on the requested side of the mast
      const distance = Math.hypot(point.x - from.x, point.y - from.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { ref: { tile: k, index }, point };
      }
    }
  }
  return best;
}

/** Current world point of a pinned anchor; null for an unknown index or invalid input. */
export function pylonAnchorPoint(input: PylonAnchorInput, ref: PylonAnchorRef): Vec2 | null {
  if (!validPylonInput(input) || !Number.isInteger(ref.tile)) return null;
  const a = input.anchorsArt[ref.index];
  if (a === undefined) return null;
  return anchorWorld(input, ref.tile, a);
}

/** Where a feed's catenary starts: its lead-to point (world space) when set, else the feed point itself. */
export function pylonCableStart(feedPoint: Vec2, leadTo: Vec2 | null): Vec2 {
  return leadTo ?? feedPoint;
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
