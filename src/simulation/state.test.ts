import { describe, it, expect } from 'vitest';
import { TECH_IDS, RESOURCE_IDS } from '../data/types';
import { DEFAULT_SETTINGS_VALUES } from '../data/settings';
import { createInitialState, DEFAULT_SETTINGS } from './state';

describe('createInitialState', () => {
  it('creates the initial game state', () => {
    const s = createInitialState(5);
    for (const id of RESOURCE_IDS) {
      expect(s.res[id]).toBe(0);
      expect(s.lifetime[id]).toBe(0);
    }
    expect(s.res).not.toBe(s.lifetime);
    expect(s.totalClicks).toBe(0);
    expect(s.techLevels.handCrank).toBe(1);
    for (const id of TECH_IDS) {
      if (id !== 'handCrank') expect(s.techLevels[id]).toBe(0);
    }
    expect(Object.keys(s.techLevels)).toHaveLength(TECH_IDS.length);
    expect(s.lastSimTime).toBe(5);
    expect(s.createdAt).toBe(5);
  });

  it('returns a fresh object on every call', () => {
    const a = createInitialState(5);
    const b = createInitialState(5);
    expect(a).not.toBe(b);
    expect(a.techLevels).not.toBe(b.techLevels);
    expect(a.res).not.toBe(b.res);
    expect(a.lifetime).not.toBe(b.lifetime);
    a.techLevels.gearRatio = 5;
    a.res.me = 9;
    a.lifetime.ee = 9;
    expect(b.techLevels.gearRatio).toBe(0);
    expect(b.res.me).toBe(0);
    expect(b.lifetime.ee).toBe(0);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('is unmuted by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({ ...DEFAULT_SETTINGS, muted: false });
  });

  it('deep-equals the default settings values', () => {
    expect(DEFAULT_SETTINGS).toEqual(DEFAULT_SETTINGS_VALUES);
  });

  it('is a fresh object, not the shared values object', () => {
    expect(DEFAULT_SETTINGS).not.toBe(DEFAULT_SETTINGS_VALUES);
  });
});
