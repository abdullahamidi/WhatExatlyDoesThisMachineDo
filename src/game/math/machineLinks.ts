import type { MachineComponentDefinition, SocketId, Vec2 } from '../../data/machineComponents';
import { resolveAttachment } from './machineLayout';

/** Circular arc: points = centre + radius * (cos t, sin t), t = startRad + k * sweepRad, k in [0, 1]. */
export interface Arc { centre: Vec2; radius: number; startRad: number; sweepRad: number }

/** Open belt between two pulleys: two straight spans plus the two wrap arcs; length = total belt length. */
export interface BeltPath { spans: [[Vec2, Vec2], [Vec2, Vec2]]; arcs: [Arc, Arc]; length: number }

/** Normalise -0 to 0. */
function noNegativeZero(v: number): number {
  return v === 0 ? 0 : v; // -0 === 0 is true, so this returns +0 for both zeros
}

/** Point p + r * n. */
function offsetPoint(p: Vec2, r: number, n: Vec2): Vec2 {
  return { x: noNegativeZero(p.x + r * n.x), y: noNegativeZero(p.y + r * n.y) }; // p + r * n
}

/** Point on a circle at angle t: centre + radius * (cos t, sin t). */
function pointOnArc(centre: Vec2, radius: number, t: number): Vec2 {
  return { x: noNegativeZero(centre.x + radius * Math.cos(t)), y: noNegativeZero(centre.y + radius * Math.sin(t)) }; // centre + r * (cos t, sin t)
}

/** Euclidean distance between two points. */
function dist(p: Vec2, q: Vec2): number {
  return Math.hypot(q.x - p.x, q.y - p.y); // |q - p|
}

/** Connection point offset from the component pivot: (flipX ? -x : x, y); null when the point id is unknown. */
export function connectionOffset(def: MachineComponentDefinition, pointId: string): Vec2 | null {
  const point = def.connections.find((c) => c.id === pointId);
  if (point === undefined) return null;
  const x = def.flipX === true ? -point.at.x : point.at.x; // mirror x when flipped
  return { x: noNegativeZero(x), y: noNegativeZero(point.at.y) };
}

/** Machine-local art px position of a connection point: attachment + point offset; null when the point id is unknown. */
export function resolveConnectionPoint(
  def: MachineComponentDefinition,
  pointId: string,
  sockets?: Record<SocketId, Vec2>,
): Vec2 | null {
  const off = connectionOffset(def, pointId);
  if (off === null) return null;
  const base = resolveAttachment(def, sockets); // pivot position
  return { x: base.x + off.x, y: base.y + off.y }; // pivot + offset
}

/** Rotation by deg (clockwise on screen) of p about the origin: exact 0 / +-1 sin and cos at multiples of 90 deg. */
export function rotatePoint(p: Vec2, deg: number): Vec2 {
  if (!Number.isFinite(deg) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    return { x: noNegativeZero(p.x), y: noNegativeZero(p.y) }; // unrotated
  }
  const d = ((deg % 360) + 360) % 360; // [0, 360)
  let c: number; // cos
  let s: number; // sin
  if (d % 90 === 0) {
    const quarter = d / 90; // 0..3
    c = quarter === 0 ? 1 : quarter === 2 ? -1 : 0; // exact cos at quarter turns
    s = quarter === 1 ? 1 : quarter === 3 ? -1 : 0; // exact sin at quarter turns
  } else {
    c = Math.cos((d * Math.PI) / 180);
    s = Math.sin((d * Math.PI) / 180);
  }
  return { x: noNegativeZero(p.x * c - p.y * s), y: noNegativeZero(p.x * s + p.y * c) }; // x' = x c - y s, y' = x s + y c
}

/** End of a pin-to-pin rod: attach + rotatePoint(pinAt, deg). */
export function pinEnd(attach: Vec2, pinAt: Vec2, deg: number): Vec2 {
  const r = rotatePoint(pinAt, deg); // pin offset after the rotation
  return { x: noNegativeZero(attach.x + r.x), y: noNegativeZero(attach.y + r.y) };
}

/**
 * Open belt around two pulleys (a, ra) and (b, rb) with external tangents.
 * d = |b - a|; phi = atan2(b - a); beta = asin((ra - rb) / d) (signed).
 * tp = phi + PI/2 - beta, tm = phi - PI/2 + beta; spans on the +tp and +tm normals.
 * arc on a sweeps PI + 2 beta, arc on b sweeps PI - 2 beta. null for degenerate input.
 */
export function beltPath(a: Vec2, ra: number, b: Vec2, rb: number): BeltPath | null {
  if (![a.x, a.y, b.x, b.y, ra, rb].every((v) => Number.isFinite(v))) return null;
  if (ra <= 0 || rb <= 0) return null;
  const dx = b.x - a.x; // centre-to-centre vector
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy); // centre distance
  if (d === 0 || d <= Math.abs(ra - rb)) return null; // coincident or one circle contains the other
  const phi = Math.atan2(dy, dx); // direction from a to b
  const beta = Math.asin((ra - rb) / d); // signed tilt of the external tangents
  const tp = phi + Math.PI / 2 - beta; // normal angle of the first tangent
  const tm = phi - Math.PI / 2 + beta; // normal angle of the second tangent
  const mp = { x: Math.cos(tp), y: Math.sin(tp) }; // unit normal tp
  const mm = { x: Math.cos(tm), y: Math.sin(tm) }; // unit normal tm
  const sweep0 = Math.PI + 2 * beta; // wrap angle on a
  const sweep1 = Math.PI - 2 * beta; // wrap angle on b
  const spans: [[Vec2, Vec2], [Vec2, Vec2]] = [
    [offsetPoint(a, ra, mp), offsetPoint(b, rb, mp)],
    [offsetPoint(a, ra, mm), offsetPoint(b, rb, mm)],
  ];
  const arcs: [Arc, Arc] = [
    { centre: { x: noNegativeZero(a.x), y: noNegativeZero(a.y) }, radius: ra, startRad: tp, sweepRad: sweep0 },
    { centre: { x: noNegativeZero(b.x), y: noNegativeZero(b.y) }, radius: rb, startRad: tm, sweepRad: sweep1 },
  ];
  const length = dist(spans[0][0], spans[0][1]) + dist(spans[1][0], spans[1][1]) + ra * sweep0 + rb * sweep1; // spans + arcs
  return { spans, arcs, length };
}

/** Bresenham line between round(p) and round(q), both ends included, ordered p -> q; [] for non-finite input. */
export function rasterLine(p: Vec2, q: Vec2): Vec2[] {
  if (![p.x, p.y, q.x, q.y].every((v) => Number.isFinite(v))) return [];
  let x0 = Math.round(p.x); // start pixel
  let y0 = Math.round(p.y);
  const x1 = Math.round(q.x); // end pixel
  const y1 = Math.round(q.y);
  const dx = Math.abs(x1 - x0); // horizontal extent
  const sx = x0 < x1 ? 1 : -1; // horizontal step
  const dy = -Math.abs(y1 - y0); // negated vertical extent
  const sy = y0 < y1 ? 1 : -1; // vertical step
  let err = dx + dy; // Bresenham error term
  const out: Vec2[] = [];
  for (;;) {
    out.push({ x: noNegativeZero(x0), y: noNegativeZero(y0) });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy; // step in x
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx; // step in y
      y0 += sy;
    }
  }
  return out;
}

/** Sagging cable from a to b: samples y(t) = a.y + (b.y - a.y) t + 4 sag t (1 - t) once per integer x, joined with rasterLine. */
export function rasterCable(a: Vec2, b: Vec2, sag: number): Vec2[] {
  if (![a.x, a.y, b.x, b.y, sag].every((v) => Number.isFinite(v))) return [];
  const pa: Vec2 = { x: noNegativeZero(Math.round(a.x)), y: noNegativeZero(Math.round(a.y)) }; // start pixel
  const pb: Vec2 = { x: noNegativeZero(Math.round(b.x)), y: noNegativeZero(Math.round(b.y)) }; // end pixel
  if (a.x === b.x || pa.x === pb.x) return rasterLine(a, b); // vertical cable: plain line
  const step = pb.x > pa.x ? 1 : -1; // walk x from a towards b
  const out: Vec2[] = [pa];
  let prev = pa;
  for (let x = pa.x + step; ; x += step) {
    const isEnd = x === pb.x;
    let p: Vec2;
    if (isEnd) {
      p = pb; // exact end pixel
    } else {
      const t = (x - a.x) / (b.x - a.x); // curve parameter at this column
      const y = a.y + (b.y - a.y) * t + 4 * sag * t * (1 - t); // sagging curve
      p = { x: noNegativeZero(x), y: noNegativeZero(Math.round(y)) };
    }
    for (const q of rasterLine(prev, p).slice(1)) out.push(q); // first point is prev, already emitted
    prev = p;
    if (isEnd) break;
  }
  return out;
}

/**
 * Bounded least-recently-used map keyed by string. get() and set() both make the key the newest; set() past capacity
 * evicts the oldest key. Values are stored as given (no copy), so a hit returns the same object.
 */
export class LruCache<V> {
  private readonly entries = new Map<string, V>(); // Map keeps insertion order: first key is the oldest
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Number.isFinite(capacity) ? Math.max(0, Math.floor(capacity)) : 0; // non-finite: caching off
  }

  /** Stored value for key, or undefined; a hit becomes the newest entry. */
  get(key: string): V | undefined {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key) as V; // present: checked above
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  /** Stores value under key as the newest entry, then evicts the oldest entries past capacity. */
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  /** Number of stored entries. */
  get size(): number {
    return this.entries.size;
  }

  /** True when key is stored; does not change recency. */
  has(key: string): boolean {
    return this.entries.has(key);
  }
}

/** Pixels of an arc: n = max(1, ceil(|sweep| * radius / 0.5)) samples, rounded, consecutive duplicates dropped. */
export function rasterArc(arc: Arc): Vec2[] {
  const { centre, radius, startRad, sweepRad } = arc;
  const n = Math.max(1, Math.ceil((Math.abs(sweepRad) * radius) / 0.5)); // about two samples per px of arc
  if (!Number.isFinite(n)) return [];
  const out: Vec2[] = [];
  let last: Vec2 | undefined; // previous emitted pixel
  for (let k = 0; k <= n; k++) {
    const t = startRad + (sweepRad * k) / n; // sample angle
    const p = pointOnArc(centre, radius, t);
    const x = noNegativeZero(Math.round(p.x));
    const y = noNegativeZero(Math.round(p.y));
    if (last !== undefined && last.x === x && last.y === y) continue; // drop consecutive duplicate
    last = { x, y };
    out.push(last);
  }
  return out;
}

/** Removes repeated pixels, keeping the first occurrence and the order. */
function dedupePixels(points: readonly Vec2[]): Vec2[] {
  const seen = new Set<string>();
  const out: Vec2[] = [];
  for (const p of points) {
    const key = `${p.x},${p.y}`; // pixel key
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** One ordered closed pixel loop: span0, reversed arc1, span1 reversed, reversed arc0; duplicates removed. */
export function rasterBeltLoop(path: BeltPath): Vec2[] {
  const [s0, s1] = path.spans;
  const [arc0, arc1] = path.arcs;
  const raw = [
    ...rasterLine(s0[0], s0[1]), // span on the first tangent
    ...rasterArc(arc1).reverse(), // wrap around b
    ...rasterLine(s1[1], s1[0]), // span on the second tangent, back to a
    ...rasterArc(arc0).reverse(), // wrap around a
  ];
  return dedupePixels(raw);
}

/** Inner loop (pulley radii + 1) and outer loop (pulley radii + 2) of a belt; null when the belt is degenerate. */
export function rasterBelt(a: Vec2, ra: number, b: Vec2, rb: number): { inner: Vec2[]; outer: Vec2[] } | null {
  const innerPath = beltPath(a, ra + 1, b, rb + 1); // belt inside edge
  const outerPath = beltPath(a, ra + 2, b, rb + 2); // belt outside edge
  if (innerPath === null || outerPath === null) return null;
  return { inner: rasterBeltLoop(innerPath), outer: rasterBeltLoop(outerPath) };
}

/** Copies of loop points at indices shift, shift + spacing, ... with shift = floor(offset) mod spacing; spacing < 1 or empty loop gives []. */
export function pointsAlongBelt(loop: readonly Vec2[], spacing: number, offset: number): Vec2[] {
  if (!Number.isFinite(spacing) || !(spacing >= 1) || loop.length === 0) return [];
  const step = Math.floor(spacing); // whole-index spacing
  const base = Number.isFinite(offset) ? Math.floor(offset) : 0; // whole-index offset
  const shift = ((base % step) + step) % step; // offset wrapped into [0, step)
  const out: Vec2[] = [];
  for (let i = shift; i < loop.length; i += step) {
    const p = loop[i];
    if (p !== undefined) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** Signed belt travel along the loop order: -ratio * (masterDeg in rad) * radius; non-finite gives 0. */
export function beltTravel(masterDeg: number, ratio: number, radius: number): number {
  const travel = -ratio * ((masterDeg * Math.PI) / 180) * radius; // -ratio * theta * radius
  return Number.isFinite(travel) ? noNegativeZero(travel) : 0;
}

/** Horizontal runs of integer pixels: per row sorted by x, consecutive x merged into {x, y, w, h: 1}. */
export function coalesceRuns(points: readonly Vec2[]): Array<{ x: number; y: number; w: number; h: number }> {
  const rows = new Map<number, number[]>(); // y -> xs
  for (const p of points) {
    const xs = rows.get(p.y);
    if (xs === undefined) rows.set(p.y, [p.x]);
    else xs.push(p.x);
  }
  const ys = [...rows.keys()].sort((u, v) => u - v); // rows top to bottom
  const runs: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (const y of ys) {
    const xs = (rows.get(y) ?? []).slice().sort((u, v) => u - v); // x ascending
    let runStart: number | undefined; // first x of the open run
    let prev: number | undefined; // last x seen in this row
    for (const x of xs) {
      if (prev !== undefined && x === prev) continue; // duplicate pixel, already covered
      if (runStart === undefined || prev === undefined || x !== prev + 1) {
        if (runStart !== undefined && prev !== undefined) {
          runs.push({ x: noNegativeZero(runStart), y: noNegativeZero(y), w: prev - runStart + 1, h: 1 });
        }
        runStart = x;
      }
      prev = x;
    }
    if (runStart !== undefined && prev !== undefined) {
      runs.push({ x: noNegativeZero(runStart), y: noNegativeZero(y), w: prev - runStart + 1, h: 1 });
    }
  }
  return runs;
}

/** Pipe look: bore profile colours (top to bottom or left to right), two flange rows, flange spacing and fitting colours. */
export interface PipeStyleLike {
  prof: readonly number[];
  flange: readonly (readonly number[])[];
  flangeEvery: number;
  fitting: { ink: number; hi: number; mid: number; lo: number };
}

/** One solid colour rectangle of a pipe in machine-local art px; w and h >= 1. */
export interface PipeRect {
  color: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Flange offsets along a segment of length len: 0, len - 2, then multiples of flangeEvery below len - 4; negative marks dropped. */
function flangeMarks(len: number, flangeEvery: number): number[] {
  const marks = [0, len - 2]; // ends of the segment
  if (flangeEvery >= 1) {
    for (let m = flangeEvery; m < len - 4; m += flangeEvery) marks.push(m); // python range(flangeEvery, L - 4, flangeEvery)
  }
  return marks.filter((m) => m >= 0);
}

/** Colour of a pixel in the (n + 2)^2 fitting block: ink on the border, then hi / mid / lo by the i + j diagonal. */
function fittingColor(style: PipeStyleLike, col: number, row: number, side: number): number {
  if (col === 0 || row === 0 || col === side - 1 || row === side - 1) return style.fitting.ink; // border
  if (col + row <= Math.floor(side / 2) + 1) return style.fitting.hi; // upper-left highlight
  if (col + row < side) return style.fitting.mid; // body shade
  return style.fitting.lo; // far corner
}

/**
 * Pixel rectangles of an orthogonal pipe through machine-local corner points (port of scripts/art/era3/mock3.py pipe()).
 * Per axis-aligned segment: a bore body of n = prof.length px centred on the line (h = floor(n / 2)), then flange pairs
 * at the flangeMarks. After all segments: an (n + 2)^2 fitting block at every interior point.
 * Identical neighbours are skipped; a non-axis-aligned pair throws. Output is draw order: later rects overwrite earlier ones.
 */
export function rasterPipe(points: readonly Vec2[], style: PipeStyleLike): PipeRect[] {
  if (points.length < 2) return [];
  const n = style.prof.length; // bore width in px
  const h = Math.floor(n / 2); // half bore, centred on the corner line
  const out: PipeRect[] = [];
  const put = (color: number, x: number, y: number, w: number, rh: number): void => {
    out.push({ color, x: noNegativeZero(x), y: noNegativeZero(y), w, h: rh }); // push order = draw order
  };
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    if (p0 === undefined || p1 === undefined) continue; // index is in range
    if (p0.x === p1.x && p0.y === p1.y) continue; // repeated corner
    if (p0.y === p1.y) {
      const lo = Math.min(p0.x, p1.x); // left end
      const len = Math.abs(p1.x - p0.x); // segment length
      style.prof.forEach((color, j) => put(color, lo, p0.y - h + j, len, 1)); // bore rows
      for (const m of flangeMarks(len, style.flangeEvery)) {
        for (let k = 0; k < 2; k++) {
          const row = style.flange[k];
          if (row === undefined) continue;
          row.forEach((color, j) => put(color, lo + m + k, p0.y - h - 1 + j, 1, 1)); // flange pair, one column each
        }
      }
    } else if (p0.x === p1.x) {
      const lo = Math.min(p0.y, p1.y); // top end
      const len = Math.abs(p1.y - p0.y); // segment length
      style.prof.forEach((color, j) => put(color, p0.x - h + j, lo, 1, len)); // bore columns
      for (const m of flangeMarks(len, style.flangeEvery)) {
        for (let k = 0; k < 2; k++) {
          const row = style.flange[k];
          if (row === undefined) continue;
          row.forEach((color, j) => put(color, p0.x - h - 1 + j, lo + m + k, 1, 1)); // flange pair, one row each
        }
      }
    } else {
      throw new Error('rasterPipe: segment must be axis-aligned');
    }
  }
  const side = n + 2; // fitting block side
  for (let i = 1; i < points.length - 1; i++) {
    const c = points[i];
    if (c === undefined) continue; // index is in range
    for (let row = 0; row < side; row++) {
      for (let col = 0; col < side; col++) {
        put(fittingColor(style, col, row, side), c.x - h - 1 + col, c.y - h - 1 + row, 1, 1); // interior corner fitting
      }
    }
  }
  return out;
}
