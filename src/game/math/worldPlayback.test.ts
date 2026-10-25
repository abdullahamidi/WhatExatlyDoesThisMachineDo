// Tests for worldPlayback (WP23a): the playback ladder (mode, fps, cast alpha, shadow scale), the tape clock (crank and fps modes,
// fractions, freeze, reset), loop frames with the seam skip, sheet frame indices (era rows and fixed sheets), the window flicker,
// the mote orbit, the Sensor 7 head and the tally marks. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import {
  playbackMode, playbackFps, castAlpha, shadowScale, createTapeClock, loopFrameAt, sheetFrameIndex, windowFlicker,
  moteOrbit, sensorHead, tallyRects,
} from './worldPlayback';
import type { Rect } from './worldPlacement';
import { WORLD_ENV, WORLD_ERA_ROW_SHEETS, WORLD_FRAMES, WORLD_LOOPS, WORLD_MARKS } from '../../data/livingWorld';
import type { LoopFrame } from '../../data/livingWorld';

describe('playbackMode', () => {
  it('is crank in era I until wornMotor is owned (level 0 is not owned)', () => {
    expect(playbackMode({}, 1)).toBe('crank');
    expect(playbackMode({ wornMotor: 0 }, 1)).toBe('crank');
  });
  it('is fps2 once wornMotor is owned', () => {
    expect(playbackMode({ wornMotor: 1 }, 1)).toBe('fps2');
  });
  it('is fps4 once pistonArray is owned, whatever else', () => {
    expect(playbackMode({ wornMotor: 1, pistonArray: 1 }, 1)).toBe('fps4');
    expect(playbackMode({ pistonArray: 1 }, 1)).toBe('fps4');
  });
  it('is fps8 from era II whatever is owned', () => {
    expect(playbackMode({}, 2)).toBe('fps8');
    expect(playbackMode({ wornMotor: 1 }, 2)).toBe('fps8');
  });
});

describe('playbackFps', () => {
  it('is 0 for crank and 2 / 4 / 8 for the fps modes', () => {
    expect(playbackFps('crank')).toBe(0);
    expect(playbackFps('fps2')).toBe(2);
    expect(playbackFps('fps4')).toBe(4);
    expect(playbackFps('fps8')).toBe(8);
  });
});

describe('castAlpha', () => {
  it('is .75 before wornMotor, .85 after, and 1 from era II', () => {
    expect(castAlpha({}, 1)).toBe(0.75);
    expect(castAlpha({ wornMotor: 1 }, 1)).toBe(0.85);
    expect(castAlpha({ wornMotor: 1, pistonArray: 1 }, 1)).toBe(0.85);
    expect(castAlpha({}, 2)).toBe(1);
    expect(castAlpha({ wornMotor: 1 }, 2)).toBe(1);
  });
});

describe('shadowScale', () => {
  it('ghosts the shadow to half in era I and is normal from era II', () => {
    expect(shadowScale(1)).toBe(0.5);
    expect(shadowScale(2)).toBe(1);
    expect(shadowScale(3)).toBe(1);
  });
});

describe('createTapeClock', () => {
  it('starts at zero and unfrozen', () => {
    const clock = createTapeClock();
    expect(clock.tick()).toBe(0);
    expect(clock.frozen()).toBe(false);
  });

  it('crank mode adds whole crank steps and ignores time', () => {
    const clock = createTapeClock();
    clock.advance(5000, 'crank', 0);
    expect(clock.tick()).toBe(0);
    clock.advance(0, 'crank', 2);
    clock.advance(100000, 'crank', 1);
    expect(clock.tick()).toBe(3);
  });

  it('crank mode floors fractional steps and never goes back', () => {
    const clock = createTapeClock();
    clock.advance(0, 'crank', 2.9);
    expect(clock.tick()).toBe(2);
    clock.advance(0, 'crank', -4);
    expect(clock.tick()).toBe(2);
  });

  it('fps modes accrue time at the mode fps and ignore crank steps', () => {
    const clock = createTapeClock();
    clock.advance(1000, 'fps8', 5);
    expect(clock.tick()).toBe(8);
    const slow = createTapeClock();
    slow.advance(1000, 'fps2', 0);
    expect(slow.tick()).toBe(2);
    const mid = createTapeClock();
    mid.advance(1000, 'fps4', 9);
    expect(mid.tick()).toBe(4);
  });

  it('fps modes keep the fraction between calls', () => {
    const clock = createTapeClock();
    clock.advance(250, 'fps2', 0);
    expect(clock.tick()).toBe(0);
    clock.advance(250, 'fps2', 0);
    expect(clock.tick()).toBe(1);
    clock.advance(1000, 'fps2', 0);
    expect(clock.tick()).toBe(3);
  });

  it('a freeze consumes time and adds no ticks (crank steps included), then the tape resumes', () => {
    const clock = createTapeClock();
    clock.freeze(1200);
    expect(clock.frozen()).toBe(true);
    clock.advance(1000, 'fps8', 3);
    expect(clock.frozen()).toBe(true);
    expect(clock.tick()).toBe(0);
    clock.advance(200, 'fps8', 0);
    expect(clock.frozen()).toBe(false);
    expect(clock.tick()).toBe(0);
    clock.advance(1000, 'fps8', 0);
    expect(clock.tick()).toBe(8);
  });

  it('a freeze that ends inside one call adds no ticks in that call', () => {
    const clock = createTapeClock();
    clock.freeze(1200);
    clock.advance(1500, 'fps8', 0);
    expect(clock.frozen()).toBe(false);
    expect(clock.tick()).toBe(0);
  });

  it('freeze(0) does nothing and a running freeze keeps the longer time', () => {
    const clock = createTapeClock();
    clock.freeze(0);
    expect(clock.frozen()).toBe(false);
    clock.freeze(1200);
    clock.freeze(300);
    clock.advance(1000, 'fps8', 0);
    expect(clock.frozen()).toBe(true);
    clock.advance(200, 'fps8', 0);
    expect(clock.frozen()).toBe(false);
  });

  it('reset clears ticks, the fraction and any freeze', () => {
    const clock = createTapeClock();
    clock.advance(1060, 'fps8', 0);
    expect(clock.tick()).toBe(8);
    clock.freeze(1000);
    clock.reset();
    expect(clock.tick()).toBe(0);
    expect(clock.frozen()).toBe(false);
    clock.advance(70, 'fps8', 0);
    expect(clock.tick()).toBe(0);
  });
});

describe('loopFrameAt', () => {
  const loop: LoopFrame[] = [
    { frame: 'a', dx: 0 }, { frame: 'b', dx: 0 }, { frame: 'c', dx: 0 }, { frame: 'd', dx: 0 },
  ];
  const names = (seam: boolean, ticks: readonly number[]): string[] => ticks.map((t) => loopFrameAt(loop, t, seam).frame);
  const ticks0to11 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  it('without the seam cycles every frame in order', () => {
    expect(names(false, ticks0to11)).toEqual(['a', 'b', 'c', 'd', 'a', 'b', 'c', 'd', 'a', 'b', 'c', 'd']);
  });

  it('with the seam skips one frame at each wrap (len 4, ticks 0..11)', () => {
    expect(names(true, ticks0to11)).toEqual(['a', 'b', 'c', 'd', 'b', 'c', 'd', 'a', 'c', 'd', 'a', 'b']);
  });

  it('floors fractional ticks and clamps negative ticks to frame 0', () => {
    expect(loopFrameAt(loop, 2.9, false).frame).toBe('c');
    expect(loopFrameAt(loop, -3, false).frame).toBe('a');
    expect(loopFrameAt(loop, -3, true).frame).toBe('a');
  });

  it('returns the loop frame object itself', () => {
    expect(loopFrameAt(loop, 1, false)).toBe(loop[1]);
  });

  it('throws on an empty loop', () => {
    expect(() => loopFrameAt([], 0, false)).toThrow();
  });

  it('every real loop gives one of its own frames at every tick, seam or not', () => {
    for (const [id, frames] of Object.entries(WORLD_LOOPS)) {
      for (let t = 0; t < 60; t++) {
        for (const seam of [false, true]) {
          const f = loopFrameAt(frames, t, seam);
          expect(frames, id).toContain(f);
        }
      }
    }
  });
});

describe('sheetFrameIndex', () => {
  it('reads row 0 of an era-row sheet as the column', () => {
    expect(sheetFrameIndex('inspector', 'idleA', 0)).toBe(0);
    expect(sheetFrameIndex('dog', 'sit0', 0)).toBe(0);
    expect(sheetFrameIndex('inspector', 'talk', 0)).toBe(10);
  });

  it('offsets by row × frames per row (inspector 19 frames, dog 20)', () => {
    expect(sheetFrameIndex('inspector', 'idleA', 1)).toBe(19);
    expect(sheetFrameIndex('inspector', 'talk', 1)).toBe(29);
    expect(sheetFrameIndex('dog', 'sit0', 2)).toBe(40);
    expect(sheetFrameIndex('inspector', 'idleA', 5)).toBe(95);
  });

  it('reads every era-row sheet in every row (first and last frame)', () => {
    for (const sheet of WORLD_ERA_ROW_SHEETS) {
      const frames = WORLD_FRAMES[sheet];
      const first = frames[0] ?? '';
      const last = frames[frames.length - 1] ?? '';
      for (let row = 0; row <= 5; row++) {
        expect(sheetFrameIndex(sheet, first, row), sheet).toBe(row * frames.length);
        expect(sheetFrameIndex(sheet, last, row), sheet).toBe(row * frames.length + frames.length - 1);
      }
    }
  });

  it('clamps the era row to 0..5 and floors fractions', () => {
    expect(sheetFrameIndex('inspector', 'idleA', 9)).toBe(95);
    expect(sheetFrameIndex('inspector', 'idleA', -2)).toBe(0);
    expect(sheetFrameIndex('inspector', 'idleA', 1.9)).toBe(19);
    expect(sheetFrameIndex('inspector', 'idleA', Infinity)).toBe(95);
  });

  it('keeps a fixed sheet in row 0 whatever the era row', () => {
    expect(sheetFrameIndex('lamp', 'warm', 4)).toBe(2);
    expect(sheetFrameIndex('clock', 'restored', 5)).toBe(1);
    expect(sheetFrameIndex('girlWindow', 'dark', 3)).toBe(2);
    expect(sheetFrameIndex('windowLit', 'breathe', 2)).toBe(1);
  });

  it('throws on an unknown frame name', () => {
    expect(() => sheetFrameIndex('dog', 'nope', 0)).toThrow();
    expect(() => sheetFrameIndex('lamp', 'idleA', 0)).toThrow();
  });

});

describe('windowFlicker', () => {
  const [lo, hi] = WORLD_ENV.windowFlickerMs;
  const seed = WORLD_ENV.windowFlickerSeed;

  it('holds inside the flicker window for every step', () => {
    for (let k = 0; k < 200; k++) {
      const { holdMs } = windowFlicker(k, seed);
      expect(holdMs).toBeGreaterThanOrEqual(lo);
      expect(holdMs).toBeLessThan(hi);
    }
  });

  it('alternates the frame with step parity', () => {
    expect(windowFlicker(0, seed).frame).toBe('flickerA');
    expect(windowFlicker(1, seed).frame).toBe('flickerB');
    expect(windowFlicker(2, seed).frame).toBe('flickerA');
    expect(windowFlicker(-1, seed).frame).toBe('flickerB');
  });

  it('is deterministic for k and seed, and varies across k', () => {
    expect(windowFlicker(7, seed)).toEqual(windowFlicker(7, seed));
    const holds = new Set<number>();
    for (let k = 0; k < 20; k++) holds.add(windowFlicker(k, seed).holdMs);
    expect(holds.size).toBeGreaterThan(1);
    expect(windowFlicker(3, seed).holdMs).not.toBe(windowFlicker(3, seed + 1).holdMs);
  });
});

describe('moteOrbit', () => {
  const { orbitRadiusPx: rx, count, periodMs } = WORLD_ENV.motes;

  it('puts mote 0 on the right end of the ellipse at t 0', () => {
    expect(moteOrbit(0, 0)).toEqual({ dx: rx, dy: 0 });
  });

  it('spaces the motes evenly by phase i / count', () => {
    expect(moteOrbit(1, 0)).toEqual({ dx: 4, dy: 7 });
    expect(moteOrbit(2, 0)).toEqual({ dx: -11, dy: 4 });
  });

  it('gives whole numbers and never -0', () => {
    expect(moteOrbit(0, periodMs / 4)).toEqual({ dx: 0, dy: 7 });
    expect(moteOrbit(0, (3 * periodMs) / 4)).toEqual({ dx: 0, dy: -7 });
  });

  it('stays inside the ellipse (half radius up and down)', () => {
    for (let i = 0; i < count; i++) {
      for (let t = 0; t <= periodMs; t += 250) {
        const { dx, dy } = moteOrbit(i, t);
        expect(Math.abs(dx)).toBeLessThanOrEqual(rx);
        expect(Math.abs(dy)).toBeLessThanOrEqual(rx / 2);
      }
    }
  });

  it('repeats every period', () => {
    for (const t of [0, 500, 1000, 2000]) {
      expect(moteOrbit(2, t + periodMs)).toEqual(moteOrbit(2, t));
    }
  });
});

describe('sensorHead', () => {
  const range = WORLD_ENV.sensor7.headRangeWorldPx;
  const sensorX = 1384;

  it('looks at centre while the camera is inside the range, edges included', () => {
    expect(sensorHead(sensorX, sensorX)).toBe('headC');
    expect(sensorHead(sensorX, sensorX + range)).toBe('headC');
    expect(sensorHead(sensorX, sensorX - range)).toBe('headC');
  });

  it('looks right past the range to the right and left past it to the left', () => {
    expect(sensorHead(sensorX, sensorX + range + 1)).toBe('headR');
    expect(sensorHead(sensorX, sensorX - range - 1)).toBe('headL');
  });
});

describe('tallyRects', () => {
  const pane = WORLD_MARKS.pane;
  const inside = (r: Rect): boolean => r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0
    && r.x + r.w <= pane.w && r.y + r.h <= pane.h;

  it('pins the pane to 16 by 24 art px', () => {
    expect(pane.w).toBe(16);
    expect(pane.h).toBe(24);
  });

  it('draws nothing for zero or a negative count', () => {
    expect(tallyRects(0)).toEqual([]);
    expect(tallyRects(-3)).toEqual([]);
  });

  it('one mark is one vertical stroke at the pane origin', () => {
    expect(tallyRects(1)).toEqual([{ x: 0, y: 0, w: 1, h: WORLD_MARKS.strokeH }]);
  });

  it('four marks are four vertical strokes', () => {
    expect(tallyRects(4)).toEqual([
      { x: 0, y: 0, w: 1, h: 4 }, { x: 2, y: 0, w: 1, h: 4 }, { x: 4, y: 0, w: 1, h: 4 }, { x: 6, y: 0, w: 1, h: 4 },
    ]);
  });

  it('the fifth mark adds exactly the three slash pixels (1,3) (3,2) (5,1), in the gaps between the strokes', () => {
    expect(tallyRects(5).length).toBe(7);
    expect(tallyRects(5).slice(4)).toEqual([
      { x: 1, y: 3, w: 1, h: 1 }, { x: 3, y: 2, w: 1, h: 1 }, { x: 5, y: 1, w: 1, h: 1 },
    ]);
  });

  it('the sixth mark starts group 1 one group pitch over, at x 9', () => {
    expect(tallyRects(6)[7]).toEqual({ x: 9, y: 0, w: 1, h: 4 });
  });

  it('the eleventh mark starts group 2 on the second row (y 5 = strokeH + rowGap)', () => {
    expect(tallyRects(10).length).toBe(14);
    expect(tallyRects(11).slice(-1)).toEqual([{ x: 0, y: 5, w: 1, h: 4 }]);
  });

  it('counts seven rects per full group: 41 marks = 57 (8 full groups + 1 stroke), 50 marks = 70', () => {
    expect(tallyRects(41).length).toBe(57);
    expect(tallyRects(50).length).toBe(70);
  });

  it('treats NaN as zero marks', () => {
    expect(tallyRects(Number.NaN)).toEqual([]);
  });

  it('clamps to the 50-mark capacity', () => {
    expect(tallyRects(99)).toEqual(tallyRects(50));
  });

  it('keeps every rect inside the pane for each test count', () => {
    for (const count of [0, 1, 4, 5, 41, 50, 99]) {
      for (const r of tallyRects(count)) expect(inside(r), `count ${count}`).toBe(true);
    }
  });

  it('no two rects overlap at capacity (the pixel set is as big as the summed area)', () => {
    const rects = tallyRects(50);
    const pixels = new Set<string>();
    for (const r of rects) {
      for (let dy = 0; dy < r.h; dy++) {
        for (let dx = 0; dx < r.w; dx++) pixels.add(`${r.x + dx},${r.y + dy}`);
      }
    }
    const area = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(pixels.size).toBe(area);
  });
});
