// Splice objects in the living world (WP28a T13b1, AD2 F10): one hidden sprite per Splice object with its own art, in the row containers, and the
// clock's lit-face overlay. The payphone is an existing prop: it has no sprite here, only its placement, box and woken state. The rules (state,
// feet, boxes) are pure in src/game/math/spliceWorld.ts; cells, placements and frames are data in src/data/spliceWorld.ts. Pool only: every sprite is
// built in the constructor and moves between the two rows; no sprite is interactive (the poke layer owns input).
//
// Public API (C10; the director wires it):
//   setFraming(framing, era): places each object at its framing placement (a yard lane goes to the front row, 'back' to the back row). An object is
//     hidden when the framing has no placement (null or missing) or its Splice's era has not started. Call on every framing or era change.
//   setStates(levels, postgame, reduced, beats): levels are the tech levels (1 or more = woken). Dead frame at 0; the woken loop from 1; one static
//     woken frame when reduced; the whole frame in the postgame (the clock's lit face hides there). beats are the ids whose wake beat is queued this
//     frame: a record that turns woken with its id in beats is held (wake hold) on its dead frame, its loop and the clock's face off, until wake(id)
//     runs. A hold lasts at most SPLICE_FX.wakeBeatMs + wakeHoldSlackMs from the first update after it starts. Reduced motion, the postgame and a
//     hidden object take no hold (and drop one). The postgame portrait moves an object with a postgame placement (entry.postgame) to those feet once
//     setKeepClock flips the KEEP side (F24); until then its portrait cell holds (AD2 R2 F20).
//   wake(id, nowMs): ends the wake hold of one object (its beat ran) and restarts its woken loop at nowMs. Ids that are not placed objects are ignored.
//   isHeld(id): whether the object of id is on its wake hold (the director keeps the clock's tick until then).
//   twitch(id): a one-frame twitch of a woken own-art object (the next loop frame, or a 1 px shift); no-op for other ids, dead or held objects,
//     reduced motion and photo mode.
//   setKeepClock(keepS): the KEEP beat (F24, seconds since the KEEP click; Infinity after a boot into the postgame): the postgame-moved objects
//     leave their portrait cell and stand at their postgame feet when the side flips, and their alpha follows postgameMoveAlpha.
//   setHum(offsetPx): the era IV hum (WP28b): every woken own-art object shifts by offsetPx in x; 0 restores. Reduced motion and photo mode hold 0.
//   update(nowMs, frozen): releases holds past their deadline; advances the woken loops at each object's fps (never above SPLICE_FX.loopFpsCap);
//     a once object (the vane, the kite, the cairn) plays its frames through and holds the last; frozen holds every frame. Returns at once while no
//     object is animated.
//   boxes(out): number. Writes the visible objects into out (top-left x, y and w, h in world px, feet-anchored from bboxArt). Returns the count;
//     entries past the count are stale.
//   rows(out): number. One SpliceDebugRow per Splice id (16, TECH_IDS order); state, line and pulses come from setDebugSource (default: woken or
//     locked, no line, no pulses). The frame field is the role: dead (also while held), woken, whole or ''.
//   setDebugSource(source | null): the caller's readers for rows().
//   destroy(): destroys the sprites.
import type Phaser from 'phaser';
import type { FramingKey } from '../../data/livingWorld';
import { PIXEL_SCALE } from '../../data/world';
import { SPLICE_FX, SPLICE_SHEETS, SPLICE_WORLD } from '../../data/spliceWorld';
import type { SpliceFrames, SpliceObjectId, SplicePlacement, SpliceWorldEntry } from '../../data/spliceWorld';
import { TECHNOLOGIES } from '../../data/technologies';
import { TECH_IDS } from '../../data/types';
import type { TechId } from '../../data/types';
import { YARD_DEPTH_STEP } from '../../data/worldShared';
import { hasOwnArt, placementFeetY, postgameMoveAlpha, postgameMoveAt, spliceBoxWorld } from '../math/spliceWorld';
import type { SpliceState } from '../math/spliceWorld';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

/** The frame an object shows: dead, woken (the loop, or its first frame), whole (postgame), or '' while hidden. */
export type SpliceRole = 'dead' | 'woken' | 'whole' | '';

/** A visible object's box in world px (top-left x, y; width w, height h), for the poke and tooltip layer. */
export interface SpliceBox { id: TechId; x: number; y: number; w: number; h: number; woken: boolean; visible: boolean }

/** One Splice in the debug rows: x, y are the feet in world px (0 when not placed); frame is the role; line and pulses from the source. */
export interface SpliceDebugRow {
  id: TechId; state: SpliceState; placed: boolean; visible: boolean; x: number; y: number; frame: string; line: boolean; pulses: number;
}

/** The caller's readers for rows(): the Splice state of an id, whether its line is drawn, and its pulse count. */
export interface SpliceDebugSource {
  stateOf(id: TechId): SpliceState;
  hasLine(id: TechId): boolean;
  pulseCount(id: TechId): number;
}

// The clock's lit face and the hosted objects (the chimes, the kite, the vane, the coin flap) sit over their host prop's sprite.
const CLOCK_LIT_DEPTH = 0.005;
// setStates' default: no beats queued.
const NO_BEATS: readonly TechId[] = [];
// The sprite offset of an object without one (no hosting, no clock face).
const NO_OFFSET = { x: 0, y: 0 } as const;
// The Splice ids of TECH_IDS in table order (the debug rows).
const SPLICE_IDS: readonly TechId[] = TECH_IDS.filter((id) => id.startsWith('splice'));

// One placed object. frames is null for the payphone and the clock's lit overlay (their look is an existing prop); the overlay is the record
// with a sprite and no frames. box is the world box (top-left, size), feetX / feetY the placed feet. offset moves the sprite off its feet
// (the clock's face, a hosted object's offsetWorld); lift is the depth above the row (the hosted and lit records draw over their host).
// drawX / drawY and alpha are the last values written to the sprite.
interface ObjectRecord {
  readonly id: TechId;
  readonly entry: SpliceWorldEntry;
  readonly frames: SpliceFrames | null;
  readonly sprite: Phaser.GameObjects.Sprite | null;
  readonly offset: { readonly x: number; readonly y: number };
  readonly lift: number;
  drawX: number;
  drawY: number;
  alpha: number;
  placed: boolean;
  visible: boolean;
  woken: boolean;
  feetX: number;
  feetY: number;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  role: SpliceRole;
  cell: number;
  loopStartMs: number; // NaN: the woken loop starts at the next update
  twitch: boolean; // set by twitch(): the next update shows the loop's next frame (or shifts a one-frame loop), once
  shift: number; // the 1 px shift the sprite shows (0 or PIXEL_SCALE), so an unchanged position is not written
  pending: boolean; // the wake hold: a woken object keeps its dead frame until wake(id) (setStates queued its beat)
  holdUntilMs: number; // the release time of the hold (NaN until the first update after the hold starts)
}

function show(s: Phaser.GameObjects.Sprite, on: boolean): void {
  if (s.visible !== on) s.setVisible(on);
}

function setCell(r: ObjectRecord, s: Phaser.GameObjects.Sprite, cell: number): void {
  if (r.cell !== cell) {
    r.cell = cell;
    s.setFrame(cell);
  }
}

export class SpliceProps {
  private readonly worldRows: WorldRows;
  private readonly records: ObjectRecord[] = [];
  private postgame = false;
  private framing: FramingKey | null = null; // the last framing and era setFraming gave (a postgame flip re-places the records with them)
  private era = 0;
  private reduced = false;
  private frozen = false;
  private hum = 0; // the era IV hum offset in x (world px) of the woken own-art objects (setHum)
  private keepSide: 'portrait' | 'postgame' = 'portrait'; // the KEEP beat's side of the postgame-moved objects (setKeepClock)
  private animated = 0; // the objects with a loop that is visible, woken and not held (update() returns at once while there are none)
  private held = 0; // the objects on a wake hold (update() scans the records for their deadlines only while this is above 0)
  private source: SpliceDebugSource | null = null;

  /** Creates one hidden sprite per object with its own art, and the clock's lit overlay, in the front row (setFraming moves them). */
  constructor(scene: Phaser.Scene, rows: WorldRows) {
    this.worldRows = rows;
    for (const id of Object.keys(SPLICE_WORLD) as SpliceObjectId[]) {
      const entry = SPLICE_WORLD[id];
      if (entry === undefined) continue;
      const frames = hasOwnArt(entry) ? entry.frames : null;
      const lit = hasOwnArt(entry) ? undefined : entry.clockLit;
      const sheet = hasOwnArt(entry) ? entry.sheet : lit?.sheet;
      const cell = frames !== null ? frames.dead : (lit?.cell ?? -1);
      // The clock's face and a hosted object (offsetWorld) are offset from their feet; the other sprites stand on them.
      const offset = hasOwnArt(entry) ? entry.offsetWorld : lit?.offsetWorld;
      const sprite = sheet === undefined ? null : scene.add.sprite(0, 0, SPLICE_SHEETS[sheet].assetId, cell).setOrigin(0.5, 1).setScale(PIXEL_SCALE).setVisible(false);
      if (sprite !== null) rows.front.add(sprite);
      this.records.push({
        id, entry, frames, sprite, offset: offset ?? NO_OFFSET, lift: frames === null || offset !== undefined ? CLOCK_LIT_DEPTH : 0,
        drawX: 0, drawY: 0, alpha: 1, placed: false, visible: false, woken: false, feetX: 0, feetY: 0,
        boxX: 0, boxY: 0, boxW: 0, boxH: 0, role: '', cell, loopStartMs: NaN, twitch: false, shift: 0,
        pending: false, holdUntilMs: NaN,
      });
    }
    sortWorldRows(rows);
  }

  /** Places or hides each object for the framing and the player's era (see the header). */
  setFraming(framing: FramingKey | null, era: number): void {
    this.framing = framing;
    this.era = era;
    for (const r of this.records) this.place(r, this.placementOf(r), era);
    sortWorldRows(this.worldRows);
    this.recount();
  }

  /** Sets the frames from the tech levels, the postgame and the reduced-motion flag (see the header). */
  setStates(levels: Readonly<Partial<Record<TechId, number>>>, postgame: boolean, reduced: boolean, beats: readonly TechId[] = NO_BEATS): void {
    const flipped = postgame !== this.postgame;
    this.postgame = postgame;
    this.reduced = reduced;
    if (flipped) this.setFraming(this.framing, this.era);
    for (const r of this.records) {
      const woken = (levels[r.id] ?? 0) >= 1;
      // A hold needs a woken object with a sprite that is visible, outside reduced motion and the postgame (its beat is the only reason to hold).
      const hold = woken && !reduced && !this.postgame && r.visible && r.sprite !== null;
      if (woken !== r.woken) {
        r.woken = woken;
        r.loopStartMs = NaN;
        this.holdWake(r, hold && beats.includes(r.id));
      } else if (!hold) {
        this.holdWake(r, false);
      }
      this.paint(r);
    }
    this.recount();
  }

  /** Ends the wake hold of one object and restarts its woken loop at nowMs (the wake beat calls it, after the line's pulse). Other ids are ignored. */
  wake(id: TechId, nowMs: number): void {
    const r = this.recordOf(id);
    if (r === undefined) return;
    this.holdWake(r, false);
    r.loopStartMs = nowMs;
    this.paint(r);
    this.recount();
  }

  /** Whether the object of id is on its wake hold (no allocation: the records are scanned in place). */
  isHeld(id: TechId): boolean {
    for (const r of this.records) if (r.id === id) return r.pending;
    return false;
  }

  /** One-frame twitch of a woken own-art object (AD2 F10): the next update shows the loop's next frame, the loop's own clock keeps running (a
   * one-frame loop shifts 1 art px for that update). No-op for the clock and the payphone (no frames here), a dead or hidden object, reduced
   * motion and photo mode. */
  twitch(id: TechId): void {
    const r = this.recordOf(id);
    if (r !== undefined && r.frames !== null && r.role === 'woken' && !this.reduced && !this.frozen) r.twitch = true;
  }

  /** The KEEP IT RUNNING beat (WP28b F24; see the header). The side and the alpha come from the pure rule (postgameMoveAt, postgameMoveAlpha);
   * a flip re-places the postgame-moved records (a postgame placement only counts in the postgame portrait), and the alpha is written when it
   * changes. Allocates nothing. */
  setKeepClock(keepS: number): void {
    const side = postgameMoveAt(keepS, this.reduced);
    const alpha = postgameMoveAlpha(keepS, this.reduced);
    const flipped = side !== this.keepSide;
    this.keepSide = side;
    for (const r of this.records) {
      if (r.entry.postgame === undefined) continue;
      if (flipped) this.place(r, this.placementOf(r), this.era);
      if (r.alpha !== alpha) {
        r.alpha = alpha;
        r.sprite?.setAlpha(alpha);
      }
    }
    if (flipped) {
      sortWorldRows(this.worldRows);
      this.recount();
    }
  }

  /** The era IV hum (WP28b, D6 c IV): every woken own-art object shifts by offsetPx in x. 0 restores the feet; reduced motion and photo mode
   * hold 0 (no hum is written). Writes only when the offset changes. */
  setHum(offsetPx: number): void {
    const want = this.reduced || this.frozen || !Number.isFinite(offsetPx) ? 0 : offsetPx;
    if (want === this.hum) return;
    this.hum = want;
    for (const r of this.records) this.aim(r);
  }

  /** Advances the woken loops. Frozen (photo mode), postgame and reduced motion hold the frames; with no animated object it returns at once.
   * Allocates nothing per frame. */
  update(nowMs: number, frozen: boolean): void {
    this.frozen = frozen;
    if (this.held > 0) this.releaseHolds(nowMs);
    if (frozen || this.postgame || this.reduced || this.animated === 0) return;
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (r === undefined) continue;
      const s = r.sprite;
      const f = r.frames;
      if (s === null || f === null || !r.visible || !r.woken || r.pending || f.woken.length === 0) continue;
      if (Number.isNaN(r.loopStartMs)) r.loopStartMs = nowMs;
      const step = Math.floor((Math.max(0, nowMs - r.loopStartMs) * Math.min(f.fps, SPLICE_FX.loopFpsCap)) / 1000);
      const n = f.woken.length;
      const twitch = r.twitch;
      r.twitch = false;
      const tw = twitch ? 1 : 0;
      // A once object plays its frames through and holds the last (the vane, the kite, the cairn); a loop wraps.
      const cell = f.once === true ? f.woken[Math.min(step + tw, n - 1)] : f.woken[(step + tw) % n];
      if (cell !== undefined) setCell(r, s, cell);
      const shift = twitch && n === 1 ? PIXEL_SCALE : 0;
      if (shift !== r.shift) {
        r.shift = shift;
        this.aim(r);
      }
    }
  }

  /** Fills out with the visible objects' boxes; returns the count. Reuses the objects in out (allocates only when out grows). */
  boxes(out: SpliceBox[]): number {
    let n = 0;
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (r === undefined || !r.visible) continue;
      const box = out[n] ?? { id: r.id, x: 0, y: 0, w: 0, h: 0, woken: false, visible: true };
      out[n] = box;
      box.id = r.id;
      box.x = r.boxX;
      box.y = r.boxY;
      box.w = r.boxW;
      box.h = r.boxH;
      box.woken = r.woken;
      box.visible = true;
      n++;
    }
    return n;
  }

  /** Fills out with one row per Splice id in TECH_IDS order; returns the count (16). Reuses the rows in out. */
  rows(out: SpliceDebugRow[]): number {
    const src = this.source;
    for (let i = 0; i < SPLICE_IDS.length; i++) {
      const id = SPLICE_IDS[i];
      if (id === undefined) continue;
      const r = this.recordOf(id);
      const row: SpliceDebugRow = out[i] ?? { id, state: 'locked', placed: false, visible: false, x: 0, y: 0, frame: '', line: false, pulses: 0 };
      out[i] = row;
      row.id = id;
      row.state = src !== null ? src.stateOf(id) : r?.woken === true ? 'woken' : 'locked';
      row.placed = r?.placed === true;
      row.visible = r?.visible === true;
      row.x = r?.placed ? r.feetX : 0;
      row.y = r?.placed ? r.feetY : 0;
      row.frame = r?.visible ? r.role : '';
      row.line = src?.hasLine(id) === true;
      row.pulses = src?.pulseCount(id) ?? 0;
    }
    return SPLICE_IDS.length;
  }

  /** Sets the readers for rows(); null restores the defaults. */
  setDebugSource(source: SpliceDebugSource | null): void {
    this.source = source;
  }

  /** Destroys the sprites. The row containers are the director's. */
  destroy(): void {
    for (const r of this.records) {
      if (r.sprite?.scene) r.sprite.destroy();
    }
    this.records.length = 0;
  }

  // The record of a Splice id (undefined for a non-Splice id). Called on events and in the debug rows, never per frame.
  private recordOf(id: TechId): ObjectRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  // The placement of a record at the framing setFraming gave (null: none). The postgame portrait takes the object's postgame feet once the KEEP
  // beat has flipped its side (F24); before that the object stands on its portrait cell.
  private placementOf(r: ObjectRecord): SplicePlacement | null {
    if (this.framing === null) return null;
    if (this.postgame && this.framing === 'portrait' && this.keepSide === 'postgame' && r.entry.postgame !== undefined) return r.entry.postgame;
    return r.entry.placements[this.framing] ?? null;
  }

  // Sets the sprite's position: the feet, the offset, the twitch shift and, for a woken own-art object, the hum. Writes only a moved position.
  private aim(r: ObjectRecord): void {
    const s = r.sprite;
    if (s === null) return;
    const hum = r.frames !== null && r.woken && !r.pending && r.visible ? this.hum : 0;
    const x = r.feetX + r.offset.x + r.shift + hum;
    const y = r.feetY + r.offset.y;
    if (x === r.drawX && y === r.drawY) return;
    r.drawX = x;
    r.drawY = y;
    s.setPosition(x, y);
  }

  // Counts the animated objects (visible, woken, not held, with a loop): update() has nothing to do while there are none.
  private recount(): void {
    let n = 0;
    for (const r of this.records) if (r.visible && r.woken && !r.pending && r.frames !== null && r.frames.woken.length > 0) n++;
    this.animated = n;
  }

  // Takes (on) or ends a wake hold of one record. The hold clock starts unset (see releaseHolds); the held count keeps update() scan-free.
  private holdWake(r: ObjectRecord, on: boolean): void {
    if (r.pending === on) return;
    r.pending = on;
    r.holdUntilMs = NaN;
    this.held += on ? 1 : -1;
  }

  // Starts the clock of each new hold (the first update after it: the deadline is wakeBeatMs + wakeHoldSlackMs away) and releases the holds past
  // their deadline: a wake whose beat never ran starts the loop now, so no object waits longer than the deadline.
  private releaseHolds(nowMs: number): void {
    for (const r of this.records) {
      if (!r.pending) continue;
      if (Number.isNaN(r.holdUntilMs)) {
        r.holdUntilMs = nowMs + SPLICE_FX.wakeBeatMs + SPLICE_FX.wakeHoldSlackMs;
      } else if (nowMs >= r.holdUntilMs) {
        this.holdWake(r, false);
        r.loopStartMs = nowMs;
        this.paint(r);
        this.recount();
      }
    }
  }

  // Places one object at its placement (null hides it). The sprite moves to the row of its lane, at the lane's yard depth (0 in the
  // back row); the clock's overlay and the hosted objects add their lift (CLOCK_LIT_DEPTH). Then the frame is painted.
  private place(r: ObjectRecord, placement: SplicePlacement | null, era: number): void {
    r.placed = placement !== null;
    r.visible = placement !== null && era >= TECHNOLOGIES[r.id].era;
    if (!r.visible) this.holdWake(r, false); // a hidden object has nothing to hold
    r.feetX = placement?.x ?? 0;
    r.feetY = placement === null ? 0 : placementFeetY(placement);
    const box = placement === null ? null : spliceBoxWorld(r.entry, { x: r.feetX, y: r.feetY });
    r.boxX = box?.left ?? 0;
    r.boxY = box?.top ?? 0;
    r.boxW = box === null ? 0 : box.right - box.left;
    r.boxH = box === null ? 0 : box.bottom - box.top;
    const s = r.sprite;
    if (s !== null && placement !== null) {
      const back = placement.lane === 'back';
      const row = back ? this.worldRows.back : this.worldRows.front;
      if (s.parentContainer !== row) row.add(s);
      r.shift = 0;
      this.aim(r);
      // The front row's child depth per yard lane px (AD1 hand-off: DEPTH.machine + 3 + YARD_DEPTH_STEP x lane; the front row carries DEPTH.machine + 3).
      s.setDepth((back ? 0 : YARD_DEPTH_STEP * placement.lane) + r.lift);
    }
    this.paint(r);
  }

  // Shows the frame for the object's state. The clock's lit face shows only while woken and not held (the postgame restores the clock). A woken
  // object keeps its running loop (update moves it) unless reduced motion holds its first woken frame. A held object shows its dead frame.
  private paint(r: ObjectRecord): void {
    const prev = r.role;
    r.role = !r.visible ? '' : this.postgame ? 'whole' : r.woken && !r.pending ? 'woken' : 'dead';
    const s = r.sprite;
    const f = r.frames;
    if (s === null) return;
    if (f === null) {
      show(s, r.visible && r.woken && !r.pending && !this.postgame);
      return;
    }
    show(s, r.visible);
    if (!r.visible) return;
    this.aim(r);
    if (r.role === 'whole') setCell(r, s, f.whole);
    else if (r.role === 'dead') setCell(r, s, f.dead);
    else if (this.reduced || prev !== 'woken') setCell(r, s, f.woken[0] ?? f.dead);
  }
}
