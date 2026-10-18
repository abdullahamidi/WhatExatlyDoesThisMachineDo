import { GameSession } from '../simulation';
import type { OfflineReport, LoadResult } from '../data/types';
import type { SaveManager } from './saveManager';

/** Everything the host needs after boot: the live session plus what happened while loading. */
export interface StartupResult {
  session: GameSession;
  load: LoadResult;
  offline: OfflineReport;
  saved: boolean;
}

/**
 * Boots a GameSession from storage. Offline progress is applied exactly once (applyOffline),
 * then the state is written back so the next load does not award the same time again.
 * When the read failed (load.error with status 'new') the boot save is skipped so a possibly
 * good save is not overwritten; `saved` is then false.
 * Never throws: storage failures degrade to a fresh state and `saved: false`.
 */
export function startSession(
  saveManager: SaveManager,
  nowMs: number,
  clock: () => number = () => Date.now(),
): StartupResult {
  const load = saveManager.load(nowMs);
  const session = new GameSession({
    state: load.state,
    settings: load.settings,
    stats: load.stats,
    achievements: load.achievements,
    now: clock,
  });
  const offline = session.applyOffline(nowMs);
  if (load.error !== undefined && load.status === 'new') {
    return { session, load, offline, saved: false };
  }
  const saved = saveManager.save(session.state, session.settings, nowMs, {
    stats: session.stats,
    achievements: session.achievements,
  });
  return { session, load, offline, saved };
}
