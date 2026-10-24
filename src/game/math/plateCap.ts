import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { TechId } from '../../data/types';

// WP21 demo teaser: the stand-in nameplate reads its era III/IV stage gates, so the demo caps the plate at the cap tech's
// frame and the teaser never spells the answer. Pure: the gate list comes from the namePlate animation, not from a copy.
// WP16b-3: store shots reuse the gate list for the World plate (debug hook setPlateCap).

export type PlateLevels = Readonly<Record<TechId, number>>;

const plateAnimation = MACHINE_COMPONENTS.namePlate.animation;
/** Plate gates in plaque order. Empty when the namePlate is not a stage animation. Frozen. */
const PLATE_GATES: readonly TechId[] = Object.freeze(
  plateAnimation.kind === 'stage' ? plateAnimation.gates.map(([techId]) => techId) : [],
);

/** Nameplate gate techs in plaque order, read from the namePlate stage animation (empty when it is not a stage animation). */
export function plateGateTechs(): readonly TechId[] {
  return PLATE_GATES;
}

// Capped levels per (input levels, cap tech). Keyed by the input object so equal inputs give the same reference.
const cappedCache = new WeakMap<PlateLevels, Map<TechId, PlateLevels>>();

/**
 * Levels with every plate gate AFTER maxTech (in gate order) set to 0. A null maxTech, or a tech that is not a plate gate,
 * returns `levels` itself. Never mutates the input; the result is frozen and cached per (levels, maxTech).
 */
export function capPlateLevels(levels: PlateLevels, maxTech: TechId | null): PlateLevels {
  if (maxTech === null) return levels;
  const index = PLATE_GATES.indexOf(maxTech);
  if (index < 0) return levels;
  let byTech = cappedCache.get(levels);
  if (byTech === undefined) {
    byTech = new Map<TechId, PlateLevels>();
    cappedCache.set(levels, byTech);
  }
  let out = byTech.get(maxTech);
  if (out === undefined) {
    const capped: Record<TechId, number> = { ...levels };
    // Plate gates after the cap read as unmet: the plate stops at the cap tech's frame.
    for (const later of PLATE_GATES.slice(index + 1)) capped[later] = 0;
    out = Object.freeze(capped);
    byTech.set(maxTech, out);
  }
  return out;
}

/**
 * WP16b-3 store shots: highest namePlate frame a cap allows = the cap tech's gate index + 1 (generatorBlueprint 1,
 * substationBlueprint 2 = RES?OR?, pressureVesselBlueprint 3, harmonicConvergence 4). Null for a null cap or a tech that is not a plate gate.
 */
export function plateFrameCap(maxTech: TechId | null): number | null {
  if (maxTech === null) return null;
  const index = PLATE_GATES.indexOf(maxTech);
  return index < 0 ? null : index + 1;
}

/** WP16b-3: frame limited to plateFrameCap(maxTech) (Math.min); the frame itself without a cap. Also caps the finale ending frame. */
export function cappedPlateFrame(frame: number, maxTech: TechId | null): number {
  const cap = plateFrameCap(maxTech);
  return cap === null ? frame : Math.min(frame, cap);
}

/**
 * WP16b-3 store shots: the levels the HUD plaque reads under a plate cap. capPlateLevels zeroes the plate gates past the cap; primaryFunction
 * (the revealed-plaque milestone, not a plate gate) is zeroed too so the plaque never spells RESTORE. A null cap, or a tech that is not a plate
 * gate (plateFrameCap null), returns `levels` itself.
 */
export function cappedPlaqueLevels(levels: PlateLevels, cap: TechId | null): PlateLevels {
  return cap === null || plateFrameCap(cap) === null ? levels : { ...capPlateLevels(levels, cap), primaryFunction: 0 };
}
