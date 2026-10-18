import { describe, it, expect, afterEach, vi } from 'vitest';
import type { GameState, PrestigeState, TechId } from '../data/types';
import { OFFLINE_CAP_SECONDS } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { GameSession } from './GameSession';
import { computeRates } from './production/rates';
import { createInitialState } from './state';
import { emptyResourceMap } from './resources';
import { DEFAULT_PRESTIGE, cycleTechs } from './prestige';

// WP14 C3: GameSession prestige integration (beginNewCycle, buyPerk, prestige option, reset).

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// A finished run: the reveal applies from the choice phase on. Lifetime xf sets the Echo count.
const revealedState = (
  extra: Partial<GameState> = {},
  levels: Partial<Record<TechId, number>> = {},
): GameState =>
  withLevels(levels, {
    createdAt: 0,
    lastSimTime: 0,
    ending: { phase: 'choice', engagedAt: 600_000 },
    ...extra,
  });

const prestige = (p: Partial<PrestigeState>): PrestigeState => ({ ...DEFAULT_PRESTIGE, perks: [], ...p });

// Records the prestige-related events in emission order as compact strings.
const record = (session: GameSession): string[] => {
  const log: string[] = [];
  session.on('reset', () => log.push('reset'));
  session.on('cycle', (p) => log.push(`cycle:${p.cycle}:${p.echoesGained}:${p.echoesEarned}`));
  session.on('achievement', (p) => log.push(`achievement:${p.ids.join(',')}`));
  session.on('unlock', (p) => log.push(`unlock:${p.id}`));
  session.on('prestige', (p) => log.push(`prestige:${p.prestige.echoesEarned}:${p.prestige.perks.length}`));
  return log;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GameSession prestige (WP14)', () => {
  describe('defaults and constructor', () => {
    it('a default session has DEFAULT_PRESTIGE and the unmodified tech table', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      expect(session.prestige).toEqual(DEFAULT_PRESTIGE);
      expect(session.techs).toBe(TECHNOLOGIES);
      expect(session.stats.cycles).toBe(1);
    });

    it('normalizes the prestige option leniently (over-spend drops the last perk)', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: { cycle: 2, echoesEarned: 1, perks: ['ledger'] },
        now: () => 0,
      });
      expect(session.prestige).toEqual({ cycle: 2, echoesEarned: 1, perks: [] });
    });

    it('sets stats.cycles from the prestige cycle', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ cycle: 3, echoesEarned: 6 }),
        now: () => 0,
      });
      expect(session.stats.cycles).toBe(3);
    });

    it('builds the tech table for the owned perks at construction', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 3, perks: ['residualCharge'] }),
        now: () => 0,
      });
      expect(session.techs).not.toBe(TECHNOLOGIES);
      expect(session.techs).toEqual(cycleTechs(TECHNOLOGIES, session.prestige));
    });
  });

  describe('beginNewCycle', () => {
    it('returns false with no events and no change before the reveal', () => {
      for (const phase of ['none', 'sequence'] as const) {
        const state = withLevels({}, { ending: { phase, engagedAt: phase === 'none' ? null : 1 } });
        const session = new GameSession({ state, now: () => 0 });
        const log = record(session);
        expect(session.beginNewCycle(1_000)).toBe(false);
        expect(log).toEqual([]);
        expect(session.state).toBe(state);
        expect(session.prestige).toEqual(DEFAULT_PRESTIGE);
      }
    });

    it('from the revealed run: emits reset, then cycle, then the achievement check', () => {
      const session = new GameSession({ state: revealedState(), now: () => 0 });
      const log = record(session);
      expect(session.beginNewCycle(700_000)).toBe(true);
      expect(log).toEqual(['reset', 'cycle:2:3:3', 'achievement:newCycle']);
    });

    it('resets the run: resources, lifetime, clicks and ending; sets createdAt and lastSimTime to now', () => {
      const session = new GameSession({
        state: revealedState({ res: { ...emptyResourceMap(), me: 500 }, totalClicks: 42 }, { wornMotor: 2 }),
        now: () => 0,
      });
      session.beginNewCycle(700_000);
      expect(session.state.res).toEqual(emptyResourceMap());
      expect(session.state.lifetime).toEqual(emptyResourceMap());
      expect(session.state.totalClicks).toBe(0);
      expect(session.state.ending).toEqual({ phase: 'none', engagedAt: null });
      expect(session.state.createdAt).toBe(700_000);
      expect(session.state.lastSimTime).toBe(700_000);
      expect(session.state.techLevels.wornMotor).toBe(0);
      expect(session.state.techLevels.handCrank).toBe(1);
    });

    it('applies the owned perks start levels to the new run', () => {
      const session = new GameSession({
        state: revealedState(),
        prestige: prestige({ echoesEarned: 3, perks: ['muscleMemory'] }),
        now: () => 0,
      });
      session.beginNewCycle(700_000);
      expect(session.state.techLevels.wornMotor).toBe(1);
      expect(session.state.techLevels.gearRatio).toBe(3);
    });

    it('keeps the owned perks, adds the gained Echoes and bumps the cycle', () => {
      const session = new GameSession({
        state: revealedState({ lifetime: { ...emptyResourceMap(), xf: 3e9 } }),
        prestige: prestige({ cycle: 2, echoesEarned: 3, perks: ['residualCharge'] }),
        now: () => 0,
      });
      const log = record(session);
      expect(session.beginNewCycle(700_000)).toBe(true);
      expect(session.prestige).toEqual({ cycle: 3, echoesEarned: 7, perks: ['residualCharge'] });
      expect(log[1]).toBe('cycle:3:4:7');
      expect(session.techs).toEqual(cycleTechs(TECHNOLOGIES, session.prestige));
    });

    it('keeps settings, cumulative stats and achievements', () => {
      const session = new GameSession({
        state: revealedState(),
        settings: { muted: true },
        achievements: { unlocked: { shortNap: 77 } },
        now: () => 0,
      });
      session.click();
      session.click();
      const before = session.stats;
      session.beginNewCycle(700_000);

      expect(session.settings.muted).toBe(true);
      expect(session.achievements.unlocked.shortNap).toBe(77);
      expect(session.achievements.unlocked.newCycle).toBeTypeOf('number');
      expect(session.stats.clicks).toBe(before.clicks);
      expect(session.stats.purchases).toBe(before.purchases);
      expect(session.stats.activeSeconds).toBe(before.activeSeconds);
      expect(session.stats.lifetime).toEqual(before.lifetime);
      expect(session.stats.startedAt).toBe(before.startedAt);
      expect(session.stats.cycles).toBe(2);
    });

    it('records bestCycleSeconds as the minimum wall-clock run over the cycles', () => {
      // First run: created at 0, ending engaged at 600 000 ms -> 600 s.
      const first = new GameSession({ state: revealedState(), now: () => 0 });
      first.beginNewCycle(700_000);
      expect(first.stats.bestCycleSeconds).toBe(600);

      // Second run: created at 700 000, engaged at 1 000 000 ms -> 300 s. Best drops to 300.
      const secondState = revealedState(
        { createdAt: 700_000, lastSimTime: 1_000_000, ending: { phase: 'choice', engagedAt: 1_000_000 } },
      );
      const second = new GameSession({
        state: secondState,
        stats: first.stats,
        prestige: first.prestige,
        now: () => 0,
      });
      second.beginNewCycle(1_100_000);
      expect(second.stats.bestCycleSeconds).toBe(300);
      expect(second.stats.cycles).toBe(3);
      expect(second.prestige.cycle).toBe(3);
    });

    it('keeps the best when the next run is slower', () => {
      const session = new GameSession({
        state: revealedState({ createdAt: 0, ending: { phase: 'choice', engagedAt: 100_000 } }),
        now: () => 0,
      });
      session.beginNewCycle(200_000);
      expect(session.stats.bestCycleSeconds).toBe(100);

      const slowerState = revealedState({ createdAt: 200_000, ending: { phase: 'choice', engagedAt: 900_000 } });
      const slower = new GameSession({ state: slowerState, stats: session.stats, prestige: session.prestige, now: () => 0 });
      slower.beginNewCycle(1_000_000);
      expect(slower.stats.bestCycleSeconds).toBe(100);
    });
  });

  describe('buyPerk', () => {
    it('fails with insufficient Echoes: nothing changes, no events', () => {
      const session = new GameSession({ state: createInitialState(0), now: () => 0 });
      const log = record(session);
      const state = session.state;
      const revision = session.revision;
      expect(session.buyPerk('ledger')).toEqual({ ok: false, reason: 'insufficient' });
      expect(session.state).toBe(state);
      expect(session.revision).toBe(revision);
      expect(session.prestige).toEqual(DEFAULT_PRESTIGE);
      expect(log).toEqual([]);
    });

    it('fails when the perk is already owned', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 5, perks: ['residualCharge'] }),
        now: () => 0,
      });
      expect(session.buyPerk('residualCharge')).toEqual({ ok: false, reason: 'owned' });
      expect(session.prestige.perks).toEqual(['residualCharge']);
    });

    it('success: unlocks the start levels, then emits prestige, bumps the revision', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 3 }),
        now: () => 0,
      });
      const log = record(session);
      const revision = session.revision;
      const result = session.buyPerk('muscleMemory');
      expect(result.ok).toBe(true);
      expect(session.prestige.perks).toEqual(['muscleMemory']);
      expect(session.state.techLevels.wornMotor).toBe(1);
      expect(session.revision).toBeGreaterThan(revision);
      const unlockIndex = log.indexOf('unlock:wornMotor');
      const prestigeIndex = log.indexOf('prestige:3:1');
      expect(unlockIndex).toBeGreaterThanOrEqual(0);
      expect(prestigeIndex).toBeGreaterThan(unlockIndex);
    });

    it('recomputes rates even when techLevels are unchanged (Servo Recall)', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 3 }),
        now: () => 0,
      });
      const levels = session.state.techLevels;
      const before = session.rates.perSecond.me;
      expect(session.buyPerk('servoRecall').ok).toBe(true);
      expect(session.state.techLevels).toBe(levels);
      expect(session.rates.perSecond.me).toBeGreaterThan(before);
      expect(session.rates.perSecond.me).toBeCloseTo(computeRates(session.state, session.techs).perSecond.me, 9);
    });

    it('emits prestige carrying the new perk list', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 3 }),
        now: () => 0,
      });
      const log = record(session);
      session.buyPerk('servoRecall');
      expect(log).toContain('prestige:3:1');
      expect(session.prestige.perks).toEqual(['servoRecall']);
    });

    it('Ledger halves the generator cost', () => {
      const base = new GameSession({ state: createInitialState(0), now: () => 0 }).getTechView('generator').nextCost;
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 3 }),
        now: () => 0,
      });
      expect(session.buyPerk('ledger').ok).toBe(true);
      expect(session.getTechView('generator').nextCost).toBeCloseTo((base ?? Number.NaN) * 0.5, 9);
    });

    it('Long Silence raises the offline cap', () => {
      const session = new GameSession({
        state: withLevels({ wornMotor: 1 }, { lastSimTime: 0 }),
        prestige: prestige({ echoesEarned: 2 }),
        now: () => 0,
      });
      expect(session.buyPerk('longSilence').ok).toBe(true);
      const report = session.applyOffline(24 * 3_600_000);
      expect(report.cappedSeconds).toBe(OFFLINE_CAP_SECONDS + 4 * 3600);
    });

    it('Residual Charge builds a new tech table and never mutates the shared one', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 2 }),
        now: () => 0,
      });
      const snapshot = JSON.stringify(TECHNOLOGIES);
      expect(session.buyPerk('residualCharge').ok).toBe(true);
      expect(session.techs).not.toBe(TECHNOLOGIES);
      expect(JSON.stringify(TECHNOLOGIES)).toBe(snapshot);
    });
  });

  describe('reset', () => {
    it('returns prestige to DEFAULT_PRESTIGE and the tech table to TECHNOLOGIES', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ cycle: 3, echoesEarned: 6, perks: ['ledger'] }),
        now: () => 0,
      });
      expect(session.techs).not.toBe(TECHNOLOGIES);
      session.reset(5_000);
      expect(session.prestige).toEqual(DEFAULT_PRESTIGE);
      expect(session.techs).toBe(TECHNOLOGIES);
      expect(session.stats.cycles).toBe(1);
    });

    it('emits only reset (no prestige event)', () => {
      const session = new GameSession({
        state: createInitialState(0),
        prestige: prestige({ echoesEarned: 3, perks: ['muscleMemory'] }),
        now: () => 0,
      });
      const log = record(session);
      session.reset(5_000);
      expect(log).toEqual(['reset']);
    });
  });
});
