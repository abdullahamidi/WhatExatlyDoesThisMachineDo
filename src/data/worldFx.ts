// WP28b (D6 b, c; r1-FX1): the world props' reach effects, read by the Director chunk only (WorldProps and its maths in
// src/game/math/worldFx.ts). Split from data/worldReach.ts so the WorldReach chunk does not load them. Art px unless a name says world px.
// The lamp wobble is a brightness offset of maxAmp x L, sampled every stepMs (a render cadence: the glow moves in 1/255 steps anyway).
// Era I pebbles: pebbleCount(L) in all, from 2 (the two WORLD_ENV booth pebbles) to maxCount; the extra pebbles stand on the machine's feet
// at feetArtPx (x from the machine anchor, art px; one per extra, so feetArtPx.length = maxCount - the booth count), each hopping 1-2 art px
// at hopHz. The hum (era IV loose objects: lamp, booth, clock) jitters 1 px above startLevel and 2 px above strongLevel. Puddle rings ripple
// every everyMs in era IV (gaps drawn from a hash of seed).
export const WORLD_FX = {
  lampWobble: { maxAmp: 0.12, hz: 1.3, stepMs: 100 },
  pebbles: { era: 1, minCount: 2, maxCount: 6, hopPx: [1, 2], hopHz: 2, minLevel: 0.1, feetArtPx: [150, -140, 340, -334] },
  hum: { era: 4, startLevel: 0.3, strongLevel: 0.85, hz: [2, 4], stepPx: [1, 2] },
  puddleRing: { era: 4, everyMs: [4000, 8000], minLevel: 0.2, seed: 11 },
} as const;
