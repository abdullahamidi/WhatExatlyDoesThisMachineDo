import Phaser from 'phaser';
import type { AssetId } from '../../assets/assetIds';
import { MACHINE_ANCHOR, DUST, DUST_RISING } from '../../data/world';
import { FINALE_DUST } from '../../data/finale';
import type { FinaleFrame } from '../math/finale';

const DUST_TEXTURE: AssetId = 'fx.dust';

/** Mote emitter config: the shared look (life, size, fade, count) with this stream's spawn top and vertical drift. */
function moteConfig(spawnTopY: number, speedY: readonly [number, number], emitting: boolean): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
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
  private readonly reverse: Phaser.GameObjects.Particles.ParticleEmitter;
  private risingOn = false;
  private finale: FinaleFrame['dust'] = 'normal';

  constructor(scene: Phaser.Scene) {
    this.normal = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST.spawnTopY, DUST.speedY, true));
    this.normal.setDepth(DUST.depth);
    this.normal.fastForward(DUST.lifespanMs[1]);
    this.rising = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST_RISING.spawnTopY, DUST_RISING.speedY, false));
    this.rising.setDepth(DUST.depth);
    // Finale (WP13): the rising motes fall back down (FINALE_DUST.speedY) from the rising band; stopped by the finale frame.
    this.reverse = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST_RISING.spawnTopY, FINALE_DUST.speedY, false));
    this.reverse.setDepth(DUST.depth);
  }

  /**
   * Switches the mote stream to rising (`on`) or normal. No-op when the state is unchanged.
   * `immediate` (a loaded save with the spire already standing) fills the rising stream now and drops the normal motes.
   */
  setRising(on: boolean, immediate = false): void {
    if (on === this.risingOn) return;
    this.risingOn = on;
    // While the finale owns the field only the remembered state changes; it applies when the finale hands back to 'normal'.
    if (this.finale === 'normal') this.showStream(immediate);
  }

  /**
   * Finale dust (FinaleFrame.dust, acted on only when the mode changes). 'normal' restores the WP11 field instantly
   * (remembered rising state, filled, reverse motes dropped). 'reverse' stops normal and rising and starts the reverse
   * stream; the frame moves on to 'stopped' after FINALE_DUST.reverseS. 'stopped': nothing emits.
   */
  applyFinale(mode: FinaleFrame['dust']): void {
    if (mode === this.finale) return;
    this.finale = mode;
    this.normal.stop();
    this.rising.stop();
    this.reverse.stop();
    if (mode === 'normal') {
      this.reverse.killAll();
      this.showStream(true);
    } else if (mode === 'reverse') {
      this.reverse.start();
    }
  }

  destroy(): void {
    this.normal.destroy();
    this.rising.destroy();
    this.reverse.destroy();
  }

  // Starts the stream for the remembered state. immediate: fills it now and drops the other stream's motes.
  private showStream(immediate: boolean): void {
    if (this.risingOn) {
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
}
