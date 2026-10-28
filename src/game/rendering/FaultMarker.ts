import Phaser from 'phaser';
import { DEPTH, FLOATING_TEXT, PIXEL_SCALE } from '../../data/world';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { MachineComponentId, Vec2 } from '../../data/machineComponents';
import type { EraNumber } from '../../data/eras';
import type { ResourceMap, TechId } from '../../data/types';
import { FAULT_MARKER, FAULT_TEXT } from '../../data/faultMarker';
import { PHOTO_MODE } from '../../data/photoMode';
import type { FaultAlive, GameSession } from '../../simulation';
import type { SessionEvents } from '../../simulation/events';
import { currentEra } from '../../simulation/progression/era';
import type { Signal } from '../../utils/signal';
import type { WorldUi } from '../scenes/WorldScene';
import type { PhotoModeController } from '../photoModeController';
import type { CycleTransition } from './CycleTransition';
import { clickGainLines } from '../../ui/hudView';
import type { GainLine } from '../../ui/hudView';
import type { MachineView } from '../entities/MachineView';
import { gainFontPx } from '../math/gainBlock';
import {
  barWidthPx, fadeAlpha, faultCode, faultEligible, faultFxFrame, faultTagFrame, hitSizeWorld, pickAnchor,
} from '../math/faultMarker';
import type { FaultGates } from '../math/faultMarker';
import { componentBounds, machineLocalToWorld } from '../math/machineLayout';
import type { FloatingText } from './FloatingText';

// WP27 Machine Faults, the marker (C9 renderer). A plate over the part a fault sits on, with a timer bar, a code label and
// a click zone. Built once in the constructor (one top-level display object: the container); update() places it, the
// session events announce and pay out. The pure rules are in game/math/faultMarker.ts; every number is in data/faults.ts or data/faultMarker.ts.
// A lazy chunk: only WorldScene.create (import()) and bootstrap (warm-up) reach this module, so the app chunk stays small.

/**
 * The marker reads these lazily on every update (the WorldScene port pattern): nothing is captured at construction.
 * The gate readers live here, not in WorldScene, so the app chunk does not carry them: WorldScene hands over its live objects.
 */
export interface FaultMarkerPorts {
  session: Pick<GameSession, 'state' | 'settings' | 'faults' | 'faultAlive' | 'stepFaults' | 'clearFault' | 'on'>;
  machine: () => MachineView | null;
  floatingText: FloatingText;
  /** The overlays the gates read, and the speech bubble's live region (worldView.announce). */
  ui: Pick<WorldUi, 'techTree' | 'modals' | 'eraCards' | 'worldView'>;
  /** Read per frame: the World scene creates the photo controller and the cycle transition after this marker is built. */
  photo: () => PhotoModeController | null;
  cycle: () => CycleTransition | null;
  /** The F key command (ctx.commands.clearFault): clears the live fault while the marker is eligible. */
  clearCommand: Signal<void>;
}

/**
 * Counters and state for the debug hook and the smokes. `x` and `y` are the centre of the click zone in world px (the plate centre).
 * `anchorWorld` is the cached top-centre point of the anchor part (null with no anchor); `tagFrame` and `fxFrame` are the last
 * frames set on the sprites (-1 before the first set).
 */
export interface FaultMarkerStats {
  visible: boolean;
  interactive: boolean;
  eligible: boolean;
  anchor: MachineComponentId | null;
  anchorWorld: Vec2 | null;
  code: string | null;
  x: number;
  y: number;
  age: number;
  window: number;
  shown: number;
  cleared: number;
  missed: number;
  meanMs: number;
  tagFrame: number;
  fxFrame: number;
}

/**
 * The debug hook's fault probe (faultStats): the clock's public numbers, the marker's stats and two click points in client px.
 * client is the marker centre (null while hidden); anchorClient is the anchor part's top centre (null with no anchor).
 */
export interface FaultDebugStats {
  unlocked: boolean; alive: FaultAlive | null; nextIn: number | null; spawned: number; caught: number; missed: number;
  overdriveLeft: number; eligible: boolean; marker: FaultMarkerStats;
  client: { x: number; y: number } | null; anchorClient: { x: number; y: number } | null;
}

/** hidden: nothing; alive: the live fault; clear: the clear puff for a moment; fade: the fade after an expiry. */
type Phase = 'hidden' | 'alive' | 'clear' | 'fade';

/** Window of update() wall times kept for stats().meanMs. A debug probe window, not tuning. */
const TIMING_SAMPLES = 300;

/** The second label line: the tag and the key that clears the fault. */
const KEY_LINE = FAULT_TEXT.tag + ' ' + FAULT_TEXT.key;

/** A count or a time in player text: at most two decimals, no trailing zeros (as the effect text). */
function trimNumber(x: number): string {
  return String(Number(x.toFixed(2)));
}

/**
 * The fault marker of one World scene. Hidden unless a fault is alive and the marker is eligible (no overlay, no era card,
 * no ending, faults on); the zone takes input only while it shows, so a hidden marker never swallows a crank click.
 */
export class FaultMarker {
  private readonly scene: Phaser.Scene;
  private readonly ports: FaultMarkerPorts;
  private readonly container: Phaser.GameObjects.Container;
  private readonly tag: Phaser.GameObjects.Sprite;
  private readonly fx: Phaser.GameObjects.Sprite;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
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
  /** Each part's world point, computed once from its art box: the attachments never move. */
  private readonly anchorPoints = new Map<MachineComponentId, Vec2>();
  /** Ring buffer of the last update() durations (ms); `timingCursor` is the next slot to write. */
  private readonly timings = new Float64Array(TIMING_SAMPLES);
  private timingCount = 0;
  private timingCursor = 0;
  private readonly unsubscribeFault: () => void;
  private readonly unsubscribeCommand: () => void;
  private readonly onPointerDown = (): void => this.clear();
  private readonly onScreen = (id: MachineComponentId): boolean => this.isOnScreen(id);
  /** Debug switch (the setFaults hook): off freezes the clock (not eligible) and hides a live marker. */
  private enabled = true;
  private eligible = false;
  private phase: Phase = 'hidden';
  /** Clear puff: ms left. */
  private clearLeftMs = 0;
  /** Fade after an expiry: ms elapsed. */
  private fadeMs = 0;
  private anchor: MachineComponentId | null = null;
  /** The cached world point of `anchor` (the same object as in anchorPoints); null with no anchor. */
  private anchorWorld: Vec2 | null = null;
  /** The code of the live fault; null when none is alive. */
  private code: string | null = null;
  private era: EraNumber = 1;
  /** The era cache: the tech levels object it was read from (a buy replaces that object), and the era read from it. */
  private eraLevels: Readonly<Record<TechId, number>> | null = null;
  private eraCache: EraNumber = 1;
  private ageS = 0;
  private windowS = 0;
  /** Last frames set on the sprites, so setFrame runs only when the frame changes. */
  private tagFrame = -1;
  private fxFrame = -1;
  /** Last bar width in art px, so the Graphics is redrawn only when the width changes. */
  private barArt = -1;
  /** Last label font size in world px. */
  private labelPx: number = FAULT_MARKER.layout.label.fontPx;
  /** Last zone size in world px. */
  private hitSize = -1;
  private shown = 0;
  private cleared = 0;
  private missed = 0;

  constructor(scene: Phaser.Scene, ports: FaultMarkerPorts) {
    this.scene = scene;
    this.ports = ports;
    this.uiRoot = document.getElementById('ui-root');
    const label = FAULT_MARKER.layout.label;
    this.container = scene.add.container(0, 0).setDepth(DEPTH.floatingText - 2);
    // Sprites are scaled from art px to world px and hang from the bottom centre, as the part art does.
    this.tag = scene.add.sprite(0, 0, FAULT_MARKER.art.sheet, FAULT_MARKER.art.tag[0]).setOrigin(0.5, 1).setScale(PIXEL_SCALE);
    this.fx = scene.add.sprite(0, 0, FAULT_MARKER.art.sheet, FAULT_MARKER.art.fx[1][0]).setOrigin(0.5, 1).setScale(PIXEL_SCALE);
    this.bar = scene.add.graphics();
    // The label sits under the bar: plate, gap, bar, gap, then the two-line text.
    this.label = scene.add
      .text(0, (FAULT_MARKER.layout.gapArtPx * 2 + FAULT_MARKER.layout.barArtPx.h) * PIXEL_SCALE, '', {
        fontFamily: 'monospace',
        fontSize: label.fontPx + 'px',
        color: label.color,
        fontStyle: 'bold',
        stroke: label.strokeColor,
        strokeThickness: label.strokePx,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    // The zone covers the plate (centred on it) and is at least hitMinScreenPx on screen whatever the zoom.
    const size = Math.max(this.tag.displayWidth, hitSizeWorld(FAULT_MARKER.layout.hitMinScreenPx, scene.cameras.main.zoom));
    this.hitRect = new Phaser.Geom.Rectangle(0, 0, size, size);
    this.zone = scene.add.zone(0, -this.tag.displayHeight / 2, size, size);
    // Zone hit areas are in local top-left coordinates, so (0, 0, size, size) covers the zone box (as HandCrank's circle does).
    this.zone.setInteractive({
      hitArea: this.hitRect,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.container.add([this.tag, this.fx, this.bar, this.label, this.zone]);
    this.zone.on('pointerdown', this.onPointerDown);
    this.setZoneInput(false);
    this.unsubscribeFault = ports.session.on('fault', (e) => this.onFault(e));
    this.unsubscribeCommand = ports.clearCommand.on(() => this.clear());
  }

  /** Per frame: steps the fault clock, then shows, hides or moves the marker. The call itself is timed for the probe. */
  update(deltaMs: number): void {
    const t0 = performance.now();
    this.step(deltaMs);
    this.recordTiming(performance.now() - t0);
  }

  /** Turns the marker on or off. Off hides a live marker at once; the clock freezes through eligibility. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.hideMarker();
  }

  stats(): FaultMarkerStats {
    let sum = 0;
    for (let i = 0; i < this.timingCount; i += 1) sum += this.timings[i] ?? 0;
    return {
      visible: this.container.visible,
      interactive: this.zone.input?.enabled === true,
      eligible: this.eligible,
      anchor: this.anchor,
      anchorWorld: this.anchorWorld,
      code: this.code,
      // The zone sits in the container at a fixed offset (the plate centre), so its world centre is the sum.
      x: this.container.x + this.zone.x,
      y: this.container.y + this.zone.y,
      age: this.ageS,
      window: this.windowS,
      shown: this.shown,
      cleared: this.cleared,
      missed: this.missed,
      meanMs: this.timingCount === 0 ? 0 : sum / this.timingCount,
      tagFrame: this.tagFrame,
      fxFrame: this.fxFrame,
    };
  }

  /**
   * The debug hook's fault probe. toClient maps a world point to client px (the hook's own conversion, so the smokes click
   * where the marker is drawn). Reads only: nothing here moves the clock or the marker.
   */
  debugStats(toClient: (p: Vec2) => { x: number; y: number }): FaultDebugStats {
    const marker = this.stats();
    const faults = this.ports.session.faults;
    return {
      unlocked: faults.unlocked, alive: faults.alive, nextIn: faults.nextIn, spawned: faults.spawned, caught: faults.caught,
      missed: faults.missed, overdriveLeft: faults.overdriveLeft, eligible: marker.eligible, marker,
      client: marker.visible ? toClient({ x: marker.x, y: marker.y }) : null,
      // The marker's own anchor point (the top centre of the part, AD2 F1b): the smokes click and measure from it.
      anchorClient: marker.anchorWorld === null ? null : toClient(marker.anchorWorld),
    };
  }

  /** Unsubscribes and destroys the container (and so its children). */
  destroy(): void {
    this.unsubscribeFault();
    this.unsubscribeCommand();
    // Phaser may already have destroyed the container (scene teardown); its scene is then unset.
    if (this.container.scene) this.container.destroy();
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

  /** One frame: the gates, the clock, then the marker's phase. A bad delta (NaN, negative) counts as no time. */
  private step(deltaMs: number): void {
    const session = this.ports.session;
    const reduced = session.settings.reducedMotion;
    const era = this.eraNow();
    const dtMs = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
    this.fillGates();
    const eligible = faultEligible(this.gates);
    this.eligible = eligible;
    // The clock ticks only while the player can act on the machine and one anchor of the era is on screen (WP27 C9).
    // stepFaults clamps the step itself (FAULTS.maxStepS).
    session.stepFaults(dtMs / 1000, eligible && this.eraAnchorOnScreen(era));
    // The per-frame reader: faultAlive is the clock's own object (no copy), where faults would allocate a snapshot.
    const alive = session.faultAlive;
    if (alive === null) {
      this.code = null;
      this.anchor = null;
      this.anchorWorld = null;
      this.ageS = 0;
      this.windowS = 0;
    }
    if (!eligible) {
      this.hideMarker();
      return;
    }
    if (alive !== null) {
      this.showAlive(alive.serial, alive.age, alive.window, era, reduced);
      return;
    }
    if (this.phase === 'clear') {
      this.clearLeftMs -= dtMs;
      if (this.clearLeftMs > 0) {
        this.showClear();
        return;
      }
    } else if (this.phase === 'fade') {
      this.fadeMs += dtMs;
      if (this.fadeMs < FAULT_MARKER.layout.fadeMs) {
        this.showFade(reduced);
        return;
      }
    }
    this.hideMarker();
  }

  /** Session 'fault' events: a spawn announces, a clear pays out (the session paid before this event), an expiry fades. */
  private onFault(e: SessionEvents['fault']): void {
    const reduced = this.ports.session.settings.reducedMotion;
    if (e.kind === 'spawn') {
      this.shown += 1;
      const era = this.eraNow();
      this.ports.ui.worldView.announce(FAULT_TEXT.a11yPrefix, FAULT_TEXT.announceSpawn.replace('{code}', faultCode(era, e.serial)));
      return;
    }
    if (e.kind === 'expire') {
      // Nothing is lost on expiry: no announcement, no payout.
      this.missed += 1;
      if (reduced) {
        this.hideMarker();
      } else {
        this.phase = 'fade';
        this.fadeMs = 0;
      }
      return;
    }
    this.cleared += 1;
    this.setZoneInput(false);
    if (e.payout !== null) this.showClearPopup(e.payout);
    const faults = this.ports.session.faults;
    let text = FAULT_TEXT.announceClear;
    if (e.overdriveSeconds > 0) {
      text += ' ' + FAULT_TEXT.overdrive.replace('{f}', trimNumber(faults.overdriveFactor)).replace('{s}', trimNumber(e.overdriveSeconds));
    }
    this.ports.ui.worldView.announce(FAULT_TEXT.a11yPrefix, text);
    if (reduced) {
      this.hideMarker();
    } else {
      this.phase = 'clear';
      this.clearLeftMs = FAULT_MARKER.layout.clearFrameMs;
    }
  }

  /** The clear popup: one gain block at the marker, headed by the payout time. Untracked: it is never a crank merge target. */
  private showClearPopup(payout: ResourceMap): void {
    const header: GainLine = {
      res: 'me',
      text: FAULT_TEXT.popupHeader.replace('{s}', trimNumber(this.ports.session.faults.payoutSeconds)),
    };
    const fontPx = gainFontPx(this.scene.cameras.main.zoom, FLOATING_TEXT.fontSizePx, FLOATING_TEXT.minScreenPx);
    this.ports.floatingText.showBlock({ x: this.container.x, y: this.container.y }, [header, ...clickGainLines(payout)], fontPx, false, false);
  }

  /**
   * Zone pointer and the F command: clears the live fault, only while eligible and the marker shows it. An alive fault with no
   * anchor on screen is hidden, so neither the zone nor F clears it unseen.
   */
  private clear(): void {
    this.fillGates();
    if (!faultEligible(this.gates)) return;
    if (this.phase !== 'alive' || !this.container.visible) return;
    this.ports.session.clearFault();
  }

  /**
   * Reads the gates into the reused gates object. The same overlay rules as the living world's ports (WorldScene), so the
   * marker hides exactly where the world's bubbles and cast do. Reads only; allocates nothing.
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
   * True when a fault can show: one of the era's two anchors is on screen, or the fallback anchor is. This is pickAnchor's
   * rule, so the clock ticks exactly when a fault has a part to sit on (WP27 AD2 F2: era V had no fallback, so no fault came).
   */
  private eraAnchorOnScreen(era: EraNumber): boolean {
    const list: readonly MachineComponentId[] = FAULT_MARKER.anchors[era];
    for (let i = 0; i < list.length; i += 1) {
      const id = list[i];
      if (id !== undefined && this.isOnScreen(id)) return true;
    }
    return this.isOnScreen(FAULT_MARKER.fallbackAnchor);
  }

  /** A part is on screen when it is visible and its point lies inside the camera view, inset by anchorInsetWorldPx. */
  private isOnScreen(id: MachineComponentId): boolean {
    const machine = this.ports.machine();
    if (machine === null || machine.getComponentSprite(id)?.visible !== true) return false;
    const at = this.anchorPoint(id);
    const view = this.scene.cameras.main.worldView;
    const inset = FAULT_MARKER.layout.anchorInsetWorldPx;
    return at.x >= view.x + inset && at.x <= view.right - inset && at.y >= view.y + inset && at.y <= view.bottom - inset;
  }

  /**
   * The point the marker hangs from: the top centre of the part's art box (WP27 AD2 F1). The pivot would put the plate inside
   * the part. Cached per part id.
   */
  private anchorPoint(id: MachineComponentId): Vec2 {
    const known = this.anchorPoints.get(id);
    if (known !== undefined) return known;
    const b = componentBounds(MACHINE_COMPONENTS[id]);
    const point = machineLocalToWorld({ x: (b.left + b.right) / 2, y: b.top });
    this.anchorPoints.set(id, point);
    return point;
  }

  /** Shows the live fault on its anchor: flicker, timer bar, label and the zone input. No anchor on screen: hidden, the fault waits. */
  private showAlive(serial: number, ageS: number, windowS: number, era: EraNumber, reduced: boolean): void {
    const machine = this.ports.machine();
    const anchor = machine === null ? null : pickAnchor(era, serial, this.onScreen);
    if (machine === null || anchor === null) {
      this.hideMarker();
      return;
    }
    const at = this.anchorPoint(anchor);
    this.phase = 'alive';
    this.anchor = anchor;
    this.anchorWorld = at;
    this.era = era;
    this.ageS = ageS;
    this.windowS = windowS;
    const code = faultCode(era, serial);
    if (code !== this.code) {
      this.code = code;
      this.label.setText(code + '\n' + KEY_LINE);
    }
    this.container
      .setPosition(at.x + FAULT_MARKER.layout.offsetArtPx.x * PIXEL_SCALE, at.y + FAULT_MARKER.layout.offsetArtPx.y * PIXEL_SCALE)
      .setAlpha(1)
      .setVisible(true);
    const now = performance.now();
    this.tag.setVisible(true);
    this.setTagFrame(faultTagFrame(now, reduced));
    this.fx.setVisible(true);
    this.setFxFrame(faultFxFrame(now, era, reduced));
    this.drawBar(ageS, windowS);
    this.bar.setVisible(true);
    this.label.setVisible(true);
    this.setLabelFont();
    this.setZoneSize();
    this.setZoneInput(true);
  }

  /** The clear puff: the clear frame on the FX sprite, nothing else. */
  private showClear(): void {
    this.container.setAlpha(1).setVisible(true);
    this.tag.setVisible(false);
    this.bar.setVisible(false);
    this.label.setVisible(false);
    this.fx.setVisible(true);
    this.setFxFrame(FAULT_MARKER.art.clear);
    this.setZoneInput(false);
  }

  /** The fade after an expiry: the plate fades over fadeMs at its last place; the bar and the label are gone. */
  private showFade(reduced: boolean): void {
    this.container.setAlpha(fadeAlpha(this.fadeMs, FAULT_MARKER.layout.fadeMs)).setVisible(true);
    const now = performance.now();
    this.tag.setVisible(true);
    this.setTagFrame(faultTagFrame(now, reduced));
    this.fx.setVisible(true);
    this.setFxFrame(faultFxFrame(now, this.era, reduced));
    this.bar.setVisible(false);
    this.label.setVisible(false);
    this.setZoneInput(false);
  }

  /** Hidden: no visuals, no input (HandCrank.setEnabled pattern). */
  private hideMarker(): void {
    this.phase = 'hidden';
    this.anchor = null;
    this.anchorWorld = null;
    this.container.setVisible(false);
    this.setZoneInput(false);
  }

  /** The zone takes pointer input only while the marker shows a live fault, so a hidden marker never swallows a crank click. */
  private setZoneInput(on: boolean): void {
    if (this.zone.input) this.zone.input.enabled = on;
  }

  /** Redraws the timer bar only when its width in art px changes. The bar drains to the left, like a fuse. */
  private drawBar(ageS: number, windowS: number): void {
    const w = barWidthPx(ageS, windowS, FAULT_MARKER.layout.barArtPx.w);
    if (w === this.barArt) return;
    this.barArt = w;
    this.bar.clear();
    if (w <= 0) return;
    const fullPx = FAULT_MARKER.layout.barArtPx.w * PIXEL_SCALE;
    this.bar
      .fillStyle(FAULT_MARKER.layout.barColor, 1)
      .fillRect(-fullPx / 2, FAULT_MARKER.layout.gapArtPx * PIXEL_SCALE, w * PIXEL_SCALE, FAULT_MARKER.layout.barArtPx.h * PIXEL_SCALE);
  }

  /** The label font: never below its own size, and at least minScreenPx on screen at this zoom. Set only on change. */
  private setLabelFont(): void {
    const label = FAULT_MARKER.layout.label;
    const px = gainFontPx(this.scene.cameras.main.zoom, label.fontPx, label.minScreenPx);
    if (px === this.labelPx) return;
    this.labelPx = px;
    this.label.setFontSize(px).setStroke(label.strokeColor, (label.strokePx * px) / label.fontPx);
  }

  /** The zone size: the plate, or hitMinScreenPx on screen at this zoom, whichever is larger. Resized only on change. */
  private setZoneSize(): void {
    const size = Math.max(this.tag.displayWidth, hitSizeWorld(FAULT_MARKER.layout.hitMinScreenPx, this.scene.cameras.main.zoom));
    if (size === this.hitSize) return;
    this.hitSize = size;
    this.hitRect.setTo(0, 0, size, size);
    this.zone.setSize(size, size);
  }

  private setTagFrame(frame: number): void {
    if (frame === this.tagFrame) return;
    this.tagFrame = frame;
    this.tag.setFrame(frame);
  }

  private setFxFrame(frame: number): void {
    if (frame === this.fxFrame) return;
    this.fxFrame = frame;
    this.fx.setFrame(frame);
  }

  /** Keeps the last TIMING_SAMPLES update() durations; the oldest is overwritten once the buffer is full. */
  private recordTiming(ms: number): void {
    this.timings[this.timingCursor] = ms;
    this.timingCursor = (this.timingCursor + 1) % TIMING_SAMPLES;
    if (this.timingCount < TIMING_SAMPLES) this.timingCount += 1;
  }
}
