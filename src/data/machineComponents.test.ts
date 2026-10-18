import { describe, it, expect } from 'vitest';
import { TECH_IDS } from './types';
import {
  MACHINE_COMPONENT_IDS,
  MACHINE_COMPONENTS,
  MACHINE_SOCKETS,
  MACHINE_BOUNDS,
  MACHINE_LAYER_DEPTH,
  MACHINE_LINKS,
  MACHINE_MOTION,
  MACHINE_ASSEMBLY,
  MACHINE_LINK_STYLE,
  SOCKET_IDS,
} from './machineComponents';
import type { AnimationDriver, ConnectionPoint, MachineComponentDefinition, MachineComponentId, Vec2 } from './machineComponents';

const COMPONENTS = MACHINE_COMPONENT_IDS.map((id) => MACHINE_COMPONENTS[id]);

/** Looks up a connection point by component and point id; undefined when missing. */
function pointOf(component: MachineComponentId, pointId: string): ConnectionPoint | undefined {
  return MACHINE_COMPONENTS[component].connections.find((c) => c.id === pointId);
}

/** Socket position (plus attach offset) of a component in machine-local art px. */
function centreOf(def: MachineComponentDefinition): Vec2 {
  const base = def.attach.socket === null ? { x: 0, y: 0 } : MACHINE_SOCKETS[def.attach.socket];
  return { x: base.x + def.attach.offset.x, y: base.y + def.attach.offset.y };
}

/** Animation driver of a component, or null when it has none. */
function driverOf(id: MachineComponentId): AnimationDriver | null {
  const anim = MACHINE_COMPONENTS[id].animation;
  return 'driver' in anim ? anim.driver : null;
}

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

  it('layer depth table matches the spec', () => {
    expect(MACHINE_LAYER_DEPTH).toEqual({ back: 0, frame: 10, mid: 20, front: 30 });
  });
});

describe('machine links and connection points', () => {
  it('every link endpoint references an existing component and connection point', () => {
    for (const link of MACHINE_LINKS) {
      for (const end of [link.from, link.to]) {
        expect(MACHINE_COMPONENT_IDS).toContain(end.component);
        expect(pointOf(end.component, end.point)).toBeDefined();
      }
    }
  });

  it('link kind equals the kind of both endpoint points', () => {
    for (const link of MACHINE_LINKS) {
      expect(pointOf(link.from.component, link.from.point)?.kind).toBe(link.kind);
      expect(pointOf(link.to.component, link.to.point)?.kind).toBe(link.kind);
    }
  });

  it('belt endpoints have a positive radius', () => {
    for (const link of MACHINE_LINKS) {
      if (link.kind !== 'belt') continue;
      expect(pointOf(link.from.component, link.from.point)?.radius ?? 0).toBeGreaterThan(0);
      expect(pointOf(link.to.component, link.to.point)?.radius ?? 0).toBeGreaterThan(0);
    }
  });

  it('connection points of rotating components sit at the centre', () => {
    for (const def of COMPONENTS) {
      if (def.animation.kind !== 'rotate' && def.animation.kind !== 'clickRotate') continue;
      for (const c of def.connections) {
        expect(c.at).toEqual({ x: 0, y: 0 });
      }
    }
  });

  it('every component except supportFrame appears in at least one link', () => {
    const linked = new Set<MachineComponentId>();
    for (const link of MACHINE_LINKS) {
      linked.add(link.from.component);
      linked.add(link.to.component);
    }
    for (const id of MACHINE_COMPONENT_IDS) {
      if (id === 'supportFrame') continue;
      expect(linked.has(id)).toBe(true);
    }
  });

  it('gearSmall and gearLarge mesh: centre distance is between half the max width and the sum of half widths', () => {
    const small = MACHINE_COMPONENTS.gearSmall;
    const large = MACHINE_COMPONENTS.gearLarge;
    const a = centreOf(small);
    const b = centreOf(large);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const w1 = small.size.width;
    const w2 = large.size.width;
    expect(d).toBeLessThan((w1 + w2) / 2);
    expect(d).toBeGreaterThan(Math.max(w1, w2) / 2);
  });

  it('gear, flywheel and motor drivers are combined or automation as designed', () => {
    expect(driverOf('gearSmall')).toBe('combined');
    expect(driverOf('gearLarge')).toBe('combined');
    expect(driverOf('flywheel')).toBe('combined');
    expect(driverOf('wornMotor')).toBe('automation');
    expect(driverOf('pistonArray')).toBe('automation');
  });

  it('pistonArray reciprocation amplitude is at most 3 art px', () => {
    const anim = MACHINE_COMPONENTS.pistonArray.animation;
    if (anim.kind !== 'reciprocate') throw new Error('pistonArray must reciprocate');
    expect(anim.amplitude).toBeLessThanOrEqual(3);
  });
});

describe('machine motion, assembly and link style constants', () => {
  it('motion, assembly and link style tables exist', () => {
    expect(MACHINE_MOTION).toBeDefined();
    expect(MACHINE_ASSEMBLY).toBeDefined();
    expect(MACHINE_LINK_STYLE).toBeDefined();
  });

  it('puffCount is a positive integer', () => {
    expect(Number.isInteger(MACHINE_ASSEMBLY.puffCount)).toBe(true);
    expect(MACHINE_ASSEMBLY.puffCount).toBeGreaterThan(0);
  });
});
