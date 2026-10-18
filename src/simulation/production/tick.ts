import { TECH_IDS } from '../../data/types';
import type { GameState, OfflineReport, ResourceMap, TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { OFFLINE_CAP_SECONDS } from '../../data/balance';
import { computeRates } from './rates';
import { addMaps, scaleMap } from '../resources';

// Pure time/click advancement. Never mutates its input; always returns new state objects
// (except advance(), which returns the same reference for a non-positive or non-finite step).
// Every resource in `res` and `lifetime` moves together: per-resource rate x elapsed time.

/** Manual click: adds perClick (all resources) and counts one click. `gained` is the ME part. */
export function applyClick(
  state: GameState,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): { state: GameState; gained: number; gainedAll: ResourceMap } {
  const gainedAll = computeRates(state, techs).perClick;
  return {
    state: {
      ...state,
      res: addMaps(state.res, gainedAll),
      lifetime: addMaps(state.lifetime, gainedAll),
      totalClicks: state.totalClicks + 1,
    },
    gained: gainedAll.me,
    gainedAll,
  };
}

/** Automation over `seconds`. Does not touch lastSimTime. */
export function advance(
  state: GameState,
  seconds: number,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const gained = scaleMap(computeRates(state, techs).perSecond, seconds);
  return {
    ...state,
    res: addMaps(state.res, gained),
    lifetime: addMaps(state.lifetime, gained),
  };
}

/**
 * Offline cap in seconds: the base cap plus 'offlineHours' effects of owned techs (hours x level).
 * Techs with level <= 0 contribute nothing.
 */
export function offlineCapSeconds(
  techLevels: Readonly<Record<TechId, number>>,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): number {
  let hours = 0;
  for (const id of TECH_IDS) {
    const level = techLevels[id];
    if (level <= 0) continue;
    for (const effect of techs[id].effects) {
      if (effect.type === 'offlineHours') hours += effect.hours * level;
    }
  }
  // 3600 = seconds per hour (unit conversion, not a balance number).
  return OFFLINE_CAP_SECONDS + 3600 * hours;
}

/**
 * Offline progress since state.lastSimTime, automation only, incl. servo auto-cranks; never manual clicks,
 * capped at capSeconds.
 * A clock that went backwards (or a non-finite time) yields zero elapsed time.
 */
export function computeOffline(
  state: GameState,
  nowMs: number,
  capSeconds: number = OFFLINE_CAP_SECONDS,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): OfflineReport {
  const raw = (nowMs - state.lastSimTime) / 1000;
  const elapsed = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  const capped = Math.min(elapsed, capSeconds);
  const gained = scaleMap(computeRates(state, techs).perSecond, capped);
  return { elapsedSeconds: elapsed, cappedSeconds: capped, gained };
}

/** Credits offline progress and always moves lastSimTime to nowMs (even if the clock went backwards). */
export function applyOffline(
  state: GameState,
  nowMs: number,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): { state: GameState; report: OfflineReport } {
  const report = computeOffline(state, nowMs, offlineCapSeconds(state.techLevels, techs), techs);
  return {
    state: {
      ...state,
      res: addMaps(state.res, report.gained),
      lifetime: addMaps(state.lifetime, report.gained),
      lastSimTime: nowMs,
    },
    report,
  };
}
