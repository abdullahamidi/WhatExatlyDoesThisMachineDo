// Tests for the world-voice scheduler rules (WP23a): every rule R1-R12 as a table, boundary values, the cycle 2+ policy,
// the INS-04 / GRL-02 / GRL-04 cases, a permissive pass over the real line bank, and no input mutation.
import { describe, it, expect } from 'vitest';
import {
  countedSeen, hourCapOf, idleReady, lineEligible, momentGate, newMomentLog, noteMomentStart,
  priorityOf, triggerGate, ttlOf,
} from './worldVoiceRules';
import type { OfferKind, WorldMomentLog, WorldRuleConfig, WorldSchedulerCtx } from './worldVoiceRules';
import { WORLD_LINES, WORLD_VOICE_CONFIG } from '../../data/livingWorld';
import type { WorldLine, WorldSaveState } from '../../data/livingWorld';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';

const CFG = WORLD_VOICE_CONFIG;
const T0 = 10_000_000; // scheduler clock base, far from zero so "since" gaps never underflow

const KINDS: readonly OfferKind[] = ['logReply', 'buy', 'ms', 'tier', 'rapid', 'offline', 'demoNear', 'idle', 'chain', 'beat', 'postCap'];

function line(id: string): WorldLine {
  const found = WORLD_LINES.find((l) => l.id === id);
  if (found === undefined) throw new Error(`no line ${id}`);
  return found;
}

function synth(over: Partial<WorldLine> = {}): WorldLine {
  return { id: 'T-01', speaker: 'dog', eras: [1], trigger: { kind: 'idle' }, tones: ['funny'], text: 'Test line.', ...over };
}

function freshWorld(over: Partial<WorldSaveState> = {}): WorldSaveState {
  return { seen: [], seenEver: [], eraMoments: [0, 0, 0, 0, 0], youEras: 0, ...over };
}

function zeroLevels(): Record<TechId, number> {
  return Object.fromEntries(TECH_IDS.map((id) => [id, 0])) as Record<TechId, number>;
}

function makeCtx(over: Partial<WorldSchedulerCtx> = {}): WorldSchedulerCtx {
  return {
    nowMs: T0, playMs: 600_000, lastInputMs: T0 - 60_000, warmupUntilMs: 0, era: 1, cycle: 1,
    edition: 'full', setting: 'on', silence: null, hasClicked: true, hasPurchased: true,
    toastUp: false, toastClearedAtMs: null, indexClosedAtMs: null, bubblesVisible: 0, bubbleVisibleMs: 0,
    onScreen: () => true, world: freshWorld(), levels: zeroLevels(), logsSeen: new Set<string>(),
    lifetimeEe: 0, localHour: null,
    ...over,
  };
}

// Deep freeze: any mutation of an input throws in strict (ES module) code.
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('R1 setting', () => {
  it('OFF: nothing is eligible, core or not', () => {
    const ctx = makeCtx({ setting: 'off' });
    expect(lineEligible(line('INS-01'), 1, ctx, WORLD_LINES)).toBe(false);
    expect(lineEligible(line('INS-02'), 1, ctx, WORLD_LINES)).toBe(false);
  });

  it('RARE: core lines only', () => {
    const ctx = makeCtx({ setting: 'rare' });
    expect(lineEligible(line('INS-01'), 1, ctx, WORLD_LINES)).toBe(true);
    expect(lineEligible(line('INS-02'), 1, ctx, WORLD_LINES)).toBe(false);
  });

  it('ON: core and non-core both eligible', () => {
    const ctx = makeCtx({ setting: 'on' });
    expect(lineEligible(line('INS-01'), 1, ctx, WORLD_LINES)).toBe(true);
    expect(lineEligible(line('INS-02'), 1, ctx, WORLD_LINES)).toBe(true);
  });
});

describe('R2 edition', () => {
  it('a demo-only line is eligible only in the demo edition', () => {
    const dog12 = line('DOG-12');
    expect(dog12.demo).toBe(true);
    expect(lineEligible(dog12, 2, makeCtx({ era: 2, edition: 'full' }), WORLD_LINES)).toBe(false);
    expect(lineEligible(dog12, 2, makeCtx({ era: 2, edition: 'demo' }), WORLD_LINES)).toBe(true);
  });

  it('a postgame (post) line is never eligible in WP23a', () => {
    const post = synth({ id: 'PG-01', post: true });
    expect(lineEligible(post, 1, makeCtx({ edition: 'full' }), [post])).toBe(false);
    expect(lineEligible(post, 1, makeCtx({ edition: 'demo' }), [post])).toBe(false);
  });
});

describe('R3 era', () => {
  it('the offer era must be one the line lists', () => {
    expect(lineEligible(line('INS-01'), 2, makeCtx({ era: 2 }), WORLD_LINES)).toBe(false);
    expect(lineEligible(line('INS-01'), 1, makeCtx({ era: 1 }), WORLD_LINES)).toBe(true);
  });

  it('an era past the layer (offer 3, or ctx era 3) is never eligible', () => {
    const era3 = synth({ id: 'E3-01', eras: [3] });
    expect(lineEligible(era3, 3, makeCtx({ era: 3 }), [era3])).toBe(false);
    expect(lineEligible(line('INS-02'), 1, makeCtx({ era: 3 }), WORLD_LINES)).toBe(false);
  });

  it('a non-ms pending entry may not start after its offer era', () => {
    expect(lineEligible(line('INS-02'), 1, makeCtx({ era: 1 }), WORLD_LINES)).toBe(true);
    expect(lineEligible(line('INS-02'), 1, makeCtx({ era: 2 }), WORLD_LINES)).toBe(false);
  });

  it('INS-04 (ms, era I) stays pending through era II and is dropped in era III (eraLimit 2)', () => {
    const ins04 = line('INS-04');
    expect(lineEligible(ins04, 1, makeCtx({ era: 1 }), WORLD_LINES)).toBe(true);
    expect(lineEligible(ins04, 1, makeCtx({ era: 2 }), WORLD_LINES)).toBe(true);
    expect(lineEligible(ins04, 1, makeCtx({ era: 3 }), WORLD_LINES)).toBe(false);
    expect(ttlOf(ins04, 'ms', 1, T0, CFG).eraLimit).toBe(2);
  });

  it('INS-07 (ms, era II) has eraLimit 3 but no line starts in era III (layer gate)', () => {
    const ins07 = line('INS-07');
    expect(ttlOf(ins07, 'ms', 2, T0, CFG).eraLimit).toBe(3);
    expect(lineEligible(ins07, 2, makeCtx({ era: 2 }), WORLD_LINES)).toBe(true);
    expect(lineEligible(ins07, 2, makeCtx({ era: 3 }), WORLD_LINES)).toBe(false);
  });
});

describe('R4 repeat policy', () => {
  it('a line in world.seen is never eligible again this cycle', () => {
    const ctx = makeCtx({ world: freshWorld({ seen: ['INS-01'], seenEver: ['INS-01'] }) });
    expect(lineEligible(line('INS-01'), 1, ctx, WORLD_LINES)).toBe(false);
  });

  it('once and demo lines are blocked by seenEver', () => {
    const grl02 = line('GRL-02');
    expect(grl02.once).toBe(true);
    expect(lineEligible(grl02, 2, makeCtx({ era: 2, world: freshWorld({ seenEver: ['GRL-02'] }) }), WORLD_LINES)).toBe(false);
    expect(lineEligible(grl02, 2, makeCtx({ era: 2, world: freshWorld() }), WORLD_LINES)).toBe(true);
    const dog12 = line('DOG-12');
    expect(lineEligible(dog12, 2, makeCtx({ era: 2, edition: 'demo', world: freshWorld({ seenEver: ['DOG-12'] }) }), WORLD_LINES)).toBe(false);
  });

  it('a plain line (no once, no demo) may repeat across cycles only while it is not in seenEver at cycle 2+', () => {
    const ins02 = line('INS-02');
    const heard = freshWorld({ seenEver: ['INS-02'] });
    expect(lineEligible(ins02, 1, makeCtx({ world: heard, cycle: 1 }), WORLD_LINES)).toBe(true);
    expect(lineEligible(ins02, 1, makeCtx({ world: heard, cycle: 2 }), WORLD_LINES)).toBe(false);
  });

  it('a core line replays at cycle 2 even when it is in seenEver', () => {
    const ins01 = line('INS-01');
    expect(lineEligible(ins01, 1, makeCtx({ cycle: 2, world: freshWorld({ seenEver: ['INS-01'] }) }), WORLD_LINES)).toBe(true);
  });

  it('cyc lines need cycle 2 and a base line is ineligible at cycle 2 when another line replaces it', () => {
    const base = synth({ id: 'X-01', core: true, eras: [1] });
    const variant = synth({ id: 'X-01c', core: true, eras: [1], cyc: true, replaces: 'X-01' });
    const bank = [base, variant];
    expect(lineEligible(base, 1, makeCtx({ cycle: 1 }), bank)).toBe(true);
    expect(lineEligible(variant, 1, makeCtx({ cycle: 1 }), bank)).toBe(false);
    expect(lineEligible(base, 1, makeCtx({ cycle: 2 }), bank)).toBe(false);
    expect(lineEligible(variant, 1, makeCtx({ cycle: 2 }), bank)).toBe(true);
  });

  it('a cycle 2 non-core base line with no replacement stays eligible when unseen', () => {
    const plain = synth({ id: 'P-01', eras: [1] });
    expect(lineEligible(plain, 1, makeCtx({ cycle: 2 }), [plain])).toBe(true);
  });
});

describe('R5 you slot', () => {
  it('a non-core you line is blocked once its era bit is set', () => {
    const grl04 = line('GRL-04');
    expect(grl04.you).toBe(true);
    expect(lineEligible(grl04, 2, makeCtx({ era: 2, world: freshWorld({ youEras: 2 }) }), WORLD_LINES)).toBe(false);
    expect(lineEligible(grl04, 2, makeCtx({ era: 2, world: freshWorld({ youEras: 1 }) }), WORLD_LINES)).toBe(true);
  });

  it('a core you line owns its slot and is not blocked by it', () => {
    const grl01 = line('GRL-01');
    expect(grl01.core).toBe(true);
    expect(lineEligible(grl01, 1, makeCtx({ world: freshWorld({ youEras: 1 }) }), WORLD_LINES)).toBe(true);
  });

  it('GRL-02 and GRL-04 share the era II slot: whichever starts first blocks the other', () => {
    const grl02 = line('GRL-02');
    const grl04 = line('GRL-04');
    const ctx = makeCtx({ era: 2 });
    expect(lineEligible(grl02, 2, ctx, WORLD_LINES)).toBe(true);
    expect(lineEligible(grl04, 2, ctx, WORLD_LINES)).toBe(true);
    const afterGrl04 = countedSeen(grl04, 2, ctx);
    expect(afterGrl04.youEras).toBe(2);
    expect(lineEligible(grl02, 2, makeCtx({ era: 2, world: afterGrl04 }), WORLD_LINES)).toBe(false);
    const afterGrl02 = countedSeen(grl02, 2, ctx);
    expect(afterGrl02.youEras).toBe(2);
    expect(lineEligible(grl04, 2, makeCtx({ era: 2, world: afterGrl02 }), WORLD_LINES)).toBe(false);
  });
});

describe('R6 on screen', () => {
  it('the speaker must be on screen; the callback gets the line speaker', () => {
    const asked: string[] = [];
    const ctx = makeCtx({ onScreen: (s) => { asked.push(s); return false; } });
    expect(lineEligible(line('DOG-02'), 1, ctx, WORLD_LINES)).toBe(false);
    expect(asked).toEqual(['dog']);
    expect(lineEligible(line('DOG-02'), 1, makeCtx({ onScreen: (s) => s === 'dog' }), WORLD_LINES)).toBe(true);
  });
});

describe('R7 global moment gates', () => {
  const log = newMomentLog();

  it('a default context passes for a core and a non-core line', () => {
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx())).toBe(true);
    expect(momentGate(line('INS-02'), 'buy', log, makeCtx())).toBe(true);
  });

  it('any hard silence reason blocks, core too', () => {
    for (const reason of ['quiet', 'tech-index', 'era-card', 'photo']) {
      expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ silence: reason }))).toBe(false);
    }
  });

  it('first moment needs 90 s of play exactly, plus a click and a purchase', () => {
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ playMs: CFG.firstMomentAfterMs - 1 }))).toBe(false);
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ playMs: CFG.firstMomentAfterMs }))).toBe(true);
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ hasClicked: false }))).toBe(false);
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ hasPurchased: false }))).toBe(false);
  });

  it('offline skips the first-moment play time, but still needs a click and a purchase (DOG-07 plays 8 s after WELCOME BACK)', () => {
    expect(momentGate(line('DOG-07'), 'offline', log, makeCtx({ playMs: 0 }))).toBe(true);
    expect(momentGate(line('DOG-07'), 'offline', log, makeCtx({ playMs: 0, hasClicked: false }))).toBe(false);
    expect(momentGate(line('DOG-07'), 'offline', log, makeCtx({ playMs: 0, hasPurchased: false }))).toBe(false);
  });

  it('every kind except offline still waits for 90 s of play', () => {
    for (const kind of KINDS.filter((k) => k !== 'offline')) {
      expect(momentGate(line('INS-01'), kind, log, makeCtx({ playMs: CFG.firstMomentAfterMs - 1 })), kind).toBe(false);
      expect(momentGate(line('INS-01'), kind, log, makeCtx({ playMs: CFG.firstMomentAfterMs })), kind).toBe(true);
    }
  });

  it('warmup blocks every kind except offline, and the warmup end itself is allowed', () => {
    const ctx = makeCtx({ warmupUntilMs: T0 + 1 });
    expect(momentGate(line('INS-01'), 'logReply', log, ctx)).toBe(false);
    expect(momentGate(line('DOG-07'), 'offline', log, ctx)).toBe(true);
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ warmupUntilMs: T0 }))).toBe(true);
  });

  it('a visible bubble blocks a new start', () => {
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ bubblesVisible: 1 }))).toBe(false);
  });

  it('the minimum gap is 120 s exactly, one ms before blocks', () => {
    const last = noteMomentStart(log, line('INS-02'), 1, T0, CFG);
    expect(momentGate(line('INS-01'), 'buy', last, makeCtx({ nowMs: T0 + CFG.minGapMs - 1 }))).toBe(false);
    expect(momentGate(line('INS-01'), 'buy', last, makeCtx({ nowMs: T0 + CFG.minGapMs }))).toBe(true);
  });

  it('a log reply uses its own 45 s gap instead of minGapMs', () => {
    const last = noteMomentStart(log, line('INS-02'), 1, T0, CFG);
    expect(momentGate(line('INS-01'), 'logReply', last, makeCtx({ nowMs: T0 + CFG.logReplyGapMs - 1 }))).toBe(false);
    expect(momentGate(line('INS-01'), 'logReply', last, makeCtx({ nowMs: T0 + CFG.logReplyGapMs }))).toBe(true);
  });

  it('a POST-CAP moment uses postCapGapMs (overrides minGapMs)', () => {
    const cfg: WorldRuleConfig = { ...CFG, postCapGapMs: 300_000 };
    const last = noteMomentStart(log, line('INS-02'), 1, T0, cfg);
    expect(momentGate(line('INS-07'), 'postCap', last, makeCtx({ nowMs: T0 + 120_000 }), cfg)).toBe(false);
    expect(momentGate(line('INS-07'), 'postCap', last, makeCtx({ nowMs: T0 + 300_000 }), cfg)).toBe(true);
  });

  it('a null lastStartMs is always clear', () => {
    expect(momentGate(line('INS-01'), 'buy', newMomentLog(), makeCtx({ nowMs: T0 }))).toBe(true);
  });
});

describe('R8 non-core gates', () => {
  const log = newMomentLog();

  it('the era cap blocks non-core starts at the cap; core lines bypass it', () => {
    expect(momentGate(line('INS-02'), 'buy', log, makeCtx({ world: freshWorld({ eraMoments: [2, 0, 0, 0, 0] }) }))).toBe(true);
    expect(momentGate(line('INS-02'), 'buy', log, makeCtx({ world: freshWorld({ eraMoments: [3, 0, 0, 0, 0] }) }))).toBe(false);
    expect(momentGate(line('INS-01'), 'logReply', log, makeCtx({ world: freshWorld({ eraMoments: [3, 0, 0, 0, 0] }) }))).toBe(true);
  });

  it('the era II cap (2) counts era II moments only', () => {
    const ins03 = line('INS-03');
    expect(momentGate(ins03, 'logReply', log, makeCtx({ era: 2, world: freshWorld({ eraMoments: [0, 2, 0, 0, 0] }) }), CFG)).toBe(false);
    expect(momentGate(ins03, 'logReply', log, makeCtx({ era: 2, world: freshWorld({ eraMoments: [3, 1, 0, 0, 0] }) }), CFG)).toBe(true);
  });

  it('the offer era, not the current era, indexes the cap when given', () => {
    const ins03 = line('INS-03');
    const ctx = makeCtx({ era: 2, world: freshWorld({ eraMoments: [3, 0, 0, 0, 0] }) });
    expect(momentGate(ins03, 'buy', log, ctx, CFG, 1)).toBe(false);
    expect(momentGate(ins03, 'buy', log, ctx, CFG, 2)).toBe(true);
  });

  it('the rolling hour cap is 8 at cycle 1 and 4 from cycle 2', () => {
    const fresh = freshWorld();
    const starts = (n: number): WorldMomentLog => ({ ...newMomentLog(), hourStarts: Array.from({ length: n }, (_, i) => T0 - 1000 * (i + 1)) });
    expect(hourCapOf(makeCtx({ cycle: 1 }), CFG)).toBe(8);
    expect(hourCapOf(makeCtx({ cycle: 2 }), CFG)).toBe(4);
    expect(hourCapOf(makeCtx({ cycle: 3 }), CFG)).toBe(4);
    expect(momentGate(line('INS-02'), 'buy', starts(7), makeCtx({ world: fresh }))).toBe(true);
    expect(momentGate(line('INS-02'), 'buy', starts(8), makeCtx({ world: fresh }))).toBe(false);
    expect(momentGate(line('INS-02'), 'buy', starts(3), makeCtx({ cycle: 2, world: fresh }))).toBe(true);
    expect(momentGate(line('INS-02'), 'buy', starts(4), makeCtx({ cycle: 2, world: fresh }))).toBe(false);
  });

  it('a start exactly one hour old is out of the window; one ms younger is in it', () => {
    const full = (age: number): WorldMomentLog => ({ ...newMomentLog(), hourStarts: Array.from({ length: 8 }, () => T0 - age) });
    expect(momentGate(line('INS-02'), 'buy', full(CFG.hourWindowMs), makeCtx())).toBe(true);
    expect(momentGate(line('INS-02'), 'buy', full(CFG.hourWindowMs - 1), makeCtx())).toBe(false);
  });

  it('core starts are not counted against the hour cap', () => {
    const full: WorldMomentLog = { ...newMomentLog(), hourStarts: Array.from({ length: 8 }, (_, i) => T0 - 1000 * (i + 1)) };
    expect(momentGate(line('INS-01'), 'logReply', full, makeCtx())).toBe(true);
  });

  it('the same-era gap is 360 s between non-core moments of one era', () => {
    const last: WorldMomentLog = { ...newMomentLog(), lastStartMs: T0 - 500_000, lastNonCore: { era: 1, atMs: T0 - 359_999 } };
    expect(momentGate(line('INS-02'), 'buy', last, makeCtx())).toBe(false);
    const exact: WorldMomentLog = { ...last, lastNonCore: { era: 1, atMs: T0 - 360_000 } };
    expect(momentGate(line('INS-02'), 'buy', exact, makeCtx())).toBe(true);
  });

  it('the same-era gap does not apply across eras', () => {
    const last: WorldMomentLog = { ...newMomentLog(), lastStartMs: T0 - 500_000, lastNonCore: { era: 2, atMs: T0 - 1 } };
    expect(momentGate(line('INS-02'), 'buy', last, makeCtx({ era: 1 }))).toBe(true);
  });

  it('the per-denizen gap is 300 s exactly for the same speaker, and is per speaker', () => {
    const dogLast = (atMs: number): WorldMomentLog => ({ ...newMomentLog(), lastStartMs: T0 - 500_000, bySpeaker: { dog: atMs } });
    expect(momentGate(line('DOG-02'), 'idle', dogLast(T0 - 299_999), makeCtx())).toBe(false);
    expect(momentGate(line('DOG-02'), 'idle', dogLast(T0 - 300_000), makeCtx())).toBe(true);
    expect(momentGate(line('INS-02'), 'buy', dogLast(T0 - 1), makeCtx())).toBe(true);
  });

  it('the per-denizen gap does not block core lines (non-core gates only)', () => {
    const last: WorldMomentLog = { ...newMomentLog(), lastStartMs: T0 - 500_000, bySpeaker: { inspector: T0 - 1 } };
    expect(momentGate(line('INS-01'), 'logReply', last, makeCtx())).toBe(true);
  });
});

describe('R9 trigger gates', () => {
  it('any kind waits while a toast is up', () => {
    for (const kind of KINDS) {
      expect(triggerGate(kind, true, makeCtx({ toastUp: true }), CFG), kind).toBe(false);
      expect(triggerGate(kind, false, makeCtx({ toastUp: true }), CFG), kind).toBe(false);
    }
  });

  it('logReply waits 1 s after the toast clears (inclusive at 1 s)', () => {
    expect(triggerGate('logReply', false, makeCtx({ toastClearedAtMs: null }), CFG)).toBe(true);
    expect(triggerGate('logReply', false, makeCtx({ toastClearedAtMs: T0 - 999 }), CFG)).toBe(false);
    expect(triggerGate('logReply', false, makeCtx({ toastClearedAtMs: T0 - 1000 }), CFG)).toBe(true);
  });

  it('buy, ms and tier wait 2.5 s after the TECH INDEX closes (inclusive at 2.5 s)', () => {
    for (const kind of ['buy', 'ms', 'tier'] as const) {
      expect(triggerGate(kind, false, makeCtx({ indexClosedAtMs: null }), CFG), kind).toBe(true);
      expect(triggerGate(kind, false, makeCtx({ indexClosedAtMs: T0 - 2499 }), CFG), kind).toBe(false);
      expect(triggerGate(kind, false, makeCtx({ indexClosedAtMs: T0 - 2500 }), CFG), kind).toBe(true);
    }
  });

  it('rapid, offline, demoNear, beat, chain and postCap ignore the index and log clocks', () => {
    const busy = makeCtx({ indexClosedAtMs: T0, toastClearedAtMs: T0 });
    for (const kind of ['rapid', 'offline', 'demoNear', 'beat', 'chain', 'postCap'] as const) {
      expect(triggerGate(kind, false, busy, CFG), kind).toBe(true);
    }
  });

  it('idle waits 30 s after a toast and for input silence (45 s non-core, 20 s core)', () => {
    expect(triggerGate('idle', false, makeCtx({ toastClearedAtMs: T0 - 29_999 }), CFG)).toBe(false);
    expect(triggerGate('idle', false, makeCtx({ toastClearedAtMs: T0 - 30_000 }), CFG)).toBe(true);
    expect(triggerGate('idle', false, makeCtx({ lastInputMs: T0 - 44_999 }), CFG)).toBe(false);
    expect(triggerGate('idle', false, makeCtx({ lastInputMs: T0 - 45_000 }), CFG)).toBe(true);
    expect(triggerGate('idle', true, makeCtx({ lastInputMs: T0 - 19_999 }), CFG)).toBe(false);
    expect(triggerGate('idle', true, makeCtx({ lastInputMs: T0 - 20_000 }), CFG)).toBe(true);
    expect(triggerGate('idle', false, makeCtx({ lastInputMs: T0 - 20_000 }), CFG)).toBe(false);
  });
});

describe('idleReady', () => {
  it('owned techs must all be at level 1 or more', () => {
    const dog05 = line('DOG-05'); // idle, owned powerLines
    expect(idleReady(dog05, makeCtx())).toBe(false);
    expect(idleReady(dog05, makeCtx({ levels: { ...zeroLevels(), powerLines: 1 } }))).toBe(true);
  });

  it('afterLog needs the log in logsSeen', () => {
    const crw02 = line('CRW-02'); // idle, afterLog observer-count
    expect(idleReady(crw02, makeCtx())).toBe(false);
    expect(idleReady(crw02, makeCtx({ logsSeen: new Set(['observer-count']) }))).toBe(true);
  });

  it('afterLine needs the line in world.seen, not merely seenEver', () => {
    const grl02 = line('GRL-02'); // afterLine GRL-01 (and localHour 0 to 4)
    expect(idleReady(grl02, makeCtx({ era: 2, localHour: 2 }))).toBe(false);
    expect(idleReady(grl02, makeCtx({ era: 2, localHour: 2, world: freshWorld({ seenEver: ['GRL-01'] }) }))).toBe(false);
    expect(idleReady(grl02, makeCtx({ era: 2, localHour: 2, world: freshWorld({ seen: ['GRL-01'] }) }))).toBe(true);
  });

  it('minPlayS is exact: 360 s for GRL-01', () => {
    const grl01 = line('GRL-01');
    expect(idleReady(grl01, makeCtx({ playMs: 359_999 }))).toBe(false);
    expect(idleReady(grl01, makeCtx({ playMs: 360_000 }))).toBe(true);
  });

  it('localHour is inclusive, and a null hour fails (GRL-02 reads 0 to 4)', () => {
    const grl02 = line('GRL-02');
    const base = { era: 2, world: freshWorld({ seen: ['GRL-01'] }) };
    expect(idleReady(grl02, makeCtx({ ...base, localHour: null }))).toBe(false);
    expect(idleReady(grl02, makeCtx({ ...base, localHour: 0 }))).toBe(true);
    expect(idleReady(grl02, makeCtx({ ...base, localHour: 4 }))).toBe(true);
    expect(idleReady(grl02, makeCtx({ ...base, localHour: 5 }))).toBe(false);
  });

  it('demoNear needs lifetime EE at the threshold, exactly', () => {
    const grl05 = line('GRL-05');
    expect(grl05.trigger).toEqual({ kind: 'demoNear', lifetimeEe: 3_000_000 });
    expect(idleReady(grl05, makeCtx({ lifetimeEe: 2_999_999 }))).toBe(false);
    expect(idleReady(grl05, makeCtx({ lifetimeEe: 3_000_000 }))).toBe(true);
  });

  it('any other trigger is always ready', () => {
    expect(idleReady(line('INS-01'), makeCtx())).toBe(true);
    expect(idleReady(line('CRW-03'), makeCtx())).toBe(true);
  });

  it('every idle and demoNear line of the bank is ready when all its conditions hold', () => {
    const levels = Object.fromEntries(TECH_IDS.map((id) => [id, 1])) as Record<TechId, number>;
    const ready = makeCtx({
      playMs: 10_000_000, levels, localHour: 2, lifetimeEe: 10_000_000,
      logsSeen: new Set(['observer-count', 'chamber-seal', 'idle-cycle', 'unlabeled-part', 'copper-memory', 'load-beneath']),
      world: freshWorld({ seen: WORLD_LINES.map((l) => l.id) }),
    });
    for (const l of WORLD_LINES) {
      if (l.trigger.kind === 'idle' || l.trigger.kind === 'demoNear') {
        expect(idleReady(l, ready), l.id).toBe(true);
      }
    }
  });
});

describe('R10 TTL and era limit', () => {
  const now = T0;

  it('non-core log reply: 40 s; core log reply: 150 s', () => {
    expect(ttlOf(line('INS-02'), 'logReply', 1, now, CFG).expiresAtMs).toBe(now + 40_000);
    expect(ttlOf(line('INS-01'), 'logReply', 1, now, CFG).expiresAtMs).toBe(now + 150_000);
  });

  it('other non-core reactive lines: 90 s', () => {
    expect(ttlOf(line('CRW-03'), 'buy', 1, now, CFG).expiresAtMs).toBe(now + 90_000);
    expect(ttlOf(line('DOG-07'), 'offline', 1, now, CFG).expiresAtMs).toBe(now + 90_000);
  });

  it('other core lines have no TTL (pending until the era limit)', () => {
    expect(ttlOf(line('PAY-02'), 'buy', 2, now, CFG).expiresAtMs).toBeNull();
    expect(ttlOf(line('INS-04'), 'ms', 1, now, CFG).expiresAtMs).toBeNull();
    expect(ttlOf(line('GRL-01'), 'idle', 1, now, CFG).expiresAtMs).toBeNull();
  });

  it('eraLimit is the offer era, plus one for ms triggers', () => {
    expect(ttlOf(line('INS-02'), 'logReply', 1, now, CFG).eraLimit).toBe(1);
    expect(ttlOf(line('INS-04'), 'ms', 1, now, CFG).eraLimit).toBe(2);
    expect(ttlOf(line('INS-07'), 'ms', 2, now, CFG).eraLimit).toBe(3);
  });

  it('a TTL of 0 expires at once (boundary)', () => {
    const cfg: WorldRuleConfig = { ...CFG, reactiveTtlMs: 0 };
    expect(ttlOf(line('CRW-03'), 'buy', 1, now, cfg).expiresAtMs).toBe(now);
  });
});

describe('R11 priority', () => {
  it('chain and postCap are 0', () => {
    expect(priorityOf('chain', true)).toBe(0);
    expect(priorityOf('postCap', true)).toBe(0);
  });

  it('core reactive kinds are 1; non-core reactive kinds are 2', () => {
    for (const kind of ['logReply', 'buy', 'ms', 'demoNear', 'offline', 'beat'] as const) {
      expect(priorityOf(kind, true), `${kind} core`).toBe(1);
      expect(priorityOf(kind, false), `${kind} non-core`).toBe(2);
    }
    expect(priorityOf('rapid', false)).toBe(2);
    expect(priorityOf('rapid', true)).toBe(2);
  });

  it('tier is 3 and idle is 4, whatever core says', () => {
    expect(priorityOf('tier', false)).toBe(3);
    expect(priorityOf('tier', true)).toBe(3);
    expect(priorityOf('idle', false)).toBe(4);
    expect(priorityOf('idle', true)).toBe(4);
  });

  it('the order is chain < core reactive < non-core reactive < tier < idle', () => {
    expect(priorityOf('chain', true)).toBeLessThan(priorityOf('buy', true));
    expect(priorityOf('buy', true)).toBeLessThan(priorityOf('buy', false));
    expect(priorityOf('buy', false)).toBeLessThan(priorityOf('tier', false));
    expect(priorityOf('tier', false)).toBeLessThan(priorityOf('idle', false));
  });
});

describe('R12 seen accounting', () => {
  it('a non-core line adds its id to seen and seenEver, and one to its era count', () => {
    const next = countedSeen(line('INS-02'), 1, makeCtx());
    expect(next.seen).toEqual(['INS-02']);
    expect(next.seenEver).toEqual(['INS-02']);
    expect(next.eraMoments).toEqual([1, 0, 0, 0, 0]);
    expect(next.youEras).toBe(0);
  });

  it('a core line adds ids but does not touch the era count', () => {
    const next = countedSeen(line('INS-01'), 1, makeCtx());
    expect(next.seen).toEqual(['INS-01']);
    expect(next.eraMoments).toEqual([0, 0, 0, 0, 0]);
  });

  it('a non-core line in era II counts index 1', () => {
    const next = countedSeen(line('INS-03'), 2, makeCtx());
    expect(next.eraMoments).toEqual([0, 1, 0, 0, 0]);
  });

  it('counts accumulate and ids never duplicate', () => {
    const start = freshWorld({ seen: ['INS-02'], seenEver: ['INS-02'], eraMoments: [1, 0, 0, 0, 0] });
    const next = countedSeen(line('INS-02'), 1, makeCtx({ world: start }));
    expect(next.seen).toEqual(['INS-02']);
    expect(next.seenEver).toEqual(['INS-02']);
    expect(next.eraMoments).toEqual([2, 0, 0, 0, 0]);
  });

  it('a you line sets its era bit, core or not; other lines leave youEras alone', () => {
    expect(countedSeen(line('GRL-01'), 1, makeCtx()).youEras).toBe(1);
    expect(countedSeen(line('GRL-04'), 2, makeCtx()).youEras).toBe(2);
    expect(countedSeen(line('GRL-04'), 2, makeCtx({ world: freshWorld({ youEras: 1 }) })).youEras).toBe(3);
    expect(countedSeen(line('INS-02'), 1, makeCtx({ world: freshWorld({ youEras: 2 }) })).youEras).toBe(2);
  });

  it('returns a new block and leaves the input unchanged', () => {
    const start = deepFreeze(freshWorld({ seen: ['INS-01'], eraMoments: [1, 0, 0, 0, 0] }));
    const ctx = makeCtx({ world: start });
    const next = countedSeen(line('INS-02'), 1, ctx);
    expect(next).not.toBe(start);
    expect(start.seen).toEqual(['INS-01']);
    expect(start.eraMoments).toEqual([1, 0, 0, 0, 0]);
  });
});

describe('noteMomentStart', () => {
  it('a non-core start sets lastStartMs, lastNonCore, the speaker and the hour list', () => {
    const next = noteMomentStart(newMomentLog(), line('INS-02'), 1, T0, CFG);
    expect(next).toEqual({ lastStartMs: T0, lastNonCore: { era: 1, atMs: T0 }, bySpeaker: { inspector: T0 }, hourStarts: [T0] });
  });

  it('a core start keeps lastNonCore and the hour list, but still sets lastStartMs and the speaker', () => {
    const prior: WorldMomentLog = { ...newMomentLog(), lastNonCore: { era: 1, atMs: T0 - 5 }, hourStarts: [T0 - 5] };
    const next = noteMomentStart(prior, line('INS-01'), 1, T0, CFG);
    expect(next.lastStartMs).toBe(T0);
    expect(next.lastNonCore).toEqual({ era: 1, atMs: T0 - 5 });
    expect(next.hourStarts).toEqual([T0 - 5]);
    expect(next.bySpeaker).toEqual({ inspector: T0 });
  });

  it('prunes hour starts older than hourWindowMs; one exactly that old is pruned', () => {
    const prior: WorldMomentLog = {
      ...newMomentLog(),
      hourStarts: [T0 - CFG.hourWindowMs, T0 - CFG.hourWindowMs + 1, T0 - 1],
    };
    const next = noteMomentStart(prior, line('INS-02'), 1, T0, CFG);
    expect(next.hourStarts).toEqual([T0 - CFG.hourWindowMs + 1, T0 - 1, T0]);
  });

  it('leaves the speaker map of other denizens alone', () => {
    const prior: WorldMomentLog = { ...newMomentLog(), bySpeaker: { dog: T0 - 10 } };
    const next = noteMomentStart(prior, line('INS-02'), 1, T0, CFG);
    expect(next.bySpeaker).toEqual({ dog: T0 - 10, inspector: T0 });
  });

  it('returns a new object and leaves the input unchanged', () => {
    const prior = deepFreeze<WorldMomentLog>({ ...newMomentLog(), hourStarts: [T0 - 1], bySpeaker: { dog: T0 - 1 } });
    const next = noteMomentStart(prior, line('INS-02'), 1, T0, CFG);
    expect(next).not.toBe(prior);
    expect(prior.hourStarts).toEqual([T0 - 1]);
    expect(prior.lastStartMs).toBeNull();
  });

  it('a non-core moment blocks the next non-core in its era for 360 s, not the next era', () => {
    const log = noteMomentStart(newMomentLog(), line('INS-02'), 1, T0, CFG);
    const buy = line('INS-03');
    expect(momentGate(buy, 'buy', log, makeCtx({ nowMs: T0 + 359_999 }), CFG, 1)).toBe(false);
    expect(momentGate(buy, 'buy', log, makeCtx({ nowMs: T0 + 360_000 }), CFG, 1)).toBe(true);
    expect(momentGate(buy, 'buy', log, makeCtx({ nowMs: T0 + 360_000, era: 2 }), CFG, 2)).toBe(true);
  });
});

describe('cfg injection', () => {
  it('a shortened minGapMs lets a start through that the default blocks', () => {
    const log: WorldMomentLog = { ...newMomentLog(), lastStartMs: T0 - 10_000 };
    const ctx = makeCtx();
    expect(momentGate(line('INS-01'), 'buy', log, ctx)).toBe(false);
    expect(momentGate(line('INS-01'), 'buy', log, ctx, { ...CFG, minGapMs: 5000 })).toBe(true);
  });
});

describe('WORLD_LINES in a permissive context', () => {
  it('every line is eligible at each of its eras in the demo edition', () => {
    for (const l of WORLD_LINES) {
      for (const era of l.eras) {
        expect(lineEligible(l, era, makeCtx({ era, edition: 'demo' }), WORLD_LINES), `${l.id} era ${era}`).toBe(true);
      }
    }
  });

  it('in the full edition only the demo-only lines are refused', () => {
    for (const l of WORLD_LINES) {
      for (const era of l.eras) {
        const ok = lineEligible(l, era, makeCtx({ era, edition: 'full' }), WORLD_LINES);
        expect(ok, `${l.id} era ${era}`).toBe(l.demo !== true);
      }
    }
  });
});

describe('inputs are never mutated', () => {
  it('lineEligible, momentGate and triggerGate read a frozen context and log', () => {
    const ctx = deepFreeze(makeCtx({ world: freshWorld({ seen: ['INS-01'], eraMoments: [1, 0, 0, 0, 0] }) }));
    const log = deepFreeze(noteMomentStart(newMomentLog(), line('INS-02'), 1, T0 - 500_000, CFG));
    expect(() => lineEligible(line('INS-02'), 1, ctx, WORLD_LINES)).not.toThrow();
    expect(() => momentGate(line('INS-03'), 'buy', log, ctx, CFG, 1)).not.toThrow();
    expect(() => triggerGate('idle', false, ctx, CFG)).not.toThrow();
    expect(() => idleReady(line('GRL-02'), ctx)).not.toThrow();
    expect(() => ttlOf(line('INS-02'), 'logReply', 1, T0, CFG)).not.toThrow();
  });
});
