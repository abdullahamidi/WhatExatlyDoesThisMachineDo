import { describe, it, expect, vi } from 'vitest';
import type { GameState, SettingsState } from '../data/types';
import type { WorldSaveState } from '../data/livingWorld';
import { AUTOSAVE_INTERVAL_MS, SAVE_KEY, SAVE_PREIMPORT_KEY } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { GameSession } from '../simulation';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { emptyResourceMap } from '../simulation/resources';
import { costAt } from '../simulation/economy/cost';
import { deserialize } from './codec';
import { encodeSave } from './exchange';
import { MemoryStorage, SaveManager } from './saveManager';
import type { KeyValueStorage } from './saveManager';
import { createSaveController } from './saveController';
import type { Scheduler } from './saveController';

const t0 = 1_700_000_000_000;

interface FakeTimer {
  fn: () => void;
  ms: number;
  cleared: boolean;
}

/** Records every interval; the test fires them by hand. */
class FakeScheduler implements Scheduler {
  readonly timers: FakeTimer[] = [];

  setInterval(fn: () => void, ms: number): unknown {
    const timer: FakeTimer = { fn, ms, cleared: false };
    this.timers.push(timer);
    return timer;
  }

  clearInterval(h: unknown): void {
    (h as FakeTimer).cleared = true;
  }

  get active(): FakeTimer[] {
    return this.timers.filter((t) => !t.cleared);
  }
}

/** MemoryStorage that counts writes to the save key. */
class CountingStorage extends MemoryStorage {
  writes = 0;

  override setItem(key: string, value: string): void {
    if (key === SAVE_KEY) this.writes += 1;
    super.setItem(key, value);
  }
}

class FailingWriteStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

const withMe = (me: number, muted = false): { state: GameState; settings: SettingsState } => ({
  state: {
    ...createInitialState(t0),
    res: { ...emptyResourceMap(), me },
    lifetime: { ...emptyResourceMap(), me },
  },
  settings: { ...DEFAULT_SETTINGS, muted },
});

function setup(storage: KeyValueStorage = new CountingStorage(), me = 1000) {
  const { state, settings } = withMe(me);
  const session = new GameSession({ state, settings, now: () => t0 });
  const saveManager = new SaveManager(storage);
  const scheduler = new FakeScheduler();
  const controller = createSaveController({ session, saveManager, now: () => t0, scheduler });
  return { session, saveManager, scheduler, controller, storage };
}

const writesOf = (storage: KeyValueStorage): number => (storage as CountingStorage).writes;

const storedSave = (storage: KeyValueStorage) => {
  const raw = storage.getItem(SAVE_KEY);
  return raw === null ? null : deserialize(raw, t0);
};

describe('stats, achievements and export / import (WP12)', () => {
  it('saveNow writes the session stats and achievements', () => {
    const { session, controller, storage } = setup();
    session.click();
    expect(controller.saveNow()).toBe(true);

    const saved = storedSave(storage);
    expect(saved?.stats.clicks).toBe(1);
    expect(saved?.achievements.unlocked.firstTurn).toBe(t0);
  });

  it("an 'achievement' event writes a save; a click that unlocks nothing does not", () => {
    const { session, controller, storage } = setup();
    controller.start();

    const before = writesOf(storage);
    session.click(); // firstTurn unlocks on the first click
    expect(writesOf(storage) - before).toBe(1);

    const again = writesOf(storage);
    session.click(); // steadyHand needs 100 clicks: nothing new
    expect(writesOf(storage)).toBe(again);
  });

  it('exportString then importString restores state, stats and achievements; settings stay the current ones', () => {
    const source = setup(new MemoryStorage(), 5000);
    source.session.setMuted(true);
    expect(source.session.purchase('gearRatio').ok).toBe(true);
    source.session.click();
    const text = source.controller.exportString();

    const target = setup(new MemoryStorage(), 10);
    expect(target.controller.importString(text)).toEqual({ ok: true });

    const saved = storedSave(target.storage);
    expect(saved?.status).toBe('loaded');
    expect(saved?.state).toEqual(source.session.state);
    expect(saved?.stats).toEqual(source.session.stats);
    expect(saved?.achievements).toEqual(source.session.achievements);
    expect(saved?.settings.muted).toBe(false);
  });

  it('saveNow writes the session living-world block (WP23a); recordWorld alone writes nothing', () => {
    const { session, controller, storage } = setup();
    const block: WorldSaveState = { seen: ['INS-01'], seenEver: ['INS-01'], eraMoments: [1, 0, 0, 0, 0], youEras: 0 };
    const before = writesOf(storage);
    session.recordWorld(block);
    expect(writesOf(storage)).toBe(before);
    expect(controller.saveNow()).toBe(true);
    expect(storedSave(storage)?.world).toEqual(block);
  });

  it('exportString then importString keeps the living-world block (WP23a)', () => {
    const source = setup(new MemoryStorage(), 5000);
    source.session.recordWorld({
      seen: ['INS-01', 'CRW-01'],
      seenEver: ['INS-01', 'CRW-01', 'beat.tapeFreeze'],
      eraMoments: [2, 0, 0, 0, 0],
      youEras: 1,
    });
    const text = source.controller.exportString();

    const target = setup(new MemoryStorage(), 10);
    expect(target.controller.importString(text)).toEqual({ ok: true });
    expect(storedSave(target.storage)?.world).toEqual(source.session.world);
  });

  it('an invalid import returns an error and leaves storage byte-identical', () => {
    const { controller, storage } = setup(new MemoryStorage(), 1000);
    controller.saveNow();
    const before = storage.getItem(SAVE_KEY);
    const badTexts = [
      '',
      '   ',
      'not a save!!',
      'AAA',
      '{"version":2,',
      encodeSave('[]'),
      encodeSave('{"version":2'),
      encodeSave(JSON.stringify({ version: 3, savedAt: 1, state: {} })),
      encodeSave(JSON.stringify({ version: 2, savedAt: 1, state: { res: { me: -5 } } })),
    ];
    for (const text of badTexts) {
      const result = controller.importString(text);
      expect(result.ok, text).toBe(false);
      if (result.ok) continue;
      expect(result.error.length, text).toBeGreaterThan(0);
      expect(result.error.length, text).toBeLessThanOrEqual(80);
    }
    expect(storage.getItem(SAVE_KEY)).toBe(before);
    expect(storage.getItem(SAVE_PREIMPORT_KEY)).toBeNull();
    expect(controller.lastSaveOk).toBe(true);
  });

  it('a valid import backs up the previous save, then suspends every save path', () => {
    const source = setup(new MemoryStorage(), 9000);
    expect(source.session.purchase('gearRatio').ok).toBe(true);
    const text = source.controller.exportString();

    const target = setup();
    target.controller.saveNow();
    const previous = target.storage.getItem(SAVE_KEY);
    target.controller.start();

    expect(target.controller.importString(text)).toEqual({ ok: true });
    expect(target.storage.getItem(SAVE_PREIMPORT_KEY)).toBe(previous);
    expect(target.scheduler.active).toHaveLength(0);

    const writesAfterImport = writesOf(target.storage);
    const imported = target.storage.getItem(SAVE_KEY);
    expect(target.controller.saveNow()).toBe(false);
    target.session.setMuted(true);
    target.session.click();
    target.controller.start();
    expect(writesOf(target.storage)).toBe(writesAfterImport);
    expect(target.storage.getItem(SAVE_KEY)).toBe(imported);
    expect(target.scheduler.active).toHaveLength(0);
    expect(target.controller.lastSaveOk).toBe(true);
  });

  it('a refused write during import reports an error', () => {
    const source = setup(new MemoryStorage(), 9000);
    const text = source.controller.exportString();

    const target = setup(new FailingWriteStorage());
    const result = target.controller.importString(text);
    expect(result.ok).toBe(false);
    expect(target.controller.lastSaveOk).toBe(false);
  });
});

describe('createSaveController', () => {
  it('start() registers one interval at AUTOSAVE_INTERVAL_MS and the tick writes a save', () => {
    const { scheduler, controller, storage } = setup();
    controller.start();

    expect(scheduler.active).toHaveLength(1);
    expect(scheduler.active[0]?.ms).toBe(AUTOSAVE_INTERVAL_MS);

    storage.removeItem(SAVE_KEY);
    scheduler.active[0]?.fn();
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(controller.lastSaveOk).toBe(true);
  });

  it('double start() registers one interval and one subscription per event', () => {
    const { session, scheduler, controller, storage } = setup();
    controller.start();
    controller.start();
    expect(scheduler.active).toHaveLength(1);

    const before = writesOf(storage);
    session.purchase('gearRatio');
    expect(writesOf(storage) - before).toBe(1);
  });

  it("a 'purchase' event writes a save containing the purchase", () => {
    const { session, controller, storage } = setup();
    controller.start();
    expect(session.purchase('gearRatio').ok).toBe(true);

    const saved = storedSave(storage);
    expect(saved?.status).toBe('loaded');
    expect(saved?.state.techLevels.gearRatio).toBe(1);
  });

  it("a 'milestone' event writes a save", () => {
    const storage = new CountingStorage();
    // generatorBlueprint requires pistonArray and flywheel; the next click runs the milestone check.
    const base = createInitialState(t0);
    const session = new GameSession({
      state: {
        ...base,
        lifetime: { ...base.lifetime, me: 400000 },
        techLevels: { ...base.techLevels, pistonArray: 1, flywheel: 1 },
      },
      now: () => t0,
    });
    const controller = createSaveController({
      session,
      saveManager: new SaveManager(storage),
      now: () => t0,
      scheduler: new FakeScheduler(),
    });
    controller.start();
    const before = writesOf(storage);
    session.click();
    expect(session.state.techLevels.generatorBlueprint).toBe(1);
    // Milestone save, plus one achievement save: this click also unlocks firstTurn and blueprint.
    expect(writesOf(storage) - before).toBe(2);
    expect(session.achievements.unlocked.firstTurn).toBe(t0);
  });

  it("setMuted(true) writes a save with muted kept", () => {
    const { session, controller, storage } = setup();
    controller.start();
    session.setMuted(true);

    const saved = storedSave(storage);
    expect(saved?.settings.muted).toBe(true);
  });

  it('resetProgress() leaves a fresh save with muted kept and emits reset', () => {
    const { session, controller, storage } = setup(new MemoryStorage(), 5000);
    session.setMuted(true);
    session.purchase('gearRatio');
    let resets = 0;
    session.on('reset', () => {
      resets += 1;
    });

    controller.resetProgress();

    expect(resets).toBe(1);
    const saved = storedSave(storage);
    expect(saved?.status).toBe('loaded');
    expect(saved?.state.res.me).toBe(0);
    expect(saved?.state.techLevels.handCrank).toBe(1);
    expect(saved?.state.techLevels.gearRatio).toBe(0);
    expect(saved?.settings.muted).toBe(true);
    expect(controller.lastSaveOk).toBe(true);
  });

  it('dispose() clears the interval and later events do not save', () => {
    const { session, scheduler, controller, storage } = setup();
    controller.start();
    controller.dispose();

    expect(scheduler.timers[0]?.cleared).toBe(true);
    expect(scheduler.active).toHaveLength(0);

    const before = writesOf(storage);
    session.purchase('gearRatio');
    session.setMuted(true);
    expect(writesOf(storage)).toBe(before);
  });

  it('dispose() is idempotent and start() works again after it', () => {
    const { session, scheduler, controller, storage } = setup();
    controller.start();
    controller.dispose();
    controller.dispose();

    controller.start();
    expect(scheduler.active).toHaveLength(1);
    const before = writesOf(storage);
    session.setMuted(true);
    expect(writesOf(storage) - before).toBe(1);
  });

  it('a throwing storage makes saveNow() false and lastSaveOk false without throwing', () => {
    const { controller } = setup(new FailingWriteStorage());
    expect(() => controller.saveNow()).not.toThrow();
    expect(controller.saveNow()).toBe(false);
    expect(controller.lastSaveOk).toBe(false);
  });

  it('lastSaveOk is null before the first save', () => {
    const { controller } = setup();
    expect(controller.lastSaveOk).toBeNull();
  });

  it('saveNow() skips the write, reports false and warns once when a counter is non-finite', () => {
    const base = createInitialState(t0);
    const cases: Array<{ field: string; state: GameState }> = [
      { field: 'lastSimTime', state: { ...base, lastSimTime: Number.NaN } },
      { field: 'totalClicks', state: { ...base, totalClicks: Number.NaN } },
      { field: 'res.me', state: { ...base, res: { ...base.res, me: Number.NaN } } },
      { field: 'res.ee', state: { ...base, res: { ...base.res, ee: Number.NaN } } },
      { field: 'lifetime.me', state: { ...base, lifetime: { ...base.lifetime, me: Number.NaN } } },
      { field: 'lifetime.xf', state: { ...base, lifetime: { ...base.lifetime, xf: Number.NaN } } },
    ];
    for (const { field, state } of cases) {
      const storage = new CountingStorage();
      const session = new GameSession({ state, settings: { ...DEFAULT_SETTINGS, muted: false }, now: () => t0 });
      const controller = createSaveController({
        session,
        saveManager: new SaveManager(storage),
        now: () => t0,
        scheduler: new FakeScheduler(),
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        expect(controller.saveNow(), field).toBe(false);
        expect(controller.saveNow(), field).toBe(false);
        expect(controller.lastSaveOk, field).toBe(false);
        expect(writesOf(storage), field).toBe(0);
        expect(storage.getItem(SAVE_KEY), field).toBeNull();
        expect(warn, field).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    }
  });

  it('saveNow() writes again once the counters are finite', () => {
    const storage = new CountingStorage();
    const state = { ...createInitialState(t0), lastSimTime: Number.POSITIVE_INFINITY };
    const session = new GameSession({ state, settings: { ...DEFAULT_SETTINGS, muted: false }, now: () => t0 });
    const controller = createSaveController({
      session,
      saveManager: new SaveManager(storage),
      now: () => t0,
      scheduler: new FakeScheduler(),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(controller.saveNow()).toBe(false);
      session.reset(t0);
      expect(controller.saveNow()).toBe(true);
      expect(controller.lastSaveOk).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('finale saves (WP13)', () => {
  it("'ending' events write a save at each step: sequence on purchase, then choice, then postgame", () => {
    const storage = new CountingStorage();
    const base = createInitialState(t0);
    const xf = costAt(TECHNOLOGIES.primaryFunction, 0);
    const session = new GameSession({
      state: {
        ...base,
        lastSimTime: t0,
        techLevels: { ...base.techLevels, finalAlignment: 1 },
        res: { ...base.res, xf },
        lifetime: { ...base.lifetime, xf },
      },
      now: () => t0,
    });
    const controller = createSaveController({
      session,
      saveManager: new SaveManager(storage),
      now: () => t0,
      scheduler: new FakeScheduler(),
    });
    controller.start();

    // Raw JSON: a loaded 'sequence' is normalized to 'choice', so read what was written.
    const storedEnding = (): unknown => (JSON.parse(storage.getItem(SAVE_KEY) ?? 'null') as { state: { ending: unknown } }).state.ending;

    expect(session.purchase('primaryFunction').ok).toBe(true);
    expect(storedEnding()).toEqual({ phase: 'sequence', engagedAt: t0 });

    const beforeChoice = writesOf(storage);
    expect(session.finishEndingSequence()).toBe(true);
    expect(writesOf(storage) - beforeChoice).toBe(1);
    expect(storedEnding()).toEqual({ phase: 'choice', engagedAt: t0 });

    expect(session.keepRunning()).toBe(true);
    expect(storedEnding()).toEqual({ phase: 'postgame', engagedAt: t0 });
  });

  it('a refused ending step writes nothing', () => {
    const { session, controller, storage } = setup();
    controller.start();
    const before = writesOf(storage);
    expect(session.finishEndingSequence()).toBe(false);
    expect(session.keepRunning()).toBe(false);
    expect(writesOf(storage)).toBe(before);
  });
});

describe('prestige saves (WP14)', () => {
  const DEFAULT_BLOCK = { cycle: 1, echoesEarned: 0, perks: [] };

  /** A revealed run (ending 'choice') so beginNewCycle is allowed. */
  const revealedState = (): GameState => ({
    ...createInitialState(t0),
    ending: { phase: 'choice', engagedAt: t0 },
  });

  it("a 'cycle' event writes the new cycle, its Echoes and the fresh run", () => {
    const storage = new CountingStorage();
    const session = new GameSession({ state: revealedState(), now: () => t0 });
    const controller = createSaveController({
      session,
      saveManager: new SaveManager(storage),
      now: () => t0,
      scheduler: new FakeScheduler(),
    });
    controller.start();

    const before = writesOf(storage);
    expect(session.beginNewCycle(t0)).toBe(true);
    expect(writesOf(storage)).toBeGreaterThan(before);

    const saved = storedSave(storage);
    expect(saved?.status).toBe('loaded');
    expect(saved?.prestige).toEqual({ cycle: 2, echoesEarned: 3, perks: [] });
    expect(saved?.state.ending.phase).toBe('none');
    expect(saved?.stats.cycles).toBe(2);
  });

  it("a 'prestige' event writes the bought perk", () => {
    const storage = new CountingStorage();
    const session = new GameSession({
      state: createInitialState(t0),
      prestige: { cycle: 2, echoesEarned: 3, perks: [] },
      now: () => t0,
    });
    const controller = createSaveController({
      session,
      saveManager: new SaveManager(storage),
      now: () => t0,
      scheduler: new FakeScheduler(),
    });
    controller.start();

    expect(session.buyPerk('residualCharge').ok).toBe(true);
    expect(storedSave(storage)?.prestige).toEqual({ cycle: 2, echoesEarned: 3, perks: ['residualCharge'] });
  });

  it('resetProgress() erases the prestige in storage (back to cycle 1, no Echoes)', () => {
    const storage = new CountingStorage();
    const session = new GameSession({
      state: createInitialState(t0),
      prestige: { cycle: 2, echoesEarned: 3, perks: ['residualCharge'] },
      now: () => t0,
    });
    const controller = createSaveController({
      session,
      saveManager: new SaveManager(storage),
      now: () => t0,
      scheduler: new FakeScheduler(),
    });

    controller.resetProgress();
    expect(storedSave(storage)?.prestige).toEqual(DEFAULT_BLOCK);
    expect(session.prestige).toEqual(DEFAULT_BLOCK);
  });

  it('exportString then importString keeps the prestige; settings stay the current ones', () => {
    const sourceSession = new GameSession({
      state: createInitialState(t0),
      prestige: { cycle: 2, echoesEarned: 3, perks: ['residualCharge'] },
      now: () => t0,
    });
    const sourceController = createSaveController({
      session: sourceSession,
      saveManager: new SaveManager(new MemoryStorage()),
      now: () => t0,
      scheduler: new FakeScheduler(),
    });
    const text = sourceController.exportString();

    const target = setup(new MemoryStorage(), 10);
    target.session.setMuted(true);
    expect(target.controller.importString(text)).toEqual({ ok: true });

    const saved = storedSave(target.storage);
    expect(saved?.prestige).toEqual({ cycle: 2, echoesEarned: 3, perks: ['residualCharge'] });
    expect(saved?.settings.muted).toBe(true);
  });
});
