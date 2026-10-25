// World tier port (WP23 X1): binds the TierPort seam (worldTierRules, D8) to the WP22 tier maths in partTiers.ts and the data in
// machineTiers.ts. Why: the living world asks what tier a part is, whether any track is at top, and whether the MK V heartbeat is low,
// and gets the same answers the machine draws, so the DOG-04, INS-13, hole and Sensor 7 LED beats stay in step with the parts.
// Pure: no Phaser, no DOM. The heartbeat clock is World scene time (WP22 C4); the caller passes nowMs in.
import { PART_TIERS } from '../../data/machineTiers';
import { heartbeatLow, tierOf, topTierOf, trackOf } from './partTiers';
import type { TierPort } from './worldTierRules';

/** The live TierPort. A tech with no track (every non-part tech, horizonField included) is tier 1 and top 1. */
export const WP22_TIER_PORT: TierPort = {
  tierOf(techId, levels) {
    const track = trackOf(techId);
    if (track === undefined) return 1;
    return tierOf(levels[techId] ?? 0, track.levels);
  },
  topTier(techId) {
    const track = trackOf(techId);
    return track === undefined ? 1 : topTierOf(track);
  },
  anyTop(levels) {
    return PART_TIERS.some((track) => tierOf(levels[track.techId] ?? 0, track.levels) === topTierOf(track));
  },
  heartbeatLow: (nowMs) => heartbeatLow(nowMs),
};
