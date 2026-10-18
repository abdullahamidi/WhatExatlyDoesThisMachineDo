import Phaser from 'phaser';
import { ASSET_IDS } from '../../assets/assetIds';
import { ASSET_MANIFEST, planAssetLoads } from '../../assets/manifest';
import { ensureFallbackTextures } from '../../assets/fallbackTextures';

// Loads every file-backed asset, then generates procedural textures for whatever is still missing.
export class BootScene extends Phaser.Scene {
  private readonly onFileLoadError = (file: Phaser.Loader.File): void => {
    console.warn('[assets] failed to load', file.key, file.url);
  };

  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onFileLoadError);
    for (const load of planAssetLoads()) {
      if (load.kind === 'spritesheet') {
        if (load.frame === undefined) continue;
        this.load.spritesheet(load.key, load.url, { frameWidth: load.frame.width, frameHeight: load.frame.height });
      } else {
        this.load.image(load.key, load.url);
      }
    }
  }

  create(): void {
    // The error listener only matters while loading; remove it so restarts do not stack listeners.
    this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onFileLoadError);
    this.warnOnSizeMismatch();
    ensureFallbackTextures(this);
    this.scene.start('World');
  }

  /** Warns (never throws) when a loaded texture's source size differs from the manifest. */
  private warnOnSizeMismatch(): void {
    for (const id of ASSET_IDS) {
      if (!this.textures.exists(id)) continue;
      const entry = ASSET_MANIFEST[id];
      const source = this.textures.get(id).getSourceImage();
      if (source.width !== entry.width || source.height !== entry.height) {
        console.warn(
          '[assets] size mismatch for', id,
          `got ${source.width}x${source.height}, manifest ${entry.width}x${entry.height}`,
        );
      }
    }
  }
}
