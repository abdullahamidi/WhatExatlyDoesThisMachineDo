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
  WORLD_DEPTH_OFFSETS, WORLD_ENV, WORLD_FAR_PLANES, WORLD_FRAMES, WORLD_HOLE, WORLD_LOOPS, WORLD_MARKS, WORLD_ROWS, WORLD_SHEET_KEYS,
} from '../../data/livingWorld';
import type { GroundId, WorldPlacement, WorldSheetId } from '../../data/livingWorld';
import type { CameraPose } from '../math/finale';
import { fadeStep } from '../math/parallax';
import { screenOfWorld } from '../math/worldPlacement';
import type { SpeakerAnchor } from '../math/worldPlacement';
import { createTapeClock, loopFrameAt, moteOrbit, sheetFrameIndex, tallyRects, windowFlicker } from '../math/worldPlayback';
import type { PlaybackMode, TapeClock } from '../math/worldPlayback';
import type { WorldVisualState } from '../math/worldState';
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

// CSS colour of a 0xRRGGBB number (the same form as PALETTE_CSS).
function cssOf(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Feet y of a ground placement: its row's feet line.
function feetOf(p: WorldPlacement): number {
  return WORLD_ROWS[p.row].y;
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

// Environment props of eras I-II. One instance per scene; the director calls apply() with each visual state and placement set,
// update() every frame, and hideAll() when the layer is off.
export class WorldProps {
  private readonly scene: Phaser.Scene;
  private readonly owned: Visible[] = [];
  private readonly frames = new Map<Phaser.GameObjects.Sprite, { row: number; name: string }>();
  private readonly farWindow: Phaser.GameObjects.Container;
  private readonly farPylon: Phaser.GameObjects.Container;
  private readonly halo: Phaser.GameObjects.Graphics;
  private readonly windowSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly girlWindow: Phaser.GameObjects.Sprite;
  private readonly girlMini: Phaser.GameObjects.Sprite;
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
  private handsKey = '';
  private boothAt: Vec2 | null = null;
  private lampHead: Vec2 | null = null;

  constructor(scene: Phaser.Scene, rows: WorldRows) {
    this.scene = scene;
    const far = WORLD_FAR_PLANES;

    // Far planes: one scroll-factor container each. Children ignore their own scroll factor, so it is set on the container.
    this.farWindow = scene.add.container(0, 0).setScrollFactor(far.window.sf).setDepth(far.window.depth);
    this.farPylon = scene.add.container(0, 0).setScrollFactor(far.pylon.sf).setDepth(far.pylon.depth);
    this.owned.push(this.farWindow, this.farPylon);

    // The halo is one Graphics added before the windows, so it draws behind them.
    this.halo = this.graphicsIn(this.farWindow, 0);
    const pad = WORLD_ENV.windowGlow.padArtPx * PIXEL_SCALE;
    this.halo.fillStyle(WORLD_ENV.windowGlow.color, WORLD_ENV.windowGlow.alpha);
    for (const w of far.windows) {
      const x = far.window.tileOriginX + PIXEL_SCALE * w.artX;
      const y = far.window.tileTopY + PIXEL_SCALE * w.artY;
      this.halo.fillRect(x - pad, y - pad, w.w * PIXEL_SCALE + 2 * pad, w.h * PIXEL_SCALE + 2 * pad);
    }

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

    // Ground props: back row unless the data puts them on the front row (stake and hole).
    const back = rows.back;
    const front = rows.front;
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

  /** Applies the visual state and the ground placements. visible false hides everything. Cheap: call on every change or every frame. */
  apply(state: WorldVisualState, placements: Readonly<Record<GroundId, WorldPlacement | null>>, opts: { reducedMotion: boolean }): void {
    this.state = state;
    this.reduced = opts.reducedMotion;
    if (!state.visible) {
      this.hideAll();
      return;
    }
    this.live = true;
    this.placeStatic(state, placements);
    this.paintDynamic(state);
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
      this.mainsMul = mainsOf(state.era, this.reduced, this.nowMs);
      this.paintDynamic(state);
      this.pebbleHop = false;
    }
    this.sample(performance.now() - started);
  }

  /** World ripple for a tier-up era: era I = pebbles hop and one extra receiver swing; era II = lamp one step brighter. */
  ripple(era: number): void {
    if (era === 1) {
      this.pebbleHop = true;
      if (!this.tape.frozen()) this.extraTicks += 1;
    } else if (era === 2) {
      this.glowBumpMs = WORLD_ENV.rippleMs;
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

  /** Screen anchor of a speaker: the girl (mini when shown, else the window) or the payphone (receiver top and bottom). null when hidden. */
  anchor(id: 'girl' | 'payphone', cam: CameraPose): SpeakerAnchor | null {
    const state = this.state;
    if (!this.live || state === null) return null;
    if (id === 'payphone') {
      if (this.boothAt === null) return null;
      const r = this.receiver;
      return {
        head: screenOfWorld({ x: r.x, y: r.y }, 1, cam),
        feet: screenOfWorld({ x: r.x, y: r.y + r.displayHeight }, 1, cam),
      };
    }
    if (state.props.girlMini) {
      const m = this.girlMini;
      const sf = WORLD_FAR_PLANES.pylon.sf;
      return {
        head: screenOfWorld({ x: m.x, y: m.y - m.displayHeight }, sf, cam),
        feet: screenOfWorld({ x: m.x, y: m.y }, sf, cam),
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
    const mini = on && state !== null && state.props.girlMini;
    const dark = state !== null && state.props.girlWindow === 'dark';
    const at = (s: Phaser.GameObjects.Sprite): number => (on && s.visible ? s.x : 0);
    const shown = (s: Phaser.GameObjects.Sprite): boolean => on && s.visible;
    return [
      { id: 'lamp', variant: this.frameName(this.lamp), x: at(this.lamp), visible: shown(this.lamp), speaking: false },
      { id: 'clock', variant: this.frameName(this.clock), x: at(this.clock), visible: shown(this.clock), speaking: false },
      { id: 'payphone', variant: this.frameName(this.booth), x: at(this.booth), visible: shown(this.booth), speaking: false },
      { id: 'receiver', variant: this.frameName(this.receiver), x: at(this.receiver), visible: shown(this.receiver), speaking: false },
      {
        id: 'girl',
        variant: mini ? 'mini' : dark ? 'window-dark' : 'window-flicker',
        x: 0,
        visible: mini ? shown(this.girlMini) : shown(this.girlWindow),
        speaking: false,
      },
    ];
  }

  /** Hides every object and cancels the ring and ripple timers. apply() with a visible state shows them again. */
  hideAll(): void {
    this.live = false;
    this.ringMs = -1;
    this.glowBumpMs = 0;
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

  // Static placement: positions, visibility and the frames that only the state sets. Runs on apply().
  private placeStatic(state: WorldVisualState, p: Placements): void {
    const row = state.eraRow;
    this.farWindow.setVisible(true);
    this.farPylon.setVisible(state.props.girlMini);
    this.girlWindow.setVisible(true);
    this.girlMini.setVisible(state.props.girlMini);
    this.setFrame(this.girlMini, 'girlMini', 'cold', row);

    // Lamp, glow and motes hang off the lamp placement; the glow and the orbit centre on the lamp head.
    const lamp = p.lamp;
    if (lamp !== null) {
      const feet = feetOf(lamp);
      const head: Vec2 = { x: lamp.x, y: feet - WORLD_ENV.lampHeadArtPx * PIXEL_SCALE };
      this.lampHead = head;
      this.lamp.setPosition(lamp.x, feet).setVisible(true);
      this.setFrame(this.lamp, 'lamp', state.props.lamp, row);
      this.lampGlow.setPosition(head.x, head.y).setVisible(state.props.lampGlow);
      this.setFrame(this.lampGlow, 'lampGlow', 'cold', row);
    } else {
      this.lampHead = null;
      this.lamp.setVisible(false);
      this.lampGlow.setVisible(false);
    }
    const motesOn = this.lampHead !== null && state.props.motes;
    for (const mote of this.motes) {
      mote.setVisible(motesOn);
      this.setFrame(mote, 'mote', 'ash', row);
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
    if (state.props.marks !== this.marksDrawn) this.drawMarks(state.props.marks);

    // Street clock: the ruin frame, with hands stopped at WORLD_ENV.clock.
    const clk = p.clock;
    this.clock.setVisible(clk !== null);
    this.hands.setVisible(clk !== null);
    if (clk !== null) {
      const feet = feetOf(clk);
      this.clock.setPosition(clk.x, feet);
      this.setFrame(this.clock, 'clock', 'ruin', row);
      const key = `${clk.x}:${feet}`;
      if (key !== this.handsKey) {
        this.handsKey = key;
        this.drawHands(clk.x, feet);
      }
    }

    // Stake and cut chain (front row), then the hole once digging has started.
    const stake = p.stakeChain;
    if (stake !== null) {
      this.stake.setPosition(stake.x, feetOf(stake)).setVisible(state.props.stakeChain);
      this.setFrame(this.stake, 'stakeChain', 'chained', row);
    } else {
      this.stake.setVisible(false);
    }
    const hole = p.hole;
    if (hole !== null && state.props.holeStage > 0) {
      const stage = Math.min(WORLD_HOLE.maxStage, Math.max(WORLD_HOLE.minStage, Math.floor(state.props.holeStage)));
      this.hole.setPosition(hole.x, feetOf(hole)).setVisible(true);
      this.setFrame(this.hole, 'hole', `stage${stage}`, row);
    } else {
      this.hole.setVisible(false);
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

    // Girl window: the flicker frame, or dark once the generator is owned.
    this.setFrame(this.girlWindow, 'girlWindow', state.props.girlWindow === 'dark' ? 'dark' : this.flickerFrame, row);

    // Six windows and their halo fade together to windowTargetOf (dim or lit); the mains flicker scales the window alpha in era II.
    const windowsOn = this.windowFade > 0;
    this.halo.setVisible(windowsOn).setAlpha(this.windowFade);
    const windowAlpha = clamp01(WORLD_ENV.windowAlpha * this.windowFade * this.mainsMul);
    for (const w of this.windowSprites) w.setVisible(windowsOn).setAlpha(windowAlpha);

    // Lamp glow: steady, one step brighter during a lamp ripple, with the mains flicker.
    const bump = this.glowBumpMs > 0 ? WORLD_ENV.lampGlow.bumpAlpha : 0;
    this.lampGlow.setAlpha(clamp01((WORLD_ENV.lampGlow.alpha + bump) * this.mainsMul));

    // Motes orbit the lamp head; static at their phase positions under reduced motion.
    const head = this.lampHead;
    if (head !== null) {
      const t = this.reduced ? 0 : this.nowMs;
      for (let i = 0; i < this.motes.length; i++) {
        const mote = this.motes[i];
        if (mote === undefined) continue;
        const o = moteOrbit(i, t);
        mote.setPosition(head.x + o.dx * PIXEL_SCALE, head.y + o.dy * PIXEL_SCALE);
      }
    }

    // Booth: lit or dark, ring0 / ring1 alternating while a ring plays. The hood light follows the mains flicker.
    const boothFrame = phase === -1 ? (state.props.boothLit ? 'lit' : 'dark') : (phase === 0 ? 'ring0' : 'ring1');
    this.setFrame(this.booth, 'payphone', boothFrame, row);
    this.booth.setAlpha(clamp01(state.props.boothLit ? this.mainsMul : 1));

    // Receiver: the swing loop on the tape clock (plus the era I ripple's extra step), or level while held. The ring jerks it.
    const loopFrame = loopFrameAt(WORLD_LOOPS.receiver, this.tape.tick() + this.extraTicks, state.seam).frame;
    this.setFrame(this.receiver, 'receiver', this.receiverOn ? 'level' : loopFrame, row);
    const boothAt = this.boothAt;
    if (boothAt !== null) {
      const jerk = (this.reduced || phase === -1) ? 0 : (phase === 0 ? -1 : 1) * WORLD_ENV.ring.jerkPx;
      this.receiver.setPosition(
        boothAt.x + WORLD_ENV.receiverArt.x * PIXEL_SCALE + jerk,
        boothAt.y + WORLD_ENV.receiverArt.y * PIXEL_SCALE,
      );
    }

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

  // Tally marks: redrawn in place when the count changes (WORLD_MARKS.color on a transparent pane).
  private drawMarks(count: number): void {
    const tex = this.marksTexture;
    const ctx = tex.context;
    ctx.clearRect(0, 0, WORLD_MARKS.pane.w, WORLD_MARKS.pane.h);
    ctx.fillStyle = cssOf(WORLD_MARKS.color);
    for (const r of tallyRects(count)) ctx.fillRect(r.x, r.y, r.w, r.h);
    tex.refresh();
    this.marksDrawn = count;
  }

  // Clock hands at the face centre, stopped at WORLD_ENV.clock.hour:minute, 1 art px thick.
  private drawHands(x: number, feet: number): void {
    const { faceCenterArt, hourLenArt, minuteLenArt, hour, minute, color } = WORLD_ENV.clock;
    const centre: Vec2 = { x: x + faceCenterArt.x * PIXEL_SCALE, y: feet + faceCenterArt.y * PIXEL_SCALE };
    const hourTip = handTip(centre, ((hour % 12) + minute / 60) * 30, hourLenArt * PIXEL_SCALE);
    const minuteTip = handTip(centre, minute * 6, minuteLenArt * PIXEL_SCALE);
    const g = this.hands;
    g.clear();
    g.lineStyle(PIXEL_SCALE, color, 1);
    g.beginPath();
    g.moveTo(centre.x, centre.y);
    g.lineTo(hourTip.x, hourTip.y);
    g.strokePath();
    g.beginPath();
    g.moveTo(centre.x, centre.y);
    g.lineTo(minuteTip.x, minuteTip.y);
    g.strokePath();
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
