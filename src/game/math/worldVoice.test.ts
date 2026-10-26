// Tests for the world-voice scheduler (WP23a): each line kind end to end, gaps, caps and the hour cap, RARE / OFF, the first
// moment and warm-up, every hard-silence reason, toast gating, the 60 % rule, the you slot, era gating (INS-04, INS-07),
// the CROSSED LINES chain (placeWait hold, blocked give-ups), the POST-CAP arc (reload resume, era II drop, done, blocked
// give-up), force, reset, state copies and determinism.
// WP23b (Q-T9): the tier slot, era entry, openers, the postgame gate, the buy level gate, chain steps as unison groups
// (SYNCHRONIZATION, ONE OBSERVER), per-era DOG-02, and setting OFF with beats.
// Every clock is ctx.nowMs (a fake clock from T0). No Phaser, no DOM.
import { describe, it, expect } from 'vitest';
import { createWorldScheduler } from './worldVoice';
import type { WorldSchedulerConfig, WorldSchedulerState } from './worldVoice';
import type { WorldCue, WorldSchedulerCtx } from './worldVoiceRules';
import { WORLD_LINES, WORLD_SILENCE, WORLD_VOICE_CONFIG } from '../../data/livingWorld';
import type { WorldLine, WorldOffer, WorldSaveState } from '../../data/livingWorld';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';

const T0 = 10_000_000; // scheduler clock base, far from zero
const MIN = 60_000;
const CFG = WORLD_VOICE_CONFIG;

function freshWorld(over: Partial<WorldSaveState> = {}): WorldSaveState {
  return { seen: [], seenEver: [], eraMoments: [0, 0, 0, 0, 0], youEras: 0, ...over };
}

function zeroLevels(over: Partial<Record<TechId, number>> = {}): Record<TechId, number> {
  const base = Object.fromEntries(TECH_IDS.map((id) => [id, 0])) as Record<TechId, number>;
  return { ...base, ...over };
}

// A purchase offer comes after the director has set the bought level in ctx.levels (the buy level gate reads it).
function bought(techId: TechId, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx {
  const levels = zeroLevels();
  levels[techId] = 1;
  return makeCtx({ levels, ...over });
}

// Input never goes quiet by default, so idle lines stay silent and each test sees only the trigger it names.
// Idle tests pass QUIET (input stopped a minute ago).
const QUIET: Partial<WorldSchedulerCtx> = { lastInputMs: T0 - MIN };

function makeCtx(over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx {
  return {
    nowMs: T0, playMs: 600_000, lastInputMs: Number.POSITIVE_INFINITY, warmupUntilMs: 0, era: 1, cycle: 1,
    edition: 'full', setting: 'on', silence: null, hasClicked: true, hasPurchased: true,
    toastUp: false, toastClearedAtMs: null, indexClosedAtMs: null, bubblesVisible: 0, bubbleVisibleMs: 0,
    onScreen: () => true, world: freshWorld(), levels: zeroLevels(), logsSeen: new Set<string>(),
    lifetimeEe: 0, localHour: null,
    ...over,
  };
}

// The demo edition at era II, the POST-CAP stage.
function demo(over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx {
  return makeCtx({ edition: 'demo', era: 2, ...over });
}

// Only these speakers are on screen.
function only(...speakers: string[]): (speaker: string) => boolean {
  return (speaker) => speakers.includes(speaker);
}

function lineOf(id: string): WorldLine {
  const found = WORLD_LINES.find((l) => l.id === id);
  if (found === undefined) throw new Error(`no line ${id}`);
  return found;
}

function cueFor(id: string): WorldCue {
  return { kind: 'line', ids: [id], speakers: [lineOf(id).speaker] };
}

// One CROSSED LINES step: step is the 1-based member number.
function stepOf(id: string, step: number): WorldCue {
  return { kind: 'chainStep', ids: [id], speakers: [lineOf(id).speaker], chainId: 'crossedLines', step };
}

function seenWorld(block: WorldSaveState | null): WorldSaveState {
  if (block === null) throw new Error('line was not counted as seen');
  return block;
}

function crossed(): WorldOffer {
  return { kind: 'chain', chainId: 'crossedLines', step: 1 };
}

const EMPTY_STATE: WorldSchedulerState = {
  pending: [], chain: null, postCap: { active: false, step: 0, nextAtMs: null, done: false },
  lastMomentAtMs: null, hourMoments: 0, bySpeaker: {},
};

describe('offers: each line kind end to end', () => {
  it('logReply: INS-01 waits for the toast to clear + 1 s', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ toastUp: true }));
    expect(s.tick(makeCtx({ toastUp: true }))).toBeNull();
    const clearedAt = T0 + 5_000;
    expect(s.tick(makeCtx({ nowMs: clearedAt + 999, toastClearedAtMs: clearedAt }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: clearedAt + 1_000, toastClearedAtMs: clearedAt }))).toEqual(cueFor('INS-01'));
  });

  it('buy: CRW-03 waits for the TECH INDEX to close + 2.5 s', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'buy', techId: 'pistonArray' }, bought('pistonArray', { indexClosedAtMs: T0 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 2_499, indexClosedAtMs: T0 }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 2_500, indexClosedAtMs: T0 }))).toEqual(cueFor('CRW-03'));
  });

  it('buy: PAY-02 is core, so it plays in RARE, while the non-core CRW-03 does not', () => {
    const rare = bought('powerLines', { era: 2, setting: 'rare' });
    const s = createWorldScheduler();
    s.offer({ kind: 'buy', techId: 'powerLines' }, rare);
    expect(s.tick(rare)).toEqual(cueFor('PAY-02'));
    const s2 = createWorldScheduler();
    s2.offer({ kind: 'buy', techId: 'pistonArray' }, bought('pistonArray', { setting: 'rare' }));
    expect(s2.tick(makeCtx({ setting: 'rare' }))).toBeNull();
  });

  it('ms: INS-04 (core) fires on generatorBlueprint after the TECH INDEX closes', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'ms', techId: 'generatorBlueprint' }, makeCtx({ indexClosedAtMs: T0 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 2_499, indexClosedAtMs: T0 }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 2_500, indexClosedAtMs: T0 }))).toEqual(cueFor('INS-04'));
  });

  it('rapid: DOG-03 fires once, then stays seen', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('DOG-03'));
    const world = seenWorld(s.shown('DOG-03', 1, makeCtx()));
    expect(world.seen).toEqual(['DOG-03']);
    expect(world.seenEver).toEqual(['DOG-03']);
    s.offer({ kind: 'rapid' }, makeCtx({ nowMs: T0 + 400_000, world }));
    expect(s.tick(makeCtx({ nowMs: T0 + 400_000, world }))).toBeNull();
  });

  it('tier: DOG-04 fires on improvedPistons tier 3 only, after the index closes', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx({ indexClosedAtMs: T0 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 2_499, indexClosedAtMs: T0 }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 2_500, indexClosedAtMs: T0 }))).toEqual(cueFor('DOG-04'));
    const other = createWorldScheduler();
    other.offer({ kind: 'tier', techId: 'improvedPistons', tier: 2 }, makeCtx());
    expect(other.state().pending).toEqual([]);
  });

  it('tier firstTop: INS-13 fires on the first top tier of the cycle', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', firstTop: true }, makeCtx({ indexClosedAtMs: T0 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 2_500, indexClosedAtMs: T0 }))).toEqual(cueFor('INS-13'));
  });

  it('offline: DOG-07 fires after a 1 h absence and ignores the warm-up; a shorter absence is not offered', () => {
    const warm = makeCtx({ warmupUntilMs: T0 + MIN });
    const s = createWorldScheduler();
    s.offer({ kind: 'offline', minS: 3_600 }, warm);
    expect(s.tick(warm)).toEqual(cueFor('DOG-07'));
    const short = createWorldScheduler();
    short.offer({ kind: 'offline', minS: 3_599 }, makeCtx());
    expect(short.state().pending).toEqual([]);
  });

  it('demoNear: GRL-05 fires at lifetime EE 3M (core, era II), not below it', () => {
    const s = createWorldScheduler();
    const girl = makeCtx({ era: 2, onScreen: only('girl'), world: freshWorld({ seen: ['GRL-04'] }) });
    expect(s.tick({ ...girl, lifetimeEe: 2_999_999 })).toBeNull();
    expect(s.tick({ ...girl, lifetimeEe: 3_000_000 })).toEqual(cueFor('GRL-05'));
  });

  it('idle: CRW-02 needs observer-count logged (afterLog)', () => {
    const s = createWorldScheduler();
    expect(s.tick(makeCtx({ ...QUIET, onScreen: only('crow') }))).toBeNull();
    expect(s.tick(makeCtx({ ...QUIET, onScreen: only('crow'), logsSeen: new Set(['observer-count']) }))).toEqual(cueFor('CRW-02'));
  });

  it('idle: DOG-01 needs wornMotor owned, DOG-05 needs powerLines owned (era II)', () => {
    const dogOnly = makeCtx({ ...QUIET, onScreen: only('dog'), world: freshWorld({ seen: ['DOG-02'] }) });
    const s = createWorldScheduler();
    expect(s.tick(dogOnly)).toBeNull();
    expect(s.tick({ ...dogOnly, levels: zeroLevels({ wornMotor: 1 }) })).toEqual(cueFor('DOG-01'));
    const era2 = createWorldScheduler();
    const dogEra2 = { ...dogOnly, era: 2 };
    expect(era2.tick(dogEra2)).toBeNull();
    expect(era2.tick({ ...dogEra2, levels: zeroLevels({ powerLines: 1 }) })).toEqual(cueFor('DOG-05'));
  });

  it('idle: GRL-01 needs 360 s of play (core, you, era I)', () => {
    const s = createWorldScheduler();
    const girl = makeCtx({ ...QUIET, onScreen: only('girl') });
    expect(s.tick({ ...girl, playMs: 359_999 })).toBeNull();
    expect(s.tick({ ...girl, playMs: 360_000 })).toEqual(cueFor('GRL-01'));
  });

  it('idle: GRL-02 needs GRL-01 seen, 300 s of play and the local hour 0-4', () => {
    const girl = makeCtx({ ...QUIET, era: 2, onScreen: only('girl'), world: freshWorld({ seen: ['GRL-01', 'GRL-04'] }) });
    const s = createWorldScheduler();
    expect(s.tick({ ...girl, localHour: null })).toBeNull();
    expect(s.tick({ ...girl, localHour: 5 })).toBeNull();
    expect(s.tick({ ...girl, localHour: 2 })).toEqual(cueFor('GRL-02'));
  });
});

describe('queue rules', () => {
  it('duplicate offers are ignored', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'chamber-seal' }, makeCtx());
    s.offer({ kind: 'logReply', logId: 'chamber-seal' }, makeCtx());
    expect(s.state().pending.map((p) => p.id)).toEqual(['INS-02']);
  });

  it('one non-core reactive pending: a newer offer replaces the older', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx());
    s.offer({ kind: 'buy', techId: 'pistonArray' }, bought('pistonArray'));
    expect(s.state().pending.map((p) => p.id)).toEqual(['CRW-03']);
  });

  it('one tier pending: the first-top INS-13 takes the slot from a pending DOG-04; a second DOG-04 is refused (WP23b tier slot)', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx());
    s.offer({ kind: 'tier', firstTop: true }, makeCtx());
    expect(s.state().pending.map((p) => [p.id, p.priority])).toEqual([['INS-13', 3]]);
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx());
    expect(s.state().pending.map((p) => [p.id, p.priority])).toEqual([['INS-13', 3]]);
  });

  it('one tier pending: a second first-top offer is refused while INS-13 is pending', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', firstTop: true }, makeCtx());
    s.offer({ kind: 'tier', firstTop: true }, makeCtx({ nowMs: T0 + 1_000 }));
    expect(s.state().pending.map((p) => p.id)).toEqual(['INS-13']);
  });

  it('one tier pending: an INS-13 offer whose speaker is off screen does not take the slot from DOG-04', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx({ onScreen: only('dog') }));
    s.offer({ kind: 'tier', firstTop: true }, makeCtx({ onScreen: only('dog') }));
    expect(s.state().pending.map((p) => p.id)).toEqual(['DOG-04']);
  });

  it('a core reactive line (priority 1) starts before a non-core one (priority 2); the next tick is gated by the gap', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx());
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('INS-01'));
    expect(s.tick(makeCtx())).toBeNull();
  });

  it('an offer is queued only when its line is eligible now (speaker on screen at offer time)', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ onScreen: only('dog') }));
    s.offer({ kind: 'chain', chainId: 'crossedLines', step: 1 }, makeCtx({ era: 2, onScreen: only('inspector') }));
    expect(s.state().pending).toEqual([]);
  });

  it('a non-core logReply pending expires after 40 s, even during silence', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'chamber-seal' }, makeCtx());
    s.tick(makeCtx({ nowMs: T0 + 39_999, silence: 'quiet' }));
    expect(s.state().pending.map((p) => p.id)).toEqual(['INS-02']);
    s.tick(makeCtx({ nowMs: T0 + 40_000, silence: 'quiet' }));
    expect(s.state().pending).toEqual([]);
  });

  it('a beat is not a moment: no first-moment or warm-up gate, lastMomentAtMs unchanged', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'beat', beat: 'beat.failedSync' }, makeCtx({ playMs: 10_000, warmupUntilMs: T0 + MIN }));
    const cue = s.tick(makeCtx({ playMs: 10_000, warmupUntilMs: T0 + MIN }));
    expect(cue).toEqual({ kind: 'beat', ids: ['beat.failedSync'], speakers: [] });
    expect(s.state().lastMomentAtMs).toBeNull();
    const world = seenWorld(s.shown('beat.failedSync', 0, makeCtx()));
    expect(world.seen).toEqual(['beat.failedSync']);
    expect(world.seenEver).toEqual(['beat.failedSync']);
  });
});

describe('gaps', () => {
  it('120 s between two moments: a rapid line waits for the minimum gap', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('INS-01'));
    s.shown('INS-01', 1, makeCtx());
    s.offer({ kind: 'rapid' }, makeCtx({ nowMs: T0 + 60_000 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 60_000 }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 120_000 }))).toEqual(cueFor('DOG-03'));
  });

  it('a log reply waits only 45 s after the previous moment', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('DOG-03'));
    s.shown('DOG-03', 1, makeCtx());
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ nowMs: T0 + 30_000 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 30_000 }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 45_000 }))).toEqual(cueFor('INS-01'));
  });

  it('360 s between two non-core moments of the same era', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('DOG-03'));
    const world = seenWorld(s.shown('DOG-03', 1, makeCtx()));
    // Offered at 300 s (inside the 90 s reactive TTL), so the pending line is still alive when the gap clears at 360 s.
    s.offer({ kind: 'buy', techId: 'pistonArray' }, bought('pistonArray', { nowMs: T0 + 300_000, world }));
    expect(s.tick(makeCtx({ nowMs: T0 + 300_000, world }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 359_999, world }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 360_000, world }))).toEqual(cueFor('CRW-03'));
  });

  it('300 s per denizen (the non-core gap is set aside here)', () => {
    const cfg: WorldSchedulerConfig = { ...CFG, nonCoreGapMs: 0 };
    const s = createWorldScheduler(cfg);
    s.offer({ kind: 'rapid' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('DOG-03'));
    const world = seenWorld(s.shown('DOG-03', 1, makeCtx()));
    // Offered at 240 s (inside the 90 s reactive TTL): blocked until the per-denizen gap clears at 300 s.
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx({ nowMs: T0 + 240_000, world }));
    expect(s.tick(makeCtx({ nowMs: T0 + 240_000, world }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 299_999, world }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 300_000, world }))).toEqual(cueFor('DOG-04'));
  });
});

describe('caps and hour cap', () => {
  it('era I non-core cap: three counted, the fourth refused; a core line still passes', () => {
    const s = createWorldScheduler();
    const offers: WorldOffer[] = [
      { kind: 'rapid' }, { kind: 'buy', techId: 'pistonArray' },
      { kind: 'logReply', logId: 'chamber-seal' }, { kind: 'logReply', logId: 'unlabeled-part' },
    ];
    const ids = ['DOG-03', 'CRW-03', 'INS-02', 'CRW-01'];
    let world = freshWorld();
    for (let i = 0; i < 3; i += 1) {
      const now = T0 + i * 400_000;
      s.offer(offers[i] ?? { kind: 'rapid' }, bought('pistonArray', { nowMs: now, world }));
      expect(s.tick(makeCtx({ nowMs: now, world }))).toEqual(cueFor(ids[i] ?? ''));
      world = seenWorld(s.shown(ids[i] ?? '', 1, makeCtx({ nowMs: now, world })));
    }
    expect(world.eraMoments[0]).toBe(3);
    const fourth = T0 + 1_200_000;
    s.offer(offers[3] ?? { kind: 'rapid' }, makeCtx({ nowMs: fourth, world }));
    expect(s.tick(makeCtx({ nowMs: fourth, world }))).toBeNull();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ nowMs: fourth, world }));
    expect(s.tick(makeCtx({ nowMs: fourth, world }))).toEqual(cueFor('INS-01'));
  });

  it('hour cap 8 per rolling hour, and it rolls off after an hour', () => {
    const cfg: WorldSchedulerConfig = { ...CFG, minGapMs: 0, nonCoreGapMs: 0, perDenizenGapMs: 0 };
    const s = createWorldScheduler(cfg);
    for (let i = 0; i < 8; i += 1) {
      const now = T0 + i * 1_000;
      s.offer({ kind: 'rapid' }, makeCtx({ nowMs: now }));
      expect(s.tick(makeCtx({ nowMs: now }))).toEqual(cueFor('DOG-03'));
      s.shown('DOG-03', 1, makeCtx({ nowMs: now }));
    }
    const ninth = T0 + 8_000;
    s.offer({ kind: 'rapid' }, makeCtx({ nowMs: ninth }));
    expect(s.tick(makeCtx({ nowMs: ninth }))).toBeNull();
    const later = T0 + 3_600_000 + 8_000;
    expect(s.tick(makeCtx({ nowMs: later }))).toBeNull(); // the stale ninth entry expires here
    s.offer({ kind: 'rapid' }, makeCtx({ nowMs: later }));
    expect(s.tick(makeCtx({ nowMs: later }))).toEqual(cueFor('DOG-03'));
  });

  it('cycle 2: the hour cap drops to 4', () => {
    const cfg: WorldSchedulerConfig = { ...CFG, minGapMs: 0, nonCoreGapMs: 0, perDenizenGapMs: 0 };
    const s = createWorldScheduler(cfg);
    for (let i = 0; i < 4; i += 1) {
      const now = T0 + i * 1_000;
      s.offer({ kind: 'rapid' }, makeCtx({ nowMs: now, cycle: 2 }));
      expect(s.tick(makeCtx({ nowMs: now, cycle: 2 }))).toEqual(cueFor('DOG-03'));
      s.shown('DOG-03', 1, makeCtx({ nowMs: now, cycle: 2 }));
    }
    s.offer({ kind: 'rapid' }, makeCtx({ nowMs: T0 + 4_000, cycle: 2 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 4_000, cycle: 2 }))).toBeNull();
  });
});

describe('setting, first moment, warm-up, silence and toast', () => {
  it('RARE: core lines only; OFF: no line or chain is queued or ticked', () => {
    const rare = createWorldScheduler();
    rare.offer({ kind: 'rapid' }, makeCtx({ setting: 'rare' }));
    expect(rare.tick(makeCtx({ setting: 'rare' }))).toBeNull();
    rare.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ setting: 'rare' }));
    expect(rare.tick(makeCtx({ setting: 'rare' }))).toEqual(cueFor('INS-01'));

    const off = createWorldScheduler();
    const offCtx = makeCtx({ setting: 'off' });
    off.offer({ kind: 'logReply', logId: 'observer-count' }, offCtx);
    off.offer({ kind: 'rapid' }, offCtx);
    off.offer(crossed(), makeCtx({ setting: 'off', era: 2 }));
    expect(off.state().pending).toEqual([]);
    expect(off.state().chain).toBeNull();
    expect(off.tick(offCtx)).toBeNull();
    expect(off.tick(makeCtx({ nowMs: T0 + 1_000 }))).toBeNull();
    expect(off.shown('INS-01', 1, offCtx)).toBeNull();
  });

  it('OFF keeps wordless beats: a beat is queued, ticks, and is counted seen at any fraction', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'beat', beat: 'beat.failedSync' }, makeCtx({ setting: 'off' }));
    expect(s.state().pending.map((p) => p.id)).toEqual(['beat.failedSync']);
    expect(s.tick(makeCtx({ setting: 'off' }))).toEqual({ kind: 'beat', ids: ['beat.failedSync'], speakers: [] });
    expect(s.state().lastMomentAtMs).toBeNull();
    const world = seenWorld(s.shown('beat.failedSync', 1, makeCtx({ setting: 'off' })));
    expect(world.seen).toEqual(['beat.failedSync']);
    expect(world.seenEver).toEqual(['beat.failedSync']);
  });

  it('OFF: a queued beat waits for hard silence and for a toast, then plays', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'beat', beat: 'beat.failedSync' }, makeCtx({ setting: 'off' }));
    expect(s.tick(makeCtx({ setting: 'off', silence: 'tech-index' }))).toBeNull();
    expect(s.tick(makeCtx({ setting: 'off', toastUp: true }))).toBeNull();
    expect(s.tick(makeCtx({ setting: 'off' }))).toEqual({ kind: 'beat', ids: ['beat.failedSync'], speakers: [] });
  });

  it('first moment: play time must reach 90 s', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ playMs: 89_999 }));
    expect(s.tick(makeCtx({ playMs: 89_999 }))).toBeNull();
    expect(s.tick(makeCtx({ playMs: 90_000 }))).toEqual(cueFor('INS-01'));
  });

  it('first moment: at least one click and one purchase', () => {
    const noClick = createWorldScheduler();
    noClick.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ hasClicked: false }));
    expect(noClick.tick(makeCtx({ hasClicked: false }))).toBeNull();
    const noBuy = createWorldScheduler();
    noBuy.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ hasPurchased: false }));
    expect(noBuy.tick(makeCtx({ hasPurchased: false }))).toBeNull();
  });

  it('offline (DOG-07) is not held by the first-moment play time: it plays 8 s into a new session, inside its 90 s TTL', () => {
    const s = createWorldScheduler();
    const early = makeCtx({ playMs: 0, warmupUntilMs: T0 + MIN });
    s.offer({ kind: 'offline', minS: 3_600 }, early);
    expect(s.tick({ ...early, nowMs: T0 + 8_000, playMs: 8_000 })).toEqual(cueFor('DOG-07'));
  });

  it('warm-up: 60 s after load (offline is the exception)', () => {
    const s = createWorldScheduler();
    const warm = makeCtx({ warmupUntilMs: T0 + MIN });
    s.offer({ kind: 'logReply', logId: 'observer-count' }, warm);
    expect(s.tick(warm)).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + MIN, warmupUntilMs: T0 + MIN }))).toEqual(cueFor('INS-01'));
  });

  it('every hard-silence reason blocks a start; the queued line waits and plays after', () => {
    for (const reason of WORLD_SILENCE) {
      const s = createWorldScheduler();
      s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
      expect(s.tick(makeCtx({ silence: reason }))).toBeNull();
      expect(s.tick(makeCtx())).toEqual(cueFor('INS-01'));
    }
  });

  it('a toast blocks every bubble start; a bubble in flight blocks a new one', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx({ toastUp: true }));
    expect(s.tick(makeCtx({ toastUp: true }))).toBeNull();
    expect(s.tick(makeCtx({ nowMs: T0 + 1_000 }))).toEqual(cueFor('DOG-03'));
    const busy = createWorldScheduler();
    busy.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
    expect(busy.tick(makeCtx({ bubblesVisible: 1 }))).toBeNull();
    expect(busy.tick(makeCtx())).toEqual(cueFor('INS-01'));
  });
});

describe('the 60 % seen rule', () => {
  it('a core line cut before 60 % returns to pending with the same era limit', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('INS-01'));
    expect(s.shown('INS-01', 0.59, makeCtx({ nowMs: T0 + 5_000 }))).toBeNull();
    expect(s.state().pending.map((p) => [p.id, p.offerEra])).toEqual([['INS-01', 1]]);
    expect(s.tick(makeCtx({ nowMs: T0 + 130_000 }))).toEqual(cueFor('INS-01'));
  });

  it('a non-core line cut before 60 % is dropped: unseen, not offered again by that trigger', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('DOG-03'));
    expect(s.shown('DOG-03', 0.59, makeCtx())).toBeNull();
    expect(s.state().pending).toEqual([]);
    expect(s.tick(makeCtx({ nowMs: T0 + 400_000 }))).toBeNull();
  });

  it('a fraction of exactly 0.6 counts as seen; an unknown id returns null', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'rapid' }, makeCtx());
    s.tick(makeCtx());
    expect(seenWorld(s.shown('DOG-03', 0.6, makeCtx())).seen).toEqual(['DOG-03']);
    expect(s.shown('DOG-03', 1, makeCtx())).toBeNull();
    expect(s.shown('NOPE-99', 1, makeCtx())).toBeNull();
  });

  it('F19: a core line blocked once is requeued; blocked twice it is given up and not requeued', () => {
    const s = createWorldScheduler();
    const era2 = bought('powerLines', { era: 2 });
    s.offer({ kind: 'buy', techId: 'powerLines' }, era2);
    expect(s.tick(era2)).toEqual(cueFor('PAY-02'));
    expect(s.shown('PAY-02', 0, era2, { blocked: true })).toBeNull();
    expect(s.state().pending.map((p) => p.id)).toEqual(['PAY-02']);
    const later = makeCtx({ era: 2, nowMs: T0 + 2 * MIN });
    expect(s.tick(later)).toEqual(cueFor('PAY-02'));
    expect(s.shown('PAY-02', 0, later, { blocked: true })).toBeNull();
    expect(s.state().pending).toEqual([]);
  });

  it('F19: a counted line clears its block count, so a later cycle blocked once is requeued, not given up', () => {
    const s = createWorldScheduler();
    const era2 = bought('powerLines', { era: 2 });
    s.offer({ kind: 'buy', techId: 'powerLines' }, era2);
    expect(s.tick(era2)).toEqual(cueFor('PAY-02'));
    expect(s.shown('PAY-02', 0, era2, { blocked: true })).toBeNull();
    const second = makeCtx({ era: 2, nowMs: T0 + 2 * MIN });
    expect(s.tick(second)).toEqual(cueFor('PAY-02'));
    const world = seenWorld(s.shown('PAY-02', 1, second));
    expect(world.seen).toEqual(['PAY-02']);
    // A new cycle: the line is offered again and blocked once. The count was cleared, so it is requeued.
    const cycle2 = bought('powerLines', { era: 2, nowMs: T0 + 4 * MIN, world: freshWorld({ seenEver: world.seenEver }) });
    s.offer({ kind: 'buy', techId: 'powerLines' }, cycle2);
    expect(s.tick(cycle2)).toEqual(cueFor('PAY-02'));
    expect(s.shown('PAY-02', 0, cycle2, { blocked: true })).toBeNull();
    expect(s.state().pending.map((p) => p.id)).toEqual(['PAY-02']);
  });
});

describe('you slot and era gating', () => {
  it('one non-core you line per era: GRL-04 uses the slot, GRL-02 is then refused; GRL-01 (core) always fires', () => {
    const first = createWorldScheduler();
    const girl2 = demo({ ...QUIET, onScreen: only('girl'), world: freshWorld({ seen: ['GRL-01'] }) });
    expect(first.tick(girl2)).toEqual(cueFor('GRL-04'));
    const world = seenWorld(first.shown('GRL-04', 1, girl2));
    expect(world.youEras).toBe(2);

    const refused = createWorldScheduler();
    const used = { ...girl2, localHour: 2, world: freshWorld({ seen: ['GRL-01', 'GRL-04'], youEras: 2 }) };
    expect(refused.tick(used)).toBeNull();
    const control = createWorldScheduler();
    expect(control.tick({ ...used, world: freshWorld({ seen: ['GRL-01', 'GRL-04'] }) })).toEqual(cueFor('GRL-02'));

    const core = createWorldScheduler();
    expect(core.tick(makeCtx({ ...QUIET, onScreen: only('girl'), world: freshWorld({ youEras: 1 }) }))).toEqual(cueFor('GRL-01'));
  });

  it('an ms line keeps its offer era: INS-04 offered in era I plays in era II, is dropped in era III', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'ms', techId: 'generatorBlueprint' }, makeCtx({ era: 1 }));
    expect(s.tick(makeCtx({ era: 2 }))).toEqual(cueFor('INS-04'));

    const late = createWorldScheduler();
    late.offer({ kind: 'ms', techId: 'generatorBlueprint' }, makeCtx({ era: 1 }));
    expect(late.tick(makeCtx({ era: 3 }))).toBeNull();
    expect(late.state().pending).toEqual([]);
  });

  it('a non-ms line is not delivered after its offer era ends', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'chamber-seal' }, makeCtx({ era: 1 }));
    expect(s.tick(makeCtx({ era: 2 }))).toBeNull();
    expect(s.state().pending).toEqual([]);
  });

  it('INS-07 (ms) is ignored in the demo and delivered in the full game', () => {
    const d = createWorldScheduler();
    d.offer({ kind: 'ms', techId: 'substationBlueprint' }, demo());
    expect(d.state().pending).toEqual([]);
    expect(d.tick(demo())).toBeNull();

    const full = createWorldScheduler();
    full.offer({ kind: 'ms', techId: 'substationBlueprint' }, makeCtx({ era: 2 }));
    expect(full.tick(makeCtx({ era: 2 }))).toEqual(cueFor('INS-07'));
  });

  it('the scheduler is idle from era VI (layer gate, WP23b maxEra 5)', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ era: 6 }));
    expect(s.state().pending).toEqual([]);
    expect(s.tick(makeCtx({ era: 6 }))).toBeNull();
  });
});

describe('CROSSED LINES chain', () => {
  it('PAY-01, CRW-04, INS-05 one step per 1.2 s of bubble, each counted', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    const first = makeCtx({ era: 2 });
    expect(s.tick(first)).toEqual({ kind: 'chainStep', ids: ['PAY-01'], speakers: ['payphone'], chainId: 'crossedLines', step: 1 });
    let world = seenWorld(s.shown('PAY-01', 1, first));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_199, bubblesVisible: 1, bubbleVisibleMs: 1_199, world }))).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_200, bubblesVisible: 1, bubbleVisibleMs: 1_200, world })))
      .toEqual({ kind: 'chainStep', ids: ['CRW-04'], speakers: ['crow'], chainId: 'crossedLines', step: 2 });
    world = seenWorld(s.shown('CRW-04', 1, makeCtx({ era: 2, world })));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 2_400, bubblesVisible: 1, bubbleVisibleMs: 1_200, world })))
      .toEqual({ kind: 'chainStep', ids: ['INS-05'], speakers: ['inspector'], chainId: 'crossedLines', step: 3 });
    expect(s.state().chain).toBeNull();
  });

  it('an off-screen member is skipped (stays unseen) and the run goes on', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    s.shown('PAY-01', 1, makeCtx({ era: 2 }));
    const cue = s.tick(makeCtx({ era: 2, nowMs: T0 + 1_200, bubblesVisible: 1, bubbleVisibleMs: 1_200, onScreen: only('payphone', 'inspector') }));
    expect(cue).toEqual({ kind: 'chainStep', ids: ['INS-05'], speakers: ['inspector'], chainId: 'crossedLines', step: 3 });
    expect(s.state().chain).toBeNull();
  });

  it('a member already seen is skipped', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    const world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2 })));
    const seenCrow = { world: freshWorld({ seen: [...world.seen, 'CRW-04'], seenEver: [...world.seenEver, 'CRW-04'] }) };
    const cue = s.tick(makeCtx({ era: 2, nowMs: T0 + 1_200, bubblesVisible: 1, bubbleVisibleMs: 1_200, ...seenCrow }));
    expect(cue).toEqual({ kind: 'chainStep', ids: ['INS-05'], speakers: ['inspector'], chainId: 'crossedLines', step: 3 });
  });

  it('a hard silence pauses the run: PAY-01 shown in full, then interrupt; CRW-04 and INS-05 still play in order after it', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    let world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2 })));
    s.interrupt('tech-index', makeCtx({ era: 2 }));
    expect(s.state().chain).toEqual({ chainId: 'crossedLines', step: 1 });
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 5_000, silence: 'tech-index', world }))).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 6_000, world }))).toEqual(stepOf('CRW-04', 2));
    world = seenWorld(s.shown('CRW-04', 1, makeCtx({ era: 2, nowMs: T0 + 6_000, world })));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 7_200, bubblesVisible: 1, bubbleVisibleMs: 1_200, world }))).toEqual(stepOf('INS-05', 3));
    expect(s.state().chain).toBeNull();
  });

  it('a resumed step waits 2.5 s after a TECH INDEX close', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    const world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2 })));
    s.interrupt('tech-index', makeCtx({ era: 2 }));
    const closed = T0 + 10_000;
    expect(s.tick(makeCtx({ era: 2, nowMs: closed + 2_499, indexClosedAtMs: closed, world }))).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: closed + 2_500, indexClosedAtMs: closed, world }))).toEqual(stepOf('CRW-04', 2));
  });

  it('no step while one bubble has shown under 1.2 s; a step is allowed once no bubble is on screen', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    const world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2 })));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_199, bubblesVisible: 1, bubbleVisibleMs: 1_199, world }))).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_199, bubblesVisible: 0, bubbleVisibleMs: 0, world }))).toEqual(stepOf('CRW-04', 2));
  });

  it('OFF neither advances nor clears a running chain; it resumes when the setting is back on', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    const world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2 })));
    const off = makeCtx({ era: 2, setting: 'off', nowMs: T0 + 5_000, world });
    expect(s.tick(off)).toBeNull();
    expect(s.state().chain).toEqual({ chainId: 'crossedLines', step: 1 });
    expect(s.tick({ ...off, setting: 'on', nowMs: T0 + 6_000 })).toEqual(stepOf('CRW-04', 2));
  });

  it('CRW-04 cut at 30 % resumes: after the silence it plays again, then INS-05', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    let world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2 })));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_200, bubbleVisibleMs: 1_200, bubblesVisible: 1, world }))).toEqual(stepOf('CRW-04', 2));
    expect(s.shown('CRW-04', 0.3, makeCtx({ era: 2, nowMs: T0 + 1_500, world }))).toBeNull();
    expect(s.state().chain).toEqual({ chainId: 'crossedLines', step: 1 });
    expect(s.state().pending).toEqual([]);
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_600, silence: 'tech-index', world }))).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 9_000, world }))).toEqual(stepOf('CRW-04', 2));
    world = seenWorld(s.shown('CRW-04', 1, makeCtx({ era: 2, nowMs: T0 + 9_000, world })));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 10_200, bubblesVisible: 1, bubbleVisibleMs: 1_200, world }))).toEqual(stepOf('INS-05', 3));
  });

  it('PAY-01 cut at 30 % comes back as a chain start: PAY-01, CRW-04 and INS-05 all play', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    expect(s.tick(makeCtx({ era: 2 }))).toEqual(stepOf('PAY-01', 1));
    expect(s.shown('PAY-01', 0.3, makeCtx({ era: 2, nowMs: T0 + 5_000 }))).toBeNull();
    expect(s.state().chain).toBeNull();
    expect(s.state().pending.map((p) => [p.id, p.kind])).toEqual([['PAY-01', 'chain']]);
    // A moment starts at least minGapMs after the last one (T0): the chain start waits for it.
    const back = T0 + 2 * MIN;
    expect(s.tick(makeCtx({ era: 2, nowMs: back - 1 }))).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: back }))).toEqual(stepOf('PAY-01', 1));
    let world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2, nowMs: back })));
    expect(s.tick(makeCtx({ era: 2, nowMs: back + 1_200, bubblesVisible: 1, bubbleVisibleMs: 1_200, world }))).toEqual(stepOf('CRW-04', 2));
    world = seenWorld(s.shown('CRW-04', 1, makeCtx({ era: 2, nowMs: back + 1_200, world })));
    expect(s.tick(makeCtx({ era: 2, nowMs: back + 2_400, bubblesVisible: 1, bubbleVisibleMs: 1_200, world }))).toEqual(stepOf('INS-05', 3));
  });

  it('a first member cut after the run moved on (a later bubble is up) stays unseen and the run goes on', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_200, bubbleVisibleMs: 1_200, bubblesVisible: 1 }))).toEqual(stepOf('CRW-04', 2));
    expect(s.shown('PAY-01', 0.3, makeCtx({ era: 2, nowMs: T0 + 1_500 }))).toBeNull();
    expect(s.state().pending).toEqual([]);
    expect(s.state().chain).toEqual({ chainId: 'crossedLines', step: 2 });
    const world = seenWorld(s.shown('CRW-04', 1, makeCtx({ era: 2, nowMs: T0 + 1_500 })));
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 2_700, bubblesVisible: 1, bubbleVisibleMs: 1_200, world }))).toEqual(stepOf('INS-05', 3));
  });

  it('a chain member cut after POST-CAP starts is neither queued nor resumed (POST-CAP owns the voice)', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), demo());
    expect(s.tick(demo())).toEqual(stepOf('PAY-01', 1));
    s.offer({ kind: 'postCap', step: 0 }, demo({ nowMs: T0 + 1_000 }));
    expect(s.shown('PAY-01', 0.3, demo({ nowMs: T0 + 1_500 }))).toBeNull();
    expect(s.state().pending).toEqual([]);
    expect(s.state().chain).toBeNull();
  });

  it('a second chain start is refused while one runs; a seen first line refuses the start', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    s.offer(crossed(), makeCtx({ era: 2, nowMs: T0 + 1_000 }));
    expect(s.state().pending).toEqual([]);
    const seen = createWorldScheduler();
    seen.offer(crossed(), makeCtx({ era: 2, world: freshWorld({ seen: ['PAY-01'] }) }));
    expect(seen.state().pending).toEqual([]);
  });

  it('F17: while a member waits for its bubble (prelude or placement wait) the run holds, even with no bubble on screen', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    expect(s.tick(makeCtx({ era: 2 }))).toEqual(stepOf('PAY-01', 1));
    const waiting = (ms: number, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx =>
      makeCtx({ era: 2, nowMs: T0 + ms, chainMemberWaiting: true, ...over });
    expect(s.tick(waiting(2_300))).toBeNull();
    expect(s.tick(waiting(12_000))).toBeNull();
    expect(s.tick(waiting(12_000, { bubblesVisible: 1, bubbleVisibleMs: 5_000 }))).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 2_300, chainMemberWaiting: false }))).toEqual(stepOf('CRW-04', 2));
  });

  it('F19: a chain member blocked once is set back and re-issued; blocked twice it is given up, unseen, and the run goes on', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    s.tick(makeCtx({ era: 2 }));
    const world = seenWorld(s.shown('PAY-01', 1, makeCtx({ era: 2 })));
    const crow = makeCtx({ era: 2, nowMs: T0 + 1_200, bubblesVisible: 1, bubbleVisibleMs: 1_200, world });
    expect(s.tick(crow)).toEqual(stepOf('CRW-04', 2));
    expect(s.shown('CRW-04', 0, makeCtx({ era: 2, nowMs: T0 + 1_200, world }), { blocked: true })).toBeNull();
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_200, world }))).toEqual(stepOf('CRW-04', 2));
    expect(s.shown('CRW-04', 0, makeCtx({ era: 2, nowMs: T0 + 1_200, world }), { blocked: true })).toBeNull();
    const after = T0 + 5_000;
    expect(s.tick(makeCtx({ era: 2, nowMs: after, world }))).toEqual(stepOf('INS-05', 3));
    const last = seenWorld(s.shown('INS-05', 1, makeCtx({ era: 2, nowMs: after, world })));
    expect(s.state().chain).toBeNull();
    expect(last.seen).not.toContain('CRW-04');
    expect(last.seenEver).not.toContain('CRW-04');
  });

  it('F19: a chain start blocked twice is given up: the run ends, PAY-01 is not requeued and no step 2 is ever offered', () => {
    const s = createWorldScheduler();
    s.offer(crossed(), makeCtx({ era: 2 }));
    expect(s.tick(makeCtx({ era: 2 }))).toEqual(stepOf('PAY-01', 1));
    expect(s.shown('PAY-01', 0, makeCtx({ era: 2 }), { blocked: true })).toBeNull();
    expect(s.state().pending.map((p) => [p.id, p.kind])).toEqual([['PAY-01', 'chain']]);
    // Picked again once the minimum gap has passed, and blocked again: given up.
    const again = T0 + 2 * MIN;
    expect(s.tick(makeCtx({ era: 2, nowMs: again }))).toEqual(stepOf('PAY-01', 1));
    expect(s.shown('PAY-01', 0, makeCtx({ era: 2, nowMs: again }), { blocked: true })).toBeNull();
    expect(s.state().chain).toBeNull();
    expect(s.state().pending).toEqual([]);
    for (let i = 1; i <= 40; i += 1) {
      expect(s.tick(makeCtx({ era: 2, nowMs: again + i * 15_000 }))).toBeNull();
    }
  });
});

describe('POST-CAP (demo only, STORY_BIBLE §8.2)', () => {
  it('full arc: freeze once, PAY-05 at +20 s, then INS-07, GRL-06, DOG-12 at least 120 s apart; done after DOG-12', () => {
    const s = createWorldScheduler();
    let world = freshWorld();
    const at = (ms: number, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx => demo({ nowMs: T0 + ms, world, ...over });

    s.offer({ kind: 'postCap', step: 0 }, at(0));
    expect(s.state().postCap).toEqual({ active: true, step: 0, nextAtMs: T0 + 20_000, done: false });
    expect(s.tick(at(0))).toEqual({ kind: 'beat', ids: ['beat.tapeFreeze'], speakers: [] });
    world = seenWorld(s.shown('beat.tapeFreeze', 0, at(0)));
    expect(world.seenEver).toContain('beat.tapeFreeze');
    expect(s.tick(at(100))).toBeNull();

    expect(s.tick(at(19_999))).toBeNull();
    expect(s.tick(at(20_000))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
    world = seenWorld(s.shown('PAY-05', 1, at(20_000)));

    const plan: [string, string, number][] = [['INS-07', 'inspector', 140_000], ['GRL-06', 'girl', 260_000], ['DOG-12', 'dog', 380_000]];
    for (const [id, speaker, ms] of plan) {
      expect(s.tick(at(ms - 1))).toBeNull();
      expect(s.tick(at(ms))).toEqual({ kind: 'line', ids: [id], speakers: [speaker] });
      world = seenWorld(s.shown(id, 1, at(ms)));
    }
    expect(s.state().postCap).toEqual({ active: true, step: 4, nextAtMs: T0 + 500_000, done: true });
    expect(s.tick(at(600_000))).toBeNull();
    s.offer({ kind: 'rapid' }, at(600_000));
    expect(s.tick(at(700_000))).toBeNull();
  });

  it('the freeze waits for an empty bubble and no toast', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'postCap', step: 0 }, demo());
    expect(s.tick(demo({ bubblesVisible: 1 }))).toBeNull();
    expect(s.tick(demo({ toastUp: true }))).toBeNull();
    expect(s.tick(demo())).toEqual({ kind: 'beat', ids: ['beat.tapeFreeze'], speakers: [] });
  });

  it('PAY-05 waits, never skips: bubble, toast and an off-screen speaker each hold it', () => {
    const s = createWorldScheduler();
    const world = freshWorld({ seenEver: ['beat.tapeFreeze'] });
    s.offer({ kind: 'postCap', step: 0 }, demo({ world }));
    expect(s.tick(demo({ world, nowMs: T0 + 20_000, onScreen: only('inspector') }))).toBeNull();
    expect(s.tick(demo({ world, nowMs: T0 + 30_000, bubblesVisible: 1 }))).toBeNull();
    expect(s.tick(demo({ world, nowMs: T0 + 40_000, toastUp: true }))).toBeNull();
    expect(s.tick(demo({ world, nowMs: T0 + 50_000 }))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
  });

  it('reload resumes at the first unseen line (freeze and PAY-05 seen), due 20 s after the first tick', () => {
    const s = createWorldScheduler();
    const world = freshWorld({ seenEver: ['beat.tapeFreeze', 'PAY-05'] });
    expect(s.tick(demo({ nowMs: T0, world }))).toBeNull();
    expect(s.state().postCap).toEqual({ active: true, step: 1, nextAtMs: T0 + 20_000, done: false });
    expect(s.tick(demo({ nowMs: T0 + 19_999, world }))).toBeNull();
    expect(s.tick(demo({ nowMs: T0 + 20_000, world }))).toEqual({ kind: 'line', ids: ['INS-07'], speakers: ['inspector'] });
  });

  it('a finished save stays silent after a reload, and done is reported', () => {
    const s = createWorldScheduler();
    const world = freshWorld({ seenEver: ['beat.tapeFreeze', 'PAY-05', 'INS-07', 'GRL-06', 'DOG-12'] });
    expect(s.tick(demo({ nowMs: T0, world }))).toBeNull();
    expect(s.state().postCap.done).toBe(true);
    expect(s.tick(demo({ nowMs: T0 + 600_000, world }))).toBeNull();
  });

  it('era II pending lines are dropped when POST-CAP starts', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'buy', techId: 'powerLines' }, bought('powerLines', { edition: 'demo', era: 2, nowMs: T0 }));
    expect(s.state().pending.map((p) => p.id)).toEqual(['PAY-02']);
    s.offer({ kind: 'postCap', step: 0 }, demo({ nowMs: T0 + 1_000 }));
    expect(s.state().pending).toEqual([]);
  });

  it('a POST-CAP line cut before 60 % waits again (the cursor goes back to it)', () => {
    const s = createWorldScheduler();
    let world = freshWorld();
    const at = (ms: number, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx => demo({ nowMs: T0 + ms, world, ...over });
    s.offer({ kind: 'postCap', step: 0 }, at(0));
    expect(s.tick(at(0))).toEqual({ kind: 'beat', ids: ['beat.tapeFreeze'], speakers: [] });
    world = seenWorld(s.shown('beat.tapeFreeze', 1, at(0)));
    expect(s.tick(at(20_000))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
    expect(s.shown('PAY-05', 0.3, at(25_000))).toBeNull();
    expect(s.state().postCap.step).toBe(0);
    expect(s.tick(at(25_000))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
  });

  it('a POST-CAP offer in the full game is ignored', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'postCap', step: 0 }, makeCtx({ era: 2 }));
    expect(s.state().postCap.active).toBe(false);
    expect(s.tick(makeCtx({ era: 2, nowMs: T0 + 1_000 }))).toBeNull();
  });

  it('OFF starts POST-CAP: the freeze beat plays, no line does, and the arc resumes at PAY-05 when the setting is back on', () => {
    const s = createWorldScheduler();
    const off = demo({ setting: 'off' });
    s.offer({ kind: 'postCap', step: 0 }, off);
    expect(s.state().postCap.active).toBe(true);
    expect(s.tick(off)).toEqual({ kind: 'beat', ids: ['beat.tapeFreeze'], speakers: [] });
    const world = seenWorld(s.shown('beat.tapeFreeze', 1, off));
    // Ten minutes later, still OFF: no payphone line, and the cursor stays at its first step.
    const later = { ...off, nowMs: T0 + 10 * MIN, world };
    expect(s.tick(later)).toBeNull();
    expect(s.state().postCap.step).toBe(0);
    // PAY-05 was due 20 s after the arc started, so it plays now that the setting is back on.
    expect(s.tick({ ...later, setting: 'on' })).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
  });

  it('F19: a POST-CAP line blocked once is retried at once; blocked twice it is given up (cursor past it, one gap, unseen)', () => {
    const s = createWorldScheduler();
    let world = freshWorld();
    const at = (ms: number, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx => demo({ nowMs: T0 + ms, world, ...over });
    s.offer({ kind: 'postCap', step: 0 }, at(0));
    expect(s.tick(at(0))).toEqual({ kind: 'beat', ids: ['beat.tapeFreeze'], speakers: [] });
    world = seenWorld(s.shown('beat.tapeFreeze', 1, at(0)));
    expect(s.tick(at(20_000))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
    // First block: the cursor goes back to PAY-05 and it is issued again at the same time.
    expect(s.shown('PAY-05', 0, at(30_000), { blocked: true })).toBeNull();
    expect(s.state().postCap.step).toBe(0);
    expect(s.tick(at(30_000))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
    // Second block: given up. The cursor stays past PAY-05 and the next line waits one POST-CAP gap.
    expect(s.shown('PAY-05', 0, at(50_000), { blocked: true })).toBeNull();
    expect(s.state().postCap.step).toBe(1);
    expect(s.state().postCap.nextAtMs).toBe(T0 + 50_000 + CFG.postCapGapMs);
    expect(s.tick(at(50_000 + CFG.postCapGapMs - 1))).toBeNull();
    expect(s.tick(at(50_000 + CFG.postCapGapMs))).toEqual({ kind: 'line', ids: ['INS-07'], speakers: ['inspector'] });
    expect(world.seenEver).not.toContain('PAY-05');
  });

  it('F19: a cut (no blocked flag) puts a POST-CAP line back every time, however often it happens', () => {
    const s = createWorldScheduler();
    let world = freshWorld();
    const at = (ms: number): WorldSchedulerCtx => demo({ nowMs: T0 + ms, world });
    s.offer({ kind: 'postCap', step: 0 }, at(0));
    expect(s.tick(at(0))).toEqual({ kind: 'beat', ids: ['beat.tapeFreeze'], speakers: [] });
    world = seenWorld(s.shown('beat.tapeFreeze', 1, at(0)));
    expect(s.tick(at(20_000))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
    for (let i = 1; i <= 4; i += 1) {
      const now = 20_000 + i * 1_000;
      expect(s.shown('PAY-05', 0.3, at(now))).toBeNull();
      expect(s.state().postCap.step).toBe(0);
      expect(s.tick(at(now))).toEqual({ kind: 'line', ids: ['PAY-05'], speakers: ['payphone'] });
    }
  });
});

describe('force (debug path)', () => {
  it('null for an unknown id, OFF, a non-core line under RARE, a silence, or an off-screen speaker', () => {
    const s = createWorldScheduler();
    expect(s.force('NOPE-99', makeCtx())).toBeNull();
    expect(s.force('INS-01', makeCtx({ setting: 'off' }))).toBeNull();
    expect(s.force('DOG-03', makeCtx({ setting: 'rare' }))).toBeNull();
    expect(s.force('INS-01', makeCtx({ silence: 'photo' }))).toBeNull();
    expect(s.force('INS-01', makeCtx({ onScreen: only('dog') }))).toBeNull();
    expect(s.force('INS-01', makeCtx({ setting: 'rare' }))).toEqual(cueFor('INS-01'));
  });

  it('plays a line at once: ignores gaps and repeat policy, does not touch the moment log', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
    expect(s.tick(makeCtx())).toEqual(cueFor('INS-01'));
    s.shown('INS-01', 1, makeCtx());
    expect(s.force('DOG-03', makeCtx({ nowMs: T0 + 1_000 }))).toEqual(cueFor('DOG-03'));
    expect(s.state().lastMomentAtMs).toBe(T0);
    const seen = freshWorld({ seen: ['INS-01'], seenEver: ['INS-01'] });
    expect(s.force('INS-01', makeCtx({ nowMs: T0 + 2_000, world: seen }))).toEqual(cueFor('INS-01'));
  });
});

describe('reset and state', () => {
  it('reset clears the queue, the chain, POST-CAP, the in-flight cues and the moment log', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
    s.tick(makeCtx());
    s.offer({ kind: 'rapid' }, makeCtx({ nowMs: T0 + 1_000 }));
    s.offer({ kind: 'postCap', step: 0 }, demo({ nowMs: T0 + 2_000 }));
    s.reset();
    expect(s.state()).toEqual(EMPTY_STATE);
    expect(s.shown('INS-01', 1, makeCtx())).toBeNull();
  });

  it('state() returns copies and reports priority, the last moment, the hour count and speakers', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx());
    s.tick(makeCtx());
    s.shown('INS-01', 1, makeCtx());
    s.offer({ kind: 'rapid' }, makeCtx({ nowMs: T0 + 120_000 }));
    expect(s.tick(makeCtx({ nowMs: T0 + 120_000 }))).toEqual(cueFor('DOG-03'));
    const snap = s.state();
    expect(snap.lastMomentAtMs).toBe(T0 + 120_000);
    expect(snap.hourMoments).toBe(1);
    expect(snap.bySpeaker).toEqual({ inspector: T0, dog: T0 + 120_000 });
    snap.bySpeaker.inspector = 0;
    snap.pending.push({ id: 'X', kind: 'rapid', offerEra: 1, priority: 2, core: false, readyAtMs: 0, expiresAtMs: null });
    expect(s.state().bySpeaker.inspector).toBe(T0);
    expect(s.state().pending).toEqual([]);
  });

  it('a pending tier entry reports priority 3', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx());
    expect(s.state().pending.map((p) => p.priority)).toEqual([3]);
  });
});

describe('determinism', () => {
  it('the same offers and ctx sequence give identical cues and states', () => {
    const run = (): unknown[] => {
      const s = createWorldScheduler();
      const out: unknown[] = [];
      let world = freshWorld();
      for (let i = 0; i < 240; i += 1) {
        const now = T0 + i * 15_000;
        if (i % 7 === 0) s.offer({ kind: 'rapid' }, makeCtx({ nowMs: now, world }));
        if (i % 11 === 0) s.offer({ kind: 'logReply', logId: 'observer-count' }, makeCtx({ nowMs: now, world }));
        if (i % 13 === 0) s.offer({ kind: 'buy', techId: 'pistonArray' }, makeCtx({ nowMs: now, world }));
        const cue = s.tick(makeCtx({ nowMs: now, world, bubblesVisible: i % 5 === 0 ? 1 : 0 }));
        out.push(cue, s.state());
        if (cue !== null && cue.kind !== 'beat') {
          const id = cue.ids[0] ?? '';
          const block = s.shown(id, i % 2 === 0 ? 1 : 0.5, makeCtx({ nowMs: now, world }));
          if (block !== null) world = block;
        }
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});

// WP23b: the synchronization pair (DOG-09 + CRW-06) is one step; the cue lists both members on the same tick.
function syncCtx(ms: number, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx {
  return makeCtx({ era: 4, nowMs: T0 + ms, onScreen: only('dog', 'crow', 'payphone'), ...over });
}

function syncStep(ids: readonly string[], step: number): WorldCue {
  return { kind: 'chainStep', ids, speakers: ids.map((id) => lineOf(id).speaker), chainId: 'synchronization', step };
}

describe('WP23b: tier slot (follow-up a)', () => {
  it('INS-13 pending and DOG-04 offered: INS-13 keeps the slot; once INS-13 is shown, the next DOG-04 offer queues', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', firstTop: true }, makeCtx());
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx());
    expect(s.state().pending.map((p) => [p.id, p.priority])).toEqual([['INS-13', 3]]);
    expect(s.tick(makeCtx())).toEqual(cueFor('INS-13'));
    const world = seenWorld(s.shown('INS-13', 1, makeCtx()));
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx({ nowMs: T0 + 1_000, world }));
    expect(s.state().pending.map((p) => p.id)).toEqual(['DOG-04']);
  });

  it('the slot frees when the pending entry expires (90 s reactive TTL)', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'tier', firstTop: true }, makeCtx());
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, makeCtx());
    const late = makeCtx({ nowMs: T0 + CFG.reactiveTtlMs });
    expect(s.tick(late)).toBeNull();
    s.offer({ kind: 'tier', techId: 'improvedPistons', tier: 3 }, late);
    expect(s.state().pending.map((p) => p.id)).toEqual(['DOG-04']);
  });
});

describe('WP23b: era entry, openers and postgame routing', () => {
  it('eraEntry: PAY-06 plays 3 s after the era card closes; without a card it never plays', () => {
    const s = createWorldScheduler();
    const era3 = (over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx => makeCtx({ era: 3, eraCardClosedAtMs: T0, ...over });
    s.offer({ kind: 'eraEntry', era: 3 }, era3());
    expect(s.state().pending.map((p) => [p.id, p.kind])).toEqual([['PAY-06', 'eraEntry']]);
    expect(s.tick(era3({ nowMs: T0 + 2_999 }))).toBeNull();
    expect(s.tick(era3({ nowMs: T0 + 3_000 }))).toEqual(cueFor('PAY-06'));

    const noCard = createWorldScheduler();
    noCard.offer({ kind: 'eraEntry', era: 3 }, makeCtx({ era: 3 }));
    expect(noCard.tick(makeCtx({ era: 3, nowMs: T0 + MIN }))).toBeNull();
  });

  it('eraEntry matches only its own era: an offer for era 2 does not queue PAY-06', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'eraEntry', era: 2 }, makeCtx({ era: 2, eraCardClosedAtMs: T0 }));
    expect(s.state().pending).toEqual([]);
  });

  it('opener: PAY-13 queues in cycle 2 only, PAY-14 in cycle 3 and later only; cycle 1 queues neither', () => {
    const c1 = createWorldScheduler();
    c1.offer({ kind: 'opener', fromCycle: 2 }, makeCtx({ cycle: 1 }));
    expect(c1.state().pending).toEqual([]);

    const c2 = createWorldScheduler();
    c2.offer({ kind: 'opener', fromCycle: 2 }, makeCtx({ cycle: 2 }));
    expect(c2.state().pending.map((p) => [p.id, p.kind])).toEqual([['PAY-13', 'opener']]);
    expect(c2.tick(makeCtx({ cycle: 2 }))).toEqual(cueFor('PAY-13'));

    const c3 = createWorldScheduler();
    c3.offer({ kind: 'opener', fromCycle: 3 }, makeCtx({ cycle: 3, era: 2 }));
    expect(c3.state().pending.map((p) => [p.id, p.kind])).toEqual([['PAY-14', 'opener']]);
    expect(c3.tick(makeCtx({ cycle: 3, era: 2 }))).toEqual(cueFor('PAY-14'));
  });

  it('postgame: PAY-12 plays through the table scan at 600 s of postgame play, not before', () => {
    const post = (over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx =>
      makeCtx({ ...QUIET, era: 5, phase: 'postgame', postgameMs: 0, onScreen: only('payphone'), ...over });
    const s = createWorldScheduler();
    expect(s.tick(post({ postgameMs: 599_999 }))).toBeNull();
    expect(s.tick(post({ postgameMs: 600_000 }))).toEqual(cueFor('PAY-12'));
  });

  it('postgame: outside phase postgame PAY-12 never plays, and inside it no other line does', () => {
    const s = createWorldScheduler();
    expect(s.tick(makeCtx({ ...QUIET, era: 5, phase: 'none', postgameMs: 900_000, onScreen: only('payphone') }))).toBeNull();
    // DOG-11 (era V idle) is not a post line, so the postgame phase refuses it.
    expect(s.tick(makeCtx({ ...QUIET, era: 5, phase: 'postgame', postgameMs: 900_000, onScreen: only('dog') }))).toBeNull();
  });

  it('postgame: PAY-12 is once per cycle through seen, and cycle 2 replays it (core)', () => {
    const post = (over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx =>
      makeCtx({ ...QUIET, era: 5, phase: 'postgame', postgameMs: 600_000, onScreen: only('payphone'), ...over });
    const s = createWorldScheduler();
    expect(s.tick(post())).toEqual(cueFor('PAY-12'));
    const world = seenWorld(s.shown('PAY-12', 1, post()));
    expect(s.tick(post({ postgameMs: 700_000, world }))).toBeNull();
    const cycle2 = post({ nowMs: T0 + 400_000, postgameMs: 800_000, cycle: 2, world: freshWorld({ seenEver: world.seenEver }) });
    expect(s.tick(cycle2)).toEqual(cueFor('PAY-12'));
  });
});

describe('WP23b: buy level gate (Z4)', () => {
  it('INS-12 (buy horizonField, minLevel 5): a purchase at level 4 does not queue it; at level 5 it queues and plays', () => {
    const at = (level: number): WorldSchedulerCtx => makeCtx({ era: 5, levels: zeroLevels({ horizonField: level }) });
    const low = createWorldScheduler();
    low.offer({ kind: 'buy', techId: 'horizonField' }, at(4));
    expect(low.state().pending).toEqual([]);
    const high = createWorldScheduler();
    high.offer({ kind: 'buy', techId: 'horizonField' }, at(5));
    expect(high.state().pending.map((p) => p.id)).toEqual(['INS-12']);
    expect(high.tick(at(5))).toEqual(cueFor('INS-12'));
  });

  it('a buy line with level 2 fires only at exactly level 2 (the equality half of the gate)', () => {
    const line: WorldLine = {
      id: 'T-LVL', speaker: 'inspector', eras: [1], trigger: { kind: 'buy', techId: 'pistonArray', level: 2 }, tones: [], text: 'Test.', core: true,
    };
    const queued = (level: number): string[] => {
      const s = createWorldScheduler(CFG, [line]);
      s.offer({ kind: 'buy', techId: 'pistonArray' }, makeCtx({ levels: zeroLevels({ pistonArray: level }) }));
      return s.state().pending.map((p) => p.id);
    };
    expect(queued(1)).toEqual([]);
    expect(queued(2)).toEqual(['T-LVL']);
    expect(queued(3)).toEqual([]);
  });
});

describe('WP23b: chains as unison groups', () => {
  it('SYNCHRONIZATION holds for the unison edge, then DOG-09 and CRW-06 start on one tick', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    expect(s.state().pending.map((p) => [p.id, p.kind])).toEqual([['DOG-09', 'chain']]);
    expect(s.tick(syncCtx(0))).toBeNull();
    expect(s.tick(syncCtx(5_000))).toBeNull();
    expect(s.tick(syncCtx(6_000, { unisonEdge: true }))).toEqual(syncStep(['DOG-09', 'CRW-06'], 1));
  });

  it('SYNCHRONIZATION plays on the cap (unisonCapMs, 12 s from the queue) without an edge', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    expect(s.tick(syncCtx(CFG.unisonCapMs - 1))).toBeNull();
    expect(s.tick(syncCtx(CFG.unisonCapMs))).toEqual(syncStep(['DOG-09', 'CRW-06'], 1));
  });

  it('unisonCapMs is configurable: a short cap plays the start earlier', () => {
    const s = createWorldScheduler({ ...CFG, unisonCapMs: 5_000 });
    s.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    expect(s.tick(syncCtx(4_999))).toBeNull();
    expect(s.tick(syncCtx(5_000))).toEqual(syncStep(['DOG-09', 'CRW-06'], 1));
  });

  it('a partner off screen: only the eligible member is in the cue', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    expect(s.tick(syncCtx(0, { unisonEdge: true, onScreen: only('dog') }))).toEqual(syncStep(['DOG-09'], 1));
  });

  it('the pair is one step: PAY-09 is step 2, and both members count separately in shown', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    s.tick(syncCtx(0, { unisonEdge: true }));
    expect(s.state().chain).toEqual({ chainId: 'synchronization', step: 1 });
    let world = seenWorld(s.shown('DOG-09', 1, syncCtx(0)));
    world = seenWorld(s.shown('CRW-06', 1, syncCtx(0, { world })));
    expect(world.seen).toEqual(['DOG-09', 'CRW-06']);
    expect(s.tick(syncCtx(1_200, { world, bubblesVisible: 1, bubbleVisibleMs: 1_200 }))).toEqual(syncStep(['PAY-09'], 2));
    expect(s.state().chain).toBeNull();
  });

  it('a unison pair with one member counted: the run holds until both reported, then goes on at PAY-09; the cut member stays unseen', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    s.tick(syncCtx(0, { unisonEdge: true }));
    const counted = seenWorld(s.shown('DOG-09', 1, syncCtx(1_000)));
    expect(s.tick(syncCtx(1_200, { world: counted }))).toBeNull();
    expect(s.shown('CRW-06', 0.3, syncCtx(1_200, { world: counted }))).toBeNull();
    expect(s.state().pending).toEqual([]);
    expect(s.tick(syncCtx(2_400, { world: counted }))).toEqual(syncStep(['PAY-09'], 2));
    expect(counted.seen).toEqual(['DOG-09']);
  });

  it('a unison pair with both members cut goes back to the queue as a chain start and waits for the edge again', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    expect(s.tick(syncCtx(0, { unisonEdge: true }))).toEqual(syncStep(['DOG-09', 'CRW-06'], 1));
    expect(s.shown('DOG-09', 0.3, syncCtx(1_000))).toBeNull();
    expect(s.state().pending).toEqual([]);
    expect(s.shown('CRW-06', 0.3, syncCtx(1_000))).toBeNull();
    expect(s.state().pending.map((p) => [p.id, p.kind])).toEqual([['DOG-09', 'chain']]);
    expect(s.state().chain).toBeNull();
    // Two minutes on: the minimum gap since the first start has passed, and the edge releases the requeued start.
    expect(s.tick(syncCtx(2 * MIN, { unisonEdge: true }))).toEqual(syncStep(['DOG-09', 'CRW-06'], 1));
  });

  it('a chain start is refused while a chain runs, when its speaker is off screen, and when its first line is seen', () => {
    const running = createWorldScheduler();
    running.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0));
    running.tick(syncCtx(0, { unisonEdge: true }));
    running.offer({ kind: 'chain', chainId: 'oneObserver', step: 1 }, makeCtx({ era: 4, onScreen: only('inspector', 'girl') }));
    expect(running.state().pending).toEqual([]);

    const offScreen = createWorldScheduler();
    offScreen.offer({ kind: 'chain', chainId: 'synchronization', step: 1 }, syncCtx(0, { onScreen: only('crow') }));
    expect(offScreen.state().pending).toEqual([]);

    const seen = createWorldScheduler();
    const seenCtx = makeCtx({ era: 4, onScreen: only('inspector', 'girl'), world: freshWorld({ seen: ['INS-10'] }) });
    seen.offer({ kind: 'chain', chainId: 'oneObserver', step: 1 }, seenCtx);
    expect(seen.state().pending).toEqual([]);
  });

  it('ONE OBSERVER plays INS-10 then GRL-09, one step per 1.2 s of bubble', () => {
    const at = (ms: number, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx =>
      makeCtx({ era: 4, nowMs: T0 + ms, onScreen: only('inspector', 'girl'), ...over });
    const s = createWorldScheduler();
    s.offer({ kind: 'chain', chainId: 'oneObserver', step: 1 }, at(0));
    expect(s.tick(at(0))).toEqual({ kind: 'chainStep', ids: ['INS-10'], speakers: ['inspector'], chainId: 'oneObserver', step: 1 });
    const world = seenWorld(s.shown('INS-10', 1, at(0)));
    expect(s.tick(at(1_199, { world, bubblesVisible: 1, bubbleVisibleMs: 1_199 }))).toBeNull();
    expect(s.tick(at(1_200, { world, bubblesVisible: 1, bubbleVisibleMs: 1_200 })))
      .toEqual({ kind: 'chainStep', ids: ['GRL-09'], speakers: ['girl'], chainId: 'oneObserver', step: 2 });
    expect(s.state().chain).toBeNull();
  });
});

describe('WP23b: per-era repeat (DOG-02 plays in era I and again in era III)', () => {
  it('the era III play counts as DOG-02@3, so each listed era plays it once', () => {
    const dog = (era: number, over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx =>
      makeCtx({ ...QUIET, era, onScreen: only('dog'), ...over });
    const s = createWorldScheduler();
    expect(s.tick(dog(1))).toEqual(cueFor('DOG-02'));
    const era1 = seenWorld(s.shown('DOG-02', 1, dog(1)));
    expect(era1.seen).toEqual(['DOG-02']);
    expect(s.tick(dog(1, { nowMs: T0 + 400_000, world: era1 }))).toBeNull();
    expect(s.tick(dog(3, { nowMs: T0 + 400_000, world: era1 }))).toEqual(cueFor('DOG-02'));
    const era3 = seenWorld(s.shown('DOG-02', 1, dog(3, { nowMs: T0 + 400_000, world: era1 })));
    expect(era3.seen).toEqual(['DOG-02', 'DOG-02@3']);
    expect(s.tick(dog(3, { nowMs: T0 + 500_000, world: era3 }))).toBeNull();
  });
});

describe('WP23b: setting OFF, beats and force', () => {
  it('OFF refuses era entry, opener, tier, chain, buy and postgame offers; beat.sensorTurn is queued and plays', () => {
    const s = createWorldScheduler();
    const off = (over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx => makeCtx({ setting: 'off', era: 4, cycle: 2, ...over });
    s.offer({ kind: 'eraEntry', era: 4 }, off({ eraCardClosedAtMs: T0 }));
    s.offer({ kind: 'opener', fromCycle: 2 }, off({ era: 2 }));
    s.offer({ kind: 'tier', firstTop: true }, off());
    s.offer({ kind: 'chain', chainId: 'oneObserver', step: 1 }, off());
    s.offer({ kind: 'buy', techId: 'horizonField' }, off({ levels: zeroLevels({ horizonField: 5 }) }));
    s.offer({ kind: 'postgame', minS: 600 }, off({ phase: 'postgame' }));
    expect(s.state().pending).toEqual([]);
    expect(s.tick(off({ phase: 'postgame', postgameMs: 600_000 }))).toBeNull();
    s.offer({ kind: 'beat', beat: 'beat.sensorTurn' }, off());
    expect(s.state().pending.map((p) => p.id)).toEqual(['beat.sensorTurn']);
    expect(s.tick(off())).toEqual({ kind: 'beat', ids: ['beat.sensorTurn'], speakers: [] });
  });

  it('beat.sensorTurn plays once per cycle through seen', () => {
    const s = createWorldScheduler();
    s.offer({ kind: 'beat', beat: 'beat.sensorTurn' }, makeCtx({ era: 5 }));
    expect(s.tick(makeCtx({ era: 5 }))).toEqual({ kind: 'beat', ids: ['beat.sensorTurn'], speakers: [] });
    const world = seenWorld(s.shown('beat.sensorTurn', 1, makeCtx({ era: 5 })));
    expect(world.seen).toEqual(['beat.sensorTurn']);
    s.offer({ kind: 'beat', beat: 'beat.sensorTurn' }, makeCtx({ era: 5, world }));
    expect(s.state().pending).toEqual([]);
  });

  it('force: a cut eraEntry line is requeued with its own kind (kindOfLine is the trigger kind)', () => {
    const s = createWorldScheduler();
    expect(s.force('PAY-06', makeCtx({ era: 3 }))).toEqual(cueFor('PAY-06'));
    expect(s.shown('PAY-06', 0.3, makeCtx({ era: 3 }))).toBeNull();
    expect(s.state().pending.map((p) => [p.id, p.kind, p.offerEra])).toEqual([['PAY-06', 'eraEntry', 3]]);
  });
});

describe('table-scan guard: a closed moment window skips the idle table (no on-screen test)', () => {
  // Counts the on-screen tests: the table scan reaches onScreen only through lineEligible.
  function counting(...speakers: string[]): { onScreen: (speaker: string) => boolean; calls: () => number } {
    let n = 0;
    return { onScreen: (speaker) => { n += 1; return speakers.includes(speaker); }, calls: () => n };
  }

  it('with the window closed (play time under 90 s, or a toast up) the tick asks no speaker and returns null', () => {
    const early = counting('crow');
    const s = createWorldScheduler();
    expect(s.tick(makeCtx({ ...QUIET, playMs: 1_000, onScreen: early.onScreen, logsSeen: new Set(['observer-count']) }))).toBeNull();
    expect(early.calls()).toBe(0);
    const toast = counting('crow');
    expect(s.tick(makeCtx({ ...QUIET, toastUp: true, onScreen: toast.onScreen, logsSeen: new Set(['observer-count']) }))).toBeNull();
    expect(toast.calls()).toBe(0);
  });

  it('with the window open the same idle line still plays: CRW-02 once observer-count is logged', () => {
    const open = counting('crow');
    const s = createWorldScheduler();
    expect(s.tick(makeCtx({ ...QUIET, onScreen: open.onScreen, logsSeen: new Set(['observer-count']) }))).toEqual(cueFor('CRW-02'));
    expect(open.calls()).toBeGreaterThan(0);
  });
});
