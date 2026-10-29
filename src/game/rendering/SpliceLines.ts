// Splice lines and pulses (WP28a T13b1, AD2 F3 / F19): the cable from the machine's base to each woken Splice object (one static Graphics,
// redrawn only when the routes change) and the pulses that run along it (one Graphics, redrawn at most SPLICE_FX.redrawHz). Both sit in the back
// row at SPLICE_LINE_STYLE.depthOffset (on the ground, under the prop feet). The paths come from src/game/math/spliceWorld.ts (linePath), the pulse
// law from the same module (pulseCount, pulseSpeed, pulsePositions) and the level from the caller (reachLevel with REACH_LEVEL).
// Era I: a signal wire on pulley stakes; the pulse is a glint that hops stake to stake. Era II: an insulated cable with a top edge (the drop wire
// too); the pulse is a 2 x 2 art px dot. Reduced motion: no pulses, one steady lit dot per line (era I on its last stake, era II steadyInsetPx
// before the object end), no wake beat. Frozen (photo mode) holds the frame.
// Pool only: one shared scratch array serves every pulse; update paths allocate nothing. Lines copy their routes' point lists when the routes change.
//
// Public API (the director wires it):
//   setRoutes(routes, reduced): the woken lines (route id, path from the machine foot to the object foot, era). Redraws the static lines only
//     when the routes change (id, era or any point); an empty list hides both layers.
//   update(nowMs, level01, frozen, reduced): redraws the pulses at most redrawHz; level01(id) gives the normalized reach level L (0..1). Returns at
//     once while no line is set.
//   beat(id, nowMs): the wake beat, one pulse from the machine to the object over wakeBeatMs (none when reduced or without a line).
//   pulseCount(id): the pulses drawn on the line at the last redraw (0 without a line, or in reduced motion).
//   hasLine(id): whether the id has a line.
//   destroy(): destroys both Graphics.
import type Phaser from 'phaser';
import type { Vec2 } from '../../data/machineComponents';
import { PIXEL_SCALE } from '../../data/world';
import { SPLICE_FX, SPLICE_LINE_STYLE } from '../../data/spliceWorld';
import type { TechId } from '../../data/types';
import { pulseCount, pulsePositions, pulseSpeed } from '../math/spliceWorld';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

/** One woken line: the Splice id, its path (world px, from the machine foot to the object foot) and its era (I or II). */
export interface SpliceRoute { readonly id: TechId; readonly path: readonly Vec2[]; readonly era: 1 | 2 }

const { era1: E1, era2: E2 } = SPLICE_LINE_STYLE;
// Reduced motion's era II steady dot sits E2.steadyInsetPx (world px) before the object end, clear of the object's sprite (AD2 F19).
const { redrawHz, wakeBeatMs, maxDots, maxPulses } = SPLICE_FX;
const REDRAW_MS = 1000 / redrawHz;
const STAKE_W = E1.stakeArt.w * PIXEL_SCALE;
const STAKE_H = E1.stakeArt.h * PIXEL_SCALE;
// Per era: the pulse dot's size and color, and the steady dot's color (era I a glint, era II a socket dot).
const DOT: Record<1 | 2, { readonly w: number; readonly on: number; readonly steady: number }> = {
  1: { w: E1.glintWidthPx, on: E1.glintColor, steady: E1.reducedDotColor },
  2: { w: E2.dotArt * PIXEL_SCALE, on: E2.dotColor, steady: E2.reducedDotColor },
};

type LineMode = 'none' | 'pulse' | 'steady';

// A line in use: its path, its length, its era I stake feet, and its pulse count at the last redraw.
interface Line { readonly id: TechId; readonly era: 1 | 2; readonly path: Vec2[]; readonly len: number; readonly stakes: Vec2[]; count: number }

// Length of a polyline (world px); fewer than two points has no length.
function lengthOf(path: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a !== undefined && b !== undefined) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

// Builds the line of a route. Era I stakes stand every stakeEveryPx along the route, short of its end (pulsePositions gives each point).
function makeLine(route: SpliceRoute): Line {
  const path = route.path.slice();
  const len = lengthOf(path);
  const stakes: Vec2[] = [];
  const at: Vec2[] = [{ x: 0, y: 0 }];
  if (route.era === 1) {
    for (let d = E1.stakeEveryPx; d < len; d += E1.stakeEveryPx) {
      pulsePositions(path, 1, d / len, at);
      const p = at[0];
      if (p !== undefined) stakes.push({ x: p.x, y: p.y });
    }
  }
  return { id: route.id, era: route.era, path, len, stakes, count: 0 };
}

export class SpliceLines {
  private readonly worldRows: WorldRows;
  private readonly lines: Phaser.GameObjects.Graphics;
  private readonly pulses: Phaser.GameObjects.Graphics;
  private readonly scratch: Vec2[] = Array.from({ length: maxPulses }, () => ({ x: 0, y: 0 }));
  private routes: Line[] = [];
  private beatLine: Line | null = null;
  private beatStart = 0;
  private reduced = false;
  private dirty = true;
  private mode: LineMode = 'none';
  private lastDrawMs = 0;

  /** Creates the two Graphics in the back row (depth SPLICE_LINE_STYLE.depthOffset), both hidden until a route is set. */
  constructor(scene: Phaser.Scene, rows: WorldRows) {
    this.worldRows = rows;
    this.lines = scene.add.graphics().setDepth(SPLICE_LINE_STYLE.depthOffset).setVisible(false);
    this.pulses = scene.add.graphics().setDepth(SPLICE_LINE_STYLE.depthOffset).setVisible(false);
    rows.back.add(this.lines);
    rows.back.add(this.pulses);
    sortWorldRows(rows);
  }

  /** Sets the woken lines (see the header). The static lines redraw only when the set changes. */
  setRoutes(routes: readonly SpliceRoute[], reduced: boolean): void {
    if (reduced !== this.reduced) {
      this.reduced = reduced;
      this.dirty = true;
    }
    if (!this.same(routes)) this.rebuild(routes);
    const on = this.routes.length > 0;
    this.lines.setVisible(on);
    this.pulses.setVisible(on);
  }

  /** Redraws the pulses at most REDRAW_MS apart (see the header). Frozen holds the frame. Allocates nothing per frame. */
  update(nowMs: number, level01: (id: TechId) => number, frozen: boolean, reduced: boolean): void {
    if (frozen || this.routes.length === 0) return;
    if (reduced !== this.reduced) {
      this.reduced = reduced;
      this.dirty = true;
      this.beatLine = null;
    }
    if (reduced) {
      if (this.dirty || this.mode !== 'steady') this.drawSteady();
      return;
    }
    if (this.beatLine !== null && nowMs - this.beatStart >= wakeBeatMs) {
      this.beatLine = null;
      this.dirty = true;
    }
    const since = nowMs - this.lastDrawMs;
    if (this.dirty || this.mode !== 'pulse' || !(since >= 0 && since < REDRAW_MS)) this.drawPulses(nowMs, level01);
  }

  /** Starts the wake beat on the line of id. No beat when reduced or without a line. */
  beat(id: TechId, nowMs: number): void {
    const line = this.lineOf(id);
    if (this.reduced || line === undefined) return;
    this.beatLine = line;
    this.beatStart = nowMs;
    this.dirty = true;
  }

  /** The pulses drawn on the line of id at the last redraw (0 without a line). */
  pulseCount(id: TechId): number {
    return this.lineOf(id)?.count ?? 0;
  }

  /** True when the id has a line. */
  hasLine(id: TechId): boolean {
    return this.lineOf(id) !== undefined;
  }

  /** Destroys both Graphics; the row container is the director's. */
  destroy(): void {
    if (this.lines.scene) this.lines.destroy();
    if (this.pulses.scene) this.pulses.destroy();
    this.routes = [];
    this.beatLine = null;
    this.mode = 'none';
  }

  // True when the routes match the lines in use (same ids, eras and points, in order).
  private same(routes: readonly SpliceRoute[]): boolean {
    if (routes.length !== this.routes.length) return false;
    return routes.every((r, i) => {
      const l = this.routes[i];
      return l !== undefined && r.id === l.id && r.era === l.era && r.path.length === l.path.length
        && r.path.every((p, j) => p.x === l.path[j]?.x && p.y === l.path[j]?.y);
    });
  }

  private rebuild(routes: readonly SpliceRoute[]): void {
    this.routes = routes.map(makeLine);
    this.beatLine = null;
    this.dirty = true;
    this.mode = 'none';
    this.drawStatic();
    this.pulses.clear();
    sortWorldRows(this.worldRows);
  }

  // The static lines: era I wire with its stakes (the stake shaft, then its lit top), era II cable with its top edge.
  private drawStatic(): void {
    const g = this.lines;
    g.clear();
    for (const line of this.routes) {
      if (line.path.length < 2) continue;
      if (line.era === 1) {
        g.lineStyle(E1.wireWidthPx, E1.wireColor, 1).strokePoints(line.path);
        for (const p of line.stakes) {
          const x = p.x - STAKE_W / 2;
          g.fillStyle(E1.stakeColor, 1).fillRect(x, p.y - STAKE_H, STAKE_W, STAKE_H);
          g.fillStyle(E1.stakeTopColor, 1).fillRect(x, p.y - STAKE_H, STAKE_W, PIXEL_SCALE);
        }
      } else {
        g.lineStyle(E2.cableWidthPx, E2.cableTopColor, 1).strokePoints(line.path.map((p) => ({ x: p.x, y: p.y - E2.cableWidthPx })));
        g.lineStyle(E2.cableWidthPx, E2.cableColor, 1).strokePoints(line.path);
      }
    }
  }

  // Reduced motion: no pulses, one steady lit dot per line (see the header). A line too short for the inset takes its path start.
  private drawSteady(): void {
    this.pulses.clear();
    for (const line of this.routes) {
      line.count = 0;
      const stake = line.stakes[line.stakes.length - 1];
      if (line.era === 1 && stake !== undefined) {
        this.dot(1, stake.x, stake.y - STAKE_H, true);
      } else if (line.len > 0 && pulsePositions(line.path, 1, Math.max(0, (line.len - E2.steadyInsetPx) / line.len), this.scratch) > 0) {
        const at = this.scratch[0];
        if (at !== undefined) this.dot(line.era, at.x, at.y, true);
      }
    }
    this.mode = 'steady';
    this.dirty = false;
  }

  // The pulses: per line 1 + floor(3L) (1 to 4), at speed 80 + 80L world px/s, at most maxDots in total (one dot is kept for the beat). The
  // wake beat is one more pulse from the machine foot to the object foot over wakeBeatMs.
  private drawPulses(nowMs: number, level01: (id: TechId) => number): void {
    this.pulses.clear();
    this.mode = 'pulse';
    this.dirty = false;
    this.lastDrawMs = nowMs;
    const beat = this.beatLine;
    let budget = maxDots - (beat === null ? 0 : 1);
    for (let k = 0; k < this.routes.length; k++) {
      const line = this.routes[k];
      if (line === undefined) continue;
      const level = level01(line.id);
      const n = Math.min(pulseCount(level), budget);
      line.count = n;
      if (n <= 0 || !(line.len > 0)) continue;
      budget -= n;
      const travel = ((nowMs / 1000) * pulseSpeed(level)) / line.len;
      const drawn = pulsePositions(line.path, n, travel, this.scratch);
      const base = travel - Math.floor(travel);
      for (let j = 0; j < drawn; j++) {
        const at = this.scratch[j];
        if (at !== undefined) this.pulse(line, (base + j / n) % 1, at);
      }
    }
    if (beat !== null) {
      const f = Math.min(1, Math.max(0, (nowMs - this.beatStart) / wakeBeatMs));
      const at = pulsePositions(beat.path, 1, f, this.scratch) > 0 ? this.scratch[0] : undefined;
      if (at !== undefined) this.pulse(beat, f, at);
    }
  }

  // One pulse at fraction f of the line. Era I hops from stake to stake (the glint sits on the last stake the pulse passed);
  // the other pulses draw at `at`, the point pulsePositions gave.
  private pulse(line: Line, f: number, at: Vec2): void {
    const index = Math.min(line.stakes.length - 1, Math.max(0, Math.floor((f * line.len) / E1.stakeEveryPx) - 1));
    const stake = line.era === 1 ? line.stakes[index] : undefined;
    if (stake !== undefined) this.dot(1, stake.x, stake.y - STAKE_H, false);
    else this.dot(line.era, at.x, at.y, false);
  }

  // One dot centered at (x, y), in its era's size and color (steady dots take the reduced color).
  private dot(era: 1 | 2, x: number, y: number, steady: boolean): void {
    const d = DOT[era];
    this.pulses.fillStyle(steady ? d.steady : d.on, 1).fillRect(x - d.w / 2, y - d.w / 2, d.w, d.w);
  }

  private lineOf(id: TechId): Line | undefined {
    for (const line of this.routes) if (line.id === id) return line;
    return undefined;
  }
}
