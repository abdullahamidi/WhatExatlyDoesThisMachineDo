import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../../data/types';
import type { GameState, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { createInitialState } from '../state';
import { isRequirementMet, requirementsMet, requirementLabel } from './requirements';
import { getTechStatus, getTechView, getAllTechViews } from './status';
import { purchase } from './purchase';
import { evaluateMilestones } from './milestones';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

describe('requirements', () => {
  it('checks tech and lifetimeMe requirements', () => {
    const s = withLevels({ gearRatio: 2 }, { lifetimeMe: 999 });
    expect(isRequirementMet(s, { type: 'tech', id: 'gearRatio', minLevel: 2 })).toBe(true);
    expect(isRequirementMet(s, { type: 'tech', id: 'gearRatio', minLevel: 3 })).toBe(false);
    expect(isRequirementMet(s, { type: 'lifetimeMe', amount: 1000 })).toBe(false);
    expect(isRequirementMet(s, { type: 'lifetimeMe', amount: 999 })).toBe(true);
  });

  it('empty requirement list is met', () => {
    expect(requirementsMet(createInitialState(0), TECHNOLOGIES.handCrank)).toBe(true);
  });

  it('labels requirements', () => {
    expect(requirementLabel({ type: 'tech', id: 'gearRatio', minLevel: 3 })).toBe('Gear Ratio Lv 3');
    expect(requirementLabel({ type: 'tech', id: 'wornMotor', minLevel: 1 })).toBe('Worn Motor');
    expect(requirementLabel({ type: 'tech', id: 'flywheel', minLevel: 1 })).toBe('Flywheel Lv 1');
    expect(requirementLabel({ type: 'tech', id: 'motorTuning', minLevel: 5 })).toBe('Motor Tuning Lv 5');
    expect(requirementLabel({ type: 'lifetimeMe', amount: 1000 })).toBe('1K lifetime ME');
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

  it('gearRatio is purchased at max level 25 and available at 24', () => {
    expect(getTechStatus(withLevels({ gearRatio: 25 }), 'gearRatio')).toBe('purchased');
    expect(getTechStatus(withLevels({ gearRatio: 24 }), 'gearRatio')).toBe('available');
  });

  it('milestone is never available even when its conditions are met', () => {
    const s = withLevels({ pistonArray: 1, flywheel: 1 }, { lifetimeMe: 1000 });
    expect(getTechStatus(s, 'generatorBlueprint')).toBe('locked');
  });
});

describe('getTechView', () => {
  it('gearRatio at level 2 with 20 ME', () => {
    const v = getTechView(withLevels({ gearRatio: 2 }, { me: 20 }), 'gearRatio');
    expect(v.status).toBe('available');
    expect(v.level).toBe(2);
    expect(v.nextCost).toBe(14);
    expect(v.affordable).toBe(true);
    expect(v.currentEffectText).toBe('+2 ME/click');
    expect(v.nextEffectText).toBe('+3 ME/click');
  });

  it('gearRatio at level 2 with 13 ME is not affordable', () => {
    expect(getTechView(withLevels({ gearRatio: 2 }, { me: 13 }), 'gearRatio').affordable).toBe(false);
  });

  it('gearRatio at level 0', () => {
    const v = getTechView(createInitialState(0), 'gearRatio');
    expect(v.currentEffectText).toBe('None');
    expect(v.nextEffectText).toBe('+1 ME/click');
    expect(v.nextCost).toBe(10);
  });

  it('owned wornMotor', () => {
    const v = getTechView(withLevels({ wornMotor: 1 }), 'wornMotor');
    expect(v.currentEffectText).toBe('+1 ME/s');
    expect(v.nextCost).toBeNull();
    expect(v.nextEffectText).toBeNull();
    expect(v.status).toBe('purchased');
  });

  it('unowned reinforcedCrank', () => {
    const v = getTechView(createInitialState(0), 'reinforcedCrank');
    expect(v.currentEffectText).toBe('None');
    expect(v.nextEffectText).toBe('×2 manual production');
    expect(v.nextCost).toBe(50);
  });

  it('flywheel at level 2 shows cumulative effects', () => {
    const v = getTechView(withLevels({ gearRatio: 3, reinforcedCrank: 1, wornMotor: 1, flywheel: 2 }), 'flywheel');
    expect(v.currentEffectText).toBe('+20% automation');
    expect(v.nextEffectText).toBe('+30% automation');
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
    const v = getTechView(withLevels({ gearRatio: 25 }), 'gearRatio');
    expect(v.nextCost).toBeNull();
    expect(v.nextEffectText).toBeNull();
  });

  it('generatorBlueprint requirement labels and met flags', () => {
    const v = getTechView(createInitialState(0), 'generatorBlueprint');
    expect(v.requirements.map((r) => r.label)).toEqual(['Piston Array', 'Flywheel Lv 1', '1K lifetime ME']);
    expect(v.requirements.every((r) => r.met === false)).toBe(true);
  });

  it('getAllTechViews returns all nine in TECH_IDS order', () => {
    const views = getAllTechViews(createInitialState(0));
    expect(views.length).toBe(9);
    expect(views.map((v) => v.id)).toEqual([...TECH_IDS]);
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
    expectFailure(withLevels({}, { me: 1000 }), 'motorTuning', 'locked');
  });

  it('locked reinforcedCrank at gearRatio 2', () => {
    expectFailure(withLevels({ gearRatio: 2 }, { me: 1000 }), 'reinforcedCrank', 'locked');
  });

  it('owned wornMotor', () => {
    expectFailure(withLevels({ wornMotor: 1 }, { me: 1e9 }), 'wornMotor', 'owned');
  });

  it('maxed gearRatio', () => {
    expectFailure(withLevels({ gearRatio: 25 }, { me: 1e9 }), 'gearRatio', 'maxed');
  });

  it('starting tech is not purchasable', () => {
    expectFailure(createInitialState(0), 'handCrank', 'notPurchasable');
  });

  it('milestone is not purchasable even when locked-but-rich', () => {
    expectFailure(withLevels({}, { me: 1e9 }), 'generatorBlueprint', 'notPurchasable');
  });
});

describe('purchase success', () => {
  it('buys gearRatio level 1 for 10 ME', () => {
    const input = withLevels({}, { me: 10, lifetimeMe: 10 });
    const result = purchase(input, 'gearRatio');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cost).toBe(10);
    expect(result.newLevel).toBe(1);
    expect(result.state.me).toBe(0);
    expect(result.state.techLevels.gearRatio).toBe(1);
    expect(result.state.lifetimeMe).toBe(10);
    // input is unchanged, and the new objects are distinct references
    expect(input.me).toBe(10);
    expect(input.techLevels.gearRatio).toBe(0);
    expect(result.state).not.toBe(input);
    expect(result.state.techLevels).not.toBe(input.techLevels);
  });

  it('buys gearRatio level 2 for 12 ME', () => {
    const result = purchase(withLevels({ gearRatio: 1 }, { me: 12, lifetimeMe: 12 }), 'gearRatio');
    expect(result).toMatchObject({ ok: true, cost: 12, newLevel: 2 });
    if (result.ok) expect(result.state.me).toBe(0);
  });

  it('buys reinforcedCrank for 50 ME once gearRatio is 3', () => {
    const first = purchase(withLevels({ gearRatio: 3 }, { me: 50, lifetimeMe: 50 }), 'reinforcedCrank');
    expect(first).toMatchObject({ ok: true, cost: 50, newLevel: 1 });
    if (!first.ok) return;
    expect(first.state.me).toBe(0);
    expect(first.state.techLevels.reinforcedCrank).toBe(1);
    expect(purchase(first.state, 'reinforcedCrank')).toEqual({ ok: false, reason: 'owned' });
  });

  it('never reduces lifetimeMe across successive purchases', () => {
    let s = withLevels({}, { me: 1000, lifetimeMe: 1000 });
    for (let i = 0; i < 3; i++) {
      const r = purchase(s, 'gearRatio');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      expect(s.lifetimeMe).toBe(1000);
    }
  });
});

describe('evaluateMilestones', () => {
  it('does nothing below the lifetime threshold', () => {
    const s = withLevels({ pistonArray: 1, flywheel: 1 }, { lifetimeMe: 999 });
    const result = evaluateMilestones(s);
    expect(result.unlocked).toEqual([]);
    expect(result.state).toBe(s);
  });

  it('unlocks generatorBlueprint at the threshold, idempotently', () => {
    const s = withLevels({ pistonArray: 1, flywheel: 1 }, { lifetimeMe: 1000, me: 5 });
    const first = evaluateMilestones(s);
    expect(first.unlocked).toEqual(['generatorBlueprint']);
    expect(first.state.techLevels.generatorBlueprint).toBe(1);
    expect(first.state.me).toBe(5);
    expect(getTechStatus(first.state, 'generatorBlueprint')).toBe('purchased');

    const second = evaluateMilestones(first.state);
    expect(second.unlocked).toEqual([]);
    expect(second.state).toBe(first.state);
  });

  it('needs flywheel', () => {
    const s = withLevels({ pistonArray: 1 }, { lifetimeMe: 1000 });
    expect(evaluateMilestones(s).unlocked).toEqual([]);
  });

  it('needs pistonArray', () => {
    const s = withLevels({ flywheel: 1 }, { lifetimeMe: 1000 });
    expect(evaluateMilestones(s).unlocked).toEqual([]);
  });
});

describe('scripted two-branch run', () => {
  it('buys the full convergence path and unlocks the milestone', () => {
    let s: GameState = { ...createInitialState(0), me: 1e6, lifetimeMe: 1e6 };
    const buy = (id: TechId) => {
      const r = purchase(s, id);
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error(`purchase ${id} failed: ${r.reason}`);
      s = r.state;
      return r.cost;
    };

    let spent = 0;
    for (const id of ['gearRatio', 'gearRatio', 'gearRatio'] as const) spent += buy(id);
    expect(spent).toBe(36);
    spent += buy('reinforcedCrank');
    spent += buy('wornMotor');
    spent += buy('flywheel');
    for (const id of ['motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning'] as const) {
      spent += buy(id);
    }
    spent += buy('pistonArray');
    expect(spent).toBe(799);

    const result = evaluateMilestones(s);
    expect(result.unlocked).toEqual(['generatorBlueprint']);
    expect(result.state.me).toBe(1e6 - 799);
    expect(result.state.lifetimeMe).toBe(1e6);
  });
});
