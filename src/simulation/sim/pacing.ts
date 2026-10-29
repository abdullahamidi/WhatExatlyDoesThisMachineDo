import { ERA_KEYSTONES } from '../../data/eras';
import type { EraNumber } from '../../data/eras';
import type { TechId } from '../../data/types';

// Pacing helpers (WP28 C4): pure copies of the audit harness helpers, same maths, so the repo sims and the harness
// report the same gaps. A gap is a stretch between two instants: purchase to purchase, or event to purchase.
// The first stretch starts at t = 0. There is no tail after the last instant (harness parity). Inputs are never mutated.

/** One gap: from..to in active seconds, its length, and the era at its start. */
export interface Gap {
  from: number;
  to: number;
  len: number;
  era: EraNumber;
}

/** Nearest-rank statistics of gap lengths. NaN when there are no gaps. */
export interface GapStats {
  n: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

/** Nearest rank of an ascending list: sorted[min(n - 1, max(0, ceil(q n) - 1))]. NaN for an empty list. */
export function quantile(sorted: readonly number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  return sorted[Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1))] ?? NaN;
}

/**
 * The era at active time t: era I, or the highest keystone era (ERA_KEYSTONES) whose tech is owned by t. firstAt absent =
 * era I. A keystone never owned (Infinity or missing) does not count.
 */
export function eraAt(firstAt: Readonly<Partial<Record<TechId, number>>> | undefined, t: number): EraNumber {
  let era: EraNumber = 1;
  if (firstAt === undefined) return era;
  for (const keystone of ERA_KEYSTONES) {
    const at = firstAt[keystone.techId];
    if (at !== undefined && at <= t && keystone.era > era) era = keystone.era;
  }
  return era;
}

/** Distinct purchase instants inside [0, endT], ascending. */
function purchaseInstants(purchases: readonly { readonly t: number }[], endT: number): number[] {
  const times = purchases.map((p) => p.t).filter((t) => t >= 0 && t <= endT);
  times.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of times) {
    if (out.length === 0 || out[out.length - 1] !== t) out.push(t);
  }
  return out;
}

/**
 * Gaps between consecutive distinct purchase instants in [0, endT]; the first gap starts at t = 0. Equal instants merge.
 * No gap after the last purchase. firstAt (optional) gives the era column.
 */
export function purchaseGaps(
  purchases: readonly { readonly t: number; readonly id: TechId }[],
  endT: number,
  firstAt?: Readonly<Partial<Record<TechId, number>>>,
): Gap[] {
  const out: Gap[] = [];
  let prev = 0;
  for (const t of purchaseInstants(purchases, endT)) {
    if (t > prev) out.push({ from: prev, to: t, len: t - prev, era: eraAt(firstAt, prev) });
    prev = t;
  }
  return out;
}

/**
 * Stretches in [0, endT] with no purchase instant and no alive interval (a fault or a Find on screen). Intervals are
 * clipped to endT (an interval that starts after endT is ignored); overlapping intervals merge. firstAt gives the era column.
 */
export function eventGaps(
  purchases: readonly { readonly t: number; readonly id: TechId }[],
  intervals: readonly { readonly from: number; readonly to: number }[],
  endT: number,
  firstAt?: Readonly<Partial<Record<TechId, number>>>,
): Gap[] {
  const cover: Array<[number, number]> = purchaseInstants(purchases, endT).map((t): [number, number] => [t, t]);
  for (const iv of intervals) {
    if (iv.from > endT) continue;
    cover.push([iv.from, Math.max(iv.from, Math.min(iv.to, endT))]);
  }
  cover.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Gap[] = [];
  let cur = 0;
  for (const [a, b] of cover) {
    if (a > cur) out.push({ from: cur, to: a, len: a - cur, era: eraAt(firstAt, cur) });
    if (b > cur) cur = b;
  }
  return out;
}

/** Statistics of the gap lengths: n, median, p75, p90 and max (nearest rank). */
export function gapStats(gaps: readonly Gap[]): GapStats {
  const lens = gaps.map((g) => g.len).sort((a, b) => a - b);
  return {
    n: lens.length,
    median: quantile(lens, 0.5),
    p75: quantile(lens, 0.75),
    p90: quantile(lens, 0.9),
    max: quantile(lens, 1),
  };
}
