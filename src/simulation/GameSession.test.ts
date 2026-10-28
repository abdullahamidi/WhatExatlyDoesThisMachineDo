import { describe, it, expect, vi, afterEach } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { GameState, TechId } from '../data/types';
import { OFFLINE_REPORT_THRESHOLD_SECONDS } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { GameSession } from './GameSession';
import { costAt } from './economy/cost';
import { createInitialState, DEFAULT_SETTINGS } from './state';
import { emptyResourceMap } from './resources';
import * as api from './index';

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

// Records events of a session as compact strings, in emission order.
const record = (session: GameSession): string[] => {
  const log: string[] = [];
  session.on('click', (p) => log.push(`click:${p.gained}`));
  session.on('purchase', (p) => log.push(`purchase:${p.id}:${p.level}:${p.cost}`));
  session.on('unlock', (p) => log.push(`unlock:${p.id}`));
  session.on('milestone', (p) => log.push(`milestone:${p.id}`));
  session.on('offline', (p) => log.push(`offline:${p.gained.me}`));
  session.on('reset', () => log.push('reset'));
  session.on('settings', (p) => log.push(`settings:${p.muted}`));
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
      expect(session.state.res.me).toBe(1);
      expect(session.state.lifetime.me).toBe(1);
      expect(session.state.totalClicks).toBe(1);
      expect(log).toEqual(['click:1']);
    });

    it('emits the click payload with gainedAll whose me matches gained', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const payloads: { gained: number; gainedAll: Record<string, number> }[] = [];
      session.on('click', (p) => payloads.push(p));
      session.click();
      expect(payloads).toHaveLength(1);
      expect(payloads[0]?.gainedAll.me).toBe(payloads[0]?.gained);
      expect(payloads[0]?.gained).toBe(1);
      expect(payloads[0]?.gainedAll).toEqual({ ...emptyResourceMap(), me: 1 });
    });
  });

  describe('update', () => {
    it('advances automation by the elapsed time and moves lastSimTime', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(0);
      // WP27 re-pin (F2hi): Worn Motor is 2 ME/s, was 17 ME/s in v0.10.1: 5 s = 10 ME.
      session.update(5000);
      expect(session.state.res.me).toBeCloseTo(10, 9);
      expect(session.state.lastSimTime).toBe(5000);
      session.update(5000);
      expect(session.state.res.me).toBeCloseTo(10, 9);
    });

    it('routes a first update through offline progress, capped at the offline limit', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      const log = record(session);
      session.update(36_000_000);
      // WP27 re-pin (F2hi): 28800 s capped x 2 ME/s = 57600 (was 489600 at 17 ME/s).
      expect(session.state.res.me).toBeCloseTo(57600, 9);
      expect(session.state.lastSimTime).toBe(36_000_000);
      expect(log).toEqual(['offline:57600']);
    });

    it('advances normally for a gap equal to the offline threshold, without an offline event', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(0);
      const log = record(session);
      session.update(OFFLINE_REPORT_THRESHOLD_SECONDS * 1000);
      // WP27 re-pin (F2hi): Worn Motor 2 ME/s (was 17).
      expect(session.state.res.me).toBeCloseTo(OFFLINE_REPORT_THRESHOLD_SECONDS * 2, 9);
      expect(session.state.lastSimTime).toBe(OFFLINE_REPORT_THRESHOLD_SECONDS * 1000);
      expect(log).toEqual([]);
    });

    it('a first update of 2 hours emits offline with perSecond x 7200 (never silent)', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      const perSecond = session.rates.perSecond.me;
      const log = record(session);
      const twoHours = 2 * 3600 * 1000;
      session.update(twoHours);
      expect(log).toEqual([`offline:${perSecond * 7200}`]);
      expect(session.state.res.me).toBeCloseTo(perSecond * 7200, 9);
    });

    it('after applyOffline, a 0.5 s update advances normally with no offline event', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(0);
      const log = record(session);
      session.update(500);
      // WP27 re-pin (F2hi): 0.5 s x 2 ME/s = 1 (was 8.5 at 17 ME/s).
      expect(session.state.res.me).toBeCloseTo(1, 9);
      expect(log).toEqual([]);
    });

    it('a 5-minute gap after normal updates emits offline and credits the gap', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(0);
      session.update(1000);
      session.update(2000);
      const log = record(session);
      session.update(2000 + 300_000);
      // WP27 re-pin (F2hi): 300 s x 2 ME/s = 600, plus the 4 ME of the two normal steps (was 5100 and 5134 at 17 ME/s).
      expect(log).toEqual(['offline:600']);
      expect(session.state.res.me).toBeCloseTo(604, 9);
    });

    it('does not double-count: applyOffline(t) then update(t) adds nothing', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(10_000);
      const before = session.state.res.me;
      const log = record(session);
      session.update(10_000);
      expect(session.state.res.me).toBe(before);
      expect(log).toEqual([]);
    });

    it('credits nothing when the clock went backwards but still moves lastSimTime', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1 }, { lastSimTime: 10_000 }),
        now: () => 0,
      });
      const before = session.state.res.me;
      session.update(2_000);
      expect(session.state.res.me).toBe(before);
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
      // WP27 re-pin (F2hi): Worn Motor 2 ME/s (was 17): 3 s = 6, then 4 s = 8 (was 51 and 68).
      expect(session.state.res.me).toBeCloseTo(6, 9);
      expect(session.state.lastSimTime).toBe(3000);
      t = 4000;
      session.update();
      expect(session.state.res.me).toBeCloseTo(8, 9);
    });
  });

  describe('revision', () => {
    it('bumps on click, update with elapsed time, and purchase', () => {
      const session = new GameSession({
        state: withMe(withLevels({}, { lastSimTime: 0 }), costAt(TECHNOLOGIES.gearRatio, 0)),
        now: () => 0,
      });
      session.applyOffline(0);

      let r = session.revision;
      session.click();
      expect(session.revision).toBeGreaterThan(r);

      r = session.revision;
      session.update(1000);
      expect(session.revision).toBeGreaterThan(r);

      r = session.revision;
      expect(session.purchase('gearRatio').ok).toBe(true);
      expect(session.revision).toBeGreaterThan(r);
    });

    it('does not bump on an update with zero elapsed time', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(5000);
      const r = session.revision;
      session.update(5000);
      expect(session.revision).toBe(r);
    });

    it('does not bump on a failed purchase', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const r = session.revision;
      session.purchase('gearRatio');
      expect(session.revision).toBe(r);
    });

    it('bumps on a settings change and on reset', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      let r = session.revision;
      session.setMuted(true);
      expect(session.revision).toBeGreaterThan(r);
      r = session.revision;
      session.reset(10);
      expect(session.revision).toBeGreaterThan(r);
    });
  });

  describe('settings', () => {
    it('defaults to DEFAULT_SETTINGS and accepts initial settings', () => {
      expect(new GameSession({ state: createInitialState(0), now: () => 0 }).settings).toEqual({ ...DEFAULT_SETTINGS, muted: false });
      const session = new GameSession({
        state: createInitialState(0),
        settings: { ...DEFAULT_SETTINGS, muted: true },
        now: () => 0,
      });
      expect(session.settings).toEqual({ ...DEFAULT_SETTINGS, muted: true });
    });

    it('setMuted updates the flag and emits settings with the new payload', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const log = record(session);
      session.setMuted(true);
      expect(session.settings.muted).toBe(true);
      expect(log).toEqual(['settings:true']);
      session.setMuted(false);
      expect(session.settings.muted).toBe(false);
      expect(log).toEqual(['settings:true', 'settings:false']);
    });

    it('setMuted with an unchanged value is a no-op', () => {
      const session = new GameSession({ state: createInitialState(0), settings: { ...DEFAULT_SETTINGS, muted: true }, now: () => 0 });
      const before = session.settings;
      const r = session.revision;
      const log = record(session);
      session.setMuted(true);
      expect(session.settings).toBe(before);
      expect(session.revision).toBe(r);
      expect(log).toEqual([]);
    });

    it('reset keeps the settings', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      session.setMuted(true);
      session.reset(100);
      expect(session.settings).toEqual({ ...DEFAULT_SETTINGS, muted: true });
    });
  });

  describe('rates', () => {
    it('is initially one per click and no per second', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      expect(session.rates).toEqual({
        perClick: { ...emptyResourceMap(), me: 1 },
        perSecond: emptyResourceMap(),
      });
    });

    it('returns the same object across updates', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      const a = session.rates;
      session.update(5000);
      expect(session.rates).toBe(a);
    });

    it('is recomputed after a purchase changes tech levels', () => {
      const session = new GameSession({ state: withMe(withLevels({}), costAt(TECHNOLOGIES.gearRatio, 0)), now: () => 0 });
      expect(session.purchase('gearRatio').ok).toBe(true);
      expect(session.rates.perClick.me).toBe(1.5);
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
      expect(report).toEqual({
        elapsedSeconds: 3600,
        cappedSeconds: 3600,
        // WP27 re-pin (F2hi): Worn Motor 2 + 5 x Motor Tuning 0.9 = 6.5 ME/s x 3600 s = 23400 (was 120600 at 33.5 ME/s).
        gained: { ...emptyResourceMap(), me: 23400 },
      });
      expect(session.state.res.me).toBeCloseTo(23400, 9);
      expect(session.state.lastSimTime).toBe(3_600_000);

      session.update(3_600_000);
      expect(session.state.res.me).toBeCloseTo(23400, 9);
      expect(log).toEqual(['offline:23400']);
    });

    it('reports only ME for a motor save and credits res and lifetime', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }),
        now: () => 0,
      });
      const report = session.applyOffline(10_000);
      // WP27 re-pin (F2hi): 10 s x 2 ME/s = 20 (was 170 at 17 ME/s).
      expect(report.gained.me).toBeCloseTo(20, 9);
      expect(report.gained.ee).toBe(0);
      expect(report.gained.pr).toBe(0);
      expect(report.gained.rs).toBe(0);
      expect(report.gained.xf).toBe(0);
      expect(session.state.res.me).toBeCloseTo(20, 9);
      expect(session.state.lifetime.me).toBeCloseTo(20, 9);
      expect(session.state.res.ee).toBe(0);
    });

    it('caps at the offline limit', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1, motorTuning: 5 }, { lastSimTime: 0 }),
        now: () => 0,
      });
      const report = session.applyOffline(10 * 3_600_000);
      expect(report.cappedSeconds).toBe(28800);
      // WP27 re-pin (F2hi): 28800 s x 6.5 ME/s = 187200 (was 964800 at 33.5 ME/s).
      expect(report.gained.me).toBeCloseTo(187200, 9);
      expect(session.state.res.me).toBeCloseTo(187200, 9);
    });

    it('still emits offline when nothing is gained', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const log = record(session);
      const report = session.applyOffline(1000);
      expect(report.gained.me).toBe(0);
      expect(log).toEqual(['offline:0']);
    });

    it('credits nothing for a non-finite time and keeps lastSimTime', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1 }, { lastSimTime: 500 }),
        now: () => 0,
      });
      const report = session.applyOffline(Number.NaN);
      expect(report.gained.me).toBe(0);
      expect(session.state.lastSimTime).toBe(500);
      expect(session.state.res.me).toBe(0);
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
      const firstCost = costAt(TECHNOLOGIES.gearRatio, 0);
      for (let i = 0; i < firstCost; i++) session.click();
      expect(session.state.res.me).toBe(firstCost);

      const log = record(session);
      const first = session.purchase('gearRatio');
      expect(first).toMatchObject({ ok: true, cost: firstCost, newLevel: 1 });
      expect(session.state.res.me).toBe(0);
      expect(session.rates.perClick.me).toBe(1.5);
      expect(log).toEqual([`purchase:gearRatio:1:${firstCost}`, 'unlock:gearRatio']);

      const secondCost = costAt(TECHNOLOGIES.gearRatio, 1);
      while (session.state.res.me < secondCost) session.click();
      expect(session.state.res.me).toBeGreaterThanOrEqual(secondCost);

      log.length = 0;
      const second = session.purchase('gearRatio');
      expect(second).toMatchObject({ ok: true, cost: secondCost, newLevel: 2 });
      expect(log).toEqual([`purchase:gearRatio:2:${secondCost}`]);
    });

    it('purchase event carries the costRes of the tech (ME for era I)', () => {
      const session = new GameSession({ state: withMe(withLevels({}), costAt(TECHNOLOGIES.gearRatio, 0)), now: () => 0 });
      const payloads: { id: TechId; level: number; cost: number; res: string }[] = [];
      session.on('purchase', (p) => payloads.push(p));
      expect(session.purchase('gearRatio').ok).toBe(true);
      expect(payloads).toEqual([{ id: 'gearRatio', level: 1, cost: costAt(TECHNOLOGIES.gearRatio, 0), res: 'me' }]);
    });

    it('emits milestone events in order when a purchase completes a milestone', () => {
      const session = new GameSession({
        state: withMe(
          withLevels({ gearRatio: 3, reinforcedCrank: 1, wornMotor: 1, motorTuning: 5, pistonArray: 1 }, { lastSimTime: 0 }),
          5000,
          // WP27 re-pin (F2hi): Generator Blueprint's lifetime ME requirement is 400000 (was 240000).
          400000,
        ),
        now: () => 0,
      });
      session.applyOffline(0);
      const log = record(session);
      const result = session.purchase('flywheel');
      expect(result).toMatchObject({ ok: true, cost: 4000 });
      expect(session.state.res.me).toBe(1000);
      expect(session.state.techLevels.generatorBlueprint).toBe(1);
      expect(log).toEqual([
        'purchase:flywheel:1:4000',
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
      expect(second).toHaveBeenCalledWith({ gained: 1, gainedAll: { ...emptyResourceMap(), me: 1 } });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('returns to a fresh game at the given time and emits reset once', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      for (let i = 0; i < costAt(TECHNOLOGIES.gearRatio, 0); i++) session.click();
      session.purchase('gearRatio');
      const log = record(session);

      session.reset(5000);
      expect(session.state.res).toEqual(emptyResourceMap());
      expect(session.state.lifetime).toEqual(emptyResourceMap());
      expect(session.state.totalClicks).toBe(0);
      expect(session.state.techLevels).toEqual(createInitialState(0).techLevels);
      expect(session.state.lastSimTime).toBe(5000);
      expect(session.rates.perClick.me).toBe(1);
      expect(log).toEqual(['reset']);
    });

    it('treats the fresh state as offline-applied: the next update is a normal step', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.reset(5000);
      const log = record(session);
      session.update(5500);
      expect(log).toEqual([]);
      expect(session.state.res.me).toBe(0);
    });
  });

  describe('views', () => {
    it('returns one tech view per TECH_IDS entry and gearRatio is available initially', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      expect(session.getAllTechViews()).toHaveLength(TECH_IDS.length);
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
      expect(typeof api.emptyResourceMap).toBe('function');
      expect(typeof api.addMaps).toBe('function');
      expect(typeof api.scaleMap).toBe('function');
    });
  });
});
