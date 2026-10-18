import Phaser from 'phaser';
import { WORLD, GROUND_Y, PIXEL_SCALE, MACHINE_ANCHOR } from '../../data/world';
import { FINALE_WIPE, RESTORED_GROUND } from '../../data/finale';
import { PALETTE } from '../../data/palette';
import { ASSET_MANIFEST } from '../../assets/manifest';
import { layerPhase } from '../math/parallax';
import { wipeRects } from '../math/finale';
import type { FinaleFrame } from '../math/finale';

// One wipe layer: the ground (index 0), then the three regrowth strips (1..3), the order of FinaleFrame.wipe.halfWidthPx.
interface WipeLayer {
  readonly sprite: Phaser.GameObjects.TileSprite;
  readonly topY: number;                       // world y of the band the wipe reveals
  readonly heightPx: number;
  readonly seed: number;
  mask: Phaser.GameObjects.Graphics | null;    // exists only while the frame's mode is 'wipe'
  drawnHalfPx: number;                         // half width the mask was last drawn at (NaN = not drawn)
}

// Restored ground (terrain.groundGreen, a twin of Terrain's tiled ground) and the three regrowth strips on the horizon.
// They are not parallax rows: the finale wipe reveals them from the machine outwards with geometry masks (mode 'wipe'
// only). 'fade' is the reduced-motion crossfade (alpha only, no mask); 'full' is unmasked; 'hidden' is invisible.
export class RestoredGround {
  private readonly scene: Phaser.Scene;
  private readonly layers: WipeLayer[] = [];
  private mode: FinaleFrame['wipe']['mode'] = 'hidden';
  private alpha = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Same phase and rect as Terrain (EM decision 2): the tile grid lines up with the ruined ground.
    const groundPhase = layerPhase(1, ASSET_MANIFEST[RESTORED_GROUND.groundAssetId].width, PIXEL_SCALE);
    const ground = scene.add
      .tileSprite(
        groundPhase.phaseShiftPx - groundPhase.periodPx,
        GROUND_Y,
        WORLD.width + groundPhase.periodPx,
        WORLD.height - GROUND_Y,
        RESTORED_GROUND.groundAssetId,
      )
      .setOrigin(0, 0)
      .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
      .setDepth(RESTORED_GROUND.groundDepth)
      .setVisible(false);
    this.layers.push({ sprite: ground, topY: GROUND_Y, heightPx: WORLD.height - GROUND_Y, seed: FINALE_WIPE.seed, mask: null, drawnHalfPx: NaN });

    // Regrowth strips: one tile row each (art height x PIXEL_SCALE), bottom at GROUND_Y + regrowthBottomOffsetPx.
    RESTORED_GROUND.regrowth.forEach((strip, i) => {
      const art = ASSET_MANIFEST[strip.assetId];
      const phase = layerPhase(1, art.width, PIXEL_SCALE);
      const heightPx = PIXEL_SCALE * art.height;
      const bottomY = GROUND_Y + RESTORED_GROUND.regrowthBottomOffsetPx;
      const sprite = scene.add
        .tileSprite(phase.phaseShiftPx - phase.periodPx, bottomY, WORLD.width + phase.periodPx, heightPx, strip.assetId)
        .setOrigin(0, 1)
        .setTileScale(PIXEL_SCALE, PIXEL_SCALE)
        .setDepth(RESTORED_GROUND.regrowthDepth)
        .setVisible(false);
      this.layers.push({ sprite, topY: bottomY - heightPx, heightPx, seed: FINALE_WIPE.seed + i + 1, mask: null, drawnHalfPx: NaN });
    });
  }

  // Applies this frame's wipe. Masks exist only in 'wipe' and are redrawn only when a layer's half width changes.
  applyFinale(frame: FinaleFrame): void {
    const wipe = frame.wipe;
    if (wipe.mode !== this.mode) {
      this.mode = wipe.mode;
      this.releaseMasks();
      const visible = wipe.mode !== 'hidden';
      for (const layer of this.layers) layer.sprite.setVisible(visible);
      this.alpha = NaN; // force the alpha write below
    }
    if (this.mode === 'hidden') return;
    if (wipe.alpha !== this.alpha) {
      this.alpha = wipe.alpha;
      for (const layer of this.layers) layer.sprite.setAlpha(wipe.alpha);
    }
    if (this.mode !== 'wipe') return;
    this.layers.forEach((layer, i) => this.drawMask(layer, wipe.halfWidthPx[i] ?? 0));
  }

  destroy(): void {
    this.releaseMasks();
    for (const layer of this.layers) {
      if (layer.sprite.scene) layer.sprite.destroy(); // Phaser clears scene on destroy
    }
    this.layers.length = 0;
  }

  // Creates the layer's mask on first use and redraws its band rects only when the half width moved.
  private drawMask(layer: WipeLayer, halfPx: number): void {
    let g = layer.mask;
    if (g === null) {
      g = this.scene.make.graphics({}, false);
      layer.mask = g;
      layer.sprite.setMask(g.createGeometryMask());
      layer.drawnHalfPx = NaN;
    }
    if (halfPx === layer.drawnHalfPx) return;
    layer.drawnHalfPx = halfPx;
    g.clear().fillStyle(PALETTE.steam);
    for (const r of wipeRects(halfPx, MACHINE_ANCHOR.x, layer.topY, layer.heightPx, WORLD.width, layer.seed)) {
      if (r.w > 0) g.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  private releaseMasks(): void {
    for (const layer of this.layers) {
      if (layer.mask === null) continue;
      layer.sprite.clearMask();
      layer.mask.destroy();
      layer.mask = null;
      layer.drawnHalfPx = NaN;
    }
  }
}
