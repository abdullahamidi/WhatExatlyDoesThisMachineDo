// Tests for worldPlacement (WP23a, WP23b): framing poses and keys, view rect, screen projection, cast placement over the smoke
// stage buy lists (scripts/smoke/stages.mjs, S0-S16), the girl rules, inner entries, late framings, far-plane literals, and the
// unseen-change rule. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import {
  framingPose, framingKey, framingKeyOfPose, viewRectOf, isOnScreen, screenOfWorld, placeCast, unseenChangeOk, farPlaneLiterals,
  actorBand, usableX,
} from './worldPlacement';
import type { Rect } from './worldPlacement';
import { visibleMachineBounds, boundsToWorld } from './machineBounds';
import { layerPhase } from './parallax';
import type { CameraPose } from './finale';
import { VIEW, GROUND_Y, MACHINE_ANCHOR, CAMERA, PARALLAX_LAYERS, PIXEL_SCALE } from '../../data/world';
import { WORLD_FAR_PLANES, WORLD_GIRL_PLACEMENTS, WORLD_LAYOUT, WORLD_PLACEMENTS } from '../../data/livingWorld';
import type { FramingKey, GroundId, WorldPlacement } from '../../data/livingWorld';
import { WORLD_GIRL } from '../../data/worldEras';
import { WORLD_ENDING } from '../../data/worldEnding';
import { ASSET_MANIFEST } from '../../assets/manifest';
import type { TechId } from '../../data/types';

// The smoke stage buy lists (scripts/smoke/stages.mjs:6-34), copied as literals.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 5), ...rep('copperWinding', 20), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 3), 'powerLines'];
// The late stages S10-S16 (stages.mjs), copied the same way.
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...rep('inductionHeater', 3), ...rep('firebox', 20), 'steamHammer', 'superheater', ...rep('condenser', 5),
  'turbine', 'reliefValves', ...rep('bellowsDrive', 3), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...rep('crankServo', 3), ...rep('harmonicCoil', 25), ...rep('pressureResonator', 3), 'echoCrank', 'phaseLock',
  ...rep('standingWave', 3), 'crystalLattice', ...rep('gridExciter', 5), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...rep('containmentRing', 25), '@resonantSiphon:20', '@graviticAnchor:10', 'inversionCrank', 'lensArray',
  ...rep('horizonField', 20), 'skyAperture', ...rep('mainsBackfeed', 5), ...rep('steamLance', 5), '@finalAlignment'];
const S16 = [...S15, 'primaryFunction'];

// Expected framing key per stage: s0-s7 frame at e1, s8 (generator) at s8, s9 (era II full) at s9, s10 at s10, s11-s14 at s11,
// s15 and s16 at s15.
const STAGES: readonly { name: string; buys: readonly string[]; key: FramingKey }[] = [
  { name: 's0_crank', buys: [], key: 'e1' },
  { name: 's1_gear', buys: ['gearRatio'], key: 'e1' },
  { name: 's2_motor', buys: ['wornMotor'], key: 'e1' },
  { name: 's3_gearmotor', buys: ['wornMotor', 'gearRatio'], key: 'e1' },
  { name: 's4_reinforced', buys: ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank'], key: 'e1' },
  { name: 's5_flywheel', buys: ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'flywheel'], key: 'e1' },
  { name: 's6_pistons_nofly', buys: ['wornMotor', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'motorTuning', 'pistonArray'], key: 'e1' },
  { name: 's7_full', buys: S7, key: 'e1' },
  { name: 's8_generator', buys: [...S7, '@blueprint', 'generator'], key: 's8' },
  { name: 's9_era2_full', buys: S9, key: 's9' },
  { name: 's10_boiler', buys: S10, key: 's10' },
  { name: 's11_era3_full', buys: S11, key: 's11' },
  { name: 's12_spire', buys: S12, key: 's11' },
  { name: 's13_era4_full', buys: S13, key: 's11' },
  { name: 's14_null', buys: S14, key: 's11' },
  { name: 's15_era5_full', buys: S15, key: 's15' },
  { name: 's16_postgame', buys: S16, key: 's15' },
];

// Tech levels of a buy list: plain id += 1; '@blueprint' = generatorBlueprint 1; '@tech' = 1; '@tech:n' = n.
function levelsOf(buys: readonly string[]): Record<TechId, number> {
  const out: Record<string, number> = {};
  for (const raw of buys) {
    if (raw.startsWith('@')) {
      const [name = '', n] = raw.slice(1).split(':');
      out[name === 'blueprint' ? 'generatorBlueprint' : name] = n === undefined ? 1 : Number(n);
    } else {
      out[raw] = (out[raw] ?? 0) + 1;
    }
  }
  return out as Record<TechId, number>;
}

const VIEW_THIRD_LO = VIEW.width / 3;   // screen centre third (game px)
const VIEW_THIRD_HI = (2 * VIEW.width) / 3;

function expectPose(p: CameraPose, want: CameraPose): void {
  expect(p.centerX).toBeCloseTo(want.centerX, 6);
  expect(p.centerY).toBeCloseTo(want.centerY, 6);
  expect(p.zoom).toBeCloseTo(want.zoom, 9);
}

// The reference pose of a framing key (WORLD_LAYOUT.framingPoses); centre y is the focus.
const poseOf = (key: FramingKey): CameraPose => {
  const ref = WORLD_LAYOUT.framingPoses.find((r) => r.key === key);
  if (ref === undefined) throw new Error(`no pose ${key}`);
  return { centerX: ref.centerX, centerY: CAMERA.focus.y, zoom: ref.zoom };
};

// Every placed x of a placement (xs, route and x) must sit inside the view by the wing clearance and outside the centre third.
const xsOf = (p: WorldPlacement): number[] => [...(p.xs ?? [p.x]), ...(p.route ?? [])];
function expectInView(placed: Record<GroundId, WorldPlacement | null>, pose: CameraPose): void {
  const view = viewRectOf(pose);
  for (const [id, p] of Object.entries(placed) as [GroundId, WorldPlacement | null][]) {
    if (p === null) continue;
    for (const x of xsOf(p)) {
      expect(x >= view.x + 24 && x <= view.x + view.w - 24, `${id} x ${x} in view`).toBe(true);
      const sx = screenOfWorld({ x, y: GROUND_Y }, 1, pose).x;
      expect(sx < VIEW_THIRD_LO || sx > VIEW_THIRD_HI, `${id} x ${x} centre third`).toBe(true);
    }
  }
}

describe('levelsOf (test helper)', () => {
  it('reads plain ids, the blueprint marker and tech markers', () => {
    const lv = levelsOf(['gearRatio', 'gearRatio', '@blueprint', 'generator', '@substationBlueprint:2', '@powerLines']);
    expect(lv.gearRatio).toBe(2);
    expect(lv.generatorBlueprint).toBe(1);
    expect(lv.generator).toBe(1);
    expect(lv.substationBlueprint).toBe(2);
    expect(lv.powerLines).toBe(1);
  });
});

describe('framingPose', () => {
  it('frames the empty machine and the era I stages at e1 (1920, 1520, zoom 1)', () => {
    expectPose(framingPose(levelsOf([])), { centerX: 1920, centerY: 1520, zoom: 1 });
    expectPose(framingPose(levelsOf(S7)), { centerX: 1920, centerY: 1520, zoom: 1 });
  });

  it('frames s8 (generator) at (2064, 1464, zoom 1)', () => {
    expectPose(framingPose(levelsOf([...S7, '@blueprint', 'generator'])), { centerX: 2064, centerY: 1464, zoom: 1 });
  });

  it('frames s9 (era II full) at (2192, 1504, zoom 0.75)', () => {
    expectPose(framingPose(levelsOf(S9)), { centerX: 2192, centerY: 1504, zoom: 0.75 });
  });
});

describe('framingKey', () => {
  it.each(STAGES)('$name frames as $key', (s) => {
    expect(framingKey(levelsOf(s.buys))).toBe(s.key);
  });

  it('maps every reference pose to its own key', () => {
    for (const ref of WORLD_LAYOUT.framingPoses) {
      if (ref.key === 'portrait') continue;   // same pose as s15: the list order wins the tie (checked below)
      expect(framingKeyOfPose(poseOf(ref.key)), ref.key).toBe(ref.key);
    }
    expect(framingKeyOfPose(poseOf('portrait'))).toBe('s15');
    expect(WORLD_LAYOUT.framingPoses).toHaveLength(9);
  });

  it('maps off-step poses to the nearest reference (zoom weighs 1000 per unit, then centre x; ties keep list order)', () => {
    // zoom 0.5, centre 1900: s15 20 and portrait 20 (s15 first), s11 22
    expect(framingKeyOfPose({ centerX: 1900, centerY: 1500, zoom: 0.5 })).toBe('s15');
    // zoom 0.5, centre 2100: s11 178 beats s15 180 and s9 342
    expect(framingKeyOfPose({ centerX: 2100, centerY: 1500, zoom: 0.5 })).toBe('s11');
    // zoom 0.9, centre 2000: s8 164 beats e1 180 and s10 205
    expect(framingKeyOfPose({ centerX: 2000, centerY: 1500, zoom: 0.9 })).toBe('s8');
    // zoom 1, centre 1400: baseL 80 beats e1 520
    expect(framingKeyOfPose({ centerX: 1400, centerY: 1500, zoom: 1 })).toBe('baseL');
    expect(framingKeyOfPose({ centerX: 2500, centerY: 1500, zoom: 1 })).toBe('baseR');
  });
});

describe('viewRectOf', () => {
  it('is centre +- 640 / zoom and 360 / zoom', () => {
    expect(viewRectOf({ centerX: 1920, centerY: 1520, zoom: 1 })).toEqual({ x: 1280, y: 1160, w: 1280, h: 720 });
    const s8 = viewRectOf({ centerX: 2064, centerY: 1464, zoom: 1 });
    expect(s8.x).toBeCloseTo(1424, 6);
    expect(s8.x + s8.w).toBeCloseTo(2704, 6);
    const s9 = viewRectOf({ centerX: 2192, centerY: 1504, zoom: 0.75 });
    expect(s9.x).toBeCloseTo(1338.6667, 3);
    expect(s9.x + s9.w).toBeCloseTo(3045.3333, 3);
    expect(s9.y).toBeCloseTo(1024, 6);
    expect(s9.w).toBeCloseTo(1706.6667, 3);
    expect(s9.h).toBeCloseTo(960, 6);
  });
});

describe('isOnScreen', () => {
  const view: Rect = { x: 1280, y: 1160, w: 1280, h: 720 };
  it('includes the edges at inset 0 and excludes them past the inset', () => {
    expect(isOnScreen({ x: 1280, y: 1500 }, view, 0)).toBe(true);
    expect(isOnScreen({ x: 2560, y: 1500 }, view, 0)).toBe(true);
    expect(isOnScreen({ x: 1900, y: 1880 }, view, 0)).toBe(true);
    expect(isOnScreen({ x: 1900, y: 1881 }, view, 0)).toBe(false);
    expect(isOnScreen({ x: 1280, y: 1500 }, view, 16)).toBe(false);
    expect(isOnScreen({ x: 1296, y: 1176 }, view, 16)).toBe(true);
  });
});

describe('screenOfWorld', () => {
  const e1: CameraPose = { centerX: 1920, centerY: 1520, zoom: 1 };
  it('puts the crank hub (1920, 1568) at game (640, 408) at e1', () => {
    const p = screenOfWorld({ x: 1920, y: 1568 }, 1, e1);
    expect(p.x).toBeCloseTo(640, 6);
    expect(p.y).toBeCloseTo(408, 6);
  });

  it('places the girl window tile art (306, 106) at strip (1380, 640): game (996, 292) at e1', () => {
    const strip = { x: WORLD_FAR_PLANES.window.tileOriginX + 2 * 306, y: WORLD_FAR_PLANES.window.tileTopY + 2 * 106 };
    const p = screenOfWorld(strip, WORLD_FAR_PLANES.window.sf, e1);
    expect(p.x).toBeCloseTo(996, 6);
    expect(p.y).toBeCloseTo(292, 6);
  });

  it('places the girl mini foot (strip 868, 1160, sf 0.55) at game x 164 at e1, 85 at s8 and 171 at s9', () => {
    // The foot is the pylon tile origin plus the girl mini foot art px (2 world px each), so the test follows the shipped data.
    const foot = {
      x: WORLD_FAR_PLANES.pylon.tileOriginX + 2 * WORLD_FAR_PLANES.girlMini.footArtX,
      y: WORLD_FAR_PLANES.pylon.tileTopY + 2 * WORLD_FAR_PLANES.girlMini.footArtY,
    };
    expect(foot).toEqual({ x: 868, y: 1160 });
    const sf = WORLD_FAR_PLANES.pylon.sf;
    expect(screenOfWorld(foot, sf, e1).x).toBeCloseTo(164, 0);
    expect(screenOfWorld(foot, sf, e1).y).toBeCloseTo(522, 6);
    const atS8 = screenOfWorld(foot, sf, framingPose(levelsOf([...S7, '@blueprint', 'generator'])));
    const atS9 = screenOfWorld(foot, sf, framingPose(levelsOf(S9)));
    expect(Math.round(atS8.x)).toBe(85);
    expect(Math.round(atS9.x)).toBe(171);
    for (const x of [164, atS8.x, atS9.x]) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(VIEW.width);
      expect(x < VIEW_THIRD_LO || x > VIEW_THIRD_HI).toBe(true);
    }
    // Clear of the machine's left edge (game x 152 at s8, 178 at s9) by the half sprite width (8 at zoom 1, 6 at zoom 0.75), and of
    // the Inspector body edge (x 64 at s8).
    expect(atS8.x + 8).toBeLessThan(152);
    expect(atS9.x + 6).toBeLessThan(178);
    expect(atS8.x - 8).toBeGreaterThan(64);
  });

  it('places the cycle 2+ era I girl mini (e1, footArtXE1) clear of the first scrap, Sensor 7 and the view edge', () => {
    // footArtXE1 (AD4 F6): game x 72 at e1. The sprite half width is 8, so the left edge (64) clears the first scrap (game 50, edge
    // 58), the right edge (80) clears Sensor 7 (game 104, tripod from 88) and the left edge stays 24 px inside the view.
    const foot = {
      x: WORLD_FAR_PLANES.pylon.tileOriginX + 2 * WORLD_FAR_PLANES.girlMini.footArtXE1,
      y: WORLD_FAR_PLANES.pylon.tileTopY + 2 * WORLD_FAR_PLANES.girlMini.footArtY,
    };
    const x = screenOfWorld(foot, WORLD_FAR_PLANES.pylon.sf, e1).x;
    expect(Math.round(x)).toBe(72);
    expect(x - 8).toBeGreaterThan(screenOfWorld({ x: 1330, y: 1680 }, 1, e1).x + 8);
    expect(x + 8).toBeLessThan(screenOfWorld({ x: 1384, y: 1680 }, 1, e1).x - 16);
    expect(x - 8).toBeGreaterThanOrEqual(24);
  });
});

describe('placeCast', () => {
  it('s0-s7 stages: all ten cast members on stage, equal to the e1 rows of DENIZEN_ART §3', () => {
    // WP23a ids only; girl, puddles, sprout and lantern are null at e1 (their rows start in later eras).
    const WP23A_IDS: GroundId[] = ['inspector', 'dog', 'crow', 'payphone', 'sensor7', 'lamp', 'clock', 'stakeChain', 'hole', 'scraps'];
    for (const s of STAGES.slice(0, 8)) {
      const placed = placeCast(levelsOf(s.buys), 'e1');
      expect(WP23A_IDS.every((id) => placed[id] !== null), s.name).toBe(true);
    }
    expect(placeCast(levelsOf(S7), 'e1')).toEqual({ ...WORLD_PLACEMENTS.e1, girl: null, puddles: null, sprout: null, lantern: null });
  });

  it('s8 (generator): sensor7 and clock off-stage, scraps keep only x 1530', () => {
    const placed = placeCast(levelsOf([...S7, '@blueprint', 'generator']), 's8');
    expect(placed).toEqual({
      ...WORLD_PLACEMENTS.s8,
      sensor7: null,
      clock: null,
      scraps: { x: 1530, row: 'back', xs: [1530] },
      girl: null,
      puddles: null,
      sprout: null,
      lantern: null,
    });
  });

  it('s9 (era II full): scraps keep x 1420 and 1530; the inspector route stays', () => {
    const placed = placeCast(levelsOf(S9), 's9');
    expect(placed).toEqual({
      ...WORLD_PLACEMENTS.s9,
      scraps: { x: 1420, row: 'back', xs: [1420, 1530] },
      girl: null,
      puddles: null,
      sprout: null,
      lantern: null,
    });
    expect(placed.inspector?.route).toEqual([1448, 1496]);
  });

  it('cycle 3 fills the girl at 1538 (ground) at e1, s8 and s9; puddles, sprout and lantern have no row there yet', () => {
    const S8 = [...S7, '@blueprint', 'generator'];
    expect(placeCast(levelsOf(S7), 'e1', undefined, 3)).toEqual({ ...WORLD_PLACEMENTS.e1, girl: { x: 1538, row: 'back' }, puddles: null, sprout: null, lantern: null });
    expect(placeCast(levelsOf(S8), 's8', undefined, 3)).toEqual({
      ...placeCast(levelsOf(S8), 's8'), girl: { x: 1538, row: 'back' },
    });
    expect(placeCast(levelsOf(S9), 's9', undefined, 3).girl).toEqual({ x: 1538, row: 'back' });
  });

  it('defaults the pose to the framing pose of the levels', () => {
    for (const s of STAGES) {
      const lv = levelsOf(s.buys);
      expect(placeCast(lv, s.key), s.name).toEqual(placeCast(lv, s.key, framingPose(lv)));
    }
  });

  it('drops the inspector route when one end fails the wing rule, and keeps x', () => {
    // view x 1440: the left wing starts at 1464, so route end 1448 fails and x 1472 stays
    const placed = placeCast(levelsOf(S7), 'e1', { centerX: 2080, centerY: 1520, zoom: 1 });
    expect(placed.inspector).toEqual({ x: 1472, row: 'back' });
  });

  it('puts every member off-stage when no x is usable (the view starts past the scraps)', () => {
    const placed = placeCast(levelsOf(S7), 'e1', { centerX: 2200, centerY: 1520, zoom: 1 });
    expect(placed.scraps).toBeNull();
    expect(placed.inspector).toBeNull();
  });

  it('stakeChain and hole are off when the dog is off, even when their own x is usable', () => {
    // view x 1100..2380: the right wing is 2340..2356, so the dog (2364) fails and the stake (2348) passes
    const placed = placeCast(levelsOf(S7), 'e1', { centerX: 1740, centerY: 1520, zoom: 1 });
    expect(placed.dog).toBeNull();
    expect(placed.stakeChain).toBeNull();
    expect(placed.hole).toBeNull();
  });

  it('crow is off when the lamp is off (same post, same x)', () => {
    const placed = placeCast(levelsOf(S7), 'e1', { centerX: 1740, centerY: 1520, zoom: 1 });
    expect(placed.lamp).toBeNull();
    expect(placed.crow).toBeNull();
  });
});

describe('late framings and the girl (WP23b R6)', () => {
  const S15_LEVELS = levelsOf(S15);
  const S15_ROWS: Record<GroundId, WorldPlacement | null> = {
    sensor7: { x: 712, row: 'back' }, inspector: { x: 784, row: 'back', route: [760, 808] },
    dog: { x: 2856, row: 'front', inner: true }, clock: { x: 2890, row: 'back', inner: true }, payphone: { x: 3050, row: 'back' },
    lamp: { x: 3104, row: 'back' }, crow: { x: 3104, row: 'back' }, stakeChain: { x: 2840, row: 'front', inner: true },
    hole: { x: 2886, row: 'front', inner: true }, scraps: { x: 690, row: 'back', xs: [690] },
    puddles: { x: 960, row: 'back', inner: true }, sprout: { x: 996, row: 'back', inner: true }, lantern: { x: 965, row: 'front', dy: 40, inner: true },
    girl: { x: 976, row: 'front', inner: true, dy: 5 * WORLD_GIRL.stepDyWorldPx },
  };

  it('s10 (era III entry): inspector, dog, payphone and stake chain stand; the hole fails the wing rule and is off', () => {
    expect(placeCast(levelsOf(S10), 's10')).toEqual({
      inspector: { x: 1252, row: 'back' }, dog: { x: 2858, row: 'front' }, payphone: { x: 2858, row: 'back' },
      stakeChain: { x: 2842, row: 'front' }, hole: null, sensor7: null, clock: null, lamp: null, crow: null, scraps: null,
      girl: null, puddles: null, sprout: null, lantern: null,
    });
  });

  it('s11 (era III full): the WP23b III rows, the girl is a mini (no ground figure yet)', () => {
    expect(placeCast(levelsOf(S11), 's11')).toEqual({
      sensor7: { x: 712, row: 'back' }, inspector: { x: 784, row: 'back', route: [760, 808] }, dog: { x: 2856, row: 'front' },
      clock: { x: 2890, row: 'back' }, payphone: { x: 3050, row: 'back' }, lamp: { x: 3104, row: 'back' }, crow: { x: 3104, row: 'back' },
      stakeChain: { x: 2840, row: 'front' }, hole: { x: 2886, row: 'front' }, scraps: { x: 690, row: 'back', xs: [690, 830, 960] },
      puddles: { x: 960, row: 'back' }, sprout: { x: 996, row: 'back' }, girl: null, lantern: null,
    });
  });

  it('s12 and s13 (era IV) stand the girl in the back row at 880; s14 (era V start) at 976 in the front band, one step down', () => {
    expect(placeCast(levelsOf(S12), 's11').girl).toEqual({ x: 880, row: 'back' });
    expect(placeCast(levelsOf(S13), 's11').girl).toEqual({ x: 880, row: 'back' });
    expect(placeCast(levelsOf(S14), 's11').girl).toEqual({ x: 976, row: 'front', dy: WORLD_GIRL.stepDyWorldPx });
    expect(placeCast(levelsOf(S11), 's11').girl).toBeNull();
  });

  it('s15 and s16 (era V full): the inner rows of DENIZEN_ART §3, the girl at 976 front with five steps down', () => {
    expect(placeCast(S15_LEVELS, 's15')).toEqual({ ...S15_ROWS, scraps: { x: 690, row: 'back', xs: [690] } });
    expect(placeCast(levelsOf(S16), 's15')).toEqual(placeCast(S15_LEVELS, 's15'));
  });

  it('portrait is the s15 rows with the inspector standing without a route', () => {
    const pose = poseOf('portrait');
    expect(placeCast(S15_LEVELS, 'portrait', pose)).toEqual({ ...S15_ROWS, inspector: { x: 784, row: 'back' }, scraps: { x: 690, row: 'back', xs: [690] } });
    expectInView(placeCast(S15_LEVELS, 'portrait', pose), pose);
  });

  it('baseL stands the sensor, the inspector and the lantern rows inside the left view rect (680-1960)', () => {
    const pose = poseOf('baseL');
    expect(viewRectOf(pose)).toEqual({ x: 680, y: 1520 - 360, w: 1280, h: 720 });
    expect(placeCast(S15_LEVELS, 'baseL', pose)).toEqual({
      sensor7: { x: 712, row: 'back' }, inspector: { x: 784, row: 'back' },
      puddles: { x: 960, row: 'back', inner: true }, sprout: { x: 996, row: 'back', inner: true }, lantern: { x: 965, row: 'front', dy: 40, inner: true },
      dog: null, clock: null, stakeChain: null, hole: null, payphone: null, lamp: null, crow: null, scraps: null, girl: null,
    });
    expectInView(placeCast(S15_LEVELS, 'baseL', pose), pose);
  });

  it('baseR stands the dog, booth, lamp and crow rows inside the right view rect (1880-3160)', () => {
    const pose = poseOf('baseR');
    expect(viewRectOf(pose).x).toBe(1880);
    expect(placeCast(S15_LEVELS, 'baseR', pose)).toEqual({
      dog: { x: 2856, row: 'front', inner: true }, clock: { x: 2890, row: 'back', inner: true }, payphone: { x: 3050, row: 'back' },
      lamp: { x: 3104, row: 'back' }, crow: { x: 3104, row: 'back' }, stakeChain: { x: 2840, row: 'front', inner: true },
      hole: { x: 2886, row: 'front', inner: true }, sensor7: null, inspector: null, scraps: null, puddles: null, sprout: null,
      lantern: null, girl: null,
    });
    expectInView(placeCast(S15_LEVELS, 'baseR', pose), pose);
  });

  it('the inner rule: inner rows drop out when the machine edges (S11 bounds) or the view leave no gap', () => {
    // S11 machine 1036-2808: the inner gap is 1124-2720, so the S15 inner rows fall out; the wing rows stay.
    const placed = placeCast(levelsOf(S11), 's15', poseOf('s15'));
    for (const id of ['dog', 'clock', 'stakeChain', 'hole', 'puddles', 'sprout', 'lantern'] as const) expect(placed[id], id).toBeNull();
    expect(placed.sensor7).toEqual({ x: 712, row: 'back' });
    expect(placed.payphone).toEqual({ x: 3050, row: 'back' });
    // S15 machine, but the e1 view ends at 2536 (2560 less the wing clearance): the inner dog at 2856 is off-stage
    expect(placeCast(S15_LEVELS, 's15', { centerX: 1920, centerY: 1520, zoom: 1 }).dog).toBeNull();
  });

  it('the lantern stands at the girl x minus 11 (WORLD_ENDING.homeX.lantern, AD3b)', () => {
    expect(WORLD_ENDING.homeX.lantern).toBe(965);
    expect(placeCast(S15_LEVELS, 's15').lantern?.x).toBe(WORLD_ENDING.homeX.lantern);
    expect(placeCast(S15_LEVELS, 'baseL', poseOf('baseL')).lantern?.x).toBe(WORLD_ENDING.homeX.lantern);
    expect(WORLD_GIRL_PLACEMENTS.s15?.era5?.x).toBe(WORLD_ENDING.homeX.lantern + 11);
  });

  it('the girl stands on the ground only: cycle 3 puts her at 1538 (back) at e1, s8 and s9; cycle 2 keeps her a mini', () => {
    const S8 = [...S7, '@blueprint', 'generator'];
    expect(placeCast(levelsOf(S7), 'e1', undefined, 3).girl).toEqual({ x: 1538, row: 'back' });
    expect(placeCast(levelsOf(S8), 's8', undefined, 3).girl).toEqual({ x: 1538, row: 'back' });
    expect(placeCast(levelsOf(S9), 's9', undefined, 3).girl).toEqual({ x: 1538, row: 'back' });
    expect(placeCast(levelsOf(S7), 'e1', undefined, 2).girl).toBeNull();
    expect(placeCast(levelsOf(S9), 's9').girl).toBeNull();
  });

  it('era V steps: 8 px per met step (five steps at most, each step at most 12 px)', () => {
    expect(WORLD_GIRL.steps.length).toBeLessThanOrEqual(5);
    expect(WORLD_GIRL.stepDyWorldPx).toBeLessThanOrEqual(12);
    expect(placeCast(S15_LEVELS, 's15').girl?.dy).toBe(5 * WORLD_GIRL.stepDyWorldPx);
    expect(placeCast(levelsOf(S14), 's11').girl?.dy).toBe(WORLD_GIRL.stepDyWorldPx);
  });
});

describe('near pylon far plane (WP23b R6)', () => {
  it('recomputes the near pylon tile one period left of the pylon (k = -1) and reads game x 24-185 at the s11 pose', () => {
    const lits = farPlaneLiterals();
    const layer = PARALLAX_LAYERS.find((l) => l.id === 'pylons');
    if (layer === undefined) throw new Error('no pylons layer');
    const { periodPx } = layerPhase(layer.scrollFactor, ASSET_MANIFEST[layer.assetId].width, PIXEL_SCALE);
    expect(periodPx).toBe(512);
    expect(lits.pylonNearTileOriginX).toBe(lits.pylonTileOriginX - periodPx);
    expect(lits.pylonNearTileOriginX).toBe(WORLD_FAR_PLANES.girlMiniNear.tileOriginX);
    const foot = {
      x: lits.pylonNearTileOriginX + PIXEL_SCALE * WORLD_FAR_PLANES.girlMiniNear.footArtX,
      y: lits.pylonTileTopY + PIXEL_SCALE * WORLD_FAR_PLANES.girlMiniNear.footArtY,
    };
    const sx = screenOfWorld(foot, layer.scrollFactor, poseOf('s11')).x;
    expect(sx).toBeGreaterThanOrEqual(24);
    expect(sx).toBeLessThanOrEqual(185);
    expect(sx < VIEW_THIRD_LO || sx > VIEW_THIRD_HI).toBe(true);
  });
});

describe('placeCast property over all stages', () => {
  it.each(STAGES)('$name: every placed non-inner x is on its wing, 96+ from the hub, outside the centre third', (s) => {
    const levels = levelsOf(s.buys);
    const pose = framingPose(levels);
    const view = viewRectOf(pose);
    const machine = boundsToWorld(visibleMachineBounds(levels));
    const placed = placeCast(levels, framingKey(levels), undefined, 3);
    for (const [id, p] of Object.entries(placed) as [GroundId, WorldPlacement | null][]) {
      if (p === null || p.inner === true) continue;
      const xs = xsOf(p);
      if (p.xs !== undefined) expect(p.x, `${s.name} ${id} first x`).toBe(p.xs[0]);
      for (const x of xs) {
        const onWing = x < MACHINE_ANCHOR.x
          ? x >= view.x + 24 && x <= machine.left - 24
          : x >= machine.right + 24 && x <= view.x + view.w - 24;
        expect(onWing, `${s.name} ${id} x ${x} wing`).toBe(true);
        expect(Math.abs(x - MACHINE_ANCHOR.x), `${s.name} ${id} x ${x} hub`).toBeGreaterThanOrEqual(96);
        const sx = screenOfWorld({ x, y: GROUND_Y }, 1, pose).x;
        expect(sx < VIEW_THIRD_LO || sx > VIEW_THIRD_HI, `${s.name} ${id} x ${x} centre third`).toBe(true);
        expect(isOnScreen({ x, y: GROUND_Y }, view, 0), `${s.name} ${id} x ${x} on screen`).toBe(true);
      }
    }
  });

  it.each(STAGES)('$name: every placed inner x is inside the view and the machine gap, 96+ from the hub, outside the centre third', (s) => {
    const levels = levelsOf(s.buys);
    const pose = framingPose(levels);
    const view = viewRectOf(pose);
    const machine = boundsToWorld(visibleMachineBounds(levels));
    const placed = placeCast(levels, framingKey(levels), undefined, 3);
    for (const [id, p] of Object.entries(placed) as [GroundId, WorldPlacement | null][]) {
      if (p === null || p.inner !== true) continue;
      for (const x of xsOf(p)) {
        expect(x >= view.x + 24 && x <= view.x + view.w - 24, `${s.name} ${id} x ${x} view`).toBe(true);
        expect(x >= machine.left + 88 && x <= machine.right - 88, `${s.name} ${id} x ${x} inner gap`).toBe(true);
        expect(Math.abs(x - MACHINE_ANCHOR.x), `${s.name} ${id} x ${x} hub`).toBeGreaterThanOrEqual(96);
        const sx = screenOfWorld({ x, y: GROUND_Y }, 1, pose).x;
        expect(sx < VIEW_THIRD_LO || sx > VIEW_THIRD_HI, `${s.name} ${id} x ${x} centre third`).toBe(true);
      }
    }
  });
});

describe('farPlaneLiterals', () => {
  it('recomputes the skyline and pylon literals of WORLD_FAR_PLANES (768 / 428 and 576 / 846) and the near pylon (64)', () => {
    expect(farPlaneLiterals()).toEqual({
      windowTileOriginX: 768,
      windowTileTopY: 428,
      pylonTileOriginX: 576,
      pylonTileTopY: 846,
      pylonNearTileOriginX: 64,
    });
    expect(farPlaneLiterals()).toEqual({
      windowTileOriginX: WORLD_FAR_PLANES.window.tileOriginX,
      windowTileTopY: WORLD_FAR_PLANES.window.tileTopY,
      pylonTileOriginX: WORLD_FAR_PLANES.pylon.tileOriginX,
      pylonTileTopY: WORLD_FAR_PLANES.pylon.tileTopY,
      pylonNearTileOriginX: WORLD_FAR_PLANES.girlMiniNear.tileOriginX,
    });
  });
});

describe('actorBand (WP24 T1)', () => {
  const BAND_CASES: { name: string; buys: readonly string[]; framing: FramingKey }[] = [
    { name: 'S7', buys: S7, framing: 'e1' }, { name: 'S9', buys: S9, framing: 's9' },
    { name: 'S11', buys: S11, framing: 's11' }, { name: 'S15', buys: S15, framing: 's15' },
  ];

  it.each(BAND_CASES)('$name: the Inspector and the dog band contains the placement x', (s) => {
    const levels = levelsOf(s.buys);
    for (const actor of ['inspector', 'dog'] as const) {
      const base = WORLD_PLACEMENTS[s.framing][actor];
      const band = actorBand(s.framing, undefined, levels, actor);
      expect(base, actor).toBeDefined();
      expect(band, actor).not.toBeNull();
      if (band === null || base === undefined) continue;
      expect(band.min <= base.x && base.x <= band.max, actor).toBe(true);
    }
  });

  it('the inner dog at s15 stays inside the inner gap of the machine edges', () => {
    const levels = levelsOf(S15);
    const machine = boundsToWorld(visibleMachineBounds(levels));
    expect(WORLD_PLACEMENTS.s15?.dog?.inner).toBe(true);
    const band = actorBand('s15', undefined, levels, 'dog');
    expect(band).not.toBeNull();
    if (band === null) return;
    expect(band.min).toBeGreaterThanOrEqual(machine.left + WORLD_LAYOUT.innerClearPx);
    expect(band.max).toBeLessThanOrEqual(machine.right - WORLD_LAYOUT.innerClearPx);
  });

  it('is null for an actor with no placement at the framing (the lamp at s10) and for an unusable placement x (the s10 hole)', () => {
    expect(actorBand('s10', undefined, levelsOf(S10), 'lamp')).toBeNull();
    expect(actorBand('s10', undefined, levelsOf(S10), 'hole')).toBeNull();
  });

  it('usableX is true at the band min and max and false one px outside', () => {
    for (const s of BAND_CASES) {
      const levels = levelsOf(s.buys);
      const view = viewRectOf(framingPose(levels));
      const machine = boundsToWorld(visibleMachineBounds(levels));
      for (const actor of ['inspector', 'dog'] as const) {
        const band = actorBand(s.framing, undefined, levels, actor);
        const inner = WORLD_PLACEMENTS[s.framing][actor]?.inner === true;
        expect(band, `${s.name} ${actor}`).not.toBeNull();
        if (band === null) continue;
        expect(usableX(band.min, view, machine, inner), `${s.name} ${actor} min`).toBe(true);
        expect(usableX(band.max, view, machine, inner), `${s.name} ${actor} max`).toBe(true);
        expect(usableX(band.min - 1, view, machine, inner), `${s.name} ${actor} min - 1`).toBe(false);
        expect(usableX(band.max + 1, view, machine, inner), `${s.name} ${actor} max + 1`).toBe(false);
      }
    }
  });

  it.each(STAGES)('$name: the band is null exactly where placeCast drops the Inspector or the dog, and holds the placed x', (s) => {
    const levels = levelsOf(s.buys);
    const framing = framingKey(levels);
    const placed = placeCast(levels, framing);
    for (const actor of ['inspector', 'dog'] as const) {
      const band = actorBand(framing, undefined, levels, actor);
      const p = placed[actor];
      expect(band === null, actor).toBe(p === null);
      if (band !== null && p !== null) expect(band.min <= p.x && p.x <= band.max, actor).toBe(true);
    }
  });
});

describe('unseenChangeOk', () => {
  it('is true with the TECH INDEX open, otherwise only when both places are off-screen', () => {
    expect(unseenChangeOk({ treeOpen: true, oldOnScreen: true, newOnScreen: true })).toBe(true);
    expect(unseenChangeOk({ treeOpen: true, oldOnScreen: false, newOnScreen: true })).toBe(true);
    expect(unseenChangeOk({ treeOpen: false, oldOnScreen: false, newOnScreen: false })).toBe(true);
    expect(unseenChangeOk({ treeOpen: false, oldOnScreen: true, newOnScreen: false })).toBe(false);
    expect(unseenChangeOk({ treeOpen: false, oldOnScreen: false, newOnScreen: true })).toBe(false);
    expect(unseenChangeOk({ treeOpen: false, oldOnScreen: true, newOnScreen: true })).toBe(false);
  });
});
