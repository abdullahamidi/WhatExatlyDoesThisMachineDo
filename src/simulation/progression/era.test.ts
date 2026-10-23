import { describe, it, expect } from 'vitest';
import type { TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { ERA_KEYSTONES } from '../../data/eras';
import { createInitialState } from '../state';
import { currentEra, eraResource } from './era';

const levelsWith = (levels: Partial<Record<TechId, number>>): Record<TechId, number> => {
  const base = createInitialState(0).techLevels;
  return { ...base, ...levels };
};

describe('currentEra', () => {
  it('is era I for the initial tech levels', () => {
    expect(currentEra(createInitialState(0).techLevels)).toBe(1);
  });

  it('is era II once the Generator is owned', () => {
    expect(currentEra(levelsWith({ generator: 1 }))).toBe(2);
  });

  it('is era III with the Boiler alone (no Generator needed)', () => {
    expect(currentEra(levelsWith({ boiler: 1 }))).toBe(3);
  });

  it('is era IV with the Resonator Spire', () => {
    expect(currentEra(levelsWith({ resonatorSpire: 1 }))).toBe(4);
  });

  it('is era V with the Null Chamber', () => {
    expect(currentEra(levelsWith({ nullChamber: 1 }))).toBe(5);
  });

  it('takes the highest owned keystone whatever the order', () => {
    expect(currentEra(levelsWith({ generator: 1, nullChamber: 1 }))).toBe(5);
    expect(currentEra(levelsWith({ boiler: 1, generator: 1 }))).toBe(3);
  });

  it('ignores a keystone at level 0', () => {
    expect(currentEra(levelsWith({ generator: 0 }))).toBe(1);
  });

  it('counts a NaN level as 0', () => {
    expect(currentEra(levelsWith({ nullChamber: NaN }))).toBe(1);
  });

  it('counts a non-finite level as 0', () => {
    expect(currentEra(levelsWith({ nullChamber: Infinity }))).toBe(1);
    expect(currentEra(levelsWith({ generator: -Infinity }))).toBe(1);
  });
});

describe('eraResource', () => {
  it('maps eras I..V to me, ee, pr, rs, xf', () => {
    expect(eraResource(1)).toBe('me');
    expect(eraResource(2)).toBe('ee');
    expect(eraResource(3)).toBe('pr');
    expect(eraResource(4)).toBe('rs');
    expect(eraResource(5)).toBe('xf');
  });
});

describe('ERA_KEYSTONES', () => {
  it.each(ERA_KEYSTONES)('$techId is an unlock of its era and converts that era resource', ({ techId, era }) => {
    const def = TECHNOLOGIES[techId];
    expect(def.kind).toBe('unlock');
    expect(def.era).toBe(era);
    expect(def.effects.some((e) => e.type === 'convert' && e.res === eraResource(era))).toBe(true);
  });
});
