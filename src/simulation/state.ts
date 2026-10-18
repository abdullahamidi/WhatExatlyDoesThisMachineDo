import { TECH_IDS } from '../data/types';
import type { GameState, SettingsState, TechId } from '../data/types';

export const DEFAULT_SETTINGS: SettingsState = { muted: false };

export function createInitialState(nowMs: number): GameState {
  const techLevels = {} as Record<TechId, number>;
  for (const id of TECH_IDS) {
    techLevels[id] = id === 'handCrank' ? 1 : 0;
  }
  return {
    me: 0,
    lifetimeMe: 0,
    totalClicks: 0,
    techLevels,
    lastSimTime: nowMs,
    createdAt: nowMs,
  };
}
