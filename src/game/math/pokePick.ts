// Poke zone pick (WP28b F28): which of the overlapping poke zones holds the pointer. Phaser delivers a press to the top zone only, so the zone
// handlers resolve the zone from the pointer position with this rule, and the hover uses the same rule: the zone whose target centre is nearest
// wins, so a target hovers and answers at its own centre. Why: the poke layer (C12, the WorldReach chunk) imports this module alone, so the
// pick stays out of the Director chunk. Pure: no Phaser, no DOM.

/** One zone for the pick: the centre and the size of its box (game px). */
export interface PokeZoneBox { cx: number; cy: number; w: number; h: number }

/**
 * Index of the box that holds (px, py) whose centre is nearest the point, among the first count boxes. A box holds a point when its left
 * and top edges are inclusive and its right and bottom edges exclusive. Ties go to the smaller area, then to the lower index. -1 when no
 * box holds the point, or when the point or count is not a finite number.
 */
export function pickZone(boxes: readonly PokeZoneBox[], count: number, px: number, py: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(count)) return -1;
  const n = Math.min(boxes.length, Math.max(0, Math.floor(count)));
  let best = -1;
  let bestD = Infinity;
  let bestArea = Infinity;
  for (let i = 0; i < n; i++) {
    const b = boxes[i];
    if (b === undefined) continue;
    const left = b.cx - b.w / 2;
    const right = b.cx + b.w / 2;
    const top = b.cy - b.h / 2;
    const bottom = b.cy + b.h / 2;
    if (!(px >= left && px < right && py >= top && py < bottom)) continue;
    const dx = b.cx - px;
    const dy = b.cy - py;
    const d = dx * dx + dy * dy;
    const area = b.w * b.h;
    if (d < bestD || (d === bestD && area < bestArea)) {
      best = i;
      bestD = d;
      bestArea = area;
    }
  }
  return best;
}
