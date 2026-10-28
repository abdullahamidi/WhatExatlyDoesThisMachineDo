// Cast extras (WP23b, WP24): the small sprites tied to the cast poses: the inspector's clipboard pages, the dog's red ball, the era V
// double-exposure flash of each host (a violet whole-self frame over its body) and the crow's ruffle drip (WP24: one drop per ruffle,
// falling from the chest). Why: they follow the same ExtraPose the cast draws, so they never drift off a host; the simulation decides what
// shows (WorldVisualState traces, the script frame). Overlay offsets come from WORLD_TRACES (art px, un-flipped), the flash hold from
// WORLD_DOUBLE_EXPOSURE, the drip from WORLD_AMBIENT.drip. Built once in the constructor; every object sits in a row container. Reduced
// motion: no flash, no drip. Rendering only: no economy state is read or written.
import type Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { PIXEL_SCALE } from '../../data/world';
import { WORLD_DEPTH_OFFSETS, WORLD_ERA_ROW, WORLD_FRAMES, WORLD_SHEET_KEYS } from '../../data/livingWorld';
import type { WorldRow, WorldSheetId } from '../../data/livingWorld';
import { WORLD_DOUBLE_EXPOSURE, WORLD_TRACES } from '../../data/worldEras';
import { WORLD_AMBIENT } from '../../data/worldDay';
import { sheetFrameIndex } from '../math/worldPlayback';
import type { WorldScriptFrame } from '../math/worldScript';
import type { WorldVisualState } from '../math/worldState';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

/** Cast members that carry extras. */
export type ExtraHostId = 'inspector' | 'dog' | 'crow' | 'girl';
/** Where a host stands this frame: feet in world px, flip mirrors x, row = the row its body sits in. visible false hides its extras. */
export interface ExtraPose { x: number; feetY: number; frame: string; flip: boolean; visible: boolean; alpha: number; row: WorldRow }

// Depth steps over the host body: the ball and a flash sit just above it, the clipboard a little higher (layout, not balance).
const LIFT = 0.05;
const CLIPBOARD_LIFT = 0.1;
// Update durations kept for stats().meanMs.
const STAT_SAMPLES = 120;
// Clipboard pivot per inspector frame (art px, un-flipped). A frame with no entry has no board (face-on or not drawn).
const CLIPBOARD_OFFSET: Readonly<Partial<Record<string, readonly [number, number]>>> = WORLD_TRACES.clipboardOffsetArt;
// Sheet, row and body depth of each host. The flash shares its host's row; the girl's body may move rows, the flash stays on the front.
const HOSTS: Record<ExtraHostId, { sheet: WorldSheetId; row: WorldRow; depth: number }> = {
  inspector: { sheet: 'inspector', row: 'back', depth: WORLD_DEPTH_OFFSETS.cast },
  dog: { sheet: 'dog', row: 'front', depth: WORLD_DEPTH_OFFSETS.cast },
  crow: { sheet: 'crow', row: 'back', depth: WORLD_DEPTH_OFFSETS.crow },
  girl: { sheet: 'girl', row: 'front', depth: WORLD_DEPTH_OFFSETS.cast },
};
const HOST_IDS: readonly ExtraHostId[] = ['inspector', 'dog', 'crow', 'girl'];
// The ruffle drip (WORLD_AMBIENT.drip): the crow frame that starts one drop, and the drop's numbers.
const RUFFLE_FRAME = 'ruffle';
const DRIP = WORLD_AMBIENT.drip;
// Every object this renderer owns: a sprite or the drip square.
type Owned = Phaser.GameObjects.Sprite | Phaser.GameObjects.Graphics;

// Clipboard frame for a page count: thin (1) .. thick (3). A count below 1 shows thin.
function pageFrame(pages: number): number {
  return Math.min(WORLD_FRAMES.clipboardPages.length, Math.max(1, pages)) - 1;
}

// Points a sprite at a frame index; it changes only when it differs (no per-frame work for a still pose).
function paintFrame(sprite: Phaser.GameObjects.Sprite, index: number): void {
  if (Number(sprite.frame.name) !== index) sprite.setFrame(index);
}

// Hides an extra only while it shows: most frames hide the idle extras, and a hidden one costs no call.
function hideIfShown(o: Owned): void {
  if (o.visible) o.setVisible(false);
}

/**
 * Clipboard, red ball and double-exposure flashes of the cast. apply() takes the visual state, update() places every extra on the host
 * poses of the frame, flash() starts a host's violet frame. A hidden host or a hidden layer hides its extras.
 */
export class CastExtras {
  private readonly scene: Phaser.Scene;
  private readonly rows: WorldRows;
  private readonly owned: Owned[] = [];
  private readonly clipboard: Phaser.GameObjects.Sprite;
  private clipboardRow: WorldRow = 'back';                  // the row container the clipboard sits in (built in back)
  private readonly ball: Phaser.GameObjects.Sprite;
  private readonly flashSprites: Record<ExtraHostId, Phaser.GameObjects.Sprite>;
  private readonly drip: Phaser.GameObjects.Graphics;       // the crow's ruffle drop: one square, moved, never redrawn
  private dripAt = Number.NEGATIVE_INFINITY;                // nowMs when the drop started; -Infinity when none is falling
  private dripX = 0;                                        // the drop's start x and y (world px)
  private dripY = 0;
  private ruffling = false;                                 // the crow showed the ruffle frame last update (the edge starts a drop)
  private readonly poses: Record<ExtraHostId, ExtraPose | null> = { inspector: null, dog: null, crow: null, girl: null };
  private readonly flashUntil: Record<ExtraHostId, number> = { inspector: -Infinity, dog: -Infinity, crow: -Infinity, girl: -Infinity };
  private readonly forced: Record<'clipboard' | 'redBall', boolean | null> = { clipboard: null, redBall: null };
  private readonly samples: number[] = [];
  private sampleAt = 0;
  private state: WorldVisualState | null = null;
  private script: WorldScriptFrame | null = null;
  private reduced = false;
  private live = false;
  private nowMs = 0;
  private flashTotal = 0;

  constructor(scene: Phaser.Scene, rows: WorldRows) {
    this.scene = scene;
    this.rows = rows;
    this.clipboard = this.spriteIn(rows.back, 'clipboardPages', WORLD_DEPTH_OFFSETS.cast + CLIPBOARD_LIFT);
    this.ball = this.spriteIn(rows.front, 'redBall', WORLD_DEPTH_OFFSETS.cast + LIFT);
    this.flashSprites = {
      inspector: this.flashIn(rows, 'inspector'), dog: this.flashIn(rows, 'dog'),
      crow: this.flashIn(rows, 'crow'), girl: this.flashIn(rows, 'girl'),
    };
    this.drip = this.dripIn(rows.back);
    sortWorldRows(rows);
    this.hideAll();
  }

  /** Takes the visual state. Reduced motion cancels the flashes; a hidden layer hides every extra. */
  apply(state: WorldVisualState, opts: { reducedMotion: boolean }): void {
    this.state = state;
    this.reduced = opts.reducedMotion;
    if (this.reduced) this.cancelFlashes();
    if (!state.visible) {
      this.hideAll();
      return;
    }
    this.live = true;
  }

  /** The finale film frame, or null. A running script cancels the flashes: none start while it plays. */
  setScript(frame: WorldScriptFrame | null): void {
    this.script = frame;
    if (frame !== null) this.cancelFlashes();
  }

  /**
   * One frame: places every extra on this frame's host poses (poseOf returns null for a hidden host). dtMs advances the clock only
   * when nowMs is not finite.
   */
  update(dtMs: number, nowMs: number, poseOf: (id: ExtraHostId) => ExtraPose | null): void {
    const t0 = performance.now();
    const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
    this.nowMs = Number.isFinite(nowMs) ? nowMs : this.nowMs + dt;
    const state = this.state;
    if (this.live && state !== null) {
      for (const id of HOST_IDS) this.poses[id] = poseOf(id);
      this.drawClipboard(state);
      this.drawBall(state);
      for (const id of HOST_IDS) this.drawFlash(id);
    }
    this.drawDrip();
    this.sample(performance.now() - t0);
  }

  /** Starts the host's violet flash (current frame, whole row) for holdMs. Refused under reduced motion, in a script, or when hidden. */
  flash(id: ExtraHostId, nowMs?: number): void {
    const pose = this.poses[id];
    if (!this.live || this.reduced || this.script !== null || pose === null || !pose.visible) return;
    const at = nowMs !== undefined && Number.isFinite(nowMs) ? nowMs : this.nowMs;
    this.flashUntil[id] = at + WORLD_DOUBLE_EXPOSURE.holdMs;
    this.flashTotal += 1;
  }

  /** Forces a clipboard or the red ball on or off; null is automatic (the cycle traces and the host poses decide). */
  overlay(id: 'clipboard' | 'redBall', o: { visible: boolean } | null): void {
    this.forced[id] = o === null ? null : o.visible;
  }

  /** Flashes started since construction. */
  flashCount(): number {
    return this.flashTotal;
  }

  /**
   * Debug probe: the clipboard (variant = page name), the red ball, each host's flash (variant = host id) and the crow's drip (variant
   * fall while a drop falls, else none). Presented x, y (rounded, 0 while hidden), alpha (0 while hidden) and visibility.
   */
  probe(): { id: string; variant: string; x: number; y: number; alpha: number; visible: boolean; speaking: boolean }[] {
    const entry = (id: string, variant: string, s: Owned) => (
      { id, variant, x: s.x, y: s.visible ? Math.round(s.y) : 0, alpha: s.visible ? s.alpha : 0, visible: s.visible, speaking: false }
    );
    return [
      entry('clipboard', WORLD_FRAMES.clipboardPages[Number(this.clipboard.frame.name)] ?? '', this.clipboard),
      entry('redBall', 'ball', this.ball),
      ...HOST_IDS.map((id) => entry('flash', id, this.flashSprites[id])),
      entry('drip', this.drip.visible ? 'fall' : 'none', this.drip),
    ];
  }

  /** Hides every extra and cancels the flashes until the next apply(). */
  hideAll(): void {
    this.live = false;
    this.cancelFlashes();
    for (const o of this.owned) o.setVisible(false);
  }

  /** Created objects, and the mean update time over the last 120 frames (ms). */
  stats(): { objects: number; meanMs: number } {
    const n = this.samples.length;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    return { objects: this.owned.length, meanMs: n === 0 ? 0 : sum / n };
  }

  /** Destroys every sprite this renderer created. Safe to call twice. */
  destroy(): void {
    for (const o of this.owned) {
      if (o.scene) o.destroy();
    }
    this.owned.length = 0;
    this.live = false;
    this.state = null;
    this.script = null;
  }

  // ---- construction (pools only; nothing is created after the constructor) ----

  private spriteIn(row: Phaser.GameObjects.Container, sheet: WorldSheetId, depth: number): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(0, 0, WORLD_SHEET_KEYS[sheet], 0)
      .setOrigin(0.5, 1)
      .setScale(PIXEL_SCALE)
      .setDepth(depth)
      .setVisible(false);
    row.add(sprite);
    this.owned.push(sprite);
    return sprite;
  }

  // A flash: the host sheet tinted violet, on the host's row just above its body, at the era V double-exposure alpha.
  private flashIn(rows: WorldRows, id: ExtraHostId): Phaser.GameObjects.Sprite {
    const host = HOSTS[id];
    return this.spriteIn(rows[host.row], host.sheet, host.depth + LIFT).setTint(PALETTE.violetLight).setAlpha(WORLD_DOUBLE_EXPOSURE.alpha);
  }

  // The drip: one square of drip.sizeArtPx in drip.paletteKey, drawn once at the origin and moved with setPosition. It sits in the crow's
  // row (rows.back), above the crow body, so the top level is unchanged.
  private dripIn(row: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
    const size = DRIP.sizeArtPx * PIXEL_SCALE;
    const drop = this.scene.add.graphics();
    drop.fillStyle(PALETTE[DRIP.paletteKey], 1).fillRect(0, 0, size, size);
    drop.setDepth(WORLD_DEPTH_OFFSETS.crow + LIFT).setVisible(false);
    row.add(drop);
    this.owned.push(drop);
    return drop;
  }

  // ---- update ----

  // Clipboard: shown with the page count (cycle traces) or forced, and only while the inspector shows a frame with a board.
  private drawClipboard(state: WorldVisualState): void {
    const sprite = this.clipboard;
    const pose = this.poses.inspector;
    // The board draws in the row of the inspector's body (the postgame pat walks him to the front row); one re-sort per move.
    if (pose !== null && pose.row !== this.clipboardRow) {
      this.clipboardRow = pose.row;
      this.rows[pose.row].add(sprite);
      sortWorldRows(this.rows);
    }
    const offset = pose !== null && pose.visible ? CLIPBOARD_OFFSET[pose.frame] : undefined;
    const wanted = this.forced.clipboard ?? (state.traces.clipboard > 0);
    if (pose === null || offset === undefined || !wanted) {
      hideIfShown(sprite);
      return;
    }
    // WHY: the offset is un-flipped art px, so a flipped host mirrors it.
    const dir = pose.flip ? -1 : 1;
    paintFrame(sprite, pageFrame(state.traces.clipboard));
    sprite.setPosition(pose.x + offset[0] * PIXEL_SCALE * dir, pose.feetY + offset[1] * PIXEL_SCALE)
      .setFlipX(pose.flip)
      .setAlpha(pose.alpha)
      .setVisible(true);
  }

  // Red ball: from cycle 2 (or the script) while the dog is visible, redBallDxWorldPx ahead of its feet on the side it faces.
  private drawBall(state: WorldVisualState): void {
    const sprite = this.ball;
    const dog = this.poses.dog;
    const wanted = this.forced.redBall ?? (state.traces.redBall || this.script?.props.redBall === true);
    if (dog === null || !dog.visible || !wanted) {
      hideIfShown(sprite);
      return;
    }
    const dir = dog.flip ? -1 : 1;
    sprite.setPosition(dog.x + WORLD_TRACES.redBallDxWorldPx * dir, dog.feetY).setAlpha(dog.alpha).setVisible(true);
  }

  // Flash: the host's current frame on the whole row (row 5), until its hold ends; the alpha follows the host fade.
  private drawFlash(id: ExtraHostId): void {
    const sprite = this.flashSprites[id];
    const pose = this.poses[id];
    if (pose === null || !pose.visible || this.nowMs >= this.flashUntil[id]) {
      hideIfShown(sprite);
      return;
    }
    paintFrame(sprite, sheetFrameIndex(HOSTS[id].sheet, pose.frame, WORLD_ERA_ROW.whole));
    sprite.setPosition(pose.x, pose.feetY).setFlipX(pose.flip).setAlpha(WORLD_DOUBLE_EXPOSURE.alpha * pose.alpha).setVisible(true);
  }

  // The crow's ruffle drip: one drop per ruffle, started on the frame edge into 'ruffle' at the chest offset (flipped with the crow), falling
  // drip.fallPx over drip.fallMs (accelerating, never upward), then hidden. Off under reduced motion, while a film runs and while the crow
  // is not shown: those cancel a falling drop. Eras before drip.fromEra (I-II) have no drop: the ruffle there is dry (AD2 F5).
  private drawDrip(): void {
    const pose = this.poses.crow;
    if (!this.live || this.reduced || this.script !== null || pose === null || !pose.visible || (this.state?.era ?? 1) < DRIP.fromEra) {
      this.ruffling = false;
      this.dripAt = Number.NEGATIVE_INFINITY;
      hideIfShown(this.drip);
      return;
    }
    const ruffle = pose.frame === RUFFLE_FRAME;
    if (ruffle && !this.ruffling) {
      const dir = pose.flip ? -1 : 1;
      this.dripX = pose.x + DRIP.offsetArt.x * PIXEL_SCALE * dir;
      this.dripY = pose.feetY + DRIP.offsetArt.y * PIXEL_SCALE;
      this.dripAt = this.nowMs;
    }
    this.ruffling = ruffle;
    const t = this.nowMs - this.dripAt;
    if (t < 0 || t >= DRIP.fallMs) {
      hideIfShown(this.drip);
      return;
    }
    const p = t / DRIP.fallMs;
    this.drip.setPosition(this.dripX, this.dripY + DRIP.fallPx * p * p).setAlpha(pose.alpha).setVisible(true);
  }

  private cancelFlashes(): void {
    for (const id of HOST_IDS) this.flashUntil[id] = Number.NEGATIVE_INFINITY;
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
