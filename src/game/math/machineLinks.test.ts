import { describe, it, expect } from 'vitest';
import { MACHINE_COMPONENTS, MACHINE_SOCKETS } from '../../data/machineComponents';
import type { MachineComponentDefinition, SocketId, Vec2 } from '../../data/machineComponents';
import { resolveAttachment } from './machineLayout';
import { connectionOffset, resolveConnectionPoint, linkSegments } from './machineLinks';

const EPS = 1e-6;

/** Literal definition with one test point, mirrored or not. */
function literalDef(flipX: boolean): MachineComponentDefinition {
  return {
    ...MACHINE_COMPONENTS.handCrank,
    flipX,
    connections: [{ id: 'test', at: { x: 6, y: -2 }, kind: 'belt', radius: 4 }],
  };
}

describe('connectionOffset', () => {
  it('mirrors x when flipX is set', () => {
    expect(connectionOffset(literalDef(true), 'test')).toEqual({ x: -6, y: -2 });
  });

  it('keeps x when flipX is not set', () => {
    expect(connectionOffset(literalDef(false), 'test')).toEqual({ x: 6, y: -2 });
  });

  it('returns null for an unknown point id', () => {
    expect(connectionOffset(MACHINE_COMPONENTS.handCrank, 'nope')).toBeNull();
  });
});

describe('resolveConnectionPoint', () => {
  it('equals the attachment plus the point offset for a real definition', () => {
    const def = MACHINE_COMPONENTS.handCrank;
    const off = connectionOffset(def, 'shaft');
    const base = resolveAttachment(def);
    expect(off).not.toBeNull();
    expect(resolveConnectionPoint(def, 'shaft')).toEqual({ x: base.x + (off?.x ?? 0), y: base.y + (off?.y ?? 0) });
  });

  it('honours a custom sockets table', () => {
    const sockets: Record<SocketId, Vec2> = { ...MACHINE_SOCKETS, crankHub: { x: 11, y: 22 } };
    expect(resolveConnectionPoint(literalDef(false), 'test', sockets)).toEqual({ x: 17, y: 20 });
  });

  it('returns null for an unknown point id', () => {
    expect(resolveConnectionPoint(MACHINE_COMPONENTS.handCrank, 'nope')).toBeNull();
  });
});

describe('linkSegments', () => {
  const a: Vec2 = { x: 0, y: 0 };
  const b: Vec2 = { x: 100, y: 0 };

  it('returns one straight segment for shaft and pipe', () => {
    expect(linkSegments('shaft', a, 10, b, 4)).toEqual([[a, b]]);
    expect(linkSegments('pipe', a, 10, b, 4)).toEqual([[a, b]]);
  });

  it('returns two belt segments whose ends lie on the circles', () => {
    const segs = linkSegments('belt', a, 10, b, 4);
    expect(segs).toHaveLength(2);
    for (const [p, q] of segs) {
      expect(Math.abs(Math.hypot(p.x - a.x, p.y - a.y) - 10)).toBeLessThan(EPS);
      expect(Math.abs(Math.hypot(q.x - b.x, q.y - b.y) - 4)).toBeLessThan(EPS);
    }
  });

  it('makes each belt segment tangent to both circles at its ends', () => {
    for (const [p, q] of linkSegments('belt', a, 10, b, 4)) {
      const dirX = q.x - p.x;
      const dirY = q.y - p.y;
      const tangentA = (p.x - a.x) * dirX + (p.y - a.y) * dirY;
      const tangentB = (q.x - b.x) * dirX + (q.y - b.y) * dirY;
      expect(Math.abs(tangentA)).toBeLessThan(EPS);
      expect(Math.abs(tangentB)).toBeLessThan(EPS);
    }
  });

  it('mirrors the two belt segments across the centre line', () => {
    const [first, second] = linkSegments('belt', a, 10, b, 4);
    const p1 = first?.[0];
    const p2 = second?.[0];
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(Math.sign(p1?.y ?? 0)).toBe(-Math.sign(p2?.y ?? 0));
  });

  it('draws parallel segments for equal radii', () => {
    for (const [p, q] of linkSegments('belt', a, 6, { x: 50, y: 30 }, 6)) {
      const segX = q.x - p.x;
      const segY = q.y - p.y;
      const cross = segX * 30 - segY * 50; // cross product with (b - a)
      expect(Math.abs(cross)).toBeLessThan(EPS * 100);
    }
  });

  it('falls back to one segment when one circle contains the other', () => {
    const near: Vec2 = { x: 3, y: 0 };
    expect(linkSegments('belt', a, 10, near, 4)).toEqual([[a, near]]);
  });

  it('falls back to one segment when both radii are zero', () => {
    expect(linkSegments('belt', a, 0, b, 0)).toEqual([[a, b]]);
  });

  it('falls back to one segment for coincident points', () => {
    expect(linkSegments('belt', a, 5, { x: 0, y: 0 }, 5)).toEqual([[a, a]]);
  });
});
