import { formatCompact, formatStock, formatHudRate } from '../utils/format';
import { PLAQUE_LINES } from '../data/story';
import { HUD_TEXT } from '../data/hud';
import { RESOURCES } from '../data/resources';
import { RESOURCE_IDS } from '../data/types';
import type { EndingPhase, GameState, ProductionRates, PrestigeState, ResourceId, ResourceMap, TechDefinition, TechId } from '../data/types';
import type { EraNumber } from '../data/eras';
import { TECHNOLOGIES } from '../data/technologies';
import { cycleLabel, DEFAULT_PRESTIGE } from '../simulation/prestige';
import { currentEra, eraResource } from '../simulation/progression/era';
import { autoClicksPerSecond } from '../simulation/production/rates';
import { isRevealedLabel, resourceShort } from './revealRules';

// Pure HUD view model (WP17). No DOM, no Phaser.

export interface HudResourceRow { id: ResourceId; label: string; value: string; rate: string; feeds: string | null; visible: boolean; frontier: boolean }
export interface HudClickLine { primary: string; secondary: string | null }
/** `viewMachine` is true only in postgame (VIEW MACHINE button shown). */
export interface HudView { title: string; rows: HudResourceRow[]; click: HudClickLine; autoCrank: string | null; plaque: string; cycle: string | null; viewMachine: boolean }

/** Cycle line under the plaque: null in cycle 1 (era I start, nothing to show), `CYCLE 0043` from cycle 2. */
export function cycleLine(cycle: number): string | null {
  return cycle > 1 ? cycleLabel(cycle) : null;
}

/** One row per resource, in RESOURCE_IDS order (ME is a row too). */
export const HUD_ROW_IDS: readonly ResourceId[] = RESOURCE_IDS;

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

/**
 * HUD title (WP17). Finale choice and postgame show the restored title; era V shows the revealed title once
 * the reveal is on; every other case shows the era title.
 */
export function hudTitle(era: EraNumber, phase: EndingPhase, revealed: boolean): string {
  if (phase === 'choice' || phase === 'postgame') return HUD_TEXT.restored;
  if (era === 5 && revealed) return HUD_TEXT.eraFiveRevealed;
  return HUD_TEXT.eraTitles[era - 1] ?? HUD_TEXT.eraTitles[0];
}

/** The resource that feeds `id` (RESOURCES[x].source === id), or undefined for the last one (xf). */
function fedBy(id: ResourceId): ResourceId | undefined {
  return RESOURCE_IDS.find((x) => RESOURCES[x].source === id);
}

/**
 * HUD view (WP17). Title per era, one row per resource, frontier = the current era's resource.
 * A row is visible for ME, for the frontier, or once its lifetime or per-second rate is positive.
 * `feeds` names the resource fed by this row when that row is visible.
 * CLICK line: the frontier's per-click gain when positive, otherwise ME; ME is the secondary line for any other click.
 * AUTO-CRANK line: automatic crank clicks per second, null when none.
 */
export function buildHudView(
  state: Pick<GameState, 'res' | 'lifetime' | 'techLevels' | 'ending'>,
  rates: Readonly<ProductionRates>,
  prestige: Pick<PrestigeState, 'cycle'> = DEFAULT_PRESTIGE,
  techs: Readonly<Record<TechId, TechDefinition>> = TECHNOLOGIES,
): HudView {
  const era = currentEra(state.techLevels);
  const frontier = eraResource(era);
  const isVisible = (id: ResourceId): boolean =>
    id === 'me' || id === frontier || state.lifetime[id] > 0 || rates.perSecond[id] > 0;

  const frontierClick = rates.perClick[frontier];
  const clickRes: ResourceId = Number.isFinite(frontierClick) && frontierClick > 0 ? frontier : 'me';
  const autoPerSecond = autoClicksPerSecond(state.techLevels, techs);

  return {
    title: hudTitle(era, state.ending.phase, isRevealedLabel()),
    rows: RESOURCE_IDS.map((id): HudResourceRow => {
      const fed = fedBy(id);
      return {
        id,
        label: resourceShort(id),
        value: formatStock(state.res[id]),
        rate: formatHudRate(rates.perSecond[id]),
        feeds: fed !== undefined && isVisible(fed) ? HUD_TEXT.feedsPrefix + resourceShort(fed) : null,
        visible: isVisible(id),
        frontier: id === frontier,
      };
    }),
    click: {
      primary: `+${formatCompact(rates.perClick[clickRes])} ${resourceShort(clickRes)}`,
      secondary: clickRes !== 'me' ? `+${formatCompact(rates.perClick.me)} ${resourceShort('me')}` : null,
    },
    autoCrank: autoPerSecond > 0 ? `${HUD_TEXT.autoCrank} ${formatCompact(autoPerSecond)}/s` : null,
    plaque: plaqueText(state.techLevels),
    cycle: cycleLine(prestige.cycle),
    viewMachine: state.ending.phase === 'postgame',
  };
}

/** One stacked line of the crank gain text (WP17). */
export interface GainLine { res: ResourceId; text: string }

/**
 * Stacked crank gain lines (WP17). Gains that are not finite or not > 0 are ignored.
 * Nothing gained or only ME -> one ME line (`+0` when nothing). Otherwise one line per gained resource,
 * ordered xf, rs, pr, ee, me (top of the stack first).
 */
export function clickGainLines(gainedAll: Readonly<ResourceMap>): GainLine[] {
  const gained = (id: ResourceId): number => {
    const v = gainedAll[id];
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const parts = RESOURCE_IDS.filter((id) => gained(id) > 0);
  if (parts.every((id) => id === 'me')) return [{ res: 'me', text: '+' + formatCompact(gained('me')) }];
  return parts.reverse().map((id): GainLine => ({ res: id, text: `+${formatCompact(gained(id))} ${resourceShort(id)}` }));
}
