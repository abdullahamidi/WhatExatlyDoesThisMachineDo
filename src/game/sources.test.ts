import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS } from '../data/types';
import type { SettingsState, TechId } from '../data/types';
import { DEFAULT_SETTINGS, GameSession, createInitialState, emptyResourceMap } from '../simulation';
import { visualMaxForEra } from './math/showcase';
import { createDisplaySource, createStandInSource } from './sources';

/** A session with plenty of ME, so purchases succeed. */
const richSession = (): GameSession => {
  const base = createInitialState(0);
  return new GameSession({ state: { ...base, res: { ...base.res, me: 1e9 } }, now: () => 0 });
};

describe('createDisplaySource: pass-through without an override', () => {
  it('state.techLevels is the base levels object itself', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0 });
    const display = createDisplaySource(session);
    expect(display.getOverride()).toBeNull();
    expect(display.state.techLevels).toBe(session.state.techLevels);
  });
});

describe('createDisplaySource: override floor', () => {
  it('raises the display levels and leaves the session levels untouched', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0 });
    const display = createDisplaySource(session);
    const floor = visualMaxForEra(5);
    display.setOverride(floor);
    expect(display.getOverride()).toBe(floor);
    expect(display.state.techLevels.resonantSiphon).toBe(10);
    expect(session.state.techLevels.resonantSiphon).toBe(0);
    expect(display.state.techLevels).not.toBe(session.state.techLevels);
  });

  it('returns the same object for repeat reads', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0 });
    const display = createDisplaySource(session);
    display.setOverride(visualMaxForEra(5));
    expect(display.state.techLevels).toBe(display.state.techLevels);
  });

  it('a new object after a purchase, and the base object again when the override is cleared', () => {
    const session = richSession();
    const display = createDisplaySource(session);
    display.setOverride(visualMaxForEra(5));
    const before = display.state.techLevels;

    const result = session.purchase('gearRatio');
    expect(result.ok).toBe(true);
    const after = display.state.techLevels;
    expect(after).not.toBe(before);
    expect(after.gearRatio).toBeGreaterThanOrEqual(1);

    display.setOverride(null);
    expect(display.state.techLevels).toBe(session.state.techLevels);
  });
});

describe('createDisplaySource: reset order', () => {
  it('clears the override before later reset listeners run', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0 });
    const display = createDisplaySource(session);
    display.setOverride(visualMaxForEra(5));

    let seen: Readonly<Record<TechId, number>> | null = null;
    session.on('reset', () => {
      seen = display.state.techLevels;
    });
    session.reset(0);

    expect(display.getOverride()).toBeNull();
    expect(seen).toBe(session.state.techLevels);
  });
});

describe('createDisplaySource: on() forwards to the base', () => {
  it('delivers the base payload and stops after unsubscribe', () => {
    const session = richSession();
    const display = createDisplaySource(session);
    const received: unknown[] = [];
    const unsubscribe = display.on('purchase', (payload) => received.push(payload));

    const result = session.purchase('gearRatio');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(received).toEqual([{ id: 'gearRatio', level: result.newLevel, cost: result.cost, res: 'me' }]);

    unsubscribe();
    session.purchase('gearRatio');
    expect(received).toHaveLength(1);
  });
});

describe('createDisplaySource: rates and settings are live', () => {
  it('settings and rates follow the base session', () => {
    const session = richSession();
    const display = createDisplaySource(session);

    session.updateSettings({ reducedMotion: true });
    expect(display.settings.reducedMotion).toBe(true);

    expect(display.rates).toBe(session.rates);
    session.purchase('gearRatio');
    expect(display.rates).toBe(session.rates);
    expect(display.rates.perSecond).toEqual(session.rates.perSecond);
  });
});

describe('createDisplaySource: destroy', () => {
  it('removes the reset subscription, so the override survives a base reset', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0 });
    const display = createDisplaySource(session);
    const floor = visualMaxForEra(5);
    display.destroy();
    display.setOverride(floor);
    session.reset(0);
    expect(display.getOverride()).toBe(floor);
  });

  it('is idempotent', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0 });
    const display = createDisplaySource(session);
    display.destroy();
    expect(() => display.destroy()).not.toThrow();
  });
});

describe('createStandInSource', () => {
  const settings: SettingsState = { ...DEFAULT_SETTINGS, reducedMotion: true };

  it('exposes the given levels through state.techLevels', () => {
    const levels = { ...createInitialState(0).techLevels, gearRatio: 5 };
    const stand = createStandInSource({ levels, settings });
    expect(stand.state.techLevels).toBe(levels);
    expect(stand.state.techLevels.gearRatio).toBe(5);
  });

  it('defaults every rate to zero', () => {
    const stand = createStandInSource({ levels: createInitialState(0).techLevels, settings });
    for (const id of RESOURCE_IDS) {
      expect(stand.rates.perSecond[id]).toBe(0);
    }
    expect(stand.rates.perSecond).toEqual(emptyResourceMap());
  });

  it('exposes the given per-second rates', () => {
    const perSecond = { ...emptyResourceMap(), me: 3 };
    const stand = createStandInSource({ levels: createInitialState(0).techLevels, settings, perSecond });
    expect(stand.rates.perSecond.me).toBe(3);
  });

  it('setLevels and setRates replace the values seen by new reads', () => {
    const stand = createStandInSource({ levels: createInitialState(0).techLevels, settings });
    const levels = { ...createInitialState(0).techLevels, resonantSiphon: 7 };
    const perSecond = { ...emptyResourceMap(), ee: 2 };
    stand.setLevels(levels);
    stand.setRates(perSecond);
    expect(stand.state.techLevels).toBe(levels);
    expect(stand.state.techLevels.resonantSiphon).toBe(7);
    expect(stand.rates.perSecond).toBe(perSecond);
  });

  it('returns the settings it was given', () => {
    const stand = createStandInSource({ levels: createInitialState(0).techLevels, settings });
    expect(stand.settings).toBe(settings);
  });

  it('emit reaches on() listeners for purchase and reset', () => {
    const stand = createStandInSource({ levels: createInitialState(0).techLevels, settings });
    const purchases: unknown[] = [];
    let resets = 0;
    stand.on('purchase', (payload) => purchases.push(payload));
    stand.on('reset', () => {
      resets += 1;
    });

    const payload = { id: 'gearRatio' as const, level: 2, cost: 40, res: 'me' as const };
    stand.emit('purchase', payload);
    stand.emit('reset', {});
    expect(purchases).toEqual([payload]);
    expect(resets).toBe(1);
  });

  it('unsubscribe stops delivery', () => {
    const stand = createStandInSource({ levels: createInitialState(0).techLevels, settings });
    let resets = 0;
    const unsubscribe = stand.on('reset', () => {
      resets += 1;
    });
    stand.emit('reset', {});
    unsubscribe();
    stand.emit('reset', {});
    expect(resets).toBe(1);
  });
});
