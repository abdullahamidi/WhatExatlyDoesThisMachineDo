import type { AchievementId } from '../data/achievements';
import type { OfflineReport, ResourceId, ResourceMap, SettingsState, TechId } from '../data/types';

/** Payloads of every event a GameSession emits. */
export interface SessionEvents {
  click: { gained: number; gainedAll: ResourceMap };  // gained = ME; gainedAll = every resource
  purchase: { id: TechId; level: number; cost: number; res: ResourceId };
  unlock: { id: TechId };            // tech level 0 -> 1, INCLUDING milestones
  milestone: { id: TechId };
  offline: OfflineReport;
  reset: Record<string, never>;
  settings: SettingsState;           // emitted when ANY settings field changes (once per updateSettings call)
  achievement: { ids: AchievementId[] };  // one per evaluation that unlocked >= 1, ids in list order; fires last
}

export type Listener<K extends keyof SessionEvents> = (payload: SessionEvents[K]) => void;

/**
 * Minimal typed event emitter. Each subscription is tracked individually, so the same function
 * may be subscribed twice and each unsubscribe removes only its own subscription.
 * A listener that throws is logged and does not stop the other listeners or the emitter caller.
 */
export class TypedEmitter {
  // Stored type-erased: on() only ever adds a function matched to its own event type, so emit()
  // is the only place a payload is passed to a listener, and it casts back to Listener<K>.
  private readonly listeners = new Map<keyof SessionEvents, Set<(payload: never) => void>>();

  /** Subscribes to `type`. Returns an unsubscribe function (safe to call more than once). */
  on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void {
    const set = this.listeners.get(type) ?? new Set<(payload: never) => void>();
    const subscription = (payload: SessionEvents[K]): void => fn(payload);
    set.add(subscription);
    this.listeners.set(type, set);
    return () => {
      set.delete(subscription);
    };
  }

  /** Calls every listener subscribed to `type` with `payload`. Listeners added or removed during the call do not affect it. */
  emit<K extends keyof SessionEvents>(type: K, payload: SessionEvents[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const subscription of Array.from(set)) {
      try {
        (subscription as Listener<K>)(payload);
      } catch (error) {
        console.error(`[GameSession] listener for "${type}" threw`, error);
      }
    }
  }
}
