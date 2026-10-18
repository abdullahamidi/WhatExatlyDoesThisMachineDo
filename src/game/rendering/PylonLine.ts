import Phaser from 'phaser';
import { PARALLAX_LAYERS, PARALLAX_FADE_MS, PYLON_LINE, VIEW, WORLD, CAMERA, PIXEL_SCALE, DEPTH } from '../../data/world';
import type { ParallaxLayerDef } from '../../data/world';
import { MACHINE_COMPONENTS, MACHINE_LINK_STYLE } from '../../data/machineComponents';
import type { Vec2 } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { minZoomToFit } from '../math/camera';
import { parallaxStrip, isLayerVisible, fadeStep } from '../math/parallax';
import { machineLocalToWorld } from '../math/machineLayout';
import { resolveConnectionPoint } from '../math/machineLinks';
import { cableParabola, nearestPylonAnchor, pylonAnchorPoint } from '../math/pylonLine';
import type { PylonAnchorInput, PylonAnchorRef } from '../math/pylonLine';

/** Polyline steps of the cable; a rendering resolution, not a balancing value. */
const CABLE_SEGMENTS = 24;

/** Where the lit pylons strip sits in parallax space, as ParallaxBackground draws it. */
interface PylonStrip {
  def: ParallaxLayerDef;
  stripLeftX: number;
  bottomObjY: number;
  tilePx: number;
  tileHeightPx: number;
}

/** Everything needed to draw the cable; null in the class when the layer or the mast point is missing. */
interface ActivePylonLine {
  strip: PylonStrip;
  mast: Vec2;
}

function pylonStrip(def: ParallaxLayerDef): PylonStrip {
  const entry = ASSET_MANIFEST[def.assetId];
  const geometry = parallaxStrip({
    scrollFactor: def.scrollFactor,
    bottomY: def.bottomY,
    artHeight: entry.height,
    scale: PIXEL_SCALE,
    world: WORLD,
    view: VIEW,
    focus: CAMERA.focus,
    minZoom: minZoomToFit(VIEW, WORLD),
  });
  return {
    def,
    stripLeftX: geometry.left,
    bottomObjY: geometry.bottom,
    tilePx: entry.width,
    tileHeightPx: entry.height,
  };
}

// Thin cyan cable from the cable mast top to the lit pylon insulator it is pinned to (CR7).
// It lives in world space, outside the machine texture: its far end moves with the pylons layer parallax,
// its near end moves with the machine. Visibility and fade follow the pylonsLit layer, and the fade-in
// waits until the cable mast has finished assembling. The anchor is chosen once on first light and kept.
export class PylonLine {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly active: ActivePylonLine | null;
  private readonly mastAssembling: () => boolean;
  private fade: number;
  private lastKey: string | null = null;
  private pinned: PylonAnchorRef | null = null; // chosen on first light; cleared once the layer hides

  constructor(
    scene: Phaser.Scene,
    techLevels: Readonly<Record<TechId, number>>,
    mastAssembling: () => boolean = () => false,
  ) {
    const def = PARALLAX_LAYERS.find((layer) => layer.id === 'pylonsLit');
    const top = resolveConnectionPoint(MACHINE_COMPONENTS.cableMast, 'top');
    this.graphics = scene.add
      .graphics()
      .setScrollFactor(1)
      .setDepth((def?.depth ?? DEPTH.background) + PYLON_LINE.depthOffset);
    this.active = def !== undefined && top !== null ? { strip: pylonStrip(def), mast: machineLocalToWorld(top) } : null;
    this.mastAssembling = mastAssembling;
    // Already lit at load: no fade-in.
    this.fade = def !== undefined && isLayerVisible(def, techLevels) ? 1 : 0;
  }

  // Fades toward the layer's target and redraws only when the camera scroll or the fade changed.
  update(camera: Phaser.Cameras.Scene2D.Camera, techLevels: Readonly<Record<TechId, number>>, deltaMs: number): void {
    const active = this.active;
    if (active === null) return;
    const target = isLayerVisible(active.strip.def, techLevels) && !this.mastAssembling() ? 1 : 0;
    this.fade = fadeStep(this.fade, target, deltaMs, PARALLAX_FADE_MS);
    if (this.fade === 0) {
      if (this.lastKey !== null) {
        this.graphics.clear();
        this.lastKey = null;
      }
      if (target === 0) this.pinned = null; // layer hidden again (session reset): the next light picks anew
      return;
    }
    const key = `${camera.scrollX},${camera.scrollY},${this.fade}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(active, { x: camera.scrollX, y: camera.scrollY }, this.fade);
  }

  /** Destroys the Graphics object; safe to call twice. */
  destroy(): void {
    if (this.graphics.scene) this.graphics.destroy(); // Phaser clears scene on destroy
    this.lastKey = null;
  }

  private draw(active: ActivePylonLine, scroll: Vec2, fade: number): void {
    const { strip, mast } = active;
    const style = MACHINE_LINK_STYLE.cable;
    const input: PylonAnchorInput = {
      from: mast,
      anchorsArt: PYLON_LINE.anchorsArt,
      tilePx: strip.tilePx,
      tileHeightPx: strip.tileHeightPx,
      scale: PIXEL_SCALE,
      scrollFactor: strip.def.scrollFactor,
      stripLeftX: strip.stripLeftX,
      bottomObjY: strip.bottomObjY,
      scroll,
    };
    if (this.pinned === null) this.pinned = nearestPylonAnchor(input)?.ref ?? null; // first light: choose once
    const anchor = this.pinned === null ? null : pylonAnchorPoint(input, this.pinned);
    this.graphics.clear();
    if (anchor === null) return;

    const distance = Math.hypot(anchor.x - mast.x, anchor.y - mast.y);
    const points = cableParabola(mast, anchor, distance * PYLON_LINE.sagFraction, CABLE_SEGMENTS);
    const [head, ...rest] = points;
    if (head === undefined) return;

    this.graphics.setAlpha(fade * strip.def.alpha);
    this.graphics.lineStyle(PYLON_LINE.thicknessPx, style.core, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(head.x, head.y);
    for (const p of rest) this.graphics.lineTo(p.x, p.y);
    this.graphics.strokePath();

    this.graphics.fillStyle(style.hi, 1);
    for (const p of [mast, anchor]) this.graphics.fillRect(p.x - 1, p.y - 1, 2, 2); // 2x2 end caps
  }
}
