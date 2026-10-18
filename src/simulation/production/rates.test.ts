import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../../data/types';
import type { Effect, GameState, TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCES } from '../../data/resources';
import { createInitialState } from '../state';
import { computeRates } from './rates';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Injected tech table: every tech keeps its era-I definition except the ids overridden here.
const withEffects = (overrides: Partial<Record<TechId, Effect[]>>): Record<TechId, TechDefinition> => {
  const out: Record<TechId, TechDefinition> = { ...TECHNOLOGIES };
  for (const id of TECH_IDS) {
    const effects = overrides[id];
    if (effects) out[id] = { ...TECHNOLOGIES[id], effects };
  }
  return out;
};

describe('computeRates', () => {
  it('initial state: 1 per click from Hand Crank, nothing automated', () => {
    const r = computeRates(createInitialState(0));
    expect(r.perClick.me).toBeCloseTo(1, 9);
    expect(r.perSecond.me).toBeCloseTo(0, 9);
  });

  it('manual additive techs stack with Hand Crank', () => {
    expect(computeRates(withLevels({ gearRatio: 3 })).perClick.me).toBeCloseTo(4, 9);
  });

  it('Reinforced Crank doubles manual production', () => {
    expect(computeRates(withLevels({ gearRatio: 3, reinforcedCrank: 1 })).perClick.me).toBeCloseTo(8, 9);
  });

  it('automation additive techs', () => {
    expect(computeRates(withLevels({ wornMotor: 1, motorTuning: 5 })).perSecond.me).toBeCloseTo(6, 9);
  });

  it('automation accumulates across Piston Array and Improved Pistons', () => {
    const base = { wornMotor: 1, motorTuning: 5 } as const;
    expect(computeRates(withLevels({ ...base, pistonArray: 1 })).perSecond.me).toBeCloseTo(11, 9);
    expect(computeRates(withLevels({ ...base, pistonArray: 1, improvedPistons: 2 })).perSecond.me).toBeCloseTo(
      15,
      9,
    );
    expect(
      computeRates(withLevels({ ...base, pistonArray: 1, improvedPistons: 2, flywheel: 2 })).perSecond.me,
    ).toBeCloseTo(18, 9);
  });

  it('Flywheel alone does nothing without an automation source', () => {
    expect(computeRates(withLevels({ flywheel: 1 })).perSecond.me).toBeCloseTo(0, 9);
  });

  it('Flywheel multiplies automation by 1 + 10%', () => {
    expect(computeRates(withLevels({ flywheel: 1, wornMotor: 1 })).perSecond.me).toBeCloseTo(1.1, 9);
  });

  it('Reinforced Crank alone doubles Hand Crank', () => {
    expect(computeRates(withLevels({ reinforcedCrank: 1 })).perClick.me).toBeCloseTo(2, 9);
  });

  it('Flywheel does not change perClick', () => {
    const plain = computeRates(withLevels({ wornMotor: 1 }));
    const withFly = computeRates(withLevels({ wornMotor: 1, flywheel: 2 }));
    expect(withFly.perClick.me).toBeCloseTo(plain.perClick.me, 9);
  });

  it('era-I states leave every non-ME resource at exactly 0', () => {
    const r = computeRates(withLevels({ wornMotor: 1, motorTuning: 5, flywheel: 2, reinforcedCrank: 1 }));
    for (const id of ['ee', 'pr', 'rs', 'xf'] as const) {
      expect(r.perClick[id]).toBe(0);
      expect(r.perSecond[id]).toBe(0);
    }
  });

  it('uses a custom technology table when provided', () => {
    const techs = {
      ...TECHNOLOGIES,
      handCrank: { ...TECHNOLOGIES.handCrank, effects: [{ type: 'clickAdd' as const, amount: 5 }] },
    };
    expect(computeRates(createInitialState(0), techs).perClick.me).toBeCloseTo(5, 9);
  });

  it('autoAdd with res ee adds only to ee', () => {
    const techs = withEffects({ wornMotor: [{ type: 'autoAdd', amount: 3, res: 'ee' }] });
    const r = computeRates(withLevels({ wornMotor: 2 }), techs);
    expect(r.perSecond.ee).toBeCloseTo(6, 9);
    expect(r.perSecond.me).toBeCloseTo(0, 9);
  });

  it('autoAdd without res goes to me', () => {
    const techs = withEffects({ wornMotor: [{ type: 'autoAdd', amount: 3 }] });
    const r = computeRates(withLevels({ wornMotor: 1 }), techs);
    expect(r.perSecond.me).toBeCloseTo(3, 9);
    expect(r.perSecond.ee).toBeCloseTo(0, 9);
  });

  it('autoPct with res ee only scales ee', () => {
    const techs = withEffects({
      wornMotor: [
        { type: 'autoAdd', amount: 4 },
        { type: 'autoAdd', amount: 4, res: 'ee' },
        { type: 'autoPct', percent: 50, res: 'ee' },
      ],
    });
    const r = computeRates(withLevels({ wornMotor: 1 }), techs);
    expect(r.perSecond.me).toBeCloseTo(4, 9);
    expect(r.perSecond.ee).toBeCloseTo(6, 9);
  });

  it('rateMult for one resource only multiplies that resource', () => {
    const techs = withEffects({
      wornMotor: [
        { type: 'autoAdd', amount: 4 },
        { type: 'autoAdd', amount: 4, res: 'ee' },
        { type: 'rateMult', factor: 2, res: 'ee' },
      ],
    });
    const r = computeRates(withLevels({ wornMotor: 1 }), techs);
    expect(r.perSecond.me).toBeCloseTo(4, 9);
    expect(r.perSecond.ee).toBeCloseTo(8, 9);
  });

  it('rateMult all multiplies every resource', () => {
    const techs = withEffects({
      wornMotor: [
        { type: 'autoAdd', amount: 4 },
        { type: 'convert', amount: 0.5, res: 'ee' },
        { type: 'rateMult', factor: 4, res: 'all' },
      ],
    });
    const r = computeRates(withLevels({ wornMotor: 1 }), techs);
    expect(r.perSecond.me).toBeCloseTo(16, 9);
    expect(r.perSecond.ee).toBeCloseTo(8, 9);
  });

  it('convert feeds ee from me as 0.5 * sqrt(me)', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [{ type: 'convert', amount: 0.5, res: 'ee' }],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1 }), techs);
    expect(r.perSecond.ee).toBeCloseTo(1, 9);
  });

  it('convert with rateMult ee x2 gives 2', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [{ type: 'convert', amount: 0.5, res: 'ee' }],
      reinforcedCrank: [{ type: 'rateMult', factor: 2, res: 'ee' }],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1, reinforcedCrank: 1 }), techs);
    expect(r.perSecond.ee).toBeCloseTo(2, 9);
  });

  it('convert with autoPct ee 50 gives 1.5', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [{ type: 'convert', amount: 0.5, res: 'ee' }],
      flywheel: [{ type: 'autoPct', percent: 50, res: 'ee' }],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1, flywheel: 1 }), techs);
    expect(r.perSecond.ee).toBeCloseTo(1.5, 9);
  });

  it('convert chain: me -> ee -> pr', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 16 }],
      gearRatio: [{ type: 'convert', amount: 0.5, res: 'ee' }],
      pistonArray: [{ type: 'convert', amount: 1, res: 'pr' }],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1, pistonArray: 1 }), techs);
    expect(r.perSecond.ee).toBeCloseTo(2, 9);
    expect(r.perSecond.pr).toBeCloseTo(Math.sqrt(2), 9);
  });

  it('convert with a zero source gives 0', () => {
    const techs = withEffects({ gearRatio: [{ type: 'convert', amount: 0.5, res: 'ee' }] });
    const r = computeRates(withLevels({ gearRatio: 1 }), techs);
    expect(r.perSecond.ee).toBe(0);
  });

  it('clickEcho ee 2 s echoes ee per second into perClick.ee', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [
        { type: 'convert', amount: 0.5, res: 'ee' },
        { type: 'clickEcho', seconds: 2, res: 'ee' },
      ],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1 }), techs);
    expect(r.perSecond.ee).toBeCloseTo(1, 9);
    expect(r.perClick.ee).toBeCloseTo(2, 9);
    expect(r.perClick.me).toBeCloseTo(1, 9);
  });

  it('clickMult is not applied to clickEcho', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [
        { type: 'convert', amount: 0.5, res: 'ee' },
        { type: 'clickEcho', seconds: 2, res: 'ee' },
      ],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1, reinforcedCrank: 1 }), techs);
    expect(r.perClick.me).toBeCloseTo(2, 9);
    expect(r.perClick.ee).toBeCloseTo(2, 9);
  });

  it('clickEcho scales with tech level', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [
        { type: 'convert', amount: 0.5, res: 'ee' },
        { type: 'clickEcho', seconds: 2, res: 'ee' },
      ],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 2 }), techs);
    expect(r.perSecond.ee).toBeCloseTo(2, 9);
    expect(r.perClick.ee).toBeCloseTo(8, 9);
  });

  it('clickEcho on me is ignored', () => {
    const techs = withEffects({ gearRatio: [{ type: 'clickEcho', seconds: 2, res: 'me' }] });
    const r = computeRates(withLevels({ gearRatio: 1 }), techs);
    expect(r.perClick.me).toBeCloseTo(1, 9);
  });

  it('none effects are ignored', () => {
    const r = computeRates(withLevels({ generatorBlueprint: 1 }));
    expect(r.perClick.me).toBeCloseTo(1, 9);
    expect(r.perSecond.me).toBeCloseTo(0, 9);
  });

  it('techs at level 0 are ignored', () => {
    const techs = withEffects({ wornMotor: [{ type: 'autoAdd', amount: 4, res: 'ee' }] });
    const r = computeRates(withLevels({ wornMotor: 0 }), techs);
    expect(r.perSecond.ee).toBe(0);
  });

  it('custom resource table is honoured (convExp 1)', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [{ type: 'convert', amount: 0.5, res: 'ee' }],
    });
    const resources = { ...RESOURCES, ee: { ...RESOURCES.ee, convExp: 1 } };
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1 }), techs, resources);
    expect(r.perSecond.ee).toBeCloseTo(2, 9);
  });
});
