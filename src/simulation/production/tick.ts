import type { GameState, OfflineReport } from '../../data/types';
import { OFFLINE_CAP_SECONDS } from '../../data/balance';
import { computeRates } from './rates';

// Pure time/click advancement. Never mutates its input; always returns new state objects
// (except advance(), which returns the same reference for a non-positive or non-finite step).

/** Manual click: adds perClick ME and counts one click. */
export function applyClick(state: GameState): { state: GameState; gained: number } {
  const gained = computeRates(state).perClick;
  return {
    state: {
      ...state,
      me: state.me + gained,
      lifetimeMe: state.lifetimeMe + gained,
      totalClicks: state.totalClicks + 1,
    },
    gained,
  };
}

/** Automation over `seconds`. Does not touch lastSimTime. */
export function advance(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const gained = computeRates(state).perSecond * seconds;
  return {
    ...state,
    me: state.me + gained,
    lifetimeMe: state.lifetimeMe + gained,
  };
}

/**
 * Offline progress since state.lastSimTime, automation only (never clicks), capped at capSeconds.
 * A clock that went backwards (or a non-finite time) yields zero elapsed time.
 */
export function computeOffline(
  state: GameState,
  nowMs: number,
  capSeconds: number = OFFLINE_CAP_SECONDS,
): OfflineReport {
  const raw = (nowMs - state.lastSimTime) / 1000;
  const elapsed = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  const capped = Math.min(elapsed, capSeconds);
  const gained = computeRates(state).perSecond * capped;
  return { elapsedSeconds: elapsed, cappedSeconds: capped, gained };
}

/** Credits offline progress and always moves lastSimTime to nowMs (even if the clock went backwards). */
export function applyOffline(
  state: GameState,
  nowMs: number,
): { state: GameState; report: OfflineReport } {
  const report = computeOffline(state, nowMs);
  return {
    state: {
      ...state,
      me: state.me + report.gained,
      lifetimeMe: state.lifetimeMe + report.gained,
      lastSimTime: nowMs,
    },
    report,
  };
}
