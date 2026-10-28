import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { createInitialState } from '../state';
import { costAt, canAfford } from './cost';

const { gearRatio, motorTuning, flywheel, improvedPistons, wornMotor, pistonArray, handCrank } = TECHNOLOGIES;

describe('costAt', () => {
  it('gearRatio grows geometrically with rounding up', () => {
    expect([0, 1, 2, 3].map((l) => costAt(gearRatio, l))).toEqual([15, 20, 26, 33]);
  });

  it('motorTuning costs', () => {
    expect(costAt(motorTuning, 0)).toBe(60);
    expect(costAt(motorTuning, 1)).toBe(78);
  });

  it('flywheel costs', () => {
    expect(costAt(flywheel, 0)).toBe(4000);
    expect(costAt(flywheel, 1)).toBe(5400);
  });

  it('improvedPistons costs', () => {
    expect(costAt(improvedPistons, 0)).toBe(3000);
    expect(costAt(improvedPistons, 1)).toBe(3900);
  });

  it('unlock costs ignore the level', () => {
    expect(costAt(wornMotor, 0)).toBe(40);
    expect(costAt(pistonArray, 0)).toBe(3000);
    expect(costAt(wornMotor, 1)).toBe(40);
  });

  it('starting tech is free', () => {
    expect(costAt(handCrank, 0)).toBe(0);
  });

  it('repeatable costs are integers and non-decreasing for levels 0..24', () => {
    for (const id of TECH_IDS) {
      const def = TECHNOLOGIES[id];
      if (def.kind !== 'repeatable') continue;
      let prev = -Infinity;
      for (let level = 0; level <= 24; level++) {
        const cost = costAt(def, level);
        expect(Number.isInteger(cost)).toBe(true);
        expect(cost).toBeGreaterThanOrEqual(prev);
        prev = cost;
      }
    }
  });
});

const withRes = (res: Partial<Record<'me' | 'ee', number>>) => {
  const s = createInitialState(0);
  return { ...s, res: { ...s.res, ...res } };
};

describe('canAfford', () => {
  it('is true when me equals cost', () => {
    expect(canAfford(withRes({ me: 10 }), 'me', 10)).toBe(true);
  });

  it('is false when me is just below cost', () => {
    expect(canAfford(withRes({ me: 9.999 }), 'me', 10)).toBe(false);
  });

  it('is true for a zero cost with zero ME', () => {
    expect(canAfford(withRes({ me: 0 }), 'me', 0)).toBe(true);
  });

  it('reads only the requested resource', () => {
    const s = withRes({ me: 1e9, ee: 0 });
    expect(canAfford(s, 'ee', 1)).toBe(false);
    expect(canAfford(s, 'ee', 0)).toBe(true);
    expect(canAfford(s, 'me', 1)).toBe(true);
  });
});
