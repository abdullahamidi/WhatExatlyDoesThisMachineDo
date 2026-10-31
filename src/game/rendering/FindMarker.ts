import Phaser from 'phaser';
import { FLOATING_TEXT, GROUND_Y, PIXEL_SCALE, VIEW } from '../../data/world';
import type { EraNumber } from '../../data/eras';
import type { FramingKey } from '../../data/livingWorld';
import type { ResourceMap, TechId } from '../../data/types';
import type { Vec2 } from '../../data/machineComponents';
import { FIND_ART, FIND_COLORS, FIND_LAYOUT, FIND_SPOTS, FIND_WORLD_TEXT } from '../../data/findWorld';
import type { FindProducer, FindSpot } from '../../data/findWorld';
import { FIND_TEXT, FINDS, RELIC_NOTES } from '../../data/finds';
import { PHOTO_MODE } from '../../data/photoMode';
import type { FindAlive, GameSession } from '../../simulation';
import type { SessionEvents } from '../../simulation/events';
import { currentEra } from '../../simulation/progression/era';
import type { Signal } from '../../utils/signal';
import type { WorldUi } from '../scenes/WorldScene';
import type { PhotoModeController } from '../photoModeController';
import type { CycleTransition } from './CycleTransition';
import type { FloatingText } from './FloatingText';
import type { PokeTarget, WorldDebugApi } from './LivingWorldDirector';
import { clickGainLines } from '../../ui/hudView';
import type { GainLine } from '../../ui/hudView';
import { gainFontPx } from '../math/gainBlock';
import { fadeAlpha, faultEligible } from '../math/faultMarker';
import type { FaultGates } from '../math/faultMarker';
import {
  chladniOffsetPx, clientToGamePx, countInView, dropFraction, dustPuffing, findEligible, flipScaleX, flipShown, glintFrame, glintSlowed,
  hopOffsetPx, itemCell, leadWaitMs, liftBobPx, liftHeightPx, pickSpot, riseOffsetPx, ringAlpha, spotInView, spotUsable,
  TimingWindow, zoneSideWorld,
} from '../math/findMarker';

// WP28 Finds, the marker (C12 renderer). One container: the item sprite, its glint, a ground ring and a click zone. Built once
// in the constructor (one top-level display object: the container); update() places it, the session's 'find' events show,
// hop and fade it. The pure rules are in game/math/findMarker.ts; every number is in data/findWorld.ts or data/finds.ts.
// A lazy chunk: only WorldReach reaches this module (WorldScene imports WorldReach), so the app chunk stays small.
// The clock is the session's (stepFinds, once per frame, eligible or not); the marker keeps a copy of the live Find that
// follows the session's events and ages with the same clamped step, so reading it each frame allocates nothing.

/**
 * The director reads the marker needs (C11 subset): the framing, the crow's perch and the cast's feet (poke targets), and (WP28b) the
 * producer's action (findProducer, its lead ms) and the live Find's world x (setFindAt).
 */
export type FindDirectorPort = Pick<WorldDebugApi, 'framingKey' | 'crowPerchPos' | 'pokeTargets' | 'findProducer' | 'setFindAt'>;

/**
 * The marker reads these lazily on every update (the WorldScene port pattern): nothing is captured at construction.
 * The overlay readers are the same as the fault marker's, so a Find hides exactly where a fault does.
 */
export interface FindMarkerPorts {
  session: Pick<GameSession, 'state' | 'finds' | 'stepFinds' | 'collectFind' | 'debugForceFind' | 'on'>;
  director: () => FindDirectorPort | null;
  floatingText: FloatingText;
  ui: Pick<WorldUi, 'techTree' | 'modals' | 'eraCards' | 'worldView'>;
  /** Read per frame: the World scene creates the photo controller and the cycle transition after this marker is built. */
  photo: () => PhotoModeController | null;
  cycle: () => CycleTransition | null;
  reducedMotion: () => boolean;
  /** The G key command (ctx.commands.collectFind): picks up the live Find while the marker is eligible. */
  collectCommand: Signal<void>;
}

/**
 * Counters and state for the debug hook and the smokes. x and y are the centre of the click zone in world px. item is the
 * sprite cell (-1 while idle), glintFrame the glint's cell (-1 while hidden), producer the spot's producer (null while idle),
 * spot the index of the spot in its framing's list (-1 when none). meanMs is the mean update() time of the last frames.
 */
export interface FindMarkerStats {
  visible: boolean;
  interactive: boolean;
  x: number;
  y: number;
  item: number;
  glintFrame: number;
  producer: FindProducer | null;
  spot: number;
  shown: number;
  collected: number;
  expired: number;
  meanMs: number;
}

/**
 * The debug hook's Find probe (findStats): the session's clock numbers, the eligibility, the marker's stats and the marker
 * centre in client px (null while hidden). Reads only: nothing here moves the clock or the marker.
 */
export interface FindDebugStats {
  unlocked: boolean; alive: FindAlive | null; nextIn: number | null; spawned: number; caught: number; missed: number; relics: number;
  eligible: boolean; marker: FindMarkerStats; client: { x: number; y: number } | null;
}

/** idle: nothing shown; alive: the live Find on its spot; hop: collected (the item hops and the glint flashes); fade: expired. */
type Phase = 'idle' | 'alive' | 'hop' | 'fade';

/** The live Find as the marker knows it (the session's alive, copied): ageS follows the session's clamped steps. */
interface LiveFind { serial: number; relic: boolean; ageS: number; windowS: number }

/** Window of update() wall times kept for stats().meanMs. A debug probe window, not tuning. */
const TIMING_SAMPLES = 300;
/** One item cell in world px: the sprite's height and width. */
const ITEM_PX = FIND_ART.cellArtPx * PIXEL_SCALE;
/** Glint and item offsets in world px (the art px numbers of the layout, scaled). */
const GLINT_X = FIND_LAYOUT.glintOffsetArtPx.x * PIXEL_SCALE;
const GLINT_Y = FIND_LAYOUT.glintOffsetArtPx.y * PIXEL_SCALE;

/** A count or a time in player text: at most two decimals, no trailing zeros (as the effect text). */
function trimNumber(x: number): string {
  return String(Number(x.toFixed(2)));
}

/** Moves a display object only when its position changed: the marker runs every frame and most values hold. */
function moveTo(o: { x: number; y: number; setPosition(x: number, y: number): unknown }, x: number, y: number): void {
  if (o.x !== x || o.y !== y) o.setPosition(x, y);
}

/** Sets an object's visibility only when it changed. */
function showIf(o: { visible: boolean; setVisible(on: boolean): unknown }, on: boolean): void {
  if (o.visible !== on) o.setVisible(on);
}

/** Sets an object's alpha only when it changed. */
function alphaIf(o: { alpha: number; setAlpha(a: number): unknown }, a: number): void {
  if (o.alpha !== a) o.setAlpha(a);
}

/**
 * The Find marker of one World scene. Hidden unless a Find is alive and the marker is eligible (no overlay, no era card,
 * no ending, a spot of the framing on screen, Finds switched on); the zone takes input only while it shows.
 */
export class FindMarker {
  private readonly scene: Phaser.Scene;
  private readonly ports: FindMarkerPorts;
  private readonly container: Phaser.GameObjects.Container;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly item: Phaser.GameObjects.Sprite;
  private readonly glint: Phaser.GameObjects.Sprite;
  private readonly zone: Phaser.GameObjects.Zone;
  /** The zone's hit shape in its top-left local coordinates. Resized in place: Phaser reads this same object. */
  private readonly hitRect: Phaser.Geom.Rectangle;
  /** The page's #ui-root, read once: the teaser gate reads its class. Null when the page has no root (then the gate is off). */
  private readonly uiRoot: HTMLElement | null;
  /** The gate values of the latest frame, filled in place. */
  private readonly gates: FaultGates = {
    tabHidden: false, photoActive: false, techTreeOpen: false, eraCardShown: false, modalOpen: false,
    cycleBusy: false, teaserOn: false, demoCardOpen: false, endingPhase: 'none', enabled: true,
  };
  /** Reused buffers for the cast feet (spawn and spot change only): the director fills the targets, the feet are copied out. */
  private readonly targets: PokeTarget[] = [];
  private readonly castFeet: Vec2[] = [];
  /** The crow's perch at the spawn (the item drops from it). Valid while hasPerch. */
  private readonly perch: { x: number; y: number } = { x: 0, y: 0 };
  private hasPerch = false;
  /** The last update() durations (ms), for stats().meanMs. */
  private readonly timings = new TimingWindow(TIMING_SAMPLES);
  private readonly unsubscribeFind: () => void;
  private readonly unsubscribeReset: () => void;
  private readonly unsubscribeCommand: () => void;
  private readonly unsubscribeSettings: () => void;
  private readonly onPointerDown = (): void => this.collect();
  /** Debug switch (the setFinds hook): off freezes the clock (not eligible) and hides a live marker. */
  private enabled = true;
  /** Whether this frame's clock was eligible (read by the probe and the collect gate). */
  private eligible = false;
  private phase: Phase = 'idle';
  /** Milliseconds since the phase began (spawn, collect or expiry); the marker's clock. */
  private phaseMs = 0;
  /** The marker's own monotonic clock (ms): the glint and the ring breathe on it. */
  private nowMs = 0;
  private live: LiveFind | null = null;
  /** The item cell of the Find (-1 before the first spawn). */
  private cell = -1;
  private producer: FindProducer | null = null;
  private spot: FindSpot | null = null;
  private spotIndex = -1;
  /** The framing the spot was picked for; a framing change picks again. */
  private spotFraming: FramingKey | null = null;
  /** The era cache: the tech levels object it was read from (a buy replaces that object), and the era read from it. */
  private eraLevels: Readonly<Record<TechId, number>> | null = null;
  private eraCache: EraNumber = 1;
  /** The phase-clock ms at which the item shows: the producer's lead after the spawn (0 for none). The marker stays hidden before it. */
  private showAtMs = 0;
  /** Whether the Director holds the live Find's x (setFindAt): from the item's first show until its collect, expiry or hide. */
  private reported = false;
  /** The tech levels the spot count was read with (a buy replaces the object: the count is read again). */
  private countLevels: Readonly<Record<TechId, number>> | null = null;
  /** Last glint frame set on the sprite, so setFrame runs only when the frame changes. */
  private glintFrameCache = -1;
  /** Last zone side in world px, so the zone is resized only when the zoom changes it. */
  private zoneSide = -1;
  private shown = 0;
  private collected = 0;
  private expired = 0;
  /** The HUD buttons' box and the canvas box (client px, the last DOM read); hudOn: the buttons show, with a box (WP28a E3). */
  private hudBox: DOMRect | null = null;
  private canvasBox: DOMRect | null = null;
  private hudOn = false;
  /** The HUD box in world px at the camera pose of the last projection; hudVersion counts the projections (the count cache's key). */
  private readonly hudWorld = { x: 0, y: 0, right: 0, bottom: 0 };
  private hudVersion = 0;
  private hudNextMs = 0;
  private hudDirty = true;
  /** The camera pose of the last projection (NaN until the first, which forces it). */
  private poseZoom = Number.NaN;
  private poseX = Number.NaN;
  private poseY = Number.NaN;
  private readonly worldPoint = new Phaser.Math.Vector2();
  /** The spots-on-screen count, cached while the framing, the view and the HUD box are unchanged. */
  private readonly countView = { x: Number.NaN, y: Number.NaN, right: Number.NaN, bottom: Number.NaN };
  private countFraming: FramingKey | null = null;
  private countHud = -1;
  private countN = 0;
  /** The ring's drawn colour and alpha step (of ringAlphaSteps), and the earliest next redraw on the marker's clock. */
  private ringColor = -1;
  private ringStep = -1;
  private ringNextMs = 0;
  /** The spot's Splice and era test (spotUsable, WP28b): a spot whose Splice sleeps, or whose producer is in another era, is not a spot. */
  private readonly isUsable = (s: FindSpot): boolean => spotUsable(s, this.ports.session.state.techLevels, this.eraNow());
  /** The spot test for pickSpot: one reused callback, so a pick allocates nothing. */
  private readonly isOnScreen = (s: FindSpot): boolean =>
    spotInView(s, this.view(), FIND_LAYOUT.viewInsetWorldPx, this.hudOn ? this.hudWorld : null) && this.isUsable(s);

  constructor(scene: Phaser.Scene, ports: FindMarkerPorts) {
    this.scene = scene;
    this.ports = ports;
    this.uiRoot = document.getElementById('ui-root');
    this.container = scene.add.container(0, 0).setVisible(false);
    // The ring is drawn once per Find (on the spawn); the item and glint are sprites hanging from the bottom centre, as the art does.
    this.ring = scene.add.graphics();
    this.item = scene.add.sprite(0, 0, FIND_ART.sheet, FIND_ART.items[0]).setOrigin(0.5, 1).setScale(PIXEL_SCALE);
    this.glint = scene.add.sprite(0, 0, FIND_ART.sheet, FIND_ART.glint[0]).setOrigin(0.5, 0.5).setScale(PIXEL_SCALE);
    // The zone covers the item and is at least hitMinScreenPx on screen whatever the zoom. Its hit area is in local top-left coordinates.
    const side = zoneSideWorld(scene.cameras.main.zoom);
    this.zoneSide = side;
    this.hitRect = new Phaser.Geom.Rectangle(0, 0, side, side);
    this.zone = scene.add.zone(0, -ITEM_PX / 2, side, side);
    this.zone.setInteractive({
      hitArea: this.hitRect,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.container.add([this.ring, this.item, this.glint, this.zone]);
    this.zone.on('pointerdown', this.onPointerDown);
    this.setZoneInput(false);
    // A Find already alive when this marker is built (a scene restart, a page load) is taken over from the session's clock.
    const alive = ports.session.finds.alive;
    if (alive !== null) {
      this.live = { serial: alive.serial, relic: alive.relic, ageS: alive.age, windowS: alive.window };
      this.cell = itemCell(alive.serial, alive.relic);
      this.phase = 'alive';
      this.paint();
    }
    this.unsubscribeFind = ports.session.on('find', (e) => this.onFind(e));
    this.unsubscribeReset = ports.session.on('reset', () => this.onReset());
    this.unsubscribeCommand = ports.collectCommand.on(() => this.collect());
    // A settings change (the UI scale moves the HUD buttons) re-reads the HUD box at the next frame.
    this.unsubscribeSettings = ports.session.on('settings', () => { this.hudDirty = true; });
  }

  /** Per frame: steps the Find clock, then shows, hops, fades or hides the marker. The call itself is timed for the probe. */
  update(deltaMs: number): void {
    const t0 = performance.now();
    this.step(deltaMs);
    this.timings.record(performance.now() - t0);
  }

  /** Turns the marker on or off. Off hides a live marker at once; the clock freezes through eligibility. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.hideMarker();
  }

  /** The debug hook's forced spawn (session.debugForceFind): false when Worn Motor is not owned or a Find is alive. */
  forceFind(): boolean {
    return this.ports.session.debugForceFind();
  }

  stats(): FindMarkerStats {
    const showing = this.phase !== 'idle';
    return {
      visible: this.container.visible,
      interactive: this.zone.input?.enabled === true,
      // The zone sits in the container at its item offset, so its world centre is the sum.
      x: this.container.x + this.zone.x,
      y: this.container.y + this.zone.y,
      item: showing ? this.cell : -1,
      glintFrame: this.container.visible ? this.glintFrameCache : -1,
      producer: showing ? this.producer : null,
      spot: this.phase === 'alive' ? this.spotIndex : -1,
      shown: this.shown,
      collected: this.collected,
      expired: this.expired,
      meanMs: this.timings.mean(),
    };
  }

  /**
   * The debug hook's Find probe. toClient maps a world point to client px (the hook's own conversion, so the smokes click
   * where the marker is drawn). Reads only: nothing here moves the clock or the marker.
   */
  debugStats(toClient: (gx: number, gy: number) => { x: number; y: number }): FindDebugStats {
    const marker = this.stats();
    const f = this.ports.session.finds;
    return {
      unlocked: f.unlocked, alive: f.alive, nextIn: f.nextIn, spawned: f.spawned, caught: f.caught, missed: f.missed,
      relics: f.relics, eligible: this.eligible, marker,
      client: marker.visible ? toClient(marker.x, marker.y) : null,
    };
  }

  /** Unsubscribes and destroys the container (and so its children). */
  destroy(): void {
    this.unsubscribeFind();
    this.unsubscribeReset();
    this.unsubscribeCommand();
    this.unsubscribeSettings();
    // Phaser may already have destroyed the container (scene teardown); its scene is then unset.
    if (this.container.scene) this.container.destroy();
  }

  /** One frame: the gates, the clock, then the marker's phase. A bad delta (NaN, negative) counts as no time. */
  private step(deltaMs: number): void {
    const dtMs = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
    this.nowMs += dtMs;
    this.phaseMs += dtMs;
    const reduced = this.ports.reducedMotion();
    this.fillGates();
    const framing = this.ports.director()?.framingKey() ?? null;
    this.refreshHud();
    const eligible = findEligible(this.gates, this.spotsOnScreen(framing));
    this.eligible = eligible;
    // The copy ages with the session's own step: the session clamps dt to FINDS.maxStepS and ages its alive Find by the same amount.
    if (eligible && this.live !== null) this.live.ageS += Math.min(dtMs / 1000, FINDS.maxStepS);
    // The session steps the clock (it clamps dt itself) and emits 'find' for a spawn or an expiry (onFind updates the copy).
    this.ports.session.stepFinds(dtMs / 1000, eligible);
    if (!eligible) {
      this.hideMarker();
      return;
    }
    this.showPhase(framing, reduced);
  }

  /** The spots of the framing on screen. Recounted only when the framing, the view or the HUD box changed (no count per frame). */
  private spotsOnScreen(framing: FramingKey | null): number {
    const v = this.view();
    const c = this.countView;
    const levels = this.ports.session.state.techLevels;
    if (framing === this.countFraming && this.hudVersion === this.countHud && levels === this.countLevels
      && v.x === c.x && v.y === c.y && v.right === c.right && v.bottom === c.bottom) {
      return this.countN;
    }
    c.x = v.x;
    c.y = v.y;
    c.right = v.right;
    c.bottom = v.bottom;
    this.countFraming = framing;
    this.countHud = this.hudVersion;
    this.countLevels = levels;
    const spots = framing === null ? undefined : FIND_SPOTS[framing];
    this.countN = spots === undefined ? 0 : countInView(spots, v, FIND_LAYOUT.viewInsetWorldPx, this.hudOn ? this.hudWorld : null, this.isUsable);
    return this.countN;
  }

  /**
   * The HUD box in world px (WP28a E3, the spot test). The DOM is read at hudRefreshMs and at once after a settings change; between
   * reads the world box follows the camera pose (zoom and scroll) with no DOM read. A missing or hidden element is no box.
   */
  private refreshHud(): void {
    if (this.hudDirty || this.nowMs >= this.hudNextMs) {
      this.hudDirty = false;
      this.hudNextMs = this.nowMs + FIND_LAYOUT.hudRefreshMs;
      this.readHud();
      this.poseZoom = Number.NaN;
    }
    const cam = this.scene.cameras.main;
    if (cam.zoom === this.poseZoom && cam.scrollX === this.poseX && cam.scrollY === this.poseY) return;
    this.poseZoom = cam.zoom;
    this.poseX = cam.scrollX;
    this.poseY = cam.scrollY;
    this.hudVersion += 1;
    const b = this.hudBox;
    const c = this.canvasBox;
    if (!this.hudOn || b === null || c === null) return;
    const p = this.worldPoint;
    cam.getWorldPoint(clientToGamePx(b.left, c.left, c.width, VIEW.width), clientToGamePx(b.top, c.top, c.height, VIEW.height), p);
    this.hudWorld.x = p.x;
    this.hudWorld.y = p.y;
    cam.getWorldPoint(clientToGamePx(b.right, c.left, c.width, VIEW.width), clientToGamePx(b.bottom, c.top, c.height, VIEW.height), p);
    this.hudWorld.right = p.x;
    this.hudWorld.bottom = p.y;
  }

  /** Reads the HUD buttons' box and the canvas box (client px). Runs at the refresh cadence only, never per frame. */
  private readHud(): void {
    const el = document.getElementById('hud-buttons');
    const c = this.scene.game.canvas.getBoundingClientRect();
    const b = el === null || el.hidden ? null : el.getBoundingClientRect();
    this.canvasBox = c;
    this.hudBox = b;
    this.hudOn = b !== null && b.width > 0 && b.height > 0 && c.width > 0 && c.height > 0;
  }

  /**
   * The ring of the alive Find: hidden while the crow drops the item, redrawn only when its colour or alpha step changed (at
   * most ringRedrawHz), and scaled by the dog's dust puff.
   */
  private updateRing(live: LiveFind, reduced: boolean, dropping: boolean, puffing: boolean): void {
    const ring = this.ring;
    const color = FIND_COLORS[this.eraNow()].ring;
    const step = Math.round(ringAlpha(this.nowMs, live.ageS, live.windowS, reduced) * FIND_LAYOUT.ringAlphaSteps);
    if ((color !== this.ringColor || step !== this.ringStep) && this.nowMs >= this.ringNextMs) this.drawRing(color, step);
    showIf(ring, !dropping);
    const scale = puffing ? FIND_LAYOUT.dustScale : 1;
    if (ring.scaleX !== scale) ring.setScale(scale);
  }

  /** Shows the marker for its phase; a finished hop or fade hides it and returns to idle. */
  private showPhase(framing: FramingKey | null, reduced: boolean): void {
    if (this.phase === 'alive') {
      if (this.live === null) {
        this.phase = 'idle';
        this.hideMarker();
        return;
      }
      this.showAlive(framing, reduced);
      return;
    }
    if (this.phase === 'hop') {
      if (this.phaseMs >= FIND_LAYOUT.hopMs) {
        this.phase = 'idle';
        this.hideMarker();
        return;
      }
      this.showHop();
      return;
    }
    if (this.phase === 'fade') {
      if (this.phaseMs >= FIND_LAYOUT.expireFadeMs) {
        this.phase = 'idle';
        this.hideMarker();
        return;
      }
      this.showFade();
      return;
    }
    this.hideMarker();
  }

  /** Session 'find' events: a spawn shows and announces, an expiry fades, a collect hops and pays out the gain block. */
  private onFind(e: SessionEvents['find']): void {
    if (e.kind === 'spawn') this.onSpawn(e.serial, e.relic);
    else if (e.kind === 'expire') this.onExpire();
    else this.onCollect(e);
  }

  private onSpawn(serial: number, relic: boolean): void {
    this.shown += 1;
    this.live = { serial, relic, ageS: 0, windowS: FINDS.windowS };
    this.cell = itemCell(serial, relic);
    this.phase = 'alive';
    this.phaseMs = 0;
    this.choose(this.ports.director()?.framingKey() ?? null);
    this.hasPerch = false;
    if (this.producer === 'crow') {
      const perch = this.ports.director()?.crowPerchPos() ?? null;
      if (perch !== null) {
        this.perch.x = perch.x;
        this.perch.y = perch.y;
        this.hasPerch = true;
      }
    }
    this.askProducer();
    this.paint();
    this.ports.ui.worldView.announce(
      FIND_WORLD_TEXT.a11yPrefix,
      FIND_WORLD_TEXT.announceSpawn.replace('{producer}', FIND_WORLD_TEXT.producers[this.producer ?? 'ground']),
    );
  }

  /**
   * The producer's action (WP28b): the Director runs it and returns its lead, and the item shows that long after now (at most
   * maxLeadMs). Reduced motion asks nothing and waits for nothing; a producer with no action (gust, ground, chladni, lift) returns 0 from the Director.
   */
  private askProducer(): void {
    const spot = this.spot;
    const d = this.ports.director();
    let lead = 0;
    if (spot !== null && d !== null && !this.ports.reducedMotion()) {
      lead = d.findProducer(spot.producer, spot.x, spot.lane);
    }
    this.showAtMs = this.phaseMs + leadWaitMs(lead);
  }

  /**
   * Reports the live Find's world x to the Director (setFindAt, WP28b): once, when the item first shows, and null when the Find goes (a collect,
   * an expiry or a hide). The Director queues its find cue on the first x only.
   */
  private reportFind(worldX: number | null): void {
    if (worldX === null) {
      if (!this.reported) return;
      this.reported = false;
      this.ports.director()?.setFindAt(null);
      return;
    }
    if (this.reported) return;
    this.reported = true;
    this.ports.director()?.setFindAt(worldX);
  }

  /** Paints the live Find's item cell, its ring (in the era's colour) and the glint's tint. Called at a spawn and when a live Find is taken over. */
  private paint(): void {
    const era = this.eraNow();
    this.item.setFrame(this.cell);
    this.drawRing(FIND_COLORS[era].ring, FIND_LAYOUT.ringAlphaSteps);
    const fill = FIND_COLORS[era].tintFill;
    if (fill === null) this.glint.clearTint();
    else this.glint.setTintFill(fill);
  }

  /** Expiry: the Find fades with no text and no payout. Under reduced motion it is simply gone. */
  private onExpire(): void {
    this.expired += 1;
    this.live = null;
    this.reportFind(null);
    if (this.ports.reducedMotion()) {
      this.phase = 'idle';
      this.hideMarker();
      return;
    }
    this.phase = 'fade';
    this.phaseMs = 0;
    this.setZoneInput(false);
  }

  /**
   * Collected (the session paid before this event): a relic announces its note (or the blank page) and shows no gain block;
   * any other Find announces its item and shows the gain block headed by its payout time.
   */
  private onCollect(e: SessionEvents['find']): void {
    this.collected += 1;
    this.live = null;
    this.reportFind(null);
    const voice = this.ports.ui.worldView;
    if (e.relic) {
      const note = e.noteIndex === null ? undefined : RELIC_NOTES[e.noteIndex];
      voice.announce(FIND_WORLD_TEXT.a11yPrefix, note === undefined ? FIND_TEXT.blankPage : FIND_WORLD_TEXT.announceRelic.replace('{text}', note.text));
    } else {
      const item = FIND_WORLD_TEXT.items[this.cell] ?? FIND_WORLD_TEXT.items[0];
      voice.announce(FIND_WORLD_TEXT.a11yPrefix, FIND_WORLD_TEXT.announceCollect.replace('{item}', item).replace('{s}', trimNumber(e.seconds)));
      if (e.payout !== null) this.showCollectBlock(e.seconds, e.payout);
    }
    if (this.ports.reducedMotion()) {
      this.phase = 'idle';
      this.hideMarker();
      return;
    }
    this.phase = 'hop';
    this.phaseMs = 0;
    this.setZoneInput(false);
  }

  /** The collect popup: one gain block above the item, headed by the payout time. Untracked: it is never a crank merge target. */
  private showCollectBlock(seconds: number, payout: ResourceMap): void {
    const header: GainLine = { res: 'me', text: FIND_WORLD_TEXT.popupHeader.replace('{s}', trimNumber(seconds)) };
    const fontPx = gainFontPx(this.scene.cameras.main.zoom, FLOATING_TEXT.fontSizePx, FLOATING_TEXT.minScreenPx);
    const at = { x: this.container.x + FIND_LAYOUT.blockOffsetWorldPx.x, y: this.container.y + FIND_LAYOUT.blockOffsetWorldPx.y };
    this.ports.floatingText.showBlock(at, [header, ...clickGainLines(payout)], fontPx, false, false);
  }

  /** Session reset (a new game or a new cycle): the clock is fresh, so the copy of the live Find goes with it. */
  private onReset(): void {
    this.live = null;
    this.phase = 'idle';
    this.hideMarker();
  }

  /**
   * Zone pointer and the G command: picks up the live Find, only while eligible and the marker shows it. The gates are read
   * again here, so a modal opened since the last frame still blocks the click.
   */
  private collect(): void {
    this.fillGates();
    if (!this.eligible || !faultEligible(this.gates)) return;
    if (this.phase !== 'alive' || this.live === null || !this.container.visible) return;
    this.ports.session.collectFind();
  }

  /**
   * Reads the gates into the reused gates object. The same overlay rules as the fault marker, so a Find hides exactly where a
   * fault does. Reads only; allocates nothing.
   */
  private fillGates(): void {
    const g = this.gates;
    const ui = this.ports.ui;
    const techTreeOpen = ui.techTree.isOpen();
    g.tabHidden = document.hidden;
    g.photoActive = this.ports.photo()?.isActive() === true;
    g.techTreeOpen = techTreeOpen;
    g.eraCardShown = ui.eraCards.isShown();
    g.modalOpen = ui.modals.isOpen() && ui.modals.topId() !== PHOTO_MODE.modalId && !techTreeOpen;
    g.cycleBusy = this.ports.cycle()?.isActive() === true || ui.modals.has('cycleConfirm');
    g.teaserOn = this.uiRoot?.classList.contains('demo-teaser-on') === true;
    g.demoCardOpen = ui.modals.has('demo-end');
    g.endingPhase = this.ports.session.state.ending.phase;
    g.enabled = this.enabled;
  }

  /**
   * Picks the spot of the live Find in the framing: the serial's slot among the spots on screen, skipping any spot too close
   * to a cast member's feet. Sets the producer and the container's depth (its yard lane). Null spot when none is on screen.
   */
  private choose(framing: FramingKey | null): void {
    this.spotFraming = framing;
    const spots = framing === null ? undefined : FIND_SPOTS[framing];
    const live = this.live;
    if (spots === undefined || live === null) {
      this.spot = null;
      this.spotIndex = -1;
      this.producer = null;
      return;
    }
    const spot = pickSpot(spots, live.serial, this.isOnScreen, this.readCastFeet(), FIND_LAYOUT.minCastDistPx);
    this.spot = spot;
    this.spotIndex = spot === null ? -1 : spots.indexOf(spot);
    this.producer = spot === null ? null : spot.producer;
    if (spot !== null) this.container.setDepth(FIND_LAYOUT.depthBase + FIND_LAYOUT.yardDepth * spot.lane);
  }

  /** The feet of the cast members on screen, in world px (the poke targets of kind 'cast', converted from game px). Spawn only. */
  private readCastFeet(): readonly Vec2[] {
    this.castFeet.length = 0;
    const d = this.ports.director();
    if (d === null) return this.castFeet;
    const n = d.pokeTargets(this.targets);
    const cam = this.scene.cameras.main;
    for (let i = 0; i < n; i += 1) {
      const t = this.targets[i];
      if (t === undefined || t.kind !== 'cast') continue;
      this.castFeet.push({ x: cam.worldView.x + (t.x + t.w / 2) / cam.zoom, y: cam.worldView.y + (t.y + t.h) / cam.zoom });
    }
    return this.castFeet;
  }

  /** Shows the live Find on its spot: the item (with its producer's intro), the glint, the ring and the zone input. */
  private showAlive(framing: FramingKey | null, reduced: boolean): void {
    if (framing !== this.spotFraming) {
      this.choose(framing);
      this.hasPerch = false;
      // A spot change before the item shows is a spot the producer did not act for: the producer is asked again (the wait restarts).
      if (this.phaseMs < this.showAtMs) this.askProducer();
    }
    const spot = this.spot;
    const live = this.live;
    if (spot === null || live === null) {
      this.hideMarker();
      return;
    }
    // The item waits for the producer's lead (WP28b): hidden until it shows, and the intro clock starts at the show.
    const t = this.phaseMs - this.showAtMs;
    if (t < 0) {
      this.hideMarker();
      return;
    }
    this.reportFind(spot.x);
    const feetY = GROUND_Y + spot.lane;
    // The intro offsets (local to the container, world px) and the item's own visibility and scale.
    let dx = 0;
    let dy = 0;
    let riseY = 0;
    let itemShown = true;
    let scaleX = 1;
    let dropping = false;
    let puffing = false;
    if (!reduced) {
      switch (this.producer) {
        case 'crow':
          if (this.hasPerch && t < FIND_LAYOUT.dropBounceMs) {
            const f = dropFraction(t);
            dx = (1 - f) * (this.perch.x - spot.x);
            dy = (1 - f) * (this.perch.y - feetY);
            dropping = true;
          }
          break;
        case 'dog':
          if (dustPuffing(t)) {
            itemShown = false;
            puffing = true;
          }
          break;
        case 'gust':
          if (flipShown(t)) scaleX = flipScaleX(t);
          else itemShown = false;
          break;
        case 'ground':
        case 'organ':
        case 'radio':
        case 'coinReturn':
        case 'puddle':
        case 'vent':
        case 'pump':
          riseY = riseOffsetPx(t);
          break;
        case 'chladni':
          // The item walks along the ring to its node (WP28b); its ring goes with it (moveTo below).
          dx = chladniOffsetPx(spot.x, t);
          break;
        case 'lift':
          // The item lifts 12-16 px and hangs, bobbing (WP28b); the ring stays on the ground under it.
          riseY = -liftHeightPx(t, live.serial) + liftBobPx(t);
          break;
        default:
          break;
      }
    }
    // Every sprite write is skipped when its value holds (the marker runs every frame; E5).
    moveTo(this.container, spot.x, feetY);
    alphaIf(this.container, 1);
    showIf(this.container, true);
    const itemY = dy + riseY;
    moveTo(this.item, dx, itemY);
    showIf(this.item, itemShown);
    const sx = PIXEL_SCALE * scaleX;
    if (this.item.scaleX !== sx || this.item.scaleY !== PIXEL_SCALE) this.item.setScale(sx, PIXEL_SCALE);
    this.setGlintFrame(glintFrame(this.nowMs, reduced, glintSlowed(live.ageS, live.windowS)));
    moveTo(this.glint, dx + GLINT_X, itemY + GLINT_Y);
    alphaIf(this.glint, 1);
    showIf(this.glint, true);
    this.updateRing(live, reduced, dropping, puffing);
    moveTo(this.ring, dx, 0);
    moveTo(this.zone, dx, itemY - ITEM_PX / 2);
    this.setZoneSize();
    this.setZoneInput(true);
  }

  /** The collect hop: the item rises and falls, the glint flashes once; the ring is gone. */
  private showHop(): void {
    const hop = hopOffsetPx(this.phaseMs);
    alphaIf(this.container, 1);
    showIf(this.container, true);
    showIf(this.ring, false);
    moveTo(this.item, 0, hop);
    showIf(this.item, true);
    if (this.item.scaleX !== PIXEL_SCALE) this.item.setScale(PIXEL_SCALE, PIXEL_SCALE);
    this.setGlintFrame(FIND_ART.glint[2]);
    moveTo(this.glint, GLINT_X, hop + GLINT_Y);
    alphaIf(this.glint, fadeAlpha(this.phaseMs, FIND_LAYOUT.flashMs));
    showIf(this.glint, true);
    moveTo(this.zone, 0, hop - ITEM_PX / 2);
    this.setZoneInput(false);
  }

  /** The expiry fade: the whole marker fades at its last place over expireFadeMs. */
  private showFade(): void {
    alphaIf(this.container, fadeAlpha(this.phaseMs, FIND_LAYOUT.expireFadeMs));
    showIf(this.container, true);
    showIf(this.item, true);
    showIf(this.glint, true);
    showIf(this.ring, true);
    this.setZoneInput(false);
  }

  /** Hidden: no visuals and no input (the HandCrank.setEnabled pattern). The phase and the live Find stay. */
  private hideMarker(): void {
    showIf(this.container, false);
    this.setZoneInput(false);
    this.reportFind(null);
  }

  /** The zone takes pointer input only while the marker shows a live Find, so a hidden marker never swallows a crank click. */
  private setZoneInput(on: boolean): void {
    const input = this.zone.input;
    if (input && input.enabled !== on) input.enabled = on;
  }

  /** The zone size: an item cell, or hitMinScreenPx on screen at this zoom. Resized only on change. */
  private setZoneSize(): void {
    const side = zoneSideWorld(this.scene.cameras.main.zoom);
    if (side === this.zoneSide) return;
    this.zoneSide = side;
    this.hitRect.setTo(0, 0, side, side);
    this.zone.setSize(side, side);
  }

  /**
   * The ground ring: an ellipse around the item foot, 1 art px stroke, in the era's colour at an alpha step (of ringAlphaSteps).
   * Paint (the spawn) draws it at once; updateRing redraws it only on a colour or step change, at most ringRedrawHz.
   */
  private drawRing(color: number, step: number): void {
    const g = this.ring;
    g.clear();
    g.lineStyle(FIND_LAYOUT.ringStrokeArtPx * PIXEL_SCALE, color, step / FIND_LAYOUT.ringAlphaSteps);
    g.strokeEllipse(0, 0, FIND_LAYOUT.ringRadiusArtPx.x * 2 * PIXEL_SCALE, FIND_LAYOUT.ringRadiusArtPx.y * 2 * PIXEL_SCALE);
    this.ringColor = color;
    this.ringStep = step;
    this.ringNextMs = this.nowMs + 1000 / FIND_LAYOUT.ringRedrawHz;
  }

  private setGlintFrame(frame: number): void {
    if (frame === this.glintFrameCache) return;
    this.glintFrameCache = frame;
    this.glint.setFrame(frame);
  }

  /** The era of the session's tech levels. Read again only when the levels object changes (a buy replaces it). */
  private eraNow(): EraNumber {
    const levels = this.ports.session.state.techLevels;
    if (levels !== this.eraLevels) {
      this.eraLevels = levels;
      this.eraCache = currentEra(levels);
    }
    return this.eraCache;
  }

  private view(): Phaser.Geom.Rectangle {
    return this.scene.cameras.main.worldView;
  }

}
