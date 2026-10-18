import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type {
  AchievementsState,
  EndingPhase,
  EndingState,
  GameState,
  ResourceMap,
  SaveEnvelope,
  SettingsState,
  StatsState,
  TechDefinition,
  TechId,
} from '../data/types';
import { ACHIEVEMENT_IDS } from '../data/achievements';
import type { AchievementId } from '../data/achievements';
import { TECHNOLOGIES } from '../data/technologies';
import { createInitialState } from '../simulation/state';
import { normalizeSettings } from '../simulation/settings';
import { emptyResourceMap } from '../simulation/resources';
import { deriveStats } from '../simulation/stats';
import { DEFAULT_ENDING, ENDING_PHASES, normalizeEnding } from '../simulation/progression/ending';

/** Current save schema version. v2 stores per-resource maps (`state.res`, `state.lifetime`). */
export const SAVE_VERSION = 2;

/** MIGRATIONS[n] migrates a version-n envelope to version n+1. */
export type Migration = (data: unknown) => unknown;

/**
 * v1 -> v2: the single `me` / `lifetimeMe` fields move into the `res` / `lifetime` resource maps.
 * Values are copied untouched so validation still rejects bad saves. Never throws; never mutates input.
 */
export function migrateV1ToV2(data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  const state = data['state'];
  if (!isPlainObject(state)) return data;
  const { me, lifetimeMe, ...rest } = state;
  const res: Plain = {};
  const lifetime: Plain = {};
  if (me !== undefined) res['me'] = me;
  if (lifetimeMe !== undefined) lifetime['me'] = lifetimeMe;
  return { ...data, state: { ...rest, res, lifetime } };
}

/** Registered migrations, keyed by the version they migrate from. */
export const MIGRATIONS: Record<number, Migration> = { 1: migrateV1ToV2 };

type Plain = Record<string, unknown>;
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Reads an optional number field: missing -> fallback, present -> must be finite (and >= min). */
function readNumber(source: Plain, key: string, fallback: number, min?: number): Parsed<number> {
  const value = source[key];
  if (value === undefined) return { ok: true, value: fallback };
  if (!isFiniteNumber(value) || (min !== undefined && value < min)) {
    return fail(`"${key}" must be a finite number${min !== undefined ? ` >= ${min}` : ''}`);
  }
  return { ok: true, value };
}

/**
 * Brings raw save data up to SAVE_VERSION by running migrations in order.
 * Returns the migrated object and whether a migration ran.
 */
export function migrate(
  data: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
): { ok: true; data: unknown; migrated: boolean } | { ok: false; error: string } {
  if (!isPlainObject(data)) return fail('Save is not an object');
  const version = data['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return fail('Save has no valid version');
  }
  if (version > SAVE_VERSION) return fail('Save is from a newer version');

  let current: unknown = data;
  let v = version;
  let migrated = false;
  while (v < SAVE_VERSION) {
    const fn = migrations[v];
    if (fn === undefined) return fail(`No migration from save version ${v}`);
    let next: unknown;
    try {
      next = fn(current);
    } catch (e) {
      return fail(`Migration from save version ${v} threw: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!isPlainObject(next)) return fail(`Migration from save version ${v} did not return an object`);
    v += 1;
    current = { ...next, version: v };
    migrated = true;
  }
  return { ok: true, data: current, migrated };
}

function readTechLevels(
  input: unknown,
  techs: Readonly<Record<TechId, TechDefinition>>,
): Parsed<Record<TechId, number>> {
  const defaults = createInitialState(0).techLevels;
  if (input === undefined) return { ok: true, value: { ...defaults } };
  if (!isPlainObject(input)) return fail('"techLevels" must be an object');
  const levels = {} as Record<TechId, number>;
  for (const id of TECH_IDS) {
    const raw = input[id];
    if (raw === undefined) {
      levels[id] = defaults[id];
      continue;
    }
    if (!isFiniteNumber(raw)) return fail(`"techLevels.${id}" must be a finite number`);
    const def = techs[id];
    // A repeatable with no maxLevel (null) is unlimited; every other kind is owned or not.
    const max = def.kind === 'repeatable' ? (def.maxLevel ?? Number.MAX_SAFE_INTEGER) : 1;
    levels[id] = Math.min(max, Math.max(0, Math.floor(raw)));
  }
  levels.handCrank = 1;
  return { ok: true, value: levels };
}

/**
 * Reads a per-resource map. Missing map -> `fallback` copy; missing key -> `fallback[id]`;
 * present keys must be finite and >= 0. Unknown keys are dropped.
 */
function readResourceMap(
  input: Plain,
  key: 'res' | 'lifetime',
  fallback: Readonly<ResourceMap>,
): Parsed<ResourceMap> {
  const raw = input[key];
  if (raw === undefined) return { ok: true, value: { ...fallback } };
  if (!isPlainObject(raw)) return fail(`"${key}" must be an object`);
  const out = emptyResourceMap();
  for (const id of RESOURCE_IDS) {
    const value = raw[id];
    if (value === undefined) {
      out[id] = fallback[id];
      continue;
    }
    if (!isFiniteNumber(value) || value < 0) {
      return fail(`"${key}.${id}" must be a finite number >= 0`);
    }
    out[id] = value;
  }
  return { ok: true, value: out };
}

function isEndingPhase(value: unknown): value is EndingPhase {
  return typeof value === 'string' && (ENDING_PHASES as readonly string[]).includes(value);
}

/**
 * Reads the finale block (WP13). Missing -> DEFAULT_ENDING; present must be
 * `{ phase: one of the four phases, engagedAt: finite number | null }`, otherwise the save is an error.
 * The load rule (normalizeEnding) runs later, once the tech levels are known.
 */
function readEnding(input: unknown): Parsed<EndingState> {
  if (input === undefined) return { ok: true, value: { ...DEFAULT_ENDING } };
  if (!isPlainObject(input)) return fail('"ending" must be an object');
  const phase = input['phase'];
  if (!isEndingPhase(phase)) return fail('"ending.phase" must be none, sequence, choice or postgame');
  const engagedAt = input['engagedAt'];
  if (engagedAt !== null && !isFiniteNumber(engagedAt)) {
    return fail('"ending.engagedAt" must be a finite number or null');
  }
  return { ok: true, value: { phase, engagedAt } };
}

function readState(
  input: unknown,
  nowMs: number,
  techs: Readonly<Record<TechId, TechDefinition>>,
): Parsed<GameState> {
  if (!isPlainObject(input)) return fail('"state" must be an object');
  const res = readResourceMap(input, 'res', emptyResourceMap());
  if (!res.ok) return res;
  const lifetime = readResourceMap(input, 'lifetime', res.value);
  if (!lifetime.ok) return lifetime;
  const totalClicks = readNumber(input, 'totalClicks', 0, 0);
  if (!totalClicks.ok) return totalClicks;
  const lastSimTime = readNumber(input, 'lastSimTime', nowMs);
  if (!lastSimTime.ok) return lastSimTime;
  const createdAt = readNumber(input, 'createdAt', nowMs);
  if (!createdAt.ok) return createdAt;
  const techLevels = readTechLevels(input['techLevels'], techs);
  if (!techLevels.ok) return techLevels;
  const ending = readEnding(input['ending']);
  if (!ending.ok) return ending;
  const lifetimeMap = emptyResourceMap();
  for (const id of RESOURCE_IDS) {
    lifetimeMap[id] = Math.max(lifetime.value[id], res.value[id]);
  }
  return {
    ok: true,
    value: {
      res: res.value,
      lifetime: lifetimeMap,
      totalClicks: Math.floor(totalClicks.value),
      techLevels: techLevels.value,
      lastSimTime: lastSimTime.value,
      createdAt: createdAt.value,
      ending: normalizeEnding(ending.value, techLevels.value),
    },
  };
}

/** Settings never fail a save: unknown or wrong-typed fields fall back to their defaults (see normalizeSettings). */
function readSettings(input: unknown): SettingsState {
  return normalizeSettings(input);
}

/** Reads a non-negative finite number, or returns the fallback (derived value). */
function readNonNegative(source: Plain, key: string, fallback: number): number {
  const value = source[key];
  return isFiniteNumber(value) && value >= 0 ? value : fallback;
}

/** Best cycle time: null is a valid value (no cycle finished yet); anything else must be a finite number >= 0. */
function readBestCycle(source: Plain, fallback: number | null): number | null {
  const value = source['bestCycleSeconds'];
  if (value === null) return null;
  return isFiniteNumber(value) && value >= 0 ? value : fallback;
}

/** Reads a non-negative count, floored to an integer, or returns the fallback. */
function readCount(source: Plain, key: string, fallback: number): number {
  const value = source[key];
  return isFiniteNumber(value) && value >= 0 ? Math.floor(value) : fallback;
}

/** Reads a per-resource stats map key by key; a missing or invalid entry takes the fallback value. */
function readStatsMap(source: Plain, key: 'lifetime' | 'maxPerSecond', fallback: Readonly<ResourceMap>): ResourceMap {
  const raw = source[key];
  const map = isPlainObject(raw) ? raw : {};
  const out = emptyResourceMap();
  for (const id of RESOURCE_IDS) {
    const value = map[id];
    out[id] = isFiniteNumber(value) && value >= 0 ? value : fallback[id];
  }
  return out;
}

/**
 * Lenient reader for the lifetime stats block. Cosmetic data never fails a save: a missing block
 * derives every value from the game state; each invalid field (non-finite, negative, wrong type)
 * takes its derived value. Never throws; returns a new object.
 */
export function readStats(input: unknown, state: GameState, nowMs: number): StatsState {
  const derived = deriveStats(state, nowMs);
  if (!isPlainObject(input)) return derived;
  return {
    activeSeconds: readNonNegative(input, 'activeSeconds', derived.activeSeconds),
    offlineSeconds: readNonNegative(input, 'offlineSeconds', derived.offlineSeconds),
    longestOfflineSeconds: readNonNegative(input, 'longestOfflineSeconds', derived.longestOfflineSeconds),
    clicks: readCount(input, 'clicks', derived.clicks),
    purchases: readCount(input, 'purchases', derived.purchases),
    lifetime: readStatsMap(input, 'lifetime', derived.lifetime),
    maxPerSecond: readStatsMap(input, 'maxPerSecond', derived.maxPerSecond),
    cycles: readCount(input, 'cycles', derived.cycles),
    bestCycleSeconds: readBestCycle(input, derived.bestCycleSeconds),
    startedAt: readNonNegative(input, 'startedAt', derived.startedAt),
  };
}

/**
 * Lenient reader for the achievements block (`{ unlocked: { id: epochMs } }`). Unknown ids and
 * non-finite or negative timestamps are dropped; a missing block means no achievements.
 */
export function readAchievements(input: unknown): AchievementsState {
  const unlocked: Partial<Record<AchievementId, number>> = {};
  if (!isPlainObject(input) || !isPlainObject(input['unlocked'])) return { unlocked };
  const raw = input['unlocked'];
  for (const id of ACHIEVEMENT_IDS) {
    const at = raw[id];
    if (isFiniteNumber(at) && at >= 0) unlocked[id] = at;
  }
  return { unlocked };
}

/**
 * Lenient normaliser for a (migrated) save envelope. Missing optional fields take defaults;
 * present core fields (version, savedAt, state) of the wrong type are errors. Settings, stats and
 * achievements never fail a save. The result contains only known fields and always has all of them.
 * `techs` supplies the technology definitions used to clamp levels (injectable for tests).
 */
export function validateEnvelope(
  input: unknown,
  nowMs: number,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
): { ok: true; envelope: SaveEnvelope } | { ok: false; error: string } {
  if (!isPlainObject(input)) return fail('Save is not an object');
  if (input['version'] !== SAVE_VERSION) {
    return fail(`Unsupported save version ${String(input['version'])}`);
  }
  const savedAt = readNumber(input, 'savedAt', nowMs);
  if (!savedAt.ok) return savedAt;
  const state = readState(input['state'], nowMs, techs);
  if (!state.ok) return state;
  const settings = readSettings(input['settings']);
  const stats = readStats(input['stats'], state.value, nowMs);
  const achievements = readAchievements(input['achievements']);
  return {
    ok: true,
    envelope: {
      version: SAVE_VERSION,
      savedAt: savedAt.value,
      state: state.value,
      settings,
      stats,
      achievements,
    },
  };
}
