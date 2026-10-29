import { describe, it, expect, afterEach } from 'vitest';
import {
  activePrompt,
  affordableBadge,
  anyPurchased,
  crankPromptVisible,
  eraCardFor,
  goalVisible,
  nextBuy,
  nextGoal,
  roundEta,
  techHintVisible,
} from './guidanceView';
import type { GuidancePrompt, TechHintInput } from './guidanceView';
import { setRevealed } from './revealRules';
import { createInitialState } from '../simulation/state';
import { emptyResourceMap } from '../simulation/resources';
import { TECHNOLOGIES } from '../data/technologies';
import { HUD_TEXT } from '../data/hud';
import { NEXT_BUY, NEXT_GOAL } from '../data/ux';
import { TECH_IDS } from '../data/types';
import type { GameState, ProductionRates, Requirement, ResourceMap, TechDefinition, TechId } from '../data/types';
import { costAt } from '../simulation/economy/cost';
import { getTechStatus } from '../simulation/progression/status';
import { formatDuration } from '../utils/format';

const RATES: ProductionRates = { perClick: emptyResourceMap(), perSecond: { ...emptyResourceMap(), me: 100 } };

/** Fresh state with the given tech levels, stock and lifetime totals. */
function stateOf(
  levels: Partial<Record<TechId, number>> = {},
  res: Partial<ResourceMap> = {},
  lifetime: Partial<ResourceMap> = {},
): GameState {
  const base = createInitialState(0);
  return {
    ...base,
    techLevels: { ...base.techLevels, ...levels },
    res: { ...base.res, ...res },
    lifetime: { ...base.lifetime, ...lifetime },
  };
}

/** Tech levels with every id in `ids` owned at level 1. */
function owned(ids: readonly TechId[]): Partial<Record<TechId, number>> {
  return Object.fromEntries(ids.map((id): [TechId, number] => [id, 1]));
}

const SEQUENCE = NEXT_GOAL.sequence;
const BEFORE_PRIMARY = SEQUENCE.slice(0, -1);
const BEFORE_PRESSURE_VESSEL = SEQUENCE.slice(0, SEQUENCE.indexOf('pressureVesselBlueprint'));

describe('nextGoal', () => {
  afterEach(() => {
    setRevealed(false);
  });

  it('starts on the generator blueprint, gated by piston array', () => {
    expect(nextGoal(stateOf(), RATES)).toEqual({
      id: 'generatorBlueprint',
      title: 'NEXT: GENERATOR BLUEPRINT',
      detail: 'NEEDS PISTON ARRAY',
      ready: false,
      progress: 0,
    });
  });

  it('shows lifetime progress and an ETA from the per-second rate', () => {
    const s = stateOf(owned(['pistonArray', 'flywheel']), { me: 68000 }, { me: 68000 });
    expect(nextGoal(s, RATES)).toEqual({
      id: 'generatorBlueprint',
      title: 'NEXT: GENERATOR BLUEPRINT',
      detail: '68K / 400K LIFETIME ME · ~55m 20s',
      ready: false,
      progress: 68000 / 400000,
    });
  });

  it('drops the ETA when no per-second rate feeds the resource', () => {
    const s = stateOf(owned(['pistonArray', 'flywheel']), { me: 68000 }, { me: 68000 });
    expect(nextGoal(s, { ...RATES, perSecond: emptyResourceMap() })?.detail).toBe('68K / 400K LIFETIME ME');
  });

  it('reads READY once the generator is affordable', () => {
    const s = stateOf(owned(['generatorBlueprint']), { me: 60000 }, { me: 60000 });
    expect(nextGoal(s, RATES)).toEqual({
      id: 'generator',
      title: 'NEXT: GENERATOR',
      detail: 'READY — OPEN TECH INDEX [T]',
      ready: true,
      progress: 1,
    });
  });

  it('shows stock against cost and an ETA while the generator is still short', () => {
    const s = stateOf(owned(['generatorBlueprint']), { me: 5000 });
    expect(nextGoal(s, { ...RATES, perSecond: { ...emptyResourceMap(), me: 50 } })).toEqual({
      id: 'generator',
      title: 'NEXT: GENERATOR',
      detail: '5K / 60K ME · ~18m 20s',
      ready: false,
      progress: 5000 / 60000,
    });
  });

  it('names a repeatable requirement with its level in uppercase', () => {
    const s = stateOf({ ...owned(BEFORE_PRESSURE_VESSEL), reliefValves: 1, condenser: 4 });
    expect(nextGoal(s, RATES)).toEqual({
      id: 'pressureVesselBlueprint',
      title: 'NEXT: VESSEL BLUEPRINT',
      detail: 'NEEDS CONDENSER LV 15',
      ready: false,
      progress: 0,
    });
  });

  it('ends on primary function: unknown flux until the reveal, then RF', () => {
    const s = stateOf(owned(BEFORE_PRIMARY));
    expect(nextGoal(s, RATES)?.id).toBe('primaryFunction');
    expect(nextGoal(s, RATES)?.detail).toBe('0 / 500M ???');
    setRevealed(true);
    expect(nextGoal(s, RATES)?.detail).toBe('0 / 500M RF');
  });

  it('does not read READY for an unlock whose lifetime gate is still short', () => {
    const techs: Record<TechId, TechDefinition> = {
      ...TECHNOLOGIES,
      generator: { ...TECHNOLOGIES.generator, requires: [{ type: 'lifetime', res: 'me', amount: 1e6 }] },
    };
    const s = stateOf(owned(['generatorBlueprint']), { me: 25000 }, { me: 25000 });
    const goal = nextGoal(s, RATES, techs);
    expect(goal?.ready).toBe(false);
    expect(goal?.detail).toBe('25K / 1M LIFETIME ME · ~2h 42m');
  });

  it('is null during the finale and once every goal is owned', () => {
    expect(nextGoal({ ...stateOf(), ending: { phase: 'sequence', engagedAt: null } }, RATES)).toBeNull();
    expect(nextGoal(stateOf(owned(SEQUENCE)), RATES)).toBeNull();
  });

  describe('demo era cap (WP21)', () => {
    const ERA_TWO_CHAIN: TechId[] = ['generatorBlueprint', 'generator', 'substationBlueprint'];

    it('ends the chain at the cap tech when the cap is era 2', () => {
      expect(nextGoal(stateOf(owned(ERA_TWO_CHAIN)), RATES, TECHNOLOGIES, 2)).toBeNull();
      expect(nextGoal(stateOf(owned(['generatorBlueprint'])), RATES, TECHNOLOGIES, 2)?.id).toBe('generator');
    });

    it('points at the boiler without a cap once the era II chain is owned', () => {
      expect(nextGoal(stateOf(owned(ERA_TWO_CHAIN)), RATES)?.id).toBe('boiler');
    });

    it('never names an era above the cap for any prefix of the chain', () => {
      for (let done = 0; done <= SEQUENCE.length; done += 1) {
        const goal = nextGoal(stateOf(owned(SEQUENCE.slice(0, done))), RATES, TECHNOLOGIES, 2);
        if (goal !== null) expect(TECHNOLOGIES[goal.id].era).toBeLessThanOrEqual(2);
      }
    });
  });
});

describe('techHintVisible', () => {
  const BASE: TechHintInput = { totalClicks: 1, anyPurchased: false, affordable: 1, phase: 'none', treeOpen: false, cycle: 1 };
  const FLIPS: [string, Partial<TechHintInput>][] = [
    ['no click yet', { totalClicks: 0 }],
    ['something already bought', { anyPurchased: true }],
    ['nothing affordable', { affordable: 0 }],
    ['finale choice open', { phase: 'choice' }],
    ['tech index open', { treeOpen: true }],
    ['second cycle', { cycle: 2 }],
  ];

  it('is visible in the base case', () => {
    expect(techHintVisible(BASE)).toBe(true);
  });

  it.each(FLIPS)('hides when %s', (_name, patch) => {
    expect(techHintVisible({ ...BASE, ...patch })).toBe(false);
  });
});

describe('visibility and counts', () => {
  it('shows the goal line only after a purchase and outside the finale', () => {
    expect(goalVisible(true, 'none')).toBe(true);
    expect(goalVisible(false, 'none')).toBe(false);
    expect(goalVisible(true, 'sequence')).toBe(false);
  });

  it('shows the crank prompt until the first click', () => {
    expect(crankPromptVisible(0)).toBe(true);
    expect(crankPromptVisible(1)).toBe(false);
  });

  it('ignores the starting crank when asking for a purchase', () => {
    const fresh = createInitialState(0).techLevels;
    expect(anyPurchased(fresh)).toBe(false);
    expect(anyPurchased({ ...fresh, handCrank: 1 })).toBe(false);
    expect(anyPurchased({ ...fresh, wornMotor: 1 })).toBe(true);
  });

  it('labels the badge and caps the shown count at 99+', () => {
    expect(affordableBadge(0)).toEqual({ text: '', aria: 'TECH INDEX' });
    expect(affordableBadge(1)).toEqual({ text: '1', aria: 'TECH INDEX, 1 affordable' });
    expect(affordableBadge(99)).toEqual({ text: '99', aria: 'TECH INDEX, 99 affordable' });
    expect(affordableBadge(100)).toEqual({ text: '99+', aria: 'TECH INDEX, 100 affordable' });
  });
});

describe('eraCardFor', () => {
  afterEach(() => {
    setRevealed(false);
  });

  it('maps each era keystone to its card', () => {
    expect(eraCardFor('generator', 'none')).toEqual({
      era: 2, title: HUD_TEXT.eraTitles[1], subtitle: 'NEW SIGNAL: ELECTRICAL ENERGY (EE)',
    });
    expect(eraCardFor('boiler', 'none')).toEqual({
      era: 3, title: HUD_TEXT.eraTitles[2], subtitle: 'NEW SIGNAL: PRESSURE (PR)',
    });
    expect(eraCardFor('resonatorSpire', 'none')).toEqual({
      era: 4, title: HUD_TEXT.eraTitles[3], subtitle: 'NEW SIGNAL: RESONANCE (RS)',
    });
    expect(eraCardFor('nullChamber', 'none')).toEqual({
      era: 5, title: HUD_TEXT.eraTitles[4], subtitle: 'NEW SIGNAL: UNKNOWN FLUX (???)',
    });
  });

  it('shows RF for the era V signal once revealed', () => {
    setRevealed(true);
    expect(eraCardFor('nullChamber', 'none')?.subtitle).toBe('NEW SIGNAL: UNKNOWN FLUX (RF)');
  });

  it('is null for non-keystones and for primary function', () => {
    expect(eraCardFor('primaryFunction', 'none')).toBeNull();
    expect(eraCardFor('pistonArray', 'none')).toBeNull();
  });

  it('is null in every finale phase', () => {
    for (const phase of ['sequence', 'choice', 'postgame'] as const) {
      expect(eraCardFor('generator', phase)).toBeNull();
    }
  });
});

describe('activePrompt', () => {
  const BASE: TechHintInput = { totalClicks: 1, anyPurchased: false, affordable: 1, phase: 'none', treeOpen: false, cycle: 1 };
  const ROWS: [string, Partial<TechHintInput>, GuidancePrompt | null][] = [
    ['no click yet shows the crank prompt', { totalClicks: 0 }, 'crank'],
    ['Muscle Memory start on a new cycle shows the crank prompt', { totalClicks: 0, anyPurchased: true, cycle: 2 }, 'crank'],
    ['the base case shows the TECH INDEX hint', {}, 'hint'],
    ['nothing affordable shows no prompt', { affordable: 0 }, null],
    ['a purchase shows the goal line', { anyPurchased: true }, 'goal'],
    ['an open TECH INDEX shows no prompt', { treeOpen: true }, null],
    ['an open TECH INDEX still shows the goal line after a purchase', { treeOpen: true, anyPurchased: true }, 'goal'],
    ['the second cycle shows no prompt before a purchase', { cycle: 2 }, null],
    ['the second cycle shows the goal line after a purchase', { cycle: 2, anyPurchased: true }, 'goal'],
    ['the finale choice shows no prompt', { phase: 'choice', anyPurchased: true }, null],
    ['the finale postgame shows no prompt', { phase: 'postgame', anyPurchased: true }, null],
    ['the finale sequence shows no prompt, even before the first click', { phase: 'sequence', totalClicks: 0 }, null],
  ];

  it.each(ROWS)('%s', (_name, patch, expected) => {
    expect(activePrompt({ ...BASE, ...patch })).toBe(expected);
  });

  it('never shows a prompt its own rule forbids, for every input combination', () => {
    let combos = 0;
    for (const totalClicks of [0, 3]) {
      for (const anyPurchased of [false, true]) {
        for (const affordable of [0, 2]) {
          for (const phase of ['none', 'choice'] as const) {
            for (const treeOpen of [false, true]) {
              for (const cycle of [1, 2]) {
                combos += 1;
                const i: TechHintInput = { totalClicks, anyPurchased, affordable, phase, treeOpen, cycle };
                const p = activePrompt(i);
                if (p === 'crank') {
                  expect(crankPromptVisible(i.totalClicks) && i.phase === 'none').toBe(true);
                } else if (p === 'hint') {
                  expect(techHintVisible(i)).toBe(true);
                } else if (p === 'goal') {
                  expect(goalVisible(i.anyPurchased, i.phase) && !crankPromptVisible(i.totalClicks)).toBe(true);
                } else {
                  expect(
                    i.phase !== 'none'
                      || (!crankPromptVisible(i.totalClicks) && !techHintVisible(i) && !goalVisible(i.anyPurchased, i.phase)),
                  ).toBe(true);
                }
              }
            }
          }
        }
      }
    }
    expect(combos).toBe(64);
  });
});

// WP28 A9: NEXT BUY. Every tech is locked behind an unreachable lifetime gate unless the table opens it here.
type Open = Partial<Pick<TechDefinition, 'baseCost' | 'costRes' | 'requires' | 'kind' | 'era' | 'maxLevel'>>;

function tableWith(open: Partial<Record<TechId, Open>>): Record<TechId, TechDefinition> {
  const locked: Requirement[] = [{ type: 'lifetime', res: 'me', amount: 1e300 }];
  return Object.fromEntries(
    TECH_IDS.map((id): [TechId, TechDefinition] => [id, { ...TECHNOLOGIES[id], requires: locked, ...open[id] }]),
  ) as Record<TechId, TechDefinition>;
}

/** Rates with `rate` per second on every resource (or only ME when the map is partial). */
function ratesOf(me: number, others: number = 0): ProductionRates {
  return { perClick: emptyResourceMap(), perSecond: { me, ee: others, pr: others, rs: others, xf: others } };
}

describe('roundEta (WP28 A9)', () => {
  it.each([
    [0, 0],
    [3, 5],
    [5, 5],
    [57, 60],
    [60, 60],
    [61, 70],
    [599, 600],
    [600, 600],
    [601, 660],
  ])('rounds %d s up to %d s', (seconds, rounded) => {
    expect(roundEta(seconds)).toBe(rounded);
  });

  it('never rounds down, even for a value just above a step', () => {
    for (let s = 0.5; s < 1500; s += 0.5) expect(roundEta(s)).toBeGreaterThanOrEqual(s);
  });
});

describe('nextBuy (WP28 A9)', () => {
  it('picks the smallest eta and names it in upper case with the rounded time', () => {
    const techs = tableWith({ gearRatio: { requires: [] }, motorTuning: { requires: [] } });
    // gearRatio costs 15 (eta 3 s at 5/s), motorTuning 60 (eta 12 s).
    expect(nextBuy(stateOf(), ratesOf(5), techs)).toEqual({
      id: 'gearRatio',
      text: `${NEXT_BUY.prefix}GEAR RATIO${NEXT_BUY.sep}${NEXT_BUY.etaPrefix}5s`,
      etaSeconds: 3,
    });
  });

  it('prefers the cheaper of two when it is the smaller eta', () => {
    const techs = tableWith({ gearRatio: { requires: [] }, motorTuning: { requires: [], baseCost: 10 } });
    expect(nextBuy(stateOf(), ratesOf(5), techs)?.id).toBe('motorTuning');
  });

  it('breaks ties by TECH_IDS order', () => {
    const techs = tableWith({ gearRatio: { requires: [], baseCost: 15 }, motorTuning: { requires: [], baseCost: 15 } });
    expect(TECH_IDS.indexOf('gearRatio')).toBeLessThan(TECH_IDS.indexOf('motorTuning'));
    expect(nextBuy(stateOf(), ratesOf(5), techs)?.id).toBe('gearRatio');
  });

  it('includes Splices (an unlock with a lifetime gate)', () => {
    const techs = tableWith({
      spliceBicycle: { requires: [{ type: 'lifetime', res: 'me', amount: 15000 }] },
    });
    const s = stateOf({}, {}, { me: 15000 });
    expect(nextBuy(s, ratesOf(9), techs)).toEqual({
      id: 'spliceBicycle',
      text: `${NEXT_BUY.prefix}BICYCLE${NEXT_BUY.sep}${NEXT_BUY.etaPrefix}1m 40s`,
      etaSeconds: 100,
    });
    expect(nextBuy(stateOf({}, {}, { me: 14999 }), ratesOf(9), techs)).toBeNull();
  });

  it('is null while any available purchase is affordable', () => {
    const techs = tableWith({ gearRatio: { requires: [] }, motorTuning: { requires: [] } });
    expect(nextBuy(stateOf({}, { me: 15 }), ratesOf(5), techs)).toBeNull();
    expect(nextBuy(stateOf({}, { me: 60 }), ratesOf(5), techs)).toBeNull();
  });

  it('is null during the finale', () => {
    const techs = tableWith({ gearRatio: { requires: [] } });
    const s = { ...stateOf(), ending: { phase: 'sequence' as const, engagedAt: null } };
    expect(nextBuy(s, ratesOf(5), techs)).toBeNull();
  });

  it('is null when no income feeds the cost resource, and when every eta is infinite', () => {
    const techs = tableWith({ gearRatio: { requires: [] }, motorTuning: { requires: [] } });
    expect(nextBuy(stateOf(), ratesOf(0), techs)).toBeNull();
    expect(nextBuy(stateOf(), ratesOf(0, 4), techs)).toBeNull();
  });

  it('never offers the starting crank or a milestone', () => {
    const techs = tableWith({ handCrank: { requires: [] }, generatorBlueprint: { requires: [] } });
    expect(nextBuy(stateOf(), ratesOf(5), techs)).toBeNull();
  });

  it('offers an owned repeatable at its next level cost, and never a maxed one', () => {
    const techs = tableWith({ gearRatio: { requires: [] } });
    // Level 2 costs ceil(15 * 1.3^2) = 26; 26 / 2 per second = 13 s, rounded to 15 s.
    expect(nextBuy(stateOf({ gearRatio: 2 }), ratesOf(2), techs)).toEqual({
      id: 'gearRatio',
      text: `${NEXT_BUY.prefix}GEAR RATIO${NEXT_BUY.sep}${NEXT_BUY.etaPrefix}15s`,
      etaSeconds: 13,
    });
    expect(nextBuy(stateOf({ gearRatio: 15 }), ratesOf(2), techs)).toBeNull();
  });

  it('respects the demo era cap', () => {
    const techs = tableWith({ spliceBicycle: { requires: [], era: 3 } });
    expect(nextBuy(stateOf(), ratesOf(5), techs, 2)).toBeNull();
    expect(nextBuy(stateOf(), ratesOf(5), techs, null)?.id).toBe('spliceBicycle');
  });

  it.each([
    ['5s', 3, 1],
    ['1m 10s', 61, 1],
    ['11m', 601, 1],
  ])('formats a short wait as ~%s', (formatted, cost, rate) => {
    const techs = tableWith({ gearRatio: { requires: [], baseCost: cost } });
    const view = nextBuy(stateOf(), ratesOf(rate), techs);
    expect(view?.text).toBe(`${NEXT_BUY.prefix}GEAR RATIO${NEXT_BUY.sep}${NEXT_BUY.etaPrefix}${formatted}`);
    expect(view?.text).toBe(`${NEXT_BUY.prefix}GEAR RATIO${NEXT_BUY.sep}~${formatDuration(roundEta(cost / rate))}`);
  });

  it('agrees with getTechStatus: only available unlocks and repeatables compete, the cheapest cost wins', () => {
    const states: GameState[] = [
      stateOf({ handCrank: 1 }),
      stateOf({ handCrank: 1, gearRatio: 3, wornMotor: 1 }, {}, { me: 20000 }),
      stateOf({ handCrank: 1, wornMotor: 1, motorTuning: 25 }, {}, { me: 200000 }),
      stateOf(owned(BEFORE_PRIMARY)),
    ];
    // Stock 0 and one per second on every resource: the eta equals the price, so the cheapest available wins.
    const rates = { perClick: emptyResourceMap(), perSecond: { me: 1, ee: 1, pr: 1, rs: 1, xf: 1 } };
    for (const cap of [null, 2] as const) {
      for (const s of states) {
        const available = TECH_IDS.filter((id) => {
          const def = TECHNOLOGIES[id];
          const isPurchase = def.kind === 'unlock' || def.kind === 'repeatable';
          return isPurchase && getTechStatus(s, id, TECHNOLOGIES, cap) === 'available';
        });
        const prices = available.map((id) => costAt(TECHNOLOGIES[id], s.techLevels[id]));
        const cheapest = prices.length === 0 ? null : Math.min(...prices);
        const view = nextBuy(s, rates, TECHNOLOGIES, cap);
        if (cheapest === null) {
          expect(view).toBeNull();
        } else {
          const firstId = available.find((id) => costAt(TECHNOLOGIES[id], s.techLevels[id]) === cheapest);
          expect(view?.id).toBe(firstId);
          expect(view?.etaSeconds).toBe(cheapest);
        }
      }
    }
  });
});
