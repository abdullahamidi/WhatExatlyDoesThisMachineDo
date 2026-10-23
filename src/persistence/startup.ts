import { GameSession, clampLoadToEra } from '../simulation';
import type { EraCap } from '../simulation';
import { SAVE_FULLGAME_KEY } from '../data/balance';
import type { OfflineReport, LoadResult } from '../data/types';
import type { AchievementId } from '../data/achievements';
import type { SaveManager } from './saveManager';

/** Everything the host needs after boot: the live session plus what happened while loading. */
export interface StartupResult {
  session: GameSession;
  load: LoadResult;
  offline: OfflineReport;
  saved: boolean;
  /** Achievements unlocked by the boot offline catch-up (WP15 T8), in unlock order. Empty on a fresh start. */
  bootAchievements: AchievementId[];
  /** WP21: the loaded save had to be clamped to the edition's era cap (e.g. a full-game save on the demo). */
  clamped: boolean;
}

/**
 * Boots a GameSession from storage. Offline progress is applied exactly once (applyOffline),
 * then the state is written back so the next load does not award the same time again.
 * When the read failed (load.error with status 'new') the boot save is skipped so a possibly
 * good save is not overwritten; `saved` is then false.
 * WP21 edition cap: `opts.maxEra` clamps the loaded state and prestige (demo: era 2). The first
 * clamp copies the untouched raw save to `opts.fullGameBackupKey` (default SAVE_FULLGAME_KEY)
 * before the boot save overwrites it; later boots have nothing to clamp, so that backup stays.
 * Never throws: storage failures degrade to a fresh state and `saved: false`.
 */
export function startSession(
  saveManager: SaveManager,
  nowMs: number,
  clock: () => number = () => Date.now(),
  opts: { maxEra?: EraCap; fullGameBackupKey?: string } = {},
): StartupResult {
  const load = saveManager.load(nowMs);
  const maxEra = opts.maxEra ?? null;
  const c = clampLoadToEra({ state: load.state, prestige: load.prestige }, maxEra);
  // Must run before the boot save below, which would overwrite the raw text this copies.
  if (c.changed && load.status !== 'new') saveManager.backup(opts.fullGameBackupKey ?? SAVE_FULLGAME_KEY);
  const session = new GameSession({
    state: c.state,
    settings: load.settings,
    stats: load.stats,
    achievements: load.achievements,
    prestige: c.prestige,
    maxEra,
    now: clock,
  });
  // Listener before applyOffline: the boot catch-up can unlock achievements, and nothing else hears them yet.
  const bootAchievements: AchievementId[] = [];
  const offAchievements = session.on('achievement', ({ ids }) => {
    bootAchievements.push(...ids);
  });
  let offline: OfflineReport;
  try {
    offline = session.applyOffline(nowMs);
  } finally {
    offAchievements();
  }
  if (load.error !== undefined && load.status === 'new') {
    return { session, load, offline, saved: false, bootAchievements, clamped: c.changed };
  }
  const saved = saveManager.save(session.state, session.settings, nowMs, {
    stats: session.stats,
    achievements: session.achievements,
    prestige: session.prestige,
  });
  return { session, load, offline, saved, bootAchievements, clamped: c.changed };
}
