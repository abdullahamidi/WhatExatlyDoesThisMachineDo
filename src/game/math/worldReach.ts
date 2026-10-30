// Reach FX maths (WP28b, D6): the schedules, rates, offsets and gates of the machine's reach effects (the WorldReach chunk). Pure: no Phaser,
// no DOM. Numbers come from src/data/worldReach.ts (REACH_FX) and src/data/worldShared.ts; the level law stays in reachLevel.ts, the wave's
// arrival in reachWave.ts and the world props' maths in worldFx.ts (the Director chunk). Renderers call these every frame, so nothing here
// allocates except the entries pylonDotPositions adds to `out`. Every function is total: NaN and bad input give the safe default, never a throw.
//
// Exports:
//   type FxKind                           the effect names fxEnabled reads
//   FLASH_GAP_MS                          least gap between two flash starts of one kind: 1000 / maxFlashHz, rounded up (3 Hz is 334 ms)
//   PULSE_GAP_MS                          least gap between two crank ground pulses: the larger of groundPulse.minGapMs and FLASH_GAP_MS
//   throttleOk(lastMs, nowMs, gapMs)      true once gapMs has passed since lastMs (lastMs -Infinity: always true)
//   dustFrequencyMs(v)                    DustField frequency for an output rate v (dustLaw; never below floorMs)
//   pylonDotCount(level01)                dots on a pylon line: 1 + floor(levelSteps x L), 1..maxDots
//   pylonDotPositions(points, count, tMs, out)   dots spaced evenly along a polyline (world px), travelling pxPerS and wrapping; fills `out`
//                                         and returns the count written (0 for fewer than 2 points; cut so that no point sees more than
//                                         maxFlashHz dot passes a second, so a short cable carries fewer dots)
//   arcRatePerS(eeRate)                   arc spawns a second on the lines (arc.rate, clamped)
//   driftRatePerS(prRate)                 steam puff spawns a second (drift.rate, clamped)
//   spawnDue(dtMs, ratePerS, u01)         true when a Poisson spawn falls in this tick (u01 in [0, 1))
//   groundWaveX(startX, dir, ageMs)       front x of a ground wave: startX + dir x groundWave.speedPxPerS x age
//   debrisRiseArt(ageMs, riseMs, targetArt)   a debris speck's rise in art px: 0..targetArt, non-decreasing in age, never negative
//   debrisBobPx(tMs, phase01)             a hanging speck's bob: +-debris.bobPx at debris.bobHz
//   fxEnabled(kind, reduced)              whether an effect is drawn; under reduced motion only 'debris' (static specks)
//   debrisMoves(reduced)                  whether debris rises and bobs (false under reduced motion)
//   flashHz(timesMs)                      the most events in any 1 s window (test helper; non-finite times are ignored)
import type { Vec2 } from '../../data/machineComponents';
import { REACH_FX } from '../../data/worldReach';

export type FxKind = 'groundPulse' | 'groundWave' | 'baseDust' | 'pylonPulse' | 'arc' | 'drift' | 'debris' | 'lamp' | 'pebbles' | 'hum' | 'puddle';

const MS_PER_SECOND = 1000;
// Starts of one kind wait this long, so no 1 s window holds more than maxFlashHz of them (3 Hz: starts at 0, 334, 668 fit; 1002 does not).
export const FLASH_GAP_MS = Math.ceil(MS_PER_SECOND / REACH_FX.maxFlashHz);
// A 250 ms crank gap would start four pulses in a second; the flash cap wins, so the crank gap is the larger of the two.
export const PULSE_GAP_MS = Math.max(REACH_FX.groundPulse.minGapMs, FLASH_GAP_MS);

// x clamped to [0, 1]; NaN reads 0.
function unit(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

// x, or 0 for NaN and negatives (+Infinity passes).
function nonNeg(x: number): number {
  return x > 0 ? x : 0;
}

// x clamped to [lo, hi]; NaN reads lo.
function clampTo(x: number, lo: number, hi: number): number {
  return x > lo ? (x < hi ? x : hi) : lo;
}

// Seconds from a time in ms; a non-finite time reads 0.
function secOf(tMs: number): number {
  return Number.isFinite(tMs) ? tMs / MS_PER_SECOND : 0;
}

/** True once gapMs has passed since lastMs. NaN times and a NaN gap read false. */
export function throttleOk(lastMs: number, nowMs: number, gapMs: number): boolean {
  return nowMs - lastMs >= gapMs;
}

/** DustField frequency (ms between motes) for an output rate v: baseMs / (1 + perLog x log10(1 + v)), never below floorMs. */
export function dustFrequencyMs(v: number): number {
  const { baseMs, perLog, floorMs } = REACH_FX.dustLaw;
  return Math.max(floorMs, baseMs / (1 + perLog * Math.log10(1 + nonNeg(v))));
}

/** Dots on a pylon line at level01: 1 + floor(levelSteps x L), between 1 and maxDots. */
export function pylonDotCount(level01: number): number {
  const { maxDots, levelSteps } = REACH_FX.pylonPulse;
  return Math.min(maxDots, 1 + Math.floor(levelSteps * unit(level01)));
}

// Length of one segment (world px); a segment with a non-finite end counts as 0.
function segLen(a: Vec2, b: Vec2): number {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return Number.isFinite(len) ? len : 0;
}

// Length of the whole polyline (world px).
function polyLength(points: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined) total += segLen(a, b);
  }
  return total;
}

// Writes into dst the point d world px along the polyline from its first point (d inside the length; past the end reads the end).
function pointAt(points: readonly Vec2[], d: number, dst: Vec2): void {
  let left = d;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    const len = segLen(a, b);
    if (left <= len || i === points.length - 1) {
      const f = len > 0 ? unit(left / len) : 0;
      dst.x = a.x + (b.x - a.x) * f;
      dst.y = a.y + (b.y - a.y) * f;
      return;
    }
    left -= len;
  }
}

/** Dots along a polyline (world px): count evenly spaced dots travelling pxPerS at tMs, wrapping at the end. Fills out (reusing its entries)
 *  and returns the count written. Fewer than two points write nothing (0). The count is cut so that each point sees at most maxFlashHz dot
 *  passes a second: n x pxPerS / length <= maxFlashHz. */
export function pylonDotPositions(points: readonly Vec2[], count: number, tMs: number, out: Vec2[]): number {
  if (points.length < 2) return 0;
  const total = polyLength(points);
  const { pxPerS } = REACH_FX.pylonPulse;
  const cap = Math.floor((total * REACH_FX.maxFlashHz) / pxPerS);
  const n = Math.min(Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0, cap);
  if (!(n > 0)) return 0;
  const phase = (nonNeg(Number.isFinite(tMs) ? tMs : 0) * pxPerS) / MS_PER_SECOND;
  for (let k = 0; k < n; k++) {
    const along = phase + (k * total) / n;
    let dst = out[k];
    if (dst === undefined) {
      dst = { x: 0, y: 0 };
      out[k] = dst;
    }
    pointAt(points, along - total * Math.floor(along / total), dst);
  }
  return n;
}

interface RateLaw { readonly base: number; readonly perLog: number; readonly min: number; readonly max: number }
// clamp(base + perLog x log10(1 + v), min, max): the rate of a line-side effect from its driver v (per second).
function rateLaw(law: RateLaw, v: number): number {
  return clampTo(law.base + law.perLog * Math.log10(1 + nonNeg(v)), law.min, law.max);
}

/** Arc spawns a second on the lines for the EE/s driver. */
export function arcRatePerS(eeRate: number): number {
  return rateLaw(REACH_FX.arc.rate, eeRate);
}

/** Steam puff spawns a second for the PR/s driver. */
export function driftRatePerS(prRate: number): number {
  return rateLaw(REACH_FX.drift.rate, prRate);
}

/** True when a Poisson spawn with ratePerS lands in a tick of dtMs: u01 < 1 - exp(-rate x dt). u01 is a uniform draw in [0, 1). */
export function spawnDue(dtMs: number, ratePerS: number, u01: number): boolean {
  const chance = 1 - Math.exp((-nonNeg(ratePerS) * nonNeg(dtMs)) / MS_PER_SECOND);
  return u01 >= 0 && u01 < chance;
}

/** Front x of a ground wave: startX + dir x speed x age (dir +1 or -1; any other dir holds the start). */
export function groundWaveX(startX: number, dir: number, ageMs: number): number {
  const d = dir > 0 ? 1 : dir < 0 ? -1 : 0;
  return startX + (d * REACH_FX.groundWave.speedPxPerS * nonNeg(ageMs)) / MS_PER_SECOND;
}

/** A debris speck's rise (art px) at ageMs of a riseMs rise to targetArt: linear, 0 at the start, targetArt from riseMs on (it hangs there). Non-
 *  decreasing in age and never negative. A rise time that is not positive reads the target at once. */
export function debrisRiseArt(ageMs: number, riseMs: number, targetArt: number): number {
  const target = nonNeg(targetArt);
  if (!(riseMs > 0)) return target;
  return target * unit(nonNeg(ageMs) / riseMs);
}

/** A hanging speck's bob (art px, signed): +-debris.bobPx at debris.bobHz, offset by phase01 (a fraction of a cycle). */
export function debrisBobPx(tMs: number, phase01: number): number {
  const { bobPx, bobHz } = REACH_FX.debris;
  return bobPx * Math.sin(2 * Math.PI * (bobHz * secOf(tMs) + (Number.isFinite(phase01) ? phase01 : 0)));
}

/** Whether an effect is drawn. Under reduced motion only 'debris' is (as static specks); every other effect is off (the D6 table). */
export function fxEnabled(kind: FxKind, reduced: boolean): boolean {
  return !reduced || kind === 'debris';
}

/** Whether debris rises and bobs: never under reduced motion. */
export function debrisMoves(reduced: boolean): boolean {
  return !reduced;
}

/** The most events in any 1 s window [t, t + 1000) of timesMs (test helper; non-finite times are ignored). */
export function flashHz(timesMs: readonly number[]): number {
  const t = timesMs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  let best = 0;
  let end = 0;
  for (let start = 0; start < t.length; start++) {
    const from = t[start] ?? 0;
    if (end < start) end = start;
    while (end < t.length && (t[end] ?? Infinity) - from < MS_PER_SECOND) end++;
    best = Math.max(best, end - start);
  }
  return best;
}
