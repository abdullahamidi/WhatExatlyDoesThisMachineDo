import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, PARALLAX_LAYERS, PIXEL_SCALE } from '../../data/world';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { minZoomToFit } from '../math/camera';
import { parallaxPosition, parallaxSpan } from '../math/parallax';

// Sky image (screen-fixed) plus one horizontally tiled strip per parallax layer, all driven by PARALLAX_LAYERS.
export class ParallaxBackground {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    const minZoom = minZoomToFit(VIEW, WORLD);
    for (const def of PARALLAX_LAYERS) {
      if (def.scrollFactor === 0) {
        // Sky: covers the widest visible rect (VIEW / minZoom) at every zoom.
        this.objects.push(
          scene.add
            .image(VIEW.width / 2, VIEW.height / 2, def.assetId)
            .setScrollFactor(0)
            .setDepth(def.depth)
            .setAlpha(def.alpha)
            .setDisplaySize(VIEW.width / minZoom, VIEW.height / minZoom),
        );
        continue;
      }

      const entry = ASSET_MANIFEST[def.assetId];
      const sf = def.scrollFactor;
      const spanX = parallaxSpan(WORLD.width, VIEW.width, minZoom, sf);
      const spanY = parallaxSpan(WORLD.height, VIEW.height, minZoom, sf);
      const pos = parallaxPosition({ x: 0, y: def.bottomY }, CAMERA.focus, VIEW, sf);

      const strip = scene.add
        .tileSprite(spanX.min, pos.y, spanX.max - spanX.min, entry.height * PIXEL_SCALE, def.assetId)
        .setOrigin(0, 1)
        .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
        .setScrollFactor(sf)
        .setDepth(def.depth)
        .setAlpha(def.alpha);
      if (def.tint !== undefined) {
        strip.setTint(def.tint);
      }
      this.objects.push(strip);

      // Solid fill below the strip so panning never reveals a gap.
      if (def.underfill !== null && spanY.max - pos.y > 0) {
        this.objects.push(
          scene.add
            .rectangle(spanX.min, pos.y, spanX.max - spanX.min, spanY.max - pos.y, def.underfill)
            .setOrigin(0, 0)
            .setScrollFactor(sf)
            .setDepth(def.depth)
            .setAlpha(def.alpha),
        );
      }
    }
  }

  destroy(): void {
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects.length = 0;
  }
}
