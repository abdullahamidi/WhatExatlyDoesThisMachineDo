import { MAX_UPDATE_SECONDS, OFFLINE_REPORT_THRESHOLD_SECONDS } from '../data/balance';
import { TECHNOLOGIES } from '../data/technologies';
import type {
  GameState,
  OfflineReport,
  ProductionRates,
  PurchaseResult,
  ResourceMap,
  SettingsState,
  TechId,
  TechView,
} from '../data/types';
import { TypedEmitter } from './events';
import type { Listener, SessionEvents } from './events';
import { computeRates } from './production/rates';
import { advance, applyClick, applyOffline as applyOfflineState } from './production/tick';
import { evaluateMilestones } from './progression/milestones';
import { purchase as purchaseTech } from './progression/purchase';
import { getAllTechViews, getTechView } from './progression/status';
import { DEFAULT_SETTINGS, createInitialState } from './state';

/** Read-only view of a GameState, including its techLevels record and resource maps. */
export type ReadonlyGameState = Readonly<Omit<GameState, 'techLevels' | 'res' | 'lifetime'>> & {
  readonly techLevels: Readonly<Record<TechId, number>>;
  readonly res: Readonly<ResourceMap>;
  readonly lifetime: Readonly<ResourceMap>;
};

export interface GameSessionOptions {
  state: GameState;
  /** Settings to start with. Defaults to a copy of DEFAULT_SETTINGS. */
  settings?: SettingsState;
  /** Epoch-ms clock used when a method is called without an explicit time. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Stateful facade over the pure simulation modules. Holds the current immutable GameState
 * snapshot, its cached production rates and the settings, and emits a typed event for every
 * change it makes. Contains no timers: the host decides when to call update().
 *
 * Host lifecycle (required order):
 *  1. Load the save (SaveManager.load) to obtain state and settings.
 *  2. `new GameSession({ state, settings })`. The constructor credits no time and emits no events.
 *  3. `applyOffline()` once, so offline progress is reported before the first frame.
 *     update() applies it automatically if the host omits this call.
 *  4. Start the loop: call update() each frame, and click()/purchase()/setMuted() from input.
 *
 * Rendering: the constructor and reset() emit no 'unlock' events for techs that are already owned.
 * Renderers must build their initial visuals from `session.state.techLevels` and rebuild everything
 * when the 'reset' event fires.
 *
 * reset() starts a fresh game but does NOT clear storage: the host must call SaveManager.reset()
 * or save afterwards. Settings survive reset().
 *
 * `state`, `rates` and `settings` are immutable snapshots: never mutate them. Each change replaces
 * the object. Compare `revision` between frames to skip re-rendering when nothing changed.
 */
export class GameSession {
  private current: GameState;
  private cachedRates: ProductionRates;
  private currentSettings: SettingsState;
  private currentRevision = 0;
  private offlineApplied = false;
  private readonly clock: () => number;
  private readonly emitter = new TypedEmitter();

  constructor(options: GameSessionOptions) {
    this.current = options.state;
    this.currentSettings = { ...(options.settings ?? DEFAULT_SETTINGS) };
    this.clock = options.now ?? (() => Date.now());
    this.cachedRates = computeRates(options.state);
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

  /**
   * Counter bumped on every change to state or settings. Equal values between two reads mean
   * nothing observable changed, so a UI may skip re-rendering. Never decreases.
   */
  get revision(): number {
    return this.currentRevision;
  }

  /**
   * Manual click. Emits 'click' (ME gained plus every resource gained), then runs the milestone
   * check. Returns the ME gained.
   */
  click(): number {
    const { state, gained, gainedAll } = applyClick(this.current);
    this.setState(state);
    this.emitter.emit('click', { gained, gainedAll });
    this.checkMilestones();
    return gained;
  }

  /**
   * Buys one level of a technology. On failure nothing changes and no events fire.
   * On success emits 'purchase', then 'unlock' if the tech was at level 0, then runs the milestone check.
   */
  purchase(id: TechId): PurchaseResult {
    const result = purchaseTech(this.current, id);
    if (!result.ok) return result;

    const previousLevel = this.current.techLevels[id];
    this.setState(result.state);
    this.emitter.emit('purchase', {
      id,
      level: result.newLevel,
      cost: result.cost,
      res: TECHNOLOGIES[id].costRes,
    });
    if (previousLevel === 0) {
      this.emitter.emit('unlock', { id });
    }
    this.checkMilestones();
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
      const advanced = advance(this.current, dt);
      this.setState({ ...advanced, lastSimTime: t });
    }
    this.checkMilestones();
  }

  /**
   * Credits automation progress since lastSimTime, capped by the offline limit, and moves
   * lastSimTime to `nowMs`. Call once after loading. Always emits 'offline' (even when gained is 0).
   * A non-finite time credits nothing and keeps lastSimTime.
   */
  applyOffline(nowMs?: number): OfflineReport {
    const t = nowMs ?? this.clock();
    const at = Number.isFinite(t) ? t : this.current.lastSimTime;
    const { state, report } = applyOfflineState(this.current, at);
    this.offlineApplied = true;
    this.setState(state);
    this.emitter.emit('offline', report);
    this.checkMilestones();
    return report;
  }

  /** View model of one technology for the current state. */
  getTechView(id: TechId): TechView {
    return getTechView(this.current, id);
  }

  /** View models of every technology, in TECH_LIST order. */
  getAllTechViews(): TechView[] {
    return getAllTechViews(this.current);
  }

  /**
   * Starts a fresh game at `nowMs` (default: the clock) and emits 'reset'. Settings are kept.
   * Storage is not touched; see the class comment.
   */
  reset(nowMs?: number): void {
    const t = nowMs ?? this.clock();
    this.offlineApplied = true; // a fresh state has no offline progress to award
    this.setState(createInitialState(t));
    this.emitter.emit('reset', {});
  }

  /**
   * Sets the muted flag. No-op when unchanged; otherwise bumps the revision and emits 'settings'.
   */
  setMuted(muted: boolean): void {
    if (this.currentSettings.muted === muted) return;
    this.currentSettings = { ...this.currentSettings, muted };
    this.currentRevision += 1;
    this.emitter.emit('settings', this.currentSettings);
  }

  /** Subscribes to a session event. Returns an unsubscribe function. */
  on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void {
    return this.emitter.on(type, fn);
  }

  /**
   * Replaces the state snapshot and bumps the revision. Rates are recomputed only when the
   * techLevels object changed.
   */
  private setState(next: GameState): void {
    if (next.techLevels !== this.current.techLevels) {
      this.cachedRates = computeRates(next);
    }
    this.current = next;
    this.currentRevision += 1;
  }

  /**
   * Unlocks any milestones whose requirements are now met. For each one, emits 'unlock'
   * followed by 'milestone'.
   */
  private checkMilestones(): void {
    const { state, unlocked } = evaluateMilestones(this.current);
    if (unlocked.length === 0) return;
    this.setState(state);
    for (const id of unlocked) {
      this.emitter.emit('unlock', { id });
      this.emitter.emit('milestone', { id });
    }
  }
}
