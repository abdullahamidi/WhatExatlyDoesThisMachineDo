import { RESOURCES } from '../../data/resources';
import { TECHNOLOGIES } from '../../data/technologies';
import { TECH_IDS } from '../../data/types';
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
import { eraAllowed } from './edition';
import type { EraCap } from './edition';
import { isRequirementMet, requirementLabel, requirementsMet } from './requirements';

/** Derives the player-facing status of a technology from the current state. */
export function getTechStatus(
  state: GameState,
  id: TechId,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
  maxEra: EraCap = null,
): TechStatus {
  const level = state.techLevels[id];
  const def = techs[id];
  // Edition cap wins over ownership: a demo save may still hold era-III levels in memory.
  if (!eraAllowed(def, maxEra)) return 'locked';
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
      // WP20: show the real rate, amount * (source rate)^convExp, instead of a bare multiplier.
      const def = RESOURCES[effect.res];
      const src = def.source === null ? '?' : RESOURCES[def.source].short;
      const amt = fmt(effect.amount * n);
      const exp = def.convExp;
      const input = exp === 0.5 ? `√(${src}/s)` : exp === 1 ? `${src}/s` : `(${src}/s)^${fmt(exp)}`;
      return `Converts ${input} × ${amt} into ${def.short}/s`;
    }
    case 'clickEcho':
      return `Clicks echo ${fmt(effect.seconds * n)}s of ${RESOURCES[effect.res].short}/s`;
    case 'offlineHours':
      return `+${fmt(effect.hours * n)}h offline buffer`;
    case 'autoClick':
      return `+${fmt(effect.perSecond * n)} auto-cranks/s — each yields a full click of every energy`;
    case 'ending':
      return 'Engages the primary function';
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
  maxEra: EraCap = null,
): TechView {
  const def = techs[id];
  const level = state.techLevels[id];
  const status = getTechStatus(state, id, techs, maxEra);
  const requirements: RequirementView[] = def.requires.map((req) => ({
    req,
    met: isRequirementMet(state, req),
    label: requirementLabel(req, techs),
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
    demoLocked: !eraAllowed(def, maxEra),
  };
}

/** Views for every technology, in TECH_IDS order. */
export function getAllTechViews(
  state: GameState,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
  maxEra: EraCap = null,
): TechView[] {
  return TECH_IDS.map((id) => getTechView(state, id, techs, maxEra));
}
