import Phaser from 'phaser';
import { DEPTH } from '../../data/world';
import { CRANK_SPARKS } from '../../data/ux';

/**
 * Click-juice sparks thrown off the crank (WP20 D14). One emitter in explode mode: each manual click
 * bursts CRANK_SPARKS.count motes at the crank. `enabled` is read live per burst, so reduced motion
 * (flashes off) silences the sparks without rebuilding the emitter.
 */
export class CrankSparks {
  private readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly enabled: () => boolean;

  constructor(scene: Phaser.Scene, enabled: () => boolean) {
    this.enabled = enabled;
    this.emitter = scene.add
      .particles(0, 0, CRANK_SPARKS.texture, {
        speed: CRANK_SPARKS.speed,
        angle: CRANK_SPARKS.angle,
        lifespan: CRANK_SPARKS.lifespanMs,
        scale: CRANK_SPARKS.scale,
        alpha: CRANK_SPARKS.alpha,
        gravityY: CRANK_SPARKS.gravityY,
        tint: CRANK_SPARKS.tint,
        emitting: false,
        maxAliveParticles: CRANK_SPARKS.maxAlive,
      })
      .setDepth(DEPTH.floatingText - 1);
  }

  /** One burst of CRANK_SPARKS.count motes at world (x, y); nothing when the sparks are disabled. */
  burst(x: number, y: number): void {
    if (!this.enabled()) return;
    this.emitter.explode(CRANK_SPARKS.count, x, y);
  }

  destroy(): void {
    // Scene teardown may already have destroyed the emitter; its scene is then unset.
    if (this.emitter.scene) this.emitter.destroy();
  }
}
