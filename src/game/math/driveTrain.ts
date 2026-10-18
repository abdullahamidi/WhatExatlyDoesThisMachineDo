import type { Vec2 } from '../../data/machineComponents';

/** Unwrapped master angle state: deg = thetaM (float, degrees), pending = queued click impulse (deg of thetaM). */
export interface MasterState { deg: number; pending: number }

/** Mesh parameters of one gear: ratio to thetaM, phase in degrees, tooth count. */
export interface GearMesh { ratio: number; phaseDeg: number; teeth: number }

/** Pending remainders below this (deg) are folded into deg in the same step. */
const FLUSH_EPSILON = 1e-3;

/** Normalise -0 to 0. */
function noNegativeZero(v: number): number {
  return v === 0 ? 0 : v; // -0 === 0 is true, so this returns +0 for both zeros
}

/** Fractional part x - floor(x), in [0, 1). */
function frac(x: number): number {
  return x - Math.floor(x); // x - floor(x)
}

/** Queue a click impulse: pending += crankDeg / crankRatio; non-finite inputs or ratio 0 return s unchanged. */
export function addClickImpulse(s: MasterState, crankDeg: number, crankRatio: number): MasterState {
  if (!Number.isFinite(crankDeg) || !Number.isFinite(crankRatio) || crankRatio === 0) return s;
  return { deg: s.deg, pending: noNegativeZero(s.pending + crankDeg / crankRatio) }; // pending + crankDeg / ratio
}

/**
 * One fixed step of the master angle.
 * take = pending * (1 - e^(-dt / tau)) is released into deg; |pending| < 1e-3 is flushed in the same step.
 * deg' = deg + direction * degPerSec * dt + take.
 */
export function stepMaster(s: MasterState, degPerSec: number, direction: 1 | -1, dt: number, tauSec: number): MasterState {
  if (
    !(dt > 0) ||
    !Number.isFinite(dt) ||
    !Number.isFinite(degPerSec) ||
    !Number.isFinite(s.deg) ||
    !Number.isFinite(s.pending) ||
    !Number.isFinite(tauSec)
  ) {
    return s;
  }
  const e = tauSec > 0 ? Math.exp(-dt / tauSec) : 0; // e = e^(-dt / tau); tau <= 0 releases everything at once
  let take = s.pending * (1 - e); // released share of the queued impulse
  let pending = s.pending - take; // still queued
  if (Math.abs(pending) < FLUSH_EPSILON) {
    take += pending; // flush the tiny remainder so impulses are conserved exactly
    pending = 0;
  }
  const deg = s.deg + direction * degPerSec * dt + take; // drift + released impulse
  return { deg: noNegativeZero(deg), pending: noNegativeZero(pending) };
}

/** Part angle in [0, 360): wrap(ratio * masterDeg + phaseDeg); non-finite gives 0. */
export function partAngle(masterDeg: number, ratio: number, phaseDeg: number): number {
  const x = ratio * masterDeg + phaseDeg; // ratio * thetaM + phase
  if (!Number.isFinite(x)) return 0;
  return noNegativeZero(((x % 360) + 360) % 360); // ((x % 360) + 360) % 360
}

/**
 * Slider-crank kinematics. pin = centre + r (cos a, sin a); slider.x = centre.x;
 * slider.y = pin.y - sqrt(max(0, L^2 - dx^2)) with dx = pin.x - centre.x.
 */
export function sliderCrank(centre: Vec2, pinRadius: number, rodLength: number, angleDeg: number): { pin: Vec2; slider: Vec2 } {
  const a = (angleDeg * Math.PI) / 180; // degrees to radians
  const pinX = centre.x + pinRadius * Math.cos(a); // pin on the crank circle
  const pinY = centre.y + pinRadius * Math.sin(a);
  const dx = pinX - centre.x; // horizontal pin offset from the slider guide
  const reach = Math.sqrt(Math.max(0, rodLength * rodLength - dx * dx)); // vertical rod reach, 0 when dx exceeds L
  return {
    pin: { x: noNegativeZero(pinX), y: noNegativeZero(pinY) },
    slider: { x: noNegativeZero(centre.x), y: noNegativeZero(pinY - reach) },
  };
}

/**
 * Tooth-meshing error of two gears on the same master: 0 = perfectly meshed, range [0, 0.5].
 * fL = frac(thetaL * teethL / 360); fS = frac((thetaS - 180) * teethS / 360); error = |frac(fL + fS) - 0.5|.
 */
export function meshPhaseError(masterDeg: number, large: GearMesh, small: GearMesh): number {
  const thetaL = partAngle(masterDeg, large.ratio, large.phaseDeg); // large gear angle
  const thetaS = partAngle(masterDeg, small.ratio, small.phaseDeg); // small gear angle
  const fL = frac((thetaL * large.teeth) / 360); // large gear tooth position, in pitches
  const fS = frac(((thetaS - 180) * small.teeth) / 360); // small gear, half a turn offset for the mesh side
  return Math.abs(frac(fL + fS) - 0.5); // distance from the meshed half-pitch
}
