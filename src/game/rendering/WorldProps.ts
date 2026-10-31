// Living-world environment renderer (WP23a, WP24 T7a1, T7a2): the girl's window and mini on the far planes, the six lit skyline windows with their
// halo, the street lamp with its glow and ash motes, the payphone booth with its receiver and tally marks, the street clock with its hands
// (the minute hand twitches), the dog's stake and hole, and three paper scraps (DENIZEN_ART §1.4, §2.4, §2.5, §5; bible §4.1).
// Why: the simulation decides what shows (WorldVisualState and the placements) and the transition queue decides how it changes (the
// WorldTween and the Ambient of the clocks); this file only draws them, on two far-plane containers and the shared back and front rows.
// A crossfade (lamp, booth, receiver, hole, puddle, sprout) runs on a twin sprite created once beside its prop; the fog has its own layer.
// Pools only: everything is built once in the constructor, the tally canvas is redrawn in place, setInteractive is never called, and
// colours come from data or the palette. Reduced motion per bible §7.7. While a script drives the props (finale, postgame) they keep the script drawing and ignore the tween.
// Units: art px * PIXEL_SCALE = world px. Motes and the lamp head use art px. hopPx and jerkPx are world px (2 = the bible's "1 px"
// at PIXEL_SCALE 2).
import type Phaser from 'phaser';
import type { Vec2 } from '../../data/machineComponents';
import { PALETTE } from '../../data/palette';
import { POKE_RENDER, POKES } from '../../data/pokes';
import { SPLICE_CLOCK, SPLICE_FX } from '../../data/spliceWorld';
import { GROUND_Y, MACHINE_ANCHOR, PIXEL_SCALE, VIEW } from '../../data/world';
import { WORLD_AMBIENT } from '../../data/worldDay';
import type { MicroFlags } from '../../data/worldDay';
import {
  WORLD_DEPTH_OFFSETS, WORLD_ENV, WORLD_ERA_ROW, WORLD_FAR_PLANES, WORLD_FRAMES, WORLD_HOLE, WORLD_LOOPS, WORLD_MARKS, WORLD_ROWS,
  WORLD_SHEET_KEYS,
} from '../../data/livingWorld';
import type { FramingKey, GroundId, WorldPlacement, WorldSheetId } from '../../data/livingWorld';
import { WORLD_ERA_ENV, WORLD_PUDDLE } from '../../data/worldEras';
import { WORLD_FX } from '../../data/worldFx';
import { WORLD_TRANSITIONS } from '../../data/worldTransitions';
import type { CameraPose } from '../math/finale';
import { hash01 } from '../math/worldBehaviour';
import type { BehaviourFrame } from '../math/worldBehaviour';
import { moteOrbit } from '../math/worldDay';
import type { Ambient } from '../math/worldDay';
import { humOffsetPx, lampWobbleAt, pebbleCount, puddleRingGapMs } from '../math/worldFx';
import { screenOfWorld } from '../math/worldPlacement';
import type { SpeakerAnchor } from '../math/worldPlacement';
import { createTapeClock, isDownbeat, loopFrameAt, sheetFrameIndex, tallyRects, windowFlicker } from '../math/worldPlayback';
import type { PlaybackMode, TapeClock } from '../math/worldPlayback';
import type { Blend, WorldTween } from '../math/worldTransitions';
import type { WorldVisualState } from '../math/worldState';
import type { PropScript, WorldScriptFrame } from '../math/worldScript';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';
import { TimingRing, clamp01, crossInto } from './LivingWorld';

type Visible = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;
// A shown object with alpha: the setAlphaIf writes compare against it.
type Faded = Visible & { alpha: number; setAlpha(value?: number): unknown };
type Placements = Readonly<Record<GroundId, WorldPlacement | null>>;
type FlickerFrame = 'flickerA' | 'flickerB';
// A sprite that remembers the frame it last showed (setFrame): an unchanged frame costs two property reads, no lookup.
type FrameCached = Phaser.GameObjects.Sprite & { shownName?: string; shownRow?: number };

// Canvas texture of the booth's tally marks: drawn into the pane, removed on destroy.
const MARKS_KEY = 'world.payphone#marks';
// Update durations kept for stats().meanMs.
const STAT_SAMPLES = 120;
// Upper bound on flicker holds consumed in one update (a hold is at least WORLD_ENV.windowFlickerMs[0] long).
const FLICKER_CATCHUP_MAX = 64;
// Second-hand repaint threshold in degrees: the hands are redrawn only when the second hand has turned this far (render throttle).
const HAND_REDRAW_DEG = 1;
// The clock hands sit above the Splice lit face (SpliceProps' overlay at + 0.005 over the clock sprite; WP28a C6).
const CLOCK_HANDS_DEPTH = 0.01;
// A window, the glow or a twin shows above this presented alpha (a render epsilon, not a balance number).
const SHOWN_ALPHA = 0.01;
// The 8-bit alpha maximum (0xff): alpha is compared on its 1/255 grid, the finest step a frame shows (structural, as CHANNEL_MAX in worldDay).
const ALPHA_MAX = 0xff;
// Halo redraw step: a window level that moved less than one 8-bit step (1/255) since the last halo draw is not redrawn (a render epsilon).
const LEVEL_STEP = 1 / ALPHA_MAX;
// Frame names by blend index: the lamp (dead, lit, warm; restored is script only) and the booth hood (dark, lit).
const LAMP_STATES: readonly string[] = ['dead', 'lit', 'warm'];
const BOOTH_HOOD: readonly string[] = ['dark', 'lit'];
// Structural values, not tuning: the identity tint, the two halves of a scrap burn (ember, then char and fade), a full turn, and the cache
// value of a scrap tint before its first write.
const NO_TINT = 0xffffff;
const BURN_SPLIT = 0.5;
const TWO_PI = 2 * Math.PI;
const UNSET_TINT = -1;
// Index of the receiver's 'level' frame in WORLD_FRAMES.receiver (hang, swing0-2, level, onHook): the era V rise climbs from hang to it.
const RECEIVER_LEVEL = WORLD_FRAMES.receiver.indexOf('level');
// WP28b: the extra pebbles of era I, one slot per feet position (WORLD_FX.pebbles.feetArtPx); ms per second for the hop clock.
const PEBBLE_SLOTS = WORLD_FX.pebbles.feetArtPx.length;
const MS_PER_S = 1000;
// The payphone's answers (WP28a T15b1, C4): a receiver step (silent in era I), one ring burst with a swing, or the hood blinks.
export type PayphoneAnswer = 'sway' | 'ring' | 'hoodBlink';
// Length of the hood blink answer: each blink is lit, then dark, for hoodBlinkMs.
const HOOD_TOTAL_MS = 2 * POKE_RENDER.hoodBlinks * POKE_RENDER.hoodBlinkMs;
// Frame names built once: the hole stages (stage0 .. stage maxStage) and the paper scraps (scrap0 ..), so a frame allocates no name.
const HOLE_NAMES: readonly string[] = Array.from({ length: WORLD_HOLE.maxStage + 1 }, (_, i) => `stage${i}`);
const SCRAP_NAMES: readonly string[] = Array.from({ length: WORLD_FRAMES.scraps.length }, (_, i) => `scrap${i}`);

// One prop row of props(): the frame, the presented alpha and the rounded world position (all 0 when hidden). Rows are reused.
interface PropRow { id: string; frame: string; alpha: number; x: number; y: number }

// A crossfade read from its Blend: main = the from value (the to value once settled), twin = the to value at alpha k while the crossfade
// runs (k 0 = no twin). A stutter (k toggles between 0 and 1) never shows a twin. Each call site reads into its own scratch (CROSS_*).
interface Cross { main: number; twin: number; k: number }
const CROSS_LAMP: Cross = { main: 0, twin: 0, k: 0 };
const CROSS_BOOTH_ERA: Cross = { main: 0, twin: 0, k: 0 };
const CROSS_HOOD: Cross = { main: 0, twin: 0, k: 0 };
const CROSS_RECEIVER_ERA: Cross = { main: 0, twin: 0, k: 0 };

// CSS colour of a 0xRRGGBB number (the same form as PALETTE_CSS).
function cssOf(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

// Frame name of a blend index: rounded and clamped into the list (a non-finite index reads the first name).
function nameAt(names: readonly string[], i: number): string {
  const at = Number.isFinite(i) ? Math.min(names.length - 1, Math.max(0, Math.round(i))) : 0;
  return names[at] ?? '';
}

// Reads a Blend into the caller's scratch: the three cases of the crossfade (settled, from, running).
function crossOf(b: Blend, out: Cross): Cross {
  crossInto(out, b);
  return out;
}

// Dip factor of a micro flag: WORLD_AMBIENT.dipFactor while the flag is on, 1 otherwise (micro null = scripted: no dips).
function dipOf(micro: MicroFlags | null, flag: 'lampDip' | 'boothDip' | 'girlWindowDim'): number {
  return micro !== null && micro[flag] ? WORLD_AMBIENT.dipFactor : 1;
}

// Receiver swing amplitude in frame steps: wind x maxSteps, rounded and kept in 1..maxSteps (never below one step).
function swingAmpOf(wind: number): number {
  const { maxSteps } = WORLD_AMBIENT.receiver;
  const w = Number.isFinite(wind) ? wind : 0;
  return Math.min(maxSteps, Math.max(1, Math.round(w * maxSteps)));
}

// Receiver swing period of one cycle: WORLD_AMBIENT.receiver.periodMs, drawn by hash from the cycle counter.
function swingPeriodOf(cycle: number): number {
  const [lo, hi] = WORLD_AMBIENT.receiver.periodMs;
  return lo + (hi - lo) * hash01(cycle, 0);
}

// Fills a reused prop row from a sprite: its frame name, presented alpha and rounded world position (0 when hidden or not live).
function fillRow(row: PropRow, s: Phaser.GameObjects.Sprite, frame: string, live: boolean): void {
  const shown = live && s.visible;
  row.frame = frame;
  row.alpha = shown ? s.alpha : 0;
  row.x = shown ? Math.round(s.x) : 0;
  row.y = shown ? Math.round(s.y) : 0;
}

// The layer a crossfade reports: the visible twin when it has the higher alpha (or the main layer is hidden), else the main sprite.
function topOf(main: Phaser.GameObjects.Sprite, twin: Phaser.GameObjects.Sprite): Phaser.GameObjects.Sprite {
  return twin.visible && (!main.visible || twin.alpha > main.alpha) ? twin : main;
}

// Writes that skip an unchanged value (a Phaser setter costs a call even when it sets the same value). Alpha is compared on the 8-bit grid:
// a change under 1/255 is not written (the GPU cannot show it), so the sprite keeps the last alpha it was given.
function setAlphaIf(s: Faded, alpha: number): void {
  const a = clamp01(alpha);
  if (Math.round(s.alpha * ALPHA_MAX) !== Math.round(a * ALPHA_MAX)) s.setAlpha(a);
}

// A preallocated list of unset numbers (NaN): the row checks compare their last values against it, so the first paint always writes.
function unsetList(n: number): number[] {
  return Array.from({ length: n }, () => NaN);
}

function setVisibleIf(s: Visible, on: boolean): void {
  if (s.visible !== on) s.setVisible(on);
}

function setPositionIf(s: Phaser.GameObjects.Sprite, x: number, y: number): void {
  if (s.x !== x || s.y !== y) s.setPosition(x, y);
}

// Feet y of a ground placement: its row's feet line plus the placement's dy (the fallen lantern lies at the girl's feet, AD3d H3).
function feetOf(p: WorldPlacement): number {
  return WORLD_ROWS[p.row].y + (p.dy ?? 0);
}

// Mains flicker multiplier (DENIZEN_ART §5): era II only and never under reduced motion (bible §7.7); 1 otherwise. The clock is the clocks'
// mains clock (Ambient.mainsMs), which holds through the tape freeze (A10).
function mainsOf(era: number, reduced: boolean, clockMs: number): number {
  if (era < 2 || reduced) return 1;
  const { amp, periodMs } = WORLD_ENV.mainsFlicker;
  return 1 + amp * Math.sin((2 * Math.PI * clockMs) / periodMs);
}

// State level of the six lit windows (the queue's target; the script's drawing uses it directly): lit with powerLines, dim while only the
// generator is owned (the era II entry), off in era I.
function windowTargetOf(windows: WorldVisualState['props']['windows']): number {
  return windows === 'lit' ? 1 : windows === 'dim' ? WORLD_ENV.windowDimLevel : 0;
}

// Length of one ring: its bursts with the gaps between them.
function ringTotalMs(): number {
  const { bursts, burstMs, gapMs } = WORLD_ENV.ring;
  return (bursts - 1) * (burstMs + gapMs) + burstMs;
}

// Ring phase at ms since the ring started: 0 / 1 = burst frame ring0 / ring1 (each half a burst), -1 = between bursts or idle.
function ringPhaseAt(ms: number): -1 | 0 | 1 {
  if (ms < 0) return -1;
  const { bursts, burstMs, gapMs } = WORLD_ENV.ring;
  const period = burstMs + gapMs;
  const b = Math.floor(ms / period);
  const within = ms - b * period;
  if (b >= bursts || within >= burstMs) return -1;
  return Math.floor(within / (burstMs / 2)) % 2 === 0 ? 0 : 1;
}

// Clock hand tip from the face centre: angle in degrees clockwise from twelve, length in world px.
function handTip(c: Vec2, deg: number, lenPx: number): Vec2 {
  const rad = (deg * Math.PI) / 180;
  return { x: c.x + lenPx * Math.sin(rad), y: c.y - lenPx * Math.cos(rad) };
}

// True when the second-hand angle moved by HAND_REDRAW_DEG or more, or appeared / went (null = no second hand).
function turned(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a !== b;
  return Math.abs(a - b) >= HAND_REDRAW_DEG;
}

// Puddle sheet frame for a size and a look: (size - 1) * sizeStride + look (WORLD_PUDDLE); undefined at size 0 (hidden).
function puddleFrameOf(size: number, look: number): string | undefined {
  return size > 0 ? WORLD_FRAMES.puddle[(size - 1) * WORLD_PUDDLE.sizeStride + look] : undefined;
}

// Hole frame of a dug stage (rounded; WORLD_HOLE clamps the top): undefined below minStage, before the dog has dug.
function holeNameOf(stage: number): string | undefined {
  const s = Number.isFinite(stage) ? Math.round(stage) : 0;
  if (s < WORLD_HOLE.minStage) return undefined;
  return HOLE_NAMES[Math.min(WORLD_HOLE.maxStage, s)];
}

// Sprout frame of a stage (1-4 are the white stages; 0 = none): undefined when hidden.
function sproutNameOf(stage: number): string | undefined {
  const s = Number.isFinite(stage) ? Math.round(stage) : 0;
  return s < 1 ? undefined : WORLD_FRAMES.sprout[s - 1];
}

// Channel mix of two 0xRRGGBB colours at t (0 = a, 1 = b, clamped): the scrap burn ramps its tint without a step.
function mixRgb(a: number, b: number, t: number): number {
  const k = clamp01(t);
  let out = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    out |= Math.round(x + (y - x) * k) << shift;
  }
  return out;
}

// Span of a girl answer in ms (a non-finite or negative span is 0). Reduced motion holds a window dark or flickering for POKES.reducedHoldMs at most.
function girlSpanOf(ms: number, reduced: boolean): number {
  const span = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  return reduced ? Math.min(span, POKES.reducedHoldMs) : span;
}

// Hop lift (art px, whole) of a machine pebble at tMs: a half sine at hz, so it lifts on every other half cycle; amp at its top (WP28b).
function pebbleLiftArt(tMs: number, hz: number, amp: number, phase01: number): number {
  return Math.round(amp * Math.max(0, Math.sin(TWO_PI * ((hz * tMs) / MS_PER_S + phase01))));
}

// Sets a sprite's x only when it changes: the era IV hum writes every paint, and most paints move nothing.
function setXIf(s: { x: number }, x: number): void {
  if (s.x !== x) s.x = x;
}

// Screen px of a world point: the screenOfWorld maths (worldPlacement.ts), written into out so the anchors allocate nothing.
function screenInto(out: Vec2, x: number, y: number, sf: number, cam: CameraPose): void {
  out.x = (x - sf * (cam.centerX - VIEW.width / 2) - VIEW.width / 2) * cam.zoom + VIEW.width / 2;
  out.y = (y - sf * (cam.centerY - VIEW.height / 2) - VIEW.height / 2) * cam.zoom + VIEW.height / 2;
}

// Environment props of eras I-V. One instance per scene; the director calls apply() with each visual state and placement set,
// update() every frame, and hideAll() when the layer is off. setScript(frame) drives the finale and postgame props (WP23b).
export class WorldProps {
  private readonly scene: Phaser.Scene;
  private readonly beatLow: (nowMs: number) => boolean;
  private readonly owned: Visible[] = [];
  private readonly farWindow: Phaser.GameObjects.Container;
  private readonly farPylon: Phaser.GameObjects.Container;
  private readonly halo: Phaser.GameObjects.Graphics;
  private readonly windowSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly girlWindow: Phaser.GameObjects.Sprite;
  private readonly girlMini: Phaser.GameObjects.Sprite;
  private readonly girlMiniNear: Phaser.GameObjects.Sprite;
  private readonly puddle: Phaser.GameObjects.Sprite;
  private readonly puddleTwin: Phaser.GameObjects.Sprite;
  private readonly sprout: Phaser.GameObjects.Sprite;
  private readonly sproutTwin: Phaser.GameObjects.Sprite;
  private readonly lantern: Phaser.GameObjects.Sprite;
  private readonly lamp: Phaser.GameObjects.Sprite;
  private readonly lampTwin: Phaser.GameObjects.Sprite;
  private readonly lampGlow: Phaser.GameObjects.Sprite;
  private readonly motes: Phaser.GameObjects.Sprite[] = [];
  private readonly booth: Phaser.GameObjects.Sprite;
  private readonly boothTwin: Phaser.GameObjects.Sprite;
  private readonly boothFogLayer: Phaser.GameObjects.Sprite;
  private readonly receiver: Phaser.GameObjects.Sprite;
  private readonly receiverTwin: Phaser.GameObjects.Sprite;
  private readonly marks: Phaser.GameObjects.Image;
  private readonly marksTexture: Phaser.Textures.CanvasTexture;
  private readonly clock: Phaser.GameObjects.Sprite;
  private readonly hands: Phaser.GameObjects.Graphics;
  private readonly stake: Phaser.GameObjects.Sprite;
  private readonly hole: Phaser.GameObjects.Sprite;
  private readonly holeTwin: Phaser.GameObjects.Sprite;
  private readonly scraps: Phaser.GameObjects.Sprite[] = [];
  // Each scrap's base point (null when it has none) and the tint it last showed (UNSET_TINT before the first write).
  private readonly scrapAt: (Vec2 | null)[] = [];
  private readonly scrapTint: number[] = [];
  private readonly pebbles: Phaser.GameObjects.Graphics;
  // WP28b: the extra era I pebbles on the machine's feet (their own Graphics, so the booth pebbles keep their redraw rule).
  private readonly machinePebbles: Phaser.GameObjects.Graphics;
  private readonly propGlow: PropRow = { id: 'lampGlow', frame: '', alpha: 0, x: 0, y: 0 };
  private readonly propHood: PropRow = { id: 'boothHood', frame: '', alpha: 0, x: 0, y: 0 };
  private readonly propWindows: PropRow[] = [];
  private readonly propMotes: PropRow[] = [];
  private readonly propScraps: PropRow[] = [];
  private readonly propSprout: PropRow = { id: 'sprout', frame: '', alpha: 0, x: 0, y: 0 };
  private readonly propClock: PropRow = { id: 'clockMinute', frame: 'rest', alpha: 0, x: 0, y: 0 };
  private readonly propRows: PropRow[] = [];
  private readonly tape: TapeClock = createTapeClock();
  private readonly timings = new TimingRing(STAT_SAMPLES);

  // Row checks (WP24 r3): the values each row wrote last (NaN = none yet), so unchanged values skip their writes. stale: the sprites may not
  // hold the last paint (a hide, a repaint of a new state, placement, script or reduced flag); the next paint writes every row and clears it.
  private stale = true;
  private readonly lastWinAlpha = unsetList(WORLD_FAR_PLANES.windows.length);
  private lastWinBreathe = false;
  private lastLampMain = NaN;
  private lastLampTwin = NaN;
  private lastLampK = NaN;
  private lastLampGlow = NaN;
  private lastLampOn = false;
  private lastLampWarm = false;
  private lastSway = NaN;
  private lastSproutFrom = NaN;
  private lastSproutTo = NaN;
  private lastSproutK = NaN;
  private lastHoleFrom = NaN;
  private lastHoleTo = NaN;
  private lastHoleK = NaN;
  private readonly lastScrapBurn = unsetList(WORLD_FRAMES.scraps.length);
  private readonly lastScrapDx = unsetList(WORLD_FRAMES.scraps.length);
  private readonly lastScrapLift = unsetList(WORLD_FRAMES.scraps.length);
  private readonly lastMoteFall = unsetList(WORLD_ENV.motes.count);
  private readonly lastMoteAlpha = unsetList(WORLD_ENV.motes.count);

  private state: WorldVisualState | null = null;
  // The transition tween and the ambient of the last update() (null until the first one); the girl runner frame (read by the mini planes).
  private tween: WorldTween | null = null;
  private ambient: Ambient | null = null;
  private girl: BehaviourFrame | null = null;
  private reduced = false;
  private live = false;
  private nowMs = 0;
  private flickerK = 0;
  // The hold and the frame of the counter flickerReadK (the constructor reads counter 0): windowFlicker runs only when the counter moved.
  private flickerReadK = 0;
  private flickerHoldMs = windowFlicker(0, WORLD_ENV.windowFlickerSeed).holdMs;
  private flickerLeftMs = this.flickerHoldMs;
  private flickerFrame: FlickerFrame = windowFlicker(0, WORLD_ENV.windowFlickerSeed).frame;
  private mainsMul = 1;
  private ringMs = -1;
  private glowBumpMs = 0;
  private pebbleHop = false;
  private pebblesX: number | null = null;
  private pebblesLift = 0;
  // WP28b (D6): the era energy's reach level (setReach) and what it drives. lampWobble is the glow offset, resampled at wobbleAtMs (NaN = never)
  // every WORLD_FX.lampWobble.stepMs. The machine pebbles drew machineShown extras (-1 = none) at the lifts in machineLift (art px, NaN = none).
  // humBooth is the booth family's hum offset (world px) of this paint; clockOrigin is where the hands draw (the clock moved by its hum).
  // puddleNextMs is the next era IV puddle ring (NaN = off), puddleRingK its count.
  private reachLevel = 0;
  private lampWobble = 0;
  private wobbleAtMs = Number.NaN;
  private machineShown = -1;
  private readonly machineLift: number[] = unsetList(PEBBLE_SLOTS);
  private humBooth = 0;
  private readonly clockOrigin: Vec2 = { x: 0, y: 0 };
  private puddleNextMs = Number.NaN;
  private puddleRingK = 0;
  // Ticks the scripted receiver loop has gained from the era I ripples (the tape loop; the state and script keep it).
  private extraTicks = 0;
  // The receiver swing: the cycle position 0..1, the cycle counter and its period, and the ripple steps not yet swung.
  private swingPhase = 0;
  private swingCycle = 0;
  private swingPeriodMs = swingPeriodOf(0);
  private swingKick = 0;
  private receiverOn = false;
  private marksDrawn = -1;
  private marksFogDrawn = false;
  private handsAt: Vec2 | null = null;
  private handsSec: number | null = null;
  private handsTwitch = false;
  private boothAt: Vec2 | null = null;
  private lampHead: Vec2 | null = null;
  // Downbeat accents (era IV) and their timers: window breathe, lamp pulse, puddle ring. Off under reduced motion.
  private beatPrev = false;
  private breatheMs = 0;
  private pulseMs = 0;
  private puddleRingMs = 0;
  // Halo (WP24 AD2 F1): each window's presented level without the mains flicker, written every paint, and the levels of the last halo draw
  // (NaN = none yet). The halo redraws only when a level moved by LEVEL_STEP or more.
  private readonly haloLevels = unsetList(WORLD_FAR_PLANES.windows.length);
  private readonly haloDrawn = unsetList(WORLD_FAR_PLANES.windows.length);
  // Mote orbit clock (ms): advances at the rate the motes still move; frozen by the queue's freeze off script, full rate on script.
  // Static under reduced motion.
  private orbitMs = 0;
  // The orbit solved at orbitTime (NaN = none yet): one {dx, dy} per mote, re-solved only when the clock moved (a freeze or reduced motion holds it).
  private orbitTime = NaN;
  private readonly orbits: { dx: number; dy: number }[] = [];
  // Base points of the ground pieces from the placements (feet dyWorldPx down for the puddle and the sprout); null when not placed.
  private holeAt: Vec2 | null = null;
  private puddleAt: Vec2 | null = null;
  private sproutAt: Vec2 | null = null;
  // Script (WP23b): the finale prop states (null = the state drawing), the last placements, the clock feet and the second hand drawn.
  private propScript: PropScript | null = null;
  private placements: Placements | null = null;
  private clockAt: Vec2 | null = null;
  // The woken street clock (WP28a C6, setSpliceClock): clockWoken holds the minute hand (no twitch); clockTickDeg is the tick hand (null: none).
  private clockWoken = false;
  private clockTickDeg: number | null = null;
  // Poke answers (T15b1): the minute twitch and the tick step of the clock, the hood blinks (hoodMs, -1 idle), the ring's span and whether the
  // one-burst ring is held (reduced motion). Each counts down in update().
  private clockTwitchMs = 0;
  private clockTickPokeMs = 0;
  private hoodMs = -1;
  private ringSpanMs = 0;
  private ringHeld = false;
  // The hood as a settled blend while a blink runs (rewritten each frame; paintBooth reads it in place of the tween's hood).
  private readonly hoodBlend: Blend = { from: 0, to: 0, k: 0 };
  // The girl answers (AD2 F11): the window's dark and flicker spans and the mini's fade (ms left, its span, its target alpha). Counted down in
  // update(); hideAll() cancels them.
  private girlDarkMs = 0;
  private girlFlickMs = 0;
  private girlFlickFrame: FlickerFrame = 'flickerB'; // the other flicker frame, fixed when the answer starts
  // What the window last drew (paintGirlWindow; probe() reports it): the dark frame, and the other flicker frame of an answer (WP28a r2).
  private shownDark = false;
  private shownAlt = false;
  private miniMs = 0;
  private miniSpanMs = 0;
  private miniTo = 1;

  constructor(scene: Phaser.Scene, rows: WorldRows, beatLow: (nowMs: number) => boolean = () => false) {
    this.scene = scene;
    this.beatLow = beatLow;
    const far = WORLD_FAR_PLANES;

    // Far planes: one scroll-factor container each. Children ignore their own scroll factor, so it is set on the container.
    this.farWindow = scene.add.container(0, 0).setScrollFactor(far.window.sf).setDepth(far.window.depth);
    this.farPylon = scene.add.container(0, 0).setScrollFactor(far.pylon.sf).setDepth(far.pylon.depth);
    this.owned.push(this.farWindow, this.farPylon);

    // The halo is one Graphics added before the windows, so it draws behind them; paintHalo() fills it per window level.
    this.halo = this.graphicsIn(this.farWindow, 0);

    // Six lit windows: the 4x6 frame cropped to each window's art size (3x6, 4x6 and 2x4 entries).
    for (const w of far.windows) {
      const sprite = this.spriteIn(this.farWindow, 'windowLit', 0, 0, 0);
      sprite.setPosition(far.window.tileOriginX + PIXEL_SCALE * w.artX, far.window.tileTopY + PIXEL_SCALE * w.artY);
      sprite.setCrop(0, 0, w.w, w.h);
      this.windowSprites.push(sprite);
    }
    for (let i = 0; i < this.windowSprites.length; i++) {
      this.propWindows.push({ id: `window${i}`, frame: '', alpha: 0, x: 0, y: 0 });
    }
    this.girlWindow = this.spriteIn(this.farWindow, 'girlWindow', 0, 0, 0);
    this.girlWindow.setPosition(
      far.window.tileOriginX + PIXEL_SCALE * far.girlWindow.artX,
      far.window.tileTopY + PIXEL_SCALE * far.girlWindow.artY,
    );
    this.girlWindow.setAlpha(WORLD_ENV.windowAlpha);

    this.girlMini = this.spriteIn(this.farPylon, 'girlMini', 0.5, 1, 0);
    this.girlMini.setPosition(
      far.pylon.tileOriginX + PIXEL_SCALE * far.girlMini.footArtX,
      far.pylon.tileTopY + PIXEL_SCALE * far.girlMini.footArtY,
    );
    // Near pylon (era III girl, miniNear): the same sheet on the pylon plane, in the tile instance left of the machine.
    this.girlMiniNear = this.spriteIn(this.farPylon, 'girlMini', 0.5, 1, 0);
    this.girlMiniNear.setPosition(
      far.girlMiniNear.tileOriginX + PIXEL_SCALE * far.girlMiniNear.footArtX,
      far.pylon.tileTopY + PIXEL_SCALE * far.girlMiniNear.footArtY,
    );

    // Ground props: back row unless the data puts them on the front row (stake, hole and the fallen lantern).
    const back = rows.back;
    const front = rows.front;
    this.puddle = this.spriteIn(back, 'puddle', 0.5, 1, WORLD_DEPTH_OFFSETS.scraps);
    this.puddleTwin = this.spriteIn(back, 'puddle', 0.5, 1, WORLD_DEPTH_OFFSETS.scraps);
    this.sprout = this.spriteIn(back, 'sprout', 0.5, 1, WORLD_DEPTH_OFFSETS.scraps);
    this.sproutTwin = this.spriteIn(back, 'sprout', 0.5, 1, WORLD_DEPTH_OFFSETS.scraps);
    // The lantern stays hidden until the script drops it; the front row lets it lie at the girl's feet (its placement dy).
    this.lantern = this.spriteIn(front, 'lantern', 0.5, 1, WORLD_DEPTH_OFFSETS.lamp);
    this.lamp = this.spriteIn(back, 'lamp', 0.5, 1, WORLD_DEPTH_OFFSETS.lamp);
    this.lampTwin = this.spriteIn(back, 'lamp', 0.5, 1, WORLD_DEPTH_OFFSETS.lamp);
    this.lampGlow = this.spriteIn(back, 'lampGlow', 0.5, 0.5, WORLD_DEPTH_OFFSETS.glow);
    for (let i = 0; i < WORLD_ENV.motes.count; i++) {
      this.motes.push(this.spriteIn(back, 'mote', 0.5, 0.5, WORLD_DEPTH_OFFSETS.motes));
      this.propMotes.push({ id: `mote${i}`, frame: '', alpha: 0, x: 0, y: 0 });
    }
    this.booth = this.spriteIn(back, 'payphone', 0.5, 1, WORLD_DEPTH_OFFSETS.booth);
    this.boothTwin = this.spriteIn(back, 'payphone', 0.5, 1, WORLD_DEPTH_OFFSETS.booth);
    this.boothFogLayer = this.spriteIn(back, 'payphone', 0.5, 1, WORLD_DEPTH_OFFSETS.booth);
    this.receiver = this.spriteIn(back, 'receiver', 0.5, 0, WORLD_DEPTH_OFFSETS.receiver);
    this.receiverTwin = this.spriteIn(back, 'receiver', 0.5, 0, WORLD_DEPTH_OFFSETS.receiver);

    // Tally marks: a canvas the size of the pane, drawn in place (no sheet frames).
    if (scene.textures.exists(MARKS_KEY)) scene.textures.remove(MARKS_KEY);
    const canvas = scene.textures.createCanvas(MARKS_KEY, WORLD_MARKS.pane.w, WORLD_MARKS.pane.h);
    if (canvas === null) throw new Error(`WorldProps: canvas texture '${MARKS_KEY}' was not created`);
    this.marksTexture = canvas;
    this.marks = scene.add.image(0, 0, MARKS_KEY)
      .setOrigin(0, 0)
      .setScale(PIXEL_SCALE)
      .setDepth(WORLD_DEPTH_OFFSETS.marks)
      .setVisible(false);
    back.add(this.marks);
    this.owned.push(this.marks);

    this.clock = this.spriteIn(back, 'clock', 0.5, 1, WORLD_DEPTH_OFFSETS.clock);
    this.hands = this.graphicsIn(back, WORLD_DEPTH_OFFSETS.clock + CLOCK_HANDS_DEPTH);
    this.pebbles = this.graphicsIn(back, WORLD_DEPTH_OFFSETS.scraps);
    this.machinePebbles = this.graphicsIn(back, WORLD_DEPTH_OFFSETS.scraps);
    for (let i = 0; i < WORLD_FRAMES.scraps.length; i++) {
      this.scraps.push(this.spriteIn(back, 'scraps', 0.5, 1, WORLD_DEPTH_OFFSETS.scraps));
      this.scrapAt.push(null);
      this.scrapTint.push(UNSET_TINT);
    }
    for (let i = 0; i < this.scraps.length; i++) {
      this.propScraps.push({ id: `scrap${i}`, frame: '', alpha: 0, x: 0, y: 0 });
    }
    this.stake = this.spriteIn(front, 'stakeChain', 0.5, 1, WORLD_DEPTH_OFFSETS.stakeChain);
    this.hole = this.spriteIn(front, 'hole', 0.5, 1, WORLD_DEPTH_OFFSETS.hole);
    this.holeTwin = this.spriteIn(front, 'hole', 0.5, 1, WORLD_DEPTH_OFFSETS.hole);

    this.propRows.push(
      this.propGlow, this.propHood, ...this.propWindows, ...this.propMotes, ...this.propScraps, this.propSprout, this.propClock,
    );
    sortWorldRows(rows);
    this.hideAll();
  }

  /** Applies the visual state and the ground placements. visible false hides everything. Cheap: call on every change or every frame.
   * opts.framing picks the girl mini foot: e1 uses footArtXE1 (the cycle 2+ era I trace, AD4 F6); absent or other framings use footArtX. */
  apply(
    state: WorldVisualState,
    placements: Readonly<Record<GroundId, WorldPlacement | null>>,
    opts: { reducedMotion: boolean; framing?: FramingKey },
  ): void {
    this.state = state;
    this.placements = placements;
    this.reduced = opts.reducedMotion;
    // The girl mini foot (AD4 F6): the cycle 2+ era I trace at e1 stands at footArtXE1, clear of the Inspector; other framings keep footArtX.
    const footArtX = opts.framing === 'e1' ? WORLD_FAR_PLANES.girlMini.footArtXE1 : WORLD_FAR_PLANES.girlMini.footArtX;
    this.girlMini.x = WORLD_FAR_PLANES.pylon.tileOriginX + PIXEL_SCALE * footArtX;
    if (!state.visible) {
      this.hideAll();
      return;
    }
    this.live = true;
    this.repaint();
  }

  /** Advances the tape clock, the flicker, the receiver swing, the ring and the ripple timers, then repaints the moving pieces. tween and
   * ambient (the transition queue's presented values and the clocks' ambient) are read by the paint; girl (the girl runner frame, drawn by the
   * mini planes) is stored for them. */
  update(dtMs: number, crankSteps: number, nowMs: number, tween: WorldTween, ambient: Ambient, girl: BehaviourFrame | null): void {
    const started = performance.now();
    this.tween = tween;
    this.ambient = ambient;
    this.girl = girl;
    const state = this.state;
    if (this.live && state !== null) {
      const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
      if (Number.isFinite(nowMs)) this.nowMs = nowMs;
      // A tape freeze (A10) holds the girl window flicker and the mote orbit as it holds the runners. The script keeps both running (its window
      // and its moths, D17). Read before the advance: the frame the tape ignores while frozen is the frame these hold.
      const hold = this.tape.frozen() && this.propScript === null;
      this.tape.advance(dt, state.mode, crankSteps);
      if (!hold) this.stepFlicker(dt, state.mode, crankSteps, tween.girlWindow.slowK);
      this.stepSwing(dt, state.mode, crankSteps, swingAmpOf(ambient.wind));
      this.stepRing(dt);
      this.stepWobble();
      this.stepRings();
      this.glowBumpMs = Math.max(0, this.glowBumpMs - dt);
      this.breatheMs = Math.max(0, this.breatheMs - dt);
      this.pulseMs = Math.max(0, this.pulseMs - dt);
      this.puddleRingMs = Math.max(0, this.puddleRingMs - dt);
      this.clockTwitchMs = Math.max(0, this.clockTwitchMs - dt);
      this.clockTickPokeMs = Math.max(0, this.clockTickPokeMs - dt);
      this.girlDarkMs = Math.max(0, this.girlDarkMs - dt);
      this.girlFlickMs = Math.max(0, this.girlFlickMs - dt);
      this.miniMs = Math.max(0, this.miniMs - dt);
      this.stepHood(dt);
      // The mote orbit clock runs at the rate the motes still move (1 - freezeK): a freeze decelerates to a stop. The script (finale, postgame)
      // runs it at full rate, so every moth keeps its own orbit (D17). Static under reduced motion.
      const orbitRate = this.propScript !== null ? 1 : 1 - clamp01(tween.motesFreezeK);
      if (!this.reduced && !hold) this.orbitMs += dt * orbitRate;
      // One downbeat edge per update: the accents start on it (never under reduced motion).
      const low = this.beatLow(this.nowMs);
      if (isDownbeat(this.beatPrev, low) && !this.reduced) this.onDownbeat(state);
      this.beatPrev = low;
      this.mainsMul = mainsOf(state.era, this.reduced, ambient.mainsMs);
      this.paintDynamic(state);
      this.pebbleHop = false;
    }
    this.sample(performance.now() - started);
  }

  /** WP28b (D6): the era energy's reach level L (0..1; a non-finite value reads 0). It drives the lamp wobble, the era I machine pebbles, the era IV
   * hum and puddle rings; the Director feeds it every frame. */
  setReach(level01: number): void {
    this.reachLevel = Number.isFinite(level01) ? clamp01(level01) : 0;
  }

  /** WP28b (D6 c IV): the era IV hum offset in x (world px) that the Splice objects follow; 0 outside era IV, under reduced motion and while hidden. */
  humPx(): number {
    return this.humAt(0);
  }

  /** World ripple for a tier-up era: era I = pebbles hop and one extra receiver swing; era II = lamp one step brighter; era III (the
   * puddle's first era) = puddle glint; era IV (WORLD_PUDDLE.ringEra) = puddles ring. The puddle beats are off under reduced motion. */
  ripple(era: number): void {
    if (era === 1) {
      this.pebbleHop = true;
      if (!this.tape.frozen()) {
        this.extraTicks += 1;
        this.swingKick += 1;
      }
    } else if (era === 2) {
      this.glowBumpMs = WORLD_ENV.rippleMs;
    } else if (era === WORLD_PUDDLE.minEra) {
      this.puddleRing();
    } else if (era === WORLD_PUDDLE.ringEra && !this.reduced) {
      this.puddleRingMs = WORLD_ENV.rippleMs;
    }
  }

  /** Puddle glint on a vent puff (WORLD_REACT ventPuff): the puddle shows its ring look for WORLD_PUDDLE.glintMs. Off under reduced motion. */
  puddleRing(): void {
    if (!this.reduced) this.puddleRingMs = WORLD_PUDDLE.glintMs;
  }

  /** Lamp flicker (copperWinding / transformer): the lamp glow steps brighter for WORLD_ENV.rippleMs. */
  lampFlicker(): void {
    this.glowBumpMs = WORLD_ENV.rippleMs;
  }

  /** Payphone ring: WORLD_ENV.ring bursts of ring0 / ring1 with the receiver jerking. Restarts if one is running. */
  ring(): void {
    this.ringMs = 0;
    this.ringSpanMs = ringTotalMs();
    this.ringHeld = false;
  }

  /** A payphone answer (WP28a T15b1, C4): 'sway' steps the receiver once, silent (era I); 'ring' is one ring burst (the ring frames, one burst
   * long; the director plays the sound) with a receiver swing; 'hoodBlink' blinks the booth hood three times. Reduced motion holds the burst's
   * first frame and the hood lit. */
  payphoneAnswer(kind: PayphoneAnswer): void {
    if (kind !== 'hoodBlink') this.swingKick += 1;
    if (kind === 'ring') {
      this.ringMs = 0;
      this.ringSpanMs = WORLD_ENV.ring.burstMs;
      this.ringHeld = this.reduced;
    } else if (kind === 'hoodBlink') {
      this.hoodMs = 0;
    }
  }

  /** Lamp poke (C5): the lamp glow steps brighter for WORLD_ENV.rippleMs, as a lamp flicker does. */
  lampBump(): void {
    this.lampFlicker();
  }

  /** Girl answer (AD2 F11): the window goes dark (the dark frame at its normal alpha) for ms, then the flicker returns. Reduced motion holds it
   * dark, without flicker, for POKES.reducedHoldMs at most. A no-op while the window is hidden. */
  girlWindowDark(ms: number): void {
    if (this.girlWindow.visible) this.girlDarkMs = girlSpanOf(ms, this.reduced);
  }

  /** Girl answer (AD2 F11): the window shows the other flicker frame for ms, toggled at most SPLICE_FX.maxFlashHz; reduced motion holds that frame
   * (no toggle) for POKES.reducedHoldMs at most. A no-op while the window is hidden. */
  girlWindowFlicker(ms: number): void {
    if (!this.girlWindow.visible) return;
    this.girlFlickFrame = this.flickerFrame === 'flickerA' ? 'flickerB' : 'flickerA';
    this.girlFlickMs = girlSpanOf(ms, this.reduced);
  }

  /** Girl answer (AD2 F11): the mini girl (girlMini or girlMiniNear, whichever shows) fades to alpha and back over ms; reduced motion holds alpha for
   * ms with no fade. A no-op while neither mini shows. */
  girlMiniLantern(alpha: number, ms: number): void {
    if (!this.girlMini.visible && !this.girlMiniNear.visible) return;
    this.miniTo = clamp01(Number.isFinite(alpha) ? alpha : 1);
    this.miniSpanMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    this.miniMs = this.miniSpanMs;
  }

  /** Clock poke, not woken: the minute hand twitches for POKE_RENDER.clockTwitchMs (held under reduced motion). */
  clockTwitch(): void {
    this.clockTwitchMs = POKE_RENDER.clockTwitchMs;
  }

  /** Clock poke, woken (C6): the tick hand steps one step and snaps back after SPLICE_CLOCK.snapBackMs; the minute and hour hands never move. */
  clockTickOnce(): void {
    this.clockTickPokeMs = SPLICE_CLOCK.snapBackMs;
  }

  /** The woken street clock (WP28a C6): woken holds the minute hand (no twitch); tickDeg is the tick hand's angle, null for none (not woken,
   * reduced motion, the postgame). The director sets it every frame; a running script's second hand wins. */
  setSpliceClock(woken: boolean, tickDeg: number | null): void {
    this.clockWoken = woken;
    this.clockTickDeg = tickDeg;
  }

  /** Holds the receiver at its level frame while on (the swing loop resumes when off). */
  receiverLevel(on: boolean): void {
    this.receiverOn = on;
  }

  /** Freezes the tape clock (the receiver loop) for ms; a freeze already running keeps the longer time. */
  tapeFreeze(ms: number): void {
    this.tape.freeze(ms);
  }

  /** Finale / postgame script: while non-null the PropScript drives the props; null restores the state drawing at once. */
  setScript(frame: WorldScriptFrame | null): void {
    if (frame === null && this.propScript === null) return; // cleared every frame outside the ending: nothing to undo
    this.propScript = frame === null ? null : frame.props;
    this.repaint();
  }

  /** Screen anchor of a speaker: the girl (mini when shown, else the window) or the payphone (receiver top and bottom). null when hidden. */
  anchor(id: 'girl' | 'payphone', cam: CameraPose): SpeakerAnchor | null {
    const out: SpeakerAnchor = { head: { x: 0, y: 0 }, feet: { x: 0, y: 0 } };
    return this.anchorInto(id, cam, out) ? out : null;
  }

  /** The anchor of anchor() written into out (no allocation: the per-frame speech path). Returns false, out untouched, when hidden. */
  anchorInto(id: 'girl' | 'payphone', cam: CameraPose, out: SpeakerAnchor): boolean {
    const state = this.state;
    if (!this.live || state === null) return false;
    if (id === 'payphone') {
      if (this.boothAt === null) return false;
      // Script (the receiver is hung up): head = the booth top, above its hood; feet = the booth feet (AD4 F2, so the bubble ladder
      // can sit below the booth). State: the receiver's top and bottom.
      if (this.propScript !== null) {
        const b = this.booth;
        screenInto(out.head, b.x, b.y - b.displayHeight, 1, cam);
        screenInto(out.feet, b.x, b.y, 1, cam);
        return true;
      }
      const r = this.receiver;
      screenInto(out.head, r.x, r.y, 1, cam);
      screenInto(out.feet, r.x, r.y + r.displayHeight, 1, cam);
      return true;
    }
    // Ground: LivingWorld draws her (no plane here). Mini and miniNear: the pylon plane sprite of that stage.
    const stage = state.girl.stageName;
    if (stage === 'ground') return false;
    const pylon = stage === 'mini' ? this.girlMini : stage === 'miniNear' ? this.girlMiniNear : null;
    if (pylon !== null) {
      const sf = WORLD_FAR_PLANES.pylon.sf;
      screenInto(out.head, pylon.x, pylon.y - pylon.displayHeight, sf, cam);
      screenInto(out.feet, pylon.x, pylon.y, sf, cam);
      return true;
    }
    const w = this.girlWindow;
    const sf = WORLD_FAR_PLANES.window.sf;
    const cx = w.x + w.displayWidth / 2;
    screenInto(out.head, cx, w.y, sf, cam);
    screenInto(out.feet, cx, w.y + w.displayHeight, sf, cam);
    return true;
  }

  // The girl window's probe variant (WP28a r2): the restored window, else what paintGirlWindow drew last: the dark frame (script, faded out or
  // the dark answer), the answer's other flicker frame, or the flicker.
  private windowVariant(restored: boolean): string {
    if (restored) return 'window-restored';
    return this.shownDark ? 'window-dark' : this.shownAlt ? 'window-flicker-alt' : 'window-flicker';
  }

  /** Debug view: one entry per probe id. x and y are the world position of a shown ground object (0 when hidden or on a far plane); alpha
   * is the presented alpha of the shown layer (a crossfade reports the layer with the higher alpha, and its frame). */
  probe(): { id: string; variant: string; x: number; y: number; alpha: number; visible: boolean; speaking: boolean }[] {
    const on = this.live;
    const state = this.state;
    const stage = state === null ? 'ground' : state.girl.stageName;
    const at = (s: Phaser.GameObjects.Sprite): number => (on && s.visible ? s.x : 0);
    const yAt = (s: Phaser.GameObjects.Sprite): number => (on && s.visible ? Math.round(s.y) : 0);
    const alphaAt = (s: Phaser.GameObjects.Sprite): number => (on && s.visible ? s.alpha : 0);
    const shown = (s: Phaser.GameObjects.Sprite): boolean => on && s.visible;
    const lamp = topOf(this.lamp, this.lampTwin);
    const booth = topOf(this.booth, this.boothTwin);
    const receiver = topOf(this.receiver, this.receiverTwin);
    const puddle = topOf(this.puddle, this.puddleTwin);
    const sprout = topOf(this.sprout, this.sproutTwin);
    // The girl's plane by stage: window (the window sprite), mini, miniNear; none on the ground (LivingWorld draws her).
    const plane = stage === 'mini' ? this.girlMini : stage === 'miniNear' ? this.girlMiniNear : this.girlWindow;
    const restored = this.propScript?.girlWindow === 'restored';
    const variant = stage === 'mini' ? `mini:${this.frameName(this.girlMini)}`
      : stage === 'miniNear' ? `mini-near:${this.frameName(this.girlMiniNear)}`
        : stage === 'window' ? this.windowVariant(restored) : 'none';
    return [
      { id: 'lamp', variant: this.frameName(lamp), x: at(this.lamp), y: yAt(this.lamp), alpha: alphaAt(lamp), visible: shown(this.lamp), speaking: false },
      { id: 'clock', variant: this.frameName(this.clock), x: at(this.clock), y: yAt(this.clock), alpha: alphaAt(this.clock), visible: shown(this.clock), speaking: false },
      { id: 'payphone', variant: this.frameName(booth), x: at(this.booth), y: yAt(this.booth), alpha: alphaAt(booth), visible: shown(this.booth), speaking: false },
      { id: 'receiver', variant: this.frameName(receiver), x: at(this.receiver), y: yAt(this.receiver), alpha: alphaAt(receiver), visible: shown(this.receiver), speaking: false },
      { id: 'puddle', variant: this.frameName(puddle), x: at(puddle), y: yAt(puddle), alpha: alphaAt(puddle), visible: shown(puddle), speaking: false },
      { id: 'sprout', variant: this.frameName(sprout), x: at(sprout), y: yAt(sprout), alpha: alphaAt(sprout), visible: shown(sprout), speaking: false },
      { id: 'lantern', variant: this.frameName(this.lantern), x: at(this.lantern), y: yAt(this.lantern), alpha: alphaAt(this.lantern), visible: shown(this.lantern), speaking: false },
      // The restored window (LAST LOOK and the postgame) reports as the girl's window plane while it shows.
      restored
        ? { id: 'girl', variant: 'window-restored', x: 0, y: 0, alpha: alphaAt(this.girlWindow), visible: on && this.girlWindow.visible && this.girlWindow.alpha > 0, speaking: false }
        : { id: 'girl', variant, x: 0, y: 0, alpha: alphaAt(plane), visible: stage !== 'ground' && shown(plane), speaking: false },
    ];
  }

  /** Prop rows for the debug hook: lampGlow, boothHood (the booth's shown layer), window0-window5, mote0-mote4, scrap0-scrap2, sprout (the
   * shown layer), and clockMinute. Reused rows, no allocation. */
  props(): readonly PropRow[] {
    const live = this.live;
    fillRow(this.propGlow, this.lampGlow, this.frameName(this.lampGlow), live);
    const hood = topOf(this.booth, this.boothTwin);
    fillRow(this.propHood, hood, this.frameName(hood), live);
    for (let i = 0; i < this.propWindows.length; i++) {
      const row = this.propWindows[i];
      const w = this.windowSprites[i];
      if (row === undefined || w === undefined) continue;
      fillRow(row, w, this.frameName(w), live);
    }
    for (let i = 0; i < this.propMotes.length; i++) {
      const row = this.propMotes[i];
      const m = this.motes[i];
      if (row === undefined || m === undefined) continue;
      fillRow(row, m, this.frameName(m), live);
    }
    for (let i = 0; i < this.propScraps.length; i++) {
      const row = this.propScraps[i];
      const s = this.scraps[i];
      if (row === undefined || s === undefined) continue;
      fillRow(row, s, this.frameName(s), live);
    }
    const sprout = topOf(this.sprout, this.sproutTwin);
    fillRow(this.propSprout, sprout, this.frameName(sprout), live);
    fillRow(this.propClock, this.clock, this.handsTwitch ? 'twitch' : 'rest', live);
    return this.propRows;
  }

  /** Hides every object and cancels the ring, ripple and accent timers. apply() with a visible state shows them again. */
  hideAll(): void {
    this.live = false;
    this.stale = true;
    this.ringMs = -1;
    this.ringHeld = false;
    this.clockTwitchMs = 0;
    this.clockTickPokeMs = 0;
    this.girlDarkMs = 0;
    this.girlFlickMs = 0;
    this.miniMs = 0;
    this.hoodMs = -1;
    this.glowBumpMs = 0;
    this.breatheMs = 0;
    this.pulseMs = 0;
    this.puddleRingMs = 0;
    this.puddleNextMs = Number.NaN;
    this.pebbleHop = false;
    for (const o of this.owned) o.setVisible(false);
  }

  /** Object count of this renderer and the mean update time in ms over the last 120 updates. */
  stats(): { objects: number; meanMs: number } {
    return { objects: this.owned.length, meanMs: this.timings.mean() };
  }

  /** Destroys every object and the marks canvas texture; safe to call twice. */
  destroy(): void {
    for (const o of this.owned) {
      if (o.scene) o.destroy(); // Phaser clears scene on destroy; a container takes its children with it
    }
    this.owned.length = 0;
    this.windowSprites.length = 0;
    this.motes.length = 0;
    this.scraps.length = 0;
    this.propRows.length = 0;
    this.live = false;
    this.state = null;
    this.placements = null;
    if (this.scene.textures.exists(MARKS_KEY)) this.scene.textures.remove(MARKS_KEY);
  }

  // Art sprite in a container, at scale PIXEL_SCALE, first frame, hidden until apply() places it.
  private spriteIn(parent: Phaser.GameObjects.Container, sheet: WorldSheetId, ox: number, oy: number, depth: number): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(0, 0, WORLD_SHEET_KEYS[sheet], 0)
      .setOrigin(ox, oy)
      .setScale(PIXEL_SCALE)
      .setDepth(depth)
      .setVisible(false);
    parent.add(sprite);
    this.owned.push(sprite);
    return sprite;
  }

  // Graphics in a container, hidden until drawn into.
  private graphicsIn(parent: Phaser.GameObjects.Container, depth: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(depth).setVisible(false);
    parent.add(g);
    this.owned.push(g);
    return g;
  }

  private frameName(sprite: Phaser.GameObjects.Sprite): string {
    return (sprite as FrameCached).shownName ?? '';
  }

  // Sets a named frame of a sheet row, only when it changes (sheetFrameIndex throws on an unknown name).
  private setFrame(sprite: Phaser.GameObjects.Sprite, sheet: WorldSheetId, name: string, row: number): void {
    const shown = sprite as FrameCached;
    if (shown.shownName === name && shown.shownRow === row) return;
    const index = sheetFrameIndex(sheet, name, row);
    shown.shownName = name;
    shown.shownRow = row;
    sprite.setFrame(index);
  }

  // Repaints the static and dynamic pieces (apply and setScript); a no-op while hidden or before the first apply(). The pieces repaint in full.
  private repaint(): void {
    const state = this.state;
    const placements = this.placements;
    if (!this.live || state === null || placements === null) return;
    this.stale = true;
    this.placeStatic(state, placements);
    this.paintDynamic(state);
  }

  // Static placement: positions, visibility and the frames that only the state sets (the script overrides some). Runs on repaint().
  // The lamp frames, the glow, the booth frames and the receiver frames are painted in paintDynamic (the tween drives them).
  private placeStatic(state: WorldVisualState, p: Placements): void {
    const row = state.eraRow;
    // The girl's window stays on the far plane (dark once she has left it); her pylon planes show by stage (ground: none).
    this.farWindow.setVisible(true);
    this.farPylon.setVisible(state.props.girlMini || state.props.girlMiniNear);
    this.girlWindow.setVisible(true);
    this.girlMini.setVisible(state.props.girlMini);
    this.girlMiniNear.setVisible(state.props.girlMiniNear);

    // Lamp, glow and motes hang off the lamp placement; the glow and the orbit centre on the lamp head.
    const lamp = p.lamp;
    if (lamp !== null) {
      const feet = feetOf(lamp);
      const head: Vec2 = { x: lamp.x, y: feet - WORLD_ENV.lampHeadArtPx * PIXEL_SCALE };
      this.lampHead = head;
      this.lamp.setPosition(lamp.x, feet).setVisible(true);
      this.lampTwin.setPosition(lamp.x, feet);
      this.lampGlow.setPosition(head.x, head.y);
    } else {
      this.lampHead = null;
      this.lamp.setVisible(false);
      this.lampTwin.setVisible(false);
      this.lampGlow.setVisible(false);
    }
    // Mote frames (ash, or moth on the postgame script); their visibility, orbit and fall are drawn per frame (paintMotes).
    for (const mote of this.motes) this.setFrame(mote, 'mote', this.propScript?.motes === 'moth' ? 'moth' : 'ash', row);

    // Payphone booth: receiver, tally marks and pebbles stand on the booth.
    const booth = p.payphone;
    if (booth !== null) {
      const feet = feetOf(booth);
      this.boothAt = { x: booth.x, y: feet };
      this.booth.setPosition(booth.x, feet).setVisible(true);
      this.boothTwin.setPosition(booth.x, feet);
      this.boothFogLayer.setPosition(booth.x, feet);
    } else {
      this.boothAt = null;
      this.booth.setVisible(false);
      this.boothTwin.setVisible(false);
      this.boothFogLayer.setVisible(false);
    }
    const boothOn = booth !== null;
    this.receiver.setVisible(boothOn);
    this.pebbles.setVisible(boothOn);
    this.marks.setVisible(boothOn);
    const boothAt = this.boothAt;
    if (boothAt !== null) {
      // Pane offset from the booth's top-left corner (the booth is origin bottom-centre on its feet).
      const left = boothAt.x - this.booth.displayWidth / 2;
      const top = boothAt.y - this.booth.displayHeight;
      this.marks.setPosition(left + WORLD_MARKS.pane.x * PIXEL_SCALE, top + WORLD_MARKS.pane.y * PIXEL_SCALE);
    }

    // Street clock: the ruin frame (restored by the script); the hands are drawn in paintDynamic at the clock feet.
    const clk = p.clock;
    this.clock.setVisible(clk !== null);
    this.hands.setVisible(clk !== null);
    this.clockAt = clk === null ? null : { x: clk.x, y: feetOf(clk) };
    if (clk !== null) {
      this.clock.setPosition(clk.x, feetOf(clk));
      this.setFrame(this.clock, 'clock', this.propScript?.clock === 'restored' ? 'restored' : 'ruin', row);
    }

    // Stake and cut chain (front row; fallen by the script), then the hole once digging has started (hidden by the script).
    const stake = p.stakeChain;
    if (stake !== null) {
      this.stake.setPosition(stake.x, feetOf(stake)).setVisible(state.props.stakeChain);
      this.setFrame(this.stake, 'stakeChain', this.propScript?.chain === 'fallen' ? 'fallen' : 'chained', row);
    } else {
      this.stake.setVisible(false);
    }
    // Dog hole: its feet here; the stage and its crossfade are drawn per frame (paintGround).
    const hole = p.hole;
    this.holeAt = hole === null ? null : { x: hole.x, y: feetOf(hole) };

    // Fallen lantern: the script drops it at its placement (the sprite is built hidden).
    const lantern = p.lantern;
    if (lantern !== null && this.propScript?.lantern === 'fallen') {
      this.lantern.setPosition(lantern.x, feetOf(lantern)).setVisible(true);
      this.setFrame(this.lantern, 'lantern', 'fallen', row);
    } else {
      this.lantern.setVisible(false);
    }

    // Puddle and sprout: their feet dyWorldPx down into the ground strip (AD3d H2); size, look and stage are drawn per frame (paintGround).
    const puddle = p.puddles;
    this.puddleAt = puddle === null ? null : { x: puddle.x, y: feetOf(puddle) + WORLD_PUDDLE.dyWorldPx };
    const sprout = p.sprout;
    this.sproutAt = sprout === null ? null : { x: sprout.x, y: feetOf(sprout) + WORLD_PUDDLE.dyWorldPx };

    // Paper scraps: the base point of each at its kept x on the feet line; the burn and the flutter are drawn per frame.
    const sc = p.scraps;
    const xs: readonly number[] = sc === null ? [] : (sc.xs ?? [sc.x]);
    for (let i = 0; i < this.scraps.length; i++) {
      const x = xs[i];
      this.scrapAt[i] = sc === null || x === undefined ? null : { x, y: feetOf(sc) };
    }
  }

  // Per-frame paint: the girl window, the windows, the lamp, the motes, the booth, the puddle, the receiver, the clock hands and the pebbles.
  // Runs on apply() and on every update(); nothing is drawn until the first update() has stored the tween and the ambient.
  private paintDynamic(state: WorldVisualState): void {
    const tween = this.tween;
    const ambient = this.ambient;
    if (tween === null || ambient === null) return;
    const script = this.propScript;
    const micro = script === null ? ambient.micro : null;
    const phase = this.ringMs >= 0 && this.ringHeld ? 0 : ringPhaseAt(this.ringMs);

    this.paintHum();
    this.paintGirlWindow(state, tween, micro);
    this.paintWindows(state, tween);
    this.paintLamp(state, tween, ambient, micro);
    this.paintMotes(state, tween);
    this.paintBooth(state, tween, micro, phase);
    this.paintPuddle(state, tween);
    this.paintGround(state, tween, ambient);
    this.paintGirlMini(state);
    this.paintReceiver(state, tween, ambient, phase);

    // Clock hands: 4:41 plus the script's second hand (null before the clock restores), or off script the woken clock's tick hand. The minute
    // hand twitches only off script, off reduced motion and while the clock is not woken (the tween's micro flag, WORLD_AMBIENT.clockTwitchDeg).
    const pokeTwitch = script === null && !this.clockWoken && this.clockTwitchMs > 0;
    const twitch = (micro !== null && micro.clockTwitch && !this.reduced && !this.clockWoken) || pokeTwitch;
    const second = script === null ? this.tickHandDeg() : script.secondHandDeg;
    if (this.clockAt !== null) this.paintHands(this.clockOrigin, second, twitch);

    // Pebbles at the booth foot: two 1 art px rects, lifted hopPx for the one frame after a ripple.
    const boothAt = this.boothAt;
    if (boothAt !== null) {
      const lift = this.pebbleHop ? WORLD_ENV.pebbles.hopPx : 0;
      if (this.pebblesX !== boothAt.x || this.pebblesLift !== lift) {
        this.pebblesX = boothAt.x;
        this.pebblesLift = lift;
        this.drawPebbles(boothAt, lift);
      }
    }
    this.paintMachinePebbles(state, script);
    this.stale = false;
  }

  // Girl window: the flicker frame, or dark once the tween has faded it out (the generator) or on the script's dark. Its alpha is the
  // tween's (the girl-dim micro flag dips it); the script restores it at full alpha (single-row sheet, not one of the six windows: AD4 F1).
  private paintGirlWindow(state: WorldVisualState, tween: WorldTween, micro: MicroFlags | null): void {
    const script = this.propScript;
    const restored = script?.girlWindow === 'restored';
    const answer = script === null;
    const dark = answer ? tween.girlWindow.alpha <= 0 || this.girlDarkMs > 0 : state.props.girlWindow === 'dark';
    // A girl answer's flicker shows the other flicker frame in the first half of each 1 / maxFlashHz period (never above that rate); reduced
    // motion holds it. The flicker clock underneath keeps its frame.
    const half = 1000 / (2 * SPLICE_FX.maxFlashHz);
    const swapped = answer && this.girlFlickMs > 0 && (this.reduced || Math.floor(this.nowMs / half) % 2 === 0);
    const frame = restored ? 'restored' : dark ? 'dark' : swapped ? this.girlFlickFrame : this.flickerFrame;
    this.shownDark = !restored && dark;
    this.shownAlt = !restored && !dark && swapped;
    this.setFrame(this.girlWindow, 'girlWindow', frame, state.eraRow);
    let level = 1;
    if (script === null) level = tween.girlWindow.alpha * dipOf(micro, 'girlWindowDim');
    else if (!restored) level = script.windowsAlpha;
    setAlphaIf(this.girlWindow, WORLD_ENV.windowAlpha * level);
  }

  // Six lit windows: each at its tween level (the queue's one-by-one lights and dims) scaled by the mains flicker; the script keeps the
  // state's count and the window target. The halo glows each window at the same level (paintHalo). The breathe frame needs the breathe timer.
  private paintWindows(state: WorldVisualState, tween: WorldTween): void {
    const script = this.propScript;
    const wa = script?.windowsAlpha ?? 1;
    const breatheOn = this.breatheMs > 0 && (script !== null || tween.breatheK > 0);
    const breathe = breatheOn ? 'breathe' : 'lit';
    const row = state.eraRow;
    // A frame change (breathe flips, or a stale sprite) repaints every window; otherwise a window writes only when its alpha moved.
    const reframe = this.stale || breatheOn !== this.lastWinBreathe;
    this.lastWinBreathe = breatheOn;
    for (let i = 0; i < this.windowSprites.length; i++) {
      let level = tween.windows[i] ?? 0;
      if (script !== null) level = i < state.props.windowsLit ? windowTargetOf(state.props.windows) : 0;
      // The sprite's presented level without the mains flicker: its alpha is this times mainsMul (clamped). The halo draws this level.
      this.haloLevels[i] = WORLD_ENV.windowAlpha * level * wa;
      const w = this.windowSprites[i];
      if (w === undefined) continue;
      const alpha = clamp01(WORLD_ENV.windowAlpha * level * this.mainsMul * wa);
      if (!reframe && alpha === this.lastWinAlpha[i]) continue;
      this.lastWinAlpha[i] = alpha;
      this.setFrame(w, 'windowLit', breathe, row);
      setVisibleIf(w, alpha > SHOWN_ALPHA);
      setAlphaIf(w, alpha);
    }
    this.paintHalo();
  }

  // Lamp (eras I-V): the lamp sprite shows the lamp Blend (dead, lit, warm) and its twin crossfades in (warm). The glow steps brighter on a
  // ripple or a pulse (the pulse scaled by its tween), scales with the mains, the lamp gain and the buzz dip. The script keeps its restored
  // lamp and warm glow.
  private paintLamp(state: WorldVisualState, tween: WorldTween, ambient: Ambient, micro: MicroFlags | null): void {
    const row = state.eraRow;
    const head = this.lampHead;
    const script = this.propScript;
    const pulseK = script === null ? tween.pulseK : 1;
    const bump = WORLD_ENV.lampGlow.bumpAlpha * Math.max(this.glowBumpMs > 0 ? 1 : 0, this.pulseMs > 0 ? pulseK : 0);
    let on: boolean;
    let warm: boolean;
    let glow: number;
    if (script === null) {
      const lamp = crossOf(tween.lamp, CROSS_LAMP);
      on = tween.glowAlpha > 0;
      warm = tween.glowWarm;
      // The reach wobble (WP28b) rides on the mains flicker and fades with the glow (it is 0 under reduced motion).
      glow = clamp01(clamp01((WORLD_ENV.lampGlow.alpha + bump + this.lampWobble) * this.mainsMul) * tween.glowAlpha * ambient.lampGain *
        dipOf(micro, 'lampDip'));
      // Unchanged blend and glow since the last paint: the lamp frames, the twin and the glow already show.
      if (!this.stale && lamp.main === this.lastLampMain && lamp.twin === this.lastLampTwin && lamp.k === this.lastLampK &&
        on === this.lastLampOn && warm === this.lastLampWarm && glow === this.lastLampGlow) return;
      this.lastLampMain = lamp.main;
      this.lastLampTwin = lamp.twin;
      this.lastLampK = lamp.k;
      this.lastLampOn = on;
      this.lastLampWarm = warm;
      this.lastLampGlow = glow;
      this.setFrame(this.lamp, 'lamp', nameAt(LAMP_STATES, lamp.main), row);
      this.setFrame(this.lampTwin, 'lamp', nameAt(LAMP_STATES, lamp.twin), row);
      setVisibleIf(this.lampTwin, head !== null && lamp.k > 0);
      setAlphaIf(this.lampTwin, lamp.k);
    } else {
      this.setFrame(this.lamp, 'lamp', script.lamp === 'restored' ? 'restored' : state.props.lamp, row);
      setVisibleIf(this.lampTwin, false);
      const scriptWarm = script.lampGlow === 'warm';
      on = state.props.lampGlow || scriptWarm;
      warm = scriptWarm || state.props.lampGlowWarm;
      glow = clamp01((WORLD_ENV.lampGlow.alpha + bump) * this.mainsMul);
    }
    setVisibleIf(this.lampGlow, head !== null && on);
    setAlphaIf(this.lampGlow, glow);
    this.setFrame(this.lampGlow, 'lampGlow', warm ? 'warm' : 'cold', row);
  }

  // Booth hood: when the era row crossfade runs (main = the from row, twin = the to row at alpha k) both rows show the hood's nearer frame;
  // otherwise the hood Blend (dark, lit: a stutter or a fade) runs on the main and the twin. A ring phase overrides the frame. The fog
  // layer (boothFog, era III with vents) lies over the lit hood and hides while the booth rings. The script keeps its booth frame.
  private paintBooth(state: WorldVisualState, tween: WorldTween, micro: MicroFlags | null, phase: -1 | 0 | 1): void {
    const row = state.eraRow;
    const script = this.propScript;
    const boothAt = this.boothAt;
    const boothOn = boothAt !== null;
    const ring = phase === -1 ? null : phase === 0 ? 'ring0' : 'ring1';
    if (script !== null) {
      // The script: dark, restored and blink (lit) on the whole row, or stage = the state drawing (no twins, no fog layer).
      const idle = state.props.boothLit ? (state.props.boothFog ? 'fog' : 'lit') : 'dark';
      const booth = script.booth;
      const name = booth === 'stage' ? (ring ?? idle) : booth === 'blink' ? 'lit' : booth;
      this.setFrame(this.booth, 'payphone', name, booth === 'restored' || booth === 'blink' ? WORLD_ERA_ROW.whole : row);
      setAlphaIf(this.booth, state.props.boothLit ? this.mainsMul : 1);
      setVisibleIf(this.boothTwin, false);
      setVisibleIf(this.boothFogLayer, false);
      this.paintMarks(state.props.marks + script.marksPlus, name === 'fog');
      return;
    }

    const eraRow = crossOf(tween.eraRow, CROSS_BOOTH_ERA);
    // A hood blink (payphoneAnswer 'hoodBlink') shows the hood lit or dark in place of the tween's hood.
    const blink = this.hoodBlinkLit();
    if (blink !== null) {
      this.hoodBlend.from = blink ? 1 : 0;
      this.hoodBlend.to = this.hoodBlend.from;
      this.hoodBlend.k = 0;
    }
    const hoodBlend = blink === null ? tween.booth : this.hoodBlend;
    const hood = crossOf(hoodBlend, CROSS_HOOD);
    const presented = hoodBlend.from + (hoodBlend.to - hoodBlend.from) * hoodBlend.k;
    // The hood's light: full alpha when dark, the mains flicker and the buzz dip when lit (by the presented value).
    const litK = clamp01(presented);
    const alpha = clamp01(1 - litK + litK * this.mainsMul * dipOf(micro, 'boothDip'));
    if (eraRow.k > 0) {
      // The era crossfade wins: both rows show the hood's nearer frame, the twin is the to row at alpha k.
      const frame = ring ?? nameAt(BOOTH_HOOD, presented);
      this.setFrame(this.booth, 'payphone', frame, eraRow.main);
      this.setFrame(this.boothTwin, 'payphone', frame, eraRow.twin);
      setVisibleIf(this.boothTwin, boothOn);
      setAlphaIf(this.boothTwin, eraRow.k * alpha);
    } else {
      this.setFrame(this.booth, 'payphone', ring ?? nameAt(BOOTH_HOOD, hood.main), eraRow.main);
      this.setFrame(this.boothTwin, 'payphone', nameAt(BOOTH_HOOD, hood.twin), eraRow.main);
      setVisibleIf(this.boothTwin, boothOn && ring === null && hood.k > 0);
      setAlphaIf(this.boothTwin, hood.k * alpha);
    }
    setAlphaIf(this.booth, alpha);
    // The fog: its own layer over the lit hood at alpha boothFog, in the nearer era row; hidden while ringing (the ring frames show). During the
    // era row crossfade it fades out to nothing at k 0.5, where its row swaps, and fades back in: no instant change.
    const fogRow = Math.round(eraRow.k) === 1 ? eraRow.twin : eraRow.main;
    const fade = eraRow.k > 0 ? Math.abs(1 - 2 * eraRow.k) : 1;
    const fogAlpha = tween.boothFog * fade;
    const fogShown = eraRow.k > 0 ? fogAlpha > SHOWN_ALPHA : tween.boothFog > 0;
    this.setFrame(this.boothFogLayer, 'payphone', 'fog', fogRow);
    setVisibleIf(this.boothFogLayer, boothOn && ring === null && fogShown);
    setAlphaIf(this.boothFogLayer, fogAlpha);
    // The tally marks take the fog colour while the fog shows (boothFog from one half up) and the booth is not ringing.
    this.paintMarks(state.props.marks, ring === null && Math.round(tween.boothFog) === 1);
  }

  // Receiver: the swing (the wind's amplitude, on the swing clock) until it is held: level while receiverOn or once levelK reaches 1. The era V
  // rise (levelK above 0) climbs from hang to level frame by frame; under reduced motion 'level' fades in on the twin instead (D15). The era row
  // crossfade takes the twin when it runs. The script keeps the tape loop; onHook (the handset on the booth's outer side) has no jerk.
  private paintReceiver(state: WorldVisualState, tween: WorldTween, ambient: Ambient, phase: -1 | 0 | 1): void {
    const script = this.propScript;
    const hook = script?.receiver === 'onHook';
    const boothAt = this.boothAt;
    const boothOn = boothAt !== null;
    if (script !== null) {
      const loop = loopFrameAt(WORLD_LOOPS.receiver, this.tape.tick() + this.extraTicks, state.seam).frame;
      this.setFrame(this.receiver, 'receiver', hook ? 'onHook' : this.receiverOn ? 'level' : loop, hook ? WORLD_ERA_ROW.whole : state.eraRow);
      setVisibleIf(this.receiverTwin, false);
    } else {
      const levelK = clamp01(tween.receiverLevelK);
      const eraRow = crossOf(tween.eraRow, CROSS_RECEIVER_ERA);
      const held = this.receiverOn || levelK >= 1;
      const frame = held ? 'level' : this.swingFrame(swingAmpOf(ambient.wind), levelK);
      this.setFrame(this.receiver, 'receiver', frame, eraRow.main);
      if (eraRow.k > 0) {
        // The era row crossfade's B layer: the same frame on the twin at alpha k.
        this.setFrame(this.receiverTwin, 'receiver', frame, eraRow.twin);
        setVisibleIf(this.receiverTwin, boothOn);
        setAlphaIf(this.receiverTwin, eraRow.k);
      } else if (this.reduced && !held) {
        // Reduced motion (D15): the era V rise is a fade, 'hang' on the main and 'level' on the twin at alpha levelK.
        this.setFrame(this.receiverTwin, 'receiver', 'level', eraRow.main);
        setVisibleIf(this.receiverTwin, boothOn && levelK > 0);
        setAlphaIf(this.receiverTwin, levelK);
      } else {
        setVisibleIf(this.receiverTwin, false);
        setAlphaIf(this.receiverTwin, 0);
      }
    }
    if (boothAt !== null) {
      const jerk = (this.reduced || phase === -1 || hook) ? 0 : (phase === 0 ? -1 : 1) * WORLD_ENV.ring.jerkPx;
      const off = hook ? WORLD_ENV.receiverOnHookArt : WORLD_ENV.receiverArt;
      const x = boothAt.x + off.x * PIXEL_SCALE + jerk + this.humBooth;
      const y = boothAt.y + off.y * PIXEL_SCALE;
      setPositionIf(this.receiver, x, y);
      setPositionIf(this.receiverTwin, x, y);
    }
  }

  // Receiver frame while it is not held. At levelK 0 a cycle of 2 x amp steps walks the levels 0..amp (hang, swing0, swing1, swing2 at the full
  // amp). Above 0 (the era V rise) the frame climbs with levelK from hang to level, monotone. Reduced motion hangs (the rise is a fade on the twin).
  private swingFrame(amp: number, levelK: number): string {
    if (this.reduced) return 'hang';
    if (levelK > 0) return nameAt(WORLD_FRAMES.receiver, levelK * RECEIVER_LEVEL);
    const n = 2 * amp;
    const s = Math.min(n - 1, Math.floor(this.swingPhase * n));
    const level = amp - Math.abs(s - amp);
    return nameAt(WORLD_FRAMES.receiver, level);
  }

  // Girl window flicker (bible §4.1): before wornMotor the frame toggles per crank step; otherwise held for windowFlicker holds. While the window
  // goes dark (slowK 0..1, the generator) each timed hold stretches by up to WORLD_TRANSITIONS.rows.girlWindow.slowFactor: the lantern leaves.
  private stepFlicker(dt: number, mode: PlaybackMode, crankSteps: number, slowK: number): void {
    if (mode === 'crank') {
      const steps = Number.isFinite(crankSteps) ? Math.max(0, Math.floor(crankSteps)) : 0;
      if (steps > 0) {
        this.flickerK += steps;
        this.readFlicker(this.flickerK);
      }
      return;
    }
    const stretch = 1 + clamp01(slowK) * WORLD_TRANSITIONS.rows.girlWindow.slowFactor;
    this.flickerLeftMs -= dt;
    for (let guard = 0; this.flickerLeftMs <= 0 && guard < FLICKER_CATCHUP_MAX; guard++) {
      this.flickerK += 1;
      this.readFlicker(this.flickerK);
      this.flickerLeftMs += this.flickerHoldMs * stretch;
    }
    this.readFlicker(this.flickerK);
  }

  // Reads the flicker hold and frame of counter k into flickerHoldMs and flickerFrame, only when k moved (a counter's hold and frame are fixed).
  private readFlicker(k: number): void {
    if (k === this.flickerReadK) return;
    const flicker = windowFlicker(k, WORLD_ENV.windowFlickerSeed);
    this.flickerReadK = k;
    this.flickerHoldMs = flicker.holdMs;
    this.flickerFrame = flicker.frame;
  }

  // Receiver swing clock: a cycle is 2 x amp frame steps. Timed modes run it over the cycle's period (hashed, WORLD_AMBIENT.receiver);
  // crank mode steps one per click. The tape freeze holds it; a ripple adds one step.
  private stepSwing(dt: number, mode: PlaybackMode, crankSteps: number, amp: number): void {
    if (this.tape.frozen()) return;
    const n = 2 * amp;
    let advance = this.swingKick / n;
    if (mode === 'crank') {
      const clicks = Number.isFinite(crankSteps) ? Math.max(0, Math.floor(crankSteps)) : 0;
      advance += clicks / n;
    } else {
      advance += dt / this.swingPeriodMs;
    }
    this.swingKick = 0;
    this.swingPhase += advance;
    const wraps = Math.floor(this.swingPhase);
    if (wraps > 0) {
      this.swingPhase -= wraps;
      this.swingCycle += wraps;
      this.swingPeriodMs = swingPeriodOf(this.swingCycle);
    }
  }

  // Ring clock: runs once from ring(); stops after the last burst.
  private stepRing(dt: number): void {
    if (this.ringMs < 0) return;
    this.ringMs += dt;
    if (this.ringMs >= this.ringSpanMs) {
      this.ringMs = -1;
      this.ringHeld = false;
    }
  }

  // Hood blink clock (payphoneAnswer 'hoodBlink'): runs once and stops after the last blink.
  private stepHood(dt: number): void {
    if (this.hoodMs < 0) return;
    this.hoodMs += dt;
    if (this.hoodMs >= HOOD_TOTAL_MS) this.hoodMs = -1;
  }

  // The hood's blink this frame: null while no blink runs, else lit (true) or dark. Lit on the even steps; held lit under reduced motion.
  private hoodBlinkLit(): boolean | null {
    if (this.hoodMs < 0) return null;
    return this.reduced || Math.floor(this.hoodMs / POKE_RENDER.hoodBlinkMs) % 2 === 0;
  }

  // The second hand: the director's tick (setSpliceClock) as it is, and during a clockTickOnce one step on (a woken clock with no tick
  // holds its rest angle for the poke only).
  private tickHandDeg(): number | null {
    if (this.clockTickPokeMs <= 0) return this.clockTickDeg;
    const base = this.clockTickDeg ?? (this.clockWoken ? SPLICE_CLOCK.restDeg : null);
    return base === null ? null : base + SPLICE_CLOCK.stepDeg;
  }

  // Tally marks: redrawn in place when the count or the fog colour changes (fogColor while the fog shows, else color).
  private paintMarks(count: number, fog: boolean): void {
    if (count === this.marksDrawn && fog === this.marksFogDrawn) return;
    this.marksDrawn = count;
    this.marksFogDrawn = fog;
    const tex = this.marksTexture;
    const ctx = tex.context;
    ctx.clearRect(0, 0, WORLD_MARKS.pane.w, WORLD_MARKS.pane.h);
    ctx.fillStyle = cssOf(fog ? WORLD_MARKS.fogColor : WORLD_MARKS.color);
    for (const r of tallyRects(count)) ctx.fillRect(r.x, r.y, r.w, r.h);
    tex.refresh();
  }

  // Halo (WORLD_ENV.windowGlow): the glow of each window at its own presented level, so a plate fades in and out with its window (not all six
  // at once). Redraws only while a level moved by LEVEL_STEP or more (no redraw, no allocation in the steady state). The object alpha carries
  // the mains flicker, as the window sprites do; the halo shows while any window is above SHOWN_ALPHA.
  private paintHalo(): void {
    let moved = false;
    let shown = false;
    for (let i = 0; i < this.haloLevels.length; i++) {
      const level = this.haloLevels[i] ?? 0;
      // An undrawn level (NaN) fails the step test, so the first paint draws.
      if (!(Math.abs(level - (this.haloDrawn[i] ?? NaN)) < LEVEL_STEP)) moved = true;
      if (level > SHOWN_ALPHA) shown = true;
    }
    if (moved) this.drawHalo();
    setVisibleIf(this.halo, shown);
    setAlphaIf(this.halo, this.mainsMul);
  }

  // Draws one glow per window above SHOWN_ALPHA at windowGlow.alpha times its level, over the window's padded rect, and stores the levels it
  // drew. With every level at 1 this is the count draw of all six windows: the same colour, alpha, rects and order.
  private drawHalo(): void {
    const far = WORLD_FAR_PLANES;
    const pad = WORLD_ENV.windowGlow.padArtPx * PIXEL_SCALE;
    const g = this.halo;
    g.clear();
    for (let i = 0; i < far.windows.length; i++) {
      const level = this.haloLevels[i] ?? 0;
      this.haloDrawn[i] = level;
      const w = far.windows[i];
      if (w === undefined || level <= SHOWN_ALPHA) continue;
      const x = far.window.tileOriginX + PIXEL_SCALE * w.artX;
      const y = far.window.tileTopY + PIXEL_SCALE * w.artY;
      g.fillStyle(WORLD_ENV.windowGlow.color, WORLD_ENV.windowGlow.alpha * level);
      g.fillRect(x - pad, y - pad, w.w * PIXEL_SCALE + 2 * pad, w.h * PIXEL_SCALE + 2 * pad);
    }
  }

  // Shows a sprite on a named frame of its sheet, or hides it when the name is undefined (no stage, no size). The frame is set on change only.
  private showFrame(sprite: Phaser.GameObjects.Sprite, sheet: WorldSheetId, name: string | undefined, row: number): void {
    if (name === undefined) {
      setVisibleIf(sprite, false);
      return;
    }
    this.setFrame(sprite, sheet, name, row);
    setVisibleIf(sprite, true);
  }

  // Motes (D10, D15): each mote's alpha is the queue's times its fall fade (1 - progress). Its position is the orbit at the orbit clock (static
  // under reduced motion, frozen by the queue's freeze off script) plus the fall drop (fallArtPx x progress) toward the lamp. The script keeps
  // the orbit (every moth on its own path, full rate) and draws every mote at full alpha.
  private paintMotes(state: WorldVisualState, tween: WorldTween): void {
    const head = this.lampHead;
    const script = this.propScript !== null;
    const on = head !== null && state.props.motes;
    if (head === null) {
      for (const mote of this.motes) setVisibleIf(mote, false);
      return;
    }
    const time = this.reduced ? 0 : this.orbitMs;
    // A moved orbit clock (or a stale sprite) places every mote again; otherwise a mote writes only when its fall or its alpha moved.
    const moved = this.stale || time !== this.orbitTime;
    // The orbit is solved only when the clock moved (a freeze or reduced motion holds it still).
    if (time !== this.orbitTime) {
      this.orbitTime = time;
      for (let i = 0; i < this.motes.length; i++) this.orbits[i] = moteOrbit(i, time, WORLD_AMBIENT.seeds.motes);
    }
    for (let i = 0; i < this.motes.length; i++) {
      const mote = this.motes[i];
      const o = this.orbits[i];
      if (mote === undefined || o === undefined) continue;
      const fall = script ? 0 : clamp01(tween.moteFall[i] ?? 0);
      const alpha = script ? 1 : clamp01(tween.motes[i] ?? 0) * (1 - fall);
      if (!moved && fall === this.lastMoteFall[i] && alpha === this.lastMoteAlpha[i]) continue;
      this.lastMoteFall[i] = fall;
      this.lastMoteAlpha[i] = alpha;
      setPositionIf(mote, head.x + o.dx * PIXEL_SCALE, head.y + (o.dy + fall * WORLD_ENV.motes.fallArtPx) * PIXEL_SCALE);
      setAlphaIf(mote, alpha);
      setVisibleIf(mote, on && alpha > SHOWN_ALPHA);
    }
  }

  // Girl mini planes (eras II-III, the mini stages): the girl runner's frame and alpha while she is on the mini stage (WORLD_FRAMES.girlMini),
  // else cold at alpha 1 (the look of the old static pin, also the finale and postgame script's look).
  private paintGirlMini(state: WorldVisualState): void {
    const row = state.eraRow;
    const g = this.girl;
    const live = this.propScript === null && g !== null && WORLD_FRAMES.girlMini.includes(g.frame) ? g : null;
    const name = live === null ? 'cold' : live.frame;
    const base = live === null ? 1 : clamp01(live.alpha);
    const alpha = this.miniMs > 0 ? this.lanternAlpha(base) : base;
    this.setFrame(this.girlMini, 'girlMini', name, row);
    setAlphaIf(this.girlMini, alpha);
    this.setFrame(this.girlMiniNear, 'girlMini', name, row);
    setAlphaIf(this.girlMiniNear, alpha);
  }

  // The mini's alpha during a lantern answer: base to miniTo and back over the span (the peak at its middle). Reduced motion holds miniTo.
  private lanternAlpha(base: number): number {
    if (this.reduced) return this.miniTo;
    const k = 1 - Math.abs(2 * (1 - this.miniMs / this.miniSpanMs) - 1);
    return base + (this.miniTo - base) * k;
  }

  // Puddle (WP24 C5): the size crossfades on the twin (from at full alpha, to on the twin at k). The look is grey, ring or black: the ring
  // look (glint, ripple, downbeat) wins while it runs; a moving size shows one look on both layers; once the size settles, the black look
  // crossfades in on the twin (puddleBlackK). The script keeps its whole frame.
  private paintPuddle(state: WorldVisualState, tween: WorldTween): void {
    const at = this.puddleAt;
    const row = state.eraRow;
    const script = this.propScript;
    if (at === null) {
      setVisibleIf(this.puddle, false);
      setVisibleIf(this.puddleTwin, false);
      return;
    }
    setPositionIf(this.puddle, at.x, at.y);
    setPositionIf(this.puddleTwin, at.x, at.y);
    const looks = WORLD_PUDDLE.looks;
    const ring = this.puddleRingMs > 0;
    if (script !== null) {
      const look = ring ? looks.ring : state.props.puddle.look === 'black' ? looks.black : looks.grey;
      const name = script.puddles === 'whole' ? 'whole' : puddleFrameOf(state.props.puddle.size, look);
      this.showFrame(this.puddle, 'puddle', name, row);
      setVisibleIf(this.puddleTwin, false);
      return;
    }
    const from = Math.round(tween.puddle.from);
    const to = Math.round(tween.puddle.to);
    const moving = from !== to;
    const blackK = clamp01(tween.puddleBlackK);
    const mainLook = ring ? looks.ring : blackK >= 1 ? looks.black : looks.grey;
    let twinK = 0;
    if (moving) twinK = clamp01(tween.puddle.k);
    else if (!ring && blackK > 0 && blackK < 1) twinK = blackK;
    const twinLook = moving ? mainLook : looks.black;
    this.showFrame(this.puddle, 'puddle', puddleFrameOf(from, mainLook), row);
    this.showFrame(this.puddleTwin, 'puddle', twinK > 0 ? puddleFrameOf(moving ? to : from, twinLook) : undefined, row);
    setAlphaIf(this.puddleTwin, twinK);
  }

  // Ground pieces (WP24 C5): the dog's hole, the sprout and the paper scraps. The script keeps the state drawing (no crossfade, sway, burn or
  // flutter); otherwise the hole and the sprout cross from their Blend, the sprout sways on the wind and the scraps burn and flutter.
  private paintGround(state: WorldVisualState, tween: WorldTween, ambient: Ambient): void {
    this.paintHole(state, tween);
    this.paintSprout(state, tween, ambient);
    this.paintScraps(state, tween, ambient);
  }

  // Hole (dog digging, eras I-V): the stage crossfades from its Blend (from at full alpha, to on the twin at k). Hidden before the first stage,
  // at the script's hidden hole, and where the placement has no hole.
  private paintHole(state: WorldVisualState, tween: WorldTween): void {
    const at = this.holeAt;
    const row = state.eraRow;
    const script = this.propScript;
    if (at === null || script?.hole === 'hidden') {
      setVisibleIf(this.hole, false);
      setVisibleIf(this.holeTwin, false);
      return;
    }
    setPositionIf(this.hole, at.x, at.y);
    setPositionIf(this.holeTwin, at.x, at.y);
    if (script !== null) {
      this.showFrame(this.hole, 'hole', holeNameOf(state.props.holeStage), row);
      setVisibleIf(this.holeTwin, false);
      return;
    }
    const from = Math.round(tween.hole.from);
    const to = Math.round(tween.hole.to);
    const k = clamp01(tween.hole.k);
    // Unchanged stages and blend since the last paint: the frames and the alpha already show.
    if (!this.stale && from === this.lastHoleFrom && to === this.lastHoleTo && k === this.lastHoleK) return;
    this.lastHoleFrom = from;
    this.lastHoleTo = to;
    this.lastHoleK = k;
    this.showFrame(this.hole, 'hole', holeNameOf(from), row);
    this.showFrame(this.holeTwin, 'hole', from === to || k <= 0 ? undefined : holeNameOf(to), row);
    setAlphaIf(this.holeTwin, k);
  }

  // Sprout (eras III-V): the stage crossfades from its Blend on the twin. The wind sways it in whole world px (WORLD_AMBIENT.sway), not under
  // reduced motion or the script. The script keeps the state's stage or the bloom.
  private paintSprout(state: WorldVisualState, tween: WorldTween, ambient: Ambient): void {
    const at = this.sproutAt;
    const row = state.eraRow;
    const script = this.propScript;
    if (at === null) {
      setVisibleIf(this.sprout, false);
      setVisibleIf(this.sproutTwin, false);
      return;
    }
    const sway = script === null && !this.reduced
      ? Math.round(ambient.wind * WORLD_AMBIENT.sway.sproutPx * Math.sin(TWO_PI * this.swingPhase))
      : 0;
    // The sway moves both layers in whole px: they are placed again only when the rounded offset moved (or the sprites are stale).
    if (this.stale || sway !== this.lastSway) {
      this.lastSway = sway;
      setPositionIf(this.sprout, at.x + sway, at.y);
      setPositionIf(this.sproutTwin, at.x + sway, at.y);
    }
    if (script !== null) {
      this.showFrame(this.sprout, 'sprout', script.sprout === 'bloom' ? 'bloom' : sproutNameOf(state.props.sprout), row);
      setVisibleIf(this.sproutTwin, false);
      return;
    }
    const from = Math.round(tween.sprout.from);
    const to = Math.round(tween.sprout.to);
    const k = clamp01(tween.sprout.k);
    // Unchanged stages and blend since the last paint: the frames and the alpha already show.
    if (!this.stale && from === this.lastSproutFrom && to === this.lastSproutTo && k === this.lastSproutK) return;
    this.lastSproutFrom = from;
    this.lastSproutTo = to;
    this.lastSproutK = k;
    this.showFrame(this.sprout, 'sprout', sproutNameOf(from), row);
    this.showFrame(this.sproutTwin, 'sprout', from === to || k <= 0 ? undefined : sproutNameOf(to), row);
    setAlphaIf(this.sproutTwin, k);
  }

  // Paper scraps (era III on): each keeps its frame and burns on the tween's scrapBurn (0 whole .. 1 gone). The tint ramps white -> ember over the
  // first half of the burn and ember -> char over the second, and the alpha falls across the second half, so nothing steps. Awake scraps
  // flutter on the wind in whole world px (WORLD_AMBIENT.sway): a sideways sway and a lift, phased on the receiver's swing clock with a fixed
  // offset per scrap. Reduced motion holds them still. The script keeps the state's count, with no burn and no flutter.
  private paintScraps(state: WorldVisualState, tween: WorldTween, ambient: Ambient): void {
    const row = state.eraRow;
    const script = this.propScript !== null;
    const count = state.props.scraps;
    const wind = ambient.wind;
    const flutter = !script && !this.reduced;
    for (let i = 0; i < this.scraps.length; i++) {
      const sprite = this.scraps[i];
      const at = this.scrapAt[i] ?? null;
      const name = SCRAP_NAMES[i];
      if (sprite === undefined || name === undefined) continue;
      if (at === null) {
        this.lastScrapBurn[i] = NaN; // a hidden scrap repaints in full when it shows again
        setVisibleIf(sprite, false);
        continue;
      }
      const burn = script ? 0 : clamp01(tween.scrapBurn[i] ?? 1);
      const gone = script ? i >= count : burn >= 1;
      if (gone) {
        this.lastScrapBurn[i] = NaN;
        setVisibleIf(sprite, false);
        continue;
      }
      const phase = TWO_PI * (this.swingPhase + i / this.scraps.length);
      const dx = flutter ? Math.round(wind * WORLD_AMBIENT.sway.scrapDxPx * Math.sin(phase)) : 0;
      const liftPhase = phase + WORLD_AMBIENT.sway.scrapLiftPhaseRad;
      const lift = flutter ? Math.round(wind * WORLD_AMBIENT.sway.scrapLiftPx * Math.max(0, Math.sin(liftPhase))) : 0;
      // Unchanged burn and rounded flutter since the last paint: the sprite already shows them (the tint and the alpha follow the burn).
      if (!this.stale && burn === this.lastScrapBurn[i] && dx === this.lastScrapDx[i] && lift === this.lastScrapLift[i]) continue;
      this.lastScrapBurn[i] = burn;
      this.lastScrapDx[i] = dx;
      this.lastScrapLift[i] = lift;
      const late = burn >= BURN_SPLIT;
      const t = late ? (burn - BURN_SPLIT) / (1 - BURN_SPLIT) : burn / BURN_SPLIT;
      const tint = late ? mixRgb(PALETTE.ember, PALETTE.grayDark, t) : mixRgb(NO_TINT, PALETTE.ember, t);
      if (this.scrapTint[i] !== tint) {
        this.scrapTint[i] = tint;
        sprite.setTint(tint);
      }
      setPositionIf(sprite, at.x + dx, at.y - lift);
      setAlphaIf(sprite, late ? 1 - t : 1);
      setVisibleIf(sprite, true);
      this.setFrame(sprite, 'scraps', name, row);
    }
  }

  // Lamp wobble (WP28b, D6 b): the glow offset is resampled every WORLD_FX.lampWobble.stepMs and held between samples (a render cadence, so the
  // glow's per-frame cost stays flat). Zero under reduced motion.
  private stepWobble(): void {
    if (this.reduced) {
      this.lampWobble = 0;
      return;
    }
    const gap = this.nowMs - this.wobbleAtMs;
    if (gap >= 0 && gap < WORLD_FX.lampWobble.stepMs) return;
    this.wobbleAtMs = this.nowMs;
    this.lampWobble = lampWobbleAt(this.nowMs, this.reachLevel);
  }

  // Era IV puddle rings (WP28b, D6 c IV): while the era's reach level is at least minLevel, a ring every puddleRingGapMs (4-8 s). Off under reduced
  // motion and outside era IV; the next ring is timed afresh when the rings turn on again.
  private stepRings(): void {
    const { era, minLevel, seed } = WORLD_FX.puddleRing;
    const on = this.state !== null && this.state.era === era && !this.reduced && this.reachLevel >= minLevel;
    if (!on) {
      this.puddleNextMs = Number.NaN;
      return;
    }
    if (Number.isNaN(this.puddleNextMs)) {
      this.puddleNextMs = this.nowMs + puddleRingGapMs(this.puddleRingK, seed);
      return;
    }
    if (this.nowMs < this.puddleNextMs) return;
    this.puddleRingK += 1;
    this.puddleRing();
    this.puddleNextMs = this.nowMs + puddleRingGapMs(this.puddleRingK, seed);
  }

  // Downbeat accents: era IV window breathe and lamp pulse, and the puddle ring (WORLD_PUDDLE.ringEra only; ripple(ringEra) also rings).
  private onDownbeat(state: WorldVisualState): void {
    if (state.props.windowsBreathe) this.breatheMs = WORLD_ERA_ENV.accentMs;
    if (state.props.lampPulse) this.pulseMs = WORLD_ERA_ENV.accentMs;
    if (state.era === WORLD_PUDDLE.ringEra) this.puddleRingMs = WORLD_ENV.rippleMs;
  }

  // Era IV hum (WP28b, D6 c IV): the offset in x (world px) of one loose object at its phase; 0 while the hum is off (outside era IV, reduced motion,
  // hidden). The lamp and the clock take phase 0 and 2/3, the booth family 1/3, so the objects do not move in step.
  private humAt(phase01: number): number {
    const on = this.live && this.state !== null && this.state.era === WORLD_FX.hum.era && !this.reduced;
    return on ? humOffsetPx(this.reachLevel, this.nowMs, phase01) * PIXEL_SCALE : 0;
  }

  // Places the hummed objects at their placement plus their offset (every paint; setXIf writes only a moved x). The booth family (booth, twin, fog,
  // tally marks) and the receiver (paintReceiver adds humBooth) move together; the clock hands draw at clockOrigin.
  private paintHum(): void {
    const lamp = this.lampHead;
    if (lamp !== null) {
      const x = lamp.x + this.humAt(0);
      setXIf(this.lamp, x);
      setXIf(this.lampTwin, x);
      setXIf(this.lampGlow, x);
    }
    this.humBooth = this.humAt(1 / 3);
    const boothAt = this.boothAt;
    if (boothAt !== null) {
      const x = boothAt.x + this.humBooth;
      setXIf(this.booth, x);
      setXIf(this.boothTwin, x);
      setXIf(this.boothFogLayer, x);
      // The tally marks sit in the booth's pane (the same offset placeStatic gives them).
      setXIf(this.marks, boothAt.x - this.booth.displayWidth / 2 + WORLD_MARKS.pane.x * PIXEL_SCALE + this.humBooth);
    }
    const clockAt = this.clockAt;
    if (clockAt !== null) {
      this.clockOrigin.x = clockAt.x + this.humAt(2 / 3);
      this.clockOrigin.y = clockAt.y;
      setXIf(this.clock, this.clockOrigin.x);
    }
  }

  // Machine pebbles (WP28b, D6 c I): era I only, pebbleCount(L) pebbles in all, so the extras past the booth's two stand on the machine's feet.
  // Each extra hops 1-2 art px at hopHz (a half sine, phased per slot); reduced motion holds them still. Redrawn only when the count or a lift moved.
  private paintMachinePebbles(state: WorldVisualState, script: PropScript | null): void {
    const { era, hopPx, hopHz, feetArtPx } = WORLD_FX.pebbles;
    const count = state.era === era && script === null ? Math.min(PEBBLE_SLOTS, pebbleCount(this.reachLevel) - WORLD_ENV.pebbles.count) : 0;
    setVisibleIf(this.machinePebbles, count > 0);
    if (count <= 0) return;
    let moved = count !== this.machineShown;
    for (let i = 0; i < count; i++) {
      const amp = i % 2 === 0 ? hopPx[0] : hopPx[1];
      const lift = this.reduced ? 0 : pebbleLiftArt(this.nowMs, hopHz, amp, i / PEBBLE_SLOTS);
      if (lift !== this.machineLift[i]) {
        this.machineLift[i] = lift;
        moved = true;
      }
    }
    if (!moved) return;
    this.machineShown = count;
    const g = this.machinePebbles;
    g.clear();
    g.fillStyle(PALETTE.industrialGray, 1);
    for (let i = 0; i < count; i++) {
      const art = feetArtPx[i] ?? 0;
      const lift = this.machineLift[i] ?? 0;
      g.fillRect(MACHINE_ANCHOR.x + art * PIXEL_SCALE, GROUND_Y - PIXEL_SCALE - lift * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
    }
  }

  // Clock hands: redrawn only when the clock moves, the minute twitch flips or the second hand turns HAND_REDRAW_DEG (state mode draws them once).
  private paintHands(at: Vec2, secondDeg: number | null, twitch: boolean): void {
    const drawn = this.handsAt;
    if (drawn !== null && drawn.x === at.x && drawn.y === at.y && this.handsTwitch === twitch && !turned(secondDeg, this.handsSec)) return;
    this.handsAt = { x: at.x, y: at.y };
    this.handsSec = secondDeg;
    this.handsTwitch = twitch;
    this.drawHands(at, secondDeg, twitch);
  }

  // Clock hands at the face centre, stopped at WORLD_ENV.clock.hour:minute, 1 art px thick. The twitch turns the minute hand
  // WORLD_AMBIENT.clockTwitchDeg past it. The script's second hand (secondDeg) is 1 art px too, as long as the minute hand
  // (WORLD_ENV.clock has no second length).
  private drawHands(at: Vec2, secondDeg: number | null, twitch: boolean): void {
    const { faceCenterArt, hourLenArt, minuteLenArt, hour, minute, color } = WORLD_ENV.clock;
    const centre: Vec2 = { x: at.x + faceCenterArt.x * PIXEL_SCALE, y: at.y + faceCenterArt.y * PIXEL_SCALE };
    const minuteDeg = minute * 6 + (twitch ? WORLD_AMBIENT.clockTwitchDeg : 0);
    const tips: Vec2[] = [
      handTip(centre, ((hour % 12) + minute / 60) * 30, hourLenArt * PIXEL_SCALE),
      handTip(centre, minuteDeg, minuteLenArt * PIXEL_SCALE),
    ];
    if (secondDeg !== null) tips.push(handTip(centre, secondDeg, minuteLenArt * PIXEL_SCALE));
    const g = this.hands;
    g.clear();
    g.lineStyle(PIXEL_SCALE, color, 1);
    for (const tip of tips) {
      g.beginPath();
      g.moveTo(centre.x, centre.y);
      g.lineTo(tip.x, tip.y);
      g.strokePath();
    }
  }

  // Pebbles: one 1 art px rect per spot, sitting on the booth's feet line and lifted by lift world px.
  private drawPebbles(boothAt: Vec2, lift: number): void {
    const g = this.pebbles;
    g.clear();
    g.fillStyle(PALETTE.industrialGray, 1);
    for (const dx of WORLD_ENV.pebbles.spotsWorldPx.slice(0, WORLD_ENV.pebbles.count)) {
      g.fillRect(boothAt.x + dx, boothAt.y - PIXEL_SCALE - lift, PIXEL_SCALE, PIXEL_SCALE);
    }
  }

  private sample(ms: number): void {
    this.timings.record(ms);
  }
}
