// Living world cast renderer (WP23a): the Inspector, the Dog and the Crow as pooled sprites on the back and front ground rows, Sensor 7
// (tripod, head, readout, lens fog and the LED), their flat shadows, and the tape playback of their loops with the turn, glance,
// failed-sync, notice and ripple effects. Why: the cast draws what the tested maths decide (worldPlayback, worldTurn, worldState,
// worldPlacement); every sprite, shadow and tracking texture is created once here and shown or hidden afterwards (WP23 D5).
// Numbers come from src/data/livingWorld.ts. Reduced motion follows STORY_BIBLE 7.7: no tracking line, no mains flicker, no ripple;
// the crank stepping, the ambient loops and the notices stay. Rendering only: no economy state is read or written.
import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../../assets/manifest';
import type { AssetId } from '../../assets/assetIds';
import { AUDIO } from '../../data/audio';
import { PALETTE } from '../../data/palette';
import { PIXEL_SCALE } from '../../data/world';
import { WORLD_DEPTH_OFFSETS, WORLD_ENV, WORLD_LOOPS, WORLD_PLAYBACK, WORLD_ROWS, WORLD_SHADOW_WIDTHS, WORLD_SHEET_KEYS } from '../../data/livingWorld';
import type { DenizenId, GroundId, LoopFrame, WorldPlacement } from '../../data/livingWorld';
import type { CameraPose } from '../math/finale';
import { createTapeClock, loopFrameAt, sensorHead, sheetFrameIndex } from '../math/worldPlayback';
import type { PlaybackMode, TapeClock } from '../math/worldPlayback';
import { failedSyncSchedule, glancePose, glanceTimeline, talkPose, talkTimeline } from '../math/worldTurn';
import type { GlanceTimeline, TalkTimeline } from '../math/worldTurn';
import { screenOfWorld } from '../math/worldPlacement';
import type { SpeakerAnchor } from '../math/worldPlacement';
import type { WorldVisualState } from '../math/worldState';
import type { WorldRows } from './worldRows';

/** Cast members this renderer draws. */
export type LivingId = 'inspector' | 'dog' | 'crow' | 'sensor7';
/** The walking members (Sensor 7 is static on its post). */
type WalkerId = 'inspector' | 'dog' | 'crow';
/** Frame names of one member's poses: front (to camera at rest), talk (mouth open), glance (head turn). */
interface PoseNames { front: string; talk: string; glance: string }

// Frame names per member (DENIZEN_ART 2.1-2.3, 2.6 and 4.3).
const POSE_FRAMES: Record<LivingId, PoseNames> = {
  inspector: { front: 'front', talk: 'talk', glance: 'glance' },
  dog: { front: 'head', talk: 'talk', glance: 'head' },
  crow: { front: 'head', talk: 'talk', glance: 'head' },
  sensor7: { front: 'headC', talk: 'headC', glance: 'headC' },
};
// The lying dog (demo hold image, DENIZEN_ART 2.2): one static frame.
const LIE_LOOP: readonly LoopFrame[] = [{ frame: 'lie', dx: 0 }];
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
// Tier-up ripple: world px nudge on the one frame it plays.
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

interface Walker {
  readonly id: WalkerId;
  readonly body: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image | null;
  readonly feetY: number;
  placement: WorldPlacement | null;   // null while hidden
  visible: boolean;
  feetX: number;                      // world px: placement x + loop dx (+ ripple nudge)
  frame: string;                      // frame name shown
  flip: boolean;
  dx: number;                         // last applied loop dx; held while a pose runs
  turn: Turn | null;
  beat: Beat | null;
  talking: boolean;
}

interface Sensor {
  readonly feetY: number;
  readonly dots: Phaser.GameObjects.Graphics;
  readonly tripod: Phaser.GameObjects.Sprite;
  readonly head: Phaser.GameObjects.Sprite;
  readonly glyph: Phaser.GameObjects.Sprite;
  readonly fog: Phaser.GameObjects.Sprite;     // hidden for good (lens fog is not drawn in WP23a)
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

/**
 * The living world cast. Built once per scene: every sprite, shadow and texture exists from the constructor on and is shown or
 * hidden afterwards. apply() takes the visual state and the placements; update() steps the tape and draws the poses.
 */
export class LivingWorld {
  private readonly scene: Phaser.Scene;
  private readonly heartbeatLow: (nowMs: number) => boolean;
  private readonly clock: TapeClock = createTapeClock();
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly ownedTextures: string[] = [];
  private readonly tracks: Record<LivingId, string | null>;
  private readonly timings: number[] = [];
  private timingNext = 0;
  private readonly inspector: Walker;
  private readonly dog: Walker;
  private readonly crow: Walker;
  private readonly sensor: Sensor;
  private state: WorldVisualState | null = null;
  private placements: Readonly<Record<GroundId, WorldPlacement | null>> | null = null;
  private mode: PlaybackMode = 'crank';
  private eraRow = 0;
  private reduced = false;
  private forceHidden = false;
  private destroyed = false;
  private nowMs = 0;
  private trackUntilMs = Number.NEGATIVE_INFINITY;
  private nudgeId: WalkerId | null = null;

  constructor(scene: Phaser.Scene, rows: WorldRows, heartbeatLow: (nowMs: number) => boolean) {
    this.scene = scene;
    this.heartbeatLow = heartbeatLow;
    for (const width of WORLD_SHADOW_WIDTHS) this.bakeShadow(width);
    this.tracks = {
      inspector: this.bakeTrack('inspector'),
      dog: this.bakeTrack('dog'),
      crow: this.bakeTrack('crow'),
      sensor7: this.bakeTrack('sensor7'),
    };
    this.inspector = this.makeWalker('inspector', rows.back, WORLD_ROWS.back.y, WORLD_DEPTH_OFFSETS.cast, WORLD_SHADOW_WIDTHS[0]);
    this.dog = this.makeWalker('dog', rows.front, WORLD_ROWS.front.y, WORLD_DEPTH_OFFSETS.cast, WORLD_SHADOW_WIDTHS[1]);
    this.crow = this.makeWalker('crow', rows.back, WORLD_ROWS.back.y - WORLD_ENV.crowLiftArtPx * PIXEL_SCALE, WORLD_DEPTH_OFFSETS.crow, null);
    this.sensor = this.makeSensor(rows.back, WORLD_ROWS.back.y);
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
    this.applyWalker(this.inspector, placements.inspector, state);
    this.applyWalker(this.dog, placements.dog, state);
    this.applyWalker(this.crow, placements.crow, state);
    this.applySensor(placements.sensor7, state);
  }

  /** One frame: steps the tape by dtMs and crankSteps, then draws every member at nowMs from the camera pose cam. */
  update(dtMs: number, crankSteps: number, nowMs: number, cam: CameraPose): void {
    if (this.destroyed) return;
    const t0 = performance.now();
    this.nowMs = nowMs;
    this.clock.advance(dtMs, this.mode, crankSteps);
    const state = this.state;
    if (state !== null && !this.forceHidden) {
      const tick = this.clock.tick();
      const flicker = state.era === 2 && !this.reduced
        ? 1 + WORLD_ENV.mainsFlicker.amp * Math.sin(2 * Math.PI * nowMs / WORLD_ENV.mainsFlicker.periodMs)
        : 1;
      this.drawWalker(this.inspector, nowMs, tick, state, flicker);
      this.drawWalker(this.dog, nowMs, tick, state, flicker);
      this.drawWalker(this.crow, nowMs, tick, state, flicker);
      this.drawSensor(nowMs, cam, state, flicker);
    }
    this.nudgeId = null;
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

  /** Tier-up world ripple, one frame and never under reduced motion: era I moves the crow, era II the dog. */
  ripple(era: number): void {
    if (this.reduced) return;
    if (era === 1) this.nudgeId = 'crow';
    else if (era === 2) this.nudgeId = 'dog';
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
    return speakerAnchor(x, w.feetY, frameOf(id).height * PIXEL_SCALE, cam);
  }

  /** Debug probe: every cast member's frame, feet x (world px), visibility and speaking flag. */
  probe(): { id: string; variant: string; x: number; visible: boolean; speaking: boolean }[] {
    return [
      { id: 'inspector', variant: this.inspector.frame, x: this.inspector.feetX, visible: this.inspector.visible, speaking: this.inspector.talking },
      { id: 'dog', variant: this.dog.frame, x: this.dog.feetX, visible: this.dog.visible, speaking: this.dog.talking },
      { id: 'crow', variant: this.crow.frame, x: this.crow.feetX, visible: this.crow.visible, speaking: this.crow.talking },
      { id: 'sensor7', variant: this.sensor.frame, x: this.sensor.feetX, visible: this.sensor.visible, speaking: this.sensor.talking },
    ];
  }

  /** Hides every member until the next apply(). */
  hideAll(): void {
    this.forceHidden = true;
    this.applyWalker(this.inspector, null, null);
    this.applyWalker(this.dog, null, null);
    this.applyWalker(this.crow, null, null);
    this.applySensor(null, null);
  }

  /** Created objects, and the mean update time over the last 120 frames (ms). */
  stats(): { objects: number; meanMs: number } {
    let sum = 0;
    for (const ms of this.timings) sum += ms;
    return { objects: this.objects.length, meanMs: this.timings.length === 0 ? 0 : sum / this.timings.length };
  }

  /** Destroys every object and every texture this renderer created. Safe to call twice. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.forceHidden = true;
    this.state = null;
    this.placements = null;
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

  private makeWalker(id: WalkerId, row: Phaser.GameObjects.Container, feetY: number, depth: number, shadowWidth: number | null): Walker {
    const body = this.track(this.scene.add.sprite(0, 0, WORLD_SHEET_KEYS[id], 0));
    body.setOrigin(0.5, 1).setScale(PIXEL_SCALE).setDepth(depth).setVisible(false);
    row.add(body);
    let shadow: Phaser.GameObjects.Image | null = null;
    if (shadowWidth !== null) {
      shadow = this.track(this.scene.add.image(0, 0, shadowKey(shadowWidth)));
      shadow.setDepth(WORLD_DEPTH_OFFSETS.shadow).setVisible(false);
      row.add(shadow);
    }
    return {
      id, body, shadow, feetY, placement: null, visible: false, feetX: 0, frame: POSE_FRAMES[id].front, flip: false, dx: 0,
      turn: null, beat: null, talking: false,
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
    const glyph = part();
    const fog = part();
    const ledColor = WORLD_ENV.sensor7.ledColors.red;
    const led = this.track(this.scene.add.rectangle(0, 0, PIXEL_SCALE, PIXEL_SCALE, ledColor));
    led.setOrigin(0, 0).setDepth(depth).setVisible(false);
    row.add(led);
    return {
      feetY, dots, tripod, head, glyph, fog, led, ledColor, placement: null, visible: false, feetX: 0,
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

  private applyWalker(w: Walker, placement: WorldPlacement | null, state: WorldVisualState | null): void {
    const shown = state !== null && state.visible && placement !== null;
    w.placement = shown ? placement : null;
    w.visible = shown;
    if (!shown) {
      w.turn = null;
      w.beat = null;
    }
    w.body.setVisible(shown);
    if (w.shadow !== null) {
      w.shadow.setVisible(shown);
      if (state !== null) w.shadow.setAlpha(WORLD_PLAYBACK.shadowAlpha * state.shadowScale);
    }
  }

  private applySensor(placement: WorldPlacement | null, state: WorldVisualState | null): void {
    const s = this.sensor;
    const shown = state !== null && state.visible && placement !== null;
    s.placement = shown ? placement : null;
    s.visible = shown;
    if (!shown) {
      s.turn = null;
      s.blinkStart = null;
    }
    s.head.setVisible(shown);
    s.tripod.setVisible(shown);
    s.glyph.setVisible(shown);
    s.dots.setVisible(shown);
    s.led.setVisible(shown);
    if (state !== null) s.dots.setAlpha(WORLD_PLAYBACK.shadowAlpha * state.shadowScale);
    if (shown && placement !== null) {
      s.feetX = placement.x;
      const { ledArt } = WORLD_ENV.sensor7;
      for (const part of [s.tripod, s.head, s.glyph, s.fog]) part.setPosition(placement.x, s.feetY);
      s.dots.setPosition(placement.x, s.feetY);
      s.led.setPosition(placement.x + ledArt.x * PIXEL_SCALE, s.feetY + ledArt.y * PIXEL_SCALE);
    }
  }

  // ---- update ----

  private drawWalker(w: Walker, now: number, tick: number, state: WorldVisualState, flicker: number): void {
    const placement = w.placement;
    if (placement === null) return;
    if (w.turn !== null && !turnActive(w.turn, now)) w.turn = null;
    if (w.beat !== null && now >= w.beat.endMs) w.beat = null;
    const beat = w.beat;
    const beatName = beat !== null ? beatFrame(beat, now) : null;
    const turnName = w.turn !== null ? turnPose(w.turn, now, POSE_FRAMES[w.id]) : null;
    let frame: string;
    let flip = false;
    let dx = w.dx;
    if (beat !== null && beatName !== null) {
      frame = beatName;
      flip = beat.flip;
    } else if (turnName !== null) {
      frame = turnName;
    } else {
      const loop = loopFrameAt(this.loopOf(w.id, placement, state), tick, state.seam);
      frame = loop.frame;
      dx = loop.dx;
      flip = loop.flip === true;
    }
    const nudge = this.nudgeId === w.id ? RIPPLE_NUDGE_WORLD_PX : 0;
    w.dx = dx;
    w.frame = frame;
    w.flip = flip;
    w.feetX = placement.x + dx + nudge;
    paint(w.body, this.keyOf(w.id, this.trackOn(w.turn, now)), sheetFrameIndex(w.id, frame, this.eraRow));
    w.body.setFlipX(flip).setPosition(w.feetX, w.feetY).setAlpha(state.alpha * flicker);
    if (w.shadow !== null) w.shadow.setPosition(w.feetX, w.feetY);
  }

  private drawSensor(now: number, cam: CameraPose, state: WorldVisualState, flicker: number): void {
    const s = this.sensor;
    const placement = s.placement;
    if (placement === null) return;
    if (s.turn !== null && !turnActive(s.turn, now)) s.turn = null;
    const turnName = s.turn !== null ? turnPose(s.turn, now, POSE_FRAMES.sensor7) : null;
    let head: string;
    if (turnName !== null) head = turnName;
    else if (blinkRunning(s.blinkStart, now)) head = POSE_FRAMES.sensor7.front;
    else head = sensorHead(placement.x, cam.centerX);
    s.frame = head;
    const track = this.trackOn(s.turn, now);
    const key = this.keyOf('sensor7', track);
    const eraRow = this.eraRow;
    paint(s.head, key, sheetFrameIndex('sensor7', head, eraRow));
    paint(s.tripod, key, sheetFrameIndex('sensor7', 'tripod', eraRow));
    paint(s.glyph, key, sheetFrameIndex('sensor7', state.sensor.readout === 'one' ? 'glyphOne' : 'glyphDash', eraRow));
    const alpha = state.alpha * flicker;
    s.head.setAlpha(alpha);
    s.tripod.setAlpha(alpha);
    s.glyph.setAlpha(alpha);
    // The LED: its state colour, dim while the blink is dark or the heartbeat is low.
    const low = this.heartbeatLow(now);
    const dark = blinkDark(s.blinkStart, now) || low;
    const lit = state.sensor.led === 'red' ? WORLD_ENV.sensor7.ledColors.red : WORLD_ENV.sensor7.ledColors.amber;
    const colour: number = dark ? LED_DIM : lit;
    if (colour !== s.ledColor) {
      s.led.setFillStyle(colour);
      s.ledColor = colour;
    }
  }

  // Loop of a walker for this state: inspector walks its route when it has one, dog digs or lies, crow stutters in era II.
  private loopOf(id: WalkerId, placement: WorldPlacement, state: WorldVisualState): readonly LoopFrame[] {
    if (id === 'inspector') return placement.route !== undefined ? WORLD_LOOPS.inspector : WORLD_LOOPS.inspectorStatic;
    if (id === 'dog') {
      if (state.dogPose === 'lie') return LIE_LOOP;
      return state.dogPose === 'dig' ? WORLD_LOOPS.dogDig : WORLD_LOOPS.dog;
    }
    return state.era === 2 && !this.reduced ? WORLD_LOOPS.crowStutter : WORLD_LOOPS.crow;
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
    return this.crow;
  }
}
