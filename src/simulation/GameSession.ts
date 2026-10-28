import { MAX_UPDATE_SECONDS, OFFLINE_REPORT_THRESHOLD_SECONDS } from '../data/balance';
import { FAULTS } from '../data/faults';
import { DEFAULT_SETTINGS_VALUES } from '../data/settings';
import { TECHNOLOGIES } from '../data/technologies';
import { TECH_IDS } from '../data/types';
import type {
  AchievementsState,
  GameState,
  OfflineReport,
  PrestigeState,
  ProductionRates,
  PurchaseResult,
  ResourceMap,
  SettingsState,
  StatsState,
  TechDefinition,
  TechId,
  TechView,
} from '../data/types';
import type { PerkId } from '../data/prestige';
import { TypedEmitter } from './events';
import type { Listener, SessionEvents } from './events';
import { ACHIEVEMENT_LIST } from '../data/achievements';
import { evaluateAchievements } from './achievements';
import { computeRates } from './production/rates';
import { advance, applyClick, applyOffline as applyOfflineState } from './production/tick';
import { refillWindup, releaseWindup, windupParams } from './production/windup';
import type { WindupParams } from './production/windup';
import { clearFault as clearFaultClock, consumeOverdrive, createFaultClock, faultParams, stepFaultClock } from './faults';
import type { FaultAlive, FaultClock, FaultParams } from './faults';
import { addMaps } from './resources';
import { evaluateMilestones } from './progression/milestones';
import { clampStateToEra } from './progression/edition';
import type { EraCap } from './progression/edition';
import { advanceEnding, isRevealed, startEnding } from './progression/ending';
import { purchase as purchaseTech } from './progression/purchase';
import { getAllTechViews, getTechView } from './progression/status';
import { createInitialState } from './state';
import { normalizeSettings } from './settings';
import { addLifetimeDelta, bumpMaxRates, deriveStats, emptyStats } from './stats';
import {
  DEFAULT_PRESTIGE,
  applyStartLevels,
  buyPerk as buyPerkPure,
  cycleTechs,
  echoesForCycle,
  newCycleState,
  normalizePrestige,
} from './prestige';
import type { BuyPerkResult } from './prestige';
import type { WorldSaveState } from '../data/livingWorld';
import { normalizeWorld } from './worldSave';

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS_VALUES) as (keyof SettingsState)[];

/** Read-only view of a GameState, including its techLevels record and resource maps. */
export type ReadonlyGameState = Readonly<Omit<GameState, 'techLevels' | 'res' | 'lifetime'>> & {
  readonly techLevels: Readonly<Record<TechId, number>>;
  readonly res: Readonly<ResourceMap>;
  readonly lifetime: Readonly<ResourceMap>;
};

export interface GameSessionOptions {
  state: GameState;
  /** Settings to start with, normalized leniently. Defaults to the default settings. */
  settings?: Partial<SettingsState>;
  /** Lifetime statistics to start with. Defaults to deriveStats(state, now). */
  stats?: StatsState;
  /** Achievements unlocked so far. Defaults to none. */
  achievements?: AchievementsState;
  /** New-cycle prestige (WP14). Normalized leniently. Defaults to DEFAULT_PRESTIGE. */
  prestige?: PrestigeState;
  /** Living-world save block (WP23a), normalized leniently. Defaults to the fresh default block. */
  world?: WorldSaveState;
  /** Epoch-ms clock used when a method is called without an explicit time. Defaults to Date.now. */
  now?: () => number;
  /** WP21: era cap of the demo edition. Absent/null = full game. */
  maxEra?: EraCap;
  /** WP27: seed of the Machine Faults clock. Defaults to the clock in ms as an unsigned 32-bit int; tests inject one. */
  faultSeed?: number;
}

/**
 * Stateful facade over the pure simulation modules. Holds the current immutable GameState
 * snapshot, its cached production rates, the settings, the lifetime stats and the achievements,
 * and emits a typed event for every change it makes. Contains no timers: the host decides when
 * to call update().
 *
 * Transient machine state (WP27, not saved; SAVE_VERSION stays 2): the wind-up store (seconds of
 * output that the next manual click releases; it refills in update() and across an offline span
 * on load) and the Machine Faults clock (one per run; it moves only through stepFaults, never
 * offline, and a fresh session waits 180 eligible seconds before its first fault).
 *
 * Host lifecycle (required order):
 *  1. Load the save (SaveManager.load) to obtain state, settings, stats and achievements.
 *  2. `new GameSession({ state, settings, stats, achievements })`. The constructor credits no time,
 *     emits no events and evaluates no achievements.
 *  3. `applyOffline()` once, so offline progress is reported before the first frame.
 *     update() applies it automatically if the host omits this call.
 *  4. Start the loop: call update() each frame, and click()/purchase()/updateSettings() from input.
 *
 * Rendering: the constructor and reset() emit no 'unlock' events for techs that are already owned.
 * Renderers must build their initial visuals from `session.state.techLevels` and rebuild everything
 * when the 'reset' event fires.
 *
 * reset() starts a fresh game but does NOT clear storage: the host must call SaveManager.reset()
 * or save afterwards. Settings survive reset(); stats, achievements, prestige and the living-world block do not.
 * beginNewCycle() (WP14) is the in-game replay: it keeps settings, stats, achievements and prestige.
 * Its living-world block keeps only seenEver (WP23a).
 *
 * `state`, `rates`, `settings`, `stats` and `achievements` are immutable snapshots: never mutate
 * them. Each change replaces the object. Compare `revision` between frames to skip re-rendering
 * when nothing changed.
 *
 * Demo edition (WP21): with `maxEra`, the session never owns a tech of era > maxEra. The constructor
 * clamps the given state; purchases, perks and new cycles keep the cap, and milestones above it never
 * unlock. Save loading clamps too (persistence), so this only guards the in-memory state.
 */
export class GameSession {
  private current: GameState;
  private cachedRates: ProductionRates;
  private currentSettings: SettingsState;
  private currentStats: StatsState;
  private currentAchievements: AchievementsState;
  private currentPrestige: PrestigeState;
  private currentWorld: WorldSaveState;
  private currentWorldRevision = 0;
  private cachedTechs: Record<TechId, TechDefinition>;
  private currentRevision = 0;
  private offlineApplied = false;
  // WP27 transient machine state (never saved). Params follow the tech levels; see setState.
  private windupStored = 0;
  private windupParams: WindupParams;
  private faultParams: FaultParams;
  private faultClock: FaultClock;
  private readonly clock: () => number;
  private readonly capEra: EraCap;
  private readonly emitter = new TypedEmitter();

  constructor(options: GameSessionOptions) {
    this.capEra = options.maxEra ?? null;
    this.current = clampStateToEra(options.state, this.capEra).state;
    this.currentSettings = normalizeSettings(options.settings ?? {});
    this.clock = options.now ?? (() => Date.now());
    this.currentPrestige = normalizePrestige(options.prestige ?? DEFAULT_PRESTIGE);
    this.cachedTechs = cycleTechs(TECHNOLOGIES, this.currentPrestige);
    this.cachedRates = computeRates(this.current, this.cachedTechs);
    this.windupParams = windupParams(this.current.techLevels, this.cachedTechs);
    this.faultParams = faultParams(this.current.techLevels, this.cachedTechs);
    this.faultClock = createFaultClock(options.faultSeed ?? (Math.floor(this.clock()) >>> 0));
    this.currentStats = {
      ...bumpMaxRates(options.stats ?? deriveStats(this.current, this.clock()), this.cachedRates.perSecond),
      cycles: this.currentPrestige.cycle,
    };
    this.currentAchievements = options.achievements ?? { unlocked: {} };
    this.currentWorld = normalizeWorld(options.world);
  }

  /** Current state snapshot. Never mutated in place; each change replaces the object. */
  get state(): ReadonlyGameState {
    return this.current;
  }

  /** Production rates for the current tech levels (cached; same object until techLevels change). */
  get rates(): Readonly<ProductionRates> {
    return this.cachedRates;
  }

  /** Current settings snapshot. Never mutated in place; each change replaces the object. */
  get settings(): Readonly<SettingsState> {
    return this.currentSettings;
  }

  /** Lifetime statistics snapshot. Never mutated in place; each change replaces the object. */
  get stats(): Readonly<StatsState> {
    return this.currentStats;
  }

  /** Unlocked achievements (id -> epoch ms). Never mutated in place; each change replaces the object. */
  get achievements(): Readonly<AchievementsState> {
    return this.currentAchievements;
  }

  /** New-cycle prestige (WP14). Never mutated in place; each change replaces the object. */
  get prestige(): Readonly<PrestigeState> {
    return this.currentPrestige;
  }

  /** Living-world save block (WP23a). Never mutated in place; recordWorld and the cycle / reset paths replace it. */
  get world(): Readonly<WorldSaveState> {
    return this.currentWorld;
  }

  /** Counter bumped whenever the living-world block is replaced (recordWorld, new cycle, reset). Never decreases. */
  get worldRevision(): number {
    return this.currentWorldRevision;
  }

  /** Tech table for the current prestige (cycleTechs of TECHNOLOGIES; cached, replaced on prestige change only). */
  get techs(): Readonly<Record<TechId, TechDefinition>> {
    return this.cachedTechs;
  }

  /** Era cap of the edition (WP21 demo); null = full game. Fixed at construction. */
  get maxEra(): EraCap {
    return this.capEra;
  }

  /**
   * Counter bumped on every change to state or settings. Equal values between two reads mean
   * nothing observable changed, so a UI may skip re-rendering. Never decreases.
   */
  get revision(): number {
    return this.currentRevision;
  }

  /** Wind-up (WP27): stored seconds of output, capacity and refill (seconds per second). Transient, not saved. */
  get windup(): Readonly<{ stored: number; cap: number; refill: number }> {
    return { stored: this.windupStored, cap: this.windupParams.cap, refill: this.windupParams.refill };
  }

  /**
   * Machine Faults (WP27): the clock's public numbers. Transient, not saved. overdriveFactor and payoutSeconds
   * come from the owned fault techs. alive is the clock's own object, not a copy: the clock replaces it on every
   * change and never mutates it, so the snapshot stays stable. Per-frame readers use faultAlive (no snapshot).
   */
  get faults(): Readonly<{
    unlocked: boolean; alive: FaultAlive | null; nextIn: number | null; overdriveLeft: number;
    overdriveFactor: number; payoutSeconds: number; spawned: number; caught: number; missed: number;
  }> {
    const c = this.faultClock;
    return {
      unlocked: this.faultParams.unlocked,
      alive: c.alive,
      nextIn: c.nextIn,
      overdriveLeft: c.overdriveLeft,
      overdriveFactor: this.faultParams.overdriveFactor,
      payoutSeconds: this.faultParams.payoutSeconds,
      spawned: c.spawned,
      caught: c.caught,
      missed: c.missed,
    };
  }

  /**
   * Machine Faults (WP27): the live fault, or null. The same object comes back on every read until the next
   * stepFaults, clearFault or reset (the clock replaces it, never mutates it), so a per-frame reader allocates nothing.
   */
  get faultAlive(): Readonly<FaultAlive> | null {
    return this.faultClock.alive;
  }

  /**
   * Manual click. A plain click first (applyClick). When wind-up is stored, the same click then releases it as a
   * second state step (releaseWindup); the two gains are summed only for the event and the return value. Emits ONE
   * 'click' (gained = ME of both steps, gainedAll = every resource of both, released = wind-up seconds, absent when
   * nothing was stored). Then the milestone check and the achievement check. Returns the ME gained.
   */
  click(): number {
    const plain = applyClick(this.current, this.cachedTechs);
    this.setState(plain.state);
    let gainedAll = plain.gainedAll;
    let released = 0;
    if (this.windupStored > 0) {
      // Only a manual click gets here: servo auto-cranks fold into the rates (C5) and never release the store.
      const release = releaseWindup(this.current, this.windupStored, this.windupParams, this.cachedRates.perSecond);
      released = release.released;
      if (released > 0) {
        this.setState(release.state);
        gainedAll = addMaps(plain.gainedAll, release.gained);
      }
      this.windupStored = 0;
    }
    const gained = gainedAll.me;
    this.patchStats({ clicks: this.currentStats.clicks + 1 });
    this.emitter.emit('click', released > 0 ? { gained, gainedAll, released } : { gained, gainedAll });
    this.checkMilestones();
    this.checkAchievements();
    return gained;
  }

  /**
   * Buys one level of a technology. On failure nothing changes and no events fire.
   * On success emits 'purchase', then 'unlock' if the tech was at level 0, then runs the milestone
   * check and the achievement check, and last starts the finale (emits 'ending' with phase
   * 'sequence') when an ending tech has just been bought.
   */
  purchase(id: TechId): PurchaseResult {
    const result = purchaseTech(this.current, id, this.cachedTechs, this.capEra);
    if (!result.ok) return result;

    const previousLevel = this.current.techLevels[id];
    this.setState(result.state);
    this.patchStats({ purchases: this.currentStats.purchases + 1 });
    this.emitter.emit('purchase', {
      id,
      level: result.newLevel,
      cost: result.cost,
      res: this.cachedTechs[id].costRes,
    });
    if (previousLevel === 0) {
      this.emitter.emit('unlock', { id });
    }
    this.checkMilestones();
    this.checkAchievements();
    this.checkEnding();
    return result;
  }

  /**
   * Advances automation to `nowMs` (default: the clock).
   *
   * If offline progress has not been applied yet, or the gap since lastSimTime is longer than
   * OFFLINE_REPORT_THRESHOLD_SECONDS, the call is delegated to applyOffline() so the gap is
   * credited (capped) and reported rather than silently advanced. Otherwise the step is
   * clamped to [0, MAX_UPDATE_SECONDS]; a clock that went backwards credits nothing.
   * lastSimTime always moves to `nowMs`. A non-finite time is ignored entirely.
   * A call with no elapsed time changes nothing.
   */
  update(nowMs?: number): void {
    const t = nowMs ?? this.clock();
    if (!Number.isFinite(t)) return;

    const elapsed = (t - this.current.lastSimTime) / 1000;
    if (!this.offlineApplied || elapsed > OFFLINE_REPORT_THRESHOLD_SECONDS) {
      this.applyOffline(t);
      return;
    }

    const dt = elapsed > 0 ? Math.min(elapsed, MAX_UPDATE_SECONDS) : 0;
    if (dt > 0 || t !== this.current.lastSimTime) {
      let extraSeconds = 0;
      if (dt > 0) {
        // Overdrive (WP27) adds its extra output seconds to this step; the wind-up refills by the step.
        const od = consumeOverdrive(this.faultClock, this.faultParams, dt);
        this.faultClock = od.clock;
        extraSeconds = od.extraSeconds;
        this.windupStored = refillWindup(this.windupStored, this.windupParams, dt);
      }
      const advanced = advance(this.current, dt + extraSeconds, this.cachedTechs);
      this.setState({ ...advanced, lastSimTime: t });
      if (dt > 0) this.patchStats({ activeSeconds: this.currentStats.activeSeconds + dt });
    }
    this.checkMilestones();
    this.checkAchievements();
  }

  /**
   * Credits automation progress since lastSimTime, capped by the offline limit, and moves
   * lastSimTime to `nowMs`. Call once after loading. Always emits 'offline' (even when gained is 0).
   * A non-finite time credits nothing and keeps lastSimTime.
   * Stats: offlineSeconds grows by the capped seconds, longestOfflineSeconds keeps the longest elapsed gap.
   */
  applyOffline(nowMs?: number): OfflineReport {
    const t = nowMs ?? this.clock();
    const at = Number.isFinite(t) ? t : this.current.lastSimTime;
    const { state, report } = applyOfflineState(this.current, at, this.cachedTechs);
    this.offlineApplied = true;
    // The wind-up refills over the offline span; the fault clock never moves offline (WP27).
    this.windupStored = refillWindup(this.windupStored, this.windupParams, report.cappedSeconds);
    this.setState(state);
    this.patchStats({
      offlineSeconds: this.currentStats.offlineSeconds + report.cappedSeconds,
      longestOfflineSeconds: Math.max(this.currentStats.longestOfflineSeconds, report.elapsedSeconds),
    });
    this.emitter.emit('offline', report);
    this.checkMilestones();
    this.checkAchievements();
    return report;
  }

  /** View model of one technology for the current state. */
  getTechView(id: TechId): TechView {
    return getTechView(this.current, id, this.cachedTechs, this.capEra);
  }

  /** View models of every technology, in TECH_LIST order. */
  getAllTechViews(): TechView[] {
    return getAllTechViews(this.current, this.cachedTechs, this.capEra);
  }

  /**
   * Starts a fresh game at `nowMs` (default: the clock) and emits 'reset'. Settings are kept;
   * stats restart from zero, achievements are cleared and prestige returns to DEFAULT_PRESTIGE.
   * Storage is not touched; see the class comment.
   */
  reset(nowMs?: number): void {
    const t = nowMs ?? this.clock();
    this.applyPrestige(DEFAULT_PRESTIGE);
    this.offlineApplied = true; // a fresh state has no offline progress to award
    this.resetMachineState();
    this.setState(createInitialState(t), true);
    this.currentWorld = normalizeWorld(undefined);
    this.currentWorldRevision += 1;
    this.currentStats = bumpMaxRates(emptyStats(t), this.cachedRates.perSecond);
    this.currentAchievements = { unlocked: {} };
    this.emitter.emit('reset', {});
  }

  /**
   * New cycle (WP14), only from a revealed run (isRevealed). Grants Echoes from this run's lifetime xf,
   * bumps the cycle, and starts a fresh run with the owned perks' start levels. Keeps settings, stats
   * (cumulative counters, max rates, achievements) and prestige. Returns false with no events otherwise.
   * Emits 'reset' (renderers rebuild), then 'cycle', then runs the achievement check.
   */
  beginNewCycle(nowMs?: number): boolean {
    if (!isRevealed(this.current.ending)) return false;
    const t = nowMs ?? this.clock();
    const gained = echoesForCycle(this.current.lifetime.xf);
    const next: PrestigeState = {
      cycle: this.currentPrestige.cycle + 1,
      echoesEarned: this.currentPrestige.echoesEarned + gained,
      perks: this.currentPrestige.perks,
    };
    const cycleSeconds = this.cycleSeconds();
    const best = this.currentStats.bestCycleSeconds;
    const bestCycleSeconds =
      cycleSeconds === null ? best : best === null ? cycleSeconds : Math.min(best, cycleSeconds);

    this.applyPrestige(next);
    this.offlineApplied = true; // the fresh run has no offline progress to award
    this.resetMachineState();
    this.setState(clampStateToEra(newCycleState(t, next), this.capEra).state, true);
    // Living world (WP23a): a new cycle keeps only seenEver; seen, eraMoments and youEras restart.
    this.currentWorld = { ...normalizeWorld(undefined), seenEver: [...this.currentWorld.seenEver] };
    this.currentWorldRevision += 1;
    this.patchStats({ cycles: next.cycle, bestCycleSeconds });
    this.emitter.emit('reset', {});
    this.emitter.emit('cycle', { cycle: next.cycle, echoesGained: gained, echoesEarned: next.echoesEarned });
    this.checkAchievements();
    return true;
  }

  /**
   * Buys one Memory perk (WP14). On success: start levels are applied (emits 'unlock' per tech that
   * went 0 -> 1), the tech table and rates are recomputed, the revision bumps, then 'prestige' is
   * emitted and the achievement check runs. On failure nothing changes and no events fire.
   */
  buyPerk(id: PerkId): BuyPerkResult {
    const result = buyPerkPure(this.currentPrestige, id);
    if (!result.ok) return result;

    const previousLevels = this.current.techLevels;
    this.applyPrestige(result.prestige);
    const next = clampStateToEra(applyStartLevels(this.current, result.prestige), this.capEra).state;
    this.setState(next, true);
    for (const techId of TECH_IDS) {
      if (previousLevels[techId] === 0 && next.techLevels[techId] > 0) {
        this.emitter.emit('unlock', { id: techId });
      }
    }
    this.emitter.emit('prestige', { prestige: result.prestige });
    this.checkAchievements();
    return result;
  }

  /**
   * Finale: sequence -> choice (the cinematic has run its course or was skipped). Emits 'ending'
   * with phase 'choice'. Returns false and emits nothing when the phase is not 'sequence'.
   */
  finishEndingSequence(): boolean {
    return this.stepEnding('choice');
  }

  /**
   * Finale: choice -> postgame ([KEEP IT RUNNING]). Emits 'ending' with phase 'postgame'.
   * Returns false and emits nothing when the phase is not 'choice'.
   */
  keepRunning(): boolean {
    return this.stepEnding('postgame');
  }

  /** Sets the muted flag. Same as updateSettings({ muted }). */
  setMuted(muted: boolean): void {
    this.updateSettings({ muted });
  }

  /**
   * Applies a partial settings change. The patch is normalized (volumes clamped and rounded, unknown
   * values fall back to the current ones). No-op when every field is unchanged; otherwise replaces the
   * settings object, bumps the revision and emits 'settings' once.
   */
  updateSettings(patch: Partial<SettingsState>): void {
    const current = this.currentSettings;
    const next = normalizeSettings({ ...current, ...patch }, current);
    if (SETTINGS_KEYS.every((key) => next[key] === current[key])) return;
    this.currentSettings = next;
    this.currentRevision += 1;
    this.emitter.emit('settings', this.currentSettings);
  }

  /**
   * Stores the living-world block (WP23a) as a normalized copy. Emits nothing, does not bump `revision` and
   * triggers no save: the director persists on its own schedule and the next save writes it.
   */
  recordWorld(next: WorldSaveState): void {
    this.currentWorld = normalizeWorld(next);
    this.currentWorldRevision += 1;
  }

  /**
   * Machine Faults clock (WP27), called by the host once per frame. `eligible` is the host's "visible and
   * interactive" test: when false nothing changes. dt is clamped to FAULTS.maxStepS first, so one long frame can
   * neither age a fault out nor skip the countdown. Emits 'fault' (spawn or expire) and bumps the revision only
   * when something happened.
   */
  stepFaults(dtSeconds: number, eligible: boolean): void {
    const dt = Number.isFinite(dtSeconds) ? Math.min(dtSeconds, FAULTS.maxStepS) : dtSeconds;
    const aliveBefore = this.faultClock.alive;
    const r = stepFaultClock(this.faultClock, this.faultParams, dt, eligible);
    this.faultClock = r.clock;
    if (r.event === null) return;
    // A spawn reports the new fault; an expire reports the fault that was alive before this step.
    const fault = r.event === 'spawn' ? r.clock.alive : aliveBefore;
    if (fault === null) return;
    this.currentRevision += 1;
    this.emitter.emit('fault', { kind: r.event, serial: fault.serial, payout: null, overdriveSeconds: 0 });
  }

  /**
   * Clears the live fault (WP27): pays payoutSeconds of every energy with a rate, starts Overdrive when the owned
   * techs grant it, and emits 'fault' (clear). The payout goes through setState (res and lifetime), then the
   * milestone and achievement checks run. Returns the payout, or null with no events when no fault is alive.
   */
  clearFault(): ResourceMap | null {
    const alive = this.faultClock.alive;
    const r = clearFaultClock(this.faultClock, this.faultParams, this.cachedRates.perSecond);
    if (alive === null || r === null) return null;
    this.faultClock = r.clock;
    this.setState({
      ...this.current,
      res: addMaps(this.current.res, r.payout),
      lifetime: addMaps(this.current.lifetime, r.payout),
    });
    this.emitter.emit('fault', {
      kind: 'clear',
      serial: alive.serial,
      payout: r.payout,
      overdriveSeconds: this.faultParams.overdriveSeconds,
    });
    this.checkMilestones();
    this.checkAchievements();
    return r.payout;
  }

  /**
   * Debug hook only (C11, the window.__wedtmd smoke hook; the game never calls it): makes the next eligible
   * stepFaults spawn a fault, even before the 180 s first-fault wait. False and no change when the Fault Lamp is
   * not owned or a fault is already alive.
   */
  debugForceFault(): boolean {
    if (!this.faultParams.unlocked || this.faultClock.alive !== null) return false;
    this.faultClock = { ...this.faultClock, nextIn: 0 };
    return true;
  }

  /** Subscribes to a session event. Returns an unsubscribe function. */
  on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void {
    return this.emitter.on(type, fn);
  }

  /**
   * Replaces the state snapshot and bumps the revision. Rates are recomputed when the techLevels
   * object changed or `ratesChanged` is set (the tech table changed). Lifetime stats gain the positive
   * lifetime growth of this step; max rates are raised whenever the rates are recomputed. The wind-up and
   * fault params follow the same condition; a shrinking wind-up cap clamps the stored seconds.
   */
  private setState(next: GameState, ratesChanged = false): void {
    this.currentStats = addLifetimeDelta(this.currentStats, this.current.lifetime, next.lifetime);
    if (ratesChanged || next.techLevels !== this.current.techLevels) {
      this.cachedRates = computeRates(next, this.cachedTechs);
      this.currentStats = bumpMaxRates(this.currentStats, this.cachedRates.perSecond);
      this.windupParams = windupParams(next.techLevels, this.cachedTechs);
      this.faultParams = faultParams(next.techLevels, this.cachedTechs);
      this.windupStored = Math.min(this.windupStored, this.windupParams.cap);
    }
    this.current = next;
    this.currentRevision += 1;
  }

  /** WP27: a fresh run starts with an empty wind-up and a fresh fault clock, seeded from the old clock's rng. */
  private resetMachineState(): void {
    this.windupStored = 0;
    this.faultClock = createFaultClock(this.faultClock.rng);
  }

  /** Replaces the prestige and rebuilds the cached tech table. Callers recompute rates via setState(_, true). */
  private applyPrestige(next: PrestigeState): void {
    this.currentPrestige = next;
    this.cachedTechs = cycleTechs(TECHNOLOGIES, next);
  }

  /** Seconds from creation to the ending purchase for this run, or null when unknown. */
  private cycleSeconds(): number | null {
    const { engagedAt } = this.current.ending;
    if (engagedAt === null) return null;
    const seconds = (engagedAt - this.current.createdAt) / 1000;
    return Number.isFinite(seconds) ? seconds : null;
  }

  /** Replaces the stats snapshot with a copy that has the given fields changed. No revision bump. */
  private patchStats(patch: Partial<StatsState>): void {
    this.currentStats = { ...this.currentStats, ...patch };
  }

  /**
   * Unlocks any milestones whose requirements are now met. For each one, emits 'unlock'
   * followed by 'milestone'.
   */
  private checkMilestones(): void {
    const { state, unlocked } = evaluateMilestones(this.current, this.cachedTechs, this.capEra);
    if (unlocked.length === 0) return;
    this.setState(state);
    for (const id of unlocked) {
      this.emitter.emit('unlock', { id });
      this.emitter.emit('milestone', { id });
    }
  }

  /** Starts the finale when an ending tech was just bought. Emits 'ending' { phase: 'sequence' } once. */
  private checkEnding(): void {
    const next = startEnding(this.current);
    if (next === this.current) return;
    this.setState(next);
    this.emitter.emit('ending', { phase: next.ending.phase });
  }

  /** Applies one legal ending step; emits 'ending' only when the step happened. */
  private stepEnding(to: 'choice' | 'postgame'): boolean {
    const next = advanceEnding(this.current, to);
    if (next === this.current) return false;
    this.setState(next);
    this.emitter.emit('ending', { phase: next.ending.phase });
    return true;
  }

  /**
   * Unlocks every achievement whose condition now holds. Emits one 'achievement' event listing the
   * new ids (in list order) when at least one unlocked; nothing otherwise. Runs last in every step.
   */
  private checkAchievements(): void {
    const result = evaluateAchievements(
      this.current,
      this.currentStats,
      this.currentAchievements,
      this.clock(),
      ACHIEVEMENT_LIST,
      this.currentPrestige,
    );
    if (result.unlocked.length === 0) return;
    this.currentAchievements = result.achievements;
    this.currentRevision += 1;
    this.emitter.emit('achievement', { ids: result.unlocked });
  }
}
