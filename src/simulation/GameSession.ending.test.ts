import { describe, it, expect } from 'vitest';
import type { GameState } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import { GameSession } from './GameSession';
import { costAt } from './economy/cost';
import { computeRates } from './production/rates';
import { createInitialState } from './state';

const T0 = 5000;
const CLOCK = 9000;

/** A session one purchase away from primaryFunction: finalAlignment owned, enough xf, fixed clock. */
const readySession = (): GameSession => {
  const base = createInitialState(T0);
  const state: GameState = {
    ...base,
    lastSimTime: T0,
    techLevels: { ...base.techLevels, finalAlignment: 1 },
    res: { ...base.res, xf: costAt(TECHNOLOGIES.primaryFunction, 0) },
    lifetime: { ...base.lifetime, xf: costAt(TECHNOLOGIES.primaryFunction, 0) },
  };
  return new GameSession({ state, now: () => CLOCK });
};

/** Records every session event as a compact string, in emission order. */
const recordAll = (session: GameSession): string[] => {
  const log: string[] = [];
  session.on('purchase', (p) => log.push(`purchase:${p.id}`));
  session.on('unlock', (p) => log.push(`unlock:${p.id}`));
  session.on('milestone', (p) => log.push(`milestone:${p.id}`));
  session.on('achievement', (p) => log.push(`achievement:${p.ids.join(',')}`));
  session.on('ending', (p) => log.push(`ending:${p.phase}`));
  session.on('reset', () => log.push('reset'));
  return log;
};

const endingEvents = (log: string[]): string[] => log.filter((line) => line.startsWith('ending:'));

describe('GameSession ending: purchase starts the finale', () => {
  it('buying primaryFunction emits purchase, unlock, achievement, then ending(sequence) once', () => {
    const session = readySession();
    const log = recordAll(session);
    const result = session.purchase('primaryFunction');
    expect(result.ok).toBe(true);

    const order = log.filter((line) => !line.startsWith('milestone:'));
    expect(order[0]).toBe('purchase:primaryFunction');
    expect(order[1]).toBe('unlock:primaryFunction');
    expect(order[2]).toMatch(/^achievement:.*restoration/);
    expect(order[3]).toBe('ending:sequence');
    expect(order).toHaveLength(4);
    expect(endingEvents(log)).toEqual(['ending:sequence']);
  });

  it('sets state.ending to sequence with engagedAt = lastSimTime at the purchase', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    expect(session.state.ending).toEqual({ phase: 'sequence', engagedAt: T0 });
  });

  it('a purchase that does not buy the ending tech emits no ending event', () => {
    const base = createInitialState(T0);
    const session = new GameSession({
      state: { ...base, res: { ...base.res, me: costAt(TECHNOLOGIES.gearRatio, 0) } },
      now: () => CLOCK,
    });
    const log = recordAll(session);
    expect(session.purchase('gearRatio').ok).toBe(true);
    expect(endingEvents(log)).toEqual([]);
    expect(session.state.ending.phase).toBe('none');
  });

  it('the purchase is not repeatable: a second buy fails and emits nothing', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    const log = recordAll(session);
    const revision = session.revision;
    expect(session.purchase('primaryFunction')).toEqual({ ok: false, reason: 'owned' });
    expect(log).toEqual([]);
    expect(session.revision).toBe(revision);
  });

  it('the sequence survives later steps (update keeps the ending block)', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    session.update(T0 + 6000);
    expect(session.state.ending).toEqual({ phase: 'sequence', engagedAt: T0 });
  });

  it('bumps the revision on the purchase', () => {
    const session = readySession();
    const before = session.revision;
    session.purchase('primaryFunction');
    expect(session.revision).toBeGreaterThan(before + 1);
  });
});

describe('GameSession ending: finishEndingSequence', () => {
  it('moves sequence -> choice, emits ending(choice) and bumps the revision', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    const log = recordAll(session);
    const revision = session.revision;
    expect(session.finishEndingSequence()).toBe(true);
    expect(session.state.ending).toEqual({ phase: 'choice', engagedAt: T0 });
    expect(endingEvents(log)).toEqual(['ending:choice']);
    expect(session.revision).toBe(revision + 1);
  });

  it('returns false and emits nothing outside the sequence phase', () => {
    const session = readySession();
    const log = recordAll(session);
    const revision = session.revision;
    expect(session.finishEndingSequence()).toBe(false);
    expect(session.state.ending.phase).toBe('none');
    expect(log).toEqual([]);
    expect(session.revision).toBe(revision);
  });
});

describe('GameSession ending: keepRunning', () => {
  it('moves choice -> postgame, emits ending(postgame) and bumps the revision', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    session.finishEndingSequence();
    const log = recordAll(session);
    const revision = session.revision;
    expect(session.keepRunning()).toBe(true);
    expect(session.state.ending.phase).toBe('postgame');
    expect(endingEvents(log)).toEqual(['ending:postgame']);
    expect(session.revision).toBe(revision + 1);
  });

  it('is illegal in sequence, none and postgame: false and no event', () => {
    const session = readySession();
    const log = recordAll(session);
    expect(session.keepRunning()).toBe(false);
    session.purchase('primaryFunction');
    expect(session.keepRunning()).toBe(false);
    session.finishEndingSequence();
    expect(session.keepRunning()).toBe(true);
    log.length = 0;
    const revision = session.revision;
    expect(session.keepRunning()).toBe(false);
    expect(log).toEqual([]);
    expect(session.revision).toBe(revision);
  });

  it('finishEndingSequence is illegal once keepRunning has moved to postgame', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    session.finishEndingSequence();
    session.keepRunning();
    const log = recordAll(session);
    expect(session.finishEndingSequence()).toBe(false);
    expect(log).toEqual([]);
    expect(session.state.ending.phase).toBe('postgame');
  });
});

describe('GameSession ending: reset and rates', () => {
  it('reset returns the ending to DEFAULT, emits reset and no ending event', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    session.finishEndingSequence();
    const log = recordAll(session);
    session.reset(CLOCK);
    expect(session.state.ending).toEqual({ phase: 'none', engagedAt: null });
    expect(log).toEqual(['reset']);
  });

  it('rates are identical before and after each ending change (rate-neutral marker)', () => {
    const session = readySession();
    session.purchase('primaryFunction');
    const afterPurchase = structuredClone(session.rates);
    expect(session.rates).toEqual(computeRates(session.state));

    const cached = session.rates;
    session.finishEndingSequence();
    expect(session.rates).toBe(cached);
    session.keepRunning();
    expect(session.rates).toBe(cached);
    expect(session.rates).toEqual(afterPurchase);
  });
});
