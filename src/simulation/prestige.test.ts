import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { EndingState, GameState, PrestigeState, TechDefinition, TechId } from '../data/types';
import { PERK_IDS, ECHO_RULES } from '../data/prestige';
import type { PerkId } from '../data/prestige';
import { TECHNOLOGIES } from '../data/technologies';
import { OFFLINE_CAP_SECONDS } from '../data/balance';
import { createInitialState } from './state';
import { emptyResourceMap } from './resources';
import { computeRates } from './production/rates';
import { offlineCapSeconds } from './production/tick';
import {
  DEFAULT_PRESTIGE,
  applyStartLevels,
  buyPerk,
  cycleLabel,
  cyclePreview,
  cycleTechs,
  echoMultiplier,
  echoesForCycle,
  newCycleState,
  normalizePrestige,
  perkStatus,
  spentEchoes,
  unspentEchoes,
} from './prestige';

const prestige = (cycle: number, echoesEarned: number, perks: PerkId[] = []): PrestigeState => ({
  cycle,
  echoesEarned,
  perks,
});

const ALL_PERKS: PerkId[] = [...PERK_IDS];

const withLevels = (levels: Partial<Record<TechId, number>>): GameState => {
  const s = createInitialState(0);
  return { ...s, techLevels: { ...s.techLevels, ...levels } };
};

const withXf = (xf: number, ending: EndingState = { phase: 'none', engagedAt: null }) => ({
  lifetime: { ...emptyResourceMap(), xf },
  ending,
});

const revealed: EndingState = { phase: 'choice', engagedAt: 0 };

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

describe('DEFAULT_PRESTIGE', () => {
  it('is cycle 1, no Echoes, no perks', () => {
    expect(DEFAULT_PRESTIGE).toEqual({ cycle: 1, echoesEarned: 0, perks: [] });
  });
});

describe('echoesForCycle', () => {
  it('grants base 3 below the first threshold', () => {
    expect(echoesForCycle(5.36e8)).toBe(3);
    expect(echoesForCycle(0)).toBe(3);
  });

  it('adds one per reached threshold (<=)', () => {
    expect(echoesForCycle(2e9)).toBe(4);
    expect(echoesForCycle(8e9)).toBe(5);
    expect(echoesForCycle(3.2e10)).toBe(6);
    expect(echoesForCycle(1e12)).toBe(6);
  });

  it('non-finite or negative xf counts as base', () => {
    expect(echoesForCycle(NaN)).toBe(3);
    expect(echoesForCycle(Infinity)).toBe(3);
    expect(echoesForCycle(-5)).toBe(3);
  });
});

describe('echoMultiplier', () => {
  it('is 1 with no Echoes', () => {
    expect(echoMultiplier(DEFAULT_PRESTIGE)).toBe(1);
  });

  it('is 1 + 15 % per earned Echo', () => {
    expect(echoMultiplier(prestige(2, 3))).toBeCloseTo(1.45, 9);
  });

  it('caps the counted Echoes at 30', () => {
    expect(echoMultiplier(prestige(3, 40))).toBeCloseTo(5.5, 9);
    expect(echoMultiplier(prestige(3, 30))).toBeCloseTo(5.5, 9);
  });

  it('uses the given rules', () => {
    const rules = { base: 3, bonusAtXf: [], allPctPerEcho: 10, maxCountedEchoes: 5 };
    expect(echoMultiplier(prestige(2, 9), rules)).toBeCloseTo(1.5, 9);
  });
});

describe('spent / unspent Echoes', () => {
  it('default has nothing spent or unspent', () => {
    expect(spentEchoes(DEFAULT_PRESTIGE)).toBe(0);
    expect(unspentEchoes(DEFAULT_PRESTIGE)).toBe(0);
  });

  it('sums perk costs', () => {
    expect(spentEchoes(prestige(2, 3, ['residualCharge']))).toBe(2);
    expect(unspentEchoes(prestige(2, 3, ['residualCharge']))).toBe(1);
  });

  it('all perks cost 11 in total', () => {
    expect(spentEchoes(prestige(3, 11, ALL_PERKS))).toBe(11);
    expect(unspentEchoes(prestige(3, 11, ALL_PERKS))).toBe(0);
  });
});

describe('perkStatus', () => {
  it('owned perks are owned', () => {
    expect(perkStatus(prestige(2, 3, ['muscleMemory']), 'muscleMemory')).toBe('owned');
  });

  it('affordable when unspent >= cost, locked otherwise', () => {
    const p3 = prestige(2, 3);
    expect(perkStatus(p3, 'muscleMemory')).toBe('affordable');
    expect(perkStatus(p3, 'servoRecall')).toBe('affordable');
    const p2 = prestige(2, 2);
    expect(perkStatus(p2, 'residualCharge')).toBe('affordable');
    expect(perkStatus(p2, 'servoRecall')).toBe('locked');
    expect(perkStatus(p2, 'ledger')).toBe('locked');
  });
});

describe('buyPerk', () => {
  it('buys an affordable perk', () => {
    const r = buyPerk(prestige(2, 3), 'muscleMemory');
    expect(r).toEqual({ ok: true, prestige: prestige(2, 3, ['muscleMemory']) });
  });

  it('fails as owned when already held', () => {
    expect(buyPerk(prestige(2, 3, ['muscleMemory']), 'muscleMemory')).toEqual({ ok: false, reason: 'owned' });
  });

  it('fails as insufficient when unspent < cost', () => {
    expect(buyPerk(prestige(2, 2), 'servoRecall')).toEqual({ ok: false, reason: 'insufficient' });
    expect(buyPerk(prestige(2, 2, ['residualCharge']), 'muscleMemory')).toEqual({ ok: false, reason: 'insufficient' });
  });

  it('keeps perks in PERK_IDS order', () => {
    const first = buyPerk(prestige(2, 5), 'ledger');
    if (!first.ok) throw new Error('expected ok');
    const second = buyPerk(first.prestige, 'muscleMemory');
    expect(second).toEqual({ ok: true, prestige: prestige(2, 5, ['muscleMemory', 'ledger']) });
  });

  it('never mutates its input', () => {
    const input = deepFreeze(prestige(2, 3, ['residualCharge']));
    const r = buyPerk(input, 'muscleMemory');
    expect(r).toEqual({ ok: true, prestige: prestige(2, 3, ['muscleMemory', 'residualCharge']) });
    expect(input.perks).toEqual(['residualCharge']);
  });
});

describe('cycleTechs', () => {
  it('returns the base table itself for default prestige', () => {
    expect(cycleTechs(TECHNOLOGIES, DEFAULT_PRESTIGE)).toBe(TECHNOLOGIES);
  });

  it('never mutates the base table (deep-frozen copy)', () => {
    const base = deepFreeze(structuredClone(TECHNOLOGIES));
    const snapshot = JSON.stringify(base);
    const out = cycleTechs(base, prestige(3, 11, ALL_PERKS));
    expect(out).not.toBe(base);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('copies only changed defs, keeping the rest by reference', () => {
    const out = cycleTechs(TECHNOLOGIES, prestige(2, 2, ['residualCharge']));
    expect(out).not.toBe(TECHNOLOGIES);
    expect(out.gearRatio).toBe(TECHNOLOGIES.gearRatio);
    expect(out.flywheel).toBe(TECHNOLOGIES.flywheel);
  });

  it('adds the Echo multiplier as rateMult all on handCrank', () => {
    const out = cycleTechs(TECHNOLOGIES, prestige(2, 3));
    const hc = out.handCrank;
    expect(hc.effects.slice(0, 1)).toEqual(TECHNOLOGIES.handCrank.effects);
    expect(hc.effects).toHaveLength(2);
    const extra = hc.effects[1];
    expect(extra?.type).toBe('rateMult');
    if (extra?.type !== 'rateMult') throw new Error('expected rateMult');
    expect(extra.res).toBe('all');
    expect(extra.factor).toBeCloseTo(1.45, 9);
  });

  it('adds exactly the expected extra effects for all perks', () => {
    const out = cycleTechs(TECHNOLOGIES, prestige(3, 11, ALL_PERKS));
    const effects = out.handCrank.effects;
    expect(effects).toHaveLength(4);
    expect(effects[0]).toEqual({ type: 'clickAdd', amount: 1 });
    expect(effects[1]).toMatchObject({ type: 'rateMult', res: 'all' });
    expect(effects[2]).toEqual({ type: 'offlineHours', hours: 4 });
    expect(effects[3]).toEqual({ type: 'autoClick', perSecond: 1 });
    if (effects[1]?.type !== 'rateMult') throw new Error('expected rateMult');
    expect(effects[1].factor).toBeCloseTo(2.65, 9);
  });

  it('residual charge multiplies every convert amount by 1.5', () => {
    const out = cycleTechs(TECHNOLOGIES, prestige(2, 2, ['residualCharge']));
    let converts = 0;
    for (const id of TECH_IDS) {
      const before = TECHNOLOGIES[id].effects.filter((e) => e.type === 'convert');
      const after = out[id].effects.filter((e) => e.type === 'convert');
      expect(after).toHaveLength(before.length);
      before.forEach((b, i) => {
        const a = after[i];
        if (b.type !== 'convert' || a?.type !== 'convert') throw new Error('expected convert');
        expect(a.amount).toBeCloseTo(b.amount * 1.5, 9);
        expect(a.res).toBe(b.res);
        converts += 1;
      });
    }
    expect(converts).toBeGreaterThan(0);
  });

  it('ledger halves exactly the four keystone converters baseCost', () => {
    const out = cycleTechs(TECHNOLOGIES, prestige(2, 3, ['ledger']));
    const halved: TechId[] = [];
    for (const id of TECH_IDS) {
      if (out[id].baseCost !== TECHNOLOGIES[id].baseCost) halved.push(id);
    }
    expect([...halved].sort()).toEqual(['boiler', 'generator', 'nullChamber', 'resonatorSpire']);
    for (const id of halved) {
      expect(out[id].baseCost).toBeCloseTo(TECHNOLOGIES[id].baseCost * 0.5, 9);
    }
  });

  it('ledger lowers the generator next cost', () => {
    const out = cycleTechs(TECHNOLOGIES, prestige(2, 3, ['ledger']));
    expect(out.generator.baseCost).toBeCloseTo(TECHNOLOGIES.generator.baseCost / 2, 9);
    expect(out.gearRatio).toBe(TECHNOLOGIES.gearRatio);
  });

  it('keeps every other def field unchanged on a changed def', () => {
    const out: Record<TechId, TechDefinition> = cycleTechs(TECHNOLOGIES, prestige(2, 3, ['ledger']));
    const before = TECHNOLOGIES.generator;
    expect(out.generator).toEqual({ ...before, baseCost: before.baseCost * 0.5 });
  });
});

describe('computeRates with cycleTechs', () => {
  const eraOne = withLevels({ wornMotor: 1 });

  it('multiplies every per-second rate by the Echo multiplier', () => {
    const base = computeRates(eraOne, TECHNOLOGIES);
    const techs = cycleTechs(TECHNOLOGIES, prestige(2, 3));
    const boosted = computeRates(eraOne, techs);
    expect(base.perSecond.me).toBeCloseTo(17, 9);
    for (const r of ['me', 'ee', 'pr', 'rs', 'xf'] as const) {
      expect(boosted.perSecond[r]).toBeCloseTo(base.perSecond[r] * 1.45, 9);
    }
    expect(boosted.perClick.me).toBeCloseTo(base.perClick.me, 9);
  });

  it('servo recall adds one auto click per second (perClick)', () => {
    const withoutServo = computeRates(eraOne, cycleTechs(TECHNOLOGIES, prestige(2, 3)));
    const withServo = computeRates(eraOne, cycleTechs(TECHNOLOGIES, prestige(2, 3, ['servoRecall'])));
    expect(withServo.perSecond.me - withoutServo.perSecond.me).toBeCloseTo(withoutServo.perClick.me, 9);
  });

  it('long silence raises the offline cap by four hours', () => {
    const techs = cycleTechs(TECHNOLOGIES, prestige(2, 2, ['longSilence']));
    expect(offlineCapSeconds(eraOne.techLevels, techs)).toBe(OFFLINE_CAP_SECONDS + 4 * 3600);
    expect(offlineCapSeconds(eraOne.techLevels, TECHNOLOGIES)).toBe(OFFLINE_CAP_SECONDS);
  });
});

describe('applyStartLevels', () => {
  it('raises levels to the start levels of owned perks', () => {
    const s = createInitialState(0);
    const out = applyStartLevels(s, prestige(2, 1, ['muscleMemory']));
    expect(out.techLevels.wornMotor).toBe(1);
    expect(out.techLevels.gearRatio).toBe(3);
    expect(out.techLevels.handCrank).toBe(1);
    expect(out).not.toBe(s);
    expect(s.techLevels.gearRatio).toBe(0);
  });

  it('never lowers a level', () => {
    const s = withLevels({ gearRatio: 9 });
    const out = applyStartLevels(s, prestige(2, 1, ['muscleMemory']));
    expect(out.techLevels.gearRatio).toBe(9);
  });

  it('returns the same object when nothing changes', () => {
    const s = withLevels({ wornMotor: 1, gearRatio: 3 });
    expect(applyStartLevels(s, prestige(2, 1, ['muscleMemory']))).toBe(s);
    expect(applyStartLevels(s, DEFAULT_PRESTIGE)).toBe(s);
  });
});

describe('newCycleState', () => {
  it('equals the initial state with default prestige', () => {
    expect(newCycleState(1000, DEFAULT_PRESTIGE)).toEqual(createInitialState(1000));
  });

  it('applies the start levels of owned perks', () => {
    const s = newCycleState(1000, prestige(2, 1, ['muscleMemory']));
    expect(s.createdAt).toBe(1000);
    expect(s.lastSimTime).toBe(1000);
    expect(s.techLevels.wornMotor).toBe(1);
    expect(s.techLevels.gearRatio).toBe(3);
    expect(s.res.me).toBe(0);
    expect(s.ending).toEqual({ phase: 'none', engagedAt: null });
  });
});

describe('cycleLabel', () => {
  it('cycle 1 is CYCLE 0042, cycle 2 is CYCLE 0043', () => {
    expect(cycleLabel(1)).toBe('CYCLE 0042');
    expect(cycleLabel(2)).toBe('CYCLE 0043');
    expect(cycleLabel(3)).toBe('CYCLE 0044');
  });
});

describe('normalizePrestige', () => {
  it('missing, non-object or array input -> default', () => {
    const d = { cycle: 1, echoesEarned: 0, perks: [] };
    expect(normalizePrestige(undefined)).toEqual(d);
    expect(normalizePrestige(null)).toEqual(d);
    expect(normalizePrestige('CYCLE 2')).toEqual(d);
    expect(normalizePrestige(7)).toEqual(d);
    expect(normalizePrestige([])).toEqual(d);
  });

  it('valid input round-trips', () => {
    const p = prestige(2, 11, ALL_PERKS);
    expect(normalizePrestige(p)).toEqual(p);
  });

  it('returns a fresh perks array (no shared reference)', () => {
    const out = normalizePrestige(undefined);
    expect(out.perks).not.toBe(DEFAULT_PRESTIGE.perks);
  });

  it('cycle must be an integer >= 1, else 1', () => {
    expect(normalizePrestige({ cycle: 0 }).cycle).toBe(1);
    expect(normalizePrestige({ cycle: -3 }).cycle).toBe(1);
    expect(normalizePrestige({ cycle: 2.5 }).cycle).toBe(1);
    expect(normalizePrestige({ cycle: '2' }).cycle).toBe(1);
    expect(normalizePrestige({ cycle: NaN }).cycle).toBe(1);
    expect(normalizePrestige({ cycle: 4 }).cycle).toBe(4);
  });

  it('echoesEarned must be an integer >= 0, else 0', () => {
    expect(normalizePrestige({ echoesEarned: -1 }).echoesEarned).toBe(0);
    expect(normalizePrestige({ echoesEarned: 3.7 }).echoesEarned).toBe(0);
    expect(normalizePrestige({ echoesEarned: 'x' }).echoesEarned).toBe(0);
    expect(normalizePrestige({ echoesEarned: Infinity }).echoesEarned).toBe(0);
    expect(normalizePrestige({ echoesEarned: 6 }).echoesEarned).toBe(6);
  });

  it('non-array perks -> none', () => {
    expect(normalizePrestige({ echoesEarned: 3, perks: 'muscleMemory' }).perks).toEqual([]);
  });

  it('drops unknown and duplicate perks', () => {
    expect(normalizePrestige({ echoesEarned: 3, perks: ['bogus', 'ledger', 'ledger'] }).perks).toEqual(['ledger']);
  });

  it('orders perks by PERK_IDS', () => {
    expect(normalizePrestige({ echoesEarned: 4, perks: ['ledger', 'muscleMemory'] }).perks).toEqual([
      'muscleMemory',
      'ledger',
    ]);
  });

  it('while spent > earned drops the last perk', () => {
    expect(
      normalizePrestige({ echoesEarned: 3, perks: ['muscleMemory', 'residualCharge', 'longSilence'] }).perks,
    ).toEqual(['muscleMemory', 'residualCharge']);
    expect(normalizePrestige({ echoesEarned: 1, perks: ['muscleMemory', 'residualCharge'] }).perks).toEqual([
      'muscleMemory',
    ]);
    expect(normalizePrestige({ echoesEarned: 0, perks: ['muscleMemory'] }).perks).toEqual([]);
  });

  it('never throws on hostile input', () => {
    const hostile = { cycle: {}, echoesEarned: [], perks: [null, 1, { id: 'ledger' }] };
    expect(normalizePrestige(hostile)).toEqual({ cycle: 1, echoesEarned: 0, perks: [] });
  });
});

describe('cyclePreview', () => {
  it('not allowed before the reveal', () => {
    const preview = cyclePreview(withXf(5.36e8), DEFAULT_PRESTIGE);
    expect(preview.allowed).toBe(false);
    expect(preview.nextCycle).toBe(2);
    expect(preview.label).toBe('CYCLE 0043');
    expect(preview.echoesGained).toBe(3);
  });

  it('not allowed while the sequence plays', () => {
    const preview = cyclePreview(withXf(5.36e8, { phase: 'sequence', engagedAt: 0 }), DEFAULT_PRESTIGE);
    expect(preview.allowed).toBe(false);
  });

  it('allowed on the choice and postgame phases', () => {
    expect(cyclePreview(withXf(5.36e8, revealed), DEFAULT_PRESTIGE).allowed).toBe(true);
    expect(cyclePreview(withXf(5.36e8, { phase: 'postgame', engagedAt: 0 }), DEFAULT_PRESTIGE).allowed).toBe(true);
  });

  it('default run: 3 Echoes, +45 % all per second, next threshold 2e9', () => {
    const preview = cyclePreview(withXf(5.36e8, revealed), DEFAULT_PRESTIGE);
    expect(preview).toEqual({
      allowed: true,
      nextCycle: 2,
      label: 'CYCLE 0043',
      echoesGained: 3,
      echoesAfter: 3,
      bonusPctAfter: 45,
      nextBonusXf: 2e9,
    });
  });

  it('adds the earned Echoes to the total', () => {
    const preview = cyclePreview(withXf(3.2e10, revealed), prestige(2, 3, ['residualCharge']));
    expect(preview.echoesGained).toBe(6);
    expect(preview.echoesAfter).toBe(9);
    expect(preview.bonusPctAfter).toBe(ECHO_RULES.allPctPerEcho * 9);
    expect(preview.nextCycle).toBe(3);
  });

  it('caps the bonus at 30 counted Echoes', () => {
    const preview = cyclePreview(withXf(3.2e10, revealed), prestige(5, 30));
    expect(preview.echoesAfter).toBe(36);
    expect(preview.bonusPctAfter).toBe(450);
  });

  it('nextBonusXf is the next threshold above the lifetime xf, null past the last one', () => {
    expect(cyclePreview(withXf(2e9, revealed), DEFAULT_PRESTIGE).nextBonusXf).toBe(8e9);
    expect(cyclePreview(withXf(3.2e10, revealed), DEFAULT_PRESTIGE).nextBonusXf).toBeNull();
    expect(cyclePreview(withXf(1e12, revealed), DEFAULT_PRESTIGE).nextBonusXf).toBeNull();
  });

  it('non-finite xf is treated as zero for the next threshold', () => {
    const preview = cyclePreview(withXf(NaN, revealed), DEFAULT_PRESTIGE);
    expect(preview.echoesGained).toBe(3);
    expect(preview.nextBonusXf).toBe(2e9);
  });
});
