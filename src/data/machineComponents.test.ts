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

/** Driven parts carried by another box instead of a support: the motor pulley and the generator pulley (on the generator hub). */
const SUPPORT_EXEMPT: ReadonlySet<MachineComponentId> = new Set<MachineComponentId>(['motorPulley', 'generatorPulley']);

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

/** Ids of components whose tech level reaches their minLevel, or any alsoVisibleWith minLevel (same rule as isComponentVisible). */
function visibleAt(levels: Record<TechId, number>): Set<MachineComponentId> {
  return new Set(MACHINE_COMPONENT_IDS.filter((id) => {
    const def = MACHINE_COMPONENTS[id];
    return levels[def.techId] >= def.minLevel || (def.alsoVisibleWith ?? []).some((a) => levels[a.techId] >= a.minLevel);
  }));
}

/** Techs that can make a component visible: its own techId plus every alsoVisibleWith techId. */
function techsOf(def: MachineComponentDefinition): TechId[] {
  return [def.techId, ...(def.alsoVisibleWith ?? []).map((a) => a.techId)];
}

/** True when the driven part's static attachment point sits on a visible support. */
function hasVisibleSupport(def: MachineComponentDefinition, visible: ReadonlySet<MachineComponentId>): boolean {
  const p = centreOf(def);
  return SUPPORTS.some((s) => visible.has(s) && contains(boundsOf(MACHINE_COMPONENTS[s]), p));
}

/** Era II unlock steps in order; copperWinding is set to each coil stage level in turn (1, 10, 20). */
const ERA_TWO_STEPS: readonly (readonly [TechId, number])[] = [
  ['generator', 1], ['copperWinding', 1], ['copperWinding', 10], ['copperWinding', 20],
  ['motorRetrofit', 1], ['dynamoCrank', 1], ['capacitorBank', 1], ['sparkGap', 1], ['transformer', 1], ['powerLines', 1],
];

/** All era-I techs at their stage levels, then the first n era-II steps applied. */
function levelsEraTwo(n: number): Record<TechId, number> {
  const levels = levelsForPrefix(UNLOCK_ORDER.length);
  for (const [id, level] of ERA_TWO_STEPS.slice(0, n)) levels[id] = level;
  return levels;
}

/** Era-I component definitions exactly as they were before WP8 (git HEAD). flywheelPulley here has no belt2. */
const ERA_ONE_SNAPSHOT: Readonly<Record<string, MachineComponentDefinition>> = {
  // Support: frame art and the two bearing plates (audit role: static frame, bolted to steel).
  supportFrame: {
    id: 'supportFrame', techId: 'handCrank', minLevel: 1,
    assetId: 'machine.frame', attach: { socket: null, offset: { x: 0, y: 0 } },
    size: { width: 200, height: 110 }, origin: { x: 0.5, y: 1 },
    layer: 'frame', animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  bearingM: {
    id: 'bearingM', techId: 'gearRatio', minLevel: 1, alsoVisibleWith: [{ techId: 'wornMotor', minLevel: 1 }],
    assetId: 'machine.bearingPlate', attach: { socket: 'mainHub', offset: { x: 0, y: 0 } },
    size: { width: 16, height: 16 }, origin: { x: 0.5, y: 0.5 },
    layer: 'frame', depthBias: 1,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  bearingP: {
    id: 'bearingP', techId: 'handCrank', minLevel: 1,
    assetId: 'machine.bearingPlate', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
    size: { width: 16, height: 16 }, origin: { x: 0.5, y: 0.5 },
    layer: 'frame', depthBias: 1,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  // Main drive: large gear and main pulley / crank disc on the main hub (audit role: main shaft M, theta M).
  gearLarge: {
    id: 'gearLarge', techId: 'gearRatio', minLevel: 1,
    assetId: 'machine.gearLarge', attach: { socket: 'mainHub', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 64 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid',
    animation: { kind: 'driven', ratio: 1, phaseDeg: 0 },
    connections: [],
    effects: [],
  },
  mainShaft: {
    id: 'mainShaft', techId: 'gearRatio', minLevel: 1, alsoVisibleWith: [{ techId: 'wornMotor', minLevel: 1 }],
    assetId: 'machine.pulleyMain', attach: { socket: 'mainHub', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 24 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'driven', ratio: 1, phaseDeg: 0 },
    connections: [
      { id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 10 },
      { id: 'pin', at: { x: 0, y: 0 }, kind: 'pin', radius: 5 },
    ],
    effects: [],
  },
  // Crank train: pinion gear, crank pulley and hand crank on the crank hub (audit role: pinion P, crank pulley).
  gearSmall: {
    id: 'gearSmall', techId: 'gearRatio', minLevel: 1,
    assetId: 'machine.gearSmall', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
    size: { width: 40, height: 40 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 1,
    animation: { kind: 'driven', ratio: -1.75, phaseDeg: 22.5 },
    connections: [],
    effects: [],
  },
  crankPulley: {
    id: 'crankPulley', techId: 'flywheel', minLevel: 1,
    assetId: 'machine.pulleyCrank', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
    size: { width: 32, height: 32 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 },
    connections: [{ id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 8 }],   // r8 < pinion root r11: belt rides inside the teeth
    effects: [],
  },
  handCrank: {
    id: 'handCrank', techId: 'handCrank', minLevel: 1,
    assetId: 'machine.crank', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 48 }, origin: { x: 0.5, y: 0.5 },
    layer: 'front',
    animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 },
    connections: [],
    effects: [],
  },
  // Reinforced crank: strap and boss flange over the hand crank, same driven angle; axle cap (front+2) stays on top.
  crankBrace: {
    id: 'crankBrace', techId: 'reinforcedCrank', minLevel: 1,
    assetId: 'machine.crankBrace', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 48 }, origin: { x: 0.5, y: 0.5 },
    layer: 'front', depthBias: 1,
    animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 },
    connections: [],
    effects: [],
  },
  // Flywheel: pedestal (back), wheel and hub pulley on the flywheel hub (audit role: flywheel F).
  flywheelPedestal: {
    id: 'flywheelPedestal', techId: 'flywheel', minLevel: 1,
    assetId: 'machine.pedestal', attach: { socket: 'flywheelBase', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 64 }, origin: { x: 0.5, y: 1 },
    layer: 'back', depthBias: 21,   // near-side stand: in front of the flywheel (20), behind the overhung hub pulley (23) and belt (25)
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  flywheel: {
    id: 'flywheel', techId: 'flywheel', minLevel: 1,
    assetId: 'machine.flywheel', attach: { socket: 'flywheelHub', offset: { x: 0, y: 0 } },
    size: { width: 96, height: 96 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid',
    animation: { kind: 'driven', ratio: -1.1666666667, phaseDeg: 0 },
    connections: [],
    effects: [{ kind: 'glow', driver: 'automation', threshold: 10, intensity: 0.4 }],
  },
  flywheelPulley: {
    id: 'flywheelPulley', techId: 'flywheel', minLevel: 1,
    assetId: 'machine.pulleyFlywheel', attach: { socket: 'flywheelHub', offset: { x: 0, y: 0 } },
    size: { width: 28, height: 28 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'driven', ratio: -1.1666666667, phaseDeg: 0 },   // -1.75 * 8 / 12
    connections: [{ id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 12 }],
    effects: [],
  },
  // Motor: plinth (mid, under the motor), worn motor body and its pulley (audit role: motor, motor pulley).
  motorPlinth: {
    id: 'motorPlinth', techId: 'wornMotor', minLevel: 1,
    assetId: 'machine.motorPlinth', attach: { socket: 'motorBase', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 10 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  wornMotor: {
    id: 'wornMotor', techId: 'wornMotor', minLevel: 1,
    assetId: 'machine.motor', attach: { socket: 'motorMount', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 48 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 1,
    animation: { kind: 'vibrate', driver: 'automation', amplitude: 1, speed: { base: 8, gain: 0.3, min: 2, max: 20 } },
    connections: [],
    effects: [{ kind: 'vibrate', driver: 'automation', threshold: 1, intensity: 0.5 }],
  },
  motorPulley: {
    id: 'motorPulley', techId: 'wornMotor', minLevel: 1,
    assetId: 'machine.pulleyMotor', attach: { socket: 'motorPulleyHub', offset: { x: 0, y: 0 } },
    size: { width: 12, height: 12 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'driven', ratio: 2, phaseDeg: 0 },
    connections: [{ id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 5 }],
    effects: [],
  },
  // Piston array: yoke (slider, moved by the rod) and the static block (audit role: conrod, yoke, plungers).
  pistonYoke: {
    id: 'pistonYoke', techId: 'pistonArray', minLevel: 1,
    assetId: 'machine.pistonYoke', attach: { socket: 'yokePin', offset: { x: 0, y: 0 } },
    size: { width: 80, height: 16 }, origin: { x: 0.5, y: 0.75 },
    layer: 'back',
    animation: { kind: 'slider' },
    connections: [{ id: 'eye', at: { x: 0, y: 0 }, kind: 'pin', radius: 2 }],
    effects: [],
  },
  pistonArray: {
    id: 'pistonArray', techId: 'pistonArray', minLevel: 1,
    assetId: 'machine.pistonBlock', attach: { socket: 'pistonBed', offset: { x: 0, y: 0 } },
    size: { width: 96, height: 58 }, origin: { x: 0.5, y: 1 },
    layer: 'back', depthBias: 1,
    animation: { kind: 'none' },
    connections: [],
    effects: [{ kind: 'steam', driver: 'automation', threshold: 5, intensity: 0.6 }],
  },
};

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
      'supportFrame', 'bearingM', 'bearingP', 'gearLarge', 'mainShaft', 'gearSmall', 'crankPulley', 'handCrank', 'crankBrace',
      'flywheelPedestal', 'flywheel', 'flywheelPulley', 'motorPlinth', 'wornMotor', 'motorPulley', 'pistonYoke', 'pistonArray',
      'generatorPlinth', 'generator', 'generatorPulley', 'coilStage1', 'coilStage2', 'coilStage3', 'motorRetrofitKit', 'crankDynamo',
      'capacitorRack', 'sparkGap', 'transformer', 'cableMast',
    ]);
  });

  it('has 29 components and 17 sockets', () => {
    expect(MACHINE_COMPONENT_IDS.length).toBe(29);
    expect(SOCKET_IDS.length).toBe(17);
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

  it('belt links connect two belt points, rod links two pin points and cable links two cable points', () => {
    for (const link of MACHINE_LINKS) {
      const expected = link.kind === 'belt' ? 'belt' : link.kind === 'rod' ? 'pin' : 'cable';
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
  it('at the full stage every driven component sits on a support, except motorPulley and generatorPulley', () => {
    const all = new Set<MachineComponentId>(MACHINE_COMPONENT_IDS);
    for (const def of COMPONENTS) {
      if (def.animation.kind !== 'driven' || SUPPORT_EXEMPT.has(def.id)) continue;
      expect(hasVisibleSupport(def, all)).toBe(true);
    }
  });

  it('motorPulley is carried by the worn motor bounding box', () => {
    const p = centreOf(MACHINE_COMPONENTS.motorPulley);
    expect(contains(boundsOf(MACHINE_COMPONENTS.wornMotor), p)).toBe(true);
  });

  it('every link joins techs that are equal or ordered by requirement', () => {
    for (const link of MACHINE_LINKS) {
      const fromTechs = techsOf(MACHINE_COMPONENTS[link.from.component]);
      const toTechs = techsOf(MACHINE_COMPONENTS[link.to.component]);
      const coherent = fromTechs.some((a) => toTechs.some((b) => a === b || dependsOn(a, b) || dependsOn(b, a)));
      expect(coherent).toBe(true);
    }
  });

  it('every stage prefix keeps the drive train coherent', () => {
    for (let n = 1; n <= UNLOCK_ORDER.length; n++) {
      const levels = levelsForPrefix(n);
      const visible = visibleAt(levels);
      if (visible.has('pistonYoke')) expect(visible.has('mainShaft')).toBe(true);
      for (const def of COMPONENTS) {
        if (!visible.has(def.id) || def.animation.kind !== 'driven' || SUPPORT_EXEMPT.has(def.id)) continue;
        expect(hasVisibleSupport(def, visible)).toBe(true);
      }
    }
    const first = visibleAt(levelsForPrefix(1));
    expect(first.has('mainShaft')).toBe(false);
    expect(first.has('bearingM')).toBe(false);
    for (let n = 2; n <= UNLOCK_ORDER.length; n++) {
      const visible = visibleAt(levelsForPrefix(n));
      expect(visible.has('mainShaft')).toBe(true);
      expect(visible.has('bearingM')).toBe(true);
    }
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

describe('era I component definitions are unchanged by WP8', () => {
  it('the snapshot covers exactly the 17 era-I ids', () => {
    expect(Object.keys(ERA_ONE_SNAPSHOT).sort()).toEqual(MACHINE_COMPONENT_IDS.slice(0, 17).slice().sort());
  });

  it('each era-I definition deep-equals the pre-WP8 snapshot', () => {
    for (const id of MACHINE_COMPONENT_IDS.slice(0, 17)) {
      const actual = MACHINE_COMPONENTS[id];
      const comparable = id === 'flywheelPulley'
        ? { ...actual, connections: actual.connections.filter((c) => c.id !== 'belt2') }
        : actual;
      expect(comparable, id).toEqual(ERA_ONE_SNAPSHOT[id]);
    }
  });

  it('flywheelPulley gains only the belt2 connection (second belt, radius 12)', () => {
    expect(MACHINE_COMPONENTS.flywheelPulley.connections).toEqual([
      { id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 12 },
      { id: 'belt2', at: { x: 0, y: 0 }, kind: 'belt', radius: 12 },
    ]);
  });
});

describe('era II machine data', () => {
  it('the generator set, coil stages and dynamo use their contract techs and levels', () => {
    expect(MACHINE_COMPONENTS.generatorPlinth.techId).toBe('generator');
    expect(MACHINE_COMPONENTS.generator.techId).toBe('generator');
    expect(MACHINE_COMPONENTS.generatorPulley.techId).toBe('generator');
    expect(MACHINE_COMPONENTS.coilStage1).toMatchObject({ techId: 'copperWinding', minLevel: 1 });
    expect(MACHINE_COMPONENTS.coilStage2).toMatchObject({ techId: 'copperWinding', minLevel: 10 });
    expect(MACHINE_COMPONENTS.coilStage3).toMatchObject({ techId: 'copperWinding', minLevel: 20 });
    expect(MACHINE_COMPONENTS.crankDynamo.techId).toBe('dynamoCrank');
    expect(MACHINE_COMPONENTS.motorRetrofitKit.techId).toBe('motorRetrofit');
    expect(MACHINE_COMPONENTS.capacitorRack.techId).toBe('capacitorBank');
    expect(MACHINE_COMPONENTS.sparkGap.techId).toBe('sparkGap');
    expect(MACHINE_COMPONENTS.transformer.techId).toBe('transformer');
    expect(MACHINE_COMPONENTS.cableMast.techId).toBe('powerLines');
  });

  it('generator animation is none, so the generator stays attached (CR4)', () => {
    expect(MACHINE_COMPONENTS.generator.animation).toEqual({ kind: 'none' });
  });

  it('generatorPulley is driven at ratio -1.75 and belt-linked at radius 8', () => {
    expect(MACHINE_COMPONENTS.generatorPulley.animation).toEqual({ kind: 'driven', ratio: -1.75, phaseDeg: 0 });
    expect(pointOf('generatorPulley', 'belt')).toEqual({ id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 8 });
  });

  it('sparkGap animation is a four-frame electric cycle at no more than 3 Hz', () => {
    const anim = MACHINE_COMPONENTS.sparkGap.animation;
    expect(anim.kind).toBe('frames');
    if (anim.kind !== 'frames') return;
    expect(anim.frames).toBe(4);
    expect(anim.maxHz).toBeGreaterThan(0);
    expect(anim.maxHz).toBeLessThanOrEqual(3);
    expect(anim.driver).toBe('electric');
  });

  it('coil stages have identical size, origin and attach', () => {
    const stages = [MACHINE_COMPONENTS.coilStage1, MACHINE_COMPONENTS.coilStage2, MACHINE_COMPONENTS.coilStage3];
    for (const s of stages) {
      expect(s.size).toEqual(stages[0]?.size);
      expect(s.origin).toEqual(stages[0]?.origin);
      expect(s.attach).toEqual(stages[0]?.attach);
    }
  });

  it('generatorPulley is carried by the generator bounding box', () => {
    const p = centreOf(MACHINE_COMPONENTS.generatorPulley);
    expect(contains(boundsOf(MACHINE_COMPONENTS.generator), p)).toBe(true);
  });

  it('generator hub and spark mount sit at the CR1 and CR2 positions', () => {
    expect(MACHINE_SOCKETS.generatorHub).toEqual({ x: 228, y: -22 });
    expect(MACHINE_SOCKETS.sparkMount).toEqual({ x: 340, y: -53 });
  });

  it('spark gap stands on the rack top plate and sits inside the rack width', () => {
    const spark = boundsOf(MACHINE_COMPONENTS.sparkGap);
    const rack = boundsOf(MACHINE_COMPONENTS.capacitorRack);
    expect(spark.bottom).toBe(-53);
    expect(spark.left).toBe(324);
    expect(spark.right).toBe(356);
    expect(spark.left).toBeGreaterThanOrEqual(rack.left);
    expect(spark.right).toBeLessThanOrEqual(rack.right);
  });

  it('motor retrofit kit sits on the motor housing and inside the worn motor width', () => {
    const kit = boundsOf(MACHINE_COMPONENTS.motorRetrofitKit);
    const motor = boundsOf(MACHINE_COMPONENTS.wornMotor);
    expect(kit.bottom).toBe(-43);
    expect(kit.left).toBeGreaterThanOrEqual(motor.left);
    expect(kit.right).toBeLessThanOrEqual(motor.right);
  });

  it('exactly three cable links join two cable points, the CR6 ones carry sag 4 and 3', () => {
    const cables = MACHINE_LINKS.filter((l) => l.kind === 'cable');
    expect(cables.length).toBe(3);
    expect(cables).toEqual([
      { from: { component: 'generator', point: 'termR' }, to: { component: 'capacitorRack', point: 'lugL' }, kind: 'cable', sag: 4 },
      { from: { component: 'capacitorRack', point: 'lugR' }, to: { component: 'transformer', point: 'primary' }, kind: 'cable', sag: 3 },
      { from: { component: 'transformer', point: 'bushing' }, to: { component: 'cableMast', point: 'top' }, kind: 'cable' },
    ]);
    for (const link of cables) {
      expect(pointOf(link.from.component, link.from.point)?.kind).toBe('cable');
      expect(pointOf(link.to.component, link.to.point)?.kind).toBe('cable');
    }
  });

  it('the era-II belt joins flywheelPulley.belt2 to generatorPulley.belt', () => {
    const belts = MACHINE_LINKS.filter((l) => l.kind === 'belt' && l.from.component === 'flywheelPulley');
    expect(belts).toEqual([{ from: { component: 'flywheelPulley', point: 'belt2' }, to: { component: 'generatorPulley', point: 'belt' }, kind: 'belt' }]);
  });

  it('the era-II sockets are all used and every era-II component lies inside MACHINE_BOUNDS', () => {
    const era2 = MACHINE_COMPONENT_IDS.slice(17).map((id) => MACHINE_COMPONENTS[id]);
    for (const def of era2) {
      const b = boundsOf(def);
      expect(b.left).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
      expect(b.right).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
      expect(b.top).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
      expect(b.bottom).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
    }
    const used = new Set(COMPONENTS.map((def) => def.attach.socket));
    for (const id of SOCKET_IDS.slice(9)) expect(used.has(id), id).toBe(true);
  });
});

describe('era II prefixes', () => {
  const STEPS = ERA_TWO_STEPS.length;

  it('every era-II component is visible at the full stage', () => {
    const visible = visibleAt(levelsEraTwo(STEPS));
    for (const id of MACHINE_COMPONENT_IDS) expect(visible.has(id), id).toBe(true);
  });

  it('generatorPulley visible implies flywheelPulley visible', () => {
    expect(visibleAt(levelsEraTwo(1)).has('generatorPulley')).toBe(true);
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsEraTwo(n));
      if (visible.has('generatorPulley')) expect(visible.has('flywheelPulley')).toBe(true);
    }
  });

  it('coilStage3 implies coilStage2 implies coilStage1', () => {
    expect(visibleAt(levelsEraTwo(2)).has('coilStage1')).toBe(true);
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsEraTwo(n));
      if (visible.has('coilStage3')) expect(visible.has('coilStage2')).toBe(true);
      if (visible.has('coilStage2')) expect(visible.has('coilStage1')).toBe(true);
    }
  });

  it('cableMast implies transformer', () => {
    expect(visibleAt(levelsEraTwo(STEPS)).has('cableMast')).toBe(true);
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsEraTwo(n));
      if (visible.has('cableMast')) expect(visible.has('transformer')).toBe(true);
    }
  });

  it('motorRetrofitKit implies wornMotor', () => {
    expect(visibleAt(levelsEraTwo(5)).has('motorRetrofitKit')).toBe(true);
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsEraTwo(n));
      if (visible.has('motorRetrofitKit')) expect(visible.has('wornMotor')).toBe(true);
    }
  });
});
