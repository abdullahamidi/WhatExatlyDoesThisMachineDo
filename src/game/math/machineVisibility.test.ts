import { describe, it, expect } from 'vitest';
import type { MachineComponentId } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import { createInitialState } from '../../simulation';
import { visibleComponentIds, newlyVisible } from './machineVisibility';

/** Start-of-game tech levels with optional overrides. */
function levelsWith(overrides: Partial<Record<TechId, number>> = {}): Record<TechId, number> {
  return { ...createInitialState(0).techLevels, ...overrides };
}

describe('visibleComponentIds', () => {
  it('shows the frame, one bearing, the hand crank and the name plate at the start', () => {
    const levels = createInitialState(0).techLevels;
    expect(visibleComponentIds(levels)).toEqual(new Set<MachineComponentId>(['supportFrame', 'bearingP', 'handCrank', 'namePlate']));
  });

  it('adds the bearing, main shaft, large gear and small gear once gear ratio is installed', () => {
    const levels = { ...createInitialState(0).techLevels, gearRatio: 1 };
    const visible = visibleComponentIds(levels);
    for (const id of ['bearingM', 'mainShaft', 'gearLarge', 'gearSmall'] as const) {
      expect(visible.has(id)).toBe(true);
    }
    expect(visible.size).toBe(8);   // start set (4 incl. name plate) + bearingM, mainShaft, gearLarge, gearSmall
  });

  it('returns a fresh set each call', () => {
    const levels = createInitialState(0).techLevels;
    const first = visibleComponentIds(levels);
    first.add('pistonArray');
    expect(visibleComponentIds(levels).has('pistonArray')).toBe(false);
  });
});

describe('visibility per stage', () => {
  it('stage 0 shows exactly the frame, bearing P, hand crank and name plate', () => {
    const visible = visibleComponentIds(levelsWith());
    expect(visible.size).toBe(4);
    expect([...visible].sort()).toEqual(['bearingP', 'handCrank', 'namePlate', 'supportFrame']);
  });

  it('gear ratio adds the gear train and main shaft, but not the crank brace', () => {
    const visible = visibleComponentIds(levelsWith({ gearRatio: 1 }));
    const start = visibleComponentIds(levelsWith());
    for (const id of ['bearingM', 'mainShaft', 'gearLarge', 'gearSmall'] as const) {
      expect(visible.has(id)).toBe(true);
      expect(start.has(id)).toBe(false);
    }
    expect(visible.has('crankBrace')).toBe(false);
  });

  it('worn motor alone shows the main shaft and motor parts, not the gears', () => {
    const visible = visibleComponentIds(levelsWith({ wornMotor: 1 }));
    for (const id of ['mainShaft', 'bearingM', 'motorPlinth', 'wornMotor', 'motorPulley'] as const) {
      expect(visible.has(id)).toBe(true);
    }
    expect(visible.has('gearLarge')).toBe(false);
    expect(visible.has('gearSmall')).toBe(false);
  });

  it('reinforced crank with gear ratio 3 shows the crank brace', () => {
    const visible = visibleComponentIds(levelsWith({ reinforcedCrank: 1, gearRatio: 3 }));
    expect(visible.has('crankBrace')).toBe(true);
  });

  it('reinforced crank alone shows the crank brace', () => {
    const visible = visibleComponentIds(levelsWith({ reinforcedCrank: 1 }));
    expect(visible.has('crankBrace')).toBe(true);
  });

  it('keeps gear pair, shaft and motor coherence over every gear / motor / crank combination', () => {
    for (const gearRatio of [0, 1]) {
      for (const wornMotor of [0, 1]) {
        for (const reinforcedCrank of [0, 1]) {
          const visible = visibleComponentIds(levelsWith({ gearRatio, wornMotor, reinforcedCrank }));
          const label = `gearRatio=${gearRatio} wornMotor=${wornMotor} reinforcedCrank=${reinforcedCrank}`;
          expect(visible.has('gearLarge'), label).toBe(visible.has('gearSmall'));
          expect(visible.has('mainShaft'), label).toBe(visible.has('bearingM'));
          if (visible.has('gearLarge') || wornMotor === 1) {
            expect(visible.has('mainShaft'), label).toBe(true);
          }
        }
      }
    }
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
