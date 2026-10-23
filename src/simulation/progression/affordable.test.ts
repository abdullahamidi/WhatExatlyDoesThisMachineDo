import { describe, it, expect } from 'vitest';
import { affordableTechIds } from './affordable';
import { getAllTechViews } from './status';
import { createInitialState } from '../state';
import { TECHNOLOGIES } from '../../data/technologies';
import type { GameState, ResourceMap, TechId } from '../../data/types';

/** Fresh state with the given tech levels and stocks; lifetime starts at the same amounts as stock. */
function stateOf(levels: Partial<Record<TechId, number>>, res: Partial<ResourceMap> = {}): GameState {
  const base = createInitialState(0);
  return {
    ...base,
    techLevels: { ...base.techLevels, ...levels },
    res: { ...base.res, ...res },
    lifetime: { ...base.lifetime, ...res },
  };
}

/** The reference: the affordable ids the full view model reports. */
function viewIds(state: GameState): TechId[] {
  return getAllTechViews(state).filter((v) => v.affordable).map((v) => v.id);
}

const FIXTURES: GameState[] = [
  stateOf({}),
  stateOf({}, { me: 15 }),
  stateOf({ handCrank: 1 }, { me: 1e6 }),
  stateOf(
    { pistonArray: 1, flywheel: 1, generatorBlueprint: 1, generator: 1 },
    { me: 1e12, ee: 1e9 },
  ),
  // gearRatio is maxed; flywheel is owned but its requirements are not, so it stays buyable.
  stateOf({ gearRatio: 15, flywheel: 1 }, { me: 1e12 }),
];

describe('affordableTechIds', () => {
  it('equals the getAllTechViews affordable filter, in the same order, on every fixture', () => {
    for (const state of FIXTURES) {
      expect(affordableTechIds(state)).toEqual(viewIds(state));
    }
  });

  it('is empty on a fresh state', () => {
    expect(affordableTechIds(stateOf({}))).toEqual([]);
  });

  it('includes gearRatio at exactly 15 ME', () => {
    expect(affordableTechIds(stateOf({}, { me: 15 }))).toContain('gearRatio');
  });

  it('never lists starting or milestone techs', () => {
    const ids = affordableTechIds(stateOf({ handCrank: 1 }, { me: 1e12, ee: 1e12, pr: 1e12, rs: 1e12, xf: 1e12 }));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain('handCrank');
    expect(ids).not.toContain('generatorBlueprint');
  });

  it('skips a maxed repeatable and keeps an owned one buyable without its requirements', () => {
    const ids = affordableTechIds(stateOf({ gearRatio: 15, flywheel: 1 }, { me: 1e12 }));
    expect(ids).not.toContain('gearRatio');
    expect(ids).toContain('flywheel');
  });

  it('honours an injected tech table', () => {
    const techs = { ...TECHNOLOGIES, gearRatio: { ...TECHNOLOGIES.gearRatio, baseCost: 1e9 } };
    expect(affordableTechIds(stateOf({}, { me: 15 }), techs)).not.toContain('gearRatio');
  });
});

describe('affordableTechIds with an era cap', () => {
  const capFixtures: GameState[] = [
    stateOf({}),
    stateOf(
      { handCrank: 1, gearRatio: 15, wornMotor: 1, motorTuning: 5, pistonArray: 1, generatorBlueprint: 1, generator: 1, powerLines: 1, sparkGap: 1 },
      { me: 1e12, ee: 1e9 },
    ),
    stateOf({ substationBlueprint: 1 }, { ee: 1e12 }),
  ];

  it('equals the affordable views under the cap on every fixture', () => {
    for (const state of capFixtures) {
      const expected = getAllTechViews(state, TECHNOLOGIES, 2).filter((v) => v.affordable).map((v) => v.id);
      expect(affordableTechIds(state, TECHNOLOGIES, 2)).toEqual(expected);
    }
  });

  it('drops an era-III tech that the full game can buy', () => {
    const state = stateOf({ substationBlueprint: 1 }, { ee: 1e12 });
    expect(affordableTechIds(state)).toContain('boiler');
    expect(affordableTechIds(state, TECHNOLOGIES, 2)).not.toContain('boiler');
    expect(affordableTechIds(state, TECHNOLOGIES, null)).toContain('boiler');
  });
});
