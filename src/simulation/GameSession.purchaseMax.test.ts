import { describe, it, expect } from 'vitest';
import { TECHNOLOGIES } from '../data/technologies';
import type { GameState, TechId } from '../data/types';
import { costAt } from './economy/cost';
import type { SessionEvents } from './events';
import { GameSession } from './GameSession';
import { createInitialState } from './state';

// WP28 C6 / A7: BUY MAX through GameSession.purchaseMax. One state step, one 'purchase' event with the count, stats.purchases
// grows by the count, the first failure comes back when nothing is bought, unlocks buy exactly one, and 'unlock' fires only
// when the tech started at level 0. Tests inject `now`; no time passes between the calls.

type Levels = Partial<Record<TechId, number>>;

const ME_TECH = 'gearRatio' as const; // era I repeatable in ME, requires Hand Crank 1 (owned from the start)

const withLevels = (levels: Levels, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Sets both the spendable `me` and the lifetime `me` (lifetime defaults to the same amount).
const withMe = (state: GameState, me: number, lifetimeMe: number = me): GameState => ({
  ...state,
  res: { ...state.res, me },
  lifetime: { ...state.lifetime, me: lifetimeMe },
});

const session = (levels: Levels, me: number, lifetimeMe: number = me): GameSession =>
  new GameSession({ state: withMe(withLevels(levels), me, lifetimeMe), now: () => 0 });

// The total cost of `count` levels bought from level `from`, summed in purchase order (the session sums the same way).
const sumCosts = (id: TechId, from: number, count: number): number => {
  let total = 0;
  for (let i = 0; i < count; i++) total += costAt(TECHNOLOGIES[id], from + i);
  return total;
};

describe('GameSession.purchaseMax (WP28 BUY MAX)', () => {
  it('buys every affordable level in one call: one purchase event with count, total cost and final level', () => {
    const k = 4;
    const s = session({ handCrank: 1 }, sumCosts(ME_TECH, 0, k) + 1); // one more than k levels, less than level k + 1
    const purchases: SessionEvents['purchase'][] = [];
    s.on('purchase', (p) => purchases.push(p));
    const before = s.stats.purchases;

    const result = s.purchaseMax(ME_TECH);
    expect(result).toMatchObject({ ok: true, count: k, newLevel: k, cost: sumCosts(ME_TECH, 0, k) });
    expect(purchases).toEqual([{ id: ME_TECH, level: k, cost: sumCosts(ME_TECH, 0, k), res: 'me', count: k }]);
    expect(s.state.techLevels[ME_TECH]).toBe(k);
    expect(s.state.res.me).toBeCloseTo(1, 9);
    expect(s.stats.purchases).toBe(before + k);
  });

  it('is one save-relevant step: one revision bump and the same levels and resources as the purchase() loop', () => {
    const k = 3;
    const me = sumCosts(ME_TECH, 0, k) + 1;
    const max = session({ handCrank: 1 }, me);
    const loop = session({ handCrank: 1 }, me);
    for (let i = 0; i < k; i++) expect(loop.purchase(ME_TECH).ok).toBe(true);

    const achievements: SessionEvents['achievement'][] = [];
    max.on('achievement', (p) => achievements.push(p));
    const revision = max.revision;
    expect(max.purchaseMax(ME_TECH)).toMatchObject({ ok: true, count: k });
    expect(achievements).toEqual([]); // no achievement fires in this run, so the bump is the purchase's alone
    expect(max.revision).toBe(revision + 1);

    expect(max.state.techLevels).toEqual(loop.state.techLevels);
    expect(max.state.res).toEqual(loop.state.res);
    expect(max.stats.purchases).toBe(loop.stats.purchases);
  });

  it('stops at the first failure: the funds left after the last affordable level are below the next cost', () => {
    const k = 5;
    const s = session({ handCrank: 1 }, sumCosts(ME_TECH, 0, k) + 1);
    expect(s.purchaseMax(ME_TECH)).toMatchObject({ ok: true, count: k });
    expect(s.state.res.me).toBeLessThan(costAt(TECHNOLOGIES[ME_TECH], k));
    expect(s.purchase(ME_TECH)).toEqual({ ok: false, reason: 'insufficient' });
  });

  it('the guard limits the levels bought in one call', () => {
    const s = session({ handCrank: 1 }, 1e12);
    expect(s.purchaseMax(ME_TECH, 3)).toMatchObject({ ok: true, count: 3, newLevel: 3 });
    expect(s.purchaseMax(ME_TECH, 1)).toMatchObject({ ok: true, count: 1, newLevel: 4 });
    expect(s.state.techLevels[ME_TECH]).toBe(4);
  });

  it('a guard of 1 buys exactly one level', () => {
    const s = session({ handCrank: 1 }, 1e12);
    expect(s.purchaseMax(ME_TECH, 1)).toMatchObject({ ok: true, count: 1, newLevel: 1 });
  });

  it('nothing bought: returns the first failure, with no change, no events and no revision bump', () => {
    const s = session({ handCrank: 1 }, 0);
    const events: string[] = [];
    s.on('purchase', () => events.push('purchase'));
    s.on('unlock', () => events.push('unlock'));
    s.on('achievement', () => events.push('achievement'));
    const state = s.state;
    const revision = s.revision;
    const purchases = s.stats.purchases;

    expect(s.purchaseMax(ME_TECH)).toEqual({ ok: false, reason: 'insufficient' });
    expect(s.state).toBe(state);
    expect(s.revision).toBe(revision);
    expect(s.stats.purchases).toBe(purchases);
    expect(events).toEqual([]);
  });

  it('nothing bought with a locked tech: the first failure is locked (requirements come before funds)', () => {
    const s = session({ handCrank: 0 }, 1e12); // gearRatio needs handCrank 1
    expect(s.purchaseMax(ME_TECH)).toEqual({ ok: false, reason: 'locked' });
  });

  it('a repeatable at its max level fails with maxed', () => {
    const max = TECHNOLOGIES[ME_TECH].maxLevel ?? 0;
    const s = session({ handCrank: 1, [ME_TECH]: max }, 1e12);
    expect(s.purchaseMax(ME_TECH)).toEqual({ ok: false, reason: 'maxed' });
  });

  it('the demo era cap applies: a tech above the cap is refused with demo', () => {
    const s = new GameSession({
      state: withMe(withLevels({ handCrank: 1 }), 1e12),
      now: () => 0,
      maxEra: 1,
    });
    expect(s.purchaseMax('generator')).toEqual({ ok: false, reason: 'demo' });
  });

  it('an unlock buys exactly one; the second call fails with owned', () => {
    const s = session({ handCrank: 1 }, 1e9, 1e9); // Barrel Organ (a Splice): era I keystone and 120000 lifetime ME
    const events: SessionEvents['purchase'][] = [];
    const unlocks: string[] = [];
    s.on('purchase', (p) => events.push(p));
    s.on('unlock', (p) => unlocks.push(p.id));

    expect(s.purchaseMax('spliceOrgan')).toMatchObject({ ok: true, count: 1, newLevel: 1 });
    expect(s.purchaseMax('spliceOrgan')).toEqual({ ok: false, reason: 'owned' });
    expect(events).toEqual([{ id: 'spliceOrgan', level: 1, cost: costAt(TECHNOLOGIES.spliceOrgan, 0), res: 'me', count: 1 }]);
    expect(unlocks).toEqual(['spliceOrgan']);
    expect(s.stats.purchases).toBe(1);
  });

  it("'unlock' fires only when the tech starts at level 0; a repeatable already owned emits purchase alone", () => {
    // Funds for exactly one level in each case, so BUY MAX stops after one purchase.
    const fresh = session({ handCrank: 1 }, sumCosts(ME_TECH, 0, 1) + 1);
    const freshUnlocks: string[] = [];
    fresh.on('unlock', (p) => freshUnlocks.push(p.id));
    expect(fresh.purchaseMax(ME_TECH)).toMatchObject({ ok: true, count: 1, newLevel: 1 });
    expect(freshUnlocks).toEqual([ME_TECH]);

    const owned = session({ handCrank: 1, [ME_TECH]: 1 }, sumCosts(ME_TECH, 1, 1) + 1);
    const ownedUnlocks: string[] = [];
    const ownedPurchases: SessionEvents['purchase'][] = [];
    owned.on('unlock', (p) => ownedUnlocks.push(p.id));
    owned.on('purchase', (p) => ownedPurchases.push(p));
    expect(owned.purchaseMax(ME_TECH)).toMatchObject({ ok: true, count: 1, newLevel: 2 });
    expect(ownedUnlocks).toEqual([]);
    expect(ownedPurchases).toHaveLength(1);
  });

  it('the purchase event of a multi-level buy costs the sum of its levels (from a level above 0)', () => {
    const s = session({ handCrank: 1, [ME_TECH]: 2 }, sumCosts(ME_TECH, 2, 2) + 0.5);
    const purchases: SessionEvents['purchase'][] = [];
    s.on('purchase', (p) => purchases.push(p));
    expect(s.purchaseMax(ME_TECH)).toMatchObject({ ok: true, count: 2, newLevel: 4, cost: sumCosts(ME_TECH, 2, 2) });
    expect(purchases).toEqual([{ id: ME_TECH, level: 4, cost: sumCosts(ME_TECH, 2, 2), res: 'me', count: 2 }]);
  });
});
