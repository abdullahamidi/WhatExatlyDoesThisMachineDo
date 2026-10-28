import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../../data/types';
import type { Effect, GameState, TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCES } from '../../data/resources';
import { createInitialState } from '../state';
import { cycleTechs } from '../prestige';
import { autoClicksPerSecond, computeRates } from './rates';

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
    expect(computeRates(withLevels({ gearRatio: 3 })).perClick.me).toBeCloseTo(2.5, 9);
  });

  // WP27: Reinforced Crank no longer multiplies the click (it gives a crank echo, see 'crank echo (C2)').
  it('Reinforced Crank no longer multiplies manual production (3.75 -> 2.5 at Gear Ratio 3)', () => {
    expect(computeRates(withLevels({ gearRatio: 3, reinforcedCrank: 1 })).perClick.me).toBeCloseTo(2.5, 9);
  });

  // WP27: Worn Motor +17 -> +2 ME/s and Motor Tuning +3.3 -> +0.9 per level (data diff, plan F2hi).
  it('automation additive techs (Worn Motor 2 + Motor Tuning 0.9 per level: 6.5 ME/s, was 33.5)', () => {
    expect(computeRates(withLevels({ wornMotor: 1, motorTuning: 5 })).perSecond.me).toBeCloseTo(6.5, 9);
  });

  // WP27: + Piston Array 17 -> 60 and Improved Pistons 6.7 -> 10 per level (flywheel 2 = +20 %).
  it('automation accumulates across Piston Array and Improved Pistons (66.5, 86.5, 103.8)', () => {
    const base = { wornMotor: 1, motorTuning: 5 } as const;
    expect(computeRates(withLevels({ ...base, pistonArray: 1 })).perSecond.me).toBeCloseTo(66.5, 9);
    expect(computeRates(withLevels({ ...base, pistonArray: 1, improvedPistons: 2 })).perSecond.me).toBeCloseTo(
      86.5,
      9,
    );
    expect(
      computeRates(withLevels({ ...base, pistonArray: 1, improvedPistons: 2, flywheel: 2 })).perSecond.me,
    ).toBeCloseTo(103.8, 9);
  });

  it('Flywheel alone does nothing without an automation source', () => {
    expect(computeRates(withLevels({ flywheel: 1 })).perSecond.me).toBeCloseTo(0, 9);
  });

  it('Flywheel multiplies automation by 1 + 10% (Worn Motor 2 -> 2.2)', () => {
    expect(computeRates(withLevels({ flywheel: 1, wornMotor: 1 })).perSecond.me).toBeCloseTo(2.2, 9);
  });

  // WP27: no clickMult any more; with no automation the crank echo adds nothing (E x perSecondPre.me = 0).
  it('Reinforced Crank alone leaves Hand Crank at 1 (its echo needs automation)', () => {
    expect(computeRates(withLevels({ reinforcedCrank: 1 })).perClick.me).toBeCloseTo(1, 9);
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

  it('convert with a negative source gives 0, not NaN', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: -4 }],
      gearRatio: [{ type: 'convert', amount: 0.5, res: 'ee' }],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1 }), techs);
    expect(r.perSecond.me).toBeLessThan(0);
    expect(r.perSecond.ee).toBe(0);
    expect(Number.isNaN(r.perSecond.ee)).toBe(false);
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
    // Injected clickMult on Reinforced Crank (the real tech no longer has one): the echo must stay unscaled.
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
      gearRatio: [
        { type: 'convert', amount: 0.5, res: 'ee' },
        { type: 'clickEcho', seconds: 2, res: 'ee' },
      ],
      reinforcedCrank: [{ type: 'clickMult', factor: 1.5 }],
    });
    const r = computeRates(withLevels({ wornMotor: 1, gearRatio: 1, reinforcedCrank: 1 }), techs);
    expect(r.perClick.me).toBeCloseTo(1.5, 9);
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

  it('offlineHours gives no rate: computeRates equals the table without the effect', () => {
    const withBuffer = withEffects({
      gearRatio: [...TECHNOLOGIES.gearRatio.effects, { type: 'offlineHours', hours: 4 }],
      wornMotor: [{ type: 'autoAdd', amount: 4 }],
    });
    const withoutBuffer = withEffects({ wornMotor: [{ type: 'autoAdd', amount: 4 }] });
    const levels = withLevels({ wornMotor: 1, gearRatio: 3 });
    const a = computeRates(levels, withBuffer);
    const b = computeRates(levels, withoutBuffer);
    expect(a.perClick).toEqual(b.perClick);
    expect(a.perSecond).toEqual(b.perSecond);
  });

  it('none effects are ignored', () => {
    const r = computeRates(withLevels({ generatorBlueprint: 1 }));
    expect(r.perClick.me).toBeCloseTo(1, 9);
    expect(r.perSecond.me).toBeCloseTo(0, 9);
  });

  it('ending marker contributes nothing to perClick or perSecond', () => {
    const withEnding = withEffects({ gearRatio: [{ type: 'ending' }] });
    const withoutEnding = withEffects({ gearRatio: [] });
    const levels = withLevels({ gearRatio: 3 });
    const a = computeRates(levels, withEnding);
    const b = computeRates(levels, withoutEnding);
    expect(a.perClick).toEqual(b.perClick);
    expect(a.perSecond).toEqual(b.perSecond);
  });

  it('ending marker leaves the rates result shape unchanged (no offline cap field: perClick and perSecond only)', () => {
    const r = computeRates(withLevels({ gearRatio: 3 }), withEffects({ gearRatio: [{ type: 'ending' }] }));
    expect(Object.keys(r).sort()).toEqual(['perClick', 'perSecond']);
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

describe('autoClick fold', () => {
  // Injected table: gearRatio grants 2 automatic cranks/s per level; the rest is era I.
  const autoTechs = withEffects({ gearRatio: [{ type: 'autoClick', perSecond: 2 }] });

  it('adds perSecond x level x perClick to me; perClick stays manual-only', () => {
    const r = computeRates(withLevels({ gearRatio: 3 }), autoTechs);
    expect(r.perClick.me).toBeCloseTo(1, 9);
    expect(r.perSecond.me).toBeCloseTo(6, 9);
  });

  it('repeatable levels multiply the auto-cranks', () => {
    expect(computeRates(withLevels({ gearRatio: 5 }), autoTechs).perSecond.me).toBeCloseTo(10, 9);
  });

  it('level 0 is ignored', () => {
    expect(computeRates(withLevels({ gearRatio: 0 }), autoTechs).perSecond.me).toBe(0);
  });

  // Injected table with an ee economy: wornMotor autoAdd 10 ee, echo 3 s of ee, convert 1 pr.
  const eeAutoTechs = withEffects({
    gearRatio: [{ type: 'autoClick', perSecond: 2 }],
    wornMotor: [
      { type: 'autoAdd', amount: 10, res: 'ee' },
      { type: 'clickEcho', seconds: 3, res: 'ee' },
      { type: 'convert', amount: 1, res: 'pr' },
    ],
  });
  const eeAutoLevels = withLevels({ gearRatio: 3, wornMotor: 1 });

  it('folds auto-cranks after perClick: ee gains 6 x perClick.ee', () => {
    const r = computeRates(eeAutoLevels, eeAutoTechs);
    expect(r.perClick.ee).toBeCloseTo(30, 9);
    expect(r.perSecond.ee).toBeCloseTo(10 + 6 * 30, 9);
    expect(r.perSecond.me).toBeCloseTo(6, 9);
  });

  it('conversion uses the pre-fold ee rate (sqrt(10), not sqrt(190))', () => {
    const r = computeRates(eeAutoLevels, eeAutoTechs);
    expect(r.perSecond.pr).toBeCloseTo(Math.sqrt(10), 9);
    expect(r.perClick.pr).toBe(0);
  });

  it('perClick equals the table without the autoClick effect', () => {
    const noAuto = withEffects({
      gearRatio: [],
      wornMotor: [
        { type: 'autoAdd', amount: 10, res: 'ee' },
        { type: 'clickEcho', seconds: 3, res: 'ee' },
        { type: 'convert', amount: 1, res: 'pr' },
      ],
    });
    expect(computeRates(eeAutoLevels, eeAutoTechs).perClick).toEqual(
      computeRates(eeAutoLevels, noAuto).perClick,
    );
  });
});

describe('autoClicksPerSecond', () => {
  // Injected table: gearRatio grants 2 automatic cranks/s per level.
  const autoTechs = withEffects({ gearRatio: [{ type: 'autoClick', perSecond: 2 }] });

  it('is 0 for the initial tech levels', () => {
    expect(autoClicksPerSecond(createInitialState(0).techLevels)).toBe(0);
  });

  it('crankServo at level 3 gives 3 automatic cranks per second', () => {
    expect(autoClicksPerSecond(withLevels({ crankServo: 3 }).techLevels)).toBeCloseTo(3, 9);
  });

  it('adds the Servo Recall perk on the memory-source tech (owned from the start)', () => {
    const perkTechs = cycleTechs(TECHNOLOGIES, { cycle: 2, echoesEarned: 0, perks: ['servoRecall'] });
    expect(autoClicksPerSecond(withLevels({ crankServo: 2 }).techLevels, perkTechs)).toBeCloseTo(3, 9);
  });

  it('multiplies the injected autoClick perSecond by the level', () => {
    expect(autoClicksPerSecond(withLevels({ gearRatio: 5 }).techLevels, autoTechs)).toBeCloseTo(10, 9);
  });

  it('ignores techs at level 0', () => {
    expect(autoClicksPerSecond(withLevels({ gearRatio: 0 }).techLevels, autoTechs)).toBe(0);
  });

  it('sums every autoClick effect of one tech', () => {
    const twoEffects = withEffects({
      gearRatio: [
        { type: 'autoClick', perSecond: 1 },
        { type: 'autoClick', perSecond: 2 },
      ],
    });
    expect(autoClicksPerSecond(withLevels({ gearRatio: 2 }).techLevels, twoEffects)).toBeCloseTo(6, 9);
  });

  it('does not change computeRates perClick or perSecond', () => {
    const levels = withLevels({ gearRatio: 3 });
    const rates = computeRates(levels, autoTechs);
    expect(rates.perClick.me).toBeCloseTo(1, 9);
    expect(rates.perSecond.me).toBeCloseTo(6, 9);
    expect(autoClicksPerSecond(levels.techLevels, autoTechs)).toBeCloseTo(6, 9);
  });
});

describe('crank echo (C2)', () => {
  // Injected table: wornMotor 4 ME/s and 2 ee/s; reinforcedCrank clickMult 2 and a 0.5 s crank echo per level;
  // gearRatio 1 automatic crank per level, a 2 s ee click echo per level and a 3 s ME click echo (ignored).
  const echoTechs = withEffects({
    wornMotor: [
      { type: 'autoAdd', amount: 4 },
      { type: 'autoAdd', amount: 2, res: 'ee' },
    ],
    reinforcedCrank: [
      { type: 'clickMult', factor: 2 },
      { type: 'crankEcho', seconds: 0.5 },
    ],
    gearRatio: [
      { type: 'autoClick', perSecond: 1 },
      { type: 'clickEcho', seconds: 2, res: 'ee' },
      { type: 'clickEcho', seconds: 3, res: 'me' },
    ],
  });
  // Hand Crank 1 (clickAdd 1), Worn Motor 1, Reinforced Crank 1 (E = 0.5), Gear Ratio 2 (2 auto-cranks/s).
  const levels = withLevels({ wornMotor: 1, reinforcedCrank: 1, gearRatio: 2 });

  it('the ME echo is not multiplied by clickMult: 1 x 2 + 0.5 x 4 = 4 (not 6); the ME clickEcho stays ignored', () => {
    expect(computeRates(levels, echoTechs).perClick.me).toBeCloseTo(4, 9);
  });

  it('the servo fold-in includes the ME echo: perSecond.me = 4 + 2 auto-cranks x 4 = 12', () => {
    expect(computeRates(levels, echoTechs).perSecond.me).toBeCloseTo(12, 9);
  });

  it('every energy echoes E x perSecondPre plus its own clickEcho: ee (2 + 0.5) x 2 is 9; fold 2 + 2 x 9 = 20', () => {
    const r = computeRates(levels, echoTechs);
    // gearRatio 2 doubles its 2 s ee echo to 4 s: perClick.ee = (4 + 0.5) x 2 = 9.
    expect(r.perClick.ee).toBeCloseTo(9, 9);
    expect(r.perSecond.ee).toBeCloseTo(20, 9);
  });

  it('an energy with no rate gets no echo: pr stays 0', () => {
    const r = computeRates(levels, echoTechs);
    expect(r.perClick.pr).toBe(0);
    expect(r.perSecond.pr).toBe(0);
  });

  it('E scales with the level: Reinforced Crank 2 gives clickMult 4 and E 1: perClick.me = 4 + 1 x 4 = 8', () => {
    const r = computeRates(withLevels({ wornMotor: 1, reinforcedCrank: 2, gearRatio: 2 }), echoTechs);
    expect(r.perClick.me).toBeCloseTo(8, 9);
  });

  it('with no crankEcho the floats keep the pre-WP27 order (bit for bit)', () => {
    const techs = withEffects({
      wornMotor: [{ type: 'autoAdd', amount: 0.3 }],
      reinforcedCrank: [{ type: 'clickMult', factor: 1.1 }],
      gearRatio: [{ type: 'autoClick', perSecond: 0.3 }],
    });
    const r = computeRates(withLevels({ wornMotor: 3, reinforcedCrank: 2, gearRatio: 3 }), techs);
    const perClickMe = 1 * Math.pow(1.1, 2); // clickAdd 1 x clickMult
    const wornAuto = 0.3 * 3; // ME/s before the fold-in
    const autoClicks = 0.3 * 3;
    expect(r.perClick.me).toBe(perClickMe);
    expect(r.perSecond.me).toBe(wornAuto + autoClicks * perClickMe);
  });
});

// Seeded PRNG (mulberry32) so the property sample is the same on every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('click parity (D2) over the real tech table', () => {
  // Plan C2 / D2: perClick.me / perSecond.me >= perClick.r / perSecond.r for r in ee, pr, rs, xf, whenever all four
  // numbers are > 0. The real table has no clickEcho, so perClick.r / perSecond.r = E / (1 + autoClicks x E) for
  // every r; the ME ratio is (F + E p) / (p + autoClicks (F + E p)) with F = clickAdd x clickMult >= 0 and
  // p = perSecondPre.me. Cross-multiplying leaves F >= 0 (proof in the header of rates.ts).
  const SAMPLES = 240;
  const ENERGIES = ['ee', 'pr', 'rs', 'xf'] as const;

  it('ME click is never worth less than another energy click, over seeded random levels', () => {
    const rng = mulberry32(27);
    const failures: string[] = [];
    let compared = 0;
    for (let i = 0; i < SAMPLES; i++) {
      // Repeatables: 0..maxLevel (30 when unlimited). Every other tech: 0 or 1.
      const levels: Partial<Record<TechId, number>> = {};
      for (const id of TECH_IDS) {
        const def = TECHNOLOGIES[id];
        const top = def.kind === 'repeatable' ? (def.maxLevel ?? 30) : 1;
        levels[id] = Math.floor(rng() * (top + 1));
      }
      const r = computeRates(withLevels(levels));
      for (const e of ENERGIES) {
        if (!(r.perClick.me > 0 && r.perSecond.me > 0 && r.perClick[e] > 0 && r.perSecond[e] > 0)) continue;
        compared++;
        const lhs = r.perClick.me * r.perSecond[e];
        const rhs = r.perClick[e] * r.perSecond.me * (1 - 1e-9);
        if (!(lhs >= rhs)) failures.push(`sample ${i} ${e}: ${lhs} < ${rhs}`);
      }
    }
    expect(failures).toEqual([]);
    // Not vacuous: the sample must compare a real number of cases.
    expect(compared).toBeGreaterThanOrEqual(100);
  });
});
