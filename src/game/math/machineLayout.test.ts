import { describe, it, expect } from 'vitest';
import { MACHINE_COMPONENTS, MACHINE_SOCKETS } from '../../data/machineComponents';
import type { MachineComponentDefinition, SocketId, Vec2 } from '../../data/machineComponents';
import { MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { createInitialState } from '../../simulation';
import {
  resolveAttachment,
  machineLocalToWorld,
  isComponentVisible,
  componentDepth,
  componentBounds,
} from './machineLayout';

describe('resolveAttachment', () => {
  it('uses the machine origin when the socket is null', () => {
    expect(resolveAttachment(MACHINE_COMPONENTS.supportFrame)).toEqual({ x: 0, y: 0 });
  });

  it('uses the socket position for the hand crank', () => {
    const hub = MACHINE_SOCKETS.crankHub;
    const off = MACHINE_COMPONENTS.handCrank.attach.offset;
    expect(resolveAttachment(MACHINE_COMPONENTS.handCrank)).toEqual({ x: hub.x + off.x, y: hub.y + off.y });
  });

  it('adds the attach offset to the socket position', () => {
    const def = { ...MACHINE_COMPONENTS.handCrank, attach: { socket: 'crankHub' as const, offset: { x: 3, y: -4 } } };
    const hub = MACHINE_SOCKETS.crankHub;
    expect(resolveAttachment(def)).toEqual({ x: hub.x + 3, y: hub.y - 4 });
  });

  it('honours a custom sockets table', () => {
    const sockets: Record<SocketId, Vec2> = {
      ...MACHINE_SOCKETS,
      crankHub: { x: 11, y: 22 },
    };
    expect(resolveAttachment(MACHINE_COMPONENTS.handCrank, sockets)).toEqual({ x: 11, y: 22 });
  });
});

describe('machineLocalToWorld', () => {
  it('maps the machine origin onto the ground anchor', () => {
    expect(machineLocalToWorld({ x: 0, y: 0 })).toEqual({ x: 1280, y: 1120 });
  });

  it('maps the crank hub local point to world px', () => {
    expect(machineLocalToWorld({ x: -70, y: -62 })).toEqual({ x: 1140, y: 996 });
  });

  it('honours a custom anchor and scale', () => {
    expect(machineLocalToWorld({ x: 10, y: 20 }, { x: 100, y: 200 }, 3)).toEqual({ x: 130, y: 260 });
  });

  it('uses the defaults MACHINE_ANCHOR and PIXEL_SCALE', () => {
    expect(machineLocalToWorld({ x: 5, y: -5 })).toEqual({
      x: MACHINE_ANCHOR.x + 5 * PIXEL_SCALE,
      y: MACHINE_ANCHOR.y - 5 * PIXEL_SCALE,
    });
  });
});

describe('isComponentVisible', () => {
  const levels = createInitialState(0).techLevels;

  it('shows the frame, one bearing and the hand crank at the start', () => {
    for (const id of ['supportFrame', 'bearingP', 'handCrank'] as const) {
      expect(isComponentVisible(MACHINE_COMPONENTS[id], levels)).toBe(true);
    }
    for (const id of ['bearingM', 'mainShaft', 'gearLarge', 'gearSmall', 'crankBrace', 'crankPulley', 'flywheelPedestal', 'flywheel', 'flywheelPulley', 'motorPlinth', 'wornMotor', 'motorPulley', 'pistonYoke', 'pistonArray'] as const) {
      expect(isComponentVisible(MACHINE_COMPONENTS[id], levels)).toBe(false);
    }
  });

  it('shows the small gear once gearRatio is owned', () => {
    expect(isComponentVisible(MACHINE_COMPONENTS.gearSmall, { ...levels, gearRatio: 1 })).toBe(true);
  });

  it('shows the large gear and main shaft with gearRatio, not reinforcedCrank', () => {
    const gearOnly = { ...levels, gearRatio: 1 };
    expect(isComponentVisible(MACHINE_COMPONENTS.gearLarge, gearOnly)).toBe(true);
    expect(isComponentVisible(MACHINE_COMPONENTS.mainShaft, gearOnly)).toBe(true);
    expect(isComponentVisible(MACHINE_COMPONENTS.gearLarge, { ...levels, reinforcedCrank: 1 })).toBe(false);
  });

  it('shows the main shaft once the worn motor drives it, even without gearRatio', () => {
    expect(isComponentVisible(MACHINE_COMPONENTS.mainShaft, { ...levels, wornMotor: 1 })).toBe(true);
    expect(isComponentVisible(MACHINE_COMPONENTS.bearingM, { ...levels, wornMotor: 1 })).toBe(true);
  });

  it('shows the crank brace once reinforcedCrank is owned', () => {
    expect(isComponentVisible(MACHINE_COMPONENTS.crankBrace, levels)).toBe(false);
    expect(isComponentVisible(MACHINE_COMPONENTS.crankBrace, { ...levels, reinforcedCrank: 1 })).toBe(true);
  });

  it('shows the worn motor once wornMotor is owned', () => {
    expect(isComponentVisible(MACHINE_COMPONENTS.wornMotor, { ...levels, wornMotor: 1 })).toBe(true);
  });
});

describe('componentDepth', () => {
  it('derives depth from the layer plus the sub-layer bias', () => {
    expect(componentDepth(MACHINE_COMPONENTS.supportFrame)).toBe(10);
    expect(componentDepth(MACHINE_COMPONENTS.bearingM)).toBe(11);
    expect(componentDepth(MACHINE_COMPONENTS.handCrank)).toBe(30);
    expect(componentDepth(MACHINE_COMPONENTS.mainShaft)).toBe(22);
    expect(componentDepth(MACHINE_COMPONENTS.flywheelPulley)).toBe(23);
    expect(componentDepth(MACHINE_COMPONENTS.pistonYoke)).toBe(0);
    expect(componentDepth(MACHINE_COMPONENTS.pistonArray)).toBe(1);
  });

  it('adds depthBias on top of the layer depth', () => {
    const def: MachineComponentDefinition = { ...MACHINE_COMPONENTS.handCrank, layer: 'mid', depthBias: 4 };
    expect(componentDepth(def)).toBe(24);
  });

  it('treats a missing depthBias as 0', () => {
    const def: MachineComponentDefinition = { ...MACHINE_COMPONENTS.handCrank, layer: 'mid', depthBias: undefined };
    expect(componentDepth(def)).toBe(20);
  });
});

describe('componentBounds', () => {
  it('covers the whole frame sprite', () => {
    expect(componentBounds(MACHINE_COMPONENTS.supportFrame)).toEqual({ left: -100, right: 100, top: -110, bottom: 0 });
  });

  it('uses the given sockets table', () => {
    const sockets: Record<SocketId, Vec2> = { ...MACHINE_SOCKETS, crankHub: { x: 0, y: 0 } };
    expect(componentBounds(MACHINE_COMPONENTS.handCrank, sockets)).toEqual({ left: -24, right: 24, top: -24, bottom: 24 });
  });
});
