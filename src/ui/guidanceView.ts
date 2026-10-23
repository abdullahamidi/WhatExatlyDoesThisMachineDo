import { ERA_KEYSTONES } from '../data/eras';
import { HUD_TEXT } from '../data/hud';
import { RESOURCES } from '../data/resources';
import { TECHNOLOGIES } from '../data/technologies';
import { TECH_IDS } from '../data/types';
import type { EndingPhase, GameState, ProductionRates, TechDefinition, TechId } from '../data/types';
import { AFFORDABLE_BADGE, ERA_CARD, NEXT_GOAL } from '../data/ux';
import { canAfford, costAt } from '../simulation/economy/cost';
import { eraResource } from '../simulation/progression/era';
import { isRequirementMet, requirementLabel } from '../simulation/progression/requirements';
import { formatCost, formatDuration, formatNumber } from '../utils/format';
import { resourceShort } from './revealRules';

// WP20 guidance view model: the HUD next-goal line, the TECH INDEX hint and badge, and the era-unlock card.
// Pure: no DOM, no Phaser. Each predicate is a small rule so the HUD and the tests read the same logic.

export interface NextGoalView { id: TechId; title: string; detail: string; ready: boolean; progress: number }

/** ' · ~<time>' for the time left at the per-second rate of the same resource. Empty when nothing flows or nothing is left. */
function etaSuffix(remaining: number, rate: number): string {
  if (remaining <= 0 || rate <= 0) return '';
  return `${NEXT_GOAL.sep}${NEXT_GOAL.etaPrefix}${formatDuration(Math.ceil(remaining / rate))}`;
}

/**
 * The first sequence goal the player has not finished, with what it still needs. Null when none is left or the finale runs.
 * `maxEra` (demo cap) drops the goals above it, so the chain ends at the cap tech instead of pointing past it.
 */
export function nextGoal(
  state: Pick<GameState, 'res' | 'lifetime' | 'techLevels' | 'ending'>,
  rates: Readonly<ProductionRates>,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
  maxEra: number | null = null,
): NextGoalView | null {
  if (state.ending.phase !== 'none') return null;
  const sequence = NEXT_GOAL.sequence.filter((seqId) => maxEra === null || techs[seqId].era <= maxEra);
  const id = sequence.find((seqId) => state.techLevels[seqId] < 1);
  if (id === undefined) return null;
  const def = techs[id];
  const base = { id, title: `${NEXT_GOAL.prefix}${def.name.toUpperCase()}` };

  const unmetTech = def.requires.find((req) => req.type === 'tech' && !isRequirementMet(state, req));
  if (unmetTech) {
    return { ...base, detail: `${NEXT_GOAL.needs}${requirementLabel(unmetTech, techs).toUpperCase()}`, ready: false, progress: 0 };
  }

  // WP20: an unlock gated by a lifetime total must not read READY while that total is still short.
  const unmetLife = def.requires.find((req) => req.type === 'lifetime' && !isRequirementMet(state, req));
  if (def.kind === 'milestone' || unmetLife) {
    const life = unmetLife ?? def.requires.find((req) => req.type === 'lifetime');
    if (life?.type !== 'lifetime') return { ...base, detail: '', ready: false, progress: 0 };
    const have = state.lifetime[life.res];
    return {
      ...base,
      detail: `${formatNumber(have)} / ${formatNumber(life.amount)} ${NEXT_GOAL.lifetime} ${resourceShort(life.res)}`
        + etaSuffix(life.amount - have, rates.perSecond[life.res]),
      ready: false,
      progress: Math.min(1, have / life.amount),
    };
  }

  const cost = costAt(def, 0);
  if (canAfford(state, def.costRes, cost)) return { ...base, detail: NEXT_GOAL.ready, ready: true, progress: 1 };
  const have = state.res[def.costRes];
  return {
    ...base,
    detail: `${formatNumber(have)} / ${formatCost(cost)} ${resourceShort(def.costRes)}`
      + etaSuffix(cost - have, rates.perSecond[def.costRes]),
    ready: false,
    progress: Math.min(1, have / cost),
  };
}

/** True once anything past the starting crank is owned. Gates the goal line and the TECH INDEX hint. */
export function anyPurchased(
  techLevels: Readonly<Record<TechId, number>>,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
): boolean {
  return TECH_IDS.some((id) => techs[id].kind !== 'starting' && techLevels[id] >= 1);
}

/** The first-run crank prompt shows until the first click. */
export function crankPromptVisible(totalClicks: number): boolean {
  return totalClicks === 0;
}

export interface TechHintInput {
  totalClicks: number; anyPurchased: boolean; affordable: number; phase: EndingPhase; treeOpen: boolean; cycle: number;
}

/** The TECH INDEX hint: after the first click, before any purchase, while something is affordable, in the first cycle only. */
export function techHintVisible(i: TechHintInput): boolean {
  return i.totalClicks > 0 && !i.anyPurchased && i.affordable >= 1 && i.phase === 'none' && !i.treeOpen && i.cycle === 1;
}

/** The next-goal line appears once something is bought, and never during the finale. */
export function goalVisible(anyPurchased: boolean, phase: EndingPhase): boolean {
  return anyPurchased && phase === 'none';
}

/** TECH INDEX badge text (capped with the overflow glyph) and its screen-reader label. */
export function affordableBadge(count: number): { text: string; aria: string } {
  if (count <= 0) return { text: '', aria: AFFORDABLE_BADGE.label };
  const text = count > AFFORDABLE_BADGE.max ? AFFORDABLE_BADGE.overflow : String(count);
  return { text, aria: `${AFFORDABLE_BADGE.label}, ${count} ${AFFORDABLE_BADGE.ariaSuffix}` };
}

export interface EraCardView { era: 2 | 3 | 4 | 5; title: string; subtitle: string }

/** The era-unlock card for an era keystone. Null for every other tech and while the finale runs. */
export function eraCardFor(id: TechId, phase: EndingPhase): EraCardView | null {
  if (phase !== 'none') return null;
  const keystone = ERA_KEYSTONES.find((k) => k.techId === id);
  if (!keystone) return null;
  const { era } = keystone;
  const r = eraResource(era);
  return {
    era,
    title: HUD_TEXT.eraTitles[era - 1] ?? '',
    subtitle: `${ERA_CARD.signalPrefix}${RESOURCES[r].name.toUpperCase()} (${resourceShort(r)})`,
  };
}
