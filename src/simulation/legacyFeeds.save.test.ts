import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import type { GameState, TechId } from '../data/types';
import { deserialize, serialize } from '../persistence/codec';
import v2Primary from '../persistence/fixtures/v2-wp11-primary.json';
import { createInitialState, DEFAULT_SETTINGS } from './state';

// Save compatibility of the WP17 Legacy Feeds (bellowsDrive, gridExciter, mainsBackfeed, steamLance).
// They are uncapped repeatables: a save written before they existed loads with level 0, and a high
// level survives the round trip without clamping. No Phaser, no storage: codec only.

const LEGACY_FEEDS: readonly TechId[] = ['bellowsDrive', 'gridExciter', 'mainsBackfeed', 'steamLance'];

/** A fresh initial state with the given tech levels applied. */
function withLevels(levels: Partial<Record<TechId, number>>): GameState {
  const base = createInitialState(0);
  return { ...base, techLevels: { ...base.techLevels, ...levels } };
}

describe('legacy feed save compatibility (WP17)', () => {
  it('the WP11 fixture (written before the Legacy Feeds) loads with every feed at level 0', () => {
    const result = deserialize(JSON.stringify(v2Primary), 3000);
    expect(result.status).toBe('loaded');
    for (const id of LEGACY_FEEDS) {
      expect(result.state.techLevels[id]).toBe(0);
    }
    expect(Object.keys(result.state.techLevels).length).toBe(TECH_IDS.length);
  });

  it('feed levels 37 / 25 / 3 survive a round trip unchanged (uncapped, not clamped)', () => {
    const state = withLevels({ bellowsDrive: 37, gridExciter: 25, mainsBackfeed: 3 });
    const result = deserialize(serialize(state, DEFAULT_SETTINGS, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels.bellowsDrive).toBe(37);
    expect(result.state.techLevels.gridExciter).toBe(25);
    expect(result.state.techLevels.mainsBackfeed).toBe(3);
  });

  it('a bellowsDrive level of 1000000 survives a round trip', () => {
    const state = withLevels({ bellowsDrive: 1000000 });
    const result = deserialize(serialize(state, DEFAULT_SETTINGS, 2000), 3000);
    expect(result.status).toBe('loaded');
    expect(result.state.techLevels.bellowsDrive).toBe(1000000);
  });
});
