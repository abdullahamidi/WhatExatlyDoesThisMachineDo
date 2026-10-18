import { partAngle } from './driveTrain';

/** Normalise an angle into [0, 360) and map -0 to +0. Non-finite input gives 0. */
export const normDeg = (d: number): number => {
  if (!Number.isFinite(d)) return 0;
  const n = ((d % 360) + 360) % 360; // ((d % 360) + 360) % 360
  return n === 0 ? 0 : n; // -0 === 0 is true, so this returns +0 for both zeros
};

/**
 * Offset of a crank part relative to the gear it is pinned to, captured at the moment gearing starts.
 * crank angle on gear = normDeg(partAngle(master) + offset) reproduces the free-crank angle exactly.
 */
export function crankOffsetOnGearUp(crankDeg: number, masterDeg: number, ratio: number, phaseDeg: number): number {
  return normDeg(partAngle(crankDeg, ratio, phaseDeg) - partAngle(masterDeg, ratio, phaseDeg));
}

/**
 * Angle of a crank part. Free (no gears): follows its own crank state. Geared: follows the master angle plus the
 * offset captured when gearing started, so the crank does not snap when the pinion meshes.
 */
export function crankAngle(
  geared: boolean,
  crankDeg: number,
  masterDeg: number,
  offsetDeg: number,
  ratio: number,
  phaseDeg: number,
): number {
  return geared
    ? normDeg(partAngle(masterDeg, ratio, phaseDeg) + offsetDeg)
    : partAngle(crankDeg, ratio, phaseDeg);
}
