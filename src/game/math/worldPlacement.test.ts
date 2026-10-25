// Tests for worldPlacement (WP23a): framing poses and keys, view rect, screen projection, cast placement over the smoke
// stage buy lists (scripts/smoke/stages.mjs), far-plane literals, and the unseen-change rule. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import {
  framingPose, framingKey, framingKeyOfPose, viewRectOf, isOnScreen, screenOfWorld, placeCast, unseenChangeOk, farPlaneLiterals,
} from './worldPlacement';
import type { Rect } from './worldPlacement';
import { visibleMachineBounds, boundsToWorld } from './machineBounds';
import type { CameraPose } from './finale';
import { VIEW, GROUND_Y, MACHINE_ANCHOR } from '../../data/world';
import { WORLD_FAR_PLANES, WORLD_PLACEMENTS } from '../../data/livingWorld';
import type { FramingKey, GroundId, WorldPlacement } from '../../data/livingWorld';
import type { TechId } from '../../data/types';

// The smoke stage buy lists (scripts/smoke/stages.mjs:6-34), copied as literals.
const rep = (id: string, n: number): string[] => Array.from({ length: n }, () => id);
const S7 = ['wornMotor', 'gearRatio', 'gearRatio', 'gearRatio', 'reinforcedCrank', 'motorTuning', 'motorTuning', 'motorTuning',
  'motorTuning', 'motorTuning', 'flywheel', 'pistonArray', 'improvedPistons'];
const S9 = [...S7, '@blueprint', 'generator', ...rep('motorRetrofit', 5), ...rep('copperWinding', 20), 'dynamoCrank',
  'capacitorBank', 'sparkGap', ...rep('transformer', 3), 'powerLines'];

// Expected framing key per stage: s0-s7 frame at e1, s8 (generator) at s8, s9 (era II full) at s9.
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

  it('maps off-step poses to the nearest reference (zoom weighs 1000 per unit, then centre x)', () => {
    expect(framingKeyOfPose({ centerX: 1920, centerY: 1520, zoom: 1 })).toBe('e1');
    expect(framingKeyOfPose({ centerX: 2064, centerY: 1464, zoom: 1 })).toBe('s8');
    expect(framingKeyOfPose({ centerX: 2192, centerY: 1504, zoom: 0.75 })).toBe('s9');
    // zoom 0.5, odd centre: e1 520, s9 542, s8 664
    expect(framingKeyOfPose({ centerX: 1900, centerY: 1500, zoom: 0.5 })).toBe('e1');
    // zoom 0.5, centre 2100: s9 342 beats e1 680 and s8 536
    expect(framingKeyOfPose({ centerX: 2100, centerY: 1500, zoom: 0.5 })).toBe('s9');
    // zoom 0.9, centre 2000: s8 164 beats e1 180 and s9 342
    expect(framingKeyOfPose({ centerX: 2000, centerY: 1500, zoom: 0.9 })).toBe('s8');
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
});

describe('placeCast', () => {
  it('s0-s7 stages: all ten cast members on stage, equal to the e1 rows of DENIZEN_ART §3', () => {
    for (const s of STAGES.slice(0, 8)) {
      const placed = placeCast(levelsOf(s.buys), 'e1');
      expect(Object.values(placed).every((v) => v !== null), s.name).toBe(true);
    }
    expect(placeCast(levelsOf(S7), 'e1')).toEqual(WORLD_PLACEMENTS.e1);
  });

  it('s8 (generator): sensor7 and clock off-stage, scraps keep only x 1530', () => {
    const placed = placeCast(levelsOf([...S7, '@blueprint', 'generator']), 's8');
    expect(placed).toEqual({
      ...WORLD_PLACEMENTS.s8,
      sensor7: null,
      clock: null,
      scraps: { x: 1530, row: 'back', xs: [1530] },
    });
  });

  it('s9 (era II full): scraps keep x 1420 and 1530; the inspector route stays', () => {
    const placed = placeCast(levelsOf(S9), 's9');
    expect(placed).toEqual({
      ...WORLD_PLACEMENTS.s9,
      scraps: { x: 1420, row: 'back', xs: [1420, 1530] },
    });
    expect(placed.inspector?.route).toEqual([1448, 1496]);
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

describe('placeCast property over all stages', () => {
  it.each(STAGES)('$name: every placed x is on its wing, 96+ from the hub, outside the centre third', (s) => {
    const levels = levelsOf(s.buys);
    const pose = framingPose(levels);
    const view = viewRectOf(pose);
    const machine = boundsToWorld(visibleMachineBounds(levels));
    const placed = placeCast(levels, framingKey(levels));
    for (const [id, p] of Object.entries(placed) as [GroundId, WorldPlacement | null][]) {
      if (p === null) continue;
      const xs = [...(p.xs ?? [p.x]), ...(p.route ?? [])];
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
});

describe('farPlaneLiterals', () => {
  it('recomputes the skyline and pylon literals of WORLD_FAR_PLANES (768 / 428 and 576 / 846)', () => {
    expect(farPlaneLiterals()).toEqual({
      windowTileOriginX: 768,
      windowTileTopY: 428,
      pylonTileOriginX: 576,
      pylonTileTopY: 846,
    });
    expect(farPlaneLiterals()).toEqual({
      windowTileOriginX: WORLD_FAR_PLANES.window.tileOriginX,
      windowTileTopY: WORLD_FAR_PLANES.window.tileTopY,
      pylonTileOriginX: WORLD_FAR_PLANES.pylon.tileOriginX,
      pylonTileTopY: WORLD_FAR_PLANES.pylon.tileTopY,
    });
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
