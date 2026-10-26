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
/** `title` is the click row's tooltip (the worth explained), null when there is no worth suffix. */
export interface HudClickLine { primary: string; secondary: string | null; title: string | null }
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

/** Shown instead of a worth below this many seconds (display precision, not balance). */
const WORTH_MIN_SECONDS = 0.01;

/** Drops trailing zeros and a dangling '.' (`2.50` -> `2.5`, `10.0` -> `10`). */
function trimFixed(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/**
 * Number text of a click's worth in seconds of output, without the unit (WP25 C4).
 * >= 10 whole, >= 1 one decimal, >= 0.01 two decimals; below that, 0, negative or not finite: `<0.01`.
 */
export function formatWorth(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < WORTH_MIN_SECONDS) return HUD_TEXT.worthFloor;
  if (seconds >= 10) return String(Math.round(seconds));
  if (seconds >= 1) return trimFixed(seconds.toFixed(1));
  return trimFixed(seconds.toFixed(2));
}

/**
 * Seconds of machine output one manual click is worth: perClick / perSecond of the click resource (WP25 C4).
 * Null without a positive perSecond (no output to compare with) or when the worth is not a finite number >= 0.
 */
function clickWorthSeconds(rates: Readonly<ProductionRates>, res: ResourceId): number | null {
  const perSecond = rates.perSecond[res];
  if (!Number.isFinite(perSecond) || perSecond <= 0) return null;
  const worth = rates.perClick[res] / perSecond;
  return Number.isFinite(worth) && worth >= 0 ? worth : null;
}

/** CLICK line (WP25 C4): the click resource's gain, then its worth in seconds when one is known; ME is the secondary line. */
function clickLine(rates: Readonly<ProductionRates>, clickRes: ResourceId): HudClickLine {
  const worth = clickWorthSeconds(rates, clickRes);
  const gain = `+${formatCompact(rates.perClick[clickRes])} ${resourceShort(clickRes)}`;
  return {
    primary: worth === null ? gain : gain + HUD_TEXT.worthSep + HUD_TEXT.clickWorth.replace('{s}', formatWorth(worth)),
    secondary: clickRes !== 'me' ? `+${formatCompact(rates.perClick.me)} ${resourceShort('me')}` : null,
    title: worth === null ? null : HUD_TEXT.clickWorthTitle.replace('{s}', formatWorth(worth)),
  };
}

/** AUTO-CRANK text (WP25 C4): the auto-cranks per second, then their output per second when that shows a non-zero value. */
function autoCrankText(autoPerSecond: number, perClick: number, res: ResourceId): string {
  const head = `${HUD_TEXT.autoCrank} ${formatCompact(autoPerSecond)}/s`;
  const output = autoPerSecond * perClick;
  if (!Number.isFinite(output) || output <= 0) return head;
  const shown = formatCompact(output);
  if (shown === '0') return head;
  return head + HUD_TEXT.worthSep + HUD_TEXT.autoCrankOutput.replace('{v}', shown).replace('{res}', resourceShort(res));
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
 * The CLICK line also shows the click's worth in seconds of output when the click resource has a positive perSecond (WP25 C4).
 * AUTO-CRANK line: automatic crank clicks per second, null when none, plus their output per second when non-zero.
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
    click: clickLine(rates, clickRes),
    autoCrank: autoPerSecond > 0 ? autoCrankText(autoPerSecond, rates.perClick[clickRes], clickRes) : null,
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
