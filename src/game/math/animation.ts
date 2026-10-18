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

/** Driver value picked from the activity sources: manual, automation, their sum for 'combined', or electric (EE/s). */
export function driverValue(driver: AnimationDriver, manual: number, automation: number, electric = 0): number {
  switch (driver) {
    case 'manual':
      return manual; // manual only
    case 'automation':
      return automation; // automation only
    case 'combined':
      return manual + automation; // sum of both
    case 'electric':
      return electric; // electric only
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
