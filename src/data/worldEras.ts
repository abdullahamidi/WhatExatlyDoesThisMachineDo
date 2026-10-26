// Living world era III-V state tables (WP23b): stage rules, props, environment tuning and loops for eras III to V.
// Why: every threshold and frame of the era arc lives here, so the state maths (worldState) and the renderers read one copy.
// Pure data: no Phaser. A StageRule is met when the tech level >= minLevel (default 1) and, when minTier is set, the part tier >= minTier.
// Loops are one entry per step (LoopFrame, livingWorld.ts); dx is world px. Era V plays locomotion loops reversed; state never reverses.
import type { AssetId } from '../assets/assetIds';
import type { TechId } from './types';
import type { LoopFrame, WorldSheetId } from './livingWorld';
import { WORLD_SHADOWS } from './livingWorld';
import { DEPTH } from './world';
import { PALETTE } from './palette';

export interface StageRule { techId: TechId; minLevel?: number; minTier?: number }

// Era thresholds the state maths (worldState.ts, worldPlacement.ts) reads instead of era literals (R0 / Z5). Eras are 1-5.
export const WORLD_ERA_RULES = {
  // Dog digs (dig loop, hole stages) up to and including this era; era III shakes or sits, era IV sits still, era V roams.
  dogDigMaxEra: 2,
  // The one era the dog sits still (no shake, no roam). Era V roams.
  dogStillEra: 4,
  // Skyline windows follow the keystones (dim with the generator, lit with powerLines) up to and including this era.
  windowsKeystoneMaxEra: 2,
  // Locomotion and idle loops play reversed from this era (era V); state never reverses.
  reverseEra: 5,
  // The girl steps down the front band from this era (one step per met rule, WORLD_GIRL.steps).
  girlStepEra: 5,
  // Chladni rings turn violet from this era.
  chladniVioletEra: 5,
  // Motes orbit in this era without a WORLD_MOTES_BY_ERA row (era I).
  motesOrbitEra: 1,
} as const;

// Steam vents = relief valves owned from era III (Director call): umbrella, hood / palm and dog shake. The fog (booth and Sensor 7) shows in fogEra.
export const WORLD_VENTS = { techId: 'reliefValves', minEra: 3, fogEra: 3 } as const;

// Puddles (era III on): size by condenser part tier, top-down (first match wins). Frame = (size - 1) * sizeStride + look;
// wholeFrame is the restored sky reflection (finale). Puddles reflect grey cloud, never blue (bible §4.2).
// dyWorldPx: feet lowered into the ground strip (AD3d H2, puddle and sprout). glintMs: era III tier-up ripple glint (bible 10).
// ringEra / blackEra: the era the downbeat rings the puddles, and the era they turn black.
export const WORLD_PUDDLE = {
  techId: 'condenser', minEra: 3,
  sizeByTier: [{ minTier: 5, size: 3 }, { minTier: 3, size: 2 }, { minTier: 1, size: 1 }], sizeStride: 3,
  looks: { grey: 0, ring: 1, black: 2 }, wholeFrame: 9,
  dyWorldPx: 10, glintMs: 120, ringEra: 4, blackEra: 5,
} as const;

// Sprout (era III on): white stages 1-4 are frames 0-3; the green bloom is bloomFrame 4 (finale). Stages only grow.
export const WORLD_SPROUT = {
  minEra: 3, bloomFrame: 4,
  stages: [
    { stage: 1, rule: { techId: 'condenser', minLevel: 1 } }, { stage: 2, rule: { techId: 'condenser', minTier: 3 } },
    { stage: 3, rule: { techId: 'nullChamber' } }, { stage: 4, rule: { techId: 'skyAperture' } },
  ] satisfies readonly { stage: number; rule: StageRule }[],
} as const;

// Paper scraps (era III on): firebox tiers burn them away, top-down (first match wins). count = scraps left at that tier; below the last tier all `start` remain.
export const WORLD_SCRAPS = {
  techId: 'firebox', minEra: 3, start: 3,
  burn: [{ minTier: 5, count: 0 }, { minTier: 4, count: 1 }, { minTier: 3, count: 2 }],
} as const;

// Six far-plane windows (DENIZEN_ART §5): breathe in era IV, go dark by stage in era V. Top-down, first match wins; lit = windows lit.
export const WORLD_WINDOWS = {
  total: 6, breatheEra: 4, darkEra: 5,
  stages: [
    { rule: { techId: 'skyAperture' }, lit: 0 }, { rule: { techId: 'horizonField', minLevel: WORLD_SHADOWS.offRule.minLevel }, lit: 1 },
    { rule: { techId: 'lensArray' }, lit: 2 }, { rule: { techId: 'nullChamber' }, lit: 4 },
  ] satisfies readonly { rule: StageRule; lit: number }[],
} as const;

// Street lamp: warm from era III, pulses on the downbeat from era IV, dead at the skyAperture diamond (era V).
export const WORLD_LAMP = { warmFromEra: 3, pulseEra: 4, deadRule: { techId: 'skyAperture' } } as const;

// Sensor 7 (wordless): its LED pulses on the downbeat from era IV.
export const WORLD_SENSOR = { pulseEra: 4 } as const;

// Ash motes around the lamp: orbit, freeze mid-orbit (era IV), fall into the dead lamp (era V).
export const WORLD_MOTES_BY_ERA: Record<2 | 3 | 4 | 5, 'orbit' | 'freeze' | 'fall'> = { 2: 'orbit', 3: 'orbit', 4: 'freeze', 5: 'fall' };

// Chladni nodal rings in the ground dust round the machine base (procedural Graphics). intensity = 0 | 1 | 2 by standingWave tier;
// Rings intensity 1 from standingWave MK I, 2 from MK III, from era IV (AD4 F7 Q6 scale-up; bible 10 named MK III / V).
// ringsByIntensity[intensity] = how many of the rings show. Radii are world px.
export const WORLD_CHLADNI = {
  techId: 'standingWave', minEra: 4,
  intensityByTier: [{ minTier: 3, intensity: 2 }, { minTier: 1, intensity: 1 }], ringsByIntensity: [0, 3, 5],
  rings: [{ rx: 360, ry: 36 }, { rx: 480, ry: 48 }, { rx: 600, ry: 60 }, { rx: 720, ry: 72 }, { rx: 840, ry: 84 }],
  color: PALETTE.sand, violetColor: PALETTE.violetLight, dashPx: 6, gapPx: 6, depthOffset: -2, alpha: 1, centerYOffsetPx: 10,
} as const;

// Virga (era III on): rain streaks that evaporate above the ridge. A tile strip just above the mountains layer (DEPTH.background + 10),
// not a ParallaxBackground layer (EM decision 3): it needs a lifetime PR gate and a fade out in era V. The AD may tune bottomY / alpha.
// frozenEra: the era the streaks freeze (minEra falls, later eras fade).
export const WORLD_VIRGA = {
  assetId: 'bg.virga' satisfies AssetId, scrollFactor: 0.15, bottomY: 1536, depth: DEPTH.background + 10.5,
  alpha: 0.55, minEra: 3, frozenEra: 4, minLifetimePr: 1000000, fadeMs: 1500, frames: { fall: 0, frozen: 1 },
} as const;

// Inspector pages (era IV on): one lifts from the clipboard about every 40 s, rises with the dust and drifts. startOffsetWorldPx: from the feet.
// fadeTail: the last share of the rise that fades the page out.
export const WORLD_PAGES = {
  startEra: 4, everyMs: 40000, riseWorldPx: 140, riseMs: 5000, driftWorldPx: 20, poolSize: 2, startOffsetWorldPx: { x: 8, y: -40 }, fadeTail: 0.2,
} as const;

// The girl. stageByEra indexes stageNames (window, pylon mini, pylon mini near, ground). Cycle 3 and later use the cycle-3 stage.
// The stage is the max of the era stage and the cycle trace stage. Steps (era V) move her feet down the front band, never toward the machine.
// stepMaxWorldPx: the most one committed change may move her down the front band (B-A3); stepDyWorldPx is one step.
export const WORLD_GIRL = {
  stageNames: ['window', 'mini', 'miniNear', 'ground'], stageByEra: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 3 },
  traceStageByCycle: { 2: 1, 3: 3 }, stepDyWorldPx: 8, stepMaxWorldPx: 12,
  steps: [
    { techId: 'nullChamber' }, { techId: 'lensArray' }, { techId: 'horizonField', minLevel: WORLD_SHADOWS.offRule.minLevel },
    { techId: 'skyAperture' }, { techId: 'finalAlignment' },
  ] satisfies readonly StageRule[],
} as const;

// Cycle traces (bible §9.3): derived from the cycle number only. The red ball from cycle 2 at dog x + redBallDxWorldPx
// (22: the ball clears the sitting dog's paws, AD3d H4).
export const WORLD_TRACES = {
  redBallFromCycle: 2, redBallDxWorldPx: 22, clipboardMax: 3, readoutOneFromCycle: 2, crowHighFromCycle: 2,
  // Clipboard overlay per frame: art px from the feet pivot, un-flipped (the flip mirrors x). front, talk, frontUmbrella, talkUmbrella,
  // shield, umbrellaOpen and umbrellaHalf have no overlay (the board is face-on or not drawn). Source: scripts/art/world/README.md (AD3a).
  // WP24 AD1b-1: lookUp holds the board 1 px lower than idleA (top ink row 20); crouch rests it on the raised knee (row 25).
  clipboardOffsetArt: {
    idleA: [5, -21], idleB: [5, -20], walk0: [5, -20], walk1: [5, -21], walk2: [5, -20], walk3: [5, -21], write0: [5, -21], write1: [5, -21],
    glance: [5, -21], pat0: [5, -21], pat1: [5, -21], watch: [4, -21], wave: [4, -20], lookUp: [5, -20], crouch: [5, -15],
  },
} as const;

// Era III-V environment and crow tuning. Art px unless the name says world px.
export const WORLD_ERA_ENV = {
  crowPerchLiftArtPx: 56, crowHoverPx: 2, crowBeatRisePx: 1, crowHighExtraArtPx: 8, accentMs: 250, girlSwayMs: 1200,
  // Era IV ripple: every walker rises this many world px for accentMs on the next downbeat.
  riseWorldPx: 1,
  // Era V ripple: shadows slide this many world px toward the machine centre for shadowSlideMs.
  shadowSlideWorldPx: 4, shadowSlideMs: 500,
  // The era of the downbeat accents (walker accent frame, crow beat rise).
  downbeatEra: 4,
} as const;

// Era V double exposure: one whole-self frame (violet, 15 % alpha) every 30-60 s on a hash schedule. Off under reduced motion.
export const WORLD_DOUBLE_EXPOSURE = { minMs: 30000, maxMs: 60000, holdMs: 120, alpha: 0.15, seed: 4107, targets: ['inspector', 'dog', 'crow', 'girl'] } as const;

export type WorldEraLoopId = 'inspectorVent' | 'dogShake' | 'dogStill' | 'dogRoam' | 'crowPerch' | 'crowStutterV' | 'crowHigh' | 'girlSway' | 'girlStill';
export const WORLD_ERA_LOOP_SHEET: Record<WorldEraLoopId, WorldSheetId> = {
  inspectorVent: 'inspector', dogShake: 'dog', dogStill: 'dog', dogRoam: 'dog', crowPerch: 'crow', crowStutterV: 'crow', crowHigh: 'crow',
  girlSway: 'girl', girlStill: 'girl',
};
// Loops for eras III-V. dogRoam is forward time; era V plays it reversed.
export const WORLD_ERA_LOOPS: Record<WorldEraLoopId, readonly LoopFrame[]> = {
  inspectorVent: [{ frame: 'umbrellaOpen', dx: 0, flip: true }],
  dogShake: [
    { frame: 'sit0', dx: 0 }, { frame: 'sit0', dx: 0 }, { frame: 'sit0', dx: 0 }, { frame: 'sit0', dx: 0 },
    { frame: 'shake0', dx: 0 }, { frame: 'shake1', dx: 0 }, { frame: 'shake0', dx: 0 }, { frame: 'shake1', dx: 0 },
    { frame: 'sit0', dx: 0 }, { frame: 'sit0', dx: 0 }, { frame: 'sit0', dx: 0 }, { frame: 'sit0', dx: 0 },
  ],
  dogStill: [{ frame: 'sit0', dx: 0 }],
  dogRoam: [
    { frame: 'sit0', dx: 0 }, { frame: 'sit1', dx: 0 }, { frame: 'walk0', dx: 4 }, { frame: 'walk1', dx: 8 },
    { frame: 'walk2', dx: 12 }, { frame: 'walk3', dx: 16 }, { frame: 'sit0', dx: 16 }, { frame: 'sit1', dx: 16 },
    { frame: 'walk0', dx: 12 }, { frame: 'walk1', dx: 8 }, { frame: 'walk2', dx: 4 }, { frame: 'walk3', dx: 0 },
  ],
  crowPerch: [
    { frame: 'perch0', dx: 0 }, { frame: 'perch0', dx: 0 }, { frame: 'perch0', dx: 0 }, { frame: 'perch0', dx: 0 },
    { frame: 'perch1', dx: 0 }, { frame: 'perch1', dx: 0 }, { frame: 'perch1', dx: 0 }, { frame: 'perch1', dx: 0 },
  ],
  crowStutterV: [{ frame: 'perch0', dx: 0 }, { frame: 'perch0', dx: 0 }, { frame: 'perch0', dx: 4 }, { frame: 'perch0', dx: 0 }],
  crowHigh: [{ frame: 'fly2', dx: 0 }],
  girlSway: [
    { frame: 'stand0', dx: 0 }, { frame: 'stand0', dx: 0 }, { frame: 'stand0', dx: 0 }, { frame: 'stand0', dx: 0 },
    { frame: 'stand1', dx: 0 }, { frame: 'stand1', dx: 0 }, { frame: 'stand1', dx: 0 }, { frame: 'stand1', dx: 0 },
  ],
  girlStill: [{ frame: 'stand0', dx: 0 }],
};
