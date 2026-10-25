// Postgame loop maths (WP23b): which segment of the 90 s loop a loop time falls in, the frame it shows and its dx / dy, linear across
// the segment. Why: the Inspector's walk and pat, the dog's chase dashes and the crow's perch run on one tested clock (STORY_BIBLE
// §9.2, DENIZEN_ART §3 fix 6, WORLD_ENDING.strideWorldPx), and the film script (worldFinale.ts) reads these poses after KEEP + 9 s.
// Pure: no Phaser, no DOM. Times are seconds of the loop; dx / dy are world px from the member's home (see worldFinale.ts).
import type { WorldRow } from '../../data/livingWorld';
import { WORLD_POSTGAME_LOOP } from '../../data/worldEnding';
import type { PostgameSegment } from '../../data/worldEnding';

export interface PostgamePose {
  seg: PostgameSegment;   // the segment the loop time falls in
  index: number;          // its index in the member's list
  frame: string;          // frames[floor((loopS - fromS) * fps) % frames.length]
  dx: number;             // world px, linear from dxFrom to dxTo across the segment
  dy: number;             // world px, +down, linear from dyFrom to dyTo
  flip: boolean;          // true = faces left
  row: WorldRow;          // front while the segment steps the member forward (dy at either end), else its home row
}

export interface PostgamePoses { inspector: PostgamePose; dog: PostgamePose; crow: PostgamePose }

// Loop time in [0, periodS): modulo the period; a non-finite time reads as 0.
export function wrapLoopS(loopS: number): number {
  const p = WORLD_POSTGAME_LOOP.periodS;
  if (!Number.isFinite(loopS)) return 0;
  const w = ((loopS % p) + p) % p;
  return w >= p ? 0 : w;
}

// Pose of one member's segment list at a loop time. The lists cover [0, periodS) without gaps (tested); a time past the last segment
// reads as the last one. home: the member's row when the segment does not step it (the Inspector back, the dog front, the crow back).
export function postgameSegmentAt(segments: readonly PostgameSegment[], loopS: number, home: WorldRow = 'back'): PostgamePose {
  const s = wrapLoopS(loopS);
  const found = segments.findIndex((seg) => s >= seg.fromS && s < seg.toS);
  const index = found >= 0 ? found : Math.max(0, segments.length - 1);
  const seg = segments[index];
  if (seg === undefined) throw new Error('postgameSegmentAt: empty segment list');
  const span = seg.toS - seg.fromS;
  const k = span > 0 ? Math.min(1, Math.max(0, (s - seg.fromS) / span)) : 0;
  const n = seg.frames.length;
  const f = Math.floor((s - seg.fromS) * seg.fps);
  return {
    seg,
    index,
    frame: seg.frames[((f % n) + n) % n] ?? '',
    dx: seg.dxFrom + (seg.dxTo - seg.dxFrom) * k,
    dy: seg.dyFrom + (seg.dyTo - seg.dyFrom) * k,
    flip: seg.flip,
    row: seg.dyFrom !== 0 || seg.dyTo !== 0 ? 'front' : home,
  };
}

// Inspector, dog and crow poses at a loop time (raw: the dog's dx is relative to its loop home, postgameDogHomeX; worldFinale adds the offset).
export function postgamePosesAt(loopS: number): PostgamePoses {
  return {
    inspector: postgameSegmentAt(WORLD_POSTGAME_LOOP.inspector, loopS, 'back'),
    dog: postgameSegmentAt(WORLD_POSTGAME_LOOP.dog, loopS, 'front'),
    crow: postgameSegmentAt(WORLD_POSTGAME_LOOP.crow, loopS, 'back'),
  };
}
