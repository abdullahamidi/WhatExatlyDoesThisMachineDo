import { formatNumber, formatRate } from '../utils/format';
import type { GameState, ProductionRates } from '../data/types';

export interface HudView { me: string; perClick: string; perSecond: string }

// me: formatNumber(state.me); perClick: formatNumber(rates.perClick); perSecond: formatRate(rates.perSecond)
export function buildHudView(state: Pick<GameState, 'me'>, rates: Readonly<ProductionRates>): HudView {
  return {
    me: formatNumber(state.me),
    perClick: formatNumber(rates.perClick),
    perSecond: formatRate(rates.perSecond),
  };
}
