// Finale (WP13) data: storyboard timings, camera, restored-world wipe, reveal text and postgame choice.
// Pure data. Every finale number and string lives here (C3); the maths reads it (src/game/math/finale.ts).
import type { AssetId } from '../assets/assetIds';
import type { MachineComponentId } from './machineComponents';
import { PALETTE } from './palette';
import { DEPTH, GROUND_Y } from './world';

/** Restored-world track ids: the 0..1 value that multiplies a parallax layer's alpha (C3 `finale`). */
export type FinaleTrackId = 'sky' | 'glow' | 'mountains' | 'skyline' | 'ground';

/** Timed finale beats fired to the audio / FX layers (C3 FINALE_BEATS). */
export type FinaleBeat = 'swell' | 'calliope' | 'beamWhite' | 'white' | 'windStop' | 'plate' | 'flock' | 'chord';

// World = MACHINE_ANCHOR + PIXEL_SCALE * art (art px, origin = machine base centre). full = whole machine framed, crown = top of the spire.
export const FINALE_VIEWS = { full: { artX: 0, artY: -300, zoom: 0.5 }, crown: { artX: 64, artY: -520, zoom: 1 } } as const;
// Cubic in-out tweens between views. Windows do not overlap.
export const FINALE_CAMERA = [{ atS: 0, durS: 2, to: 'full' }, { atS: 10, durS: 3, to: 'crown' }, { atS: 16, durS: 3, to: 'full' }] as const;
export const FINALE_SHOTS = { s1: 2, s2: 10, s3: 19.3, s4: 49.3 } as const;   // S0 = 0; S5 = choiceStartS() (derived, ART_ERA5 §7)
export const FINALE_HUD = { fadeMs: 1000 } as const;
export const FINALE_CLOCK = { maxFrameMs: 250 } as const;   // finale clock step clamp (tab stalls do not skip beats)
export const FINALE_BOOST = { startS: 2, rampS: 6, releaseS: 49.3, releaseRampS: 4,
  holdFrames: { anchorGlow1L: 2, anchorGlow1R: 2, anchorGlow2L: 2, anchorGlow2R: 2, anchorGlow3L: 2, anchorGlow3R: 2, lensLight: 3 } satisfies Partial<Record<MachineComponentId, number>>,
  calliope: { atS: 4, emitter: 'calliope', count: 6 } } as const;
export const FINALE_BEAM = { whiteAtS: 13, headPxPerS: 900, assetId: 'fx.beamWhite' satisfies AssetId, alpha: 0.85 } as const;
export const FINALE_ECLIPSE = { diamondAtS: 14.5, diamondFrame: 4, restoreAtS: 19.3, stepS: 1.5, steps: [4, 3, 2, 1, 0] } as const;   // after the last step: hidden
export const FINALE_WHITE = { atS: 15, color: PALETTE.steam, peak: 0.85, inMs: 1200, holdMs: 600, outMs: 2500,
  reduced: { peak: 0.5, inMs: 500, outMs: 500 } } as const;                       // ease-out in, linear out; never > 1 fade (no strobe)
export const FINALE_CUT = { fadeMs: 400, colorViolet: PALETTE.dusk1, colorRestored: PALETTE.skyClear1 } as const;   // reduced-motion camera cuts
export const FINALE_TRACKS: Record<FinaleTrackId, { startS: number; durS: number }> =
  { sky: { startS: 19.3, durS: 8 }, glow: { startS: 19.3, durS: 4 }, mountains: { startS: 27.3, durS: 6 }, skyline: { startS: 29.3, durS: 8 },
    ground: { startS: 21.3, durS: 3 } };   // ground = reduced-motion crossfade only
export const FINALE_DUST = { reverseAtS: 19.3, reverseS: 6, speedY: [6, 18] } as const;   // then stopped
export const FINALE_WIPE = { startS: 21.3, pxPerS: 120, bandPx: 16, maxStepPx: 32, stepPx: 4, seed: 41, regrowthLagS: [2, 5, 8] } as const;   // world px; edge 0..16 screen px at the full view (16 read as a ruler edge, in-game review WP13 #6)
export const RESTORED_GROUND = { groundAssetId: 'terrain.groundGreen' satisfies AssetId, groundDepth: DEPTH.ground + 0.5,
  regrowth: [{ assetId: 'bg.regrowth1' }, { assetId: 'bg.regrowth2' }, { assetId: 'bg.regrowth3' }] satisfies readonly { assetId: AssetId }[], regrowthDepth: DEPTH.ground + 2,
  regrowthBottomOffsetPx: 6 } as const;
export const FINALE_PLATE = { atS: 30, puffs: 3 } as const;
export const FINALE_SEEDS = { startS: 25, assetId: 'fx.seed' satisfies AssetId, frames: 4, frequencyMs: 120, postgameRateDiv: 3, lifespanMs: [6000, 12000],
  speedX: [-8, 20], speedY: [-12, -4], depth: DEPTH.dust,
  spawnY: [GROUND_Y - 360, GROUND_Y - 8], alpha: [0.15, 0.9] } as const;   // x band MACHINE_ANCHOR.x ± DUST.spawnHalfWidth; spawnY world [top, bottom] = low over the far fields (pale seeds vanish on the pale lower sky); alpha [end, start] (dust is .35 -> 0: seeds unreadable)
export const FINALE_BIRDS = { firstAtS: 38, assetId: 'fx.bird' satisfies AssetId, size: [3, 6], everyS: [40, 70], speedPx: 70, skyY: [150, 260],
  spacingPx: { x: 14, y: 6 }, flapHz: 3, bobPx: 2, bobHz: 0.5, seed: 43 } as const;   // screen-fixed (sf 0), scale PIXEL_SCALE, enter right
export const FINALE_REVEAL = { startS: 49.3, nameplateFadeMs: 800, nameplateScale: 3, holdS: 1.0, cps: 30, linePauseS: 2.0, panelMaxWidthPx: 560,
  lines: ['PRIMARY FUNCTION: RESTORE', 'Restoration target: world state, prior.', 'Observer count: 1.', 'Operator identity: you.'],
  lastLine: 'Restoration holds while the machine runs.', buttonsDelayS: 0.5 } as const;
export const FINALE_CHOICE = { keep: { label: 'KEEP IT RUNNING', icon: 2 }, cycle: { label: 'BEGIN A NEW CYCLE', icon: 1 },
  skipLabel: 'SKIP', cycleStubReason: 'Cycle 0043 is still calibrating.' } as const;
export const FINALE_BEATS: readonly { id: FinaleBeat; atS: number | 'choice' }[] =
  [{ id: 'swell', atS: 2 }, { id: 'calliope', atS: 4 }, { id: 'beamWhite', atS: 13 }, { id: 'white', atS: 15 }, { id: 'windStop', atS: 19.3 },
    { id: 'plate', atS: 30 }, { id: 'flock', atS: 38 }, { id: 'chord', atS: 'choice' }];
/** Plaque reveal (PLAQUE_LINES row, story.ts) and the xf label once revealed (EM decision 4, `resourceShort`). */
export const REVEALED = { plaque: 'PRIMARY FUNCTION: RESTORE', xf: { name: 'Restoration Flux', short: 'RF' } } as const;
