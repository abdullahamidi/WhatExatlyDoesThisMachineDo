// World-voice scheduler (WP23a): the offer queue, the CROSSED LINES chain run, the POST-CAP arc and the one-moment pick,
// assembled from the pure rules in worldVoiceRules.ts.
// Why: the director needs one object that answers "what may play now" from a ctx alone. The cadence canon (STORY_BIBLE
// §6-§8) lives in the rule functions; this file only sequences them, so every gate is checked with a fake clock.
// A line the director could not place (shown(..., {blocked: true}), placeWait expired) is retried until placeBlockLimit
// blocks, then given up: it stays unseen and no arc or chain retries it forever.
// Pure: no Phaser, no DOM, no Date or Math.random. Time comes from ctx.nowMs only; numbers come from WORLD_VOICE_CONFIG.
import type { ChainId, SpeakerId, WorldLine, WorldOffer, WorldSaveState } from '../../data/livingWorld';
import { LIVING_WORLD, WORLD_CHAINS, WORLD_LINES, WORLD_UNISON, WORLD_VOICE_CONFIG } from '../../data/livingWorld';
import type { TechId } from '../../data/types';
import {
  countedSeen, idleReady, lineEligible, momentGate, momentWindowOpen, newMomentLog, noteMomentStart, priorityOf,
  triggerGate, ttlOf,
} from './worldVoiceRules';
import type { OfferKind, WorldCue, WorldMomentLog, WorldRuleConfig, WorldSchedulerCtx } from './worldVoiceRules';

/** Scheduler state for the debug hook and the director. state() returns copies. */
export interface WorldSchedulerState {
  pending: { id: string; kind: string; offerEra: number; priority: number; core: boolean; readyAtMs: number; expiresAtMs: number | null }[];
  chain: { chainId: ChainId; step: number } | null;
  postCap: { active: boolean; step: number; nextAtMs: number | null; done: boolean };
  lastMomentAtMs: number | null;
  hourMoments: number;
  bySpeaker: Partial<Record<SpeakerId, number>>;
}

/** Options for shown(). blocked: the line never got a bubble (its placeWait expired). A cut by silence does NOT set it. */
export interface WorldShownOpts { blocked?: boolean }

/** The public surface. Every call reads its clock and gates from ctx; nothing else is read from outside. */
export interface WorldScheduler {
  offer(offer: WorldOffer, ctx: WorldSchedulerCtx): void;
  tick(ctx: WorldSchedulerCtx): WorldCue | null;
  shown(id: string, fraction: number, ctx: WorldSchedulerCtx, opts?: WorldShownOpts): WorldSaveState | null;
  interrupt(reason: string, ctx: WorldSchedulerCtx): void;
  force(id: string, ctx: WorldSchedulerCtx): WorldCue | null;
  reset(): void;
  state(): WorldSchedulerState;
}

/**
 * Config keys the scheduler reads beyond the rule keys. WORLD_VOICE_CONFIG satisfies it; tests may override one key.
 * unisonCapMs is optional (absent = WORLD_VOICE_CONFIG.unisonCapMs): a SYNCHRONIZATION start waits this long for the unison edge.
 */
export type WorldSchedulerConfig = WorldRuleConfig & Readonly<Record<'chainStepAfterMs' | 'chainMaxBubbles' | 'seenFraction' | 'postCapFirstMs' | 'placeBlockLimit', number>>
  & Readonly<Partial<Record<'unisonCapMs', number>>>;

// Wordless POST-CAP beat (STORY_BIBLE §8.2 step 1): once per save, tracked in seenEver.
const TAPE_FREEZE = 'beat.tapeFreeze';

interface PendingEntry {
  id: string;                // line id, or beat id
  kind: OfferKind;
  offerEra: number;
  eraLimit: number;
  core: boolean;
  readyAtMs: number;
  expiresAtMs: number | null;
  seq: number;               // offer order: the oldest offer wins a priority tie
  chainId: ChainId | null;   // a chain start: starting it opens the chain run
}

// The members of one chain step as cued together. Each member reports once through shown(); the step decides when the last one has.
interface ChainGroup {
  ids: string[];             // the members cued on this tick (eligible ones only)
  open: number;              // members not yet reported
  counted: number;           // members counted seen
  gaveUp: boolean;           // a member was given up (blocked twice)
}

// A cue handed to the director and not yet shown(): counted, requeued or dropped when shown() reports the fraction.
interface InFlight {
  id: string;
  line: WorldLine | null;    // null for beats
  kind: OfferKind;
  offerEra: number;
  core: boolean;
  chainId: ChainId | null;   // the chain run a member belongs to
  chainStep: number;         // 1-based number of the member's step in that run; 0 when the line is not a chain member
  group?: ChainGroup;        // the step the member was cued in (chain members only)
}

// A chain run. step = steps consumed so far (1-based number of the last one; a unison pair is one step).
interface ChainRun {
  chainId: ChainId;
  step: number;
  offerEra: number;
}

// POST-CAP runtime. cursor = POST-CAP lines consumed (delivered or skipped), which is the state's postCap.step.
interface PostRun {
  started: boolean;          // activated by a KEEP TINKERING offer this session
  active: boolean;
  cursor: number;
  nextAtMs: number | null;   // due time of the next POST-CAP line; null until scheduled
  freezeIssued: boolean;
  done: boolean;
}

// One start candidate: a pending entry or a table-scan line (idle / demoNear).
interface Candidate {
  priority: number;
  source: 0 | 1;            // 0 pending queue, 1 table scan
  order: number;            // pending: offer seq; scan: table index
  id: string;
  line: WorldLine | null;   // null for beats
  kind: OfferKind;
  offerEra: number;
  core: boolean;
  chainId: ChainId | null;
  pendingSeq: number | null;
}

function freshPost(): PostRun {
  return { started: false, active: false, cursor: 0, nextAtMs: null, freezeIssued: false, done: false };
}

// A first-top tier line (INS-13): it fires on the first top tier of the cycle and takes the tier slot from a pending DOG-04 (WP23b).
function isFirstTop(line: WorldLine | undefined): boolean {
  return line !== undefined && line.trigger.kind === 'tier' && line.trigger.firstTop === true;
}

// The offer kind a line gates by: its trigger kind (eraEntry gates on the era card, WP23b).
function kindOfLine(line: WorldLine): OfferKind {
  return line.trigger.kind;
}

// Level gate of a buy line (INS-12 plays at horizonField 9): the bought level reaches minLevel (default 1) and equals level when set.
function levelGateOk(trig: { techId: TechId; minLevel?: number; level?: number }, ctx: WorldSchedulerCtx): boolean {
  const level = ctx.levels[trig.techId] ?? 0;
  return level >= (trig.minLevel ?? 1) && (trig.level === undefined || level === trig.level);
}

// Chain steps (WP23b): consecutive members that form a WORLD_UNISON pair are one step; every other member is one step.
function stepsOf(members: readonly string[], unison: readonly (readonly [string, string])[]): string[][] {
  const steps: string[][] = [];
  let i = 0;
  while (i < members.length) {
    const a = members[i];
    const b = members[i + 1];
    if (a === undefined) break;
    if (b !== undefined && unison.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
      steps.push([a, b]);
      i += 2;
    } else {
      steps.push([a]);
      i += 1;
    }
  }
  return steps;
}

// Lower priority number first, then table-scan after pending, then the oldest offer.
function better(a: Candidate | null, b: Candidate): Candidate {
  if (a === null) return b;
  if (b.priority !== a.priority) return b.priority < a.priority ? b : a;
  if (b.source !== a.source) return b.source < a.source ? b : a;
  return b.order < a.order ? b : a;
}

// A beat counts as seen at any fraction: seen and seenEver only (no era counter, no you slot).
function markBeatSeen(world: Readonly<WorldSaveState>, id: string): WorldSaveState {
  const eraMoments: [number, number, number, number, number] = [...world.eraMoments];
  return {
    seen: world.seen.includes(id) ? [...world.seen] : [...world.seen, id],
    seenEver: world.seenEver.includes(id) ? [...world.seenEver] : [...world.seenEver, id],
    eraMoments,
    youEras: world.youEras,
  };
}

/** Builds one scheduler. Lines and chains are injectable so tests can use a small bank; production uses the data tables. */
export function createWorldScheduler(
  cfg: WorldSchedulerConfig = WORLD_VOICE_CONFIG,
  lines: readonly WorldLine[] = WORLD_LINES,
  chains: Readonly<Record<ChainId, readonly string[]>> = WORLD_CHAINS,
  unison: readonly (readonly [string, string])[] = WORLD_UNISON,
): WorldScheduler {
  const byId = new Map<string, WorldLine>(lines.map((line): [string, WorldLine] => [line.id, line]));
  const postList = chains.postCap;
  const postIds = new Set<string>(postList);
  const lastPostId = postList[postList.length - 1];
  const unisonCap = cfg.unisonCapMs ?? WORLD_VOICE_CONFIG.unisonCapMs;
  const inFlight = new Map<string, InFlight>();
  // Blocks per line id (shown with blocked); a counted line or a give-up clears its count.
  const blocks = new Map<string, number>();
  let pending: PendingEntry[] = [];
  let seq = 0;
  let chain: ChainRun | null = null;
  let post: PostRun = freshPost();
  let log: WorldMomentLog = newMomentLog();

  // A line is held while it waits in the queue or is on screen (shown() not yet called).
  const isHeld = (id: string): boolean => inFlight.has(id) || pending.some((e) => e.id === id);

  // Counts one more block of a line and returns the total so far.
  const countBlock = (id: string): number => {
    const total = (blocks.get(id) ?? 0) + 1;
    blocks.set(id, total);
    return total;
  };

  // POST-CAP is demo only; it is live once started this session, or once TAPE_FREEZE is in seenEver (a reload resumes it).
  const postActive = (ctx: WorldSchedulerCtx): boolean =>
    ctx.edition === 'demo' && (post.started || ctx.world.seenEver.includes(TAPE_FREEZE));

  // Which lines a non-chain, non-beat offer fires. ms lines that are POST-CAP members are ignored in the demo (INS-07).
  function matchesOffer(line: WorldLine, offer: WorldOffer, ctx: WorldSchedulerCtx): boolean {
    const trig = line.trigger;
    switch (offer.kind) {
      case 'logReply': return trig.kind === 'logReply' && trig.logId === offer.logId;
      case 'buy': return trig.kind === 'buy' && trig.techId === offer.techId && levelGateOk(trig, ctx);
      case 'eraEntry': return trig.kind === 'eraEntry' && trig.era === offer.era;
      case 'opener': return trig.kind === 'opener';   // the cycle window is checked by lineEligible
      case 'ms': return trig.kind === 'ms' && trig.techId === offer.techId && !(ctx.edition === 'demo' && postIds.has(line.id));
      case 'tier':
        return trig.kind === 'tier' && ((offer.firstTop === true && trig.firstTop === true)
          || (offer.techId !== undefined && trig.techId === offer.techId && trig.tier === offer.tier));
      case 'rapid': return trig.kind === 'rapid';
      case 'offline': return trig.kind === 'offline' && offer.minS >= trig.minS;
      default: return false;
    }
  }

  // Queues one line. Keeps ONE non-core reactive entry (a newer offer replaces the older). The tier slot holds ONE entry too:
  // the first-top line (INS-13) replaces a pending non-first-top tier entry (DOG-04, WP23b follow-up a); any other second tier
  // offer is REFUSED while one is pending. A refused or replaced DOG-04 is re-offered by the tier tracker until it is seen.
  function queueLine(line: WorldLine, kind: OfferKind, ctx: WorldSchedulerCtx): void {
    if (!lineEligible(line, ctx.era, ctx, lines) || isHeld(line.id)) return;
    const core = line.core === true;
    if (kind === 'tier') {
      const held = pending.find((e) => e.kind === 'tier');
      if (held !== undefined) {
        if (!isFirstTop(line) || isFirstTop(byId.get(held.id))) return;
        pending = pending.filter((e) => e !== held);
      }
    }
    if (kind !== 'tier' && !core) pending = pending.filter((e) => e.core || e.kind === 'tier');
    const ttl = ttlOf(line, kind, ctx.era, ctx.nowMs, cfg);
    pending.push({
      id: line.id, kind, offerEra: ctx.era, eraLimit: ttl.eraLimit, core, readyAtMs: ctx.nowMs,
      expiresAtMs: ttl.expiresAtMs, seq: seq++, chainId: null,
    });
  }

  // A wordless beat: core reactive (priority 1), not a moment, once per cycle (seen).
  function queueBeat(beat: string, ctx: WorldSchedulerCtx): void {
    if (ctx.world.seen.includes(beat) || isHeld(beat)) return;
    pending.push({
      id: beat, kind: 'beat', offerEra: ctx.era, eraLimit: ctx.era, core: true, readyAtMs: ctx.nowMs,
      expiresAtMs: null, seq: seq++, chainId: null,
    });
  }

  // A chain start: step 1 only, refused while a chain runs or its first line is seen or ineligible.
  function queueChain(chainId: ChainId, step: number, ctx: WorldSchedulerCtx): void {
    if (step !== 1 || chainId === 'postCap' || chain !== null) return;
    const first = chains[chainId][0];
    if (first === undefined) return;
    const line = byId.get(first);
    if (line === undefined || ctx.world.seen.includes(first) || !lineEligible(line, ctx.era, ctx, lines) || isHeld(first)) return;
    const ttl = ttlOf(line, 'chain', ctx.era, ctx.nowMs, cfg);
    pending.push({
      id: first, kind: 'chain', offerEra: ctx.era, eraLimit: ttl.eraLimit, core: true, readyAtMs: ctx.nowMs,
      expiresAtMs: ttl.expiresAtMs, seq: seq++, chainId,
    });
  }

  // KEEP TINKERING: POST-CAP starts (demo only, once). The first POST-CAP line is due postCapFirstMs later; era II pending
  // lines are dropped because POST-CAP owns the voice from here.
  function activatePost(ctx: WorldSchedulerCtx): void {
    if (ctx.edition !== 'demo' || postActive(ctx)) return;
    post = { ...freshPost(), started: true, active: true, nextAtMs: ctx.nowMs + cfg.postCapFirstMs };
    chain = null;
    pending = pending.filter((e) => e.offerEra < ctx.era);
  }

  // POST-CAP steps (STORY_BIBLE §8.2): the freeze beat once, then the four lines in order. They wait (never skip) for silence,
  // bubbles, toasts and the speaker on screen; they ignore gaps and caps. Lines already in seenEver are skipped.
  // Under OFF (beatsOnly) only the freeze beat plays: the line cursor does not move, so the arc resumes where it stopped.
  function postTick(ctx: WorldSchedulerCtx, beatsOnly: boolean): WorldCue | null {
    const now = ctx.nowMs;
    post.done = lastPostId !== undefined && ctx.world.seenEver.includes(lastPostId);
    if (!post.freezeIssued && !ctx.world.seenEver.includes(TAPE_FREEZE)) {
      if (ctx.toastUp || ctx.bubblesVisible !== 0) return null;
      post.freezeIssued = true;
      inFlight.set(TAPE_FREEZE, { id: TAPE_FREEZE, line: null, kind: 'beat', offerEra: ctx.era, core: true, chainId: null, chainStep: 0 });
      return { kind: 'beat', ids: [TAPE_FREEZE], speakers: [] };
    }
    if (beatsOnly) return null;
    while (post.cursor < postList.length) {
      const id = postList[post.cursor];
      const line = id === undefined ? undefined : byId.get(id);
      if (id === undefined || line === undefined || ctx.world.seenEver.includes(id)) {
        post.cursor += 1;
        continue;
      }
      const offerEra = line.eras[0] ?? ctx.era;
      // Eligibility without the on-screen rule: an off-screen speaker waits here instead of being skipped.
      if (!lineEligible(line, offerEra, { ...ctx, onScreen: () => true }, lines)) {
        post.cursor += 1;
        continue;
      }
      if (post.nextAtMs === null) post.nextAtMs = now + cfg.postCapFirstMs;
      if (now < post.nextAtMs || ctx.bubblesVisible !== 0 || ctx.toastUp || !ctx.onScreen(line.speaker)) return null;
      post.cursor += 1;
      post.nextAtMs = now + cfg.postCapGapMs;
      log = noteMomentStart(log, line, offerEra, now, cfg);
      inFlight.set(id, { id, line, kind: 'postCap', offerEra, core: true, chainId: null, chainStep: 0 });
      return { kind: 'line', ids: [id], speakers: [line.speaker] };
    }
    return null;
  }

  // A unison pair holds the run until both members have reported (counted, cut or given up): the step is decided once.
  const unisonOpen = (): boolean =>
    [...inFlight.values()].some((rec) => rec.group !== undefined && rec.group.ids.length > 1 && rec.group.open > 0);

  // Cues the next chain step: its eligible members start on this tick together (WP23b unison). A step that does not fit the free
  // bubble slots waits with the run unchanged; a step with no eligible member is skipped; the run ends after its last step.
  function cueChainStep(ctx: WorldSchedulerCtx, slots: number): WorldCue | null {
    const run = chain;
    if (run === null) return null;
    const steps = stepsOf(chains[run.chainId], unison);
    for (let index = run.step; index < steps.length; index += 1) {
      const found: WorldLine[] = [];
      for (const id of steps[index] ?? []) {
        const line = byId.get(id);
        if (line !== undefined && lineEligible(line, run.offerEra, ctx, lines)) found.push(line);
      }
      if (found.length === 0) continue;
      if (found.length > slots) return null;
      const done = index + 1;
      const group: ChainGroup = { ids: found.map((l) => l.id), open: found.length, counted: 0, gaveUp: false };
      for (const line of found) {
        log = { ...log, bySpeaker: { ...log.bySpeaker, [line.speaker]: ctx.nowMs } };
        inFlight.set(line.id, {
          id: line.id, line, kind: 'chain', offerEra: run.offerEra, core: true, chainId: run.chainId, chainStep: done, group,
        });
      }
      chain = done < steps.length ? { ...run, step: done } : null;
      return { kind: 'chainStep', ids: group.ids, speakers: found.map((l) => l.speaker), chainId: run.chainId, step: done };
    }
    chain = null;
    return null;
  }

  // The active chain run (CROSSED LINES, SYNCHRONIZATION, ONE OBSERVER): the next step once the last bubble has shown
  // chainStepAfterMs (no bubble on screen means that wait is over, but only when no member is waiting: chainMemberWaiting holds
  // the run through a prelude or a placement wait), at most chainMaxBubbles on screen, and afterIndexCloseMs after a TECH INDEX
  // close, so a resumed step lands after the index. A member that is off-screen, seen or ineligible is skipped (stays unseen).
  // The run ends after its last step.
  function chainTick(ctx: WorldSchedulerCtx): WorldCue | null {
    if (chain === null) return null;
    if (ctx.chainMemberWaiting === true) return null;
    if (ctx.toastUp) return null;
    if (unisonOpen()) return null;
    if (ctx.bubblesVisible >= cfg.chainMaxBubbles) return null;
    if (ctx.bubblesVisible !== 0 && ctx.bubbleVisibleMs < cfg.chainStepAfterMs) return null;
    if (ctx.indexClosedAtMs !== null && ctx.nowMs < ctx.indexClosedAtMs + cfg.afterIndexCloseMs) return null;
    return cueChainStep(ctx, cfg.chainMaxBubbles - ctx.bubblesVisible);
  }

  // The normal pick: pending entries (their gates re-checked now) and the idle / demoNear table lines, lowest priority
  // number first, then the oldest offer. Starting a line is one moment (beats are not), a chain start opens the run.
  // Under OFF (beatsOnly) only queued beats are picked: the setting refuses every line, chain start and table line.
  function pickTick(ctx: WorldSchedulerCtx, beatsOnly: boolean): WorldCue | null {
    const now = ctx.nowMs;
    let best: Candidate | null = null;
    for (const entry of pending) {
      if (now < entry.readyAtMs) continue;
      if (beatsOnly && entry.kind !== 'beat') continue;
      // A SYNCHRONIZATION start waits for the unison edge, or for the cap counted from when it was queued (WP23b).
      if (entry.chainId === 'synchronization' && ctx.unisonEdge !== true && now < entry.readyAtMs + unisonCap) continue;
      const line = byId.get(entry.id) ?? null;
      if (entry.kind === 'beat') {
        if (!triggerGate('beat', true, ctx, cfg)) continue;
      } else {
        if (line === null || !lineEligible(line, entry.offerEra, ctx, lines) || !idleReady(line, ctx)) continue;
        if (!triggerGate(entry.kind, entry.core, ctx, cfg) || !momentGate(line, entry.kind, log, ctx, cfg, entry.offerEra)) continue;
      }
      best = better(best, {
        priority: priorityOf(entry.kind, entry.core), source: 0, order: entry.seq, id: entry.id, line, kind: entry.kind,
        offerEra: entry.offerEra, core: entry.core, chainId: entry.chainId, pendingSeq: entry.seq,
      });
    }
    // The table scan (idle, demoNear, postgame) is skipped under OFF: it could only find lines the setting refuses.
    // Safe skip: table kinds are idle/demoNear/postgame, so momentWindowOpen('idle') is their R7 gate; a toast fails triggerGate for all.
    if (!beatsOnly && !ctx.toastUp && momentWindowOpen('idle', log, ctx, cfg)) {
      for (const [order, line] of lines.entries()) {
        const kind = line.trigger.kind;
        if (kind !== 'idle' && kind !== 'demoNear' && kind !== 'postgame') continue;
        if (isHeld(line.id)) continue;
        const core = line.core === true;
        if (!lineEligible(line, ctx.era, ctx, lines) || !idleReady(line, ctx)) continue;
        if (!triggerGate(kind, core, ctx, cfg) || !momentGate(line, kind, log, ctx, cfg, ctx.era)) continue;
        best = better(best, {
          priority: priorityOf(kind, core), source: 1, order, id: line.id, line, kind, offerEra: ctx.era, core,
          chainId: null, pendingSeq: null,
        });
      }
    }
    if (best === null) return null;
    const pick: Candidate = best;
    if (pick.pendingSeq !== null) {
      const taken = pick.pendingSeq;
      pending = pending.filter((e) => e.seq !== taken);
    }
    if (pick.line === null) {
      inFlight.set(pick.id, { id: pick.id, line: null, kind: 'beat', offerEra: pick.offerEra, core: true, chainId: null, chainStep: 0 });
      return { kind: 'beat', ids: [pick.id], speakers: [] };
    }
    const line = pick.line;
    log = noteMomentStart(log, line, pick.offerEra, ctx.nowMs, cfg);
    if (pick.chainId !== null) {
      // A chain start opens its run and cues its first step (a unison pair starts on this tick).
      chain = { chainId: pick.chainId, step: 0, offerEra: pick.offerEra };
      return cueChainStep(ctx, cfg.chainMaxBubbles - ctx.bubblesVisible);
    }
    inFlight.set(pick.id, { id: pick.id, line, kind: pick.kind, offerEra: pick.offerEra, core: pick.core, chainId: null, chainStep: 0 });
    return { kind: 'line', ids: [pick.id], speakers: [line.speaker] };
  }

  return {
    offer(offer, ctx) {
      if (offer.kind === 'postCap') {
        activatePost(ctx);
        return;
      }
      if (postActive(ctx)) return;
      // Wordless beats are queued under OFF too (they respect hard silence at tick). Lines and chains are refused here.
      if (offer.kind === 'beat') {
        queueBeat(offer.beat, ctx);
        return;
      }
      if (ctx.setting === 'off') return;
      if (offer.kind === 'chain') {
        queueChain(offer.chainId, offer.step, ctx);
        return;
      }
      // idle, demoNear and postgame lines are found by the table scan in tick(); they are never offered.
      if (offer.kind === 'idle' || offer.kind === 'demoNear' || offer.kind === 'postgame') return;
      for (const line of lines) {
        if (matchesOffer(line, offer, ctx)) queueLine(line, offer.kind, ctx);
      }
    },

    tick(ctx) {
      pending = pending.filter((e) => ctx.era <= e.eraLimit && (e.expiresAtMs === null || ctx.nowMs < e.expiresAtMs));
      if (ctx.era > LIVING_WORLD.maxEra) return null;
      post.active = postActive(ctx);
      // Hard silence wins over everything (bible 7.4). Under OFF only the wordless beats run; a chain run is paused, neither
      // advanced nor cleared, so it resumes when the setting is back on.
      if (ctx.silence !== null) return null;
      const beatsOnly = ctx.setting === 'off';
      if (post.active) return postTick(ctx, beatsOnly);
      if (chain !== null && !beatsOnly) return chainTick(ctx);
      return pickTick(ctx, beatsOnly);
    },

    shown(id, fraction, ctx, opts) {
      const rec = inFlight.get(id);
      if (rec === undefined) return null;
      inFlight.delete(id);
      const now = ctx.nowMs;
      const line = rec.line;
      if (line === null) return markBeatSeen(ctx.world, id);
      const group = rec.group;
      if (fraction >= cfg.seenFraction) {
        blocks.delete(id);
        if (id === lastPostId) post.done = true;
        if (group !== undefined) {
          group.open -= 1;
          group.counted += 1;
        }
        return countedSeen(line, rec.offerEra, ctx);
      }
      // A blocked line (no bubble ever, placeWait expired) counts one block; at placeBlockLimit blocks it is given up: it stays
      // unseen and nothing requeues it. A cut by silence is not a block and never gives up.
      const giveUp = opts?.blocked === true && countBlock(id) >= cfg.placeBlockLimit;
      if (giveUp) blocks.delete(id);
      // Under the 60 % rule: a POST-CAP line waits again (the cursor goes back to it); a cut chain member resumes its run
      // (below); a core line returns to the queue with the same era limit; a non-core line is dropped.
      if (rec.kind === 'postCap') {
        if (giveUp) {
          // The cursor stays past the member (the line is consumed and unseen); the arc waits one POST-CAP gap.
          post.nextAtMs = now + cfg.postCapGapMs;
          return null;
        }
        const index = postList.indexOf(id);
        if (index >= 0 && index < post.cursor) {
          post.cursor = index;
          post.nextAtMs = now;
        }
        return null;
      }
      // A cut chain member: the run is paused, not dropped. A later step is set back so it plays again. A first step is decided
      // once all its members have reported: a counted member keeps the run going (the others stay unseen); with none counted, a
      // given-up member ends the run and cut members go back to the queue as a chain start, so picking it opens the run again.
      // If the run already moved past it (a later bubble is up), it stays unseen and the run goes on. POST-CAP owns the voice
      // once started, so nothing resumes.
      if (rec.chainId !== null) {
        if (group !== undefined) {
          group.open -= 1;
          if (giveUp) group.gaveUp = true;
        }
        if (postActive(ctx) || group === undefined) return null;
        if (rec.chainStep > 1) {
          // A member given up is consumed, not set back: the run goes on.
          if (!giveUp && (chain === null || rec.chainStep - 1 < chain.step)) {
            chain = { chainId: rec.chainId, step: rec.chainStep - 1, offerEra: rec.offerEra };
          }
          return null;
        }
        if (group.open > 0 || group.counted > 0 || chain === null || chain.step !== 1) return null;
        chain = null;
        const firstId = group.ids[0];
        const firstLine = firstId === undefined ? undefined : byId.get(firstId);
        if (group.gaveUp || firstId === undefined || firstLine === undefined) return null;
        const ttl = ttlOf(firstLine, 'chain', rec.offerEra, now, cfg);
        pending.push({
          id: firstId, kind: 'chain', offerEra: rec.offerEra, eraLimit: ttl.eraLimit, core: true, readyAtMs: now,
          expiresAtMs: ttl.expiresAtMs, seq: seq++, chainId: rec.chainId,
        });
        return null;
      }
      if (rec.core && !giveUp) {
        const ttl = ttlOf(line, rec.kind, rec.offerEra, now, cfg);
        pending.push({
          id, kind: rec.kind, offerEra: rec.offerEra, eraLimit: ttl.eraLimit, core: true, readyAtMs: now,
          expiresAtMs: ttl.expiresAtMs, seq: seq++, chainId: null,
        });
      }
      return null;
    },

    interrupt(_reason, _ctx) {
      // A hard silence pauses the CROSSED LINES run: the chain stays set and resumes when the silence ends (tick waits for
      // the silence). Undelivered steps stay unseen. The POST-CAP state and any cue in flight stay too; reset() ends the run.
    },

    force(id, ctx) {
      const line = byId.get(id);
      if (line === undefined || ctx.setting === 'off' || ctx.silence !== null) return null;
      if (ctx.setting === 'rare' && line.core !== true) return null;
      if (!ctx.onScreen(line.speaker)) return null;
      // Debug path: ignores gaps, caps, repeat policy and triggers, and does not touch the moment log.
      pending = pending.filter((e) => e.id !== id);
      inFlight.set(id, {
        id, line, kind: kindOfLine(line), offerEra: ctx.era, core: line.core === true, chainId: null, chainStep: 0,
      });
      return { kind: 'line', ids: [id], speakers: [line.speaker] };
    },

    reset() {
      pending = [];
      chain = null;
      post = freshPost();
      inFlight.clear();
      blocks.clear();
      log = newMomentLog();
    },

    state() {
      return {
        pending: pending.map((e) => ({
          id: e.id, kind: e.kind, offerEra: e.offerEra, priority: priorityOf(e.kind, e.core), core: e.core,
          readyAtMs: e.readyAtMs, expiresAtMs: e.expiresAtMs,
        })),
        chain: chain === null ? null : { chainId: chain.chainId, step: chain.step },
        postCap: { active: post.active, step: post.cursor, nextAtMs: post.nextAtMs, done: post.done },
        lastMomentAtMs: log.lastStartMs,
        hourMoments: log.hourStarts.length,
        bySpeaker: { ...log.bySpeaker },
      };
    },
  };
}
