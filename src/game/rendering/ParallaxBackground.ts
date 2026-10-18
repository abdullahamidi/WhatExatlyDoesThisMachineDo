import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, PARALLAX_LAYERS, PARALLAX_FADE_MS, PIXEL_SCALE } from '../../data/world';
import type { ParallaxLayerDef } from '../../data/world';
import type { TechId } from '../../data/types';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { minZoomToFit } from '../math/camera';
import { parallaxSpan, parallaxStrip, isLayerVisible, fadeStep } from '../math/parallax';

// Any layer part that can change alpha and visibility.
type FadePart = Phaser.GameObjects.Components.AlphaSingle & Phaser.GameObjects.Components.Visible;

// A layer with visibleWhen: fade 0 = hidden, 1 = fully shown; parts are its game objects.
interface FadingLayer {
  readonly def: ParallaxLayerDef;
  fade: number;
  readonly parts: FadePart[];
}

// Sky image (screen-fixed) plus one horizontally tiled strip per parallax layer, all driven by PARALLAX_LAYERS.
// Layers with visibleWhen are hidden until their tech level is reached, then fade in (and out on a reset).
export class ParallaxBackground {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly fading: FadingLayer[] = [];

  constructor(scene: Phaser.Scene, techLevels: Readonly<Record<TechId, number>>) {
    const minZoom = minZoomToFit(VIEW, WORLD);
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
        const geometry = parallaxStrip({
          scrollFactor: sf,
          bottomY: def.bottomY,
          artHeight: ASSET_MANIFEST[def.assetId].height,
          scale: PIXEL_SCALE,
          world: WORLD,
          view: VIEW,
          focus: CAMERA.focus,
          minZoom,
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

      if (def.visibleWhen !== undefined) {
        const layer: FadingLayer = { def, fade: isLayerVisible(def, techLevels) ? 1 : 0, parts };
        this.fading.push(layer);
        this.applyFade(layer);
      }
    }
  }

  // Moves every fading layer toward its target fade; objects are only touched while the fade changes.
  update(techLevels: Readonly<Record<TechId, number>>, deltaMs: number): void {
    for (const layer of this.fading) {
      const target = isLayerVisible(layer.def, techLevels) ? 1 : 0;
      const next = fadeStep(layer.fade, target, deltaMs, PARALLAX_FADE_MS);
      if (next === layer.fade) continue;
      layer.fade = next;
      this.applyFade(layer);
    }
  }

  destroy(): void {
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects.length = 0;
    this.fading.length = 0;
  }

  private applyFade(layer: FadingLayer): void {
    for (const part of layer.parts) {
      part.setAlpha(layer.def.alpha * layer.fade);
      part.setVisible(layer.fade > 0);
    }
  }
}
