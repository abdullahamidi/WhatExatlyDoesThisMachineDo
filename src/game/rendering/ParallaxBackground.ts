import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, PARALLAX_LAYERS, PIXEL_SCALE, DAY_TINT_LAYERS, DAY_TINT_TAU_MS } from '../../data/world';
import type { ParallaxLayerDef } from '../../data/world';
import type { FinaleTrackId } from '../../data/finale';
import type { TechId } from '../../data/types';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { effectiveMinZoom } from '../math/camera';
import { parallaxSpan, parallaxStrip, isLayerVisible, fadeStep, layerFadeMs, layerPhase, stageAlpha } from '../math/parallax';

// Any layer part: a game object that can change alpha and visibility.
type FadePart = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.AlphaSingle & Phaser.GameObjects.Components.Visible;

// Every parallax layer. A layer with visibleWhen / alphaStages (tech fade) and/or a finale track (def.finale) is repainted
// on change: fade 0 = hidden, 1 = fully shown (alpha layers: fade = alpha / def.alpha); target = the fade it heads to (set
// by update); finaleV = finale track value (0 until applyFinale runs). The rest keep fade 1 and are never repainted.
// parts are its game objects. A ruin layer in DAY_TINT_LAYERS also holds its day-tinted objects: tinted (its strip or sky
// image) and underfill (its solid fill rectangle, if any); other layers have tinted null.
interface LayerState {
  readonly def: ParallaxLayerDef;
  readonly fading: boolean;
  fade: number;
  target: number;
  finaleV: number;
  readonly parts: FadePart[];
  readonly tinted: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite | null;
  readonly underfill: Phaser.GameObjects.Rectangle | null;
}

const CHANNEL_MAX = 0xff;
const TINT_NONE = 0xffffff; // white: no tint, the identity of the multiply

// Finale multiplier of a layer: 'in' = v (hidden at 0), 'out' = 1 - v; 1 when the layer has no finale track.
function finaleMultiplier(def: ParallaxLayerDef, v: number): number {
  if (def.finale === undefined) return 1;
  const k = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return def.finale.dir === 'in' ? k : 1 - k;
}

// Target fade of a fading layer: its stage alpha over the layer alpha (alphaStages), else 1 / 0 from visibleWhen.
function fadeTarget(def: ParallaxLayerDef, techLevels: Readonly<Record<TechId, number>>): number {
  if (def.alphaStages !== undefined) {
    return def.alpha > 0 ? stageAlpha(def.alphaStages, techLevels) / def.alpha : 0;
  }
  return isLayerVisible(def, techLevels) ? 1 : 0;
}

// Channel i of a 0xRRGGBB colour (0 = red, 1 = green, 2 = blue).
function channel(rgb: number, i: number): number {
  return (rgb >> (16 - 8 * i)) & CHANNEL_MAX;
}

// Per-channel product of two 0xRRGGBB colours, each channel rounded: a layer's own tint x the day tint.
function multiplyTint(a: number, b: number): number {
  let out = 0;
  for (let i = 0; i < 3; i++) out = (out << 8) | Math.round((channel(a, i) * channel(b, i)) / CHANNEL_MAX);
  return out;
}

// Sky image (screen-fixed) plus one horizontally tiled strip per parallax layer, all driven by PARALLAX_LAYERS.
// Layers with visibleWhen are hidden until their tech level is reached, then fade in (and out on a reset).
// Layers with alphaStages take their stage alpha at load (no fade-in) and fade toward a new stage alpha later.
// The ruin layers in DAY_TINT_LAYERS take the day tint (setDayTint), eased over DAY_TINT_TAU_MS in update().
// slowFadeIn (WP26 Q3, WorldScene only): a rising layer with fadeInMs fades over that long per unit of fade (the era V sky builds over seconds); falling fades keep fadeMs.
export class ParallaxBackground {
  private readonly layers: LayerState[] = [];
  private readonly slowFadeIn: boolean; // WP26 Q3: rising layers fade over fadeInMs (see layerFadeMs)
  private readonly day = [CHANNEL_MAX, CHANNEL_MAX, CHANNEL_MAX]; // eased day tint, R G B
  private dayTarget = TINT_NONE;
  private dayPainted = TINT_NONE; // last integer day tint written to Phaser

  constructor(scene: Phaser.Scene, techLevels: Readonly<Record<TechId, number>>, options: { slowFadeIn?: boolean } = {}) {
    this.slowFadeIn = options.slowFadeIn ?? false;
    const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
    for (const def of PARALLAX_LAYERS) {
      const parts: FadePart[] = [];
      let tinted: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
      let underfill: Phaser.GameObjects.Rectangle | null = null;
      if (def.scrollFactor === 0) {
        // Sky: covers the widest visible rect (VIEW / minZoom) at every zoom.
        tinted = scene.add
          .image(VIEW.width / 2, VIEW.height / 2, def.assetId)
          .setScrollFactor(0)
          .setDepth(def.depth)
          .setAlpha(def.alpha)
          .setDisplaySize(VIEW.width / minZoom, VIEW.height / minZoom);
        parts.push(tinted);
      } else {
        const sf = def.scrollFactor;
        const phase = layerPhase(sf, ASSET_MANIFEST[def.assetId].width, PIXEL_SCALE);
        const geometry = parallaxStrip({
          scrollFactor: sf,
          bottomY: def.bottomY,
          artHeight: ASSET_MANIFEST[def.assetId].height,
          scale: PIXEL_SCALE,
          world: WORLD,
          view: VIEW,
          focus: CAMERA.focus,
          minZoom,
          phaseShiftPx: phase.phaseShiftPx,
          periodPx: phase.periodPx,
        });
        const spanY = parallaxSpan(WORLD.height, VIEW.height, minZoom, sf);

        tinted = scene.add
          .tileSprite(geometry.left, geometry.bottom, geometry.width, geometry.height, def.assetId)
          .setOrigin(0, 1)
          .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
          .setScrollFactor(sf)
          .setDepth(def.depth)
          .setAlpha(def.alpha);
        parts.push(tinted);
        if (def.tint !== undefined) {
          tinted.setTint(def.tint);
        }

        // Solid fill below the strip so panning never reveals a gap.
        if (def.underfill !== null && spanY.max - geometry.bottom > 0) {
          underfill = scene.add
            .rectangle(geometry.left, geometry.bottom, geometry.width, spanY.max - geometry.bottom, def.underfill)
            .setOrigin(0, 0)
            .setScrollFactor(sf)
            .setDepth(def.depth)
            .setAlpha(def.alpha);
          parts.push(underfill);
        }
      }

      const dayTinted = (DAY_TINT_LAYERS as readonly string[]).includes(def.id);
      const fading = def.visibleWhen !== undefined || def.alphaStages !== undefined;
      const fade = fading ? fadeTarget(def, techLevels) : 1;
      const layer: LayerState = {
        def,
        fading,
        fade,
        target: fade,
        finaleV: 0,
        parts,
        tinted: dayTinted ? tinted : null,
        underfill: dayTinted ? underfill : null,
      };
      this.layers.push(layer);
      this.paint(layer);
    }
  }

  // Moves every fading layer toward its target fade (layerFadeMs, default PARALLAX_FADE_MS) and eases the day tint over
  // deltaMs; objects are only touched while a value changes.
  update(techLevels: Readonly<Record<TechId, number>>, deltaMs: number): void {
    this.stepDayTint(deltaMs);
    for (const layer of this.layers) {
      if (!layer.fading) continue;
      layer.target = fadeTarget(layer.def, techLevels);
      const next = fadeStep(layer.fade, layer.target, deltaMs, layerFadeMs(layer.def, layer.fade, layer.target, this.slowFadeIn));
      if (next === layer.fade) continue;
      layer.fade = next;
      this.paint(layer);
    }
  }

  /**
   * Day tint (0xRRGGBB, white = none) for the DAY_TINT_LAYERS, multiplied with each layer's own tint. The colour eases
   * toward `rgb` in update(); `snap` lands on it at once. Phaser is written only when the integer colour changes.
   */
  setDayTint(rgb: number, snap = false): void {
    this.dayTarget = rgb;
    if (!snap) return;
    for (let i = 0; i < 3; i++) this.day[i] = channel(rgb, i);
    this.paintDayTint();
  }

  /** Settle mode (C5): snaps every fading layer to its target fade and paints it once; no-op when every layer is there. */
  settleFades(): void {
    for (const layer of this.layers) {
      if (!layer.fading || layer.fade === layer.target) continue;
      layer.fade = layer.target;
      this.paint(layer);
    }
  }

  // Finale track values (0..1 per track) multiply the alpha of their layers: 'in' = v, 'out' = 1 - v (v 0 hides 'in').
  // Layers without a finale track are untouched; with no call every finale layer keeps its default (in hidden, out shown).
  applyFinale(tracks: Readonly<Record<FinaleTrackId, number>>): void {
    for (const layer of this.layers) {
      const track = layer.def.finale?.track;
      if (track === undefined) continue;
      const v = tracks[track];
      if (v === layer.finaleV) continue;
      layer.finaleV = v;
      this.paint(layer);
    }
  }

  destroy(): void {
    for (const layer of this.layers) {
      for (const part of layer.parts) {
        part.destroy();
      }
    }
    this.layers.length = 0;
  }

  private paint(layer: LayerState): void {
    const mult = finaleMultiplier(layer.def, layer.finaleV);
    for (const part of layer.parts) {
      part.setAlpha(layer.def.alpha * layer.fade * mult);
      part.setVisible(layer.fade > 0 && mult > 0);
    }
  }

  // Eases each channel toward the day target over deltaMs (1 - e^(-dt / tau) of the gap per step; tau <= 0 snaps; a bad dt
  // leaves it), then paints when the integer colour moved.
  private stepDayTint(deltaMs: number): void {
    if (Number.isFinite(deltaMs) && deltaMs > 0) {
      for (let i = 0; i < 3; i++) {
        const current = this.day[i]!;
        const target = channel(this.dayTarget, i);
        this.day[i] = DAY_TINT_TAU_MS <= 0 ? target : current + (target - current) * (1 - Math.exp(-deltaMs / DAY_TINT_TAU_MS));
      }
    }
    this.paintDayTint();
  }

  // Writes the integer day colour through every day-tinted layer: its own tint x the day, and its underfill x the day.
  private paintDayTint(): void {
    let day = 0;
    for (let i = 0; i < 3; i++) day = (day << 8) | Math.round(this.day[i]!);
    if (day === this.dayPainted) return;
    this.dayPainted = day;
    for (const layer of this.layers) {
      layer.tinted?.setTint(multiplyTint(layer.def.tint ?? TINT_NONE, day));
      if (layer.underfill !== null) {
        layer.underfill.setFillStyle(multiplyTint(layer.def.underfill ?? TINT_NONE, day));
      }
    }
  }
}
