// Living world director (WP23a): the Phaser glue of the living world. Owns the cast and prop renderers, the bubble controller, the
// tier tracker, the toast gate and the scheduler; turns session events, the TECH INDEX, the era card, modals and scene state into
// silence, cues, bubbles, sounds, glances and persisted world memory; exposes the debug API (C7).
// Why: one owner for the living world's clocks and state, so WorldScene only forwards events. The cadence, silence and cue rules stay
// in the tested math modules (worldVoice, worldSilence, worldTierRules, worldState, worldPlacement); this file sequences them. The save
// is written only through session.recordWorld. Phaser and DOM code: checked by typecheck and the EM smokes. WP23a.
import type Phaser from 'phaser';
import type { Edition } from '../../data/edition';
import type { OfflineReport, TechId, WorldVoices } from '../../data/types';
import { SYSTEM_LOG_CONFIG } from '../../data/systemLogs';
import { VIEW } from '../../data/world';
import {
  LIVING_WORLD, WORLD_A11Y_PREFIX, WORLD_GLANCE_SEED, WORLD_LAYOUT, WORLD_LINES, WORLD_ROWS, WORLD_VOICE_CONFIG,
} from '../../data/livingWorld';
import type {
  ChainId, DenizenId, FramingKey, GroundId, SpeakerId, WorldLine, WorldOffer, WorldPlacement,
} from '../../data/livingWorld';
import type { GameSession } from '../../simulation';
import { affordableTechIds } from '../../simulation/progression/affordable';
import { currentEra } from '../../simulation/progression/era';
import { isFinaleLocked } from '../../simulation/progression/ending';
import { activePrompt, anyPurchased } from '../../ui/guidanceView';
import { welcomeBackMessage } from '../../ui/notificationRules';
import { seedTracker } from '../../ui/systemLogRules';
import { createWorldBubbleController } from '../../ui/worldBubbleController';
import type { WorldBubbleController } from '../../ui/worldBubbleController';
import type { WorldVoiceView } from '../../ui/worldVoice';
import type { GameFeedback, PartEvolvedEvent, PartTorquedEvent } from '../context';
import type { CameraPose } from '../math/finale';
import { bubbleDurationMs } from '../math/worldBubble';
import { GLANCE_TARGETS, glanceSchedule } from '../math/worldGlance';
import { framingKeyOfPose, framingPose, isOnScreen, placeCast, unseenChangeOk, viewRectOf } from '../math/worldPlacement';
import type { Rect, SpeakerAnchor } from '../math/worldPlacement';
import { deriveWorldState } from '../math/worldState';
import type { WorldStateInput, WorldVisualState } from '../math/worldState';
import { blipCount, talkTimeline } from '../math/worldTurn';
import { WP22_TIER_PORT } from '../math/worldTierPort';
import { createTierTracker } from '../math/worldTierRules';
import type { TierEffects, TierPort, TierTracker } from '../math/worldTierRules';
import { createToastGate, silenceReason, TOAST_GATE_CONFIG } from '../math/worldSilence';
import type { SilenceInputs, ToastGate } from '../math/worldSilence';
import { createWorldScheduler } from '../math/worldVoice';
import type { WorldScheduler } from '../math/worldVoice';
import type { WorldCue, WorldSchedulerCtx } from '../math/worldVoiceRules';
import { LivingWorld } from './LivingWorld';
import type { LivingId } from './LivingWorld';
import { WorldProps } from './WorldProps';
import { createWorldRows, sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

/** Tech and UI reads the director needs from the scene (WorldScene implements them). */
export interface WorldDirectorPorts {
  techTreeOpen(): boolean;
  onTechTreeOpenChange(fn: (open: boolean) => void): () => void;
  eraCardShown(): boolean;
  modalOpen(): boolean;
  photoActive(): boolean;
  cycleBusy(): boolean;
  teaserOn(): boolean;
  demoCardOpen(): boolean;
  tabHidden(): boolean;
}

export interface WorldDirectorDeps {
  scene: Phaser.Scene;
  session: GameSession;
  feedback: GameFeedback;
  edition: Edition;
  root: HTMLElement;
  view: WorldVoiceView;
  ports: WorldDirectorPorts;
  bootOffline: OfflineReport | null;
  /** True when the boot WELCOME BACK toast is up at director start (its gate starts now). */
  welcomeShown: boolean;
  tier?: TierPort;
}

/** Debug state (C7): what the director knows now. The hook adds the null guard. */
export interface WorldDebugState {
  era: number;
  framing: string;
  setting: string;
  quiet: boolean;
  hidden: boolean;
  silence: string | null;
  playMs: number;
  nowMs: number;
  blips: number;
  seen: string[];
  seenEver: string[];
  eraMoments: number[];
  youEras: number;
  pending: string[];
  chain: { chainId: string; step: number } | null;
  postCap: { active: boolean; step: number } | null;
  placements: Record<string, { x: number; row: string } | null>;
  activeLines: string[];
  // WP23a X1: the tier tracker's MK V heartbeat (on once the first top tier of the cycle is in) and the applied dog hole stage
  // (0 = no hole; null before the first applied state).
  tierHeartbeat: boolean;
  holeStage: number | null;
}

/** Debug API (C7) behind window.__wedtmd. Every call is a no-op or null once the director is destroyed. */
export interface WorldDebugApi {
  worldState(): WorldDebugState | null;
  worldSay(id: string): boolean;
  worldQuiet(on: boolean): void;
  worldAdvance(ms: number): void;
  worldLogShown(logId: string): void;
  worldClock(hour: number | null): void;
  livingWorld(): { id: string; variant: string; x: number; visible: boolean; speaking: boolean }[];
  worldStats(): { objects: number; meanMs: number };
  worldBubble(): { visible: boolean; rect: { x: number; y: number; w: number; h: number } | null; text: string; side: string } | null;
}

type WalkingSpeaker = Exclude<SpeakerId, 'girl' | 'payphone'>;
type GlanceId = Exclude<DenizenId, 'sensor7' | 'girl'>;
type Placements = Readonly<Record<GroundId, WorldPlacement | null>>;

// What the renderers show. placeKey (visible flag and placements) is the part a relocation or a visibility change gates;
// stateKey is the whole visual state. partial* is the state with the applied visible flag, committed while the gate holds.
interface Plan {
  state: WorldVisualState;
  placements: Placements;
  placeKey: string;
  stateKey: string;
  partialState: WorldVisualState;
  partialKey: string;
}

// wait: the bubble is not up yet (retried until placeWaitMs); shown: the bubble is up; hidden: it came down, the hold runs to doneAtMs.
type LinePhase = 'wait' | 'shown' | 'hidden';

interface ActiveLine {
  readonly id: string;
  readonly speaker: SpeakerId;
  readonly chainId: ChainId | null;  // the chain this line runs in (CROSSED LINES, postCap); null for a plain line
  readonly text: string;
  readonly durationMs: number;
  readonly startMs: number;    // scheduler clock of the line's t = 0 (later than the cue by a chain prelude)
  readonly showAtMs: number;   // t of the bubble show (talkTimeline)
  turned: boolean;
  phase: LinePhase;
  slot: 0 | 1 | null;
  nextTryMs: number;           // scheduler clock of the next show attempt (DOM reads at the ladder cadence only)
  hideAtMs: number;
  doneAtMs: number;
}

// A deferred action on the scheduler clock. cutOff actions die with the cut that happened after they were set.
interface Delayed { atMs: number; run: () => void; cutOff: boolean; epoch: number }
interface Glance { id: GlanceId; endAt: number }

const CADENCE_MS = WORLD_VOICE_CONFIG.ladderRecheckMs;
const TIMING_WINDOW = 120;
// Glance seed per cycle: a hash salt (not a balance number), so each cycle glances differently.
const CYCLE_SEED_SALT = 7919;
const GAME_VIEW: Rect = { x: 0, y: 0, w: VIEW.width, h: VIEW.height };
const LINES_BY_ID: ReadonlyMap<string, WorldLine> = new Map(WORLD_LINES.map((line) => [line.id, line] as const));
// Cast members whose head is reserved from bubbles (AD2 F2 / F16), in the order the ladder reads them.
const HEAD_RESERVE_IDS: readonly LivingId[] = ['inspector', 'dog', 'crow', 'sensor7'];

function isWalker(speaker: SpeakerId): speaker is WalkingSpeaker {
  return speaker === 'inspector' || speaker === 'dog' || speaker === 'crow';
}

function glanceIdOf(denizen: DenizenId): GlanceId | null {
  return denizen === 'sensor7' || denizen === 'girl' ? null : denizen;
}

// The #ui-root zoom (CSS px per layout px). An unset or invalid zoom reads as 1.
function parseZoom(root: HTMLElement): number {
  const z = Number.parseFloat(root.style.zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

// True when a placed member's feet point lies in the view (world px, no inset).
function anyOnScreen(placements: Placements, view: Rect): boolean {
  for (const p of Object.values(placements)) {
    if (p !== null && isOnScreen({ x: p.x, y: WORLD_ROWS[p.row].y }, view, 0)) return true;
  }
  return false;
}

export class LivingWorldDirector {
  private readonly scene: Phaser.Scene;
  private readonly session: GameSession;
  private readonly feedback: GameFeedback;
  private readonly edition: Edition;
  private readonly view: WorldVoiceView;
  private readonly ports: WorldDirectorPorts;
  private readonly tier: TierPort;
  private readonly rows: WorldRows;
  private readonly props: WorldProps;
  private readonly cast: LivingWorld;
  private readonly tracker: TierTracker;
  private readonly scheduler: WorldScheduler;
  private readonly toastGate: ToastGate;
  private readonly bubbles: WorldBubbleController;
  private readonly ctx: WorldSchedulerCtx;
  private readonly cam: CameraPose = { centerX: 0, centerY: 0, zoom: 1 };
  private readonly timings = new Float64Array(TIMING_WINDOW);
  private readonly api: WorldDebugApi;
  private subs: (() => void)[] = [];
  private logsSeen: Set<string>;
  private nowMs = 0;
  private playMs = 0;
  private lastInputMs = 0;
  private hasClicked: boolean;
  private hasPurchased: boolean;
  private indexClosedAtMs: number | null = null;
  private bubbleEdgeMs = Number.NEGATIVE_INFINITY;
  private silence: string | null = null;
  private onboarding = false;
  private quiet = false;
  private asleep = false;
  private clockHour: number | null = null;
  private eraWasUp = false;
  private cadenceAcc = 0;
  private crankSteps = 0;
  private clickTimes: number[] = [];
  private rapidOn = false;
  private active: ActiveLine[] = [];
  private delayed: Delayed[] = [];
  private epoch = 0;
  private dialOn = false;
  private lastRingMs: number | null = null;
  private blipEvents = 0;
  private glance: Glance | null = null;
  private glanceK = 0;
  private glanceDueAt: number | null = null;
  private dirty = true;
  private forceApply = true;
  private lastRevision = -1;
  private applied: Plan | null = null;
  private wanted: Plan | null = null;
  private framing: FramingKey = 'e1';
  private timingCount = 0;
  private timingNext = 0;
  private destroyed = false;
  // Wall-clock moments the director clock stopped (asleep, tab hidden); null while it runs. The toast gate reads the difference.
  private asleepSinceWall: number | null = null;
  private hiddenSinceWall: number | null = null;
  // A ripple that came while the TECH INDEX was open. It plays once when the index closes (A10: one per release).
  private rippleLatched = false;
  // The tier tracker seeds once the cast holds its first applied state: a walker is on screen only after apply, and R6 (the speaker
  // on screen) gates every offer. A reset or a new cycle seeds again.
  private tierSeedPending = true;

  constructor(deps: WorldDirectorDeps) {
    this.scene = deps.scene;
    this.session = deps.session;
    this.feedback = deps.feedback;
    this.edition = deps.edition;
    this.view = deps.view;
    this.ports = deps.ports;
    // X1: the default tier port is the WP22 tier maths (the stub stood in until WP23a's X1 wiring).
    this.tier = deps.tier ?? WP22_TIER_PORT;
    const state = this.session.state;
    this.rows = createWorldRows(this.scene);
    this.props = new WorldProps(this.scene, this.rows);
    this.tracker = createTierTracker(this.tier);
    // The Sensor 7 LED beats once the first top tier of the cycle is in (WP22 heartbeat, World scene clock).
    this.cast = new LivingWorld(this.scene, this.rows, (now) => this.tracker.heartbeat() && this.tier.heartbeatLow(now));
    sortWorldRows(this.rows);
    this.scheduler = createWorldScheduler();
    this.toastGate = createToastGate();
    this.bubbles = createWorldBubbleController({
      root: deps.root,
      view: deps.view,
      canvas: () => this.scene.game.canvas,
      uiZoom: () => parseZoom(deps.root),
      uiScale: () => this.session.settings.uiScale,
      camera: () => this.readCamera(),
      reservedHeads: (exclude) => this.reservedHeads(exclude),
    });
    this.logsSeen = new Set(seedTracker(state, Date.now()).shown);
    this.hasClicked = state.totalClicks > 0;
    this.hasPurchased = anyPurchased(state.techLevels, this.session.techs);
    this.ctx = {
      nowMs: 0, playMs: 0, lastInputMs: 0, warmupUntilMs: WORLD_VOICE_CONFIG.sessionWarmupMs, era: 1, cycle: 1,
      edition: this.edition.id, setting: this.session.settings.worldVoices, silence: null,
      hasClicked: this.hasClicked, hasPurchased: this.hasPurchased, toastUp: false, toastClearedAtMs: null,
      indexClosedAtMs: null, bubblesVisible: 0, bubbleVisibleMs: 0, chainMemberWaiting: false,
      onScreen: (speaker) => this.speakerOnScreen(speaker),
      world: this.session.world, levels: state.techLevels, logsSeen: this.logsSeen, lifetimeEe: state.lifetime.ee,
      localHour: null,
    };
    this.api = this.buildApi();
    this.subs = this.connect();
    if (deps.bootOffline !== null) {
      if (deps.welcomeShown && welcomeBackMessage(deps.bootOffline) !== null) {
        this.toastGate.onWelcome(this.nowMs);
        this.startWarmupAfterWelcome();
      }
      this.scheduleOffline(deps.bootOffline);
    }
    this.refreshOnboarding();
  }

  /** One frame. dtMs is clamped to tickClampMs for the living-world clocks; visuals step by the same clamped time. */
  update(dtMs: number): void {
    if (this.destroyed) return;
    const t0 = performance.now();
    const step = Number.isFinite(dtMs) ? Math.min(Math.max(0, dtMs), WORLD_VOICE_CONFIG.tickClampMs) : 0;
    if (!this.asleep) {
      this.nowMs += step;
      this.playMs += step;
    }
    const now = this.nowMs;
    this.readCamera();
    // Scene time, read once per frame. The cast clock takes it before any beat or turn starts this frame (the wake frame after the
    // World slept: this.nowMs and the cast clock still hold the time from before the sleep).
    const sceneNow = this.scene.time.now;
    this.cast.syncNow(sceneNow);

    // Era card falling edge: its toast gate starts now.
    const eraUp = this.ports.eraCardShown();
    if (this.eraWasUp && !eraUp) this.toastGate.onEraCardClosed(now);
    this.eraWasUp = eraUp;

    this.runDue(now);
    this.trackClicks(now);

    // Every CADENCE_MS: the onboarding prompt (hard silence) and the rebuild gate.
    this.cadenceAcc += step;
    const cadence = this.cadenceAcc >= CADENCE_MS;
    if (cadence) {
      this.cadenceAcc = 0;
      this.refreshOnboarding();
    }

    this.refreshSilence();
    this.stepVisual(cadence);
    if (this.tierSeedPending && this.applied !== null) {
      this.tierSeedPending = false;
      this.seedTiers();
    }

    // A cue goes before the glances: a running glance ends first, and no glance starts on the frame a line starts (AD2 F10).
    const cue = this.scheduler.tick(this.ctxNow());
    if (cue !== null) {
      if (this.glance !== null) this.endGlance(this.glance);
      this.startCue(cue);
    }
    this.stepGlances(now, cadence);

    this.stepLines(now);
    this.stepBubbles(now);

    const crank = this.crankSteps;
    this.crankSteps = 0;
    this.cast.update(step, crank, sceneNow, this.cam);
    this.props.update(step, crank, sceneNow);

    this.recordTiming(performance.now() - t0);
  }

  /** SYS LOG shown (toast up): the log channel holds the toast gate until it clears. */
  onLogShown(logId: string): void {
    this.logsSeen.add(logId);
    this.toastGate.onLogShown(this.nowMs);
    if (logId === 'sensor-null') this.sensorReply();
  }

  /** SYS LOG cleared: a log reply may follow (logReplyAfterClearMs later, checked by the scheduler). */
  onLogCleared(logId: string): void {
    this.toastGate.onLogCleared(this.nowMs);
    this.offer({ kind: 'logReply', logId });
  }

  /** The SYS LOG poll defers while a bubble is up (D3). */
  sysLogDefer(): boolean {
    return this.bubbles.visible();
  }

  /** KEEP TINKERING (demo only): starts POST-CAP. */
  onKeep(): void {
    if (this.edition.demo) this.offer({ kind: 'postCap', step: 0 });
  }

  /** World scene asleep: the clocks stop, the silence shows at once (worldSay and force see it) and bubbles go. */
  onSleep(): void {
    this.asleep = true;
    if (this.asleepSinceWall === null) this.asleepSinceWall = performance.now();
    this.silence = 'asleep';
    this.endAll(true, 'asleep');
  }

  // Awake again: the toast gate moves back by the wall time that passed while the clock was stopped, then silence is recomputed.
  onWake(): void {
    this.asleep = false;
    if (this.asleepSinceWall !== null) {
      this.toastGate.elapse(performance.now() - this.asleepSinceWall);
      this.asleepSinceWall = null;
    }
    this.dirty = true;
    this.cast.syncNow(this.scene.time.now);
    this.refreshSilence();
  }

  debug(): WorldDebugApi {
    return this.api;
  }

  destroy(): void {
    if (this.destroyed) return;
    for (const off of this.subs) off();
    this.subs = [];
    this.endAll(false, 'destroy');
    this.delayed = [];
    this.bubbles.destroy();
    this.cast.destroy();
    this.props.destroy();
    this.rows.back.destroy();
    this.rows.front.destroy();
    this.destroyed = true;
  }

  // ---- subscriptions ----

  private connect(): (() => void)[] {
    const s = this.session;
    const onVisibility = (): void => this.onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibility);
    return [
      s.on('click', () => this.onClick()),
      s.on('purchase', (e) => this.onPurchase(e.id)),
      s.on('unlock', () => this.onUnlock()),
      s.on('milestone', (e) => this.onMilestone(e.id)),
      s.on('offline', (report) => this.onOfflineReport(report)),
      s.on('reset', () => this.onNewGame()),
      s.on('cycle', () => this.onNewGame()),
      s.on('settings', (settings) => this.onSettings(settings.worldVoices)),
      s.on('ending', () => { this.dirty = true; }),
      this.feedback.partEvolved.on((e) => this.onEvolved(e)),
      this.feedback.partTorqued.on((e) => this.onTorqued(e)),
      this.ports.onTechTreeOpenChange((open) => this.onTreeOpen(open)),
      () => document.removeEventListener('visibilitychange', onVisibility),
    ];
  }

  private onClick(): void {
    this.hasClicked = true;
    this.lastInputMs = this.nowMs;
    this.crankSteps += 1;
    this.clickTimes.push(this.nowMs);
  }

  private onPurchase(id: TechId): void {
    this.hasPurchased = true;
    this.lastInputMs = this.nowMs;
    this.dirty = true;
    this.offer({ kind: 'buy', techId: id });
    if (id === 'generator') this.offer({ kind: 'chain', chainId: 'crossedLines', step: 1 });
    if (id === 'wornMotor') this.offer({ kind: 'beat', beat: 'beat.failedSync' });
  }

  private onUnlock(): void {
    this.toastGate.onUnlock(this.nowMs);
    this.dirty = true;
  }

  private onMilestone(id: TechId): void {
    this.toastGate.onMilestone(this.nowMs);
    this.dirty = true;
    this.offer({ kind: 'ms', techId: id });
  }

  // A welcome toast (boot or tab return) gates bubbles; an offline stretch of at least offlineMinS offers DOG-07 after it.
  private onOfflineReport(report: OfflineReport): void {
    if (welcomeBackMessage(report) !== null) {
      this.toastGate.onWelcome(this.nowMs);
      this.startWarmupAfterWelcome();
    }
    this.scheduleOffline(report);
  }

  // WELCOME BACK clears, then the session warmup runs (bible 7.1). Only ever extends the warmup already set.
  private startWarmupAfterWelcome(): void {
    const clearsAtMs = this.nowMs + TOAST_GATE_CONFIG.welcomeMs + TOAST_GATE_CONFIG.fadeMs;
    this.ctx.warmupUntilMs = Math.max(this.ctx.warmupUntilMs, clearsAtMs + WORLD_VOICE_CONFIG.sessionWarmupMs);
  }

  // The tab hides or shows. rAF stops while the tab is hidden, so update() never sees it; the change is taken here instead.
  private onVisibilityChange(): void {
    if (document.hidden) {
      if (this.hiddenSinceWall === null) this.hiddenSinceWall = performance.now();
      this.silence = 'tab-hidden';
      this.endAll(true, 'tab-hidden');
      return;
    }
    if (this.hiddenSinceWall !== null) {
      this.toastGate.elapse(performance.now() - this.hiddenSinceWall);
      this.hiddenSinceWall = null;
    }
    this.dirty = true;
    this.refreshSilence();
  }

  private scheduleOffline(report: OfflineReport): void {
    if (report.elapsedSeconds < WORLD_VOICE_CONFIG.offlineMinS) return;
    const minS = report.elapsedSeconds;
    const welcomeEnd = this.nowMs + TOAST_GATE_CONFIG.welcomeMs + TOAST_GATE_CONFIG.fadeMs;
    this.later(welcomeEnd + WORLD_VOICE_CONFIG.offlineAfterWelcomeMs, () => this.offer({ kind: 'offline', minS }), false);
  }

  // Reset and cycle: nothing in flight is saved (the state it would write is gone), every queue and gate starts again.
  private onNewGame(): void {
    const s = this.session.state;
    this.rippleLatched = false;
    if (this.glance !== null) this.endGlance(this.glance);
    this.endAll(false, 'reset');
    this.delayed = [];
    this.scheduler.reset();
    this.tracker.reset();
    this.tierSeedPending = true;
    this.toastGate.reset();
    this.glanceK = 0;
    this.glanceDueAt = null;
    this.logsSeen = new Set(seedTracker(s, Date.now()).shown);
    this.hasClicked = s.totalClicks > 0;
    this.hasPurchased = anyPurchased(s.techLevels, this.session.techs);
    this.indexClosedAtMs = null;
    this.clickTimes = [];
    this.rapidOn = false;
    this.dirty = true;
    this.forceApply = true;
  }

  private onSettings(setting: WorldVoices): void {
    this.dirty = true;
    if (setting === 'off') this.endAll(true, 'settings');
  }

  private onEvolved(e: PartEvolvedEvent): void {
    const fx = this.tracker.onEvolved(e, this.nowMs);
    this.dirty = true;
    this.applyTierEffects(fx);
  }

  private onTorqued(e: PartTorquedEvent): void {
    const fx = this.tracker.onTorqued(e, this.nowMs);
    if (fx.earFlick) {
      this.cast.syncNow(this.scene.time.now);
      this.cast.notice('earFlick');
    }
  }

  // The close re-check without a close, run once a save loads or a cycle starts: a save may already hold a top tier or the dog tier,
  // so the heartbeat and the offers match the machine. Seen lines are refused by the scheduler, so nothing repeats.
  private seedTiers(): void {
    const fx = this.tracker.onIndexClose(this.session.state.techLevels, this.nowMs);
    for (const offer of fx.offers) this.offer(offer);
  }

  // TECH INDEX open or close. A close restarts the INS-13 / DOG-04 re-check and the 2.5 s gate (A10, D2).
  private onTreeOpen(open: boolean): void {
    this.dirty = true;
    if (open) return;
    this.indexClosedAtMs = this.nowMs;
    const fx = this.tracker.onIndexClose(this.session.state.techLevels, this.nowMs);
    for (const offer of fx.offers) this.offer(offer);
    // The ripple latched while the index was open plays once, now that the index has closed.
    if (this.rippleLatched) {
      this.rippleLatched = false;
      const era = currentEra(this.session.state.techLevels);
      if (!this.session.settings.reducedMotion && (era === 1 || era === 2)) this.playRipple(era);
    }
  }

  private applyTierEffects(fx: TierEffects): void {
    const era = currentEra(this.session.state.techLevels);
    if (fx.ripple && !this.session.settings.reducedMotion && (era === 1 || era === 2)) {
      // At most one ripple per TECH INDEX release: while the index is open, the ripple waits for its close (onTreeOpen).
      if (this.ports.techTreeOpen()) this.rippleLatched = true;
      else this.playRipple(era);
    }
    if (fx.lampFlicker) this.props.lampFlicker();
    // Event path (runs before the frame's update when the machine ticks first): the cast clock takes scene time for the notices.
    this.cast.syncNow(this.scene.time.now);
    if (fx.sheetTick && !this.speaking('inspector') && this.speakerOnScreen('inspector')) this.cast.notice('sheetTick');
    if (fx.sensorBlink) this.cast.notice('sensorBlink');
    for (const offer of fx.offers) this.offer(offer);
  }

  // One tier-up ripple: the cast nudges one frame and the props take the same beat.
  private playRipple(era: number): void {
    this.cast.ripple(era);
    this.props.ripple(era);
  }

  // Rapid clicking: the count of clicks inside rapidWindowMs reaches rapidClicksPerS per second. Offered on the rising edge.
  private trackClicks(now: number): void {
    const times = this.clickTimes;
    while (times.length > 0 && now - (times[0] ?? now) > WORLD_VOICE_CONFIG.rapidWindowMs) times.shift();
    const burst = times.length >= (WORLD_VOICE_CONFIG.rapidClicksPerS * WORLD_VOICE_CONFIG.rapidWindowMs) / 1000;
    if (burst && !this.rapidOn) this.offer({ kind: 'rapid' });
    this.rapidOn = burst;
  }

  // ---- silence, onboarding ----

  private refreshOnboarding(): void {
    const s = this.session.state;
    const techs = this.session.techs;
    const prompt = activePrompt({
      totalClicks: s.totalClicks,
      anyPurchased: anyPurchased(s.techLevels, techs),
      affordable: affordableTechIds(s, techs, this.session.maxEra).length,
      phase: s.ending.phase,
      treeOpen: this.ports.techTreeOpen(),
      cycle: this.session.prestige.cycle,
    });
    this.onboarding = prompt === 'crank' || prompt === 'hint';
  }

  // The first hard-silence reason. A silence that appears cuts every bubble (persisted at the fraction shown).
  private refreshSilence(): void {
    const s = this.session.state;
    const inputs: SilenceInputs = {
      quiet: this.quiet,
      layerHidden: currentEra(s.techLevels) > LIVING_WORLD.maxEra,
      asleep: this.asleep,
      tabHidden: this.ports.tabHidden(),
      photo: this.ports.photoActive(),
      finaleLocked: isFinaleLocked(s.ending),
      cycleBusy: this.ports.cycleBusy(),
      teaser: this.ports.teaserOn(),
      demoCard: this.ports.demoCardOpen(),
      techTree: this.ports.techTreeOpen(),
      modal: this.ports.modalOpen(),
      eraCard: this.ports.eraCardShown(),
      onboarding: this.onboarding,
    };
    const reason = silenceReason(inputs);
    this.silence = reason;
    if (reason !== null && (this.active.length > 0 || this.bubbles.visible())) {
      this.endAll(true, reason);
    }
  }

  // ---- visual state (step 5): derive on cadence, commit at once or when the gate holds ----

  private stepVisual(cadence: boolean): void {
    const revision = this.session.revision;
    if (revision !== this.lastRevision) {
      this.lastRevision = revision;
      this.dirty = true;
    }
    if (this.dirty && (this.forceApply || cadence)) {
      this.dirty = false;
      this.buildPlan();
    }
    const plan = this.wanted;
    const applied = this.applied;
    if (plan === null) return;
    if (this.forceApply || applied === null || plan.placeKey === applied.placeKey) {
      this.commit(plan);
      return;
    }
    if (!cadence) return;
    const treeOpen = this.ports.techTreeOpen();
    const view = viewRectOf(this.cam);
    const ok = unseenChangeOk({
      treeOpen,
      oldOnScreen: applied.state.visible && anyOnScreen(applied.placements, view),
      newOnScreen: plan.state.visible && anyOnScreen(plan.placements, view),
    });
    if (ok) this.commit(plan);
    else if (plan.partialKey !== applied.stateKey) this.commitPartial(plan, applied);
  }

  private buildPlan(): void {
    const s = this.session.state;
    const levels = s.techLevels;
    const world = this.session.world;
    const input: WorldStateInput = {
      levels,
      lifetimeEe: s.lifetime.ee,
      cycle: this.session.prestige.cycle,
      edition: this.edition.id,
      dogLies: this.edition.demo && world.seenEver.includes('DOG-12'),
      motorRetrofitTier: this.tier.tierOf('motorRetrofit', levels),
      phase: s.ending.phase,
    };
    const state = deriveWorldState(input);
    const pose = framingPose(levels);
    const framing = framingKeyOfPose(pose);
    this.framing = framing;
    const placements = placeCast(levels, framing, pose);
    const placeKey = JSON.stringify([state.visible, placements]);
    const stateKey = JSON.stringify(state);
    const applied = this.applied;
    if (applied !== null && stateKey === applied.stateKey) {
      this.wanted = null;
      this.forceApply = false;
      return;
    }
    const gated = applied !== null && placeKey !== applied.placeKey;
    const partialState: WorldVisualState = gated && applied !== null ? { ...state, visible: applied.state.visible } : state;
    const partialKey = partialState === state ? stateKey : JSON.stringify(partialState);
    this.wanted = { state, placements, placeKey, stateKey, partialState, partialKey };
  }

  private commit(plan: Plan): void {
    this.applied = plan;
    this.wanted = null;
    this.forceApply = false;
    this.applyVisual(plan.state, plan.placements);
  }

  // Keeps the old placements and visibility (the gate holds) and takes the rest of the new state.
  private commitPartial(plan: Plan, applied: Plan): void {
    const next: Plan = { ...applied, state: plan.partialState, stateKey: plan.partialKey };
    this.applied = next;
    this.applyVisual(next.state, next.placements);
  }

  private applyVisual(state: WorldVisualState, placements: Placements): void {
    const reducedMotion = this.session.settings.reducedMotion;
    this.cast.apply(state, placements, { reducedMotion });
    this.props.apply(state, placements, { reducedMotion });
  }

  // ---- glances (step 6): wordless turns to camera, never with a line, never near one ----

  private stepGlances(now: number, cadence: boolean): void {
    const running = this.glance;
    if (running !== null && now >= running.endAt) this.endGlance(running);
    if (this.glance !== null || this.quiet || this.asleep || this.silence !== null || this.active.length > 0) return;
    const era = currentEra(this.session.state.techLevels);
    if (era !== 1 && era !== 2) return;
    const cycle = this.session.prestige.cycle;
    const seed = WORLD_GLANCE_SEED + CYCLE_SEED_SALT * cycle;
    if (this.glanceDueAt === null) this.glanceDueAt = now + glanceSchedule(this.glanceK, seed, era).afterMs;
    if (!cadence || now < this.glanceDueAt) return;
    if (this.bubbles.visible() || now - this.bubbleEdgeMs < WORLD_VOICE_CONFIG.glanceNoBubbleNearMs) return;
    const scheduled = glanceSchedule(this.glanceK, seed, era);
    const id = this.pickGlancer(scheduled.denizen);
    if (id === null) return;
    this.startGlance(id, now);
    this.glanceK += 1;
    this.glanceDueAt = null;
  }

  // The scheduled denizen when it is on screen, else the next on-screen target in GLANCE_TARGETS order.
  private pickGlancer(first: DenizenId): GlanceId | null {
    const targets = GLANCE_TARGETS;
    const start = Math.max(0, targets.indexOf(first));
    for (let k = 0; k < targets.length; k++) {
      const denizen = targets[(start + k) % targets.length];
      if (denizen === undefined) continue;
      const id = glanceIdOf(denizen);
      if (id !== null && this.speakerOnScreen(id)) return id;
    }
    return null;
  }

  private startGlance(id: GlanceId, now: number): void {
    this.glance = { id, endAt: now + WORLD_VOICE_CONFIG.glanceHoldMs };
    if (id === 'payphone') this.props.receiverLevel(true);
    else this.cast.turnToCamera(id, 'glance');
  }

  private endGlance(glance: Glance): void {
    this.glance = null;
    if (glance.id === 'payphone') this.props.receiverLevel(false);
    else this.cast.release(glance.id, 0);
  }

  // Sensor 7 answers the sensor-null log (bible 5.5): LED double blink, head on the camera. Wordless, so it plays with voices off.
  // Held back in the same quiet and silence states as the glances.
  private sensorReply(): void {
    if (this.quiet || this.asleep || this.silence !== null) return;
    const cam = this.readCamera();
    const a = this.cast.anchor('sensor7', cam);
    if (a === null || !isOnScreen(a.head, GAME_VIEW, WORLD_VOICE_CONFIG.viewInsetPx)) return;
    this.cast.syncNow(this.scene.time.now);
    this.cast.turnToCamera('sensor7', 'glance');
  }

  // ---- cues (step 7) ----

  private startCue(cue: WorldCue): void {
    const now = this.nowMs;
    if (cue.kind === 'beat') {
      for (const id of cue.ids) this.startBeat(id);
      return;
    }
    const id = cue.ids[0];
    if (id === undefined) return;
    const chainId: ChainId | null = cue.kind === 'chainStep' ? (cue.chainId ?? null) : null;
    if (cue.kind === 'chainStep' && cue.chainId === 'crossedLines' && cue.step === 1) {
      // CROSSED LINES opens with a dial tone, then a ring, then the first line (bible 6.1).
      const pre = WORLD_VOICE_CONFIG.crossedLinesPrelude;
      this.setDial(true);
      this.later(now + pre.dialToneMs, () => {
        this.setDial(false);
        this.ring();
      }, true);
      this.startLine(id, now, pre.dialToneMs + pre.ringMs, chainId);
      return;
    }
    this.startLine(id, now, 0, chainId);
  }

  private startBeat(id: string): void {
    if (id === 'beat.tapeFreeze') {
      const ms = WORLD_VOICE_CONFIG.tapeFreezeMs;
      this.cast.tapeFreeze(ms);
      this.props.tapeFreeze(ms);
    } else if (id === 'beat.failedSync') {
      this.cast.failedSync();
    }
    this.persist(id, 1);
  }

  private startLine(id: string, nowMs: number, delayMs: number, chainId: ChainId | null): void {
    const line = LINES_BY_ID.get(id);
    if (line === undefined) throw new Error(`living world: no line '${id}'`);
    const durationMs = bubbleDurationMs(line.text);
    const tl = talkTimeline(durationMs, this.session.settings.reducedMotion);
    const startMs = nowMs + delayMs;
    this.active.push({
      id, chainId, speaker: line.speaker, text: line.text, durationMs, startMs, showAtMs: tl.bubbleShowAtMs,
      turned: false, phase: 'wait', slot: null, nextTryMs: startMs + tl.bubbleShowAtMs, hideAtMs: 0, doneAtMs: 0,
    });
    if (id === 'PAY-02') this.ringIfDue(nowMs);
  }

  private ring(): void {
    this.lastRingMs = this.nowMs;
    this.feedback.worldSound.emit({ kind: 'ring' });
    this.props.ring();
  }

  private ringIfDue(nowMs: number): void {
    if (this.lastRingMs === null || nowMs - this.lastRingMs >= WORLD_VOICE_CONFIG.ringGapMs) this.ring();
  }

  private setDial(on: boolean): void {
    if (this.dialOn === on) return;
    this.dialOn = on;
    this.feedback.worldSound.emit({ kind: 'dialTone', on });
  }

  private later(atMs: number, run: () => void, cutOff: boolean): void {
    this.delayed.push({ atMs, run, cutOff, epoch: this.epoch });
  }

  private runDue(now: number): void {
    if (this.delayed.length === 0) return;
    let any = false;
    for (const d of this.delayed) {
      if (now >= d.atMs) {
        any = true;
        break;
      }
    }
    if (!any) return;
    const due: Delayed[] = [];
    const keep: Delayed[] = [];
    for (const d of this.delayed) {
      if (now >= d.atMs) due.push(d);
      else keep.push(d);
    }
    this.delayed = keep;
    for (const d of due) {
      if (d.cutOff && d.epoch !== this.epoch) continue;
      d.run();
    }
  }

  // ---- lines (step 8) ----

  private stepLines(now: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (a === undefined) continue;
      const t = now - a.startMs;
      if (t < 0) continue;
      if (!a.turned) {
        a.turned = true;
        this.turnOn(a);
      }
      if (a.phase === 'wait') {
        if (t >= a.showAtMs && now >= a.nextTryMs) {
          a.nextTryMs = now + WORLD_VOICE_CONFIG.ladderRecheckMs;
          if (this.tryShow(a, now)) continue;
        }
        if (t >= a.showAtMs + WORLD_VOICE_CONFIG.placeWaitMs) {
          this.persist(a.id, 0, true);
          this.turnHold(a, 0);
          this.removeAt(i);
        }
        continue;
      }
      if (a.phase === 'shown' && now >= a.hideAtMs) this.hideLine(a, 1);
      if (a.phase === 'hidden' && now >= a.doneAtMs) this.removeAt(i);
    }
  }

  // A free bubble slot, or null when both are up.
  private freeSlot(): 0 | 1 | null {
    if (!this.bubbles.visible(0)) return 0;
    if (!this.bubbles.visible(1)) return 1;
    return null;
  }

  private tryShow(a: ActiveLine, now: number): boolean {
    const slot = this.freeSlot();
    if (slot === null) return false;
    const speaker = a.speaker;
    const outcome = this.bubbles.show({
      slot,
      text: a.text,
      speaker,
      anchor: () => this.anchorOf(speaker, this.cam),
    }, now);
    if (outcome !== 'shown') return false;
    a.phase = 'shown';
    a.slot = slot;
    a.hideAtMs = now + a.durationMs;
    a.doneAtMs = a.hideAtMs + WORLD_VOICE_CONFIG.turnHoldAfterMs;
    this.bubbleEdgeMs = now;
    if (isWalker(speaker)) this.cast.setTalking(speaker, true, blipCount(a.text));
    if (this.session.settings.worldVoices !== 'off') {
      this.blipEvents += 1;
      this.feedback.worldSound.emit({ kind: 'blip', speaker, count: blipCount(a.text), reversed: false });
    }
    this.view.announce(WORLD_A11Y_PREFIX[speaker], a.text);
    return true;
  }

  // The bubble comes down: the speaker is released (turnHoldAfterMs of hold), the fraction is persisted.
  private hideLine(a: ActiveLine, fraction: number): void {
    if (a.slot !== null) this.bubbles.hide(a.slot);
    a.phase = 'hidden';
    this.bubbleEdgeMs = this.nowMs;
    this.turnHold(a, WORLD_VOICE_CONFIG.turnHoldAfterMs);
    this.persist(a.id, fraction);
  }

  private removeAt(index: number): void {
    const a = this.active[index];
    if (a !== undefined) this.receiverOff(a);
    this.active.splice(index, 1);
  }

  private turnOn(a: ActiveLine): void {
    if (isWalker(a.speaker)) this.cast.turnToCamera(a.speaker, 'talk');
    else if (a.speaker === 'payphone') this.props.receiverLevel(true);
  }

  private turnHold(a: ActiveLine, holdMs: number): void {
    if (!isWalker(a.speaker)) return;
    this.cast.setTalking(a.speaker, false);
    this.cast.release(a.speaker, holdMs);
  }

  private receiverOff(a: ActiveLine): void {
    if (a.speaker === 'payphone') this.props.receiverLevel(false);
  }

  private speaking(speaker: SpeakerId): boolean {
    return this.active.some((a) => a.speaker === speaker && a.phase === 'shown');
  }

  // Every line in flight ends: bubbles go at once, speakers are released, the dial tone stops. persist writes the shown fraction
  // (a line waiting for its bubble counts 0). The scheduler run is cancelled; undelivered steps stay unseen.
  private endAll(persist: boolean, reason: string): void {
    this.epoch += 1;
    const now = this.nowMs;
    for (const a of this.active) {
      if (persist) {
        if (a.phase === 'shown' && a.slot !== null) {
          this.persist(a.id, Math.min(1, this.bubbles.visibleMs(a.slot, now) / a.durationMs));
        } else if (a.phase === 'wait') {
          this.persist(a.id, 0);
        }
      }
      if (a.phase !== 'hidden') this.turnHold(a, 0);
      this.receiverOff(a);
    }
    this.active.length = 0;
    this.bubbles.hideAll(true);
    this.setDial(false);
    this.scheduler.interrupt(reason, this.ctxNow());
  }

  private stepBubbles(now: number): void {
    const off = this.bubbles.update(now);
    for (const raw of off) {
      const slot: 0 | 1 = raw === 1 ? 1 : 0;
      const a = this.active.find((line) => line.phase === 'shown' && line.slot === slot);
      if (a === undefined) continue;
      this.hideLine(a, Math.min(1, this.bubbles.visibleMs(slot, now) / a.durationMs));
    }
  }

  // ---- persistence and offers ----

  // blocked: the bubble never came up (placeWait expired). A cut by silence is not a block.
  private persist(id: string, fraction: number, blocked = false): void {
    const next = this.scheduler.shown(id, fraction, this.ctxNow(), blocked ? { blocked: true } : undefined);
    if (next !== null) this.session.recordWorld(next);
  }

  private offer(offer: WorldOffer): void {
    this.scheduler.offer(offer, this.ctxNow());
  }

  // ---- context and geometry ----

  // The shared scheduler context, refreshed from live values. The scheduler reads it and keeps none of it.
  private ctxNow(): WorldSchedulerCtx {
    const c = this.ctx;
    const s = this.session.state;
    const now = this.nowMs;
    const v0 = this.bubbles.visible(0);
    const v1 = this.bubbles.visible(1);
    let bubbleMs = 0;
    if (v0) bubbleMs = this.bubbles.visibleMs(0, now);
    if (v1) {
      const ms1 = this.bubbles.visibleMs(1, now);
      bubbleMs = v0 ? Math.min(bubbleMs, ms1) : ms1;
    }
    c.nowMs = now;
    c.playMs = this.playMs;
    c.lastInputMs = this.lastInputMs;
    c.era = currentEra(s.techLevels);
    c.cycle = this.session.prestige.cycle;
    c.edition = this.edition.id;
    c.setting = this.session.settings.worldVoices;
    c.silence = this.silence;
    c.hasClicked = this.hasClicked;
    c.hasPurchased = this.hasPurchased;
    c.toastUp = this.toastGate.up(now);
    c.toastClearedAtMs = this.toastGate.clearedAtMs();
    c.indexClosedAtMs = this.indexClosedAtMs;
    c.bubblesVisible = (v0 ? 1 : 0) + (v1 ? 1 : 0);
    c.bubbleVisibleMs = bubbleMs;
    c.world = this.session.world;
    c.levels = s.techLevels;
    c.logsSeen = this.logsSeen;
    c.lifetimeEe = s.lifetime.ee;
    c.localHour = this.clockHour ?? new Date().getHours();
    c.chainMemberWaiting = this.chainMemberWaiting();
    return c;
  }

  // True while a chain member (CROSSED LINES, postCap) has not shown its bubble yet (prelude or placement wait).
  private chainMemberWaiting(): boolean {
    return this.active.some((a) => a.chainId !== null && a.phase === 'wait');
  }

  // The Phaser camera's view centre and zoom (the same pose the renderers frame). Written into the shared pose object.
  private readCamera(): CameraPose {
    const camera = this.scene.cameras.main;
    this.cam.centerX = camera.midPoint.x;
    this.cam.centerY = camera.midPoint.y;
    this.cam.zoom = camera.zoom;
    return this.cam;
  }

  private anchorOf(speaker: SpeakerId, cam: CameraPose): SpeakerAnchor | null {
    if (isWalker(speaker)) return this.cast.anchor(speaker, cam);
    return this.props.anchor(speaker, cam);
  }

  // Game-px boxes over the heads of the other cast members on screen (AD2 F2 / F16; DENIZEN_ART 4.2 adds the payphone head for
  // every speaker but the payphone), so a bubble does not cover them. The bubble
  // controller asks at show and at the ladder recheck only, never per frame, so the small allocation is fine.
  private reservedHeads(exclude: SpeakerId): Rect[] {
    const out: Rect[] = [];
    const layout = WORLD_LAYOUT.headReserve;
    for (const id of HEAD_RESERVE_IDS) {
      if (id === exclude) continue;
      const a = this.cast.anchor(id, this.cam);
      if (a === null || !isOnScreen(a.head, GAME_VIEW, 0)) continue;
      const pad = (id === 'inspector' ? layout.padWorldPx.inspector : layout.padWorldPx.other) * this.cam.zoom;
      out.push({ x: a.head.x - pad, y: a.head.y - layout.aboveGamePx, w: 2 * pad, h: layout.heightGamePx });
    }
    if (exclude !== 'payphone') {
      const a = this.props.anchor('payphone', this.cam);
      if (a !== null && isOnScreen(a.head, GAME_VIEW, 0)) {
        const pad = layout.padWorldPx.other * this.cam.zoom;
        out.push({ x: a.head.x - pad, y: a.head.y - layout.aboveGamePx, w: 2 * pad, h: layout.heightGamePx });
      }
    }
    return out;
  }

  // A speaker counts as on screen when its head point lies inside the view inset (game px).
  private speakerOnScreen(speaker: SpeakerId): boolean {
    const anchor = this.anchorOf(speaker, this.cam);
    return anchor !== null && isOnScreen(anchor.head, GAME_VIEW, WORLD_VOICE_CONFIG.viewInsetPx);
  }

  private refreshTimingMean(): number {
    if (this.timingCount === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.timingCount; i++) sum += this.timings[i] ?? 0;
    return sum / this.timingCount;
  }

  private recordTiming(ms: number): void {
    this.timings[this.timingNext] = ms;
    this.timingNext = (this.timingNext + 1) % TIMING_WINDOW;
    if (this.timingCount < TIMING_WINDOW) this.timingCount += 1;
  }

  // ---- debug API ----

  private buildApi(): WorldDebugApi {
    return {
      worldState: () => this.debugState(),
      worldSay: (id) => this.debugSay(id),
      worldQuiet: (on) => {
        this.quiet = on;
      },
      worldAdvance: (ms) => {
        if (!Number.isFinite(ms)) return;
        this.nowMs += ms;
        this.playMs += ms;
      },
      worldLogShown: (logId) => {
        this.onLogShown(logId);
        this.later(this.nowMs + SYSTEM_LOG_CONFIG.durationMs, () => this.onLogCleared(logId), false);
      },
      worldClock: (hour) => {
        this.clockHour = hour === null || !Number.isFinite(hour) ? null : Math.floor(hour);
      },
      livingWorld: () => (this.destroyed ? [] : [...this.cast.probe(), ...this.props.probe()]),
      worldStats: () => ({
        objects: this.cast.stats().objects + this.props.stats().objects,
        meanMs: this.refreshTimingMean(),
      }),
      worldBubble: () => this.debugBubble(),
    };
  }

  private debugSay(id: string): boolean {
    if (this.destroyed) return false;
    this.refreshOnboarding();
    this.refreshSilence();
    const cue = this.scheduler.force(id, this.ctxNow());
    if (cue === null) return false;
    this.cast.syncNow(this.scene.time.now);
    this.startCue(cue);
    return true;
  }

  private debugState(): WorldDebugState | null {
    if (this.destroyed) return null;
    const s = this.session.state;
    const world = this.session.world;
    const st = this.scheduler.state();
    const placements: Record<string, { x: number; row: string } | null> = {};
    const applied = this.applied;
    if (applied !== null) {
      for (const [key, p] of Object.entries(applied.placements)) {
        placements[key] = p === null ? null : { x: p.x, row: p.row };
      }
    }
    return {
      era: currentEra(s.techLevels),
      framing: this.framing,
      setting: this.session.settings.worldVoices,
      quiet: this.quiet,
      hidden: applied === null || !applied.state.visible,
      silence: this.silence,
      playMs: this.playMs,
      nowMs: this.nowMs,
      blips: this.blipEvents,
      seen: [...world.seen],
      seenEver: [...world.seenEver],
      eraMoments: [...world.eraMoments],
      youEras: world.youEras,
      pending: st.pending.map((p) => p.id),
      chain: st.chain,
      postCap: { active: st.postCap.active, step: st.postCap.step },
      placements,
      activeLines: this.active.map((a) => a.id),
      tierHeartbeat: this.tracker.heartbeat(),
      holeStage: applied === null ? null : applied.state.props.holeStage,
    };
  }

  private debugBubble(): { visible: boolean; rect: { x: number; y: number; w: number; h: number } | null; text: string; side: string } | null {
    if (this.destroyed) return null;
    const slot: 0 | 1 = this.bubbles.visible(0) ? 0 : 1;
    const shown = this.bubbles.visible(slot);
    return {
      visible: shown,
      rect: shown ? this.bubbles.rect(slot) : null,
      text: shown ? this.bubbles.text(slot) : '',
      side: shown ? (this.bubbles.side(slot) ?? '') : '',
    };
  }
}
