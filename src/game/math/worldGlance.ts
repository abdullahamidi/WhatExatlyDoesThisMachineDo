// Glance schedule (WP23a, bible §7.6): when the next wordless glance comes and which denizen turns to camera. Why: glances
// must replay the same way for a seed, so the schedule is a sine hash of (k, seed) like the finale flock schedule (D4).
// Gaps come from WORLD_GLANCE (src/data/livingWorld.ts). Pure: no Phaser, no DOM, no random source.
import type { DenizenId } from '../../data/livingWorld';
import { WORLD_GLANCE } from '../../data/livingWorld';

/** Denizens that can glance at the camera (bible §7.6). */
export const GLANCE_TARGETS: readonly DenizenId[] = ['inspector', 'dog', 'crow', 'payphone'];

/** Sine hash of two integers in [0, 1): deterministic, no random source (same as finale.ts). */
function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}

/** Glance number k: delay in ms after the previous glance (inside WORLD_GLANCE[era], both ends inclusive) and its denizen. */
export function glanceSchedule(k: number, seed: number, era: 1 | 2): { afterMs: number; denizen: DenizenId } {
  const { minMs, maxMs } = WORLD_GLANCE[era];
  const afterMs = minMs + Math.floor(hash01(2 * k, seed) * (maxMs - minMs + 1));
  const index = Math.min(GLANCE_TARGETS.length - 1, Math.floor(hash01(2 * k + 1, seed) * GLANCE_TARGETS.length));
  // The index is always in range for a finite k and seed; the fallback only answers a NaN input.
  const denizen = GLANCE_TARGETS[index] ?? 'inspector';
  return { afterMs, denizen };
}
