import Phaser from 'phaser';
import { WORLD, GROUND_Y, PIXEL_SCALE, GROUND_LAYER, HORIZON_STRIP, GROUND_SHADE } from '../../data/world';

// Tiled ground below the horizon line plus the thin darker horizon strip.
export class Terrain {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.objects.push(
      scene.add
        .tileSprite(0, GROUND_Y, WORLD.width, WORLD.height - GROUND_Y, GROUND_LAYER.assetId)
        .setOrigin(0, 0)
        .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
        .setDepth(GROUND_LAYER.depth),
    );
    this.objects.push(
      scene.add
        .rectangle(0, GROUND_Y, WORLD.width, HORIZON_STRIP.height, HORIZON_STRIP.color, HORIZON_STRIP.alpha)
        .setOrigin(0, 0)
        .setDepth(GROUND_LAYER.depth + 1),
    );
    // Far-ground haze just under the horizon, then stacked foreground shade bands (hard steps, no gradient).
    this.objects.push(
      scene.add
        .rectangle(0, GROUND_Y + HORIZON_STRIP.height, WORLD.width, GROUND_SHADE.haze.height, GROUND_SHADE.haze.color, GROUND_SHADE.haze.alpha)
        .setOrigin(0, 0)
        .setDepth(GROUND_LAYER.depth + 1),
    );
    for (const start of GROUND_SHADE.bandStarts) {
      this.objects.push(
        scene.add
          .rectangle(0, GROUND_Y + start, WORLD.width, WORLD.height - GROUND_Y - start, GROUND_SHADE.color, GROUND_SHADE.alpha)
          .setOrigin(0, 0)
          .setDepth(GROUND_LAYER.depth + 1),
      );
    }
  }

  destroy(): void {
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects.length = 0;
  }
}
