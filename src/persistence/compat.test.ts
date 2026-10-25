// Save compatibility matrix (WP16a T1). Each row is a historical or edge-case save text, run through
// the codec, SaveManager + startSession, export/import and the host pickStorage path.
// Fixtures are loaded as raw text so the exact stored string is what the loaders see.
import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type {
  EndingPhase,
  LoadResult,
  LoadStatus,
  PrestigeState,
  ResourceMap,
  SettingsState,
  TechId,
} from '../data/types';
import { DESIGN_MAX_VALUE, SAVE_BACKUP_KEY, SAVE_KEY } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import { DEFAULT_SETTINGS_VALUES } from '../data/settings';
import { DEFAULT_WORLD_SAVE } from '../data/livingWorld';
import type { WorldSaveState } from '../data/livingWorld';
import type { HostStorageBridge, WedtmdHost } from '../platform/host';
import { echoesForCycle, ENDING_PHASES, normalizePrestige, normalizeSettings, normalizeWorld } from '../simulation';
import { deserialize, serialize } from './codec';
import { parseImport } from './exchange';
import { pickStorage } from './hostStorage';
import type { TimeoutPort } from './hostStorage';
import { MemoryStorage, SaveManager } from './saveManager';
import type { KeyValueStorage } from './saveManager';
import { createSaveController } from './saveController';
import type { Scheduler } from './saveController';
import { startSession } from './startup';
import type { StartupResult } from './startup';
import v1Raw from './fixtures/v1-save.json?raw';
import wp8Raw from './fixtures/v2-wp8-era2.json?raw';
import wp11Raw from './fixtures/v2-wp11-primary.json?raw';
import wp13Raw from './fixtures/v2-wp13-postgame.json?raw';
import cycle2Raw from './fixtures/v2-cycle2.json?raw';
import preLegacyRaw from './fixtures/v2-pre-legacy.json?raw';
import currentRaw from './fixtures/v2-current-full.json?raw';
import worldRaw from './fixtures/v2-world.json?raw';
import outOfRangeRaw from './fixtures/v2-out-of-range.json?raw';
import v3Raw from './fixtures/v3-future.json?raw';
import corruptRaw from './fixtures/corrupt-save.txt?raw';

const NOW = 1_800_000_060_000;

interface CompatRow {
  file: string;
  raw: string;
  status: LoadStatus;
  /** Recovered rows only: load.error must START with this text. */
  error?: string;
  phase: EndingPhase;
  prestige: PrestigeState;
  /** Recovered rows: the whole settings object is compared with toEqual (fresh defaults). */
  settings?: Partial<SettingsState>;
  levels?: Partial<Record<TechId, number>>;
  res?: Partial<ResourceMap>;
  lifetime?: Partial<ResourceMap>;
  totalClicks?: number;
  /** Living-world block after load (WP23a). Rows without it load with DEFAULT_WORLD_SAVE. */
  world?: WorldSaveState;
  /** Re-serialising with the original savedAt must reproduce the file exactly (as JSON). */
  lossless?: true;
  /** Has a finished finale, so a new cycle can begin. */
  newCycle?: true;
  /** Legacy feeds (bellowsDrive, gridExciter, mainsBackfeed, steamLance) are buyable after load. */
  legacyAvailable?: true;
  cycles?: number;
  noAchievements?: true;
  /** Keys that must NOT appear in techLevels after load (unknown or dropped ids). */
  absentLevels?: readonly string[];
}

const LEGACY_FEEDS = ['bellowsDrive', 'gridExciter', 'mainsBackfeed', 'steamLance'] as const;

const ROWS: readonly CompatRow[] = [
  {
    file: 'v1-save.json',
    raw: v1Raw,
    status: 'migrated',
    phase: 'none',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: { muted: true, musicVolume: 70, confirmNewCycle: true, uiScale: 100 },
    levels: { gearRatio: 6, motorTuning: 9, bellowsDrive: 0 },
    res: { me: 12345.5 },
    lifetime: { me: 98765.25 },
    totalClicks: 321,
  },
  {
    file: 'v2-wp8-era2.json',
    raw: wp8Raw,
    status: 'loaded',
    phase: 'none',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: { musicVolume: 70, confirmNewCycle: true, notation: 'suffix' },
    levels: { generator: 1, copperWinding: 8, sparkGap: 0, boiler: 0, bellowsDrive: 0 },
    res: { ee: 1800.5 },
    cycles: 1,
    noAchievements: true,
  },
  {
    file: 'v2-wp11-primary.json',
    raw: wp11Raw,
    status: 'loaded',
    phase: 'choice',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: { musicVolume: 70 },
    levels: { primaryFunction: 1, bellowsDrive: 0, gridExciter: 0, mainsBackfeed: 0, steamLance: 0 },
    newCycle: true,
  },
  {
    file: 'v2-wp13-postgame.json',
    raw: wp13Raw,
    status: 'loaded',
    phase: 'postgame',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: {
      masterVolume: 80,
      notation: 'scientific',
      reducedMotion: true,
      uiScale: 125,
      musicVolume: 70,
      confirmNewCycle: true,
    },
    levels: { crankServo: 10, primaryFunction: 1, bellowsDrive: 0, gridExciter: 0, mainsBackfeed: 0, steamLance: 0 },
    newCycle: true,
  },
  {
    file: 'v2-cycle2.json',
    raw: cycle2Raw,
    status: 'loaded',
    phase: 'none',
    prestige: { cycle: 2, echoesEarned: 3, perks: ['residualCharge'] },
    settings: { confirmNewCycle: false },
    levels: { gearRatio: 3, wornMotor: 1 },
    cycles: 2,
  },
  {
    file: 'v2-pre-legacy.json',
    raw: preLegacyRaw,
    status: 'loaded',
    phase: 'none',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: { musicVolume: 55 },
    levels: { nullChamber: 1, containmentRing: 10, bellowsDrive: 0, gridExciter: 0, mainsBackfeed: 0, steamLance: 0 },
    legacyAvailable: true,
  },
  {
    file: 'v2-current-full.json',
    raw: currentRaw,
    status: 'loaded',
    phase: 'postgame',
    prestige: { cycle: 3, echoesEarned: 6, perks: ['muscleMemory', 'residualCharge', 'longSilence'] },
    settings: { musicVolume: 40, uiScale: 150, notation: 'engineering', screenShake: false, confirmNewCycle: false },
    levels: { bellowsDrive: 37, gridExciter: 12, mainsBackfeed: 5, steamLance: 6 },
    lossless: true,
    newCycle: true,
  },
  {
    file: 'v2-world.json',
    raw: worldRaw,
    status: 'loaded',
    phase: 'postgame',
    prestige: { cycle: 3, echoesEarned: 6, perks: ['muscleMemory', 'residualCharge', 'longSilence'] },
    settings: { musicVolume: 40, uiScale: 150, notation: 'engineering', screenShake: false, confirmNewCycle: false, worldVoices: 'rare' },
    levels: { bellowsDrive: 37, gridExciter: 12, mainsBackfeed: 5, steamLance: 6 },
    world: { seen: ['INS-01', 'CRW-01'], seenEver: ['INS-01', 'CRW-01', 'beat.tapeFreeze'], eraMoments: [2, 0, 0, 0, 0], youEras: 1 },
    lossless: true,
    newCycle: true,
  },
  {
    file: 'v2-out-of-range.json',
    raw: outOfRangeRaw,
    status: 'loaded',
    phase: 'none',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: {
      musicVolume: 70,
      uiScale: 100,
      notation: 'suffix',
      masterVolume: 100,
      sfxVolume: 0,
      reducedMotion: false,
    },
    levels: { handCrank: 1, gearRatio: 15, crankServo: 10, boiler: 1, generator: 0, bellowsDrive: 500, steamLance: 7 },
    absentLevels: ['quantumFoo'],
    totalClicks: 77,
    lifetime: { me: 5000 },
    res: { pr: 0 },
  },
  {
    file: 'v3-future.json',
    raw: v3Raw,
    status: 'recovered',
    error: 'Save is from a newer version',
    phase: 'none',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: DEFAULT_SETTINGS_VALUES,
  },
  {
    file: 'corrupt-save.txt',
    raw: corruptRaw,
    status: 'recovered',
    error: 'Save data is not valid JSON',
    phase: 'none',
    prestige: { cycle: 1, echoesEarned: 0, perks: [] },
    settings: DEFAULT_SETTINGS_VALUES,
  },
];

/** In-memory host disk: loadAll reads it, writes go straight to it, flush deletes on null. */
function memoryBridge(disk: Map<string, string>): HostStorageBridge {
  return {
    loadAll: () => Object.fromEntries(disk),
    set: (key, value) => {
      disk.set(key, value);
    },
    remove: (key) => {
      disk.delete(key);
    },
    flush: (pending) => {
      for (const [key, value] of Object.entries(pending)) {
        if (value === null) disk.delete(key);
        else disk.set(key, value);
      }
      return true;
    },
  };
}

function fakeHost(bridge: HostStorageBridge): WedtmdHost {
  return {
    kind: 'electron',
    version: '0.0.0-test',
    platform: 'win32',
    isPackaged: false,
    storage: bridge,
    openExternal: () => {},
    quit: () => {},
    setFullscreen: () => {},
    isFullscreen: () => false,
    onFullscreenChange: () => () => {},
  };
}

// Timers are never needed: the host debounce is flushed by hand through picked.flush().
const NO_TIMERS: TimeoutPort = { setTimeout: () => 0, clearTimeout: () => {} };
const NO_SCHEDULER: Scheduler = { setInterval: () => 0, clearInterval: () => {} };

/** Boots a session from storage the way the game does, at the fixed NOW clock. */
function bootFrom(storage: KeyValueStorage): StartupResult {
  return startSession(new SaveManager(storage), NOW, () => NOW);
}

/** Boots a fresh MemoryStorage holding exactly the row's raw text. */
function bootRow(row: CompatRow): { storage: MemoryStorage; boot: StartupResult } {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, row.raw);
  return { storage, boot: bootFrom(storage) };
}

/** Finite, non-negative and below the design ceiling. */
function expectDesignRange(value: number): void {
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
  expect(value).toBeLessThan(DESIGN_MAX_VALUE);
}

function expectStateInvariants(r: LoadResult): void {
  const { state } = r;

  expect(Object.keys(state.techLevels).sort()).toEqual([...TECH_IDS].sort());
  for (const id of TECH_IDS) {
    const level = state.techLevels[id];
    const def = TECHNOLOGIES[id];
    expect(Number.isInteger(level), `${id} is an integer`).toBe(true);
    expect(level, `${id} >= 0`).toBeGreaterThanOrEqual(0);
    if (def.kind === 'repeatable') {
      if (def.maxLevel !== null) expect(level, `${id} <= maxLevel`).toBeLessThanOrEqual(def.maxLevel);
    } else {
      expect(level, `${id} <= 1`).toBeLessThanOrEqual(1);
    }
  }
  expect(state.techLevels.handCrank).toBe(1);

  for (const id of RESOURCE_IDS) {
    expectDesignRange(state.res[id]);
    expectDesignRange(state.lifetime[id]);
    expect(state.lifetime[id], `lifetime.${id} >= res.${id}`).toBeGreaterThanOrEqual(state.res[id]);
  }

  expect(r.settings).toEqual(normalizeSettings(r.settings));
  expect(r.prestige).toEqual(normalizePrestige(r.prestige));
  expect(r.world).toEqual(normalizeWorld(r.world));
  expect(ENDING_PHASES).toContain(state.ending.phase);
  if (state.ending.phase !== 'none') expect(state.techLevels.primaryFunction).toBe(1);
  expect(r.stats.cycles).toBeGreaterThanOrEqual(1);
}

describe.each(ROWS)('$file', (row) => {
  it('codec: status and fields', () => {
    const r = deserialize(row.raw, NOW);
    expect(r.status).toBe(row.status);
    if (row.error === undefined) {
      expect(r.error).toBeUndefined();
    } else {
      expect(r.error?.startsWith(row.error), r.error).toBe(true);
    }
    expect(r.state.ending.phase).toBe(row.phase);
    expect(r.prestige).toEqual(row.prestige);
    expect(r.world).toEqual(row.world ?? DEFAULT_WORLD_SAVE);

    if (row.settings !== undefined) {
      if (row.status === 'recovered') expect(r.settings).toEqual(row.settings);
      else expect(r.settings).toMatchObject(row.settings);
    }
    if (row.levels !== undefined) expect(r.state.techLevels).toMatchObject(row.levels);
    if (row.res !== undefined) expect(r.state.res).toMatchObject(row.res);
    if (row.lifetime !== undefined) expect(r.state.lifetime).toMatchObject(row.lifetime);
    if (row.totalClicks !== undefined) expect(r.state.totalClicks).toBe(row.totalClicks);
    if (row.cycles !== undefined) expect(r.stats.cycles).toBe(row.cycles);
    if (row.noAchievements === true) expect(r.achievements.unlocked).toEqual({});
    for (const id of row.absentLevels ?? []) {
      expect(r.state.techLevels).not.toHaveProperty(id);
    }
  });

  it('codec: invariants', () => {
    expectStateInvariants(deserialize(row.raw, NOW));
  });

  it('codec: re-save is idempotent', () => {
    const r = deserialize(row.raw, NOW);
    const meta = { stats: r.stats, achievements: r.achievements, prestige: r.prestige };
    const s1 = serialize(r.state, r.settings, NOW, meta);
    const r2 = deserialize(s1, NOW);
    const s2 = serialize(r2.state, r2.settings, NOW, {
      stats: r2.stats,
      achievements: r2.achievements,
      prestige: r2.prestige,
    });
    expect(s1).toBe(s2);

    if (row.lossless === true) {
      const original = JSON.parse(row.raw) as { savedAt: number };
      const out = JSON.parse(serialize(r.state, r.settings, original.savedAt, { ...meta, world: r.world })) as {
        settings: Record<string, unknown>;
        world?: WorldSaveState;
      };
      // WP23a: old fixtures have no settings.worldVoices; its default 'on' is not written back for them.
      if (out.settings['worldVoices'] === 'on') delete out.settings['worldVoices'];
      // WP23a: old fixtures have no world block; the default block is not written back for them.
      if (JSON.stringify(out.world) === JSON.stringify(DEFAULT_WORLD_SAVE)) delete out.world;
      expect(out).toEqual(JSON.parse(row.raw));
    }
  });

  it('session: boots through SaveManager + startSession', () => {
    const { storage, boot } = bootRow(row);
    const { session } = boot;
    expect(boot.load.status).toBe(row.status);
    expect(session.world).toEqual(row.world ?? DEFAULT_WORLD_SAVE);

    for (const id of RESOURCE_IDS) {
      expectDesignRange(session.rates.perSecond[id]);
      expectDesignRange(session.rates.perClick[id]);
      expectDesignRange(session.state.res[id]);
    }

    const views = session.getAllTechViews();
    expect(views).toHaveLength(TECH_IDS.length);
    for (const view of views) {
      if (view.nextCost !== null) expect(Number.isFinite(view.nextCost), `${view.id} nextCost`).toBe(true);
    }

    if (row.status === 'recovered') {
      expect(storage.getItem(SAVE_BACKUP_KEY)).toBe(row.raw);
      expect(deserialize(storage.getItem(SAVE_KEY), NOW).status).toBe('loaded');
      expect(session.state.totalClicks).toBe(0);
    }
  });

  it('session: export string imports to the same state', () => {
    const { storage, boot } = bootRow(row);
    const { session } = boot;
    const controller = createSaveController({
      session,
      saveManager: new SaveManager(storage),
      now: () => NOW,
      scheduler: NO_SCHEDULER,
    });

    const res = parseImport(controller.exportString(), NOW);
    expect(res).toMatchObject({ ok: true });
    if (!res.ok) return;
    expect(res.envelope.state).toEqual(JSON.parse(JSON.stringify(session.state)));
    expect(res.envelope.settings).toEqual(session.settings);
    expect(res.envelope.prestige).toEqual(session.prestige);
    expect(res.envelope.world).toEqual(session.world);
  });

  it('host: boots through pickStorage, flush persists', () => {
    const disk = new Map<string, string>([[SAVE_KEY, row.raw]]);
    const picked = pickStorage({
      host: fakeHost(memoryBridge(disk)),
      legacy: () => new MemoryStorage(),
      timers: NO_TIMERS,
    });
    expect(picked.kind).toBe('host');

    const boot = bootFrom(picked.storage);
    expect(boot.load.status).toBe(row.status);
    expect(picked.flush()).toBe(true);

    const back = deserialize(disk.get(SAVE_KEY) ?? null, NOW);
    expect(back.status).toBe('loaded');
    expect(back.state.techLevels).toEqual(boot.session.state.techLevels);
    if (row.status === 'recovered') expect(disk.get(SAVE_BACKUP_KEY)).toBe(row.raw);
  });

  it.runIf(row.newCycle === true)('session: new cycle', () => {
    const { boot } = bootRow(row);
    const { session } = boot;
    const xf = session.state.lifetime.xf;
    const before = session.prestige;

    expect(session.beginNewCycle(NOW)).toBe(true);
    expect(session.prestige.cycle).toBe(before.cycle + 1);
    expect(session.prestige.echoesEarned).toBe(before.echoesEarned + echoesForCycle(xf));
    expect(session.state.ending.phase).toBe('none');
  });

  it.runIf(row.legacyAvailable === true)('legacy feeds are buyable after load', () => {
    const { boot } = bootRow(row);
    for (const id of LEGACY_FEEDS) {
      const view = boot.session.getTechView(id);
      expect(view.level, id).toBe(0);
      expect(view.status, id).toBe('available');
      expect(view.nextCost, id).toBe(TECHNOLOGIES[id].baseCost);
    }
  });
});
