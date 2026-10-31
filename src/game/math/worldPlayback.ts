// World playback maths (WP23a): the playback ladder per era (mode, fps, cast alpha, shadow scale), the tape clock that steps the
// loops (crank or fps, with freeze), loop frame (seam, reverse) and sheet column lookups, the window flicker hold, the Sensor 7
// head and downbeat edge and the tally marks on the booth pane. Why: the renderers draw these; the tape
// grammar is one tested rule (bible §3.0, DENIZEN_ART §1.6 and §5), and every number comes from src/data/livingWorld.ts.
// The poke maths (the Sensor 7 pointer head, the clip clock, the crow hop arc and its frames) moved to pokeRender.ts (WP28a r1-FixA).
// Pure: no Phaser, no DOM. Art px unless a name says world px.
import type { TechId } from '../../data/types';
import { WORLD_ENV, WORLD_ERA_ROW, WORLD_ERA_ROW_SHEETS, WORLD_FRAMES, WORLD_MARKS, WORLD_PLAYBACK } from '../../data/livingWorld';
import type { LoopFrame, WorldSheetId } from '../../data/livingWorld';
import type { Rect } from './worldPlacement';

// Playback of the living world's loops. crank: one frame per crank click (before wornMotor); fps2 / fps4 after wornMotor / pistonArray;
// fps8 from era II.
export type PlaybackMode = 'crank' | 'fps2' | 'fps4' | 'fps8';
export type Levels = Readonly<Partial<Record<TechId, number>>>;

// Sheet rows run 0 (era I) to the whole row (restored): the largest row index of the era-row table.
const MAX_ERA_ROW: number = Math.max(...Object.values(WORLD_ERA_ROW));
// Sine hash of two integers in [0, 1): deterministic, no random source (as finale.ts).
function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}
// Non-negative finite number, else 0.
function nonNeg(v: number): number {
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}
// True when the tech has at least one level.
function owned(levels: Levels, tech: TechId): boolean {
  return (levels[tech] ?? 0) >= 1;
}

// Playback mode of the loops: steady fps8 from steadyEra (era II); era I after pistonArray fps4, after wornMotor fps2, else crank.
export function playbackMode(levels: Levels, era: number): PlaybackMode {
  if (era >= WORLD_PLAYBACK.steadyEra) return 'fps8';
  if (owned(levels, WORLD_PLAYBACK.pistonTech)) return 'fps4';
  if (owned(levels, WORLD_PLAYBACK.crankTech)) return 'fps2';
  return 'crank';
}

// Frames per second of a mode (0 for crank: the crank steps the clock).
export function playbackFps(mode: PlaybackMode): number {
  if (mode === 'crank') return 0;
  return WORLD_PLAYBACK.fps[mode];
}

// Base alpha of the cast: full from era II; .85 once wornMotor is owned; .75 before.
export function castAlpha(levels: Levels, era: number): number {
  if (era >= WORLD_PLAYBACK.steadyEra) return WORLD_PLAYBACK.alpha.era2;
  if (owned(levels, WORLD_PLAYBACK.crankTech)) return WORLD_PLAYBACK.alpha.motor;
  return WORLD_PLAYBACK.alpha.crank;
}

// Shadow scale: ghosted (×0.5) in era I, normal from era II.
export function shadowScale(era: number): number {
  return era === 1 ? WORLD_PLAYBACK.shadowScale[1] : WORLD_PLAYBACK.shadowScale[2];
}

export interface TapeClock {
  // Steps the clock. crank: adds whole crank steps, time ignored. fps modes: accrues dtMs at the mode's fps, crank steps ignored.
  // While a freeze runs, the call only consumes freeze time (dtMs) and adds no ticks, crank steps included.
  advance(dtMs: number, mode: PlaybackMode, crankSteps: number): void;
  tick(): number;
  // Freezes the tape for ms. A freeze already running keeps the longer remaining time.
  freeze(ms: number): void;
  frozen(): boolean;
  reset(): void;
}

// The tape clock: whole ticks of the loop playback. Fractional fps time carries over between calls.
export function createTapeClock(): TapeClock {
  let ticks = 0;
  let fraction = 0;
  let freezeLeftMs = 0;
  return {
    advance(dtMs, mode, crankSteps) {
      if (freezeLeftMs > 0) {
        freezeLeftMs = Math.max(0, freezeLeftMs - nonNeg(dtMs));
        return;
      }
      if (mode === 'crank') {
        ticks += Number.isFinite(crankSteps) ? Math.max(0, Math.floor(crankSteps)) : 0;
        return;
      }
      fraction += nonNeg(dtMs) * playbackFps(mode) / 1000;
      const whole = Math.floor(fraction);
      ticks += whole;
      fraction -= whole;
    },
    tick() {
      return ticks;
    },
    freeze(ms) {
      if (ms > 0) freezeLeftMs = Math.max(freezeLeftMs, ms);
    },
    frozen() {
      return freezeLeftMs > 0;
    },
    reset() {
      ticks = 0;
      fraction = 0;
      freezeLeftMs = 0;
    },
  };
}

// Loop frame at a tick (floored, clamped to 0). With seam, one frame is skipped at each wrap: index = (t + floor(t / len)) % len.
// With reverse the index is mirrored inside the loop (len - 1 - index, after the seam), so the loop retraces its path (era V).
export function loopFrameAt(loop: readonly LoopFrame[], tick: number, seam: boolean, reverse = false): LoopFrame {
  const len = loop.length;
  if (len === 0) throw new Error('loopFrameAt: empty loop');
  const t = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const forward = seam ? (t + Math.floor(t / len)) % len : t % len;
  const index = reverse ? len - 1 - forward : forward;
  const frame = loop[index];
  if (frame === undefined) throw new Error(`loopFrameAt: no frame at ${index}`);
  return frame;
}

// Downbeat edge of a low flag (the Sensor 7 LED or a heartbeat): true on the step from low to high, i.e. was low and is not now.
export function isDownbeat(prevLow: boolean, low: boolean): boolean {
  return prevLow && !low;
}

// Column of each frame name in a sheet: the first column of a name (what indexOf finds). Built once from WORLD_FRAMES.
function frameColumns(frames: readonly string[]): Map<string, number> {
  const columns = new Map<string, number>();
  frames.forEach((name, column) => {
    if (!columns.has(name)) columns.set(name, column);
  });
  return columns;
}
// Column maps per sheet and the era-row sheets as a set. sheetFrameIndex runs about a dozen times a frame, so it reads these.
const SHEET_COLUMNS = new Map<WorldSheetId, Map<string, number>>();
for (const sheet of Object.keys(WORLD_FRAMES) as WorldSheetId[]) SHEET_COLUMNS.set(sheet, frameColumns(WORLD_FRAMES[sheet]));
const ERA_ROW_SHEET_SET = new Set<WorldSheetId>(WORLD_ERA_ROW_SHEETS);

// Index of a named frame in a sheet: row × frames per row + column. Era-row sheets take eraRow (floored, clamped to 0..5);
// other sheets are one row (row 0). An unknown frame name throws.
export function sheetFrameIndex(sheet: WorldSheetId, name: string, eraRow: number): number {
  const column = SHEET_COLUMNS.get(sheet)?.get(name);
  if (column === undefined) throw new Error(`sheetFrameIndex: '${name}' is not a frame of '${sheet}'`);
  const frames = WORLD_FRAMES[sheet];
  const want = Number.isNaN(eraRow) ? 0 : Math.floor(eraRow);
  const row = ERA_ROW_SHEET_SET.has(sheet) ? Math.min(MAX_ERA_ROW, Math.max(0, want)) : 0;
  return row * frames.length + column;
}

// Window flicker step k: hold in WORLD_ENV.windowFlickerMs from a sine hash; the frame alternates with k parity.
export function windowFlicker(k: number, seed: number): { holdMs: number; frame: 'flickerA' | 'flickerB' } {
  const [lo, hi] = WORLD_ENV.windowFlickerMs;
  const holdMs = lo + (hi - lo) * hash01(k, seed);
  const parity = ((Math.floor(k) % 2) + 2) % 2;
  return { holdMs, frame: parity === 0 ? 'flickerA' : 'flickerB' };
}

// Sensor 7 head pose from the camera centre x: right of the sensor by more than the range looks right, left by more looks left,
// else centre. Range is WORLD_ENV.sensor7.headRangeWorldPx (edges inclusive for centre).
export function sensorHead(sensorX: number, camCenterX: number): 'headL' | 'headC' | 'headR' {
  const range = WORLD_ENV.sensor7.headRangeWorldPx;
  const d = camCenterX - sensorX;
  if (d > range) return 'headR';
  if (d < -range) return 'headL';
  return 'headC';
}

// Tally marks on the booth pane (art px, 0,0 = pane top-left). Marks 1-4 of a group are vertical strokes spaced strokePitch
// apart, so neighbours never merge. Mark 5 is a slash of three single pixels that sit in the gaps between those strokes.
// Groups run groupCols per row (groupPitch apart); a row of groups steps down strokeH + rowGap. count is clamped to the capacity.
export function tallyRects(count: number): Rect[] {
  const { groupSize, groupCols, rows, strokeH, strokePitch, groupPitch, rowGap, slash } = WORLD_MARKS;
  const capacity = groupCols * rows * groupSize;
  const n = Number.isNaN(count) ? 0 : Math.min(capacity, Math.max(0, Math.floor(count)));
  const out: Rect[] = [];
  for (let m = 0; m < n; m++) {
    const g = Math.floor(m / groupSize);
    const j = m % groupSize;
    const x0 = (g % groupCols) * groupPitch;
    const y0 = Math.floor(g / groupCols) * (strokeH + rowGap);
    if (j < groupSize - 1) {
      out.push({ x: x0 + j * strokePitch, y: y0, w: 1, h: strokeH });
    } else {
      for (const [dx, dy] of slash) out.push({ x: x0 + dx, y: y0 + dy, w: 1, h: 1 });
    }
  }
  return out;
}

// Sensor 7 head (WP28 Sensor 7 follows the cursor): the head shown is one of the three.
export type SensorHead = 'headL' | 'headC' | 'headR';
