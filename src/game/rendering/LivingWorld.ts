// Living world cast renderer (WP23a, WP23b): the Inspector, the Dog, the Crow and the Girl (ground stage) as pooled sprites on the back
// and front ground rows, Sensor 7 (tripod, head, readout, lens fog and the LED), their flat shadows, and the tape playback of their loops
// with the turn, glance, failed-sync, notice and ripple effects. Eras III-V (WP23b) follow the visual state: vent, shake, roam and perch
// loops, the stare, the reverse in era V, the downbeat accents and the ripples. The finale film (setScript) draws every member from its
// frame; snapAll holds the front poses; CastExtras draws the clipboard, red ball and double exposures. Why: the cast draws what the
// tested maths decide
// (worldPlayback, worldTurn, worldState, worldPlacement); every sprite, shadow and tracking texture is created once here and shown or
// hidden afterwards (WP23 D5). Numbers come from src/data. Reduced motion follows STORY_BIBLE 7.7: no tracking line, no mains flicker,
// no ripple, no crow beat rise; the beat-snapped accent poses, the crank stepping, the ambient loops and the notices stay.
// Rendering only: no economy state is read or written.
import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../../assets/manifest';
import type { AssetId } from '../../assets/assetIds';
import { AUDIO } from '../../data/audio';
import { PALETTE } from '../../data/palette';
import { MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { WORLD_DEPTH_OFFSETS, WORLD_ENV, WORLD_LOOPS, WORLD_PLAYBACK, WORLD_ROWS, WORLD_SHADOW_WIDTHS, WORLD_SHEET_KEYS } from '../../data/livingWorld';
import type { DenizenId, GroundId, LoopFrame, WorldPlacement, WorldRow } from '../../data/livingWorld';
import { WORLD_ERA_ENV, WORLD_ERA_LOOPS } from '../../data/worldEras';
import type { CameraPose } from '../math/finale';
import { createTapeClock, isDownbeat, loopFrameAt, sensorHead, sheetFrameIndex, shadowScale } from '../math/worldPlayback';
import type { PlaybackMode, TapeClock } from '../math/worldPlayback';
import { failedSyncSchedule, glancePose, glanceTimeline, talkPose, talkTimeline } from '../math/worldTurn';
import type { GlanceTimeline, TalkTimeline } from '../math/worldTurn';
import { screenOfWorld } from '../math/worldPlacement';
import type { SpeakerAnchor } from '../math/worldPlacement';
import type { CastScriptPose, WorldScriptFrame } from '../math/worldScript';
import type { DogPose, WorldVisualState } from '../math/worldState';
import { CastExtras } from './CastExtras';
import type { ExtraPose } from './CastExtras';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

/** Cast members this renderer draws. */
export type LivingId = 'inspector' | 'dog' | 'crow' | 'girl' | 'sensor7';
/** The walking members (Sensor 7 is static on its post; the girl walks on the ground stage only). */
type WalkerId = 'inspector' | 'dog' | 'crow' | 'girl';
/** Frame names of one member's poses: front (to camera at rest), talk (mouth open), glance (head turn); accent = the era IV downbeat frame. */
interface PoseNames { front: string; talk: string; glance: string; accent?: string }

// Frame names per member (DENIZEN_ART 2.1-2.4, 2.6 and 4.3).
const POSE_FRAMES: Record<LivingId, PoseNames> = {
  inspector: { front: 'front', talk: 'talk', glance: 'glance', accent: 'write0' },
  dog: { front: 'head', talk: 'talk', glance: 'head', accent: 'wag' },
  crow: { front: 'head', talk: 'talk', glance: 'head' },
  girl: { front: 'stand0', talk: 'talk', glance: 'stand0', accent: 'stand1' },
  sensor7: { front: 'headC', talk: 'headC', glance: 'headC' },
};
// The lying dog (demo hold image, DENIZEN_ART 2.2): one static frame.
const LIE_LOOP: readonly LoopFrame[] = [{ frame: 'lie', dx: 0 }];
// The dog's state loops (WP23b): every pose except the roam, which reverses in era V (dogLoopOf).
const DOG_LOOPS: Record<Exclude<DogPose, 'roam'>, readonly LoopFrame[]> = {
  lie: LIE_LOOP, dig: WORLD_LOOPS.dogDig, loop: WORLD_LOOPS.dog, shake: WORLD_ERA_LOOPS.dogShake, still: WORLD_ERA_LOOPS.dogStill,
};
// The crow perched and still (era V under reduced motion; the stutter is one static pose there, STORY_BIBLE 7.7).
const PERCH_STILL: readonly LoopFrame[] = [{ frame: 'perch0', dx: 0 }];
// Sensor 7 foot dots: art px from the feet, each dot 2 art px wide and 1 high (DENIZEN_ART 1.4).
const SENSOR_DOT_ART_X: readonly number[] = [-6, 0, 6];
// Shadow bake: three ellipse rows of art px, the top and bottom rows inset at each end.
const SHADOW_ROWS = 3;
const SHADOW_INSET_PX = 2;
const SHADOW_KEY_PREFIX = 'world.shadow#';
// Tracking-line texture suffix: a canvas copy of a sheet with the tracking rows shifted.
const TRACK_SUFFIX = '#trk';
// Speech bubble anchor: world px below the frame top (the head point of SpeakerAnchor).
const HEAD_ANCHOR_WORLD_PX = 4;
// Tier-up ripple: world px nudge on the one frame it plays (era I crow, era II dog, era III gust on every walker).
const RIPPLE_NUDGE_WORLD_PX = 2;
// Sensor 7 double blink: four steps of doubleBlinkMs (dark, lit, dark, lit).
const BLINK_STEPS = 4;
// Frame-time window for the mean in stats().
const TIMING_WINDOW = 120;
// Unlit LED colour (palette).
const LED_DIM = PALETTE.rustDark;

/**
 * A snap-turn to camera. talk runs open until release (tl holds the bubble window, blips the mouth alternation of the line);
 * glance is a fixed hold.
 */
type Turn =
  | { kind: 'talk'; snapMs: number; trackMs: number; endMs: number; blips: number; tl: TalkTimeline }
  | { kind: 'glance'; snapMs: number; trackMs: number; endMs: number; gl: GlanceTimeline };

/** A timed frame sequence (failed-sync pose, notice): frames[i] shows for stepMs from startMs. flip mirrors the frame. */
interface Beat { startMs: number; endMs: number; stepMs: number; frames: readonly string[]; flip: boolean }
/** A loop pick: the loop, and whether it plays backwards (the route and the roam in era V). */
interface LoopPick { loop: readonly LoopFrame[]; reverse: boolean }
/** The idle frame of a walker this frame: the frame name, the loop dx (world px) and the mirror. */
interface IdleFrame { frame: string; dx: number; flip: boolean }

interface Walker {
  readonly id: WalkerId;
  readonly body: Phaser.GameObjects.Sprite;
  readonly blend: Phaser.GameObjects.Sprite;   // the film's crossfade row over the body (script mode only)
  readonly shadow: Phaser.GameObjects.Image | null;
  feetY: number;                      // rest feet y, world px (crow: lifted for its perch; girl: placement row + dy)
  anchorY: number;                    // feet y the speech tail follows: the film's feet y in script mode, else feetY
  row: WorldRow;                      // the row container the body, blend and shadow sit in (the girl and the film move between rows)
  home: WorldRow;                     // the row without a film: the construction row (the girl: her placement row)
  placement: WorldPlacement | null;   // null while hidden
  visible: boolean;
  feetX: number;                      // world px: placement x + loop dx (+ ripple nudge)
  frame: string;                      // frame name shown
  flip: boolean;
  dx: number;                         // last applied loop dx; held while a pose runs
  accentUntil: number;                // era IV downbeat: the accent frame (or the crow's rise) runs until this time
  turn: Turn | null;
  beat: Beat | null;
  talking: boolean;
}

interface Sensor {
  readonly feetY: number;
  readonly dots: Phaser.GameObjects.Graphics;
  readonly tripod: Phaser.GameObjects.Sprite;
  readonly head: Phaser.GameObjects.Sprite;
  readonly headBlend: Phaser.GameObjects.Sprite;  // the head's crossfade row (script only), over the head, under the readout
  readonly glyph: Phaser.GameObjects.Sprite;
  readonly fog: Phaser.GameObjects.Sprite;     // lens fog: shown while state.sensor.fog (era III with vents)
  readonly led: Phaser.GameObjects.Rectangle;
  ledColor: number;
  placement: WorldPlacement | null;
  visible: boolean;
  feetX: number;
  frame: string;                               // head frame shown
  turn: Turn | null;
  blinkStart: number | null;                   // sensorBlink notice start, null when idle
  talking: boolean;
}

// Points a sprite at a sheet frame: texture and frame change only when they differ (no per-frame work for a still pose).
function paint(sprite: Phaser.GameObjects.Sprite, key: string, index: number): void {
  if (sprite.texture.key !== key) sprite.setTexture(key, index);
  else if (Number(sprite.frame.name) !== index) sprite.setFrame(index);
}

// Frame size of a sheet, from the manifest (the registry is the one source of sheet dims).
function frameOf(id: LivingId): { width: number; height: number } {
  const entry = ASSET_MANIFEST[WORLD_SHEET_KEYS[id] as AssetId];
  if (entry.frame === undefined) throw new Error(`LivingWorld: ${entry.id} has no frame size`);
  return entry.frame;
}

// Head and feet of a sprite whose origin is its feet (feetX, feetY in world px) and whose frame is frameHeightWorld tall, in game px.
// The head point sits HEAD_ANCHOR_WORLD_PX below the frame top; every speaker uses the same offset.
function speakerAnchor(feetX: number, feetY: number, frameHeightWorld: number, cam: CameraPose): SpeakerAnchor {
  return {
    head: screenOfWorld({ x: feetX, y: feetY - frameHeightWorld + HEAD_ANCHOR_WORLD_PX }, 1, cam),
    feet: screenOfWorld({ x: feetX, y: feetY }, 1, cam),
  };
}

function shadowKey(width: number): string {
  return SHADOW_KEY_PREFIX + String(width);
}

function makeBeat(startMs: number, frames: readonly string[], stepMs: number, flip: boolean): Beat {
  return { startMs, endMs: startMs + frames.length * stepMs, stepMs, frames, flip };
}

// Frame of a beat at now, or null before it starts and after its last step.
function beatFrame(beat: Beat, now: number): string | null {
  const t = now - beat.startMs;
  if (t < 0) return null;
  const i = Math.floor(t / beat.stepMs);
  return i < beat.frames.length ? (beat.frames[i] ?? null) : null;
}

function turnActive(turn: Turn, now: number): boolean {
  return now < turn.endMs;
}

// Pose of a turn at now: a frame name, or null while the loop runs (before the snap, after the hold).
function turnPose(turn: Turn, now: number, names: PoseNames): string | null {
  const t = now - turn.snapMs;
  if (turn.kind === 'glance') return glancePose(t, turn.gl) === 'glance' ? names.glance : null;
  const pose = talkPose(t, turn.tl, turn.blips);
  if (pose === 'profile') return null;
  if (t >= turn.tl.bubbleHideAtMs) return names.front;
  return pose === 'talk' ? names.talk : names.front;
}

// Blips of a talk line: the count given to setTalking, or AUDIO.world.maxBlips when it is omitted or not finite.
function blipsOf(blips: number | undefined): number {
  return blips !== undefined && Number.isFinite(blips) ? blips : AUDIO.world.maxBlips;
}

// True while a double blink runs.
function blinkRunning(startMs: number | null, now: number): boolean {
  if (startMs === null) return false;
  const t = now - startMs;
  return t >= 0 && t < BLINK_STEPS * WORLD_ENV.sensor7.doubleBlinkMs;
}

// LED dark in blink steps 0 and 2 (the double blink), lit otherwise.
function blinkDark(startMs: number | null, now: number): boolean {
  if (startMs === null || !blinkRunning(startMs, now)) return false;
  const step = Math.floor((now - startMs) / WORLD_ENV.sensor7.doubleBlinkMs);
  return step === 0 || step === 2;
}

// Crow feet lift in art px: highest while it flies (cycle 2+), perched from era III, low on the wire before.
function crowLiftArtOf(state: WorldVisualState): number {
  if (state.traces.crowHigh) return WORLD_ENV.crowLiftArtPx + WORLD_ERA_ENV.crowHighExtraArtPx;
  return state.era >= 3 ? WORLD_ERA_ENV.crowPerchLiftArtPx : WORLD_ENV.crowLiftArtPx;
}

// Inspector loop: the vent umbrella in era III with vents, the route walk when it has a route, else the static idle.
function inspectorLoopOf(placement: WorldPlacement, state: WorldVisualState): LoopPick {
  if (state.era === 3 && state.vents) return { loop: WORLD_ERA_LOOPS.inspectorVent, reverse: false };
  if (placement.route === undefined) return { loop: WORLD_LOOPS.inspectorStatic, reverse: false };
  return { loop: WORLD_LOOPS.inspector, reverse: state.reverse };
}

// Dog loop: the state's pose; the roam (era V) plays backwards when the state reverses.
function dogLoopOf(state: WorldVisualState): LoopPick {
  if (state.dogPose === 'roam') return { loop: WORLD_ERA_LOOPS.dogRoam, reverse: state.reverse };
  return { loop: DOG_LOOPS[state.dogPose], reverse: false };
}

// Crow loop: high while it flies (cycle 2+), perched from era III (era V stutters in place; one pose under reduced motion).
function crowLoopOf(state: WorldVisualState, reduced: boolean): LoopPick {
  if (state.traces.crowHigh) return { loop: WORLD_ERA_LOOPS.crowHigh, reverse: false };
  if (state.era === 3 || state.era === 4) return { loop: WORLD_ERA_LOOPS.crowPerch, reverse: false };
  if (state.era === 5) return { loop: reduced ? PERCH_STILL : WORLD_ERA_LOOPS.crowStutterV, reverse: false };
  return { loop: state.era === 2 && !reduced ? WORLD_LOOPS.crowStutter : WORLD_LOOPS.crow, reverse: false };
}

// Shadow alpha of the film: the era's scale, whatever state.shadows says (the dog fade drives the pose alpha).
function filmShadowAlpha(state: WorldVisualState): number {
  return WORLD_PLAYBACK.shadowAlpha * shadowScale(state.era);
}

/**
 * The living world cast. Built once per scene: every sprite, shadow and texture exists from the constructor on and is shown or
 * hidden afterwards. apply() takes the visual state and the placements; update() steps the tape and draws the poses.
 */
export class LivingWorld {
  private readonly scene: Phaser.Scene;
  private readonly rows: WorldRows;
  private readonly heartbeatLow: (nowMs: number) => boolean;
  private readonly beatLow: (nowMs: number) => boolean;
  private readonly clock: TapeClock = createTapeClock();
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly ownedTextures: string[] = [];
  private readonly tracks: Record<LivingId, string | null>;
  private readonly timings: number[] = [];
  private timingNext = 0;
  private readonly inspector: Walker;
  private readonly dog: Walker;
  private readonly crow: Walker;
  private readonly girl: Walker;
  private readonly sensor: Sensor;
  private readonly extras: CastExtras;
  private state: WorldVisualState | null = null;
  private placements: Readonly<Record<GroundId, WorldPlacement | null>> | null = null;
  private script: WorldScriptFrame | null = null;   // the finale film frame, or null for the state-driven drawing
  private snapped = false;                          // snapAll: every member holds its front pose
  private mode: PlaybackMode = 'crank';
  private eraRow = 0;
  private reduced = false;
  private forceHidden = false;
  private destroyed = false;
  private nowMs = 0;
  private trackUntilMs = Number.NEGATIVE_INFINITY;
  private nudgeId: WalkerId | null = null;
  private gust = false;               // era III ripple: every walker is nudged for one frame
  private beatWasLow = false;         // beatLow at the last frame: a downbeat is its falling edge
  private beatNow = false;            // beatLow this frame (the Sensor 7 pulse)
  private downbeat = false;           // a downbeat this frame
  private risePending = false;        // era IV ripple: the walkers rise on the next downbeat
  private riseUntilMs = Number.NEGATIVE_INFINITY;
  private shadowShiftUntilMs = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene, rows: WorldRows, heartbeatLow: (nowMs: number) => boolean,
    beatLow: (nowMs: number) => boolean = () => false) {
    this.scene = scene;
    this.rows = rows;
    this.heartbeatLow = heartbeatLow;
    this.beatLow = beatLow;
    for (const width of WORLD_SHADOW_WIDTHS) this.bakeShadow(width);
    this.tracks = {
      inspector: this.bakeTrack('inspector'),
      dog: this.bakeTrack('dog'),
      crow: this.bakeTrack('crow'),
      girl: this.bakeTrack('girl'),
      sensor7: this.bakeTrack('sensor7'),
    };
    this.inspector = this.makeWalker('inspector', 'back', WORLD_ROWS.back.y, WORLD_DEPTH_OFFSETS.cast, WORLD_SHADOW_WIDTHS[0]);
    this.dog = this.makeWalker('dog', 'front', WORLD_ROWS.front.y, WORLD_DEPTH_OFFSETS.cast, WORLD_SHADOW_WIDTHS[1]);
    this.crow = this.makeWalker('crow', 'back', WORLD_ROWS.back.y - WORLD_ENV.crowLiftArtPx * PIXEL_SCALE, WORLD_DEPTH_OFFSETS.crow, null);
    this.girl = this.makeWalker('girl', 'back', WORLD_ROWS.back.y, WORLD_DEPTH_OFFSETS.cast, WORLD_SHADOW_WIDTHS[0]);
    this.sensor = this.makeSensor(rows.back, WORLD_ROWS.back.y);
    this.extras = new CastExtras(scene, rows);
  }

  /** Takes the visual state and where each member stands. A null placement (or state.visible false) hides that member. */
  apply(state: WorldVisualState, placements: Readonly<Record<GroundId, WorldPlacement | null>>, opts: { reducedMotion: boolean }): void {
    if (this.destroyed) return;
    this.state = state;
    this.placements = placements;
    this.reduced = opts.reducedMotion;
    this.mode = state.mode;
    this.eraRow = state.eraRow;
    this.forceHidden = false;
    this.extras.apply(state, { reducedMotion: opts.reducedMotion });
    this.applyAll();
  }

  /**
   * The finale film frame: while it is set every member draws from frame.cast[id] (row, frame, blend, offset, mirror, alpha, shadow)
   * and the loops, glances and turns pause. null restores the state-driven drawing at once.
   */
  setScript(frame: WorldScriptFrame | null): void {
    if (this.destroyed) return;
    const wasFilm = this.script !== null;
    const isFilm = frame !== null;
    // Nothing to do without a film before or after (the director calls null every frame outside the ending).
    if (!wasFilm && !isFilm) return;
    this.script = frame;
    this.extras.setScript(frame);
    // Only a switch re-applies the placed members; a film frame to the next frame draws in update() alone.
    if (wasFilm !== isFilm) this.applyAll();
  }

  /**
   * Holds every visible member on its front pose (inspector front, dog head, crow head, Sensor 7 headC, girl stand0) until
   * snapAll(false). The snap shows the tracking line for one frame unless quiet (the LAST FRAME white-in stays clean).
   */
  snapAll(on: boolean, quiet = false): void {
    this.snapped = on;
    if (on && !quiet) this.trackUntilMs = this.nowMs + WORLD_ENV.trackingFrameMs;
  }

  /** A walker's pose for its extras: feet, frame, mirror and alpha of the body; null while hidden and for Sensor 7 (no extras). */
  poseOf(id: LivingId): ExtraPose | null {
    if (id === 'sensor7') return null;
    const w = this.walkerOf(id);
    if (!w.visible) return null;
    return { x: w.body.x, feetY: w.body.y, frame: w.frame, flip: w.body.flipX, visible: true, alpha: w.body.alpha, row: w.row };
  }

  /** Starts a host's era V double-exposure flash (refused under reduced motion and in a script). Sensor 7 has none. */
  flashDouble(id: LivingId): void {
    if (id !== 'sensor7') this.extras.flash(id);
  }

  /** Double-exposure flashes started since construction. */
  flashCount(): number {
    return this.extras.flashCount();
  }

  /** Debug probe of the extras: the clipboard, the red ball and each host's flash. */
  extrasProbe(): { id: string; variant: string; x: number; visible: boolean; speaking: boolean }[] {
    return this.extras.probe();
  }

  // Visibility, shadows and placements of every member from the stored state and placements. Nothing runs while hidden (hideAll).
  private applyAll(): void {
    const state = this.state;
    const placements = this.placements;
    if (state === null || placements === null || this.forceHidden) return;
    this.applyWalker(this.inspector, placements.inspector, state);
    this.applyWalker(this.dog, placements.dog, state);
    this.applyWalker(this.crow, placements.crow, state);
    this.crow.feetY = WORLD_ROWS.back.y - crowLiftArtOf(state) * PIXEL_SCALE;
    this.applyGirl(placements.girl, state);
    this.applySensor(placements.sensor7, state);
  }

  /** One frame: steps the tape by dtMs and crankSteps, then draws every member at nowMs from the camera pose cam. */
  update(dtMs: number, crankSteps: number, nowMs: number, cam: CameraPose): void {
    if (this.destroyed) return;
    const t0 = performance.now();
    this.nowMs = nowMs;
    this.clock.advance(dtMs, this.mode, crankSteps);
    this.stepBeat(nowMs);
    const state = this.state;
    if (state !== null && !this.forceHidden) {
      const tick = this.clock.tick();
      const flicker = state.era === 2 && !this.reduced
        ? 1 + WORLD_ENV.mainsFlicker.amp * Math.sin(2 * Math.PI * nowMs / WORLD_ENV.mainsFlicker.periodMs)
        : 1;
      this.drawWalker(this.inspector, nowMs, tick, state, flicker);
      this.drawWalker(this.dog, nowMs, tick, state, flicker);
      this.drawWalker(this.crow, nowMs, tick, state, flicker);
      this.drawWalker(this.girl, nowMs, tick, state, flicker);
      this.drawSensor(nowMs, cam, state, flicker);
    }
    this.extras.update(dtMs, nowMs, (id) => this.poseOf(id));
    this.nudgeId = null;
    this.gust = false;
    this.recordTiming(performance.now() - t0);
  }

  /**
   * Sets the cast clock to the scene time before a beat or turn starts on a frame where update() has not run yet (the wake frame
   * after the World slept). Non-finite values are ignored.
   */
  syncNow(nowMs: number): void {
    if (Number.isFinite(nowMs)) this.nowMs = nowMs;
  }

  /** Snap-turn to camera: a tracking line for one frame (unless reduced), then the front pose (talk) or the glance pose (glance). */
  turnToCamera(id: LivingId, kind: 'talk' | 'glance'): void {
    const now = this.nowMs;
    // Sensor 7 never speaks: its turn is always a fixed glance hold, so no release is needed.
    const turn = kind === 'glance' || id === 'sensor7' ? this.glanceTurn(now) : this.talkTurn(now);
    if (id === 'sensor7') {
      this.sensor.turn = turn;
      this.sensor.blinkStart = now;
      return;
    }
    this.walkerOf(id).turn = turn;
  }

  /**
   * Mouth alternation of a turned speaker: while on, talk and front at talkFps for `blips` blips (the line's count, default
   * AUDIO.world.maxBlips) and then front; front while off.
   */
  setTalking(id: LivingId, on: boolean, blips?: number): void {
    if (id === 'sensor7') {
      this.sensor.talking = on;
      return;
    }
    const w = this.walkerOf(id);
    w.talking = on;
    const turn = w.turn;
    if (turn === null || turn.kind !== 'talk') return;
    const t = this.nowMs - turn.snapMs;
    if (on) {
      turn.blips = blipsOf(blips);
      turn.tl.bubbleShowAtMs = t;
      turn.tl.bubbleHideAtMs = Number.POSITIVE_INFINITY;
    } else {
      turn.tl.bubbleHideAtMs = t;
    }
  }

  /** Ends a talk turn: the pose holds holdMs more, then the member snaps back to its loop. */
  release(id: LivingId, holdMs: number): void {
    if (id === 'sensor7') {
      this.sensor.talking = false;
      return;
    }
    const w = this.walkerOf(id);
    w.talking = false;
    const turn = w.turn;
    if (turn === null || turn.kind !== 'talk') return;
    const now = this.nowMs;
    const hold = Number.isFinite(holdMs) ? Math.max(0, holdMs) : 0;
    turn.endMs = now + hold;
    turn.tl.doneAtMs = now + hold - turn.snapMs;
    if (turn.tl.bubbleHideAtMs === Number.POSITIVE_INFINITY) turn.tl.bubbleHideAtMs = now - turn.snapMs;
  }

  /** The wornMotor failed sync: each visible member in failedSyncOrder shows its glance or head pose, failMs, one after another. */
  failedSync(): void {
    const state = this.state;
    if (state === null || !state.visible) return;
    const now = this.nowMs;
    const visible = WORLD_PLAYBACK.failedSyncOrder.filter((id) => this.placed(id));
    for (const step of failedSyncSchedule(visible)) {
      const w = this.walkerFor(step.id);
      // The booth (payphone) answers in WorldProps; Sensor 7 never joins the sync.
      if (w === null) continue;
      w.beat = makeBeat(now + step.startMs, [POSE_FRAMES[w.id].glance], step.failMs, w.id === 'crow');
    }
  }

  /** Tape freeze (the crossed-line and wornMotor beats): the clock stops and every sprite shows the tracking line for one frame. */
  tapeFreeze(ms: number): void {
    this.clock.freeze(ms);
    if (!this.reduced) this.trackUntilMs = this.nowMs + WORLD_ENV.trackingFrameMs;
  }

  /** A short notice pose when the member is not already turning or noticing. sheetTick: inspector writes; earFlick: dog sniffs. */
  notice(kind: 'sheetTick' | 'sensorBlink' | 'earFlick'): void {
    const now = this.nowMs;
    if (kind === 'sensorBlink') {
      this.sensor.blinkStart = now;
      return;
    }
    if (kind === 'sheetTick') {
      this.beatIfIdle(this.inspector, now, makeBeat(now, ['write0', 'write1'], WORLD_ENV.notice.sheetTickMs, false));
      return;
    }
    this.beatIfIdle(this.dog, now, makeBeat(now, ['sniff0'], WORLD_ENV.notice.earFlickMs, false));
  }

  /**
   * Tier-up world ripple, never under reduced motion. Eras I-II: the crow or the dog nudges one frame. Era III: every walker gusts
   * one frame. Era IV: every walker rises on the next downbeat. Era V: the shadows slide toward the machine (only with shadows).
   */
  ripple(era: number): void {
    if (this.reduced) return;
    this.nudgeId = era === 1 ? 'crow' : era === 2 ? 'dog' : null;
    this.gust = era === 3;
    if (era === 4) this.risePending = true;
    // Era V: the shadows slide; without shadows (horizonField 5) the nearest walker flashes a double exposure instead.
    if (era === 5 && this.state !== null) {
      if (this.state.shadows) this.shadowShiftUntilMs = this.nowMs + WORLD_ERA_ENV.shadowSlideMs;
      else this.flashNearest();
    }
  }

  /** Head and feet of a speaker in game px, Sensor 7 included, or null while it is hidden. */
  anchor(id: LivingId, cam: CameraPose): SpeakerAnchor | null {
    if (id === 'sensor7') {
      const s = this.sensor;
      if (!s.visible) return null;
      return speakerAnchor(s.feetX, s.feetY, frameOf('sensor7').height * PIXEL_SCALE, cam);
    }
    const w = this.walkerOf(id);
    if (!w.visible) return null;
    // The crowStutter dx and the ripple nudge must not move the crow's head reserve or its own tail (AD2e F23): anchor on the placement x.
    const x = id === 'crow' && w.placement !== null ? w.placement.x : w.feetX;
    return speakerAnchor(x, w.anchorY, frameOf(id).height * PIXEL_SCALE, cam);
  }

  /** Debug probe: every cast member's frame, feet x (world px), visibility and speaking flag. */
  probe(): { id: string; variant: string; x: number; visible: boolean; speaking: boolean }[] {
    const walker = (id: WalkerId, w: Walker) => (
      { id, variant: this.variantOf(id, w.frame), x: w.feetX, visible: w.visible, speaking: w.talking }
    );
    const s = this.sensor;
    return [
      walker('inspector', this.inspector), walker('dog', this.dog), walker('crow', this.crow), walker('girl', this.girl),
      { id: 'sensor7', variant: this.variantOf('sensor7', s.frame), x: s.feetX, visible: s.visible, speaking: s.talking },
    ];
  }

  /** Hides every member and every extra until the next apply(). */
  hideAll(): void {
    this.forceHidden = true;
    this.applyWalker(this.inspector, null, null);
    this.applyWalker(this.dog, null, null);
    this.applyWalker(this.crow, null, null);
    this.applyGirl(null, null);
    this.applySensor(null, null);
    this.extras.hideAll();
  }

  /** Created objects (extras included), and the mean update time over the last 120 frames (ms). */
  stats(): { objects: number; meanMs: number } {
    let sum = 0;
    for (const ms of this.timings) sum += ms;
    return {
      objects: this.objects.length + this.extras.stats().objects,
      meanMs: this.timings.length === 0 ? 0 : sum / this.timings.length,
    };
  }

  /** Destroys every object and every texture this renderer created. Safe to call twice. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.forceHidden = true;
    this.state = null;
    this.placements = null;
    this.script = null;
    this.extras.destroy();
    for (const object of this.objects) {
      if (object.scene) object.destroy();
    }
    this.objects.length = 0;
    for (const key of this.ownedTextures) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
    this.ownedTextures.length = 0;
  }

  // ---- construction (pools only; nothing is created after the constructor) ----

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private makeWalker(id: WalkerId, row: WorldRow, feetY: number, depth: number, shadowWidth: number | null): Walker {
    const body = this.track(this.scene.add.sprite(0, 0, WORLD_SHEET_KEYS[id], 0));
    body.setOrigin(0.5, 1).setScale(PIXEL_SCALE).setDepth(depth).setVisible(false);
    // The crossfade body: pooled hidden, drawn over the body by the film only (added after it, so it sits above it in the row).
    const blend = this.track(this.scene.add.sprite(0, 0, WORLD_SHEET_KEYS[id], 0));
    blend.setOrigin(0.5, 1).setScale(PIXEL_SCALE).setDepth(depth).setVisible(false);
    this.rowOf(row).add(body);
    let shadow: Phaser.GameObjects.Image | null = null;
    if (shadowWidth !== null) {
      shadow = this.track(this.scene.add.image(0, 0, shadowKey(shadowWidth)));
      shadow.setDepth(WORLD_DEPTH_OFFSETS.shadow).setVisible(false);
      this.rowOf(row).add(shadow);
    }
    this.rowOf(row).add(blend);
    return {
      id, body, blend, shadow, feetY, anchorY: feetY, row, home: row, placement: null, visible: false, feetX: 0,
      frame: POSE_FRAMES[id].front, flip: false, dx: 0, accentUntil: Number.NEGATIVE_INFINITY, turn: null, beat: null, talking: false,
    };
  }

  private makeSensor(row: Phaser.GameObjects.Container, feetY: number): Sensor {
    const depth = WORLD_DEPTH_OFFSETS.sensor;
    // Creation order is the draw order within the row: dots, tripod, head, readout, fog, LED.
    const dots = this.track(this.scene.add.graphics());
    dots.fillStyle(PALETTE.ink, 1);
    for (const x of SENSOR_DOT_ART_X) dots.fillRect((x - 1) * PIXEL_SCALE, -PIXEL_SCALE, 2 * PIXEL_SCALE, PIXEL_SCALE);
    dots.setDepth(WORLD_DEPTH_OFFSETS.shadow).setVisible(false);
    row.add(dots);
    const part = (): Phaser.GameObjects.Sprite => {
      const sprite = this.track(this.scene.add.sprite(0, 0, WORLD_SHEET_KEYS.sensor7, 0));
      sprite.setOrigin(0.5, 1).setScale(PIXEL_SCALE).setDepth(depth).setVisible(false);
      row.add(sprite);
      return sprite;
    };
    const tripod = part();
    const head = part();
    const headBlend = part();
    const glyph = part();
    const fog = part();
    const ledColor = WORLD_ENV.sensor7.ledColors.red;
    const led = this.track(this.scene.add.rectangle(0, 0, PIXEL_SCALE, PIXEL_SCALE, ledColor));
    led.setOrigin(0, 0).setDepth(depth).setVisible(false);
    row.add(led);
    return {
      feetY, dots, tripod, head, headBlend, glyph, fog, led, ledColor, placement: null, visible: false, feetX: 0,
      frame: POSE_FRAMES.sensor7.front, turn: null, blinkStart: null, talking: false,
    };
  }

  // Ink ellipse, three rows: the top and bottom rows inset at each end, the middle row full width (DENIZEN_ART 1.4).
  private bakeShadow(width: number): void {
    const key = shadowKey(width);
    if (this.scene.textures.exists(key)) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(PALETTE.ink, 1);
    g.fillRect(SHADOW_INSET_PX, 0, width - 2 * SHADOW_INSET_PX, 1);
    g.fillRect(0, 1, width, 1);
    g.fillRect(SHADOW_INSET_PX, 2, width - 2 * SHADOW_INSET_PX, 1);
    g.generateTexture(key, width, SHADOW_ROWS);
    g.destroy();
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.ownedTextures.push(key);
  }

  // Canvas copy of a loaded sheet with the tracking rows of every cell shifted right (WORLD_PLAYBACK.trackingRows). The frames
  // match the sheet's, so a sprite swaps texture key and keeps its frame index. Null when the sheet has no drawable source.
  private bakeTrack(id: LivingId): string | null {
    const baseKey = WORLD_SHEET_KEYS[id];
    const key = baseKey + TRACK_SUFFIX;
    if (this.scene.textures.exists(key)) return key;
    if (!this.scene.textures.exists(baseKey)) return null;
    const source = this.scene.textures.get(baseKey).getSourceImage();
    if (!(source instanceof HTMLImageElement || source instanceof HTMLCanvasElement)) return null;
    const canvas = this.scene.textures.createCanvas(key, source.width, source.height);
    if (canvas === null) return null;
    this.ownedTextures.push(key);
    const ctx = canvas.getContext();
    const { width: fw, height: fh } = frameOf(id);
    const cols = Math.floor(source.width / fw);
    const rows = Math.floor(source.height / fh);
    const [firstRow, lastRow] = WORLD_PLAYBACK.trackingRows;
    const shift = WORLD_PLAYBACK.trackingShiftArtPx;
    ctx.drawImage(source, 0, 0);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * fw;
        const cy = r * fh;
        for (let y = firstRow; y <= lastRow && y < fh; y++) {
          ctx.clearRect(cx, cy + y, fw, 1);
          ctx.drawImage(source, cx, cy + y, fw - shift, 1, cx + shift, cy + y, fw - shift, 1);
        }
        canvas.add(r * cols + c, 0, cx, cy, fw, fh);
      }
    }
    canvas.setFilter(Phaser.Textures.FilterMode.NEAREST);
    canvas.refresh();
    return key;
  }

  // ---- apply ----

  // A shown member under the film keeps the visibility, alpha and w.visible that drawScriptWalker writes every update(); a hidden
  // member is hidden as the state says. Returns whether the member is shown.
  private applyWalker(w: Walker, placement: WorldPlacement | null, state: WorldVisualState | null): boolean {
    const shown = state !== null && state.visible && placement !== null;
    w.placement = shown ? placement : null;
    if (this.script !== null && shown) return true;
    w.visible = shown;
    if (!shown) {
      w.turn = null;
      w.beat = null;
    }
    w.body.setVisible(shown);
    w.blend.setVisible(false);
    if (w.shadow !== null) {
      w.shadow.setVisible(state !== null && shown && state.shadows);
      if (state !== null) w.shadow.setAlpha(WORLD_PLAYBACK.shadowAlpha * state.shadowScale);
    }
    return shown;
  }

  // The girl is drawn on the ground stage only (the window, mini and miniNear planes are WorldProps'); the film places her by her
  // placement whatever her stage. Her feet sit on her placement row.
  private applyGirl(placement: WorldPlacement | null, state: WorldVisualState | null): void {
    const onStage = this.script !== null || (state !== null && state.girl.stageName === 'ground');
    const ground = state !== null && onStage ? placement : null;
    const shown = this.applyWalker(this.girl, ground, state);
    if (!shown || ground === null) return;
    this.girl.feetY = WORLD_ROWS[ground.row].y + (ground.dy ?? 0);
    this.girl.home = ground.row;
    this.placeInRow(this.girl, ground.row);
  }

  // Moves a walker's body, blend and shadow to another row (the girl's row follows her placement; the film moves the inspector and
  // the dog to the front on the postgame pat). Depth order is restored after a move.
  private placeInRow(w: Walker, row: WorldRow): void {
    if (w.row === row) return;
    const target = this.rowOf(row);
    if (w.shadow !== null) target.add(w.shadow);
    target.add(w.body);
    target.add(w.blend);
    // Z7 (AD4 F5): a walker visiting a row that is not its home row (the postgame Inspector in the front row) draws behind the residents
    // but above every shadow (WORLD_DEPTH_OFFSETS.visitor).
    const base = w.id === 'crow' ? WORLD_DEPTH_OFFSETS.crow : WORLD_DEPTH_OFFSETS.cast;
    const depth = row === w.home ? base : base + WORLD_DEPTH_OFFSETS.visitor;
    w.body.setDepth(depth);
    w.blend.setDepth(depth);
    w.row = row;
    sortWorldRows(this.rows);
  }

  private applySensor(placement: WorldPlacement | null, state: WorldVisualState | null): void {
    const s = this.sensor;
    const shown = state !== null && state.visible && placement !== null;
    s.placement = shown ? placement : null;
    if (!shown) {
      s.turn = null;
      s.blinkStart = null;
    }
    // Under the film a shown Sensor 7 keeps the visibility and alpha that drawSensor writes every update(); the positions still follow.
    if (this.script === null || !shown) {
      s.visible = shown;
      s.head.setVisible(shown);
      s.headBlend.setVisible(false);
      s.tripod.setVisible(shown);
      s.glyph.setVisible(shown);
      s.dots.setVisible(shown);
      s.led.setVisible(shown);
      s.fog.setVisible(state !== null && shown && state.sensor.fog);
      if (state !== null) s.dots.setAlpha(WORLD_PLAYBACK.shadowAlpha * state.shadowScale);
    }
    if (shown && placement !== null) {
      s.feetX = placement.x;
      const { ledArt } = WORLD_ENV.sensor7;
      for (const part of [s.tripod, s.head, s.headBlend, s.glyph, s.fog]) part.setPosition(placement.x, s.feetY);
      s.dots.setPosition(placement.x, s.feetY);
      s.led.setPosition(placement.x + ledArt.x * PIXEL_SCALE, s.feetY + ledArt.y * PIXEL_SCALE);
    }
  }

  // ---- update ----

  private drawWalker(w: Walker, now: number, tick: number, state: WorldVisualState, flicker: number): void {
    const placement = w.placement;
    if (placement === null) return;
    const pose = this.script === null ? null : this.script.cast[w.id];
    if (pose !== null) {
      this.drawScriptWalker(w, pose, placement, state, now);
      return;
    }
    this.placeInRow(w, w.home);
    if (w.turn !== null && !turnActive(w.turn, now)) w.turn = null;
    if (w.beat !== null && now >= w.beat.endMs) w.beat = null;
    // Era IV downbeat: the accent frame (inspector, dog, girl) starts now in every motion setting; the crow's beat rise is gated in bobOf.
    if (this.downbeat && state.era === WORLD_ERA_ENV.downbeatEra) w.accentUntil = now + WORLD_ERA_ENV.accentMs;
    const beat = w.beat;
    const beatName = beat !== null ? beatFrame(beat, now) : null;
    const turnName = w.turn !== null ? turnPose(w.turn, now, POSE_FRAMES[w.id]) : null;
    let frame: string;
    let flip = false;
    let dx = w.dx;
    if (this.snapped) {
      frame = POSE_FRAMES[w.id].front;
      dx = 0;
    } else if (beat !== null && beatName !== null) {
      frame = beatName;
      flip = beat.flip;
    } else if (turnName !== null) {
      frame = turnName;
    } else {
      const idle = this.idleFrame(w, placement, state, tick, now);
      frame = idle.frame;
      dx = idle.dx;
      flip = idle.flip;
    }
    const nudge = this.gust || this.nudgeId === w.id ? RIPPLE_NUDGE_WORLD_PX : 0;
    w.dx = dx;
    w.frame = frame;
    w.flip = flip;
    w.feetX = placement.x + dx + nudge;
    w.anchorY = w.feetY;
    paint(w.body, this.keyOf(w.id, this.trackOn(w.turn, now)), sheetFrameIndex(w.id, frame, this.eraRow));
    w.body.setFlipX(flip).setPosition(w.feetX, w.feetY - this.bobOf(w, state, now)).setAlpha(state.alpha * flicker);
    if (w.shadow !== null) w.shadow.setPosition(w.feetX + this.shadowShiftOf(w, now), w.feetY);
  }

  // Film mode: the member's pose from the frame (row, frame, offset, mirror, alpha, shadow, crossfade) on its home feet line. The crow's
  // home is its perch; the pecks are never mirrored (they face the booth); the snap holds the front pose facing us.
  private drawScriptWalker(w: Walker, pose: CastScriptPose, placement: WorldPlacement, state: WorldVisualState, now: number): void {
    this.placeInRow(w, pose.worldRow ?? w.home);
    const shown = pose.visible;
    const pecking = w.id === 'crow' && pose.frame.startsWith('peck');
    const flip = !this.snapped && pose.flip && !pecking;
    const frame = this.snapped ? POSE_FRAMES[w.id].front : pose.frame;
    const x = placement.x + pose.dx;
    const home = w.id === 'crow' ? WORLD_ROWS.back.y - WORLD_ERA_ENV.crowPerchLiftArtPx * PIXEL_SCALE : w.feetY;
    const feetY = home + pose.dy;
    const key = this.keyOf(w.id, this.trackOn(w.turn, now));
    w.visible = shown;
    w.dx = pose.dx;
    w.frame = frame;
    w.flip = flip;
    w.feetX = x;
    w.anchorY = feetY;
    paint(w.body, key, sheetFrameIndex(w.id, frame, pose.row));
    w.body.setFlipX(flip).setPosition(x, feetY).setAlpha(pose.alpha).setVisible(shown);
    // The crossfade: blendRow over the body at pose.blend (its opacity times the pose alpha), hidden without one.
    if (pose.blendRow !== null) {
      paint(w.blend, key, sheetFrameIndex(w.id, frame, pose.blendRow));
      w.blend.setFlipX(flip).setPosition(x, feetY).setAlpha(pose.alpha * pose.blend).setVisible(shown && pose.blend > 0);
    } else {
      w.blend.setVisible(false);
    }
    if (w.shadow !== null) w.shadow.setPosition(x, feetY).setAlpha(filmShadowAlpha(state) * pose.alpha).setVisible(shown && pose.shadow);
  }

  private drawSensor(now: number, cam: CameraPose, state: WorldVisualState, flicker: number): void {
    const s = this.sensor;
    const placement = s.placement;
    if (placement === null) return;
    if (s.turn !== null && !turnActive(s.turn, now)) s.turn = null;
    const script = this.script;
    const pose = script === null ? null : script.cast.sensor7;
    const row = pose === null ? this.eraRow : pose.row;
    const shown = pose === null || pose.visible;
    s.visible = shown;
    if (pose !== null) {
      // The film's offset (zero in the film): the parts, the foot dots and the LED follow the same feet point.
      const { ledArt } = WORLD_ENV.sensor7;
      const x = placement.x + pose.dx;
      const y = s.feetY + pose.dy;
      for (const part of [s.tripod, s.head, s.headBlend, s.glyph, s.fog]) part.setPosition(x, y);
      s.dots.setPosition(x, y);
      s.led.setPosition(x + ledArt.x * PIXEL_SCALE, y + ledArt.y * PIXEL_SCALE);
    }
    const turnName = s.turn !== null ? turnPose(s.turn, now, POSE_FRAMES.sensor7) : null;
    let head: string;
    if (this.snapped) head = POSE_FRAMES.sensor7.front;
    else if (pose !== null) head = pose.frame;
    else if (turnName !== null) head = turnName;
    else if (blinkRunning(s.blinkStart, now)) head = POSE_FRAMES.sensor7.front;
    else head = sensorHead(placement.x, cam.centerX);
    s.frame = head;
    const key = this.keyOf('sensor7', this.trackOn(s.turn, now));
    const alpha = pose === null ? state.alpha * flicker : pose.alpha;
    paint(s.head, key, sheetFrameIndex('sensor7', head, row));
    paint(s.tripod, key, sheetFrameIndex('sensor7', 'tripod', row));
    // The readout: the film's glyph, or the state's readout at 'stage'.
    const glyph = script === null ? 'stage' : script.props.sensorGlyph;
    const readout = glyph === 'stage' ? state.sensor.readout : glyph;
    paint(s.glyph, key, sheetFrameIndex('sensor7', readout === 'one' ? 'glyphOne' : 'glyphDash', row));
    s.head.setAlpha(alpha).setVisible(shown);
    s.tripod.setAlpha(alpha).setVisible(shown);
    s.glyph.setAlpha(alpha).setVisible(shown);
    // The head's crossfade (the film only): blendRow over the head at pose.blend.
    if (pose !== null && pose.blendRow !== null) {
      paint(s.headBlend, key, sheetFrameIndex('sensor7', head, pose.blendRow));
      s.headBlend.setAlpha(alpha * pose.blend).setVisible(shown && pose.blend > 0);
    } else {
      s.headBlend.setVisible(false);
    }
    // The lens fog (era III with vents), over the head; shown only while state.sensor.fog and no film runs.
    paint(s.fog, key, sheetFrameIndex('sensor7', 'fog', row));
    s.fog.setAlpha(alpha).setVisible(pose === null && state.sensor.fog);
    // The foot dots are the shadow: the film's shadow flag, else the state's (applied in apply()).
    if (pose !== null) {
      s.dots.setVisible(shown && pose.shadow).setAlpha(filmShadowAlpha(state) * pose.alpha);
    }
    s.led.setVisible(shown);
    // The LED: the film's colour (dead dim, green) or the state colour at 'stage'.
    const sensorLed = script === null ? 'stage' : script.props.sensorLed;
    const colour = sensorLed === 'dead' ? LED_DIM
      : sensorLed === 'green' ? WORLD_ENV.sensor7.ledColors.green : this.ledStateColour(s, state, now);
    if (colour !== s.ledColor) {
      s.led.setFillStyle(colour);
      s.ledColor = colour;
    }
  }

  // The state LED colour: dim while the blink is dark, the heartbeat is low or (era IV) on the downbeat, else the state colour.
  private ledStateColour(s: Sensor, state: WorldVisualState, now: number): number {
    const low = this.heartbeatLow(now);
    const dark = blinkDark(s.blinkStart, now) || low || (state.sensor.pulse && this.beatNow);
    if (dark) return LED_DIM;
    return state.sensor.led === 'red' ? WORLD_ENV.sensor7.ledColors.red : WORLD_ENV.sensor7.ledColors.amber;
  }

  // Downbeat edge of the beat, once per frame: the era IV rise starts on it, and the Sensor 7 pulse reads the beat level.
  private stepBeat(now: number): void {
    const low = this.beatLow(now);
    this.downbeat = isDownbeat(this.beatWasLow, low);
    this.beatWasLow = low;
    this.beatNow = low;
    if (this.downbeat && this.risePending) {
      this.riseUntilMs = now + WORLD_ERA_ENV.accentMs;
      this.risePending = false;
    }
  }

  // Loop of a walker for this state (eras I-V). The girl stands on her one loop (stand1 accents are the downbeat frame).
  private loopPickOf(w: Walker, placement: WorldPlacement, state: WorldVisualState): LoopPick {
    if (w.id === 'inspector') return inspectorLoopOf(placement, state);
    if (w.id === 'dog') return dogLoopOf(state);
    if (w.id === 'crow') return crowLoopOf(state, this.reduced);
    return { loop: WORLD_ERA_LOOPS.girlStill, reverse: false };
  }

  // Idle frame of a walker: its loop, then the era IV downbeat accent and the stare. The accent and the stare replace rest steps only;
  // walk steps keep their profile frame and x (a walker in motion never slides in the accent pose or glides in the front pose).
  private idleFrame(w: Walker, placement: WorldPlacement, state: WorldVisualState, tick: number, now: number): IdleFrame {
    const pick = this.loopPickOf(w, placement, state);
    const step = loopFrameAt(pick.loop, tick, state.seam, pick.reverse);
    const names = POSE_FRAMES[w.id];
    const walking = step.frame.startsWith('walk');
    const accent = names.accent;
    const frame = accent !== undefined && now < w.accentUntil && !walking ? accent : step.frame;
    if (state.stare && !walking) return { frame: names.front, dx: step.dx, flip: false };
    return { frame, dx: step.dx, flip: step.flip === true };
  }

  // Lift of the body above its feet, world px: the era IV rise (every walker, the ripple) and, for the perched crow in era IV,
  // its static hover and its beat rise. Shadows stay on the ground.
  private bobOf(w: Walker, state: WorldVisualState, now: number): number {
    let bob = now < this.riseUntilMs ? WORLD_ERA_ENV.riseWorldPx : 0;
    if (w.id === 'crow' && state.era === WORLD_ERA_ENV.downbeatEra && !state.traces.crowHigh) {
      bob += WORLD_ERA_ENV.crowHoverPx * PIXEL_SCALE;
      if (!this.reduced && now < w.accentUntil) bob += WORLD_ERA_ENV.crowBeatRisePx * PIXEL_SCALE;
    }
    return bob;
  }

  // Shadow slide of the era V ripple: toward the machine centre for shadowSlideMs, world px (0 otherwise).
  private shadowShiftOf(w: Walker, now: number): number {
    return now < this.shadowShiftUntilMs ? Math.sign(MACHINE_ANCHOR.x - w.feetX) * WORLD_ERA_ENV.shadowSlideWorldPx : 0;
  }

  // The visible walker nearest the machine takes the era V double exposure (the ripple without shadows).
  private flashNearest(): void {
    let nearest: Walker | null = null;
    for (const w of [this.inspector, this.dog, this.crow, this.girl]) {
      if (w.visible && (nearest === null || Math.abs(w.feetX - MACHINE_ANCHOR.x) < Math.abs(nearest.feetX - MACHINE_ANCHOR.x))) nearest = w;
    }
    if (nearest !== null) this.flashDouble(nearest.id);
  }

  // Probe variant: the film's frame name while a film runs, else the frame drawn.
  private variantOf(id: LivingId, frame: string): string {
    return this.script === null ? frame : this.script.cast[id].frame;
  }

  private rowOf(row: WorldRow): Phaser.GameObjects.Container {
    return row === 'back' ? this.rows.back : this.rows.front;
  }

  // Tracking line on now: the tapeFreeze window, or the first trackMs of a turn (never under reduced motion).
  private trackOn(turn: Turn | null, now: number): boolean {
    if (this.reduced) return false;
    return now < this.trackUntilMs || (turn !== null && now - turn.snapMs < turn.trackMs);
  }

  private keyOf(id: LivingId, track: boolean): string {
    const trk = this.tracks[id];
    return track && trk !== null ? trk : WORLD_SHEET_KEYS[id];
  }

  private recordTiming(ms: number): void {
    if (this.timings.length < TIMING_WINDOW) {
      this.timings.push(ms);
      return;
    }
    this.timings[this.timingNext] = ms;
    this.timingNext = (this.timingNext + 1) % TIMING_WINDOW;
  }

  // ---- events ----

  private talkTurn(now: number): Turn {
    const base = talkTimeline(0, this.reduced);
    return {
      kind: 'talk',
      snapMs: now,
      trackMs: base.trackingUntilMs,
      endMs: Number.POSITIVE_INFINITY,
      blips: AUDIO.world.maxBlips,
      tl: {
        ...base,
        bubbleShowAtMs: Number.POSITIVE_INFINITY,
        bubbleHideAtMs: Number.POSITIVE_INFINITY,
        releaseAtMs: Number.POSITIVE_INFINITY,
        doneAtMs: Number.POSITIVE_INFINITY,
      },
    };
  }

  private glanceTurn(now: number): Turn {
    const gl = glanceTimeline(this.reduced);
    return { kind: 'glance', snapMs: now, trackMs: gl.trackingUntilMs, endMs: now + gl.doneAtMs, gl };
  }

  private beatIfIdle(w: Walker, now: number, beat: Beat): void {
    const busy = (w.turn !== null && turnActive(w.turn, now)) || (w.beat !== null && now < w.beat.endMs);
    if (!busy) w.beat = beat;
  }

  // A denizen is placed (its placement is not null) on the current cast.
  private placed(id: GroundId): boolean {
    const placements = this.placements;
    return placements !== null && placements[id] !== null;
  }

  private walkerFor(id: DenizenId): Walker | null {
    if (id === 'inspector') return this.inspector;
    if (id === 'dog') return this.dog;
    if (id === 'crow') return this.crow;
    return null;
  }

  private walkerOf(id: WalkerId): Walker {
    if (id === 'inspector') return this.inspector;
    if (id === 'dog') return this.dog;
    if (id === 'girl') return this.girl;
    return this.crow;
  }
}
