import type { TechId } from './types';

// WP28 pacing data (Pacing set REC). Pure data: no logic lives in this file.

// Split tracks: each v0.11.0 track is cut into `parts` smaller steps (same power, half or a third of the cost per step).
// Only the save remap (src/simulation/economyMigration.ts) and the guard tests read the parts at run time.
export const SPLIT_PARTS = {
  copperWinding: 2, motorRetrofit: 2, transformer: 2, firebox: 2, inductionHeater: 3, condenser: 3,
  bellowsDrive: 3, harmonicCoil: 2, pressureResonator: 2, standingWave: 2, gridExciter: 3, containmentRing: 2,
  resonantSiphon: 3, graviticAnchor: 2, horizonField: 2, mainsBackfeed: 3, steamLance: 3,
} as const satisfies Partial<Record<TechId, 2 | 3>>;

// Saves written with econ >= this revision hold split-track levels in the new scale. Older saves are remapped on load.
export const ECON_REVISION = 28;
