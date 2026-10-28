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
//   crankEcho -> crankEcho += seconds x L (every energy, ME included; see the manual part below)
//   offlineHours -> offline cap only (tick.ts offlineCapSeconds); no rate effect here
//   autoClick -> autoClicks += perSecond x L; folded into perSecond after perClick: perSecond[r] += autoClicks x perClick[r]
//   windup, faultUnlock, faultSeconds, faultRate, faultWindow, overdrive -> no rate effect here (windup.ts and
//     the fault clock read them)
//
// Per second, in RESOURCE_IDS order (me, ee, pr, rs, xf). A converted resource is fed by its
// source's per-second rate. perSecondPre is this value before the servo fold-in below:
//   base         = autoAdd[r] + convert[r] x perSecond[source] ^ convExp      (second term only if convert[r] != 0)
//   perSecondPre = base x (1 + autoPct[r] / 100) x resMult[r] x allMult x META_MULT
//
// Manual production (E = crankEcho total, so every click also yields E x perSecondPre of each energy):
//   perClick.me = clickAdd x clickMult + E x perSecondPre.me     (the E part is NOT multiplied by clickMult)
//   perClick[r] = (echo[r] + E) x perSecondPre[r]                for r != me (clickMult does NOT apply)
//
// Servo auto-cranks (last, so no feedback; ME included):
//   perSecond[r] = perSecondPre[r] + autoClicks x perClick[r]
//
// Click parity (plan D2): with no clickEcho on r, perClick[r] / perSecond[r] = E / (1 + autoClicks x E). The ME
// share is (F + E p) / (p + autoClicks (F + E p)) with flat part F = clickAdd x clickMult >= 0 and p = perSecondPre.me.
// Cross-multiplying leaves F >= 0, so the ME click is never worth less than another energy's click.
//
// Techs with level <= 0 contribute nothing; `none` and `ending` effects are ignored (`ending` is a marker
// that WP12 reads for the finale; it contributes nothing here); a clickEcho on `me` is ignored (ME gets its
// echo only through crankEcho).
// Era I: the only echo is Reinforced Crank's ME echo; every non-ME resource stays 0 (its perSecondPre is 0 there).

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
  let crankEcho = 0;
  let autoClicks = 0;

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
        case 'crankEcho':
          crankEcho += effect.seconds * level;
          break;
        case 'offlineHours':
          break;
        case 'autoClick':
          autoClicks += effect.perSecond * level;
          break;
        // WP27 effects with no rate here: windup.ts reads the wind-up, the fault clock reads the fault effects.
        case 'windup':
        case 'faultUnlock':
        case 'faultSeconds':
        case 'faultRate':
        case 'faultWindow':
        case 'overdrive':
          break;
        case 'none':
          break;
        case 'ending': // marker only: no rate, click or offline contribution
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

  // perSecond is still perSecondPre here (the fold-in comes after). The float order is pinned by the audit harness
  // (C2): keep `flat + crankEcho * perSecondPre.me` and `(echo + crankEcho) * perSecondPre[r]` as written.
  const perClick = emptyResourceMap();
  perClick.me = clickAdd * clickMult + crankEcho * perSecond.me;
  for (const r of RESOURCE_IDS) {
    if (r !== 'me') perClick[r] = (echo[r] + crankEcho) * perSecond[r];
  }

  // servo auto-cranks: each automatic click yields exactly one manual click (after perClick, so no feedback)
  if (autoClicks !== 0) {
    for (const r of RESOURCE_IDS) perSecond[r] += autoClicks * perClick[r];
  }

  return { perClick, perSecond };
}

/** Automatic crank clicks per second: sum of every `autoClick` effect x level over owned techs (level > 0). */
export function autoClicksPerSecond(
  techLevels: Readonly<Record<TechId, number>>,
  techs: Record<TechId, TechDefinition> = TECHNOLOGIES,
): number {
  let total = 0;
  for (const id of TECH_IDS) {
    const level = techLevels[id];
    if (!(level > 0)) continue;
    for (const effect of techs[id].effects) {
      if (effect.type === 'autoClick') total += effect.perSecond * level;
    }
  }
  return total;
}
