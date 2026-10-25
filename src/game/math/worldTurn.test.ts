// Tests for worldTurn (WP23a): blip counts (words, capped at 8), the talk timeline numbers (duration 5460 ms, reduced), the talk
// pose (snap, blip alternation at talkFps, snap-back), the glance timeline and pose, and the failed-sync schedule with a missing
// denizen. Pure maths, no Phaser.
import { describe, it, expect } from 'vitest';
import { blipCount, talkTimeline, talkPose, glanceTimeline, glancePose, failedSyncSchedule } from './worldTurn';
import { WORLD_LINES, WORLD_PLAYBACK } from '../../data/livingWorld';

describe('blipCount', () => {
  it('counts words split on any run of whitespace', () => {
    expect(blipCount('Is someone there? Your light is on.')).toBe(7);
    expect(blipCount('one two\tthree\n four')).toBe(4);
    expect(blipCount('  padded   words  ')).toBe(2);
  });

  it('is 0 for empty or blank text', () => {
    expect(blipCount('')).toBe(0);
    expect(blipCount('   ')).toBe(0);
  });

  it('caps at 8 blips', () => {
    expect(blipCount('a b c d e f g h')).toBe(8);
    expect(blipCount('a b c d e f g h i j')).toBe(8);
    expect(blipCount("Who's a good— who's a good— who's a good boy.")).toBe(8);
  });

  it('gives every bank line between 1 and 8 blips', () => {
    for (const line of WORLD_LINES) {
      const n = blipCount(line.text);
      expect(n, line.id).toBeGreaterThanOrEqual(1);
      expect(n, line.id).toBeLessThanOrEqual(8);
    }
  });
});

describe('talkTimeline', () => {
  it('times a 5460 ms bubble: snap 0, tracking 125, show 300, hide 5760, release 5760, done 6360', () => {
    expect(talkTimeline(5460, false)).toEqual({
      snapAtMs: 0,
      trackingUntilMs: 125,
      bubbleShowAtMs: 300,
      bubbleHideAtMs: 5760,
      releaseAtMs: 5760,
      doneAtMs: 6360,
    });
  });

  it('drops the tracking line when reduced and keeps every other time', () => {
    expect(talkTimeline(5460, true)).toEqual({
      snapAtMs: 0,
      trackingUntilMs: 0,
      bubbleShowAtMs: 300,
      bubbleHideAtMs: 5760,
      releaseAtMs: 5760,
      doneAtMs: 6360,
    });
  });

  it('releases the speaker at the bubble hide', () => {
    const tl = talkTimeline(3500, false);
    expect(tl.releaseAtMs).toBe(tl.bubbleHideAtMs);
    expect(tl.bubbleHideAtMs - tl.bubbleShowAtMs).toBe(3500);
    expect(tl.doneAtMs - tl.bubbleHideAtMs).toBe(600);
  });
});

describe('talkPose', () => {
  const tl = talkTimeline(5460, false);

  it('is profile before the snap and again from the snap-back (done)', () => {
    expect(talkPose(-1, tl, 3)).toBe('profile');
    expect(talkPose(6359, tl, 3)).toBe('front');
    expect(talkPose(6360, tl, 3)).toBe('profile');
  });

  it('is front from the snap and holds front until the talk window opens', () => {
    expect(talkPose(0, tl, 3)).toBe('front');
    expect(talkPose(299, tl, 3)).toBe('front');
  });

  it('alternates talk and front every 125 ms (talkFps 8) for blips × 2 phases from the show', () => {
    expect(WORLD_PLAYBACK.talkFps).toBe(8);
    // 3 blips = 6 phases of 125 ms from 300 ms: talk, front, talk, front, talk, front.
    expect(talkPose(300, tl, 3)).toBe('talk');
    expect(talkPose(424, tl, 3)).toBe('talk');
    expect(talkPose(425, tl, 3)).toBe('front');
    expect(talkPose(550, tl, 3)).toBe('talk');
    expect(talkPose(675, tl, 3)).toBe('front');
    expect(talkPose(800, tl, 3)).toBe('talk');
    expect(talkPose(924, tl, 3)).toBe('talk');
    expect(talkPose(925, tl, 3)).toBe('front');
    expect(talkPose(1049, tl, 3)).toBe('front');
    expect(talkPose(2000, tl, 3)).toBe('front');
  });

  it('plays 8 blips over 2 s (16 phases from the show)', () => {
    expect(talkPose(2174, tl, 8)).toBe('talk');
    expect(talkPose(2175, tl, 8)).toBe('front');
    expect(talkPose(2299, tl, 8)).toBe('front');
    expect(talkPose(2300, tl, 8)).toBe('front');
  });

  it('holds front with no blips', () => {
    expect(talkPose(300, tl, 0)).toBe('front');
    expect(talkPose(1000, tl, 0)).toBe('front');
    expect(talkPose(5759, tl, 0)).toBe('front');
  });

  it('uses the same beats for a reduced timeline', () => {
    const reduced = talkTimeline(5460, true);
    expect(talkPose(300, reduced, 3)).toBe('talk');
    expect(talkPose(6360, reduced, 3)).toBe('profile');
  });
});

describe('glanceTimeline and glancePose', () => {
  it('holds the glance for 1500 ms with the tracking line, none when reduced', () => {
    expect(glanceTimeline(false)).toEqual({ trackingUntilMs: 125, holdMs: 1500, doneAtMs: 1500 });
    expect(glanceTimeline(true)).toEqual({ trackingUntilMs: 0, holdMs: 1500, doneAtMs: 1500 });
  });

  it('is the glance frame while 0 <= t < holdMs, profile otherwise', () => {
    const tl = glanceTimeline(false);
    expect(glancePose(-1, tl)).toBe('profile');
    expect(glancePose(0, tl)).toBe('glance');
    expect(glancePose(1499, tl)).toBe('glance');
    expect(glancePose(1500, tl)).toBe('profile');
  });
});

describe('failedSyncSchedule', () => {
  it('runs every visible denizen in failedSyncOrder, 250 ms apart, each failing after 200 ms', () => {
    const all = ['dog', 'inspector', 'crow', 'payphone', 'sensor7', 'girl'] as const;
    expect(failedSyncSchedule(all)).toEqual([
      { id: 'dog', startMs: 0, failMs: 200 },
      { id: 'inspector', startMs: 250, failMs: 200 },
      { id: 'crow', startMs: 500, failMs: 200 },
      { id: 'payphone', startMs: 750, failMs: 200 },
    ]);
  });

  it('closes the gap when a denizen is missing (dog absent: inspector starts first)', () => {
    expect(failedSyncSchedule(['payphone', 'inspector', 'crow'])).toEqual([
      { id: 'inspector', startMs: 0, failMs: 200 },
      { id: 'crow', startMs: 250, failMs: 200 },
      { id: 'payphone', startMs: 500, failMs: 200 },
    ]);
  });

  it('keeps the canonical order whatever order the visible list has', () => {
    expect(failedSyncSchedule(['payphone', 'dog'])).toEqual([
      { id: 'dog', startMs: 0, failMs: 200 },
      { id: 'payphone', startMs: 250, failMs: 200 },
    ]);
  });

  it('never includes Sensor 7 or the girl, and is empty with nobody visible', () => {
    expect(failedSyncSchedule(['sensor7'])).toEqual([]);
    expect(failedSyncSchedule(['girl'])).toEqual([]);
    expect(failedSyncSchedule([])).toEqual([]);
  });
});
