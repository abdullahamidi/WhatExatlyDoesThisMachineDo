// Splice world data (WP28a, AD1 hand-off; WP28b, AD3 hand-off O): the sixteen Splice objects in the living world, their sheet cells, feet
// and yard placements per framing, their lines and pulses, the clock's tick schedule and the payphone's ring. Pure data: no logic lives
// here and no app text (the machine's words are in src/data/ux.ts). Imported only by lazy-chunk modules: the Director chunk
// (SpliceProps, SpliceLines, LivingWorldDirector, WorldProps) and the WorldReach chunk through src/game/math/spliceWorld.ts (PokeLayer).
// Numbers are world px unless the name says art px (PIXEL_SCALE 2 = 2 world px per art px). The placement rules are tested in
// src/game/math/spliceWorld.test.ts (A14).
import type { AssetId } from '../assets/assetIds';
import type { FramingKey } from './livingWorld';
import { TIER_HEARTBEAT } from './machineTiers';

/** The sixteen Splice objects: eras I-II (the clock and the payphone are existing props), III-V (the sheets B and C). */
export type SpliceObjectId = 'spliceBicycle' | 'spliceOrgan' | 'spliceClock' | 'spliceRadio' | 'splicePayphone' | 'spliceSign'
  | 'splicePump' | 'spliceWhistle' | 'spliceHydrant' | 'spliceBell' | 'spliceGramophone' | 'spliceChimes' | 'spliceVane' | 'spliceKite'
  | 'spliceCairn' | 'spliceCoinReturn';

export interface SpliceSheetDef { assetId: AssetId; cellW: number; cellH: number; cols: number; rows: number; eraRows: boolean }

// Sheets of the Splice objects (AD1 hand-off a; AD3 hand-off O-a). One row, no era rows: the objects are street furniture.
export const SPLICE_SHEETS = {
  splicesA: { assetId: 'world.splicesA', cellW: 32, cellH: 24, cols: 20, rows: 1, eraRows: false },
  splicesB: { assetId: 'world.splicesB', cellW: 18, cellH: 56, cols: 22, rows: 1, eraRows: false },
  splicesC: { assetId: 'world.splicesC', cellW: 24, cellH: 18, cols: 24, rows: 1, eraRows: false },
} as const satisfies Readonly<Record<string, SpliceSheetDef>>;
export type SpliceSheetKey = keyof typeof SPLICE_SHEETS;

/** Dead, woken loop, whole (postgame) frames of one object in its sheet (cell indexes) and the woken rate. once (vane, kite, cairn): the
 *  woken frames play one after another at fps and the last holds; they never wrap. */
export interface SpliceFrames { readonly dead: number; readonly woken: readonly number[]; readonly whole: number; readonly fps: number; readonly once?: true }

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
  // dx, dy from the placement feet (before offsetWorld); replaces: the CROW_PERCHES entry this top takes over while the object stands (WP28b).
  readonly perchTop?: { readonly dx: number; readonly dy: number; readonly replaces?: 'boothRoof' | 'lampTop' };
}

/** An object with its own art in a Splice sheet. offsetWorld moves the sprite off its feet (the hosted objects: the chimes on the lamp arm,
 *  the kite, the vane and the coin flap on the payphone); the line still ends at the placement feet. */
export interface SpliceOwnEntry extends SpliceEntryBase {
  readonly sheet: SpliceSheetKey;
  readonly frames: SpliceFrames;
  readonly offsetWorld?: { readonly x: number; readonly y: number };
  readonly existing?: undefined;
}

/** An existing prop (the street clock, the payphone) that becomes a Splice target. It draws its own sprite; the clock adds a lit overlay. */
export interface SpliceExistingEntry extends SpliceEntryBase {
  readonly existing: 'clock' | 'payphone';
  readonly clockLit?: SpliceClockLit;
}

export type SpliceWorldEntry = SpliceOwnEntry | SpliceExistingEntry;

// Placement rows (AD1 hand-off c, checked by AD1 against the guard rules, then AD2 F5-F7), one row per object in ROW_FRAMES order from the
// object's first framing (expandRow's from; the framings before it are the era not started). A cell is [x, lane] (a placement) or null (a
// documented exemption). The clock and the payphone keep their WP23
// placements (WORLD_PLACEMENTS); their rows here are the same x (tested). The Splice stands only from its era: no e1 cell for the radio,
// the payphone and the sign. The finale frames (portrait, baseL, baseR) take the s15 cell where its x lies in the frame's x-range
// (centerX +- 960 / zoom, WORLD_LAYOUT.framingPoses); elsewhere the cell is null (out of frame).
// WP28b rows (AD3 hand-off O-c): the era III-V cells stand from their Splice's era (the s11 framing serves eras III-V); a null cell
// keeps its reason as a trailing comment; the hosted objects (chimes, kite, vane, coin flap) sit at the lamp's or the payphone's x.
const BACK = 'back' as const;
const SHEET = 'splicesA' as const;
const SHEET_B = 'splicesB' as const;
const SHEET_C = 'splicesC' as const;
const FOOT_STD = { x: 16, y: 24 };
const FOOT_B = { x: 9, y: 56 };
const FOOT_C = { x: 12, y: 18 };
// Every object of a sheet stands on its sheet's foot (WP28b: the own() builder fills footArt from here).
const FOOT_OF: Readonly<Record<SpliceSheetKey, { readonly x: number; readonly y: number }>> = { splicesA: FOOT_STD, splicesB: FOOT_B, splicesC: FOOT_C };
const FROM_LEFT: SpliceLineRoute = { from: 'left' };
const FROM_RIGHT: SpliceLineRoute = { from: 'right' };
const ROW_FRAMES: readonly FramingKey[] = ['e1', 's8', 's8w', 's9', 's10', 's11', 's15', 'portrait', 'baseL', 'baseR'];
type RowCell = readonly [number, number | typeof BACK] | null;

// Expands one row into the placements map, once at load. The cells run from framing from on, in ROW_FRAMES order; a framing before from is left
// out of the map (its era has not started). WP28b: each row starts where its object does, so the rows carry no leading gaps.
function expandRow(row: readonly RowCell[], from: FramingKey): Partial<Record<FramingKey, SplicePlacement | null>> {
  const out: Partial<Record<FramingKey, SplicePlacement | null>> = {};
  const start = ROW_FRAMES.indexOf(from);
  row.forEach((cell, i) => {
    const framing = ROW_FRAMES[start + i];
    if (framing !== undefined) out[framing] = cell === null ? null : { x: cell[0], lane: cell[1] };
  });
  return out;
}

// The frames of one own-art object (WP28b): dead, the woken loop, whole, fps, and once for the objects that play through (vane, kite, cairn).
const framesOf = (dead: number, woken: readonly number[], whole: number, fps: number, once?: true): SpliceFrames =>
  once === undefined ? { dead, woken, whole, fps } : { dead, woken, whole, fps, once };

// The art box of an own-art object (WP28b): x, y, w, h in art px.
type ArtBox = readonly [number, number, number, number];

// An own-art entry (WP28b): the sheet, its frames, art box and line, its placement cells from framing from (ROW_FRAMES order), and the
// optional keys. The foot comes from the sheet (FOOT_OF); the result is the literal shape of the entry.
const own = (
  sheet: SpliceSheetKey, frames: SpliceFrames, box: ArtBox, line: SpliceLineRoute, from: FramingKey, cells: readonly RowCell[],
  extra: Partial<Pick<SpliceOwnEntry, 'postgame' | 'offsetWorld' | 'perchTop'>> = {},
): SpliceOwnEntry => ({
  sheet,
  frames,
  bboxArt: { x: box[0], y: box[1], w: box[2], h: box[3] },
  footArt: FOOT_OF[sheet],
  line,
  placements: expandRow(cells, from),
  ...extra,
});

// The hosted objects' cells (WP28b, AD3 O-c): the chimes and the kite stand at the lamp's x, the vane and the coin flap at the payphone's x, from
// s11 on. The baseL frame is outside both x (360-2280): a documented exemption.
const hostedRow = (x: number): readonly RowCell[] => [[x, BACK], [x, BACK], [x, BACK], null, [x, BACK]];

export const SPLICE_WORLD: Readonly<Partial<Record<SpliceObjectId, SpliceWorldEntry>>> = {
  spliceBicycle: own(SHEET, framesOf(0, [1, 2, 3], 4, 8), [3, 9, 26, 15], FROM_RIGHT, 'e1', [
    [2488, 96], null, null, [2924, 130], null, [2960, 130], [3150, BACK], [3150, BACK], null, [3150, BACK],
  ], { postgame: { x: 744, lane: 104 }, perchTop: { dx: -5, dy: -26 } }),
  spliceOrgan: own(SHEET, framesOf(5, [6, 7, 8, 9], 10, 6), [2, 0, 27, 24], FROM_LEFT, 'e1', [
    [1352, 64], [1466, 56], [1510, 56], [1392, 80], null, [712, 72], [718, 56], [718, 56], [718, 56], null,
  ], { postgame: { x: 810, lane: 100 } }),
  spliceClock: {
    existing: 'clock',
    bboxArt: { x: 0, y: 0, w: 16, h: 44 },
    footArt: { x: 8, y: 44 },
    clockLit: { sheet: SHEET, cell: 19, offsetWorld: { x: 0, y: -60 } },
    placements: expandRow([[2516, BACK], [2680, BACK], null, [2900, BACK], null, [2890, BACK], [2890, BACK], [2890, BACK], null, [2890, BACK]], 'e1'),
    line: FROM_RIGHT,
  },
  spliceRadio: own(SHEET, framesOf(11, [12, 13], 14, 2), [8, 4, 16, 20], FROM_LEFT, 's8', [
    null, null, [1530, 104], null, [900, 96], [690, 100], [690, 100], [690, 100], null,
  ]),
  splicePayphone: {
    existing: 'payphone',
    bboxArt: { x: 0, y: 0, w: 28, h: 52 },
    footArt: { x: 14, y: 52 },
    placements: expandRow([[2604, BACK], [2678, BACK], [2944, BACK], [2858, BACK], [3050, BACK], [3050, BACK], [3050, BACK], null, [3050, BACK]], 's8'),
    line: { from: 'right', drop: { x: 2792, y: 1464 }, dropOn: ['s9', 's10', 's11'] },
  },
  spliceSign: own(SHEET, framesOf(15, [16, 17], 18, 1), [3, 2, 28, 22], FROM_RIGHT, 's8', [
    null, null, [2954, 22], null, [3060, 76], null, null, null, null,
  ], { perchTop: { dx: 18, dy: -44 } }),
  // Eras III-V (WP28b, AD3 hand-off O-b / O-c / O-d), in table order.
  splicePump: own(SHEET_B, framesOf(0, [3, 1, 2, 1, 2, 1], 4, 4), [1, 26, 17, 30], FROM_LEFT, 's10', [
    null, // s10: the left wing 1226-1278 holds Sensor 7 and the Inspector; no puddle at s10
    [946, BACK], [946, BACK], [946, BACK], [946, BACK],
    null, // baseR: x 946 is outside the baseR frame
  ]),
  // The whistle's box is the union of its cells (the blow plume included).
  spliceWhistle: own(SHEET_B, framesOf(5, [6, 6, 5, 5, 5, 5, 5, 5], 7, 1), [1, 0, 17, 56], FROM_RIGHT, 's10', [
    null, // s10: the right wing 2832-2884 holds the dog, its stake and the booth; the yard is under the UI 150 buttons
    [2970, BACK],
    null, // s15: the right gravitic anchor stands on its s11 spot; the inner gap holds the clock, the dog, the stake and the hole
    null, // portrait: not at s15 (the postgame key places the whole whistle)
    null, // baseL: not at s15
    null, // baseR: not at s15
  ], {
    postgame: { x: 3166, lane: BACK }, // the right back row is free once the bicycle moves left (AD2 F20)
  }),
  spliceHydrant: own(SHEET_C, framesOf(0, [2, 3, 0, 0, 0, 0, 0, 1], 4, 4), [6, 4, 18, 14], FROM_RIGHT, 's10', [
    null, // s10: the right wing 2832-2884 is 52 px; its yard is under the UI 150 buttons (limit -12)
    [3100, 150],
    null, // s15: the right yard is under the UI 150 buttons (+10); the left wing would need its line across the whole front
    null, // portrait: not at s15
    null, // baseL: not at s15
    null, // baseR: not at s15
  ]),
  spliceBell: own(SHEET_B, framesOf(8, [9, 8, 10, 8], 11, 2), [0, 28, 18, 28], FROM_RIGHT, 's11', [
    [3150, 120],
    null, // s15: as the hydrant (the right yard is under the UI 150 buttons; the back row is full)
    null, // portrait: not at s15
    null, // baseL: not at s15
    null, // baseR: not at s15
  ]),
  spliceGramophone: own(SHEET_C, framesOf(5, [6, 7, 8, 6, 7, 9], 10, 6), [1, 0, 18, 18], FROM_LEFT, 's11', [
    [960, 150], [760, 112], [760, 112], [760, 112],
    null, // baseR: x 760 is outside the baseR frame
  ], {
    postgame: { x: 958, lane: 112 }, // the s15 cell (738-774) sits on the postgame bicycle and organ; 958 is the inner gap
  }),
  spliceChimes: own(SHEET_C, framesOf(11, [12, 11, 13, 11], 14, 2), [4, 0, 15, 18], FROM_RIGHT, 's11', hostedRow(3104), {
    offsetWorld: { x: 20, y: -50 }, // hosted on the lamp arm (the lamp's x); the arm is the sheet's rows 0-2
  }),
  spliceVane: own(SHEET_C, framesOf(15, [16, 17, 18], 19, 1, true), [4, 0, 16, 18], FROM_RIGHT, 's11', hostedRow(3050), {
    offsetWorld: { x: 0, y: -102 }, // hosted on the booth apex (the payphone's x)
    perchTop: { dx: 0, dy: -138, replaces: 'boothRoof' },
  }),
  spliceKite: own(SHEET_B, framesOf(12, [13, 14], 15, 1, true), [0, 3, 18, 53], FROM_RIGHT, 's11', hostedRow(3104), {
    offsetWorld: { x: 0, y: -92 }, // hosted above the lamp (the lamp's x)
    perchTop: { dx: 30, dy: -86, replaces: 'lampTop' },
  }),
  spliceCairn: own(SHEET_B, framesOf(16, [17, 18, 19, 20], 21, 0.5, true), [1, 24, 16, 32], FROM_LEFT, 's11', [
    [880, 170], [1014, 104], [1014, 104], [1014, 104],
    null, // baseR: x 1014 is outside the baseR frame
  ]),
  spliceCoinReturn: own(SHEET_C, framesOf(20, [21, 22, 21, 20, 20, 20, 20, 20], 23, 8), [10, 14, 5, 4], FROM_RIGHT, 's11', hostedRow(3050), {
    offsetWorld: { x: 24, y: -46 }, // the flap on the payphone's unit; the payphone's placement x and lane
  }),
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
    steadyInsetPx: 48,                                // reduced motion: that dot sits this far (world px) before the object end, clear of its sprite and the
                                                      // radio crate / sign box (AD2 F19, F23); a line under 96 px takes its midpoint (steadyDotPhase)
  },
  // Eras III-V (WP28b, AD3 hand-off O-d). III: iron pipe on the ground run; the pulse is a wisp puffed at the collar it passes.
  // IV: a taut wire drawn as a standing wave (loops half-waves, nodes at the ends and between them); the antinodes breathe once per
  // TIER_HEARTBEAT period; the pulse is a glint riding the wire. V: no wire, debris specks lifted along the route; a pulse lifts the
  // speck it passes. Reduced motion (the reduced looks): III no wisp (the pipe stays); IV flat wire, no glint; V specks hang still.
  era3: {
    pipeColor: 0x3e4246, pipeTopColor: 0x5a5f63, pipeWidthPx: 4,            // 4 world px: the top art px #5a5f63, the lower #3e4246
    flangeColor: 0x2b2e31, flangeArt: { w: 1, h: 4 }, flangeEveryPx: 32,    // a dark collar, 1 art px proud above and below the pipe
    flangeEndInsetPx: 36,                                                   // no collar within this of the object end (the F22 rule)
    wispColor: 0xddc9a3, wispArt: { w: 2, h: 2 }, wispDyArt: -3,            // the wisp sits 3 art px above the collar centre
    wispMs: 70,                                                             // one 15 Hz redraw
    wispMinGapMs: 334,                                                      // one collar puffs at most 3 times a second (GAG)
    reduced: { wisp: false },
  },
  era4: {
    wireColor: 0xc9b28a, wireWidthPx: 2, waveSegments: 24, waveLoops: 3,   // 3 half-waves: nodes at both ends and at the thirds
    amplitudeArtMax: 2,                                                    // amplitude art px = round(amplitudeArtMax x L): 0, 1 or 2 art px (2 world px each)
    breathPeriodMs: TIER_HEARTBEAT.periodMs,                               // the antinodes breathe once per era IV beat (unison with the walkers)
    redrawHz: 15,                                                          // redraw only when the quantised shape changes, never above 15 Hz
    glintColor: 0xffd27a, glintArt: 1,                                     // the pulse: a 1 art px glint riding the wire (C8 era IV accent)
    reduced: { amplitudeArt: 0, glint: false },
  },
  era5: {
    speckCount: { min: 6, max: 10, everyPx: 32 }, endInsetPx: 12,         // count = clamp(round(len / everyPx), min, max), evenly spaced, ends inset
    speckColor: 0x5f5244, speckRimColor: 0x9a6ad0,                         // 1 x 2 art px: the top art px violetLight, the lower #5f5244
    hoverArt: [2, 6],                                                      // each speck hangs 2-6 art px above the route (a hash of its index)
    bobArt: 1, bobHz: [0.5, 1],                                            // a 1 art px bob at 0.5-1 Hz by index (never below the hover floor)
    pulseLiftArt: 2, pulseLiftMs: 400,                                     // the pulse: the speck it passes lifts 2 more art px, then settles
    reduced: { bobArt: 0, pulseLiftArt: 0 },
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
  // The KEEP IT RUNNING beat (F24, S3): the postgame-moved objects fade out at KEEP + outFromS .. outToS, are hidden to inFromS, and fade in
  // at the postgame feet to inToS (seconds since the KEEP click). The side flips at the middle of the hidden window (reduced: at inFromS).
  postgameMove: { outFromS: 4, outToS: 4.5, inFromS: 5, inToS: 5.6 },
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

// A woken Splice's visit (WP28b F25): the walker whose spot is not clean for the stand (WORLD_VISITS `from`) asks again every retryMs until
// the visit window (WORLD_REACT.visitHoldMs) ends.
export const SPLICE_VISIT = { retryMs: 1000 } as const;
