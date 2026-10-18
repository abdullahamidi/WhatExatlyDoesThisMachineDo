import { RESOURCES } from '../../data/resources';
import { TECH_LIST, TECHNOLOGIES } from '../../data/technologies';
import type {
  Effect,
  GameState,
  RequirementView,
  TechDefinition,
  TechId,
  TechStatus,
  TechView,
} from '../../data/types';
import { costAt, canAfford } from '../economy/cost';
import { isRequirementMet, requirementLabel, requirementsMet } from './requirements';

/** Derives the player-facing status of a technology from the current state. */
export function getTechStatus(
  state: GameState,
  id: TechId,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): TechStatus {
  const level = state.techLevels[id];
  const def = techs[id];
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

/** Player-facing text for `n` levels of one effect. */
export function describeEffect(effect: Effect, n: number): string {
  switch (effect.type) {
    case 'clickAdd':
      return `+${fmt(effect.amount * n)} ME/click`;
    case 'clickMult':
      return `×${fmt(effect.factor ** n)} manual production`;
    case 'autoAdd':
      return `+${fmt(effect.amount * n)} ${RESOURCES[effect.res ?? 'me'].short}/s`;
    case 'autoPct': {
      const res = effect.res ?? 'me';
      if (res === 'me') return `+${fmt(effect.percent * n)}% automation`;
      return `+${fmt(effect.percent * n)}% ${RESOURCES[res].short} production`;
    }
    case 'rateMult': {
      const label = effect.res === 'all' ? 'all' : RESOURCES[effect.res].short;
      return `×${fmt(effect.factor ** n)} ${label} production`;
    }
    case 'convert': {
      const source = RESOURCES[effect.res].source;
      const sourceShort = source === null ? '?' : RESOURCES[source].short;
      return `Converts ${sourceShort}/s into ${RESOURCES[effect.res].short}/s (×${fmt(effect.amount * n)})`;
    }
    case 'clickEcho':
      return `Clicks echo ${fmt(effect.seconds * n)}s of ${RESOURCES[effect.res].short}/s`;
    case 'none':
      return 'Effect unknown';
  }
}

/** Text for the cumulative effect of `n` levels of the given effects. */
function effectText(effects: Effect[], n: number): string {
  return effects.map((effect) => describeEffect(effect, n)).join(', ');
}

/** Price of the next purchase, or null when there is nothing left to buy. */
function nextCostFor(
  state: GameState,
  id: TechId,
  techs: Record<TechId, TechDefinition>,
): number | null {
  const def = techs[id];
  const level = state.techLevels[id];
  if (def.kind === 'starting' || def.kind === 'milestone') return null;
  if (def.kind === 'unlock') return level >= 1 ? null : costAt(def, level);
  if (def.maxLevel !== null && level >= def.maxLevel) return null;
  return costAt(def, level);
}

/** Full view model of one technology for the UI. */
export function getTechView(
  state: GameState,
  id: TechId,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): TechView {
  const def = techs[id];
  const level = state.techLevels[id];
  const status = getTechStatus(state, id, techs);
  const requirements: RequirementView[] = def.requires.map((req) => ({
    req,
    met: isRequirementMet(state, req),
    label: requirementLabel(req),
  }));
  const nextCost = nextCostFor(state, id, techs);
  const affordable =
    status === 'available' && nextCost !== null && canAfford(state, def.costRes, nextCost);

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
