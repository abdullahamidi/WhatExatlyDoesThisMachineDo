import Phaser from 'phaser';
import type { AssetId } from '../../assets/assetIds';
import { WORLD, DUST } from '../../data/world';

const DUST_TEXTURE: AssetId = 'fx.dust';

// Drifting dust motes spread across the whole world, pre-populated so the first frame already has dust.
export class DustField {
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.emitter = scene.add.particles(0, 0, DUST_TEXTURE, {
      x: { min: 0, max: WORLD.width },
      y: { min: DUST.spawnTopY, max: DUST.spawnBottomY },
      lifespan: { min: DUST.lifespanMs[0], max: DUST.lifespanMs[1] },
      speedX: { min: DUST.speedX[0], max: DUST.speedX[1] },
      speedY: { min: DUST.speedY[0], max: DUST.speedY[1] },
      scale: { min: DUST.scale[0], max: DUST.scale[1] },
      alpha: { start: DUST.alpha[1], end: DUST.alpha[0] },
      frequency: DUST.frequencyMs,
      maxAliveParticles: DUST.maxParticles,
    });
    this.emitter.setDepth(DUST.depth);
    this.emitter.fastForward(DUST.lifespanMs[1]);
  }

  destroy(): void {
    this.emitter.destroy();
  }
}
