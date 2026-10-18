import type { TechId } from './types';
import type { AssetId } from '../assets/assetIds';

export const MACHINE_COMPONENT_IDS = ['supportFrame', 'bearingM', 'bearingP', 'gearLarge', 'mainShaft', 'gearSmall', 'crankPulley', 'handCrank', 'crankBrace',
  'flywheelPedestal', 'flywheel', 'flywheelPulley', 'motorPlinth', 'wornMotor', 'motorPulley', 'pistonYoke', 'pistonArray'] as const;
export type MachineComponentId = typeof MACHINE_COMPONENT_IDS[number];

export const SOCKET_IDS = ['mainHub', 'crankHub', 'flywheelHub', 'flywheelBase', 'motorMount', 'motorBase', 'motorPulleyHub', 'pistonBed', 'yokePin'] as const;
export type SocketId = typeof SOCKET_IDS[number];

export interface Vec2 { x: number; y: number }

export type MachineLayer = 'back' | 'frame' | 'mid' | 'front';

/** Draw depth of each machine layer (relative to the machine container). */
export const MACHINE_LAYER_DEPTH: Record<MachineLayer, number> = { back: 0, frame: 10, mid: 20, front: 30 };

/** manual: click activity; automation: ME/s; combined: manual + automation. */
export type AnimationDriver = 'manual' | 'automation' | 'combined';

export interface SpeedCurve { base: number; gain: number; min: number; max: number }

export type ComponentAnimation =
  | { kind: 'none' }
  | { kind: 'driven'; ratio: number; phaseDeg: number }          // angle = partAngle(thetaM, ratio, phaseDeg)
  | { kind: 'slider' }                                           // pistonYoke only: position from sliderCrank
  | { kind: 'vibrate'; driver: AnimationDriver; amplitude: number; speed: SpeedCurve };   // unchanged from today

/** radius: belt pulley radius, art px. */
export interface ConnectionPoint { id: string; at: Vec2; kind: 'belt' | 'pin'; radius?: number }

export interface ProductionEffect { kind: 'vibrate' | 'glow' | 'dust' | 'steam'; driver: AnimationDriver; threshold: number; intensity: number }

export interface MachineComponentDefinition {
  id: MachineComponentId; techId: TechId; minLevel: number;      // visible when techLevels[techId] >= minLevel
  alsoVisibleWith?: { techId: TechId; minLevel: number }[];      // or when any of these tech levels is reached too
  assetId: AssetId; attach: { socket: SocketId | null; offset: Vec2 };   // socket null = machine origin
  size: { width: number; height: number };                       // art px, equals the manifest dims of assetId
  origin: Vec2;                                                  // normalised pivot of the sprite
  layer: MachineLayer;
  depthBias?: number;                                            // integer added to the layer depth, default 0
  animation: ComponentAnimation; connections: ConnectionPoint[]; effects: ProductionEffect[];
  flipX?: boolean;                                               // mirror sprite and connection x
}

/** belt joins two belt points; rod joins two pin points. */
export interface MachineLink { from: { component: MachineComponentId; point: string }; to: { component: MachineComponentId; point: string }; kind: 'belt' | 'rod' }

/** Machine-local art px bounding box of the whole machine. */
export const MACHINE_BOUNDS = { left: -200, right: 200, top: -200, bottom: 8 };

/** Machine-local art px positions of every socket. */
export const MACHINE_SOCKETS: Record<SocketId, Vec2> = {
  mainHub: { x: -44, y: -56 }, crankHub: { x: 0, y: -56 }, flywheelHub: { x: 150, y: -56 }, flywheelBase: { x: 150, y: 0 },
  motorMount: { x: -140, y: -27 }, motorBase: { x: -140, y: 0 }, motorPulleyHub: { x: -114, y: -31 }, pistonBed: { x: -44, y: -110 },
  yokePin: { x: -44, y: -125 },
};

/** Motion: manual activity decay, frame clamp and rest threshold (compares the DRIVER value, not speed). */
export const MACHINE_MOTION = {
  manualTauSeconds: 0.75,   // decay time constant of click activity
  maxFrameSeconds: 0.1,     // longest frame step fed to the motion maths
  restThreshold: 0.05,      // driver values below this mean the part is at rest
} as const;

/** Assembly: fly-in of a newly unlocked part, then dust puffs on landing. */
export const MACHINE_ASSEMBLY = {
  durationMs: 700,          // fly-in tween duration
  dropArtPx: 28,            // start this far above the rest position
  startScale: 0.4,          // scale at the start of the fly-in
  ease: 'Back.easeOut',     // Phaser ease name
  puffCount: 12,            // dust puffs per landing
  puffSpreadArtPx: 18,      // puffs spawn within +- this of the centre x
  puffRiseArtPx: 10,        // how far a puff rises over its life
  puffMs: 650,              // puff lifetime
  puffEndScale: 2.5,        // puff scale at end of life
  puffAlpha: 0.7,           // puff alpha at spawn
} as const;

/** Drive-train config: one master angle thetaM drives every driven part. */
export interface DriveTrainConfig {
  masterSpeed: SpeedCurve;                 // deg/s of thetaM, fed by the COMBINED driver (manual activity + ME/s)
  masterDirection: 1 | -1;                 // sign applied to the idle drift; -1 means a click (negative pending) turns the crank clockwise
  clickTauSeconds: number;                 // click impulse decay
  rod: { crank: MachineComponentId; pinRadius: number; pinPhaseDeg: number; length: number; sliderX: number };
  gears: { large: { teeth: number; pitchRadius: number }; small: { teeth: number; pitchRadius: number } };
}

export const DRIVE_TRAIN: DriveTrainConfig = {
  masterSpeed: { base: 60, gain: 0.5, min: 20, max: 240 }, masterDirection: -1, clickTauSeconds: 0.05,
  rod: { crank: 'mainShaft', pinRadius: 5, pinPhaseDeg: 0, length: 69, sliderX: -44 },
  gears: { large: { teeth: 14, pitchRadius: 28 }, small: { teeth: 8, pitchRadius: 16 } },
};

/** Link drawing: depths, belt / rod / axle-cap colours and sizes. Colours stay out of PALETTE. */
export const MACHINE_LINK_STYLE = {
  beltDepth: MACHINE_LAYER_DEPTH.mid + 5, rodDepth: MACHINE_LAYER_DEPTH.front + 1, capDepth: MACHINE_LAYER_DEPTH.front + 2,
  belt: { outer: 0x2e1a12, inner: 0x6e3a22, dash: 0x8c4a2a, dashSpacing: 8, dashLength: 2 },
  rod: { edge: 0x3e4246, core: 0x7d8286, eye: 0x5a5f63, eyeCentre: 0xa3a6a4, eyeRadius: 2 },
  cap: { size: 4, hi: 0xa3a6a4, body: 0x7d8286, ring: 0x1f2225 },
} as const;

/** Drive-train links between components. */
export const MACHINE_LINKS: readonly MachineLink[] = [
  { from: { component: 'motorPulley', point: 'belt' }, to: { component: 'mainShaft', point: 'belt' }, kind: 'belt' },
  { from: { component: 'crankPulley', point: 'belt' }, to: { component: 'flywheelPulley', point: 'belt' }, kind: 'belt' },
  { from: { component: 'mainShaft', point: 'pin' }, to: { component: 'pistonYoke', point: 'eye' }, kind: 'rod' },
];

/** Static shadow ellipses / strips drawn under the machine. */
export interface MachineShadow { component: MachineComponentId; x: number; y: number; width: number; height: number; oval?: boolean }

export const MACHINE_SHADOWS: readonly MachineShadow[] = [
  { component: 'supportFrame', x: -100, y: 0, width: 200, height: 2 },
  { component: 'motorPlinth', x: -164, y: 0, width: 48, height: 2 },
  { component: 'flywheelPedestal', x: 126, y: 0, width: 48, height: 2 },
  { component: 'flywheel', x: 138, y: 0, width: 24, height: 3, oval: true },
];

export const MACHINE_SHADOW_STYLE = { color: 0x5f5244, alpha: 0.5, depth: -1 } as const;

export const MACHINE_RENDER: { mode: 'renderTexture' | 'direct' } = { mode: 'renderTexture' };

/** Component table. Sub-layer order inside a layer comes from depthBias. */
export const MACHINE_COMPONENTS: Record<MachineComponentId, MachineComponentDefinition> = {
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
