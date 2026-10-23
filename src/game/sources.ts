// WP18 machine sources: the MachineSource implementations behind the final-machine showcase.
// Pure: no Phaser, no DOM. Only machine renderers read these; the session keeps the real levels.
import { TypedEmitter, emptyResourceMap } from '../simulation';
import type { Listener, SessionEvents } from '../simulation';
import type { ResourceMap, SettingsState, TechId } from '../data/types';
import type { MachineSource } from './entities/machineSource';
import { mergeDisplayLevels } from './math/showcase';
import type { LevelFloor } from './math/showcase';

/** A MachineSource whose tech levels can be raised to display floors. Rendering-only: never written to the session. */
export interface DisplaySource extends MachineSource {
  /** Sets the display floor; null shows the base levels. */
  setOverride(floor: LevelFloor | null): void;
  getOverride(): LevelFloor | null;
  /** Removes the reset subscription on the base source. The override then survives a base reset. */
  destroy(): void;
}

/**
 * Wraps a base source. While an override is set, state.techLevels is the base levels raised to the floor
 * (mergeDisplayLevels); otherwise it is the base levels object itself. rates, settings and on() are live.
 */
export function createDisplaySource(base: MachineSource): DisplaySource {
  let override: LevelFloor | null = null;
  // Last merge, keyed by both inputs, so repeat reads return the same object.
  let merged: { real: Readonly<Record<TechId, number>>; floor: LevelFloor; levels: Readonly<Record<TechId, number>> } | null = null;

  // Subscribed before any consumer, so on a base reset this runs first and consumers see the base levels.
  const unsubscribeReset = base.on('reset', () => {
    override = null;
  });

  function displayLevels(): Readonly<Record<TechId, number>> {
    const real = base.state.techLevels;
    if (override === null) return real;
    if (merged === null || merged.real !== real || merged.floor !== override) {
      merged = { real, floor: override, levels: mergeDisplayLevels(real, override) };
    }
    return merged.levels;
  }

  return {
    state: {
      get techLevels(): Readonly<Record<TechId, number>> {
        return displayLevels();
      },
    },
    get rates() {
      return base.rates;
    },
    get settings(): Readonly<SettingsState> {
      return base.settings;
    },
    on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void {
      return base.on(type, fn);
    },
    setOverride(floor: LevelFloor | null): void {
      override = floor;
    },
    getOverride(): LevelFloor | null {
      return override;
    },
    destroy(): void {
      unsubscribeReset();
    },
  };
}

/** A MachineSource driven by a script: the ShowcaseScene teaser sets its levels, rates and events by hand. */
export interface StandInSource extends MachineSource {
  setLevels(levels: Readonly<Record<TechId, number>>): void;
  setRates(perSecond: Readonly<ResourceMap>): void;
  /** Emits a scripted event to the `on` listeners. */
  emit: TypedEmitter['emit'];
}

export function createStandInSource(init: {
  levels: Readonly<Record<TechId, number>>;
  settings: Readonly<SettingsState>;
  perSecond?: Readonly<ResourceMap>;
}): StandInSource {
  const emitter = new TypedEmitter();
  let levels = init.levels;
  let perSecond: Readonly<ResourceMap> = init.perSecond ?? emptyResourceMap();

  return {
    state: {
      get techLevels(): Readonly<Record<TechId, number>> {
        return levels;
      },
    },
    rates: {
      get perSecond(): Readonly<ResourceMap> {
        return perSecond;
      },
    },
    settings: init.settings,
    on<K extends keyof SessionEvents>(type: K, fn: Listener<K>): () => void {
      return emitter.on(type, fn);
    },
    emit<K extends keyof SessionEvents>(type: K, payload: SessionEvents[K]): void {
      emitter.emit(type, payload);
    },
    setLevels(next: Readonly<Record<TechId, number>>): void {
      levels = next;
    },
    setRates(next: Readonly<ResourceMap>): void {
      perSecond = next;
    },
  };
}
