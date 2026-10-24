// Part evolution tiers (WP22, docs/plan/PART_TIERS.md). Pure data: tier thresholds, beat timings and tier text live here.
// W0 seed: only the shared heartbeat clock (MK V lamps and Sensor 7 pulse on it). WP22 T2 adds the rest.

/** MK V heartbeat: every top-tier lamp pulses on one clock (World scene time). */
export const TIER_HEARTBEAT = { periodMs: 2400 } as const;
