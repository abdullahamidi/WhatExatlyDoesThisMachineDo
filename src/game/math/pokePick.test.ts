// Tests for the poke zone pick (WP28b F28): a point is held by the box whose centre is nearest it, the box edges (left and top in, right and
// bottom out), the ties (smaller area, then lower index), the count limit, and the s15-like fixture where every target centre picks its own box.
import { describe, it, expect } from 'vitest';
import { pickZone } from './pokePick';
import type { PokeZoneBox } from './pokePick';

const SIDE = 56;

describe('pickZone (WP28b F28)', () => {
  it('two overlapping 56 px boxes with centres 20 px apart each pick themselves at their own centre', () => {
    const boxes: PokeZoneBox[] = [{ cx: 100, cy: 100, w: SIDE, h: SIDE }, { cx: 120, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(boxes, 2, 100, 100)).toBe(0);
    expect(pickZone(boxes, 2, 120, 100)).toBe(1);
  });

  it('a point inside only one box picks that box', () => {
    const boxes: PokeZoneBox[] = [{ cx: 100, cy: 100, w: SIDE, h: SIDE }, { cx: 120, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(boxes, 2, 80, 100)).toBe(0);
    expect(pickZone(boxes, 2, 140, 100)).toBe(1);
  });

  it('a point outside every box returns -1', () => {
    const boxes: PokeZoneBox[] = [{ cx: 100, cy: 100, w: SIDE, h: SIDE }, { cx: 120, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(boxes, 2, 60, 100)).toBe(-1);
    expect(pickZone(boxes, 2, 100, 140)).toBe(-1);
    expect(pickZone([], 0, 100, 100)).toBe(-1);
  });

  it('the left and top edges are inside, the right and bottom edges are outside', () => {
    const one: PokeZoneBox[] = [{ cx: 100, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(one, 1, 72, 72)).toBe(0);
    expect(pickZone(one, 1, 71.99, 100)).toBe(-1);
    expect(pickZone(one, 1, 100, 71.99)).toBe(-1);
    expect(pickZone(one, 1, 127.99, 127.99)).toBe(0);
    expect(pickZone(one, 1, 128, 100)).toBe(-1);
    expect(pickZone(one, 1, 100, 128)).toBe(-1);
  });

  it('an equal distance prefers the smaller box, then the lower index', () => {
    // The point (110, 100) is 10 px from each centre: the 80 px box (index 0) and the 56 px box (index 1) hold it at equal distance.
    const bigFirst: PokeZoneBox[] = [{ cx: 100, cy: 100, w: 80, h: 80 }, { cx: 120, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(bigFirst, 2, 110, 100)).toBe(1);
    // Equal distance and equal area: the lower index wins.
    const equal: PokeZoneBox[] = [{ cx: 100, cy: 100, w: SIDE, h: SIDE }, { cx: 120, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(equal, 2, 110, 100)).toBe(0);
  });

  it('a nearer centre beats a lower index: the first box holds the point but is farther', () => {
    const boxes: PokeZoneBox[] = [{ cx: 100, cy: 100, w: 80, h: 80 }, { cx: 130, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(boxes, 2, 125, 100)).toBe(1);
    expect(pickZone(boxes, 2, 105, 100)).toBe(0);
  });

  it('count limits the boxes read: a holding box past count is not picked', () => {
    const boxes: PokeZoneBox[] = [{ cx: 100, cy: 100, w: SIDE, h: SIDE }, { cx: 120, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(boxes, 1, 120, 100)).toBe(0);
    expect(pickZone(boxes, 0, 100, 100)).toBe(-1);
  });

  it('a point that is not a finite number returns -1', () => {
    const boxes: PokeZoneBox[] = [{ cx: 100, cy: 100, w: SIDE, h: SIDE }];
    expect(pickZone(boxes, 1, Number.NaN, 100)).toBe(-1);
    expect(pickZone(boxes, 1, 100, Number.POSITIVE_INFINITY)).toBe(-1);
  });

  it('an s15-like fixture of 18 overlapping boxes: every centre picks its own box', () => {
    const boxes: PokeZoneBox[] = Array.from({ length: 18 }, (_, i) => ({
      cx: 150 + 22 * i,
      cy: 300 + 14 * (i % 3),
      w: SIDE + 8 * (i % 4),
      h: SIDE + 8 * (i % 3),
    }));
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b === undefined) throw new Error(`box ${i} missing`);
      expect(pickZone(boxes, boxes.length, b.cx, b.cy), `centre of box ${i}`).toBe(i);
    }
  });
});
