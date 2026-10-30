// WP28b (D6 b; r1-FX1): the ground wave's arrival time, the denizens' startle timing in LivingWorldDirector. Pure: no Phaser, no DOM. Split from
// math/worldReach.ts so the Director chunk loads this and the speed (data/worldShared.ts), not the ReachFx maths. Every function is total.
import { GROUND_WAVE_SHARED } from '../../data/worldShared';

const MS_PER_SECOND = 1000;

/** Time (ms) for a wave front to cover distancePx at the wave speed. A negative or NaN distance reads 0. */
export function waveArrivalMs(distancePx: number): number {
  const d = distancePx > 0 ? distancePx : 0;
  return (d / GROUND_WAVE_SHARED.speedPxPerS) * MS_PER_SECOND;
}
