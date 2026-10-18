import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, PARALLAX_LAYERS, PARALLAX_FADE_MS, PIXEL_SCALE } from '../../data/world';
import type { ParallaxLayerDef } from '../../data/world';
import type { FinaleTrackId } from '../../data/finale';
import type { TechId } from '../../data/types';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { effectiveMinZoom } from '../math/camera';
import { parallaxSpan, parallaxStrip, isLayerVisible, fadeStep, layerPhase, stageAlpha } from '../math/parallax';

// Any layer part that can change alpha and visibility.
type FadePart = Phaser.GameObjects.Components.AlphaSingle & Phaser.GameObjects.Components.Visible;

// A layer with visibleWhen / alphaStages (tech fade) and/or a finale track (def.finale). fade 0 = hidden, 1 = fully
// shown (alpha layers: fade = alpha / def.alpha); finaleV = finale track value (0 until applyFinale runs). Layers with
// neither keep fade 1 and are never repainted. parts are its game objects.
interface LayerState {
  readonly def: ParallaxLayerDef;
  readonly fading: boolean;
  fade: number;
  finaleV: number;
  readonly parts: FadePart[];
}

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

// Sky image (screen-fixed) plus one horizontally tiled strip per parallax layer, all driven by PARALLAX_LAYERS.
// Layers with visibleWhen are hidden until their tech level is reached, then fade in (and out on a reset).
// Layers with alphaStages take their stage alpha at load (no fade-in) and fade toward a new stage alpha later.
export class ParallaxBackground {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly layers: LayerState[] = [];

  constructor(scene: Phaser.Scene, techLevels: Readonly<Record<TechId, number>>) {
    const minZoom = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
    for (const def of PARALLAX_LAYERS) {
      const parts: FadePart[] = [];
      const track = <T extends FadePart & Phaser.GameObjects.GameObject>(object: T): T => {
        this.objects.push(object);
        parts.push(object);
        return object;
      };

      if (def.scrollFactor === 0) {
        // Sky: covers the widest visible rect (VIEW / minZoom) at every zoom.
        track(
          scene.add
            .image(VIEW.width / 2, VIEW.height / 2, def.assetId)
            .setScrollFactor(0)
            .setDepth(def.depth)
            .setAlpha(def.alpha)
            .setDisplaySize(VIEW.width / minZoom, VIEW.height / minZoom),
        );
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

        const strip = track(
          scene.add
            .tileSprite(geometry.left, geometry.bottom, geometry.width, geometry.height, def.assetId)
            .setOrigin(0, 1)
            .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
            .setScrollFactor(sf)
            .setDepth(def.depth)
            .setAlpha(def.alpha),
        );
        if (def.tint !== undefined) {
          strip.setTint(def.tint);
        }

        // Solid fill below the strip so panning never reveals a gap.
        if (def.underfill !== null && spanY.max - geometry.bottom > 0) {
          track(
            scene.add
              .rectangle(geometry.left, geometry.bottom, geometry.width, spanY.max - geometry.bottom, def.underfill)
              .setOrigin(0, 0)
              .setScrollFactor(sf)
              .setDepth(def.depth)
              .setAlpha(def.alpha),
          );
        }
      }

      const fading = def.visibleWhen !== undefined || def.alphaStages !== undefined;
      if (fading || def.finale !== undefined) {
        const layer: LayerState = { def, fading, fade: fading ? fadeTarget(def, techLevels) : 1, finaleV: 0, parts };
        this.layers.push(layer);
        this.paint(layer);
      }
    }
  }

  // Moves every fading layer toward its target fade; objects are only touched while the fade changes.
  update(techLevels: Readonly<Record<TechId, number>>, deltaMs: number): void {
    for (const layer of this.layers) {
      if (!layer.fading) continue;
      const target = fadeTarget(layer.def, techLevels);
      const next = fadeStep(layer.fade, target, deltaMs, PARALLAX_FADE_MS);
      if (next === layer.fade) continue;
      layer.fade = next;
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
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects.length = 0;
    this.layers.length = 0;
  }

  private paint(layer: LayerState): void {
    const mult = finaleMultiplier(layer.def, layer.finaleV);
    for (const part of layer.parts) {
      part.setAlpha(layer.def.alpha * layer.fade * mult);
      part.setVisible(layer.fade > 0 && mult > 0);
    }
  }
}
