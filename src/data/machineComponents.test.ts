import { describe, it, expect } from 'vitest';
import { TECH_IDS } from './types';
import {
  MACHINE_COMPONENT_IDS,
  MACHINE_COMPONENTS,
  MACHINE_SOCKETS,
  MACHINE_BOUNDS,
  MACHINE_LAYER_DEPTH,
  MACHINE_LINKS,
  SOCKET_IDS,
} from './machineComponents';
import type { MachineComponentDefinition } from './machineComponents';

const COMPONENTS = MACHINE_COMPONENT_IDS.map((id) => MACHINE_COMPONENTS[id]);

/** Same formula as componentBounds in src/game/math/machineLayout.ts, inlined so src/data does not depend on src/game. */
function boundsOf(def: MachineComponentDefinition): { left: number; right: number; top: number; bottom: number } {
  const base = def.attach.socket === null ? { x: 0, y: 0 } : MACHINE_SOCKETS[def.attach.socket];
  const px = base.x + def.attach.offset.x;
  const py = base.y + def.attach.offset.y;
  const left = px - def.origin.x * def.size.width;
  const top = py - def.origin.y * def.size.height;
  return { left, right: left + def.size.width, top, bottom: top + def.size.height };
}

describe('machine component ids', () => {
  it('are unique and match the component table keys', () => {
    expect(new Set(MACHINE_COMPONENT_IDS).size).toBe(MACHINE_COMPONENT_IDS.length);
    expect(new Set(Object.keys(MACHINE_COMPONENTS))).toEqual(new Set(MACHINE_COMPONENT_IDS));
  });

  it('each definition id matches its key', () => {
    for (const id of MACHINE_COMPONENT_IDS) {
      expect(MACHINE_COMPONENTS[id].id).toBe(id);
    }
  });
});

describe('machine component invariants', () => {
  it('connection point ids are unique within each component', () => {
    for (const def of COMPONENTS) {
      const ids = def.connections.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every techId is a known tech', () => {
    for (const def of COMPONENTS) {
      expect(TECH_IDS).toContain(def.techId);
    }
  });

  it('every non-null attach socket is a known socket', () => {
    for (const def of COMPONENTS) {
      if (def.attach.socket !== null) {
        expect(Object.keys(MACHINE_SOCKETS)).toContain(def.attach.socket);
      }
    }
  });

  it('SOCKET_IDS matches the socket table keys', () => {
    expect(new Set(SOCKET_IDS)).toEqual(new Set(Object.keys(MACHINE_SOCKETS)));
  });

  it('every component bounding box lies inside MACHINE_BOUNDS', () => {
    for (const def of COMPONENTS) {
      const b = boundsOf(def);
      expect(b.left).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
      expect(b.right).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
      expect(b.top).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
      expect(b.bottom).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
    }
  });

  it('minLevel is at least 1', () => {
    for (const def of COMPONENTS) {
      expect(def.minLevel).toBeGreaterThanOrEqual(1);
    }
  });

  it('origins are normalised to [0, 1]', () => {
    for (const def of COMPONENTS) {
      for (const v of [def.origin.x, def.origin.y]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sizes are positive', () => {
    for (const def of COMPONENTS) {
      expect(def.size.width).toBeGreaterThan(0);
      expect(def.size.height).toBeGreaterThan(0);
    }
  });

  it('every speed curve has min <= max and base > 0', () => {
    for (const def of COMPONENTS) {
      const anim = def.animation;
      if ('speed' in anim) {
        expect(anim.speed.min).toBeLessThanOrEqual(anim.speed.max);
        expect(anim.speed.base).toBeGreaterThan(0);
      }
    }
  });
});

describe('machine component data', () => {
  it('supportFrame and handCrank both belong to the handCrank tech', () => {
    expect(MACHINE_COMPONENTS.supportFrame.techId).toBe('handCrank');
    expect(MACHINE_COMPONENTS.handCrank.techId).toBe('handCrank');
  });

  it('handCrank uses click rotation', () => {
    expect(MACHINE_COMPONENTS.handCrank.animation).toEqual({ kind: 'clickRotate', degreesPerClick: 90, tweenMs: 160 });
  });

  it('has no machine links in WP2', () => {
    expect(MACHINE_LINKS).toEqual([]);
  });

  it('layer depth table matches the spec', () => {
    expect(MACHINE_LAYER_DEPTH).toEqual({ back: 0, frame: 10, mid: 20, front: 30 });
  });
});
