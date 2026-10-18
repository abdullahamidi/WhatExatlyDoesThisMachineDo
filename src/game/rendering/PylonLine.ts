import Phaser from 'phaser';
import { PARALLAX_LAYERS, PARALLAX_FADE_MS, PYLON_LINE, VIEW, WORLD, CAMERA, PIXEL_SCALE, DEPTH } from '../../data/world';
import type { ParallaxLayerDef, PylonFeed } from '../../data/world';
import { MACHINE_COMPONENTS, MACHINE_LINK_STYLE } from '../../data/machineComponents';
import type { Vec2 } from '../../data/machineComponents';
import type { TechId } from '../../data/types';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { effectiveMinZoom } from '../math/camera';
import { parallaxStrip, isLayerVisible, fadeStep, layerPhase } from '../math/parallax';
import { machineLocalToWorld } from '../math/machineLayout';
import { resolveConnectionPoint } from '../math/machineLinks';
import { cableParabola, nearestPylonAnchor, pylonAnchorPoint, pylonCableStart } from '../math/pylonLine';
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

/** Everything needed to draw the cable; null in the class when the layer or the feed point is missing. */
interface ActivePylonLine {
  strip: PylonStrip;
  feedPoint: Vec2;  // world point of the feed (the export)
  lead: Vec2 | null; // world point of PylonFeed.leadTo, when set
  start: Vec2;      // catenary start: lead when set, else feedPoint
}

function pylonStrip(def: ParallaxLayerDef): PylonStrip {
  const entry = ASSET_MANIFEST[def.assetId];
  // same tile phase ParallaxBackground uses, so the wire anchors sit on the drawn pylons
  const phase = layerPhase(def.scrollFactor, entry.width, PIXEL_SCALE);
  const geometry = parallaxStrip({
    scrollFactor: def.scrollFactor,
    bottomY: def.bottomY,
    artHeight: entry.height,
    scale: PIXEL_SCALE,
    world: WORLD,
    view: VIEW,
    focus: CAMERA.focus,
    minZoom: effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom),
    phaseShiftPx: phase.phaseShiftPx,
    periodPx: phase.periodPx,
  });
  return {
    def,
    stripLeftX: geometry.left,
    bottomObjY: geometry.bottom,
    tilePx: entry.width,
    tileHeightPx: entry.height,
  };
}

// Thin cyan cable from a machine feed point (the cable mast top, or the turbine export) to the lit pylon
// insulator it is pinned to (CR7, CR-A). It lives in world space, outside the machine texture: its far end
// moves with the pylons layer parallax, its near end moves with the machine. Visibility and fade follow the
// pylonsLit layer and the feed's tech gate, and the fade-in waits until the feed's part has finished
// assembling. The anchor is chosen once on first light and kept.
// A feed with leadTo also gets a 1 px lead from the feed point up to leadTo, drawn at machine cable depth (over the
// machine casing) on its own Graphics; the catenary then starts at leadTo.
export class PylonLine {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly leadGraphics: Phaser.GameObjects.Graphics;
  private readonly active: ActivePylonLine | null;
  private readonly feed: PylonFeed;
  private readonly componentAssembling: () => boolean;
  private fade: number;
  private lastKey: string | null = null;
  private pinned: PylonAnchorRef | null = null; // chosen on first light; cleared once the layer hides

  constructor(
    scene: Phaser.Scene,
    techLevels: Readonly<Record<TechId, number>>,
    feed: PylonFeed,
    componentAssembling: () => boolean = () => false,
  ) {
    const def = PARALLAX_LAYERS.find((layer) => layer.id === 'pylonsLit');
    const point = resolveConnectionPoint(MACHINE_COMPONENTS[feed.component], feed.point);
    this.graphics = scene.add
      .graphics()
      .setScrollFactor(1)
      .setDepth((def?.depth ?? DEPTH.background) + PYLON_LINE.depthOffset);
    // machine container depth + the cable depth MachineLinks uses inside the machine
    this.leadGraphics = scene.add
      .graphics()
      .setScrollFactor(1)
      .setDepth(DEPTH.machine + MACHINE_LINK_STYLE.cable.depth);
    if (def !== undefined && point !== null) {
      const feedPoint = machineLocalToWorld(point);
      const lead = feed.leadTo === undefined ? null : machineLocalToWorld(feed.leadTo);
      this.active = { strip: pylonStrip(def), feedPoint, lead, start: pylonCableStart(feedPoint, lead) };
    } else {
      this.active = null;
    }
    this.feed = feed;
    this.componentAssembling = componentAssembling;
    // Already lit at load: no fade-in.
    this.fade = def !== undefined && isLayerVisible(def, techLevels) && this.gateMet(techLevels) ? 1 : 0;
  }

  /** True when the feed's tech gate (if any) is owned at the required level. */
  private gateMet(techLevels: Readonly<Record<TechId, number>>): boolean {
    const gate = this.feed.gate;
    return gate === undefined || techLevels[gate.techId] >= gate.minLevel;
  }

  // Fades toward the layer's target and redraws only when the camera scroll or the fade changed.
  update(camera: Phaser.Cameras.Scene2D.Camera, techLevels: Readonly<Record<TechId, number>>, deltaMs: number): void {
    const active = this.active;
    if (active === null) return;
    const target = isLayerVisible(active.strip.def, techLevels) && this.gateMet(techLevels) && !this.componentAssembling() ? 1 : 0;
    this.fade = fadeStep(this.fade, target, deltaMs, PARALLAX_FADE_MS);
    if (this.fade === 0) {
      if (this.lastKey !== null) {
        this.graphics.clear();
        this.leadGraphics.clear();
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

  /** Destroys the Graphics objects; safe to call twice. */
  destroy(): void {
    if (this.graphics.scene) this.graphics.destroy(); // Phaser clears scene on destroy
    if (this.leadGraphics.scene) this.leadGraphics.destroy();
    this.lastKey = null;
  }

  /** Lead from the feed point up to leadTo: 1 art px core with 2x2 highlight caps, like the machine cables. */
  private drawLead(active: ActivePylonLine, fade: number): void {
    const { feedPoint, lead } = active;
    const g = this.leadGraphics;
    g.clear();
    if (lead === null) return;
    const style = MACHINE_LINK_STYLE.cable;
    g.setAlpha(fade);
    g.lineStyle(PIXEL_SCALE, style.core, 1); // one art px wide
    g.beginPath();
    g.moveTo(feedPoint.x, feedPoint.y);
    g.lineTo(lead.x, lead.y);
    g.strokePath();
    g.fillStyle(style.hi, 1);
    for (const p of [feedPoint, lead]) g.fillRect(p.x - 1, p.y - 1, 2, 2); // 2x2 end caps
  }

  private draw(active: ActivePylonLine, scroll: Vec2, fade: number): void {
    this.drawLead(active, fade);
    const { strip, start } = active;
    const style = MACHINE_LINK_STYLE.cable;
    const input: PylonAnchorInput = {
      from: start,
      anchorsArt: PYLON_LINE.anchorsArt,
      tilePx: strip.tilePx,
      tileHeightPx: strip.tileHeightPx,
      scale: PIXEL_SCALE,
      scrollFactor: strip.def.scrollFactor,
      stripLeftX: strip.stripLeftX,
      bottomObjY: strip.bottomObjY,
      scroll,
      side: this.feed.side,
    };
    if (this.pinned === null) this.pinned = nearestPylonAnchor(input)?.ref ?? null; // first light: choose once
    const anchor = this.pinned === null ? null : pylonAnchorPoint(input, this.pinned);
    this.graphics.clear();
    if (anchor === null) return;

    const distance = Math.hypot(anchor.x - start.x, anchor.y - start.y);
    const points = cableParabola(start, anchor, distance * PYLON_LINE.sagFraction, CABLE_SEGMENTS);
    const [head, ...rest] = points;
    if (head === undefined) return;

    this.graphics.setAlpha(fade * strip.def.alpha);
    this.graphics.lineStyle(PYLON_LINE.thicknessPx, style.core, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(head.x, head.y);
    for (const p of rest) this.graphics.lineTo(p.x, p.y);
    this.graphics.strokePath();

    this.graphics.fillStyle(style.hi, 1);
    for (const p of [start, anchor]) this.graphics.fillRect(p.x - 1, p.y - 1, 2, 2); // 2x2 end caps
  }
}
