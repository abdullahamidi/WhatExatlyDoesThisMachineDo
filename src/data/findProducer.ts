// WP28b (r1-FX1): the Find producers' action data, read by the Director only (LivingWorldDirector.findProducer). Split from findWorld.ts so the
// Director chunk does not load the marker's layout, which the WorldReach chunk owns. Pure data. The marker's side (maxLeadMs, the era gate, the
// chladni and lift numbers) stays in findWorld.ts as FIND_PRODUCER.
// leadMs: the producer's action starts this long before its item shows (0-500 ms); the Director runs the action and returns the lead, and the
// marker waits at most FIND_PRODUCER.maxLeadMs for it. splice: the Splice whose own art the action twitches. dig / caw: the one-clip frames of
// the dog's dig and the crow's caw (the dig clip is 500 ms). digReachPx: the dog digs only while its feet x is this close to the spot's x (a
// dig out of reach is not drawn; WP28b F32: 24 px, the dig reads as the dog digging at its item).
// standIn (WP28b r2-FX3): the coin return's spot shows only with the payphone woken (FIND_SPOTS), so until its own Splice is bought the payphone's
// sway runs for it (the Director reads the id; the sway is the payphone's own answer).
import type { TechId } from './types';
import type { FindProducer } from './findWorld';

interface FindFrames { readonly frames: readonly string[]; readonly frameMs: readonly number[] }

export const FIND_PRODUCER_ACT: {
  readonly leadMs: Readonly<Record<FindProducer, number>>;
  readonly splice: Readonly<Partial<Record<FindProducer, TechId>>>;
  readonly standIn: Readonly<Partial<Record<FindProducer, TechId>>>;
  readonly dig: FindFrames;
  readonly caw: FindFrames;
  readonly digReachPx: number;
} = {
  leadMs: { dog: 400, crow: 500, gust: 0, ground: 0, organ: 300, radio: 300, coinReturn: 300, puddle: 300, vent: 500, pump: 300, chladni: 0, lift: 0 },
  splice: { organ: 'spliceOrgan', radio: 'spliceRadio', coinReturn: 'spliceCoinReturn', pump: 'splicePump' },
  standIn: { coinReturn: 'splicePayphone' },
  dig: { frames: ['dig0', 'dig1', 'dig0', 'dig1'], frameMs: [125, 125, 125, 125] },
  caw: { frames: ['perchTalk'], frameMs: [500] },
  digReachPx: 24,
};
