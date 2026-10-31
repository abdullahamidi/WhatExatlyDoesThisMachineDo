// Living world cast renderer (WP23a, WP23b, WP24): the Inspector, the Dog, the Crow and the Girl (ground stage) as pooled sprites on the back
// and front ground rows, Sensor 7 (tripod, head, readout, lens fog and the LED) and their flat shadows. Each walker draws its behaviour
// runner frame (WP24 C2), stared through stareFrame, with the umbrella pose set under the open umbrella (R9); the turn, glance,
// failed-sync, notice and ripple effects sit on top, and busy() tells the director when a runner must hold. The finale film (setScript)
// draws every member from its frame; snapAll holds the front poses; CastExtras draws the clipboard, red ball and double exposures.
// Why: the cast draws what the tested maths decide (worldBehaviour, worldTransitions, worldState, worldPlacement); every sprite, shadow
// and tracking texture is created once here and shown or hidden afterwards (WP23 D5). Numbers come from src/data. Reduced motion follows
// STORY_BIBLE 7.7: no tracking line, no mains flicker, no ripple, no crow beat rise; the snap poses, the notices and the runners stay.
// Rendering only: no economy state is read or written. WP28a r1-FixA: the crow lands and perches again after its hop (a perch offset), and
// the girl's lantern ring (lanternRing) and Sensor 7's answer light (sensorLed) draw here.
import Phaser from 'phaser';
import { ASSET_MANIFEST } from '../../assets/manifest';
import type { AssetId } from '../../assets/assetIds';
import { AUDIO } from '../../data/audio';
import { PALETTE } from '../../data/palette';
import { GROUND_Y, MACHINE_ANCHOR, PIXEL_SCALE, VIEW } from '../../data/world';
import { WORLD_DEPTH_OFFSETS, WORLD_ENV, WORLD_FRAMES, WORLD_PLAYBACK, WORLD_ROWS, WORLD_SHADOW_WIDTHS, WORLD_SHEET_KEYS } from '../../data/livingWorld';
import type { DenizenId, GroundId, WorldPlacement, WorldRow } from '../../data/livingWorld';
import { WORLD_ERA_ENV, WORLD_ERA_LOOPS } from '../../data/worldEras';
import { WORLD_AMBIENT } from '../../data/worldDay';
import { YARD_DEPTH_STEP } from '../../data/worldShared';
import { WORLD_STARE_SAFE } from '../../data/worldBehaviour';
import type { BehaviourActor } from '../../data/worldBehaviour';
import { CROW_HOP, POKE_RENDER, POKES } from '../../data/pokes';
import type { CameraPose } from '../math/finale';
import type { Ambient } from '../math/worldDay';
import { restFlip, stareFrame } from '../math/worldBehaviour';
import type { BehaviourFrame } from '../math/worldBehaviour';
import { isDownbeat, sensorHead, sheetFrameIndex, shadowScale } from '../math/worldPlayback';
import type { SensorHead } from '../math/worldPlayback';
import { clipIndexAt, crowArcY, crowFlightFrame, crowHopSpec, crowLandFrame, sensorHeadFromPointer } from '../math/pokeRender';
import type { HopSpan } from '../math/pokeRender';
import { failedSyncSchedule, glancePose, glanceTimeline, talkPose, talkTimeline } from '../math/worldTurn';
import type { GlanceTimeline, TalkTimeline } from '../math/worldTurn';
import { stareActive } from '../math/worldTransitions';
import type { Blend, WorldTween } from '../math/worldTransitions';
import type { SpeakerAnchor } from '../math/worldPlacement';
import type { CastScriptPose, WorldScriptFrame } from '../math/worldScript';
import type { WorldVisualState } from '../math/worldState';
import { CastExtras } from './CastExtras';
import type { ExtraPose } from './CastExtras';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

/** Cast members this renderer draws. */
export type LivingId = 'inspector' | 'dog' | 'crow' | 'girl' | 'sensor7';
/** The walking members (Sensor 7 is static on its post; the girl walks on the ground stage only). */
type WalkerId = 'inspector' | 'dog' | 'crow' | 'girl';
/** Frame names of one member's poses: front (to camera at rest), talk (mouth open), glance (head turn). */
interface PoseNames { front: string; talk: string; glance: string }

// A walker's camera-facing front: the first frame of its stare set (WORLD_STARE_SAFE), so the front and the stare cannot diverge.
function frontOf(actor: WalkerId): string {
  return WORLD_STARE_SAFE[actor][0] ?? '';
}

// WP28b: the feet lane of a walker's home row (lane 0 is the back row, the dog's front row is its home lane).
function homeLaneOf(home: WorldRow): number {
  return WORLD_ROWS[home].y - GROUND_Y;
}

// Frame names per member (DENIZEN_ART 2.1-2.4, 2.6 and 4.3).
const POSE_FRAMES: Record<LivingId, PoseNames> = {
  inspector: { front: frontOf('inspector'), talk: 'talk', glance: 'glance' },
  dog: { front: frontOf('dog'), talk: 'talk', glance: 'head' },
  crow: { front: frontOf('crow'), talk: 'talk', glance: 'head' },
  girl: { front: frontOf('girl'), talk: 'talk', glance: 'stand0' },
  sensor7: { front: 'headC', talk: 'headC', glance: 'headC' },
};
// The Inspector under the open umbrella (R9): its front and talk poses carry the umbrella.
const UMBRELLA_POSE_NAMES: PoseNames = { front: 'frontUmbrella', talk: 'talkUmbrella', glance: 'glance' };
// The crow's speech-bubble poses while it is perched with folded wings (WP27 D5, crowPerchPoseToEra): the bubble never shows spread wings.
const CROW_PERCH_POSE_NAMES: PoseNames = { front: 'perchHead', talk: 'perchTalk', glance: 'perchHead' };
// The lying dog (demo hold image, DENIZEN_ART 2.2): one static frame, drawn without a runner.
const LIE_FRAME = 'lie';
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
// The last `size` update durations (ms) and their mean (stats().meanMs). WP28b FX6: the cast, the props and the Director keep their timings
// in this one ring; the mean sums the slots in order, as the array mean did, so the readings are the same.
export class TimingRing {
  private readonly values: Float64Array;
  private readonly size: number;
  private count = 0;
  private next = 0;

  constructor(size: number) {
    this.size = size;
    this.values = new Float64Array(size);
  }

  record(ms: number): void {
    this.values[this.next] = ms;
    this.next = (this.next + 1) % this.size;
    if (this.count < this.size) this.count += 1;
  }

  mean(): number {
    if (this.count === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.values[i] ?? 0;
    return sum / this.count;
  }
}
// Unlit LED colour (palette).
const LED_DIM = PALETTE.rustDark;
// Sensor 7 LED frame names by crossfade level (0 red, 1 amber); the sensorRows frame of a lit LED.
const LED_FRAMES: readonly string[] = ['red', 'amber'];
// The cycle 2+ high pose (WORLD_ERA_LOOPS.crowHigh): the crow draws it on its tipTry while state.traces.crowHigh (WP27 F5.4). tipTry exists
// only in the era I-II tables, so the high pose shows only there and never in crank playback.
// The frame name is read once here (the '' fallback as frontOf does; the data always carries the frame).
const CROW_HIGH_FRAME = WORLD_ERA_LOOPS.crowHigh[0]?.frame ?? '';
// The crow's glitch activity id (CROW_GLITCH in src/data/worldBehaviour.ts): the runner's activity that draws the high pose.
const CROW_TIP_ACTIVITY = 'tipTry';
// The high pose lifts the body this far above the perch feet, world px: the high lift (crowLiftArtPx + crowHighExtraArtPx) less the
// perch lift (crowPerchLiftArtPx). The shadows stay on the ground (bobOf).
const CROW_HIGH_LIFT_WORLD_PX = (WORLD_ENV.crowLiftArtPx + WORLD_ERA_ENV.crowHighExtraArtPx - WORLD_ERA_ENV.crowPerchLiftArtPx) * PIXEL_SCALE;
// Alpha steps of the 8-bit grid (writeAlpha quantizes to them) and the era crossfade midpoint (the to row takes over the lens fog).
// Both are structural, not tuning.
const ALPHA_LEVELS = 255;
const CROSS_MIDPOINT = 0.5;
// The crow's landing after a hop: two frames of landMs each (crowLandFrame); the hop is over after them.
const HOP_LAND_MS = 2 * CROW_HOP.landMs;
// WP28b yard lanes (lane = feet px below GROUND_Y). The Inspector takes the front row from the middle of the two rows on; the dog's home lane
// is its front row. A walker's child depth steps YARD_DEPTH per lane px: the yard convention of SpliceProps and the Find marker, so the
// lower feet draw in front.
const FRONT_ROW_LANE = (WORLD_ROWS.front.y - WORLD_ROWS.back.y) / 2;
const DOG_HOME_LANE = WORLD_ROWS.front.y - GROUND_Y;

/**
 * A snap-turn to camera. talk runs open until release (tl holds the bubble window, blips the mouth alternation of the line);
 * glance is a fixed hold.
 */
type Turn =
  | { kind: 'talk'; snapMs: number; trackMs: number; endMs: number; blips: number; tl: TalkTimeline }
  | { kind: 'glance'; snapMs: number; trackMs: number; endMs: number; gl: GlanceTimeline };

/** A timed frame sequence (failed-sync pose, notice): frames[i] shows for stepMs from startMs. flip mirrors the frame. */
interface Beat { startMs: number; endMs: number; stepMs: number; frames: readonly string[]; flip: boolean }

/**
 * The last runner frame of a walker, held while its runner is parked or the member is busy (R5). frame is the raw clip frame
 * (stareFrame applies at draw); activity is the runner's activity id (the crow's tipTry reads it); x is the runner x in world px (null
 * until the first draw); umbrella is the Inspector's pose set.
 */
interface RunHold {
  x: number | null;
  frame: string;
  activity: string;
  walking: boolean;
  flip: boolean;
  alpha: number;
  rise: number;
  umbrella: boolean;
}

/**
 * The rest pose of a walker derived from its runner (refreshRestLook): the stared frame and the mirror a rest frame draws with, kept with
 * the inputs they came from. stareFrame and restFlip are pure in those inputs, so a kept pose is the one the derivation gives.
 */
interface RestLook {
  valid: boolean;
  frame: string;       // runner frame read
  walking: boolean;    // runner walk read
  flip: boolean;       // runner mirror read
  stared: boolean;     // the stare read
  placementX: number;  // the placement x read (restFlip's home)
  shown: string;       // stareFrame of the runner frame: the frame drawn
  mirror: boolean;     // the mirror drawn: the runner's on a walk, restFlip on a rest frame
}

interface Walker {
  readonly id: WalkerId;
  readonly body: Phaser.GameObjects.Sprite;
  readonly blend: Phaser.GameObjects.Sprite;   // the crossfade row over the body: the film's blend, or the era twin (the to row at alpha k)
  readonly shadow: Phaser.GameObjects.Image | null;
  feetY: number;                      // rest feet y, world px (crow: lifted for its perch; girl: placement row + dy)
  lane: number;                       // WP28b: drawn feet lane (feetY = GROUND_Y + lane) of the Inspector and the dog; the rest lane otherwise
  anchorY: number;                    // feet y the speech tail follows: the film's feet y in script mode, else feetY
  row: WorldRow;                      // the row container the body, blend and shadow sit in (the girl and the film move between rows)
  home: WorldRow;                     // the row without a film: the construction row (the girl: her placement row)
  placement: WorldPlacement | null;   // null while hidden
  visible: boolean;
  feetX: number;                      // world px: runner x (held while busy) + ripple nudge
  frame: string;                      // frame name shown
  flip: boolean;
  dx: number;                         // runner x minus the placement x (world px)
  run: RunHold;
  readonly look: RestLook;             // the derived rest pose (refreshRestLook), kept while its inputs hold
  readonly memo: { body: SheetMemo; twin: SheetMemo };   // the sheet index of the body and of the era twin (paintFrame)
  turn: Turn | null;
  beat: Beat | null;
  talking: boolean;
}

// The Sensor 7 sprites that look up a sheet frame each frame (the keys of Sensor.memo).
type SensorPart = 'head' | 'headTwin' | 'tripod' | 'tripodTwin' | 'glyph' | 'glyphTwin' | 'fog';

interface Sensor {
  readonly feetY: number;
  readonly dots: Phaser.GameObjects.Graphics;
  readonly tripod: Phaser.GameObjects.Sprite;
  readonly tripodBlend: Phaser.GameObjects.Sprite;  // the tripod's era twin (the to row at alpha k), over the tripod
  readonly head: Phaser.GameObjects.Sprite;
  readonly headBlend: Phaser.GameObjects.Sprite;  // the head's crossfade row (film blend or era twin), over the head, under the readout
  readonly glyph: Phaser.GameObjects.Sprite;   // the readout: the from row through a crossfade
  readonly glyphBlend: Phaser.GameObjects.Sprite;  // the readout's era twin (the to row at alpha k), over the glyph
  readonly fog: Phaser.GameObjects.Sprite;     // lens fog: alpha tween.sensorFog (era III with vents)
  readonly memo: Record<SensorPart, SheetMemo>;  // sheet index memos of the parts (paintFrame)
  readonly led: Phaser.GameObjects.Rectangle;
  ledColor: number;
  ledFrame: string;                            // sensorRows frame of the LED: red, amber, dark or green (the film)
  ledAlpha: number;                            // sensorRows alpha: 1, or the dim factor while the reading dip runs
  followTarget: SensorHead;                        // the camera side the head is heading for (the Sensor 7 lag)
  followSince: number;                         // nowMs when followTarget last changed
  followShown: SensorHead;                         // the head frame on screen
  placement: WorldPlacement | null;
  visible: boolean;
  feetX: number;
  frame: string;                               // head frame shown
  turn: Turn | null;
  blinkStart: number | null;                   // sensorBlink notice start, null when idle
  talking: boolean;
}

/** One sensorRows entry (the same shape as the other renderers' prop rows): presented frame, alpha and rounded world position. */
interface PropRow { id: string; frame: string; alpha: number; x: number; y: number }

/** The era crossfade read from a Blend: main = the row the body shows, twin = the row the twin shows at alpha k (k 0 = no twin). */
interface Cross { main: number; twin: number; k: number }

// The sheet index each sprite last showed through paint(), so a still pose is not parsed back from its frame name on every frame.
const paintedIndex = new WeakMap<Phaser.GameObjects.Sprite, number>();

// Points a sprite at a sheet frame: texture and frame change only when they differ (no per-frame work for a still pose).
function paint(sprite: Phaser.GameObjects.Sprite, key: string, index: number): void {
  if (sprite.texture.key === key && paintedIndex.get(sprite) === index) return;
  if (sprite.texture.key !== key) sprite.setTexture(key, index);
  else sprite.setFrame(index);
  paintedIndex.set(sprite, index);
}

// The last sheet lookup of one sprite: the frame name and era row it was asked for, and the index sheetFrameIndex gave them. The row
// -1 never matches an era row, so the first lookup always runs.
interface SheetMemo { frame: string; row: number; index: number }

function newSheetMemo(): SheetMemo {
  return { frame: '', row: -1, index: 0 };
}

// paint() of a frame of sheet id: sheetFrameIndex runs only when the frame name or the era row changed (a still pose costs no lookup).
function paintFrame(sprite: Phaser.GameObjects.Sprite, key: string, id: LivingId, frame: string, row: number, memo: SheetMemo): void {
  if (memo.frame !== frame || memo.row !== row) {
    const index = sheetFrameIndex(id, frame, row);
    memo.frame = frame;
    memo.row = row;
    memo.index = index;
  }
  paint(sprite, key, memo.index);
}

// Frame size of a sheet, from the manifest (the registry is the one source of sheet dims).
function frameOf(id: LivingId): { width: number; height: number } {
  const entry = ASSET_MANIFEST[WORLD_SHEET_KEYS[id] as AssetId];
  if (entry.frame === undefined) throw new Error(`LivingWorld: ${entry.id} has no frame size`);
  return entry.frame;
}

// Game px of a world x or y on the cast's layer (scroll factor 1): screenOfWorld's maths, without its allocation (anchorInto).
function screenX(x: number, cam: CameraPose): number {
  return (x - (cam.centerX - VIEW.width / 2) - VIEW.width / 2) * cam.zoom + VIEW.width / 2;
}
function screenY(y: number, cam: CameraPose): number {
  return (y - (cam.centerY - VIEW.height / 2) - VIEW.height / 2) * cam.zoom + VIEW.height / 2;
}
// Head and feet of a sprite whose origin is its feet (feetX, feetY in world px) and whose frame is frameHeightWorld tall, written in game px
// into out. The head point sits HEAD_ANCHOR_WORLD_PX below the frame top; every speaker uses the same offset.
function writeSpeakerAnchor(out: SpeakerAnchor, feetX: number, feetY: number, frameHeightWorld: number, cam: CameraPose): void {
  out.head.x = screenX(feetX, cam);
  out.head.y = screenY(feetY - frameHeightWorld + HEAD_ANCHOR_WORLD_PX, cam);
  out.feet.x = screenX(feetX, cam);
  out.feet.y = screenY(feetY, cam);
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

// The frame names of each walker's sheet as sets, built once (sheetHas runs for every walker every frame).
const WALKER_FRAME_SETS: Readonly<Record<WalkerId, ReadonlySet<string>>> = {
  inspector: new Set(WORLD_FRAMES.inspector), dog: new Set(WORLD_FRAMES.dog), crow: new Set(WORLD_FRAMES.crow),
  girl: new Set(WORLD_FRAMES.girl),
};

// True when a runner frame is a frame of the walker's sheet. sheetFrameIndex throws on any other name, so such a frame is ignored
// and the walker holds its last runner frame (a scheduler bug never breaks the render loop).
function sheetHas(id: WalkerId, frame: string): boolean {
  return WALKER_FRAME_SETS[id].has(frame);
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

// The rest pose of a walker: stareFrame of its runner frame, and the mirror a rest frame draws with (restFlip; a walk keeps the runner's).
// Derived again only when one of its inputs changed (the runner frame, walk, mirror, stare or placement x). Both functions are pure in
// those inputs, so a kept pose is the one the derivation gives; NaN never matches and so always derives.
function refreshRestLook(look: RestLook, id: WalkerId, run: RunHold, stared: boolean, placementX: number): void {
  if (look.valid && look.frame === run.frame && look.walking === run.walking && look.flip === run.flip && look.stared === stared
    && look.placementX === placementX) return;
  const shown = stareFrame(id, run.frame, run.walking, stared);
  look.valid = true;
  look.frame = run.frame;
  look.walking = run.walking;
  look.flip = run.flip;
  look.stared = stared;
  look.placementX = placementX;
  look.shown = shown;
  look.mirror = run.walking ? run.flip : restFlip(id, shown, false, placementX);
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

// Shadow alpha of the film: the era's scale, whatever state.shadows says (the dog fade drives the pose alpha).
function filmShadowAlpha(state: WorldVisualState): number {
  return WORLD_PLAYBACK.shadowAlpha * shadowScale(state.era);
}

// The era crossfade of a Blend into c: a settled blend (from = to, or k 1) shows its to row alone; a blend at k 0 shows its from row alone;
// between, main = the from row and twin = the to row at k.
export function crossInto(c: Cross, b: Blend): void {
  if (b.from === b.to || b.k >= 1) {
    c.main = b.to;
    c.twin = b.to;
    c.k = 0;
  } else if (b.k <= 0) {
    c.main = b.from;
    c.twin = b.from;
    c.k = 0;
  } else {
    c.main = b.from;
    c.twin = b.to;
    c.k = b.k;
  }
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// One channel of a 0xRRGGBB mix: a + (b - a) x t, rounded, placed at shift.
function channelMix(a: number, b: number, t: number, shift: number): number {
  const ca = (a >> shift) & 0xff;
  const cb = (b >> shift) & 0xff;
  return Math.round(ca + (cb - ca) * t) << shift;
}

// Mix of two 0xRRGGBB colours: t 0 is a, t 1 is b.
function mixRgb(a: number, b: number, t: number): number {
  return channelMix(a, b, t, 16) | channelMix(a, b, t, 8) | channelMix(a, b, t, 0);
}

// Alpha of the layer on top of a crossfade pair: the twin when it shows and has the higher alpha, else the main sprite.
function topAlpha(main: Phaser.GameObjects.Sprite, twin: Phaser.GameObjects.Sprite): number {
  return twin.visible && twin.alpha > main.alpha ? twin.alpha : main.alpha;
}

// Shadow width: the cached ellipse scales on x only (WORLD_AMBIENT.shadowWidth); written only when it changes.
function setShadowWidth(shadow: Phaser.GameObjects.Image, widthScale: number): void {
  if (shadow.scaleX !== widthScale) shadow.setScale(widthScale, 1);
}

// Guarded writes: Phaser is called only when the stored value would change, so a still pose costs no call. Alpha is quantized to the
// 8-bit grid first (ALPHA_LEVELS steps, the one a frame can show), so a change under one step costs no call and the stored value is
// the one compared. Object.is keeps -0 and NaN exact.
function writeAlpha(o: { alpha: number; setAlpha(value: number): unknown }, alpha: number): void {
  writeAlphaLevel(o, alphaLevel(alpha));
}
// writeAlpha of a value already on the grid (alphaLevel): several sprites that share one alpha quantize it once.
function writeAlphaLevel(o: { alpha: number; setAlpha(value: number): unknown }, a: number): void {
  if (!Object.is(o.alpha, a)) o.setAlpha(a);
}
// The 8-bit grid value of an alpha: clamped, then rounded to ALPHA_LEVELS steps.
function alphaLevel(alpha: number): number {
  return Math.round(clamp01(alpha) * ALPHA_LEVELS) / ALPHA_LEVELS;
}
function writeVisible(o: Phaser.GameObjects.Components.Visible, on: boolean): void {
  if (o.visible !== on) o.setVisible(on);
}
function writePosition(o: Phaser.GameObjects.Components.Transform, x: number, y: number): void {
  if (!Object.is(o.x, x) || !Object.is(o.y, y)) o.setPosition(x, y);
}
function writeFlip(o: Phaser.GameObjects.Components.Flip, flip: boolean): void {
  if (o.flipX !== flip) o.setFlipX(flip);
}

// A host pose record before its first frame (hidden): the extras read it only while the host is shown.
function blankExtraPose(): ExtraPose {
  return { x: 0, feetY: 0, frame: '', flip: false, visible: false, alpha: 0, row: 'back' };
}

/**
 * A poke overlay (overlay): one timed clip drawn over a walker's runner frame. playedMs advances only while the runner is not walking (the walk
 * read at the last frame), so the clip waits for a walk segment to end. The clip ends at totalMs (at most POKES.maxAnswerMs).
 */
interface Overlay { active: boolean; frames: readonly string[]; frameMs: readonly number[]; totalMs: number; playedMs: number; lastMs: number; walking: boolean }
/**
 * The crow's hop (crowHop): the arc from (fromX, fromY) to (toX, toY), starting at startMs and lasting durMs, then the landing frames at the
 * destination. set holds the crow there until the next hop; x and y are the feet point last drawn.
 */
interface CrowHop { set: boolean; fromX: number; fromY: number; toX: number; toY: number; apexPx: number; startMs: number; durMs: number; reversed: boolean; x: number; y: number }
function blankOverlay(): Overlay {
  return { active: false, frames: [], frameMs: [], totalMs: 0, playedMs: 0, lastMs: 0, walking: false };
}

/**
 * The living world cast. Built once per scene: every sprite, shadow and texture exists from the constructor on and is shown or
 * hidden afterwards. apply() takes the visual state and the placements; update() draws the poses from the runner frames.
 */
export class LivingWorld {
  private readonly scene: Phaser.Scene;
  private readonly rows: WorldRows;
  private readonly heartbeatLow: (nowMs: number) => boolean;
  private readonly beatLow: (nowMs: number) => boolean;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly ownedTextures: string[] = [];
  private readonly tracks: Record<LivingId, string | null>;
  private readonly timings = new TimingRing(TIMING_WINDOW);
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
  private readonly eraCross: Cross = { main: 0, twin: 0, k: 0 };   // this frame's era crossfade (update)
  private readonly ledRow: PropRow = { id: 'sensorLed', frame: 'dark', alpha: 0, x: 0, y: 0 };
  private readonly ledRows: readonly PropRow[] = [this.ledRow];
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
  private pointerX: number | null = null;                 // the pointer's world x (Sensor 7 follows it); null off the canvas
  private pointerMovedMs = Number.NEGATIVE_INFINITY;      // when the pointer last moved
  private pointerHead: SensorHead = 'headC';              // the head the pointer rule shows
  private pointerHeadMs = Number.NEGATIVE_INFINITY;       // when pointerHead last changed
  private readonly overlays: Record<WalkerId, Overlay> = { inspector: blankOverlay(), dog: blankOverlay(), crow: blankOverlay(), girl: blankOverlay() };
  private readonly hop: CrowHop = { set: false, fromX: 0, fromY: 0, toX: 0, toY: 0, apexPx: 0, startMs: 0, durMs: 0, reversed: false, x: 0, y: 0 };
  // The crow's perch offset (WP28a r1-FixA): where its last hop landed, from its placement x and its normal feet y. dx and dy are zero while off.
  private readonly perch = { on: false, dx: 0, dy: 0 };
  // The crow's placement at the last apply (null while hidden): a change of its x or row snaps its hop and perch offset home.
  private crowSeen: WorldPlacement | null = null;
  private readonly crowAt: { x: number; y: number } = { x: 0, y: 0 };
  // The lantern ring (lanternRing): one pooled Graphics in the girl's row, its span start and length (span 0: none), and that row.
  private readonly lantern: Phaser.GameObjects.Graphics;
  private lanternRow: WorldRow = 'back';
  private lanternStartMs = 0;
  private lanternSpanMs = 0;
  // Sensor 7's answer lights (sensorLed): the time the solid red and the glint amber hold until.
  private readonly ledUntil = { solid: Number.NEGATIVE_INFINITY, glint: Number.NEGATIVE_INFINITY };
  // The extras' host poses: one record per walker, rewritten by extraPoseOf each frame (CastExtras reads the latest pose of a host).
  private readonly extraPoses: Record<WalkerId, ExtraPose> = {
    inspector: blankExtraPose(), dog: blankExtraPose(), crow: blankExtraPose(), girl: blankExtraPose(),
  };
  // poseOf for the extras without an allocation per host: the walker's record is rewritten (null while hidden and for Sensor 7).
  private readonly extraPoseOf = (id: LivingId): ExtraPose | null => {
    if (id === 'sensor7') return null;
    const w = this.walkerOf(id);
    if (!w.visible) return null;
    const pose = this.extraPoses[id];
    pose.x = w.body.x;
    pose.feetY = w.body.y;
    pose.frame = w.frame;
    pose.flip = w.body.flipX;
    pose.visible = true;
    pose.alpha = w.body.alpha;
    pose.row = w.row;
    return pose;
  };

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
    this.crow = this.makeWalker('crow', 'back', WORLD_ROWS.back.y - WORLD_ERA_ENV.crowPerchLiftArtPx * PIXEL_SCALE, WORLD_DEPTH_OFFSETS.crow, null);
    this.girl = this.makeWalker('girl', 'back', WORLD_ROWS.back.y, WORLD_DEPTH_OFFSETS.cast, WORLD_SHADOW_WIDTHS[0]);
    this.lantern = this.track(this.scene.add.graphics());
    this.lantern.setDepth(WORLD_DEPTH_OFFSETS.cast + POKE_RENDER.lantern.depthStep).setVisible(false);
    this.rowOf('back').add(this.lantern);
    this.sensor = this.makeSensor(rows.back, WORLD_ROWS.back.y);
    this.extras = new CastExtras(scene, rows);
  }

  /** Takes the visual state and where each member stands. A null placement (or state.visible false) hides that member. */
  apply(state: WorldVisualState, placements: Readonly<Record<GroundId, WorldPlacement | null>>, opts: { reducedMotion: boolean }): void {
    if (this.destroyed) return;
    // A framing or era change moves the crow, so its hop and perch offset (from the old placement) snap home; so does reduced motion turning on.
    const crow = state.visible ? placements.crow : null;
    if (this.crowSeen?.x !== crow?.x || this.crowSeen?.row !== crow?.row) this.crowSnapHome();
    this.crowSeen = crow;
    if (opts.reducedMotion && !this.reduced) this.crowSnapHome();
    this.state = state;
    this.placements = placements;
    this.reduced = opts.reducedMotion;
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
    if (isFilm) {
      this.dropOverlays();
      this.crowSnapHome();
    }
    // WP28b: the film draws the Inspector and the dog on their home lines (drawScriptWalker reads feetY), so a lane held by a walk is dropped.
    if (isFilm && !wasFilm) {
      this.restLane(this.inspector);
      this.restLane(this.dog);
    }
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

  /**
   * A walker's pose for its extras: feet, frame, mirror and alpha of the body; null while hidden and for Sensor 7 (no extras). The record is
   * the walker's shared one (extraPoseOf, WP24 r6-F3): it is rewritten by the next call, so a caller reads it at once and keeps nothing.
   */
  poseOf(id: LivingId): ExtraPose | null {
    return this.extraPoseOf(id);
  }

  /**
   * True while the member holds a pose its runner must not move under (the director pauses the runner then): a turn or a beat still
   * running, snapAll, or a film. Sensor 7 is busy while its turn or its blink runs.
   */
  busy(id: LivingId): boolean {
    const now = this.nowMs;
    if (this.snapped || this.script !== null) return true;
    if (id === 'sensor7') {
      const turn = this.sensor.turn;
      return (turn !== null && turnActive(turn, now)) || blinkRunning(this.sensor.blinkStart, now);
    }
    const w = this.walkerOf(id);
    return (w.turn !== null && turnActive(w.turn, now)) || (w.beat !== null && now < w.beat.endMs);
  }

  /** Starts a host's era V double-exposure flash (refused under reduced motion and in a script). Sensor 7 has none. */
  flashDouble(id: LivingId): void {
    if (id !== 'sensor7') this.extras.flash(id);
  }

  /** Double-exposure flashes started since construction. */
  flashCount(): number {
    return this.extras.flashCount();
  }

  /**
   * Debug probe of the extras: the clipboard, the red ball, each host's flash and the crow's ruffle drip. The entries also carry the
   * presented alpha and y at runtime; the declared shape stays the T6a public one (the director's default spread reads them).
   */
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
    // The crow's feet sit on the finial in every era (crowPerchLiftArtPx); the cycle 2+ high pose lifts only its body (bobOf).
    this.crow.feetY = WORLD_ROWS.back.y - WORLD_ERA_ENV.crowPerchLiftArtPx * PIXEL_SCALE;
    this.applyGirl(placements.girl, state);
    this.applySensor(placements.sensor7, state);
  }

  /**
   * One frame: draws every member at nowMs from the camera pose cam. frames holds each walker's runner frame (null: the girl hides,
   * the others hold their last frame); tween carries the presented stare, alpha, era crossfade, shadows and LED; ambient the shadow
   * offset and width, the micro flags and the mains clock (the era II flicker). dtMs advances the extras.
   */
  update(dtMs: number, frames: Readonly<Record<'inspector' | 'dog' | 'crow' | 'girl', BehaviourFrame | null>>, tween: WorldTween,
    nowMs: number, cam: CameraPose, ambient: Ambient): void {
    if (this.destroyed) return;
    const t0 = performance.now();
    this.nowMs = nowMs;
    this.stepBeat(nowMs);
    const state = this.state;
    if (state !== null && !this.forceHidden) {
      // The mains flicker runs on the mains clock (ambient.mainsMs), which the tape freeze holds with the windows and the lamp.
      const flicker = state.era === 2 && !this.reduced
        ? 1 + WORLD_ENV.mainsFlicker.amp * Math.sin(2 * Math.PI * ambient.mainsMs / WORLD_ENV.mainsFlicker.periodMs)
        : 1;
      crossInto(this.eraCross, tween.eraRow);
      this.drawWalker(this.inspector, nowMs, frames.inspector, state, flicker, tween, ambient);
      this.drawWalker(this.dog, nowMs, frames.dog, state, flicker, tween, ambient);
      this.drawWalker(this.crow, nowMs, frames.crow, state, flicker, tween, ambient);
      this.drawWalker(this.girl, nowMs, frames.girl, state, flicker, tween, ambient);
      this.drawSensor(nowMs, cam, state, flicker, tween, ambient);
      this.drawLantern(nowMs);
    }
    this.extras.update(dtMs, nowMs, this.extraPoseOf);
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

  /**
   * Ends a running glance turn now (WP28a r3): a poke answer starts on its actor, so the answer is the frame drawn and no glance pose
   * outlives the cut (the glance turn would otherwise run to its own endMs). Talk turns are untouched (release() ends those); Sensor 7
   * answers with its own turnToCamera, so it has nothing to cut.
   */
  cutTurn(id: LivingId): void {
    if (id === 'sensor7') return;
    const turn = this.walkerOf(id).turn;
    if (turn !== null && turn.kind === 'glance') turn.endMs = this.nowMs;
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
      w.beat = makeBeat(now + step.startMs, [this.poseNamesOf(w, state.era).glance], step.failMs, w.id === 'crow');
    }
  }

  /**
   * Tape freeze (the crossed-line and wornMotor beats): every sprite shows the tracking line for one frame. No clock is frozen any more
   * (the runners hold through busy()), so ms is not read here.
   */
  tapeFreeze(ms: number): void {
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
   * The ground girl's answer to a poke (WP28a): a lantern ring over her lantern for ms. She does not move. Under reduced motion the ring is steady
   * for min(ms, POKE_RENDER.lantern.reducedMs). Nothing shows while she is hidden; a film or dropOverlays drops it.
   */
  lanternRing(ms: number): void {
    const span = this.reduced ? Math.min(ms, POKE_RENDER.lantern.reducedMs) : ms;
    if (this.destroyed || !Number.isFinite(span) || span <= 0) return;
    this.lanternStartMs = this.nowMs;
    this.lanternSpanMs = span;
  }

  /**
   * Sensor 7's answer light (WP28a): 'glint' shows the amber LED frame at full alpha for ms; 'solid' shows the red frame at full alpha for ms and
   * holds the blink schedule off meanwhile. Only the red and amber frames (never green: no green before the finale).
   */
  sensorLed(kind: 'solid' | 'glint', ms: number): void {
    if (this.destroyed || !Number.isFinite(ms) || ms <= 0) return;
    this.ledUntil[kind] = this.nowMs + ms;
  }

  /**
   * WP28b: the amber glint ends now (a Machine Fault clears or expires). The blink schedule resumes at once; a glint span still running is cut.
   */
  sensorLedClear(): void {
    this.ledUntil.glint = Number.NEGATIVE_INFINITY;
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

  /**
   * A poke answer (T15b1): draws clip over the runner frame of actor until it ends (at most POKES.maxAnswerMs). Every frame takes its facing from
   * restFlip at the actor's x (a clip has no flip field). A clip waits while the runner walks (never a still frame on a moving x); the runner keeps
   * running underneath. Reduced motion holds the first frame for at most POKES.reducedHoldMs. A clip with no frames, or a frame off the actor's
   * sheet, is refused.
   */
  overlay(actor: BehaviourActor, clip: { readonly frames: readonly string[]; readonly frameMs: readonly number[] }, nowMs: number): void {
    if (this.destroyed || clip.frames.length === 0 || clip.frames.length !== clip.frameMs.length) return;
    if (!clip.frames.every((frame) => sheetHas(actor, frame))) return;
    const sum = clip.frameMs.reduce((acc, ms) => acc + Math.max(0, ms), 0);
    const ov = this.overlays[actor];
    const reduced = this.reduced;
    ov.frames = reduced ? clip.frames.slice(0, 1) : clip.frames;
    ov.frameMs = reduced ? [Math.min(POKES.reducedHoldMs, sum)] : clip.frameMs;
    ov.totalMs = Math.min(reduced ? POKES.reducedHoldMs : POKES.maxAnswerMs, sum);
    ov.active = ov.totalMs > 0;
    ov.playedMs = 0;
    ov.lastMs = nowMs;
    ov.walking = this.walkerOf(actor).run.walking;
  }

  /** Whether an overlay is playing, or waiting for a walk segment to end, on actor. */
  overlayActive(actor: BehaviourActor): boolean {
    return this.overlays[actor].active;
  }

  /** Drops every overlay now (the director does it while the ending is not 'none'; the finale film drops them too). */
  dropOverlays(): void {
    this.overlays.inspector.active = false;
    this.overlays.dog.active = false;
    this.overlays.crow.active = false;
    this.overlays.girl.active = false;
    // The poke answers' lights go with them: the lantern ring and Sensor 7's answer lights.
    this.lanternSpanMs = 0;
    writeVisible(this.lantern, false);
    this.ledUntil.solid = this.ledUntil.glint = Number.NEGATIVE_INFINITY;
  }

  /**
   * Starts a crow hop from one perch feet point to another (T15b1, C3): the arc of crowHopSpec (one wing, at most CROW_HOP.maxDistPx, never over
   * machine, the framing's visible x-range, and above the dog's head box), the flight frames flipped toward the travel direction, then the landing
   * frames unflipped at the destination. Returns false, and starts nothing, under reduced motion, while the crow is hidden, or when the hop is
   * refused. The crow holds the destination until the next hop.
   */
  crowHop(from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }, nowMs: number, reversed: boolean,
    machine: HopSpan): boolean {
    if (this.destroyed || this.reduced || this.crow.placement === null) return false;
    const dog = this.dog;
    const dogFrame = frameOf('dog');
    const halfW = dogFrame.width * PIXEL_SCALE / 2;
    const box = dog.visible ? { x0: dog.feetX - halfW, x1: dog.feetX + halfW, top: dog.feetY - dogFrame.height * PIXEL_SCALE } : null;
    const spec = crowHopSpec(from.x, from.y, to.x, to.y, machine, box);
    if (spec === null) return false;
    const hop = this.hop;
    hop.set = true;
    hop.fromX = from.x;
    hop.fromY = from.y;
    hop.toX = to.x;
    hop.toY = to.y;
    hop.apexPx = spec.apexPx;
    hop.startMs = nowMs;
    hop.durMs = spec.durMs;
    hop.reversed = reversed;
    hop.x = from.x;
    hop.y = from.y;
    return true;
  }

  /** WP28b: whether a crow hop is still in flight or landing at nowMs (its arc and its two landing frames): the director waits for it. */
  hopBusy(nowMs: number): boolean {
    return this.hop.set && nowMs < this.hop.startMs + this.hop.durMs + HOP_LAND_MS;
  }

  /** Clears the crow's hop and perch offset at once, no animation: the crow draws on its placement until its next hop. */
  crowSnapHome(): void {
    this.hop.set = false;
    this.perch.on = false;
    this.perch.dx = 0;
    this.perch.dy = 0;
    this.crow.anchorY = this.crow.feetY;
  }

  /**
   * WP28b F33: the crow sits at (x, y) with no flight, for an unseen relocation (its perch took over by a Splice top, or its home moved at an unseen
   * moment). It draws there from the next frame as a landed hop does, so the perch offset and the anchor follow it.
   */
  crowSettleAt(x: number, y: number): void {
    if (this.destroyed) return;
    const hop = this.hop;
    hop.set = true;
    hop.fromX = hop.toX = hop.x = x;
    hop.fromY = hop.toY = hop.y = y;
    hop.startMs = Number.NEGATIVE_INFINITY;
    hop.durMs = 0;
  }

  /**
   * The crow's feet point: the hop's current point while a hop is in flight or landing, the perch point (placement x + dx, feet y + dy) while
   * a perch offset holds, else null. The object is reused: read it at once.
   */
  crowPos(): { readonly x: number; readonly y: number } | null {
    if (this.hop.set) {
      this.crowAt.x = this.hop.x;
      this.crowAt.y = this.hop.y;
      return this.crowAt;
    }
    const placement = this.crow.placement;
    if (!this.perch.on || placement === null) return null;
    this.crowAt.x = placement.x + this.perch.dx;
    this.crowAt.y = this.crow.feetY + this.perch.dy;
    return this.crowAt;
  }

  /** The pointer over the canvas (Sensor 7 follows it): worldX is its world x (null off the canvas), movedAtMs when it last moved. */
  setPointer(worldX: number | null, movedAtMs: number): void {
    this.pointerX = worldX;
    this.pointerMovedMs = movedAtMs;
  }

  /** Head and feet of a speaker in game px, Sensor 7 included, or null while it is hidden. */
  anchor(id: LivingId, cam: CameraPose): SpeakerAnchor | null {
    const out: SpeakerAnchor = { head: { x: 0, y: 0 }, feet: { x: 0, y: 0 } };
    return this.anchorInto(id, cam, out) ? out : null;
  }

  /**
   * anchor() written into out, allocating nothing: true with out set, or false with out untouched while the member is hidden. The crow's feet are
   * its hop point in flight, its perch point (placement x + dx, feet y + dy) while a perch offset holds, else its placement x: the crowStutter dx
   * and the ripple nudge never move it (AD2e F23).
   */
  anchorInto(id: LivingId, cam: CameraPose, out: SpeakerAnchor): boolean {
    if (id === 'sensor7') {
      const s = this.sensor;
      if (!s.visible) return false;
      writeSpeakerAnchor(out, s.feetX, s.feetY, frameOf('sensor7').height * PIXEL_SCALE, cam);
      return true;
    }
    const w = this.walkerOf(id);
    if (!w.visible) return false;
    let x = w.feetX;
    let y = w.anchorY;
    if (id === 'crow' && this.hop.set) {
      x = this.hop.x;
      y = this.hop.y;
    } else if (id === 'crow' && w.placement !== null) {
      x = w.placement.x + this.perch.dx;   // dx is zero while no perch offset holds
    }
    writeSpeakerAnchor(out, x, y, frameOf(id).height * PIXEL_SCALE, cam);
    return true;
  }

  /**
   * Debug probe: every cast member's frame, feet x (world px), presented feet y (the rise, hover and bob included), presented alpha
   * (the layer on top during an era crossfade; 0 while hidden), visibility and speaking flag.
   */
  probe(): { id: string; variant: string; x: number; y: number; alpha: number; visible: boolean; speaking: boolean }[] {
    const walker = (id: WalkerId, w: Walker) => (
      {
        id, variant: this.variantOf(id, w.frame), x: w.feetX, y: w.visible ? Math.round(w.body.y) : 0,
        alpha: w.visible ? topAlpha(w.body, w.blend) : 0, visible: w.visible, speaking: w.talking,
      }
    );
    const s = this.sensor;
    return [
      walker('inspector', this.inspector), walker('dog', this.dog), walker('crow', this.crow), walker('girl', this.girl),
      {
        id: 'sensor7', variant: this.variantOf('sensor7', s.frame), x: s.feetX, y: s.visible ? Math.round(s.head.y) : 0,
        alpha: s.visible ? topAlpha(s.head, s.headBlend) : 0, visible: s.visible, speaking: s.talking,
      },
    ];
  }

  /** Sensor 7 rows for the probes: the LED ('sensorLed': frame red, amber, dark or green; alpha; rounded world position). Reused rows. */
  sensorRows(): readonly PropRow[] {
    const s = this.sensor;
    const row = this.ledRow;
    row.frame = s.ledFrame;
    row.alpha = s.visible ? s.ledAlpha : 0;
    row.x = s.visible ? Math.round(s.led.x) : 0;
    row.y = s.visible ? Math.round(s.led.y) : 0;
    return this.ledRows;
  }

  /** Hides every member and every extra until the next apply(). */
  hideAll(): void {
    this.forceHidden = true;
    this.crowSnapHome();
    this.dropOverlays();
    this.applyWalker(this.inspector, null, null);
    this.applyWalker(this.dog, null, null);
    this.applyWalker(this.crow, null, null);
    this.applyGirl(null, null);
    this.applySensor(null, null);
    this.extras.hideAll();
  }

  /** Created objects (extras included), and the mean update time over the last 120 frames (ms). */
  stats(): { objects: number; meanMs: number } {
    return {
      objects: this.objects.length + this.extras.stats().objects,
      meanMs: this.timings.mean(),
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
    // The crossfade body: pooled hidden, drawn over the body by the film and by the era crossfade (added after it, so it sits above it).
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
      id, body, blend, shadow, feetY, lane: feetY - GROUND_Y, anchorY: feetY, row, home: row, placement: null, visible: false, feetX: 0,
      frame: POSE_FRAMES[id].front, flip: false, dx: 0,
      run: { x: null, frame: POSE_FRAMES[id].front, activity: '', walking: false, flip: false, alpha: 1, rise: 0, umbrella: false },
      look: { valid: false, frame: '', walking: false, flip: false, stared: false, placementX: 0, shown: '', mirror: false },
      memo: { body: newSheetMemo(), twin: newSheetMemo() },
      turn: null, beat: null, talking: false,
    };
  }

  private makeSensor(row: Phaser.GameObjects.Container, feetY: number): Sensor {
    const depth = WORLD_DEPTH_OFFSETS.sensor;
    // Creation order is the draw order within the row: dots, tripod, tripod twin, head, head twin, readout, readout twin, fog, LED.
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
    const tripodBlend = part();
    const head = part();
    const headBlend = part();
    const glyph = part();
    const glyphBlend = part();
    const fog = part();
    const ledColor = WORLD_ENV.sensor7.ledColors.red;
    const led = this.track(this.scene.add.rectangle(0, 0, PIXEL_SCALE, PIXEL_SCALE, ledColor));
    led.setOrigin(0, 0).setDepth(depth).setVisible(false);
    row.add(led);
    return {
      feetY, dots, tripod, tripodBlend, head, headBlend, glyph, glyphBlend, fog, led, ledColor, ledFrame: 'red', ledAlpha: 1,
      followTarget: 'headC', followSince: Number.NEGATIVE_INFINITY, followShown: 'headC',
      placement: null, visible: false, feetX: 0,
      frame: POSE_FRAMES.sensor7.front, turn: null, blinkStart: null, talking: false,
      memo: {
        head: newSheetMemo(), headTwin: newSheetMemo(), tripod: newSheetMemo(), tripodTwin: newSheetMemo(),
        glyph: newSheetMemo(), glyphTwin: newSheetMemo(), fog: newSheetMemo(),
      },
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
    // The shadow's alpha, width and visibility are drawn every update() from the presented tween and ambient.
    if (w.shadow !== null) w.shadow.setVisible(false);
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

  // WP28b: the feet of a walker on a lane. feetY follows it, so the anchor, the shadow and the speech bubble follow the feet.
  private setLane(w: Walker, lane: number): void {
    w.lane = lane;
    w.feetY = GROUND_Y + lane;
  }

  // WP28b: a walker back on its home lane (the film start): its feet and row follow the rest lane.
  private restLane(w: Walker): void {
    this.setLane(w, homeLaneOf(w.home));
    this.placeLane(w);
  }

  // WP28b: the row and child depth of an Inspector or a dog on its lane. The Inspector takes the front row from FRONT_ROW_LANE on, at
  // cast + YARD_DEPTH x lane; the dog keeps the front row and steps deeper past its home lane; otherwise the depth is the home depth. A row
  // change goes through placeInRow; the rows re-sort only when the row or the depth step changes (the step is whole lane px).
  private placeLane(w: Walker): void {
    const front = w.id === 'inspector' && w.lane >= FRONT_ROW_LANE;
    const row: WorldRow = front ? 'front' : w.home;
    const lane = Math.round(w.lane);
    const step = w.id === 'dog' ? Math.max(0, lane - DOG_HOME_LANE) : front ? lane : 0;
    const depth = WORLD_DEPTH_OFFSETS.cast + YARD_DEPTH_STEP * step;
    this.placeInRow(w, row);
    if (w.body.depth === depth) return;
    w.body.setDepth(depth);
    w.blend.setDepth(depth);
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
      s.tripodBlend.setVisible(false);
      s.glyph.setVisible(shown);
      s.glyphBlend.setVisible(false);
      s.dots.setVisible(shown);
      s.led.setVisible(shown);
      // The lens fog and the foot shadow are drawn every update() (tween.sensorFog, the presented shadow).
      s.fog.setVisible(false);
    }
    if (shown && placement !== null) {
      s.feetX = placement.x;
      const { ledArt } = WORLD_ENV.sensor7;
      for (const part of [s.tripod, s.tripodBlend, s.head, s.headBlend, s.glyph, s.glyphBlend, s.fog]) part.setPosition(placement.x, s.feetY);
      s.dots.setPosition(placement.x, s.feetY);
      s.led.setPosition(placement.x + ledArt.x * PIXEL_SCALE, s.feetY + ledArt.y * PIXEL_SCALE);
    }
  }

  // ---- update ----

  // The overlay frame of a walker this frame, or null when none shows. The clock runs only while the runner is not walking (the walk read at the
  // last frame): a walk holds the clip, so a still frame never shows on a moving x. The clip ends after its frames (or its totalMs).
  private overlayFrame(w: Walker, now: number, stared: boolean): string | null {
    const ov = this.overlays[w.id];
    if (!ov.active) return null;
    if (!ov.walking) ov.playedMs += Math.max(0, now - ov.lastMs);
    ov.lastMs = now;
    ov.walking = w.run.walking;
    if (ov.playedMs >= ov.totalMs) {
      ov.active = false;
      return null;
    }
    if (w.run.walking) return null;
    const frame = ov.frames[clipIndexAt(ov.frameMs, ov.playedMs)];
    return frame === undefined ? null : stareFrame(w.id, frame, false, stared);
  }

  // The crow in its hop or perched after one (crowHop): the flight frames face the travel direction (the one facing exemption, C3); the landing
  // frames take the stare map and never flip. The body keeps the alpha and the era twin of a runner frame.
  private drawCrowHop(w: Walker, now: number, placement: WorldPlacement, state: WorldVisualState, tween: WorldTween, flicker: number): void {
    const hop = this.hop;
    const t = now - hop.startMs;
    let frame: string;
    let flip = false;
    let x = hop.toX;
    let y = hop.toY;
    if (t < hop.durMs) {
      const p = Math.min(1, Math.max(0, t / hop.durMs));
      frame = crowFlightFrame(t, hop.reversed);
      flip = hop.toX < hop.fromX;
      x = hop.fromX + (hop.toX - hop.fromX) * p;
      y = crowArcY(hop.fromY, hop.toY, hop.apexPx, p);
    } else {
      frame = stareFrame('crow', crowLandFrame(t - hop.durMs, hop.reversed), false, stareActive('crow', state.stare, tween.stareK));
    }
    hop.x = x;
    hop.y = y;
    const key = this.keyOf('crow', this.trackOn(w.turn, now));
    w.dx = x - placement.x;
    w.frame = frame;
    w.flip = flip;
    w.feetX = x;
    const alpha = tween.alpha * flicker;
    paintFrame(w.body, key, 'crow', frame, this.eraCross.main, w.memo.body);
    writeFlip(w.body, flip);
    writePosition(w.body, x, y);
    writeAlpha(w.body, alpha);
    this.eraTwin(w, key, frame, flip, y, alpha);
  }

  // Walker draw (not the film), in priority: snapAll, the beat, the turn, the lying dog, the crow's cycle 2+ tipTry high pose, then the
  // runner frame. The runner frame sets the pose, the mirror, the alpha, the rise and the x. While the member is busy the runner is
  // paused by the director and the x holds (R5); a null, parked or off-sheet frame holds the last runner frame and x. The girl is
  // hidden without a runner frame. The body alpha is the presented cast alpha x the flicker x the runner alpha; the era crossfade
  // draws the from row on the body and the to row on the twin.
  private drawWalker(w: Walker, now: number, f: BehaviourFrame | null, state: WorldVisualState, flicker: number, tween: WorldTween,
    ambient: Ambient): void {
    const placement = w.placement;
    if (placement === null) return;
    const pose = this.script === null ? null : this.script.cast[w.id];
    if (pose !== null) {
      this.drawScriptWalker(w, pose, placement, state, now);
      return;
    }
    if (w.id === 'girl' && f === null) {
      this.hideWalker(w);
      return;
    }
    if (!w.visible) this.showWalker(w);
    // WP28b: the Inspector and the dog take their row from their lane (placeLane below); the crow and the girl keep their home row.
    const laned = w.id === 'inspector' || w.id === 'dog';
    if (!laned) this.placeInRow(w, w.home);
    if (w.id === 'crow' && this.hop.set) {
      if (now - this.hop.startMs < this.hop.durMs + HOP_LAND_MS) {
        this.drawCrowHop(w, now, placement, state, tween, flicker);
        return;
      }
      // Landed: the perch offset is the landing point from the placement x and the normal feet y (read before any offset), and the runner
      // draws the crow again from this frame (ruffle, peck, caw, unison and the poke overlays).
      this.hop.set = false;
      this.perch.on = true;
      this.perch.dx = this.hop.toX - placement.x;
      this.perch.dy = this.hop.toY - w.feetY;
    }
    if (w.turn !== null && !turnActive(w.turn, now)) w.turn = null;
    if (w.beat !== null && now >= w.beat.endMs) w.beat = null;
    const held = this.busy(w.id);
    const lying = w.id === 'dog' && state.dogPose === 'lie';
    const stared = stareActive(w.id, state.stare, tween.stareK);
    if (f !== null && f.frame !== '' && sheetHas(w.id, f.frame)) {
      const run = w.run;
      run.frame = f.frame;
      run.activity = f.activity;
      run.walking = f.walking;
      run.flip = f.flip;
      run.alpha = f.alpha;
      run.rise = f.risePx;
      run.umbrella = f.poseSet === 'umbrella';
      if (!held) run.x = f.x;
      // The feet follow the drawn frame's lane (a lying dog stays on its home line, as it stays at its placement x).
      if (laned) this.setLane(w, lying ? homeLaneOf(w.home) : f.lane);
    }
    if (lying && !held) w.run.x = placement.x;
    // Runs on every frame, a valid runner frame or not, so the row and depth always match the lane held.
    if (laned) this.placeLane(w);
    const x = w.run.x ?? placement.x;
    w.run.x = x;
    const names = this.poseNamesOf(w, state.era);
    const beat = w.beat;
    const beatName = beat !== null ? beatFrame(beat, now) : null;
    const turnName = w.turn !== null ? turnPose(w.turn, now, names) : null;
    let frame: string;
    let flip = false;
    let tipHigh = false;  // the crow's cycle 2+ tipTry shows the high pose: bobOf lifts the body for it (WP27 F5.4)
    const overlay = this.overlayFrame(w, now, stared);
    if (this.snapped) {
      frame = names.front;
    } else if (overlay !== null) {
      // A poke overlay faces restFlip at the actor's x (C3: the crow and the girl never flip).
      frame = overlay;
      flip = restFlip(w.id, frame, stared, x);
    } else if (beat !== null && beatName !== null) {
      frame = beatName;
      flip = beat.flip;
    } else if (turnName !== null) {
      frame = turnName;
    } else if (lying) {
      frame = LIE_FRAME;
    } else if (w.id === 'crow' && state.traces.crowHigh && w.run.activity === CROW_TIP_ACTIVITY) {
      // The cycle 2+ tipTry: the high pose on the runner's own clock and x (WP27 F5.4).
      frame = stareFrame(w.id, CROW_HIGH_FRAME, false, stared);
      tipHigh = true;
    } else {
      // A walk keeps the runner's mirror; a rest frame faces away from the machine as it is drawn, so the stare onset flips with its frame.
      refreshRestLook(w.look, w.id, w.run, stared, placement.x);
      frame = w.look.shown;
      flip = w.look.mirror;
    }
    const nudge = this.gust || this.nudgeId === w.id ? RIPPLE_NUDGE_WORLD_PX : 0;
    // The landed crow's perch offset (zero for the other walkers and while none holds): its x and its feet y follow it.
    const perchDx = w.id === 'crow' ? this.perch.dx : 0;
    const perchDy = w.id === 'crow' ? this.perch.dy : 0;
    w.dx = x - placement.x;
    w.frame = frame;
    w.flip = flip;
    w.feetX = x + perchDx + nudge;
    w.anchorY = w.feetY + perchDy;
    // The Inspector's tracking hitch (era II micro): its tracking-line texture for this frame, never under reduced motion.
    const hitch = w.id === 'inspector' && ambient.micro.hitch && !this.reduced;
    const key = this.keyOf(w.id, hitch || this.trackOn(w.turn, now));
    // The lying frame has no runner: no rise, full alpha.
    const bare = lying;
    const alpha = bare ? 1 : w.run.alpha;
    const rise = bare ? 0 : w.run.rise;
    const bodyY = w.feetY + perchDy - this.bobOf(w, state, now, rise, tipHigh);
    const bodyAlpha = tween.alpha * flicker * alpha;
    paintFrame(w.body, key, w.id, frame, this.eraCross.main, w.memo.body);
    writeFlip(w.body, flip);
    writePosition(w.body, w.feetX, bodyY);
    writeAlpha(w.body, bodyAlpha);
    this.eraTwin(w, key, frame, flip, bodyY, bodyAlpha);
    if (w.shadow !== null) {
      const shadowAlpha = WORLD_PLAYBACK.shadowAlpha * tween.shadowScale * tween.shadows;
      writePosition(w.shadow, w.feetX + ambient.shadowDx + this.shadowShiftOf(w, now), w.feetY + perchDy);
      writeAlpha(w.shadow, shadowAlpha);
      writeVisible(w.shadow, shadowAlpha > 0);
      setShadowWidth(w.shadow, ambient.shadowWidth);
    }
  }

  // The era crossfade twin of a walker: the to row at alpha x k over the body (the body keeps the from row at its full alpha); hidden
  // when no crossfade runs. Same frame, flip and position as the body.
  private eraTwin(w: Walker, key: string, frame: string, flip: boolean, y: number, bodyAlpha: number): void {
    const k = this.eraCross.k;
    if (k <= 0) {
      writeVisible(w.blend, false);
      return;
    }
    paintFrame(w.blend, key, w.id, frame, this.eraCross.twin, w.memo.twin);
    writeFlip(w.blend, flip);
    writePosition(w.blend, w.feetX, y);
    writeAlpha(w.blend, bodyAlpha * k);
    writeVisible(w.blend, true);
  }

  // The girl with no runner frame: body, twin and shadow hidden until a frame draws again (showWalker).
  private hideWalker(w: Walker): void {
    w.visible = false;
    writeVisible(w.body, false);
    writeVisible(w.blend, false);
    if (w.shadow !== null) writeVisible(w.shadow, false);
  }

  // Shows a walker hidden by hideWalker; apply() sets the body visibility the rest of the time and update() the shadow.
  private showWalker(w: Walker): void {
    w.visible = true;
    writeVisible(w.body, true);
  }

  // The pose names of a walker this frame: the Inspector's umbrella set while its runner has the umbrella open (R9); the crow's folded-wing
  // perch set up to crowPerchPoseToEra (WP27 D5), the POSE_FRAMES set after it.
  private poseNamesOf(w: Walker, era: number): PoseNames {
    if (w.id === 'inspector' && w.run.umbrella) return UMBRELLA_POSE_NAMES;
    if (w.id === 'crow' && era <= WORLD_ERA_ENV.crowPerchPoseToEra) return CROW_PERCH_POSE_NAMES;
    return POSE_FRAMES[w.id];
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
    writeFlip(w.body, flip);
    writePosition(w.body, x, feetY);
    writeAlpha(w.body, pose.alpha);
    writeVisible(w.body, shown);
    // The crossfade: blendRow over the body at pose.blend (its opacity times the pose alpha), hidden without one.
    if (pose.blendRow !== null) {
      paint(w.blend, key, sheetFrameIndex(w.id, frame, pose.blendRow));
      writeFlip(w.blend, flip);
      writePosition(w.blend, x, feetY);
      writeAlpha(w.blend, pose.alpha * pose.blend);
      writeVisible(w.blend, shown && pose.blend > 0);
    } else {
      writeVisible(w.blend, false);
    }
    // The film's shadow is never widened: the state's shadow width (drawWalker) resets here.
    if (w.shadow !== null) {
      setShadowWidth(w.shadow, 1);
      writePosition(w.shadow, x, feetY);
      writeAlpha(w.shadow, filmShadowAlpha(state) * pose.alpha);
      writeVisible(w.shadow, shown && pose.shadow);
    }
  }

  // The girl's lantern ring for this frame (lanternRing): drawn while its span runs and she is shown, in her row just above her body. Reduced
  // motion draws the steady ring; otherwise it grows from r0 to r1 and fades from the peak alpha to 0 over the span.
  private drawLantern(now: number): void {
    const girl = this.girl;
    const ring = this.lantern;
    const t = now - this.lanternStartMs;
    const on = girl.visible && t >= 0 && t < this.lanternSpanMs;
    writeVisible(ring, on);
    if (!on) return;
    if (girl.row !== this.lanternRow) {
      this.lanternRow = girl.row;
      this.rowOf(girl.row).add(ring);
      ring.setDepth(girl.body.depth + POKE_RENDER.lantern.depthStep);
      sortWorldRows(this.rows);
    }
    const p = this.reduced ? 0 : clamp01(t / this.lanternSpanMs);
    const lan = POKE_RENDER.lantern;
    ring.clear();
    ring.lineStyle(lan.width, lan.color, this.reduced ? lan.reducedAlpha : lan.alpha * (1 - p));
    ring.strokeCircle(girl.feetX + lan.dx, girl.feetY + lan.dy, this.reduced ? lan.reducedR : lan.r0 + (lan.r1 - lan.r0) * p);
  }

  // Sensor 7 draw. The head shows the camera side through the follow lag (followHead); the era crossfade runs on the head and the tripod
  // (their twins at alpha k); the readout keeps the from row under its twin, which fades the to row in; the lens fog takes the to row at the
  // midpoint with its alpha through 0 there; the foot dots are the shadow.
  private drawSensor(now: number, cam: CameraPose, state: WorldVisualState, flicker: number, tween: WorldTween, ambient: Ambient): void {
    const s = this.sensor;
    const placement = s.placement;
    if (placement === null) return;
    if (s.turn !== null && !turnActive(s.turn, now)) s.turn = null;
    const script = this.script;
    const pose = script === null ? null : script.cast.sensor7;
    const cross = this.eraCross;
    const row = pose === null ? cross.main : pose.row;
    const shown = pose === null || pose.visible;
    s.visible = shown;
    if (pose !== null) {
      // The film's offset (zero in the film): the parts, the foot dots and the LED follow the same feet point.
      const { ledArt } = WORLD_ENV.sensor7;
      const x = placement.x + pose.dx;
      const y = s.feetY + pose.dy;
      for (const part of [s.tripod, s.tripodBlend, s.head, s.headBlend, s.glyph, s.glyphBlend, s.fog]) writePosition(part, x, y);
      writePosition(s.dots, x, y);
      writePosition(s.led, x + ledArt.x * PIXEL_SCALE, y + ledArt.y * PIXEL_SCALE);
    }
    // The follow runs every frame, so a turn or a blink never leaves it behind.
    const follow = this.followHead(s, placement.x, cam, now);
    const turnName = s.turn !== null ? turnPose(s.turn, now, POSE_FRAMES.sensor7) : null;
    let head: string;
    if (this.snapped) head = POSE_FRAMES.sensor7.front;
    else if (pose !== null) head = pose.frame;
    else if (turnName !== null) head = turnName;
    else if (blinkRunning(s.blinkStart, now)) head = POSE_FRAMES.sensor7.front;
    else {
      const next = sensorHeadFromPointer(this.pointerX, this.pointerMovedMs, now, placement.x, follow, this.pointerHead, this.pointerHeadMs);
      if (next !== this.pointerHead) {
        this.pointerHead = next;
        this.pointerHeadMs = now;
      }
      head = next;
    }
    s.frame = head;
    const key = this.keyOf('sensor7', this.trackOn(s.turn, now));
    const alpha = pose === null ? tween.alpha * flicker : pose.alpha;
    // The head, tripod and readout share this alpha: quantized once.
    const level = alphaLevel(alpha);
    paintFrame(s.head, key, 'sensor7', head, row, s.memo.head);
    paintFrame(s.tripod, key, 'sensor7', 'tripod', row, s.memo.tripod);
    writeAlphaLevel(s.head, level);
    writeVisible(s.head, shown);
    writeAlphaLevel(s.tripod, level);
    writeVisible(s.tripod, shown);
    // The head and tripod crossfades: the film's head blend (blendRow over the head at pose.blend), or the era twins (the to row at k).
    if (pose !== null && pose.blendRow !== null) {
      paintFrame(s.headBlend, key, 'sensor7', head, pose.blendRow, s.memo.headTwin);
      writeAlpha(s.headBlend, alpha * pose.blend);
      writeVisible(s.headBlend, shown && pose.blend > 0);
      writeVisible(s.tripodBlend, false);
    } else if (pose === null && cross.k > 0) {
      paintFrame(s.headBlend, key, 'sensor7', head, cross.twin, s.memo.headTwin);
      writeAlpha(s.headBlend, alpha * cross.k);
      writeVisible(s.headBlend, true);
      paintFrame(s.tripodBlend, key, 'sensor7', 'tripod', cross.twin, s.memo.tripodTwin);
      writeAlpha(s.tripodBlend, alpha * cross.k);
      writeVisible(s.tripodBlend, true);
    } else {
      writeVisible(s.headBlend, false);
      writeVisible(s.tripodBlend, false);
    }
    // The readout: the film's glyph, or the state's readout at 'stage'. Through the era crossfade the glyph keeps the from row and the
    // glyph twin fades the to row in over it (alpha k), as the head and tripod do: no instant row swap.
    const glyph = script === null ? 'stage' : script.props.sensorGlyph;
    const readout = glyph === 'stage' ? state.sensor.readout : glyph;
    const glyphName = readout === 'one' ? 'glyphOne' : 'glyphDash';
    paintFrame(s.glyph, key, 'sensor7', glyphName, row, s.memo.glyph);
    writeAlphaLevel(s.glyph, level);
    writeVisible(s.glyph, shown);
    const glyphCross = pose === null && cross.k > 0;
    if (glyphCross) {
      paintFrame(s.glyphBlend, key, 'sensor7', glyphName, cross.twin, s.memo.glyphTwin);
      writeAlpha(s.glyphBlend, alpha * cross.k);
    }
    writeVisible(s.glyphBlend, glyphCross);
    // The lens fog (era III with vents): alpha tween.sensorFog over the head; the film has none. Through the era crossfade the fog takes the
    // from row below the midpoint and the to row from it, with its alpha scaled by |1 - 2k|: the row swap happens at alpha 0.
    const fogCross = pose === null && cross.k > 0;
    const fog = pose === null ? tween.sensorFog * (fogCross ? Math.abs(1 - 2 * cross.k) : 1) : 0;
    const fogRow = fogCross && cross.k >= CROSS_MIDPOINT ? cross.twin : row;
    paintFrame(s.fog, key, 'sensor7', 'fog', fogRow, s.memo.fog);
    writeAlpha(s.fog, fog);
    writeVisible(s.fog, fog > 0);
    // The foot dots are the shadow: the film's shadow flag, else the presented shadow (alpha) shifted by shadowDx.
    if (pose !== null) {
      writeVisible(s.dots, shown && pose.shadow);
      writeAlpha(s.dots, filmShadowAlpha(state) * pose.alpha);
    } else {
      const dotsAlpha = WORLD_PLAYBACK.shadowAlpha * tween.shadowScale * tween.shadows;
      writePosition(s.dots, placement.x + ambient.shadowDx, s.feetY);
      writeAlpha(s.dots, dotsAlpha);
      writeVisible(s.dots, dotsAlpha > 0);
    }
    writeVisible(s.led, shown);
    // The LED: the film's colour (dead dim, green) or the state colour at 'stage'.
    const sensorLed = script === null ? 'stage' : script.props.sensorLed;
    let colour: number;
    if (sensorLed === 'dead') {
      colour = LED_DIM;
      s.ledFrame = 'dark';
      s.ledAlpha = 1;
    } else if (sensorLed === 'green') {
      colour = WORLD_ENV.sensor7.ledColors.green;
      s.ledFrame = 'green';
      s.ledAlpha = 1;
    } else {
      colour = this.ledStateColour(s, state, ambient, tween, now);
    }
    if (colour !== s.ledColor) {
      s.led.setFillStyle(colour);
      s.ledColor = colour;
    }
  }

  // The Sensor 7 head's camera side through the lag: the target changes at once in the state, the shown frame only once the target has
  // been stable for WORLD_AMBIENT.sensorLagMs (reduced motion snaps).
  private followHead(s: Sensor, sensorX: number, cam: CameraPose, now: number): SensorHead {
    const target = sensorHead(sensorX, cam.centerX);
    if (target !== s.followTarget) {
      s.followTarget = target;
      s.followSince = now;
    }
    if (this.reduced || now - s.followSince >= WORLD_AMBIENT.sensorLagMs) s.followShown = target;
    return s.followShown;
  }

  // The state LED colour and its sensorRows frame. Dark (LED_DIM) while the era I micro blink, the double blink, the heartbeat low or
  // the downbeat pulse runs; else the presented red-to-amber crossfade (tween.led); dimmed to a mix with LED_DIM while the reading dip
  // runs (never off; the row alpha is the dim factor).
  private ledStateColour(s: Sensor, state: WorldVisualState, ambient: Ambient, tween: WorldTween, now: number): number {
    // Sensor 7's answer lights (sensorLed, WP28a) hold over the state: the solid red one (the blink schedule is off meanwhile), then the glint amber.
    if (now < this.ledUntil.solid || now < this.ledUntil.glint) {
      const solid = now < this.ledUntil.solid;
      s.ledFrame = solid ? 'red' : 'amber';
      s.ledAlpha = 1;
      return solid ? WORLD_ENV.sensor7.ledColors.red : WORLD_ENV.sensor7.ledColors.amber;
    }
    const low = this.heartbeatLow(now);
    if (ambient.micro.ledBlink || blinkDark(s.blinkStart, now) || low || (state.sensor.pulse && this.beatNow)) {
      s.ledFrame = 'dark';
      s.ledAlpha = 1;
      return LED_DIM;
    }
    const { ledColors } = WORLD_ENV.sensor7;
    const { from, to, k } = tween.led;
    const level = clamp01(from + (to - from) * k);
    const base = mixRgb(ledColors.red, ledColors.amber, level);
    s.ledFrame = LED_FRAMES[Math.round(level)] ?? 'red';
    if (!ambient.micro.ledDim) {
      s.ledAlpha = 1;
      return base;
    }
    s.ledAlpha = WORLD_AMBIENT.dipFactor;
    return mixRgb(base, LED_DIM, 1 - WORLD_AMBIENT.dipFactor);
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

  // Lift of the body above its feet, world px: the runner's rise (its unison beat; none under reduced motion), the era IV ripple rise and,
  // for the perched crow in era IV, its static hover. Shadows stay on the ground. The crow's spread-wing glitch (frozen / frozenTip in the
  // perched eras, WP27 F5.3) pops crowHoverPx and lands, never under reduced motion; the cycle 2+ tipTry high pose lifts its body (tipHigh).
  private bobOf(w: Walker, state: WorldVisualState, now: number, rise: number, tipHigh: boolean): number {
    let bob = (this.reduced ? 0 : rise) + (now < this.riseUntilMs ? WORLD_ERA_ENV.riseWorldPx : 0);
    if (w.id === 'crow' && state.era <= WORLD_ERA_ENV.crowPerchPoseToEra && (w.frame === 'frozen' || w.frame === 'frozenTip') && !this.reduced) {
      bob += WORLD_ERA_ENV.crowHoverPx * PIXEL_SCALE;
    }
    if (w.id === 'crow' && state.era === WORLD_ERA_ENV.downbeatEra) {
      bob += WORLD_ERA_ENV.crowHoverPx * PIXEL_SCALE;
    }
    if (tipHigh) bob += CROW_HIGH_LIFT_WORLD_PX;
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
    this.timings.record(ms);
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
