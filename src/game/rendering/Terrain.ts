import Phaser from 'phaser';
import { WORLD, GROUND_Y, PIXEL_SCALE, GROUND_LAYER, HORIZON_STRIP, GROUND_SHADE } from '../../data/world';
import { PALETTE } from '../../data/palette';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { layerPhase } from '../math/parallax';

// Tiled ground below the horizon line plus the thin darker horizon strip.
// setRestored(true) (finale restored world, postgame) turns the far-ground haze from beige to the clear sky blue.
export class Terrain {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly haze: Phaser.GameObjects.Rectangle;
  private restored = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    // The tile grid is phased like the parallax patterns: tile boundaries stay where they were relative to the
    // machine after the world grew (EM decision 2). The sprite starts one period early, shifted by the phase.
    const phase = layerPhase(1, ASSET_MANIFEST[GROUND_LAYER.assetId].width, PIXEL_SCALE);
    this.objects.push(
      scene.add
        .tileSprite(phase.phaseShiftPx - phase.periodPx, GROUND_Y, WORLD.width + phase.periodPx, WORLD.height - GROUND_Y, GROUND_LAYER.assetId)
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
    this.haze = scene.add
      .rectangle(0, GROUND_Y + HORIZON_STRIP.height, WORLD.width, GROUND_SHADE.haze.height, GROUND_SHADE.haze.color, GROUND_SHADE.haze.alpha)
      .setOrigin(0, 0)
      .setDepth(GROUND_LAYER.depth + 1);
    this.objects.push(this.haze);
    for (const start of GROUND_SHADE.bandStarts) {
      this.objects.push(
        scene.add
          .rectangle(0, GROUND_Y + start, WORLD.width, WORLD.height - GROUND_Y - start, GROUND_SHADE.color, GROUND_SHADE.alpha)
          .setOrigin(0, 0)
          .setDepth(GROUND_LAYER.depth + 1),
      );
    }
  }

  /** Restored world (finale phase choice/postgame): haze colour follows the clear sky. Alpha is unchanged. */
  setRestored(restored: boolean): void {
    if (this.destroyed || restored === this.restored) return;
    this.restored = restored;
    this.haze.setFillStyle(restored ? PALETTE.skyClear1 : GROUND_SHADE.haze.color, GROUND_SHADE.haze.alpha);
  }

  destroy(): void {
    this.destroyed = true;
    for (const object of this.objects) {
      object.destroy();
    }
    this.objects.length = 0;
  }
}
