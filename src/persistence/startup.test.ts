import { describe, it, expect } from 'vitest';
import type { GameState, TechId } from '../data/types';
import { OFFLINE_CAP_SECONDS, SAVE_BACKUP_KEY, SAVE_KEY } from '../data/balance';
import { computeRates } from '../simulation/production/rates';
import { createInitialState } from '../simulation/state';
import { serialize } from './codec';
import { MemoryStorage, SaveManager } from './saveManager';
import { startSession } from './startup';
import v1Save from './fixtures/v1-save.json';

const HOUR_MS = 3600 * 1000;
const t0 = 1_700_000_000_000;

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(t0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

const clock = (): number => t0;

describe('startSession', () => {
  it('(a) empty storage starts a new game with nothing awarded and writes a save', () => {
    const storage = new MemoryStorage();
    const result = startSession(new SaveManager(storage), t0, clock);

    expect(result.load.status).toBe('new');
    expect(result.offline.gained.me).toBe(0);
    expect(result.saved).toBe(true);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(result.session.state.res.me).toBe(0);
  });

  it('(b) awards offline progress once; a reload 1 s later awards only 1 s', () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    const state = withLevels({ wornMotor: 1 }, { lastSimTime: t0 - 2 * HOUR_MS, createdAt: t0 - 3 * HOUR_MS });
    const perSecond = computeRates(state).perSecond.me;
    expect(perSecond).toBeGreaterThan(0);
    storage.setItem(SAVE_KEY, serialize(state, { muted: false }, t0 - 2 * HOUR_MS));

    const first = startSession(mgr, t0, clock);
    expect(first.load.status).toBe('loaded');
    expect(first.offline.elapsedSeconds).toBe(7200);
    expect(first.offline.gained.me).toBeCloseTo(perSecond * 7200, 6);
    expect(first.session.state.res.me).toBeCloseTo(perSecond * 7200, 6);

    const second = startSession(mgr, t0 + 1000, () => t0 + 1000);
    expect(second.offline.gained.me).toBeCloseTo(perSecond * 1, 6);
  });

  it('(c) caps offline progress at OFFLINE_CAP_SECONDS for a 10 h gap', () => {
    const storage = new MemoryStorage();
    const state = withLevels({ wornMotor: 1 }, { lastSimTime: t0 - 10 * HOUR_MS });
    const perSecond = computeRates(state).perSecond.me;
    storage.setItem(SAVE_KEY, serialize(state, { muted: false }, t0 - 10 * HOUR_MS));

    const result = startSession(new SaveManager(storage), t0, clock);
    expect(result.offline.elapsedSeconds).toBe(36000);
    expect(result.offline.cappedSeconds).toBe(OFFLINE_CAP_SECONDS);
    expect(result.offline.gained.me).toBeCloseTo(perSecond * OFFLINE_CAP_SECONDS, 6);
  });

  it('(d) a corrupt save is recovered, backed up and replaced by a fresh state', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{broken');

    const result = startSession(new SaveManager(storage), t0, clock);
    expect(result.load.status).toBe('recovered');
    expect(result.session.state.res.me).toBe(0);
    expect(result.session.state.techLevels.handCrank).toBe(1);
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBe('{broken');
    expect(result.saved).toBe(true);
  });

  it('(e) muted setting survives load and the next save', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, serialize(createInitialState(t0), { muted: true }, t0));

    const first = startSession(new SaveManager(storage), t0, clock);
    expect(first.session.settings.muted).toBe(true);

    const second = startSession(new SaveManager(storage), t0 + 1000, () => t0 + 1000);
    expect(second.session.settings.muted).toBe(true);
    const stored = JSON.parse(storage.getItem(SAVE_KEY) ?? 'null') as { settings: { muted: boolean } };
    expect(stored.settings.muted).toBe(true);
  });

  it('boots the v1 fixture as migrated: ME moves to res/lifetime, offline awarded once, v2 saved', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(v1Save));
    const bootAt = 1_700_000_000_000 + 1000;
    const mgr = new SaveManager(storage);

    const first = startSession(mgr, bootAt, () => bootAt);
    expect(first.load.status).toBe('migrated');
    expect(first.offline.elapsedSeconds).toBe(1);

    const perSecond = computeRates(first.session.state).perSecond.me;
    expect(perSecond).toBeGreaterThan(0);
    expect(first.offline.gained.me).toBeCloseTo(perSecond * 1, 6);
    expect(first.session.state.res.me).toBeCloseTo(v1Save.state.me + perSecond * 1, 6);
    expect(first.session.state.lifetime.me).toBeCloseTo(v1Save.state.lifetimeMe + perSecond * 1, 6);
    expect(first.session.state.res.ee).toBe(0);
    // Techs added after v1 (era II+) migrate in at level 0.
    expect(first.session.state.techLevels).toEqual({ ...createInitialState(0).techLevels, ...v1Save.state.techLevels });
    expect(first.session.state.totalClicks).toBe(v1Save.state.totalClicks);

    const stored = JSON.parse(storage.getItem(SAVE_KEY) ?? 'null') as {
      version: number;
      state: { res: { me: number }; lifetime: { me: number } };
    };
    expect(stored.version).toBe(2);
    expect(stored.state.res.me).toBeCloseTo(first.session.state.res.me, 9);
    expect(stored.state.lifetime.me).toBeCloseTo(first.session.state.lifetime.me, 9);

    const second = startSession(mgr, bootAt, () => bootAt);
    expect(second.load.status).toBe('loaded');
    expect(second.offline.gained.me).toBe(0);
    expect(second.session.state.res.me).toBeCloseTo(first.session.state.res.me, 9);
  });

  it('skips the boot save when the read fails, so a possibly good save is not overwritten', () => {
    let writes = 0;
    const unreadable = {
      getItem: (): string | null => {
        throw new Error('SecurityError');
      },
      setItem: (): void => {
        writes += 1;
      },
      removeItem: (): void => undefined,
    };
    const result = startSession(new SaveManager(unreadable), t0, clock);
    expect(result.load.status).toBe('new');
    expect(result.load.error).toBeDefined();
    expect(result.saved).toBe(false);
    expect(writes).toBe(0);
    expect(result.session.state.res.me).toBe(0);
  });

  it('reports saved false when storage refuses writes, without throwing', () => {
    const refusing = {
      getItem: (): string | null => null,
      setItem: (): void => {
        throw new Error('QuotaExceededError');
      },
      removeItem: (): void => undefined,
    };
    const result = startSession(new SaveManager(refusing), t0, clock);
    expect(result.saved).toBe(false);
    expect(result.session.state.res.me).toBe(0);
  });
});
