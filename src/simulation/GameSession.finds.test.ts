import { describe, it, expect } from 'vitest';
import { FAULTS } from '../data/faults';
import { FINDS, RELIC_NOTES } from '../data/finds';
import { DEFAULT_WORLD_SAVE, RELICS_MAX } from '../data/livingWorld';
import type { WorldSaveState } from '../data/livingWorld';
import type { GameState, TechId } from '../data/types';
import type { SessionEvents } from './events';
import { GameSession } from './GameSession';
import { createInitialState } from './state';

// WP28 C5 / C6 / A7: the session wiring of the Finds clock (finds.ts), FIELD NOTES (world.relics) and the cycle's
// splicesCut. Tests inject `now` and `findSeed` (28 = the audit harness seed). Every session step of the clock is
// FINDS.maxStepS (0.25 s): the session clamps longer frames to that, and 0.25 is exact in binary, so the sums are exact.

type Levels = Partial<Record<TechId, number>>;
type Collected = NonNullable<ReturnType<GameSession['collectFind']>>;

const STEP = FINDS.maxStepS;
const FIND_SEED = 28;

const withLevels = (levels: Levels, extra: Partial<GameState> = {}): GameState => {
  const s = createInitialState(0);
  return { ...s, ...extra, techLevels: { ...s.techLevels, ...levels } };
};

const worldWith = (relics: number): WorldSaveState => ({ ...DEFAULT_WORLD_SAVE, relics });

// A session at time 0 past its offline pass, so update(t) calls within the offline threshold are normal steps.
const session = (levels: Levels, world?: WorldSaveState): GameSession => {
  const s = new GameSession({
    state: withLevels(levels, { lastSimTime: 0 }),
    now: () => 0,
    findSeed: FIND_SEED,
    world,
  });
  s.applyOffline(0);
  return s;
};

// Steps the clock in clamped frames until a Find spawns; returns the eligible seconds spent (the spawn step included).
const waitForSpawn = (s: GameSession, limit = 600): number => {
  let seconds = 0;
  while (s.finds.alive === null && seconds < limit) {
    s.stepFinds(STEP, true);
    seconds += STEP;
  }
  return seconds;
};

// Brings the next Find on screen at once: the debug hook, then one eligible step.
const spawnNow = (s: GameSession): void => {
  expect(s.debugForceFind()).toBe(true);
  s.stepFinds(STEP, true);
};

// Spawns a Find at once and picks it up.
const collectNow = (s: GameSession): Collected => {
  spawnNow(s);
  const r = s.collectFind();
  if (r === null) throw new Error('no Find alive after the forced spawn');
  return r;
};

// Records the find events of a session, in emission order.
const recordFinds = (s: GameSession): SessionEvents['find'][] => {
  const log: SessionEvents['find'][] = [];
  s.on('find', (p) => log.push(p));
  return log;
};

// A session that has finished its run: the reveal applies from the choice phase on, so beginNewCycle is allowed.
const revealed = (levels: Levels, relics: number): GameSession => {
  const state = withLevels(levels, { createdAt: 0, lastSimTime: 0, ending: { phase: 'choice', engagedAt: 600_000 } });
  const s = new GameSession({ state, now: () => 0, findSeed: FIND_SEED, world: worldWith(relics) });
  s.applyOffline(0);
  return s;
};

describe('GameSession Finds clock (WP28 C6)', () => {
  it('stepFinds with eligible false changes nothing: same clock, no event, no revision bump', () => {
    const s = session({ wornMotor: 1 });
    const log = recordFinds(s);
    const revision = s.revision;
    const before = s.finds;
    for (let i = 0; i < 2000; i++) s.stepFinds(STEP, false);
    expect(s.finds).toEqual(before);
    expect(s.revision).toBe(revision);
    expect(log).toEqual([]);

    // The clock is where it was: a session that never had the frozen steps spawns at the same eligible time.
    const waited = waitForSpawn(s);
    expect(waited).toBe(waitForSpawn(session({ wornMotor: 1 })));
    expect(log.map((e) => `${e.kind}:${e.serial}`)).toEqual(['spawn:0']);
    expect(s.revision).toBeGreaterThan(revision);
  });

  it('a locked clock (no Worn Motor) counts eligible time and never spawns', () => {
    const s = session({ handCrank: 1 });
    const log = recordFinds(s);
    for (let i = 0; i < 2400; i++) s.stepFinds(STEP, true);
    expect(s.finds).toMatchObject({ unlocked: false, alive: null, nextIn: null, spawned: 0 });
    expect(log).toEqual([]);
  });

  it('a spawn and an expiry emit find events; a Find lives its 25 s window, then the next one spawns', () => {
    const s = session({ wornMotor: 1 });
    const events = recordFinds(s);
    waitForSpawn(s);
    expect(events).toEqual([{ kind: 'spawn', serial: 0, relic: false, payout: null, noteIndex: null, seconds: 0 }]);

    const revision = s.revision;
    for (let i = 0; i < 99; i++) s.stepFinds(STEP, true); // age 24.75 s: still alive
    expect(s.finds.alive).not.toBeNull();
    expect(events).toHaveLength(1);
    s.stepFinds(STEP, true); // age 25 s: expires
    expect(s.finds.alive).toBeNull();
    expect(s.finds.missed).toBe(1);
    expect(events[1]).toEqual({ kind: 'expire', serial: 0, relic: false, payout: null, noteIndex: null, seconds: 0 });
    expect(s.revision).toBeGreaterThan(revision);

    waitForSpawn(s);
    const r = s.collectFind();
    expect(r).not.toBeNull();
    expect(events.map((e) => `${e.kind}:${e.serial}`)).toEqual(['spawn:0', 'expire:0', 'spawn:1', 'collect:1']);
    expect(events[3]).toMatchObject({ kind: 'collect', serial: 1, relic: false, noteIndex: null });
  });

  it('stepFinds clamps dt to FINDS.maxStepS: one 30 s call ages a live Find by 0.25 s', () => {
    const s = session({ wornMotor: 1 });
    spawnNow(s);
    expect(s.finds.alive).toMatchObject({ age: 0, window: FINDS.windowS, serial: 0, relic: false });
    s.stepFinds(30, true);
    expect(s.finds.alive?.age).toBe(STEP);
    expect(s.finds.missed).toBe(0);
  });

  it('a non-finite dt freezes the clock: the same Find object comes back', () => {
    const s = session({ wornMotor: 1 });
    spawnNow(s);
    const alive = s.finds.alive;
    s.stepFinds(Number.NaN, true);
    s.stepFinds(Number.POSITIVE_INFINITY, true);
    expect(s.finds.alive).toBe(alive);
    expect(s.finds.alive?.age).toBe(0);
  });

  it('a reload (a new session on the same state) waits at least 120 eligible seconds for its first Find', () => {
    const s = session({ wornMotor: 1 });
    const seconds = waitForSpawn(s);
    expect(s.finds.spawned).toBe(1);
    expect(seconds).toBeGreaterThanOrEqual(FINDS.firstAfterS);
  });

  it('applyOffline and update never move the Find clock', () => {
    const s = session({ wornMotor: 1 });
    waitForSpawn(s);
    const before = s.finds;
    s.applyOffline(5000);
    s.update(50_000);
    expect(s.finds).toEqual(before);
    expect(s.finds.alive?.age).toBe(0);
  });

  it('a collect pays seconds x perSecond on each energy with a rate; seconds is 4, 6 or 8 for a fresh run', () => {
    const s = session({ wornMotor: 1 });
    const { perSecond } = s.rates;
    expect(perSecond.me).toBeGreaterThan(0);
    expect(s.finds.payoutSeconds).toBe(FINDS.payoutS);
    const seconds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const me = s.state.res.me;
      const lifetime = s.state.lifetime.me;
      const r = collectNow(s);
      expect(r.relic).toBe(false);
      expect([4, 6, 8]).toContain(r.seconds);
      expect(r.payout.me).toBeCloseTo(r.seconds * perSecond.me, 9);
      expect(r.payout.pr).toBe(0);
      expect(s.state.res.me).toBeCloseTo(me + r.seconds * perSecond.me, 9);
      // No time passes in these steps, so the lifetime total grows by the payout alone.
      expect(s.state.lifetime.me).toBeCloseTo(lifetime + r.payout.me, 9);
      seconds.push(r.seconds);
    }
    expect(s.finds.caught).toBe(3);
    expect(new Set(seconds).size).toBeGreaterThan(1);
  });

  it('Barrel Organ adds 1 s to every Find: payoutSeconds 7 and seconds 5, 7 or 9', () => {
    const s = session({ wornMotor: 1, handCrank: 1, spliceOrgan: 1 });
    expect(s.finds.payoutSeconds).toBe(FINDS.payoutS + 1);
    const r = collectNow(s);
    expect([5, 7, 9]).toContain(r.seconds);
  });

  it('a relic (serial 4) pays nothing, raises world.relics and takes note 0 (era I)', () => {
    const s = session({ wornMotor: 1 });
    const events = recordFinds(s);
    for (let i = 0; i < 4; i++) collectNow(s);
    const me = s.state.res.me;
    const worldRevision = s.worldRevision;

    const relic = collectNow(s);
    expect(relic).toMatchObject({ relic: true, noteIndex: 0, seconds: 0 });
    expect(relic.payout.me).toBe(0);
    expect(s.state.res.me).toBe(me);
    expect(s.world.relics).toBe(1);
    expect(s.finds.relics).toBe(1);
    expect(s.worldRevision).toBe(worldRevision + 1);
    expect(events.at(-1)).toEqual({
      kind: 'collect', serial: 4, relic: true, payout: relic.payout, noteIndex: 0, seconds: 0,
    });
  });

  it('a relic gives the next note in order: note 3 (era II) once the Generator (era II) is owned', () => {
    expect(RELIC_NOTES[3]?.era).toBe(2);
    const s = session({ wornMotor: 1, generator: 1 }, worldWith(3));
    for (let i = 0; i < 4; i++) collectNow(s);
    expect(collectNow(s)).toMatchObject({ relic: true, noteIndex: 3 });
    expect(s.world.relics).toBe(4);
    expect(s.finds.relics).toBe(4);
  });

  it('a blank page when the next note is from a later era: no note, no count change, no world write', () => {
    const s = session({ wornMotor: 1 }, worldWith(3)); // note 3 is era II; the run is in era I
    for (let i = 0; i < 4; i++) collectNow(s);
    const worldRevision = s.worldRevision;
    const relic = collectNow(s);
    expect(relic).toMatchObject({ relic: true, noteIndex: null, seconds: 0 });
    expect(s.world.relics).toBe(3);
    expect(s.finds.relics).toBe(3);
    expect(s.worldRevision).toBe(worldRevision);
  });

  it('no note is left after the last one: a relic is a blank page at the count of RELICS_MAX', () => {
    const s = session({ wornMotor: 1, nullChamber: 1 }, worldWith(RELICS_MAX));
    for (let i = 0; i < 4; i++) collectNow(s);
    expect(collectNow(s)).toMatchObject({ relic: true, noteIndex: null });
    expect(s.finds.relics).toBe(RELICS_MAX);
  });

  it('collectFind with none alive returns null and emits nothing', () => {
    const s = session({ wornMotor: 1 });
    const events = recordFinds(s);
    const revision = s.revision;
    const me = s.state.res.me;
    expect(s.collectFind()).toBeNull();
    expect(events).toEqual([]);
    expect(s.revision).toBe(revision);
    expect(s.state.res.me).toBe(me);
    expect(s.finds.caught).toBe(0);
  });

  it('debugForceFind is false while Worn Motor is not owned, true when unlocked with none alive, false while one is alive', () => {
    const locked = session({ handCrank: 1 });
    expect(locked.debugForceFind()).toBe(false);
    const s = session({ wornMotor: 1 });
    expect(s.debugForceFind()).toBe(true);
    expect(s.debugForceFind()).toBe(true); // still none alive: the next eligible step spawns
    s.stepFinds(STEP, true);
    expect(s.finds.spawned).toBe(1);
    expect(s.debugForceFind()).toBe(false);
  });

  it('recordWorld with a block that has no relics keeps the FIELD NOTES count (a line after a relic keeps it at 1)', () => {
    const s = session({ wornMotor: 1 });
    for (let i = 0; i < 4; i++) collectNow(s);
    expect(collectNow(s)).toMatchObject({ relic: true, noteIndex: 0 });
    expect(s.finds.relics).toBe(1);

    const worldRevision = s.worldRevision;
    s.recordWorld({ seen: [], seenEver: [], eraMoments: [1, 0, 0, 0, 0], youEras: 0 });
    expect(s.worldRevision).toBe(worldRevision + 1);
    expect(s.world.relics).toBe(1);
    expect(s.finds.relics).toBe(1);
    expect(s.world.eraMoments).toEqual([1, 0, 0, 0, 0]);
  });

  it('recordWorld cannot change the count either way: a block that says 9 keeps the session count', () => {
    const s = session({ wornMotor: 1 }, worldWith(2));
    s.recordWorld({ ...DEFAULT_WORLD_SAVE, relics: 9 });
    expect(s.finds.relics).toBe(2);
  });

  it('beginNewCycle keeps FIELD NOTES and emits cycle with splicesCut 0 when no Splice is owned', () => {
    const s = revealed({ wornMotor: 1 }, 2);
    const cycles: SessionEvents['cycle'][] = [];
    s.on('cycle', (p) => cycles.push(p));
    expect(s.beginNewCycle(700_000)).toBe(true);
    expect(s.finds.relics).toBe(2);
    expect(s.world.relics).toBe(2);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.splicesCut).toBe(0);
  });

  it('beginNewCycle counts the Splices owned before the reset (2 here) and the new run starts with a fresh Find clock', () => {
    const s = revealed({ wornMotor: 1, spliceOrgan: 1, spliceClock: 1 }, 1);
    spawnNow(s);
    const cycles: SessionEvents['cycle'][] = [];
    s.on('cycle', (p) => cycles.push(p));
    expect(s.beginNewCycle(700_000)).toBe(true);
    expect(cycles[0]?.splicesCut).toBe(2);
    expect(s.state.techLevels.spliceOrgan).toBe(0);
    expect(s.finds).toMatchObject({ alive: null, nextIn: null, spawned: 0, caught: 0, missed: 0, relics: 1 });
  });

  it('reset clears FIELD NOTES and restarts the Find clock', () => {
    const s = session({ wornMotor: 1 }, worldWith(2));
    spawnNow(s);
    s.reset(5000);
    expect(s.world.relics).toBe(0);
    expect(s.finds).toMatchObject({ unlocked: false, alive: null, nextIn: null, spawned: 0, caught: 0, missed: 0, relics: 0 });
  });

  it('default seeds (G2-1): the Find clock and the fault clock draw different streams from the same clock ms', () => {
    // Each clock's interval draw at its first catch, read back as a unit in [0, 1) of its own range. The arming draw is
    // clamped to the first-wait, so the catch draw is the first unclamped interval. Before the salt both clocks shared
    // the clock ms as seed, so both units were equal.
    const firstCatch = (now: number): { find: number; fault: number } => {
      const state = withLevels({ wornMotor: 1, faultLamp: 1 }, { lastSimTime: now });
      const s = new GameSession({ state, now: () => now });
      s.applyOffline(now);
      let find: number | null = null;
      let fault: number | null = null;
      for (let i = 0; i < 4000 && (find === null || fault === null); i++) {
        s.stepFinds(STEP, true);
        s.stepFaults(STEP, true);
        if (find === null && s.finds.alive !== null) {
          s.collectFind();
          find = s.finds.nextIn;
        }
        if (fault === null && s.faults.alive !== null) {
          s.clearFault();
          fault = s.faults.nextIn;
        }
      }
      if (find === null || fault === null) throw new Error('a clock never caught a Find or a fault');
      return { find, fault };
    };
    const unit = (seconds: number, [lo, hi]: readonly [number, number]): number => (seconds - lo) / (hi - lo);
    for (const now of [1_000_000, 1_700_000_000_123, 987_654_321]) {
      const { find, fault } = firstCatch(now);
      expect(unit(find, FINDS.intervalS)).not.toBeCloseTo(unit(fault, FAULTS.intervalS), 6);
    }
  });

  it('RELICS_MAX equals the number of relic notes', () => {
    expect(RELICS_MAX).toBe(RELIC_NOTES.length);
  });
});
