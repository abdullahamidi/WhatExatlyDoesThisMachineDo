import { describe, it, expect } from 'vitest';
import type { GameState, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { createInitialState } from '../state';
import { computeRates } from './rates';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

describe('computeRates', () => {
  it('initial state: 1 per click from Hand Crank, nothing automated', () => {
    const r = computeRates(createInitialState(0));
    expect(r.perClick).toBeCloseTo(1, 9);
    expect(r.perSecond).toBeCloseTo(0, 9);
  });

  it('manual additive techs stack with Hand Crank', () => {
    expect(computeRates(withLevels({ gearRatio: 3 })).perClick).toBeCloseTo(4, 9);
  });

  it('Reinforced Crank doubles manual production', () => {
    expect(computeRates(withLevels({ gearRatio: 3, reinforcedCrank: 1 })).perClick).toBeCloseTo(8, 9);
  });

  it('automation additive techs', () => {
    expect(computeRates(withLevels({ wornMotor: 1, motorTuning: 5 })).perSecond).toBeCloseTo(6, 9);
  });

  it('automation accumulates across Piston Array and Improved Pistons', () => {
    const base = { wornMotor: 1, motorTuning: 5 } as const;
    expect(computeRates(withLevels({ ...base, pistonArray: 1 })).perSecond).toBeCloseTo(11, 9);
    expect(computeRates(withLevels({ ...base, pistonArray: 1, improvedPistons: 2 })).perSecond).toBeCloseTo(15, 9);
    expect(
      computeRates(withLevels({ ...base, pistonArray: 1, improvedPistons: 2, flywheel: 2 })).perSecond,
    ).toBeCloseTo(18, 9);
  });

  it('Flywheel alone does nothing without an automation source', () => {
    expect(computeRates(withLevels({ flywheel: 1 })).perSecond).toBeCloseTo(0, 9);
  });

  it('Flywheel multiplies automation by 1 + 10%', () => {
    expect(computeRates(withLevels({ flywheel: 1, wornMotor: 1 })).perSecond).toBeCloseTo(1.1, 9);
  });

  it('Reinforced Crank alone doubles Hand Crank', () => {
    expect(computeRates(withLevels({ reinforcedCrank: 1 })).perClick).toBeCloseTo(2, 9);
  });

  it('Flywheel does not change perClick', () => {
    const plain = computeRates(withLevels({ wornMotor: 1 }));
    const withFly = computeRates(withLevels({ wornMotor: 1, flywheel: 2 }));
    expect(withFly.perClick).toBeCloseTo(plain.perClick, 9);
  });

  it('uses a custom technology table when provided', () => {
    const techs = {
      ...TECHNOLOGIES,
      handCrank: { ...TECHNOLOGIES.handCrank, effects: [{ type: 'clickAdd' as const, amount: 5 }] },
    };
    expect(computeRates(createInitialState(0), techs).perClick).toBeCloseTo(5, 9);
  });
});
