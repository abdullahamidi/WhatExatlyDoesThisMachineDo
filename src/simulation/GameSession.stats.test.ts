import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS_VALUES } from '../data/settings';
import type { GameState, SettingsState, StatsState, TechId } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import { GameSession } from './GameSession';
import { costAt } from './economy/cost';
import { createInitialState } from './state';
import { emptyStats } from './stats';

// Deterministic clock only: every session gets an explicit `now` (no real time).

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Sets the spendable `me` and the lifetime `me` to the same amount.
const withMe = (state: GameState, me: number): GameState => ({
  ...state,
  res: { ...state.res, me },
  lifetime: { ...state.lifetime, me },
});

describe('GameSession stats', () => {
  describe('counters', () => {
    it('counts every click', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      session.click();
      session.click();
      session.click();
      expect(session.stats.clicks).toBe(3);
    });

    it('counts a successful purchase', () => {
      const session = new GameSession({
        state: withMe(withLevels({}), costAt(TECHNOLOGIES.gearRatio, 0)),
        now: () => 0,
      });
      expect(session.purchase('gearRatio').ok).toBe(true);
      expect(session.stats.purchases).toBe(1);
    });

    it('does not count a failed purchase', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      expect(session.purchase('gearRatio').ok).toBe(false);
      expect(session.stats.purchases).toBe(0);
    });
  });

  describe('time', () => {
    it('adds each live step to activeSeconds and nothing when no time passed', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(0);
      session.update(5000);
      expect(session.stats.activeSeconds).toBeCloseTo(5, 9);
      session.update(5000);
      expect(session.stats.activeSeconds).toBeCloseTo(5, 9);
    });

    it('adds nothing to activeSeconds when the clock went backwards', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 10_000 }), now: () => 0 });
      session.applyOffline(10_000);
      session.update(5000);
      expect(session.stats.activeSeconds).toBe(0);
    });

    it('adds nothing to activeSeconds on the offline path', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      session.update(36_000_000);
      expect(session.stats.activeSeconds).toBe(0);
      expect(session.stats.offlineSeconds).toBeGreaterThan(0);
    });

    it('applyOffline credits the capped seconds and keeps the longest elapsed gap', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      const first = session.applyOffline(36_000_000);
      expect(session.stats.offlineSeconds).toBeCloseTo(first.cappedSeconds, 9);
      expect(session.stats.longestOfflineSeconds).toBeCloseTo(first.elapsedSeconds, 9);
      expect(first.cappedSeconds).toBeLessThan(first.elapsedSeconds);

      const second = session.applyOffline(36_000_000 + 3_600_000);
      expect(session.stats.offlineSeconds).toBeCloseTo(first.cappedSeconds + second.cappedSeconds, 9);
      expect(session.stats.longestOfflineSeconds).toBeCloseTo(first.elapsedSeconds, 9);
    });
  });

  describe('lifetime', () => {
    it('grows with clicks and automation but not with spending', () => {
      const session = new GameSession({
        state: withMe(withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), costAt(TECHNOLOGIES.gearRatio, 0)),
        now: () => 0,
      });
      session.applyOffline(0);
      const start = session.stats.lifetime.me;

      expect(session.purchase('gearRatio').ok).toBe(true);
      expect(session.stats.lifetime.me).toBe(start);

      const gained = session.click();
      expect(session.stats.lifetime.me).toBeCloseTo(start + gained, 9);

      const beforeUpdate = session.stats.lifetime.me;
      session.update(1000);
      expect(session.stats.lifetime.me).toBeGreaterThan(beforeUpdate);
    });
  });

  describe('maxPerSecond', () => {
    it('is set at construction from the current rates', () => {
      const session = new GameSession({ state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }), now: () => 0 });
      expect(session.stats.maxPerSecond.me).toBeGreaterThan(0);
      expect(session.stats.maxPerSecond.me).toBeCloseTo(session.rates.perSecond.me, 9);
    });

    it('rises after a rate-raising purchase', () => {
      const session = new GameSession({
        state: withMe(withLevels({}, { lastSimTime: 0 }), costAt(TECHNOLOGIES.wornMotor, 0)),
        now: () => 0,
      });
      session.applyOffline(0);
      const before = session.stats.maxPerSecond.me;
      expect(session.purchase('wornMotor').ok).toBe(true);
      expect(session.stats.maxPerSecond.me).toBeGreaterThan(before);
      expect(session.stats.maxPerSecond.me).toBeCloseTo(session.rates.perSecond.me, 9);
    });
  });

  describe('reset', () => {
    it('zeros stats and clears achievements but keeps settings', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 500 });
      session.click();
      session.updateSettings({ masterVolume: 40 });
      expect(session.achievements.unlocked.firstTurn).toBe(500);

      session.reset(900);
      expect(session.stats).toEqual(emptyStats(900));
      expect(session.achievements).toEqual({ unlocked: {} });
      expect(session.settings.masterVolume).toBe(40);
    });
  });

  describe('options', () => {
    it('honours the stats and achievements options', () => {
      const custom: StatsState = { ...emptyStats(10), clicks: 42, purchases: 3 };
      const session = new GameSession({
        state: createInitialState(0),
        stats: custom,
        achievements: { unlocked: { firstTurn: 5 } },
        now: () => 1000,
      });
      expect(session.stats).toEqual(custom);
      expect(session.achievements).toEqual({ unlocked: { firstTurn: 5 } });

      const events: string[] = [];
      session.on('achievement', (p) => events.push(p.ids.join(',')));
      session.click();
      expect(session.stats.clicks).toBe(43);
      expect(session.achievements.unlocked.firstTurn).toBe(5);
      expect(events).toEqual([]);
    });

    it('derives the default stats from the state', () => {
      const state: GameState = {
        ...withLevels({}),
        totalClicks: 7,
        createdAt: 123,
        lifetime: { ...createInitialState(0).lifetime, me: 88 },
      };
      const session = new GameSession({ state, now: () => 999 });
      expect(session.stats.clicks).toBe(7);
      expect(session.stats.lifetime.me).toBe(88);
      expect(session.stats.startedAt).toBe(123);
      expect(session.achievements).toEqual({ unlocked: {} });
    });
  });

  describe('updateSettings', () => {
    it('is a no-op when every field is unchanged', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const before = session.settings;
      const revision = session.revision;
      const events: SettingsState[] = [];
      session.on('settings', (p) => events.push(p));

      session.updateSettings({ muted: false, masterVolume: 100, notation: 'suffix' });
      expect(session.settings).toBe(before);
      expect(session.revision).toBe(revision);
      expect(events).toEqual([]);
    });

    it('is a no-op for a volume that clamps back to the current value', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const before = session.settings;
      session.updateSettings({ masterVolume: 150 });
      expect(session.settings).toBe(before);
    });

    it('replaces the settings object and emits settings once for a multi-field change', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const before = session.settings;
      const events: SettingsState[] = [];
      session.on('settings', (p) => events.push(p));
      const revision = session.revision;

      session.updateSettings({ masterVolume: 50, sfxVolume: 20, notation: 'scientific', reducedMotion: true });
      expect(session.settings).not.toBe(before);
      expect(session.revision).toBeGreaterThan(revision);
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(session.settings);
      expect(session.settings).toEqual({
        ...DEFAULT_SETTINGS_VALUES,
        masterVolume: 50,
        sfxVolume: 20,
        notation: 'scientific',
        reducedMotion: true,
      });
    });

    it('normalizes volumes: rounds, clamps and falls back on non-finite values', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      session.updateSettings({ masterVolume: 72.6 });
      expect(session.settings.masterVolume).toBe(73);
      session.updateSettings({ ambientVolume: -5 });
      expect(session.settings.ambientVolume).toBe(0);
      session.updateSettings({ sfxVolume: Number.NaN });
      expect(session.settings.sfxVolume).toBe(100);
    });

    it('ignores an unknown enum value and keeps the current one', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const before = session.settings;
      session.updateSettings({ notation: 'bogus' as unknown as SettingsState['notation'] });
      expect(session.settings).toBe(before);
      expect(session.settings.notation).toBe('suffix');
    });
  });

  describe('achievement event', () => {
    it('unlocks firstTurn on the first click, stamps it with the clock and emits once', () => {
      let now = 777;
      const session = new GameSession({ state: createInitialState(0), now: () => now });
      const events: string[] = [];
      session.on('achievement', (p) => events.push(p.ids.join(',')));

      session.click();
      expect(session.achievements.unlocked.firstTurn).toBe(777);
      expect(events).toEqual(['firstTurn']);

      now = 800;
      session.click();
      expect(events).toEqual(['firstTurn']);
      expect(session.achievements.unlocked.firstTurn).toBe(777);
    });

    it('is not evaluated in the constructor', () => {
      const events: string[] = [];
      const session = new GameSession({
        state: withLevels({ pistonArray: 1 }, { lastSimTime: 0 }),
        now: () => 0,
      });
      session.on('achievement', (p) => events.push(p.ids.join(',')));
      expect(session.achievements).toEqual({ unlocked: {} });
      expect(events).toEqual([]);
    });

    it('coalesces several unlocks into one event in list order, after the milestone events', () => {
      const session = new GameSession({
        state: withLevels(
          { pistonArray: 1, flywheel: 1 },
          // WP27 re-pin (F2hi): Generator Blueprint's lifetime ME requirement is 400000 (was 240000).
          { lastSimTime: 0, lifetime: { ...createInitialState(0).lifetime, me: 400_000 } },
        ),
        now: () => 0,
      });
      const order: string[] = [];
      session.on('click', () => order.push('click'));
      session.on('unlock', (p) => order.push(`unlock:${p.id}`));
      session.on('milestone', (p) => order.push(`milestone:${p.id}`));
      session.on('achievement', (p) => order.push(`achievement:${p.ids.join(',')}`));

      session.click();
      expect(order).toEqual([
        'click',
        'unlock:generatorBlueprint',
        'milestone:generatorBlueprint',
        'achievement:firstTurn,fullStroke,blueprint',
      ]);
    });

    it('fires from a purchase when a tech condition is met', () => {
      const session = new GameSession({
        state: withMe(withLevels({}, { lastSimTime: 0 }), costAt(TECHNOLOGIES.wornMotor, 0)),
        now: () => 0,
      });
      session.applyOffline(0);
      const events: string[] = [];
      session.on('achievement', (p) => events.push(p.ids.join(',')));
      expect(session.purchase('wornMotor').ok).toBe(true);
      expect(events).toEqual(['wornMotor']);
    });

    it('fires from an update step when a stat condition is met', () => {
      const session = new GameSession({ state: withLevels({}, { lastSimTime: 0 }), now: () => 0 });
      session.applyOffline(0);
      const events: string[] = [];
      session.on('achievement', (p) => events.push(p.ids.join(',')));
      // 72 steps of 50 s: each step is under the offline threshold, so all count as active time.
      for (let i = 1; i <= 72; i += 1) session.update(i * 50_000);
      expect(session.stats.activeSeconds).toBe(3600);
      expect(events).toEqual(['shiftWorker']);
    });

    it('fires again after reset cleared the achievements', () => {
      let now = 0;
      const session = new GameSession({ state: createInitialState(0), now: () => now });
      const events: string[] = [];
      session.on('achievement', (p) => events.push(p.ids.join(',')));
      session.click();
      now = 5;
      session.reset();
      session.click();
      expect(events).toEqual(['firstTurn', 'firstTurn']);
      expect(session.achievements.unlocked.firstTurn).toBe(5);
    });
  });
});
