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
import { VIEW, GROUND_Y, MACHINE_ANCHOR, CAMERA, CRANK_FEEDBACK, FLOATING_TEXT, PARALLAX_LAYERS, PIXEL_SCALE } from '../../data/world';
import { WORLD_FAR_PLANES, WORLD_GIRL_PLACEMENTS, WORLD_LAYOUT, WORLD_PLACEMENTS, WORLD_ROWS } from '../../data/livingWorld';
import { WORLD_SPOTS, WORLD_YARD } from '../../data/worldBehaviour';
import type { FramingKey, GroundId, WorldPlacement } from '../../data/livingWorld';
import { WORLD_GIRL } from '../../data/worldEras';
import { WORLD_ENDING } from '../../data/worldEnding';
import { TECHNOLOGIES } from '../../data/technologies';
import { ASSET_MANIFEST } from '../../assets/manifest';
import type { TechId } from '../../data/types';

// The smoke stage buy lists (scripts/smoke/stages.mjs:6-34), copied as literals.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 10), ...rep('copperWinding', 40), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 6), 'powerLines'];
// The late stages S10-S16 (stages.mjs), copied the same way.
const S10 = [...S9, '@substationBlueprint', 'boiler'];
const S11 = [...S10, ...rep('inductionHeater', 9), ...rep('firebox', 40), 'steamHammer', 'superheater', ...rep('condenser', 15),
  'turbine', 'reliefValves', ...rep('bellowsDrive', 9), '@pressureVesselBlueprint'];
const S12 = [...S11, 'resonatorSpire'];
const S13 = [...S12, ...rep('crankServo', 3), ...rep('harmonicCoil', 50), ...rep('pressureResonator', 6), 'echoCrank', 'phaseLock',
  ...rep('standingWave', 6), 'crystalLattice', ...rep('gridExciter', 15), '@harmonicConvergence'];
const S14 = [...S13, 'nullChamber'];
const S15 = [...S14, ...rep('containmentRing', 50), '@resonantSiphon:60', '@graviticAnchor:20', 'inversionCrank', 'lensArray',
  ...rep('horizonField', 40), 'skyAperture', ...rep('mainsBackfeed', 15), ...rep('steamLance', 15), '@finalAlignment'];
const S16 = [...S15, 'primaryFunction'];
// The era II entry (S8) and the state with a capacitorBank and a sparkGap before the transformer (framing s8w, WP27 F6.1).
const S8_BUYS = [...S7, '@blueprint', 'generator'];
const S8W_BUYS = S9.slice(0, S9.indexOf('transformer'));

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
    expect(WORLD_LAYOUT.framingPoses).toHaveLength(10);
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

  it('frames the capacitorBank and sparkGap poses (cx 2112 and 2104, zoom 1) as s8w, and the generator pose (2064) as s8', () => {
    expect(framingKeyOfPose({ centerX: 2104, centerY: 1500, zoom: 1 })).toBe('s8w');
    expect(framingKeyOfPose({ centerX: 2112, centerY: 1500, zoom: 1 })).toBe('s8w');
    expect(framingKeyOfPose({ centerX: 2064, centerY: 1500, zoom: 1 })).toBe('s8');
    expect(framingKey(levelsOf(S8W_BUYS))).toBe('s8w');
    expect(framingKey(levelsOf(S8_BUYS))).toBe('s8');
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
    // Clear of the machine's left edge (game x 152 at s8, 178 at s9) by the half sprite width (8 at zoom 1, 6 at zoom 0.75). At s8
    // the mini lies between the tripod's right edge (world 1486, game 62) and the Inspector body's left edge (world 1522, game 98).
    expect(atS8.x + 8).toBeLessThan(152);
    expect(atS9.x + 6).toBeLessThan(178);
    expect(atS8.x - 8).toBeGreaterThan(62);
    expect(atS8.x + 8).toBeLessThan(98);
    // The two edges come from the s8 placements: Sensor 7 at 1470 (tripod to 1486) and the Inspector at 1536 (body from 1522).
    expect(WORLD_PLACEMENTS.s8.sensor7?.x).toBe(1470);
    expect(WORLD_PLACEMENTS.s8.inspector?.x).toBe(1536);
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

// The far-plane girl mini at the s8w poses (WP27 F6.3): the same order as at s8, tripod, mini, Inspector body. The s8w pair is
// S8W_SENSOR7 1500 and S8W_INSPECTOR 1552 (hand-off, ART_AUDIT WP27 (a)); the drawn edges are the tripod's 16 px either side of its
// foot and the flipped Inspector body's 14 px left of his foot.
describe('the girl mini at s8w (WP27 F6.3)', () => {
  const S8W_SENSOR7 = 1500;
  const S8W_INSPECTOR = 1552;
  const TRIPOD_HALF_PX = 16;
  const BODY_LEFT_PX = 14;
  const MINI_HALF_PX = 8;
  const foot = {
    x: WORLD_FAR_PLANES.pylon.tileOriginX + 2 * WORLD_FAR_PLANES.girlMini.footArtX,
    y: WORLD_FAR_PLANES.pylon.tileTopY + 2 * WORLD_FAR_PLANES.girlMini.footArtY,
  };
  // Documented exemption: at cx 2112 the mini's cell reaches 0.4 px into the Inspector body (hand-off S8W_MINI_OVERLAP_PX = 1). The
  // mini stands on the far plane, behind him. cx 2104 has no overlap.
  const POSES: readonly { cx: number; allowPx: number }[] = [{ cx: 2104, allowPx: 0 }, { cx: 2112, allowPx: 1 }];

  it('the s8w data is the hand-off pair: Sensor 7 at S8W_SENSOR7 1500, Inspector at S8W_INSPECTOR 1552', () => {
    expect(WORLD_PLACEMENTS.s8w.sensor7?.x).toBe(S8W_SENSOR7);
    expect(WORLD_PLACEMENTS.s8w.inspector?.x).toBe(S8W_INSPECTOR);
  });

  it.each(POSES)('cx $cx: the mini clears the tripod and overlaps the Inspector body by at most $allowPx px', ({ cx, allowPx }) => {
    const pose: CameraPose = { centerX: cx, centerY: CAMERA.focus.y, zoom: 1 };
    const mini = screenOfWorld(foot, WORLD_FAR_PLANES.pylon.sf, pose).x;
    const tripodRight = screenOfWorld({ x: S8W_SENSOR7 + TRIPOD_HALF_PX, y: GROUND_Y }, 1, pose).x;
    const bodyLeft = screenOfWorld({ x: S8W_INSPECTOR - BODY_LEFT_PX, y: GROUND_Y }, 1, pose).x;
    expect(mini - MINI_HALF_PX, 'mini clear of the tripod').toBeGreaterThan(tripodRight);
    expect(mini + MINI_HALF_PX - bodyLeft, 'mini overlap with the Inspector body').toBeLessThanOrEqual(allowPx);
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

  it('s8 (generator): nothing off-stage but the trimmed scraps (sensor7 and clock stand, WP27 F6.1)', () => {
    const placed = placeCast(levelsOf(S8_BUYS), 's8');
    expect(placed).toEqual({
      ...WORLD_PLACEMENTS.s8,
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

  it('cycle 3 fills the girl on the ground at e1 and s9 (1552) and at s8 (1504, the mini slot); puddles, sprout and lantern have no row there yet', () => {
    expect(placeCast(levelsOf(S7), 'e1', undefined, 3)).toEqual({ ...WORLD_PLACEMENTS.e1, girl: { x: 1552, row: 'back' }, puddles: null, sprout: null, lantern: null });
    expect(placeCast(levelsOf(S8_BUYS), 's8', undefined, 3)).toEqual({
      ...placeCast(levelsOf(S8_BUYS), 's8'), girl: { x: 1504, row: 'back' },
    });
    expect(placeCast(levelsOf(S9), 's9', undefined, 3).girl).toEqual({ x: 1552, row: 'back' });
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

  it('s10 (era III entry): sensor7 and inspector stand (WP27 F6.5), dog, payphone and stake chain too; the hole fails the wing rule', () => {
    expect(placeCast(levelsOf(S10), 's10')).toEqual({
      sensor7: { x: 1234, row: 'back' }, inspector: { x: 1276, row: 'back' }, dog: { x: 2858, row: 'front' }, payphone: { x: 2858, row: 'back' },
      stakeChain: { x: 2842, row: 'front' }, hole: null, clock: null, lamp: null, crow: null, scraps: null,
      girl: null, puddles: null, sprout: null, lantern: null,
    });
  });

  it('s11 (era III full): the WP23b III rows (Sensor 7 750, Inspector 816 on the route 792-840), the girl is a mini (no ground figure yet)', () => {
    expect(placeCast(levelsOf(S11), 's11')).toEqual({
      sensor7: { x: 750, row: 'back' }, inspector: { x: 816, row: 'back', route: [792, 840] }, dog: { x: 2856, row: 'front' },
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

  it('the girl stands on the ground only: cycle 3 puts her at 1552 (back) at e1 and s9, 1504 at s8; cycle 2 keeps her a mini', () => {
    expect(placeCast(levelsOf(S7), 'e1', undefined, 3).girl).toEqual({ x: 1552, row: 'back' });
    expect(placeCast(levelsOf(S8_BUYS), 's8', undefined, 3).girl).toEqual({ x: 1504, row: 'back' });
    expect(placeCast(levelsOf(S9), 's9', undefined, 3).girl).toEqual({ x: 1552, row: 'back' });
    expect(placeCast(levelsOf(S7), 'e1', undefined, 2).girl).toBeNull();
    expect(placeCast(levelsOf(S9), 's9').girl).toBeNull();
  });

  it('cycle 3 places the girl at 1552 in every e1 and s9 stage and at 1504 in every s8 stage; cycles 1 and 2 place none', () => {
    const GIRL_X: Partial<Record<FramingKey, number>> = { e1: 1552, s8: 1504, s9: 1552 };
    for (const s of STAGES) {
      const x = GIRL_X[s.key];
      if (x === undefined) continue;
      const lv = levelsOf(s.buys);
      expect(placeCast(lv, s.key, undefined, 3).girl, s.name).toEqual({ x, row: 'back' });
      expect(placeCast(lv, s.key, undefined, 2).girl, s.name).toBeNull();
      expect(placeCast(lv, s.key, undefined, 1).girl, s.name).toBeNull();
    }
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

// WP28b B2: the placement guards of the spots v2 and the yard lanes, at each stage's framing pose. The spot pair rule and the yard limit are
// also in worldBehaviour.test.ts (the spots block).
describe('spots v2 and yard lanes (WP28b B2)', () => {
  const SPOT_STAGES: readonly { name: string; buys: readonly string[]; key: FramingKey }[] = [
    { name: 'S7', buys: S7, key: 'e1' }, { name: 'S8', buys: S8_BUYS, key: 's8' }, { name: 'S8W', buys: S8W_BUYS, key: 's8w' },
    { name: 'S9', buys: S9, key: 's9' }, { name: 'S10', buys: S10, key: 's10' }, { name: 'S11', buys: S11, key: 's11' },
    { name: 'S15', buys: S15, key: 's15' },
  ];
  // WP28b B-T8b re-pin: the spot corrections (e1 y1 1390@110, s8 y1 1552@56, no s8 y2) cleared both known occlusions.
  // WP28b r2-FX1 B: the three visit stands that lay over the far mini are moved or dropped (s8 organ, s11 radio dropped; s11 cairn 910@170),
  // so no Inspector spot is left over the mini and the list is empty.
  const KNOWN_MINI_OCCLUSIONS: readonly string[] = [];
  // The Inspector's body reaches 14 world px either side of his feet (the s8w mini test uses the same half width).
  const BODY_HALF_PX = 14;
  // The crank circle plus WORLD_LAYOUT.crankClearPx, and the gain-text block x-range (its bottom-centre sits at the crank + spawnOffset).
  const HUB_CLEAR_PX = CRANK_FEEDBACK.hitRadius * PIXEL_SCALE + WORLD_LAYOUT.crankClearPx;
  const GAIN_LEFT = WORLD_LAYOUT.crankHub.x + FLOATING_TEXT.spawnOffset.x - WORLD_LAYOUT.gainBox.w / 2;
  const GAIN_RIGHT = WORLD_LAYOUT.crankHub.x + FLOATING_TEXT.spawnOffset.x + WORLD_LAYOUT.gainBox.w / 2;
  const FRONT_LANE = WORLD_ROWS.front.y - GROUND_Y;

  // The far-plane girl mini of a framing (WORLD_FAR_PLANES): its game x at the pose and its half width (8 art-scale px at zoom 1). e1 is the
  // cycle 2+ foot (footArtXE1), s8 and s9 the far foot (footArtX), s11 the near pylon foot (girlMiniNear, era III). null where no mini stands.
  function miniOf(key: FramingKey, pose: CameraPose): { x: number; halfPx: number } | null {
    const far = WORLD_FAR_PLANES;
    const y = far.pylon.tileTopY + 2 * far.girlMini.footArtY;
    const halfPx = 8 * pose.zoom;
    if (key === 'e1') return { x: screenOfWorld({ x: far.pylon.tileOriginX + 2 * far.girlMini.footArtXE1, y }, far.pylon.sf, pose).x, halfPx };
    if (key === 's8' || key === 's9') {
      return { x: screenOfWorld({ x: far.pylon.tileOriginX + 2 * far.girlMini.footArtX, y }, far.pylon.sf, pose).x, halfPx };
    }
    if (key === 's11') {
      return { x: screenOfWorld({ x: far.girlMiniNear.tileOriginX + 2 * far.girlMiniNear.footArtX, y }, far.pylon.sf, pose).x, halfPx };
    }
    return null;
  }

  it.each(SPOT_STAGES)('$name: every Inspector and dog spot x lies in the wing band, off the crank circle + 24 px and the gain-text spawn', (s) => {
    const levels = levelsOf(s.buys);
    const pose = framingPose(levels);
    for (const actor of ['inspector', 'dog'] as const) {
      const band = actorBand(s.key, pose, levels, actor);
      for (const spot of WORLD_SPOTS[s.key]?.[actor] ?? []) {
        expect(band !== null && band.min <= spot.x && spot.x <= band.max, `${s.key} ${actor} ${spot.id} band`).toBe(true);
        expect(Math.abs(spot.x - WORLD_LAYOUT.crankHub.x) >= HUB_CLEAR_PX, `${s.key} ${actor} ${spot.id} crank`).toBe(true);
        expect(spot.x < GAIN_LEFT || spot.x > GAIN_RIGHT, `${s.key} ${actor} ${spot.id} gain spawn`).toBe(true);
      }
    }
  });

  // Director ruling 2026-10-30 R2 (docs/plan/WP28.md): the dog front-row (lane 32) spots listed here may lie under the UI 150 HUD buttons
  // (AD4 N14 accepted the dog home row meeting the button tops at s9, s10 and s15); no new entry may be added; yard lanes obey WORLD_YARD.
  const FRONT_ROW_BUTTON_EXEMPT: readonly string[] = [
    's8 dog home', 's8 dog b1', 's8 dog v1', 's8 dog v2', 's8w dog home', 's8w dog b1', 's9 dog home', 's9 dog v1', 's9 dog v2', 's9 dog v3',
    's10 dog home', 's10 dog b1', 's15 dog home', 's15 dog b1', 's15 dog stake', 's15 dog v1',
  ];
  it.each(SPOT_STAGES)('$name: a yard spot inside the HUD x-range is within WORLD_YARD.maxLane (the front row too, but the named dog spots)', (s) => {
    const yard = WORLD_YARD[s.key];
    expect(yard, `${s.key} yard`).toBeDefined();
    if (yard === undefined) return;
    for (const actor of ['inspector', 'dog'] as const) {
      for (const spot of WORLD_SPOTS[s.key]?.[actor] ?? []) {
        if (spot.lane <= 0 || spot.x < yard.hudMinX || spot.x > yard.hudMaxX) continue;
        if (spot.lane === FRONT_LANE && FRONT_ROW_BUTTON_EXEMPT.includes(`${s.key} ${actor} ${spot.id}`)) continue;
        expect(spot.lane <= yard.maxLane, `${s.key} ${actor} ${spot.id} lane ${spot.lane}`).toBe(true);
      }
    }
  });

  // WP28b F25: a visit stand (v<n>) clears Sensor 7's tripod: a yard stand (lane 48 or more, so the walker's body stays below the tripod's base,
  // the yard lanes start at yard48) or 24 px or more from the tripod's x.
  it.each(SPOT_STAGES)('$name: every visit stand of the Inspector clears Sensor 7 (a yard lane of 48 or more, or 24 px from the tripod)', (s) => {
    const sensor7 = WORLD_PLACEMENTS[s.key].sensor7;
    if (sensor7 === undefined) return;
    for (const spot of WORLD_SPOTS[s.key]?.inspector ?? []) {
      if (!spot.id.startsWith('v')) continue;
      expect(spot.lane >= 48 || Math.abs(spot.x - sensor7.x) >= 24, `${s.key} inspector ${spot.id} x ${spot.x} lane ${spot.lane}`).toBe(true);
    }
  });

  it('every framing that places the Inspector and Sensor 7 keeps them within 120 px (Sensor 7 stands beside him)', () => {
    for (const key of Object.keys(WORLD_PLACEMENTS) as FramingKey[]) {
      const ins = WORLD_PLACEMENTS[key].inspector;
      const s7 = WORLD_PLACEMENTS[key].sensor7;
      if (ins === undefined || s7 === undefined) continue;
      expect(Math.abs(ins.x - s7.x) <= 120, `${key} inspector ${ins.x} sensor7 ${s7.x}`).toBe(true);
    }
  });

  it('the far girl mini is not occluded by an Inspector spot (his body span overlaps the mini slot), except the known findings', () => {
    const found: string[] = [];
    for (const s of SPOT_STAGES) {
      const levels = levelsOf(s.buys);
      const pose = framingPose(levels);
      const mini = miniOf(s.key, pose);
      if (mini === null) continue;
      for (const spot of WORLD_SPOTS[s.key]?.inspector ?? []) {
        const feet = screenOfWorld({ x: spot.x, y: GROUND_Y }, 1, pose).x;
        const body = BODY_HALF_PX * pose.zoom;
        if (feet + body > mini.x - mini.halfPx && feet - body < mini.x + mini.halfPx) found.push(`${s.key} inspector ${spot.id}`);
      }
    }
    expect(found).toEqual(KNOWN_MINI_OCCLUSIONS);
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

describe('Sensor 7 beside the Inspector, the e1 objects and the era I-II pose sweep (WP27 F6.1, F6.3)', () => {
  // A framing that places the Inspector without Sensor 7 is a documented exemption, with its reason. None: the Art Director
  // accepted the spot in every framing (ART_AUDIT WP27 (a) to (c)).
  const SENSOR7_EXEMPT: Partial<Record<FramingKey, string>> = {};

  it('every framing that places the Inspector also places Sensor 7 (documented exemptions only)', () => {
    for (const key of Object.keys(WORLD_PLACEMENTS) as FramingKey[]) {
      if (WORLD_PLACEMENTS[key].inspector === undefined || SENSOR7_EXEMPT[key] !== undefined) continue;
      expect(WORLD_PLACEMENTS[key].sensor7, key).toBeDefined();
    }
    for (const key of Object.keys(SENSOR7_EXEMPT) as FramingKey[]) {
      expect(SENSOR7_EXEMPT[key], key).toBeTruthy();
      expect(WORLD_PLACEMENTS[key].sensor7, `${key} exemption is a real gap`).toBeUndefined();
    }
  });

  // Every object placed at e1 (cycle 3, so the girl stands) also stands at the era II entry (s8), its s8w poses and era II full (s9).
  // Each exemption names the framing, the object and the reason.
  const E1_IDS: readonly GroundId[] = ['sensor7', 'inspector', 'dog', 'payphone', 'lamp', 'crow', 'clock', 'stakeChain', 'hole', 'scraps', 'girl'];
  const E1_EXEMPT: readonly { framing: FramingKey; id: GroundId; reason: string }[] = [
    { framing: 's8w', id: 'clock', reason: 'the right wing (2672-2728) holds payphone 2678, lamp and crow 2720: no 24 px slot for a clock; the pose lasts 28-137 s (ART_AUDIT WP27 (a))' },
    { framing: 's8w', id: 'girl', reason: 'no 24 px slot at s8w: the left wing is the tripod and the Inspector, the right wing is full (fallback b, ART_AUDIT WP27 (a))' },
  ];

  it('every object placed at e1 also stands at s8, s8w and s9, except the documented exemptions', () => {
    const e1 = placeCast(levelsOf(S7), 'e1', undefined, 3);
    const framings: { key: FramingKey; placed: Record<GroundId, WorldPlacement | null> }[] = [
      { key: 's8', placed: placeCast(levelsOf(S8_BUYS), 's8', undefined, 3) },
      { key: 's8w', placed: placeCast(levelsOf(S8W_BUYS), 's8w', undefined, 3) },
      { key: 's9', placed: placeCast(levelsOf(S9), 's9', undefined, 3) },
    ];
    const isExempt = (key: FramingKey, id: GroundId): boolean => E1_EXEMPT.some((x) => x.framing === key && x.id === id);
    const problems: string[] = [];
    for (const { key, placed } of framings) {
      for (const id of E1_IDS) {
        if (e1[id] !== null && placed[id] === null && !isExempt(key, id)) problems.push(`${key} ${id}`);
      }
    }
    expect(problems).toEqual([]);
    // An exemption must name a real gap: placed at e1, off-stage at its framing, with a reason.
    for (const x of E1_EXEMPT) {
      expect(x.reason.length, `${x.framing} ${x.id} reason`).toBeGreaterThan(0);
      expect(e1[x.id], `${x.framing} ${x.id} placed at e1`).not.toBeNull();
      expect(framings.find((f) => f.key === x.framing)?.placed[x.id], `${x.framing} ${x.id} off-stage`).toBeNull();
    }
  });

  // The pose sweep: every cumulative prefix of S15, every single era II tech on S8 and every single era III tech on S10.
  // Each case runs framingPose -> framingKeyOfPose -> placeCast, the chain the renderer uses.
  const ERA2_IDS = Object.values(TECHNOLOGIES).filter((t) => t.era === 2).map((t) => t.id);
  const ERA3_IDS = Object.values(TECHNOLOGIES).filter((t) => t.era === 3).map((t) => t.id);
  const LV8 = levelsOf(S8_BUYS);
  const LV10 = levelsOf(S10);
  const SWEEP: { name: string; levels: Record<TechId, number> }[] = [
    ...Array.from({ length: S15.length + 1 }, (_, n) => ({ name: `S15 prefix ${n}`, levels: levelsOf(S15.slice(0, n)) })),
    ...ERA2_IDS.map((id) => ({ name: `S8 + ${id}`, levels: { ...LV8, [id]: 1 } })),
    ...ERA3_IDS.map((id) => ({ name: `S10 + ${id}`, levels: { ...LV10, [id]: 1 } })),
  ];

  it('the sweep reaches the era I-II framings e1, s8, s8w and s9', () => {
    const keys = new Set(SWEEP.map((c) => framingKeyOfPose(framingPose(c.levels))));
    for (const key of ['e1', 's8', 's8w', 's9'] as const) expect(keys.has(key), key).toBe(true);
  });

  it('the sweep: an Inspector placed implies Sensor 7 placed, and in eras I-II the Inspector, Sensor 7, dog, payphone, lamp and crow all stand', () => {
    const EARLY: readonly FramingKey[] = ['e1', 's8', 's8w', 's9'];
    const EARLY_IDS: readonly GroundId[] = ['inspector', 'sensor7', 'dog', 'payphone', 'lamp', 'crow'];
    const problems: string[] = [];
    for (const c of SWEEP) {
      const pose = framingPose(c.levels);
      const key = framingKeyOfPose(pose);
      const placed = placeCast(c.levels, key, pose);
      if (placed.inspector !== null && placed.sensor7 === null && SENSOR7_EXEMPT[key] === undefined) {
        problems.push(`${c.name} (${key}): Inspector without Sensor 7`);
      }
      if (EARLY.includes(key)) {
        for (const id of EARLY_IDS) if (placed[id] === null) problems.push(`${c.name} (${key}): ${id} off-stage`);
      }
    }
    expect(problems).toEqual([]);
  });
});
