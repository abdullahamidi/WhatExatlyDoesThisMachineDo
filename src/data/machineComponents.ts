import type { TechId } from './types';
import type { AssetId } from '../assets/assetIds';
import { CRANK_FEEDBACK } from './world';
import { PALETTE } from './palette';

export const MACHINE_COMPONENT_IDS = ['supportFrame', 'handCrank', 'gearSmall', 'gearLarge', 'flywheel', 'wornMotor', 'pistonArray'] as const;
export type MachineComponentId = typeof MACHINE_COMPONENT_IDS[number];

export const SOCKET_IDS = ['crankHub', 'smallGearHub', 'largeGearHub', 'flywheelHub', 'motorMount', 'pistonBed'] as const;
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
  | { kind: 'clickRotate'; degreesPerClick: number; tweenMs: number }
  | { kind: 'rotate'; driver: AnimationDriver; direction: 1 | -1; speed: SpeedCurve }                       // deg/s
  | { kind: 'reciprocate'; driver: AnimationDriver; axis: 'x' | 'y'; amplitude: number; speed: SpeedCurve }  // cycles/s
  | { kind: 'vibrate'; driver: AnimationDriver; amplitude: number; speed: SpeedCurve };

/** radius: belt pulley radius, art px. */
export interface ConnectionPoint { id: string; at: Vec2; kind: 'shaft' | 'belt' | 'pipe'; radius?: number }

export interface ProductionEffect { kind: 'vibrate' | 'glow' | 'dust' | 'steam'; driver: AnimationDriver; threshold: number; intensity: number }

export interface MachineComponentDefinition {
  id: MachineComponentId; techId: TechId; minLevel: number;      // visible when techLevels[techId] >= minLevel
  assetId: AssetId; attach: { socket: SocketId | null; offset: Vec2 };   // socket null = machine origin
  size: { width: number; height: number };                       // art px, equals the manifest dims of assetId
  origin: Vec2;                                                  // normalised pivot of the sprite
  layer: MachineLayer; animation: ComponentAnimation; connections: ConnectionPoint[]; effects: ProductionEffect[];
  flipX?: boolean;                                               // mirror sprite and connection x
}

export interface MachineLink { from: { component: MachineComponentId; point: string }; to: { component: MachineComponentId; point: string }; kind: ConnectionPoint['kind'] }

/** Machine-local art px bounding box of the whole machine. */
export const MACHINE_BOUNDS = { left: -200, right: 200, top: -200, bottom: 8 };

/** Machine-local art px positions of every socket. */
// PROVISIONAL: art is being remade; tuning edits numbers only.
export const MACHINE_SOCKETS: Record<SocketId, Vec2> = {
  crankHub: { x: -62, y: -78 },
  smallGearHub: { x: -30, y: -30 },
  largeGearHub: { x: 4, y: -62 },
  pistonBed: { x: 40, y: -106 },
  flywheelHub: { x: 150, y: -48 },
  motorMount: { x: -140, y: -16 },
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

/** Link drawing: depth, stroke widths per kind, colours and outline colour. */
export const MACHINE_LINK_STYLE = {
  depth: 15,
  width: { shaft: 3, belt: 2, pipe: 4 },
  color: { shaft: PALETTE.industrialGray, belt: PALETTE.grayDark, pipe: PALETTE.rustDark },
  outline: PALETTE.ink,
  outlineExtra: 2,          // outline stroke is this many art px wider than the colour stroke
} as const;

/** Drive-train links between components. */
export const MACHINE_LINKS: readonly MachineLink[] = [
  { from: { component: 'handCrank', point: 'shaft' }, to: { component: 'gearSmall', point: 'shaft' }, kind: 'shaft' },
  { from: { component: 'wornMotor', point: 'pulley' }, to: { component: 'gearSmall', point: 'belt' }, kind: 'belt' },
  { from: { component: 'gearLarge', point: 'belt' }, to: { component: 'flywheel', point: 'belt' }, kind: 'belt' },
  { from: { component: 'flywheel', point: 'shaft' }, to: { component: 'pistonArray', point: 'crank' }, kind: 'shaft' },
];

export const MACHINE_COMPONENTS: Record<MachineComponentId, MachineComponentDefinition> = {
  supportFrame: {
    id: 'supportFrame', techId: 'handCrank', minLevel: 1,
    assetId: 'machine.frame', attach: { socket: null, offset: { x: 0, y: 0 } },
    size: { width: 200, height: 110 }, origin: { x: 0.5, y: 1 },
    layer: 'frame', animation: { kind: 'none' },
    connections: [{ id: 'shaft', at: { x: 0, y: 0 }, kind: 'shaft' }],
    effects: [],
  },
  handCrank: {
    id: 'handCrank', techId: 'handCrank', minLevel: 1,
    assetId: 'machine.crank', attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 48 }, origin: { x: 0.5, y: 0.5 },
    layer: 'front',
    animation: { kind: 'clickRotate', degreesPerClick: CRANK_FEEDBACK.degreesPerClick, tweenMs: CRANK_FEEDBACK.tweenMs },
    connections: [{ id: 'shaft', at: { x: 0, y: 0 }, kind: 'shaft' }],
    effects: [],
  },
  gearSmall: {
    id: 'gearSmall', techId: 'gearRatio', minLevel: 1,
    assetId: 'machine.gearSmall', attach: { socket: 'smallGearHub', offset: { x: 0, y: 0 } },
    size: { width: 40, height: 40 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid',
    animation: { kind: 'rotate', driver: 'combined', direction: -1, speed: { base: 90, gain: 0.5, min: 30, max: 360 } },
    connections: [
      { id: 'shaft', at: { x: 0, y: 0 }, kind: 'shaft' },
      { id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 7 },
    ],
    effects: [],
  },
  gearLarge: {
    id: 'gearLarge', techId: 'reinforcedCrank', minLevel: 1,
    assetId: 'machine.gearLarge', attach: { socket: 'largeGearHub', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 64 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid',
    animation: { kind: 'rotate', driver: 'combined', direction: 1, speed: { base: 60, gain: 0.5, min: 20, max: 240 } },
    connections: [
      { id: 'shaft', at: { x: 0, y: 0 }, kind: 'shaft' },
      { id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 14 },
    ],
    effects: [],
  },
  flywheel: {
    id: 'flywheel', techId: 'flywheel', minLevel: 1,
    assetId: 'machine.flywheel', attach: { socket: 'flywheelHub', offset: { x: 0, y: 0 } },
    size: { width: 96, height: 96 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid',
    animation: { kind: 'rotate', driver: 'combined', direction: 1, speed: { base: 120, gain: 0.6, min: 30, max: 480 } },
    connections: [
      { id: 'shaft', at: { x: 0, y: 0 }, kind: 'shaft' },
      { id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 24 },
    ],
    effects: [{ kind: 'glow', driver: 'automation', threshold: 10, intensity: 0.4 }],
  },
  wornMotor: {
    id: 'wornMotor', techId: 'wornMotor', minLevel: 1,
    assetId: 'machine.motor', attach: { socket: 'motorMount', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 48 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid',
    animation: { kind: 'vibrate', driver: 'automation', amplitude: 1, speed: { base: 8, gain: 0.3, min: 2, max: 20 } },
    connections: [{ id: 'pulley', at: { x: 24, y: -4 }, kind: 'belt', radius: 8 }],
    effects: [{ kind: 'vibrate', driver: 'automation', threshold: 1, intensity: 0.5 }],
  },
  pistonArray: {
    id: 'pistonArray', techId: 'pistonArray', minLevel: 1,
    assetId: 'machine.piston', attach: { socket: 'pistonBed', offset: { x: 0, y: 0 } },
    size: { width: 96, height: 64 }, origin: { x: 0.5, y: 1 },
    layer: 'back',
    animation: { kind: 'reciprocate', driver: 'automation', axis: 'y', amplitude: 3, speed: { base: 1.5, gain: 0.4, min: 0.5, max: 6 } },
    connections: [{ id: 'crank', at: { x: 36, y: -12 }, kind: 'shaft' }],
    effects: [{ kind: 'steam', driver: 'automation', threshold: 5, intensity: 0.6 }],
  },
};
