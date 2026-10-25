import type { AchievementsState, GameState, LoadResult, PrestigeState, SaveEnvelope, SettingsState, StatsState } from '../data/types';
import type { WorldSaveState } from '../data/livingWorld';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { emptyStats } from '../simulation/stats';
import { DEFAULT_PRESTIGE } from '../simulation/prestige';
import { normalizeWorld } from '../simulation/worldSave';
import { MIGRATIONS, SAVE_VERSION, migrate, validateEnvelope } from './schema';
import type { Migration } from './schema';

/**
 * Cosmetic progress written next to the core save (WP12); prestige is the new-cycle block (WP14).
 * `world` is the optional living-world block (WP23a): written only when given.
 */
export interface SaveMeta {
  stats: StatsState;
  achievements: AchievementsState;
  prestige: PrestigeState;
  world?: WorldSaveState;
}

/**
 * Encodes state and settings as a versioned JSON envelope. `meta` is optional: when omitted the
 * stats, achievements and prestige fields are left out, so the output matches the pre-WP12 format.
 */
export function serialize(state: GameState, settings: SettingsState, nowMs: number, meta?: SaveMeta): string {
  const envelope =
    meta === undefined
      ? { version: SAVE_VERSION, savedAt: nowMs, state, settings }
      : {
          version: SAVE_VERSION,
          savedAt: nowMs,
          state,
          settings,
          stats: meta.stats,
          achievements: meta.achievements,
          prestige: meta.prestige,
          ...(meta.world === undefined ? {} : { world: meta.world }),
        };
  return JSON.stringify(envelope);
}

function fresh(nowMs: number): Pick<LoadResult, 'state' | 'settings' | 'stats' | 'achievements' | 'prestige' | 'world'> {
  return {
    state: createInitialState(nowMs),
    settings: { ...DEFAULT_SETTINGS },
    stats: emptyStats(nowMs),
    achievements: { unlocked: {} },
    prestige: { ...DEFAULT_PRESTIGE, perks: [] },
    world: normalizeWorld(undefined),
  };
}

export type ParseEnvelopeResult =
  | { ok: true; envelope: SaveEnvelope; migrated: boolean }
  | { ok: false; error: string };

/**
 * Raw text -> validated envelope: JSON.parse, then migrations, then validation. Never throws and
 * never touches storage. Shared by the boot load and the player import.
 */
export function parseEnvelope(raw: string, nowMs: number, migrations: Record<number, Migration> = MIGRATIONS): ParseEnvelopeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `Save data is not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }

  const migrated = migrate(parsed, migrations);
  if (!migrated.ok) return { ok: false, error: migrated.error };

  const validated = validateEnvelope(migrated.data, nowMs);
  if (!validated.ok) return { ok: false, error: validated.error };

  return { ok: true, envelope: validated.envelope, migrated: migrated.migrated };
}

/**
 * Parses and validates raw save text. Never throws. Does not touch storage.
 * `null` means no save exists; any unreadable save yields a fresh state with status 'recovered'.
 */
export function deserialize(
  raw: string | null,
  nowMs: number,
  migrations: Record<number, Migration> = MIGRATIONS,
): LoadResult {
  if (raw === null) return { ...fresh(nowMs), status: 'new' };

  const parsed = parseEnvelope(raw, nowMs, migrations);
  if (!parsed.ok) return { ...fresh(nowMs), status: 'recovered', error: parsed.error };

  const { envelope } = parsed;
  return {
    state: envelope.state,
    settings: envelope.settings,
    stats: envelope.stats,
    achievements: envelope.achievements,
    prestige: envelope.prestige,
    world: envelope.world,
    status: parsed.migrated ? 'migrated' : 'loaded',
  };
}
