import { describe, it, expect } from 'vitest';
import type { GameState, PrestigeState, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { PERK_IDS } from '../../data/prestige';
import { createInitialState } from '../state';
import { clampLoadToEra, clampStateToEra, eraAllowed, resourceAllowed } from './edition';
import { purchase } from './purchase';
import { getAllTechViews, getTechStatus, getTechView } from './status';
import { evaluateMilestones } from './milestones';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Era I-II progress plus era-III+ progress and a finale, as a full-game save might hold it.
const fullGameState = (): GameState => {
  const s = withLevels(
    { boiler: 1, resonatorSpire: 1, primaryFunction: 1, generator: 1, handCrank: 1 },
    { ending: { phase: 'postgame', engagedAt: 5 } },
  );
  return {
    ...s,
    res: { ...s.res, me: 7, pr: 5 },
    lifetime: { ...s.lifetime, me: 7, xf: 9 },
  };
};

// Substation Blueprint owned and enough EE for the Boiler (era III, costs 1e6 EE).
const boilerReady = (): GameState => {
  const s = withLevels({ substationBlueprint: 1 });
  return { ...s, res: { ...s.res, ee: 1e12 } };
};

describe('eraAllowed', () => {
  it('allows every era on the full game', () => {
    for (const era of [1, 2, 3, 4, 5]) expect(eraAllowed({ era }, null)).toBe(true);
  });

  it('caps at maxEra, inclusive', () => {
    expect(eraAllowed({ era: 2 }, 2)).toBe(true);
    expect(eraAllowed({ era: 3 }, 2)).toBe(false);
  });
});

describe('resourceAllowed', () => {
  it('allows every resource on the full game', () => {
    for (const id of ['me', 'ee', 'pr', 'rs', 'xf'] as const) expect(resourceAllowed(id, null)).toBe(true);
  });

  it('keeps me and ee under the demo cap', () => {
    expect(resourceAllowed('me', 2)).toBe(true);
    expect(resourceAllowed('ee', 2)).toBe(true);
    for (const id of ['pr', 'rs', 'xf'] as const) expect(resourceAllowed(id, 2)).toBe(false);
  });
});

describe('clampStateToEra', () => {
  it('zeroes era-III+ levels, pr/xf and the finale; keeps era I-II progress', () => {
    const { state, changed } = clampStateToEra(fullGameState(), 2);
    expect(changed).toBe(true);
    expect(state.techLevels.boiler).toBe(0);
    expect(state.techLevels.resonatorSpire).toBe(0);
    expect(state.techLevels.primaryFunction).toBe(0);
    expect(state.techLevels.generator).toBe(1);
    expect(state.techLevels.handCrank).toBe(1);
    expect(state.res.pr).toBe(0);
    expect(state.res.me).toBe(7);
    expect(state.lifetime.xf).toBe(0);
    expect(state.lifetime.me).toBe(7);
    expect(state.ending).toEqual({ phase: 'none', engagedAt: null });
  });

  it('does not mutate its input', () => {
    const before = fullGameState();
    const snapshot = structuredClone(before);
    clampStateToEra(before, 2);
    expect(before).toEqual(snapshot);
  });

  it('is idempotent: a second pass returns the same object with changed false', () => {
    const once = clampStateToEra(fullGameState(), 2).state;
    const twice = clampStateToEra(once, 2);
    expect(twice.changed).toBe(false);
    expect(twice.state).toBe(once);
  });

  it('keeps untouched sub-objects by reference', () => {
    const before = withLevels({ boiler: 1 });
    const { state } = clampStateToEra(before, 2);
    expect(state.techLevels).not.toBe(before.techLevels);
    expect(state.res).toBe(before.res);
    expect(state.lifetime).toBe(before.lifetime);
    expect(state.ending).toBe(before.ending);
  });

  it('returns the same state for the full game', () => {
    const before = fullGameState();
    const result = clampStateToEra(before, null);
    expect(result.state).toBe(before);
    expect(result.changed).toBe(false);
  });

  it('returns the same state when everything is inside the cap', () => {
    const before = withLevels({ generator: 1, handCrank: 1 }, { res: { ...createInitialState(0).res, me: 3 } });
    const result = clampStateToEra(before, 2);
    expect(result.state).toBe(before);
    expect(result.changed).toBe(false);
  });
});

describe('clampLoadToEra', () => {
  it('resets a cycle-3 prestige to a fresh cycle 1', () => {
    const prestige: PrestigeState = { cycle: 3, echoesEarned: 6, perks: [] };
    const out = clampLoadToEra({ state: createInitialState(0), prestige }, 2);
    expect(out.prestige).toEqual({ cycle: 1, echoesEarned: 0, perks: [] });
    expect(out.changed).toBe(true);
  });

  it('resets owned perks as well', () => {
    const prestige: PrestigeState = { cycle: 1, echoesEarned: 0, perks: PERK_IDS.slice(0, 1) };
    const out = clampLoadToEra({ state: createInitialState(0), prestige }, 2);
    expect(out.prestige).toEqual({ cycle: 1, echoesEarned: 0, perks: [] });
    expect(out.changed).toBe(true);
  });

  it('keeps both references when the load is already inside the cap', () => {
    const state = createInitialState(0);
    const prestige: PrestigeState = { cycle: 1, echoesEarned: 0, perks: [] };
    const out = clampLoadToEra({ state, prestige }, 2);
    expect(out.state).toBe(state);
    expect(out.prestige).toBe(prestige);
    expect(out.changed).toBe(false);
  });

  it('returns the inputs by reference on the full game', () => {
    const state = fullGameState();
    const prestige: PrestigeState = { cycle: 3, echoesEarned: 6, perks: [] };
    const out = clampLoadToEra({ state, prestige }, null);
    expect(out.state).toBe(state);
    expect(out.prestige).toBe(prestige);
    expect(out.changed).toBe(false);
  });
});

describe('purchase with an era cap', () => {
  it('refuses an era-III tech under the demo cap', () => {
    expect(purchase(boilerReady(), 'boiler', TECHNOLOGIES, 2)).toEqual({ ok: false, reason: 'demo' });
  });

  it('buys the same tech on the full game', () => {
    expect(purchase(boilerReady(), 'boiler').ok).toBe(true);
    expect(purchase(boilerReady(), 'boiler', TECHNOLOGIES, null).ok).toBe(true);
  });

  it('keeps milestone and starting techs notPurchasable under the cap', () => {
    expect(purchase(boilerReady(), 'handCrank', TECHNOLOGIES, 2)).toEqual({ ok: false, reason: 'notPurchasable' });
    expect(purchase(boilerReady(), 'substationBlueprint', TECHNOLOGIES, 2)).toEqual({
      ok: false,
      reason: 'notPurchasable',
    });
  });
});

describe('getTechStatus with an era cap', () => {
  it('locks an owned era-III tech under the cap', () => {
    const s = withLevels({ boiler: 1 });
    expect(getTechStatus(s, 'boiler', TECHNOLOGIES, 2)).toBe('locked');
    expect(getTechStatus(s, 'boiler', TECHNOLOGIES, null)).toBe('purchased');
    expect(getTechStatus(s, 'boiler')).toBe('purchased');
  });
});

describe('getTechView with an era cap', () => {
  it('flags an era-III tech as demoLocked, locked and not affordable', () => {
    const s = boilerReady();
    expect(getTechView(s, 'boiler', TECHNOLOGIES, 2)).toMatchObject({
      demoLocked: true,
      status: 'locked',
      affordable: false,
    });
    expect(getTechView(s, 'boiler').affordable).toBe(true);
  });

  it('leaves era I-II techs unlocked under the cap', () => {
    const s = createInitialState(0);
    expect(getTechView(s, 'handCrank', TECHNOLOGIES, 2).demoLocked).toBe(false);
    expect(getTechView(s, 'generator', TECHNOLOGIES, 2).demoLocked).toBe(false);
  });

  it('flags exactly the era > cap techs', () => {
    const views = getAllTechViews(boilerReady(), TECHNOLOGIES, 2);
    expect(views.filter((v) => v.demoLocked).every((v) => v.def.era > 2)).toBe(true);
    expect(views.filter((v) => v.def.era > 2).every((v) => v.demoLocked)).toBe(true);
  });

  it('reports demoLocked false everywhere on the full game', () => {
    for (const v of getAllTechViews(boilerReady(), TECHNOLOGIES, null)) expect(v.demoLocked).toBe(false);
    for (const v of getAllTechViews(boilerReady())) expect(v.demoLocked).toBe(false);
  });
});

describe('evaluateMilestones with an era cap', () => {
  // Vessel Blueprint (era III) requires Relief Valves Lv 1, Condenser Lv 15 and 6M lifetime PR (WP28 REC: 5 x 3 parts).
  const vesselReady = (): GameState => {
    const s = withLevels({ reliefValves: 1, condenser: 15 });
    return { ...s, lifetime: { ...s.lifetime, pr: 6_000_000 } };
  };

  it('does not unlock an era-III milestone under the demo cap', () => {
    const out = evaluateMilestones(vesselReady(), TECHNOLOGIES, 2);
    expect(out.unlocked).not.toContain('pressureVesselBlueprint');
    expect(out.state.techLevels.pressureVesselBlueprint).toBe(0);
  });

  it('unlocks it on the full game', () => {
    expect(evaluateMilestones(vesselReady(), TECHNOLOGIES, null).unlocked).toContain('pressureVesselBlueprint');
    expect(evaluateMilestones(vesselReady()).unlocked).toContain('pressureVesselBlueprint');
  });
});
