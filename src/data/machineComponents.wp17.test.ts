import { describe, it, expect } from 'vitest';
import type { TechId } from './types';
import { DRIVE_TRAIN, MACHINE_BOUNDS, MACHINE_COMPONENT_IDS, MACHINE_COMPONENTS, MACHINE_LINKS, MACHINE_SOCKETS } from './machineComponents';
import type { AnimationDriver, ComponentAnimation, MachineComponentDefinition, MachineComponentId, MachineLink, SocketId, SpeedCurve, Vec2 } from './machineComponents';

// WP17 guard tests: legacy feed parts, hz curves, flash-part safety and driver saturation.
// Helpers are local copies (no imports from other test files).

const DEFS: readonly MachineComponentDefinition[] = MACHINE_COMPONENT_IDS.map((id) => MACHINE_COMPONENTS[id]);

/** Production rates (per second) when each primary function is reached (profile A). */
const PF_RATE = { me: 1.2e4, ee: 9.6e5, pr: 1.1e6, rs: 3.8e5, xf: 2.5e5 } as const;
type Res = keyof typeof PF_RATE;

/** Resource each animation driver reads. manual has none (click activity) and is skipped. */
const DRIVER_RES: Partial<Record<AnimationDriver, Res>> = {
  automation: 'me', electric: 'ee', thermal: 'pr', resonance: 'rs', exotic: 'xf', combined: 'me',
};

/** Machine-local art px of a component's attach point: socket (or origin) plus attach offset. */
function attachOf(def: MachineComponentDefinition): Vec2 {
  const base = def.attach.socket === null ? { x: 0, y: 0 } : MACHINE_SOCKETS[def.attach.socket];
  return { x: base.x + def.attach.offset.x, y: base.y + def.attach.offset.y };
}

/** Machine-local art px box of a component's sprite: attach point minus origin * size. */
function boundsOf(def: MachineComponentDefinition): { left: number; right: number; top: number; bottom: number } {
  const p = attachOf(def);
  const left = p.x - def.origin.x * def.size.width;
  const top = p.y - def.origin.y * def.size.height;
  return { left, right: left + def.size.width, top, bottom: top + def.size.height };
}

/** Machine-local art px of a connection point: attach point plus the point offset. */
function pointPosition(component: MachineComponentId, pointId: string): Vec2 {
  const point = MACHINE_COMPONENTS[component].connections.find((c) => c.id === pointId);
  if (point === undefined) throw new Error(`missing point ${component}.${pointId}`);
  const a = attachOf(MACHINE_COMPONENTS[component]);
  return { x: a.x + point.at.x, y: a.y + point.at.y };
}

/** The link from one component to another; throws when missing. */
function linkBetween(from: MachineComponentId, to: MachineComponentId): MachineLink {
  const link = MACHINE_LINKS.find((l) => l.from.component === from && l.to.component === to);
  if (link === undefined) throw new Error(`missing link ${from} -> ${to}`);
  return link;
}

/** Machine-local art px path of a link: resolved start, then the via corners, then the resolved end. */
function pathOf(link: MachineLink): Vec2[] {
  return [pointPosition(link.from.component, link.from.point), ...(link.via ?? []), pointPosition(link.to.component, link.to.point)];
}

/** Consecutive point pairs of a path. */
function segmentsOf(path: readonly Vec2[]): [Vec2, Vec2][] {
  const out: [Vec2, Vec2][] = [];
  for (let i = 0; i + 1 < path.length; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    if (a !== undefined && b !== undefined) out.push([a, b]);
  }
  return out;
}

/** Frames animation of a component; throws when the component is not a frames part. */
function framesOf(id: MachineComponentId): Extract<ComponentAnimation, { kind: 'frames' }> {
  const a = MACHINE_COMPONENTS[id].animation;
  if (a.kind !== 'frames') throw new Error(`${id} is not a frames part`);
  return a;
}

/** Speed curve of a component with a speed-driven animation (vibrate, spin or orbit); throws otherwise. */
function speedCurveOf(id: MachineComponentId): SpeedCurve {
  const a = MACHINE_COMPONENTS[id].animation;
  if (a.kind !== 'vibrate' && a.kind !== 'spin' && a.kind !== 'orbit') throw new Error(`${id} has no speed curve`);
  return a.speed;
}

/** Speed at driver value v: base * (1 + gain * log10(1 + v)) clamped to [min, max]. */
function speedAt(curve: SpeedCurve, v: number): number {
  const raw = curve.base * (1 + curve.gain * Math.log10(1 + v));
  return Math.min(Math.max(raw, curve.min), curve.max);
}

/** Driver value at which a curve reaches its max: 10^((max / base - 1) / gain) - 1. */
function curveSaturation(curve: SpeedCurve): number {
  return 10 ** ((curve.max / curve.base - 1) / curve.gain) - 1;
}

interface Saturation { name: string; res: Res; s: number }

/** Every visual driver curve (vibrate, spin, orbit, gauge, frames with hz, master drive) with its driver resource and saturation value. */
function saturations(): Saturation[] {
  const out: Saturation[] = [];
  for (const d of DEFS) {
    const a: ComponentAnimation = d.animation;
    if (a.kind === 'vibrate' || a.kind === 'spin') {
      const res = DRIVER_RES[a.driver];
      if (res !== undefined) out.push({ name: d.id, res, s: curveSaturation(a.speed) });
    } else if (a.kind === 'orbit') {
      out.push({ name: d.id, res: 'xf', s: curveSaturation(a.speed) });
    } else if (a.kind === 'gauge') {
      const res = DRIVER_RES[a.driver];
      if (res !== undefined) out.push({ name: d.id, res, s: 10 ** a.maxLog - 1 });
    } else if (a.kind === 'frames' && a.hz !== undefined) {
      const res = DRIVER_RES[a.driver];
      if (res !== undefined) out.push({ name: d.id, res, s: curveSaturation(a.hz) });
    }
  }
  out.push({ name: 'masterSpeed', res: 'me', s: curveSaturation(DRIVE_TRAIN.masterSpeed) }); // driver combined = ME/s
  return out;
}

/** Legacy energy techs and the single part that shows each one. */
const LEGACY: readonly { tech: TechId; part: MachineComponentId }[] = [
  { tech: 'bellowsDrive', part: 'bellows' },
  { tech: 'gridExciter', part: 'exciterFeed' },
  { tech: 'mainsBackfeed', part: 'backfeedTerminal' },
  { tech: 'steamLance', part: 'steamLance' },
];

/** The four WP17 seats: socket, machine-local position and the one part that sits on it. */
const NEW_SEATS: readonly { socket: SocketId; at: Vec2; part: MachineComponentId }[] = [
  { socket: 'bellowsSeat', at: { x: -242, y: 0 }, part: 'bellows' },
  { socket: 'exciterFeedSeat', at: { x: 80, y: -110 }, part: 'exciterFeed' },
  { socket: 'backfeedSeat', at: { x: 120, y: -414 }, part: 'backfeedTerminal' },
  { socket: 'lanceSeat', at: { x: 20, y: -414 }, part: 'steamLance' },
];

/** Parts with a frames animation and no hz curve, so they never flash faster than 3 Hz. */
const FLASH_PARTS: readonly MachineComponentId[] = [
  'sparkGap', 'fireboxGlow1', 'fireboxGlow2', 'fireboxGlow3',
  'anchorGlow1L', 'anchorGlow1R', 'anchorGlow2L', 'anchorGlow2R', 'anchorGlow3L', 'anchorGlow3R', 'lensLight',
];

/** The only frames parts that carry an hz curve. */
const HZ_PARTS: readonly MachineComponentId[] = ['spireWave', 'dishWavesL', 'dishWavesR', 'siphonArcs1', 'siphonArcs2', 'siphonArcs3', 'bellows'];

describe('WP17 legacy feed parts', () => {
  for (const { tech, part } of LEGACY) {
    it(`${tech} is shown by exactly ${part}, at minLevel 1, and that part is linked into the machine`, () => {
      const owners = DEFS.filter((d) => d.techId === tech);
      expect(owners.map((d) => d.id)).toEqual([part]);
      expect(owners.map((d) => d.minLevel)).toEqual([1]);
      expect(MACHINE_LINKS.some((l) => l.from.component === part || l.to.component === part)).toBe(true);
    });
  }

  it('generatorGlow is the EE gauge on the generator: techId generator, gauge kind, electric driver, maxLog 6.5', () => {
    const g = MACHINE_COMPONENTS.generatorGlow;
    expect(g.techId).toBe('generator');
    expect(g.animation).toMatchObject({ kind: 'gauge', driver: 'electric', maxLog: 6.5 });
  });

  for (const seat of NEW_SEATS) {
    it(`${seat.socket} is used by exactly ${seat.part} and sits at (${seat.at.x}, ${seat.at.y})`, () => {
      const users = DEFS.filter((d) => d.attach.socket === seat.socket);
      expect(users.map((d) => d.id)).toEqual([seat.part]);
      expect(MACHINE_SOCKETS[seat.socket]).toEqual(seat.at);
    });
  }
});

describe('WP17 machine links and cables', () => {
  it('the bellows hose runs (-212,-11) to (-204,-11) to (-204,-22): nozzle into the boiler tuyere', () => {
    const link = linkBetween('bellows', 'boiler');
    expect(link.kind).toBe('pipe');
    expect(link.from.point).toBe('nozzle');
    expect(link.to.point).toBe('tuyere');
    expect(pathOf(link)).toEqual([{ x: -212, y: -11 }, { x: -204, y: -11 }, { x: -204, y: -22 }]);
  });

  it('the steam lance runs (-11,-176) to (20,-176) to (20,-382): manifold outlet into the lance steam port', () => {
    const link = linkBetween('steamManifold', 'steamLance');
    expect(link.kind).toBe('pipe');
    expect(link.from.point).toBe('outR');
    expect(link.to.point).toBe('steam');
    expect(pathOf(link)).toEqual([{ x: -11, y: -176 }, { x: 20, y: -176 }, { x: 20, y: -382 }]);
  });

  it('the two new pipes are axis-aligned with non-zero segments', () => {
    for (const link of [linkBetween('bellows', 'boiler'), linkBetween('steamManifold', 'steamLance')]) {
      const segs = segmentsOf(pathOf(link));
      expect(segs.length).toBeGreaterThan(0);
      for (const [a, b] of segs) {
        expect(a.x === b.x || a.y === b.y).toBe(true);
        expect(a.x !== b.x || a.y !== b.y).toBe(true);
      }
    }
  });

  it('the two new cables start on the cableMast top (436,-108) and end on the exciter and backfeed lugs', () => {
    expect(pointPosition('cableMast', 'top')).toEqual({ x: 436, y: -108 });
    const feed = linkBetween('cableMast', 'exciterFeed');
    const backfeed = linkBetween('cableMast', 'backfeedTerminal');
    expect(feed.kind).toBe('cable');
    expect(feed.from.point).toBe('top');
    expect(feed.to.point).toBe('lug');
    expect(pointPosition('exciterFeed', 'lug')).toEqual({ x: 82, y: -137 });
    expect(backfeed.kind).toBe('cable');
    expect(backfeed.from.point).toBe('top');
    expect(backfeed.to.point).toBe('lug');
    expect(pointPosition('backfeedTerminal', 'lug')).toEqual({ x: 120, y: -388 });
  });

  it('the link list has 20 entries after WP17', () => {
    expect(MACHINE_LINKS.length).toBe(20);
  });
});

describe('WP17 machine data guards', () => {
  it('every component box lies inside MACHINE_BOUNDS', () => {
    for (const d of DEFS) {
      const b = boundsOf(d);
      expect(b.left, d.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.left);
      expect(b.right, d.id).toBeLessThanOrEqual(MACHINE_BOUNDS.right);
      expect(b.top, d.id).toBeGreaterThanOrEqual(MACHINE_BOUNDS.top);
      expect(b.bottom, d.id).toBeLessThanOrEqual(MACHINE_BOUNDS.bottom);
    }
  });

  it('every component has no production effects', () => {
    for (const d of DEFS) {
      expect(d.effects, d.id).toEqual([]);
    }
  });
});

describe('WP17 hz curves and flash-part safety', () => {
  it('exactly the seven WP17 hz parts carry an hz curve', () => {
    const withHz = DEFS.filter((d) => d.animation.kind === 'frames' && d.animation.hz !== undefined).map((d) => d.id);
    expect([...withHz].sort()).toEqual([...HZ_PARTS].sort());
  });

  it('every frames animation with hz has base > 0 and min <= max <= maxHz', () => {
    for (const d of DEFS) {
      const a = d.animation;
      if (a.kind !== 'frames' || a.hz === undefined) continue;
      expect(a.hz.base, d.id).toBeGreaterThan(0);
      expect(a.hz.min, d.id).toBeLessThanOrEqual(a.hz.max);
      expect(a.hz.max, d.id).toBeLessThanOrEqual(a.maxHz);
    }
  });

  for (const id of FLASH_PARTS) {
    it(`${id} has no hz curve and flashes at most 3 Hz`, () => {
      const a = framesOf(id);
      expect(a.hz, id).toBeUndefined();
      expect(a.maxHz, id).toBeLessThanOrEqual(3);
    });
  }
});

describe('WP17 driver saturation', () => {
  it('the saturation check covers exactly the twenty visual driver curves and the master drive', () => {
    expect(saturations().map((e) => e.name).sort()).toEqual([
      'bellows', 'dishWavesL', 'dishWavesR', 'gaugeNeedle', 'generatorGlow', 'masterSpeed', 'motorRetrofitKit', 'nullCore',
      'ring1Bead', 'ring1Bead2', 'ring2Bead', 'ring3Bead', 'ring4Bead', 'siphonArcs1', 'siphonArcs2', 'siphonArcs3', 'spireWave',
      'transformer', 'turbineRotor', 'wornMotor',
    ]);
  });

  it('every visual driver curve keeps changing up to at least 3 x the rate its primary function is reached at', () => {
    for (const e of saturations()) {
      expect(e.s, e.name).toBeGreaterThanOrEqual(3 * PF_RATE[e.res]);
    }
  });
});

describe('WP17 speed continuity against the old curves', () => {
  it('null core at driver 4.65 stays within 10% of the old curve (base 6, gain 30, min 6, max 240)', () => {
    const now = speedAt(speedCurveOf('nullCore'), 4.65);
    const old = speedAt({ base: 6, gain: 30, min: 6, max: 240 }, 4.65);
    expect(Math.abs(now - old) / old).toBeLessThanOrEqual(0.1);
  });

  for (const id of ['ring1Bead', 'ring2Bead', 'ring3Bead', 'ring4Bead'] as const) {
    it(`${id} at driver 5 stays within 10% of the old bead curve (base 20, gain 25, min 20, max 180)`, () => {
      const now = speedAt(speedCurveOf(id), 5);
      const old = speedAt({ base: 20, gain: 25, min: 20, max: 180 }, 5);
      expect(Math.abs(now - old) / old).toBeLessThanOrEqual(0.1);
    });
  }

  it('transformer at driver 30 equals the old curve (base 6, gain 0.3, min 2, max 12)', () => {
    expect(speedAt(speedCurveOf('transformer'), 30)).toBeCloseTo(speedAt({ base: 6, gain: 0.3, min: 2, max: 12 }, 30), 9);
  });

  it('turbine rotor at driver 800 equals the old curve (base 60, gain 1.5, min 0, max 540)', () => {
    expect(speedAt(speedCurveOf('turbineRotor'), 800)).toBeCloseTo(speedAt({ base: 60, gain: 1.5, min: 0, max: 540 }, 800), 9);
  });
});

describe('A17 legacy part placement', () => {
  it('generatorGlow sits under the belt and the generator pulley (mid + 4) and over the coil stages', () => {
    expect(MACHINE_COMPONENTS.generatorGlow.layer).toBe('mid');
    expect(MACHINE_COMPONENTS.generatorGlow.depthBias).toBe(4);
    expect(MACHINE_COMPONENTS.generatorPulley.depthBias).toBe(5);
    expect(MACHINE_COMPONENT_IDS.indexOf('generatorGlow')).toBeGreaterThan(MACHINE_COMPONENT_IDS.indexOf('coilStage3'));
  });

  it('the backfeed terminal and the steam lance hang from the null gallery deck underside (y -414)', () => {
    for (const id of ['backfeedTerminal', 'steamLance'] as const) {
      expect(boundsOf(MACHINE_COMPONENTS[id]).top, id).toBe(-414);
    }
  });

  it('the exciter feed stands on the frame girder between the spire exciter and the right spire leg', () => {
    const b = boundsOf(MACHINE_COMPONENTS.exciterFeed);
    expect(b.bottom).toBe(-110);
    expect(b.left).toBeGreaterThanOrEqual(72);
    expect(b.right).toBeLessThanOrEqual(88);
  });
});
