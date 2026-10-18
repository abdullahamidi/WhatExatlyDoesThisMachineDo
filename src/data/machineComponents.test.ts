import { describe, it, expect } from 'vitest';
import { TECH_IDS } from './types';
import type { TechId } from './types';
import { TECHNOLOGIES } from './technologies';
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
  MACHINE_SHADOWS,
  MACHINE_SHADOW_STYLE,
  MACHINE_RENDER,
  DRIVE_TRAIN,
  SOCKET_IDS,
} from './machineComponents';
import type { ConnectionPoint, MachineComponentDefinition, MachineComponentId, MachineLink, Vec2 } from './machineComponents';

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

/** Driven ratio of a component, or null when it is not driven by the master angle. */
function drivenRatio(id: MachineComponentId): number | null {
  const anim = MACHINE_COMPONENTS[id].animation;
  return anim.kind === 'driven' ? anim.ratio : null;
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

/** True when point p lies inside the box (edges included). */
function contains(box: { left: number; right: number; top: number; bottom: number }, p: Vec2): boolean {
  return p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom;
}

/** Bearings and the flywheel pedestal are the only supports of driven parts. */
const SUPPORTS: readonly MachineComponentId[] = ['bearingM', 'bearingP', 'flywheelPedestal'];

/** True when tech a requires tech b, directly or transitively. */
function dependsOn(a: TechId, b: TechId, seen: Set<TechId> = new Set<TechId>()): boolean {
  for (const req of TECHNOLOGIES[a].requires) {
    if (req.type !== 'tech') continue;
    if (req.id === b) return true;
    if (!seen.has(req.id)) {
      seen.add(req.id);
      if (dependsOn(req.id, b, seen)) return true;
    }
  }
  return false;
}

/** Unlock order of the stage prefixes, as in the WP6 plan. */
const UNLOCK_ORDER: readonly TechId[] = ['handCrank', 'gearRatio', 'wornMotor', 'motorTuning', 'reinforcedCrank', 'flywheel', 'pistonArray'];

/** Tech levels after the first n unlocks: gearRatio counts as 3, motorTuning as 5, the rest as 1. */
function levelsForPrefix(n: number): Record<TechId, number> {
  const levels = {} as Record<TechId, number>;
  for (const id of TECH_IDS) levels[id] = 0;
  for (const id of UNLOCK_ORDER.slice(0, n)) levels[id] = id === 'gearRatio' ? 3 : id === 'motorTuning' ? 5 : 1;
  return levels;
}

/** Ids of components whose tech level reaches their minLevel. */
function visibleAt(levels: Record<TechId, number>): Set<MachineComponentId> {
  return new Set(MACHINE_COMPONENT_IDS.filter((id) => {
    const def = MACHINE_COMPONENTS[id];
    return levels[def.techId] >= def.minLevel;
  }));
}

/** True when the driven part's static attachment point sits on a visible support. */
function hasVisibleSupport(def: MachineComponentDefinition, visible: ReadonlySet<MachineComponentId>): boolean {
  const p = centreOf(def);
  return SUPPORTS.some((s) => visible.has(s) && contains(boundsOf(MACHINE_COMPONENTS[s]), p));
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

  it('canonical order is the contract list', () => {
    expect(MACHINE_COMPONENT_IDS).toEqual([
      'supportFrame', 'bearingM', 'bearingP', 'gearLarge', 'mainShaft', 'gearSmall', 'crankPulley', 'handCrank',
      'flywheelPedestal', 'flywheel', 'flywheelPulley', 'motorPlinth', 'wornMotor', 'motorPulley', 'pistonYoke', 'pistonArray',
    ]);
  });

  it('has 16 components and 9 sockets', () => {
    expect(MACHINE_COMPONENT_IDS.length).toBe(16);
    expect(SOCKET_IDS.length).toBe(9);
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

  it('every socket is used by at least one component', () => {
    const used = new Set(COMPONENTS.map((def) => def.attach.socket));
    for (const id of SOCKET_IDS) {
      expect(used.has(id)).toBe(true);
    }
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

  it('depth bias is an integer and defaults to 0', () => {
    for (const def of COMPONENTS) {
      const bias = def.depthBias ?? 0;
      expect(Number.isInteger(bias)).toBe(true);
    }
  });
});

describe('machine component data', () => {
  it('supportFrame and handCrank both belong to the handCrank tech', () => {
    expect(MACHINE_COMPONENTS.supportFrame.techId).toBe('handCrank');
    expect(MACHINE_COMPONENTS.handCrank.techId).toBe('handCrank');
  });

  it('handCrank is driven by the master at the crank ratio', () => {
    expect(MACHINE_COMPONENTS.handCrank.animation).toEqual({ kind: 'driven', ratio: -1.75, phaseDeg: 0 });
  });

  it('pistonYoke is slider-driven and the static block has no animation', () => {
    expect(MACHINE_COMPONENTS.pistonYoke.animation).toEqual({ kind: 'slider' });
    expect(MACHINE_COMPONENTS.pistonArray.animation).toEqual({ kind: 'none' });
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

  it('belt links connect two belt points and rod links connect two pin points', () => {
    for (const link of MACHINE_LINKS) {
      const expected = link.kind === 'belt' ? 'belt' : 'pin';
      expect(pointOf(link.from.component, link.from.point)?.kind).toBe(expected);
      expect(pointOf(link.to.component, link.to.point)?.kind).toBe(expected);
    }
  });

  it('belt endpoints have a positive radius', () => {
    for (const link of MACHINE_LINKS) {
      if (link.kind !== 'belt') continue;
      expect(pointOf(link.from.component, link.from.point)?.radius ?? 0).toBeGreaterThan(0);
      expect(pointOf(link.to.component, link.to.point)?.radius ?? 0).toBeGreaterThan(0);
    }
  });

  it('connection points of driven components sit at the centre', () => {
    for (const def of COMPONENTS) {
      if (def.animation.kind !== 'driven') continue;
      for (const c of def.connections) {
        expect(c.at).toEqual({ x: 0, y: 0 });
      }
    }
  });

  it('every connection point appears in at least one link', () => {
    const linked = new Set<string>();
    for (const link of MACHINE_LINKS) {
      linked.add(`${link.from.component}.${link.from.point}`);
      linked.add(`${link.to.component}.${link.to.point}`);
    }
    for (const def of COMPONENTS) {
      for (const c of def.connections) {
        expect(linked.has(`${def.id}.${c.id}`)).toBe(true);
      }
    }
  });

  it('belt links keep |ratio| * radius equal on both pulleys', () => {
    for (const link of MACHINE_LINKS) {
      if (link.kind !== 'belt') continue;
      const a = drivenRatio(link.from.component) ?? NaN;
      const b = drivenRatio(link.to.component) ?? NaN;
      const ra = pointOf(link.from.component, link.from.point)?.radius ?? NaN;
      const rb = pointOf(link.to.component, link.to.point)?.radius ?? NaN;
      expect(Math.abs(a) * ra).toBeCloseTo(Math.abs(b) * rb, 9);
    }
  });
});

describe('gear mesh data', () => {
  it('gear sockets are one socket distance apart equal to the sum of pitch radii', () => {
    const gaps = MACHINE_SOCKETS.crankHub.x - MACHINE_SOCKETS.mainHub.x;
    expect(gaps).toBe(44);
    expect(gaps).toBe(DRIVE_TRAIN.gears.large.pitchRadius + DRIVE_TRAIN.gears.small.pitchRadius);
  });

  it('pinion ratio is minus large teeth over small teeth', () => {
    const { large, small } = DRIVE_TRAIN.gears;
    expect(drivenRatio('gearSmall')).toBe(-large.teeth / small.teeth);
  });

  it('large gear is ratio 1 with no phase, pinion phase is half a tooth', () => {
    const { small } = DRIVE_TRAIN.gears;
    expect(MACHINE_COMPONENTS.gearLarge.animation).toEqual({ kind: 'driven', ratio: 1, phaseDeg: 0 });
    expect(MACHINE_COMPONENTS.gearSmall.animation).toEqual({ kind: 'driven', ratio: -1.75, phaseDeg: 180 / small.teeth });
  });

  it('gears sit on the hubs they mesh at', () => {
    expect(centreOf(MACHINE_COMPONENTS.gearLarge)).toEqual(MACHINE_SOCKETS.mainHub);
    expect(centreOf(MACHINE_COMPONENTS.gearSmall)).toEqual(MACHINE_SOCKETS.crankHub);
  });
});

describe('rod data', () => {
  it('pin radius equals the pin point radius of the rod crank', () => {
    const pin = pointOf(DRIVE_TRAIN.rod.crank, 'pin');
    expect(pin?.radius).toBe(DRIVE_TRAIN.rod.pinRadius);
  });

  it('the rod link joins the crank pin to the yoke eye', () => {
    const rods = MACHINE_LINKS.filter((l) => l.kind === 'rod');
    const expected: MachineLink = { from: { component: DRIVE_TRAIN.rod.crank, point: 'pin' }, to: { component: 'pistonYoke', point: 'eye' }, kind: 'rod' };
    expect(rods).toEqual([expected]);
  });

  it('slider x matches the main hub and the yoke pin', () => {
    expect(DRIVE_TRAIN.rod.sliderX).toBe(MACHINE_SOCKETS.mainHub.x);
    expect(DRIVE_TRAIN.rod.sliderX).toBe(MACHINE_SOCKETS.yokePin.x);
  });

  it('rod length is at least three pin radii', () => {
    expect(DRIVE_TRAIN.rod.length).toBeGreaterThanOrEqual(3 * DRIVE_TRAIN.rod.pinRadius);
  });

  it('yoke pin height lies in the stroke band', () => {
    expect(MACHINE_SOCKETS.yokePin.y).toBeGreaterThanOrEqual(-130);
    expect(MACHINE_SOCKETS.yokePin.y).toBeLessThanOrEqual(-120);
  });
});

describe('support and unlock coherence', () => {
  it('at the full stage every driven component sits on a support, except motorPulley', () => {
    const all = new Set<MachineComponentId>(MACHINE_COMPONENT_IDS);
    for (const def of COMPONENTS) {
      if (def.animation.kind !== 'driven' || def.id === 'motorPulley') continue;
      expect(hasVisibleSupport(def, all)).toBe(true);
    }
  });

  it('motorPulley is carried by the worn motor bounding box', () => {
    const p = centreOf(MACHINE_COMPONENTS.motorPulley);
    expect(contains(boundsOf(MACHINE_COMPONENTS.wornMotor), p)).toBe(true);
  });

  it('every link joins techs that are equal or ordered by requirement', () => {
    for (const link of MACHINE_LINKS) {
      const a = MACHINE_COMPONENTS[link.from.component].techId;
      const b = MACHINE_COMPONENTS[link.to.component].techId;
      expect(a === b || dependsOn(a, b) || dependsOn(b, a)).toBe(true);
    }
  });

  it('every stage prefix keeps the drive train coherent', () => {
    for (let n = 1; n <= UNLOCK_ORDER.length; n++) {
      const levels = levelsForPrefix(n);
      const visible = visibleAt(levels);
      if (visible.has('pistonYoke')) expect(visible.has('mainShaft')).toBe(true);
      for (const def of COMPONENTS) {
        if (!visible.has(def.id) || def.animation.kind !== 'driven' || def.id === 'motorPulley') continue;
        expect(hasVisibleSupport(def, visible)).toBe(true);
      }
    }
    const first = visibleAt(levelsForPrefix(1));
    expect(first.has('mainShaft')).toBe(true);
    expect(first.has('bearingM')).toBe(true);
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

  it('link style depths sit on the layer table', () => {
    expect(MACHINE_LINK_STYLE.beltDepth).toBe(25);
    expect(MACHINE_LINK_STYLE.rodDepth).toBe(31);
    expect(MACHINE_LINK_STYLE.capDepth).toBe(32);
  });

  it('cap is a 4 px square', () => {
    expect(MACHINE_LINK_STYLE.cap.size).toBe(4);
  });

  it('shadows reference existing components', () => {
    expect(MACHINE_SHADOWS.length).toBe(4);
    for (const s of MACHINE_SHADOWS) {
      expect(MACHINE_COMPONENT_IDS).toContain(s.component);
    }
  });

  it('shadows sit behind the machine', () => {
    expect(MACHINE_SHADOW_STYLE.depth).toBeLessThan(0);
  });

  it('render mode is the render texture', () => {
    expect(MACHINE_RENDER.mode).toBe('renderTexture');
  });
});
