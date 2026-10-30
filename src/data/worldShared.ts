// WP28b (r1-FX1): the reach numbers that both lazy chunks read, the Director's (LivingWorldDirector) and the WorldReach chunk's (ReachFx,
// the Find marker, the poke layer). Kept in one tiny module so neither chunk loads the other's data: a number read by both lives here.
// SPLICE_REACH is the one WorldReach-only entry, kept here so ReachFx need not import the Splice data (see below). Pure data: no logic.
import type { ResourceId } from './types';

// reachLevel(rate, lo, hi): log scale from lo (L 0) to hi (L 1). lo is 1 per second for ee and xf (ME 10: a slower ME rate reads no reach; PR 10 and RS 100 are AD4 F35 / F36); hi is the rate that reads as full reach (AD2 F4). The law is in src/game/math/reachLevel.ts.
export const REACH_LEVEL: { lo: Record<ResourceId, number>; hi: Record<ResourceId, number> } = {
  lo: { me: 10, ee: 1, pr: 10, rs: 100, xf: 1 },
  hi: { me: 3e4, ee: 1e5, pr: 2e4, rs: 3e4, xf: 1e6 },
};

// The ground wave: the front's speed (world px a second) and the least gap between two waves (ms). The Director's startle timing (the
// denizens wait for the front, reachWave.ts) and the WorldReach wave read the same speed and gap.
export const GROUND_WAVE_SHARED = { speedPxPerS: 300, minGapMs: 3000 } as const;

// The crank ground pulse's speed (world px a second). The reach pulse (REACH_FX.groundPulse) and the Splice line delay (math/spliceWorld.ts) read it
// here; the Splice data keeps no copy.
export const GROUND_PULSE_SPEED_PX_PER_S = 480;

// Depth per yard lane px: the Splice objects, the Find marker and the walkers share this step, so a lane sits in front of the one behind it.
export const YARD_DEPTH_STEP = 0.01;

// The Splice numbers the WorldReach chunk reads: the Splice pulse layer's redraw cadence (SPLICE_FX.redrawHz) and the payphone drop's hood end
// (SPLICE_LINE_STYLE.drop.endDx / endDy, where an arc site sits). Copies, so ReachFx does not import data/spliceWorld: that module is read by
// the Director chunk too, and a shared import would hoist it (about 6 KB) into the shared chunk (cap 6 KB). worldReach.test.ts pins the copies
// equal to the Splice data; the Splice data owner repoints them here.
export const SPLICE_REACH = { redrawHz: 15, phoneDropEnd: { dx: -8, dy: -98 } } as const;
