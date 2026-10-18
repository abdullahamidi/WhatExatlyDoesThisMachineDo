import { describe, it, expect } from 'vitest';
import type { MachineComponentId } from '../../data/machineComponents';
import { createInitialState } from '../../simulation';
import { visibleComponentIds, newlyVisible } from './machineVisibility';

describe('visibleComponentIds', () => {
  it('shows only the frame and the hand crank at the start', () => {
    const levels = createInitialState(0).techLevels;
    expect(visibleComponentIds(levels)).toEqual(new Set<MachineComponentId>(['supportFrame', 'handCrank']));
  });

  it('adds the small gear once gear ratio is installed', () => {
    const levels = { ...createInitialState(0).techLevels, gearRatio: 1 };
    const visible = visibleComponentIds(levels);
    expect(visible.has('gearSmall')).toBe(true);
    expect(visible.size).toBe(3);
  });

  it('returns a fresh set each call', () => {
    const levels = createInitialState(0).techLevels;
    const first = visibleComponentIds(levels);
    first.add('pistonArray');
    expect(visibleComponentIds(levels).has('pistonArray')).toBe(false);
  });
});

describe('newlyVisible', () => {
  it('returns only the added ids in canonical order', () => {
    const prev = new Set<MachineComponentId>(['supportFrame', 'handCrank']);
    const next = new Set<MachineComponentId>(['pistonArray', 'flywheel', 'supportFrame', 'handCrank']);
    expect(newlyVisible(prev, next)).toEqual(['flywheel', 'pistonArray']);
  });

  it('returns an empty list for equal sets', () => {
    const same = new Set<MachineComponentId>(['supportFrame', 'handCrank']);
    expect(newlyVisible(same, new Set(same))).toEqual([]);
  });

  it('ignores ids that disappear', () => {
    const prev = new Set<MachineComponentId>(['supportFrame', 'handCrank', 'gearSmall']);
    const next = new Set<MachineComponentId>(['supportFrame', 'handCrank']);
    expect(newlyVisible(prev, next)).toEqual([]);
  });
});
