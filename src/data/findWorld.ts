import type { EraNumber } from './eras';
import type { FramingKey } from './livingWorld';
import type { TechId } from './types';
import { DEPTH } from './world';
import { PALETTE } from './palette';
import { YARD_DEPTH_STEP } from './worldShared';

// WP28a Finds, marker data (AD1 hand-off e and g, WP28 Finds rendering): the sheet map, the layout, the era colours, the
// spots of each framing and the marker's player-facing text. Own module, so Vite bundles it in the lazy reach chunks.
// Import it ONLY from src/game/math/findMarker.ts, src/game/rendering/FindMarker.ts, PokeLayer.ts, WorldReach.ts and tests. The Director
// reads the producers' action data from ./findProducer.ts and the type from here (WP28b, r1-FX1: the Director chunk stays off this module).
// The clock numbers stay in ./finds, the relic notes too. Positions are world px unless the name says art px (PIXEL_SCALE 2).
// The poke layer's layout and the Splice wake line (POKE_LAYOUT, REACH_TEXT) live here too: only the reach chunk reads them.

/**
 * Who a Find sits by (WP28b adds the Splice and era III-V producers): the dog digs, the crow drops it from its perch, the scraps flip, the bare
 * yard rises, the organ spits a cog, the radio drops a valve, the payphone coin return, a puddle rim rings, a vent puffs, a pump coughs, the
 * Chladni rings walk it to a node and a lift hangs it.
 */
export type FindProducer = 'dog' | 'crow' | 'gust' | 'ground' | 'organ' | 'radio' | 'coinReturn' | 'puddle' | 'vent' | 'pump' | 'chladni' | 'lift';

/** Every producer, in the order of the type (the tests read the list). */
export const FIND_PRODUCERS: readonly FindProducer[] = [
  'dog', 'crow', 'gust', 'ground', 'organ', 'radio', 'coinReturn', 'puddle', 'vent', 'pump', 'chladni', 'lift',
];

/** One Find spot of a framing: feet x in world px, the yard lane (feet at GROUND_Y + lane), its producer and, when set, the Splice that must be woken. */
export interface FindSpot { readonly x: number; readonly lane: number; readonly producer: FindProducer; readonly requires?: TechId }

// Sheet 'world.finds' (8 x 8 cells, one row): 0-6 items (picked by serial % 7), 7 the folded note (relic), 8-10 the glint.
export const FIND_ART = {
  sheet: 'world.finds',
  cellArtPx: 8,
  items: [0, 1, 2, 3, 4, 5, 6],
  relic: 7,
  glint: [8, 9, 10],
  glintPlay: [8, 9, 10, 9],   // ping-pong: one cycle per glint period
} as const;

// Marker layout and timings. Art px are scaled by PIXEL_SCALE; ms are wall-clock marker time (the marker's own clock).
export const FIND_LAYOUT = {
  hitMinScreenPx: 56,                  // the click zone is at least this many screen px whatever the zoom
  viewInsetWorldPx: 32,                // a spot counts as on screen only this far inside the camera view
  minCastDistPx: 24,                   // a spot is skipped while a cast member's feet are closer than this (world px)
  ringRadiusArtPx: { x: 6, y: 2 },     // the ground ring: an ellipse 12 x 4 art px around the item foot
  ringStrokeArtPx: 1,
  ringBreatheHz: 1,                    // the ring's alpha breathes at this rate (static under reduced motion)
  ringBreatheDepth: 0.2,               // the breath takes the alpha down by this much at its low point
  dustScale: 1.5,                      // dog: the one-frame dust puff is the ring at this scale
  puffMs: 16,                          // dog: the puff lasts one frame; the item shows after it
  glintHz: 2,                          // glint cycles per second (ping-pong, four frames); halved in the last fadeLastS
  glintOffsetArtPx: { x: 3, y: -6 },   // the glint centre sits on the item's upper-right corner
  dropBounceMs: 400,                   // crow: the item falls from the perch and bounces once in this time
  dropFallFraction: 0.7,               // the share of dropBounceMs spent falling (the rest is the bounce)
  dropBounceFraction: 0.12,            // the bounce height as a share of the fall
  risePx: 2,                           // ground: the item rises this far out of the dirt (world px)
  riseMs: 200,
  flipMs: 200,                         // gust: the scrap turns; the item shows at the edge-on half turn
  hopPx: 6,                            // collect: the item hops this high (world px)
  hopMs: 250,
  flashMs: 200,                        // collect: the glint flashes once, then fades
  fadeLastS: 5,                        // the last seconds of a Find: the glint slows and the ring fades
  expireFadeMs: 300,                   // an expired Find fades over this long, with no text
  blockOffsetWorldPx: { x: 0, y: -16 },  // the gain block rises from the item's top
  yardDepth: YARD_DEPTH_STEP,          // depth per yard lane px (the Splice objects' convention): the marker sits in its lane
  depthBase: DEPTH.machine + 3,        // the marker's depth is depthBase + yardDepth x lane (SpliceProps' yard convention)
  hudRefreshMs: 250,                   // the HUD buttons' box is read from the DOM at this cadence, and at once on a settings change
  ringRedrawHz: 15,                    // the ground ring is redrawn at most this often, and only when its colour or alpha step changed
  ringAlphaSteps: 40,                  // the ring's alpha is drawn in steps of 1 / ringAlphaSteps
} as const;

// Glint and ring colours per era (AD1 hand-off g). tintFill: the glint takes this exact fill in eras III-IV, else it draws as is.
export const FIND_COLORS: Readonly<Record<EraNumber, { readonly glint: number; readonly ring: number; readonly tintFill: number | null }>> = {
  1: { glint: 0xddc9a3, ring: 0xddc9a3, tintFill: null },
  2: { glint: 0xddc9a3, ring: 0xc98552, tintFill: null },
  3: { glint: 0xffd27a, ring: 0xf0a848, tintFill: 0xffd27a },
  4: { glint: 0xffd27a, ring: 0xf0a848, tintFill: 0xffd27a },
  5: { glint: 0xddc9a3, ring: 0x9a6ad0, tintFill: null },
};

// Find producers, the marker's side (WP28b, AD3 hand-off O-e). maxLeadMs: the marker waits at most this long for a producer's lead (the
// producers' action data, leadMs and the sprites, is in findProducer.ts: FIND_PRODUCER_ACT). era: a producer whose spots show only in that era
// (none = any). chladniNodePx: the nodal spacing, the radii step of WORLD_CHLADNI (120 px), counted from the machine's x; the item walks to the
// nearest node over chladniWalkMs. liftPx: the lift's range, five steps by serial, reached in liftMs; the bob is liftBobPx at liftBobHz.
export const FIND_PRODUCER: {
  readonly maxLeadMs: number;
  readonly era: Readonly<Partial<Record<FindProducer, EraNumber>>>;
  readonly chladniNodePx: number;
  readonly chladniWalkMs: number;
  readonly liftPx: readonly [number, number];
  readonly liftMs: number;
  readonly liftBobPx: number;
  readonly liftBobHz: number;
} = {
  maxLeadMs: 500,
  era: { puddle: 3, vent: 3, pump: 3, chladni: 4, lift: 5 },
  chladniNodePx: 120,
  chladniWalkMs: 1500,
  liftPx: [12, 16],
  liftMs: 600,
  liftBobPx: 1,
  liftBobHz: 0.5,
};

// Find spots per framing (AD1 hand-off e; WP28b O-e for s8-s15). Feet at GROUND_Y + lane. A framing without a key has no spot, so no Find shows there.
// A spot with requires shows only while that Splice is woken; the producer's era (FIND_PRODUCER.era) gates the rest (spotUsable).
// (AD2 R2 F21: the e1 / s9 gust items stand in front of the scrap at 1420, so the glint never sits on the scrap's cream.)
export const FIND_SPOTS: Partial<Record<FramingKey, readonly FindSpot[]>> = {
  e1: [{ x: 2476, lane: 26, producer: 'crow' }, { x: 2420, lane: 56, producer: 'dog' }, { x: 1420, lane: 30, producer: 'gust' }, { x: 1480, lane: 88, producer: 'ground' }],
  s8: [{ x: 2656, lane: 26, producer: 'crow' }, { x: 2596, lane: 60, producer: 'dog' }, { x: 1520, lane: 20, producer: 'gust' }, { x: 1452, lane: 100, producer: 'ground' },
    { x: 1504, lane: 60, producer: 'organ', requires: 'spliceOrgan' }],
  s8w: [{ x: 1520, lane: 74, producer: 'gust' }, { x: 1508, lane: 104, producer: 'ground' }, { x: 1556, lane: 30, producer: 'ground' },
    { x: 1548, lane: 76, producer: 'organ', requires: 'spliceOrgan' }],
  s9: [{ x: 2996, lane: 26, producer: 'crow' }, { x: 2866, lane: 72, producer: 'dog' }, { x: 1420, lane: 26, producer: 'gust' }, { x: 1480, lane: 140, producer: 'ground' }, { x: 2904, lane: 20, producer: 'dog' },
    { x: 1430, lane: 96, producer: 'organ', requires: 'spliceOrgan' }, { x: 1500, lane: 124, producer: 'radio', requires: 'spliceRadio' },
    { x: 3012, lane: 24, producer: 'coinReturn', requires: 'splicePayphone' }],
  s10: [{ x: 1250, lane: 88, producer: 'vent' }, { x: 1240, lane: 120, producer: 'ground' }],
  s11: [{ x: 926, lane: 20, producer: 'puddle' }, { x: 956, lane: 24, producer: 'pump', requires: 'splicePump' }, { x: 996, lane: 64, producer: 'vent' },
    { x: 2900, lane: 100, producer: 'vent' }, { x: 750, lane: 120, producer: 'organ', requires: 'spliceOrgan' }, { x: 850, lane: 120, producer: 'radio', requires: 'spliceRadio' },
    { x: 3088, lane: 20, producer: 'coinReturn', requires: 'splicePayphone' }, { x: 780, lane: 110, producer: 'chladni' }, { x: 3040, lane: 120, producer: 'chladni' },
    { x: 2930, lane: 84, producer: 'chladni' }, { x: 720, lane: 160, producer: 'lift' }, { x: 1000, lane: 120, producer: 'lift' }, { x: 3020, lane: 140, producer: 'lift' }],
  s15: [{ x: 790, lane: 90, producer: 'lift' }, { x: 812, lane: 40, producer: 'lift' }, { x: 1014, lane: 30, producer: 'lift' }, { x: 700, lane: 136, producer: 'lift' },
    { x: 980, lane: 130, producer: 'lift' }],
};

// The marker's player-facing text (WP28 Finds). {producer}, {item}, {s} and {text} are filled by the caller. Plain words,
// no "you", no exclamation marks; the machine never names its own function.
export const FIND_WORLD_TEXT = {
  a11yPrefix: 'WORLD',
  announceSpawn: 'Something glints near {producer}. Click it or press G.',
  announceCollect: 'Picked up {item}. +{s}s of output.',
  announceRelic: 'Field note: {text}',
  popupHeader: 'FOUND +{s}s',
  items: ['a bolt', 'a brass tag', 'a small gear', 'a dented tin', 'a key', 'a photo', 'a token'],
  relicItem: 'a folded note',
  producers: {
    dog: 'the dog', crow: 'the crow', gust: 'the scraps', ground: 'the yard', organ: 'the organ', radio: 'the radio', coinReturn: 'the payphone',
    puddle: 'the puddle', vent: 'the vent', pump: 'the pump', chladni: 'the rings', lift: 'the dust',
  },
} as const;

// WP28 poke layer (WorldReach chunk, C12): the pooled zones, the hover brackets and the Splice tooltip. Screen px unless marked art px.
export const POKE_LAYOUT = {
  zones: 24,                           // pooled poke zones (one container, screen space); AD4 F26: s13 / s15 show 18 targets
  hitMinScreenPx: 56,                  // a zone is at least this many screen px whatever the zoom
  bracketArmArtPx: 3,                  // hover corner brackets: arm length, stroke and the gap outside the target box (art px)
  bracketStrokeArtPx: 1,
  bracketOutsideArtPx: 2,
  bracketAlpha: 0.9,
  bracketPaper: 0xddc9a3,              // the world voice paper
  bracketViolet: PALETTE.violetLight,  // the brackets from era violetFromEra on
  violetFromEra: 5,
  flashColor: 0xffd27a,                // the ack flash frame (the crank pulse amber)
  tipGapPx: 8,                         // screen px between the object's box and the Splice tooltip
  tipRefreshMs: 250,                   // the tooltip's text and DOM geometry are read at this cadence
} as const;
/** WP28 Splice wake line (WorldReach chunk; the screen reader prefix is FIND_WORLD_TEXT.a11yPrefix). Plain words, US spelling. */
export const REACH_TEXT = { wakeAnnounce: 'Spliced: {name}. {effect}.' } as const;
