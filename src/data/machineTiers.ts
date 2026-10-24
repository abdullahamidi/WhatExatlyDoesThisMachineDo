// Part evolution tiers (WP22, docs/plan/PART_TIERS.md). Pure data: tier thresholds, beat timings and tier text live here.
// Holds the 21 part tracks, the beat FX numbers, debris, colours, tier text and TIER_SWEEP; TIER_HEARTBEAT is the shared MK V clock.

import type { AssetId } from '../assets/assetIds';
import type { MachineComponentId } from './machineComponents';
import type { TechId } from './types';

/** MK V heartbeat: every top-tier lamp pulses on one clock (World scene time). */
export const TIER_HEARTBEAT = { periodMs: 2400 } as const;

/** A static overlay drawn at the host attachment (rotationally symmetric; it never turns with a rotating host). */
export interface TierDecal { id: string; host: MachineComponentId; assetId: AssetId; fromTier: number; depthBias: number }

/** One repeatable part track (PART_TIERS §1.2). Tiers are 1-based: tier k starts at levels[k - 1]. */
export interface PartTierTrack {
  techId: TechId;
  levels: readonly number[];                 // tier k starts at levels[k - 1]; levels[0] = 1; strictly ascending; length 3 or 5
  swaps: readonly MachineComponentId[];      // hosts whose texture follows the tier (same size, origin and frame layout)
  stages?: readonly MachineComponentId[];    // folded-in staged components (PART_TIERS §1.3); each minLevel is a tier threshold
  decals?: readonly TierDecal[];             // rotationally symmetric static overlays
  vibrateAmplitude?: readonly number[];      // per tier, for the vibrate-kind swap hosts
  pulse?: { fromTier: number };              // heartbeat on swap hosts whose asset has a pulse frame
  mounts?: Partial<Record<MachineComponentId, readonly { x: number; y: number }[]>>; // bolt-down spark points, art px from the host origin
}

const TRACKS: PartTierTrack[] = [
  { techId: 'gearRatio', levels: [1, 6, 15], swaps: ['gearLarge', 'mainShaft', 'gearSmall'], decals: [{ id: 'gearRim', host: 'gearLarge', assetId: 'machine.gearRim', fromTier: 3, depthBias: 0.5 }], mounts: { gearLarge: [{ x: -4, y: 0 }, { x: 4, y: 0 }] } },
  { techId: 'flywheel', levels: [1, 4, 10], swaps: ['flywheelPedestal', 'flywheel', 'flywheelPulley', 'crankPulley'], decals: [{ id: 'flywheelRim2', host: 'flywheel', assetId: 'machine.flywheelRim2', fromTier: 2, depthBias: 0.5 }, { id: 'flywheelRim3', host: 'flywheel', assetId: 'machine.flywheelRim3', fromTier: 3, depthBias: 0.6 }], pulse: { fromTier: 3 } },
  { techId: 'motorTuning', levels: [1, 5, 10, 20, 25], swaps: ['wornMotor', 'motorPlinth'], vibrateAmplitude: [1, 1, 1, 1, 0.5], pulse: { fromTier: 5 }, mounts: { wornMotor: [{ x: -10, y: 15 }, { x: 8, y: 15 }] } },
  { techId: 'improvedPistons', levels: [1, 5, 10, 20, 25], swaps: ['pistonArray'], pulse: { fromTier: 5 } },
  { techId: 'copperWinding', levels: [1, 5, 10, 20, 25], swaps: ['coilStage1', 'coilStage3'], stages: ['coilStage1', 'coilStage2', 'coilStage3'], mounts: { coilStage1: [{ x: -14, y: 4 }, { x: 19, y: 4 }], coilStage3: [{ x: -14, y: 4 }, { x: 19, y: 4 }] } },
  { techId: 'motorRetrofit', levels: [1, 4, 8, 13, 18], swaps: ['motorRetrofitKit'], pulse: { fromTier: 5 }, mounts: { motorRetrofitKit: [{ x: -7, y: 6 }, { x: 4, y: 6 }] } },
  { techId: 'transformer', levels: [1, 4, 8, 13, 20], swaps: ['transformer'], pulse: { fromTier: 5 }, mounts: { transformer: [{ x: -17, y: -1 }, { x: 20, y: -1 }] } },
  { techId: 'firebox', levels: [1, 5, 10, 20, 25], swaps: ['fireboxGlow1', 'fireboxGlow3'], stages: ['fireboxGlow1', 'fireboxGlow2', 'fireboxGlow3'], mounts: { fireboxGlow1: [{ x: -2, y: -1 }, { x: 2, y: -1 }], fireboxGlow3: [{ x: -2, y: -1 }, { x: 2, y: -1 }] } },
  { techId: 'inductionHeater', levels: [1, 4, 8, 13, 20], swaps: ['inductionHeater'], pulse: { fromTier: 5 }, mounts: { inductionHeater: [{ x: -15, y: -4 }, { x: 16, y: -4 }] } },
  { techId: 'condenser', levels: [1, 4, 8, 13, 20], swaps: ['condenser'], pulse: { fromTier: 5 }, mounts: { condenser: [{ x: -22, y: -1 }, { x: 21, y: -1 }] } },
  { techId: 'bellowsDrive', levels: [1, 2, 3], swaps: ['bellows'], pulse: { fromTier: 3 }, mounts: { bellows: [{ x: -19, y: -1 }, { x: 5, y: -1 }] } },
  { techId: 'harmonicCoil', levels: [1, 4, 8, 16, 25], swaps: ['coilRing1'], stages: ['coilRing1', 'coilRing2', 'coilRing3', 'coilRing4'] },
  { techId: 'pressureResonator', levels: [1, 4, 8, 13, 18], swaps: ['calliope'], pulse: { fromTier: 5 }, mounts: { calliope: [{ x: -28, y: -1 }, { x: 27, y: -1 }] } },
  { techId: 'crankServo', levels: [1, 4, 7], swaps: ['servoBase', 'servoArm'], pulse: { fromTier: 3 } },
  { techId: 'standingWave', levels: [1, 4, 8, 13, 20], swaps: ['spireWave'], mounts: { spireWave: [{ x: 0, y: -2 }, { x: 0, y: -268 }] } },
  { techId: 'gridExciter', levels: [1, 7, 14], swaps: ['exciterFeed'], pulse: { fromTier: 3 }, mounts: { exciterFeed: [{ x: 2, y: -1 }, { x: 6, y: -1 }] } },
  { techId: 'containmentRing', levels: [1, 4, 8, 16, 25], swaps: [], stages: ['ring1Back', 'ring1Front', 'ring1Bead', 'ring1Bead2', 'ring2Back', 'ring2Front', 'ring2Bead', 'ring3Back', 'ring3Front', 'ring3Bead', 'ring4Back', 'ring4Front', 'ring4Bead'] },
  { techId: 'resonantSiphon', levels: [1, 5, 10], swaps: [], stages: ['siphonTube1L', 'siphonTube1R', 'siphonArcs1', 'siphonTube2L', 'siphonTube2R', 'siphonArcs2', 'siphonTube3L', 'siphonTube3R', 'siphonArcs3'] },
  { techId: 'graviticAnchor', levels: [1, 2, 3], swaps: [], stages: ['anchorGlow1L', 'anchorGlow1R', 'anchorGlow2L', 'anchorGlow2R', 'anchorGlow3L', 'anchorGlow3R'] },
  { techId: 'mainsBackfeed', levels: [1, 4, 7], swaps: ['backfeedTerminal'], pulse: { fromTier: 3 }, mounts: { backfeedTerminal: [{ x: -3, y: 1 }, { x: 3, y: 1 }] } },
  { techId: 'steamLance', levels: [1, 7, 12], swaps: ['steamLance'], pulse: { fromTier: 3 }, mounts: { steamLance: [{ x: -4, y: 1 }, { x: 4, y: 1 }] } },
];

/** The 21 repeatable part tracks in PART_TIERS §1.2 order (horizonField has none). Frozen, with each track frozen. */
export const PART_TIERS: readonly PartTierTrack[] = Object.freeze(TRACKS.map((t) => Object.freeze(t)));

/** Tier marks, MK I (tier 1) to MK V (tier 5). A 3-tier track uses the first three. */
export const TIER_MARKS = ['MK I', 'MK II', 'MK III', 'MK IV', 'MK V'] as const;

/** Tier names of a 5-tier track, in tier order. */
export const TIER_NAMES_5 = ['SALVAGED', 'PATCHED', 'REINFORCED', 'TUNED', 'AS BUILT'] as const;

/** Tier names of a 3-tier track, in tier order (MK I, MK II, MK III). */
export const TIER_NAMES_3 = ['SALVAGED', 'REINFORCED', 'AS BUILT'] as const;

/** Tier text templates: sep joins parts of a line; next = the upcoming mark and its level; top = the top-tier mark and name. */
export const TIER_TEXT = { sep: ' · ', next: '{mark} — {nextMark} AT {level}', top: '{mark} {name}' } as const;

/** Tier-up beat timings (ms unless noted), PART_TIERS §3.1 and WP22 D6/D7. Data only: the AD may tune these in audit. */
export const PART_TIER_FX = {
  beatMs: 900,                          // total beat length; non-blocking
  flashStepMs: 60,                      // each heat-flash step
  swapAtMs: 120,                        // texture swap
  ghostMs: 250,                         // old-shell ghost fade (from swapAtMs)
  ghostScale: 1.12,                     // ghost scale at the end of its fade
  ghostAlpha: 0.55,                     // ghost alpha at the start of its fade (AD5 F4: 0.8 hid the new art through the reveal)
  overlayDepthBias: 0.05,               // beat overlay depth above its host: flash, ghost and shine draw at host.depth + this, so parts in front of the host (pulleys, belts, girders) stay on top (AD5 F1)
  flashAlpha: [0.85, 0.6],              // heat-flash steps, alpha per step
  debrisMs: 500,                        // debris particle life (rust and scale)
  debrisCount: 9,                       // particles per beat
  boltAtMs: [350, 450],                 // bolt-down spark crowns (one per mount point)
  shineMs: [550, 800],                  // shine sweep window
  settleMs: 600,                        // camera settle and bell
  shakeScale: 0.5,                      // settle shake, times the landing amplitude
  reducedFadeMs: 250,                   // reduced motion: crossfade length
  reducedGlintMs: 400,                  // reduced motion: static glint length
  maxBeatsPerRelease: 4,                // burst cap per release (D6)
  maxConcurrentTicks: 3,                // ratchet ticks in flight at once
  pools: { particles: 64, ghosts: 4, flashes: 4, shines: 4 }, // pooled objects (D7); nothing is created per beat
  shineCache: 8,                        // LRU of shine CanvasTextures
  maxStepMs: 100,                       // frame clamp: a longer frame (tab switch, hitch) advances the beats by this much at most
  crownMs: 200,                         // life of one bolt-down crown or torque spark
  crownSpeed: 12,                       // crown pattern speed, straight up and up-left / up-right (art px per second, no gravity)
  mountInsetPx: 4,                      // default mount points: bottom corners inset from the sides (art px, PART_TIERS 3.1)
  mountLiftPx: 1,                       // default mount points: lifted off the bottom edge (art px)
  glintRisePx: 1,                       // reduced motion: the glint pixel above each mount point (art px, PART_TIERS 3.4)
} as const;

/** Debris kind of one tier step: rust (I to II), scale (II to III), spark (III to IV), mote (IV to V). */
export type TierDebrisKind = 'rust' | 'scale' | 'spark' | 'mote';

/** Debris look per step: colours, launch velocity ranges (art px per second), gravity (art px per second squared) and life (ms). */
export const TIER_DEBRIS: Readonly<Record<TierDebrisKind, { colors: readonly number[]; vx: readonly [number, number]; vy: readonly [number, number]; gravity: number; lifeMs: number }>> = {
  rust: { colors: [0x8c4a2a, 0xad6236, 0x6e3a22], vx: [-14, 14], vy: [-16, 6], gravity: 120, lifeMs: 500 },
  scale: { colors: [0x5a5f63, 0x3e4246], vx: [-12, 12], vy: [-12, 6], gravity: 120, lifeMs: 500 },
  spark: { colors: [0xffd27a, 0xf0a848], vx: [-46, 46], vy: [-80, -30], gravity: 40, lifeMs: 300 },
  mote: { colors: [0xffd27a, 0xe8e0cc], vx: [-5, 5], vy: [-26, -12], gravity: 0, lifeMs: 900 },
};

/** Colours of the beat effects: heat flash steps, old-shell ghost, bolt spark, top-tier glint, shine sweep. */
export const TIER_FX_COLORS = { flash: [0xf0a848, 0xffd27a], ghost: 0xc98552, bolt: 0xffd27a, glint: 0xffd27a, shine: [0xffd27a, 0xddc9a3] } as const;

/** Every player-facing string of this file, with the place it lives (textSweep reads it, D11). */
export const TIER_SWEEP: readonly { where: string; text: string }[] = [
  ...TIER_MARKS.map((text, i) => ({ where: `TIER_MARKS.${i}`, text })),
  ...TIER_NAMES_5.map((text, i) => ({ where: `TIER_NAMES_5.${i}`, text })),
  ...TIER_NAMES_3.map((text, i) => ({ where: `TIER_NAMES_3.${i}`, text })),
  { where: 'TIER_TEXT.sep', text: TIER_TEXT.sep },
  { where: 'TIER_TEXT.next', text: TIER_TEXT.next },
  { where: 'TIER_TEXT.top', text: TIER_TEXT.top },
];
