import type { GameState, LoadResult, SaveEnvelope, SettingsState } from '../data/types';
import { createInitialState, DEFAULT_SETTINGS } from '../simulation/state';
import { MIGRATIONS, SAVE_VERSION, migrate, validateEnvelope } from './schema';
import type { Migration } from './schema';

/** Encodes state and settings as a versioned JSON envelope. */
export function serialize(state: GameState, settings: SettingsState, nowMs: number): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, savedAt: nowMs, state, settings };
  return JSON.stringify(envelope);
}

function fresh(nowMs: number): Pick<LoadResult, 'state' | 'settings'> {
  return { state: createInitialState(nowMs), settings: { ...DEFAULT_SETTINGS } };
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

  const recovered = (error: string): LoadResult => ({ ...fresh(nowMs), status: 'recovered', error });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return recovered(`Save data is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  const migrated = migrate(parsed, migrations);
  if (!migrated.ok) return recovered(migrated.error);

  const validated = validateEnvelope(migrated.data, nowMs);
  if (!validated.ok) return recovered(validated.error);

  return {
    state: validated.envelope.state,
    settings: validated.envelope.settings,
    status: migrated.migrated ? 'migrated' : 'loaded',
  };
}
