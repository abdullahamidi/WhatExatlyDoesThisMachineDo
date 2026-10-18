import Phaser from 'phaser';
import { planAssetLoads } from '../../assets/manifest';
import { ensureFallbackTextures } from '../../assets/fallbackTextures';

// Loads every file-backed asset, then generates procedural textures for whatever is still missing.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn('[assets] failed to load', file.key, file.url);
    });
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
    ensureFallbackTextures(this);
    this.scene.start('World');
  }
}
