// Living world day, weather and ambient data (WP24 T2a): the recorded Tuesday (09:00 to 16:41 on the stopped street clock), the light keys,
// the weather per era, the micro-event schedules and the ambient constants (motes, sway, receiver, virga, drip, seeds).
// Why: every number of the day clock and the sky lives here, so the maths (src/game/math/worldDay.ts) and the renderers read one copy.
// Pure data: no Phaser. Minutes are clock minutes since midnight (540 = 09:00, 1001 = 16:41). Ranges are [lo, hi] pairs; the Art Director tunes
// the tint keys and the ranges here, code never repeats them. Micro rows: everyMs = the gap between two events of a kind, holdMs = its hold.
import type { TechId } from './types';
import type { PaletteKey } from './palette';

export type DayEra = 1 | 2 | 3 | 4 | 5;
export interface DayBand { era: DayEra; fromMin: number; toMin: number }
export interface TintKey { min: number; rgb: number }
export type MicroKind = 'hitch' | 'ledBlink' | 'ledDim' | 'lampDip' | 'boothDip' | 'girlWindowDim' | 'clockTwitch' | 'pages';
export interface MicroFlags { hitch: boolean; ledBlink: boolean; ledDim: boolean; lampDip: boolean; boothDip: boolean; girlWindowDim: boolean; clockTwitch: boolean; pageStarts: number }
export interface MicroRow { everyMs: readonly [number, number]; holdMs: readonly [number, number]; eras: readonly DayEra[] }
export interface EraWeather { wind: readonly [number, number]; gusts: boolean; virgaAlpha: readonly [number, number]; virgaSpeed: readonly [number, number] }

// The day clock (D3-D5): bands cover startMin to heldMin with no gap; the finale and the postgame hold heldMin (16:41) and its tint key.
// Eras I-V take the tape from the recorded Tuesday; the era gates are the lifetime milestones read from TECHNOLOGIES at runtime.
export const WORLD_DAY = {
  startMin: 540, heldMin: 1001, demoMaxMin: 780,
  bands: [
    { era: 1, fromMin: 540, toMin: 660 },
    { era: 2, fromMin: 660, toMin: 780 },
    { era: 3, fromMin: 780, toMin: 880 },
    { era: 4, fromMin: 880, toMin: 950 },
    { era: 5, fromMin: 950, toMin: 1001 },
  ] satisfies readonly DayBand[],
  tintKeys: [
    { min: 540, rgb: 0xe6e1d8 },
    { min: 660, rgb: 0xf2eee6 },
    { min: 780, rgb: 0xffffff },
    { min: 880, rgb: 0xeadfcf },
    { min: 950, rgb: 0xe8d2b8 },
    { min: 1001, rgb: 0xdcc3a6 },
  ] satisfies readonly TintKey[],
  frontDarken: 0.96, minBrightness: 0.86,
  lampGain: { fromMin: 880, toMin: 1001, max: 1.5 },
  shadow: { dxMaxPx: 4, widthScaleMax: 1.2 },
  decades: 3, tailDecades: 1, tailShare: 0.15,
  maxRateMinPerS: 2, smoothMs: 20000,
  gates: { 1: 'generatorBlueprint', 2: 'substationBlueprint', 3: 'pressureVesselBlueprint', 4: 'harmonicConvergence', 5: 'finalAlignment' } satisfies Record<DayEra, TechId>,
} as const;

// The weather per era (D6): dry I-II, the front builds in III (vents on), dead calm in IV, still air in V (the dust breathes, no gusts).
// Gusts are three incommensurate sines plus hash events; vent puffs are a world schedule while the vents are on.
export const WORLD_WEATHER = {
  eras: {
    1: { wind: [0.6, 0.6], gusts: true, virgaAlpha: [0.35, 0.35], virgaSpeed: [1, 1] },
    2: { wind: [0.45, 0.45], gusts: true, virgaAlpha: [0.35, 0.35], virgaSpeed: [1, 1] },
    3: { wind: [0.5, 0.9], gusts: true, virgaAlpha: [0.35, 0.7], virgaSpeed: [1, 2] },
    4: { wind: [0, 0], gusts: false, virgaAlpha: [0.7, 0.7], virgaSpeed: [2, 2] },
    5: { wind: [0, 0], gusts: false, virgaAlpha: [0.7, 0.7], virgaSpeed: [2, 2] },
  } satisfies Record<DayEra, EraWeather>,
  windMax: 1.5, windSlewPerS: 0.0167,
  gustSines: [{ periodMs: 17000, amp: 0.3 }, { periodMs: 41000, amp: 0.25 }, { periodMs: 97000, amp: 0.2 }],
  gustEvent: { everyMs: [20000, 60000], lengthMs: [4000, 8000], amp: 0.8 },
  ventPuff: { everyMs: [25000, 60000] },
  dustDrift: { amp: 0.1, periodMs: 97000 },
  labels: { 1: 'dry', 2: 'dry', 3: 'front', 4: 'calm', 5: 'still' },
} as const;

// Ambient constants (D10, D15): motes orbit or drift, the sensor lags the camera, the micro-events dip and blink, sway and receiver,
// virga scroll, the ruffle drip and the seeds (salts of the hash streams). Micro schedules are off under reduced motion except the LED.
export const WORLD_AMBIENT = {
  // driftPeriods: the drift sine runs at this many mote periods (WP24 D10).
  motes: { radiusPx: [10, 18], periodMs: [4500, 8000], driftPx: 3, driftPeriods: 3 },
  sensorLagMs: 250, clockTwitchDeg: 6, crowTipMinGapMs: 2000, dipFactor: 0.6,
  chladniBreathe: { alpha: [0.6, 1], halfMs: [8000, 15000] },
  micro: {
    hitch: { everyMs: [15000, 25000], holdMs: [120, 250], eras: [2] },
    ledBlink: { everyMs: [2500, 6000], holdMs: [120, 200], eras: [1] },
    ledDim: { everyMs: [8000, 20000], holdMs: [400, 900], eras: [2, 3, 5] },
    lampDip: { everyMs: [8000, 30000], holdMs: [150, 400], eras: [1, 2, 3, 4, 5] },
    boothDip: { everyMs: [8000, 30000], holdMs: [150, 400], eras: [1, 2, 3, 4, 5] },
    girlWindowDim: { everyMs: [40000, 90000], holdMs: [5000, 15000], eras: [1] },
    clockTwitch: { everyMs: [45000, 120000], holdMs: [600, 1200], eras: [2, 3, 4, 5] },
    pages: { everyMs: [30000, 60000], holdMs: [0, 0], eras: [4, 5] },
  } satisfies Record<MicroKind, MicroRow>,
  // scrapLiftPhaseRad: the phase shift (radians) of the scrap lift sine against the flutter phase (was RISE_PHASE in WorldProps).
  sway: { sproutPx: 2, scrapLiftPx: 2, scrapDxPx: 2, scrapLiftPhaseRad: 1 },
  receiver: { periodMs: [1500, 3000], maxSteps: 3 },
  virga: { scrollPxPerS: 20, skewPerWind: 0.1 },
  // The drip starts at the crow's edge (AD1b-2), not inside the breast.
  drip: { offsetArt: { x: 7, y: -3 }, sizeArtPx: 1, fallPx: 24, fallMs: 900, paletteKey: 'steam' satisfies PaletteKey },
  // Stream salts. The micro streams are micro + the kind index (0..7): the block must meet none of the other salts (a data test pins it).
  seeds: { micro: 4501, gust: 4403, vent: 4407, motes: 4409 },
} as const;
