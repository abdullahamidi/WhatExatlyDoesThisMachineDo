import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { GameState, ResourceMap, SettingsState, TechId } from '../data/types';
import { SAVE_BACKUP_KEY, SAVE_KEY } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { createInitialState } from '../simulation/state';
import { emptyResourceMap } from '../simulation/resources';
import { applyOffline } from '../simulation/production/tick';
import { computeRates } from '../simulation/production/rates';
import { MIGRATIONS, SAVE_VERSION, migrate, migrateV1ToV2, validateEnvelope } from './schema';
import type { Migration } from './schema';
import { deserialize, serialize } from './codec';
import { MemoryStorage, SaveManager, browserStorage } from './saveManager';
import type { KeyValueStorage } from './saveManager';
import v1Save from './fixtures/v1-save.json';

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
    ['negative me (v1)', rawV1({ me: -5 })],
    ['string me (v1)', rawV1({ me: 'ten' })],
    ['null me (NaN, v1)', rawV1({ me: null })],
    ['infinite me (v1)', '{"version":1,"state":{"me":1e999}}'],
    ['negative res.me', raw({ res: { me: -5 } })],
    ['string res.me', raw({ res: { me: 'ten' } })],
    ['null res.me (NaN)', raw({ res: { me: null } })],
    ['infinite res.me', '{"version":2,"state":{"res":{"me":1e999}}}'],
    ['future version', JSON.stringify({ version: 999, savedAt: 1, state: createInitialState(1), settings: { muted: false } })],
    ['bad settings.muted', raw(createInitialState(1), { settings: { muted: 'yes' } })],
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
    expect(result.settings).toEqual({ muted: false });
    expect(typeof result.error).toBe('string');
    expect(result.error?.length).toBeGreaterThan(0);
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
    expect(result.settings).toEqual({ muted: false });
  });

  it('migrates a v1 save with only me into res/lifetime', () => {
    const result = deserialize(JSON.stringify({ version: 1, state: { me: 50 } }), 7000);
    expect(result.status).toBe('migrated');
    expect(result.state.res.me).toBe(50);
    expect(result.state.lifetime.me).toBe(50);
    expect(result.settings).toEqual({ muted: false });
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
    const parsed = JSON.parse(serialize(base, { muted: false }, 2000)) as {
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
    const result = deserialize(serialize(state, { muted: false }, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state).toEqual(state);
  });
});

describe('era IV save compatibility (WP10)', () => {
  const ERA_FOUR_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 4);

  it('a v2 save without any era IV keys loads as loaded with every era IV level at 0', () => {
    const base = withLevels({ gearRatio: 2 });
    const parsed = JSON.parse(serialize(base, { muted: false }, 2000)) as {
      state: { techLevels: Partial<Record<TechId, number>> };
    };
    expect(ERA_FOUR_IDS).toHaveLength(9);
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
    const result = deserialize(serialize(state, { muted: false }, 2000), 3000);
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
  const ERA_FIVE_IDS = TECH_IDS.filter((id) => TECHNOLOGIES[id].era === 5);

  it('a v2 save without any era V keys loads as loaded with every era V level at 0', () => {
    const base = withLevels({ gearRatio: 2, harmonicConvergence: 1 });
    const parsed = JSON.parse(serialize(base, { muted: false }, 2000)) as {
      state: { techLevels: Partial<Record<TechId, number>> };
    };
    expect(ERA_FIVE_IDS).toHaveLength(10);
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
      },
    );
    const result = deserialize(serialize(state, { muted: false }, 2000), 3000);
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
    const result = deserialize(serialize(state, { muted: false }, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels.primaryFunction).toBe(1);
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
    expect(result.envelope.settings).toEqual({ muted: true });
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
