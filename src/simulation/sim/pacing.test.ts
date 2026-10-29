import { describe, expect, it } from 'vitest';
import { eraAt, eventGaps, gapStats, purchaseGaps, quantile } from './pacing';
import type { Gap } from './pacing';

// Hand-built cases only: the pacing helpers are pure arithmetic over purchase instants and intervals.
const buy = (t: number): { t: number; id: 'gearRatio' } => ({ t, id: 'gearRatio' });

describe('quantile (nearest rank)', () => {
  it('picks sorted[ceil(q n) - 1] and clamps the ends', () => {
    const sorted = [1, 2, 3, 4];
    expect(quantile(sorted, 0.5)).toBe(2);
    expect(quantile(sorted, 0.75)).toBe(3);
    expect(quantile(sorted, 0.9)).toBe(4);
    expect(quantile(sorted, 0)).toBe(1);
    expect(quantile(sorted, 1)).toBe(4);
  });

  it('ten values: the 0.9 quantile is the ninth, the median of three is the middle one', () => {
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(quantile([5, 7, 8], 0.5)).toBe(7);
  });

  it('an empty list gives NaN', () => {
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe('purchaseGaps', () => {
  it('the first gap starts at t = 0; each gap runs to the next purchase instant', () => {
    expect(purchaseGaps([buy(5), buy(12), buy(20)], 30)).toEqual([
      { from: 0, to: 5, len: 5, era: 1 },
      { from: 5, to: 12, len: 7, era: 1 },
      { from: 12, to: 20, len: 8, era: 1 },
    ]);
  });

  it('equal purchase instants merge into one; the input order does not matter', () => {
    expect(purchaseGaps([buy(20), buy(10), buy(10), buy(10)], 30)).toEqual([
      { from: 0, to: 10, len: 10, era: 1 },
      { from: 10, to: 20, len: 10, era: 1 },
    ]);
  });

  it('purchases after endT are ignored and there is no tail after the last instant', () => {
    expect(purchaseGaps([buy(10), buy(40)], 30)).toEqual([{ from: 0, to: 10, len: 10, era: 1 }]);
    expect(purchaseGaps([], 30)).toEqual([]);
  });

  it('the era column is the keystone era at the gap start (generator 2, boiler 3)', () => {
    const firstAt = { generator: 10, boiler: 50 };
    const gaps = purchaseGaps([buy(12), buy(60), buy(100)], 200, firstAt);
    // Gap 0 starts at 0 (era I); gap 1 starts at 12 (generator owned: era II); gap 2 starts at 60 (boiler owned: era III).
    expect(gaps.map((g) => g.era)).toEqual([1, 2, 3]);
  });

  it('does not mutate the purchases', () => {
    const purchases = [buy(20), buy(10)];
    const before = JSON.stringify(purchases);
    purchaseGaps(purchases, 30);
    expect(JSON.stringify(purchases)).toBe(before);
  });
});

describe('eventGaps', () => {
  it('overlapping intervals merge; a purchase instant covers nothing', () => {
    // Covered: 5 and 50 (instants), 10-20 and 15-30 (merge to 10-30), 40-45. Free stretches: 0-5, 5-10, 30-40, 45-50.
    expect(eventGaps([buy(5), buy(50)], [{ from: 10, to: 20 }, { from: 15, to: 30 }, { from: 40, to: 45 }], 60)).toEqual([
      { from: 0, to: 5, len: 5, era: 1 },
      { from: 5, to: 10, len: 5, era: 1 },
      { from: 30, to: 40, len: 10, era: 1 },
      { from: 45, to: 50, len: 5, era: 1 },
    ]);
  });

  it('intervals are clipped to endT, and one that starts after endT is ignored', () => {
    expect(eventGaps([], [{ from: 10, to: 90 }, { from: 70, to: 80 }], 60)).toEqual([
      { from: 0, to: 10, len: 10, era: 1 },
    ]);
  });

  it('no tail: nothing after the last covered instant', () => {
    expect(eventGaps([], [], 60)).toEqual([]);
  });

  it('the era column follows firstAt at the gap start', () => {
    const gaps: Gap[] = eventGaps([buy(45)], [{ from: 30, to: 40 }], 50, { generator: 10 });
    expect(gaps).toEqual([
      { from: 0, to: 30, len: 30, era: 1 },
      { from: 40, to: 45, len: 5, era: 2 },
    ]);
  });
});

describe('gapStats', () => {
  it('n, median, p75, p90 and max of the gap lengths (nearest rank)', () => {
    const lengths = [5, 7, 8, 20, 4, 10, 9, 6, 11, 30];
    const gaps: Gap[] = lengths.map((len) => ({ from: 0, to: len, len, era: 1 }));
    // Sorted: 4 5 6 7 8 9 10 11 20 30. Median = 8 (5th), p75 = 11 (8th), p90 = 20 (9th), max = 30.
    expect(gapStats(gaps)).toEqual({ n: 10, median: 8, p75: 11, p90: 20, max: 30 });
  });

  it('no gaps: n 0 and NaN statistics', () => {
    const stats = gapStats([]);
    expect(stats.n).toBe(0);
    expect(stats.median).toBeNaN();
    expect(stats.p75).toBeNaN();
    expect(stats.p90).toBeNaN();
    expect(stats.max).toBeNaN();
  });
});

describe('eraAt', () => {
  it('era I without a keystone; then the highest keystone owned by t', () => {
    const firstAt = { generator: 10, boiler: 50, resonatorSpire: 200 };
    expect(eraAt(undefined, 999)).toBe(1);
    expect(eraAt({}, 999)).toBe(1);
    expect(eraAt(firstAt, 9)).toBe(1);
    expect(eraAt(firstAt, 10)).toBe(2);
    expect(eraAt(firstAt, 100)).toBe(3);
    expect(eraAt(firstAt, 200)).toBe(4);
    expect(eraAt(firstAt, 10_000)).toBe(4);
  });

  it('a keystone that is never owned (Infinity) does not count', () => {
    expect(eraAt({ nullChamber: Number.POSITIVE_INFINITY }, 1e9)).toBe(1);
  });
});
