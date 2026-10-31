// WP28 A2 guard (Pacing set REC, "Visual thresholds"; rule P7). The v0.11.0 numbers are held here as literals and never read
// from the data. Each split track (SPLIT_PARTS) keeps its spend point: a visual threshold moves to parts x (old - 1) + 1 (level 1
// stays 1), a tech requirement moves to minLevel x parts, maxLevel x parts. A site missing from the literal table fails the
// completeness scan below, so a new split-track threshold cannot slip in unguarded.
import { describe, it, expect } from 'vitest';
import { SPLIT_PARTS } from './pacing';
import { TECHNOLOGIES } from './technologies';
import { PART_TIERS } from './machineTiers';
import { MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS } from './machineComponents';
import { DUST_RISING, ECLIPSE, PARALLAX_LAYERS, PYLON_FEEDS } from './world';
import { WORLD_SHADOWS } from './livingWorld';
import { TECH_IDS } from './types';
import type { TechId } from './types';

// Parts per split track (WP28 REC, "Split tracks"; 17 ids, horizonField has no part track).
const PLAN_PARTS: Readonly<Record<string, number>> = {
  copperWinding: 2, motorRetrofit: 2, transformer: 2, firebox: 2, inductionHeater: 3, condenser: 3,
  bellowsDrive: 3, harmonicCoil: 2, pressureResonator: 2, standingWave: 2, gridExciter: 3, containmentRing: 2,
  resonantSiphon: 3, graviticAnchor: 2, horizonField: 2, mainsBackfeed: 3, steamLance: 3,
};

/** One threshold site: the tech that gates it and its level list (a track holds its tier list; a stage holds one level). */
interface Site { techId: TechId; levels: readonly number[] }

// The v0.11.0 literal table (every visual threshold on a split track, plus the level-1 horizon stage for completeness).
// Keys: tier:<track> (PART_TIERS levels), component:<id> (minLevel), alsoVisibleWith:<id>[i], world:<layer or table>, shadows:<name>.
const V011: Readonly<Record<string, Site>> = {
  'tier:copperWinding': { techId: 'copperWinding', levels: [1, 5, 10, 20, 25] },
  'tier:motorRetrofit': { techId: 'motorRetrofit', levels: [1, 4, 8, 13, 18] },
  'tier:transformer': { techId: 'transformer', levels: [1, 4, 8, 13, 20] },
  'tier:firebox': { techId: 'firebox', levels: [1, 5, 10, 20, 25] },
  'tier:inductionHeater': { techId: 'inductionHeater', levels: [1, 4, 8, 13, 20] },
  'tier:condenser': { techId: 'condenser', levels: [1, 4, 8, 13, 20] },
  'tier:bellowsDrive': { techId: 'bellowsDrive', levels: [1, 2, 3] },
  'tier:harmonicCoil': { techId: 'harmonicCoil', levels: [1, 4, 8, 16, 25] },
  'tier:pressureResonator': { techId: 'pressureResonator', levels: [1, 4, 8, 13, 18] },
  'tier:standingWave': { techId: 'standingWave', levels: [1, 4, 8, 13, 20] },
  'tier:gridExciter': { techId: 'gridExciter', levels: [1, 7, 14] },
  'tier:containmentRing': { techId: 'containmentRing', levels: [1, 4, 8, 16, 25] },
  'tier:resonantSiphon': { techId: 'resonantSiphon', levels: [1, 5, 10] },
  'tier:graviticAnchor': { techId: 'graviticAnchor', levels: [1, 2, 3] },
  'tier:mainsBackfeed': { techId: 'mainsBackfeed', levels: [1, 4, 7] },
  'tier:steamLance': { techId: 'steamLance', levels: [1, 7, 12] },
  'component:coilStage2': { techId: 'copperWinding', levels: [10] },
  'component:coilStage3': { techId: 'copperWinding', levels: [20] },
  'component:fireboxGlow2': { techId: 'firebox', levels: [10] },
  'component:fireboxGlow3': { techId: 'firebox', levels: [20] },
  'component:coilRing2': { techId: 'harmonicCoil', levels: [8] },
  'component:coilRing3': { techId: 'harmonicCoil', levels: [16] },
  'component:coilRing4': { techId: 'harmonicCoil', levels: [25] },
  'component:ring1Bead2': { techId: 'containmentRing', levels: [4] },
  'component:ring2Back': { techId: 'containmentRing', levels: [8] },
  'component:ring3Back': { techId: 'containmentRing', levels: [16] },
  'component:ring4Back': { techId: 'containmentRing', levels: [25] },
  'component:ring2Front': { techId: 'containmentRing', levels: [8] },
  'component:ring3Front': { techId: 'containmentRing', levels: [16] },
  'component:ring4Front': { techId: 'containmentRing', levels: [25] },
  'component:ring2Bead': { techId: 'containmentRing', levels: [8] },
  'component:ring3Bead': { techId: 'containmentRing', levels: [16] },
  'component:ring4Bead': { techId: 'containmentRing', levels: [25] },
  'component:siphonTube2L': { techId: 'resonantSiphon', levels: [5] },
  'component:siphonTube2R': { techId: 'resonantSiphon', levels: [5] },
  'component:siphonArcs2': { techId: 'resonantSiphon', levels: [5] },
  'component:siphonTube3L': { techId: 'resonantSiphon', levels: [10] },
  'component:siphonTube3R': { techId: 'resonantSiphon', levels: [10] },
  'component:siphonArcs3': { techId: 'resonantSiphon', levels: [10] },
  'component:anchorGlow2L': { techId: 'graviticAnchor', levels: [2] },
  'component:anchorGlow2R': { techId: 'graviticAnchor', levels: [2] },
  'component:anchorGlow3L': { techId: 'graviticAnchor', levels: [3] },
  'component:anchorGlow3R': { techId: 'graviticAnchor', levels: [3] },
  'world:skyViolet.alphaStages[2]': { techId: 'horizonField', levels: [5] },
  'world:horizonGlow.alphaStages[0]': { techId: 'horizonField', levels: [1] },
  'world:horizonGlow.alphaStages[1]': { techId: 'horizonField', levels: [10] },
  'world:horizonGlow.alphaStages[2]': { techId: 'horizonField', levels: [20] },
  'world:ECLIPSE.stages[2]': { techId: 'horizonField', levels: [5] },
  'shadows:WORLD_SHADOWS.offRule': { techId: 'horizonField', levels: [5] },
};

/** Every threshold site of the live data, keyed like V011. */
function liveSites(): Map<string, Site> {
  const sites = new Map<string, Site>();
  for (const track of PART_TIERS) sites.set(`tier:${track.techId}`, { techId: track.techId, levels: track.levels });
  for (const id of MACHINE_COMPONENT_IDS) {
    const def = MACHINE_COMPONENTS[id];
    sites.set(`component:${id}`, { techId: def.techId, levels: [def.minLevel] });
    (def.alsoVisibleWith ?? []).forEach((alt, i) => sites.set(`alsoVisibleWith:${id}[${i}]`, { techId: alt.techId, levels: [alt.minLevel] }));
  }
  for (const layer of PARALLAX_LAYERS) {
    if (layer.visibleWhen !== undefined) {
      sites.set(`world:${layer.id}.visibleWhen`, { techId: layer.visibleWhen.techId, levels: [layer.visibleWhen.minLevel] });
    }
    (layer.alphaStages ?? []).forEach((stage, i) => sites.set(`world:${layer.id}.alphaStages[${i}]`, { techId: stage.techId, levels: [stage.minLevel] }));
  }
  ECLIPSE.stages.forEach((stage, i) => sites.set(`world:ECLIPSE.stages[${i}]`, { techId: stage.techId, levels: [stage.minLevel] }));
  sites.set('world:DUST_RISING', { techId: DUST_RISING.techId, levels: [DUST_RISING.minLevel] });
  for (const feed of PYLON_FEEDS) {
    if (feed.gate !== undefined) sites.set(`world:PYLON_FEEDS.${feed.id}.gate`, { techId: feed.gate.techId, levels: [feed.gate.minLevel] });
  }
  sites.set('shadows:WORLD_SHADOWS.offRule', { techId: WORLD_SHADOWS.offRule.techId, levels: [WORLD_SHADOWS.offRule.minLevel] });
  return sites;
}

function partsOf(id: string): number {
  return PLAN_PARTS[id] ?? 1;
}

function isSplit(id: string): boolean {
  return Object.hasOwn(SPLIT_PARTS, id);
}

describe('WP28 split tracks (A2: data = plan)', () => {
  it('SPLIT_PARTS holds exactly the 17 planned ids with their parts', () => {
    expect(Object.keys(PLAN_PARTS)).toHaveLength(17);
    expect({ ...SPLIT_PARTS }).toEqual(PLAN_PARTS);
  });

  it('every split track maxLevel is null or a multiple of its parts', () => {
    for (const id of Object.keys(SPLIT_PARTS)) {
      const max = TECHNOLOGIES[id as TechId].maxLevel;
      if (max !== null) expect(max % partsOf(id), id).toBe(0);
    }
  });

  it('every tech requirement on a split track has minLevel % parts === 0', () => {
    let checked = 0;
    for (const id of TECH_IDS) {
      for (const req of TECHNOLOGIES[id].requires) {
        if (req.type !== 'tech' || !isSplit(req.id)) continue;
        checked++;
        expect(req.minLevel % partsOf(req.id), `${id} needs ${req.id} ${req.minLevel}`).toBe(0);
      }
    }
    // The WP28 requirement table has 15 rows (about 18 requirement entries on the 17 split ids).
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it('the literal v0.11.0 table holds 49 sites: 16 part tracks, 27 staged parts (alsoVisibleWith included), 6 world sites', () => {
    const keys = Object.keys(V011);
    expect(keys.filter((k) => k.startsWith('tier:'))).toHaveLength(16);
    expect(keys.filter((k) => k.startsWith('component:'))).toHaveLength(27);
    expect(keys.filter((k) => k.startsWith('world:') || k.startsWith('shadows:'))).toHaveLength(6);
    expect(keys).toHaveLength(49);
  });

  it('every live split-track site whose level is not 1 is in the v0.11.0 table (completeness)', () => {
    const missing: string[] = [];
    for (const [key, site] of liveSites()) {
      if (!isSplit(site.techId)) continue;
      if (!site.levels.some((level) => level !== 1)) continue;
      if (V011[key] === undefined) missing.push(`${key} (${site.techId}: ${site.levels.join('/')})`);
    }
    expect(missing).toEqual([]);
  });

  it('every v0.11.0 table entry is a live site on its tech, and each level equals parts x (old - 1) + 1', () => {
    const live = liveSites();
    for (const [key, old] of Object.entries(V011)) {
      const site = live.get(key);
      expect(site, key).toBeDefined();
      if (site === undefined) continue;
      expect(site.techId, key).toBe(old.techId);
      expect(site.levels.length, key).toBe(old.levels.length);
      const parts = partsOf(old.techId);
      old.levels.forEach((was, i) => {
        expect(site.levels[i], `${key}[${i}] (was ${was})`).toBe(parts * (was - 1) + 1);
      });
    }
  });
});
