// Splice lines and pulses (WP28a T13b1, AD2 F3 / F19; WP28b D6 a and eras III-V): the line from the machine's base to each woken Splice object.
// The static Graphics (the lines) holds what does not move: the era I wire with its stakes, the era II cable and the era III pipe with its
// collars; it is redrawn only when the routes change. The pulses Graphics holds everything that moves (the pulses, the era IV standing wave and
// the era V debris specks) and is redrawn at most SPLICE_FX.redrawHz. Both sit in the back row at SPLICE_LINE_STYLE.depthOffset (on the ground,
// under the prop feet). The paths come from src/game/math/spliceWorld.ts (linePath), the pulse law from the same module (pulseCount, pulseSpeed,
// pulsePositions) and the level from the caller (reachLevel with REACH_LEVEL).
// Era I: a signal wire on pulley stakes; the pulse is a glint that hops stake to stake. Its stakes stop stakeEndInsetPx short of the object end
// and every line longer than that keeps at least one stake (AD2 R2 F22 regression fix). Era II: an insulated cable with a top edge (the drop wire
// too); the pulse is a 2 x 2 art px dot. Era III: an iron pipe with collars; a pulse puffs a 1-frame wisp at the collar it passes. Era IV: a taut
// wire drawn as a standing wave (its amplitude follows L, its antinodes breathe with the era IV beat); the pulse is a glint riding the wire. Era
// V: lifted debris specks; a pulse lifts the speck it passes and it settles back. Reduced motion: no pulses; one steady lit dot per line in eras
// I-II (era II at steadyDotPhase, clear of the object, F23); era III the pipe alone; era IV a flat wire; era V specks at their hover height; no
// wake beat. Frozen (photo mode) holds the frame.
// Pool only: one shared scratch array serves every pulse; update paths allocate nothing. Lines copy their routes' point lists when the routes change.
//
// Public API (the director wires it):
//   setRoutes(routes, reduced): the woken lines (route id, path from the machine foot to the object foot, era, machine side). Redraws the static
//     lines only when the routes change (id, era or any point); an empty list hides both layers.
//   update(nowMs, level01, frozen, reduced): redraws the pulses at most redrawHz; level01(id) gives the normalized reach level L (0..1). Returns at
//     once while no line is set.
//   beat(id, nowMs): the wake beat, one pulse from the machine to the object over wakeBeatMs (none when reduced or without a line).
//   crankPulse(nowMs, machineLeftX, machineRightX): the crank's ground pulse reaches each woken line's foot after crankPulseDelayMs of the
//     machine edge on its side; it starts one extra pulse on that line, from the foot back to the machine (one pending per line; none when
//     reduced or frozen).
//   pulseCount(id): the pulses drawn on the line at the last redraw (0 without a line, or in reduced motion).
//   hasLine(id): whether the id has a line.
//   destroy(): destroys both Graphics.
import type Phaser from 'phaser';
import type { Vec2 } from '../../data/machineComponents';
import { PIXEL_SCALE } from '../../data/world';
import { SPLICE_FX, SPLICE_LINE_STYLE } from '../../data/spliceWorld';
import type { TechId } from '../../data/types';
import {
  allocatePulses, crankPulseDelayMs, debrisSpeckCount, debrisSpecks, flangeDistances, pathLength, pulseCount, pulsePositions, pulseSpeed,
  stakeDistances, steadyDotPhase, waveOffsetPx,
} from '../math/spliceWorld';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

/** One woken line: the Splice id, its path (world px, from the machine foot to the object foot), its era (I-V) and the machine side it leaves. */
export interface SpliceRoute { readonly id: TechId; readonly path: readonly Vec2[]; readonly era: 1 | 2 | 3 | 4 | 5; readonly from: 'left' | 'right' }

type LineEra = 1 | 2 | 3 | 4 | 5;
const { era1: E1, era2: E2, era3: E3, era4: E4, era5: E5 } = SPLICE_LINE_STYLE;
const { redrawHz, wakeBeatMs, maxDots, maxPulses } = SPLICE_FX;
const REDRAW_MS = 1000 / redrawHz;
const STAKE_W = E1.stakeArt.w * PIXEL_SCALE;
const STAKE_H = E1.stakeArt.h * PIXEL_SCALE;
const FLANGE_W = E3.flangeArt.w * PIXEL_SCALE;
const FLANGE_H = E3.flangeArt.h * PIXEL_SCALE;
const SPECK_W = PIXEL_SCALE; // one art px wide; each speck is 2 art px tall (the rim art px on top, then the body)

// Per era with a dot: the pulse dot's size and colour, and the steady dot's colour (era I a glint, era II a socket dot, era III a wisp, era IV a glint).
const DOT: Record<1 | 2 | 3 | 4, { readonly w: number; readonly on: number; readonly steady: number }> = {
  1: { w: E1.glintWidthPx, on: E1.glintColor, steady: E1.reducedDotColor },
  2: { w: E2.dotArt * PIXEL_SCALE, on: E2.dotColor, steady: E2.reducedDotColor },
  3: { w: E3.wispArt.w * PIXEL_SCALE, on: E3.wispColor, steady: E3.wispColor },
  4: { w: E4.glintArt * PIXEL_SCALE, on: E4.glintColor, steady: E4.glintColor },
};

type LineMode = 'none' | 'pulse' | 'steady';

// A line in use: its era, machine side, path and length; its stake feet (era I) or collar feet (era III); its specks (era V, hover applied);
// its wire points (era IV, reused each redraw); the last puff of each collar (era III) and the last pass of each speck (era V); its level and
// pulse count at the last redraw; and its crank pulse, which runs from extraStartMs to extraEndMs (-Infinity: none).
interface Line {
  readonly id: TechId;
  readonly era: LineEra;
  readonly from: 'left' | 'right';
  readonly path: Vec2[];
  readonly len: number;
  readonly stakes: Vec2[];
  readonly specks: Vec2[];
  readonly wave: Vec2[];
  readonly puffMs: number[];
  readonly liftMs: number[];
  level: number;
  count: number;
  extraStartMs: number;
  extraEndMs: number;
}

// A 32-bit hash of a Splice id: the debris seed of its specks (deterministic, the same on every engine).
function seedOf(id: TechId): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

// Distance (world px) a point moving at speedPxPerS covers between two redraws: a pulse is seen within this distance of the point it passes.
function stepPxOf(speedPxPerS: number): number {
  return (speedPxPerS * REDRAW_MS) / 1000;
}

// Builds the line of a route. Era I stakes stand every stakeEveryPx along the route and stop stakeEndInsetPx short of its end (every line longer
// than that keeps one, AD2 R2 F22); era III collars follow the same rule at flangeEveryPx; era V specks come from debrisSpecks. pulsePositions
// gives each point along the route.
function makeLine(route: SpliceRoute): Line {
  const path = route.path.slice();
  const len = pathLength(path);
  const stakes: Vec2[] = [];
  const at: Vec2[] = [{ x: 0, y: 0 }];
  let along: readonly number[] = [];
  if (route.era === 1) along = stakeDistances(len, E1.stakeEveryPx, E1.stakeEndInsetPx);
  else if (route.era === 3) along = flangeDistances(len);
  for (const d of along) {
    pulsePositions(path, 1, d / len, at);
    const p = at[0];
    if (p !== undefined) stakes.push({ x: p.x, y: p.y });
  }
  const specks: Vec2[] = [];
  if (route.era === 5) debrisSpecks(path, debrisSpeckCount(len), seedOf(route.id), specks);
  return {
    id: route.id,
    era: route.era,
    from: route.from,
    path,
    len,
    stakes,
    specks,
    wave: route.era === 4 ? Array.from({ length: E4.waveSegments + 1 }, () => ({ x: 0, y: 0 })) : [],
    puffMs: route.era === 3 ? stakes.map(() => -Infinity) : [],
    liftMs: route.era === 5 ? specks.map(() => -Infinity) : [],
    level: 0,
    count: 0,
    extraStartMs: -Infinity,
    extraEndMs: -Infinity,
  };
}

export class SpliceLines {
  private readonly worldRows: WorldRows;
  private readonly lines: Phaser.GameObjects.Graphics;
  private readonly pulses: Phaser.GameObjects.Graphics;
  private readonly scratch: Vec2[] = Array.from({ length: maxPulses }, () => ({ x: 0, y: 0 }));
  // The dot budget's reused arrays (WP28b F27): each woken line's wanted pulse count and its granted count, in route order.
  private readonly wanted: number[] = [];
  private readonly granted: number[] = [];
  private routes: Line[] = [];
  private beatLine: Line | null = null;
  private beatStart = 0;
  private reduced = false;
  private frozen = false;
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
    this.frozen = frozen;
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

  /** The crank's ground pulse (D6 a): it runs from the machine's base edges at crankPulseSpeedPxPerS and reaches each woken line's foot after
   *  crankPulseDelayMs. The foot starts one extra pulse on its line, back toward the machine over wakeBeatMs. One pending per line; none when
   *  reduced or frozen. */
  crankPulse(nowMs: number, machineLeftX: number, machineRightX: number): void {
    if (this.reduced || this.frozen) return;
    for (const line of this.routes) {
      if (nowMs < line.extraEndMs) continue;
      const foot = line.path[line.path.length - 1];
      if (foot === undefined) continue;
      const edgeX = line.from === 'left' ? machineLeftX : machineRightX;
      line.extraStartMs = nowMs + crankPulseDelayMs(Math.abs(foot.x - edgeX));
      line.extraEndMs = line.extraStartMs + wakeBeatMs;
    }
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

  // The static lines: era I wire with its stakes (the stake shaft, then its lit top), era II cable with its top edge, era III pipe with its
  // collars (the pipe, a 1 art px lit top, then the collars 1 art px proud above and below).
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
      } else if (line.era === 2) {
        g.lineStyle(E2.cableWidthPx, E2.cableTopColor, 1).strokePoints(line.path.map((p) => ({ x: p.x, y: p.y - E2.cableWidthPx })));
        g.lineStyle(E2.cableWidthPx, E2.cableColor, 1).strokePoints(line.path);
      } else if (line.era === 3) {
        g.lineStyle(E3.pipeWidthPx, E3.pipeColor, 1).strokePoints(line.path);
        const lit = (E3.pipeWidthPx - PIXEL_SCALE) / 2;
        g.lineStyle(PIXEL_SCALE, E3.pipeTopColor, 1).strokePoints(line.path.map((p) => ({ x: p.x, y: p.y - lit })));
        for (const p of line.stakes) g.fillStyle(E3.flangeColor, 1).fillRect(p.x - FLANGE_W / 2, p.y - FLANGE_H / 2, FLANGE_W, FLANGE_H);
      }
    }
  }

  // Reduced motion: no pulses (see the header). One steady dot per era I-II line, the era IV flat wire and the era V specks at rest.
  private drawSteady(): void {
    this.pulses.clear();
    for (const line of this.routes) {
      line.count = 0;
      const stake = line.stakes[line.stakes.length - 1];
      if (line.era === 1 && stake !== undefined) this.dot(1, stake.x, stake.y - STAKE_H, true);
      else if (line.era === 1 || line.era === 2) this.steadyDot(line, line.era);
      else if (line.era === 4) this.drawWire(line, 0, 0);
      else if (line.era === 5) this.drawSpecks(line, 0, false);
    }
    this.mode = 'steady';
    this.dirty = false;
  }

  // The reduced steady dot of an era I or II line: steadyDotPhase along it (F23). No dot for a line with no length.
  private steadyDot(line: Line, era: 1 | 2): void {
    if (!(line.len > 0)) return;
    const at = this.pointAt(line.path, steadyDotPhase(line.len, E2.steadyInsetPx));
    if (at !== undefined) this.dot(era, at.x, at.y, true);
  }

  // The pulses: per line 1 + floor(3L) (1 to 4), at speed 80 + 80L world px/s, at most maxDots in total. allocatePulses gives every woken line
  // one dot before any line gets a second (WP28b F27), in route order. A dot is reserved for the wake beat and for each crank pulse in flight,
  // never so many that a woken line is left without its dot. The era IV wire and the era V specks are drawn on every redraw, after the line's
  // pulses (the specks lift).
  private drawPulses(nowMs: number, level01: (id: TechId) => number): void {
    this.pulses.clear();
    this.mode = 'pulse';
    this.dirty = false;
    this.lastDrawMs = nowMs;
    const beat = this.beatLine;
    let reserved = beat === null ? 0 : 1;
    for (const line of this.routes) if (nowMs >= line.extraStartMs && nowMs < line.extraEndMs) reserved += 1;
    reserved = Math.min(reserved, Math.max(0, maxDots - this.routes.length));
    const granted = allocatePulses(this.wantPulses(level01), maxDots - reserved, this.granted);
    let i = 0;
    for (const line of this.routes) {
      const level = line.level;
      if (line.era === 4) this.drawWire(line, nowMs, Math.round(E4.amplitudeArtMax * level) * PIXEL_SCALE);
      const n = granted[i] ?? 0;
      i += 1;
      line.count = n;
      if (n > 0 && line.len > 0) this.drawLinePulses(line, nowMs, level, n);
      if (line.era === 5) this.drawSpecks(line, nowMs, true);
      if (nowMs >= line.extraStartMs && nowMs < line.extraEndMs && line.len > 0) {
        const f = 1 - (nowMs - line.extraStartMs) / wakeBeatMs;
        const at = this.pointAt(line.path, f);
        if (at !== undefined) this.pulse(line, f, at, nowMs, stepPxOf((line.len * 1000) / wakeBeatMs));
      }
    }
    if (beat !== null) {
      const f = Math.min(1, Math.max(0, (nowMs - this.beatStart) / wakeBeatMs));
      const at = this.pointAt(beat.path, f);
      if (at !== undefined) this.pulse(beat, f, at, nowMs, stepPxOf((beat.len * 1000) / wakeBeatMs));
    }
  }

  // Each woken line's level at this redraw (kept on the line for the drawing) and its pulse count, in route order, into the reused wanted array.
  private wantPulses(level01: (id: TechId) => number): number[] {
    const wanted = this.wanted;
    let i = 0;
    for (const line of this.routes) {
      line.level = level01(line.id);
      wanted[i] = pulseCount(line.level);
      i += 1;
    }
    wanted.length = i;
    return wanted;
  }

  // The n pulses of a line at its speed for this level (the travel phase of the frame).
  private drawLinePulses(line: Line, nowMs: number, level: number, n: number): void {
    const speed = pulseSpeed(level);
    const travel = ((nowMs / 1000) * speed) / line.len;
    const drawn = pulsePositions(line.path, n, travel, this.scratch);
    const base = travel - Math.floor(travel);
    const step = stepPxOf(speed);
    for (let j = 0; j < drawn; j++) {
      const at = this.scratch[j];
      if (at !== undefined) this.pulse(line, (base + j / n) % 1, at, nowMs, step);
    }
  }

  // One pulse at fraction f of the line (at: its point). Era I hops from stake to stake (the glint sits on the last stake the pulse passed);
  // era II a dot; era III a wisp at the collar it passes; era IV a glint on the wire at f; era V lifts the speck it passes.
  private pulse(line: Line, f: number, at: Vec2, nowMs: number, stepPx: number): void {
    switch (line.era) {
      case 1: {
        const index = Math.min(line.stakes.length - 1, Math.max(0, Math.floor((f * line.len) / E1.stakeEveryPx) - 1));
        const stake = line.stakes[index];
        if (stake !== undefined) this.dot(1, stake.x, stake.y - STAKE_H, false);
        else this.dot(1, at.x, at.y, false);
        break;
      }
      case 2:
        this.dot(2, at.x, at.y, false);
        break;
      case 3:
        this.puff(line, at, nowMs, stepPx);
        break;
      case 4: {
        const w = line.wave[Math.round(f * E4.waveSegments)];
        if (w !== undefined) this.dot(4, w.x, w.y, false);
        break;
      }
      case 5:
        this.lift(line, at, nowMs, stepPx);
        break;
    }
  }

  // Era III: the collar nearest the pulse, while the pulse is passing it (within one redraw step), puffs a 1-frame wisp, at most once per
  // wispMinGapMs per collar (GAG). The wisp sits wispDyArt art px above the collar centre.
  private puff(line: Line, at: Vec2, nowMs: number, stepPx: number): void {
    let best = -1;
    let bestD = stepPx;
    for (let k = 0; k < line.stakes.length; k++) {
      const c = line.stakes[k];
      if (c === undefined) continue;
      const d = Math.hypot(c.x - at.x, c.y - at.y);
      if (d <= bestD) {
        best = k;
        bestD = d;
      }
    }
    if (best < 0) return;
    if (!(nowMs - (line.puffMs[best] ?? -Infinity) >= E3.wispMinGapMs)) return;
    line.puffMs[best] = nowMs;
    const c = line.stakes[best];
    if (c !== undefined) this.dot(3, c.x, c.y + E3.wispDyArt * PIXEL_SCALE, false);
  }

  // Era V: the speck nearest the pulse, while the pulse is passing it (within one redraw step), is lifted; drawSpecks settles it back.
  private lift(line: Line, at: Vec2, nowMs: number, stepPx: number): void {
    let best = -1;
    let bestD = stepPx;
    for (let k = 0; k < line.specks.length; k++) {
      const s = line.specks[k];
      if (s === undefined) continue;
      const d = Math.abs(s.x - at.x);
      if (d <= bestD) {
        best = k;
        bestD = d;
      }
    }
    if (best >= 0) line.liftMs[best] = nowMs;
  }

  // The era IV wire at nowMs: the path's points, each lifted by the standing wave (waveOffsetPx; ampPx 0 is the flat wire), into the line's reused
  // wave points, then stroked on the pulses layer.
  private drawWire(line: Line, nowMs: number, ampPx: number): void {
    const segs = E4.waveSegments;
    for (let k = 0; k <= segs; k++) {
      const f = Math.min(k / segs, 1 - 1e-9);
      const w = line.wave[k];
      if (w === undefined) continue;
      const p = this.pointAt(line.path, f);
      if (p === undefined) continue;
      w.x = p.x;
      w.y = p.y + waveOffsetPx(nowMs, f * line.len, line.len, E4.waveLoops, ampPx);
    }
    this.pulses.lineStyle(E4.wireWidthPx, E4.wireColor, 1).strokePoints(line.wave);
  }

  // The era V specks at nowMs: each at its hover height, plus (animated) a 1 art px bob up on the half of its cycle, by index, and the lift a pulse
  // gave it (settling over pulseLiftMs). Static draws the specks at their hover height only (reduced motion).
  private drawSpecks(line: Line, nowMs: number, animated: boolean): void {
    for (let k = 0; k < line.specks.length; k++) {
      const s = line.specks[k];
      if (s === undefined) continue;
      let up = 0;
      if (animated) {
        const hz = E5.bobHz[0] + ((k % 3) / 2) * (E5.bobHz[1] - E5.bobHz[0]);
        const bob = Math.sin((2 * Math.PI * hz * nowMs) / 1000 + k) > 0 ? E5.bobArt : 0;
        const settle = Math.max(0, 1 - (nowMs - (line.liftMs[k] ?? -Infinity)) / E5.pulseLiftMs);
        up = (bob + Math.round(E5.pulseLiftArt * settle)) * PIXEL_SCALE;
      }
      this.pulses.fillStyle(E5.speckRimColor, 1).fillRect(s.x - SPECK_W / 2, s.y - up - 2 * PIXEL_SCALE, SPECK_W, PIXEL_SCALE);
      this.pulses.fillStyle(E5.speckColor, 1).fillRect(s.x - SPECK_W / 2, s.y - up - PIXEL_SCALE, SPECK_W, PIXEL_SCALE);
    }
  }

  // The point at fraction f (0..1) of a path, in the shared scratch (undefined for a path with no length). f = 1 is the end (the phase wraps, so
  // it is clamped just under 1).
  private pointAt(path: readonly Vec2[], f: number): Vec2 | undefined {
    return pulsePositions(path, 1, Math.min(f, 1 - 1e-9), this.scratch) > 0 ? this.scratch[0] : undefined;
  }

  // One dot centred at (x, y), in its era's size and colour (steady dots take the reduced colour).
  private dot(era: 1 | 2 | 3 | 4, x: number, y: number, steady: boolean): void {
    const d = DOT[era];
    this.pulses.fillStyle(steady ? d.steady : d.on, 1).fillRect(x - d.w / 2, y - d.w / 2, d.w, d.w);
  }

  private lineOf(id: TechId): Line | undefined {
    for (const line of this.routes) if (line.id === id) return line;
    return undefined;
  }
}
