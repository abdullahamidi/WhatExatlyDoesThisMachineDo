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
  SPLICE_CLOCK, SPLICE_FX, SPLICE_HUD_RECT, SPLICE_LINE_STYLE, SPLICE_PAYPHONE, SPLICE_SHEETS, SPLICE_WORLD, SPLICE_YARD_LIMITS,
} from '../../data/spliceWorld';
import type { SpliceObjectId, SpliceWorldEntry } from '../../data/spliceWorld';
import { GROUND_PULSE_SPEED_PX_PER_S } from '../../data/worldShared';
import { SPLICE_TEXT } from '../../data/ux';
import { WORLD_ENV, WORLD_FAR_PLANES, WORLD_LAYOUT, WORLD_PLACEMENTS } from '../../data/livingWorld';
import { WORLD_SPOTS } from '../../data/worldBehaviour';
import { WORLD_ENDING } from '../../data/worldEnding';
import { CRANK_FEEDBACK, GROUND_Y, PIXEL_SCALE } from '../../data/world';
import type { Vec2 } from '../../data/machineComponents';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import { componentBounds, isComponentVisible } from './machineLayout';
import { boundsToWorld, visibleMachineBounds } from './machineBounds';
import type { Bounds } from './camera';
import type { CameraPose } from './finale';
import { framingKey, framingPose, screenOfWorld, usableX, viewRectOf } from './worldPlacement';
import { STAGE_LISTS } from './worldBehaviourMetrics';
import {
  allocatePulses, clockTick, crankPulseDelayMs, debrisSpeckCount, debrisSpecks, flangeDistances, hasOwnArt, lineRouteAt, linePath,
  placementFeetY, postgameMoveAlpha, postgameMoveAt, pulseCount, pulsePositions, pulseSpeed, spliceBoxWorld, spliceState, spliceTooltip,
  spriteOriginOf, stakeDistances, steadyDotPhase, waveOffsetPx,
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

// The entry of a Splice object; every SpliceObjectId has one (tested below), so a miss is a broken table.
function entryOf(id: SpliceObjectId): SpliceWorldEntry {
  const entry = SPLICE_WORLD[id];
  if (entry === undefined) throw new Error(`no Splice entry for ${id}`);
  return entry;
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

// ---- the pulse budget (WP28b F27) ----

describe('allocatePulses (WP28b F27)', () => {
  it('16 lines wanting 4 each within 24 dots: every line draws at least one, the total is 24, the first lines take the extra dots', () => {
    const out: number[] = [];
    const granted = allocatePulses(Array.from({ length: 16 }, () => 4), 24, out);
    expect(granted.reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(24);
    expect(granted.reduce((sum, n) => sum + n, 0)).toBe(24);
    expect(granted.every((n) => n >= 1)).toBe(true);
    expect(granted.slice(0, 3)).toEqual([4, 4, 3]);
    expect(granted.slice(3)).toEqual(Array.from({ length: 13 }, () => 1));
  });

  it('3 lines wanting 4, 1 and 4 within 24 dots get 4, 1 and 4', () => {
    expect(allocatePulses([4, 1, 4], 24, [])).toEqual([4, 1, 4]);
  });

  it('2 lines within 1 dot: the first line gets the dot (edge)', () => {
    expect(allocatePulses([4, 4], 1, [])).toEqual([1, 0]);
    expect(allocatePulses([4, 4], 0, [])).toEqual([0, 0]);
  });

  it('the grant follows line order, is the same on every call, and writes into the given array', () => {
    const out: number[] = [9, 9, 9, 9, 9];
    const first = allocatePulses([4, 4, 4], 5, out);
    expect(first).toBe(out);
    expect(first).toEqual([3, 1, 1]);
    const copy = [...first];
    expect(allocatePulses([4, 4, 4], 5, out)).toEqual(copy);
    expect(allocatePulses([1, 1], 24, out)).toEqual([1, 1]);
    expect(out.length).toBe(2);
  });

  it('never grants more than a line wants or than the budget, and a line that wants nothing gets nothing', () => {
    expect(allocatePulses([0, 3, 2], 10, [])).toEqual([0, 3, 2]);
    expect(allocatePulses([4, 4], Number.NaN, [])).toEqual([0, 0]);
    expect(allocatePulses([], 24, [])).toEqual([]);
    for (let budget = 0; budget <= 30; budget++) {
      const wanted = [4, 1, 3, 2, 4, 1, 1, 4, 2, 3, 1, 4, 4, 1, 2, 3];
      const granted = allocatePulses(wanted, budget, []);
      expect(granted.reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(budget);
      granted.forEach((n, i) => expect(n <= (wanted[i] ?? 0)).toBe(true));
      if (budget >= wanted.length) expect(granted.every((n) => n >= 1)).toBe(true);
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
  // A missing id is a compile error here (Record over SpliceObjectId), so the list and the type cannot drift apart.
  const ALL_IDS: Record<SpliceObjectId, true> = {
    spliceBicycle: true, spliceOrgan: true, spliceClock: true, spliceRadio: true, splicePayphone: true, spliceSign: true,
    splicePump: true, spliceWhistle: true, spliceHydrant: true, spliceBell: true, spliceGramophone: true, spliceChimes: true,
    spliceVane: true, spliceKite: true, spliceCairn: true, spliceCoinReturn: true,
  };

  it('has the sixteen Splice objects (every id has an entry), sheet frames inside their sheet, and frame rates at or below 8 fps', () => {
    expect(Object.keys(SPLICE_WORLD).sort()).toEqual(Object.keys(ALL_IDS).sort());
    expect(SPLICE_SHEETS.splicesA).toMatchObject({ assetId: 'world.splicesA', cols: 20, rows: 1 });
    expect(SPLICE_SHEETS.splicesB).toMatchObject({ assetId: 'world.splicesB', cellW: 18, cellH: 56, cols: 22, rows: 1 });
    expect(SPLICE_SHEETS.splicesC).toMatchObject({ assetId: 'world.splicesC', cellW: 24, cellH: 18, cols: 24, rows: 1 });
    for (const entry of Object.values(SPLICE_WORLD)) {
      if (entry === undefined || !hasOwnArt(entry)) continue;
      const sheet = SPLICE_SHEETS[entry.sheet];
      for (const f of [entry.frames.dead, ...entry.frames.woken, entry.frames.whole]) {
        expect(Number.isInteger(f) && f >= 0 && f < sheet.cols * sheet.rows).toBe(true);
      }
      expect(entry.frames.fps).toBeLessThanOrEqual(8);
    }
  });

  it('every bbox and foot pivot lies inside its cell, and every object has at least one woken frame', () => {
    for (const [id, entry] of Object.entries(SPLICE_WORLD)) {
      if (entry === undefined || !hasOwnArt(entry)) continue;
      const sheet = SPLICE_SHEETS[entry.sheet];
      expect(entry.bboxArt.x + entry.bboxArt.w, id).toBeLessThanOrEqual(sheet.cellW);
      expect(entry.bboxArt.y + entry.bboxArt.h, id).toBeLessThanOrEqual(sheet.cellH);
      expect(entry.footArt.x, id).toBeLessThanOrEqual(sheet.cellW);
      expect(entry.footArt.y, id).toBeLessThanOrEqual(sheet.cellH);
      expect(entry.frames.woken.length, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('every once object (vane, kite, cairn) plays at least two woken frames, and no other object is once', () => {
    const onces: string[] = [];
    for (const [id, entry] of Object.entries(SPLICE_WORLD)) {
      if (entry === undefined || !hasOwnArt(entry) || entry.frames.once !== true) continue;
      onces.push(id);
      expect(entry.frames.woken.length, id).toBeGreaterThanOrEqual(2);
    }
    expect(onces.sort()).toEqual(['spliceCairn', 'spliceKite', 'spliceVane']);
  });

  it('perchTop.replaces names a crow perch only on the vane (boothRoof) and the kite (lampTop)', () => {
    const replaces: string[] = [];
    for (const [id, entry] of Object.entries(SPLICE_WORLD)) {
      const top = entry?.perchTop;
      if (top?.replaces !== undefined) replaces.push(`${id}:${top.replaces}`);
    }
    expect(replaces).toEqual(['spliceVane:boothRoof', 'spliceKite:lampTop']);
  });

  it('the hosted objects sit at the lamp x (chimes, kite) and the payphone x (vane, coin flap) on the back row', () => {
    const hosts: [SpliceObjectId, 'lamp' | 'payphone'][] = [
      ['spliceChimes', 'lamp'], ['spliceKite', 'lamp'], ['spliceVane', 'payphone'], ['spliceCoinReturn', 'payphone'],
    ];
    for (const f of GUARD_FRAMINGS) {
      for (const [id, host] of hosts) {
        const cell = SPLICE_WORLD[id]?.placements[f];
        const hostCell = WORLD_PLACEMENTS[f][host];
        if (cell === undefined || cell === null || hostCell === undefined) continue;
        expect(cell.x, `${id} ${f}`).toBe(hostCell.x);
        expect(cell.lane, `${id} ${f}`).toBe('back');
      }
    }
  });

  it('a hosted sprite is drawn at feet + offsetWorld; its box follows (AD3 O-b); a plain object keeps its feet', () => {
    const feet = { x: 3104, y: GROUND_Y };
    expect(spriteOriginOf(entryOf('spliceChimes'), feet)).toEqual({ x: 3124, y: GROUND_Y - 50 });
    expect(spriteOriginOf(entryOf('spliceBicycle'), feet)).toBe(feet);
    // The s11 hosted boxes (AD3 O-g table): chimes 3108-3138 x -86..-50, kite 3086-3122 x -198..-92, vane 3034-3066 x -138..-102, coin 3070-3080 x -54..-46.
    const boxAt = (id: SpliceObjectId, x: number) => spliceBoxWorld(entryOf(id), { x, y: GROUND_Y });
    expect(boxAt('spliceChimes', 3104)).toEqual({ left: 3108, top: GROUND_Y - 86, right: 3138, bottom: GROUND_Y - 50 });
    expect(boxAt('spliceKite', 3104)).toEqual({ left: 3086, top: GROUND_Y - 198, right: 3122, bottom: GROUND_Y - 92 });
    expect(boxAt('spliceVane', 3050)).toEqual({ left: 3034, top: GROUND_Y - 138, right: 3066, bottom: GROUND_Y - 102 });
    expect(boxAt('spliceCoinReturn', 3050)).toEqual({ left: 3070, top: GROUND_Y - 54, right: 3080, bottom: GROUND_Y - 46 });
    // The s11 back-row pump and whistle (AD3 O-g): pump 930-964 x -60..0, whistle 2954-2988 x -112..0.
    expect(boxAt('splicePump', 946)).toEqual({ left: 930, top: GROUND_Y - 60, right: 964, bottom: GROUND_Y });
    expect(boxAt('spliceWhistle', 2970)).toEqual({ left: 2954, top: GROUND_Y - 112, right: 2988, bottom: GROUND_Y });
  });

  it('the era V and era IV line looks and the crank pulse speed are the hand-off values (AD3 O-d; WP28b D6a)', () => {
    expect(GROUND_PULSE_SPEED_PX_PER_S).toBe(480);
    expect(SPLICE_FX.postgameMove).toEqual({ outFromS: 4, outToS: 4.5, inFromS: 5, inToS: 5.6 });
    expect(SPLICE_LINE_STYLE.era4.breathPeriodMs).toBe(2400);
    expect(SPLICE_LINE_STYLE.era5.speckCount).toEqual({ min: 6, max: 10, everyPx: 32 });
    expect(SPLICE_LINE_STYLE.era3.flangeEveryPx).toBe(32);
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
// The 2D exemptions (a spot's keep-out box cleared on y, not on x): an object whose box meets a spot's x band but clears the walker's
// standing box on y. WP28a had none. WP28b (spots v2) lists the x-only overlaps the guard measured as 2D clear: AD3 O-g's six era III-V
// rows, the kite and the coin flap above the dog's 3080 spot (boxes end at G-92 and G-46; the dog's band starts at G+24), and the era I-II
// rows the v2 table brushes on x only. Any other x-overlap fails the guard (no exemption for a real 2D conflict).
// AD4 F39: the e1 bicycle's box clears the e1 dog's y3 spot (2520@48) on y, so it is a 2D-clear overlap too.
// WP28b r2-FX1 (A14): the s11 sign's box ends 12 px above the dog's chimes and kite stand band (yard lane 128), and the vane sits on the booth
// roof (its box ends 102 px above the ground), so both clear that stand on y. The pump's exemption went with the radio stand it cleared (dropped).
const SPOT_2D_CLEARED: ReadonlySet<string> = new Set<string>([
  'spliceBell s11', 'spliceCairn s11', 'spliceGramophone s11', 'spliceGramophone s15', 'spliceHydrant s11', 'spliceWhistle s11',
  'spliceKite s11', 'spliceCoinReturn s11', 'spliceChimes s11', 'spliceSign s11', 'spliceVane s11',
  'spliceBicycle e1', 'spliceBicycle s9', 'spliceBicycle s11', 'spliceOrgan e1', 'spliceOrgan s9', 'spliceOrgan s11', 'spliceOrgan s15',
  'spliceRadio s9', 'spliceRadio s11', 'spliceRadio s15', 'spliceSign s9',
]);
// The sign at s9 stands in front of the booth: its box meets the payphone's booth box (layering, AD2 F5). Sorted names, so the order of the pair does not matter.
const FRONT_OF_BOOTH: ReadonlySet<string> = new Set(['splicePayphone s9 / spliceSign s9']);
// The hosted objects (WP28b, AD3 O-c): the vane stands on the booth apex and the coin flap sits on the phone unit, so their boxes meet the
// payphone's box by design; the 4 px object gap does not apply to those pairs.
const HOSTED_ON_BOOTH: ReadonlySet<string> = new Set(
  ['s11', 's15', 'portrait', 'baseR'].flatMap((f) => ['spliceVane', 'spliceCoinReturn'].map((h) => [`splicePayphone ${f}`, `${h} ${f}`].sort().join(' / '))),
);
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

  it.each(CASES.filter((c) => hasOwnArt(c.entry)))('$name keeps out of the spot keep-out boxes of both actors (x only; the 2D exemptions listed)', (c) => {
    const bad: string[] = [];
    for (const actor of ['inspector', 'dog'] as const) {
      for (const spot of WORLD_SPOTS[c.framing]?.[actor] ?? []) {
        // Spots v2 are absolute: feet x and a lane (GROUND_Y + lane); the walker stands STAND_PX[actor] above its feet.
        const feetY = GROUND_Y + spot.lane;
        const band = { top: feetY - STAND_PX[actor], bottom: feetY };
        const clearX = c.box.left >= spot.x + SPOT_HALF_PX || c.box.right <= spot.x - SPOT_HALF_PX;
        if (clearX) continue;
        const clearY = c.box.top >= band.bottom || c.box.bottom <= band.top;
        if (!(SPOT_2D_CLEARED.has(c.name) && clearY)) bad.push(`${actor} spot ${spot.id} (${spot.x}@${spot.lane})`);
      }
    }
    expect(bad, c.name).toEqual([]);
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
        const pair = [a.name, b.name].sort().join(' / ');
        if (FRONT_OF_BOOTH.has(pair) || HOSTED_ON_BOOTH.has(pair)) continue;
        const gapX = Math.max(a.box.left - b.box.right, b.box.left - a.box.right);
        const gapY = Math.max(a.box.top - b.box.bottom, b.box.top - a.box.bottom);
        expect(Math.max(gapX, gapY), `${a.name} / ${b.name}`).toBeGreaterThanOrEqual(OBJECT_GAP_PX);
      }
    }
  });
});

// ---- postgame placements (AD2 R2 F20) ----

describe('postgame placements (AD2 R2 F20)', () => {
  // The postgame portrait (the whole Splice frames; lines are hidden there): the left wing between x 648 and the left anchor foot 848, the frame
  // bottom at G + 120 (kept at G + 112), the postgame dog's band (home 732, chase dx 0..36, front row G + 32) and the Inspector's pat box (x 742).
  const DOG_BAND: Bounds = {
    left: WORLD_ENDING.postgameDogHomeX - 24, right: WORLD_ENDING.postgameDogHomeX + 36 + 24, top: GROUND_Y - 8, bottom: GROUND_Y + 40,
  };
  const PAT_BOX: Bounds = { left: 722, right: 762, top: GROUND_Y - 66, bottom: GROUND_Y + 32 };
  // Every object with a postgame placement, its world box from its feet (the guard's spliceBoxWorld).
  const POSTGAME: { name: string; box: Bounds }[] = [];
  for (const [id, entry] of Object.entries(SPLICE_WORLD)) {
    if (entry === undefined || entry.postgame === undefined) continue;
    POSTGAME.push({ name: `${id} postgame`, box: spliceBoxWorld(entry, { x: entry.postgame.x, y: placementFeetY(entry.postgame) }) });
  }
  // The radio keeps its portrait cell; its box is the fixed one the postgame boxes are checked against.
  const radio = SPLICE_WORLD.spliceRadio;
  const radioCell = radio?.placements.portrait;
  const radioBox: Bounds | null = radio && radioCell ? spliceBoxWorld(radio, { x: radioCell.x, y: placementFeetY(radioCell) }) : null;

  it('the radio keeps its portrait cell and has no postgame key', () => {
    expect(radio?.postgame).toBeUndefined();
    expect(radioBox).not.toBeNull();
  });

  it('the boxes sit where the AD2 mock put them', () => {
    expect(POSTGAME.find((p) => p.name === 'spliceBicycle postgame')?.box)
      .toEqual({ left: 718, top: GROUND_Y + 74, right: 770, bottom: GROUND_Y + 104 });
    expect(POSTGAME.find((p) => p.name === 'spliceOrgan postgame')?.box)
      .toEqual({ left: 782, top: GROUND_Y + 52, right: 836, bottom: GROUND_Y + 100 });
    expect(radioBox).toEqual({ left: 674, top: GROUND_Y + 60, right: 706, bottom: GROUND_Y + 100 });
  });

  // WP28b (AD3 O-c, the postgame row): the postgame wings run from 648 to 3176 (the gramophone takes the inner gap at 958). The whistle's
  // union box reaches 3184 (its whole frame has no plume; the body box is 3156-3178): a documented exemption, AD3 to confirm.
  const POSTGAME_RIGHT_EXEMPT: ReadonlySet<string> = new Set(['spliceWhistle postgame']);
  it.each(POSTGAME)('$name sits in the postgame wings (648 to 3176; 3184 for the whistle exemption)', ({ name, box }) => {
    expect(box.left).toBeGreaterThanOrEqual(648);
    expect(box.right).toBeLessThanOrEqual(POSTGAME_RIGHT_EXEMPT.has(name) ? 3184 : 3176);
  });

  it.each(POSTGAME)('$name stays above the portrait frame bottom (G + 112)', ({ box }) => {
    expect(box.bottom).toBeLessThanOrEqual(GROUND_Y + 112);
  });

  it.each(POSTGAME)('$name clears the postgame dog band', ({ box }) => {
    expect(overlaps(box, DOG_BAND)).toBe(false);
  });

  it.each(POSTGAME)('$name clears the Inspector pat box', ({ box }) => {
    expect(overlaps(box, PAT_BOX)).toBe(false);
  });

  it('every pair of postgame boxes and the radio portrait box is at least 4 px apart', () => {
    const all = radioBox === null ? POSTGAME : [...POSTGAME, { name: 'spliceRadio portrait', box: radioBox }];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a === undefined || b === undefined) continue;
        const gapX = Math.max(a.box.left - b.box.right, b.box.left - a.box.right);
        const gapY = Math.max(a.box.top - b.box.bottom, b.box.top - a.box.bottom);
        expect(Math.max(gapX, gapY), `${a.name} / ${b.name}`).toBeGreaterThanOrEqual(OBJECT_GAP_PX);
      }
    }
  });
});

// ---- era I pulley stakes (AD2 R2 F22, A14) ----

describe('stakeDistances (AD2 R2 F22 regression)', () => {
  it('a line longer than the inset keeps one stake: the s11 street clock line (82.02 px) had none', () => {
    const d = stakeDistances(82.02, 48, 36);
    expect(d).toHaveLength(1);
    expect(d[0]).toBeCloseTo(46.02, 5);
  });

  it.each([
    [92, 48, 36, [48]],
    [128, 48, 36, [48]],
    [200, 48, 36, [48, 96, 144]],
    [233, 48, 36, [48, 96, 144, 192]],
    [49, 48, 0, [48]],
    [36, 48, 36, []],
    [30, 48, 36, []],
    [0, 48, 36, []],
    [-5, 48, 36, []],
    [NaN, 48, 36, []],
    [Infinity, 48, 36, []],
    [200, 0, 36, []],
    [200, -1, 36, []],
    [200, 48, -1, []],
    [200, 48, NaN, []],
  ])('stakeDistances(%s, %s, %s) gives the era I stake distances', (len, everyPx, inset, expected) => {
    expect(stakeDistances(len, everyPx, inset)).toEqual(expected);
  });
});

describe('era I pulley stakes (A14)', () => {
  // The stake points of a placement's line (world px), placed as SpliceLines.makeLine places them: the route from the machine's outer foot,
  // one stake per stakeDistances distance along the path.
  function stakesOf(c: Case): Vec2[] {
    const foot = { x: c.entry.line.from === 'left' ? FOOT_TABLE[c.framing].left : FOOT_TABLE[c.framing].right, y: GROUND_Y };
    const path = linePath(lineRouteAt(c.entry.line, c.framing), foot, c.feet);
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (a !== undefined && b !== undefined) len += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const out: Vec2[] = [];
    const at: Vec2[] = [{ x: 0, y: 0 }];
    for (const d of stakeDistances(len, SPLICE_LINE_STYLE.era1.stakeEveryPx, SPLICE_LINE_STYLE.era1.stakeEndInsetPx)) {
      pulsePositions(path, 1, d / len, at);
      const p = at[0];
      if (p !== undefined) out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  it.each(CASES.filter((c) => TECHNOLOGIES[c.id as TechId]?.era === 1))('$name keeps at least one stake and the last stands outside the object x range', (c) => {
    const stakes = stakesOf(c);
    expect(stakes.length, c.name).toBeGreaterThanOrEqual(1);
    const last = stakes[stakes.length - 1];
    expect(last, c.name).toBeDefined();
    if (last === undefined) return;
    expect(last.x < c.box.left || last.x > c.box.right, `${c.name} last stake at x ${last.x}`).toBe(true);
  });

  it('spliceClock s11 keeps exactly one stake, at about x 2854, left of the clock box', () => {
    const c = CASES.find((k) => k.name === 'spliceClock s11');
    expect(c).toBeDefined();
    if (c === undefined) return;
    const stakes = stakesOf(c);
    expect(stakes, c.name).toHaveLength(1);
    const x = stakes[0]?.x ?? NaN;
    expect(x, c.name).toBeGreaterThanOrEqual(2850);
    expect(x, c.name).toBeLessThanOrEqual(2858);
    expect(x, c.name).toBeLessThan(c.box.left);
  });
});

// ---- WP28b: the era II steady dots (F23), the KEEP beat (F24), the crank pulse and the eras III-V shapes ----

// The length of a polyline (world px).
function lengthOf(path: readonly Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a !== undefined && b !== undefined) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

// The one point at phase (0..1 of the length) of a path, through pulsePositions.
function pointAt(path: readonly Vec2[], phase: number): Vec2 | undefined {
  const out: Vec2[] = [{ x: 0, y: 0 }];
  return pulsePositions(path, 1, phase, out) > 0 ? out[0] : undefined;
}

// The line of a placement as SpliceLines routes it: the framing's route from the machine's outer foot to the placement feet.
function routeOf(c: Case): readonly Vec2[] {
  const foot = { x: c.entry.line.from === 'left' ? FOOT_TABLE[c.framing].left : FOOT_TABLE[c.framing].right, y: GROUND_Y };
  return linePath(lineRouteAt(c.entry.line, c.framing), foot, c.feet);
}

// The reduced-motion steady dot of a line (era II): the path point at steadyDotPhase(len, steadyInsetPx).
function steadyDotOf(c: Case): Vec2 | undefined {
  const path = routeOf(c);
  return pointAt(path, steadyDotPhase(lengthOf(path), SPLICE_LINE_STYLE.era2.steadyInsetPx));
}

const ERA2_CASES = CASES.filter((c) => TECHNOLOGIES[c.id as TechId]?.era === 2);

describe('era II steady dots (F23, reduced motion)', () => {
  it('the steady inset is 48 world px', () => {
    expect(SPLICE_LINE_STYLE.era2.steadyInsetPx).toBe(48);
  });

  it.each([
    [200, 48, (200 - 48) / 200], [96, 48, 0.5], [60, 48, 0.5], [48, 48, 0.5], [30, 48, 0.5],
    [200, 0, 1 - 1e-9], [200, -4, 1 - 1e-9], [200, NaN, 1 - 1e-9],
    [0, 48, 0], [-5, 48, 0], [NaN, 48, 0], [Infinity, 48, 0],
  ])('steadyDotPhase(%s, %s) = %s (the midpoint for a line under twice the inset)', (len, inset, expected) => {
    expect(steadyDotPhase(len, inset)).toBeCloseTo(expected, 9);
  });

  it.each(ERA2_CASES)('$name: the steady dot lies outside its object box', (c) => {
    const dot = steadyDotOf(c);
    expect(dot, c.name).toBeDefined();
    if (dot === undefined) return;
    const inside = dot.x >= c.box.left && dot.x <= c.box.right && dot.y >= c.box.top && dot.y <= c.box.bottom;
    expect(inside, `${c.name} dot at ${dot.x}, ${dot.y}`).toBe(false);
  });

  it.each([
    { name: 'spliceRadio s9', x: 1549, y: 1740 }, { name: 'spliceRadio s11', x: 939, y: 1748 }, { name: 'spliceRadio s15', x: 731, y: 1754 },
    { name: 'spliceSign s9', x: 2907, y: 1695 }, { name: 'spliceSign s11', x: 3014, y: 1742 },
  ])('$name: the steady dot sits at ($x, $y) +- 2 (the AD2 round 3 F23 measure)', ({ name, x, y }) => {
    const c = CASES.find((k) => k.name === name);
    expect(c, name).toBeDefined();
    if (c === undefined) return;
    const dot = steadyDotOf(c);
    expect(dot, name).toBeDefined();
    if (dot === undefined) return;
    expect(Math.abs(dot.x - x), name).toBeLessThanOrEqual(2);
    expect(Math.abs(dot.y - y), name).toBeLessThanOrEqual(2);
  });
});

describe('the KEEP beat (F24)', () => {
  it('the side and the alpha at the 4, 4.5, 5 and 5.6 s marks; the side flips in the middle of the hidden window (4.75 s)', () => {
    expect(SPLICE_FX.postgameMove).toEqual({ outFromS: 4, outToS: 4.5, inFromS: 5, inToS: 5.6 });
    expect(postgameMoveAt(4)).toBe('portrait');
    expect(postgameMoveAlpha(4)).toBe(1);
    expect(postgameMoveAlpha(4.25)).toBeCloseTo(0.5, 9);
    expect(postgameMoveAlpha(4.5)).toBe(0);
    expect(postgameMoveAt(4.74)).toBe('portrait');
    expect(postgameMoveAt(4.75)).toBe('postgame');
    expect(postgameMoveAlpha(4.75)).toBe(0);
    expect(postgameMoveAlpha(5)).toBe(0);
    expect(postgameMoveAt(5)).toBe('postgame');
    expect(postgameMoveAlpha(5.3)).toBeCloseTo(0.5, 9);
    expect(postgameMoveAlpha(5.6)).toBe(1);
    expect(postgameMoveAt(5.6)).toBe('postgame');
  });

  it('no KEEP yet (negative, NaN) is the portrait side at alpha 1; a boot into the postgame (Infinity) is the postgame side at alpha 1', () => {
    for (const s of [-1, -0.001, NaN]) {
      expect(postgameMoveAt(s), `${s}`).toBe('portrait');
      expect(postgameMoveAlpha(s), `${s}`).toBe(1);
    }
    expect(postgameMoveAt(Infinity)).toBe('postgame');
    expect(postgameMoveAlpha(Infinity)).toBe(1);
  });

  it('reduced motion has no fade (alpha 1) and flips the side at inFromS (5 s)', () => {
    for (const s of [-1, 0, 4, 4.5, 4.75, 4.99]) {
      expect(postgameMoveAlpha(s, true), `${s}`).toBe(1);
      expect(postgameMoveAt(s, true), `${s}`).toBe('portrait');
    }
    expect(postgameMoveAt(5, true)).toBe('postgame');
    expect(postgameMoveAt(Infinity, true)).toBe('postgame');
    expect(postgameMoveAlpha(5.2, true)).toBe(1);
  });

  it('over a sweep the alpha falls in 4-4.5 s, is 0 to 5 s, rises in 5-5.6 s, and the side only flips where alpha is 0', () => {
    let prevSide = postgameMoveAt(0);
    let prevAlpha = 1;
    for (let i = 0; i <= 160; i++) {
      const s = i * 0.05;
      const alpha = postgameMoveAlpha(s);
      const side = postgameMoveAt(s);
      expect(alpha, `${s}`).toBeGreaterThanOrEqual(0);
      expect(alpha, `${s}`).toBeLessThanOrEqual(1);
      if (s >= 4 && s <= 4.5) expect(alpha, `${s}`).toBeLessThanOrEqual(prevAlpha);
      if (s >= 5 && s <= 5.6) expect(alpha, `${s}`).toBeGreaterThanOrEqual(prevAlpha);
      if (side !== prevSide) expect(alpha, `the side flips at ${s}`).toBe(0);
      prevSide = side;
      prevAlpha = alpha;
    }
    expect(postgameMoveAlpha(8)).toBe(1);
  });
});

describe('crank pulse delay and the era III-V shapes (WP28b)', () => {
  it('the crank pulse delay is the distance over 480 px/s, in ms (0 for no distance)', () => {
    expect(GROUND_PULSE_SPEED_PX_PER_S).toBe(480);
    expect(crankPulseDelayMs(480)).toBe(1000);
    expect(crankPulseDelayMs(240)).toBe(500);
    expect(crankPulseDelayMs(0)).toBe(0);
    expect(crankPulseDelayMs(-5)).toBe(0);
    expect(crankPulseDelayMs(NaN)).toBe(0);
  });

  it('flangeDistances: one collar every 32 px, none within the 36 px object-end inset (the stake law, F22)', () => {
    expect(flangeDistances(200)).toEqual([32, 64, 96, 128, 160]);
    expect(flangeDistances(128)).toEqual([32, 64]);
    expect(flangeDistances(100)).toEqual([32]);
    expect(flangeDistances(30)).toEqual([]);
    expect(flangeDistances(200, 0)).toEqual([]);
  });

  it('waveOffsetPx: zero at both ends and at the two interior nodes; the antinodes swing with the breath (3 half-waves)', () => {
    const len = 300;
    const amp = 4;
    for (const d of [0, 100, 200, 300]) expect(waveOffsetPx(0, d, len, 3, amp), `node ${d}`).toBeCloseTo(0, 9);
    expect(waveOffsetPx(0, 50, len, 3, amp)).toBeCloseTo(amp, 9);
    expect(waveOffsetPx(1200, 50, len, 3, amp)).toBeCloseTo(-amp, 9);
    expect(waveOffsetPx(0, 150, len, 3, amp)).toBeCloseTo(-amp, 9);
    expect(waveOffsetPx(0, 50, len, 3, 0)).toBe(0);
    expect(waveOffsetPx(NaN, 50, len, 3, amp)).toBe(0);
    expect(waveOffsetPx(0, 50, 0, 3, amp)).toBe(0);
  });

  it('debrisSpeckCount: round(len / 32) clamped to 6..10, and 0 for a line with no length', () => {
    expect(debrisSpeckCount(50)).toBe(6);
    expect(debrisSpeckCount(200)).toBe(6);
    expect(debrisSpeckCount(260)).toBe(8);
    expect(debrisSpeckCount(400)).toBe(10);
    expect(debrisSpeckCount(0)).toBe(0);
    expect(debrisSpeckCount(NaN)).toBe(0);
  });

  it('debrisSpecks: evenly spaced, ends inset 12 px, each 2-6 art px above the route; deterministic; reuses out; capped at 10', () => {
    const straight: readonly Vec2[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const out: Vec2[] = [];
    expect(debrisSpecks(straight, 6, 7, out)).toBe(6);
    expect(out[0]?.x).toBeCloseTo(12, 9);
    expect(out[5]?.x).toBeCloseTo(88, 9);
    for (let i = 1; i < 6; i++) expect(out[i]?.x ?? 0).toBeGreaterThan(out[i - 1]?.x ?? 0);
    for (const p of out) {
      expect(-p.y).toBeGreaterThanOrEqual(4);
      expect(-p.y).toBeLessThanOrEqual(12);
      expect((-p.y) % 2).toBe(0);
    }
    const again: Vec2[] = [];
    debrisSpecks(straight, 6, 7, again);
    expect(again).toEqual(out);
    const kept = out[0];
    expect(debrisSpecks(straight, 6, 8, out)).toBe(6);
    expect(out[0]).toBe(kept);
    expect(debrisSpecks(straight, 50, 7, out)).toBe(10);
    expect(debrisSpecks(straight, 0, 7, out)).toBe(0);
    expect(debrisSpecks([{ x: 5, y: 5 }, { x: 5, y: 5 }], 6, 7, [])).toBe(0);
  });
});

describe('the wing rule (A14, usableX; AD3 O-g)', () => {
  // The pump and the cairn may stand in the inner gap between the machine's outer feet; every other Splice foot stands in a wing.
  const INNER_OK: ReadonlySet<string> = new Set(['splicePump', 'spliceCairn']);
  // WP28a finale cells that fail usableX at the reference pose (accepted by AD2 round 3; WP28b does not move them): the radio's baseL cell
  // (690) and the bicycle's baseR cell (3150). Listed, not loosened: every WP28b entry passes the rule as written.
  const WING_LEGACY_EXEMPT: ReadonlySet<string> = new Set(['spliceRadio baseL', 'spliceBicycle baseR']);
  it.each(CASES.filter((c) => hasOwnArt(c.entry)))('$name: the foot is in a wing of its view', (c) => {
    if (WING_LEGACY_EXEMPT.has(c.name)) return;
    const frame = FRAME[c.framing];
    const view = viewRectOf(frame.pose);
    const machine = boundsToWorld(visibleMachineBounds(frame.levels));
    const inWing = usableX(c.feet.x, view, machine, false);
    const inGap = INNER_OK.has(c.id) && usableX(c.feet.x, view, machine, true);
    expect(inWing || inGap, `${c.name} at x ${c.feet.x}`).toBe(true);
  });
});

describe('portrait cells (AD3 O-g)', () => {
  it.each(CASES.filter((c) => c.framing === 'portrait'))('$name: the portrait cell bottom stays at or above G + 112', (c) => {
    expect(c.box.bottom).toBeLessThanOrEqual(GROUND_Y + 112);
  });
});
