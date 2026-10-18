import { describe, it, expect } from 'vitest';
import { DRIVE_TRAIN, MACHINE_COMPONENTS, MACHINE_LINKS, MACHINE_SOCKETS } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import { CRANK_FEEDBACK } from '../../data/world';
import { addClickImpulse, meshPhaseError, partAngle, sliderCrank, stepMaster } from './driveTrain';
import type { GearMesh, MasterState } from './driveTrain';
import { resolveAttachment } from './machineLayout';

/** Seeded linear congruential generator in [0, 1). No Math.random. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Ratio and phase of a driven component; throws for any other animation kind. */
function drivenOf(id: MachineComponentId): { ratio: number; phaseDeg: number } {
  const anim = MACHINE_COMPONENTS[id].animation;
  if (anim.kind !== 'driven') throw new Error(`${id} animation must be driven`);
  return anim;
}

/** Belt ratio and radius of one connection point of a driven component. */
function beltEnd(component: MachineComponentId, pointId: string): { ratio: number; radius: number } {
  const def = MACHINE_COMPONENTS[component];
  const point = def.connections.find((c) => c.id === pointId);
  if (point === undefined || point.radius === undefined) throw new Error(`${component}.${pointId} has no belt radius`);
  return { ratio: drivenOf(component).ratio, radius: point.radius };
}

const FRAME_SECONDS = 1 / 60;
const CLICK_FRAMES = 15; // 0.25 s at 60 fps

const large: GearMesh = { ...drivenOf('gearLarge'), teeth: DRIVE_TRAIN.gears.large.teeth };
const small: GearMesh = { ...drivenOf('gearSmall'), teeth: DRIVE_TRAIN.gears.small.teeth };

describe('gear mesh with real data', () => {
  it('keeps the large and small gears meshed for random masters', () => {
    const rnd = lcg(24301);
    for (let i = 0; i < 1000; i += 1) {
      const master = (rnd() * 2 - 1) * 1e4; // [-1e4, 1e4)
      expect(meshPhaseError(master, large, small)).toBeLessThan(1e-9);
    }
  });

  it('loses the mesh when the small gear phase is removed', () => {
    expect(meshPhaseError(0, large, { ...small, phaseDeg: 0 })).toBeGreaterThan(0.1);
  });
});

describe('slider-crank rod with real data', () => {
  const centre = resolveAttachment(MACHINE_COMPONENTS[DRIVE_TRAIN.rod.crank]);
  const crank = drivenOf(DRIVE_TRAIN.rod.crank);

  it('keeps the yoke slider in its band and the rod at full length over a turn', () => {
    for (let k = 0; k < 72; k += 1) {
      const master = k * 5;
      const angle = partAngle(master, crank.ratio, crank.phaseDeg) + DRIVE_TRAIN.rod.pinPhaseDeg;
      const { pin, slider } = sliderCrank(centre, DRIVE_TRAIN.rod.pinRadius, DRIVE_TRAIN.rod.length, angle);
      expect(slider.y).toBeGreaterThanOrEqual(-130.1);
      expect(slider.y).toBeLessThanOrEqual(-119.8);
      expect(Math.hypot(pin.x - slider.x, pin.y - slider.y)).toBeCloseTo(DRIVE_TRAIN.rod.length, 9);
    }
  });

  it('rests the yoke on its pin socket at master 0', () => {
    const angle = partAngle(0, crank.ratio, crank.phaseDeg) + DRIVE_TRAIN.rod.pinPhaseDeg;
    const { slider } = sliderCrank(centre, DRIVE_TRAIN.rod.pinRadius, DRIVE_TRAIN.rod.length, angle);
    expect(Math.round(slider.y)).toBe(MACHINE_SOCKETS.yokePin.y);
  });
});

describe('click feel and drift with real data', () => {
  const crankRatio = drivenOf('handCrank').ratio;

  it('turns the crank about 90 degrees clockwise within 0.25 s and keeps the pinion meshed', () => {
    let s: MasterState = addClickImpulse({ deg: 0, pending: 0 }, CRANK_FEEDBACK.degreesPerClick, crankRatio);
    for (let i = 0; i < CLICK_FRAMES; i += 1) {
      s = stepMaster(s, 0, DRIVE_TRAIN.masterDirection, FRAME_SECONDS, DRIVE_TRAIN.clickTauSeconds);
    }
    const crankDeg = crankRatio * s.deg;
    expect(crankDeg).toBeGreaterThanOrEqual(85);
    expect(crankDeg).toBeLessThanOrEqual(91);
    expect(meshPhaseError(s.deg, large, small)).toBeLessThan(1e-9);
  });

  it('turns the crank clockwise under idle drift', () => {
    let s: MasterState = { deg: 0, pending: 0 };
    for (let i = 0; i < 60; i += 1) {
      s = stepMaster(s, 60, DRIVE_TRAIN.masterDirection, FRAME_SECONDS, DRIVE_TRAIN.clickTauSeconds);
    }
    expect(crankRatio * s.deg).toBeGreaterThan(0);
  });
});

describe('belt kinematics with real data', () => {
  it('gives equal belt surface speed at both ends of every belt link', () => {
    const belts = MACHINE_LINKS.filter((link) => link.kind === 'belt');
    expect(belts.length).toBeGreaterThan(0);
    for (const link of belts) {
      const from = beltEnd(link.from.component, link.from.point);
      const to = beltEnd(link.to.component, link.to.point);
      expect(Math.abs(from.ratio * from.radius)).toBeCloseTo(Math.abs(to.ratio * to.radius), 9);
    }
  });
});
