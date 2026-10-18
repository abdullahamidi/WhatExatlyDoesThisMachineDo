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
  RESONANCE_MILESTONE_FX,
  RING_GEOMETRY,
  INVERSION_GHOST_FX,
  EXOTIC_MILESTONE_FX,
} from './machineComponents';
import type { ComponentAnimation, ConnectionPoint, MachineComponentDefinition, MachineComponentId, MachineLayer, MachineLink, SocketId, Vec2 } from './machineComponents';
import { PYLON_FEEDS } from './world';
import type { AssetId } from '../assets/assetIds';
import { ASSET_MANIFEST } from '../assets/manifest';
import { visibleMachineBounds } from '../game/math/machineBounds';

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

/** Machine-local position of a connection point: the component centre plus the point offset. */
function pointPosition(component: MachineComponentId, pointId: string): Vec2 {
  const point = pointOf(component, pointId);
  if (point === undefined) throw new Error(`missing point ${component}.${pointId}`);
  const c = centreOf(MACHINE_COMPONENTS[component]);
  return { x: c.x + point.at.x, y: c.y + point.at.y };
}

/** Draw depth of a component: its layer depth plus its depth bias. */
function depthOf(def: MachineComponentDefinition): number {
  return MACHINE_LAYER_DEPTH[def.layer] + (def.depthBias ?? 0);
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

/** Bearings, the flywheel pedestal and the era-IV servo base are the supports of driven parts. */
const SUPPORTS: readonly MachineComponentId[] = ['bearingM', 'bearingP', 'flywheelPedestal', 'servoBase'];

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

/** Era III unlock steps in order; firebox is set to each glow stage level in turn (1, 10, 20). */
const ERA_THREE_STEPS: readonly (readonly [TechId, number])[] = [
  ['boiler', 1], ['firebox', 1], ['firebox', 10], ['firebox', 20],
  ['inductionHeater', 1], ['steamHammer', 1], ['superheater', 1], ['condenser', 1], ['turbine', 1], ['reliefValves', 1],
];

/** All era-I and era-II techs at their stage levels, then the first n era-III steps applied. */
function levelsForEra3(n: number): Record<TechId, number> {
  const levels = levelsEraTwo(ERA_TWO_STEPS.length);
  for (const [id, level] of ERA_THREE_STEPS.slice(0, n)) levels[id] = level;
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
      'boiler', 'chimney', 'steamManifold', 'pressureGauge', 'gaugeNeedle', 'fireboxGlow1', 'fireboxGlow2', 'fireboxGlow3',
      'inductionHeater', 'superheater', 'reliefValves', 'steamHammer', 'hammerRam', 'condenser', 'turbine', 'turbineRotor',
      'spireTower', 'spireExciter', 'spireWave', 'coilRing1', 'coilRing2', 'coilRing3', 'coilRing4', 'calliope',
      'servoBase', 'servoArm', 'koenigFork', 'emitterDishL', 'emitterDishR', 'dishWavesL', 'dishWavesR', 'crystal',
      'nullGallery', 'nullChamber', 'nullCore', 'nullCoreGlint', 'ring1Back', 'ring2Back', 'ring3Back', 'ring4Back',
      'ring1Front', 'ring2Front', 'ring3Front', 'ring4Front', 'ring1Bead', 'ring2Bead', 'ring3Bead', 'ring4Bead',
      'siphonTube1L', 'siphonTube1R', 'siphonTube2L', 'siphonTube2R', 'siphonTube3L', 'siphonTube3R',
      'siphonArcs1', 'siphonArcs2', 'siphonArcs3', 'graviticAnchorL', 'graviticAnchorR',
      'anchorGlow1L', 'anchorGlow1R', 'anchorGlow2L', 'anchorGlow2R', 'anchorGlow3L', 'anchorGlow3R',
      'inversionGhost', 'lensLight', 'lensColumn', 'aperture', 'namePlate',
    ]);
  });

  it('has 99 components (61 through era IV plus 38 era V) and 60 sockets (45 plus 15 era V)', () => {
    expect(MACHINE_COMPONENT_IDS.length).toBe(99);
    expect(SOCKET_IDS.length).toBe(60);
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

  it('every speed curve (vibrate, spin and orbit) has min <= max and base > 0; frames, gauge and reciprocate need none', () => {
    for (const def of COMPONENTS) {
      const anim = def.animation;
      if (anim.kind === 'vibrate' || anim.kind === 'spin' || anim.kind === 'orbit') {
        expect(anim.speed.min).toBeLessThanOrEqual(anim.speed.max);
        expect(anim.speed.base).toBeGreaterThan(0);
      }
      if (anim.kind === 'frames' || anim.kind === 'gauge' || anim.kind === 'reciprocate') {
        expect('speed' in anim, def.id).toBe(false);
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

  it('belt links connect two belt points, rod two pin points, cable two cable points and pipe two pipe points', () => {
    for (const link of MACHINE_LINKS) {
      const expected = link.kind === 'belt' ? 'belt' : link.kind === 'rod' ? 'pin' : link.kind === 'pipe' ? 'pipe' : 'cable';
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

  it('connection points of driven components sit at the centre, except the pin ends of a pin-to-pin rod', () => {
    const pinToPin = new Set<string>();
    for (const link of MACHINE_LINKS) {
      if (link.kind !== 'rod') continue;
      if (drivenRatio(link.from.component) === null || drivenRatio(link.to.component) === null) continue;
      pinToPin.add(`${link.from.component}.${link.from.point}`);
      pinToPin.add(`${link.to.component}.${link.to.point}`);
    }
    for (const def of COMPONENTS) {
      if (def.animation.kind !== 'driven') continue;
      for (const c of def.connections) {
        if (pinToPin.has(`${def.id}.${c.id}`)) continue;
        expect(c.at, `${def.id}.${c.id}`).toEqual({ x: 0, y: 0 });
      }
    }
  });

  it('every connection point appears in at least one link except turbine.export (a world-space pylon feed)', () => {
    const linked = new Set<string>();
    for (const link of MACHINE_LINKS) {
      linked.add(`${link.from.component}.${link.from.point}`);
      linked.add(`${link.to.component}.${link.to.point}`);
    }
    for (const def of COMPONENTS) {
      for (const c of def.connections) {
        if (def.id === 'turbine' && c.id === 'export') continue;
        expect(linked.has(`${def.id}.${c.id}`), `${def.id}.${c.id}`).toBe(true);
      }
    }
  });

  it('turbine.export is a cable point that no link uses and PYLON_FEEDS references', () => {
    expect(pointOf('turbine', 'export')?.kind).toBe('cable');
    for (const link of MACHINE_LINKS) {
      for (const end of [link.from, link.to]) {
        expect(end.component === 'turbine' && end.point === 'export').toBe(false);
      }
    }
    expect(PYLON_FEEDS.some((f) => f.component === 'turbine' && f.point === 'export')).toBe(true);
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
    const rods = MACHINE_LINKS.filter((l) => l.kind === 'rod' && l.to.component === 'pistonYoke');
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
    expect(MACHINE_SHADOWS.length).toBe(9);
    for (const s of MACHINE_SHADOWS) {
      expect(MACHINE_COMPONENT_IDS).toContain(s.component);
    }
  });

  it('the three era III shadows are the boiler, the steam hammer and the condenser strips', () => {
    expect(MACHINE_SHADOWS.slice(4, 7)).toEqual([
      { component: 'boiler', x: -304, y: 0, width: 128, height: 2 },
      { component: 'steamHammer', x: -358, y: 0, width: 48, height: 2 },
      { component: 'condenser', x: -442, y: 0, width: 80, height: 2 },
    ]);
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

  it('each era-I definition deep-equals the pre-WP8 snapshot (flywheelPulley belt2 and the WP10 handCrank pin are the only additions)', () => {
    for (const id of MACHINE_COMPONENT_IDS.slice(0, 17)) {
      const actual = MACHINE_COMPONENTS[id];
      const comparable = id === 'flywheelPulley'
        ? { ...actual, connections: actual.connections.filter((c) => c.id !== 'belt2') }
        : id === 'handCrank'
          ? { ...actual, connections: actual.connections.filter((c) => c.id !== 'pin') }
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
    expect(MACHINE_SOCKETS.generatorHub).toEqual({ x: 268, y: -25 });
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

  it('six cable links join two cable points: the four power cables (CR6 sag 4 and 3, era III tie) and the two era V guy cables', () => {
    const cables = MACHINE_LINKS.filter((l) => l.kind === 'cable');
    expect(cables.length).toBe(6);
    expect(cables.slice(0, 4)).toEqual([
      { from: { component: 'generator', point: 'termR' }, to: { component: 'capacitorRack', point: 'lugL' }, kind: 'cable', sag: 4 },
      { from: { component: 'capacitorRack', point: 'lugR' }, to: { component: 'transformer', point: 'primary' }, kind: 'cable', sag: 3 },
      { from: { component: 'transformer', point: 'bushing' }, to: { component: 'cableMast', point: 'top' }, kind: 'cable' },
      { from: { component: 'motorRetrofitKit', point: 'tie' }, to: { component: 'inductionHeater', point: 'tie' }, kind: 'cable', sag: 3 },
    ]);
    expect(cables.slice(4)).toEqual([
      { from: { component: 'nullChamber', point: 'eyeL' }, to: { component: 'graviticAnchorL', point: 'eye' }, kind: 'cable', sag: 6, cableStyle: 'guy' },
      { from: { component: 'nullChamber', point: 'eyeR' }, to: { component: 'graviticAnchorR', point: 'eye' }, kind: 'cable', sag: 6, cableStyle: 'guy' },
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
    const era2 = MACHINE_COMPONENT_IDS.slice(17, 29).map((id) => MACHINE_COMPONENTS[id]);
    for (const def of era2) {
      const b = boundsOf(def);
      expect(b.left).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
      expect(b.right).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
      expect(b.top).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
      expect(b.bottom).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
    }
    const used = new Set(COMPONENTS.map((def) => def.attach.socket));
    for (const id of SOCKET_IDS.slice(9, 17)) expect(used.has(id), id).toBe(true);
  });
});

describe('era II prefixes', () => {
  const STEPS = ERA_TWO_STEPS.length;

  it('every era-II component is visible at the full stage', () => {
    const visible = visibleAt(levelsEraTwo(STEPS));
    for (const id of MACHINE_COMPONENT_IDS.slice(0, 29)) expect(visible.has(id), id).toBe(true);
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

/** One era-III row of the WP9 component table (contract C3). depthBias undefined = no bias. */
interface EraThreeRow {
  id: MachineComponentId; techId: TechId; minLevel: number; assetId: AssetId; width: number; height: number;
  origin: Vec2; socket: SocketId; layer: MachineLayer; depthBias?: number;
}

const ERA_THREE_TABLE: readonly EraThreeRow[] = [
  { id: 'boiler', techId: 'boiler', minLevel: 1, assetId: 'machine.boiler', width: 128, height: 96, origin: { x: 0.5, y: 1 }, socket: 'boilerBase', layer: 'mid' },
  { id: 'chimney', techId: 'boiler', minLevel: 1, assetId: 'machine.chimney', width: 32, height: 160, origin: { x: 0.5, y: 1 }, socket: 'chimneyBase', layer: 'mid', depthBias: 1 },
  { id: 'steamManifold', techId: 'boiler', minLevel: 1, assetId: 'machine.steamManifold', width: 96, height: 14, origin: { x: 0.5, y: 1 }, socket: 'manifoldSeat', layer: 'back', depthBias: 2 },
  { id: 'pressureGauge', techId: 'boiler', minLevel: 1, assetId: 'machine.gauge', width: 24, height: 24, origin: { x: 0.5, y: 1 }, socket: 'gaugeSeat', layer: 'mid', depthBias: 2 },
  { id: 'gaugeNeedle', techId: 'boiler', minLevel: 1, assetId: 'machine.gaugeNeedle', width: 24, height: 24, origin: { x: 0.5, y: 1 }, socket: 'gaugeSeat', layer: 'mid', depthBias: 3 },
  { id: 'fireboxGlow1', techId: 'firebox', minLevel: 1, assetId: 'machine.fireGlow1', width: 24, height: 24, origin: { x: 0.5, y: 0.5 }, socket: 'fireDoor', layer: 'mid', depthBias: 2 },
  { id: 'fireboxGlow2', techId: 'firebox', minLevel: 10, assetId: 'machine.fireGlow2', width: 24, height: 24, origin: { x: 0.5, y: 0.5 }, socket: 'fireDoor', layer: 'mid', depthBias: 3 },
  { id: 'fireboxGlow3', techId: 'firebox', minLevel: 20, assetId: 'machine.fireGlow3', width: 24, height: 24, origin: { x: 0.5, y: 0.5 }, socket: 'fireDoor', layer: 'mid', depthBias: 4 },
  { id: 'inductionHeater', techId: 'inductionHeater', minLevel: 1, assetId: 'machine.inductionHeater', width: 56, height: 40, origin: { x: 0.5, y: 1 }, socket: 'heaterSeat', layer: 'mid', depthBias: 5 },
  { id: 'superheater', techId: 'superheater', minLevel: 1, assetId: 'machine.superheater', width: 40, height: 32, origin: { x: 0.5, y: 1 }, socket: 'superheaterSeat', layer: 'mid', depthBias: 2 },
  { id: 'reliefValves', techId: 'reliefValves', minLevel: 1, assetId: 'machine.reliefValves', width: 16, height: 24, origin: { x: 0.5, y: 1 }, socket: 'reliefSeat', layer: 'mid', depthBias: 2 },
  { id: 'steamHammer', techId: 'steamHammer', minLevel: 1, assetId: 'machine.steamHammer', width: 48, height: 96, origin: { x: 0.5, y: 1 }, socket: 'hammerBase', layer: 'mid', depthBias: 1 },
  { id: 'hammerRam', techId: 'steamHammer', minLevel: 1, assetId: 'machine.hammerRam', width: 12, height: 36, origin: { x: 0.5, y: 1 }, socket: 'hammerTup', layer: 'mid' },
  { id: 'condenser', techId: 'condenser', minLevel: 1, assetId: 'machine.condenser', width: 80, height: 24, origin: { x: 0.5, y: 1 }, socket: 'condenserBase', layer: 'mid' },
  { id: 'turbine', techId: 'turbine', minLevel: 1, assetId: 'machine.turbine', width: 80, height: 64, origin: { x: 0.5, y: 1 }, socket: 'turbineBase', layer: 'mid', depthBias: 1 },
  { id: 'turbineRotor', techId: 'turbine', minLevel: 1, assetId: 'machine.turbineRotor', width: 28, height: 28, origin: { x: 0.5, y: 0.5 }, socket: 'turbineHub', layer: 'mid', depthBias: 2 },
];

/** Era III pipe links in contract order: P1, P2, P3, W1. */
const PIPE_LINKS_EXPECTED: readonly MachineLink[] = [
  { from: { component: 'boiler', point: 'steam' }, to: { component: 'steamManifold', point: 'steam' }, kind: 'pipe',
    via: [{ x: -246, y: -112 }, { x: -98, y: -112 }, { x: -98, y: -176 }], bore: 4, pipeStyle: 'steam' },
  { from: { component: 'boiler', point: 'steam' }, to: { component: 'steamHammer', point: 'steam' }, kind: 'pipe',
    via: [{ x: -246, y: -112 }, { x: -323, y: -112 }], bore: 4, pipeStyle: 'steam' },
  { from: { component: 'boiler', point: 'steam' }, to: { component: 'turbine', point: 'steam' }, kind: 'pipe',
    via: [{ x: -246, y: -112 }, { x: -412, y: -112 }], bore: 4, pipeStyle: 'steam' },
  { from: { component: 'condenser', point: 'condensate' }, to: { component: 'boiler', point: 'feed' }, kind: 'pipe',
    via: [{ x: -360, y: -13 }, { x: -360, y: -3 }, { x: -308, y: -3 }, { x: -308, y: -46 }], bore: 2, depth: MACHINE_LAYER_DEPTH.mid - 1, pipeStyle: 'water' },
];

/** Era IV pipe P4 (WP10): steam from the manifold right outlet up to the spire exciter. */
const PIPE_P4_EXPECTED: MachineLink = { from: { component: 'steamManifold', point: 'outR' }, to: { component: 'spireExciter', point: 'steam' }, kind: 'pipe',
  via: [{ x: 48, y: -176 }, { x: 48, y: -126 }], bore: 4, pipeStyle: 'steam' };

describe('era III machine data', () => {
  it('the 16 era-III components follow the contract table (tech, level, asset, size, origin, socket, layer, bias)', () => {
    expect(ERA_THREE_TABLE.length).toBe(16);
    expect(MACHINE_COMPONENT_IDS.slice(29, 45)).toEqual(ERA_THREE_TABLE.map((r) => r.id));
    for (const row of ERA_THREE_TABLE) {
      const def = MACHINE_COMPONENTS[row.id];
      expect(def.techId, row.id).toBe(row.techId);
      expect(def.minLevel, row.id).toBe(row.minLevel);
      expect(def.assetId, row.id).toBe(row.assetId);
      expect(def.size, row.id).toEqual({ width: row.width, height: row.height });
      expect(def.origin, row.id).toEqual(row.origin);
      expect(def.attach, row.id).toEqual({ socket: row.socket, offset: { x: 0, y: 0 } });
      expect(def.layer, row.id).toBe(row.layer);
      expect(def.depthBias, row.id).toBe(row.depthBias);
      expect(def.effects, row.id).toEqual([]);
    }
  });

  it('fireboxGlow1/2/3 share size, origin, attach and frames animation at tech levels 1 / 10 / 20', () => {
    const glows = [MACHINE_COMPONENTS.fireboxGlow1, MACHINE_COMPONENTS.fireboxGlow2, MACHINE_COMPONENTS.fireboxGlow3];
    for (const g of glows) {
      expect(g.size).toEqual(glows[0]?.size);
      expect(g.origin).toEqual(glows[0]?.origin);
      expect(g.attach).toEqual(glows[0]?.attach);
      expect(g.animation).toEqual({ kind: 'frames', frames: 4, maxHz: 3, driver: 'thermal' });
    }
    expect(glows.map((g) => g.minLevel)).toEqual([1, 10, 20]);
    expect(ASSET_MANIFEST['machine.fireGlow1'].frame?.count).toBe(4);
    expect(ASSET_MANIFEST['machine.fireGlow2'].frame?.count).toBe(4);
    expect(ASSET_MANIFEST['machine.fireGlow3'].frame?.count).toBe(4);
  });

  it('gaugeNeedle is a thermal gauge with 25 frames, log range 0..5 and tau 0.6 s, matching its manifest frame count', () => {
    expect(MACHINE_COMPONENTS.gaugeNeedle.animation).toEqual({ kind: 'gauge', driver: 'thermal', frames: 25, minLog: 0, maxLog: 5, tauSeconds: 0.6 });
    expect(ASSET_MANIFEST['machine.gaugeNeedle'].frame?.count).toBe(25);
  });

  it('hammerRam reciprocates at ratio 1, stroke 14 and phase 0, and sits below the steam hammer', () => {
    expect(MACHINE_COMPONENTS.hammerRam.animation).toEqual({ kind: 'reciprocate', ratio: 1, strokeArtPx: 14, phaseDeg: 0 });
    expect(depthOf(MACHINE_COMPONENTS.hammerRam)).toBeLessThan(depthOf(MACHINE_COMPONENTS.steamHammer));
  });

  it('turbineRotor spins from the thermal driver with the A1 speed curve', () => {
    expect(MACHINE_COMPONENTS.turbineRotor.animation).toEqual({ kind: 'spin', driver: 'thermal', speed: { base: 60, gain: 1.5, min: 0, max: 540 } });
  });

  it('the era-III sockets sit at the contract coordinates', () => {
    expect(MACHINE_SOCKETS.boilerBase).toEqual({ x: -240, y: 0 });
    expect(MACHINE_SOCKETS.chimneyBase).toEqual({ x: -293, y: -78 });
    expect(MACHINE_SOCKETS.superheaterSeat).toEqual({ x: -268, y: -73 });
    expect(MACHINE_SOCKETS.reliefSeat).toEqual({ x: -214, y: -77 });
    expect(MACHINE_SOCKETS.gaugeSeat).toEqual({ x: -192, y: -77 });
    expect(MACHINE_SOCKETS.fireDoor).toEqual({ x: -196, y: -32 });
    expect(MACHINE_SOCKETS.heaterSeat).toEqual({ x: -200, y: -36 });
    expect(MACHINE_SOCKETS.hammerBase).toEqual({ x: -334, y: 0 });
    expect(MACHINE_SOCKETS.hammerTup).toEqual({ x: -334, y: -22 });
    expect(MACHINE_SOCKETS.condenserBase).toEqual({ x: -402, y: 0 });
    expect(MACHINE_SOCKETS.turbineBase).toEqual({ x: -402, y: -24 });
    expect(MACHINE_SOCKETS.turbineHub).toEqual({ x: -412, y: -54 });
    expect(MACHINE_SOCKETS.manifoldSeat).toEqual({ x: -44, y: -168 });
  });

  it('motorRetrofitKit equals the era-II definition plus the tie connection only', () => {
    expect(MACHINE_COMPONENTS.motorRetrofitKit).toEqual({
      id: 'motorRetrofitKit', techId: 'motorRetrofit', minLevel: 1,
      assetId: 'machine.motorRetrofit', attach: { socket: 'motorMount', offset: { x: 0, y: -24 } },
      size: { width: 32, height: 16 }, origin: { x: 0.5, y: 0.5 },
      layer: 'mid', depthBias: 3,
      animation: { kind: 'vibrate', driver: 'automation', amplitude: 1, speed: { base: 8, gain: 0.3, min: 2, max: 20 } },
      connections: [{ id: 'tie', at: { x: 0, y: -3 }, kind: 'cable' }],
      effects: [],
    });
  });

  it('era-III wiring: the four era-III pipe links keep contract order, P4 is appended, each joins two pipe points', () => {
    const pipes = MACHINE_LINKS.filter((l) => l.kind === 'pipe');
    expect(pipes).toEqual([...PIPE_LINKS_EXPECTED, PIPE_P4_EXPECTED]);
    for (const link of pipes) {
      expect(pointOf(link.from.component, link.from.point)?.kind).toBe('pipe');
      expect(pointOf(link.to.component, link.to.point)?.kind).toBe('pipe');
    }
  });

  it('every pipe bore equals the profile length of its style', () => {
    for (const link of MACHINE_LINKS) {
      if (link.kind !== 'pipe') continue;
      expect(link.bore, `${link.from.component}->${link.to.component}`).toBe(MACHINE_LINK_STYLE.pipe[link.pipeStyle ?? 'steam'].prof.length);
    }
  });

  it('every pipe polyline is axis-aligned and its ends equal the resolved connection points', () => {
    const ENDS: Record<string, [Vec2, Vec2]> = {
      P1: [{ x: -246, y: -91 }, { x: -92, y: -176 }],
      P2: [{ x: -246, y: -91 }, { x: -323, y: -79 }],
      P3: [{ x: -246, y: -91 }, { x: -412, y: -86 }],
      W1: [{ x: -362, y: -13 }, { x: -304, y: -46 }],
      P4: [{ x: -11, y: -176 }, { x: 52, y: -126 }],
    };
    const names = ['P1', 'P2', 'P3', 'W1', 'P4'];
    const pipes = MACHINE_LINKS.filter((l) => l.kind === 'pipe');
    pipes.forEach((link, i) => {
      const name = names[i] ?? '';
      const start = pointPosition(link.from.component, link.from.point);
      const end = pointPosition(link.to.component, link.to.point);
      const polyline: Vec2[] = [start, ...(link.via ?? []), end];
      for (let k = 0; k + 1 < polyline.length; k++) {
        const a = polyline[k] as Vec2;
        const b = polyline[k + 1] as Vec2;
        expect(a.x === b.x || a.y === b.y, `${name} segment ${k}`).toBe(true);
        expect(a.x === b.x && a.y === b.y, `${name} segment ${k} not zero-length`).toBe(false);
      }
      expect(start, name).toEqual(ENDS[name]?.[0]);
      expect(end, name).toEqual(ENDS[name]?.[1]);
    });
  });

  it('W1 sits one layer below mid, every other pipe uses the default pipe depth, and both pipe styles carry fitting colours', () => {
    const pipes = MACHINE_LINKS.filter((l) => l.kind === 'pipe');
    const w1 = pipes.find((l) => l.pipeStyle === 'water');
    expect(w1?.depth).toBe(MACHINE_LAYER_DEPTH.mid - 1);
    for (const link of pipes) {
      if (link === w1) continue;
      expect(link.depth ?? MACHINE_LINK_STYLE.pipe.depth).toBe(MACHINE_LINK_STYLE.pipe.depth);
    }
    expect(MACHINE_LINK_STYLE.pipe.depth).toBe(MACHINE_LAYER_DEPTH.frame + 5);
    expect(MACHINE_LINK_STYLE.pipe.steam.fitting).toEqual({ ink: 0x14110f, hi: 0x7d8286, mid: 0x5a5f63, lo: 0x3e4246 });
    expect(MACHINE_LINK_STYLE.pipe.water.fitting).toEqual({ ink: 0x14110f, hi: 0x7d8286, mid: 0x5a5f63, lo: 0x3e4246 });
  });

  it('the era-III machine fits the bounds and the pylon feeds sit on real parts', () => {
    expect(MACHINE_BOUNDS).toEqual({ left: -560, right: 560, top: -616, bottom: 8 });
    for (const row of ERA_THREE_TABLE) {
      const b = boundsOf(MACHINE_COMPONENTS[row.id]);
      expect(b.left, row.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
      expect(b.right, row.id).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
      expect(b.top, row.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
      expect(b.bottom, row.id).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
    }
    for (const feed of PYLON_FEEDS) {
      expect(MACHINE_COMPONENT_IDS).toContain(feed.component);
      expect(pointOf(feed.component, feed.point)).toBeDefined();
    }
  });
});

describe('era III prefixes', () => {
  const STEPS = ERA_THREE_STEPS.length;

  it('every era-III component is visible at the full stage', () => {
    const visible = visibleAt(levelsForEra3(STEPS));
    for (const id of MACHINE_COMPONENT_IDS.slice(0, 29 + ERA_THREE_TABLE.length)) expect(visible.has(id), id).toBe(true);
  });

  it('chimney, steamManifold and pressureGauge are visible exactly from boiler 1', () => {
    for (const id of ['chimney', 'steamManifold', 'pressureGauge'] as const) {
      expect(visibleAt(levelsForEra3(0)).has(id), id).toBe(false);
      expect(visibleAt(levelsForEra3(1)).has(id), id).toBe(true);
    }
  });

  it('firebox glow stages come one at a time: glow 1 at firebox 1, glow 2 at 10, glow 3 at 20', () => {
    expect(visibleAt(levelsForEra3(2)).has('fireboxGlow1')).toBe(true);
    expect(visibleAt(levelsForEra3(2)).has('fireboxGlow2')).toBe(false);
    expect(visibleAt(levelsForEra3(3)).has('fireboxGlow2')).toBe(true);
    expect(visibleAt(levelsForEra3(3)).has('fireboxGlow3')).toBe(false);
    expect(visibleAt(levelsForEra3(4)).has('fireboxGlow3')).toBe(true);
  });

  it('fireboxGlow3 implies fireboxGlow2 implies fireboxGlow1', () => {
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsForEra3(n));
      if (visible.has('fireboxGlow3')) expect(visible.has('fireboxGlow2')).toBe(true);
      if (visible.has('fireboxGlow2')) expect(visible.has('fireboxGlow1')).toBe(true);
    }
  });

  it('gaugeNeedle implies pressureGauge, hammerRam implies steamHammer, turbineRotor implies turbine', () => {
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsForEra3(n));
      if (visible.has('gaugeNeedle')) expect(visible.has('pressureGauge')).toBe(true);
      if (visible.has('hammerRam')) expect(visible.has('steamHammer')).toBe(true);
      if (visible.has('turbineRotor')) expect(visible.has('turbine')).toBe(true);
    }
  });

  it('turbine implies condenser, and inductionHeater implies motorRetrofitKit', () => {
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsForEra3(n));
      if (visible.has('turbine')) expect(visible.has('condenser')).toBe(true);
      if (visible.has('inductionHeater')) expect(visible.has('motorRetrofitKit')).toBe(true);
    }
  });

  it('a frame sheet part draws exactly as many frames as its manifest entry', () => {
    for (const id of ['gaugeNeedle', 'fireboxGlow1', 'fireboxGlow2', 'fireboxGlow3'] as const) {
      const anim = MACHINE_COMPONENTS[id].animation;
      const count = anim.kind === 'frames' || anim.kind === 'gauge' ? anim.frames : NaN;
      expect(count, id).toBe(ASSET_MANIFEST[MACHINE_COMPONENTS[id].assetId].frame?.count);
    }
  });
});

/** Era-IV component ids: the 16 appended after the era-III block (contract C3). */
const ERA_FOUR_COMPONENT_IDS: readonly MachineComponentId[] = MACHINE_COMPONENT_IDS.slice(45, 61);

/** Era-V component ids: the 38 appended after the era-IV block (WP11 contract C3). */
const ERA_FIVE_COMPONENT_IDS: readonly MachineComponentId[] = MACHINE_COMPONENT_IDS.slice(61);

/** Unlock steps of era IV in order; harmonicCoil is set to each coil ring level in turn (1, 8, 16, 25). */
const ERA_FOUR_STEPS: readonly (readonly [TechId, number])[] = [
  ['resonatorSpire', 1], ['harmonicCoil', 1], ['harmonicCoil', 8], ['harmonicCoil', 16], ['harmonicCoil', 25],
  ['pressureResonator', 1], ['crankServo', 1], ['echoCrank', 1], ['phaseLock', 1], ['standingWave', 1], ['crystalLattice', 1],
];

/** All era-I to era-III techs at their stage levels, then the first n era-IV steps applied. */
function levelsForEra4(n: number): Record<TechId, number> {
  const levels = levelsForEra3(ERA_THREE_STEPS.length);
  for (const [id, level] of ERA_FOUR_STEPS.slice(0, n)) levels[id] = level;
  return levels;
}

/** One era-IV row of the WP10 component table (contract C3). Optional fields undefined = omitted. */
interface EraFourRow {
  id: MachineComponentId; techId: TechId; minLevel: number; assetId: AssetId; width: number; height: number;
  origin: Vec2; socket: SocketId; layer: MachineLayer; depthBias?: number; flipX?: boolean;
  animation: ComponentAnimation; connections: ConnectionPoint[];
}

const ERA_FOUR_TABLE: readonly EraFourRow[] = [
  { id: 'spireTower', techId: 'resonatorSpire', minLevel: 1, assetId: 'machine.spireTower', width: 80, height: 320, origin: { x: 0.5, y: 1 }, socket: 'spireBase', layer: 'mid', animation: { kind: 'none' }, connections: [] },
  { id: 'spireExciter', techId: 'resonatorSpire', minLevel: 1, assetId: 'machine.spireExciter', width: 24, height: 32, origin: { x: 0.5, y: 1 }, socket: 'spireBase', layer: 'mid', depthBias: 2, animation: { kind: 'none' }, connections: [{ id: 'steam', at: { x: -12, y: -16 }, kind: 'pipe' }] },
  { id: 'spireWave', techId: 'standingWave', minLevel: 1, assetId: 'machine.spireWave', width: 16, height: 270, origin: { x: 0.5, y: 1 }, socket: 'spireRod', layer: 'mid', depthBias: 1, animation: { kind: 'frames', frames: 8, maxHz: 12, driver: 'resonance' }, connections: [] },
  { id: 'coilRing1', techId: 'harmonicCoil', minLevel: 1, assetId: 'machine.coilRing1', width: 62, height: 8, origin: { x: 0.5, y: 0.5 }, socket: 'coilRing1', layer: 'mid', depthBias: 3, animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' }, connections: [] },
  { id: 'coilRing2', techId: 'harmonicCoil', minLevel: 8, assetId: 'machine.coilRing2', width: 48, height: 8, origin: { x: 0.5, y: 0.5 }, socket: 'coilRing2', layer: 'mid', depthBias: 3, animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' }, connections: [] },
  { id: 'coilRing3', techId: 'harmonicCoil', minLevel: 16, assetId: 'machine.coilRing3', width: 36, height: 8, origin: { x: 0.5, y: 0.5 }, socket: 'coilRing3', layer: 'mid', depthBias: 3, animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' }, connections: [] },
  { id: 'coilRing4', techId: 'harmonicCoil', minLevel: 25, assetId: 'machine.coilRing4', width: 30, height: 8, origin: { x: 0.5, y: 0.5 }, socket: 'coilRing4', layer: 'mid', depthBias: 3, animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' }, connections: [] },
  { id: 'calliope', techId: 'pressureResonator', minLevel: 1, assetId: 'machine.calliope', width: 72, height: 40, origin: { x: 0.5, y: 1 }, socket: 'calliopeSeat', layer: 'back', depthBias: 3, animation: { kind: 'none' }, connections: [] },
  { id: 'servoBase', techId: 'crankServo', minLevel: 1, assetId: 'machine.servoBase', width: 28, height: 20, origin: { x: 0.5, y: 1 }, socket: 'servoBase', layer: 'mid', depthBias: 3, animation: { kind: 'none' }, connections: [] },
  { id: 'servoArm', techId: 'crankServo', minLevel: 1, assetId: 'machine.servoArm', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, socket: 'servoHub', layer: 'front', depthBias: 3, animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 }, connections: [{ id: 'pin', at: { x: 0, y: -19 }, kind: 'pin' }] },
  { id: 'koenigFork', techId: 'echoCrank', minLevel: 1, assetId: 'machine.koenigFork', width: 22, height: 44, origin: { x: 0.5, y: 1 }, socket: 'forkBase', layer: 'mid', animation: { kind: 'frames', frames: 4, maxHz: 12, driver: 'manual' }, connections: [] },
  { id: 'emitterDishL', techId: 'phaseLock', minLevel: 1, assetId: 'machine.emitterDish', width: 40, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'dishL', layer: 'mid', depthBias: 4, animation: { kind: 'none' }, connections: [] },
  { id: 'emitterDishR', techId: 'phaseLock', minLevel: 1, assetId: 'machine.emitterDish', width: 40, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'dishR', layer: 'mid', depthBias: 4, flipX: true, animation: { kind: 'none' }, connections: [] },
  { id: 'dishWavesL', techId: 'phaseLock', minLevel: 1, assetId: 'machine.dishWaves', width: 40, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'dishWavesL', layer: 'mid', depthBias: 4, animation: { kind: 'frames', frames: 6, maxHz: 8, driver: 'resonance' }, connections: [] },
  { id: 'dishWavesR', techId: 'phaseLock', minLevel: 1, assetId: 'machine.dishWaves', width: 40, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'dishWavesR', layer: 'mid', depthBias: 4, flipX: true, animation: { kind: 'frames', frames: 6, maxHz: 8, driver: 'resonance' }, connections: [] },
  { id: 'crystal', techId: 'crystalLattice', minLevel: 1, assetId: 'machine.crystal', width: 32, height: 48, origin: { x: 0.5, y: 1 }, socket: 'crystalSeat', layer: 'mid', depthBias: 4, animation: { kind: 'frames', frames: 4, maxHz: 4, driver: 'resonance' }, connections: [] },
];

describe('era IV machine data', () => {
  it('the 16 era-IV components follow the contract table (tech, level, asset, size, origin, socket, layer, bias, flip, animation, connections)', () => {
    expect(ERA_FOUR_TABLE.length).toBe(16);
    expect(ERA_FOUR_COMPONENT_IDS).toEqual(ERA_FOUR_TABLE.map((r) => r.id));
    for (const row of ERA_FOUR_TABLE) {
      const def = MACHINE_COMPONENTS[row.id];
      expect(def.techId, row.id).toBe(row.techId);
      expect(def.minLevel, row.id).toBe(row.minLevel);
      expect(def.assetId, row.id).toBe(row.assetId);
      expect(def.size, row.id).toEqual({ width: row.width, height: row.height });
      expect(def.origin, row.id).toEqual(row.origin);
      expect(def.attach, row.id).toEqual({ socket: row.socket, offset: { x: 0, y: 0 } });
      expect(def.layer, row.id).toBe(row.layer);
      expect(def.depthBias, row.id).toBe(row.depthBias);
      expect(def.flipX, row.id).toBe(row.flipX);
      expect(def.animation, row.id).toEqual(row.animation);
      expect(def.connections, row.id).toEqual(row.connections);
      expect(def.effects, row.id).toEqual([]);
      expect(def.alsoVisibleWith, row.id).toBeUndefined();
    }
  });

  it('the era-IV sockets sit at the contract coordinates; the right dish and dish waves mirror the left ones', () => {
    expect(MACHINE_SOCKETS.spireBase).toEqual({ x: 64, y: -110 });
    expect(MACHINE_SOCKETS.spireRod).toEqual({ x: 64, y: -142 });
    expect(MACHINE_SOCKETS.coilRing1).toEqual({ x: 64, y: -157 });
    expect(MACHINE_SOCKETS.coilRing2).toEqual({ x: 64, y: -223 });
    expect(MACHINE_SOCKETS.coilRing3).toEqual({ x: 64, y: -274 });
    expect(MACHINE_SOCKETS.coilRing4).toEqual({ x: 64, y: -330 });
    expect(MACHINE_SOCKETS.dishL).toEqual({ x: 35, y: -360 });
    expect(MACHINE_SOCKETS.dishR).toEqual({ x: 93, y: -360 });
    expect(MACHINE_SOCKETS.dishWavesL).toEqual({ x: -5, y: -360 });
    expect(MACHINE_SOCKETS.dishWavesR).toEqual({ x: 133, y: -360 });
    expect(MACHINE_SOCKETS.crystalSeat).toEqual({ x: 64, y: -418 });
    expect(MACHINE_SOCKETS.calliopeSeat).toEqual({ x: -44, y: -178 });
    expect(MACHINE_SOCKETS.forkBase).toEqual({ x: 16, y: -110 });
    expect(MACHINE_SOCKETS.servoBase).toEqual({ x: 0, y: -14 });
    expect(MACHINE_SOCKETS.servoHub).toEqual({ x: 0, y: -24 });
    expect(MACHINE_SOCKETS.dishR.x).toBe(128 - MACHINE_SOCKETS.dishL.x);
    expect(MACHINE_SOCKETS.dishR.y).toBe(MACHINE_SOCKETS.dishL.y);
    expect(MACHINE_SOCKETS.dishWavesR.x).toBe(128 - MACHINE_SOCKETS.dishWavesL.x);
    expect(MACHINE_SOCKETS.dishWavesR.y).toBe(MACHINE_SOCKETS.dishWavesL.y);
  });

  it('coil rings: harmonicCoil levels 1 / 8 / 16 / 25, widths 62 / 48 / 36 / 30, all 8 px tall', () => {
    const rings = [MACHINE_COMPONENTS.coilRing1, MACHINE_COMPONENTS.coilRing2, MACHINE_COMPONENTS.coilRing3, MACHINE_COMPONENTS.coilRing4];
    expect(rings.map((r) => r.minLevel)).toEqual([1, 8, 16, 25]);
    expect(rings.map((r) => r.size.width)).toEqual([62, 48, 36, 30]);
    for (const r of rings) {
      expect(r.techId).toBe('harmonicCoil');
      expect(r.size.height).toBe(8);
    }
  });

  it('every era-IV frames part draws as many frames as its manifest entry', () => {
    for (const id of ERA_FOUR_COMPONENT_IDS) {
      const anim = MACHINE_COMPONENTS[id].animation;
      if (anim.kind !== 'frames') continue;
      expect(ASSET_MANIFEST[MACHINE_COMPONENTS[id].assetId].frame?.count, id).toBe(anim.frames);
    }
  });

  it('every resonance-driven part is a frames part', () => {
    for (const def of COMPONENTS) {
      const anim = def.animation;
      if ('driver' in anim && anim.driver === 'resonance') expect(anim.kind, def.id).toBe('frames');
    }
  });

  it('the servo arm animates exactly like the hand crank it couples to', () => {
    expect(MACHINE_COMPONENTS.servoArm.animation).toEqual(MACHINE_COMPONENTS.handCrank.animation);
  });

  it('the servo arm sits on the servo base', () => {
    expect(contains(boundsOf(MACHINE_COMPONENTS.servoBase), centreOf(MACHINE_COMPONENTS.servoArm))).toBe(true);
  });

  it('steamManifold equals its era-III definition plus the outR pipe point', () => {
    expect(MACHINE_COMPONENTS.steamManifold).toEqual({
      id: 'steamManifold', techId: 'boiler', minLevel: 1,
      assetId: 'machine.steamManifold', attach: { socket: 'manifoldSeat', offset: { x: 0, y: 0 } },
      size: { width: 96, height: 14 }, origin: { x: 0.5, y: 1 },
      layer: 'back', depthBias: 2,
      animation: { kind: 'none' },
      connections: [
        { id: 'steam', at: { x: -48, y: -8 }, kind: 'pipe' },
        { id: 'outR', at: { x: 33, y: -8 }, kind: 'pipe' },
      ],
      effects: [],
    });
  });

  it('handCrank equals its era-I definition plus the pin connection only', () => {
    expect(MACHINE_COMPONENTS.handCrank).toEqual({
      id: 'handCrank', techId: 'handCrank', minLevel: 1,
      assetId: 'machine.crank', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
      size: { width: 48, height: 48 }, origin: { x: 0.5, y: 0.5 },
      layer: 'front',
      animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 },
      connections: [{ id: 'pin', at: { x: 0, y: -19 }, kind: 'pin' }],
      effects: [],
    });
  });

  it('the milestone crystal FX: crystal holds frame 2 for 1 s on harmonicConvergence, the dish waves restart', () => {
    expect(RESONANCE_MILESTONE_FX).toEqual({ techId: 'harmonicConvergence', crystal: 'crystal', holdFrame: 2, holdMs: 1000, restart: ['dishWavesL', 'dishWavesR'] });
    expect(TECH_IDS).toContain(RESONANCE_MILESTONE_FX.techId);
    const crystal = MACHINE_COMPONENTS[RESONANCE_MILESTONE_FX.crystal];
    expect(crystal.animation.kind).toBe('frames');
    if (crystal.animation.kind !== 'frames') return;
    expect(RESONANCE_MILESTONE_FX.holdFrame).toBeLessThan(crystal.animation.frames);
    for (const id of RESONANCE_MILESTONE_FX.restart) expect(MACHINE_COMPONENTS[id].animation.kind, id).toBe('frames');
  });

  it('the machine has 16 links in total (14 through era IV, plus the era V guy cables G1 and G2), and P4 joins the manifold outlet to the spire exciter', () => {
    expect(MACHINE_LINKS.length).toBe(16);
    const p4 = MACHINE_LINKS.filter((l) => l.kind === 'pipe' && l.from.component === 'steamManifold');
    expect(p4).toEqual([PIPE_P4_EXPECTED]);
    expect(pointPosition('steamManifold', 'outR')).toEqual({ x: -11, y: -176 });
    expect(pointPosition('spireExciter', 'steam')).toEqual({ x: 52, y: -126 });
    expect(MACHINE_LINK_STYLE.pipe.steam.prof.length).toBe(4);
  });

  it('R1 pin-to-pin rod joins the servo arm pin to the hand crank pin at depth front + 4 and both ends are driven', () => {
    const r1 = MACHINE_LINKS.filter((l) => l.kind === 'rod' && l.from.component === 'servoArm');
    expect(r1).toEqual([{ from: { component: 'servoArm', point: 'pin' }, to: { component: 'handCrank', point: 'pin' }, kind: 'rod', depth: MACHINE_LAYER_DEPTH.front + 4 }]);
    const arm = pointOf('servoArm', 'pin');
    const crank = pointOf('handCrank', 'pin');
    expect(arm?.kind).toBe('pin');
    expect(crank?.kind).toBe('pin');
    expect(arm?.radius).toBeUndefined();
    expect(crank?.radius).toBeUndefined();
    expect(drivenRatio('servoArm')).toBe(drivenRatio('handCrank'));
    expect(drivenRatio('servoArm')).toBe(-1.75);
    const armAnim = MACHINE_COMPONENTS.servoArm.animation;
    const crankAnim = MACHINE_COMPONENTS.handCrank.animation;
    expect(armAnim).toEqual({ kind: 'driven', ratio: -1.75, phaseDeg: 0 });
    expect(crankAnim).toEqual({ kind: 'driven', ratio: -1.75, phaseDeg: 0 });
    expect(Math.hypot(arm?.at.x ?? NaN, arm?.at.y ?? NaN)).toBeCloseTo(19, 9);
    expect(Math.hypot(crank?.at.x ?? NaN, crank?.at.y ?? NaN)).toBeCloseTo(19, 9);
    const a = pointPosition('servoArm', 'pin');
    const b = pointPosition('handCrank', 'pin');
    expect(a).toEqual({ x: 0, y: -43 });
    expect(b).toEqual({ x: 0, y: -75 });
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(32, 9);
  });
});

describe('era IV prefixes', () => {
  const STEPS = ERA_FOUR_STEPS.length;

  it('every era I-IV component is visible at the full era-IV stage (era V ids follow at index 61)', () => {
    const visible = visibleAt(levelsForEra4(STEPS));
    for (const id of MACHINE_COMPONENT_IDS.slice(0, 61)) expect(visible.has(id), id).toBe(true);
  });

  it('no era-IV component is visible before resonatorSpire', () => {
    const visible = visibleAt(levelsForEra4(0));
    for (const id of ERA_FOUR_COMPONENT_IDS) expect(visible.has(id), id).toBe(false);
  });

  it('each era-IV part appears at its unlock step (1 spire, 2 coil 1, 3 coil 8, 4 coil 16, 5 coil 25, 6 pressure resonator, 7 crank servo, 8 echo crank, 9 phase lock, 10 standing wave, 11 crystal lattice)', () => {
    const unlockStep: [MachineComponentId, number][] = [
      ['spireTower', 1], ['spireExciter', 1], ['coilRing1', 2], ['coilRing2', 3], ['coilRing3', 4], ['coilRing4', 5], ['calliope', 6],
      ['servoBase', 7], ['servoArm', 7], ['koenigFork', 8], ['emitterDishL', 9], ['emitterDishR', 9], ['dishWavesL', 9], ['dishWavesR', 9],
      ['spireWave', 10], ['crystal', 11],
    ];
    expect(unlockStep.map(([id]) => id).sort()).toEqual([...ERA_FOUR_COMPONENT_IDS].sort());
    for (const [id, step] of unlockStep) {
      expect(visibleAt(levelsForEra4(step - 1)).has(id), `${id} before step ${step}`).toBe(false);
      expect(visibleAt(levelsForEra4(step)).has(id), `${id} at step ${step}`).toBe(true);
    }
  });

  it('coilRing4 implies coilRing3 implies coilRing2 implies coilRing1, and spireWave implies spireTower', () => {
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsForEra4(n));
      if (visible.has('coilRing4')) expect(visible.has('coilRing3')).toBe(true);
      if (visible.has('coilRing3')) expect(visible.has('coilRing2')).toBe(true);
      if (visible.has('coilRing2')) expect(visible.has('coilRing1')).toBe(true);
      if (visible.has('spireWave')) expect(visible.has('spireTower')).toBe(true);
    }
  });

  it('servoArm implies servoBase', () => {
    for (let n = 0; n <= STEPS; n++) {
      const visible = visibleAt(levelsForEra4(n));
      if (visible.has('servoArm')) expect(visible.has('servoBase')).toBe(true);
    }
  });
});

/** Ids of the era-V ring, siphon and glow parts, built from the digit and the side (contract C3 naming). */
function ringId(part: 'Back' | 'Front' | 'Bead', k: number): MachineComponentId { return `ring${k}${part}` as MachineComponentId; }
function siphonTubeId(k: number, side: 'L' | 'R'): MachineComponentId { return `siphonTube${k}${side}` as MachineComponentId; }
function anchorGlowId(k: number, side: 'L' | 'R'): MachineComponentId { return `anchorGlow${k}${side}` as MachineComponentId; }

/** Era-V unlock steps applied on top of the full era I-IV stage: every era-V gate tech and level (contract C1). */
const ERA_FIVE_FULL: readonly (readonly [TechId, number])[] = [
  ['nullChamber', 1], ['containmentRing', 25], ['resonantSiphon', 20], ['graviticAnchor', 10], ['inversionCrank', 1],
  ['lensArray', 1], ['horizonField', 20], ['skyAperture', 1], ['finalAlignment', 1], ['primaryFunction', 1],
];

/** All era-I to era-IV techs at their full stage levels, then the given era-V (tech, level) overrides. */
function levelsForEra5(steps: readonly (readonly [TechId, number])[]): Record<TechId, number> {
  const levels = levelsForEra4(ERA_FOUR_STEPS.length);
  for (const [id, level] of steps) levels[id] = level;
  return levels;
}

/** One era-V row of the WP11 component table (contract C3). Optional fields undefined = omitted. */
interface EraFiveRow {
  id: MachineComponentId; techId: TechId; minLevel: number; assetId: AssetId; width: number; height: number;
  origin: Vec2; socket: SocketId; layer: MachineLayer; depthBias?: number;
  animation: ComponentAnimation; connections: ConnectionPoint[];
}

const SIPHON_ARC_SPEED = { base: 20, gain: 25, min: 20, max: 180 } as const;

const ERA_FIVE_TABLE: readonly EraFiveRow[] = [
  { id: 'nullGallery', techId: 'nullChamber', minLevel: 1, assetId: 'machine.nullGallery', width: 128, height: 30, origin: { x: 0.5, y: 1 }, socket: 'galleryBase', layer: 'mid', depthBias: 3, animation: { kind: 'none' }, connections: [] },
  { id: 'nullChamber', techId: 'nullChamber', minLevel: 1, assetId: 'machine.nullChamber', width: 128, height: 116, origin: { x: 0.5, y: 1 }, socket: 'chamberBase', layer: 'mid', depthBias: 5, animation: { kind: 'none' },
    connections: [{ id: 'eyeL', at: { x: -62.5, y: -109.5 }, kind: 'cable' }, { id: 'eyeR', at: { x: 62.5, y: -109.5 }, kind: 'cable' }] },
  { id: 'nullCore', techId: 'nullChamber', minLevel: 1, assetId: 'machine.nullCore', width: 64, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 7, animation: { kind: 'spin', driver: 'exotic', speed: { base: 6, gain: 30, min: 6, max: 240 } }, connections: [] },
  { id: 'nullCoreGlint', techId: 'nullChamber', minLevel: 1, assetId: 'machine.nullCoreGlint', width: 64, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 8, animation: { kind: 'none' }, connections: [] },
  { id: 'ring1Back', techId: 'containmentRing', minLevel: 1, assetId: 'machine.ring1Back', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6, animation: { kind: 'none' }, connections: [] },
  { id: 'ring2Back', techId: 'containmentRing', minLevel: 8, assetId: 'machine.ring2Back', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6, animation: { kind: 'none' }, connections: [] },
  { id: 'ring3Back', techId: 'containmentRing', minLevel: 16, assetId: 'machine.ring3Back', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6, animation: { kind: 'none' }, connections: [] },
  { id: 'ring4Back', techId: 'containmentRing', minLevel: 25, assetId: 'machine.ring4Back', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6, animation: { kind: 'none' }, connections: [] },
  { id: 'ring1Front', techId: 'containmentRing', minLevel: 1, assetId: 'machine.ring1Front', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 9, animation: { kind: 'none' }, connections: [] },
  { id: 'ring2Front', techId: 'containmentRing', minLevel: 8, assetId: 'machine.ring2Front', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 9, animation: { kind: 'none' }, connections: [] },
  { id: 'ring3Front', techId: 'containmentRing', minLevel: 16, assetId: 'machine.ring3Front', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 9, animation: { kind: 'none' }, connections: [] },
  { id: 'ring4Front', techId: 'containmentRing', minLevel: 25, assetId: 'machine.ring4Front', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 9, animation: { kind: 'none' }, connections: [] },
  { id: 'ring1Bead', techId: 'containmentRing', minLevel: 1, assetId: 'machine.ringBead', width: 5, height: 5, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6,
    animation: { kind: 'orbit', ring: 1, phi0Deg: 0, dir: 1, speed: SIPHON_ARC_SPEED, speedScale: 1, frontLayer: 'front', frontBias: 0 }, connections: [] },
  { id: 'ring2Bead', techId: 'containmentRing', minLevel: 8, assetId: 'machine.ringBead', width: 5, height: 5, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6,
    animation: { kind: 'orbit', ring: 2, phi0Deg: 97, dir: -1, speed: SIPHON_ARC_SPEED, speedScale: 1.25, frontLayer: 'front', frontBias: 0 }, connections: [] },
  { id: 'ring3Bead', techId: 'containmentRing', minLevel: 16, assetId: 'machine.ringBead', width: 5, height: 5, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6,
    animation: { kind: 'orbit', ring: 3, phi0Deg: 194, dir: 1, speed: SIPHON_ARC_SPEED, speedScale: 1.5, frontLayer: 'front', frontBias: 0 }, connections: [] },
  { id: 'ring4Bead', techId: 'containmentRing', minLevel: 25, assetId: 'machine.ringBead', width: 5, height: 5, origin: { x: 0.5, y: 0.5 }, socket: 'coreHub', layer: 'mid', depthBias: 6,
    animation: { kind: 'orbit', ring: 4, phi0Deg: 291, dir: -1, speed: SIPHON_ARC_SPEED, speedScale: 1.75, frontLayer: 'front', frontBias: 0 }, connections: [] },
  { id: 'siphonTube1L', techId: 'resonantSiphon', minLevel: 1, assetId: 'machine.siphonTube', width: 12, height: 30, origin: { x: 0.5, y: 1 }, socket: 'siphon1L', layer: 'mid', depthBias: 4, animation: { kind: 'none' }, connections: [] },
  { id: 'siphonTube1R', techId: 'resonantSiphon', minLevel: 1, assetId: 'machine.siphonTube', width: 12, height: 30, origin: { x: 0.5, y: 1 }, socket: 'siphon1R', layer: 'mid', depthBias: 4, animation: { kind: 'none' }, connections: [] },
  { id: 'siphonTube2L', techId: 'resonantSiphon', minLevel: 10, assetId: 'machine.siphonTube', width: 12, height: 30, origin: { x: 0.5, y: 1 }, socket: 'siphon2L', layer: 'mid', depthBias: 4, animation: { kind: 'none' }, connections: [] },
  { id: 'siphonTube2R', techId: 'resonantSiphon', minLevel: 10, assetId: 'machine.siphonTube', width: 12, height: 30, origin: { x: 0.5, y: 1 }, socket: 'siphon2R', layer: 'mid', depthBias: 4, animation: { kind: 'none' }, connections: [] },
  { id: 'siphonTube3L', techId: 'resonantSiphon', minLevel: 20, assetId: 'machine.siphonTube', width: 12, height: 30, origin: { x: 0.5, y: 1 }, socket: 'siphon3L', layer: 'mid', depthBias: 4, animation: { kind: 'none' }, connections: [] },
  { id: 'siphonTube3R', techId: 'resonantSiphon', minLevel: 20, assetId: 'machine.siphonTube', width: 12, height: 30, origin: { x: 0.5, y: 1 }, socket: 'siphon3R', layer: 'mid', depthBias: 4, animation: { kind: 'none' }, connections: [] },
  { id: 'siphonArcs1', techId: 'resonantSiphon', minLevel: 1, assetId: 'machine.siphonArcs1', width: 128, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'siphonArcs', layer: 'mid', depthBias: 8,
    animation: { kind: 'frames', frames: 4, maxHz: 8, driver: 'exotic', frameOffset: 0 }, connections: [] },
  { id: 'siphonArcs2', techId: 'resonantSiphon', minLevel: 10, assetId: 'machine.siphonArcs2', width: 128, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'siphonArcs', layer: 'mid', depthBias: 8,
    animation: { kind: 'frames', frames: 4, maxHz: 8, driver: 'exotic', frameOffset: 1 }, connections: [] },
  { id: 'siphonArcs3', techId: 'resonantSiphon', minLevel: 20, assetId: 'machine.siphonArcs3', width: 128, height: 64, origin: { x: 0.5, y: 0.5 }, socket: 'siphonArcs', layer: 'mid', depthBias: 8,
    animation: { kind: 'frames', frames: 4, maxHz: 8, driver: 'exotic', frameOffset: 2 }, connections: [] },
  { id: 'graviticAnchorL', techId: 'graviticAnchor', minLevel: 1, assetId: 'machine.graviticAnchor', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorL', layer: 'mid', depthBias: 0,
    animation: { kind: 'none' }, connections: [{ id: 'eye', at: { x: 0, y: -121 }, kind: 'cable' }] },
  { id: 'graviticAnchorR', techId: 'graviticAnchor', minLevel: 1, assetId: 'machine.graviticAnchor', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorR', layer: 'mid', depthBias: 0,
    animation: { kind: 'none' }, connections: [{ id: 'eye', at: { x: 0, y: -121 }, kind: 'cable' }] },
  { id: 'anchorGlow1L', techId: 'graviticAnchor', minLevel: 1, assetId: 'machine.anchorGlow1', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorL', layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }, connections: [] },
  { id: 'anchorGlow1R', techId: 'graviticAnchor', minLevel: 1, assetId: 'machine.anchorGlow1', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorR', layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }, connections: [] },
  { id: 'anchorGlow2L', techId: 'graviticAnchor', minLevel: 5, assetId: 'machine.anchorGlow2', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorL', layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }, connections: [] },
  { id: 'anchorGlow2R', techId: 'graviticAnchor', minLevel: 5, assetId: 'machine.anchorGlow2', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorR', layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }, connections: [] },
  { id: 'anchorGlow3L', techId: 'graviticAnchor', minLevel: 10, assetId: 'machine.anchorGlow3', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorL', layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }, connections: [] },
  { id: 'anchorGlow3R', techId: 'graviticAnchor', minLevel: 10, assetId: 'machine.anchorGlow3', width: 32, height: 128, origin: { x: 0.5, y: 1 }, socket: 'anchorR', layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }, connections: [] },
  { id: 'inversionGhost', techId: 'inversionCrank', minLevel: 1, assetId: 'machine.inversionGhost', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, socket: 'crankHub', layer: 'mid', depthBias: 9,
    animation: { kind: 'driven', ratio: 1.75, phaseDeg: 0 }, connections: [] },
  { id: 'lensLight', techId: 'lensArray', minLevel: 1, assetId: 'machine.lensLight', width: 32, height: 48, origin: { x: 0.5, y: 1 }, socket: 'lensBase', layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' }, connections: [] },
  { id: 'lensColumn', techId: 'lensArray', minLevel: 1, assetId: 'machine.lensColumn', width: 32, height: 48, origin: { x: 0.5, y: 1 }, socket: 'lensBase', layer: 'mid', depthBias: 3, animation: { kind: 'none' }, connections: [] },
  { id: 'aperture', techId: 'lensArray', minLevel: 1, assetId: 'machine.aperture', width: 64, height: 28, origin: { x: 0.5, y: 1 }, socket: 'apertureBase', layer: 'mid', depthBias: 3,
    animation: { kind: 'latch', techId: 'skyAperture', minLevel: 1, frames: 6, fps: 5 }, connections: [] },
  { id: 'namePlate', techId: 'handCrank', minLevel: 1, assetId: 'machine.namePlate', width: 40, height: 11, origin: { x: 0.5, y: 1 }, socket: 'plateSeat', layer: 'frame', depthBias: 2,
    animation: { kind: 'stage', frames: 6, gates: [['generator', 1], ['boiler', 1], ['resonatorSpire', 1], ['nullChamber', 1]], endingFrame: 5 }, connections: [] },
];

/** Era-V sockets (contract C3 coordinates). */
const ERA_FIVE_SOCKETS: Readonly<Record<string, Vec2>> = {
  galleryBase: { x: 64, y: -395 }, chamberBase: { x: 64, y: -418 }, coreHub: { x: 64, y: -490 }, lensBase: { x: 64, y: -534 },
  apertureBase: { x: 64, y: -582 }, siphon1L: { x: 30, y: -418 }, siphon1R: { x: 98, y: -418 }, siphon2L: { x: 18, y: -418 },
  siphon2R: { x: 110, y: -418 }, siphon3L: { x: 42, y: -418 }, siphon3R: { x: 86, y: -418 }, siphonArcs: { x: 64, y: -468 },
  anchorL: { x: -520, y: 0 }, anchorR: { x: 520, y: 0 }, plateSeat: { x: 64, y: -96 },
};

describe('era V machine data (WP11)', () => {
  it('the 38 era-V components follow the contract table (tech, level, asset, size, origin, socket, layer, bias, animation, connections)', () => {
    expect(ERA_FIVE_TABLE.length).toBe(38);
    expect(ERA_FIVE_COMPONENT_IDS).toEqual(ERA_FIVE_TABLE.map((r) => r.id));
    expect(new Set(ERA_FIVE_COMPONENT_IDS).size).toBe(38);
    for (const row of ERA_FIVE_TABLE) {
      const def = MACHINE_COMPONENTS[row.id];
      expect(def.techId, row.id).toBe(row.techId);
      expect(def.minLevel, row.id).toBe(row.minLevel);
      expect(def.assetId, row.id).toBe(row.assetId);
      expect(def.size, row.id).toEqual({ width: row.width, height: row.height });
      expect(def.origin, row.id).toEqual(row.origin);
      expect(def.attach, row.id).toEqual({ socket: row.socket, offset: { x: 0, y: 0 } });
      expect(def.layer, row.id).toBe(row.layer);
      expect(def.depthBias, row.id).toBe(row.depthBias);
      expect(def.animation, row.id).toEqual(row.animation);
      expect(def.connections, row.id).toEqual(row.connections);
      expect(def.effects, row.id).toEqual([]);
      expect(def.alsoVisibleWith, row.id).toBeUndefined();
      expect(def.flipX, row.id).toBeUndefined();
    }
  });

  it('the era-V sockets sit at the contract coordinates (15 appended seats)', () => {
    expect(SOCKET_IDS.slice(45)).toEqual(Object.keys(ERA_FIVE_SOCKETS));
    for (const [id, at] of Object.entries(ERA_FIVE_SOCKETS)) {
      expect(MACHINE_SOCKETS[id as SocketId], id).toEqual(at);
    }
  });

  it('ring back and front halves share size, socket and gate; each bead has its ring gate and sits on the core hub', () => {
    const gates = [1, 8, 16, 25];
    [1, 2, 3, 4].forEach((k, i) => {
      const back = MACHINE_COMPONENTS[ringId('Back', k)];
      const front = MACHINE_COMPONENTS[ringId('Front', k)];
      const bead = MACHINE_COMPONENTS[ringId('Bead', k)];
      expect(back.minLevel, `ring${k}`).toBe(gates[i]);
      expect(front.size).toEqual(back.size);
      expect(front.attach).toEqual(back.attach);
      expect(front.minLevel).toBe(back.minLevel);
      expect(bead.minLevel).toBe(back.minLevel);
      expect(bead.techId).toBe(back.techId);
      expect(bead.attach.socket).toBe('coreHub');
    });
  });

  it('bead orbit data: ring equals the id digit, phi0 / direction / speedScale per table, in front on the front layer', () => {
    const beads = [[1, 0, 1, 1], [2, 97, -1, 1.25], [3, 194, 1, 1.5], [4, 291, -1, 1.75]] as const;
    for (const [k, phi0, dir, scale] of beads) {
      const anim = MACHINE_COMPONENTS[ringId('Bead', k)].animation;
      expect(anim).toEqual({ kind: 'orbit', ring: k, phi0Deg: phi0, dir, speed: { base: 20, gain: 25, min: 20, max: 180 }, speedScale: scale, frontLayer: 'front', frontBias: 0 });
      if (anim.kind !== 'orbit') continue;
      expect(anim.ring).toBe(k);
    }
  });

  it('RING_GEOMETRY ellipse extents match the bead tracks and fit inside the 112x72 ring sprite box', () => {
    const expected: Record<1 | 2 | 3 | 4, readonly [number, number]> = { 1: [35.5, 9.3], 2: [40.6, 15], 3: [42.4, 22.1], 4: [44.2, 29.5] };
    for (const k of [1, 2, 3, 4] as const) {
      const g = RING_GEOMETRY[k];
      const t = (g.tiltDeg * Math.PI) / 180;
      const ext = {
        x: Math.sqrt(g.a * g.a * Math.cos(t) ** 2 + g.b * g.b * Math.sin(t) ** 2),
        y: Math.sqrt(g.a * g.a * Math.sin(t) ** 2 + g.b * g.b * Math.cos(t) ** 2),
      };
      expect(Math.abs(ext.x - expected[k][0]), `ring${k} x`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(ext.y - expected[k][1]), `ring${k} y`).toBeLessThanOrEqual(0.5);
      expect(ext.x).toBeLessThanOrEqual(112 / 2);
      expect(ext.y).toBeLessThanOrEqual(72 / 2);
    }
  });

  it('anchor glows come in stages at graviticAnchor 1 / 5 / 10 on both sides, with 4 exotic frames at up to 3 Hz', () => {
    const gates = [1, 5, 10];
    [1, 2, 3].forEach((k, i) => {
      for (const side of ['L', 'R'] as const) {
        const def = MACHINE_COMPONENTS[anchorGlowId(k, side)];
        expect(def.minLevel, def.id).toBe(gates[i]);
        expect(def.techId, def.id).toBe('graviticAnchor');
        expect(def.animation, def.id).toEqual({ kind: 'frames', frames: 4, maxHz: 3, driver: 'exotic' });
      }
    });
  });

  it('siphon pairs mirror about x 64 (L + R = 128), share tech and stage level, and the arcs take the stage frame offset', () => {
    const pairs: readonly (readonly [SocketId, SocketId])[] = [['siphon1L', 'siphon1R'], ['siphon2L', 'siphon2R'], ['siphon3L', 'siphon3R']];
    const levels = [1, 10, 20];
    pairs.forEach(([l, r], i) => {
      expect(MACHINE_SOCKETS[l].x + MACHINE_SOCKETS[r].x, `pair ${i + 1}`).toBe(128);
      expect(MACHINE_SOCKETS[l].y).toBe(MACHINE_SOCKETS[r].y);
      const k = i + 1;
      const tubeL = MACHINE_COMPONENTS[siphonTubeId(k, 'L')];
      const tubeR = MACHINE_COMPONENTS[siphonTubeId(k, 'R')];
      expect(tubeL.attach.socket).toBe(l);
      expect(tubeR.attach.socket).toBe(r);
      expect(tubeL.minLevel).toBe(levels[i]);
      expect(tubeR.minLevel).toBe(levels[i]);
      const arcs = MACHINE_COMPONENTS[`siphonArcs${k}` as MachineComponentId];
      expect(arcs.minLevel).toBe(levels[i]);
      expect(arcs.animation).toEqual({ kind: 'frames', frames: 4, maxHz: 8, driver: 'exotic', frameOffset: i });
    });
  });

  it('guy cables: each joins two cable points with cableStyle guy and sag 6, its endpoints are hidden until their own tech is owned', () => {
    const guys = MACHINE_LINKS.filter((l) => l.cableStyle === 'guy');
    expect(guys.length).toBe(2);
    for (const link of guys) {
      expect(link.kind).toBe('cable');
      expect(link.sag).toBe(6);
      expect(pointOf(link.from.component, link.from.point)?.kind).toBe('cable');
      expect(pointOf(link.to.component, link.to.point)?.kind).toBe('cable');
      for (const end of [link.from, link.to]) {
        const def = MACHINE_COMPONENTS[end.component];
        expect(visibleAt(levelsForEra5([])).has(end.component), end.component).toBe(false);
        expect(visibleAt(levelsForEra5([[def.techId, def.minLevel]])).has(end.component), end.component).toBe(true);
      }
    }
    const power = MACHINE_LINKS.filter((l) => l.kind === 'cable' && l.cableStyle === undefined);
    expect(power.length).toBe(4);
  });

  it('MACHINE_LINK_STYLE.guy is the dark wire rope and sits below every chamber and anchor part (the sprites cover the cable ends)', () => {
    expect(MACHINE_LINK_STYLE.guy).toEqual({ depth: MACHINE_LAYER_DEPTH.frame + 5, core: 0x3e4246, under: 0x1f2225 });
    for (const def of COMPONENTS) {
      if (def.techId !== 'nullChamber' && def.techId !== 'graviticAnchor') continue;
      expect(MACHINE_LINK_STYLE.guy.depth, def.id).toBeLessThan(depthOf(def));
    }
  });

  it('cable styles appear on cable links only', () => {
    for (const link of MACHINE_LINKS) {
      if (link.cableStyle !== undefined) expect(link.kind).toBe('cable');
    }
  });

  it('era-V shadows are the two anchor footings, 32 px wide, on the ground line', () => {
    expect(MACHINE_SHADOWS.slice(7)).toEqual([
      { component: 'graviticAnchorL', x: -536, y: 0, width: 32, height: 2 },
      { component: 'graviticAnchorR', x: 504, y: 0, width: 32, height: 2 },
    ]);
  });

  it('the name plate sits inside the support frame box, so no era I-IV level set changes its visible bounds', () => {
    const plate = boundsOf(MACHINE_COMPONENTS.namePlate);
    const frame = boundsOf(MACHINE_COMPONENTS.supportFrame);
    expect(plate.left).toBeGreaterThanOrEqual(frame.left);
    expect(plate.right).toBeLessThanOrEqual(frame.right);
    expect(plate.top).toBeGreaterThanOrEqual(frame.top);
    expect(plate.bottom).toBeLessThanOrEqual(frame.bottom);
    const withoutPlate = Object.fromEntries(Object.entries(MACHINE_COMPONENTS).filter(([id]) => id !== 'namePlate')) as Record<MachineComponentId, MachineComponentDefinition>;
    const sets: Record<TechId, number>[] = [];
    for (let n = 0; n <= UNLOCK_ORDER.length; n++) sets.push(levelsForPrefix(n));
    for (let n = 0; n <= ERA_TWO_STEPS.length; n++) sets.push(levelsEraTwo(n));
    for (let n = 0; n <= ERA_THREE_STEPS.length; n++) sets.push(levelsForEra3(n));
    for (let n = 0; n <= ERA_FOUR_STEPS.length; n++) sets.push(levelsForEra4(n));
    for (const levels of sets) {
      expect(visibleMachineBounds(levels)).toEqual(visibleMachineBounds(levels, withoutPlate));
    }
  });

  it('every frames, latch and stage part draws as many frames as its manifest entry, and the sheet width is frame width x count', () => {
    for (const id of ERA_FIVE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const anim = def.animation;
      if (anim.kind !== 'frames' && anim.kind !== 'latch' && anim.kind !== 'stage') continue;
      const entry = ASSET_MANIFEST[def.assetId];
      expect(entry.frame?.count, id).toBe(anim.frames);
      expect(entry.width, id).toBe((entry.frame?.width ?? NaN) * anim.frames);
    }
  });

  it('every era-V part driven by the exotic driver is an era-V part (XF/s feeds only this wing)', () => {
    for (const def of COMPONENTS) {
      const anim = def.animation;
      if ('driver' in anim && anim.driver === 'exotic') expect(ERA_FIVE_COMPONENT_IDS, def.id).toContain(def.id);
    }
  });

  it('the null core spins on the exotic driver; the aperture latches on skyAperture; the name plate stage has 4 gates and an ending frame inside its sheet', () => {
    expect(MACHINE_COMPONENTS.nullCore.animation).toEqual({ kind: 'spin', driver: 'exotic', speed: { base: 6, gain: 30, min: 6, max: 240 } });
    expect(MACHINE_COMPONENTS.aperture.animation).toEqual({ kind: 'latch', techId: 'skyAperture', minLevel: 1, frames: 6, fps: 5 });
    const plate = MACHINE_COMPONENTS.namePlate.animation;
    expect(plate.kind).toBe('stage');
    if (plate.kind !== 'stage') return;
    expect(plate.gates.map(([t]) => t)).toEqual(['generator', 'boiler', 'resonatorSpire', 'nullChamber']);
    expect(plate.endingFrame).toBeLessThan(plate.frames);
    expect(plate.gates.length).toBeLessThan(plate.frames);
  });

  it('a lone era-V part sheet with no frame offset keeps frameOffset undefined (only the siphon arcs stagger)', () => {
    for (const id of ERA_FIVE_COMPONENT_IDS) {
      const anim = MACHINE_COMPONENTS[id].animation;
      if (anim.kind !== 'frames') continue;
      if (id.startsWith('siphonArcs')) expect(anim.frameOffset, id).toBeDefined();
      else expect(anim.frameOffset, id).toBeUndefined();
    }
  });

  it('INVERSION_GHOST_FX: the ghost is the mirror of the hand crank (ratio -(-1.75) = 1.75, phase 0), echo steps end at echoSeconds', () => {
    expect(MACHINE_COMPONENT_IDS).toContain(INVERSION_GHOST_FX.component);
    expect(MACHINE_COMPONENT_IDS).toContain(INVERSION_GHOST_FX.mirrorOf);
    const mirror = drivenRatio(INVERSION_GHOST_FX.mirrorOf);
    expect(mirror).toBe(-1.75);
    expect(MACHINE_COMPONENTS[INVERSION_GHOST_FX.component].animation).toEqual({ kind: 'driven', ratio: -(mirror ?? NaN), phaseDeg: 0 });
    const steps = INVERSION_GHOST_FX.alphaSteps;
    expect(steps[steps.length - 1]?.untilS).toBe(INVERSION_GHOST_FX.echoSeconds);
    expect(INVERSION_GHOST_FX.echoSeconds).toBe(3);
  });

  it('EXOTIC_MILESTONE_FX: finalAlignment is a milestone, the core is the null core, the six anchor glows are frames parts with glowFrame inside the sheet', () => {
    expect(TECHNOLOGIES[EXOTIC_MILESTONE_FX.techId].kind).toBe('milestone');
    expect(EXOTIC_MILESTONE_FX.core).toBe('nullCore');
    expect(MACHINE_COMPONENTS[EXOTIC_MILESTONE_FX.core].animation.kind).toBe('spin');
    expect(EXOTIC_MILESTONE_FX.anchorGlows.length).toBe(6);
    for (const id of EXOTIC_MILESTONE_FX.anchorGlows) {
      const anim = MACHINE_COMPONENTS[id].animation;
      expect(anim.kind, id).toBe('frames');
      if (anim.kind !== 'frames') continue;
      expect(EXOTIC_MILESTONE_FX.glowFrame, id).toBeLessThan(anim.frames);
    }
  });

  it('coverage: every unlock tech has a component (techId, alsoVisibleWith, latch or stage gate); the ending tech primaryFunction is the only exemption', () => {
    const referenced = new Set<TechId>();
    for (const def of COMPONENTS) {
      for (const t of techsOf(def)) referenced.add(t);
      if (def.animation.kind === 'latch') referenced.add(def.animation.techId);
      if (def.animation.kind === 'stage') for (const [t] of def.animation.gates) referenced.add(t);
    }
    const exempt: TechId[] = [];
    for (const id of TECH_IDS) {
      const def = TECHNOLOGIES[id];
      if (def.kind !== 'unlock') continue;
      if (def.effects.some((e) => e.type === 'ending')) { exempt.push(id); continue; }
      expect(referenced.has(id), id).toBe(true);
    }
    expect(exempt).toEqual(['primaryFunction']);
  });

  it('era-V visibility: nothing of era V is visible at the start except the name plate', () => {
    const start = visibleAt(levelsForPrefix(1));
    for (const id of ERA_FIVE_COMPONENT_IDS) expect(start.has(id), id).toBe(id === 'namePlate');
  });

  it('every era-V component is visible at the full stage', () => {
    const visible = visibleAt(levelsForEra5(ERA_FIVE_FULL));
    for (const id of MACHINE_COMPONENT_IDS) expect(visible.has(id), id).toBe(true);
  });

  it('ring back, front and bead parts come in at containmentRing 1 / 8 / 16 / 25, and ring N implies ring N-1', () => {
    const gates = [1, 8, 16, 25];
    for (let level = 0; level <= 25; level++) {
      const visible = visibleAt(levelsForEra5([['containmentRing', level]]));
      if (visible.has(ringId('Back', 4))) expect(visible.has(ringId('Back', 3))).toBe(true);
      if (visible.has(ringId('Back', 3))) expect(visible.has(ringId('Back', 2))).toBe(true);
      if (visible.has(ringId('Back', 2))) expect(visible.has(ringId('Back', 1))).toBe(true);
      gates.forEach((gate, i) => {
        const k = i + 1;
        for (const part of ['Back', 'Front', 'Bead'] as const) {
          expect(visible.has(ringId(part, k)), `${ringId(part, k)} at ${level}`).toBe(level >= gate);
        }
      });
    }
  });

  it('siphon tubes and arcs come in at resonantSiphon 1 / 10 / 20, tube 3 implies tube 2 implies tube 1', () => {
    const gates = [1, 10, 20];
    for (let level = 0; level <= 20; level++) {
      const visible = visibleAt(levelsForEra5([['resonantSiphon', level]]));
      if (visible.has(siphonTubeId(3, 'L'))) expect(visible.has(siphonTubeId(2, 'L'))).toBe(true);
      if (visible.has(siphonTubeId(2, 'L'))) expect(visible.has(siphonTubeId(1, 'L'))).toBe(true);
      gates.forEach((gate, i) => {
        const k = i + 1;
        expect(visible.has(siphonTubeId(k, 'L')), `tube ${k}L at ${level}`).toBe(level >= gate);
        expect(visible.has(siphonTubeId(k, 'R')), `tube ${k}R at ${level}`).toBe(level >= gate);
        expect(visible.has(`siphonArcs${k}` as MachineComponentId), `arcs ${k} at ${level}`).toBe(level >= gate);
      });
    }
  });

  it('anchor glows come in at graviticAnchor 1 / 5 / 10, glow 3 implies glow 2 implies glow 1 on each side', () => {
    const gates = [1, 5, 10];
    for (let level = 0; level <= 10; level++) {
      const visible = visibleAt(levelsForEra5([['graviticAnchor', level]]));
      for (const side of ['L', 'R'] as const) {
        if (visible.has(anchorGlowId(3, side))) expect(visible.has(anchorGlowId(2, side))).toBe(true);
        if (visible.has(anchorGlowId(2, side))) expect(visible.has(anchorGlowId(1, side))).toBe(true);
        gates.forEach((gate, i) => {
          expect(visible.has(anchorGlowId(i + 1, side)), `glow ${i + 1}${side} at ${level}`).toBe(level >= gate);
        });
      }
    }
  });

  it('the null gallery, chamber, core and core glint are visible exactly from nullChamber 1', () => {
    const ids: MachineComponentId[] = ['nullGallery', 'nullChamber', 'nullCore', 'nullCoreGlint'];
    expect(visibleAt(levelsForEra5([['nullChamber', 0]])).has('nullChamber')).toBe(false);
    for (const id of ids) {
      expect(visibleAt(levelsForEra5([])).has(id), id).toBe(false);
      expect(visibleAt(levelsForEra5([['nullChamber', 1]])).has(id), id).toBe(true);
    }
  });

  it('the inversion ghost is visible only with inversionCrank', () => {
    const others = ERA_FIVE_FULL.filter(([id]) => id !== 'inversionCrank');
    expect(visibleAt(levelsForEra5(others)).has('inversionGhost')).toBe(false);
    expect(visibleAt(levelsForEra5([['inversionCrank', 1]])).has('inversionGhost')).toBe(true);
  });

  it('the lens light, lens column and aperture are visible exactly with lensArray', () => {
    const others = ERA_FIVE_FULL.filter(([id]) => id !== 'lensArray');
    const ids: MachineComponentId[] = ['lensLight', 'lensColumn', 'aperture'];
    for (const id of ids) {
      expect(visibleAt(levelsForEra5(others)).has(id), id).toBe(false);
      expect(visibleAt(levelsForEra5([['lensArray', 1]])).has(id), id).toBe(true);
    }
  });

  it('the name plate is visible with no techs besides the starting hand crank', () => {
    expect(visibleAt(levelsForPrefix(1)).has('namePlate')).toBe(true);
  });
});
