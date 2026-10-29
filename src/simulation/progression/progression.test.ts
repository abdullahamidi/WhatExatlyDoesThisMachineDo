import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../../data/types';
import type { GameState, TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCES } from '../../data/resources';
import { createInitialState } from '../state';
import { emptyResourceMap } from '../resources';
import { isRequirementMet, requirementsMet, requirementLabel } from './requirements';
import { describeEffect, getTechStatus, getTechView, getAllTechViews, isSplice } from './status';
import { purchase } from './purchase';
import { evaluateMilestones } from './milestones';
import { computeRates } from '../production/rates';
import { faultParams } from '../faults';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Sets both the spendable `me` and the lifetime `me` (lifetime defaults to the same amount).
const withMe = (state: GameState, me: number, lifetimeMe: number = me): GameState => ({
  ...state,
  res: { ...state.res, me },
  lifetime: { ...state.lifetime, me: lifetimeMe },
});

// Era-I table, except wornMotor is paid in Electrical Energy.
const eeWornMotor: Record<TechId, TechDefinition> = {
  ...TECHNOLOGIES,
  wornMotor: { ...TECHNOLOGIES.wornMotor, costRes: 'ee' },
};

describe('requirements', () => {
  it('checks tech and lifetime requirements', () => {
    const s = withMe(withLevels({ gearRatio: 2 }), 0, 999);
    expect(isRequirementMet(s, { type: 'tech', id: 'gearRatio', minLevel: 2 })).toBe(true);
    expect(isRequirementMet(s, { type: 'tech', id: 'gearRatio', minLevel: 3 })).toBe(false);
    expect(isRequirementMet(s, { type: 'lifetime', res: 'me', amount: 1000 })).toBe(false);
    expect(isRequirementMet(s, { type: 'lifetime', res: 'me', amount: 999 })).toBe(true);
  });

  it('lifetime requirement reads only the named resource', () => {
    const s = withMe(withLevels({}), 1e9, 1e9);
    const withEe = (ee: number): GameState => ({ ...s, lifetime: { ...s.lifetime, ee } });
    expect(isRequirementMet(withEe(99), { type: 'lifetime', res: 'ee', amount: 100 })).toBe(false);
    expect(isRequirementMet(withEe(100), { type: 'lifetime', res: 'ee', amount: 100 })).toBe(true);
  });

  it('empty requirement list is met', () => {
    expect(requirementsMet(createInitialState(0), TECHNOLOGIES.handCrank)).toBe(true);
  });

  it('labels requirements', () => {
    expect(requirementLabel({ type: 'tech', id: 'gearRatio', minLevel: 3 })).toBe('Gear Ratio Lv 3');
    expect(requirementLabel({ type: 'tech', id: 'wornMotor', minLevel: 1 })).toBe('Worn Motor');
    expect(requirementLabel({ type: 'tech', id: 'flywheel', minLevel: 1 })).toBe('Flywheel Lv 1');
    expect(requirementLabel({ type: 'tech', id: 'motorTuning', minLevel: 5 })).toBe('Motor Tuning Lv 5');
    expect(requirementLabel({ type: 'lifetime', res: 'me', amount: 200000 })).toBe('200K lifetime ME');
    expect(requirementLabel({ type: 'lifetime', res: 'ee', amount: 100 })).toBe('100 lifetime EE');
    expect(requirementLabel({ type: 'lifetime', res: 'xf', amount: 5 })).toBe('5 lifetime ???');
  });

  it('labels tech requirements from an injected table', () => {
    const techs = { ...TECHNOLOGIES, gearRatio: { ...TECHNOLOGIES.gearRatio, name: 'Gear Train' } };
    expect(requirementLabel({ type: 'tech', id: 'gearRatio', minLevel: 3 }, techs)).toBe('Gear Train Lv 3');
    expect(requirementLabel({ type: 'tech', id: 'gearRatio', minLevel: 1 }, techs)).toBe('Gear Train Lv 1');
    expect(requirementLabel({ type: 'tech', id: 'gearRatio', minLevel: 3 })).toBe('Gear Ratio Lv 3');
  });
});

describe('getTechStatus', () => {
  it('initial state statuses', () => {
    const s = createInitialState(0);
    expect(getTechStatus(s, 'handCrank')).toBe('purchased');
    expect(getTechStatus(s, 'gearRatio')).toBe('available');
    expect(getTechStatus(s, 'wornMotor')).toBe('available');
    for (const id of ['reinforcedCrank', 'flywheel', 'motorTuning', 'pistonArray', 'improvedPistons', 'generatorBlueprint'] as const) {
      expect(getTechStatus(s, id)).toBe('locked');
    }
  });

  it('reinforcedCrank unlocks at gearRatio 3', () => {
    expect(getTechStatus(withLevels({ gearRatio: 2 }), 'reinforcedCrank')).toBe('locked');
    expect(getTechStatus(withLevels({ gearRatio: 3 }), 'reinforcedCrank')).toBe('available');
  });

  it('flywheel needs both reinforcedCrank and wornMotor', () => {
    expect(getTechStatus(withLevels({ gearRatio: 3, reinforcedCrank: 1 }), 'flywheel')).toBe('locked');
    expect(getTechStatus(withLevels({ gearRatio: 3, wornMotor: 1 }), 'flywheel')).toBe('locked');
    expect(
      getTechStatus(withLevels({ gearRatio: 3, reinforcedCrank: 1, wornMotor: 1 }), 'flywheel'),
    ).toBe('available');
  });

  it('motorTuning unlocks with wornMotor', () => {
    expect(getTechStatus(withLevels({ wornMotor: 1 }), 'motorTuning')).toBe('available');
  });

  it('pistonArray needs motorTuning 5', () => {
    expect(getTechStatus(withLevels({ motorTuning: 4, wornMotor: 1 }), 'pistonArray')).toBe('locked');
    expect(getTechStatus(withLevels({ motorTuning: 5, wornMotor: 1 }), 'pistonArray')).toBe('available');
  });

  it('improvedPistons unlocks with pistonArray', () => {
    expect(getTechStatus(withLevels({ pistonArray: 1 }), 'improvedPistons')).toBe('available');
  });

  it('gearRatio is purchased at max level 15 and available at 14', () => {
    expect(getTechStatus(withLevels({ gearRatio: 15 }), 'gearRatio')).toBe('purchased');
    expect(getTechStatus(withLevels({ gearRatio: 14 }), 'gearRatio')).toBe('available');
  });

  it('milestone is never available even when its conditions are met', () => {
    const s = withMe(withLevels({ pistonArray: 1, flywheel: 1 }), 0, 400000);
    expect(getTechStatus(s, 'generatorBlueprint')).toBe('locked');
  });
});

describe('getTechView', () => {
  it('gearRatio at level 2 with 26 ME', () => {
    const v = getTechView(withMe(withLevels({ gearRatio: 2 }), 26), 'gearRatio');
    expect(v.status).toBe('available');
    expect(v.level).toBe(2);
    expect(v.nextCost).toBe(26);
    expect(v.affordable).toBe(true);
    expect(v.currentEffectText).toBe('+1 ME/click');
    expect(v.nextEffectText).toBe('+1.5 ME/click');
  });

  it('gearRatio at level 2 with 25 ME is not affordable', () => {
    expect(getTechView(withMe(withLevels({ gearRatio: 2 }), 25), 'gearRatio').affordable).toBe(false);
  });

  it('gearRatio at level 0', () => {
    const v = getTechView(createInitialState(0), 'gearRatio');
    expect(v.currentEffectText).toBe('None');
    expect(v.nextEffectText).toBe('+0.5 ME/click');
    expect(v.nextCost).toBe(15);
  });

  it('owned wornMotor', () => {
    const v = getTechView(withLevels({ wornMotor: 1 }), 'wornMotor');
    expect(v.currentEffectText).toBe('+2 ME/s');
    expect(v.nextCost).toBeNull();
    expect(v.nextEffectText).toBeNull();
    expect(v.status).toBe('purchased');
  });

  it('unowned reinforcedCrank', () => {
    const v = getTechView(createInitialState(0), 'reinforcedCrank');
    expect(v.currentEffectText).toBe('None');
    expect(v.nextEffectText).toBe('Clicks echo 0.15s of all output, +0.35s wind-up, +0.035s/s refill');
    expect(v.nextCost).toBe(1200);
  });

  it('flywheel at level 2 shows cumulative effects', () => {
    const v = getTechView(withLevels({ gearRatio: 3, reinforcedCrank: 1, wornMotor: 1, flywheel: 2 }), 'flywheel');
    expect(v.currentEffectText).toBe('+20% automation, +0.03s wind-up, +0.003s/s refill');
    expect(v.nextEffectText).toBe('+30% automation, +0.045s wind-up, +0.0045s/s refill');
  });

  it('handCrank view', () => {
    const v = getTechView(createInitialState(0), 'handCrank');
    expect(v.currentEffectText).toBe('+1 ME/click');
    expect(v.nextEffectText).toBeNull();
    expect(v.nextCost).toBeNull();
  });

  it('generatorBlueprint unowned and owned', () => {
    const unowned = getTechView(createInitialState(0), 'generatorBlueprint');
    expect(unowned.currentEffectText).toBe('None');
    expect(unowned.nextEffectText).toBe('Effect unknown');
    const owned = getTechView(withLevels({ generatorBlueprint: 1 }), 'generatorBlueprint');
    expect(owned.currentEffectText).toBe('Effect unknown');
    expect(owned.nextEffectText).toBeNull();
  });

  it('maxed gearRatio has no next cost or effect', () => {
    const v = getTechView(withLevels({ gearRatio: 15 }), 'gearRatio');
    expect(v.nextCost).toBeNull();
    expect(v.nextEffectText).toBeNull();
  });

  it('generatorBlueprint requirement labels and met flags', () => {
    const v = getTechView(createInitialState(0), 'generatorBlueprint');
    expect(v.requirements.map((r) => r.label)).toEqual(['Piston Array', 'Flywheel Lv 1', '400K lifetime ME']);
    expect(v.requirements.every((r) => r.met === false)).toBe(true);
  });

  it('getAllTechViews returns one view per tech in TECH_IDS order', () => {
    const views = getAllTechViews(createInitialState(0));
    expect(views.length).toBe(TECH_IDS.length);
    expect(views.map((v) => v.id)).toEqual([...TECH_IDS]);
  });

  it('getAllTechViews reflects an injected tech table', () => {
    const techs = {
      ...TECHNOLOGIES,
      generatorBlueprint: {
        ...TECHNOLOGIES.generatorBlueprint,
        requires: [{ type: 'lifetime' as const, res: 'me' as const, amount: 100 }],
      },
    };
    const views = getAllTechViews(withMe(createInitialState(0), 0, 100), techs);
    const blueprint = views.find((v) => v.id === 'generatorBlueprint');
    expect(blueprint?.def.requires).toEqual([{ type: 'lifetime', res: 'me', amount: 100 }]);
    expect(blueprint?.requirements.map((r) => r.met)).toEqual([true]);
    expect(views.map((v) => v.id)).toEqual([...TECH_IDS]);
  });

  it('getTechView passes the injected table to requirement labels', () => {
    const techs = { ...TECHNOLOGIES, gearRatio: { ...TECHNOLOGIES.gearRatio, name: 'Gear Train' } };
    const v = getTechView(withLevels({ gearRatio: 3, reinforcedCrank: 1 }), 'reinforcedCrank', techs);
    expect(v.requirements.map((r) => r.label)).toEqual(['Gear Train Lv 3']);
  });

  it('affordability follows the tech costRes (injected table: wornMotor costs EE)', () => {
    const cheap = { ...withLevels({}), res: { ...emptyResourceMap(), me: 1e9, ee: 40 } };
    expect(getTechView(cheap, 'wornMotor', eeWornMotor)).toMatchObject({ nextCost: 40, affordable: true });

    const short = { ...withLevels({}), res: { ...emptyResourceMap(), me: 1e9, ee: 39 } };
    expect(getTechView(short, 'wornMotor', eeWornMotor)).toMatchObject({ nextCost: 40, affordable: false });
  });
});

describe('describeEffect', () => {
  it('describes ME effects', () => {
    expect(describeEffect({ type: 'clickAdd', amount: 1 }, 3)).toBe('+3 ME/click');
    expect(describeEffect({ type: 'clickMult', factor: 2 }, 3)).toBe('×8 manual production');
    expect(describeEffect({ type: 'autoAdd', amount: 1 }, 2)).toBe('+2 ME/s');
    expect(describeEffect({ type: 'autoPct', percent: 10 }, 2)).toBe('+20% automation');
    expect(describeEffect({ type: 'autoPct', percent: 10, res: 'me' }, 2)).toBe('+20% automation');
  });

  it('describes non-ME effects', () => {
    expect(describeEffect({ type: 'autoAdd', amount: 1.5, res: 'ee' }, 2)).toBe('+3 EE/s');
    expect(describeEffect({ type: 'autoPct', percent: 10, res: 'pr' }, 2)).toBe('+20% PR production');
    expect(describeEffect({ type: 'rateMult', factor: 2, res: 'all' }, 2)).toBe('×4 all production');
    expect(describeEffect({ type: 'rateMult', factor: 3, res: 'rs' }, 1)).toBe('×3 RS production');
    expect(describeEffect({ type: 'convert', amount: 0.5, res: 'ee' }, 2)).toBe('Converts √(ME/s) × 1 into EE/s');
    expect(describeEffect({ type: 'convert', amount: 0.3, res: 'pr' }, 1)).toBe('Converts √(EE/s) × 0.3 into PR/s');
    expect(describeEffect({ type: 'clickEcho', seconds: 2, res: 'ee' }, 2)).toBe('Clicks echo 4s of EE/s');
    expect(describeEffect({ type: 'none' }, 1)).toBe('Effect unknown');
    expect(describeEffect({ type: 'ending' }, 1)).toBe('Engages the primary function');
    expect(describeEffect({ type: 'ending' }, 3)).toBe('Engages the primary function');
  });

  it('states the convert formula for exponents 1 and other values', () => {
    // Real resources only use 0.5, so temporarily override convExp and restore it after.
    const original = RESOURCES.ee.convExp;
    try {
      RESOURCES.ee.convExp = 1;
      expect(describeEffect({ type: 'convert', amount: 0.5, res: 'ee' }, 2)).toBe('Converts ME/s × 1 into EE/s');
      RESOURCES.ee.convExp = 0.25;
      expect(describeEffect({ type: 'convert', amount: 0.5, res: 'ee' }, 2)).toBe('Converts (ME/s)^0.25 × 1 into EE/s');
    } finally {
      RESOURCES.ee.convExp = original;
    }
  });

  it('describes the offline buffer', () => {
    expect(describeEffect({ type: 'offlineHours', hours: 4 }, 1)).toBe('+4h offline buffer');
    expect(describeEffect({ type: 'offlineHours', hours: 4 }, 3)).toBe('+12h offline buffer');
    expect(describeEffect({ type: 'offlineHours', hours: 0.5 }, 1)).toBe('+0.5h offline buffer');
  });

  it('describes servo auto-cranks', () => {
    expect(describeEffect({ type: 'autoClick', perSecond: 1 }, 1)).toBe('+1 auto-cranks/s — each yields a full click of every energy');
    expect(describeEffect({ type: 'autoClick', perSecond: 1 }, 3)).toBe('+3 auto-cranks/s — each yields a full click of every energy');
    expect(describeEffect({ type: 'autoClick', perSecond: 0.5 }, 1)).toBe('+0.5 auto-cranks/s — each yields a full click of every energy');
  });

  it('describes the WP27 crank echo and wind-up (four decimals kept)', () => {
    expect(describeEffect({ type: 'crankEcho', seconds: 0.15 }, 1)).toBe('Clicks echo 0.15s of all output');
    expect(describeEffect({ type: 'windup', seconds: 0.35, refill: 0.035 }, 1)).toBe('+0.35s wind-up, +0.035s/s refill');
    expect(describeEffect({ type: 'windup', seconds: 0.015, refill: 0.0015 }, 10)).toBe('+0.15s wind-up, +0.015s/s refill');
  });

  it('describes the WP27 faults and overdrive', () => {
    expect(describeEffect({ type: 'faultUnlock', seconds: 15 }, 1)).toBe('Faults appear; clearing one pays 15s of all output');
    expect(describeEffect({ type: 'faultSeconds', seconds: 3 }, 1)).toBe('Cleared faults pay +3s');
    expect(describeEffect({ type: 'faultRate', factor: 0.9 }, 1)).toBe('Fault interval ×0.9');
    expect(describeEffect({ type: 'faultWindow', seconds: 4 }, 1)).toBe('Faults last +4s');
    expect(describeEffect({ type: 'overdrive', seconds: 6, factor: 2 }, 1)).toBe('Cleared faults: ×2 output for 6s');
  });

  it('describes the WP28 Find effects (payout seconds and the sooner rate)', () => {
    expect(describeEffect({ type: 'findSeconds', seconds: 1 }, 1)).toBe('Finds pay +1s');
    expect(describeEffect({ type: 'findSeconds', seconds: 1 }, 2)).toBe('Finds pay +2s');
    expect(describeEffect({ type: 'findRate', factor: 0.85 }, 1)).toBe('Finds come 15% sooner');
    expect(describeEffect({ type: 'findRate', factor: 0.85 }, 2)).toBe('Finds come 28% sooner');
  });

  it('keeps the third decimal of convert rates under 0.1 (WP28 fmtFine)', () => {
    expect(describeEffect({ type: 'convert', amount: 0.034, res: 'ee' }, 1)).toBe('Converts √(ME/s) × 0.034 into EE/s');
    expect(describeEffect({ type: 'convert', amount: 0.0295, res: 'pr' }, 1)).toBe('Converts √(EE/s) × 0.0295 into PR/s');
    expect(describeEffect({ type: 'convert', amount: 0.14, res: 'ee' }, 1)).toBe('Converts √(ME/s) × 0.14 into EE/s');
  });
});

describe('purchase failures', () => {
  const expectFailure = (s: GameState, id: TechId, reason: string) => {
    const before = structuredClone(s);
    const result = purchase(s, id);
    expect(result).toEqual({ ok: false, reason });
    expect(s).toEqual(before);
  };

  it('insufficient ME on initial state', () => {
    expectFailure(createInitialState(0), 'gearRatio', 'insufficient');
  });

  it('locked motorTuning', () => {
    expectFailure(withMe(withLevels({}), 1000), 'motorTuning', 'locked');
  });

  it('locked reinforcedCrank at gearRatio 2', () => {
    expectFailure(withMe(withLevels({ gearRatio: 2 }), 1000), 'reinforcedCrank', 'locked');
  });

  it('owned wornMotor', () => {
    expectFailure(withMe(withLevels({ wornMotor: 1 }), 1e9), 'wornMotor', 'owned');
  });

  it('maxed gearRatio', () => {
    expectFailure(withMe(withLevels({ gearRatio: 15 }), 1e9), 'gearRatio', 'maxed');
  });

  it('starting tech is not purchasable', () => {
    expectFailure(createInitialState(0), 'handCrank', 'notPurchasable');
  });

  it('milestone is not purchasable even when locked-but-rich', () => {
    expectFailure(withMe(withLevels({}), 1e9), 'generatorBlueprint', 'notPurchasable');
  });

  it('insufficient EE is reported even when ME is huge (injected table)', () => {
    const s = withMe(withLevels({}), 1e9);
    const before = structuredClone(s);
    expect(purchase(s, 'wornMotor', eeWornMotor)).toEqual({ ok: false, reason: 'insufficient' });
    expect(s).toEqual(before);
  });
});

describe('purchase success', () => {
  it('buys gearRatio level 1 for 15 ME', () => {
    const input = withMe(withLevels({}), 15, 15);
    const result = purchase(input, 'gearRatio');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cost).toBe(15);
    expect(result.newLevel).toBe(1);
    expect(result.state.res.me).toBe(0);
    expect(result.state.techLevels.gearRatio).toBe(1);
    expect(result.state.lifetime.me).toBe(15);
    // input is unchanged, and the new objects are distinct references
    expect(input.res.me).toBe(15);
    expect(input.techLevels.gearRatio).toBe(0);
    expect(result.state).not.toBe(input);
    expect(result.state.techLevels).not.toBe(input.techLevels);
  });

  it('buys gearRatio level 2 for 20 ME', () => {
    const result = purchase(withMe(withLevels({ gearRatio: 1 }), 20, 20), 'gearRatio');
    expect(result).toMatchObject({ ok: true, cost: 20, newLevel: 2 });
    if (result.ok) expect(result.state.res.me).toBe(0);
  });

  it('buys reinforcedCrank for 1200 ME once gearRatio is 3', () => {
    const first = purchase(withMe(withLevels({ gearRatio: 3 }), 1200, 1200), 'reinforcedCrank');
    expect(first).toMatchObject({ ok: true, cost: 1200, newLevel: 1 });
    if (!first.ok) return;
    expect(first.state.res.me).toBe(0);
    expect(first.state.techLevels.reinforcedCrank).toBe(1);
    expect(purchase(first.state, 'reinforcedCrank')).toEqual({ ok: false, reason: 'owned' });
  });

  it('never reduces lifetime.me across successive purchases', () => {
    let s = withMe(withLevels({}), 1000, 1000);
    for (let i = 0; i < 3; i++) {
      const r = purchase(s, 'gearRatio');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      expect(s.lifetime.me).toBe(1000);
    }
  });

  it('spends the tech costRes only and keeps the same lifetime object (injected table)', () => {
    const s = { ...withLevels({}), res: { ...emptyResourceMap(), me: 1e9, ee: 100 } };
    const result = purchase(s, 'wornMotor', eeWornMotor);
    expect(result).toMatchObject({ ok: true, cost: 40, newLevel: 1 });
    if (!result.ok) return;
    expect(result.state.res.ee).toBe(60);
    expect(result.state.res.me).toBe(1e9);
    expect(result.state.lifetime).toBe(s.lifetime);
    expect(result.state.techLevels.wornMotor).toBe(1);
    expect(s.res.ee).toBe(100);
  });

  it('never decreases lifetime across multiple purchases of different costRes (injected table)', () => {
    const start = {
      ...withLevels({}),
      res: { ...emptyResourceMap(), me: 15, ee: 1000 },
      lifetime: { ...emptyResourceMap(), me: 15, ee: 500 },
    };
    const first = purchase(start, 'wornMotor', eeWornMotor);
    if (!first.ok) throw new Error('first purchase failed');
    const second = purchase(first.state, 'gearRatio', eeWornMotor);
    expect(second).toMatchObject({ ok: true, cost: 15 });
    if (!second.ok) return;
    expect(second.state.lifetime).toBe(start.lifetime);
    expect(second.state.res.ee).toBe(1000 - 40);
    expect(second.state.res.me).toBe(0);
  });
});

describe('evaluateMilestones', () => {
  it('does nothing below the lifetime threshold', () => {
    const s = withMe(withLevels({ pistonArray: 1, flywheel: 1 }), 0, 399999);
    const result = evaluateMilestones(s);
    expect(result.unlocked).toEqual([]);
    expect(result.state).toBe(s);
  });

  it('unlocks generatorBlueprint at the threshold, idempotently', () => {
    const s = withMe(withLevels({ pistonArray: 1, flywheel: 1 }), 5, 400000);
    const first = evaluateMilestones(s);
    expect(first.unlocked).toEqual(['generatorBlueprint']);
    expect(first.state.techLevels.generatorBlueprint).toBe(1);
    expect(first.state.res.me).toBe(5);
    expect(getTechStatus(first.state, 'generatorBlueprint')).toBe('purchased');

    const second = evaluateMilestones(first.state);
    expect(second.unlocked).toEqual([]);
    expect(second.state).toBe(first.state);
  });

  it('needs flywheel', () => {
    const s = withMe(withLevels({ pistonArray: 1 }), 0, 400000);
    expect(evaluateMilestones(s).unlocked).toEqual([]);
  });

  it('needs pistonArray', () => {
    const s = withMe(withLevels({ flywheel: 1 }), 0, 400000);
    expect(evaluateMilestones(s).unlocked).toEqual([]);
  });

  it('uses an injected tech table: generatorBlueprint unlocks at lifetime.me 100', () => {
    const techs = {
      ...TECHNOLOGIES,
      generatorBlueprint: {
        ...TECHNOLOGIES.generatorBlueprint,
        requires: [{ type: 'lifetime' as const, res: 'me' as const, amount: 100 }],
      },
    };
    const s = withMe(withLevels({}), 0, 100);
    expect(evaluateMilestones(s).unlocked).toEqual([]);
    const result = evaluateMilestones(s, techs);
    expect(result.unlocked).toEqual(['generatorBlueprint']);
    expect(result.state.techLevels.generatorBlueprint).toBe(1);
  });
});

describe('scripted two-branch run', () => {
  it('buys the full convergence path and unlocks the milestone', () => {
    let s: GameState = withMe(createInitialState(0), 1e6);
    const buy = (id: TechId) => {
      const r = purchase(s, id);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(`purchase ${id} failed: ${r.reason}`);
      s = r.state;
      return r.cost;
    };

    let spent = 0;
    for (const id of ['gearRatio', 'gearRatio', 'gearRatio'] as const) spent += buy(id);
    expect(spent).toBe(61);
    spent += buy('reinforcedCrank');
    spent += buy('wornMotor');
    spent += buy('flywheel');
    for (const id of ['motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning'] as const) {
      spent += buy(id);
    }
    spent += buy('pistonArray');
    expect(spent).toBe(8845);

    const result = evaluateMilestones(s);
    expect(result.unlocked).toEqual(['generatorBlueprint']);
    expect(result.state.res.me).toBe(1e6 - 8845);
    expect(result.state.lifetime.me).toBe(1e6);
  });
});

describe('Splices (WP28)', () => {
  it('isSplice reads the branch only', () => {
    expect(isSplice(TECHNOLOGIES.spliceBicycle)).toBe(true);
    expect(isSplice(TECHNOLOGIES.spliceCoinReturn)).toBe(true);
    expect(isSplice(TECHNOLOGIES.gearRatio)).toBe(false);
    expect(isSplice(TECHNOLOGIES.overrunClutch)).toBe(false);
  });

  it('Find effects are no-ops for the production rates and the fault clock', () => {
    const base = createInitialState(0).techLevels;
    const withFinds = { ...base, spliceOrgan: 2, spliceWhistle: 1, spliceKite: 1 };
    expect(computeRates({ techLevels: withFinds })).toEqual(computeRates({ techLevels: base }));
    expect(faultParams(withFinds)).toEqual(faultParams(base));
  });
});
