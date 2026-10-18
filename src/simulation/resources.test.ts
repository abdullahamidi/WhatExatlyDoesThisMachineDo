import { describe, it, expect } from 'vitest';
import { RESOURCE_IDS } from '../data/types';
import type { ResourceMap } from '../data/types';
import { emptyResourceMap, addMaps, scaleMap } from './resources';

describe('emptyResourceMap', () => {
  it('returns a fresh map with five zeros', () => {
    const a = emptyResourceMap();
    const b = emptyResourceMap();
    expect(a).not.toBe(b);
    expect(Object.keys(a).sort()).toEqual([...RESOURCE_IDS].sort());
    for (const id of RESOURCE_IDS) expect(a[id]).toBe(0);
    a.ee = 7;
    expect(b.ee).toBe(0);
  });
});

describe('addMaps', () => {
  it('adds per key into a new object without mutating inputs', () => {
    const a: ResourceMap = { me: 1, ee: 2, pr: 3, rs: 4, xf: 5 };
    const b: ResourceMap = { me: 10, ee: 20, pr: 30, rs: 40, xf: 50 };
    const sum = addMaps(a, b);
    expect(sum).toEqual({ me: 11, ee: 22, pr: 33, rs: 44, xf: 55 });
    expect(sum).not.toBe(a);
    expect(sum).not.toBe(b);
    expect(a).toEqual({ me: 1, ee: 2, pr: 3, rs: 4, xf: 5 });
    expect(b).toEqual({ me: 10, ee: 20, pr: 30, rs: 40, xf: 50 });
  });
});

describe('scaleMap', () => {
  it('doubles every value for k = 2 without mutating input', () => {
    const m: ResourceMap = { me: 1.5, ee: 2, pr: 0, rs: 3, xf: 4 };
    const s = scaleMap(m, 2);
    expect(s).toEqual({ me: 3, ee: 4, pr: 0, rs: 6, xf: 8 });
    expect(s).not.toBe(m);
    expect(m.me).toBe(1.5);
  });

  it('scaling by 0 yields no negative zero', () => {
    const m: ResourceMap = { me: 5, ee: -3, pr: 0, rs: 0, xf: 0 };
    const s = scaleMap(m, 0);
    for (const id of RESOURCE_IDS) {
      expect(Object.is(s[id], -0)).toBe(false);
      expect(s[id]).toBe(0);
    }
  });
});
