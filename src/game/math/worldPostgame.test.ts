// Tests for worldPostgame (WP23b): the 90 s loop is contiguous with the Inspector's pat at 14.5 s, loop times wrap modulo 90, a frame
// cycles at its fps, dx / dy run linearly across a segment, every moving segment walks at its stride (tolerance 10 %), the pat lands on the
// front-row feet line, the draw row (front while stepping), every loop frame exists on its sheet, and a purity check (no Phaser, no DOM).
// Pure maths, no Phaser.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { postgamePosesAt, postgameSegmentAt, wrapLoopS } from './worldPostgame';
import { WORLD_ENDING, WORLD_POSTGAME_LOOP } from '../../data/worldEnding';
import type { PostgameSegment } from '../../data/worldEnding';
import { WORLD_FRAMES, WORLD_ROWS } from '../../data/livingWorld';

const INSPECTOR = WORLD_POSTGAME_LOOP.inspector;
const DOG = WORLD_POSTGAME_LOOP.dog;
const CROW = WORLD_POSTGAME_LOOP.crow;
const TRACKS: [string, readonly PostgameSegment[]][] = [['inspector', INSPECTOR], ['dog', DOG], ['crow', CROW]];

describe('postgame loop table', () => {
  for (const [name, segs] of TRACKS) {
    it(`${name} covers 0..90 with no gaps or overlaps`, () => {
      expect(segs[0]?.fromS).toBe(0);
      expect(segs[segs.length - 1]?.toS).toBe(WORLD_POSTGAME_LOOP.periodS);
      for (let i = 0; i + 1 < segs.length; i++) {
        const a = segs[i];
        const b = segs[i + 1];
        expect(a !== undefined && b !== undefined && a.toS === b.fromS).toBe(true);
        expect(a !== undefined && a.toS > a.fromS).toBe(true);
      }
    });
  }

  it('puts the pat at 14.5 s: the Inspector pats, the dog is patted', () => {
    expect(WORLD_POSTGAME_LOOP.patAtS).toBe(14.5);
    expect(postgameSegmentAt(INSPECTOR, WORLD_POSTGAME_LOOP.patAtS).seg.name).toBe('pat');
    expect(postgameSegmentAt(DOG, WORLD_POSTGAME_LOOP.patAtS).seg.name).toBe('patted');
  });

  it('stands the Inspector on the front-row feet line and 42 px left of home, the dog at its postgame spot', () => {
    const pat = postgameSegmentAt(INSPECTOR, 15);
    expect(pat.dy).toBe(WORLD_ROWS.front.y - WORLD_ROWS.back.y);
    expect(WORLD_ENDING.homeX.inspector + pat.dx).toBe(742);
    expect(postgameSegmentAt(DOG, 15).dy).toBe(0);
    expect(WORLD_ENDING.postgameDogHomeX).toBe(732);
  });

  it('uses only frames that exist on their sheets', () => {
    for (const seg of INSPECTOR) for (const f of seg.frames) expect(WORLD_FRAMES.inspector, f).toContain(f);
    for (const seg of DOG) for (const f of seg.frames) expect(WORLD_FRAMES.dog, f).toContain(f);
    for (const seg of CROW) for (const f of seg.frames) expect(WORLD_FRAMES.crow, f).toContain(f);
  });
});

describe('wrapLoopS', () => {
  it('wraps modulo 90 and reads a non-finite time as 0', () => {
    expect(wrapLoopS(45)).toBe(45);
    expect(wrapLoopS(90)).toBe(0);
    expect(wrapLoopS(104.5)).toBeCloseTo(14.5, 9);
    expect(wrapLoopS(-1)).toBeCloseTo(89, 9);
    expect(wrapLoopS(Number.NaN)).toBe(0);
    expect(wrapLoopS(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('postgameSegmentAt', () => {
  it('finds the segment that holds the time (a boundary belongs to the next segment)', () => {
    expect(postgameSegmentAt(INSPECTOR, 13.3).seg.name).toBe('rest');
    expect(postgameSegmentAt(INSPECTOR, 13.34375).seg.name).toBe('cross');
    expect(postgameSegmentAt(INSPECTOR, 14).seg.name).toBe('pat');
    expect(postgameSegmentAt(INSPECTOR, 89.99).seg.name).toBe('rest2');
  });

  it('cycles the frame at the segment fps from the segment start', () => {
    const t0 = 13.34375;   // cross: walk0..walk3 at 8 fps
    expect(postgameSegmentAt(INSPECTOR, t0).frame).toBe('walk0');
    expect(postgameSegmentAt(INSPECTOR, t0 + 0.13).frame).toBe('walk1');
    expect(postgameSegmentAt(INSPECTOR, t0 + 0.3).frame).toBe('walk2');
    expect(postgameSegmentAt(INSPECTOR, t0 + 0.5).frame).toBe('walk0');   // floor(4) % 4
  });

  it('runs dx and dy linearly across a moving segment', () => {
    const mid = postgameSegmentAt(INSPECTOR, 13.34375 + 0.328125);   // half of the 0.65625 s cross
    expect(mid.dx).toBe(-21);
    expect(mid.dy).toBe(16);
    expect(mid.flip).toBe(true);
    const back = postgameSegmentAt(INSPECTOR, 30.328125);            // half of the return walk
    expect(back.dx).toBe(-21);
    expect(back.dy).toBe(16);
    expect(back.flip).toBe(false);
  });

  it('holds dx and dy still in a non-moving segment', () => {
    const wave = postgameSegmentAt(INSPECTOR, 27);
    expect(wave.dx).toBe(-42);
    expect(wave.dy).toBe(32);
    expect(wave.frame).toBe('wave');
  });

  it('repeats every 90 s and wraps negative times back into the loop', () => {
    for (const x of [0, 1, 14.5, 45, 89.9]) {
      for (const segs of [INSPECTOR, DOG]) {
        const a = postgameSegmentAt(segs, x);
        const b = postgameSegmentAt(segs, x + 90);
        expect(b.index).toBe(a.index);
        expect(b.frame).toBe(a.frame);
        expect(b.dx).toBeCloseTo(a.dx, 9);
        expect(b.dy).toBeCloseTo(a.dy, 9);
      }
    }
    expect(postgameSegmentAt(INSPECTOR, -1).seg.name).toBe('rest2');
  });

  it('returns the dog dash at 6 fps with the chase frames', () => {
    const dash = postgameSegmentAt(DOG, 30.1875);
    expect(dash.seg.name).toBe('dash1');
    expect(dash.frame).toBe('chase1');        // floor(0.1875 * 6) = 1
    expect(dash.dx).toBeCloseTo(18, 9);
  });
});

describe('postgamePosesAt', () => {
  it('gives the Inspector, dog and crow poses at a loop time', () => {
    const at0 = postgamePosesAt(0);
    expect(at0.inspector.seg.name).toBe('rest');
    expect(at0.dog.seg.name).toBe('sleep');
    expect(at0.crow.seg.name).toBe('perch');
    const pat = postgamePosesAt(14.5);
    expect(pat.inspector.seg.name).toBe('pat');
    expect(pat.inspector.dx).toBe(-42);
    expect(pat.inspector.dy).toBe(32);
    expect(pat.dog.seg.name).toBe('patted');
    expect(postgamePosesAt(45).inspector.seg.name).toBe('rest2');
    expect(postgamePosesAt(104.5).inspector.seg.name).toBe('pat');
  });

  it('draws the Inspector on the front row while it steps (dy at either end), else back; the dog front; the crow back', () => {
    expect(postgamePosesAt(15).inspector.row).toBe('front');   // pat
    expect(postgamePosesAt(15).dog.row).toBe('front');
    expect(postgamePosesAt(40).inspector.row).toBe('back');    // write, at the back row
    expect(postgamePosesAt(40).dog.row).toBe('front');
    expect(postgamePosesAt(40).crow.row).toBe('back');
    expect(postgamePosesAt(13.5).inspector.row).toBe('front'); // cross ends on dy 32
    expect(postgamePosesAt(30.5).inspector.row).toBe('front'); // return starts on dy 32
    expect(postgamePosesAt(0).inspector.row).toBe('back');
  });
});

describe('postgame walk strides (WORLD_ENDING.strideWorldPx, tolerance 10 %)', () => {
  const movers = (segs: readonly PostgameSegment[]): PostgameSegment[] =>
    segs.filter((s) => s.dxFrom !== s.dxTo || s.dyFrom !== s.dyTo);

  it('walks the Inspector at 8 px a frame and the dog chase at 16 px a frame', () => {
    const inspector = movers(INSPECTOR);
    const dog = movers(DOG);
    expect(inspector.map((s) => s.name)).toEqual(['cross', 'return']);
    expect(dog.map((s) => s.name)).toEqual(['dash1', 'dash2', 'dash3', 'dash4']);
    for (const s of inspector) {
      const expected = Math.max(Math.abs(s.dxTo - s.dxFrom), Math.abs(s.dyTo - s.dyFrom)) / (WORLD_ENDING.strideWorldPx.inspector * s.fps);
      const got = s.toS - s.fromS;
      expect(Math.abs(got - expected) / expected, s.name).toBeLessThanOrEqual(0.1);
    }
    for (const s of dog) {
      const expected = Math.max(Math.abs(s.dxTo - s.dxFrom), Math.abs(s.dyTo - s.dyFrom)) / (WORLD_ENDING.strideWorldPx.dogChase * s.fps);
      const got = s.toS - s.fromS;
      expect(Math.abs(got - expected) / expected, s.name).toBeLessThanOrEqual(0.1);
    }
  });
});

describe('postgame purity', () => {
  it('stays free of Phaser and DOM globals', () => {
    const src = readFileSync(new URL('./worldPostgame.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*phaser/i);
    expect(src).not.toContain('document.');
    expect(src).not.toContain('window.');
  });
});
