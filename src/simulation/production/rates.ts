import { RESOURCE_IDS, TECH_IDS } from '../../data/types';
import type {
  GameState,
  ProductionRates,
  ResourceDefinition,
  ResourceId,
  ResourceMap,
  TechDefinition,
  TechId,
} from '../../data/types';
import { TECHNOLOGIES } from '../../data/technologies';
import { RESOURCES } from '../../data/resources';
import { META_MULT } from '../../data/balance';
import { emptyResourceMap } from '../resources';

// Production formula (roadmap §1). Pure function of the owned tech levels and the resource table.
//
// Accumulation (per owned tech, per effect, L = level):
//   clickAdd  -> clickAdd += amount x L            clickMult -> clickMult *= factor ^ L
//   autoAdd   -> autoAdd[res] += amount x L         autoPct   -> autoPct[res] += percent x L
//   rateMult  -> resMult[res] (or allMult) *= factor ^ L
//   convert   -> convert[res] += amount x L         clickEcho -> echo[res] += seconds x L
//   offlineHours -> offline cap only (tick.ts offlineCapSeconds); no rate effect here
//
// Per second, in RESOURCE_IDS order (me, ee, pr, rs, xf). A converted resource is fed by its
// source's per-second rate:
//   base      = autoAdd[r] + convert[r] x perSecond[source] ^ convExp      (second term only if convert[r] != 0)
//   perSecond = base x (1 + autoPct[r] / 100) x resMult[r] x allMult x META_MULT
//
// Manual production:
//   perClick.me = clickAdd x clickMult          (clickMult affects manual ME only)
//   perClick[r] = echo[r] x perSecond[r]        for r != me (clickMult does NOT apply to echo)
//
// Techs with level <= 0 contribute nothing; `none` effects are ignored; a clickEcho on `me` is ignored.
// Era I only uses autoAdd(me), autoPct(me), clickAdd, clickMult, none, so every other resource stays 0
// and every multiplier stays 1: the era-I values are unchanged.

/** Production per click (manual) and per second (automation) for the current tech levels. */
export function computeRates(
  state: Pick<GameState, 'techLevels'>,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
  resources: Record<ResourceId, ResourceDefinition> = RESOURCES,
): ProductionRates {
  let clickAdd = 0;
  let clickMult = 1;
  const autoAdd = emptyResourceMap();
  const autoPct = emptyResourceMap();
  const resMult: ResourceMap = { me: 1, ee: 1, pr: 1, rs: 1, xf: 1 };
  let allMult = 1;
  const convert = emptyResourceMap();
  const echo = emptyResourceMap();

  for (const id of TECH_IDS) {
    const level = state.techLevels[id];
    if (level <= 0) continue;
    for (const effect of techs[id].effects) {
      switch (effect.type) {
        case 'clickAdd':
          clickAdd += effect.amount * level;
          break;
        case 'clickMult':
          clickMult *= Math.pow(effect.factor, level);
          break;
        case 'autoAdd':
          autoAdd[effect.res ?? 'me'] += effect.amount * level;
          break;
        case 'autoPct':
          autoPct[effect.res ?? 'me'] += effect.percent * level;
          break;
        case 'rateMult':
          if (effect.res === 'all') allMult *= Math.pow(effect.factor, level);
          else resMult[effect.res] *= Math.pow(effect.factor, level);
          break;
        case 'convert':
          convert[effect.res] += effect.amount * level;
          break;
        case 'clickEcho':
          echo[effect.res] += effect.seconds * level;
          break;
        case 'offlineHours':
          break;
        case 'none':
          break;
      }
    }
  }

  const perSecond = emptyResourceMap();
  for (const r of RESOURCE_IDS) {
    const d = resources[r];
    let base = autoAdd[r];
    if (d.source !== null && convert[r] !== 0) {
      base += convert[r] * Math.pow(Math.max(0, perSecond[d.source]), d.convExp);
    }
    perSecond[r] = base * (1 + autoPct[r] / 100) * resMult[r] * allMult * META_MULT;
  }

  const perClick = emptyResourceMap();
  perClick.me = clickAdd * clickMult;
  for (const r of RESOURCE_IDS) {
    if (r !== 'me') perClick[r] = echo[r] * perSecond[r];
  }

  return { perClick, perSecond };
}
