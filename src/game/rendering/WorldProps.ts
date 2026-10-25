// Living-world environment renderer (WP23a): the girl's window and mini on the far planes, the six lit skyline windows with their
// halo, the street lamp with its glow and ash motes, the payphone booth with its receiver and tally marks, the street clock with
// its hands stopped at the bible hour, the dog's stake and hole, and three paper scraps (DENIZEN_ART §1.4, §2.4, §2.5, §5; bible §4.1).
// Why: the simulation decides what shows (WorldVisualState and the placements); this file only draws it, on two far-plane containers
// and the shared back and front rows. Pools only: everything is built once in the constructor, the tally canvas is redrawn in place,
// setInteractive is never called, and colours come from data or the palette. Reduced motion per bible §7.7.
// Units: art px * PIXEL_SCALE = world px. Motes and the lamp head use art px. hopPx and jerkPx are world px (2 = the bible's "1 px"
// at PIXEL_SCALE 2).
import type Phaser from 'phaser';
import type { Vec2 } from '../../data/machineComponents';
import { PALETTE } from '../../data/palette';
import { PIXEL_SCALE } from '../../data/world';
import {
  WORLD_DEPTH_OFFSETS, WORLD_ENV, WORLD_ERA_ROW, WORLD_FAR_PLANES, WORLD_FRAMES, WORLD_HOLE, WORLD_LOOPS, WORLD_MARKS, WORLD_ROWS,
  WORLD_SHEET_KEYS,
} from '../../data/livingWorld';
import type { FramingKey, GroundId, WorldPlacement, WorldSheetId } from '../../data/livingWorld';
import { WORLD_ERA_ENV, WORLD_PUDDLE } from '../../data/worldEras';
import type { CameraPose } from '../math/finale';
import { fadeStep } from '../math/parallax';
import { screenOfWorld } from '../math/worldPlacement';
import type { SpeakerAnchor } from '../math/worldPlacement';
import { createTapeClock, isDownbeat, loopFrameAt, moteOrbit, sheetFrameIndex, tallyRects, windowFlicker } from '../math/worldPlayback';
import type { PlaybackMode, TapeClock } from '../math/worldPlayback';
import type { MotesMode, WorldVisualState } from '../math/worldState';
import type { PropScript, WorldScriptFrame } from '../math/worldScript';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

type Visible = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;
type Placements = Readonly<Record<GroundId, WorldPlacement | null>>;
type FlickerFrame = 'flickerA' | 'flickerB';

// Canvas texture of the booth's tally marks: drawn into the pane, removed on destroy.
const MARKS_KEY = 'world.payphone#marks';
// Update durations kept for stats().meanMs.
const STAT_SAMPLES = 120;
// Upper bound on flicker holds consumed in one update (a hold is at least WORLD_ENV.windowFlickerMs[0] long).
const FLICKER_CATCHUP_MAX = 64;
// Second-hand repaint threshold in degrees: the hands are redrawn only when the second hand has turned this far (render throttle).
const HAND_REDRAW_DEG = 1;

// CSS colour of a 0xRRGGBB number (the same form as PALETTE_CSS).
function cssOf(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Feet y of a ground placement: its row's feet line plus the placement's dy (the fallen lantern lies at the girl's feet, AD3d H3).
function feetOf(p: WorldPlacement): number {
  return WORLD_ROWS[p.row].y + (p.dy ?? 0);
}

// Mains flicker multiplier (DENIZEN_ART §5): era II only and never under reduced motion (bible §7.7); 1 otherwise.
function mainsOf(era: number, reduced: boolean, nowMs: number): number {
  if (era < 2 || reduced) return 1;
  const { amp, periodMs } = WORLD_ENV.mainsFlicker;
  return 1 + amp * Math.sin((2 * Math.PI * nowMs) / periodMs);
}

// Fade target of the six lit windows and their halo (WP23a W1-C): lit with powerLines, dim while only the generator is owned (the
// era II entry), off in era I. The mains flicker still scales the lit group.
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

// Ash mote offset from the lamp head, art px. Orbit and freeze use the orbit at tMs; fall drifts each mote down fallArtPx into the
// lamp over periodMs (phase i / count, then wraps) at its fixed orbit x.
function moteOffsetOf(i: number, mode: MotesMode, tMs: number): { dx: number; dy: number } {
  if (mode !== 'fall') return moteOrbit(i, tMs);
  const { count, fallArtPx, periodMs } = WORLD_ENV.motes;
  const p = (tMs / periodMs + i / count) % 1;
  return { dx: moteOrbit(i, 0).dx, dy: (p - 1) * fallArtPx };
}

// Environment props of eras I-V. One instance per scene; the director calls apply() with each visual state and placement set,
// update() every frame, and hideAll() when the layer is off. setScript(frame) drives the finale and postgame props (WP23b).
export class WorldProps {
  private readonly scene: Phaser.Scene;
  private readonly beatLow: (nowMs: number) => boolean;
  private readonly owned: Visible[] = [];
  private readonly frames = new Map<Phaser.GameObjects.Sprite, { row: number; name: string }>();
  private readonly farWindow: Phaser.GameObjects.Container;
  private readonly farPylon: Phaser.GameObjects.Container;
  private readonly halo: Phaser.GameObjects.Graphics;
  private readonly windowSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly girlWindow: Phaser.GameObjects.Sprite;
  private readonly girlMini: Phaser.GameObjects.Sprite;
  private readonly girlMiniNear: Phaser.GameObjects.Sprite;
  private readonly puddle: Phaser.GameObjects.Sprite;
  private readonly sprout: Phaser.GameObjects.Sprite;
  private readonly lantern: Phaser.GameObjects.Sprite;
  private readonly lamp: Phaser.GameObjects.Sprite;
  private readonly lampGlow: Phaser.GameObjects.Sprite;
  private readonly motes: Phaser.GameObjects.Sprite[] = [];
  private readonly booth: Phaser.GameObjects.Sprite;
  private readonly receiver: Phaser.GameObjects.Sprite;
  private readonly marks: Phaser.GameObjects.Image;
  private readonly marksTexture: Phaser.Textures.CanvasTexture;
  private readonly clock: Phaser.GameObjects.Sprite;
  private readonly hands: Phaser.GameObjects.Graphics;
  private readonly stake: Phaser.GameObjects.Sprite;
  private readonly hole: Phaser.GameObjects.Sprite;
  private readonly scraps: Phaser.GameObjects.Sprite[] = [];
  private readonly pebbles: Phaser.GameObjects.Graphics;
  private readonly tape: TapeClock = createTapeClock();
  private readonly samples: number[] = [];
  private sampleAt = 0;

  private state: WorldVisualState | null = null;
  private reduced = false;
  private live = false;
  private nowMs = 0;
  private flickerK = 0;
  private flickerLeftMs = windowFlicker(0, WORLD_ENV.windowFlickerSeed).holdMs;
  private flickerFrame: FlickerFrame = windowFlicker(0, WORLD_ENV.windowFlickerSeed).frame;
  private windowFade = 0;
  private mainsMul = 1;
  private ringMs = -1;
  private glowBumpMs = 0;
  private pebbleHop = false;
  private pebblesKey = '';
  private extraTicks = 0;
  private receiverOn = false;
  private marksDrawn = -1;
  private marksFogDrawn = false;
  private handsKey = '';
  private boothAt: Vec2 | null = null;
  private lampHead: Vec2 | null = null;
  // Downbeat accents (era IV) and their timers: window breathe, lamp pulse, puddle ring. Off under reduced motion.
  private beatPrev = false;
  private breatheMs = 0;
  private pulseMs = 0;
  private puddleRingMs = 0;
  private haloLit = -1;
  private motesMode: MotesMode = 'orbit';
  private motesHoldMs = 0;
  // Script (WP23b): the finale prop states (null = the state drawing), the last placements, the clock feet and the second hand drawn.
  private propScript: PropScript | null = null;
  private placements: Placements | null = null;
  private clockAt: Vec2 | null = null;
  private handsSec: number | null = null;

  constructor(scene: Phaser.Scene, rows: WorldRows, beatLow: (nowMs: number) => boolean = () => false) {
    this.scene = scene;
    this.beatLow = beatLow;
    const far = WORLD_FAR_PLANES;

    // Far planes: one scroll-factor container each. Children ignore their own scroll factor, so it is set on the container.
    this.farWindow = scene.add.container(0, 0).setScrollFactor(far.window.sf).setDepth(far.window.depth);
    this.farPylon = scene.add.container(0, 0).setScrollFactor(far.pylon.sf).setDepth(far.pylon.depth);
    this.owned.push(this.farWindow, this.farPylon);

    // The halo is one Graphics added before the windows, so it draws behind them; drawHalo() fills it per lit count.
    this.halo = this.graphicsIn(this.farWindow, 0);

    // Six lit windows: the 4x6 frame cropped to each window's art size (3x6, 4x6 and 2x4 entries).
    for (const w of far.windows) {
      const sprite = this.spriteIn(this.farWindow, 'windowLit', 0, 0, 0);
      sprite.setPosition(far.window.tileOriginX + PIXEL_SCALE * w.artX, far.window.tileTopY + PIXEL_SCALE * w.artY);
      sprite.setCrop(0, 0, w.w, w.h);
      this.windowSprites.push(sprite);
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
    this.sprout = this.spriteIn(back, 'sprout', 0.5, 1, WORLD_DEPTH_OFFSETS.scraps);
    // The lantern stays hidden until the script drops it; the front row lets it lie at the girl's feet (its placement dy).
    this.lantern = this.spriteIn(front, 'lantern', 0.5, 1, WORLD_DEPTH_OFFSETS.lamp);
    this.lamp = this.spriteIn(back, 'lamp', 0.5, 1, WORLD_DEPTH_OFFSETS.lamp);
    this.lampGlow = this.spriteIn(back, 'lampGlow', 0.5, 0.5, WORLD_DEPTH_OFFSETS.glow);
    for (let i = 0; i < WORLD_ENV.motes.count; i++) {
      this.motes.push(this.spriteIn(back, 'mote', 0.5, 0.5, WORLD_DEPTH_OFFSETS.motes));
    }
    this.booth = this.spriteIn(back, 'payphone', 0.5, 1, WORLD_DEPTH_OFFSETS.booth);
    this.receiver = this.spriteIn(back, 'receiver', 0.5, 0, WORLD_DEPTH_OFFSETS.receiver);

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
    this.hands = this.graphicsIn(back, WORLD_DEPTH_OFFSETS.clock);
    this.pebbles = this.graphicsIn(back, WORLD_DEPTH_OFFSETS.scraps);
    for (let i = 0; i < WORLD_FRAMES.scraps.length; i++) {
      this.scraps.push(this.spriteIn(back, 'scraps', 0.5, 1, WORLD_DEPTH_OFFSETS.scraps));
    }
    this.stake = this.spriteIn(front, 'stakeChain', 0.5, 1, WORLD_DEPTH_OFFSETS.stakeChain);
    this.hole = this.spriteIn(front, 'hole', 0.5, 1, WORLD_DEPTH_OFFSETS.hole);

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

  /** Advances the tape clock, the flicker, the window fade, the ring and the ripple timers, then repaints the moving pieces. */
  update(dtMs: number, crankSteps: number, nowMs: number): void {
    const started = performance.now();
    const state = this.state;
    if (this.live && state !== null) {
      const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
      if (Number.isFinite(nowMs)) this.nowMs = nowMs;
      this.tape.advance(dt, state.mode, crankSteps);
      this.stepFlicker(dt, state.mode, crankSteps);
      this.windowFade = fadeStep(this.windowFade, windowTargetOf(state.props.windows), dt, WORLD_ENV.windowGlow.fadeMs);
      this.stepRing(dt);
      this.glowBumpMs = Math.max(0, this.glowBumpMs - dt);
      this.breatheMs = Math.max(0, this.breatheMs - dt);
      this.pulseMs = Math.max(0, this.pulseMs - dt);
      this.puddleRingMs = Math.max(0, this.puddleRingMs - dt);
      // One downbeat edge per update: the accents start on it (never under reduced motion).
      const low = this.beatLow(this.nowMs);
      if (isDownbeat(this.beatPrev, low) && !this.reduced) this.onDownbeat(state);
      this.beatPrev = low;
      this.mainsMul = mainsOf(state.era, this.reduced, this.nowMs);
      this.paintDynamic(state);
      this.pebbleHop = false;
    }
    this.sample(performance.now() - started);
  }

  /** World ripple for a tier-up era: era I = pebbles hop and one extra receiver swing; era II = lamp one step brighter; era III (the
   * puddle's first era) = puddle glint; era IV (WORLD_PUDDLE.ringEra) = puddles ring. The puddle beats are off under reduced motion. */
  ripple(era: number): void {
    if (era === 1) {
      this.pebbleHop = true;
      if (!this.tape.frozen()) this.extraTicks += 1;
    } else if (era === 2) {
      this.glowBumpMs = WORLD_ENV.rippleMs;
    } else if (era === WORLD_PUDDLE.minEra) {
      if (!this.reduced) this.puddleRingMs = WORLD_PUDDLE.glintMs;
    } else if (era === WORLD_PUDDLE.ringEra && !this.reduced) {
      this.puddleRingMs = WORLD_ENV.rippleMs;
    }
  }

  /** Lamp flicker (copperWinding / transformer): the lamp glow steps brighter for WORLD_ENV.rippleMs. */
  lampFlicker(): void {
    this.glowBumpMs = WORLD_ENV.rippleMs;
  }

  /** Payphone ring: WORLD_ENV.ring bursts of ring0 / ring1 with the receiver jerking. Restarts if one is running. */
  ring(): void {
    this.ringMs = 0;
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
    const state = this.state;
    if (!this.live || state === null) return null;
    if (id === 'payphone') {
      if (this.boothAt === null) return null;
      // Script (the receiver is hung up): head = the booth top, above its hood; feet = the booth feet (AD4 F2, so the bubble ladder
      // can sit below the booth). State: the receiver's top and bottom.
      if (this.propScript !== null) {
        const b = this.booth;
        const top = screenOfWorld({ x: b.x, y: b.y - b.displayHeight }, 1, cam);
        return { head: top, feet: screenOfWorld({ x: b.x, y: b.y }, 1, cam) };
      }
      const r = this.receiver;
      return {
        head: screenOfWorld({ x: r.x, y: r.y }, 1, cam),
        feet: screenOfWorld({ x: r.x, y: r.y + r.displayHeight }, 1, cam),
      };
    }
    // Ground: LivingWorld draws her (no plane here). Mini and miniNear: the pylon plane sprite of that stage.
    const stage = state.girl.stageName;
    if (stage === 'ground') return null;
    const pylon = stage === 'mini' ? this.girlMini : stage === 'miniNear' ? this.girlMiniNear : null;
    if (pylon !== null) {
      const sf = WORLD_FAR_PLANES.pylon.sf;
      return {
        head: screenOfWorld({ x: pylon.x, y: pylon.y - pylon.displayHeight }, sf, cam),
        feet: screenOfWorld({ x: pylon.x, y: pylon.y }, sf, cam),
      };
    }
    const w = this.girlWindow;
    const sf = WORLD_FAR_PLANES.window.sf;
    const cx = w.x + w.displayWidth / 2;
    return {
      head: screenOfWorld({ x: cx, y: w.y }, sf, cam),
      feet: screenOfWorld({ x: cx, y: w.y + w.displayHeight }, sf, cam),
    };
  }

  /** Debug view: one entry per probe id. x is the world x of a shown object (0 when hidden or a far-plane prop). */
  probe(): { id: string; variant: string; x: number; visible: boolean; speaking: boolean }[] {
    const on = this.live;
    const state = this.state;
    const stage = state === null ? 'ground' : state.girl.stageName;
    const dark = state !== null && state.props.girlWindow === 'dark';
    const at = (s: Phaser.GameObjects.Sprite): number => (on && s.visible ? s.x : 0);
    const shown = (s: Phaser.GameObjects.Sprite): boolean => on && s.visible;
    // The girl's plane by stage: window (the window sprite), mini, miniNear; none on the ground (LivingWorld draws her).
    const plane = stage === 'mini' ? this.girlMini : stage === 'miniNear' ? this.girlMiniNear : this.girlWindow;
    const restored = this.propScript?.girlWindow === 'restored';
    const variant = stage === 'mini' ? 'mini' : stage === 'miniNear' ? 'mini-near' : stage === 'window'
      ? (restored ? 'window-restored' : dark ? 'window-dark' : 'window-flicker') : 'none';
    return [
      { id: 'lamp', variant: this.frameName(this.lamp), x: at(this.lamp), visible: shown(this.lamp), speaking: false },
      { id: 'clock', variant: this.frameName(this.clock), x: at(this.clock), visible: shown(this.clock), speaking: false },
      { id: 'payphone', variant: this.frameName(this.booth), x: at(this.booth), visible: shown(this.booth), speaking: false },
      { id: 'receiver', variant: this.frameName(this.receiver), x: at(this.receiver), visible: shown(this.receiver), speaking: false },
      { id: 'puddle', variant: this.frameName(this.puddle), x: at(this.puddle), visible: shown(this.puddle), speaking: false },
      { id: 'sprout', variant: this.frameName(this.sprout), x: at(this.sprout), visible: shown(this.sprout), speaking: false },
      { id: 'lantern', variant: this.frameName(this.lantern), x: at(this.lantern), visible: shown(this.lantern), speaking: false },
      // The restored window (LAST LOOK and the postgame) reports as the girl's window plane while it shows.
      restored
        ? { id: 'girl', variant: 'window-restored', x: 0, visible: on && this.girlWindow.visible && this.girlWindow.alpha > 0, speaking: false }
        : { id: 'girl', variant, x: 0, visible: stage !== 'ground' && shown(plane), speaking: false },
    ];
  }

  /** Hides every object and cancels the ring, ripple and accent timers. apply() with a visible state shows them again. */
  hideAll(): void {
    this.live = false;
    this.ringMs = -1;
    this.glowBumpMs = 0;
    this.breatheMs = 0;
    this.pulseMs = 0;
    this.puddleRingMs = 0;
    this.pebbleHop = false;
    for (const o of this.owned) o.setVisible(false);
  }

  /** Object count of this renderer and the mean update time in ms over the last 120 updates. */
  stats(): { objects: number; meanMs: number } {
    const n = this.samples.length;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    return { objects: this.owned.length, meanMs: n === 0 ? 0 : sum / n };
  }

  /** Destroys every object and the marks canvas texture; safe to call twice. */
  destroy(): void {
    for (const o of this.owned) {
      if (o.scene) o.destroy(); // Phaser clears scene on destroy; a container takes its children with it
    }
    this.owned.length = 0;
    this.frames.clear();
    this.windowSprites.length = 0;
    this.motes.length = 0;
    this.scraps.length = 0;
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
    return this.frames.get(sprite)?.name ?? '';
  }

  // Sets a named frame of a sheet row, only when it changes (sheetFrameIndex throws on an unknown name).
  private setFrame(sprite: Phaser.GameObjects.Sprite, sheet: WorldSheetId, name: string, row: number): void {
    const cur = this.frames.get(sprite);
    if (cur !== undefined && cur.name === name && cur.row === row) return;
    this.frames.set(sprite, { row, name });
    sprite.setFrame(sheetFrameIndex(sheet, name, row));
  }

  // Repaints the static and dynamic pieces (apply and setScript); a no-op while hidden or before the first apply().
  private repaint(): void {
    const state = this.state;
    const placements = this.placements;
    if (!this.live || state === null || placements === null) return;
    this.placeStatic(state, placements);
    this.paintDynamic(state);
  }

  // Static placement: positions, visibility and the frames that only the state sets (the script overrides some). Runs on repaint().
  private placeStatic(state: WorldVisualState, p: Placements): void {
    const row = state.eraRow;
    // The girl's window stays on the far plane (dark once she has left it); her pylon planes show by stage (ground: none).
    this.farWindow.setVisible(true);
    this.farPylon.setVisible(state.props.girlMini || state.props.girlMiniNear);
    this.girlWindow.setVisible(true);
    this.girlMini.setVisible(state.props.girlMini);
    this.girlMiniNear.setVisible(state.props.girlMiniNear);
    this.setFrame(this.girlMini, 'girlMini', 'cold', row);
    this.setFrame(this.girlMiniNear, 'girlMini', 'cold', row);
    if (state.props.windowsLit !== this.haloLit) this.drawHalo(state.props.windowsLit);

    // Lamp, glow and motes hang off the lamp placement; the glow and the orbit centre on the lamp head.
    const lamp = p.lamp;
    if (lamp !== null) {
      const feet = feetOf(lamp);
      const head: Vec2 = { x: lamp.x, y: feet - WORLD_ENV.lampHeadArtPx * PIXEL_SCALE };
      this.lampHead = head;
      this.lamp.setPosition(lamp.x, feet).setVisible(true);
      this.setFrame(this.lamp, 'lamp', this.propScript?.lamp === 'restored' ? 'restored' : state.props.lamp, row);
      // The script's warm glow shows with the restored lamp even where the state has the lamp dead (skyAperture).
      const warm = this.propScript?.lampGlow === 'warm';
      this.lampGlow.setPosition(head.x, head.y).setVisible(state.props.lampGlow || warm);
      this.setFrame(this.lampGlow, 'lampGlow', warm || state.props.lampGlowWarm ? 'warm' : 'cold', row);
    } else {
      this.lampHead = null;
      this.lamp.setVisible(false);
      this.lampGlow.setVisible(false);
    }
    const motesOn = this.lampHead !== null && state.props.motes;
    for (const mote of this.motes) {
      mote.setVisible(motesOn);
      this.setFrame(mote, 'mote', this.propScript?.motes === 'moth' ? 'moth' : 'ash', row);
    }

    // Payphone booth: receiver, tally marks and pebbles stand on the booth.
    const booth = p.payphone;
    if (booth !== null) {
      const feet = feetOf(booth);
      this.boothAt = { x: booth.x, y: feet };
      this.booth.setPosition(booth.x, feet).setVisible(true);
    } else {
      this.boothAt = null;
      this.booth.setVisible(false);
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
    const hole = p.hole;
    if (hole !== null && state.props.holeStage > 0 && this.propScript?.hole !== 'hidden') {
      const stage = Math.min(WORLD_HOLE.maxStage, Math.max(WORLD_HOLE.minStage, Math.floor(state.props.holeStage)));
      this.hole.setPosition(hole.x, feetOf(hole)).setVisible(true);
      this.setFrame(this.hole, 'hole', `stage${stage}`, row);
    } else {
      this.hole.setVisible(false);
    }

    // Fallen lantern: the script drops it at its placement (the sprite is built hidden).
    const lantern = p.lantern;
    if (lantern !== null && this.propScript?.lantern === 'fallen') {
      this.lantern.setPosition(lantern.x, feetOf(lantern)).setVisible(true);
      this.setFrame(this.lantern, 'lantern', 'fallen', row);
    } else {
      this.lantern.setVisible(false);
    }

    // Puddle (size and look are set in paintDynamic) and sprout at their placements, feet dyWorldPx down into the ground strip (AD3d
    // H2); hidden at size 0 and stage 0. The script shows the whole puddle (restored sky) and the bloom (frame 4) regardless of the state.
    const puddle = p.puddles;
    if (puddle !== null && (state.props.puddle.size > 0 || this.propScript?.puddles === 'whole')) {
      this.puddle.setPosition(puddle.x, feetOf(puddle) + WORLD_PUDDLE.dyWorldPx).setVisible(true);
    } else {
      this.puddle.setVisible(false);
    }
    const sprout = p.sprout;
    const sproutName = this.propScript?.sprout === 'bloom' ? 'bloom' : WORLD_FRAMES.sprout[state.props.sprout - 1];
    if (sprout !== null && sproutName !== undefined) {
      this.sprout.setPosition(sprout.x, feetOf(sprout) + WORLD_PUDDLE.dyWorldPx).setVisible(true);
      this.setFrame(this.sprout, 'sprout', sproutName, row);
    } else {
      this.sprout.setVisible(false);
    }

    // Paper scraps: one frame each at the kept xs, as many as the state counts.
    const sc = p.scraps;
    const xs: readonly number[] = sc === null ? [] : (sc.xs ?? [sc.x]);
    const count = sc === null ? 0 : Math.min(state.props.scraps, xs.length);
    for (let i = 0; i < this.scraps.length; i++) {
      const sprite = this.scraps[i];
      const x = xs[i];
      if (sprite === undefined) continue;
      if (sc === null || i >= count || x === undefined) {
        sprite.setVisible(false);
        continue;
      }
      sprite.setPosition(x, feetOf(sc)).setVisible(true);
      this.setFrame(sprite, 'scraps', `scrap${i}`, row);
    }
  }

  // Per-frame paint: the girl window flicker, the windows' fade and mains, the lamp glow, the motes, the booth and receiver frames
  // and the ring jerk, and the pebbles. Runs on apply() and on every update().
  private paintDynamic(state: WorldVisualState): void {
    const row = state.eraRow;
    const phase = ringPhaseAt(this.ringMs);

    // Girl window: the flicker frame, or dark once the generator is owned; the script restores it (single-row sheet).
    const wa = this.propScript?.windowsAlpha ?? 1;
    const girlFrame = this.propScript?.girlWindow === 'restored' ? 'restored' : state.props.girlWindow === 'dark' ? 'dark' : this.flickerFrame;
    this.setFrame(this.girlWindow, 'girlWindow', girlFrame, row);
    // The restored window is not one of the six fading windows (AD4 F1): it keeps full alpha at LAST LOOK and in the postgame.
    this.girlWindow.setAlpha(clamp01(WORLD_ENV.windowAlpha * (this.propScript?.girlWindow === 'restored' ? 1 : wa)));

    // Six windows and their halo fade together to windowTargetOf (dim or lit); the mains flicker scales the window alpha in era II.
    // The script's windowsAlpha scales the windows, the halo and the girl window.
    const windowsOn = this.windowFade > 0;
    this.halo.setVisible(windowsOn).setAlpha(this.windowFade * wa);
    const windowAlpha = clamp01(WORLD_ENV.windowAlpha * this.windowFade * this.mainsMul * wa);
    // Only the first windowsLit windows show; era IV breathes them (window frame breathe) for accentMs on each downbeat.
    const breathe = this.breatheMs > 0 ? 'breathe' : 'lit';
    for (let i = 0; i < this.windowSprites.length; i++) {
      const w = this.windowSprites[i];
      if (w === undefined) continue;
      this.setFrame(w, 'windowLit', breathe, row);
      w.setVisible(windowsOn && i < state.props.windowsLit).setAlpha(windowAlpha);
    }

    // Lamp glow: steady, one step brighter during a lamp ripple or a warm-lamp pulse, with the mains flicker.
    const bump = this.glowBumpMs > 0 || this.pulseMs > 0 ? WORLD_ENV.lampGlow.bumpAlpha : 0;
    this.lampGlow.setAlpha(clamp01((WORLD_ENV.lampGlow.alpha + bump) * this.mainsMul));

    // Motes orbit the lamp head (static under reduced motion), freeze mid-orbit (era IV) or fall into the lamp (era V).
    const head = this.lampHead;
    const t = this.motesTime(state.props.motesMode);
    if (head !== null) {
      for (let i = 0; i < this.motes.length; i++) {
        const mote = this.motes[i];
        if (mote === undefined) continue;
        const o = moteOffsetOf(i, state.props.motesMode, t);
        mote.setPosition(head.x + o.dx * PIXEL_SCALE, head.y + o.dy * PIXEL_SCALE);
      }
    }

    // Booth: lit (fogged in era III with vents) or dark; ring0 / ring1 alternate while a ring plays. The hood light follows the mains flicker.
    // The script: dark, restored and blink (lit) on the whole row (the restored paint), or stage = the state drawing.
    const idle = state.props.boothLit ? (state.props.boothFog ? 'fog' : 'lit') : 'dark';
    const boothFrame = phase === -1 ? idle : (phase === 0 ? 'ring0' : 'ring1');
    const booth = this.propScript?.booth ?? 'stage';
    const boothName = booth === 'stage' ? boothFrame : booth === 'blink' ? 'lit' : booth;
    this.setFrame(this.booth, 'payphone', boothName, booth === 'restored' || booth === 'blink' ? WORLD_ERA_ROW.whole : row);
    this.booth.setAlpha(clamp01(state.props.boothLit ? this.mainsMul : 1));
    this.paintMarks(state.props.marks + (this.propScript?.marksPlus ?? 0), boothName === 'fog');

    // Puddle: ring look (1) while a glint, a ripple or a downbeat ring runs, else grey (0) or black (2) by the state; the script's whole frame.
    const look = this.puddleRingMs > 0 ? WORLD_PUDDLE.looks.ring
      : state.props.puddle.look === 'black' ? WORLD_PUDDLE.looks.black : WORLD_PUDDLE.looks.grey;
    const puddleName = this.propScript?.puddles === 'whole' ? 'whole' : puddleFrameOf(state.props.puddle.size, look);
    if (puddleName !== undefined) this.setFrame(this.puddle, 'puddle', puddleName, row);

    // Receiver: the swing loop on the tape clock (plus the era I ripple's extra step), or level while held. The ring jerks it.
    // The script's onHook: the handset on the booth's outer side (row whole), no jerk, never at the state pivot.
    const hook = this.propScript?.receiver === 'onHook';
    const loopFrame = loopFrameAt(WORLD_LOOPS.receiver, this.tape.tick() + this.extraTicks, state.seam).frame;
    this.setFrame(this.receiver, 'receiver', hook ? 'onHook' : this.receiverOn ? 'level' : loopFrame, hook ? WORLD_ERA_ROW.whole : row);
    const boothAt = this.boothAt;
    if (boothAt !== null) {
      const jerk = (this.reduced || phase === -1 || hook) ? 0 : (phase === 0 ? -1 : 1) * WORLD_ENV.ring.jerkPx;
      const off = hook ? WORLD_ENV.receiverOnHookArt : WORLD_ENV.receiverArt;
      this.receiver.setPosition(boothAt.x + off.x * PIXEL_SCALE + jerk, boothAt.y + off.y * PIXEL_SCALE);
    }

    // Clock hands: 4:41 plus the script's second hand (null before the clock restores).
    if (this.clockAt !== null) this.paintHands(this.clockAt, this.propScript?.secondHandDeg ?? null);

    // Pebbles at the booth foot: two 1 art px rects, lifted hopPx for the one frame after a ripple.
    if (boothAt !== null) {
      const lift = this.pebbleHop ? WORLD_ENV.pebbles.hopPx : 0;
      const key = `${boothAt.x}:${lift}`;
      if (key !== this.pebblesKey) {
        this.pebblesKey = key;
        this.drawPebbles(boothAt, lift);
      }
    }
  }

  // Girl window flicker (bible §4.1): before wornMotor the frame toggles per crank step; otherwise held for windowFlicker holds.
  private stepFlicker(dt: number, mode: PlaybackMode, crankSteps: number): void {
    const seed = WORLD_ENV.windowFlickerSeed;
    if (mode === 'crank') {
      const steps = Number.isFinite(crankSteps) ? Math.max(0, Math.floor(crankSteps)) : 0;
      if (steps > 0) {
        this.flickerK += steps;
        this.flickerFrame = windowFlicker(this.flickerK, seed).frame;
      }
      return;
    }
    this.flickerLeftMs -= dt;
    for (let guard = 0; this.flickerLeftMs <= 0 && guard < FLICKER_CATCHUP_MAX; guard++) {
      this.flickerK += 1;
      this.flickerLeftMs += windowFlicker(this.flickerK, seed).holdMs;
    }
    this.flickerFrame = windowFlicker(this.flickerK, seed).frame;
  }

  // Ring clock: runs once from ring(); stops after the last burst.
  private stepRing(dt: number): void {
    if (this.ringMs < 0) return;
    this.ringMs += dt;
    if (this.ringMs >= ringTotalMs()) this.ringMs = -1;
  }

  // Tally marks: redrawn in place when the count or the fog colour changes (fogColor while the fog frame shows, else color).
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

  // Halo behind the first count lit windows (WORLD_ENV.windowGlow); redrawn only when the count changes.
  private drawHalo(count: number): void {
    const far = WORLD_FAR_PLANES;
    const pad = WORLD_ENV.windowGlow.padArtPx * PIXEL_SCALE;
    const g = this.halo;
    g.clear();
    g.fillStyle(WORLD_ENV.windowGlow.color, WORLD_ENV.windowGlow.alpha);
    for (const w of far.windows.slice(0, count)) {
      const x = far.window.tileOriginX + PIXEL_SCALE * w.artX;
      const y = far.window.tileTopY + PIXEL_SCALE * w.artY;
      g.fillRect(x - pad, y - pad, w.w * PIXEL_SCALE + 2 * pad, w.h * PIXEL_SCALE + 2 * pad);
    }
    this.haloLit = count;
  }

  // Motes' orbit time: the clock (0 under reduced motion). Freeze holds the time the mode turned to freeze at.
  private motesTime(mode: MotesMode): number {
    const now = this.reduced ? 0 : this.nowMs;
    if (mode !== this.motesMode) {
      this.motesMode = mode;
      this.motesHoldMs = now;
    }
    return mode === 'freeze' ? this.motesHoldMs : now;
  }

  // Downbeat accents: era IV window breathe and lamp pulse, and the puddle ring (WORLD_PUDDLE.ringEra only; ripple(ringEra) also rings).
  private onDownbeat(state: WorldVisualState): void {
    if (state.props.windowsBreathe) this.breatheMs = WORLD_ERA_ENV.accentMs;
    if (state.props.lampPulse) this.pulseMs = WORLD_ERA_ENV.accentMs;
    if (state.era === WORLD_PUDDLE.ringEra) this.puddleRingMs = WORLD_ENV.rippleMs;
  }

  // Clock hands: redrawn only when the clock moves or the second hand turns HAND_REDRAW_DEG (state mode draws them once).
  private paintHands(at: Vec2, secondDeg: number | null): void {
    const key = `${at.x}:${at.y}`;
    if (key === this.handsKey && !turned(secondDeg, this.handsSec)) return;
    this.handsKey = key;
    this.handsSec = secondDeg;
    this.drawHands(at, secondDeg);
  }

  // Clock hands at the face centre, stopped at WORLD_ENV.clock.hour:minute, 1 art px thick. The script's second hand (secondDeg) is
  // 1 art px too, as long as the minute hand (WORLD_ENV.clock has no second length).
  private drawHands(at: Vec2, secondDeg: number | null): void {
    const { faceCenterArt, hourLenArt, minuteLenArt, hour, minute, color } = WORLD_ENV.clock;
    const centre: Vec2 = { x: at.x + faceCenterArt.x * PIXEL_SCALE, y: at.y + faceCenterArt.y * PIXEL_SCALE };
    const tips: Vec2[] = [
      handTip(centre, ((hour % 12) + minute / 60) * 30, hourLenArt * PIXEL_SCALE),
      handTip(centre, minute * 6, minuteLenArt * PIXEL_SCALE),
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
    if (this.samples.length < STAT_SAMPLES) {
      this.samples.push(ms);
      return;
    }
    this.samples[this.sampleAt] = ms;
    this.sampleAt = (this.sampleAt + 1) % STAT_SAMPLES;
  }
}
