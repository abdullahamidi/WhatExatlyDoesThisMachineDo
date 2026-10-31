// WP28b (D6 b, c; r1-FX1): the world props' reach maths (WorldProps, the Director chunk): the lamp wobble, the era IV hum, the era I pebble
// count and the era IV puddle ring gaps. Pure: no Phaser, no DOM. Split from math/worldReach.ts so the Director chunk does not load the ReachFx
// rules; every number is in src/data/worldFx.ts. Every function is total: NaN and bad input give the safe default, never a throw.
//
// Exports:
//   lampWobbleAt(tMs, level01)            lamp brightness offset: a sine at lampWobble.hz, |offset| <= maxAmp x L
//   humOffsetPx(level01, tMs, phase01)    hum jitter in x: 0 up to startLevel, 1 px to strongLevel, 2 px above; the sign flips at 2-4 Hz
//   pebbleCount(level01)                  pebbles at the booth foot: 2 below minLevel, then 2 + the share of 4 by L (2..6)
//   puddleRingGapMs(k, seed)              the gap before puddle ring k: a hash inside puddleRing.everyMs
import { WORLD_FX } from '../../data/worldFx';

const MS_PER_SECOND = 1000;

// x clamped to [0, 1]; NaN reads 0.
function unit(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

// Seconds from a time in ms; a non-finite time reads 0.
function secOf(tMs: number): number {
  return Number.isFinite(tMs) ? tMs / MS_PER_SECOND : 0;
}

// A 32-bit integer hash of two counters to [0, 1). No sin and no shared state, so a gap sequence repeats for the same counters. (Not
// worldBehaviour's hash01: that module would join this chunk.)
function hashUnit(a: number, b: number): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Lamp brightness offset at tMs: maxAmp x L x sin(2 pi hz t), inside [-maxAmp x L, +maxAmp x L]. */
export function lampWobbleAt(tMs: number, level01: number): number {
  const { maxAmp, hz } = WORLD_FX.lampWobble;
  return maxAmp * unit(level01) * Math.sin(2 * Math.PI * hz * secOf(tMs));
}

/** Hum jitter in x (art px, signed) for one object at tMs. Zero up to startLevel; magnitude 1 up to strongLevel, 2 above. The sign
 *  flips 2-4 Hz (faster with more reach); phase01 (a fraction of a flip cycle) offsets each object. */
export function humOffsetPx(level01: number, tMs: number, phase01: number): number {
  const { startLevel, strongLevel, hz, stepPx } = WORLD_FX.hum;
  const L = unit(level01);
  if (L <= startLevel) return 0;
  const px = L > strongLevel ? stepPx[1] : stepPx[0];
  const flipsPerS = hz[0] + (hz[1] - hz[0]) * L;
  const k = Math.floor(flipsPerS * secOf(tMs) + (Number.isFinite(phase01) ? phase01 : 0));
  return Math.abs(k) % 2 === 0 ? px : -px;
}

/** Pebbles at the booth foot: minCount below minLevel, then minCount + floor((maxCount - minCount) x L), at most maxCount. */
export function pebbleCount(level01: number): number {
  const { minCount, maxCount, minLevel } = WORLD_FX.pebbles;
  const L = unit(level01);
  if (L < minLevel) return minCount;
  return Math.min(maxCount, minCount + Math.floor((maxCount - minCount) * L));
}

/** Gap (ms) before puddle ring k: a hash of (k, seed) inside puddleRing.everyMs. */
export function puddleRingGapMs(k: number, seed: number): number {
  const [lo, hi] = WORLD_FX.puddleRing.everyMs;
  return lo + (hi - lo) * hashUnit(k, seed);
}
