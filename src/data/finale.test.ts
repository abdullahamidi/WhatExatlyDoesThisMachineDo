import { describe, it, expect } from 'vitest';
import {
  FINALE_VIEWS, FINALE_CAMERA, FINALE_SHOTS, FINALE_HUD, FINALE_BOOST, FINALE_BEAM, FINALE_ECLIPSE, FINALE_WHITE, FINALE_CUT,
  FINALE_TRACKS, FINALE_DUST, FINALE_WIPE, RESTORED_GROUND, FINALE_PLATE, FINALE_SEEDS, FINALE_BIRDS, FINALE_REVEAL, FINALE_CHOICE,
  FINALE_BEATS, FINALE_COMPLETE, REVEALED,
} from './finale';
import type { FinaleBeat, FinaleTrackId } from './finale';
import { MACHINE_ASSEMBLY, MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS } from './machineComponents';
import type { MachineComponentId } from './machineComponents';
import { DEPTH } from './world';
import { ASSET_IDS } from '../assets/assetIds';
import type { AssetId } from '../assets/assetIds';
import { ASSET_MANIFEST } from '../assets/manifest';

const ALL_BEATS: readonly FinaleBeat[] = ['swell', 'calliope', 'beamWhite', 'white', 'windStop', 'plate', 'flock', 'chord'];
const ALL_TRACKS: readonly FinaleTrackId[] = ['sky', 'glow', 'mountains', 'skyline', 'ground'];

describe('FINALE_BEATS', () => {
  it('lists every beat exactly once', () => {
    expect(FINALE_BEATS.map((b) => b.id).sort()).toEqual([...ALL_BEATS].sort());
  });

  it('is sorted by atS in data order, with the chord at the choice (last)', () => {
    const times = FINALE_BEATS.map((b) => b.atS);
    expect(times.slice(0, -1).every((t) => typeof t === 'number')).toBe(true);
    for (let i = 1; i < times.length - 1; i++) {
      expect(times[i] as number).toBeGreaterThan(times[i - 1] as number);
    }
    expect(times[times.length - 1]).toBe('choice');
    expect(FINALE_BEATS[FINALE_BEATS.length - 1]?.id).toBe('chord');
  });

  it('keeps the storyboard times: swell 2, calliope 4, beamWhite 13, white 15, windStop 19.3, plate 30, flock 38', () => {
    const at = Object.fromEntries(FINALE_BEATS.map((b) => [b.id, b.atS]));
    expect(at).toEqual({ swell: 2, calliope: 4, beamWhite: 13, white: 15, windStop: 19.3, plate: 30, flock: 38, chord: 'choice' });
  });
});

describe('FINALE_COMPLETE', () => {
  it('steps ascend by atS and raise the machine one era per step: 3, 4, 5', () => {
    const steps = FINALE_COMPLETE.steps;
    expect(steps.map((s) => s.era)).toEqual([3, 4, 5]);
    for (let i = 1; i < steps.length; i++) expect(steps[i]?.atS).toBeGreaterThan(steps[i - 1]?.atS ?? Infinity);
  });

  it('every step lies inside the S1 shot, and the last step finishes its fly-in before the S2 shot', () => {
    for (const s of FINALE_COMPLETE.steps) {
      expect(s.atS).toBeGreaterThanOrEqual(FINALE_SHOTS.s1);
      expect(s.atS).toBeLessThan(FINALE_SHOTS.s2);
    }
    const last = FINALE_COMPLETE.steps[FINALE_COMPLETE.steps.length - 1];
    expect((last?.atS ?? 0) + MACHINE_ASSEMBLY.durationMs / 1000).toBeLessThan(FINALE_SHOTS.s2);
  });
});

describe('finale timings', () => {
  it('shots ascend from s1 to s4 and sit inside the film', () => {
    const shots = [FINALE_SHOTS.s1, FINALE_SHOTS.s2, FINALE_SHOTS.s3, FINALE_SHOTS.s4];
    for (let i = 1; i < shots.length; i++) expect(shots[i]).toBeGreaterThan(shots[i - 1] as number);
    expect(shots[0]).toBeGreaterThan(0);
    expect(FINALE_SHOTS.s4).toBeLessThanOrEqual(FINALE_REVEAL.startS);
  });

  it('camera tweens are ordered and do not overlap, and target only named views', () => {
    for (let i = 0; i < FINALE_CAMERA.length; i++) {
      const c = FINALE_CAMERA[i];
      expect(c?.durS).toBeGreaterThan(0);
      expect(Object.keys(FINALE_VIEWS)).toContain(c?.to);
      if (i > 0) {
        const prev = FINALE_CAMERA[i - 1];
        expect((prev?.atS ?? 0) + (prev?.durS ?? 0)).toBeLessThanOrEqual(c?.atS ?? 0);
      }
    }
  });

  it('camera views are the full (0.5x) and crown (1x) framings and the two zoom-1 base surveys in art px', () => {
    expect(FINALE_VIEWS.full).toEqual({ artX: 0, artY: -300, zoom: 0.5 });
    expect(FINALE_VIEWS.crown).toEqual({ artX: 64, artY: -520, zoom: 1 });
    expect(FINALE_VIEWS.baseL).toEqual({ artX: -300, artY: -150, zoom: 1 });
    expect(FINALE_VIEWS.baseR).toEqual({ artX: 300, artY: -150, zoom: 1 });
  });

  it('survey keys: 3 cuts (WP13), then baseL, baseR, full as skip keys in the S3 idle window ending at s4', () => {
    expect(FINALE_CAMERA).toHaveLength(6);
    expect(FINALE_CAMERA.slice(0, 3).every((k) => k.reduced === 'cut')).toBe(true);
    const survey = FINALE_CAMERA.slice(-3);
    expect(survey.every((k) => k.reduced === 'skip')).toBe(true);
    expect(survey.map((k) => k.to)).toEqual(['baseL', 'baseR', 'full']);
    const first = survey[0];
    expect(first?.atS).toBeGreaterThanOrEqual(FINALE_TRACKS.skyline.startS + FINALE_TRACKS.skyline.durS);
    const last = survey[survey.length - 1];
    expect((last?.atS ?? 0) + (last?.durS ?? 0)).toBeCloseTo(FINALE_SHOTS.s4, 9);
  });

  it('survey holds on baseL and baseR each last at least 1 s (arrival to the next departure)', () => {
    const survey = FINALE_CAMERA.slice(-3);
    for (let i = 0; i < 2; i++) {
      const arrive = (survey[i]?.atS ?? 0) + (survey[i]?.durS ?? 0);
      const leave = survey[i + 1]?.atS ?? 0;
      expect(leave - arrive).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  it('every track window lies inside [s3, s4] and has a positive duration', () => {
    for (const id of ALL_TRACKS) {
      const w = FINALE_TRACKS[id];
      expect(w.durS, id).toBeGreaterThan(0);
      expect(w.startS, id).toBeGreaterThanOrEqual(FINALE_SHOTS.s3);
      expect(w.startS + w.durS, id).toBeLessThanOrEqual(FINALE_SHOTS.s4);
    }
    expect(Object.keys(FINALE_TRACKS).sort()).toEqual([...ALL_TRACKS].sort());
  });

  it('the wipe starts with the ground track and the reverse dust starts with the sky track', () => {
    expect(FINALE_WIPE.startS).toBe(FINALE_TRACKS.ground.startS);
    expect(FINALE_DUST.reverseAtS).toBe(FINALE_TRACKS.sky.startS);
  });

  it('the boost starts before the calliope and ends at the release', () => {
    expect(FINALE_BOOST.startS).toBeLessThan(FINALE_BEATS[1]?.atS as number);
    expect(FINALE_BOOST.releaseS).toBe(FINALE_SHOTS.s4);
    expect(FINALE_BOOST.calliope.atS).toBe(4);
    expect(FINALE_BOOST.calliope.count).toBeGreaterThan(0);
  });

  it('eclipse steps descend from 4 to 0 with the diamond before the restore', () => {
    expect(FINALE_ECLIPSE.steps).toEqual([4, 3, 2, 1, 0]);
    expect(FINALE_ECLIPSE.diamondAtS).toBeLessThan(FINALE_ECLIPSE.restoreAtS);
    expect(FINALE_ECLIPSE.restoreAtS).toBe(FINALE_SHOTS.s3);
  });

  it('white flash peaks at 0.85 in full motion and at most 0.5 reduced; no strobe (peak <= 1)', () => {
    expect(FINALE_WHITE.peak).toBeLessThanOrEqual(1);
    expect(FINALE_WHITE.reduced.peak).toBeLessThanOrEqual(FINALE_WHITE.peak);
    expect(FINALE_WHITE.reduced.peak).toBeLessThanOrEqual(0.5);
    expect(FINALE_WHITE.atS).toBe(15);
  });

  it('the reduced-motion camera cut fades over 400 ms and the HUD fades over 1000 ms', () => {
    expect(FINALE_CUT.fadeMs).toBe(400);
    expect(FINALE_HUD.fadeMs).toBe(1000);
  });
});

describe('FINALE_BEAM, FINALE_PLATE, FINALE_SEEDS, FINALE_BIRDS', () => {
  it('the white beam reaches the aperture at 13 s and has the fx.beamWhite alpha', () => {
    expect(FINALE_BEAM.whiteAtS).toBe(13);
    expect(FINALE_BEAM.alpha).toBe(0.85);
    expect(FINALE_BEAM.headPxPerS).toBeGreaterThan(0);
  });

  it('the plate fires at 30 s with three puffs', () => {
    expect(FINALE_PLATE).toEqual({ atS: 30, puffs: 3 });
  });

  it('seeds start at 25 s with a 4-frame sheet, a non-negative spawn rate and an ordered lifespan', () => {
    expect(FINALE_SEEDS.startS).toBe(25);
    expect(FINALE_SEEDS.frames).toBe(4);
    expect(FINALE_SEEDS.frequencyMs).toBeGreaterThan(0);
    expect(FINALE_SEEDS.postgameRateDiv).toBeGreaterThan(1);
    expect(FINALE_SEEDS.lifespanMs[0]).toBeLessThanOrEqual(FINALE_SEEDS.lifespanMs[1]);
  });

  it('birds: first flock at 38 s, ordered size and gap ranges, two-frame sheet', () => {
    expect(FINALE_BIRDS.firstAtS).toBe(38);
    expect(FINALE_BIRDS.size[0]).toBeLessThanOrEqual(FINALE_BIRDS.size[1]);
    expect(FINALE_BIRDS.everyS[0]).toBeLessThanOrEqual(FINALE_BIRDS.everyS[1]);
    expect(FINALE_BIRDS.skyY[0]).toBeLessThan(FINALE_BIRDS.skyY[1]);
  });
});

describe('FINALE_REVEAL and FINALE_CHOICE text', () => {
  it('has four reveal lines then the last line, exact text', () => {
    expect(FINALE_REVEAL.lines).toEqual([
      'PRIMARY FUNCTION: RESTORE',
      'Restoration target: world state, prior.',
      'Observer count: 1.',
      'Operator identity: you.',
    ]);
    expect(FINALE_REVEAL.lastLine).toBe('Restoration holds while the machine runs.');
    expect(FINALE_REVEAL.lines.length + 1).toBe(5);
  });

  it('types at 30 characters per second with the 2 s line pause and the nameplate at scale 3', () => {
    expect(FINALE_REVEAL.startS).toBe(49.3);
    expect(FINALE_REVEAL.cps).toBe(30);
    expect(FINALE_REVEAL.linePauseS).toBe(2.0);
    expect(FINALE_REVEAL.nameplateScale).toBe(3);
    expect(FINALE_REVEAL.panelMaxWidthPx).toBe(560);
  });

  it('choice labels and icons: KEEP IT RUNNING (icon 2), BEGIN A NEW CYCLE (icon 1), SKIP and the stub reason', () => {
    expect(FINALE_CHOICE.keep).toEqual({ label: 'KEEP IT RUNNING', icon: 2 });
    expect(FINALE_CHOICE.cycle).toEqual({ label: 'BEGIN A NEW CYCLE', icon: 1 });
    expect(FINALE_CHOICE.skipLabel).toBe('SKIP');
    expect(FINALE_CHOICE.cycleStubReason).toBe('Cycle 0043 is still calibrating.');
  });

  it('REVEALED: plaque line and the RF restoration flux label', () => {
    expect(REVEALED.plaque).toBe('PRIMARY FUNCTION: RESTORE');
    expect(REVEALED.xf).toEqual({ name: 'Restoration Flux', short: 'RF' });
  });
});

describe('FINALE_BOOST holdFrames', () => {
  it('every key is a real machine component with a frames animation, and the hold frame is inside the sheet', () => {
    const ids = Object.keys(FINALE_BOOST.holdFrames);
    expect(ids.length).toBe(7);
    for (const id of ids) {
      expect((MACHINE_COMPONENT_IDS as readonly string[]).includes(id), id).toBe(true);
      const def = MACHINE_COMPONENTS[id as MachineComponentId];
      expect(def.animation.kind, id).toBe('frames');
      if (def.animation.kind !== 'frames') continue;
      const hold = FINALE_BOOST.holdFrames[id as keyof typeof FINALE_BOOST.holdFrames];
      expect(hold, id).toBeGreaterThanOrEqual(0);
      expect(hold, id).toBeLessThan(def.animation.frames);
    }
  });
});

describe('finale asset ids', () => {
  const ASSET_REFS: readonly AssetId[] = [
    FINALE_BEAM.assetId, FINALE_SEEDS.assetId, FINALE_BIRDS.assetId, RESTORED_GROUND.groundAssetId,
    ...RESTORED_GROUND.regrowth.map((r) => r.assetId),
  ];

  it('every finale asset reference is a real manifest id', () => {
    for (const id of ASSET_REFS) {
      expect(ASSET_IDS as readonly string[], id).toContain(id);
      expect(ASSET_MANIFEST[id].id, id).toBe(id);
    }
  });

  it('the regrowth strips are the three bg.regrowth ids in stage order', () => {
    expect(RESTORED_GROUND.regrowth.map((r) => r.assetId)).toEqual(['bg.regrowth1', 'bg.regrowth2', 'bg.regrowth3']);
    expect(RESTORED_GROUND.groundAssetId).toBe('terrain.groundGreen');
  });

  it('restored ground depths sit on the ground: groundDepth = ground + 0.5, regrowth = ground + 2', () => {
    expect(RESTORED_GROUND.groundDepth).toBe(DEPTH.ground + 0.5);
    expect(RESTORED_GROUND.regrowthDepth).toBe(DEPTH.ground + 2);
    expect(RESTORED_GROUND.regrowthBottomOffsetPx).toBe(6);
    expect(FINALE_SEEDS.depth).toBe(DEPTH.dust);
  });
});
