// World atmosphere renderer (WP23b, eras III-V; WP24 T7b): the virga strip above the ridge, the Chladni rings in the ground dust round the
// machine base, and the inspector's rising pages (DENIZEN_ART §5, R7 T12). Why: these pieces are scenery with their own timing and no cast
// sprite, so they live here; the director forwards the transition tween, the ambient values and the finale script (setScript) the same way
// as the props. Every presented value comes from the tween (the queue's fades and ramps) and the ambient (the weather and the micro counts),
// so nothing here changes in one frame. Pools and redraws on change only: the five rings share one sand and one violet Graphics, re-stroked
// only when a ring's alpha moved by REDRAW_EPS, the pages are a fixed pool, the virga is one tile sprite. Only the virga is a top-level
// display object; the rings and pages sit in the back row.
// Reduced motion: no pages and no virga scroll; the fades and the ring breathe still move. Units: world px (art px * PIXEL_SCALE).
// Rendering only: no economy state is read or written.
import type Phaser from 'phaser';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { CAMERA, GROUND_Y, MACHINE_ANCHOR, PIXEL_SCALE, VIEW, WORLD } from '../../data/world';
import { WORLD_DEPTH_OFFSETS, WORLD_FRAMES, WORLD_SHEET_KEYS } from '../../data/livingWorld';
import { WORLD_AMBIENT } from '../../data/worldDay';
import { WORLD_CHLADNI, WORLD_PAGES, WORLD_VIRGA } from '../../data/worldEras';
import { effectiveMinZoom } from '../math/camera';
import { layerPhase, parallaxStrip } from '../math/parallax';
import type { Ambient } from '../math/worldDay';
import type { WorldScriptFrame } from '../math/worldScript';
import type { WorldVisualState } from '../math/worldState';
import type { WorldTween } from '../math/worldTransitions';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

type Visible = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;
// A shown object with alpha: the setAlphaIf writes compare against it.
type Faded = Visible & { alpha: number; setAlpha(value?: number): unknown };
// The inspector's pose (an ExtraPose): feet in world px; flip mirrors the page start and its drift (AD3d).
type Host = { x: number; feetY: number; flip: boolean };
// One row of rows() (the debug props shape; each renderer declares its own copy).
interface AtmosPropRow { id: string; frame: string; alpha: number; x: number; y: number }

// One pooled page: ms since its start (-1 = free), the point it started from, the frame it shows (0 flat, 1 tilt) and its mirror.
interface PageSlot { sprite: Phaser.GameObjects.Sprite; ms: number; x: number; y: number; frame: number; flip: boolean; row: AtmosPropRow }

// One ring: its ellipse (world px) and its alpha in each colour (the layers stroke them). The breathe clock: the half-cycle index k, ms
// into it and its hashed length; stream keys the hash by the ring's own radius, so no seed of another stream is reused.
interface RingSlot {
  rx: number;
  ry: number;
  stream: number;
  k: number;
  ms: number;
  len: number;
  sandAlpha: number;
  violetAlpha: number;
  row: AtmosPropRow;
}

// One colour's shared Graphics: every ring of the colour is stroked into it. drawn[i] is the alpha ring i was last stroked at (0 = not
// stroked); the layer is re-stroked when a ring moved from its drawn alpha or crossed EPS.
interface RingLayer {
  g: Phaser.GameObjects.Graphics;
  colour: number;
  violet: boolean;
  drawn: number[];
}

// Length of one chord (world px) of a dashed ring outline: drawing resolution, not tuning.
const CHORD_PX = 2;
// Update durations kept for stats().meanMs.
const STAT_SAMPLES = 120;
// Render epsilon: an alpha or a speed below this reads as off (hidden, frozen). A drawing threshold, not tuning.
const EPS = 0.01;
// Redraw epsilon: a ring's alpha must move this far from its last stroke before its layer is re-stroked. A drawing threshold, not tuning.
const REDRAW_EPS = 0.02;

// Sine hash of two numbers in [0, 1): deterministic, no random source (as worldDay.ts).
function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}

// Length of breathe half-cycle k of a ring, hashed inside chladniBreathe.halfMs.
function breatheHalfMs(stream: number, k: number): number {
  const [lo, hi] = WORLD_AMBIENT.chladniBreathe.halfMs;
  return lo + (hi - lo) * hash01(stream, k + 1);
}

// Moves a ring's breathe clock by dt ms across its hashed half-cycles. A zero-length half stops the clock (no endless loop).
function advanceBreathe(slot: RingSlot, dt: number): void {
  let left = dt;
  while (left > 0) {
    const room = slot.len - slot.ms;
    if (!(room > 0) || left < room) {
      slot.ms += left;
      return;
    }
    left -= room;
    slot.k += 1;
    slot.ms = 0;
    slot.len = breatheHalfMs(slot.stream, slot.k);
  }
}

// Alpha of the breathe at the clock: each half-cycle eases from one end of the alpha range to the other (up on even halves, down on odd).
function breatheAlpha(slot: RingSlot): number {
  const [lo, hi] = WORLD_AMBIENT.chladniBreathe.alpha;
  const f = slot.len > 0 ? slot.ms / slot.len : 0;
  const ease = (1 - Math.cos(Math.PI * f)) / 2;
  return slot.k % 2 === 0 ? lo + (hi - lo) * ease : hi - (hi - lo) * ease;
}

// Wraps a tile offset into [0, period) (a tile offset is in art px).
function wrapOffset(v: number, period: number): number {
  return ((v % period) + period) % period;
}

// Writes that skip an unchanged value (a Phaser setter costs a call even when it sets the same value). Alpha is compared clamped, as Phaser
// stores it.
function setAlphaIf(s: Faded, alpha: number): void {
  const a = clamp01(alpha);
  if (s.alpha !== a) s.setAlpha(a);
}

function setVisibleIf(s: Visible, on: boolean): void {
  if (s.visible !== on) s.setVisible(on);
}

function setPositionIf(s: Phaser.GameObjects.Sprite, x: number, y: number): void {
  if (s.x !== x || s.y !== y) s.setPosition(x, y);
}

// Clamps a value into [0, 1] (the alpha Phaser stores for any alpha written).
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Point of an ellipse at parameter t (radians).
function ellipsePoint(cx: number, cy: number, rx: number, ry: number, t: number): { x: number; y: number } {
  return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
}

// Strokes an ellipse as dashes along its arc. Graphics has no dashed stroke, so the outline is walked in chords of CHORD_PX and the pen
// is down while the arc length mod (dash + gap) lies inside the dash; the dash and gap are world px along the outline. A chord whose
// smaller y is above minY (the far half, AD3d H1) keeps the pen up, but the arc length still counts so the dash phase does not jump.
function strokeDashedEllipse(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, dashPx: number,
  gapPx: number, minY: number): void {
  const period = dashPx + gapPx;
  // Ramanujan's perimeter sets the chord count (exact enough for the dash spacing).
  const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.ceil(perimeter / CHORD_PX);
  let s = 0;
  let prev = ellipsePoint(cx, cy, rx, ry, 0);
  let pen = false;
  for (let i = 1; i <= n; i++) {
    const p = ellipsePoint(cx, cy, rx, ry, (2 * Math.PI * i) / n);
    const on = s % period < dashPx && Math.min(prev.y, p.y) >= minY;
    if (on && !pen) {
      g.beginPath();
      g.moveTo(prev.x, prev.y);
    }
    if (on) g.lineTo(p.x, p.y);
    if (!on && pen) g.strokePath();
    pen = on;
    s += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  if (pen) g.strokePath();
}

/**
 * Virga strip, Chladni rings and rising pages of eras III-V. apply() takes the visual state, setScript() the finale script frame, update()
 * moves the virga, the rings and the pages each frame from the tween and the ambient. hideAll() hides everything; destroy() frees the objects.
 */
export class WorldAtmos {
  private readonly owned: Visible[] = [];
  private readonly virga: Phaser.GameObjects.TileSprite;
  private readonly virgaTileW: number;
  private readonly virgaTileH: number;
  private readonly virgaRow: AtmosPropRow;
  private readonly rings: RingSlot[];
  private readonly sandLayer: RingLayer;
  private readonly violetLayer: RingLayer;
  private readonly pages: PageSlot[] = [];
  private readonly rowList: readonly AtmosPropRow[];
  private readonly samples: number[] = [];
  private sampleAt = 0;

  private state: WorldVisualState | null = null;
  private script: WorldScriptFrame | null = null;
  private reduced = false;
  private live = false;
  private virgaAlpha = 0;
  // The virga frame follows the speed: the falling frame until the streaks have settled in era IV (AD4 F3).
  private virgaFrame: 'fall' | 'frozen' = 'fall';
  // The last micro page count seen (null before the first update: the first count only sets the baseline).
  private pageSeen: number | null = null;

  constructor(scene: Phaser.Scene, rows: WorldRows) {
    // Virga: one tile sprite built like the ParallaxBackground strips (same scroll factor, phase and bottom); the art height is one frame.
    const art = ASSET_MANIFEST[WORLD_VIRGA.assetId];
    const phase = layerPhase(WORLD_VIRGA.scrollFactor, art.width, PIXEL_SCALE);
    const strip = parallaxStrip({
      scrollFactor: WORLD_VIRGA.scrollFactor,
      bottomY: WORLD_VIRGA.bottomY,
      artHeight: art.frame?.height ?? art.height,
      scale: PIXEL_SCALE,
      world: WORLD,
      view: VIEW,
      focus: CAMERA.focus,
      minZoom: effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom),
      phaseShiftPx: phase.phaseShiftPx,
      periodPx: phase.periodPx,
    });
    this.virga = scene.add.tileSprite(strip.left, strip.bottom, strip.width, strip.height, WORLD_VIRGA.assetId, WORLD_VIRGA.frames.fall)
      .setOrigin(0, 1)
      .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
      .setScrollFactor(WORLD_VIRGA.scrollFactor)
      .setDepth(WORLD_VIRGA.depth)
      .setAlpha(0)
      .setVisible(false);
    this.owned.push(this.virga);
    // The tile offsets wrap at one frame (art px): the strip is 512 wide, two frames stacked.
    this.virgaTileW = art.frame?.width ?? art.width;
    this.virgaTileH = art.frame?.height ?? art.height;
    this.virgaRow = { id: 'virga', frame: this.virgaFrame, alpha: 0, x: 0, y: 0 };

    // Chladni rings: one sand and one violet Graphics for all five rings, in the back row below the ground props (depthOffset). They are
    // re-stroked only when a ring's alpha moved (stepRings); between strokes only the visibility follows the alpha.
    const rings: RingSlot[] = [];
    for (const r of WORLD_CHLADNI.rings) {
      const stream = r.rx;
      // The phase offset: each ring starts part-way through its first half-cycle, drawn by hash.
      const len = breatheHalfMs(stream, 0);
      rings.push({ rx: r.rx, ry: r.ry, stream, k: 0, ms: len * hash01(stream, 0), len, sandAlpha: 0, violetAlpha: 0,
        row: { id: `ring${rings.length}`, frame: 'sand', alpha: 0, x: 0, y: 0 } });
    }
    this.rings = rings;
    this.sandLayer = this.addRingLayer(scene, rows, WORLD_CHLADNI.color, false);
    this.violetLayer = this.addRingLayer(scene, rows, WORLD_CHLADNI.violetColor, true);

    // Pages: a fixed pool of sprites in the back row (the inspector's clipboard is in the same row).
    for (let i = 0; i < WORLD_PAGES.poolSize; i++) {
      const sprite = scene.add.sprite(0, 0, WORLD_SHEET_KEYS.page, 0)
        .setOrigin(0.5, 0.5)
        .setScale(PIXEL_SCALE)
        .setDepth(WORLD_DEPTH_OFFSETS.motes)
        .setVisible(false);
      rows.back.add(sprite);
      this.owned.push(sprite);
      this.pages.push({ sprite, ms: -1, x: 0, y: 0, frame: 0, flip: false, row: { id: `page${i}`, frame: 'flat', alpha: 0, x: 0, y: 0 } });
    }
    sortWorldRows(rows);
    this.rowList = [this.virgaRow, ...rings.map((r) => r.row), ...this.pages.map((p) => p.row)];
  }

  /** Applies the visual state and the reduced flag. visible false hides everything. Cheap: call on every change or every frame. */
  apply(state: WorldVisualState, opts: { reducedMotion: boolean }): void {
    this.state = state;
    this.reduced = opts.reducedMotion;
    if (!state.visible) {
      this.hideAll();
      return;
    }
    this.live = true;
  }

  /** The finale script frame (null restores the state drawing): scales the virga and the rings, and stops the pages. */
  setScript(frame: WorldScriptFrame | null): void {
    if (frame === null && this.script === null) return; // cleared every frame outside the ending: nothing to undo
    this.script = frame;
  }

  /**
   * Advances the virga, the rings and the pages. tween and ambient are the presented values of the frame. host is the inspector's pose
   * (x, feet, flip); null (not shown) stops the pages. A page starts on each step of ambient.micro.pageStarts. nowMs is kept for the
   * shared renderer signature: every clock here runs on dtMs.
   */
  update(dtMs: number, _nowMs: number, host: Host | null, tween: WorldTween, ambient: Ambient): void {
    const started = performance.now();
    const state = this.state;
    const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
    // The pages count from the micro count; the first count seen only sets the baseline, so a mount starts none.
    const starts = ambient.micro.pageStarts;
    const fire = this.pageSeen !== null && starts > this.pageSeen;
    this.pageSeen = starts;
    if (this.live && state !== null) {
      this.stepVirga(state, dt, tween, ambient);
      this.stepRings(dt, tween);
      this.stepPages(state, dt, host, fire);
    }
    this.sample(performance.now() - started);
  }

  /**
   * Debug view: one entry for the virga, one for the rings and one per page of the pool. x and y are the world position of a shown ground
   * object (0 hidden; the virga is a far plane, so its y is 0); alpha is the presented alpha (0 hidden).
   */
  probe(): { id: string; variant: string; x: number; y: number; alpha: number; visible: boolean; speaking: boolean }[] {
    const on = this.live;
    const state = this.state;
    const rings = state === null ? 0 : WORLD_CHLADNI.ringsByIntensity[state.props.chladni];
    const violet = state !== null && state.props.chladniViolet;
    const virgaShown = on && this.virga.visible;
    const drawnFrame = String((this.virga as unknown as { displayFrame: { name: string | number } }).displayFrame.name) === String(WORLD_VIRGA.frames.fall) ? 'fall' : 'frozen';
    let ringAlpha = 0;
    for (const ring of this.rings) {
      ringAlpha = Math.max(ringAlpha, ring.sandAlpha + ring.violetAlpha);
    }
    const ringsShown = on && (this.sandLayer.g.visible || this.violetLayer.g.visible);
    const ringY = GROUND_Y + WORLD_CHLADNI.centerYOffsetPx;
    const out = [
      { id: 'virga', variant: drawnFrame, x: virgaShown ? this.virga.x : 0, y: 0, alpha: virgaShown ? this.virgaAlpha : 0, visible: virgaShown, speaking: false },
      { id: 'chladni', variant: `rings-${rings}${violet ? '-violet' : ''}`, x: ringsShown ? MACHINE_ANCHOR.x : 0, y: ringsShown ? ringY : 0,
        alpha: ringsShown ? ringAlpha : 0, visible: ringsShown, speaking: false },
    ];
    for (const p of this.pages) {
      const shown = on && p.ms >= 0;
      out.push({ id: 'page', variant: shown ? WORLD_FRAMES.page[p.frame] ?? '' : '', x: shown ? p.sprite.x : 0, y: shown ? p.sprite.y : 0,
        alpha: shown ? p.sprite.alpha : 0, visible: shown, speaking: false });
    }
    return out;
  }

  /**
   * Debug rows: the virga, the five rings and the pages of the pool (id, frame, presented alpha, and the rounded world x / y of the pages).
   * The array and its rows are reused: no allocation per call.
   */
  rows(): readonly AtmosPropRow[] {
    const on = this.live;
    this.virgaRow.frame = this.virgaFrame;
    this.virgaRow.alpha = on ? this.virgaAlpha : 0;
    for (const ring of this.rings) {
      ring.row.frame = ring.violetAlpha > ring.sandAlpha ? 'violet' : 'sand';
      ring.row.alpha = on ? ring.sandAlpha + ring.violetAlpha : 0;
    }
    for (const p of this.pages) {
      const shown = on && p.ms >= 0;
      p.row.frame = WORLD_FRAMES.page[p.frame] ?? '';
      p.row.alpha = shown ? p.sprite.alpha : 0;
      p.row.x = shown ? Math.round(p.sprite.x) : 0;
      p.row.y = shown ? Math.round(p.sprite.y) : 0;
    }
    return this.rowList;
  }

  /** Object count of this renderer and the mean update time in ms over the last 120 updates. */
  stats(): { objects: number; meanMs: number } {
    const n = this.samples.length;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    return { objects: this.owned.length, meanMs: n === 0 ? 0 : sum / n };
  }

  /** Hides every object and stops the pages. apply() with a visible state shows them again. */
  hideAll(): void {
    this.live = false;
    this.virga.setVisible(false);
    this.sandLayer.g.setVisible(false);
    this.violetLayer.g.setVisible(false);
    this.stopPages();
  }

  /** Destroys every object; safe to call twice. */
  destroy(): void {
    for (const o of this.owned) {
      if (o.scene) o.destroy(); // a row child is destroyed with its container's list entry
    }
    this.owned.length = 0;
    this.pages.length = 0;
    this.live = false;
    this.state = null;
    this.script = null;
  }

  // Virga: alpha = the queue's fade x the weather's alpha x the finale script's factor. Speed (world px/s) = the queue's speed x the weather's
  // speed x scrollPxPerS; the frame is the frozen one once the era IV freeze has settled. Tile offsets are art px (the tile scale is
  // PIXEL_SCALE, and the texture moves up when its offset grows), so the streaks scroll down by decreasing tilePositionY and lean right by
  // decreasing tilePositionX (a tile sprite cannot shear: the wind's lean is a sideways drift). Reduced motion: no scroll, the fades follow.
  private stepVirga(state: WorldVisualState, dt: number, tween: WorldTween, ambient: Ambient): void {
    const alpha = tween.virga.alpha * ambient.virgaAlpha * (this.script?.props.virgaAlpha ?? 1);
    const speed = WORLD_AMBIENT.virga.scrollPxPerS * tween.virga.speed * ambient.virgaSpeed;
    this.virgaAlpha = alpha;
    setAlphaIf(this.virga, alpha);
    setVisibleIf(this.virga, alpha > EPS);
    const frame: 'fall' | 'frozen' = state.props.virga === 'frozen' && speed < EPS ? 'frozen' : 'fall';
    if (frame !== this.virgaFrame) {
      this.virgaFrame = frame;
      this.virga.setFrame(WORLD_VIRGA.frames[frame]);
    }
    if (this.reduced) return;
    const step = speed * dt / 1000 / PIXEL_SCALE;
    // No step (dt 0, or no speed): the offsets hold, so no wrap runs (a wrap of a fraction drifts by rounding, and a frozen virga must not).
    if (step === 0) return;
    const y = wrapOffset(this.virga.tilePositionY - step, this.virgaTileH);
    const x = wrapOffset(this.virga.tilePositionX - step * ambient.wind * WORLD_AMBIENT.virga.skewPerWind, this.virgaTileW);
    if (this.virga.tilePositionY !== y) this.virga.tilePositionY = y;
    if (this.virga.tilePositionX !== x) this.virga.tilePositionX = x;
  }

  // Rings: each ring's value (the queue's ring alpha x the era V breathe x the finale script's factor) splits into sand and violet by the
  // colour blend. The breathe clock runs on every live frame; in era V (violet) it mixes in, so the ring starts breathing without a jump.
  private stepRings(dt: number, tween: WorldTween): void {
    const scale = WORLD_CHLADNI.alpha * (this.script?.props.chladniAlpha ?? 1);
    const v = tween.chladniViolet;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (ring === undefined) continue;
      advanceBreathe(ring, dt);
      // Off the violet colour (v 0) the breathe does not enter: 1 + (x - 1) * 0 is exactly 1, so its cosine is skipped.
      const breathe = v === 0 ? 1 : 1 + (breatheAlpha(ring) - 1) * v;
      const base = (tween.chladni[i] ?? 0) * breathe * scale;
      ring.sandAlpha = base * (1 - v);
      ring.violetAlpha = base * v;
    }
    this.stepRingLayer(this.sandLayer);
    this.stepRingLayer(this.violetLayer);
  }

  // A layer is visible while any of its rings is on (alpha > EPS). It is re-stroked only when a ring moved by REDRAW_EPS from its drawn
  // alpha, or a ring crossed EPS (on or off: a ring that went off must be cleared, else it would stay stroked at its last alpha). Most
  // frames move no ring by that much, so they cost a loop and a visibility write.
  private stepRingLayer(layer: RingLayer): void {
    let anyOn = false;
    let redraw = false;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (ring === undefined) continue;
      const a = layer.violet ? ring.violetAlpha : ring.sandAlpha;
      const on = a > EPS;
      const drawn = layer.drawn[i] ?? 0;
      if (on) anyOn = true;
      if (on !== (drawn > 0) || (on && Math.abs(a - drawn) >= REDRAW_EPS)) redraw = true;
    }
    setVisibleIf(layer.g, anyOn);
    if (redraw) this.strokeRingLayer(layer);
  }

  // Pages: one starts per micro step while the pages show (era IV on, not reduced motion, no finale script, host shown). Any other case
  // stops the pages: the ones in flight are hidden, and a step that came meanwhile is dropped (no backlog).
  private stepPages(state: WorldVisualState, dt: number, host: Host | null, fire: boolean): void {
    if (!state.props.pages || this.reduced || this.script !== null || host === null) {
      this.stopPages();
      return;
    }
    if (fire) this.startPage(host);
    for (const p of this.pages) {
      if (p.ms >= 0) this.stepPage(p, dt);
    }
  }

  // Rise, drift and fade of one page: it rises riseWorldPx over riseMs, drifts driftWorldPx (out and back), tilts at halfway and fades
  // over the last WORLD_PAGES.fadeTail of the rise. A flipped page (the inspector mirrored) drifts the other way.
  private stepPage(p: PageSlot, dt: number): void {
    p.ms += dt;
    if (p.ms >= WORLD_PAGES.riseMs) {
      this.freePage(p);
      return;
    }
    const k = p.ms / WORLD_PAGES.riseMs;
    const frame = k < 0.5 ? 0 : 1;
    if (frame !== p.frame) {
      p.frame = frame;
      p.sprite.setFrame(frame);
    }
    const mirror = p.flip ? -1 : 1;
    setPositionIf(p.sprite, p.x + WORLD_PAGES.driftWorldPx * mirror * Math.sin(Math.PI * k), p.y - WORLD_PAGES.riseWorldPx * k);
    setAlphaIf(p.sprite, Math.min(1, (1 - k) / WORLD_PAGES.fadeTail));
  }

  // Starts a page from the pool's first free slot (none free: the start is skipped).
  private startPage(host: Host): void {
    const p = this.pages.find((slot) => slot.ms < 0);
    if (p === undefined) return;
    const off = WORLD_PAGES.startOffsetWorldPx;
    p.ms = 0;
    p.flip = host.flip;
    p.x = host.x + (host.flip ? -off.x : off.x);
    p.y = host.feetY + off.y;
    p.frame = 0;
    p.sprite.setFrame(0).setPosition(p.x, p.y).setAlpha(1).setFlipX(host.flip).setVisible(true);
  }

  private freePage(p: PageSlot): void {
    p.ms = -1;
    setVisibleIf(p.sprite, false);
  }

  private stopPages(): void {
    for (const p of this.pages) this.freePage(p);
  }

  // One colour's Graphics in the back row (below the ground props). It starts empty and hidden; stepRingLayer strokes it.
  private addRingLayer(scene: Phaser.Scene, rows: WorldRows, colour: number, violet: boolean): RingLayer {
    const g = scene.add.graphics().setDepth(WORLD_CHLADNI.depthOffset).setVisible(false);
    rows.back.add(g);
    this.owned.push(g);
    return { g, colour, violet, drawn: this.rings.map(() => 0) };
  }

  // Clears the layer and strokes every ring that is on, each at its own alpha (lineStyle carries it; the Graphics stays at alpha 1). The
  // dashed ellipse is the near half-arcs of the ring on the machine's ground dust line (the far half would paint over the sky, AD3d H1).
  private strokeRingLayer(layer: RingLayer): void {
    const g = layer.g;
    g.clear();
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (ring === undefined) continue;
      const a = layer.violet ? ring.violetAlpha : ring.sandAlpha;
      const on = a > EPS;
      layer.drawn[i] = on ? a : 0;
      if (!on) continue;
      g.lineStyle(PIXEL_SCALE, layer.colour, a);
      strokeDashedEllipse(g, MACHINE_ANCHOR.x, GROUND_Y + WORLD_CHLADNI.centerYOffsetPx, ring.rx, ring.ry, WORLD_CHLADNI.dashPx,
        WORLD_CHLADNI.gapPx, GROUND_Y);
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
