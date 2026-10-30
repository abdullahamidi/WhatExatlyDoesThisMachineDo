import Phaser from 'phaser';
import { CAMERA, CRANK_FEEDBACK, DEPTH, PIXEL_SCALE, VIEW } from '../../data/world';
import { POKE_LAYOUT } from '../../data/findWorld';
import { WORLD_LAYOUT } from '../../data/livingWorld';
import { PHOTO_MODE } from '../../data/photoMode';
import { TECHNOLOGIES } from '../../data/technologies';
import type { EraNumber } from '../../data/eras';
import type { PokeSoundId } from '../../data/pokes';
import type { PurchaseFailure, TechId } from '../../data/types';
import type { GameSession } from '../../simulation';
import { currentEra } from '../../simulation/progression/era';
import { bubbleTransform } from '../../ui/worldVoiceModel';
import type { GameFeedback } from '../context';
import type { WorldUi } from '../scenes/WorldScene';
import type { PhotoModeController } from '../photoModeController';
import type { CycleTransition } from './CycleTransition';
import type { PokeTarget, PokeTargetId, WorldDebugApi } from './LivingWorldDirector';
import { faultEligible } from '../math/faultMarker';
import type { FaultGates } from '../math/faultMarker';
import { TimingWindow } from '../math/findMarker';
import { pickZone } from '../math/pokePick';
import type { PokeZoneBox } from '../math/pokePick';

// WP28 poke layer (C12, the WorldReach chunk): the pooled zones over the poke targets (one container, screen space), the shared hover
// brackets and the Splice tooltip slab in #ui-root. Input follows P12: a poke or a dead-Splice buy fires on pointer up, only when the
// pointer moved at most CAMERA.dragThresholdPx since its press and is still over the same zone; a drag passes the zones (the zones are
// named CAMERA.dragPassName). The crank, the fault marker and the Find marker keep blocking. Targets, answers and pointer come from the
// director (C11); the purchase path is the session's. Every number is in data/findWorld.ts (POKE_LAYOUT) or data/pokes.ts.
// Zones and brackets are scroll factor 0: a zone's container position is (screen - half view) / zoom + half view (the camera's zoom
// about the view center), so the hit test (world point minus scroll) and the drawing agree at every zoom.
// The zone a pointer holds is the pick at the pointer (WP28b F28, pokePick.ts): the zone whose target centre is nearest wins where zones overlap.
// Phaser delivers a press to the top zone only, so the zone handlers resolve the zone from the pointer as well, and press and release share the pick.

/** The director port the poke layer reads (C11 subset): the targets, the answers, the pointer and the tooltip lines. */
export type PokeDirectorPort = Pick<WorldDebugApi, 'pokeTargets' | 'poke' | 'setPointer' | 'spliceTip'>;

export interface PokeLayerDeps {
  session: Pick<GameSession, 'state' | 'getTechView' | 'purchase'>;
  director: () => PokeDirectorPort | null;
  ui: Pick<WorldUi, 'techTree' | 'modals' | 'eraCards'>;
  photo: () => PhotoModeController | null;
  cycle: () => CycleTransition | null;
  feedback: Pick<GameFeedback, 'purchaseDenied' | 'worldSound'>;
  /** #ui-root: the tooltip slab lives here; its teaser class and UI zoom are read for the gates and the placement. */
  tooltipRoot: HTMLElement;
}

/** The layer's readings: the hovered target (null when none), the zones on, and the mean update() time (ms). */
export interface PokeLayerStats { hover: string | null; zones: number; meanMs: number }

/** One pooled zone and the target it covers. sx..sh: the target box in game px (screen); lx..lh: the zone's own box in container px. */
interface ZoneSlot {
  zone: Phaser.GameObjects.Zone;
  rect: Phaser.Geom.Rectangle;
  on: boolean;
  id: PokeTargetId | null;
  kind: PokeTarget['kind'] | null;
  sx: number; sy: number; sw: number; sh: number;
  lx: number; ly: number; lw: number; lh: number;
}

/** #ui-root geometry for the tooltip: game px to root CSS px is x * kx + ox (the same map as the speech bubbles). ok false while not laid out. */
interface TipGeo { ok: boolean; kx: number; ky: number; ox: number; oy: number; zoom: number; vw: number; vh: number }

/** Window of update() wall times kept for stats().meanMs. A debug probe window, not tuning. */
const TIMING_SAMPLES = 300;
/** The tooltip has four lines (C10 / SPLICE_TEXT): title, cost, effect and state. */
const TIP_LINES = 4;

/** True when the rectangle (x, y, w, h) meets the circle (cx, cy, r). */
function rectHitsCircle(x: number, y: number, w: number, h: number, cx: number, cy: number, r: number): boolean {
  const nx = Math.min(Math.max(cx, x), x + w);
  const ny = Math.min(Math.max(cy, y), y + h);
  const dx = nx - cx;
  const dy = ny - cy;
  return dx * dx + dy * dy < r * r;
}

/** A tech id (a Splice, the only tech targets). The poke target ids are the cast and props, or a TechId. */
function isTechTarget(id: PokeTargetId): id is TechId {
  return id in TECHNOLOGIES;
}

/** The poke layer of one World scene. Built once; update() places the zones and the hover feedback each frame. */
export class PokeLayer {
  private readonly scene: Phaser.Scene;
  private readonly ports: PokeLayerDeps;
  private readonly container: Phaser.GameObjects.Container;
  private readonly brackets: Phaser.GameObjects.Graphics;
  private readonly slots: ZoneSlot[] = [];
  /** The director's target boxes, filled in place each frame (the director keeps the objects, so nothing is allocated). */
  private readonly targets: PokeTarget[] = [];
  private readonly vec = new Phaser.Math.Vector2();
  /** The gate values of the latest frame, filled in place (the fault marker's gates: the same overlays hide a poke). */
  private readonly gates: FaultGates = {
    tabHidden: false, photoActive: false, techTreeOpen: false, eraCardShown: false, modalOpen: false,
    cycleBusy: false, teaserOn: false, demoCardOpen: false, endingPhase: 'none', enabled: true,
  };
  private readonly tipEl: HTMLDivElement;
  private readonly tipLines: HTMLDivElement[] = [];
  private readonly tipText: string[] = ['', '', '', ''];
  private readonly geo: TipGeo = { ok: false, kx: 1, ky: 1, ox: 0, oy: 0, zoom: 1, vw: VIEW.width, vh: VIEW.height };
  /** The crank hit circle plus its clearance, in game px (set each frame): no zone and no tooltip may meet it. */
  private hubX = 0;
  private hubY = 0;
  private clearPx = 0;
  /** The last update() durations (ms), for stats().meanMs. */
  private readonly timings = new TimingWindow(TIMING_SAMPLES);
  /** Index of the hovered zone, -1 for none. */
  private hoverSlot = -1;
  /** The pick list (WP28b F28), rebuilt each frame: the boxes of the zones that are on (pickCount live) and the slot each one belongs to. */
  private readonly pickBoxes: PokeZoneBox[] = Array.from({ length: POKE_LAYOUT.zones }, () => ({ cx: 0, cy: 0, w: 0, h: 0 }));
  private readonly pickSlot: number[] = Array.from({ length: POKE_LAYOUT.zones }, () => -1);
  private pickCount = 0;
  /** The Splice the tooltip shows (null: hidden), when it was last refreshed, and its last box position. */
  private tipOwner: TechId | null = null;
  private tipShown = false;
  private tipNextMs = 0;
  private tipW = 0;
  private tipH = 0;
  private tipX = Number.NaN;
  private tipY = Number.NaN;
  /** The brackets' last drawn box and color (valid: drawn for the current box). */
  private bracketsValid = false;
  private bx = 0;
  private by = 0;
  private bw = 0;
  private bh = 0;
  private bc = 0;
  /** An accepted poke flashes the brackets for one frame. */
  private flashPending = false;
  /** The press: the zone it began on (-1 none), the target it covered, and the pointer position. */
  private pressSlot = -1;
  private pressId: PokeTargetId | null = null;
  private pressX = 0;
  private pressY = 0;
  /** An answer sound waiting for its answer start (the director's delay). */
  private pendingSound: PokeSoundId | null = null;
  private pendingAt = 0;
  /** The era cache: the tech levels object it was read from (a buy replaces that object), and the era read from it. */
  private eraLevels: Readonly<Record<TechId, number>> | null = null;
  private eraCache: EraNumber = 1;

  constructor(scene: Phaser.Scene, deps: PokeLayerDeps) {
    this.scene = scene;
    this.ports = deps;
    this.container = scene.add.container(0, 0).setScrollFactor(0);
    this.brackets = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.dust + 1).setVisible(false);
    const side = POKE_LAYOUT.hitMinScreenPx;
    for (let i = 0; i < POKE_LAYOUT.zones; i += 1) {
      const rect = new Phaser.Geom.Rectangle(0, 0, side, side);
      const zone = scene.add.zone(0, 0, side, side).setOrigin(0, 0).setScrollFactor(0);
      // Named for the camera: a drag that starts on a poke zone pans (CameraController.pointerdown).
      zone.name = CAMERA.dragPassName;
      zone.setInteractive({ hitArea: rect, hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
      if (zone.input) zone.input.enabled = false;
      this.container.add(zone);
      this.slots.push({ zone, rect, on: false, id: null, kind: null, sx: 0, sy: 0, sw: side, sh: side, lx: 0, ly: 0, lw: side, lh: side });
      // The handlers resolve the zone from the pointer (WP28b F28): Phaser delivers a press to the top zone only.
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onDown(pointer));
      zone.on('pointerup', (pointer: Phaser.Input.Pointer) => this.onUp(pointer));
    }
    // The tooltip slab: one DOM element in #ui-root with four line elements, filled and placed by updateTip.
    this.tipEl = document.createElement('div');
    this.tipEl.className = 'wv-tip';
    this.tipEl.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < TIP_LINES; k += 1) {
      const line = document.createElement('div');
      this.tipEl.append(line);
      this.tipLines.push(line);
    }
    deps.tooltipRoot.append(this.tipEl);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onAnyUp);
    scene.input.on('pointerupoutside', this.onAnyUp);
  }

  /** Per frame (after the Find marker): the gates, the zones, the hover brackets and the tooltip. The call itself is timed. */
  update(): void {
    const t0 = performance.now();
    this.step();
    this.timings.record(performance.now() - t0);
  }

  /** The hovered target, the zones on and the mean update() time. Allocates one small object (a debug read). */
  stats(): PokeLayerStats {
    let zones = 0;
    for (const slot of this.slots) if (slot.on) zones += 1;
    const hovered = this.hoverSlot >= 0 ? this.slots[this.hoverSlot] : undefined;
    return {
      hover: hovered?.id ?? null,
      zones,
      meanMs: this.timings.mean(),
    };
  }

  /** Unsubscribes the input listeners and destroys the container, the brackets and the tooltip element. */
  destroy(): void {
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onAnyUp);
    this.scene.input.off('pointerupoutside', this.onAnyUp);
    this.tipEl.remove();
    // Phaser may already have destroyed these (scene teardown); their scene is then unset.
    if (this.container.scene) this.container.destroy();
    if (this.brackets.scene) this.brackets.destroy();
  }

  /** One frame: the answer sound, the gates, the target boxes into the zones, then the brackets and the tooltip. */
  private step(): void {
    const now = this.scene.time.now;
    this.sendPendingSound(now);
    this.fillGates();
    const open = faultEligible(this.gates);
    const d = this.ports.director();
    const cam = this.scene.cameras.main;
    const zoom = cam.zoom;
    const halfW = VIEW.width / 2;
    const halfH = VIEW.height / 2;
    // The crank hub in game px: the camera maps a world point with scroll factor 1 to (world - scroll - half) * zoom + half.
    this.hubX = (WORLD_LAYOUT.crankHub.x - cam.scrollX - halfW) * zoom + halfW;
    this.hubY = (WORLD_LAYOUT.crankHub.y - cam.scrollY - halfH) * zoom + halfH;
    this.clearPx = (CRANK_FEEDBACK.hitRadius * PIXEL_SCALE + WORLD_LAYOUT.crankClearPx) * zoom;
    const n = open && d !== null ? d.pokeTargets(this.targets) : 0;
    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      const t = i < n ? this.targets[i] : undefined;
      if (slot === undefined) continue;
      if (t === undefined) {
        this.setOn(i, false);
        continue;
      }
      const sw = Math.max(POKE_LAYOUT.hitMinScreenPx, t.w);
      const sh = Math.max(POKE_LAYOUT.hitMinScreenPx, t.h);
      // The zone is centred on its target (WP28b F28), so the zone's centre is the target's centre: the centre the pick measures from.
      const sx = t.x + (t.w - sw) / 2;
      const sy = t.y + (t.h - sh) / 2;
      slot.id = t.id;
      slot.kind = t.kind;
      slot.sx = sx;
      slot.sy = sy;
      slot.sw = sw;
      slot.sh = sh;
      // The zone's container box: the inverse of the camera map (the zone has scroll factor 0, so only the zoom and the view center apply).
      const lx = (sx - halfW) / zoom + halfW;
      const ly = (sy - halfH) / zoom + halfH;
      const lw = sw / zoom;
      const lh = sh / zoom;
      if (lx !== slot.lx || ly !== slot.ly || lw !== slot.lw || lh !== slot.lh) {
        slot.lx = lx;
        slot.ly = ly;
        slot.lw = lw;
        slot.lh = lh;
        slot.zone.setPosition(lx, ly);
        slot.rect.setTo(0, 0, lw, lh);
        slot.zone.setSize(lw, lh);
      }
      // A zone never meets the crank hit circle plus its clearance: such a target is not pokeable this frame.
      const clear = rectHitsCircle(sx, sy, sw, sh, this.hubX, this.hubY, this.clearPx);
      this.setOn(i, t.enabled && !clear);
    }
    this.buildPick();
    this.pickHover();
    this.drawBrackets();
    this.updateTip(now);
  }

  /** Turns a zone's input on or off. An off zone never swallows a press, and loses the hover. */
  private setOn(i: number, on: boolean): void {
    const slot = this.slots[i];
    if (slot === undefined || slot.on === on) return;
    slot.on = on;
    if (slot.zone.input) slot.zone.input.enabled = on;
    if (!on && this.hoverSlot === i) this.hoverSlot = -1;
  }

  /** The pick list (WP28b F28): the boxes of the zones that are on (centre and size, game px) in slot order, filled in place. Allocates nothing. */
  private buildPick(): void {
    let k = 0;
    for (let i = 0; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      const box = this.pickBoxes[k];
      if (slot === undefined || !slot.on || box === undefined) continue;
      box.cx = slot.sx + slot.sw / 2;
      box.cy = slot.sy + slot.sh / 2;
      box.w = slot.sw;
      box.h = slot.sh;
      this.pickSlot[k] = i;
      k += 1;
    }
    this.pickCount = k;
  }

  /** The hover (WP28b F28): the zone the pointer holds by pickZone, so the nearest target centre wins where zones overlap. None off the canvas. */
  private pickHover(): void {
    const p = this.scene.input.activePointer;
    this.hoverSlot = this.scene.game.input.isOver ? this.slotAt(p.x, p.y) : -1;
  }

  /** The slot of the zone that holds (x, y) in this frame's pick list (pickZone), or -1. */
  private slotAt(x: number, y: number): number {
    const k = pickZone(this.pickBoxes, this.pickCount, x, y);
    return k < 0 ? -1 : (this.pickSlot[k] ?? -1);
  }

  /** The corner brackets around the hovered target. One shared Graphics, redrawn only when its box or color changes. */
  private drawBrackets(): void {
    const slot = this.hoverSlot >= 0 ? this.slots[this.hoverSlot] : undefined;
    if (slot === undefined) {
      this.flashPending = false;
      if (this.bracketsValid) {
        this.brackets.setVisible(false);
        this.bracketsValid = false;
      }
      return;
    }
    const color = this.eraNow() >= POKE_LAYOUT.violetFromEra ? POKE_LAYOUT.bracketViolet : POKE_LAYOUT.bracketPaper;
    const flash = this.flashPending;
    this.flashPending = false;
    if (this.bracketsValid && !flash && slot.lx === this.bx && slot.ly === this.by && slot.lw === this.bw && slot.lh === this.bh && color === this.bc) {
      return;
    }
    // Brackets 2 art px outside the box; arms and stroke in art px (PIXEL_SCALE world px each, so they scale with the world).
    const arm = POKE_LAYOUT.bracketArmArtPx * PIXEL_SCALE;
    const out = POKE_LAYOUT.bracketOutsideArtPx * PIXEL_SCALE;
    const x0 = slot.lx - out;
    const y0 = slot.ly - out;
    const x1 = slot.lx + slot.lw + out;
    const y1 = slot.ly + slot.lh + out;
    const g = this.brackets;
    g.clear();
    g.lineStyle(POKE_LAYOUT.bracketStrokeArtPx * PIXEL_SCALE, flash ? POKE_LAYOUT.flashColor : color, POKE_LAYOUT.bracketAlpha);
    g.beginPath();
    g.moveTo(x0, y0 + arm).lineTo(x0, y0).lineTo(x0 + arm, y0);
    g.moveTo(x1 - arm, y0).lineTo(x1, y0).lineTo(x1, y0 + arm);
    g.moveTo(x1, y1 - arm).lineTo(x1, y1).lineTo(x1 - arm, y1);
    g.moveTo(x0 + arm, y1).lineTo(x0, y1).lineTo(x0, y1 - arm);
    g.strokePath();
    g.setVisible(true);
    // A flash frame is redrawn in the normal color on the next frame.
    this.bracketsValid = !flash;
    this.bx = slot.lx;
    this.by = slot.ly;
    this.bw = slot.lw;
    this.bh = slot.lh;
    this.bc = color;
  }

  /** The Splice tooltip: shown for the hovered Splice object, its text refreshed at tipRefreshMs, its place every frame. */
  private updateTip(now: number): void {
    const slot = this.hoverSlot >= 0 ? this.slots[this.hoverSlot] : undefined;
    const id = slot?.id ?? null;
    const splice = slot !== undefined && slot.on && (slot.kind === 'spliceDead' || slot.kind === 'spliceWoken');
    if (slot === undefined || id === null || !splice || !isTechTarget(id)) {
      this.tipOwner = null;
      this.hideTip();
      return;
    }
    if (id !== this.tipOwner) {
      this.tipOwner = id;
      this.tipNextMs = 0;
    }
    if (now >= this.tipNextMs) this.refreshTip(now, id);
    if (this.geo.ok && this.tipShown) this.placeTip(slot);
  }

  /** Reads the DOM geometry and the four lines (the director's spliceTip), and shows the slab. Runs at tipRefreshMs, never per frame. */
  private refreshTip(now: number, id: TechId): void {
    this.tipNextMs = now + POKE_LAYOUT.tipRefreshMs;
    this.readGeo();
    const lines = this.ports.director()?.spliceTip(id) ?? null;
    if (lines === null || !this.geo.ok) {
      this.hideTip();
      return;
    }
    for (let k = 0; k < TIP_LINES; k += 1) {
      const text = lines[k] ?? '';
      if (this.tipText[k] === text) continue;
      this.tipText[k] = text;
      const el = this.tipLines[k];
      if (el !== undefined) el.textContent = text;
    }
    this.tipW = this.tipEl.offsetWidth;
    this.tipH = this.tipEl.offsetHeight;
    if (!this.tipShown) {
      this.tipEl.classList.add('on');
      this.tipShown = true;
    }
  }

  /** Hides the slab (once: the class is written only on a change). */
  private hideTip(): void {
    if (!this.tipShown) return;
    this.tipShown = false;
    this.tipEl.classList.remove('on');
  }

  /**
   * Places the slab above its object's box, or below when the top would leave #ui-root or meet the crank circle, and clamps it into
   * the root. Written as a transform only when the snapped place moved.
   */
  private placeTip(slot: ZoneSlot): void {
    const g = this.geo;
    const bx = slot.sx * g.kx + g.ox;
    const by = slot.sy * g.ky + g.oy;
    const bw = slot.sw * g.kx;
    const bh = slot.sh * g.ky;
    const gap = POKE_LAYOUT.tipGapPx;
    const tw = this.tipW;
    const th = this.tipH;
    const cx = this.hubX * g.kx + g.ox;
    const cy = this.hubY * g.ky + g.oy;
    const cr = this.clearPx * g.kx;
    const x = bx + (bw - tw) / 2;
    const aboveY = by - gap - th;
    const belowY = by + bh + gap;
    const aboveOk = aboveY >= 0 && !rectHitsCircle(x, aboveY, tw, th, cx, cy, cr);
    const belowOk = belowY + th <= g.vh && !rectHitsCircle(x, belowY, tw, th, cx, cy, cr);
    const y = aboveOk || !belowOk ? aboveY : belowY;
    const px = Math.max(0, Math.min(x, g.vw - tw));
    if (px === this.tipX && y === this.tipY) return;
    this.tipX = px;
    this.tipY = y;
    this.tipEl.style.transform = bubbleTransform({ x: px, y, tailX: 0, tailUp: false }, g.zoom);
  }

  /** The canvas and #ui-root boxes, read at the tooltip's cadence only (the same map as the speech bubbles). */
  private readGeo(): void {
    const c = this.scene.game.canvas.getBoundingClientRect();
    const root = this.ports.tooltipRoot;
    const r = root.getBoundingClientRect();
    const zoom = Number.parseFloat(root.style.zoom);
    const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const g = this.geo;
    g.ok = c.width > 0 && c.height > 0 && r.width > 0 && r.height > 0;
    g.zoom = z;
    g.kx = c.width / (VIEW.width * z);
    g.ky = c.height / (VIEW.height * z);
    g.ox = (c.left - r.left) / z;
    g.oy = (c.top - r.top) / z;
    g.vw = r.width / z;
    g.vh = r.height / z;
  }

  /** Pointer down on a zone: the press is remembered (a left press only); the zone the pointer holds (slotAt) is what the press covers. */
  private onDown(pointer: Phaser.Input.Pointer): void {
    const i = this.slotAt(pointer.x, pointer.y);
    const slot = i >= 0 ? this.slots[i] : undefined;
    if (slot === undefined || slot.id === null || !pointer.leftButtonDown()) {
      this.pressSlot = -1;
      return;
    }
    this.pressSlot = i;
    this.pressId = slot.id;
    this.pressX = pointer.x;
    this.pressY = pointer.y;
  }

  /**
   * Pointer up on a zone: fires only for the zone the press began on, the same target, and a pointer that moved at most
   * CAMERA.dragThresholdPx. A dead Splice buys (or is refused); anything else is a poke.
   */
  private onUp(pointer: Phaser.Input.Pointer): void {
    const i = this.slotAt(pointer.x, pointer.y);
    const slot = i >= 0 ? this.slots[i] : undefined;
    const pressed = slot !== undefined && this.pressSlot === i && slot.id !== null && this.pressId === slot.id;
    this.pressSlot = -1;
    if (slot === undefined || slot.id === null || !pressed || !slot.on) return;
    if (Math.hypot(pointer.x - this.pressX, pointer.y - this.pressY) > CAMERA.dragThresholdPx) return;
    if (slot.kind === 'spliceDead' && isTechTarget(slot.id)) this.buy(slot.id);
    else this.poke(slot.id);
  }

  /** Clears the press on any pointer up (the zone's up ran first, so a release off the zone never leaves a press behind). */
  private readonly onAnyUp = (): void => {
    this.pressSlot = -1;
  };

  /**
   * A dead Splice: bought through the session's purchase path when affordable; otherwise refused with the reason (the
   * demo cap first, then "not enough" for a line that is in reach, else "locked"). The tooltip stays either way.
   */
  private buy(id: TechId): void {
    const session = this.ports.session;
    const view = session.getTechView(id);
    // The same answer as spliceState for a dead Splice (level 0), read from the view here: this chunk must not import the maths.
    if (view.level < 1 && !view.demoLocked && view.affordable) {
      const result = session.purchase(id);
      if (!result.ok) this.ports.feedback.purchaseDenied.emit(result.reason);
      return;
    }
    const reason: PurchaseFailure = view.demoLocked ? 'demo' : view.status === 'available' ? 'insufficient' : 'locked';
    this.ports.feedback.purchaseDenied.emit(reason);
  }

  /**
   * A poke: the director decides (null: ignored, no ack, no sound). An accepted poke flashes the brackets and plays the tick; the
   * answer's sound (none for a silent answer) plays at the answer start, delayMs after the poke.
   */
  private poke(id: PokeTargetId): void {
    const d = this.ports.director();
    if (d === null) return;
    const now = this.scene.time.now;
    const answer = d.poke(id, now);
    if (answer === null) return;
    this.flashPending = true;
    this.ports.feedback.worldSound.emit({ kind: 'poke', id: 'tick' });
    if (answer.sound === null) return;
    if (answer.delayMs > 0) {
      this.pendingSound = answer.sound;
      this.pendingAt = now + answer.delayMs;
    } else {
      this.ports.feedback.worldSound.emit({ kind: 'poke', id: answer.sound });
    }
  }

  /** Plays the waiting answer sound once its answer has started. */
  private sendPendingSound(now: number): void {
    const sound = this.pendingSound;
    if (sound === null || now < this.pendingAt) return;
    this.pendingSound = null;
    this.ports.feedback.worldSound.emit({ kind: 'poke', id: sound });
  }

  /** The pointer moved over the canvas: Sensor 7 follows its world x (C11). Allocation-free (a reused vector). */
  private readonly onMove = (pointer: Phaser.Input.Pointer): void => {
    const d = this.ports.director();
    if (d === null) return;
    d.setPointer(this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, this.vec).x, this.scene.time.now);
  };

  /**
   * Reads the gates into the reused gates object: the fault marker's overlays (photo, TECH INDEX, modal, era card, cycle, teaser,
   * demo card, ending) plus the tab. Reads only; allocates nothing.
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
    g.teaserOn = this.ports.tooltipRoot.classList.contains('demo-teaser-on');
    g.demoCardOpen = ui.modals.has('demo-end');
    g.endingPhase = this.ports.session.state.ending.phase;
    g.enabled = true;
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
}
