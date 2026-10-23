import { describe, it, expect, beforeAll } from 'vitest';
import { DESIGN_MAX_VALUE } from '../data/balance';
import { ACHIEVEMENT_IDS } from '../data/achievements';
import { PERKS } from '../data/prestige';
import { TECHNOLOGIES } from '../data/technologies';
import { RESOURCE_IDS, TECH_IDS } from '../data/types';
import type { LoadResult, ResourceId, SettingsState, TechId, TechView } from '../data/types';
import { deserialize, serialize } from '../persistence/codec';
import { GameSession } from './GameSession';
import { applyStartLevels } from './prestige';
import { createInitialState } from './state';

// Pure full-run end-to-end test (WP16 T1). A deterministic greedy player drives the GameSession public
// API from a fresh save to the finale, through the postgame and into cycle 2 (path K: keep running;
// path N: new cycle straight from the choice). No clock, no randomness, no rendering: time is an
// injected fixed clock advanced in 10 s steps. Player: 4 clicks/s, buys the cheapest affordable
// non-milestone tech per resource at every step.
// Re-run: npx vitest run src/simulation/fullRun.e2e.test.ts

const T0 = 1_700_000_000_000;
const STEP_SECONDS = 10;
const STEP_MS = STEP_SECONDS * 1000;
const CLICKS_PER_STEP = 4 * STEP_SECONDS;
const MAX_BUYS_PER_RESOURCE = 500; // safety bound; cheapest-first buying stops on affordability long before
const PATH_K_LIMIT_MS = 330 * 60_000;
const PATH_K_LIMIT_STEPS = PATH_K_LIMIT_MS / STEP_MS;
const POSTGAME_STEPS = 3600 / STEP_SECONDS; // 1 sim-hour
const CYCLE_TWO_LIMIT_STEPS = PATH_K_LIMIT_STEPS;

// Keystone converters (Generator to Null Chamber) are the ledger perk's cost targets: data, not literals.
const LEDGER_EFFECT = PERKS.ledger.effect;
const KEYSTONES: readonly TechId[] = LEDGER_EFFECT.type === 'costMult' ? LEDGER_EFFECT.techIds : [];
const WATCHED: readonly TechId[] = [...KEYSTONES, 'generatorBlueprint', 'primaryFunction'];
const MUSCLE_LEVELS: Partial<Record<TechId, number>> =
  PERKS.muscleMemory.effect.type === 'startLevels' ? PERKS.muscleMemory.effect.levels : {};

const SETTINGS_PATCH: Partial<SettingsState> = { notation: 'engineering', musicVolume: 40, uiScale: 125 };

/** Live session plus the fixed clock and per-cycle bookkeeping. */
interface Play {
  session: GameSession;
  clock: { now: number };
  /** Epoch ms the current cycle started at. */
  origin: number;
  /** Ms since `origin` at which each watched tech was first owned. */
  firstAt: Partial<Record<TechId, number>>;
  /** Non-finite or >= DESIGN_MAX_VALUE readings, one string each. Must stay empty. */
  violations: string[];
}

function newPlay(): Play {
  const clock = { now: T0 };
  const session = new GameSession({ state: createInitialState(T0), now: () => clock.now });
  session.applyOffline(T0);
  session.updateSettings(SETTINGS_PATCH);
  return { session, clock, origin: T0, firstAt: {}, violations: [] };
}

/** Cheapest affordable, available, non-milestone tech paying in `res`; null when none. Ties: TECH_IDS order. */
function cheapestAffordable(views: readonly TechView[], res: ResourceId): TechId | null {
  let best: TechId | null = null;
  let bestCost = Infinity;
  for (const view of views) {
    if (view.status !== 'available' || !view.affordable || view.nextCost === null) continue;
    if (view.def.kind === 'milestone' || view.def.costRes !== res) continue;
    if (view.nextCost < bestCost) {
      best = view.id;
      bestCost = view.nextCost;
    }
  }
  return best;
}

/** The player may buy outside the finale's locked phases (none = before the finale, postgame = after it). */
function canBuy(session: GameSession): boolean {
  const phase = session.state.ending.phase;
  return phase === 'none' || phase === 'postgame';
}

function buyCheapest(session: GameSession): void {
  for (const res of RESOURCE_IDS) {
    for (let n = 0; n < MAX_BUYS_PER_RESOURCE; n++) {
      if (!canBuy(session)) return;
      const id = cheapestAffordable(session.getAllTechViews(), res);
      if (id === null || !session.purchase(id).ok) break;
    }
  }
}

function checkFinite(p: Play): void {
  const { session } = p;
  const rates = session.rates;
  for (const r of RESOURCE_IDS) {
    const readings: Array<[string, number]> = [
      ['res', session.state.res[r]],
      ['lifetime', session.state.lifetime[r]],
      ['stats.lifetime', session.stats.lifetime[r]],
      ['perSecond', rates.perSecond[r]],
      ['perClick', rates.perClick[r]],
    ];
    for (const [label, value] of readings) {
      if (!Number.isFinite(value) || value >= DESIGN_MAX_VALUE) {
        p.violations.push(`${label}.${r}@${p.clock.now - T0}ms=${value}`);
      }
    }
  }
}

function recordFirst(p: Play): void {
  for (const id of WATCHED) {
    if (p.firstAt[id] === undefined && p.session.state.techLevels[id] >= 1) {
      p.firstAt[id] = p.clock.now - p.origin;
    }
  }
}

/** One 10 s step: time advances, then 4 clicks/s, then greedy purchases. */
function tick(p: Play): void {
  p.clock.now += STEP_MS;
  p.session.update(p.clock.now);
  for (let i = 0; i < CLICKS_PER_STEP; i++) p.session.click();
  buyCheapest(p.session);
  recordFirst(p);
  checkFinite(p);
}

function playUntil(p: Play, done: (s: GameSession) => boolean, maxSteps: number): void {
  for (let i = 0; i < maxSteps && !done(p.session); i++) tick(p);
}

/** Immutable snapshots: the session never mutates these objects, so references stay valid. */
function snap(s: GameSession) {
  return {
    state: s.state,
    prestige: s.prestige,
    stats: s.stats,
    achievements: s.achievements,
    settings: s.settings,
  };
}
type Snap = ReturnType<typeof snap>;

interface Saved {
  nowMs: number;
  live: Snap;
  raw: string;
  loaded: LoadResult;
}

function saveAt(s: GameSession, nowMs: number): Saved {
  const live = snap(s);
  const raw = serialize(s.state, s.settings, nowMs, {
    stats: s.stats,
    achievements: s.achievements,
    prestige: s.prestige,
  });
  return { nowMs, live, raw, loaded: deserialize(raw, nowMs) };
}

interface CycleTwo {
  started: boolean;
  /** Cycle 1 end, just before beginNewCycle. */
  before: Snap;
  /** Cycle 2 right after beginNewCycle (no perks yet). */
  start: Snap;
  startSaved: Saved;
  perkBought: boolean;
  /** Cycle 2 right after buyPerk('muscleMemory'). */
  afterPerk: Snap;
  perkSaved: Saved;
  /** Ms since cycle-2 start at which generatorBlueprint was first owned (undefined = never). */
  generatorMs: number | undefined;
  /** Ms since cycle-1 start at which generatorBlueprint was first owned in cycle 1. */
  cycleOneGenMs: number | undefined;
}

/** Cycle 1 -> cycle 2 through beginNewCycle, a Memory perk purchase, then a run to generatorBlueprint. */
function startSecondCycle(p: Play, cycleOneFirst: Partial<Record<TechId, number>>): CycleTwo {
  const before = snap(p.session);
  const started = p.session.beginNewCycle(p.clock.now);
  p.origin = p.clock.now;
  p.firstAt = {};
  const start = snap(p.session);
  const startSaved = saveAt(p.session, p.clock.now);
  const perkBought = p.session.buyPerk('muscleMemory').ok;
  const afterPerk = snap(p.session);
  const perkSaved = saveAt(p.session, p.clock.now);
  checkFinite(p);
  playUntil(p, (s) => s.state.techLevels.generatorBlueprint >= 1, CYCLE_TWO_LIMIT_STEPS);
  return {
    started,
    before,
    start,
    startSaved,
    perkBought,
    afterPerk,
    perkSaved,
    generatorMs: p.firstAt.generatorBlueprint,
    cycleOneGenMs: cycleOneFirst.generatorBlueprint,
  };
}

interface PathK {
  violations: string[];
  cycleOneFirst: Partial<Record<TechId, number>>;
  /** ending block when the finale started (phase sequence). */
  sequence: Snap['state']['ending'];
  finished: boolean;
  kept: boolean;
  choicePhase: string;
  postgamePhase: string;
  postgame: Saved;
  meBeforePostgameHour: number;
  meAfterPostgameHour: number;
  cycleTwo: CycleTwo;
}

function runPathK(): PathK {
  const p = newPlay();
  playUntil(p, (s) => s.state.ending.phase !== 'none', PATH_K_LIMIT_STEPS);
  const cycleOneFirst = { ...p.firstAt };
  const sequence = p.session.state.ending;

  const finished = p.session.finishEndingSequence();
  const choicePhase = p.session.state.ending.phase;
  const kept = p.session.keepRunning();
  const postgame = saveAt(p.session, p.clock.now);
  const meBefore = p.session.state.lifetime.me;

  for (let i = 0; i < POSTGAME_STEPS; i++) tick(p);
  const meAfter = p.session.state.lifetime.me;
  const postgamePhase = p.session.state.ending.phase;

  const cycleTwo = startSecondCycle(p, cycleOneFirst);
  return {
    violations: p.violations,
    cycleOneFirst,
    sequence,
    finished,
    kept,
    choicePhase,
    postgamePhase,
    postgame,
    meBeforePostgameHour: meBefore,
    meAfterPostgameHour: meAfter,
    cycleTwo,
  };
}

interface PathN {
  violations: string[];
  phaseBeforeCycle: string;
  cycleTwo: CycleTwo;
}

function runPathN(): PathN {
  const p = newPlay();
  playUntil(p, (s) => s.state.ending.phase !== 'none', PATH_K_LIMIT_STEPS);
  const cycleOneFirst = { ...p.firstAt };
  p.session.finishEndingSequence();
  const phaseBeforeCycle = p.session.state.ending.phase;
  const cycleTwo = startSecondCycle(p, cycleOneFirst);
  return { violations: p.violations, phaseBeforeCycle, cycleTwo };
}

/** Save -> load -> save must return the live parts unchanged and the same text. */
function expectLossless(saved: Saved): void {
  expect(saved.loaded.status).toBe('loaded');
  expect(saved.loaded.state).toEqual(saved.live.state);
  expect(saved.loaded.settings).toEqual(saved.live.settings);
  expect(saved.loaded.stats).toEqual(saved.live.stats);
  expect(saved.loaded.achievements).toEqual(saved.live.achievements);
  expect(saved.loaded.prestige).toEqual(saved.live.prestige);
  const again = serialize(saved.loaded.state, saved.loaded.settings, saved.nowMs, {
    stats: saved.loaded.stats,
    achievements: saved.loaded.achievements,
    prestige: saved.loaded.prestige,
  });
  // Key order may differ (achievements are listed in ACHIEVEMENT_IDS order); the content must not.
  expect(JSON.parse(again)).toEqual(JSON.parse(saved.raw));
}

/** Invariants of the first state of cycle 2 (before any perk is bought). */
function expectCycleTwoStart(c: CycleTwo): void {
  const { start, before } = c;
  expect(c.started).toBe(true);
  expect(start.prestige.cycle).toBe(2);
  expect(start.prestige.echoesEarned).toBeGreaterThanOrEqual(3);
  expect(start.prestige.perks).toEqual([]);
  expect(start.state.techLevels).toEqual(createInitialState(start.state.createdAt).techLevels);
  expect(start.state.ending).toEqual({ phase: 'none', engagedAt: null });
  expect(start.stats.cycles).toBe(2);
  for (const r of RESOURCE_IDS) {
    expect(start.stats.lifetime[r]).toBeGreaterThanOrEqual(before.stats.lifetime[r]);
  }
  expect(start.stats.clicks).toBeGreaterThanOrEqual(before.stats.clicks);
  expect(start.stats.purchases).toBeGreaterThanOrEqual(before.stats.purchases);
  expect(start.settings).toEqual(before.settings);
  // Achievements are never removed or re-timed. New ones may unlock at the cycle start (e.g. "cycles >= 2").
  for (const id of ACHIEVEMENT_IDS) {
    const prior = before.achievements.unlocked[id];
    if (prior !== undefined) expect(start.achievements.unlocked[id]).toBe(prior);
  }
}

/** Buying muscleMemory applies its start levels (max(level, n)) to the cycle-2 tech table. */
function expectMuscleMemory(c: CycleTwo): void {
  expect(c.perkBought).toBe(true);
  expect(c.afterPerk.prestige.perks).toEqual(['muscleMemory']);
  const expected = applyStartLevels(createInitialState(c.start.state.createdAt), c.afterPerk.prestige);
  expect(c.afterPerk.state.techLevels).toEqual(expected.techLevels);
  for (const id of TECH_IDS) {
    const wanted = MUSCLE_LEVELS[id];
    if (wanted !== undefined) expect(c.afterPerk.state.techLevels[id]).toBe(wanted);
  }
  expectLossless(c.perkSaved);
}

/** Cycle 2 must reach generatorBlueprint sooner (in its own elapsed time) than cycle 1. */
function expectCycleTwoFaster(c: CycleTwo): void {
  expect(c.cycleOneGenMs).toBeDefined();
  expect(c.generatorMs).toBeDefined();
  expect(c.generatorMs ?? Infinity).toBeLessThan(c.cycleOneGenMs ?? 0);
}

let pathK: PathK;
let pathN: PathN;

beforeAll(() => {
  pathK = runPathK();
  pathN = runPathN();
}, 60000);

describe('full run, path K (every era keystone, finale, keep running, postgame, cycle 2)', () => {
  it('owns the keystones in era order and engages primaryFunction within 330 sim-min', () => {
    const times = KEYSTONES.map((id) => pathK.cycleOneFirst[id]);
    for (const t of times) expect(t).toBeDefined();
    const eras = KEYSTONES.map((id) => TECHNOLOGIES[id].era);
    expect(KEYSTONES).toHaveLength(4);
    for (let i = 1; i < eras.length; i++) expect(eras[i]).toBeGreaterThan(eras[i - 1] ?? 0);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1] ?? 0);
    const primary = pathK.cycleOneFirst.primaryFunction;
    expect(primary).toBeDefined();
    expect(primary ?? Infinity).toBeLessThanOrEqual(PATH_K_LIMIT_MS);
    expect(times[times.length - 1] ?? Infinity).toBeLessThanOrEqual(primary ?? 0);
  });

  it('the purchase starts the finale: sequence, then choice, then postgame, with production after', () => {
    expect(pathK.sequence.phase).toBe('sequence');
    expect(pathK.sequence.engagedAt).toBe(T0 + (pathK.cycleOneFirst.primaryFunction ?? NaN));
    expect(pathK.finished).toBe(true);
    expect(pathK.choicePhase).toBe('choice');
    expect(pathK.kept).toBe(true);
    expect(pathK.postgame.live.state.ending.phase).toBe('postgame');
    expect(pathK.postgamePhase).toBe('postgame');
    expect(pathK.meAfterPostgameHour).toBeGreaterThan(pathK.meBeforePostgameHour);
  });

  it('save -> load is lossless at postgame', () => {
    expectLossless(pathK.postgame);
  });

  it('cycle 2 starts with initial techs, 3+ Echoes, no ending, cumulative stats and unchanged achievements/settings', () => {
    expectCycleTwoStart(pathK.cycleTwo);
  });

  it('save -> load is lossless at cycle 2 start', () => {
    expectLossless(pathK.cycleTwo.startSaved);
  });

  it('buying muscleMemory applies its start levels and survives save -> load', () => {
    expectMuscleMemory(pathK.cycleTwo);
  });

  it('cycle 2 reaches generatorBlueprint sooner than cycle 1', () => {
    expectCycleTwoFaster(pathK.cycleTwo);
  });
});

describe('full run, path N (new cycle straight from the choice)', () => {
  it('reaches the choice phase and starts cycle 2 with the same invariants', () => {
    expect(pathN.phaseBeforeCycle).toBe('choice');
    expectCycleTwoStart(pathN.cycleTwo);
    expectLossless(pathN.cycleTwo.startSaved);
    expectMuscleMemory(pathN.cycleTwo);
    expectCycleTwoFaster(pathN.cycleTwo);
  });
});

describe('full run numeric guards', () => {
  it('every resource value is finite and below DESIGN_MAX_VALUE at every step (both paths)', () => {
    expect(pathK.violations).toEqual([]);
    expect(pathN.violations).toEqual([]);
  });
});
