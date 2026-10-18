import { TECH_IDS } from '../data/types';
import type { GameState, SettingsState, TechId } from '../data/types';
import { DEFAULT_ENDING } from './progression/ending';
import { emptyResourceMap } from './resources';
import { normalizeSettings } from './settings';

export const DEFAULT_SETTINGS: SettingsState = normalizeSettings(undefined);

export function createInitialState(nowMs: number): GameState {
  const techLevels = {} as Record<TechId, number>;
  for (const id of TECH_IDS) {
    techLevels[id] = id === 'handCrank' ? 1 : 0;
  }
  return {
    res: emptyResourceMap(),
    lifetime: emptyResourceMap(),
    totalClicks: 0,
    techLevels,
    lastSimTime: nowMs,
    createdAt: nowMs,
    ending: { ...DEFAULT_ENDING },
  };
}
