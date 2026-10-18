import Phaser from 'phaser';
import type { AssetId } from '../../assets/assetIds';
import { MACHINE_ANCHOR, DUST, DUST_RISING } from '../../data/world';

const DUST_TEXTURE: AssetId = 'fx.dust';

/** Mote emitter config: the shared look (life, size, fade, count) with this stream's spawn top and vertical drift. */
function moteConfig(spawnTopY: number, speedY: [number, number], emitting: boolean): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
  return {
    x: { min: MACHINE_ANCHOR.x - DUST.spawnHalfWidth, max: MACHINE_ANCHOR.x + DUST.spawnHalfWidth },
    y: { min: spawnTopY, max: DUST.spawnBottomY },
    lifespan: { min: DUST.lifespanMs[0], max: DUST.lifespanMs[1] },
    speedX: { min: DUST.speedX[0], max: DUST.speedX[1] },
    speedY: { min: speedY[0], max: speedY[1] },
    scale: { min: DUST.scale[0], max: DUST.scale[1] },
    alpha: { start: DUST.alpha[1], end: DUST.alpha[0] },
    frequency: DUST.frequencyMs,
    maxAliveParticles: DUST.maxParticles,
    emitting,
  };
}

// Drifting dust motes spread across the band around the machine (MACHINE_ANCHOR.x +- DUST.spawnHalfWidth), pre-populated so the first frame already has dust.
// Two streams share the look: `normal` (DUST band and drift) and `rising` (Era IV, once the spire stands:
// DUST_RISING band and upward drift). Only one emits at a time; the stopped stream's live motes finish naturally.
export class DustField {
  private readonly normal: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rising: Phaser.GameObjects.Particles.ParticleEmitter;
  private risingOn = false;

  constructor(scene: Phaser.Scene) {
    this.normal = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST.spawnTopY, DUST.speedY, true));
    this.normal.setDepth(DUST.depth);
    this.normal.fastForward(DUST.lifespanMs[1]);
    this.rising = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST_RISING.spawnTopY, DUST_RISING.speedY, false));
    this.rising.setDepth(DUST.depth);
  }

  /**
   * Switches the mote stream to rising (`on`) or normal. No-op when the state is unchanged.
   * `immediate` (a loaded save with the spire already standing) fills the rising stream now and drops the normal motes.
   */
  setRising(on: boolean, immediate = false): void {
    if (on === this.risingOn) return;
    this.risingOn = on;
    if (on) {
      this.normal.stop();
      this.rising.start();
      if (immediate) {
        this.rising.fastForward(DUST.lifespanMs[1]);
        this.normal.killAll();
      }
    } else {
      this.rising.stop();
      this.normal.start();
      if (immediate) {
        this.normal.fastForward(DUST.lifespanMs[1]);
        this.rising.killAll();
      }
    }
  }

  destroy(): void {
    this.normal.destroy();
    this.rising.destroy();
  }
}
