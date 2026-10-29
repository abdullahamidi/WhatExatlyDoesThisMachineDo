// Splice world data (WP28a, AD1 hand-off): the era I-II Splice objects in the living world, their sheet cells, feet and yard
// placements per framing, their lines and pulses, the clock's tick schedule and the payphone's ring. Pure data: no logic lives
// here and no app text (the machine's words are in src/data/ux.ts). Imported only by lazy-chunk modules: the Director chunk
// (SpliceProps, SpliceLines, LivingWorldDirector, WorldProps) and the WorldReach chunk through src/game/math/spliceWorld.ts (PokeLayer).
// Numbers are world px unless the name says art px (PIXEL_SCALE 2 = 2 world px per art px). The placement rules are tested in
// src/game/math/spliceWorld.test.ts (A14).
import type { AssetId } from '../assets/assetIds';
import type { FramingKey } from './livingWorld';

/** The six era I-II Splice objects that stand in the world (the other ten arrive in WP28b). */
export type SpliceObjectId = 'spliceBicycle' | 'spliceOrgan' | 'spliceClock' | 'spliceRadio' | 'splicePayphone' | 'spliceSign';

export interface SpliceSheetDef { assetId: AssetId; cellW: number; cellH: number; cols: number; rows: number; eraRows: boolean }

// Sheets of the Splice objects (AD1 hand-off a). One row, no era rows: the objects are street furniture of the old world.
export const SPLICE_SHEETS = {
  splicesA: { assetId: 'world.splicesA', cellW: 32, cellH: 24, cols: 20, rows: 1, eraRows: false },
} as const satisfies Readonly<Record<string, SpliceSheetDef>>;
export type SpliceSheetKey = keyof typeof SPLICE_SHEETS;

/** Dead, woken loop, whole (postgame) frames of one object in its sheet (cell indexes) and the woken loop rate. */
export interface SpliceFrames { readonly dead: number; readonly woken: readonly number[]; readonly whole: number; readonly fps: number }

/** Feet x in world px and the yard lane: a number N puts the feet at GROUND_Y + N, 'back' at GROUND_Y (the prop row). */
export interface SplicePlacement { readonly x: number; readonly lane: number | 'back' }

/** Art px box inside the sheet cell (origin top-left) and the feet pivot in the same cell. */
export interface SpliceBoxArt { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** The line of one Splice: the machine side it leaves from, an optional riser, and the overhead drop wire (mast top, world px). */
export interface SpliceLineRoute {
  readonly from: 'left' | 'right';
  readonly riser?: number;                                  // a raised socket: the cable climbs this many world px above the ground run (none in WP28a)
  readonly drop?: { readonly x: number; readonly y: number }; // the cable mast top the drop wire hangs from
  readonly dropOn?: readonly FramingKey[];                  // framings where the mast stands (the drop replaces the ground cable there)
}

/** The lit face overlay of the street clock: a cell of the Splice sheet, drawn at the clock foot + offsetWorld. */
export interface SpliceClockLit { readonly sheet: SpliceSheetKey; readonly cell: number; readonly offsetWorld: { readonly x: number; readonly y: number } }

interface SpliceEntryBase {
  readonly bboxArt: SpliceBoxArt;
  readonly footArt: { readonly x: number; readonly y: number };
  readonly placements: Readonly<Partial<Record<FramingKey, SplicePlacement | null>>>;   // null = documented exemption; missing = era not started
  readonly postgame?: SplicePlacement; // feet in the postgame portrait only (lines are hidden there; AD2 R2 F20). The portrait cell holds through the finale film.
  readonly line: SpliceLineRoute;
  readonly perchTop?: { readonly dx: number; readonly dy: number };
}

/** An object with its own art in a Splice sheet. */
export interface SpliceOwnEntry extends SpliceEntryBase {
  readonly sheet: SpliceSheetKey;
  readonly frames: SpliceFrames;
  readonly existing?: undefined;
}

/** An existing prop (the street clock, the payphone) that becomes a Splice target. It draws its own sprite; the clock adds a lit overlay. */
export interface SpliceExistingEntry extends SpliceEntryBase {
  readonly existing: 'clock' | 'payphone';
  readonly clockLit?: SpliceClockLit;
}

export type SpliceWorldEntry = SpliceOwnEntry | SpliceExistingEntry;

// Placement rows (AD1 hand-off c, checked by AD1 against the guard rules, then AD2 F5-F7), one row per object in ROW_FRAMES order. A cell
// is [x, lane] (a placement), null (a documented exemption) or undefined (era not started). The clock and the payphone keep their WP23
// placements (WORLD_PLACEMENTS); their rows here are the same x (tested). The Splice stands only from its era: no e1 cell for the radio,
// the payphone and the sign. The finale frames (portrait, baseL, baseR) take the s15 cell where its x lies in the frame's x-range
// (centerX +- 960 / zoom, WORLD_LAYOUT.framingPoses); elsewhere the cell is null (out of frame).
const BACK = 'back' as const;
const SHEET = 'splicesA' as const;
const FOOT_STD = { x: 16, y: 24 };
const FROM_LEFT: SpliceLineRoute = { from: 'left' };
const FROM_RIGHT: SpliceLineRoute = { from: 'right' };
const ROW_FRAMES: readonly FramingKey[] = ['e1', 's8', 's8w', 's9', 's10', 's11', 's15', 'portrait', 'baseL', 'baseR'];
type RowCell = readonly [number, number | typeof BACK] | null | undefined;

// Expands one row into the placements map, once at load. An undefined cell leaves its framing out of the map.
function expandRow(row: readonly RowCell[]): Partial<Record<FramingKey, SplicePlacement | null>> {
  const out: Partial<Record<FramingKey, SplicePlacement | null>> = {};
  ROW_FRAMES.forEach((framing, i) => {
    const cell = row[i];
    if (cell !== undefined) out[framing] = cell === null ? null : { x: cell[0], lane: cell[1] };
  });
  return out;
}

export const SPLICE_WORLD: Readonly<Partial<Record<SpliceObjectId, SpliceWorldEntry>>> = {
  spliceBicycle: {
    sheet: SHEET,
    frames: { dead: 0, woken: [1, 2, 3], whole: 4, fps: 8 },
    bboxArt: { x: 3, y: 9, w: 26, h: 15 },
    footArt: FOOT_STD,
    placements: expandRow([[2488, 96], null, null, [2924, 130], null, [2960, 130], [3150, BACK], [3150, BACK], null, [3150, BACK]]),
    postgame: { x: 744, lane: 104 },
    line: FROM_RIGHT,
    perchTop: { dx: -5, dy: -26 },
  },
  spliceOrgan: {
    sheet: SHEET,
    frames: { dead: 5, woken: [6, 7, 8, 9], whole: 10, fps: 6 },
    bboxArt: { x: 2, y: 0, w: 27, h: 24 },
    footArt: FOOT_STD,
    placements: expandRow([[1352, 64], [1466, 56], [1510, 56], [1392, 80], null, [712, 72], [718, 56], [718, 56], [718, 56], null]),
    postgame: { x: 810, lane: 100 },
    line: FROM_LEFT,
  },
  spliceClock: {
    existing: 'clock',
    bboxArt: { x: 0, y: 0, w: 16, h: 44 },
    footArt: { x: 8, y: 44 },
    clockLit: { sheet: SHEET, cell: 19, offsetWorld: { x: 0, y: -60 } },
    placements: expandRow([[2516, BACK], [2680, BACK], null, [2900, BACK], null, [2890, BACK], [2890, BACK], [2890, BACK], null, [2890, BACK]]),
    line: FROM_RIGHT,
  },
  spliceRadio: {
    sheet: SHEET,
    frames: { dead: 11, woken: [12, 13], whole: 14, fps: 2 },
    bboxArt: { x: 8, y: 4, w: 16, h: 20 },
    footArt: FOOT_STD,
    placements: expandRow([undefined, null, null, [1530, 104], null, [900, 96], [690, 100], [690, 100], [690, 100], null]),
    line: FROM_LEFT,
  },
  splicePayphone: {
    existing: 'payphone',
    bboxArt: { x: 0, y: 0, w: 28, h: 52 },
    footArt: { x: 14, y: 52 },
    placements: expandRow([undefined, [2604, BACK], [2678, BACK], [2944, BACK], [2858, BACK], [3050, BACK], [3050, BACK], [3050, BACK], null, [3050, BACK]]),
    line: { from: 'right', drop: { x: 2792, y: 1464 }, dropOn: ['s9', 's10', 's11'] },
  },
  spliceSign: {
    sheet: SHEET,
    frames: { dead: 15, woken: [16, 17], whole: 18, fps: 1 },
    bboxArt: { x: 3, y: 2, w: 28, h: 22 },
    footArt: FOOT_STD,
    placements: expandRow([undefined, null, null, [2954, 22], null, [3060, 76], null, null, null, null]),
    line: FROM_RIGHT,
    perchTop: { dx: 18, dy: -44 },
  },
};

// Largest yard lane (world px below GROUND_Y) that keeps a Splice object clear of the HUD buttons at UI 150, when the object's
// box meets the HUD x-range of that framing (AD1 hand-off c; AD2 F6: the measured button tops). A negative lane is above the ground.
// A framing without a limit has no yard placement (the finale frames).
export const SPLICE_YARD_LIMITS: Readonly<Partial<Record<FramingKey, number>>> = {
  e1: 119, s8: -9, s8w: -9, s9: 25, s10: -12, s11: 158, s15: 10,
};

// The HUD-button x range at UI 150 per framing (world px, world.md section 5; AD2 F6 widened the left edge where a button reaches it).
export const SPLICE_HUD_RECT: Readonly<Partial<Record<FramingKey, { readonly min: number; readonly max: number }>>> = {
  e1: { min: 1988, max: 2543 }, s8: { min: 2132, max: 2687 }, s8w: { min: 2170, max: 2735 }, s9: { min: 2269, max: 3023 },
  s10: { min: 2146, max: 2886 }, s11: { min: 2037, max: 3168 }, s15: { min: 2035, max: 3166 },
};

// Line materials and pulse look (AD1 hand-off d, AD2 F3). Era I: signal wire on pulley stakes; era II: insulated cable and the drop wire.
// One art px (2 world px) per line (AD2 F3: the old 1 world px was half an art px).
export const SPLICE_LINE_STYLE = {
  depthOffset: -0.15,                  // back row depth + this: on the ground, under prop feet and behind the yard objects
  groundRunPx: 2,                      // a back-row end runs along GROUND_Y + groundRunPx
  era1: {
    wireColor: 0x7d8286, wireWidthPx: 2,
    stakeColor: 0x3e4246, stakeTopColor: 0x7d8286, stakeArt: { w: 2, h: 3 }, stakeEveryPx: 48,
    glintColor: 0xddc9a3, glintWidthPx: 4,           // the pulse: a glint hopping stake to stake (the 2 x 2 art px stake cap)
    reducedDotColor: 0xddc9a3,                        // reduced motion: a steady lit dot at the object end
    stakeEndInsetPx: 36,                              // no stake within this many world px of the object end, so the last stake (the reduced-motion dot) stands clear of the widest sprite half width (28) (AD2 R2 F22)
  },
  era2: {
    cableColor: 0x2b2e31, cableWidthPx: 2, cableTopColor: 0x5a5f63,
    dotColor: 0xc98552, dotArt: 2, dotPxPerSec: 120, // the pulse: 2 x 2 art px dots (120 px/s is the reference speed at L 0.5)
    reducedDotColor: 0xc98552,                        // reduced motion: a steady socket dot
    steadyInsetPx: 12,                                // reduced motion: that dot sits this far (world px) before the object end, clear of its sprite (AD2 F19)
  },
  drop: {
    color: 0x2b2e31, widthPx: 2,
    sagPx: 8,                                         // catenary sag at mid span
    endDx: -8, endDy: -98,                            // the hood end: object feet + (endDx, endDy)
    segments: 8,                                      // polyline segments of the catenary
  },
} as const;

// Pulses and flashes (P17, C8). Pulse count 1 + floor(pulseLevelSteps x L), speed pulseSpeedBase + pulseSpeedPerLevel x L (world px/s).
export const SPLICE_FX = {
  wakeBeatMs: 600,         // one pulse runs the line from the machine to the object on purchase
  redrawHz: 15,            // the pulse layer redraws at most this often
  maxDots: 24,             // dots in total on screen
  maxFlashHz: 3,           // no flash above this rate (photosensitivity)
  pulseSpeedBase: 80,
  pulseSpeedPerLevel: 80,
  maxPulses: 4,
  pulseLevelSteps: 3,
  loopFpsCap: 8,           // woken loops never run above this rate (each object's own fps applies below it)
  wakeHoldSlackMs: 400,    // a dead frame held for the wake beat is released this long after the beat, if the wake never came
} as const;

// The street clock's tick (C6): a tick every 6-10 s by hash, a 1 px hand steps stepDeg and snaps back after snapBackMs.
// restDeg is the 4:41 minute hand (41 x 6) and never changes.
export const SPLICE_CLOCK = {
  tickEveryMs: [6000, 10000] as const,
  snapBackMs: 250,
  stepDeg: 6,
  restDeg: 41 * 6,
} as const;

// The woken payphone rings once every 60-120 s with nobody on the line (WP28a AD2 F13; the Director reads it when the ring lands).
export const SPLICE_PAYPHONE = { ringMinMs: 60000, ringMaxMs: 120000 } as const;
