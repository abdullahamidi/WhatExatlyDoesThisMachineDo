// WP28b (D6): the machine's reach effects, read by the WorldReach chunk only (ReachFx, math/worldReach.ts). The numbers are the plan's;
// AD4 tunes them here (data only). Art px unless a name says world px. The rate range REACH_LEVEL and the ground numbers that the Director
// reads too are in ./worldShared; the world props' effects (lamp, hum, pebbles, puddles) are in ./worldFx.
// Depths: groundPulse, groundWave and drift = DEPTH.ground + depthOffset; baseDust = DEPTH.machine + depthOffset; arc and debris = DEPTH.machine
// + depthOffset (above the machine's props, under the dust); pylon dots = the pylonsLit layer depth + PYLON_LINE.depthOffset + depthOffset.
// Colours follow C8 (era-mapped accents, no blue or green). maxFlashHz is the photosensitivity cap: every flash kind waits FLASH_GAP_MS
// between its starts (src/game/math/worldReach.ts), and a crank pulse waits PULSE_GAP_MS.
import { GROUND_PULSE_SPEED_PX_PER_S, GROUND_WAVE_SHARED } from './worldShared';

export const REACH_FX = {
  maxFlashHz: 3,
  groundPulse: { minGapMs: 250, speedPxPerS: GROUND_PULSE_SPEED_PX_PER_S, lifeMs: 600, alphaFrom: 0.7, alphaTo: 0, dashArtPx: 8, thicknessArtPx: 1, depthOffset: 4 },
  groundWave: { minGapMs: GROUND_WAVE_SHARED.minGapMs, speedPxPerS: GROUND_WAVE_SHARED.speedPxPerS, bumpArtPx: 2, alpha: 0.55, dustMotes: 6, depthOffset: 4 },
  baseDust: { specks: 8, sizeArtPx: 1, hopArtPx: [1, 3], maxHopsPerS: 2, color: 0xa8957a, chanceFrom: 0.15, chanceTo: 0.9, depthOffset: -0.5 },
  // levelSteps: dots = 1 + floor(levelSteps x L). Its own key (not SPLICE_FX.pulseLevelSteps) so tuning the reach does not move the Splice pulses.
  pylonPulse: { feeds: 2, maxDots: 4, levelSteps: 3, pxPerS: 120, dotArtPx: 2, depthOffset: 0.01 },
  dustLaw: { baseMs: 250, perLog: 0.25, floorMs: 120, updateHz: 2 },
  arc: { era: 2, lengthArtPx: [3, 6], lifeMs: 90, core: 0xddc9a3, tip: 0xc98552, rate: { base: 0.2, perLog: 0.25, min: 0.2, max: 1.5 }, siteCount: 4, depthOffset: 5 },
  drift: { era: 3, maxAlive: 5, lifeMs: [9000, 14000], speedPxPerS: [12, 30], risePx: [10, 30], alphaFrom: 0.45, alphaTo: 0, depthOffset: 4,
    rate: { base: 0.1, perLog: 0.08, min: 0.1, max: 0.4 }, emitters: ['chimney', 'relief'] },
  debris: { era: 5, specks: [6, 10], riseArtPx: [8, 32], riseMs: [3000, 6000], bobPx: 1, bobHz: 0.5, color: 0x5f5244, rim: 0x9a6ad0, depthOffset: 5 },
  // colors.ground (F38, AD4): the crank pulse's dash and the wave's front take the era's ground colour. The cream of eras I, II and V fades on
  // the sand of eras III-IV, so those two read the gold instead.
  colors: {
    pylonDot: { 1: 0xc98552, 2: 0xc98552, 3: 0xffd27a, 4: 0xffd27a, 5: 0xddc9a3 },
    ground: { 1: 0xddc9a3, 2: 0xddc9a3, 3: 0xffd27a, 4: 0xffd27a, 5: 0xddc9a3 },
  },
} as const;
