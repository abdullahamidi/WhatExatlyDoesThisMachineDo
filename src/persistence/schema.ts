import { TECH_IDS } from '../data/types';
import type { GameState, SaveEnvelope, SettingsState, TechDefinition, TechId } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';

/** Current save schema version. */
export const SAVE_VERSION = 1;

/** MIGRATIONS[n] migrates a version-n envelope to version n+1. */
export type Migration = (data: unknown) => unknown;

/** Registered migrations. Empty for v1. */
export const MIGRATIONS: Record<number, Migration> = {};

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
 * Returns the migrated object and whether any migration ran.
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

function readState(
  input: unknown,
  nowMs: number,
  techs: Readonly<Record<TechId, TechDefinition>>,
): Parsed<GameState> {
  if (!isPlainObject(input)) return fail('"state" must be an object');
  const me = readNumber(input, 'me', 0, 0);
  if (!me.ok) return me;
  const lifetimeMe = readNumber(input, 'lifetimeMe', me.value, 0);
  if (!lifetimeMe.ok) return lifetimeMe;
  const totalClicks = readNumber(input, 'totalClicks', 0, 0);
  if (!totalClicks.ok) return totalClicks;
  const lastSimTime = readNumber(input, 'lastSimTime', nowMs);
  if (!lastSimTime.ok) return lastSimTime;
  const createdAt = readNumber(input, 'createdAt', nowMs);
  if (!createdAt.ok) return createdAt;
  const techLevels = readTechLevels(input['techLevels'], techs);
  if (!techLevels.ok) return techLevels;
  return {
    ok: true,
    value: {
      me: me.value,
      lifetimeMe: Math.max(lifetimeMe.value, me.value),
      totalClicks: Math.floor(totalClicks.value),
      techLevels: techLevels.value,
      lastSimTime: lastSimTime.value,
      createdAt: createdAt.value,
    },
  };
}

function readSettings(input: unknown): Parsed<SettingsState> {
  if (input === undefined) return { ok: true, value: { ...DEFAULT_SETTINGS } };
  if (!isPlainObject(input)) return fail('"settings" must be an object');
  const muted = input['muted'];
  if (muted === undefined) return { ok: true, value: { muted: DEFAULT_SETTINGS.muted } };
  if (typeof muted !== 'boolean') return fail('"settings.muted" must be a boolean');
  return { ok: true, value: { muted } };
}

/**
 * Lenient normaliser for a (migrated) save envelope. Missing optional fields take defaults;
 * present fields of the wrong type are errors. The result contains only known fields.
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
  if (!settings.ok) return settings;
  return {
    ok: true,
    envelope: {
      version: SAVE_VERSION,
      savedAt: savedAt.value,
      state: state.value,
      settings: settings.value,
    },
  };
}
