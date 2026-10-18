import { describe, it, expect } from 'vitest';
import type { MachineComponentDefinition, SocketId, Vec2 } from '../../data/machineComponents';
import {
  connectionOffset,
  resolveConnectionPoint,
  beltPath,
  rasterLine,
  rasterArc,
  rasterBeltLoop,
  rasterBelt,
  rasterCable,
  pointsAlongBelt,
  beltTravel,
  coalesceRuns,
} from './machineLinks';
import type { Arc } from './machineLinks';

const EPS = 1e-9;

/** Literal definition with one belt test point, mirrored or not. Attached to crankHub. */
function literalDef(flipX: boolean): MachineComponentDefinition {
  return {
    id: 'handCrank',
    techId: 'handCrank',
    minLevel: 1,
    assetId: 'machine.crank',
    attach: { socket: 'crankHub', offset: { x: 0, y: 0 } },
    size: { width: 48, height: 48 },
    origin: { x: 0.5, y: 0.5 },
    layer: 'front',
    animation: { kind: 'none' },
    effects: [],
    flipX,
    connections: [{ id: 'test', at: { x: 6, y: -2 }, kind: 'belt', radius: 4 }],
  };
}

/** Point on an arc at fraction k of its sweep. */
function arcPoint(arc: Arc, k: number): Vec2 {
  const t = arc.startRad + arc.sweepRad * k;
  return { x: arc.centre.x + arc.radius * Math.cos(t), y: arc.centre.y + arc.radius * Math.sin(t) };
}

/** Motor belt: motor pulley (r 5) and main shaft pulley (r 10) plus the +1 offset used for the tests. */
const MOTOR_A: Vec2 = { x: -114, y: -31 };
const MOTOR_B: Vec2 = { x: -44, y: -56 };
/** Crank belt: crank pulley (r 15) and flywheel pulley (r 12). */
const CRANK_A: Vec2 = { x: 0, y: -56 };
const CRANK_B: Vec2 = { x: 150, y: -56 };

function pixelKey(p: Vec2): string {
  return `${p.x},${p.y}`;
}

/** Checks that a list of pixels is a closed loop of integers without duplicates and with small steps. */
function expectLoopShape(loop: Vec2[]): void {
  for (const p of loop) {
    expect(Number.isInteger(p.x)).toBe(true);
    expect(Number.isInteger(p.y)).toBe(true);
  }
  expect(new Set(loop.map(pixelKey)).size).toBe(loop.length);
  for (let i = 1; i < loop.length; i++) {
    const p = loop[i - 1];
    const q = loop[i];
    if (p === undefined || q === undefined) throw new Error('loop index out of range');
    expect(Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y))).toBeLessThanOrEqual(2);
  }
  const first = loop[0];
  const last = loop[loop.length - 1];
  if (first === undefined || last === undefined) throw new Error('empty loop');
  expect(Math.max(Math.abs(last.x - first.x), Math.abs(last.y - first.y))).toBeLessThanOrEqual(2);
}

describe('connectionOffset', () => {
  it('mirrors x when flipX is set', () => {
    expect(connectionOffset(literalDef(true), 'test')).toEqual({ x: -6, y: -2 });
  });

  it('keeps x when flipX is not set', () => {
    expect(connectionOffset(literalDef(false), 'test')).toEqual({ x: 6, y: -2 });
  });

  it('returns null for an unknown point id', () => {
    expect(connectionOffset(literalDef(false), 'nope')).toBeNull();
  });
});

describe('resolveConnectionPoint', () => {
  it('honours a custom sockets table', () => {
    const sockets = { crankHub: { x: 11, y: 22 } } as Record<SocketId, Vec2>; // only the hub the literal uses
    expect(resolveConnectionPoint(literalDef(false), 'test', sockets)).toEqual({ x: 17, y: 20 });
  });

  it('mirrors the point offset with flipX', () => {
    const sockets = { crankHub: { x: 11, y: 22 } } as Record<SocketId, Vec2>;
    expect(resolveConnectionPoint(literalDef(true), 'test', sockets)).toEqual({ x: 5, y: 20 });
  });

  it('returns null for an unknown point id', () => {
    expect(resolveConnectionPoint(literalDef(false), 'nope')).toBeNull();
  });
});

describe('beltPath', () => {
  const motor = beltPath(MOTOR_A, 6, MOTOR_B, 11);
  const crank = beltPath(CRANK_A, 16, CRANK_B, 13);

  it('puts every span end on its circle', () => {
    if (motor === null) throw new Error('motor belt should exist');
    const [[a0, b0], [a1, b1]] = motor.spans;
    for (const p of [a0, a1]) expect(Math.abs(Math.hypot(p.x - MOTOR_A.x, p.y - MOTOR_A.y) - 6)).toBeLessThan(EPS);
    for (const p of [b0, b1]) expect(Math.abs(Math.hypot(p.x - MOTOR_B.x, p.y - MOTOR_B.y) - 11)).toBeLessThan(EPS);
  });

  it('makes every span tangent to both circles at its ends', () => {
    if (motor === null) throw new Error('motor belt should exist');
    for (const [p, q] of motor.spans) {
      const dirX = q.x - p.x;
      const dirY = q.y - p.y;
      const onA = (p.x - MOTOR_A.x) * dirX + (p.y - MOTOR_A.y) * dirY;
      const onB = (q.x - MOTOR_B.x) * dirX + (q.y - MOTOR_B.y) * dirY;
      expect(Math.abs(onA)).toBeLessThan(EPS);
      expect(Math.abs(onB)).toBeLessThan(EPS);
    }
  });

  it('wraps a full turn in total', () => {
    if (motor === null) throw new Error('motor belt should exist');
    expect(motor.arcs[0].sweepRad + motor.arcs[1].sweepRad).toBeCloseTo(2 * Math.PI, 9);
  });

  it('has a small wrap of about 172.3 deg and a large wrap of about 187.7 deg', () => {
    if (motor === null) throw new Error('motor belt should exist');
    const toDeg = (r: number): number => (r * 180) / Math.PI;
    expect(toDeg(motor.arcs[0].sweepRad)).toBeCloseTo(172.3, 1);
    expect(toDeg(motor.arcs[1].sweepRad)).toBeCloseTo(187.7, 1);
  });

  it('runs the arcs in loop order', () => {
    for (const path of [motor, crank]) {
      if (path === null) throw new Error('belt should exist');
      const [s0, s1] = path.spans;
      const [arc0, arc1] = path.arcs;
      const arc0Start = arcPoint(arc0, 0);
      const arc0End = arcPoint(arc0, 1);
      const arc1Start = arcPoint(arc1, 0);
      const arc1End = arcPoint(arc1, 1);
      expect(Math.hypot(arc0Start.x - s0[0].x, arc0Start.y - s0[0].y)).toBeLessThan(EPS);
      expect(Math.hypot(arc0End.x - s1[0].x, arc0End.y - s1[0].y)).toBeLessThan(EPS);
      expect(Math.hypot(arc1Start.x - s1[1].x, arc1Start.y - s1[1].y)).toBeLessThan(EPS);
      expect(Math.hypot(arc1End.x - s0[1].x, arc1End.y - s0[1].y)).toBeLessThan(EPS);
    }
  });

  it('has a length equal to the sum of its parts', () => {
    if (motor === null) throw new Error('motor belt should exist');
    const [[a0, b0], [a1, b1]] = motor.spans;
    const spanLen = Math.hypot(b0.x - a0.x, b0.y - a0.y) + Math.hypot(b1.x - a1.x, b1.y - a1.y);
    const wrap = 6 * motor.arcs[0].sweepRad + 11 * motor.arcs[1].sweepRad;
    expect(motor.length).toBeCloseTo(spanLen + wrap, 9);
  });

  it('gives equal sweeps of PI and parallel spans for equal radii', () => {
    const equal = beltPath({ x: 0, y: 0 }, 5, { x: 10, y: 0 }, 5);
    if (equal === null) throw new Error('equal belt should exist');
    expect(equal.arcs[0].sweepRad).toBeCloseTo(Math.PI, 9);
    expect(equal.arcs[1].sweepRad).toBeCloseTo(Math.PI, 9);
    const [[a0, b0], [a1, b1]] = equal.spans;
    const cross = (b0.x - a0.x) * (b1.y - a1.y) - (b0.y - a0.y) * (b1.x - a1.x);
    expect(Math.abs(cross)).toBeLessThan(EPS);
  });

  it('puts the crank belt spans at about y -72 and -40 on the crank pulley', () => {
    if (crank === null) throw new Error('crank belt should exist');
    const ys = [crank.spans[0][0].y, crank.spans[1][0].y].sort((u, v) => u - v);
    expect(ys[0]).toBeCloseTo(-72, 1);
    expect(ys[1]).toBeCloseTo(-40, 1);
  });

  it('returns null for contained circles, coincident centres, zero radius and NaN', () => {
    expect(beltPath({ x: 0, y: 0 }, 10, { x: 2, y: 0 }, 1)).toBeNull();
    expect(beltPath({ x: 0, y: 0 }, 5, { x: 0, y: 0 }, 5)).toBeNull();
    expect(beltPath({ x: 0, y: 0 }, 0, { x: 10, y: 0 }, 5)).toBeNull();
    expect(beltPath({ x: 0, y: 0 }, Number.NaN, { x: 10, y: 0 }, 5)).toBeNull();
  });
});

describe('rasterLine', () => {
  it('covers a horizontal run with both ends', () => {
    const line = rasterLine({ x: 0, y: 3 }, { x: 4, y: 3 });
    expect(line).toEqual([
      { x: 0, y: 3 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]);
  });

  it('covers a vertical run', () => {
    expect(rasterLine({ x: 2, y: 0 }, { x: 2, y: 3 }).map((p) => p.y)).toEqual([0, 1, 2, 3]);
  });

  it('covers a diagonal', () => {
    expect(rasterLine({ x: 0, y: 0 }, { x: 3, y: 3 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('covers a shallow slope with one pixel per x step and no duplicates', () => {
    const line = rasterLine({ x: 0, y: 0 }, { x: 6, y: 2 });
    expect(line).toHaveLength(7);
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line[line.length - 1]).toEqual({ x: 6, y: 2 });
    expect(new Set(line.map(pixelKey)).size).toBe(line.length);
    for (const p of line) expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
  });

  it('reverses when the ends are swapped', () => {
    const forward = rasterLine({ x: 0, y: 0 }, { x: 6, y: 2 });
    const backward = rasterLine({ x: 6, y: 2 }, { x: 0, y: 0 });
    expect(backward).toEqual([...forward].reverse());
  });

  it('gives one point when both ends coincide', () => {
    expect(rasterLine({ x: 4, y: -2 }, { x: 4, y: -2 })).toEqual([{ x: 4, y: -2 }]);
  });

  it('returns no points for non-finite input', () => {
    expect(rasterLine({ x: Number.NaN, y: 0 }, { x: 1, y: 1 })).toEqual([]);
  });
});

describe('rasterCable', () => {
  /** Highest y of the pixels in column x, or null when the column is empty. */
  function maxYAt(pts: Vec2[], x: number): number | null {
    const ys = pts.filter((p) => p.x === x).map((p) => p.y);
    return ys.length === 0 ? null : Math.max(...ys);
  }

  it('starts and ends on the rounded end points with a sag below the line', () => {
    const pts = rasterCable({ x: 0, y: 0 }, { x: 20, y: 0 }, 10);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 20, y: 0 });
    // the curve bottoms out at y = 10 around the middle; the mid column must be on that lowest row
    expect(Math.max(...pts.map((p) => p.y))).toBe(10);
    expect(maxYAt(pts, 10)).toBe(10);
  });

  it('is symmetric about the middle column', () => {
    const pts = rasterCable({ x: 0, y: 0 }, { x: 20, y: 0 }, 10);
    for (let x = 0; x <= 20; x++) {
      // Bresenham breaks ties on the steep ends one way only, so mirrored columns may differ by one px
      expect(Math.abs((maxYAt(pts, x) ?? 0) - (maxYAt(pts, 20 - x) ?? 0))).toBeLessThanOrEqual(1);
    }
  });

  it('has no gaps: consecutive points differ by at most 1 in x and in y', () => {
    const pts = rasterCable({ x: 0, y: 0 }, { x: 20, y: 0 }, 10);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      if (p === undefined || q === undefined) throw new Error('index out of range');
      expect(Math.abs(q.x - p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(q.y - p.y)).toBeLessThanOrEqual(1);
    }
  });

  it('equals rasterLine when the sag is 0', () => {
    expect(rasterCable({ x: 0, y: 0 }, { x: 20, y: 0 }, 0)).toEqual(rasterLine({ x: 0, y: 0 }, { x: 20, y: 0 }));
    expect(rasterCable({ x: 0, y: 0 }, { x: 4, y: 4 }, 0)).toEqual(rasterLine({ x: 0, y: 0 }, { x: 4, y: 4 }));
  });

  it('equals rasterLine when both ends share a column', () => {
    expect(rasterCable({ x: 3, y: 0 }, { x: 3, y: 8 }, 5)).toEqual(rasterLine({ x: 3, y: 0 }, { x: 3, y: 8 }));
  });

  it('still starts at a when a is right of b', () => {
    const pts = rasterCable({ x: 20, y: 0 }, { x: 0, y: 0 }, 10);
    expect(pts[0]).toEqual({ x: 20, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: 0 });
    expect(maxYAt(pts, 10)).toBe(10);
  });

  it('returns no points for non-finite input', () => {
    expect(rasterCable({ x: Number.NaN, y: 0 }, { x: 20, y: 0 }, 10)).toEqual([]);
    expect(rasterCable({ x: 0, y: 0 }, { x: 20, y: 0 }, Number.NaN)).toEqual([]);
  });

  it('puts the lowest column at round(midY + sag) on a sloped cable', () => {
    // midY = (0 + 20) / 2 = 10; the sag adds sag at t = 0.5, so the mid column sits at round(10 + 10) = 20
    const expected = Math.round(10 + 10);
    const pts = rasterCable({ x: 0, y: 0 }, { x: 20, y: 20 }, 10);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 20, y: 20 });
    expect(maxYAt(pts, 10)).toBe(expected);
  });
});

describe('rasterArc', () => {
  const circle: Arc = { centre: { x: 0, y: 0 }, radius: 10, startRad: 0, sweepRad: 2 * Math.PI };

  it('gives integer pixels close to the circle', () => {
    const pts = rasterArc(circle);
    expect(pts.length).toBeGreaterThan(20);
    for (const p of pts) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      expect(Math.abs(Math.hypot(p.x, p.y) - 10)).toBeLessThanOrEqual(0.6);
    }
  });

  it('gives 8-neighbour steps and no consecutive duplicates', () => {
    const pts = rasterArc(circle);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      if (p === undefined || q === undefined) throw new Error('index out of range');
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      expect([-1, 0, 1]).toContain(dx);
      expect([-1, 0, 1]).toContain(dy);
      expect(dx === 0 && dy === 0).toBe(false);
    }
  });

  it('gives one pixel for a zero sweep', () => {
    expect(rasterArc({ centre: { x: 0, y: 0 }, radius: 5, startRad: 0, sweepRad: 0 })).toEqual([{ x: 5, y: 0 }]);
  });
});

describe('rasterBeltLoop and rasterBelt', () => {
  it('builds a clean closed loop for the motor belt', () => {
    const path = beltPath(MOTOR_A, 6, MOTOR_B, 11);
    if (path === null) throw new Error('motor belt should exist');
    expectLoopShape(rasterBeltLoop(path));
  });

  it('builds a clean closed loop for the crank belt', () => {
    const path = beltPath(CRANK_A, 16, CRANK_B, 13);
    if (path === null) throw new Error('crank belt should exist');
    expectLoopShape(rasterBeltLoop(path));
  });

  it('gives inner and outer loops with the outer one longer', () => {
    for (const [a, ra, b, rb] of [
      [MOTOR_A, 5, MOTOR_B, 10],
      [CRANK_A, 15, CRANK_B, 12],
    ] as const) {
      const belt = rasterBelt(a, ra, b, rb);
      if (belt === null) throw new Error('belt should exist');
      expectLoopShape(belt.inner);
      expectLoopShape(belt.outer);
      expect(belt.outer.length).toBeGreaterThan(belt.inner.length);
    }
  });

  it('returns null for a contained pair', () => {
    expect(rasterBelt({ x: 0, y: 0 }, 10, { x: 2, y: 0 }, 1)).toBeNull();
  });
});

describe('pointsAlongBelt', () => {
  const loop: Vec2[] = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 0 }));
  const indexes = (pts: Vec2[]): number[] => pts.map((p) => p.x);

  it('takes every 8th point from offset 0', () => {
    expect(indexes(pointsAlongBelt(loop, 8, 0))).toEqual([0, 8, 16]);
  });

  it('shifts by the offset', () => {
    expect(indexes(pointsAlongBelt(loop, 8, 3))).toEqual([3, 11, 19]);
  });

  it('wraps a negative offset', () => {
    expect(indexes(pointsAlongBelt(loop, 8, -1))).toEqual([7, 15]);
  });

  it('repeats every spacing', () => {
    expect(pointsAlongBelt(loop, 8, 8)).toEqual(pointsAlongBelt(loop, 8, 0));
  });

  it('returns copies, not the loop objects', () => {
    const out = pointsAlongBelt(loop, 8, 0);
    expect(out[0]).not.toBe(loop[0]);
  });

  it('returns nothing for an empty loop or spacing 0', () => {
    expect(pointsAlongBelt([], 8, 0)).toEqual([]);
    expect(pointsAlongBelt(loop, 0, 0)).toEqual([]);
  });
});

describe('beltTravel', () => {
  it('moves a quarter turn of a ratio 2 pulley of radius 5 by 5 PI', () => {
    expect(beltTravel(-90, 2, 5)).toBeCloseTo(5 * Math.PI, 9);
  });

  it('flips sign for a negative ratio', () => {
    expect(beltTravel(-90, -1.75, 5)).toBeCloseTo(-beltTravel(-90, 1.75, 5), 9);
    expect(Math.sign(beltTravel(-90, -1.75, 5))).toBe(-Math.sign(beltTravel(-90, 2, 5)));
  });

  it('returns 0 for NaN input and never -0', () => {
    expect(beltTravel(Number.NaN, 2, 5)).toBe(0);
    expect(Object.is(beltTravel(0, 1, 5), 0)).toBe(true);
  });
});

describe('coalesceRuns', () => {
  it('merges consecutive x in a row into runs', () => {
    expect(
      coalesceRuns([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toEqual([
      { x: 0, y: 0, w: 3, h: 1 },
      { x: 5, y: 0, w: 1, h: 1 },
      { x: 0, y: 1, w: 1, h: 1 },
    ]);
  });

  it('works with unsorted input and orders by y then x', () => {
    expect(
      coalesceRuns([
        { x: 2, y: 1 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 3, y: 0 },
      ]),
    ).toEqual([
      { x: 3, y: 0, w: 1, h: 1 },
      { x: 0, y: 1, w: 3, h: 1 },
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(coalesceRuns([])).toEqual([]);
  });
});
