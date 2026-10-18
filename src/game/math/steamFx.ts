import type { EmitterMode } from '../../data/steamFx';
import type { Vec2 } from '../../data/machineComponents';

/** Puff timing as the renderer reads it; STEAM_FX satisfies this structurally. */
export interface PuffFx {
  lifeMs: number;      // puff lifetime
  frames: number;      // animation frames across the life
  riseArtPx: number;   // art px the puff climbs over its life
  driftArtPxPerS: number; // horizontal drift, art px per second
  scaleFrom: number;   // scale at birth
  scaleTo: number;     // scale at death
  fadeFrom: number;    // life fraction where the fade starts
}

/** Puff state at one age. */
export interface PuffState {
  frame: number;
  dx: number;
  dy: number;
  scale: number;
  alpha: number;
  done: boolean;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Maps -0 to 0 so expectations and draw offsets never carry a negative zero. */
function noNegZero(x: number): number {
  return x === 0 ? 0 : x;
}

/**
 * Puffs per second of a `rate` emitter at driver value `v`: clamp(base + perLog * log10(1 + v), min, max).
 * Negative and non-finite `v` count as 0. Burst and strike emitters do not run on a rate: 0.
 */
export function emitterRate(mode: EmitterMode, v: number): number {
  if (mode.kind !== 'rate') return 0;
  const x = Number.isFinite(v) ? Math.max(0, v) : 0;
  const raw = mode.base + mode.perLog * Math.log10(1 + x);
  return noNegZero(Math.min(mode.max, Math.max(mode.min, raw)));
}

/**
 * Advances a puff accumulator by `ratePerS * dtSeconds`. `spawn` is the whole puffs due now (1e-9 guards float
 * dust), `acc` the fraction carried on, always in [0, 1). A non-positive rate or dt changes nothing.
 */
export function stepEmitter(acc: number, ratePerS: number, dtSeconds: number): { acc: number; spawn: number } {
  if (!(ratePerS > 0) || !(dtSeconds > 0)) return { acc, spawn: 0 };
  const total = acc + ratePerS * dtSeconds;
  const spawn = Math.floor(total + 1e-9);
  const rest = total - spawn;
  return { acc: rest > 0 ? rest : 0, spawn };
}

/**
 * Deterministic delay in [minS, maxS] for burst number `index` (a hash of the index, not Math.random), so a
 * replay of the same burst count gives the same spacing.
 */
export function burstDelaySeconds(index: number, minS: number, maxS: number): number {
  const f = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  const h = f - Math.floor(f); // [0, 1)
  return minS + (maxS - minS) * h;
}

/**
 * Spawn points of one burst of `count` puffs. single null: puff i at points[i % n] (every point used).
 * single k: all `count` puffs at points[k mod n] (round robin, one point per burst). No points or count <= 0 gives [].
 * The returned entries are the input point objects themselves.
 */
export function burstPoints(points: readonly Vec2[], count: number, single: number | null): Vec2[] {
  const n = points.length; // number of spawn points
  if (n === 0 || !(count > 0) || !Number.isFinite(count)) return [];
  const total = Math.floor(count); // whole puffs in the burst
  const out: Vec2[] = [];
  if (single === null) {
    for (let i = 0; i < total; i++) {
      const p = points[i % n];
      if (p !== undefined) out.push(p); // puff i at point i % n
    }
    return out;
  }
  const whole = Number.isFinite(single) ? Math.floor(single) : 0; // whole index, finite
  const p = points[((whole % n) + n) % n]; // index normalised into [0, n)
  if (p === undefined) return [];
  for (let i = 0; i < total; i++) out.push(p);
  return out;
}

/**
 * Where a puff is at `ageMs`: animation frame, offset from its spawn point, scale, alpha, and whether it is over.
 * Negative and NaN ages count as 0.
 */
export function puffState(ageMs: number, fx: PuffFx): PuffState {
  const age = ageMs > 0 ? ageMs : 0;
  const t = fx.lifeMs > 0 ? clamp01(age / fx.lifeMs) : 1;
  const frame = Math.max(0, Math.min(fx.frames - 1, Math.floor(t * fx.frames)));
  const fadeSpan = 1 - fx.fadeFrom;
  const done = age >= fx.lifeMs;
  let alpha = 1;
  if (t >= fx.fadeFrom && fadeSpan > 0) {
    alpha = 1 - (t - fx.fadeFrom) / fadeSpan;
  } else if (t >= fx.fadeFrom) {
    alpha = done ? 0 : 1; // fade not defined (fadeFrom >= 1): full until the end
  }
  return {
    frame,
    dx: noNegZero((fx.driftArtPxPerS * age) / 1000),
    dy: noNegZero(-fx.riseArtPx * t),
    scale: fx.scaleFrom + (fx.scaleTo - fx.scaleFrom) * t,
    alpha: clamp01(alpha),
    done,
  };
}
