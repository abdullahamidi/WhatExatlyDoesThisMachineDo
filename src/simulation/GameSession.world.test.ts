// Living world block on the session (WP23a): loaded through the `world` option, replaced by recordWorld (revision only),
// kept by a new cycle except seen / eraMoments / youEras, wiped by reset, and kept through a demo era cap.
// Why: the block is optional save data, so the session must normalize it and never share its arrays.
// Pure: no persistence and no Phaser imports (the save format is tested in src/persistence).
import { describe, it, expect } from 'vitest';
import { DEFAULT_WORLD_SAVE, RELICS_MAX } from '../data/livingWorld';
import type { WorldSaveState } from '../data/livingWorld';
import { GameSession } from './GameSession';
import { clampLoadToEra } from './progression/edition';
import { DEFAULT_PRESTIGE } from './prestige';
import { createInitialState } from './state';
import { normalizeWorld } from './worldSave';
import type { GameState } from '../data/types';

const SAMPLE: WorldSaveState = {
  seen: ['INS-01', 'CRW-01'],
  seenEver: ['INS-01', 'CRW-01', 'beat.tapeFreeze', 'DOG-01'],
  eraMoments: [2, 1, 0, 0, 0],
  youEras: 1,
};

// A finished run: the reveal applies from the choice phase on, so beginNewCycle is allowed.
const revealedState = (): GameState => ({
  ...createInitialState(0),
  createdAt: 0,
  lastSimTime: 0,
  ending: { phase: 'choice', engagedAt: 600_000 },
});

// Records the events that a world change must NOT emit.
const watch = (session: GameSession): string[] => {
  const log: string[] = [];
  session.on('click', () => log.push('click'));
  session.on('purchase', () => log.push('purchase'));
  session.on('reset', () => log.push('reset'));
  session.on('cycle', () => log.push('cycle'));
  session.on('settings', () => log.push('settings'));
  session.on('achievement', () => log.push('achievement'));
  session.on('prestige', () => log.push('prestige'));
  return log;
};

describe('GameSession living-world block (WP23a)', () => {
  it('starts with the default block when none is given, and normalizes the one it is given', () => {
    const fresh = new GameSession({ state: createInitialState(0), now: () => 0 });
    expect(fresh.world).toEqual(DEFAULT_WORLD_SAVE);
    expect(fresh.worldRevision).toBe(0);

    const given = new GameSession({
      state: createInitialState(0),
      now: () => 0,
      world: { ...SAMPLE, seen: ['NOPE', 'INS-01', 'INS-01'] },
    });
    expect(given.world.seen).toEqual(['INS-01']);
    expect(given.world.seenEver).toEqual(SAMPLE.seenEver);
  });

  it('recordWorld stores a normalized copy and bumps worldRevision only', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0 });
    const log = watch(session);
    const revision = session.revision;
    const state = session.state;

    const input: WorldSaveState = {
      seen: ['NOPE', 'DOG-01', 'DOG-01'],
      seenEver: ['DOG-01'],
      eraMoments: [120, -3, 4.9, 0, 0],
      youEras: 99,
    };
    session.recordWorld(input);
    input.seen.push('INS-01');

    expect(session.world).toEqual({ seen: ['DOG-01'], seenEver: ['DOG-01'], eraMoments: [99, 0, 4, 0, 0], youEras: 31, relics: 0 });
    expect(session.worldRevision).toBe(1);
    expect(session.revision).toBe(revision);
    expect(session.state).toBe(state);
    expect(log).toEqual([]);
  });

  it('a session built from world keeps it, normalized', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0, world: SAMPLE });
    const again = new GameSession({ state: createInitialState(0), now: () => 0, world: session.world });
    expect(again.world).toEqual(normalizeWorld(SAMPLE));
    expect(again.world).not.toBe(session.world);
  });

  it('beginNewCycle keeps seenEver and wipes seen, eraMoments and youEras', () => {
    const session = new GameSession({ state: revealedState(), now: () => 0, world: SAMPLE });
    const revision = session.worldRevision;

    expect(session.beginNewCycle(0)).toBe(true);
    expect(session.world).toEqual({ seen: [], seenEver: SAMPLE.seenEver, eraMoments: [0, 0, 0, 0, 0], youEras: 0, relics: 0 });
    expect(session.world.seenEver).not.toBe(SAMPLE.seenEver);
    expect(session.worldRevision).toBeGreaterThan(revision);
  });

  it('beginNewCycle outside the reveal leaves the block alone', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0, world: SAMPLE });
    expect(session.beginNewCycle(0)).toBe(false);
    expect(session.world).toEqual(normalizeWorld(SAMPLE));
  });

  it('reset wipes the whole block, seenEver included', () => {
    const session = new GameSession({ state: createInitialState(0), now: () => 0, world: SAMPLE });
    const revision = session.worldRevision;

    session.reset(0);
    expect(session.world).toEqual(DEFAULT_WORLD_SAVE);
    expect(session.worldRevision).toBeGreaterThan(revision);
  });

  it('normalizes the relic count: missing, 3, 99 -> 15, -1 -> 0, text -> 0, 2.9 -> 2 (WP28)', () => {
    expect(RELICS_MAX).toBe(15);
    expect(normalizeWorld(SAMPLE).relics).toBe(0);
    expect(normalizeWorld({ ...SAMPLE, relics: 3 }).relics).toBe(3);
    expect(normalizeWorld({ ...SAMPLE, relics: 99 }).relics).toBe(15);
    expect(normalizeWorld({ ...SAMPLE, relics: -1 }).relics).toBe(0);
    expect(normalizeWorld({ ...SAMPLE, relics: '7' }).relics).toBe(0);
    expect(normalizeWorld({ ...SAMPLE, relics: 2.9 }).relics).toBe(2);
  });

  it('the default block and a fresh session carry relics 0 (WP28)', () => {
    expect(DEFAULT_WORLD_SAVE.relics).toBe(0);
    expect(normalizeWorld(undefined).relics).toBe(0);
    expect(new GameSession({ state: createInitialState(0), now: () => 0 }).world.relics).toBe(0);
    const given = new GameSession({ state: createInitialState(0), now: () => 0, world: { ...SAMPLE, relics: 4 } });
    expect(given.world.relics).toBe(4);
  });

  it('a demo-capped session keeps the block that the era clamp leaves alone', () => {
    const base = createInitialState(0);
    const load = clampLoadToEra(
      { state: { ...base, techLevels: { ...base.techLevels, boiler: 1 } }, prestige: DEFAULT_PRESTIGE },
      2,
    );
    expect(load.changed).toBe(true);

    const session = new GameSession({ state: load.state, prestige: load.prestige, world: SAMPLE, maxEra: 2, now: () => 0 });
    expect(session.state.techLevels.boiler).toBe(0);
    expect(session.world).toEqual(normalizeWorld(SAMPLE));
  });
});
