import type { SpeedCurve } from '../../data/machineComponents';

/** Clamp v into [lo, hi]. */
function clampTo(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi); // max(v, lo) then min(.., hi)
}

/** Animation speed from a driver value: base * (1 + gain * log10(1 + v)), clamped to [min, max]; 0 for non-positive or non-finite drivers. */
export function animationSpeed(curve: SpeedCurve, driverValue: number): number {
  if (!Number.isFinite(driverValue) || driverValue <= 0) return 0;
  const raw = curve.base * (1 + curve.gain * Math.log10(1 + driverValue)); // base * (1 + gain * log10(1 + v))
  return clampTo(raw, curve.min, curve.max);
}
