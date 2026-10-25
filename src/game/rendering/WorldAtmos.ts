// World atmosphere renderer (WP23b, eras III-V): the virga strip above the ridge, the Chladni rings in the ground dust round the machine
// base, and the inspector's rising pages (DENIZEN_ART §5, R7 T12). Why: these pieces are scenery with their own timing and no cast sprite,
// so they live here; the director forwards the visual state and the finale script (setScript) the same way as the props.
// Pools and redraws on change only: the rings are stroked when intensity or colour changes, the pages are a fixed pool, the virga is one
// tile sprite. Only the virga is a top-level display object; the rings and pages sit in the back row. Reduced motion: no pages.
// Units: world px (art px * PIXEL_SCALE). Rendering only: no economy state is read or written.
import type Phaser from 'phaser';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { CAMERA, GROUND_Y, MACHINE_ANCHOR, PIXEL_SCALE, VIEW, WORLD } from '../../data/world';
import { WORLD_DEPTH_OFFSETS, WORLD_FRAMES, WORLD_SHEET_KEYS } from '../../data/livingWorld';
import { WORLD_CHLADNI, WORLD_PAGES, WORLD_VIRGA } from '../../data/worldEras';
import { effectiveMinZoom } from '../math/camera';
import { fadeStep, layerPhase, parallaxStrip } from '../math/parallax';
import type { WorldScriptFrame } from '../math/worldScript';
import type { WorldVisualState } from '../math/worldState';
import { sortWorldRows } from './worldRows';
import type { WorldRows } from './worldRows';

type Visible = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;
// The inspector's pose (an ExtraPose): feet in world px; flip mirrors the page start and its drift (AD3d).
type Host = { x: number; feetY: number; flip: boolean };

// One pooled page: ms since its start (-1 = free), the point it started from, the frame it shows (0 flat, 1 tilt) and its mirror.
interface PageSlot { sprite: Phaser.GameObjects.Sprite; ms: number; x: number; y: number; frame: number; flip: boolean }

// Length of one chord (world px) of a dashed ring outline: drawing resolution, not tuning.
const CHORD_PX = 2;
// Update durations kept for stats().meanMs.
const STAT_SAMPLES = 120;

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
 * moves the virga fade and the pages each frame. hideAll() hides everything; destroy() frees the objects.
 */
export class WorldAtmos {
  private readonly owned: Visible[] = [];
  private readonly virga: Phaser.GameObjects.TileSprite;
  private readonly chladni: Phaser.GameObjects.Graphics;
  private readonly pages: PageSlot[] = [];
  private readonly samples: number[] = [];
  private sampleAt = 0;

  private state: WorldVisualState | null = null;
  private script: WorldScriptFrame | null = null;
  private reduced = false;
  private live = false;
  private virgaAlpha = 0;
  // The constructor builds the strip on the fall frame, so the field starts there; apply() switches it on the first era IV state (AD4 F3).
  private virgaFrame: 'fall' | 'frozen' = 'fall';
  private drawnIntensity = -1;
  private drawnViolet = false;
  private nextPageMs: number | null = null;

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

    // Chladni rings: one Graphics in the back row, below the ground props (depthOffset), drawn on change only.
    this.chladni = scene.add.graphics().setDepth(WORLD_CHLADNI.depthOffset).setVisible(false);
    rows.back.add(this.chladni);
    this.owned.push(this.chladni);

    // Pages: a fixed pool of sprites in the back row (the inspector's clipboard is in the same row).
    for (let i = 0; i < WORLD_PAGES.poolSize; i++) {
      const sprite = scene.add.sprite(0, 0, WORLD_SHEET_KEYS.page, 0)
        .setOrigin(0.5, 0.5)
        .setScale(PIXEL_SCALE)
        .setDepth(WORLD_DEPTH_OFFSETS.motes)
        .setVisible(false);
      rows.back.add(sprite);
      this.owned.push(sprite);
      this.pages.push({ sprite, ms: -1, x: 0, y: 0, frame: 0, flip: false });
    }
    sortWorldRows(rows);
  }

  /** Applies the visual state. visible false hides everything. Cheap: call on every change or every frame. */
  apply(state: WorldVisualState, opts: { reducedMotion: boolean }): void {
    this.state = state;
    this.reduced = opts.reducedMotion;
    if (!state.visible) {
      this.hideAll();
      return;
    }
    this.live = true;
    // The fall frame in era III; the frozen frame from era IV on (and while fading out in era V).
    const frame = state.props.virga === 'fall' ? 'fall' : 'frozen';
    if (frame !== this.virgaFrame) {
      this.virgaFrame = frame;
      this.virga.setFrame(WORLD_VIRGA.frames[frame]);
    }
    this.paintChladni(state.props.chladni, state.props.chladniViolet);
  }

  /** The finale script frame (null restores the state drawing): scales the virga and the rings, and stops the pages. */
  setScript(frame: WorldScriptFrame | null): void {
    if (frame === null && this.script === null) return; // cleared every frame outside the ending: nothing to undo
    this.script = frame;
    this.paintChladniAlpha();
  }

  /** Advances the virga fade and the pages. host is the inspector's pose (x, feet, flip); null (not shown) stops the pages. */
  update(dtMs: number, nowMs: number, host: Host | null): void {
    const started = performance.now();
    const state = this.state;
    if (this.live && state !== null) {
      const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
      this.stepVirga(state, dt);
      this.stepPages(state, dt, nowMs, host);
    }
    this.sample(performance.now() - started);
  }

  /** Debug view: one entry for the virga, one for the rings and one per page of the pool. x is the world x of a shown object (0 hidden). */
  probe(): { id: string; variant: string; x: number; visible: boolean; speaking: boolean }[] {
    const on = this.live;
    const state = this.state;
    const rings = state === null ? 0 : WORLD_CHLADNI.ringsByIntensity[state.props.chladni];
    const violet = state !== null && state.props.chladniViolet;
    const virgaShown = on && this.virga.visible;
    const ringsShown = on && this.chladni.visible;
    const drawnFrame = String((this.virga as unknown as { displayFrame: { name: string | number } }).displayFrame.name) === String(WORLD_VIRGA.frames.fall) ? 'fall' : 'frozen';
    const out = [
      { id: 'virga', variant: drawnFrame, x: virgaShown ? this.virga.x : 0, visible: virgaShown, speaking: false },
      { id: 'chladni', variant: `rings-${rings}${violet ? '-violet' : ''}`, x: ringsShown ? MACHINE_ANCHOR.x : 0, visible: ringsShown, speaking: false },
    ];
    for (const p of this.pages) {
      const shown = on && p.ms >= 0;
      out.push({ id: 'page', variant: shown ? WORLD_FRAMES.page[p.frame] ?? '' : '', x: shown ? p.sprite.x : 0, visible: shown, speaking: false });
    }
    return out;
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
    this.chladni.setVisible(false);
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

  // Virga alpha eases toward its target over fadeMs: fall or frozen = WORLD_VIRGA.alpha, off or fade = 0; the script scales it.
  private stepVirga(state: WorldVisualState, dt: number): void {
    const on = state.props.virga === 'fall' || state.props.virga === 'frozen';
    const target = (on ? WORLD_VIRGA.alpha : 0) * (this.script?.props.virgaAlpha ?? 1);
    this.virgaAlpha = fadeStep(this.virgaAlpha, target, dt, WORLD_VIRGA.fadeMs);
    this.virga.setAlpha(this.virgaAlpha).setVisible(this.virgaAlpha > 0);
  }

  // One page starts every everyMs at the host while the pages show (era IV on, not reduced motion, no finale script, host shown).
  // Any other case stops the pages: the ones in flight are hidden and the timer restarts when they come back.
  private stepPages(state: WorldVisualState, dt: number, nowMs: number, host: Host | null): void {
    if (!state.props.pages || this.reduced || this.script !== null || host === null) {
      this.stopPages();
      return;
    }
    if (Number.isFinite(nowMs)) {
      if (this.nextPageMs === null) {
        this.nextPageMs = nowMs + WORLD_PAGES.everyMs;
      } else if (nowMs >= this.nextPageMs) {
        this.startPage(host);
        this.nextPageMs = nowMs + WORLD_PAGES.everyMs;
      }
    }
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
    p.sprite
      .setPosition(p.x + WORLD_PAGES.driftWorldPx * mirror * Math.sin(Math.PI * k), p.y - WORLD_PAGES.riseWorldPx * k)
      .setAlpha(Math.min(1, (1 - k) / WORLD_PAGES.fadeTail));
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
    p.sprite.setVisible(false);
  }

  private stopPages(): void {
    this.nextPageMs = null;
    for (const p of this.pages) this.freePage(p);
  }

  // Redraws the rings only when the intensity or the colour changed; the visibility and the script alpha follow every call.
  private paintChladni(intensity: 0 | 1 | 2, violet: boolean): void {
    if (intensity !== this.drawnIntensity || violet !== this.drawnViolet) {
      this.drawnIntensity = intensity;
      this.drawnViolet = violet;
      this.drawRings(intensity, violet);
    }
    this.chladni.setVisible(intensity > 0);
    this.paintChladniAlpha();
  }

  // Object alpha of the rings: WORLD_CHLADNI.alpha times the finale script's chladniAlpha (1 without a script).
  private paintChladniAlpha(): void {
    this.chladni.setAlpha(WORLD_CHLADNI.alpha * (this.script?.props.chladniAlpha ?? 1));
  }

  // The first ringsByIntensity[intensity] rings, centred on the machine at the ground dust line, in sand or violet. Only the near
  // half-arcs (y at or below GROUND_Y) are drawn: the far half would paint over the sky and the skyline (AD3d H1).
  private drawRings(intensity: 0 | 1 | 2, violet: boolean): void {
    const g = this.chladni;
    g.clear();
    g.lineStyle(PIXEL_SCALE, violet ? WORLD_CHLADNI.violetColor : WORLD_CHLADNI.color, 1);
    const cy = GROUND_Y + WORLD_CHLADNI.centerYOffsetPx;
    for (const r of WORLD_CHLADNI.rings.slice(0, WORLD_CHLADNI.ringsByIntensity[intensity])) {
      strokeDashedEllipse(g, MACHINE_ANCHOR.x, cy, r.rx, r.ry, WORLD_CHLADNI.dashPx, WORLD_CHLADNI.gapPx, GROUND_Y);
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
