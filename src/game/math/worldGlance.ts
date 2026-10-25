// Glance schedule (WP23a, bible §7.6; WP23b eras III-IV): when the next wordless glance comes and which denizen turns to camera,
// and the era V double exposure (DENIZEN_ART §5) on its own hash stream. Why: glances and exposures must replay the same way for
// a seed, so both are sine hashes of (k, seed) like the finale flock schedule (D4). Gaps and targets come from WORLD_GLANCE
// (src/data/livingWorld.ts) and WORLD_DOUBLE_EXPOSURE (src/data/worldEras.ts). Pure: no Phaser, no DOM, no random source.
import type { DenizenId } from '../../data/livingWorld';
import { WORLD_GLANCE } from '../../data/livingWorld';
import { WORLD_DOUBLE_EXPOSURE } from '../../data/worldEras';

/** Denizens that can glance at the camera (bible §7.6). */
export const GLANCE_TARGETS: readonly DenizenId[] = ['inspector', 'dog', 'crow', 'payphone'];

/** A double exposure target: one whole-self frame of this denizen (WORLD_DOUBLE_EXPOSURE.targets). */
export type DoubleExposureTarget = (typeof WORLD_DOUBLE_EXPOSURE.targets)[number];

// Index offset of the double exposure hash stream: far from the glance indexes (2k and 2k + 1), so the two streams never share an index.
const DOUBLE_EXPOSURE_SALT = 100003;

/** Sine hash of two integers in [0, 1): deterministic, no random source (same as finale.ts). */
function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}

/** Glance number k: delay in ms after the previous glance (inside WORLD_GLANCE[era], both ends inclusive) and its denizen. */
export function glanceSchedule(k: number, seed: number, era: 1 | 2 | 3 | 4): { afterMs: number; denizen: DenizenId } {
  const { minMs, maxMs } = WORLD_GLANCE[era];
  const afterMs = minMs + Math.floor(hash01(2 * k, seed) * (maxMs - minMs + 1));
  const index = Math.min(GLANCE_TARGETS.length - 1, Math.floor(hash01(2 * k + 1, seed) * GLANCE_TARGETS.length));
  // The index is always in range for a finite k and seed; the fallback only answers a NaN input.
  const denizen = GLANCE_TARGETS[index] ?? 'inspector';
  return { afterMs, denizen };
}

/** Double exposure number k: delay in ms after the previous one (WORLD_DOUBLE_EXPOSURE minMs..maxMs, both inclusive) and its target. Deterministic per (k, seed). */
export function doubleExposureSchedule(k: number, seed: number): { afterMs: number; target: DoubleExposureTarget } {
  const { minMs, maxMs, targets } = WORLD_DOUBLE_EXPOSURE;
  const base = 2 * k + DOUBLE_EXPOSURE_SALT;
  const afterMs = minMs + Math.floor(hash01(base, seed) * (maxMs - minMs + 1));
  const index = Math.min(targets.length - 1, Math.floor(hash01(base + 1, seed) * targets.length));
  // The index is always in range for a finite k and seed; the fallback only answers a NaN input.
  const target = targets[index] ?? targets[0];
  return { afterMs, target };
}
