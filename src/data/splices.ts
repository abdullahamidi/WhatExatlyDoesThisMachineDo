import type { Effect, Requirement, ResourceId, TechDefinition, TechId } from './types';

// WP28 Splices: one-time unlocks that wire the machine to a dead world object. Pure data: no logic lives in this file.
// Each Splice needs its era keystone and a lifetime amount of the era's energy. The Coin Return also needs the Payphone.
// They live here (not in technologies.ts) and reach TECHNOLOGIES through one spread.

export type SpliceId = Extract<TechId, `splice${string}`>;

type Era = 1 | 2 | 3 | 4 | 5;

// Era keystone: the tech a Splice of this era requires (era I's is always owned).
const KEYSTONE: Record<Era, TechId> = { 1: 'handCrank', 2: 'generator', 3: 'boiler', 4: 'resonatorSpire', 5: 'nullChamber' };
// Era energy: the lifetime requirement of a Splice of this era is read in this resource.
const ENERGY: Record<Era, ResourceId> = { 1: 'me', 2: 'ee', 3: 'pr', 4: 'rs', 5: 'xf' };

// Positional builder: one call per Splice, in table order. No flavor text; the tree hint is never laid out.
function splice(
  id: SpliceId,
  name: string,
  era: Era,
  costRes: ResourceId,
  cost: number,
  effects: Effect[],
  lifetimeAmount: number,
  description: string,
  extraRequires: Requirement[] = [],
): TechDefinition {
  return {
    id,
    name,
    kind: 'unlock',
    branch: 'splice',
    era,
    costRes,
    baseCost: cost,
    growth: null,
    maxLevel: null,
    effects,
    requires: [
      { type: 'tech', id: KEYSTONE[era], minLevel: 1 },
      { type: 'lifetime', res: ENERGY[era], amount: lifetimeAmount },
      ...extraRequires,
    ],
    description,
    tree: { col: 0, row: 0 },
  };
}

// The 16 Splices, in TECH_IDS order (the harness tie order).
export const SPLICE_TECHS: Record<SpliceId, TechDefinition> = {
  spliceBicycle: splice('spliceBicycle', 'Bicycle', 1, 'me', 900, [{ type: 'autoPct', percent: 5, res: 'me' }], 15000,
    'A line to the bicycle. The back wheel turns backwards. +5% automation.'),
  spliceOrgan: splice('spliceOrgan', 'Barrel Organ', 1, 'me', 12000, [{ type: 'findSeconds', seconds: 1 }], 120000,
    'A line to the barrel organ. It plays three notes short. Finds pay +1s.'),
  spliceClock: splice('spliceClock', 'Street Clock', 1, 'me', 10000, [{ type: 'autoPct', percent: 5, res: 'me' }], 450000,
    'A line to the street clock. Its hand ticks once. +5% automation.'),
  spliceRadio: splice('spliceRadio', 'Radio', 2, 'me', 270000, [{ type: 'autoPct', percent: 5, res: 'ee' }], 200000,
    'A line to a valve radio. It finds a station. +5% EE production.'),
  splicePayphone: splice('splicePayphone', 'Payphone', 2, 'ee', 130000, [{ type: 'faultWindow', seconds: 2 }], 2000000,
    'A line to the payphone. It rings with no one on it. Faults last +2s.'),
  spliceSign: splice('spliceSign', 'Bulb Sign', 2, 'me', 2300000, [{ type: 'autoPct', percent: 5, res: 'ee' }], 3000000,
    'A line to a bulb sign. Half its bulbs buzz. +5% EE production.'),
  splicePump: splice('splicePump', 'Hand Pump', 3, 'ee', 250000, [{ type: 'autoPct', percent: 5, res: 'pr' }], 100000,
    'A line to the hand pump. The handle works itself. +5% PR production.'),
  spliceWhistle: splice('spliceWhistle', 'Factory Whistle', 3, 'me', 6500000, [{ type: 'findRate', factor: 0.85 }], 2500000,
    'The factory whistle blows at the wrong hour. Finds come 15% sooner.'),
  spliceHydrant: splice('spliceHydrant', 'Hydrant', 3, 'ee', 650000, [{ type: 'autoPct', percent: 5, res: 'pr' }], 9000000,
    'A line to the hydrant. The cap rattles. +5% PR production.'),
  spliceBell: splice('spliceBell', 'Bell', 4, 'pr', 630000, [{ type: 'autoPct', percent: 5, res: 'rs' }], 2000000,
    'A line to the bell. It swings, never all the way. +5% RS production.'),
  spliceGramophone: splice('spliceGramophone', 'Gramophone', 4, 'me', 12000000, [{ type: 'windup', seconds: 0.1, refill: 0.01 }], 12000000,
    'The gramophone needle skips. +0.1s wind-up, +0.01s/s refill.'),
  spliceChimes: splice('spliceChimes', 'Wind Chimes', 4, 'pr', 1400000, [{ type: 'faultSeconds', seconds: 2 }], 32000000,
    'A line to the chimes. They ring with no wind. Cleared faults pay +2s.'),
  spliceVane: splice('spliceVane', 'Weathervane', 5, 'rs', 2100000, [{ type: 'autoPct', percent: 5, res: 'xf' }], 1000000,
    'A line to the weathervane. It stops pointing down. +5% ??? production.'),
  spliceKite: splice('spliceKite', 'Kite', 5, 'me', 15000000, [{ type: 'findSeconds', seconds: 1 }], 8000000,
    'A line to the kite on the lamp. It rises with no wind. Finds pay +1s.'),
  spliceCairn: splice('spliceCairn', 'Cairn', 5, 'ee', 9500000, [{ type: 'autoPct', percent: 5, res: 'xf' }], 23000000,
    'A line to a cairn. The stones lift, one by one. +5% ??? production.'),
  spliceCoinReturn: splice('spliceCoinReturn', 'Coin Return', 5, 'me', 64000000, [{ type: 'autoPct', percent: 5, res: 'xf' }], 130000000,
    'A second line to the payphone. The return rattles. +5% ??? production.',
    [{ type: 'tech', id: 'splicePayphone', minLevel: 1 }]),
};
