// World turn timelines (WP23a): the snap-turn to camera of a speaker (tracking line, talk pose alternation, bubble window and
// snap-back), the wordless glance, the blip count of a line, and the failed-sync schedule of the wornMotor beat. Why: the renderers
// play these clocks; the numbers come from the bible (§7.1, §5.5) and DENIZEN_ART §4.3 through src/data/livingWorld.ts and
// src/data/audio.ts, so the
// timing is one tested rule. Pure: no Phaser, no DOM. Times are ms from the start of the beat.
import { AUDIO } from '../../data/audio';
import { WORLD_ENV, WORLD_PLAYBACK, WORLD_VOICE_CONFIG } from '../../data/livingWorld';
import type { DenizenId } from '../../data/livingWorld';

// Blips a line plays: its word count, at most AUDIO.world.maxBlips (DENIZEN_ART §4.3: min(words, 8)).
export function blipCount(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;
  return Math.min(AUDIO.world.maxBlips, words);
}

export interface TalkTimeline {
  snapAtMs: number;
  trackingUntilMs: number;
  bubbleShowAtMs: number;
  bubbleHideAtMs: number;
  releaseAtMs: number;
  doneAtMs: number;
}

// Turn to camera for a bubble of durationMs: snap to front at 0 (tracking line for one frame unless reduced), the bubble shows
// after turnHoldBeforeMs and hides after durationMs more, the speaker is released at the hide and snaps back turnHoldAfterMs later.
export function talkTimeline(durationMs: number, reduced: boolean): TalkTimeline {
  const show = WORLD_VOICE_CONFIG.turnHoldBeforeMs;
  const hide = show + durationMs;
  return {
    snapAtMs: 0,
    trackingUntilMs: reduced ? 0 : WORLD_ENV.trackingFrameMs,
    bubbleShowAtMs: show,
    bubbleHideAtMs: hide,
    releaseAtMs: hide,
    doneAtMs: hide + WORLD_VOICE_CONFIG.turnHoldAfterMs,
  };
}

// Pose of a talk turn at tMs. profile before the snap and from the snap-back (done) on; front from the snap; from the bubble show
// the mouth alternates talk and front at talkFps for blips × 2 phases (even phase talk), then front.
export function talkPose(tMs: number, tl: TalkTimeline, blips: number): 'profile' | 'front' | 'talk' {
  if (tMs < tl.snapAtMs || tMs >= tl.doneAtMs) return 'profile';
  const sinceShow = tMs - tl.bubbleShowAtMs;
  if (sinceShow < 0) return 'front';
  const phaseMs = 1000 / WORLD_PLAYBACK.talkFps;
  const phases = Math.max(0, Math.floor(blips)) * 2;
  if (sinceShow >= phases * phaseMs) return 'front';
  return Math.floor(sinceShow / phaseMs) % 2 === 0 ? 'talk' : 'front';
}

export interface GlanceTimeline {
  trackingUntilMs: number;
  holdMs: number;
  doneAtMs: number;
}

// Wordless glance: the head turns for glanceHoldMs (tracking line for one frame unless reduced), then back.
export function glanceTimeline(reduced: boolean): GlanceTimeline {
  const holdMs = WORLD_VOICE_CONFIG.glanceHoldMs;
  return { trackingUntilMs: reduced ? 0 : WORLD_ENV.trackingFrameMs, holdMs, doneAtMs: holdMs };
}

// Glance pose at tMs: the glance frame while 0 <= t < holdMs, else profile.
export function glancePose(tMs: number, tl: GlanceTimeline): 'glance' | 'profile' {
  return tMs >= 0 && tMs < tl.holdMs ? 'glance' : 'profile';
}

export interface FailedSyncStep {
  id: DenizenId;
  startMs: number;
  failMs: number;
}

// The wornMotor failed sync: each visible denizen tries to turn to camera, one by one in failedSyncOrder, failedSyncGapMs apart
// (index counts the visible ones, so a missing denizen does not leave a gap). Sensor 7 is never in the order and never joins.
export function failedSyncSchedule(visible: readonly DenizenId[]): FailedSyncStep[] {
  const order = WORLD_PLAYBACK.failedSyncOrder.filter((id) => visible.includes(id));
  return order.map((id, index) => ({
    id,
    startMs: index * WORLD_PLAYBACK.failedSyncGapMs,
    failMs: WORLD_PLAYBACK.failedSyncFailMs,
  }));
}
