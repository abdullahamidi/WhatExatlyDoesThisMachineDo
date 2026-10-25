// Living world data tests (WP23a): the 31 WP23a lines against bible §5.2, App. B and §7 (verbatim text, text rules, you slots,
// plaque letters, cadence config, era caps, glance gaps), placements against DENIZEN_ART §3, trigger and chain wiring, and sprite
// frames against the asset manifest. Why: every number and line of the living world lives in src/data/livingWorld.ts, and these
// tests keep that data honest against the design docs. Pure data tests (node environment, no Phaser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TECH_IDS } from './types';
import { SYSTEM_LOGS } from './systemLogs';
import { AUDIO } from './audio';
import { ASSET_MANIFEST } from '../assets/manifest';
import type { AssetEntry } from '../assets/manifest';
import {
  DEFAULT_WORLD_SAVE, LIVING_WORLD, WORLD_BEATS, WORLD_CHAINS, WORLD_ENV, WORLD_ERA_CAPS, WORLD_ERA_ROW, WORLD_ERA_ROW_SHEETS,
  WORLD_FRAMES, WORLD_GLANCE, WORLD_KNOWN_IDS, WORLD_LINES, WORLD_LOOPS, WORLD_PLACEMENTS, WORLD_PLAYBACK, WORLD_SHEET_KEYS,
  WORLD_LAYOUT, WORLD_SWEEP, WORLD_TIER_PROPS, WORLD_VOICE_CONFIG,
} from './livingWorld';
import type { ChainId, FramingKey, GroundId, LoopFrame, WorldLine, WorldLoopId, WorldPlacement, WorldSheetId } from './livingWorld';

const BIBLE = readFileSync(new URL('../../docs/plan/STORY_BIBLE.md', import.meta.url), 'utf8');

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
// Demo-reachable lines: not postgame or cycle 2+, and every era sits inside the demo gate.
const demoReachable = WORLD_LINES.filter((l) => !l.post && !l.cyc && l.eras.every((e) => e <= LIVING_WORLD.maxEra));

describe('WORLD_LINES counts (bible §5.2, §7.2, §8.1)', () => {
  it('holds 31 lines with unique ids', () => {
    expect(WORLD_LINES).toHaveLength(31);
    expect(new Set(idsOf(WORLD_LINES)).size).toBe(31);
  });

  it('has the per-speaker counts', () => {
    const counts: Record<string, number> = {};
    for (const l of WORLD_LINES) counts[l.speaker] = (counts[l.speaker] ?? 0) + 1;
    expect(counts).toEqual({ inspector: 8, dog: 8, crow: 4, girl: 6, payphone: 5 });
  });

  it('keeps every line in era I or II, with no post or cyc flag', () => {
    expect(idsOf(WORLD_LINES.filter((l) => l.eras.some((e) => e !== 1 && e !== 2)))).toEqual([]);
    expect(idsOf(WORLD_LINES.filter((l) => l.post || l.cyc))).toEqual([]);
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
  const coreMoments = (era: number): string[] => [
    ...new Set(WORLD_LINES.filter((l) => l.core && !l.demo && l.eras.includes(era)).map((l) => momentKey(l.id))),
  ].sort();

  it('has era I core moments INS-01, INS-04, GRL-01 (cap 3)', () => {
    expect(coreMoments(1)).toEqual(['GRL-01', 'INS-01', 'INS-04']);
    expect(coreMoments(1)).toHaveLength(WORLD_ERA_CAPS[1].core);
  });

  it('has era II core moments: CROSSED LINES once, PAY-02, DOG-06, GRL-05, INS-07 (cap 5)', () => {
    expect(coreMoments(2)).toEqual(['DOG-06', 'GRL-05', 'INS-07', 'PAY-02', 'crossedLines']);
    expect(coreMoments(2)).toHaveLength(WORLD_ERA_CAPS[2].core);
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
    const over = [1, 2].filter((era) => coreYou(era).length > 1).map((era) => `era ${era}: ${idsOf(coreYou(era)).join(',')}`);
    expect(over).toEqual([]);
  });

  it('gives non-core you lines only to an era with no core you line', () => {
    const clash = [1, 2].filter((era) => extraYou(era).length > 0 && coreYou(era).length > 0).map((era) => `era ${era}`);
    expect(clash).toEqual([]);
  });

  it('gives era I to GRL-01 (core) and era II to GRL-02 and GRL-04 (non-core)', () => {
    expect(idsOf(coreYou(1))).toEqual(['GRL-01']);
    expect(idsOf(extraYou(1))).toEqual([]);
    expect(idsOf(coreYou(2))).toEqual([]);
    expect(idsOf(extraYou(2))).toEqual(['GRL-02', 'GRL-04']);
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
  };

  it('equals the bible table values and the named timings', () => {
    expect(WORLD_VOICE_CONFIG).toEqual(EXPECTED_CONFIG);
  });

  it('gives a 52-character bubble 5460 ms, clamped to 3500-6500', () => {
    const c = WORLD_VOICE_CONFIG;
    expect(Math.min(c.bubbleMaxMs, Math.max(c.bubbleMinMs, c.bubbleBaseMs + c.bubblePerCharMs * 52))).toBe(5460);
  });

  it('has era caps 6 / 7 / 4 with the bible core and non-core counts (§7.2)', () => {
    expect(WORLD_ERA_CAPS).toEqual({ 1: { core: 3, nonCore: 3 }, 2: { core: 5, nonCore: 2 }, postCap: { core: 4, nonCore: 0 } });
    const total = (k: 1 | 2 | 'postCap'): number => WORLD_ERA_CAPS[k].core + WORLD_ERA_CAPS[k].nonCore;
    expect([total(1), total(2), total('postCap')]).toEqual([6, 7, 4]);
  });

  it('has glance gaps of 6-9 min in era I and 5-8 min in era II (§7.6)', () => {
    expect(WORLD_GLANCE).toEqual({ 1: { minMs: 360000, maxMs: 540000 }, 2: { minMs: 300000, maxMs: 480000 } });
  });
});

describe('placements (DENIZEN_ART §3, rows e1 / s8 / s9)', () => {
  const FRAMINGS: FramingKey[] = ['e1', 's8', 's9'];
  // Expected tables written from DENIZEN_ART §3 (feet x in world px). Stake = dog x - 16; hole = dog x + 30 (front row, §1.4).
  // Sensor 7 and the clock are off-stage at s8. The girl is a window or pylon-foot plane and has no ground placement.
  const EXPECTED: Record<FramingKey, Partial<Record<GroundId, WorldPlacement>>> = {
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
      inspector: { x: 1472, row: 'back' },
      dog: { x: 2604, row: 'front' },
      payphone: { x: 2604, row: 'back' },
      lamp: { x: 2656, row: 'back' },
      crow: { x: 2656, row: 'back' },
      stakeChain: { x: 2588, row: 'front' },
      hole: { x: 2634, row: 'front' },
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

  const placed = FRAMINGS.flatMap((f) =>
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
    expect(routed.map(({ where }) => where)).toEqual(['e1.inspector', 's9.inspector']);
    const bad = routed
      .filter(({ p }) => p.route !== undefined && (p.route[1] - p.route[0] !== 48 || (p.route[0] + p.route[1]) / 2 !== p.x))
      .map(({ where }) => where);
    expect(bad).toEqual([]);
  });

  it('places the stake 16 px behind the dog and the hole 30 px ahead of it', () => {
    for (const f of FRAMINGS) {
      const dogX = WORLD_PLACEMENTS[f].dog?.x;
      expect(dogX, `dog x in ${f}`).toBeDefined();
      expect(WORLD_PLACEMENTS[f].stakeChain?.x).toBe((dogX ?? 0) - 16);
      expect(WORLD_PLACEMENTS[f].hole?.x).toBe((dogX ?? 0) + 30);
    }
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
    expect(refs).toEqual(['GRL-01']);
    expect(refs.filter((id) => !lineIds.has(id))).toEqual([]);
  });

  it('keeps the chains in step order with matching triggers', () => {
    expect(WORLD_CHAINS).toEqual({
      crossedLines: ['PAY-01', 'CRW-04', 'INS-05'],
      postCap: ['PAY-05', 'INS-07', 'GRL-06', 'DOG-12'],
    });
    WORLD_CHAINS.crossedLines.forEach((id, i) => {
      expect(byId(id).trigger, id).toEqual({ kind: 'chain', chainId: 'crossedLines', step: i + 1 });
    });
    WORLD_CHAINS.postCap.forEach((id, i) => {
      if (id === 'INS-07') expect(byId(id).trigger, id).toEqual({ kind: 'ms', techId: 'substationBlueprint' });
      else expect(byId(id).trigger, id).toEqual({ kind: 'postCap', step: i + 1 });
    });
  });
});

describe('sprite frames and loops (DENIZEN_ART §5.1)', () => {
  const SHEETS = Object.keys(WORLD_FRAMES) as WorldSheetId[];
  const LOOP_SHEET: Record<WorldLoopId, WorldSheetId> = {
    inspector: 'inspector', inspectorStatic: 'inspector', dog: 'dog', dogDig: 'dog', crow: 'crow', crowStutter: 'crow', receiver: 'receiver',
  };
  // Asset registry lookup by key. The manifest is typed by AssetId, so index it as plain strings.
  const manifestEntry = (key: string): AssetEntry | undefined => (ASSET_MANIFEST as Record<string, AssetEntry | undefined>)[key];

  it('has 17 sheets and era rows I-V plus whole', () => {
    expect(SHEETS).toHaveLength(17);
    expect(Object.keys(WORLD_ERA_ROW)).toHaveLength(6);
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

  it('keeps the inspector walk within dx -24..24 world px', () => {
    const steps: readonly LoopFrame[] = WORLD_LOOPS.inspector;
    expect(steps.filter((s) => s.dx < -24 || s.dx > 24)).toEqual([]);
  });

  it.each(SHEETS)('%s frame count equals the manifest (x6 era rows where stacked)', (sheet) => {
    const rows = WORLD_ERA_ROW_SHEETS.includes(sheet) ? Object.keys(WORLD_ERA_ROW).length : 1;
    expect(manifestEntry(WORLD_SHEET_KEYS[sheet])?.frame?.count).toBe(WORLD_FRAMES[sheet].length * rows);
  });
});

describe('save defaults and known ids (A5, D9)', () => {
  it('starts with an empty world save', () => {
    expect(DEFAULT_WORLD_SAVE).toEqual({ seen: [], seenEver: [], eraMoments: [0, 0, 0, 0, 0], youEras: 0 });
  });

  it('keeps the two wordless beats', () => {
    expect(WORLD_BEATS).toEqual(['beat.tapeFreeze', 'beat.failedSync']);
  });

  it('knows every line id and both beats, and nothing else', () => {
    const expected = [...idsOf(WORLD_LINES), ...WORLD_BEATS].sort();
    expect(Array.from(WORLD_KNOWN_IDS).sort()).toEqual(expected);
  });
});

describe('text sweep feed (A3, Appendix B)', () => {
  it('sweeps the 31 line texts', () => {
    expect(WORLD_SWEEP).toHaveLength(31);
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

  it('pins the framing reference poses (e1, s8, s9) with unique keys', () => {
    expect(WORLD_LAYOUT.framingPoses).toEqual([
      { key: 'e1', zoom: 1, centerX: 1920 }, { key: 's8', zoom: 1, centerX: 2064 }, { key: 's9', zoom: 0.75, centerX: 2192 },
    ]);
    const keys: FramingKey[] = WORLD_LAYOUT.framingPoses.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
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
});

describe('living world data source', () => {
  it('imports nothing from Phaser', () => {
    const src = readFileSync(new URL('./livingWorld.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"]phaser/i);
    expect(src).not.toMatch(/require\(\s*['"]phaser/i);
  });
});
