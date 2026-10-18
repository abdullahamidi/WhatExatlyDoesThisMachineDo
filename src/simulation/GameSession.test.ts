import { describe, it, expect, vi, afterEach } from 'vitest';
import type { GameState, TechId } from '../data/types';
import { GameSession } from './GameSession';
import { createInitialState } from './state';
import * as api from './index';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Records events of a session as compact strings, in emission order.
const record = (session: GameSession): string[] => {
  const log: string[] = [];
  session.on('click', (p) => log.push(`click:${p.gained}`));
  session.on('purchase', (p) => log.push(`purchase:${p.id}:${p.level}:${p.cost}`));
  session.on('unlock', (p) => log.push(`unlock:${p.id}`));
  session.on('milestone', (p) => log.push(`milestone:${p.id}`));
  session.on('offline', (p) => log.push(`offline:${p.gained}`));
  session.on('reset', () => log.push('reset'));
  return log;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GameSession', () => {
  describe('constructor', () => {
    it('does not mutate the state it was given', () => {
      const s = withLevels({ wornMotor: 1 });
      const before = structuredClone(s);
      const session = new GameSession({ state: s, now: () => 0 });
      session.update(1000);
      session.click();
      expect(s).toEqual(before);
    });
  });

  describe('click', () => {
    it('adds one click, counts it, and emits click', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const log = record(session);
      expect(session.click()).toBe(1);
      expect(session.state.me).toBe(1);
      expect(session.state.lifetimeMe).toBe(1);
      expect(session.state.totalClicks).toBe(1);
      expect(log).toEqual(['click:1']);
    });
  });

  describe('update', () => {
    it('advances automation by the elapsed time and moves lastSimTime', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.update(5000);
      expect(session.state.me).toBeCloseTo(5, 9);
      expect(session.state.lastSimTime).toBe(5000);
      session.update(5000);
      expect(session.state.me).toBeCloseTo(5, 9);
    });

    it('clamps the step to the maximum update length', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.update(36_000_000);
      expect(session.state.me).toBeCloseTo(28800, 9);
    });

    it('credits nothing when the clock went backwards but still moves lastSimTime', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1 }, { lastSimTime: 10_000 }),
        now: () => 0,
      });
      const before = session.state.me;
      session.update(2_000);
      expect(session.state.me).toBe(before);
      expect(session.state.lastSimTime).toBe(2000);
    });

    it('ignores a non-finite time', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      const before = session.state;
      session.update(Number.NaN);
      expect(session.state).toBe(before);
    });

    it('uses the injected clock when called without an argument', () => {
      let t = 3000;
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => t });
      session.update();
      expect(session.state.me).toBeCloseTo(3, 9);
      expect(session.state.lastSimTime).toBe(3000);
      t = 4000;
      session.update();
      expect(session.state.me).toBeCloseTo(4, 9);
    });
  });

  describe('rates', () => {
    it('is initially one per click and no per second', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      expect(session.rates).toEqual({ perClick: 1, perSecond: 0 });
    });

    it('returns the same object across updates', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      const a = session.rates;
      session.update(5000);
      expect(session.rates).toBe(a);
    });

    it('is recomputed after a purchase changes tech levels', () => {
      const session = new GameSession({ state: withLevels({}, { me: 10 }), now: () => 0 });
      expect(session.purchase('gearRatio').ok).toBe(true);
      expect(session.rates.perClick).toBe(2);
    });
  });

  describe('applyOffline', () => {
    it('credits capped progress once, moves lastSimTime, and emits offline once', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1, motorTuning: 5 }, { lastSimTime: 0 }),
        now: () => 0,
      });
      const log = record(session);
      const report = session.applyOffline(3_600_000);
      expect(report).toEqual({ elapsedSeconds: 3600, cappedSeconds: 3600, gained: 21600 });
      expect(session.state.me).toBeCloseTo(21600, 9);
      expect(session.state.lastSimTime).toBe(3_600_000);

      session.update(3_600_000);
      expect(session.state.me).toBeCloseTo(21600, 9);
      expect(log).toEqual(['offline:21600']);
    });

    it('caps at the offline limit', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1, motorTuning: 5 }, { lastSimTime: 0 }),
        now: () => 0,
      });
      const report = session.applyOffline(10 * 3_600_000);
      expect(report.cappedSeconds).toBe(28800);
      expect(report.gained).toBeCloseTo(172800, 9);
      expect(session.state.me).toBeCloseTo(172800, 9);
    });

    it('still emits offline when nothing is gained', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const log = record(session);
      const report = session.applyOffline(1000);
      expect(report.gained).toBe(0);
      expect(log).toEqual(['offline:0']);
    });

    it('credits nothing for a non-finite time and keeps lastSimTime', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1 }, { lastSimTime: 500 }),
        now: () => 0,
      });
      const report = session.applyOffline(Number.NaN);
      expect(report.gained).toBe(0);
      expect(session.state.lastSimTime).toBe(500);
      expect(session.state.me).toBe(0);
    });
  });

  describe('purchase', () => {
    it('fails with insufficient funds and emits nothing', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const before = session.state;
      const log = record(session);
      expect(session.purchase('gearRatio')).toEqual({ ok: false, reason: 'insufficient' });
      expect(session.state).toBe(before);
      expect(log).toEqual([]);
    });

    it('emits purchase and unlock on the first level, then only purchase afterwards', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      for (let i = 0; i < 10; i++) session.click();
      expect(session.state.me).toBe(10);

      const log = record(session);
      const first = session.purchase('gearRatio');
      expect(first).toMatchObject({ ok: true, cost: 10, newLevel: 1 });
      expect(session.state.me).toBe(0);
      expect(session.rates.perClick).toBe(2);
      expect(log).toEqual(['purchase:gearRatio:1:10', 'unlock:gearRatio']);

      for (let i = 0; i < 6; i++) session.click();
      expect(session.state.me).toBe(12);

      log.length = 0;
      const second = session.purchase('gearRatio');
      expect(second).toMatchObject({ ok: true, cost: 12, newLevel: 2 });
      expect(log).toEqual(['purchase:gearRatio:2:12']);
    });

    it('emits milestone events in order when a purchase completes a milestone', () => {
      const session = new GameSession({
        state: withLevels(
          { gearRatio: 3, reinforcedCrank: 1, wornMotor: 1, motorTuning: 5, pistonArray: 1 },
          { me: 1000, lifetimeMe: 2000, lastSimTime: 0 },
        ),
        now: () => 0,
      });
      const log = record(session);
      const result = session.purchase('flywheel');
      expect(result).toMatchObject({ ok: true, cost: 150 });
      expect(session.state.me).toBe(850);
      expect(session.state.techLevels.generatorBlueprint).toBe(1);
      expect(log).toEqual([
        'purchase:flywheel:1:150',
        'unlock:flywheel',
        'unlock:generatorBlueprint',
        'milestone:generatorBlueprint',
      ]);

      log.length = 0;
      session.update(1000);
      expect(log).toEqual([]);
    });
  });

  describe('listeners', () => {
    it('stops calling a listener after its unsubscribe function runs', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const fn = vi.fn();
      const off = session.on('click', fn);
      session.click();
      off();
      session.click();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('isolates a throwing listener from other listeners and from the caller', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const second = vi.fn();
      session.on('click', () => {
        throw new Error('boom');
      });
      session.on('click', second);
      expect(() => session.click()).not.toThrow();
      expect(second).toHaveBeenCalledWith({ gained: 1 });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('returns to a fresh game at the given time and emits reset once', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      for (let i = 0; i < 10; i++) session.click();
      session.purchase('gearRatio');
      const log = record(session);

      session.reset(5000);
      expect(session.state.me).toBe(0);
      expect(session.state.totalClicks).toBe(0);
      expect(session.state.techLevels).toEqual(createInitialState(0).techLevels);
      expect(session.state.lastSimTime).toBe(5000);
      expect(session.rates.perClick).toBe(1);
      expect(log).toEqual(['reset']);
    });
  });

  describe('views', () => {
    it('returns nine tech views and gearRatio is available initially', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      expect(session.getAllTechViews()).toHaveLength(9);
      expect(session.getTechView('gearRatio').status).toBe('available');
    });
  });

  describe('barrel', () => {
    it('exposes the public simulation API', () => {
      expect(typeof api.GameSession).toBe('function');
      expect(typeof api.createInitialState).toBe('function');
      expect(typeof api.computeRates).toBe('function');
      expect(typeof api.purchase).toBe('function');
      expect(typeof api.evaluateMilestones).toBe('function');
      expect(typeof api.costAt).toBe('function');
    });
  });
});
