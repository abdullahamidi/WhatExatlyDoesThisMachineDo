import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { GameState, SettingsState, TechId } from '../data/types';
import { SAVE_BACKUP_KEY, SAVE_KEY } from '../data/balance';
import { createInitialState } from '../simulation/state';
import { MIGRATIONS, SAVE_VERSION, migrate, validateEnvelope } from './schema';
import type { Migration } from './schema';
import { deserialize, serialize } from './codec';
import { MemoryStorage, SaveManager, browserStorage } from './saveManager';
import type { KeyValueStorage } from './saveManager';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

const raw = (state: unknown, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ version: 1, savedAt: 1, state, ...extra });

class FailingStorage implements KeyValueStorage {
  getItem(): string | null {
    throw new Error('read denied');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
  removeItem(): void {
    throw new Error('remove denied');
  }
}

describe('round trip', () => {
  const state = withLevels(
    { gearRatio: 4, wornMotor: 1 },
    { me: 123.5, lifetimeMe: 500, totalClicks: 7, lastSimTime: 1000, createdAt: 500 },
  );
  const settings: SettingsState = { muted: true };

  it('deserialize(serialize()) returns the same state and settings', () => {
    const result = deserialize(serialize(state, settings, 2000), 3000);
    expect(result).toEqual({ state, settings, status: 'loaded' });
    expect(result).not.toHaveProperty('error');
  });

  it('SaveManager save then load returns the same state and settings', () => {
    const mgr = new SaveManager(new MemoryStorage());
    expect(mgr.save(state, settings, 2000)).toBe(true);
    expect(mgr.load(3000)).toEqual({ state, settings, status: 'loaded' });
  });
});

describe('deserialize without a save', () => {
  it('returns a fresh state with status new', () => {
    const result = deserialize(null, 5000);
    expect(result.status).toBe('new');
    expect(result.state).toEqual(createInitialState(5000));
    expect(result.settings).toEqual({ muted: false });
    expect(result).not.toHaveProperty('error');
  });
});

describe('deserialize recovers from bad data', () => {
  const badInputs: Array<[string, string]> = [
    ['invalid json', '{not json'],
    ['empty string', ''],
    ['number', '123'],
    ['null', 'null'],
    ['array', '[]'],
    ['negative me', raw({ me: -5 })],
    ['string me', raw({ me: 'ten' })],
    ['null me (NaN)', raw({ me: null })],
    ['infinite me', '{"version":1,"state":{"me":1e999}}'],
    ['future version', JSON.stringify({ version: 999, savedAt: 1, state: createInitialState(1), settings: { muted: false } })],
    ['bad settings.muted', raw(createInitialState(1), { settings: { muted: 'yes' } })],
    ['bad techLevels entry', raw({ me: 1, techLevels: { gearRatio: 'x' } })],
    ['no state object', JSON.stringify({ version: 1 })],
    ['non-finite savedAt', raw({ me: 1 }, { savedAt: null })],
  ];

  it.each(badInputs)('%s -> recovered', (_name, input) => {
    const now = 9000;
    const result = deserialize(input, now);
    expect(result.status).toBe('recovered');
    expect(result.state).toEqual(createInitialState(now));
    expect(result.settings).toEqual({ muted: false });
    expect(typeof result.error).toBe('string');
    expect(result.error?.length).toBeGreaterThan(0);
  });
});

describe('deserialize fills missing fields', () => {
  it('uses defaults for omitted fields', () => {
    const result = deserialize(JSON.stringify({ version: 1, state: { me: 50 } }), 7000);
    expect(result.status).toBe('loaded');
    expect(result.state.me).toBe(50);
    expect(result.state.lifetimeMe).toBe(50);
    expect(result.state.totalClicks).toBe(0);
    expect(result.state.techLevels.handCrank).toBe(1);
    for (const id of TECH_IDS) {
      if (id !== 'handCrank') expect(result.state.techLevels[id]).toBe(0);
    }
    expect(result.state.lastSimTime).toBe(7000);
    expect(result.state.createdAt).toBe(7000);
    expect(result.settings).toEqual({ muted: false });
  });
});

describe('deserialize drops unknown tech ids and clamps levels', () => {
  it('drops unknown keys', () => {
    const result = deserialize(raw({ me: 0, techLevels: { gearRatio: 2, bogus: 9 } }), 1);
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels).not.toHaveProperty('bogus');
    expect(Object.keys(result.state.techLevels)).toHaveLength(TECH_IDS.length);
    expect(result.state.techLevels.gearRatio).toBe(2);
  });

  it('clamps and floors levels', () => {
    const result = deserialize(
      raw({
        me: 100,
        lifetimeMe: 10,
        techLevels: { gearRatio: 999, flywheel: 11, wornMotor: 5, handCrank: 0 },
      }),
      1,
    );
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels.gearRatio).toBe(25);
    expect(result.state.techLevels.flywheel).toBe(10);
    expect(result.state.techLevels.wornMotor).toBe(1);
    expect(result.state.techLevels.handCrank).toBe(1);
  });

  it('clamps negatives to 0 and floors fractions', () => {
    const result = deserialize(raw({ me: 0, techLevels: { gearRatio: -3 } }), 1);
    expect(result.state.techLevels.gearRatio).toBe(0);
    const floored = deserialize(raw({ me: 0, techLevels: { gearRatio: 2.9 } }), 1);
    expect(floored.state.techLevels.gearRatio).toBe(2);
  });

  it('raises lifetimeMe to at least me', () => {
    const result = deserialize(raw({ me: 100, lifetimeMe: 10 }), 1);
    expect(result.state.me).toBe(100);
    expect(result.state.lifetimeMe).toBe(100);
  });
});

describe('migrations', () => {
  const v0 = JSON.stringify({ version: 0, savedAt: 1, state: { me: 5 } });

  it('runs an injected migration and reports migrated', () => {
    const m: Record<number, Migration> = {
      0: (d) => ({ ...(d as object), settings: { muted: true } }),
    };
    const result = deserialize(v0, 1000, m);
    expect(result.status).toBe('migrated');
    expect(result.state.me).toBe(5);
    expect(result.settings.muted).toBe(true);
  });

  it('recovers when no migration exists for the version', () => {
    const result = deserialize(v0, 1000);
    expect(result.status).toBe('recovered');
    expect(result.error).toBeTruthy();
  });

  it('migrate: current version is unchanged', () => {
    const data = { version: 1, savedAt: 1, state: {} };
    const result = migrate(data);
    expect(result).toEqual({ ok: true, data, migrated: false });
  });

  it('migrate: future version fails', () => {
    expect(migrate({ version: 2 }).ok).toBe(false);
  });

  it('migrate: non-object fails', () => {
    expect(migrate(null).ok).toBe(false);
    expect(migrate([]).ok).toBe(false);
    expect(migrate('x').ok).toBe(false);
  });

  it('migrate: missing or invalid version fails', () => {
    expect(migrate({}).ok).toBe(false);
    expect(migrate({ version: -1 }).ok).toBe(false);
    expect(migrate({ version: 0.5 }).ok).toBe(false);
  });

  it('migrate: a throwing migration fails without throwing', () => {
    const result = migrate({ version: 0 }, {
      0: () => {
        throw new Error('boom');
      },
    });
    expect(result.ok).toBe(false);
  });

  it('migrate: a migration returning a non-object fails', () => {
    expect(migrate({ version: 0 }, { 0: () => 42 }).ok).toBe(false);
  });

  it('migrate: runs the built-in table (empty for v1)', () => {
    expect(MIGRATIONS).toEqual({});
    expect(SAVE_VERSION).toBe(1);
  });
});

describe('validateEnvelope', () => {
  it('rejects non-objects and wrong versions', () => {
    expect(validateEnvelope(null, 1).ok).toBe(false);
    expect(validateEnvelope({ version: 2, state: {} }, 1).ok).toBe(false);
  });

  it('returns only known fields', () => {
    const result = validateEnvelope(
      { version: 1, savedAt: 5, state: { me: 1, extra: true }, settings: { muted: true, extra: 1 }, junk: 1 },
      1,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope).not.toHaveProperty('junk');
    expect(result.envelope.state).not.toHaveProperty('extra');
    expect(result.envelope.settings).toEqual({ muted: true });
    expect(result.envelope.savedAt).toBe(5);
  });
});

describe('SaveManager', () => {
  it('load on empty storage returns new', () => {
    const mgr = new SaveManager(new MemoryStorage());
    expect(mgr.load(100).status).toBe('new');
  });

  it('load on corrupt data recovers and backs up the raw text', () => {
    const storage = new MemoryStorage();
    const corrupt = '{"version":1,"state":';
    storage.setItem(SAVE_KEY, corrupt);
    const mgr = new SaveManager(storage);
    const result = mgr.load(100);
    expect(result.status).toBe('recovered');
    expect(result.state).toEqual(createInitialState(100));
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBe(corrupt);
  });

  it('save returns true on success', () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    expect(mgr.save(createInitialState(0), { muted: false }, 10)).toBe(true);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it('save returns false and does not throw when storage refuses the write', () => {
    const mgr = new SaveManager(new FailingStorage());
    expect(() => mgr.save(createInitialState(0), { muted: false }, 10)).not.toThrow();
    expect(mgr.save(createInitialState(0), { muted: false }, 10)).toBe(false);
  });

  it('load treats a throwing read as no save and reports an error', () => {
    const mgr = new SaveManager(new FailingStorage());
    const result = mgr.load(100);
    expect(result.status).toBe('new');
    expect(result.state).toEqual(createInitialState(100));
    expect(result.error).toBeTruthy();
  });

  it('reset removes the save so the next load is new', () => {
    const mgr = new SaveManager(new MemoryStorage());
    mgr.save(createInitialState(0), { muted: true }, 10);
    mgr.reset();
    expect(mgr.load(20).status).toBe('new');
  });

  it('reset does not throw when storage refuses the removal', () => {
    expect(() => new SaveManager(new FailingStorage()).reset()).not.toThrow();
  });

  it('respects a custom key', () => {
    const storage = new MemoryStorage();
    new SaveManager(storage, 'other').save(createInitialState(0), { muted: false }, 10);
    expect(storage.getItem('other')).not.toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});

describe('browserStorage', () => {
  it('returns a working key-value store in node', () => {
    const s = browserStorage();
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });
});

describe('module import', () => {
  it('imports the persistence modules without throwing in node', async () => {
    await expect(import('./schema')).resolves.toBeDefined();
    await expect(import('./codec')).resolves.toBeDefined();
    await expect(import('./saveManager')).resolves.toBeDefined();
  });
});
