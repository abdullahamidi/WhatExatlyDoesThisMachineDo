import { describe, it, expect } from 'vitest';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { MachineComponentDefinition, MachineComponentId } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import { TECH_IDS } from '../../data/types';
import { createInitialState } from '../../simulation';
import { componentBounds } from './machineLayout';
import { visibleMachineBounds, boundsToWorld } from './machineBounds';
import { MACHINE_ANCHOR } from '../../data/world';

describe('visibleMachineBounds', () => {
  const initial = createInitialState(0).techLevels;

  /** Every tech level at 0, so no component is visible. */
  const hidden: Record<TechId, number> = { ...initial };
  for (const id of TECH_IDS) hidden[id] = 0;

  it('unions the frame, bearingP and hand crank boxes at the start', () => {
    expect(visibleMachineBounds(initial)).toEqual({ left: -100, right: 100, top: -110, bottom: 0 });
  });

  it('extends left to the worn motor once wornMotor is owned', () => {
    const out = visibleMachineBounds({ ...initial, wornMotor: 1 });
    expect(out.left).toBe(-172);
    expect(out.right).toBe(100);
    expect(out.top).toBe(-110);
    expect(out.bottom).toBe(0);
  });

  it('returns the zero box for an all-hidden table', () => {
    expect(visibleMachineBounds(hidden)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('returns the zero box for an empty component table', () => {
    const none = {} as Record<MachineComponentId, MachineComponentDefinition>;
    expect(visibleMachineBounds(initial, none)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('returns the own box for a single visible component', () => {
    const only: Record<MachineComponentId, MachineComponentDefinition> = {
      ...MACHINE_COMPONENTS,
      supportFrame: { ...MACHINE_COMPONENTS.supportFrame, minLevel: 99 },
      bearingP: { ...MACHINE_COMPONENTS.bearingP, minLevel: 99 },
    };
    expect(visibleMachineBounds(initial, only)).toEqual(componentBounds(MACHINE_COMPONENTS.handCrank));
    expect(visibleMachineBounds(initial, only)).toEqual({ left: -24, right: 24, top: -80, bottom: -32 });
  });

  it('grows to a synthetic wide component', () => {
    const wide: Record<MachineComponentId, MachineComponentDefinition> = {
      ...MACHINE_COMPONENTS,
      wornMotor: { ...MACHINE_COMPONENTS.wornMotor, attach: { ...MACHINE_COMPONENTS.wornMotor.attach, offset: { x: 400, y: 0 } } },
    };
    const out = visibleMachineBounds({ ...initial, wornMotor: 1 }, wide);
    expect(out.right).toBe(componentBounds(wide.wornMotor).right);
    expect(out.right).toBeGreaterThan(100);
  });
});

describe('boundsToWorld', () => {
  it('maps art px to anchor + 2 * b', () => {
    const b = { left: -10, top: -20, right: 30, bottom: 5 };
    expect(boundsToWorld(b, { x: 1280, y: 1120 }, 2)).toEqual({ left: 1260, top: 1080, right: 1340, bottom: 1130 });
  });

  it('defaults to the machine anchor and pixel scale', () => {
    const b = { left: 0, top: 0, right: 0, bottom: 0 };
    const { x, y } = MACHINE_ANCHOR;
    expect(boundsToWorld(b)).toEqual({ left: x, top: y, right: x, bottom: y });
  });
});
