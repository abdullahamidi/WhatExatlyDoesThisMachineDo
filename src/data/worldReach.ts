// The machine's reach (WP28a, P17): the rate range that maps a resource's per-second rate to the normalised reach level L (0..1)
// that drives the Splice pulses and, from WP28b, the reach effects. Pure data: no logic lives here. The law is in
// src/game/math/reachLevel.ts.
import type { ResourceId } from './types';

// reachLevel(rate, lo, hi): log scale from lo (L 0) to hi (L 1). lo is 1 per second (ME 10: a slower ME rate reads no reach); hi is the rate that reads as full reach (AD2 F4).
export const REACH_LEVEL: { lo: Record<ResourceId, number>; hi: Record<ResourceId, number> } = {
  lo: { me: 10, ee: 1, pr: 1, rs: 1, xf: 1 },
  hi: { me: 3e4, ee: 1e5, pr: 1e6, rs: 1e6, xf: 1e6 },
};
