// WP27 Machine Faults. Pure data: the fault clock's numbers (simulation/faults.ts only does arithmetic with them).
// The marker's art map, layout and player text live in ./faultMarker: only the lazy FaultMarker chunk reads them there.

export const FAULTS = {
  intervalS: [90, 180], windowS: 8, firstAfterS: 180,   // next fault drawn from this range (s); a fault stays this long (s); the first waits this many eligible seconds
  maxStepS: 0.25,                                       // frame clamp for the live clock: GameSession.stepFaults only (the pure step never clamps, so the greedy sims stay exact)
  seed: 27, catchSeedMul: 7919, catchSeedAdd: 13,       // greedy sims only: fault rng seed and catch rng seed (audit harness parity)
} as const;
