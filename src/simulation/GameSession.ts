import { MAX_UPDATE_SECONDS } from '../data/balance';
import type {
  GameState,
  OfflineReport,
  ProductionRates,
  PurchaseResult,
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
import { createInitialState } from './state';

export interface GameSessionOptions {
  state: GameState;
  /** Epoch-ms clock used when a method is called without an explicit time. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Stateful facade over the pure simulation modules. Holds the current immutable GameState
 * snapshot and its cached production rates, and emits a typed event for every change it makes.
 * Contains no timers: the host decides when to call update().
 */
export class GameSession {
  private current: GameState;
  private cachedRates: ProductionRates;
  private readonly clock: () => number;
  private readonly emitter = new TypedEmitter();

  constructor(options: GameSessionOptions) {
    this.current = options.state;
    this.clock = options.now ?? (() => Date.now());
    this.cachedRates = computeRates(options.state);
  }

  /** Current state snapshot. Never mutated in place; each change replaces the object. */
  get state(): GameState {
    return this.current;
  }

  /** Production rates for the current tech levels (cached; same object until techLevels change). */
  get rates(): ProductionRates {
    return this.cachedRates;
  }

  /** Manual click. Emits 'click', then runs the milestone check. Returns the ME gained. */
  click(): number {
    const { state, gained } = applyClick(this.current);
    this.setState(state);
    this.emitter.emit('click', { gained });
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
    this.emitter.emit('purchase', { id, level: result.newLevel, cost: result.cost });
    if (previousLevel === 0) {
      this.emitter.emit('unlock', { id });
    }
    this.checkMilestones();
    return result;
  }

  /**
   * Advances automation to `nowMs` (default: the clock). The step is clamped to
   * [0, MAX_UPDATE_SECONDS]; a clock that went backwards credits nothing. lastSimTime always
   * moves to `nowMs`. A non-finite time is ignored entirely.
   */
  update(nowMs?: number): void {
    const t = nowMs ?? this.clock();
    if (!Number.isFinite(t)) return;

    const raw = (t - this.current.lastSimTime) / 1000;
    const dt = raw > 0 ? Math.min(raw, MAX_UPDATE_SECONDS) : 0;
    const advanced = advance(this.current, dt);
    this.setState({ ...advanced, lastSimTime: t });
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

  /** Starts a fresh game at `nowMs` (default: the clock) and emits 'reset'. */
  reset(nowMs?: number): void {
    const t = nowMs ?? this.clock();
    this.setState(createInitialState(t));
    this.emitter.emit('reset', {});
  }

  /** Subscribes to a session event. Returns an unsubscribe function. */
  on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void {
    return this.emitter.on(type, fn);
  }

  /** Replaces the state snapshot. Rates are recomputed only when the techLevels object changed. */
  private setState(next: GameState): void {
    if (next.techLevels !== this.current.techLevels) {
      this.cachedRates = computeRates(next);
    }
    this.current = next;
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
