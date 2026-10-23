// STATS tab model (WP12 T7). Pure: turns StatsState into label/value rows. No DOM.
import { RESOURCES } from '../../data/resources';
import { RESOURCE_IDS } from '../../data/types';
import type { ResourceDefinition, ResourceId, StatsState } from '../../data/types';
import { formatDuration, formatNumber, formatRate } from '../../utils/format';

export interface StatsRow { label: string; value: string }

// Row labels for the STATS tab (display texts; the resource short names come from data/resources).
export const STATS_VIEW_LABELS = {
  playtime: 'PLAYTIME',
  timeAway: 'TIME AWAY',
  longestAbsence: 'LONGEST ABSENCE',
  clicks: 'CLICKS',
  purchases: 'PURCHASES',
  cycle: 'CYCLE',
  bestCycle: 'BEST CYCLE',
  total: 'TOTAL',
  bestRate: 'BEST RATE',
} as const;

// Edition filters. hideCycles drops the cycle rows; maxEra drops the rows of resources past the cap.
export interface StatsRowOptions {
  hideCycles?: boolean;
  maxEra?: number | null;
}

/**
 * Fixed rows first (playtime, away time, clicks, purchases, cycles, best cycle when known), then for every resource with a
 * lifetime total above zero: TOTAL and BEST RATE. Values follow the default notation.
 */
export function statsRows(
  stats: Readonly<StatsState>,
  resources: Readonly<Record<ResourceId, ResourceDefinition>> = RESOURCES,
  opts: StatsRowOptions = {},
): StatsRow[] {
  const rows: StatsRow[] = [
    { label: STATS_VIEW_LABELS.playtime, value: formatDuration(stats.activeSeconds) },
    { label: STATS_VIEW_LABELS.timeAway, value: formatDuration(stats.offlineSeconds) },
    { label: STATS_VIEW_LABELS.longestAbsence, value: formatDuration(stats.longestOfflineSeconds) },
    { label: STATS_VIEW_LABELS.clicks, value: formatNumber(stats.clicks) },
    { label: STATS_VIEW_LABELS.purchases, value: formatNumber(stats.purchases) },
  ];
  if (opts.hideCycles !== true) {
    rows.push({ label: STATS_VIEW_LABELS.cycle, value: formatNumber(stats.cycles) });
    // WP14: the fastest finished cycle (wall clock, offline time included). Hidden until a cycle has ended.
    if (stats.bestCycleSeconds !== null) {
      rows.push({ label: STATS_VIEW_LABELS.bestCycle, value: formatDuration(stats.bestCycleSeconds) });
    }
  }
  const maxEra = opts.maxEra ?? null;
  for (const id of RESOURCE_IDS) {
    if (!(stats.lifetime[id] > 0)) continue;
    // Resources past the era cap were never reachable in this edition, so their rows stay out.
    if (maxEra !== null && resources[id].era > maxEra) continue;
    const short = resources[id].short;
    rows.push({ label: `${short} ${STATS_VIEW_LABELS.total}`, value: formatNumber(stats.lifetime[id]) });
    rows.push({ label: `${short} ${STATS_VIEW_LABELS.bestRate}`, value: formatRate(stats.maxPerSecond[id]) });
  }
  return rows;
}
