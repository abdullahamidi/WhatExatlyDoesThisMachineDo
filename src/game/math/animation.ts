import type { AnimationDriver, SpeedCurve, Vec2 } from '../../data/machineComponents';

/** Clamp v into [lo, hi]. */
function clampTo(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi); // max(v, lo) then min(.., hi)
}

/** Normalise -0 to 0. */
function noNegativeZero(v: number): number {
  return v === 0 ? 0 : v; // -0 === 0 is true, so this returns +0 for both zeros
}

/** Animation speed from a driver value: base * (1 + gain * log10(1 + v)), clamped to [min, max]; 0 for non-positive or non-finite drivers. */
export function animationSpeed(curve: SpeedCurve, driverValue: number): number {
  if (!Number.isFinite(driverValue) || driverValue <= 0) return 0;
  const raw = curve.base * (1 + curve.gain * Math.log10(1 + driverValue)); // base * (1 + gain * log10(1 + v))
  return clampTo(raw, curve.min, curve.max);
}

/** Exponential decay of activity: value * e^(-dt / tau); values below 1e-3 snap to 0; dt <= 0 or non-finite returns value. */
export function decayActivity(value: number, dtSeconds: number, tauSeconds: number): number {
  if (!(dtSeconds > 0) || !Number.isFinite(dtSeconds)) return value;
  const r = value * Math.exp(-dtSeconds / tauSeconds); // value * e^(-dt / tau)
  return r < 1e-3 ? 0 : r; // snap tiny residue to rest
}

/** Add a click impulse to activity: value + gained / tau; non-positive or non-finite gains are ignored. */
export function addActivity(value: number, gained: number, tauSeconds: number): number {
  if (!(gained > 0) || !Number.isFinite(gained)) return value;
  return value + gained / tauSeconds; // value + gained / tau
}

/** Driver value picked from the activity sources: manual, automation, their sum for 'combined', electric (EE/s), or thermal (PR/s). */
export function driverValue(driver: AnimationDriver, manual: number, automation: number, electric = 0, thermal = 0): number {
  switch (driver) {
    case 'manual':
      return manual; // manual only
    case 'automation':
      return automation; // automation only
    case 'combined':
      return manual + automation; // sum of both
    case 'electric':
      return electric; // electric only
    case 'thermal':
      return thermal; // thermal only
  }
}

/**
 * Frame of a frame-cycle part at time t: floor(t * maxHz) % frames while active. 0 when inactive, frames < 2,
 * maxHz <= 0, or t negative / non-finite.
 */
export function framesIndex(t: number, frames: number, maxHz: number, active: boolean): number {
  if (!active || !Number.isFinite(frames) || frames < 2) return 0;
  if (!Number.isFinite(maxHz) || maxHz <= 0 || !(t >= 0) || !Number.isFinite(t)) return 0;
  return Math.floor(t * maxHz) % frames; // whole steps of maxHz, wrapped to the frame count
}

/** Frame time in seconds: deltaMs / 1000 capped at maxSeconds; NaN, negative or zero input gives 0. */
export function clampFrameSeconds(deltaMs: number, maxSeconds: number): number {
  if (!(deltaMs > 0)) return 0; // rejects NaN, negatives and zero
  return Math.min(deltaMs / 1000, maxSeconds); // min(delta / 1000, max)
}

/** Phase advance in cycles wrapped to [0, 1): x = phase + cps * dt; x - floor(x). */
export function advancePhase(phase: number, cyclesPerSecond: number, dtSeconds: number): number {
  const x = phase + cyclesPerSecond * dtSeconds; // linear advance
  const raw = Number.isFinite(x) ? x : phase; // non-finite advance keeps the old phase
  const frac = raw - Math.floor(raw); // fractional part
  return frac >= 1 || !Number.isFinite(frac) ? 0 : noNegativeZero(frac); // rounding can give exactly 1
}

/** Vibration offset in whole art px: x = round(A sin(2 pi phase 7)), y = round(A sin(2 pi phase 11 + 1)). */
export function vibrateOffset(phase: number, amplitude: number): Vec2 {
  const x = Math.round(amplitude * Math.sin(2 * Math.PI * phase * 7)); // fast horizontal jitter
  const y = Math.round(amplitude * Math.sin(2 * Math.PI * phase * 11 + 1)); // offset vertical jitter
  return { x: noNegativeZero(x), y: noNegativeZero(y) };
}

/**
 * Crank offset of a reciprocating part in whole art px: round(-(stroke / 2) * (1 + cos(ratio * masterDeg + phase))).
 * 0 at the strike (driven angle 180 deg); -stroke at the top of travel. Non-finite input gives 0.
 */
export function reciprocateOffset(masterDeg: number, ratio: number, strokeArtPx: number, phaseDeg: number): number {
  if (![masterDeg, ratio, strokeArtPx, phaseDeg].every((v) => Number.isFinite(v))) return 0;
  const theta = ((ratio * masterDeg + phaseDeg) * Math.PI) / 180; // driven angle in radians
  const off = Math.round((-strokeArtPx / 2) * (1 + Math.cos(theta))); // whole px, 0 at the strike
  return noNegativeZero(off);
}

/**
 * Strikes between two master angles: |floor((b - 180) / 360) - floor((a - 180) / 360)| with a = ratio * prev + phase
 * and b = ratio * next + phase. Each crossing of 180 deg (mod 360) counts once, in either direction. Non-finite gives 0.
 */
export function strikeCount(prevDeg: number, nextDeg: number, ratio: number, phaseDeg: number): number {
  if (![prevDeg, nextDeg, ratio, phaseDeg].every((v) => Number.isFinite(v))) return 0;
  const a = ratio * prevDeg + phaseDeg; // driven angle before the step
  const b = ratio * nextDeg + phaseDeg; // driven angle after the step
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.abs(Math.floor((b - 180) / 360) - Math.floor((a - 180) / 360)); // whole crossings of 180 deg
}

/**
 * Gauge sheet frame: round(clamp01((log10(1 + v) - minLog) / (maxLog - minLog)) * (frames - 1)).
 * Frame 0 for non-finite or negative v, frames < 2, or maxLog <= minLog.
 */
export function gaugeFrame(v: number, frames: number, minLog: number, maxLog: number): number {
  if (!Number.isFinite(v) || !(v >= 0)) return 0;
  if (!Number.isFinite(frames) || frames < 2) return 0;
  if (!Number.isFinite(minLog) || !Number.isFinite(maxLog) || !(maxLog > minLog)) return 0;
  const t = clampTo((Math.log10(1 + v) - minLog) / (maxLog - minLog), 0, 1); // position on the log scale
  return noNegativeZero(Math.round(t * (frames - 1))); // whole frame index
}

/**
 * Exponential low-pass towards target: prev + (target - prev) * (1 - e^(-dt / tau)).
 * dt <= 0 or non-finite returns prev; tau <= 0 jumps straight to target.
 */
export function lowPass(prev: number, target: number, dtSeconds: number, tauSeconds: number): number {
  if (!(dtSeconds > 0) || !Number.isFinite(dtSeconds)) return prev;
  if (!(tauSeconds > 0)) return target; // no smoothing
  const k = 1 - Math.exp(-dtSeconds / tauSeconds); // blend factor in [0, 1)
  const next = prev + (target - prev) * k; // move part of the way to the target
  return Number.isFinite(next) ? noNegativeZero(next) : prev;
}

/** Wrap an angle in degrees into [0, 360); rounding that lands on 360 wraps to 0; never -0. */
function wrapDeg(angleDeg: number): number {
  const r = angleDeg - 360 * Math.floor(angleDeg / 360); // remainder, [0, 360) up to rounding
  return r >= 360 || r < 0 ? 0 : noNegativeZero(r);
}

/**
 * Rotor angle after dt: wrap(angle + degPerSec * dt) into [0, 360). A non-finite step keeps the wrapped angle;
 * a non-finite angle gives 0.
 */
export function spinStep(angleDeg: number, degPerSec: number, dtSeconds: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  const step = degPerSec * dtSeconds; // degrees travelled this frame
  return wrapDeg(Number.isFinite(step) ? angleDeg + step : angleDeg);
}
