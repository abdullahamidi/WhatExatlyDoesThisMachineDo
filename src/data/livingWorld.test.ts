// Living world data tests (WP23a, WP23b): the 63 lines (31 WP23a, 32 WP23b) against bible §5.2, App. B and §7 (verbatim text, text
// rules, you slots, plaque letters, cadence config, era caps, glance gaps), placements against DENIZEN_ART §3, trigger and chain
// wiring, and sprite frames against the asset manifest. Why: every number and line of the living world lives in
// src/data/livingWorld.ts, and these tests keep that data honest against the design docs. Pure data tests (node environment, no Phaser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TECH_IDS } from './types';
import { SYSTEM_LOGS } from './systemLogs';
import { AUDIO } from './audio';
import { EDITIONS } from './edition';
import { ASSET_MANIFEST } from '../assets/manifest';
import type { AssetEntry } from '../assets/manifest';
import { PALETTE } from './palette';
import {
  DEFAULT_WORLD_SAVE, LIVING_WORLD, WORLD_BEATS, WORLD_CHAIN_STARTS, WORLD_CHAINS, WORLD_DEPTH_OFFSETS, WORLD_ENV, WORLD_ERA_CAPS, WORLD_ERA_ROW,
  WORLD_ERA_ROW_SHEETS, WORLD_FAR_PLANES, WORLD_FRAMES, WORLD_GIRL_PLACEMENTS, WORLD_GLANCE, WORLD_KNOWN_IDS, WORLD_LINES, WORLD_LOOPS,
  WORLD_MARKS, WORLD_PLACEMENTS, WORLD_PLAYBACK, WORLD_RIPPLES, WORLD_SHADOWS, WORLD_SHEET_KEYS, WORLD_LAYOUT, WORLD_SWEEP,
  WORLD_TIER_PROPS, WORLD_UNISON, WORLD_VOICE_CONFIG, seenKeyOf,
} from './livingWorld';
import type { ChainId, FramingKey, GroundId, WorldLine, WorldLoopId, WorldPlacement, WorldSheetId } from './livingWorld';

const BIBLE = readFileSync(new URL('../../docs/plan/STORY_BIBLE.md', import.meta.url), 'utf8');
const LIVING_SRC = readFileSync(new URL('./livingWorld.ts', import.meta.url), 'utf8');

// App. B text rules. PRE_BAN and YOU are copied verbatim from the bible validator (scratchpad bible/final/validate.mjs).
const PRE_BAN = /restor|prior|rewind|undo|\bheal|repair|as it was|back the way|record|hold.{0,24}run|while it runs|running|keep it|\becho|memory|\bcycle\b|wishlist|\bsteam\b|full game|trailer|tutorial/i;
const YOU = /\b(you|your|you're|you've|yours)\b/i;

const byId = (id: string): WorldLine => {
  const line = WORLD_LINES.find((l) => l.id === id);
  if (!line) throw new Error(`missing line ${id}`);
  return line;
};
const idsOf = (lines: readonly WorldLine[]): string[] => lines.map((l) => l.id);
// Pre-finale lines: not flagged post or cyc (validate.mjs `pre`).
const preFinale = WORLD_LINES.filter((l) => !l.post && !l.cyc);
// Demo-reachable lines: not postgame or cycle 2+, and listed for an era inside the demo cap (the edition, not LIVING_WORLD).
const demoMaxEra = EDITIONS.demo.maxEra;
const demoReachable = WORLD_LINES.filter((l) => !l.post && !l.cyc && demoMaxEra !== null && l.eras.some((e) => e <= demoMaxEra));

describe('WORLD_LINES counts (bible §5.2, §7.2, §8.1)', () => {
  it('holds 63 lines (31 WP23a, 32 WP23b) with unique ids', () => {
    expect(WORLD_LINES).toHaveLength(63);
    expect(new Set(idsOf(WORLD_LINES)).size).toBe(63);
  });

  it('has the per-speaker counts (bible §5.2 counts)', () => {
    const counts: Record<string, number> = {};
    for (const l of WORLD_LINES) counts[l.speaker] = (counts[l.speaker] ?? 0) + 1;
    expect(counts).toEqual({ inspector: 15, dog: 13, crow: 9, girl: 12, payphone: 14 });
  });

  it('keeps every line inside eras I-V', () => {
    expect(idsOf(WORLD_LINES.filter((l) => l.eras.some((e) => e < 1 || e > 5)))).toEqual([]);
  });

  it('flags the postgame, cycle 2+ and scripted lines exactly as the bible lists them (§5.2)', () => {
    expect(idsOf(WORLD_LINES.filter((l) => l.post)).sort()).toEqual(['INS-PG', 'PAY-12']);
    expect(idsOf(WORLD_LINES.filter((l) => l.cyc)).sort()).toEqual(['CRW-09', 'DOG-13', 'GRL-12', 'INS-14', 'PAY-13', 'PAY-14']);
    expect(idsOf(WORLD_LINES.filter((l) => l.scripted))).toEqual(['INS-PG']);
  });

  it('points every replaces at a real non-cyc line, and the replacing line is cyc', () => {
    const replacing = WORLD_LINES.filter((l) => l.replaces !== undefined);
    expect(idsOf(replacing).sort()).toEqual(['CRW-09', 'DOG-13', 'GRL-12', 'INS-14']);
    for (const l of replacing) {
      const target = WORLD_LINES.find((t) => t.id === l.replaces);
      expect(target, `target of ${l.id}`).toBeDefined();
      expect(target?.cyc, `${l.id} replaces a non-cyc line`).not.toBe(true);
      expect(l.cyc, `${l.id} is cyc`).toBe(true);
    }
    expect(replacing.map((l) => l.replaces)).toEqual(['INS-01', 'DOG-01', 'CRW-05', 'GRL-01']);
  });

  it('marks DOG-02 as a per-era repeater and no other line', () => {
    expect(idsOf(WORLD_LINES.filter((l) => l.perEra === true))).toEqual(['DOG-02']);
    expect(byId('DOG-02').eras).toEqual([1, 3]);
  });

  it('has exactly three demo-only lines, each core and once', () => {
    const demo = idsOf(WORLD_LINES.filter((l) => l.demo)).sort();
    expect(demo).toEqual(['DOG-12', 'GRL-06', 'PAY-05']);
    for (const id of demo) {
      expect(byId(id).core).toBe(true);
      expect(byId(id).once).toBe(true);
    }
  });

  // A chain is one moment for cadence (bible §6). The post-cap arc (demo lines) counts under its own cap, not era II.
  const momentKey = (id: string): string => {
    const chain = (Object.keys(WORLD_CHAINS) as ChainId[]).find((c) => c !== 'postCap' && WORLD_CHAINS[c].includes(id));
    return chain ?? id;
  };
  // Cycle variants, postgame and demo lines have their own rules (cycle 2+, postgame, post-cap), so they are not era core moments.
  const coreMoments = (era: number): string[] => [
    ...new Set(WORLD_LINES.filter((l) => l.core && !l.demo && !l.cyc && !l.post && l.eras.includes(era)).map((l) => momentKey(l.id))),
  ].sort();

  it('has era I core moments INS-01, INS-04, GRL-01 (cap 3)', () => {
    expect(coreMoments(1)).toEqual(['GRL-01', 'INS-01', 'INS-04']);
    expect(coreMoments(1)).toHaveLength(WORLD_ERA_CAPS[1].core);
  });

  it('has era II core moments: CROSSED LINES once, PAY-02, DOG-06, GRL-05, INS-07 (cap 5)', () => {
    expect(coreMoments(2)).toEqual(['DOG-06', 'GRL-05', 'INS-07', 'PAY-02', 'crossedLines']);
    expect(coreMoments(2)).toHaveLength(WORLD_ERA_CAPS[2].core);
  });

  it('has era III core moments PAY-06, GRL-07, PAY-07, INS-09 (cap 4)', () => {
    expect(coreMoments(3)).toEqual(['GRL-07', 'INS-09', 'PAY-06', 'PAY-07']);
    expect(coreMoments(3)).toHaveLength(WORLD_ERA_CAPS[3].core);
  });

  it('has era IV core moments: SYNCHRONIZATION once, PAY-08, ONE OBSERVER once, GRL-10, INS-11 (cap 5)', () => {
    expect(coreMoments(4)).toEqual(['GRL-10', 'INS-11', 'PAY-08', 'oneObserver', 'synchronization']);
    expect(coreMoments(4)).toHaveLength(WORLD_ERA_CAPS[4].core);
  });

  it('has era V core moments PAY-11, CRW-08 (cap 2)', () => {
    expect(coreMoments(5)).toEqual(['CRW-08', 'PAY-11']);
    expect(coreMoments(5)).toHaveLength(WORLD_ERA_CAPS[5].core);
  });

  it('has the bible totals per era (core + non-core): 6 / 7 / 6 / 6 / 4 (§7.2)', () => {
    const total = (era: 1 | 2 | 3 | 4 | 5): number => WORLD_ERA_CAPS[era].core + WORLD_ERA_CAPS[era].nonCore;
    expect([total(1), total(2), total(3), total(4), total(5)]).toEqual([6, 7, 6, 6, 4]);
  });

  it('has the postgame cap of one core moment (PAY-12) and no non-core', () => {
    expect(WORLD_ERA_CAPS.postgame).toEqual({ core: 1, nonCore: 0 });
    expect(idsOf(WORLD_LINES.filter((l) => l.post && l.core))).toEqual(['PAY-12']);
  });

  it('has the post-cap arc as four core moments with no non-core', () => {
    expect(WORLD_CHAINS.postCap).toHaveLength(WORLD_ERA_CAPS.postCap.core);
    expect(WORLD_ERA_CAPS.postCap.nonCore).toBe(0);
    expect(WORLD_CHAINS.postCap.every((id) => byId(id).core === true)).toBe(true);
    expect(WORLD_LINES.filter((l) => l.demo).every((l) => WORLD_CHAINS.postCap.includes(l.id))).toBe(true);
  });
});

describe('line text is verbatim from bible §5.2', () => {
  const rows = BIBLE.split(/\r?\n/);
  // The table cell as validate.mjs writes it: pipes escaped, spaces around the text.
  const cell = (text: string): string => `| ${text.replace(/\|/g, '\\|')} |`;

  it('finds every line in its own bible table row', () => {
    const missing = WORLD_LINES.filter((l) => {
      const row = rows.find((r) => r.startsWith(`| ${l.id} |`));
      return row === undefined || !row.includes(cell(l.text));
    }).map((l) => l.id);
    expect(missing).toEqual([]);
  });
});

describe('App. B text rules (validate.mjs)', () => {
  it('keeps every line at 52 characters or fewer', () => {
    expect(idsOf(WORLD_LINES.filter((l) => l.text.length > 52))).toEqual([]);
  });

  it('ends every line with a period, a question mark or an ellipsis character', () => {
    expect(idsOf(WORLD_LINES.filter((l) => !/[.?…]$/.test(l.text)))).toEqual([]);
  });

  it('has no exclamation mark and no three-dot ellipsis', () => {
    expect(idsOf(WORLD_LINES.filter((l) => /!/.test(l.text) || /\.\.\./.test(l.text)))).toEqual([]);
  });

  it('has no "restor" in any line', () => {
    expect(idsOf(WORLD_LINES.filter((l) => /restor/i.test(l.text)))).toEqual([]);
  });

  it('passes the pre-finale ban on every line not flagged post or cyc', () => {
    expect(idsOf(preFinale.filter((l) => PRE_BAN.test(l.text)))).toEqual([]);
  });

  it('matches the you flag to the you regex on pre-finale lines', () => {
    expect(idsOf(preFinale.filter((l) => YOU.test(l.text) !== (l.you === true)))).toEqual([]);
  });

  it('uses US spelling', () => {
    expect(idsOf(WORLD_LINES.filter((l) => /recognis|centre|colour|behaviour|favour/i.test(l.text)))).toEqual([]);
  });

  it('has no typographic x multiplier such as " x5"', () => {
    expect(idsOf(WORLD_LINES.filter((l) => /(^|[\s(])x\d/.test(l.text)))).toEqual([]);
  });
});

describe('you slots (A3, bible §2.5)', () => {
  const youLines = WORLD_LINES.filter((l) => l.you);
  const coreYou = (era: number): WorldLine[] => youLines.filter((l) => l.core && l.eras.includes(era));
  const extraYou = (era: number): WorldLine[] => youLines.filter((l) => !l.core && l.eras.includes(era));

  it('has at most one core you line per era', () => {
    const over = [1, 2, 3, 4, 5].filter((era) => coreYou(era).length > 1).map((era) => `era ${era}: ${idsOf(coreYou(era)).join(',')}`);
    expect(over).toEqual([]);
  });

  it('gives non-core you lines only to an era with no core you line', () => {
    const clash = [1, 2, 3, 4, 5].filter((era) => extraYou(era).length > 0 && coreYou(era).length > 0).map((era) => `era ${era}`);
    expect(clash).toEqual([]);
  });

  it('gives era I to GRL-01 (core) and era II to GRL-02 and GRL-04 (non-core)', () => {
    expect(idsOf(coreYou(1))).toEqual(['GRL-01']);
    expect(idsOf(extraYou(1))).toEqual([]);
    expect(idsOf(coreYou(2))).toEqual([]);
    expect(idsOf(extraYou(2))).toEqual(['GRL-02', 'GRL-04']);
  });

  it('gives the later core you slots to PAY-07 (III), GRL-10 (IV) and CRW-08 (V), with no non-core you line there', () => {
    expect(idsOf(coreYou(3))).toEqual(['PAY-07']);
    expect(idsOf(coreYou(4))).toEqual(['GRL-10']);
    expect(idsOf(coreYou(5))).toEqual(['CRW-08']);
    expect([3, 4, 5].flatMap((era) => idsOf(extraYou(era)))).toEqual([]);
  });
});

describe('plaque letters (A3, App. B)', () => {
  // A single-letter callout: a capital standing alone as a word, excluding A and I.
  const callouts = (text: string): string[] => text.match(/\b(?![AI]\b)[A-Z]\b/g) ?? [];

  it('keeps every demo-reachable callout within R, E, S, O', () => {
    const allowed = ['R', 'E', 'S', 'O'];
    const bad = demoReachable.flatMap((l) => callouts(l.text).filter((c) => !allowed.includes(c)).map((c) => `${l.id}:${c}`));
    expect(bad).toEqual([]);
  });

  it('keeps the INS-04 plaque (R?S????) to the letters R and S', () => {
    expect(callouts(byId('INS-04').text)).toEqual(['R', 'S']);
  });
});

describe('cadence config (bible §7.1)', () => {
  const EXPECTED_CONFIG = {
    // bible §7.1 table, in table order.
    firstMomentAfterMs: 90000, sessionWarmupMs: 60000, minGapMs: 120000, logReplyGapMs: 45000, nonCoreGapMs: 360000,
    perDenizenGapMs: 300000, toastQuietMs: 30000, afterIndexCloseMs: 2500, idleInputMs: 45000, idleInputCoreMs: 20000,
    hourCap: 8, hourCapCycle2: 4, hourWindowMs: 3600000,
    reactiveTtlMs: 90000, logReplyTtlMs: 40000, coreLogReplyTtlMs: 150000,
    bubbleBaseMs: 2600, bubblePerCharMs: 55, bubbleMinMs: 3500, bubbleMaxMs: 6500, bubbleFadeMs: 150,
    turnHoldBeforeMs: 300, turnHoldAfterMs: 600, sysLogDeferMaxMs: 6500,
    // Timings the bible states in its own sections (§5.1 +1 s, §6 1.2 s / 2 bubbles / 60 %, §7.6 glances, §8.2 post-cap, §10 ear flick).
    logReplyAfterClearMs: 1000, chainStepAfterMs: 1200, chainMaxBubbles: 2, seenFraction: 0.6,
    glanceHoldMs: 1500, glanceNoBubbleNearMs: 10000,
    offlineAfterWelcomeMs: 8000, offlineMinS: 3600, rapidClicksPerS: 6, rapidWindowMs: 3000,
    postCapFirstMs: 20000, postCapGapMs: 120000, tapeFreezeMs: 1200, earFlickGapMs: 10000,
    // Design-spec timings (WP23 A2 / A10, DENIZEN_ART §4.2).
    dialToneMaxMs: 2000, rippleOutsideGapMs: 4000, placeWaitMs: 10000, placeBlockLimit: 2, ladderRecheckMs: 250, viewInsetPx: 16,
    // No design row names these. Pinned here so a change shows up in review.
    crossedLinesPrelude: { dialToneMs: 1200, ringMs: 1000 }, ringGapMs: 300000, tickClampMs: 250,
    // WP23b timings (bible §7.1 era entry and opener; §6.1 SYNCHRONIZATION unison hold and cap).
    eraEntryAfterCardMs: 3000, openerAfterPurchaseMs: 60000, unisonHoldMs: 4800, unisonCapMs: 12000,
  };

  it('equals the bible table values and the named timings', () => {
    expect(WORLD_VOICE_CONFIG).toEqual(EXPECTED_CONFIG);
  });

  it('gives a 52-character bubble 5460 ms, clamped to 3500-6500', () => {
    const c = WORLD_VOICE_CONFIG;
    expect(Math.min(c.bubbleMaxMs, Math.max(c.bubbleMinMs, c.bubbleBaseMs + c.bubblePerCharMs * 52))).toBe(5460);
  });

  it('has era caps for eras I-V, the post-cap arc and the postgame, with the bible core and non-core counts (§7.2)', () => {
    expect(WORLD_ERA_CAPS).toEqual({
      1: { core: 3, nonCore: 3 }, 2: { core: 5, nonCore: 2 }, 3: { core: 4, nonCore: 2 }, 4: { core: 5, nonCore: 1 },
      5: { core: 2, nonCore: 2 }, postCap: { core: 4, nonCore: 0 }, postgame: { core: 1, nonCore: 0 },
    });
    const total = (k: 1 | 2 | 3 | 4 | 5 | 'postCap'): number => WORLD_ERA_CAPS[k].core + WORLD_ERA_CAPS[k].nonCore;
    expect([total(1), total(2), total(3), total(4), total(5), total('postCap')]).toEqual([6, 7, 6, 6, 4, 4]);
  });

  it('has glance gaps for eras I-IV: 6-9, 5-8, 4-7 and 3-5 min (§7.6); era V has none (the stare)', () => {
    expect(WORLD_GLANCE).toEqual({
      1: { minMs: 360000, maxMs: 540000 }, 2: { minMs: 300000, maxMs: 480000 },
      3: { minMs: 240000, maxMs: 420000 }, 4: { minMs: 180000, maxMs: 300000 },
    });
    for (const era of [1, 2, 3, 4] as const) expect(WORLD_GLANCE[era].minMs).toBeLessThanOrEqual(WORLD_GLANCE[era].maxMs);
  });

  it('has the ripple lists for eras I-V (§10): one per tier-up release, era III to V added', () => {
    expect(WORLD_RIPPLES).toEqual({
      1: ['pebbles', 'receiverStep', 'crowTip'], 2: ['lampBright', 'dogBristle'], 3: ['gust'], 4: ['sway', 'puddleRing'],
      5: ['shadowFlick', 'doubleExposure'],
    });
  });
});

describe('placements (DENIZEN_ART §3, rows e1 / s8 / s8w / s9)', () => {
  const FRAMINGS: readonly ('e1' | 's8' | 's8w' | 's9')[] = ['e1', 's8', 's8w', 's9'];
  // Expected tables written from DENIZEN_ART §3 (feet x in world px). Stake = dog x - 16; hole = dog x + 30 (front row, §1.4).
  // WP27 F6.1: Sensor 7 and the clock stand at s8; the s8w row (capacitorBank or sparkGap before the transformer) has Sensor 7 and
  // no clock (documented exemption). The girl is a window or pylon-foot plane and has no ground placement.
  const EXPECTED: Record<'e1' | 's8' | 's8w' | 's9', Partial<Record<GroundId, WorldPlacement>>> = {
    e1: {
      sensor7: { x: 1384, row: 'back' },
      inspector: { x: 1472, row: 'back', route: [1448, 1496] },
      dog: { x: 2364, row: 'front' },
      clock: { x: 2516, row: 'back' },
      payphone: { x: 2420, row: 'back' },
      lamp: { x: 2476, row: 'back' },
      crow: { x: 2476, row: 'back' },
      stakeChain: { x: 2348, row: 'front' },
      hole: { x: 2394, row: 'front' },
      scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
    },
    s8: {
      sensor7: { x: 1470, row: 'back' },
      inspector: { x: 1536, row: 'back' },
      dog: { x: 2604, row: 'front' },
      clock: { x: 2680, row: 'back' },
      payphone: { x: 2604, row: 'back' },
      lamp: { x: 2656, row: 'back' },
      crow: { x: 2656, row: 'back' },
      stakeChain: { x: 2588, row: 'front' },
      hole: { x: 2634, row: 'front' },
      scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
    },
    s8w: {
      sensor7: { x: 1500, row: 'back' },
      inspector: { x: 1552, row: 'back' },
      dog: { x: 2694, row: 'front' },
      payphone: { x: 2678, row: 'back' },
      lamp: { x: 2720, row: 'back' },
      crow: { x: 2720, row: 'back' },
      stakeChain: { x: 2676, row: 'front' },
      hole: { x: 2716, row: 'front' },
      scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
    },
    s9: {
      sensor7: { x: 1384, row: 'back' },
      inspector: { x: 1472, row: 'back', route: [1448, 1496] },
      dog: { x: 2856, row: 'front' },
      clock: { x: 2900, row: 'back' },
      payphone: { x: 2944, row: 'back' },
      lamp: { x: 2996, row: 'back' },
      crow: { x: 2996, row: 'back' },
      stakeChain: { x: 2840, row: 'front' },
      hole: { x: 2886, row: 'front' },
      scraps: { x: 1330, row: 'back', xs: [1330, 1420, 1530] },
    },
  };

  it.each(FRAMINGS)('%s equals its DENIZEN_ART §3 row', (key) => {
    expect(WORLD_PLACEMENTS[key]).toEqual(EXPECTED[key]);
  });

  it('has a row for all ten framing keys (WP23b late framings and the WP27 s8w pose included)', () => {
    const ALL: FramingKey[] = ['e1', 's8', 's8w', 's9', 's10', 's11', 's15', 'portrait', 'baseL', 'baseR'];
    expect(Object.keys(WORLD_PLACEMENTS).sort()).toEqual([...ALL].sort());
  });

  it('fills the late rows (WP23b R6, WP27 F6.5): the lantern sits at x 965 wherever it stands, the girl only in her framings', () => {
    expect(WORLD_PLACEMENTS.s10).toEqual({
      sensor7: { x: 1234, row: 'back' }, inspector: { x: 1276, row: 'back' }, dog: { x: 2858, row: 'front' }, payphone: { x: 2858, row: 'back' },
      stakeChain: { x: 2842, row: 'front' }, hole: { x: 2888, row: 'front' },
    });
    expect(WORLD_PLACEMENTS.s11.scraps).toEqual({ x: 690, row: 'back', xs: [690, 830, 960] });
    expect(WORLD_PLACEMENTS.s11.sensor7).toEqual({ x: 750, row: 'back' });
    expect(WORLD_PLACEMENTS.s11.inspector).toEqual({ x: 816, row: 'back', route: [792, 840] });
    expect(WORLD_PLACEMENTS.portrait.inspector).toEqual({ x: 784, row: 'back' });
    for (const key of ['s15', 'portrait', 'baseL'] as const) expect(WORLD_PLACEMENTS[key].lantern, key).toEqual({ x: 965, row: 'front', dy: 40, inner: true });
    expect(WORLD_PLACEMENTS.baseL).not.toHaveProperty('dog');
    expect(WORLD_PLACEMENTS.baseR.dog).toEqual({ x: 2856, row: 'front', inner: true });
    expect(WORLD_GIRL_PLACEMENTS.s11).toEqual({ ground: { x: 880, row: 'back' }, era5: { x: 976, row: 'front' } });
    expect(WORLD_GIRL_PLACEMENTS.s15).toEqual({ era5: { x: 976, row: 'front', inner: true } });
    expect(WORLD_GIRL_PLACEMENTS.baseL).toBeUndefined();
  });

  // Every framing with a row, so the route, integer and stake checks cover the late rows too.
  const ROWED: FramingKey[] = ['e1', 's8', 's8w', 's9', 's10', 's11', 's15', 'portrait', 'baseL', 'baseR'];
  const placed = ROWED.flatMap((f) =>
    Object.entries(WORLD_PLACEMENTS[f]).flatMap(([ground, p]) => (p ? [{ where: `${f}.${ground}`, p }] : [])),
  );

  it('uses integer x values only', () => {
    const bad = placed
      .filter(({ p }) => !Number.isInteger(p.x) || (p.xs ?? []).some((x) => !Number.isInteger(x)))
      .map(({ where }) => where);
    expect(bad).toEqual([]);
  });

  it('keeps every route 48 wide and centred on its placement x', () => {
    const routed = placed.filter(({ p }) => p.route !== undefined);
    expect(routed.map(({ where }) => where)).toEqual(['e1.inspector', 's9.inspector', 's11.inspector', 's15.inspector']);
    const bad = routed
      .filter(({ p }) => p.route !== undefined && (p.route[1] - p.route[0] !== 48 || (p.route[0] + p.route[1]) / 2 !== p.x))
      .map(({ where }) => where);
    expect(bad).toEqual([]);
  });

  it('places the stake 16 px behind the dog and the hole 30 px ahead of it, in every framing with a dog (s8w: 18 and 22, the right wing)', () => {
    // WP27 F6.1: at s8w the right wing ends at 2720 (cx 2104), so the stake sits 18 px behind the dog and the hole 22 px ahead.
    const OFFSETS: Partial<Record<FramingKey, { stake: number; hole: number }>> = { s8w: { stake: -18, hole: 22 } };
    const withDog = ROWED.filter((f) => WORLD_PLACEMENTS[f].dog !== undefined);
    expect(withDog).toEqual(['e1', 's8', 's8w', 's9', 's10', 's11', 's15', 'portrait', 'baseR']);
    for (const f of withDog) {
      const dogX = WORLD_PLACEMENTS[f].dog?.x;
      const off = OFFSETS[f] ?? { stake: -16, hole: 30 };
      expect(dogX, `dog x in ${f}`).toBeDefined();
      if (WORLD_PLACEMENTS[f].stakeChain !== undefined) expect(WORLD_PLACEMENTS[f].stakeChain?.x).toBe((dogX ?? 0) + off.stake);
      if (WORLD_PLACEMENTS[f].hole !== undefined) expect(WORLD_PLACEMENTS[f].hole?.x).toBe((dogX ?? 0) + off.hole);
    }
  });

  it('the s8w tripod (16 px either side of 1500) clears the Inspector body (14 px left of 1552)', () => {
    // WP27 F6.1 / ART_AUDIT WP27 (a): Sensor 7 left of the far-plane mini, the Inspector right of it. The mini itself is tested in
    // worldPlacement.test.ts (the girl mini at s8w).
    const sensor = WORLD_PLACEMENTS.s8w.sensor7?.x ?? NaN;
    const inspector = WORLD_PLACEMENTS.s8w.inspector?.x ?? NaN;
    expect(sensor).toBe(1500);
    expect(inspector).toBe(1552);
    expect(sensor + 16).toBeLessThan(inspector - 14);
  });

  it('the s8 cycle 3+ girl (1504) stands in the mini slot: clear of the tripod (1470 + 16) and of the Inspector body (1536 - 14)', () => {
    // ART_AUDIT WP27 (b): the girl's body reaches 14 px left and 10 px right of her x; the tripod is 16 px either side of its foot.
    const girl = WORLD_GIRL_PLACEMENTS.s8?.ground?.x ?? NaN;
    const sensor = WORLD_PLACEMENTS.s8.sensor7?.x ?? NaN;
    const inspector = WORLD_PLACEMENTS.s8.inspector?.x ?? NaN;
    expect(girl).toBe(1504);
    expect(girl - 14).toBeGreaterThan(sensor + 16);
    expect(girl + 10).toBeLessThan(inspector - 14);
  });
});

describe('trigger wiring', () => {
  it('names only real tech ids in owned, tier, buy and ms triggers and in the tier and playback props', () => {
    const techs: string[] = [];
    for (const l of WORLD_LINES) {
      const t = l.trigger;
      if (t.kind === 'buy' || t.kind === 'ms') techs.push(t.techId);
      else if (t.kind === 'tier' && t.techId !== undefined) techs.push(t.techId);
      else if (t.kind === 'idle' && t.owned) techs.push(...t.owned);
    }
    techs.push(
      WORLD_TIER_PROPS.holeTech, ...WORLD_TIER_PROPS.lampFlickerTechs, WORLD_TIER_PROPS.dogLine.techId,
      WORLD_PLAYBACK.crankTech, WORLD_PLAYBACK.pistonTech,
    );
    expect(techs.length).toBeGreaterThan(0);
    expect(techs.filter((id) => !(TECH_IDS as readonly string[]).includes(id))).toEqual([]);
  });

  it('points logReply and afterLog triggers at real SYS LOG ids, copper-memory included', () => {
    const logIds = new Set(SYSTEM_LOGS.map((l) => l.id));
    const refs: string[] = [];
    for (const l of WORLD_LINES) {
      const t = l.trigger;
      if (t.kind === 'logReply') refs.push(t.logId);
      if (t.kind === 'idle' && t.afterLog !== undefined) refs.push(t.afterLog);
    }
    expect(refs).toContain('copper-memory');
    expect(refs.filter((id) => !logIds.has(id))).toEqual([]);
  });

  it('points every afterLine at a real line', () => {
    const lineIds = new Set(WORLD_LINES.map((l) => l.id));
    const refs: string[] = [];
    for (const l of WORLD_LINES) {
      const t = l.trigger;
      if (t.kind === 'idle' && t.afterLine !== undefined) refs.push(t.afterLine);
    }
    expect(refs).toEqual(['GRL-01', 'INS-10']);
    expect(refs.filter((id) => !lineIds.has(id))).toEqual([]);
  });

  it('plays INS-12 at the era V shadow rule (horizonField 5) and keeps livingWorld.ts free of worldEras (app chunk)', () => {
    expect(byId('INS-12').trigger).toEqual({ kind: 'buy', techId: WORLD_SHADOWS.offRule.techId, minLevel: WORLD_SHADOWS.offRule.minLevel });
    expect(byId('INS-12').eras).toEqual([WORLD_SHADOWS.offEra]);
    expect(LIVING_SRC).not.toMatch(/from\s+['"]\.\/worldEras['"]/);
  });

  it('names only real tech ids in the WP23b triggers (reliefValves, horizonField, echoCrank and the rest)', () => {
    const names = ['reliefValves', 'pressureVesselBlueprint', 'harmonicConvergence', 'horizonField', 'echoCrank', 'finalAlignment', 'skyAperture', 'generator'];
    const techIds = TECH_IDS as readonly string[];
    expect(names.filter((id) => !techIds.includes(id))).toEqual([]);
    expect(byId('INS-12').trigger).toEqual({ kind: 'buy', techId: 'horizonField', minLevel: 5 });
    expect(byId('CRW-07').trigger).toEqual({ kind: 'buy', techId: 'echoCrank' });
    expect(byId('GRL-11').trigger).toEqual({ kind: 'idle', owned: ['skyAperture'] });
    expect(byId('INS-09').trigger).toEqual({ kind: 'ms', techId: 'pressureVesselBlueprint' });
    expect(byId('INS-11').trigger).toEqual({ kind: 'ms', techId: 'harmonicConvergence' });
    expect(byId('CRW-08').trigger).toEqual({ kind: 'ms', techId: 'finalAlignment' });
    expect(byId('INS-08').trigger).toEqual({ kind: 'idle', owned: ['reliefValves'] });
    expect(byId('DOG-08').trigger).toEqual({ kind: 'idle', owned: ['reliefValves'] });
  });

  it('names only real SYS LOG ids in the WP23b logReply triggers and the chain starts', () => {
    const logIds = new Set(SYSTEM_LOGS.map((l) => l.id));
    for (const id of ['steam-rain', 'signal-below', 'operator-located']) expect(logIds.has(id), id).toBe(true);
    expect(byId('GRL-07').trigger).toEqual({ kind: 'logReply', logId: 'steam-rain' });
    expect(byId('PAY-08').trigger).toEqual({ kind: 'logReply', logId: 'signal-below' });
    expect(byId('PAY-11').trigger).toEqual({ kind: 'logReply', logId: 'operator-located' });
  });

  it('keeps the chains in step order with matching triggers', () => {
    expect(WORLD_CHAINS).toEqual({
      crossedLines: ['PAY-01', 'CRW-04', 'INS-05'],
      synchronization: ['DOG-09', 'CRW-06', 'PAY-09'],
      oneObserver: ['INS-10', 'GRL-09'],
      postCap: ['PAY-05', 'INS-07', 'GRL-06', 'DOG-12'],
    });
    WORLD_CHAINS.crossedLines.forEach((id, i) => {
      expect(byId(id).trigger, id).toEqual({ kind: 'chain', chainId: 'crossedLines', step: i + 1 });
    });
    WORLD_CHAINS.postCap.forEach((id, i) => {
      if (id === 'INS-07') expect(byId(id).trigger, id).toEqual({ kind: 'ms', techId: 'substationBlueprint' });
      else expect(byId(id).trigger, id).toEqual({ kind: 'postCap', step: i + 1 });
    });
    // SYNCHRONIZATION: DOG-09 and CRW-06 are step 1 (one frame, the unison pair); PAY-09 is step 2.
    expect(byId('DOG-09').trigger).toEqual({ kind: 'chain', chainId: 'synchronization', step: 1 });
    expect(byId('CRW-06').trigger).toEqual({ kind: 'chain', chainId: 'synchronization', step: 1 });
    expect(byId('PAY-09').trigger).toEqual({ kind: 'chain', chainId: 'synchronization', step: 2 });
    // ONE OBSERVER: INS-10 is step 1, GRL-09 is step 2.
    expect(byId('INS-10').trigger).toEqual({ kind: 'chain', chainId: 'oneObserver', step: 1 });
    expect(byId('GRL-09').trigger).toEqual({ kind: 'chain', chainId: 'oneObserver', step: 2 });
  });

  it('pairs the unison members and starts the two new chains from real triggers', () => {
    expect(WORLD_UNISON).toEqual([['DOG-09', 'CRW-06']]);
    expect(Object.keys(WORLD_CHAIN_STARTS).sort()).toEqual(['crossedLines', 'oneObserver', 'synchronization']);
    expect(WORLD_CHAIN_STARTS.crossedLines).toEqual({ kind: 'buy', techId: 'generator' });
    expect(WORLD_CHAIN_STARTS.synchronization).toEqual({ kind: 'logReply', logId: 'sync-success' });
    expect(WORLD_CHAIN_STARTS.oneObserver).toEqual({ kind: 'logReply', logId: 'observer-one' });
    const logIds = new Set(SYSTEM_LOGS.map((l) => l.id));
    const starts = Object.values(WORLD_CHAIN_STARTS);
    expect(starts.filter((s) => s.kind === 'logReply' && !logIds.has(s.logId))).toEqual([]);
    expect(starts.filter((s) => s.kind === 'buy' && !(TECH_IDS as readonly string[]).includes(s.techId))).toEqual([]);
  });
});

describe('sprite frames and loops (DENIZEN_ART §5.1)', () => {
  const SHEETS = Object.keys(WORLD_FRAMES) as WorldSheetId[];
  const LOOP_SHEET: Record<WorldLoopId, WorldSheetId> = { receiver: 'receiver' };
  // Asset registry lookup by key. The manifest is typed by AssetId, so index it as plain strings.
  const manifestEntry = (key: string): AssetEntry | undefined => (ASSET_MANIFEST as Record<string, AssetEntry | undefined>)[key];

  it('has 24 sheets (17 WP23a, 7 WP23b) and era rows I-V plus whole', () => {
    expect(SHEETS).toHaveLength(24);
    expect(Object.keys(WORLD_ERA_ROW)).toHaveLength(6);
    // Era rows stay on the seven cast and booth sheets; the WP23b ids are single-row sheets.
    expect(WORLD_ERA_ROW_SHEETS).toHaveLength(7);
    expect(WORLD_ERA_ROW_SHEETS.some((s) => ['puddle', 'sprout', 'lantern', 'redBall', 'clipboardPages', 'page', 'virga'].includes(s))).toBe(false);
  });

  it('lays the WP23b sheet ids (R7) out as their manifest cells: frames x cell size, virga stacked', () => {
    const NEW: WorldSheetId[] = ['puddle', 'sprout', 'lantern', 'redBall', 'clipboardPages', 'page', 'virga'];
    expect(WORLD_FRAMES.puddle).toEqual(['size1Grey', 'size1Ring', 'size1Black', 'size2Grey', 'size2Ring', 'size2Black', 'size3Grey', 'size3Ring', 'size3Black', 'whole']);
    expect(WORLD_FRAMES.virga).toEqual(['fall', 'frozen']);
    expect(WORLD_SHEET_KEYS.virga).toBe('bg.virga');
    for (const sheet of NEW) {
      const entry = manifestEntry(WORLD_SHEET_KEYS[sheet]);
      expect(entry, sheet).toBeDefined();
      if (entry === undefined) continue;
      const cw = entry.frame?.width ?? entry.width;
      const ch = entry.frame?.height ?? entry.height;
      expect(entry.width % cw, `${sheet} width`).toBe(0);
      expect(entry.height % ch, `${sheet} height`).toBe(0);
      expect((entry.width / cw) * (entry.height / ch), sheet).toBe(WORLD_FRAMES[sheet].length);
      expect(entry.frame?.count ?? 1, sheet).toBe(WORLD_FRAMES[sheet].length);
    }
  });

  it('names only frames that exist on the loop sheet', () => {
    expect(Object.keys(LOOP_SHEET).sort()).toEqual(Object.keys(WORLD_LOOPS).sort());
    const missing: string[] = [];
    for (const loop of Object.keys(WORLD_LOOPS) as WorldLoopId[]) {
      for (const step of WORLD_LOOPS[loop]) {
        if (!WORLD_FRAMES[LOOP_SHEET[loop]].includes(step.frame)) missing.push(`${loop}:${step.frame}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(SHEETS)('%s frame count equals the manifest (x6 era rows where stacked; one frame when the entry has no frame grid)', (sheet) => {
    const rows = WORLD_ERA_ROW_SHEETS.includes(sheet) ? Object.keys(WORLD_ERA_ROW).length : 1;
    const entry = manifestEntry(WORLD_SHEET_KEYS[sheet]);
    expect(entry, WORLD_SHEET_KEYS[sheet]).toBeDefined();
    expect(entry?.frame?.count ?? 1).toBe(WORLD_FRAMES[sheet].length * rows);
  });
});

describe('save defaults and known ids (A5, D9)', () => {
  it('starts with an empty world save', () => {
    expect(DEFAULT_WORLD_SAVE).toEqual({ seen: [], seenEver: [], eraMoments: [0, 0, 0, 0, 0], youEras: 0 });
  });

  it('keeps the three wordless beats (WP23b adds the sensor turn)', () => {
    expect(WORLD_BEATS).toEqual(['beat.tapeFreeze', 'beat.failedSync', 'beat.sensorTurn']);
  });

  it('knows every non-scripted line id, the per-era key of DOG-02, and the beats, and nothing else', () => {
    const expected = [...idsOf(WORLD_LINES.filter((l) => l.scripted !== true)), 'DOG-02@3', ...WORLD_BEATS].sort();
    expect(Array.from(WORLD_KNOWN_IDS).sort()).toEqual(expected);
  });

  it('knows DOG-02@3 and beat.sensorTurn, never INS-PG, and keeps the plain DOG-02 (WP23a saves)', () => {
    expect(WORLD_KNOWN_IDS.has('DOG-02@3')).toBe(true);
    expect(WORLD_KNOWN_IDS.has('DOG-02')).toBe(true);
    expect(WORLD_KNOWN_IDS.has('beat.sensorTurn')).toBe(true);
    expect(WORLD_KNOWN_IDS.has('INS-PG')).toBe(false);
    // 63 lines minus the scripted INS-PG, plus DOG-02@3, plus the 3 beats.
    expect(WORLD_KNOWN_IDS.size).toBe(66);
  });
});

describe('per-era seen keys (bible §7.8, DOG-02 once in each listed era)', () => {
  const dog02 = byId('DOG-02');
  const cyc = byId('INS-14');

  it('keeps the plain id in the first listed era and suffixes the later eras', () => {
    expect(seenKeyOf(dog02, 1)).toBe('DOG-02');
    expect(seenKeyOf(dog02, 3)).toBe('DOG-02@3');
  });

  it('keeps the plain id for a line that is not per era, in any era', () => {
    expect(seenKeyOf(cyc, 1)).toBe('INS-14');
    expect(seenKeyOf(byId('DOG-03'), 3)).toBe('DOG-03');
  });

});

describe('postgame and opener triggers (bible §5.1, §9.2, §7.1)', () => {
  it('carries the postgame minimums: INS-PG at 0 s (scripted), PAY-12 at 600 s', () => {
    expect(byId('INS-PG').trigger).toEqual({ kind: 'postgame', minS: 0 });
    expect(byId('PAY-12').trigger).toEqual({ kind: 'postgame', minS: 600 });
  });

  it('carries the cycle openers: PAY-13 at cycle 2 only, PAY-14 from cycle 3', () => {
    expect(byId('PAY-13').trigger).toEqual({ kind: 'opener', fromCycle: 2, toCycle: 2 });
    expect(byId('PAY-14').trigger).toEqual({ kind: 'opener', fromCycle: 3 });
  });

  it('places PAY-06 on era III entry and PAY-07 after 900 s of era III', () => {
    expect(byId('PAY-06').trigger).toEqual({ kind: 'eraEntry', era: 3 });
    expect(byId('PAY-07').trigger).toEqual({ kind: 'idle', minEraS: 900 });
  });
});

describe('LIVING_WORLD layer ceiling (WP23b)', () => {
  it('is era 5 (the layer runs through eras I-V)', () => {
    expect(LIVING_WORLD.maxEra).toBe(5);
  });
});

describe('text sweep feed (A3, Appendix B)', () => {
  it('sweeps the 63 line texts', () => {
    expect(WORLD_SWEEP).toHaveLength(63);
    expect(WORLD_SWEEP.map((e) => e.text)).toEqual(WORLD_LINES.map((l) => l.text));
  });
});

describe('WP23a layout, environment and audio pins (W1-C)', () => {
  it('pins the crank hub, its clearance, the gain block and the wing clearance (DENIZEN_ART §3, §4.2)', () => {
    expect(WORLD_LAYOUT.crankHub).toEqual({ x: 1920, y: 1568 });
    expect(WORLD_LAYOUT.crankClearPx).toBe(24);
    expect(WORLD_LAYOUT.gainBox).toEqual({ w: 200, h: 120 });
    expect(WORLD_LAYOUT.wingClearPx).toBe(24);
  });

  it('pins the ten framing reference poses (WP23b R6, WP27 F6.1 s8w) with unique keys', () => {
    expect(WORLD_LAYOUT.framingPoses).toEqual([
      { key: 'e1', zoom: 1, centerX: 1920 }, { key: 's8', zoom: 1, centerX: 2064 }, { key: 's8w', zoom: 1, centerX: 2112 },
      { key: 's9', zoom: 0.75, centerX: 2192 }, { key: 's10', zoom: 0.75, centerX: 2055 }, { key: 's11', zoom: 0.5, centerX: 1922 },
      { key: 's15', zoom: 0.5, centerX: 1920 }, { key: 'portrait', zoom: 0.5, centerX: 1920 }, { key: 'baseL', zoom: 1, centerX: 1320 },
      { key: 'baseR', zoom: 1, centerX: 2520 },
    ]);
    const keys: FramingKey[] = WORLD_LAYOUT.framingPoses.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('pins the inner gap (anchor 64 + wing clearance 24) and the WP23b data keys (R6, Z11)', () => {
    expect(WORLD_LAYOUT.innerClearPx).toBe(88);
    expect(WORLD_LAYOUT.innerClearPx).toBe(64 + WORLD_LAYOUT.wingClearPx);
    expect(WORLD_FAR_PLANES.girlMiniNear).toEqual({ tileOriginX: 64, footArtX: 146, footArtY: 157 });
    expect(WORLD_ENV.sensor7.ledColors.green).toBe(PALETTE.green2);
    expect(WORLD_ENV.motes.fallArtPx).toBe(24);
    expect(WORLD_ENV.receiverOnHookArt).toEqual({ x: 13, y: -34 });
    expect(WORLD_MARKS.fogColor).toBe(0xddc9a3);
    expect(WORLD_GIRL_PLACEMENTS.e1?.ground).toEqual({ x: 1552, row: 'back' });
    expect(WORLD_GIRL_PLACEMENTS.s8?.ground).toEqual({ x: 1504, row: 'back' });
    expect(WORLD_GIRL_PLACEMENTS.s9?.ground).toEqual({ x: 1552, row: 'back' });
    expect(WORLD_GIRL_PLACEMENTS.s8w).toBeUndefined();
  });

  it('cycle 3 girl clears the 1530 scrap by 6 px and the Inspector spots by 48 px (e1 and s9; s8 has its own test)', () => {
    // Her boots reach 8 world px left of her x (the art origin is x 8 of 16). The scrap is 16 px wide, centred on its x.
    const GIRL_BOOT_REACH = 8;
    const SCRAP_HALF_WIDTH = 8;
    const INSPECTOR_SPOTS = [1448, 1472, 1496];
    for (const key of ['e1', 's9'] as const) {
      const girlX = WORLD_GIRL_PLACEMENTS[key]?.ground?.x;
      expect(girlX, key).toBeDefined();
      if (girlX === undefined) continue;
      const scrapRight = Math.max(...(WORLD_PLACEMENTS[key].scraps?.xs ?? [])) + SCRAP_HALF_WIDTH;
      expect(girlX - GIRL_BOOT_REACH, key).toBeGreaterThanOrEqual(scrapRight + 6);
      for (const spot of INSPECTOR_SPOTS) expect(Math.abs(girlX - spot), `${key} spot ${spot}`).toBeGreaterThanOrEqual(48);
    }
  });

  it('pins the head reserve values and their shape', () => {
    const r = WORLD_LAYOUT.headReserve;
    expect(r).toEqual({ padWorldPx: { inspector: 36, other: 12 }, aboveGamePx: 4, heightGamePx: 24 });
    for (const v of [r.padWorldPx.inspector, r.padWorldPx.other, r.aboveGamePx, r.heightGamePx]) {
      expect(Number.isFinite(v) && v >= 0).toBe(true);
    }
    expect(r.heightGamePx).toBeGreaterThan(0);
  });

  it('pins the lamp glow as a faint halo: 0.4 steady, 0.2 more on a ripple', () => {
    expect(WORLD_ENV.lampGlow).toEqual({ alpha: 0.4, bumpAlpha: 0.2 });
    expect(WORLD_ENV.lampGlow.alpha).toBeGreaterThan(WORLD_ENV.lampGlow.bumpAlpha);
    expect(WORLD_ENV.lampGlow.bumpAlpha).toBeGreaterThan(0);
  });

  it('pins the pebble spots at -36 and 36 world px, one per drawn pebble at least', () => {
    expect(WORLD_ENV.pebbles).toEqual({ count: 2, hopPx: 2, spotsWorldPx: [-36, 36] });
    expect(WORLD_ENV.pebbles.spotsWorldPx.length).toBeGreaterThanOrEqual(WORLD_ENV.pebbles.count);
  });

  it('pins the window dim level strictly between off and lit', () => {
    expect(WORLD_ENV.windowDimLevel).toBe(0.85);
    expect(WORLD_ENV.windowDimLevel).toBeGreaterThan(0);
    expect(WORLD_ENV.windowDimLevel).toBeLessThan(1);
  });

  it('pins the steady era of playback to era II', () => {
    expect(WORLD_PLAYBACK.steadyEra).toBe(2);
  });

  it('pins the blip cap to 8 on the audio data', () => {
    expect(AUDIO.world.maxBlips).toBe(8);
  });

  it('keeps the visitor depth above every shadow and below the residents, and every other resident offset at or above the row (WP23b FX6)', () => {
    expect(WORLD_DEPTH_OFFSETS.shadow).toBeLessThan(WORLD_DEPTH_OFFSETS.visitor);
    expect(WORLD_DEPTH_OFFSETS.visitor).toBeLessThan(WORLD_DEPTH_OFFSETS.cast);
    expect(WORLD_DEPTH_OFFSETS.visitor).toBeLessThan(0);
    const exempt: string[] = ['shadow', 'scraps', 'hole', 'visitor'];
    for (const [kind, offset] of Object.entries(WORLD_DEPTH_OFFSETS)) {
      if (exempt.includes(kind)) continue;
      expect(offset, kind).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('living world data source', () => {
  it('imports nothing from Phaser', () => {
    const src = readFileSync(new URL('./livingWorld.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"]phaser/i);
    expect(src).not.toMatch(/require\(\s*['"]phaser/i);
  });
});
