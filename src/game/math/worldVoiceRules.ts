// World-voice scheduler rules (WP23a, WP23b eras III-V): pure eligibility, gates, TTL, priority and seen accounting for the
// living world.
// Why: the scheduler (worldVoice.ts) composes these functions; each rule is a table-tested function, so the cadence canon
// of STORY_BIBLE §7 is checked with a fake clock and no bubble, DOM or Phaser object.
// Pure: no Phaser, no DOM. Numbers come from WORLD_VOICE_CONFIG / WORLD_ERA_CAPS / LIVING_WORLD (src/data/livingWorld.ts);
// the config is injectable so tests can shorten one gap.
import type { EndingPhase, TechId } from '../../data/types';
import type { ChainId, SpeakerId, WorldLine, WorldSaveState } from '../../data/livingWorld';
import { LIVING_WORLD, WORLD_ERA_CAPS, WORLD_LINES, WORLD_VOICE_CONFIG, seenKeyOf } from '../../data/livingWorld';

/** What fired an offer. Line triggers map onto these; chain, postCap and beat are queued by the director. */
export type OfferKind = 'logReply' | 'buy' | 'ms' | 'tier' | 'rapid' | 'offline' | 'demoNear' | 'idle' | 'chain' | 'beat' | 'postCap'
  | 'eraEntry' | 'opener' | 'postgame';

/** Everything the rules read at one instant. Times are ms on one scheduler clock (nowMs, playMs, lastInputMs, timestamps). */
export interface WorldSchedulerCtx {
  nowMs: number;
  playMs: number;               // play time this session
  lastInputMs: number;          // last click or purchase
  warmupUntilMs: number;        // session warmup end (60 s after load / WELCOME BACK)
  era: number;                  // current era (may be past a pending entry's offer era)
  cycle: number;                // prestige cycle, 1-based
  edition: 'full' | 'demo';
  setting: 'on' | 'rare' | 'off';
  silence: string | null;       // first hard-silence reason (WORLD_SILENCE), null when none
  hasClicked: boolean;
  hasPurchased: boolean;
  toastUp: boolean;             // unlock or milestone toast on screen
  toastClearedAtMs: number | null;
  indexClosedAtMs: number | null;
  bubblesVisible: number;
  bubbleVisibleMs: number;      // read by the scheduler for the 60 % seen rule; not used by these rules
  // True while the director has started a CROSSED LINES member whose bubble is not up yet (prelude or placement wait).
  // Absent = false. Optional so callers that do not set it keep compiling; the scheduler holds the run while it is true.
  chainMemberWaiting?: boolean;
  // WP23b (optional; absent = the WP23a meaning). phase: the ending phase (post lines only in postgame). postgameMs: postgame
  // play time (PAY-12 waits 10 min). eraAgeMs: session time in the current era (PAY-07 waits 15 min; absent = 0).
  // eraCardClosedAtMs: when the era card closed (eraEntry lines wait eraEntryAfterCardMs; null or absent = no card yet).
  // unisonEdge: the pulse is on its unison edge (the SYNCHRONIZATION start waits for it, read by the scheduler).
  phase?: EndingPhase;
  postgameMs?: number;
  eraAgeMs?: number;
  eraCardClosedAtMs?: number | null;
  unisonEdge?: boolean;
  onScreen(speaker: SpeakerId): boolean;
  world: Readonly<WorldSaveState>;
  levels: Readonly<Record<TechId, number>>;
  logsSeen: ReadonlySet<string>;
  lifetimeEe: number;
  localHour: number | null;     // read locally only (GRL-02); null when unknown
}

/** A queued moment for the director: one or more lines, one chain step, or one wordless beat. */
export interface WorldCue {
  kind: 'line' | 'chainStep' | 'beat';
  ids: readonly string[];
  speakers: readonly SpeakerId[];
  chainId?: ChainId;
  step?: number;
}

/** Session cadence bookkeeping (not saved). Every update returns a new object (noteMomentStart). */
export interface WorldMomentLog {
  lastStartMs: number | null;                              // any moment start
  lastNonCore: { era: number; atMs: number } | null;       // last non-core start, for the same-era gap
  bySpeaker: Partial<Record<SpeakerId, number>>;           // last start per denizen
  hourStarts: number[];                                    // non-core starts inside the rolling hour
}

/** The config keys these rules read. WORLD_VOICE_CONFIG satisfies it; tests may override one key. */
export type WorldRuleConfig = Readonly<Record<
  | 'firstMomentAfterMs' | 'minGapMs' | 'logReplyGapMs' | 'postCapGapMs' | 'nonCoreGapMs' | 'perDenizenGapMs'
  | 'toastQuietMs' | 'afterIndexCloseMs' | 'logReplyAfterClearMs' | 'idleInputMs' | 'idleInputCoreMs'
  | 'hourCap' | 'hourCapCycle2' | 'hourWindowMs' | 'reactiveTtlMs' | 'logReplyTtlMs' | 'coreLogReplyTtlMs' | 'eraEntryAfterCardMs',
  number>>;

export function newMomentLog(): WorldMomentLog {
  return { lastStartMs: null, lastNonCore: null, bySpeaker: {}, hourStarts: [] };
}

/** Non-core starts allowed per rolling hour: 8, or 4 from cycle 2 (RARE is handled by lineEligible: core only). */
export function hourCapOf(ctx: WorldSchedulerCtx, cfg: WorldRuleConfig = WORLD_VOICE_CONFIG): number {
  return ctx.cycle >= 2 ? cfg.hourCapCycle2 : cfg.hourCap;
}

// Non-core cap per era (bible §7.2, WP23b: eras I-V read WORLD_ERA_CAPS). Any other era allows none.
function nonCoreCapOf(era: number): number {
  return isEraIndex(era) ? WORLD_ERA_CAPS[era].nonCore : 0;
}

// Bit of the "you" slot for an era (youEras bit era-1, bible §7.8).
function slotBit(era: number): number {
  return 1 << (era - 1);
}

// Last era a pending entry may start in (R3): its offer era, plus one for ms triggers (INS-04 waits through era II).
function eraLimitOf(isMs: boolean, offerEra: number): number {
  return offerEra + (isMs ? 1 : 0);
}

// R4 repeat policy (bible §7.8) as one predicate, shared by lineEligible and lineSettledId: refused when the key is seen this
// cycle, when a once or demo line is in seenEver, and from cycle 2 when a non-core line is in seenEver (core lines replay).
function repeatRefused(line: WorldLine, key: string, world: Readonly<WorldSaveState>, cycle: number): boolean {
  if (world.seen.includes(key)) return true;
  if ((line.once === true || line.demo === true) && world.seenEver.includes(key)) return true;
  return cycle >= 2 && line.core !== true && world.seenEver.includes(key);
}

/**
 * R1-R6: may this line be offered or start now? Pure state checks only (no clock gates; see momentGate and triggerGate).
 * `offerEra` is the era its trigger fired in; `lines` is the full bank (cycle 2+ replacement lookup).
 */
export function lineEligible(line: WorldLine, offerEra: number, ctx: WorldSchedulerCtx, lines: readonly WorldLine[]): boolean {
  // R1 setting: OFF never; RARE core lines only.
  if (ctx.setting === 'off') return false;
  if (ctx.setting === 'rare' && line.core !== true) return false;
  // R2 edition: demo-only lines in the demo only. Scripted lines (INS-PG) are played by the director, never scheduled.
  if (line.demo === true && ctx.edition !== 'demo') return false;
  if (line.scripted === true) return false;
  // WP23b postgame: post lines only in phase postgame, and phase postgame plays only post lines.
  if ((line.post === true) !== (ctx.phase === 'postgame')) return false;
  // R3 era: listed for the offer era, inside the layer, and the current era within the entry's limit.
  if (offerEra < 1 || offerEra > LIVING_WORLD.maxEra || !line.eras.includes(offerEra)) return false;
  if (ctx.era > LIVING_WORLD.maxEra || ctx.era > eraLimitOf(line.trigger.kind === 'ms', offerEra)) return false;
  // WP23b opener window (PAY-13 cycle 2, PAY-14 cycle 3+): the cycle must lie in [fromCycle, toCycle] when toCycle is set.
  const trigger = line.trigger;
  if (trigger.kind === 'opener' && (ctx.cycle < trigger.fromCycle || (trigger.toCycle !== undefined && ctx.cycle > trigger.toCycle))) {
    return false;
  }
  // R4 repeat policy (bible §7.8). A perEra line (DOG-02) is counted under its era key, so each listed era plays once.
  if (repeatRefused(line, seenKeyOf(line, offerEra), ctx.world, ctx.cycle)) return false;
  if (line.cyc === true && ctx.cycle < 2) return false;
  if (ctx.cycle >= 2 && lines.some((other) => other.replaces === line.id)) return false;
  // R5 you slot: one non-core "you" line per era; a core line owns its slot.
  if (line.you === true && line.core !== true && (ctx.world.youEras & slotBit(offerEra)) !== 0) return false;
  // R6 the speaker must be on screen.
  return ctx.onScreen(line.speaker);
}

/**
 * Z6: is this line settled for the rest of the cycle, so the scheduler will refuse it? True when repeatRefused holds for it
 * (seen this cycle, once / demo seen ever, cycle 2+ non-core seen ever) under its first era key. An unknown id is false.
 * The tier tracker asks through the director, so an INS-13 that is settled never blocks a DOG-04 that is still owed.
 */
export function lineSettledId(id: string, world: Readonly<WorldSaveState>, cycle: number): boolean {
  const line = WORLD_LINES.find((l) => l.id === id);
  if (line === undefined) return false;
  return repeatRefused(line, seenKeyOf(line, line.eras[0] ?? 1), world, cycle);
}

/**
 * R7 global gates (core too), read by momentGate and by the scheduler's table-scan guard (worldVoice.ts pickTick): silence,
 * first-moment play time (not for offline), a click and a purchase, warmup (not for offline), no bubble on screen, and the
 * start gap (logReplyGapMs / postCapGapMs / minGapMs against the last moment start). Offline skips the first-moment play time:
 * DOG-07 is offered on the return from an absence (8 s after WELCOME BACK, bible 7.1), so it would wait 90 s of the new session
 * and could expire first. Click and purchase still apply.
 */
export function momentWindowOpen(
  kind: OfferKind,
  log: WorldMomentLog,
  ctx: WorldSchedulerCtx,
  cfg: WorldRuleConfig = WORLD_VOICE_CONFIG,
): boolean {
  if (ctx.silence !== null) return false;
  if ((kind !== 'offline' && ctx.playMs < cfg.firstMomentAfterMs) || !ctx.hasClicked || !ctx.hasPurchased) return false;
  if (kind !== 'offline' && ctx.nowMs < ctx.warmupUntilMs) return false;
  if (ctx.bubblesVisible !== 0) return false;
  const gap = kind === 'logReply' ? cfg.logReplyGapMs : kind === 'postCap' ? cfg.postCapGapMs : cfg.minGapMs;
  if (log.lastStartMs !== null && ctx.nowMs - log.lastStartMs < gap) return false;
  return true;
}

/**
 * R7 + R8: may a moment start now? R7 is momentWindowOpen (global, core too). R8 (non-core only): era cap, rolling hour cap,
 * same-era gap, per-denizen gap. `offerEra` defaults to ctx.era.
 */
export function momentGate(
  line: WorldLine,
  kind: OfferKind,
  log: WorldMomentLog,
  ctx: WorldSchedulerCtx,
  cfg: WorldRuleConfig = WORLD_VOICE_CONFIG,
  offerEra: number = ctx.era,
): boolean {
  if (!momentWindowOpen(kind, log, ctx, cfg)) return false;
  // R8 non-core gates. Core lines never wait for a cap.
  if (line.core === true) return true;
  if ((ctx.world.eraMoments[offerEra - 1] ?? 0) >= nonCoreCapOf(offerEra)) return false;
  const startsInHour = log.hourStarts.filter((t) => ctx.nowMs - t < cfg.hourWindowMs).length;
  if (startsInHour >= hourCapOf(ctx, cfg)) return false;
  if (log.lastNonCore !== null && log.lastNonCore.era === offerEra && ctx.nowMs - log.lastNonCore.atMs < cfg.nonCoreGapMs) return false;
  const lastSpeaker = log.bySpeaker[line.speaker];
  if (lastSpeaker !== undefined && ctx.nowMs - lastSpeaker < cfg.perDenizenGapMs) return false;
  return true;
}

/**
 * R9: the trigger's own gate. Every kind waits while a toast is up. logReply waits for the toast to clear (+1 s);
 * buy / ms / tier wait for the TECH INDEX to close (+2.5 s); idle and postgame wait for quiet (30 s after a toast) and for
 * input silence (45 s, or 20 s for core). eraEntry waits eraEntryAfterCardMs after the era card closes (no card = never).
 * logReply, rapid, offline, demoNear, beat, chain, postCap and opener need only the toast gate (opener's cycle window is
 * in lineEligible).
 */
export function triggerGate(kind: OfferKind, core: boolean, ctx: WorldSchedulerCtx, cfg: WorldRuleConfig = WORLD_VOICE_CONFIG): boolean {
  if (ctx.toastUp) return false;
  const now = ctx.nowMs;
  if (kind === 'logReply') {
    return ctx.toastClearedAtMs === null || now >= ctx.toastClearedAtMs + cfg.logReplyAfterClearMs;
  }
  if (kind === 'buy' || kind === 'ms' || kind === 'tier') {
    return ctx.indexClosedAtMs === null || now >= ctx.indexClosedAtMs + cfg.afterIndexCloseMs;
  }
  if (kind === 'eraEntry') {
    const closedAtMs = ctx.eraCardClosedAtMs ?? null;
    return closedAtMs !== null && now >= closedAtMs + cfg.eraEntryAfterCardMs;
  }
  if (kind === 'idle' || kind === 'postgame') {
    const quiet = ctx.toastClearedAtMs === null || now >= ctx.toastClearedAtMs + cfg.toastQuietMs;
    const inputGap = core ? cfg.idleInputCoreMs : cfg.idleInputMs;
    return quiet && now - ctx.lastInputMs >= inputGap;
  }
  return true;
}

/**
 * Readiness of an idle, demoNear or postgame line beyond the gates: every owned tech level >= 1; afterLog seen; afterLine in
 * world.seen (this cycle); play time >= minPlayS; era age >= minEraS (absent = 0); local hour inside localHour (inclusive;
 * null hour fails); lifetime EE >= the demoNear threshold; postgame play time >= minS. Every other trigger is ready.
 */
export function idleReady(line: WorldLine, ctx: WorldSchedulerCtx): boolean {
  const trigger = line.trigger;
  if (trigger.kind === 'demoNear') return ctx.lifetimeEe >= trigger.lifetimeEe;
  if (trigger.kind === 'postgame') return (ctx.postgameMs ?? 0) >= trigger.minS * 1000;
  if (trigger.kind !== 'idle') return true;
  if (trigger.owned !== undefined && !trigger.owned.every((id) => (ctx.levels[id] ?? 0) >= 1)) return false;
  if (trigger.afterLog !== undefined && !ctx.logsSeen.has(trigger.afterLog)) return false;
  if (trigger.afterLine !== undefined && !ctx.world.seen.includes(trigger.afterLine)) return false;
  if (trigger.minPlayS !== undefined && ctx.playMs < trigger.minPlayS * 1000) return false;
  if (trigger.minEraS !== undefined && (ctx.eraAgeMs ?? 0) < trigger.minEraS * 1000) return false;
  if (trigger.localHour !== undefined) {
    const [from, to] = trigger.localHour;
    if (ctx.localHour === null || ctx.localHour < from || ctx.localHour > to) return false;
  }
  return true;
}

/**
 * R10: when a pending entry expires and its era limit. Non-core logReply: logReplyTtlMs; core logReply: coreLogReplyTtlMs;
 * other non-core: reactiveTtlMs; other core (eraEntry, opener, postgame included): null (pending until the era limit).
 * `expiresAtMs` is absolute (nowMs + ttl). eraLimit = offerEra, plus 1 for ms triggers (INS-04 stays pending through the
 * next era until delivered).
 */
export function ttlOf(
  line: WorldLine,
  kind: OfferKind,
  offerEra: number,
  nowMs: number,
  cfg: WorldRuleConfig = WORLD_VOICE_CONFIG,
): { expiresAtMs: number | null; eraLimit: number } {
  const eraLimit = eraLimitOf(kind === 'ms', offerEra);
  let ttl: number | null;
  if (kind === 'logReply') ttl = line.core === true ? cfg.coreLogReplyTtlMs : cfg.logReplyTtlMs;
  else ttl = line.core === true ? null : cfg.reactiveTtlMs;
  return { expiresAtMs: ttl === null ? null : nowMs + ttl, eraLimit };
}

/**
 * R11 queue priority, low first: chain and postCap 0; core reactive (logReply, buy, ms, demoNear, offline, beat, eraEntry,
 * opener) 1; non-core reactive 2 (rapid always 2); tier 3; idle and postgame 4.
 */
export function priorityOf(kind: OfferKind, core: boolean): number {
  if (kind === 'chain' || kind === 'postCap') return 0;
  if (kind === 'tier') return 3;
  if (kind === 'idle' || kind === 'postgame') return 4;
  if (kind === 'rapid') return 2;
  return core ? 1 : 2;
}

// True for the eras the seen counters index (eras I to V). The guard narrows, so WORLD_ERA_CAPS[era] type-checks.
function isEraIndex(era: number): era is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(era) && era >= 1 && era <= 5;
}

/**
 * R12 seen accounting: returns a NEW save block with the line's seen key (seenKeyOf: the id, or id@era for a perEra line of
 * a later era) in seen and seenEver (no duplicates); a non-core line adds one to eraMoments[offerEra - 1]; a you line sets
 * youEras bit (offerEra - 1). The input block is not touched.
 */
export function countedSeen(line: WorldLine, offerEra: number, ctx: WorldSchedulerCtx): WorldSaveState {
  const world = ctx.world;
  const key = seenKeyOf(line, offerEra);
  const seen = world.seen.includes(key) ? [...world.seen] : [...world.seen, key];
  const seenEver = world.seenEver.includes(key) ? [...world.seenEver] : [...world.seenEver, key];
  const eraMoments: [number, number, number, number, number] = [...world.eraMoments];
  let youEras = world.youEras;
  if (line.core !== true && isEraIndex(offerEra)) {
    eraMoments[offerEra - 1] = (eraMoments[offerEra - 1] ?? 0) + 1;
  }
  if (line.you === true && isEraIndex(offerEra)) {
    youEras |= slotBit(offerEra);
  }
  return { seen, seenEver, eraMoments, youEras };
}

/**
 * R12 moment start: returns a NEW log. lastStartMs = nowMs; bySpeaker[speaker] = nowMs; a non-core start sets
 * lastNonCore and pushes nowMs to hourStarts; hourStarts older than hourWindowMs are pruned on every call.
 */
export function noteMomentStart(
  log: WorldMomentLog,
  line: WorldLine,
  offerEra: number,
  nowMs: number,
  cfg: WorldRuleConfig = WORLD_VOICE_CONFIG,
): WorldMomentLog {
  const bySpeaker: Partial<Record<SpeakerId, number>> = { ...log.bySpeaker };
  bySpeaker[line.speaker] = nowMs;
  const hourStarts = log.hourStarts.filter((t) => nowMs - t < cfg.hourWindowMs);
  const core = line.core === true;
  if (!core) hourStarts.push(nowMs);
  return {
    lastStartMs: nowMs,
    lastNonCore: core ? (log.lastNonCore === null ? null : { ...log.lastNonCore }) : { era: offerEra, atMs: nowMs },
    bySpeaker,
    hourStarts,
  };
}
