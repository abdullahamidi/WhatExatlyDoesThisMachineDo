import Phaser from 'phaser';
import type { AssetId } from '../../assets/assetIds';
import { MACHINE_ANCHOR, DUST, DUST_RISING, DUST_WIND } from '../../data/world';
import { FINALE_DUST } from '../../data/finale';
import type { FinaleFrame } from '../math/finale';

const DUST_TEXTURE: AssetId = 'fx.dust';

/**
 * Mote emitter config: the shared look (life, size, fade, count) with this stream's spawn top and vertical drift.
 * The speed ranges are the configured ones; setWind rescales a live stream's ranges (windSpeeds).
 */
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

// Scales a stream's speed ranges by the wind factor: each new mote draws its speed from the bounds (EmitterOp start / end),
// so no per-emit callback runs. Live motes keep their speed.
function windSpeeds(stream: Phaser.GameObjects.Particles.ParticleEmitter, speedY: readonly [number, number], factor: number): void {
  const { speedX, speedY: vertical } = stream.ops;
  speedX.start = DUST.speedX[0] * factor;
  speedX.end = DUST.speedX[1] * factor;
  vertical.start = speedY[0] * factor;
  vertical.end = speedY[1] * factor;
}

// Drifting dust motes spread across the band around the machine (MACHINE_ANCHOR.x +- DUST.spawnHalfWidth), pre-populated so the first frame already has dust.
// Two streams share the look: `normal` (DUST band and drift) and `rising` (Era IV, once the spire stands:
// DUST_RISING band and upward drift). Only one emits at a time; the stopped stream's live motes finish naturally.
// setWind moves both streams with the weather: horizontal gravity (live motes too) and the speed factor of new motes.
export class DustField {
  private readonly normal: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rising: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly reverse: Phaser.GameObjects.Particles.ParticleEmitter;
  private drift = 1; // wind speed factor of the normal and rising streams' new motes (1 = as configured)
  private gravityX = 0; // last horizontal gravity written to the normal and rising streams
  private risingOn = false;
  private finale: FinaleFrame['dust'] = 'normal';
  private frequency = DUST.frequencyMs; // the mote interval the streams run at (setFrequencyMs; the data default until it is set)

  constructor(scene: Phaser.Scene) {
    this.normal = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST.spawnTopY, DUST.speedY, true)).setDepth(DUST.depth);
    this.normal.fastForward(DUST.lifespanMs[1]);
    this.rising = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST_RISING.spawnTopY, DUST_RISING.speedY, false)).setDepth(DUST.depth);
    // Finale (WP13): the rising motes fall back down (FINALE_DUST.speedY) from the rising band; stopped by the finale frame.
    this.reverse = scene.add.particles(0, 0, DUST_TEXTURE, moteConfig(DUST_RISING.spawnTopY, FINALE_DUST.speedY, false)).setDepth(DUST.depth);
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
   * Wind on the normal and rising streams: `unit` x DUST_WIND.gravityXPerUnit is their horizontal gravity, `drift` the
   * speed factor of their new motes (1 = as configured). Each is written only when it moved by its deadband
   * (DUST_WIND.epsilon, DUST_WIND.driftEpsilon). Ignored while the finale owns the field.
   */
  setWind(unit: number, drift: number): void {
    if (this.finale !== 'normal') return;
    const gravityX = unit * DUST_WIND.gravityXPerUnit;
    if (Math.abs(gravityX - this.gravityX) >= DUST_WIND.epsilon) {
      this.gravityX = gravityX;
      this.normal.gravityX = gravityX;
      this.rising.gravityX = gravityX;
    }
    if (Math.abs(drift - this.drift) >= DUST_WIND.driftEpsilon) {
      this.drift = drift;
      windSpeeds(this.normal, DUST.speedY, drift);
      windSpeeds(this.rising, DUST_RISING.speedY, drift);
    }
  }

  /**
   * WP28b (D6 b): the mote interval (ms) of all three streams; null restores the data default (DUST.frequencyMs). The emitters are written
   * only when the value changed, so a steady output costs nothing.
   */
  setFrequencyMs(ms: number | null): void {
    const next = ms ?? DUST.frequencyMs;
    if (next === this.frequency) return;
    this.frequency = next;
    this.normal.frequency = next;
    this.rising.frequency = next;
    this.reverse.frequency = next;
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
    const on = this.risingOn ? this.rising : this.normal;
    const off = this.risingOn ? this.normal : this.rising;
    off.stop();
    on.start();
    if (immediate) {
      on.fastForward(DUST.lifespanMs[1]);
      off.killAll();
    }
  }
}
