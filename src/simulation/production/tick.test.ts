import { describe, it, expect } from 'vitest';
import { TECH_IDS } from '../../data/types';
import type { Effect, GameState, TechDefinition, TechId } from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { createInitialState } from '../state';
import { applyClick, advance, computeOffline, applyOffline, offlineCapSeconds } from './tick';

const withLevels = (levels: Partial<Record<TechId, number>>, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

// Injected tech table: every tech keeps its era-I definition except the ids overridden here.
const withEffects = (overrides: Partial<Record<TechId, Effect[]>>): Record<TechId, TechDefinition> => {
  const out: Record<TechId, TechDefinition> = { ...TECHNOLOGIES };
  for (const id of TECH_IDS) {
    const effects = overrides[id];
    if (effects) out[id] = { ...TECHNOLOGIES[id], effects };
  }
  return out;
};

// Automation rate: wornMotor 1 + motorTuning 5 = 33.5 ME/s.
const auto6 = (extra: Partial<GameState> = {}) => withLevels({ wornMotor: 1, motorTuning: 5 }, extra);

// Injected table with an ee economy: me 4/s, ee 1/s (0.5 * sqrt(4)), ee echo 2 per click.
const eeTechs = withEffects({
  wornMotor: [{ type: 'autoAdd', amount: 4 }],
  gearRatio: [
    { type: 'convert', amount: 0.5, res: 'ee' },
    { type: 'clickEcho', seconds: 2, res: 'ee' },
  ],
});
const eeState = (extra: Partial<GameState> = {}) =>
  withLevels({ wornMotor: 1, gearRatio: 1 }, extra);

describe('applyClick', () => {
  it('adds one click of Hand Crank production and counts the click', () => {
    const s = createInitialState(0);
    const before = structuredClone(s);
    const { state, gained, gainedAll } = applyClick(s);
    expect(gained).toBeCloseTo(1, 9);
    expect(gained).toBe(gainedAll.me);
    expect(state.res.me).toBeCloseTo(1, 9);
    expect(state.lifetime.me).toBeCloseTo(1, 9);
    expect(state.totalClicks).toBe(1);
    expect(state.res.ee).toBe(0);
    expect(state.lifetime.ee).toBe(0);
    expect(s).toEqual(before);
  });

  it('uses manual multipliers', () => {
    const { gained } = applyClick(withLevels({ gearRatio: 3, reinforcedCrank: 1 }));
    expect(gained).toBeCloseTo(3.75, 9);
  });

  it('credits every resource that has a per-click echo', () => {
    const s = eeState();
    const { state, gainedAll, gained } = applyClick(s, eeTechs);
    expect(gainedAll.ee).toBeCloseTo(2, 9);
    expect(gained).toBeCloseTo(1, 9);
    expect(state.res.ee).toBe(gainedAll.ee);
    expect(state.lifetime.ee).toBe(gainedAll.ee);
    expect(state.res.me).toBe(gainedAll.me);
    expect(state.lifetime.me).toBe(gainedAll.me);
    expect(state.totalClicks).toBe(1);
  });
});

describe('advance', () => {
  it('adds perSecond * seconds to me and lifetime.me', () => {
    const next = advance(auto6(), 10);
    expect(next.res.me).toBeCloseTo(335, 9);
    expect(next.lifetime.me).toBeCloseTo(335, 9);
  });

  it('grows every resource and its lifetime by perSecond * seconds', () => {
    const next = advance(eeState(), 10, eeTechs);
    expect(next.res.me).toBeCloseTo(40, 9);
    expect(next.lifetime.me).toBeCloseTo(40, 9);
    expect(next.res.ee).toBeCloseTo(10, 9);
    expect(next.lifetime.ee).toBeCloseTo(10, 9);
    expect(next.res.pr).toBe(0);
    expect(next.lifetime.xf).toBe(0);
  });

  it('returns the same reference for non-positive or non-finite steps', () => {
    const s = auto6();
    expect(advance(s, 0)).toBe(s);
    expect(advance(s, -1)).toBe(s);
    expect(advance(s, NaN)).toBe(s);
    expect(advance(s, Infinity)).toBe(s);
  });

  it('is step-size independent', () => {
    const s = auto6();
    let stepped = s;
    for (let i = 0; i < 100; i++) stepped = advance(stepped, 0.1);
    const single = advance(s, 10);
    expect(stepped.res.me).toBeCloseTo(single.res.me, 9);
  });

  it('does not touch lastSimTime', () => {
    const s = auto6({ lastSimTime: 1234 });
    expect(advance(s, 10).lastSimTime).toBe(1234);
  });

  it('never mutates its input', () => {
    const s = eeState();
    const before = structuredClone(s);
    advance(s, 10, eeTechs);
    expect(s).toEqual(before);
  });
});

describe('computeOffline', () => {
  it('1 hour at 33.5/s', () => {
    const r = computeOffline(auto6({ lastSimTime: 0 }), 3_600_000);
    expect(r.elapsedSeconds).toBe(3600);
    expect(r.cappedSeconds).toBe(3600);
    expect(r.gained.me).toBeCloseTo(120600, 9);
    expect(r.gained.ee).toBe(0);
  });

  it('10 hours is capped at 8 hours', () => {
    const r = computeOffline(auto6({ lastSimTime: 0 }), 36_000_000);
    expect(r.elapsedSeconds).toBeCloseTo(36000, 9);
    expect(r.cappedSeconds).toBe(28800);
    expect(r.gained.me).toBeCloseTo(964800, 9);
  });

  it('clock going backwards yields all zeros', () => {
    expect(computeOffline(auto6({ lastSimTime: 5000 }), 1000)).toEqual({
      elapsedSeconds: 0,
      cappedSeconds: 0,
      gained: { me: 0, ee: 0, pr: 0, rs: 0, xf: 0 },
    });
  });

  it('initial state (no automation) gains nothing even with clicks', () => {
    const s = createInitialState(0);
    const r = computeOffline({ ...s, totalClicks: 500 }, 3_600_000);
    expect(r.elapsedSeconds).toBe(3600);
    expect(r.gained.me).toBeCloseTo(0, 9);
  });

  it('honours a custom cap', () => {
    const r = computeOffline(auto6({ lastSimTime: 0 }), 3_600_000, 60);
    expect(r.cappedSeconds).toBe(60);
    expect(r.gained.me).toBeCloseTo(2010, 9);
  });

  it('gives every resource perSecond * capped', () => {
    const r = computeOffline(eeState({ lastSimTime: 0 }), 3_600_000, 60, eeTechs);
    expect(r.gained.me).toBeCloseTo(240, 9);
    expect(r.gained.ee).toBeCloseTo(60, 9);
    expect(r.gained.pr).toBe(0);
  });
});

describe('offlineCapSeconds', () => {
  // Injected table: gearRatio grants a 4 h offline buffer, motorTuning a 1 h buffer per level.
  const bufferTechs = withEffects({
    gearRatio: [{ type: 'offlineHours', hours: 4 }],
    motorTuning: [{ type: 'offlineHours', hours: 1 }],
  });

  it('is the base cap (28800) with no effect tech owned', () => {
    expect(offlineCapSeconds(createInitialState(0).techLevels)).toBe(28800);
  });

  it('adds hours x level for an owned effect tech', () => {
    expect(offlineCapSeconds(withLevels({ gearRatio: 1 }).techLevels, bufferTechs)).toBe(43200);
  });

  it('ignores effect techs at level 0', () => {
    expect(offlineCapSeconds(withLevels({ gearRatio: 0 }).techLevels, bufferTechs)).toBe(28800);
  });

  it('scales a repeatable effect tech by its level', () => {
    expect(offlineCapSeconds(withLevels({ motorTuning: 3 }).techLevels, bufferTechs)).toBe(28800 + 3 * 3600);
  });

  it('adds the effects of two effect techs', () => {
    const levels = withLevels({ gearRatio: 1, motorTuning: 3 }).techLevels;
    expect(offlineCapSeconds(levels, bufferTechs)).toBe(28800 + 4 * 3600 + 3 * 3600);
  });

  it('ignores the buffer when the injected table has no offlineHours effect', () => {
    expect(offlineCapSeconds(withLevels({ gearRatio: 1 }).techLevels, TECHNOLOGIES)).toBe(28800);
  });
});

describe('applyOffline', () => {
  it('uses the offline buffer of owned techs: a 10 h gap is not capped at 8 h', () => {
    const techs = withEffects({ gearRatio: [{ type: 'offlineHours', hours: 4 }] });
    const s = withLevels({ wornMotor: 1, motorTuning: 5, gearRatio: 1 }, { lastSimTime: 0 });
    const { state, report } = applyOffline(s, 36_000_000, techs);
    expect(report.elapsedSeconds).toBe(36000);
    expect(report.cappedSeconds).toBe(36000);
    expect(report.gained.me).toBeCloseTo(1206000, 9);
    expect(state.res.me).toBeCloseTo(1206000, 9);
  });

  it('a 14 h gap with the buffer is capped at 12 h', () => {
    const techs = withEffects({ gearRatio: [{ type: 'offlineHours', hours: 4 }] });
    const s = withLevels({ wornMotor: 1, motorTuning: 5, gearRatio: 1 }, { lastSimTime: 0 });
    const { report } = applyOffline(s, 50_400_000, techs);
    expect(report.elapsedSeconds).toBe(50400);
    expect(report.cappedSeconds).toBe(43200);
    expect(report.gained.me).toBeCloseTo(1447200, 9);
  });

  it('without the buffer a 10 h gap is still capped at 8 h (regression)', () => {
    const { report } = applyOffline(auto6({ lastSimTime: 0 }), 36_000_000);
    expect(report.elapsedSeconds).toBeCloseTo(36000, 9);
    expect(report.cappedSeconds).toBe(28800);
  });

  it('credits offline gain and advances lastSimTime', () => {
    const { state, report } = applyOffline(auto6({ lastSimTime: 0 }), 3_600_000);
    expect(report.gained.me).toBeCloseTo(120600, 9);
    expect(state.res.me).toBeCloseTo(120600, 9);
    expect(state.lifetime.me).toBeCloseTo(120600, 9);
    expect(state.lastSimTime).toBe(3_600_000);
  });

  it('credits every resource to res and lifetime', () => {
    const { state, report } = applyOffline(eeState({ lastSimTime: 0 }), 3_600_000, eeTechs);
    expect(report.gained.ee).toBeCloseTo(3600, 9);
    expect(state.res.ee).toBeCloseTo(3600, 9);
    expect(state.lifetime.ee).toBeCloseTo(3600, 9);
    expect(state.res.me).toBeCloseTo(14400, 9);
    expect(state.lifetime.me).toBeCloseTo(14400, 9);
  });

  it('a second application at the same time gains nothing', () => {
    const first = applyOffline(auto6({ lastSimTime: 0 }), 3_600_000);
    const second = applyOffline(first.state, 3_600_000);
    expect(second.report.gained.me).toBe(0);
    expect(second.state.res.me).toBeCloseTo(120600, 9);
    expect(second.state.lifetime.me).toBeCloseTo(120600, 9);
  });

  it('a time before lastSimTime leaves res unchanged but still sets lastSimTime', () => {
    const s = auto6({ lastSimTime: 5000, res: { me: 42, ee: 0, pr: 0, rs: 0, xf: 0 } });
    const { state } = applyOffline(s, 1000);
    expect(state.res.me).toBe(42);
    expect(state.lastSimTime).toBe(1000);
  });

  it('lifetime never decreases', () => {
    const s = auto6({
      lastSimTime: 5000,
      lifetime: { me: 100, ee: 7, pr: 0, rs: 0, xf: 0 },
    });
    const { state } = applyOffline(s, 1000);
    expect(state.lifetime).toEqual({ me: 100, ee: 7, pr: 0, rs: 0, xf: 0 });
  });
});

describe('autoClick (servo auto-cranks)', () => {
  // Injected table: gearRatio grants 2 automatic cranks/s per level (era I otherwise).
  const autoTechs = withEffects({ gearRatio: [{ type: 'autoClick', perSecond: 2 }] });
  const autoState = (extra: Partial<GameState> = {}) => withLevels({ gearRatio: 3 }, extra);

  // Injected table with an ee economy: wornMotor autoAdd 10 ee, echo 3 s of ee, convert 1 pr.
  const eeAutoTechs = withEffects({
    gearRatio: [{ type: 'autoClick', perSecond: 2 }],
    wornMotor: [
      { type: 'autoAdd', amount: 10, res: 'ee' },
      { type: 'clickEcho', seconds: 3, res: 'ee' },
      { type: 'convert', amount: 1, res: 'pr' },
    ],
  });
  const eeAutoState = () => withLevels({ gearRatio: 3, wornMotor: 1 });

  it('advance credits auto-cranks to me and lifetime.me without touching totalClicks', () => {
    const s = autoState();
    const next = advance(s, 10, autoTechs);
    expect(next.res.me - s.res.me).toBeCloseTo(60, 9);
    expect(next.lifetime.me - s.lifetime.me).toBeCloseTo(60, 9);
    expect(next.totalClicks).toBe(s.totalClicks);
  });

  it('computeOffline credits auto-cranks at 6/s for the elapsed time', () => {
    const s = autoState();
    const r = computeOffline(s, s.lastSimTime + 100000, undefined, autoTechs);
    expect(r.elapsedSeconds).toBe(100);
    expect(r.gained.me).toBeCloseTo(600, 9);
  });

  it('applyClick is unchanged by auto-cranks: one manual click, no auto bonus', () => {
    const s = autoState();
    const { state, gained } = applyClick(s, autoTechs);
    expect(gained).toBeCloseTo(1, 9);
    expect(state.totalClicks).toBe(s.totalClicks + 1);
  });

  it('advance folds the ee echo of auto-cranks: ee gains 190/s', () => {
    const s = eeAutoState();
    const next = advance(s, 10, eeAutoTechs);
    expect(next.res.ee - s.res.ee).toBeCloseTo(1900, 9);
  });
});
