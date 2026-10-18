import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../data/types';
import { createInitialState, DEFAULT_SETTINGS } from './state';

describe('createInitialState', () => {
  it('creates the initial game state', () => {
    const s = createInitialState(1234);
    expect(s.me).toBe(0);
    expect(s.lifetimeMe).toBe(0);
    expect(s.totalClicks).toBe(0);
    expect(s.techLevels.handCrank).toBe(1);
    for (const id of TECH_IDS) {
      if (id !== 'handCrank') expect(s.techLevels[id]).toBe(0);
    }
    expect(Object.keys(s.techLevels)).toHaveLength(9);
    expect(s.lastSimTime).toBe(1234);
    expect(s.createdAt).toBe(1234);
  });

  it('returns a fresh object on every call', () => {
    const a = createInitialState(1234);
    const b = createInitialState(1234);
    expect(a).not.toBe(b);
    expect(a.techLevels).not.toBe(b.techLevels);
    a.techLevels.gearRatio = 5;
    expect(b.techLevels.gearRatio).toBe(0);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('is unmuted by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ muted: false });
  });
});
