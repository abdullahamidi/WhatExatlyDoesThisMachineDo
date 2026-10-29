import { ERA_KEYSTONES } from '../data/eras';
import { HUD_TEXT } from '../data/hud';
import { RESOURCES } from '../data/resources';
import { TECHNOLOGIES } from '../data/technologies';
import { TECH_IDS } from '../data/types';
import type { EndingPhase, GameState, ProductionRates, TechDefinition, TechId } from '../data/types';
import { AFFORDABLE_BADGE, ERA_CARD, NEXT_BUY, NEXT_GOAL } from '../data/ux';
import { canAfford, costAt } from '../simulation/economy/cost';
import { eraAllowed } from '../simulation/progression/edition';
import { eraResource } from '../simulation/progression/era';
import { isRequirementMet, requirementLabel, requirementsMet } from '../simulation/progression/requirements';
import { formatCost, formatDuration, formatNumber } from '../utils/format';
import { resourceShort } from './revealRules';

// WP20 guidance view model: the HUD next-goal line, the TECH INDEX hint and badge, and the era-unlock card.
// Pure: no DOM, no Phaser. Each predicate is a small rule so the HUD and the tests read the same logic.
// WP16b-2: activePrompt picks the one guidance prompt on screen (crank > TECH INDEX hint > next-goal line).

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

export interface NextBuyView { id: TechId; text: string; etaSeconds: number }

/** ETA rounded up to a readable step: 5 s under a minute, 10 s under ten minutes, a minute above. Never rounds down. */
export function roundEta(seconds: number): number {
  const step = seconds < 60 ? 5 : seconds < 600 ? 10 : 60;
  return Math.max(0, Math.ceil(seconds / step - 1e-9)) * step;
}

/**
 * The status.ts 'available' rule for an unlock or a repeatable, on the Pick the HUD holds (getTechStatus takes a full
 * GameState). Parity with getTechStatus is pinned in guidanceView.test.ts. Milestones and the starting crank never pass.
 */
function isBuyable(
  state: Pick<GameState, 'techLevels' | 'lifetime'>,
  id: TechId,
  def: TechDefinition,
  maxEra: number | null,
): boolean {
  if (!eraAllowed(def, maxEra)) return false;
  const level = state.techLevels[id];
  if (def.kind === 'unlock') return level < 1 && requirementsMet(state, def);
  return def.kind === 'repeatable' && (def.maxLevel === null || level < def.maxLevel) && (level >= 1 || requirementsMet(state, def));
}

/**
 * NEXT BUY (WP28): the purchase the machine reaches first. Among the available unlocks and repeatables (Splices included),
 * eta = (cost - stock) / perSecond of the cost resource; the smallest wins, ties go to TECH_IDS order, and a rate of 0 never
 * arrives. Null during the finale, while any of them is affordable (the TECH INDEX badge covers that) and when no eta is finite.
 * The ETA is the passive rate only (clicks, Faults, Finds and wind-up excluded): it never promises faster than the machine.
 */
export function nextBuy(
  state: Pick<GameState, 'res' | 'lifetime' | 'techLevels' | 'ending'>,
  rates: Readonly<ProductionRates>,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
  maxEra: number | null = null,
): NextBuyView | null {
  if (state.ending.phase !== 'none') return null;
  let bestId: TechId | null = null;
  let bestEta = Infinity;
  for (const id of TECH_IDS) {
    const def = techs[id];
    if (!isBuyable(state, id, def, maxEra)) continue;
    const cost = costAt(def, state.techLevels[id]);
    const stock = state.res[def.costRes];
    if (stock >= cost) return null;
    const perSecond = rates.perSecond[def.costRes];
    if (!(perSecond > 0)) continue;
    const eta = (cost - stock) / perSecond;
    if (eta < bestEta) {
      bestId = id;
      bestEta = eta;
    }
  }
  if (bestId === null) return null;
  const name = techs[bestId].name.toUpperCase();
  const time = formatDuration(roundEta(bestEta));
  return {
    id: bestId,
    text: `${NEXT_BUY.prefix}${name}${NEXT_BUY.sep}${NEXT_BUY.etaPrefix}${time}`,
    etaSeconds: bestEta,
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

export type GuidancePrompt = 'crank' | 'hint' | 'goal';

/** WP16b-2: the one guidance prompt on screen. Priority: crank prompt (no click yet) > TECH INDEX hint > next-goal line. Null outside phase 'none'. */
export function activePrompt(i: TechHintInput): GuidancePrompt | null {
  if (i.phase !== 'none') return null;
  if (crankPromptVisible(i.totalClicks)) return 'crank';
  if (techHintVisible(i)) return 'hint';
  if (goalVisible(i.anyPurchased, i.phase)) return 'goal';
  return null;
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
