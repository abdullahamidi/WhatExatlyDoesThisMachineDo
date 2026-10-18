import { describe, it, expect } from 'vitest';
import {
  easeInOutCubic, easeOutCubic, choiceStartS, finaleEndS, shotAt, viewPose, cameraPoseAt, trackValue, whiteAlpha,
  boost01, boostedValue, beamHeadPx, eclipseAt, wipeHalfWidthPx, wipeEdgeOffsetPx, wipeRects, wipeComplete,
  typewriter, beatsBetween, flockSchedule, birdPose, finaleFrame, BEAM_MAX_PX,
} from './finale';
import type { CameraPose, RevealCfg } from './finale';
import {
  FINALE_BEATS, FINALE_BIRDS, FINALE_REVEAL, FINALE_WHITE, FINALE_CUT, FINALE_WIPE,
} from '../../data/finale';
import { VIEW, WORLD } from '../../data/world';

const START: CameraPose = { centerX: 1000, centerY: 500, zoom: 0.8 };

describe('easing', () => {
  it('cubic in-out and out are 0 at 0, 1 at 1, and clamp their input', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOutCubic(-3)).toBe(0);
    expect(easeInOutCubic(7)).toBe(1);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 9);
    expect(easeOutCubic(Number.NaN)).toBe(0);
  });
});

describe('timeline', () => {
  it('choiceStartS is 62.6 and finaleEndS is 64.47 with the C3 data', () => {
    expect(choiceStartS()).toBeCloseTo(62.6, 2);
    expect(finaleEndS()).toBeCloseTo(64.47, 2);
  });

  it('derives both times from the reveal config', () => {
    const cfg: RevealCfg = { startS: 10, nameplateFadeMs: 800, holdS: 1, cps: 10, linePauseS: 2, lines: ['abcd'], lastLine: 'xy', buttonsDelayS: 0.5 };
    // lines: 0.8 fade + 1 hold, then 'abcd' (0.4 s) + 2 s pause -> last line starts at 4.2 after the reveal
    expect(choiceStartS(cfg)).toBeCloseTo(14.2, 9);
    expect(finaleEndS(cfg)).toBeCloseTo(14.2 + 0.2 + 0.5, 9);
  });

  it('reduced finaleEndS skips the last line typing (choice start + buttonsDelayS)', () => {
    expect(finaleEndS(FINALE_REVEAL, true)).toBeCloseTo(choiceStartS() + FINALE_REVEAL.buttonsDelayS, 9);
    expect(finaleEndS(FINALE_REVEAL, true)).toBeLessThan(finaleEndS());
    expect(finaleEndS(FINALE_REVEAL, false)).toBe(finaleEndS());
  });

  it('finaleEndS(cfg, reduced) is the earliest film time the typewriter shows the buttons, in both modes', () => {
    const cfgs: RevealCfg[] = [
      FINALE_REVEAL,
      { startS: 10, nameplateFadeMs: 800, holdS: 1, cps: 10, linePauseS: 2, lines: ['abcd'], lastLine: 'xy', buttonsDelayS: 0.5 },
    ];
    for (const cfg of cfgs) {
      for (const reduced of [false, true]) {
        const end = finaleEndS(cfg, reduced);
        const buttonsAt = (t: number): boolean => typewriter(t - cfg.startS, cfg, reduced).buttons;
        expect(buttonsAt(end - 1e-6)).toBe(false);
        expect(buttonsAt(end + 1e-6)).toBe(true);
        // bisection over film time: buttons is monotone, so the edge it finds is the first true sample
        let lo = 0;
        let hi = end + 1;
        expect(buttonsAt(hi)).toBe(true);
        for (let i = 0; i < 80; i++) {
          const mid = (lo + hi) / 2;
          if (buttonsAt(mid)) hi = mid;
          else lo = mid;
        }
        expect(hi).toBeCloseTo(end, 6);
      }
    }
  });

  it('shotAt switches at every shot boundary', () => {
    expect(shotAt(0)).toBe('S0');
    expect(shotAt(1.99)).toBe('S0');
    expect(shotAt(2)).toBe('S1');
    expect(shotAt(9.99)).toBe('S1');
    expect(shotAt(10)).toBe('S2');
    expect(shotAt(19.29)).toBe('S2');
    expect(shotAt(19.3)).toBe('S3');
    expect(shotAt(49.29)).toBe('S3');
    expect(shotAt(49.3)).toBe('S4');
    expect(shotAt(choiceStartS() - 0.01)).toBe('S4');
    expect(shotAt(choiceStartS())).toBe('S5');
    expect(shotAt(200)).toBe('S5');
  });

  it('viewPose: full (1920, 1080, .5) and crown (2048, 640, 1) from the art offsets', () => {
    expect(viewPose('full')).toEqual({ centerX: 1920, centerY: 1080, zoom: 0.5 });
    expect(viewPose('crown')).toEqual({ centerX: 2048, centerY: 640, zoom: 1 });
  });
});

describe('camera', () => {
  it('starts at the start pose, reaches full at 2, crown at 13, full at 19', () => {
    expect(cameraPoseAt(0, START, false).pose).toEqual(START);
    expect(cameraPoseAt(2, START, false).pose).toEqual(viewPose('full'));
    expect(cameraPoseAt(13, START, false).pose).toEqual(viewPose('crown'));
    expect(cameraPoseAt(19, START, false).pose).toEqual(viewPose('full'));
  });

  it('zoom is monotone inside the tweens', () => {
    let prev = cameraPoseAt(10, START, false).pose.zoom;
    for (let t = 10.05; t <= 13; t += 0.05) {
      const z = cameraPoseAt(t, START, false).pose.zoom;
      expect(z).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = z;
    }
    prev = cameraPoseAt(16, START, false).pose.zoom;
    for (let t = 16.05; t <= 19; t += 0.05) {
      const z = cameraPoseAt(t, START, false).pose.zoom;
      expect(z).toBeLessThanOrEqual(prev + 1e-12);
      prev = z;
    }
  });

  it('reduced: cut at key.atS + fadeMs/2 with cutFade peak 1 there, 0 outside the fade', () => {
    const fade = FINALE_CUT.fadeMs / 1000;
    expect(cameraPoseAt(10.19, START, true).pose).toEqual(viewPose('full'));
    expect(cameraPoseAt(10.21, START, true).pose).toEqual(viewPose('crown'));
    expect(cameraPoseAt(10 + fade / 2, START, true).cutFade).toBeCloseTo(1, 9);
    expect(cameraPoseAt(10, START, true).cutFade).toBeCloseTo(0, 9);
    expect(cameraPoseAt(10 + fade, START, true).cutFade).toBeCloseTo(0, 9);
    expect(cameraPoseAt(12, START, true).cutFade).toBe(0);
    expect(cameraPoseAt(0, START, true).pose).toEqual(START);
    expect(cameraPoseAt(0.3, START, true).pose).toEqual(viewPose('full'));
  });

  it('reduced: no tweened (in-between) pose', () => {
    const mid = cameraPoseAt(11, START, true).pose;
    expect([viewPose('crown'), viewPose('full')]).toContainEqual(mid);
  });
});

describe('overlays and tracks', () => {
  it('whiteAlpha is 0 before 15, peaks at .85 at 16.2, is 0 after 19.3', () => {
    expect(whiteAlpha(14.99, false)).toBe(0);
    expect(whiteAlpha(15, false)).toBe(0);
    expect(whiteAlpha(16.2, false)).toBeCloseTo(0.85, 9);
    expect(whiteAlpha(16.5, false)).toBeCloseTo(0.85, 9);
    expect(whiteAlpha(19.3, false)).toBe(0);
    expect(whiteAlpha(19.31, false)).toBe(0);
    for (let t = 15; t <= 19.3; t += 0.01) expect(whiteAlpha(t, false)).toBeLessThanOrEqual(0.85 + 1e-12);
  });

  it('reduced whiteAlpha never exceeds .5 and is 0 outside its 1 s window', () => {
    let peak = 0;
    for (let t = 14; t <= 17; t += 0.01) peak = Math.max(peak, whiteAlpha(t, true));
    expect(peak).toBeLessThanOrEqual(0.5 + 1e-12);
    expect(peak).toBeGreaterThan(0.4);
    expect(whiteAlpha(16.01, true)).toBe(0);
    expect(whiteAlpha(14.9, true)).toBe(0);
  });

  it('trackValue is linear over each window and clamped outside', () => {
    expect(trackValue('sky', 19.0, false)).toBe(0);
    expect(trackValue('sky', 19.3, false)).toBe(0);
    expect(trackValue('sky', 23.3, false)).toBeCloseTo(0.5, 9);
    expect(trackValue('sky', 27.3, false)).toBe(1);
    expect(trackValue('sky', 40, false)).toBe(1);
    expect(trackValue('glow', 21.3, false)).toBeCloseTo(0.5, 9);
    expect(trackValue('mountains', 27.3, false)).toBe(0);
    expect(trackValue('mountains', 30.3, false)).toBeCloseTo(0.5, 9);
    expect(trackValue('skyline', 33.3, false)).toBeCloseTo(0.5, 9);
    expect(trackValue('ground', 21.3, true)).toBe(0);
    expect(trackValue('ground', 22.8, true)).toBeCloseTo(0.5, 9);
    expect(trackValue('ground', 24.3, true)).toBe(1);
  });
});

describe('boost and beam', () => {
  it('boost01 is 0 / .5 / 1 / 1 / 0 at 2 / 5 / 8 / 49.3 / 53.3', () => {
    expect(boost01(2)).toBe(0);
    expect(boost01(5)).toBeCloseTo(0.5, 9);
    expect(boost01(8)).toBe(1);
    expect(boost01(49.3)).toBe(1);
    expect(boost01(53.3)).toBe(0);
    expect(boost01(0)).toBe(0);
    expect(boost01(100)).toBe(0);
  });

  it('boostedValue lerps to the curve max and never drops below actual', () => {
    expect(boostedValue(10, 110, 0)).toBe(10);
    expect(boostedValue(10, 110, 0.5)).toBeCloseTo(60, 9);
    expect(boostedValue(10, 110, 1)).toBeCloseTo(110, 9);
    expect(boostedValue(10, 110, 3)).toBeCloseTo(110, 9);
    expect(boostedValue(120, 110, 1)).toBe(120);
  });

  it('beamHeadPx is 0 / 450 / 504 at 13 / 13.5 / 13.6 and reduced is full at once', () => {
    expect(beamHeadPx(13, false)).toBe(0);
    expect(beamHeadPx(12.9, false)).toBe(0);
    expect(beamHeadPx(13.5, false)).toBeCloseTo(450, 6);
    expect(beamHeadPx(13.6, false)).toBe(504);
    expect(beamHeadPx(100, false)).toBe(504);
    expect(BEAM_MAX_PX).toBe(504);
    expect(beamHeadPx(13, true)).toBe(504);
    expect(beamHeadPx(12, true)).toBe(0);
  });
});

describe('eclipse', () => {
  it('stage, diamond frame 4, steps 4/3/2/1/0 every 1.5 s, then hidden', () => {
    expect(eclipseAt(10, false)).toEqual({ kind: 'stage' });
    expect(eclipseAt(14.5, false)).toEqual({ kind: 'frame', frame: 4 });
    expect(eclipseAt(18, false)).toEqual({ kind: 'frame', frame: 4 });
    expect(eclipseAt(19.3, false)).toEqual({ kind: 'frame', frame: 4 });
    expect(eclipseAt(20.8, false)).toEqual({ kind: 'frame', frame: 3 });
    expect(eclipseAt(22.3, false)).toEqual({ kind: 'frame', frame: 2 });
    expect(eclipseAt(23.8, false)).toEqual({ kind: 'frame', frame: 1 });
    expect(eclipseAt(25.3, false)).toEqual({ kind: 'hidden' });
    expect(eclipseAt(40, false)).toEqual({ kind: 'hidden' });
  });

  it('reduced: no diamond ring, stage until 19.3 then the same steps', () => {
    expect(eclipseAt(14.5, true)).toEqual({ kind: 'stage' });
    expect(eclipseAt(18, true)).toEqual({ kind: 'stage' });
    expect(eclipseAt(19.3, true)).toEqual({ kind: 'frame', frame: 4 });
    expect(eclipseAt(25.3, true)).toEqual({ kind: 'hidden' });
  });
});

describe('wipe', () => {
  it('half width grows at pxPerS from startS + lag and is 0 before', () => {
    expect(wipeHalfWidthPx(21.3, 0)).toBe(0);
    expect(wipeHalfWidthPx(21, 0)).toBe(0);
    expect(wipeHalfWidthPx(22.3, 0)).toBeCloseTo(120, 6);
    expect(wipeHalfWidthPx(23.3, 2)).toBe(0);
  });

  it('the ground wipe reaches both world edges at 37.3 (and not before the max step allows)', () => {
    const centerX = 1920;
    expect(wipeComplete(wipeHalfWidthPx(37.3, 0), centerX, WORLD.width)).toBe(true);
    expect(wipeComplete(wipeHalfWidthPx(37.0, 0), centerX, WORLD.width)).toBe(false);
    expect(wipeComplete(0, centerX, WORLD.width)).toBe(false);
    expect(wipeComplete(1920, centerX, WORLD.width)).toBe(true);
  });

  it('wipeEdgeOffsetPx is deterministic, in 0..maxStepPx, in stepPx steps', () => {
    const seen = new Set<number>();
    for (let band = 0; band < 200; band++) {
      const a = wipeEdgeOffsetPx(band, FINALE_WIPE.seed);
      expect(a).toBe(wipeEdgeOffsetPx(band, FINALE_WIPE.seed));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(FINALE_WIPE.maxStepPx);
      expect(a % FINALE_WIPE.stepPx).toBe(0);
      seen.add(a);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('wipeRects: one rect per band (last one partial), clamped to the world, zero width at halfWidth 0', () => {
    const rects = wipeRects(500, 1920, 100, 40, WORLD.width, FINALE_WIPE.seed);
    expect(rects).toHaveLength(Math.ceil(40 / FINALE_WIPE.bandPx));
    expect(rects[0]?.y).toBe(100);
    expect(rects[1]?.y).toBe(100 + FINALE_WIPE.bandPx);
    expect(rects[2]?.h).toBe(40 - 2 * FINALE_WIPE.bandPx);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(WORLD.width);
    }
    const huge = wipeRects(1e6, 1920, 0, 32, WORLD.width, FINALE_WIPE.seed);
    for (const r of huge) {
      expect(r.x).toBe(0);
      expect(r.w).toBe(WORLD.width);
    }
    const none = wipeRects(0, 1920, 0, 32, WORLD.width, FINALE_WIPE.seed);
    expect(none).toHaveLength(2);
    for (const r of none) expect(r.w).toBe(0);
    expect(wipeRects(10, 1920, 0, 0, WORLD.width, FINALE_WIPE.seed)).toEqual([]);
  });
});

describe('typewriter', () => {
  const cps = FINALE_REVEAL.cps;
  const line0 = FINALE_REVEAL.lines[0] ?? '';
  const line1 = FINALE_REVEAL.lines[1] ?? '';
  const lastLine = FINALE_REVEAL.lastLine;
  const line0Start = 0.8 + FINALE_REVEAL.holdS;
  const line1Start = line0Start + line0.length / cps + FINALE_REVEAL.linePauseS;

  it('name plate fades in over nameplateFadeMs', () => {
    expect(typewriter(0, FINALE_REVEAL, false).nameplateAlpha).toBe(0);
    expect(typewriter(0.4, FINALE_REVEAL, false).nameplateAlpha).toBeCloseTo(0.5, 9);
    expect(typewriter(0.8, FINALE_REVEAL, false).nameplateAlpha).toBe(1);
    expect(typewriter(5, FINALE_REVEAL, false).nameplateAlpha).toBe(1);
  });

  it('types at 30 cps after the hold and pauses between lines', () => {
    expect(typewriter(line0Start - 0.01, FINALE_REVEAL, false).lines[0]?.shown).toBe(0);
    expect(typewriter(line0Start + 0.1, FINALE_REVEAL, false).lines[0]?.shown).toBe(3);
    expect(typewriter(line0Start + 100, FINALE_REVEAL, false).lines[0]?.shown).toBe(line0.length);
    expect(typewriter(line1Start - 0.01, FINALE_REVEAL, false).lines[1]?.shown).toBe(0);
    expect(typewriter(line1Start + 0.1, FINALE_REVEAL, false).lines[1]?.shown).toBe(3);
    expect(typewriter(line1Start + 0.1, FINALE_REVEAL, false).lines[0]?.shown).toBe(line0.length);
  });

  it('has 4 body lines plus the last line, text = full line, shown = visible count', () => {
    const s = typewriter(100, FINALE_REVEAL, false);
    expect(s.lines.map((l) => l.text)).toEqual([...FINALE_REVEAL.lines, lastLine]);
    expect(s.lines.every((l) => l.shown === l.text.length)).toBe(true);
    expect(s.done).toBe(true);
  });

  it('buttons only after the last line plus buttonsDelayS (finaleEndS)', () => {
    const tEnd = finaleEndS() - FINALE_REVEAL.startS;
    expect(typewriter(tEnd - 0.05, FINALE_REVEAL, false).buttons).toBe(false);
    expect(typewriter(tEnd + 0.01, FINALE_REVEAL, false).buttons).toBe(true);
    const lastStart = choiceStartS() - FINALE_REVEAL.startS;
    const mid = typewriter(lastStart + 0.5, FINALE_REVEAL, false);
    expect(mid.lines[4]?.shown).toBe(15);
    expect(mid.buttons).toBe(false);
    expect(mid.done).toBe(false);
  });

  it('reduced: each line appears whole at its start time', () => {
    expect(typewriter(line1Start - 0.01, FINALE_REVEAL, true).lines[1]?.shown).toBe(0);
    expect(typewriter(line1Start + 0.01, FINALE_REVEAL, true).lines[1]?.shown).toBe(line1.length);
    expect(typewriter(line0Start + 0.01, FINALE_REVEAL, true).lines[0]?.shown).toBe(line0.length);
    const tEnd = finaleEndS() - FINALE_REVEAL.startS;
    expect(typewriter(tEnd + 0.01, FINALE_REVEAL, true).buttons).toBe(true);
  });

  it('custom config is honoured', () => {
    const cfg: RevealCfg = { startS: 0, nameplateFadeMs: 0, holdS: 0, cps: 10, linePauseS: 1, lines: ['abcd'], lastLine: 'ef', buttonsDelayS: 0 };
    const s = typewriter(0.25, cfg, false);
    expect(s.nameplateAlpha).toBe(1);
    expect(s.lines[0]?.shown).toBe(2);
    expect(s.lines[1]?.shown).toBe(0);
  });
});

describe('beats', () => {
  it('lists the beats whose time was crossed, once each, in data order', () => {
    expect(beatsBetween(1.9, 2.1)).toEqual(['swell']);
    expect(beatsBetween(2, 2)).toEqual([]);
    expect(beatsBetween(0, choiceStartS() - 0.001)).toEqual(FINALE_BEATS.filter((b) => b.atS !== 'choice').map((b) => b.id));
    expect(beatsBetween(choiceStartS() - 0.001, choiceStartS())).toEqual(['chord']);
  });

  it('no duplicates and no misses over the whole film for 1..250 ms steps', () => {
    const expected = FINALE_BEATS.map((b) => b.id);
    for (const stepMs of [1, 37, 100, 250]) {
      const got: string[] = [];
      let prev = 0;
      const end = finaleEndS() + 1;
      for (let i = 1; i * stepMs / 1000 <= end; i++) {
        const t = (i * stepMs) / 1000;
        got.push(...beatsBetween(prev, t));
        prev = t;
      }
      got.push(...beatsBetween(prev, end));
      expect(got).toEqual(expected);
    }
  });
});

describe('flocks', () => {
  it('gaps are in everyS and sizes in the size range, deterministically', () => {
    const [minGap, maxGap] = FINALE_BIRDS.everyS;
    const [minSize, maxSize] = FINALE_BIRDS.size;
    for (let i = 0; i < 30; i++) {
      const f = flockSchedule(i, FINALE_BIRDS.seed);
      expect(f.delayS).toBeGreaterThanOrEqual(minGap);
      expect(f.delayS).toBeLessThan(maxGap);
      expect(Number.isInteger(f.size)).toBe(true);
      expect(f.size).toBeGreaterThanOrEqual(minSize);
      expect(f.size).toBeLessThanOrEqual(maxSize);
      expect(flockSchedule(i, FINALE_BIRDS.seed)).toEqual(f);
    }
  });

  it('birdPose: null before the flock, flaps at flapHz, leaves the left edge', () => {
    expect(birdPose(-0.1, 0, FINALE_BIRDS)).toBeNull();
    const a = birdPose(0, 0, FINALE_BIRDS);
    expect(a).not.toBeNull();
    expect(a?.x).toBeCloseTo(VIEW.width, 9);
    expect(a?.frame).toBe(0);
    expect(birdPose(0.34, 0, FINALE_BIRDS)?.frame).toBe(1);
    const y0 = birdPose(0, 0, FINALE_BIRDS)?.y ?? 0;
    expect(y0).toBeGreaterThanOrEqual(FINALE_BIRDS.skyY[0] - FINALE_BIRDS.bobPx);
    expect(y0).toBeLessThanOrEqual(FINALE_BIRDS.skyY[1] + FINALE_BIRDS.bobPx + FINALE_BIRDS.spacingPx.y);
    let left = false;
    for (let t = 0; t < 60; t += 0.5) {
      if (birdPose(t, 0, FINALE_BIRDS) === null) {
        left = true;
        break;
      }
    }
    expect(left).toBe(true);
    expect(birdPose(60, 0, FINALE_BIRDS)).toBeNull();
  });
});

describe('finaleFrame', () => {
  it('none: neutral frame', () => {
    const f = finaleFrame({ phase: 'none', t: 0, reduced: false, start: START });
    expect(f.active).toBe(false);
    expect(f.shot).toBeNull();
    expect(f.restored).toBe(false);
    expect(f.tracks).toEqual({ sky: 0, glow: 0, mountains: 0, skyline: 0, ground: 0 });
    expect(f.wipe.mode).toBe('hidden');
    expect(f.overlay.alpha).toBe(0);
    expect(f.beam).toEqual({ violet: true, whiteHeadPx: 0, animate: false });
    expect(f.eclipse).toEqual({ kind: 'stage' });
    expect(f.dust).toBe('normal');
    expect(f.seeds).toBe('off');
    expect(f.birds).toBe('off');
    expect(f.boost).toBe(0);
    expect(f.camera).toBeNull();
  });

  it('sequence at 5: active, S1, camera tweening from start, boost half way', () => {
    const f = finaleFrame({ phase: 'sequence', t: 5, reduced: false, start: START });
    expect(f.active).toBe(true);
    expect(f.shot).toBe('S1');
    expect(f.restored).toBe(false);
    expect(f.boost).toBeCloseTo(0.5, 9);
    expect(f.camera).not.toBeNull();
    expect(f.beam.violet).toBe(true);
    expect(f.beam.whiteHeadPx).toBe(0);
  });

  it('sequence at 16.2: white fade peak, white beam, violet beam gone', () => {
    const f = finaleFrame({ phase: 'sequence', t: 16.2, reduced: false, start: START });
    expect(f.overlay.alpha).toBeCloseTo(0.85, 9);
    expect(f.overlay.color).toBe(FINALE_WHITE.color);
    expect(f.beam.violet).toBe(false);
    expect(f.beam.whiteHeadPx).toBe(504);
    expect(f.beam.animate).toBe(true);
    expect(f.eclipse).toEqual({ kind: 'frame', frame: 4 });
  });

  it('sequence at 46 non-reduced: wipe complete, restored, birds and seeds on', () => {
    const f = finaleFrame({ phase: 'sequence', t: 46, reduced: false, start: START });
    expect(f.wipe.mode).toBe('full');
    expect(f.restored).toBe(true);
    expect(f.seeds).toBe('finale');
    expect(f.birds).toBe('finale');
    expect(f.dust).toBe('stopped');
  });

  it('sequence at 30: wipe in progress with per-layer half widths, plate restored', () => {
    const f = finaleFrame({ phase: 'sequence', t: 30, reduced: false, start: START });
    expect(f.wipe.mode).toBe('wipe');
    expect(f.wipe.halfWidthPx[0]).toBeCloseTo((30 - 21.3) * 120, 6);
    expect(f.wipe.halfWidthPx[3]).toBeCloseTo((30 - 21.3 - 8) * 120, 6);
    expect(f.restored).toBe(true);
    expect(f.dust).toBe('stopped');
  });

  it('choice: end state at choiceStartS on the FULL view, active, all tracks 1', () => {
    const f = finaleFrame({ phase: 'choice', t: 0, reduced: false, start: START });
    expect(f.active).toBe(true);
    expect(f.shot).toBe('S5');
    expect(f.restored).toBe(true);
    expect(f.camera).toEqual(viewPose('full'));
    expect(f.tracks).toEqual({ sky: 1, glow: 1, mountains: 1, skyline: 1, ground: 1 });
    expect(f.wipe.mode).toBe('full');
    expect(f.overlay.alpha).toBe(0);
    expect(f.eclipse).toEqual({ kind: 'hidden' });
    expect(f.beam.violet).toBe(false);
    const later = finaleFrame({ phase: 'choice', t: 80, reduced: false, start: START });
    expect(later.t).toBe(80);
    expect(later.shot).toBe('S5');
  });

  it('postgame: restored world, no overlay, camera owned by the controller, idle rates', () => {
    const f = finaleFrame({ phase: 'postgame', t: 0, reduced: false, start: START });
    expect(f.active).toBe(false);
    expect(f.shot).toBeNull();
    expect(f.restored).toBe(true);
    expect(f.tracks).toEqual({ sky: 1, glow: 1, mountains: 1, skyline: 1, ground: 1 });
    expect(f.wipe.mode).toBe('full');
    expect(f.wipe.alpha).toBe(1);
    expect(f.overlay.alpha).toBe(0);
    expect(f.beam).toEqual({ violet: false, whiteHeadPx: 504, animate: true });
    expect(f.eclipse).toEqual({ kind: 'hidden' });
    expect(f.dust).toBe('stopped');
    expect(f.seeds).toBe('postgame');
    expect(f.birds).toBe('postgame');
    expect(f.boost).toBe(0);
    expect(f.camera).toBeNull();
  });

  it('reduced sequence: cut fade with violet colour before the sky turns, no white above .5, fade wipe, no birds or seeds, static beam', () => {
    const cut = finaleFrame({ phase: 'sequence', t: 10.2, reduced: true, start: START });
    expect(cut.camera).toEqual(viewPose('crown'));
    expect(cut.overlay.alpha).toBeCloseTo(1, 9);
    expect(cut.overlay.color).toBe(FINALE_CUT.colorViolet);
    const white = finaleFrame({ phase: 'sequence', t: 15.6, reduced: true, start: START });
    expect(white.overlay.alpha).toBeLessThanOrEqual(0.5);
    expect(white.beam.animate).toBe(false);
    expect(white.beam.whiteHeadPx).toBe(504);
    const fade = finaleFrame({ phase: 'sequence', t: 24, reduced: true, start: START });
    expect(fade.wipe.mode).toBe('fade');
    expect(fade.birds).toBe('off');
    expect(fade.seeds).toBe('off');
    const after = finaleFrame({ phase: 'sequence', t: 40, reduced: true, start: START });
    expect(after.wipe.mode).toBe('full');
    expect(after.birds).toBe('off');
    expect(after.seeds).toBe('off');
    expect(after.eclipse.kind).toBe('hidden');
  });

  it('reduced postgame: no birds or seeds, static beam', () => {
    const f = finaleFrame({ phase: 'postgame', t: 0, reduced: true, start: START });
    expect(f.seeds).toBe('off');
    expect(f.birds).toBe('off');
    expect(f.beam.animate).toBe(false);
  });

  it('reduced choice keeps the S5 end state', () => {
    const f = finaleFrame({ phase: 'choice', t: 0, reduced: true, start: START });
    expect(f.shot).toBe('S5');
    expect(f.wipe.mode).toBe('full');
    expect(f.camera).toEqual(viewPose('full'));
  });

  it('non-finite t is treated as 0', () => {
    const f = finaleFrame({ phase: 'sequence', t: Number.NaN, reduced: false, start: START });
    expect(f.t).toBe(0);
    expect(f.shot).toBe('S0');
    expect(f.camera).toEqual(START);
  });
});
