import type { ConnectionPoint, MachineComponentDefinition, SocketId, Vec2 } from '../../data/machineComponents';
import { resolveAttachment } from './machineLayout';

/** Normalise -0 to 0. */
function noNegativeZero(v: number): number {
  return v === 0 ? 0 : v; // -0 === 0 is true, so this returns +0 for both zeros
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

/**
 * Line segments drawn for one link. Shaft and pipe: one straight segment a-b.
 * Belt: two external tangent segments between circles (a, ra) and (b, rb),
 * each tangent point offset along the normal m = k*u +/- s*n, with k = (ra - rb) / d and s = sqrt(1 - k^2).
 * Degenerate belts (d <= |ra - rb|, both radii <= 0, or d = 0) fall back to one straight segment.
 */
export function linkSegments(kind: ConnectionPoint['kind'], a: Vec2, ra: number, b: Vec2, rb: number): Array<[Vec2, Vec2]> {
  if (kind !== 'belt') return [[a, b]];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy); // centre distance
  if (d <= Math.abs(ra - rb) || (ra <= 0 && rb <= 0)) return [[a, b]]; // no external tangent exists
  const ux = dx / d;
  const uy = dy / d; // unit centre-to-centre direction
  const nx = -uy;
  const ny = ux; // unit normal to u
  const k = (ra - rb) / d; // cosine of the normal angle from u
  const s = Math.sqrt(1 - k * k); // sine of the normal angle from u
  const segments: Array<[Vec2, Vec2]> = [];
  for (const sign of [1, -1]) {
    const mx = k * ux + sign * s * nx; // tangent normal x
    const my = k * uy + sign * s * ny; // tangent normal y
    segments.push([
      { x: a.x + ra * mx, y: a.y + ra * my }, // a + ra * m
      { x: b.x + rb * mx, y: b.y + rb * my }, // b + rb * m
    ]);
  }
  return segments;
}
