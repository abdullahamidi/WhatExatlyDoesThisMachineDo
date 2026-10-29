// Tests for the Splice maths (WP28a): states and the four tooltip lines from real TechViews, the pulse law, the line route and its
// polyline, the pulse dots, the clock's tick schedule (C6) and the placement guard over every SPLICE_WORLD placement (A14). The guard
// reads the framing's machine parts from the stage lists (worldBehaviourMetrics STAGE_LISTS, as worldPlacement.test.ts does). Pure
// maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../simulation/state';
import { getTechView } from '../../simulation/progression/status';
import { TECHNOLOGIES } from '../../data/technologies';
import type { GameState, TechId, TechView } from '../../data/types';
import {
  SPLICE_CLOCK, SPLICE_FX, SPLICE_HUD_RECT, SPLICE_PAYPHONE, SPLICE_SHEETS, SPLICE_WORLD, SPLICE_YARD_LIMITS,
} from '../../data/spliceWorld';
import type { SpliceWorldEntry } from '../../data/spliceWorld';
import { SPLICE_TEXT } from '../../data/ux';
import { WORLD_ENV, WORLD_FAR_PLANES, WORLD_LAYOUT, WORLD_PLACEMENTS, WORLD_ROWS } from '../../data/livingWorld';
import { WORLD_SPOTS } from '../../data/worldBehaviour';
import { CRANK_FEEDBACK, GROUND_Y, PIXEL_SCALE } from '../../data/world';
import type { Vec2 } from '../../data/machineComponents';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import { componentBounds, isComponentVisible } from './machineLayout';
import { boundsToWorld, visibleMachineBounds } from './machineBounds';
import type { Bounds } from './camera';
import type { CameraPose } from './finale';
import { framingKey, framingPose, screenOfWorld } from './worldPlacement';
import { STAGE_LISTS } from './worldBehaviourMetrics';
import {
  clockTick, hasOwnArt, lineRouteAt, linePath, placementFeetY, pulseCount, pulsePositions, pulseSpeed, spliceBoxWorld,
  spliceState, spliceTooltip,
} from './spliceWorld';

// A buy list to tech levels: plain id += 1; '@tech' = 1; '@tech:n' = n ('@blueprint' is generatorBlueprint).
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

// A fresh state with some tech levels and resources (the rest as createInitialState gives them).
function craft(edit: {
  techs?: Partial<Record<TechId, number>>;
  res?: Partial<GameState['res']>;
  lifetime?: Partial<GameState['lifetime']>;
} = {}): GameState {
  const base = createInitialState(0);
  return {
    ...base,
    techLevels: { ...base.techLevels, ...edit.techs },
    res: { ...base.res, ...edit.res },
    lifetime: { ...base.lifetime, ...edit.lifetime },
  };
}

function viewOf(id: TechId, state: GameState, maxEra: number | null = null): TechView {
  return getTechView(state, id, TECHNOLOGIES, maxEra);
}

// ---- states and tooltip ----

describe('spliceState', () => {
  it('reads locked, available, affordable and woken from real views, and a demo-capped Splice is locked', () => {
    const locked = viewOf('spliceBicycle', craft());
    expect(locked.status).toBe('locked');
    expect(spliceState(locked)).toBe('locked');

    const available = viewOf('spliceBicycle', craft({ res: { me: 100 }, lifetime: { me: 15000 } }));
    expect(available.status).toBe('available');
    expect(available.affordable).toBe(false);
    expect(spliceState(available)).toBe('available');

    const affordable = viewOf('spliceBicycle', craft({ res: { me: 900 }, lifetime: { me: 15000 } }));
    expect(affordable.affordable).toBe(true);
    expect(spliceState(affordable)).toBe('affordable');

    const woken = viewOf('spliceBicycle', craft({ techs: { spliceBicycle: 1 } }));
    expect(spliceState(woken)).toBe('woken');

    const demo = viewOf('spliceHydrant', craft(), 2);
    expect(demo.demoLocked).toBe(true);
    expect(spliceState(demo)).toBe('locked');
    expect(spliceState({ ...affordable, demoLocked: true })).toBe('locked');
  });
});

describe('spliceTooltip', () => {
  it('reads click, need (shortfall rounded up), locked (have / need lifetime) and spliced lines', () => {
    const lockedState = craft({ lifetime: { me: 9100 } });
    const locked = viewOf('spliceBicycle', lockedState);
    expect(spliceTooltip(locked, spliceState(locked), lockedState)).toEqual([
      'SPLICE · BICYCLE', '900 ME', locked.nextEffectText, 'LINE NOT IN REACH · 9.1K / 15K LIFETIME ME',
    ]);

    const needState = craft({ res: { me: 780 }, lifetime: { me: 15000 } });
    const need = viewOf('spliceBicycle', needState);
    expect(spliceTooltip(need, spliceState(need), needState)[3]).toBe('NEED 120 MORE ME');

    const roundState = craft({ res: { me: 100.5 }, lifetime: { me: 15000 } });
    const round = viewOf('spliceBicycle', roundState);
    expect(spliceTooltip(round, spliceState(round), roundState)[3]).toBe('NEED 800 MORE ME');

    const affordableState = craft({ res: { me: 900 }, lifetime: { me: 15000 } });
    const affordable = viewOf('spliceBicycle', affordableState);
    expect(spliceTooltip(affordable, spliceState(affordable), affordableState)[3]).toBe('CLICK TO SPLICE');

    const wokenState = craft({ techs: { spliceBicycle: 1 } });
    const woken = viewOf('spliceBicycle', wokenState);
    expect(spliceTooltip(woken, spliceState(woken), wokenState)).toEqual([
      'SPLICE · BICYCLE', '900 ME', woken.currentEffectText, 'SPLICED',
    ]);
  });

  it('reads FULL GAME for a demo-capped Splice and the tech name when a tech requirement is unmet', () => {
    const demoState = craft();
    const demo = viewOf('spliceHydrant', demoState, 2);
    expect(spliceTooltip(demo, spliceState(demo), demoState)[0]).toBe('SPLICE · HYDRANT');
    expect(spliceTooltip(demo, spliceState(demo), demoState)[3]).toBe('FULL GAME');

    // The Coin Return: the era keystone and the lifetime are met, the Payphone is not woken.
    const coinState = craft({ techs: { nullChamber: 1 }, lifetime: { xf: 130000000 } });
    const coin = viewOf('spliceCoinReturn', coinState);
    expect(coin.status).toBe('locked');
    expect(spliceTooltip(coin, spliceState(coin), coinState)[3]).toBe('LINE NOT IN REACH · PAYPHONE FIRST');
  });
});

// ---- pulses ----

describe('pulseCount and pulseSpeed', () => {
  it('pulseCount is 1 + floor(3 L) between 1 and 4, monotone in L', () => {
    expect(pulseCount(0)).toBe(1);
    expect(pulseCount(0.34)).toBe(2);
    expect(pulseCount(0.67)).toBe(3);
    expect(pulseCount(1)).toBe(4);
    expect(pulseCount(-1)).toBe(1);
    expect(pulseCount(5)).toBe(4);
    expect(pulseCount(NaN)).toBe(1);
    let prev = 0;
    for (let L = 0; L <= 1.0001; L += 0.01) {
      const n = pulseCount(L);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(SPLICE_FX.maxPulses);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it('pulseSpeed is 80 + 80 L world px/s', () => {
    expect(pulseSpeed(0)).toBe(80);
    expect(pulseSpeed(0.5)).toBe(120);
    expect(pulseSpeed(1)).toBe(160);
    expect(pulseSpeed(2)).toBe(160);
    expect(pulseSpeed(NaN)).toBe(80);
  });
});

describe('pulsePositions', () => {
  const straight: readonly Vec2[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const sized = (): Vec2[] => Array.from({ length: SPLICE_FX.maxDots }, () => ({ x: 0, y: 0 }));

  it('spreads count dots evenly along the path by phase, into a pre-sized array with no new objects', () => {
    const out = sized();
    const before = [...out];
    expect(pulsePositions(straight, 4, 0, out)).toBe(4);
    expect(out.slice(0, 4).map((p) => p.x)).toEqual([0, 25, 50, 75]);
    expect(pulsePositions(straight, 4, 0.5, out)).toBe(4);
    expect(out.slice(0, 4).map((p) => p.x)).toEqual([50, 75, 0, 25]);
    expect(out.length).toBe(SPLICE_FX.maxDots);
    out.forEach((p, i) => expect(p).toBe(before[i]));
  });

  it('writes at most maxDots dots and none for a path with no length', () => {
    const out = sized();
    expect(pulsePositions(straight, 100, 0, out)).toBe(SPLICE_FX.maxDots);
    expect(pulsePositions(straight, 0, 0, out)).toBe(0);
    expect(pulsePositions([{ x: 5, y: 5 }], 3, 0, out)).toBe(0);
    expect(pulsePositions([{ x: 5, y: 5 }, { x: 5, y: 5 }], 3, 0, out)).toBe(0);
  });

  it('keeps every dot on the polyline (a bent path, a wrapping phase)', () => {
    const bent: readonly Vec2[] = [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 60, y: 40 }];
    const out = sized();
    const n = pulsePositions(bent, 5, 0.93, out);
    expect(n).toBe(5);
    for (const p of out.slice(0, n)) {
      const onFirst = p.x === 0 && p.y >= 0 && p.y <= 40;
      const onSecond = p.y === 40 && p.x >= 0 && p.x <= 60;
      expect(onFirst || onSecond).toBe(true);
    }
  });
});

// ---- data and line ----

// The outer base feet of the machine per framing (AD1 hand-off d): the visible machine's edges at the base.
const FOOT_TABLE: Record<GuardFraming, { left: number; right: number }> = {
  e1: { left: 1576, right: 2316 }, s8: { left: 1576, right: 2552 }, s8w: { left: 1576, right: 2648 }, s9: { left: 1576, right: 2808 },
  s10: { left: 1302, right: 2808 }, s11: { left: 1036, right: 2808 }, s15: { left: 848, right: 2992 },
  portrait: { left: 848, right: 2992 }, baseL: { left: 848, right: 2992 }, baseR: { left: 848, right: 2992 },
};

describe('linePath', () => {
  it('the drop wire hangs from the mast top to the payphone hood at s9, s10 and s11 only, and the ground cable elsewhere', () => {
    const line = SPLICE_WORLD.splicePayphone?.line;
    expect(line).toBeDefined();
    if (line === undefined) return;
    expect(lineRouteAt(line, 's9').drop).toEqual({ x: 2792, y: 1464 });
    expect(lineRouteAt(line, 's8').drop).toBeUndefined();
    expect(lineRouteAt(line, 's8w').drop).toBeUndefined();
    expect(lineRouteAt(line, 's15').drop).toBeUndefined();

    const at = (f: 's9' | 's10' | 's11', foot: number, objectX: number): readonly Vec2[] =>
      linePath(lineRouteAt(line, f), { x: foot, y: GROUND_Y }, { x: objectX, y: GROUND_Y });
    const s9 = at('s9', FOOT_TABLE.s9.right, 2944);
    expect(s9[0]).toEqual({ x: 2792, y: 1464 });
    expect(s9.at(-1)).toEqual({ x: 2936, y: 1582 });
    expect(at('s10', FOOT_TABLE.s10.right, 2858).at(-1)).toEqual({ x: 2850, y: 1582 });
    expect(at('s11', FOOT_TABLE.s11.right, 3050).at(-1)).toEqual({ x: 3042, y: 1582 });
  });
});

describe('clockTick (C6)', () => {
  it('the rest angle is the 4:41 minute hand and the step is one 6 degree tick of 250 ms', () => {
    expect(SPLICE_CLOCK.restDeg).toBe(WORLD_ENV.clock.minute * 6);
    expect(SPLICE_CLOCK.restDeg).toBe(246);
    expect(SPLICE_CLOCK.stepDeg).toBe(6);
    expect(SPLICE_CLOCK.snapBackMs).toBe(250);
  });

  it('10 simulated minutes at 100 ms steps: the angle returns to rest, the largest displacement is one step, ticks 6-10 s apart', () => {
    const seed = 4141;
    let maxDisp = 0;
    const starts: number[] = [];
    const runs: number[] = [];
    let runLength = 0;
    for (let t = 0; t <= 600000; t += 100) {
      const d = clockTick(t, seed).displacementDeg;
      expect([0, 6]).toContain(d);
      if (d === 0) expect(SPLICE_CLOCK.restDeg + d).toBe(SPLICE_CLOCK.restDeg);
      maxDisp = Math.max(maxDisp, d);
      if (d !== 0) {
        if (runLength === 0) starts.push(t);
        runLength += 1;
      } else if (runLength > 0) {
        runs.push(runLength);
        runLength = 0;
      }
    }
    expect(maxDisp).toBe(SPLICE_CLOCK.stepDeg);
    expect(starts.length).toBeGreaterThanOrEqual(60);
    expect(starts.length).toBeLessThanOrEqual(100);
    for (let i = 1; i < starts.length; i++) {
      const gap = (starts[i] ?? 0) - (starts[i - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(6000 - 100);
      expect(gap).toBeLessThanOrEqual(10000 + 100);
    }
    // A tick holds for snapBackMs (250 ms): two or three 100 ms samples.
    for (const r of runs) {
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic per seed, differs between seeds, and reads 0 before time zero', () => {
    const ticksOf = (seed: number): number[] => {
      const out: number[] = [];
      for (let t = 0; t <= 120000; t += 10) if (clockTick(t, seed).displacementDeg !== 0) out.push(t);
      return out;
    };
    expect(ticksOf(7)).toEqual(ticksOf(7));
    expect(ticksOf(7)).not.toEqual(ticksOf(8));
    expect(clockTick(-5, 7).displacementDeg).toBe(0);
    expect(clockTick(NaN, 7).displacementDeg).toBe(0);
  });
});

describe('Splice world data', () => {
  it('has the six era I-II objects, sheet frames inside the sheet, and frame rates at or below 8 fps', () => {
    expect(Object.keys(SPLICE_WORLD).sort()).toEqual(
      ['spliceBicycle', 'spliceClock', 'spliceOrgan', 'spliceRadio', 'splicePayphone', 'spliceSign'].sort(),
    );
    const sheet = SPLICE_SHEETS.splicesA;
    expect(sheet.assetId).toBe('world.splicesA');
    expect(sheet.cols * sheet.rows).toBe(20);
    for (const entry of Object.values(SPLICE_WORLD)) {
      if (entry === undefined || !hasOwnArt(entry)) continue;
      for (const f of [entry.frames.dead, ...entry.frames.woken, entry.frames.whole]) {
        expect(Number.isInteger(f) && f >= 0 && f < sheet.cols * sheet.rows).toBe(true);
      }
      expect(entry.frames.fps).toBeLessThanOrEqual(8);
    }
  });

  it('the woken payphone rings once every 60-120 s (AD2 F13)', () => {
    expect(SPLICE_PAYPHONE).toEqual({ ringMinMs: 60000, ringMaxMs: 120000 });
  });
  it('the existing clock and payphone keep their WP23 placements, and the copy has no "!" and no "..."', () => {
    for (const f of GUARD_FRAMINGS) {
      const clock = SPLICE_WORLD.spliceClock?.placements[f];
      if (clock) expect(WORLD_PLACEMENTS[f].clock?.x).toBe(clock.x);
      const phone = SPLICE_WORLD.splicePayphone?.placements[f];
      if (phone) expect(WORLD_PLACEMENTS[f].payphone?.x).toBe(phone.x);
    }
    expect(Object.keys(SPLICE_HUD_RECT).sort()).toEqual(Object.keys(SPLICE_YARD_LIMITS).sort());
    for (const text of Object.values(SPLICE_TEXT)) {
      expect(text).not.toContain('!');
      expect(text).not.toContain('...');
    }
  });
});

// ---- the placement guard (A14) ----

type GuardFraming = 'e1' | 's8' | 's8w' | 's9' | 's10' | 's11' | 's15' | 'portrait' | 'baseL' | 'baseR';
const GUARD_FRAMINGS: readonly GuardFraming[] = ['e1', 's8', 's8w', 's9', 's10', 's11', 's15', 'portrait', 'baseL', 'baseR'];
// The finale frames: no level keys them (framingKey reads the finished machine as s15), and they have no HUD rect or yard limit (AD2 F6)
// and no far-plane mini. Their machine is the finished one; their pose is the reference pose of WORLD_LAYOUT.framingPoses.
const FINALE_FRAMINGS: ReadonlySet<GuardFraming> = new Set<GuardFraming>(['portrait', 'baseL', 'baseR']);

// The levels each framing frames (A14): the largest stage of the framing's stages. s8w is the WP27 state before the transformer;
// s11 serves s11-s14 (the null chamber is the last of them); s15 serves s15-s16.
const FINISHED_STAGE: readonly string[] = [...STAGE_LISTS.S15, 'primaryFunction'];
const GUARD_STAGE: Record<GuardFraming, readonly string[]> = {
  e1: STAGE_LISTS.S7,
  s8: STAGE_LISTS.S8,
  s8w: STAGE_LISTS.S9.slice(0, STAGE_LISTS.S9.indexOf('transformer')),
  s9: STAGE_LISTS.S9,
  s10: STAGE_LISTS.S10,
  s11: [...STAGE_LISTS.S13, 'nullChamber'],
  s15: FINISHED_STAGE, portrait: FINISHED_STAGE, baseL: FINISHED_STAGE, baseR: FINISHED_STAGE,
};

// Guard distances (world px): the spot keep-out half width (A14), the crank clearance beyond the hit circle (WORLD_LAYOUT), the
// actors' standing heights above their feet (AD1 hand-off c: Inspector G - 66 .. G, dog G - 8 .. G + 32), and the object gap.
const SPOT_HALF_PX = 12;
const CRANK_CLEAR_PX = CRANK_FEEDBACK.hitRadius * PIXEL_SCALE + WORLD_LAYOUT.crankClearPx;
const STAND_PX: Record<'inspector' | 'dog', number> = { inspector: 66, dog: 40 };
const OBJECT_GAP_PX = 4;
// The far-plane girl mini frame (world.girlMini: 8 x 12 art px, origin bottom centre).
const MINI_ART = { w: 8, h: 12 };
// AD1's 2D exemptions (a spot's keep-out box cleared on y, not on x). None in WP28a: the s8w bicycle is null (AD2 F5), so every placement
// must clear the spots on x alone.
const SPOT_2D_CLEARED: ReadonlySet<string> = new Set<string>();
// The sign at s9 stands in front of the booth: its box meets the payphone's booth box (layering, AD2 F5). Sorted names, so the order of the pair does not matter.
const FRONT_OF_BOOTH: ReadonlySet<string> = new Set(['splicePayphone s9 / spliceSign s9']);
// AD2 N3 (accepted): the s9 bicycle's box top is G + 100 and the UI 150 buttons end at G + 101 (1 world px, AD2 underButtons 3 game px).
// A 'below the buttons' rule cannot pass it, so it is a documented exemption from the HUD lane limit (lane 130 > 25).
const HUD_EXEMPT: ReadonlySet<string> = new Set(['spliceBicycle s9']);

interface GameRect { left: number; top: number; right: number; bottom: number }
interface Frame { levels: Record<TechId, number>; pose: CameraPose; parts: Bounds[] }
interface Case { name: string; id: string; framing: GuardFraming; entry: SpliceWorldEntry; lane: number | 'back'; feet: Vec2; box: Bounds }

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function gameOverlaps(a: GameRect, b: GameRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// Distance from a point to a box (0 inside).
function boxDistance(box: Bounds, p: Vec2): number {
  const dx = Math.max(box.left - p.x, 0, p.x - box.right);
  const dy = Math.max(box.top - p.y, 0, p.y - box.bottom);
  return Math.hypot(dx, dy);
}

// The game px box of a world box at a pose (the zoom is positive, so the corners keep their order).
function gameRectOf(b: Bounds, pose: CameraPose): GameRect {
  const pts = [{ x: b.left, y: b.top }, { x: b.right, y: b.top }, { x: b.left, y: b.bottom }, { x: b.right, y: b.bottom }]
    .map((p) => screenOfWorld(p, 1, pose));
  return {
    left: Math.min(...pts.map((p) => p.x)),
    right: Math.max(...pts.map((p) => p.x)),
    top: Math.min(...pts.map((p) => p.y)),
    bottom: Math.max(...pts.map((p) => p.y)),
  };
}

// The far-plane girl mini's game rect at a pose: the pylon foot at scroll 0.55, the frame grows with the zoom. Null where the framing
// has no far mini: the era III near pylon mini stands at s11, and the ground girl at s15 is a placed cast member.
function miniRectOf(f: GuardFraming, pose: CameraPose): GameRect | null {
  const pylon = WORLD_FAR_PLANES.pylon;
  const footAt = (originX: number, artX: number, artY: number): Vec2 => ({
    x: originX + PIXEL_SCALE * artX,
    y: pylon.tileTopY + PIXEL_SCALE * artY,
  });
  let foot: Vec2 | null = null;
  if (f === 'e1') foot = footAt(pylon.tileOriginX, WORLD_FAR_PLANES.girlMini.footArtXE1, WORLD_FAR_PLANES.girlMini.footArtY);
  if (f === 's8' || f === 's8w' || f === 's9' || f === 's10') {
    foot = footAt(pylon.tileOriginX, WORLD_FAR_PLANES.girlMini.footArtX, WORLD_FAR_PLANES.girlMini.footArtY);
  }
  if (f === 's11') {
    foot = footAt(WORLD_FAR_PLANES.girlMiniNear.tileOriginX, WORLD_FAR_PLANES.girlMiniNear.footArtX, WORLD_FAR_PLANES.girlMiniNear.footArtY);
  }
  if (foot === null) return null;
  const at = screenOfWorld(foot, pylon.sf, pose);
  const half = (MINI_ART.w * PIXEL_SCALE * pose.zoom) / 2;
  return { left: at.x - half, right: at.x + half, top: at.y - MINI_ART.h * PIXEL_SCALE * pose.zoom, bottom: at.y };
}

// The pose the guard reads for a framing: the fitted pose of its machine; a finale frame takes its reference pose.
function poseOf(f: GuardFraming, levels: Record<TechId, number>): CameraPose {
  const fitted = framingPose(levels);
  const ref = WORLD_LAYOUT.framingPoses.find((r) => r.key === f);
  return FINALE_FRAMINGS.has(f) && ref !== undefined ? { ...fitted, centerX: ref.centerX, zoom: ref.zoom } : fitted;
}
const FRAME: Record<GuardFraming, Frame> = Object.fromEntries(GUARD_FRAMINGS.map((f) => {
  const levels = levelsOf(GUARD_STAGE[f]);
  const parts: Bounds[] = [];
  for (const def of Object.values(MACHINE_COMPONENTS)) {
    if (isComponentVisible(def, levels)) parts.push(boundsToWorld(componentBounds(def)));
  }
  return [f, { levels, pose: poseOf(f, levels), parts }];
})) as Record<GuardFraming, Frame>;

// Every placement of every object at the guard framings. A null or missing placement is a documented exemption and is skipped.
const CASES: Case[] = [];
for (const framing of GUARD_FRAMINGS) {
  for (const [id, entry] of Object.entries(SPLICE_WORLD)) {
    if (entry === undefined) continue;
    const placement = entry.placements[framing];
    if (!placement) continue;
    const feet = { x: placement.x, y: placementFeetY(placement) };
    CASES.push({ name: `${id} ${framing}`, id, framing, entry, lane: placement.lane, feet, box: spliceBoxWorld(entry, feet) });
  }
}

describe('placement guard (A14)', () => {
  it('the guard framings resolve to their own keys, the outer feet match the machine edges, and there are placements to guard', () => {
    for (const f of GUARD_FRAMINGS) {
      if (!FINALE_FRAMINGS.has(f)) expect(framingKey(FRAME[f].levels), f).toBe(f);
      const bounds = boundsToWorld(visibleMachineBounds(FRAME[f].levels));
      expect(bounds.left, f).toBe(FOOT_TABLE[f].left);
      expect(bounds.right, f).toBe(FOOT_TABLE[f].right);
    }
    expect(CASES.length).toBeGreaterThan(20);
  });

  it.each(CASES)('$name is clear of every machine part at its framing stage', (c) => {
    for (const part of FRAME[c.framing].parts) expect(overlaps(c.box, part), c.name).toBe(false);
  });

  it.each(CASES)('$name is clear of the crank hit circle plus 24 px', (c) => {
    expect(boxDistance(c.box, WORLD_LAYOUT.crankHub), c.name).toBeGreaterThanOrEqual(CRANK_CLEAR_PX);
  });

  it.each(CASES)('$name keeps a yard lane at or below the HUD limit where its box meets the HUD x range', (c) => {
    if (c.lane === 'back' || FINALE_FRAMINGS.has(c.framing) || HUD_EXEMPT.has(c.name)) return;
    const hud = SPLICE_HUD_RECT[c.framing];
    const limit = SPLICE_YARD_LIMITS[c.framing];
    expect(hud, c.name).toBeDefined();
    expect(limit, c.name).toBeDefined();
    if (hud === undefined || limit === undefined) return;
    if (c.box.left < hud.max && c.box.right > hud.min) expect(c.lane, c.name).toBeLessThanOrEqual(limit);
  });

  it.each(CASES.filter((c) => hasOwnArt(c.entry)))('$name keeps out of the spot keep-out boxes of both actors (x only; AD1 2D exemption listed)', (c) => {
    const row = WORLD_PLACEMENTS[c.framing];
    for (const actor of ['inspector', 'dog'] as const) {
      const placed = row[actor];
      if (placed === undefined) continue;
      const feetY = WORLD_ROWS[placed.row].y;
      const band = { top: feetY - STAND_PX[actor], bottom: feetY };
      for (const spot of WORLD_SPOTS[c.framing]?.[actor] ?? []) {
        const sx = placed.x + spot.dx;
        const clearX = c.box.left >= sx + SPOT_HALF_PX || c.box.right <= sx - SPOT_HALF_PX;
        if (clearX) continue;
        const clearY = c.box.top >= band.bottom || c.box.bottom <= band.top;
        expect(SPOT_2D_CLEARED.has(c.name) && clearY, `${c.name} vs ${actor} spot ${spot.id}`).toBe(true);
      }
    }
  });

  it.each(CASES)('$name is clear of the far-plane girl mini (game px at the framing pose)', (c) => {
    const pose = FRAME[c.framing].pose;
    const mini = miniRectOf(c.framing, pose);
    if (mini === null) return;
    expect(gameOverlaps(gameRectOf(c.box, pose), mini), c.name).toBe(false);
  });

  it.each(CASES)('$name: the line stays at or below GROUND_Y - 8 outside the machine x range (drop and risers exempt)', (c) => {
    const machine = boundsToWorld(visibleMachineBounds(FRAME[c.framing].levels));
    const foot = { x: c.entry.line.from === 'left' ? FOOT_TABLE[c.framing].left : FOOT_TABLE[c.framing].right, y: GROUND_Y };
    const route = lineRouteAt(c.entry.line, c.framing);
    const path = linePath(route, foot, c.feet);
    expect(path.length).toBeGreaterThanOrEqual(2);
    for (const p of path) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), c.name).toBe(true);
      if (route.drop !== undefined || route.riser !== undefined) continue;
      if (p.y < GROUND_Y - 8) expect(p.x < machine.left || p.x > machine.right, `${c.name} at ${p.x},${p.y}`).toBe(true);
    }
  });

  it.each(GUARD_FRAMINGS)('at %s the Splice objects keep 4 px from each other', (f) => {
    const here = CASES.filter((c) => c.framing === f);
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        const a = here[i];
        const b = here[j];
        // The clock and the payphone keep their WP23 layout (an existing pair is not a new placement): only pairs with new art.
        if (a === undefined || b === undefined || (!hasOwnArt(a.entry) && !hasOwnArt(b.entry))) continue;
        if (FRONT_OF_BOOTH.has([a.name, b.name].sort().join(' / '))) continue;
        const gapX = Math.max(a.box.left - b.box.right, b.box.left - a.box.right);
        const gapY = Math.max(a.box.top - b.box.bottom, b.box.top - a.box.bottom);
        expect(Math.max(gapX, gapY), `${a.name} / ${b.name}`).toBeGreaterThanOrEqual(OBJECT_GAP_PX);
      }
    }
  });
});
