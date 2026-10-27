// Era III-V and ending data tests (WP23b): loop frames on their sheets, stage rules on real techs, sprout and puddle frames against the
// asset manifest, top-down rule order, the postgame 90 s loop (coverage, walk speeds, pat contact), the KEEP dog fade and re-entry
// clear of the anchor boxes, KEEP / finale frame names, the DENIZEN_ART §3 home feet, the clipboard overlay keys and the Chladni palette.
// Why: these tables drive the state maths and the renderers, so a wrong frame name or a gap in the loop shows up here, not on screen.
// Pure data tests (node environment, no Phaser).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TECH_IDS } from './types';
import { ASSET_MANIFEST } from '../assets/manifest';
import { WORLD_FRAMES, WORLD_PLACEMENTS, WORLD_ROWS, WORLD_SHADOWS } from './livingWorld';
import type { WorldSheetId } from './livingWorld';
import {
  WORLD_CHLADNI, WORLD_DOUBLE_EXPOSURE, WORLD_ERA_ENV, WORLD_ERA_LOOPS, WORLD_ERA_RULES, WORLD_GIRL, WORLD_LAMP,
  WORLD_MOTES_BY_ERA, WORLD_PAGES, WORLD_PUDDLE, WORLD_SCRAPS, WORLD_SENSOR, WORLD_SPROUT, WORLD_TRACES, WORLD_VENTS, WORLD_VIRGA, WORLD_WINDOWS,
} from './worldEras';
import { WORLD_ENDING, WORLD_POSTGAME_LOOP } from './worldEnding';
import type { PostgameSegment } from './worldEnding';
import { PIXEL_SCALE } from './world';
import { PALETTE } from './palette';

const ERAS_SRC = readFileSync(new URL('./worldEras.ts', import.meta.url), 'utf8');
const ENDING_SRC = readFileSync(new URL('./worldEnding.ts', import.meta.url), 'utf8');
const KNOWN_TECH: readonly string[] = TECH_IDS;
const onSheet = (sheet: WorldSheetId, frame: string): boolean => WORLD_FRAMES[sheet].includes(frame);
// Face-on or hidden Inspector frames: no clipboard overlay on them (AD3a notes, scripts/art/world/README.md).
const FACE_ON_FRAMES = ['front', 'talk', 'frontUmbrella', 'talkUmbrella', 'shield', 'umbrellaOpen', 'umbrellaHalf'];
// The segment that covers second s of a 90 s loop (fromS <= s < toS), and the segments that move (dx or dy change).
const segAt = (segs: readonly PostgameSegment[], s: number): PostgameSegment | undefined => segs.find((seg) => s >= seg.fromS && s < seg.toS);
const movingOf = (segs: readonly PostgameSegment[]): PostgameSegment[] => segs.filter((seg) => seg.dxFrom !== seg.dxTo || seg.dyFrom !== seg.dyTo);

describe('worldEras: tech rules', () => {
  it('names only techs that exist in TECH_IDS', () => {
    const techs: string[] = [
      WORLD_VENTS.techId, WORLD_PUDDLE.techId, WORLD_SCRAPS.techId, WORLD_CHLADNI.techId, WORLD_LAMP.deadRule.techId,
      ...WORLD_SPROUT.stages.map((s) => s.rule.techId), ...WORLD_WINDOWS.stages.map((s) => s.rule.techId),
      ...WORLD_GIRL.steps.map((s) => s.techId),
    ];
    expect(techs.filter((id) => !KNOWN_TECH.includes(id))).toEqual([]);
  });

  it('keeps sprout stages strictly increasing from 1 to 4, with the bloom after the last white frame', () => {
    const stages = WORLD_SPROUT.stages.map((s) => s.stage);
    expect(stages).toEqual([1, 2, 3, 4]);
    expect(WORLD_SPROUT.bloomFrame).toBe(stages.length);
    expect(ASSET_MANIFEST['world.sprout'].frame?.count).toBe(stages.length + 1);
  });

  it('orders the puddle size rules top-down by minTier and ends at the lowest tier', () => {
    const tiers = WORLD_PUDDLE.sizeByTier.map((r) => r.minTier);
    const sizes = WORLD_PUDDLE.sizeByTier.map((r) => r.size);
    expect(tiers).toEqual([5, 3, 1]);
    expect(sizes).toEqual([3, 2, 1]);
    expect(WORLD_PUDDLE.sizeByTier.at(-1)?.minTier).toBe(1);
  });

  it('builds the puddle sheet from 3 sizes x 3 looks plus the whole frame, matching the manifest', () => {
    const sizeCount = Math.max(...WORLD_PUDDLE.sizeByTier.map((r) => r.size));
    const looks = Object.values(WORLD_PUDDLE.looks).sort((a, b) => a - b);
    expect(looks).toEqual([0, 1, 2]);
    expect(WORLD_PUDDLE.sizeStride).toBe(looks.length);
    const total = sizeCount * WORLD_PUDDLE.sizeStride + 1;
    expect(total).toBe(10);
    expect(WORLD_PUDDLE.wholeFrame).toBe(total - 1);
    expect(ASSET_MANIFEST['world.puddle'].frame?.count).toBe(total);
  });

  it('burns the scraps top-down, each count below the start', () => {
    const tiers = WORLD_SCRAPS.burn.map((b) => b.minTier);
    const counts = WORLD_SCRAPS.burn.map((b) => b.count);
    expect(tiers).toEqual([5, 4, 3]);
    expect(counts).toEqual([0, 1, 2]);
    expect(counts.every((c) => c < WORLD_SCRAPS.start)).toBe(true);
  });

  it('lights the windows top-down: more advanced stages light fewer windows, never all six', () => {
    const lit = WORLD_WINDOWS.stages.map((s) => s.lit);
    expect(lit).toEqual([0, 1, 2, 4]);
    expect(Math.max(...lit)).toBeLessThan(WORLD_WINDOWS.total);
    expect(WORLD_WINDOWS.breatheEra).toBeLessThan(WORLD_WINDOWS.darkEra);
  });

  it('keeps the Chladni ring counts inside the ring list', () => {
    expect(WORLD_CHLADNI.ringsByIntensity).toHaveLength(3);
    expect(Math.max(...WORLD_CHLADNI.ringsByIntensity)).toBeLessThanOrEqual(WORLD_CHLADNI.rings.length);
    const intensities = WORLD_CHLADNI.intensityByTier.map((r) => r.intensity);
    expect(intensities.every((i) => i >= 0 && i < WORLD_CHLADNI.ringsByIntensity.length)).toBe(true);
    expect(WORLD_CHLADNI.intensityByTier.map((r) => r.minTier)).toEqual([3, 1]);
  });

  it('paints the Chladni rings in the palette sand and violet light', () => {
    expect(WORLD_CHLADNI.color).toBe(PALETTE.sand);
    expect(WORLD_CHLADNI.violetColor).toBe(PALETTE.violetLight);
  });

  it('matches the virga strip frames to the manifest and keeps the frame indexes in range', () => {
    const count = ASSET_MANIFEST['bg.virga'].frame?.count;
    expect(WORLD_VIRGA.assetId).toBe('bg.virga');
    expect(count).toBe(2);
    expect(Math.max(WORLD_VIRGA.frames.fall, WORLD_VIRGA.frames.frozen)).toBeLessThan(count ?? 0);
  });

  it('gives the girl four stages, five era V steps of at most stepMaxWorldPx (12) world px, and in-range stage tables', () => {
    const last = WORLD_GIRL.stageNames.length - 1;
    expect(WORLD_GIRL.stageNames).toEqual(['window', 'mini', 'miniNear', 'ground']);
    expect(Object.values(WORLD_GIRL.stageByEra).every((s) => s >= 0 && s <= last)).toBe(true);
    expect(Object.values(WORLD_GIRL.traceStageByCycle).every((s) => s >= 0 && s <= last)).toBe(true);
    expect(WORLD_GIRL.steps).toHaveLength(5);
    expect(WORLD_GIRL.stepMaxWorldPx).toBe(12);
    expect(WORLD_GIRL.stepDyWorldPx).toBeLessThanOrEqual(WORLD_GIRL.stepMaxWorldPx);
    expect(WORLD_GIRL.stageByEra[5]).toBe(last);
  });

  it('drops the lantern on the girl drop line: the s15 lantern dy is her five era V steps (front row + 40)', () => {
    expect(WORLD_PLACEMENTS.s15.lantern?.dy).toBe(WORLD_GIRL.stepDyWorldPx * WORLD_GIRL.steps.length);
    expect(WORLD_PLACEMENTS.s15.lantern?.dy).toBe(40);
    expect(WORLD_PLACEMENTS.s15.lantern?.row).toBe('front');
  });

  it('pins the puddle drop into the ground strip (5 art px), the era III glint and the ring and black eras', () => {
    expect(WORLD_PUDDLE.dyWorldPx).toBe(5 * PIXEL_SCALE);
    expect(WORLD_PUDDLE.glintMs).toBe(120);
    expect(WORLD_PUDDLE.ringEra).toBe(4);
    expect(WORLD_PUDDLE.blackEra).toBe(5);
    expect(WORLD_PUDDLE.ringEra).toBeLessThan(WORLD_PUDDLE.blackEra);
  });

  it('pins the red ball offset at 22 world px (clear of the sitting dog paws)', () => {
    expect(WORLD_TRACES.redBallDxWorldPx).toBe(22);
  });

  it('pins the page fade tail: the last 20 % of the rise fades the page out', () => {
    expect(WORLD_PAGES.fadeTail).toBe(0.2);
    expect(WORLD_PAGES.fadeTail).toBeGreaterThan(0);
    expect(WORLD_PAGES.fadeTail).toBeLessThan(1);
  });

  it('pins the virga freeze era: it freezes in era IV, after the falling era III', () => {
    expect(WORLD_VIRGA.frozenEra).toBe(4);
    expect(WORLD_VIRGA.frozenEra).toBeGreaterThan(WORLD_VIRGA.minEra);
  });

  it('pins the era IV rise, the era V shadow slide and the downbeat era', () => {
    expect(WORLD_ERA_ENV.riseWorldPx).toBe(2);
    expect(WORLD_ERA_ENV.shadowSlideWorldPx).toBe(4);
    expect(WORLD_ERA_ENV.shadowSlideMs).toBe(500);
    expect(WORLD_ERA_ENV.downbeatEra).toBe(4);
  });

  it('pins the era thresholds the state maths reads, each an era 1-5 in order', () => {
    expect(WORLD_ERA_RULES).toEqual({
      dogDigMaxEra: 2, dogStillEra: 4, windowsKeystoneMaxEra: 2, reverseEra: 5, girlStepEra: 5, chladniVioletEra: 5, motesOrbitEra: 1,
    });
    const eras = Object.values(WORLD_ERA_RULES);
    expect(eras.every((e) => Number.isInteger(e) && e >= 1 && e <= 5)).toBe(true);
    expect(WORLD_ERA_RULES.dogDigMaxEra).toBeLessThan(WORLD_ERA_RULES.dogStillEra);
  });

  it('plays the motes as orbit, freeze, fall across eras II-V', () => {
    expect(WORLD_MOTES_BY_ERA).toEqual({ 2: 'orbit', 3: 'orbit', 4: 'freeze', 5: 'fall' });
  });

  it('keeps the double exposure at 15 percent with a 30-60 s schedule', () => {
    expect(WORLD_DOUBLE_EXPOSURE.minMs).toBeLessThan(WORLD_DOUBLE_EXPOSURE.maxMs);
    expect(WORLD_DOUBLE_EXPOSURE.alpha).toBe(0.15);
    expect(WORLD_DOUBLE_EXPOSURE.targets).toEqual(['inspector', 'dog', 'crow', 'girl']);
  });

  it('keys the Inspector clipboard overlay on sheet frames: every walk, write, glance and pat frame, none of the six face-on ones', () => {
    const keys = Object.keys(WORLD_TRACES.clipboardOffsetArt).sort();
    expect(keys.filter((f) => !onSheet('inspector', f))).toEqual([]);
    expect(keys.filter((f) => FACE_ON_FRAMES.includes(f))).toEqual([]);
    expect(keys).toEqual(WORLD_FRAMES.inspector.filter((f) => !FACE_ON_FRAMES.includes(f)).sort());
    expect(WORLD_TRACES.clipboardMax).toBe(3);
  });

  it('keeps the tier-to-world thresholds on the design tiers (lamp off at skyAperture, vents on relief valves)', () => {
    expect(WORLD_VENTS.techId).toBe('reliefValves');
    expect(WORLD_LAMP.deadRule.techId).toBe('skyAperture');
    expect(WORLD_LAMP.pulseEra).toBeGreaterThan(WORLD_LAMP.warmFromEra);
  });

  it('sets the era gates: vents from era III with the fog in III, virga from III, the Sensor 7 pulse in IV', () => {
    expect(WORLD_VENTS).toEqual({ techId: 'reliefValves', minEra: 3, fogEra: 3 });
    expect(WORLD_VIRGA.minEra).toBe(3);
    expect(WORLD_SENSOR).toEqual({ pulseEra: 4 });
  });

  it('reads the era V shadow rule for the horizon field window stage and the girl step (minLevel 5, INS-12 level)', () => {
    expect(WORLD_SHADOWS.offEra).toBe(5);
    expect(WORLD_SHADOWS.offRule.techId).toBe('horizonField');
    const windowStage = WORLD_WINDOWS.stages.find((s) => s.rule.techId === 'horizonField');
    const girlStep = WORLD_GIRL.steps.find((s) => s.techId === 'horizonField');
    expect(windowStage?.rule.minLevel).toBe(WORLD_SHADOWS.offRule.minLevel);
    expect(girlStep?.minLevel).toBe(WORLD_SHADOWS.offRule.minLevel);
    expect(WORLD_SHADOWS.offRule.minLevel).toBe(5);
  });

  it('keeps crowHigh as the only era loop (the others were pruned in WP26)', () => {
    expect(Object.keys(WORLD_ERA_LOOPS)).toEqual(['crowHigh']);
  });
});

describe('worldEras: loops', () => {
  it('plays crowHigh as one step on a frame that exists on the crow sheet', () => {
    const missing = WORLD_ERA_LOOPS.crowHigh.filter((step) => !onSheet('crow', step.frame)).map((step) => `crow:${step.frame}`);
    expect(missing).toEqual([]);
    expect(WORLD_ERA_LOOPS.crowHigh).toHaveLength(1);
  });
});

describe('worldEnding: postgame loop', () => {
  const { periodS, patAtS } = WORLD_POSTGAME_LOOP;
  const SHEET_OF = { inspector: 'inspector', dog: 'dog', crow: 'crow' } as const;
  const PART_KEYS = ['inspector', 'dog', 'crow'] as const;

  it.each(PART_KEYS)('%s covers [0, periodS) contiguously with no gaps or overlaps', (who) => {
    const segs: readonly PostgameSegment[] = WORLD_POSTGAME_LOOP[who];
    expect(segs[0]?.fromS).toBe(0);
    segs.forEach((seg, i) => {
      expect(seg.toS).toBeGreaterThan(seg.fromS);
      if (i > 0) expect(seg.fromS).toBe(segs[i - 1]?.toS);
    });
    expect(segs.at(-1)?.toS).toBe(periodS);
  });

  it.each(PART_KEYS)('%s names only frames that exist on its sheet, at a positive fps', (who) => {
    const sheet = SHEET_OF[who];
    const bad: string[] = [];
    for (const seg of WORLD_POSTGAME_LOOP[who]) {
      if (seg.fps <= 0) bad.push(`${seg.name}:fps`);
      for (const f of seg.frames) if (!onSheet(sheet, f)) bad.push(`${seg.name}:${f}`);
    }
    expect(bad).toEqual([]);
  });

  it('keeps the inspector within -60..60 and the dog within 0..40 world px', () => {
    const inspectorDx = WORLD_POSTGAME_LOOP.inspector.flatMap((s) => [s.dxFrom, s.dxTo]);
    const dogDx = WORLD_POSTGAME_LOOP.dog.flatMap((s) => [s.dxFrom, s.dxTo]);
    expect(inspectorDx.every((dx) => dx >= -60 && dx <= 60)).toBe(true);
    expect(dogDx.every((dx) => dx >= 0 && dx <= 40)).toBe(true);
  });

  it('puts the Inspector pat (INS-PG) inside the pat segment at patAtS', () => {
    const pat = WORLD_POSTGAME_LOOP.inspector.find((s) => s.name === 'pat');
    expect(pat && patAtS >= pat.fromS && patAtS < pat.toS).toBe(true);
  });

  it('keeps every postgame dy on the back row (0) or the front-row offset (32 = WORLD_ROWS front - back)', () => {
    const dys = [...WORLD_POSTGAME_LOOP.inspector, ...WORLD_POSTGAME_LOOP.dog].flatMap((s) => [s.dyFrom, s.dyTo]);
    const frontOffset = WORLD_ROWS.front.y - WORLD_ROWS.back.y;
    expect(frontOffset).toBe(32);
    expect(dys.every((dy) => dy === 0 || dy === frontOffset)).toBe(true);
  });

  it.each(['inspector', 'dog'] as const)('walks every moving %s segment at the stride speed (10 % tolerance)', (who) => {
    const stride = who === 'inspector' ? WORLD_ENDING.strideWorldPx.inspector : WORLD_ENDING.strideWorldPx.dogChase;
    const moving = movingOf(WORLD_POSTGAME_LOOP[who]);
    expect(moving.length).toBeGreaterThan(0);
    const walkS = (s: PostgameSegment): number => Math.max(Math.abs(s.dxTo - s.dxFrom), Math.abs(s.dyTo - s.dyFrom)) / (stride * s.fps);
    const off = moving.filter((s) => Math.abs(s.toS - s.fromS - walkS(s)) > 0.1 * walkS(s)).map((s) => s.name);
    expect(off).toEqual([]);
  });

  it('moves the Inspector on walk frames and the dog on chase frames only', () => {
    const inspectorFrames = movingOf(WORLD_POSTGAME_LOOP.inspector).flatMap((s) => s.frames);
    const dogFrames = movingOf(WORLD_POSTGAME_LOOP.dog).flatMap((s) => s.frames);
    expect(inspectorFrames.length).toBeGreaterThan(0);
    expect(inspectorFrames.every((f) => f.startsWith('walk'))).toBe(true);
    expect(dogFrames.every((f) => f.startsWith('chase'))).toBe(true);
  });

  it('lands the Inspector pat on the dog shoulder: hand at x - 12, shoulder at x - 2, one feet line', () => {
    const pat = segAt(WORLD_POSTGAME_LOOP.inspector, patAtS);
    const patted = segAt(WORLD_POSTGAME_LOOP.dog, patAtS);
    expect(pat?.name).toBe('pat');
    expect(patted?.name).toBe('patted');
    if (pat === undefined || patted === undefined) return;
    const handX = WORLD_ENDING.homeX.inspector + pat.dxFrom - 12;        // flipped: the contact (+12, -20) mirrors to -12
    const shoulderX = WORLD_ENDING.postgameDogHomeX + patted.dxFrom - 2; // the dog shoulder (-2, -20); the dog faces right
    expect(pat.flip).toBe(true);
    expect(patted.flip).toBe(false);
    expect(Math.abs(handX - shoulderX)).toBeLessThanOrEqual(2);
    expect(pat.dyFrom).toBe(WORLD_ROWS.front.y - WORLD_ROWS.back.y);
    expect(WORLD_ROWS.back.y + pat.dyFrom).toBe(WORLD_ROWS.front.y + patted.dyFrom);
  });
});

describe('worldEnding: finale and KEEP', () => {
  it('keeps the home feet equal to the DENIZEN_ART §3 table (s15 / postgame column)', () => {
    expect(WORLD_ENDING.homeX).toEqual({
      inspector: 784, dog: 2856, crow: 3104, girl: 976, sensor7: 712, payphone: 3050, lamp: 3104, clock: 2890, sprout: 996,
      puddles: 960, stake: 2840, hole: 2886, lantern: 965,   // lantern: AD3b (girl x - 11), Z2 supersedes 990
    });
    expect(WORLD_ENDING.homeX.stake).toBe(WORLD_ENDING.homeX.dog - 16);
    expect(WORLD_ENDING.homeX.hole).toBe(WORLD_ENDING.homeX.dog + 30);
    expect(WORLD_ENDING.postgameDogHomeX).toBe(732);
  });

  it('keeps the shield, stare, run, wag, base-L, and crow frames on their sheets', () => {
    const { shieldFrames, stareFrames, girlRun, inspectorBaseL, dogWag, crow } = WORLD_ENDING;
    const needed: [WorldSheetId, readonly string[]][] = [
      ['inspector', [shieldFrames.inspector, stareFrames.inspector, inspectorBaseL.frame]],
      ['dog', [shieldFrames.dog, stareFrames.dog, dogWag.frame]],
      ['crow', [shieldFrames.crow, stareFrames.crow, ...crow.flyFrames]],
      ['girl', [shieldFrames.girl, stareFrames.girl, ...girlRun.frames, girlRun.dropFrame]],
      ['sensor7', [stareFrames.sensor7]],
    ];
    const missing = needed.flatMap(([sheet, frames]) => frames.filter((f) => !onSheet(sheet, f)).map((f) => `${sheet}:${f}`));
    expect(missing).toEqual([]);
  });

  it('keeps the finale timings in order (beam shield, run, takeoff, return, LAST LOOK blink)', () => {
    expect(WORLD_ENDING.girlRun.startS).toBeLessThan(WORLD_ENDING.girlRun.endS);
    expect(WORLD_ENDING.crow.takeoffS).toBeLessThan(WORLD_ENDING.crow.returnFromS);
    expect(WORLD_ENDING.crow.returnFromS).toBeLessThan(WORLD_ENDING.crow.returnToS);
    expect(WORLD_ENDING.keep.dogFade.fromS).toBeLessThan(WORLD_ENDING.keep.dogFade.toS);
    expect(WORLD_ENDING.keep.dogFade.toS).toBeLessThanOrEqual(WORLD_ENDING.keep.dogEnter.fromS);
    expect(WORLD_ENDING.keep.dogEnter.fromS).toBeLessThan(WORLD_ENDING.keep.dogEnter.toS);
    expect(WORLD_ENDING.keep.dogEnter.toS).toBeLessThanOrEqual(WORLD_ENDING.keep.dogSettleS);
    expect(WORLD_ENDING.keep.loopStartS).toBe(WORLD_ENDING.keep.dogSettleS);
    expect(WORLD_ENDING.sensorTurn.afterPostgameS).toBe(1200);
    expect(WORLD_ENDING.lastLookBlinkMs).toBe(250);
  });
});

describe('worldEnding: KEEP dog fade and re-entry stay clear of the anchor boxes', () => {
  const { keep, dogStride, homeX, postgameDogHomeX } = WORLD_ENDING;
  const DOG_WIDTH_WORLD = (ASSET_MANIFEST['world.dog'].frame?.width ?? 0) * PIXEL_SCALE;   // 28 art px x 2
  const DOG_HALF = DOG_WIDTH_WORLD / 2;
  const VIEW_LEFT = 640;         // portrait view (DENIZEN_ART §3, s15)
  const ANCHOR_BOXES: [number, number][] = [[848, 912], [2928, 2992]];   // the machine's two anchor boxes at portrait
  const LEG_PX_PER_S = dogStride.worldPxPerFrame * dogStride.fps;
  // The dog's sprite (centre +/- half width) clears a box when it ends at or before the box, or starts at or after it.
  const clearOf = (x: number): boolean => ANCHOR_BOXES.every(([a, b]) => x + DOG_HALF <= a || x - DOG_HALF >= b);

  it('keeps the dog sprite 56 world px wide', () => {
    expect(DOG_WIDTH_WORLD).toBe(56);
  });

  it('fades the dog out at home from 4 to 4.5 s and keeps it hidden until the re-entry at 7 s', () => {
    expect(keep.dogFade).toEqual({ fromS: 4, toS: 4.5 });
    expect(keep.dogEnter.fromS).toBe(7);
  });

  it('walks the re-entry at the dog stride: distance / (16 px x 12 fps)', () => {
    expect(LEG_PX_PER_S).toBe(192);
    expect(keep.dogEnter.toS - keep.dogEnter.fromS).toBeCloseTo((postgameDogHomeX - keep.dogEnter.fromX) / LEG_PX_PER_S, 9);
  });

  it('keeps the dog at its 2856 home clear of both anchor boxes while it fades', () => {
    expect(clearOf(homeX.dog)).toBe(true);
  });

  it('keeps the re-entry start off screen (fromX + 28 < 640) and the postgame spot and every loop position clear of both boxes', () => {
    expect(keep.dogEnter.fromX + DOG_HALF).toBeLessThan(VIEW_LEFT);
    const loopXs = WORLD_POSTGAME_LOOP.dog.flatMap((s) => [s.dxFrom, s.dxTo]).map((dx) => postgameDogHomeX + dx);
    expect([keep.dogEnter.fromX, postgameDogHomeX, ...loopXs].every(clearOf)).toBe(true);
  });
});

describe('worldEras and worldEnding: purity', () => {
  it('imports no Phaser', () => {
    expect(ERAS_SRC).not.toMatch(/from\s+['"]phaser/i);
    expect(ENDING_SRC).not.toMatch(/from\s+['"]phaser/i);
  });
});
