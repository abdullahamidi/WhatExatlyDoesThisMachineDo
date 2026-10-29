import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { GameState, ResourceMap, SettingsState, TechId } from '../data/types';
import { SAVE_BACKUP_KEY, SAVE_KEY } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { emptyResourceMap } from '../simulation/resources';
import { applyOffline } from '../simulation/production/tick';
import { computeRates } from '../simulation/production/rates';
import { deriveStats, emptyStats } from '../simulation/stats';
import type { AchievementsState, StatsState } from '../data/types';
import { MIGRATIONS, SAVE_VERSION, migrate, migrateV1ToV2, validateEnvelope } from './schema';
import type { Migration } from './schema';
import { deserialize, serialize } from './codec';
import { MemoryStorage, SaveManager, browserStorage } from './saveManager';
import type { KeyValueStorage } from './saveManager';
import v1Save from './fixtures/v1-save.json';
import v2Primary from './fixtures/v2-wp11-primary.json';
import v2Cycle2 from './fixtures/v2-cycle2.json';
import { DEFAULT_ENDING } from '../simulation/progression/ending';
import { DEFAULT_PRESTIGE } from '../simulation/prestige';
import { DEFAULT_WORLD_SAVE, WORLD_KNOWN_IDS } from '../data/livingWorld';
import type { WorldSaveState } from '../data/livingWorld';
import { normalizeWorld } from '../simulation/worldSave';

/** A fresh, mutable copy of the default prestige (tests compare against it). */
const DEFAULT_PRESTIGE_LITERAL = { ...DEFAULT_PRESTIGE, perks: [] };

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

/** A full resource map: every key 0 except the given overrides. */
const resources = (values: Partial<ResourceMap> = {}): ResourceMap => ({ ...emptyResourceMap(), ...values });

/** Writes a v2 save envelope. */
const raw = (state: unknown, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ version: 2, savedAt: 1, state, ...extra });

/** Writes a v1 save envelope (pre-migration shape: single `me` / `lifetimeMe`). */
const rawV1 = (state: unknown, extra: Record<string, unknown> = {}): string =>
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
    {
      res: resources({ me: 123.5 }),
      lifetime: resources({ me: 500 }),
      totalClicks: 7,
      lastSimTime: 1000,
      createdAt: 500,
    },
  );
  const settings: SettingsState = { ...DEFAULT_SETTINGS, muted: true };

  it('deserialize(serialize()) returns the same state and settings (stats derived when absent)', () => {
    const result = deserialize(serialize(state, settings, 2000), 3000);
    expect(result).toEqual({
      state,
      settings,
      stats: deriveStats(state, 3000),
      achievements: { unlocked: {} },
      prestige: DEFAULT_PRESTIGE_LITERAL,
      world: DEFAULT_WORLD_SAVE,
      status: 'loaded',
    });
    expect(result).not.toHaveProperty('error');
  });

  it('SaveManager save then load returns the same state and settings (stats derived when absent)', () => {
    const mgr = new SaveManager(new MemoryStorage());
    expect(mgr.save(state, settings, 2000)).toBe(true);
    expect(mgr.load(3000)).toEqual({
      state,
      settings,
      stats: deriveStats(state, 3000),
      achievements: { unlocked: {} },
      prestige: DEFAULT_PRESTIGE_LITERAL,
      world: DEFAULT_WORLD_SAVE,
      status: 'loaded',
    });
  });

  it('v2 round trip is lossless for non-zero ee/rs and lifetime above res', () => {
    const rich = withLevels(
      { gearRatio: 4 },
      {
        res: resources({ me: 10, ee: 2.5, rs: 7 }),
        lifetime: resources({ me: 500, ee: 30, pr: 4, rs: 9 }),
        totalClicks: 3,
        lastSimTime: 1000,
        createdAt: 500,
      },
    );
    const result = deserialize(serialize(rich, settings, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state).toEqual(rich);
  });
});

describe('deserialize without a save', () => {
  it('returns a fresh state with status new', () => {
    const result = deserialize(null, 5000);
    expect(result.status).toBe('new');
    expect(result.state).toEqual(createInitialState(5000));
    expect(result.settings).toEqual({ ...DEFAULT_SETTINGS, muted: false });
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
    ['negative me (v1)', rawV1({ me: -5 })],
    ['string me (v1)', rawV1({ me: 'ten' })],
    ['null me (NaN, v1)', rawV1({ me: null })],
    ['infinite me (v1)', '{"version":1,"state":{"me":1e999}}'],
    ['negative res.me', raw({ res: { me: -5 } })],
    ['string res.me', raw({ res: { me: 'ten' } })],
    ['null res.me (NaN)', raw({ res: { me: null } })],
    ['infinite res.me', '{"version":2,"state":{"res":{"me":1e999}}}'],
    ['future version', JSON.stringify({ version: 999, savedAt: 1, state: createInitialState(1), settings: { muted: false } })],
    ['bad techLevels entry', raw({ res: { me: 1 }, techLevels: { gearRatio: 'x' } })],
    ['no state object', JSON.stringify({ version: 2 })],
    ['no state object (v1)', JSON.stringify({ version: 1 })],
    ['non-finite savedAt', raw({ res: { me: 1 } }, { savedAt: null })],
  ];

  it.each(badInputs)('%s -> recovered', (_name, input) => {
    const now = 9000;
    const result = deserialize(input, now);
    expect(result.status).toBe('recovered');
    expect(result.state).toEqual(createInitialState(now));
    expect(result.settings).toEqual({ ...DEFAULT_SETTINGS, muted: false });
    expect(typeof result.error).toBe('string');
    expect(result.error?.length).toBeGreaterThan(0);
  });
});

describe('settings never fail a save (WP12)', () => {
  const badSettings: Array<[string, unknown]> = [
    ['muted as a string', { muted: 'yes' }],
    ['volume as a string', { masterVolume: 'loud' }],
    ['unknown notation', { notation: 'bogus' }],
    ['unknown uiScale', { uiScale: 999 }],
    ['settings is null', null],
    ['settings is an array', [1, 2]],
    ['settings is a number', 7],
  ];

  it.each(badSettings)('%s -> loaded with default settings', (_name, settings) => {
    const result = deserialize(raw(createInitialState(1), { settings }), 9000);
    expect(result.status).toBe('loaded');
    expect(result).not.toHaveProperty('error');
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps the valid fields next to an invalid one', () => {
    const result = deserialize(
      raw(createInitialState(1), { settings: { muted: true, masterVolume: 40, notation: 'bogus' } }),
      9000,
    );
    expect(result.status).toBe('loaded');
    expect(result.settings).toEqual({ ...DEFAULT_SETTINGS, muted: true, masterVolume: 40 });
  });
});

describe('stats and achievements in the envelope (WP12)', () => {
  const state = withLevels(
    { gearRatio: 3 },
    {
      res: resources({ me: 40 }),
      lifetime: resources({ me: 400, ee: 2 }),
      totalClicks: 12,
      lastSimTime: 1000,
      createdAt: 500,
    },
  );
  const stats: StatsState = {
    activeSeconds: 3600.5,
    offlineSeconds: 7200,
    longestOfflineSeconds: 7200,
    clicks: 12,
    purchases: 3,
    lifetime: resources({ me: 400, ee: 2 }),
    maxPerSecond: resources({ me: 1.5 }),
    cycles: 1,
    bestCycleSeconds: null,
    startedAt: 500,
  };
  const achievements: AchievementsState = { unlocked: { firstTurn: 1234, steadyHand: 5678 } };

  it('serialize with meta round trips stats and achievements losslessly', () => {
    const prestige = { cycle: 2, echoesEarned: 3, perks: ['residualCharge' as const] };
    const result = deserialize(serialize(state, DEFAULT_SETTINGS, 2000, { stats, achievements, prestige }), 3000);
    expect(result.status).toBe('loaded');
    expect(result.stats).toEqual(stats);
    expect(result.achievements).toEqual(achievements);
    expect(result.prestige).toEqual(prestige);
    expect(result.state).toEqual(state);
  });

  it('serialize without meta keeps the pre-WP12 key set', () => {
    const parsed = JSON.parse(serialize(state, DEFAULT_SETTINGS, 2000)) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['version', 'econ', 'savedAt', 'state', 'settings']);
  });

  it('serialize with meta appends stats and achievements after settings', () => {
    const parsed = JSON.parse(serialize(state, DEFAULT_SETTINGS, 2000, { stats, achievements, prestige: DEFAULT_PRESTIGE_LITERAL })) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['version', 'econ', 'savedAt', 'state', 'settings', 'stats', 'achievements', 'prestige']);
  });

  it('a v2 save without stats derives them from the state and has no achievements', () => {
    const result = deserialize(serialize(state, DEFAULT_SETTINGS, 2000), 3000);
    expect(result.stats).toEqual(deriveStats(state, 3000));
    expect(result.stats.clicks).toBe(12);
    expect(result.achievements).toEqual({ unlocked: {} });
  });

  it('a new game and a recovered save fill fresh stats and empty achievements', () => {
    const fresh = deserialize(null, 4000);
    expect(fresh.stats).toEqual(emptyStats(4000));
    expect(fresh.achievements).toEqual({ unlocked: {} });

    const recovered = deserialize('{broken', 4000);
    expect(recovered.status).toBe('recovered');
    expect(recovered.stats).toEqual(emptyStats(4000));
    expect(recovered.achievements).toEqual({ unlocked: {} });
  });

  it('bad stats fields never recover: each invalid field takes its derived value', () => {
    const result = deserialize(
      raw(state, { stats: { clicks: -3, activeSeconds: 'x', purchases: 4, lifetime: { me: 'y', ee: 5 } } }),
      3000,
    );
    expect(result.status).toBe('loaded');
    expect(result.stats.clicks).toBe(state.totalClicks);
    expect(result.stats.activeSeconds).toBe(0);
    expect(result.stats.purchases).toBe(4);
    expect(result.stats.lifetime.me).toBe(state.lifetime.me);
    expect(result.stats.lifetime.ee).toBe(5);
  });
});

describe('deserialize fills missing fields', () => {
  it('uses defaults for omitted fields', () => {
    const result = deserialize(JSON.stringify({ version: 2, state: { res: { me: 50 } } }), 7000);
    expect(result.status).toBe('loaded');
    expect(result.state.res).toEqual(resources({ me: 50 }));
    expect(result.state.lifetime.me).toBe(50);
    for (const id of RESOURCE_IDS) {
      if (id !== 'me') {
        expect(result.state.res[id]).toBe(0);
        expect(result.state.lifetime[id]).toBe(0);
      }
    }
    expect(result.state.totalClicks).toBe(0);
    expect(result.state.techLevels.handCrank).toBe(1);
    for (const id of TECH_IDS) {
      if (id !== 'handCrank') expect(result.state.techLevels[id]).toBe(0);
    }
    expect(result.state.lastSimTime).toBe(7000);
    expect(result.state.createdAt).toBe(7000);
    expect(result.settings).toEqual({ ...DEFAULT_SETTINGS, muted: false });
  });

  it('migrates a v1 save with only me into res/lifetime', () => {
    const result = deserialize(JSON.stringify({ version: 1, state: { me: 50 } }), 7000);
    expect(result.status).toBe('migrated');
    expect(result.state.res.me).toBe(50);
    expect(result.state.lifetime.me).toBe(50);
    expect(result.settings).toEqual({ ...DEFAULT_SETTINGS, muted: false });
  });
});

describe('deserialize drops unknown tech ids and clamps levels', () => {
  it('drops unknown keys', () => {
    const result = deserialize(raw({ res: { me: 0 }, techLevels: { gearRatio: 2, bogus: 9 } }), 1);
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels).not.toHaveProperty('bogus');
    expect(Object.keys(result.state.techLevels)).toHaveLength(TECH_IDS.length);
    expect(result.state.techLevels.gearRatio).toBe(2);
  });

  it('clamps and floors levels', () => {
    const result = deserialize(
      raw({
        res: { me: 100 },
        lifetime: { me: 10 },
        techLevels: { gearRatio: 999, flywheel: 11, wornMotor: 5, handCrank: 0 },
      }),
      1,
    );
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels.gearRatio).toBe(15);
    expect(result.state.techLevels.flywheel).toBe(10);
    expect(result.state.techLevels.wornMotor).toBe(1);
    expect(result.state.techLevels.handCrank).toBe(1);
  });

  it('clamps negatives to 0 and floors fractions', () => {
    const result = deserialize(raw({ res: { me: 0 }, techLevels: { gearRatio: -3 } }), 1);
    expect(result.state.techLevels.gearRatio).toBe(0);
    const floored = deserialize(raw({ res: { me: 0 }, techLevels: { gearRatio: 2.9 } }), 1);
    expect(floored.state.techLevels.gearRatio).toBe(2);
  });

  it('raises lifetime.me to at least res.me', () => {
    const result = deserialize(raw({ res: { me: 100 }, lifetime: { me: 10 } }), 1);
    expect(result.state.res.me).toBe(100);
    expect(result.state.lifetime.me).toBe(100);
  });
});

describe('resource maps (v2 validation)', () => {
  it('missing lifetime equals res', () => {
    const result = deserialize(raw({ res: { me: 3, ee: 2, rs: 1 } }), 1);
    expect(result.status).toBe('loaded');
    expect(result.state.lifetime).toEqual(result.state.res);
    expect(result.state.lifetime).toEqual(resources({ me: 3, ee: 2, rs: 1 }));
  });

  it('raises each lifetime[id] to res[id] and keeps lifetime above res', () => {
    const result = deserialize(raw({ res: { me: 10, ee: 5 }, lifetime: { me: 4, ee: 1, pr: 8 } }), 1);
    expect(result.status).toBe('loaded');
    expect(result.state.lifetime).toEqual(resources({ me: 10, ee: 5, pr: 8 }));
  });

  it('drops unknown resource keys', () => {
    const result = deserialize(raw({ res: { me: 1, gold: 99 }, lifetime: { me: 1, gold: 5 } }), 1);
    expect(result.status).toBe('loaded');
    expect(result.state.res).not.toHaveProperty('gold');
    expect(result.state.lifetime).not.toHaveProperty('gold');
    expect(Object.keys(result.state.res)).toHaveLength(RESOURCE_IDS.length);
  });

  const badResourceInputs: Array<[string, string]> = [
    ['negative res.ee', raw({ res: { me: 1, ee: -1 } })],
    ['infinite lifetime.pr', '{"version":2,"state":{"res":{"me":1},"lifetime":{"pr":1e999}}}'],
    ['res is a number', raw({ res: 5 })],
    ['lifetime is an array', raw({ res: {}, lifetime: [] })],
    ['negative lifetime.xf', raw({ res: {}, lifetime: { xf: -2 } })],
  ];

  it.each(badResourceInputs)('%s -> recovered', (_name, input) => {
    const now = 9000;
    const result = deserialize(input, now);
    expect(result.status).toBe('recovered');
    expect(result.state).toEqual(createInitialState(now));
    expect(result.error?.length).toBeGreaterThan(0);
  });
});

describe('migrations', () => {
  const v0 = JSON.stringify({ version: 0, savedAt: 1, state: { me: 5 } });

  it('runs an injected migration and reports migrated', () => {
    const m: Record<number, Migration> = {
      0: (d) => ({ ...(d as object), settings: { muted: true } }),
      1: migrateV1ToV2,
    };
    const result = deserialize(v0, 1000, m);
    expect(result.status).toBe('migrated');
    expect(result.state.res.me).toBe(5);
    expect(result.settings.muted).toBe(true);
  });

  it('recovers when no migration exists for the version', () => {
    const result = deserialize(v0, 1000);
    expect(result.status).toBe('recovered');
    expect(result.error).toBeTruthy();
  });

  it('migrate: current version is unchanged', () => {
    const data = { version: 2, savedAt: 1, state: {} };
    const result = migrate(data);
    expect(result).toEqual({ ok: true, data, migrated: false });
  });

  it('migrate: future version fails', () => {
    expect(migrate({ version: 3 }).ok).toBe(false);
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

  it('migrate: a v1 envelope is upgraded to v2 by the built-in table', () => {
    const result = migrate({ version: 1, savedAt: 1, state: { me: 5 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(result.data).toMatchObject({ version: 2, state: { res: { me: 5 }, lifetime: {} } });
  });

  it('migrate: runs the built-in table (v1 -> v2)', () => {
    expect(Object.keys(MIGRATIONS)).toEqual(['1']);
    expect(SAVE_VERSION).toBe(2);
  });
});

describe('migrateV1ToV2', () => {
  it('moves me and lifetimeMe into the resource maps and leaves other fields', () => {
    const input = {
      version: 1,
      savedAt: 9,
      state: {
        me: 12,
        lifetimeMe: 40,
        totalClicks: 3,
        techLevels: { handCrank: 1 },
        lastSimTime: 5,
        createdAt: 2,
      },
      settings: { muted: true },
    };
    expect(migrateV1ToV2(input)).toEqual({
      version: 1,
      savedAt: 9,
      state: {
        res: { me: 12 },
        lifetime: { me: 40 },
        totalClicks: 3,
        techLevels: { handCrank: 1 },
        lastSimTime: 5,
        createdAt: 2,
      },
      settings: { muted: true },
    });
  });

  it('omits a key whose v1 value is absent', () => {
    expect(migrateV1ToV2({ version: 1, state: { me: 50 } })).toEqual({
      version: 1,
      state: { res: { me: 50 }, lifetime: {} },
    });
    expect(migrateV1ToV2({ version: 1, state: { lifetimeMe: 7 } })).toEqual({
      version: 1,
      state: { res: {}, lifetime: { me: 7 } },
    });
  });

  it('copies wrong-typed values untouched so validation can reject them', () => {
    expect(migrateV1ToV2({ version: 1, state: { me: 'ten', lifetimeMe: null } })).toEqual({
      version: 1,
      state: { res: { me: 'ten' }, lifetime: { me: null } },
    });
  });

  it('does not mutate its input', () => {
    const input = { version: 1, savedAt: 1, state: { me: 5, lifetimeMe: 6, totalClicks: 1 } };
    const before = JSON.stringify(input);
    migrateV1ToV2(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('tolerates a missing or non-object state and non-object input', () => {
    expect(migrateV1ToV2({ version: 1 })).toEqual({ version: 1 });
    expect(migrateV1ToV2({ version: 1, state: 5 })).toEqual({ version: 1, state: 5 });
    expect(migrateV1ToV2(null)).toBeNull();
    expect(migrateV1ToV2('x')).toBe('x');
  });

  it('produces an envelope that validates after migrate()', () => {
    const m = migrate({
      version: 1,
      savedAt: 1,
      state: { me: 50, lifetimeMe: 60, totalClicks: 0, techLevels: { handCrank: 1 }, lastSimTime: 1, createdAt: 1 },
    });
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    const v = validateEnvelope(m.data, 1);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.envelope.version).toBe(SAVE_VERSION);
    expect(v.envelope.state.res.me).toBe(50);
    expect(v.envelope.state.lifetime.me).toBe(60);
  });
});

describe('v1 fixture', () => {
  it('loads the v1 fixture as migrated with res/lifetime maps', () => {
    const result = deserialize(JSON.stringify(v1Save), 5);
    expect(result.status).toBe('migrated');
    expect(result.state.res).toEqual(resources({ me: 12345.5 }));
    expect(result.state.lifetime).toEqual(resources({ me: 98765.25 }));
    expect(result.state.totalClicks).toBe(321);
    // Techs added after v1 (era II+) migrate in at level 0.
    expect(result.state.techLevels).toEqual({ ...createInitialState(0).techLevels, ...v1Save.state.techLevels });
    expect(result.state.lastSimTime).toBe(1700000000000);
    expect(result.state.createdAt).toBe(1699990000000);
    expect(result.settings.muted).toBe(true);
  });

  it('re-serializes the migrated fixture as a v2 envelope', () => {
    const result = deserialize(JSON.stringify(v1Save), 5);
    const parsed = JSON.parse(serialize(result.state, result.settings, 6)) as { version: number; state: { res: unknown } };
    expect(parsed.version).toBe(2);
    expect(parsed.state.res).toEqual(resources({ me: 12345.5 }));
  });
});

describe('era III save compatibility (WP9)', () => {
  const ERA_THREE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 3);

  it('a v2 save without any era III keys loads as loaded with every era III level at 0', () => {
    const base = withLevels(
      { gearRatio: 4, wornMotor: 1, substationBlueprint: 1 },
      { res: resources({ me: 5 }), lastSimTime: 1000, createdAt: 500 },
    );
    const parsed = JSON.parse(serialize(base, { ...DEFAULT_SETTINGS, muted: false }, 2000)) as {
      state: { techLevels: Partial<Record<TechId, number>> };
    };
    for (const id of ERA_THREE_IDS) delete parsed.state.techLevels[id];

    const result = deserialize(JSON.stringify(parsed), 3000);
    expect(result.status).toBe('loaded');
    for (const id of ERA_THREE_IDS) expect(result.state.techLevels[id]).toBe(0);
    expect(result.state.techLevels.gearRatio).toBe(4);
    expect(result.state.techLevels.substationBlueprint).toBe(1);
  });

  it('a round trip with era III levels set is lossless', () => {
    const state = withLevels(
      { boiler: 1, firebox: 12, condenser: 5, reliefValves: 1, pressureVesselBlueprint: 1 },
      {
        res: resources({ pr: 1234.5, ee: 3 }),
        lifetime: resources({ pr: 6000000, ee: 9 }),
        lastSimTime: 1000,
        createdAt: 500,
      },
    );
    const result = deserialize(serialize(state, { ...DEFAULT_SETTINGS, muted: false }, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state).toEqual(state);
  });
});

describe('era IV save compatibility (WP10)', () => {
  // WP28: Splices (branch 'splice') are excluded from the era lists; they are bought outside the era tree.
  const ERA_FOUR_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 4 && TECHNOLOGIES[id].branch !== 'splice');

  it('a v2 save without any era IV keys loads as loaded with every era IV level at 0', () => {
    const base = withLevels({ gearRatio: 2 });
    const parsed = JSON.parse(serialize(base, { ...DEFAULT_SETTINGS, muted: false }, 2000)) as {
      state: { techLevels: Partial<Record<TechId, number>> };
    };
    expect(ERA_FOUR_IDS).toHaveLength(10);
    for (const id of ERA_FOUR_IDS) delete parsed.state.techLevels[id];

    const result = deserialize(JSON.stringify(parsed), 3000);
    expect(result.status).toBe('loaded');
    for (const id of ERA_FOUR_IDS) expect(result.state.techLevels[id]).toBe(0);
    expect(result.state.techLevels.gearRatio).toBe(2);
  });

  it('a round trip with era IV levels and resonance set is lossless', () => {
    const state = withLevels(
      { resonatorSpire: 1, harmonicCoil: 12, crankServo: 3, echoCrank: 1, harmonicConvergence: 1 },
      {
        res: resources({ pr: 10, rs: 1234.5 }),
        lifetime: resources({ pr: 2000000, rs: 30000000 }),
        totalClicks: 9,
        lastSimTime: 1000,
        createdAt: 500,
      },
    );
    const result = deserialize(serialize(state, { ...DEFAULT_SETTINGS, muted: false }, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state).toEqual(state);
  });

  it('offline progress counts servo auto-cranks (crankServo adds to the offline gain)', () => {
    const hour = 3600 * 1000;
    const withServo = withLevels({ wornMotor: 1, crankServo: 2 }, { lastSimTime: 0 });
    const withoutServo = withLevels({ wornMotor: 1 }, { lastSimTime: 0 });
    const { report } = applyOffline(withServo, hour);
    expect(report.gained.me).toBeCloseTo(computeRates(withServo).perSecond.me * 3600, 6);
    expect(report.gained.me).toBeGreaterThan(applyOffline(withoutServo, hour).report.gained.me);
  });
});

describe('era V save compatibility (WP11)', () => {
  const ERA_FIVE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 5 && TECHNOLOGIES[id].branch !== 'splice');

  it('a v2 save without any era V keys loads as loaded with every era V level at 0', () => {
    const base = withLevels({ gearRatio: 2, harmonicConvergence: 1 });
    const parsed = JSON.parse(serialize(base, { ...DEFAULT_SETTINGS, muted: false }, 2000)) as {
      state: { techLevels: Partial<Record<TechId, number>> };
    };
    expect(ERA_FIVE_IDS).toHaveLength(13);
    for (const id of ERA_FIVE_IDS) delete parsed.state.techLevels[id];

    const result = deserialize(JSON.stringify(parsed), 3000);
    expect(result.status).toBe('loaded');
    for (const id of ERA_FIVE_IDS) expect(result.state.techLevels[id]).toBe(0);
    expect(result.state.techLevels.gearRatio).toBe(2);
    expect(result.state.techLevels.harmonicConvergence).toBe(1);
  });

  it('a round trip with era V levels and Unknown Flux set is lossless', () => {
    const state = withLevels(
      { nullChamber: 1, containmentRing: 12, resonantSiphon: 3, graviticAnchor: 4, finalAlignment: 1, primaryFunction: 1 },
      {
        res: resources({ rs: 42.5, xf: 1234.75 }),
        lifetime: resources({ rs: 10000000, xf: 200000000 }),
        totalClicks: 11,
        lastSimTime: 1000,
        createdAt: 500,
        ending: { phase: 'choice', engagedAt: null },
      },
    );
    const result = deserialize(serialize(state, { ...DEFAULT_SETTINGS, muted: false }, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state).toEqual(state);
  });

  it('the v1 fixture still migrates and SAVE_VERSION stays at 2 (era V adds no version bump)', () => {
    expect(SAVE_VERSION).toBe(2);
    const result = deserialize(JSON.stringify(v1Save), 5);
    expect(result.status).toBe('migrated');
    for (const id of ERA_FIVE_IDS) expect(result.state.techLevels[id]).toBe(0);
  });

  it('a save with primaryFunction at level 1 keeps it (WP12 decides the resume)', () => {
    const state = withLevels({ primaryFunction: 1 }, { res: resources({ xf: 5 }), lastSimTime: 1000, createdAt: 500 });
    const result = deserialize(serialize(state, { ...DEFAULT_SETTINGS, muted: false }, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels.primaryFunction).toBe(1);
  });
});

describe('finale save compatibility (WP13)', () => {
  const settings: SettingsState = { ...DEFAULT_SETTINGS, muted: false };

  it('a save without an ending block and without primaryFunction loads as loaded with phase none', () => {
    const parsed = JSON.parse(serialize(withLevels({ gearRatio: 2 }), settings, 2000)) as { state: Record<string, unknown> };
    delete parsed.state['ending'];
    const result = deserialize(JSON.stringify(parsed), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.ending).toEqual(DEFAULT_ENDING);
    expect(result.state.techLevels.gearRatio).toBe(2);
  });

  it('the WP11 fixture (primaryFunction 1, no ending block) loads at the choice with its other data', () => {
    const result = deserialize(JSON.stringify(v2Primary), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels.primaryFunction).toBe(1);
    expect(result.state.ending).toEqual({ phase: 'choice', engagedAt: null });
    expect(result.state.totalClicks).toBe(48231);
    expect(result.stats.purchases).toBe(120);
    expect(result.achievements.unlocked.firstTurn).toBe(1799000100000);
  });

  it('a saved sequence resumes at the choice and keeps engagedAt', () => {
    const state = withLevels(
      { primaryFunction: 1 },
      { ending: { phase: 'sequence', engagedAt: 1000 }, lastSimTime: 1000, createdAt: 500 },
    );
    const result = deserialize(serialize(state, settings, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.ending).toEqual({ phase: 'choice', engagedAt: 1000 });
  });

  it('a saved choice and a saved postgame round trip losslessly', () => {
    for (const ending of [{ phase: 'choice', engagedAt: 40 }, { phase: 'postgame', engagedAt: 4321 }] as const) {
      const state = withLevels(
        { primaryFunction: 1, finalAlignment: 1 },
        { res: resources({ xf: 5 }), lifetime: resources({ xf: 5 }), ending: { ...ending }, lastSimTime: 1000, createdAt: 500 },
      );
      const result = deserialize(serialize(state, settings, 2000), 3000);
      expect(result.status).toBe('loaded');
      expect(result.state).toEqual(state);
    }
  });

  it('an ending phase without the ending tech owned resets to DEFAULT', () => {
    const state = withLevels({}, { ending: { phase: 'choice', engagedAt: 5 }, lastSimTime: 1000, createdAt: 500 });
    const result = deserialize(serialize(state, settings, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.ending).toEqual(DEFAULT_ENDING);
  });

  it('stats.cycles is clamped to at least 1 (cycles 0 -> 1)', () => {
    const meta = { stats: { ...emptyStats(2000), cycles: 0 }, achievements: { unlocked: {} }, prestige: DEFAULT_PRESTIGE_LITERAL };
    const result = deserialize(serialize(withLevels({ gearRatio: 2 }), settings, 2000, meta), 3000);
    expect(result.stats.cycles).toBe(1);
  });

  it('a wrong-typed ending block recovers the save (fresh state, status recovered)', () => {
    const badEndings: unknown[] = [
      'sequence',
      5,
      null,
      [],
      { phase: 'x', engagedAt: null },
      { phase: 'choice' },
      { phase: 'choice', engagedAt: 'soon' },
      { phase: 'sequence', engagedAt: {} },
    ];
    for (const bad of badEndings) {
      const parsed = JSON.parse(serialize(withLevels({ gearRatio: 2 }), settings, 2000)) as { state: Record<string, unknown> };
      parsed.state['ending'] = bad;
      const result = deserialize(JSON.stringify(parsed), 3000);
      expect(result.status).toBe('recovered');
      expect(result.state.ending).toEqual(DEFAULT_ENDING);
    }
  });

  it('a v1 fixture still migrates with phase none, and SAVE_VERSION stays 2', () => {
    expect(SAVE_VERSION).toBe(2);
    const result = deserialize(JSON.stringify(v1Save), 5);
    expect(result.status).toBe('migrated');
    expect(result.state.ending).toEqual(DEFAULT_ENDING);
  });
});

describe('validateEnvelope', () => {
  it('rejects non-objects, unmigrated and future versions', () => {
    expect(validateEnvelope(null, 1).ok).toBe(false);
    expect(validateEnvelope({ version: 1, state: {} }, 1).ok).toBe(false);
    expect(validateEnvelope({ version: 3, state: {} }, 1).ok).toBe(false);
  });

  it('returns only known fields', () => {
    const result = validateEnvelope(
      { version: 2, savedAt: 5, state: { res: { me: 1 }, extra: true }, settings: { muted: true, extra: 1 }, junk: 1 },
      1,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope).not.toHaveProperty('junk');
    expect(result.envelope.state).not.toHaveProperty('extra');
    expect(result.envelope.state.res.me).toBe(1);
    expect(result.envelope.settings).toEqual({ ...DEFAULT_SETTINGS, muted: true });
    expect(result.envelope.savedAt).toBe(5);
  });

  it('keeps any level of a repeatable whose maxLevel is null (unlimited)', () => {
    const techs = {
      ...TECHNOLOGIES,
      gearRatio: { ...TECHNOLOGIES.gearRatio, maxLevel: null },
    };
    const input = { version: 2, savedAt: 1, state: { res: { me: 0 }, techLevels: { gearRatio: 40 } }, settings: { muted: false } };
    const result = validateEnvelope(input, 1, techs);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.state.techLevels.gearRatio).toBe(40);
  });

  it('still clamps a repeatable that has a numeric maxLevel', () => {
    const result = validateEnvelope(
      { version: 2, savedAt: 1, state: { res: { me: 0 }, techLevels: { gearRatio: 40 } } },
      1,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.state.techLevels.gearRatio).toBe(TECHNOLOGIES.gearRatio.maxLevel);
  });
});

describe('SaveManager', () => {
  it('load on empty storage returns new', () => {
    const mgr = new SaveManager(new MemoryStorage());
    expect(mgr.load(100).status).toBe('new');
  });

  it('load on corrupt data recovers and backs up the raw text', () => {
    const storage = new MemoryStorage();
    const corrupt = '{"version":2,"state":';
    storage.setItem(SAVE_KEY, corrupt);
    const mgr = new SaveManager(storage);
    const result = mgr.load(100);
    expect(result.status).toBe('recovered');
    expect(result.state).toEqual(createInitialState(100));
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBe(corrupt);
  });

  it('load on a v1 save that fails validation after migration backs up the raw text', () => {
    const storage = new MemoryStorage();
    const v1Bad = rawV1({ me: -5 });
    storage.setItem(SAVE_KEY, v1Bad);
    const result = new SaveManager(storage).load(100);
    expect(result.status).toBe('recovered');
    expect(result.state).toEqual(createInitialState(100));
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBe(v1Bad);
  });

  it('load migrates a stored v1 fixture and reports migrated', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(v1Save));
    const result = new SaveManager(storage).load(5);
    expect(result.status).toBe('migrated');
    expect(result.state.res.me).toBe(12345.5);
    expect(storage.getItem(SAVE_BACKUP_KEY)).toBeNull();
  });

  it('save returns true on success', () => {
    const storage = new MemoryStorage();
    const mgr = new SaveManager(storage);
    expect(mgr.save(createInitialState(0), { ...DEFAULT_SETTINGS, muted: false }, 10)).toBe(true);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it('save returns false and does not throw when storage refuses the write', () => {
    const mgr = new SaveManager(new FailingStorage());
    expect(() => mgr.save(createInitialState(0), { ...DEFAULT_SETTINGS, muted: false }, 10)).not.toThrow();
    expect(mgr.save(createInitialState(0), { ...DEFAULT_SETTINGS, muted: false }, 10)).toBe(false);
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
    mgr.save(createInitialState(0), { ...DEFAULT_SETTINGS, muted: true }, 10);
    mgr.reset();
    expect(mgr.load(20).status).toBe('new');
  });

  it('reset does not throw when storage refuses the removal', () => {
    expect(() => new SaveManager(new FailingStorage()).reset()).not.toThrow();
  });

  it('respects a custom key', () => {
    const storage = new MemoryStorage();
    new SaveManager(storage, 'other').save(createInitialState(0), { ...DEFAULT_SETTINGS, muted: false }, 10);
    expect(storage.getItem('other')).not.toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});

describe('prestige save compatibility (WP14)', () => {
  const settings: SettingsState = { ...DEFAULT_SETTINGS, muted: false };
  const DEFAULT_BLOCK = { cycle: 1, echoesEarned: 0, perks: [] };

  it('a v2 save without a prestige block loads as loaded with the default prestige (cycle 1)', () => {
    const result = deserialize(raw(createInitialState(1)), 3000);
    expect(result.status).toBe('loaded');
    expect(result.prestige).toEqual(DEFAULT_BLOCK);
    expect(result).not.toHaveProperty('error');
  });

  it('the v1 fixture migrates to the default prestige', () => {
    const result = deserialize(JSON.stringify(v1Save), 5);
    expect(result.status).toBe('migrated');
    expect(result.prestige).toEqual(DEFAULT_BLOCK);
  });

  it('the cycle-2 fixture loads losslessly: cycle, Echoes, perks and confirmNewCycle false', () => {
    const result = deserialize(JSON.stringify(v2Cycle2), 3000);
    expect(result.status).toBe('loaded');
    expect(result.prestige).toEqual({ cycle: 2, echoesEarned: 3, perks: ['residualCharge'] });
    expect(result.settings.confirmNewCycle).toBe(false);
    expect(result.stats.cycles).toBe(2);

    const again = deserialize(serialize(result.state, result.settings, 4000, { stats: result.stats, achievements: result.achievements, prestige: result.prestige }), 5000);
    expect(again.status).toBe('loaded');
    expect(again.prestige).toEqual(result.prestige);
    expect(again.settings).toEqual(result.settings);
    expect(again.state).toEqual(result.state);
  });

  it.each<[string, unknown, { cycle: number; echoesEarned: number; perks: string[] }]>([
    ['a string', 'cycle 2', DEFAULT_BLOCK],
    ['an array', [2, 3], DEFAULT_BLOCK],
    ['floats and negatives', { cycle: 2.5, echoesEarned: -4, perks: ['muscleMemory'] }, DEFAULT_BLOCK],
    ['an unknown and a duplicate perk', { cycle: 2, echoesEarned: 5, perks: ['bogus', 'ledger', 'ledger'] }, { cycle: 2, echoesEarned: 5, perks: ['ledger'] }],
    ['over-spend drops the last perk', { cycle: 2, echoesEarned: 3, perks: ['residualCharge', 'servoRecall'] }, { cycle: 2, echoesEarned: 3, perks: ['residualCharge'] }],
  ])('bad prestige (%s) is normalised: status loaded, never recovered', (_name, input, expected) => {
    const result = deserialize(raw(createInitialState(1), { prestige: input }), 3000);
    expect(result.status).toBe('loaded');
    expect(result).not.toHaveProperty('error');
    expect(result.prestige).toEqual(expected);
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

describe('living world block (WP23a)', () => {
  const NOW = 1_700_000_000_000;
  const block = (over: Partial<WorldSaveState> = {}): WorldSaveState => ({
    seen: ['INS-01'],
    seenEver: ['INS-01', 'DOG-01'],
    eraMoments: [1, 2, 3, 0, 0],
    youEras: 3,
    relics: 0,
    ...over,
  });
  const metaWith = (world?: WorldSaveState) => ({
    stats: emptyStats(NOW),
    achievements: { unlocked: {} },
    prestige: { ...DEFAULT_PRESTIGE, perks: [] },
    world,
  });

  it('keeps save version 2 (the block is additive)', () => {
    expect(SAVE_VERSION).toBe(2);
  });

  it('serialize writes the block only when meta carries one', () => {
    const state = createInitialState(NOW);
    expect(JSON.parse(serialize(state, DEFAULT_SETTINGS, NOW))).not.toHaveProperty('world');
    expect(JSON.parse(serialize(state, DEFAULT_SETTINGS, NOW, metaWith()))).not.toHaveProperty('world');
    const out = JSON.parse(serialize(state, DEFAULT_SETTINGS, NOW, metaWith(block()))) as Record<string, unknown>;
    expect(out['world']).toEqual(block());
  });

  it('round trips the block through serialize and deserialize', () => {
    const r = deserialize(serialize(createInitialState(NOW), DEFAULT_SETTINGS, NOW, metaWith(block())), NOW);
    expect(r.status).toBe('loaded');
    expect(r.world).toEqual(block());
  });

  it('round trips the relic count (WP28); a block without it loads with 0', () => {
    const r = deserialize(serialize(createInitialState(NOW), DEFAULT_SETTINGS, NOW, metaWith(block({ relics: 4 }))), NOW);
    expect(r.world.relics).toBe(4);
    const old = deserialize(raw(createInitialState(NOW), { world: { seen: [], seenEver: [], eraMoments: [0, 0, 0, 0, 0], youEras: 0 } }), NOW);
    expect(old.world.relics).toBe(0);
  });

  it('a save without the block, and a missing save, load with the default block', () => {
    expect(deserialize(serialize(createInitialState(NOW), DEFAULT_SETTINGS, NOW), NOW).world).toEqual(DEFAULT_WORLD_SAVE);
    expect(deserialize(null, NOW).world).toEqual(DEFAULT_WORLD_SAVE);
  });

  it('a bad block never fails the load', () => {
    for (const bad of ['junk', null, 7, [1, 2]]) {
      const r = deserialize(raw(createInitialState(NOW), { world: bad }), NOW);
      expect(r.status, JSON.stringify(bad)).toBe('loaded');
      expect(r.world).toEqual(DEFAULT_WORLD_SAVE);
    }
  });

  it('validateEnvelope fills the block', () => {
    const withBlock = validateEnvelope(JSON.parse(serialize(createInitialState(NOW), DEFAULT_SETTINGS, NOW, metaWith(block()))), NOW);
    expect(withBlock.ok).toBe(true);
    if (withBlock.ok) expect(withBlock.envelope.world).toEqual(block());
    const plain = validateEnvelope(JSON.parse(serialize(createInitialState(NOW), DEFAULT_SETTINGS, NOW)), NOW);
    expect(plain.ok).toBe(true);
    if (plain.ok) expect(plain.envelope.world).toEqual(DEFAULT_WORLD_SAVE);
  });

  it('a storage read failure returns the default block', () => {
    const r = new SaveManager(new FailingStorage()).load(NOW);
    expect(r.status).toBe('new');
    expect(r.world).toEqual(DEFAULT_WORLD_SAVE);
  });

  it('normalizeWorld: non-objects give a fresh default with new arrays', () => {
    for (const bad of [undefined, null, 0, 'x', true, [], [1]]) {
      const w = normalizeWorld(bad);
      expect(w, String(bad)).toEqual(DEFAULT_WORLD_SAVE);
      expect(w.seen).not.toBe(DEFAULT_WORLD_SAVE.seen);
      expect(w.eraMoments).not.toBe(DEFAULT_WORLD_SAVE.eraMoments);
    }
  });

  it('normalizeWorld: drops unknown ids and non-strings, keeps the known beats', () => {
    const w = normalizeWorld({
      seen: ['INS-01', 'NOPE-99', '', 7, null, 'beat.tapeFreeze', 'beat.unknown'],
      seenEver: [],
      eraMoments: [0, 0, 0, 0, 0],
      youEras: 0,
    });
    expect(w.seen).toEqual(['INS-01', 'beat.tapeFreeze']);
    expect(w.seenEver).toEqual(['INS-01', 'beat.tapeFreeze']);
  });

  it('normalizeWorld: keeps the first of duplicate ids', () => {
    expect(normalizeWorld({ seen: ['CRW-01', 'INS-01', 'CRW-01'] }).seen).toEqual(['CRW-01', 'INS-01']);
  });

  it('normalizeWorld: seenEver is the union of seenEver and seen', () => {
    const w = normalizeWorld({ seen: ['INS-01'], seenEver: ['DOG-01'] });
    expect(w.seen).toEqual(['INS-01']);
    expect(w.seenEver).toEqual(['DOG-01', 'INS-01']);
  });

  it('normalizeWorld: a non-array list is empty', () => {
    const w = normalizeWorld({ seen: 'INS-01', seenEver: { 0: 'INS-01' } });
    expect(w.seen).toEqual([]);
    expect(w.seenEver).toEqual([]);
  });

  it('normalizeWorld: lists are capped at 128 ids after the filter', () => {
    const known = [...WORLD_KNOWN_IDS];
    const long = Array.from({ length: 300 }, (_, i) => known[i % known.length] ?? 'NOPE');
    const capped = normalizeWorld({ seen: long, seenEver: long });
    expect(capped.seen).toEqual(known);
    expect(capped.seenEver.length).toBeLessThanOrEqual(128);
    expect(normalizeWorld({ seen: [...Array.from({ length: 200 }, () => 'NOPE'), 'INS-01'] }).seen).toEqual(['INS-01']);
  });

  it('normalizeWorld: clamps eraMoments and youEras', () => {
    expect(normalizeWorld({ eraMoments: [3.7, -2, 150, Number.NaN, 'x'] }).eraMoments).toEqual([3, 0, 99, 0, 0]);
    expect(normalizeWorld({ eraMoments: [Infinity, 1e308, 4, 5, 6] }).eraMoments).toEqual([0, 99, 4, 5, 6]);
    expect(normalizeWorld({ eraMoments: [7] }).eraMoments).toEqual([7, 0, 0, 0, 0]);
    expect(normalizeWorld({ eraMoments: 'nope' }).eraMoments).toEqual([0, 0, 0, 0, 0]);
    expect(normalizeWorld({ youEras: 5 }).youEras).toBe(5);
    expect(normalizeWorld({ youEras: 40 }).youEras).toBe(31);
    expect(normalizeWorld({ youEras: -1 }).youEras).toBe(0);
    expect(normalizeWorld({ youEras: 1.5 }).youEras).toBe(0);
    expect(normalizeWorld({ youEras: '3' }).youEras).toBe(0);
    expect(normalizeWorld({ youEras: Number.NaN }).youEras).toBe(0);
  });

  it('normalizeWorld never returns its input and is idempotent', () => {
    const input = { seen: ['INS-01'], seenEver: ['INS-01'], eraMoments: [1, 0, 0, 0, 0], youEras: 1 };
    const out = normalizeWorld(input);
    expect(out).not.toBe(input);
    expect(out.seen).not.toBe(input.seen);
    expect(normalizeWorld(out)).toEqual(out);
  });
});

describe('module import', () => {
  it('imports the persistence modules without throwing in node', async () => {
    await expect(import('./schema')).resolves.toBeDefined();
    await expect(import('./codec')).resolves.toBeDefined();
    await expect(import('./saveManager')).resolves.toBeDefined();
  });
});
