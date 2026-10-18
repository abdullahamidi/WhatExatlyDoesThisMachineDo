import { TECH_LIST, TECHNOLOGIES } from '../../data/technologies';
import type {
  Effect,
  GameState,
  RequirementView,
  TechId,
  TechStatus,
  TechView,
} from '../../data/types';
import { costAt, canAfford } from '../economy/cost';
import { isRequirementMet, requirementLabel, requirementsMet } from './requirements';

/** Derives the player-facing status of a technology from the current state. */
export function getTechStatus(state: GameState, id: TechId): TechStatus {
  const level = state.techLevels[id];
  const def = TECHNOLOGIES[id];
  if (def.kind === 'starting') return level >= 1 ? 'purchased' : 'available';
  if (def.kind === 'milestone') return level >= 1 ? 'purchased' : 'locked';
  if (def.kind === 'unlock') {
    if (level >= 1) return 'purchased';
    return requirementsMet(state, def) ? 'available' : 'locked';
  }
  // repeatable
  if (def.maxLevel !== null && level >= def.maxLevel) return 'purchased';
  if (level >= 1) return 'available';
  return requirementsMet(state, def) ? 'available' : 'locked';
}

/** Formats a number for effect text: at most two decimals, no trailing zeros. */
function fmt(x: number): string {
  return String(Number(x.toFixed(2)));
}

function effectPart(effect: Effect, n: number): string {
  switch (effect.type) {
    case 'clickAdd':
      return `+${fmt(effect.amount * n)} ME/click`;
    case 'clickMult':
      return `×${fmt(effect.factor ** n)} manual production`;
    case 'autoAdd':
      return `+${fmt(effect.amount * n)} ME/s`;
    case 'autoPct':
      return `+${fmt(effect.percent * n)}% automation`;
    case 'none':
      return 'Effect unknown';
  }
}

/** Text for the cumulative effect of `n` levels of the given effects. */
function effectText(effects: Effect[], n: number): string {
  return effects.map((effect) => effectPart(effect, n)).join(', ');
}

/** Price of the next purchase, or null when there is nothing left to buy. */
function nextCostFor(state: GameState, id: TechId): number | null {
  const def = TECHNOLOGIES[id];
  const level = state.techLevels[id];
  if (def.kind === 'starting' || def.kind === 'milestone') return null;
  if (def.kind === 'unlock') return level >= 1 ? null : costAt(def, level);
  if (def.maxLevel !== null && level >= def.maxLevel) return null;
  return costAt(def, level);
}

/** Full view model of one technology for the UI. */
export function getTechView(state: GameState, id: TechId): TechView {
  const def = TECHNOLOGIES[id];
  const level = state.techLevels[id];
  const status = getTechStatus(state, id);
  const requirements: RequirementView[] = def.requires.map((req) => ({
    req,
    met: isRequirementMet(state, req),
    label: requirementLabel(req),
  }));
  const nextCost = nextCostFor(state, id);
  const affordable = status === 'available' && nextCost !== null && canAfford(state, nextCost);

  let nextEffectText: string | null = null;
  if (level === 0) {
    nextEffectText = effectText(def.effects, 1);
  } else if (def.kind === 'repeatable' && (def.maxLevel === null || level < def.maxLevel)) {
    nextEffectText = effectText(def.effects, level + 1);
  }

  return {
    id,
    def,
    status,
    level,
    nextCost,
    affordable,
    requirements,
    currentEffectText: level === 0 ? 'None' : effectText(def.effects, level),
    nextEffectText,
  };
}

/** Views for every technology, in TECH_LIST (= TECH_IDS) order. */
export function getAllTechViews(state: GameState): TechView[] {
  return TECH_LIST.map((tech) => getTechView(state, tech.id));
}
