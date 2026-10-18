import { RESOURCE_IDS } from '../data/types';
import type { GameState, ResourceMap, StatsState } from '../data/types';
import { emptyResourceMap } from './resources';

// Lifetime statistics (WP12). Every function returns a new object and never mutates its inputs.

function copyResourceMap(m: Readonly<ResourceMap>): ResourceMap {
  const out = emptyResourceMap();
  for (const id of RESOURCE_IDS) out[id] = m[id];
  return out;
}

export function emptyStats(nowMs: number): StatsState {
  return {
    activeSeconds: 0,
    offlineSeconds: 0,
    longestOfflineSeconds: 0,
    clicks: 0,
    purchases: 0,
    lifetime: emptyResourceMap(),
    maxPerSecond: emptyResourceMap(),
    cycles: 1,
    bestCycleSeconds: null,
    startedAt: nowMs,
  };
}

// Stats for a save that has no stats block yet: counters come from the game state.
export function deriveStats(state: GameState, nowMs: number): StatsState {
  return {
    ...emptyStats(nowMs),
    clicks: state.totalClicks,
    lifetime: copyResourceMap(state.lifetime),
    startedAt: Number.isFinite(state.createdAt) ? state.createdAt : nowMs,
  };
}

// Adds the positive per-resource growth from prev to next. Non-finite deltas are ignored.
export function addLifetimeDelta(stats: StatsState, prev: ResourceMap, next: ResourceMap): StatsState {
  const lifetime = copyResourceMap(stats.lifetime);
  let added = false;
  for (const id of RESOURCE_IDS) {
    const delta = next[id] - prev[id];
    if (!Number.isFinite(delta) || delta <= 0) continue;
    lifetime[id] = stats.lifetime[id] + delta;
    added = true;
  }
  if (!added) return stats;
  return { ...stats, lifetime };
}

// Raises the per-resource best rate to perSecond when higher. Non-finite rates are ignored.
export function bumpMaxRates(stats: StatsState, perSecond: ResourceMap): StatsState {
  const maxPerSecond = copyResourceMap(stats.maxPerSecond);
  let raised = false;
  for (const id of RESOURCE_IDS) {
    const rate = perSecond[id];
    if (!Number.isFinite(rate) || rate <= stats.maxPerSecond[id]) continue;
    maxPerSecond[id] = rate;
    raised = true;
  }
  if (!raised) return stats;
  return { ...stats, maxPerSecond };
}
