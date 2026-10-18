import { describe, it, expect, afterEach } from 'vitest';
import type { ResourceMap, StatsState } from '../../data/types';
import { emptyStats } from '../../simulation/stats';
import { setDefaultNotation } from '../../utils/format';
import { STATS_VIEW_LABELS, statsRows } from './statsView';

function resources(partial: Partial<ResourceMap> = {}): ResourceMap {
  return { me: 0, ee: 0, pr: 0, rs: 0, xf: 0, ...partial };
}

function stats(patch: Partial<StatsState> = {}): StatsState {
  return { ...emptyStats(0), ...patch };
}

afterEach(() => {
  setDefaultNotation('suffix');
});

describe('statsRows', () => {
  it('empty stats: only the six fixed rows with zero values', () => {
    expect(statsRows(emptyStats(0))).toEqual([
      { label: 'PLAYTIME', value: '0s' },
      { label: 'TIME AWAY', value: '0s' },
      { label: 'LONGEST ABSENCE', value: '0s' },
      { label: 'CLICKS', value: '0' },
      { label: 'PURCHASES', value: '0' },
      { label: 'CYCLE', value: '1' },
    ]);
  });

  it('fixed rows use the duration and count formats', () => {
    const rows = statsRows(stats({ activeSeconds: 3725, offlineSeconds: 90, longestOfflineSeconds: 7200, clicks: 1500, purchases: 42, cycles: 2 }));
    expect(rows.slice(0, 6)).toEqual([
      { label: STATS_VIEW_LABELS.playtime, value: '1h 2m' },
      { label: STATS_VIEW_LABELS.timeAway, value: '1m 30s' },
      { label: STATS_VIEW_LABELS.longestAbsence, value: '2h' },
      { label: STATS_VIEW_LABELS.clicks, value: '1.5K' },
      { label: STATS_VIEW_LABELS.purchases, value: '42' },
      { label: STATS_VIEW_LABELS.cycle, value: '2' },
    ]);
  });

  it('adds TOTAL and BEST RATE rows only for resources with lifetime above zero', () => {
    const rows = statsRows(
      stats({
        lifetime: resources({ me: 1_500_000, xf: 3 }),
        maxPerSecond: resources({ me: 2.5, xf: 0.5 }),
      }),
    );
    expect(rows.slice(6)).toEqual([
      { label: 'ME TOTAL', value: '1.5M' },
      { label: 'ME BEST RATE', value: '2.5/s' },
      { label: '??? TOTAL', value: '3' },
      { label: '??? BEST RATE', value: '0.5/s' },
    ]);
  });

  it('skips resources with zero or NaN lifetime', () => {
    const rows = statsRows(stats({ lifetime: resources({ ee: 0, pr: Number.NaN }) }));
    expect(rows).toHaveLength(6);
  });

  it('keeps resource order me, ee, pr, rs, xf', () => {
    const rows = statsRows(
      stats({
        lifetime: resources({ xf: 1, rs: 1, pr: 1, ee: 1, me: 1 }),
        maxPerSecond: resources({ me: 1, ee: 1, pr: 1, rs: 1, xf: 1 }),
      }),
    );
    const resourceLabels = rows.slice(6).filter((r) => r.label.endsWith('TOTAL')).map((r) => r.label);
    expect(resourceLabels).toEqual(['ME TOTAL', 'EE TOTAL', 'PR TOTAL', 'RS TOTAL', '??? TOTAL']);
  });

  it('values follow the default notation', () => {
    const lifetime = resources({ me: 1_500_000 });
    const maxPerSecond = resources({ me: 1_500_000 });
    expect(statsRows(stats({ lifetime, maxPerSecond })).slice(6)).toEqual([
      { label: 'ME TOTAL', value: '1.5M' },
      { label: 'ME BEST RATE', value: '1.5M/s' },
    ]);
    setDefaultNotation('scientific');
    expect(statsRows(stats({ lifetime, maxPerSecond })).slice(6)).toEqual([
      { label: 'ME TOTAL', value: '1.50e6' },
      { label: 'ME BEST RATE', value: '1.50e6/s' },
    ]);
  });
});
