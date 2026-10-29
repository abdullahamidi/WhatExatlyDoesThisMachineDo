// Save remap (WP28 C3): split-track levels of an old save are multiplied by their parts; econ 28 saves are left alone.
// Why: the remap is the only thing that keeps an old machine the same machine after the pacing change. Pure: no persistence.
import { describe, it, expect } from 'vitest';
import { ECON_REVISION, SPLIT_PARTS } from '../data/pacing';
import { needsEconRemap, remapSplitLevels } from './economyMigration';

const SPLIT_IDS = Object.keys(SPLIT_PARTS);

describe('needsEconRemap', () => {
  it('is false for a save written at ECON_REVISION or later', () => {
    expect(ECON_REVISION).toBe(28);
    expect(needsEconRemap({ econ: 28 })).toBe(false);
    expect(needsEconRemap({ econ: 99 })).toBe(false);
  });

  it('is true for an older, missing or non-number marker', () => {
    expect(needsEconRemap({ econ: 27 })).toBe(true);
    expect(needsEconRemap({})).toBe(true);
    expect(needsEconRemap({ econ: null })).toBe(true);
    expect(needsEconRemap({ econ: '28' })).toBe(true);
  });
});

describe('remapSplitLevels', () => {
  it('multiplies exactly the 17 split tracks by their parts', () => {
    expect(SPLIT_IDS).toHaveLength(17);
    const input: Record<string, unknown> = {};
    for (const id of SPLIT_IDS) input[id] = 1;
    const out = remapSplitLevels(input);
    for (const id of SPLIT_IDS) {
      expect(out[id], id).toBe(SPLIT_PARTS[id as keyof typeof SPLIT_PARTS]);
    }
    expect(out['copperWinding']).toBe(2);
    expect(out['inductionHeater']).toBe(3);
  });

  it('scales the fractional and large finite values as written (v x parts)', () => {
    const out = remapSplitLevels({ steamLance: 7.9, bellowsDrive: 500, gridExciter: 0 });
    expect(out['steamLance']).toBeCloseTo(23.7, 9);
    expect(out['bellowsDrive']).toBe(1500);
    expect(out['gridExciter']).toBe(0);
  });

  it('keeps a value whose product overflows, so the reader clamps it instead of rejecting the save', () => {
    expect(remapSplitLevels({ copperWinding: 1e308 })['copperWinding']).toBe(1e308);
  });

  it('leaves non-number values alone', () => {
    const raw = { copperWinding: '3', firebox: null, steamLance: true, condenser: [4], horizonField: { v: 2 }, graviticAnchor: Infinity };
    const out = remapSplitLevels(raw);
    expect(out).toEqual(raw);
    expect(out['graviticAnchor']).toBe(Infinity);
  });

  it('leaves other ids and unknown ids alone', () => {
    const out = remapSplitLevels({ gearRatio: 3, wornMotor: 1, quantumFoo: 5, crankServo: 10, copperWinding: 2 });
    expect(out).toEqual({ gearRatio: 3, wornMotor: 1, quantumFoo: 5, crankServo: 10, copperWinding: 4 });
  });

  it('an empty object stays empty', () => {
    expect(remapSplitLevels({})).toEqual({});
  });

  it('never mutates its input and returns a new object', () => {
    const input: Record<string, unknown> = { copperWinding: 25, steamLance: 6, gearRatio: 3 };
    const before = JSON.stringify(input);
    const out = remapSplitLevels(input);
    expect(out).not.toBe(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(input['copperWinding']).toBe(25);
  });
});
