import { formatNumber, formatRate } from '../utils/format';
import { PLAQUE_LINES } from '../data/story';
import { RESOURCE_IDS } from '../data/types';
import type { GameState, ProductionRates, PrestigeState, ResourceId, ResourceMap, TechId } from '../data/types';
import { cycleLabel, DEFAULT_PRESTIGE } from '../simulation/prestige';
import { resourceShort } from './revealRules';

// Pure HUD view model. No DOM, no Phaser.

export interface HudResourceRow { id: ResourceId; label: string; value: string; perSecond: string; visible: boolean }
export interface HudView { me: string; perClick: string; perSecond: string; rows: HudResourceRow[]; plaque: string; cycle: string | null }

/** Cycle line under the plaque: null in cycle 1 (era I start, nothing to show), `CYCLE 0043` from cycle 2. */
export function cycleLine(cycle: number): string | null {
  return cycle > 1 ? cycleLabel(cycle) : null;
}

/** Resources shown as extra HUD rows (ME has its own three rows). */
export const HUD_ROW_IDS: readonly ResourceId[] = ['ee', 'pr', 'rs', 'xf'];

/**
 * Plaque text of the LAST PLAQUE_LINES entry that is owned (milestone null, or its milestone level >= 1).
 */
export function plaqueText(techLevels: Readonly<Record<TechId, number>>): string {
  let text = '';
  for (const line of PLAQUE_LINES) {
    if (line.milestone === null || techLevels[line.milestone] >= 1) text = line.text;
  }
  return text;
}

// me: formatNumber(res.me); perClick: formatNumber(rates.perClick.me); perSecond: formatRate(rates.perSecond.me)
// row: label = short; value = formatNumber(res[id]); perSecond = formatRate(rates.perSecond[id]);
// visible = lifetime[id] > 0 || rates.perSecond[id] > 0 (hidden while the resource is unused)
// plaque = plaqueText(techLevels)
// cycle = cycleLine(prestige.cycle) (null in cycle 1)
export function buildHudView(
  state: Pick<GameState, 'res' | 'lifetime' | 'techLevels'>,
  rates: Readonly<ProductionRates>,
  prestige: Pick<PrestigeState, 'cycle'> = DEFAULT_PRESTIGE,
): HudView {
  return {
    me: formatNumber(state.res.me),
    perClick: formatNumber(rates.perClick.me),
    perSecond: formatRate(rates.perSecond.me),
    rows: HUD_ROW_IDS.map((id): HudResourceRow => ({
      id,
      label: resourceShort(id),
      value: formatNumber(state.res[id]),
      perSecond: formatRate(rates.perSecond[id]),
      visible: state.lifetime[id] > 0 || rates.perSecond[id] > 0,
    })),
    plaque: plaqueText(state.techLevels),
    cycle: cycleLine(prestige.cycle),
  };
}

/**
 * Floating text for one crank click. Lists every resource gained (finite and > 0), in RESOURCE_IDS order.
 * Only ME gained (or nothing) -> `+N`, exactly as in era I. Otherwise `+N SHORT` parts joined by two spaces.
 */
export function clickGainText(gainedAll: Readonly<ResourceMap>): string {
  const gained = (id: ResourceId): number => {
    const v = gainedAll[id];
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const parts = RESOURCE_IDS.filter((id) => gained(id) > 0);
  if (parts.every((id) => id === 'me')) return '+' + formatNumber(gained('me'));
  return parts.map((id) => `+${formatNumber(gained(id))} ${resourceShort(id)}`).join('  ');
}
