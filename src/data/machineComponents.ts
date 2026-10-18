import type { TechId } from './types';
import type { AssetId } from '../assets/assetIds';

export const MACHINE_COMPONENT_IDS = ['supportFrame', 'bearingM', 'bearingP', 'gearLarge', 'mainShaft', 'gearSmall', 'crankPulley', 'handCrank', 'crankBrace',
  'flywheelPedestal', 'flywheel', 'flywheelPulley', 'motorPlinth', 'wornMotor', 'motorPulley', 'pistonYoke', 'pistonArray',
  'generatorPlinth', 'generator', 'generatorPulley', 'coilStage1', 'coilStage2', 'coilStage3', 'motorRetrofitKit', 'crankDynamo',
  'capacitorRack', 'sparkGap', 'transformer', 'cableMast',
  'boiler', 'chimney', 'steamManifold', 'pressureGauge', 'gaugeNeedle', 'fireboxGlow1', 'fireboxGlow2', 'fireboxGlow3',
  'inductionHeater', 'superheater', 'reliefValves', 'steamHammer', 'hammerRam', 'condenser', 'turbine', 'turbineRotor',
  'spireTower', 'spireExciter', 'spireWave', 'coilRing1', 'coilRing2', 'coilRing3', 'coilRing4', 'calliope',
  'servoBase', 'servoArm', 'koenigFork', 'emitterDishL', 'emitterDishR', 'dishWavesL', 'dishWavesR', 'crystal',
  // Era V (WP11): gallery, chamber, core, rings, siphons, guy anchors, inversion ghost, lens, aperture, name plate.
  'nullGallery', 'nullChamber', 'nullCore', 'nullCoreGlint', 'ring1Back', 'ring2Back', 'ring3Back', 'ring4Back',
  'ring1Front', 'ring2Front', 'ring3Front', 'ring4Front', 'ring1Bead', 'ring2Bead', 'ring3Bead', 'ring4Bead',
  'siphonTube1L', 'siphonTube1R', 'siphonTube2L', 'siphonTube2R', 'siphonTube3L', 'siphonTube3R',
  'siphonArcs1', 'siphonArcs2', 'siphonArcs3', 'graviticAnchorL', 'graviticAnchorR',
  'anchorGlow1L', 'anchorGlow1R', 'anchorGlow2L', 'anchorGlow2R', 'anchorGlow3L', 'anchorGlow3R',
  'inversionGhost', 'lensLight', 'lensColumn', 'aperture', 'namePlate'] as const;
export type MachineComponentId = typeof MACHINE_COMPONENT_IDS[number];

export const SOCKET_IDS = ['mainHub', 'crankHub', 'flywheelHub', 'flywheelBase', 'motorMount', 'motorBase', 'motorPulleyHub', 'pistonBed', 'yokePin',
  'generatorBase', 'generatorMount', 'generatorHub', 'dynamoMount', 'rackBase', 'sparkMount', 'transformerBase', 'mastBase',
  'boilerBase', 'chimneyBase', 'superheaterSeat', 'reliefSeat', 'gaugeSeat', 'fireDoor', 'heaterSeat', 'hammerBase', 'hammerTup',
  'condenserBase', 'turbineBase', 'turbineHub', 'manifoldSeat',
  'spireBase', 'spireRod', 'coilRing1', 'coilRing2', 'coilRing3', 'coilRing4', 'dishL', 'dishR', 'dishWavesL', 'dishWavesR',
  'crystalSeat', 'calliopeSeat', 'forkBase', 'servoBase', 'servoHub',
  // Era V sockets (WP11): gallery / chamber / core hub / lens / aperture, siphon pairs, siphon arcs, anchors, name plate.
  'galleryBase', 'chamberBase', 'coreHub', 'lensBase', 'apertureBase', 'siphon1L', 'siphon1R', 'siphon2L', 'siphon2R',
  'siphon3L', 'siphon3R', 'siphonArcs', 'anchorL', 'anchorR', 'plateSeat'] as const;
export type SocketId = typeof SOCKET_IDS[number];

export interface Vec2 { x: number; y: number }

export type MachineLayer = 'back' | 'frame' | 'mid' | 'front';

/** Draw depth of each machine layer (relative to the machine container). */
export const MACHINE_LAYER_DEPTH: Record<MachineLayer, number> = { back: 0, frame: 10, mid: 20, front: 30 };

/** manual: click activity; automation: ME/s; combined: manual + automation; electric: EE/s (rates.perSecond.ee); thermal: PR/s (rates.perSecond.pr); resonance: RS/s (rates.perSecond.rs); exotic: XF/s (rates.perSecond.xf). */
export type AnimationDriver = 'manual' | 'automation' | 'combined' | 'electric' | 'thermal' | 'resonance' | 'exotic';

export interface SpeedCurve { base: number; gain: number; min: number; max: number }

export type ComponentAnimation =
  | { kind: 'none' }
  | { kind: 'driven'; ratio: number; phaseDeg: number }          // angle = partAngle(thetaM, ratio, phaseDeg)
  | { kind: 'slider' }                                           // pistonYoke only: position from sliderCrank
  | { kind: 'vibrate'; driver: AnimationDriver; amplitude: number; speed: SpeedCurve }   // unchanged from today
  | { kind: 'frames'; frames: number; maxHz: number; driver: AnimationDriver; frameOffset?: number }   // frame cycle, advances at up to maxHz while driver > 0; frame = (cycle + frameOffset) % frames
  | { kind: 'reciprocate'; ratio: number; strokeArtPx: number; phaseDeg: number }      // sprite y offset = -(stroke/2)(1 + cos(ratio * thetaM + phase)); 0 = strike
  | { kind: 'spin'; driver: AnimationDriver; speed: SpeedCurve }                       // own angle += speed(driver)*dt, not tied to thetaM; RotSprite frames
  | { kind: 'gauge'; driver: AnimationDriver; frames: number; minLog: number; maxLog: number; tauSeconds: number }  // frames sheet, no rotation
  // Era V: a bead on a ring ellipse (RING_GEOMETRY); phi advances by dir * speed(exotic) * speedScale * dt; in front (sin phi >= 0) it draws on frontLayer / frontBias.
  | { kind: 'orbit'; ring: 1 | 2 | 3 | 4; phi0Deg: number; dir: 1 | -1; speed: SpeedCurve; speedScale: number; frontLayer: MachineLayer; frontBias: number }
  // Era V: frame 0 until the gate holds, then 0 -> frames-1 once and hold the last frame (gate already true at load = last frame).
  | { kind: 'latch'; techId: TechId; minLevel: number; frames: number; fps: number }
  // Era V: frame = number of gates met (clamped); endingFrame is unused until WP12 (finale).
  | { kind: 'stage'; frames: number; gates: readonly (readonly [TechId, number])[]; endingFrame: number };

/** radius: belt pulley radius, art px. cable: wire attachment point (no radius). pipe: steam / water port (no radius). */
export interface ConnectionPoint { id: string; at: Vec2; kind: 'belt' | 'pin' | 'cable' | 'pipe'; radius?: number }

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

/** belt joins two belt points; rod joins two pin points (slider-crank rod, or pin-to-pin rod when both ends are driven); cable joins two cable points (sag: art px, default MACHINE_LINK_STYLE.cable.sagArtPx). */
export interface MachineLink {
  from: { component: MachineComponentId; point: string }; to: { component: MachineComponentId; point: string };
  kind: 'belt' | 'rod' | 'cable' | 'pipe'; sag?: number;
  // pipe only: via = ABSOLUTE machine-local corners; depth (pipe and rod) overrides the default draw depth
  via?: Vec2[]; bore?: 4 | 2; depth?: number; pipeStyle?: 'steam' | 'water';
  // cable only: 'power' (default, cyan) or 'guy' (dark wire rope, era V guy cables)
  cableStyle?: 'power' | 'guy';
}

/** Machine-local art px bounding box of the whole machine (RT 1120 x 624; aperture box rows -610..-583 need top -616). */
export const MACHINE_BOUNDS = { left: -560, right: 560, top: -616, bottom: 8 };

/** Machine-local art px positions of every socket. */
export const MACHINE_SOCKETS: Record<SocketId, Vec2> = {
  mainHub: { x: -44, y: -56 }, crankHub: { x: 0, y: -56 }, flywheelHub: { x: 150, y: -56 }, flywheelBase: { x: 150, y: 0 },
  motorMount: { x: -140, y: -27 }, motorBase: { x: -140, y: 0 }, motorPulleyHub: { x: -114, y: -31 }, pistonBed: { x: -44, y: -110 },
  yokePin: { x: -44, y: -125 },
  generatorBase: { x: 264, y: 0 }, generatorMount: { x: 264, y: -42 }, generatorHub: { x: 268, y: -25 }, dynamoMount: { x: 70, y: -36 },
  rackBase: { x: 340, y: 0 }, sparkMount: { x: 340, y: -53 }, transformerBase: { x: 396, y: 0 }, mastBase: { x: 436, y: 0 },
  // Era III seats: boiler and chimney, superheater, relief valves, gauge, firebox door, heater, hammer, condenser, turbine, manifold.
  boilerBase: { x: -240, y: 0 }, chimneyBase: { x: -293, y: -78 }, superheaterSeat: { x: -268, y: -73 }, reliefSeat: { x: -214, y: -77 },
  gaugeSeat: { x: -192, y: -77 }, fireDoor: { x: -196, y: -32 }, heaterSeat: { x: -200, y: -36 }, hammerBase: { x: -334, y: 0 },
  hammerTup: { x: -334, y: -22 }, condenserBase: { x: -402, y: 0 }, turbineBase: { x: -402, y: -24 }, turbineHub: { x: -412, y: -54 },
  manifoldSeat: { x: -44, y: -168 },
  // Era IV seats: spire (tower, exciter, rod, coil rings, dishes, crystal), calliope, fork, servo.
  spireBase: { x: 64, y: -110 }, spireRod: { x: 64, y: -142 }, coilRing1: { x: 64, y: -157 }, coilRing2: { x: 64, y: -223 },
  coilRing3: { x: 64, y: -274 }, coilRing4: { x: 64, y: -330 }, dishL: { x: 35, y: -360 }, dishR: { x: 93, y: -360 },
  dishWavesL: { x: -5, y: -360 }, dishWavesR: { x: 133, y: -360 }, crystalSeat: { x: 64, y: -418 }, calliopeSeat: { x: -44, y: -178 },
  forkBase: { x: 16, y: -110 }, servoBase: { x: 0, y: -14 }, servoHub: { x: 0, y: -24 },
  // Era V seats: gallery / chamber / core hub / lens / aperture, siphon pairs, siphon arcs, anchors, name plate.
  galleryBase: { x: 64, y: -395 }, chamberBase: { x: 64, y: -418 }, coreHub: { x: 64, y: -490 }, lensBase: { x: 64, y: -534 },
  apertureBase: { x: 64, y: -582 }, siphon1L: { x: 30, y: -418 }, siphon1R: { x: 98, y: -418 }, siphon2L: { x: 18, y: -418 },
  siphon2R: { x: 110, y: -418 }, siphon3L: { x: 42, y: -418 }, siphon3R: { x: 86, y: -418 }, siphonArcs: { x: 64, y: -468 },
  anchorL: { x: -520, y: 0 }, anchorR: { x: 520, y: 0 }, plateSeat: { x: 64, y: -96 },
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

/** Milestone crystal (Era IV): on the milestone tech the crystal holds frame holdFrame for holdMs; the dish waves restart at frame 0. */
export const RESONANCE_MILESTONE_FX = { techId: 'harmonicConvergence', crystal: 'crystal', holdFrame: 2, holdMs: 1000, restart: ['dishWavesL', 'dishWavesR'] } as const;

/** Era V containment ring ellipses (art px, tilt in degrees): orbitPoint(ring, phi) draws the bead track. */
export const RING_GEOMETRY = { 1: { a: 36, b: 7, tiltDeg: -10 }, 2: { a: 42, b: 10, tiltDeg: 16 }, 3: { a: 46, b: 13, tiltDeg: -24 }, 4: { a: 50, b: 18, tiltDeg: 30 } } as const;

/** Inversion ghost: a mirror of the hand crank angle, shown for echoSeconds after a click; alpha steps are hard (no fade). */
export const INVERSION_GHOST_FX = { component: 'inversionGhost', mirrorOf: 'handCrank', echoSeconds: 3, alphaSteps: [{ untilS: 1.5, alpha: 1 }, { untilS: 2.25, alpha: 0.66 }, { untilS: 3, alpha: 0.33 }] } as const;

/** Exotic milestone (finalAlignment): beads swing to beadPhiDeg (align, then hold), the null core spins x3, the anchor glows hold glowFrame. */
export const EXOTIC_MILESTONE_FX = { techId: 'finalAlignment', beadPhiDeg: 90, alignMs: 1500, holdMs: 2000, core: 'nullCore', coreSpinMult: 3, coreSpinMs: 2000,
  anchorGlows: ['anchorGlow1L', 'anchorGlow1R', 'anchorGlow2L', 'anchorGlow2R', 'anchorGlow3L', 'anchorGlow3R'], glowFrame: 2, glowHoldMs: 2000 } as const;

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
  cable: { depth: MACHINE_LAYER_DEPTH.front + 1, core: 0x2f5a62, hi: 0x5fa8b4, sagArtPx: 10 },
  // Era V guy cables: dark wire rope under the anchor sprites (cableStyle 'guy').
  guy: { depth: MACHINE_LAYER_DEPTH.frame + 5, core: 0x3e4246, under: 0x1f2225 },
  // Era III pipes: steam (bright iron, flanged) and feed water (dark, flanged). Fitting colours are the ART_ERA3 section 4 constants.
  pipe: {
    depth: MACHINE_LAYER_DEPTH.frame + 5,
    steam: {
      prof: [0x7d8286, 0x5a5f63, 0x3e4246, 0x1f2225],
      flange: [[0x14110f, 0xa3a6a4, 0x7d8286, 0x5a5f63, 0x3e4246, 0x14110f], [0x14110f, 0x7d8286, 0x5a5f63, 0x3e4246, 0x2b2e31, 0x14110f]],
      flangeEvery: 24,
      fitting: { ink: 0x14110f, hi: 0x7d8286, mid: 0x5a5f63, lo: 0x3e4246 },
    },
    water: {
      prof: [0x5a5f63, 0x2b2e31],
      flange: [[0x14110f, 0x7d8286, 0x3e4246, 0x14110f], [0x14110f, 0x5a5f63, 0x2b2e31, 0x14110f]],
      flangeEvery: 24,
      fitting: { ink: 0x14110f, hi: 0x7d8286, mid: 0x5a5f63, lo: 0x3e4246 },
    },
  },
} as const;

/** Drive-train and wiring links between components. */
export const MACHINE_LINKS: readonly MachineLink[] = [
  { from: { component: 'motorPulley', point: 'belt' }, to: { component: 'mainShaft', point: 'belt' }, kind: 'belt' },
  { from: { component: 'crankPulley', point: 'belt' }, to: { component: 'flywheelPulley', point: 'belt' }, kind: 'belt' },
  { from: { component: 'mainShaft', point: 'pin' }, to: { component: 'pistonYoke', point: 'eye' }, kind: 'rod' },
  { from: { component: 'flywheelPulley', point: 'belt2' }, to: { component: 'generatorPulley', point: 'belt' }, kind: 'belt' },
  { from: { component: 'generator', point: 'termR' }, to: { component: 'capacitorRack', point: 'lugL' }, kind: 'cable', sag: 4 },
  { from: { component: 'capacitorRack', point: 'lugR' }, to: { component: 'transformer', point: 'primary' }, kind: 'cable', sag: 3 },
  { from: { component: 'transformer', point: 'bushing' }, to: { component: 'cableMast', point: 'top' }, kind: 'cable' },
  // Era III: steam and feed-water pipes (P1 to P3, W1) and the tie cable on the heater (C1).
  { from: { component: 'boiler', point: 'steam' }, to: { component: 'steamManifold', point: 'steam' }, kind: 'pipe',
    via: [{ x: -246, y: -112 }, { x: -98, y: -112 }, { x: -98, y: -176 }], bore: 4, pipeStyle: 'steam' },
  { from: { component: 'boiler', point: 'steam' }, to: { component: 'steamHammer', point: 'steam' }, kind: 'pipe',
    via: [{ x: -246, y: -112 }, { x: -323, y: -112 }], bore: 4, pipeStyle: 'steam' },
  { from: { component: 'boiler', point: 'steam' }, to: { component: 'turbine', point: 'steam' }, kind: 'pipe',
    via: [{ x: -246, y: -112 }, { x: -412, y: -112 }], bore: 4, pipeStyle: 'steam' },
  { from: { component: 'condenser', point: 'condensate' }, to: { component: 'boiler', point: 'feed' }, kind: 'pipe',
    via: [{ x: -360, y: -13 }, { x: -360, y: -3 }, { x: -308, y: -3 }, { x: -308, y: -46 }], bore: 2, depth: MACHINE_LAYER_DEPTH.mid - 1, pipeStyle: 'water' },
  { from: { component: 'motorRetrofitKit', point: 'tie' }, to: { component: 'inductionHeater', point: 'tie' }, kind: 'cable', sag: 3 },
  // Era IV: steam to the exciter (P4) and the servo coupling rod (R1, parallel crank).
  { from: { component: 'steamManifold', point: 'outR' }, to: { component: 'spireExciter', point: 'steam' }, kind: 'pipe',
    via: [{ x: 48, y: -176 }, { x: 48, y: -126 }], bore: 4, pipeStyle: 'steam' },
  { from: { component: 'servoArm', point: 'pin' }, to: { component: 'handCrank', point: 'pin' }, kind: 'rod', depth: MACHINE_LAYER_DEPTH.front + 4 },
  // Era V guy cables: chamber yoke eyes to the gravitic anchor eyes (wire rope, no cyan).
  { from: { component: 'nullChamber', point: 'eyeL' }, to: { component: 'graviticAnchorL', point: 'eye' }, kind: 'cable', sag: 6, cableStyle: 'guy' },
  { from: { component: 'nullChamber', point: 'eyeR' }, to: { component: 'graviticAnchorR', point: 'eye' }, kind: 'cable', sag: 6, cableStyle: 'guy' },
];

/** Static shadow ellipses / strips drawn under the machine. */
export interface MachineShadow { component: MachineComponentId; x: number; y: number; width: number; height: number; oval?: boolean }

export const MACHINE_SHADOWS: readonly MachineShadow[] = [
  { component: 'supportFrame', x: -100, y: 0, width: 200, height: 2 },
  { component: 'motorPlinth', x: -164, y: 0, width: 48, height: 2 },
  { component: 'flywheelPedestal', x: 126, y: 0, width: 48, height: 2 },
  { component: 'flywheel', x: 138, y: 0, width: 24, height: 3, oval: true },
  { component: 'boiler', x: -304, y: 0, width: 128, height: 2 },
  { component: 'steamHammer', x: -358, y: 0, width: 48, height: 2 },
  { component: 'condenser', x: -442, y: 0, width: 80, height: 2 },
  // Era V: the two gravitic anchor footings.
  { component: 'graviticAnchorL', x: -536, y: 0, width: 32, height: 2 },
  { component: 'graviticAnchorR', x: 504, y: 0, width: 32, height: 2 },
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
    connections: [{ id: 'pin', at: { x: 0, y: -19 }, kind: 'pin' }],   // Era IV: pin of the servo rod R1 (no radius)
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
    connections: [
      { id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 12 },
      { id: 'belt2', at: { x: 0, y: 0 }, kind: 'belt', radius: 12 },   // second drive: belt to the generator pulley (Era II)
    ],
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
  // Generator set (Era II): static plinth, coil frame and generator body; the belt pulley on the generator hub turns from the flywheel belt.
  generatorPlinth: {
    id: 'generatorPlinth', techId: 'generator', minLevel: 1,
    assetId: 'machine.generatorPlinth', attach: { socket: 'generatorBase', offset: { x: 0, y: 0 } },
    size: { width: 104, height: 10 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  generator: {
    id: 'generator', techId: 'generator', minLevel: 1,
    assetId: 'machine.generator', attach: { socket: 'generatorMount', offset: { x: 0, y: 0 } },
    size: { width: 96, height: 64 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 1,
    animation: { kind: 'none' },   // CR4: no vibrate, so the shaft, pulley, belt and cable stay attached
    connections: [{ id: 'termR', at: { x: 20, y: -26 }, kind: 'cable' }],
    effects: [],
  },
  generatorPulley: {
    id: 'generatorPulley', techId: 'generator', minLevel: 1,
    assetId: 'machine.pulleyGenerator', attach: { socket: 'generatorHub', offset: { x: 0, y: 0 } },
    size: { width: 20, height: 20 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 5,
    animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 },   // 8 * 1.75 = 14 = flywheel belt speed (12 * 1.1667)
    connections: [{ id: 'belt', at: { x: 0, y: 0 }, kind: 'belt', radius: 8 }],
    effects: [],
  },
  // Coil stages: each later stage replaces the lower one with the same box (copperWinding levels 1 / 10 / 20).
  coilStage1: {
    id: 'coilStage1', techId: 'copperWinding', minLevel: 1,
    assetId: 'machine.coils1', attach: { socket: 'generatorMount', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 40 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  coilStage2: {
    id: 'coilStage2', techId: 'copperWinding', minLevel: 10,
    assetId: 'machine.coils2', attach: { socket: 'generatorMount', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 40 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  coilStage3: {
    id: 'coilStage3', techId: 'copperWinding', minLevel: 20,
    assetId: 'machine.coils3', attach: { socket: 'generatorMount', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 40 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 4,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  // Motor retrofit kit: bolted on top of the worn motor (CR3 offset), shakes with the automation driver.
  motorRetrofitKit: {
    id: 'motorRetrofitKit', techId: 'motorRetrofit', minLevel: 1,
    assetId: 'machine.motorRetrofit', attach: { socket: 'motorMount', offset: { x: 0, y: -24 } },
    size: { width: 32, height: 16 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'vibrate', driver: 'automation', amplitude: 1, speed: { base: 8, gain: 0.3, min: 2, max: 20 } },
    connections: [{ id: 'tie', at: { x: 0, y: -3 }, kind: 'cable' }],   // Era III: tie cable to the induction heater (C1)
    effects: [],
  },
  // Dynamo on the hand crank side: a small frame part that shakes with clicks.
  crankDynamo: {
    id: 'crankDynamo', techId: 'dynamoCrank', minLevel: 1,
    assetId: 'machine.dynamo', attach: { socket: 'dynamoMount', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 24 }, origin: { x: 0.5, y: 0.5 },
    layer: 'frame', depthBias: 2,
    animation: { kind: 'vibrate', driver: 'manual', amplitude: 1, speed: { base: 8, gain: 0.3, min: 2, max: 20 } },
    connections: [],
    effects: [],
  },
  // Capacitor rack: static, glows with electric activity; two lugs carry the cables.
  capacitorRack: {
    id: 'capacitorRack', techId: 'capacitorBank', minLevel: 1,
    assetId: 'machine.capacitorRack', attach: { socket: 'rackBase', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 64 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'none' },
    connections: [
      { id: 'lugL', at: { x: -17, y: -38 }, kind: 'cable' },
      { id: 'lugR', at: { x: 17, y: -38 }, kind: 'cable' },
    ],
    effects: [{ kind: 'glow', driver: 'electric', threshold: 1, intensity: 0.5 }],
  },
  // Spark gap: four-frame discharge sheet, flickers at up to 3 Hz while EE flows.
  sparkGap: {
    id: 'sparkGap', techId: 'sparkGap', minLevel: 1,
    assetId: 'machine.sparkGap', attach: { socket: 'sparkMount', offset: { x: 0, y: 0 } },
    size: { width: 32, height: 48 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 6,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'electric' },
    connections: [],
    effects: [],
  },
  // Transformer: primary and bushing lugs carry the cables; hums with EE flow.
  transformer: {
    id: 'transformer', techId: 'transformer', minLevel: 1,
    assetId: 'machine.transformer', attach: { socket: 'transformerBase', offset: { x: 0, y: 0 } },
    size: { width: 64, height: 64 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'vibrate', driver: 'electric', amplitude: 0.5, speed: { base: 6, gain: 0.3, min: 2, max: 12 } },
    connections: [
      { id: 'primary', at: { x: -12, y: -60 }, kind: 'cable' },
      { id: 'bushing', at: { x: 16, y: -60 }, kind: 'cable' },
    ],
    effects: [],
  },
  // Cable mast: back layer, carries the line from the transformer up to the pylons.
  cableMast: {
    id: 'cableMast', techId: 'powerLines', minLevel: 1,
    assetId: 'machine.cableMast', attach: { socket: 'mastBase', offset: { x: 0, y: 0 } },
    size: { width: 16, height: 112 }, origin: { x: 0.5, y: 1 },
    layer: 'back',
    animation: { kind: 'none' },
    connections: [{ id: 'top', at: { x: 0, y: -108 }, kind: 'cable' }],
    effects: [],
  },
  // Era III: boiler, chimney and steam manifold stand on the boiler base; the gauge pair sits on the gauge seat.
  boiler: {
    id: 'boiler', techId: 'boiler', minLevel: 1,
    assetId: 'machine.boiler', attach: { socket: 'boilerBase', offset: { x: 0, y: 0 } },
    size: { width: 128, height: 96 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'none' },
    connections: [
      { id: 'steam', at: { x: -6, y: -91 }, kind: 'pipe' },
      { id: 'feed', at: { x: -64, y: -46 }, kind: 'pipe' },
    ],
    effects: [],
  },
  chimney: {
    id: 'chimney', techId: 'boiler', minLevel: 1,
    assetId: 'machine.chimney', attach: { socket: 'chimneyBase', offset: { x: 0, y: 0 } },
    size: { width: 32, height: 160 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 1,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  steamManifold: {
    id: 'steamManifold', techId: 'boiler', minLevel: 1,
    assetId: 'machine.steamManifold', attach: { socket: 'manifoldSeat', offset: { x: 0, y: 0 } },
    size: { width: 96, height: 14 }, origin: { x: 0.5, y: 1 },
    layer: 'back', depthBias: 2,
    animation: { kind: 'none' },
    connections: [
      { id: 'steam', at: { x: -48, y: -8 }, kind: 'pipe' },
      { id: 'outR', at: { x: 33, y: -8 }, kind: 'pipe' },   // Era IV: right outlet to the spire exciter (P4)
    ],
    effects: [],
  },
  pressureGauge: {
    id: 'pressureGauge', techId: 'boiler', minLevel: 1,
    assetId: 'machine.gauge', attach: { socket: 'gaugeSeat', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 24 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  // Gauge needle: a frames sheet of 25 needle angles, not rotated; the low-pass reads the thermal driver (PR/s).
  gaugeNeedle: {
    id: 'gaugeNeedle', techId: 'boiler', minLevel: 1,
    assetId: 'machine.gaugeNeedle', attach: { socket: 'gaugeSeat', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 24 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'gauge', driver: 'thermal', frames: 25, minLog: 0, maxLog: 5, tauSeconds: 0.6 },
    connections: [],
    effects: [],
  },
  // Firebox glow: three frames sheets stacked by tech level (1 / 10 / 20); each later stage covers the lower one.
  fireboxGlow1: {
    id: 'fireboxGlow1', techId: 'firebox', minLevel: 1,
    assetId: 'machine.fireGlow1', attach: { socket: 'fireDoor', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 24 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'thermal' },
    connections: [],
    effects: [],
  },
  fireboxGlow2: {
    id: 'fireboxGlow2', techId: 'firebox', minLevel: 10,
    assetId: 'machine.fireGlow2', attach: { socket: 'fireDoor', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 24 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'thermal' },
    connections: [],
    effects: [],
  },
  fireboxGlow3: {
    id: 'fireboxGlow3', techId: 'firebox', minLevel: 20,
    assetId: 'machine.fireGlow3', attach: { socket: 'fireDoor', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 24 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 4,
    animation: { kind: 'frames', frames: 4, maxHz: 3, driver: 'thermal' },
    connections: [],
    effects: [],
  },
  // Induction heater: a cable tie to the motor retrofit kit (C1 link); static.
  inductionHeater: {
    id: 'inductionHeater', techId: 'inductionHeater', minLevel: 1,
    assetId: 'machine.inductionHeater', attach: { socket: 'heaterSeat', offset: { x: 0, y: 0 } },
    size: { width: 56, height: 40 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 5,
    animation: { kind: 'none' },
    connections: [{ id: 'tie', at: { x: 25, y: -38 }, kind: 'cable' }],
    effects: [],
  },
  superheater: {
    id: 'superheater', techId: 'superheater', minLevel: 1,
    assetId: 'machine.superheater', attach: { socket: 'superheaterSeat', offset: { x: 0, y: 0 } },
    size: { width: 40, height: 32 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  reliefValves: {
    id: 'reliefValves', techId: 'reliefValves', minLevel: 1,
    assetId: 'machine.reliefValves', attach: { socket: 'reliefSeat', offset: { x: 0, y: 0 } },
    size: { width: 16, height: 24 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  // Steam hammer: the housing with a steam port; the ram below it strikes once per turn of the master angle.
  steamHammer: {
    id: 'steamHammer', techId: 'steamHammer', minLevel: 1,
    assetId: 'machine.steamHammer', attach: { socket: 'hammerBase', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 96 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 1,
    animation: { kind: 'none' },
    connections: [{ id: 'steam', at: { x: 11, y: -79 }, kind: 'pipe' }],
    effects: [],
  },
  // Hammer ram: reciprocates on the master angle (ratio 1, 14 px stroke); sits below the housing (mid, no bias).
  hammerRam: {
    id: 'hammerRam', techId: 'steamHammer', minLevel: 1,
    assetId: 'machine.hammerRam', attach: { socket: 'hammerTup', offset: { x: 0, y: 0 } },
    size: { width: 12, height: 36 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'reciprocate', ratio: 1, strokeArtPx: 14, phaseDeg: 0 },
    connections: [],
    effects: [],
  },
  // Condenser: water return; its condensate port feeds the boiler through pipe W1.
  condenser: {
    id: 'condenser', techId: 'condenser', minLevel: 1,
    assetId: 'machine.condenser', attach: { socket: 'condenserBase', offset: { x: 0, y: 0 } },
    size: { width: 80, height: 24 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'none' },
    connections: [{ id: 'condensate', at: { x: 40, y: -13 }, kind: 'pipe' }],   // hotwell nozzle on the right end cap (cols 78-79, rows -15..-12)
    effects: [],
  },
  // Turbine: steam in from pipe P3, export cable to the pylons. turbine.export is a world-space feed (PYLON_FEEDS), not a link.
  turbine: {
    id: 'turbine', techId: 'turbine', minLevel: 1,
    assetId: 'machine.turbine', attach: { socket: 'turbineBase', offset: { x: 0, y: 0 } },
    size: { width: 80, height: 64 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 1,
    animation: { kind: 'none' },
    connections: [
      { id: 'steam', at: { x: -10, y: -62 }, kind: 'pipe' },
      { id: 'export', at: { x: 28, y: -46 }, kind: 'cable' },
    ],
    effects: [],
  },
  // Turbine rotor: spins from the thermal driver; A1 speed (base 60, gain 1.5) so the rotor always turns while PR flows.
  turbineRotor: {
    id: 'turbineRotor', techId: 'turbine', minLevel: 1,
    assetId: 'machine.turbineRotor', attach: { socket: 'turbineHub', offset: { x: 0, y: 0 } },
    size: { width: 28, height: 28 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'spin', driver: 'thermal', speed: { base: 60, gain: 1.5, min: 0, max: 540 } },
    connections: [],
    effects: [],
  },
  // Era IV: spire tower and exciter (resonatorSpire); the exciter takes steam from pipe P4 at its left port.
  spireTower: {
    id: 'spireTower', techId: 'resonatorSpire', minLevel: 1,
    assetId: 'machine.spireTower', attach: { socket: 'spireBase', offset: { x: 0, y: 0 } },
    size: { width: 80, height: 320 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  spireExciter: {
    id: 'spireExciter', techId: 'resonatorSpire', minLevel: 1,
    assetId: 'machine.spireExciter', attach: { socket: 'spireBase', offset: { x: 0, y: 0 } },
    size: { width: 24, height: 32 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 2,
    animation: { kind: 'none' },
    connections: [{ id: 'steam', at: { x: -12, y: -16 }, kind: 'pipe' }],
    effects: [],
  },
  // Spire wave: the standing-wave rod on the spire rod seat (standingWave); eight frames at up to 12 Hz with RS/s.
  spireWave: {
    id: 'spireWave', techId: 'standingWave', minLevel: 1,
    assetId: 'machine.spireWave', attach: { socket: 'spireRod', offset: { x: 0, y: 0 } },
    size: { width: 16, height: 270 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 1,
    animation: { kind: 'frames', frames: 8, maxHz: 12, driver: 'resonance' },
    connections: [],
    effects: [],
  },
  // Coil rings: each later ring replaces the lower one with a narrower band (harmonicCoil levels 1 / 8 / 16 / 25).
  coilRing1: {
    id: 'coilRing1', techId: 'harmonicCoil', minLevel: 1,
    assetId: 'machine.coilRing1', attach: { socket: 'coilRing1', offset: { x: 0, y: 0 } },
    size: { width: 62, height: 8 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' },
    connections: [],
    effects: [],
  },
  coilRing2: {
    id: 'coilRing2', techId: 'harmonicCoil', minLevel: 8,
    assetId: 'machine.coilRing2', attach: { socket: 'coilRing2', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 8 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' },
    connections: [],
    effects: [],
  },
  coilRing3: {
    id: 'coilRing3', techId: 'harmonicCoil', minLevel: 16,
    assetId: 'machine.coilRing3', attach: { socket: 'coilRing3', offset: { x: 0, y: 0 } },
    size: { width: 36, height: 8 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' },
    connections: [],
    effects: [],
  },
  coilRing4: {
    id: 'coilRing4', techId: 'harmonicCoil', minLevel: 25,
    assetId: 'machine.coilRing4', attach: { socket: 'coilRing4', offset: { x: 0, y: 0 } },
    size: { width: 30, height: 8 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'frames', frames: 4, maxHz: 6, driver: 'resonance' },
    connections: [],
    effects: [],
  },
  // Calliope: three steam whistles on the manifold side of the spire; back layer, behind the machine's mid parts.
  calliope: {
    id: 'calliope', techId: 'pressureResonator', minLevel: 1,
    assetId: 'machine.calliope', attach: { socket: 'calliopeSeat', offset: { x: 0, y: 0 } },
    size: { width: 72, height: 40 }, origin: { x: 0.5, y: 1 },
    layer: 'back', depthBias: 3,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  // Crank servo: a servo base under a driven arm; the arm's pin couples to the hand crank by rod R1 (parallel to the crank).
  servoBase: {
    id: 'servoBase', techId: 'crankServo', minLevel: 1,
    assetId: 'machine.servoBase', attach: { socket: 'servoBase', offset: { x: 0, y: 0 } },
    size: { width: 28, height: 20 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 3,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  servoArm: {
    id: 'servoArm', techId: 'crankServo', minLevel: 1,
    assetId: 'machine.servoArm', attach: { socket: 'servoHub', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 48 }, origin: { x: 0.5, y: 0.5 },
    layer: 'front', depthBias: 3,
    animation: { kind: 'driven', ratio: -1.75, phaseDeg: 0 },
    connections: [{ id: 'pin', at: { x: 0, y: -19 }, kind: 'pin' }],
    effects: [],
  },
  // Koenig fork: a four-frame tuning fork on the fork base, rings with the manual driver (echo crank).
  koenigFork: {
    id: 'koenigFork', techId: 'echoCrank', minLevel: 1,
    assetId: 'machine.koenigFork', attach: { socket: 'forkBase', offset: { x: 0, y: 0 } },
    size: { width: 22, height: 44 }, origin: { x: 0.5, y: 1 },
    layer: 'mid',
    animation: { kind: 'frames', frames: 4, maxHz: 12, driver: 'manual' },
    connections: [],
    effects: [],
  },
  // Emitter dishes: a pair of mirrors (phaseLock); the right dish is the mirrored twin of the left.
  emitterDishL: {
    id: 'emitterDishL', techId: 'phaseLock', minLevel: 1,
    assetId: 'machine.emitterDish', attach: { socket: 'dishL', offset: { x: 0, y: 0 } },
    size: { width: 40, height: 64 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 4,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  emitterDishR: {
    id: 'emitterDishR', techId: 'phaseLock', minLevel: 1,
    assetId: 'machine.emitterDish', attach: { socket: 'dishR', offset: { x: 0, y: 0 } },
    size: { width: 40, height: 64 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 4, flipX: true,
    animation: { kind: 'none' },
    connections: [],
    effects: [],
  },
  // Dish waves draw after the dish: same depth, later id. The right set is the mirrored twin.
  dishWavesL: {
    id: 'dishWavesL', techId: 'phaseLock', minLevel: 1,
    assetId: 'machine.dishWaves', attach: { socket: 'dishWavesL', offset: { x: 0, y: 0 } },
    size: { width: 40, height: 64 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 4,
    animation: { kind: 'frames', frames: 6, maxHz: 8, driver: 'resonance' },
    connections: [],
    effects: [],
  },
  dishWavesR: {
    id: 'dishWavesR', techId: 'phaseLock', minLevel: 1,
    assetId: 'machine.dishWaves', attach: { socket: 'dishWavesR', offset: { x: 0, y: 0 } },
    size: { width: 40, height: 64 }, origin: { x: 0.5, y: 0.5 },
    layer: 'mid', depthBias: 4, flipX: true,
    animation: { kind: 'frames', frames: 6, maxHz: 8, driver: 'resonance' },
    connections: [],
    effects: [],
  },
  // Crystal: quartz in the crown of the spire (crystalLattice); tip -466 inside bounds.
  crystal: {
    id: 'crystal', techId: 'crystalLattice', minLevel: 1,
    assetId: 'machine.crystal', attach: { socket: 'crystalSeat', offset: { x: 0, y: 0 } },
    size: { width: 32, height: 48 }, origin: { x: 0.5, y: 1 },
    layer: 'mid', depthBias: 4,
    animation: { kind: 'frames', frames: 4, maxHz: 4, driver: 'resonance' },
    connections: [],
    effects: [],
  },
};
