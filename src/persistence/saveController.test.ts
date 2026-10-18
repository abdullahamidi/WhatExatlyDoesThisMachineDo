import { describe, it, expect, vi } from 'vitest';
import type { GameState, SettingsState } from '../data/types';
import { AUTOSAVE_INTERVAL_MS, SAVE_KEY } from '../data/balance';
import { GameSession } from '../simulation';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { emptyResourceMap } from '../simulation/resources';
import { deserialize } from './codec';
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
        lifetime: { ...base.lifetime, me: 200000 },
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
    expect(writesOf(storage) - before).toBe(1);
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
