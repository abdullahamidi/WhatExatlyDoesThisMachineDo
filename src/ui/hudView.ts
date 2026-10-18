import { formatNumber, formatRate } from '../utils/format';
import { RESOURCES } from '../data/resources';
import type { GameState, ProductionRates, ResourceId } from '../data/types';

// Pure HUD view model. No DOM, no Phaser.

export interface HudResourceRow { id: ResourceId; label: string; value: string; perSecond: string; visible: boolean }
export interface HudView { me: string; perClick: string; perSecond: string; rows: HudResourceRow[] }

/** Resources shown as extra HUD rows (ME has its own three rows). */
export const HUD_ROW_IDS: readonly ResourceId[] = ['ee', 'pr', 'rs', 'xf'];

// me: formatNumber(res.me); perClick: formatNumber(rates.perClick.me); perSecond: formatRate(rates.perSecond.me)
// row: label = short; value = formatNumber(res[id]); perSecond = formatRate(rates.perSecond[id]);
// visible = lifetime[id] > 0 || rates.perSecond[id] > 0 (hidden while the resource is unused)
export function buildHudView(
  state: Pick<GameState, 'res' | 'lifetime'>,
  rates: Readonly<ProductionRates>,
): HudView {
  return {
    me: formatNumber(state.res.me),
    perClick: formatNumber(rates.perClick.me),
    perSecond: formatRate(rates.perSecond.me),
    rows: HUD_ROW_IDS.map((id): HudResourceRow => ({
      id,
      label: RESOURCES[id].short,
      value: formatNumber(state.res[id]),
      perSecond: formatRate(rates.perSecond[id]),
      visible: state.lifetime[id] > 0 || rates.perSecond[id] > 0,
    })),
  };
}
